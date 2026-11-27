package com.ggumtak.myamgi.host

import com.ggumtak.myamgi.engine.AnkiEngine
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import java.io.File
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

/**
 * Host functions behind `POST /api/host/<name>`. Engine-only functions are implemented here;
 * shell-only ones delegate to [Platform].
 */
class HostApi(
    val dataDir: File,
    val platform: Platform,
    val ui: UiBundle,
    val events: EventBus,
    val log: HostLog,
    syncTransport: SyncTransport = EngineSyncTransport()
) {
    val prefs = Prefs(File(dataDir, "prefs.json"))
    val progress = ProgressPump(events)
    val backups = BackupService(File(dataDir, "backups"), prefs, log)
    val uploadDir: File = File(dataDir, "tmp/upload")
    val exportDir: File = File(dataDir, "tmp/export")
    val sync = SyncService(
        stateFile = File(dataDir, "host/sync.json"),
        transport = syncTransport,
        events = events,
        progress = progress,
        log = log,
        prefs = prefs,
        backupBeforeDownload = { backups.create("before-full-download") },
        onRunningChanged = { running, text -> platform.onSyncRunningChanged(running, text) }
    )

    private val handlers: Map<String, (JsonObject) -> JsonElement> = mapOf(
        "info" to { _ -> info() },
        "prefs.get" to { _ -> prefs.all() },
        "prefs.set" to { a -> prefs.set(a) },
        "collection.status" to { _ -> collectionStatus() },
        "sync.status" to { _ -> sync.status() },
        "sync.login" to { a -> sync.login(a.str("user").orEmpty(), a.str("password").orEmpty(), a.str("endpoint")) },
        "sync.logout" to { _ -> sync.logout() },
        "sync.run" to { a -> sync.run(a.str("mode") ?: "normal") },
        "sync.abort" to { _ -> sync.abort() },
        "backup.create" to { _ -> entryJson(progress.run("backup") { backups.create("manual") }) },
        "backup.list" to { _ -> jsonOf("keep" to backups.keep(), "backups" to backups.list().map { entryJson(it) }) },
        "backup.restore" to { a ->
            val safety = progress.run("restore") { backups.restore(a.requireStr("name")) }
            jsonOf("ok" to true, "safetyBackup" to safety.name)
        },
        "import.file" to { a -> importFile(a) },
        "export.package" to { a -> exportPackage(a) },
        "export.collection" to { a -> exportCollection(a) },
        "log.get" to { _ -> logGet() },
        "platform.share" to { a -> platform.share(hostTempFile(a.requireStr("path")), a.str("name") ?: File(a.requireStr("path")).name); ok() },
        "platform.openExternal" to { a -> platform.openExternal(checkUrl(a.requireStr("url"))); ok() },
        "platform.tts" to { a -> platform.tts(a.requireStr("text"), a.str("lang"), a.double("rate")); ok() },
        "platform.ttsStop" to { _ -> platform.ttsStop(); ok() },
        "platform.clipboardWrite" to { a -> platform.clipboardWrite(a.str("text").orEmpty()); ok() },
        "hanja.lookup" to { a -> platform.hanjaLookup(a.requireStr("text"), a.str("sentence")); ok() },
        "update.status" to { _ -> platform.updateStatus() },
        "update.check" to { _ -> platform.updateCheck() },
        "update.apply" to { _ -> platform.updateApply() }
        // "platform.exit" is handled by HostServer (it must answer before exiting).
    )

    val names: Set<String> get() = handlers.keys + "platform.exit"

    fun call(name: String, args: JsonObject): JsonElement {
        val h = handlers[name] ?: throw HostError(404, "알 수 없는 기능입니다: $name", "unknown-function")
        return h(args)
    }

    private fun ok() = jsonOf("ok" to true)

    fun info(): JsonObject {
        val p = platform.info()
        return jsonOf(
            "appVersion" to p.appVersion,
            "build" to p.build,
            "flavor" to p.flavor,
            "platform" to p.platform,
            "eink" to p.eink,
            "device" to p.device,
            "uiVersion" to ui.version(),
            "backendVersion" to BACKEND_VERSION
        )
    }

    fun collectionStatus(): JsonObject {
        val dir = runCatching { AnkiEngine.getCollectionDir() }.getOrNull()
        val col = dir?.let { File(it, "collection.anki2") }
        return jsonOf(
            "open" to AnkiEngine.isCollectionOpen(),
            "path" to col?.absolutePath,
            // the WAL holds recent changes until the next checkpoint
            "size" to listOfNotNull(col, col?.let { File(it.path + "-wal") }).filter { it.isFile }.sumOf { it.length() },
            "mediaDir" to dir?.let { File(it, "collection.media").absolutePath },
            "lastError" to log.lastError()
        )
    }

    private fun entryJson(e: BackupService.Entry) = jsonOf("name" to e.name, "size" to e.size, "time" to e.time)

    private fun logGet(): JsonObject {
        val (lines, errors) = log.snapshot()
        return jsonOf("lines" to lines, "errors" to errors, "text" to lines.joinToString("\n"))
    }

    private fun checkUrl(url: String): String {
        val lower = url.lowercase(Locale.ROOT)
        if (!(lower.startsWith("https://") || lower.startsWith("http://") || lower.startsWith("mailto:"))) {
            throw HostError.badRequest("열 수 없는 주소입니다: $url", "bad-url")
        }
        return url
    }

    /** A file the host created or received: must live under `dataDir/tmp`. */
    fun hostTempFile(path: String): File {
        val root = File(dataDir, "tmp").canonicalFile
        val f = File(path).canonicalFile
        if (!f.path.startsWith(root.path + File.separator) || !f.isFile) {
            throw HostError(403, "이 파일은 사용할 수 없습니다.", "path-not-allowed")
        }
        return f
    }

    // --- Import / export ---

    /**
     * Classifies an uploaded file. `.apkg` and text files continue in the official import pages
     * (the returned `route`); `.colpkg` replaces the whole collection, so it only runs with
     * `replace: true` (after an automatic backup), otherwise `needsConfirm` is returned.
     */
    fun importFile(a: JsonObject): JsonObject {
        val file = hostTempFile(a.requireStr("path"))
        val name = a.str("name") ?: file.name
        val ext = name.substringAfterLast('.', "").lowercase(Locale.ROOT)
        val encoded = URLEncoder.encode(file.absolutePath, "UTF-8").replace("+", "%20")
        return when (ext) {
            "apkg", "zip" -> jsonOf("kind" to "apkg", "path" to file.absolutePath, "route" to "/import-anki-package/$encoded")
            "colpkg" -> {
                if (!a.bool("replace", false)) {
                    jsonOf("kind" to "colpkg", "path" to file.absolutePath, "needsConfirm" to true, "route" to null)
                } else {
                    val safety = progress.run("import") {
                        val b = backups.create("before-colpkg-import", prune = false)
                        AnkiEngine.importColpkg(file.absolutePath)
                        backups.prune()
                        b
                    }
                    log.info("collection replaced from $name")
                    jsonOf("kind" to "colpkg", "path" to file.absolutePath, "imported" to true, "safetyBackup" to safety.name, "route" to null)
                }
            }
            "txt", "csv", "tsv" -> {
                val detectedEncoding = CsvEncoding.ensureUtf8(file)
                log.info("csv normalized: $name ($detectedEncoding -> UTF-8)")
                jsonOf(
                    "kind" to "csv",
                    "path" to file.absolutePath,
                    "route" to "/import-csv/$encoded",
                    "detectedEncoding" to detectedEncoding
                )
            }
            else -> throw HostError.badRequest("가져올 수 없는 파일 형식입니다: $name (.apkg, .colpkg, .txt, .csv, .tsv)", "unsupported-type")
        }
    }

    fun exportPackage(a: JsonObject): JsonObject {
        val deckId = a.long("deckId")?.takeIf { it > 0 }
        val base = if (deckId != null) {
            AnkiEngine.getDeckNames().firstOrNull { it.id == deckId }?.name
                ?: throw HostError(404, "덱을 찾을 수 없습니다: $deckId", "deck-not-found")
        } else {
            "myAmgi-전체"
        }
        val legacy = a.bool("legacy", false)
        val out = newExportFile(safeFileName(base.replace("::", "_")), "apkg")
        val count = progress.run("export") {
            AnkiEngine.exportApkg(
                out.file.absolutePath, deckId,
                includeScheduling = a.bool("withScheduling", true),
                includeMedia = a.bool("withMedia", true),
                legacy = legacy
            )
        }
        log.info("exported ${out.name} ($count notes)")
        return jsonOf("path" to out.file.absolutePath, "name" to out.name, "notes" to count, "size" to out.file.length())
    }

    fun exportCollection(a: JsonObject): JsonObject {
        val stamp = SimpleDateFormat("yyyyMMdd-HHmm", Locale.ROOT).format(Date())
        val out = newExportFile("myAmgi-$stamp", "colpkg")
        progress.run("export") {
            AnkiEngine.exportColpkg(out.file.absolutePath, includeMedia = a.bool("withMedia", true), legacy = a.bool("legacy", false))
        }
        log.info("exported ${out.name}")
        return jsonOf("path" to out.file.absolutePath, "name" to out.name, "size" to out.file.length())
    }

    /**
     * On-disk names stay ASCII: a JVM running under a non-UTF-8 locale cannot name files the way the
     * Rust backend does. The display name travels separately ([ExportFile.name]).
     */
    private fun newExportFile(base: String, ext: String): ExportFile {
        exportDir.mkdirs()
        val f = File(exportDir, "export-${UUID.randomUUID().toString().take(12)}.$ext")
        return ExportFile(f, "$base.$ext")
    }

    private class ExportFile(val file: File, val name: String)

    /** Deletes temp uploads/exports older than a day (called at start). */
    fun cleanTemp(maxAgeMillis: Long = 24 * 60 * 60 * 1000L) {
        val cutoff = System.currentTimeMillis() - maxAgeMillis
        for (d in listOf(uploadDir, exportDir)) {
            d.listFiles()?.filter { it.isFile && it.lastModified() < cutoff }?.forEach { it.delete() }
        }
    }

    companion object {
        val BACKEND_VERSION: String =
            "Anki ${net.ankiweb.rsdroid.BuildConfig.ANKI_DESKTOP_VERSION} (anki-backend 0.1.77)"

        fun safeFileName(name: String): String {
            val cleaned = name.replace(Regex("[\\\\/:*?\"<>|\\u0000-\\u001f]"), "_").trim().trim('.')
            return cleaned.ifEmpty { "file" }.take(120)
        }
    }
}
