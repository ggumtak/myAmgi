package com.ggumtak.myamgi.ui

import android.app.AlertDialog
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.View
import android.view.ViewGroup
import android.widget.AdapterView
import android.widget.ArrayAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.ggumtak.myamgi.BuildConfig
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.hanja.HanjaIntegration
import com.ggumtak.myamgi.prefs.AppPrefs
import com.ggumtak.myamgi.sync.AnkiWebSyncManager
import com.ggumtak.myamgi.sync.SupabaseSyncManager
import com.ggumtak.myamgi.update.AppUpdater
import com.ggumtak.myamgi.update.OtaAssetUpdater
import com.ggumtak.myamgi.update.UpdateInfo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class SettingsActivity : AppCompatActivity() {

    private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private lateinit var sbStatusView: TextView
    private lateinit var sbUrlInput: EditText
    private lateinit var sbKeyInput: EditText
    private lateinit var sbEmailInput: EditText
    private lateinit var sbPassInput: EditText
    private lateinit var syncCodeInput: EditText

    private lateinit var awUserInput: EditText
    private lateinit var awPassInput: EditText
    private lateinit var awStatusView: TextView

    private lateinit var otaStatusView: TextView
    private lateinit var apkStatusView: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        UiThemeHelper.applyActivityTheme(this)
        super.onCreate(savedInstanceState)
        buildLayout()
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

        val (topBar, _, _) = UiThemeHelper.createTopBar(this, "설정", showBack = true)
        root.addView(topBar)

        val scroll = ScrollView(this).apply {
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f)
        }
        val body = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val pad = UiThemeHelper.dp(this@SettingsActivity, 14)
            setPadding(pad, pad, pad, pad)
        }

        // 1. Study Settings
        body.addView(UiThemeHelper.makeSectionHeader(this, "1. 학습 설정"))
        val studyCard = makeSectionCard()

        val twoBtnCheck = CheckBox(this).apply {
            text = "2버튼 고속 학습 모드 (다시 / 괜찮음, 전 기기 동기화)"
            isChecked = AppPrefs.isTwoButtonMode(this@SettingsActivity)
            setTextColor(p.textPrimary)
            setOnCheckedChangeListener { _, checked -> AppPrefs.setTwoButtonMode(this@SettingsActivity, checked) }
        }
        studyCard.addView(twoBtnCheck)

        val volCheck = CheckBox(this).apply {
            text = "측면 물리 볼륨 키로 학습 (아래: 정답/괜찮음, 위: 정답/다시)"
            isChecked = AppPrefs.isVolumeKeyStudy(this@SettingsActivity)
            setTextColor(p.textPrimary)
            setOnCheckedChangeListener { _, checked -> AppPrefs.setVolumeKeyStudy(this@SettingsActivity, checked) }
        }
        studyCard.addView(volCheck)

        val tapFlipCheck = CheckBox(this).apply {
            text = "카드 빈 화면 탭으로 뒤집기"
            isChecked = AppPrefs.isTapToFlip(this@SettingsActivity)
            setTextColor(p.textPrimary)
            setOnCheckedChangeListener { _, checked -> AppPrefs.setTapToFlip(this@SettingsActivity, checked) }
        }
        studyCard.addView(tapFlipCheck)

        val hanjaInstalled = HanjaIntegration.isInstalled(this)
        val hanjaCheck = CheckBox(this).apply {
            text = "한자 바로보기(com.ggumtak.hanja) 자동 주입 (${if (hanjaInstalled) "설치됨" else "미설치 · 내장 스크립트"})"
            isChecked = AppPrefs.isHanjaAutoInject(this@SettingsActivity)
            setTextColor(p.textPrimary)
            setOnCheckedChangeListener { _, checked -> AppPrefs.setHanjaAutoInject(this@SettingsActivity, checked) }
        }
        studyCard.addView(hanjaCheck)

        studyCard.addView(UiThemeHelper.makeLabel(this, "화면 테마", secondary = true).apply {
            setPadding(0, UiThemeHelper.dp(this@SettingsActivity, 8), 0, UiThemeHelper.dp(this@SettingsActivity, 4))
        })
        val themeModes = listOf(
            AppPrefs.THEME_AUTO to "자동 (시스템 설정)",
            AppPrefs.THEME_LIGHT to "라이트 모드",
            AppPrefs.THEME_DARK to "다크 모드",
            AppPrefs.THEME_EINK to "E-Ink 고대비 흑백 (코멧)"
        )
        val themeSpinner = Spinner(this).apply {
            adapter = ArrayAdapter(this@SettingsActivity, android.R.layout.simple_spinner_dropdown_item, themeModes.map { it.second })
            val currentIdx = themeModes.indexOfFirst { it.first == AppPrefs.getThemeMode(this@SettingsActivity) }.coerceAtLeast(0)
            setSelection(currentIdx, false)
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                var initialized = false
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    if (!initialized) {
                        initialized = true
                        return
                    }
                    val chosen = themeModes[position].first
                    if (chosen != AppPrefs.getThemeMode(this@SettingsActivity)) {
                        AppPrefs.setThemeMode(this@SettingsActivity, chosen)
                        recreate()
                    }
                }

                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            }
        }
        studyCard.addView(themeSpinner)
        body.addView(studyCard)

        // 2. Supabase Cloud Sync
        body.addView(UiThemeHelper.makeSectionHeader(this, "2. 클라우드 동기화 (Supabase - 5기기 무료 연동)"))
        val sbCard = makeSectionCard()

        sbStatusView = UiThemeHelper.makeLabel(this, buildSupabaseStatusText(), secondary = false)
        sbCard.addView(sbStatusView)

        sbCard.addView(UiThemeHelper.makeLabel(this, "1초 기기 연동 코드 (MYAMGI1:...)", secondary = true).apply {
            setPadding(0, UiThemeHelper.dp(this@SettingsActivity, 8), 0, UiThemeHelper.dp(this@SettingsActivity, 4))
        })
        syncCodeInput = UiThemeHelper.makeInputBox(this, "MYAMGI1:... 붙여넣기")
        sbCard.addView(syncCodeInput)

        val codeBtnRow = makeHorizontalRow()
        val copyCodeBtn = UiThemeHelper.createStyledButton(this, "내 연동 코드 복사", filled = false, textSizeSp = 12f).apply {
            setOnClickListener {
                val code = SupabaseSyncManager.generateSyncCode(this@SettingsActivity)
                if (code.isNullOrBlank()) {
                    Toast.makeText(this@SettingsActivity, "먼저 Supabase 계정에 로그인해 주세요.", Toast.LENGTH_SHORT).show()
                } else {
                    val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("myAmgi Sync Code", code))
                    Toast.makeText(this@SettingsActivity, "MYAMGI1 연동 코드를 복사했습니다.", Toast.LENGTH_SHORT).show()
                }
            }
        }
        val linkCodeBtn = UiThemeHelper.createStyledButton(this, "코드로 바로 연결", filled = true, textSizeSp = 12f).apply {
            setOnClickListener { linkWithCode() }
        }
        addEqualButtons(codeBtnRow, copyCodeBtn, linkCodeBtn)
        sbCard.addView(codeBtnRow)

        sbCard.addView(UiThemeHelper.makeLabel(this, "직접 로그인 / 회원가입", secondary = true).apply {
            setPadding(0, UiThemeHelper.dp(this@SettingsActivity, 10), 0, UiThemeHelper.dp(this@SettingsActivity, 4))
        })
        sbUrlInput = UiThemeHelper.makeInputBox(this, "Supabase URL (https://xxxx.supabase.co)").apply {
            setText(AppPrefs.getSupabaseUrl(this@SettingsActivity))
        }
        sbKeyInput = UiThemeHelper.makeInputBox(this, "Supabase Anon Key").apply {
            setText(AppPrefs.getSupabaseAnonKey(this@SettingsActivity))
        }
        sbEmailInput = UiThemeHelper.makeInputBox(this, "이메일").apply {
            inputType = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            setText(AppPrefs.getSupabaseEmail(this@SettingsActivity))
        }
        sbPassInput = UiThemeHelper.makeInputBox(this, "비밀번호").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        listOf(sbUrlInput, sbKeyInput, sbEmailInput, sbPassInput).forEach { v ->
            sbCard.addView(v, verticalMargin(6))
        }

        val sbAuthRow = makeHorizontalRow()
        val btnSignIn = UiThemeHelper.createStyledButton(this, "로그인", filled = true, textSizeSp = 12f).apply {
            setOnClickListener { runSupabaseAuth(signUp = false) }
        }
        val btnSignUp = UiThemeHelper.createStyledButton(this, "회원가입", filled = false, textSizeSp = 12f).apply {
            setOnClickListener { runSupabaseAuth(signUp = true) }
        }
        addEqualButtons(sbAuthRow, btnSignIn, btnSignUp)
        sbCard.addView(sbAuthRow)

        val btnSyncNow = UiThemeHelper.createStyledButton(this, "지금 동기화 (미디어 병렬 동기화)", filled = true).apply {
            setOnClickListener { runSupabaseSync() }
        }
        sbCard.addView(btnSyncNow, verticalMargin(8))
        body.addView(sbCard)

        // 3. AnkiWeb Secondary Sync
        body.addView(UiThemeHelper.makeSectionHeader(this, "3. AnkiWeb 동기화 (보조)"))
        val awCard = makeSectionCard()
        val curAw = AppPrefs.getAnkiWebUser(this)
        awStatusView = UiThemeHelper.makeLabel(
            this,
            if (curAw.isBlank()) "연결된 AnkiWeb 계정 없음" else "로그인됨: $curAw",
            secondary = false
        )
        awCard.addView(awStatusView)
        awUserInput = UiThemeHelper.makeInputBox(this, "AnkiWeb 이메일").apply {
            inputType = InputType.TYPE_TEXT_VARIATION_EMAIL_ADDRESS
            setText(curAw)
        }
        awPassInput = UiThemeHelper.makeInputBox(this, "AnkiWeb 비밀번호").apply {
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD
        }
        awCard.addView(awUserInput, verticalMargin(6))
        awCard.addView(awPassInput, verticalMargin(6))

        val awBtnRow = makeHorizontalRow()
        val btnAwLogin = UiThemeHelper.createStyledButton(this, "AnkiWeb 로그인", filled = false, textSizeSp = 12f).apply {
            setOnClickListener { runAnkiWebLogin() }
        }
        val btnAwSync = UiThemeHelper.createStyledButton(this, "AnkiWeb 동기화", filled = true, textSizeSp = 12f).apply {
            setOnClickListener { runAnkiWebSync(direction = null) }
        }
        addEqualButtons(awBtnRow, btnAwLogin, btnAwSync)
        awCard.addView(awBtnRow)

        val awForceRow = makeHorizontalRow()
        val btnForceUp = UiThemeHelper.createStyledButton(this, "강제 업로드", filled = false, textSizeSp = 12f).apply {
            setOnClickListener { confirmFullAnkiWebSync("upload") }
        }
        val btnForceDown = UiThemeHelper.createStyledButton(this, "강제 다운로드", filled = false, textSizeSp = 12f).apply {
            setOnClickListener { confirmFullAnkiWebSync("download") }
        }
        addEqualButtons(awForceRow, btnForceUp, btnForceDown)
        awCard.addView(awForceRow)
        body.addView(awCard)

        // 4. Two-tier Partial Updates
        body.addView(UiThemeHelper.makeSectionHeader(this, "4. 2단계 부분 업데이트 (재설치 없음)"))
        val updateCard = makeSectionCard()
        otaStatusView = UiThemeHelper.makeLabel(this, "1단계 OTA 핫패치 버전: v${AppPrefs.getOtaVersion(this)}", secondary = false)
        updateCard.addView(otaStatusView)
        val otaRow = makeHorizontalRow()
        val btnOtaCheck = UiThemeHelper.createStyledButton(this, "1단계 OTA 핫패치 확인", filled = true, textSizeSp = 12f).apply {
            setOnClickListener { checkOtaUpdate() }
        }
        val btnOtaReset = UiThemeHelper.createStyledButton(this, "핫패치 초기화", filled = false, textSizeSp = 12f).apply {
            setOnClickListener {
                OtaAssetUpdater.clearOta(this@SettingsActivity)
                otaStatusView.text = "1단계 OTA 핫패치 초기화됨 (번들 기본값)"
            }
        }
        addEqualButtons(otaRow, btnOtaCheck, btnOtaReset)
        updateCard.addView(otaRow)

        apkStatusView = UiThemeHelper.makeLabel(
            this,
            "2단계 바이너리 빌드: ${BuildConfig.APK_PREFIX} #${AppUpdater.current} (${BuildConfig.VERSION_NAME})",
            secondary = false
        ).apply {
            setPadding(0, UiThemeHelper.dp(this@SettingsActivity, 10), 0, UiThemeHelper.dp(this@SettingsActivity, 4))
        }
        updateCard.addView(apkStatusView)
        val btnApkCheck = UiThemeHelper.createStyledButton(this, "2단계 앱 델타 업데이트 확인 및 설치", filled = false).apply {
            setOnClickListener { checkApkUpdate() }
        }
        updateCard.addView(btnApkCheck, verticalMargin(6))
        body.addView(updateCard)

        // 5. Device Profile Info
        body.addView(UiThemeHelper.makeSectionHeader(this, "5. 기기 프로파일 정보"))
        val infoCard = makeSectionCard()
        val cacheMb = profile.mediaCacheBytes / (1024 * 1024)
        val infoText = buildString {
            appendLine("에디션: ${profile.flavorLabel} (${BuildConfig.FLAVOR_NAME})")
            appendLine("감지된 기기: ${profile.detectedHardware}")
            appendLine("ABI: arm64-v8a 전용")
            appendLine("프리로드 카드 수: ${profile.preloadCardsCount}장 · Zero-Flash DOM: ${if (profile.useZeroFlashDomSwap) "ON" else "OFF"}")
            appendLine("미디어 캐시: ${cacheMb}MB · 동기화 병렬 워커: ${profile.syncParallelism}")
            append("앱 버전: ${BuildConfig.VERSION_NAME} (code ${BuildConfig.VERSION_CODE})")
        }
        infoCard.addView(UiThemeHelper.makeLabel(this, infoText, secondary = true, sizeSp = 12.5f))
        body.addView(infoCard)

        scroll.addView(body)
        root.addView(scroll)
        setContentView(root)
    }

    private fun makeSectionCard(): LinearLayout {
        val p = UiThemeHelper.palette(this)
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            val pad = UiThemeHelper.dp(this@SettingsActivity, 12)
            setPadding(pad, pad, pad, pad)
            background = UiThemeHelper.makeCardBackground(
                this@SettingsActivity,
                fillColor = p.surface,
                strokeColor = p.border,
                cornerDp = 10,
                strokeDp = if (p.isEink) 1.5f else 1f
            )
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
                bottomMargin = UiThemeHelper.dp(this@SettingsActivity, 8)
            }
        }
    }

    private fun makeHorizontalRow(): LinearLayout {
        return LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = verticalMargin(8)
        }
    }

    private fun addEqualButtons(row: LinearLayout, left: Button, right: Button) {
        row.addView(left, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f))
        row.addView(right, LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f).apply {
            marginStart = UiThemeHelper.dp(this@SettingsActivity, 6)
        })
    }

    private fun verticalMargin(topDp: Int): LinearLayout.LayoutParams {
        return LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply {
            topMargin = UiThemeHelper.dp(this@SettingsActivity, topDp)
        }
    }

    private fun buildSupabaseStatusText(): String {
        val email = AppPrefs.getSupabaseEmail(this)
        val uid = AppPrefs.getSupabaseUserId(this)
        val last = AppPrefs.getLastSyncTime(this)
        val lastStr = if (last > 0) SimpleDateFormat("MM-dd HH:mm", Locale.getDefault()).format(Date(last)) else "기록 없음"
        return if (uid.isNotBlank()) "연결됨 ($email) · 최근 동기화: $lastStr" else "미연결 · 로그인하거나 연동 코드를 입력하세요."
    }

    private fun linkWithCode() {
        val code = syncCodeInput.text.toString().trim()
        if (code.isBlank()) {
            Toast.makeText(this, "연동 코드를 입력해 주세요.", Toast.LENGTH_SHORT).show()
            return
        }
        sbStatusView.text = "연동 코드 확인 중..."
        uiScope.launch {
            val res = withContext(Dispatchers.IO) { SupabaseSyncManager.linkWithCode(this@SettingsActivity, code) }
            res.onSuccess { msg ->
                sbUrlInput.setText(AppPrefs.getSupabaseUrl(this@SettingsActivity))
                sbKeyInput.setText(AppPrefs.getSupabaseAnonKey(this@SettingsActivity))
                sbEmailInput.setText(AppPrefs.getSupabaseEmail(this@SettingsActivity))
                sbStatusView.text = "연결 완료: $msg"
            }.onFailure { err ->
                sbStatusView.text = "연결 실패: ${err.message}"
            }
        }
    }

    private fun runSupabaseAuth(signUp: Boolean) {
        val url = sbUrlInput.text.toString().trim()
        val key = sbKeyInput.text.toString().trim()
        val email = sbEmailInput.text.toString().trim()
        val pass = sbPassInput.text.toString()
        if (url.isBlank() || key.isBlank() || email.isBlank() || pass.isBlank()) {
            Toast.makeText(this, "URL, Anon Key, 이메일, 비밀번호를 모두 입력하세요.", Toast.LENGTH_SHORT).show()
            return
        }
        sbStatusView.text = if (signUp) "회원가입 중..." else "로그인 중..."
        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                if (signUp) SupabaseSyncManager.signUp(this@SettingsActivity, url, key, email, pass)
                else SupabaseSyncManager.signIn(this@SettingsActivity, url, key, email, pass)
            }
            res.onSuccess { msg ->
                sbStatusView.text = msg
            }.onFailure { err ->
                sbStatusView.text = "인증 실패: ${err.message}"
            }
        }
    }

    private fun runSupabaseSync() {
        sbStatusView.text = "동기화 시작..."
        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                SupabaseSyncManager.syncAll(this@SettingsActivity) { progress ->
                    uiScope.launch { sbStatusView.text = progress }
                }
            }
            res.onSuccess { summary ->
                sbStatusView.text = "${summary.message} (업로드 ${summary.uploadedMedia}, 다운로드 ${summary.downloadedMedia}, 스킵 ${summary.skippedMedia})"
            }.onFailure { err ->
                sbStatusView.text = "동기화 실패: ${err.message}"
            }
        }
    }

    private fun runAnkiWebLogin() {
        val user = awUserInput.text.toString().trim()
        val pass = awPassInput.text.toString()
        if (user.isBlank() || pass.isBlank()) {
            Toast.makeText(this, "AnkiWeb 이메일과 비밀번호를 입력하세요.", Toast.LENGTH_SHORT).show()
            return
        }
        awStatusView.text = "AnkiWeb 로그인 중..."
        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                AnkiWebSyncManager.login(this@SettingsActivity, user, pass)
            }
            res.onSuccess {
                awStatusView.text = "로그인됨: $user"
            }.onFailure { err ->
                awStatusView.text = "로그인 실패: ${err.message}"
            }
        }
    }

    private fun runAnkiWebSync(direction: String?) {
        awStatusView.text = "AnkiWeb 동기화 중..."
        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                AnkiWebSyncManager.sync(this@SettingsActivity, direction) { msg ->
                    uiScope.launch { awStatusView.text = msg }
                }
            }
            res.onSuccess { msg ->
                if (msg == "FULL_SYNC_REQUIRED") {
                    AlertDialog.Builder(this@SettingsActivity)
                        .setTitle("전체 동기화 필요")
                        .setMessage("로컬 컬렉션과 AnkiWeb 서버의 구조가 다릅니다. 어느 쪽을 기준으로 덮어쓸까요?")
                        .setPositiveButton("서버로 업로드") { _, _ -> runAnkiWebSync("upload") }
                        .setNegativeButton("서버에서 다운로드") { _, _ -> runAnkiWebSync("download") }
                        .setNeutralButton("취소", null)
                        .show()
                    awStatusView.text = "전체 동기화 방향 선택 필요"
                } else {
                    awStatusView.text = msg
                }
            }.onFailure { err ->
                awStatusView.text = "동기화 실패: ${err.message}"
            }
        }
    }

    private fun confirmFullAnkiWebSync(direction: String) {
        val label = if (direction == "upload") "로컬 컬렉션을 서버에 덮어쓰기(업로드)" else "서버 컬렉션을 로컬에 덮어쓰기(다운로드)"
        AlertDialog.Builder(this)
            .setTitle("강제 전체 동기화")
            .setMessage("정말 '$label'를 진행할까요?")
            .setPositiveButton("진행") { _, _ -> runAnkiWebSync(direction) }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun checkOtaUpdate() {
        otaStatusView.text = "OTA 매니페스트 확인 중..."
        uiScope.launch {
            val res = withContext(Dispatchers.IO) {
                runCatching { OtaAssetUpdater.checkAndUpdate(this@SettingsActivity) }
            }
            res.onSuccess { info ->
                otaStatusView.text = when {
                    info.error != null -> "OTA 오류: ${info.error}"
                    info.upToDate -> "최신 상태입니다 (v${info.remoteVersion})"
                    else -> "v${info.remoteVersion} 적용 완료 (${info.updatedFiles.size}개 파일 갱신)"
                }
            }.onFailure { err ->
                otaStatusView.text = "OTA 확인 실패: ${err.message}"
            }
        }
    }

    private fun checkApkUpdate() {
        apkStatusView.text = "최신 ${BuildConfig.APK_PREFIX} 빌드 확인 중..."
        AppUpdater.check { latest ->
            runOnUiThread {
                if (latest == null || !UpdateInfo.isNewer(latest, AppUpdater.current)) {
                    apkStatusView.text = "이미 최신 버전입니다 (#${AppUpdater.current})."
                    return@runOnUiThread
                }
                val sizeMb = String.format(Locale.US, "%.1f", latest.size / (1024.0 * 1024.0))
                apkStatusView.text = "새 빌드 발견: ${latest.flavorPrefix} #${latest.build} ($sizeMb MB, 패치 ${latest.patches.size}개)"
                AlertDialog.Builder(this)
                    .setTitle("앱 업데이트 (#${latest.build})")
                    .setMessage("${latest.flavorPrefix} #${latest.build} 버전이 있습니다.\n델타 패치가 있으면 변경 바이트만 받아 덮어쓰기 설치합니다.")
                    .setPositiveButton("업데이트 설치") { _, _ ->
                        val started = AppUpdater.install(
                            activity = this,
                            latest = latest,
                            progress = { pct ->
                                runOnUiThread { apkStatusView.text = "다운로드 및 패치 적용 중: $pct%" }
                            },
                            failed = { errMsg ->
                                runOnUiThread { apkStatusView.text = "업데이트 실패: $errMsg" }
                            }
                        )
                        if (!started) {
                            apkStatusView.text = "'출처를 알 수 없는 앱 설치' 권한을 허용한 뒤 다시 시도해 주세요."
                        }
                    }
                    .setNegativeButton("나중에", null)
                    .show()
            }
        }
    }
}
