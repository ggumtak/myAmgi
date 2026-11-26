package com.ggumtak.myamgi.host

import android.app.Activity

/** What [HostRuntime] asks of the visible [com.ggumtak.myamgi.shell.HostActivity]. Always called on the main thread. */
interface ShellCallbacks {
    val activity: Activity
    fun onUiReady()
    fun onUiState(state: UiShellState)
    fun onBackHandled(id: Long)
    fun exitApp()
    fun reloadUi()
}
