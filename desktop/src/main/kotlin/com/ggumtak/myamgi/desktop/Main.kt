package com.ggumtak.myamgi.desktop

import com.ggumtak.myamgi.engine.AnkiEngine
import com.ggumtak.myamgi.host.ClasspathAssetSource
import com.ggumtak.myamgi.host.DirAssetSource
import com.ggumtak.myamgi.host.HostServer
import com.ggumtak.myamgi.host.HostLog
import net.ankiweb.rsdroid.testing.RustBackendLoader
import java.awt.Desktop
import java.awt.GraphicsEnvironment
import java.io.File
import java.io.FileOutputStream
import java.io.PrintStream
import java.net.URI
import kotlin.system.exitProcess

/**
 * PC launcher and development/test host.
 *
 * `--port N` (default random) `--dir D` (data dir, default ~/.myamgi) `--ui-dir U` (UI bundle directory)
 * `--ota-dir O` `--token T` (default random) `--seed` (sample collection when empty) `--no-open`.
 */
fun main(args: Array<String>) {
    val opts = try {
        Options.parse(args)
    } catch (e: IllegalArgumentException) {
        System.err.println(e.message)
        System.err.println(Options.USAGE)
        exitProcess(2)
    }

    val jnu = System.getProperty("sun.jnu.encoding").orEmpty()
    if (!jnu.equals("UTF-8", ignoreCase = true) && !System.getProperty("os.name").orEmpty().startsWith("Windows")) {
        System.err.println("warning: file name encoding is $jnu; media with non-ASCII names will not load. Run with LC_ALL=C.UTF-8.")
    }
    preserveConsole()
    AnkiEngine.nativeLoader = { RustBackendLoader.ensureSetup() }
    val dataDir = opts.dir.absoluteFile.apply { mkdirs() }
    val log = HostLog().apply { echo = opts.verbose }
    val uiSource = opts.uiDir?.let { DirAssetSource(it) } ?: ClasspathAssetSource("amgi/ui/")
    lateinit var server: HostServer
    server = HostServer(
        uiBuiltIn = uiSource,
        uiOtaDir = opts.otaDir,
        ankiAssets = ClasspathAssetSource("amgi/backend/"),
        dataDir = dataDir,
        platform = DesktopPlatform(onExit = {
            server.stop()
            AnkiEngine.closeAll()
            exitProcess(0)
        }),
        port = opts.port,
        token = opts.token ?: HostServer.newToken(),
        collectionDir = File(dataDir, "collection"),
        log = log
    )

    if (opts.seed) {
        val seeded = SampleCollection.seedIfEmpty()
        log.info(if (seeded) "seeded sample collection" else "collection not empty; seed skipped")
    }
    AnkiEngine.ensureOpen()

    Runtime.getRuntime().addShutdownHook(Thread {
        runCatching { server.stop() }
        runCatching { AnkiEngine.closeAll() }
    })

    server.start()
    println("myAmgi host listening: ${server.startUrl}")
    System.out.flush()

    if (!opts.noOpen) {
        runCatching {
            if (!GraphicsEnvironment.isHeadless() && Desktop.isDesktopSupported()) {
                Desktop.getDesktop().browse(URI(server.startUrl))
            }
        }.onFailure { System.err.println("브라우저를 열지 못했습니다: ${it.message}") }
    }

    // Keep the JVM alive; the server threads are daemons.
    Thread.currentThread().join()
}

/**
 * The desktop native library (from anki-android-backend-testing) redirects file descriptors 1 and 2 to
 * temporary files when it loads. Reopen the original console first so our output stays visible.
 */
private fun preserveConsole() {
    if (System.getProperty("os.name").orEmpty().startsWith("Windows")) return
    for (fd in listOf(1, 2)) {
        val path = listOf(File("/proc/self/fd/$fd"), File("/dev/fd/$fd")).firstOrNull { it.exists() } ?: continue
        runCatching {
            val stream = PrintStream(FileOutputStream(path, true), true, "UTF-8")
            if (fd == 1) System.setOut(stream) else System.setErr(stream)
        }
    }
}

internal data class Options(
    val port: Int = 0,
    val dir: File = File(System.getProperty("user.home"), ".myamgi"),
    val uiDir: File? = null,
    val otaDir: File? = null,
    val token: String? = null,
    val seed: Boolean = false,
    val noOpen: Boolean = false,
    val verbose: Boolean = false
) {
    companion object {
        const val USAGE =
            "usage: desktop [--port N] [--dir DATA_DIR] [--ui-dir UI_DIR] [--ota-dir OTA_DIR] [--token T] [--seed] [--no-open] [--verbose]"

        fun parse(args: Array<String>): Options {
            var o = Options()
            var i = 0
            fun value(name: String): String {
                if (i + 1 >= args.size) throw IllegalArgumentException("$name needs a value")
                return args[++i]
            }
            while (i < args.size) {
                when (val a = args[i]) {
                    "--port" -> o = o.copy(port = value(a).toIntOrNull()?.takeIf { it in 0..65535 }
                        ?: throw IllegalArgumentException("bad --port"))
                    "--dir" -> o = o.copy(dir = File(value(a)))
                    "--ui-dir" -> o = o.copy(uiDir = File(value(a)).absoluteFile.also {
                        if (!it.isDirectory) throw IllegalArgumentException("--ui-dir is not a directory: $it")
                    })
                    "--ota-dir" -> o = o.copy(otaDir = File(value(a)).absoluteFile)
                    "--token" -> o = o.copy(token = value(a).takeIf { it.length >= 4 }
                        ?: throw IllegalArgumentException("--token must have at least 4 characters"))
                    "--seed" -> o = o.copy(seed = true)
                    "--no-open" -> o = o.copy(noOpen = true)
                    "--verbose" -> o = o.copy(verbose = true)
                    "--help", "-h" -> {
                        println(USAGE)
                        exitProcess(0)
                    }
                    else -> throw IllegalArgumentException("unknown argument: $a")
                }
                i++
            }
            return o
        }
    }
}
