package com.ggumtak.myamgi.host

import anki.decks.DeckNames
import anki.decks.GetDeckNamesRequest
import anki.generic.Json as PbJson
import anki.import_export.ImportAnkiPackageOptions
import anki.import_export.ImportAnkiPackageRequest
import anki.import_export.ImportResponse
import com.ggumtak.myamgi.engine.AnkiEngine
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import net.ankiweb.rsdroid.testing.RustBackendLoader
import org.junit.After
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.BufferedInputStream
import java.io.File
import java.net.Socket
import java.net.URLEncoder
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** HTTP-level tests of [HostServer] against the real Anki backend. */
class HostServerTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private lateinit var server: HostServer
    private lateinit var http: TestHttp
    private lateinit var dataDir: File

    private class TestPlatform : Platform {
        override fun info() = PlatformInfo("desktop", "9.9.9", 42, "test", false, "junit")
        override fun hanjaTapScript() = "window.__hjTest = true;"
    }

    @Before
    fun setUp() {
        AnkiEngine.nativeLoader = { RustBackendLoader.ensureSetup() }
        AnkiEngine.closeAll()
        dataDir = tmp.newFolder("data")
        val uiDir = tmp.newFolder("ui").apply {
            File(this, "index.html").writeText("<!doctype html><title>myAmgi UI</title>")
            File(this, "card-frame.html").writeText("<!doctype html><title>frame</title>")
            File(this, "ui-version.json").writeText("""{"version":"1.0.0"}""")
            File(this, "assets").mkdirs()
            File(this, "assets/app.js").writeText("console.log('ui')")
        }
        val anki = tmp.newFolder("anki").apply {
            File(this, "sveltekit/app/immutable/entry").mkdirs()
            File(this, "sveltekit/index.html").writeText(
                """<!doctype html><html><head><meta http-equiv="content-security-policy" content="script-src 'self' 'sha256-orig'"><title>sveltekit</title></head><body></body></html>"""
            )
            File(this, "sveltekit/app/immutable/entry/start.js").writeText("export {}")
            File(this, "js").mkdirs()
            File(this, "js/reviewer.js").writeText("var reviewer = 1;")
        }
        server = HostServer(
            uiBuiltIn = DirAssetSource(uiDir),
            uiOtaDir = File(dataDir, "ota"),
            ankiAssets = DirAssetSource(anki),
            dataDir = dataDir,
            platform = TestPlatform(),
            token = TOKEN,
            collectionDir = File(dataDir, "collection")
        ).start()
        http = TestHttp(server.port)
    }

    @After
    fun tearDown() {
        server.stop()
        AnkiEngine.closeAll()
    }

    private fun login() {
        http.cookie = "${HostServer.COOKIE}=$TOKEN"
    }

    private fun api(name: String, body: String = "{}"): Pair<Int, JsonObject> {
        val r = http.postJson("/api/host/$name", body)
        return r.status to Json.parseToJsonElement(r.text).jsonObject
    }

    private fun JsonObject.s(key: String) = this[key]!!.jsonPrimitive.content

    @Test
    fun rejectsRequestsWithoutTokenOrWithForeignHost() {
        assertEquals(403, http.get("/ui/").status)
        assertEquals(403, http.get("/?t=wrong").status)
        assertEquals(403, http.post("/_anki/getDeckNames", ByteArray(0)).status)
        assertEquals(403, http.postJson("/api/host/info", "{}").status)
        // Right token, wrong Host header (DNS rebinding)
        assertEquals(403, http.get("/ui/", mapOf("X-Amgi-Token" to TOKEN), host = "evil.example:${server.port}").status)
        assertEquals(403, http.get("/?t=$TOKEN", host = "evil.example").status)
        // Header token works
        assertEquals(200, http.get("/ui/", mapOf("X-Amgi-Token" to TOKEN)).status)
        assertEquals(200, http.get("/ui/", mapOf("X-Amgi-Token" to TOKEN), host = "localhost:${server.port}").status)
    }

    @Test
    fun handshakeSetsCookieAndRedirectsToUi() {
        val r = http.get("/?t=$TOKEN")
        assertEquals(302, r.status)
        assertEquals("/ui/", r.header("location"))
        val cookie = r.header("set-cookie")!!
        assertTrue(cookie, cookie.startsWith("amgi_t=$TOKEN"))
        assertTrue(cookie.contains("HttpOnly"))
        assertTrue(cookie.contains("SameSite=Strict"))
        assertEquals(null, r.header("access-control-allow-origin"))

        http.cookie = cookie.substringBefore(';')
        val ui = http.get("/ui/")
        assertEquals(200, ui.status)
        assertTrue(ui.text.contains("myAmgi UI"))
        assertEquals("application/javascript; charset=utf-8", http.get("/ui/assets/app.js").header("content-type"))
        assertTrue(http.get("/media/__amgi_frame.html").text.contains("frame"))
    }

    @Test
    fun officialPagesAndStaticAssets() {
        login()
        val page = http.get("/deck-options/1")
        assertEquals(200, page.status)
        assertTrue(page.text.contains("sveltekit"))
        assertTrue(http.get("/import-anki-package/%2Ftmp%2Fa.apkg").text.contains("sveltekit"))
        val chunk = http.get("/_app/immutable/entry/start.js")
        assertEquals(200, chunk.status)
        assertTrue(chunk.header("cache-control")!!.contains("immutable"))
        assertEquals("var reviewer = 1;", http.get("/_anki/js/reviewer.js").text)
        assertEquals(404, http.get("/_anki/js/missing.js").status)
    }

    @Test
    fun ankiRpcRoundTrip() {
        login()
        val deckId = AnkiEngine.createDeck("일본어::한자")
        val req = GetDeckNamesRequest.newBuilder().setSkipEmptyDefault(false).setIncludeFiltered(true).build()
        val r = http.post("/_anki/getDeckNames", req.toByteArray())
        assertEquals(200, r.status)
        val names = DeckNames.parseFrom(r.body)
        assertTrue(names.entriesList.any { it.id == deckId && it.name == "일본어::한자" })
        assertTrue(names.entriesList.any { it.id == 1L })

        // Backend error -> 500 with message
        val bad = http.post("/_anki/getDeck", anki.decks.DeckId.newBuilder().setDid(987654321L).build().toByteArray())
        assertEquals(500, bad.status)
        assertTrue(bad.text.isNotBlank())
        // Unknown method
        assertEquals(404, http.post("/_anki/noSuchMethodAtAll", ByteArray(0)).status)
        // Frontend-service method answered by the host
        val profile = http.post("/_anki/getProfileConfigJson", ByteArray(0))
        assertEquals(200, profile.status)
        assertEquals("null", PbJson.parseFrom(profile.body).json.toStringUtf8())
    }

    @Test
    fun mediaWithAndWithoutRange() {
        login()
        AnkiEngine.ensureOpen()
        val bytes = ByteArray(1000) { (it % 251).toByte() }
        File(AnkiEngine.getMediaDir(), "소리 a+b.mp3").writeBytes(bytes)

        val enc = URLEncoder.encode("소리 a+b.mp3", "UTF-8").replace("+", "%20")
        val full = http.get("/media/$enc")
        assertEquals(200, full.status)
        assertArrayEquals(bytes, full.body)
        assertEquals("audio/mpeg", full.header("content-type"))
        assertEquals("bytes", full.header("accept-ranges"))
        assertEquals("no-cache", full.header("cache-control"))
        assertNotNull(full.header("last-modified"))

        val part = http.get("/media/$enc", mapOf("Range" to "bytes=10-19"))
        assertEquals(206, part.status)
        assertEquals("bytes 10-19/1000", part.header("content-range"))
        assertArrayEquals(bytes.copyOfRange(10, 20), part.body)

        val tail = http.get("/media/$enc", mapOf("Range" to "bytes=-100"))
        assertEquals(206, tail.status)
        assertArrayEquals(bytes.copyOfRange(900, 1000), tail.body)

        assertEquals(416, http.get("/media/$enc", mapOf("Range" to "bytes=5000-")).status)
        // Literal '+' in card HTML (decoded as space by the server) still finds the file
        assertEquals(200, http.get("/media/%EC%86%8C%EB%A6%AC%20a+b.mp3").status)
        assertEquals(404, http.get("/media/missing.png").status)
    }

    @Test
    fun pathTraversalIsRejected() {
        login()
        AnkiEngine.ensureOpen()
        File(dataDir, "secret.txt").writeText("secret")
        for (path in listOf(
            "/media/..%2Fcollection.anki2", "/media/%2e%2e", "/media/../collection/collection.anki2",
            "/media/..%5Csecret.txt", "/ui/../secret.txt", "/ui/..%2F..%2Fdata%2Fsecret.txt",
            "/_anki/../../secret.txt", "/_app/..%2F..%2F..%2Fsecret.txt"
        )) {
            val r = http.get(path)
            assertTrue("$path -> ${r.status}", r.status == 403 || r.status == 404)
            assertFalse(path, r.text.contains("secret") && r.text.length < 10)
        }
        val dl = http.get("/api/host/download?path=" + URLEncoder.encode(File(dataDir, "secret.txt").absolutePath, "UTF-8"))
        assertEquals(403, dl.status)
    }

    @Test
    fun prefsSetThenGet() {
        login()
        val (s1, set) = api("prefs.set", """{"theme":"eink","fontScale":1.2,"twoButton":true}""")
        assertEquals(200, s1)
        assertEquals("eink", set.s("theme"))
        api("prefs.set", """{"fontScale":null,"lang":"ko"}""")
        val (_, got) = api("prefs.get")
        assertEquals("eink", got.s("theme"))
        assertEquals("ko", got.s("lang"))
        assertFalse(got.containsKey("fontScale"))
        assertTrue(File(dataDir, "prefs.json").readText().contains("eink"))
    }

    @Test
    fun infoAndErrorsAreJson() {
        login()
        val (s, info) = api("info")
        assertEquals(200, s)
        assertEquals("desktop", info.s("platform"))
        assertEquals("1.0.0", info.s("uiVersion"))
        assertTrue(info.s("backendVersion").contains("26.09"))
        val (s2, err) = api("platform.tts", """{"text":"안녕"}""")
        assertEquals(501, s2)
        assertTrue(err.s("error").contains("이 기기에서는 지원하지 않습니다"))
        val (s3, _) = api("no.such.function")
        assertEquals(404, s3)
        val (s4, status) = api("collection.status")
        assertEquals(200, s4)
        assertTrue(status.s("path").endsWith("collection.anki2"))
    }

    @Test
    fun backupCreateListAndRestore() {
        login()
        val deckId = AnkiEngine.createDeck("백업 덱")
        val (s, created) = api("backup.create")
        assertEquals(200, s)
        val name = created.s("name")
        assertTrue(name, name.startsWith("backup-") && name.endsWith(".colpkg"))
        val (_, list) = api("backup.list")
        val backups = list["backups"]!!.jsonArray
        assertEquals(1, backups.size)
        assertEquals(name, backups[0].jsonObject.s("name"))

        AnkiEngine.deleteDeck(deckId)
        assertFalse(AnkiEngine.getDeckNames().any { it.name == "백업 덱" })
        val (rs, restored) = api("backup.restore", """{"name":"$name"}""")
        assertEquals(200, rs)
        assertTrue(restored.s("safetyBackup").endsWith(".colpkg"))
        assertTrue(AnkiEngine.getDeckNames().any { it.name == "백업 덱" })
        assertEquals(2, api("backup.list").second["backups"]!!.jsonArray.size)

        val (bad, _) = api("backup.restore", """{"name":"../prefs.json"}""")
        assertEquals(400, bad)
    }

    @Test
    fun backupPruningKeepsConfiguredCount() {
        login()
        api("prefs.set", """{"backup.keep":2}""")
        repeat(4) { api("backup.create") }
        assertEquals(2, api("backup.list").second["backups"]!!.jsonArray.size)
    }

    @Test
    fun exportDeckThenImportIntoFreshCollection() {
        login()
        val deckId = AnkiEngine.createDeck("내보내기::한자")
        val basic = AnkiEngine.getNotetypeNames().first().id
        AnkiEngine.addNote(basic, deckId, listOf("漢字", "한자"), listOf("export"))
        AnkiEngine.addNote(basic, deckId, listOf("日本", "일본"), listOf("export"))

        val (s, exp) = api("export.package", """{"deckId":$deckId,"withScheduling":true,"withMedia":true}""")
        assertEquals(200, s)
        assertEquals("내보내기_한자.apkg", exp.s("name"))
        val dl = http.get("/api/host/download?path=" + URLEncoder.encode(exp.s("path"), "UTF-8") + "&name=" +
            URLEncoder.encode(exp.s("name"), "UTF-8"))
        assertEquals(dl.text + " " + exp, 200, dl.status)
        assertTrue(dl.header("content-disposition")!!.contains("attachment"))
        assertTrue(dl.body.size > 100)

        // Fresh collection; upload the package like the UI would and import it through the official RPC
        AnkiEngine.setCollectionDir(tmp.newFolder("col2"))
        val up = http.post("/api/host/upload?name=" + URLEncoder.encode("받은 덱.apkg", "UTF-8"), dl.body)
        assertEquals(200, up.status)
        val upPath = Json.parseToJsonElement(up.text).jsonObject.s("path")
        val (cs, classified) = api("import.file", """{"path":${JsonPrimitive(upPath).toString()},"name":"받은 덱.apkg"}""")
        assertEquals(200, cs)
        assertEquals("apkg", classified.s("kind"))
        assertTrue(classified.s("route").startsWith("/import-anki-package/"))

        val req = ImportAnkiPackageRequest.newBuilder().setPackagePath(upPath)
            .setOptions(ImportAnkiPackageOptions.newBuilder().setWithScheduling(true).setMergeNotetypes(true))
            .build()
        val r = http.post("/_anki/importAnkiPackage", req.toByteArray())
        assertEquals(r.text, 200, r.status)
        assertEquals(2, ImportResponse.parseFrom(r.body).log.newCount)
        assertEquals(2, AnkiEngine.searchNotes("tag:export").size)
        assertTrue(AnkiEngine.getDeckNames().any { it.name == "내보내기::한자" })
    }

    @Test
    fun colpkgImportNeedsConfirmationThenReplacesCollection() {
        login()
        AnkiEngine.createDeck("원래 덱")
        val (_, exp) = api("export.collection", """{"withMedia":false}""")
        assertTrue(exp.s("name").endsWith(".colpkg"))
        // exporting must leave the collection usable
        AnkiEngine.createDeck("나중 덱")
        val bytes = File(exp.s("path")).readBytes()
        val upPath = Json.parseToJsonElement(http.post("/api/host/upload?name=all.colpkg", bytes).text).jsonObject.s("path")
        val q = JsonPrimitive(upPath).toString()
        val (_, ask) = api("import.file", """{"path":$q}""")
        assertEquals("true", ask.s("needsConfirm"))
        assertTrue(AnkiEngine.getDeckNames().any { it.name == "나중 덱" })

        val (s, done) = api("import.file", """{"path":$q,"replace":true}""")
        assertEquals(200, s)
        assertEquals("true", done.s("imported"))
        val names = AnkiEngine.getDeckNames().map { it.name }
        assertTrue(names.contains("원래 덱"))
        assertFalse(names.contains("나중 덱"))
        assertEquals(1, api("backup.list").second["backups"]!!.jsonArray.size)

        val (bad, _) = api("import.file", """{"path":"/etc/passwd"}""")
        assertEquals(403, bad)
    }

    @Test
    fun sseDeliversProgressEvents() {
        login()
        AnkiEngine.ensureOpen()
        val lines = CopyOnWriteArrayList<String>()
        val gotProgress = CountDownLatch(1)
        val socket = Socket("127.0.0.1", server.port)
        socket.soTimeout = 30_000
        try {
            socket.getOutputStream().apply {
                write(http.head("GET", "/api/host/events", emptyMap(), null).toByteArray())
                flush()
            }
            val input = BufferedInputStream(socket.getInputStream())
            val (status, headers) = TestHttp.readHead(input)
            assertEquals(200, status)
            assertTrue(headers["content-type"]!!.startsWith("text/event-stream"))
            val reader = Thread {
                runCatching {
                    while (true) {
                        val line = TestHttp.readLine(input) ?: break
                        lines.add(line)
                        if (line.startsWith("data:") && line.contains("\"op\":\"backup\"")) gotProgress.countDown()
                    }
                }
            }.apply { isDaemon = true; start() }
            // wait until subscribed
            val deadline = System.currentTimeMillis() + 5000
            while (server.events.subscriberCount == 0 && System.currentTimeMillis() < deadline) Thread.sleep(20)
            assertEquals(200, api("backup.create").first)
            assertTrue("no progress event; got $lines", gotProgress.await(10, TimeUnit.SECONDS))
            assertTrue(lines.any { it == "event: sync-state" })
            assertTrue(lines.any { it == "event: progress" })
            reader.interrupt()
        } finally {
            socket.close()
        }
    }

    @Test
    fun uiOtaBundleIsUsedOnlyWhenNewer() {
        login()
        val ota = File(dataDir, "ota").apply { mkdirs() }
        File(ota, "index.html").writeText("OTA UI")
        File(ota, "ui-version.json").writeText("""{"version":"0.9.0"}""")
        assertTrue(http.get("/ui/").text.contains("myAmgi UI"))
        File(ota, "ui-version.json").writeText("""{"version":"1.0.10"}""")
        File(ota, "ui-version.json").setLastModified(System.currentTimeMillis() + 5000)
        assertEquals("OTA UI", http.get("/ui/").text)
        // files missing from the OTA bundle fall back to the built-in one
        assertEquals(200, http.get("/ui/assets/app.js").status)
        assertEquals("1.0.10", api("info").second.s("uiVersion"))
        assertTrue(UiBundle.compareVersions("1.0.10", "1.0.9") > 0)
        assertEquals(0, UiBundle.compareVersions("2", "2.0"))
    }

    @Test
    fun rangeParser() {
        assertEquals(0L to 9L, HostServer.parseRange("0-9", 100))
        assertEquals(90L to 99L, HostServer.parseRange("90-", 100))
        assertEquals(50L to 99L, HostServer.parseRange("-50", 100))
        assertEquals(0L to 99L, HostServer.parseRange("-500", 100))
        assertEquals(10L to 99L, HostServer.parseRange("10-1000", 100))
        assertEquals(null, HostServer.parseRange("100-", 100))
        assertEquals(null, HostServer.parseRange("5-2", 100))
        assertEquals(null, HostServer.parseRange("0-1,5-6", 100))
    }

    @Test
    fun hanjaTapScriptRequiresAuthAndServesScript() {
        assertEquals(403, http.get("/api/host/hanja-tap.js").status)
        login()
        val r = http.get("/api/host/hanja-tap.js")
        assertEquals(200, r.status)
        assertEquals("application/javascript; charset=utf-8", r.header("content-type"))
        assertEquals("no-cache", r.header("cache-control"))
        assertEquals("window.__hjTest = true;", r.text)
    }

    @Test
    fun sveltePagesInjectKoreanKeepAllAndThemeBootstrap() {
        login()
        // /preferences was removed from SVELTE_ROUTES so it must not serve the SPA shell
        assertEquals(404, http.get("/preferences").status)

        val dark = http.get("/deck-options/1?theme=dark")
        assertEquals(200, dark.status)
        assertTrue(dark.text.contains("word-break: keep-all"))
        assertTrue(dark.text.contains("myamgi-anki-polish"))
        assertTrue(dark.text.contains("? q : 'dark'"))
        assertTrue(dark.text.contains("root.setAttribute('data-bs-theme', 'dark')"))
        // CSP header includes injected script's sha256 alongside original hash
        assertTrue(dark.text.contains("'sha256-orig'"))
        assertTrue(Regex("script-src 'sha256-[A-Za-z0-9+/=]+' 'self'").containsMatchIn(dark.text))

        val eink = http.get("/deck-options/1?theme=eink")
        assertEquals(200, eink.status)
        assertTrue(eink.text.contains("? q : 'eink'"))
        assertTrue(eink.text.contains("html.eink-mode"))

        // Falls back to persisted prefs theme when query param is absent
        api("prefs.set", """{"theme":"dark"}""")
        val fromPrefs = http.get("/graphs")
        assertEquals(200, fromPrefs.status)
        assertTrue(fromPrefs.text.contains("? q : 'dark'"))
    }

    @Test
    fun importFileNormalizesCp949CsvToUtf8() {
        login()
        val cp949 = java.nio.charset.Charset.forName("x-windows-949")
        val sampleCsv = "단어,뜻\n한자,공부\n"
        val cp949Bytes = sampleCsv.toByteArray(cp949)

        val up = http.post("/api/host/upload?name=" + URLEncoder.encode("단어장.csv", "UTF-8"), cp949Bytes)
        assertEquals(200, up.status)
        val upPath = Json.parseToJsonElement(up.text).jsonObject.s("path")

        val (status, resp) = api("import.file", """{"path":${JsonPrimitive(upPath).toString()},"name":"단어장.csv"}""")
        assertEquals(200, status)
        assertEquals("csv", resp.s("kind"))
        assertEquals("CP949", resp.s("detectedEncoding"))
        assertTrue(resp.s("route").startsWith("/import-csv/"))
        assertEquals(sampleCsv, File(upPath).readText(Charsets.UTF_8))

        // UTF-8 BOM and UTF-16LE BOM are also stripped and normalized to UTF-8
        val bomFile = tmp.newFile("utf8_bom.csv").apply {
            writeBytes(byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte()) + "앞,뒤\n".toByteArray(Charsets.UTF_8))
        }
        assertEquals("UTF-8", CsvEncoding.ensureUtf8(bomFile))
        assertEquals("앞,뒤\n", bomFile.readText(Charsets.UTF_8))

        val utf16File = tmp.newFile("utf16le.tsv").apply {
            writeBytes(byteArrayOf(0xFF.toByte(), 0xFE.toByte()) + "질문\t정답\n".toByteArray(Charsets.UTF_16LE))
        }
        assertEquals("UTF-16LE", CsvEncoding.ensureUtf8(utf16File))
        assertEquals("질문\t정답\n", utf16File.readText(Charsets.UTF_8))
    }

    companion object {
        const val TOKEN = "testtoken-123"
    }
}
