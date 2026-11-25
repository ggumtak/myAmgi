import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    `java-library`
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

dependencies {
    // Official Anki 26.09.4 Rust backend (Kotlin API + protobuf-lite classes; native library comes from the shell)
    api("io.github.david-allison:anki-backend-core:0.1.77-anki26.09.4")
    // JSON tree API only (no serialization plugin); already a transitive dependency of anki-backend-core
    api("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
    // Embedded HTTP server that runs on Android and desktop JVMs
    implementation("org.nanohttpd:nanohttpd:2.3.1")

    testImplementation("junit:junit:4.13.2")
    testImplementation("io.github.david-allison:anki-android-backend-testing:0.1.77-anki26.09.4")
}

tasks.test {
    maxHeapSize = "1g"
    // Media and package names are UTF-8; a JVM under the C locale cannot open files the backend wrote.
    environment("LC_ALL", "C.UTF-8")
    testLogging {
        events("failed")
        exceptionFormat = org.gradle.api.tasks.testing.logging.TestExceptionFormat.FULL
    }
}
