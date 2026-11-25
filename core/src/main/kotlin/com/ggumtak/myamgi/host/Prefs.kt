package com.ggumtak.myamgi.host

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File

/** UI preferences: one JSON object in a file, merged on `set`, written atomically. */
class Prefs(private val file: File) {
    private var cache: JsonObject? = null

    @Synchronized
    fun all(): JsonObject {
        cache?.let { return it }
        val loaded = readJsonObjectFile(file) ?: JsonObject(emptyMap())
        cache = loaded
        return loaded
    }

    /** Merges [changes] into the stored object; a JSON `null` value removes the key. */
    @Synchronized
    fun set(changes: JsonObject): JsonObject {
        val merged = LinkedHashMap(all())
        for ((k, v) in changes) {
            if (v is JsonNull) merged.remove(k) else merged[k] = v
        }
        val obj = JsonObject(merged)
        writeFileAtomically(file, Json.encodeToString(JsonElement.serializer(), obj).toByteArray(Charsets.UTF_8))
        cache = obj
        return obj
    }

    fun int(key: String, default: Int): Int =
        runCatching { all()[key]?.jsonPrimitive?.intOrNull }.getOrNull() ?: default

    fun bool(key: String, default: Boolean): Boolean =
        runCatching { all()[key]?.jsonPrimitive?.booleanOrNull }.getOrNull() ?: default
}

internal fun readJsonObjectFile(file: File): JsonObject? {
    if (!file.isFile) return null
    return runCatching { Json.parseToJsonElement(file.readText(Charsets.UTF_8)).jsonObject }.getOrNull()
}

/** Writes to a sibling temp file and renames it over [target], so readers never see a partial file. */
internal fun writeFileAtomically(target: File, bytes: ByteArray) {
    target.parentFile?.mkdirs()
    val tmp = File(target.parentFile, ".${target.name}.tmp")
    tmp.outputStream().use { out ->
        out.write(bytes)
        out.fd.sync()
    }
    try {
        java.nio.file.Files.move(
            tmp.toPath(), target.toPath(),
            java.nio.file.StandardCopyOption.REPLACE_EXISTING,
            java.nio.file.StandardCopyOption.ATOMIC_MOVE
        )
    } catch (_: java.nio.file.AtomicMoveNotSupportedException) {
        java.nio.file.Files.move(tmp.toPath(), target.toPath(), java.nio.file.StandardCopyOption.REPLACE_EXISTING)
    }
}
