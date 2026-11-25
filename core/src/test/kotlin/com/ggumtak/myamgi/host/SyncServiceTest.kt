package com.ggumtak.myamgi.host

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/** Sync state handling with the network part replaced by a fake transport. */
class SyncServiceTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private val calls = mutableListOf<String>()
    private lateinit var transport: FakeTransport
    private lateinit var service: SyncService
    private lateinit var stateFile: File
    private lateinit var prefs: Prefs

    inner class FakeTransport : SyncTransport {
        var next = CollectionSyncResult(SyncRequired.NORMAL_SYNC)
        var failAuth = false
        var block: CountDownLatch? = null
        val aborted = CountDownLatch(1)
        var mediaPolls = 2

        override fun login(user: String, password: String, endpoint: String?): SyncCredentials {
            calls += "login:$user"
            if (password != "pw") throw SyncAuthFailed("bad password")
            return SyncCredentials("HKEY-$user", endpoint ?: "https://sync.example/")
        }

        override fun syncCollection(creds: SyncCredentials): CollectionSyncResult {
            calls += "collection:${creds.hkey}@${creds.endpoint}"
            block?.let { latch ->
                latch.countDown()
                if (aborted.await(10, TimeUnit.SECONDS)) throw SyncAborted()
            }
            if (failAuth) throw SyncAuthFailed("expired")
            return next
        }

        override fun fullSync(creds: SyncCredentials, upload: Boolean, serverMediaUsn: Int?) {
            calls += if (upload) "upload" else "download"
        }

        override fun startMediaSync(creds: SyncCredentials) {
            calls += "media"
        }

        override fun mediaSyncActive(): Boolean = mediaPolls-- > 0

        override fun abort() {
            calls += "abort"
            aborted.countDown()
        }
    }

    @Before
    fun setUp() {
        transport = FakeTransport()
        stateFile = File(tmp.root, "host/sync.json")
        prefs = Prefs(File(tmp.root, "prefs.json"))
        val events = EventBus()
        service = SyncService(
            stateFile = stateFile,
            transport = transport,
            events = events,
            progress = ProgressPump(events, source = { null }),
            log = HostLog(),
            prefs = prefs,
            backupBeforeDownload = { calls += "backup" },
            mediaPollMillis = 1
        )
    }

    private fun JsonObject.b(key: String) = this[key]!!.jsonPrimitive.boolean

    private fun expectError(status: Int, block: () -> Unit): HostError {
        try {
            block()
        } catch (e: HostError) {
            assertEquals(e.message, status, e.status)
            return e
        }
        fail("expected HostError $status")
        throw IllegalStateException()
    }

    @Test
    fun requiresLogin() {
        expectError(401) { service.run("normal") }
        assertFalse(service.status().b("loggedIn"))
    }

    @Test
    fun loginStoresCredentialsInHostFile() {
        expectError(401) { service.login("me", "wrong", null) }
        assertFalse(stateFile.exists() && stateFile.readText().contains("HKEY"))
        val st = service.login(" me ", "pw", null)
        assertTrue(st.b("loggedIn"))
        assertTrue(stateFile.readText().contains("HKEY-me"))
        assertTrue(stateFile.readText().contains("https://sync.example/"))
        service.logout()
        assertFalse(service.status().b("loggedIn"))
        assertFalse(stateFile.readText().contains("HKEY"))
    }

    @Test
    fun normalSyncThenMedia() {
        service.login("me", "pw", null)
        calls.clear()
        val r = service.run("normal")
        assertTrue(r.b("ok"))
        assertFalse(r.b("needsFullSync"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "media"), calls)
        assertTrue(service.status()["lastSync"]!!.jsonPrimitive.content.toLong() > 0)
    }

    @Test
    fun mediaSyncCanBeDisabled() {
        service.login("me", "pw", null)
        prefs.set(JsonObject(mapOf("sync.media" to kotlinx.serialization.json.JsonPrimitive(false))))
        calls.clear()
        service.run("normal")
        assertEquals(listOf("collection:HKEY-me@https://sync.example/"), calls)
    }

    @Test
    fun fullSyncRequiredIsReportedAndResolvedByDirection() {
        service.login("me", "pw", null)
        transport.next = CollectionSyncResult(SyncRequired.FULL_SYNC)
        calls.clear()
        val r = service.run("normal")
        assertTrue(r.b("needsFullSync"))
        assertTrue(service.status().b("needsFullSync"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/"), calls)

        calls.clear()
        val d = service.run("download")
        assertTrue(d.b("ok"))
        assertEquals(listOf("backup", "download", "media"), calls)
        assertFalse(service.status().b("needsFullSync"))

        calls.clear()
        service.run("upload")
        assertEquals(listOf("upload", "media"), calls)
    }

    @Test
    fun emptyLocalOrRemoteSidesFullSyncAutomatically() {
        service.login("me", "pw", null)
        transport.next = CollectionSyncResult(SyncRequired.FULL_DOWNLOAD)
        calls.clear()
        service.run("normal")
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "backup", "download", "media"), calls)

        transport.next = CollectionSyncResult(SyncRequired.FULL_UPLOAD)
        calls.clear()
        service.run("normal")
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "upload", "media"), calls)
    }

    @Test
    fun newEndpointIsPersisted() {
        service.login("me", "pw", null)
        transport.next = CollectionSyncResult(SyncRequired.NO_CHANGES, newEndpoint = "https://sync9.example/")
        service.run("normal")
        assertEquals("https://sync9.example/", service.status()["endpoint"]!!.jsonPrimitive.content)
        transport.next = CollectionSyncResult(SyncRequired.NO_CHANGES)
        calls.clear()
        service.run("normal")
        assertEquals("collection:HKEY-me@https://sync9.example/", calls.first())
    }

    @Test
    fun authFailureLogsOut() {
        service.login("me", "pw", null)
        transport.failAuth = true
        val e = expectError(401) { service.run("normal") }
        assertTrue(e.message.contains("로그인"))
        assertFalse(service.status().b("loggedIn"))
    }

    @Test
    fun onlyOneSyncAtATimeAndAbort() {
        service.login("me", "pw", null)
        val started = CountDownLatch(1)
        transport.block = started
        var result: HostError? = null
        val t = Thread { result = runCatching { service.run("normal") }.exceptionOrNull() as? HostError }
        t.start()
        assertTrue(started.await(5, TimeUnit.SECONDS))
        assertTrue(service.status().b("running"))
        expectError(409) { service.run("normal") }
        service.abort()
        t.join(5000)
        assertEquals(409, result?.status)
        assertEquals("aborted", result?.detail)
        assertFalse(service.status().b("running"))
        assertTrue(calls.contains("abort"))
    }

    @Test
    fun rejectsUnknownMode() {
        service.login("me", "pw", null)
        expectError(400) { service.run("sideways") }
    }
}
