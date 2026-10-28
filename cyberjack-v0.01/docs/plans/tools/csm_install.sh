#!/bin/bash
# CLIP STUDIO MODELER: отдельный префикс, тихая установка, старт на Xvfb :98
set -u
export WINEPREFIX=/home/cyberkitty/.wine-csm
export WINEDEBUG=-all
LOG=/tmp/csm_stage.log
: > "$LOG"

echo "[1] префикс" | tee -a "$LOG"
rm -rf "$WINEPREFIX"
wineboot -i >> "$LOG" 2>&1
sleep 10

echo "[2] зависимости" | tee -a "$LOG"
winetricks -q corefonts vcrun2022 >> "$LOG" 2>&1
echo "winetricks exit $?" | tee -a "$LOG"

echo "[3] установка MODELER" | tee -a "$LOG"
wine /tmp/CSM_11013w_setup.exe /S >> "$LOG" 2>&1
echo "installer exit $?" | tee -a "$LOG"
sleep 20
find "$WINEPREFIX/drive_c" -maxdepth 5 -iname "*.exe" 2>/dev/null | grep -iE "modeler|celsys" | head -5 | tee -a "$LOG"

echo "[4] запуск" | tee -a "$LOG"
pkill Xvfb 2>/dev/null; sleep 1
Xvfb :98 -screen 0 1600x1000x24 >/dev/null 2>&1 &
sleep 3
export DISPLAY=:98
export LIBGL_ALWAYS_SOFTWARE=1
EXE=$(find "$WINEPREFIX/drive_c" -maxdepth 5 -iname "*MODELER*.exe" 2>/dev/null | head -1)
echo "exe=$EXE" | tee -a "$LOG"
if [ -z "$EXE" ]; then echo "NO_EXE" | tee -a "$LOG"; exit 1; fi
cd "$(dirname "$EXE")" || exit 1
nohup wine "$(basename "$EXE")" > /tmp/csm_run.log 2>&1 &
sleep 60
import -window root /tmp/csm_shot.png 2>/dev/null
echo "shot $(stat -c%s /tmp/csm_shot.png 2>/dev/null)" | tee -a "$LOG"
echo "windows $(xdotool search --name '.' 2>/dev/null | wc -l)" | tee -a "$LOG"
echo CSM_DONE | tee -a "$LOG"
