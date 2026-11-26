package com.ggumtak.myamgi.host

import android.content.Context
import com.ggumtak.myamgi.prefs.AppPrefs
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import java.io.File

/**
 * First start of the web-UI shell over a native-UI build (≤ 11). The collection (`filesDir/anki_collection`)
 * is not touched. Old SharedPreferences stay where they are (read only).
 *
 * - Study settings the owner chose move to the host prefs the web UI reads (`volumeKeys`, `twoButtons`,
 *   `tapToShowAnswer`, `theme`), only for keys the host prefs do not have yet.
 * - An AnkiWeb login saved by the native settings screen becomes the host's sync login (`host/sync.json`),
 *   only when the host has none.
 * - The old per-file OTA cache `filesDir/ota/` (card CSS/JS, editor, Hanja script copies downloaded by
 *   builds ≤ 11) is deleted: nothing reads it any more. It holds no user data.
 */
object LegacyMigration {
    private const val MARKER = "host/migrated-from-native-ui"

    fun run(context: Context, dataDir: File, log: HostLog) {
        val marker = File(dataDir, MARKER)
        if (marker.isFile) return
        runCatching {
            val old = File(context.filesDir, "ota")
            if (old.isDirectory) {
                old.deleteRecursively()
                log.info("removed the old per-file OTA cache")
            }
            val prefs = Prefs(File(dataDir, "prefs.json"))
            val have = prefs.all()
            val legacy = AppPrefs.legacyUiPrefs(context)
            val add = legacy.filterKeys { it !in have }
            if (add.isNotEmpty()) {
                prefs.set(JsonObject(add.mapValues { (_, v) -> HostRuntime.toJsonValue(v) }))
                log.info("migrated native settings: ${add.keys.joinToString(",")}")
            }
            val syncFile = File(dataDir, "host/sync.json")
            val login = AppPrefs.legacyAnkiWebLogin(context)
            if (!syncFile.exists() && login != null) {
                syncFile.parentFile?.mkdirs()
                syncFile.writeText(
                    JsonObject(
                        mapOf(
                            "user" to JsonPrimitive(login.user),
                            "hkey" to JsonPrimitive(login.hkey),
                            "endpoint" to JsonPrimitive(login.endpoint.ifBlank { null })
                        )
                    ).toString()
                )
                log.info("migrated the AnkiWeb login")
            }
        }.onFailure { log.error("migration from the native UI failed", it) }
        marker.parentFile?.mkdirs()
        runCatching { marker.writeText(System.currentTimeMillis().toString()) }
    }
}
