package com.ggumtak.myamgi.host

import java.io.PrintWriter
import java.io.StringWriter
import java.text.SimpleDateFormat
import java.util.ArrayDeque
import java.util.Date
import java.util.Locale

/** Ring buffer of recent host log lines and the last errors, for "오류 로그 복사". */
class HostLog(private val maxLines: Int = 500, private val maxErrors: Int = 20) {
    private val lines = ArrayDeque<String>()
    private val errors = ArrayDeque<String>()
    private val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.ROOT)

    /** Also echo lines to stdout (desktop development host). */
    @Volatile
    var echo: Boolean = false

    fun info(message: String) = add("I", message)

    fun warn(message: String) = add("W", message)

    fun error(message: String, t: Throwable? = null) {
        val text = if (t == null) message else "$message\n${stackOf(t)}"
        val line = add("E", text)
        synchronized(this) {
            errors.addLast(line)
            while (errors.size > maxErrors) errors.removeFirst()
        }
    }

    fun lastError(): String? = synchronized(this) { errors.peekLast() }

    fun snapshot(): Pair<List<String>, List<String>> = synchronized(this) { lines.toList() to errors.toList() }

    private fun add(level: String, message: String): String {
        val line = synchronized(this) {
            val l = "${fmt.format(Date())} $level $message"
            lines.addLast(l)
            while (lines.size > maxLines) lines.removeFirst()
            l
        }
        if (echo) println(line)
        return line
    }

    companion object {
        fun stackOf(t: Throwable): String {
            val sw = StringWriter()
            t.printStackTrace(PrintWriter(sw))
            return sw.toString().lineSequence().take(40).joinToString("\n")
        }
    }
}
