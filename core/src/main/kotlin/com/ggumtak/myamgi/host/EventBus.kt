package com.ggumtak.myamgi.host

import kotlinx.serialization.json.JsonElement
import java.io.InputStream
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit

/**
 * Fan-out of server-sent events to every open `/api/host/events` stream.
 * Event names: `progress`, `back`, `open-file`, `sync-state`, `anki-page`.
 */
class EventBus(private val keepAliveMillis: Long = 15_000) {
    private val subscribers = CopyOnWriteArrayList<Subscriber>()

    val subscriberCount: Int get() = subscribers.size

    fun publish(event: String, data: JsonElement) {
        val frame = "event: $event\ndata: ${data}\n\n".toByteArray(Charsets.UTF_8)
        for (s in subscribers) s.offer(frame)
    }

    /** A blocking stream of SSE frames; closing it unsubscribes. */
    fun subscribe(initial: List<Pair<String, JsonElement>> = emptyList()): InputStream {
        val s = Subscriber()
        s.offer("retry: 2000\n\n".toByteArray())
        for ((name, data) in initial) s.offer("event: $name\ndata: $data\n\n".toByteArray(Charsets.UTF_8))
        subscribers.add(s)
        return s
    }

    fun closeAll() {
        for (s in subscribers) s.close()
    }

    private inner class Subscriber : InputStream() {
        private val queue = LinkedBlockingQueue<ByteArray>(1000)
        private var current: ByteArray? = null
        private var pos = 0

        @Volatile
        private var closed = false

        fun offer(frame: ByteArray) {
            if (!closed) queue.offer(frame)
        }

        override fun read(): Int {
            val b = ByteArray(1)
            return if (read(b, 0, 1) <= 0) -1 else b[0].toInt() and 0xFF
        }

        override fun read(b: ByteArray, off: Int, len: Int): Int {
            if (len == 0) return 0
            while (true) {
                if (closed) return -1
                val cur = current
                if (cur != null && pos < cur.size) {
                    val n = minOf(len, cur.size - pos)
                    System.arraycopy(cur, pos, b, off, n)
                    pos += n
                    return n
                }
                // Comment frame keeps proxies/WebViews from timing the stream out and detects closed sockets.
                current = queue.poll(keepAliveMillis, TimeUnit.MILLISECONDS) ?: ": keepalive\n\n".toByteArray()
                pos = 0
            }
        }

        override fun close() {
            closed = true
            subscribers.remove(this)
        }
    }
}
