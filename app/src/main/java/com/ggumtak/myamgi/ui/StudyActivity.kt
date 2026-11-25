package com.ggumtak.myamgi.ui

import android.annotation.SuppressLint
import android.content.Intent
import android.graphics.Color
import android.media.MediaPlayer
import android.os.Bundle
import android.os.SystemClock
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import anki.scheduler.CardAnswer
import anki.scheduler.QueuedCards
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.hanja.HanjaIntegration
import com.ggumtak.myamgi.prefs.AppPrefs
import com.ggumtak.myamgi.render.CardPreloader
import com.ggumtak.myamgi.render.CardRenderer
import com.ggumtak.myamgi.render.MediaCache
import com.ggumtak.myamgi.render.RenderedCard
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.ByteArrayInputStream
import java.io.File

class StudyActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_DECK_ID = "extra_deck_id"
        const val EXTRA_DECK_NAME = "extra_deck_name"
    }

    private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private var deckId: Long = 0L
    private var deckName: String = "학습"

    private lateinit var titleView: TextView
    private lateinit var countsView: TextView
    private lateinit var webView: WebView
    private lateinit var emptyPane: LinearLayout
    private lateinit var showAnswerBtn: Button
    private lateinit var ratingRow: LinearLayout
    private lateinit var btnAgain: Button
    private lateinit var btnHard: Button
    private lateinit var btnGood: Button
    private lateinit var btnEasy: Button

    private var currentQueue: QueuedCards? = null
    private var currentCard: QueuedCards.QueuedCard? = null
    private var currentRendered: RenderedCard? = null
    private var isAnswerShown: Boolean = false
    private var cardShownAtMs: Long = 0L
    private var isBusy: Boolean = false
    private var hasLoadedDomOnce: Boolean = false

    private var mediaPlayer: MediaPlayer? = null
    private var cachedHanjaScript: String? = null
    private var appliedThemeKey: String = ""

    override fun onCreate(savedInstanceState: Bundle?) {
        UiThemeHelper.applyActivityTheme(this)
        super.onCreate(savedInstanceState)
        appliedThemeKey = currentThemeKey()

        deckId = intent.getLongExtra(EXTRA_DECK_ID, 0L)
        deckName = intent.getStringExtra(EXTRA_DECK_NAME) ?: "학습"

        MediaCache.init(this)
        buildLayout()
        loadNextCard(initialLoad = true)
    }

    override fun onResume() {
        super.onResume()
        val nowKey = currentThemeKey()
        if (nowKey != appliedThemeKey) {
            recreate()
            return
        }
        refreshRatingButtonsLayout()
    }

    override fun onDestroy() {
        super.onDestroy()
        stopAudio()
        CardPreloader.clear()
        webView.destroy()
        uiScope.cancel()
    }

    private fun currentThemeKey(): String =
        "${AppPrefs.getThemeMode(this)}_${DeviceProfile.current(this).isEink}"

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildLayout() {
        val p = UiThemeHelper.palette(this)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.background)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val (topBar, topTitle, actionsRow) = UiThemeHelper.createTopBar(this, deckName, showBack = true)
        titleView = topTitle
        countsView = TextView(this).apply {
            setTextColor(p.textSecondary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            setPadding(0, 0, UiThemeHelper.dp(this@StudyActivity, 6), 0)
        }
        actionsRow.addView(countsView)

        UiThemeHelper.addTopBarButton(this, actionsRow, "되돌리기") { performUndo() }
        UiThemeHelper.addTopBarButton(this, actionsRow, "⋮") {
            showStudyOverflowMenu()
        }
        root.addView(topBar)

        val contentWrap = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }

        webView = WebView(this).apply {
            setBackgroundColor(if (p.isEink) Color.WHITE else p.surface)
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.mediaPlaybackRequiresUserGesture = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            addJavascriptInterface(MyAmgiBridge(), "MyAmgiBridge")
            webChromeClient = WebChromeClient()
            webViewClient = StudyWebViewClient()
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        contentWrap.addView(webView)

        emptyPane = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            visibility = View.GONE
            setPadding(UiThemeHelper.dp(this@StudyActivity, 24), UiThemeHelper.dp(this@StudyActivity, 24), UiThemeHelper.dp(this@StudyActivity, 24), UiThemeHelper.dp(this@StudyActivity, 24))
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        val congratsTitle = UiThemeHelper.makeLabel(this, "오늘 학습할 카드를 모두 마쳤습니다!", sizeSp = 18f).apply {
            gravity = Gravity.CENTER
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }
        emptyPane.addView(congratsTitle)
        val congratsBtn = UiThemeHelper.createStyledButton(this, "축하 / 상세 통계 보기", filled = false).apply {
            setOnClickListener { AnkiPageActivity.start(this@StudyActivity, "/congrats", "학습 완료") }
        }
        emptyPane.addView(
            congratsBtn,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = UiThemeHelper.dp(this@StudyActivity, 14)
            }
        )
        val backDeckBtn = UiThemeHelper.createStyledButton(this, "덱 목록으로 돌아가기", filled = true).apply {
            setOnClickListener { finish() }
        }
        emptyPane.addView(
            backDeckBtn,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = UiThemeHelper.dp(this@StudyActivity, 10)
            }
        )
        contentWrap.addView(emptyPane)
        root.addView(contentWrap)

        root.addView(UiThemeHelper.makeDivider(this))

        val bottomArea = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.surface)
            setPadding(
                UiThemeHelper.dp(this@StudyActivity, 10),
                UiThemeHelper.dp(this@StudyActivity, 8),
                UiThemeHelper.dp(this@StudyActivity, 10),
                UiThemeHelper.dp(this@StudyActivity, 10)
            )
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        showAnswerBtn = UiThemeHelper.createStyledButton(
            this,
            "정답 보기 (Space)",
            filled = true,
            textSizeSp = 16f,
            verticalPadDp = 12
        ).apply {
            setOnClickListener { revealAnswer() }
        }
        bottomArea.addView(showAnswerBtn, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))

        ratingRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            visibility = View.GONE
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        btnAgain = UiThemeHelper.createStyledButton(this, "다시 (1)", filled = !p.isEink, accentOverride = p.againColor, textSizeSp = 14f, verticalPadDp = 11).apply {
            setOnClickListener { submitRating(CardAnswer.Rating.AGAIN) }
        }
        btnHard = UiThemeHelper.createStyledButton(this, "어려움 (2)", filled = !p.isEink, accentOverride = p.hardColor, textSizeSp = 14f, verticalPadDp = 11).apply {
            setOnClickListener { submitRating(CardAnswer.Rating.HARD) }
        }
        btnGood = UiThemeHelper.createStyledButton(this, "괜찮음", filled = true, accentOverride = p.goodColor, textSizeSp = 14f, verticalPadDp = 11).apply {
            setOnClickListener { submitRating(CardAnswer.Rating.GOOD) }
        }
        btnEasy = UiThemeHelper.createStyledButton(this, "쉬움 (4)", filled = !p.isEink, accentOverride = p.easyColor, textSizeSp = 14f, verticalPadDp = 11).apply {
            setOnClickListener { submitRating(CardAnswer.Rating.EASY) }
        }

        listOf(btnAgain, btnHard, btnGood, btnEasy).forEachIndexed { idx, btn ->
            val lp = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (idx > 0) marginStart = UiThemeHelper.dp(this@StudyActivity, 6)
            }
            ratingRow.addView(btn, lp)
        }
        bottomArea.addView(ratingRow)
        root.addView(bottomArea)

        setContentView(root)
    }

    private fun showStudyOverflowMenu() {
        val anchor = countsView
        val popup = PopupMenu(this, anchor)
        val twoBtn = AppPrefs.isTwoButtonMode(this)
        val items = listOf(
            1 to "노트 편집",
            2 to "템플릿 편집",
            3 to "카드 정보 (SvelteKit)",
            4 to "카드 보류 (Bury)",
            5 to "카드 일시중단 (Suspend)",
            6 to if (twoBtn) "4버튼 모드로 전환" else "2버튼 모드로 전환",
            7 to "덱 옵션"
        )
        items.forEach { (id, title) -> popup.menu.add(0, id, id, title) }
        popup.setOnMenuItemClickListener { item ->
            val card = currentCard?.card
            when (item.itemId) {
                1 -> if (card != null) {
                    startActivity(
                        Intent(this, NoteEditorActivity::class.java)
                            .putExtra(NoteEditorActivity.EXTRA_NOTE_ID, card.noteId)
                            .putExtra(NoteEditorActivity.EXTRA_DECK_ID, card.deckId)
                    )
                    UiThemeHelper.disableExitAnimationIfEink(this)
                }
                2 -> {
                    startActivity(Intent(this, TemplateEditorActivity::class.java))
                    UiThemeHelper.disableExitAnimationIfEink(this)
                }
                3 -> if (card != null) {
                    AnkiPageActivity.start(this, "/card-info/${card.id}", "카드 정보")
                }
                4 -> if (card != null) {
                    uiScope.launch {
                        withContext(Dispatchers.IO) { runCatching { AnkiEngine.buryCards(listOf(card.id)) } }
                        hasLoadedDomOnce = false
                        loadNextCard(initialLoad = false)
                    }
                }
                5 -> if (card != null) {
                    uiScope.launch {
                        withContext(Dispatchers.IO) { runCatching { AnkiEngine.suspendCards(listOf(card.id)) } }
                        hasLoadedDomOnce = false
                        loadNextCard(initialLoad = false)
                    }
                }
                6 -> {
                    AppPrefs.setTwoButtonMode(this, !twoBtn)
                    refreshRatingButtonsLayout()
                    Toast.makeText(this, if (!twoBtn) "2버튼 고속 학습 모드" else "4버튼 표준 모드", Toast.LENGTH_SHORT).show()
                }
                7 -> {
                    val targetDeck = card?.deckId ?: deckId
                    startActivity(
                        Intent(this, DeckOptionsActivity::class.java)
                            .putExtra(DeckOptionsActivity.EXTRA_DECK_ID, targetDeck)
                            .putExtra(DeckOptionsActivity.EXTRA_DECK_NAME, deckName)
                    )
                    UiThemeHelper.disableExitAnimationIfEink(this)
                }
            }
            true
        }
        popup.show()
    }

    private fun refreshRatingButtonsLayout() {
        val twoBtn = AppPrefs.isTwoButtonMode(this)
        btnHard.visibility = if (twoBtn) View.GONE else View.VISIBLE
        btnEasy.visibility = if (twoBtn) View.GONE else View.VISIBLE

        val lpAgain = btnAgain.layoutParams as LinearLayout.LayoutParams
        val lpGood = btnGood.layoutParams as LinearLayout.LayoutParams
        if (twoBtn) {
            lpAgain.marginStart = 0
            lpGood.marginStart = UiThemeHelper.dp(this, 8)
        } else {
            lpAgain.marginStart = 0
            lpGood.marginStart = UiThemeHelper.dp(this, 6)
        }
        btnAgain.layoutParams = lpAgain
        btnGood.layoutParams = lpGood
    }

    private fun loadNextCard(initialLoad: Boolean) {
        if (isBusy) return
        isBusy = true
        uiScope.launch {
            val profile = DeviceProfile.current(this@StudyActivity)
            val fetchLimit = (1 + profile.preloadCardsCount).coerceAtLeast(3)

            val loaded = withContext(Dispatchers.IO) {
                runCatching {
                    AnkiEngine.ensureOpen()
                    if (deckId > 0) {
                        AnkiEngine.setCurrentDeck(deckId)
                    }
                    val queue = AnkiEngine.getQueuedCards(fetchLimit)
                    if (queue.cardsCount == 0) {
                        Triple(queue, null, emptyList<String>())
                    } else {
                        val first = queue.getCards(0)
                        val rendered = CardPreloader.takeOrRender(first.card.id)
                        val nextLabels = AnkiEngine.describeNextStates(first.states)
                        val upcomingIds = (1 until queue.cardsCount).map { queue.getCards(it).card.id }
                        if (profile.preloadCardsCount > 0 && upcomingIds.isNotEmpty()) {
                            CardPreloader.preload(this@StudyActivity, upcomingIds.take(profile.preloadCardsCount), uiScope)
                        }
                        if (cachedHanjaScript == null && AppPrefs.isHanjaAutoInject(this@StudyActivity)) {
                            cachedHanjaScript = runCatching { HanjaIntegration.loadTapScript(this@StudyActivity).second }.getOrNull()
                        }
                        Triple(queue, rendered, nextLabels)
                    }
                }
            }

            isBusy = false
            loaded.onFailure { err ->
                Toast.makeText(this@StudyActivity, "카드 불러오기 오류: ${err.message}", Toast.LENGTH_LONG).show()
            }.onSuccess { (queue, rendered, nextLabels) ->
                currentQueue = queue
                countsView.text = "새 ${queue.newCount} · 학습 ${queue.learningCount} · 복습 ${queue.reviewCount}"
                if (rendered == null || queue.cardsCount == 0) {
                    currentCard = null
                    currentRendered = null
                    webView.visibility = View.GONE
                    emptyPane.visibility = View.VISIBLE
                    showAnswerBtn.visibility = View.GONE
                    ratingRow.visibility = View.GONE
                    return@onSuccess
                }

                emptyPane.visibility = View.GONE
                webView.visibility = View.VISIBLE
                currentCard = queue.getCards(0)
                currentRendered = rendered
                isAnswerShown = false
                cardShownAtMs = SystemClock.elapsedRealtime()

                updateAnswerButtonsState(nextLabels)
                renderCurrentCardToWebView(isAnswer = false, forceFullLoad = initialLoad || !hasLoadedDomOnce)
                playSoundList(rendered.questionSounds)
            }
        }
    }

    private fun updateAnswerButtonsState(nextLabels: List<String>) {
        val againIvl = nextLabels.getOrNull(0).orEmpty()
        val hardIvl = nextLabels.getOrNull(1).orEmpty()
        val goodIvl = nextLabels.getOrNull(2).orEmpty()
        val easyIvl = nextLabels.getOrNull(3).orEmpty()

        val twoBtn = AppPrefs.isTwoButtonMode(this)
        btnAgain.text = if (againIvl.isNotEmpty()) "다시 (1)\n$againIvl" else "다시 (1)"
        btnHard.text = if (hardIvl.isNotEmpty()) "어려움 (2)\n$hardIvl" else "어려움 (2)"
        btnGood.text = if (twoBtn) {
            if (goodIvl.isNotEmpty()) "괜찮음 (2 / Space)\n$goodIvl" else "괜찮음 (2 / Space)"
        } else {
            if (goodIvl.isNotEmpty()) "괜찮음 (3)\n$goodIvl" else "괜찮음 (3)"
        }
        btnEasy.text = if (easyIvl.isNotEmpty()) "쉬움 (4)\n$easyIvl" else "쉬움 (4)"

        refreshRatingButtonsLayout()
        if (isAnswerShown) {
            showAnswerBtn.visibility = View.GONE
            ratingRow.visibility = View.VISIBLE
        } else {
            showAnswerBtn.visibility = View.VISIBLE
            ratingRow.visibility = View.GONE
        }
    }

    private fun renderCurrentCardToWebView(isAnswer: Boolean, forceFullLoad: Boolean) {
        val rendered = currentRendered ?: return
        val profile = DeviceProfile.current(this)
        val isDark = UiThemeHelper.isDarkActive(this)
        val isEink = UiThemeHelper.isEinkActive(this)
        val hanjaJs = if (AppPrefs.isHanjaAutoInject(this)) cachedHanjaScript else null

        if (!forceFullLoad && hasLoadedDomOnce && profile.useZeroFlashDomSwap && !isEink) {
            val payloadJson = CardRenderer.buildSwapPayloadJson(rendered, isAnswer, isDark, isEink)
            val jsCall = "if(window.__myAmgiSwapCard){window.__myAmgiSwapCard($payloadJson);}else{false;}"
            webView.evaluateJavascript(jsCall, null)
        } else {
            val fullHtml = CardRenderer.buildFullHtml(
                context = this,
                rendered = rendered,
                isAnswer = isAnswer,
                isDark = isDark,
                isEink = isEink,
                hanjaJs = hanjaJs
            )
            hasLoadedDomOnce = true
            webView.loadDataWithBaseURL(
                "${CardRenderer.MEDIA_HOST}/media/",
                fullHtml,
                "text/html",
                "UTF-8",
                null
            )
        }
    }

    private fun revealAnswer() {
        if (currentCard == null || isAnswerShown) return
        isAnswerShown = true
        showAnswerBtn.visibility = View.GONE
        ratingRow.visibility = View.VISIBLE
        renderCurrentCardToWebView(isAnswer = true, forceFullLoad = false)
        currentRendered?.let { playSoundList(it.answerSounds) }
    }

    private fun submitRating(rating: CardAnswer.Rating) {
        val card = currentCard ?: return
        if (!isAnswerShown || isBusy) return
        isBusy = true
        stopAudio()

        val elapsed = (SystemClock.elapsedRealtime() - cardShownAtMs).toInt().coerceIn(100, 60_000)
        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                runCatching {
                    AnkiEngine.answerCard(card.card.id, card.states, rating, elapsed)
                }
            }
            isBusy = false
            res.onFailure { err ->
                Toast.makeText(this@StudyActivity, "답변 저장 실패: ${err.message}", Toast.LENGTH_SHORT).show()
            }.onSuccess {
                loadNextCard(initialLoad = false)
            }
        }
    }

    private fun performUndo() {
        if (isBusy) return
        isBusy = true
        stopAudio()
        uiScope.launch {
            val ok = withContext(Dispatchers.IO) { AnkiEngine.undo() }
            isBusy = false
            if (ok) {
                hasLoadedDomOnce = false
                Toast.makeText(this@StudyActivity, "직전 학습을 되돌렸습니다.", Toast.LENGTH_SHORT).show()
                loadNextCard(initialLoad = true)
            } else {
                Toast.makeText(this@StudyActivity, "되돌릴 기록이 없습니다.", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun playSoundList(sounds: List<String>) {
        val first = sounds.firstOrNull() ?: return
        playAudioFile(first)
    }

    private fun playAudioFile(filename: String) {
        if (filename.isBlank()) return
        uiScope.launch(Dispatchers.IO) {
            val mediaFile = File(AnkiEngine.getMediaDir(), filename)
            if (!mediaFile.exists()) return@launch
            withContext(Dispatchers.Main) {
                stopAudio()
                runCatching {
                    mediaPlayer = MediaPlayer().apply {
                        setDataSource(mediaFile.absolutePath)
                        setOnCompletionListener {
                            it.release()
                            if (mediaPlayer === it) mediaPlayer = null
                        }
                        prepare()
                        start()
                    }
                }
            }
        }
    }

    private fun stopAudio() {
        runCatching {
            mediaPlayer?.stop()
            mediaPlayer?.release()
        }
        mediaPlayer = null
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        if (event.action == KeyEvent.ACTION_DOWN) {
            val twoButton = AppPrefs.isTwoButtonMode(this)
            val volStudy = AppPrefs.isVolumeKeyStudy(this)
            val action = StudyKeyHandler.mapKey(
                keyCode = event.keyCode,
                isAnswerShown = isAnswerShown,
                twoButtonMode = twoButton,
                volumeKeyStudy = volStudy,
                isShiftPressed = event.isShiftPressed
            )
            if (action != StudyKeyHandler.StudyAction.NONE) {
                if (event.repeatCount == 0) {
                    executeStudyAction(action)
                }
                return true
            }
        } else if (event.action == KeyEvent.ACTION_UP) {
            val volStudy = AppPrefs.isVolumeKeyStudy(this)
            if (volStudy && (event.keyCode == KeyEvent.KEYCODE_VOLUME_UP || event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN)) {
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun executeStudyAction(action: StudyKeyHandler.StudyAction) {
        when (action) {
            StudyKeyHandler.StudyAction.SHOW_ANSWER -> revealAnswer()
            StudyKeyHandler.StudyAction.RATE_AGAIN -> submitRating(CardAnswer.Rating.AGAIN)
            StudyKeyHandler.StudyAction.RATE_HARD -> submitRating(CardAnswer.Rating.HARD)
            StudyKeyHandler.StudyAction.RATE_GOOD -> submitRating(CardAnswer.Rating.GOOD)
            StudyKeyHandler.StudyAction.RATE_EASY -> submitRating(CardAnswer.Rating.EASY)
            StudyKeyHandler.StudyAction.UNDO -> performUndo()
            StudyKeyHandler.StudyAction.HANJA_OPEN -> webView.evaluateJavascript("window.userJs1 && window.userJs1()", null)
            StudyKeyHandler.StudyAction.HANJA_NEXT -> webView.evaluateJavascript("window.userJs2 && window.userJs2()", null)
            StudyKeyHandler.StudyAction.HANJA_PREV -> webView.evaluateJavascript("window.userJs3 && window.userJs3()", null)
            StudyKeyHandler.StudyAction.NONE -> Unit
        }
    }

    private inner class StudyWebViewClient : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val url = request?.url?.toString() ?: return false
            if (url.startsWith("intent://") || url.startsWith("hanja://")) {
                return HanjaIntegration.handleIntentUrl(this@StudyActivity, url)
            }
            if (url.startsWith("playsound:")) {
                playAudioFile(android.net.Uri.decode(url.removePrefix("playsound:")))
                return true
            }
            return false
        }

        override fun shouldInterceptRequest(view: WebView?, request: WebResourceRequest?): WebResourceResponse? {
            val uri = request?.url ?: return null
            val host = uri.host ?: ""
            val path = uri.path ?: return null
            if (!host.equals("appassets.androidplatform.net", ignoreCase = true)) {
                return null
            }
            val filename = when {
                path.startsWith("/media/") -> path.removePrefix("/media/")
                path.startsWith("/") -> path.removePrefix("/")
                else -> path
            }.trimStart('/')
            if (filename.isEmpty() || filename == "index.html") return null

            val bytes = MediaCache.getMediaBytes(filename) ?: return WebResourceResponse(
                "text/plain",
                "UTF-8",
                404,
                "Not Found",
                mapOf("Access-Control-Allow-Origin" to "*"),
                ByteArrayInputStream(ByteArray(0))
            )
            val mime = MediaCache.guessMimeType(filename)
            return WebResourceResponse(
                mime,
                null,
                200,
                "OK",
                mapOf(
                    "Access-Control-Allow-Origin" to "*",
                    "Cache-Control" to "max-age=3600"
                ),
                ByteArrayInputStream(bytes)
            )
        }
    }

    @Suppress("unused")
    private inner class MyAmgiBridge {
        @JavascriptInterface
        fun playAudio(filename: String) {
            playAudioFile(filename)
        }

        @JavascriptInterface
        fun showAnswer() {
            runOnUiThread { revealAnswer() }
        }

        @JavascriptInterface
        fun rate(ease: Int) {
            runOnUiThread {
                val r = when (ease) {
                    1 -> CardAnswer.Rating.AGAIN
                    2 -> if (AppPrefs.isTwoButtonMode(this@StudyActivity)) CardAnswer.Rating.GOOD else CardAnswer.Rating.HARD
                    3 -> CardAnswer.Rating.GOOD
                    4 -> CardAnswer.Rating.EASY
                    else -> CardAnswer.Rating.GOOD
                }
                submitRating(r)
            }
        }

        @JavascriptInterface
        fun answerCard(ease: Int) {
            rate(ease)
        }

        @JavascriptInterface
        fun onTapBlank() {
            runOnUiThread {
                if (AppPrefs.isTapToFlip(this@StudyActivity) && !isAnswerShown) {
                    revealAnswer()
                }
            }
        }

        @JavascriptInterface
        fun onCardTap(nx: Double, ny: Double) {
            onTapBlank()
        }
    }
}
