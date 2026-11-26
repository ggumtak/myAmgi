package com.ggumtak.myamgi.host

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.AssetManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.speech.tts.TextToSpeech
import android.webkit.MimeTypeMap
import android.widget.Toast
import androidx.core.content.FileProvider
import com.ggumtak.myamgi.BuildConfig
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.hanja.HanjaIntegration
import com.ggumtak.myamgi.update.AppUpdater
import com.ggumtak.myamgi.update.OtaAssetUpdater
import com.ggumtak.myamgi.update.OtaUiUpdater
import com.ggumtak.myamgi.update.UpdateInfo
import kotlinx.coroutines.runBlocking
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File
import java.io.InputStream
import java.lang.ref.WeakReference
import java.util.Locale
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

class AndroidAssetSource(private val assets: AssetManager, private val prefix: String) : AssetSource {
    override fun open(path: String): InputStream? =
        if (path.isEmpty() || path.endsWith("/")) null else runCatching { assets.open(prefix + path) }.getOrNull()
}

class AndroidPlatform(context: Context) : Platform {
    private val app = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())

    @Volatile
    private var activityRef: WeakReference<Activity>? = null

    @Volatile
    var serverRef: HostServer? = null

    private val ttsLock = Any()
    @Volatile
    private var ttsEngine: TextToSpeech? = null
    @Volatile
    private var ttsReady = false

    @Volatile
    private var cachedApkLatest: UpdateInfo.Latest? = null
    @Volatile
    private var cachedUiAvailable: OtaUiUpdater.Available? = null
    @Volatile
    private var isCheckingUpdates = false
    @Volatile
    private var lastUpdateError: String? = null

    fun attachActivity(activity: Activity) {
        activityRef = WeakReference(activity)
    }

    fun detachActivity(activity: Activity) {
        if (activityRef?.get() === activity) {
            activityRef = null
        }
    }

    private fun activeActivity(): Activity? =
        activityRef?.get()?.takeIf { !it.isFinishing && !it.isDestroyed }

    override fun info(): PlatformInfo {
        val profile = DeviceProfile.current(app)
        return PlatformInfo(
            platform = "android",
            appVersion = BuildConfig.VERSION_NAME,
            build = BuildConfig.VERSION_CODE,
            flavor = BuildConfig.FLAVOR_NAME,
            eink = profile.isEink,
            device = "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})"
        )
    }

    override fun share(file: File, name: String) {
        if (!file.isFile) throw HostError(404, "공유할 파일을 찾을 수 없습니다.")
        val safeName = HostApi.safeFileName(name)
        val shareDir = File(app.cacheDir, "share").apply { mkdirs() }
        val cutoff = System.currentTimeMillis() - 60L * 60L * 1000L
        shareDir.listFiles()?.filter { it.isFile && it.lastModified() < cutoff }?.forEach { it.delete() }

        val staged = File(shareDir, safeName)
        file.copyTo(staged, overwrite = true)

        val authority = "${BuildConfig.APPLICATION_ID}.fileprovider"
        val uri = FileProvider.getUriForFile(app, authority, staged)
        val ext = safeName.substringAfterLast('.', "").lowercase(Locale.ROOT)
        val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext) ?: "application/octet-stream"

        val sendIntent = Intent(Intent.ACTION_SEND).apply {
            type = mime
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, safeName)
            clipData = ClipData.newRawUri(safeName, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(sendIntent, safeName)
        launchIntent(chooser, "파일 공유 창을 열 수 없습니다.")
    }

    override fun openExternal(url: String) {
        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
        launchIntent(intent, "외부 링크를 열 수 없습니다.")
    }

    private fun launchIntent(intent: Intent, errorMessage: String) {
        val activity = activeActivity()
        try {
            if (activity != null) {
                activity.startActivity(intent)
            } else {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                app.startActivity(intent)
            }
        } catch (_: ActivityNotFoundException) {
            throw HostError(502, errorMessage)
        } catch (_: SecurityException) {
            throw HostError(502, errorMessage)
        }
    }

    override fun tts(text: String, lang: String?, rate: Double?) {
        if (text.isBlank()) return
        val engine = ensureTts() ?: throw HostError(503, "음성 읽기 엔진을 초기화할 수 없습니다.")
        val locale = resolveTtsLocale(text, lang)
        synchronized(ttsLock) {
            val langResult = runCatching { engine.setLanguage(locale) }.getOrDefault(TextToSpeech.LANG_NOT_SUPPORTED)
            if (langResult == TextToSpeech.LANG_MISSING_DATA || langResult == TextToSpeech.LANG_NOT_SUPPORTED) {
                runCatching { engine.setLanguage(Locale.getDefault()) }
            }
            val speechRate = (rate ?: 1.0).toFloat().coerceIn(0.25f, 3.0f)
            engine.setSpeechRate(speechRate)
            val status = engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, UUID.randomUUID().toString())
            if (status != TextToSpeech.SUCCESS) {
                throw HostError(500, "음성 읽기를 시작하지 못했습니다.")
            }
        }
    }

    override fun ttsStop() {
        synchronized(ttsLock) {
            runCatching { ttsEngine?.stop() }
        }
    }

    private fun ensureTts(): TextToSpeech? {
        ttsEngine?.takeIf { ttsReady }?.let { return it }
        synchronized(ttsLock) {
            ttsEngine?.takeIf { ttsReady }?.let { return it }
            runCatching { ttsEngine?.shutdown() }
            ttsEngine = null
            ttsReady = false

            val latch = CountDownLatch(1)
            var initSuccess = false
            var created: TextToSpeech? = null
            val startInit = Runnable {
                created = TextToSpeech(app) { status ->
                    initSuccess = (status == TextToSpeech.SUCCESS)
                    latch.countDown()
                }
            }
            if (Looper.myLooper() == Looper.getMainLooper()) {
                startInit.run()
            } else {
                mainHandler.post(startInit)
            }
            val completed = latch.await(5, TimeUnit.SECONDS)
            if (!completed || !initSuccess || created == null) {
                runCatching { created?.shutdown() }
                return null
            }
            ttsEngine = created
            ttsReady = true
            return created
        }
    }

    private fun resolveTtsLocale(text: String, lang: String?): Locale {
        if (!lang.isNullOrBlank()) {
            return Locale.forLanguageTag(lang.trim())
        }
        var hasHangul = false
        var hasKana = false
        var hasCjk = false
        for (ch in text) {
            when {
                ch in '\uAC00'..'\uD7A3' || ch in '\u1100'..'\u11FF' || ch in '\u3130'..'\u318F' -> hasHangul = true
                ch in '\u3040'..'\u309F' || ch in '\u30A0'..'\u30FF' -> hasKana = true
                ch in '\u4E00'..'\u9FFF' -> hasCjk = true
            }
        }
        return when {
            hasKana -> Locale.JAPANESE
            hasHangul -> Locale.KOREAN
            hasCjk -> Locale.JAPANESE
            else -> Locale.US
        }
    }

    override fun clipboardWrite(text: String) {
        val latch = CountDownLatch(1)
        var failure: Throwable? = null
        val writeTask = Runnable {
            try {
                val cm = app.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("myAmgi", text))
            } catch (t: Throwable) {
                failure = t
            } finally {
                latch.countDown()
            }
        }
        if (Looper.myLooper() == Looper.getMainLooper()) {
            writeTask.run()
        } else {
            mainHandler.post(writeTask)
            latch.await(2, TimeUnit.SECONDS)
        }
        failure?.let { throw HostError(500, "클립보드에 복사하지 못했습니다.", it.message, it) }
    }

    override fun exit() {
        mainHandler.post {
            val activity = activeActivity()
            if (activity != null) {
                activity.finishAndRemoveTask()
            }
        }
    }

    override fun hanjaLookup(text: String, sentence: String?) {
        val uriBuilder = Uri.Builder()
            .scheme("hanja")
            .authority("lookup")
            .appendQueryParameter("q", text)
        if (!sentence.isNullOrBlank()) {
            uriBuilder.appendQueryParameter("s", sentence)
        }
        val intent = Intent(Intent.ACTION_VIEW, uriBuilder.build()).apply {
            `package` = HanjaIntegration.HANJA_PACKAGE
            addCategory(Intent.CATEGORY_BROWSABLE)
        }
        val activity = activeActivity()
        try {
            if (activity != null) {
                activity.startActivity(intent)
            } else {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                app.startActivity(intent)
            }
        } catch (_: ActivityNotFoundException) {
            showHanjaMissingToast()
            throw HostError(404, "한자 바로보기 앱이 설치되어 있지 않습니다.", "hanja-not-installed")
        } catch (_: SecurityException) {
            showHanjaMissingToast()
            throw HostError(404, "한자 바로보기 앱이 설치되어 있지 않습니다.", "hanja-not-installed")
        }
    }

    private fun showHanjaMissingToast() {
        mainHandler.post {
            Toast.makeText(
                app,
                "한자 바로보기 앱(com.ggumtak.hanja)이 설치되어 있지 않습니다.",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    override fun hanjaTapScript(): String = HanjaIntegration.loadTapScript(app).second

    override fun updateStatus(): JsonObject = buildUpdatePayload()

    override fun updateCheck(): JsonObject {
        isCheckingUpdates = true
        lastUpdateError = null
        try {
            val apkLatest = runCatching { AppUpdater.fetchLatestBlocking() }
                .onFailure { lastUpdateError = it.message }
                .getOrNull()
            cachedApkLatest = apkLatest

            val currentUi = serverRef?.ui?.version()
            val uiAvailable = runCatching { OtaUiUpdater.check(currentUi) }
                .onFailure { if (lastUpdateError == null) lastUpdateError = it.message }
                .getOrNull()
            cachedUiAvailable = uiAvailable

            // Keep legacy OTA assets (e.g. hanja/anki-tap.js) fresh in background.
            runCatching { runBlocking { OtaAssetUpdater.checkAndUpdate(app) } }
        } finally {
            isCheckingUpdates = false
        }
        return buildUpdatePayload()
    }

    override fun updateApply(): JsonObject {
        if (cachedApkLatest == null && cachedUiAvailable == null) {
            updateCheck()
        }

        val apkLatest = cachedApkLatest
        val apkAvailable = apkLatest != null && UpdateInfo.isNewer(apkLatest, AppUpdater.current)
        if (apkAvailable) {
            if (!app.packageManager.canRequestPackageInstalls()) {
                val permIntent = Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + app.packageName)
                )
                runCatching { launchIntent(permIntent, "설치 권한 화면을 열 수 없습니다.") }
                return buildUpdatePayload(
                    needsPermission = true,
                    message = "'출처를 알 수 없는 앱 설치' 권한을 허용한 뒤 다시 눌러 주세요."
                )
            }

            val events = serverRef?.events
            events?.publish("progress", jsonOf("op" to "update", "phase" to "start"))
            val started = AppUpdater.installWithContext(
                context = activeActivity() ?: app,
                latest = apkLatest,
                progress = { pct ->
                    events?.publish(
                        "progress",
                        jsonOf(
                            "op" to "update",
                            "phase" to "running",
                            "kind" to "apk",
                            "current" to pct.coerceAtLeast(0),
                            "total" to 100
                        )
                    )
                },
                failed = { err ->
                    lastUpdateError = err
                    events?.publish(
                        "progress",
                        jsonOf("op" to "update", "phase" to "error", "error" to err)
                    )
                }
            )
            return buildUpdatePayload(started = started)
        }

        val uiAvail = cachedUiAvailable
        if (uiAvail != null) {
            val events = serverRef?.events
            events?.publish("progress", jsonOf("op" to "update", "phase" to "start"))
            return try {
                val appliedVersion = OtaUiUpdater.apply(
                    context = app,
                    expectedVersion = uiAvail.version,
                    bundleUrl = uiAvail.bundleUrl,
                    onProgress = { pct ->
                        events?.publish(
                            "progress",
                            jsonOf(
                                "op" to "update",
                                "phase" to "running",
                                "kind" to "ui",
                                "current" to pct,
                                "total" to 100
                            )
                        )
                    }
                )
                runCatching { runBlocking { OtaAssetUpdater.checkAndUpdate(app) } }
                cachedUiAvailable = null
                events?.publish("progress", jsonOf("op" to "update", "phase" to "done"))
                buildUpdatePayload(
                    started = true,
                    applied = true,
                    reloadRequired = true,
                    overrideKind = "ui",
                    overrideVersion = appliedVersion
                )
            } catch (t: Throwable) {
                val msg = t.message ?: "UI OTA 업데이트 실패"
                lastUpdateError = msg
                events?.publish(
                    "progress",
                    jsonOf("op" to "update", "phase" to "error", "error" to msg)
                )
                throw HostError(502, msg, null, t)
            }
        }

        return buildUpdatePayload()
    }

    private fun buildUpdatePayload(
        started: Boolean = false,
        applied: Boolean = false,
        reloadRequired: Boolean = false,
        needsPermission: Boolean = false,
        message: String? = null,
        overrideKind: String? = null,
        overrideVersion: String? = null
    ): JsonObject {
        val currentUiVersion = serverRef?.ui?.version()
        val apkLatest = cachedApkLatest
        val apkAvailable = apkLatest != null && UpdateInfo.isNewer(apkLatest, AppUpdater.current)
        val uiAvail = cachedUiAvailable
        val uiAvailable = uiAvail != null
        val patch = if (apkAvailable) UpdateInfo.patchFor(apkLatest, AppUpdater.current) else null

        val kind = overrideKind ?: when {
            apkAvailable -> "apk"
            uiAvailable -> "ui"
            else -> "none"
        }
        val available = apkAvailable || uiAvailable
        val targetVersion = overrideVersion ?: when {
            apkAvailable -> "1.0.${apkLatest.build}"
            uiAvail != null -> uiAvail.version
            else -> BuildConfig.VERSION_NAME
        }
        val sizeBytes = when {
            apkAvailable -> patch?.size ?: apkLatest.size
            uiAvail != null -> uiAvail.sizeBytes
            else -> 0L
        }

        val map = linkedMapOf<String, JsonElement>(
            "supported" to JsonPrimitive(true),
            "checking" to JsonPrimitive(isCheckingUpdates),
            "available" to JsonPrimitive(available),
            "kind" to JsonPrimitive(kind),
            "version" to JsonPrimitive(targetVersion),
            "currentVersion" to JsonPrimitive(BuildConfig.VERSION_NAME),
            "uiVersion" to (currentUiVersion?.let { JsonPrimitive(it) } ?: JsonNull),
            "remoteUiVersion" to (uiAvail?.version?.let { JsonPrimitive(it) } ?: JsonNull),
            "apkAvailable" to JsonPrimitive(apkAvailable),
            "uiAvailable" to JsonPrimitive(uiAvailable),
            "sizeBytes" to JsonPrimitive(sizeBytes.coerceAtLeast(0L)),
            "isDeltaPatch" to JsonPrimitive(patch != null),
            "started" to JsonPrimitive(started),
            "applied" to JsonPrimitive(applied),
            "reloadRequired" to JsonPrimitive(reloadRequired),
            "needsPermission" to JsonPrimitive(needsPermission),
            "error" to (lastUpdateError?.let { JsonPrimitive(it) } ?: JsonNull)
        )
        if (!message.isNullOrBlank()) {
            map["message"] = JsonPrimitive(message)
        }
        return JsonObject(map)
    }

    fun shutdown() {
        synchronized(ttsLock) {
            runCatching { ttsEngine?.stop() }
            runCatching { ttsEngine?.shutdown() }
            ttsEngine = null
            ttsReady = false
        }
    }

    private fun jsonOf(vararg pairs: Pair<String, Any?>): JsonObject =
        JsonObject(pairs.associate { (k, v) -> k to toJson(v) })

    private fun toJson(v: Any?): JsonElement = when (v) {
        null -> JsonNull
        is JsonElement -> v
        is String -> JsonPrimitive(v)
        is Number -> JsonPrimitive(v)
        is Boolean -> JsonPrimitive(v)
        else -> JsonPrimitive(v.toString())
    }
}
