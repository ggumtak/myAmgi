package com.ggumtak.myamgi.render

import android.content.Context
import android.util.LruCache
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.engine.AnkiEngine
import java.io.File
import java.net.URLDecoder
import java.util.Locale

/**
 * In-memory LRU cache for Anki collection media files.
 * Capacity is sized dynamically from [DeviceProfile.mediaCacheBytes] (16MB on Pro, 4MB on Comet).
 */
object MediaCache {
    private const val DEFAULT_CACHE_BYTES = 4 * 1024 * 1024
    private const val MAX_CACHEABLE_ENTRY_BYTES = 2 * 1024 * 1024 // 2MB per file

    private val lock = Any()

    @Volatile
    private var cache: LruCache<String, ByteArray>? = null

    fun init(context: Context) {
        val targetBytes = DeviceProfile.current(context).mediaCacheBytes.coerceAtLeast(1024 * 1024)
        synchronized(lock) {
            val existing = cache
            if (existing != null && existing.maxSize() == targetBytes) {
                return
            }
            cache = createLruCache(targetBytes)
        }
    }

    private fun ensureCache(): LruCache<String, ByteArray> {
        cache?.let { return it }
        synchronized(lock) {
            cache?.let { return it }
            return createLruCache(DEFAULT_CACHE_BYTES).also { cache = it }
        }
    }

    private fun createLruCache(maxBytes: Int): LruCache<String, ByteArray> {
        return object : LruCache<String, ByteArray>(maxBytes) {
            override fun sizeOf(key: String, value: ByteArray): Int = value.size
        }
    }

    fun getMediaBytes(filename: String): ByteArray? {
        val normalized = normalizeFilename(filename) ?: return null
        val lru = ensureCache()
        lru.get(normalized)?.let { return it }

        val mediaDir = runCatching { AnkiEngine.getMediaDir() }.getOrNull() ?: return null
        val file = resolveSafeMediaFile(mediaDir, normalized) ?: return null
        if (!file.isFile || !file.canRead()) return null

        val bytes = runCatching { file.readBytes() }.getOrNull() ?: return null
        if (bytes.size <= MAX_CACHEABLE_ENTRY_BYTES) {
            lru.put(normalized, bytes)
        }
        return bytes
    }

    fun invalidate(filename: String? = null) {
        val lru = cache ?: return
        if (filename == null) {
            lru.evictAll()
        } else {
            val normalized = normalizeFilename(filename)
            if (normalized != null) {
                lru.remove(normalized)
            }
            lru.remove(filename)
        }
    }

    fun guessMimeType(filename: String): String {
        val cleanName = filename.substringBefore('?').substringBefore('#')
        val ext = cleanName.substringAfterLast('.', "").lowercase(Locale.ROOT)
        return when (ext) {
            "png" -> "image/png"
            "jpg", "jpeg" -> "image/jpeg"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "svg" -> "image/svg+xml"
            "mp3" -> "audio/mpeg"
            "ogg" -> "audio/ogg"
            "wav" -> "audio/wav"
            "m4a" -> "audio/mp4"
            "mp4" -> "video/mp4"
            "webm" -> "video/webm"
            "ttf" -> "font/ttf"
            "otf" -> "font/otf"
            "woff" -> "font/woff"
            "woff2" -> "font/woff2"
            "css" -> "text/css"
            "js" -> "application/javascript"
            "json" -> "application/json"
            "html" -> "text/html"
            else -> "application/octet-stream"
        }
    }

    private fun normalizeFilename(raw: String): String? {
        val withoutQuery = raw.substringBefore('?').substringBefore('#').trim()
        if (withoutQuery.isEmpty()) return null

        val decoded = runCatching {
            URLDecoder.decode(withoutQuery, Charsets.UTF_8.name())
        }.getOrDefault(withoutQuery)

        val cleaned = decoded
            .replace('\\', '/')
            .trimStart('/')
            .removePrefix("./")

        if (cleaned.isEmpty() || cleaned.contains('\u0000')) return null

        val segments = cleaned.split('/')
        if (segments.any { it == ".." || it == "." || it.isEmpty() }) return null
        return cleaned
    }

    private fun resolveSafeMediaFile(mediaDir: File, relativeName: String): File? {
        return runCatching {
            val canonicalRoot = mediaDir.canonicalFile
            val target = File(canonicalRoot, relativeName).canonicalFile
            val rootPath = canonicalRoot.path
            val targetPath = target.path
            val isInside = targetPath == rootPath ||
                targetPath.startsWith(rootPath + File.separator)
            if (isInside) target else null
        }.getOrNull()
    }
}
