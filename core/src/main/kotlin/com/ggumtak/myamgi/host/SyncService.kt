package com.ggumtak.myamgi.host

import anki.sync.SyncAuth
import anki.sync.SyncCollectionResponse
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.engine.MediaFingerprint
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import net.ankiweb.rsdroid.exceptions.BackendInterruptedException
import net.ankiweb.rsdroid.exceptions.BackendNetworkException
import net.ankiweb.rsdroid.exceptions.BackendSyncException
import java.io.File
import java.io.IOException
import java.util.Collections
import java.util.IdentityHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/** What a normal (incremental) collection sync told us. */
enum class SyncRequired { NO_CHANGES, NORMAL_SYNC, FULL_SYNC, FULL_DOWNLOAD, FULL_UPLOAD }

data class SyncCredentials(val hkey: String, val endpoint: String?)

data class CollectionSyncResult(
    val required: SyncRequired,
    val serverMessage: String = "",
    val newEndpoint: String? = null,
    val serverMediaUsn: Int? = null
)

data class MediaSyncSnapshot(
    val active: Boolean,
    val checked: String? = null,
    val added: String? = null,
    val removed: String? = null
)

/** Supplies the current local media directory/DB mtime fingerprint for fast-skip detection. */
fun interface MediaStateProbe {
    fun fingerprint(): MediaFingerprint?
}

class SyncAuthFailed(message: String, cause: Throwable? = null) : Exception(message, cause)

class SyncAborted(cause: Throwable? = null) : Exception("aborted", cause)

/** The network part of AnkiWeb sync, behind an interface so the state handling can be unit-tested. */
interface SyncTransport {
    fun login(user: String, password: String, endpoint: String?): SyncCredentials
    fun syncCollection(creds: SyncCredentials): CollectionSyncResult
    fun fullSync(creds: SyncCredentials, upload: Boolean, serverMediaUsn: Int?)
    fun startMediaSync(creds: SyncCredentials)
    fun mediaSyncStatus(): MediaSyncSnapshot = MediaSyncSnapshot(active = mediaSyncActive())
    fun mediaSyncActive(): Boolean = false
    fun abort()
    fun abortMedia() = abort()
}

/** Real AnkiWeb protocol through the official backend. */
class EngineSyncTransport : SyncTransport {
    private fun auth(c: SyncCredentials): SyncAuth = SyncAuth.newBuilder().setHkey(c.hkey)
        .apply { if (!c.endpoint.isNullOrBlank()) setEndpoint(c.endpoint) }
        .build()

    private inline fun <T> mapped(block: () -> T): T = try {
        block()
    } catch (e: BackendSyncException.BackendSyncAuthFailedException) {
        throw SyncAuthFailed(e.message ?: "auth failed", e)
    } catch (e: BackendInterruptedException) {
        throw SyncAborted(e)
    }

    override fun login(user: String, password: String, endpoint: String?): SyncCredentials = mapped {
        val auth = AnkiEngine.ankiWebLogin(user, password, endpoint.orEmpty())
        SyncCredentials(auth.hkey, auth.endpoint.ifBlank { endpoint })
    }

    override fun syncCollection(creds: SyncCredentials): CollectionSyncResult = mapped {
        val r = AnkiEngine.ankiWebSyncCollection(auth(creds))
        CollectionSyncResult(
            required = when (r.required) {
                SyncCollectionResponse.ChangesRequired.NO_CHANGES -> SyncRequired.NO_CHANGES
                SyncCollectionResponse.ChangesRequired.FULL_SYNC -> SyncRequired.FULL_SYNC
                SyncCollectionResponse.ChangesRequired.FULL_DOWNLOAD -> SyncRequired.FULL_DOWNLOAD
                SyncCollectionResponse.ChangesRequired.FULL_UPLOAD -> SyncRequired.FULL_UPLOAD
                else -> SyncRequired.NORMAL_SYNC
            },
            serverMessage = r.serverMessage,
            newEndpoint = r.newEndpoint.ifBlank { null },
            serverMediaUsn = r.serverMediaUsn
        )
    }

    override fun fullSync(creds: SyncCredentials, upload: Boolean, serverMediaUsn: Int?) = mapped {
        AnkiEngine.ankiWebFullSync(auth(creds), upload, serverMediaUsn)
    }

    override fun startMediaSync(creds: SyncCredentials) = mapped { AnkiEngine.ankiWebSyncMedia(auth(creds)) }

    override fun mediaSyncStatus(): MediaSyncSnapshot = mapped {
        val r = AnkiEngine.mediaSyncStatusOrThrow() ?: return@mapped MediaSyncSnapshot(active = false)
        val p = if (r.hasProgress()) r.progress else null
        MediaSyncSnapshot(
            active = r.active,
            checked = p?.checked?.ifBlank { null },
            added = p?.added?.ifBlank { null },
            removed = p?.removed?.ifBlank { null }
        )
    }

    override fun mediaSyncActive(): Boolean = mediaSyncStatus().active

    override fun abort() = AnkiEngine.abortAll()

    override fun abortMedia() = AnkiEngine.abortMediaSync()
}

/**
 * AnkiWeb sync state and orchestration. Login state (user, hkey, endpoint, last sync, media cache)
 * lives in [stateFile]. Collection sync runs one at a time and returns as soon as cards/scheduling
 * are synced; media sync runs decoupled on a background monitor thread with smart USN+mtime fast-skip
 * and resumable retry.
 */
class SyncService(
    private val stateFile: File,
    private val transport: SyncTransport,
    private val events: EventBus,
    private val progress: ProgressPump,
    private val log: HostLog,
    private val prefs: Prefs,
    /** Called before a full download replaces the local collection. */
    private val backupBeforeDownload: () -> Unit,
    private val mediaPollMillis: Long = 650,
    private val onRunningChanged: (Boolean, String?) -> Unit = { _, _ -> },
    private val mediaStateProbe: MediaStateProbe = MediaStateProbe { AnkiEngine.mediaFingerprint() },
    private val retryBackoffMillis: Long = 2000L,
    private val maxMediaRetries: Int = 2,
    private val notificationThrottleMillis: Long = 1500L
) {
    private val running = AtomicBoolean(false)
    private val abortRequested = AtomicBoolean(false)

    private val mediaRunning = AtomicBoolean(false)
    private val mediaAbortRequested = AtomicBoolean(false)
    private val mediaRunId = AtomicLong(0L)
    private val mediaCacheEpoch = AtomicLong(0L)

    @Volatile
    private var needsFullSync = false

    @Volatile
    private var lastError: String? = null

    @Volatile
    private var phase: String = "idle"

    @Volatile
    private var mediaChecked: String? = null

    @Volatile
    private var mediaAdded: String? = null

    @Volatile
    private var mediaRemoved: String? = null

    @Volatile
    private var mediaError: String? = null

    @Volatile
    private var mediaSkipped: Boolean = false

    // Lock hierarchy (strictly one-way to prevent deadlock): mediaLock -> stateLock; notifyLock is a leaf lock.
    private val mediaLock = Any()
    private var mediaMonitorThread: Thread? = null

    private val stateLock = Any()

    private val notifyLock = Any()
    private var lastNotifiedRunning: Boolean = false
    private var lastNotifiedPhase: String = "idle"
    private var lastNotifiedLabel: String? = null
    private var lastNotifiedAtMillis: Long = 0L

    private data class CollectionOutcome(
        val serverMessage: String,
        val mediaUsn: Int?,
        val didFullSync: Boolean
    )

    private fun state(): JsonObject = synchronized(stateLock) { readJsonObjectFile(stateFile) ?: JsonObject(emptyMap()) }

    private fun saveState(changes: Map<String, Any?>) = synchronized(stateLock) {
        val merged = LinkedHashMap<String, JsonElement>(state())
        for ((k, v) in changes) if (v == null) merged.remove(k) else merged[k] = toJson(v)
        writeFileAtomically(stateFile, Json.encodeToString(JsonElement.serializer(), JsonObject(merged)).toByteArray())
        runCatching {
            stateFile.setReadable(false, false)
            stateFile.setReadable(true, true)
        }
    }

    private fun credentials(): SyncCredentials? {
        val s = state()
        val hkey = s.str("hkey")?.takeIf { it.isNotBlank() } ?: return null
        return SyncCredentials(hkey, s.str("endpoint")?.takeIf { it.isNotBlank() })
    }

    fun status(): JsonObject {
        val s = state()
        return jsonOf(
            "loggedIn" to (credentials() != null),
            "user" to s.str("user"),
            "endpoint" to s.str("endpoint"),
            "running" to running.get(),
            "phase" to phase,
            "needsFullSync" to needsFullSync,
            "lastSync" to s.long("lastSync"),
            "lastError" to lastError,
            "mediaRunning" to mediaRunning.get(),
            "mediaChecked" to mediaChecked,
            "mediaAdded" to mediaAdded,
            "mediaRemoved" to mediaRemoved,
            "mediaLastSync" to s.long("mediaLastSync"),
            "mediaError" to mediaError,
            "mediaSkipped" to mediaSkipped
        )
    }

    private fun publishState(forceNotify: Boolean = true) {
        val st = status()
        events.publish("sync-state", st)
        notifyRunningChanged(force = forceNotify)
    }

    private fun notifyRunningChanged(force: Boolean) {
        synchronized(notifyLock) {
            val colRunning = running.get()
            val medRunning = mediaRunning.get()
            val isAnyRunning = colRunning || medRunning
            val effectivePhase = when {
                colRunning -> phase
                medRunning -> "media"
                else -> "idle"
            }
            val label: String? = if (!isAnyRunning) null else when (effectivePhase) {
                "backup" -> "안전 백업을 만드는 중…"
                "download" -> "AnkiWeb 서버에서 가져오는 중…"
                "upload" -> "AnkiWeb 서버로 올리는 중…"
                "collection" -> "카드와 학습 기록을 맞추는 중…"
                "media" -> buildMediaNotificationLabel()
                else -> "AnkiWeb 동기화 중…"
            }

            val now = System.currentTimeMillis()
            val runningChanged = isAnyRunning != lastNotifiedRunning
            val phaseChanged = effectivePhase != lastNotifiedPhase
            val labelChanged = label != lastNotifiedLabel
            val shouldDispatch = when {
                runningChanged || phaseChanged -> true
                !isAnyRunning -> false
                force && labelChanged -> true
                labelChanged && (now - lastNotifiedAtMillis) >= notificationThrottleMillis -> true
                else -> false
            }
            if (shouldDispatch) {
                lastNotifiedRunning = isAnyRunning
                lastNotifiedPhase = effectivePhase
                lastNotifiedLabel = label
                lastNotifiedAtMillis = now
                runCatching { onRunningChanged(isAnyRunning, label) }
            }
        }
    }

    private fun buildMediaNotificationLabel(): String {
        val parts = buildList {
            mediaChecked?.takeIf { it.isNotBlank() }?.let { add(it) }
            mediaAdded?.takeIf { it.isNotBlank() }?.let { add(it) }
            mediaRemoved?.takeIf { it.isNotBlank() }?.let { add(it) }
        }
        return if (parts.isEmpty()) {
            "사진과 음성 파일을 맞추는 중…"
        } else {
            "사진과 음성 파일을 맞추는 중… (${parts.joinToString(" · ")})"
        }
    }

    private fun publishMediaProgress(
        phase: String,
        checked: String? = null,
        added: String? = null,
        removed: String? = null,
        error: String? = null
    ) {
        events.publish(
            "progress",
            buildMediaSyncProgressJson(
                checked = checked,
                added = added,
                removed = removed,
                op = "media-sync",
                phase = phase,
                error = error
            )
        )
    }

    /** Invalidates persisted media USN/fingerprint cache so the next sync re-verifies media. */
    fun invalidateMediaCache() {
        synchronized(mediaLock) {
            mediaCacheEpoch.incrementAndGet()
            mediaSkipped = false
            saveState(
                mapOf(
                    "pendingServerMediaUsn" to null,
                    "lastMediaUsn" to null,
                    "lastMediaDirMtime" to null,
                    "lastMediaDbMtime" to null,
                    "mediaComplete" to false
                )
            )
        }
    }

    fun login(user: String, password: String, endpoint: String?): JsonObject {
        val u = user.trim()
        if (u.isEmpty() || password.isEmpty()) throw HostError.badRequest("아이디와 비밀번호를 입력하세요.", "missing-credentials")
        val creds = try {
            transport.login(u, password, endpoint?.trim()?.ifBlank { null })
        } catch (e: SyncAuthFailed) {
            throw HostError(401, "AnkiWeb 아이디 또는 비밀번호가 맞지 않습니다.", e.message, e)
        } catch (e: Exception) {
            throw networkError("AnkiWeb에 로그인하지 못했습니다", e)
        }
        val medWasRunning = synchronized(mediaLock) {
            val prevUser = state().str("user")
            // Always cancel any in-flight media sync using the previous hkey so stale SyncAuthFailed cannot clear fresh credentials.
            val wasRunning = mediaRunning.get()
            if (wasRunning) {
                mediaAbortRequested.set(true)
                mediaRunId.incrementAndGet()
                mediaMonitorThread?.interrupt()
                mediaMonitorThread = null
                mediaRunning.set(false)
                mediaChecked = null
                mediaAdded = null
                mediaRemoved = null
                mediaSkipped = false
            }
            val updates = LinkedHashMap<String, Any?>().apply {
                put("user", u)
                put("hkey", creds.hkey)
                put("endpoint", creds.endpoint)
                put("pendingServerMediaUsn", null)
                if (prevUser != null && prevUser != u) {
                    mediaCacheEpoch.incrementAndGet()
                    mediaSkipped = false
                    put("lastMediaUsn", null)
                    put("lastMediaDirMtime", null)
                    put("lastMediaDbMtime", null)
                    put("mediaComplete", false)
                }
            }
            saveState(updates)
            mediaError = null
            wasRunning
        }
        if (medWasRunning) {
            runCatching { transport.abortMedia() }
            publishMediaProgress("done")
        }
        needsFullSync = false
        lastError = null
        log.info("sync login ok for $u")
        publishState(forceNotify = true)
        return status()
    }

    fun logout(): JsonObject {
        val medWasRunning = synchronized(mediaLock) {
            val wasRunning = mediaRunning.get()
            if (wasRunning) {
                mediaAbortRequested.set(true)
                mediaRunId.incrementAndGet()
                mediaMonitorThread?.interrupt()
                mediaMonitorThread = null
                mediaRunning.set(false)
            }
            mediaCacheEpoch.incrementAndGet()
            mediaChecked = null
            mediaAdded = null
            mediaRemoved = null
            mediaError = null
            mediaSkipped = false
            saveState(
                mapOf(
                    "hkey" to null,
                    "endpoint" to null,
                    "pendingServerMediaUsn" to null,
                    "lastMediaUsn" to null,
                    "lastMediaDirMtime" to null,
                    "lastMediaDbMtime" to null,
                    "mediaLastSync" to null,
                    "mediaComplete" to false
                )
            )
            wasRunning
        }
        if (medWasRunning) {
            runCatching { transport.abortMedia() }
            publishMediaProgress("done")
        }
        needsFullSync = false
        publishState(forceNotify = true)
        return status()
    }

    /** Aborts both collection sync and background media sync cleanly. */
    fun abort(): JsonObject {
        val colWasRunning = running.get()
        val medWasRunning = cancelMediaMonitorLocked()
        if (colWasRunning) {
            abortRequested.set(true)
        }
        if (colWasRunning || medWasRunning) {
            runCatching { transport.abort() }
            log.info("sync abort requested (collection=$colWasRunning, media=$medWasRunning)")
            if (medWasRunning) {
                publishMediaProgress("done")
                publishState(forceNotify = true)
            }
        }
        return status()
    }

    /** Aborts only background media sync via `abortMediaSync`, leaving collection sync untouched. */
    fun abortMedia(): JsonObject {
        val medWasRunning = cancelMediaMonitorLocked()
        if (medWasRunning) {
            runCatching { transport.abortMedia() }
            log.info("media sync abort requested")
            publishMediaProgress("done")
            publishState(forceNotify = true)
        }
        return status()
    }

    /** Force-starts a background media sync using stored credentials and returns current status. */
    fun mediaRun(): JsonObject {
        val creds = credentials() ?: throw HostError(401, "AnkiWeb 로그인이 필요합니다.", "not-logged-in")
        startMediaSyncBackground(
            creds = creds,
            serverMediaUsn = null,
            throwOnAuthFailure = true,
            rejectIfAlreadyRunning = true
        )
        return status()
    }

    /** [mode] is "normal", "upload" or "download". */
    fun run(mode: String, forceMedia: Boolean = false): JsonObject {
        if (mode !in setOf("normal", "upload", "download")) throw HostError.badRequest("알 수 없는 동기화 방식입니다: $mode")
        var creds = credentials() ?: throw HostError(401, "AnkiWeb 로그인이 필요합니다.", "not-logged-in")
        if (!running.compareAndSet(false, true)) throw HostError(409, "이미 동기화 중입니다.", "busy")
        abortRequested.set(false)
        lastError = null
        phase = "collection"
        publishState(forceNotify = true)
        try {
            val outcome = progress.run("sync") {
                var serverMessage = ""
                var mediaUsn: Int? = null
                var didFullSync = false
                when (mode) {
                    "normal" -> {
                        val r = transport.syncCollection(creds)
                        serverMessage = r.serverMessage
                        mediaUsn = r.serverMediaUsn
                        if (r.newEndpoint != null && r.newEndpoint != creds.endpoint) {
                            creds = creds.copy(endpoint = r.newEndpoint)
                            saveState(mapOf("endpoint" to r.newEndpoint))
                        }
                        when (r.required) {
                            SyncRequired.FULL_SYNC -> {
                                needsFullSync = true
                                saveState(mapOf("pendingServerMediaUsn" to mediaUsn))
                                log.info("sync: full sync required (serverMediaUsn=$mediaUsn)")
                                return@run null
                            }
                            SyncRequired.FULL_DOWNLOAD -> {
                                didFullSync = true
                                fullDownload(creds, mediaUsn)
                            }
                            SyncRequired.FULL_UPLOAD -> {
                                didFullSync = true
                                fullUpload(creds, mediaUsn)
                            }
                            SyncRequired.NO_CHANGES, SyncRequired.NORMAL_SYNC -> Unit
                        }
                    }
                    "upload" -> {
                        didFullSync = true
                        mediaUsn = state().long("pendingServerMediaUsn")?.toInt()
                        fullUpload(creds, mediaUsn)
                    }
                    "download" -> {
                        didFullSync = true
                        mediaUsn = state().long("pendingServerMediaUsn")?.toInt()
                        fullDownload(creds, mediaUsn)
                    }
                }
                checkAbort()
                needsFullSync = false
                CollectionOutcome(serverMessage, mediaUsn, didFullSync)
            }
            if (outcome == null) {
                return jsonOf("ok" to false, "needsFullSync" to true)
            }
            val now = System.currentTimeMillis()
            saveState(mapOf("lastSync" to now, "pendingServerMediaUsn" to null))

            val mediaEnabled = prefs.bool("sync.media", true)
            var mediaSyncStarted = false
            var mediaSyncSkipped = false
            if (mediaEnabled) {
                val mediaUsn = outcome.mediaUsn
                val canCheckSkip = !forceMedia && mode == "normal" && !outcome.didFullSync &&
                    mediaUsn != null && mediaUsn > 0
                val currentFp = if (canCheckSkip) runCatching { mediaStateProbe.fingerprint() }.getOrNull() else null
                val skippedAtomically = mediaUsn != null && canCheckSkip && currentFp != null &&
                    tryFastSkipMediaLocked(mediaUsn, currentFp)
                if (skippedAtomically) {
                    mediaSyncSkipped = true
                    log.info("media sync fast-skipped (usn=${outcome.mediaUsn})")
                } else if (!forceMedia && mode == "normal" && !outcome.didFullSync && mediaRunning.get()) {
                    mediaSyncStarted = true
                    log.info("media sync already running in background")
                } else {
                    mediaSyncStarted = startMediaSyncBackground(
                        creds = creds,
                        serverMediaUsn = outcome.mediaUsn,
                        throwOnAuthFailure = false,
                        rejectIfAlreadyRunning = false
                    )
                }
            } else {
                synchronized(mediaLock) {
                    if (!mediaRunning.get()) {
                        mediaSkipped = false
                    }
                }
            }

            log.info("sync ($mode) finished (mediaStarted=$mediaSyncStarted, mediaSkipped=$mediaSyncSkipped)")
            return jsonOf(
                "ok" to true,
                "needsFullSync" to false,
                "serverMessage" to outcome.serverMessage,
                "lastSync" to now,
                "mediaSyncStarted" to mediaSyncStarted,
                "mediaSyncSkipped" to mediaSyncSkipped
            )
        } catch (e: SyncAuthFailed) {
            saveState(mapOf("hkey" to null))
            lastError = "AnkiWeb 로그인이 만료되었습니다. 다시 로그인하세요."
            log.error("sync auth failed", e)
            throw HostError(401, lastError!!, e.message, e)
        } catch (e: SyncAborted) {
            lastError = null
            log.info("sync aborted")
            throw HostError(409, "동기화를 취소했습니다.", "aborted", e)
        } catch (e: HostError) {
            lastError = e.message
            throw e
        } catch (e: Exception) {
            if (abortRequested.get()) {
                throw HostError(409, "동기화를 취소했습니다.", "aborted", e)
            }
            val err = networkError("동기화하지 못했습니다", e)
            lastError = err.message
            log.error("sync failed", e)
            throw err
        } finally {
            phase = "idle"
            running.set(false)
            publishState(forceNotify = true)
        }
    }

    private fun checkAbort() {
        if (abortRequested.get()) throw SyncAborted()
    }

    private fun fullUpload(creds: SyncCredentials, mediaUsn: Int?) {
        abortMedia()
        checkAbort()
        phase = "upload"
        publishState(forceNotify = true)
        invalidateMediaCache()
        transport.fullSync(creds, upload = true, serverMediaUsn = mediaUsn)
    }

    private fun fullDownload(creds: SyncCredentials, mediaUsn: Int?) {
        abortMedia()
        checkAbort()
        phase = "backup"
        publishState(forceNotify = true)
        progress.note("sync", "내려받기 전에 백업하는 중")
        backupBeforeDownload()
        checkAbort()
        phase = "download"
        publishState(forceNotify = true)
        invalidateMediaCache()
        transport.fullSync(creds, upload = false, serverMediaUsn = mediaUsn)
    }

    private fun tryFastSkipMediaLocked(serverMediaUsn: Int, current: MediaFingerprint): Boolean = synchronized(mediaLock) {
        if (mediaRunning.get()) return false
        val s = state()
        if (!s.bool("mediaComplete", false)) return false
        val savedUsn = s.long("lastMediaUsn")?.toInt() ?: return false
        if (savedUsn != serverMediaUsn) return false
        val savedDirMtime = s.long("lastMediaDirMtime") ?: return false
        val savedDbMtime = s.long("lastMediaDbMtime") ?: return false
        if (current.dirMtime != savedDirMtime || current.dbMtime != savedDbMtime) return false
        mediaSkipped = true
        mediaError = null
        mediaChecked = null
        mediaAdded = null
        mediaRemoved = null
        true
    }

    private fun cancelMediaMonitorLocked(): Boolean = synchronized(mediaLock) {
        val wasRunning = mediaRunning.get()
        if (wasRunning) {
            mediaAbortRequested.set(true)
            mediaRunId.incrementAndGet()
            mediaMonitorThread?.interrupt()
            mediaMonitorThread = null
            mediaRunning.set(false)
            mediaChecked = null
            mediaAdded = null
            mediaRemoved = null
            mediaError = null
            mediaSkipped = false
        }
        wasRunning
    }

    private inline fun finishMediaRun(runId: Long, update: () -> Unit = {}): Boolean = synchronized(mediaLock) {
        if (mediaRunId.get() != runId) return false
        update()
        mediaRunning.set(false)
        if (mediaMonitorThread === Thread.currentThread()) {
            mediaMonitorThread = null
        }
        true
    }

    private fun startMediaSyncBackground(
        creds: SyncCredentials,
        serverMediaUsn: Int?,
        throwOnAuthFailure: Boolean,
        rejectIfAlreadyRunning: Boolean
    ): Boolean {
        val runId: Long
        val startCacheEpoch: Long
        val prevRunning: Boolean
        synchronized(mediaLock) {
            prevRunning = mediaRunning.get()
            if (rejectIfAlreadyRunning && prevRunning) {
                throw HostError(409, "이미 미디어 동기화가 진행 중입니다.", "media-busy")
            }
            runId = mediaRunId.incrementAndGet()
            startCacheEpoch = mediaCacheEpoch.get()
            mediaMonitorThread?.interrupt()
            mediaMonitorThread = null
            mediaAbortRequested.set(false)
            mediaError = null
            mediaSkipped = false
            mediaChecked = null
            mediaAdded = null
            mediaRemoved = null
            mediaRunning.set(true)
            saveState(mapOf("mediaComplete" to false))
        }
        publishMediaProgress("start")
        publishState(forceNotify = true)

        if (prevRunning) {
            // Ensure prior Rust media sync stops cleanly before starting a forced replacement run.
            runCatching { transport.abortMedia() }
        }

        var initialNeedsStart = false
        try {
            // Start synchronously so Rust begins immediately before run() returns.
            transport.startMediaSync(creds)
        } catch (e: SyncAuthFailed) {
            val msg = "AnkiWeb 로그인이 만료되었습니다. 다시 로그인하세요."
            if (finishMediaRun(runId) {
                    saveState(mapOf("hkey" to null))
                    mediaError = msg
                }
            ) {
                log.error("media sync auth failed on start", e)
                publishMediaProgress("error", error = msg)
                publishState(forceNotify = true)
            }
            if (throwOnAuthFailure) {
                throw HostError(401, msg, e.message, e)
            }
            return false
        } catch (e: SyncAborted) {
            if (finishMediaRun(runId) { mediaError = null }) {
                log.info("media sync aborted on start")
                publishMediaProgress("done")
                publishState(forceNotify = true)
            }
            return false
        } catch (e: Exception) {
            if (mediaAbortRequested.get() || mediaRunId.get() != runId) {
                if (finishMediaRun(runId) { mediaError = null }) {
                    publishMediaProgress("done")
                    publishState(forceNotify = true)
                }
                return false
            }
            if (isTransientMediaError(e) && maxMediaRetries > 0) {
                log.warn("media sync start transient error, retrying in background: ${e.message}")
                initialNeedsStart = true
            } else {
                val msg = formatMediaError(e)
                if (finishMediaRun(runId) { mediaError = msg }) {
                    log.error("media sync start failed", e)
                    publishMediaProgress("error", error = msg)
                    publishState(forceNotify = true)
                }
                return false
            }
        }

        val monitor = Thread(
            { monitorMediaSync(runId, startCacheEpoch, creds, serverMediaUsn, initialNeedsStart) },
            "amgi-media-sync-monitor"
        ).apply { isDaemon = true }

        val shouldStart: Boolean
        val needsOrphanAbort: Boolean
        synchronized(mediaLock) {
            if (mediaRunId.get() == runId && !mediaAbortRequested.get()) {
                mediaMonitorThread = monitor
                shouldStart = true
                needsOrphanAbort = false
            } else {
                shouldStart = false
                // Cancelled by abort/logout (not superseded by a newer active run) while startMediaSync was in flight.
                needsOrphanAbort = !mediaRunning.get()
            }
        }
        if (shouldStart) {
            monitor.start()
        } else if (needsOrphanAbort) {
            runCatching { transport.abortMedia() }
        }
        return shouldStart
    }

    private fun monitorMediaSync(
        runId: Long,
        startCacheEpoch: Long,
        creds: SyncCredentials,
        serverMediaUsn: Int?,
        initialNeedsStart: Boolean
    ) {
        val deadline = System.currentTimeMillis() + MEDIA_SYNC_TIMEOUT_MS
        var retryAttempt = 0
        var needsRestart = initialNeedsStart
        var lastChecked: String? = null
        var lastAdded: String? = null
        var lastRemoved: String? = null

        while (System.currentTimeMillis() < deadline) {
            if (mediaRunId.get() != runId) return
            if (mediaAbortRequested.get()) {
                if (finishMediaRun(runId) {
                        mediaChecked = null
                        mediaAdded = null
                        mediaRemoved = null
                        mediaError = null
                    }
                ) {
                    publishMediaProgress("done")
                    publishState(forceNotify = true)
                }
                return
            }

            try {
                if (needsRestart) {
                    retryAttempt++
                    log.warn("media sync retry $retryAttempt/$maxMediaRetries")
                    if (!sleepInterruptibly(retryBackoffMillis * retryAttempt, runId)) return
                    if (mediaRunId.get() != runId) return
                    if (mediaAbortRequested.get()) continue
                    transport.startMediaSync(creds)
                    needsRestart = false
                }

                val snap = transport.mediaSyncStatus()
                if (mediaRunId.get() != runId) return

                if (!snap.active) {
                    if (mediaAbortRequested.get()) {
                        if (finishMediaRun(runId) {
                                mediaChecked = null
                                mediaAdded = null
                                mediaRemoved = null
                                mediaError = null
                            }
                        ) {
                            publishMediaProgress("done")
                            publishState(forceNotify = true)
                        }
                        return
                    }

                    // Capture post-sync mtimes AFTER Rust finishes writing/deleting local media files.
                    val postFingerprint = runCatching { mediaStateProbe.fingerprint() }.getOrNull()
                    val now = System.currentTimeMillis()
                    val finalChecked = snap.checked ?: lastChecked
                    val finalAdded = snap.added ?: lastAdded
                    val finalRemoved = snap.removed ?: lastRemoved

                    val finished = synchronized(mediaLock) {
                        if (mediaRunId.get() != runId) return@synchronized false
                        if (mediaAbortRequested.get()) {
                            mediaChecked = null
                            mediaAdded = null
                            mediaRemoved = null
                            mediaError = null
                            mediaRunning.set(false)
                            if (mediaMonitorThread === Thread.currentThread()) mediaMonitorThread = null
                            return@synchronized true
                        }
                        mediaChecked = finalChecked
                        mediaAdded = finalAdded
                        mediaRemoved = finalRemoved
                        mediaError = null
                        mediaSkipped = false
                        // Persist cache BEFORE clearing mediaRunning so callers observing mediaRunning == false see durable state.
                        if (mediaCacheEpoch.get() == startCacheEpoch) {
                            val updates = LinkedHashMap<String, Any?>()
                            updates["mediaLastSync"] = now
                            updates["mediaComplete"] = true
                            if (serverMediaUsn != null && serverMediaUsn > 0) {
                                updates["lastMediaUsn"] = serverMediaUsn
                            }
                            if (postFingerprint != null) {
                                updates["lastMediaDirMtime"] = postFingerprint.dirMtime
                                updates["lastMediaDbMtime"] = postFingerprint.dbMtime
                            }
                            saveState(updates)
                        }
                        mediaRunning.set(false)
                        if (mediaMonitorThread === Thread.currentThread()) {
                            mediaMonitorThread = null
                        }
                        true
                    }
                    if (!finished) return

                    log.info("media sync finished (usn=$serverMediaUsn)")
                    publishMediaProgress("done", finalChecked, finalAdded, finalRemoved)
                    publishState(forceNotify = true)
                    return
                }

                val changed = snap.checked != lastChecked || snap.added != lastAdded || snap.removed != lastRemoved
                if (changed) {
                    lastChecked = snap.checked
                    lastAdded = snap.added
                    lastRemoved = snap.removed
                    synchronized(mediaLock) {
                        if (mediaRunId.get() != runId) return
                        mediaChecked = snap.checked
                        mediaAdded = snap.added
                        mediaRemoved = snap.removed
                    }
                    publishMediaProgress("running", snap.checked, snap.added, snap.removed)
                    publishState(forceNotify = false)
                }

                if (!sleepInterruptibly(mediaPollMillis, runId)) return
            } catch (e: SyncAuthFailed) {
                val msg = "AnkiWeb 로그인이 만료되었습니다. 다시 로그인하세요."
                if (finishMediaRun(runId) {
                        saveState(mapOf("hkey" to null))
                        mediaError = msg
                    }
                ) {
                    log.error("media sync auth failed", e)
                    publishMediaProgress("error", error = msg)
                    publishState(forceNotify = true)
                }
                return
            } catch (e: SyncAborted) {
                if (mediaRunId.get() != runId) return
                if (finishMediaRun(runId) {
                        mediaChecked = null
                        mediaAdded = null
                        mediaRemoved = null
                        mediaError = null
                    }
                ) {
                    log.info("media sync aborted")
                    publishMediaProgress("done")
                    publishState(forceNotify = true)
                }
                return
            } catch (e: Exception) {
                if (mediaRunId.get() != runId) return
                if (mediaAbortRequested.get()) {
                    if (finishMediaRun(runId) {
                            mediaChecked = null
                            mediaAdded = null
                            mediaRemoved = null
                            mediaError = null
                        }
                    ) {
                        log.info("media sync aborted")
                        publishMediaProgress("done")
                        publishState(forceNotify = true)
                    }
                    return
                }
                if (isTransientMediaError(e) && retryAttempt < maxMediaRetries) {
                    log.warn("media sync transient error (${retryAttempt + 1}/$maxMediaRetries): ${e.message}")
                    needsRestart = true
                    continue
                }
                val msg = formatMediaError(e)
                if (finishMediaRun(runId) { mediaError = msg }) {
                    log.error("media sync failed", e)
                    publishMediaProgress("error", error = msg)
                    publishState(forceNotify = true)
                }
                return
            }
        }

        if (mediaRunId.get() != runId) return
        val timeoutMsg = "미디어 동기화 시간이 초과되었습니다."
        if (finishMediaRun(runId) { mediaError = timeoutMsg }) {
            log.error("media sync timed out")
            publishMediaProgress("error", error = timeoutMsg)
            publishState(forceNotify = true)
        }
    }

    private fun sleepInterruptibly(millis: Long, runId: Long): Boolean {
        if (millis <= 0L) return mediaRunId.get() == runId
        return try {
            Thread.sleep(millis)
            mediaRunId.get() == runId
        } catch (_: InterruptedException) {
            mediaRunId.get() == runId
        }
    }

    private fun isTransientMediaError(e: Throwable): Boolean {
        val visited = Collections.newSetFromMap(IdentityHashMap<Throwable, Boolean>())
        var cur: Throwable? = e
        var depth = 0
        while (cur != null && depth < 32 && visited.add(cur)) {
            if (
                cur is BackendNetworkException ||
                cur is IOException ||
                (cur is BackendSyncException && cur !is BackendSyncException.BackendSyncAuthFailedException)
            ) {
                return true
            }
            cur = cur.cause
            depth++
        }
        return false
    }

    private fun formatMediaError(e: Exception): String {
        val detail = e.message ?: e.toString()
        return if (e is BackendNetworkException) {
            "미디어 동기화 실패: 네트워크에 연결할 수 없습니다."
        } else {
            "미디어 동기화 실패: $detail"
        }
    }

    private fun networkError(prefix: String, e: Exception): HostError {
        val detail = e.message ?: e.toString()
        val msg = if (e is BackendNetworkException) "$prefix: 네트워크에 연결할 수 없습니다." else "$prefix: $detail"
        return HostError(502, msg, HostLog.stackOf(e), e)
    }

    companion object {
        private const val MEDIA_SYNC_TIMEOUT_MS = 6L * 60L * 60L * 1000L
    }
}
