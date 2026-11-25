package com.ggumtak.myamgi

import anki.scheduler.CardAnswer
import com.ggumtak.myamgi.engine.AnkiEngine
import net.ankiweb.rsdroid.testing.RustBackendLoader
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

/**
 * Integration tests running against the REAL official Anki 26.09.4 Rust engine on JVM.
 */
class AnkiEngineTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    @Before
    fun setUp() {
        AnkiEngine.nativeLoader = { RustBackendLoader.ensureSetup() }
        AnkiEngine.closeAll()
        AnkiEngine.setCollectionDir(tempFolder.newFolder("col"))
    }

    @After
    fun tearDown() {
        AnkiEngine.closeAll()
    }

    @Test
    fun collectionOpenedFlagTracksLifecycleAccurately() {
        assertFalse(AnkiEngine.isCollectionOpen())
        AnkiEngine.ensureOpen()
        assertTrue(AnkiEngine.isCollectionOpen())

        // Backend.isOpen() stays true after closeCollection(), so our explicit flag must report false
        AnkiEngine.closeCollection()
        assertFalse(AnkiEngine.isCollectionOpen())

        // Re-opening must succeed seamlessly without error
        AnkiEngine.ensureOpen()
        assertTrue(AnkiEngine.isCollectionOpen())
    }

    @Test
    fun createDeckAddNoteStudyAndAnswerWithRealRustEngine() {
        val deckId = AnkiEngine.createDeck("일본어::JLPT N1")
        assertTrue(deckId > 0)

        val notetypes = AnkiEngine.getNotetypeNames()
        assertTrue(notetypes.isNotEmpty())
        val basicId = notetypes.first().id

        val noteId = AnkiEngine.addNote(
            notetypeId = basicId,
            deckId = deckId,
            fields = listOf("勉強", "공부"),
            tags = listOf("jlpt", "n1")
        )
        assertTrue(noteId > 0)

        AnkiEngine.setCurrentDeck(deckId)
        val queued = AnkiEngine.getQueuedCards(5)
        assertEquals(1, queued.cardsCount)

        val card = queued.getCards(0)
        val rendered = AnkiEngine.renderExistingCard(card.card.id)
        val qText = rendered.questionNodesList.joinToString("") { it.text + it.replacement.currentText }
        assertTrue(qText.contains("勉強"))

        val labels = AnkiEngine.describeNextStates(card.states)
        assertEquals(4, labels.size)

        // Answer GOOD (2-button mode "괜찮음")
        AnkiEngine.answerCard(card.card.id, card.states, CardAnswer.Rating.GOOD, 1500)

        // Undo must work cleanly
        assertTrue(AnkiEngine.undo())
        assertEquals(1, AnkiEngine.getQueuedCards(5).cardsCount)
    }

    @Test
    fun deckTreeReportsDueCounts() {
        val deckId = AnkiEngine.createDeck("카운트 테스트")
        val basicId = AnkiEngine.getNotetypeNames().first().id
        AnkiEngine.addNote(basicId, deckId, listOf("앞", "뒤"), emptyList())

        // deckTree(0) skips count calculation; the deck list must see the real new count
        val node = AnkiEngine.deckTree().childrenList.first { it.deckId == deckId }
        assertEquals(1, node.newCount)
    }

    @Test
    fun supportsMillionCharTemplateWithoutBinderOrTruncation() {
        val nt = AnkiEngine.getNotetype(AnkiEngine.getNotetypeNames().first().id)
        val hugeCss = buildString {
            append(".card { font-size: 20px; }\n")
            repeat(15_000) { idx ->
                append("/* rule-$idx-padding-for-one-million-char-stress-test-myamgi-0123456789 */\n")
            }
        }
        assertTrue("Expected >1,000,000 chars, got ${hugeCss.length}", hugeCss.length > 1_000_000)

        AnkiEngine.updateNotetypeCss(nt.id, hugeCss)
        val reloaded = AnkiEngine.getNotetype(nt.id)
        assertEquals(hugeCss.length, reloaded.config.css.length)
        assertEquals(hugeCss, reloaded.config.css)
    }

    @Test
    fun simpleDeckOptionsAndFsrsRetentionUpdate() {
        val deckId = AnkiEngine.createDeck("FSRS 테스트")
        AnkiEngine.updateSimpleDeckOptions(
            deckId = deckId,
            newPerDay = 25,
            reviewsPerDay = 250,
            learnSteps = listOf(1f, 10f),
            relearnSteps = listOf(10f),
            desiredRetention = 0.92f,
            fsrsEnabled = true
        )
        assertTrue(AnkiEngine.isFsrsEnabled())
        val updated = AnkiEngine.getDeckConfigsForUpdate(deckId)
        val active = updated.allConfigList.first { it.config.id == updated.currentDeck.configId }.config
        assertEquals(25, active.config.newPerDay)
        assertEquals(250, active.config.reviewsPerDay)
        assertEquals(0.92f, active.config.desiredRetention, 0.005f)
    }

    @Test
    fun exportAndImportApkgRoundTrip() {
        val deckId = AnkiEngine.createDeck("내보내기 테스트")
        val basicId = AnkiEngine.getNotetypeNames().first().id
        AnkiEngine.addNote(basicId, deckId, listOf("漢字", "한자"), listOf("export"))

        val apkgFile = File(tempFolder.root, "test_export.apkg")
        AnkiEngine.exportApkg(apkgFile.absolutePath, deckId, includeScheduling = true)
        assertTrue(apkgFile.exists() && apkgFile.length() > 100)

        // Import into a brand new collection
        AnkiEngine.closeAll()
        AnkiEngine.setCollectionDir(tempFolder.newFolder("col2"))
        val resp = AnkiEngine.importApkg(apkgFile.absolutePath)
        assertTrue(resp.log.foundNotes > 0)
        val found = AnkiEngine.searchNotes("tag:export")
        assertEquals(1, found.size)
    }
}
