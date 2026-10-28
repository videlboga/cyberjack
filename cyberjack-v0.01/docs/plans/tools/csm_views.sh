#!/bin/bash
# MODELER: открыть .csmo и снять 8 ракурсов облёта + вид сверху/снизу
export WINEPREFIX=/home/cyberkitty/.wine-csm
export WINEDEBUG=-all
export DISPLAY=:98
OUT=/tmp/csm_views
mkdir -p "$OUT"

pkill -f CLIPStudioModeler 2>/dev/null
sleep 2
pkill Xvfb 2>/dev/null
sleep 1
Xvfb :98 -screen 0 1600x1000x24 >/dev/null 2>&1 &
sleep 4
export LIBGL_ALWAYS_SOFTWARE=1
cd "/home/cyberkitty/.wine-csm/drive_c/Program Files/CELSYS/CLIP STUDIO 1.5/CLIP STUDIO MODELER" || exit 1
wine CLIPStudioModeler.exe > /tmp/csm_views_run.log 2>&1 &
sleep 55
# диалог телеметрии «使用情報を自動的に送信» — жмём «送信しない»
xdotool mousemove 1007 398 click 1; sleep 6
xdotool mousemove 1007 398 click 1; sleep 4
xdotool key Escape; sleep 2
xdotool key ctrl+o; sleep 6
xdotool mousemove 250 216 click 1; sleep 1
xdotool type --delay 25 'Z:\tmp\bed.csmo'; sleep 1
xdotool key Return; sleep 15

# рамка вьюпорта
VP="1120x900+300+60"

shot() { import -window root /tmp/_full.png; convert /tmp/_full.png -crop "$VP" +repage "$OUT/$1.png"; echo "$1 $(stat -c%s "$OUT/$1.png")"; }

shot v000
for i in 1 2 3 4 5 6 7; do
  a=$((i*45))
  xdotool mousemove 700 480 mousedown 1 mousemove $((700+120)) 480 mouseup 1
  sleep 2
  shot "v$(printf '%03d' $a)"
done
# сверху и снизу
xdotool mousemove 700 480 mousedown 1 mousemove 700 480+150 mouseup 1; sleep 2; shot vtop
xdotool mousemove 700 480 mousedown 1 mousemove 700 480-300 mouseup 1; sleep 2; shot vbot
echo VIEWS_DONE
