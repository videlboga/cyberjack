"""Standalone builder: service_cleaner (SRV-CLEAN-02, «Мойка»).

Компактная сервисная мойка на цоколе: молочный корпус, рабочая плита с
ванной-баком (~60 л) и приподнятым бортиком из нерж., бирюзовый слив с
решёткой, портал с тремя форсунками над ванной, стеновая струйная
форсунка и заливной патрубок в ванне, пульт с LED-индикацией и кнопками,
дозирующий бак с крышкой, быстросъём со шлангом, задний ввод/вывод
(вода, слив, 230 В), сервисная ниша с насосом, фильтром и сифоном,
поддон под слив.

Плиты-основания нет. Вращения нет (motion: none), анимационная пустышка
не нужна. Не зависит от build_component_library.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_service_cleaner.py

Выход:
  public/models/machine-modules/components/service_cleaner.glb
  docs/plans/blockout/component-library/service_cleaner/*.png
  docs/plans/blockout/component-library/service_cleaner/report.json

Геометрия (Blender Z-up, метры):
  габарит по паспорту 0,80 x 0,60 x 0,60 м
    X: -0.400 .. +0.400  (ширина: плита и борта)
    Y: -0.300 .. +0.300  (глубина, перед = -Y, зад = +Y)
    Z:  0.000 .. +0.600  (высота, верх = труба портала)
  ванна:      X -0.346..-0.014, Y -0.231..0.136, дно 0.292, борт 0.500
  портал:     стойки X -0.330 / -0.008, Y 0.196, труба Z 0.588
  пульт:      X 0.030..0.255, Y 0.095..0.235, Z 0.490..0.562, панель -18°
  бак:        X 0.255..0.345, Y -0.185..-0.095, крышка до Z 0.598
  ниша:       X -0.320..-0.040, Z 0.112..0.352, глубина 52 мм
  поддон:     X -0.285..0.285, Y -0.300..-0.238, Z 0.004..0.052
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/service_cleaner'
CID = 'service_cleaner'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- габарит / ключевые размеры (м) -------------------------------------
X0, X1 = -0.400, 0.400           # габарит по X
Y0, Y1 = -0.300, 0.300           # габарит по Y (перед -Y)
Z1 = 0.600                       # габарит по Z

CAB = (-0.375, 0.375, -0.238, 0.252, 0.070, 0.455)   # корпус
PLINTH = (-0.352, 0.352, -0.226, 0.238, 0.000, 0.070)
SKIN_Y0, SKIN_Y1 = -0.290, -0.238                   # передняя панель
TOP = (-0.400, 0.400, -0.290, 0.290, 0.455, 0.490)   # рабочая плита
NICHE = (-0.320, -0.040, 0.112, 0.352)               # сервисная ниша (X, Z)

BASIN_X0, BASIN_X1 = -0.346, -0.014
BASIN_Y0, BASIN_Y1 = -0.231, 0.136
BASIN_ZB, BASIN_ZT = 0.292, 0.500
BASIN_W = 0.013
BASIN_FT = 0.016
HOLE = (BASIN_X0 + 0.001, BASIN_X1 - 0.001, BASIN_Y0 + 0.001, BASIN_Y1 - 0.001)
DRAIN_C = (0.5 * (BASIN_X0 + BASIN_X1), 0.5 * (BASIN_Y0 + BASIN_Y1))

SPLASH = (-0.395, 0.395, 0.240, 0.282, 0.490, 0.562)
BOOM_Y, BOOM_Z, BOOM_R = -0.030, 0.588, 0.012
POST_Y, POST_R = 0.196, 0.012
POST_X = (-0.330, -0.008)

CONSOLE = (0.030, 0.255, 0.095, 0.235, 0.490, 0.562)
PANEL_C = Vector((0.1425, 0.086, 0.523))
PANEL_ANG = math.radians(-18.0)

JAR_C = (0.312, -0.176)
JAR_R = 0.042

TRAY = (-0.285, 0.285, -0.2975, -0.238)

PALETTE = {
    'milk': (0.930, 0.925, 0.908),      # корпус, ванна, плита
    'graphite': (0.168, 0.180, 0.196),  # цоколь, портал, пульт, поддон
    'steel': (0.700, 0.715, 0.725),     # нерж.: трубы, фитинги, решётка
    'dark': (0.045, 0.050, 0.056),      # ниша, щели, шрифт
    'cyan': (0.030, 0.330, 0.480),      # слив, метки, быстросъём
    'led': (0.330, 0.860, 0.820),       # индикация
    'red': (0.640, 0.070, 0.055),       # грибок «стоп»
    'bowl': (0.420, 0.680, 0.700),      # колба фильтра (тонированная)
    'water': (0.045, 0.240, 0.280),     # вода в ванне
}
ALPHA = {'bowl': 0.42, 'water': 0.86}
ROUGH = {
    'milk': 0.36, 'graphite': 0.46, 'steel': 0.30, 'dark': 0.55,
    'cyan': 0.38, 'led': 0.25, 'red': 0.42, 'bowl': 0.08, 'water': 0.16,
}
METAL = {'steel': 0.88, 'graphite': 0.30}
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
    bsdf.inputs['Metallic'].default_value = METAL.get(role, 0.0)
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
    if role == 'led':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.6
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
    apply(obj, role)
    return shade(obj, 45.0)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    apply(obj, role)
    return shade(obj, 60.0)


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


def bm_cyl(bm, a, b, r1, r2=None, segs=20):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r1 if r2 is None else r2,
                          depth=d.length, matrix=m)


def bm_box(bm, loc, size, rotz=0.0):
    m = (Matrix.Translation(Vector(loc))
         @ Matrix.Rotation(rotz, 4, 'Z')
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_knurl_z(bm, cx, cy, z0, z1, r, count, thick=0.0011, wide=0.0020):
    """Продольные насечки вокруг оси Z (крышка бака)."""
    h = z1 - z0
    for i in range(count):
        a = math.tau * i / count
        bm_box(bm, (cx + r * math.cos(a), cy + r * math.sin(a), (z0 + z1) * 0.5),
               (thick, wide, h), rotz=a)


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


def _pt(axis, a, b, c):
    """axis='Z': (a,b) = XY, c = Z. axis='Y': (a,b) = XZ, c = Y."""
    return (a, c, b) if axis == 'Y' else (a, b, c)


def ring_plate(name, axis, a0, a1, b0, b1, ha0, ha1, hb0, hb1, c0, c1,
               role, r=0.004, seg=2):
    """Плита с прямоугольным отверстием (рабочая плита, передняя панель)."""
    bm = bmesh.new()

    def V(c, a, b):
        return bm.verts.new(_pt(axis, a, b, c))

    o_lo = [V(c0, a0, b0), V(c0, a1, b0), V(c0, a1, b1), V(c0, a0, b1)]
    o_hi = [V(c1, a0, b0), V(c1, a1, b0), V(c1, a1, b1), V(c1, a0, b1)]
    i_lo = [V(c0, ha0, hb0), V(c0, ha1, hb0), V(c0, ha1, hb1), V(c0, ha0, hb1)]
    i_hi = [V(c1, ha0, hb0), V(c1, ha1, hb0), V(c1, ha1, hb1), V(c1, ha0, hb1)]
    for k in range(4):
        j = (k + 1) % 4
        bm.faces.new((o_lo[k], o_lo[j], o_hi[j], o_hi[k]))
        bm.faces.new((i_lo[k], i_lo[j], i_hi[j], i_hi[k]))
        bm.faces.new((o_hi[k], o_hi[j], i_hi[j], i_hi[k]))
        bm.faces.new((o_lo[k], o_lo[j], i_lo[j], i_lo[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bevel(obj, r, seg)
    return shade(obj, 32.0)


def tub_shell(name, x0, x1, y0, y1, z_bot, z_top, wall, floor_t, role,
              r=0.0025, seg=2):
    """Открытая сверху ванна/поддон: стенки, бортик, дно заданной толщины."""
    bm = bmesh.new()
    z_ib = z_bot + floor_t

    def ring(z, xa, xb, ya, yb):
        return [bm.verts.new(v) for v in ((xa, ya, z), (xb, ya, z),
                                          (xb, yb, z), (xa, yb, z))]

    ob = ring(z_bot, x0, x1, y0, y1)
    ot = ring(z_top, x0, x1, y0, y1)
    ib = ring(z_ib, x0 + wall, x1 - wall, y0 + wall, y1 - wall)
    it = ring(z_top, x0 + wall, x1 - wall, y0 + wall, y1 - wall)
    for k in range(4):
        j = (k + 1) % 4
        bm.faces.new((ob[k], ob[j], ot[j], ot[k]))     # наружная стенка
        bm.faces.new((it[k], it[j], ib[j], ib[k]))     # внутренняя стенка
        bm.faces.new((ot[k], ot[j], it[j], it[k]))     # бортик
    bm.faces.new(tuple(reversed(ob)))                  # дно снаружи
    bm.faces.new(tuple(ib))                            # дно изнутри
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bevel(obj, r, seg)
    return shade(obj, 32.0)


def on_panel(dx, dz, out=0.0):
    """Точка на наклонной панели пульта: dx — вдоль X, dz — вверх по панели."""
    return PANEL_C + Matrix.Rotation(PANEL_ANG, 3, 'X') @ Vector(
        (dx, -0.006 - out, dz))


def panel_normal():
    return (Matrix.Rotation(PANEL_ANG, 3, 'X') @ Vector((0, -1, 0))).normalized()


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    nx0, nx1, nz0, nz1 = NICHE

    # ======================= цоколь и корпус ============================
    add(box(PREFIX + 'plinth', *PLINTH, 'graphite', r=0.005, seg=3))
    # корпус собран вокруг ванны: тумба под ванной + три стойки по периметру,
    # иначе верхняя грань цельного бокса перекрывает чашу ванны
    add(box(PREFIX + 'cabinet', CAB[0], CAB[1], CAB[2], CAB[3], CAB[4], 0.290,
            'milk', r=0.010, seg=3))
    add(box(PREFIX + 'cabinet_left', CAB[0], BASIN_X0, CAB[2], CAB[3],
            0.290, CAB[5], 'milk', r=0.008, seg=3))
    add(box(PREFIX + 'cabinet_right', BASIN_X1, CAB[1], CAB[2], CAB[3],
            0.290, CAB[5], 'milk', r=0.008, seg=3))
    add(box(PREFIX + 'cabinet_back', BASIN_X0, BASIN_X1, BASIN_Y1, CAB[3],
            0.290, CAB[5], 'milk', r=0.008, seg=3))
    add(box(PREFIX + 'cabinet_front', BASIN_X0, BASIN_X1, CAB[2], BASIN_Y0,
            0.290, CAB[5], 'milk', r=0.008, seg=3))

    # передняя панель с сервисной нишей (сквозное окно) -------------------
    add(ring_plate(PREFIX + 'front_panel', 'Y', CAB[0], CAB[1], CAB[4], CAB[5],
                   nx0, nx1, nz0, nz1, SKIN_Y0, SKIN_Y1, 'milk',
                   r=0.0045, seg=3))
    # тёмная задняя стенка ниши + уплотнительные рамки
    add(box(PREFIX + 'niche_back', nx0 + 0.001, nx1 - 0.001, -0.2395, -0.2340,
            nz0 + 0.001, nz1 - 0.001, 'dark', r=0.0015))
    add(box(PREFIX + 'niche_frame_top', nx0 - 0.005, nx1 + 0.005, -0.2915,
            -0.2880, nz1, nz1 + 0.006, 'steel', r=0.0012))
    add(box(PREFIX + 'niche_frame_bot', nx0 - 0.005, nx1 + 0.005, -0.2915,
            -0.2880, nz0 - 0.006, nz0, 'steel', r=0.0012))
    # подсветка ниши
    add(cyl(PREFIX + 'niche_led', (-0.290, -0.250, 0.344),
            (-0.290, -0.250, 0.338), 0.0075, 'led', vertices=16))
    # монтажная полка и рейка в нише
    add(box(PREFIX + 'niche_shelf', nx0 + 0.006, nx1 - 0.006, -0.284, -0.240,
            nz0 + 0.004, nz0 + 0.014, 'steel', r=0.0016))
    add(box(PREFIX + 'niche_rail', nx0 + 0.006, nx1 - 0.006, -0.248, -0.240,
            0.300, 0.312, 'steel', r=0.0014))

    # вентиляционные щели в правой части передней панели ------------------
    bm = bmesh.new()
    for i in range(4):
        z = 0.112 + i * 0.024
        bm_box(bm, (0.230, -0.2915, z), (0.150, 0.0030, 0.0105))
    add(mesh_from_bm(PREFIX + 'vent_slots', bm, 'dark', 30.0))

    # ======================= рабочая плита ==============================
    add(ring_plate(PREFIX + 'worktop', 'Z', TOP[0], TOP[1], TOP[2], TOP[3],
                   HOLE[0], HOLE[1], HOLE[2], HOLE[3], TOP[4], TOP[5],
                   'milk', r=0.006, seg=3))
    # графитовый кант по передней кромке плиты + бирюзовая линия
    add(box(PREFIX + 'top_band', -0.400, 0.400, -0.2918, -0.2884,
            0.4550, 0.4760, 'graphite', r=0.0014, seg=3))
    add(box(PREFIX + 'top_band_line', -0.400, 0.400, -0.2922, -0.2912,
            0.4602, 0.4668, 'cyan', r=0.0004))

    # ======================= ванна / бак ================================
    add(tub_shell(PREFIX + 'basin', BASIN_X0, BASIN_X1, BASIN_Y0, BASIN_Y1,
                  BASIN_ZB, BASIN_ZT, BASIN_W, BASIN_FT, 'milk',
                  r=0.0028, seg=3))
    # нерж. бортик ванны (приподнят над плитой)
    add(ring_plate(PREFIX + 'basin_rim', 'Z', BASIN_X0 - 0.007, BASIN_X1 + 0.007,
                   BASIN_Y0 - 0.007, BASIN_Y1 + 0.007,
                   BASIN_X0 + 0.006, BASIN_X1 - 0.006,
                   BASIN_Y0 + 0.006, BASIN_Y1 - 0.006,
                   0.4960, 0.5030, 'steel', r=0.0016, seg=2))
    # вода на дне ванны
    add(box(PREFIX + 'basin_water', BASIN_X0 + BASIN_W + 0.004,
            BASIN_X1 - BASIN_W - 0.004, BASIN_Y0 + BASIN_W + 0.004,
            BASIN_Y1 - BASIN_W - 0.004, BASIN_ZB + BASIN_FT, 0.3115,
            'water', r=0.0015))

    # слив: бирюзовый фланец, нерж. решётка, винт
    dx, dy = DRAIN_C
    add(cyl(PREFIX + 'drain_flange', (dx, dy, 0.3055), (dx, dy, 0.3180),
            0.052, 'cyan', vertices=40, bev=0.0024))
    add(cyl(PREFIX + 'drain_body', (dx, dy, 0.3080), (dx, dy, 0.3245),
            0.040, 'dark', vertices=36, bev=0.0016))
    bm = bmesh.new()
    for i in range(5):
        bm_box(bm, (dx, dy + (i - 2) * 0.0138, 0.3251),
               (0.066, 0.0058, 0.0034))
    add(mesh_from_bm(PREFIX + 'drain_strainer', bm, 'steel', 30.0))
    add(cyl(PREFIX + 'drain_screw', (dx, dy, 0.3245), (dx, dy, 0.3290),
            0.0092, 'cyan', vertices=16))

    # заливной патрубок в ванне (подача воды/раствора)
    add(cyl(PREFIX + 'fill_spout_flange', (BASIN_X0 + 0.001, -0.050, 0.4700),
            (BASIN_X0 + 0.012, -0.050, 0.4696), 0.0190, 'steel', vertices=20,
            bev=0.0014))
    add(cyl(PREFIX + 'fill_spout', (BASIN_X0 + 0.010, -0.050, 0.4695),
            (BASIN_X0 + 0.066, -0.050, 0.4560), 0.0098, 'steel', vertices=18))
    add(cyl(PREFIX + 'fill_spout_tip', (BASIN_X0 + 0.066, -0.050, 0.4560),
            (BASIN_X0 + 0.078, -0.050, 0.4540), 0.0110, 'cyan', vertices=18,
            r2=0.0088))

    # переливной патрубок в задней стенке ванны
    add(cyl(PREFIX + 'overflow_spout', (BASIN_X0 + 0.045, BASIN_Y1 - 0.010, 0.452),
            (BASIN_X0 + 0.045, BASIN_Y1 - 0.010, 0.410), 0.016, 'steel',
            vertices=20, bev=0.0012))

    # ======================= задняя панель ==============================
    add(box(PREFIX + 'backsplash', *SPLASH, 'milk', r=0.006, seg=3))
    add(box(PREFIX + 'nozzle_panel', -0.360, 0.062, 0.2360, 0.2402,
            0.498, 0.556, 'graphite', r=0.0028))
    add(text(PREFIX + 'panel_mark', 'H2O', 0.014, (-0.322, 0.2354, 0.527),
             'steel', rot=(math.pi / 2, 0, 0)))

    # ======================= портал со форсунками =======================
    for tag, px in (('l', POST_X[0]), ('r', POST_X[1])):
        add(cyl(PREFIX + f'gantry_post_{tag}', (px, POST_Y, 0.490),
                (px, POST_Y, BOOM_Z), POST_R, 'steel', vertices=24))
        add(cyl(PREFIX + f'gantry_base_{tag}', (px, POST_Y, 0.490),
                (px, POST_Y, 0.500), 0.024, 'steel', vertices=24, bev=0.0016))
        add(cyl(PREFIX + f'gantry_arm_{tag}', (px, POST_Y, BOOM_Z),
                (px, BOOM_Y, BOOM_Z), 0.010, 'steel', vertices=20))
        add(sphere(PREFIX + f'gantry_elbow_{tag}', (px, POST_Y, BOOM_Z),
                   0.012, 'steel'))
    add(cyl(PREFIX + 'spray_boom', (POST_X[0], BOOM_Y, BOOM_Z),
            (POST_X[1], BOOM_Y, BOOM_Z), BOOM_R, 'steel', vertices=24))
    add(cyl(PREFIX + 'boom_cap_l', (POST_X[0] + 0.004, BOOM_Y, BOOM_Z),
            (POST_X[0] - 0.008, BOOM_Y, BOOM_Z), 0.0115, 'graphite',
            vertices=16))
    add(cyl(PREFIX + 'boom_cap_r', (POST_X[1] - 0.004, BOOM_Y, BOOM_Z),
            (POST_X[1] + 0.008, BOOM_Y, BOOM_Z), 0.0115, 'graphite',
            vertices=16))

    for i, px in enumerate((-0.280, -0.170, -0.060)):
        add(cyl(PREFIX + f'nozzle_stem_{i}', (px, BOOM_Y, BOOM_Z),
                (px, BOOM_Y, 0.5520), 0.0075, 'steel', vertices=16))
        add(cyl(PREFIX + f'nozzle_collar_{i}', (px, BOOM_Y, 0.5705),
                (px, BOOM_Y, 0.5625), 0.0118, 'steel', vertices=18))
        add(cyl(PREFIX + f'nozzle_body_{i}', (px, BOOM_Y, 0.5520),
                (px, BOOM_Y, 0.5340), 0.0150, 'graphite', vertices=20,
                r2=0.0212))
        add(cyl(PREFIX + f'nozzle_tip_{i}', (px, BOOM_Y, 0.5340),
                (px, BOOM_Y, 0.5285), 0.0142, 'cyan', vertices=20,
                bev=0.0008))
        add(cyl(PREFIX + f'nozzle_mouth_{i}', (px, BOOM_Y, 0.5285),
                (px, BOOM_Y, 0.5232), 0.0082, 'steel', vertices=16))

    # стеновая струйная форсунка (4-я) в задней панели
    add(cyl(PREFIX + 'wall_jet_body', (-0.070, 0.2385, 0.5300),
            (-0.070, 0.1620, 0.5140), 0.0105, 'steel', vertices=18))
    add(cyl(PREFIX + 'wall_jet_head', (-0.070, 0.1620, 0.5140),
            (-0.070, 0.1290, 0.5060), 0.0135, 'graphite', vertices=18,
            r2=0.0148))
    add(cyl(PREFIX + 'wall_jet_tip', (-0.070, 0.1290, 0.5060),
            (-0.070, 0.1120, 0.5020), 0.0092, 'cyan', vertices=16,
            r2=0.0062))

    # ======================= пульт управления ===========================
    add(box(PREFIX + 'console', *CONSOLE, 'milk', r=0.008, seg=3))
    add(cube(PREFIX + 'console_bezel', PANEL_C + Vector((0, 0.0040, 0)),
             (0.196, 0.012, 0.078), 'graphite', r=0.0032,
             rot=(PANEL_ANG, 0, 0)))
    add(cube(PREFIX + 'console_panel', PANEL_C, (0.180, 0.012, 0.064),
             'dark', r=0.0030, rot=(PANEL_ANG, 0, 0)))
    n = panel_normal()
    for i, dxp in enumerate((-0.070, -0.048, -0.026)):
        p = on_panel(dxp, 0.0165, 0.0)
        add(cyl(PREFIX + f'panel_led_{i}', p, p + n * 0.0042, 0.0060, 'led',
                vertices=14))
    p = on_panel(0.058, 0.011, 0.0)
    add(cyl(PREFIX + 'panel_stop_base', p, p + n * 0.0050, 0.0130, 'steel',
            vertices=20))
    add(cyl(PREFIX + 'panel_stop_cap', p + n * 0.0050, p + n * 0.0115, 0.0145,
            'red', vertices=24, bev=0.0022))
    p = on_panel(0.014, 0.011, 0.0)
    add(cyl(PREFIX + 'panel_button', p, p + n * 0.0062, 0.0092, 'steel',
            vertices=20, bev=0.0016))
    add(text(PREFIX + 'console_text', 'МОЙКА', 0.0165,
             on_panel(-0.050, -0.0195, 0.0022), 'milk',
             rot=(math.pi / 2 + PANEL_ANG, 0, 0)))
    add(text(PREFIX + 'console_code', 'SRV-CLEAN-02', 0.0082,
             on_panel(0.044, -0.0210, 0.0022), 'milk',
             rot=(math.pi / 2 + PANEL_ANG, 0, 0)))

    # ======================= бак раствора с крышкой =====================
    jx, jy = JAR_C
    add(cyl(PREFIX + 'tank_body', (jx, jy, 0.490), (jx, jy, 0.570), JAR_R,
            'milk', vertices=32, bev=0.0025))
    add(cyl(PREFIX + 'tank_shoulder', (jx, jy, 0.570), (jx, jy, 0.584),
            0.031, 'milk', vertices=32, r2=0.031))
    bm = bmesh.new()
    bm_knurl_z(bm, jx, jy, 0.582, 0.5965, 0.0308, 24, 0.0012, 0.0020)
    add(mesh_from_bm(PREFIX + 'tank_lid_knurl', bm, 'graphite', 40.0))
    add(cyl(PREFIX + 'tank_lid', (jx, jy, 0.582), (jx, jy, 0.598), 0.0300,
            'graphite', vertices=32, bev=0.0018))
    add(torus(PREFIX + 'tank_band', (jx, jy, 0.530), JAR_R + 0.0008, 0.0022,
              'cyan', axis='Z', segs=40, rings=8))
    add(curve_tube(PREFIX + 'dosing_line',
                   [(jx, jy + 0.010, 0.596), (jx - 0.020, jy + 0.066, 0.588),
                    (jx - 0.050, 0.056, 0.574), (0.214, 0.098, 0.566)],
                   0.0035, 'steel'))

    # ======================= быстросъём и шланг =========================
    add(box(PREFIX + 'coupler_block', 0.320, 0.372, 0.240, 0.268, 0.512, 0.552,
            'steel', r=0.0028, seg=3))
    add(cyl(PREFIX + 'coupler_neck', (0.346, 0.240, 0.532),
            (0.346, 0.222, 0.532), 0.0125, 'steel', vertices=20))
    add(torus(PREFIX + 'coupler_collar', (0.346, 0.2225, 0.532), 0.0135, 0.0032,
              'cyan', axis='Y', segs=28, rings=8))
    add(curve_tube(PREFIX + 'hose',
                   [(0.346, 0.214, 0.532), (0.376, 0.150, 0.512),
                    (0.384, 0.020, 0.506), (0.376, -0.140, 0.514),
                    (0.360, -0.246, 0.524)], 0.0092, 'graphite'))
    add(box(PREFIX + 'hose_holster', 0.336, 0.378, -0.272, -0.240, 0.490, 0.556,
            'graphite', r=0.0035, seg=3))
    add(box(PREFIX + 'hose_holster_slot', 0.344, 0.370, -0.276, -0.268,
            0.500, 0.540, 'dark', r=0.0016))
    add(cyl(PREFIX + 'hose_gun', (0.358, -0.246, 0.524),
            (0.350, -0.272, 0.516), 0.0092, 'graphite', vertices=16,
            r2=0.0072))
    add(cyl(PREFIX + 'hose_gun_tip', (0.350, -0.272, 0.516),
            (0.346, -0.292, 0.510), 0.0062, 'cyan', vertices=14, r2=0.0048))

    # ======================= задний ввод/вывод ==========================
    add(box(PREFIX + 'service_box', 0.140, 0.362, 0.252, 0.300, 0.140, 0.330,
            'graphite', r=0.004, seg=3))
    add(cyl(PREFIX + 'inlet_valve', (0.180, 0.276, 0.330), (0.180, 0.276, 0.352),
            0.0145, 'steel', vertices=20, bev=0.0015))
    add(cube(PREFIX + 'inlet_handle', (0.204, 0.276, 0.350),
             (0.052, 0.010, 0.0075), 'cyan', r=0.0022))
    add(cyl(PREFIX + 'drain_stub', (0.250, 0.276, 0.150), (0.250, 0.286, 0.150),
            0.0110, 'steel', vertices=16))
    add(cyl(PREFIX + 'drain_stub_down', (0.250, 0.286, 0.150),
            (0.250, 0.286, 0.072), 0.0110, 'steel', vertices=16,
            bev=0.0012))
    add(box(PREFIX + 'power_socket', 0.286, 0.348, 0.258, 0.294, 0.330, 0.338,
            'dark', r=0.0018))
    add(cyl(PREFIX + 'power_led', (0.318, 0.276, 0.338), (0.318, 0.276, 0.3405),
            0.0042, 'led', vertices=12))
    add(curve_tube(PREFIX + 'power_cable',
                   [(0.330, 0.286, 0.334), (0.352, 0.290, 0.256),
                    (0.360, 0.288, 0.150), (0.350, 0.282, 0.068)],
                   0.0068, 'dark'))
    add(box(PREFIX + 'power_connector', 0.336, 0.364, 0.272, 0.296, 0.040, 0.062,
            'dark', r=0.0020))

    # ======================= сервисная ниша: насос/фильтр ===============
    pw_y = -0.262
    add(box(PREFIX + 'pump_base', -0.306, -0.190, -0.286, -0.244, 0.126, 0.136,
            'steel', r=0.0020))
    add(cyl(PREFIX + 'pump_volute', (-0.300, pw_y, 0.206), (-0.264, pw_y, 0.206),
            0.0375, 'graphite', vertices=28, bev=0.0024))
    add(cyl(PREFIX + 'pump_motor', (-0.262, pw_y, 0.206), (-0.198, pw_y, 0.206),
            0.0265, 'steel', vertices=24))
    for i, mx in enumerate((-0.250, -0.228, -0.206)):
        add(cyl(PREFIX + f'pump_ring_{i}', (mx, pw_y, 0.206), (mx + 0.0035, pw_y, 0.206),
                0.0282, 'dark', vertices=24))
    add(cyl(PREFIX + 'pump_cap', (-0.198, pw_y, 0.206), (-0.190, pw_y, 0.206),
            0.0225, 'graphite', vertices=24, bev=0.0016))
    add(cyl(PREFIX + 'pump_inlet', (-0.300, pw_y, 0.196), (-0.300, pw_y, 0.142),
            0.0130, 'steel', vertices=16))
    add(box(PREFIX + 'pump_terminal', -0.268, -0.230, -0.276, -0.250,
            0.244, 0.262, 'dark', r=0.0022))

    # сифон (P-трап) от слива ванны
    add(curve_tube(PREFIX + 'trap_pipe',
                   [(dx, -0.096, 0.292), (dx, -0.096, 0.236),
                    (-0.208, -0.140, 0.196), (-0.246, -0.180, 0.216),
                    (-0.258, -0.216, 0.248)], 0.0125, 'steel'))
    add(curve_tube(PREFIX + 'trap_hose',
                   [(-0.258, -0.216, 0.248), (-0.290, -0.248, 0.240),
                    (-0.300, pw_y, 0.206)], 0.0095, 'dark'))
    add(cyl(PREFIX + 'drain_valve', (-0.208, -0.150, 0.196),
            (-0.208, -0.246, 0.196), 0.0170, 'steel', vertices=20,
            bev=0.0016))
    add(cube(PREFIX + 'valve_lever', (-0.208, -0.252, 0.196),
             (0.050, 0.009, 0.0085), 'cyan', r=0.0022,
             rot=(0, math.radians(16), 0)))

    # фильтр: молочная голова + прозрачная колба + элемент
    fx = -0.094
    add(cyl(PREFIX + 'filter_head', (fx, pw_y, 0.136), (fx, pw_y, 0.246),
            0.0305, 'milk', vertices=28, bev=0.0024))
    add(cyl(PREFIX + 'filter_bowl', (fx, pw_y, 0.246), (fx, pw_y, 0.300),
            0.0245, 'bowl', vertices=28))
    add(cyl(PREFIX + 'filter_cartridge', (fx, pw_y, 0.250), (fx, pw_y, 0.294),
            0.0170, 'milk', vertices=24))
    add(cyl(PREFIX + 'filter_cap', (fx, pw_y, 0.300), (fx, pw_y, 0.312),
            0.0255, 'graphite', vertices=24, bev=0.0018))
    add(curve_tube(PREFIX + 'circuit_hose',
                   [(fx, pw_y, 0.312), (fx + 0.012, pw_y + 0.006, 0.332),
                    (-0.180, -0.238, 0.340), (-0.268, -0.242, 0.320),
                    (-0.286, -0.248, 0.240)], 0.0092, 'dark'))
    add(curve_tube(PREFIX + 'feed_hose',
                   [(fx, pw_y, 0.136), (fx + 0.004, pw_y + 0.004, 0.120),
                    (-0.196, -0.250, 0.118)], 0.0092, 'dark'))

    # ======================= поддон =====================================
    add(tub_shell(PREFIX + 'drip_tray', TRAY[0], TRAY[1], TRAY[2], TRAY[3],
                  0.004, 0.054, 0.010, 0.008, 'milk', r=0.0022, seg=2))
    add(box(PREFIX + 'tray_lip', TRAY[0] - 0.002, TRAY[1] + 0.002,
            TRAY[2] - 0.0018, TRAY[3] + 0.004, 0.046, 0.058, 'steel',
            r=0.0016))
    add(box(PREFIX + 'tray_mark', 0.060, 0.150, TRAY[2] - 0.0024,
            TRAY[2] - 0.0010, 0.020, 0.036, 'cyan', r=0.0006))

    # ======================= маркировка / табличка =====================
    add(box(PREFIX + 'label_plate', 0.070, 0.330, -0.2945, -0.2900,
            0.352, 0.436, 'graphite', r=0.0022))
    add(box(PREFIX + 'label_rule', 0.082, 0.318, -0.2952, -0.2942,
            0.422, 0.4242, 'cyan', r=0.0004))
    add(text(PREFIX + 'label_title', 'МОЙКА', 0.0270, (0.200, -0.2952, 0.404),
             'milk', rot=(math.pi / 2, 0, 0)))
    add(text(PREFIX + 'label_code', 'SRV-CLEAN-02', 0.0105, (0.200, -0.2952, 0.375),
             'steel', rot=(math.pi / 2, 0, 0)))
    # маркировка растворов над нишей: бирюзовая и графитовая полосы
    add(box(PREFIX + 'solution_mark_cyan', -0.302, -0.120, -0.2935, -0.2900,
            0.366, 0.386, 'cyan', r=0.0008))
    add(box(PREFIX + 'solution_mark_dark', -0.302, -0.120, -0.2935, -0.2900,
            0.392, 0.402, 'dark', r=0.0008))
    add(text(PREFIX + 'solution_mark_text', 'H2O + РАСТВОР', 0.0082,
             (-0.211, -0.2942, 0.376), 'milk', rot=(math.pi / 2, 0, 0)))

    # ======================= боковая ручка ==============================
    add(box(PREFIX + 'side_grip', 0.375, 0.392, -0.060, 0.040, 0.300, 0.338,
            'steel', r=0.0045, seg=3))
    add(box(PREFIX + 'side_grip_slot', 0.386, 0.3935, -0.040, 0.020,
            0.310, 0.328, 'dark', r=0.0018))

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
    tol = 0.008
    passport = (0.80, 0.60, 0.60)
    report = {
        'component': CID,
        'nodes': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'node_count': len([o for o in bpy.data.objects
                           if o.name.startswith(PREFIX)]),
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
    scene.view_settings.exposure = -0.20
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.560, 0.556, 0.548, 1.0)
    bg.inputs['Strength'].default_value = 0.52

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.470, 0.468, 0.462, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.70, -0.86, 0.86), 26.0, 0.62),
            ('fill', (-0.90, -0.66, 0.48), 9.0, 0.95),
            ('rim', (0.10, 0.86, 0.72), 15.0, 0.72)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, 0.20))
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
    close_t = Vector((-0.185, -0.090, 0.395))
    c_close = box_corners(Vector((-0.365, -0.300, 0.280)) - close_t,
                          Vector((0.040, 0.250, 0.612)) - close_t)

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
        'nozzle_', 'drain_', 'basin', 'boom', 'gantry', 'wall_jet', 'spray',
        'trap', 'pump_', 'filter_', 'panel_', 'console_', 'overflow',
        'fill_spout'))]

    views = [
        ('3q', (0.82, -1.00, 0.46), center + Vector((0, 0, 0.010)), 70, c_main,
         0.90, mesh_objs),
        ('front', (0.06, -1.0, 0.14), center, 70, c_main, 0.92, mesh_objs),
        ('side', (-1.0, -0.34, 0.14), center + Vector((0, 0, 0.010)), 70,
         c_main, 0.90, mesh_objs),
        ('closeup', (0.34, -1.00, 0.30), close_t, 85, c_close, 0.95, near),
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
            cam.rotation_euler = (target - cam.location).to_track_quat(
                '-Z', 'Y').to_euler()
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
    print('REPORT ' + json.dumps(
        {k: rep[k] for k in ('component', 'node_count', 'bbox_size', 'bbox_ok',
                             'material_count', 'glb_bytes')},
        ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
