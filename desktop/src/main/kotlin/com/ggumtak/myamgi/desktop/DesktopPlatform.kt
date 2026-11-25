package com.ggumtak.myamgi.desktop

import com.ggumtak.myamgi.host.HostError
import com.ggumtak.myamgi.host.Platform
import com.ggumtak.myamgi.host.PlatformInfo
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.awt.Desktop
import java.awt.GraphicsEnvironment
import java.awt.Toolkit
import java.awt.datatransfer.StringSelection
import java.io.File
import java.net.URI

/** PC shell: browser links and clipboard through AWT when a display exists; the rest is unsupported. */
class DesktopPlatform(private val onExit: () -> Unit) : Platform {
    private val headless = GraphicsEnvironment.isHeadless()

    override fun info() = PlatformInfo(
        platform = "desktop",
        appVersion = VERSION,
        build = 0,
        flavor = "desktop",
        eink = false,
        device = "${System.getProperty("os.name")} ${System.getProperty("os.arch")}"
    )

    override fun openExternal(url: String) {
        if (headless || !Desktop.isDesktopSupported() || !Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
            throw HostError.unsupported("외부 링크 열기")
        }
        Desktop.getDesktop().browse(URI(url))
    }

    override fun clipboardWrite(text: String) {
        if (headless) throw HostError.unsupported("클립보드 복사")
        Toolkit.getDefaultToolkit().systemClipboard.setContents(StringSelection(text), null)
    }

    override fun share(file: File, name: String) {
        // No share sheet on PC: show the file in the system file manager instead.
        if (headless || !Desktop.isDesktopSupported() || !Desktop.getDesktop().isSupported(Desktop.Action.OPEN)) {
            throw HostError.unsupported("공유")
        }
        Desktop.getDesktop().open(file.parentFile)
    }

    override fun exit() = onExit()

    override fun updateStatus(): JsonObject = JsonObject(
        mapOf("supported" to JsonPrimitive(false), "currentVersion" to JsonPrimitive(VERSION))
    )

    companion object {
        const val VERSION = "0.1.0-dev"
    }
}
