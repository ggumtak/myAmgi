package com.ggumtak.myamgi.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.File
import java.security.MessageDigest
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

private fun zipOf(entries: Map<String, String>): ByteArray {
    val bos = ByteArrayOutputStream()
    ZipOutputStream(bos).use { z ->
        for ((name, text) in entries) {
            z.putNextEntry(ZipEntry(name))
            z.write(text.toByteArray())
            z.closeEntry()
        }
    }
    return bos.toByteArray()
}

private fun sha(b: ByteArray) = MessageDigest.getInstance("SHA-256").digest(b).joinToString("") { "%02x".format(it) }

private val GOOD_SHA = "a".repeat(64)

class UiOtaManifestTest {
    private fun json(extra: String = "", version: String = "1.0.30", url: String = "https://x/y.zip", sha: String = GOOD_SHA, size: String = "1234") =
        """{"version":"$version","url":"$url","sha256":"$sha","size":$size$extra}"""

    @Test
    fun parsesAValidManifest() {
        val m = UiOtaManifest.parse(json(""","minApkBuild":14"""))
        assertEquals(UiOtaManifest("1.0.30", "https://x/y.zip", GOOD_SHA, 1234, 14), m)
        assertEquals(0, UiOtaManifest.parse(json()).minApkBuild)
        assertEquals(GOOD_SHA, UiOtaManifest.parse(json(sha = GOOD_SHA.uppercase())).sha256)
    }

    @Test
    fun rejectsBadManifests() {
        val bad = listOf(
            "[]", "not json", json(version = "abc"), json(version = "1"), json(version = "1.0.x"),
            json(url = "http://x/y.zip"), json(sha = "abc"), json(size = "0"), json(size = "-5"),
            json(size = "999999999999"), json(""","minApkBuild":"x""""), """{"url":"https://x"}"""
        )
        for (b in bad) {
            try {
                UiOtaManifest.parse(b)
                fail("accepted: $b")
            } catch (_: IllegalArgumentException) {
            }
        }
    }

    @Test
    fun decisions() {
        val m = UiOtaManifest("1.0.30", "https://x", GOOD_SHA, 1, 14)
        assertEquals(UiOtaManifest.Decision.INSTALL, m.decide(14, "1.0.20", null, emptySet()))
        assertEquals(UiOtaManifest.Decision.INSTALL, m.decide(15, "1.0.20", "1.0.25", emptySet()))
        assertEquals(UiOtaManifest.Decision.UP_TO_DATE, m.decide(15, "1.0.30", null, emptySet()))
        assertEquals(UiOtaManifest.Decision.UP_TO_DATE, m.decide(15, "1.0.20", "1.0.30", emptySet()))
        assertEquals(UiOtaManifest.Decision.UP_TO_DATE, m.decide(15, "1.0.31", null, emptySet()))
        assertEquals(UiOtaManifest.Decision.NEEDS_NEWER_APK, m.decide(13, "1.0.20", null, emptySet()))
        assertEquals(UiOtaManifest.Decision.KNOWN_BAD, m.decide(15, "1.0.20", null, setOf("1.0.30")))
        // 1.0.100 is newer than 1.0.99 (numeric, not string order)
        assertEquals(UiOtaManifest.Decision.INSTALL, m.copy(version = "1.0.100").decide(15, "1.0.99", null, emptySet()))
    }
}

class SafeZipTest {
    @get:Rule
    val tmp = TemporaryFolder()

    @Test
    fun extractsNestedFiles() {
        val z = tmp.newFile("a.zip").apply { writeBytes(zipOf(mapOf("index.html" to "<p>", "assets/x.js" to "1", "dir/" to ""))) }
        val out = File(tmp.root, "out")
        assertEquals(2, SafeZip.extract(z, out))
        assertEquals("1", File(out, "assets/x.js").readText())
        assertTrue(File(out, "dir").isDirectory)
    }

    @Test
    fun rejectsZipSlipAndOddNames() {
        for (evil in listOf("../evil.txt", "a/../../evil.txt", "/abs.txt", "C:/x.txt", "a\\..\\b", "a//b", "./x")) {
            val z = tmp.newFile().apply { writeBytes(zipOf(mapOf("ok.txt" to "1", evil to "x"))) }
            val out = tmp.newFolder()
            try {
                SafeZip.extract(z, out)
                fail("extracted $evil")
            } catch (_: SafeZip.UnsafeZipException) {
            }
            assertFalse(File(out.parentFile, "evil.txt").exists())
        }
        assertNull(SafeZip.safeEntryName("a/./b"))
        assertEquals("a/b", SafeZip.safeEntryName("a/b/"))
    }

    @Test
    fun capsSizeAndEntryCount() {
        val big = tmp.newFile().apply { writeBytes(zipOf(mapOf("big.txt" to "x".repeat(10_000)))) }
        try {
            SafeZip.extract(big, tmp.newFolder(), maxTotalBytes = 1000)
            fail()
        } catch (_: SafeZip.UnsafeZipException) {
        }
        val many = tmp.newFile().apply { writeBytes(zipOf((1..20).associate { "f$it" to "" })) }
        try {
            SafeZip.extract(many, tmp.newFolder(), maxEntries = 10)
            fail()
        } catch (_: SafeZip.UnsafeZipException) {
        }
    }
}

class UiOtaStoreTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private fun bundle(version: String) = zipOf(mapOf("index.html" to "<html>", "ui-version.json" to """{"version":"$version"}""", "assets/app.js" to "x"))

    private fun installer(store: UiOtaStore, bytes: ByteArray) = UiOtaInstaller(store) { ByteArrayInputStream(bytes) }

    private fun manifest(version: String, bytes: ByteArray) = UiOtaManifest(version, "https://x/b.zip", sha(bytes), bytes.size.toLong(), 0)

    @Test
    fun installVerifiesAndActivates() {
        val store = UiOtaStore(tmp.newFolder("ui-ota"))
        val bytes = bundle("1.0.30")
        val progress = ArrayList<Int>()
        installer(store, bytes).install(manifest("1.0.30", bytes)) { progress.add(it) }
        assertEquals("1.0.30", UiOtaStore.bundleVersion(store.currentDir))
        assertEquals(100, progress.last())
        val s = store.state()
        assertEquals("1.0.30", s.active)
        assertTrue(s.pending)
        // state survives a new process
        assertEquals(s, UiOtaStore(store.root).state())
    }

    @Test
    fun badDownloadsNeverActivate() {
        val store = UiOtaStore(tmp.newFolder("ui-ota"))
        val bytes = bundle("1.0.30")
        val cases = listOf(
            manifest("1.0.30", bytes).copy(sha256 = "0".repeat(64)), // wrong hash
            manifest("1.0.30", bytes).copy(size = bytes.size + 1L), // short download
            manifest("1.0.30", bytes).copy(size = bytes.size - 1L) // long download
        )
        for (m in cases) {
            try {
                installer(store, bytes).install(m)
                fail("installed $m")
            } catch (_: Exception) {
            }
            assertFalse(store.currentDir.exists())
        }
        // Version inside the zip must match the manifest.
        try {
            installer(store, bytes).install(manifest("1.0.31", bytes))
            fail()
        } catch (_: IllegalStateException) {
        }
        assertFalse(store.currentDir.exists())
        // No index.html
        val noIndex = zipOf(mapOf("ui-version.json" to """{"version":"1.0.30"}"""))
        try {
            installer(store, noIndex).install(manifest("1.0.30", noIndex))
            fail()
        } catch (_: IllegalStateException) {
        }
        assertFalse(store.currentDir.exists())
        assertNull(store.state().active)
    }

    @Test
    fun readyConfirmsTimeoutRollsBack() {
        val store = UiOtaStore(tmp.newFolder("ui-ota"))
        val b1 = bundle("1.0.30")
        installer(store, b1).install(manifest("1.0.30", b1))
        assertFalse("not served → no watchdog", store.onUiLoadStarted(otaServed = false))
        assertTrue(store.onUiLoadStarted(otaServed = true))
        store.onUiReady(otaServed = true)
        assertFalse(store.state().pending)
        assertFalse("confirmed → no watchdog", store.onUiLoadStarted(true))

        val b2 = bundle("1.0.31")
        installer(store, b2).install(manifest("1.0.31", b2))
        assertTrue(store.onUiLoadStarted(true))
        assertEquals("1.0.31", store.rollback("timeout"))
        assertFalse(store.currentDir.exists())
        assertEquals(listOf("1.0.31"), store.state().bad)
        assertNull(store.state().active)
        assertTrue(store.state().lastRollback!!.startsWith("1.0.31"))
        assertEquals(UiOtaManifest.Decision.KNOWN_BAD, manifest("1.0.31", b2).decide(99, "1.0.1", null, store.state().bad.toSet()))
    }

    @Test
    fun recoverRollsBackAfterRepeatedStartsAndDropsStaleBundles() {
        val store = UiOtaStore(tmp.newFolder("ui-ota"))
        val b = bundle("1.0.30")
        installer(store, b).install(manifest("1.0.30", b))
        repeat(UiOtaStore.MAX_ATTEMPTS) { store.onUiLoadStarted(true) }
        val fresh = UiOtaStore(store.root) // next process
        assertEquals("1.0.30", fresh.recover("1.0.20"))
        assertFalse(fresh.currentDir.exists())

        val b3 = bundle("1.0.32")
        installer(fresh, b3).install(manifest("1.0.32", b3))
        fresh.onUiReady(true)
        // An APK update brought built-in UI 1.0.40: the older OTA bundle is removed.
        assertNull(fresh.recover("1.0.40"))
        assertFalse(fresh.currentDir.exists())
        assertNull(fresh.state().active)
    }

    @Test
    fun recoverCleansInterruptedInstall() {
        val root = tmp.newFolder("ui-ota")
        File(root, "staging/x").apply { parentFile.mkdirs(); writeText("half") }
        File(root, "trash/y").apply { parentFile.mkdirs(); writeText("old") }
        val store = UiOtaStore(root)
        assertNull(store.recover("1.0.1"))
        assertFalse(File(root, "staging").exists())
        assertFalse(File(root, "trash").exists())
    }
}
