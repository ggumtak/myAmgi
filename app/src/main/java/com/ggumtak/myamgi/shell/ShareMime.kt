package com.ggumtak.myamgi.shell

import java.util.Locale

/** MIME types for files the shell shares or saves, and the picker filter for `<input type=file accept=…>`. */
object ShareMime {
    private val TYPES = mapOf(
        "apkg" to "application/octet-stream",
        "colpkg" to "application/octet-stream",
        "zip" to "application/zip",
        "txt" to "text/plain",
        "csv" to "text/csv",
        "tsv" to "text/tab-separated-values",
        "json" to "application/json",
        "html" to "text/html",
        "png" to "image/png",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
        "gif" to "image/gif",
        "webp" to "image/webp",
        "svg" to "image/svg+xml",
        "mp3" to "audio/mpeg",
        "ogg" to "audio/ogg",
        "oga" to "audio/ogg",
        "wav" to "audio/wav",
        "m4a" to "audio/mp4",
        "opus" to "audio/ogg",
        "mp4" to "video/mp4",
        "webm" to "video/webm"
    )

    fun of(name: String): String =
        TYPES[name.substringAfterLast('.', "").lowercase(Locale.ROOT)] ?: "application/octet-stream"

    /**
     * MIME types for the document picker from an `accept` list (`.apkg`, `image/` wildcards, `audio/mpeg`, …).
     * Only when everything accepted is media (image/audio/video) is the picker narrowed; Anki packages and
     * text files have no reliable MIME type on Android, so anything else opens the picker for all files.
     * Returns an empty list for "all files".
     */
    fun pickerTypes(accept: Array<String>?): List<String> {
        val items = accept.orEmpty().flatMap { it.split(',') }.map { it.trim().lowercase(Locale.ROOT) }.filter { it.isNotEmpty() }
        if (items.isEmpty()) return emptyList()
        val out = LinkedHashSet<String>()
        for (a in items) {
            val mime = if (a.startsWith(".")) TYPES[a.removePrefix(".")] else a
            if (mime == null || !(mime.startsWith("image/") || mime.startsWith("audio/") || mime.startsWith("video/"))) return emptyList()
            out.add(mime)
        }
        return out.toList()
    }
}
