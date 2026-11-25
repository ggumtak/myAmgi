package com.ggumtak.myamgi.provider

import anki.generic.Empty
import anki.notetypes.Notetype
import anki.scheduler.BuryOrSuspendCardsRequest
import anki.search.SortOrder
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.provider.FlashcardsContract.Card
import com.ggumtak.myamgi.provider.FlashcardsContract.CardTemplate
import com.ggumtak.myamgi.provider.FlashcardsContract.Deck
import com.ggumtak.myamgi.provider.FlashcardsContract.Model
import com.ggumtak.myamgi.provider.FlashcardsContract.Note
import com.ggumtak.myamgi.provider.FlashcardsContract.ReviewInfo

/**
 * What [MyAmgiProvider] does for each `FlashCardsContract` operation, on the official Anki engine and without
 * Android classes, so the whole contract runs in JVM tests against the real Rust backend ([AnkiEngine] after
 * `setCollectionDir`). `ContentValues` arrive as a plain map.
 *
 * Every call goes through [AnkiEngine.withBackend], which opens the collection on first use: the provider can be
 * called before the Application has warmed the engine, from any binder thread. A read-modify-write of a note type
 * runs inside one `withBackend` block so two callers cannot interleave.
 */
object FlashcardsOps {
    private val NO_ORDER: SortOrder = SortOrder.newBuilder().setNone(Empty.getDefaultInstance()).build()

    // --- Note types ---

    fun models(projection: Array<out String>?): ProviderTable {
        val cols = FlashcardsContract.project(projection, Model.COLUMNS, Model.DEFAULT)
        val names = AnkiEngine.getNotetypeNames()
        return ProviderTable(cols, names.size) { i, c ->
            val id = names[i].id
            if (c.all { it == Model.ID || it == Model.NAME }) {
                Array(c.size) { if (c[it] == Model.ID) id else names[i].name }
            } else {
                modelRow(AnkiEngine.getNotetype(id), c)
            }
        }
    }

    fun model(id: Long, projection: Array<out String>?): ProviderTable {
        val cols = FlashcardsContract.project(projection, Model.COLUMNS, Model.DEFAULT)
        val nt = notetypeOrNull(id) ?: return ProviderTable(cols, 0) { _, _ -> emptyArray() }
        return ProviderTable(cols, 1) { _, c -> modelRow(nt, c) }
    }

    private fun modelRow(nt: Notetype, cols: Array<String>): Array<Any?> = Array(cols.size) {
        when (cols[it]) {
            Model.ID -> nt.id
            Model.NAME -> nt.name
            Model.FIELD_NAMES -> FlashcardsContract.joinFields(nt.fieldsList.map { f -> f.name })
            Model.NUM_CARDS -> nt.templatesCount
            Model.CSS -> nt.config.css
            Model.DECK_ID -> AnkiEngine.withBackend { b -> b.defaultDeckForNotetype(nt.id) }
            Model.SORT_FIELD_INDEX -> nt.config.sortFieldIdx
            Model.TYPE -> nt.config.kindValue
            Model.LATEX_POST -> nt.config.latexPost
            Model.LATEX_PRE -> nt.config.latexPre
            Model.NOTE_COUNT -> AnkiEngine.searchNotes("mid:${nt.id}").size
            else -> null
        }
    }

    fun templates(modelId: Long, projection: Array<out String>?): ProviderTable {
        val cols = FlashcardsContract.project(projection, CardTemplate.COLUMNS, CardTemplate.DEFAULT)
        val nt = notetypeOrNull(modelId) ?: return ProviderTable(cols, 0) { _, _ -> emptyArray() }
        return ProviderTable(cols, nt.templatesCount) { i, c -> templateRow(nt, i, c) }
    }

    fun template(modelId: Long, ord: Int, projection: Array<out String>?): ProviderTable {
        val cols = FlashcardsContract.project(projection, CardTemplate.COLUMNS, CardTemplate.DEFAULT)
        val nt = notetypeOrNull(modelId)
        if (nt == null || ord !in 0 until nt.templatesCount) return ProviderTable(cols, 0) { _, _ -> emptyArray() }
        return ProviderTable(cols, 1) { _, c -> templateRow(nt, ord, c) }
    }

    private fun templateRow(nt: Notetype, index: Int, cols: Array<String>): Array<Any?> {
        val t = nt.getTemplates(index)
        val ord = if (t.hasOrd()) t.ord.`val` else index
        return Array(cols.size) {
            when (cols[it]) {
                CardTemplate.ID -> ord.toLong()
                CardTemplate.MODEL_ID -> nt.id
                CardTemplate.ORD -> ord
                CardTemplate.NAME -> t.name
                CardTemplate.QUESTION_FORMAT -> t.config.qFormat
                CardTemplate.ANSWER_FORMAT -> t.config.aFormat
                CardTemplate.BROWSER_QUESTION_FORMAT -> t.config.qFormatBrowser
                CardTemplate.BROWSER_ANSWER_FORMAT -> t.config.aFormatBrowser
                else -> null
            }
        }
    }

    /** `css` and `name`; the number of note types changed (0 or 1). */
    fun updateModel(id: Long, values: Map<String, Any?>): Int {
        val css = values.string(Model.CSS)
        val name = values.string(Model.NAME)?.trim()?.takeIf { it.isNotEmpty() }
        if (css == null && name == null) return 0
        return AnkiEngine.withBackend { b ->
            val nt = runCatching { b.getNotetype(id) }.getOrNull() ?: return@withBackend 0
            val builder = nt.toBuilder()
            if (css != null) builder.config = nt.config.toBuilder().setCss(css).build()
            if (name != null) builder.name = name
            b.updateNotetype(builder.build())
            1
        }
    }

    /**
     * Any of `question_format`, `answer_format`, `card_template_name`, `browser_question_format`,
     * `browser_answer_format` for card type [ord], in one note type update; 1 when written, 0 when there was
     * nothing to write or no such card type. Templates of any size: no Binder limit applies inside the app, only
     * to the call that carries them (see [MyAmgiProvider.call] for templates larger than about 500,000 characters).
     */
    fun updateTemplate(modelId: Long, ord: Int, values: Map<String, Any?>): Int {
        val q = values.string(CardTemplate.QUESTION_FORMAT)
        val a = values.string(CardTemplate.ANSWER_FORMAT)
        val name = values.string(CardTemplate.NAME)?.trim()?.takeIf { it.isNotEmpty() }
        val bq = values.string(CardTemplate.BROWSER_QUESTION_FORMAT)
        val ba = values.string(CardTemplate.BROWSER_ANSWER_FORMAT)
        if (listOf(q, a, name, bq, ba).all { it == null }) return 0
        return AnkiEngine.withBackend { b ->
            val nt = runCatching { b.getNotetype(modelId) }.getOrNull() ?: return@withBackend 0
            if (ord !in 0 until nt.templatesCount) return@withBackend 0
            val old = nt.getTemplates(ord)
            val cfg = old.config.toBuilder()
            q?.let { cfg.qFormat = it }
            a?.let { cfg.aFormat = it }
            bq?.let { cfg.qFormatBrowser = it }
            ba?.let { cfg.aFormatBrowser = it }
            val t = old.toBuilder().setConfig(cfg.build())
            name?.let { t.name = it }
            b.updateNotetype(nt.toBuilder().setTemplates(ord, t.build()).build())
            1
        }
    }

    /** One side of a note type ("css", "qfmt", "afmt"), for the pipe and chunk APIs. */
    fun readTarget(modelId: Long, target: String, ord: Int): String {
        val nt = AnkiEngine.getNotetype(modelId)
        if (target == "css") return nt.config.css
        require(ord in 0 until nt.templatesCount) { "Template ord $ord out of range" }
        return when (target) {
            "qfmt" -> nt.getTemplates(ord).config.qFormat
            "afmt" -> nt.getTemplates(ord).config.aFormat
            else -> throw IllegalArgumentException("Unknown target: $target")
        }
    }

    fun writeTarget(modelId: Long, target: String, ord: Int, content: String) {
        val written = when (target) {
            "css" -> updateModel(modelId, mapOf(Model.CSS to content))
            "qfmt" -> updateTemplate(modelId, ord, mapOf(CardTemplate.QUESTION_FORMAT to content))
            "afmt" -> updateTemplate(modelId, ord, mapOf(CardTemplate.ANSWER_FORMAT to content))
            else -> throw IllegalArgumentException("Unknown target: $target")
        }
        require(written == 1) { "Note type $modelId has no $target for ord $ord" }
    }

    private fun notetypeOrNull(id: Long): Notetype? = runCatching { AnkiEngine.getNotetype(id) }.getOrNull()

    // --- Notes ---

    /** Notes an Anki search finds ([search] null or blank: every note), in the order the engine finds them. */
    fun notes(search: String?, projection: Array<out String>?): ProviderTable {
        val cols = FlashcardsContract.project(projection, Note.COLUMNS, Note.DEFAULT)
        val ids = AnkiEngine.withBackend { b -> b.searchNotes(search?.trim().orEmpty(), NO_ORDER) }
        return noteTable(ids, cols)
    }

    fun note(id: Long, projection: Array<out String>?): ProviderTable {
        val cols = FlashcardsContract.project(projection, Note.COLUMNS, Note.DEFAULT)
        val exists = runCatching { AnkiEngine.getNote(id) }.isSuccess
        return noteTable(if (exists) listOf(id) else emptyList(), cols)
    }

    private fun noteTable(ids: List<Long>, cols: Array<String>): ProviderTable {
        val idOnly = cols.all { it in Note.ID_ONLY }
        return ProviderTable(cols, ids.size) { i, c ->
            val id = ids[i]
            if (idOnly) return@ProviderTable Array(c.size) { id }
            // A note removed after the search (myAmgi's own editor, a sync) reads as empty, never as an error
            // thrown into the caller's cursor.
            val n = runCatching { AnkiEngine.getNote(id) }.getOrNull()
            Array(c.size) {
                when (c[it]) {
                    Note.ID -> id
                    Note.GUID -> n?.guid ?: ""
                    Note.MID -> n?.notetypeId ?: 0L
                    Note.MOD -> n?.mtimeSecs?.toLong() ?: 0L
                    Note.USN -> n?.usn ?: 0
                    Note.TAGS -> FlashcardsContract.formatTags(n?.tagsList.orEmpty())
                    Note.FLDS -> FlashcardsContract.joinFields(n?.fieldsList.orEmpty())
                    else -> null
                }
            }
        }
    }

    /**
     * Adds a note of type `mid` with `flds` and `tags`; its cards go to `deck_id`/`did` when given (a myAmgi
     * addition), else to the note type's default deck, as in AnkiDroid. Returns the note id.
     */
    fun insertNote(values: Map<String, Any?>): Long {
        val mid = values.long(Note.MID) ?: throw IllegalArgumentException("Missing 'mid' for note insert")
        val fields = FlashcardsContract.splitFields(values.string(Note.FLDS).orEmpty())
        val tags = FlashcardsContract.parseTags(values.string(Note.TAGS))
        val asked = values.long(Card.DECK_ID) ?: values.long("did")
        return AnkiEngine.withBackend { b ->
            val nt = b.getNotetype(mid)
            val deck = asked?.takeIf { it > 0 }
                ?: runCatching { b.defaultDeckForNotetype(mid) }.getOrDefault(0L).takeIf { it > 0 }
                ?: 1L
            AnkiEngine.addNote(mid, deck, FlashcardsContract.fitFields(fields, nt.fieldsCount), tags)
        }
    }

    /** `flds` and/or `tags` of note [id]; 1 when changed. */
    fun updateNote(id: Long, values: Map<String, Any?>): Int {
        val flds = values.string(Note.FLDS)
        val tags = values.string(Note.TAGS)
        if (flds == null && tags == null) return 0
        return AnkiEngine.withBackend { b ->
            val n = runCatching { b.getNote(id) }.getOrNull() ?: return@withBackend 0
            val count = b.getNotetype(n.notetypeId).fieldsCount
            val fields = flds?.let { FlashcardsContract.fitFields(FlashcardsContract.splitFields(it), count) } ?: n.fieldsList
            AnkiEngine.updateNote(id, fields, tags?.let { FlashcardsContract.parseTags(it) } ?: n.tagsList)
            1
        }
    }

    // --- Cards ---

    private class CardInfo(val id: Long, val ord: Int, val deckId: Long)

    private fun cardsOf(noteId: Long): List<CardInfo> = AnkiEngine.withBackend { b ->
        runCatching { b.cardsOfNote(noteId) }.getOrDefault(emptyList())
            .map { b.getCard(it) }
            .map { CardInfo(it.id, it.templateIdx, it.deckId) }
            .sortedBy { it.ord }
    }

    fun noteCards(noteId: Long, projection: Array<out String>?): ProviderTable =
        cardTable(noteId, null, projection)

    fun noteCard(noteId: Long, ord: Int, projection: Array<out String>?): ProviderTable =
        cardTable(noteId, ord, projection)

    private fun cardTable(noteId: Long, ord: Int?, projection: Array<out String>?): ProviderTable {
        val cols = FlashcardsContract.project(projection, Card.COLUMNS, Card.DEFAULT)
        val cards = cardsOf(noteId).filter { ord == null || it.ord == ord }
        val names = if (cards.isEmpty()) emptyList() else AnkiEngine.withBackend { b ->
            b.getNotetype(b.getNote(noteId).notetypeId).templatesList.map { it.name }
        }
        return ProviderTable(cols, cards.size) { i, c ->
            val card = cards[i]
            Array(c.size) {
                when (c[it]) {
                    Card.NOTE_ID -> noteId
                    Card.ORD -> card.ord
                    // A cloze note's cards share the one template: its name, as in Anki's browser.
                    Card.CARD_NAME -> names.getOrNull(card.ord) ?: names.firstOrNull() ?: "Card ${card.ord + 1}"
                    Card.DECK_ID -> card.deckId
                    else -> null
                }
            }
        }
    }

    /** `deck_id` moves the note's card [ord]; the number of cards moved. */
    fun updateCard(noteId: Long, ord: Int, values: Map<String, Any?>): Int {
        val deckId = values.long(Card.DECK_ID) ?: return 0
        val ids = cardsOf(noteId).filter { it.ord == ord }.map { it.id }
        if (ids.isEmpty()) return 0
        AnkiEngine.moveCardsToDeck(ids, deckId)
        return ids.size
    }

    /**
     * AnkiDroid's `schedule` update, without answering: `suspended`=1 suspends and `buried`=1 buries the note's
     * card `ord` (every card of the note when `ord` is absent). The number of cards changed.
     */
    fun updateSchedule(values: Map<String, Any?>): Int {
        val noteId = values.long(ReviewInfo.NOTE_ID) ?: throw IllegalArgumentException("Missing 'note_id'")
        val ord = values.long(ReviewInfo.ORD)?.toInt()
        val suspend = values.long(ReviewInfo.SUSPEND) == 1L
        val bury = values.long(ReviewInfo.BURY) == 1L
        if (!suspend && !bury) return 0
        val ids = cardsOf(noteId).filter { ord == null || it.ord == ord }.map { it.id }
        if (ids.isEmpty()) return 0
        val mode = if (suspend) BuryOrSuspendCardsRequest.Mode.SUSPEND else BuryOrSuspendCardsRequest.Mode.BURY_USER
        AnkiEngine.withBackend { b -> b.buryOrSuspendCards(ids, emptyList(), mode) }
        return ids.size
    }

    // --- Decks ---

    fun decks(projection: Array<out String>?): ProviderTable {
        val cols = FlashcardsContract.project(projection, Deck.COLUMNS, Deck.DEFAULT)
        val decks = AnkiEngine.getDeckNames()
        val cheap = cols.all { it == Deck.ID || it == Deck.NAME }
        return ProviderTable(cols, decks.size) { i, c ->
            val d = decks[i]
            val full = if (cheap) null else runCatching { AnkiEngine.withBackend { b -> b.getDeck(d.id) } }.getOrNull()
            Array(c.size) {
                when (c[it]) {
                    Deck.ID -> d.id
                    Deck.NAME -> d.name
                    Deck.DESCRIPTION -> full?.takeIf { f -> f.hasNormal() }?.normal?.description ?: ""
                    Deck.DYN -> if (full?.hasFiltered() == true) 1 else 0
                    else -> null
                }
            }
        }
    }

    /**
     * The id of deck [name] ("A::B::C"), created with its parents when missing. An existing deck is returned as it
     * is: the engine would otherwise make a second one named "name+".
     */
    fun insertDeck(name: String): Long {
        val clean = normalizeDeckName(name)
        require(clean.isNotEmpty()) { "Missing 'deck_name' for deck insert" }
        return AnkiEngine.withBackend {
            findDeck(clean) ?: AnkiEngine.createDeck(clean)
        }
    }

    fun findDeck(name: String): Long? {
        val clean = normalizeDeckName(name)
        return AnkiEngine.getDeckNames().firstOrNull { normalizeDeckName(it.name).equals(clean, ignoreCase = true) }?.id
    }

    /** "A :: B" and "A::B" are the same deck, as in Anki. */
    fun normalizeDeckName(name: String): String =
        name.split("::").map { it.trim() }.filter { it.isNotEmpty() }.joinToString("::")

    // --- ContentValues as a map ---

    private fun Map<String, Any?>.string(key: String): String? = if (containsKey(key)) this[key]?.toString() else null

    private fun Map<String, Any?>.long(key: String): Long? = when (val v = this[key]) {
        null -> null
        is Number -> v.toLong()
        is Boolean -> if (v) 1L else 0L
        else -> v.toString().trim().toLongOrNull()
    }
}
