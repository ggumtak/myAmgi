package com.ggumtak.myamgi.shell

import java.net.URI
import java.util.Locale

/**
 * Decides what the WebView does with a navigation (main frame or iframe). Pure, so it is unit-tested.
 *
 * - The app's own origin (`http://127.0.0.1:<port>` or `http://localhost:<port>`) loads, except
 *   `/api/host/download`, which a WebView cannot download by itself: the shell saves that file ([Action.DOWNLOAD]).
 * - `hanja:` and `intent:` URLs (Hanja tap script inside the card frame) go to the Hanja app ([Action.HANJA]),
 *   from any frame, without navigating the frame.
 * - Other `http(s)`, `mailto:` and `tel:` links open outside the app ([Action.EXTERNAL]); inside an iframe only
 *   when the user tapped (embedded media in a card, e.g. a video iframe, keeps loading in place).
 * - `about:blank`/`about:srcdoc`/`blob:`/`data:` may load in iframes (card frame, previews); everything else
 *   (`file:`, `content:`, `javascript:`, unknown schemes, `data:` in the main frame) is blocked.
 */
class NavigationPolicy(private val port: Int) {
    enum class Action { ALLOW, DOWNLOAD, HANJA, EXTERNAL, BLOCK }

    fun decide(url: String, isMainFrame: Boolean, hasGesture: Boolean = true): Action {
        val trimmed = url.trim()
        val scheme = trimmed.substringBefore(':', "").lowercase(Locale.ROOT)
        return when (scheme) {
            "hanja", "intent" -> Action.HANJA
            "http", "https" -> {
                if (isOwnOrigin(trimmed)) {
                    if (pathOf(trimmed) == DOWNLOAD_PATH) Action.DOWNLOAD else Action.ALLOW
                } else if (isMainFrame || hasGesture) {
                    Action.EXTERNAL
                } else {
                    Action.ALLOW
                }
            }
            "mailto", "tel" -> if (isMainFrame || hasGesture) Action.EXTERNAL else Action.BLOCK
            "about" -> if (!isMainFrame && (trimmed == "about:blank" || trimmed == "about:srcdoc")) Action.ALLOW else Action.BLOCK
            "blob", "data" -> if (isMainFrame) Action.BLOCK else Action.ALLOW
            else -> Action.BLOCK
        }
    }

    fun isOwnOrigin(url: String): Boolean {
        val uri = runCatching { URI(url) }.getOrNull() ?: return false
        if (uri.scheme?.lowercase(Locale.ROOT) != "http") return false
        if (uri.rawUserInfo != null) return false
        val host = uri.host?.lowercase(Locale.ROOT) ?: return false
        return (host == "127.0.0.1" || host == "localhost") && uri.port == port
    }

    private fun pathOf(url: String): String? = runCatching { URI(url).path }.getOrNull()

    companion object {
        const val DOWNLOAD_PATH = "/api/host/download"
    }
}
