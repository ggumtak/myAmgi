package com.ggumtak.myamgi.host

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.io.InputStream

/**
 * The myAmgi UI bundle: an OTA directory (used only when its `ui-version.json` is valid, newer than the
 * built-in bundle's, and it has `index.html`) layered over the built-in bundle.
 *
 * `ui-version.json` = `{"version": "<dotted numbers>" | <number>}` at the bundle root.
 */
class UiBundle(private val builtIn: AssetSource, private val otaDir: File?) {
    private val otaSource = otaDir?.let { DirAssetSource(it) }

    @Volatile
    private var otaCache: Pair<Long, Boolean>? = null

    val builtInVersion: String? by lazy { builtIn.open(VERSION_FILE)?.use { parseVersion(it) } }

    /** True when the OTA directory should be used. Re-evaluated when its version file changes. */
    fun otaActive(): Boolean {
        val dir = otaDir ?: return false
        val vf = File(dir, VERSION_FILE)
        val stamp = if (vf.isFile) vf.lastModified() xor vf.length() else -1L
        otaCache?.let { (s, v) -> if (s == stamp) return v }
        val active = vf.isFile && File(dir, "index.html").isFile && run {
            val ota = runCatching { vf.inputStream().use { parseVersion(it) } }.getOrNull()
            ota != null && (builtInVersion == null || compareVersions(ota, builtInVersion!!) > 0)
        }
        otaCache = stamp to active
        return active
    }

    fun version(): String? =
        if (otaActive()) runCatching { File(otaDir, VERSION_FILE).inputStream().use { parseVersion(it) } }.getOrNull()
        else builtInVersion

    fun hasIndex(): Boolean = (otaActive()) || builtIn.open("index.html")?.also { it.close() } != null

    fun open(path: String): InputStream? {
        if (otaActive()) otaSource?.open(path)?.let { return it }
        return builtIn.open(path)
    }

    companion object {
        const val VERSION_FILE = "ui-version.json"

        fun parseVersion(input: InputStream): String? {
            val obj = Json.parseToJsonElement(input.readBytes().toString(Charsets.UTF_8)).jsonObject
            val v = (obj["version"] as? JsonPrimitive)?.contentOrNull?.trim()
            return v?.takeIf { it.isNotEmpty() && it.any(Char::isDigit) }
        }

        /** Compares dotted numeric versions ("1.2.10" > "1.2.9"); non-digits separate parts. */
        fun compareVersions(a: String, b: String): Int {
            val pa = a.split(Regex("\\D+")).filter { it.isNotEmpty() }.map { it.toBigInteger() }
            val pb = b.split(Regex("\\D+")).filter { it.isNotEmpty() }.map { it.toBigInteger() }
            for (i in 0 until maxOf(pa.size, pb.size)) {
                val c = (pa.getOrNull(i) ?: java.math.BigInteger.ZERO).compareTo(pb.getOrNull(i) ?: java.math.BigInteger.ZERO)
                if (c != 0) return c
            }
            return 0
        }

        /** Shown when no UI bundle is installed (development host without `--ui-dir`). */
        val PLACEHOLDER_HTML = """
            <!doctype html>
            <html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
            <title>myAmgi</title>
            <style>body{font-family:system-ui,"Noto Sans KR",sans-serif;max-width:640px;margin:40px auto;padding:0 16px;line-height:1.6}
            a{display:block;margin:6px 0}</style></head>
            <body><h1>myAmgi 호스트</h1>
            <p>UI 번들이 설치되어 있지 않습니다. 개발 중이라면 <code>--ui-dir web/dist</code> 로 실행하세요.</p>
            <p>엔진이 제공하는 Anki 공식 화면:</p>
            <a href="/deck-options/1">덱 옵션</a><a href="/graphs">통계</a><a href="/congrats">축하 화면</a>
            </body></html>
        """.trimIndent()
    }
}
