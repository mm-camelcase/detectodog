#!/usr/bin/env bash
set -euo pipefail

apk="android/app/build/outputs/apk/release/app-release.apk"
package="ie.detectodog.app"

adb install -r "$apk"
adb logcat -c
adb shell am force-stop "$package"
adb shell monkey -p "$package" -c android.intent.category.LAUNCHER 1
sleep 8

if ! adb shell pidof "$package" >/dev/null; then
  adb logcat -d '*:E'
  echo "Android startup smoke test failed: $package exited during launch." >&2
  exit 1
fi

if adb logcat -d | grep -A 30 'FATAL EXCEPTION' | grep -q "$package"; then
  adb logcat -d '*:E'
  echo "Android startup smoke test failed: fatal exception detected." >&2
  exit 1
fi

echo "Android startup smoke test passed."
