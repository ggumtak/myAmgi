package com.ggumtak.myamgi.desktop

import anki.config.OptionalStringConfigKey
import anki.decks.Deck
import anki.decks.SetDeckCollapsedRequest
import anki.notetypes.Notetype
import anki.notetypes.StockNotetype.OriginalStockKind
import anki.scheduler.CardAnswer
import com.ggumtak.myamgi.engine.AnkiEngine
import com.google.protobuf.ByteString
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
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
 * The sample collection for development and UI tests (`desktop --seed`). Deterministic: the same decks,
 * notes and cards in the same order every time, and fixed ids (see [renumber]).
 *
 * Decks (ids [DECK_IDS], in this order):
 * - `일본어` (parent, expanded) › `일본어::어휘` (audio), `일본어::한자` (image, description with HTML,
 *   the 3+ field note type [KANJI_NOTETYPE])
 * - `수학` (MathJax, the long card)
 * - `영어` (Basic, type-in-the-answer, Cloze, the suspended card, the marked note)
 * - `집중 복습` (filtered deck pulling new English vocabulary)
 *
 * Every top-level normal deck has new, learning and review cards due today, except `수학` (new only).
 * Special cards carry tags under `샘플::` so tests can find them with a search (see [TAGS]).
 * Note ids start at [NOTE_ID_BASE], card ids at [CARD_ID_BASE] (one second apart, in creation order).
 */
object SampleCollection {
    const val IMAGE = "seed_kanji.png"
    val SOUNDS = listOf("seed_tone_a.wav", "seed_tone_b.wav", "seed_tone_c.wav")

    /** 2026-01-01T00:00:00Z: notes and cards look like they were added then. */
    const val NOTE_ID_BASE = 1_767_225_600_000L
    const val CARD_ID_BASE = 1_767_225_600_000L

    /** Fixed deck ids, by full name. */
    val DECK_IDS = linkedMapOf(
        "일본어" to 1_767_225_600_001L,
        "일본어::한자" to 1_767_225_600_002L,
        "일본어::어휘" to 1_767_225_600_003L,
        "영어" to 1_767_225_600_004L,
        "수학" to 1_767_225_600_005L,
        "집중 복습" to 1_767_225_600_006L,
    )

    const val KANJI_NOTETYPE = "한자 (뜻·읽기·예문)"
    const val FILTERED_DECK = "집중 복습"

    /** Tag for each special card, `샘플::<what>`. */
    object TAGS {
        const val AUDIO = "샘플::오디오"
        const val IMAGE = "샘플::이미지"
        const val MATH = "샘플::수식"
        const val TYPE = "샘플::입력"
        const val LONG = "샘플::긴카드"
        const val CLOZE = "샘플::빈칸"
        const val SUSPENDED = "샘플::일시중지"
        const val FLAGGED = "샘플::깃발"
        const val FIELDS = "샘플::여러필드"
    }

    private val KANJI = listOf(
        "日" to "날 일 · にち/ひ", "月" to "달 월 · げつ/つき", "火" to "불 화 · か/ひ", "水" to "물 수 · すい/みず",
        "木" to "나무 목 · もく/き", "金" to "쇠 금 · きん/かね", "土" to "흙 토 · ど/つち", "山" to "메 산 · さん/やま",
        "川" to "내 천 · せん/かわ", "人" to "사람 인 · じん/ひと", "口" to "입 구 · こう/くち", "目" to "눈 목 · もく/め",
        "手" to "손 수 · しゅ/て", "足" to "발 족 · そく/あし", "学" to "배울 학 · がく/まなぶ", "生" to "날 생 · せい/いきる",
    )

    /** For the 4-field note type: kanji, meaning, reading, example. */
    private val KANJI_FIELDS = listOf(
        listOf("漢", "한수 한", "かん", "漢字（かんじ）を勉強する。"),
        listOf("字", "글자 자", "じ", "字（じ）がきれいだ。"),
        listOf("語", "말씀 어", "ご/かたる", "日本語（にほんご）を話す。"),
        listOf("先", "먼저 선", "せん/さき", "先生（せんせい）に聞く。"),
    )

    private val VOCAB = listOf(
        "勉強（べんきょう）" to "공부", "学校（がっこう）" to "학교", "先生（せんせい）" to "선생님", "友達（ともだち）" to "친구",
        "電車（でんしゃ）" to "전철", "天気（てんき）" to "날씨", "時間（じかん）" to "시간", "言葉（ことば）" to "말, 단어",
        "料理（りょうり）" to "요리", "仕事（しごと）" to "일, 직업", "旅行（りょこう）" to "여행", "映画（えいが）" to "영화",
        "音楽（おんがく）" to "음악", "図書館（としょかん）" to "도서관", "病院（びょういん）" to "병원", "約束（やくそく）" to "약속",
    )

    private val ENGLISH = listOf(
        "abandon" to "버리다, 포기하다", "brief" to "짧은, 간단한", "candid" to "솔직한", "diligent" to "부지런한",
        "eager" to "열망하는", "feasible" to "실행 가능한", "genuine" to "진짜의", "hesitate" to "망설이다",
        "inevitable" to "불가피한", "justify" to "정당화하다", "keen" to "예리한, 열심인", "linger" to "머무르다",
        "modest" to "겸손한", "notion" to "개념, 생각", "obscure" to "모호한",
    )

    private val TYPING = listOf("사과 (영어로)" to "apple", "도서관 (영어로)" to "library")

    private val CLOZES = listOf(
        "{{c1::서울}}은 대한민국의 수도이다.",
        "일본의 수도는 {{c1::도쿄}}이고, 가장 높은 산은 {{c2::후지산}}이다.",
        "\"ありがとう\"는 {{c1::고맙습니다}}라는 뜻이다.",
        "I {{c1::have been}} studying English for three years.",
    )

    private val MATH = listOf(
        "원의 방정식" to "\\(x^2 + y^2 = r^2\\)",
        "이차방정식의 근의 공식" to "\\[x = \\frac{-b \\pm \\sqrt{b^2-4ac}}{2a}\\]",
        "\\(\\int_0^1 x\\,dx\\) 의 값은?" to "\\(\\frac{1}{2}\\)",
    )

    /** Seeds the open collection if it has no notes. Returns true if it seeded. */
    fun seedIfEmpty(): Boolean {
        if (AnkiEngine.searchNotes("deck:*").isNotEmpty()) return false
        seed()
        return true
    }

    fun seed() {
        val notetypes = AnkiEngine.getNotetypeNames().map { AnkiEngine.getNotetype(it.id) }
        fun stock(kind: OriginalStockKind) = notetypes.first { it.config.originalStockKind == kind }
        val basic = stock(OriginalStockKind.ORIGINAL_STOCK_KIND_BASIC)
        val cloze = stock(OriginalStockKind.ORIGINAL_STOCK_KIND_CLOZE).id
        val typing = stock(OriginalStockKind.ORIGINAL_STOCK_KIND_BASIC_TYPING).id
        val kanjiType = addKanjiNotetype(basic)

        val image = AnkiEngine.withBackend { it.addMediaFile(IMAGE, ByteString.copyFrom(kanjiPng())) }
        val sounds = SOUNDS.mapIndexed { i, name ->
            AnkiEngine.withBackend { it.addMediaFile(name, ByteString.copyFrom(toneWav(440.0 + 110 * i))) }
        }

        // Creation order = fixed id order (DECK_IDS).
        val japanese = AnkiEngine.createDeck("일본어")
        val kanjiDeck = AnkiEngine.createDeck("일본어::한자")
        val vocabDeck = AnkiEngine.createDeck("일본어::어휘")
        val englishDeck = AnkiEngine.createDeck("영어")
        val mathDeck = AnkiEngine.createDeck("수학")
        setDescription(
            kanjiDeck,
            "<b>JLPT N3</b> 한자 카드입니다. <i>매일 조금씩!</i>" +
                "<script>window.__xss = 1</script><span onclick=\"window.__xss=2\">안전</span>"
        )

        val kanjiNotes = KANJI.mapIndexed { i, (front, back) ->
            val f = if (i < 2) "<div style=\"font-size:48px\">$front</div><img src=\"$image\">" else "<div style=\"font-size:48px\">$front</div>"
            val tags = listOf("한자", "JLPT") + if (i < 2) listOf(TAGS.IMAGE) else emptyList()
            AnkiEngine.addNote(basic.id, kanjiDeck, listOf(f, back), tags)
        }
        KANJI_FIELDS.forEach { fields ->
            AnkiEngine.addNote(kanjiType, kanjiDeck, fields, listOf("한자", TAGS.FIELDS))
        }
        val vocabNotes = VOCAB.mapIndexed { i, (front, back) ->
            val b = if (i < 3) "$back [sound:${sounds[i]}]" else back
            AnkiEngine.addNote(basic.id, vocabDeck, listOf(front, b), listOf("어휘") + if (i < 3) listOf(TAGS.AUDIO) else emptyList())
        }
        val englishNotes = ENGLISH.mapIndexed { i, (front, back) ->
            AnkiEngine.addNote(basic.id, englishDeck, listOf(front, back), listOf("영단어") + if (i == 1) listOf("marked") else emptyList())
        }
        TYPING.forEach { (front, back) -> AnkiEngine.addNote(typing, englishDeck, listOf(front, back), listOf("영단어", TAGS.TYPE)) }
        CLOZES.forEach { text -> AnkiEngine.addNote(cloze, englishDeck, listOf(text, ""), listOf("빈칸", TAGS.CLOZE)) }
        MATH.forEach { (front, back) -> AnkiEngine.addNote(basic.id, mathDeck, listOf(front, back), listOf("수학", TAGS.MATH)) }
        AnkiEngine.addNote(basic.id, mathDeck, listOf("긴 카드: 피타고라스 정리의 증명들", longAnswer()), listOf("수학", TAGS.LONG))

        fun cardsOf(notes: List<Long>) = notes.flatMap { AnkiEngine.cardsOfNote(it) }
        val kanjiCards = cardsOf(kanjiNotes)
        val vocabCards = cardsOf(vocabNotes)
        val englishCards = cardsOf(englishNotes)

        // Review cards due today (and a few in the next days)
        AnkiEngine.withBackend { b ->
            val none = OptionalStringConfigKey.getDefaultInstance()
            b.setDueDate(kanjiCards.takeLast(6), "0", none)
            b.setDueDate(vocabCards.takeLast(4).take(2), "0", none)
            b.setDueDate(vocabCards.takeLast(2), "3", none)
            b.setDueDate(englishCards.takeLast(5), "0", none)
        }

        // Learning cards: answer the first new card of each deck "Again"; English also gets two "Good" answers.
        answerFirst(kanjiDeck, CardAnswer.Rating.AGAIN, 2)
        answerFirst(vocabDeck, CardAnswer.Rating.AGAIN, 2)
        answerFirst(englishDeck, CardAnswer.Rating.AGAIN, 1)
        answerFirst(englishDeck, CardAnswer.Rating.GOOD, 2)

        AnkiEngine.suspendCards(listOf(englishCards.first()))
        AnkiEngine.withBackend { b ->
            b.addNoteTags(listOf(englishNotes.first()), TAGS.SUSPENDED)
            b.setFlag(listOf(kanjiCards[3]), 1)
            b.setFlag(listOf(vocabCards[5]), 4)
            b.addNoteTags(listOf(kanjiNotes[3], vocabNotes[5]), TAGS.FLAGGED)
        }

        addFilteredDeck()
        renumber(listOf(japanese, kanjiDeck, vocabDeck, englishDeck, mathDeck) + listOfNotNull(deckId(FILTERED_DECK)))

        // Parents expanded in the deck list and the browser.
        for (id in DECK_IDS.values) {
            AnkiEngine.withBackend { b ->
                b.setDeckCollapsed(id, false, SetDeckCollapsedRequest.Scope.REVIEWER)
                b.setDeckCollapsed(id, false, SetDeckCollapsedRequest.Scope.BROWSER)
            }
        }
        AnkiEngine.setCurrentDeck(1L)
    }

    private fun deckId(name: String): Long? = AnkiEngine.getDeckNames().firstOrNull { it.name == name }?.id

    private fun answerFirst(deck: Long, rating: CardAnswer.Rating, times: Int) {
        AnkiEngine.setCurrentDeck(deck)
        repeat(times) {
            val q = AnkiEngine.getQueuedCards(1)
            if (q.cardsCount > 0) {
                val c = q.getCards(0)
                AnkiEngine.answerCard(c.card.id, c.states, rating, 4000)
            }
        }
    }

    private fun setDescription(deckId: Long, html: String) = AnkiEngine.withBackend { b ->
        val d = b.getDeck(deckId)
        b.updateDeck(d.toBuilder().setNormal(d.normal.toBuilder().setDescription(html)).build())
    }

    /** A copy of Basic with four fields and one card type. */
    private fun addKanjiNotetype(basic: Notetype): Long = AnkiEngine.withBackend { b ->
        val field = basic.getFields(0)
        val fields = listOf("한자", "뜻", "읽기", "예문").map { name ->
            field.toBuilder().clearOrd().setName(name).setConfig(field.config.toBuilder().clearId()).build()
        }
        val t = basic.getTemplates(0)
        val template = t.toBuilder().clearOrd().setName("한자 → 뜻").setConfig(
            t.config.toBuilder().clearId()
                .setQFormat("<div class=\"kanji\">{{한자}}</div>")
                .setAFormat("{{FrontSide}}\n\n<hr id=answer>\n\n{{뜻}}<br>{{읽기}}\n<div class=\"example\">{{예문}}</div>")
        ).build()
        val css = basic.config.css + "\n.kanji { font-size: 64px; }\n.example { margin-top: 12px; color: #666; }\n"
        val nt = basic.toBuilder().setId(0).setName(KANJI_NOTETYPE)
            .clearFields().addAllFields(fields)
            .clearTemplates().addTemplates(template)
            .setConfig(basic.config.toBuilder().setCss(css).clearOriginalStockKind().clearOriginalId())
            .build()
        b.addNotetype(nt).id
    }

    private fun addFilteredDeck() = AnkiEngine.withBackend { b ->
        val base = b.getOrCreateFilteredDeck(0)
        val term = Deck.Filtered.SearchTerm.newBuilder()
            .setSearch("deck:영어 tag:영단어 is:new")
            .setLimit(4)
            .setOrder(Deck.Filtered.SearchTerm.Order.ADDED)
        val cfg = base.config.toBuilder().clearSearchTerms().addSearchTerms(term).setReschedule(true)
        b.addOrUpdateFilteredDeck(base.toBuilder().setName(FILTERED_DECK).setConfig(cfg).build())
    }

    /**
     * The engine assigns time-based ids. Rewrite decks, notes and cards to fixed ids (in creation order)
     * so tests and other tools can rely on them, then reopen the collection to drop cached state.
     */
    private fun renumber(deckIdsInOrder: List<Long>) {
        AnkiEngine.withBackend { b ->
            fun ids(sql: String): List<Long> = (b.fullQuery(sql) as JsonArray).map { it.jsonArray[0].jsonPrimitive.long }
            fun exec(sql: String, vararg args: Any) = b.executeGetRowsAffected(sql, arrayOf(*args))
            // New ids are all below the engine's (current time) ids, so no step can collide.
            deckIdsInOrder.zip(DECK_IDS.values).forEach { (old, new) ->
                exec("update decks set id = ? where id = ?", new, old)
                exec("update cards set did = ? where did = ?", new, old)
                exec("update cards set odid = ? where odid = ?", new, old)
            }
            ids("select id from notes order by id").forEachIndexed { i, old ->
                val new = NOTE_ID_BASE + i * 1000L
                exec("update notes set id = ? where id = ?", new, old)
                exec("update cards set nid = ? where nid = ?", new, old)
            }
            ids("select id from cards order by nid, ord").forEachIndexed { i, old ->
                val new = CARD_ID_BASE + i * 1000L
                exec("update cards set id = ? where id = ?", new, old)
                exec("update revlog set cid = ? where cid = ?", new, old)
            }
        }
        AnkiEngine.closeCollection()
        AnkiEngine.ensureOpen()
    }

    private fun longAnswer(): String = buildString {
        append("<p><b>피타고라스 정리</b>: 직각삼각형에서 \\(a^2 + b^2 = c^2\\).</p>")
        for (i in 1..24) {
            append("<p>증명 $i. 이 문단은 카드가 화면보다 길 때 카드 영역 안에서 스크롤되는지 확인하기 위한 내용입니다. ")
            append("넓이를 두 가지 방법으로 계산하면 같은 식을 얻습니다.</p>")
        }
        append("<p id=\"long-card-end\">끝.</p>")
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
