package com.ggumtak.myamgi.ui

import android.app.AlertDialog
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.TextUtils
import android.util.TypedValue
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.engine.AnkiEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class CardBrowserActivity : AppCompatActivity() {

    data class NoteSummaryRow(
        val noteId: Long,
        val firstCardId: Long,
        val preview: String,
        val tags: String
    )

    private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private lateinit var searchInput: EditText
    private lateinit var countLabel: TextView
    private lateinit var recyclerView: RecyclerView
    private val adapter = BrowserAdapter()

    override fun onCreate(savedInstanceState: Bundle?) {
        UiThemeHelper.applyActivityTheme(this)
        super.onCreate(savedInstanceState)

        buildLayout()
        runSearch("")
    }

    override fun onResume() {
        super.onResume()
        runSearch(searchInput.text.toString())
    }

    override fun onDestroy() {
        super.onDestroy()
        uiScope.cancel()
    }

    private fun buildLayout() {
        val p = UiThemeHelper.palette(this)
        val profile = DeviceProfile.current(this)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.background)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }

        val (topBar, _, _) = UiThemeHelper.createTopBar(this, "카드 검색", showBack = true)
        root.addView(topBar)

        val searchBar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            setBackgroundColor(p.surface)
            val pad = UiThemeHelper.dp(this@CardBrowserActivity, 8)
            setPadding(pad, pad, pad, pad)
        }
        searchInput = UiThemeHelper.makeInputBox(this, "Anki 검색식 (예: deck:일본어 tag:n1)").apply {
            imeOptions = EditorInfo.IME_ACTION_SEARCH
            setSingleLine(true)
            setOnEditorActionListener { _, actionId, event ->
                if (actionId == EditorInfo.IME_ACTION_SEARCH || event?.keyCode == KeyEvent.KEYCODE_ENTER) {
                    runSearch(text.toString())
                    true
                } else false
            }
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        searchBar.addView(searchInput)

        val searchBtn = UiThemeHelper.createStyledButton(this, "검색", filled = true, textSizeSp = 13f).apply {
            setOnClickListener { runSearch(searchInput.text.toString()) }
        }
        searchBar.addView(
            searchBtn,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                marginStart = UiThemeHelper.dp(this@CardBrowserActivity, 6)
            }
        )
        root.addView(searchBar)

        countLabel = UiThemeHelper.makeLabel(this, "검색 중...", secondary = true, sizeSp = 12f).apply {
            setPadding(UiThemeHelper.dp(this@CardBrowserActivity, 12), UiThemeHelper.dp(this@CardBrowserActivity, 6), UiThemeHelper.dp(this@CardBrowserActivity, 12), UiThemeHelper.dp(this@CardBrowserActivity, 4))
        }
        root.addView(countLabel)

        recyclerView = RecyclerView(this).apply {
            layoutManager = LinearLayoutManager(this@CardBrowserActivity)
            adapter = this@CardBrowserActivity.adapter
            itemAnimator = if (profile.enableAnimations && !p.isEink) itemAnimator else null
            val pad = UiThemeHelper.dp(this@CardBrowserActivity, 10)
            setPadding(pad, UiThemeHelper.dp(this@CardBrowserActivity, 4), pad, pad)
            clipToPadding = false
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        root.addView(recyclerView)
        setContentView(root)
    }

    private fun runSearch(query: String) {
        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                runCatching {
                    AnkiEngine.ensureOpen()
                    val noteIds = AnkiEngine.searchNotes(query.trim())
                    val limited = noteIds.take(300)
                    val rows = limited.mapNotNull { nid ->
                        runCatching {
                            val note = AnkiEngine.getNote(nid)
                            val firstCardId = AnkiEngine.cardsOfNote(nid).firstOrNull() ?: 0L
                            val rawFirst = note.fieldsList.firstOrNull().orEmpty()
                            val cleanPreview = rawFirst.replace(Regex("<[^>]*>"), " ").replace(Regex("\\s+"), " ").trim()
                                .ifBlank { "(빈 필드)" }
                            NoteSummaryRow(
                                noteId = nid,
                                firstCardId = firstCardId,
                                preview = cleanPreview,
                                tags = note.tagsList.joinToString(" ")
                            )
                        }.getOrNull()
                    }
                    noteIds.size to rows
                }
            }
            res.onFailure { err ->
                countLabel.text = "검색 오류: ${err.message}"
            }.onSuccess { (total, rows) ->
                countLabel.text = if (total > rows.size) "총 ${total}개 중 상위 ${rows.size}개 표시" else "검색 결과: ${total}개"
                adapter.submitList(rows)
            }
        }
    }

    private fun showNoteActions(row: NoteSummaryRow) {
        val options = arrayOf("노트 편집", "일시중단 (Suspend)", "카드 정보 (SvelteKit)", "노트 삭제")
        AlertDialog.Builder(this)
            .setTitle(row.preview.take(40))
            .setItems(options) { _, which ->
                when (which) {
                    0 -> openNoteEditor(row.noteId)
                    1 -> suspendNoteCards(row.noteId)
                    2 -> {
                        if (row.firstCardId > 0) {
                            AnkiPageActivity.start(this, "/card-info/${row.firstCardId}", "카드 정보")
                        } else {
                            Toast.makeText(this, "연결된 카드가 없습니다.", Toast.LENGTH_SHORT).show()
                        }
                    }
                    3 -> confirmDeleteNote(row)
                }
            }
            .show()
    }

    private fun openNoteEditor(noteId: Long) {
        startActivity(Intent(this, NoteEditorActivity::class.java).putExtra(NoteEditorActivity.EXTRA_NOTE_ID, noteId))
        UiThemeHelper.disableExitAnimationIfEink(this)
    }

    private fun suspendNoteCards(noteId: Long) {
        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                runCatching {
                    val cardIds = AnkiEngine.cardsOfNote(noteId)
                    if (cardIds.isNotEmpty()) AnkiEngine.suspendCards(cardIds)
                    cardIds.size
                }
            }
            res.onSuccess { cnt ->
                Toast.makeText(this@CardBrowserActivity, "카드 ${cnt}장을 일시중단했습니다.", Toast.LENGTH_SHORT).show()
            }.onFailure { err ->
                Toast.makeText(this@CardBrowserActivity, "일시중단 실패: ${err.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun confirmDeleteNote(row: NoteSummaryRow) {
        AlertDialog.Builder(this)
            .setTitle("노트 삭제")
            .setMessage("'${row.preview.take(40)}' 노트를 삭제할까요?")
            .setPositiveButton("삭제") { _, _ ->
                uiScope.launch {
                    withContext(Dispatchers.IO) { runCatching { AnkiEngine.removeNotes(listOf(row.noteId)) } }
                    runSearch(searchInput.text.toString())
                }
            }
            .setNegativeButton("취소", null)
            .show()
    }

    private inner class BrowserAdapter : RecyclerView.Adapter<BrowserAdapter.Holder>() {
        private var items: List<NoteSummaryRow> = emptyList()

        fun submitList(newItems: List<NoteSummaryRow>) {
            items = newItems
            notifyDataSetChanged()
        }

        override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): Holder {
            val p = UiThemeHelper.palette(this@CardBrowserActivity)
            val card = LinearLayout(this@CardBrowserActivity).apply {
                orientation = LinearLayout.VERTICAL
                val pad = UiThemeHelper.dp(this@CardBrowserActivity, 12)
                setPadding(pad, pad, pad, pad)
                background = UiThemeHelper.makeCardBackground(
                    this@CardBrowserActivity,
                    fillColor = p.surface,
                    strokeColor = p.border,
                    cornerDp = 8,
                    strokeDp = if (p.isEink) 1.5f else 1f
                )
                layoutParams = RecyclerView.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.WRAP_CONTENT
                ).apply {
                    bottomMargin = UiThemeHelper.dp(this@CardBrowserActivity, 6)
                }
            }
            val title = TextView(this@CardBrowserActivity).apply {
                setTextColor(p.textPrimary)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
                typeface = Typeface.DEFAULT_BOLD
                maxLines = 2
                ellipsize = TextUtils.TruncateAt.END
            }
            val tags = TextView(this@CardBrowserActivity).apply {
                setTextColor(p.textSecondary)
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                maxLines = 1
                ellipsize = TextUtils.TruncateAt.END
            }
            card.addView(title)
            card.addView(tags)
            return Holder(card, title, tags)
        }

        override fun getItemCount(): Int = items.size

        override fun onBindViewHolder(holder: Holder, position: Int) {
            val row = items[position]
            holder.title.text = row.preview
            if (row.tags.isBlank()) {
                holder.tags.visibility = View.GONE
            } else {
                holder.tags.visibility = View.VISIBLE
                holder.tags.text = "# ${row.tags}"
            }
            holder.card.setOnClickListener { openNoteEditor(row.noteId) }
            holder.card.setOnLongClickListener {
                showNoteActions(row)
                true
            }
        }

        inner class Holder(
            val card: LinearLayout,
            val title: TextView,
            val tags: TextView
        ) : RecyclerView.ViewHolder(card)
    }
}
