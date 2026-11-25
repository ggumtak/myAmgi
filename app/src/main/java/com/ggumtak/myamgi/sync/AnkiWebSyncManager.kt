package com.ggumtak.myamgi.sync

import android.content.Context
import anki.sync.SyncAuth
import anki.sync.SyncCollectionResponse
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.prefs.AppPrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Secondary AnkiWeb sync manager wrapping the official Anki 26.09.4 Rust backend.
 */
object AnkiWebSyncManager {
    const val FULL_SYNC_REQUIRED = "FULL_SYNC_REQUIRED"

    suspend fun login(
        context: Context,
        user: String,
        password: String,
        endpoint: String = ""
    ): Result<Unit> = withContext(Dispatchers.IO) {
        val app = context.applicationContext
        val trimmedUser = user.trim()
        val trimmedEndpoint = endpoint.trim()
        if (trimmedUser.isBlank() || password.isEmpty()) {
            return@withContext Result.failure(IllegalArgumentException("아이디와 비밀번호를 입력하세요."))
        }
        runCatching {
            val auth = AnkiEngine.ankiWebLogin(trimmedUser, password, trimmedEndpoint)
            AppPrefs.saveAnkiWebAuth(
                context = app,
                user = trimmedUser,
                hkey = auth.hkey,
                endpoint = auth.endpoint.ifBlank { trimmedEndpoint }
            )
        }
    }

    /**
     * Synchronizes with AnkiWeb.
     *
     * @param fullSyncDirection Optional `"upload"` or `"download"` when resolving a full-sync mismatch.
     * Returns a Korean status message, or `"FULL_SYNC_REQUIRED"` if the server requires choosing upload/download.
     */
    suspend fun sync(
        context: Context,
        fullSyncDirection: String? = null,
        onProgress: (String) -> Unit = {}
    ): Result<String> = withContext(Dispatchers.IO) {
        val app = context.applicationContext
        val user = AppPrefs.getAnkiWebUser(app)
        val hkey = AppPrefs.getAnkiWebHkey(app)
        val endpoint = AppPrefs.getAnkiWebEndpoint(app)

        if (user.isBlank() || hkey.isBlank()) {
            return@withContext Result.failure(IllegalStateException("AnkiWeb 로그인이 필요합니다."))
        }

        val auth = SyncAuth.newBuilder()
            .setHkey(hkey)
            .apply { if (endpoint.isNotBlank()) setEndpoint(endpoint) }
            .build()

        runCatching {
            when (fullSyncDirection?.lowercase()) {
                "upload" -> {
                    onProgress("AnkiWeb 전체 업로드 중...")
                    AnkiEngine.ankiWebFullSync(auth, upload = true)
                    onProgress("AnkiWeb 미디어 동기화 중...")
                    AnkiEngine.ankiWebSyncMedia(auth)
                    AppPrefs.setLastSyncTime(app, System.currentTimeMillis())
                    return@runCatching "AnkiWeb 전체 업로드 및 미디어 동기화가 완료되었습니다."
                }
                "download" -> {
                    onProgress("AnkiWeb 전체 다운로드 중...")
                    AnkiEngine.ankiWebFullSync(auth, upload = false)
                    onProgress("AnkiWeb 미디어 동기화 중...")
                    AnkiEngine.ankiWebSyncMedia(auth)
                    AppPrefs.setLastSyncTime(app, System.currentTimeMillis())
                    return@runCatching "AnkiWeb 전체 다운로드 및 미디어 동기화가 완료되었습니다."
                }
            }

            onProgress("AnkiWeb 컬렉션 동기화 중...")
            val resp = AnkiEngine.ankiWebSyncCollection(auth)

            val required = resp.required
            if (required == SyncCollectionResponse.ChangesRequired.FULL_SYNC) {
                return@runCatching FULL_SYNC_REQUIRED
            }
            if (required == SyncCollectionResponse.ChangesRequired.FULL_UPLOAD) {
                onProgress("AnkiWeb 초기 컬렉션 업로드 중...")
                AnkiEngine.ankiWebFullSync(auth, upload = true)
            } else if (required == SyncCollectionResponse.ChangesRequired.FULL_DOWNLOAD) {
                onProgress("AnkiWeb 컬렉션 다운로드 중...")
                AnkiEngine.ankiWebFullSync(auth, upload = false)
            }

            onProgress("AnkiWeb 미디어 동기화 중...")
            AnkiEngine.ankiWebSyncMedia(auth)
            AppPrefs.setLastSyncTime(app, System.currentTimeMillis())

            val serverMsg = resp.serverMessage.trim()
            if (serverMsg.isNotEmpty()) {
                "AnkiWeb 동기화 완료 ($serverMsg)"
            } else {
                "AnkiWeb 동기화가 완료되었습니다."
            }
        }
    }
}
