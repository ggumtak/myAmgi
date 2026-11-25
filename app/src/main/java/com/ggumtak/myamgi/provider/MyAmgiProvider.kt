package com.ggumtak.myamgi.provider

import android.content.ContentProvider
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.UriMatcher
import android.database.Cursor
import android.database.MatrixCursor
import android.net.Uri
import android.os.Bundle
import android.os.ParcelFileDescriptor
import com.ggumtak.myamgi.engine.AnkiEngine
import java.io.FileNotFoundException
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors

/**
 * Pure JVM-testable in-memory chunked transfer session store for bypassing Android's 1MB Binder IPC limit.
 */
class ChunkSessionStore(
    private val readTarget: (notetypeId: Long, target: String, ord: Int) -> String,
    private val writeTarget: (notetypeId: Long, target: String, ord: Int, content: String) -> Unit
) {
    data class Session(
        val id: String,
        val notetypeId: Long,
        val target: String,
        val ord: Int,
        val buffer: StringBuilder = StringBuilder()
    )

    data class ReadChunkResult(
        val chunk: String,
        val totalLength: Int,
        val eof: Boolean
    )

    private val sessions = ConcurrentHashMap<String, Session>()

    fun beginSession(notetypeId: Long, target: String, ord: Int): String {
        val normalizedTarget = normalizeTarget(target)
        val sessionId = UUID.randomUUID().toString()
        sessions[sessionId] = Session(
            id = sessionId,
            notetypeId = notetypeId,
            target = normalizedTarget,
            ord = ord
        )
        return sessionId
    }

    fun appendChunk(sessionId: String, chunk: String): Int {
        val session = sessions[sessionId]
            ?: throw IllegalArgumentException("Unknown chunk session: $sessionId")
        synchronized(session.buffer) {
            session.buffer.append(chunk)
            return session.buffer.length
        }
    }

    fun commitSession(sessionId: String): Int {
        val session = sessions.remove(sessionId)
            ?: throw IllegalArgumentException("Unknown chunk session: $sessionId")
        val fullText = synchronized(session.buffer) { session.buffer.toString() }
        writeTarget(session.notetypeId, session.target, session.ord, fullText)
        return fullText.length
    }

    fun readChunk(
        notetypeId: Long,
        target: String,
        ord: Int,
        offset: Int,
        length: Int
    ): ReadChunkResult {
        val normalizedTarget = normalizeTarget(target)
        val fullText = readTarget(notetypeId, normalizedTarget, ord)
        val total = fullText.length
        val safeOffset = offset.coerceIn(0, total)
        val safeLength = length.coerceAtLeast(0)
        val end = (safeOffset.toLong() + safeLength.toLong()).coerceAtMost(total.toLong()).toInt()
        val chunk = if (safeOffset < end) fullText.substring(safeOffset, end) else ""
        return ReadChunkResult(
            chunk = chunk,
            totalLength = total,
            eof = end >= total
        )
    }

    fun clear() {
        sessions.clear()
    }

    private fun normalizeTarget(target: String): String {
        val normalized = target.trim().lowercase()
        require(normalized == "css" || normalized == "qfmt" || normalized == "afmt") {
            "Unsupported target '$target' (expected css, qfmt, or afmt)"
        }
        return normalized
    }
}

/**
 * AnkiDroid `FlashCardsContract`-compatible ContentProvider with unlimited-size Pipe (`openFile`)
 * and Chunked Session (`call`) APIs that bypass Android's 1MB Binder IPC transaction limit.
 */
class MyAmgiProvider : ContentProvider() {

    companion object {
        private const val FIELD_SEPARATOR = "\u001f"

        private const val MATCH_MODELS = 1
        private const val MATCH_MODEL_ID = 2
        private const val MATCH_MODEL_TEMPLATES = 3
        private const val MATCH_MODEL_TEMPLATE_ID = 4
        private const val MATCH_NOTES = 5
        private const val MATCH_NOTE_CARDS = 6
        private const val MATCH_NOTE_CARD_ID = 7
        private const val MATCH_DECKS = 8
        private const val MATCH_SCHEDULE = 9
        private const val MATCH_MODEL_CSS_FILE = 10
        private const val MATCH_TEMPLATE_QFMT_FILE = 11
        private const val MATCH_TEMPLATE_AFMT_FILE = 12

        const val METHOD_GET_CAPABILITIES = "get_capabilities"
        const val METHOD_BEGIN_CHUNK_SESSION = "begin_chunk_session"
        const val METHOD_APPEND_CHUNK = "append_chunk"
        const val METHOD_COMMIT_CHUNK_SESSION = "commit_chunk_session"
        const val METHOD_READ_CHUNK = "read_chunk"
    }

    private val ioExecutor = Executors.newCachedThreadPool()

    @Volatile
    private var authority: String = ""

    @Volatile
    private var uriMatcher: UriMatcher? = null

    private val sessionStore = ChunkSessionStore(
        readTarget = { notetypeId, target, ord ->
            readNotetypeTargetText(notetypeId, target, ord)
        },
        writeTarget = { notetypeId, target, ord, content ->
            writeNotetypeTargetText(notetypeId, target, ord, content)
        }
    )

    override fun onCreate(): Boolean {
        val ctx = context ?: return false
        AnkiEngine.initDirectory(ctx)
        authority = "${ctx.packageName}.flashcards"
        uriMatcher = buildUriMatcher(authority)
        return true
    }

    private fun buildUriMatcher(auth: String): UriMatcher {
        return UriMatcher(UriMatcher.NO_MATCH).apply {
            addURI(auth, "models", MATCH_MODELS)
            addURI(auth, "models/#", MATCH_MODEL_ID)
            addURI(auth, "models/#/css", MATCH_MODEL_CSS_FILE)
            addURI(auth, "models/#/templates", MATCH_MODEL_TEMPLATES)
            addURI(auth, "models/#/templates/#", MATCH_MODEL_TEMPLATE_ID)
            addURI(auth, "models/#/templates/#/qfmt", MATCH_TEMPLATE_QFMT_FILE)
            addURI(auth, "models/#/templates/#/afmt", MATCH_TEMPLATE_AFMT_FILE)
            addURI(auth, "notes", MATCH_NOTES)
            addURI(auth, "notes/#/cards", MATCH_NOTE_CARDS)
            addURI(auth, "notes/#/cards/#", MATCH_NOTE_CARD_ID)
            addURI(auth, "decks", MATCH_DECKS)
            addURI(auth, "schedule", MATCH_SCHEDULE)
        }
    }

    private fun ensureMatcher(): UriMatcher {
        uriMatcher?.let { return it }
        val ctx: Context = context ?: throw IllegalStateException("Provider context unavailable")
        val auth = "${ctx.packageName}.flashcards"
        authority = auth
        return buildUriMatcher(auth).also { uriMatcher = it }
    }

    override fun getType(uri: Uri): String? {
        return when (ensureMatcher().match(uri)) {
            MATCH_MODELS -> "vnd.android.cursor.dir/vnd.$authority.models"
            MATCH_MODEL_ID -> "vnd.android.cursor.item/vnd.$authority.models"
            MATCH_MODEL_TEMPLATES -> "vnd.android.cursor.dir/vnd.$authority.templates"
            MATCH_MODEL_TEMPLATE_ID -> "vnd.android.cursor.item/vnd.$authority.templates"
            MATCH_NOTES -> "vnd.android.cursor.dir/vnd.$authority.notes"
            MATCH_NOTE_CARDS -> "vnd.android.cursor.dir/vnd.$authority.cards"
            MATCH_NOTE_CARD_ID -> "vnd.android.cursor.item/vnd.$authority.cards"
            MATCH_DECKS -> "vnd.android.cursor.dir/vnd.$authority.decks"
            MATCH_SCHEDULE -> "vnd.android.cursor.item/vnd.$authority.schedule"
            MATCH_MODEL_CSS_FILE -> "text/css"
            MATCH_TEMPLATE_QFMT_FILE, MATCH_TEMPLATE_AFMT_FILE -> "text/html"
            else -> null
        }
    }

    override fun query(
        uri: Uri,
        projection: Array<out String>?,
        selection: String?,
        selectionArgs: Array<out String>?,
        sortOrder: String?
    ): Cursor {
        return when (ensureMatcher().match(uri)) {
            MATCH_MODELS -> queryModels()
            MATCH_MODEL_ID -> queryModelById(parseLongSegment(uri, 1))
            MATCH_MODEL_TEMPLATES -> queryModelTemplates(parseLongSegment(uri, 1))
            MATCH_MODEL_TEMPLATE_ID -> queryModelTemplate(
                notetypeId = parseLongSegment(uri, 1),
                ord = parseIntSegment(uri, 3)
            )
            MATCH_NOTES -> queryNotes(selection)
            MATCH_NOTE_CARDS -> queryNoteCards(parseLongSegment(uri, 1))
            MATCH_DECKS -> queryDecks()
            else -> throw IllegalArgumentException("Unsupported query URI: $uri")
        }
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? {
        val cv = values ?: ContentValues()
        return when (ensureMatcher().match(uri)) {
            MATCH_NOTES -> {
                val mid = cv.getAsLong("mid")
                    ?: throw IllegalArgumentException("Missing 'mid' for note insert")
                val did = cv.getAsLong("did") ?: 1L
                val rawFields = cv.getAsString("flds") ?: ""
                val fields = if (rawFields.isEmpty()) listOf("") else rawFields.split(FIELD_SEPARATOR)
                val rawTags = cv.getAsString("tags") ?: ""
                val tags = rawTags.trim().split(Regex("\\s+")).filter { it.isNotBlank() }
                val noteId = AnkiEngine.addNote(mid, did, fields, tags)
                ContentUris.withAppendedId(uri, noteId)
            }
            MATCH_DECKS -> {
                val deckName = cv.getAsString("deck_name")?.trim()
                    ?.takeIf { it.isNotEmpty() }
                    ?: throw IllegalArgumentException("Missing 'deck_name' for deck insert")
                val deckId = AnkiEngine.createDeck(deckName)
                ContentUris.withAppendedId(uri, deckId)
            }
            else -> throw IllegalArgumentException("Unsupported insert URI: $uri")
        }
    }

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?
    ): Int {
        val cv = values ?: return 0
        return when (ensureMatcher().match(uri)) {
            MATCH_MODEL_ID -> {
                val notetypeId = parseLongSegment(uri, 1)
                val css = cv.getAsString("css") ?: return 0
                AnkiEngine.updateNotetypeCss(notetypeId, css)
                1
            }
            MATCH_MODEL_TEMPLATE_ID -> {
                val notetypeId = parseLongSegment(uri, 1)
                val ord = parseIntSegment(uri, 3)
                val qfmt = if (cv.containsKey("question_format")) cv.getAsString("question_format") else null
                val afmt = if (cv.containsKey("answer_format")) cv.getAsString("answer_format") else null
                val templateName = if (cv.containsKey("card_template_name")) cv.getAsString("card_template_name") else null

                if (qfmt != null || afmt != null) {
                    AnkiEngine.updateNotetypeTemplate(notetypeId, ord, qfmt, afmt)
                }
                if (templateName != null) {
                    updateTemplateName(notetypeId, ord, templateName)
                }
                if (qfmt != null || afmt != null || templateName != null) 1 else 0
            }
            MATCH_NOTE_CARD_ID -> {
                val noteId = parseLongSegment(uri, 1)
                val ord = parseIntSegment(uri, 3)
                val deckId = cv.getAsLong("deck_id")
                    ?: throw IllegalArgumentException("Missing 'deck_id' for card update")
                val matchingCardIds = findNoteCardIdsByOrd(noteId, ord)
                if (matchingCardIds.isEmpty()) 0 else {
                    AnkiEngine.moveCardsToDeck(matchingCardIds, deckId)
                    matchingCardIds.size
                }
            }
            MATCH_SCHEDULE -> {
                val noteId = cv.getAsLong("note_id")
                    ?: throw IllegalArgumentException("Missing 'note_id' for schedule update")
                val ord = cv.getAsInteger("ord")
                val suspended = cv.getAsInteger("suspended") ?: 0
                val cardIds = if (ord != null) {
                    findNoteCardIdsByOrd(noteId, ord)
                } else {
                    AnkiEngine.cardsOfNote(noteId)
                }
                if (cardIds.isEmpty()) {
                    0
                } else {
                    if (suspended != 0) {
                        AnkiEngine.suspendCards(cardIds)
                    }
                    cardIds.size
                }
            }
            else -> throw IllegalArgumentException("Unsupported update URI: $uri")
        }
    }

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int {
        return 0
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        val (notetypeId, target, ord) = when (ensureMatcher().match(uri)) {
            MATCH_MODEL_CSS_FILE -> Triple(parseLongSegment(uri, 1), "css", 0)
            MATCH_TEMPLATE_QFMT_FILE -> Triple(parseLongSegment(uri, 1), "qfmt", parseIntSegment(uri, 3))
            MATCH_TEMPLATE_AFMT_FILE -> Triple(parseLongSegment(uri, 1), "afmt", parseIntSegment(uri, 3))
            else -> throw FileNotFoundException("Unsupported pipe URI: $uri")
        }

        val normalizedMode = mode.lowercase()
        val pipe = ParcelFileDescriptor.createPipe()
        val readEnd = pipe[0]
        val writeEnd = pipe[1]

        return when {
            normalizedMode.startsWith("r") -> {
                ioExecutor.execute {
                    try {
                        val content = readNotetypeTargetText(notetypeId, target, ord)
                        ParcelFileDescriptor.AutoCloseOutputStream(writeEnd).use { out ->
                            out.write(content.toByteArray(Charsets.UTF_8))
                            out.flush()
                        }
                    } catch (_: Throwable) {
                        runCatching { writeEnd.close() }
                    }
                }
                readEnd
            }
            normalizedMode.startsWith("w") -> {
                ioExecutor.execute {
                    try {
                        val text = ParcelFileDescriptor.AutoCloseInputStream(readEnd).use { input ->
                            input.readBytes().toString(Charsets.UTF_8)
                        }
                        writeNotetypeTargetText(notetypeId, target, ord, text)
                    } catch (_: Throwable) {
                        runCatching { readEnd.close() }
                    }
                }
                writeEnd
            }
            else -> {
                runCatching { readEnd.close() }
                runCatching { writeEnd.close() }
                throw FileNotFoundException("Unsupported mode '$mode' for $uri")
            }
        }
    }

    override fun call(method: String, arg: String?, extras: Bundle?): Bundle {
        return when (method) {
            METHOD_GET_CAPABILITIES -> Bundle().apply {
                putBoolean("unlimited_pipe", true)
                putBoolean("chunked_session", true)
                putInt("max_chars", -1)
            }
            METHOD_BEGIN_CHUNK_SESSION -> {
                val b = extras ?: throw IllegalArgumentException("Missing extras for $method")
                val notetypeId = b.getLong("notetype_id", -1L)
                require(notetypeId > 0) { "Invalid notetype_id" }
                val target = b.getString("target")
                    ?: throw IllegalArgumentException("Missing target")
                val ord = b.getInt("ord", 0)
                val sessionId = sessionStore.beginSession(notetypeId, target, ord)
                Bundle().apply {
                    putString("session_id", sessionId)
                }
            }
            METHOD_APPEND_CHUNK -> {
                val b = extras ?: throw IllegalArgumentException("Missing extras for $method")
                val sessionId = b.getString("session_id")
                    ?: throw IllegalArgumentException("Missing session_id")
                val chunk = b.getString("chunk") ?: ""
                val bufferedChars = sessionStore.appendChunk(sessionId, chunk)
                Bundle().apply {
                    putInt("buffered_chars", bufferedChars)
                }
            }
            METHOD_COMMIT_CHUNK_SESSION -> {
                val b = extras ?: throw IllegalArgumentException("Missing extras for $method")
                val sessionId = b.getString("session_id")
                    ?: throw IllegalArgumentException("Missing session_id")
                val charsWritten = sessionStore.commitSession(sessionId)
                Bundle().apply {
                    putInt("chars_written", charsWritten)
                }
            }
            METHOD_READ_CHUNK -> {
                val b = extras ?: throw IllegalArgumentException("Missing extras for $method")
                val notetypeId = b.getLong("notetype_id", -1L)
                require(notetypeId > 0) { "Invalid notetype_id" }
                val target = b.getString("target")
                    ?: throw IllegalArgumentException("Missing target")
                val ord = b.getInt("ord", 0)
                val offset = b.getInt("offset", 0)
                val length = b.getInt("length", 256 * 1024)
                val result = sessionStore.readChunk(notetypeId, target, ord, offset, length)
                Bundle().apply {
                    putString("chunk", result.chunk)
                    putInt("total_length", result.totalLength)
                    putBoolean("eof", result.eof)
                }
            }
            else -> throw IllegalArgumentException("Unknown provider method: $method")
        }
    }

    // --- Query Helpers ---

    private fun queryModels(): Cursor {
        val cursor = MatrixCursor(arrayOf("_id", "name"))
        for (item in AnkiEngine.getNotetypeNames()) {
            cursor.addRow(arrayOf<Any>(item.id, item.name))
        }
        return cursor
    }

    private fun queryModelById(notetypeId: Long): Cursor {
        val cursor = MatrixCursor(arrayOf("_id", "name", "field_names", "css"))
        val nt = AnkiEngine.getNotetype(notetypeId)
        val fieldNames = nt.fieldsList.joinToString(FIELD_SEPARATOR) { it.name }
        cursor.addRow(arrayOf<Any>(nt.id, nt.name, fieldNames, nt.config.css))
        return cursor
    }

    private fun queryModelTemplates(notetypeId: Long): Cursor {
        val cursor = MatrixCursor(
            arrayOf("ord", "card_template_name", "question_format", "answer_format")
        )
        val nt = AnkiEngine.getNotetype(notetypeId)
        nt.templatesList.forEachIndexed { idx, tmpl ->
            val ord = if (tmpl.hasOrd()) tmpl.ord.`val` else idx
            cursor.addRow(
                arrayOf<Any>(
                    ord,
                    tmpl.name,
                    tmpl.config.qFormat,
                    tmpl.config.aFormat
                )
            )
        }
        return cursor
    }

    private fun queryModelTemplate(notetypeId: Long, ord: Int): Cursor {
        val cursor = MatrixCursor(
            arrayOf("question_format", "answer_format", "card_template_name")
        )
        val nt = AnkiEngine.getNotetype(notetypeId)
        val tmpl = nt.templatesList.getOrNull(ord)
            ?: throw IndexOutOfBoundsException("Template ord $ord out of range for model $notetypeId")
        cursor.addRow(
            arrayOf<Any>(
                tmpl.config.qFormat,
                tmpl.config.aFormat,
                tmpl.name
            )
        )
        return cursor
    }

    private fun queryNotes(selection: String?): Cursor {
        val cursor = MatrixCursor(arrayOf("_id", "flds", "tags"))
        val query = selection?.takeIf { it.isNotBlank() } ?: ""
        val noteIds = AnkiEngine.searchNotes(query)
        for (noteId in noteIds) {
            val note = AnkiEngine.getNote(noteId)
            val flds = note.fieldsList.joinToString(FIELD_SEPARATOR)
            val tags = note.tagsList.joinToString(" ")
            cursor.addRow(arrayOf<Any>(note.id, flds, tags))
        }
        return cursor
    }

    private fun queryNoteCards(noteId: Long): Cursor {
        val cursor = MatrixCursor(arrayOf("ord", "card_name"))
        val note = AnkiEngine.getNote(noteId)
        val nt = AnkiEngine.getNotetype(note.notetypeId)
        val cardIds = AnkiEngine.cardsOfNote(noteId)
        for (cardId in cardIds) {
            val card = AnkiEngine.getCard(cardId)
            val ord = card.templateIdx
            val cardName = nt.templatesList.getOrNull(ord)?.name ?: "Card ${ord + 1}"
            cursor.addRow(arrayOf<Any>(ord, cardName))
        }
        return cursor
    }

    private fun queryDecks(): Cursor {
        val cursor = MatrixCursor(arrayOf("deck_id", "deck_name"))
        for (deck in AnkiEngine.getDeckNames()) {
            cursor.addRow(arrayOf<Any>(deck.id, deck.name))
        }
        return cursor
    }

    // --- Backend Target Helpers ---

    private fun readNotetypeTargetText(notetypeId: Long, target: String, ord: Int): String {
        val nt = AnkiEngine.getNotetype(notetypeId)
        return when (target) {
            "css" -> nt.config.css
            "qfmt" -> {
                val tmpl = nt.templatesList.getOrNull(ord)
                    ?: throw IndexOutOfBoundsException("Template ord $ord out of range")
                tmpl.config.qFormat
            }
            "afmt" -> {
                val tmpl = nt.templatesList.getOrNull(ord)
                    ?: throw IndexOutOfBoundsException("Template ord $ord out of range")
                tmpl.config.aFormat
            }
            else -> throw IllegalArgumentException("Unknown target: $target")
        }
    }

    private fun writeNotetypeTargetText(notetypeId: Long, target: String, ord: Int, content: String) {
        when (target) {
            "css" -> AnkiEngine.updateNotetypeCss(notetypeId, content)
            "qfmt" -> AnkiEngine.updateNotetypeTemplate(notetypeId, ord, questionFormat = content)
            "afmt" -> AnkiEngine.updateNotetypeTemplate(notetypeId, ord, answerFormat = content)
            else -> throw IllegalArgumentException("Unknown target: $target")
        }
    }

    private fun updateTemplateName(notetypeId: Long, ord: Int, newName: String) {
        AnkiEngine.withBackend { b ->
            val nt = b.getNotetype(notetypeId)
            val templates = nt.templatesList.toMutableList()
            if (ord !in templates.indices) {
                throw IndexOutOfBoundsException("Template ord $ord out of range")
            }
            val old = templates[ord]
            templates[ord] = old.toBuilder().setName(newName).build()
            val updated = nt.toBuilder().clearTemplates().addAllTemplates(templates).build()
            b.updateNotetype(updated)
        }
    }

    private fun findNoteCardIdsByOrd(noteId: Long, ord: Int): List<Long> {
        return AnkiEngine.cardsOfNote(noteId).filter { cardId ->
            AnkiEngine.getCard(cardId).templateIdx == ord
        }
    }

    private fun parseLongSegment(uri: Uri, index: Int): Long {
        val seg = uri.pathSegments.getOrNull(index)
            ?: throw IllegalArgumentException("Missing path segment $index in $uri")
        return seg.toLongOrNull()
            ?: throw IllegalArgumentException("Invalid Long segment '$seg' in $uri")
    }

    private fun parseIntSegment(uri: Uri, index: Int): Int {
        val seg = uri.pathSegments.getOrNull(index)
            ?: throw IllegalArgumentException("Missing path segment $index in $uri")
        return seg.toIntOrNull()
            ?: throw IllegalArgumentException("Invalid Int segment '$seg' in $uri")
    }
}
