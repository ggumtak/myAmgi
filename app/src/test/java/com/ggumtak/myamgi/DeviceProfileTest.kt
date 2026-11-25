package com.ggumtak.myamgi

import com.ggumtak.myamgi.device.DeviceProfile
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeviceProfileTest {

    @Test
    fun proFlavorUsesHighPerformanceSettings() {
        val p = DeviceProfile.detect(
            isCometFlavor = false,
            manufacturer = "samsung",
            brand = "samsung",
            model = "SM-S928N",
            device = "e3q",
            screenWidthPx = 1440,
            screenHeightPx = 3120
        )
        assertFalse(p.isComet)
        assertFalse(p.isEink)
        assertEquals(2, p.preloadCardsCount)
        assertEquals(16 * 1024 * 1024, p.mediaCacheBytes)
        assertEquals(6, p.syncParallelism)
        assertTrue(p.enableAnimations)
        assertTrue(p.useZeroFlashDomSwap)
        assertTrue(p.warmBackendOnLaunch)
        assertFalse(p.defaultVolumeKeyStudy)
        assertEquals(56, p.compactTopBarDp)
    }

    @Test
    fun cometFlavorUsesEinkLowCpuSettings() {
        val p = DeviceProfile.detect(
            isCometFlavor = true,
            manufacturer = "Innosspace",
            brand = "Innosspace",
            model = "Comet",
            device = "comet",
            screenWidthPx = 720,
            screenHeightPx = 1440
        )
        assertTrue(p.isComet)
        assertTrue(p.isEink)
        assertEquals(0, p.preloadCardsCount)
        assertEquals(4 * 1024 * 1024, p.mediaCacheBytes)
        assertEquals(2, p.syncParallelism)
        assertFalse(p.enableAnimations)
        assertFalse(p.useZeroFlashDomSwap)
        assertFalse(p.warmBackendOnLaunch)
        assertTrue(p.defaultVolumeKeyStudy)
        assertEquals(46, p.compactTopBarDp)
    }

    @Test
    fun runtimeDetectsCometHardwareEvenOnProApk() {
        val p = DeviceProfile.detect(
            isCometFlavor = false,
            manufacturer = "Innosspace",
            brand = "innosspace",
            model = "Comet-E",
            device = "comet",
            screenWidthPx = 720,
            screenHeightPx = 1440
        )
        assertTrue(p.isComet)
        assertTrue(p.isEink)
        assertEquals(46, p.compactTopBarDp)
    }
}
