package com.ggumtak.myamgi.update

import android.content.Context
import java.io.File
import java.security.MessageDigest

/**
 * Loads web/JS/CSS assets with OTA override support:
 * if an OTA-updated copy exists under `filesDir/ota/<assetPath>` and is non-empty,
 * it takes precedence over the APK's bundled `assets/<assetPath>`.
 */
object AssetLoader {
    fun otaDir(context: Context): File =
        File(context.applicationContext.filesDir, "ota")

    fun otaFile(context: Context, assetPath: String): File {
        val cleanPath = sanitizeRelativePath(assetPath)
        val root = otaDir(context).canonicalFile
        val target = File(root, cleanPath).canonicalFile
        val rootPath = root.path
        val targetPath = target.path
        require(targetPath == rootPath || targetPath.startsWith(rootPath + File.separator)) {
            "Invalid OTA asset path: $assetPath"
        }
        return target
    }

    fun hasOtaFile(context: Context, assetPath: String): Boolean {
        val file = runCatching { otaFile(context, assetPath) }.getOrNull() ?: return false
        return file.isFile && file.length() > 0L
    }

    fun readBytes(context: Context, assetPath: String): ByteArray {
        val cleanPath = sanitizeRelativePath(assetPath)
        val overrideFile = runCatching { otaFile(context, cleanPath) }.getOrNull()
        if (overrideFile != null && overrideFile.isFile && overrideFile.length() > 0L) {
            return overrideFile.readBytes()
        }
        return context.applicationContext.assets.open(cleanPath).use { it.readBytes() }
    }

    fun readText(context: Context, assetPath: String): String =
        readBytes(context, assetPath).toString(Charsets.UTF_8)

    fun sha256Hex(bytes: ByteArray): String {
        val digest = MessageDigest.getInstance("SHA-256").digest(bytes)
        val sb = StringBuilder(digest.size * 2)
        for (b in digest) {
            sb.append(HEX_CHARS[(b.toInt() ushr 4) and 0x0F])
            sb.append(HEX_CHARS[b.toInt() and 0x0F])
        }
        return sb.toString()
    }

    private fun sanitizeRelativePath(assetPath: String): String =
        assetPath.trim().replace('\\', '/').trimStart('/')

    private val HEX_CHARS = "0123456789abcdef".toCharArray()
}
