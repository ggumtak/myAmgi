package com.ggumtak.myamgi.host

import anki.generic.Json as PbJson
import com.ggumtak.myamgi.engine.AnkiEngine
import com.google.protobuf.ByteString
import fi.iki.elonen.NanoHTTPD
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import java.io.ByteArrayInputStream
import java.io.File
import java.io.FileInputStream
import java.io.InputStream
import java.security.MessageDigest
import java.security.SecureRandom
import java.text.SimpleDateFormat
import java.util.Base64
import java.util.Date
import java.util.Locale
import java.util.TimeZone
import java.util.UUID

/**
 * The loopback host every UI talks to (see docs/ARCHITECTURE.md, "Host server contract").
 *
 * @param uiBuiltIn the built-in myAmgi UI bundle
 * @param uiOtaDir the OTA UI bundle directory (used when valid and newer)
 * @param ankiAssets the official `backend/` tree (sveltekit, js, css) from the backend artifact
 * @param dataDir host data: prefs, backups, temp files, sync state. The collection directory is
 *   whatever [AnkiEngine] is configured with (pass [collectionDir] to set it).
 * @param port 0 = random free port
 */
class HostServer(
    uiBuiltIn: AssetSource,
    uiOtaDir: File?,
    private val ankiAssets: AssetSource,
    val dataDir: File,
    val platform: Platform,
    port: Int = 0,
    val token: String = newToken(),
    collectionDir: File? = null,
    val log: HostLog = HostLog(),
    syncTransport: SyncTransport = EngineSyncTransport()
) {
    val events = EventBus()
    val ui = UiBundle(uiBuiltIn, uiOtaDir)
    val api: HostApi

    private val http = Http(port)

    init {
        dataDir.mkdirs()
        if (collectionDir != null) AnkiEngine.setCollectionDir(collectionDir)
        api = HostApi(dataDir, platform, ui, events, log, syncTransport)
        runCatching { api.cleanTemp() }
    }

    val port: Int get() = http.listeningPort

    /** The URL the shell opens; it sets the auth cookie and redirects to `/ui/`. */
    val startUrl: String get() = "http://127.0.0.1:$port/?t=$token"

    fun start(): HostServer {
        http.start(NanoHTTPD.SOCKET_READ_TIMEOUT, true)
        log.info("host listening on 127.0.0.1:$port")
        return this
    }

    fun stop() {
        events.closeAll()
        http.stop()
    }

    /** Publishes a shell event (`back`, `open-file`, ...) to the UI. */
    fun publish(event: String, data: JsonElement) = events.publish(event, data)

    private inner class Http(port: Int) : NanoHTTPD("127.0.0.1", port) {
        override fun useGzipWhenAccepted(r: Response): Boolean = false

        override fun serve(session: IHTTPSession): Response {
            val req = Req(session)
            val response = try {
                route(req)
            } catch (e: HostError) {
                jsonError(e)
            } catch (t: Throwable) {
                log.error("request failed: ${session.method} ${session.uri}", t)
                text(500, "Internal Server Error")
            }
            req.finish(response)
            return response
        }
    }

    /** Wraps a session; tracks whether the request body was consumed so keep-alive stays in sync. */
    private class Req(val s: NanoHTTPD.IHTTPSession) {
        val uri: String = s.uri ?: "/"
        val method: NanoHTTPD.Method? = s.method
        val headers: Map<String, String> = s.headers
        private val contentLength: Long = headers["content-length"]?.trim()?.toLongOrNull() ?: 0L
        private var consumed = contentLength <= 0L

        fun param(name: String): String? = s.parameters[name]?.firstOrNull()

        fun body(max: Long = 64L * 1024 * 1024): ByteArray {
            if (contentLength > max) throw HostError(413, "요청이 너무 큽니다.", "too-large")
            val bytes = ByteArray(contentLength.toInt())
            java.io.DataInputStream(s.inputStream).readFully(bytes)
            consumed = true
            return bytes
        }

        fun copyBodyTo(target: File) {
            var remaining = contentLength
            val input = s.inputStream
            target.outputStream().use { out ->
                val buf = ByteArray(64 * 1024)
                while (remaining > 0) {
                    val n = input.read(buf, 0, minOf(buf.size.toLong(), remaining).toInt())
                    if (n <= 0) throw java.io.EOFException("upload truncated")
                    out.write(buf, 0, n)
                    remaining -= n
                }
            }
            consumed = true
        }

        fun finish(r: NanoHTTPD.Response) {
            if (consumed) return
            // Drain a small unread body so the next keep-alive request parses; otherwise close.
            if (contentLength <= 1024 * 1024) {
                runCatching {
                    var left = contentLength
                    while (left > 0) {
                        val skipped = s.inputStream.skip(left)
                        if (skipped <= 0) break
                        left -= skipped
                    }
                    if (left > 0) r.closeConnection(true)
                }.onFailure { r.closeConnection(true) }
            } else {
                r.closeConnection(true)
            }
        }
    }

    // --- Routing ---

    private fun route(req: Req): NanoHTTPD.Response {
        if (!hostAllowed(req.headers["host"])) return text(403, "Forbidden")
        val uri = req.uri
        if (uri == "/" && req.param("t") != null) return handshake(req)
        if (!authorized(req)) return text(403, "Forbidden")
        val get = req.method == NanoHTTPD.Method.GET || req.method == NanoHTTPD.Method.HEAD
        val post = req.method == NanoHTTPD.Method.POST

        return when {
            uri == "/" || uri == "/ui" -> redirect("/ui/")
            uri.startsWith("/ui/") && get -> serveUi(uri.removePrefix("/ui/"))
            uri == "/media/$FRAME_NAME" && get -> serveUi(CARD_FRAME)
            uri.startsWith("/media/") && get -> serveMedia(req, uri.removePrefix("/media/"))
            uri.startsWith("/_anki/") && post -> ankiRpc(req, uri.removePrefix("/_anki/"))
            uri.startsWith("/_anki/") && get -> serveAsset(ankiAssets, uri.removePrefix("/_anki/"))
            uri.startsWith("/_app/") && get -> serveAsset(ankiAssets, "sveltekit/app/" + uri.removePrefix("/_app/"))
            uri == "/api/host/events" && get -> sse()
            uri == "/api/host/hanja-tap.js" && get -> serveHanjaTapScript()
            uri == "/api/host/upload" && post -> upload(req)
            uri == "/api/host/download" && get -> download(req)
            uri.startsWith("/api/host/") && post -> hostFunction(req, uri.removePrefix("/api/host/"))
            get && isSvelteRoute(uri) -> serveSvelteIndex(req)
            get -> serveAsset(ankiAssets, "sveltekit/" + uri.trimStart('/'))
            else -> text(405, "Method Not Allowed")
        }
    }

    private fun hostAllowed(host: String?): Boolean {
        if (host == null) return false
        val p = port
        return host == "127.0.0.1:$p" || host == "localhost:$p"
    }

    private fun tokenMatches(candidate: String?): Boolean =
        candidate != null && MessageDigest.isEqual(candidate.toByteArray(), token.toByteArray())

    private fun authorized(req: Req): Boolean {
        if (tokenMatches(req.headers["x-amgi-token"])) return true
        val cookie = req.headers["cookie"] ?: return false
        return cookie.split(';').any { part ->
            val kv = part.trim()
            kv.startsWith("$COOKIE=") && tokenMatches(kv.substringAfter('='))
        }
    }

    private fun handshake(req: Req): NanoHTTPD.Response {
        if (!tokenMatches(req.param("t"))) return text(403, "Forbidden")
        return redirect("/ui/").apply {
            addHeader("Set-Cookie", "$COOKIE=$token; Path=/; HttpOnly; SameSite=Strict")
        }
    }

    private fun isSvelteRoute(uri: String): Boolean =
        SVELTE_ROUTES.any { uri == it || uri.startsWith("$it/") }

    // --- Static files ---

    private fun serveUi(rawPath: String): NanoHTTPD.Response {
        val path = safeRelativePath(rawPath) ?: return text(403, "Forbidden")
        val effective = if (path.isEmpty() || path.endsWith("/")) path + "index.html" else path
        val stream = ui.open(effective)
        if (stream == null) {
            if (effective == "index.html") {
                return noCache(NanoHTTPD.newFixedLengthResponse(status(200), Mime.of("x.html"), UiBundle.PLACEHOLDER_HTML))
            }
            return text(404, "Not Found")
        }
        return noCache(streamResponse(stream, Mime.of(effective)))
    }

    private fun serveAsset(source: AssetSource, rawPath: String): NanoHTTPD.Response {
        val path = safeRelativePath(rawPath)?.takeIf { it.isNotEmpty() && !it.endsWith("/") }
            ?: return text(404, "Not Found")
        val stream = source.open(path) ?: return text(404, "Not Found")
        val r = streamResponse(stream, Mime.of(path))
        // Content-hashed SvelteKit chunks never change; everything else is revalidated.
        if (path.startsWith("sveltekit/app/immutable/")) r.addHeader("Cache-Control", "max-age=31536000, immutable")
        else noCache(r)
        return r
    }

    private fun serveHanjaTapScript(): NanoHTTPD.Response {
        val bytes = platform.hanjaTapScript().toByteArray(Charsets.UTF_8)
        return noCache(
            NanoHTTPD.newFixedLengthResponse(
                status(200),
                "application/javascript; charset=utf-8",
                ByteArrayInputStream(bytes),
                bytes.size.toLong()
            )
        )
    }

    private fun serveSvelteIndex(req: Req): NanoHTTPD.Response {
        val stream = ankiAssets.open("sveltekit/index.html") ?: return text(404, "Not Found")
        val rawHtml = stream.use { it.readBytes().toString(Charsets.UTF_8) }
        val queryTheme = req.param("theme")?.trim()?.lowercase(Locale.ROOT)?.takeIf { it in VALID_THEMES }
        val prefTheme = api.prefs.all().str("theme")?.trim()?.lowercase(Locale.ROOT)?.takeIf { it in VALID_THEMES }
        val defaultTheme = if (platform.info().eink) "eink" else "auto"
        val fallbackTheme = queryTheme ?: prefTheme ?: defaultTheme
        val injected = injectSvelteHead(rawHtml, fallbackTheme).toByteArray(Charsets.UTF_8)
        return noCache(
            NanoHTTPD.newFixedLengthResponse(
                status(200),
                "text/html; charset=utf-8",
                ByteArrayInputStream(injected),
                injected.size.toLong()
            )
        )
    }

    private fun streamResponse(stream: InputStream, mime: String): NanoHTTPD.Response {
        // Asset streams (AssetManager, classpath) do not know their length; small files are buffered.
        val bytes = stream.use { it.readBytes() }
        return NanoHTTPD.newFixedLengthResponse(status(200), mime, ByteArrayInputStream(bytes), bytes.size.toLong())
    }

    // --- Media ---

    private fun serveMedia(req: Req, rawName: String): NanoHTTPD.Response {
        // NanoHTTPD has already percent-decoded the path once.
        if (rawName.isEmpty() || rawName.contains('/') || rawName.contains('\\') || rawName == "." || rawName == ".." ||
            rawName.contains('\u0000')
        ) {
            return text(403, "Forbidden")
        }
        val mediaDir = AnkiEngine.getMediaDir().canonicalFile
        var file = File(mediaDir, rawName)
        // NanoHTTPD decodes '+' as a space; card HTML often references "a+b.mp3" literally.
        if (!file.isFile && rawName.contains(' ')) {
            plusVariants(rawName).map { File(mediaDir, it) }.firstOrNull { it.isFile }?.let { file = it }
        }
        val canonical = file.canonicalFile
        if (canonical.parentFile != mediaDir) return text(403, "Forbidden")
        if (!canonical.isFile) return text(404, "Not Found")
        return fileResponse(req, canonical, Mime.of(canonical.name))
    }

    private fun fileResponse(req: Req, file: File, mime: String, extra: Map<String, String> = emptyMap()): NanoHTTPD.Response {
        val length = file.length()
        val lastModified = httpDate(file.lastModified())
        val range = req.headers["range"]
        val r: NanoHTTPD.Response = if (range != null && range.startsWith("bytes=")) {
            val spec = parseRange(range.removePrefix("bytes=").trim(), length)
            if (spec == null) {
                NanoHTTPD.newFixedLengthResponse(status(416), "text/plain", "").apply {
                    addHeader("Content-Range", "bytes */$length")
                }
            } else {
                val (start, end) = spec
                val input = FileInputStream(file)
                input.skipFully(start)
                NanoHTTPD.newFixedLengthResponse(status(206), mime, input, end - start + 1).apply {
                    addHeader("Content-Range", "bytes $start-$end/$length")
                }
            }
        } else {
            val since = req.headers["if-modified-since"]
            if (since != null && since == lastModified) {
                NanoHTTPD.newFixedLengthResponse(status(304), mime, "")
            } else {
                NanoHTTPD.newFixedLengthResponse(status(200), mime, FileInputStream(file), length)
            }
        }
        r.addHeader("Accept-Ranges", "bytes")
        r.addHeader("Cache-Control", "no-cache")
        r.addHeader("Last-Modified", lastModified)
        extra.forEach { (k, v) -> r.addHeader(k, v) }
        return r
    }

    /** Every way of turning some spaces back into '+' (bounded), all-'+' first. */
    private fun plusVariants(name: String): Sequence<String> {
        val spaces = name.indices.filter { name[it] == ' ' }
        if (spaces.size > 8) return sequenceOf(name.replace(' ', '+'))
        val n = spaces.size
        return (1 until (1 shl n)).reversed().asSequence().map { mask ->
            val chars = name.toCharArray()
            for (bit in 0 until n) if (mask and (1 shl bit) != 0) chars[spaces[bit]] = '+'
            String(chars)
        }
    }

    private fun InputStream.skipFully(n: Long) {
        var left = n
        while (left > 0) {
            val s = skip(left)
            if (s <= 0) throw java.io.EOFException()
            left -= s
        }
    }

    // --- Official pages RPC ---

    private fun ankiRpc(req: Req, method: String): NanoHTTPD.Response {
        val body = req.body()
        if (method in FRONTEND_METHODS) {
            val bytes = frontendCall(method, body)
            return NanoHTTPD.newFixedLengthResponse(status(200), PROTO_MIME, ByteArrayInputStream(bytes), bytes.size.toLong())
        }
        return try {
            val out = AnkiEngine.rawCall(method, body)
            if (method == "updateDeckConfigs") {
                // Like Anki desktop: the deck options page closes once the save went through.
                events.publish("anki-page", jsonOf("method" to method, "close" to true))
            }
            NanoHTTPD.newFixedLengthResponse(status(200), PROTO_MIME, ByteArrayInputStream(out), out.size.toLong())
        } catch (e: NoSuchMethodException) {
            text(404, "Unknown method: $method")
        } catch (t: Throwable) {
            log.error("/_anki/$method failed: ${t.message}")
            text(500, t.message ?: t.toString())
        }
    }

    /** FrontendService methods (implemented by Anki desktop's mediasrv, not by the backend). */
    private fun frontendCall(method: String, body: ByteArray): ByteArray {
        events.publish("anki-page", jsonOf("method" to method, "close" to (method in CLOSE_METHODS)))
        return when (method) {
            // Json message; an empty payload would make the page's JSON.parse() throw
            "getProfileConfigJson", "getMetaJson" ->
                PbJson.newBuilder().setJson(ByteString.copyFromUtf8("null")).build().toByteArray()
            "openLink" -> {
                runCatching {
                    val url = anki.generic.String.parseFrom(body).`val`
                    if (url.startsWith("https://") || url.startsWith("http://")) platform.openExternal(url)
                }
                ByteArray(0)
            }
            else -> ByteArray(0)
        }
    }

    // --- Host API ---

    private fun hostFunction(req: Req, name: String): NanoHTTPD.Response {
        val bodyBytes = req.body(4L * 1024 * 1024)
        val args: JsonObject = if (bodyBytes.isEmpty()) JsonObject(emptyMap()) else try {
            Json.parseToJsonElement(bodyBytes.toString(Charsets.UTF_8)).jsonObject
        } catch (e: Exception) {
            throw HostError.badRequest("잘못된 요청입니다 (JSON).", e.message)
        }
        if (name == "platform.exit") {
            Thread {
                Thread.sleep(200)
                runCatching { platform.exit() }.onFailure { log.error("exit failed", it) }
            }.apply { isDaemon = true }.start()
            return json(200, jsonOf("ok" to true))
        }
        return try {
            json(200, api.call(name, args))
        } catch (e: HostError) {
            if (e.status >= 500 && e.status != 501) log.error("host $name: ${e.message}", e.cause ?: e) else log.warn("host $name: ${e.message}")
            jsonError(e)
        } catch (t: Throwable) {
            log.error("host $name failed", t)
            json(500, jsonOf("error" to (t.message ?: "오류가 발생했습니다."), "detail" to HostLog.stackOf(t)))
        }
    }

    private fun sse(): NanoHTTPD.Response {
        val stream = events.subscribe(listOf("sync-state" to api.sync.status()))
        return NanoHTTPD.newChunkedResponse(status(200), "text/event-stream; charset=utf-8", stream).apply {
            addHeader("Cache-Control", "no-cache")
            addHeader("X-Accel-Buffering", "no")
        }
    }

    private fun upload(req: Req): NanoHTTPD.Response {
        val name = HostApi.safeFileName(File(req.param("name") ?: "upload.bin").name)
        api.uploadDir.mkdirs()
        // ASCII on-disk name (see HostApi.newExportFile); the original name is returned and passed back by the UI.
        val ext = name.substringAfterLast('.', "").lowercase().filter { it in 'a'..'z' || it in '0'..'9' }.take(10)
        val target = File(api.uploadDir, "upload-${UUID.randomUUID().toString().take(12)}" + if (ext.isEmpty()) "" else ".$ext")
        try {
            req.copyBodyTo(target)
        } catch (e: Exception) {
            target.delete()
            throw HostError(400, "파일을 받지 못했습니다.", e.message, e)
        }
        log.info("upload received: ${target.name} ${target.length()} bytes")
        return json(200, jsonOf("path" to target.absolutePath, "name" to name, "size" to target.length()))
    }

    private fun download(req: Req): NanoHTTPD.Response {
        val path = req.param("path") ?: throw HostError.badRequest("필수 값이 없습니다: path")
        val root = api.exportDir.canonicalFile
        val file = File(path).canonicalFile
        if (file.parentFile != root || !file.isFile) return jsonError(HostError(403, "이 파일은 내려받을 수 없습니다.", "path-not-allowed"))
        val name = HostApi.safeFileName(req.param("name") ?: file.name)
        val encoded = java.net.URLEncoder.encode(name, "UTF-8").replace("+", "%20")
        val ascii = name.replace(Regex("[^A-Za-z0-9._ ()-]"), "_")
        return fileResponse(
            req, file, Mime.of(file.name),
            mapOf("Content-Disposition" to "attachment; filename=\"$ascii\"; filename*=UTF-8''$encoded")
        )
    }

    // --- Response helpers ---

    private fun json(code: Int, body: JsonElement): NanoHTTPD.Response =
        noCache(NanoHTTPD.newFixedLengthResponse(status(code), "application/json; charset=utf-8", body.toString()))

    private fun jsonError(e: HostError): NanoHTTPD.Response =
        json(e.status, jsonOf("error" to e.message, "detail" to e.detail))

    private fun text(code: Int, msg: String): NanoHTTPD.Response =
        NanoHTTPD.newFixedLengthResponse(status(code), "text/plain; charset=utf-8", msg)

    private fun redirect(location: String): NanoHTTPD.Response =
        NanoHTTPD.newFixedLengthResponse(status(302), "text/plain", "").apply { addHeader("Location", location) }

    private fun noCache(r: NanoHTTPD.Response): NanoHTTPD.Response = r.apply { addHeader("Cache-Control", "no-cache") }

    companion object {
        const val COOKIE = "amgi_t"
        const val FRAME_NAME = "__amgi_frame.html"
        const val CARD_FRAME = "card-frame.html"
        private const val PROTO_MIME = "application/binary"

        /** SvelteKit routes shipped in the backend artifact; all served by its index.html. */
        val SVELTE_ROUTES = listOf(
            "/card-info", "/change-notetype", "/congrats", "/deck-options", "/editor", "/graphs",
            "/image-occlusion", "/import-anki-package", "/import-csv", "/import-page"
        )

        private val VALID_THEMES = setOf("light", "dark", "eink", "auto")

        internal fun injectSvelteHead(rawHtml: String, fallbackTheme: String): String {
            val safeFallback = if (fallbackTheme in VALID_THEMES) fallbackTheme else "auto"
            val styleTag = """
                <style id="myamgi-anki-polish">
                html, body, button, input, select, textarea, label, p, span, div, td, th {
                  word-break: keep-all;
                  overflow-wrap: break-word;
                  font-family: -apple-system, BlinkMacSystemFont, "Pretendard", "Noto Sans CJK KR", "Noto Sans KR", system-ui, sans-serif;
                }
                html.night-mode, html.night-mode body {
                  background: #0B0E14 !important;
                }
                @supports not selector(::-webkit-scrollbar) {
                  * {
                    scrollbar-width: thin;
                    scrollbar-color: rgba(128, 128, 128, 0.32) transparent;
                  }
                }
                ::-webkit-scrollbar {
                  width: 4px;
                  height: 4px;
                }
                ::-webkit-scrollbar-track {
                  background: transparent;
                }
                ::-webkit-scrollbar-thumb {
                  background: rgba(128, 128, 128, 0.32);
                  border-radius: 999px;
                }
                ::-webkit-scrollbar-thumb:hover {
                  background: rgba(128, 128, 128, 0.52);
                }
                @media (pointer: coarse), (hover: none) {
                  * {
                    scrollbar-width: none;
                  }
                  ::-webkit-scrollbar {
                    width: 0;
                    height: 0;
                    display: none;
                  }
                }
                html.eink-mode, html.eink-mode body {
                  background: #FFFFFF !important;
                  color: #000000 !important;
                  --canvas: #FFFFFF;
                  --canvas-elevated: #FFFFFF;
                  --canvas-inset: #FFFFFF;
                  --canvas-overlay: #FFFFFF;
                  --fg: #000000;
                  --fg-subtle: #000000;
                  --border: #000000;
                  --border-subtle: #000000;
                  --border-strong: #000000;
                }
                html.eink-mode *, html.eink-mode *::before, html.eink-mode *::after {
                  transition: none !important;
                  animation: none !important;
                  box-shadow: none !important;
                  backdrop-filter: none !important;
                  -webkit-backdrop-filter: none !important;
                }
                html.eink-mode .card, html.eink-mode .bg-body-tertiary, html.eink-mode .list-group-item {
                  background: #FFFFFF !important;
                  color: #000000 !important;
                  border: 1.5px solid #000000 !important;
                }
                </style>
            """.trimIndent()

            val scriptBody = """
                (function(){
                  var q = new URLSearchParams(location.search).get('theme');
                  var pref = (q && /^(light|dark|eink|auto)$/.test(q)) ? q : '$safeFallback';
                  var theme = pref === 'auto'
                    ? ((window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light')
                    : pref;
                  var root = document.documentElement;
                  function applyBody() {
                    if (!document.body) return;
                    document.body.classList.toggle('night-mode', theme === 'dark');
                    document.body.classList.toggle('eink-mode', theme === 'eink');
                  }
                  if (theme === 'dark') {
                    root.classList.add('night-mode');
                    root.setAttribute('data-bs-theme', 'dark');
                  } else if (theme === 'eink') {
                    root.classList.add('eink-mode');
                    root.setAttribute('data-bs-theme', 'light');
                  } else {
                    root.classList.remove('night-mode', 'eink-mode');
                    root.setAttribute('data-bs-theme', 'light');
                  }
                  if (document.body) applyBody();
                  else document.addEventListener('DOMContentLoaded', applyBody, { once: true });
                })();
            """.trimIndent()

            val scriptHash = Base64.getEncoder().encodeToString(
                MessageDigest.getInstance("SHA-256").digest(scriptBody.toByteArray(Charsets.UTF_8))
            )
            val injection = "$styleTag\n<script>$scriptBody</script>\n"

            // Allow our injected bootstrap script in SvelteKit's inline-script CSP if present.
            val withCsp = if (rawHtml.contains("script-src ")) {
                rawHtml.replaceFirst("script-src ", "script-src 'sha256-$scriptHash' ")
            } else {
                rawHtml
            }

            val headClose = Regex("</head>", RegexOption.IGNORE_CASE).find(withCsp)
            if (headClose != null) {
                return withCsp.substring(0, headClose.range.first) + injection + withCsp.substring(headClose.range.first)
            }
            val bodyOpen = Regex("<body\\b", RegexOption.IGNORE_CASE).find(withCsp)
            if (bodyOpen != null) {
                return withCsp.substring(0, bodyOpen.range.first) + "<head>\n$injection</head>\n" + withCsp.substring(bodyOpen.range.first)
            }
            return withCsp + "\n" + injection
        }

        /**
         * Anki FrontendService methods. The pages call them like backend methods, but Anki desktop's
         * mediasrv implements them; the backend rejects them, which the page would turn into an alert().
         */
        val FRONTEND_METHODS = setOf(
            "askUser", "closeAddCards", "closeEditCurrent", "convertPastedImage", "deckOptionsReady",
            "deckOptionsRequireClose", "getMetaJson", "getProfileConfigJson", "getSchedulingStatesWithContext",
            "importDialogRequireClose", "importDone", "openCardsDialog", "openFieldsDialog", "openFilePicker",
            "openLink", "openMedia", "playFile", "readClipboard", "recordAudio", "saveCustomColours",
            "searchInBrowser", "setMetaJson", "setProfileConfigJson", "setSchedulingStates",
            "showInMediaFolder", "showMessageBox", "writeClipboard"
        )

        /** Frontend calls that ask the host to close the page (sent as `anki-page` events with `close: true`). */
        val CLOSE_METHODS = setOf("deckOptionsRequireClose", "importDialogRequireClose", "closeAddCards", "closeEditCurrent")

        fun newToken(): String {
            val bytes = ByteArray(24)
            SecureRandom().nextBytes(bytes)
            return bytes.joinToString("") { "%02x".format(it) }
        }

        private val STATUS_TEXT = mapOf(
            200 to "OK", 206 to "Partial Content", 302 to "Found", 304 to "Not Modified", 400 to "Bad Request",
            401 to "Unauthorized", 403 to "Forbidden", 404 to "Not Found", 405 to "Method Not Allowed",
            409 to "Conflict", 413 to "Payload Too Large", 416 to "Range Not Satisfiable", 500 to "Internal Server Error",
            501 to "Not Implemented", 502 to "Bad Gateway"
        )

        internal fun status(code: Int): NanoHTTPD.Response.IStatus = object : NanoHTTPD.Response.IStatus {
            override fun getDescription(): String = "$code ${STATUS_TEXT[code] ?: "Status"}"
            override fun getRequestStatus(): Int = code
        }

        internal fun httpDate(millis: Long): String =
            SimpleDateFormat("EEE, dd MMM yyyy HH:mm:ss 'GMT'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("GMT")
            }.format(Date(millis / 1000 * 1000))

        /** Parses one `start-end` / `start-` / `-suffix` range; null if unsatisfiable or multi-range. */
        internal fun parseRange(spec: String, length: Long): Pair<Long, Long>? {
            if (spec.contains(',') || length <= 0) return null
            val dash = spec.indexOf('-')
            if (dash < 0) return null
            val a = spec.substring(0, dash).trim()
            val b = spec.substring(dash + 1).trim()
            return if (a.isEmpty()) {
                val suffix = b.toLongOrNull() ?: return null
                if (suffix <= 0) return null
                maxOf(0, length - suffix) to length - 1
            } else {
                val start = a.toLongOrNull() ?: return null
                val end = if (b.isEmpty()) length - 1 else (b.toLongOrNull() ?: return null).coerceAtMost(length - 1)
                if (start > end || start >= length) null else start to end
            }
        }
    }
}
