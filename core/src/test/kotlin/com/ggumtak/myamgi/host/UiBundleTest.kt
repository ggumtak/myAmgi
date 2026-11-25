package com.ggumtak.myamgi.host

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/** The built-in (or `--ui-dir`) bundle is always served unless a valid, newer OTA bundle exists. */
class UiBundleTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private fun bundle(name: String, version: String?): File = tmp.newFolder(name).apply {
        File(this, "index.html").writeText("<!doctype html><title>$name</title>")
        if (version != null) File(this, UiBundle.VERSION_FILE).writeText("""{"version":"$version"}""")
    }

    private fun UiBundle.index() = open("index.html")!!.use { it.readBytes().toString(Charsets.UTF_8) }

    @Test
    fun localBuildWithDefaultVersionIsServed() {
        val ui = UiBundle(DirAssetSource(bundle("dev", "0.0.0")), null)
        assertEquals("0.0.0", ui.version())
        assertTrue(ui.index().contains("dev"))
    }

    @Test
    fun bundleWithoutVersionFileIsServed() {
        val ui = UiBundle(DirAssetSource(bundle("dev", null)), tmp.newFolder("emptyOta"))
        assertNull(ui.version())
        assertFalse(ui.otaActive())
        assertTrue(ui.index().contains("dev"))
    }

    @Test
    fun otaOnlyWhenNewer() {
        val ota = bundle("ota", "1.0.5")
        assertTrue(UiBundle(DirAssetSource(bundle("a", "1.0.4")), ota).index().contains("ota"))
        assertTrue(UiBundle(DirAssetSource(bundle("b", "1.0.5")), ota).index().contains("b"))
        assertTrue(UiBundle(DirAssetSource(bundle("c", "1.0.10")), ota).index().contains("c"))
    }
}
