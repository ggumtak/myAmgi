package com.ggumtak.myamgi.engine

import android.content.Context
import anki.card_rendering.RenderCardResponse
import anki.cards.Card
import anki.collection.OpChanges
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
import anki.sync.SyncAuth
import anki.sync.SyncCollectionResponse
import anki.sync.SyncLoginRequest
import net.ankiweb.rsdroid.Backend
import net.ankiweb.rsdroid.BackendFactory
import java.io.File
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
     * Loads `librsdroid.so` before any [Backend] is created.
     *
     * anki-backend-android 0.1.77 ships no Android loader class and `NativeMethods` has no static
     * initializer, so without this every `NativeMethods.openBackend` call fails with
     * UnsatisfiedLinkError. Safe to call repeatedly and from any thread (Application, provider,
     * activities). On a plain JVM (unit tests) the library is loaded by
     * `net.ankiweb.rsdroid.testing.RustBackendLoader` and `System.loadLibrary` would fail, so it is
     * skipped there.
     */
    fun ensureNativeLoaded() {
        if (nativeLoaded) return
        synchronized(nativeLock) {
            if (nativeLoaded) return
            if (isAndroidRuntime()) {
                System.loadLibrary("rsdroid")
            }
            nativeLoaded = true
        }
    }

    private fun isAndroidRuntime(): Boolean =
        System.getProperty("java.vm.name").orEmpty().contains("Dalvik", ignoreCase = true) ||
            System.getProperty("java.vendor").orEmpty().contains("Android", ignoreCase = true)

    fun initDirectory(context: Context) {
        synchronized(lock) {
            val dir = File(context.applicationContext.filesDir, "anki_collection")
            if (!dir.exists()) dir.mkdirs()
            collectionDir = dir
        }
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
        collectionDir ?: throw IllegalStateException("AnkiEngine.initDirectory() not called")
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
        val colFile = getCollectionFile()
        val mediaFolder = getMediaDir()
        // Must match the media DB name Backend.openCollection() derives (collection.anki2 -> collection.media.db)
        val mediaDb = File(getCollectionDir(), "collection.media.db")
        b.importCollectionPackage(
            colFile.absolutePath,
            colpkgPath,
            mediaFolder.absolutePath,
            mediaDb.absolutePath
        )
        b.openCollection(colFile.absolutePath)
        collectionOpened = true
    }

    fun exportApkg(outPath: String, deckId: Long? = null, includeScheduling: Boolean = true): Int = withBackend { b ->
        val opts = ExportAnkiPackageOptions.newBuilder()
            .setWithScheduling(includeScheduling)
            .setWithDeckConfigs(true)
            .setWithMedia(true)
            .setLegacy(false)
            .build()
        val limit = if (deckId != null && deckId > 0) {
            ExportLimit.newBuilder().setDeckId(deckId).build()
        } else {
            ExportLimit.newBuilder().setWholeCollection(Empty.getDefaultInstance()).build()
        }
        b.exportAnkiPackage(outPath, opts, limit)
    }

    fun exportColpkg(outPath: String, includeMedia: Boolean = true) = withBackend { b ->
        b.exportCollectionPackage(outPath, includeMedia, false)
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

    fun ankiWebFullSync(auth: SyncAuth, upload: Boolean) = synchronized(lock) {
        val b = ensureOpen()
        val colFile = getCollectionFile()
        val req = FullUploadOrDownloadRequest.newBuilder()
            .setAuth(auth)
            .setUpload(upload)
            .setServerUsn(0)
            .build()
        b.fullUploadOrDownload(req)
        closeCollectionOnlyLocked()
        b.openCollection(colFile.absolutePath)
        collectionOpened = true
    }

    fun ankiWebSyncMedia(auth: SyncAuth) = withBackend { b ->
        b.syncMedia(auth)
    }

    // --- Official SvelteKit /_anki/<method> Raw Protobuf Dispatch ---

    fun rawCall(methodName: String, body: ByteArray): ByteArray = withBackend { b ->
        val rawName = "${methodName}Raw"
        val method = rawMethodCache.computeIfAbsent(rawName) { name ->
            b.javaClass.getMethod(name, ByteArray::class.java)
        }
        method.invoke(b, body) as ByteArray
    }
}
