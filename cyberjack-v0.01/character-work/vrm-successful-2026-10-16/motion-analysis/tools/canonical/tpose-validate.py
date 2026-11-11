# T-поза и валидация VRM — с UI-контекстом (через xvfb-run), потому что в `blender -b`
# операторы аддона VRM возвращают CANCELLED.
#
# Что делает по шагам:
#   1) пробует штатный оператор аддона;
#   2) если он не сработал на этом риге (deform-кости у нас ведомые ограничениями, а оператор
#      крутит сами кости), ставит T-позу через IK-контроли и проверяет угол числами;
#   3) запекает позу в rest;
#   4) гоняет model_validate и печатает сообщения.
#
#   xvfb-run -a blender base-rigged-humanoid.blend --python tpose-validate.py -- out.blend
import bpy, sys, math
from mathutils import Vector

out_path = sys.argv[sys.argv.index('--') + 1]
arm = bpy.data.objects['rig_E']
B = arm.data.bones


def arm_angle():
    v = B['hand.l'].head_local - B['arm.l'].head_local
    return round(math.degrees(math.atan2(-v.z, abs(v.x))), 2)


def posed_angle():
    """Угол в текущей позе (с учётом ограничений), а не в rest."""
    bpy.context.view_layer.update()
    a = arm.pose.bones['arm.l'].head
    h = arm.pose.bones['hand.l'].head
    v = h - a
    return round(math.degrees(math.atan2(-v.z, abs(v.x))), 2)


print('REST_ANGLE', arm_angle(), 'POSED_ANGLE', posed_angle())

bpy.context.view_layer.objects.active = arm
for o in bpy.context.selected_objects:
    o.select_set(False)
arm.select_set(True)

res = {}
for op in ('apply_humanoid_t_pose', 'make_estimated_humanoid_t_pose'):
    f = getattr(bpy.ops.vrm, op, None)
    if not f:
        continue
    try:
        res[op] = str(f())
    except Exception as e:
        res[op] = f'{type(e).__name__}: {str(e)[:120]}'
print('ADDON_OPS', res)
print('ANGLE_AFTER_ADDON', posed_angle())

# --- своя установка T-позы через IK-контроли (если аддон не справился)
if abs(posed_angle()) > 8.0:
    P = arm.pose.bones
    for side in ('l', 'r'):
        ik = P.get(f'arm_ik.{side}') or P.get(f'c_arm_ik.{side}')
        if not ik:
            print('NO_IK', side)
            continue
        # цель IK — вытянуть руку горизонтально в сторону
        sh = P[f'arm.{side}'].head
        reach = (B[f'forearm.{side}'].head_local - B[f'arm.{side}'].head_local).length + \
                (B[f'hand.{side}'].head_local - B[f'forearm.{side}'].head_local).length
        sign = 1.0 if side == 'l' else -1.0
        target = sh + Vector((sign * reach, 0.0, 0.0))
        ik.location = target
        print('IK_SET', side, [round(v, 3) for v in target])
    bpy.context.view_layer.update()
    print('ANGLE_AFTER_IK', posed_angle())

bpy.ops.object.mode_set(mode='POSE')
bpy.ops.pose.select_all(action='SELECT')
bpy.ops.pose.armature_apply(selected=False)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()
print('REST_ANGLE_BAKED', arm_angle())

try:
    v = bpy.ops.vrm.model_validate()
    print('VALIDATE', v)
except Exception as e:
    print('VALIDATE_ERR', f'{type(e).__name__}: {str(e)[:160]}')

bpy.ops.wm.save_as_mainfile(filepath=out_path)
print('SAVED', out_path)
print('TPOSE_OK' if abs(arm_angle()) < 8.0 else 'TPOSE_FAILED')
bpy.ops.wm.quit_blender()
