package com.ggumtak.myamgi

import com.ggumtak.myamgi.hanja.HanjaIntegration
import com.ggumtak.myamgi.provider.ChunkSessionStore
import com.ggumtak.myamgi.update.ApkPatch
import com.ggumtak.myamgi.update.OtaAssetUpdater
import com.ggumtak.myamgi.update.UpdateInfo
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataOutputStream
import java.io.File
import java.util.zip.DeflaterOutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipOutputStream

class CoreModulesTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    // --- 4. Flavor-Aware Release & Patch Info Parser (Pro vs Comet) ---

    @Test
    fun updateInfoSeparatesProAndCometFlavors() {
        val releaseJson = """
            {
              "tag_name": "latest",
              "assets": [
                {"name": "myAmgi-Pro-12.apk", "size": 25000000, "browser_download_url": "https://example.com/pro-12.apk"},
                {"name": "myAmgi-Pro-12.from-11.patch", "size": 150000, "browser_download_url": "https://example.com/pro-12-11.patch"},
                {"name": "myAmgi-Comet-12.apk", "size": 24000000, "browser_download_url": "https://example.com/comet-12.apk"},
                {"name": "myAmgi-Comet-12.from-11.patch", "size": 140000, "browser_download_url": "https://example.com/comet-12-11.patch"},
                {"name": "ota-manifest.json", "size": 500, "browser_download_url": "https://example.com/ota-manifest.json"}
              ]
            }
        """.trimIndent()

        val proLatest = UpdateInfo.parse(releaseJson, "myAmgi-Pro")
        assertNotNull(proLatest)
        assertEquals(12, proLatest!!.build)
        assertEquals("https://example.com/pro-12.apk", proLatest.url)
        assertEquals("https://example.com/pro-12-11.patch", UpdateInfo.patchFor(proLatest, 11)?.url)

        val cometLatest = UpdateInfo.parse(releaseJson, "myAmgi-Comet")
        assertNotNull(cometLatest)
        assertEquals(12, cometLatest!!.build)
        assertEquals("https://example.com/comet-12.apk", cometLatest.url)
        assertEquals("https://example.com/comet-12-11.patch", UpdateInfo.patchFor(cometLatest, 11)?.url)
    }

    // --- 5. OTA Manifest Parsing ---

    @Test
    fun otaManifestParsesCleanly() {
        val json = """
            {
              "version": 7,
              "files": [
                {
                  "path": "card/card-base.css",
                  "assetName": "ota__card__card-base.css",
                  "sha256": "abcdef0123456789",
                  "size": 1234,
                  "url": "https://github.com/ggumtak/myAmgi/releases/download/latest/ota__card__card-base.css"
                }
              ]
            }
        """.trimIndent()
        val manifest = OtaAssetUpdater.parseManifest(json)
        assertEquals(7, manifest.version)
        assertEquals(1, manifest.files.size)
        assertEquals("card/card-base.css", manifest.files[0].path)
    }

    // --- 6. Binary Delta Patch (AMGPAT01) Round-Trip ---

    @Test
    fun apkPatchRebuildsExactBytesAndRejectsCorruptSource() {
        val oldFile = tempFolder.newFile("old.apk").apply {
            writeBytes("HEADER_SAME_BYTES_0123456789_OLD_PAYLOAD_TAIL_SAME".toByteArray())
        }
        val newBytes = "HEADER_SAME_BYTES_0123456789_NEW_PAYLOAD_TAIL_SAME".toByteArray()

        val bodyBaos = ByteArrayOutputStream()
        DataOutputStream(bodyBaos).use { dos ->
            dos.writeLong(oldFile.length())
            dos.write(ApkPatch.sha256(oldFile))
            dos.writeLong(newBytes.size.toLong())
            val newSha = java.security.MessageDigest.getInstance("SHA-256").digest(newBytes)
            dos.write(newSha)
            // Copy prefix "HEADER_SAME_BYTES_0123456789_" (29 bytes)
            dos.writeByte('C'.code)
            dos.writeLong(0L)
            dos.writeLong(29L)
            // Data "NEW" (3 bytes)
            dos.writeByte('D'.code)
            dos.writeLong(3L)
            dos.write("NEW".toByteArray())
            // Copy suffix "_PAYLOAD_TAIL_SAME" (18 bytes from offset 32)
            dos.writeByte('C'.code)
            dos.writeLong(32L)
            dos.writeLong(18L)
            dos.writeByte('E'.code)
        }

        val patchBaos = ByteArrayOutputStream()
        patchBaos.write("AMGPAT01".toByteArray(Charsets.US_ASCII))
        DeflaterOutputStream(patchBaos).use { it.write(bodyBaos.toByteArray()) }
        val patchBytes = patchBaos.toByteArray()

        val outFile = File(tempFolder.root, "rebuilt.apk")
        assertTrue(ApkPatch.apply(oldFile, ByteArrayInputStream(patchBytes), outFile))
        assertArrayEquals(newBytes, outFile.readBytes())
    }

    // --- 7. Hanja APK Live Script Extraction ---

    @Test
    fun hanjaIntegrationExtractsAnkiTapJsFromMockApk() {
        val fakeApk = tempFolder.newFile("hanja.apk")
        ZipOutputStream(fakeApk.outputStream()).use { zos ->
            zos.putNextEntry(ZipEntry("assets/anki-tap.js"))
            zos.write("window.__hjtapVer = 99;".toByteArray())
            zos.closeEntry()
        }
        val extracted = HanjaIntegration.extractTapScriptFromApk(fakeApk)
        assertEquals("window.__hjtapVer = 99;", extracted)
    }

    // --- 8. Unlimited-Size ContentProvider ChunkSessionStore (>1MB) ---

    @Test
    fun chunkSessionStoreAssemblesOverOneMillionChars() {
        var stored = ""
        val store = ChunkSessionStore(
            readTarget = { _, _, _ -> stored },
            writeTarget = { _, _, _, content -> stored = content }
        )
        val sid = store.beginSession(notetypeId = 123L, target = "css", ord = 0)
        val chunk = "A".repeat(65_536)
        repeat(18) { store.appendChunk(sid, chunk) }
        val charsWritten = store.commitSession(sid)
        assertEquals(65_536 * 18, charsWritten)
        assertEquals(charsWritten, stored.length)
        assertTrue(stored.length > 1_100_000)

        // Verify chunked reading back across boundaries
        val firstSlice = store.readChunk(123L, "css", 0, 0, 100_000)
        assertEquals(100_000, firstSlice.chunk.length)
        assertEquals(stored.length, firstSlice.totalLength)
        assertEquals(false, firstSlice.eof)

        val tailSlice = store.readChunk(123L, "css", 0, stored.length - 10, 100)
        assertEquals(10, tailSlice.chunk.length)
        assertTrue(tailSlice.eof)
    }
}
