package com.ggumtak.myamgi.host

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.content.FileProvider
import com.ggumtak.myamgi.BuildConfig
import com.ggumtak.myamgi.hanja.HanjaIntegration
import com.ggumtak.myamgi.shell.ShareMime
import kotlinx.serialization.json.JsonObject
import java.io.File
import java.util.UUID

/**
 * [Platform] for Android. Runs on the host server's threads; anything that touches the activity is posted to
 * the main thread through [HostRuntime].
 */
class AndroidPlatform(context: Context, private val runtime: HostRuntime) : Platform {
    private val app = context.applicationContext
    private val tts by lazy { AndroidTts(app) }

    override fun info() = PlatformInfo(
        platform = "android",
        appVersion = BuildConfig.VERSION_NAME,
        build = BuildConfig.VERSION_CODE,
        flavor = BuildConfig.FLAVOR_NAME,
        eink = runtime.profile.isEink,
        device = "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})"
    )

    /** Copies [file] under its display [name] into the FileProvider share dir and opens the share sheet. */
    override fun share(file: File, name: String) {
        val dir = File(runtime.shareDir(), UUID.randomUUID().toString().take(12)).apply { mkdirs() }
        val copy = File(dir, HostApi.safeFileName(name))
        file.copyTo(copy, overwrite = true)
        val uri = FileProvider.getUriForFile(app, BuildConfig.FILE_PROVIDER_AUTHORITY, copy)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = ShareMime.of(copy.name)
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_TITLE, copy.name)
            clipData = ClipData.newRawUri(copy.name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        startActivity(Intent.createChooser(send, "공유: ${copy.name}"), "공유할 앱이 없습니다.")
    }

    override fun openExternal(url: String) {
        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE), "이 주소를 열 수 있는 앱이 없습니다.")
    }

    override fun tts(text: String, lang: String?, rate: Double?) = tts.speak(text, lang, rate)

    override fun ttsStop() = tts.stop()

    override fun clipboardWrite(text: String) = runtime.onMain {
        val cm = app.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("myAmgi", text))
    }

    override fun exit() {
        runtime.post { runtime.shell?.exitApp() }
    }

    override fun hanjaLookup(text: String, sentence: String?) {
        val intent = HanjaIntegration.lookupIntent(text, sentence)
        try {
            startActivity(intent, HanjaIntegration.MISSING_APP_MESSAGE)
        } catch (e: SecurityException) {
            throw HostError(501, HanjaIntegration.MISSING_APP_MESSAGE, "hanja-app-missing", e)
        }
    }

    override fun hanjaScript(): JsonObject {
        val (source, js) = HanjaIntegration.loadTapScript(app)
        if (js.isBlank()) throw HostError(404, "한자 탭 스크립트를 찾을 수 없습니다.", "hanja-script-missing")
        return HostRuntime.json("version" to HanjaIntegration.scriptVersion(js), "js" to js, "source" to source)
    }

    override fun updateStatus(): JsonObject = runtime.updates.status()

    override fun updateCheck(): JsonObject = runtime.updates.check(quiet = false)

    override fun updateApply(): JsonObject = runtime.updates.apply(null)

    override fun updateApply(kind: String?): JsonObject = runtime.updates.apply(kind)

    override fun uiReady(uiVersion: String?, features: List<String>) = runtime.onUiReady(uiVersion, features)

    override fun uiState(state: UiShellState) = runtime.onUiState(state)

    override fun backHandled(id: Long) {
        runtime.post { runtime.shell?.onBackHandled(id) }
    }

    /** Starts [intent] on the main thread from the visible activity (or as a new task without one). */
    private fun startActivity(intent: Intent, noAppMessage: String) = runtime.onMain {
        val activity = runtime.shell?.activity
        try {
            if (activity != null) activity.startActivity(intent) else app.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: ActivityNotFoundException) {
            throw HostError(501, noAppMessage, "no-activity", e)
        }
    }
}
