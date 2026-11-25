package com.ggumtak.myamgi.host

import com.ggumtak.myamgi.engine.AnkiEngine
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * `.colpkg` backups in [dir], named like Anki's own (`backup-YYYY-MM-DD-HH.MM.SS.colpkg`) so Anki
 * desktop recognizes them. Backups exclude media, like Anki's automatic backups.
 * Pruned to the `backup.keep` preference (default [DEFAULT_KEEP]) after every new backup.
 */
class BackupService(
    val dir: File,
    private val prefs: Prefs,
    private val log: HostLog,
    /** Writes a collection package to the given file (injected for tests; default = engine export without media). */
    private val writer: (File) -> Unit = { f -> AnkiEngine.exportColpkg(f.absolutePath, includeMedia = false) },
    private val clock: () -> Long = System::currentTimeMillis
) {
    data class Entry(val name: String, val size: Long, val time: Long)

    private val lock = Any()

    /** Creates a backup now. [reason] is only logged ("manual", "before-restore", ...). */
    fun create(reason: String, prune: Boolean = true): Entry = synchronized(lock) {
        dir.mkdirs()
        val stamp = SimpleDateFormat("yyyy-MM-dd-HH.mm.ss", Locale.ROOT).format(Date(clock()))
        var target = File(dir, "backup-$stamp.colpkg")
        var n = 1
        while (target.exists()) target = File(dir, "backup-$stamp-${n++}.colpkg")
        val partial = File(dir, ".${target.name}.part")
        try {
            writer(partial)
            if (!partial.renameTo(target)) throw IllegalStateException("백업 파일 이름을 바꾸지 못했습니다")
        } finally {
            partial.delete()
        }
        log.info("backup created (${reason}): ${target.name} ${target.length()} bytes")
        if (prune) prune()
        Entry(target.name, target.length(), target.lastModified())
    }

    fun list(): List<Entry> {
        val files = dir.listFiles { f -> f.isFile && f.name.endsWith(".colpkg") && !f.name.startsWith(".") }
            ?: return emptyList()
        return files.map { Entry(it.name, it.length(), it.lastModified()) }
            .sortedWith(compareByDescending<Entry> { it.time }.thenByDescending { it.name })
    }

    fun keep(): Int = prefs.int("backup.keep", DEFAULT_KEEP).coerceIn(1, 500)

    /** Deletes the oldest backups beyond [keep]. Returns the deleted names. */
    fun prune(keep: Int = keep()): List<String> = synchronized(lock) {
        val all = list()
        val doomed = all.drop(keep)
        doomed.forEach { File(dir, it.name).delete() }
        if (doomed.isNotEmpty()) log.info("backup pruned: ${doomed.joinToString()}")
        doomed.map { it.name }
    }

    fun file(name: String): File {
        if (name.isEmpty() || name.contains('/') || name.contains('\\') || name.startsWith(".") || !name.endsWith(".colpkg")) {
            throw HostError.badRequest("잘못된 백업 이름입니다: $name", "invalid-name")
        }
        val f = File(dir, name)
        if (!f.isFile) throw HostError(404, "백업을 찾을 수 없습니다: $name", "not-found")
        return f
    }

    /** Backs up the current collection, then replaces it with backup [name]. */
    fun restore(name: String): Entry = synchronized(lock) {
        val source = file(name)
        val safety = create("before-restore", prune = false)
        log.info("restoring backup $name (safety backup ${safety.name})")
        AnkiEngine.importColpkg(source.absolutePath)
        prune()
        safety
    }

    companion object {
        const val DEFAULT_KEEP = 20
    }
}
