import java.io.File
import javax.inject.Inject
import org.gradle.process.ExecOperations

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val buildNumber = (System.getenv("BUILD_NUMBER") ?: "1").toIntOrNull() ?: 1

// -PemulatorAbi: debug builds also carry x86_64 (the backend AAR ships jni/x86_64/librsdroid.so) so they run on
// the x86_64 emulator of the device-test workflow (.github/workflows/device-test.yml). Release builds stay
// arm64-v8a only whatever the property says (build.yml checks the APKs).
val emulatorAbi: Boolean = providers.gradleProperty("emulatorAbi").isPresent

android {
    namespace = "com.ggumtak.myamgi"
    compileSdk = 36

    defaultConfig {
        applicationId = "com.ggumtak.myamgi"
        minSdk = 26
        targetSdk = 35
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"

        // Pure 64-bit arm64-v8a only (for modern phones, tablets, and Innosspace Comet)
        ndk {
            abiFilters += listOf("arm64-v8a")
        }

        buildConfigField("String", "GITHUB_REPO", "\"ggumtak/myAmgi\"")
    }

    flavorDimensions += "device"
    productFlavors {
        create("pro") {
            dimension = "device"
            applicationId = "com.ggumtak.myamgi"
            resValue("string", "app_name", "myAmgi")
            buildConfigField("String", "FLAVOR_NAME", "\"pro\"")
            buildConfigField("String", "APK_PREFIX", "\"myAmgi-Pro\"")
            buildConfigField("boolean", "IS_COMET", "false")
            manifestPlaceholders["providerAuthority"] = "com.ggumtak.myamgi.flashcards"
            manifestPlaceholders["fileProviderAuthority"] = "com.ggumtak.myamgi.fileprovider"
            buildConfigField("String", "FILE_PROVIDER_AUTHORITY", "\"com.ggumtak.myamgi.fileprovider\"")
        }
        create("comet") {
            dimension = "device"
            applicationId = "com.ggumtak.myamgi.comet"
            resValue("string", "app_name", "myAmgi 코멧")
            buildConfigField("String", "FLAVOR_NAME", "\"comet\"")
            buildConfigField("String", "APK_PREFIX", "\"myAmgi-Comet\"")
            buildConfigField("boolean", "IS_COMET", "true")
            manifestPlaceholders["providerAuthority"] = "com.ggumtak.myamgi.comet.flashcards"
            manifestPlaceholders["fileProviderAuthority"] = "com.ggumtak.myamgi.comet.fileprovider"
            buildConfigField("String", "FILE_PROVIDER_AUTHORITY", "\"com.ggumtak.myamgi.comet.fileprovider\"")
        }
    }

    signingConfigs {
        create("release") {
            val keystorePath = System.getenv("SIGNING_KEYSTORE_FILE")
            if (!keystorePath.isNullOrBlank() && File(keystorePath).exists()) {
                storeFile = File(keystorePath)
                storePassword = System.getenv("SIGNING_STORE_PASSWORD") ?: ""
                keyAlias = System.getenv("SIGNING_KEY_ALIAS") ?: "myamgi"
                keyPassword = System.getenv("SIGNING_KEY_PASSWORD") ?: ""
            }
        }
    }

    buildTypes {
        release {
            buildConfigField("boolean", "WEBVIEW_DEBUGGING", "false")
            isMinifyEnabled = false
            isShrinkResources = false
            val relKey = signingConfigs.getByName("release")
            signingConfig = if (relKey.storeFile != null) relKey else signingConfigs.getByName("debug")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isDebuggable = true
            // Chrome DevTools on the WebView (the device test drives the UI over CDP). Never in release.
            buildConfigField("boolean", "WEBVIEW_DEBUGGING", "true")
            if (emulatorAbi) ndk { abiFilters += listOf("x86_64") }
        }
    }

    buildFeatures {
        buildConfig = true
        viewBinding = false
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    packaging {
        jniLibs {
            useLegacyPackaging = false
            // With -PemulatorAbi x86_64 libs may be packaged; only the debug ABI filter asks for them.
            excludes += listOfNotNull(
                "lib/armeabi-v7a/**",
                "lib/x86/**",
                if (emulatorAbi) null else "lib/x86_64/**",
                "lib/armeabi/**"
            )
        }
        resources {
            excludes += listOf(
                "META-INF/LICENSE*",
                "META-INF/NOTICE*",
                "META-INF/AL2.0",
                "META-INF/LGPL2.1"
            )
        }
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }
}

kotlin {
    compilerOptions {
        jvmTarget.set(org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17)
    }
}

dependencies {
    // Shared engine + host server (pure JVM)
    implementation(project(":core"))

    // Official Anki 26.09.4 Rust Backend
    implementation("io.github.david-allison:anki-backend-android:0.1.77-anki26.09.4")
    implementation("io.github.david-allison:anki-backend-core:0.1.77-anki26.09.4")

    // AndroidX & Material
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.activity:activity-ktx:1.9.3")

    // Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    // Unit Tests with real Anki 26.09.4 Rust backend on JVM
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.github.david-allison:anki-android-backend-testing:0.1.77-anki26.09.4")
    testImplementation("org.json:json:20240303")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
}

// ---------------------------------------------------------------------------------------------------------------
// The web UI bundle (web/dist) is packaged into the APK assets as ui/ for both flavors.
//
// buildWebUi runs `npm ci` (when node_modules is missing or older than package-lock.json) and `npm run build`
// in web/ when web/dist is missing or older than its sources. Pass -PskipWebBuild when an earlier CI step built
// the bundle. The UI version is AMGI_UI_VERSION (CI: 1.0.<run number>; locally 1.0.<BUILD_NUMBER or 1>).
// packageWebUi copies web/dist and fails the build when the bundle is absent; if the web build did not write
// ui-version.json, the packaged copy gets one with that version (web/dist itself is not modified).
// ---------------------------------------------------------------------------------------------------------------

val webRoot: File = rootProject.file("web")
val webDist = File(webRoot, "dist")
val webUiVersion: String = System.getenv("AMGI_UI_VERSION")?.takeIf { it.isNotBlank() } ?: "1.0.$buildNumber"
val skipWebBuild: Boolean = providers.gradleProperty("skipWebBuild").isPresent

fun newestFile(f: File): Long =
    if (!f.exists()) 0L else f.walkTopDown().filter { it.isFile }.maxOfOrNull { it.lastModified() } ?: 0L

abstract class NpmBuildTask @Inject constructor(private val exec: ExecOperations) : DefaultTask() {
    @get:Internal
    abstract val webDir: Property<File>

    @get:Internal
    abstract val uiVersion: Property<String>

    @TaskAction
    fun build() {
        val dir = webDir.get()
        val npm = if (System.getProperty("os.name").startsWith("Windows")) "npm.cmd" else "npm"
        val stamp = File(dir, "node_modules/.package-lock.json")
        if (!stamp.isFile || stamp.lastModified() < File(dir, "package-lock.json").lastModified()) {
            logger.lifecycle("web: npm ci")
            exec.exec { workingDir = dir; commandLine(npm, "ci", "--no-audit", "--no-fund") }
        }
        logger.lifecycle("web: npm run build (AMGI_UI_VERSION=${uiVersion.get()})")
        exec.exec {
            workingDir = dir
            environment("AMGI_UI_VERSION", uiVersion.get())
            commandLine(npm, "run", "build")
        }
    }
}

abstract class PackageWebUiTask : DefaultTask() {
    @get:Internal
    abstract val distDir: Property<File>

    @get:Internal
    abstract val uiVersion: Property<String>

    @get:OutputDirectory
    abstract val outputDir: DirectoryProperty

    @TaskAction
    fun copy() {
        val dist = distDir.get()
        if (!File(dist, "index.html").isFile) {
            throw GradleException(
                "The web UI bundle is missing: ${dist.path}/index.html does not exist. " +
                    "Build it with `npm ci && npm run build` in web/ (or drop -PskipWebBuild)."
            )
        }
        val out = outputDir.get().asFile
        out.deleteRecursively()
        val ui = File(out, "ui")
        dist.copyRecursively(ui, overwrite = true)
        val version = File(ui, "ui-version.json")
        if (!version.isFile) {
            logger.warn("web/dist has no ui-version.json; packaging version ${uiVersion.get()}")
            version.writeText("{\"version\":\"${uiVersion.get()}\"}\n")
        }
    }
}

val buildWebUi by tasks.registering(NpmBuildTask::class) {
    description = "Builds web/dist when it is missing or older than its sources (skip with -PskipWebBuild)."
    webDir.set(webRoot)
    uiVersion.set(webUiVersion)
    onlyIf("web/dist is missing or stale, and -PskipWebBuild is not set") {
        if (skipWebBuild) return@onlyIf false
        val built = File(webDist, "index.html").takeIf { it.isFile }?.lastModified() ?: return@onlyIf true
        val sources = listOf("src", "public", "index.html", "package.json", "package-lock.json", "vite.config.ts",
            "tsconfig.json", "tsconfig.app.json", "tsconfig.node.json")
        sources.maxOf { newestFile(File(webRoot, it)) } > built
    }
    outputs.upToDateWhen { false }
}

val packageWebUi by tasks.registering(PackageWebUiTask::class) {
    description = "Copies web/dist into the APK assets as ui/."
    dependsOn(buildWebUi)
    distDir.set(webDist)
    uiVersion.set(webUiVersion)
    outputDir.set(layout.buildDirectory.dir("generated/webUi"))
    outputs.upToDateWhen { false }
}

androidComponents {
    onVariants { variant ->
        variant.sources.assets?.addGeneratedSourceDirectory(packageWebUi, PackageWebUiTask::outputDir)
    }
}
