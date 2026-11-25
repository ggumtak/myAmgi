package com.ggumtak.myamgi.desktop

import anki.config.OptionalStringConfigKey
import anki.notetypes.StockNotetype.OriginalStockKind
import anki.scheduler.CardAnswer
import com.ggumtak.myamgi.engine.AnkiEngine
import com.google.protobuf.ByteString
import java.awt.Color
import java.awt.Font
import java.awt.RenderingHints
import java.awt.image.BufferedImage
import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import javax.imageio.ImageIO
import kotlin.math.PI
import kotlin.math.sin

/**
 * A realistic sample collection for development and UI tests: nested decks, Basic and Cloze notes in
 * Korean/Japanese/English, media references, and cards in every state (new, learning, review due,
 * suspended, flagged).
 */
object SampleCollection {
    const val IMAGE = "seed_kanji.png"
    val SOUNDS = listOf("seed_tone_a.wav", "seed_tone_b.wav", "seed_tone_c.wav")

    private val KANJI = listOf(
        "日" to "날 일 · にち/ひ", "月" to "달 월 · げつ/つき", "火" to "불 화 · か/ひ", "水" to "물 수 · すい/みず",
        "木" to "나무 목 · もく/き", "金" to "쇠 금 · きん/かね", "土" to "흙 토 · ど/つち", "山" to "메 산 · さん/やま",
        "川" to "내 천 · せん/かわ", "人" to "사람 인 · じん/ひと", "口" to "입 구 · こう/くち", "目" to "눈 목 · もく/め",
        "手" to "손 수 · しゅ/て", "足" to "발 족 · そく/あし", "学" to "배울 학 · がく/まなぶ", "生" to "날 생 · せい/いきる",
        "先" to "먼저 선 · せん/さき", "年" to "해 년 · ねん/とし", "本" to "근본 본 · ほん/もと", "語" to "말씀 어 · ご/かたる"
    )

    private val VOCAB = listOf(
        "勉強（べんきょう）" to "공부", "学校（がっこう）" to "학교", "先生（せんせい）" to "선생님", "友達（ともだち）" to "친구",
        "電車（でんしゃ）" to "전철", "天気（てんき）" to "날씨", "時間（じかん）" to "시간", "言葉（ことば）" to "말, 단어",
        "料理（りょうり）" to "요리", "仕事（しごと）" to "일, 직업", "旅行（りょこう）" to "여행", "映画（えいが）" to "영화",
        "音楽（おんがく）" to "음악", "図書館（としょかん）" to "도서관", "病院（びょういん）" to "병원", "約束（やくそく）" to "약속",
        "練習（れんしゅう）" to "연습", "質問（しつもん）" to "질문", "準備（じゅんび）" to "준비", "経験（けいけん）" to "경험"
    )

    private val ENGLISH = listOf(
        "abandon" to "버리다, 포기하다", "brief" to "짧은, 간단한", "candid" to "솔직한", "diligent" to "부지런한",
        "eager" to "열망하는", "feasible" to "실행 가능한", "genuine" to "진짜의", "hesitate" to "망설이다",
        "inevitable" to "불가피한", "justify" to "정당화하다", "keen" to "예리한, 열심인", "linger" to "머무르다",
        "modest" to "겸손한", "notion" to "개념, 생각", "obscure" to "모호한"
    )

    private val CLOZES = listOf(
        "{{c1::서울}}은 대한민국의 수도이다.",
        "일본의 수도는 {{c1::도쿄}}이고, 가장 높은 산은 {{c2::후지산}}이다.",
        "\"ありがとう\"는 {{c1::고맙습니다}}라는 뜻이다.",
        "I {{c1::have been}} studying English for three years.",
        "물은 {{c1::100}}℃에서 끓는다.",
        "{{c1::漢字::한자}}는 중국에서 들어온 문자이다."
    )

    /** Seeds the open collection if it has no notes. Returns true if it seeded. */
    fun seedIfEmpty(): Boolean {
        if (AnkiEngine.searchNotes("deck:*").isNotEmpty()) return false
        seed()
        return true
    }

    fun seed() {
        val notetypes = AnkiEngine.getNotetypeNames().map { AnkiEngine.getNotetype(it.id) }
        val basic = notetypes.first { it.config.originalStockKind == OriginalStockKind.ORIGINAL_STOCK_KIND_BASIC }.id
        val cloze = notetypes.first { it.config.originalStockKind == OriginalStockKind.ORIGINAL_STOCK_KIND_CLOZE }.id

        val image = AnkiEngine.withBackend { it.addMediaFile(IMAGE, ByteString.copyFrom(kanjiPng())) }
        val sounds = SOUNDS.mapIndexed { i, name ->
            AnkiEngine.withBackend { it.addMediaFile(name, ByteString.copyFrom(toneWav(440.0 + 110 * i))) }
        }

        val kanjiDeck = AnkiEngine.createDeck("일본어::한자")
        val vocabDeck = AnkiEngine.createDeck("일본어::어휘")
        val englishDeck = AnkiEngine.createDeck("영어")

        val kanjiNotes = KANJI.mapIndexed { i, (front, back) ->
            val f = if (i < 2) "<div style=\"font-size:48px\">$front</div><img src=\"$image\">" else "<div style=\"font-size:48px\">$front</div>"
            AnkiEngine.addNote(basic, kanjiDeck, listOf(f, back), listOf("한자", "JLPT"))
        }
        val vocabNotes = VOCAB.mapIndexed { i, (front, back) ->
            val b = if (i < 3) "$back [sound:${sounds[i]}]" else back
            AnkiEngine.addNote(basic, vocabDeck, listOf(front, b), listOf("어휘"))
        }
        val englishNotes = ENGLISH.map { (front, back) ->
            AnkiEngine.addNote(basic, englishDeck, listOf(front, back), listOf("영단어"))
        }
        CLOZES.forEach { text -> AnkiEngine.addNote(cloze, englishDeck, listOf(text, ""), listOf("빈칸")) }

        fun cardsOf(notes: List<Long>) = notes.flatMap { AnkiEngine.cardsOfNote(it) }
        val kanjiCards = cardsOf(kanjiNotes)
        val vocabCards = cardsOf(vocabNotes)
        val englishCards = cardsOf(englishNotes)

        // Review cards due today
        AnkiEngine.withBackend { b ->
            b.setDueDate(kanjiCards.takeLast(6), "0", OptionalStringConfigKey.getDefaultInstance())
            b.setDueDate(englishCards.takeLast(5), "0", OptionalStringConfigKey.getDefaultInstance())
            b.setDueDate(vocabCards.takeLast(3), "1-5", OptionalStringConfigKey.getDefaultInstance())
        }

        // Learning cards: answer a few new vocabulary cards "Again"
        AnkiEngine.setCurrentDeck(vocabDeck)
        repeat(3) {
            val q = AnkiEngine.getQueuedCards(1)
            if (q.cardsCount > 0) {
                val c = q.getCards(0)
                AnkiEngine.answerCard(c.card.id, c.states, CardAnswer.Rating.AGAIN, 4000)
            }
        }
        // Some review history: answer the first two English cards in queue order "Good"
        AnkiEngine.setCurrentDeck(englishDeck)
        repeat(2) {
            val q = AnkiEngine.getQueuedCards(1)
            if (q.cardsCount > 0) {
                val c = q.getCards(0)
                AnkiEngine.answerCard(c.card.id, c.states, CardAnswer.Rating.GOOD, 3000)
            }
        }

        AnkiEngine.suspendCards(listOf(englishCards.first()))
        AnkiEngine.withBackend { b ->
            b.setFlag(listOf(kanjiCards[3]), 1)
            b.setFlag(listOf(vocabCards[5]), 4)
        }
        AnkiEngine.setCurrentDeck(1L)
    }

    private fun kanjiPng(): ByteArray {
        val img = BufferedImage(160, 120, BufferedImage.TYPE_INT_RGB)
        val g = img.createGraphics()
        g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON)
        g.color = Color(0xF4, 0xF5, 0xF8)
        g.fillRect(0, 0, 160, 120)
        g.color = Color(0x2F, 0x6F, 0xED)
        g.fillOval(20, 10, 100, 100)
        g.color = Color.WHITE
        g.font = Font(Font.SANS_SERIF, Font.BOLD, 40)
        g.drawString("ABC", 30, 75)
        g.dispose()
        return ByteArrayOutputStream().also { ImageIO.write(img, "png", it) }.toByteArray()
    }

    /** 0.4 s mono 16-bit PCM sine tone. */
    fun toneWav(freq: Double, seconds: Double = 0.4, rate: Int = 8000): ByteArray {
        val samples = (seconds * rate).toInt()
        val data = ByteBuffer.allocate(samples * 2).order(ByteOrder.LITTLE_ENDIAN)
        for (i in 0 until samples) {
            data.putShort((sin(2 * PI * freq * i / rate) * 12000).toInt().toShort())
        }
        val header = ByteBuffer.allocate(44).order(ByteOrder.LITTLE_ENDIAN).apply {
            put("RIFF".toByteArray()); putInt(36 + samples * 2); put("WAVE".toByteArray())
            put("fmt ".toByteArray()); putInt(16); putShort(1); putShort(1); putInt(rate); putInt(rate * 2)
            putShort(2); putShort(16)
            put("data".toByteArray()); putInt(samples * 2)
        }
        return header.array() + data.array()
    }
}
