package com.ggumtak.myamgi.host

import java.io.File
import java.io.InputStream

/**
 * Read-only file tree the host serves from: the APK `AssetManager` on Android, the classpath or a
 * directory on desktop. Paths are relative, `/`-separated, without a leading slash, and already
 * validated by the caller (no `..` segments).
 */
fun interface AssetSource {
    /** Opens [path], or returns null if it does not exist. */
    fun open(path: String): InputStream?

    companion object {
        val EMPTY = AssetSource { null }
    }
}

/** Serves files below [root]; never escapes it. */
class DirAssetSource(root: File) : AssetSource {
    private val root: File = root.canonicalFile

    fun file(path: String): File? {
        val target = File(root, path).canonicalFile
        if (target.path != root.path && !target.path.startsWith(root.path + File.separator)) return null
        return target.takeIf { it.isFile }
    }

    override fun open(path: String): InputStream? = file(path)?.inputStream()
}

/** Serves classpath resources below [prefix] (e.g. `amgi/backend/`). */
class ClasspathAssetSource(
    private val prefix: String,
    private val loader: ClassLoader = ClasspathAssetSource::class.java.classLoader
) : AssetSource {
    override fun open(path: String): InputStream? {
        if (path.isEmpty() || path.endsWith("/")) return null
        return loader.getResourceAsStream(prefix + path)
    }
}

/** Splits a URL path into safe relative segments; null if it contains traversal or odd characters. */
internal fun safeRelativePath(path: String): String? {
    val trimmed = path.trimStart('/')
    if (trimmed.isEmpty()) return ""
    if (trimmed.contains('\\') || trimmed.contains('\u0000')) return null
    val segments = trimmed.split('/')
    for ((i, seg) in segments.withIndex()) {
        if (seg == "." || seg == "..") return null
        if (seg.isEmpty() && i != segments.lastIndex) return null
    }
    return trimmed
}
