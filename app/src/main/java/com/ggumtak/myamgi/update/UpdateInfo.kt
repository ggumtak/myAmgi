package com.ggumtak.myamgi.update

import com.ggumtak.myamgi.BuildConfig
import org.json.JSONObject
import java.util.Locale

/**
 * Flavor-aware parser for the app's GitHub releases.
 *
 * - Release `latest` is the human download page: it holds only the installable APKs
 *   (`myAmgi-Pro-<n>.apk`, `myAmgi-Comet-<n>.apk`).
 * - Release `update-files` holds the machine files: binary delta patches
 *   (`<prefix>-<n>.from-<m>.patch`) and the UI bundle (`ui-manifest.json`, `myAmgi-ui-<version>.zip`).
 *
 * Ensures Pro (`myAmgi-Pro`) and Comet (`myAmgi-Comet`) APKs and binary delta patches never mix.
 */
object UpdateInfo {
    const val LATEST_TAG = "latest"
    const val UPDATE_FILES_TAG = "update-files"

    fun releaseApiUrl(tag: String, repo: String = BuildConfig.GITHUB_REPO): String =
        "https://api.github.com/repos/$repo/releases/tags/$tag"

    fun downloadUrl(tag: String, assetName: String, repo: String = BuildConfig.GITHUB_REPO): String =
        "https://github.com/$repo/releases/download/$tag/$assetName"

    /** GitHub API URL of the download page release (full APKs). */
    val LATEST_URL: String get() = releaseApiUrl(LATEST_TAG)

    /** GitHub API URL of the machine-file release (delta patches, UI bundle). */
    val UPDATE_FILES_URL: String get() = releaseApiUrl(UPDATE_FILES_TAG)

    data class Patch(
        val from: Int,
        val url: String,
        val size: Long
    )

    data class Latest(
        val build: Int,
        val url: String,
        val size: Long,
        val patches: List<Patch>,
        val flavorPrefix: String
    )

    fun fileName(build: Int, prefix: String = BuildConfig.APK_PREFIX): String =
        "$prefix-$build.apk"

    /**
     * Parses the `latest` release JSON ([json]) for the newest APK of [prefix].
     * Delta patches are collected from [updateFilesJson] (the `update-files` release) and, for
     * releases published before the split, from [json] itself. Patches are optional: when none
     * match, [Latest.patches] is empty and the updater downloads the full APK.
     */
    fun parse(
        json: String,
        prefix: String = BuildConfig.APK_PREFIX,
        updateFilesJson: String? = null
    ): Latest? {
        val assets = assetsOf(json) ?: return null

        val escapedPrefix = Regex.escape(prefix)
        val apkRegex = Regex("""^$escapedPrefix-(\d+)\.apk$""")
        val patchRegex = Regex("""^$escapedPrefix-(\d+)\.from-(\d+)\.patch$""")

        var bestBuild = -1
        var bestUrl = ""
        var bestSize = -1L
        for (asset in assets) {
            apkRegex.matchEntire(asset.name)?.groupValues?.let { groups ->
                val build = groups[1].toIntOrNull()
                if (build != null && build > bestBuild) {
                    bestBuild = build
                    bestUrl = asset.url
                    bestSize = asset.size
                }
            }
        }

        if (bestBuild <= 0 || bestUrl.isEmpty()) return null

        val patchAssets = assets + (updateFilesJson?.let { assetsOf(it) } ?: emptyList())
        val matchingPatches = patchAssets
            .mapNotNull { asset ->
                val groups = patchRegex.matchEntire(asset.name)?.groupValues ?: return@mapNotNull null
                val targetBuild = groups[1].toIntOrNull()
                val fromBuild = groups[2].toIntOrNull()
                if (targetBuild != bestBuild || fromBuild == null) null
                else Patch(from = fromBuild, url = asset.url, size = asset.size)
            }
            .distinctBy { it.from }
            .sortedByDescending { it.from }

        return Latest(
            build = bestBuild,
            url = bestUrl,
            size = bestSize,
            patches = matchingPatches,
            flavorPrefix = prefix
        )
    }

    private class Asset(val name: String, val url: String, val size: Long)

    /** Returns the release's downloadable assets, or null when [json] is not a release object. */
    private fun assetsOf(json: String): List<Asset>? {
        val root = runCatching { JSONObject(json) }.getOrNull() ?: return null
        val arr = root.optJSONArray("assets") ?: return null
        val out = ArrayList<Asset>(arr.length())
        for (i in 0 until arr.length()) {
            val asset = arr.optJSONObject(i) ?: continue
            val url = asset.optString("browser_download_url", "")
            if (!url.startsWith("https://")) continue
            out.add(Asset(asset.optString("name", ""), url, asset.optLong("size", -1L)))
        }
        return out
    }

    fun patchFor(latest: Latest, installedBuild: Int): Patch? =
        latest.patches.firstOrNull { patch ->
            patch.from == installedBuild &&
                patch.size > 0L &&
                (latest.size <= 0L || patch.size < latest.size * 65L / 100L)
        }

    fun isNewer(latest: Latest, current: Int): Boolean = latest.build > current

    fun sizeText(bytes: Long): String {
        if (bytes <= 0L) return "0MB"
        val mb = bytes / 1_048_576.0
        return if (mb < 10.0) {
            String.format(Locale.ROOT, "%.1fMB", mb)
        } else {
            String.format(Locale.ROOT, "%.0fMB", mb)
        }
    }

    fun progressText(percent: Int): String =
        if (percent < 0) "다운로드 중…" else "다운로드 중… $percent%"
}
