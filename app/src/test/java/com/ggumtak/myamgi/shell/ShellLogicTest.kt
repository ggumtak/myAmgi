package com.ggumtak.myamgi.shell

import android.view.KeyEvent
import com.ggumtak.myamgi.shell.NavigationPolicy.Action
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class NavigationPolicyTest {
    private val p = NavigationPolicy(40123)

    @Test
    fun ownOriginLoadsAndDownloadsAreSaved() {
        assertEquals(Action.ALLOW, p.decide("http://127.0.0.1:40123/ui/#/decks", true))
        assertEquals(Action.ALLOW, p.decide("http://localhost:40123/deck-options/1", false, false))
        assertEquals(Action.ALLOW, p.decide("http://127.0.0.1:40123/media/__amgi_frame.html", false, false))
        assertEquals(Action.DOWNLOAD, p.decide("http://127.0.0.1:40123/api/host/download?path=%2Fx&name=a.apkg", true))
        assertEquals(Action.DOWNLOAD, p.decide("http://127.0.0.1:40123/api/host/download?path=x", false))
    }

    @Test
    fun otherPortsHostsAndTricksAreNotOwnOrigin() {
        assertEquals(Action.EXTERNAL, p.decide("http://127.0.0.1:40124/ui/", true))
        assertEquals(Action.EXTERNAL, p.decide("https://127.0.0.1:40123/ui/", true))
        assertEquals(Action.EXTERNAL, p.decide("http://127.0.0.1:40123@evil.example/", true))
        assertEquals(Action.EXTERNAL, p.decide("http://evil.example/?u=http://127.0.0.1:40123/", true))
        assertFalse(p.isOwnOrigin("http://user@127.0.0.1:40123/ui/"))
        assertFalse(p.isOwnOrigin("not a url"))
    }

    @Test
    fun hanjaUrlsFromAnyFrameGoToTheHanjaApp() {
        val intentUrl = "intent://lookup?q=%E5%AD%B8#Intent;scheme=hanja;package=com.ggumtak.hanja;end"
        assertEquals(Action.HANJA, p.decide(intentUrl, false, true))
        assertEquals(Action.HANJA, p.decide(intentUrl, false, false))
        assertEquals(Action.HANJA, p.decide("hanja://lookup?q=學&s=學校", true))
        assertEquals(Action.HANJA, p.decide("HANJA://lookup?q=a", false))
    }

    @Test
    fun externalLinksOpenOutsideAndEmbedsStay() {
        assertEquals(Action.EXTERNAL, p.decide("https://ankiweb.net/", true))
        assertEquals(Action.EXTERNAL, p.decide("https://example.com/x", false, true))
        assertEquals(Action.ALLOW, p.decide("https://www.youtube.com/embed/x", false, false))
        assertEquals(Action.EXTERNAL, p.decide("mailto:a@b.c", true))
        assertEquals(Action.BLOCK, p.decide("tel:123", false, false))
    }

    @Test
    fun everythingElseIsBlocked() {
        for (u in listOf("file:///sdcard/x", "content://x/y", "javascript:alert(1)", "data:text/html,hi", "chrome://gpu", "ftp://x", "about:blank", "weird"))
            assertEquals(u, Action.BLOCK, p.decide(u, true))
        assertEquals(Action.ALLOW, p.decide("about:srcdoc", false))
        assertEquals(Action.ALLOW, p.decide("about:blank", false))
        assertEquals(Action.ALLOW, p.decide("blob:http://127.0.0.1:40123/abc", false))
        assertEquals(Action.BLOCK, p.decide("blob:http://127.0.0.1:40123/abc", true))
    }
}

class ShellKeysTest {
    @Test
    fun androidKeyCodesMatchTheTable() {
        // The table uses literal numbers; they must be Android's.
        assertEquals(KeyEvent.KEYCODE_VOLUME_UP, ShellKeys.KEYCODE_VOLUME_UP)
        assertEquals(KeyEvent.KEYCODE_VOLUME_DOWN, ShellKeys.KEYCODE_VOLUME_DOWN)
        assertEquals(KeyEvent.KEYCODE_HEADSETHOOK, ShellKeys.KEYCODE_HEADSETHOOK)
        assertEquals(KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE, ShellKeys.KEYCODE_MEDIA_PLAY_PAUSE)
        assertEquals(KeyEvent.KEYCODE_MEDIA_STOP, ShellKeys.KEYCODE_MEDIA_STOP)
        assertEquals(KeyEvent.KEYCODE_MEDIA_NEXT, ShellKeys.KEYCODE_MEDIA_NEXT)
        assertEquals(KeyEvent.KEYCODE_MEDIA_PREVIOUS, ShellKeys.KEYCODE_MEDIA_PREVIOUS)
        assertEquals(KeyEvent.KEYCODE_MEDIA_REWIND, ShellKeys.KEYCODE_MEDIA_REWIND)
        assertEquals(KeyEvent.KEYCODE_MEDIA_FAST_FORWARD, ShellKeys.KEYCODE_MEDIA_FAST_FORWARD)
        assertEquals(KeyEvent.KEYCODE_MEDIA_PLAY, ShellKeys.KEYCODE_MEDIA_PLAY)
        assertEquals(KeyEvent.KEYCODE_MEDIA_PAUSE, ShellKeys.KEYCODE_MEDIA_PAUSE)
    }

    @Test
    fun volumeAndRemoteKeysMapToStandardDomNames() {
        assertEquals("AudioVolumeUp", ShellKeys.domKeyFor(KeyEvent.KEYCODE_VOLUME_UP)!!.key)
        assertEquals("AudioVolumeDown", ShellKeys.domKeyFor(KeyEvent.KEYCODE_VOLUME_DOWN)!!.code)
        assertEquals("MediaPlayPause", ShellKeys.domKeyFor(KeyEvent.KEYCODE_HEADSETHOOK)!!.key)
        assertEquals("MediaTrackNext", ShellKeys.domKeyFor(KeyEvent.KEYCODE_MEDIA_NEXT)!!.key)
        assertEquals("MediaTrackPrevious", ShellKeys.domKeyFor(KeyEvent.KEYCODE_MEDIA_PREVIOUS)!!.key)
        // Keyboard keys reach the page natively.
        for (k in listOf(KeyEvent.KEYCODE_SPACE, KeyEvent.KEYCODE_ENTER, KeyEvent.KEYCODE_1, KeyEvent.KEYCODE_PAGE_DOWN, KeyEvent.KEYCODE_BACK))
            assertNull(ShellKeys.domKeyFor(k))
    }

    @Test
    fun captureFollowsPrefAndUi() {
        val v = KeyEvent.KEYCODE_VOLUME_DOWN
        assertTrue(ShellKeys.shouldCapture(v, prefEnabled = true, uiCaptureKeys = null, pageAlive = true))
        assertTrue(ShellKeys.shouldCapture(v, true, true, true))
        assertFalse(ShellKeys.shouldCapture(v, false, true, true))
        assertFalse(ShellKeys.shouldCapture(v, true, false, true))
        assertFalse(ShellKeys.shouldCapture(v, true, true, false))
        assertFalse(ShellKeys.shouldCapture(KeyEvent.KEYCODE_SPACE, true, true, true))
    }

    @Test
    fun scriptDispatchesAKeyboardEvent() {
        val js = ShellKeys.script(ShellKeys.domKeyFor(KeyEvent.KEYCODE_VOLUME_UP)!!, "keydown", true)
        assertTrue(js.contains("new KeyboardEvent('keydown',{key:'AudioVolumeUp',code:'AudioVolumeUp',keyCode:175"))
        assertTrue(js.contains("repeat:true"))
        assertTrue(js.contains("bubbles:true"))
    }
}

class OpenFileQueueTest {
    @Test
    fun waitsForReadyOrASettledEventStream() {
        val q = OpenFileQueue(settleMillis = 1000)
        q.offer(OpenFileQueue.Item("/t/upload-1.apkg", "덱.apkg"))
        assertTrue(q.drain(uiReady = false, subscribers = 0, now = 0).isEmpty())
        assertTrue(q.drain(false, 1, 100).isEmpty()) // connected, not settled
        assertTrue(q.drain(false, 1, 900).isEmpty())
        assertEquals(listOf("덱.apkg"), q.drain(false, 1, 1100).map { it.name })
        assertEquals(0, q.size())

        q.offer(OpenFileQueue.Item("/t/b.csv", "b.csv"))
        q.pageChanged()
        assertTrue(q.drain(false, 1, 2000).isEmpty())
        assertEquals(1, q.drain(true, 1, 2001).size) // ready: no need to wait
    }

    @Test
    fun noSubscriberNoDelivery() {
        val q = OpenFileQueue()
        q.offer(OpenFileQueue.Item("a", "a"))
        assertTrue(q.drain(true, 0, 0).isEmpty())
        assertEquals(1, q.size())
    }
}

class BackCoordinatorTest {
    @Test
    fun fallsBackWithoutAPage() {
        assertEquals(BackCoordinator.Decision.FallBack, BackCoordinator().onBack(pageConnected = false, uiSpeaksBackAck = true))
    }

    @Test
    fun ackProtocol() {
        val b = BackCoordinator()
        val d1 = b.onBack(true, true) as BackCoordinator.Decision.Publish
        assertTrue(d1.awaitAck)
        b.onAck(d1.id)
        assertFalse(b.onTimeout(d1.id)) // answered: no fallback
        val d2 = b.onBack(true, true) as BackCoordinator.Decision.Publish
        assertTrue(d2.id > d1.id)
        assertTrue(b.onTimeout(d2.id)) // silent UI: fall back
        assertFalse(b.onTimeout(d2.id))
    }

    @Test
    fun trustsAUiWithoutAck() {
        val d = BackCoordinator().onBack(true, false) as BackCoordinator.Decision.Publish
        assertFalse(d.awaitAck)
    }
}

class ShareMimeTest {
    @Test
    fun pickerNarrowsOnlyForMedia() {
        assertEquals(emptyList<String>(), ShareMime.pickerTypes(arrayOf(".apkg,.colpkg,.txt,.csv")))
        assertEquals(emptyList<String>(), ShareMime.pickerTypes(arrayOf("")))
        assertEquals(emptyList<String>(), ShareMime.pickerTypes(null))
        assertEquals(listOf("image/*"), ShareMime.pickerTypes(arrayOf("image/*")))
        assertEquals(listOf("image/*", "audio/*"), ShareMime.pickerTypes(arrayOf("image/*", "audio/*")))
        assertEquals(listOf("audio/mpeg", "image/png"), ShareMime.pickerTypes(arrayOf(".mp3, .PNG")))
        assertEquals(emptyList<String>(), ShareMime.pickerTypes(arrayOf("image/*", ".apkg")))
    }

    @Test
    fun mimeOfNames() {
        assertEquals("application/octet-stream", ShareMime.of("일본어_한자.apkg"))
        assertEquals("text/csv", ShareMime.of("a.CSV"))
        assertEquals("application/octet-stream", ShareMime.of("noext"))
    }
}
