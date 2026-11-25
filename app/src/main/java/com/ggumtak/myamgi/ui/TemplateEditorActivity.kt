package com.ggumtak.myamgi.ui

import android.annotation.SuppressLint
import android.os.Bundle
import android.view.View
import android.view.ViewGroup
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Spinner
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import anki.notetypes.Notetype
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.update.AssetLoader
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class TemplateEditorActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_NOTETYPE_ID = "extra_notetype_id"
        private const val STREAM_CHUNK_SIZE = 16 * 1024
        private const val TAB_FRONT = 0
        private const val TAB_BACK = 1
        private const val TAB_CSS = 2
    }

    private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private lateinit var notetypeSpinner: Spinner
    private lateinit var templateSpinner: Spinner
    private lateinit var tabFrontBtn: Button
    private lateinit var tabBackBtn: Button
    private lateinit var tabCssBtn: Button
    private lateinit var webView: WebView

    private var notetypes: List<Pair<Long, String>> = emptyList()
    private var currentNotetype: Notetype? = null
    private var currentOrd: Int = 0
    private var currentTab: Int = TAB_FRONT
    private var editorReady: Boolean = false
    private var initialNotetypeId: Long = 0L

    private val saveBuffer = StringBuilder()

    override fun onCreate(savedInstanceState: Bundle?) {
        UiThemeHelper.applyActivityTheme(this)
        super.onCreate(savedInstanceState)
        initialNotetypeId = intent.getLongExtra(EXTRA_NOTETYPE_ID, 0L)

        buildLayout()
        loadHtmlAndNotetypes()
    }

    override fun onDestroy() {
        super.onDestroy()
        webView.destroy()
        uiScope.cancel()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun buildLayout() {
        val p = UiThemeHelper.palette(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.background)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }

        val (topBar, _, actionsRow) = UiThemeHelper.createTopBar(this, "템플릿 / CSS 편집기", showBack = true)
        UiThemeHelper.addTopBarButton(this, actionsRow, "저장", filled = true) {
            webView.evaluateJavascript("window.__editorTriggerSave && window.__editorTriggerSave()", null)
        }
        root.addView(topBar)

        val controlsBar = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.surface)
            val pad = UiThemeHelper.dp(this@TemplateEditorActivity, 8)
            setPadding(pad, pad, pad, pad)
        }

        val selectorsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        notetypeSpinner = Spinner(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        templateSpinner = Spinner(this).apply {
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                marginStart = UiThemeHelper.dp(this@TemplateEditorActivity, 6)
            }
        }
        selectorsRow.addView(notetypeSpinner)
        selectorsRow.addView(templateSpinner)
        controlsBar.addView(selectorsRow)

        val tabsRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = UiThemeHelper.dp(this@TemplateEditorActivity, 6)
            }
        }
        tabFrontBtn = UiThemeHelper.createStyledButton(this, "앞면 템플릿", filled = true, textSizeSp = 12f).apply {
            setOnClickListener { switchTab(TAB_FRONT) }
        }
        tabBackBtn = UiThemeHelper.createStyledButton(this, "뒷면 템플릿", filled = false, textSizeSp = 12f).apply {
            setOnClickListener { switchTab(TAB_BACK) }
        }
        tabCssBtn = UiThemeHelper.createStyledButton(this, "스타일 CSS", filled = false, textSizeSp = 12f).apply {
            setOnClickListener { switchTab(TAB_CSS) }
        }
        listOf(tabFrontBtn, tabBackBtn, tabCssBtn).forEachIndexed { idx, btn ->
            val lp = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (idx > 0) marginStart = UiThemeHelper.dp(this@TemplateEditorActivity, 6)
            }
            tabsRow.addView(btn, lp)
        }
        controlsBar.addView(tabsRow)
        root.addView(controlsBar)
        root.addView(UiThemeHelper.makeDivider(this))

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            addJavascriptInterface(EditorBridge(), "EditorBridge")
            webChromeClient = WebChromeClient()
            webViewClient = object : WebViewClient() {
                override fun onPageFinished(view: WebView?, url: String?) {
                    editorReady = true
                    streamActiveTextToEditor()
                }
            }
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        root.addView(webView)
        setContentView(root)
    }

    private fun updateTabButtonStyles() {
        UiThemeHelper.styleButton(tabFrontBtn, this, filled = currentTab == TAB_FRONT)
        UiThemeHelper.styleButton(tabBackBtn, this, filled = currentTab == TAB_BACK)
        UiThemeHelper.styleButton(tabCssBtn, this, filled = currentTab == TAB_CSS)
    }

    private fun switchTab(tab: Int) {
        currentTab = tab
        templateSpinner.isEnabled = (tab != TAB_CSS)
        updateTabButtonStyles()
        streamActiveTextToEditor()
    }

    private fun loadHtmlAndNotetypes() {
        uiScope.launch {
            val (html, ntPairs) = withContext(Dispatchers.IO) {
                val rawHtml = AssetLoader.readText(this@TemplateEditorActivity, "editor/large-editor.html")
                AnkiEngine.ensureOpen()
                val nts = AnkiEngine.getNotetypeNames().map { it.id to it.name }
                rawHtml to nts
            }

            notetypes = ntPairs
            notetypeSpinner.adapter = ArrayAdapter(this@TemplateEditorActivity, android.R.layout.simple_spinner_dropdown_item, notetypes.map { it.second })
            if (initialNotetypeId > 0) {
                val idx = notetypes.indexOfFirst { it.first == initialNotetypeId }
                if (idx >= 0) notetypeSpinner.setSelection(idx)
            }
            notetypeSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    val ntId = notetypes.getOrNull(position)?.first ?: return
                    loadNotetype(ntId)
                }

                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            }

            val isEink = UiThemeHelper.isEinkActive(this@TemplateEditorActivity)
            val isDark = UiThemeHelper.isDarkActive(this@TemplateEditorActivity)
            val baseUrl = "https://appassets.androidplatform.net/editor/large-editor.html?eink=${if (isEink) 1 else 0}&dark=${if (isDark) 1 else 0}"
            webView.loadDataWithBaseURL(baseUrl, html, "text/html", "UTF-8", null)

            val firstNt = if (initialNotetypeId > 0) initialNotetypeId else notetypes.firstOrNull()?.first
            if (firstNt != null) {
                loadNotetype(firstNt)
            }
        }
    }

    private fun loadNotetype(notetypeId: Long) {
        uiScope.launch {
            val nt = withContext(Dispatchers.IO) {
                runCatching { AnkiEngine.getNotetype(notetypeId) }.getOrNull()
            } ?: return@launch
            currentNotetype = nt
            currentOrd = 0
            val tplNames = nt.templatesList.mapIndexed { idx, t -> "${idx + 1}: ${t.name}" }
            templateSpinner.adapter = ArrayAdapter(this@TemplateEditorActivity, android.R.layout.simple_spinner_dropdown_item, tplNames)
            templateSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    currentOrd = position
                    streamActiveTextToEditor()
                }

                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            }
            streamActiveTextToEditor()
        }
    }

    private fun streamActiveTextToEditor() {
        val nt = currentNotetype ?: return
        if (!editorReady) return

        val text = when (currentTab) {
            TAB_FRONT -> nt.templatesList.getOrNull(currentOrd)?.config?.qFormat.orEmpty()
            TAB_BACK -> nt.templatesList.getOrNull(currentOrd)?.config?.aFormat.orEmpty()
            else -> nt.config.css
        }
        val title = when (currentTab) {
            TAB_FRONT -> "${nt.name} · 앞면"
            TAB_BACK -> "${nt.name} · 뒷면"
            else -> "${nt.name} · CSS"
        }

        val metaJson = JSONObject().apply {
            put("title", title)
            put("eink", UiThemeHelper.isEinkActive(this@TemplateEditorActivity))
            put("dark", UiThemeHelper.isDarkActive(this@TemplateEditorActivity))
            put("readOnly", false)
        }.toString()

        webView.evaluateJavascript("window.__editorReset($metaJson);", null)
        var offset = 0
        while (offset < text.length) {
            val end = minOf(offset + STREAM_CHUNK_SIZE, text.length)
            val chunkLiteral = JSONObject.quote(text.substring(offset, end))
            webView.evaluateJavascript("window.__editorAppendChunk($chunkLiteral);", null)
            offset = end
        }
        webView.evaluateJavascript("window.__editorReady();", null)
    }

    @Suppress("unused")
    private inner class EditorBridge {
        @JavascriptInterface
        fun onDirtyChanged(dirty: Boolean) {
            // Optional dirty state indicator
        }

        @JavascriptInterface
        fun beginSave() {
            synchronized(saveBuffer) {
                saveBuffer.setLength(0)
            }
        }

        @JavascriptInterface
        fun appendSaveChunk(chunk: String) {
            synchronized(saveBuffer) {
                saveBuffer.append(chunk)
            }
        }

        @JavascriptInterface
        fun commitSave() {
            val finalContent = synchronized(saveBuffer) {
                val str = saveBuffer.toString()
                saveBuffer.setLength(0)
                str
            }
            val nt = currentNotetype ?: return
            val ntId = nt.id
            val ord = currentOrd
            val tab = currentTab

            uiScope.launch {
                val res = withContext(Dispatchers.IO) {
                    runCatching {
                        when (tab) {
                            TAB_FRONT -> AnkiEngine.updateNotetypeTemplate(ntId, ord, questionFormat = finalContent)
                            TAB_BACK -> AnkiEngine.updateNotetypeTemplate(ntId, ord, answerFormat = finalContent)
                            else -> AnkiEngine.updateNotetypeCss(ntId, finalContent)
                        }
                        AnkiEngine.getNotetype(ntId)
                    }
                }
                res.onSuccess { updated ->
                    currentNotetype = updated
                    Toast.makeText(this@TemplateEditorActivity, "저장됨 (${finalContent.length}자)", Toast.LENGTH_SHORT).show()
                }.onFailure { err ->
                    Toast.makeText(this@TemplateEditorActivity, "저장 실패: ${err.message}", Toast.LENGTH_LONG).show()
                }
            }
        }
    }
}
