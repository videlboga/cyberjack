#!/bin/bash
# Перезапуск CSP с отключённым GPU WebView2 + периодические снимки окна
export DISPLAY=:0
export WINEPREFIX=/home/cyberkitty/.wine-csp
export WINEDEBUG=-all
export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--disable-gpu --disable-gpu-compositing"
export DXVK_CONFIG_FILE="$WINEPREFIX/dxvk.conf"
CSP="$WINEPREFIX/drive_c/Program Files/CELSYS/CLIP STUDIO 1.5/CLIP STUDIO PAINT"
OUT=/tmp/csp_frames
mkdir -p "$OUT"

pkill -f CLIPStudioPaint.exe 2>/dev/null
sleep 3
cd "$CSP" && nohup wine CLIPStudioPaint.exe > /tmp/csp_watch.log 2>&1 &

for i in $(seq 1 40); do
  sleep 20
  # ищем самое большое окно CSP среди всех
  best=""
  bestarea=0
  for id in $(xdotool search --name "CLIP STUDIO PAINT" 2>/dev/null); do
    geo=$(xdotool getwindowgeometry $id 2>/dev/null | grep Geometry | awk '{print $2}')
    w=${geo%x*}; h=${geo#*x}
    area=$(( ${w:-0} * ${h:-0} ))
    if [ "$area" -gt "$bestarea" ]; then bestarea=$area; best=$id; fi
  done
  if [ -n "$best" ]; then
    # окно переезжает между рабочими столами — поднимаем его перед снимком
    i3-msg '[title="CLIP STUDIO PAINT"] move to workspace current' >/dev/null 2>&1
    i3-msg '[title="CLIP STUDIO PAINT"] focus' >/dev/null 2>&1
    sleep 2
    import -window "$best" "$OUT/frame_$i.png" 2>/dev/null
    echo "$(date +%H:%M:%S) frame_$i win=$best area=$bestarea bytes=$(stat -c%s "$OUT/frame_$i.png" 2>/dev/null)"
  else
    echo "$(date +%H:%M:%S) no_window"
  fi
done
echo WATCH_DONE