package com.ggumtak.myamgi.update

import android.content.Context
import com.ggumtak.myamgi.BuildConfig
import com.ggumtak.myamgi.prefs.AppPrefs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.io.File
import java.util.concurrent.TimeUnit

data class OtaManifestFile(
    val path: String,
    val assetName: String,
    val sha256: String,
    val size: Long,
    val url: String
)

data class OtaManifest(
    val version: Int,
    val generatedAt: String,
    val files: List<OtaManifestFile>
)

data class OtaCheckResult(
    val remoteVersion: Int,
    val updatedFiles: List<String>,
    val upToDate: Boolean,
    val error: String? = null
)

/**
 * Fetches `ota-manifest.json` from the `update-files` GitHub release, checks SHA-256 of
 * tracked web/JS/CSS assets, and atomically downloads changed files into `filesDir/ota/`.
 */
object OtaAssetUpdater {
    private const val MAX_OTA_FILE_BYTES = 20L * 1024 * 1024

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }

    const val MANIFEST_NAME = "ota-manifest.json"

    fun manifestUrl(): String = UpdateInfo.downloadUrl(UpdateInfo.UPDATE_FILES_TAG, MANIFEST_NAME)

    /** Pure JSON parser so JVM unit tests can verify manifest parsing without network or Context. */
    fun parseManifest(json: String): OtaManifest {
        val root = JSONObject(json)
        val version = root.optInt("version", 0)
        val generatedAt = root.optString("generatedAt", "")
        val filesArr = root.optJSONArray("files")
        val files = ArrayList<OtaManifestFile>()
        if (filesArr != null) {
            for (i in 0 until filesArr.length()) {
                val obj = filesArr.optJSONObject(i) ?: continue
                val path = obj.optString("path", "").trim()
                val assetName = obj.optString("assetName", "").trim()
                val sha256 = obj.optString("sha256", "").trim().lowercase()
                val size = obj.optLong("size", -1L)
                val url = obj.optString("url", "").trim()
                if (path.isNotEmpty() && sha256.isNotEmpty() && url.startsWith("https://")) {
                    files.add(
                        OtaManifestFile(
                            path = path,
                            assetName = assetName,
                            sha256 = sha256,
                            size = size,
                            url = url
                        )
                    )
                }
            }
        }
        return OtaManifest(
            version = version,
            generatedAt = generatedAt,
            files = files
        )
    }

    suspend fun checkAndUpdate(context: Context): OtaCheckResult = withContext(Dispatchers.IO) {
        val app = context.applicationContext
        val localVersion = AppPrefs.getOtaVersion(app)
        try {
            val manifestReq = Request.Builder()
                .url(manifestUrl())
                .header("Accept", "application/json")
                .header("User-Agent", "myAmgi-Android/${BuildConfig.VERSION_CODE}")
                .build()

            val manifestJson = client.newCall(manifestReq).execute().use { resp ->
                if (resp.code == 404) {
                    // No manifest published (yet): nothing to hot-patch, not an error.
                    return@withContext OtaCheckResult(
                        remoteVersion = localVersion,
                        updatedFiles = emptyList(),
                        upToDate = true,
                        error = null
                    )
                }
                if (!resp.isSuccessful) {
                    return@withContext OtaCheckResult(
                        remoteVersion = localVersion,
                        updatedFiles = emptyList(),
                        upToDate = false,
                        error = "OTA 매니페스트 요청 실패 (HTTP ${resp.code})"
                    )
                }
                resp.body?.string()
                    ?: return@withContext OtaCheckResult(
                        remoteVersion = localVersion,
                        updatedFiles = emptyList(),
                        upToDate = false,
                        error = "OTA 매니페스트 응답이 비어 있습니다."
                    )
            }

            val manifest = parseManifest(manifestJson)
            val updatedFiles = ArrayList<String>()

            for (entry in manifest.files) {
                val currentSha = runCatching {
                    AssetLoader.sha256Hex(AssetLoader.readBytes(app, entry.path))
                }.getOrNull()

                if (currentSha != null && currentSha.equals(entry.sha256, ignoreCase = true)) {
                    continue
                }

                val target = AssetLoader.otaFile(app, entry.path)
                target.parentFile?.mkdirs()
                val part = File(target.parentFile, "${target.name}.part")

                val ok = downloadAndVerify(entry.url, entry.sha256, entry.size, part)
                if (!ok) {
                    part.delete()
                    return@withContext OtaCheckResult(
                        remoteVersion = manifest.version,
                        updatedFiles = updatedFiles,
                        upToDate = false,
                        error = "OTA 파일 검증 또는 다운로드 실패: ${entry.path}"
                    )
                }

                if (target.exists() && !target.delete()) {
                    part.delete()
                    return@withContext OtaCheckResult(
                        remoteVersion = manifest.version,
                        updatedFiles = updatedFiles,
                        upToDate = false,
                        error = "기존 OTA 파일을 교체할 수 없습니다: ${entry.path}"
                    )
                }
                if (!part.renameTo(target)) {
                    part.copyTo(target, overwrite = true)
                    part.delete()
                }
                updatedFiles.add(entry.path)
            }

            if (manifest.version > 0) {
                AppPrefs.setOtaVersion(app, manifest.version)
            }

            OtaCheckResult(
                remoteVersion = manifest.version,
                updatedFiles = updatedFiles,
                upToDate = updatedFiles.isEmpty(),
                error = null
            )
        } catch (t: Throwable) {
            OtaCheckResult(
                remoteVersion = localVersion,
                updatedFiles = emptyList(),
                upToDate = false,
                error = t.message ?: "OTA 업데이트 오류"
            )
        }
    }

    fun clearOta(context: Context) {
        val app = context.applicationContext
        AssetLoader.otaDir(app).deleteRecursively()
        AppPrefs.setOtaVersion(app, 0)
    }

    private fun downloadAndVerify(
        url: String,
        expectedSha256: String,
        expectedSize: Long,
        partFile: File
    ): Boolean {
        val req = Request.Builder()
            .url(url)
            .header("User-Agent", "myAmgi-Android/${BuildConfig.VERSION_CODE}")
            .build()

        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) return false
            val body = resp.body ?: return false
            val contentLen = body.contentLength()
            if (contentLen > MAX_OTA_FILE_BYTES) return false

            var written = 0L
            body.byteStream().use { input ->
                partFile.outputStream().use { out ->
                    val buf = ByteArray(32 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        written += n
                        if (written > MAX_OTA_FILE_BYTES) return false
                        out.write(buf, 0, n)
                    }
                }
            }

            if (expectedSize > 0 && written != expectedSize) return false
            val actualSha = AssetLoader.sha256Hex(partFile.readBytes())
            return actualSha.equals(expectedSha256, ignoreCase = true)
        }
    }
}
