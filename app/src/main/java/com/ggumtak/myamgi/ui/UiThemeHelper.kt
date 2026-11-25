package com.ggumtak.myamgi.ui

import android.app.Activity
import android.content.Context
import android.content.res.ColorStateList
import android.content.res.Configuration
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.text.TextUtils
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import com.ggumtak.myamgi.R
import com.ggumtak.myamgi.device.DeviceProfile
import com.ggumtak.myamgi.prefs.AppPrefs

/**
 * Shared theme, color palette, and E-Ink-safe UI helpers for Pro and Comet builds.
 *
 * - On Comet / E-Ink mode: 46dp compact topbar, zero transition animations, zero ripples/elevation,
 *   high-contrast pure black/white surfaces with 1.5dp-2dp solid black borders.
 * - On Pro mode: 56dp topbar, Material Day/Night palette, rounded surfaces.
 */
object UiThemeHelper {

    data class Palette(
        val isEink: Boolean,
        val isDark: Boolean,
        val background: Int,
        val surface: Int,
        val surfaceAlt: Int,
        val textPrimary: Int,
        val textSecondary: Int,
        val divider: Int,
        val accent: Int,
        val onAccent: Int,
        val border: Int,
        val againColor: Int,
        val hardColor: Int,
        val goodColor: Int,
        val easyColor: Int,
        val newCountColor: Int,
        val learnCountColor: Int,
        val reviewCountColor: Int
    )

    fun isEinkActive(context: Context): Boolean {
        val mode = AppPrefs.getThemeMode(context)
        return mode == AppPrefs.THEME_EINK || DeviceProfile.current(context).isEink
    }

    fun isDarkActive(context: Context): Boolean {
        if (isEinkActive(context)) return false
        return when (AppPrefs.getThemeMode(context)) {
            AppPrefs.THEME_DARK -> true
            AppPrefs.THEME_LIGHT -> false
            else -> {
                val mask = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK
                mask == Configuration.UI_MODE_NIGHT_YES
            }
        }
    }

    fun applyActivityTheme(activity: AppCompatActivity) {
        val profile = DeviceProfile.current(activity)
        val themeMode = AppPrefs.getThemeMode(activity)
        val eink = themeMode == AppPrefs.THEME_EINK || profile.isEink

        if (eink) {
            AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_NO)
            activity.setTheme(R.style.Theme_MyAmgi_Eink)
            @Suppress("DEPRECATION")
            activity.overridePendingTransition(0, 0)
        } else {
            val nightMode = when (themeMode) {
                AppPrefs.THEME_DARK -> AppCompatDelegate.MODE_NIGHT_YES
                AppPrefs.THEME_LIGHT -> AppCompatDelegate.MODE_NIGHT_NO
                else -> AppCompatDelegate.MODE_NIGHT_FOLLOW_SYSTEM
            }
            AppCompatDelegate.setDefaultNightMode(nightMode)
            activity.setTheme(R.style.Theme_MyAmgi)
        }
    }

    fun disableExitAnimationIfEink(activity: Activity) {
        if (isEinkActive(activity) || !DeviceProfile.current(activity).enableAnimations) {
            @Suppress("DEPRECATION")
            activity.overridePendingTransition(0, 0)
        }
    }

    fun palette(context: Context): Palette {
        val eink = isEinkActive(context)
        if (eink) {
            return Palette(
                isEink = true,
                isDark = false,
                background = Color.WHITE,
                surface = Color.WHITE,
                surfaceAlt = Color.WHITE,
                textPrimary = Color.BLACK,
                textSecondary = Color.BLACK,
                divider = Color.BLACK,
                accent = Color.BLACK,
                onAccent = Color.WHITE,
                border = Color.BLACK,
                againColor = Color.BLACK,
                hardColor = Color.BLACK,
                goodColor = Color.BLACK,
                easyColor = Color.BLACK,
                newCountColor = Color.BLACK,
                learnCountColor = Color.BLACK,
                reviewCountColor = Color.BLACK
            )
        }

        val dark = isDarkActive(context)
        return if (dark) {
            Palette(
                isEink = false,
                isDark = true,
                background = Color.parseColor("#111318"),
                surface = Color.parseColor("#1B1F27"),
                surfaceAlt = Color.parseColor("#252B36"),
                textPrimary = Color.parseColor("#F1F5F9"),
                textSecondary = Color.parseColor("#94A3B8"),
                divider = Color.parseColor("#2E3644"),
                accent = Color.parseColor("#60A5FA"),
                onAccent = Color.parseColor("#0B1220"),
                border = Color.parseColor("#384152"),
                againColor = Color.parseColor("#EF4444"),
                hardColor = Color.parseColor("#F59E0B"),
                goodColor = Color.parseColor("#22C55E"),
                easyColor = Color.parseColor("#3B82F6"),
                newCountColor = Color.parseColor("#60A5FA"),
                learnCountColor = Color.parseColor("#F87171"),
                reviewCountColor = Color.parseColor("#4ADE80")
            )
        } else {
            Palette(
                isEink = false,
                isDark = false,
                background = Color.parseColor("#F4F6FA"),
                surface = Color.parseColor("#FFFFFF"),
                surfaceAlt = Color.parseColor("#EEF2F7"),
                textPrimary = Color.parseColor("#111827"),
                textSecondary = Color.parseColor("#4B5563"),
                divider = Color.parseColor("#E5E7EB"),
                accent = Color.parseColor("#2563EB"),
                onAccent = Color.WHITE,
                border = Color.parseColor("#D1D5DB"),
                againColor = Color.parseColor("#DC2626"),
                hardColor = Color.parseColor("#D97706"),
                goodColor = Color.parseColor("#16A34A"),
                easyColor = Color.parseColor("#2563EB"),
                newCountColor = Color.parseColor("#2563EB"),
                learnCountColor = Color.parseColor("#DC2626"),
                reviewCountColor = Color.parseColor("#16A34A")
            )
        }
    }

    fun dp(context: Context, value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            context.resources.displayMetrics
        ).toInt()
    }

    fun topBarHeightPx(context: Context): Int {
        val profile = DeviceProfile.current(context)
        val dpVal = if (isEinkActive(context)) 46 else profile.compactTopBarDp
        return dp(context, dpVal)
    }

    fun makeCardBackground(
        context: Context,
        fillColor: Int,
        strokeColor: Int,
        cornerDp: Int = 10,
        strokeDp: Float = 1f
    ): GradientDrawable {
        val eink = isEinkActive(context)
        val radius = if (eink) dp(context, 4).toFloat() else dp(context, cornerDp).toFloat()
        val strokePx = TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            if (eink) maxOf(strokeDp, 1.5f) else strokeDp,
            context.resources.displayMetrics
        ).toInt()
        return GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = radius
            setColor(fillColor)
            if (strokePx > 0) {
                setStroke(strokePx, strokeColor)
            }
        }
    }

    fun styleButton(
        button: Button,
        context: Context,
        filled: Boolean = false,
        accentOverride: Int? = null,
        cornerDp: Int = 8
    ) {
        val p = palette(context)
        val fill = if (filled) (accentOverride ?: p.accent) else p.surface
        val textColor = if (filled) (if (p.isEink) Color.WHITE else Color.WHITE) else p.textPrimary
        val stroke = if (p.isEink) Color.BLACK else (if (filled) fill else p.border)

        button.background = makeCardBackground(
            context = context,
            fillColor = fill,
            strokeColor = stroke,
            cornerDp = cornerDp,
            strokeDp = if (p.isEink) 2f else 1f
        )
        button.setTextColor(textColor)
        button.isAllCaps = false
        button.minHeight = 0
        button.minimumHeight = 0
        button.minWidth = 0
        button.minimumWidth = 0
        button.stateListAnimator = null
        button.elevation = 0f
        if (p.isEink) {
            button.foreground = null
        }
    }

    fun createStyledButton(
        context: Context,
        label: String,
        filled: Boolean = false,
        accentOverride: Int? = null,
        textSizeSp: Float = 13f,
        horizontalPadDp: Int = 10,
        verticalPadDp: Int = 6
    ): Button {
        return Button(context).apply {
            text = label
            setTextSize(TypedValue.COMPLEX_UNIT_SP, textSizeSp)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(dp(context, horizontalPadDp), dp(context, verticalPadDp), dp(context, horizontalPadDp), dp(context, verticalPadDp))
            styleButton(this, context, filled = filled, accentOverride = accentOverride)
        }
    }

    fun createTopBar(
        activity: AppCompatActivity,
        title: String,
        showBack: Boolean = true,
        onBack: (() -> Unit)? = null
    ): Triple<LinearLayout, TextView, LinearLayout> {
        val p = palette(activity)
        val height = topBarHeightPx(activity)

        val container = LinearLayout(activity).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(p.surface)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }

        val row = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(activity, 8), 0, dp(activity, 8), 0)
            layoutParams = LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, height)
        }

        if (showBack) {
            val backBtn = createStyledButton(
                activity,
                "←",
                filled = false,
                textSizeSp = 15f,
                horizontalPadDp = 10,
                verticalPadDp = 4
            ).apply {
                contentDescription = "뒤로"
                setOnClickListener {
                    if (onBack != null) onBack() else activity.finish()
                }
            }
            val lp = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                dp(activity, if (p.isEink) 34 else 38)
            ).apply {
                marginEnd = dp(activity, 8)
            }
            row.addView(backBtn, lp)
        }

        val titleView = TextView(activity).apply {
            text = title
            setTextColor(p.textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, if (p.isEink) 16f else 17f)
            typeface = Typeface.DEFAULT_BOLD
            maxLines = 1
            ellipsize = TextUtils.TruncateAt.END
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        row.addView(titleView)

        val actionsRow = LinearLayout(activity).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT
            )
        }
        row.addView(actionsRow)

        val divider = View(activity).apply {
            setBackgroundColor(if (p.isEink) Color.BLACK else p.divider)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(activity, if (p.isEink) 2 else 1)
            )
        }

        container.addView(row)
        container.addView(divider)
        return Triple(container, titleView, actionsRow)
    }

    fun addTopBarButton(
        context: Context,
        actionsRow: LinearLayout,
        label: String,
        filled: Boolean = false,
        onClick: () -> Unit
    ): Button {
        val p = palette(context)
        val btn = createStyledButton(
            context,
            label,
            filled = filled,
            textSizeSp = if (p.isEink) 12f else 13f,
            horizontalPadDp = 9,
            verticalPadDp = 4
        ).apply {
            setOnClickListener { onClick() }
        }
        val lp = LinearLayout.LayoutParams(
            ViewGroup.LayoutParams.WRAP_CONTENT,
            dp(context, if (p.isEink) 34 else 36)
        ).apply {
            marginStart = dp(context, 6)
        }
        actionsRow.addView(btn, lp)
        return btn
    }

    fun makeDivider(context: Context): View {
        val p = palette(context)
        return View(context).apply {
            setBackgroundColor(if (p.isEink) Color.BLACK else p.divider)
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(context, 1)
            )
        }
    }

    fun makeSectionHeader(context: Context, text: String): TextView {
        val p = palette(context)
        return TextView(context).apply {
            this.text = text
            setTextColor(p.textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            typeface = Typeface.DEFAULT_BOLD
            setPadding(0, dp(context, 10), 0, dp(context, 6))
        }
    }

    fun makeLabel(context: Context, text: String, secondary: Boolean = false, sizeSp: Float = 13f): TextView {
        val p = palette(context)
        return TextView(context).apply {
            this.text = text
            setTextColor(if (secondary) p.textSecondary else p.textPrimary)
            setTextSize(TypedValue.COMPLEX_UNIT_SP, sizeSp)
        }
    }

    fun makeInputBox(context: Context, hintText: String = ""): android.widget.EditText {
        val p = palette(context)
        return android.widget.EditText(context).apply {
            hint = hintText
            setTextColor(p.textPrimary)
            setHintTextColor(ColorStateList.valueOf(p.textSecondary))
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setPadding(dp(context, 12), dp(context, 10), dp(context, 12), dp(context, 10))
            background = makeCardBackground(
                context,
                fillColor = if (p.isEink) Color.WHITE else p.surface,
                strokeColor = p.border,
                cornerDp = 8,
                strokeDp = if (p.isEink) 1.5f else 1f
            )
        }
    }
}
