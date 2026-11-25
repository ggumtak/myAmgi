package com.ggumtak.myamgi

import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.provider.ChunkSessionStore
import com.ggumtak.myamgi.provider.FlashcardsOps
import net.ankiweb.rsdroid.testing.RustBackendLoader
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * The provider operations against the REAL Anki engine, called exactly the way the Hanja app's AnkiBridge calls
 * AnkiDroid (same URIs' operations, projections, read-by-index, ContentValues keys, search strings).
 */
class MyAmgiProviderContractTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    private var typeId = 0L

    @Before
    fun setUp() {
        RustBackendLoader.ensureSetup()
        AnkiEngine.closeAll()
        AnkiEngine.setCollectionDir(tempFolder.newFolder("col"))
        typeId = vocabNoteType()
    }

    @After
    fun tearDown() {
        AnkiEngine.closeAll()
    }

    /** A two-card note type shaped like the owner's "JLPT MAX덱 어휘". */
    private fun vocabNoteType(): Long = AnkiEngine.withBackend { b ->
        val stock = b.getNotetypeNames().map { b.getNotetype(it.id) }
            .first { it.templatesCount == 2 && it.fieldsCount == 2 }
        val nt = stock.toBuilder()
            .setName("JLPT MAX덱 어휘")
            .setFields(0, stock.getFields(0).toBuilder().setName("Word"))
            .setFields(1, stock.getFields(1).toBuilder().setName("Meaning"))
            .setTemplates(0, stock.getTemplates(0).toBuilder().setName("일본어→한국어").setConfig(
                stock.getTemplates(0).config.toBuilder().setQFormat("{{Word}}").setAFormat("{{FrontSide}}<hr>{{Meaning}}")))
            .setTemplates(1, stock.getTemplates(1).toBuilder().setName("한국어→일본어").setConfig(
                stock.getTemplates(1).config.toBuilder().setQFormat("{{Meaning}}").setAFormat("{{FrontSide}}<hr>{{Word}}")))
            .build()
        b.updateNotetype(nt)
        nt.id
    }

    private fun one(t: com.ggumtak.myamgi.provider.ProviderTable, col: Int = 0): Any? {
        assertEquals(1, t.count)
        return t.value(0, col)
    }

    @Test
    fun noteTypesTemplatesCssAndFieldNamesReadLikeAnkiBridge() {
        // AnkiBridge.noteTypes: models with ("_id", "name"), read by index.
        val models = FlashcardsOps.models(arrayOf("_id", "name"))
        val row = models.rows().first { it[0] == typeId }
        assertEquals("JLPT MAX덱 어휘", row[1])

        // AnkiBridge.css / fieldNames: models/# with one column, getString(0).
        val css = one(FlashcardsOps.model(typeId, arrayOf("css"))) as String
        assertTrue(css.isNotEmpty())
        assertEquals("Word\u001fMeaning", one(FlashcardsOps.model(typeId, arrayOf("field_names"))))

        // AnkiBridge.templates: ("ord", "card_template_name", "question_format", "answer_format").
        val templates = FlashcardsOps.templates(typeId, arrayOf("ord", "card_template_name", "question_format", "answer_format")).rows()
        assertEquals(listOf(0, "일본어→한국어", "{{Word}}", "{{FrontSide}}<hr>{{Meaning}}"), templates[0])
        assertEquals(1, templates[1][0])

        // A note type that does not exist: an empty cursor, as the Hanja app expects ("not found").
        assertEquals(0, FlashcardsOps.model(424242L, arrayOf("css")).count)
    }

    @Test
    fun templateAndCssWritesLandAndReadBack() {
        // AnkiBridge.write: one side per update of models/#/templates/<ord>; > 0 means taken.
        assertEquals(1, FlashcardsOps.updateTemplate(typeId, 0, mapOf("question_format" to "{{Word}}<!-- 한자 바로보기 -->")))
        assertEquals(1, FlashcardsOps.updateTemplate(typeId, 0, mapOf("answer_format" to "BACK")))
        val t = FlashcardsOps.template(typeId, 0, arrayOf("question_format", "answer_format")).rows().single()
        assertEquals(listOf("{{Word}}<!-- 한자 바로보기 -->", "BACK"), t)
        // The other card type untouched.
        assertEquals("{{Meaning}}", one(FlashcardsOps.template(typeId, 1, arrayOf("question_format"))))
        // No such card type: 0 rows changed, not an exception.
        assertEquals(0, FlashcardsOps.updateTemplate(typeId, 7, mapOf("question_format" to "x")))
        assertEquals(0, FlashcardsOps.updateTemplate(typeId, 0, emptyMap()))

        // AnkiBridge.writeCss: update models/# with "css".
        assertEquals(1, FlashcardsOps.updateModel(typeId, mapOf("css" to ".card{}\n/* 한자 바로보기 코드: */")))
        assertEquals(".card{}\n/* 한자 바로보기 코드: */", one(FlashcardsOps.model(typeId, arrayOf("css"))))
    }

    @Test
    fun templatesLargerThanABinderCallGoThroughChunkSessions() {
        val store = ChunkSessionStore(FlashcardsOps::readTarget, FlashcardsOps::writeTarget)
        val big = "{{Meaning}}<div>" + "漢字".repeat(450_000) + "</div>" // 900,022 characters, like the JLPT MAX templates
        val sid = store.beginSession(typeId, "qfmt", 1)
        big.chunked(200_000).forEach { store.appendChunk(sid, it) }
        assertEquals(big.length, store.commitSession(sid))
        assertEquals(big, one(FlashcardsOps.template(typeId, 1, arrayOf("question_format"))))

        val read = StringBuilder()
        var offset = 0
        while (true) {
            val r = store.readChunk(typeId, "qfmt", 1, offset, 250_000)
            read.append(r.chunk)
            offset += r.chunk.length
            if (r.eof) break
        }
        assertEquals(big, read.toString())
        assertEquals(0, store.openSessions())
    }

    @Test
    fun uncommittedSessionsExpire() {
        var now = 0L
        val store = ChunkSessionStore({ _, _, _ -> "" }, { _, _, _, _ -> }, ttlMillis = 1_000, clock = { now })
        store.beginSession(1, "css", 0)
        now = 5_000
        store.beginSession(1, "css", 0)
        assertEquals(1, store.openSessions())
    }

    @Test
    fun vocabularyFlowOfTheHanjaApp() {
        // AnkiBridge.deckId: look the deck up by full name, insert ("deck_name") when missing; parents created.
        val deckName = "일본어::종합 실전::어휘::자주 까먹는 단어"
        assertTrue(FlashcardsOps.decks(arrayOf("deck_id", "deck_name")).rows().none { it[1] == deckName })
        val deckId = FlashcardsOps.insertDeck(deckName)
        val decks = FlashcardsOps.decks(arrayOf("deck_id", "deck_name")).rows()
        assertTrue(decks.any { it[0] == deckId && it[1] == deckName })
        assertTrue(decks.any { it[1] == "일본어::종합 실전::어휘" })
        // A second insert of the same name returns the same deck, never a "name+" copy.
        assertEquals(deckId, FlashcardsOps.insertDeck(deckName))

        // A deck note to copy from, then the Hanja app's insert: ("mid", "flds" joined by \u001f, "tags").
        val source = FlashcardsOps.insertNote(mapOf("mid" to typeId, "flds" to "<ruby>勉強<rt>べんきょう</rt></ruby>\u001f공부", "tags" to "jlpt"))
        val noteId = FlashcardsOps.insertNote(mapOf("mid" to typeId, "flds" to "勉強\u001f공부", "tags" to "한자바로보기 자주까먹는단어"))
        assertNotEquals(source, noteId)

        // AnkiBridge.notes / count: notes with ("_id", "flds") and an Anki search as the selection.
        val all = FlashcardsOps.notes("mid:$typeId", arrayOf("_id", "flds")).rows()
        assertEquals(2, all.size)
        assertTrue(all.any { it[0] == noteId && it[1] == "勉強\u001f공부" })
        assertEquals(1, FlashcardsOps.notes("mid:$typeId -tag:자주까먹는단어", arrayOf("_id")).count)
        // VocabNote.sameWordQuery: "<scope> \"Word:*勉*\"".
        assertEquals(2, FlashcardsOps.notes("mid:$typeId \"Word:*勉*\"", arrayOf("_id", "flds")).count)
        // The engine keeps tags sorted; the set is what was sent.
        assertEquals(setOf("한자바로보기", "자주까먹는단어"), (one(FlashcardsOps.note(noteId, arrayOf("tags"))) as String).split(" ").toSet())

        // addNote: cards of the note ("ord", "card_name"), each moved with "deck_id", the recall card suspended.
        val cards = FlashcardsOps.noteCards(noteId, arrayOf("ord", "card_name")).rows()
        assertEquals(listOf(listOf<Any?>(0, "일본어→한국어"), listOf<Any?>(1, "한국어→일본어")), cards)
        for (c in cards) assertEquals(1, FlashcardsOps.updateCard(noteId, c[0] as Int, mapOf("deck_id" to deckId)))
        assertEquals(1, FlashcardsOps.updateSchedule(mapOf("note_id" to noteId, "ord" to 1, "suspended" to 1)))

        val inDeck = AnkiEngine.cardsOfNote(noteId).map { AnkiEngine.getCard(it) }
        assertTrue(inDeck.all { it.deckId == deckId })
        assertEquals(-1, inDeck.first { it.templateIdx == 1 }.queue)
        assertTrue(inDeck.first { it.templateIdx == 0 }.queue >= 0)

        // VocabNote.searchQuery: deck:"<deck>" "<word>" (the deck's "::" kept).
        assertEquals(1, FlashcardsOps.notes("deck:\"$deckName\" \"勉強\"", arrayOf("_id")).count)
        assertEquals(1, one(FlashcardsOps.noteCard(noteId, 1, arrayOf("ord"))))
    }

    @Test
    fun aTemplateTheEngineRefusesIsAnErrorNotACrash() {
        // Anki refuses a front without any field; the provider turns that into an IllegalStateException
        // (MyAmgiProvider.parcelable), which Binder carries back to the caller.
        val e = runCatching {
            com.ggumtak.myamgi.provider.parcelable { FlashcardsOps.updateTemplate(typeId, 1, mapOf("question_format" to "no field")) }
        }.exceptionOrNull()
        assertTrue(e is IllegalStateException)
        assertEquals("{{Meaning}}", one(FlashcardsOps.template(typeId, 1, arrayOf("question_format"))))
    }

    @Test
    fun noteInsertFitsFieldsAndUsesTheDefaultDeck() {
        val noteId = FlashcardsOps.insertNote(mapOf("mid" to typeId, "flds" to "only one"))
        assertEquals("only one\u001f", one(FlashcardsOps.note(noteId, arrayOf("flds"))))
        assertTrue(AnkiEngine.cardsOfNote(noteId).isNotEmpty())
        assertEquals(0, FlashcardsOps.note(99_999L, arrayOf("flds")).count)
    }

    @Test
    fun firstCallOpensTheEngineAndCallersMayRunConcurrently() {
        // As when another app calls before MyAmgiApp.onCreate warmed the engine: nothing opened yet.
        AnkiEngine.closeAll()
        assertFalse(AnkiEngine.isCollectionOpen())
        assertTrue(FlashcardsOps.models(arrayOf("_id", "name")).count > 0)
        assertTrue(AnkiEngine.isCollectionOpen())

        val pool = Executors.newFixedThreadPool(6)
        val jobs = (0 until 24).map { i ->
            pool.submit<Unit> {
                if (i % 3 == 0) FlashcardsOps.insertNote(mapOf("mid" to typeId, "flds" to "語$i\u001f말$i"))
                else FlashcardsOps.notes("mid:$typeId", arrayOf("_id", "flds")).rows()
                FlashcardsOps.updateModel(typeId, mapOf("css" to ".c$i{}"))
            }
        }
        jobs.forEach { it.get(60, TimeUnit.SECONDS) }
        pool.shutdown()
        assertEquals(8, FlashcardsOps.notes("mid:$typeId", arrayOf("_id")).count)
    }
}
