#!/bin/bash
# CSP 1.13.2: отдельный префикс, тихая установка, запуск на виртуальном дисплее
set -u
export WINEPREFIX=/home/cyberkitty/.wine-csp1132
export WINEDEBUG=-all
export WINEDLLOVERRIDES="mscoree,mshtml="
LOG=/tmp/csp1132_install.log

echo "[1] создаю префикс"
rm -rf "$WINEPREFIX"
wineboot -i > "$LOG" 2>&1
sleep 15

echo "[2] тихая установка"
DISPLAY=:99 wine /tmp/CSP_1132w_setup.exe /S >> "$LOG" 2>&1
echo "installer exit $?"
sleep 25

echo "[3] что установилось"
find "$WINEPREFIX/drive_c" -maxdepth 5 -iname "CLIPStudioPaint.exe" 2>/dev/null | head -3
du -sh "$WINEPREFIX" 2>/dev/null

echo "[4] запуск на Xvfb :99"
pkill Xvfb 2>/dev/null
sleep 1
Xvfb :99 -screen 0 1600x1000x24 >/dev/null 2>&1 &
sleep 3
export DISPLAY=:99
export LIBGL_ALWAYS_SOFTWARE=1
PAINT=$(find "$WINEPREFIX/drive_c" -maxdepth 5 -iname "CLIPStudioPaint.exe" 2>/dev/null | head -1)
if [ -z "$PAINT" ]; then echo "NO_EXE"; exit 1; fi
cd "$(dirname "$PAINT")" || exit 1
nohup wine CLIPStudioPaint.exe > /tmp/csp1132_run.log 2>&1 &
sleep 60
import -window root /tmp/csp1132_shot.png 2>/dev/null
echo "shot bytes $(stat -c%s /tmp/csp1132_shot.png 2>/dev/null)"
echo "windows: $(xdotool search --name 'CLIP' 2>/dev/null | wc -l)"
echo INSTALL_DONE
