package com.ggumtak.myamgi.provider

/**
 * The part of AnkiDroid's public `FlashCardsContract` (`com.ichi2.anki.FlashCardsContract`) that [MyAmgiProvider]
 * answers, with the same URI paths, column names, `ContentValues` keys and value formats, so an app written for
 * AnkiDroid (the owner's "한자 바로보기") only has to change the authority and the permission name.
 *
 * Pure Kotlin (no Android classes): the formats here are checked by JVM unit tests.
 *
 * Paths (relative to `content://<applicationId>.flashcards/`):
 * - `models`                        query: every note type
 * - `models/#`                      query: one note type; update: `css` (and `name`)
 * - `models/#/templates`            query: its card types
 * - `models/#/templates/#`          query: one card type (by ord); update: `question_format`, `answer_format`,
 *                                   `card_template_name`, `browser_question_format`, `browser_answer_format`
 * - `notes`                         query: `selection` is an Anki search string (`mid:123 deck:"A::B" word`);
 *                                   insert: `mid`, `flds` (fields joined by \u001f), `tags` (space separated)
 * - `notes/#`                       query: one note; update: `flds`, `tags`
 * - `notes/#/cards`                 query: the note's cards
 * - `notes/#/cards/#`               query: one card (by ord); update: `deck_id` moves it
 * - `decks`                         query: every deck (full names "A::B::C"); insert: `deck_name` (parents created,
 *                                   an existing deck's id returned instead of a "+" duplicate)
 * - `schedule`                      update: `note_id`, `ord` (optional: every card of the note), `suspended`=1,
 *                                   `buried`=1, like AnkiDroid (0 does nothing there either)
 *
 * Not implemented (the Hanja app does not use them): `media` insert, `schedule` query/answering, `selected_deck`,
 * deleting anything, card `question`/`answer` rendering columns, deck `deck_count`/`options`, note `csum`/`sfld`.
 * An unknown column in a projection is an [IllegalArgumentException], as in AnkiDroid.
 */
object FlashcardsContract {
    const val FIELD_SEPARATOR = '\u001f'

    object Model {
        const val ID = "_id"
        const val NAME = "name"
        const val FIELD_NAMES = "field_names"
        const val NUM_CARDS = "num_cards"
        const val CSS = "css"
        const val DECK_ID = "deck_id"
        const val SORT_FIELD_INDEX = "sort_field_index"
        const val TYPE = "type"
        const val LATEX_POST = "latex_post"
        const val LATEX_PRE = "latex_pre"
        const val NOTE_COUNT = "note_count"

        val COLUMNS = listOf(ID, NAME, FIELD_NAMES, NUM_CARDS, CSS, DECK_ID, SORT_FIELD_INDEX, TYPE, LATEX_POST,
            LATEX_PRE, NOTE_COUNT)

        /** AnkiDroid's default leaves out nothing cheap; note_count needs a search, so it is asked for by name. */
        val DEFAULT = COLUMNS - NOTE_COUNT
    }

    object CardTemplate {
        const val ID = "_id"
        const val MODEL_ID = "model_id"
        const val ORD = "ord"
        const val NAME = "card_template_name"
        const val QUESTION_FORMAT = "question_format"
        const val ANSWER_FORMAT = "answer_format"
        const val BROWSER_QUESTION_FORMAT = "browser_question_format"
        const val BROWSER_ANSWER_FORMAT = "browser_answer_format"

        val COLUMNS = listOf(ID, MODEL_ID, ORD, NAME, QUESTION_FORMAT, ANSWER_FORMAT, BROWSER_QUESTION_FORMAT,
            BROWSER_ANSWER_FORMAT)
        val DEFAULT = COLUMNS
    }

    object Note {
        const val ID = "_id"
        const val GUID = "guid"
        const val MID = "mid"
        const val MOD = "mod"
        const val USN = "usn"
        const val TAGS = "tags"
        const val FLDS = "flds"

        val COLUMNS = listOf(ID, GUID, MID, MOD, USN, TAGS, FLDS)
        val DEFAULT = COLUMNS

        /** Columns answered without loading the note: a count (`_id` only) stays cheap on a 20,000-note deck. */
        val ID_ONLY = setOf(ID)
    }

    object Card {
        const val NOTE_ID = "note_id"
        const val ORD = "ord"
        const val CARD_NAME = "card_name"
        const val DECK_ID = "deck_id"

        val COLUMNS = listOf(NOTE_ID, ORD, CARD_NAME, DECK_ID)
        val DEFAULT = COLUMNS
    }

    object Deck {
        const val ID = "deck_id"
        const val NAME = "deck_name"
        const val DESCRIPTION = "deck_desc"
        const val DYN = "deck_dyn"

        val COLUMNS = listOf(ID, NAME, DESCRIPTION, DYN)
        val DEFAULT = COLUMNS
    }

    object ReviewInfo {
        const val NOTE_ID = "note_id"
        const val ORD = "ord"
        const val BURY = "buried"
        const val SUSPEND = "suspended"
    }

    /**
     * The columns a query answers, in the order the caller asked for them ([requested]); [default] when the caller
     * asked for none. Callers read columns by index (`getString(0)`), so the order must be theirs.
     */
    fun project(requested: Array<out String>?, supported: List<String>, default: List<String>): Array<String> {
        if (requested == null || requested.isEmpty()) return default.toTypedArray()
        for (c in requested) require(c in supported) { "Unknown column '$c' (supported: ${supported.joinToString()})" }
        return requested.map { it }.toTypedArray()
    }

    /** AnkiDroid's `Utils.splitFields`: an empty string is one empty field. */
    fun splitFields(flds: String): List<String> = flds.split(FIELD_SEPARATOR)

    fun joinFields(fields: List<String>): String = fields.joinToString(FIELD_SEPARATOR.toString())

    /**
     * [fields] fitted to a note type with [count] fields, as AnkiDroid does when another app sends too few or too
     * many: missing ones empty, extra ones joined onto the last so nothing the caller sent is lost.
     */
    fun fitFields(fields: List<String>, count: Int): List<String> = when {
        count <= 0 -> fields
        fields.size == count -> fields
        fields.size < count -> fields + List(count - fields.size) { "" }
        else -> fields.take(count - 1) + fields.drop(count - 1).joinToString(" ")
    }

    /** Anki's tag string ("a b  c") as tags; blanks dropped, order kept, duplicates removed. */
    fun parseTags(tags: String?): List<String> =
        tags.orEmpty().trim().split(Regex("\\s+")).filter { it.isNotBlank() }.distinct()

    /** Tags for the `tags` column: space separated ("a b"); [parseTags] reads it back, so does any whitespace split. */
    fun formatTags(tags: List<String>): String = tags.filter { it.isNotBlank() }.joinToString(" ")
}
