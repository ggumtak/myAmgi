package com.ggumtak.myamgi.provider

import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Chunked transfer of one note type text (CSS, front or back template) through [MyAmgiProvider.call], for texts
 * larger than one Binder transaction (about 1MB, i.e. about 500,000 characters as UTF-16). Pure JVM-testable.
 *
 * A session that is never committed (the caller crashed) is dropped after [ttlMillis], on the next begin.
 */
class ChunkSessionStore(
    private val readTarget: (notetypeId: Long, target: String, ord: Int) -> String,
    private val writeTarget: (notetypeId: Long, target: String, ord: Int, content: String) -> Unit,
    private val ttlMillis: Long = 10 * 60_000L,
    private val clock: () -> Long = System::currentTimeMillis,
) {
    data class Session(
        val id: String,
        val notetypeId: Long,
        val target: String,
        val ord: Int,
        val buffer: StringBuilder = StringBuilder(),
        val startedAt: Long = 0L,
    )

    data class ReadChunkResult(
        val chunk: String,
        val totalLength: Int,
        val eof: Boolean
    )

    private val sessions = ConcurrentHashMap<String, Session>()

    fun beginSession(notetypeId: Long, target: String, ord: Int): String {
        val normalizedTarget = normalizeTarget(target)
        val now = clock()
        sessions.values.removeIf { now - it.startedAt > ttlMillis }
        val sessionId = UUID.randomUUID().toString()
        sessions[sessionId] = Session(sessionId, notetypeId, normalizedTarget, ord, startedAt = now)
        return sessionId
    }

    fun appendChunk(sessionId: String, chunk: String): Int {
        val session = sessions[sessionId]
            ?: throw IllegalArgumentException("Unknown chunk session: $sessionId")
        synchronized(session.buffer) {
            session.buffer.append(chunk)
            return session.buffer.length
        }
    }

    fun commitSession(sessionId: String): Int {
        val session = sessions.remove(sessionId)
            ?: throw IllegalArgumentException("Unknown chunk session: $sessionId")
        val fullText = synchronized(session.buffer) { session.buffer.toString() }
        writeTarget(session.notetypeId, session.target, session.ord, fullText)
        return fullText.length
    }

    /** Drops a session without writing; false when there was none. */
    fun abortSession(sessionId: String): Boolean = sessions.remove(sessionId) != null

    fun openSessions(): Int = sessions.size

    fun readChunk(
        notetypeId: Long,
        target: String,
        ord: Int,
        offset: Int,
        length: Int
    ): ReadChunkResult {
        val normalizedTarget = normalizeTarget(target)
        val fullText = readTarget(notetypeId, normalizedTarget, ord)
        val total = fullText.length
        val safeOffset = offset.coerceIn(0, total)
        val safeLength = length.coerceAtLeast(0)
        val end = (safeOffset.toLong() + safeLength.toLong()).coerceAtMost(total.toLong()).toInt()
        val chunk = if (safeOffset < end) fullText.substring(safeOffset, end) else ""
        return ReadChunkResult(
            chunk = chunk,
            totalLength = total,
            eof = end >= total
        )
    }

    fun clear() {
        sessions.clear()
    }

    private fun normalizeTarget(target: String): String {
        val normalized = target.trim().lowercase()
        require(normalized == "css" || normalized == "qfmt" || normalized == "afmt") {
            "Unsupported target '$target' (expected css, qfmt, or afmt)"
        }
        return normalized
    }
}
