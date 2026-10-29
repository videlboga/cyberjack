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
MODULE_Z = PIVOT_TOP + 0.05                        # плоскость штанг: над матрасом
PIVOT_X = {'arm': -0.62, 'leg': -0.05}             # опора у плеча / у бедра
PIVOT_Y = {'arm': 0.24, 'leg': 0.07}   # опора стоит там, где лежит конечность в «сведено»
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


def cuff(name, center, r_out=0.070, r_in=0.050, width=0.050, bone='head', material=None, group=None):
    """браслет-обойма: пояс из сегментов вокруг конечности + мягкое уплотнение внутри.
    Ось обоймы — вдоль X (конечность проходит сквозь)."""
    r_mid = (r_out + r_in) / 2
    th = (r_out - r_in)
    n = 20
    made = []
    for i in range(n):
        a = 2 * math.pi * i / n
        made.append(box(f'{name}_s{i}', (width, 2 * math.pi * r_mid / n * 1.12, th),
                        (center[0], center[1] + r_mid * math.cos(a), center[2] + r_mid * math.sin(a)),
                        material or M_MET, bone, rot=(a, 0, 0)))
        made.append(box(f'{name}_p{i}', (width * 0.92, 2 * math.pi * r_in / n * 1.10, th * 0.55),
                        (center[0], center[1] + r_in * math.cos(a), center[2] + r_in * math.sin(a)),
                        M_PAD, bone, rot=(a, 0, 0)))
    if group is not None:
        for o in made:
            o.parent = group
    return made[0]


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


def bar(name, p1, p2, r, material, bone, seg=12):
    """труба между двумя точками"""
    p1, p2 = Vector(p1), Vector(p2)
    d = p2 - p1
    bpy.ops.mesh.primitive_cylinder_add(radius=r, depth=d.length, vertices=seg,
                                        location=(p1 + p2) / 2)
    o = bpy.context.object
    o.name = name
    o.rotation_mode = 'QUATERNION'
    o.rotation_quaternion = d.to_track_quat('Z', 'Y')
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


# --- детали основания и колонны ---------------------------------------------
for sx in (-1, 1):
    for sy in (-1, 1):
        cyl(f'foot_stem_{sx}_{sy}', 0.018, 0.06, (sx * 0.58, sy * 0.40, 0.075), M_MET, 'base', seg=10)
        cyl(f'foot_pad_{sx}_{sy}', 0.055, 0.022, (sx * 0.58, sy * 0.40, 0.035), M_DARK, 'base', seg=16)
for sx in (-1, 1):
    box(f'base_gusset_{sx}', (0.16, 0.10, 0.09), (sx * 0.30, 0, 0.165), M_BODY, 'base')
cyl('col_handle_stem', 0.014, 0.10, (0.13, 0, 0.66), M_MET, 'column', rot=(0, math.radians(90), 0), seg=10)
cyl('col_handle', 0.020, 0.14, (0.20, 0, 0.66), M_ACC, 'column', rot=(0, math.radians(90), 0), seg=12)
box('col_scale_plate', (0.03, 0.10, 0.24), (0.062, 0, 0.80), M_BODY, 'column')

# === платформа с прорезями ===================================================
def holed_slab(name, w, h, t, z, holes, material, bone, step=0.0, step_d=0.015):
    """плита с вырезами; step — ширина уступа по верху (фрезерованная выемка под штангу)"""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, z))
    o = bpy.context.object
    o.name = name
    o.scale = (w, h, t)
    bpy.ops.object.transform_apply(location=True, scale=True)
    for hx, hy, hw, hh in holes:
        # 1) уступ по верху: широкая выемка глубиной step_d
        if step > 0:
            bpy.ops.mesh.primitive_cube_add(size=1, location=(hx, hy, z + t / 2 - step_d / 2))
            up = bpy.context.object
            up.scale = (hw + step, hh + step, step_d)
            bpy.ops.object.transform_apply(location=True, scale=True)
            m3 = o.modifiers.new('step', 'BOOLEAN')
            m3.operation = 'DIFFERENCE'
            m3.object = up
            bpy.context.view_layer.objects.active = o
            bpy.ops.object.modifier_apply(modifier='step')
            bpy.data.objects.remove(up, do_unlink=True)
        # 2) сквозной паз
        bpy.ops.mesh.primitive_cube_add(size=1, location=(hx, hy, z))
        cut = bpy.context.object
        cut.scale = (hw, hh, t * 3)
        bpy.ops.object.transform_apply(location=True, scale=True)
        m = o.modifiers.new('cut', 'BOOLEAN')
        m.operation = 'DIFFERENCE'
        m.object = cut
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier='cut')
        bpy.data.objects.remove(cut, do_unlink=True)
    return reg(o, material, bone)


# --- пазы: узкие сквозные каналы у положения «сведено» (матрас остаётся целым)
SLOT_SPEC = [   # (tag, x0, x1, y, ширина) — канал вокруг опоры и сведённой конечности
    ('arm_L', -0.72, 0.12, 0.24, 0.18),
    ('arm_R', -0.72, 0.12, -0.24, 0.18),
    ('leg_L', -0.14, 0.86, 0.07, 0.15),
    ('leg_R', -0.14, 0.86, -0.07, 0.15),
]
SLOT_GEOM = {}
for tag, x0, x1, y, w in SLOT_SPEC:
    SLOT_GEOM[tag] = (x0, x1, y, w)

HOLES = [((x0 + x1) / 2, y, x1 - x0, w) for _, x0, x1, y, w in SLOT_SPEC]
HOLES_WIDE = [(hx, hy, hw, hh) for hx, hy, hw, hh in HOLES]

plate = holed_slab('platform', PLAT_L, PLAT_W, PLAT_T, PIVOT_Z, HOLES_WIDE, M_BODY, 'roll')
holed_slab('mattress', PLAT_L - 0.04, PLAT_W - 0.04, MAT_T,
           PIVOT_TOP - MAT_T / 2, HOLES_WIDE, M_PAD, 'roll')
for tag, x0, x1, y, w in SLOT_SPEC:
    print('SLOT', tag, 'x', round(x0, 2), round(x1, 2), 'y', y, 'w', w)

# окантовка плиты
for sy in (-1, 1):
    box(f'plat_edge_{sy}', (PLAT_L, 0.02, PLAT_T * 0.9), (0, sy * (PLAT_W / 2 - 0.01), PIVOT_Z),
        M_MET, 'roll')
for sx in (-1, 1):
    box(f'plat_edge_x_{sx}', (0.02, PLAT_W, PLAT_T * 0.9), (sx * (PLAT_L / 2 - 0.01), 0, PIVOT_Z),
        M_MET, 'roll')

# ремни фиксации тела (часть станка, не персонажа)
def arch(nm, x, R=0.27, steps=10, r=0.019):
    """металлическая полукруглая арка над корпусом: труба по дуге + пятки у бортов"""
    pts = []
    for i in range(steps + 1):
        a = math.radians(4 + 172 * i / steps)
        pts.append((x, R * math.cos(a), PIVOT_TOP + R * math.sin(a)))
    for i in range(steps):
        bar(f'{nm}_arc{i}', pts[i], pts[i + 1], r, M_MET, 'roll', seg=10)
    for sy in (-1, 1):
        box(f'{nm}_foot_{sy}', (0.07, 0.06, 0.03),
            (x, sy * R * 0.985, PIVOT_TOP + 0.015), M_DARK, 'roll')
        cyl(f'{nm}_bolt_{sy}', 0.012, 0.02, (x, sy * R * 0.985, PIVOT_TOP + 0.038), M_MET, 'roll', seg=8)
    # мягкая накладка под аркой и замок сверху
    box(f'{nm}_pad', (0.10, 0.17, 0.018), (x, 0, PIVOT_TOP + R - 0.035), M_PAD, 'roll')
    box(f'{nm}_latch', (0.055, 0.06, 0.03), (x, 0.10, PIVOT_TOP + R - 0.012), M_ACC, 'roll')


# только грудная арка: нижняя перекрывала разведение ног
arch('arch_chest', -0.30, 0.27)

# угловые бамперы платформы
for sx in (-1, 1):
    for sy in (-1, 1):
        cyl(f'plat_bumper_{sx}_{sy}', 0.035, 0.09, (sx * (PLAT_L / 2 - 0.045), sy * (PLAT_W / 2 - 0.045),
                                                    PIVOT_Z), M_DARK, 'roll', seg=12)

# === модуль конечности в канонической системе ================================
# каретка в (0,0,RAIL_Z), штанга 0..1 по +Y на высоте RAIL_Z,
# стойка 0..1 по +Z в конце штанги, голова на её конце.
def build_module(tag, y0, x0, s=1):
    g = bpy.data.objects.new(f'g_{tag}', None)
    sc.collection.objects.link(g)
    g.location = (x0, s * y0, MODULE_Z)
    g.rotation_euler = (0, 0, 0 if s > 0 else math.pi)   # зеркалим сторону -Y

    def put(o):
        o.parent = g
        return o

    put(box(f'car_{tag}', (0.16, 0.14, 0.13), (0, 0, 0), M_DARK, f'car_{tag}'))
    put(cyl(f'boom_{tag}', 0.022, 1.0, (0, 0.5, 0), M_MET, f'boom_{tag}',
            rot=(math.radians(90), 0, 0), seg=16))
    put(box(f'cradle_{tag}', (0.13, 0.42, 0.035), (0, 0.5, 0.055), M_PAD, f'boom_{tag}'))
    # телескоп: наружная труба фиксированной длины + выдвижная часть
    put(cyl(f'boom_out_{tag}', 0.030, 0.55, (0, 0.275, 0), M_MET, f'boom_{tag}',
            rot=(math.radians(90), 0, 0), seg=18))
    put(cyl(f'boom_collar_{tag}', 0.036, 0.05, (0, 0.55, 0), M_BODY, f'boom_{tag}',
            rot=(math.radians(90), 0, 0), seg=18))
    put(cyl(f'post_{tag}', 0.018, 1.0, (0, 1.0, 0.5), M_MET, f'post_{tag}', seg=14))
    put(cyl(f'post_out_{tag}', 0.026, 0.30, (0, 1.0, 0.15), M_MET, f'post_{tag}', seg=16))
    put(cyl(f'post_collar_{tag}', 0.032, 0.04, (0, 1.0, 0.30), M_BODY, f'post_{tag}', seg=16))
    put(cyl(f'car_lever_{tag}', 0.012, 0.09, (0.09, 0, 0.02), M_ACC, f'car_{tag}',
            rot=(0, math.radians(90), 0), seg=10))
    put(cyl(f'boom_pin_{tag}', 0.008, 0.05, (0, 0.30, 0.032), M_MET, f'boom_{tag}', seg=8))
    # проушина под обручем: не перекрывает проём, кольцо сверху
    put(box(f'head_{tag}', (0.055, 0.038, 0.075), (0, 1.0, 0.905), M_BODY, f'head_{tag}'))
    # обруч стоит вертикально: ось кольца вдоль X, конечность проходит сквозь него
    put(cuff(f'cuff_{tag}', (0, 1.0, 1.0),
             r_out=0.118 if tag.startswith('leg') else 0.090,
             r_in=0.086 if tag.startswith('leg') else 0.063,
             width=0.075 if tag.startswith('leg') else 0.060,
             bone=f'head_{tag}', group=g))
    # замок кольца: петля с одной стороны, язычок с другой
    put(box(f'latch_{tag}', (0.030, 0.028, 0.05), (0, 1.0 - 0.080, 1.0), M_ACC, f'head_{tag}'))
    return g


mods = {}
for tag, s in (('arm_L', 1), ('arm_R', -1), ('leg_L', 1), ('leg_R', -1)):
    kind = tag.split('_')[0]
    mods[tag] = build_module(tag, PIVOT_Y[kind], PIVOT_X[kind], s)

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
    s = 1 if tag.endswith('_L') else -1
    x0 = PIVOT_X[tag.split('_')[0]]
    y0 = s * PIVOT_Y[tag.split('_')[0]]
    bone(f'car_{tag}', (x0, y0, MODULE_Z), (x0, y0 + s * 0.02, MODULE_Z), 'roll')
    bone(f'boom_{tag}', (x0, y0, MODULE_Z), (x0, y0 + s * 1.0, MODULE_Z), f'car_{tag}')
    bone(f'post_{tag}', (x0, y0 + s * 1.0, MODULE_Z), (x0, y0 + s * 1.0, MODULE_Z + 1.0), f'boom_{tag}')
    bone(f'head_{tag}', (x0, y0 + s * 1.0, MODULE_Z + 1.0), (x0, y0 + s * 1.0, MODULE_Z + 1.08), f'post_{tag}')
bpy.ops.object.mode_set(mode='OBJECT')

# === степени свободы машины (по умолчанию разрешено только своё) ============
def lock(pb, loc=(True, True, True), rot=(True, True, True), scale=(True, True, True)):
    pb.lock_location = loc
    pb.lock_rotation = rot
    pb.lock_scale = scale


for tag in ('arm_L', 'arm_R', 'leg_L', 'leg_R'):
    lock(rig.pose.bones[f'car_{tag}'], loc=(False, False, True), rot=(True, True, True))
    lock(rig.pose.bones[f'boom_{tag}'], loc=(True, True, True), rot=(True, True, False),
         scale=(True, False, True))
    lock(rig.pose.bones[f'post_{tag}'], loc=(True, True, True), rot=(True, True, True),
         scale=(True, False, True))
    lock(rig.pose.bones[f'head_{tag}'], loc=(True, True, True), rot=(True, True, False))
lock(rig.pose.bones['pitch'], rot=(True, False, True))
lock(rig.pose.bones['roll'], rot=(False, True, True))
for nm in ('root', 'base', 'column'):
    lock(rig.pose.bones[nm], rot=(True, True, True))

# предел наклона платформы: тангаж и крен ±90° (Limit Rotation)
lim_p = rig.pose.bones['pitch'].constraints.new('LIMIT_ROTATION')
lim_p.owner_space = 'LOCAL'
lim_p.use_limit_x = True
lim_p.min_x, lim_p.max_x = math.radians(-90), math.radians(90)
lim_p.use_limit_y = lim_p.use_limit_z = False
lim_r = rig.pose.bones['roll'].constraints.new('LIMIT_ROTATION')
lim_r.owner_space = 'LOCAL'
lim_r.use_limit_y = True
lim_r.min_y, lim_r.max_y = math.radians(-90), math.radians(90)
lim_r.use_limit_x = lim_r.use_limit_z = False

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
    """опора у тела: штанга поворачивается и выдвигается наружу, стойка поднимает кольцо"""
    s = 1 if tag.endswith('_L') else -1
    kind = tag.split('_')[0]
    x0 = PIVOT_X[kind]
    y0 = s * PIVOT_Y[kind]
    dx, dy = target[0] - x0, target[1] - y0
    r = max(0.05, math.hypot(dx, dy))
    pbb = rig.pose.bones[f'boom_{tag}']
    pbb.rotation_mode = 'XYZ'
    pbb.rotation_euler = (0, 0, math.atan2(-dx * s, dy * s))
    pbb.scale = (1, r, 1)
    rig.pose.bones[f'post_{tag}'].scale = (1, max(0.05, target[2] - MODULE_Z), 1)
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
arm.matrix_world = Matrix.Translation(Vector((-cx, -cy2, PIVOT_TOP - min(q.z for q in p) - 0.006))) @ arm.matrix_world
bpy.context.view_layer.update()
# НЕ родим тело к ригу машины: связь через IK-таргеты, иначе циклическая зависимость
# и IK молча не решает.

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


# === синхронизация: конечности следуют за креплениями (IK) ==================
def add_ik():
    pairs = [('J_Bip_L_LowerArm', 'arm_L'), ('J_Bip_R_LowerArm', 'arm_R'),
             ('J_Bip_L_LowerLeg', 'leg_L'), ('J_Bip_R_LowerLeg', 'leg_R')]
    for bone_name, tag in pairs:
        pb = arm.pose.bones.get(bone_name)
        if not pb:
            continue
        c = pb.constraints.new('IK')
        c.target = rig
        c.subtarget = f'head_{tag}'
        c.chain_count = 2
        c.use_tail = True
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
sc.eevee.taa_render_samples = 16
sc.view_settings.view_transform = 'AgX'


def shot(name, loc, aim, lens=42):
    cam.data.type = 'PERSP'
    cam.data.lens = lens
    cam.location = loc
    cam.rotation_euler = (Vector(aim) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name)
    bpy.ops.render.render(write_still=True)
    print('SHOT', name)


# === статическая проверка: тело в позе, крепления подведены к суставам ======
# Анимацию и IK не используем: они давали вывернутые позы. Здесь тело ставится
# поворотом своих костей (как в anatomy_check), а кольца подводятся к суставам.

def key_none():
    return None


def show(tag, cam_loc, cam_aim, lens=50, ortho=None, name=None):
    cam.data.type = 'ORTHO' if ortho else 'PERSP'
    if ortho:
        cam.data.ortho_scale = ortho
    cam.data.lens = lens
    cam.location = cam_loc
    cam.rotation_euler = (Vector(cam_aim) - Vector(cam_loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name or f'st_{tag}.png')
    bpy.ops.render.render(write_still=True)
    print('SHOT', name or f'st_{tag}.png')


def rod_in_slot():
    """штанга/каретка не входят в материал стола вне паза (по вычисленному мешу)"""
    gi = {g.index: g.name for g in machine.vertex_groups}
    dg = bpy.context.evaluated_depsgraph_get()
    ev = machine.evaluated_get(dg)
    me = ev.to_mesh()
    mw = ev.matrix_world
    bad = []
    for i, v in enumerate(machine.data.vertices):
        names = [gi[g.group] for g in v.groups if g.weight > 0.3]
        tag = next((n.split('_', 1)[1] for n in names
                    if n.startswith(('boom_', 'car_'))), None)
        if tag is None or tag not in SLOT_GEOM or i >= len(me.vertices):
            continue
        p = mw @ me.vertices[i].co
        x0, x1, y, w = SLOT_GEOM[tag]
        if not (PIVOT_Z - 0.10 < p.z < PIVOT_TOP - 0.0015):
            continue
        inside = (x0 - 0.01 <= p.x <= x1 + 0.01) and (abs(p.y - y) <= w / 2 + 0.01)
        if not inside:
            bad.append((tag, round(p.x, 2), round(p.y, 2)))
    ev.to_mesh_clear()
    return bad


def fit_rings():
    errs = {}
    for k in ('arm_L', 'arm_R', 'leg_L', 'leg_R'):
        t = jb('J_Bip_L_Hand' if k == 'arm_L' else 'J_Bip_R_Hand') if k.startswith('arm') \
            else jb('J_Bip_L_Foot' if k == 'leg_L' else 'J_Bip_R_Foot')
        errs[k] = round(place(k, t, limb_dirs().get(k)), 3)
    bpy.context.view_layer.update()
    return errs


# поза A: руки вдоль тела, ноги вместе
pose('A')
print('ERR A', fit_rings())
print('ROD_OUT A', len(rod_in_slot()), rod_in_slot()[:3])
show('A', (2.3, -2.5, 1.75), (0, 0, 1.05), 50)

def extensions():
    out = {}
    for tag in ('arm_L', 'arm_R', 'leg_L', 'leg_R'):
        b = rig.pose.bones[f'boom_{tag}']
        p = rig.pose.bones[f'post_{tag}']
        out[tag] = (round(b.scale.y, 3), round(p.scale.y, 3))
    return out


# поза D: руки в стороны, ноги в шпагате (поворотом бёдер, как в замерах)
pose('D')
print('ERR D', fit_rings())
print('ROD_OUT D', len(rod_in_slot()), rod_in_slot()[:3])
show('D', (2.3, -2.5, 1.75), (0, 0, 1.05), 50)
show('D_top', (0, 0, 4.2), (0, 0, 1.0), ortho=2.9)

# наклоны платформы
pose('D')
fit_rings()
rig.pose.bones['pitch'].rotation_mode = 'XYZ'
for ang, nm in ((-45, 'st_tilt45.png'), (-90, 'st_tilt90.png')):
    rig.pose.bones['pitch'].rotation_euler = (math.radians(ang), 0, 0)
    bpy.context.view_layer.update()
    show(nm, (2.4, -2.6, 1.95), (0, 0, 1.1), 45, name=nm)
rig.pose.bones['pitch'].rotation_euler = (0, 0, 0)

show('D_under', (1.5, -1.7, 0.45), (0, 0, 0.95), 50)
print('EXT 175', extensions())

# --- то же тело, но 1.95 м: станок тот же, штанги выдвигаются длиннее -------
bpy.ops.object.select_all(action='DESELECT')
dups = []
for o in [arm] + [ob for ob in bpy.data.objects if ob.type == 'MESH' and ob.parent == arm]:
    o.select_set(True)
    dups.append(o)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.duplicate(linked=False)
new_objs = [o for o in bpy.context.selected_objects]
big_arm = next(o for o in new_objs if o.type == 'ARMATURE')
big_arm.scale = (1.95 / 1.75,) * 3
bpy.context.view_layer.update()
show('big_check', (2.3, -2.5, 1.75), (0, 0, 1.05), 50, name='st_big_175_tmp.png')

# цели снимаем с большого тела
def jbig(nm):
    pb = big_arm.pose.bones.get(nm)
    return (big_arm.matrix_world @ pb.head) if pb else None


errs_big = {}
for k in ('arm_L', 'arm_R', 'leg_L', 'leg_R'):
    t = jbig('J_Bip_L_Hand' if k == 'arm_L' else 'J_Bip_R_Hand') if k.startswith('arm') \
        else jbig('J_Bip_L_Foot' if k == 'leg_L' else 'J_Bip_R_Foot')
    errs_big[k] = round(place(k, t, None), 3)
bpy.context.view_layer.update()
print('ERR_BIG', errs_big)
print('EXT 195', extensions())
show('big', (2.3, -2.5, 1.75), (0, 0, 1.05), 50, name='st_big.png')
for o in new_objs:
    bpy.data.objects.remove(o, do_unlink=True)
bpy.context.view_layer.update()

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_static.blend'))
print('SAVED omni_static.blend')
print('BONES', len(ad.bones))

# === АНИМАЦИЯ: тело отводится поворотом своих костей, кольца едут за суставами =
# IK не используем (перещёлкивает суставы). Углы отведения берём как в замерах:
# бедро и плечо вращаются вокруг найденной оси, тело остаётся анатомичным,
# а крепления подводятся ровно к суставам и ключуются в тех же кадрах.

MBONES = [f'{pre}_{t}' for t in ('arm_L', 'arm_R', 'leg_L', 'leg_R')
          for pre in ('car', 'boom', 'post', 'head')]


def snapshot():
    out = {}
    for bn in MBONES:
        pb = rig.pose.bones[bn]
        out[bn] = (tuple(pb.location), tuple(pb.rotation_euler), tuple(pb.scale))
    return out


def apply_snap(snap):
    for bn, (loc, rot, scl) in snap.items():
        pb = rig.pose.bones[bn]
        pb.location, pb.rotation_euler, pb.scale = loc, rot, scl


def find_abduction(bone, tip, want='y'):
    """ось и знак поворота, при котором конечность уходит в сторону"""
    best = None
    for axis in range(3):
        for deg in (60, 90, -60, -90):
            reset()
            rb(bone % 'L', deg, axis)
            rb(bone % 'R', -deg, axis)
            bpy.context.view_layer.update()
            t = jb(tip % 'L')
            if not t:
                continue
            score = abs(t.y) - 2.0 * abs(t.z - (jb('J_Bip_L_Hand') or t).z)
            if best is None or score > best[0]:
                best = (score, axis, deg)
    reset()
    return best[1], best[2]


LEG_AXIS, LEG_DEG = find_abduction('J_Bip_%s_UpperLeg', 'J_Bip_%s_Foot')
ARM_AXIS, ARM_DEG = find_abduction('J_Bip_%s_UpperArm', 'J_Bip_%s_Hand')
print('ABDUCT leg', LEG_AXIS, LEG_DEG, 'arm', ARM_AXIS, ARM_DEG)

SCHED = [(1, 0.0, 0.0), (16, 0.35, 0.35), (31, 0.7, 0.7), (45, 1.0, 1.0),
         (60, 0.7, 0.7), (75, 0.35, 0.35), (90, 0.0, 0.0)]
LEG_FULL = 90.0
ARM_FULL = abs(ARM_DEG)

body_keys, mach_keys = [], []
for frame, kleg, karm in SCHED:
    reset()
    rb('J_Bip_L_UpperLeg', LEG_FULL * kleg, LEG_AXIS)
    rb('J_Bip_R_UpperLeg', -LEG_FULL * kleg, LEG_AXIS)
    rb('J_Bip_L_UpperArm', ARM_DEG * karm, ARM_AXIS)
    rb('J_Bip_R_UpperArm', -ARM_DEG * karm, ARM_AXIS)
    bpy.context.view_layer.update()
    errs = {}
    for k in ('arm_L', 'arm_R', 'leg_L', 'leg_R'):
        t = jb('J_Bip_L_Hand' if k == 'arm_L' else 'J_Bip_R_Hand') if k.startswith('arm') \
            else jb('J_Bip_L_Foot' if k == 'leg_L' else 'J_Bip_R_Foot')
        errs[k] = round(place(k, t, limb_dirs().get(k)), 3)
    bpy.context.view_layer.update()
    body_keys.append((frame, {b: tuple(arm.pose.bones[b].rotation_euler)
                              for b in ('J_Bip_L_UpperLeg', 'J_Bip_R_UpperLeg',
                                        'J_Bip_L_UpperArm', 'J_Bip_R_UpperArm')}))
    mach_keys.append((frame, snapshot()))
    print('KEY', frame, 'kleg', round(kleg, 2), 'err', errs)

# пишем ключи: сначала скелет тела, потом машина (без update между кадрами)
for frame, rotations in body_keys:
    for bn, rot in rotations.items():
        pb = arm.pose.bones[bn]
        pb.rotation_mode = 'XYZ'
        pb.rotation_euler = rot
        pb.keyframe_insert('rotation_euler', frame=frame)
for frame, snap in mach_keys:
    apply_snap(snap)
    for bn in MBONES:
        pb = rig.pose.bones[bn]
        pb.keyframe_insert('location', frame=frame)
        pb.keyframe_insert('rotation_euler', frame=frame)
        pb.keyframe_insert('scale', frame=frame)

for ad2 in (arm, rig):
    if ad2.animation_data and ad2.animation_data.action:
        for fc in ad2.animation_data.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
print('KEYS body', len(arm.animation_data.action.fcurves),
      'machine', len(rig.animation_data.action.fcurves))

# ДИАГНОСТИКА: совпадает ли записанное с тем, что снимали
sc.frame_set(1)
bpy.context.view_layer.update()
bm = mach_keys[0][1]
for bn in ('boom_arm_L', 'post_leg_L'):
    want = bm[bn]
    got = (tuple(rig.pose.bones[bn].location), tuple(rig.pose.bones[bn].rotation_euler),
           tuple(rig.pose.bones[bn].scale))
    print('KEYCHK', bn, 'want', [round(v, 3) for v in want[1]], [round(v, 3) for v in want[2]],
          'got', [round(v, 3) for v in got[1]], [round(v, 3) for v in got[2]])
bw = body_keys[0][1]['J_Bip_L_UpperArm']
print('KEYCHK body want', [round(v, 3) for v in bw],
      'got', [round(v, 3) for v in arm.pose.bones['J_Bip_L_UpperArm'].rotation_euler],
      'mode', arm.pose.bones['J_Bip_L_UpperArm'].rotation_mode)

# --- печём позу тела по кадрам: 2-звенник с ЯВНЫМ базисом (без to_track_quat) --
def aim_bone(pb, target, pole):
    head = pb.matrix.translation.copy()
    y = target - head
    if y.length < 1e-6:
        return
    y.normalize()
    x = y.cross(pole)
    if x.length < 1e-5:
        x = y.cross(Vector((0, 0, 1)))
    x.normalize()
    z = x.cross(y)
    M = Matrix((x, y, z)).transposed().to_4x4()
    M.translation = head
    pb.matrix = M
    bpy.context.view_layer.update()


def solve_limb(tag, pole):
    cfg = {'arm_L': ('J_Bip_L_UpperArm', 'J_Bip_L_LowerArm'),
           'arm_R': ('J_Bip_R_UpperArm', 'J_Bip_R_LowerArm'),
           'leg_L': ('J_Bip_L_UpperLeg', 'J_Bip_L_LowerLeg'),
           'leg_R': ('J_Bip_R_UpperLeg', 'J_Bip_R_LowerLeg')}[tag]
    up, lo = cfg
    S = arm.matrix_world @ arm.pose.bones[up].head
    T = rig.matrix_world @ rig.pose.bones[f'head_{tag}'].head
    L1 = (arm.data.bones[up].tail_local - arm.data.bones[up].head_local).length
    L2 = (arm.data.bones[lo].tail_local - arm.data.bones[lo].head_local).length
    v = T - S
    d = min(v.length, (L1 + L2) * 0.999)
    axis = v.normalized()
    a = (L1 * L1 - L2 * L2 + d * d) / (2 * d)
    h = math.sqrt(max(0.0, L1 * L1 - a * a))
    perp = (pole - axis * pole.dot(axis))
    perp = perp.normalized() if perp.length > 1e-5 else Vector((0, 1, 0))
    mid = S + axis * a + perp * h
    aim_bone(arm.pose.bones[up], mid, perp)
    aim_bone(arm.pose.bones[lo], T, perp)


POLE = {'arm_L': Vector((-0.2, 0.3, 1.0)), 'arm_R': Vector((-0.2, -0.3, 1.0)),
        'leg_L': Vector((0.2, 0.9, 0.0)), 'leg_R': Vector((0.2, -0.9, 0.0))}

bad = []
for f in range(1, 91):
    sc.frame_set(f)
    bpy.context.view_layer.update()
    for tag in ('arm_L', 'arm_R', 'leg_L', 'leg_R'):
        solve_limb(tag, POLE[tag])
        for bn in ({'arm_L': 'J_Bip_L_UpperArm', 'arm_R': 'J_Bip_R_UpperArm',
                    'leg_L': 'J_Bip_L_UpperLeg', 'leg_R': 'J_Bip_R_UpperLeg'}[tag],
                   {'arm_L': 'J_Bip_L_LowerArm', 'arm_R': 'J_Bip_R_LowerArm',
                    'leg_L': 'J_Bip_L_LowerLeg', 'leg_R': 'J_Bip_R_LowerLeg'}[tag]):
            pb = arm.pose.bones[bn]
            pb.rotation_mode = 'XYZ'
            pb.keyframe_insert('rotation_euler', frame=f)
    # проверка
    for tag in ('arm_L', 'arm_R', 'leg_L', 'leg_R'):
        up = {'arm_L': 'J_Bip_L_UpperArm', 'arm_R': 'J_Bip_R_UpperArm',
              'leg_L': 'J_Bip_L_UpperLeg', 'leg_R': 'J_Bip_R_UpperLeg'}[tag]
        lo = {'arm_L': 'J_Bip_L_LowerArm', 'arm_R': 'J_Bip_R_LowerArm',
              'leg_L': 'J_Bip_L_LowerLeg', 'leg_R': 'J_Bip_R_LowerLeg'}[tag]
        S = arm.matrix_world @ arm.pose.bones[up].head
        E = arm.matrix_world @ arm.pose.bones[lo].head
        T = arm.matrix_world @ arm.pose.bones[lo].tail
        ring = rig.matrix_world @ rig.pose.bones[f'head_{tag}'].head
        ang = math.degrees((S - E).angle(T - E, 0))
        side = 1 if tag.endswith('_L') else -1
        if ang < 150:
            bad.append((f, tag, 'пересогнут', round(ang)))
        if (ring - T).length > 0.04:
            bad.append((f, tag, 'кольцо не на суставе', round((ring - T).length, 3)))
        if T.y * side < -0.02:
            bad.append((f, tag, 'чужая сторона', round(T.y, 3)))
print('BAKE_BAD', len(bad), bad[:4])

if not bad:
    cam.data.type = 'PERSP'
    cam.data.lens = 45
    cam.location = (2.15, -2.45, 1.75)
    cam.rotation_euler = (Vector((0, 0, 1.05)) - Vector(cam.location)).to_track_quat('-Z', 'Y').to_euler()
    sc.render.resolution_x, sc.render.resolution_y = 960, 640
    sc.eevee.taa_render_samples = 10
    for f in (1, 23, 45, 68):
        sc.frame_set(f)
        bpy.context.view_layer.update()
        sc.render.filepath = os.path.join(OUT, f'an_f{f:02d}.png')
        bpy.ops.render.render(write_still=True)
        print('SHOT', f'an_f{f:02d}.png')
    sc.frame_set(45)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 2.7
    cam.location = (0, 0, 4.2)
    cam.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    sc.render.filepath = os.path.join(OUT, 'an_top45.png')
    bpy.ops.render.render(write_still=True)
    print('SHOT an_top45.png')
    sc.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, 'omni_anim.blend'))
    print('SAVED omni_anim.blend')
else:
    print('ANIM_REJECTED')