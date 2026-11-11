#!/usr/bin/env python3
"""Build vrm_portrait.html from the CURRENT vrm_view.html.
Injects: hide-UI style + portrait-director script, transparent backdrop.
Run after every change of vrm_view.html; then sync to the second serving root.
Usage: python3 make-portrait-page.py [dashboard-copy-dir]
"""
import sys, re
from pathlib import Path

VIEWER=Path(__file__).resolve().parent
src=(VIEWER/'vrm_view.html').read_text()

STYLE="""<style id="portrait-style">
html,body{margin:0!important;background:transparent!important;overflow:hidden;width:100%;height:100%}
.topbar,.view-toolbar,.transport,#toast,.camera-hint{display:none!important}
.workspace{width:100%;height:100%}
.sidebar{display:none!important}
#stage{position:fixed;inset:0;background:transparent!important}
#loading{opacity:.5}
#error{position:fixed;inset:auto 8px 8px 8px;font-size:11px}
</style>"""
DIRECTOR='<script type="module" src="./portrait-director.js?v=1"></script>'

html=re.sub(r'</head>', STYLE+'</head>', src, count=1)
if '<meta name="viewport"' not in html:
    html=html.replace('<head>', '<head><meta name="viewport" content="width=device-width,initial-scale=1">', 1)
html=re.sub(r'</body>', DIRECTOR+'</body>', html, count=1)
html=html.replace('VRM VIEWPORT','VRM PORTRAIT').replace('Avatar Studio — VRM','VRM Portrait')
out=VIEWER/'vrm_portrait.html'
out.write_text(html)
print('written', out, len(html), 'bytes')
if len(sys.argv)>1:
    dst=Path(sys.argv[1])/out.name
    dst.write_text(html)
    print('copied to', dst)
# режиссёр тоже всегда синхронизируем
if len(sys.argv)>1:
    (Path(sys.argv[1])/(VIEWER/'portrait-director.js').name).write_text((VIEWER/'portrait-director.js').read_text())
    print('director copied')