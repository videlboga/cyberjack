"""GUI smoke on Xvfb: real modal operator + injected contact + screenshot."""
import bpy
import json
import os
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import interactive

report = {'operator_started': False, 'contact_injected': False, 'screenshot': None, 'state': None}
area = next(a for a in bpy.context.screen.areas if a.type == 'VIEW_3D')
region = next(r for r in area.regions if r.type == 'WINDOW')
with bpy.context.temp_override(area=area, region=region):
    bpy.ops.tickle.fullbody('INVOKE_DEFAULT')
report['operator_started'] = interactive.TICKLE_OT_fullbody.active is not None


def contact():
    op = interactive.TICKLE_OT_fullbody.active
    if op:
        point, normal = op.perf.contact_points['arch_medial']
        op.hit = {'point': point, 'normal': normal, 'zone': 'arch_medial', 'sensitivity': 0.95, 'face': -1}
        op.button = True
        op.pointer_speed = 1.0
        op.raycast = lambda *args, **kwargs: None  # удерживаем инжектированный контакт в smoke-тесте
        op.tick()
        report['contact_injected'] = True
    return None


def screenshot():
    op = interactive.TICKLE_OT_fullbody.active
    path = HERE / 'preview/gui_smoke.png'
    subprocess.run(['import', '-window', 'root', str(path)], check=False)
    report['screenshot'] = str(path)
    report['screenshot_bytes'] = path.stat().st_size if path.exists() else 0
    if op:
        report['state'] = {k: op.state.get(k) for k in ['stimulus', 'family', 'character', 'face', 'breath', 'mouth']}
        report['runtime'] = {'ticks': op.tick_count, 'button': op.button, 'hit': bool(op.hit),
                             'absolute_t': op.absolute_t, 'finished': op.finished,
                             'timer_registered': op.timer is not None}
    (HERE / 'reports/gui_smoke.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('GUI_SMOKE=' + json.dumps(report, ensure_ascii=False), flush=True)
    return None


def stop():
    op = interactive.TICKLE_OT_fullbody.active
    if op:
        op.finish(bpy.context)
    bpy.ops.wm.quit_blender()
    return None


bpy.app.timers.register(contact, first_interval=2.0)
bpy.app.timers.register(screenshot, first_interval=4.0)
bpy.app.timers.register(stop, first_interval=5.0)
