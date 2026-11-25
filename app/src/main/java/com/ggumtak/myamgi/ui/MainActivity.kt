package com.ggumtak.myamgi.ui

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.TextUtils
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import anki.decks.DeckTreeNode
import com.ggumtak.myamgi.BuildConfig
import com.ggumtak.myamgi.R
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.engine.EncodingDetector
import com.ggumtak.myamgi.prefs.AppPrefs
import com.ggumtak.myamgi.sync.SupabaseSyncManager
import com.ggumtak.myamgi.update.OtaAssetUpdater
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    data class FlatDeckRow(
        val deckId: Long,
        val fullName: String,
        val displayName: String,
        val level: Int,
        val hasChildren: Boolean,
        val collapsed: Boolean,
        val newCount: Int,
        val learnCount: Int,
        val reviewCount: Int
    )

    private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private lateinit var rootLayout: LinearLayout
    private lateinit var statusBanner: TextView
    private lateinit var recyclerView: RecyclerView
    private lateinit var emptyView: TextView
    private lateinit var errorPanel: LinearLayout
    private lateinit var errorMessageView: TextView
    private var lastOpenError: Throwable? = null
    private lateinit var syncButton: Button
    private val adapter = DeckListAdapter()

    private var appliedThemeKey: String = ""

    private val importLauncher = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            handleImportUri(uri)
        }
    }

    private var pendingExportDeckId: Long? = null
    private val exportLauncher = registerForActivityResult(ActivityResultContracts.CreateDocument("application/octet-stream")) { uri ->
        val deckId = pendingExportDeckId
        pendingExportDeckId = null
        if (uri != null && deckId != null) {
            exportDeckToUri(deckId, uri)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        UiThemeHelper.applyActivityTheme(this)
        super.onCreate(savedInstanceState)
        appliedThemeKey = currentThemeKey()

        buildLayout()
        handleIncomingIntent(intent)
        checkOtaQuietly()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    override fun onResume() {
        super.onResume()
        val nowKey = currentThemeKey()
        if (nowKey != appliedThemeKey) {
            recreate()
            return
        }
        loadDecks()
    }

    override fun onDestroy() {
        super.onDestroy()
        uiScope.cancel()
    }

    private fun currentThemeKey(): String =
        "${AppPrefs.getThemeMode(this)}_${DeviceProfile.current(this).isEink}"

    private fun buildLayout() {
        val p = UiThemeHelper.palette(this)
        val profile = DeviceProfile.current(this)

        rootLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.background)
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        }

        val appTitle = getString(R.string.app_name)
        val (topBar, _, actionsRow) = UiThemeHelper.createTopBar(this, appTitle, showBack = false)

        syncButton = UiThemeHelper.addTopBarButton(this, actionsRow, "동기화") {
            runSupabaseSync()
        }
        UiThemeHelper.addTopBarButton(this, actionsRow, "통계") {
            AnkiPageActivity.start(this, "/graphs", "학습 통계")
        }
        UiThemeHelper.addTopBarButton(this, actionsRow, "설정") {
            startActivity(Intent(this, SettingsActivity::class.java))
            UiThemeHelper.disableExitAnimationIfEink(this)
        }
        rootLayout.addView(topBar)

        statusBanner = TextView(this).apply {
            visibility = View.GONE
            setTextColor(p.textPrimary)
            setBackgroundColor(p.surfaceAlt)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
            setPadding(UiThemeHelper.dp(this@MainActivity, 12), UiThemeHelper.dp(this@MainActivity, 6), UiThemeHelper.dp(this@MainActivity, 12), UiThemeHelper.dp(this@MainActivity, 6))
        }
        rootLayout.addView(statusBanner)

        val contentFrame = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }

        recyclerView = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@MainActivity)
            adapter = this@MainActivity.adapter
            itemAnimator = if (profile.enableAnimations && !p.isEink) itemAnimator else null
            setPadding(
                UiThemeHelper.dp(this@MainActivity, 10),
                UiThemeHelper.dp(this@MainActivity, 8),
                UiThemeHelper.dp(this@MainActivity, 10),
                UiThemeHelper.dp(this@MainActivity, 8)
            )
            clipToPadding = false
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        contentFrame.addView(recyclerView)

        emptyView = TextView(this).apply {
            visibility = View.GONE
            gravity = Gravity.CENTER
            text = "덱이 없습니다.\n하단에서 .apkg/.csv를 가져오거나 새 노트를 추가해 보세요."
            setTextColor(p.textSecondary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setPadding(UiThemeHelper.dp(this@MainActivity, 24), UiThemeHelper.dp(this@MainActivity, 32), UiThemeHelper.dp(this@MainActivity, 24), UiThemeHelper.dp(this@MainActivity, 32))
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        contentFrame.addView(emptyView)
        contentFrame.addView(buildErrorPanel(p))
        rootLayout.addView(contentFrame)

        rootLayout.addView(UiThemeHelper.makeDivider(this))

        val bottomBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(p.surface)
            setPadding(
                UiThemeHelper.dp(this@MainActivity, 8),
                UiThemeHelper.dp(this@MainActivity, 8),
                UiThemeHelper.dp(this@MainActivity, 8),
                UiThemeHelper.dp(this@MainActivity, 8)
            )
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }

        val btnImport = UiThemeHelper.createStyledButton(this, "가져오기", filled = false, textSizeSp = 12f, horizontalPadDp = 6, verticalPadDp = 8).apply {
            setOnClickListener {
                importLauncher.launch(arrayOf("*/*"))
            }
        }
        val btnAddNote = UiThemeHelper.createStyledButton(this, "노트 추가", filled = true, textSizeSp = 12f, horizontalPadDp = 6, verticalPadDp = 8).apply {
            setOnClickListener {
                startActivity(Intent(this@MainActivity, NoteEditorActivity::class.java))
                UiThemeHelper.disableExitAnimationIfEink(this@MainActivity)
            }
        }
        val btnNewDeck = UiThemeHelper.createStyledButton(this, "새 덱", filled = false, textSizeSp = 12f, horizontalPadDp = 6, verticalPadDp = 8).apply {
            setOnClickListener { showCreateDeckDialog() }
        }
        val btnSearch = UiThemeHelper.createStyledButton(this, "카드 검색", filled = false, textSizeSp = 12f, horizontalPadDp = 6, verticalPadDp = 8).apply {
            setOnClickListener {
                startActivity(Intent(this@MainActivity, CardBrowserActivity::class.java))
                UiThemeHelper.disableExitAnimationIfEink(this@MainActivity)
            }
        }

        listOf(btnImport, btnAddNote, btnNewDeck, btnSearch).forEachIndexed { idx, btn ->
            val lp = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (idx > 0) marginStart = UiThemeHelper.dp(this@MainActivity, 6)
            }
            bottomBar.addView(btn, lp)
        }
        rootLayout.addView(bottomBar)

        setContentView(rootLayout)
    }

    private fun buildErrorPanel(p: UiThemeHelper.Palette): View {
        errorPanel = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            visibility = View.GONE
            val pad = UiThemeHelper.dp(this@MainActivity, 16)
            setPadding(pad, pad, pad, pad)
            background = UiThemeHelper.makeCardBackground(
                this@MainActivity,
                fillColor = p.surface,
                strokeColor = if (p.isEink) Color.BLACK else p.againColor,
                cornerDp = 10,
                strokeDp = if (p.isEink) 2f else 1.5f
            )
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            ).apply {
                val m = UiThemeHelper.dp(this@MainActivity, 12)
                setMargins(m, m, m, m)
            }
        }
        errorPanel.addView(UiThemeHelper.makeSectionHeader(this, "학습 데이터를 열지 못했습니다"))
        errorPanel.addView(
            UiThemeHelper.makeLabel(
                this,
                "앱이 Anki 엔진 또는 컬렉션을 여는 중 오류가 발생했습니다. " +
                    "아래 '오류 로그 복사'를 눌러 전체 로그를 개발자에게 보내 주세요."
            )
        )
        errorMessageView = UiThemeHelper.makeLabel(this, "", secondary = true, sizeSp = 12f).apply {
            setPadding(0, UiThemeHelper.dp(this@MainActivity, 8), 0, UiThemeHelper.dp(this@MainActivity, 4))
            setTextIsSelectable(true)
        }
        errorPanel.addView(errorMessageView)

        val buttons = LinearLayout(this).apply { orientation = LinearLayout.HORIZONTAL }
        val btnCopy = UiThemeHelper.createStyledButton(this, "오류 로그 복사", filled = true, verticalPadDp = 10).apply {
            setOnClickListener { copyErrorLog() }
        }
        val btnRetry = UiThemeHelper.createStyledButton(this, "다시 시도", filled = false, verticalPadDp = 10).apply {
            setOnClickListener { loadDecks() }
        }
        buttons.addView(btnCopy, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        buttons.addView(
            btnRetry,
            LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = UiThemeHelper.dp(this@MainActivity, 8)
            }
        )
        errorPanel.addView(
            buttons,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = UiThemeHelper.dp(this@MainActivity, 10)
            }
        )
        return errorPanel
    }

    private fun showOpenError(err: Throwable) {
        lastOpenError = err
        val reason = err.message?.takeIf { it.isNotBlank() } ?: err.javaClass.simpleName
        errorMessageView.text = "원인: $reason"
        recyclerView.visibility = View.GONE
        emptyView.visibility = View.GONE
        errorPanel.visibility = View.VISIBLE
        showStatus("컬렉션 열기 실패")
    }

    private fun copyErrorLog() {
        val err = lastOpenError ?: return
        val time = SimpleDateFormat("yyyy-MM-dd HH:mm:ss Z", Locale.US).format(Date())
        val report = buildString {
            append("myAmgi 오류 로그 (컬렉션 열기 실패)\n")
            append("시각: ").append(time).append('\n')
            append("앱: ").append(BuildConfig.APPLICATION_ID)
                .append(" v").append(BuildConfig.VERSION_NAME)
                .append(" (빌드 ").append(BuildConfig.VERSION_CODE).append(")\n")
            append("플레이버: ").append(BuildConfig.FLAVOR_NAME)
                .append(" / ").append(BuildConfig.BUILD_TYPE).append('\n')
            append("기기: ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL)
                .append(" (").append(Build.DEVICE).append(")\n")
            append("Android: ").append(Build.VERSION.RELEASE)
                .append(" (API ").append(Build.VERSION.SDK_INT).append(")\n")
            append("ABI: ").append(Build.SUPPORTED_ABIS.joinToString(", ")).append('\n')
            append('\n')
            append(err.stackTraceToString())
        }
        val clipboard = getSystemService(ClipboardManager::class.java)
        if (clipboard == null) {
            Toast.makeText(this, "클립보드를 사용할 수 없습니다.", Toast.LENGTH_SHORT).show()
            return
        }
        clipboard.setPrimaryClip(ClipData.newPlainText("myAmgi 오류 로그", report))
        Toast.makeText(this, "오류 로그를 복사했습니다.", Toast.LENGTH_SHORT).show()
    }

    private fun showStatus(msg: String?) {
        if (msg.isNullOrBlank()) {
            statusBanner.visibility = View.GONE
            statusBanner.text = ""
        } else {
            statusBanner.visibility = View.VISIBLE
            statusBanner.text = msg
        }
    }

    private fun loadDecks() {
        uiScope.launch {
            val rowsResult = withContext(Dispatchers.IO) {
                runCatching {
                    AnkiEngine.ensureOpen()
                    val root = AnkiEngine.deckTree()
                    val out = mutableListOf<FlatDeckRow>()
                    flattenDeckTree(root, out)
                    out
                }
            }
            rowsResult.onSuccess { rows ->
                if (errorPanel.visibility == View.VISIBLE) {
                    errorPanel.visibility = View.GONE
                    lastOpenError = null
                    showStatus(null)
                }
                adapter.submitList(rows)
                if (rows.isEmpty()) {
                    recyclerView.visibility = View.GONE
                    emptyView.visibility = View.VISIBLE
                } else {
                    recyclerView.visibility = View.VISIBLE
                    emptyView.visibility = View.GONE
                }
            }.onFailure { err ->
                showOpenError(err)
            }
        }
    }

    private fun flattenDeckTree(root: DeckTreeNode, out: MutableList<FlatDeckRow>) {
        // Root node (level == 0, deckId == 0 or name == "") holds top-level decks in childrenList
        fun walk(node: DeckTreeNode, prefix: String) {
            val isRoot = node.deckId == 0L || node.level <= 0
            val fullName = if (isRoot) "" else if (prefix.isEmpty()) node.name else "$prefix::${node.name}"
            if (!isRoot) {
                out.add(
                    FlatDeckRow(
                        deckId = node.deckId,
                        fullName = fullName,
                        displayName = node.name,
                        level = (node.level - 1).coerceAtLeast(0),
                        hasChildren = node.childrenCount > 0,
                        collapsed = node.collapsed,
                        newCount = node.newCount,
                        learnCount = node.learnCount,
                        reviewCount = node.reviewCount
                    )
                )
            }
            if (isRoot || !node.collapsed) {
                for (child in node.childrenList) {
                    walk(child, fullName)
                }
            }
        }
        walk(root, "")
    }

    private fun startStudy(deckId: Long, deckName: String) {
        uiScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { AnkiEngine.setCurrentDeck(deckId) }
            }
            val intent = Intent(this@MainActivity, StudyActivity::class.java).apply {
                putExtra(StudyActivity.EXTRA_DECK_ID, deckId)
                putExtra(StudyActivity.EXTRA_DECK_NAME, deckName)
            }
            startActivity(intent)
            UiThemeHelper.disableExitAnimationIfEink(this@MainActivity)
        }
    }

    private fun toggleCollapse(row: FlatDeckRow) {
        uiScope.launch {
            withContext(Dispatchers.IO) {
                runCatching { AnkiEngine.setDeckCollapsed(row.deckId, !row.collapsed) }
            }
            loadDecks()
        }
    }

    private fun showDeckMenu(anchor: View, row: FlatDeckRow) {
        val popup = PopupMenu(this, anchor)
        val items = listOf(
            1 to "학습 시작",
            2 to "덱 옵션 (쉬운 설정)",
            3 to "고급 Anki 옵션 / FSRS 최적화",
            4 to "템플릿 편집 (100만자)",
            5 to "이름 변경",
            6 to "덱 내보내기 (.apkg)",
            7 to "삭제"
        )
        items.forEach { (id, title) -> popup.menu.add(0, id, id, title) }
        popup.setOnMenuItemClickListener { item ->
            when (item.itemId) {
                1 -> startStudy(row.deckId, row.fullName)
                2 -> {
                    startActivity(
                        Intent(this, DeckOptionsActivity::class.java)
                            .putExtra(DeckOptionsActivity.EXTRA_DECK_ID, row.deckId)
                            .putExtra(DeckOptionsActivity.EXTRA_DECK_NAME, row.fullName)
                    )
                    UiThemeHelper.disableExitAnimationIfEink(this)
                }
                3 -> AnkiPageActivity.start(this, "/deck-options/${row.deckId}", "고급 덱 설정")
                4 -> {
                    startActivity(Intent(this, TemplateEditorActivity::class.java))
                    UiThemeHelper.disableExitAnimationIfEink(this)
                }
                5 -> showRenameDeckDialog(row)
                6 -> {
                    pendingExportDeckId = row.deckId
                    val safeName = row.displayName.replace(Regex("[^a-zA-Z0-9가-힣._-]"), "_")
                    exportLauncher.launch("$safeName.apkg")
                }
                7 -> showDeleteDeckDialog(row)
            }
            true
        }
        popup.show()
    }

    private fun showCreateDeckDialog() {
        val input = UiThemeHelper.makeInputBox(this, "예: 일본어::JLPT N1")
        AlertDialog.Builder(this)
            .setTitle("새 덱 만들기")
            .setView(input)
            .setPositiveButton("만들기") { _, _ ->
                val name = input.text.toString().trim()
                if (name.isNotEmpty()) {
                    uiScope.launch {
                        withContext(Dispatchers.IO) { runCatching { AnkiEngine.createDeck(name) } }
                        loadDecks()
                    }
                }
            }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun showRenameDeckDialog(row: FlatDeckRow) {
        val input = UiThemeHelper.makeInputBox(this, "새 덱 이름").apply {
            setText(row.fullName)
        }
        AlertDialog.Builder(this)
            .setTitle("덱 이름 변경")
            .setView(input)
            .setPositiveButton("변경") { _, _ ->
                val name = input.text.toString().trim()
                if (name.isNotEmpty()) {
                    uiScope.launch {
                        withContext(Dispatchers.IO) { runCatching { AnkiEngine.renameDeck(row.deckId, name) } }
                        loadDecks()
                    }
                }
            }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun showDeleteDeckDialog(row: FlatDeckRow) {
        AlertDialog.Builder(this)
            .setTitle("덱 삭제")
            .setMessage("'${row.fullName}' 덱과 포함된 카드를 삭제할까요?")
            .setPositiveButton("삭제") { _, _ ->
                uiScope.launch {
                    withContext(Dispatchers.IO) { runCatching { AnkiEngine.deleteDeck(row.deckId) } }
                    loadDecks()
                }
            }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun runSupabaseSync() {
        val url = AppPrefs.getSupabaseUrl(this)
        val key = AppPrefs.getSupabaseAnonKey(this)
        if (url.isBlank() || key.isBlank() || AppPrefs.getSupabaseUserId(this).isBlank()) {
            Toast.makeText(this, "설정에서 Supabase 클라우드를 먼저 연결해 주세요.", Toast.LENGTH_SHORT).show()
            startActivity(Intent(this, SettingsActivity::class.java))
            UiThemeHelper.disableExitAnimationIfEink(this)
            return
        }

        syncButton.isEnabled = false
        showStatus("클라우드 동기화 준비 중...")
        uiScope.launch {
            val result = withContext(Dispatchers.IO) {
                SupabaseSyncManager.syncAll(this@MainActivity) { progressMsg ->
                    uiScope.launch { showStatus("동기화: $progressMsg") }
                }
            }
            syncButton.isEnabled = true
            result.onSuccess { summary ->
                showStatus("동기화 완료: ${summary.message} (업로드 ${summary.uploadedMedia}, 다운로드 ${summary.downloadedMedia})")
                loadDecks()
            }.onFailure { err ->
                showStatus("동기화 오류: ${err.message}")
            }
        }
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent?.action == Intent.ACTION_VIEW) {
            val uri = intent.data ?: return
            handleImportUri(uri)
        }
    }

    private fun handleImportUri(uri: Uri) {
        val fileName = queryDisplayName(uri) ?: uri.lastPathSegment ?: "import.apkg"
        val lower = fileName.lowercase()
        when {
            lower.endsWith(".apkg") || lower.endsWith(".colpkg") -> importPackageFromUri(uri, fileName, lower.endsWith(".colpkg"))
            lower.endsWith(".csv") || lower.endsWith(".tsv") || lower.endsWith(".txt") -> importCsvFromUri(uri, fileName)
            else -> {
                AlertDialog.Builder(this)
                    .setTitle("가져오기 형식 선택")
                    .setMessage("'$fileName' 파일의 형식을 선택해 주세요.")
                    .setItems(arrayOf(".apkg 덱 패키지", ".colpkg 전체 컬렉션", ".csv / .tsv 텍스트")) { _, which ->
                        when (which) {
                            0 -> importPackageFromUri(uri, fileName, isColpkg = false)
                            1 -> importPackageFromUri(uri, fileName, isColpkg = true)
                            2 -> importCsvFromUri(uri, fileName)
                        }
                    }
                    .show()
            }
        }
    }

    private fun queryDisplayName(uri: Uri): String? {
        return runCatching {
            contentResolver.query(uri, arrayOf(android.provider.OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            }
        }.getOrNull()
    }

    private fun importPackageFromUri(uri: Uri, fileName: String, isColpkg: Boolean) {
        showStatus("가져오는 중: $fileName ...")
        uiScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val tempFile = File(cacheDir, "import_${System.currentTimeMillis()}_${if (isColpkg) "pkg.colpkg" else "pkg.apkg"}")
                    contentResolver.openInputStream(uri)?.use { input ->
                        tempFile.outputStream().use { output -> input.copyTo(output) }
                    } ?: error("파일을 열 수 없습니다.")
                    try {
                        AnkiEngine.ensureOpen()
                        if (isColpkg) {
                            AnkiEngine.importColpkg(tempFile.absolutePath)
                            "컬렉션(.colpkg) 가져오기 완료"
                        } else {
                            val resp = AnkiEngine.importApkg(tempFile.absolutePath)
                            "가져오기 완료: 노트 ${resp.log.foundNotes}개 처리"
                        }
                    } finally {
                        tempFile.delete()
                    }
                }
            }
            result.onSuccess { msg ->
                showStatus(msg)
                loadDecks()
            }.onFailure { err ->
                showStatus("가져오기 실패: ${err.message}")
            }
        }
    }

    private fun importCsvFromUri(uri: Uri, fileName: String) {
        showStatus("CSV 인코딩 분석 중: $fileName ...")
        uiScope.launch {
            val prepared = withContext(Dispatchers.IO) {
                runCatching {
                    val bytes = contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        ?: error("파일을 읽을 수 없습니다.")
                    val (charsetName, utf8File) = EncodingDetector.writeUtf8TempFile(this@MainActivity, bytes, fileName)
                    AnkiEngine.ensureOpen()
                    val decks = AnkiEngine.getDeckNames()
                    val notetypes = AnkiEngine.getNotetypeNames()
                    Triple(charsetName, utf8File, Pair(decks, notetypes))
                }
            }
            prepared.onFailure { err ->
                showStatus("CSV 읽기 실패: ${err.message}")
            }.onSuccess { (charsetName, utf8File, meta) ->
                val (decks, notetypes) = meta
                if (decks.isEmpty() || notetypes.isEmpty()) {
                    utf8File.delete()
                    showStatus("덱 또는 노트 유형이 없어 CSV를 가져올 수 없습니다.")
                    return@onSuccess
                }
                showCsvImportDialog(charsetName, utf8File, decks.map { it.id to it.name }, notetypes.map { it.id to it.name })
            }
        }
    }

    private fun showCsvImportDialog(
        detectedCharset: String,
        utf8File: File,
        decks: List<Pair<Long, String>>,
        notetypes: List<Pair<Long, String>>
    ) {
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val pad = UiThemeHelper.dp(this@MainActivity, 16)
            setPadding(pad, pad, pad, pad)
        }
        box.addView(UiThemeHelper.makeLabel(this, "감지된 인코딩: $detectedCharset → UTF-8 변환 완료", secondary = true))
        box.addView(UiThemeHelper.makeSectionHeader(this, "대상 덱"))
        val deckSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, decks.map { it.second })
        }
        box.addView(deckSpinner)

        box.addView(UiThemeHelper.makeSectionHeader(this, "노트 유형"))
        val ntSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, notetypes.map { it.second })
        }
        box.addView(ntSpinner)

        AlertDialog.Builder(this)
            .setTitle("CSV / TSV 가져오기")
            .setView(box)
            .setPositiveButton("가져오기") { _, _ ->
                val deckId = decks[deckSpinner.selectedItemPosition].first
                val ntId = notetypes[ntSpinner.selectedItemPosition].first
                uiScope.launch {
                    val res = withContext(Dispatchers.IO) {
                        runCatching {
                            try {
                                AnkiEngine.importCsvUtf8(utf8File.absolutePath, deckId, ntId)
                            } finally {
                                utf8File.delete()
                            }
                        }
                    }
                    res.onSuccess { resp ->
                        showStatus("CSV 가져오기 완료: ${resp.log.foundNotes}개 노트")
                        loadDecks()
                    }.onFailure { err ->
                        showStatus("CSV 가져오기 실패: ${err.message}")
                    }
                }
            }
            .setNegativeButton("취소") { _, _ ->
                utf8File.delete()
                showStatus(null)
            }
            .setOnCancelListener {
                utf8File.delete()
            }
            .show()
    }

    private fun exportDeckToUri(deckId: Long, uri: Uri) {
        showStatus("덱 내보내는 중 (.apkg)...")
        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                runCatching {
                    val tempOut = File(cacheDir, "export_${System.currentTimeMillis()}.apkg")
                    try {
                        AnkiEngine.exportApkg(tempOut.absolutePath, deckId, includeScheduling = true)
                        contentResolver.openOutputStream(uri)?.use { out ->
                            tempOut.inputStream().use { inp -> inp.copyTo(out) }
                        } ?: error("출력 파일을 열 수 없습니다.")
                    } finally {
                        tempOut.delete()
                    }
                }
            }
            res.onSuccess {
                showStatus(".apkg 내보내기 완료")
            }.onFailure { err ->
                showStatus("내보내기 실패: ${err.message}")
            }
        }
    }

    private fun checkOtaQuietly() {
        uiScope.launch(Dispatchers.IO) {
            runCatching {
                val res = OtaAssetUpdater.checkAndUpdate(this@MainActivity)
                if (res.updatedFiles.isNotEmpty()) {
                    withContext(Dispatchers.Main) {
                        showStatus("에셋 핫패치 v${res.remoteVersion} 자동 적용됨 (${res.updatedFiles.size}개 파일)")
                    }
                }
            }
        }
    }

    private inner class DeckListAdapter : RecyclerView.Adapter<DeckListAdapter.DeckHolder>() {
        private var items: List<FlatDeckRow> = emptyList()

        fun submitList(newItems: List<FlatDeckRow>) {
            items = newItems
            notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): DeckHolder {
            val p = UiThemeHelper.palette(this@MainActivity)
            val card = LinearLayout(this@MainActivity).apply {
                orientation = LinearLayout.HORIZONTAL
                gravity = Gravity.CENTER_VERTICAL
                setPadding(
                    UiThemeHelper.dp(this@MainActivity, 10),
                    UiThemeHelper.dp(this@MainActivity, if (p.isEink) 10 else 12),
                    UiThemeHelper.dp(this@MainActivity, 8),
                    UiThemeHelper.dp(this@MainActivity, if (p.isEink) 10 else 12)
                )
                background = UiThemeHelper.makeCardBackground(
                    this@MainActivity,
                    fillColor = p.surface,
                    strokeColor = p.border,
                    cornerDp = 10,
                    strokeDp = if (p.isEink) 1.5f else 1f
                )
                layoutParams = RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = UiThemeHelper.dp(this@MainActivity, if (p.isEink) 6 else 8)
                }
            }

            val toggleView = TextView(this@MainActivity).apply {
                gravity = Gravity.CENTER
                setTextColor(p.textPrimary)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                typeface = Typeface.DEFAULT_BOLD
                layoutParams = LinearLayout.LayoutParams(
                    UiThemeHelper.dp(this@MainActivity, 28),
                    UiThemeHelper.dp(this@MainActivity, 28)
                )
            }
            card.addView(toggleView)

            val nameView = TextView(this@MainActivity).apply {
                setTextColor(p.textPrimary)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                typeface = Typeface.DEFAULT_BOLD
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
                layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                    marginStart = UiThemeHelper.dp(this@MainActivity, 4)
                    marginEnd = UiThemeHelper.dp(this@MainActivity, 8)
                }
            }
            card.addView(nameView)

            val countsView = TextView(this@MainActivity).apply {
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                layoutParams = LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                )
            }
            card.addView(countsView)

            val menuBtn = UiThemeHelper.createStyledButton(
                this@MainActivity,
                "⋮",
                filled = false,
                textSizeSp = 14f,
                horizontalPadDp = 8,
                verticalPadDp = 4
            ).apply {
                contentDescription = "덱 메뉴"
            }
            card.addView(
                menuBtn,
                LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT,
                    UiThemeHelper.dp(this@MainActivity, 32)
                ).apply {
                    marginStart = UiThemeHelper.dp(this@MainActivity, 6)
                }
            )

            return DeckHolder(card, toggleView, nameView, countsView, menuBtn)
        }

        override fun getItemCount(): Int = items.size

        override fun onBindViewHolder(holder: DeckHolder, position: Int) {
            val row = items[position]
            val p = UiThemeHelper.palette(this@MainActivity)
            val indentPx = UiThemeHelper.dp(this@MainActivity, 10 + row.level * 18)
            holder.card.setPadding(
                indentPx,
                holder.card.paddingTop,
                holder.card.paddingRight,
                holder.card.paddingBottom
            )

            if (row.hasChildren) {
                holder.toggleView.visibility = View.VISIBLE
                holder.toggleView.text = if (row.collapsed) "▸" else "▾"
                holder.toggleView.setOnClickListener { toggleCollapse(row) }
            } else {
                holder.toggleView.visibility = View.INVISIBLE
                holder.toggleView.setOnClickListener(null)
            }

            holder.nameView.text = row.displayName
            holder.countsView.text = buildCountsText(row, p)

            holder.card.setOnClickListener { startStudy(row.deckId, row.fullName) }
            holder.card.setOnLongClickListener {
                showDeckMenu(holder.menuBtn, row)
                true
            }
            holder.menuBtn.setOnClickListener { showDeckMenu(holder.menuBtn, row) }
        }

        private fun buildCountsText(row: FlatDeckRow, p: UiThemeHelper.Palette): CharSequence {
            val ssb = SpannableStringBuilder()
            fun appendPart(value: Int, color: Int, prefix: String = "") {
                if (prefix.isNotEmpty()) ssb.append(prefix)
                val start = ssb.length
                ssb.append(value.toString())
                val end = ssb.length
                ssb.setSpan(ForegroundColorSpan(color), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                if (value > 0) {
                    ssb.setSpan(StyleSpan(Typeface.BOLD), start, end, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
                }
            }
            appendPart(row.newCount, p.newCountColor)
            appendPart(row.learnCount, p.learnCountColor, "  ")
            appendPart(row.reviewCount, p.reviewCountColor, "  ")
            return ssb
        }

        inner class DeckHolder(
            val card: LinearLayout,
            val toggleView: TextView,
            val nameView: TextView,
            val countsView: TextView,
            val menuBtn: Button
        ) : RecyclerView.ViewHolder(card)
    }
}
