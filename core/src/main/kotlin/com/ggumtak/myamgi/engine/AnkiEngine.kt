package com.ggumtak.myamgi.engine

import anki.card_rendering.RenderCardResponse
import anki.cards.Card
import anki.collection.OpChanges
import anki.collection.Progress
import anki.deck_config.DeckConfig
import anki.deck_config.DeckConfigsForUpdate
import anki.deck_config.UpdateDeckConfigsMode
import anki.decks.Deck
import anki.decks.DeckNameId
import anki.decks.DeckTreeNode
import anki.decks.SetDeckCollapsedRequest
import anki.generic.Empty
import anki.import_export.CsvMetadata
import anki.import_export.CsvMetadataRequest
import anki.import_export.ExportAnkiPackageOptions
import anki.import_export.ExportLimit
import anki.import_export.ImportAnkiPackageOptions
import anki.import_export.ImportAnkiPackageUpdateCondition
import anki.import_export.ImportResponse
import anki.notes.Note
import anki.notetypes.Notetype
import anki.notetypes.NotetypeNameId
import anki.scheduler.BuryOrSuspendCardsRequest
import anki.scheduler.CardAnswer
import anki.scheduler.QueuedCards
import anki.scheduler.SchedulingStates
import anki.search.SortOrder
import anki.sync.FullUploadOrDownloadRequest
import anki.sync.MediaSyncStatusResponse
import anki.sync.SyncAuth
import anki.sync.SyncCollectionResponse
import anki.sync.SyncLoginRequest
import anki.sync.SyncStatusResponse
import net.ankiweb.rsdroid.Backend
import net.ankiweb.rsdroid.BackendFactory
import java.io.File
import java.lang.reflect.InvocationTargetException
import java.lang.reflect.Method
import java.util.concurrent.ConcurrentHashMap

/**
 * Thread-safe singleton wrapper around official Anki 26.09.4 Rust backend.
 *
 * IMPORTANT: `Backend.isOpen()` only checks if the Rust backend handle is alive,
 * NOT whether a collection is currently opened. We therefore track [collectionOpened]
 * explicitly alongside [backend].
 */
object AnkiEngine {
    private val lock = Any()

    @Volatile
    private var backend: Backend? = null

    @Volatile
    private var collectionOpened: Boolean = false

    @Volatile
    private var collectionDir: File? = null

    private val rawMethodCache = ConcurrentHashMap<String, Method>()

    private val nativeLock = Any()

    @Volatile
    private var nativeLoaded: Boolean = false

    /**
     * Loads the native backend library. Must be set by the shell before the first engine call:
     * Android sets `{ System.loadLibrary("rsdroid") }`, desktop and JVM tests set
     * `{ net.ankiweb.rsdroid.testing.RustBackendLoader.ensureSetup() }`.
     *
     * anki-backend 0.1.77 has no static initializer in `NativeMethods`, so the library has to be
     * loaded before any [Backend] is created; [ensureNativeLoaded] runs this exactly once (until it succeeds)
     * and [getOrCreateBackendLocked] always calls it first.
     */
    @Volatile
    var nativeLoader: () -> Unit = {
        throw IllegalStateException("AnkiEngine.nativeLoader is not set (the shell must load the native backend)")
    }

    /** Runs [nativeLoader] once. Safe to call repeatedly and from any thread. */
    fun ensureNativeLoaded() {
        if (nativeLoaded) return
        synchronized(nativeLock) {
            if (nativeLoaded) return
            nativeLoader()
            nativeLoaded = true
        }
    }

    /**
     * Android compatibility shim: `context` is an `android.content.Context`. Resolved reflectively so this
     * module stays free of Android APIs; the collection lives in `<filesDir>/anki_collection` as before.
     * New code should call [setCollectionDir].
     */
    fun initDirectory(context: Any) {
        val app = runCatching { context.javaClass.getMethod("getApplicationContext").invoke(context) }.getOrNull()
            ?: context
        val filesDir = app.javaClass.getMethod("getFilesDir").invoke(app) as File
        setCollectionDir(File(filesDir, "anki_collection"))
    }

    /** For JVM unit tests or custom storage roots. */
    fun setCollectionDir(dir: File) {
        synchronized(lock) {
            if (collectionDir?.absolutePath != dir.absolutePath) {
                closeCollectionOnlyLocked()
                if (!dir.exists()) dir.mkdirs()
                collectionDir = dir
            }
        }
    }

    fun getCollectionDir(): File = synchronized(lock) {
        collectionDir ?: throw IllegalStateException("AnkiEngine collection directory not set (call setCollectionDir)")
    }

    fun getCollectionFile(): File = File(getCollectionDir(), "collection.anki2")

    fun getMediaDir(): File = File(getCollectionDir(), "collection.media").apply {
        if (!exists()) mkdirs()
    }

    fun isCollectionOpen(): Boolean = collectionOpened && backend?.isOpen() == true

    private fun getOrCreateBackendLocked(): Backend {
        val current = backend
        if (current != null && current.isOpen()) return current
        ensureNativeLoaded()
        val created = BackendFactory.getBackend(listOf("ko", "en"))
        backend = created
        collectionOpened = false
        return created
    }

    fun ensureOpen(): Backend = synchronized(lock) {
        val b = getOrCreateBackendLocked()
        if (!collectionOpened) {
            val colFile = getCollectionFile()
            colFile.parentFile?.mkdirs()
            getMediaDir()
            b.openCollection(colFile.absolutePath)
            collectionOpened = true
        }
        b
    }

    private fun closeCollectionOnlyLocked() {
        val b = backend
        if (b != null && b.isOpen() && collectionOpened) {
            runCatching { b.closeCollection(false) }
        }
        collectionOpened = false
    }

    fun closeCollection() = synchronized(lock) {
        closeCollectionOnlyLocked()
    }

    fun closeAll() = synchronized(lock) {
        closeCollectionOnlyLocked()
        runCatching { backend?.close() }
        backend = null
    }

    fun <T> withBackend(block: (Backend) -> T): T = synchronized(lock) {
        block(ensureOpen())
    }

    // --- Decks ---

    // A zero timestamp makes the backend skip due-count calculation (all counts 0), so pass "now" in seconds.
    fun deckTree(): DeckTreeNode = withBackend { it.deckTree(System.currentTimeMillis() / 1000L) }

    fun getDeckNames(): List<DeckNameId> = withBackend { it.getDeckNames(false, true) }

    fun createDeck(name: String): Long = withBackend { b ->
        val deck = Deck.newBuilder()
            .setName(name.trim())
            .setCommon(Deck.Common.getDefaultInstance())
            .setNormal(Deck.Normal.newBuilder().setConfigId(1L).build())
            .build()
        b.addDeck(deck).id
    }

    fun renameDeck(deckId: Long, newName: String) = withBackend { b ->
        b.renameDeck(deckId, newName.trim())
    }

    fun deleteDeck(deckId: Long) = withBackend { b ->
        b.removeDecks(listOf(deckId))
    }

    fun setDeckCollapsed(deckId: Long, collapsed: Boolean) = withBackend { b ->
        b.setDeckCollapsed(deckId, collapsed, SetDeckCollapsedRequest.Scope.REVIEWER)
    }

    fun setCurrentDeck(deckId: Long) = withBackend { b ->
        b.setCurrentDeck(deckId)
    }

    // --- Study & Scheduling ---

    fun getQueuedCards(fetchLimit: Int = 5): QueuedCards = withBackend { b ->
        b.getQueuedCards(fetchLimit, false)
    }

    fun describeNextStates(states: SchedulingStates): List<String> = withBackend { b ->
        b.describeNextStates(states)
    }

    fun answerCard(
        cardId: Long,
        states: SchedulingStates,
        rating: CardAnswer.Rating,
        millisecondsTaken: Int
    ): OpChanges = withBackend { b ->
        val newState = when (rating) {
            CardAnswer.Rating.AGAIN -> states.again
            CardAnswer.Rating.HARD -> states.hard
            CardAnswer.Rating.GOOD -> states.good
            CardAnswer.Rating.EASY -> states.easy
            else -> states.good
        }
        val answer = CardAnswer.newBuilder()
            .setCardId(cardId)
            .setCurrentState(states.current)
            .setNewState(newState)
            .setRating(rating)
            .setAnsweredAtMillis(System.currentTimeMillis())
            .setMillisecondsTaken(millisecondsTaken.coerceIn(100, 60_000))
            .build()
        b.answerCard(answer)
    }

    fun renderExistingCard(cardId: Long, browser: Boolean = false): RenderCardResponse = withBackend { b ->
        b.renderExistingCard(cardId, browser, false)
    }

    fun getCard(cardId: Long): Card = withBackend { it.getCard(cardId) }

    fun getNote(noteId: Long): Note = withBackend { it.getNote(noteId) }

    fun cardsOfNote(noteId: Long): List<Long> = withBackend { it.cardsOfNote(noteId) }

    fun suspendCards(cardIds: List<Long>) = withBackend { b ->
        b.buryOrSuspendCards(cardIds, emptyList(), BuryOrSuspendCardsRequest.Mode.SUSPEND)
    }

    fun buryCards(cardIds: List<Long>) = withBackend { b ->
        b.buryOrSuspendCards(cardIds, emptyList(), BuryOrSuspendCardsRequest.Mode.BURY_USER)
    }

    fun undo(): Boolean = withBackend { b ->
        runCatching { b.undo() }.isSuccess
    }

    fun redo(): Boolean = withBackend { b ->
        runCatching { b.redo() }.isSuccess
    }

    // --- Notes & Search ---

    fun addNote(notetypeId: Long, deckId: Long, fields: List<String>, tags: List<String>): Long = withBackend { b ->
        val note = b.newNote(notetypeId).toBuilder()
            .clearFields()
            .addAllFields(fields)
            .clearTags()
            .addAllTags(tags.filter { it.isNotBlank() })
            .build()
        b.addNote(note, deckId).noteId
    }

    fun updateNote(noteId: Long, fields: List<String>, tags: List<String>) = withBackend { b ->
        val existing = b.getNote(noteId)
        val updated = existing.toBuilder()
            .clearFields()
            .addAllFields(fields)
            .clearTags()
            .addAllTags(tags.filter { it.isNotBlank() })
            .build()
        b.updateNotes(listOf(updated), false)
    }

    fun removeNotes(noteIds: List<Long>) = withBackend { b ->
        b.removeNotes(noteIds, emptyList())
    }

    fun searchNotes(query: String): List<Long> = withBackend { b ->
        b.searchNotes(query, SortOrder.newBuilder().setNone(Empty.getDefaultInstance()).build())
    }

    fun searchCards(query: String): List<Long> = withBackend { b ->
        b.searchCards(query, SortOrder.newBuilder().setNone(Empty.getDefaultInstance()).build())
    }

    fun moveCardsToDeck(cardIds: List<Long>, deckId: Long) = withBackend { b ->
        b.setDeck(cardIds, deckId)
    }

    // --- Notetypes & Unlimited Templates/CSS ---

    fun getNotetypeNames(): List<NotetypeNameId> = withBackend { it.getNotetypeNames() }

    fun getNotetype(notetypeId: Long): Notetype = withBackend { it.getNotetype(notetypeId) }

    fun updateNotetype(notetype: Notetype): OpChanges = withBackend { it.updateNotetype(notetype) }

    fun updateNotetypeCss(notetypeId: Long, css: String): OpChanges = withBackend { b ->
        val nt = b.getNotetype(notetypeId)
        val updated = nt.toBuilder()
            .setConfig(nt.config.toBuilder().setCss(css).build())
            .build()
        b.updateNotetype(updated)
    }

    fun updateNotetypeTemplate(
        notetypeId: Long,
        ord: Int,
        questionFormat: String? = null,
        answerFormat: String? = null
    ): OpChanges = withBackend { b ->
        val nt = b.getNotetype(notetypeId)
        val templates = nt.templatesList.toMutableList()
        if (ord !in templates.indices) throw IndexOutOfBoundsException("Template ord $ord out of range")
        val old = templates[ord]
        val cfgBuilder = old.config.toBuilder()
        if (questionFormat != null) cfgBuilder.setQFormat(questionFormat)
        if (answerFormat != null) cfgBuilder.setAFormat(answerFormat)
        templates[ord] = old.toBuilder().setConfig(cfgBuilder.build()).build()
        val updated = nt.toBuilder().clearTemplates().addAllTemplates(templates).build()
        b.updateNotetype(updated)
    }

    // --- Deck Options & FSRS ---

    fun getDeckConfigsForUpdate(deckId: Long): DeckConfigsForUpdate = withBackend { b ->
        b.getDeckConfigsForUpdate(deckId)
    }

    fun updateSimpleDeckOptions(
        deckId: Long,
        newPerDay: Int,
        reviewsPerDay: Int,
        learnSteps: List<Float>,
        relearnSteps: List<Float>,
        desiredRetention: Float,
        fsrsEnabled: Boolean
    ) = withBackend { b ->
        val state = b.getDeckConfigsForUpdate(deckId)
        val targetConfigId = state.currentDeck.configId
        val updatedConfigs = state.allConfigList.map { cwe ->
            val dc = cwe.config
            if (dc.id == targetConfigId) {
                val cfg = dc.config.toBuilder()
                    .setNewPerDay(newPerDay.coerceIn(0, 9999))
                    .setReviewsPerDay(reviewsPerDay.coerceIn(0, 9999))
                    .clearLearnSteps().addAllLearnSteps(learnSteps)
                    .clearRelearnSteps().addAllRelearnSteps(relearnSteps)
                    .setDesiredRetention(desiredRetention.coerceIn(0.70f, 0.99f))
                    .build()
                dc.toBuilder().setConfig(cfg).build()
            } else {
                dc
            }
        }
        b.updateDeckConfigs(
            deckId,
            updatedConfigs,
            emptyList(),
            UpdateDeckConfigsMode.UPDATE_DECK_CONFIGS_MODE_NORMAL,
            state.cardStateCustomizer,
            state.currentDeck.limits,
            state.newCardsIgnoreReviewLimit,
            fsrsEnabled,
            state.applyAllParentLimits,
            false,
            state.fsrsHealthCheck
        )
    }

    fun isFsrsEnabled(deckId: Long = 1L): Boolean = withBackend { b ->
        b.getDeckConfigsForUpdate(deckId).fsrs
    }

    // --- Import / Export ---

    fun importApkg(path: String): ImportResponse = withBackend { b ->
        val options = ImportAnkiPackageOptions.newBuilder()
            .setMergeNotetypes(true)
            .setUpdateNotes(ImportAnkiPackageUpdateCondition.IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_IF_NEWER)
            .setUpdateNotetypes(ImportAnkiPackageUpdateCondition.IMPORT_ANKI_PACKAGE_UPDATE_CONDITION_IF_NEWER)
            .setWithScheduling(true)
            .setWithDeckConfigs(true)
            .build()
        b.importAnkiPackage(path, options)
    }

    fun importColpkg(colpkgPath: String) = synchronized(lock) {
        val b = getOrCreateBackendLocked()
        closeCollectionOnlyLocked()
        collectionOpened = false
        val colFile = getCollectionFile()
        val mediaFolder = getMediaDir()
        // Must match the media DB name Backend.openCollection() derives (collection.anki2 -> collection.media.db)
        val mediaDb = File(getCollectionDir(), "collection.media.db")
        try {
            b.importCollectionPackage(
                colFile.absolutePath,
                colpkgPath,
                mediaFolder.absolutePath,
                mediaDb.absolutePath
            )
        } finally {
            // Reopen whatever is on disk now (the imported collection, or the untouched old one on failure)
            b.openCollection(colFile.absolutePath)
            collectionOpened = true
        }
    }

    fun exportApkg(
        outPath: String,
        deckId: Long? = null,
        includeScheduling: Boolean = true,
        includeMedia: Boolean = true,
        legacy: Boolean = false
    ): Int = withBackend { b ->
        val opts = ExportAnkiPackageOptions.newBuilder()
            .setWithScheduling(includeScheduling)
            .setWithDeckConfigs(true)
            .setWithMedia(includeMedia)
            .setLegacy(legacy)
            .build()
        val limit = if (deckId != null && deckId > 0) {
            ExportLimit.newBuilder().setDeckId(deckId).build()
        } else {
            ExportLimit.newBuilder().setWholeCollection(Empty.getDefaultInstance()).build()
        }
        b.exportAnkiPackage(outPath, opts, limit)
    }

    /**
     * Exports the whole collection as `.colpkg`. The backend closes the collection while exporting,
     * so it is reopened afterwards (also on failure).
     */
    fun exportColpkg(outPath: String, includeMedia: Boolean = true, legacy: Boolean = false) = synchronized(lock) {
        val b = ensureOpen()
        try {
            b.exportCollectionPackage(outPath, includeMedia, legacy)
        } finally {
            collectionOpened = false
            runCatching { b.closeCollection(false) }
            b.openCollection(getCollectionFile().absolutePath)
            collectionOpened = true
        }
    }

    /**
     * Writes a `.colpkg` backup (without media, like Anki's automatic backups) into [backupDir].
     * Anki also thins old backups in that folder by its daily/weekly/monthly limits.
     * Returns false if the backend decided no backup was needed.
     */
    fun createBackup(backupDir: File, force: Boolean = true): Boolean = withBackend { b ->
        backupDir.mkdirs()
        b.createBackup(backupDir.absolutePath, force, true)
    }

    fun importCsvUtf8(utf8Path: String, deckId: Long, notetypeId: Long): ImportResponse = withBackend { b ->
        val req = CsvMetadataRequest.newBuilder()
            .setPath(utf8Path)
            .setDeckId(deckId)
            .setNotetypeId(notetypeId)
            .setIsHtml(false)
            .build()
        val metadata: CsvMetadata = b.getCsvMetadata(req)
        b.importCsv(utf8Path, metadata)
    }

    // --- AnkiWeb Sync ---

    fun ankiWebLogin(username: String, password: String, endpoint: String = ""): SyncAuth = withBackend { b ->
        val req = SyncLoginRequest.newBuilder()
            .setUsername(username)
            .setPassword(password)
            .apply { if (endpoint.isNotBlank()) setEndpoint(endpoint) }
            .build()
        b.syncLogin(req)
    }

    fun ankiWebSyncCollection(auth: SyncAuth): SyncCollectionResponse = withBackend { b ->
        b.syncCollection(auth, false)
    }

    /**
     * Full upload or download. [serverMediaUsn] is the `server_media_usn` from the preceding
     * normal sync, when there was one (lets the backend skip a needless media sync check).
     */
    fun ankiWebFullSync(auth: SyncAuth, upload: Boolean, serverMediaUsn: Int? = null) = synchronized(lock) {
        val b = ensureOpen()
        val colFile = getCollectionFile()
        val req = FullUploadOrDownloadRequest.newBuilder()
            .setAuth(auth)
            .setUpload(upload)
            .apply { if (serverMediaUsn != null) setServerUsn(serverMediaUsn) }
            .build()
        try {
            b.fullUploadOrDownload(req)
        } finally {
            closeCollectionOnlyLocked()
            b.openCollection(colFile.absolutePath)
            collectionOpened = true
        }
    }

    fun ankiWebSyncStatus(auth: SyncAuth): SyncStatusResponse = withBackend { it.syncStatus(auth) }

    /** Starts media sync; the backend runs it in the background (poll [mediaSyncStatus]). */
    fun ankiWebSyncMedia(auth: SyncAuth) = withBackend { b ->
        b.syncMedia(auth)
    }

    // --- Lock-free calls: progress and abort must work while a long operation holds the engine lock ---

    private fun liveBackend(): Backend? = backend?.takeIf { it.isOpen() }

    /** Latest backend progress, or null if no backend exists yet. Never blocks on the engine lock. */
    fun latestProgress(): Progress? = liveBackend()?.let { b -> runCatching { b.latestProgress() }.getOrNull() }

    fun mediaSyncStatus(): MediaSyncStatusResponse? =
        liveBackend()?.let { b -> runCatching { b.mediaSyncStatus() }.getOrNull() }

    /** Asks a running collection sync, media sync and any abortable operation to stop. */
    fun abortAll() {
        val b = liveBackend() ?: return
        runCatching { b.abortSync() }
        runCatching { b.abortMediaSync() }
        runCatching { b.setWantsAbort() }
    }

    // --- Official SvelteKit /_anki/<method> Raw Protobuf Dispatch ---

    /** Backend methods that only read progress or request an abort; they bypass the engine lock. */
    private val LOCK_FREE_METHODS = setOf("latestProgress", "setWantsAbort", "abortSync", "abortMediaSync", "mediaSyncStatus")

    private val METHOD_NAME = Regex("^[a-z][A-Za-z0-9]{0,80}$")

    /**
     * Calls backend method `<methodName>Raw(byte[])` with a serialized request and returns the serialized
     * response. Throws [NoSuchMethodException] for unknown names and the backend's own exception
     * (unwrapped from reflection) on failure.
     */
    fun rawCall(methodName: String, body: ByteArray): ByteArray {
        if (!METHOD_NAME.matches(methodName)) throw NoSuchMethodException(methodName)
        if (methodName in LOCK_FREE_METHODS) {
            val live = liveBackend()
            if (live != null) return invokeRaw(live, methodName, body)
        }
        return withBackend { b -> invokeRaw(b, methodName, body) }
    }

    private fun invokeRaw(b: Backend, methodName: String, body: ByteArray): ByteArray {
        val rawName = "${methodName}Raw"
        val method = rawMethodCache.computeIfAbsent(rawName) { name ->
            b.javaClass.getMethod(name, ByteArray::class.java)
        }
        try {
            return method.invoke(b, body) as ByteArray
        } catch (e: InvocationTargetException) {
            throw e.targetException ?: e
        }
    }
}
