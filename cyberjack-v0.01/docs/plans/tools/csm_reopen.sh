#!/bin/bash
# Перезапуск MODELER с открытым .csmo и снимками: панель объектов + ракурсы
export WINEPREFIX=/home/cyberkitty/.wine-csm
export WINEDEBUG=-all
export DISPLAY=:98
pkill Xvfb 2>/dev/null; sleep 1
Xvfb :98 -screen 0 1600x1000x24 >/dev/null 2>&1 &
sleep 3
export LIBGL_ALWAYS_SOFTWARE=1
cd "/home/cyberkitty/.wine-csm/drive_c/Program Files/CELSYS/CLIP STUDIO 1.5/CLIP STUDIO MODELER" || exit 1
wine CLIPStudioModeler.exe > /tmp/csm_run4.log 2>&1 &
sleep 60
# телеметрия, если снова всплывёт
xdotool mousemove 944 392 click 1; sleep 5
xdotool key ctrl+o; sleep 6
xdotool mousemove 250 216 click 1; sleep 1
xdotool type --delay 25 'Z:\tmp\bed.csmo'; sleep 1
xdotool key Return; sleep 12
import -window root /tmp/csm_parts.png
echo "shot $(stat -c%s /tmp/csm_parts.png)"
echo CSM2_DONE
