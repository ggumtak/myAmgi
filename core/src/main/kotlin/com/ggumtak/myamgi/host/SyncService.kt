package com.ggumtak.myamgi.host

import anki.sync.SyncAuth
import anki.sync.SyncCollectionResponse
import com.ggumtak.myamgi.engine.AnkiEngine
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import net.ankiweb.rsdroid.exceptions.BackendInterruptedException
import net.ankiweb.rsdroid.exceptions.BackendNetworkException
import net.ankiweb.rsdroid.exceptions.BackendSyncException
import java.io.File
import java.util.concurrent.atomic.AtomicBoolean

/** What a normal (incremental) collection sync told us. */
enum class SyncRequired { NO_CHANGES, NORMAL_SYNC, FULL_SYNC, FULL_DOWNLOAD, FULL_UPLOAD }

data class SyncCredentials(val hkey: String, val endpoint: String?)

data class CollectionSyncResult(
    val required: SyncRequired,
    val serverMessage: String = "",
    val newEndpoint: String? = null,
    val serverMediaUsn: Int? = null
)

class SyncAuthFailed(message: String, cause: Throwable? = null) : Exception(message, cause)

class SyncAborted(cause: Throwable? = null) : Exception("aborted", cause)

/** The network part of AnkiWeb sync, behind an interface so the state handling can be unit-tested. */
interface SyncTransport {
    fun login(user: String, password: String, endpoint: String?): SyncCredentials
    fun syncCollection(creds: SyncCredentials): CollectionSyncResult
    fun fullSync(creds: SyncCredentials, upload: Boolean, serverMediaUsn: Int?)
    fun startMediaSync(creds: SyncCredentials)
    fun mediaSyncActive(): Boolean
    fun abort()

    /** What a sync would do now, without changing anything (may contact the server). */
    fun syncStatus(creds: SyncCredentials): SyncRequired = SyncRequired.NO_CHANGES
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

    override fun mediaSyncActive(): Boolean = AnkiEngine.mediaSyncStatus()?.active ?: false

    override fun abort() = AnkiEngine.abortAll()

    override fun syncStatus(creds: SyncCredentials): SyncRequired = mapped {
        when (AnkiEngine.ankiWebSyncStatus(auth(creds)).required) {
            anki.sync.SyncStatusResponse.Required.NO_CHANGES -> SyncRequired.NO_CHANGES
            anki.sync.SyncStatusResponse.Required.FULL_SYNC -> SyncRequired.FULL_SYNC
            else -> SyncRequired.NORMAL_SYNC
        }
    }
}

/**
 * AnkiWeb sync state and orchestration. Login state (user, hkey, endpoint, last sync) lives in
 * [stateFile]. Runs one sync at a time; progress and state changes go out as events.
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
    private val mediaPollMillis: Long = 300
) {
    private val running = AtomicBoolean(false)
    private val abortRequested = AtomicBoolean(false)

    @Volatile
    private var needsFullSync = false

    @Volatile
    private var lastError: String? = null

    @Volatile
    private var phase: String = "idle"

    private val stateLock = Any()

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
            "lastError" to lastError
        )
    }

    private fun publishState() = events.publish("sync-state", status())

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
        saveState(mapOf("user" to u, "hkey" to creds.hkey, "endpoint" to creds.endpoint))
        needsFullSync = false
        lastError = null
        log.info("sync login ok for $u")
        publishState()
        return status()
    }

    /**
     * `sync.check`: `{loggedIn, required: "none"|"normal"|"full"}` for the sync button's "needs sync"
     * dot. Local changes answer without network; otherwise the backend asks the server (cached briefly).
     */
    fun check(): JsonObject {
        val creds = credentials() ?: return jsonOf("loggedIn" to false, "required" to "none")
        if (running.get()) return jsonOf("loggedIn" to true, "required" to "none")
        val required = try {
            transport.syncStatus(creds)
        } catch (e: SyncAuthFailed) {
            throw HostError(401, "AnkiWeb 로그인이 만료되었습니다. 다시 로그인하세요.", e.message, e)
        } catch (e: Exception) {
            throw networkError("동기화 상태를 확인하지 못했습니다", e)
        }
        val name = when (required) {
            SyncRequired.NO_CHANGES -> "none"
            SyncRequired.FULL_SYNC, SyncRequired.FULL_DOWNLOAD, SyncRequired.FULL_UPLOAD -> "full"
            SyncRequired.NORMAL_SYNC -> "normal"
        }
        return jsonOf("loggedIn" to true, "required" to name)
    }

    fun logout(): JsonObject {
        saveState(mapOf("hkey" to null, "endpoint" to null))
        needsFullSync = false
        lastError = null
        publishState()
        return status()
    }

    fun abort(): JsonObject {
        if (running.get()) {
            abortRequested.set(true)
            runCatching { transport.abort() }
            log.info("sync abort requested")
        }
        return status()
    }

    /** [mode] is "normal", "upload" or "download". */
    fun run(mode: String): JsonObject {
        if (mode !in setOf("normal", "upload", "download")) throw HostError.badRequest("알 수 없는 동기화 방식입니다: $mode")
        var creds = credentials() ?: throw HostError(401, "AnkiWeb 로그인이 필요합니다.", "not-logged-in")
        if (!running.compareAndSet(false, true)) throw HostError(409, "이미 동기화 중입니다.", "busy")
        abortRequested.set(false)
        lastError = null
        phase = "collection"
        publishState()
        try {
            val message = progress.run("sync") {
                var serverMessage = ""
                var mediaUsn: Int? = null
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
                                log.info("sync: full sync required")
                                return@run null
                            }
                            SyncRequired.FULL_DOWNLOAD -> fullDownload(creds, mediaUsn)
                            SyncRequired.FULL_UPLOAD -> fullUpload(creds, mediaUsn)
                            SyncRequired.NO_CHANGES, SyncRequired.NORMAL_SYNC -> Unit
                        }
                    }
                    "upload" -> fullUpload(creds, null)
                    "download" -> fullDownload(creds, null)
                }
                checkAbort()
                needsFullSync = false
                if (prefs.bool("sync.media", true)) syncMedia(creds)
                serverMessage
            }
            if (message == null) {
                return jsonOf("ok" to false, "needsFullSync" to true)
            }
            val now = System.currentTimeMillis()
            saveState(mapOf("lastSync" to now))
            log.info("sync ($mode) finished")
            return jsonOf("ok" to true, "needsFullSync" to false, "serverMessage" to message, "lastSync" to now)
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
            publishState()
        }
    }

    private fun checkAbort() {
        if (abortRequested.get()) throw SyncAborted()
    }

    private fun fullUpload(creds: SyncCredentials, mediaUsn: Int?) {
        checkAbort()
        phase = "upload"
        publishState()
        transport.fullSync(creds, upload = true, serverMediaUsn = mediaUsn)
    }

    private fun fullDownload(creds: SyncCredentials, mediaUsn: Int?) {
        checkAbort()
        phase = "backup"
        publishState()
        progress.note("sync", "내려받기 전에 백업하는 중")
        backupBeforeDownload()
        checkAbort()
        phase = "download"
        publishState()
        transport.fullSync(creds, upload = false, serverMediaUsn = mediaUsn)
    }

    private fun syncMedia(creds: SyncCredentials) {
        phase = "media"
        publishState()
        transport.startMediaSync(creds)
        // The backend syncs media in the background; wait for it so "done" means done.
        val deadline = System.currentTimeMillis() + 6 * 60 * 60 * 1000L
        while (transport.mediaSyncActive() && System.currentTimeMillis() < deadline) {
            if (abortRequested.get()) {
                runCatching { transport.abort() }
                throw SyncAborted()
            }
            Thread.sleep(mediaPollMillis)
        }
    }

    private fun networkError(prefix: String, e: Exception): HostError {
        val detail = e.message ?: e.toString()
        val msg = if (e is BackendNetworkException) "$prefix: 네트워크에 연결할 수 없습니다." else "$prefix: $detail"
        return HostError(502, msg, HostLog.stackOf(e), e)
    }
}
