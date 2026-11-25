package com.ggumtak.myamgi

import com.ggumtak.myamgi.provider.FlashcardsContract
import com.ggumtak.myamgi.provider.ProviderTable
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The pure formats of the AnkiDroid-compatible provider: column order, field separator, tags, lazy rows. */
class FlashcardsContractTest {

    @Test
    fun projectionKeepsTheCallersOrder() {
        // The Hanja app reads models/# with arrayOf("css") and then getString(0): column 0 must be css.
        val cols = FlashcardsContract.project(arrayOf("css"), FlashcardsContract.Model.COLUMNS, FlashcardsContract.Model.DEFAULT)
        assertArrayEquals(arrayOf("css"), cols)
        val two = FlashcardsContract.project(arrayOf("flds", "_id"), FlashcardsContract.Note.COLUMNS, FlashcardsContract.Note.DEFAULT)
        assertArrayEquals(arrayOf("flds", "_id"), two)
    }

    @Test
    fun noProjectionGivesTheDefault() {
        val cols = FlashcardsContract.project(null, FlashcardsContract.Deck.COLUMNS, FlashcardsContract.Deck.DEFAULT)
        assertEquals(listOf("deck_id", "deck_name", "deck_desc", "deck_dyn"), cols.toList())
    }

    @Test(expected = IllegalArgumentException::class)
    fun unknownColumnIsRefused() {
        FlashcardsContract.project(arrayOf("question"), FlashcardsContract.Card.COLUMNS, FlashcardsContract.Card.DEFAULT)
    }

    @Test
    fun columnNamesMatchAnkiDroid() {
        // FlashCardsContract names the Hanja app uses (AnkiBridge.kt), letter for letter.
        assertTrue(FlashcardsContract.Model.COLUMNS.containsAll(listOf("_id", "name", "css", "field_names")))
        assertTrue(FlashcardsContract.CardTemplate.COLUMNS.containsAll(
            listOf("ord", "card_template_name", "question_format", "answer_format")))
        assertTrue(FlashcardsContract.Note.COLUMNS.containsAll(listOf("_id", "flds", "tags", "mid")))
        assertTrue(FlashcardsContract.Card.COLUMNS.containsAll(listOf("ord", "card_name", "deck_id")))
        assertTrue(FlashcardsContract.Deck.COLUMNS.containsAll(listOf("deck_id", "deck_name")))
        assertEquals("note_id", FlashcardsContract.ReviewInfo.NOTE_ID)
        assertEquals("suspended", FlashcardsContract.ReviewInfo.SUSPEND)
    }

    @Test
    fun fieldsUseUnitSeparator() {
        val joined = FlashcardsContract.joinFields(listOf("勉強", "べんきょう", "공부"))
        assertEquals("勉強\u001fべんきょう\u001f공부", joined)
        assertEquals(listOf("勉強", "べんきょう", "공부"), FlashcardsContract.splitFields(joined))
        assertEquals(listOf(""), FlashcardsContract.splitFields(""))
        assertEquals(listOf("a", "", ""), FlashcardsContract.splitFields("a\u001f\u001f"))
    }

    @Test
    fun fieldsAreFittedToTheNoteType() {
        assertEquals(listOf("a", "", ""), FlashcardsContract.fitFields(listOf("a"), 3))
        assertEquals(listOf("a", "b c"), FlashcardsContract.fitFields(listOf("a", "b", "c"), 2))
        assertEquals(listOf("a", "b"), FlashcardsContract.fitFields(listOf("a", "b"), 2))
    }

    @Test
    fun tagsAreSpaceSeparated() {
        assertEquals(listOf("한자바로보기", "자주까먹는단어"), FlashcardsContract.parseTags(" 한자바로보기  자주까먹는단어 "))
        assertEquals(emptyList<String>(), FlashcardsContract.parseTags(null))
        assertEquals("a b", FlashcardsContract.formatTags(listOf("a", "b")))
        assertEquals("", FlashcardsContract.formatTags(emptyList()))
    }

    @Test
    fun tableLoadsOnlyTheRowsRead() {
        val loaded = mutableListOf<Int>()
        val t = ProviderTable(arrayOf("_id", "flds"), 20_000) { i, _ ->
            loaded += i
            arrayOf(i.toLong(), "row $i")
        }
        assertEquals(20_000, t.count)
        assertEquals("row 3", t.value(3, 1))
        assertEquals(3L, t.value(3, 0))
        assertEquals(listOf(3), loaded)
    }
}
