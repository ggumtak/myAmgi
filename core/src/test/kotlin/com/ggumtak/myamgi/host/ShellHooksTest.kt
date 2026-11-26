package com.ggumtak.myamgi.host

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

/** The shell hooks (`ui.*`, `hanja.script`, `update.apply {kind}`) reach [Platform]. */
class ShellHooksTest {
    @get:Rule
    val tmp = TemporaryFolder()

    private class Recorder : Platform {
        var ready: Pair<String?, List<String>>? = null
        var state: UiShellState? = null
        var back: Long? = null
        var applyKind: String? = "unset"
        override fun info() = PlatformInfo("test", "1", 1, "pro", false, "jvm")
        override fun uiReady(uiVersion: String?, features: List<String>) { ready = uiVersion to features }
        override fun uiState(state: UiShellState) { this.state = state }
        override fun backHandled(id: Long) { back = id }
        override fun updateApply(kind: String?): JsonObject { applyKind = kind; return JsonObject(emptyMap()) }
    }

    private fun obj(s: String) = Json.parseToJsonElement(s).jsonObject

    private fun api(p: Platform) =
        HostApi(tmp.newFolder(), p, UiBundle(AssetSource.EMPTY, null), EventBus(), HostLog())

    @Test
    fun uiHooksAreForwarded() {
        val p = Recorder()
        val a = api(p)
        a.call("ui.ready", obj("""{"uiVersion":"1.0.7","features":["back-ack"]}"""))
        assertEquals("1.0.7" to listOf("back-ack"), p.ready)
        a.call("ui.state", obj("""{"theme":"dark","background":"#121316","keepScreenOn":true}"""))
        assertEquals(UiShellState("dark", "#121316", true, null), p.state)
        a.call("ui.backHandled", obj("""{"id":42}"""))
        assertEquals(42L, p.back)
        a.call("update.apply", obj("""{"kind":"ui"}"""))
        assertEquals("ui", p.applyKind)
        a.call("update.apply", obj("{}"))
        assertNull(p.applyKind)
        assertTrue(a.names.containsAll(listOf("ui.ready", "ui.state", "ui.backHandled", "hanja.script")))
    }

    @Test
    fun defaultsAreNoOpsOrUnsupported() {
        val a = api(object : Platform {
            override fun info() = PlatformInfo("test", "1", 1, "pro", false, "jvm")
        })
        a.call("ui.ready", obj("{}"))
        a.call("ui.state", obj("{}"))
        a.call("ui.backHandled", obj("""{"id":1}"""))
        for (name in listOf("hanja.script", "update.apply")) {
            try {
                a.call(name, obj("{}"))
                fail("$name should be unsupported")
            } catch (e: HostError) {
                assertEquals(501, e.status)
            }
        }
    }
}
