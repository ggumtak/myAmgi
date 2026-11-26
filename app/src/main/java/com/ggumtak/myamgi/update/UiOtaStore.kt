package com.ggumtak.myamgi.update

import com.ggumtak.myamgi.host.UiBundle
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull
import java.io.File

/**
 * The OTA UI bundle on disk and its safety state machine (pure JVM, unit-tested).
 *
 * Layout under [root] (`filesDir/ui-ota`):
 * - `current/` — the bundle [com.ggumtak.myamgi.host.HostServer] serves when it is newer than the built-in one
 * - `staging/` — a download being unpacked and checked; `trash/` — the previous bundle while it is swapped out
 * - `state.json` — `{active, pending, attempts, bad: [...], lastCheck}`
 *
 * States of the active bundle: none → (activate) pending → (ui.ready) confirmed. A pending bundle that does not
 * report ready in time, or that was started [MAX_ATTEMPTS] times without reporting, is rolled back: deleted and
 * its version remembered in `bad`, so it is never installed again (a newer version can be).
 */
class UiOtaStore(val root: File) {
    data class State(
        val active: String? = null,
        val pending: Boolean = false,
        val attempts: Int = 0,
        val bad: List<String> = emptyList(),
        val lastCheck: Long = 0L,
        val lastRollback: String? = null
    )

    val currentDir: File get() = File(root, "current")
    private val stagingDir: File get() = File(root, "staging")
    private val trashDir: File get() = File(root, "trash")
    private val stateFile: File get() = File(root, "state.json")

    @Volatile
    private var cached: State? = null

    @Synchronized
    fun state(): State {
        cached?.let { return it }
        val s = runCatching { parse(stateFile.readText()) }.getOrNull() ?: State()
        cached = s
        return s
    }

    @Synchronized
    private fun save(s: State) {
        root.mkdirs()
        val json = JsonObject(
            mapOf(
                "active" to JsonPrimitive(s.active),
                "pending" to JsonPrimitive(s.pending),
                "attempts" to JsonPrimitive(s.attempts),
                "bad" to JsonArray(s.bad.map { JsonPrimitive(it) }),
                "lastCheck" to JsonPrimitive(s.lastCheck),
                "lastRollback" to JsonPrimitive(s.lastRollback)
            )
        ).toString()
        val tmp = File(root, ".state.json.tmp")
        tmp.writeText(json)
        if (!tmp.renameTo(stateFile)) {
            stateFile.delete()
            tmp.renameTo(stateFile)
        }
        cached = s
    }

    @Synchronized
    fun update(f: (State) -> State): State = f(state()).also { save(it) }

    /**
     * At start: clears leftovers of an interrupted install and drops a bundle that is invalid or no newer than
     * the built-in one (an APK update brought a newer UI). Returns the version rolled back, if any.
     */
    @Synchronized
    fun recover(builtInVersion: String?): String? {
        stagingDir.deleteRecursively()
        trashDir.deleteRecursively()
        val s = state()
        val onDisk = bundleVersion(currentDir)
        if (onDisk == null || (builtInVersion != null && UiBundle.compareVersions(onDisk, builtInVersion) <= 0)) {
            currentDir.deleteRecursively()
            if (s.active != null || s.pending) save(s.copy(active = null, pending = false, attempts = 0))
            return null
        }
        if (s.active != onDisk) save(s.copy(active = onDisk))
        if (s.pending && s.attempts >= MAX_ATTEMPTS) return rollback("not ready after ${s.attempts} starts")
        return null
    }

    /** A fresh, empty staging directory. */
    @Synchronized
    fun freshStaging(): File {
        stagingDir.deleteRecursively()
        stagingDir.mkdirs()
        return stagingDir
    }

    /**
     * Swaps the checked staging directory in as `current` and marks it pending. Throws if the staging bundle is
     * not a valid bundle of [expectedVersion].
     */
    @Synchronized
    fun activate(expectedVersion: String) {
        val v = bundleVersion(stagingDir) ?: throw IllegalStateException("staged bundle lacks index.html or ui-version.json")
        check(UiBundle.compareVersions(v, expectedVersion) == 0) { "staged bundle is $v, manifest says $expectedVersion" }
        // Fresh timestamps so HostServer's UiBundle notices the new version file.
        stagingDir.walkTopDown().forEach { it.setLastModified(System.currentTimeMillis()) }
        trashDir.deleteRecursively()
        if (currentDir.exists() && !currentDir.renameTo(trashDir)) {
            currentDir.deleteRecursively()
        }
        if (!stagingDir.renameTo(currentDir)) throw IllegalStateException("could not move the staged bundle into place")
        trashDir.deleteRecursively()
        save(state().copy(active = v, pending = true, attempts = 0))
    }

    /** The UI started loading the active bundle. True when it is pending (the caller starts the ready timer). */
    @Synchronized
    fun onUiLoadStarted(otaServed: Boolean): Boolean {
        val s = state()
        if (!otaServed || !s.pending || s.active == null) return false
        save(s.copy(attempts = s.attempts + 1))
        return true
    }

    /** `ui.ready` arrived while the OTA bundle was served: it works. */
    @Synchronized
    fun onUiReady(otaServed: Boolean) {
        val s = state()
        if (otaServed && s.pending) save(s.copy(pending = false, attempts = 0))
    }

    /** Removes the active bundle and remembers its version as bad. Returns that version. */
    @Synchronized
    fun rollback(reason: String): String? {
        val s = state()
        val v = s.active ?: bundleVersion(currentDir)
        trashDir.deleteRecursively()
        if (!currentDir.renameTo(trashDir)) currentDir.deleteRecursively()
        trashDir.deleteRecursively()
        val bad = if (v == null) s.bad else (s.bad + v).distinct().takeLast(20)
        save(s.copy(active = null, pending = false, attempts = 0, bad = bad, lastRollback = v?.let { "$it: $reason" }))
        return v
    }

    companion object {
        const val MAX_ATTEMPTS = 2

        /** Version of a bundle directory: needs `index.html` and a valid `ui-version.json`. */
        fun bundleVersion(dir: File): String? {
            if (!File(dir, "index.html").isFile) return null
            val vf = File(dir, UiBundle.VERSION_FILE)
            if (!vf.isFile) return null
            return runCatching { vf.inputStream().use { UiBundle.parseVersion(it) } }.getOrNull()
        }

        private fun parse(text: String): State {
            val o = Json.parseToJsonElement(text).jsonObject
            fun p(k: String) = o[k] as? JsonPrimitive
            return State(
                active = p("active")?.contentOrNull,
                pending = p("pending")?.booleanOrNull ?: false,
                attempts = p("attempts")?.intOrNull ?: 0,
                bad = (o["bad"] as? JsonArray)?.mapNotNull { (it as? JsonPrimitive)?.contentOrNull }.orEmpty(),
                lastCheck = p("lastCheck")?.longOrNull ?: 0L,
                lastRollback = p("lastRollback")?.contentOrNull
            )
        }
    }
}
