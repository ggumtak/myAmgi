package com.ggumtak.myamgi

import android.app.Application
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.engine.AndroidEngine
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.host.HostRuntime
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class MyAmgiApp : Application() {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    @Volatile
    private var runtime: HostRuntime? = null

    /**
     * The app-wide host server, started on first use (by the shell activity; a process started only for the
     * ContentProvider never starts it). Lives as long as the process.
     */
    fun hostRuntime(): HostRuntime {
        runtime?.let { return it }
        synchronized(this) {
            runtime?.let { return it }
            return HostRuntime(this).also { runtime = it }
        }
    }

    override fun onCreate() {
        super.onCreate()
        val profile = DeviceProfile.current(this)
        AndroidEngine.install(this)
        // Load librsdroid.so up front; on failure the error resurfaces (and is shown) on first engine use.
        runCatching { AnkiEngine.ensureNativeLoaded() }
        // Pro (phones/tablets): open the collection in the background right away.
        if (profile.warmBackendOnLaunch) {
            appScope.launch {
                runCatching { AnkiEngine.ensureOpen() }
            }
        }
    }
}
