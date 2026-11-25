package com.ggumtak.myamgi.host

internal object Mime {
    private val TYPES = mapOf(
        "html" to "text/html; charset=utf-8",
        "htm" to "text/html; charset=utf-8",
        "js" to "application/javascript; charset=utf-8",
        "mjs" to "application/javascript; charset=utf-8",
        "css" to "text/css; charset=utf-8",
        "json" to "application/json; charset=utf-8",
        "map" to "application/json; charset=utf-8",
        "txt" to "text/plain; charset=utf-8",
        "csv" to "text/csv; charset=utf-8",
        "xml" to "application/xml",
        "svg" to "image/svg+xml",
        "png" to "image/png",
        "jpg" to "image/jpeg",
        "jpeg" to "image/jpeg",
        "gif" to "image/gif",
        "webp" to "image/webp",
        "avif" to "image/avif",
        "bmp" to "image/bmp",
        "ico" to "image/x-icon",
        "tif" to "image/tiff",
        "tiff" to "image/tiff",
        "mp3" to "audio/mpeg",
        "m4a" to "audio/mp4",
        "aac" to "audio/aac",
        "ogg" to "audio/ogg",
        "oga" to "audio/ogg",
        "opus" to "audio/ogg",
        "wav" to "audio/wav",
        "flac" to "audio/flac",
        "spx" to "audio/ogg",
        "mp4" to "video/mp4",
        "m4v" to "video/mp4",
        "webm" to "video/webm",
        "ogv" to "video/ogg",
        "mov" to "video/quicktime",
        "mkv" to "video/x-matroska",
        "3gp" to "video/3gpp",
        "woff" to "font/woff",
        "woff2" to "font/woff2",
        "ttf" to "font/ttf",
        "otf" to "font/otf",
        "pdf" to "application/pdf",
        "wasm" to "application/wasm",
        "apkg" to "application/octet-stream",
        "colpkg" to "application/octet-stream"
    )

    fun of(name: String): String =
        TYPES[name.substringAfterLast('.', "").lowercase()] ?: "application/octet-stream"
}
