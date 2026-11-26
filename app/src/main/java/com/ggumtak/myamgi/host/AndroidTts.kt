package com.ggumtak.myamgi.host

import android.content.Context
import android.speech.tts.TextToSpeech
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger

/** `platform.tts` with the system [TextToSpeech]; created on first use, kept for the process. */
class AndroidTts(private val context: Context) {
    private val ready = CountDownLatch(1)

    @Volatile
    private var initStatus = TextToSpeech.ERROR
    private var engine: TextToSpeech? = null
    private val ids = AtomicInteger()

    @Synchronized
    private fun engine(): TextToSpeech {
        val existing = engine
        if (existing != null) return existing
        val created = TextToSpeech(context) { status ->
            initStatus = status
            ready.countDown()
        }
        engine = created
        return created
    }

    fun speak(text: String, lang: String?, rate: Double?) {
        val tts = engine()
        if (!ready.await(5, TimeUnit.SECONDS) || initStatus != TextToSpeech.SUCCESS) {
            throw HostError(501, "음성 읽기 엔진을 사용할 수 없습니다. 기기 설정에서 TTS 엔진을 확인하세요.", "tts-init")
        }
        if (!lang.isNullOrBlank()) {
            val locale = Locale.forLanguageTag(lang.trim().replace('_', '-'))
            val r = tts.setLanguage(locale)
            if (r == TextToSpeech.LANG_MISSING_DATA || r == TextToSpeech.LANG_NOT_SUPPORTED) {
                throw HostError(501, "이 기기에 '${locale.displayName}' 음성 데이터가 없습니다.", "tts-lang:$lang")
            }
        }
        tts.setSpeechRate((rate ?: 1.0).coerceIn(0.1, 4.0).toFloat())
        if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "amgi-${ids.incrementAndGet()}") != TextToSpeech.SUCCESS) {
            throw HostError(500, "음성 읽기에 실패했습니다.", "tts-speak")
        }
    }

    fun stop() {
        synchronized(this) { engine }?.stop()
    }
}
