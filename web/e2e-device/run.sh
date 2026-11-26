#!/usr/bin/env bash
# On-device test: installs the debug APKs on the one connected device/emulator, runs device.spec.ts for
# each flavor (Playwright over the WebView's DevTools socket + adb), captures logcat, and fails on any
# test failure or any crash/ANR of the app.
#
#   ./gradlew -PemulatorAbi assembleProDebug assembleCometDebug   (x86_64 emulator; arm64 devices need no flag)
#   (cd web && npm ci && npm run build)                            (before the gradle build)
#   bash web/e2e-device/run.sh                                     (SKIP_COMET=1 for pro only)
#
# Output (AMGI_DEVICE_OUT, default web/e2e-device/out): shots/*.png, logs/ (logcat-all, logcat-app,
# logcat-crash, host-*.txt = the app's host log after each step, dumpsys, WebView version, layout-*.json),
# report-<flavor>.json.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="${AMGI_DEVICE_OUT:-$ROOT/web/e2e-device/out}"
export AMGI_DEVICE_OUT="$OUT"
LOGS="$OUT/logs"
mkdir -p "$OUT/shots" "$LOGS"

PRO_APK="${PRO_APK:-$(ls "$ROOT"/app/build/outputs/apk/pro/debug/*.apk 2>/dev/null | head -n1)}"
COMET_APK="${COMET_APK:-$(ls "$ROOT"/app/build/outputs/apk/comet/debug/*.apk 2>/dev/null | head -n1)}"
[ -f "$PRO_APK" ] || { echo "::error::pro debug APK not found (build it with -PemulatorAbi assembleProDebug)"; exit 1; }

adb wait-for-device
adb shell 'while [ "$(getprop sys.boot_completed)" != "1" ]; do sleep 1; done'
# The device is up: from here on a failure is a test result, not a boot problem (see device-test.yml).
date -u +%FT%TZ > "$OUT/started"
# The emulator's launcher is slow under software rendering and its "isn't responding" dialog would take
# every key and tap. Error dialogs stay hidden; app crashes/ANRs are still found in logcat below.
adb shell settings put global hide_error_dialogs 1 || true
adb shell settings put global anr_show_background 0 || true
adb shell input keyevent KEYCODE_WAKEUP || true
adb shell wm dismiss-keyguard || true
adb shell settings put global window_animation_scale 0 || true
adb shell settings put global transition_animation_scale 0 || true
adb shell settings put global animator_duration_scale 0 || true
adb shell input keyevent KEYCODE_HOME || true

{
  echo "== wm size / density"; adb shell wm size; adb shell wm density
  echo "== build"; adb shell getprop ro.build.fingerprint; adb shell getprop ro.product.model
  echo "== locale"; adb shell getprop persist.sys.locale; adb shell getprop ro.product.locale
} > "$LOGS/device.txt" 2>&1
adb shell dumpsys webviewupdate > "$LOGS/webview.txt" 2>&1
adb shell getprop > "$LOGS/getprop.txt" 2>&1
cat "$LOGS/device.txt"; grep -iE "Current WebView package|versionName" "$LOGS/webview.txt" | head -5

adb logcat -c || true
adb logcat -b main,system,crash,events -v threadtime > "$LOGS/logcat-all.txt" 2>&1 &
LOGCAT_PID=$!

status=0
run_flavor() { # flavor package apk
  local flavor="$1" pkg="$2" apk="$3"
  echo "::group::install $flavor ($apk)"
  adb uninstall "$pkg" > /dev/null 2>&1 || true
  if ! adb install -r -g "$apk"; then echo "::error::install of $apk failed"; echo "::endgroup::"; return 1; fi
  adb shell dumpsys package "$pkg" > "$LOGS/dumpsys-package-$flavor.txt" 2>&1
  echo "::endgroup::"
  (cd "$ROOT/web" && AMGI_FLAVOR="$flavor" AMGI_PKG="$pkg" npx playwright test -c e2e-device/playwright.config.ts --grep "@$flavor")
}

run_flavor pro com.ggumtak.myamgi "$PRO_APK" || { status=1; echo "::error::device test (pro) failed"; }
if [ "${SKIP_COMET:-}" != "1" ] && [ -f "$COMET_APK" ]; then
  run_flavor comet com.ggumtak.myamgi.comet "$COMET_APK" || { status=1; echo "::error::device test (comet) failed"; }
fi

sleep 2
kill "$LOGCAT_PID" 2>/dev/null || true
adb logcat -b crash -d > "$LOGS/logcat-crash.txt" 2>&1 || true
adb shell dumpsys activity processes > "$LOGS/dumpsys-processes.txt" 2>&1 || true
adb shell dumpsys meminfo com.ggumtak.myamgi > "$LOGS/meminfo-pro.txt" 2>&1 || true
adb shell ls -l /data/anr /data/tombstones > "$LOGS/anr-tombstones.txt" 2>&1 || true

# The app's own lines: every pid that ran com.ggumtak.myamgi(.comet), plus lines naming the package.
python3 - "$LOGS/logcat-all.txt" > "$LOGS/logcat-app.txt" <<'PY'
import re, sys
lines = open(sys.argv[1], encoding="utf-8", errors="replace").read().splitlines()
pids = set()
for l in lines:
    m = re.search(r"Start proc (\d+):com\.ggumtak\.myamgi", l)
    if m:
        pids.add(m.group(1))
for l in lines:
    parts = l.split()
    if (len(parts) > 3 and parts[2] in pids) or "com.ggumtak.myamgi" in l:
        print(l)
PY
echo "app pids/lines: $(wc -l < "$LOGS/logcat-app.txt") lines of app logcat"

# Any crash or ANR of the app process fails the job, whatever the tests said.
if grep -nE "Process: com\.ggumtak\.myamgi|>>> com\.ggumtak\.myamgi|ANR in com\.ggumtak\.myamgi|am_crash.*com\.ggumtak\.myamgi|am_anr.*com\.ggumtak\.myamgi|am_native_crash.*com\.ggumtak\.myamgi" \
  "$LOGS/logcat-all.txt" "$LOGS/logcat-crash.txt" > "$LOGS/app-crashes.txt"; then
  echo "::error::the app crashed or stopped responding (logs/app-crashes.txt):"
  cat "$LOGS/app-crashes.txt"
  grep -n -A30 "FATAL EXCEPTION" "$LOGS/logcat-crash.txt" | head -80 || true
  status=1
else
  echo "no crash or ANR of com.ggumtak.myamgi in logcat"
fi
exit $status
