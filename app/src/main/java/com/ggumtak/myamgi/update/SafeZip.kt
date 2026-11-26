package com.ggumtak.myamgi.update

import java.io.File
import java.io.IOException
import java.util.zip.ZipFile

/** Unpacks a ZIP without letting any entry escape the target (zip-slip) or blow up the disk. */
object SafeZip {
    class UnsafeZipException(message: String) : IOException(message)

    /** Returns the number of files written. [dest] must be empty or absent. */
    fun extract(zip: File, dest: File, maxEntries: Int = 5_000, maxTotalBytes: Long = 300L * 1024 * 1024): Int {
        dest.mkdirs()
        val root = dest.canonicalFile
        var total = 0L
        var files = 0
        ZipFile(zip).use { zf ->
            val entries = zf.entries().toList()
            if (entries.size > maxEntries) throw UnsafeZipException("too many entries: ${entries.size}")
            for (e in entries) {
                val rel = safeEntryName(e.name) ?: throw UnsafeZipException("unsafe entry: ${e.name}")
                val target = File(root, rel).canonicalFile
                if (target.path != root.path && !target.path.startsWith(root.path + File.separator)) {
                    throw UnsafeZipException("entry escapes target: ${e.name}")
                }
                if (e.isDirectory) {
                    target.mkdirs()
                    continue
                }
                target.parentFile?.mkdirs()
                zf.getInputStream(e).use { input ->
                    target.outputStream().use { out ->
                        val buf = ByteArray(64 * 1024)
                        while (true) {
                            val n = input.read(buf)
                            if (n < 0) break
                            total += n
                            if (total > maxTotalBytes) throw UnsafeZipException("archive expands beyond $maxTotalBytes bytes")
                            out.write(buf, 0, n)
                        }
                    }
                }
                files++
            }
        }
        return files
    }

    /** A relative `/`-separated name without `..`, absolute paths, drive letters or control characters. */
    fun safeEntryName(name: String): String? {
        if (name.isEmpty() || name.length > 512) return null
        if (name.contains('\\') || name.any { it < ' ' }) return null
        if (name.startsWith("/") || Regex("^[A-Za-z]:").containsMatchIn(name)) return null
        val trimmed = name.trimEnd('/')
        if (trimmed.isEmpty()) return null
        val segs = trimmed.split('/')
        if (segs.any { it.isEmpty() || it == "." || it == ".." }) return null
        return trimmed
    }
}
