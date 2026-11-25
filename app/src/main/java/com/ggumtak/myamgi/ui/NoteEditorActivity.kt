package com.ggumtak.myamgi.ui

import android.content.Intent
import android.os.Bundle
import android.text.InputType
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.ggumtak.myamgi.engine.AnkiEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class NoteEditorActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_NOTE_ID = "extra_note_id"
        const val EXTRA_DECK_ID = "extra_deck_id"
    }

    private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private var noteId: Long = 0L
    private var initialDeckId: Long = 0L

    private lateinit var deckSpinner: Spinner
    private lateinit var notetypeSpinner: Spinner
    private lateinit var notetypeSection: LinearLayout
    private lateinit var fieldsContainer: LinearLayout
    private lateinit var tagsInput: EditText

    private var decks: List<Pair<Long, String>> = emptyList()
    private var notetypes: List<Pair<Long, String>> = emptyList()
    private val fieldInputs = mutableListOf<EditText>()
    private var editingNotetypeId: Long = 0L

    override fun onCreate(savedInstanceState: Bundle?) {
        UiThemeHelper.applyActivityTheme(this)
        super.onCreate(savedInstanceState)

        noteId = intent.getLongExtra(EXTRA_NOTE_ID, 0L)
        initialDeckId = intent.getLongExtra(EXTRA_DECK_ID, 0L)

        buildLayout()
        loadInitialData()
    }

    override fun onDestroy() {
        super.onDestroy()
        uiScope.cancel()
    }

    private fun buildLayout() {
        val p = UiThemeHelper.palette(this)
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.background)
            layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }

        val (topBar, _, actionsRow) = UiThemeHelper.createTopBar(
            this,
            if (noteId > 0) "노트 편집" else "노트 추가",
            showBack = true
        )
        UiThemeHelper.addTopBarButton(this, actionsRow, "저장", filled = true) { saveNote() }
        root.addView(topBar)

        val scroll = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val pad = UiThemeHelper.dp(this@NoteEditorActivity, 14)
            setPadding(pad, pad, pad, pad)
        }

        body.addView(UiThemeHelper.makeSectionHeader(this, "덱"))
        deckSpinner = Spinner(this)
        body.addView(deckSpinner)

        notetypeSection = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        notetypeSection.addView(UiThemeHelper.makeSectionHeader(this, "노트 유형"))
        notetypeSpinner = Spinner(this)
        notetypeSection.addView(notetypeSpinner)
        body.addView(notetypeSection)

        body.addView(UiThemeHelper.makeSectionHeader(this, "필드"))
        fieldsContainer = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
        }
        body.addView(fieldsContainer)

        body.addView(UiThemeHelper.makeSectionHeader(this, "태그 (공백으로 구분)"))
        tagsInput = UiThemeHelper.makeInputBox(this, "예: jlpt n1 동사")
        body.addView(tagsInput)

        val templateBtn = UiThemeHelper.createStyledButton(this, "템플릿 / CSS 편집 (100만자 지원)", filled = false).apply {
            setOnClickListener {
                val ntId = if (noteId > 0) editingNotetypeId else notetypes.getOrNull(notetypeSpinner.selectedItemPosition)?.first ?: 0L
                val intent = Intent(this@NoteEditorActivity, TemplateEditorActivity::class.java).apply {
                    if (ntId > 0) putExtra(TemplateEditorActivity.EXTRA_NOTETYPE_ID, ntId)
                }
                startActivity(intent)
                UiThemeHelper.disableExitAnimationIfEink(this@NoteEditorActivity)
            }
        }
        body.addView(
            templateBtn,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = UiThemeHelper.dp(this@NoteEditorActivity, 14)
            }
        )

        scroll.addView(body)
        root.addView(scroll)
        setContentView(root)
    }

    private fun loadInitialData() {
        uiScope.launch {
            val loaded = withContext(Dispatchers.IO) {
                runCatching {
                    AnkiEngine.ensureOpen()
                    val deckPairs = AnkiEngine.getDeckNames().map { it.id to it.name }
                    val ntPairs = AnkiEngine.getNotetypeNames().map { it.id to it.name }
                    if (noteId > 0) {
                        val note = AnkiEngine.getNote(noteId)
                        val nt = AnkiEngine.getNotetype(note.notetypeId)
                        val fieldNames = nt.fieldsList.map { it.name }
                        Triple(deckPairs, ntPairs, Triple(note, fieldNames, note.notetypeId))
                    } else {
                        Triple(deckPairs, ntPairs, null)
                    }
                }
            }

            loaded.onFailure { err ->
                Toast.makeText(this@NoteEditorActivity, "노트 불러오기 오류: ${err.message}", Toast.LENGTH_LONG).show()
            }.onSuccess { (deckPairs, ntPairs, existing) ->
                decks = deckPairs
                notetypes = ntPairs
                deckSpinner.adapter = ArrayAdapter(this@NoteEditorActivity, android.R.layout.simple_spinner_dropdown_item, decks.map { it.second })
                if (initialDeckId > 0) {
                    val idx = decks.indexOfFirst { it.first == initialDeckId }
                    if (idx >= 0) deckSpinner.setSelection(idx)
                }

                if (existing != null) {
                    val (note, fieldNames, ntId) = existing
                    editingNotetypeId = ntId
                    notetypeSection.visibility = View.GONE
                    rebuildFieldInputs(fieldNames, note.fieldsList)
                    tagsInput.setText(note.tagsList.joinToString(" "))
                } else {
                    notetypeSection.visibility = View.VISIBLE
                    notetypeSpinner.adapter = ArrayAdapter(this@NoteEditorActivity, android.R.layout.simple_spinner_dropdown_item, notetypes.map { it.second })
                    notetypeSpinner.onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                        override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                            val ntId = notetypes.getOrNull(position)?.first ?: return
                            loadNotetypeFields(ntId)
                        }

                        override fun onNothingSelected(parent: AdapterView<*>?) = Unit
                    }
                    notetypes.firstOrNull()?.let { loadNotetypeFields(it.first) }
                }
            }
        }
    }

    private fun loadNotetypeFields(notetypeId: Long) {
        uiScope.launch {
            val fieldNames = withContext(Dispatchers.IO) {
                runCatching { AnkiEngine.getNotetype(notetypeId).fieldsList.map { it.name } }.getOrDefault(emptyList())
            }
            rebuildFieldInputs(fieldNames, emptyList())
        }
    }

    private fun rebuildFieldInputs(fieldNames: List<String>, existingValues: List<String>) {
        fieldsContainer.removeAllViews()
        fieldInputs.clear()
        fieldNames.forEachIndexed { idx, fname ->
            fieldsContainer.addView(UiThemeHelper.makeLabel(this, fname, secondary = true).apply {
                setPadding(0, UiThemeHelper.dp(this@NoteEditorActivity, 8), 0, UiThemeHelper.dp(this@NoteEditorActivity, 4))
            })
            val input = UiThemeHelper.makeInputBox(this, fname).apply {
                inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_FLAG_MULTI_LINE
                minLines = 2
                maxLines = 8
                setText(existingValues.getOrNull(idx).orEmpty())
            }
            fieldInputs.add(input)
            fieldsContainer.addView(input)
        }
    }

    private fun saveNote() {
        val fields = fieldInputs.map { it.text.toString() }
        if (fields.all { it.isBlank() }) {
            Toast.makeText(this, "최소 하나의 필드를 입력해 주세요.", Toast.LENGTH_SHORT).show()
            return
        }
        val tags = tagsInput.text.toString().trim().split(Regex("\\s+")).filter { it.isNotBlank() }
        val deckId = decks.getOrNull(deckSpinner.selectedItemPosition)?.first ?: 1L
        val ntId = notetypes.getOrNull(notetypeSpinner.selectedItemPosition)?.first ?: editingNotetypeId

        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                runCatching {
                    if (noteId > 0) {
                        AnkiEngine.updateNote(noteId, fields, tags)
                    } else {
                        AnkiEngine.addNote(ntId, deckId, fields, tags)
                    }
                }
            }
            res.onSuccess {
                Toast.makeText(this@NoteEditorActivity, "노트를 저장했습니다.", Toast.LENGTH_SHORT).show()
                finish()
                UiThemeHelper.disableExitAnimationIfEink(this@NoteEditorActivity)
            }.onFailure { err ->
                Toast.makeText(this@NoteEditorActivity, "저장 실패: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
}
