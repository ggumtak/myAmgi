package com.ggumtak.myamgi.host

import kotlinx.serialization.json.JsonObject
import java.io.File

/** Device/app facts reported by `info`. */
data class PlatformInfo(
    val platform: String,
    val appVersion: String,
    val build: Int,
    val flavor: String,
    val eink: Boolean,
    val device: String
)

/**
 * What the UI tells the shell about itself through `ui.state` (every field optional; null = unchanged).
 *
 * @param theme the theme in effect: `light`, `dark` or `eink` (the shell picks light/dark system bar icons)
 * @param background the page background as `#RRGGBB` (the shell paints the system bar areas with it)
 * @param keepScreenOn keep the display on (the reviewer asks while studying; default off)
 * @param captureKeys whether volume/media keys should go to the UI as `keydown` events while the owner's
 *   `volumeKeys` pref is on (the reviewer sets true on entry and false on exit; null = never said)
 */
data class UiShellState(
    val theme: String? = null,
    val background: String? = null,
    val keepScreenOn: Boolean? = null,
    val captureKeys: Boolean? = null
)

/**
 * Things only the shell can do. Every function has a default that fails with
 * [HostError.unsupported] ("이 기기에서는 지원하지 않습니다"), so a platform only overrides what it supports
 * and the UI always gets a clear Korean error instead of a crash.
 */
interface Platform {
    fun info(): PlatformInfo

    fun share(file: File, name: String): Unit = throw HostError.unsupported("공유")
    fun openExternal(url: String): Unit = throw HostError.unsupported("외부 링크 열기")
    fun tts(text: String, lang: String?, rate: Double?): Unit = throw HostError.unsupported("음성 읽기")
    fun ttsStop(): Unit = throw HostError.unsupported("음성 읽기")
    fun clipboardWrite(text: String): Unit = throw HostError.unsupported("클립보드 복사")

    /** Called after the HTTP response has been sent. */
    fun exit(): Unit = throw HostError.unsupported("앱 종료")
    fun hanjaLookup(text: String, sentence: String?): Unit = throw HostError.unsupported("한자 사전")

    fun updateStatus(): JsonObject = throw HostError.unsupported("업데이트")
    fun updateCheck(): JsonObject = throw HostError.unsupported("업데이트")
    fun updateApply(): JsonObject = throw HostError.unsupported("업데이트")

    /** `update.apply {kind}`: `"apk"`, `"ui"` (reload into a downloaded UI bundle) or null (whatever is pending). */
    fun updateApply(kind: String?): JsonObject = updateApply()

    /**
     * `ui.ready {uiVersion, features}`: the UI finished its first render. The shell uses it to confirm a newly
     * activated OTA UI bundle (and rolls back when it never arrives) and to deliver queued `open-file` events.
     * `features` lists optional protocols the UI speaks (e.g. `"back-ack"`). No-op by default.
     */
    fun uiReady(uiVersion: String?, features: List<String>) = Unit

    /** `ui.state {...}`: see [UiShellState]. No-op by default. */
    fun uiState(state: UiShellState) = Unit

    /** `ui.backHandled {id}`: the UI consumed the `back` event with this id. No-op by default. */
    fun backHandled(id: Long) = Unit

    /**
     * `hanja.script` → `{"version": <int or null>, "js": "<tap script>"}`: the Hanja app's card tap script
     * (with the runner that executes its highest `__hjCode[n]`), for the reviewer to inject into the card frame.
     */
    fun hanjaScript(): JsonObject = throw HostError.unsupported("한자 사전")
}
