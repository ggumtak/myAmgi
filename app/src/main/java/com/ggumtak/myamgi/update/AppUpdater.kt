package com.ggumtak.myamgi.update

import android.app.Activity
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import com.ggumtak.myamgi.BuildConfig
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

/**
 * In-place [PackageInstaller.Session] updater.
 * Attempts a binary delta rebuild with [ApkPatch] first, falling back to downloading the full
 * flavor-specific APK if no patch is available or verification fails.
 */
object AppUpdater {
    private const val DIR = "update"
    private const val MAX_BYTES = 150L * 1024 * 1024
    const val ACTION_STATUS = "com.ggumtak.myamgi.UPDATE_STATUS"

    private val main = Handler(Looper.getMainLooper())

    val current: Int get() = BuildConfig.VERSION_CODE

    fun check(done: (UpdateInfo.Latest?) -> Unit) {
        Thread {
            val latest = runCatching { fetchLatest() }.getOrNull()
            main.post { done(latest) }
        }.start()
    }

    /**
     * Reads the full APK from release `latest`. Only when it is newer, also reads release
     * `update-files` for delta patches; if that fails, the full APK is used.
     */
    /** Blocking: call off the main thread. Null when the release could not be read. */
    fun fetchLatest(): UpdateInfo.Latest? {
        val latestJson = getText(UpdateInfo.LATEST_URL) ?: return null
        val apkOnly = UpdateInfo.parse(latestJson, BuildConfig.APK_PREFIX) ?: return null
        if (!UpdateInfo.isNewer(apkOnly, current)) return apkOnly
        val updateFilesJson = runCatching { getText(UpdateInfo.UPDATE_FILES_URL) }.getOrNull()
            ?: return apkOnly
        return UpdateInfo.parse(latestJson, BuildConfig.APK_PREFIX, updateFilesJson) ?: apkOnly
    }

    fun install(
        activity: Activity,
        latest: UpdateInfo.Latest,
        progress: (Int) -> Unit,
        failed: (String) -> Unit
    ): Boolean {
        if (!activity.packageManager.canRequestPackageInstalls()) {
            runCatching {
                activity.startActivity(
                    Intent(
                        Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.packageName)
                    )
                )
            }
            return false
        }

        val app = activity.applicationContext
        Thread {
            val report: (Int) -> Unit = { p -> main.post { progress(p) } }
            val file = runCatching { fromPatch(app, latest, report) }.getOrNull()
                ?: runCatching { fetchApk(app, latest, report) }.getOrNull()

            if (file == null) {
                main.post { failed("업데이트 다운로드에 실패했습니다.") }
                return@Thread
            }

            val ok = runCatching { commit(app, file) }.isSuccess
            if (!ok) {
                file.delete()
                main.post { failed("업데이트 설치에 실패했습니다.") }
            }
        }.start()
        return true
    }

    fun forgetDownloads(context: Context) {
        File(context.applicationContext.cacheDir, DIR).listFiles()?.forEach { it.deleteRecursively() }
    }

    private fun commit(context: Context, file: File) {
        val installer = context.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(context.packageName)
            setSize(file.length())
            if (Build.VERSION.SDK_INT >= 31) {
                setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
            }
        }
        val id = installer.createSession(params)
        try {
            installer.openSession(id).use { session ->
                session.openWrite("base.apk", 0, file.length()).use { out ->
                    file.inputStream().use { it.copyTo(out, 64 * 1024) }
                    session.fsync(out)
                }
                val intent = Intent(context, UpdateReceiver::class.java).setAction(ACTION_STATUS)
                val flags = PendingIntent.FLAG_UPDATE_CURRENT or
                    (if (Build.VERSION.SDK_INT >= 31) PendingIntent.FLAG_MUTABLE else 0)
                session.commit(PendingIntent.getBroadcast(context, id, intent, flags).intentSender)
            }
        } catch (t: Throwable) {
            runCatching { installer.abandonSession(id) }
            throw t
        }
    }

    private fun open(url: String): HttpURLConnection = (URL(url).openConnection() as HttpURLConnection).apply {
        connectTimeout = 15_000
        readTimeout = 30_000
        instanceFollowRedirects = true
        setRequestProperty("Accept", "application/vnd.github+json, */*")
        setRequestProperty("User-Agent", "myAmgi-Android")
    }

    private fun getText(url: String): String? {
        val conn = open(url)
        return try {
            if (conn.responseCode != 200) null
            else conn.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } finally {
            conn.disconnect()
        }
    }

    private fun fromPatch(context: Context, latest: UpdateInfo.Latest, progress: (Int) -> Unit): File? {
        val patch = UpdateInfo.patchFor(latest, current) ?: return null
        val dir = File(context.cacheDir, DIR).apply { mkdirs() }
        val fileName = UpdateInfo.fileName(latest.build, latest.flavorPrefix)
        val target = File(dir, fileName)
        if (latest.size > 0L && target.length() == latest.size) return target

        val patchFile = File(dir, "$fileName.patch")
        if (!download(patch.url, patchFile, patch.size, progress)) return null

        val built = File(dir, "$fileName.part")
        val ok = patchFile.inputStream().use {
            ApkPatch.apply(File(context.applicationInfo.sourceDir), it, built)
        }
        patchFile.delete()
        target.delete()
        return if (ok && built.renameTo(target)) target else {
            built.delete()
            null
        }
    }

    private fun fetchApk(context: Context, latest: UpdateInfo.Latest, progress: (Int) -> Unit): File? {
        val dir = File(context.cacheDir, DIR).apply { mkdirs() }
        val fileName = UpdateInfo.fileName(latest.build, latest.flavorPrefix)
        dir.listFiles()?.filter { it.name != fileName }?.forEach { it.deleteRecursively() }
        val target = File(dir, fileName)
        if (latest.size > 0L && target.length() == latest.size) return target
        return if (download(latest.url, target, latest.size, progress)) target else null
    }

    private fun download(url: String, target: File, size: Long, progress: (Int) -> Unit): Boolean {
        val part = File(target.parentFile, "${target.name}.part")
        val conn = open(url)
        return try {
            if (conn.responseCode != 200) return false
            val total = conn.contentLengthLong.takeIf { it > 0L } ?: size
            if (total > MAX_BYTES) return false
            var done = 0L
            var shown = -2
            conn.inputStream.use { input ->
                part.outputStream().use { out ->
                    val buf = ByteArray(64 * 1024)
                    while (true) {
                        val n = input.read(buf)
                        if (n < 0) break
                        out.write(buf, 0, n)
                        done += n
                        if (done > MAX_BYTES) return false
                        val p = if (total > 0L) (done * 100L / total).toInt() else -1
                        if (p != shown) {
                            shown = p
                            progress(p)
                        }
                    }
                }
            }
            if (total > 0L && done != total) return false
            target.delete()
            part.renameTo(target)
        } finally {
            conn.disconnect()
        }
    }
}
