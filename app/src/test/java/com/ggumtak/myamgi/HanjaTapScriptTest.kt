package com.ggumtak.myamgi

import com.ggumtak.myamgi.hanja.HanjaIntegration
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest

/**
 * myAmgi's bundled copy of the Hanja app's tap script (assets/hanja/anki-tap.js) against its record
 * (assets/hanja/SOURCE.txt), and, when a Hanja checkout is at hand, against the Hanja app itself.
 */
class HanjaTapScriptTest {
    private val bundled = File("src/main/assets/hanja/anki-tap.js")
    private val source = File("src/main/assets/hanja/SOURCE.txt")

    private fun sha256(bytes: ByteArray) =
        MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    private fun record(): Map<String, String> = source.readLines()
        .filter { it.contains('=') && !it.startsWith("#") }
        .associate { it.substringBefore('=').trim() to it.substringAfter('=').trim() }

    /** A Hanja repository: $HANJA_REPO, or the checkout named "test" next to this repository. */
    private fun hanjaRepo(): File? {
        val candidates = listOfNotNull(System.getenv("HANJA_REPO")?.let(::File), File("../../test"))
        return candidates.firstOrNull { File(it, "app/src/main/java/com/ggumtak/hanja/LookupActivity.kt").isFile }
    }

    @Test
    fun bundledCopyMatchesItsRecord() {
        assertTrue("missing $bundled", bundled.isFile)
        assertEquals("assets/hanja/anki-tap.js changed without updating SOURCE.txt",
            record()["sha256"], sha256(bundled.readBytes()))
    }

    @Test
    fun bundledCopyIsTheHanjaAppsScript() {
        val repo = hanjaRepo()
        assumeTrue("no Hanja checkout (set HANJA_REPO)", repo != null)
        val upstream = File(repo, record()["path"]!!)
        assertEquals("myAmgi's assets/hanja/anki-tap.js is stale: copy ${upstream.path} and update SOURCE.txt",
            sha256(upstream.readBytes()), sha256(bundled.readBytes()))
    }

    @Test
    fun hanjaApkHoldsTheEntryMyAmgiReads() {
        // A Hanja build in the checkout (./gradlew assembleDebug there): the entry name is the real one.
        val apks = hanjaRepo()?.let { File(it, "app/build/outputs/apk").walk().filter { f -> f.extension == "apk" }.toList() }
        assumeTrue("no built Hanja APK", !apks.isNullOrEmpty())
        val script = HanjaIntegration.extractTapScriptFromApk(apks!!.maxBy { it.lastModified() })
        assertNotNull("assets/anki-tap.js not found in the Hanja APK", script)
        assertTrue(script!!.contains("intent://lookup?q="))
    }

    @Test
    fun scriptEmitsTheUrlTheHanjaAppAccepts() {
        val js = bundled.readText()
        // LookupActivity: ACTION_VIEW hanja://lookup with q (word) and s (sentence), package com.ggumtak.hanja.
        assertTrue(js.contains("'intent://lookup?q=' + encodeURIComponent(q) + (s ? '&s=' + encodeURIComponent(s) : '')"))
        assertTrue(js.contains("#Intent;scheme=hanja;package=${HanjaIntegration.HANJA_PACKAGE};end"))
    }

    @Test
    fun runnerCallsTheHighestVersionOnce() {
        val out = HanjaIntegration.withRunner("(window.__hjCode = window.__hjCode || {})[10] = function () {};")
        assertTrue(out.endsWith(HanjaIntegration.RUNNER))
        assertTrue(HanjaIntegration.RUNNER.contains("if(w.__hjtapRun)return;"))
    }
}

class HanjaScriptVersionTest {
    @org.junit.Test
    fun versionIsTheHighestHjCodeIndex() {
        val bundled = java.io.File("src/main/assets/hanja/anki-tap.js").readText()
        org.junit.Assert.assertEquals(9, HanjaIntegration.scriptVersion(bundled))
        org.junit.Assert.assertEquals(11, HanjaIntegration.scriptVersion(
            "(window.__hjCode = window.__hjCode || {})[10] = 1;\n(window.__hjCode = window.__hjCode || {})[11] = 2;"))
        org.junit.Assert.assertNull(HanjaIntegration.scriptVersion("nothing"))
    }
}
