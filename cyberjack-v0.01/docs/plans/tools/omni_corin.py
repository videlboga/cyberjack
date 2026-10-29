"""ОМНИ-1 + Corin (ARP-риг): тело на станке, крепления по суставам.

Берём проверенную сцену станка (omni_static.blend), убираем VRM-тело и ставим
Corin с её ARP-ригом (FK-контролы c_thigh_fk / c_arm_fk). Поза задаётся
ПОВОРОТОМ КОСТЕЙ, без IK — это то, что на VRM ломалось.

Запуск: blender -b blockout/omni_static.blend -noaudio --python tools/omni_corin.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
CORIN = '/home/cyberkitty/Загрузки/Corin_More_Foot_shape_Pantyhose.blend'
PLAT_TOP = 1.11          # плоскость матраса в сцене станка

sc = bpy.context.scene
rig = bpy.data.objects['OMNI_rig']

# --- убрать VRM-тело ---------------------------------------------------------
for o in list(bpy.data.objects):
    if o.type == 'ARMATURE' and o.name != 'OMNI_rig':
        bpy.data.objects.remove(o, do_unlink=True)
    elif o.type == 'MESH' and o.name in ('Body', 'Face', 'Hair'):
        bpy.data.objects.remove(o, do_unlink=True)

# --- подключить Corin --------------------------------------------------------
before = set(bpy.data.objects)
with bpy.data.libraries.load(CORIN, link=False) as (df, dt):
    dt.objects = [n for n in df.objects if n in ('rig_', 'Body-footshape-5')]
new = [o for o in dt.objects if o]
for o in new:
    sc.collection.objects.link(o)
bpy.context.view_layer.update()

carm = bpy.data.objects.get('rig_')
cbody = [o for o in new if o.type == 'MESH']

# КРИТИЧНО: у ARP деформы следят за FK только если переключить IK→FK.
# Без этого кости двигаются, а меш стоит — «тело не движется».
for nm in ('c_foot_ik.l', 'c_foot_ik.r', 'c_hand_ik.l', 'c_hand_ik.r'):
    pb = carm.pose.bones.get(nm)
    if pb and 'ik_fk_switch' in pb.keys():
        pb['ik_fk_switch'] = 1.0
        print('SWITCH', nm, '= FK')
bpy.context.view_layer.update()
print('APPENDED', [o.name for o in new])

# служебные виджеты ARP (cs_*) — это формы костей, а не геометрия: убрать из рендера
hidden = 0
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith('cs_'):
        o.hide_render = True
        o.hide_viewport = True
        hidden += 1
print('HIDDEN_WIDGETS', hidden)
# всё, что приехало из чужого файла и не привязано к ригам — удалить (виджеты, заготовки)
for o in list(bpy.data.objects):
    if o.type != 'MESH':
        continue
    if o.name in ('OMNI_1', 'Body-footshape-5'):
        continue
    bpy.data.objects.remove(o, do_unlink=True)   # всё чужое, включая приехавшие аксессуары
print('CLEANED')
# спрятать лишние тела, если они приехали связями
for o in bpy.data.objects:
    if o.type == 'MESH' and o.name.startswith('Body-footshape') and o.name != 'Body-footshape-5':
        o.hide_render = True
        o.hide_viewport = True

# --- масштаб и укладка на матрас --------------------------------------------
def body_pts():
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in cbody:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        out += [mw @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    return out


pts = body_pts()
h = max(p.z for p in pts) - min(p.z for p in pts)
k = 1.70 / h
carm.matrix_world = Matrix.Scale(k, 4) @ carm.matrix_world
bpy.context.view_layer.update()
print('SCALE', round(k, 4), 'height', round(h, 3))

# на спину, головой к -X
R = Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Rotation(math.radians(-90), 4, 'X')
carm.matrix_world = R @ carm.matrix_world
bpy.context.view_layer.update()
pts = body_pts()
cx = (min(p.x for p in pts) + max(p.x for p in pts)) / 2
cy = (min(p.y for p in pts) + max(p.y for p in pts)) / 2
carm.matrix_world = Matrix.Translation(Vector((-cx, -cy, PLAT_TOP - min(p.z for p in pts) + 0.004))) @ carm.matrix_world
bpy.context.view_layer.update()
pts = body_pts()
print('PLACED x', round(min(p.x for p in pts), 2), round(max(p.x for p in pts), 2),
      'y', round(min(p.y for p in pts), 2), round(max(p.y for p in pts), 2),
      'z', round(min(p.z for p in pts), 3), round(max(p.z for p in pts), 3))


def bp(name):
    pb = carm.pose.bones.get(name)
    return None if pb is None else (carm.matrix_world @ pb.head)


def bt(name):
    pb = carm.pose.bones.get(name)
    return None if pb is None else (carm.matrix_world @ pb.tail)


def reset():
    for pb in carm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()


def rb(name, deg, axis):
    pb = carm.pose.bones.get(name)
    if pb:
        pb.rotation_mode = 'XYZ'
        e = [0.0, 0.0, 0.0]
        e[axis] = math.radians(deg)
        pb.rotation_euler = e


def find_abduct(pair, tip):
    """ARP: отведение — ось X контрола, ОДИН знак на обе стороны"""
    best = None
    for axis in (0, 1, 2):
        for d in (30, 45, 60, 75, 90, -30, -45, -60, -75):
            reset()
            rb(pair[0], d, axis)
            rb(pair[1], d, axis)
            bpy.context.view_layer.update()
            l, r = bt(tip[0]), bt(tip[1])
            if not l or not r:
                continue
            if l.y < 0.10 or r.y > -0.10:
                continue
            score = (l.y - r.y) - 0.5 * abs(l.z - r.z)
            if best is None or score > best[0]:
                best = (score, axis, d)
    reset()
    return best


LEG = find_abduct(('c_thigh_fk.l', 'c_thigh_fk.r'), ('c_foot_fk.l', 'c_foot_fk.r'))
ARM = find_abduct(('c_arm_fk.l', 'c_arm_fk.r'), ('c_hand_fk.l', 'c_hand_fk.r'))
print('ABDUCT leg', LEG, 'arm', ARM)

# --- крепления по суставам ---------------------------------------------------
def place(tag, target, limb_dir=None):
    x, y, z = target
    RX = 1.90 / 2 - 0.06 - 0.03
    RY = 0.64 / 2 - 0.06 - 0.03
    MODULE_Z = 1.11 - 0.05
    # каретка всегда на боковом рельсе своей стороны — без перескоков
    side = 1 if tag.endswith('_L') else -1
    cx2 = max(-RX, min(RX, x))
    cy2 = side * RY
    pbc = rig.pose.bones[f'car_{tag}']
    rest = rig.data.bones[f'car_{tag}'].head_local
    pbc.location = (cx2 - rest.x, cy2 - rest.y, 0)
    bpy.context.view_layer.update()
    pbb = rig.pose.bones[f'boom_{tag}']
    vec = Vector((x - cx2, y - cy2, 0))
    pbb.rotation_mode = 'XYZ'
    pbb.rotation_euler = (0, 0, math.atan2(vec.y, vec.x) - math.atan2(1, 0))
    pbb.scale = (1, max(0.02, vec.length), 1)
    pbp = rig.pose.bones[f'post_{tag}']
    pbp.scale = (1, max(0.05, z - MODULE_Z), 1)   # плоскость штанг = столешница - 50 мм
    if limb_dir is not None and limb_dir.length > 1e-6:
        pbh = rig.pose.bones[f'head_{tag}']
        pbh.rotation_mode = 'XYZ'
        pbh.rotation_euler = (0, math.atan2(limb_dir.y, limb_dir.x), 0)
    bpy.context.view_layer.update()
    return (rig.matrix_world @ rig.pose.bones[f'head_{tag}'].head - Vector(target)).length


def fit_all():
    out = {}
    joints = {'arm_L': bt('c_hand_fk.l'), 'arm_R': bt('c_hand_fk.r'),
              'leg_L': bt('c_foot_fk.l'), 'leg_R': bt('c_foot_fk.r')}
    dirs = {'arm_L': (bt('c_hand_fk.l') - bp('c_hand_fk.l')) if bt('c_hand_fk.l') else None,
            'arm_R': (bt('c_hand_fk.r') - bp('c_hand_fk.r')) if bt('c_hand_fk.r') else None,
            'leg_L': (bt('c_foot_fk.l') - bp('c_foot_fk.l')) if bt('c_foot_fk.l') else None,
            'leg_R': (bt('c_foot_fk.r') - bp('c_foot_fk.r')) if bt('c_foot_fk.r') else None}
    for k2, t in joints.items():
        if t:
            out[k2] = round(place(k2, t, dirs.get(k2)), 3)
    return out


cam = bpy.data.objects['cam']
sc.render.resolution_x, sc.render.resolution_y = 1300, 900


def shot(name, loc, aim, lens=50, ortho=None):
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho:
        cam.data.ortho_scale = ortho
    cam.data.lens = lens
    cam.location = loc
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


# поза A: руки вдоль тела
reset()
print('ERR_A', fit_all())
shot('co_A.png', (2.3, -2.5, 1.75), (0, 0, 1.05))

# угол контрола подгоняем под анатомическую цель (стопа/кисть на нужном Y)
def aim_angle(pair, tip, want_y, axis):
    best = None
    for d in range(0, 95, 5):
        reset()
        rb(pair[0], d, axis)
        rb(pair[1], d, axis)
        bpy.context.view_layer.update()
        t = bt(tip[0])
        if not t:
            continue
        err = abs(abs(t.y) - want_y)
        if best is None or err < best[0]:
            best = (err, d)
    return best[1]


LEG_A = aim_angle(('c_thigh_fk.l', 'c_thigh_fk.r'), ('c_foot_fk.l', 'c_foot_fk.r'), 0.85, LEG[1])
ARM_A = aim_angle(('c_arm_fk.l', 'c_arm_fk.r'), ('c_hand_fk.l', 'c_hand_fk.r'), 0.55, ARM[1])
print('AIM leg', LEG_A, 'arm', ARM_A)

# поза D: шпагат
reset()
rb('c_thigh_fk.l', LEG_A, LEG[1])
rb('c_thigh_fk.r', LEG_A, LEG[1])
rb('c_arm_fk.l', ARM_A, ARM[1])
rb('c_arm_fk.r', ARM_A, ARM[1])
bpy.context.view_layer.update()
print('FOOT', [round(v, 2) for v in bt('c_foot_fk.l')], [round(v, 2) for v in bt('c_foot_fk.r')])
print('ERR_D', fit_all())
# проверка, что меш реально деформируется
dg0 = bpy.context.evaluated_depsgraph_get()
ev = cbody[0].evaluated_get(dg0); me = ev.to_mesh()
w = cbody[0].matrix_world
ys = [(w @ v.co).y for v in me.vertices]
print('DEFORM y', round(min(ys), 2), round(max(ys), 2))
ev.to_mesh_clear()
shot('co_D.png', (2.3, -2.5, 1.75), (0, 0, 1.05))
shot('co_D_top.png', (0, 0, 4.2), (0, 0, 1.0), ortho=2.9)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_corin.blend'))
print('SAVED omni_corin.blend')

# === АНИМАЦИЯ: углы контролов ключуются, кольца подгоняются в тех же кадрах ===
MB = [f'{pre}_{t}' for t in ('arm_L', 'arm_R', 'leg_L', 'leg_R')
      for pre in ('car', 'boom', 'post', 'head')]
BODY = ('c_thigh_fk.l', 'c_thigh_fk.r', 'c_arm_fk.l', 'c_arm_fk.r')

# ключ каждые 3 кадра: между ними кольцо и сустав расходятся меньше 2 см
SCHED = [(f, max(0.0, 1.0 - abs(f - 45) / 44.0)) for f in range(1, 91, 3)]
if SCHED[-1][0] != 90:
    SCHED.append((90, 0.0))

body_keys, mach_keys = [], []
for frame, t in SCHED:
    reset()
    rb('c_thigh_fk.l', LEG_A * t, LEG[1])
    rb('c_thigh_fk.r', LEG_A * t, LEG[1])
    rb('c_arm_fk.l', ARM_A * t, ARM[1])
    rb('c_arm_fk.r', ARM_A * t, ARM[1])
    bpy.context.view_layer.update()
    errs = fit_all()
    body_keys.append((frame, {b: tuple(carm.pose.bones[b].rotation_euler) for b in BODY}))
    mach_keys.append((frame, {b: (tuple(rig.pose.bones[b].location),
                                  tuple(rig.pose.bones[b].rotation_euler),
                                  tuple(rig.pose.bones[b].scale)) for b in MB}))
    print('KEY', frame, 't', t, 'err', errs)

for frame, rots in body_keys:
    for bn, rot in rots.items():
        pb = carm.pose.bones[bn]
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = rot
        pb.keyframe_insert('rotation_euler', frame=frame)
for frame, snap in mach_keys:
    for bn, (loc, rot, scl) in snap.items():
        pb = rig.pose.bones[bn]
        pb.location, pb.rotation_euler, pb.scale = loc, rot, scl
        pb.keyframe_insert('location', frame=frame)
        pb.keyframe_insert('rotation_euler', frame=frame)
        pb.keyframe_insert('scale', frame=frame)
for ob in (carm, rig):
    if ob.animation_data and ob.animation_data.action:
        for fc in ob.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
print('KEYS body', len(carm.animation_data.action.fcurves),
      'machine', len(rig.animation_data.action.fcurves))

# --- проверка каждого кадра --------------------------------------------------
def chk():
    bad = []
    for f in range(1, 91, 2):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        for side, tag in (('l', 'leg_L'), ('r', 'leg_R')):
            th = carm.matrix_world @ carm.pose.bones[f'c_thigh_fk.{side}'].head
            kn = carm.matrix_world @ carm.pose.bones[f'c_leg_fk.{side}'].head
            ft = carm.matrix_world @ carm.pose.bones[f'c_foot_fk.{side}'].tail
            ring = rig.matrix_world @ rig.pose.bones[f'head_{tag}'].head
            ang = math.degrees((th - kn).angle(ft - kn, 0))
            sgn = 1 if side == 'l' else -1
            if ang < 140:
                bad.append((f, tag, 'сустав пересогнут', round(ang)))
            if (ring - ft).length > 0.05:
                bad.append((f, tag, 'кольцо не на суставе', round((ring - ft).length, 3)))
            if ft.y * sgn < 0.02:
                bad.append((f, tag, 'конечность на чужой стороне', round(ft.y, 3)))
        for side, tag in (('l', 'arm_L'), ('r', 'arm_R')):
            sh = carm.matrix_world @ carm.pose.bones[f'c_arm_fk.{side}'].head
            el = carm.matrix_world @ carm.pose.bones[f'c_forearm_fk.{side}'].head
            hd = carm.matrix_world @ carm.pose.bones[f'c_hand_fk.{side}'].tail
            ring = rig.matrix_world @ rig.pose.bones[f'head_{tag}'].head
            ang = math.degrees((sh - el).angle(hd - el, 0))
            if ang < 130:
                bad.append((f, tag, 'сустав пересогнут', round(ang)))
            if (ring - hd).length > 0.05:
                bad.append((f, tag, 'кольцо не на суставе', round((ring - hd).length, 3)))
    return bad


bad = chk()
print('ANIM_BAD', len(bad), bad[:5])

if not bad:
    sc.render.resolution_x, sc.render.resolution_y = 960, 640
    sc.eevee.taa_render_samples = 12
    cam.data.type = 'PERSP'
    cam.data.lens = 45
    cam.location = (2.15, -2.45, 1.75)
    cam.rotation_euler = (Vector((0, 0, 1.05)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
    for f in (1, 25, 37, 60):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(OUT, f'cx_f{f:02d}.png')
        bpy.ops.render.render(write_still=True)
        print('SHOT', f'cx_f{f:02d}.png')
    sc.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_corin_anim.blend'))
    print('SAVED omni_corin_anim.blend')
else:
    print('ANIM_REJECTED')
