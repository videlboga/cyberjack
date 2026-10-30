"""Три «лежачих» положения: машина ставит кольца в анатомические цели, тело тянется за ними."""
import bpy, math, os, sys
from mathutils import Vector
sys.path.insert(0, '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/tools')
import omni_checks as C

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
rig = bpy.data.objects['OMNI_rig']
arm = bpy.data.objects['rig_']
body = bpy.data.objects['Body-footshape-5']
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
    r = max(0.05, math.hypot(dx, dy))
    pba = rig.pose.bones[f'arm_{tag}']
    pba.rotation_mode = 'XYZ'
    yaw = math.atan2(-dx * sgn, dy * sgn)
    if sgn < 0:
        yaw += math.pi
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


def align_cuff(tag, seg_dir):
    """кардан: ось кольца по оси сегмента (локоть→кисть / колено→стопа)"""
    pbh = rig.pose.bones[f'head_{tag}']
    q = Vector((0, 1, 0)).rotation_difference(seg_dir.normalized())
    m = pbh.matrix.copy()
    m = q.to_matrix().to_4x4() @ m.to_3x3().to_4x4()
    m.translation = pbh.matrix.translation
    pbh.matrix = m
    bpy.context.view_layer.update()


def set_limb(tag, cuff):
    """ARP-IK: контрол в центр кольца, тело тянется"""
    kind = 'arm' if tag.startswith('arm') else 'leg'
    ctl_name = f'c_hand_ik.{"l" if tag.endswith("_L") else "r"}' if kind == 'arm' \
        else f'c_foot_ik.{"l" if tag.endswith("_L") else "r"}'
    ctl = arm.pose.bones.get(ctl_name)
    if ctl is None:
        return None
    if 'ik_fk_switch' in ctl.keys():
        ctl['ik_fk_switch'] = 0.0
    bpy.context.view_layer.update()
    m = ctl.matrix.copy()
    m.translation = arm.matrix_world.inverted() @ cuff
    ctl.matrix = m
    bpy.context.view_layer.update()
    lower = 'hand.l' if ctl_name.endswith('l') and kind == 'arm' else \
            'hand.r' if kind == 'arm' else ('foot.l' if ctl_name.endswith('l') else 'foot.r')
    pb = arm.pose.bones.get(lower)
    if pb is None:
        return None
    dg = bpy.context.evaluated_depsgraph_get(); er = arm.evaluated_get(dg)
    return ((er.matrix_world @ er.pose.bones[lower].head) - cuff).length


POSES = {
    'A': {'arm_L': (-0.06, 0.20, 1.20), 'arm_R': (-0.06, -0.20, 1.20),
          'leg_L': (0.78, 0.08, 1.22), 'leg_R': (0.78, -0.08, 1.22)},
    'C': {'arm_L': (-0.50, 0.55, 1.20), 'arm_R': (-0.50, -0.55, 1.20),
          'leg_L': (0.78, 0.08, 1.22), 'leg_R': (0.78, -0.08, 1.22)},
    'D': {'arm_L': (-0.50, 0.55, 1.20), 'arm_R': (-0.50, -0.55, 1.20),
          'leg_L': (0.10, 0.62, 1.22), 'leg_R': (0.10, -0.62, 1.22)},
}

cam = bpy.data.objects['cam']
for name, targets in POSES.items():
    for tag, t in targets.items():
        place(tag, t)
    bpy.context.view_layer.update()
    fits = {}
    for tag in targets:
        fits[tag] = round(set_limb(tag, cuff_center(tag)) or -1, 3)
    # кардан: кольцо по оси сегмента
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
    ok, toes = C.orientation(dbg=False)
    pen = C.penetration(dbg=False, every=3)
    print(f'POSE {name} fit {fits} on_back {ok} pen {pen["counts"]}')
    cam.data.type = 'PERSP'; cam.data.lens = 46
    cam.location = (1.55, -1.95, 1.72)
    cam.rotation_euler = (Vector((0, 0, 1.06)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, f'pose_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('SHOT pose', name)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_v2_poses.blend'))
print('SAVED omni_v2_poses.blend')
