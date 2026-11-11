# Применение позы POSE1 + сверка положений суставов с источником.
#
# Поза задаётся направлениями (d) и боковыми осями (x, xrest). Скрутка не переносится
# кватернионом: у источника rest — T, у цели — A, и перенос поворота даёт ошибку, зависящую от
# позы. Вместо этого ось сгиба берётся из плоскости «кость + её продолжение».
#
#   blender -b rig.blend --python apply-pose2.py -- pose.json out.blend [frame.json]
import bpy, sys, json, math
from mathutils import Vector, Quaternion, Matrix

argv = sys.argv[sys.argv.index('--') + 1:]
pose_path, out_path = argv[0], argv[1]
frame_path = argv[2] if len(argv) > 2 else None
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


def hd(n):
    return B[n].head_local.copy()


a_t = (hd('leftUpperLeg') - hd('rightUpperLeg')).normalized()
fraw = B['leftToes'].tail_local - hd('leftFoot')
f_t = (fraw - a_t * fraw.dot(a_t)).normalized()
uraw = hd('head') - hd('hips')
u_t = (uraw - a_t * uraw.dot(a_t))
u_t = (u_t - f_t * u_t.dot(f_t)).normalized()


def char_to_world(d):
    return (a_t * d[0] + f_t * d[1] + u_t * d[2]).normalized()


def orient(slot, d_world, roll_ref):
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
    x1 = roll_ref - y1 * roll_ref.dot(y1)
    if x1.length < 1e-6:
        x1 = x0 - y1 * x0.dot(y1)
    x1.normalize()
    z1 = x1.cross(y1).normalized()
    R1 = Matrix(((x1.x, y1.x, z1.x), (x1.y, y1.y, z1.y), (x1.z, y1.z, z1.z)))
    q = (R1 @ R0.transposed()).to_quaternion()
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ B3).to_4x4()
    pb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()
    return round(math.degrees(q.angle), 1)


ORDER = ['hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
         'leftUpperArm', 'leftLowerArm', 'leftHand',
         'rightUpperArm', 'rightLowerArm', 'rightHand',
         'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
         'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes']
CHILD = {'hips': 'spine', 'spine': 'chest', 'chest': 'upperChest', 'upperChest': 'neck',
         'neck': 'head', 'head': None,
         'leftUpperArm': 'leftLowerArm', 'leftLowerArm': 'leftHand', 'leftHand': None,
         'rightUpperArm': 'rightLowerArm', 'rightLowerArm': 'rightHand', 'rightHand': None,
         'leftUpperLeg': 'leftLowerLeg', 'leftLowerLeg': 'leftFoot', 'leftFoot': 'leftToes', 'leftToes': None,
         'rightUpperLeg': 'rightLowerLeg', 'rightLowerLeg': 'rightFoot', 'rightFoot': 'rightToes', 'rightToes': None}

intended = {}
for slot in ORDER:
    s = SL.get(slot)
    if s:
        intended[slot] = char_to_world(s['d'])

report = {}
for slot in ORDER:
    s_ = SL.get(slot)
    if not s_:
        continue
    d = intended[slot]
    # скрутка = боковая ось ИСТОЧНИКА (x), со сверкой знака по rest-оси цели.
    # Ось сгиба давала свои 70-110° расхождения: кожу вокруг конечности закручивало.
    if 'x' in s_:
        ref = char_to_world(s_['x'])
        if s_.get('xrest'):
            bx = B[slot].matrix_local.to_3x3()
            rx = Vector((bx[0][0], bx[1][0], bx[2][0]))
            if char_to_world(s_['xrest']).dot(rx) < 0:
                ref = -ref
    else:
        ref = a_t if abs(d.dot(a_t)) < 0.9 else u_t
    report[slot] = orient(slot, d, ref)
print('AIMED', report)

worst = 0.0
for slot in ORDER:
    if slot in intended:
        pb = P[slot]
        worst = max(worst, math.degrees((pb.tail - pb.head).normalized().angle(intended[slot])))
print('AIM_SELFCHECK_MAX_DEG', round(worst, 2))

# --- сверка скрутки: X кости против боковой оси источника
roll_err = {}
for slot in ORDER:
    sr = SL.get(slot, {})
    if 'x' not in sr:
        continue
    pb = P[slot]
    B3 = pb.matrix.to_3x3()
    x_bone = Vector((B3[0][0], B3[1][0], B3[2][0])).normalized()
    d_now = (pb.tail - pb.head).normalized()
    x_src = char_to_world(sr['x'])
    if sr.get('xrest'):
        bx = B[slot].matrix_local.to_3x3()
        rx = Vector((bx[0][0], bx[1][0], bx[2][0]))
        if char_to_world(sr['xrest']).dot(rx) < 0:
            x_src = -x_src
    x_src = (x_src - d_now * x_src.dot(d_now)).normalized()
    x_bone = (x_bone - d_now * x_bone.dot(d_now)).normalized()
    roll_err[slot] = round(math.degrees(x_bone.angle(x_src)), 1)
print('ROLL_ERR', roll_err)

if frame_path:
    fd = json.load(open(frame_path))
    src = {n: Vector(v) for n, v in zip(fd['names'], fd['frame'])}
    H = fd['height']
    PAIRS = [('cf_j_hips', 'hips'), ('cf_j_spine01', 'spine'), ('cf_j_spine02', 'chest'),
             ('cf_j_spine03', 'upperChest'), ('cf_j_neck', 'neck'), ('cf_j_head', 'head'),
             ('cf_j_arm00_L', 'leftUpperArm'), ('cf_j_forearm01_L', 'leftLowerArm'), ('cf_j_hand_L', 'leftHand'),
             ('cf_j_arm00_R', 'rightUpperArm'), ('cf_j_forearm01_R', 'rightLowerArm'), ('cf_j_hand_R', 'rightHand'),
             ('cf_j_thigh00_L', 'leftUpperLeg'), ('cf_j_leg01_L', 'leftLowerLeg'), ('cf_j_foot_L', 'leftFoot'),
             ('cf_j_thigh00_R', 'rightUpperLeg'), ('cf_j_leg01_R', 'rightLowerLeg'), ('cf_j_foot_R', 'rightFoot')]
    srcP, tgtP = [], []
    for js, slot in PAIRS:
        if js in src and slot in P:
            v = src[js]
            srcP.append(Vector((v[0] * H, v[1] * H, v[2] * H)))
            tgtP.append(arm.matrix_world @ P[slot].head)
    n = len(srcP)
    cs = sum(srcP, Vector()) / n
    ct = sum(tgtP, Vector()) / n
    num = sum((p - cs).length_squared for p in srcP)
    den = sum((q - ct).length_squared for q in tgtP)
    scale = math.sqrt(num / den) if den > 0 else 1.0
    json.dump({'src': [[p.x, p.y, p.z] for p in srcP], 'tgt': [[q.x, q.y, q.z] for q in tgtP]},
              open('/tmp/joints.json', 'w'))
    print('JOINTS_DUMPED', n)

bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=out_path, check_existing=False, compress=False, relative_remap=False)
print('SAVED', out_path)
print('APPLY_POSE1_OK')
