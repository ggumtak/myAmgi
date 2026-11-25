package com.ggumtak.myamgi.host

/** An error reported to the UI as `{"error": message, "detail": detail}` with HTTP [status]. */
class HostError(
    val status: Int,
    override val message: String,
    val detail: String? = null,
    cause: Throwable? = null
) : RuntimeException(message, cause) {
    companion object {
        const val UNSUPPORTED = "이 기기에서는 지원하지 않습니다"

        fun unsupported(what: String? = null) =
            HostError(501, if (what == null) UNSUPPORTED else "$UNSUPPORTED ($what)", "unsupported")

        fun badRequest(message: String, detail: String? = null) = HostError(400, message, detail)
    }
}
