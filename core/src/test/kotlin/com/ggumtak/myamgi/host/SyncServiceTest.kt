package com.ggumtak.myamgi.host

import com.ggumtak.myamgi.engine.MediaFingerprint
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.BufferedInputStream
import java.io.File
import java.io.IOException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/** Sync state handling with the network part replaced by a fake transport. */
class SyncServiceTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private val calls = CopyOnWriteArrayList<String>()
    private lateinit var transport: FakeTransport
    private lateinit var events: EventBus
    private lateinit var service: SyncService
    private lateinit var stateFile: File
    private lateinit var prefs: Prefs
    private val runningUpdates = CopyOnWriteArrayList<Pair<Boolean, String?>>()
    private val fingerprintRef = AtomicReference<MediaFingerprint?>(MediaFingerprint(1000L, 2000L))

    inner class FakeTransport : SyncTransport {
        var next = CollectionSyncResult(SyncRequired.NORMAL_SYNC)
        var failAuth = false
        var block: CountDownLatch? = null
        val aborted = CountDownLatch(1)
        val mediaAborted = CountDownLatch(1)
        val mediaPolls = AtomicInteger(2)
        val recordedFullSyncUsns = CopyOnWriteArrayList<Pair<Boolean, Int?>>()
        var mediaStatusProvider: (() -> MediaSyncSnapshot)? = null

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
            recordedFullSyncUsns += (upload to serverMediaUsn)
            calls += if (upload) "upload" else "download"
        }

        override fun startMediaSync(creds: SyncCredentials) {
            calls += "media"
        }

        override fun mediaSyncStatus(): MediaSyncSnapshot {
            mediaStatusProvider?.let { return it() }
            val active = mediaPolls.getAndDecrement() > 0
            return MediaSyncSnapshot(active = active)
        }

        override fun mediaSyncActive(): Boolean = mediaSyncStatus().active

        override fun abort() {
            calls += "abort"
            aborted.countDown()
        }

        override fun abortMedia() {
            calls += "abortMedia"
            mediaAborted.countDown()
        }
    }

    @Before
    fun setUp() {
        calls.clear()
        runningUpdates.clear()
        fingerprintRef.set(MediaFingerprint(1000L, 2000L))
        transport = FakeTransport()
        stateFile = File(tmp.root, "host/sync.json")
        prefs = Prefs(File(tmp.root, "prefs.json"))
        events = EventBus()
        service = SyncService(
            stateFile = stateFile,
            transport = transport,
            events = events,
            progress = ProgressPump(events, source = { null }),
            log = HostLog(),
            prefs = prefs,
            backupBeforeDownload = { calls += "backup" },
            mediaPollMillis = 1,
            onRunningChanged = { r, label -> runningUpdates += (r to label) },
            mediaStateProbe = MediaStateProbe { fingerprintRef.get() },
            retryBackoffMillis = 1L,
            maxMediaRetries = 2
        )
    }

    private fun JsonObject.b(key: String) = this[key]!!.jsonPrimitive.boolean

    private fun JsonObject.strOrNull(key: String): String? =
        this[key]?.takeIf { it !is JsonNull }?.jsonPrimitive?.content

    private fun waitForMediaIdle(timeoutMs: Long = 5000) {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (service.status().b("mediaRunning") && System.currentTimeMillis() < deadline) {
            Thread.sleep(5)
        }
        assertFalse("media sync did not finish in ${timeoutMs}ms", service.status().b("mediaRunning"))
    }

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
        assertTrue(r.b("mediaSyncStarted"))
        assertFalse(r.b("mediaSyncSkipped"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "media"), calls)
        assertTrue(service.status()["lastSync"]!!.jsonPrimitive.content.toLong() > 0)
        waitForMediaIdle()
    }

    @Test
    fun mediaSyncCanBeDisabled() {
        service.login("me", "pw", null)
        prefs.set(JsonObject(mapOf("sync.media" to JsonPrimitive(false))))
        calls.clear()
        val r = service.run("normal")
        assertFalse(r.b("mediaSyncStarted"))
        assertFalse(r.b("mediaSyncSkipped"))
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
        waitForMediaIdle()

        calls.clear()
        service.run("upload")
        assertEquals(listOf("upload", "media"), calls)
        waitForMediaIdle()
    }

    @Test
    fun emptyLocalOrRemoteSidesFullSyncAutomatically() {
        service.login("me", "pw", null)
        transport.next = CollectionSyncResult(SyncRequired.FULL_DOWNLOAD)
        calls.clear()
        service.run("normal")
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "backup", "download", "media"), calls)
        waitForMediaIdle()

        transport.next = CollectionSyncResult(SyncRequired.FULL_UPLOAD)
        calls.clear()
        service.run("normal")
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "upload", "media"), calls)
        waitForMediaIdle()
    }

    @Test
    fun newEndpointIsPersisted() {
        service.login("me", "pw", null)
        transport.next = CollectionSyncResult(SyncRequired.NO_CHANGES, newEndpoint = "https://sync9.example/")
        service.run("normal")
        waitForMediaIdle()
        assertEquals("https://sync9.example/", service.status()["endpoint"]!!.jsonPrimitive.content)
        transport.next = CollectionSyncResult(SyncRequired.NO_CHANGES)
        calls.clear()
        service.run("normal")
        assertEquals("collection:HKEY-me@https://sync9.example/", calls.first())
        waitForMediaIdle()
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

    @Test
    fun decoupledMediaSyncReturnsImmediatelyAndPublishesProgressInBackground() {
        service.login("me", "pw", null)
        val firstPollEntered = CountDownLatch(1)
        val releaseFirstPoll = CountDownLatch(1)
        val secondPollEntered = CountDownLatch(1)
        val releaseFinish = CountDownLatch(1)
        val step = AtomicInteger(0)

        transport.mediaStatusProvider = {
            when (step.getAndIncrement()) {
                0 -> {
                    firstPollEntered.countDown()
                    releaseFirstPoll.await(5, TimeUnit.SECONDS)
                    MediaSyncSnapshot(active = true, checked = "100", added = "2", removed = "0")
                }
                1 -> {
                    // Identical snapshot -> must not emit duplicate progress
                    MediaSyncSnapshot(active = true, checked = "100", added = "2", removed = "0")
                }
                2 -> {
                    secondPollEntered.countDown()
                    releaseFinish.await(5, TimeUnit.SECONDS)
                    MediaSyncSnapshot(active = true, checked = "500", added = "5", removed = "1")
                }
                else -> MediaSyncSnapshot(active = false)
            }
        }

        val mediaProgressEvents = CopyOnWriteArrayList<JsonObject>()
        val sseStream = events.subscribe()
        val reader = Thread {
            val bis = BufferedInputStream(sseStream)
            var currentEvent: String? = null
            runCatching {
                while (true) {
                    val line = TestHttp.readLine(bis) ?: break
                    if (line.startsWith("event:")) currentEvent = line.removePrefix("event:").trim()
                    else if (line.startsWith("data:") && currentEvent == "progress") {
                        val obj = Json.parseToJsonElement(line.removePrefix("data:").trim()).jsonObject
                        if (obj.strOrNull("op") == "media-sync") mediaProgressEvents += obj
                    }
                }
            }
        }.apply { isDaemon = true; start() }

        runningUpdates.clear()
        transport.next = CollectionSyncResult(SyncRequired.NORMAL_SYNC, serverMediaUsn = 55)
        val res = service.run("normal")

        // Collection sync returned immediately while media sync is blocked in background!
        assertTrue(res.b("ok"))
        assertTrue(res.b("mediaSyncStarted"))
        assertFalse(res.b("mediaSyncSkipped"))
        assertFalse(service.status().b("running"))
        assertEquals("idle", service.status().strOrNull("phase"))
        assertTrue(service.status().b("mediaRunning"))

        assertTrue(firstPollEntered.await(5, TimeUnit.SECONDS))
        releaseFirstPoll.countDown()
        assertTrue(secondPollEntered.await(5, TimeUnit.SECONDS))

        // While active, status reflects the latest media progress
        assertEquals("100", service.status().strOrNull("mediaChecked"))
        assertEquals("2", service.status().strOrNull("mediaAdded"))
        assertEquals("0", service.status().strOrNull("mediaRemoved"))

        // Foreground service callback stayed active across collection -> media without dropping to false
        assertTrue(runningUpdates.isNotEmpty())
        assertTrue(runningUpdates.all { it.first })

        releaseFinish.countDown()
        waitForMediaIdle()

        val doneStatus = service.status()
        assertFalse(doneStatus.b("mediaRunning"))
        assertNotNull(doneStatus.strOrNull("mediaLastSync"))
        assertNull(doneStatus.strOrNull("mediaError"))
        assertEquals("500", doneStatus.strOrNull("mediaChecked"))
        assertEquals("5", doneStatus.strOrNull("mediaAdded"))
        assertEquals("1", doneStatus.strOrNull("mediaRemoved"))

        // Foreground service was stopped cleanly after media finished (await publishState after mediaRunning flips)
        val notifyDeadline = System.currentTimeMillis() + 2000
        while ((runningUpdates.isEmpty() || runningUpdates.last().first) && System.currentTimeMillis() < notifyDeadline) {
            Thread.sleep(10)
        }
        assertFalse(runningUpdates.last().first)

        // Wait briefly for SSE reader thread to drain final done event
        val deadline = System.currentTimeMillis() + 2000
        while (mediaProgressEvents.none { it.strOrNull("phase") == "done" } && System.currentTimeMillis() < deadline) {
            Thread.sleep(10)
        }
        sseStream.close()
        reader.join(1000)

        val runningEvents = mediaProgressEvents.filter { it.strOrNull("phase") == "running" }
        assertEquals(2, runningEvents.size)
        assertEquals("100", runningEvents[0].strOrNull("checked"))
        assertEquals("500", runningEvents[1].strOrNull("checked"))
        assertTrue(mediaProgressEvents.any { it.strOrNull("phase") == "done" })
    }

    @Test
    fun fastSkipCacheSkipsUnchangedRepeatNormalSyncsAndRerunsOnChanges() {
        service.login("me", "pw", null)
        transport.mediaPolls.set(1)
        transport.next = CollectionSyncResult(SyncRequired.NORMAL_SYNC, serverMediaUsn = 42)
        fingerprintRef.set(MediaFingerprint(1000L, 2000L))

        // 1. Initial normal sync runs media sync and caches USN + fingerprint
        calls.clear()
        val first = service.run("normal")
        assertTrue(first.b("mediaSyncStarted"))
        assertFalse(first.b("mediaSyncSkipped"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "media"), calls)
        waitForMediaIdle()

        // 2. Repeat normal sync with identical USN & fingerprint -> fast-skipped!
        calls.clear()
        val second = service.run("normal")
        assertFalse(second.b("mediaSyncStarted"))
        assertTrue(second.b("mediaSyncSkipped"))
        assertTrue(service.status().b("mediaSkipped"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/"), calls)

        // 3. Server media USN changed -> must run media sync again
        transport.mediaPolls.set(1)
        transport.next = CollectionSyncResult(SyncRequired.NORMAL_SYNC, serverMediaUsn = 43)
        calls.clear()
        val third = service.run("normal")
        assertTrue(third.b("mediaSyncStarted"))
        assertFalse(third.b("mediaSyncSkipped"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "media"), calls)
        waitForMediaIdle()

        // 4. Local fingerprint changed -> must run media sync again
        fingerprintRef.set(MediaFingerprint(1001L, 2000L))
        transport.mediaPolls.set(1)
        calls.clear()
        val fourth = service.run("normal")
        assertTrue(fourth.b("mediaSyncStarted"))
        assertFalse(fourth.b("mediaSyncSkipped"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "media"), calls)
        waitForMediaIdle()

        // 5. Repeat with new fingerprint unchanged -> fast-skipped again
        calls.clear()
        val fifth = service.run("normal")
        assertTrue(fifth.b("mediaSyncSkipped"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/"), calls)

        // 6. invalidateMediaCache() -> must run media sync even with same USN & fingerprint
        service.invalidateMediaCache()
        transport.mediaPolls.set(1)
        calls.clear()
        val sixth = service.run("normal")
        assertTrue(sixth.b("mediaSyncStarted"))
        assertFalse(sixth.b("mediaSyncSkipped"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "media"), calls)
        waitForMediaIdle()

        // 7. forceMedia = true -> must bypass cache and run media sync
        transport.mediaPolls.set(1)
        calls.clear()
        val seventh = service.run("normal", forceMedia = true)
        assertTrue(seventh.b("mediaSyncStarted"))
        assertFalse(seventh.b("mediaSyncSkipped"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "media"), calls)
        waitForMediaIdle()
    }

    @Test
    fun pendingServerMediaUsnIsPassedToFullDownloadAndFullUpload() {
        service.login("me", "pw", null)
        transport.next = CollectionSyncResult(SyncRequired.FULL_SYNC, serverMediaUsn = 77)
        val r1 = service.run("normal")
        assertTrue(r1.b("needsFullSync"))

        transport.recordedFullSyncUsns.clear()
        transport.mediaPolls.set(1)
        val d = service.run("download")
        assertTrue(d.b("ok"))
        assertEquals(listOf(false to 77), transport.recordedFullSyncUsns)
        waitForMediaIdle()

        // Subsequent normal FULL_SYNC with a different USN feeds fullUpload
        transport.next = CollectionSyncResult(SyncRequired.FULL_SYNC, serverMediaUsn = 88)
        assertTrue(service.run("normal").b("needsFullSync"))

        transport.recordedFullSyncUsns.clear()
        transport.mediaPolls.set(1)
        val u = service.run("upload")
        assertTrue(u.b("ok"))
        assertEquals(listOf(true to 88), transport.recordedFullSyncUsns)
        waitForMediaIdle()

        // Cleared after full sync: direct upload without preceding FULL_SYNC passes null
        transport.recordedFullSyncUsns.clear()
        transport.mediaPolls.set(1)
        service.run("upload")
        assertEquals(listOf(true to null), transport.recordedFullSyncUsns)
        waitForMediaIdle()
    }

    @Test
    fun abortMediaStopsOnlyMediaAndDoesNotMarkCacheComplete() {
        service.login("me", "pw", null)
        val mediaPolling = CountDownLatch(1)
        transport.mediaStatusProvider = {
            mediaPolling.countDown()
            MediaSyncSnapshot(active = true, checked = "200")
        }
        transport.next = CollectionSyncResult(SyncRequired.NORMAL_SYNC, serverMediaUsn = 99)

        val r = service.run("normal")
        assertTrue(r.b("mediaSyncStarted"))
        assertTrue(mediaPolling.await(5, TimeUnit.SECONDS))
        assertTrue(service.status().b("mediaRunning"))

        // mediaRun rejects with 409 while media sync is already running
        expectError(409) { service.mediaRun() }

        calls.clear()
        val afterAbort = service.abortMedia()
        assertFalse(afterAbort.b("mediaRunning"))
        assertEquals(listOf("abortMedia"), calls)
        assertFalse(calls.contains("abort"))

        // Because media sync was aborted, next normal sync with same USN must NOT fast-skip
        transport.mediaStatusProvider = null
        transport.mediaPolls.set(1)
        calls.clear()
        val nextRun = service.run("normal")
        assertTrue(nextRun.b("mediaSyncStarted"))
        assertFalse(nextRun.b("mediaSyncSkipped"))
        assertEquals(listOf("collection:HKEY-me@https://sync.example/", "media"), calls)
        waitForMediaIdle()
    }

    @Test
    fun abortStopsBackgroundMediaSyncToo() {
        service.login("me", "pw", null)
        val mediaPolling = CountDownLatch(1)
        transport.mediaStatusProvider = {
            mediaPolling.countDown()
            MediaSyncSnapshot(active = true, checked = "150")
        }

        val st = service.mediaRun()
        assertTrue(st.b("mediaRunning"))
        assertTrue(mediaPolling.await(5, TimeUnit.SECONDS))

        calls.clear()
        val afterAbort = service.abort()
        assertFalse(afterAbort.b("mediaRunning"))
        assertTrue(calls.contains("abort"))
    }

    @Test
    fun transientNetworkErrorAutoRetriesAndRecoversOrSurfacesErrorWhenExhausted() {
        service.login("me", "pw", null)

        // Part A: 2 transient IO errors then clean recovery
        val attempts = AtomicInteger(0)
        transport.mediaStatusProvider = {
            when (attempts.getAndIncrement()) {
                0, 1 -> throw IOException("connection reset")
                2 -> MediaSyncSnapshot(active = true, checked = "300")
                else -> MediaSyncSnapshot(active = false)
            }
        }
        transport.next = CollectionSyncResult(SyncRequired.NORMAL_SYNC, serverMediaUsn = 123)
        calls.clear()
        service.run("normal")
        waitForMediaIdle()

        // 1 initial startMediaSync + 2 retries = 3 "media" calls
        assertEquals(3, calls.count { it == "media" })
        assertNull(service.status().strOrNull("mediaError"))
        assertNotNull(service.status().strOrNull("mediaLastSync"))

        // Part B: persistent transient errors exhaust retries and surface mediaError
        transport.mediaStatusProvider = { throw IOException("network unreachable") }
        calls.clear()
        service.run("normal", forceMedia = true)
        waitForMediaIdle()

        assertEquals(3, calls.count { it == "media" })
        val err = service.status().strOrNull("mediaError")
        assertNotNull(err)
        assertTrue(err!!.contains("network unreachable"))

        // Failed media sync must not mark cache complete -> next normal sync retries media
        transport.mediaStatusProvider = null
        transport.mediaPolls.set(1)
        calls.clear()
        val retryAfterFail = service.run("normal")
        assertTrue(retryAfterFail.b("mediaSyncStarted"))
        assertFalse(retryAfterFail.b("mediaSyncSkipped"))
        waitForMediaIdle()
    }

    @Test
    fun mediaSyncAuthFailureLogsOutWithoutRetrying() {
        service.login("me", "pw", null)
        transport.mediaStatusProvider = { throw SyncAuthFailed("token expired") }
        calls.clear()
        service.run("normal")
        waitForMediaIdle()

        assertEquals(1, calls.count { it == "media" })
        assertFalse(service.status().b("loggedIn"))
        val err = service.status().strOrNull("mediaError")
        assertNotNull(err)
        assertTrue(err!!.contains("로그인"))
    }

    @Test
    fun sameUserReloginAbortsStaleMediaSyncAndPreservesFreshCredentials() {
        service.login("me", "pw", null)
        val pollEntered = CountDownLatch(1)
        val releaseAuthFail = CountDownLatch(1)
        val authFailThrown = CountDownLatch(1)
        val monitorThreadRef = AtomicReference<Thread?>(null)
        transport.mediaStatusProvider = {
            monitorThreadRef.set(Thread.currentThread())
            pollEntered.countDown()
            val deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5)
            while (releaseAuthFail.count > 0 && System.nanoTime() < deadline) {
                try {
                    releaseAuthFail.await(50, TimeUnit.MILLISECONDS)
                } catch (_: InterruptedException) {
                    // Ignore cancel interrupt so this test genuinely exercises a late SyncAuthFailed after re-login.
                }
            }
            authFailThrown.countDown()
            throw SyncAuthFailed("stale hkey expired")
        }

        service.mediaRun()
        assertTrue(pollEntered.await(5, TimeUnit.SECONDS))

        // Re-login with the SAME user while stale media sync is in flight
        calls.clear()
        val afterLogin = service.login("me", "pw", null)
        assertTrue(afterLogin.b("loggedIn"))
        assertFalse(afterLogin.b("mediaRunning"))
        assertTrue(calls.contains("abortMedia"))

        // Release late SyncAuthFailed — must NOT wipe the newly saved hkey!
        releaseAuthFail.countDown()
        assertTrue(authFailThrown.await(5, TimeUnit.SECONDS))
        monitorThreadRef.get()?.join(5000)
        assertTrue(service.status().b("loggedIn"))
        assertNull(service.status().strOrNull("mediaError"))
    }

    @Test
    fun cyclicExceptionCauseInMediaSyncDoesNotStackOverflow() {
        service.login("me", "pw", null)
        val a = RuntimeException("cycle-a")
        val b = RuntimeException("cycle-b", a)
        a.initCause(b)
        transport.mediaStatusProvider = { throw a }

        service.mediaRun()
        waitForMediaIdle()

        assertFalse(service.status().b("mediaRunning"))
        val err = service.status().strOrNull("mediaError")
        assertNotNull(err)
        assertTrue(err!!.contains("cycle-a"))
    }

    @Test
    fun fullDownloadAbortsActiveBackgroundMediaSyncFirst() {
        service.login("me", "pw", null)
        val mediaPolling = CountDownLatch(1)
        transport.mediaStatusProvider = {
            mediaPolling.countDown()
            if (transport.mediaAborted.count > 0) {
                MediaSyncSnapshot(active = true, checked = "10")
            } else {
                MediaSyncSnapshot(active = false)
            }
        }
        service.mediaRun()
        assertTrue(mediaPolling.await(5, TimeUnit.SECONDS))

        calls.clear()
        val res = service.run("download")
        assertTrue(res.b("ok"))
        val abortIdx = calls.indexOf("abortMedia")
        val fullIdx = calls.indexOf("download")
        assertTrue("abortMedia must run before fullDownload (calls=$calls)", abortIdx >= 0 && abortIdx < fullIdx)
        waitForMediaIdle()
    }

    @Test
    fun abortMediaDoesNotInterruptConcurrentCollectionSync() {
        service.login("me", "pw", null)
        val mediaPolling = CountDownLatch(1)
        transport.mediaStatusProvider = {
            mediaPolling.countDown()
            MediaSyncSnapshot(active = true, checked = "50")
        }
        service.mediaRun()
        assertTrue(mediaPolling.await(5, TimeUnit.SECONDS))
        assertTrue(service.status().b("mediaRunning"))

        // Start a blocking collection sync while background media sync is active
        val colStarted = CountDownLatch(1)
        transport.block = colStarted
        var colError: HostError? = null
        val colThread = Thread {
            colError = runCatching { service.run("normal") }.exceptionOrNull() as? HostError
        }
        colThread.start()
        assertTrue(colStarted.await(5, TimeUnit.SECONDS))
        assertTrue(service.status().b("running"))
        assertTrue(service.status().b("mediaRunning"))

        // abortMedia() must stop ONLY media sync, leaving collection sync running
        calls.clear()
        val st = service.abortMedia()
        assertFalse(st.b("mediaRunning"))
        assertTrue(st.b("running"))
        assertEquals(listOf("abortMedia"), calls)

        // Clean up the blocked collection sync
        service.abort()
        colThread.join(5000)
        assertEquals(409, colError?.status)
        assertFalse(service.status().b("running"))
    }

    @Test
    fun notificationUpdatesAreThrottledDuringRapidMediaProgress() {
        val throttledUpdates = CopyOnWriteArrayList<Pair<Boolean, String?>>()
        val throttledService = SyncService(
            stateFile = File(tmp.root, "host/sync-throttle.json"),
            transport = transport,
            events = events,
            progress = ProgressPump(events, source = { null }),
            log = HostLog(),
            prefs = prefs,
            backupBeforeDownload = {},
            mediaPollMillis = 1,
            onRunningChanged = { r, label -> throttledUpdates += (r to label) },
            mediaStateProbe = MediaStateProbe { fingerprintRef.get() },
            retryBackoffMillis = 1L,
            notificationThrottleMillis = 10_000L
        )
        throttledService.login("me", "pw", null)

        val step = AtomicInteger(0)
        transport.mediaStatusProvider = {
            val n = step.getAndIncrement()
            if (n < 10) MediaSyncSnapshot(active = true, checked = "${n * 100}")
            else MediaSyncSnapshot(active = false)
        }

        throttledUpdates.clear()
        throttledService.mediaRun()
        val deadline = System.currentTimeMillis() + 5000
        while (
            (throttledService.status().b("mediaRunning") || throttledUpdates.none { !it.first }) &&
            System.currentTimeMillis() < deadline
        ) {
            Thread.sleep(5)
        }
        assertFalse(throttledService.status().b("mediaRunning"))

        // With 10s throttle and 10 rapid progress ticks (~10ms), only start (true) and stop (false) fire
        assertEquals(2, throttledUpdates.size)
        assertTrue(throttledUpdates[0].first)
        assertFalse(throttledUpdates[1].first)
        assertNull(throttledUpdates[1].second)
    }
}
