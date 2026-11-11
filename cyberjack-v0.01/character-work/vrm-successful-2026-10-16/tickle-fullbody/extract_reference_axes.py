"""Снимает только оси/амплитуды референсных Actions, не переносит клипы целиком."""
import bpy
import json
import math
from pathlib import Path
from mathutils import Quaternion

HERE = Path(__file__).resolve().parent
SRC = Path('/home/cyberkitty/Projects/tickle-mechanics-refs/08_sim/rig/work_sim.blend')
OUT = HERE / 'reference_axes.json'
TOES = ['BigToe', 'SmallToe1', 'SmallToe2', 'SmallToe3', 'SmallToe4']
BONES = ['foot.l', 'foot.r']
for side in ('L', 'R'):
    for toe in TOES:
        BONES.extend([f'{toe}.{side}', f'{toe}_2.{side}'])
CLIPS = {'curl': 'LOOP_02_Toe_Curl_Extend', 'splay': 'LOOP_03_Toe_Splay',
         'flex': 'LOOP_04_Ankle_Flex'}

bpy.ops.wm.open_mainfile(filepath=str(SRC))
rig = bpy.data.objects['Feet_Rig']
scene = bpy.context.scene
out = {'source': str(SRC), 'clips': CLIPS, 'axes': {}, 'peak_deg': {},
       'rest_world': {b: [list(row) for row in rig.data.bones[b].matrix_local] for b in BONES}}
for kind, name in CLIPS.items():
    act = bpy.data.actions[name]
    rig.animation_data.action = act
    lo, hi = map(int, act.frame_range)
    samples = {b: [] for b in BONES}
    for frame in range(lo, hi + 1):
        scene.frame_set(frame)
        bpy.context.view_layer.update()
        for bone in BONES:
            samples[bone].append(rig.pose.bones[bone].matrix_basis.to_quaternion().normalized())
    out['axes'][kind] = {}
    out['peak_deg'][kind] = {}
    for bone, values in samples.items():
        q0 = values[0]
        best = Quaternion()
        for q in values[1:]:
            delta = q0.inverted() @ q
            if delta.angle > best.angle:
                best = delta
        deg = math.degrees(best.angle)
        out['peak_deg'][kind][bone] = round(deg, 4)
        if deg >= 0.5:
            out['axes'][kind][bone] = list(best.axis.normalized())
rig.animation_data.action = None
OUT.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding='utf-8')
print('REFERENCE_AXES=' + json.dumps({'out': str(OUT), 'peak_deg': out['peak_deg']}, ensure_ascii=False), flush=True)
