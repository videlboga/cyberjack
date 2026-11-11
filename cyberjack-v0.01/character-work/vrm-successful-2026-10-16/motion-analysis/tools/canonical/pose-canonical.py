# Поза из канонического (T) пространства на нашу модель.
#
# Идея: клип Koikatsu записан относительно T-позы. Значит и переносить надо относительно T:
#   D  = локальный поворот источника относительно его T  (он же LQ из кадра)
#   M  = T_rest_цели⁻¹ · T_rest_источника   — рамка в рамку
#   R  = T_rest_цели · (M · D · M⁻¹)        — нужный мировой поворот кости цели
# Дальше из мирового поворота получаем matrix_basis приёмом «обнулить, прочитать, домножить».
#
#   blender -b hum.blend --python pose-canonical.py -- frame.json t-rest.json out.blend
import bpy, sys, json, math
from mathutils import Matrix, Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
frame_path, trest_path, out_path = argv[0], argv[1], argv[2]
data = json.load(open(frame_path))
TREST = {n: Quaternion((v[3], v[0], v[1], v[2])) for n, v in json.load(open(trest_path)).items()}
WQR = {n: Quaternion((v[3], v[0], v[1], v[2])) for n, v in (data.get('restWorldQ') or {}).items()}
LQ = {n: Quaternion((v[3], v[0], v[1], v[2])) for n, v in (data.get('localQ') or {}).items()}

SLOTS = {
    'hips': 'cf_j_hips', 'spine': 'cf_j_spine01', 'chest': 'cf_j_spine02',
    'upperChest': 'cf_j_spine03', 'neck': 'cf_j_neck', 'head': 'cf_j_head',
    'leftUpperArm': 'cf_j_arm00_L', 'leftLowerArm': 'cf_j_forearm01_L', 'leftHand': 'cf_j_hand_L',
    'rightUpperArm': 'cf_j_arm00_R', 'rightLowerArm': 'cf_j_forearm01_R', 'rightHand': 'cf_j_hand_R',
    'leftUpperLeg': 'cf_j_thigh00_L', 'leftLowerLeg': 'cf_j_leg01_L', 'leftFoot': 'cf_j_foot_L',
    'leftToes': 'cf_j_toes_L',
    'rightUpperLeg': 'cf_j_thigh00_R', 'rightLowerLeg': 'cf_j_leg01_R', 'rightFoot': 'cf_j_foot_R',
    'rightToes': 'cf_j_toes_R',
}
for side, cap in (('left', 'L'), ('right', 'R')):
    for f, src in (('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Little', 'little')):
        for k, suf in ((1, 'Proximal'), (2, 'Intermediate'), (3, 'Distal')):
            SLOTS[f'{side}{f}{suf}'] = f'cf_j_{src}{k:02d}_{cap}'
    for k, suf in ((1, 'Metacarpal'), (2, 'Proximal'), (3, 'Distal')):
        SLOTS[f'{side}Thumb{suf}'] = f'cf_j_thumb{k:02d}_{cap}'

arm = bpy.data.objects['rig_H']
P = arm.pose.bones
B = arm.data.bones
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='POSE')

done = 0
miss = []
for slot, joint in SLOTS.items():
    if slot not in P or joint not in LQ or joint not in WQR or slot not in TREST:
        miss.append(slot)
        continue
    pb = P[slot]
    pb.matrix_basis = Matrix.Identity(4)
    bpy.context.view_layer.update()
    base = pb.matrix.copy()
    M = TREST[slot].inverted() @ WQR[joint]
    D = LQ[joint]
    want = TREST[slot] @ (M @ D @ M.inverted())
    delta = base.to_quaternion().inverted() @ want
    pb.matrix_basis = delta.to_matrix().to_4x4()
    bpy.context.view_layer.update()
    done += 1
print('APPLIED', done, 'MISS', len(miss), miss[:4])
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=out_path)
print('SAVED', out_path)
print('CANON_OK')
