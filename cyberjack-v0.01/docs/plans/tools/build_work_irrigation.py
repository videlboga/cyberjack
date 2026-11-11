"""Standalone builder: work_irrigation (WRK-FL-03, «Ирригационная головка»).

Компактная оросительная головка, а не плита с примитивами:
штуцер подачи с накаткой -> быстросъём с замком -> корпус регулятора
давления с накатным маховиком, циановой шкалой и манометром -> прозрачная
силиконовая штанга-хват -> распределительная камера с шестью радиальными
разводками -> купол головки с 6 соплами по дуге (веер вперёд-вверх),
у каждого сопла полупрозрачная циановая струя (alpha 0.25 — объём потока,
не твёрдая деталь). Сзади на хвате — С-образная клемма-крепление с винтом.

Не зависит от build_component_library.py и других builder-скриптов —
helpers продублированы намеренно.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_irrigation.py

Выход:
  public/models/machine-modules/components/work_irrigation.glb

Геометрия (Blender Z-up, метры):
  ось устройства = Z (поток вверх), струи наклонены вперёд (-Y) и в стороны.
  Вращений нет, анимации нет (паспорт: motion = none).
"""
from pathlib import Path
import json
import math
import re

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
CID = 'work_irrigation'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
# паспорт: Ø 0,02 x 0,20 м; корпус Ø 0,021-0,024, головка с соплами Ø 0,026
FIT_Z0, FIT_Z1 = 0.028, 0.044        # штуцер подачи (под шланг)
QD_Z0, QD_Z1 = 0.044, 0.066         # быстросъёмная гильза
REG_Z0, REG_Z1 = 0.066, 0.104       # корпус регулятора давления
GRIP_Z0, GRIP_Z1 = 0.104, 0.160     # силиконовая штанга-хват
CH_Z0, CH_Z1 = 0.160, 0.1730        # распределительная камера
HEAD_BASE_Z0, HEAD_BASE_Z1 = 0.1712, 0.1770
DOME_C, DOME_R = 0.1778, 0.0150     # центр и радиус купола (эллипсоид)
DOME_ZS = 0.80                      # растяжение купола по Z (плоская головка)
Z_RING = 0.1840                     # высота посадки сопел
RING_R = 0.0105                     # радиус дуги сопел
NOZZLES = 6
AZ_SPAN = 52.0                      # дуга сопел: -52..+52 град от -Y
NOZZLE_LEN = 0.0080
JET_LEN = 0.023
JET_R1 = 0.0030
HOSE_R = 0.0042
HOSE_PTS = [(0.0, 0.0, 0.0305), (0.0, 0.009, 0.0245),
            (0.0, 0.025, 0.0135), (0.0, 0.043, 0.0075)]

PALETTE = {
    'silicone': (0.968, 0.964, 0.955),
    'silicone_body': (0.972, 0.968, 0.958),
    'teal': (0.145, 0.615, 0.635),
    'steel': (0.720, 0.727, 0.724),
    'graphite': (0.286, 0.300, 0.320),
    'dark': (0.150, 0.158, 0.176),
    'ivory': (0.958, 0.950, 0.932),
    'cyan': (0.320, 0.850, 0.905),
    'flow': (0.200, 0.700, 0.860),
    'fluid': (0.055, 0.520, 0.620),
    'red': (0.760, 0.140, 0.120),
}
MATS = {}


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def _blended(m):
    m.blend_method = 'BLEND'
    if hasattr(m, 'surface_render_method'):
        m.surface_render_method = 'BLENDED'
    m.use_transparent_shadow = True
    m.show_transparent_back = True


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    rough = {'silicone': 0.78, 'silicone_body': 0.62, 'teal': 0.52, 'steel': 0.42, 'graphite': 0.56,
             'dark': 0.48, 'ivory': 0.60, 'cyan': 0.36, 'flow': 0.26,
             'fluid': 0.22, 'red': 0.45}[role]
    metal = {'silicone': 0.0, 'silicone_body': 0.0, 'teal': 0.05, 'steel': 0.86, 'graphite': 0.24,
             'dark': 0.30, 'ivory': 0.0, 'cyan': 0.0, 'flow': 0.0,
             'fluid': 0.0, 'red': 0.0}[role]
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal

    alpha = 1.0
    if role == 'silicone':               # прозрачный медицинский силикон
        alpha = 0.72
        bsdf.inputs['Alpha'].default_value = alpha
        bsdf.inputs['IOR'].default_value = 1.42
        _blended(m)
    elif role == 'silicone_body':        # сатиновый силикон хвата/штанги
        alpha = 1.0
        bsdf.inputs['IOR'].default_value = 1.42
    elif role == 'flow':                 # объём струи, не твёрдая деталь
        alpha = 0.25
        bsdf.inputs['Alpha'].default_value = alpha
        bsdf.inputs['IOR'].default_value = 1.0
        bsdf.inputs['Emission Color'].default_value = (0.30, 0.86, 0.98, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.85
        _blended(m)
    elif role == 'fluid':                # жидкость в шланге
        alpha = 0.55
        bsdf.inputs['Alpha'].default_value = alpha
        bsdf.inputs['IOR'].default_value = 1.0
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.30
        _blended(m)
    elif role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.70

    m.diffuse_color = (*color, alpha)
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


def bevel(obj, width=0.0015, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, vertices=24, smooth=True, r2=None, bev=0.0):
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
        bevel(obj, bev, 1)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=26, rings=14, scale=(1, 1, 1),
           smooth=True):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, smooth)


def torus(name, loc, major, minor, role, axis='Z', segs=24, rings=6):
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


def curve_tube(name, points, radius, role, res=5):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 10
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def knurl_z(name, cx, cy, z0, z1, r_base, n, role, rib=0.0005):
    """Накатка на цилиндре с осью Z: n рёбер по окружности, один меш."""
    bm = bmesh.new()
    zm = (z0 + z1) * 0.5
    for i in range(n):
        a = math.tau * i / n
        m = (Matrix.Translation((cx + math.sin(a) * r_base,
                                 cy + math.cos(a) * r_base, zm))
             @ Matrix.Rotation(-a, 4, 'Z')
             @ Matrix.Diagonal((rib * 2.0, rib * 3.4, z1 - z0, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return mesh_from_bm(name, bm, role, smooth=False)


def knurl_x(name, x0, x1, r_base, n, role, rib=0.0005, y=0.0, z=0.0):
    bm = bmesh.new()
    xm = (x0 + x1) * 0.5
    for i in range(n):
        a = math.tau * i / n
        m = (Matrix.Translation((xm, y + math.sin(a) * r_base,
                                 z + math.cos(a) * r_base))
             @ Matrix.Rotation(math.pi / 2 - a, 4, 'X')
             @ Matrix.Diagonal((x1 - x0, rib * 3.4, rib * 2.0, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return mesh_from_bm(name, bm, role, smooth=False)


def cone_solid_dir(name, base, direction, length, r0, r1, role, seg=18):
    """Замкнутый усечённый конус вдоль направления — объём струи (alpha 0.25)."""
    bm = bmesh.new()
    base = Vector(base)
    n = Vector(direction).normalized()
    u = n.orthogonal().normalized()
    v = n.cross(u).normalized()
    ring0, ring1 = [], []
    for i in range(seg):
        a = math.tau * i / seg
        d = u * math.cos(a) + v * math.sin(a)
        ring0.append(bm.verts.new(base + d * r0))
        ring1.append(bm.verts.new(base + n * length + d * r1))
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bm.faces.new(tuple(reversed(ring0)))
    bm.faces.new(ring1)
    return mesh_from_bm(name, bm, role, smooth=True)


def arc_ring(name, center, r_in, r_out, width, a0, a1, seg, role, axis='Z'):
    """С-образное кольцо (клемма) с разрезом: сектор a0..a1, лента по оси."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        ca, sa = math.cos(a), math.sin(a)
        q = []
        for r in (r_in, r_out):
            for w in (-width * 0.5, width * 0.5):
                q.append(bm.verts.new((ca * r, sa * r, w)))
        rings.append(q)
    for i in range(seg):
        A, B = rings[i], rings[i + 1]
        bm.faces.new((A[0], A[2], B[2], B[0]))
        bm.faces.new((A[1], B[1], B[3], A[3]))
        bm.faces.new((A[0], A[1], B[1], B[0]))
        bm.faces.new((A[2], B[2], B[3], A[3]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    obj = mesh_from_bm(name, bm, role, smooth=True)
    obj.location = center
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return obj


def dome_r(z, center=DOME_C, r=DOME_R, zs=DOME_ZS):
    dz = (z - center) / zs
    if abs(dz) >= 1.0:
        return 0.0
    return r * math.sqrt(1.0 - dz * dz)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    objs = []

    def add(o, part):
        o['component'] = CID
        o['part'] = part
        objs.append(o)
        return o

    # ---- шланг подачи: прозрачный силикон + видимое ядро жидкости ------
    add(curve_tube(PREFIX + 'hose', HOSE_PTS, HOSE_R, 'silicone'), 'hose')
    add(curve_tube(PREFIX + 'hose_fluid',
                   [Vector(p) + Vector((0, 0, 0.006)) for p in HOSE_PTS[:-1]]
                   + [Vector(HOSE_PTS[-1]) - Vector((0, 0.0025, 0.0005))],
                   0.0021, 'fluid'), 'hose')
    add(cyl(PREFIX + 'hose_ferrule', (0, 0, 0.0292), (0, 0, 0.0316), 0.0066,
            'steel', vertices=22, bev=0.0007), 'hose')
    add(cyl(PREFIX + 'hose_plug', (0, 0.0432, 0.0072), (0, 0.0502, 0.0048),
            0.0042, 'steel', vertices=20, bev=0.0009), 'hose')

    # ---- штуцер подачи (накатанный ниппель под шланг) -------------------
    add(cyl(PREFIX + 'inlet_fitting', (0, 0, FIT_Z0), (0, 0, FIT_Z1), 0.0058,
            'teal', vertices=24, bev=0.0008), 'inlet')
    for i, z in enumerate((0.0326, 0.0361, 0.0396)):
        add(torus(PREFIX + f'inlet_rib_{i}', (0, 0, z), 0.0059, 0.00075,
                  'teal', 'Z', segs=24, rings=6), 'inlet')

    # ---- быстросъём: гильза, обойма с накаткой, замок-усик --------------
    add(cyl(PREFIX + 'qd_ring_teal', (0, 0, QD_Z0), (0, 0, 0.0472), 0.0097,
            'teal', vertices=26, bev=0.0006), 'coupling')
    add(cyl(PREFIX + 'qd_sleeve', (0, 0, 0.0468), (0, 0, QD_Z1), 0.0092,
            'steel', vertices=24, bev=0.0010), 'coupling')
    add(cyl(PREFIX + 'qd_collar', (0, 0, 0.0492), (0, 0, 0.0592), 0.0105,
            'graphite', vertices=24, bev=0.0009), 'coupling')
    add(knurl_z(PREFIX + 'qd_knurl', 0.0, 0.0, 0.0500, 0.0584, 0.0105, 20,
                'graphite', rib=0.00045), 'coupling')
    add(torus(PREFIX + 'qd_seal', (0, 0, 0.0652), 0.0088, 0.0012, 'dark', 'Z',
              segs=36, rings=8), 'coupling')
    # замок-усик спереди: нажимается большим пальцем
    add(cube(PREFIX + 'qd_latch', (0.0, -0.0101, 0.0626),
             (0.0104, 0.0048, 0.0052), 'graphite', r=0.0012), 'coupling')
    add(cyl(PREFIX + 'qd_latch_pin', (-0.0052, -0.0104, 0.0626),
            (0.0052, -0.0104, 0.0626), 0.0019, 'steel', vertices=14),
        'coupling')

    # ---- регулятор давления --------------------------------------------
    add(cyl(PREFIX + 'reg_body', (0, 0, REG_Z0), (0, 0, REG_Z1), 0.0106,
            'graphite', vertices=26, bev=0.0012), 'regulator')
    add(cyl(PREFIX + 'reg_collar', (0, 0, REG_Z0), (0, 0, 0.0692), 0.0113,
            'steel', vertices=26, bev=0.0006), 'regulator')
    add(cyl(PREFIX + 'reg_wheel', (0, 0, 0.0704), (0, 0, 0.0862), 0.0122,
            'steel', vertices=48, bev=0.0009), 'regulator')
    add(knurl_z(PREFIX + 'reg_knurl', 0.0, 0.0, 0.0712, 0.0854, 0.0122, 26,
                'steel', rib=0.00042), 'regulator')
    add(cyl(PREFIX + 'reg_scale_band', (0, 0, 0.0872), (0, 0, 0.0908), 0.0109,
            'cyan', vertices=26, bev=0.0004), 'regulator')
    # риски шкалы давления по передней дуге
    for i, a_deg in enumerate((-44.0, -22.0, 0.0, 22.0, 44.0)):
        a = math.radians(a_deg)
        add(cube(PREFIX + f'scale_tick_{i}',
                 (math.sin(a) * 0.0109, -math.cos(a) * 0.0109, 0.0890),
                 (0.0016, 0.0011, 0.0026), 'dark', r=0.0002,
                 rot=(0, 0, a)), 'regulator')
    # манометр: латунный? нет — сталь + молочная шкала + циановая стрелка
    add(cyl(PREFIX + 'gauge_bezel', (0, -0.0098, 0.0960), (0, -0.0119, 0.0960),
            0.0060, 'steel', vertices=24, bev=0.0005), 'gauge')
    add(cyl(PREFIX + 'gauge_face', (0, -0.0118, 0.0960), (0, -0.0126, 0.0960),
            0.0048, 'ivory', vertices=24), 'gauge')
    add(cube(PREFIX + 'gauge_needle', (0.0, -0.0129, 0.0977),
             (0.0009, 0.0006, 0.0042), 'dark', r=0.0002), 'gauge')
    add(cube(PREFIX + 'gauge_limit', (0.0028, -0.0129, 0.0979),
             (0.0010, 0.0006, 0.0018), 'red', r=0.0002), 'gauge')

    # ---- силиконовая штанга-хват ---------------------------------------
    add(cyl(PREFIX + 'grip_collar', (0, 0, 0.1028), (0, 0, 0.1064), 0.0094,
            'teal', vertices=26, bev=0.0006), 'grip')
    add(cyl(PREFIX + 'grip', (0, 0, GRIP_Z0 + 0.002), (0, 0, GRIP_Z1), 0.0080,
            'silicone_body', vertices=26), 'grip')
    for i, z in enumerate((0.1130, 0.1208, 0.1286, 0.1364, 0.1442)):
        add(torus(PREFIX + f'grip_rib_{i}', (0, 0, z), 0.0081, 0.0009,
                  'silicone_body', 'Z', segs=24, rings=6), 'grip')
    add(torus(PREFIX + 'grip_mark', (0, 0, 0.1560), 0.0081, 0.0008, 'cyan',
              'Z', segs=24, rings=6), 'grip')

    # ---- распределительная камера --------------------------------------
    add(cyl(PREFIX + 'chamber_collar', (0, 0, GRIP_Z1 - 0.0022),
            (0, 0, 0.1618), 0.0130, 'graphite', vertices=26, bev=0.0008),
        'chamber')
    add(cyl(PREFIX + 'chamber', (0, 0, 0.1612), (0, 0, CH_Z1), 0.0126,
            'teal', vertices=26, bev=0.0010), 'chamber')
    add(torus(PREFIX + 'chamber_flange', (0, 0, 0.1638), 0.0130, 0.0016,
              'steel', 'Z', segs=24, rings=6), 'chamber')

    # ---- купол головки --------------------------------------------------
    add(cyl(PREFIX + 'head_base', (0, 0, HEAD_BASE_Z0), (0, 0, HEAD_BASE_Z1),
            0.0146, 'silicone', vertices=26), 'head')
    add(sphere(PREFIX + 'head_dome', (0, 0, DOME_C), DOME_R, 'silicone',
               segs=30, rings=16, scale=(1.0, 1.0, DOME_ZS)), 'head')

    # ---- 6 сопел по дуге + струи ---------------------------------------
    def az_dir(a):
        return Vector((math.sin(a), -math.cos(a), 0.0))

    for i in range(NOZZLES):
        a = math.radians(-AZ_SPAN + (2 * AZ_SPAN) * i / (NOZZLES - 1))
        d = az_dir(a)
        base = Vector((d.x * RING_R, d.y * RING_R, Z_RING))
        n = (d * 0.30 + Vector((0, 0, 1.0))).normalized()
        tip = base + n * NOZZLE_LEN
        add(cyl(PREFIX + f'nozzle_{i}', base - n * 0.0022, base + n * 0.0060,
                0.0029, 'steel', vertices=18, smooth=True, r2=0.0023),
            'nozzle')
        add(torus(PREFIX + f'nozzle_seal_{i}', tuple(base + n * 0.0018),
                  0.0030, 0.0005, 'teal', 'Z', segs=18, rings=6), 'nozzle')
        add(cyl(PREFIX + f'nozzle_tip_{i}', base + n * 0.0058, tip,
                0.0023, 'graphite', vertices=16), 'nozzle')
        jet = add(cone_solid_dir(PREFIX + f'jet_{i}', tip + n * 0.0002, n,
                                 JET_LEN, 0.0015, JET_R1, 'flow'),
                  'flow')
        jet['flow'] = True
        jet['alpha'] = 0.25
        jet['nozzle'] = i
        # радиальная разводка от камеры к соплу (видна через купол)
        add(cyl(PREFIX + f'runner_{i}',
                (d.x * 0.0050, d.y * 0.0050, 0.1702),
                base - n * 0.0012, 0.0018, 'teal', vertices=12), 'chamber')

    # ---- крепление: С-клемма на рельс, винт-барашек сзади --------------
    add(cube(PREFIX + 'mount_arm', (0.0, 0.0152, 0.0965),
             (0.0140, 0.0108, 0.0104), 'steel', r=0.0016), 'mount')
    # кольцо клеммы лежит в плоскости YZ (ось X), зев раскрыт вверх
    add(arc_ring(PREFIX + 'mount_clip', (0.0, 0.0258, 0.0965),
                 0.0064, 0.0094, 0.0132,
                 math.radians(232.0), math.radians(488.0), 30, 'graphite',
                 axis='X'), 'mount')
    add(cyl(PREFIX + 'mount_screw', (0.0, 0.0258, 0.1048),
            (0.0, 0.0258, 0.1096), 0.0028, 'steel', vertices=16, bev=0.0004),
        'mount')
    add(cyl(PREFIX + 'mount_thumbwheel', (0.0, 0.0258, 0.1092),
            (0.0, 0.0258, 0.1132), 0.0056, 'graphite', vertices=20,
            bev=0.0006), 'mount')
    add(knurl_z(PREFIX + 'mount_knurl', 0.0, 0.0258, 0.1092, 0.1130, 0.0056,
                14, 'graphite', rib=0.00035), 'mount')

    # --- теги для рендера/логики ---
    for o in objs:
        if o.get('part') != 'flow':
            o['flow'] = False
        o['rotating'] = False
    bpy.context.view_layer.update()
    return objs


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


def check(objs):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    device = [o for o in all_mesh if not o.get('flow')]
    d_mn, d_mx = mesh_bbox(device)
    d_size = d_mx - d_mn

    flow = [o for o in all_mesh if o.get('flow')]
    f_mn, f_mx = mesh_bbox(flow) if flow else (mn, mx)

    nozzles = [o for o in all_mesh
               if re.fullmatch(re.escape(PREFIX) + r'nozzle_\d+', o.name)]
    LIM = (0.060, 0.075, 0.216)      # паспорт 0,02 x 0,20 + головка/струи/клемма
    bbox_ok = all(size[i] <= LIM[i] + 1e-4 for i in range(3))
    mats = sorted(m.name for m in bpy.data.materials if m.users)

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'parts': sorted(o.name[len(PREFIX):] for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'device_bbox_size': [round(v, 5) for v in d_size],
        'device_height_m': round(d_size.z, 5),
        'flow_bbox_z': [round(f_mn.z, 5), round(f_mx.z, 5)],
        'passport_limit': list(LIM),
        'bbox_ok': bool(bbox_ok),
        'materials': mats,
        'materials_ok': bool(len(mats) >= 4),
        'nozzles': len(nozzles),
        'nozzles_ok': bool(4 <= len(nozzles) <= 8),
        'jets': len(flow),
        'tris': sum(len(o.data.loop_triangles) for o in all_mesh),
        'below_floor': sorted(o.name for o in all_mesh
                              if min((o.matrix_world @ Vector(c)).z
                                     for c in o.bound_box) < -1e-6),
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
    if not path.is_file() or path.stat().st_size < 12000:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    objs = build()
    rep = check(objs)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if (not rep['bbox_ok'] or not rep['materials_ok']
            or not rep['nozzles_ok'] or rep['bad_names']
            or rep['below_floor']):
        raise SystemExit('checks failed')


main()
