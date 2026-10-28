#!/bin/bash
# CSP в отдельном виртуальном дисплее :99 (не мешая рабочему столу)
pkill -f CLIPStudioPaint.exe 2>/dev/null
sleep 3
pkill Xvfb 2>/dev/null
sleep 1
Xvfb :99 -screen 0 1700x1400x24 &
sleep 4
export DISPLAY=:99
export WINEPREFIX=/home/cyberkitty/.wine-csp
export WINEDEBUG=-all
export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--disable-gpu --disable-gpu-compositing"
export DXVK_CONFIG_FILE="$WINEPREFIX/dxvk.conf"
export LIBGL_ALWAYS_SOFTWARE=1
CSP="$WINEPREFIX/drive_c/Program Files/CELSYS/CLIP STUDIO 1.5/CLIP STUDIO PAINT"
cd "$CSP" || exit 1
nohup wine CLIPStudioPaint.exe > /tmp/csp_xvfb.log 2>&1 &

OUT=/tmp/csp_shot
mkdir -p "$OUT"
for i in $(seq 1 20); do
  sleep 30
  import -window root "$OUT/x_$i.png" 2>/dev/null
  echo "$(date +%H:%M:%S) x_$i bytes=$(stat -c%s "$OUT/x_$i.png" 2>/dev/null)"
done
echo XVFB_WATCH_DONE
