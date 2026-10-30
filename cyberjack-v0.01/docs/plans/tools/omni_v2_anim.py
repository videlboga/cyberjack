"""Анимация ОМНИ-1 v2: A → C → D → A, машина и тело идут вместе."""
import bpy, math, os, sys
from mathutils import Vector
sys.path.insert(0, '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/tools')

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
rig = bpy.data.objects['OMNI_rig']
arm = bpy.data.objects['rig_']
mach = bpy.data.objects['OMNI_1']
sc = bpy.context.scene

PIVOT_X = {'arm': -0.52, 'leg': 0.62}
PIVOT_Y = 0.30
SLOT_X = {'arm': (-0.80, -0.20), 'leg': (0.30, 0.90)}


def cuff_center(tag):
    gi = {g.index: g.name for g in mach.vertex_groups}
    dg = bpy.context.evaluated_depsgraph_get()
    ev = mach.evaluated_get(dg); me = ev.to_mesh(); mw = ev.matrix_world
    acc = Vector((0, 0, 0)); n = 0
    for i, v in enumerate(mach.data.vertices):
        for g in v.groups:
            if gi[g.group] == f'head_{tag}' and g.weight > 0.3:
                acc += mw @ me.vertices[i].co; n += 1; break
    ev.to_mesh_clear()
    return acc / n if n else Vector((0, 0, 0))


def place(tag, target):
    kind = tag.split('_')[0]
    sgn = 1 if tag.endswith('_L') else -1
    px, py = PIVOT_X[kind], sgn * PIVOT_Y
    x0, x1 = SLOT_X[kind]
    cx = min(max(target[0], x0 + 0.08), x1 - 0.08)
    rig.pose.bones[f'car_{tag}'].location = (cx - px, 0, 0)
    rig.pose.bones[f'post_{tag}'].scale = (1, max(0.05, target[2] + 0.035 - 0.98), 1)
    dx, dy = target[0] - cx, target[1] - py
    pba = rig.pose.bones[f'arm_{tag}']
    pba.rotation_mode = 'XYZ'
    yaw = math.atan2(-dx * sgn, dy * sgn) + (math.pi if sgn < 0 else 0)
    pba.rotation_euler = (0, 0, yaw)
    pba.scale = (1, 1, 1)
    pbh = rig.pose.bones[f'head_{tag}']
    pbh.scale = (1, 1, 1)
    inv3 = rig.matrix_world.inverted().to_3x3()
    for _ in range(5):
        d = Vector(target) - cuff_center(tag)
        if d.length < 0.002:
            break
        m = pbh.matrix.copy()
        m.translation = m.translation + (inv3 @ d)
        pbh.matrix = m
        bpy.context.view_layer.update()


def set_limb(tag, cuff):
    kind = 'arm' if tag.startswith('arm') else 'leg'
    ctl_name = f'c_hand_ik.{"l" if tag.endswith("_L") else "r"}' if kind == 'arm' \
        else f'c_foot_ik.{"l" if tag.endswith("_L") else "r"}'
    ctl = arm.pose.bones.get(ctl_name)
    if ctl is None:
        return
    if 'ik_fk_switch' in ctl.keys():
        ctl['ik_fk_switch'] = 0.0
    bpy.context.view_layer.update()
    m = ctl.matrix.copy()
    m.translation = arm.matrix_world.inverted() @ cuff
    ctl.matrix = m
    bpy.context.view_layer.update()


def align_cuff(tag, seg_dir):
    pbh = rig.pose.bones[f'head_{tag}']
    q = Vector((0, 1, 0)).rotation_difference(seg_dir.normalized())
    m = pbh.matrix.copy()
    m = q.to_matrix().to_4x4() @ m.to_3x3().to_4x4()
    m.translation = pbh.matrix.translation
    pbh.matrix = m
    bpy.context.view_layer.update()


POSES = {
    'A': {'arm_L': (-0.06, 0.20, 1.10), 'arm_R': (-0.06, -0.20, 1.10),
          'leg_L': (0.78, 0.08, 1.16), 'leg_R': (0.78, -0.08, 1.16)},
    'C': {'arm_L': (-0.50, 0.55, 1.20), 'arm_R': (-0.50, -0.55, 1.20),
          'leg_L': (0.78, 0.08, 1.22), 'leg_R': (0.78, -0.08, 1.22)},
    'D': {'arm_L': (-0.50, 0.55, 1.20), 'arm_R': (-0.50, -0.55, 1.20),
          'leg_L': (0.10, 0.62, 1.22), 'leg_R': (0.10, -0.62, 1.22)},
}

MACH_BONES = [f'{p}_{t}' for t in ('arm_L', 'arm_R', 'leg_L', 'leg_R')
              for p in ('car', 'post', 'arm', 'head')]
CTL = ['c_hand_ik.l', 'c_hand_ik.r', 'c_foot_ik.l', 'c_foot_ik.r']

FRAMES = {'A': 1, 'C': 46, 'D': 91, 'A_end': 136}


def apply_pose(name):
    targets = POSES['A' if name == 'A_end' else name]
    for tag, t in targets.items():
        place(tag, t)
    bpy.context.view_layer.update()
    for tag in targets:
        set_limb(tag, cuff_center(tag))
    for tag in targets:
        kind = 'arm' if tag.startswith('arm') else 'leg'
        sfx = 'l' if tag.endswith('_L') else 'r'
        b1 = arm.pose.bones.get(('forearm.' if kind == 'arm' else 'calf.') + sfx)
        b2 = arm.pose.bones.get(('hand.' if kind == 'arm' else 'foot.') + sfx)
        if b1 and b2:
            dg = bpy.context.evaluated_depsgraph_get(); er = arm.evaluated_get(dg)
            p1 = er.matrix_world @ er.pose.bones[b1.name].head
            p2 = er.matrix_world @ er.pose.bones[b2.name].head
            align_cuff(tag, (p2 - p1))


def key_all(frame):
    for bn in MACH_BONES:
        pb = rig.pose.bones[bn]
        pb.keyframe_insert('location', frame=frame)
        pb.keyframe_insert('rotation_euler', frame=frame)
        pb.keyframe_insert('scale', frame=frame)
    for cn in CTL:
        pb = arm.pose.bones.get(cn)
        if pb:
            pb.keyframe_insert('location', frame=frame)
            pb.keyframe_insert('rotation_quaternion', frame=frame)


for name, fr in FRAMES.items():
    apply_pose(name)
    key_all(fr)
    print('KEY', name, fr)

sc.frame_start, sc.frame_end = 1, FRAMES['A_end']
for fc in sc.animation_data.action.fcurves if sc.animation_data and sc.animation_data.action else []:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'

# рендер
cam = bpy.data.objects['cam']
cam.data.type = 'PERSP'; cam.data.lens = 46
cam.location = (1.55, -1.95, 1.72)
cam.rotation_euler = (Vector((0, 0, 1.06)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
sc.render.resolution_x, sc.render.resolution_y = 960, 620
sc.eevee.taa_render_samples = 10
sc.render.filepath = '/tmp/anim_v2/f'
bpy.ops.render.render(animation=True)
print('ANIM_DONE')

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_v2_anim.blend'))
print('SAVED omni_v2_anim.blend')
