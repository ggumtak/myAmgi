# Keep Anki Rust backend protobuf and reflection raw methods
-keep class net.ankiweb.rsdroid.** { *; }
-keep class anki.** { *; }
-keepclassmembers class anki.backend.GeneratedBackend {
    public *** *Raw(byte[]);
}
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}
