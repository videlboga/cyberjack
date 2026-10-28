"""ОМНИ-1: сборка машины v2 и проверка на живом теле.

Машина: основание → колонна → кардан (тангаж/крен ±90°) → платформа с прорезями,
периметральный рельс под платформой, четыре модуля (каретка → поворотная штанга
с телескопом → голова на двух осях → кольцо/люлька).

Проверка: тело ставится в четыре позы, для каждой крепления ВЫВОДЯТСЯ на замеренные
точки запястий и стоп (каретка — ближайшая точка рельса, рыскание — на цель,
телескоп — на расстояние). Печатается остаточная ошибка «кольцо ↔ сустав».

Запуск: blender -b --factory-startup -noaudio --python tools/omni_build.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
CH = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/anna_nude.glb'

# --- размеры (м) -------------------------------------------------------------
PLAT_L, PLAT_W, PLAT_T = 1.90, 0.64, 0.08
MAT_T = 0.05
PIVOT_Z = 1.02
RAIL_INSET = 0.07
SLOT_W = 0.09
ARM_SLOT = dict(y=0.200, x0=-0.85, x1=0.10)
LEG_SLOT = dict(y=0.085, x0=0.10, x1=0.80)

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene


def mat(name, color, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1)
    b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal
    return m


M_BODY = mat('m_body', (0.90, 0.91, 0.93), 0.4, 0.1)
M_DARK = mat('m_dark', (0.15, 0.16, 0.18), 0.5, 0.3)
M_MET = mat('m_met', (0.66, 0.68, 0.71), 0.25, 0.95)
M_ACC = mat('m_acc', (0.11, 0.55, 0.52), 0.4, 0.2)
M_PAD = mat('m_pad', (0.34, 0.35, 0.37), 0.85)


def parent_keep(o, p):
    """родитель без смещения: мировая матрица сохраняется"""
    o.parent = p
    o.matrix_parent_inverse = p.matrix_world.inverted()


def box(name, size, loc, material, parent=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(material)
    if parent:
        parent_keep(o, parent)
    return o


def cyl(name, r, h, loc, material, parent=None, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    o.data.materials.append(material)
    if parent:
        parent_keep(o, parent)
    return o


# --- станина ----------------------------------------------------------------
root = bpy.data.objects.new('OMNI_1', None)
sc.collection.objects.link(root)

box('base_plate', (1.40, 1.00, 0.12), (0, 0, 0.06), M_BODY, root)
for sx in (-1, 1):
    for sy in (-1, 1):
        cyl(f'foot_{sx}_{sy}', 0.05, 0.02, (sx * 0.58, sy * 0.40, 0.01), M_DARK, root, seg=12)
cyl('column_outer', 0.084, 0.60, (0, 0, 0.42), M_DARK, root, seg=28)
cyl('column_inner', 0.060, 0.34, (0, 0, 0.85), M_MET, root, seg=24)
cyl('column_collar', 0.095, 0.06, (0, 0, 0.72), M_BODY, root, seg=28)

# кардан: кольцо крена (ось X) + вилка тангажа (ось Y)
pitch = bpy.data.objects.new('pitch', None)
sc.collection.objects.link(pitch)
pitch.parent = root
pitch.location = (0, 0, PIVOT_Z)

roll = bpy.data.objects.new('roll', None)
sc.collection.objects.link(roll)
roll.parent = pitch
roll.location = (0, 0, 0)

cyl('gimbal_ring', 0.15, 0.05, (0, 0, PIVOT_Z), M_MET, None,
    rot=(0, math.radians(90), 0), seg=32)
for sy in (-1, 1):
    box(f'yoke_{sy}', (0.10, 0.05, 0.20), (0, sy * 0.13, PIVOT_Z), M_DARK)

# --- платформа с прорезями ---------------------------------------------------
def slab_with_slots(name, w, h, t, z, holes):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z))
    o = bpy.context.object
    o.name = name
    o.scale = (w, h, t)
    bpy.ops.object.transform_apply(location=True, scale=True)
    for hx, hy, hw, hh in holes:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(hx, hy, z))
        cut = bpy.context.object
        cut.scale = (hw, hh, t * 2)
        bpy.ops.object.transform_apply(location=True, scale=True)
        m = o.modifiers.new('cut', 'BOOLEAN')
        m.operation = 'DIFFERENCE'
        m.object = cut
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='cut')
        bpy.data.objects.remove(cut, do_unlink=True)
    return o


holes = [(0, ARM_SLOT['y'], ARM_SLOT['x1'] - ARM_SLOT['x0'], SLOT_W),
         (0, -ARM_SLOT['y'], ARM_SLOT['x1'] - ARM_SLOT['x0'], SLOT_W),
         (0, LEG_SLOT['y'], LEG_SLOT['x1'] - LEG_SLOT['x0'], SLOT_W),
         (0, -LEG_SLOT['y'], LEG_SLOT['x1'] - LEG_SLOT['x0'], SLOT_W)]
# сдвигаем прорези по X: у них свои центры
holes = [((ARM_SLOT['x0'] + ARM_SLOT['x1']) / 2, ARM_SLOT['y'],
          ARM_SLOT['x1'] - ARM_SLOT['x0'], SLOT_W),
         ((ARM_SLOT['x0'] + ARM_SLOT['x1']) / 2, -ARM_SLOT['y'],
          ARM_SLOT['x1'] - ARM_SLOT['x0'], SLOT_W),
         ((LEG_SLOT['x0'] + LEG_SLOT['x1']) / 2, LEG_SLOT['y'],
          LEG_SLOT['x1'] - LEG_SLOT['x0'], SLOT_W),
         ((LEG_SLOT['x0'] + LEG_SLOT['x1']) / 2, -LEG_SLOT['y'],
          LEG_SLOT['x1'] - LEG_SLOT['x0'], SLOT_W)]

plate = slab_with_slots('platform', PLAT_L, PLAT_W, PLAT_T, PIVOT_Z, holes)
plate.data.materials.append(M_BODY)
parent_keep(plate, roll)
parent_keep(box('mattress', (PLAT_L - 0.04, PLAT_W - 0.04, MAT_T),
                (0, 0, PIVOT_Z + PLAT_T / 2 + MAT_T / 2), M_PAD, roll), roll)

# периметральный рельс
rx = PLAT_L / 2 - RAIL_INSET - 0.03
ry = PLAT_W / 2 - RAIL_INSET - 0.03
rz = PIVOT_Z - PLAT_T / 2 - 0.045
for nm, size, loc in (
        ('rail_long_p', (2 * rx, 0.06, 0.03), (0, ry, rz)),
        ('rail_long_m', (2 * rx, 0.06, 0.03), (0, -ry, rz)),
        ('rail_short_p', (0.06, 2 * ry, 0.03), (rx, 0, rz)),
        ('rail_short_m', (0.06, 2 * ry, 0.03), (-rx, 0, rz))):
    box(nm, size, loc, M_MET, roll)

# --- модули конечности -------------------------------------------------------
def build_module(tag):
    g = bpy.data.objects.new(f'mod_{tag}', None)
    sc.collection.objects.link(g)
    bpy.context.view_layer.update()
    parent_keep(g, roll)
    car = box(f'car_{tag}', (0.14, 0.12, 0.10), (0, 0, 0), M_DARK, g)
    boom = cyl(f'boom_{tag}', 0.020, 1.0, (0, 0, 0), M_MET, g, rot=(0, math.radians(90), 0), seg=14)
    head = cyl(f'head_{tag}', 0.045, 0.05, (0, 0, 0), M_BODY, g, seg=18)
    ring = cyl(f'ring_{tag}', 0.075, 0.022, (0, 0, 0), M_ACC, g, seg=28)
    cradle = box(f'cradle_{tag}', (0.10, 0.26, 0.05), (0, 0, 0), M_PAD, g)
    post = cyl(f'post_{tag}', 0.016, 0.2, (0, 0, 0), M_MET, g, seg=12)
    return dict(group=g, car=car, boom=boom, head=head, ring=ring, cradle=cradle, post=post)


modules = {t: build_module(t) for t in ('arm_L', 'arm_R', 'leg_L', 'leg_R')}


def nearest_rail(p):
    """ближайшая точка периметрального рельса (в осях платформы)"""
    x, y = p.x, p.y
    cx = max(-rx, min(rx, x))
    cy = max(-ry, min(ry, y))
    # если точка внутри прямоугольника — прижимаем к ближайшей стороне
    if abs(cx - x) < 1e-6 and abs(cy - y) < 1e-6:
        d = {'x': rx - abs(x), 'y': ry - abs(y)}
        if d['x'] < d['y']:
            return Vector((math.copysign(rx, x if x else 1), y, 0))
        return Vector((x, math.copysign(ry, y if y else 1), 0))
    return Vector((cx, cy, 0))


def place_module(tag, target, limb_dir=None):
    """ставит каретку на рельс, разворачивает штангу на цель и растягивает её"""
    md = modules[tag]
    car_p = nearest_rail(target)
    g = md['group']
    g.location = (car_p.x, car_p.y, rz)
    vec = Vector((target.x - car_p.x, target.y - car_p.y, 0))
    yaw = math.atan2(vec.y, vec.x)
    g.rotation_euler = (0, 0, yaw)
    dist = vec.length
    # штанга: цилиндр длиной 1 по X, масштабируем и сдвигаем
    md['boom'].scale = (dist, 1, 1)
    md['boom'].location = (dist / 2, 0, 0)
    # вертикальная стойка от штанги до высоты сустава
    dz = target.z - (rz - PIVOT_Z) - PIVOT_Z
    dz = target.z - rz
    md['post'].scale = (1, 1, abs(dz))
    md['post'].location = (dist, 0, dz / 2)
    md['head'].location = (dist, 0, dz)
    md['ring'].location = (dist, 0, dz + 0.03)
    md['cradle'].location = (dist * 0.55, 0, dz * 0.45)
    md['ring'].rotation_euler = (0, math.radians(90), 0)
    bpy.context.view_layer.update()
    world = g.matrix_world @ Vector((dist, 0, dz + 0.03))
    return (world - target).length


# --- тело ---------------------------------------------------------------------
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=CH)
bpy.context.view_layer.update()
new = [o for o in bpy.data.objects if o not in before]
arm = next(o for o in new if o.type == 'ARMATURE')
body_meshes = [o for o in new if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
for o in [x for x in new if x.type == 'MESH' and x not in body_meshes]:
    bpy.data.objects.remove(o, do_unlink=True)


def body_pts():
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in body_meshes:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        out += [mw @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    return out


p = body_pts()
k = 1.75 / (max(q.z for q in p) - min(q.z for q in p))
arm.matrix_world = Matrix.Scale(k, 4) @ arm.matrix_world
bpy.context.view_layer.update()
face_dir = 1 if (sum((o.matrix_world @ v.co).y for o in body_meshes if o.name == 'Face'
                     for v in o.data.vertices) >
                 sum((o.matrix_world @ v.co).y for o in body_meshes if o.name == 'Body'
                     for v in o.data.vertices)) else -1
rot = Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Rotation(math.radians(90 * face_dir), 4, 'X')
arm.matrix_world = rot @ arm.matrix_world
bpy.context.view_layer.update()
p = body_pts()
cx = (min(q.x for q in p) + max(q.x for q in p)) / 2
cy = (min(q.y for q in p) + max(q.y for q in p)) / 2
z_top = PIVOT_Z + PLAT_T / 2 + MAT_T
arm.matrix_world = Matrix.Translation(Vector((-cx, -cy, z_top - min(q.z for q in p) + 0.004))) @ arm.matrix_world
bpy.context.view_layer.update()
# тело едет вместе с платформой при наклоне
parent_keep(arm, roll)
bpy.context.view_layer.update()


def jb(name):
    pb = arm.pose.bones.get(name)
    return (arm.matrix_world @ pb.head) if pb else None


def reset_body():
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()


def rot_bone(name, deg, axis):
    pb = arm.pose.bones.get(name)
    if pb:
        pb.rotation_mode = 'XYZ'
        e = [0.0, 0.0, 0.0]
        e[axis] = math.radians(deg)
        pb.rotation_euler = e


POSES = {}


def sweep_arms(want_y, want_x, degs=range(-90, 91, 10)):
    """подбирает ось и угол плеча так, чтобы кисть L встала в (want_x, want_y)"""
    best = None
    for axis in range(3):
        for d in degs:
            reset_body()
            rot_bone('J_Bip_L_UpperArm', d, axis)
            rot_bone('J_Bip_R_UpperArm', -d, axis)
            bpy.context.view_layer.update()
            w = jb('J_Bip_L_Hand')
            if not w:
                continue
            score = abs(w.y - want_y) + abs(w.x - want_x)
            if best is None or score < best[0]:
                best = (score, axis, d)
    reset_body()
    if best:
        rot_bone('J_Bip_L_UpperArm', best[2], best[1])
        rot_bone('J_Bip_R_UpperArm', -best[2], best[1])
    bpy.context.view_layer.update()
    return best


def sweep_legs(degs=range(-90, 91, 10)):
    best = None
    for axis in range(3):
        for d in degs:
            reset_body()
            rot_bone('J_Bip_L_UpperLeg', d, axis)
            rot_bone('J_Bip_R_UpperLeg', -d, axis)
            bpy.context.view_layer.update()
            fl, fr = jb('J_Bip_L_Foot'), jb('J_Bip_R_Foot')
            if not fl or not fr:
                continue
            score = -(abs(fl.y) + abs(fr.y)) + 0.3 * (abs(fl.z - fl.z))
            if best is None or score < best[0]:
                best = (score, axis, d)
    reset_body()
    if best:
        rot_bone('J_Bip_L_UpperLeg', best[2], best[1])
        rot_bone('J_Bip_R_UpperLeg', -best[2], best[1])
    bpy.context.view_layer.update()
    return best


def take_pose(tag):
    if tag == 'A_arms_along':
        sweep_arms(0.20, 0.00)
    elif tag == 'B_arms_up':
        sweep_arms(-0.29, -0.73)
    elif tag == 'C_arms_out':
        sweep_arms(0.59, -0.50)
    elif tag == 'D_split':
        sweep_arms(0.59, -0.50)
        # ноги: разведение до упора, колени прямые
        best = None
        for axis in range(3):
            for d in range(20, 95, 5):
                reset_body()
                sweep_arms(0.59, -0.50)
                rot_bone('J_Bip_L_UpperLeg', d, axis)
                rot_bone('J_Bip_R_UpperLeg', -d, axis)
                bpy.context.view_layer.update()
                fl, fr = jb('J_Bip_L_Foot'), jb('J_Bip_R_Foot')
                if not fl or not fr:
                    continue
                score = -(abs(fl.y) + abs(fr.y)) + 2.0 * abs(fl.z - 0.16)
                if best is None or score < best[0]:
                    best = (score, axis, d)
        reset_body()
        sweep_arms(0.59, -0.50)
        if best:
            rot_bone('J_Bip_L_UpperLeg', best[2], best[1])
            rot_bone('J_Bip_R_UpperLeg', -best[2], best[1])
        print('SPLIT_CFG', best)
    bpy.context.view_layer.update()


# --- свет и камера -----------------------------------------------------------
for nm, vec, e in (('key', (0.4, 0.7, -0.6), 3.0), ('fill', (-0.5, -0.6, -0.3), 1.1)):
    d = bpy.data.lights.new(nm, 'SUN')
    d.energy = e
    o = bpy.data.objects.new(nm, d)
    o.rotation_euler = Vector(vec).normalized().to_track_quat('-Z', 'Y').to_euler()
    sc.collection.objects.link(o)
w = bpy.data.worlds.new('W')
sc.world = w
w.use_nodes = True
w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.60, 0.63, 0.66, 1)
w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8

bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.002))
floor = bpy.context.object
floor.data.materials.append(mat('m_floor', (0.52, 0.54, 0.57), 0.9))

cd = bpy.data.cameras.new('cam')
cam = bpy.data.objects.new('cam', cd)
sc.collection.objects.link(cam)
sc.camera = cam
cd.lens = 42

sc.render.engine = 'BLENDER_EEVEE_NEXT'
sc.render.resolution_x, sc.render.resolution_y = 1300, 900
sc.eevee.taa_render_samples = 20
sc.view_settings.view_transform = 'AgX'


def shot(name, loc, aim):
    cam.location = loc
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


# --- прогон поз --------------------------------------------------------------
for tag in ('A_arms_along', 'B_arms_up', 'C_arms_out', 'D_split'):
    take_pose(tag)
    targets = {
        'arm_L': jb('J_Bip_L_Hand'), 'arm_R': jb('J_Bip_R_Hand'),
        'leg_L': jb('J_Bip_L_Foot'), 'leg_R': jb('J_Bip_R_Foot'),
    }
    errs = {}
    for k2, t in targets.items():
        if t is None:
            continue
        errs[k2] = round(place_module(k2, t), 4)
    print('POSE', tag, 'ring_error', errs,
          'targets', {k2: [round(v.x, 2), round(v.y, 2)] for k2, v in targets.items() if v})
    shot(f'omni_{tag}_34.png', (2.3, -2.5, 1.75), (0, 0, 1.0))

# шпагат сверху
take_pose('D_split')
for k2 in ('arm_L', 'arm_R', 'leg_L', 'leg_R'):
    t = {'arm_L': jb('J_Bip_L_Hand'), 'arm_R': jb('J_Bip_R_Hand'),
         'leg_L': jb('J_Bip_L_Foot'), 'leg_R': jb('J_Bip_R_Foot')}[k2]
    place_module(k2, t)
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.7
shot('omni_D_split_top.png', (0, 0, 4.0), (0, 0, 1.0))
cam.data.type = 'PERSP'

# наклон платформы 45° и 90°
pitch.rotation_euler = (math.radians(-45), 0, 0)
bpy.context.view_layer.update()
shot('omni_tilt45.png', (2.4, -2.6, 1.9), (0, 0, 1.1))
pitch.rotation_euler = (math.radians(-90), 0, 0)
bpy.context.view_layer.update()
shot('omni_tilt90.png', (2.6, -2.4, 2.0), (0, 0, 1.1))

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_1.blend'))
print('SAVED omni_1.blend')