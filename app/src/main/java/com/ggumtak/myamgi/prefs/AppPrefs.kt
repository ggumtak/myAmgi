package com.ggumtak.myamgi.prefs

import android.content.Context
import android.content.SharedPreferences
import com.ggumtak.myamgi.device.DeviceProfile

/**
 * Persistent preferences for myAmgi.
 * Default study mode is 2-button high-speed mode (`twoButtonMode = true`), synced across all devices.
 */
object AppPrefs {
    private const val PREF_NAME = "myamgi_prefs"

    const val THEME_AUTO = "auto"
    const val THEME_LIGHT = "light"
    const val THEME_DARK = "dark"
    const val THEME_EINK = "eink"

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREF_NAME, Context.MODE_PRIVATE)

    fun isTwoButtonMode(context: Context): Boolean =
        prefs(context).getBoolean("two_button_mode", true)

    fun setTwoButtonMode(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean("two_button_mode", enabled).apply()
    }

    fun getThemeMode(context: Context): String {
        val defaultTheme = if (DeviceProfile.current(context).isEink) THEME_EINK else THEME_AUTO
        return prefs(context).getString("theme_mode", defaultTheme) ?: defaultTheme
    }

    fun setThemeMode(context: Context, mode: String) {
        prefs(context).edit().putString("theme_mode", mode).apply()
    }

    fun isVolumeKeyStudy(context: Context): Boolean {
        val def = DeviceProfile.current(context).defaultVolumeKeyStudy
        return prefs(context).getBoolean("volume_key_study", def)
    }

    fun setVolumeKeyStudy(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean("volume_key_study", enabled).apply()
    }

    fun isHanjaAutoInject(context: Context): Boolean =
        prefs(context).getBoolean("hanja_auto_inject", true)

    fun setHanjaAutoInject(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean("hanja_auto_inject", enabled).apply()
    }

    fun isTapToFlip(context: Context): Boolean =
        prefs(context).getBoolean("tap_to_flip", false)

    fun setTapToFlip(context: Context, enabled: Boolean) {
        prefs(context).edit().putBoolean("tap_to_flip", enabled).apply()
    }

    // --- Supabase Sync ---
    fun getSupabaseUrl(context: Context): String = prefs(context).getString("sb_url", "") ?: ""
    fun getSupabaseAnonKey(context: Context): String = prefs(context).getString("sb_key", "") ?: ""
    fun getSupabaseEmail(context: Context): String = prefs(context).getString("sb_email", "") ?: ""
    fun getSupabaseAccessToken(context: Context): String = prefs(context).getString("sb_access", "") ?: ""
    fun getSupabaseRefreshToken(context: Context): String = prefs(context).getString("sb_refresh", "") ?: ""
    fun getSupabaseUserId(context: Context): String = prefs(context).getString("sb_uid", "") ?: ""

    fun saveSupabaseSession(
        context: Context,
        url: String,
        anonKey: String,
        email: String,
        accessToken: String,
        refreshToken: String,
        userId: String
    ) {
        prefs(context).edit()
            .putString("sb_url", url.trim().trimEnd('/'))
            .putString("sb_key", anonKey.trim())
            .putString("sb_email", email.trim())
            .putString("sb_access", accessToken)
            .putString("sb_refresh", refreshToken)
            .putString("sb_uid", userId)
            .apply()
    }

    fun clearSupabaseSession(context: Context) {
        prefs(context).edit()
            .remove("sb_access")
            .remove("sb_refresh")
            .remove("sb_uid")
            .apply()
    }

    fun getLastSyncTime(context: Context): Long = prefs(context).getLong("last_sync_ms", 0L)
    fun setLastSyncTime(context: Context, ms: Long) {
        prefs(context).edit().putLong("last_sync_ms", ms).apply()
    }

    // --- AnkiWeb Secondary Sync ---
    fun getAnkiWebUser(context: Context): String = prefs(context).getString("aw_user", "") ?: ""
    fun getAnkiWebHkey(context: Context): String = prefs(context).getString("aw_hkey", "") ?: ""
    fun getAnkiWebEndpoint(context: Context): String = prefs(context).getString("aw_endpoint", "") ?: ""

    fun saveAnkiWebAuth(context: Context, user: String, hkey: String, endpoint: String) {
        prefs(context).edit()
            .putString("aw_user", user)
            .putString("aw_hkey", hkey)
            .putString("aw_endpoint", endpoint)
            .apply()
    }

    fun clearAnkiWebAuth(context: Context) {
        prefs(context).edit()
            .remove("aw_user")
            .remove("aw_hkey")
            .remove("aw_endpoint")
            .apply()
    }

    // --- OTA ---
    fun getOtaVersion(context: Context): Int = prefs(context).getInt("ota_version", 0)
    fun setOtaVersion(context: Context, version: Int) {
        prefs(context).edit().putInt("ota_version", version).apply()
    }
}
