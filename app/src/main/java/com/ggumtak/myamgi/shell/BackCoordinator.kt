package com.ggumtak.myamgi.shell

/**
 * Hardware/gesture back: the UI decides (event `back {id}`), the shell falls back when nobody answers.
 *
 * - No page connected to the event stream (still loading, crashed, error screen) → fall back at once.
 * - The UI declared `"back-ack"` in `ui.ready {features}` → wait [ackTimeoutMillis] for `ui.backHandled {id}`,
 *   then fall back.
 * - Otherwise (a UI that handles `back` but does not acknowledge it) the event is trusted.
 *
 * Fallback = WebView history back if possible, else finish the activity. Pure; timers are the caller's.
 */
class BackCoordinator(val ackTimeoutMillis: Long = 700) {
    sealed class Decision {
        object FallBack : Decision()
        data class Publish(val id: Long, val awaitAck: Boolean) : Decision()
    }

    private var nextId = 1L
    private val waiting = HashSet<Long>()

    @Synchronized
    fun onBack(pageConnected: Boolean, uiSpeaksBackAck: Boolean): Decision {
        if (!pageConnected) return Decision.FallBack
        val id = nextId++
        if (uiSpeaksBackAck) waiting.add(id)
        return Decision.Publish(id, uiSpeaksBackAck)
    }

    @Synchronized
    fun onAck(id: Long) {
        waiting.remove(id)
    }

    /** Called when the timer for [id] fires: true = nobody answered, fall back now. */
    @Synchronized
    fun onTimeout(id: Long): Boolean = waiting.remove(id)
}
