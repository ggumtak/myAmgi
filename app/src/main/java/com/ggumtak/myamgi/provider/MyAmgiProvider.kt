package com.ggumtak.myamgi.provider

import android.content.ContentProvider
import android.content.ContentUris
import android.content.ContentValues
import android.content.Context
import android.content.UriMatcher
import android.content.pm.PackageManager
import android.content.pm.ProviderInfo
import android.database.AbstractCursor
import android.database.Cursor
import android.net.Uri
import android.os.Bundle
import android.os.ParcelFileDescriptor
import com.ggumtak.myamgi.engine.AnkiEngine
import java.io.FileNotFoundException
import java.util.concurrent.Executors

/**
 * AnkiDroid `FlashCardsContract`-compatible ContentProvider (see [FlashcardsContract] for every path, column and
 * key), at `content://<applicationId>.flashcards` behind `<applicationId>.permission.READ_WRITE_DATABASE`:
 * - pro:   `content://com.ggumtak.myamgi.flashcards`,       `com.ggumtak.myamgi.permission.READ_WRITE_DATABASE`
 * - comet: `content://com.ggumtak.myamgi.comet.flashcards`, `com.ggumtak.myamgi.comet.permission.READ_WRITE_DATABASE`
 *
 * Unlike AnkiDroid, texts of any size can be read and written:
 * - **Chunk sessions through [call]** (recommended): `begin_chunk_session` {notetype_id: Long, target: "css" |
 *   "qfmt" | "afmt", ord: Int} → {session_id}; `append_chunk` {session_id, chunk: String ≤ 200,000 chars} →
 *   {buffered_chars}; `commit_chunk_session` {session_id} → {chars_written} writes it in one note type update;
 *   `abort_chunk_session` {session_id}. `read_chunk` {notetype_id, target, ord, offset, length} →
 *   {chunk, total_length, eof}. `get_capabilities` → {unlimited_pipe, chunked_session, max_chars = -1}.
 *   [call] is checked against the same permission as queries (Android does not check it for a provider).
 * - **Pipes through openFile**: `models/#/css`, `models/#/templates/#/qfmt`, `.../afmt`, mode "r" or "w" (UTF-8).
 *
 * The provider may be called before the Application has warmed the engine and from any binder thread: every
 * operation goes through [AnkiEngine.withBackend], which opens the collection on first use under one lock.
 */
class MyAmgiProvider : ContentProvider() {

    companion object {
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
        private const val MATCH_NOTE_ID = 13

        const val METHOD_GET_CAPABILITIES = "get_capabilities"
        const val METHOD_BEGIN_CHUNK_SESSION = "begin_chunk_session"
        const val METHOD_APPEND_CHUNK = "append_chunk"
        const val METHOD_COMMIT_CHUNK_SESSION = "commit_chunk_session"
        const val METHOD_ABORT_CHUNK_SESSION = "abort_chunk_session"
        const val METHOD_READ_CHUNK = "read_chunk"

        fun permissionFor(packageName: String) = "$packageName.permission.READ_WRITE_DATABASE"
    }

    private val ioExecutor = Executors.newCachedThreadPool()

    @Volatile
    private var authority: String = ""

    @Volatile
    private var uriMatcher: UriMatcher? = null

    private val sessionStore = ChunkSessionStore(
        readTarget = FlashcardsOps::readTarget,
        writeTarget = FlashcardsOps::writeTarget,
    )

    /** The authority the manifest really gave this provider (per flavor), not one rebuilt from the package. */
    override fun attachInfo(context: Context?, info: ProviderInfo?) {
        info?.authority?.split(';')?.firstOrNull()?.takeIf { it.isNotBlank() }?.let { authority = it }
        super.attachInfo(context, info)
    }

    override fun onCreate(): Boolean {
        val ctx = context ?: return false
        // Cheap: only sets the folder. The collection opens on the first call (withBackend), on that caller's thread.
        AnkiEngine.initDirectory(ctx)
        ensureMatcher()
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
            addURI(auth, "notes/#", MATCH_NOTE_ID)
            addURI(auth, "notes/#/cards", MATCH_NOTE_CARDS)
            addURI(auth, "notes/#/cards/#", MATCH_NOTE_CARD_ID)
            addURI(auth, "decks", MATCH_DECKS)
            addURI(auth, "schedule", MATCH_SCHEDULE)
        }
    }

    private fun ensureMatcher(): UriMatcher {
        uriMatcher?.let { return it }
        if (authority.isEmpty()) {
            val ctx: Context = context ?: throw IllegalStateException("Provider context unavailable")
            authority = "${ctx.packageName}.flashcards"
        }
        return buildUriMatcher(authority).also { uriMatcher = it }
    }

    override fun getType(uri: Uri): String? {
        return when (ensureMatcher().match(uri)) {
            MATCH_MODELS -> "vnd.android.cursor.dir/vnd.$authority.models"
            MATCH_MODEL_ID -> "vnd.android.cursor.item/vnd.$authority.models"
            MATCH_MODEL_TEMPLATES -> "vnd.android.cursor.dir/vnd.$authority.templates"
            MATCH_MODEL_TEMPLATE_ID -> "vnd.android.cursor.item/vnd.$authority.templates"
            MATCH_NOTES -> "vnd.android.cursor.dir/vnd.$authority.notes"
            MATCH_NOTE_ID -> "vnd.android.cursor.item/vnd.$authority.notes"
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
    ): Cursor = parcelable {
        val table = when (ensureMatcher().match(uri)) {
            MATCH_MODELS -> FlashcardsOps.models(projection)
            MATCH_MODEL_ID -> FlashcardsOps.model(longAt(uri, 1), projection)
            MATCH_MODEL_TEMPLATES -> FlashcardsOps.templates(longAt(uri, 1), projection)
            MATCH_MODEL_TEMPLATE_ID -> FlashcardsOps.template(longAt(uri, 1), intAt(uri, 3), projection)
            // As in AnkiDroid: the selection is an Anki search string; selectionArgs and sortOrder are not used.
            MATCH_NOTES -> FlashcardsOps.notes(selection, projection)
            MATCH_NOTE_ID -> FlashcardsOps.note(longAt(uri, 1), projection)
            MATCH_NOTE_CARDS -> FlashcardsOps.noteCards(longAt(uri, 1), projection)
            MATCH_NOTE_CARD_ID -> FlashcardsOps.noteCard(longAt(uri, 1), intAt(uri, 3), projection)
            MATCH_DECKS -> FlashcardsOps.decks(projection)
            else -> throw IllegalArgumentException("Unsupported query URI: $uri")
        }
        TableCursor(table)
    }

    override fun insert(uri: Uri, values: ContentValues?): Uri? = parcelable {
        val cv = values.asMap()
        val result = when (ensureMatcher().match(uri)) {
            MATCH_NOTES -> ContentUris.withAppendedId(uri, FlashcardsOps.insertNote(cv))
            MATCH_DECKS -> {
                val name = cv[FlashcardsContract.Deck.NAME]?.toString()
                    ?: throw IllegalArgumentException("Missing 'deck_name' for deck insert")
                ContentUris.withAppendedId(uri, FlashcardsOps.insertDeck(name))
            }
            else -> throw IllegalArgumentException("Unsupported insert URI: $uri")
        }
        changed(uri)
        result
    }

    override fun update(
        uri: Uri,
        values: ContentValues?,
        selection: String?,
        selectionArgs: Array<out String>?
    ): Int = parcelable {
        val cv = values.asMap()
        val rows = when (ensureMatcher().match(uri)) {
            MATCH_MODEL_ID -> FlashcardsOps.updateModel(longAt(uri, 1), cv)
            MATCH_MODEL_TEMPLATE_ID -> FlashcardsOps.updateTemplate(longAt(uri, 1), intAt(uri, 3), cv)
            MATCH_NOTE_ID -> FlashcardsOps.updateNote(longAt(uri, 1), cv)
            MATCH_NOTE_CARD_ID -> FlashcardsOps.updateCard(longAt(uri, 1), intAt(uri, 3), cv)
            MATCH_SCHEDULE -> FlashcardsOps.updateSchedule(cv)
            else -> throw IllegalArgumentException("Unsupported update URI: $uri")
        }
        if (rows > 0) changed(uri)
        rows
    }

    override fun delete(uri: Uri, selection: String?, selectionArgs: Array<out String>?): Int {
        return 0
    }

    override fun openFile(uri: Uri, mode: String): ParcelFileDescriptor {
        val (notetypeId, target, ord) = when (ensureMatcher().match(uri)) {
            MATCH_MODEL_CSS_FILE -> Triple(longAt(uri, 1), "css", 0)
            MATCH_TEMPLATE_QFMT_FILE -> Triple(longAt(uri, 1), "qfmt", intAt(uri, 3))
            MATCH_TEMPLATE_AFMT_FILE -> Triple(longAt(uri, 1), "afmt", intAt(uri, 3))
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
                        val content = FlashcardsOps.readTarget(notetypeId, target, ord)
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
                        FlashcardsOps.writeTarget(notetypeId, target, ord, text)
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

    /**
     * Android checks a provider's read/write permission for query, insert, update and openFile, but never for
     * call(): without this check any installed app could rewrite a note type through a chunk session.
     */
    private fun enforceCallPermission() {
        val ctx = context ?: throw SecurityException("Provider context unavailable")
        val permission = permissionFor(ctx.packageName)
        if (ctx.checkCallingOrSelfPermission(permission) != PackageManager.PERMISSION_GRANTED) {
            throw SecurityException("Permission $permission required")
        }
    }

    override fun call(method: String, arg: String?, extras: Bundle?): Bundle = parcelable {
        if (method != METHOD_GET_CAPABILITIES) enforceCallPermission()
        when (method) {
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
            METHOD_ABORT_CHUNK_SESSION -> {
                val b = extras ?: throw IllegalArgumentException("Missing extras for $method")
                val sessionId = b.getString("session_id")
                    ?: throw IllegalArgumentException("Missing session_id")
                Bundle().apply { putBoolean("aborted", sessionStore.abortSession(sessionId)) }
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

    private fun changed(uri: Uri) {
        // notifyChange is only a hint for observers (none in another app needs it to work).
        runCatching { context?.contentResolver?.notifyChange(uri, null) }
    }

    private fun ContentValues?.asMap(): Map<String, Any?> =
        this?.keySet()?.associateWith { get(it) } ?: emptyMap()

    private fun longAt(uri: Uri, index: Int): Long {
        val seg = uri.pathSegments.getOrNull(index)
            ?: throw IllegalArgumentException("Missing path segment $index in $uri")
        return seg.toLongOrNull()
            ?: throw IllegalArgumentException("Invalid Long segment '$seg' in $uri")
    }

    private fun intAt(uri: Uri, index: Int): Int {
        val seg = uri.pathSegments.getOrNull(index)
            ?: throw IllegalArgumentException("Missing path segment $index in $uri")
        return seg.toIntOrNull()
            ?: throw IllegalArgumentException("Invalid Int segment '$seg' in $uri")
    }
}

/**
 * Runs [block], turning any failure into an exception Binder can carry back to the calling app.
 *
 * Android parcels only a few exception types across a provider call (IllegalArgument, IllegalState, Security,
 * UnsupportedOperation, NullPointer, FileNotFound …). Any other one — the Anki engine's BackendException, a
 * LinkageError from the native library — is rethrown inside the binder thread and ends myAmgi's process while
 * the owner studies. The caller sees an IllegalStateException with the engine's message instead.
 */
internal inline fun <T> parcelable(block: () -> T): T = try {
    block()
} catch (e: SecurityException) {
    throw e
} catch (e: IllegalArgumentException) {
    throw e
} catch (e: IllegalStateException) {
    throw e
} catch (e: UnsupportedOperationException) {
    throw e
} catch (e: FileNotFoundException) {
    throw e
} catch (e: Throwable) {
    throw IllegalStateException(e.javaClass.simpleName + ": " + (e.message ?: ""), e)
}

/**
 * A [ProviderTable] as a Cursor, in the caller's column order. Over IPC Android fills its windows through
 * [AbstractCursor.fillWindow] using [getType], so numbers travel as integers and rows load only when copied.
 */
private class TableCursor(private val table: ProviderTable) : AbstractCursor() {
    override fun getCount(): Int = table.count
    override fun getColumnNames(): Array<String> = table.columns

    private fun value(column: Int): Any? = parcelable { table.value(position, column) }

    override fun getString(column: Int): String? = value(column)?.toString()
    override fun getShort(column: Int): Short = number(column).toShort()
    override fun getInt(column: Int): Int = number(column).toInt()
    override fun getLong(column: Int): Long = number(column).toLong()
    override fun getFloat(column: Int): Float = number(column).toFloat()
    override fun getDouble(column: Int): Double = number(column).toDouble()
    override fun isNull(column: Int): Boolean = value(column) == null

    override fun getType(column: Int): Int = when (value(column)) {
        null -> Cursor.FIELD_TYPE_NULL
        is Long, is Int, is Short, is Byte -> Cursor.FIELD_TYPE_INTEGER
        is Float, is Double -> Cursor.FIELD_TYPE_FLOAT
        is ByteArray -> Cursor.FIELD_TYPE_BLOB
        else -> Cursor.FIELD_TYPE_STRING
    }

    override fun getBlob(column: Int): ByteArray? = value(column) as? ByteArray

    private fun number(column: Int): Number = when (val v = value(column)) {
        null -> 0
        is Number -> v
        is Boolean -> if (v) 1 else 0
        else -> v.toString().trim().let { it.toLongOrNull() ?: it.toDoubleOrNull() } ?: 0
    }
}
