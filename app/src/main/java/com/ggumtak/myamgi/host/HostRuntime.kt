package com.ggumtak.myamgi.host

import android.content.Context
import android.os.Handler
import android.os.Looper
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.engine.AndroidEngine
import com.ggumtak.myamgi.shell.OpenFileQueue
import com.ggumtak.myamgi.update.UiOtaStore
import com.ggumtak.myamgi.update.UpdateCenter
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File

/**
 * The app-wide host: one [HostServer] per process (random port and token, 127.0.0.1 only), owned by the
 * Application so it outlives activity recreation. A restarted process gets a new port/token; the activity
 * always asks for [HostServer.startUrl].
 *
 * Data layout (beside the collection, never inside it):
 * - `filesDir/anki_collection/` — the Anki collection + `collection.media` (unchanged from builds ≤ 11)
 * - `filesDir/amgi-host/` — host data: `prefs.json`, `backups/`, `tmp/` (uploads, exports, shares), `host/sync.json`
 * - `filesDir/ui-ota/` — the OTA UI bundle ([UiOtaStore])
 */
class HostRuntime(context: Context) {
    val app: Context = context.applicationContext
    val log = HostLog()
    val profile: DeviceProfile = DeviceProfile.current(app)
    val dataDir = File(app.filesDir, "amgi-host")
    val otaStore = UiOtaStore(File(app.filesDir, "ui-ota"))
    val builtInUi = AndroidAssetSource(app.assets, "ui/")
    val platform = AndroidPlatform(app, this)
    val server: HostServer
    val updates: UpdateCenter
    val openFiles = OpenFileQueue()
    private val main = Handler(Looper.getMainLooper())

    /** The visible shell activity, if any. */
    @Volatile
    var shell: ShellCallbacks? = null

    /** Merged `ui.state` reports. */
    @Volatile
    var uiState = UiShellState()
        private set

    /** `ui.ready` arrived since the current page started loading. */
    @Volatile
    var uiReadyThisPage = false
        private set

    @Volatile
    var uiFeatures: Set<String> = emptySet()
        private set

    /** The current page was loaded while the OTA bundle was being served (only such a page can confirm it). */
    @Volatile
    var pageServedOta = false
        private set

    init {
        LegacyMigration.run(app, dataDir, log)
        val builtInVersion = UiBundle(builtInUi, null).builtInVersion
        runCatching { otaStore.recover(builtInVersion) }
            .onSuccess { v -> if (v != null) log.warn("UI bundle $v rolled back at start (never reported ready)") }
            .onFailure { log.error("UI bundle recovery failed", it) }
        server = HostServer(
            uiBuiltIn = builtInUi,
            uiOtaDir = otaStore.currentDir,
            ankiAssets = AndroidAssetSource(app.assets, "backend/"),
            dataDir = dataDir,
            platform = platform,
            collectionDir = AndroidEngine.collectionDir(app),
            log = log
        ).start()
        cleanShareDir()
        updates = UpdateCenter(app, this)
        log.info("myAmgi ${platform.info().appVersion} (${platform.info().flavor}) UI ${server.ui.version()} ota=${server.ui.otaActive()}")
    }

    fun otaServed(): Boolean = server.ui.otaActive()

    /** The owner's "볼륨키/리모컨으로 학습" pref (host prefs `volumeKeys`; device default when never set). */
    fun volumeKeysEnabled(): Boolean = server.api.prefs.bool("volumeKeys", profile.defaultVolumeKeyStudy)

    fun post(block: () -> Unit) {
        main.post(block)
    }

    /**
     * Runs [block] on the main thread and waits for it (host function threads only), so errors such as
     * "no app can open this" reach the UI as a [HostError].
     */
    fun <T> onMain(block: () -> T): T {
        if (Looper.myLooper() == Looper.getMainLooper()) return block()
        val latch = java.util.concurrent.CountDownLatch(1)
        var result: Result<T>? = null
        main.post {
            result = runCatching(block)
            latch.countDown()
        }
        if (!latch.await(10, java.util.concurrent.TimeUnit.SECONDS)) throw HostError(504, "앱이 응답하지 않습니다.", "main-thread-timeout")
        return result!!.getOrThrow()
    }

    fun publish(event: String, data: JsonObject) = server.publish(event, data)

    // --- called by AndroidPlatform on server threads ---

    fun onUiReady(uiVersion: String?, features: List<String>) {
        uiReadyThisPage = true
        uiFeatures = features.toSet()
        otaStore.onUiReady(pageServedOta && otaServed())
        log.info("ui ready: $uiVersion ${features.joinToString(",")}")
        post { shell?.onUiReady() }
    }

    fun onUiState(s: UiShellState) {
        val merged = UiShellState(
            theme = s.theme ?: uiState.theme,
            background = s.background ?: uiState.background,
            keepScreenOn = s.keepScreenOn ?: uiState.keepScreenOn,
            captureKeys = s.captureKeys ?: uiState.captureKeys
        )
        uiState = merged
        post { shell?.onUiState(merged) }
    }

    /** A new page started loading in the shell: per-page state starts over (theme is kept). */
    fun onPageStarted() {
        uiReadyThisPage = false
        pageServedOta = otaServed()
        uiState = uiState.copy(keepScreenOn = null, captureKeys = null)
        openFiles.pageChanged()
    }

    fun shareDir(): File = File(dataDir, "tmp/share")

    private fun cleanShareDir() {
        val cutoff = System.currentTimeMillis() - 24 * 60 * 60 * 1000L
        shareDir().listFiles()?.filter { it.lastModified() < cutoff }?.forEach { it.deleteRecursively() }
    }

    companion object {
        fun json(vararg pairs: Pair<String, Any?>): JsonObject = JsonObject(pairs.associate { (k, v) -> k to toJsonValue(v) })

        fun toJsonValue(v: Any?): kotlinx.serialization.json.JsonElement = when (v) {
            null -> kotlinx.serialization.json.JsonNull
            is kotlinx.serialization.json.JsonElement -> v
            is String -> JsonPrimitive(v)
            is Number -> JsonPrimitive(v)
            is Boolean -> JsonPrimitive(v)
            else -> JsonPrimitive(v.toString())
        }
    }
}
