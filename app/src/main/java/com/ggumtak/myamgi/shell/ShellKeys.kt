package com.ggumtak.myamgi.shell

/**
 * Hardware keys the WebView does not turn into DOM events by itself (volume and media keys from the device,
 * a Bluetooth remote or headset). While the owner's `volumeKeys` pref is on and the UI has said
 * `ui.state {captureKeys: true}` (the reviewer, until it closes), the shell swallows them and dispatches synthetic `keydown`/`keyup`
 * events with these `KeyboardEvent.key`/`code` values (the standard UI Events names) on the focused element
 * of the top document (bubbling to `document` and `window`). Otherwise volume keys change the volume as usual.
 *
 * Keyboard keys (Space, Enter, digits, letters, arrows, Page Up/Down that many page-turner remotes send) reach
 * the page as ordinary DOM events without help.
 *
 * Android key codes are listed as numbers so the table is testable without Android classes.
 */
object ShellKeys {
    data class DomKey(val key: String, val code: String, val legacyKeyCode: Int)

    const val KEYCODE_HEADSETHOOK = 79
    const val KEYCODE_VOLUME_UP = 24
    const val KEYCODE_VOLUME_DOWN = 25
    const val KEYCODE_MEDIA_PLAY_PAUSE = 85
    const val KEYCODE_MEDIA_STOP = 86
    const val KEYCODE_MEDIA_NEXT = 87
    const val KEYCODE_MEDIA_PREVIOUS = 88
    const val KEYCODE_MEDIA_REWIND = 89
    const val KEYCODE_MEDIA_FAST_FORWARD = 90
    const val KEYCODE_MEDIA_PLAY = 126
    const val KEYCODE_MEDIA_PAUSE = 127

    val TABLE: Map<Int, DomKey> = mapOf(
        KEYCODE_VOLUME_UP to DomKey("AudioVolumeUp", "AudioVolumeUp", 175),
        KEYCODE_VOLUME_DOWN to DomKey("AudioVolumeDown", "AudioVolumeDown", 174),
        KEYCODE_MEDIA_PLAY_PAUSE to DomKey("MediaPlayPause", "MediaPlayPause", 179),
        KEYCODE_HEADSETHOOK to DomKey("MediaPlayPause", "MediaPlayPause", 179),
        KEYCODE_MEDIA_PLAY to DomKey("MediaPlay", "MediaPlay", 0),
        KEYCODE_MEDIA_PAUSE to DomKey("MediaPause", "MediaPause", 0),
        KEYCODE_MEDIA_STOP to DomKey("MediaStop", "MediaStop", 178),
        KEYCODE_MEDIA_NEXT to DomKey("MediaTrackNext", "MediaTrackNext", 176),
        KEYCODE_MEDIA_PREVIOUS to DomKey("MediaTrackPrevious", "MediaTrackPrevious", 177),
        KEYCODE_MEDIA_FAST_FORWARD to DomKey("MediaFastForward", "MediaFastForward", 0),
        KEYCODE_MEDIA_REWIND to DomKey("MediaRewind", "MediaRewind", 0)
    )

    fun domKeyFor(keyCode: Int): DomKey? = TABLE[keyCode]

    /**
     * Whether the key should be captured right now: only while the page asked for keys (`captureKeys: true`, the
     * reviewer). A page that has said nothing (`null`: cold start, reload, the deck list) leaves volume and media
     * keys to the system, so the owner can change the volume outside the reviewer even with the pref on.
     */
    fun shouldCapture(keyCode: Int, prefEnabled: Boolean, uiCaptureKeys: Boolean?, pageAlive: Boolean): Boolean =
        TABLE.containsKey(keyCode) && prefEnabled && uiCaptureKeys == true && pageAlive

    /** JavaScript that dispatches the event; [type] is `keydown` or `keyup`. */
    fun script(dom: DomKey, type: String, repeat: Boolean): String {
        require(type == "keydown" || type == "keyup")
        return "(function(){var t=document.activeElement||document.body||document;" +
            "t.dispatchEvent(new KeyboardEvent('$type',{key:'${dom.key}',code:'${dom.code}'," +
            "keyCode:${dom.legacyKeyCode},which:${dom.legacyKeyCode},repeat:$repeat,bubbles:true,cancelable:true,composed:true}));})();"
    }
}
