package com.ggumtak.myamgi.host

import java.io.File
import java.nio.ByteBuffer
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction

/**
 * Pure-JVM charset normalizer for imported CSV/TSV/TXT files.
 *
 * Ensures Anki's Rust backend (which expects UTF-8) receives clean UTF-8 without BOM,
 * transparently converting Korean Excel CP949/EUC-KR and UTF-16 exports in-place.
 */
object CsvEncoding {
    private val UTF8_BOM = byteArrayOf(0xEF.toByte(), 0xBB.toByte(), 0xBF.toByte())
    private val UTF16_LE_BOM = byteArrayOf(0xFF.toByte(), 0xFE.toByte())
    private val UTF16_BE_BOM = byteArrayOf(0xFE.toByte(), 0xFF.toByte())

    /**
     * Inspects [file], converts it in-place to UTF-8 (without BOM) if needed,
     * and returns the detected encoding name (`"UTF-8"`, `"UTF-16LE"`, `"UTF-16BE"`, or `"CP949"`).
     */
    fun ensureUtf8(file: File): String {
        val bytes = file.readBytes()
        if (bytes.isEmpty()) return "UTF-8"

        // 1. UTF-8 BOM (EF BB BF)
        if (bytes.size >= 3 &&
            bytes[0] == UTF8_BOM[0] &&
            bytes[1] == UTF8_BOM[1] &&
            bytes[2] == UTF8_BOM[2]
        ) {
            val text = stripLeadingBom(decodeLenient(bytes, 3, bytes.size - 3, Charsets.UTF_8))
            writeFileAtomically(file, text.toByteArray(Charsets.UTF_8))
            return "UTF-8"
        }

        // 2. UTF-16 LE BOM (FF FE)
        if (bytes.size >= 2 &&
            bytes[0] == UTF16_LE_BOM[0] &&
            bytes[1] == UTF16_LE_BOM[1]
        ) {
            val text = stripLeadingBom(decodeLenient(bytes, 2, bytes.size - 2, Charsets.UTF_16LE))
            writeFileAtomically(file, text.toByteArray(Charsets.UTF_8))
            return "UTF-16LE"
        }

        // 3. UTF-16 BE BOM (FE FF)
        if (bytes.size >= 2 &&
            bytes[0] == UTF16_BE_BOM[0] &&
            bytes[1] == UTF16_BE_BOM[1]
        ) {
            val text = stripLeadingBom(decodeLenient(bytes, 2, bytes.size - 2, Charsets.UTF_16BE))
            writeFileAtomically(file, text.toByteArray(Charsets.UTF_8))
            return "UTF-16BE"
        }

        // 4. Strict UTF-8 check
        decodeStrict(bytes, Charsets.UTF_8)?.let { validUtf8 ->
            if (validUtf8.isNotEmpty() && validUtf8[0] == '\uFEFF') {
                writeFileAtomically(file, stripLeadingBom(validUtf8).toByteArray(Charsets.UTF_8))
            }
            return "UTF-8"
        }

        // 5. Korean Excel / legacy fallback: CP949 (x-windows-949) -> EUC-KR
        val cp949 = firstSupportedCharset("x-windows-949", "MS949", "EUC-KR")
            ?: Charsets.ISO_8859_1
        val text = decodeStrict(bytes, cp949)
            ?: decodeLenient(bytes, 0, bytes.size, cp949)
        writeFileAtomically(file, stripLeadingBom(text).toByteArray(Charsets.UTF_8))
        return if (cp949.name().equals("EUC-KR", ignoreCase = true)) "EUC-KR" else "CP949"
    }

    private fun firstSupportedCharset(vararg names: String): Charset? {
        for (name in names) {
            val cs = runCatching {
                if (Charset.isSupported(name)) Charset.forName(name) else null
            }.getOrNull()
            if (cs != null) return cs
        }
        return null
    }

    private fun decodeStrict(bytes: ByteArray, charset: Charset): String? {
        return try {
            val decoder = charset.newDecoder()
                .onMalformedInput(CodingErrorAction.REPORT)
                .onUnmappableCharacter(CodingErrorAction.REPORT)
            decoder.decode(ByteBuffer.wrap(bytes)).toString()
        } catch (_: CharacterCodingException) {
            null
        }
    }

    private fun decodeLenient(bytes: ByteArray, offset: Int, length: Int, charset: Charset): String {
        val decoder = charset.newDecoder()
            .onMalformedInput(CodingErrorAction.REPLACE)
            .onUnmappableCharacter(CodingErrorAction.REPLACE)
        return decoder.decode(ByteBuffer.wrap(bytes, offset, length)).toString()
    }

    private fun stripLeadingBom(text: String): String =
        if (text.isNotEmpty() && text[0] == '\uFEFF') text.substring(1) else text
}
