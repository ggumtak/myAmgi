package com.ggumtak.myamgi

import android.app.Application
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.engine.AndroidEngine
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.host.AndroidAssetSource
import com.ggumtak.myamgi.host.AndroidPlatform
import com.ggumtak.myamgi.host.HostServer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.io.File

class MyAmgiApp : Application() {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    lateinit var hostPlatform: AndroidPlatform
        private set

    @Volatile
    var hostServer: HostServer? = null
        private set

    @Volatile
    var hostStartError: Throwable? = null
        private set

    override fun onCreate() {
        super.onCreate()
        val profile = DeviceProfile.current(this)
        AndroidEngine.install(this)
        // Load librsdroid.so up front; on failure the error resurfaces via collection.status / RPC.
        runCatching { AnkiEngine.ensureNativeLoaded() }

        hostPlatform = AndroidPlatform(this)
        ensureHostServer()

        if (profile.warmBackendOnLaunch) {
            appScope.launch {
                runCatching { AnkiEngine.ensureOpen() }
            }
        }
    }

    @Synchronized
    fun ensureHostServer(): HostServer? {
        hostServer?.let { return it }
        return try {
            val uiOtaDir = File(filesDir, "ui-ota")
            val hostDataDir = File(filesDir, "host_data")
            val collectionDir = AndroidEngine.collectionDir(this)
            val server = HostServer(
                uiBuiltIn = AndroidAssetSource(assets, "ui/"),
                uiOtaDir = uiOtaDir,
                ankiAssets = AndroidAssetSource(assets, "backend/"),
                dataDir = hostDataDir,
                platform = hostPlatform,
                port = 0,
                collectionDir = collectionDir,
                nativeBuild = BuildConfig.VERSION_CODE
            ).start()
            hostPlatform.serverRef = server
            hostServer = server
            hostStartError = null
            server
        } catch (t: Throwable) {
            hostStartError = t
            null
        }
    }

    override fun onTerminate() {
        runCatching { hostPlatform.shutdown() }
        runCatching { hostServer?.stop() }
        runCatching { AnkiEngine.closeAll() }
        super.onTerminate()
    }
}
