#!/usr/bin/env bash
set -euo pipefail

apk="android/app/build/outputs/apk/release/app-release.apk"
package="ie.detectodog.app"

adb install -r "$apk"
adb logcat -c
adb shell am force-stop "$package"
adb shell monkey -p "$package" -c android.intent.category.LAUNCHER 1
sleep 8
mkdir -p artifacts
adb exec-out screencap -p > artifacts/home.png

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

# Exercise a native module that is loaded only when the user opens the photo
# library. This catches missing expo-file-system/autolinking problems that a
# launch-only smoke test cannot see.
adb shell uiautomator dump /sdcard/detectodog-window.xml >/dev/null
adb pull /sdcard/detectodog-window.xml /tmp/detectodog-window.xml >/dev/null
coords="$(python3 - <<'PY'
import re
import xml.etree.ElementTree as ET

root = ET.parse("/tmp/detectodog-window.xml").getroot()
for node in root.iter("node"):
    label = f"{node.attrib.get('text', '')} {node.attrib.get('content-desc', '')}"
    if "Choose from library" in label:
        values = [int(value) for value in re.findall(r"\d+", node.attrib["bounds"])]
        print((values[0] + values[2]) // 2, (values[1] + values[3]) // 2)
        break
else:
    raise SystemExit("Could not find the Choose from library button")
PY
)"
read -r tap_x tap_y <<<"$coords"
adb shell input tap "$tap_x" "$tap_y"
sleep 5
adb exec-out screencap -p > artifacts/photo-picker.png

if adb logcat -d | grep -A 30 'FATAL EXCEPTION' | grep -q "$package"; then
  adb logcat -d '*:E'
  echo "Android photo-picker smoke test failed: fatal exception detected." >&2
  exit 1
fi

if ! adb shell dumpsys activity activities | grep -qiE 'photopicker|documentsui'; then
  adb logcat -d '*:E'
  echo "Android photo-picker smoke test failed: system picker did not open." >&2
  exit 1
fi

echo "Android photo-picker smoke test passed."
