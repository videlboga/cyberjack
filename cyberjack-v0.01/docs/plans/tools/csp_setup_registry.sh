#!/bin/bash
# Рецепт CSPenguin/kojiinari: реестр, dxvk.conf, запуск CSP со скриншотом
set -x
export WINEPREFIX=/home/cyberkitty/.wine-csp
export WINEDEBUG=-all
export DISPLAY=:0

reg() { wine reg add "$@" /f 2>/dev/null; }

reg 'HKCU\Software\Wine' /v Version /t REG_SZ /d win10
reg 'HKCU\Software\Wine\DllOverrides' /v concrt140 /t REG_SZ /d 'native,builtin'
reg 'HKCU\Software\Wine\DllOverrides' /v mfplat /t REG_SZ /d 'native,builtin'
reg 'HKCU\Software\Wine\DllOverrides' /v mfreadwrite /t REG_SZ /d 'native,builtin'
reg 'HKCU\Software\Wine\DllOverrides' /v dcomp /t REG_SZ /d 'native,builtin'
reg 'HKCU\Software\Wine\AppDefaults\msedgewebview2.exe' /v Version /t REG_SZ /d win7
reg 'HKCU\Software\Wine\AppDefaults\CLIPStudioPaint.exe' /v Version /t REG_SZ /d win81
reg 'HKCU\Software\Wine\AppDefaults\CLIPStudio.exe' /v Version /t REG_SZ /d win81
reg 'HKCU\Software\Wine\WineDbg' /v ShowCrashDialog /t REG_DWORD /d 0
reg 'HKLM\System\CurrentControlSet\Services\PlugPlay' /v Start /t REG_DWORD /d 4
reg 'HKLM\System\CurrentControlSet\Services\WineBus' /v Start /t REG_DWORD /d 4

cat > "$WINEPREFIX/dxvk.conf" <<'EOF'
dxvk.enableGraphicsPipelineLibrary = True
dxvk.numCompilerThreads = 0
dxvk.maxChunkSize = 16
EOF
export DXVK_CONFIG_FILE="$WINEPREFIX/dxvk.conf"

cd "$WINEPREFIX/drive_c/Program Files/CELSYS/CLIP STUDIO 1.5/CLIP STUDIO PAINT" || exit 1
nohup wine CLIPStudioPaint.exe > /tmp/csp_after.log 2>&1 &
sleep 90
xdotool search --name "CLIP STUDIO PAINT" getwindowgeometry %@ 2>/dev/null | head -3
import -window root /tmp/csp_after.png
ls -la /tmp/csp_after.png | awk '{print "SHOT_BYTES", $5}'
echo SETUP_DONE
