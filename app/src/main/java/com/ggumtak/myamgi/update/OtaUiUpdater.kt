package com.ggumtak.myamgi.update

import android.content.Context
import com.ggumtak.myamgi.BuildConfig
import com.ggumtak.myamgi.host.UiBundle
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.ByteArrayInputStream
import java.io.File
import java.util.concurrent.TimeUnit
import java.util.zip.ZipInputStream

/**
 * Checks and atomically installs Web UI OTA bundles (`ui-version.json` + `ui-bundle.zip`)
 * from the `update-files` GitHub release into `filesDir/ui-ota/`.
 */
object OtaUiUpdater {
    const val UI_VERSION_FILE = UiBundle.VERSION_FILE
    const val UI_BUNDLE_ZIP = "ui-bundle.zip"
    private const val MAX_BUNDLE_BYTES = 50L * 1024 * 1024

    data class Available(
        val version: String,
        val sizeBytes: Long,
        val bundleUrl: String
    )

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(20, TimeUnit.SECONDS)
            .followRedirects(true)
            .followSslRedirects(true)
            .build()
    }

    fun uiOtaDir(context: Context): File = File(context.applicationContext.filesDir, "ui-ota")

    fun versionUrl(repo: String = BuildConfig.GITHUB_REPO): String =
        UpdateInfo.downloadUrl(UpdateInfo.UPDATE_FILES_TAG, UI_VERSION_FILE, repo)

    fun bundleUrl(repo: String = BuildConfig.GITHUB_REPO): String =
        UpdateInfo.downloadUrl(UpdateInfo.UPDATE_FILES_TAG, UI_BUNDLE_ZIP, repo)

    /**
     * Checks `ui-version.json` and `ui-bundle.zip` on `update-files`.
     * Returns null if no newer UI bundle is available (including 404).
     */
    fun check(currentUiVersion: String?, repo: String = BuildConfig.GITHUB_REPO): Available? {
        val versionReq = Request.Builder()
            .url(versionUrl(repo))
            .header("Accept", "application/json")
            .header("User-Agent", "myAmgi-Android/${BuildConfig.VERSION_CODE}")
            .build()

        val remoteVersion = client.newCall(versionReq).execute().use { resp ->
            if (!resp.isSuccessful) return null
            val bytes = resp.body?.bytes() ?: return null
            runCatching { ByteArrayInputStream(bytes).use { UiBundle.parseVersion(it) } }.getOrNull()
        } ?: return null

        val baseline = currentUiVersion?.takeIf { it.isNotBlank() } ?: "0"
        if (UiBundle.compareVersions(remoteVersion, baseline) <= 0) {
            return null
        }

        val zipUrl = bundleUrl(repo)
        val headReq = Request.Builder()
            .url(zipUrl)
            .head()
            .header("User-Agent", "myAmgi-Android/${BuildConfig.VERSION_CODE}")
            .build()

        val sizeBytes = client.newCall(headReq).execute().use { resp ->
            if (!resp.isSuccessful) return null
            resp.header("Content-Length")?.toLongOrNull() ?: (resp.body?.contentLength() ?: -1L)
        }

        return Available(
            version = remoteVersion,
            sizeBytes = sizeBytes.coerceAtLeast(0L),
            bundleUrl = zipUrl
        )
    }

    /**
     * Downloads `ui-bundle.zip`, validates against Zip Slip and version mismatch, extracts into
     * `filesDir/ui-ota-staging`, and atomically swaps into `filesDir/ui-ota`.
     */
    fun apply(
        context: Context,
        expectedVersion: String? = null,
        bundleUrl: String = bundleUrl(),
        onProgress: (Int) -> Unit = {}
    ): String {
        val app = context.applicationContext
        val filesDir = app.filesDir
        val partZip = File(filesDir, "ui-ota.zip.part")
        val stagingDir = File(filesDir, "ui-ota-staging")
        val targetDir = uiOtaDir(app)
        val backupDir = File(filesDir, "ui-ota-old")

        partZip.delete()
        stagingDir.deleteRecursively()

        try {
            downloadZip(bundleUrl, partZip, onProgress)
            extractZipSafely(partZip, stagingDir)

            val indexFile = File(stagingDir, "index.html")
            val versionFile = File(stagingDir, UI_VERSION_FILE)
            require(indexFile.isFile && indexFile.length() > 0L) {
                "UI 번들에 index.html이 없습니다."
            }
            require(versionFile.isFile) {
                "UI 번들에 ui-version.json이 없습니다."
            }

            val extractedVersion = versionFile.inputStream().use { UiBundle.parseVersion(it) }
                ?: throw IllegalStateException("유효한 UI 버전 정보를 읽을 수 없습니다.")
            if (!expectedVersion.isNullOrBlank() && extractedVersion != expectedVersion) {
                throw IllegalStateException("UI 번들 버전 불일치 ($extractedVersion != $expectedVersion)")
            }

            backupDir.deleteRecursively()
            if (targetDir.exists()) {
                if (!targetDir.renameTo(backupDir)) {
                    targetDir.deleteRecursively()
                }
            }
            if (!stagingDir.renameTo(targetDir)) {
                stagingDir.copyRecursively(targetDir, overwrite = true)
                stagingDir.deleteRecursively()
            }
            backupDir.deleteRecursively()
            return extractedVersion
        } finally {
            partZip.delete()
            stagingDir.deleteRecursively()
        }
    }

    private fun downloadZip(url: String, partFile: File, onProgress: (Int) -> Unit) {
        val req = Request.Builder()
            .url(url)
            .header("User-Agent", "myAmgi-Android/${BuildConfig.VERSION_CODE}")
            .build()

        client.newCall(req).execute().use { resp ->
            if (!resp.isSuccessful) {
                throw IllegalStateException("UI 번들 다운로드 실패 (HTTP ${resp.code})")
            }
            val body = resp.body ?: throw IllegalStateException("UI 번들 응답이 비어 있습니다.")
            val total = body.contentLength()
            if (total > MAX_BUNDLE_BYTES) {
                throw IllegalStateException("UI 번들 크기가 허용 한도를 초과했습니다.")
            }

            var written = 0L
            var lastPct = -1
            body.byteStream().use { input ->
                partFile.outputStream().use { out ->
                    val buf = ByteArray(32 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        written += n
                        if (written > MAX_BUNDLE_BYTES) {
                            throw IllegalStateException("UI 번들 크기가 50MB를 초과했습니다.")
                        }
                        out.write(buf, 0, n)
                        if (total > 0L) {
                            val pct = ((written * 100L) / total).toInt().coerceIn(0, 100)
                            if (pct != lastPct) {
                                lastPct = pct
                                onProgress(pct)
                            }
                        }
                    }
                }
            }
            if (total > 0L && written != total) {
                throw IllegalStateException("UI 번들 다운로드가 완료되지 않았습니다.")
            }
        }
    }

    private fun extractZipSafely(zipFile: File, destDir: File) {
        destDir.mkdirs()
        val canonicalDest = destDir.canonicalFile
        val destPrefix = canonicalDest.path + File.separator
        var totalUncompressed = 0L

        ZipInputStream(zipFile.inputStream().buffered()).use { zis ->
            val buf = ByteArray(32 * 1024)
            while (true) {
                val entry = zis.nextEntry ?: break
                val rawName = entry.name.replace('\\', '/').trimStart('/')
                if (rawName.isEmpty() || rawName == ".") {
                    zis.closeEntry()
                    continue
                }
                val outFile = File(canonicalDest, rawName).canonicalFile
                require(outFile.path.startsWith(destPrefix)) {
                    "잘못된 압축 경로입니다: ${entry.name}"
                }
                if (entry.isDirectory) {
                    outFile.mkdirs()
                } else {
                    outFile.parentFile?.mkdirs()
                    outFile.outputStream().use { out ->
                        while (true) {
                            val n = zis.read(buf)
                            if (n < 0) break
                            totalUncompressed += n
                            if (totalUncompressed > MAX_BUNDLE_BYTES * 2) {
                                throw IllegalStateException("압축 해제 크기가 허용 한도를 초과했습니다.")
                            }
                            out.write(buf, 0, n)
                        }
                    }
                }
                zis.closeEntry()
            }
        }
    }
}
