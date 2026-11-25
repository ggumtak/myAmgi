package com.ggumtak.myamgi.engine

import android.content.Context
import java.io.File
import java.nio.ByteBuffer
import java.nio.charset.Charset
import java.nio.charset.CodingErrorAction

data class DecodedText(
    val charsetName: String,
    val text: String
)

/**
 * Pure JVM-testable automatic character encoding detector for imported CSV/TSV/TXT files.
 *
 * Detection order:
 * 1. UTF-8 BOM (EF BB BF)
 * 2. UTF-16 LE BOM (FF FE) and UTF-16 BE BOM (FE FF)
 * 3. Strict UTF-8 (via CharsetDecoder with CodingErrorAction.REPORT)
 * 4. Heuristic scoring between CP949/EUC-KR (x-windows-949 / MS949 / EUC-KR),
 *    Shift-JIS (MS932 / Shift_JIS), and Windows-1252 / ISO-8859-1 fallback.
 */
object EncodingDetector {

    private data class CandidateEncoding(
        val displayName: String,
        val charset: Charset,
        val isKorean: Boolean = false,
        val isJapanese: Boolean = false
    )

    private data class ScoredCandidate(
        val displayName: String,
        val text: String,
        val score: Long
    )

    private val eucKrCharset: Charset? by lazy {
        firstSupportedCharset("EUC-KR")
    }

    fun detectAndDecode(bytes: ByteArray): DecodedText {
        if (bytes.isEmpty()) {
            return DecodedText("UTF-8", "")
        }

        // 1. UTF-8 BOM: EF BB BF
        if (bytes.size >= 3 &&
            bytes[0] == 0xEF.toByte() &&
            bytes[1] == 0xBB.toByte() &&
            bytes[2] == 0xBF.toByte()
        ) {
            val decoded = String(bytes, 3, bytes.size - 3, Charsets.UTF_8)
            return DecodedText("UTF-8", stripLeadingBom(decoded))
        }

        // 2. UTF-16 LE BOM: FF FE
        if (bytes.size >= 2 &&
            bytes[0] == 0xFF.toByte() &&
            bytes[1] == 0xFE.toByte()
        ) {
            val decoded = String(bytes, 2, bytes.size - 2, Charsets.UTF_16LE)
            return DecodedText("UTF-16LE", stripLeadingBom(decoded))
        }

        // 3. UTF-16 BE BOM: FE FF
        if (bytes.size >= 2 &&
            bytes[0] == 0xFE.toByte() &&
            bytes[1] == 0xFF.toByte()
        ) {
            val decoded = String(bytes, 2, bytes.size - 2, Charsets.UTF_16BE)
            return DecodedText("UTF-16BE", stripLeadingBom(decoded))
        }

        // 4. Strict UTF-8
        decodeStrict(bytes, Charsets.UTF_8)?.let { utf8Text ->
            return DecodedText("UTF-8", stripLeadingBom(utf8Text))
        }

        // 5. Heuristic distinction between CP949/EUC-KR and Shift-JIS (+ Western fallback)
        val candidates = buildList {
            firstSupportedCharset("x-windows-949", "MS949", "EUC-KR")?.let { cs ->
                val name = if (cs.name().equals("EUC-KR", ignoreCase = true)) "EUC-KR" else "CP949"
                add(CandidateEncoding(name, cs, isKorean = true))
            }
            firstSupportedCharset("MS932", "Shift_JIS")?.let { cs ->
                add(CandidateEncoding("Shift_JIS", cs, isJapanese = true))
            }
            firstSupportedCharset("windows-1252", "ISO-8859-1")?.let { cs ->
                add(CandidateEncoding(cs.name(), cs))
            }
        }

        val scored = mutableListOf<ScoredCandidate>()
        for (candidate in candidates) {
            val strictText = decodeStrict(bytes, candidate.charset)
            if (strictText != null) {
                val score = scoreDecodedText(
                    text = strictText,
                    strictValid = true,
                    isKorean = candidate.isKorean,
                    isJapanese = candidate.isJapanese
                )
                scored += ScoredCandidate(candidate.displayName, strictText, score)
            } else if (candidate.isKorean || candidate.isJapanese) {
                val lenientText = decodeLenient(bytes, candidate.charset)
                val score = scoreDecodedText(
                    text = lenientText,
                    strictValid = false,
                    isKorean = candidate.isKorean,
                    isJapanese = candidate.isJapanese
                )
                scored += ScoredCandidate(candidate.displayName, lenientText, score)
            }
        }

        val best = scored.maxByOrNull { it.score }
        if (best != null) {
            return DecodedText(best.displayName, stripLeadingBom(best.text))
        }

        return DecodedText("UTF-8", stripLeadingBom(String(bytes, Charsets.UTF_8)))
    }

    fun writeUtf8TempFile(
        context: Context,
        bytes: ByteArray,
        fileNameHint: String = "import.csv"
    ): Pair<String, File> {
        val decoded = detectAndDecode(bytes)
        val safeName = fileNameHint
            .substringAfterLast('/')
            .substringAfterLast('\\')
            .replace(Regex("[^A-Za-z0-9._-]"), "_")
            .ifBlank { "import.csv" }

        val dir = File(context.cacheDir, "imports").apply {
            if (!exists()) mkdirs()
        }
        val outFile = File.createTempFile("myamgi_", "_$safeName", dir)
        outFile.writeText(decoded.text, Charsets.UTF_8)
        return decoded.charsetName to outFile
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

    private fun decodeLenient(bytes: ByteArray, charset: Charset): String {
        val decoder = charset.newDecoder()
            .onMalformedInput(CodingErrorAction.REPLACE)
            .onUnmappableCharacter(CodingErrorAction.REPLACE)
        return decoder.decode(ByteBuffer.wrap(bytes)).toString()
    }

    private fun scoreDecodedText(
        text: String,
        strictValid: Boolean,
        isKorean: Boolean,
        isJapanese: Boolean
    ): Long {
        var score = if (strictValid) 100L else -50L
        val eucEncoder = if (isKorean) eucKrCharset?.newEncoder() else null

        for (ch in text) {
            when {
                ch == '\uFFFD' -> score -= 200L
                ch.code < 0x20 && ch != '\n' && ch != '\r' && ch != '\t' -> score -= 30L
                ch in '\uAC00'..'\uD7A3' -> {
                    // KS X 1001 common Hangul syllables strongly indicate real Korean text;
                    // Shift-JIS 0x82/0x83 bytes decoded as CP949 map to rare extended syllables outside EUC-KR.
                    val isCommonHangul = eucEncoder == null || eucEncoder.canEncode(ch)
                    score += when {
                        isKorean && isCommonHangul -> 12L
                        isKorean -> 1L
                        else -> 2L
                    }
                }
                ch in '\u3131'..'\u318E' -> {
                    score += if (isKorean) 6L else 1L
                }
                ch in '\u3040'..'\u309F' || ch in '\u30A0'..'\u30FF' -> {
                    // Hiragana & full-width Katakana strongly indicate Japanese text
                    score += if (isJapanese) 12L else 1L
                }
                ch in '\uFF61'..'\uFF9F' -> {
                    // Korean EUC-KR bytes (0xA1..0xDF) frequently turn into half-width Katakana under Shift-JIS
                    score -= 3L
                }
                ch in '\u4E00'..'\u9FFF' -> {
                    score += if (isJapanese || isKorean) 4L else 0L
                }
                ch in '\u0020'..'\u007E' -> score += 1L
                ch in '\u00A0'..'\u024F' -> {
                    score += if (!isKorean && !isJapanese) 3L else 0L
                }
            }
        }

        // Small deterministic preference for Korean over Shift-JIS when scores tie
        if (isKorean) score += 1L
        return score
    }

    private fun stripLeadingBom(text: String): String {
        return if (text.isNotEmpty() && text[0] == '\uFEFF') text.substring(1) else text
    }
}
