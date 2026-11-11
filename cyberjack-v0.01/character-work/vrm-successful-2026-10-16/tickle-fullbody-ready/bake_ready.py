"""Запечь полнотелую реакцию в Action/NLA-совместимый клип.

Процедурный оператор остаётся, но в файле теперь есть готовый клип: при открытии
и нажатии Play двигаются корпус, голова, руки, нога, пальцы, мимика и дыхание.
"""
import bpy
import json
import sys
from pathlib import Path
from mathutils import Vector

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from fullbody_model import FullBodyReaction
from rig_performance_ready import ReadyRig

FPS = 15
FRAMES = 120
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'tickle_ready.blend'))
perf = ReadyRig()
model = FullBodyReaction(seed=7)
scene = bpy.context.scene
states = []
bones_union = set()


def contact(zone):
    return {'zone': zone, 'tool': 'fingers', 'force': 0.66, 'speed': 1.0,
            'area': 0.7, 'source': 'external', 'expectedness': 0.0}


for frame in range(FRAMES):
    t = frame / FPS
    c = None if t < 1.0 else contact('arch_medial') if t < 4.0 else None if t < 5.0 else contact('toe_pad_1')
    state = model.step(1 / FPS, c)
    perf.apply(state, 1.0 + t)
    states.append(state)
    if frame == 0:
        bones_union = set(perf.touched)
    else:
        bones_union |= perf.touched

# Чистый повтор без накопления позы.
perf = ReadyRig()
rig = perf.rig
rig.animation_data_clear()
action = bpy.data.actions.new('Tickle_FullBody_Demo')
action.use_fake_user = True
rig.animation_data_create()
rig.animation_data.action = action
for pb in rig.pose.bones:
    pb.rotation_mode = 'QUATERNION'

shape_keys = perf.body.data.shape_keys
shape_keys.animation_data_clear()
face_action = bpy.data.actions.new('Tickle_Face_Demo')
face_action.use_fake_user = True
shape_keys.animation_data_create()
shape_keys.animation_data.action = face_action

for frame in range(FRAMES):
    perf.apply(states[frame], 1.0 + frame / FPS)
    for name in sorted(bones_union):
        pb = rig.pose.bones[name]
        pb.keyframe_insert('rotation_quaternion', frame=frame, group=name)
        pb.keyframe_insert('location', frame=frame, group=name)
    tool = perf.tool
    tool.keyframe_insert('location', frame=frame)
    tool.keyframe_insert('rotation_quaternion', frame=frame)
    tool.keyframe_insert('hide_render', frame=frame)
    for key in ['Tickle_Breath'] + sorted({shape_keys.key_blocks[t].name for _, t in perf.expression_targets}):
        shape_keys.keyframe_insert(data_path=f'key_blocks["{key}"].value', frame=frame, group='Face')

scene.frame_start = 0
scene.frame_end = FRAMES - 1
scene.render.fps = FPS


def iter_fcurves(act):
    seen = set()
    for layer in act.layers:
        for strip in layer.strips:
            for slot in act.slots:
                try:
                    bag = strip.channelbag(slot)
                except (AttributeError, TypeError):
                    bag = None
                if bag is None:
                    continue
                for fcurve in bag.fcurves:
                    if fcurve.as_pointer() not in seen:
                        seen.add(fcurve.as_pointer())
                        yield fcurve


for fcurve in list(iter_fcurves(action)):
    for kp in fcurve.keyframe_points:
        kp.interpolation = 'LINEAR'
for fcurve in list(iter_fcurves(face_action)):
    for kp in fcurve.keyframe_points:
        kp.interpolation = 'LINEAR'
bone_fcurves = len(list(iter_fcurves(action)))
face_fcurves = len(list(iter_fcurves(face_action)))
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / 'tickle_ready_animated.blend'), compress=True)

# Проверка после повторного открытия: Action реально двигает скелет и лицо.
bpy.ops.wm.open_mainfile(filepath=str(HERE / 'tickle_ready_animated.blend'))
rig = bpy.data.objects['rig_ready']
scene = bpy.context.scene
scene.frame_set(0)
head0 = rig.matrix_world @ rig.pose.bones['Head'].head
knee0 = rig.matrix_world @ rig.pose.bones['Left knee'].head
foot0 = rig.matrix_world @ rig.pose.bones['BigToe_2.L'].tail
scene.frame_set(90)
head1 = rig.matrix_world @ rig.pose.bones['Head'].head
knee1 = rig.matrix_world @ rig.pose.bones['Left knee'].head
foot1 = rig.matrix_world @ rig.pose.bones['BigToe_2.L'].tail
body = next(o for o in bpy.data.objects if o.type == 'MESH' and
            any(m and m.name == 'KK cf_m_body' for m in o.data.materials))
breath = body.data.shape_keys.key_blocks['Tickle_Breath'].value
report = {
    'bones_keyed': len(bones_union),
    'bone_fcurves': bone_fcurves,
    'face_fcurves': face_fcurves,
    'frames': FRAMES,
    'actions': [a.name for a in bpy.data.actions],
    'head_delta_mm': round((head1 - head0).length * 1000, 1),
    'knee_delta_mm': round((knee1 - knee0).length * 1000, 1),
    'toe_delta_mm': round((foot1 - foot0).length * 1000, 1),
    'breath_at_90': round(breath, 3),
}
report['pass'] = (report['bones_keyed'] >= 15 and report['bone_fcurves'] > 40 and
                  report['face_fcurves'] >= 10 and report['head_delta_mm'] > 8 and
                  report['knee_delta_mm'] > 20 and report['toe_delta_mm'] > 20)
(HERE / 'reports/bake_ready.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
print('READY_BAKE=' + json.dumps(report, ensure_ascii=False), flush=True)
if not report['pass']:
    raise SystemExit(1)
