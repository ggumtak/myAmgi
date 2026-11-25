package com.ggumtak.myamgi.render

import android.content.Context
import com.ggumtak.myamgi.device.DeviceProfile
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * Background card pre-renderer for Pro devices (`preloadCardsCount = 2`).
 * Completely disabled on Comet E-Ink devices (`preloadCardsCount = 0`).
 */
object CardPreloader {
    private val cache = ConcurrentHashMap<Long, RenderedCard>()
    private val inFlight = ConcurrentHashMap.newKeySet<Long>()

    fun preload(context: Context, upcomingCardIds: List<Long>, scope: CoroutineScope) {
        val count = DeviceProfile.current(context).preloadCardsCount
        if (count <= 0) {
            if (cache.isNotEmpty()) {
                cache.clear()
            }
            return
        }

        val targets = upcomingCardIds.distinct().take(count)
        val keepSet = targets.toHashSet()
        for (existingKey in cache.keys) {
            if (existingKey !in keepSet) {
                cache.remove(existingKey)
            }
        }

        for (cardId in targets) {
            if (cache.containsKey(cardId)) continue
            if (!inFlight.add(cardId)) continue
            scope.launch(Dispatchers.IO) {
                try {
                    if (!cache.containsKey(cardId)) {
                        val rendered = CardRenderer.render(cardId)
                        if (keepSet.contains(cardId)) {
                            cache[cardId] = rendered
                        }
                    }
                } catch (_: Throwable) {
                    // Best-effort preload; study screen falls back to synchronous render on demand.
                } finally {
                    inFlight.remove(cardId)
                }
            }
        }
    }

    fun takeOrRender(cardId: Long): RenderedCard {
        cache.remove(cardId)?.let { return it }
        return CardRenderer.render(cardId)
    }

    fun clear() {
        cache.clear()
        inFlight.clear()
    }
}
