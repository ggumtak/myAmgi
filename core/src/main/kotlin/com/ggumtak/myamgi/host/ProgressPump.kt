package com.ggumtak.myamgi.host

import anki.collection.Progress
import com.ggumtak.myamgi.engine.AnkiEngine
import kotlinx.serialization.json.JsonObject

/**
 * Runs a long operation while forwarding backend progress as `progress` events:
 * `{op, phase: "start"|"running"|"done"|"error", ...details}`.
 */
class ProgressPump(
    private val events: EventBus,
    private val source: () -> JsonObject? = { AnkiEngine.latestProgress()?.let(::progressToJson) },
    private val intervalMillis: Long = 250
) {
    fun <T> run(op: String, block: () -> T): T {
        events.publish("progress", jsonOf("op" to op, "phase" to "start"))
        val running = java.util.concurrent.atomic.AtomicBoolean(true)
        val poller = Thread({
            var last: JsonObject? = null
            while (running.get()) {
                val p = runCatching { source() }.getOrNull()
                if (p != null && p != last && p.str("kind") != "none") {
                    last = p
                    events.publish("progress", JsonObject(mapOf("op" to toJson(op), "phase" to toJson("running")) + p))
                }
                try {
                    Thread.sleep(intervalMillis)
                } catch (_: InterruptedException) {
                    break
                }
            }
        }, "amgi-progress-$op").apply { isDaemon = true; start() }
        try {
            val result = block()
            events.publish("progress", jsonOf("op" to op, "phase" to "done"))
            return result
        } catch (t: Throwable) {
            events.publish("progress", jsonOf("op" to op, "phase" to "error", "error" to (t.message ?: t.toString())))
            throw t
        } finally {
            running.set(false)
            poller.interrupt()
        }
    }

    /** Publishes a one-off progress detail for [op] (e.g. a phase change the backend does not report). */
    fun note(op: String, text: String) {
        events.publish("progress", jsonOf("op" to op, "phase" to "running", "kind" to "note", "text" to text))
    }
}

fun progressToJson(p: Progress): JsonObject = when (p.valueCase) {
    Progress.ValueCase.NORMAL_SYNC -> jsonOf(
        "kind" to "normalSync", "stage" to p.normalSync.stage, "added" to p.normalSync.added, "removed" to p.normalSync.removed
    )
    Progress.ValueCase.FULL_SYNC -> jsonOf(
        "kind" to "fullSync", "transferred" to p.fullSync.transferred, "total" to p.fullSync.total
    )
    Progress.ValueCase.MEDIA_SYNC -> buildMediaSyncProgressJson(
        checked = p.mediaSync.checked.ifBlank { null },
        added = p.mediaSync.added.ifBlank { null },
        removed = p.mediaSync.removed.ifBlank { null }
    )
    Progress.ValueCase.IMPORTING -> jsonOf("kind" to "importing", "text" to p.importing)
    Progress.ValueCase.EXPORTING -> jsonOf("kind" to "exporting", "text" to p.exporting)
    Progress.ValueCase.MEDIA_CHECK -> jsonOf("kind" to "mediaCheck", "text" to p.mediaCheck)
    Progress.ValueCase.DATABASE_CHECK -> jsonOf(
        "kind" to "databaseCheck", "text" to p.databaseCheck.stage,
        "current" to p.databaseCheck.stageCurrent, "total" to p.databaseCheck.stageTotal
    )
    Progress.ValueCase.NONE, Progress.ValueCase.VALUE_NOT_SET, null -> jsonOf("kind" to "none")
    else -> jsonOf("kind" to p.valueCase.name.lowercase())
}

/**
 * Builds a consistent `mediaSync` progress payload, omitting unset fields rather than emitting
 * JSON nulls so frontend string formatters never render `"null"`.
 */
internal fun buildMediaSyncProgressJson(
    checked: String? = null,
    added: String? = null,
    removed: String? = null,
    op: String? = null,
    phase: String? = null,
    error: String? = null
): JsonObject {
    val map = LinkedHashMap<String, kotlinx.serialization.json.JsonElement>()
    if (op != null) map["op"] = toJson(op)
    if (phase != null) map["phase"] = toJson(phase)
    map["kind"] = toJson("mediaSync")
    if (!checked.isNullOrBlank()) map["checked"] = toJson(checked)
    if (!added.isNullOrBlank()) map["added"] = toJson(added)
    if (!removed.isNullOrBlank()) map["removed"] = toJson(removed)
    if (!error.isNullOrBlank()) map["error"] = toJson(error)
    return JsonObject(map)
}
