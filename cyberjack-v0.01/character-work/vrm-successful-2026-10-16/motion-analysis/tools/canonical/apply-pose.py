# Применение позы формата POSE1 к нашей модели. Читает ТОЛЬКО файл позы.
#
# Направление берётся в характерной рамке и переводится в мир цели; скрутка выделяется из пары
# (q, qrest) источника и накладывается вокруг оси кости — тем же приёмом, что проверен на шести
# позах. Ни позиций, ни масштабов, ни IK: только 22 гуманоидные кости.
#
#   blender -b rig.blend --python apply-pose.py -- pose.json out.blend
import bpy, sys, json, math
from mathutils import Vector, Quaternion, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
pose_path, out_path = argv[0], argv[1]
pose = json.load(open(pose_path))
SL = pose['slots']

arm = bpy.data.objects['rig_H']
P = arm.pose.bones
B = arm.data.bones
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='POSE')
for pb in P:
    pb.matrix_basis = Matrix.Identity(4)
bpy.context.view_layer.update()

# --- характерная рамка цели по её же rest: a — влево, f — вперёд, u — вверх
def rest_head(n):
    return B[n].head_local.copy()

# те же три анатомические оси на REST-скелете цели
a_t = (rest_head('leftUpperLeg') - rest_head('rightUpperLeg')).normalized()
f_raw = B['leftToes'].tail_local - rest_head('leftFoot')
f_t = (f_raw - a_t * f_raw.dot(a_t)).normalized()
u_raw = rest_head('head') - rest_head('hips')
u_t = (u_raw - a_t * u_raw.dot(a_t))
u_t = (u_t - f_t * u_t.dot(f_t)).normalized()
print('TFORME a', [round(c, 3) for c in a_t], 'f', [round(c, 3) for c in f_t], 'u', [round(c, 3) for c in u_t])


def char_to_world(d):
    v = (a_t * d[0] + f_t * d[1] + u_t * d[2]).normalized()
    if BODY is None:
        return v
    return (BODY @ v).normalized()


# Ориентация тела из позы: два направления (вверх и в сторону) переносим как векторы и
# собираем из них поворот. Разная левосторонность систем тут не мешает.
BODY = None
if 'rootUp' in pose and 'rootLat' in pose:
    up_w = char_to_world(pose['rootUp'])
    lat_raw = char_to_world(pose['rootLat'])
    lat_w = (lat_raw - up_w * lat_raw.dot(up_w)).normalized()
    fwd_w = lat_w.cross(up_w).normalized()
    BODY = Matrix(((lat_w.x, fwd_w.x, up_w.x, 0),
                   (lat_w.y, fwd_w.y, up_w.y, 0),
                   (lat_w.z, fwd_w.z, up_w.z, 0),
                   (0, 0, 0, 1)))


def aim(slot, target_dir):
    pb = P[slot]
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    d0 = pb.tail - pb.head
    if d0.length < 1e-6:
        return None
    q = d0.normalized().rotation_difference(target_dir)
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ base.to_3x3()).to_4x4()
    pb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()
    return round(math.degrees(q.angle), 1)


ORDER = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
         'leftUpperArm', 'leftLowerArm', 'leftHand',
         'rightUpperArm', 'rightLowerArm', 'rightHand',
         'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
         'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes']

def orient(slot, d_world, x_world):
    """Ставит кость так, чтобы её Y смотрел в d, а X — в боковую ось позы.
    Наведение (aim) задаёт только направление; скрутка вокруг оси остаётся произвольной —
    именно из-за этого таз и грудная клетка «выворачивались». Здесь задаётся полная ориентация."""
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
    x1 = (x_world - y1 * x_world.dot(y1)).normalized()
    z1 = x1.cross(y1).normalized()
    R1 = Matrix(((x1.x, y1.x, z1.x), (x1.y, y1.y, z1.y), (x1.z, y1.z, z1.z)))
    q = (R1 @ R0.transposed()).to_quaternion()
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ B3).to_4x4()
    pb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()
    return round(math.degrees(q.angle), 1)


# --- перенос позы как ДЕФОРМАЦИИ, а не как поворота кости.
# Меш деформируется матрицей D = R · R_rest⁻¹. Переносим саму деформацию из рамки тела
# источника в рамку тела цели (M — поворот между ними, один для ВСЕХ костей):
#   D_src = R_src · R_rest_src⁻¹,   D_tgt = M · D_src · M⁻¹,   R_tgt = D_tgt · R_rest_tgt
# Всё строится из направлений и боковых осей позы — кватернионы не нужны.
def basis(xv, yv):
    y = yv.normalized()
    x = (xv - y * xv.dot(y))
    if x.length < 1e-6:
        x = Vector((1, 0, 0)) if abs(y.x) < 0.9 else Vector((0, 1, 0))
        x = (x - y * x.dot(y))
    x.normalize()
    z = x.cross(y).normalized()
    return Matrix(((x.x, y.x, z.x), (x.y, y.y, z.y), (x.z, y.z, z.z)))


M = None
if 'rootUp' in pose and 'rootLat' in pose:
    up_w = char_to_world(pose['rootUp'])
    lat_raw = char_to_world(pose['rootLat'])
    lat_w = (lat_raw - up_w * lat_raw.dot(up_w)).normalized()
    fwd_w = lat_w.cross(up_w).normalized()
    M = Matrix(((lat_w.x, up_w.x, fwd_w.x), (lat_w.y, up_w.y, fwd_w.y), (lat_w.z, up_w.z, fwd_w.z)))
print('M_DET', round(M.determinant(), 3) if M else None)

report = {}
for slot in ORDER:
    s = SL.get(slot)
    if not s or 'drest' not in s:
        continue
    pb = P[slot]
    d_cur = Vector(s['d'])
    d_rest = Vector(s['drest'])
    x_cur = Vector(s.get('x') or (1, 0, 0))
    x_rest = Vector(s.get('xrest') or (1, 0, 0))
    R_src = basis(x_cur, d_cur)
    R_src_rest = basis(x_rest, d_rest)
    D_src = R_src @ R_src_rest.inverted()
    D_tgt = M @ D_src @ M.inverted()
    R_tgt = D_tgt @ B[slot].matrix_local.to_3x3()
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    delta = base.to_quaternion().inverted() @ R_tgt.to_quaternion()
    pb.matrix_basis = delta.to_matrix().to_4x4()
    bpy.context.view_layer.update()
    report[slot] = 1
print('APPLIED', len(report))

worst = 0.0
for slot in ORDER:
    s = SL.get(slot)
    if not s:
        continue
    pb = P[slot]
    worst = max(worst, math.degrees((pb.tail - pb.head).normalized().angle(char_to_world(s['d']))))
print('AIM_SELFCHECK_MAX_DEG', round(worst, 2))

# --- скрутка: из пары (q, qrest) источника в рамку цели
def apply_roll(slot, q_src, q_rest_src):
    pb = P[slot]
    C = B[slot].matrix_local.to_quaternion() @ Quaternion(q_rest_src).inverted()
    desired = C @ Quaternion(q_src)
    cur = pb.matrix.to_quaternion()
    delta = cur.inverted() @ desired
    axis = (pb.tail - pb.head).normalized()
    v = Vector((delta.x, delta.y, delta.z))
    proj = axis * v.dot(axis)
    tw = Quaternion((delta.w, proj.x, proj.y, proj.z))
    if tw.magnitude < 1e-6:
        return 0.0
    tw.normalize()
    angle = 2.0 * math.atan2(Vector((tw.x, tw.y, tw.z)).length, tw.w)
    if angle > math.pi:
        angle -= 2 * math.pi
    local_axis = pb.matrix.to_quaternion().inverted() @ axis
    pb.matrix_basis = (pb.matrix_basis.to_quaternion() @ Quaternion(local_axis, angle)).to_matrix().to_4x4()
    bpy.context.view_layer.update()
    return round(math.degrees(angle), 1)


# Скрутку накладываем ТОЛЬКО на кисти. Для остальных костей она не читается глазом, а при
# разнице rest (T у источника, A у цели) даёт паразитный поворот и уводит направление на 40-60°.
ROLL_SLOTS = {'leftHand', 'rightHand'}
rolls = {}
for slot in ORDER:
    s = SL.get(slot)
    if slot not in ROLL_SLOTS or not s or 'q' not in s or 'qrest' not in s:
        continue
    rolls[slot] = apply_roll(slot, s['q'], s['qrest'])
print('ROLLS', rolls)

bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=out_path, check_existing=False, compress=False, relative_remap=False)
print('SAVED', out_path)
print('APPLY_POSE1_OK')
