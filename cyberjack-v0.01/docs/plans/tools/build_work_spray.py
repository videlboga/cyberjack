"""Standalone builder: work_spray (WRK-FL-01, «Форсунка / распылитель»).

Компактная головка распылителя, а не плита с примитивами:
молочный корпус со ступенчатым «носом», клапанный блок с курком в скобе,
маленький молочный картридж-резервуар с циановым составом снизу-сзади,
регулируемое сопло с накаткой и бирюзовой меткой расхода, быстросъёмный
разъём с коротким шлангом сзади и полупрозрачный циановый конус факела
у среза сопла (alpha 0.25 — объём потока, не твёрдая деталь).

Не зависит от build_component_library.py и других builder-скриптов —
helpers продублированы намеренно.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_spray.py

Выход:
  public/models/machine-modules/components/work_spray.glb

Геометрия (Blender Z-up, метры):
  ось потока = X (сопло смотрит в +X), линия y=0, z=Z0
  корпус — два скруглённых бокса (main + нос), картридж снизу-сзади,
  курок с рычагом и скобой снизу-спереди, шланг назад-вниз от быстросъёма.
  Вращения нет, анимации нет (паспорт: motion = none).
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
CID = 'work_spray'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.0395                       # высота оси потока

BODY_X0, BODY_X1 = -0.0190, 0.0055
BODY_HY, BODY_HZ = 0.0130, 0.0105  # полуширина по Y, полувысота по Z
NOSE_X0, NOSE_X1 = 0.0050, 0.0142  # ступенчатый нос корпуса
NOSE_HY, NOSE_HZ = 0.0106, 0.0088

X_ADP0, X_ADP1 = -0.0240, -0.0190  # задний переходник корпуса
X_QD0, X_QD1 = -0.0322, -0.0240    # гильза быстросъёма
X_QDC0, X_QDC1 = -0.0292, -0.0250  # накатная обойма быстросъёма

X_NB0, X_NB1 = 0.0140, 0.0198      # основание сопла
X_AR0, X_AR1 = 0.0150, 0.0192      # регулировочная накатка
X_SEAT0, X_SEAT1 = 0.0192, 0.0202  # латунное седло
X_TIP0, X_TIP1 = 0.0198, 0.0262    # силиконовый наконечник
X_F0, X_F1 = 0.0264, 0.0370        # конус факела
X_FC1 = 0.0340                     # внутреннее ядро потока

RES_X, RES_R = -0.0140, 0.0100     # картридж-резервуар (снизу-сзади)
RES_Z0, RES_Z1 = 0.0058, 0.0238
RES_SHOULDER_Z1 = 0.0290
RES_FLUID_Z1 = 0.0206

KNOB_X = -0.0040                   # ось игольчатого клапана (регулировка расхода)

# профиль курка в плоскости XZ: вогнутая накладка под палец, гиб 14 мм
TRIGGER_PROFILE = [
    (0.0048, 0.0246), (0.0062, 0.0200), (0.0080, 0.0154), (0.0098, 0.0126),
    (0.0118, 0.0122), (0.0128, 0.0142), (0.0122, 0.0186), (0.0106, 0.0218),
    (0.0082, 0.0250),
]

# клапанный блок с курком — снизу-спереди, под «носом»
VB_CX, VB_CZ = 0.0060, 0.0274
VB_SX, VB_SY, VB_SZ = 0.0110, 0.0166, 0.0104

PALETTE = {
    'ivory': (0.958, 0.950, 0.930),
    'steel': (0.712, 0.720, 0.724),
    'graphite': (0.286, 0.300, 0.320),
    'dark': (0.150, 0.158, 0.176),
    'brass': (0.790, 0.605, 0.240),
    'silicone': (0.968, 0.964, 0.955),
    'cartridge': (0.930, 0.955, 0.945),
    'fluid': (0.055, 0.430, 0.545),
    'cyan': (0.290, 0.855, 0.900),
    'flow': (0.420, 0.865, 0.935),
}
MATS = {}


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def _blended(m, alpha):
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
    rough = {'ivory': 0.60, 'steel': 0.44, 'graphite': 0.56, 'dark': 0.52,
             'brass': 0.32, 'silicone': 0.84, 'cartridge': 0.42,
             'fluid': 0.20, 'cyan': 0.38, 'flow': 0.28}[role]
    metal = {'ivory': 0.0, 'steel': 0.82, 'graphite': 0.22, 'dark': 0.28,
             'brass': 0.94, 'silicone': 0.0, 'cartridge': 0.0,
             'fluid': 0.0, 'cyan': 0.0, 'flow': 0.0}[role]
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal

    alpha = 1.0
    if role == 'cartridge':                      # молочная стенка картриджа
        alpha = 0.55
        bsdf.inputs['Alpha'].default_value = alpha
        bsdf.inputs['IOR'].default_value = 1.08
        bsdf.inputs['Subsurface Weight'].default_value = 0.0
        _blended(m, alpha)
    elif role == 'fluid':                        # состав внутри картриджа
        alpha = 1.0
        bsdf.inputs['Alpha'].default_value = alpha
        bsdf.inputs['Emission Color'].default_value = (0.30, 0.90, 1.0, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.26
        _blended(m, alpha)
    elif role == 'flow':                         # объём факела, не твёрдая деталь
        alpha = 0.25
        bsdf.inputs['Alpha'].default_value = alpha
        bsdf.inputs['IOR'].default_value = 1.0
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.34
        _blended(m, alpha)
    elif role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.10

    m.diffuse_color = (*color, alpha if role in ('cartridge', 'fluid', 'flow') else 1.0)
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
        select_only(obj)
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


def blade(name, a, b, width, thick, role, r=0.0012, smooth=False):
    """Плоская лопатка/рычаг из точки a в точку b (толщина по X, ширина по Y)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (thick, width, d.length)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if r > 0:
        select_only(obj)
        bevel(obj, r, 2)
    return apply(obj, role, smooth)


def prism(name, profile_xz, y_half, role, bev=0.0010):
    """Тело вращения-нет: профиль в плоскости XZ, выдавленный по Y."""
    bm = bmesh.new()
    a = [bm.verts.new((x, -y_half, z)) for x, z in profile_xz]
    b = [bm.verts.new((x, y_half, z)) for x, z in profile_xz]
    n = len(profile_xz)
    bm.faces.new(a)
    bm.faces.new(tuple(reversed(b)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = mesh_from_bm(name, bm, role, smooth=False)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, 2)
    return obj


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=44, rings=10):
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def ring_ribs(name, x0, x1, r_base, n, role, y=0.0, z=Z0, rib=0.0006):
    """Накатка: n тонких рёбер по окружности вокруг оси X, один меш."""
    bm = bmesh.new()
    xm = (x0 + x1) * 0.5
    for i in range(n):
        a = math.tau * i / n
        cy = y + math.sin(a) * r_base
        cz = z + math.cos(a) * r_base
        m = (Matrix.Translation((xm, cy, cz))
             @ Matrix.Rotation(math.pi / 2 - a, 4, 'X')
             @ Matrix.Diagonal((x1 - x0, rib * 2.0, rib * 3.4, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return mesh_from_bm(name, bm, role, smooth=False)


def knob_ribs(name, cx, cy, z0, z1, r_base, n, role, rib=0.0006):
    """Накатка на цилиндре с осью Z (головка регулировки)."""
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


def cone_shell(name, x0, x1, r0, r1, role, seg=40, y=0.0, z=Z0):
    """Открытая оболочка конуса (без торцов) — объём факела, не деталь."""
    bm = bmesh.new()
    ring0, ring1 = [], []
    for i in range(seg):
        a = math.tau * i / seg
        dy, dz = math.sin(a), math.cos(a)
        ring0.append(bm.verts.new((x0, y + dy * r0, z + dz * r0)))
        ring1.append(bm.verts.new((x1, y + dy * r1, z + dz * r1)))
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm, role, smooth=True)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    objs = []

    def add(o, role_tag):
        o['component'] = CID
        o['part'] = role_tag
        objs.append(o)
        return o

    # ---- корпус: основной блок + ступенчатый нос ------------------------
    add(cube(PREFIX + 'body',
             ((BODY_X0 + BODY_X1) * 0.5, 0.0, Z0),
             (BODY_X1 - BODY_X0, BODY_HY * 2, BODY_HZ * 2),
             'ivory', r=0.0044), 'shell')
    add(cube(PREFIX + 'body_nose',
             ((NOSE_X0 + NOSE_X1) * 0.5, 0.0, Z0),
             (NOSE_X1 - NOSE_X0, NOSE_HY * 2, NOSE_HZ * 2),
             'ivory', r=0.0034), 'shell')
    # боковая панель-табличка с меткой расхода (бирюзовая полоса + риски)
    for tag, sy in (('l', -1.0), ('r', 1.0)):
        add(cube(PREFIX + f'side_plate_{tag}',
                 (-0.0064, sy * 0.0131, 0.0416),
                 (0.0128, 0.0008, 0.0092), 'graphite', r=0.0009), 'shell')
        add(cube(PREFIX + f'side_mark_{tag}',
                 (-0.0066, sy * 0.0134, 0.0446),
                 (0.0078, 0.0005, 0.0015), 'cyan', r=0.0003), 'mark')

    # ---- клапанный блок с курком снизу-спереди --------------------------
    add(cube(PREFIX + 'valve_block', (VB_CX, 0.0, VB_CZ),
             (VB_SX, VB_SY, VB_SZ), 'graphite', r=0.0024), 'valve')
    add(cyl(PREFIX + 'trigger_pin', (0.0060, -0.0087, 0.0262),
            (0.0060, 0.0087, 0.0262), 0.0026, 'steel', vertices=24,
            bev=0.0004), 'trigger')
    # курок — один гнутый профиль (вогнутая накладка под палец), не набор боксов
    add(prism(PREFIX + 'trigger', TRIGGER_PROFILE, 0.0052, 'dark',
              bev=0.0009), 'trigger')

    # ---- быстросъёмный разъём сзади ------------------------------------
    add(cyl(PREFIX + 'rear_adapter', (X_ADP0, 0, Z0), (X_ADP1, 0, Z0), 0.0078,
            'graphite', vertices=32, bev=0.0012), 'mount')
    add(cyl(PREFIX + 'qd_sleeve', (X_QD0, 0, Z0), (X_QD1, 0, Z0), 0.0082,
            'steel', vertices=40, bev=0.0010), 'mount')
    add(cyl(PREFIX + 'qd_collar', (X_QDC0, 0, Z0), (X_QDC1, 0, Z0), 0.0090,
            'steel', vertices=40), 'mount')
    for i, gx in enumerate((-0.0287, -0.0275, -0.0263)):
        add(torus(PREFIX + f'qd_groove_{i}', (gx, 0, Z0), 0.0089, 0.0005,
                  'dark', 'X', segs=36, rings=8), 'mount')
    add(torus(PREFIX + 'qd_seal', (-0.0241, 0, Z0), 0.0081, 0.0011,
              'dark', 'X'), 'mount')
    # замок-усик сбоку обоймы (нажимается большим пальцем)
    add(cube(PREFIX + 'qd_latch', (-0.0271, 0.0, Z0 + 0.0096),
             (0.0056, 0.0104, 0.0038), 'graphite', r=0.0012), 'mount')

    # ---- короткий шланг назад-вниз --------------------------------------
    HOSE_PTS = [(-0.0316, 0.0000, Z0),
                (-0.0352, 0.0012, 0.0344),
                (-0.0372, 0.0040, 0.0278),
                (-0.0374, 0.0070, 0.0216)]
    add(curve_tube(PREFIX + 'hose', HOSE_PTS, 0.0031, 'dark'), 'hose')
    hv = (Vector(HOSE_PTS[-1]) - Vector(HOSE_PTS[-2])).normalized()
    end = Vector(HOSE_PTS[-1])
    add(cyl(PREFIX + 'hose_ferrule', (-0.0336, 0.0, Z0), (-0.0314, 0.0, Z0), 0.0042,
            'steel', vertices=24, bev=0.0006), 'hose')
    add(cyl(PREFIX + 'hose_plug', end + hv * 0.0012, end + hv * 0.0078,
            0.0039, 'steel', vertices=22, bev=0.0008), 'hose')

    # ---- сопло: основание, накатка, седло, наконечник -------------------
    add(cyl(PREFIX + 'nozzle_base', (X_NB0, 0, Z0), (X_NB1, 0, Z0), 0.0082,
            'graphite', vertices=36, bev=0.0014), 'nozzle')
    add(cyl(PREFIX + 'adjust_ring', (X_AR0, 0, Z0), (X_AR1, 0, Z0), 0.0090,
            'steel', vertices=40), 'nozzle')
    add(ring_ribs(PREFIX + 'adjust_knurl', X_AR0 + 0.0006, X_AR1 - 0.0006,
                  0.0091, 20, 'steel', rib=0.0005), 'nozzle')
    add(torus(PREFIX + 'adjust_mark', (0.0171, 0, Z0), 0.0091, 0.0009,
              'cyan', 'X'), 'nozzle')
    add(cyl(PREFIX + 'seat', (X_SEAT0, 0, Z0), (X_SEAT1, 0, Z0), 0.0070,
            'brass', vertices=32, bev=0.0004), 'nozzle')
    add(cyl(PREFIX + 'tip', (X_TIP0, 0, Z0), (X_TIP1, 0, Z0), 0.0066,
            'silicone', vertices=36, r2=0.0031), 'nozzle')
    add(cyl(PREFIX + 'tip_bore', (0.0254, 0, Z0), (X_F0, 0, Z0), 0.0021,
            'dark', vertices=20), 'nozzle')

    # ---- регулировка расхода: игольчатый клапан сверху ------------------
    add(cyl(PREFIX + 'knob_boss', (KNOB_X, 0, 0.0492), (KNOB_X, 0, 0.0516), 0.0060,
            'graphite', vertices=28, bev=0.0009), 'knob')
    add(cyl(PREFIX + 'knob', (KNOB_X, 0, 0.0514), (KNOB_X, 0, 0.0568), 0.0072,
            'steel', vertices=32, bev=0.0009), 'knob')
    add(knob_ribs(PREFIX + 'knob_knurl', KNOB_X, 0.0, 0.0522, 0.0560, 0.0072,
                  18, 'steel', rib=0.00055), 'knob')
    add(cyl(PREFIX + 'knob_mark', (KNOB_X, 0, 0.0566), (KNOB_X, 0, 0.0574), 0.0042,
            'cyan', vertices=24, bev=0.0003), 'knob')

    # ---- картридж-резервуар снизу-сзади --------------------------------
    add(cyl(PREFIX + 'reservoir_shell', (RES_X, 0, RES_Z0), (RES_X, 0, RES_Z1),
            RES_R, 'cartridge', vertices=44), 'reservoir')
    add(cyl(PREFIX + 'reservoir_shoulder', (RES_X, 0, RES_Z1),
            (RES_X, 0, RES_SHOULDER_Z1), RES_R, 'cartridge', vertices=44,
            r2=0.0058), 'reservoir')
    add(cyl(PREFIX + 'reservoir_bottom', (RES_X, 0, 0.0044), (RES_X, 0, 0.0060),
            RES_R + 0.0004, 'steel', vertices=44, bev=0.0006), 'reservoir')
    add(cyl(PREFIX + 'reservoir_collar', (RES_X, 0, 0.0282), (RES_X, 0, 0.0308),
            0.0060, 'steel', vertices=28, bev=0.0007), 'reservoir')
    add(cyl(PREFIX + 'reservoir_fluid', (RES_X, 0, RES_Z0 + 0.0006),
            (RES_X, 0, RES_FLUID_Z1), RES_R - 0.0014, 'fluid', vertices=40),
        'reservoir')

    # ---- конус факела у сопла (полупрозрачный, не деталь) --------------
    add(cone_shell(PREFIX + 'flow_cone', X_F0, X_F1, 0.0026, 0.0110, 'flow'), 'flow')

    # ---- индикатор на носу ---------------------------------------------
    add(cyl(PREFIX + 'led_bezel', (0.0108, 0.0, 0.0466), (0.0108, 0.0, 0.0481),
            0.0028, 'graphite', vertices=18), 'mark')
    add(sphere(PREFIX + 'led', (0.0108, 0.0, 0.0479), 0.0017, 'cyan'), 'mark')

    # --- теги для рендера/логики ---
    for o in objs:
        if o['part'] == 'flow':
            o['flow'] = True
            o['alpha'] = 0.25
        else:
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

    LIM = (0.080, 0.060, 0.060)      # паспорт: 0,08 × 0,06 × 0,06 м
    bbox_ok = all(size[i] <= LIM[i] + 1e-4 for i in range(3))
    mats = sorted(m.name for m in bpy.data.materials if m.users)

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'parts': sorted(o.name[len(PREFIX):] for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'device_size': [round(v, 5) for v in d_size],
        'flow_extent_x': [round(f_mn.x, 5), round(f_mx.x, 5)],
        'passport_limit': list(LIM),
        'bbox_ok': bool(bbox_ok),
        'materials': mats,
        'materials_ok': bool(len(mats) >= 4),
        'tris': sum(len(o.data.loop_triangles) for o in all_mesh),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'below_floor': sorted(o.name for o in all_mesh
                              if min((o.matrix_world @ Vector(c)).z
                                     for c in o.bound_box) < -1e-6),
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
    if not rep['bbox_ok'] or not rep['materials_ok'] or rep['bad_names']:
        raise SystemExit('checks failed')


main()
