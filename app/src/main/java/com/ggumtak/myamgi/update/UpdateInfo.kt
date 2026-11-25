package com.ggumtak.myamgi.update

import com.ggumtak.myamgi.BuildConfig
import org.json.JSONObject
import java.util.Locale

/**
 * Flavor-aware parser for the rolling GitHub `latest` release.
 * Ensures Pro (`myAmgi-Pro`) and Comet (`myAmgi-Comet`) APKs and binary delta patches never mix.
 */
object UpdateInfo {
    const val LATEST_URL = "https://api.github.com/repos/ggumtak/myAmgi/releases/tags/latest"

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

    fun parse(json: String, prefix: String = BuildConfig.APK_PREFIX): Latest? {
        val root = runCatching { JSONObject(json) }.getOrNull() ?: return null
        val assets = root.optJSONArray("assets") ?: return null

        val escapedPrefix = Regex.escape(prefix)
        val apkRegex = Regex("""^$escapedPrefix-(\d+)\.apk$""")
        val patchRegex = Regex("""^$escapedPrefix-(\d+)\.from-(\d+)\.patch$""")

        var bestBuild = -1
        var bestUrl = ""
        var bestSize = -1L
        val allPatches = ArrayList<Pair<Int, Patch>>()

        for (i in 0 until assets.length()) {
            val asset = assets.optJSONObject(i) ?: continue
            val name = asset.optString("name", "")
            val url = asset.optString("browser_download_url", "")
            if (!url.startsWith("https://")) continue
            val size = asset.optLong("size", -1L)

            patchRegex.matchEntire(name)?.groupValues?.let { groups ->
                val targetBuild = groups[1].toIntOrNull()
                val fromBuild = groups[2].toIntOrNull()
                if (targetBuild != null && fromBuild != null) {
                    allPatches.add(targetBuild to Patch(from = fromBuild, url = url, size = size))
                }
            }

            apkRegex.matchEntire(name)?.groupValues?.let { groups ->
                val build = groups[1].toIntOrNull()
                if (build != null && build > bestBuild) {
                    bestBuild = build
                    bestUrl = url
                    bestSize = size
                }
            }
        }

        if (bestBuild <= 0 || bestUrl.isEmpty()) return null

        val matchingPatches = allPatches
            .filter { it.first == bestBuild }
            .map { it.second }
            .sortedByDescending { it.from }

        return Latest(
            build = bestBuild,
            url = bestUrl,
            size = bestSize,
            patches = matchingPatches,
            flavorPrefix = prefix
        )
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
