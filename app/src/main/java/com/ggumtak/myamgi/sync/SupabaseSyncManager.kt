package com.ggumtak.myamgi.sync

import android.content.Context
import android.webkit.MimeTypeMap
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.prefs.AppPrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.delay
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.sync.withPermit
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.URLEncoder
import java.security.MessageDigest
import java.time.Instant
import java.time.OffsetDateTime
import java.util.Locale
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

data class SyncSummary(
    val settingsSynced: Boolean,
    val collectionSynced: Boolean,
    val uploadedMedia: Int,
    val downloadedMedia: Int,
    val skippedMedia: Int,
    val message: String
)

/**
 * Primary zero-cost Supabase sync manager for 5-device synchronization:
 * - Auth (`/auth/v1/...`) & 1-second `MYAMGI1:` pairing code
 * - User settings (`amgi_user_settings`: `two_button_mode`, `night_mode`)
 * - Collection snapshot (`amgi_collections` + `amgi-media/{uid}/collection_snapshot.colpkg`)
 * - Lightweight deck/note metadata (`amgi_sync_items`) for PC Web PWA interop
 * - High-speed resumable parallel media sync (`amgi_media_manifest` + `amgi-media` Storage)
 */
object SupabaseSyncManager {
    private const val SNAPSHOT_STORAGE_NAME = "collection_snapshot.colpkg"
    private const val HASH_CACHE_FILE = "media_hash_cache.json"
    private const val CHECKPOINT_FILE = "media_sync_checkpoint.json"
    private const val PREF_COL_SNAPSHOT_SHA = "sb_col_snapshot_sha"
    private const val PREF_COL_SNAPSHOT_MS = "sb_col_snapshot_ms"

    private val JSON_MEDIA_TYPE = "application/json; charset=utf-8".toMediaType()
    private val OCTET_MEDIA_TYPE = "application/octet-stream".toMediaType()

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    suspend fun signIn(
        context: Context,
        url: String,
        anonKey: String,
        email: String,
        password: String
    ): Result<String> = withContext(Dispatchers.IO) {
        val app = context.applicationContext
        val cleanUrl = normalizeUrl(url)
        val cleanKey = anonKey.trim()
        val cleanEmail = email.trim()
        if (cleanUrl.isBlank() || cleanKey.isBlank() || cleanEmail.isBlank() || password.isEmpty()) {
            return@withContext Result.failure(IllegalArgumentException("Supabase URL, Anon Key, 이메일, 비밀번호를 모두 입력하세요."))
        }
        runCatching {
            val payload = JSONObject().apply {
                put("email", cleanEmail)
                put("password", password)
            }
            val req = Request.Builder()
                .url("$cleanUrl/auth/v1/token?grant_type=password")
                .header("apikey", cleanKey)
                .header("Content-Type", "application/json")
                .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
                .build()

            val bodyStr = executeForBody(req, "Supabase 로그인 실패")
            val json = JSONObject(bodyStr)
            saveAuthJson(app, cleanUrl, cleanKey, cleanEmail, json)
            "로그인 성공 (${AppPrefs.getSupabaseEmail(app)})"
        }
    }

    suspend fun signUp(
        context: Context,
        url: String,
        anonKey: String,
        email: String,
        password: String
    ): Result<String> = withContext(Dispatchers.IO) {
        val app = context.applicationContext
        val cleanUrl = normalizeUrl(url)
        val cleanKey = anonKey.trim()
        val cleanEmail = email.trim()
        if (cleanUrl.isBlank() || cleanKey.isBlank() || cleanEmail.isBlank() || password.length < 6) {
            return@withContext Result.failure(IllegalArgumentException("올바른 URL, Key, 이메일과 6자 이상의 비밀번호를 입력하세요."))
        }
        runCatching {
            val payload = JSONObject().apply {
                put("email", cleanEmail)
                put("password", password)
            }
            val req = Request.Builder()
                .url("$cleanUrl/auth/v1/signup")
                .header("apikey", cleanKey)
                .header("Content-Type", "application/json")
                .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
                .build()

            val bodyStr = executeForBody(req, "Supabase 회원가입 실패")
            val json = JSONObject(bodyStr)
            val accessToken = json.optString("access_token", "")
            val refreshToken = json.optString("refresh_token", "")
            if (accessToken.isNotBlank() && refreshToken.isNotBlank()) {
                saveAuthJson(app, cleanUrl, cleanKey, cleanEmail, json)
                "회원가입 및 로그인 완료 ($cleanEmail)"
            } else {
                AppPrefs.saveSupabaseSession(app, cleanUrl, cleanKey, cleanEmail, "", "", "")
                "회원가입 요청 완료. 이메일 인증 후 로그인하세요."
            }
        }
    }

    suspend fun refreshSession(context: Context): Result<String> = withContext(Dispatchers.IO) {
        val app = context.applicationContext
        val url = normalizeUrl(AppPrefs.getSupabaseUrl(app))
        val anonKey = AppPrefs.getSupabaseAnonKey(app).trim()
        val refreshToken = AppPrefs.getSupabaseRefreshToken(app).trim()
        val email = AppPrefs.getSupabaseEmail(app).trim()

        if (url.isBlank() || anonKey.isBlank() || refreshToken.isBlank()) {
            return@withContext Result.failure(IllegalStateException("저장된 Supabase 세션 정보가 없습니다."))
        }

        runCatching {
            val payload = JSONObject().apply {
                put("refresh_token", refreshToken)
            }
            val req = Request.Builder()
                .url("$url/auth/v1/token?grant_type=refresh_token")
                .header("apikey", anonKey)
                .header("Content-Type", "application/json")
                .post(payload.toString().toRequestBody(JSON_MEDIA_TYPE))
                .build()

            val bodyStr = executeForBody(req, "Supabase 토큰 갱신 실패")
            val json = JSONObject(bodyStr)
            saveAuthJson(app, url, anonKey, email, json)
            AppPrefs.getSupabaseAccessToken(app)
        }
    }

    suspend fun linkWithCode(context: Context, code: String): Result<String> = withContext(Dispatchers.IO) {
        val app = context.applicationContext
        val payload = SyncCode.decode(code)
            ?: return@withContext Result.failure(IllegalArgumentException("유효하지 않은 기기 연동 코드입니다."))

        AppPrefs.saveSupabaseSession(
            context = app,
            url = payload.url,
            anonKey = payload.anonKey,
            email = payload.email,
            accessToken = payload.accessToken,
            refreshToken = payload.refreshToken,
            userId = ""
        )

        val refreshed = refreshSession(app)
        if (refreshed.isSuccess) {
            Result.success("기기 연동 완료 (${AppPrefs.getSupabaseEmail(app)})")
        } else {
            // Fallback: if accessToken was included and refresh failed, try fetching /auth/v1/user
            if (payload.accessToken.isNotBlank()) {
                val userRes = runCatching {
                    fetchCurrentUser(payload.url, payload.anonKey, payload.accessToken)
                }
                if (userRes.isSuccess) {
                    val (uid, resolvedEmail) = userRes.getOrThrow()
                    AppPrefs.saveSupabaseSession(
                        context = app,
                        url = payload.url,
                        anonKey = payload.anonKey,
                        email = resolvedEmail.ifBlank { payload.email },
                        accessToken = payload.accessToken,
                        refreshToken = payload.refreshToken,
                        userId = uid
                    )
                    return@withContext Result.success("기기 연동 완료 (${AppPrefs.getSupabaseEmail(app)})")
                }
            }
            AppPrefs.clearSupabaseSession(app)
            Result.failure(refreshed.exceptionOrNull() ?: IllegalStateException("연동 코드 토큰 검증에 실패했습니다."))
        }
    }

    fun generateSyncCode(context: Context): String? {
        val app = context.applicationContext
        val url = AppPrefs.getSupabaseUrl(app)
        val anonKey = AppPrefs.getSupabaseAnonKey(app)
        val email = AppPrefs.getSupabaseEmail(app)
        val refreshToken = AppPrefs.getSupabaseRefreshToken(app)
        val accessToken = AppPrefs.getSupabaseAccessToken(app)
        if (url.isBlank() || anonKey.isBlank() || refreshToken.isBlank()) return null
        return SyncCode.encode(
            SyncCodePayload(
                url = url,
                anonKey = anonKey,
                email = email,
                refreshToken = refreshToken,
                accessToken = accessToken
            )
        )
    }

    suspend fun syncAll(
        context: Context,
        onProgress: (String) -> Unit = {}
    ): Result<SyncSummary> = withContext(Dispatchers.IO) {
        val app = context.applicationContext
        runCatching {
            onProgress("Supabase 세션 확인 중...")
            val session = ensureValidSession(app)

            onProgress("사용자 설정 동기화 중...")
            val settingsSynced = syncUserSettings(app, session)

            onProgress("컬렉션 스냅샷 동기화 중...")
            val collectionSynced = syncCollectionSnapshot(app, session, onProgress)

            onProgress("웹 호환 요약 항목 동기화 중...")
            runCatching { pushSyncItemSummary(session) }

            onProgress("미디어 파일 병렬 동기화 중...")
            val mediaStats = syncMediaParallel(app, session, onProgress)

            val now = System.currentTimeMillis()
            AppPrefs.setLastSyncTime(app, now)

            val summaryMsg = buildString {
                append("동기화 완료 (")
                append(if (collectionSynced) "컬렉션 갱신" else "컬렉션 최신")
                append(", 미디어 ↑${mediaStats.uploaded} ↓${mediaStats.downloaded} ↷${mediaStats.skipped})")
            }

            SyncSummary(
                settingsSynced = settingsSynced,
                collectionSynced = collectionSynced,
                uploadedMedia = mediaStats.uploaded,
                downloadedMedia = mediaStats.downloaded,
                skippedMedia = mediaStats.skipped,
                message = summaryMsg
            )
        }
    }

    // --- Session Helpers ---

    private data class Session(
        val url: String,
        val anonKey: String,
        val accessToken: String,
        val userId: String,
        val email: String
    )

    private suspend fun ensureValidSession(app: Context): Session {
        val refreshResult = refreshSession(app)
        if (refreshResult.isFailure && AppPrefs.getSupabaseAccessToken(app).isBlank()) {
            throw (refreshResult.exceptionOrNull() ?: IllegalStateException("Supabase 로그인이 필요합니다."))
        }

        val url = normalizeUrl(AppPrefs.getSupabaseUrl(app))
        val anonKey = AppPrefs.getSupabaseAnonKey(app).trim()
        val accessToken = AppPrefs.getSupabaseAccessToken(app).trim()
        var userId = AppPrefs.getSupabaseUserId(app).trim()
        var email = AppPrefs.getSupabaseEmail(app).trim()

        if (url.isBlank() || anonKey.isBlank() || accessToken.isBlank()) {
            throw IllegalStateException("Supabase 인증 정보가 불완전합니다.")
        }

        if (userId.isBlank()) {
            val (resolvedUid, resolvedEmail) = fetchCurrentUser(url, anonKey, accessToken)
            userId = resolvedUid
            if (resolvedEmail.isNotBlank()) email = resolvedEmail
            AppPrefs.saveSupabaseSession(
                context = app,
                url = url,
                anonKey = anonKey,
                email = email,
                accessToken = accessToken,
                refreshToken = AppPrefs.getSupabaseRefreshToken(app),
                userId = userId
            )
        }

        return Session(url = url, anonKey = anonKey, accessToken = accessToken, userId = userId, email = email)
    }

    private fun saveAuthJson(
        app: Context,
        url: String,
        anonKey: String,
        fallbackEmail: String,
        json: JSONObject
    ) {
        val accessToken = json.optString("access_token", "")
        val refreshToken = json.optString("refresh_token", "")
        val userObj = json.optJSONObject("user")
        val userId = userObj?.optString("id", "")?.takeIf { it.isNotBlank() }
            ?: AppPrefs.getSupabaseUserId(app)
        val email = userObj?.optString("email", "")?.takeIf { it.isNotBlank() }
            ?: fallbackEmail

        if (accessToken.isBlank()) {
            throw IllegalStateException("응답에 access_token이 없습니다.")
        }
        AppPrefs.saveSupabaseSession(
            context = app,
            url = url,
            anonKey = anonKey,
            email = email,
            accessToken = accessToken,
            refreshToken = refreshToken.ifBlank { AppPrefs.getSupabaseRefreshToken(app) },
            userId = userId
        )
    }

    private fun fetchCurrentUser(url: String, anonKey: String, accessToken: String): Pair<String, String> {
        val req = Request.Builder()
            .url("$url/auth/v1/user")
            .header("apikey", anonKey)
            .header("Authorization", "Bearer $accessToken")
            .get()
            .build()
        val bodyStr = executeForBody(req, "사용자 정보 조회 실패")
        val json = JSONObject(bodyStr)
        val id = json.optString("id", "")
        if (id.isBlank()) throw IllegalStateException("사용자 ID를 확인할 수 없습니다.")
        return id to json.optString("email", "")
    }

    // --- 2) User Settings Sync ---

    private suspend fun syncUserSettings(app: Context, session: Session): Boolean {
        val query = "user_id=eq.${urlEncode(session.userId)}&select=two_button_mode,night_mode,updated_at"
        val remoteRows = restGetArray(session, "amgi_user_settings", query)
        val localUpdatedMs = AppPrefs.getLastSyncTime(app)

        if (remoteRows.length() > 0) {
            val row = remoteRows.getJSONObject(0)
            val remoteUpdatedMs = parseIsoTimestampMs(row.optString("updated_at", ""))
            if (remoteUpdatedMs > localUpdatedMs || localUpdatedMs == 0L) {
                if (row.has("two_button_mode") && !row.isNull("two_button_mode")) {
                    AppPrefs.setTwoButtonMode(app, row.getBoolean("two_button_mode"))
                }
                val nightMode = row.optString("night_mode", "")
                if (nightMode in setOf(AppPrefs.THEME_AUTO, AppPrefs.THEME_LIGHT, AppPrefs.THEME_DARK, AppPrefs.THEME_EINK)) {
                    AppPrefs.setThemeMode(app, nightMode)
                }
            }
        }

        val upsertBody = JSONArray().put(
            JSONObject().apply {
                put("user_id", session.userId)
                put("two_button_mode", AppPrefs.isTwoButtonMode(app))
                put("night_mode", AppPrefs.getThemeMode(app))
                put("updated_at", Instant.now().toString())
            }
        )
        restUpsert(session, "amgi_user_settings", upsertBody, "user_id")
        return true
    }

    // --- 3) Collection Snapshot Sync ---

    private suspend fun syncCollectionSnapshot(
        app: Context,
        session: Session,
        onProgress: (String) -> Unit
    ): Boolean {
        val syncPrefs = app.getSharedPreferences("myamgi_sync_meta", Context.MODE_PRIVATE)
        val tempColpkg = File(app.cacheDir, "sync_export_snapshot.colpkg")
        val downloadColpkg = File(app.cacheDir, "sync_download_snapshot.colpkg")

        try {
            val remoteRows = restGetArray(
                session,
                "amgi_collections",
                "user_id=eq.${urlEncode(session.userId)}&select=snapshot_path,snapshot_sha256,snapshot_size,updated_at,device_name"
            )

            val remoteRow = if (remoteRows.length() > 0) remoteRows.getJSONObject(0) else null
            val remoteSha = remoteRow?.optString("snapshot_sha256", "")?.trim()?.lowercase() ?: ""
            val remotePath = remoteRow?.optString("snapshot_path", "")?.trim()
                ?.ifBlank { "${session.userId}/$SNAPSHOT_STORAGE_NAME" }
                ?: "${session.userId}/$SNAPSHOT_STORAGE_NAME"
            val remoteUpdatedMs = parseIsoTimestampMs(remoteRow?.optString("updated_at", "") ?: "")

            val localCollectionFile = AnkiEngine.getCollectionFile()
            val localModMs = if (localCollectionFile.exists()) localCollectionFile.lastModified() else 0L
            val lastKnownRemoteSha = syncPrefs.getString(PREF_COL_SNAPSHOT_SHA, "") ?: ""

            // Export local collection (without media) to inspect hash & prepare upload if needed
            if (tempColpkg.exists()) tempColpkg.delete()
            AnkiEngine.exportColpkg(tempColpkg.absolutePath, includeMedia = false)
            val localSha = sha256FileHex(tempColpkg)

            if (remoteSha.isNotBlank() && remoteSha == localSha) {
                syncPrefs.edit()
                    .putString(PREF_COL_SNAPSHOT_SHA, remoteSha)
                    .putLong(PREF_COL_SNAPSHOT_MS, remoteUpdatedMs)
                    .apply()
                return false
            }

            // Decide direction: newer wins; if local hasn't changed since last synced remote sha and remote changed, pull remote
            val shouldDownloadRemote = remoteSha.isNotBlank() &&
                (remoteUpdatedMs > localModMs || (lastKnownRemoteSha.isNotBlank() && remoteSha != lastKnownRemoteSha && localModMs <= AppPrefs.getLastSyncTime(app)))

            if (shouldDownloadRemote) {
                onProgress("원격 컬렉션 스냅샷 다운로드 중...")
                if (downloadColpkg.exists()) downloadColpkg.delete()
                withRetry {
                    downloadStorageObject(session, remotePath, downloadColpkg)
                }
                val downloadedSha = sha256FileHex(downloadColpkg)
                if (!downloadedSha.equals(remoteSha, ignoreCase = true)) {
                    throw IllegalStateException("다운로드된 컬렉션 스냅샷의 SHA-256 검증 실패")
                }
                onProgress("컬렉션 스냅샷 적용 중...")
                AnkiEngine.importColpkg(downloadColpkg.absolutePath)
                syncPrefs.edit()
                    .putString(PREF_COL_SNAPSHOT_SHA, remoteSha)
                    .putLong(PREF_COL_SNAPSHOT_MS, remoteUpdatedMs)
                    .apply()
                return true
            }

            // Otherwise upload local snapshot
            onProgress("로컬 컬렉션 스냅샷 업로드 중...")
            val objectPath = "${session.userId}/$SNAPSHOT_STORAGE_NAME"
            withRetry {
                uploadStorageFile(session, objectPath, tempColpkg, "application/zip")
            }

            val nowIso = Instant.now().toString()
            val deviceName = DeviceProfile.current(app).let { "${it.flavorLabel} (${it.detectedHardware})" }
            val metaRow = JSONArray().put(
                JSONObject().apply {
                    put("user_id", session.userId)
                    put("snapshot_path", objectPath)
                    put("snapshot_sha256", localSha)
                    put("snapshot_size", tempColpkg.length())
                    put("updated_at", nowIso)
                    put("device_name", deviceName)
                }
            )
            restUpsert(session, "amgi_collections", metaRow, "user_id")
            syncPrefs.edit()
                .putString(PREF_COL_SNAPSHOT_SHA, localSha)
                .putLong(PREF_COL_SNAPSHOT_MS, System.currentTimeMillis())
                .apply()
            return true
        } finally {
            tempColpkg.delete()
            downloadColpkg.delete()
        }
    }

    private suspend fun pushSyncItemSummary(session: Session) {
        val nowIso = Instant.now().toString()
        val rows = JSONArray()

        val decks = AnkiEngine.getDeckNames()
        for (d in decks) {
            val payload = JSONObject().apply {
                put("id", d.id)
                put("name", d.name)
                put("collapsed", false)
                put("newPerDay", 20)
                put("revPerDay", 200)
                put("fsrsEnabled", true)
                put("desiredRetention", 0.9)
            }
            rows.put(
                JSONObject().apply {
                    put("user_id", session.userId)
                    put("kind", "deck")
                    put("item_id", d.id.toString())
                    put("payload", payload)
                    put("deleted", false)
                    put("updated_at", nowIso)
                }
            )
        }

        val notetypes = AnkiEngine.getNotetypeNames()
        for (ntMeta in notetypes) {
            val nt = runCatching { AnkiEngine.getNotetype(ntMeta.id) }.getOrNull() ?: continue
            val fieldsArr = JSONArray().apply {
                nt.fieldsList.forEach { put(it.name) }
            }
            val templatesArr = JSONArray().apply {
                nt.templatesList.forEachIndexed { idx, tpl ->
                    put(
                        JSONObject().apply {
                            put("ord", idx)
                            put("name", tpl.name)
                            put("qfmt", tpl.config.qFormat)
                            put("afmt", tpl.config.aFormat)
                        }
                    )
                }
            }
            val payload = JSONObject().apply {
                put("id", nt.id)
                put("name", nt.name)
                put("fields", fieldsArr)
                put("templates", templatesArr)
                put("css", nt.config.css)
                put("kind", nt.config.kindValue)
            }
            rows.put(
                JSONObject().apply {
                    put("user_id", session.userId)
                    put("kind", "notetype")
                    put("item_id", nt.id.toString())
                    put("payload", payload)
                    put("deleted", false)
                    put("updated_at", nowIso)
                }
            )
        }

        // Push lightweight note summaries (capped to keep REST payload fast)
        val noteIds = AnkiEngine.searchNotes("").take(500)
        for (nid in noteIds) {
            val note = runCatching { AnkiEngine.getNote(nid) }.getOrNull() ?: continue
            val fldsArr = JSONArray().apply { note.fieldsList.forEach { put(it) } }
            val tagsArr = JSONArray().apply { note.tagsList.forEach { put(it) } }
            val payload = JSONObject().apply {
                put("id", note.id)
                put("guid", note.guid)
                put("mid", note.notetypeId)
                put("flds", fldsArr)
                put("tags", tagsArr)
                put("mod", note.mtimeSecs)
            }
            rows.put(
                JSONObject().apply {
                    put("user_id", session.userId)
                    put("kind", "note")
                    put("item_id", note.id.toString())
                    put("payload", payload)
                    put("deleted", false)
                    put("updated_at", nowIso)
                }
            )
        }

        if (rows.length() > 0) {
            restUpsertChunked(session, "amgi_sync_items", rows, "user_id,kind,item_id", chunkSize = 150)
        }
    }

    // --- 4) High-Speed Resumable Parallel Media Sync ---

    private data class CachedHashEntry(
        val mtime: Long,
        val size: Long,
        val sha256: String
    )

    private data class RemoteMediaEntry(
        val filename: String,
        val sha256: String,
        val sizeBytes: Long,
        val mimeType: String,
        val deleted: Boolean
    )

    private data class MediaSyncStats(
        val uploaded: Int,
        val downloaded: Int,
        val skipped: Int
    )

    private suspend fun syncMediaParallel(
        app: Context,
        session: Session,
        onProgress: (String) -> Unit
    ): MediaSyncStats {
        val mediaDir = AnkiEngine.getMediaDir()
        val cacheFile = File(app.filesDir, HASH_CACHE_FILE)
        val checkpointFile = File(app.filesDir, CHECKPOINT_FILE)

        val hashCache = loadHashCache(cacheFile)
        val checkpoint = loadCheckpoint(checkpointFile)
        val cacheMutex = Mutex()
        val checkpointMutex = Mutex()

        val localFiles = mediaDir.listFiles()
            ?.filter { it.isFile && !it.name.endsWith(".part") && it.name != ".DS_Store" }
            ?: emptyList()

        // Build local filename -> (file, sha256) using disk hash cache
        val localByName = HashMap<String, Pair<File, String>>(localFiles.size)
        val updatedCache = HashMap<String, CachedHashEntry>(localFiles.size)

        for (file in localFiles) {
            val name = file.name
            val mtime = file.lastModified()
            val size = file.length()
            val cached = hashCache[name]
            val sha = if (cached != null && cached.mtime == mtime && cached.size == size && cached.sha256.isNotBlank()) {
                cached.sha256
            } else {
                sha256FileHex(file)
            }
            updatedCache[name] = CachedHashEntry(mtime = mtime, size = size, sha256 = sha)
            localByName[name] = file to sha
        }
        saveHashCache(cacheFile, updatedCache)

        // Fetch remote media manifest
        val remoteRows = restGetArray(
            session,
            "amgi_media_manifest",
            "user_id=eq.${urlEncode(session.userId)}&select=filename,sha256,size_bytes,mime_type,deleted"
        )
        val remoteByName = HashMap<String, RemoteMediaEntry>(remoteRows.length())
        for (i in 0 until remoteRows.length()) {
            val obj = remoteRows.getJSONObject(i)
            val filename = obj.optString("filename", "").trim()
            val sha = obj.optString("sha256", "").trim().lowercase()
            if (filename.isBlank() || sha.isBlank()) continue
            remoteByName[filename] = RemoteMediaEntry(
                filename = filename,
                sha256 = sha,
                sizeBytes = obj.optLong("size_bytes", 0L),
                mimeType = obj.optString("mime_type", "application/octet-stream"),
                deleted = obj.optBoolean("deleted", false)
            )
        }

        val toUpload = ArrayList<Pair<File, String>>()
        val toDownload = ArrayList<RemoteMediaEntry>()
        var skippedCount = 0

        for ((name, fileAndSha) in localByName) {
            val (_, localSha) = fileAndSha
            val remote = remoteByName[name]
            if (remote != null && !remote.deleted && remote.sha256 == localSha) {
                skippedCount++
            } else if (checkpoint.uploadedShas.contains(localSha) && remote != null && !remote.deleted) {
                skippedCount++
            } else {
                toUpload.add(fileAndSha)
            }
        }

        for ((name, remote) in remoteByName) {
            if (remote.deleted) continue
            val local = localByName[name]
            if (local == null) {
                if (checkpoint.downloadedShas.contains(remote.sha256) && File(mediaDir, name).exists()) {
                    skippedCount++
                } else {
                    toDownload.add(remote)
                }
            }
        }

        val parallelism = DeviceProfile.current(app).syncParallelism.coerceIn(1, 8)
        val semaphore = Semaphore(parallelism)
        val uploadedCounter = AtomicInteger(0)
        val downloadedCounter = AtomicInteger(0)
        val manifestUpdates = ArrayList<JSONObject>()
        val manifestMutex = Mutex()
        val totalOps = toUpload.size + toDownload.size

        if (totalOps > 0) {
            onProgress("미디어 ${totalOps}개 동기화 중 (${parallelism}병렬)...")
            coroutineScope {
                val uploadJobs = toUpload.map { (file, sha) ->
                    async {
                        semaphore.withPermit {
                            val mime = guessMimeType(file.name)
                            val objectPath = "${session.userId}/$sha"
                            withRetry {
                                uploadStorageFile(session, objectPath, file, mime)
                            }
                            manifestMutex.withLock {
                                manifestUpdates.add(
                                    JSONObject().apply {
                                        put("user_id", session.userId)
                                        put("filename", file.name)
                                        put("sha256", sha)
                                        put("size_bytes", file.length())
                                        put("mime_type", mime)
                                        put("deleted", false)
                                        put("updated_at", Instant.now().toString())
                                    }
                                )
                            }
                            checkpointMutex.withLock {
                                checkpoint.uploadedShas.add(sha)
                                saveCheckpoint(checkpointFile, checkpoint)
                            }
                            val done = uploadedCounter.incrementAndGet() + downloadedCounter.get()
                            onProgress("미디어 동기화 ($done/$totalOps)")
                        }
                    }
                }

                val downloadJobs = toDownload.map { remote ->
                    async {
                        semaphore.withPermit {
                            val targetFile = safeChildFile(mediaDir, remote.filename)
                            if (targetFile != null) {
                                val objectPath = "${session.userId}/${remote.sha256}"
                                withRetry {
                                    downloadStorageObject(session, objectPath, targetFile)
                                }
                                val actualSha = sha256FileHex(targetFile)
                                if (actualSha.equals(remote.sha256, ignoreCase = true)) {
                                    cacheMutex.withLock {
                                        updatedCache[remote.filename] = CachedHashEntry(
                                            mtime = targetFile.lastModified(),
                                            size = targetFile.length(),
                                            sha256 = actualSha
                                        )
                                    }
                                    checkpointMutex.withLock {
                                        checkpoint.downloadedShas.add(remote.sha256)
                                        saveCheckpoint(checkpointFile, checkpoint)
                                    }
                                    val done = uploadedCounter.get() + downloadedCounter.incrementAndGet()
                                    onProgress("미디어 동기화 ($done/$totalOps)")
                                } else {
                                    targetFile.delete()
                                }
                            }
                        }
                    }
                }

                (uploadJobs + downloadJobs).awaitAll()
            }
        }

        if (manifestUpdates.isNotEmpty()) {
            val arr = JSONArray()
            manifestUpdates.forEach { arr.put(it) }
            restUpsertChunked(session, "amgi_media_manifest", arr, "user_id,filename", chunkSize = 150)
        }

        saveHashCache(cacheFile, updatedCache)
        checkpointFile.delete()

        return MediaSyncStats(
            uploaded = uploadedCounter.get(),
            downloaded = downloadedCounter.get(),
            skipped = skippedCount
        )
    }

    // --- Disk Cache & Checkpoint Helpers ---

    private data class SyncCheckpoint(
        val uploadedShas: MutableSet<String> = HashSet(),
        val downloadedShas: MutableSet<String> = HashSet()
    )

    private fun loadHashCache(file: File): MutableMap<String, CachedHashEntry> {
        val map = HashMap<String, CachedHashEntry>()
        if (!file.isFile) return map
        runCatching {
            val root = JSONObject(file.readText(Charsets.UTF_8))
            val keys = root.keys()
            while (keys.hasNext()) {
                val key = keys.next()
                val obj = root.optJSONObject(key) ?: continue
                map[key] = CachedHashEntry(
                    mtime = obj.optLong("mtime", 0L),
                    size = obj.optLong("size", 0L),
                    sha256 = obj.optString("sha256", "")
                )
            }
        }
        return map
    }

    private fun saveHashCache(file: File, cache: Map<String, CachedHashEntry>) {
        runCatching {
            val root = JSONObject()
            for ((name, entry) in cache) {
                root.put(
                    name,
                    JSONObject().apply {
                        put("mtime", entry.mtime)
                        put("size", entry.size)
                        put("sha256", entry.sha256)
                    }
                )
            }
            val tmp = File(file.parentFile, "${file.name}.tmp")
            tmp.writeText(root.toString(), Charsets.UTF_8)
            if (!tmp.renameTo(file)) {
                tmp.copyTo(file, overwrite = true)
                tmp.delete()
            }
        }
    }

    private fun loadCheckpoint(file: File): SyncCheckpoint {
        val cp = SyncCheckpoint()
        if (!file.isFile) return cp
        runCatching {
            val root = JSONObject(file.readText(Charsets.UTF_8))
            root.optJSONArray("uploaded")?.let { arr ->
                for (i in 0 until arr.length()) cp.uploadedShas.add(arr.optString(i))
            }
            root.optJSONArray("downloaded")?.let { arr ->
                for (i in 0 until arr.length()) cp.downloadedShas.add(arr.optString(i))
            }
        }
        return cp
    }

    private fun saveCheckpoint(file: File, cp: SyncCheckpoint) {
        runCatching {
            val root = JSONObject().apply {
                put("uploaded", JSONArray(cp.uploadedShas.toList()))
                put("downloaded", JSONArray(cp.downloadedShas.toList()))
            }
            val tmp = File(file.parentFile, "${file.name}.tmp")
            tmp.writeText(root.toString(), Charsets.UTF_8)
            if (!tmp.renameTo(file)) {
                tmp.copyTo(file, overwrite = true)
                tmp.delete()
            }
        }
    }

    // --- Retry & HTTP Primitives ---

    private suspend fun <T> withRetry(
        maxAttempts: Int = 3,
        baseDelayMs: Long = 500L,
        block: suspend () -> T
    ): T {
        var lastError: Throwable? = null
        var delayMs = baseDelayMs
        for (attempt in 1..maxAttempts) {
            try {
                return block()
            } catch (t: Throwable) {
                lastError = t
                if (attempt < maxAttempts) {
                    delay(delayMs)
                    delayMs *= 3L // 500ms -> 1500ms -> 4500ms
                }
            }
        }
        throw (lastError ?: IllegalStateException("재시도 실패"))
    }

    private fun restGetArray(session: Session, table: String, query: String): JSONArray {
        val req = Request.Builder()
            .url("${session.url}/rest/v1/$table?$query")
            .header("apikey", session.anonKey)
            .header("Authorization", "Bearer ${session.accessToken}")
            .header("Accept", "application/json")
            .get()
            .build()
        val bodyStr = executeForBody(req, "Supabase $table 조회 실패")
        return JSONArray(bodyStr)
    }

    private fun restUpsert(session: Session, table: String, rows: JSONArray, onConflict: String) {
        if (rows.length() == 0) return
        val req = Request.Builder()
            .url("${session.url}/rest/v1/$table?on_conflict=${urlEncode(onConflict)}")
            .header("apikey", session.anonKey)
            .header("Authorization", "Bearer ${session.accessToken}")
            .header("Content-Type", "application/json")
            .header("Prefer", "resolution=merge-duplicates,return=minimal")
            .post(rows.toString().toRequestBody(JSON_MEDIA_TYPE))
            .build()
        executeForBody(req, "Supabase $table 업로드 실패")
    }

    private fun restUpsertChunked(
        session: Session,
        table: String,
        rows: JSONArray,
        onConflict: String,
        chunkSize: Int = 200
    ) {
        if (rows.length() == 0) return
        var idx = 0
        while (idx < rows.length()) {
            val end = minOf(idx + chunkSize, rows.length())
            val batch = JSONArray()
            for (i in idx until end) {
                batch.put(rows.get(i))
            }
            restUpsert(session, table, batch, onConflict)
            idx = end
        }
    }

    private fun uploadStorageFile(
        session: Session,
        objectPath: String,
        file: File,
        contentType: String
    ) {
        val encodedPath = encodeStoragePath(objectPath)
        val req = Request.Builder()
            .url("${session.url}/storage/v1/object/amgi-media/$encodedPath")
            .header("apikey", session.anonKey)
            .header("Authorization", "Bearer ${session.accessToken}")
            .header("x-upsert", "true")
            .header("Content-Type", contentType)
            .post(file.asRequestBody(contentType.toMediaType()))
            .build()

        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful && resp.code != 409) {
                val errBody = resp.body?.string().orEmpty()
                throw IllegalStateException("Storage 업로드 실패 (${resp.code}): $errBody")
            }
        }
    }

    private fun downloadStorageObject(
        session: Session,
        objectPath: String,
        destFile: File
    ) {
        val encodedPath = encodeStoragePath(objectPath)
        val req = Request.Builder()
            .url("${session.url}/storage/v1/object/authenticated/amgi-media/$encodedPath")
            .header("apikey", session.anonKey)
            .header("Authorization", "Bearer ${session.accessToken}")
            .get()
            .build()

        destFile.parentFile?.mkdirs()
        val partFile = File(destFile.parentFile, "${destFile.name}.part")
        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) {
                val errBody = resp.body?.string().orEmpty()
                throw IllegalStateException("Storage 다운로드 실패 (${resp.code}): $errBody")
            }
            val body = resp.body ?: throw IllegalStateException("Storage 응답이 비어 있습니다.")
            body.byteStream().use { input ->
                partFile.outputStream().use { output ->
                    input.copyTo(output, 64 * 1024)
                }
            }
        }
        if (destFile.exists()) destFile.delete()
        if (!partFile.renameTo(destFile)) {
            partFile.copyTo(destFile, overwrite = true)
            partFile.delete()
        }
    }

    private fun executeForBody(req: Request, errPrefix: String): String {
        client.newCall(req).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) {
                throw IllegalStateException("$errPrefix (${resp.code}): $text")
            }
            return text
        }
    }

    private fun normalizeUrl(url: String): String = url.trim().trimEnd('/')

    private fun urlEncode(value: String): String =
        URLEncoder.encode(value, "UTF-8")

    private fun encodeStoragePath(path: String): String =
        path.split("/").joinToString("/") { segment ->
            URLEncoder.encode(segment, "UTF-8").replace("+", "%20")
        }

    private fun safeChildFile(parent: File, filename: String): File? {
        val cleanName = filename.trim().replace('\\', '/')
        if (cleanName.isBlank() || cleanName.contains("..")) return null
        val root = parent.canonicalFile
        val child = File(root, cleanName).canonicalFile
        return if (child.path.startsWith(root.path + File.separator)) child else null
    }

    private fun parseIsoTimestampMs(raw: String): Long {
        if (raw.isBlank()) return 0L
        return runCatching { Instant.parse(raw).toEpochMilli() }
            .getOrElse {
                runCatching { OffsetDateTime.parse(raw).toInstant().toEpochMilli() }.getOrDefault(0L)
            }
    }

    private fun sha256FileHex(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        val buf = ByteArray(64 * 1024)
        file.inputStream().use { input ->
            while (true) {
                val n = input.read(buf)
                if (n < 0) break
                digest.update(buf, 0, n)
            }
        }
        val bytes = digest.digest()
        val hex = "0123456789abcdef".toCharArray()
        val sb = StringBuilder(bytes.size * 2)
        for (b in bytes) {
            sb.append(hex[(b.toInt() ushr 4) and 0x0F])
            sb.append(hex[b.toInt() and 0x0F])
        }
        return sb.toString()
    }

    private fun guessMimeType(filename: String): String {
        val ext = filename.substringAfterLast('.', "").lowercase(Locale.ROOT)
        if (ext.isEmpty()) return OCTET_MEDIA_TYPE.toString()
        return MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext)
            ?: when (ext) {
                "mp3" -> "audio/mpeg"
                "ogg", "oga" -> "audio/ogg"
                "wav" -> "audio/wav"
                "m4a" -> "audio/mp4"
                "webp" -> "image/webp"
                "png" -> "image/png"
                "jpg", "jpeg" -> "image/jpeg"
                "svg" -> "image/svg+xml"
                else -> "application/octet-stream"
            }
    }
}
