"""Численная и визуальная приёмка готовой Mira."""
import bpy
import json
import math
import sys
from pathlib import Path

from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fullbody_model import FullBodyReaction
from rig_performance_ready import ReadyRig

bpy.ops.wm.open_mainfile(filepath=str(HERE / 'tickle_ready.blend'))
perf = ReadyRig()
model = FullBodyReaction(seed=7)
scene = bpy.context.scene
root = HERE / 'preview/check'
root.mkdir(parents=True, exist_ok=True)
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'


def contact(zone):
    return {'zone': zone, 'tool': 'fingers', 'force': 0.66, 'speed': 1.0,
            'area': 0.7, 'source': 'external', 'expectedness': 0.0}


def bone_world(name):
    return perf.rig.matrix_world @ perf.rig.pose.bones[name].head


def pose_metrics():
    return {
        'head': tuple(bone_world('Head')),
        'head_tip': tuple(perf.rig.matrix_world @ perf.rig.pose.bones['Head'].tail),
        'left_knee': tuple(bone_world('Left knee')),
        'left_ankle': tuple(bone_world('Left ankle')),
        'left_toe': tuple(perf.rig.matrix_world @ perf.rig.pose.bones['BigToe_2.L'].tail),
        'right_ankle': tuple(bone_world('Right ankle')),
        'right_toe': tuple(perf.rig.matrix_world @ perf.rig.pose.bones['Right toe'].tail),
        'left_wrist': tuple(bone_world('Left wrist')),
        'hips': tuple(bone_world('Hips')),
    }


states = []
metrics = {}
tool_gaps = []
max_step = 0.0
prev = None
for frame in range(120):
    t = frame / 15
    if t < 1.0:
        c = None
    elif t < 4.0:
        c = contact('arch_medial')
    elif t < 5.0:
        c = None
    else:
        c = contact('toe_pad_1')
    state = model.step(1 / 15, c)
    perf.apply(state, 1.0 + t)
    states.append(state)
    if frame in {0, 30, 60, 90, 100, 110, 119}:
        metrics[frame] = pose_metrics()
    if not perf.tool.hide_render:
        bottom = perf.tool.location + perf.tool.rotation_quaternion @ Vector((0, 0, -0.015))
        normal = perf.tool.rotation_quaternion @ Vector((0, 0, 1))
        inv = perf.body.matrix_world.inverted()
        ok, loc, _, _ = perf.body.ray_cast(inv @ bottom, inv.to_3x3() @ (-normal))
        if ok:
            tool_gaps.append({'frame': frame, 'zone': perf.last_zone, 'gap_mm': round((loc - bottom).length * 1000, 2)})
    q = {name: perf.rig.pose.bones[name].rotation_quaternion.copy() for name in perf.touched}
    if prev:
        for name in q:
            if name in prev:
                max_step = max(max_step, math.degrees(q[name].rotation_difference(prev[name]).angle))
    prev = q

# Визуальные контрольные кадры.
shots = [(0, 'neutral'), (45, 'arch_medial'), (90, 'toe_pad_1'), (105, 'release')]
for frame, label in shots:
    scene.frame_set(frame)
    # Пересчитываем состояние того же кадра, чтобы гарантировать позу.
    t = frame / 15
    c = None if t < 1.0 else contact('arch_medial') if t < 4.0 else None if t < 5.0 else contact('toe_pad_1')
    st = model.step(0, c) if False else states[frame]
    perf.apply(st, 1.0 + t)
    for camera, suffix, width, height in [('Camera_Full', 'full', 540, 720),
                                          ('Camera_Face', 'face', 540, 360),
                                          ('Camera_Sole', 'sole', 540, 360)]:
        scene.camera = bpy.data.objects[camera]
        scene.render.resolution_x = width
        scene.render.resolution_y = height
        scene.render.filepath = str(root / f'{frame:04d}_{label}_{suffix}.png')
        bpy.ops.render.render(write_still=True)

neutral = metrics[0]
peak = metrics[90]
def dist(a, b):
    return (Vector(a) - Vector(b)).length * 1000

report = {
    'expressions': {name: len(binds) for name, binds in perf.presets.items()},
    'expression_targets': len(perf.expression_targets),
    'base_wrist_z': round(neutral['left_wrist'][2], 3),
    'head_delta_mm': round(dist(neutral['head_tip'], peak['head_tip']), 1),
    'left_knee_delta_mm': round(dist(neutral['left_knee'], peak['left_knee']), 1),
    'left_ankle_delta_mm': round(dist(neutral['left_ankle'], peak['left_ankle']), 1),
    'left_toe_delta_mm': round(dist(neutral['left_toe'], peak['left_toe']), 1),
    'left_wrist_delta_mm': round(dist(neutral['left_wrist'], peak['left_wrist']), 1),
    'hips_delta_mm': round(dist(neutral['hips'], peak['hips']), 1),
    'right_ankle_delta_mm': round(dist(neutral['right_ankle'], peak['right_ankle']), 1),
    'right_toe_delta_mm': round(dist(neutral['right_toe'], peak['right_toe']), 1),
    'max_angular_step_deg': round(max_step, 3),
    'tool_gap_min_mm': round(min((g['gap_mm'] for g in tool_gaps), default=-1), 2),
    'tool_gap_max_mm': round(max((g['gap_mm'] for g in tool_gaps), default=-1), 2),
    'tool_samples': len(tool_gaps),
    'channel_peaks': {k: round(max(s[k] for s in states), 3) for k in ['local', 'body', 'face', 'breath', 'mouth', 'flinch']},
    'metrics': metrics,
}
checks = {
    'expressions_bound': report['expression_targets'] > 10 and all(report['expressions'][k] > 0 for k in ['happy', 'aa', 'blink']),
    'arms_not_t_pose': report['base_wrist_z'] < 1.15,
    'head_moves': report['head_delta_mm'] > 5,
    'leg_moves': report['left_knee_delta_mm'] > 15 and report['left_ankle_delta_mm'] > 20,
    'toe_moves': report['left_toe_delta_mm'] > 12,
    'arm_reacts': report['left_wrist_delta_mm'] > 8,
    'right_foot_stable': report['right_ankle_delta_mm'] < 8 and report['right_toe_delta_mm'] < 8,
    'tool_not_inside': report['tool_gap_min_mm'] >= 0.4 and report['tool_gap_max_mm'] < 6.0,
    'smooth': report['max_angular_step_deg'] < 18,
}
report['checks'] = checks
report['pass'] = all(checks.values())
(HERE / 'reports/validation_ready.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('READY_VALIDATION=' + json.dumps({k: report[k] for k in ['checks', 'pass', 'base_wrist_z', 'head_delta_mm', 'left_knee_delta_mm', 'left_ankle_delta_mm', 'left_toe_delta_mm', 'left_wrist_delta_mm', 'hips_delta_mm', 'right_ankle_delta_mm', 'right_toe_delta_mm', 'max_angular_step_deg', 'tool_gap_min_mm', 'tool_gap_max_mm', 'channel_peaks', 'expression_targets']}, ensure_ascii=False), flush=True)
