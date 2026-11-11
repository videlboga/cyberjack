"""Standalone builder: utility_water (UTL-WATER-04, «Вода»).

Компактный блок водоподготовки на стену/док:
молочный корпус, фильтр с прозрачной колбой и сменным картриджем,
редуктор с маховиком и манометром, обратный клапан на вводе,
2 быстросъёма с бирюзовыми кольцами и шлангами, маркировка 0,2–2 бар.
Без плиты. Вращений и анимации нет.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_utility_water.py

Выход:
  public/models/machine-modules/components/utility_water.glb
  docs/plans/blockout/component-library/utility_water/*.png + report.json

Раскладка (Blender Z-up, метры):
  X = ширина панели, передняя панель смотрит в -Y, док-кронштейн на +Y,
  ввод (с обратным клапаном) слева внизу, выходы — справа внизу.
  bbox по паспорту: 0.20 × 0.15 × 0.10.
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/utility_water'
CID = 'utility_water'
PREFIX = CID + '__'

FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')
FONT = None

# --- габарит паспорта (м) ------------------------------------------------
PASSPORT = (0.200, 0.150, 0.100)

# --- корпус --------------------------------------------------------------
BX0, BX1 = -0.076, 0.076
BY0, BY1 = -0.030, 0.022
BZ0, BZ1 = 0.008, 0.088
FACE = BY0                       # передняя плоскость корпуса
PLATE_Y = FACE - 0.0018          # накладная лицевая панель
PLATE_Z0, PLATE_Z1 = 0.016, 0.082

# --- фильтр (передняя панель, слева) ------------------------------------
FX, FY = -0.046, -0.050          # ось колбы
F_BOWL_R = 0.0190
F_BOWL_Z0, F_BOWL_Z1 = 0.024, 0.052
F_COLLAR_R = 0.0212
F_COLLAR_Z0, F_COLLAR_Z1 = 0.016, 0.024
F_HEAD_Z0, F_HEAD_Z1 = 0.057, 0.075
F_CAP_Z0, F_CAP_Z1 = 0.075, 0.083
F_NUT_Z1 = 0.0885

# --- редуктор / манометр (панель, центр) --------------------------------
RX = 0.014
R_PAD_Z0, R_PAD_Z1 = 0.028, 0.086
KNOB_Z = 0.050
KNOB_R = 0.0125
GAUGE_Z = 0.076
GAUGE_R = 0.0155

# --- выходы (панель, справа, 2 быстросъёма) -----------------------------
OX = (0.038, 0.062)
OZ = 0.018
O_R = 0.0072

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.984, 0.980, 0.968),
    'slate': (0.258, 0.272, 0.288),
    'graphite': (0.148, 0.158, 0.172),
    'dark': (0.052, 0.057, 0.065),
    'steel': (0.762, 0.772, 0.778),
    'nickel': (0.660, 0.668, 0.655),
    'cyan': (0.290, 0.800, 0.930),
    'glass': (0.815, 0.900, 0.930),
}
METAL = {'steel': (0.90, 0.29), 'nickel': (0.86, 0.36), 'slate': (0.18, 0.52),
         'graphite': (0.28, 0.48), 'dark': (0.16, 0.56)}
EMISSIVE = ('cyan',)
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
    metallic, rough = METAL.get(role, (0.0, 0.55))
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = rough
    if role in EMISSIVE:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.55
    if role == 'glass':
        bsdf.inputs['Alpha'].default_value = 0.13
        bsdf.inputs['Roughness'].default_value = 0.06
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['IOR'].default_value = 1.46
        try:
            bsdf.inputs['Coat Weight'].default_value = 0.6
        except Exception:
            pass
        try:
            m.blend_method = 'BLEND'
        except Exception:
            pass
        try:
            m.surface_render_method = 'BLENDED'
        except Exception:
            pass
        try:
            m.use_screen_refraction = True
        except Exception:
            pass
        m.use_backface_culling = False
    m.diffuse_color = (*color, 0.13 if role == 'glass' else 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bevel(obj, width=0.0015, segments=2, angle=40.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, r2=None, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                            depth=d.length,
                                            location=(a + b) * 0.5)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
                                        radius2=r2, depth=d.length,
                                        location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        bevel(obj, bev, 2, 45.0)
    return apply(obj, role, smooth)


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


def curve_tube(name, points, radius, role, res=6, samples=10):
    """Гладкий шланг по контрольным точкам (Catmull-Rom), с заглушками торцов."""
    pts = [Vector(p) for p in points]
    ext = [pts[0]] + pts + [pts[-1]]
    path = []
    for i in range(len(pts) - 1):
        p0, p1, p2, p3 = ext[i], ext[i + 1], ext[i + 2], ext[i + 3]
        for k in range(samples):
            t = k / samples
            path.append(0.5 * ((2.0 * p1) + (-p0 + p2) * t
                               + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t * t
                               + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t ** 3))
    path.append(pts[-1])
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 3
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(path) - 1)
    for bp, p in zip(sp.points, path):
        bp.co = (p.x, p.y, p.z, 1.0)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0), extrude=0.0004):
    global FONT
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    cu.resolution_u = 4
    cu.space_character = 1.02
    if FONT_PATH.is_file():
        if FONT is None:
            FONT = bpy.data.fonts.load(str(FONT_PATH))
        cu.font = FONT
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
    return obj


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def studs_ring(name, origin, axis, radius, count, thick, wide, height,
               role, phase=0.0, along=0.5):
    """Кольцо мелких бобышек-накатки вокруг оси axis (для маховиков/гаек)."""
    bm = bmesh.new()
    q = Vector(axis).normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    base = Matrix.Translation(Vector(origin)) @ q
    for i in range(count):
        a = phase + math.tau * i / count
        m = (base @ Matrix.Rotation(a, 4, 'Z')
             @ Matrix.Translation((0.0, radius, height * along))
             @ Matrix.Diagonal((thick, wide, height, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return mesh_from_bm(name, bm, role, False)


def arc_marks(name, origin, axis, radius, angles, size, role):
    """Риски по дуге (шкала манометра) в плоскости, перпендикулярной axis."""
    bm = bmesh.new()
    q = Vector(axis).normalized().to_track_quat('Z', 'Y').to_matrix().to_4x4()
    base = Matrix.Translation(Vector(origin)) @ q
    for a in angles:
        m = (base @ Matrix.Rotation(a, 4, 'Z')
             @ Matrix.Translation((0.0, radius, 0.0))
             @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return mesh_from_bm(name, bm, role, False)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ================= корпус =================
    add(cube(PREFIX + 'body', (0.0, (BY0 + BY1) * 0.5, (BZ0 + BZ1) * 0.5),
             (BX1 - BX0, BY1 - BY0, BZ1 - BZ0), 'body', r=0.0042))
    # накладная лицевая панель (утоплена в поле корпуса, чуть выступает)
    add(cube(PREFIX + 'front_plate',
             (0.0, PLATE_Y, (PLATE_Z0 + PLATE_Z1) * 0.5),
             (0.136, 0.0022, PLATE_Z1 - PLATE_Z0), 'slate', r=0.0012))
    # верхняя крышка с 4 винтами
    add(cube(PREFIX + 'cover_plate', (0.0, (BY0 + BY1) * 0.5, BZ1 + 0.0012),
             (0.140, 0.046, 0.0032), 'ivory', r=0.0012))
    for i, sx in enumerate((-1, 1)):
        for j, sy in enumerate((-1, 1)):
            add(cyl(PREFIX + f'cover_screw_{i}{j}',
                    (sx * 0.0595, (BY0 + BY1) * 0.5 + sy * 0.017, BZ1 + 0.0024),
                    (sx * 0.0595, (BY0 + BY1) * 0.5 + sy * 0.017, BZ1 + 0.0046),
                    0.0031, 'steel', vertices=16))
    # рёбра на правой боковине
    bm = bmesh.new()
    for k in range(3):
        y = -0.006 + k * 0.011
        m = (Matrix.Translation((BX1 + 0.0006, y, 0.048))
             @ Matrix.Diagonal((0.0024, 0.0055, 0.062, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    add(mesh_from_bm(PREFIX + 'body_side_ribs', bm, 'body'))

    # ================= док-кронштейн =================
    add(cube(PREFIX + 'dock_gasket', (0.0, BY1 + 0.0008, 0.050),
             (0.134, 0.0018, 0.078), 'graphite', r=0.0006))
    add(cube(PREFIX + 'dock_plate', (0.0, BY1 + 0.0040, 0.050),
             (0.130, 0.0050, 0.074), 'slate', r=0.0018))
    add(cube(PREFIX + 'dock_lip', (0.0, BY1 + 0.0040, 0.010),
             (0.130, 0.0095, 0.0080), 'graphite', r=0.0012))
    for i, sx in enumerate((-1, 1)):
        for j, sz in enumerate((0.0235, 0.0755)):
            add(cyl(PREFIX + f'dock_screw_{i}{j}',
                    (sx * 0.0555, BY1 + 0.0064, sz),
                    (sx * 0.0555, BY1 + 0.0098, sz),
                    0.0038, 'graphite', vertices=16))
            add(cyl(PREFIX + f'dock_washer_{i}{j}',
                    (sx * 0.0555, BY1 + 0.0066, sz),
                    (sx * 0.0555, BY1 + 0.0076, sz),
                    0.0058, 'steel', vertices=18))

    # ================= ввод + обратный клапан (слева) =================
    IZ = 0.062
    add(cyl(PREFIX + 'inlet_boss', (BX0 + 0.001, -0.004, IZ),
            (-0.084, -0.004, IZ), 0.0098, 'nickel', vertices=28, bev=0.0012))
    add(cyl(PREFIX + 'check_valve', (-0.084, -0.004, IZ),
            (-0.096, -0.004, IZ), 0.0116, 'nickel', vertices=6,
            smooth=False, bev=0.0009))
    add(cyl(PREFIX + 'check_cap', (-0.090, -0.004, IZ + 0.0088),
            (-0.090, -0.004, IZ + 0.0172), 0.0056, 'graphite', vertices=16))
    add(cube(PREFIX + 'check_mark', (-0.088, -0.004, IZ + 0.0106),
             (0.0052, 0.0024, 0.0018), 'cyan', r=0.0005))
    add(cyl(PREFIX + 'inlet_sleeve', (-0.096, -0.004, IZ),
            (-0.0995, -0.004, IZ), 0.0102, 'steel', vertices=24, bev=0.0008))
    add(torus(PREFIX + 'inlet_ring', (-0.1010, -0.004, IZ),
              0.0100, 0.0022, 'cyan', 'X'))
    add(cyl(PREFIX + 'inlet_tail', (-0.1024, -0.004, IZ),
            (-0.1098, -0.004, IZ), 0.0090, 'graphite', vertices=22,
            r2=0.0062))
    add(curve_tube(PREFIX + 'inlet_hose',
                   [(-0.1090, -0.004, IZ),
                    (-0.1125, -0.011, IZ - 0.010),
                    (-0.1110, -0.020, IZ - 0.026),
                    (-0.1035, -0.027, IZ - 0.042),
                    (-0.0970, -0.028, 0.0070)], 0.0048, 'graphite'))

    # ================= фильтр (колба + картридж) =================
    add(cube(PREFIX + 'filter_head', (FX, -0.046, (F_HEAD_Z0 + F_HEAD_Z1) * 0.5),
             (0.046, 0.032, F_HEAD_Z1 - F_HEAD_Z0), 'body', r=0.0035))
    add(cyl(PREFIX + 'filter_neck', (FX, FY, F_HEAD_Z0 - 0.006),
            (FX, FY, F_HEAD_Z0 + 0.001), 0.0142, 'steel', vertices=30,
            bev=0.0008))
    add(cyl(PREFIX + 'filter_glass', (FX, FY, F_BOWL_Z0),
            (FX, FY, F_BOWL_Z1), F_BOWL_R, 'glass', vertices=40, bev=0.0022))
    add(cyl(PREFIX + 'filter_glass_bottom', (FX, FY, F_BOWL_Z0 - 0.004),
            (FX, FY, F_BOWL_Z0 + 0.001), F_BOWL_R - 0.0022, 'glass',
            vertices=40))
    add(cyl(PREFIX + 'filter_cartridge', (FX, FY, F_BOWL_Z0 + 0.001),
            (FX, FY, F_BOWL_Z1 - 0.002), 0.0126, 'ivory', vertices=34))
    for k in range(4):
        add(torus(PREFIX + f'filter_cartridge_ring_{k}',
                  (FX, FY, F_BOWL_Z0 + 0.0075 + k * 0.0048), 0.0127, 0.0009,
                  'steel', 'Z', segs=34, rings=6))
    add(torus(PREFIX + 'filter_cartridge_cap', (FX, FY, F_BOWL_Z1 - 0.002),
              0.0128, 0.0016, 'graphite', 'Z', segs=34, rings=8))
    add(cyl(PREFIX + 'filter_collar', (FX, FY, F_COLLAR_Z0),
            (FX, FY, F_COLLAR_Z1), F_COLLAR_R, 'steel', vertices=36,
            bev=0.0012))
    add(studs_ring(PREFIX + 'filter_collar_ribs', (FX, FY, F_COLLAR_Z0),
                   (0, 0, 1), F_COLLAR_R - 0.0002, 30, 0.0014, 0.0016, 0.0074,
                   'steel'))
    add(cyl(PREFIX + 'filter_cap', (FX, FY, F_CAP_Z0),
            (FX, FY, F_CAP_Z1), 0.0170, 'graphite', vertices=34, bev=0.0010))
    add(studs_ring(PREFIX + 'filter_cap_ribs', (FX, FY, F_CAP_Z0),
                   (0, 0, 1), 0.0168, 30, 0.0012, 0.0017, 0.0062, 'graphite'))
    add(torus(PREFIX + 'filter_cap_ring', (FX, FY, F_CAP_Z0 + 0.0009),
              0.0174, 0.0012, 'cyan', 'Z', segs=36, rings=6))
    add(cyl(PREFIX + 'filter_top_nut', (FX, FY, F_CAP_Z1),
            (FX, FY, F_NUT_Z1), 0.0080, 'steel', vertices=6, smooth=False,
            bev=0.0006))
    # обод колбы: читаемая кромка стекла
    add(torus(PREFIX + 'filter_glass_rim', (FX, FY, F_BOWL_Z1 - 0.0012),
              F_BOWL_R - 0.0002, 0.0014, 'steel', 'Z', segs=44, rings=8))

    # ================= редуктор + маховик + манометр =================
    add(cube(PREFIX + 'regulator_pad', (RX, FACE - 0.0040,
                                        (R_PAD_Z0 + R_PAD_Z1) * 0.5),
             (0.040, 0.0080, R_PAD_Z1 - R_PAD_Z0), 'slate', r=0.0018))
    add(cyl(PREFIX + 'regulator_body', (RX, FACE - 0.0080, KNOB_Z),
            (RX, FACE - 0.0175, KNOB_Z), 0.0148, 'steel', vertices=32,
            bev=0.0010))
    add(cyl(PREFIX + 'regulator_knob', (RX, FACE - 0.0170, KNOB_Z),
            (RX, FACE - 0.0290, KNOB_Z), KNOB_R, 'graphite', vertices=34,
            bev=0.0014))
    add(studs_ring(PREFIX + 'regulator_knurl', (RX, FACE - 0.0290, KNOB_Z),
                   (0, -1, 0), KNOB_R - 0.0002, 40, 0.0012, 0.0015, 0.0104,
                   'graphite'))
    add(cyl(PREFIX + 'regulator_knob_face', (RX, FACE - 0.0288, KNOB_Z),
            (RX, FACE - 0.0315, KNOB_Z), 0.0098, 'dark', vertices=28,
            bev=0.0006))
    add(cube(PREFIX + 'regulator_pointer', (RX, FACE - 0.0321, KNOB_Z + 0.0052),
             (0.0030, 0.0012, 0.0104), 'cyan', r=0.0004))
    add(cube(PREFIX + 'regulator_link', (RX, FACE - 0.0088,
                                          (KNOB_Z + KNOB_R + GAUGE_Z - GAUGE_R) * 0.5),
             (0.0110, 0.0075, 0.0105), 'steel', r=0.0010))

    # манометр
    add(cyl(PREFIX + 'gauge_case', (RX, FACE - 0.0080, GAUGE_Z),
            (RX, FACE - 0.0210, GAUGE_Z), GAUGE_R, 'graphite', vertices=36,
            bev=0.0014))
    add(torus(PREFIX + 'gauge_bezel', (RX, FACE - 0.0212, GAUGE_Z),
              GAUGE_R - 0.0004, 0.0020, 'steel', 'Y', segs=40, rings=8))
    add(cyl(PREFIX + 'gauge_face', (RX, FACE - 0.0206, GAUGE_Z),
            (RX, FACE - 0.0224, GAUGE_Z), 0.0126, 'ivory', vertices=34))
    add(torus(PREFIX + 'gauge_cyan_arc', (RX, FACE - 0.0228, GAUGE_Z),
              0.0112, 0.0008, 'cyan', 'Y', segs=36, rings=5))
    add(arc_marks(PREFIX + 'gauge_ticks', (RX, FACE - 0.0227, GAUGE_Z),
                  (0, -1, 0), 0.0100,
                  [math.radians(-120 + i * 30) for i in range(9)],
                  (0.0007, 0.0012, 0.0022), 'graphite'))
    add(cube(PREFIX + 'gauge_needle', (RX, FACE - 0.0232, GAUGE_Z + 0.0040),
             (0.0011, 0.0010, 0.0088), 'dark', r=0.0003))
    add(cyl(PREFIX + 'gauge_pin', (RX, FACE - 0.0226, GAUGE_Z),
            (RX, FACE - 0.0240, GAUGE_Z), 0.0020, 'steel', vertices=14))

    # ================= выходы: 2 быстросъёма + шланги =================
    add(cube(PREFIX + 'outlet_manifold', (0.050, FACE - 0.0040, OZ),
             (0.048, 0.0080, 0.020), 'slate', r=0.0016))
    for tag, ox in (('a', OX[0]), ('b', OX[1])):
        add(cyl(PREFIX + f'out_{tag}_body', (ox, FACE - 0.0060, OZ),
                (ox, FACE - 0.0150, OZ), O_R, 'nickel', vertices=24,
                bev=0.0009))
        add(cyl(PREFIX + f'out_{tag}_sleeve', (ox, FACE - 0.0150, OZ),
                (ox, FACE - 0.0200, OZ), 0.0084, 'steel', vertices=24,
                bev=0.0007))
        add(torus(PREFIX + f'out_{tag}_ring', (ox, FACE - 0.0206, OZ),
                  0.0082, 0.0022, 'cyan', 'Y'))
        add(cyl(PREFIX + f'out_{tag}_tail', (ox, FACE - 0.0214, OZ),
                (ox, FACE - 0.0300, OZ), 0.0078, 'graphite', vertices=20,
                r2=0.0058))
    add(curve_tube(PREFIX + 'out_a_hose',
                   [(OX[0], FACE - 0.0300, OZ),
                    (OX[0], -0.044, OZ),
                    (OX[0] - 0.001, -0.058, OZ - 0.004),
                    (OX[0] - 0.002, -0.070, 0.0095),
                    (OX[0] - 0.003, -0.078, 0.0045)], 0.0048, 'graphite'))
    add(curve_tube(PREFIX + 'out_b_hose',
                   [(OX[1], FACE - 0.0300, OZ),
                    (OX[1], -0.044, OZ),
                    (OX[1] + 0.001, -0.058, OZ - 0.004),
                    (OX[1] + 0.002, -0.070, 0.0095),
                    (OX[1] + 0.003, -0.078, 0.0045)], 0.0048, 'graphite'))

    # ================= маркировка и индикация =================
    add(text(PREFIX + 'label_pressure', '0,2–2 БАР', 0.0046,
             (0.004, PLATE_Y - 0.0007, 0.0225), 'ivory'))
    # шильдик на верхней крышке
    add(cube(PREFIX + 'label_top_plate', (0.000, -0.006, BZ1 + 0.0030),
             (0.070, 0.022, 0.0014), 'slate', r=0.0006))
    add(text(PREFIX + 'label_top_text', 'WATER 0,2–2 БАР', 0.0062,
             (0.000, -0.006, BZ1 + 0.0044), 'ivory', rot=(0, 0, 0), extrude=0.0004))
    # индикатор состояния + датчик протечки
    add(cyl(PREFIX + 'status_led', (0.064, FACE - 0.0030, 0.0700),
            (0.064, FACE - 0.0046, 0.0700), 0.0034, 'cyan', vertices=18))
    add(torus(PREFIX + 'status_led_ring', (0.064, FACE - 0.0046, 0.0700),
              0.0042, 0.0010, 'graphite', 'Y', segs=24, rings=6))
    add(cyl(PREFIX + 'leak_sensor', (-0.014, -0.010, BZ0 - 0.0022),
            (-0.014, -0.010, BZ0 + 0.0030), 0.0090, 'graphite', vertices=22,
            bev=0.0006))
    add(cyl(PREFIX + 'leak_sensor_pad', (-0.014, -0.010, BZ0 - 0.0028),
            (-0.014, -0.010, BZ0 - 0.0014), 0.0052, 'cyan', vertices=18))

    bpy.context.view_layer.update()
    return parts


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


def check(parts):
    bpy.context.view_layer.update()
    mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(mesh)
    size = mx - mn
    center = (mn + mx) * 0.5
    rep = {
        'component': CID,
        'code': 'UTL-WATER-04',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(PASSPORT),
        'bbox_ok': bool(size.x <= PASSPORT[0] and size.y <= PASSPORT[1]
                        and size.z <= PASSPORT[2]),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'animated': [o.name for o in bpy.data.objects
                     if o.animation_data is not None],
    }
    return rep


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
        scene.eevee.taa_render_samples = 96
    except Exception:
        pass
    try:
        scene.eevee.use_raytracing = True
        scene.eevee.ray_tracing_options.use_denoise = True
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.780, 0.772, 0.758, 1.0)
    bg.inputs['Strength'].default_value = 0.52

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3,
                                     location=(center.x, center.y, mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.650, 0.644, 0.632, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.24, -0.28, 0.28), 2.10, 0.30),
            ('fill', (-0.30, -0.22, 0.15), 0.95, 0.42),
            ('rim', (0.04, 0.30, 0.26), 1.25, 0.34)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.60))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized()

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
    # крупный план: быстросъёмы с кольцами, шланги, маховик
    close_t = Vector((0.046, -0.042, 0.034))
    c_close = box_corners(Vector((0.012, -0.078, 0.000)) - close_t,
                          Vector((0.082, -0.026, 0.068)) - close_t)

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
        ('3q', (0.78, -0.80, 0.46), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('front', (0.06, -1.00, 0.14), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('side', (1.00, -0.34, 0.18), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('closeup', (0.52, -0.86, 0.30), close_t, 85, c_close, 0.94),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4):
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
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
