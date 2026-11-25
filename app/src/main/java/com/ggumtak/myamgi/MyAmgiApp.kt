package com.ggumtak.myamgi

import android.app.Application
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.engine.AnkiEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class MyAmgiApp : Application() {
    val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onCreate() {
        super.onCreate()
        val profile = DeviceProfile.current(this)
        AnkiEngine.initDirectory(this)
        // On Pro build (phones/tablets), warm up the Anki 26.09.4 Rust engine immediately in background
        if (profile.warmBackendOnLaunch) {
            appScope.launch {
                runCatching { AnkiEngine.ensureOpen() }
            }
        }
    }
}
