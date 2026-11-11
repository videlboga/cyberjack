# Поза в гуманоидном формате: локальные повороты по слотам, применяются к нашей модели.
#
# Никаких позиций, масштабов и IK: только поворот каждой гуманоидной кости относительно её
# собственного rest, пересчитанный в рамку цели (M · q · M⁻¹). Именно так хранят позы
# ретаргетеры — тогда формат не зависит ни от Koikatsu, ни от rig_E, ни от пропорций.
#
#   blender -b hum.blend --python pose-humanoid-local.py -- frame.json out.blend
import bpy, sys, json, math
from mathutils import Quaternion

argv = sys.argv[sys.argv.index('--') + 1:]
frame_path, out_path = argv[0], argv[1]
data = json.load(open(frame_path))
WQR = {n: Quaternion((v[3], v[0], v[1], v[2])) for n, v in (data.get('restWorldQ') or {}).items()}
LQ = {n: Quaternion((v[3], v[0], v[1], v[2])) for n, v in (data.get('localQ') or {}).items()}

arm = bpy.data.objects['rig_H']
P = arm.pose.bones
B = arm.data.bones
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='POSE')

# слот гуманоида -> сустав источника
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
FINGERS = [('Index', 'index'), ('Middle', 'middle'), ('Ring', 'ring'), ('Little', 'little')]
for side, cap in (('left', 'L'), ('right', 'R')):
    for slot_name, src in FINGERS:
        for k, suf in ((1, 'Proximal'), (2, 'Intermediate'), (3, 'Distal')):
            SLOTS[f'{side}{slot_name}{suf}'] = f'cf_j_{src}{k:02d}_{cap}'
    for k, suf in ((1, 'Metacarpal'), (2, 'Proximal'), (3, 'Distal')):
        SLOTS[f'{side}Thumb{suf}'] = f'cf_j_thumb{k:02d}_{cap}'

applied = []
skipped = []
for slot, joint in SLOTS.items():
    if slot not in P or joint not in LQ or joint not in WQR:
        skipped.append(slot)
        continue
    M = B[slot].matrix_local.to_quaternion().inverted() @ WQR[joint]
    q = M @ LQ[joint] @ M.inverted()
    pb = P[slot]
    pb.rotation_mode = 'QUATERNION'
    pb.matrix_basis = q.to_matrix().to_4x4()
    applied.append((slot, round(math.degrees(q.angle), 1)))
bpy.context.view_layer.update()
print('APPLIED', len(applied), 'SKIPPED', len(skipped), skipped[:5])

bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.wm.save_as_mainfile(filepath=out_path)
print('SAVED', out_path)
print('LOCAL_OK')
