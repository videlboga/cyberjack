# Подготовка базовой модели к гуманоидной иерархии VRM — шаг 1: кость hips.
#
# Что делает: создаёт кость hips в тазу и переподчиняет ей ветви ног (c_root.x) и спины
# (spine_01_cns.x). Ничего не двигает: в Edit Mode координаты голов/хвостов сохраняются,
# hips не анимируется, поэтому позы и IK обязаны остаться теми же — и это проверяется
# числом, а не на глаз.
#
# Запуск:
#   blender -b base-rigged.blend --python prepare-humanoid.py -- base-rigged-humanoid.blend
import bpy, sys, json
from mathutils import Vector

_args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
out_path = _args[0] if _args else '/tmp/rig-probe.blend'
arm = bpy.data.objects['rig_E']
B = arm.data.bones


def capture():
    """Позы всех deform-костей и вершины тела — слепок для сверки до/после."""
    dg = bpy.context.evaluated_depsgraph_get()
    bpy.context.view_layer.update()
    mats = {}
    for pb in arm.pose.bones:
        if pb.bone.use_deform:
            m = pb.matrix
            mats[pb.name] = [round(v, 6) for row in m for v in row]
    # все меши, которые деформирует этот риг: один 'Body' ничего не доказывает
    verts = {}
    for o in bpy.data.objects:
        if o.type != 'MESH':
            continue
        if not any(md.type == 'ARMATURE' and md.object == arm for md in o.modifiers):
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        n = len(me.vertices)
        step = max(1, n // 400)
        verts[o.name] = [[round(c, 6) for c in me.vertices[i].co] for i in range(0, n, step)]
        ev.to_mesh_clear()
    return {'mats': mats, 'verts': verts}


def test_pose():
    """Поза, задевающая обе ветви: нога через IK, рука через IK, голова отдельно."""
    P = arm.pose.bones
    targets = [('foot_ik.l', Vector((0.02, -0.05, 0.12))), ('arm_ik.l', Vector((-0.10, 0.05, 0.05)))]
    applied = []
    for name, delta in targets:
        pb = P.get(name)
        if pb:
            pb.location = pb.location + delta
            applied.append(name)
    hb = P.get('c_head.x')
    if hb:
        hb.rotation_mode = 'XYZ'
        hb.rotation_euler = (0.12, 0.0, 0.06)
        applied.append('c_head.x')
    bpy.context.view_layer.update()
    return applied


def reset():
    for pb in arm.pose.bones:
        pb.location = (0.0, 0.0, 0.0)
        pb.rotation_quaternion = (1, 0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
        pb.scale = (1, 1, 1)
    bpy.context.view_layer.update()


reset()
applied = test_pose()
before = capture()
print('POSE_APPLIED', applied)

# ---- сама правка
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
eb = arm.data.edit_bones

if 'hips' in eb:
    print('HIPS_EXISTS')
else:
    hip_l = eb['thigh.l'].head
    hip_r = eb['thigh.r'].head
    centre = (hip_l + hip_r) / 2.0
    spine_head = eb['spine_01.x'].head
    hips = eb.new('hips')
    hips.head = Vector((0.0, centre.y, centre.z))
    hips.tail = Vector((0.0, centre.y, spine_head.z))
    hips.use_deform = False
    hips.parent = eb['c_root_master.x']
    hips.use_connect = False
    print('HIPS_CREATED', [round(v, 4) for v in hips.head], [round(v, 4) for v in hips.tail])

MODE = (sys.argv[sys.argv.index('--') + 2] if sys.argv.index('--') + 2 < len(sys.argv) else 'full') if '--' in sys.argv else 'full'
REPARENT = {'none': [], 'hips': [], 'full2': ['c_root.x', 'spine_01_cns.x'], 'legs': ['c_root.x'], 'spine': ['spine_01_cns.x'],
            'full': ['c_root.x', 'spine_01_cns.x']}.get(MODE, [])
print('MODE', MODE, REPARENT)
# вторая пара: их мировое положение задано ограничениями (COPY_LOCATION / STRETCH_TO / CHILD_OF),
# поэтому переподчинение не меняет позу, но делает цепочку гуманоидной
EXTRA = {'full': [('forearm.l', 'arm.l'), ('forearm.r', 'arm.r'), ('head_scale_fix.x', 'c_neck.x')],
         'full2': [('forearm.l', 'arm.l'), ('forearm.r', 'arm.r'), ('head_scale_fix.x', 'c_neck.x')]}.get(MODE, [])

for child in REPARENT:
    b = eb.get(child)
    if b and b.parent and b.parent.name != 'hips':
        b.parent = eb['hips']
        print('REPARENT', child, '-> hips')

for child, new_parent in EXTRA:
    b = eb.get(child)
    if b and new_parent in eb and (not b.parent or b.parent.name != new_parent):
        b.parent = eb[new_parent]
        print('REPARENT', child, '->', new_parent)

bpy.ops.object.mode_set(mode='OBJECT')
bpy.context.view_layer.update()

reset()
test_pose()
after = capture()

# ---- сверка
diffs = []
for name, m in before['mats'].items():
    m2 = after['mats'].get(name)
    if m2 is None:
        continue
    diffs.append((max(abs(a - b) for a, b in zip(m, m2)), name))
diffs.sort(reverse=True)
diff_mat = diffs[0][0] if diffs else 0.0
print('TOP_BONE_DIFFS', [(round(d, 6), n) for d, n in diffs[:6]])
diff_vert, worst_mesh = 0.0, None
for name, v in before['verts'].items():
    v2 = after['verts'].get(name)
    if not v2 or len(v) != len(v2):
        print('MESH_MISMATCH', name)
        continue
    d = max((max(abs(x - y) for x, y in zip(a, b)) for a, b in zip(v, v2)), default=0.0)
    if d > diff_vert:
        diff_vert, worst_mesh = d, name
print('CHECK bones', len(before['mats']), 'max_matrix_diff', round(diff_mat, 8), 'worst', diffs[0][1] if diffs else None)
print('CHECK meshes', len(before['verts']), 'max_vertex_diff', round(diff_vert, 8), 'worst', worst_mesh)

# гуманоидная связность: сколько deform-костей теперь под hips
B = arm.data.bones


def under_hips(name):
    b = B.get(name)
    chain = []
    while b:
        chain.append(b.name)
        b = b.parent
    return 'hips' in chain


cands = ['spine_01.x', 'spine_04.x', 'neck.x', 'head.x', 'arm.l', 'forearm.l', 'hand.l',
         'thigh.l', 'leg.l', 'foot.l', 'toes_01.l']
print('UNDER_HIPS', {c: under_hips(c) for c in cands})

bpy.ops.wm.save_as_mainfile(filepath=out_path)
print('SAVED', out_path)
print('PREPARE_OK' if diff_mat < 1e-4 and diff_vert < 1e-4 else 'PREPARE_DIFFERS')
