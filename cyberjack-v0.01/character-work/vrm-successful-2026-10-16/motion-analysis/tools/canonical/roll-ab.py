# Сравнение стратегий скрутки по ОДНОМУ объективному критерию: насколько положения суставов
# совпадают с источником (после подгонки масштаба и общего поворота).
#
# Скрутка кости не только крутит кожу: она сдвигает начало дочерних костей, поэтому ошибочная
# скрутка «раскорячивает» ноги. Меряем ошибку суставов и выбираем лучшую стратегию.
#
#   blender -b rig.blend --python roll-ab.py -- pose.json frame.json
import bpy, sys, json, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
pose_path, frame_path = argv[0], argv[1]
pose = json.load(open(pose_path))
SL = pose['slots']
fd = json.load(open(frame_path))

arm = bpy.data.objects['rig_H']
P = arm.pose.bones
B = arm.data.bones
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='POSE')


def hd(n):
    return B[n].head_local.copy()


a_t = (hd('leftUpperLeg') - hd('rightUpperLeg')).normalized()
fraw = B['leftToes'].tail_local - hd('leftFoot')
f_t = (fraw - a_t * fraw.dot(a_t)).normalized()
uraw = hd('head') - hd('hips')
u_t = (uraw - a_t * uraw.dot(a_t))
u_t = (u_t - f_t * u_t.dot(f_t)).normalized()


def c2w(d):
    return (a_t * d[0] + f_t * d[1] + u_t * d[2]).normalized()


ORDER = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
         'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand',
         'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
         'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes']
CHILD = {'hips': 'spine', 'spine': 'chest', 'chest': 'upperChest', 'upperChest': 'neck', 'neck': 'head', 'head': None,
         'leftUpperArm': 'leftLowerArm', 'leftLowerArm': 'leftHand', 'leftHand': None,
         'rightUpperArm': 'rightLowerArm', 'rightLowerArm': 'rightHand', 'rightHand': None,
         'leftUpperLeg': 'leftLowerLeg', 'leftLowerLeg': 'leftFoot', 'leftFoot': 'leftToes', 'leftToes': None,
         'rightUpperLeg': 'rightLowerLeg', 'rightLowerLeg': 'rightFoot', 'rightFoot': 'rightToes', 'rightToes': None}
PAIRS = [('cf_j_hips', 'hips'), ('cf_j_spine01', 'spine'), ('cf_j_spine02', 'chest'),
         ('cf_j_spine03', 'upperChest'), ('cf_j_neck', 'neck'), ('cf_j_head', 'head'),
         ('cf_j_arm00_L', 'leftUpperArm'), ('cf_j_forearm01_L', 'leftLowerArm'), ('cf_j_hand_L', 'leftHand'),
         ('cf_j_arm00_R', 'rightUpperArm'), ('cf_j_forearm01_R', 'rightLowerArm'), ('cf_j_hand_R', 'rightHand'),
         ('cf_j_thigh00_L', 'leftUpperLeg'), ('cf_j_leg01_L', 'leftLowerLeg'), ('cf_j_foot_L', 'leftFoot'),
         ('cf_j_thigh00_R', 'rightUpperLeg'), ('cf_j_leg01_R', 'rightLowerLeg'), ('cf_j_foot_R', 'rightFoot')]

intended = {s: c2w(SL[s]['d']) for s in ORDER if s in SL}


def orient(slot, d_world, ref):
    pb = P[slot]
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    B3 = base.to_3x3()
    x0 = Vector((B3[0][0], B3[1][0], B3[2][0])).normalized()
    y0 = (pb.tail - pb.head).normalized()
    z0 = x0.cross(y0).normalized()
    R0 = Matrix(((x0.x, y0.x, z0.x), (x0.y, y0.y, z0.y), (x0.z, y0.z, z0.z)))
    y1 = d_world.normalized()
    x1 = ref - y1 * ref.dot(y1)
    if x1.length < 1e-6:
        x1 = x0 - y1 * x0.dot(y1)
    x1.normalize()
    z1 = x1.cross(y1).normalized()
    R1 = Matrix(((x1.x, y1.x, z1.x), (x1.y, y1.y, z1.y), (x1.z, y1.z, z1.z)))
    q = (R1 @ R0.transposed()).to_quaternion()
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ B3).to_4x4()
    pb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()


def aim(slot, d_world):
    pb = P[slot]
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    d0 = (pb.tail - pb.head)
    if d0.length < 1e-9:
        return
    q = d0.normalized().rotation_difference(d_world.normalized())
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ base.to_3x3()).to_4x4()
    pb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()


def src_x(slot):
    s = SL.get(slot, {})
    if 'x' not in s:
        return None
    xw = c2w(s['x'])
    if s.get('xrest'):
        bx = B[slot].matrix_local.to_3x3()
        rx = Vector((bx[0][0], bx[1][0], bx[2][0]))
        if c2w(s['xrest']).dot(rx) < 0:
            xw = -xw
    return xw


def joints_rms():
    src = {n: Vector(v) for n, v in zip(fd['names'], fd['frame'])}
    H = fd['height']
    A, Bq = [], []
    for js, slot in PAIRS:
        if js in src and slot in P:
            v = src[js]
            A.append(Vector((v[0] * H, v[1] * H, v[2] * H)))
            Bq.append(arm.matrix_world @ P[slot].head)
    n = len(A)
    cA = sum(A, Vector()) / n
    cB = sum(Bq, Vector()) / n
    A0 = [p - cA for p in A]
    B0 = [q - cB for q in Bq]
    num = sum(p.length_squared for p in A0)
    den = sum(q.length_squared for q in B0)
    sc = math.sqrt(num / den) if den > 0 else 1.0
    best = None
    for axis in ('X', 'Y', 'Z'):
        for ang in range(0, 360, 10):
            R = Matrix.Rotation(math.radians(ang), 3, axis)
            e = sum((R @ (q * sc) - p).length for p, q in zip(A0, B0))
            if best is None or e < best[0]:
                best = (e, axis, ang)
    _, axis, ang = best
    for step in (2, 0.5):
        for dd in (-step, step):
            R = Matrix.Rotation(math.radians(ang + dd), 3, axis)
            e = sum((R @ (q * sc) - p).length for p, q in zip(A0, B0))
            if e < best[0]:
                best = (e, axis, ang + dd)
    R = Matrix.Rotation(math.radians(best[2]), 3, best[1])
    errs = [(R @ (q * sc) - p).length for p, q in zip(A0, B0)]
    return round(math.sqrt(sum(e * e for e in errs) / len(errs)) * 100, 1)


def reset():
    for pb in P:
        pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()


results = {}
# A: только направления, без скрутки
reset()
for slot in ORDER:
    if slot in intended:
        aim(slot, intended[slot])
results['A_aim_only'] = joints_rms()

# B: скрутка из плоскости сгиба
reset()
for slot in ORDER:
    if slot not in intended:
        continue
    d = intended[slot]
    ref = None
    ch = CHILD.get(slot)
    if ch and ch in intended:
        cr = d.cross(intended[ch])
        if cr.length > 0.20:
            ref = cr.cross(d)
    if ref is None:
        ref = src_x(slot) or (a_t if abs(d.dot(a_t)) < 0.9 else u_t)
    orient(slot, d, ref)
results['B_hinge'] = joints_rms()

# C: скрутка из боковой оси источника для всех костей
reset()
for slot in ORDER:
    if slot not in intended:
        continue
    d = intended[slot]
    ref = src_x(slot) or (a_t if abs(d.dot(a_t)) < 0.9 else u_t)
    orient(slot, d, ref)
results['C_srcx'] = joints_rms()

# D: скрутка источника только на корпусе, конечности — по плоскости сгиба
reset()
TORSO = {'hips', 'spine', 'chest', 'upperChest', 'neck', 'head'}
for slot in ORDER:
    if slot not in intended:
        continue
    d = intended[slot]
    ref = None
    if slot in TORSO:
        ref = src_x(slot)
    else:
        ch = CHILD.get(slot)
        if ch and ch in intended:
            cr = d.cross(intended[ch])
            if cr.length > 0.20:
                ref = cr.cross(d)
        if ref is None:
            ref = src_x(slot)
    if ref is None:
        ref = a_t if abs(d.dot(d)) < 0.9 else u_t
    orient(slot, d, ref)
results['D_torso_srcx'] = joints_rms()

print('ROLL_AB', json.dumps(results))
