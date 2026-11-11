# T-поза для rig_E: ставится поиском по управлениям, а не «руками оператора».
#
# Deform-кости этого рига ведомые ограничениями (COPY_ROTATION от IK/FK-контролов), поэтому
# крутить сами кости бесполезно — ограничение перезапишет. Штатные операторы аддона VRM
# и в headless, и под xvfb возвращают CANCELLED.
#
#   blender -b base-rigged-humanoid.blend --python tpose.py -- out.blend
import bpy, sys, math
from mathutils import Matrix, Vector

out_path = sys.argv[sys.argv.index('--') + 1]
arm = bpy.data.objects['rig_E']
B = arm.data.bones
P = arm.pose.bones


def angle():
    bpy.context.view_layer.update()
    v = P['hand.l'].head - P['arm.l'].head
    return math.degrees(math.atan2(-v.z, abs(v.x)))


def apply(ctrl, axis, deg):
    pb = P[ctrl]
    M = pb.matrix.copy()
    pb.matrix = Matrix.Rotation(math.radians(deg), 4, axis) @ M
    bpy.context.view_layer.update()
    return M


def revert(ctrl, M):
    P[ctrl].matrix = M
    bpy.context.view_layer.update()


start = angle()
print('ANGLE_START', round(start, 2))

AXES = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)), 'Z': Vector((0, 0, 1))}
CONTROLS = [n for n in ('arm_ik.l', 'arm_fk.l', 'c_arm_ik.l', 'c_arm_fk.l') if n in P]

probes = []
for ctrl in CONTROLS:
    for axis_name, axis in AXES.items():
        for sign in (1.0, -1.0):
            M = apply(ctrl, axis, 10.0 * sign)
            a = angle()
            revert(ctrl, M)
            probes.append((abs(a), ctrl, axis_name, sign, a))
            print('PROBE', ctrl, axis_name, '+' if sign > 0 else '-', '->', round(a, 2))

probes.sort()
best = probes[0]
print('BEST', best[1], best[2], '+' if best[3] > 0 else '-', round(best[4], 2))

if best[0] < 8.0:
    ctrl, axis_name, sign = best[1], best[2], best[3]
    axis = AXES[axis_name]
    # доводим до нуля, уменьшая шаг; назад не откатываемся
    step = 10.0 * sign
    M = apply(ctrl, axis, step)
    prev = abs(angle())
    for _ in range(14):
        a = angle()
        if abs(a) < 1.0:
            break
        trial = max(-8.0, min(8.0, -a))
        Mtry = P[ctrl].matrix.copy()
        P[ctrl].matrix = Matrix.Rotation(math.radians(trial), 4, axis) @ Mtry
        bpy.context.view_layer.update()
        if abs(angle()) > prev:
            P[ctrl].matrix = Mtry
            bpy.context.view_layer.update()
            break
        prev = abs(angle())
    print('ANGLE_FINAL', round(angle(), 2))

ok = abs(angle()) < 8.0
if ok:
    dg = bpy.context.evaluated_depsgraph_get()
    body = next((o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith('Foot shape')),
                 None)
    sanity = None
    if body:
        ev = body.evaluated_get(dg)
        me = ev.to_mesh()
        sanity = max((round(v.co.length, 3) for v in me.vertices[::max(1, len(me.vertices) // 500)]), default=0)
        ev.to_mesh_clear()
    print('MESH_SANITY_MAX_RADIUS', sanity)

    bpy.ops.object.mode_set(mode='POSE')
    bpy.ops.pose.select_all(action='SELECT')
    bpy.ops.pose.armature_apply(selected=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    bpy.context.view_layer.update()
    v = B['hand.l'].head_local - B['arm.l'].head_local
    print('REST_ANGLE_BAKED', round(math.degrees(math.atan2(-v.z, abs(v.x))), 2))
    bpy.ops.wm.save_as_mainfile(filepath=out_path)
    print('SAVED', out_path)

print('TPOSE_OK' if ok else 'TPOSE_FAILED')
