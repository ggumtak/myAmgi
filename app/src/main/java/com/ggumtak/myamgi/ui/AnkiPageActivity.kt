package com.ggumtak.myamgi.ui

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.ggumtak.myamgi.engine.AnkiEngine
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.nio.charset.StandardCharsets
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

/**
 * Hosts the official Anki 26.09.4 SvelteKit pages (`/deck-options/<id>`, `/graphs`,
 * `/card-info/<id>`, `/image-occlusion/<id>`, `/preferences`, `/congrats`) over an
 * embedded loopback HTTP server dispatching `/_anki/<method>` directly to [AnkiEngine.rawCall].
 */
class AnkiPageActivity : AppCompatActivity() {

    companion object {
        private const val EXTRA_ROUTE = "extra_route"
        private const val EXTRA_TITLE = "extra_title"

        fun start(context: Context, route: String, title: String) {
            val intent = Intent(context, AnkiPageActivity::class.java).apply {
                putExtra(EXTRA_ROUTE, route)
                putExtra(EXTRA_TITLE, title)
            }
            context.startActivity(intent)
        }
    }

    private lateinit var webView: WebView
    private var serverSocket: ServerSocket? = null
    private var serverExecutor: ExecutorService? = null
    @Volatile
    private var running = false

    override fun onCreate(savedInstanceState: Bundle?) {
        UiThemeHelper.applyActivityTheme(this)
        super.onCreate(savedInstanceState)

        val route = intent.getStringExtra(EXTRA_ROUTE) ?: "/graphs"
        val title = intent.getStringExtra(EXTRA_TITLE) ?: "Anki"

        buildLayout(title)
        startServerAndLoad(route)
    }

    override fun onDestroy() {
        super.onDestroy()
        running = false
        runCatching { serverSocket?.close() }
        serverSocket = null
        serverExecutor?.shutdownNow()
        serverExecutor = null
        webView.destroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildLayout(title: String) {
        val p = UiThemeHelper.palette(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.background)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }

        val (topBar, _, _) = UiThemeHelper.createTopBar(this, title, showBack = true)
        root.addView(topBar)

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                    return false
                }
            }
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        root.addView(webView)
        setContentView(root)
    }

    private fun startServerAndLoad(route: String) {
        val executor = Executors.newCachedThreadPool()
        serverExecutor = executor
        executor.execute {
            try {
                AnkiEngine.ensureOpen()
                val ss = ServerSocket(0, 50, InetAddress.getByName("127.0.0.1"))
                serverSocket = ss
                running = true
                val port = ss.localPort
                val normalizedRoute = if (route.startsWith("/")) route else "/$route"
                val targetUrl = "http://127.0.0.1:$port$normalizedRoute"

                runOnUiThread {
                    if (!isFinishing && !isDestroyed) {
                        webView.loadUrl(targetUrl)
                    }
                }

                while (running && !ss.isClosed) {
                    val client = try {
                        ss.accept()
                    } catch (_: IOException) {
                        break
                    }
                    executor.execute { handleClient(client) }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    Toast.makeText(this, "Anki 페이지 서버 오류: ${e.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun handleClient(socket: Socket) {
        socket.use { s ->
            s.soTimeout = 15_000
            val inp = BufferedInputStream(s.getInputStream())
            val out = s.getOutputStream()

            val requestLine = readLineAscii(inp) ?: return
            val parts = requestLine.split(" ")
            if (parts.size < 2) return
            val method = parts[0].uppercase()
            val rawPath = parts[1].substringBefore("?")

            var contentLength = 0
            while (true) {
                val line = readLineAscii(inp) ?: break
                if (line.isEmpty()) break
                val colon = line.indexOf(':')
                if (colon > 0) {
                    val name = line.substring(0, colon).trim().lowercase()
                    if (name == "content-length") {
                        contentLength = line.substring(colon + 1).trim().toIntOrNull() ?: 0
                    }
                }
            }

            val bodyBytes = if (contentLength > 0) {
                readExactBytes(inp, contentLength)
            } else {
                ByteArray(0)
            }

            if (method == "OPTIONS") {
                writeHttpResponse(out, 204, "No Content", "text/plain", ByteArray(0))
                return
            }

            if (method == "POST" && rawPath.startsWith("/_anki/")) {
                val methodName = rawPath.removePrefix("/_anki/").trimStart('/')
                try {
                    val respBytes = AnkiEngine.rawCall(methodName, bodyBytes)
                    writeHttpResponse(out, 200, "OK", "application/octet-stream", respBytes)
                } catch (t: Throwable) {
                    val msg = (t.cause?.message ?: t.message ?: t.toString()).toByteArray(StandardCharsets.UTF_8)
                    writeHttpResponse(out, 500, "Internal Server Error", "text/plain; charset=utf-8", msg)
                }
                return
            }

            if (method == "GET") {
                val assetPath = resolveAssetPath(rawPath)
                if (assetPath != null) {
                    val assetBytes = readAssetBytes(assetPath)
                    if (assetBytes != null) {
                        writeHttpResponse(out, 200, "OK", guessAssetMime(assetPath), assetBytes)
                        return
                    }
                }
                // Fallback to SvelteKit SPA shell for unknown frontend routes
                val spaFallback = readAssetBytes("backend/sveltekit/index.html")
                if (spaFallback != null) {
                    writeHttpResponse(out, 200, "OK", "text/html; charset=utf-8", spaFallback)
                    return
                }
            }

            writeHttpResponse(out, 404, "Not Found", "text/plain; charset=utf-8", "Not Found".toByteArray(StandardCharsets.UTF_8))
        }
    }

    private fun resolveAssetPath(rawPath: String): String? {
        val clean = rawPath.replace("..", "")
        return when {
            clean.startsWith("/_app/") -> "backend/sveltekit/app/${clean.removePrefix("/_app/")}"
            clean.startsWith("/_anki/") -> "backend/${clean.removePrefix("/_anki/")}"
            clean == "/" ||
                clean.startsWith("/deck-options") ||
                clean.startsWith("/graphs") ||
                clean.startsWith("/card-info") ||
                clean.startsWith("/image-occlusion") ||
                clean.startsWith("/preferences") ||
                clean.startsWith("/congrats") -> "backend/sveltekit/index.html"
            else -> "backend/sveltekit/${clean.trimStart('/')}"
        }
    }

    private fun readAssetBytes(path: String): ByteArray? {
        return runCatching {
            assets.open(path).use { it.readBytes() }
        }.getOrNull()
    }

    private fun guessAssetMime(path: String): String {
        val lower = path.lowercase()
        return when {
            lower.endsWith(".html") || lower.endsWith(".htm") -> "text/html; charset=utf-8"
            lower.endsWith(".js") || lower.endsWith(".mjs") -> "application/javascript; charset=utf-8"
            lower.endsWith(".css") -> "text/css; charset=utf-8"
            lower.endsWith(".json") -> "application/json; charset=utf-8"
            lower.endsWith(".svg") -> "image/svg+xml"
            lower.endsWith(".png") -> "image/png"
            lower.endsWith(".woff2") -> "font/woff2"
            lower.endsWith(".woff") -> "font/woff"
            lower.endsWith(".ttf") -> "font/ttf"
            else -> "application/octet-stream"
        }
    }

    private fun readLineAscii(inp: InputStream): String? {
        val buf = ByteArrayOutputStream()
        var b = inp.read()
        if (b == -1) return null
        while (b != -1) {
            if (b == '\n'.code) break
            if (b != '\r'.code) buf.write(b)
            b = inp.read()
        }
        return buf.toString(StandardCharsets.US_ASCII.name())
    }

    private fun readExactBytes(inp: InputStream, count: Int): ByteArray {
        val out = ByteArray(count)
        var offset = 0
        while (offset < count) {
            val read = inp.read(out, offset, count - offset)
            if (read <= 0) break
            offset += read
        }
        return if (offset == count) out else out.copyOf(offset)
    }

    private fun writeHttpResponse(
        out: java.io.OutputStream,
        status: Int,
        reason: String,
        contentType: String,
        body: ByteArray
    ) {
        val header = buildString {
            append("HTTP/1.1 ").append(status).append(' ').append(reason).append("\r\n")
            append("Content-Type: ").append(contentType).append("\r\n")
            append("Content-Length: ").append(body.size).append("\r\n")
            append("Access-Control-Allow-Origin: *\r\n")
            append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n")
            append("Access-Control-Allow-Headers: *\r\n")
            append("Connection: close\r\n\r\n")
        }
        out.write(header.toByteArray(StandardCharsets.US_ASCII))
        if (body.isNotEmpty()) {
            out.write(body)
        }
        out.flush()
    }
}
