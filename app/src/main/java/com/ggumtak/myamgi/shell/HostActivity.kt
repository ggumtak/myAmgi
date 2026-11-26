package com.ggumtak.myamgi.shell

import android.annotation.SuppressLint
import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.drawable.ColorDrawable
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.TypedValue
import android.view.Gravity
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.PermissionRequest
import android.webkit.RenderProcessGoneDetail
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.addCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import com.ggumtak.myamgi.BuildConfig
import com.ggumtak.myamgi.MyAmgiApp
import com.ggumtak.myamgi.R
import com.ggumtak.myamgi.hanja.HanjaIntegration
import com.ggumtak.myamgi.host.HostRuntime
import com.ggumtak.myamgi.host.ShellCallbacks
import com.ggumtak.myamgi.host.UiShellState
import java.io.File

/**
 * The only activity: a full-screen WebView showing the web UI served by the app-wide host
 * ([HostRuntime]). See the file comments of [NavigationPolicy], [ShellKeys], [BackCoordinator] and
 * [com.ggumtak.myamgi.update.UiOtaStore] for the rules it applies.
 *
 * Insets: the WebView is padded by the system bars, display cutout and keyboard, so inside the page
 * `env(safe-area-inset-*)` is 0 and nothing is hidden behind a bar; the bar areas show the UI background
 * colour reported through `ui.state`.
 */
class HostActivity : ComponentActivity(), ShellCallbacks {
    private var runtime: HostRuntime? = null
    private lateinit var root: FrameLayout
    private lateinit var content: FrameLayout
    private var webView: WebView? = null
    private var errorView: View? = null
    private var errorText: String? = null
    private val handler = Handler(Looper.getMainLooper())
    private val back = BackCoordinator()
    private var policy: NavigationPolicy? = null
    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var pendingSave: Pair<String, String>? = null
    private var otaWatchdog: Runnable? = null
    private var reloadedAfter403 = false
    private var drainScheduled = false

    override val activity: Activity get() = this

    private val pickFiles = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data))
        fileCallback = null
    }

    private val createDocument = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        val save = pendingSave
        pendingSave = null
        val target = r.data?.data
        if (r.resultCode != RESULT_OK || save == null || target == null) return@registerForActivityResult
        val src = File(save.first)
        Thread {
            val ok = runCatching {
                contentResolver.openOutputStream(target, "w")!!.use { out -> src.inputStream().use { it.copyTo(out, 64 * 1024) } }
            }.onFailure { runtime?.log?.error("save to device failed", it) }.isSuccess
            handler.post { toast(if (ok) "기기에 저장했습니다: ${save.second}" else "저장하지 못했습니다.") }
        }.start()
    }

    // --- Lifecycle ---

    override fun onCreate(savedInstanceState: Bundle?) {
        if (BuildConfig.IS_COMET) setTheme(R.style.Theme_MyAmgi_Eink)
        super.onCreate(savedInstanceState)
        root = FrameLayout(this)
        content = FrameLayout(this)
        root.addView(content, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(root)
        ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
            val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
            content.setPadding(bars.left, bars.top, bars.right, maxOf(bars.bottom, ime.bottom))
            WindowInsetsCompat.CONSUMED
        }
        onBackPressedDispatcher.addCallback(this) { onBackRequested() }
        savedInstanceState?.getString(KEY_SAVE_PATH)?.let { p ->
            pendingSave = p to (savedInstanceState.getString(KEY_SAVE_NAME) ?: File(p).name)
        }

        val rt = try {
            (application as MyAmgiApp).hostRuntime()
        } catch (t: Throwable) {
            applyColors(UiShellState())
            showError("앱 엔진을 시작하지 못했습니다.\n${t.message ?: t.javaClass.simpleName}", t)
            return
        }
        runtime = rt
        policy = NavigationPolicy(rt.server.port)
        rt.shell = this
        applyColors(rt.uiState)

        val restoreUrl = savedInstanceState?.takeIf { it.getString(KEY_TOKEN) == rt.server.token }
            ?.getString(KEY_URL)?.takeIf { policy!!.isOwnOrigin(it) }
        if (createWebView()) load(restoreUrl ?: rt.server.startUrl)
        if (savedInstanceState == null) handleIncoming(intent)
        rt.updates.checkOnLaunchIfDue()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIncoming(intent)
    }

    override fun onResume() {
        super.onResume()
        runtime?.shell = this
        webView?.onResume()
    }

    override fun onPause() {
        webView?.onPause()
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        val rt = runtime ?: return
        webView?.url?.let { outState.putString(KEY_URL, it) }
        outState.putString(KEY_TOKEN, rt.server.token)
        pendingSave?.let {
            outState.putString(KEY_SAVE_PATH, it.first)
            outState.putString(KEY_SAVE_NAME, it.second)
        }
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        // Rotation/size changes are handled in place (manifest configChanges); the WebView relayouts itself.
        ViewCompat.requestApplyInsets(root)
    }

    override fun onDestroy() {
        handler.removeCallbacksAndMessages(null)
        fileCallback?.onReceiveValue(null)
        fileCallback = null
        runtime?.let { if (it.shell === this) it.shell = null }
        destroyWebView()
        super.onDestroy()
    }

    // --- WebView ---

    @SuppressLint("SetJavaScriptEnabled")
    private fun createWebView(): Boolean {
        val rt = runtime ?: return false
        val wv = try {
            WebView(this)
        } catch (t: Throwable) {
            showError("Android 시스템 WebView를 사용할 수 없습니다. Play 스토어에서 'Android System WebView'를 업데이트한 뒤 다시 시도하세요.", t)
            return false
        }
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        wv.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            mediaPlaybackRequiresUserGesture = false
            textZoom = 100
            setSupportMultipleWindows(false)
            javaScriptCanOpenWindowsAutomatically = false
            setGeolocationEnabled(false)
            if (Build.VERSION.SDK_INT >= 26) safeBrowsingEnabled = false
            userAgentString = "$userAgentString myAmgi/${BuildConfig.VERSION_NAME} (${BuildConfig.FLAVOR_NAME})"
        }
        wv.isFocusable = true
        wv.isFocusableInTouchMode = true
        if (BuildConfig.IS_COMET || rt.profile.isEink) {
            wv.overScrollMode = View.OVER_SCROLL_NEVER
            wv.isScrollbarFadingEnabled = false
        }
        wv.setBackgroundColor(currentBackground)
        wv.webViewClient = Client()
        wv.webChromeClient = Chrome()
        wv.setDownloadListener { url, _, _, _, _ ->
            when (policy?.decide(url, isMainFrame = true)) {
                NavigationPolicy.Action.DOWNLOAD -> saveToDevice(Uri.parse(url))
                NavigationPolicy.Action.EXTERNAL -> openExternal(url)
                else -> Unit
            }
        }
        content.addView(wv, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        webView = wv
        wv.requestFocus()
        return true
    }

    private fun destroyWebView() {
        val wv = webView ?: return
        webView = null
        content.removeView(wv)
        runCatching {
            wv.stopLoading()
            wv.destroy()
        }
    }

    private fun load(url: String) {
        webView?.loadUrl(url)
    }

    /** Fresh start of the UI (new bundle, error recovery). */
    override fun reloadUi() {
        val rt = runtime ?: return
        hideError()
        if (webView == null && !createWebView()) return
        reloadedAfter403 = false
        load(rt.server.startUrl)
    }

    private inner class Client : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean =
            route(request.url.toString(), request.isForMainFrame, request.hasGesture())

        override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
            val rt = runtime ?: return
            if (policy?.isOwnOrigin(url) != true) return
            rt.onPageStarted()
            window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            startOtaWatchdog()
        }

        override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
            if (!request.isForMainFrame) return
            runtime?.log?.error("page load failed: ${error.errorCode} ${error.description} ${request.url}")
            showError("앱 화면을 불러오지 못했습니다.\n(${error.description})", null)
        }

        override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
            if (!request.isForMainFrame) return
            val rt = runtime ?: return
            rt.log.warn("main frame HTTP ${response.statusCode}: ${request.url.path}")
            if (response.statusCode == 403 && !reloadedAfter403) {
                // A URL from an earlier process (other token): start over with the current one.
                reloadedAfter403 = true
                handler.post { load(rt.server.startUrl) }
            } else if (response.statusCode >= 500 || response.statusCode == 403) {
                handler.post { showError("앱 화면을 불러오지 못했습니다. (HTTP ${response.statusCode})", null) }
            }
        }

        override fun onRenderProcessGone(view: WebView, detail: RenderProcessGoneDetail): Boolean {
            val crashed = detail.didCrash()
            runtime?.log?.error("WebView renderer gone (crashed=$crashed)")
            if (view === webView) {
                webView = null
                content.removeView(view)
            }
            view.destroy()
            if (!crashed && errorView == null) {
                // Killed by the system to free memory: come back quietly.
                handler.post { reloadUi() }
            } else {
                showError("화면 엔진이 갑자기 멈췄습니다.", null)
            }
            return true
        }
    }

    /** Applies [NavigationPolicy]; returns true when the WebView must not load [url] itself. */
    private fun route(url: String, isMainFrame: Boolean, hasGesture: Boolean): Boolean {
        val p = policy ?: return true
        return when (p.decide(url, isMainFrame, hasGesture)) {
            NavigationPolicy.Action.ALLOW -> false
            NavigationPolicy.Action.DOWNLOAD -> {
                saveToDevice(Uri.parse(url))
                true
            }
            NavigationPolicy.Action.HANJA -> {
                HanjaIntegration.handleIntentUrl(this, url)
                true
            }
            NavigationPolicy.Action.EXTERNAL -> {
                openExternal(url)
                true
            }
            NavigationPolicy.Action.BLOCK -> {
                runtime?.log?.warn("blocked navigation: ${url.take(200)}")
                true
            }
        }
    }

    private fun openExternal(url: String) {
        try {
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addCategory(Intent.CATEGORY_BROWSABLE))
        } catch (_: ActivityNotFoundException) {
            toast("이 주소를 열 수 있는 앱이 없습니다.")
        }
    }

    private inner class Chrome : WebChromeClient() {
        override fun onShowFileChooser(
            webView: WebView,
            filePathCallback: ValueCallback<Array<Uri>>,
            params: FileChooserParams
        ): Boolean {
            fileCallback?.onReceiveValue(null)
            fileCallback = filePathCallback
            val types = ShareMime.pickerTypes(params.acceptTypes)
            val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                addCategory(Intent.CATEGORY_OPENABLE)
                type = types.singleOrNull() ?: "*/*"
                if (types.size > 1) putExtra(Intent.EXTRA_MIME_TYPES, types.toTypedArray())
                if (params.mode == FileChooserParams.MODE_OPEN_MULTIPLE) putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true)
            }
            // Camera/microphone capture (params.isCaptureEnabled) is not offered yet: the document picker opens instead.
            return try {
                pickFiles.launch(intent)
                true
            } catch (_: ActivityNotFoundException) {
                fileCallback = null
                filePathCallback.onReceiveValue(null)
                toast("파일을 고를 수 있는 앱이 없습니다.")
                true
            }
        }

        override fun onPermissionRequest(request: PermissionRequest) {
            // Microphone/camera for the page are not supported yet; deny so the page gets a clear error.
            request.deny()
        }

        override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
            if (msg.messageLevel() == ConsoleMessage.MessageLevel.ERROR) {
                runtime?.log?.warn("console: ${msg.message()} (${msg.sourceId()?.substringAfterLast('/')}:${msg.lineNumber()})")
            }
            return true
        }
    }

    // --- Save to device (/api/host/download) ---

    private fun saveToDevice(uri: Uri) {
        val rt = runtime ?: return
        val path = uri.getQueryParameter("path")
        val file = path?.let { File(it).canonicalFile }
        if (file == null || file.parentFile != rt.server.api.exportDir.canonicalFile || !file.isFile) {
            toast("이 파일은 저장할 수 없습니다.")
            return
        }
        val name = com.ggumtak.myamgi.host.HostApi.safeFileName(uri.getQueryParameter("name") ?: file.name)
        pendingSave = file.path to name
        val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = ShareMime.of(name)
            putExtra(Intent.EXTRA_TITLE, name)
        }
        try {
            createDocument.launch(intent)
        } catch (_: ActivityNotFoundException) {
            pendingSave = null
            toast("파일을 저장할 수 있는 앱이 없습니다.")
        }
    }

    // --- Files opened with the app ---

    private fun handleIncoming(intent: Intent?) {
        val rt = runtime ?: return
        val uris = IncomingFiles.urisOf(intent)
        if (uris.isEmpty()) {
            if (intent?.action == Intent.ACTION_SEND) toast("가져올 수 있는 파일이 아닙니다.")
            return
        }
        toast("파일을 여는 중…")
        Thread {
            for (u in uris) {
                runCatching { IncomingFiles.copy(contentResolver, u, rt.server.api.uploadDir) }
                    .onSuccess { rt.openFiles.offer(it) }
                    .onFailure {
                        rt.log.error("could not read opened file $u", it)
                        handler.post { toast("파일을 읽지 못했습니다.") }
                    }
            }
            handler.post { scheduleDrain() }
        }.start()
    }

    private fun scheduleDrain() {
        if (drainScheduled) return
        drainScheduled = true
        handler.postDelayed(object : Runnable {
            override fun run() {
                val rt = runtime ?: return
                val items = rt.openFiles.drain(rt.uiReadyThisPage, rt.server.events.subscriberCount, System.currentTimeMillis())
                for (it in items) rt.publish("open-file", HostRuntime.json("path" to it.path, "name" to it.name))
                if (rt.openFiles.size() > 0) handler.postDelayed(this, 500) else drainScheduled = false
            }
        }, 300)
    }

    // --- UI → shell ---

    override fun onUiReady() {
        otaWatchdog?.let { handler.removeCallbacks(it) }
        otaWatchdog = null
        if ((runtime?.openFiles?.size() ?: 0) > 0) scheduleDrain()
    }

    override fun onUiState(state: UiShellState) {
        applyColors(state)
        if (state.keepScreenOn == true) window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        else window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }

    override fun exitApp() {
        finish()
    }

    // --- OTA watchdog ---

    private fun startOtaWatchdog() {
        val rt = runtime ?: return
        if (otaWatchdog != null) return
        if (!rt.otaStore.onUiLoadStarted(rt.otaServed())) return
        if (rt.otaStore.state().attempts > com.ggumtak.myamgi.update.UiOtaStore.MAX_ATTEMPTS) {
            // Started again and again without ever reporting ready (crashes, error screens): give up on it now.
            val v = rt.otaStore.rollback("not ready after repeated starts")
            rt.log.error("UI bundle $v rolled back after repeated starts")
            toast("새 화면을 열지 못해 기본 화면으로 되돌렸습니다.")
            handler.post { reloadUi() }
            return
        }
        val r = Runnable {
            otaWatchdog = null
            if (rt.uiReadyThisPage || !rt.otaStore.state().pending) return@Runnable
            val v = rt.otaStore.rollback("no ui.ready within ${OTA_READY_TIMEOUT_MILLIS / 1000}s")
            rt.log.error("UI bundle $v did not report ready; rolled back to the built-in bundle")
            toast("새 화면을 열지 못해 기본 화면으로 되돌렸습니다.")
            reloadUi()
        }
        otaWatchdog = r
        handler.postDelayed(r, OTA_READY_TIMEOUT_MILLIS)
    }

    // --- Back ---

    private fun onBackRequested() {
        val rt = runtime
        val wv = webView
        if (rt == null || wv == null || errorView != null) {
            finish()
            return
        }
        val connected = rt.server.events.subscriberCount > 0
        when (val d = back.onBack(connected, "back-ack" in rt.uiFeatures)) {
            BackCoordinator.Decision.FallBack -> fallbackBack()
            is BackCoordinator.Decision.Publish -> {
                rt.publish("back", HostRuntime.json("id" to d.id))
                if (d.awaitAck) handler.postDelayed({ if (back.onTimeout(d.id)) fallbackBack() }, back.ackTimeoutMillis)
            }
        }
    }

    override fun onBackHandled(id: Long) = back.onAck(id)

    private fun fallbackBack() {
        val wv = webView
        if (wv != null && wv.canGoBack()) wv.goBack() else finish()
    }

    // --- Keys ---

    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        val rt = runtime
        val wv = webView
        val dom = ShellKeys.domKeyFor(event.keyCode)
        if (rt != null && wv != null && dom != null &&
            ShellKeys.shouldCapture(event.keyCode, rt.volumeKeysEnabled(), rt.uiState.captureKeys, errorView == null)
        ) {
            when (event.action) {
                KeyEvent.ACTION_DOWN -> wv.evaluateJavascript(ShellKeys.script(dom, "keydown", event.repeatCount > 0), null)
                KeyEvent.ACTION_UP -> wv.evaluateJavascript(ShellKeys.script(dom, "keyup", false), null)
            }
            return true
        }
        // Keyboard keys belong to the page even when focus wandered off the WebView.
        if (wv != null && errorView == null && !wv.hasFocus() && event.keyCode != KeyEvent.KEYCODE_BACK &&
            event.action == KeyEvent.ACTION_DOWN && event.isPrintingKey
        ) {
            wv.requestFocus()
        }
        return super.dispatchKeyEvent(event)
    }

    // --- Colours / system bars ---

    private var currentBackground: Int = Color.WHITE

    private fun applyColors(state: UiShellState) {
        val systemDark = !BuildConfig.IS_COMET &&
            (resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES
        val dark = when (state.theme) {
            "dark" -> true
            "light", "eink" -> false
            else -> systemDark
        }
        val bg = state.background?.let { runCatching { Color.parseColor(it.trim()) }.getOrNull() }
            ?: if (dark) Color.parseColor("#121316") else Color.WHITE
        currentBackground = bg
        root.setBackgroundColor(bg)
        window.setBackgroundDrawable(ColorDrawable(bg))
        webView?.setBackgroundColor(bg)
        val style = if (dark) SystemBarStyle.dark(Color.TRANSPARENT) else SystemBarStyle.light(Color.TRANSPARENT, Color.TRANSPARENT)
        enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
    }

    // --- Native error screen ---

    private fun showError(message: String, t: Throwable?) {
        if (t != null) runtime?.log?.error(message, t)
        errorText = message + (t?.let { "\n" + it.toString() } ?: "")
        otaWatchdog?.let { handler.removeCallbacks(it) }
        otaWatchdog = null
        destroyWebView()
        hideError()
        val pad = dp(24)
        val box = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(pad, pad, pad, pad)
        }
        val fg = if (currentBackground == Color.WHITE || Color.luminance(currentBackground) > 0.5f) Color.BLACK else Color.WHITE
        box.addView(TextView(this).apply {
            text = "화면을 표시하지 못했습니다"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
            setTextColor(fg)
            gravity = Gravity.CENTER
        })
        box.addView(TextView(this).apply {
            text = message
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 16f)
            setTextColor(fg)
            gravity = Gravity.CENTER
            setPadding(0, dp(12), 0, dp(24))
        })
        box.addView(Button(this).apply {
            text = "다시 시도"
            minHeight = dp(56)
            setOnClickListener { retry() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        box.addView(Button(this).apply {
            text = "오류 로그 복사"
            minHeight = dp(56)
            setOnClickListener { copyErrorLog() }
        }, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT).apply { topMargin = dp(8) })
        val scroll = ScrollView(this).apply {
            isFillViewport = true
            addView(box)
        }
        errorView = scroll
        content.addView(scroll, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
    }

    private fun hideError() {
        errorView?.let { content.removeView(it) }
        errorView = null
    }

    private fun retry() {
        if (runtime == null) {
            // The engine failed to start: a new process is the only real retry.
            recreate()
            return
        }
        reloadUi()
    }

    private fun copyErrorLog() {
        val rt = runtime
        val text = buildString {
            appendLine("myAmgi ${BuildConfig.VERSION_NAME} (${BuildConfig.FLAVOR_NAME}, build ${BuildConfig.VERSION_CODE})")
            appendLine("${Build.MANUFACTURER} ${Build.MODEL}, Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            rt?.let { appendLine("UI ${it.server.ui.version()} (${if (it.otaServed()) "ota" else "builtin"})") }
            errorText?.let { appendLine("오류: $it") }
            rt?.log?.snapshot()?.first?.takeLast(200)?.forEach { appendLine(it) }
        }
        val cm = getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
        cm.setPrimaryClip(ClipData.newPlainText("myAmgi 오류 로그", text))
        toast("오류 로그를 복사했습니다.")
    }

    private fun toast(msg: String) = Toast.makeText(this, msg, Toast.LENGTH_SHORT).show()

    private fun dp(v: Int): Int = (v * resources.displayMetrics.density).toInt()

    companion object {
        private const val KEY_URL = "amgi.url"
        private const val KEY_TOKEN = "amgi.token"
        private const val KEY_SAVE_PATH = "amgi.save.path"
        private const val KEY_SAVE_NAME = "amgi.save.name"
        const val OTA_READY_TIMEOUT_MILLIS = 30_000L
    }
}
