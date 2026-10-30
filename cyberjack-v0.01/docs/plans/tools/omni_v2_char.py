"""Кладём Corin в ложе ОМНИ-1 v2, ставим конечности в кольца, проверяем проникновение."""
import bpy, math, os
from mathutils import Vector
from mathutils.bvhtree import BVHTree

BL = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout/omni_v2.blend'
CORIN = '/home/cyberkitty/Загрузки/Corin_More_Foot_shape_Pantyhose.blend'
OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'

bpy.ops.wm.open_mainfile(filepath=BL)
sc = bpy.context.scene
rig = bpy.data.objects['OMNI_rig']
TOPZ = 1.11

# ---------------- Corin ----------------
with bpy.data.libraries.load(CORIN) as (src, dst):
    dst.objects = ['rig_', 'Body-footshape-5']
for o in dst.objects:
    sc.collection.objects.link(o)
body = bpy.data.objects['Body-footshape-5']
arm = bpy.data.objects['rig_']

# масштаб под 1.70 и укладка на стол (голова к -X)
bpy.context.view_layer.update()
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg); me = ev.to_mesh()
zs = [(body.matrix_world @ v.co) for v in me.vertices]
h = max(p.z for p in zs) - min(p.z for p in zs)
ev.to_mesh_clear()
# рост вдоль локальной оси Y у Corin → приводим габарит к 1.70
s = 1.70 / h
arm.scale = (s, s, s)
bpy.context.view_layer.update()

# кладём: подбираем поворот по габаритам (ищем минимальную высоту = лежит)
def bbox_now():
    dg = bpy.context.evaluated_depsgraph_get()
    ev = body.evaluated_get(dg); me = ev.to_mesh()
    pts = [body.matrix_world @ v.co for v in me.vertices]
    ev.to_mesh_clear()
    return (max(p.x for p in pts) - min(p.x for p in pts),
            max(p.y for p in pts) - min(p.y for p in pts),
            max(p.z for p in pts) - min(p.z for p in pts),
            min(p.z for p in pts))

best = None
for rx in (-90, 90):
    for rz in (0, 90, 180, 270):
        arm.rotation_euler = (math.radians(rx), 0, math.radians(rz))
        bpy.context.view_layer.update()
        dx, dy, dz, mnz = bbox_now()
        score = dz                      # лежит = низкий габарит по Z
        if best is None or score < best[0]:
            best = (score, rx, rz, dx, dy, dz)
print('LAY', best)
arm.rotation_euler = (math.radians(best[1]), 0, math.radians(best[2]))
bpy.context.view_layer.update()

# ставим на плоскость стола
dx, dy, dz, mnz = bbox_now()
arm.location.z += (TOPZ + 0.004) - mnz
bpy.context.view_layer.update()

# центр по X/Y
dg = bpy.context.evaluated_depsgraph_get()
ev = body.evaluated_get(dg); me = ev.to_mesh()
pts = [body.matrix_world @ v.co for v in me.vertices]
cx = (max(p.x for p in pts) + min(p.x for p in pts)) / 2
ev.to_mesh_clear()
arm.location.x += (-0.05) - cx
bpy.context.view_layer.update()

# ---------------- FK, чтобы кости слушались контролов ----------------
for nm in ('c_foot_ik.l', 'c_foot_ik.r', 'c_hand_ik.l', 'c_hand_ik.r'):
    pb = arm.pose.bones.get(nm)
    if pb and 'ik_fk_switch' in pb.keys():
        pb['ik_fk_switch'] = 1.0
bpy.context.view_layer.update()

# ---------------- ставим кисти и стопы в кольца ----------------
def cuff_pos(tag):
    return rig.matrix_world @ rig.pose.bones[f'head_{tag}'].head

def aim_chain(ctl_name, upper, lower, target, pole_up=True):
    """аналитика: ставим контрол так, чтобы кисть/стопа пришла в target (через Blender IK)"""
    ctl = arm.pose.bones.get(ctl_name)
    if ctl is None:
        return None
    m = ctl.matrix.copy()
    m.translation = arm.matrix_world.inverted() @ target
    ctl.matrix = m
    bpy.context.view_layer.update()
    pb = arm.pose.bones[lower]
    return (arm.matrix_world @ pb.tail - target).length

for tag, ctl, lower, upper in (('arm_L', 'c_hand_ik.l', 'hand.l', 'forearm.l'),
                               ('arm_R', 'c_hand_ik.r', 'hand.r', 'forearm.r'),
                               ('leg_L', 'c_foot_ik.l', 'foot.l', 'calf.l'),
                               ('leg_R', 'c_foot_ik.r', 'foot.r', 'calf.r')):
    # включаем IK для этой конечности
    pb = arm.pose.bones.get(ctl)
    if pb and 'ik_fk_switch' in pb.keys():
        pb['ik_fk_switch'] = 0.0
    bpy.context.view_layer.update()
    d = aim_chain(ctl, upper, lower, cuff_pos(tag))
    print('FIT', tag, round(d, 3) if d is not None else None)

# ---------------- проверка проникновения ----------------
dg = bpy.context.evaluated_depsgraph_get()
m = bpy.data.objects['OMNI_1']
bvh = BVHTree.FromObject(m, dg)
evb = body.evaluated_get(dg); mb = evb.to_mesh(); mw = body.matrix_world
dirs = [Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))]
inside = 0; depth = 0.0
for v in mb.vertices:
    p = mw @ v.co
    votes = 0
    for d in dirs:
        cnt = 0; o = p.copy()
        for _ in range(8):
            hit = bvh.ray_cast(o, d)
            if hit[0] is None:
                break
            cnt += 1; o = hit[0] + d * 1e-4
        if cnt % 2 == 1:
            votes += 1
    if votes >= 2:
        inside += 1
        near = bvh.find_nearest(p)
        if near[0] is not None:
            depth = max(depth, (p - near[0]).length)
n_verts = len(mb.vertices)
ev.to_mesh_clear() if False else None
evb.to_mesh_clear()
print('BODY_INSIDE', inside, 'MAX_DEPTH', round(depth, 3), 'OF', n_verts)

# ---------------- кадры ----------------
cam = bpy.data.objects['cam']
def shot(name, loc, aim, lens=50, ortho=None):
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho:
        cam.data.ortho_scale = ortho; cam.location = loc; cam.rotation_euler = (0, 0, 0)
    else:
        cam.data.lens = lens; cam.location = loc
        cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True); print('SHOT', name)

shot('v2_B_top.png', (0, 0, 4.2), None, ortho=2.15)
shot('v2_B_34.png', (1.7, -2.0, 1.85), (0, 0, 1.10), 48)
shot('v2_B_side.png', (0.2, -2.7, 1.20), (0, 0, 1.10), 52)
shot('v2_B_head.png', (-1.15, -1.10, 1.55), (-0.55, 0.0, 1.18), 62)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_v2_char.blend'))
print('SAVED omni_v2_char.blend')
