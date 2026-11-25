package com.ggumtak.myamgi.hanja

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.widget.Toast
import com.ggumtak.myamgi.update.AssetLoader
import java.io.File
import java.util.zip.ZipFile

/**
 * Integration with "한자 바로보기" (`com.ggumtak.hanja`).
 *
 * - The tap script's one source of truth is the installed Hanja app: its APK's `assets/anki-tap.js` (the entry
 *   name its build really produces, checked by HanjaTapScriptTest) is read at run time, cached by the APK's
 *   `lastModified`, so every Hanja update reaches myAmgi's reviewer without a myAmgi release.
 * - Without the Hanja app installed, the bundled/OTA copy `assets/hanja/anki-tap.js` (via [AssetLoader]) is used.
 *   A tap then has nowhere to go, so that copy only has to be close, not current. It is a byte copy of the Hanja
 *   repository's `app/src/main/assets/anki-tap.js` at the commit named in `assets/hanja/SOURCE`; to refresh it,
 *   copy the file and update SOURCE (its SHA-256 line). HanjaTapScriptTest fails when the copy and SOURCE
 *   disagree, and when a Hanja checkout is next to this repository (or HANJA_REPO points to one) and differs.
 * - The script only defines `window.__hjCode[<version>]`; the Hanja app's card loader runs the highest version.
 *   [withRunner] appends the same runner, so myAmgi keeps working when the Hanja app moves to v10, v11, ….
 * - Safely dispatches `intent://lookup?...#Intent;scheme=hanja;package=com.ggumtak.hanja;end`
 *   and `hanja://...` URLs from WebView card taps; the Hanja app's LookupActivity takes ACTION_VIEW
 *   `hanja://lookup?q=<word>&s=<sentence>` (categories DEFAULT and BROWSABLE).
 */
object HanjaIntegration {
    const val HANJA_PACKAGE = "com.ggumtak.hanja"
    private const val APK_SCRIPT_ENTRY = "assets/anki-tap.js"
    private const val LOCAL_ASSET_PATH = "hanja/anki-tap.js"

    private val cacheLock = Any()

    @Volatile
    private var cachedApkPath: String? = null

    @Volatile
    private var cachedApkLastModified: Long = -1L

    @Volatile
    private var cachedApkScript: String? = null

    fun isInstalled(context: Context): Boolean {
        return getInstalledSourceDir(context) != null
    }

    fun loadTapScript(context: Context): Pair<String, String> {
        val sourceDir = getInstalledSourceDir(context)
        if (sourceDir != null) {
            val apkFile = File(sourceDir)
            if (apkFile.isFile) {
                val mtime = apkFile.lastModified()
                synchronized(cacheLock) {
                    if (cachedApkPath == apkFile.absolutePath &&
                        cachedApkLastModified == mtime &&
                        cachedApkScript != null
                    ) {
                        return "apk:$HANJA_PACKAGE" to withRunner(cachedApkScript!!)
                    }
                }
                val extracted = extractTapScriptFromApk(apkFile)
                if (!extracted.isNullOrBlank()) {
                    synchronized(cacheLock) {
                        cachedApkPath = apkFile.absolutePath
                        cachedApkLastModified = mtime
                        cachedApkScript = extracted
                    }
                    return "apk:$HANJA_PACKAGE" to withRunner(extracted)
                }
            }
        }

        val fallback = runCatching {
            AssetLoader.readText(context, LOCAL_ASSET_PATH)
        }.getOrDefault("")
        return "asset:$LOCAL_ASSET_PATH" to (if (fallback.isBlank()) fallback else withRunner(fallback))
    }

    /**
     * Runs the highest `window.__hjCode` version the script defined, as the Hanja app's `anki-loader.html` does,
     * unless a run already happened on this page (`__hjtapRun` set by an earlier card in the same WebView: the
     * page's own call to `__hjtapRun()` rescans then). Without it a script that moved past v9 would only define a
     * function nobody calls.
     */
    fun withRunner(script: String): String = script.trimEnd() + "\n" + RUNNER

    const val RUNNER = "(function(){var w=window;if(w.__hjtapRun)return;var c=w.__hjCode||{},b=0;" +
        "for(var k in c)if(+k>b)b=+k;if(b&&typeof c[b]==='function')c[b]();})();\n"

    /** Pure JVM-testable helper that extracts `assets/anki-tap.js` from an APK/ZIP archive. */
    fun extractTapScriptFromApk(apkFile: File): String? {
        if (!apkFile.isFile || !apkFile.canRead()) return null
        return runCatching {
            ZipFile(apkFile).use { zip ->
                val entry = zip.getEntry(APK_SCRIPT_ENTRY) ?: return@use null
                zip.getInputStream(entry).bufferedReader(Charsets.UTF_8).use { it.readText() }
            }
        }.getOrNull()?.takeIf { it.isNotBlank() }
    }

    fun handleIntentUrl(activity: Activity, url: String): Boolean {
        val trimmed = url.trim()
        val isIntentScheme = trimmed.startsWith("intent://", ignoreCase = true)
        val isHanjaScheme = trimmed.startsWith("hanja://", ignoreCase = true)
        if (!isIntentScheme && !isHanjaScheme) {
            return false
        }

        val intent = runCatching {
            if (isIntentScheme) {
                Intent.parseUri(trimmed, Intent.URI_INTENT_SCHEME).apply {
                    addCategory(Intent.CATEGORY_BROWSABLE)
                    component = null
                    selector = null
                    if (`package`.isNullOrBlank()) {
                        `package` = HANJA_PACKAGE
                    }
                }
            } else {
                Intent(Intent.ACTION_VIEW, Uri.parse(trimmed)).apply {
                    `package` = HANJA_PACKAGE
                }
            }
        }.getOrNull() ?: return false

        return try {
            activity.startActivity(intent)
            true
        } catch (_: ActivityNotFoundException) {
            showMissingAppToast(activity)
            true
        } catch (_: SecurityException) {
            showMissingAppToast(activity)
            true
        }
    }

    private fun showMissingAppToast(activity: Activity) {
        activity.runOnUiThread {
            Toast.makeText(
                activity,
                "한자 바로보기 앱(com.ggumtak.hanja)이 설치되어 있지 않습니다.",
                Toast.LENGTH_SHORT
            ).show()
        }
    }

    private fun getInstalledSourceDir(context: Context): String? {
        val pm = context.packageManager
        val appInfo = runCatching {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                pm.getApplicationInfo(HANJA_PACKAGE, PackageManager.ApplicationInfoFlags.of(0))
            } else {
                @Suppress("DEPRECATION")
                pm.getApplicationInfo(HANJA_PACKAGE, 0)
            }
        }.getOrNull() ?: return null
        return appInfo.sourceDir?.takeIf { it.isNotBlank() }
    }
}
