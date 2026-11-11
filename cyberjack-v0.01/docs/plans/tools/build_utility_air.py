"""Standalone builder: utility_air (UTL-AIR-03, «Воздух»).

Компактный блок воздухоподготовки (FRL) на доке/стене:
слева — фильтр-влагоотделитель: графитовый корпус с боковым вводом,
прозрачная (молочная) колба с видимым фильтроэлементом и конденсатом,
сливной кран; сверху — молочная голова регулятора с резьбовой втулкой,
стопорной гайкой и маховиком; на лицевой стороне — манометр (белая шкала,
красная зона 6–8 бар, стрелка).
Справа — распределительный манифолд: 4 быстросъёма (хромированные
муфты, тёмные накидные кольца, циановые метки, пылевые заглушки),
предохранительный клапан на торце, ввод воздуха из дока.
Четвёртый быстросъём занят шлангом. Сзади — док-плита с направляющими
штифтами и разъёмом дока, стойки-кронштейны.

Плиты-основания нет. Вращения нет (motion: none), анимационная пустышка
не нужна. Не зависит от build_component_library.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_utility_air.py

Выход:
  public/models/machine-modules/components/utility_air.glb
  docs/plans/blockout/component-library/utility_air/*.png
  docs/plans/blockout/component-library/utility_air/report.json

Геометрия (Blender Z-up, метры):
  габарит по паспорту 0,20 x 0,15 x 0,10 м
    X: -0.100 .. +0.099  (ширина)
    Y: -0.076 .. +0.074  (глубина, перед = -Y, док = +Y)
    Z:  0.000 .. +0.100  (высота, низ = сливной кран)
  FRL: ось x=-0.057, корпус z 0.047..0.077, колба z 0.008..0.0435,
       голова z 0.076..0.086, маховик до z 0.100, манометр z 0.0465..0.0815
  манифолд: x -0.006..0.080, z 0.030..0.079, 4 выхода по фронту (-Y)
  док-плита: y 0.040..0.056, штифты до y 0.074
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/utility_air'
CID = 'utility_air'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- габарит / ключевые размеры (м) -------------------------------------
FX = -0.057                        # ось FRL-узла (X)
BODY_Z0, BODY_Z1, BODY_R = 0.047, 0.077, 0.0288
HEAD_X0, HEAD_X1 = -0.100, -0.028
HEAD_Z0, HEAD_Z1 = 0.076, 0.086
COLLAR_Z0, COLLAR_Z1, COLLAR_R = 0.0420, 0.0494, 0.0262
BOWL_Z0, BOWL_Z1, BOWL_R = 0.008, 0.0435, 0.0222
DRAIN_Z0, DRAIN_Z1 = 0.000, 0.0115

MX0, MX1 = -0.006, 0.080            # манифолд
MY0, MY1 = -0.030, 0.030
MZ0, MZ1 = 0.030, 0.074
PANEL_Y = -0.0325                   # лицо панели выходов
COUPLER_X = (0.008, 0.026, 0.044, 0.062)
COUPLER_Z = 0.050
COUPLER_TIP = -0.0725

DOCK_Y0, DOCK_Y1 = 0.040, 0.056
PIN_Y1 = 0.0740

GWX, GZ = -0.050, 0.064             # манометр
G_R = 0.0175

PALETTE = {
    'graphite': (0.168, 0.180, 0.196),   # корпус FRL, манифолд, док
    'milk': (0.930, 0.925, 0.900),       # голова, панель выходов, колба-опацит
    'steel': (0.690, 0.706, 0.716),      # фитинги, муфты, шкала
    'dark': (0.042, 0.046, 0.052),       # маховик, шланг, кольца, шкала-фон
    'glass': (0.740, 0.860, 0.880),      # колба
    'water': (0.080, 0.330, 0.380),      # конденсат
    'cyan': (0.030, 0.330, 0.480),       # метка/кольца быстросъёмов
    'red': (0.640, 0.060, 0.050),        # клапан, зона/стрелка манометра
    'dial': (0.955, 0.950, 0.925),       # циферблат
}
ALPHA = {'glass': 0.24, 'water': 0.78}
ROUGH = {
    'graphite': 0.44, 'milk': 0.38, 'steel': 0.30, 'dark': 0.56,
    'glass': 0.06, 'water': 0.05, 'cyan': 0.36, 'red': 0.40, 'dial': 0.50,
}
MATS = {}
FONT = None


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
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = 0.88 if role == 'steel' else (
        0.32 if role == 'graphite' else 0.0)
    if role in ALPHA:
        bsdf.inputs['Alpha'].default_value = ALPHA[role]
        for attr, val in (('blend_method', 'BLEND'),
                          ('surface_render_method', 'BLENDED'),
                          ('shadow_method', 'HASHED')):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
        m.use_backface_culling = False
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.0
    m.diffuse_color = (*color, ALPHA.get(role, 1.0))
    MATS[role] = m
    return m


def apply(obj, role):
    obj.data.materials.append(mat(role))
    return obj


def shade(obj, angle=35.0):
    if obj.type != 'MESH':
        return obj
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for f in bm.faces:
        f.smooth = True
    lim = math.radians(angle)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0.0) < lim
        else:
            e.smooth = False
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def bevel(obj, width=0.0015, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), seg=2, sharp=35.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    r = min(r, min(size) * 0.34)
    if r > 0.00015:
        bevel(obj, r, seg)
    apply(obj, role)
    return shade(obj, sharp)


def box(name, x0, x1, y0, y1, z0, z1, role, r=0.0010, seg=2, sharp=35.0):
    return cube(name, ((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5),
                (x1 - x0, y1 - y0, z1 - z0), role, r=r, seg=seg, sharp=sharp)


def cyl(name, a, b, radius, role, vertices=32, r2=None, bev=0.0, sharp=35.0):
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
        select_only(obj)
        bevel(obj, bev, 2)
    apply(obj, role)
    return shade(obj, sharp)


def torus(name, loc, major, minor, role, axis='Z', segs=48, rings=10):
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
    apply(obj, role)
    return shade(obj, 50.0)


def curve_tube(name, points, radius, role, res=5):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 16
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
    obj = bpy.context.object
    obj.name = name
    return shade(obj, 50.0)


def mesh_from_bm(name, bm, role, smooth_angle=35.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    return shade(obj, smooth_angle)


def bm_box(bm, loc, size, rotz=0.0):
    m = (Matrix.Translation(Vector(loc))
         @ Matrix.Rotation(rotz, 4, 'Z')
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_cyl(bm, a, b, r1, r2=None, segs=20):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r1 if r2 is None else r2,
                          depth=d.length, matrix=m)


def bm_knurl_z(bm, cx, cy, z0, z1, r, count, thick=0.0011, wide=0.0022):
    """Продольные насечки вокруг оси Z (маховик, накидные гайки)."""
    h = z1 - z0
    for i in range(count):
        a = math.tau * i / count
        bm_box(bm, (cx + r * math.cos(a), cy + r * math.sin(a), (z0 + z1) * 0.5),
               (thick, wide, h), rotz=a)


def bm_knurl_y(bm, cx, y0, y1, cz, r, count, thick=0.0009, wide=0.0022):
    """Насечки вокруг оси Y: X-ось бруска должна смотреть радиально."""
    h = y1 - y0
    for i in range(count):
        a = math.tau * i / count
        m = (Matrix.Translation(Vector((cx + r * math.cos(a), (y0 + y1) * 0.5,
                                        cz + r * math.sin(a))))
             @ Matrix.Rotation(-a, 4, 'Y')
             @ Matrix.Diagonal((thick, h, wide, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0), extrude=0.0004):
    global FONT
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    cu.resolution_u = 5
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
    return shade(obj, 25.0)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ================= док-плита (крепление стена/док) =================
    add(box(PREFIX + 'dock_plate', -0.086, 0.086, DOCK_Y0, DOCK_Y1,
            0.010, 0.0785, 'graphite', r=0.0045, seg=3))
    add(box(PREFIX + 'dock_plate_recess', -0.080, 0.080, DOCK_Y0 - 0.0016,
            DOCK_Y0, 0.016, 0.0730, 'graphite', r=0.0016))
    bm = bmesh.new()
    for sx in (-0.078, 0.078):
        for z in (0.019, 0.075):
            bm_cyl(bm, (sx, DOCK_Y0 - 0.0014, z), (sx, DOCK_Y0 - 0.0048, z),
                   0.0044, segs=20)
    add(mesh_from_bm(PREFIX + 'dock_screws', bm, 'steel', 40.0))
    # направляющие штифты дока (+Y, входят в приёмник станции)
    bm = bmesh.new()
    for sx in (-0.062, 0.062):
        bm_cyl(bm, (sx, DOCK_Y1, 0.062), (sx, PIN_Y1, 0.062), 0.0072, segs=24)
        bm_cyl(bm, (sx, PIN_Y1 - 0.0038, 0.062), (sx, PIN_Y1 - 0.0002, 0.062),
               0.0058, segs=24)
    add(mesh_from_bm(PREFIX + 'dock_pins', bm, 'steel', 42.0))
    bm = bmesh.new()
    for sx in (-0.062, 0.062):
        bm_cyl(bm, (sx, 0.0608, 0.062), (sx, 0.0630, 0.062), 0.0078, segs=24)
    add(mesh_from_bm(PREFIX + 'dock_pin_rings', bm, 'dark', 42.0))
    # разъём дока (ответная часть станции)
    add(box(PREFIX + 'dock_socket', -0.026, 0.026, DOCK_Y1, DOCK_Y1 + 0.0135,
            0.028, 0.052, 'dark', r=0.0040, seg=3))
    add(box(PREFIX + 'dock_socket_plate', -0.020, 0.020, DOCK_Y1 + 0.0124,
            DOCK_Y1 + 0.0148, 0.031, 0.049, 'steel', r=0.0022))
    bm = bmesh.new()
    for dx in (-0.011, 0.011):
        for dz in (0.036, 0.044):
            bm_cyl(bm, (dx, DOCK_Y1 + 0.0148, dz), (dx, DOCK_Y1 + 0.0170, dz),
                   0.0024, segs=12)
    add(mesh_from_bm(PREFIX + 'dock_contacts', bm, 'cyan', 42.0))

    # стойки-кронштейны: корпус -> плита
    add(box(PREFIX + 'bracket_frl', -0.082, -0.032, 0.0262, DOCK_Y0,
            BODY_Z0 + 0.002, BODY_Z1 - 0.001, 'graphite', r=0.0030, seg=3))
    add(box(PREFIX + 'bracket_manifold', 0.006, 0.072, MY1, DOCK_Y0,
            MZ0 - 0.002, 0.048, 'graphite', r=0.0030, seg=3))

    # мост FRL -> манифолд (закрывает зазор, несёт поток)
    add(box(PREFIX + 'bridge', -0.030, MX0 + 0.002, -0.021, 0.021,
            BODY_Z0 + 0.001, 0.078, 'graphite', r=0.0040, seg=3))
    add(cyl(PREFIX + 'bridge_union', (-0.020, 0.0, 0.062),
            (-0.004, 0.0, 0.062), 0.0125, 'steel', vertices=6))
    add(box(PREFIX + 'bridge_web', -0.033, -0.002, -0.013, 0.013, 0.028,
            0.052, 'graphite', r=0.0035, seg=3))

    # ================= FRL: корпус / колба / слив =======================
    add(cyl(PREFIX + 'body', (FX, 0.0, BODY_Z0), (FX, 0.0, BODY_Z1), BODY_R,
            'graphite', vertices=44, bev=0.0025))
    add(cyl(PREFIX + 'body_mark', (FX, 0.0, 0.0692), (FX, 0.0, 0.0722),
            BODY_R + 0.0008, 'cyan', vertices=44))
    # боковой ввод воздуха (слева)
    add(cyl(PREFIX + 'port_in', (FX - 0.0140, 0.0, 0.0625),
            (FX - 0.0372, 0.0, 0.0625), 0.0074, 'steel', vertices=24,
            bev=0.0008))
    add(cyl(PREFIX + 'port_in_nut', (FX - 0.0300, 0.0, 0.0625),
            (FX - 0.0368, 0.0, 0.0625), 0.0104, 'steel', vertices=6))
    add(torus(PREFIX + 'port_in_ring', (FX - 0.0334, 0.0, 0.0625), 0.0078,
              0.0012, 'dark', axis='X', segs=20, rings=6))

    # горловина + накидная гайка колбы
    add(cyl(PREFIX + 'bowl_collar', (FX, 0.0, COLLAR_Z0), (FX, 0.0, COLLAR_Z1),
            COLLAR_R, 'steel', vertices=40, bev=0.0012))
    bm = bmesh.new()
    bm_knurl_z(bm, FX, 0.0, COLLAR_Z0 + 0.0012, COLLAR_Z1 - 0.0006,
               COLLAR_R, 26, 0.0014, 0.0028)
    add(mesh_from_bm(PREFIX + 'bowl_collar_knurl', bm, 'steel', 42.0))

    # прозрачная (молочная) колба влагоотделителя
    add(cyl(PREFIX + 'bowl', (FX, 0.0, BOWL_Z0 + 0.004), (FX, 0.0, BOWL_Z1),
            BOWL_R, 'glass', vertices=44, r2=BOWL_R + 0.0008, sharp=45.0))
    add(cyl(PREFIX + 'bowl_bottom', (FX, 0.0, BOWL_Z0 - 0.0030),
            (FX, 0.0, BOWL_Z0 + 0.0050), BOWL_R + 0.0014, 'graphite',
            vertices=44, bev=0.0010))

    # фильтроэлемент внутри колбы (виден через стенку)
    add(cyl(PREFIX + 'filter_element', (FX, 0.0, 0.0208), (FX, 0.0, 0.0402),
            0.0158, 'milk', vertices=36, bev=0.0010))
    bm = bmesh.new()
    bm_knurl_z(bm, FX, 0.0, 0.0224, 0.0388, 0.0158, 16, 0.0024, 0.0026)
    add(mesh_from_bm(PREFIX + 'filter_ribs', bm, 'milk', 42.0))
    add(cyl(PREFIX + 'filter_cap', (FX, 0.0, 0.0394), (FX, 0.0, 0.0412),
            0.0168, 'steel', vertices=32, bev=0.0008))

    # конденсат на дне колбы
    add(cyl(PREFIX + 'condensate', (FX, 0.0, 0.0086), (FX, 0.0, 0.0206),
            BOWL_R - 0.0014, 'water', vertices=36))

    # сливной кран
    add(cyl(PREFIX + 'drain_body', (FX, 0.0, DRAIN_Z0 + 0.0012),
            (FX, 0.0, DRAIN_Z1 + 0.0016), 0.0088, 'dark', vertices=24,
            bev=0.0012))
    bm = bmesh.new()
    bm_knurl_z(bm, FX, 0.0, 0.0002, 0.0102, 0.0088, 14, 0.0016, 0.0028)
    add(mesh_from_bm(PREFIX + 'drain_knurl', bm, 'dark', 42.0))
    add(cyl(PREFIX + 'drain_spout', (FX, -0.0020, 0.0060),
            (FX, -0.0198, 0.0060), 0.0040, 'dark', vertices=18))
    add(cyl(PREFIX + 'drain_nozzle', (FX, -0.0194, 0.0060),
            (FX, -0.0238, 0.0060), 0.0046, 'steel', vertices=16, bev=0.0006))

    # ================= голова регулятора + маховик ======================
    add(box(PREFIX + 'head_collar', -0.090, -0.038, -0.027, 0.027,
            HEAD_Z0 - 0.0045, HEAD_Z0 + 0.0010, 'graphite', r=0.0035, seg=3))
    add(box(PREFIX + 'head', HEAD_X0, HEAD_X1, -0.024, 0.024, HEAD_Z0, HEAD_Z1,
            'milk', r=0.0100, seg=4))
    # шильдик на головке
    add(box(PREFIX + 'head_tag', -0.0880, -0.0700, -0.0252, -0.0240,
            HEAD_Z0 + 0.0030, HEAD_Z0 + 0.0072, 'cyan', r=0.0008))
    add(text(PREFIX + 'head_tag_text', 'AIR', 0.0034,
             (-0.0790, -0.0258, HEAD_Z0 + 0.0051), 'dark', extrude=0.0002))
    # резьбовая втулка + стопорная гайка + маховик
    add(cyl(PREFIX + 'knob_stem', (FX, 0.0, HEAD_Z1 - 0.0015),
            (FX, 0.0, 0.0912), 0.0088, 'steel', vertices=20))
    add(cyl(PREFIX + 'lock_nut', (FX, 0.0, 0.0868), (FX, 0.0, 0.0892),
            0.0128, 'steel', vertices=6))
    add(cyl(PREFIX + 'knob', (FX, 0.0, 0.0886), (FX, 0.0, 0.0982), 0.0160,
            'dark', vertices=36, bev=0.0020))
    bm = bmesh.new()
    bm_knurl_z(bm, FX, 0.0, 0.0898, 0.0966, 0.0160, 24, 0.0015, 0.0021)
    add(mesh_from_bm(PREFIX + 'knob_knurl', bm, 'dark', 42.0))
    add(cyl(PREFIX + 'knob_cap', (FX, 0.0, 0.0978), (FX, 0.0, 0.1000), 0.0112,
            'graphite', vertices=28, bev=0.0014))
    add(cyl(PREFIX + 'knob_mark', (FX + 0.0082, 0.0, 0.0984),
            (FX + 0.0082, 0.0, 0.0996), 0.0022, 'cyan', vertices=12))

    # ================= манометр (фронт FRL) =============================
    add(cyl(PREFIX + 'gauge_boss', (GWX, -0.0080, GZ), (GWX, -0.0292, GZ),
            0.0082, 'graphite', vertices=20))
    add(cyl(PREFIX + 'gauge_bezel', (GWX, -0.0290, GZ), (GWX, -0.0488, GZ),
            G_R, 'steel', vertices=40, bev=0.0014))
    add(cyl(PREFIX + 'gauge_rim', (GWX, -0.0486, GZ), (GWX, -0.0494, GZ),
            0.0158, 'dark', vertices=40))
    add(cyl(PREFIX + 'gauge_dial', (GWX, -0.0489, GZ), (GWX, -0.0497, GZ),
            0.0150, 'dial', vertices=40))
    bm = bmesh.new()
    for i in range(9):
        a = math.radians(-135.0 + i * 33.75)
        bm_cyl(bm, (GWX + 0.0126 * math.sin(a), -0.0495,
                    GZ + 0.0126 * math.cos(a)),
               (GWX + 0.0126 * math.sin(a), -0.0500,
                GZ + 0.0126 * math.cos(a)), 0.00055, segs=8)
    add(mesh_from_bm(PREFIX + 'gauge_ticks', bm, 'dark', 60.0))
    add(cube(PREFIX + 'gauge_zone',
             (GWX + 0.0107 * math.sin(math.radians(54.0)), -0.0498,
              GZ + 0.0107 * math.cos(math.radians(54.0))),
             (0.0022, 0.0007, 0.0034), 'red', r=0.0002,
             rot=(0, math.radians(-54.0), 0)))
    add(cube(PREFIX + 'gauge_needle',
             (GWX + 0.0038, -0.0502, GZ + 0.0036),
             (0.0012, 0.0007, 0.0114), 'red', r=0.0002,
             rot=(0, math.radians(24.0), 0)))
    add(cyl(PREFIX + 'gauge_hub', (GWX, -0.0496, GZ), (GWX, -0.0506, GZ),
            0.0024, 'dark', vertices=16))

    # ================= манифолд + быстросъёмы ===========================
    add(box(PREFIX + 'manifold', MX0, MX1, MY0, MY1, MZ0, MZ1, 'graphite',
            r=0.0045, seg=3))
    add(box(PREFIX + 'manifold_top', MX0 + 0.004, MX1 - 0.004, MY0 + 0.004,
            MY1 - 0.004, MZ1, MZ1 + 0.0050, 'milk', r=0.0038, seg=3))
    add(box(PREFIX + 'manifold_end', MX1, MX1 + 0.0065, MY0 - 0.003,
            MY1 + 0.003, MZ0 - 0.003, MZ1 + 0.003, 'graphite', r=0.0030,
            seg=3))
    add(box(PREFIX + 'manifold_panel', MX0 + 0.002, MX1 - 0.002, PANEL_Y,
            MY0, MZ0 + 0.002, MZ1 - 0.002, 'milk', r=0.0024, seg=3))
    add(box(PREFIX + 'manifold_foot', MX0 + 0.002, MX1 - 0.002, MY0 + 0.004,
            MY1 - 0.004, MZ0 - 0.0055, MZ0, 'graphite', r=0.0024, seg=3))

    # ввод воздуха из дока в манифолд
    add(cyl(PREFIX + 'inlet_pipe', (0.036, MY1, 0.0640),
            (0.036, DOCK_Y0 + 0.002, 0.0640), 0.0076, 'steel', vertices=24))
    add(cyl(PREFIX + 'inlet_nut', (0.036, 0.0326, 0.0640),
            (0.036, 0.0400, 0.0640), 0.0104, 'steel', vertices=6))
    add(torus(PREFIX + 'inlet_oring', (0.036, 0.0303, 0.0640), 0.0078, 0.0012,
              'dark', axis='Y', segs=24, rings=6))

    # 4 быстросъёма по фронту
    bm_boss, bm_sleeve = bmesh.new(), bmesh.new()
    bm_collar, bm_cyan, bm_tip, bm_cap = (bmesh.new(), bmesh.new(),
                                         bmesh.new(), bmesh.new())
    for i, cx in enumerate(COUPLER_X):
        bm_cyl(bm_boss, (cx, PANEL_Y, COUPLER_Z), (cx, PANEL_Y - 0.0064, COUPLER_Z),
               0.0098, segs=6)
        bm_cyl(bm_sleeve, (cx, PANEL_Y - 0.0060, COUPLER_Z),
               (cx, PANEL_Y - 0.0226, COUPLER_Z), 0.0070, segs=24)
        bm_cyl(bm_collar, (cx, PANEL_Y - 0.0165, COUPLER_Z),
               (cx, PANEL_Y - 0.0245, COUPLER_Z), 0.0084, segs=24)
        bm_cyl(bm_cyan, (cx, PANEL_Y - 0.0250, COUPLER_Z),
               (cx, PANEL_Y - 0.0266, COUPLER_Z), 0.0072, segs=24)
        if i == 3:
            bm_cyl(bm_tip, (cx, PANEL_Y - 0.0267, COUPLER_Z),
                   (cx, PANEL_Y - 0.0396, COUPLER_Z), 0.0054, r2=0.0048,
                   segs=20)
            bm_cyl(bm_tip, (cx, PANEL_Y - 0.0396, COUPLER_Z),
                   (cx, PANEL_Y - 0.0378, COUPLER_Z), 0.0064, segs=20)
        else:
            bm_cyl(bm_tip, (cx, PANEL_Y - 0.0267, COUPLER_Z),
                   (cx, PANEL_Y - 0.0345, COUPLER_Z), 0.0054, r2=0.0050,
                   segs=20)
            bm_cyl(bm_cap, (cx, PANEL_Y - 0.0343, COUPLER_Z),
                   (cx, COUPLER_TIP, COUPLER_Z), 0.0052, segs=20)
    add(mesh_from_bm(PREFIX + 'coupler_bosses', bm_boss, 'steel', 42.0))
    add(mesh_from_bm(PREFIX + 'coupler_sleeves', bm_sleeve, 'steel', 42.0))
    add(mesh_from_bm(PREFIX + 'coupler_cyan_rings', bm_cyan, 'cyan', 42.0))
    add(mesh_from_bm(PREFIX + 'coupler_tips', bm_tip, 'steel', 42.0))
    add(mesh_from_bm(PREFIX + 'coupler_caps', bm_cap, 'dark', 42.0))
    bm = bmesh.new()
    for cx in COUPLER_X:
        bm_knurl_y(bm, cx, PANEL_Y - 0.0242, PANEL_Y - 0.0168, COUPLER_Z,
                   0.0084, 18, 0.0007, 0.0016)
    add(mesh_from_bm(PREFIX + 'coupler_collar_knurl', bm, 'dark', 42.0))
    # метки выходов (риски над муфтами)
    bm = bmesh.new()
    for cx in COUPLER_X:
        bm_box(bm, (cx, PANEL_Y - 0.0006, 0.0422), (0.0030, 0.0012, 0.0016))
    add(mesh_from_bm(PREFIX + 'coupler_marks', bm, 'cyan', 25.0))

    # ================= предохранительный клапан ========================
    add(cyl(PREFIX + 'relief_body', (MX1 + 0.0055, 0.0030, 0.0560),
            (MX1 + 0.0128, 0.0030, 0.0560), 0.0078, 'steel', vertices=24,
            bev=0.0010))
    bm = bmesh.new()
    bm_cyl(bm, (MX1 + 0.0126, 0.0030, 0.0560),
           (MX1 + 0.0156, 0.0030, 0.0560), 0.0088, segs=20)
    add(mesh_from_bm(PREFIX + 'relief_ring', bm, 'dark', 42.0))
    add(cyl(PREFIX + 'relief_cap', (MX1 + 0.0154, 0.0030, 0.0560),
            (MX1 + 0.0185, 0.0030, 0.0560), 0.0062, 'red', vertices=20,
            bev=0.0012))

    # ================= маркировка 6–8 бар ===============================
    add(box(PREFIX + 'label_plate', MX0 + 0.004, MX1 - 0.004, PANEL_Y - 0.0020,
            PANEL_Y, 0.0602, 0.0714, 'dark', r=0.0010))
    add(text(PREFIX + 'label_text', '6–8 бар', 0.0060,
             (0.0360, PANEL_Y - 0.0026, 0.0658), 'milk'))

    # ================= шланг на 4-м выходе ==============================
    hx = COUPLER_X[3]
    add(curve_tube(PREFIX + 'hose', [
        (hx, PANEL_Y - 0.0392, COUPLER_Z),
        (hx, PANEL_Y - 0.0398, 0.0392),
        (hx - 0.0050, PANEL_Y - 0.0394, 0.0255),
        (hx - 0.0162, PANEL_Y - 0.0352, 0.0128),
        (hx - 0.0288, PANEL_Y - 0.0284, 0.0068),
        (hx - 0.0376, PANEL_Y - 0.0216, 0.0070),
    ], 0.0052, 'dark'))
    add(cyl(PREFIX + 'hose_clamp', (hx, PANEL_Y - 0.0414, COUPLER_Z),
            (hx, PANEL_Y - 0.0362, COUPLER_Z), 0.0062, 'steel', vertices=20,
            bev=0.0008))
    add(cyl(PREFIX + 'hose_ferrule', (hx - 0.0408, PANEL_Y - 0.0188, 0.0070),
            (hx - 0.0368, PANEL_Y - 0.0244, 0.0070), 0.0058, 'steel',
            vertices=18, bev=0.0006))

    # ---- extras / имена ------------------------------------------------
    for o in parts:
        o['component'] = CID
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').split('_')[0]

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
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    tol = 0.006
    passport = (0.20, 0.15, 0.10)
    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(passport),
        'bbox_delta': [round(size[i] - passport[i], 5) for i in range(3)],
        'bbox_ok': bool(all(abs(size[i] - passport[i]) <= tol for i in range(3))),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
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
    scene.view_settings.exposure = 0.25
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.60

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.620, 0.614, 0.602, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.62, -0.74, 0.66), 15.0, 0.55),
            ('fill', (-0.78, -0.52, 0.36), 7.5, 0.75),
            ('rim', (0.08, 0.72, 0.58), 9.0, 0.60)):
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
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), \
            Vector(direction).normalized()

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
    close_t = Vector((-0.010, -0.052, 0.056))
    c_close = box_corners(Vector((-0.078, -0.078, 0.028)) - close_t,
                          Vector((0.070, -0.022, 0.086)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(objs=None):
        worst = 0.0
        for o in (objs if objs is not None else mesh_objs):
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    near = [o for o in mesh_objs if any(k in o.name for k in (
        'coupler', 'gauge', 'bowl', 'filter', 'label', 'manifold', 'hose',
        'knob', 'head', 'port_in'))]

    views = [
        ('3q', (0.66, -1.00, 0.34), center + Vector((0, 0, 0.002)), 72, c_main,
         0.88, mesh_objs),
        ('front', (0.0, -1.0, 0.10), center, 72, c_main, 0.90, mesh_objs),
        ('side', (-1.0, -0.42, 0.12), center + Vector((0, 0, 0.002)), 72,
         c_main, 0.88, mesh_objs),
        ('closeup', (0.30, -1.00, 0.26), close_t, 85, c_close, 0.95, near),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, objs in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4):
            got = max_ndc(objs)
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
        print(f'RENDERED {tag} fill={max_ndc(objs):.3f} {fp}', flush=True)
    return outs


def main():
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
