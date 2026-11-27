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
    fun hanjaTapScript(): String = ""

    fun updateStatus(): JsonObject = throw HostError.unsupported("업데이트")
    fun updateCheck(): JsonObject = throw HostError.unsupported("업데이트")
    fun updateApply(): JsonObject = throw HostError.unsupported("업데이트")

    /** Notifies shell when a long-running sync starts, updates phase, or finishes. */
    fun onSyncRunningChanged(running: Boolean, statusText: String? = null) = Unit
}
