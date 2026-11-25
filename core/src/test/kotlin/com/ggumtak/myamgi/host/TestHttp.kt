package com.ggumtak.myamgi.host

import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.Socket

/**
 * Minimal raw-socket HTTP/1.1 client for tests: lets us send any Host header and paths with
 * traversal segments, which java.net clients refuse or normalize.
 */
class TestHttp(private val port: Int) {
    data class Resp(val status: Int, val headers: Map<String, String>, val body: ByteArray) {
        val text: String get() = body.toString(Charsets.UTF_8)
        fun header(name: String): String? = headers[name.lowercase()]
    }

    var cookie: String? = null

    fun get(path: String, headers: Map<String, String> = emptyMap(), host: String? = null) =
        request("GET", path, headers, null, host)

    fun post(path: String, body: ByteArray, headers: Map<String, String> = emptyMap(), host: String? = null) =
        request("POST", path, headers, body, host)

    fun postJson(path: String, json: String) =
        post(path, json.toByteArray(), mapOf("Content-Type" to "application/json"))

    fun request(method: String, path: String, headers: Map<String, String>, body: ByteArray?, host: String? = null): Resp {
        Socket("127.0.0.1", port).use { s ->
            s.soTimeout = 60_000
            val out = s.getOutputStream()
            out.write(head(method, path, headers, body, host).toByteArray(Charsets.UTF_8))
            if (body != null) out.write(body)
            out.flush()
            return read(BufferedInputStream(s.getInputStream()))
        }
    }

    fun head(method: String, path: String, headers: Map<String, String>, body: ByteArray?, host: String? = null): String =
        buildString {
            append("$method $path HTTP/1.1\r\n")
            append("Host: ${host ?: "127.0.0.1:$port"}\r\n")
            append("Connection: close\r\n")
            cookie?.let { append("Cookie: $it\r\n") }
            headers.forEach { (k, v) -> append("$k: $v\r\n") }
            if (body != null) append("Content-Length: ${body.size}\r\n")
            append("\r\n")
        }

    companion object {
        fun readLine(input: InputStream): String? {
            val buf = ByteArrayOutputStream()
            while (true) {
                val b = input.read()
                if (b == -1) return if (buf.size() == 0) null else buf.toString(Charsets.UTF_8.name())
                if (b == '\n'.code) break
                if (b != '\r'.code) buf.write(b)
            }
            return buf.toString(Charsets.UTF_8.name())
        }

        fun readHead(input: InputStream): Pair<Int, Map<String, String>> {
            val status = readLine(input)!!.split(" ")[1].toInt()
            val headers = LinkedHashMap<String, String>()
            while (true) {
                val line = readLine(input) ?: break
                if (line.isEmpty()) break
                val i = line.indexOf(':')
                val k = line.substring(0, i).trim().lowercase()
                val v = line.substring(i + 1).trim()
                headers[k] = headers[k]?.let { "$it, $v" } ?: v
            }
            return status to headers
        }

        fun read(input: InputStream): Resp {
            val (status, headers) = readHead(input)
            val body = if (headers["transfer-encoding"]?.contains("chunked") == true) {
                val out = ByteArrayOutputStream()
                while (true) {
                    val size = readLine(input)!!.trim().toInt(16)
                    if (size == 0) break
                    out.write(input.readNBytes(size))
                    readLine(input)
                }
                out.toByteArray()
            } else {
                val len = headers["content-length"]?.toInt()
                if (len != null) input.readNBytes(len) else input.readBytes()
            }
            return Resp(status, headers, body)
        }
    }
}
