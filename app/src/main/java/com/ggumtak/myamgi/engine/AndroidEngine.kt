package com.ggumtak.myamgi.engine

import android.content.Context
import java.io.File

/** Android side of [AnkiEngine] setup: native library loading and the collection directory. */
object AndroidEngine {
    /** Call from `Application.onCreate` before any engine use. */
    fun install(context: Context) {
        AnkiEngine.nativeLoader = { System.loadLibrary("rsdroid") }
        AnkiEngine.setCollectionDir(collectionDir(context))
    }

    fun collectionDir(context: Context): File = File(context.applicationContext.filesDir, "anki_collection")
}
