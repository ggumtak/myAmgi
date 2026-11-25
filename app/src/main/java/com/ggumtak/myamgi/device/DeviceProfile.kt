package com.ggumtak.myamgi.device

import android.content.Context
import android.os.Build
import com.ggumtak.myamgi.BuildConfig

/**
 * Runtime + flavor device profile distinguishing:
 * - Pro (`com.ggumtak.myamgi`): high-performance phones & tablets (pre-warming, 2-card preload,
 *   16MB media LRU cache, zero-flash DOM swap, 6 parallel media sync workers).
 * - Comet (`com.ggumtak.myamgi.comet`): Innosspace Comet 5.84" 1440x720 monochrome E-Ink bar phone
 *   (Android 14, 6GB RAM, Cortex-A53 octa-core arm64-v8a, physical side volume keys).
 */
data class DeviceProfile(
    val isComet: Boolean,
    val isEink: Boolean,
    val preloadCardsCount: Int,
    val mediaCacheBytes: Int,
    val syncParallelism: Int,
    val enableAnimations: Boolean,
    val useZeroFlashDomSwap: Boolean,
    val compactTopBarDp: Int,
    val defaultVolumeKeyStudy: Boolean,
    val warmBackendOnLaunch: Boolean,
    val flavorLabel: String,
    val detectedHardware: String
) {
    companion object {
        @Volatile
        private var cached: DeviceProfile? = null

        fun current(context: Context): DeviceProfile {
            cached?.let { return it }
            val metrics = context.resources.displayMetrics
            val profile = detect(
                isCometFlavor = BuildConfig.IS_COMET,
                manufacturer = Build.MANUFACTURER ?: "",
                brand = Build.BRAND ?: "",
                model = Build.MODEL ?: "",
                device = Build.DEVICE ?: "",
                screenWidthPx = metrics.widthPixels,
                screenHeightPx = metrics.heightPixels
            )
            cached = profile
            return profile
        }

        /** Pure deterministic detection helper (unit-testable without Android Context). */
        fun detect(
            isCometFlavor: Boolean,
            manufacturer: String,
            brand: String,
            model: String,
            device: String,
            screenWidthPx: Int = 0,
            screenHeightPx: Int = 0
        ): DeviceProfile {
            val fingerprint = "$manufacturer $brand $model $device".lowercase()
            val isCometHardware = fingerprint.contains("comet") ||
                fingerprint.contains("innosspace") ||
                fingerprint.contains("inno") && fingerprint.contains("eink") ||
                fingerprint.contains("onyx") ||
                fingerprint.contains("boox") ||
                fingerprint.contains("hisense") && (fingerprint.contains("a9") || fingerprint.contains("a5") || fingerprint.contains("touch"))

            val isBarEinkAspect = (screenWidthPx == 720 && screenHeightPx == 1440) ||
                (screenWidthPx == 1440 && screenHeightPx == 720)

            val cometMode = isCometFlavor || isCometHardware
            val einkMode = cometMode || (isCometFlavor && isBarEinkAspect)
            val hwSummary = listOf(manufacturer, model).filter { it.isNotBlank() }.joinToString(" ").ifBlank { "arm64-v8a" }

            return if (cometMode) {
                DeviceProfile(
                    isComet = true,
                    isEink = einkMode,
                    preloadCardsCount = 0,
                    mediaCacheBytes = 4 * 1024 * 1024, // 4MB RAM cache for low-power E-Ink
                    syncParallelism = 2,
                    enableAnimations = false,
                    useZeroFlashDomSwap = false,
                    compactTopBarDp = 46,
                    defaultVolumeKeyStudy = true,
                    warmBackendOnLaunch = false,
                    flavorLabel = "Comet E-Ink (arm64-v8a)",
                    detectedHardware = hwSummary
                )
            } else {
                DeviceProfile(
                    isComet = false,
                    isEink = false,
                    preloadCardsCount = 2,
                    mediaCacheBytes = 16 * 1024 * 1024, // 16MB RAM cache for instant media
                    syncParallelism = 6,
                    enableAnimations = true,
                    useZeroFlashDomSwap = true,
                    compactTopBarDp = 56,
                    defaultVolumeKeyStudy = false,
                    warmBackendOnLaunch = true,
                    flavorLabel = "Pro Performance (arm64-v8a)",
                    detectedHardware = hwSummary
                )
            }
        }
    }
}
