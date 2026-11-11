# Поза кадра на чистом гуманоидном риге (rig_H): только повороты костей.
#
# Никаких IK-целей, полюсов и переключений контролов: у rig_H все веса на гуманоидных костях,
# поэтому кость ставится напрямую по направлению из источника.
#
#   blender -b hum.blend --python pose-humanoid.py -- frame.json out.blend
import bpy, sys, json, math, os
from mathutils import Matrix, Vector, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
frame_path, out_path = argv[0], argv[1]
data = json.load(open(frame_path))
src = {n: Vector(v) for n, v in zip(data['names'], data['frame'])}
extra = {n: Vector(v) for n, v in (data.get('extraPos') or {}).items()}
WQ = {n: Quaternion((v[3], v[0], v[1], v[2])) for n, v in (data.get('worldQ') or {}).items()}
WQR = {n: Quaternion((v[3], v[0], v[1], v[2])) for n, v in (data.get('restWorldQ') or {}).items()}
LQ = {n: Quaternion((v[3], v[0], v[1], v[2])) for n, v in (data.get('localQ') or {}).items()}
# отражение по X инвертирует знак вращения: у источника правая система повёрнута зеркально
FLIP = None
arm = bpy.data.objects['rig_H']
P = arm.pose.bones
B = arm.data.bones

# --- конвенция (та же, что отлажена): сторона по стопам, глубина y=-sz
src_L, src_R = src['cf_j_foot_L'].x, src['cf_j_foot_R'].x
tgt_L, tgt_R = B['leftFoot'].head_local.x, B['rightFoot'].head_local.x
flip = (src_L < src_R) != (tgt_L < tgt_R)
conv = (lambda p: Vector((-p.x, -p.z, p.y))) if flip else (lambda p: Vector((p.x, -p.z, p.y)))
S = {n: conv(p) for n, p in src.items()}
S.update({n: conv(p) for n, p in extra.items()})
# Кадр источника нормирован так, что разброс суставов = 1.0. Значит масштаб — это разброс
# суставов ЦЕЛИ, константа. Брать масштаб из позы нельзя: в согнутой позе «таз->стопа» короче
# и множитель уезжает (сидя выходило 4.25 вместо 1.2).
_tgt_pts = [B[n].head_local for n in ('hips', 'head', 'leftFoot', 'rightFoot', 'leftHand', 'rightHand', 'leftToes')]
scale = max(max(p[i] for p in _tgt_pts) - min(p[i] for p in _tgt_pts) for i in range(3))
shift = B['hips'].head_local - S['cf_j_hips'] * scale
for n in S:
    S[n] = S[n] * scale + shift
FLIP = flip
print('CONV', 'flipX' if flip else 'asis', 'scale', round(scale, 3))

bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='POSE')
bpy.context.view_layer.update()


def aim(slot, target_dir):
    """matrix_basis живёт в ЛОКАЛЬНОЙ рамке кости: записывать туда мировой поворот нельзя
    (ноги уезжали в ленты). Приём: обнулить базис, прочитать «мир без нас», домножить на q."""
    pb = P[slot]
    if target_dir.length < 1e-6:
        return None
    # сначала обнуляем базис и ТОЛЬКО ПОТОМ снимаем текущее направление: иначе d0 и base
    # относятся к разным состояниям кости, и цепь накапливает изгиб (ноги шли «змейкой»)
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    d0 = (pb.tail - pb.head)
    if d0.length < 1e-6:
        return None
    q = d0.normalized().rotation_difference(target_dir.normalized())
    goal = Matrix.Translation(base.translation) @ (q.to_matrix() @ base.to_3x3()).to_4x4()
    pb.matrix_basis = base.inverted() @ goal
    bpy.context.view_layer.update()
    return round(math.degrees(q.angle), 1)


CHAINS = [
    (['hips', 'spine', 'chest', 'upperChest', 'neck', 'head'],
     ['cf_j_hips', 'cf_j_spine01', 'cf_j_spine02', 'cf_j_spine03', 'cf_j_neck', 'cf_j_head']),
    (['leftUpperArm', 'leftLowerArm', 'leftHand'],
     ['cf_j_arm00_L', 'cf_j_forearm01_L', 'cf_j_hand_L']),
    (['rightUpperArm', 'rightLowerArm', 'rightHand'],
     ['cf_j_arm00_R', 'cf_j_forearm01_R', 'cf_j_hand_R']),
    (['leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes'],
     ['cf_j_thigh00_L', 'cf_j_leg01_L', 'cf_j_foot_L', 'cf_j_toes_L']),
    (['rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes'],
     ['cf_j_thigh00_R', 'cf_j_leg01_R', 'cf_j_foot_R', 'cf_j_toes_R']),
]

report = {}
for slots, joints in CHAINS:
    for i, slot in enumerate(slots):
        if i + 1 < len(joints):
            d = S[joints[i + 1]] - S[joints[i]]
        else:
            # последняя кость цепи: продолжаем предыдущим направлением
            d = S[joints[-1]] - S[joints[-2]]
        a = aim(slot, d)
        if a is not None:
            report[slot] = a
print('AIMED', report)

# --- скрутка кисти из мировых кватернионов источника
# Плоскость ладони по пальцам нестабильна (большой и средний почти совпадают), поэтому берём
# поворот кисти источника целиком и переносим ТОЛЬКО его часть вокруг оси кости.
def src_q(name):
    return WQ.get(name)

for side, cap in (('left', 'L'), ('right', 'R')):
    if f'cf_j_index01_{cap}' in S:
        d = S[f'cf_j_index01_{cap}'] - S[f'cf_j_hand_{cap}']
        a = aim(f'{side}Hand', d)
        roll = None
        hj = f'cf_j_hand_{cap}'
        if hj in WQ and hj in WQR:
            hb = P[f'{side}Hand']
            # C: рамка rest источника -> рамка rest цели
            C = B[f'{side}Hand'].matrix_local.to_quaternion() @ WQR[hj].inverted()
            desired = C @ WQ[hj]
            if FLIP:
                # зеркальный канал: у отражённого поворота меняется знак векторной части по X
                desired = Quaternion((desired.w, -desired.x, desired.y, desired.z))
            cur = hb.matrix.to_quaternion()
            delta = cur.inverted() @ desired
            axis = (hb.tail - hb.head).normalized()
            v = Vector((delta.x, delta.y, delta.z))
            proj = axis * v.dot(axis)
            tw = Quaternion((delta.w, proj.x, proj.y, proj.z))
            if tw.magnitude > 1e-6:
                tw.normalize()
                angle = 2.0 * math.atan2(Vector((tw.x, tw.y, tw.z)).length, tw.w)
                if angle > math.pi:
                    angle -= 2 * math.pi
                al = hb.matrix.to_quaternion().inverted() @ axis
                hb.matrix_basis = (hb.matrix_basis.to_quaternion()
                                   @ Quaternion(al, angle)).to_matrix().to_4x4()
                bpy.context.view_layer.update()
                roll = round(math.degrees(angle), 1)
        print('HAND', side, a, 'roll_q', roll)

def transfer_local(slot, src_joint):
    """Сгиб пальца — локальная величина: переносим локальный поворот источника,
    пересчитанный в рамку цели (M · q · M⁻¹). Наведение по направлениям здесь не работает:
    фаланги короткие, и мировые направления укладывают их в одну плоскость («лопата»)."""
    q = LQ.get(src_joint)
    if q is None or slot not in P or src_joint not in WQR:
        return None
    M = B[slot].matrix_local.to_quaternion().inverted() @ WQR[src_joint]
    pb = P[slot]
    pb.matrix_basis = (M @ q @ M.inverted()).to_matrix().to_4x4()
    bpy.context.view_layer.update()
    return round(math.degrees(q.angle), 1)


# --- пальцы: 3 сегмента на палец, направления из источника (по фалангам)
FINGERS_ENABLED = os.environ.get('FINGERS', 'on') == 'on'
FINGERS = [('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Little', 'little')]
finger_report = {}
if not FINGERS_ENABLED:
    print('FINGERS_SKIPPED')
    FINGERS = []
for side, cap in ((('left', 'L'), ('right', 'R')) if FINGERS_ENABLED else ()):
    for slot_name, src_name in FINGERS:
        for k, slot_suffix in ((1, 'Proximal'), (2, 'Intermediate'), (3, 'Distal')):
            j0 = f'cf_j_{src_name}{k:02d}_{cap}'
            j1 = f'cf_j_{src_name}{k+1:02d}_{cap}'
            slot = f'{side}{slot_name}{slot_suffix}'
            a = transfer_local(slot, j0)
            if a is not None:
                finger_report[slot] = a
    for k, slot_suffix in (((1, 'Metacarpal'), (2, 'Proximal'), (3, 'Distal')) if FINGERS_ENABLED else ()):
        j0 = f'cf_j_thumb{k:02d}_{cap}'
        j1 = f'cf_j_thumb{k+1:02d}_{cap}'
        slot = f'{side}Thumb{slot_suffix}'
        a = transfer_local(slot, j0)
        if a is not None:
            finger_report[slot] = a
print('FINGERS_AIMED', len(finger_report), 'из 24')

bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=out_path)
print('SAVED', out_path)
print('POSE_HUMANOID_OK')
