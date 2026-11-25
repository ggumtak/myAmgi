package com.ggumtak.myamgi.sync

import org.json.JSONObject
import java.util.Base64

data class SyncCodePayload(
    val url: String,
    val anonKey: String,
    val email: String,
    val refreshToken: String,
    val accessToken: String = ""
)

/**
 * Encodes and decodes 1-second device pairing codes (`MYAMGI1:<base64url(json)>`)
 * compatible across Android (Pro & Comet) and the Web PWA (`web/src/sync/syncCode.ts`).
 *
 * Pure JVM implementation without Android dependencies so unit tests execute directly.
 */
object SyncCode {
    const val PREFIX = "MYAMGI1:"

    fun encode(payload: SyncCodePayload): String {
        val json = JSONObject().apply {
            put("u", payload.url.trim().trimEnd('/'))
            put("k", payload.anonKey.trim())
            put("e", payload.email.trim())
            put("r", payload.refreshToken.trim())
            if (payload.accessToken.isNotBlank()) {
                put("t", payload.accessToken.trim())
            }
        }
        val encoded = Base64.getUrlEncoder()
            .withoutPadding()
            .encodeToString(json.toString().toByteArray(Charsets.UTF_8))
        return "$PREFIX$encoded"
    }

    fun decode(code: String): SyncCodePayload? {
        val trimmed = code.trim()
        if (!trimmed.startsWith(PREFIX)) return null
        val raw = trimmed.substring(PREFIX.length).trim()
        if (raw.isEmpty()) return null

        return runCatching {
            val decodedBytes = Base64.getUrlDecoder().decode(raw)
            val json = JSONObject(String(decodedBytes, Charsets.UTF_8))

            val url = json.optString("u", "").trim().trimEnd('/')
            val anonKey = json.optString("k", "").trim()
            val email = json.optString("e", "").trim()
            val refreshToken = json.optString("r", "").trim()
            val accessToken = json.optString("t", "").trim()

            if (!(url.startsWith("https://") || url.startsWith("http://"))) return null
            if (anonKey.isBlank() || refreshToken.isBlank()) return null

            SyncCodePayload(
                url = url,
                anonKey = anonKey,
                email = email,
                refreshToken = refreshToken,
                accessToken = accessToken
            )
        }.getOrNull()
    }
}
