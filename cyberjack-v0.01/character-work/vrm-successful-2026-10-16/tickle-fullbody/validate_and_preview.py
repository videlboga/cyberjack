"""Численная и визуальная проверка полноростового исполнителя; малый набор кадров."""
import bpy
import json
import math
import sys
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fullbody_model import FullBodyReaction
from rig_performance import FullBodyRig

bpy.ops.wm.open_mainfile(filepath=str(HERE / 'tickle_fullbody.blend'))
perf = FullBodyRig()
model = FullBodyReaction(seed=7)
scene = bpy.context.scene


def points(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = obj.evaluated_get(dg)
    me = ev.to_mesh()
    out = [obj.matrix_world @ v.co.copy() for v in me.vertices]
    ev.to_mesh_clear()
    return out


def max_delta(a, b):
    return max((x - y).length for x, y in zip(a, b)) if len(a) == len(b) else 999.0


def contact(zone):
    return {'zone': zone, 'tool': 'fingers', 'force': 0.66, 'speed': 1.0,
            'area': 0.7, 'source': 'external', 'expectedness': 0.0}


neutral = model.step(1 / 30, None)
perf.apply(neutral, 1.0)
body0 = points(perf.body)
head0 = points(perf.heads[0])
foot_r0 = perf.rig.pose.bones['foot.r'].matrix.copy()
report = {'zone_probe': {}, 'samples': [], 'errors': []}

# Луч от выбранной точки обратно в ту же грань: подтверждает контактный контракт.
zone_attr = perf.body.data.attributes['zone_id']
for zone, (point, normal) in perf.contact_points.items():
    origin = point + normal * 0.02
    inv = perf.body.matrix_world.inverted()
    ok, loc, nor, index = perf.body.ray_cast(inv @ origin, inv.to_3x3() @ (-normal))
    actual = zone_attr.data[index].value if ok else -999
    expected = perf.zone_names.index(zone)
    report['zone_probe'][zone] = {'hit': bool(ok), 'expected': expected, 'actual': actual,
                                  'pass': bool(ok and actual == expected)}

max_step = 0.0
prev = None
max_head = max_foot = max_right_foot = max_face_mesh = 0.0
max_happy = max_mouth = max_breath = 0.0
tool_gaps = []
key_jobs = {1.2: [('Camera_Full', 'reaction_full'), ('Camera_Feet', 'reaction_feet')],
            2.4: [('Camera_Face', 'reaction_face')],
            6.4: [('Camera_Full', 'ball_full')],
            9.4: [('Camera_Feet', 'toes_feet')]}

for frame in range(361):
    t = frame / 30
    if t < 1.0:
        c = None
    elif t < 4.0:
        c = contact('arch_medial')
    elif t < 5.0:
        c = None
    elif t < 8.0:
        c = contact('ball')
    elif t < 9.0:
        c = None
    else:
        c = contact('toe_pad_1')
    st = model.step(1 / 30, c)
    perf.apply(st, t + 1.0)
    names = ['foot.l', 'BigToe.L', 'chest', 'head', 'upperarm.l', 'upperarm.r']
    current = {n: perf.rig.pose.bones[n].matrix.to_quaternion() for n in names}
    if prev:
        for n in names:
            dot = abs(current[n].dot(prev[n]))
            deg = math.degrees(2 * math.acos(min(1.0, dot)))
            max_step = max(max_step, deg)
    prev = current
    if abs(t - 2.4) < 0.02:
        hp = points(perf.heads[0]); bp = points(perf.body)
        max_head = max(max_head, max_delta(head0, hp))
        max_foot = max(max_foot, max_delta(body0[5000:9000], bp[5000:9000]))
        max_face_mesh = max(max_face_mesh, max_delta(head0, hp))
    right_delta = perf.rig.pose.bones['foot.r'].matrix.to_quaternion().rotation_difference(foot_r0.to_quaternion()).angle
    max_right_foot = max(max_right_foot, math.degrees(right_delta))
    # Фактические значения по привязкам пресетов.
    happy = max((o.data.shape_keys.key_blocks[target].value for o, target, _ in perf.presets.get('happy', [])), default=0)
    max_happy = max(max_happy, happy)
    max_mouth = max(max_mouth, st['mouth'])
    max_breath = max(max_breath, st['breath'])
    if frame % 30 == 0:
        report['samples'].append({'t': t, 'zone': st['family'] and perf.last_zone,
                                  'character': st['character'], 'stimulus': st['stimulus'],
                                  'local': st['local'], 'body': st['body'], 'face': st['face'],
                                  'breath': st['breath'], 'mouth': st['mouth']})
    for key, jobs in key_jobs.items():
        if abs(t - key) < 0.02:
            if not perf.tool.hide_render:
                bottom = perf.tool.location + perf.tool.rotation_quaternion @ Vector((0, 0, -0.0175))
                normal = perf.tool.rotation_quaternion @ Vector((0, 0, 1))
                inv = perf.body.matrix_world.inverted()
                ok, loc, _, _ = perf.body.ray_cast(inv @ bottom, inv.to_3x3() @ (-normal))
                if ok:
                    tool_gaps.append({'t': t, 'zone': perf.last_zone, 'gap_mm': (loc - bottom).length * 1000})
            for camera, label in jobs:
                scene.camera = bpy.data.objects[camera]
                scene.render.resolution_x = 900
                scene.render.resolution_y = 900 if camera != 'Camera_Full' else 1000
                scene.render.filepath = str(HERE / 'preview' / f'{label}.png')
                bpy.ops.render.render(write_still=True)

report.update({
    'pass_zones': all(v['pass'] for v in report['zone_probe'].values()),
    'max_step_deg_per_frame': round(max_step, 3),
    'right_foot_max_rotation_deg': round(max_right_foot, 5),
    'head_mesh_motion_mm': round(max_head * 1000, 3),
    'face_mesh_motion_mm': round(max_face_mesh * 1000, 3),
    'happy_max': round(max_happy, 4), 'mouth_max': round(max_mouth, 4),
    'breath_max': round(max_breath, 4),
    'tool_contact_gaps': tool_gaps,
    'rig_bones': len(perf.rig.data.bones),
    'expression_targets': len(perf.expression_targets),
    'head_parts': len(perf.heads),
})
report['pass'] = all([
    report['pass_zones'], max_step <= 18.0, max_right_foot < 0.1,
    max_head > 0.001, max_face_mesh > 0.0005, max_happy > 0.2,
    max_mouth > 0.05, max_breath > 0.05,
])
(HERE / 'reports/performance_test.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('FULLBODY_PERFORMANCE=' + json.dumps(report, ensure_ascii=False), flush=True)
