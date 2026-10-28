"""Поза тела по аналитическому 2-звенному решателю (без IK-констрейнтов).

Blender-IK на VRM-скелете перещёлкивает колени и локти (нога уходит назад,
рука выворачивается). Здесь положение считается явно:

  S — плечо/таз, T — цель (кольцо), L1/L2 — длины звеньев,
  a = (L1²−L2²+d²)/(2d), h = √(L1²−a²), ось = (T−S)/d,
  середина = S + ось·a + перп·h, где перп задан полюсом.

Полюс: колено — вверх (+Z, человек лежит на спине), локоть — вниз (−Z).
Поэтому изгиб всегда анатомический, а не «как решил солвер».

Проверки в логе: колено выше таза, локоть ниже плеча, конечность не переходит
на чужую сторону, угол в суставе в разумных пределах.

Запуск: blender -b blockout/omni_sync.blend -noaudio --python tools/omni_pose.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
sc = bpy.context.scene
rig = bpy.data.objects['OMNI_rig']
arm = [o for o in bpy.data.objects if o.type == 'ARMATURE' and o.name != 'OMNI_rig'][0]

# снимаем IK — считаем сами
for pb in arm.pose.bones:
    for c in list(pb.constraints):
        if c.type == 'IK':
            pb.constraints.remove(c)

LIMBS = {
    'L_arm': dict(upper='J_Bip_L_UpperArm', lower='J_Bip_L_LowerArm', ring='head_arm_L',
                  pole=Vector((0, 0, -1)), side=+1),
    'R_arm': dict(upper='J_Bip_R_UpperArm', lower='J_Bip_R_LowerArm', ring='head_arm_R',
                  pole=Vector((0, 0, -1)), side=-1),
    'L_leg': dict(upper='J_Bip_L_UpperLeg', lower='J_Bip_L_LowerLeg', ring='head_leg_L',
                  pole=Vector((0, 0, 1)), side=+1),
    'R_leg': dict(upper='J_Bip_R_UpperLeg', lower='J_Bip_R_LowerLeg', ring='head_leg_R',
                  pole=Vector((0, 0, 1)), side=-1),
}


def bone_len(name):
    b = arm.data.bones[name]
    return (b.tail_local - b.head_local).length


def set_dir(pb, target):
    """направить кость (её +Y) в точку target, голова — в head_pos"""
    head = pb.matrix.translation
    d = (target - head)
    if d.length < 1e-6:
        return
    q = d.normalized().to_track_quat('Y', 'Z')
    M = q.to_matrix().to_4x4()
    M.translation = head
    pb.matrix = M
    bpy.context.view_layer.update()
    pb.rotation_mode = 'XYZ'


def solve_limb(cfg):
    pbu = arm.pose.bones[cfg['upper']]
    pbl = arm.pose.bones[cfg['lower']]
    S = pbu.matrix.translation.copy()
    T = rig.matrix_world @ rig.pose.bones[cfg['ring']].head
    L1 = bone_len(cfg['upper'])
    L2 = bone_len(cfg['lower'])
    v = T - S
    d = v.length
    dmax = (L1 + L2) * 0.995
    if d > dmax:
        T = S + v.normalized() * dmax
        d = dmax
    if d < abs(L1 - L2) + 1e-4:
        T = S + v.normalized() * (abs(L1 - L2) + 0.01)
        d = (T - S).length
    axis = (T - S) / d
    a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, L1 * L1 - a * a))
    pole = cfg['pole'] - axis * cfg['pole'].dot(axis)
    if pole.length < 1e-5:
        pole = Vector((0, 0, 1)) - axis * axis.z
    perp = pole.normalized()
    mid = S + axis * a + perp * h
    set_dir(pbu, mid)
    set_dir(pbl, T)
    return S, mid, T


def report(tag):
    rows = []
    for key, cfg in LIMBS.items():
        S, mid, T = solve_limb(cfg)
        u, l = cfg['upper'], cfg['lower']
        ang = math.degrees((arm.pose.bones[u].tail - arm.pose.bones[u].head).angle(
            arm.pose.bones[l].tail - arm.pose.bones[l].head))
        rows.append((key, round(ang, 0), round(mid.z - S.z, 3), round(T.y * cfg['side'], 2)))
    for r in rows:
        print('JOINT', tag, r[0], 'угол', r[1], 'изгиб dz', r[2], 'сторона', r[3])
    return rows


FRAMES = list(range(1, 91))
bad = []
for f in FRAMES:
    sc.frame_set(f)
    bpy.context.view_layer.update()
    for key, cfg in LIMBS.items():
        S, mid, T = solve_limb(cfg)
        # анатомические проверки
        if key.endswith('leg') and mid.z < S.z - 0.02:
            bad.append((f, key, 'колено ниже таза', round(mid.z - S.z, 3)))
        if key.endswith('arm') and mid.z > S.z + 0.05:
            bad.append((f, key, 'локоть выше плеча', round(mid.z - S.z, 3)))
        if T.y * cfg['side'] < 0:
            bad.append((f, key, 'конечность на чужой стороне', round(T.y, 3)))
    # ключи на кости конечностей
    for cfg in LIMBS.values():
        for bn in (cfg['upper'], cfg['lower']):
            pb = arm.pose.bones[bn]
            pb.keyframe_insert('rotation_euler', frame=f)

print('BAD', len(bad), bad[:6])

sc.frame_set(45)
report('f45')
sc.frame_set(1)
report('f01')

cam = bpy.data.objects['cam']
sc.render.resolution_x, sc.render.resolution_y = 1200, 860
for f in (1, 23, 45):
    sc.frame_set(f)
    bpy.context.view_layer.update()
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.9
    cam.location = (0, 0, 4.2)
    cam.rotation_euler = (0, 0, 0)
    sc.render.filepath = os.path.join(OUT, f'fk_top_f{f:02d}.png')
    bpy.ops.render.render(write_still=True)
    print('SHOT', f'fk_top_f{f:02d}.png')

sc.frame_set(45)
cam.data.type = 'PERSP'
cam.data.lens = 50
cam.location = (2.2, -2.5, 1.75)
cam.rotation_euler = (Vector((0, 0, 1.05)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
sc.render.filepath = os.path.join(OUT, 'fk_45_34.png')
bpy.ops.render.render(write_still=True)
print('SHOT fk_45_34.png')

sc.frame_set(1)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_fk.blend'))
print('SAVED omni_fk.blend')
