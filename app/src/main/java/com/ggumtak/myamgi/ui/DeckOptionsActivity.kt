package com.ggumtak.myamgi.ui

import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.ViewGroup
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.ggumtak.myamgi.engine.AnkiEngine
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

class DeckOptionsActivity : AppCompatActivity() {

    companion object {
        const val EXTRA_DECK_ID = "extra_deck_id"
        const val EXTRA_DECK_NAME = "extra_deck_name"
    }

    private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private var deckId: Long = 1L
    private var deckName: String = "기본 덱"

    private lateinit var newPerDayInput: EditText
    private lateinit var reviewsPerDayInput: EditText
    private lateinit var learnStepsInput: EditText
    private lateinit var relearnStepsInput: EditText
    private lateinit var fsrsCheck: CheckBox
    private lateinit var retentionSlider: SeekBar
    private lateinit var retentionDescView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        UiThemeHelper.applyActivityTheme(this)
        super.onCreate(savedInstanceState)

        deckId = intent.getLongExtra(EXTRA_DECK_ID, 1L)
        deckName = intent.getStringExtra(EXTRA_DECK_NAME) ?: "덱 옵션"

        buildLayout()
        loadDeckOptions()
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

        val (topBar, _, actionsRow) = UiThemeHelper.createTopBar(this, "덱 옵션 · $deckName", showBack = true)
        UiThemeHelper.addTopBarButton(this, actionsRow, "저장", filled = true) { saveOptions() }
        root.addView(topBar)

        val scroll = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val pad = UiThemeHelper.dp(this@DeckOptionsActivity, 14)
            setPadding(pad, pad, pad, pad)
        }

        body.addView(UiThemeHelper.makeSectionHeader(this, "추천 프리셋 (원클릭 적용)"))
        val presetRow = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT)
        }
        val pLang = UiThemeHelper.createStyledButton(this, "어학/일본어 추천", filled = false, textSizeSp = 12f).apply {
            setOnClickListener { applyPreset(20, 200, "1m 10m", "10m", true, 90) }
        }
        val pExam = UiThemeHelper.createStyledButton(this, "시험 집중 모드", filled = false, textSizeSp = 12f).apply {
            setOnClickListener { applyPreset(40, 400, "1m 10m", "10m", true, 93) }
        }
        val pLight = UiThemeHelper.createStyledButton(this, "가볍게 유지", filled = false, textSizeSp = 12f).apply {
            setOnClickListener { applyPreset(10, 100, "10m", "10m", true, 85) }
        }
        listOf(pLang, pExam, pLight).forEachIndexed { idx, btn ->
            presetRow.addView(btn, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
                if (idx > 0) marginStart = UiThemeHelper.dp(this@DeckOptionsActivity, 6)
            })
        }
        body.addView(presetRow)

        body.addView(UiThemeHelper.makeSectionHeader(this, "하루 새 카드 수"))
        body.addView(UiThemeHelper.makeLabel(this, "매일 새로 배울 카드 개수입니다. (보통 10~30개 추천)", secondary = true))
        newPerDayInput = UiThemeHelper.makeInputBox(this, "20").apply {
            inputType = InputType.TYPE_CLASS_NUMBER
        }
        body.addView(newPerDayInput, fieldMargin())

        body.addView(UiThemeHelper.makeSectionHeader(this, "하루 최대 복습 수"))
        body.addView(UiThemeHelper.makeLabel(this, "복습 밀림을 막으려면 새 카드의 10배 정도(예: 200)로 두세요.", secondary = true))
        reviewsPerDayInput = UiThemeHelper.makeInputBox(this, "200").apply {
            inputType = InputType.TYPE_CLASS_NUMBER
        }
        body.addView(reviewsPerDayInput, fieldMargin())

        body.addView(UiThemeHelper.makeSectionHeader(this, "학습 단계 (Learning Steps)"))
        body.addView(UiThemeHelper.makeLabel(this, "새 카드를 처음 외울 때의 짧은 간격입니다. (예: 1m 10m 또는 1 10)", secondary = true))
        learnStepsInput = UiThemeHelper.makeInputBox(this, "1m 10m")
        body.addView(learnStepsInput, fieldMargin())

        body.addView(UiThemeHelper.makeSectionHeader(this, "재학습 단계 (Relearning Steps)"))
        body.addView(UiThemeHelper.makeLabel(this, "복습 카드를 틀렸을 때 다시 확인하는 간격입니다. (예: 10m)", secondary = true))
        relearnStepsInput = UiThemeHelper.makeInputBox(this, "10m")
        body.addView(relearnStepsInput, fieldMargin())

        body.addView(UiThemeHelper.makeSectionHeader(this, "FSRS 차세대 AI 스케줄링"))
        fsrsCheck = CheckBox(this).apply {
            text = "FSRS 켜기 (기억 곡선을 분석해 복습량을 20~30% 줄여줍니다)"
            setTextColor(p.textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
        }
        body.addView(fsrsCheck)

        body.addView(UiThemeHelper.makeSectionHeader(this, "FSRS 목표 기억률 (Target Retention)"))
        retentionDescView = UiThemeHelper.makeLabel(this, "90%: 가장 균형 잡힌 기억률과 복습량", secondary = false, sizeSp = 14f)
        body.addView(retentionDescView)

        retentionSlider = SeekBar(this).apply {
            max = 27 // 70% .. 97%
            progress = 20 // 90%
            setOnSeekBarChangeListener(object : SeekBar.OnSeekBarChangeListener {
                override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) {
                    updateRetentionLabel(70 + progress)
                }

                override fun onStartTrackingTouch(seekBar: SeekBar?) = Unit
                override fun onStopTrackingTouch(seekBar: SeekBar?) = Unit
            })
        }
        body.addView(retentionSlider, fieldMargin())

        val svelteBtn = UiThemeHelper.createStyledButton(
            this,
            "고급 Anki 설정 / FSRS 최적화 열기 (공식 SvelteKit)",
            filled = true,
            verticalPadDp = 12
        ).apply {
            setOnClickListener {
                AnkiPageActivity.start(this@DeckOptionsActivity, "/deck-options/$deckId", "고급 덱 설정 / FSRS")
            }
        }
        body.addView(
            svelteBtn,
            LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                topMargin = UiThemeHelper.dp(this@DeckOptionsActivity, 16)
            }
        )

        scroll.addView(body)
        root.addView(scroll)
        setContentView(root)
    }

    private fun fieldMargin(): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = UiThemeHelper.dp(this@DeckOptionsActivity, 6)
            bottomMargin = UiThemeHelper.dp(this@DeckOptionsActivity, 8)
        }
    }

    private fun updateRetentionLabel(pct: Int) {
        val hint = when {
            pct <= 82 -> "복습량이 매우 적지만 가끔 잊을 수 있습니다"
            pct in 83..87 -> "부담 없이 가볍게 유지하기 좋습니다"
            pct in 88..91 -> "가장 균형 잡힌 기억률과 복습량 (권장)"
            pct in 92..94 -> "시험 대비로 높은 암기율을 유지합니다"
            else -> "거의 잊지 않지만 하루 복습량이 크게 늘어납니다"
        }
        retentionDescView.text = "$pct%: $hint"
    }

    private fun applyPreset(
        newDay: Int,
        revDay: Int,
        learn: String,
        relearn: String,
        fsrs: Boolean,
        retentionPct: Int
    ) {
        newPerDayInput.setText(newDay.toString())
        reviewsPerDayInput.setText(revDay.toString())
        learnStepsInput.setText(learn)
        relearnStepsInput.setText(relearn)
        fsrsCheck.isChecked = fsrs
        retentionSlider.progress = (retentionPct - 70).coerceIn(0, 27)
        updateRetentionLabel(retentionPct)
        Toast.makeText(this, "프리셋 값을 채웠습니다. '저장'을 눌러 반영하세요.", Toast.LENGTH_SHORT).show()
    }

    private fun loadDeckOptions() {
        uiScope.launch {
            val loaded = withContext(Dispatchers.IO) {
                runCatching {
                    AnkiEngine.ensureOpen()
                    val state = AnkiEngine.getDeckConfigsForUpdate(deckId)
                    val targetId = state.currentDeck.configId
                    val active = state.allConfigList.firstOrNull { it.config.id == targetId }?.config
                        ?: state.allConfigList.first().config
                    state.fsrs to active
                }
            }
            loaded.onFailure { err ->
                Toast.makeText(this@DeckOptionsActivity, "덱 설정 불러오기 오류: ${err.message}", Toast.LENGTH_LONG).show()
            }.onSuccess { (fsrs, active) ->
                val cfg = active.config
                newPerDayInput.setText(cfg.newPerDay.toString())
                reviewsPerDayInput.setText(cfg.reviewsPerDay.toString())
                learnStepsInput.setText(formatSteps(cfg.learnStepsList))
                relearnStepsInput.setText(formatSteps(cfg.relearnStepsList))
                fsrsCheck.isChecked = fsrs
                val pct = (cfg.desiredRetention * 100f).roundToInt().coerceIn(70, 97)
                retentionSlider.progress = pct - 70
                updateRetentionLabel(pct)
            }
        }
    }

    private fun formatSteps(steps: List<Float>): String {
        if (steps.isEmpty()) return "10m"
        return steps.joinToString(" ") { m ->
            if (m >= 1440f && m % 1440f == 0f) "${(m / 1440f).toInt()}d"
            else if (m >= 60f && m % 60f == 0f) "${(m / 60f).toInt()}h"
            else if (m % 1f == 0f) "${m.toInt()}m"
            else "${m}m"
        }
    }

    private fun parseSteps(text: String): List<Float> {
        val tokens = text.trim().split(Regex("[\\s,]+")).filter { it.isNotBlank() }
        val out = mutableListOf<Float>()
        for (tok in tokens) {
            val lower = tok.lowercase()
            val value = when {
                lower.endsWith("d") -> lower.dropLast(1).toFloatOrNull()?.times(1440f)
                lower.endsWith("h") -> lower.dropLast(1).toFloatOrNull()?.times(60f)
                lower.endsWith("m") -> lower.dropLast(1).toFloatOrNull()
                lower.endsWith("s") -> lower.dropLast(1).toFloatOrNull()?.div(60f)
                else -> lower.toFloatOrNull()
            }
            if (value != null && value > 0f) out.add(value)
        }
        return if (out.isEmpty()) listOf(10f) else out
    }

    private fun saveOptions() {
        val newPerDay = newPerDayInput.text.toString().toIntOrNull()?.coerceIn(0, 9999) ?: 20
        val reviewsPerDay = reviewsPerDayInput.text.toString().toIntOrNull()?.coerceIn(0, 9999) ?: 200
        val learnSteps = parseSteps(learnStepsInput.text.toString())
        val relearnSteps = parseSteps(relearnStepsInput.text.toString())
        val fsrs = fsrsCheck.isChecked
        val retention = ((70 + retentionSlider.progress).coerceIn(70, 97)) / 100f

        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                runCatching {
                    AnkiEngine.updateSimpleDeckOptions(
                        deckId = deckId,
                        newPerDay = newPerDay,
                        reviewsPerDay = reviewsPerDay,
                        learnSteps = learnSteps,
                        relearnSteps = relearnSteps,
                        desiredRetention = retention,
                        fsrsEnabled = fsrs
                    )
                }
            }
            res.onSuccess {
                Toast.makeText(this@DeckOptionsActivity, "덱 옵션을 저장했습니다.", Toast.LENGTH_SHORT).show()
                finish()
                UiThemeHelper.disableExitAnimationIfEink(this@DeckOptionsActivity)
            }.onFailure { err ->
                Toast.makeText(this@DeckOptionsActivity, "저장 실패: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }
}
