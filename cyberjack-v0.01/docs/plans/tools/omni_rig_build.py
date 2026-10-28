"""ОМНИ-1 v3: машина СО СВОИМ РИГОМ, детали стыкуются по построению.

Отличия от v2:
  1. Риг — настоящий скелет (26 костей): root → base → column → pitch → roll →
     четыре цепочки (carriage → boom → post → head). Меш один, привязан скином.
  2. Модуль собран в канонической системе: каретка в нуле, штанга вдоль +Y
     длиной 1, стойка вдоль +Z длиной 1, голова на её конце. Поэтому длина
     штанги — это scale.y кости, высота стойки — scale.y кости стойки,
     и никаких пересчётов координат: детали всегда стыкуются.
  3. Рельс прижат к низу платформы (верх рельса = низ плиты), каретка обхватывает
     рельс, стойка растёт от оси штанги — висящих деталей нет по построению.

Запуск: blender -b --factory-startup -noaudio --python tools/omni_rig_build.py
"""
import bpy, os, math
from mathutils import Vector, Matrix

OUT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/docs/plans/blockout'
CH = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/anna_nude.glb'

PLAT_L, PLAT_W, PLAT_T = 1.90, 0.64, 0.08
MAT_T = 0.05
PIVOT_Z = 1.02
PIVOT_TOP = PIVOT_Z + PLAT_T / 2 + MAT_T          # 1.11 — плоскость матраса
PLATE_BOT = PIVOT_Z - PLAT_T / 2                  # 0.98
RAIL_T = 0.035
RAIL_Z = PLATE_BOT - RAIL_T / 2                   # верх рельса = низ плиты
RAIL_INSET = 0.06
RX = PLAT_L / 2 - RAIL_INSET - 0.03
RY = PLAT_W / 2 - RAIL_INSET - 0.03
SLOT_W = 0.09
ARM_Y, ARM_X0, ARM_X1 = 0.20, -0.85, 0.10
LEG_Y, LEG_X0, LEG_X1 = 0.085, 0.10, 0.80

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

parts = []          # (object, bone)


def reg(o, material, bone):
    o.data.materials.append(material)
    parts.append((o, bone))
    return o


def box(name, size, loc, material, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return reg(o, material, bone)


def cyl(name, r, h, loc, material, bone, rot=(0, 0, 0), seg=24):
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=h, vertices=seg, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return reg(o, material, bone)


def torus(name, R, r, loc, material, bone, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, location=loc, rotation=rot,
                                     major_segments=32, minor_segments=10)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return reg(o, material, bone)


# === станина (кости: base / column / pitch / roll) ===========================
box('base_plate', (1.40, 1.00, 0.12), (0, 0, 0.06), M_BODY, 'base')
for sx in (-1, 1):
    for sy in (-1, 1):
        cyl(f'foot_{sx}_{sy}', 0.05, 0.02, (sx * 0.58, sy * 0.40, 0.01), M_DARK, 'base', seg=12)
cyl('column_outer', 0.084, 0.60, (0, 0, 0.42), M_DARK, 'column', seg=28)
cyl('column_inner', 0.060, 0.36, (0, 0, 0.84), M_MET, 'column', seg=24)
cyl('column_collar', 0.095, 0.06, (0, 0, 0.72), M_BODY, 'column', seg=28)
# кардан: стакан на колонне + кольцо крена
cyl('gimbal_socket', 0.115, 0.09, (0, 0, PIVOT_Z - 0.02), M_DARK, 'column', seg=28)
cyl('gimbal_ring', 0.135, 0.05, (0, 0, PIVOT_Z), M_MET, 'pitch',
    rot=(0, math.radians(90), 0), seg=32)
for sy in (-1, 1):
    box(f'yoke_{sy}', (0.10, 0.05, 0.22), (0, sy * 0.115, PIVOT_Z - 0.06), M_DARK, 'roll')


# === платформа с прорезями ===================================================
def plate_with_slots():
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, PIVOT_Z))
    o = bpy.context.object
    o.name = 'platform'
    o.scale = (PLAT_L, PLAT_W, PLAT_T)
    bpy.ops.object.transform_apply(location=True, scale=True)
    holes = [((ARM_X0 + ARM_X1) / 2, ARM_Y, ARM_X1 - ARM_X0, SLOT_W),
             ((ARM_X0 + ARM_X1) / 2, -ARM_Y, ARM_X1 - ARM_X0, SLOT_W),
             ((LEG_X0 + LEG_X1) / 2, LEG_Y, LEG_X1 - LEG_X0, SLOT_W),
             ((LEG_X0 + LEG_X1) / 2, -LEG_Y, LEG_X1 - LEG_X0, SLOT_W)]
    for hx, hy, hw, hh in holes:
        bpy.ops.mesh.primitive_cube_add(size=1, location=(hx, hy, PIVOT_Z))
        cut = bpy.context.object
        cut.scale = (hw, hh, PLAT_T * 2)
        bpy.ops.object.transform_apply(location=True, scale=True)
        m = o.modifiers.new('cut', 'BOOLEAN')
        m.operation = 'DIFFERENCE'
        m.object = cut
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='cut')
        bpy.data.objects.remove(cut, do_unlink=True)
    return reg(o, M_BODY, 'roll')


plate_with_slots()
box('mattress', (PLAT_L - 0.04, PLAT_W - 0.04, MAT_T), (0, 0, PIVOT_TOP - MAT_T / 2), M_PAD, 'roll')

# периметральный рельс: верх = низ плиты, плюс стойки-подвесы к плите
for nm, size, loc in (
        ('rail_p', (2 * RX, 0.05, RAIL_T), (0, RY, RAIL_Z)),
        ('rail_m', (2 * RX, 0.05, RAIL_T), (0, -RY, RAIL_Z)),
        ('rail_r', (0.05, 2 * RY, RAIL_T), (RX, 0, RAIL_Z)),
        ('rail_l', (0.05, 2 * RY, RAIL_T), (-RX, 0, RAIL_Z))):
    box(nm, size, loc, M_MET, 'roll')
# обойма: замкнутая стенка, связывающая плиту и рельс — рельс читается как часть платформы
RIM_H = 0.075
RIM_T = 0.03
RIM_Z = PLATE_BOT - RIM_H / 2 + 0.005
for nm, size, loc in (
        ('rim_p', (2 * (RX + RIM_T), RIM_T, RIM_H), (0, RY + RIM_T / 2, RIM_Z)),
        ('rim_m', (2 * (RX + RIM_T), RIM_T, RIM_H), (0, -(RY + RIM_T / 2), RIM_Z)),
        ('rim_r', (RIM_T, 2 * (RY + RIM_T), RIM_H), (RX + RIM_T / 2, 0, RIM_Z)),
        ('rim_l', (RIM_T, 2 * (RY + RIM_T), RIM_H), (-(RX + RIM_T / 2), 0, RIM_Z))):
    box(nm, size, loc, M_BODY, 'roll')
for sx in (-1, 1):
    for sy in (-1, 1):
        box(f'rail_strut_{sx}_{sy}', (0.04, 0.04, RIM_H),
            (sx * RX, sy * RY, RIM_Z), M_MET, 'roll')

# === модуль конечности в канонической системе ================================
# каретка в (0,0,RAIL_Z), штанга 0..1 по +Y на высоте RAIL_Z,
# стойка 0..1 по +Z в конце штанги, голова на её конце.
def build_module(tag, y0, x0):
    g = bpy.data.objects.new(f'g_{tag}', None)
    sc.collection.objects.link(g)
    g.location = (x0, y0, RAIL_Z)

    def put(o):
        o.parent = g
        return o

    put(box(f'car_{tag}', (0.16, 0.14, 0.13), (0, 0, 0), M_DARK, f'car_{tag}'))
    put(cyl(f'boom_{tag}', 0.022, 1.0, (0, 0.5, 0), M_MET, f'boom_{tag}',
            rot=(math.radians(90), 0, 0), seg=16))
    put(box(f'cradle_{tag}', (0.13, 0.42, 0.035), (0, 0.5, 0.055), M_PAD, f'boom_{tag}'))
    put(cyl(f'post_{tag}', 0.018, 1.0, (0, 1.0, 0.5), M_MET, f'post_{tag}', seg=14))
    # проушина под обручем: не перекрывает проём, кольцо сверху
    put(box(f'head_{tag}', (0.055, 0.038, 0.075), (0, 1.0, 0.905), M_BODY, f'head_{tag}'))
    # обруч стоит вертикально: ось кольца вдоль X, конечность проходит сквозь него
    put(torus(f'ring_{tag}', 0.075, 0.016, (0, 1.0, 1.0), M_ACC, f'head_{tag}',
              rot=(0, math.radians(90), 0)))
    return g


mods = {}
for tag, y0, x0 in (('arm_L', RY, -0.60), ('arm_R', -RY, -0.60),
                    ('leg_L', RY, 0.60), ('leg_R', -RY, 0.60)):
    mods[tag] = build_module(tag, y0, x0)

# === скелет ==================================================================
ad = bpy.data.armatures.new('OMNI_rig')
rig = bpy.data.objects.new('OMNI_rig', ad)
sc.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
eb = ad.edit_bones


def bone(name, head, tail, parent=None):
    b = eb.new(name)
    b.head, b.tail = Vector(head), Vector(tail)
    if parent:
        b.parent = eb[parent]
        b.use_connect = False
    return b


bone('root', (0, 0, 0), (0, 0, 0.12))
bone('base', (0, 0, 0.12), (0, 0, 0.12 + 0.001), 'root')
bone('column', (0, 0, 0.12), (0, 0, PIVOT_Z - 0.06), 'root')
bone('pitch', (0, 0, PIVOT_Z), (0, 0, PIVOT_Z + 0.01), 'column')
bone('roll', (0, 0, PIVOT_Z), (0, 0, PIVOT_Z + 0.02), 'pitch')

for tag, y0, x0 in (('arm_L', RY, -0.60), ('arm_R', -RY, -0.60),
                    ('leg_L', RY, 0.60), ('leg_R', -RY, 0.60)):
    bone(f'car_{tag}', (x0, y0, RAIL_Z), (x0, y0 + 0.02, RAIL_Z), 'roll')
    bone(f'boom_{tag}', (x0, y0, RAIL_Z), (x0, y0 + 1.0, RAIL_Z), f'car_{tag}')
    bone(f'post_{tag}', (x0, y0 + 1.0, RAIL_Z), (x0, y0 + 1.0, RAIL_Z + 1.0), f'boom_{tag}')
    bone(f'head_{tag}', (x0, y0 + 1.0, RAIL_Z + 1.0), (x0, y0 + 1.0, RAIL_Z + 1.08), f'post_{tag}')
bpy.ops.object.mode_set(mode='OBJECT')

# === скин ====================================================================
for o, bname in parts:
    vg = o.vertex_groups.new(name=bname)
    vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')

bpy.ops.object.select_all(action='DESELECT')
for o, _ in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]
bpy.ops.object.join()
machine = bpy.context.object
machine.name = 'OMNI_1'
for o in list(bpy.data.objects):
    if o.type == 'EMPTY' and o.name.startswith('g_'):
        bpy.data.objects.remove(o, do_unlink=True)

mod = machine.modifiers.new('Armature', 'ARMATURE')
mod.object = rig
machine.parent = rig

# === установка крепления на цель ============================================
def place(tag, target, limb_dir=None):
    """кости: каретка на рельс, рыскание на цель, длина штанги и высота стойки"""
    x, y, z = target
    # ближайшая точка рельса
    cx = max(-RX, min(RX, x))
    cy = max(-RY, min(RY, y))
    if abs(cx - x) < 1e-6 and abs(cy - y) < 1e-6:
        if (RX - abs(x)) < (RY - abs(y)):
            cx = math.copysign(RX, x if x else 1)
        else:
            cy = math.copysign(RY, y if y else 1)
    pbc = rig.pose.bones[f'car_{tag}']
    rest = rig.data.bones[f'car_{tag}'].head_local
    pbc.location = (cx - rest.x, cy - rest.y, 0)
    bpy.context.view_layer.update()
    # рыскание и длина штанги
    pbb = rig.pose.bones[f'boom_{tag}']
    vec = Vector((x - cx, y - cy, 0))
    pbb.rotation_mode = 'XYZ'
    pbb.rotation_euler = (0, 0, math.atan2(vec.y, vec.x) - math.atan2(1, 0))
    pbb.scale = (1, max(0.02, vec.length), 1)
    # высота стойки
    pbp = rig.pose.bones[f'post_{tag}']
    pbp.scale = (1, max(0.05, z - RAIL_Z), 1)
    # ось кольца — по оси конечности (кость головы вращается вокруг мировой Z)
    if limb_dir is not None and limb_dir.length > 1e-6:
        pbh = rig.pose.bones[f'head_{tag}']
        pbh.rotation_mode = 'XYZ'
        pbh.rotation_euler = (0, math.atan2(limb_dir.y, limb_dir.x), 0)
    bpy.context.view_layer.update()
    return (rig.matrix_world @ rig.pose.bones[f'head_{tag}'].head - Vector(target)).length


# === тело ====================================================================
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=CH)
bpy.context.view_layer.update()
new = [o for o in bpy.data.objects if o not in before]
arm = next(o for o in new if o.type == 'ARMATURE')
bodymeshes = [o for o in new if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers)]
for o in [x for x in new if x.type == 'MESH' and x not in bodymeshes]:
    bpy.data.objects.remove(o, do_unlink=True)


def body_pts():
    dg = bpy.context.evaluated_depsgraph_get()
    out = []
    for o in bodymeshes:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        out += [mw @ v.co for v in me.vertices]
        ev.to_mesh_clear()
    return out


p = body_pts()
arm.matrix_world = Matrix.Scale(1.75 / (max(q.z for q in p) - min(q.z for q in p)), 4) @ arm.matrix_world
bpy.context.view_layer.update()


def mean_y(nm):
    o = bpy.data.objects.get(nm)
    if not o:
        return 0.0
    dg = bpy.context.evaluated_depsgraph_get()
    ev = o.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    v = sum((mw @ x.co).y for x in me.vertices) / len(me.vertices)
    ev.to_mesh_clear()
    return v


face_dir = 1 if mean_y('Face') > mean_y('Body') else -1
arm.matrix_world = (Matrix.Rotation(math.radians(90), 4, 'Z')
                    @ Matrix.Rotation(math.radians(90 * face_dir), 4, 'X')) @ arm.matrix_world
bpy.context.view_layer.update()
p = body_pts()
cx = (min(q.x for q in p) + max(q.x for q in p)) / 2
cy2 = (min(q.y for q in p) + max(q.y for q in p)) / 2
arm.matrix_world = Matrix.Translation(Vector((-cx, -cy2, PIVOT_TOP - min(q.z for q in p) + 0.004))) @ arm.matrix_world
bpy.context.view_layer.update()
arm.parent = rig
arm.matrix_parent_inverse = rig.matrix_world.inverted()

# === позы тела ===============================================================
def jb(nm):
    pb = arm.pose.bones.get(nm)
    return (arm.matrix_world @ pb.head) if pb else None


def reset():
    for pb in arm.pose.bones:
        pb.rotation_mode = 'XYZ'
        pb.location = (0, 0, 0)
        pb.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()


def rb(nm, deg, axis):
    pb = arm.pose.bones.get(nm)
    if pb:
        pb.rotation_mode = 'XYZ'
        e = [0.0, 0.0, 0.0]
        e[axis] = math.radians(deg)
        pb.rotation_euler = e


def sweep_arms(wy, wx):
    best = None
    for axis in range(3):
        for d in range(-90, 91, 10):
            reset()
            rb('J_Bip_L_UpperArm', d, axis)
            rb('J_Bip_R_UpperArm', -d, axis)
            bpy.context.view_layer.update()
            w = jb('J_Bip_L_Hand')
            if not w:
                continue
            sc_ = abs(w.y - wy) + abs(w.x - wx)
            if best is None or sc_ < best[0]:
                best = (sc_, axis, d)
    reset()
    if best:
        rb('J_Bip_L_UpperArm', best[2], best[1])
        rb('J_Bip_R_UpperArm', -best[2], best[1])
    bpy.context.view_layer.update()


def limb_dirs():
    def d(a, b):
        pa, pb2 = jb(a), jb(b)
        return (pa - pb2) if (pa and pb2) else None
    return {'arm_L': d('J_Bip_L_Hand', 'J_Bip_L_LowerArm'),
            'arm_R': d('J_Bip_R_Hand', 'J_Bip_R_LowerArm'),
            'leg_L': d('J_Bip_L_Foot', 'J_Bip_L_LowerLeg'),
            'leg_R': d('J_Bip_R_Foot', 'J_Bip_R_LowerLeg')}


def pose(tag):
    if tag == 'A':
        sweep_arms(0.20, 0.0)
    elif tag == 'C':
        sweep_arms(0.59, -0.50)
    elif tag == 'D':
        sweep_arms(0.59, -0.50)
        rb('J_Bip_L_UpperLeg', 90, 2)
        rb('J_Bip_R_UpperLeg', -90, 2)
    bpy.context.view_layer.update()


# === свет/камера/рендер ======================================================
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
fl = bpy.context.object
fl.data.materials.append(mat('m_floor', (0.52, 0.54, 0.57), 0.9))

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
    cam.data.type = 'PERSP'
    cam.location = loc
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


for tag, aim in (('A', (0, 0, 1.0)), ('C', (0, 0, 1.0)), ('D', (0, 0, 1.0))):
    pose(tag)
    tgt = {'arm_L': jb('J_Bip_L_Hand'), 'arm_R': jb('J_Bip_R_Hand'),
           'leg_L': jb('J_Bip_L_Foot'), 'leg_R': jb('J_Bip_R_Foot')}
    dirs = limb_dirs()
    errs = {k: round(place(k, t, dirs.get(k)), 4) for k, t in tgt.items() if t}
    print('POSE', tag, 'ring_err', errs,
          'targets', {k: [round(v.x, 2), round(v.y, 2), round(v.z, 2)] for k, v in tgt.items() if v})
    shot(f'rg_{tag}_34.png', (2.3, -2.5, 1.75), aim)

# шпагат сверху
pose('D')
tgt = {'arm_L': jb('J_Bip_L_Hand'), 'arm_R': jb('J_Bip_R_Hand'),
       'leg_L': jb('J_Bip_L_Foot'), 'leg_R': jb('J_Bip_R_Foot')}
for k, t in tgt.items():
    place(k, t, limb_dirs().get(k))
cam.data.type = 'ORTHO'
cam.data.ortho_scale = 2.9
shot('rg_D_top.png', (0, 0, 4.2), (0, 0, 1.0))

# наклоны
cam.data.type = 'PERSP'
rig.pose.bones['pitch'].rotation_mode = 'XYZ'
for ang, nm in ((-45, 'rg_tilt45.png'), (-90, 'rg_tilt90.png')):
    rig.pose.bones['pitch'].rotation_euler = (math.radians(ang), 0, 0)
    bpy.context.view_layer.update()
    shot(nm, (2.4, -2.6, 1.9), (0, 0, 1.1))
rig.pose.bones['pitch'].rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_rig.blend'))
print('SAVED omni_rig.blend')
print('BONES', len(ad.bones))
