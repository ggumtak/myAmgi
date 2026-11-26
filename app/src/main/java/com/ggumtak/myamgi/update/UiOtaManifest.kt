package com.ggumtak.myamgi.update

import com.ggumtak.myamgi.host.UiBundle
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull
import java.util.Locale

/**
 * `ui-manifest.json` on the `update-files` release, written by `tools/make_ui_bundle.py`:
 * `{"version": "1.0.<n>", "url": "https://…/myAmgi-ui-1.0.<n>.zip", "sha256": "<hex>", "size": <bytes>, "minApkBuild": <n>}`.
 */
data class UiOtaManifest(
    val version: String,
    val url: String,
    val sha256: String,
    val size: Long,
    val minApkBuild: Int
) {
    enum class Decision { INSTALL, UP_TO_DATE, NEEDS_NEWER_APK, KNOWN_BAD }

    /**
     * What to do with this manifest. [installedVersion] is the version the app shows now (OTA when active,
     * otherwise built-in); a bundle that is not newer than both is never installed.
     */
    fun decide(apkBuild: Int, builtInVersion: String?, installedVersion: String?, badVersions: Set<String>): Decision {
        for (v in listOfNotNull(builtInVersion, installedVersion)) {
            if (UiBundle.compareVersions(version, v) <= 0) return Decision.UP_TO_DATE
        }
        if (version in badVersions) return Decision.KNOWN_BAD
        if (apkBuild < minApkBuild) return Decision.NEEDS_NEWER_APK
        return Decision.INSTALL
    }

    companion object {
        const val NAME = "ui-manifest.json"
        const val MAX_ZIP_BYTES = 60L * 1024 * 1024
        private val VERSION = Regex("^\\d{1,9}(\\.\\d{1,9}){1,3}$")
        private val SHA256 = Regex("^[0-9a-f]{64}$")

        /** Parses and validates; throws [IllegalArgumentException] with the reason. */
        fun parse(json: String): UiOtaManifest {
            val o: JsonObject = runCatching { Json.parseToJsonElement(json).jsonObject }.getOrNull()
                ?: throw IllegalArgumentException("manifest is not a JSON object")
            fun s(k: String) = (o[k] as? JsonPrimitive)?.contentOrNull?.trim()
            val version = s("version") ?: throw IllegalArgumentException("version missing")
            require(VERSION.matches(version)) { "bad version: $version" }
            val url = s("url") ?: throw IllegalArgumentException("url missing")
            require(url.startsWith("https://")) { "url must be https: $url" }
            val sha = s("sha256")?.lowercase(Locale.ROOT) ?: throw IllegalArgumentException("sha256 missing")
            require(SHA256.matches(sha)) { "bad sha256" }
            val size = (o["size"] as? JsonPrimitive)?.longOrNull ?: throw IllegalArgumentException("size missing")
            require(size in 1..MAX_ZIP_BYTES) { "bad size: $size" }
            val minApk = (o["minApkBuild"] as? JsonPrimitive)?.let { it.longOrNull ?: throw IllegalArgumentException("bad minApkBuild") } ?: 0L
            require(minApk in 0..Int.MAX_VALUE) { "bad minApkBuild: $minApk" }
            return UiOtaManifest(version, url, sha, size, minApk.toInt())
        }
    }
}
