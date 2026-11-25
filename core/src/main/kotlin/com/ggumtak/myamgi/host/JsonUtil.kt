package com.ggumtak.myamgi.host

import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.longOrNull

internal fun JsonObject.str(key: String): String? = (this[key] as? JsonPrimitive)?.takeIf { it !is JsonNull }?.contentOrNull

internal fun JsonObject.bool(key: String, default: Boolean): Boolean =
    (this[key] as? JsonPrimitive)?.booleanOrNull ?: default

internal fun JsonObject.long(key: String): Long? = (this[key] as? JsonPrimitive)?.let {
    it.longOrNull ?: it.contentOrNull?.toLongOrNull()
}

internal fun JsonObject.double(key: String): Double? = (this[key] as? JsonPrimitive)?.doubleOrNull

internal fun JsonObject.requireStr(key: String): String =
    str(key)?.takeIf { it.isNotEmpty() } ?: throw HostError.badRequest("필수 값이 없습니다: $key", "missing:$key")

/** Small builder: `jsonOf("a" to 1, "b" to null)`; nulls become JSON null. */
internal fun jsonOf(vararg pairs: Pair<String, Any?>): JsonObject = JsonObject(pairs.associate { (k, v) -> k to toJson(v) })

internal fun toJson(v: Any?): JsonElement = when (v) {
    null -> JsonNull
    is JsonElement -> v
    is String -> JsonPrimitive(v)
    is Number -> JsonPrimitive(v)
    is Boolean -> JsonPrimitive(v)
    is Map<*, *> -> JsonObject(v.entries.associate { (k, value) -> k.toString() to toJson(value) })
    is Iterable<*> -> kotlinx.serialization.json.JsonArray(v.map { toJson(it) })
    else -> JsonPrimitive(v.toString())
}
