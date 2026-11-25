import java.io.File

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val buildNumber = (System.getenv("BUILD_NUMBER") ?: "1").toIntOrNull() ?: 1

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
            excludes += listOf(
                "lib/armeabi-v7a/**",
                "lib/x86/**",
                "lib/x86_64/**",
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
    // Official Anki 26.09.4 Rust Backend
    implementation("io.github.david-allison:anki-backend-android:0.1.77-anki26.09.4")
    implementation("io.github.david-allison:anki-backend-core:0.1.77-anki26.09.4")

    // AndroidX & Material
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.recyclerview:recyclerview:1.3.2")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.webkit:webkit:1.12.1")
    implementation("androidx.documentfile:documentfile:1.0.1")

    // Coroutines & Networking
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")

    // Unit Tests with real Anki 26.09.4 Rust backend on JVM
    testImplementation("junit:junit:4.13.2")
    testImplementation("io.github.david-allison:anki-android-backend-testing:0.1.77-anki26.09.4")
    testImplementation("org.json:json:20240303")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
}
