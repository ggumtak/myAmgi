import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    application
    id("org.jetbrains.kotlin.jvm")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    compilerOptions {
        jvmTarget.set(JvmTarget.JVM_17)
    }
}

// The Android AAR is only used as a source of the official web assets (assets/backend/...).
val ankiWebAar: Configuration by configurations.creating {
    isTransitive = false
    isCanBeConsumed = false
}

dependencies {
    implementation(project(":core"))
    // Native backend for Linux/macOS/Windows (librsdroid.so / .dylib / rsdroid.dll) + RustBackendLoader
    implementation("io.github.david-allison:anki-android-backend-testing:0.1.77-anki26.09.4")
    ankiWebAar("io.github.david-allison:anki-backend-android:0.1.77-anki26.09.4@aar")

    testImplementation("junit:junit:4.13.2")
}

// Extracts assets/backend/... from the AAR into generated resources at amgi/backend/... (not committed).
val extractAnkiWebAssets by tasks.registering(Sync::class) {
    from({ ankiWebAar.map { zipTree(it) } }) {
        include("assets/backend/**")
        eachFile {
            relativePath = RelativePath(true, *(listOf("amgi", "backend") + relativePath.segments.drop(2)).toTypedArray())
        }
        includeEmptyDirs = false
    }
    into(layout.buildDirectory.dir("generated/ankiWeb"))
}

// Bundles the built myAmgi UI (web/dist) as amgi/ui/... when it exists; otherwise the host shows a placeholder.
val bundleWebUi by tasks.registering(Sync::class) {
    from(rootProject.file("web/dist"))
    into(layout.buildDirectory.dir("generated/webUi/amgi/ui"))
}

sourceSets.main {
    resources.srcDir(extractAnkiWebAssets)
    resources.srcDir(bundleWebUi.map { layout.buildDirectory.dir("generated/webUi").get() })
}

tasks.named("processResources") { dependsOn(bundleWebUi) }

application {
    mainClass.set("com.ggumtak.myamgi.desktop.MainKt")
    applicationDefaultJvmArgs = listOf("-Dfile.encoding=UTF-8", "-Xmx1g")
}

tasks.named<JavaExec>("run") {
    workingDir = rootProject.projectDir
    environment("LC_ALL", "C.UTF-8")
}

// File names in collection.media are UTF-8. Under a non-UTF-8 locale (e.g. LANG unset on a server) the
// JVM cannot open them, so the Unix launcher switches to C.UTF-8 in that case.
tasks.named<CreateStartScripts>("startScripts") {
    doLast {
        val script = unixScript
        val text = script.readText()
        val marker = "\n"
        val fix = "case \"$(locale charmap 2>/dev/null)\" in UTF-8) ;; *) export LC_ALL=C.UTF-8 ;; esac\n"
        if (!text.contains("locale charmap")) {
            script.writeText(text.replaceFirst(marker, marker + fix))
        }
    }
}
