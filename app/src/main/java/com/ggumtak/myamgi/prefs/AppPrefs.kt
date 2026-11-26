package com.ggumtak.myamgi.prefs

import android.content.Context
import android.content.SharedPreferences
import com.ggumtak.myamgi.device.DeviceProfile

/**
 * Read-only access to the SharedPreferences of the native UI (builds ≤ 11), used once by
 * [com.ggumtak.myamgi.host.LegacyMigration]. The web UI keeps its settings in the host prefs.
 * Nothing is deleted here: Supabase keys and other old values stay in the file untouched.
 */
object AppPrefs {
    private const val PREF_NAME = "myamgi_prefs"
    private val THEMES = setOf("auto", "light", "dark", "eink")

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    /**
     * Host-pref keys of the web UI → the value the native UI was using (explicit, or its default), so an
     * upgraded install studies the way it did. Empty for a fresh install (no native settings file).
     */
    fun legacyUiPrefs(context: Context): Map<String, Any> {
        val p = prefs(context)
        if (p.all.isEmpty()) return emptyMap()
        val out = LinkedHashMap<String, Any>()
        out["volumeKeys"] = p.getBoolean("volume_key_study", DeviceProfile.current(context).defaultVolumeKeyStudy)
        // The native reviewer defaulted to two buttons on every device.
        out["twoButtons"] = p.getBoolean("two_button_mode", true)
        if (p.contains("tap_to_flip")) out["tapToShowAnswer"] = p.getBoolean("tap_to_flip", false)
        p.getString("theme_mode", null)?.takeIf { it in THEMES }?.let { out["theme"] = it }
        return out
    }

    data class AnkiWebLogin(val user: String, val hkey: String, val endpoint: String)

    fun legacyAnkiWebLogin(context: Context): AnkiWebLogin? {
        val p = prefs(context)
        val hkey = p.getString("aw_hkey", "").orEmpty()
        if (hkey.isBlank()) return null
        return AnkiWebLogin(p.getString("aw_user", "").orEmpty(), hkey, p.getString("aw_endpoint", "").orEmpty())
    }
}
