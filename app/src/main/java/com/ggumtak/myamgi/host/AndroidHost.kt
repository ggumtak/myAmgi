package com.ggumtak.myamgi.host

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.AssetManager
import android.net.Uri
import android.os.Build
import com.ggumtak.myamgi.BuildConfig
import java.io.InputStream

/**
 * Android pieces for [HostServer] (not wired to a WebView shell yet): APK assets as an
 * [AssetSource] and a [Platform] with the functions that need no Activity.
 */
class AndroidAssetSource(private val assets: AssetManager, private val prefix: String) : AssetSource {
    override fun open(path: String): InputStream? =
        if (path.isEmpty() || path.endsWith("/")) null else runCatching { assets.open(prefix + path) }.getOrNull()
}

class AndroidPlatform(context: Context) : Platform {
    private val app = context.applicationContext

    override fun info() = PlatformInfo(
        platform = "android",
        appVersion = BuildConfig.VERSION_NAME,
        build = BuildConfig.VERSION_CODE,
        flavor = BuildConfig.FLAVOR_NAME,
        eink = BuildConfig.IS_COMET,
        device = "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})"
    )

    override fun openExternal(url: String) {
        app.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    override fun clipboardWrite(text: String) {
        val cm = app.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("myAmgi", text))
    }
}
