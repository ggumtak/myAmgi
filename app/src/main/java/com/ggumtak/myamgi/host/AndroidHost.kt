package com.ggumtak.myamgi.host

import android.content.res.AssetManager
import java.io.InputStream

/** APK assets below [prefix] (`ui/` = built-in UI bundle, `backend/` = official Anki web assets). */
class AndroidAssetSource(private val assets: AssetManager, private val prefix: String) : AssetSource {
    override fun open(path: String): InputStream? =
        if (path.isEmpty() || path.endsWith("/")) null else runCatching { assets.open(prefix + path) }.getOrNull()
}
