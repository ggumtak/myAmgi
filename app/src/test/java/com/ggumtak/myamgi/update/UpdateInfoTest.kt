package com.ggumtak.myamgi.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Release layout: APKs on `latest`, delta patches and OTA files on `update-files`. */
class UpdateInfoTest {

    private fun asset(name: String, size: Long) =
        """{"name": "$name", "size": $size, "browser_download_url": "https://example.com/$name"}"""

    private fun release(tag: String, vararg assets: String) =
        """{"tag_name": "$tag", "assets": [${assets.joinToString(",")}]}"""

    private val latestJson = release(
        "latest",
        asset("myAmgi-Pro-12.apk", 25_000_000),
        asset("myAmgi-Comet-12.apk", 24_000_000)
    )

    private val updateFilesJson = release(
        "update-files",
        asset("myAmgi-Pro-12.from-11.patch", 150_000),
        asset("myAmgi-Pro-12.from-10.patch", 300_000),
        asset("myAmgi-Comet-12.from-11.patch", 140_000),
        // Patch for another target build: ignored while latest announces 12.
        asset("myAmgi-Pro-11.from-10.patch", 100_000),
        asset("ui-manifest.json", 500),
        asset("myAmgi-ui-1.0.12.zip", 900)
    )

    @Test
    fun releaseUrlsPointAtTheRightTags() {
        assertEquals(
            "https://api.github.com/repos/o/r/releases/tags/latest",
            UpdateInfo.releaseApiUrl(UpdateInfo.LATEST_TAG, "o/r")
        )
        assertEquals(
            "https://api.github.com/repos/o/r/releases/tags/update-files",
            UpdateInfo.releaseApiUrl(UpdateInfo.UPDATE_FILES_TAG, "o/r")
        )
        assertTrue(UpdateInfo.LATEST_URL.endsWith("/releases/tags/latest"))
        assertTrue(UpdateInfo.UPDATE_FILES_URL.endsWith("/releases/tags/update-files"))
        assertEquals(
            "https://github.com/o/r/releases/download/update-files/ui-manifest.json",
            UpdateInfo.downloadUrl(UpdateInfo.UPDATE_FILES_TAG, UiOtaManifest.NAME, "o/r")
        )
    }

    @Test
    fun apkFromLatestAndPatchesFromUpdateFiles() {
        val pro = UpdateInfo.parse(latestJson, "myAmgi-Pro", updateFilesJson)
        assertNotNull(pro)
        assertEquals(12, pro!!.build)
        assertEquals("https://example.com/myAmgi-Pro-12.apk", pro.url)
        assertEquals(listOf(11, 10), pro.patches.map { it.from })
        assertEquals("https://example.com/myAmgi-Pro-12.from-11.patch", UpdateInfo.patchFor(pro, 11)?.url)

        val comet = UpdateInfo.parse(latestJson, "myAmgi-Comet", updateFilesJson)
        assertNotNull(comet)
        assertEquals("https://example.com/myAmgi-Comet-12.apk", comet!!.url)
        assertEquals(listOf(11), comet.patches.map { it.from })
    }

    @Test
    fun withoutPatchesTheFullApkIsUsed() {
        // What builds installed before the split see: `latest` has only APKs now.
        val pro = UpdateInfo.parse(latestJson, "myAmgi-Pro")
        assertNotNull(pro)
        assertEquals(12, pro!!.build)
        assertTrue(pro.patches.isEmpty())
        assertNull(UpdateInfo.patchFor(pro, 11))

        // Unreadable update-files answer also means "no patch", never "no update".
        val broken = UpdateInfo.parse(latestJson, "myAmgi-Pro", "not json")
        assertEquals(12, broken!!.build)
        assertTrue(broken.patches.isEmpty())
    }

    @Test
    fun patchesOnUpdateFilesAloneDoNotCreateAnUpdate() {
        // A run that uploaded update-files but not yet the APKs must not announce build 12.
        val oldLatest = release("latest", asset("myAmgi-Pro-11.apk", 25_000_000))
        val pro = UpdateInfo.parse(oldLatest, "myAmgi-Pro", updateFilesJson)
        assertEquals(11, pro!!.build)
        // Only patches that build the announced APK (11) are offered, never the ones for 12.
        assertEquals(listOf(10), pro.patches.map { it.from })
        assertNull(UpdateInfo.parse(updateFilesJson, "myAmgi-Pro"))
    }

    @Test
    fun legacyPatchesOnLatestAreStillAccepted() {
        val legacy = release(
            "latest",
            asset("myAmgi-Pro-12.apk", 25_000_000),
            asset("myAmgi-Pro-12.from-11.patch", 150_000)
        )
        val pro = UpdateInfo.parse(legacy, "myAmgi-Pro", updateFilesJson)
        assertEquals(listOf(11, 10), pro!!.patches.map { it.from })
    }
}
