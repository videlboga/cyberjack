"""Standalone builder: motion_linear_y (MOT-Y-02, «Y-каретка»).

Компактная линейная ось: алюминиевая станина с лапами, широкий профильный
рельс, каретка на шести роликах, ШВП (винт + гайка) с опорами, серво с
редуктором под торцевым кожухом, концевые упоры, концевики с LED,
быстросъёмная плита с кулачковыми зажимами и посадочным полем,
кабельный контур (энергоцепь в лотке), разъём питания, шильдик.
Плиты-основания нет.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_linear_y.py

Выход:
  public/models/machine-modules/components/motion_linear_y.glb
  docs/plans/blockout/component-library/motion_linear_y/*.png
  docs/plans/blockout/component-library/motion_linear_y/report.json

Геометрия (Blender Z-up, метры):
  ось движения   = Y, вдоль рельса; Blender Y -> glTF/three.js Z (export_yup)
  габарит        = 0,8 (Y) x 0,4 (X) x 0,2 (Z); низ на z = 0
  анимация       = сдвиг пустышки motion_linear_y__anim по Y, 0..0,3 м
  двигается      = каретка, ролики, оси роликов, гайка ШВП с кронштейном,
                   рёбра и быстросъёмная плита
  статично       = станина, рельс, винт и его опоры, привод, упоры,
                   концевики, лоток и цепь кабельного контура
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_linear_y'
CID = 'motion_linear_y'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
# габарит по паспорту 0,8 x 0,4 x 0,2; длинная сторона — вдоль рельса/хода
Y_MIN, Y_MAX = -0.400, 0.400
BASE_HX = 0.100                   # полуширина станины
BASE_Z0, BASE_Z1 = 0.012, 0.080

RAIL_X = 0.040                    # полуширина профильного рельса
RAIL_Y0, RAIL_Y1 = -0.364, 0.254
RAIL_Z0, RAIL_Z1 = 0.088, 0.120

CARR_HX = 0.072                   # полуширина блока каретки
CARR_HY = 0.110                   # полуглубина каретки
CARR_Z0, CARR_Z1 = 0.148, 0.178   # верхний блок каретки
CHEEK_X0, CHEEK_X1 = 0.060, 0.072 # боковые щёки каретки
CHEEK_Z0, CHEEK_Z1 = 0.100, 0.148
ROLL_Z = 0.110                    # центр роликов
ROLL_R = 0.011
ROLL_YS = (-0.072, 0.0, 0.072)

PLATE_HX, PLATE_HY = 0.105, 0.105
PLATE_Z0, PLATE_Z1 = 0.178, 0.192

SCREW_X = -0.172                  # ось ШВП
SCREW_Z = 0.110
SCREW_Y = 0.330
SCREW_R = 0.011
SCREW_PITCH = 0.038

DUCT_X0, DUCT_X1 = 0.100, 0.200   # лоток кабельного контура
CHAIN_X = 0.176                   # ось энергоцепи

ANIM_Z = 0.163                    # датум оси — центр блока каретки

PALETTE = {
    'alu': (0.735, 0.742, 0.748),
    'body': (0.945, 0.937, 0.918),
    'steel': (0.660, 0.666, 0.658),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.180, 0.186, 0.196),
    'blush': (0.910, 0.725, 0.749),
    'ivory': (0.980, 0.973, 0.957),
    'red': (0.720, 0.070, 0.060),
    'cyan': (0.750, 0.900, 0.920),
}
MATS = {}


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.58
    metal = 0.55 if role in ('alu', 'steel') else 0.30 if role == 'graphite' else 0.0
    bsdf.inputs['Metallic'].default_value = metal
    if role == 'alu':
        bsdf.inputs['Roughness'].default_value = 0.42
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.55
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def bevel(obj, width=0.0015, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, r2=None, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                            depth=d.length, location=(a + b) * 0.5)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
                                        radius2=r2, depth=d.length,
                                        location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=40, rings=10):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def curve_tube(name, points, radius, role, res=8):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 12
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def arc_shell(name, x0, x1, cy, cz, r_in, r_out, a0, a1, seg, role):
    """Тонкий кожух-сектор вокруг оси X: a=0 -> +Z, a=+90° -> +Y."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        dy, dz = math.sin(a), math.cos(a)
        ring = []
        for x in (x0, x1):
            for r in (r_in, r_out):
                ring.append(bm.verts.new((x, cy + dy * r, cz + dz * r)))
        rings.append(ring)
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        bm.faces.new((a_[0], a_[2], b_[2], b_[0]))   # inner
        bm.faces.new((a_[1], b_[1], b_[3], a_[3]))   # outer
        bm.faces.new((a_[0], a_[1], b_[1], b_[0]))   # x0 cap
        bm.faces.new((a_[2], a_[3], b_[3], b_[2]))   # x1 cap
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, True)


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def text_label(name, body, loc, size, role, rot=(math.radians(90), 0, math.radians(90))):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = 0.0004
    obj.data.align_x = 'CENTER'
    obj.data.align_y = 'CENTER'
    try:
        obj.data.font = bpy.data.fonts.load(str(FONT_PATH))
    except Exception:
        pass
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    movers = []

    anim = empty(PREFIX + 'anim', (0.0, 0.0, ANIM_Z))
    bpy.context.view_layer.update()

    # ---------- станина: алюминиевый профиль на четырёх лапах ----------
    cube(PREFIX + 'base', (0, 0, (BASE_Z0 + BASE_Z1) * 0.5),
         (BASE_HX * 2, 0.790, BASE_Z1 - BASE_Z0), 'alu', r=0.005)
    for tag, sx in (('L', -1), ('R', 1)):
        cube(PREFIX + f'base_groove_{tag}', (sx * (BASE_HX + 0.0012), 0.0, 0.030),
             (0.006, 0.770, 0.008), 'dark', r=0.0012)
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        cube(PREFIX + f'foot_{i}', (sx * 0.068, sy * 0.320, 0.007),
             (0.055, 0.070, 0.014), 'graphite', r=0.003)
        cyl(PREFIX + f'bed_bolt_{i}', (sx * 0.078, sy * 0.250, 0.080),
            (sx * 0.078, sy * 0.250, 0.087), 0.0075, 'steel', vertices=12, bev=0.0010)

    # ---------- рельс ----------
    cube(PREFIX + 'rail_bed', (0, (RAIL_Y0 + RAIL_Y1) * 0.5, 0.083),
         (0.104, RAIL_Y1 - RAIL_Y0, 0.010), 'graphite', r=0.0025)
    cube(PREFIX + 'rail', (0, (RAIL_Y0 + RAIL_Y1) * 0.5, (RAIL_Z0 + RAIL_Z1) * 0.5),
         (RAIL_X * 2, RAIL_Y1 - RAIL_Y0 - 0.008, RAIL_Z1 - RAIL_Z0), 'steel', r=0.0018)
    for tag, sx in (('L', -1), ('R', 1)):
        cube(PREFIX + f'rail_strip_{tag}', (sx * 0.0215, (RAIL_Y0 + RAIL_Y1) * 0.5,
                                            0.1212),
             (0.010, RAIL_Y1 - RAIL_Y0 - 0.016, 0.0025), 'steel', r=0.0006)

    # ---------- торцевые блоки, упоры, концевики ----------
    for tag, sy in (('F', -1), ('B', 1)):
        y0 = sy * 0.352
        y1 = sy * 0.400
        cube(PREFIX + f'end_base_{tag}', (0, (y0 + y1) * 0.5, 0.036),
             (0.240, abs(y1 - y0), 0.048), 'graphite', r=0.005)
        cube(PREFIX + f'end_block_{tag}', (0, (y0 + y1) * 0.5, 0.092),
             (0.176, abs(y1 - y0), 0.064), 'graphite', r=0.004)
        for i, sx in enumerate((-1, 1)):
            cyl(PREFIX + f'end_bolt_{tag}{i}', (sx * 0.070, sy * 0.376, 0.124),
                (sx * 0.070, sy * 0.376, 0.131), 0.0068, 'steel', vertices=12, bev=0.0010)
        stop_y = -0.344 if sy < 0 else 0.234
        cube(PREFIX + f'stop_{tag}', (0, stop_y, 0.112), (0.096, 0.020, 0.034),
             'red', r=0.003)
        sen_y = -0.312 if sy < 0 else 0.212
        cube(PREFIX + f'sensor_{tag}', (0.079, sen_y, 0.096), (0.020, 0.030, 0.032),
             'graphite', r=0.0025)
        sphere(PREFIX + f'sensor_led_{tag}', (0.079, sen_y, 0.114), 0.0036, 'cyan')

    # ---------- каретка (движется) ----------
    movers.append(cube(PREFIX + 'carriage_block', (0, 0, (CARR_Z0 + CARR_Z1) * 0.5),
                       (CARR_HX * 2, CARR_HY * 2, CARR_Z1 - CARR_Z0), 'graphite', r=0.005))
    for tag, sx in (('L', -1), ('R', 1)):
        movers.append(cube(PREFIX + f'carriage_cheek_{tag}',
                           (sx * (CHEEK_X0 + CHEEK_X1) * 0.5, 0,
                            (CHEEK_Z0 + CHEEK_Z1) * 0.5),
                           (CHEEK_X1 - CHEEK_X0, CARR_HY * 2, CHEEK_Z1 - CHEEK_Z0),
                           'graphite', r=0.0025))
        for i, y in enumerate(ROLL_YS):
            movers.append(cyl(PREFIX + f'roller_{tag}{i}',
                              (sx * RAIL_X, y, ROLL_Z), (sx * CHEEK_X0, y, ROLL_Z),
                              ROLL_R, 'steel', vertices=20, bev=0.0012))
            movers.append(cyl(PREFIX + f'roller_axle_{tag}{i}',
                              (sx * (CHEEK_X0 - 0.002), y, ROLL_Z),
                              (sx * (CHEEK_X1 + 0.006), y, ROLL_Z),
                              0.0035, 'dark', vertices=12))
        for i, y in enumerate((-0.090, 0.090)):
            movers.append(cube(PREFIX + f'plate_rib_{tag}{i}',
                               (sx * (CARR_HX + PLATE_HX) * 0.5, y, 0.171),
                               (PLATE_HX - CARR_HX, 0.016, 0.014), 'graphite', r=0.0018))

    # ---------- быстросъёмная плита ----------
    movers.append(cube(PREFIX + 'quick_plate', (0, 0, (PLATE_Z0 + PLATE_Z1) * 0.5),
                       (PLATE_HX * 2, PLATE_HY * 2, PLATE_Z1 - PLATE_Z0), 'alu', r=0.004))
    movers.append(cube(PREFIX + 'tool_pad', (0, 0.004, 0.195),
                       (0.150, 0.150, 0.006), 'graphite', r=0.0025))
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        movers.append(cyl(PREFIX + f'plate_pin_{i}', (sx * 0.090, sy * 0.086, PLATE_Z1),
                          (sx * 0.090, sy * 0.086, 0.1995), 0.0058, 'steel',
                          vertices=14, bev=0.0010))
    for tag, sx in (('L', -1), ('R', 1)):
        movers.append(cyl(PREFIX + f'quick_cam_{tag}', (sx * 0.078, -0.098, PLATE_Z1),
                          (sx * 0.078, -0.098, 0.1990), 0.0050, 'steel',
                          vertices=14, bev=0.0008))
        movers.append(cube(PREFIX + f'quick_lever_{tag}', (sx * 0.078, -0.110, 0.1955),
                           (0.046, 0.014, 0.009), 'graphite', r=0.0018))

    # ---------- ШВП: винт, опоры, гайка на кронштейне ----------
    cyl(PREFIX + 'screw', (SCREW_X, -SCREW_Y, SCREW_Z), (SCREW_X, SCREW_Y, SCREW_Z),
        SCREW_R, 'steel', vertices=24, bev=0.0008)
    k = int((SCREW_Y * 2 - 0.02) / SCREW_PITCH)
    for i in range(k + 1):
        y = -SCREW_Y + 0.014 + i * SCREW_PITCH
        if abs(y) < 0.040:            # место гайки
            continue
        cyl(PREFIX + f'screw_thread_{i:02d}', (SCREW_X, y, SCREW_Z),
            (SCREW_X, y + 0.0055, SCREW_Z), SCREW_R + 0.0011, 'steel',
            vertices=20, bev=0.0005)
    for tag, sy in (('F', -1), ('B', 1)):
        # литая стойка: держит опору винта, стоит на полу и примыкает к станине
        cube(PREFIX + f'screw_pedestal_{tag}', (-0.146, sy * 0.326, 0.068),
             (0.108, 0.052, 0.136), 'graphite', r=0.005)
        cyl(PREFIX + f'screw_boss_{tag}', (SCREW_X, sy * 0.300, SCREW_Z),
            (SCREW_X, sy * 0.292, SCREW_Z), 0.017, 'steel', vertices=20, bev=0.0012)
    # гайка ШВП с кронштейном — движется с кареткой
    movers.append(cube(PREFIX + 'screw_nut', (-0.172, 0.0, SCREW_Z),
                       (0.038, 0.056, 0.038), 'graphite', r=0.003))
    movers.append(cube(PREFIX + 'nut_carrier', (-0.108, 0.0, 0.112),
                       (0.096, 0.058, 0.030), 'steel', r=0.003))

    # ---------- привод: серво, редуктор, кожух ----------
    cube(PREFIX + 'motor_flange', (0.010, 0.249, 0.134), (0.136, 0.018, 0.108),
         'graphite', r=0.004)
    cyl(PREFIX + 'motor', (0.010, 0.252, 0.140), (0.010, 0.340, 0.140), 0.046,
        'blush', vertices=32, bev=0.0035)
    for i, y in enumerate((0.275, 0.305, 0.332)):
        torus(PREFIX + f'motor_fin_{i}', (0.010, y, 0.140), 0.047, 0.0024, 'steel', 'Y')
    cyl(PREFIX + 'motor_cap', (0.010, 0.340, 0.140), (0.010, 0.354, 0.140), 0.040,
        'graphite', vertices=28, bev=0.0025)
    cube(PREFIX + 'gearbox_nose', (-0.090, 0.339, 0.106), (0.060, 0.044, 0.064),
         'graphite', r=0.003)

    # ---------- кабельный контур: лоток + энергоцепь ----------
    cube(PREFIX + 'duct_tray', ((DUCT_X0 + DUCT_X1) * 0.5, 0.0, 0.084),
         (DUCT_X1 - DUCT_X0, 0.780, 0.014), 'dark', r=0.0025)
    cube(PREFIX + 'duct_wall_in', (0.128, 0.0, 0.087), (0.008, 0.780, 0.034),
         'graphite', r=0.0015)
    cube(PREFIX + 'duct_lip', (0.197, 0.0, 0.087), (0.006, 0.780, 0.034),
         'graphite', r=0.0015)
    link = (0.040, 0.028, 0.020)
    n = 0

    def chain_link(y, z, rot=0.0):
        nonlocal n
        obj = cube(PREFIX + f'chain_link_{n:02d}', (CHAIN_X, y, z), link, 'dark',
                   r=0.0025, rot=(rot, 0, 0))
        n += 1
        return obj

    y = 0.326
    while y > -0.014:                     # нижняя ветвь по лотку
        chain_link(y, 0.101)
        y -= 0.028
    chain_link(-0.038, 0.114, math.radians(38))
    chain_link(-0.050, 0.131, math.radians(62))
    chain_link(-0.055, 0.148, math.radians(90))
    chain_link(-0.048, 0.163, math.radians(120))
    for i in range(6):                    # верхняя ветвь к каретке
        chain_link(-0.010 + i * 0.028, 0.170)
    cube(PREFIX + 'chain_bracket', (0.1465, 0.118, 0.172), (0.087, 0.038, 0.026),
         'steel', r=0.003)

    # кабель от привода в лоток
    curve_tube(PREFIX + 'cable',
               [(0.058, 0.326, 0.140), (0.100, 0.320, 0.150), (0.140, 0.306, 0.128),
                (0.172, 0.300, 0.100)], 0.0048, 'dark')

    # ---------- разъём питания и шильдик ----------
    cube(PREFIX + 'power_connector', (0.103, 0.180, 0.048), (0.010, 0.058, 0.040),
         'graphite', r=0.0025)
    cube(PREFIX + 'power_connector_face', (0.108, 0.180, 0.048), (0.004, 0.040, 0.024),
         'cyan', r=0.0012)

    cube(PREFIX + 'label_plate', (0.1025, -0.118, 0.058), (0.005, 0.150, 0.038),
         'graphite', r=0.0012)
    text_label(PREFIX + 'label_text', 'MOT-Y-02', (0.1053, -0.118, 0.058), 0.0125,
               'ivory')

    # ---------- привязка к анимационной пустышке ----------
    bpy.context.view_layer.update()
    for o in movers:
        parent(o, anim)
        o['moving'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in movers:
            o['moving'] = False

    bpy.context.view_layer.update()
    return anim, movers


# --- проверки ------------------------------------------------------------
def mesh_bbox(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objects:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def box_gap(a_mn, a_mx, b_mn, b_mx):
    """Расстояние между bbox (0 — касание/пересечение)."""
    gap = 0.0
    for i in range(3):
        d = max(b_mn[i] - a_mx[i], a_mn[i] - b_mx[i])
        gap = max(gap, d)
    return gap


def check(anim, movers):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    passport = (0.800, 0.400, 0.200)
    got_sorted = tuple(sorted((round(size.x, 5), round(size.y, 5), round(size.z, 5)),
                              reverse=True))
    bbox_ok = all(abs(g - p) <= 0.004 for g, p in zip(got_sorted, passport))

    kids = [o for o in anim.children if o.type == 'MESH']

    # --- тест хода: двигается только каретка, статика заморожена ---
    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    delta = 0.090
    anim.location = Vector((anim.location.x, anim.location.y + delta, anim.location.z))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}

    kid_names = {o.name for o in kids}
    move_err = 0.0
    for name in kid_names:
        move_err = max(move_err, (after[name] - before[name] - Vector((0, delta, 0))).length)
    static_err = max(((after[n] - before[n]).length for n in before if n not in kid_names),
                     default=0.0)

    anim.location = Vector((anim.location.x, anim.location.y - delta, anim.location.z))
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    pivot_shift = max((restored[n] - before[n]).length for n in before)

    # --- «не висит в воздухе»: каждый bbox касается хотя бы одного соседа ---
    boxes = {}
    for o in meshes:
        a, b = mesh_bbox([o])
        boxes[o.name] = (a, b)
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0015
                   for other in boxes):
            floating.append(name)

    anim_loc = anim.location.copy()
    axis_ok = (abs(anim_loc.x) < 1e-6 and abs(anim_loc.z - ANIM_Z) < 1e-6
               and CARR_Z0 < anim_loc.z < CARR_Z1)

    report = {
        'component': CID,
        'code': 'MOT-Y-02',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_sorted_m': list(got_sorted),
        'bbox_passport_m': list(passport),
        'bbox_ok': bool(bbox_ok),
        'floor_contact_z': round(mn.z, 6),
        'floor_contact_ok': bool(abs(mn.z) < 0.0006),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim_loc],
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'static_parts': sorted(o.name for o in meshes if o.name not in kid_names),
        'static_count': len([o for o in meshes if o.name not in kid_names]),
        'slide_delta_m': delta,
        'mover_error_m': round(move_err, 9),
        'static_error_m': round(static_err, 9),
        'slide_rigid_ok': bool(move_err < 1e-6),
        'static_frozen_ok': bool(static_err < 1e-9),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_ok': bool(pivot_shift < 1e-6 and axis_ok),
        'travel_m': 0.300,
        'axis_blender': 'Y (вдоль рельса)',
        'axis_three_js': 'Z (Blender Y -> glTF Z, export_yup)',
        'floating_parts': floating,
        'no_floating_ok': bool(not floating),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    return report


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = OUT / f'{CID}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    return path


# --- рендеры -------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.10
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.55

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.42, -0.46, 0.52), 2.60, 0.55),
            ('fill', (-0.55, -0.38, 0.30), 1.10, 0.70),
            ('rim', (0.05, 0.52, 0.44), 1.70, 0.55)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.55))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

    def fit_dist(direction, lens, corners, margin=1.12):
        right, up, back = cam_basis(direction)
        sensor = cam_data.sensor_width
        sx, sy = scene.render.resolution_x, scene.render.resolution_y
        sw = sensor if sx >= sy else sensor * sx / sy
        sh = sensor * sy / sx if sx >= sy else sensor
        th = sw * 0.5 / lens
        tv = sh * 0.5 / lens
        need = 0.0
        for p in corners:
            need = max(need,
                       abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(mn - center, mx - center)
    # крупный план: каретка, ролики, гайка ШВП, быстросъёмная плита
    close_t = Vector((-0.020, -0.050, 0.140))
    c_close = box_corners(Vector((-0.200, -0.200, 0.070)) - close_t,
                          Vector((0.200, 0.120, 0.202)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.80, -0.78, 0.52), center + Vector((0, 0, 0.010)), 70, c_main, 0.92),
        ('front', (0.02, -1.00, 0.30), center + Vector((0, 0, 0.006)), 70, c_main, 0.92),
        ('side', (1.00, -0.10, 0.20), center + Vector((0, 0, 0.004)), 70, c_main, 0.92),
        ('closeup', (0.52, -0.74, 0.42), close_t, 85, c_close, 0.94),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(5):
            got = max_ndc(fill)
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} fill={max_ndc(fill):.3f} {fp}', flush=True)
    return outs


def main():
    anim, movers = build()
    rep = check(anim, movers)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['pivot_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and rep['no_floating_ok'] and rep['static_frozen_ok']):
        raise SystemExit('checks failed')


main()
