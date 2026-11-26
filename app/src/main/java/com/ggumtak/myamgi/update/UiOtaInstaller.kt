package com.ggumtak.myamgi.update

import java.io.File
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/**
 * Download → verify → unpack → validate → activate, for one [UiOtaManifest]. The network part is a function
 * so the pipeline is unit-tested with local streams.
 */
class UiOtaInstaller(
    private val store: UiOtaStore,
    private val open: (String) -> InputStream = ::httpGet
) {
    class VerifyException(message: String) : IOException(message)

    /** Installs the bundle; [progress] gets 0..100. Throws on any failure (nothing is activated then). */
    fun install(m: UiOtaManifest, progress: (Int) -> Unit = {}) {
        store.root.mkdirs()
        val zip = File(store.root, "download.zip.part")
        try {
            download(m, zip, progress)
            val staging = store.freshStaging()
            SafeZip.extract(zip, staging)
            store.activate(m.version)
        } finally {
            zip.delete()
        }
    }

    private fun download(m: UiOtaManifest, target: File, progress: (Int) -> Unit) {
        val digest = MessageDigest.getInstance("SHA-256")
        var done = 0L
        var shown = -1
        open(m.url).use { input ->
            target.outputStream().use { out ->
                val buf = ByteArray(64 * 1024)
                while (true) {
                    val n = input.read(buf)
                    if (n < 0) break
                    done += n
                    if (done > m.size) throw VerifyException("download larger than the manifest says (${m.size})")
                    digest.update(buf, 0, n)
                    out.write(buf, 0, n)
                    val p = (done * 100 / m.size).toInt()
                    if (p != shown) {
                        shown = p
                        progress(p)
                    }
                }
            }
        }
        if (done != m.size) throw VerifyException("size mismatch: got $done, expected ${m.size}")
        val hex = digest.digest().joinToString("") { "%02x".format(it) }
        if (hex != m.sha256) throw VerifyException("SHA-256 mismatch")
    }

    companion object {
        fun connect(url: String): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
            connectTimeout = 15_000
            readTimeout = 30_000
            instanceFollowRedirects = true
            setRequestProperty("User-Agent", "myAmgi-Android")
        }

        fun httpGet(url: String): InputStream {
            val c = connect(url)
            val code = c.responseCode
            if (code != 200) {
                c.disconnect()
                throw IOException("HTTP $code for $url")
            }
            return c.inputStream
        }

        /** Text of [url], or null on 404 (nothing published yet). */
        fun httpText(url: String): String? {
            val c = connect(url)
            try {
                val code = c.responseCode
                if (code == 404) return null
                if (code != 200) throw IOException("HTTP $code for $url")
                return c.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
            } finally {
                c.disconnect()
            }
        }
    }
}
