"""Покадровый рендер готовой Mira: тело, лицо, подошва."""
import bpy
import json
import os
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fullbody_model import FullBodyReaction
from rig_performance_ready import ReadyRig

LIMIT = int(os.environ.get('DEMO_LIMIT', '120'))
FORCE = os.environ.get('DEMO_FORCE') == '1'
FPS = 15
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'tickle_ready.blend'))
perf = ReadyRig()
model = FullBodyReaction(seed=7)
scene = bpy.context.scene
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
root = HERE / 'preview/demo_frames'
root.mkdir(parents=True, exist_ok=True)
log = []


def contact(zone):
    return {'zone': zone, 'tool': 'fingers', 'force': 0.66, 'speed': 1.0,
            'area': 0.7, 'source': 'external', 'expectedness': 0.0}


for frame in range(LIMIT):
    t = frame / FPS
    if t < 1.0:
        c = None
    elif t < 4.0:
        c = contact('arch_medial')
    elif t < 5.0:
        c = None
    else:
        c = contact('toe_pad_1')
    state = model.step(1 / FPS, c)
    perf.apply(state, 1.0 + t)
    log.append({'frame': frame, 't': t, **state})
    for camera, suffix, width, height in [('Camera_Full', 'full', 540, 720),
                                          ('Camera_Face', 'face', 540, 360),
                                          ('Camera_Sole', 'sole', 540, 360)]:
        folder = root / suffix
        folder.mkdir(exist_ok=True)
        path = folder / f'{frame:04d}.png'
        if path.exists() and not FORCE:
            continue
        scene.camera = bpy.data.objects[camera]
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
    if frame % 15 == 0:
        print(f'READY_FRAME {frame}/{LIMIT}', flush=True)
(HERE / 'reports/demo_session.json').write_text(json.dumps(log, ensure_ascii=False, indent=2), encoding='utf-8')
print('READY_RENDER_DONE=' + str(LIMIT), flush=True)
