"""Анатомическая проверка: где на самом деле кисти и стопы в четырёх позах.

Берём тот же риг-гуманоид, что и раньше (anna_nude, VRM-скелет), кладём на
плоскость платформы (X — вдоль тела, Y — поперёк, Z — вверх) и меряем
координаты суставов в позах:
  A — руки вдоль туловища, ноги вместе
  B — руки за голову, ноги вместе
  C — руки в стороны, ноги вместе
  D — ноги в шпагате (разведение бёдер до упора, колени прямые)

Печатает требуемый вылет креплений и углы сегментов — по ним видно, где
конструкция обязана достать, а где заведомо не достанет.

Запуск: blender -b --factory-startup -noaudio --python tools/anatomy_check.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
CH = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/anna_nude.glb'

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
bpy.ops.import_scene.gltf(filepath=CH)
bpy.context.view_layer.update()

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
for o in [x for x in bpy.data.objects if x.type == 'MESH' and x not in meshes]:
    bpy.data.objects.remove(o, do_unlink=True)


def pts():
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in meshes:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        out += [mw @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    return out


p = pts()
h = max(q.z for q in p) - min(q.z for q in p)
arm.matrix_world = Matrix.Scale(1.75 / h, 4) @ arm.matrix_world      # рост 1.75
bpy.context.view_layer.update()

# на спину: головой к -X
face_y = None
def mean_of(name, axis):
    o = bpy.data.objects.get(name)
    if not o:
        return 0.0
    q = pts() if False else None
    dg = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(dg); me = ev.to_mesh(); mw = ev.matrix_world
    vals = [getattr(mw @ v.co, axis) for v in me.vertices]
    ev.to_mesh_clear()
    return sum(vals) / len(vals)

face_dir = 1 if mean_of('Face', 'y') > mean_of('Body', 'y') else -1
rot = Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Rotation(math.radians(90 * face_dir), 4, 'X')
arm.matrix_world = rot @ arm.matrix_world
bpy.context.view_layer.update()

p = pts()
z0 = min(q.z for q in p)
cx = (min(q.x for q in p) + max(q.x for q in p)) / 2
cy = (min(q.y for q in p) + max(q.y for q in p)) / 2
arm.matrix_world = Matrix.Translation(Vector((-cx, -cy, -z0))) @ arm.matrix_world
bpy.context.view_layer.update()
p = pts()
if mean_of('Face', 'z') < mean_of('Body', 'z'):
    c = Vector((0, 0, (min(q.z for q in p) + max(q.z for q in p)) / 2))
    arm.matrix_world = (Matrix.Translation(c) @ Matrix.Rotation(math.radians(180), 4, 'X')
                        @ Matrix.Translation(-c)) @ arm.matrix_world
    bpy.context.view_layer.update()

p = pts()
print('BODY x', round(min(q.x for q in p), 3), round(max(q.x for q in p), 3),
      'y', round(min(q.y for q in p), 3), round(max(q.y for q in p), 3),
      'z', round(min(q.z for q in p), 3), round(max(q.z for q in p), 3))


def j(name):
    pb = arm.pose.bones.get(name)
    return (arm.matrix_world @ pb.head) if pb else None


def reset():
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()


def set_rot(name, deg, axis=0):
    pb = arm.pose.bones.get(name)
    if not pb:
        return
    pb.rotation_mode = 'XYZ'
    e = [0.0, 0.0, 0.0]
    e[axis] = math.radians(deg)
    pb.rotation_euler = e
    bpy.context.view_layer.update()


def sweep_limb(prefix, target_axis, want, degs):
    """подбор угла и оси: добиваемся нужного направления конечности"""
    best = None
    for axis in range(3):
        for d in degs:
            for sign in (1, -1):
                reset()
                set_rot(prefix, d * sign, axis)
                w = j('J_Bip_L_Hand') if 'Arm' in prefix else j('J_Bip_L_Foot')
                if w is None:
                    continue
                val = getattr(w, target_axis)
                if best is None or abs(val - want) < abs(best[0] - want):
                    best = (val, axis, d * sign)
    reset()
    return best


def report(tag):
    names = ['J_Bip_L_Shoulder', 'J_Bip_L_Elbow', 'J_Bip_L_Hand',
             'J_Bip_L_UpperLeg', 'J_Bip_L_LowerLeg', 'J_Bip_L_Foot',
             'J_Bip_R_Shoulder', 'J_Bip_R_Elbow', 'J_Bip_R_Hand',
             'J_Bip_R_UpperLeg', 'J_Bip_R_LowerLeg', 'J_Bip_R_Foot']
    row = {}
    for n in names:
        v = j(n)
        row[n.replace('J_Bip_', '')] = None if v is None else [round(v.x, 3), round(v.y, 3), round(v.z, 3)]
    print('POSE', tag, row)
    return row


poses = {}

# A — руки вдоль туловища: плечо вниз-внутрь, кисть у бедра
reset()
best = None
for axis in range(3):
    for d in (40, 50, 60, 70, 80, 90, -40, -50, -60, -70, -80, -90):
        for sign in (1,):
            reset()
            set_rot('J_Bip_L_UpperArm', d, axis)
            set_rot('J_Bip_R_UpperArm', -d, axis)
            wl, wr = j('J_Bip_L_Hand'), j('J_Bip_R_Hand')
            if not wl or not wr:
                continue
            score = abs(wl.y - 0.22) + abs(wr.y + 0.22) + abs(wl.x - 0.05)
            if best is None or score < best[0]:
                best = (score, axis, d)
reset()
set_rot('J_Bip_L_UpperArm', best[2], best[1])
set_rot('J_Bip_R_UpperArm', -best[2], best[1])
poses['A_arms_along'] = report('A_arms_along')

# B — руки за голову
reset()
set_rot('J_Bip_L_UpperArm', 150, 2)
set_rot('J_Bip_R_UpperArm', -150, 2)
poses['B_arms_up'] = report('B_arms_up')

# C — руки в стороны
reset()
set_rot('J_Bip_L_UpperArm', 60, 0)
set_rot('J_Bip_R_UpperArm', -60, 0)
poses['C_arms_out'] = report('C_arms_out')

# D — ноги в шпагате: разведение бёдер, колени прямые
reset()
bestD = None
for axis in range(3):
    for d in (20, 30, 40, 50, 60, 70, 80, 90, -20, -30, -40, -50, -60, -70, -80, -90):
        reset()
        set_rot('J_Bip_L_UpperLeg', d, axis)
        set_rot('J_Bip_R_UpperLeg', -d, axis)
        fl, fr = j('J_Bip_L_Foot'), j('J_Bip_R_Foot')
        if not fl or not fr:
            continue
        spread = abs(fl.y) + abs(fr.y)
        flat = abs(fl.z) + abs(fr.z)
        score = -spread + flat * 0.5
        if bestD is None or score < bestD[0]:
            bestD = (score, axis, d, spread, flat)
reset()
set_rot('J_Bip_L_UpperLeg', bestD[2], bestD[1])
set_rot('J_Bip_R_UpperLeg', -bestD[2], bestD[1])
print('SPLIT best axis', bestD[1], 'deg', bestD[2], 'spread', round(bestD[3], 3),
      'z_off', round(bestD[4], 3))
poses['D_split'] = report('D_split')

# --- сводка требуемых вылетов ------------------------------------------------
def g(tag, name, comp):
    v = poses[tag].get(name)
    return None if v is None else v[{'x': 0, 'y': 1, 'z': 2}[comp]]

print('--- ТРЕБУЕМЫЙ ВЫЛЕТ КРЕПЛЕНИЙ (в осях платформы) ---')
for tag in poses:
    print(tag,
          'кисть Y', g(tag, 'L_Hand', 'y'), 'X', g(tag, 'L_Hand', 'x'),
          '| стопа Y', g(tag, 'L_Foot', 'y'), 'X', g(tag, 'L_Foot', 'x'))

# --- картинки ---------------------------------------------------------------
for name, vec, energy in (('key', (0.4, 0.7, -0.6), 3.0), ('fill', (-0.5, -0.6, -0.3), 1.1)):
    d = bpy.data.lights.new(name, 'SUN')
    d.energy = energy
    o = bpy.data.objects.new(name, d)
    o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(o)
w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.62, 0.64, 0.67, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8

# плоскость платформы для масштаба
bpy.ops.mesh.primitive_plane_add(size=2.6, location=(0, 0, -0.002))
floor = bpy.context.object
m = bpy.data.materials.new('plat')
m.use_nodes = True
m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.55, 0.57, 0.60, 1)
floor.data.materials.append(m)

cd = bpy.data.cameras.new('cam')
cd.type = 'ORTHO'
cd.ortho_scale = 2.4
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
sc.camera = cam
cam.location = (0.0, 0.0, 4.0)
cam.rotation_euler = (0, 0, 0)

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1200, 1200
sc.eevee.taa_render_samples = 16
sc.view_settings.view_transform = 'AgX'

# сохраняем позу D и рендерим
sc.render.filepath = os.path.join(OUT, 'anat_split_top.png')
bpy.ops.render.render(write_still=True)
print('SHOT anat_split_top.png')

reset()
set_rot('J_Bip_L_UpperArm', best[2], best[1])
set_rot('J_Bip_R_UpperArm', -best[2], best[1])
sc.render.filepath = os.path.join(OUT, 'anat_arms_along_top.png')
bpy.ops.render.render(write_still=True)
print('SHOT anat_arms_along_top.png')
print('ANATOMY_DONE')
