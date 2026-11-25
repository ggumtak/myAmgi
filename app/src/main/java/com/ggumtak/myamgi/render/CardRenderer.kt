package com.ggumtak.myamgi.render

import android.content.Context
import anki.card_rendering.RenderCardResponse
import anki.card_rendering.RenderedTemplateNode
import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.update.AssetLoader
import org.json.JSONObject

data class RenderedCard(
    val cardId: Long,
    val noteId: Long,
    val questionHtml: String,
    val answerHtml: String,
    val css: String,
    val questionSounds: List<String>,
    val answerSounds: List<String>
)

/**
 * Converts Anki 26.09.4 [RenderCardResponse] nodes into WebView-ready HTML and zero-flash DOM swap JSON.
 */
object CardRenderer {
    const val MEDIA_HOST = "https://appassets.androidplatform.net"

    private val SOUND_TAG_REGEX = Regex("""\[sound:([^\[\]]+)\]""")

    fun render(cardId: Long): RenderedCard {
        val card = AnkiEngine.getCard(cardId)
        val response = AnkiEngine.renderExistingCard(cardId)
        return fromResponse(
            cardId = cardId,
            noteId = card.noteId,
            response = response
        )
    }

    fun fromResponse(
        cardId: Long,
        noteId: Long,
        response: RenderCardResponse
    ): RenderedCard {
        val rawQuestion = nodesToHtml(response.questionNodesList)
        val rawAnswer = nodesToHtml(response.answerNodesList)

        val (questionHtml, questionSounds) = extractAndReplaceSounds(rawQuestion)
        val (answerHtml, answerSounds) = extractAndReplaceSounds(rawAnswer)

        return RenderedCard(
            cardId = cardId,
            noteId = noteId,
            questionHtml = questionHtml,
            answerHtml = answerHtml,
            css = response.css,
            questionSounds = questionSounds,
            answerSounds = answerSounds
        )
    }

    fun buildFullHtml(
        context: Context,
        rendered: RenderedCard,
        isAnswer: Boolean,
        isDark: Boolean,
        isEink: Boolean,
        hanjaJs: String?
    ): String {
        val baseCss = runCatching { AssetLoader.readText(context, "card/card-base.css") }.getOrDefault("")
        val bridgeJs = runCatching { AssetLoader.readText(context, "card/card-bridge.js") }.getOrDefault("")

        val htmlClass = buildHtmlClass(isDark = isDark, isEink = isEink)
        val bodyClass = buildBodyClass(isDark = isDark, isEink = isEink)
        val bodyContent = if (isAnswer) rendered.answerHtml else rendered.questionHtml
        val safeDeckCss = escapeStyleContent(rendered.css)
        val safeBaseCss = escapeStyleContent(baseCss)
        val safeBridgeJs = escapeScriptContent(bridgeJs)
        val hanjaBlock = if (!hanjaJs.isNullOrBlank()) {
            val safeHanjaJs = escapeScriptContent(hanjaJs)
            """
            <script id="myamgi-hanja-tap">
            $safeHanjaJs
            if (window.__hjtapRun) {
              window.__hjtapRun();
            } else if (window.__hjCode && typeof window.__hjCode[9] === 'function') {
              window.__hjCode[9]();
            }
            </script>
            """.trimIndent()
        } else {
            ""
        }

        return buildString {
            append("<!DOCTYPE html>\n")
            append("<html class=\"").append(escapeHtmlAttr(htmlClass)).append("\">\n")
            append("<head>\n")
            append("<meta charset=\"utf-8\">\n")
            append("<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes\">\n")
            append("<base href=\"").append(MEDIA_HOST).append("/media/\">\n")
            append("<style id=\"myamgi-base-style\">\n")
            append(safeBaseCss).append('\n')
            append("</style>\n")
            append("<style id=\"myamgi-deck-style\">\n")
            append(safeDeckCss).append('\n')
            append("</style>\n")
            append("</head>\n")
            append("<body class=\"").append(escapeHtmlAttr(bodyClass)).append("\">\n")
            append("<div id=\"qa\">").append(bodyContent).append("</div>\n")
            append("<script>\n")
            append("window.__myAmgiEinkMode = ").append(isEink).append(";\n")
            append("window.__myAmgiMediaBase = \"").append(MEDIA_HOST).append("/media/\";\n")
            append("window.__myAmgiState = { cardId: ").append(rendered.cardId)
                .append(", noteId: ").append(rendered.noteId)
                .append(", isAnswer: ").append(isAnswer).append(" };\n")
            append("</script>\n")
            append("<script id=\"myamgi-card-bridge\">\n")
            append(safeBridgeJs).append('\n')
            append("</script>\n")
            if (hanjaBlock.isNotEmpty()) {
                append(hanjaBlock).append('\n')
            }
            append("<script>\n")
            append("if (window.__myAmgiRunHooks) { window.__myAmgiRunHooks(); }\n")
            append("</script>\n")
            append("</body>\n")
            append("</html>")
        }
    }

    fun buildSwapPayloadJson(
        rendered: RenderedCard,
        isAnswer: Boolean,
        isDark: Boolean,
        isEink: Boolean
    ): String {
        val obj = JSONObject()
        obj.put("cardId", rendered.cardId)
        obj.put("noteId", rendered.noteId)
        obj.put("isAnswer", isAnswer)
        obj.put("htmlClass", buildHtmlClass(isDark = isDark, isEink = isEink))
        obj.put("bodyClass", buildBodyClass(isDark = isDark, isEink = isEink))
        obj.put("css", rendered.css)
        obj.put("html", if (isAnswer) rendered.answerHtml else rendered.questionHtml)
        return obj.toString()
    }

    private fun nodesToHtml(nodes: List<RenderedTemplateNode>): String {
        if (nodes.isEmpty()) return ""
        return buildString {
            for (node in nodes) {
                when (node.valueCase) {
                    RenderedTemplateNode.ValueCase.TEXT -> append(node.text)
                    RenderedTemplateNode.ValueCase.REPLACEMENT -> append(node.replacement.currentText)
                    RenderedTemplateNode.ValueCase.VALUE_NOT_SET, null -> Unit
                }
            }
        }
    }

    private fun extractAndReplaceSounds(html: String): Pair<String, List<String>> {
        val sounds = mutableListOf<String>()
        val replaced = SOUND_TAG_REGEX.replace(html) { match ->
            val filename = match.groupValues[1].trim()
            if (filename.isNotEmpty()) {
                sounds += filename
            }
            val escapedAttr = escapeHtmlAttr(filename)
            "<a class=\"replay-button soundLink tappable\" href=\"#\" " +
                "data-myamgi-sound=\"$escapedAttr\" " +
                "onclick=\"if(window.MyAmgiBridge)window.MyAmgiBridge.playAudio(this.dataset.myamgiSound);return false;\">" +
                "▶</a>"
        }
        return replaced to sounds
    }

    private fun buildHtmlClass(isDark: Boolean, isEink: Boolean): String {
        val classes = mutableListOf<String>()
        if (isEink) {
            classes += "eink_mode"
        } else if (isDark) {
            classes += "night_mode"
        }
        return classes.joinToString(" ")
    }

    private fun buildBodyClass(isDark: Boolean, isEink: Boolean): String {
        val classes = mutableListOf("card", "card1")
        if (isEink) {
            classes += "eink_mode"
        } else if (isDark) {
            classes += "night_mode"
            classes += "nightMode"
        }
        return classes.joinToString(" ")
    }

    private fun escapeHtmlAttr(value: String): String {
        return buildString(value.length) {
            for (ch in value) {
                when (ch) {
                    '&' -> append("&amp;")
                    '"' -> append("&quot;")
                    '\'' -> append("&#39;")
                    '<' -> append("&lt;")
                    '>' -> append("&gt;")
                    else -> append(ch)
                }
            }
        }
    }

    private fun escapeStyleContent(css: String): String {
        return css.replace("</style", "<\\/style", ignoreCase = true)
    }

    private fun escapeScriptContent(js: String): String {
        return js.replace("</script", "<\\/script", ignoreCase = true)
    }
}
