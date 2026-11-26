package com.ggumtak.myamgi.update

import android.content.Context
import com.ggumtak.myamgi.BuildConfig
import com.ggumtak.myamgi.host.HostError
import com.ggumtak.myamgi.host.HostRuntime
import kotlinx.serialization.json.JsonObject
import java.util.concurrent.atomic.AtomicBoolean

/**
 * `update.status` / `update.check` / `update.apply` on Android: the APK (release `latest` + delta patches via
 * [AppUpdater]) and the UI bundle (release `update-files`: `ui-manifest.json` + zip via [UiOtaInstaller]).
 *
 * A check installs a newer compatible UI bundle by itself (it only takes effect when the page reloads; the
 * `update` event tells the UI, which can offer "새 화면으로 다시 열기" = `update.apply {kind: "ota"}`).
 * An APK update is only downloaded and installed on `update.apply` (Android asks the owner to confirm).
 * Every state change is published as the host event `update` with the same JSON as `update.status`.
 */
class UpdateCenter(context: Context, private val runtime: HostRuntime) {
    private val app = context.applicationContext
    private val store get() = runtime.otaStore
    private val installer by lazy { UiOtaInstaller(store) }
    private val busy = AtomicBoolean(false)

    @Volatile private var apkLatest: UpdateInfo.Latest? = null
    @Volatile private var phase = "idle"
    @Volatile private var percent: Int? = null
    @Volatile private var lastError: String? = null
    @Volatile private var uiDownloaded: String? = null
    @Volatile private var uiNote: String? = null

    /** A UI bundle was activated after the page loaded: reloading shows it. */
    @Volatile private var reloadNeeded = false

    fun status(): JsonObject {
        val latest = apkLatest
        val apkAvailable = latest != null && UpdateInfo.isNewer(latest, BuildConfig.VERSION_CODE)
        val ota = runtime.otaServed()
        val s = store.state()
        return HostRuntime.json(
            "available" to (apkAvailable || reloadNeeded),
            "kind" to when {
                apkAvailable -> "apk"
                reloadNeeded -> "ota"
                else -> null
            },
            "current" to BuildConfig.VERSION_NAME,
            "latest" to when {
                apkAvailable -> "1.0.${latest!!.build}"
                reloadNeeded -> uiDownloaded
                else -> null
            },
            "running" to busy.get(),
            "phase" to phase,
            "percent" to percent,
            "lastError" to lastError,
            "lastCheck" to s.lastCheck.takeIf { it > 0 },
            "apk" to HostRuntime.json(
                "build" to BuildConfig.VERSION_CODE,
                "latestBuild" to latest?.build,
                "available" to apkAvailable,
                "size" to latest?.size,
                "patch" to (latest?.let { UpdateInfo.patchFor(it, BuildConfig.VERSION_CODE) != null } ?: false)
            ),
            "ui" to HostRuntime.json(
                "version" to runtime.server.ui.version(),
                "builtInVersion" to runtime.server.ui.builtInVersion,
                "source" to if (ota) "ota" else "builtin",
                "downloaded" to uiDownloaded,
                "reloadNeeded" to reloadNeeded,
                "note" to uiNote,
                "lastRollback" to s.lastRollback
            )
        )
    }

    private fun publish() {
        runCatching { runtime.publish("update", status()) }
    }

    private fun set(phase: String, percent: Int? = null) {
        this.phase = phase
        this.percent = percent
        publish()
    }

    /** At launch: a quiet check at most every [CHECK_INTERVAL_MILLIS], on a background thread. */
    fun checkOnLaunchIfDue() {
        val last = store.state().lastCheck
        if (System.currentTimeMillis() - last < CHECK_INTERVAL_MILLIS) return
        Thread({ runCatching { check(quiet = true) } }, "amgi-update-check").apply { isDaemon = true }.start()
    }

    /** Blocking (host function thread). Checks the APK and the UI bundle and installs a newer UI bundle. */
    fun check(quiet: Boolean): JsonObject {
        if (!busy.compareAndSet(false, true)) {
            if (quiet) return status()
            throw HostError(409, "이미 업데이트를 확인하는 중입니다.", "busy")
        }
        try {
            lastError = null
            set("checking")
            apkLatest = runCatching { AppUpdater.fetchLatest() }.getOrNull() ?: apkLatest
            val apkFailed = apkLatest == null
            val uiError = runCatching { checkUi() }.exceptionOrNull()
            store.update { it.copy(lastCheck = System.currentTimeMillis()) }
            lastError = when {
                uiError != null -> "화면(UI) 업데이트에 실패했습니다: ${uiError.message ?: uiError.javaClass.simpleName}"
                apkFailed -> "업데이트 정보를 받아오지 못했습니다. 인터넷 연결을 확인하세요."
                else -> null
            }
            if (uiError != null) runtime.log.warn("UI bundle update failed: $uiError")
            set(if (lastError == null) "idle" else "failed")
            return status()
        } finally {
            busy.set(false)
            publish()
        }
    }

    private fun checkUi() {
        val text = UiOtaInstaller.httpText(UpdateInfo.downloadUrl(UpdateInfo.UPDATE_FILES_TAG, UiOtaManifest.NAME))
            ?: return // nothing published yet
        val m = UiOtaManifest.parse(text)
        val installed = if (runtime.otaServed()) runtime.server.ui.version() else null
        when (m.decide(BuildConfig.VERSION_CODE, runtime.server.ui.builtInVersion, installed, store.state().bad.toSet())) {
            UiOtaManifest.Decision.UP_TO_DATE -> uiNote = null
            UiOtaManifest.Decision.KNOWN_BAD -> uiNote = "화면 ${m.version}은(는) 이 기기에서 열리지 않아 건너뜁니다."
            UiOtaManifest.Decision.NEEDS_NEWER_APK -> uiNote = "화면 ${m.version}은(는) 앱을 먼저 업데이트해야 받을 수 있습니다."
            UiOtaManifest.Decision.INSTALL -> {
                set("downloading", 0)
                installer.install(m) { p -> if (p % 10 == 0) set("downloading", p) }
                uiDownloaded = m.version
                reloadNeeded = true
                uiNote = null
                runtime.log.info("UI bundle ${m.version} installed (pending first start)")
            }
        }
    }

    /** `update.apply {kind}`: `"apk"` installs the newer APK; `"ota"`/`"ui"` reloads into the new UI bundle. */
    fun apply(kind: String?): JsonObject {
        val latest = apkLatest
        val apkAvailable = latest != null && UpdateInfo.isNewer(latest, BuildConfig.VERSION_CODE)
        val k = kind?.lowercase() ?: if (apkAvailable) "apk" else if (reloadNeeded) "ota" else null
        when (k) {
            "ota", "ui" -> {
                reloadNeeded = false
                runtime.post { runtime.shell?.reloadUi() }
                return status()
            }
            "apk" -> {
                if (!apkAvailable) throw HostError(409, "설치할 새 버전이 없습니다. 먼저 업데이트를 확인하세요.", "no-update")
                val activity = runtime.shell?.activity
                    ?: throw HostError(409, "앱 화면이 열려 있을 때 다시 시도하세요.", "no-activity")
                if (!busy.compareAndSet(false, true)) throw HostError(409, "이미 업데이트 중입니다.", "busy")
                lastError = null
                set("downloading", 0)
                val started = runCatching {
                    runtime.onMain {
                        AppUpdater.install(
                            activity, latest!!,
                            progress = { p -> set("downloading", p.takeIf { it >= 0 }) },
                            failed = { msg ->
                                lastError = msg
                                busy.set(false)
                                set("failed")
                            }
                        )
                    }
                }.getOrElse {
                    busy.set(false)
                    throw HostError(500, "업데이트를 시작하지 못했습니다.", it.message, it)
                }
                if (!started) {
                    busy.set(false)
                    lastError = "설정 화면에서 '이 출처 허용'을 켠 뒤 다시 [업데이트]를 누르세요."
                    set("needs-permission")
                } else {
                    // The installer takes over; Android shows its confirmation, then restarts the app.
                    phase = "installing"
                    publish()
                    Thread {
                        Thread.sleep(120_000)
                        if (phase == "installing" || phase == "downloading") {
                            busy.set(false)
                        }
                    }.apply { isDaemon = true }.start()
                }
                return status()
            }
            else -> throw HostError(409, "설치할 업데이트가 없습니다.", "no-update")
        }
    }

    companion object {
        const val CHECK_INTERVAL_MILLIS = 6L * 60 * 60 * 1000
    }
}
