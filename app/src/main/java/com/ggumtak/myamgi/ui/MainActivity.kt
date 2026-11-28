package com.ggumtak.myamgi.ui

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.OpenableColumns
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.annotation.ColorInt
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import com.ggumtak.myamgi.BuildConfig
import com.ggumtak.myamgi.MyAmgiApp
import com.ggumtak.myamgi.R
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.hanja.HanjaIntegration
import com.ggumtak.myamgi.host.HostApi
import com.ggumtak.myamgi.host.HostServer
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Locale
import java.util.UUID

class MainActivity : AppCompatActivity() {

    private val app: MyAmgiApp
        get() = application as MyAmgiApp

    private val uiScope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    private lateinit var rootContainer: FrameLayout
    private var webView: WebView? = null
    private var errorOverlay: View? = null

    @Volatile
    private var isInStudyScreen: Boolean = false

    @Volatile
    private var isVolumeKeyStudyEnabled: Boolean = false

    @Volatile
    private var isInputFocused: Boolean = false

    @Volatile
    private var isWebLoaded: Boolean = false

    @Volatile
    private var pendingOpenFileEvent: JsonObject? = null

    private var pendingFileCallback: ValueCallback<Array<Uri>>? = null
    private val openSingleDocument = registerForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        val cb = pendingFileCallback
        pendingFileCallback = null
        cb?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
    }
    private val openMultiDocument = registerForActivityResult(ActivityResultContracts.OpenMultipleDocuments()) { uris ->
        val cb = pendingFileCallback
        pendingFileCallback = null
        cb?.onReceiveValue(if (uris.isNotEmpty()) uris.toTypedArray() else null)
    }

    private var pendingDownloadUrl: String? = null
    private var pendingDownloadName: String = "export.apkg"
    private val saveExportLauncher = registerForActivityResult(
        ActivityResultContracts.CreateDocument("application/octet-stream")
    ) { destUri ->
        val srcUrl = pendingDownloadUrl
        val fileName = pendingDownloadName
        pendingDownloadUrl = null
        if (destUri != null && srcUrl != null) {
            copyHostDownloadToUri(srcUrl, destUri, fileName)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        val profile = DeviceProfile.current(this)
        val server = app.ensureHostServer()
        val savedTheme = runCatching {
            server?.api?.prefs?.all()?.get("theme")?.jsonPrimitive?.contentOrNull
        }.getOrNull()
        val initialEink = profile.isEink || savedTheme == "eink"
        if (initialEink) {
            setTheme(R.style.Theme_MyAmgi_Eink)
            @Suppress("DEPRECATION")
            overridePendingTransition(0, 0)
        } else {
            setTheme(R.style.Theme_MyAmgi)
        }

        super.onCreate(savedInstanceState)

        isVolumeKeyStudyEnabled = runCatching {
            server?.api?.prefs?.bool("study.volumeKeys", profile.defaultVolumeKeyStudy)
        }.getOrNull() ?: profile.defaultVolumeKeyStudy

        // 1. Native edge-to-edge setup; rootContainer consumes systemBars + displayCutout + ime.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode =
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_ALWAYS
                    } else {
                        WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
                    }
            }
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.isNavigationBarContrastEnforced = false
        }

        val initialBgHex: String
        val initialLightBars: Boolean
        when {
            initialEink -> {
                initialBgHex = "#FFFFFF"
                initialLightBars = true
            }
            savedTheme == "light" -> {
                initialBgHex = "#F2F4F6"
                initialLightBars = true
            }
            savedTheme == "dark" -> {
                initialBgHex = "#101114"
                initialLightBars = false
            }
            else -> {
                val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                    Configuration.UI_MODE_NIGHT_YES
                initialBgHex = if (isNight) "#101114" else "#F2F4F6"
                initialLightBars = !isNight
            }
        }

        rootContainer = FrameLayout(this).apply {
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
            clipToPadding = false
        }
        setContentView(rootContainer)

        ViewCompat.setOnApplyWindowInsetsListener(rootContainer) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or
                    WindowInsetsCompat.Type.displayCutout() or
                    WindowInsetsCompat.Type.ime()
            )
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            WindowInsetsCompat.CONSUMED
        }
        ViewCompat.requestApplyInsets(rootContainer)

        app.hostPlatform.attachActivity(this)
        registerBackHandler()

        if (server != null) {
            setupWebView(server, initialBgHex, initialLightBars)
            handleIncomingIntent(intent)
        } else {
            applySystemBars(initialBgHex, initialLightBars)
            showStartupErrorOverlay(app.hostStartError)
        }
    }

    override fun onResume() {
        super.onResume()
        app.hostPlatform.attachActivity(this)
        webView?.onResume()
    }

    override fun onPause() {
        webView?.onPause()
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIncomingIntent(intent)
    }

    override fun onDestroy() {
        pendingFileCallback?.onReceiveValue(null)
        pendingFileCallback = null
        app.hostPlatform.detachActivity(this)
        webView?.let { wv ->
            rootContainer.removeView(wv)
            wv.stopLoading()
            wv.removeJavascriptInterface("AndroidShell")
            wv.destroy()
        }
        webView = null
        uiScope.cancel()
        super.onDestroy()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView(server: HostServer, initialBgHex: String, initialLightBars: Boolean) {
        errorOverlay?.let { rootContainer.removeView(it) }
        errorOverlay = null

        val wv = WebView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            overScrollMode = View.OVER_SCROLL_NEVER
            isVerticalScrollBarEnabled = false
            isHorizontalScrollBarEnabled = false
            scrollBarStyle = View.SCROLLBARS_INSIDE_OVERLAY
            settings.apply {
                javaScriptEnabled = true
                domStorageEnabled = true
                databaseEnabled = true
                mediaPlaybackRequiresUserGesture = false
                allowFileAccess = false
                allowContentAccess = false
                mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
                textZoom = 100
                setSupportZoom(false)
                builtInZoomControls = false
                displayZoomControls = false
            }
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(wv, true)
        }

        wv.addJavascriptInterface(AndroidShellBridge(), "AndroidShell")

        wv.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url?.toString() ?: return false
                return handleWebUrl(server, url)
            }

            @Deprecated("Deprecated in Java")
            override fun shouldOverrideUrlLoading(view: WebView?, url: String?): Boolean {
                return if (url == null) false else handleWebUrl(server, url)
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                isWebLoaded = true
                flushPendingOpenFileEvent(server)
            }
        }

        wv.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                pendingFileCallback?.onReceiveValue(null)
                pendingFileCallback = filePathCallback
                val mimes = resolveChooserMimeTypes(fileChooserParams.acceptTypes)
                return try {
                    if (fileChooserParams.mode == FileChooserParams.MODE_OPEN_MULTIPLE) {
                        openMultiDocument.launch(mimes)
                    } else {
                        openSingleDocument.launch(mimes)
                    }
                    true
                } catch (_: ActivityNotFoundException) {
                    pendingFileCallback = null
                    filePathCallback.onReceiveValue(null)
                    Toast.makeText(this@MainActivity, "파일 선택기를 열 수 없습니다.", Toast.LENGTH_SHORT).show()
                    false
                }
            }
        }

        wv.setDownloadListener { url, _, contentDisposition, mimeType, _ ->
            val uri = runCatching { Uri.parse(url) }.getOrNull() ?: return@setDownloadListener
            if ((uri.host == "127.0.0.1" || uri.host == "localhost") &&
                uri.port == server.port &&
                uri.path == "/api/host/download"
            ) {
                val rawName = uri.getQueryParameter("name")
                    ?: URLUtil.guessFileName(url, contentDisposition, mimeType)
                val safeName = HostApi.safeFileName(rawName)
                pendingDownloadUrl = url
                pendingDownloadName = safeName
                try {
                    saveExportLauncher.launch(safeName)
                } catch (_: ActivityNotFoundException) {
                    pendingDownloadUrl = null
                    Toast.makeText(this@MainActivity, "파일 저장 화면을 열 수 없습니다.", Toast.LENGTH_SHORT).show()
                }
            } else if (url.startsWith("http://") || url.startsWith("https://")) {
                runCatching { app.hostPlatform.openExternal(url) }
            }
        }

        rootContainer.addView(wv)
        webView = wv
        applySystemBars(initialBgHex, initialLightBars)
        wv.loadUrl(server.startUrl)
    }

    private fun handleWebUrl(server: HostServer, url: String): Boolean {
        val localPrefix1 = "http://127.0.0.1:${server.port}/"
        val localPrefix2 = "http://localhost:${server.port}/"
        if (url.startsWith(localPrefix1) || url.startsWith(localPrefix2) ||
            url == "http://127.0.0.1:${server.port}" || url == "http://localhost:${server.port}"
        ) {
            return false
        }
        if (url.startsWith("intent://", ignoreCase = true) || url.startsWith("hanja://", ignoreCase = true)) {
            return HanjaIntegration.handleIntentUrl(this, url)
        }
        if (url.startsWith("http://", ignoreCase = true) ||
            url.startsWith("https://", ignoreCase = true) ||
            url.startsWith("mailto:", ignoreCase = true)
        ) {
            runCatching { app.hostPlatform.openExternal(url) }
                .onFailure {
                    Toast.makeText(this, "외부 링크를 열 수 없습니다.", Toast.LENGTH_SHORT).show()
                }
            return true
        }
        return true
    }

    private fun resolveChooserMimeTypes(acceptTypes: Array<String>?): Array<String> {
        if (acceptTypes == null || acceptTypes.isEmpty()) return arrayOf("*/*")
        val cleaned = acceptTypes.map { it.trim() }.filter { it.isNotEmpty() }
        if (cleaned.isEmpty()) return arrayOf("*/*")
        val needsWildcard = cleaned.any { type ->
            type == "*/*" ||
                type.startsWith(".") ||
                type.contains("apkg", ignoreCase = true) ||
                type.contains("colpkg", ignoreCase = true) ||
                type.contains("csv", ignoreCase = true) ||
                type.contains("tsv", ignoreCase = true)
        }
        if (needsWildcard) return arrayOf("*/*")
        val validMimes = cleaned.filter { it.contains('/') }
        return if (validMimes.isEmpty()) arrayOf("*/*") else validMimes.toTypedArray()
    }

    private fun copyHostDownloadToUri(srcUrl: String, destUri: Uri, displayName: String) {
        val server = app.hostServer ?: return
        uiScope.launch {
            val result = withContext(Dispatchers.IO) {
                runCatching {
                    val parsed = Uri.parse(srcUrl)
                    val rawPath = parsed.getQueryParameter("path")
                    val exportRoot = server.api.exportDir.canonicalFile
                    val directFile = rawPath?.let { File(it).canonicalFile }
                        ?.takeIf { it.parentFile == exportRoot && it.isFile }

                    contentResolver.openOutputStream(destUri)?.use { out ->
                        if (directFile != null) {
                            directFile.inputStream().use { input -> input.copyTo(out, 64 * 1024) }
                        } else {
                            val conn = (URL(srcUrl).openConnection() as HttpURLConnection).apply {
                                connectTimeout = 10_000
                                readTimeout = 30_000
                                setRequestProperty("X-Amgi-Token", server.token)
                            }
                            try {
                                if (conn.responseCode !in 200..299) {
                                    error("다운로드 HTTP ${conn.responseCode}")
                                }
                                conn.inputStream.use { input -> input.copyTo(out, 64 * 1024) }
                            } finally {
                                conn.disconnect()
                            }
                        }
                    } ?: error("저장 경로를 열 수 없습니다.")
                }
            }
            result.onSuccess {
                Toast.makeText(this@MainActivity, "파일을 저장했습니다: $displayName", Toast.LENGTH_SHORT).show()
            }.onFailure { err ->
                Toast.makeText(this@MainActivity, "파일 저장 실패: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun handleIncomingIntent(intent: Intent?) {
        if (intent?.action != Intent.ACTION_VIEW) return
        val uri = intent.data ?: return
        intent.data = null
        val server = app.hostServer ?: return

        uiScope.launch {
            val staged = withContext(Dispatchers.IO) {
                runCatching {
                    val displayName = queryDisplayName(uri) ?: uri.lastPathSegment ?: "import.apkg"
                    val safeName = HostApi.safeFileName(File(displayName).name)
                    val ext = safeName.substringAfterLast('.', "")
                        .lowercase(Locale.ROOT)
                        .filter { it in 'a'..'z' || it in '0'..'9' }
                        .take(10)
                    server.api.uploadDir.mkdirs()
                    val target = File(
                        server.api.uploadDir,
                        "upload-${UUID.randomUUID().toString().take(12)}" + if (ext.isEmpty()) "" else ".$ext"
                    )
                    contentResolver.openInputStream(uri)?.use { input ->
                        target.outputStream().use { out -> input.copyTo(out, 64 * 1024) }
                    } ?: error("파일을 읽을 수 없습니다.")

                    JsonObject(
                        mapOf(
                            "path" to JsonPrimitive(target.absolutePath),
                            "name" to JsonPrimitive(safeName)
                        )
                    )
                }
            }
            staged.onSuccess { payload ->
                pendingOpenFileEvent = payload
                flushPendingOpenFileEvent(server)
            }.onFailure { err ->
                Toast.makeText(this@MainActivity, "파일을 열지 못했습니다: ${err.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    private fun flushPendingOpenFileEvent(server: HostServer) {
        if (pendingOpenFileEvent == null) return
        uiScope.launch(Dispatchers.IO) {
            repeat(50) {
                val payload = pendingOpenFileEvent ?: return@launch
                if (server.events.subscriberCount > 0) {
                    synchronized(this@MainActivity) {
                        val current = pendingOpenFileEvent ?: return@launch
                        pendingOpenFileEvent = null
                        server.publish("open-file", current)
                    }
                    return@launch
                }
                delay(200)
            }
        }
    }

    private fun queryDisplayName(uri: Uri): String? {
        return runCatching {
            contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
                if (c.moveToFirst()) c.getString(0) else null
            }
        }.getOrNull()
    }

    private fun registerBackHandler() {
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                val server = app.hostServer
                val wv = webView
                if (server != null && server.events.subscriberCount > 0) {
                    server.publish(
                        "back",
                        JsonObject(mapOf("time" to JsonPrimitive(System.currentTimeMillis())))
                    )
                } else if (wv != null && wv.canGoBack()) {
                    wv.goBack()
                } else {
                    finish()
                }
            }
        })
    }

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val server = app.hostServer ?: return super.dispatchKeyEvent(event)
        val keyName = canonicalKeyName(event.keyCode) ?: return super.dispatchKeyEvent(event)

        val currentUrl = webView?.url
        val onStudy = isInStudyScreen || (currentUrl?.contains("#/study/") == true)
        if (!onStudy) {
            return super.dispatchKeyEvent(event)
        }

        val isVolumeKey = event.keyCode == KeyEvent.KEYCODE_VOLUME_UP ||
            event.keyCode == KeyEvent.KEYCODE_VOLUME_DOWN
        val isPageOrMediaKey = isVolumeKey ||
            event.keyCode == KeyEvent.KEYCODE_PAGE_UP ||
            event.keyCode == KeyEvent.KEYCODE_PAGE_DOWN ||
            event.keyCode == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE ||
            event.keyCode == KeyEvent.KEYCODE_MEDIA_NEXT ||
            event.keyCode == KeyEvent.KEYCODE_MEDIA_PREVIOUS ||
            event.keyCode == KeyEvent.KEYCODE_MEDIA_STOP
        val isDpadKey = event.keyCode == KeyEvent.KEYCODE_DPAD_LEFT ||
            event.keyCode == KeyEvent.KEYCODE_DPAD_RIGHT ||
            event.keyCode == KeyEvent.KEYCODE_DPAD_CENTER
        val isHanjaShortcut = event.keyCode == KeyEvent.KEYCODE_Q || event.keyCode == KeyEvent.KEYCODE_W

        if (isVolumeKey) {
            val volActive = resolveVolumeKeyStudyActive(server)
            if (!volActive || isInputFocused) {
                return super.dispatchKeyEvent(event)
            }
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                publishKeyEvent(server, keyName, event)
            }
            // Consume BOTH ACTION_DOWN and ACTION_UP so Android's volume HUD never pops up.
            return true
        }

        if (isPageOrMediaKey) {
            if (isInputFocused) {
                return super.dispatchKeyEvent(event)
            }
            if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
                publishKeyEvent(server, keyName, event)
            }
            return true
        }

        if (isDpadKey || isHanjaShortcut) {
            if (isInputFocused) {
                return super.dispatchKeyEvent(event)
            }
            if (event.action == KeyEvent.ACTION_DOWN) {
                if (event.repeatCount == 0) {
                    publishKeyEvent(server, keyName, event)
                }
                return true
            }
            if (event.action == KeyEvent.ACTION_UP) {
                return true
            }
        }

        return super.dispatchKeyEvent(event)
    }

    private fun resolveVolumeKeyStudyActive(server: HostServer): Boolean {
        val prefVal = runCatching {
            server.api.prefs.all()["study.volumeKeys"]?.jsonPrimitive?.booleanOrNull
        }.getOrNull()
        return prefVal ?: isVolumeKeyStudyEnabled
    }

    private fun publishKeyEvent(server: HostServer, keyName: String, event: KeyEvent) {
        server.publish(
            "key",
            JsonObject(
                mapOf(
                    "key" to JsonPrimitive(keyName),
                    "keyCode" to JsonPrimitive(event.keyCode),
                    "shift" to JsonPrimitive(event.isShiftPressed),
                    "ctrl" to JsonPrimitive(event.isCtrlPressed),
                    "alt" to JsonPrimitive(event.isAltPressed)
                )
            )
        )
    }

    private fun canonicalKeyName(keyCode: Int): String? = when (keyCode) {
        KeyEvent.KEYCODE_VOLUME_UP -> "VolumeUp"
        KeyEvent.KEYCODE_VOLUME_DOWN -> "VolumeDown"
        KeyEvent.KEYCODE_PAGE_UP -> "PageUp"
        KeyEvent.KEYCODE_PAGE_DOWN -> "PageDown"
        KeyEvent.KEYCODE_DPAD_LEFT -> "ArrowLeft"
        KeyEvent.KEYCODE_DPAD_RIGHT -> "ArrowRight"
        KeyEvent.KEYCODE_DPAD_CENTER -> "Enter"
        KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE -> "MediaPlayPause"
        KeyEvent.KEYCODE_MEDIA_NEXT -> "MediaTrackNext"
        KeyEvent.KEYCODE_MEDIA_PREVIOUS -> "MediaTrackPrevious"
        KeyEvent.KEYCODE_MEDIA_STOP -> "MediaStop"
        KeyEvent.KEYCODE_Q -> "KeyQ"
        KeyEvent.KEYCODE_W -> "KeyW"
        else -> null
    }

    private fun applySystemBars(bgHex: String, isLight: Boolean) {
        val color = runCatching { Color.parseColor(bgHex.trim()) }.getOrDefault(Color.WHITE)
        applySystemBarsColor(color, isLight)
    }

    private fun applySystemBarsColor(@ColorInt color: Int, isLight: Boolean) {
        rootContainer.setBackgroundColor(color)
        window.decorView.setBackgroundColor(color)
        window.setBackgroundDrawable(ColorDrawable(color))
        webView?.setBackgroundColor(color)

        @Suppress("DEPRECATION")
        run {
            window.statusBarColor = color
            window.navigationBarColor = color
        }

        WindowInsetsControllerCompat(window, window.decorView).apply {
            isAppearanceLightStatusBars = isLight
            isAppearanceLightNavigationBars = isLight
        }
    }

    private fun showStartupErrorOverlay(err: Throwable?) {
        errorOverlay?.let { rootContainer.removeView(it) }
        val pad = dp(20)
        val scroll = ScrollView(this).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        }
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(pad, pad, pad, pad)
        }
        val title = TextView(this).apply {
            text = "myAmgi 로컬 서버를 시작하지 못했습니다"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 18f)
            typeface = Typeface.DEFAULT_BOLD
            setTextColor(Color.parseColor("#111827"))
        }
        val detail = TextView(this).apply {
            val msg = err?.message ?: "알 수 없는 오류"
            text = "앱 내부 서버 시작 중 오류가 발생했습니다.\n\n원인: $msg"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTextColor(Color.parseColor("#374151"))
            setPadding(0, dp(12), 0, dp(16))
            setTextIsSelectable(true)
        }
        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.START
        }
        val retryBtn = Button(this).apply {
            text = "다시 시도"
            setOnClickListener {
                val restarted = app.ensureHostServer()
                if (restarted != null) {
                    val isNight = (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) ==
                        Configuration.UI_MODE_NIGHT_YES
                    val eink = DeviceProfile.current(this@MainActivity).isEink
                    val bgHex = when {
                        eink -> "#FFFFFF"
                        isNight -> "#101114"
                        else -> "#F2F4F6"
                    }
                    setupWebView(
                        restarted,
                        bgHex,
                        eink || !isNight
                    )
                    handleIncomingIntent(intent)
                } else {
                    showStartupErrorOverlay(app.hostStartError)
                }
            }
        }
        val copyBtn = Button(this).apply {
            text = "오류 로그 복사"
            setOnClickListener {
                val report = buildString {
                    append("myAmgi Startup Error\n")
                    append("App: ").append(BuildConfig.APPLICATION_ID)
                        .append(" ").append(BuildConfig.VERSION_NAME)
                        .append(" (").append(BuildConfig.VERSION_CODE).append(")\n")
                    append("Device: ").append(Build.MANUFACTURER).append(' ').append(Build.MODEL).append('\n')
                    append("Android: ").append(Build.VERSION.RELEASE).append(" (API ").append(Build.VERSION.SDK_INT).append(")\n\n")
                    append(err?.stackTraceToString() ?: "no stacktrace")
                }
                val cm = getSystemService(ClipboardManager::class.java)
                cm?.setPrimaryClip(ClipData.newPlainText("myAmgi 오류 로그", report))
                Toast.makeText(this@MainActivity, "오류 로그를 복사했습니다.", Toast.LENGTH_SHORT).show()
            }
        }
        row.addView(retryBtn)
        row.addView(
            copyBtn,
            LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { marginStart = dp(8) }
        )

        box.addView(title)
        box.addView(detail)
        box.addView(row)
        scroll.addView(box)
        rootContainer.addView(scroll)
        errorOverlay = scroll
    }

    private fun dp(value: Int): Int =
        TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

    inner class AndroidShellBridge {
        @JavascriptInterface
        fun setSystemBars(bgHex: String, isLight: Boolean) {
            val parsed = runCatching { Color.parseColor(bgHex.trim()) }.getOrNull() ?: return
            runOnUiThread {
                if (isFinishing || isDestroyed) return@runOnUiThread
                applySystemBarsColor(parsed, isLight)
            }
        }

        @JavascriptInterface
        fun setStudyState(inStudy: Boolean, volumeKeyStudy: Boolean, isInputFocused: Boolean) {
            this@MainActivity.isInStudyScreen = inStudy
            this@MainActivity.isVolumeKeyStudyEnabled = volumeKeyStudy
            this@MainActivity.isInputFocused = isInputFocused
        }

        @JavascriptInterface
        fun setStudyState(inStudy: Boolean, volumeKeyStudy: Boolean) {
            setStudyState(inStudy, volumeKeyStudy, false)
        }
    }
}
