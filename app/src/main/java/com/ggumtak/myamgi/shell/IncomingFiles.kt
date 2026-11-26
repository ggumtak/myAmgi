package com.ggumtak.myamgi.shell

import android.content.ContentResolver
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import com.ggumtak.myamgi.host.HostApi
import java.io.File
import java.util.UUID

/** Files handed to the app ("다른 앱으로 열기" / 공유): copied into the host's upload dir for `import.file`. */
object IncomingFiles {
    /** The content URIs an intent carries (VIEW data, SEND / SEND_MULTIPLE streams). */
    fun urisOf(intent: Intent?): List<Uri> {
        intent ?: return emptyList()
        return when (intent.action) {
            Intent.ACTION_VIEW -> listOfNotNull(intent.data)
            Intent.ACTION_SEND -> listOfNotNull(
                if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java)
                else @Suppress("DEPRECATION") intent.getParcelableExtra(Intent.EXTRA_STREAM)
            )
            Intent.ACTION_SEND_MULTIPLE -> (
                if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java)
                else @Suppress("DEPRECATION") intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM)
                ).orEmpty()
            else -> emptyList()
        }
    }

    /**
     * Copies [uri] into its own directory under [uploadDir], keeping the display name (as `/api/host/upload`
     * does): the official import page shows the file's name, so `upload-1a2b3c.apkg` would confuse the owner.
     * Blocking.
     */
    fun copy(resolver: ContentResolver, uri: Uri, uploadDir: File): OpenFileQueue.Item {
        val name = HostApi.safeFileName(displayName(resolver, uri) ?: uri.lastPathSegment?.substringAfterLast('/') ?: "file")
        val dir = File(uploadDir, "upload-${UUID.randomUUID().toString().take(12)}")
        dir.mkdirs()
        val target = File(dir, name)
        try {
            val input = resolver.openInputStream(uri) ?: throw java.io.IOException("cannot open $uri")
            input.use { i -> target.outputStream().use { o -> i.copyTo(o, 64 * 1024) } }
        } catch (t: Throwable) {
            dir.deleteRecursively()
            throw t
        }
        return OpenFileQueue.Item(target.absolutePath, name)
    }

    private fun displayName(resolver: ContentResolver, uri: Uri): String? {
        if (uri.scheme == ContentResolver.SCHEME_FILE) return uri.lastPathSegment
        return runCatching {
            resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            }
        }.getOrNull()?.takeIf { it.isNotBlank() }
    }
}
