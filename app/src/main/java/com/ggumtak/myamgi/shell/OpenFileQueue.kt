package com.ggumtak.myamgi.shell

/**
 * Files opened with the app ("열기"/공유) wait here until the page can receive the `open-file` event: after it
 * called `ui.ready`, or (for a UI that does not call it yet) once its event stream has been connected for
 * [settleMillis]. Thread-safe; pure so it is unit-tested.
 */
class OpenFileQueue(private val settleMillis: Long = 1500) {
    data class Item(val path: String, val name: String)

    private val items = ArrayList<Item>()
    private var connectedSince = -1L

    @Synchronized
    fun offer(item: Item) {
        items.add(item)
    }

    @Synchronized
    fun size(): Int = items.size

    /** A new page started loading: the old event stream is gone. */
    @Synchronized
    fun pageChanged() {
        connectedSince = -1L
    }

    /** Returns (and removes) what may be delivered now. */
    @Synchronized
    fun drain(uiReady: Boolean, subscribers: Int, now: Long): List<Item> {
        if (subscribers <= 0) {
            connectedSince = -1L
            return emptyList()
        }
        if (connectedSince < 0) connectedSince = now
        if (!uiReady && now - connectedSince < settleMillis) return emptyList()
        val out = items.toList()
        items.clear()
        return out
    }
}
