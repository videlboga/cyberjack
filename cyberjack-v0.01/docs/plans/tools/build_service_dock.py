"""Standalone builder: service_dock (SRV-DOCK-01, «Сервисный док»).

Компактная напольная док-станция для быстросъёма и диагностики модулей вне
рабочей зоны: корпус-тумба с приёмным лотком, две направляющие-рельсы с
заходными скосами и упорами, четыре посадочных штифта, электрический разъём
(8 контактов) и пневматическая быстросъёмная муфта, фиксатор с рычагом и
прижимной пятой, дренажный поддон со сливной решёткой, кабель и шланг,
рама с поперечиной, пульт и сигнальный столбик, маркировка. Плиты нет.

Не зависит от build_component_library.py / build_*.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_service_dock.py

Выход:
  public/models/machine-modules/components/service_dock.glb
  docs/plans/blockout/component-library/service_dock/*.png
  docs/plans/blockout/component-library/service_dock/report.json

Геометрия (Blender Z-up, метры):
  перед (-Y) — сторона заезда модуля, верх = приёмный лоток
  габарит по паспорту 1,20 x 0,80 x 1,00 м, низ на z = 0
  вращения нет (motion: none), анимационная пустышка не нужна
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/service_dock'
CID = 'service_dock'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
DECK_HX, DECK_HY = 0.6000, 0.4000          # 1.20 x 0.80
BODY_HX, BODY_HY = 0.5860, 0.3880

BODY_Z0, BODY_Z1 = 0.0600, 0.5780
REVEAL_Z0, REVEAL_Z1 = 0.5780, 0.5920      # теневая щель под лотком
DECK_Z0, DECK_Z1 = 0.5920, 0.6840          # борт лотка
RIM_W = 0.0700

WELL_HX, WELL_HY = 0.5300, 0.3300          # 1.06 x 0.66 внутри
PAN_Z1 = 0.6060                            # дно поддона

RAIL_X, RAIL_HX = 0.2400, 0.0210
RAIL_Z0, RAIL_Z1 = PAN_Z1, 0.6420
RAIL_Y0, RAIL_Y1 = -0.2750, 0.2400
RAIL_RAMP_Y = -0.3200

PIN_X, PIN_Y = 0.4000, (-0.1500, 0.1200)
PIN_TOP = 0.6545

CONN_X, CONN_Y = -0.1150, 0.2550           # электрический разъём
CONN_HX, CONN_HY = 0.0760, 0.0410
CONN_Z0, CONN_Z1 = PAN_Z1, 0.6760
CONN_FRONT = CONN_Y - CONN_HY              # 0.214

AIR_X, AIR_Y, AIR_Z = 0.1000, 0.2550, 0.6530

DRAIN_X, DRAIN_Y = 0.3700, 0.2300

LATCH_X = -0.3300
LATCH_PIVOT = Vector((LATCH_X, -0.3480, 0.7640))
LATCH_ANG = math.radians(42.0)

POST_X, POST_Y = 0.5625, 0.3625            # стойки рамы
POST_Z0, POST_Z1 = DECK_Z1, 0.9680
POST_HX, POST_HY = 0.0300, 0.0350
BEAM_Z0, BEAM_Z1 = 0.9040, 0.9680
PANEL_Z0, PANEL_Z1 = 0.7400, 0.8900

PALETTE = {
    'ivory': (0.945, 0.937, 0.918),
    'graphite': (0.070, 0.074, 0.082),
    'steel': (0.735, 0.744, 0.736),
    'dark': (0.042, 0.045, 0.049),
    'red': (0.680, 0.070, 0.055),
    'brass': (0.690, 0.520, 0.230),
    'cyan': (0.320, 0.760, 0.800),
    'hose': (0.290, 0.430, 0.470),
}
ROUGH = {'ivory': 0.44, 'graphite': 0.50, 'steel': 0.34, 'dark': 0.58,
         'red': 0.40, 'brass': 0.32, 'cyan': 0.30, 'hose': 0.42}
METAL = {'steel': 0.92, 'brass': 0.95, 'graphite': 0.05}
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
    if role in ('graphite', 'dark'):
        try:
            bsdf.inputs['Specular IOR Level'].default_value = 0.22
        except KeyError:
            pass
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.55
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role):
    obj.data.materials.append(mat(role))
    return obj


def shade(obj, angle=35.0):
    """Сглаживание с автоматическими рёбрами жёсткости (Blender 4.x sharp)."""
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


def bevel(obj, width=0.0015, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40) if angle else math.radians(179)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), sharp=35.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    apply(obj, role)
    return shade(obj, sharp)


def cyl(name, a, b, radius, role, vertices=32, r2=None, bev=0.0, sharp=35.0):
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
    apply(obj, role)
    return shade(obj, sharp)


def sphere(name, loc, radius, role, segs=24, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    apply(obj, role)
    return shade(obj, 60.0)


def torus(name, loc, major, minor, role, axis='Z', segs=48, rings=12):
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
    return shade(obj, 60.0)


def curve_tube(name, points, radius, role, res=8):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 14
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


def mesh_from_bm(name, bm, role, sharp=35.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    return shade(obj, sharp)


def bm_cyl(bm, a, b, r1, r2=None, segs=24):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=(r1 if r2 is None else r2),
                          depth=d.length, matrix=m)


def rr_ring(hx, hy, r, per_corner=8):
    """Точки скруглённого прямоугольника (CCW), r — радиус угла."""
    r = min(r, hx, hy)
    pts = []
    corners = ((hx - r, -(hy - r), -90.0), (hx - r, hy - r, 0.0),
               (-(hx - r), hy - r, 90.0), (-(hx - r), -(hy - r), 180.0))
    for cx, cy, a0 in corners:
        for i in range(per_corner):
            a = math.radians(a0 + 90.0 * i / per_corner)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def loft(name, rings, role, per_corner=8, sharp=32.0, loc=(0.0, 0.0, 0.0)):
    """Тело по сечениям: rings = [(z, hx, hy, r), ...] снизу вверх."""
    bm = bmesh.new()
    levels = []
    n = None
    for (z, hx, hy, r) in rings:
        pts = rr_ring(hx, hy, r, per_corner)
        n = len(pts)
        levels.append([bm.verts.new((x, y, z)) for (x, y) in pts])
    for i in range(len(levels) - 1):
        low, up = levels[i], levels[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((low[k], low[k2], up[k2], up[k]))
    bm.faces.new(tuple(reversed(levels[0])))
    bm.faces.new(tuple(levels[-1]))
    obj = mesh_from_bm(name, bm, role, sharp)
    obj.location = loc
    return obj


def prism8(name, verts, role, sharp=35.0):
    """8 точек: 0..3 — низ (CCW), 4..7 — верх в том же порядке."""
    bm = bmesh.new()
    bot = [bm.verts.new(v) for v in verts[:4]]
    top = [bm.verts.new(v) for v in verts[4:]]
    bm.faces.new(tuple(reversed(bot)))
    bm.faces.new(tuple(top))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    return mesh_from_bm(name, bm, role, sharp)


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0), extrude=0.0007):
    global FONT
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    cu.resolution_u = 6
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

    # ---- основание: плита-цоколь на регулируемых пятках -----------------
    add(loft(PREFIX + 'plinth', [
        (0.0140, 0.5560, 0.3620, 0.0120),
        (0.0200, 0.5620, 0.3680, 0.0125),
        (0.0530, 0.5620, 0.3680, 0.0125),
        (0.0600, 0.5560, 0.3600, 0.0100)], 'graphite', per_corner=8))

    bm = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            px, py = sx * 0.4500, sy * 0.2820
            bm_cyl(bm, (px, py, 0.0000), (px, py, 0.0145), 0.0260, segs=24)
    add(mesh_from_bm(PREFIX + 'feet', bm, 'steel', 30.0))

    # ---- корпус ---------------------------------------------------------
    add(loft(PREFIX + 'body', [
        (BODY_Z0, 0.5760, 0.3780, 0.0240),
        (0.0740, BODY_HX, BODY_HY, 0.0280),
        (0.5560, BODY_HX, BODY_HY, 0.0280),
        (0.5720, 0.5830, 0.3850, 0.0260),
        (BODY_Z1, 0.5790, 0.3810, 0.0240)], 'ivory', per_corner=9))

    # теневая щель между корпусом и лотком
    add(cube(PREFIX + 'body_reveal', (0.0, 0.0, 0.5850),
             (1.1400, 0.7360, 0.0140), 'dark', r=0.0015))

    # передняя панель-жалюзи (левая половина фасада)
    add(cube(PREFIX + 'front_vent_frame', (-0.2950, -0.3915, 0.3500),
             (0.4300, 0.0090, 0.2900), 'graphite', r=0.0050))
    for i in range(6):
        z = 0.2500 + i * 0.0410
        add(cube(f'{PREFIX}front_louvre_{i + 1}', (-0.2950, -0.3980, z),
                 (0.4000, 0.0070, 0.0130), 'dark', r=0.0030))

    # дверца сервисного отсека (правая половина фасада)
    add(cube(PREFIX + 'front_door', (0.2950, -0.3925, 0.3100),
             (0.3900, 0.0090, 0.4200), 'ivory', r=0.0060))
    add(cube(PREFIX + 'front_door_seam', (0.2950, -0.3975, 0.3100),
             (0.3600, 0.0015, 0.3900), 'dark', r=0.0010))
    add(cube(PREFIX + 'front_door_plate', (0.2950, -0.3985, 0.3100),
             (0.3500, 0.0020, 0.3800), 'ivory', r=0.0040))
    add(cube(PREFIX + 'door_handle', (0.1300, -0.3985, 0.3100),
             (0.0160, 0.0100, 0.1400), 'graphite', r=0.0040))
    add(cube(PREFIX + 'door_hinge_top', (0.4620, -0.3990, 0.4900),
             (0.0140, 0.0090, 0.0520), 'graphite', r=0.0030))
    add(cube(PREFIX + 'door_hinge_bot', (0.4620, -0.3990, 0.1300),
             (0.0140, 0.0090, 0.0520), 'graphite', r=0.0030))

    # ---- приёмный лоток: борт -------------------------------------------
    rim_zc = (DECK_Z0 + DECK_Z1) * 0.5
    rim_h = DECK_Z1 - DECK_Z0
    for tag, cx, cy, sx, sy in (
            ('front', 0.0, -(DECK_HY - RIM_W * 0.5), 2 * DECK_HX, RIM_W),
            ('back', 0.0, DECK_HY - RIM_W * 0.5, 2 * DECK_HX, RIM_W),
            ('left', -(DECK_HX - RIM_W * 0.5), 0.0, RIM_W, 2 * WELL_HY + 0.004),
            ('right', DECK_HX - RIM_W * 0.5, 0.0, RIM_W, 2 * WELL_HY + 0.004)):
        add(cube(f'{PREFIX}deck_rim_{tag}', (cx, cy, rim_zc),
                 (sx, sy, rim_h), 'ivory', r=0.0040))

    # резиновая накладка на передней кромке лотка
    add(cube(PREFIX + 'deck_edge_strip', (0.0, -0.3925, 0.6780),
             (1.1800, 0.0150, 0.0090), 'dark', r=0.0030))

    # ---- дренажный поддон (дно лотка) -----------------------------------
    add(cube(PREFIX + 'drain_pan', (0.0, 0.0, (DECK_Z0 + PAN_Z1) * 0.5),
             (2 * WELL_HX, 2 * WELL_HY, PAN_Z1 - DECK_Z0), 'dark', r=0.0030))

    # сливное гнездо с решёткой
    add(cyl(PREFIX + 'drain_boss', (DRAIN_X, DRAIN_Y, PAN_Z1),
            (DRAIN_X, DRAIN_Y, PAN_Z1 + 0.0045), 0.0300, 'dark', vertices=36))
    add(torus(PREFIX + 'drain_ring', (DRAIN_X, DRAIN_Y, PAN_Z1 + 0.0045),
              0.0300, 0.0032, 'steel', 'Z', 40, 10))
    for i in range(3):
        y = DRAIN_Y - 0.0130 + i * 0.0130
        add(cube(f'{PREFIX}drain_bar_{i + 1}', (DRAIN_X, y, PAN_Z1 + 0.0058),
                 (0.0480, 0.0040, 0.0030), 'steel', r=0.0012))

    # ---- направляющие-рельсы -------------------------------------------
    for tag, sx in (('l', -1), ('r', 1)):
        x = sx * RAIL_X
        # заходной скос спереди
        x0, x1 = x - RAIL_HX, x + RAIL_HX
        add(prism8(f'{PREFIX}rail_{tag}_lead', [
            (x0, RAIL_RAMP_Y, RAIL_Z0), (x1, RAIL_RAMP_Y, RAIL_Z0),
            (x1, RAIL_Y0, RAIL_Z0), (x0, RAIL_Y0, RAIL_Z0),
            (x0, RAIL_RAMP_Y, RAIL_Z0 + 0.0020), (x1, RAIL_RAMP_Y, RAIL_Z0 + 0.0020),
            (x1, RAIL_Y0, RAIL_Z1), (x0, RAIL_Y0, RAIL_Z1)], 'steel', 32.0))
        # тело рельса
        add(cube(f'{PREFIX}rail_{tag}', (x, (RAIL_Y0 + RAIL_Y1) * 0.5,
                                         (RAIL_Z0 + RAIL_Z1) * 0.5),
                 (2 * RAIL_HX, RAIL_Y1 - RAIL_Y0, RAIL_Z1 - RAIL_Z0),
                 'steel', r=0.0025))
        # износостойкая вставка по верху
        add(cube(f'{PREFIX}rail_{tag}_strip', (x, (RAIL_Y0 + RAIL_Y1) * 0.5,
                                               RAIL_Z1 + 0.0007),
                 (0.0090, RAIL_Y1 - RAIL_Y0 - 0.0300, 0.0016), 'dark', r=0.0005))
        # задний упор
        add(cube(f'{PREFIX}rail_{tag}_stop', (x, 0.2650, (PAN_Z1 + 0.6620) * 0.5),
                 (0.0540, 0.0500, 0.6620 - PAN_Z1), 'graphite', r=0.0040))

    bm = bmesh.new()
    for sx in (-1, 1):
        for y in (-0.2350, -0.0175, 0.1950):
            bm_cyl(bm, (sx * RAIL_X, y, RAIL_Z1), (sx * RAIL_X, y, RAIL_Z1 + 0.0035),
                   0.0060, segs=6)
    add(mesh_from_bm(PREFIX + 'rail_bolts', bm, 'graphite', 30.0))

    # привалочная плита под модуль между рельсами
    add(cube(PREFIX + 'seat_plate', (0.0, -0.0450, PAN_Z1 + 0.0025),
             (0.1900, 0.4300, 0.0050), 'graphite', r=0.0030))
    bm = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            bm_cyl(bm, (sx * 0.0570, -0.0450 + sy * 0.1700, PAN_Z1 + 0.0050),
                   (sx * 0.0570, -0.0450 + sy * 0.1700, PAN_Z1 + 0.0075),
                   0.0170, segs=24)
    add(mesh_from_bm(PREFIX + 'seat_pads', bm, 'steel', 35.0))

    # ---- посадочные штифты ---------------------------------------------
    bm = bmesh.new()
    for sx in (-1, 1):
        for py in PIN_Y:
            px = sx * PIN_X
            bm_cyl(bm, (px, py, PAN_Z1), (px, py, PAN_Z1 + 0.0060), 0.0195, segs=6)
    add(mesh_from_bm(PREFIX + 'pin_bases', bm, 'graphite', 30.0))
    bm = bmesh.new()
    for sx in (-1, 1):
        for py in PIN_Y:
            px = sx * PIN_X
            bm_cyl(bm, (px, py, PAN_Z1 + 0.0060), (px, py, PAN_Z1 + 0.0095),
                   0.0130, segs=24)
            bm_cyl(bm, (px, py, PAN_Z1 + 0.0095), (px, py, PAN_Z1 + 0.0395),
                   0.0100, segs=24)
            bm_cyl(bm, (px, py, PAN_Z1 + 0.0395), (px, py, PIN_TOP),
                   0.0100, 0.0055, segs=24)
    add(mesh_from_bm(PREFIX + 'locating_pins', bm, 'steel', 30.0))

    # ---- электрический разъём ------------------------------------------
    add(loft(PREFIX + 'connector_body', [
        (CONN_Z0, CONN_HX - 0.0030, CONN_HY - 0.0020, 0.0050),
        (CONN_Z0 + 0.0060, CONN_HX, CONN_HY, 0.0060),
        (CONN_Z1 - 0.0080, CONN_HX, CONN_HY, 0.0060),
        (CONN_Z1, CONN_HX - 0.0040, CONN_HY - 0.0030, 0.0050)],
        'graphite', per_corner=7, loc=(CONN_X, CONN_Y, 0.0)))

    # тёмное поле контактов на передней грани
    add(cube(PREFIX + 'connector_face', (CONN_X, CONN_FRONT - 0.0015, 0.6420),
             (0.1300, 0.0050, 0.0520), 'dark', r=0.0020))

    # 8 контактов (2 ряда x 4)
    bm = bmesh.new()
    for dz in (0.6320, 0.6560):
        for dx in (-0.0450, -0.0150, 0.0150, 0.0450):
            px = CONN_X + dx
            bm_cyl(bm, (px, CONN_FRONT - 0.0035, dz), (px, CONN_FRONT - 0.0170, dz),
                   0.0034, segs=14)
    add(mesh_from_bm(PREFIX + 'contacts', bm, 'brass', 45.0))

    # направляющие втулки разъёма
    bm = bmesh.new()
    for dx in (-0.0680, 0.0680):
        px = CONN_X + dx
        bm_cyl(bm, (px, CONN_FRONT - 0.0020, 0.6440), (px, CONN_FRONT - 0.0120, 0.6440),
               0.0072, segs=20)
    add(mesh_from_bm(PREFIX + 'connector_bushings', bm, 'steel', 40.0))

    # ключ-индекс (красный) и защёлка разъёма
    add(cube(PREFIX + 'connector_key', (CONN_X, CONN_FRONT - 0.0060, 0.6680),
             (0.0150, 0.0130, 0.0130), 'red', r=0.0025))
    add(cube(PREFIX + 'connector_latch', (CONN_X + 0.0730, CONN_Y - 0.0060, 0.6560),
             (0.0180, 0.0300, 0.0260), 'graphite', r=0.0040))
    add(cube(PREFIX + 'connector_latch_grip', (CONN_X + 0.0790, CONN_Y - 0.0140, 0.6560),
             (0.0060, 0.0180, 0.0180), 'red', r=0.0020))

    # ---- пневматическая муфта ------------------------------------------
    add(cube(PREFIX + 'air_pedestal', (AIR_X, 0.2540, 0.6280),
             (0.0520, 0.0860, 0.0440), 'graphite', r=0.0050))
    add(cyl(PREFIX + 'air_body', (AIR_X, 0.2080, AIR_Z), (AIR_X, 0.3020, AIR_Z),
            0.0125, 'brass', vertices=24, bev=0.0015))
    add(torus(PREFIX + 'air_collar', (AIR_X, 0.2320, AIR_Z), 0.0140, 0.0030,
              'steel', 'Y', 36, 10))
    add(torus(PREFIX + 'air_ring', (AIR_X, 0.2200, AIR_Z), 0.0132, 0.0024,
              'cyan', 'Y', 36, 10))
    add(cyl(PREFIX + 'air_nut', (AIR_X, 0.2760, AIR_Z), (AIR_X, 0.2900, AIR_Z),
            0.0165, 'steel', vertices=6, bev=0.0012))
    add(cyl(PREFIX + 'air_tail', (AIR_X, 0.3020, AIR_Z), (AIR_X, 0.3130, AIR_Z),
            0.0085, 'brass', vertices=18))

    # ---- фиксатор с рычагом --------------------------------------------
    # корпус-основание на борту лотка
    add(cube(PREFIX + 'latch_bracket', (LATCH_X, -0.3630, 0.7080),
             (0.0840, 0.0580, 0.0480), 'graphite', r=0.0060))
    # щёки вилки с осью
    for tag, dx in (('a', -0.0270), ('b', 0.0270)):
        add(cube(f'{PREFIX}latch_cheek_{tag}',
                 (LATCH_X + dx, LATCH_PIVOT.y, 0.7410),
                 (0.0090, 0.0480, 0.0260), 'graphite', r=0.0025))
    add(cyl(PREFIX + 'latch_axle', (LATCH_X - 0.0400, LATCH_PIVOT.y, LATCH_PIVOT.z),
            (LATCH_X + 0.0400, LATCH_PIVOT.y, LATCH_PIVOT.z), 0.0080, 'steel',
            vertices=20, bev=0.0012))
    for tag, dx in (('l', -0.0430), ('r', 0.0430)):
        add(cyl(f'{PREFIX}latch_bolt_{tag}',
                (LATCH_X + dx * 0.80, LATCH_PIVOT.y, LATCH_PIVOT.z),
                (LATCH_X + dx, LATCH_PIVOT.y, LATCH_PIVOT.z), 0.0115,
                'graphite', vertices=6))

    arm_dir = Vector((0.0, math.cos(LATCH_ANG), math.sin(LATCH_ANG)))
    arm_c = LATCH_PIVOT + arm_dir * 0.0760
    add(cube(PREFIX + 'latch_arm', tuple(arm_c), (0.0220, 0.1520, 0.0170),
             'steel', r=0.0045, rot=(LATCH_ANG, 0.0, 0.0)))
    add(cyl(PREFIX + 'latch_grip',
            tuple(LATCH_PIVOT + arm_dir * 0.1180),
            tuple(LATCH_PIVOT + arm_dir * 0.1780), 0.0135, 'red',
            vertices=24, bev=0.0020))
    add(cyl(PREFIX + 'latch_grip_cap',
            tuple(LATCH_PIVOT + arm_dir * 0.1740),
            tuple(LATCH_PIVOT + arm_dir * 0.1810), 0.0100, 'steel',
            vertices=20, bev=0.0010))
    link_a = LATCH_PIVOT + arm_dir * 0.0960
    link_b = Vector((LATCH_X, -0.3180, 0.7020))
    add(cyl(PREFIX + 'latch_link', tuple(link_a), tuple(link_b), 0.0048,
            'steel', vertices=14))
    for i, t in enumerate((0.30, 0.48, 0.66)):
        add(torus(f'{PREFIX}latch_spring_{i + 1}',
                  tuple(link_a.lerp(link_b, t)), 0.0068, 0.0015,
                  'graphite', 'X', 20, 8))
    add(cube(PREFIX + 'latch_pad', (LATCH_X, -0.3520, 0.6935),
             (0.0620, 0.0480, 0.0190), 'steel', r=0.0035))
    add(cube(PREFIX + 'latch_pad_grip', (LATCH_X, -0.3520, 0.6845),
             (0.0500, 0.0380, 0.0040), 'dark', r=0.0010))
    add(cyl(PREFIX + 'latch_safety_pin', (LATCH_X - 0.0520, -0.3760, 0.7020),
            (LATCH_X - 0.0340, -0.3760, 0.7020), 0.0038, 'steel', vertices=12))
    add(torus(PREFIX + 'latch_safety_ring', (LATCH_X - 0.0545, -0.3760, 0.7020),
              0.0065, 0.0020, 'red', 'X', 20, 8))

    # ---- рама: стойки, поперечина, сигнальный столбик ------------------
    for tag, sx in (('l', -1), ('r', 1)):
        add(cube(f'{PREFIX}post_{tag}_foot', (sx * POST_X, POST_Y, DECK_Z1 + 0.0060),
                 (0.0700, 0.0700, 0.0120), 'graphite', r=0.0040))
        add(cube(f'{PREFIX}post_{tag}', (sx * POST_X, POST_Y,
                                         (POST_Z0 + POST_Z1) * 0.5),
                 (2 * POST_HX, 2 * POST_HY, POST_Z1 - POST_Z0), 'graphite', r=0.0050))
        add(cube(f'{PREFIX}post_{tag}_groove', (sx * POST_X, POST_Y - POST_HY,
                                                (POST_Z0 + POST_Z1) * 0.5),
                 (0.0180, 0.0040, POST_Z1 - POST_Z0 - 0.0600), 'dark', r=0.0015))

    add(cube(PREFIX + 'beam', (0.0, (0.3250 + 0.3980) * 0.5,
                               (BEAM_Z0 + BEAM_Z1) * 0.5),
             (1.1500, 0.0730, BEAM_Z1 - BEAM_Z0), 'ivory', r=0.0060))
    add(cube(PREFIX + 'beam_face', (0.0, 0.3245, (BEAM_Z0 + BEAM_Z1) * 0.5),
             (1.0900, 0.0040, 0.0420), 'ivory', r=0.0025))
    add(cube(PREFIX + 'beam_led', (-0.3600, 0.3210, 0.9360),
             (0.3400, 0.0070, 0.0110), 'cyan', r=0.0030))
    add(cube(PREFIX + 'beam_led_cap', (-0.3600, 0.3200, 0.9360),
             (0.3500, 0.0020, 0.0200), 'graphite', r=0.0020))

    # сигнальный столбик на правом конце поперечины
    add(cyl(PREFIX + 'signal_base', (0.4800, POST_Y, BEAM_Z1),
            (0.4800, POST_Y, BEAM_Z1 + 0.0075), 0.0270, 'graphite', vertices=24,
            bev=0.0015))
    add(cyl(PREFIX + 'signal_body', (0.4800, POST_Y, BEAM_Z1 + 0.0075),
            (0.4800, POST_Y, BEAM_Z1 + 0.0275), 0.0200, 'cyan', vertices=24,
            bev=0.0015))
    add(cyl(PREFIX + 'signal_cap', (0.4800, POST_Y, BEAM_Z1 + 0.0275),
            (0.4800, POST_Y, 1.0000), 0.0200, 'graphite', vertices=24, bev=0.0020))

    # ---- пульт на правой стойке ----------------------------------------
    add(loft(PREFIX + 'panel_body', [
        (PANEL_Z0, 0.0720, 0.0430, 0.0080),
        (PANEL_Z0 + 0.0180, 0.0740, 0.0450, 0.0090),
        (PANEL_Z1 - 0.0140, 0.0740, 0.0450, 0.0090),
        (PANEL_Z1, 0.0700, 0.0400, 0.0080)],
        'graphite', per_corner=7, loc=(0.5040, 0.3070, 0.0)))
    add(cube(PREFIX + 'panel_bezel', (0.5040, 0.2600, 0.8380),
             (0.1220, 0.0060, 0.0720), 'graphite', r=0.0030))
    add(cube(PREFIX + 'panel_screen', (0.5040, 0.2575, 0.8380),
             (0.1080, 0.0030, 0.0600), 'dark', r=0.0015))
    add(sphere(PREFIX + 'panel_led', (0.4370, 0.2580, 0.8690), 0.0042, 'cyan'))
    for i, dx in enumerate((-0.0300, 0.0020, 0.0340)):
        add(cyl(f'{PREFIX}panel_button_{i + 1}', (0.5040 + dx, 0.2610, 0.7760),
                (0.5040 + dx, 0.2540, 0.7760), 0.0072, 'steel', vertices=20,
                bev=0.0012))
        add(cyl(f'{PREFIX}panel_button_ring_{i + 1}',
                (0.5040 + dx, 0.2612, 0.7760),
                (0.5040 + dx, 0.2602, 0.7760), 0.0090, 'graphite', vertices=20))
    add(cyl(PREFIX + 'panel_stop_boss', (0.5560, 0.2610, 0.7710),
            (0.5560, 0.2530, 0.7710), 0.0145, 'graphite', vertices=24))
    add(sphere(PREFIX + 'panel_stop', (0.5560, 0.2480, 0.7710), 0.0125, 'red'))
    add(cube(PREFIX + 'panel_label_plate', (0.5040, 0.2585, 0.7420),
             (0.0700, 0.0030, 0.0140), 'ivory', r=0.0010))

    # ---- шильдик и маркировка на правой боковине ------------------------
    add(cube(PREFIX + 'side_plate', (0.5880, 0.0400, 0.4180),
             (0.0050, 0.0720, 0.0420), 'steel', r=0.0020))
    bm = bmesh.new()
    for dy in (-0.0300, 0.0300):
        bm_cyl(bm, (0.5900, 0.0400 + dy, 0.4240), (0.5915, 0.0400 + dy, 0.4240),
               0.0028, segs=12)
    add(mesh_from_bm(PREFIX + 'side_plate_screws', bm, 'graphite', 30.0))
    add(text(PREFIX + 'label_volts', '230/380 V', 0.0165,
             (0.5872, 0.0400, 0.4820), 'graphite', rot=(math.pi / 2, 0, math.pi / 2)))
    add(text(PREFIX + 'label_ip', 'IP54', 0.0135,
             (0.5872, 0.0400, 0.3740), 'graphite', rot=(math.pi / 2, 0, math.pi / 2)))

    # ---- кабель питания -------------------------------------------------
    add(curve_tube(PREFIX + 'cable', [
        (CONN_X + 0.010, CONN_Y + 0.028, 0.6740),
        (CONN_X + 0.006, 0.3080, 0.7000),
        (CONN_X + 0.010, 0.3400, 0.7900),
        (CONN_X + 0.020, 0.3500, 0.8720),
        (CONN_X + 0.026, 0.3480, 0.9000)], 0.0078, 'dark'))
    add(cyl(PREFIX + 'cable_gland', (CONN_X + 0.026, 0.3480, 0.9120),
            (CONN_X + 0.026, 0.3480, 0.9020), 0.0105, 'steel', vertices=20,
            bev=0.0015))
    add(cyl(PREFIX + 'cable_boot', (CONN_X + 0.008, CONN_Y + 0.036, 0.6800),
            (CONN_X + 0.008, CONN_Y + 0.020, 0.6900), 0.0105, 'graphite',
            vertices=20, r2=0.0082, bev=0.0010))

    # ---- пневматический шланг ------------------------------------------
    add(curve_tube(PREFIX + 'air_hose', [
        (AIR_X, 0.3110, AIR_Z),
        (AIR_X + 0.1100, 0.3300, 0.6720),
        (0.3800, 0.3660, 0.6740),
        (0.5200, 0.3920, 0.6820),
        (0.5760, 0.3950, 0.6680),
        (0.5900, 0.3960, 0.5900),
        (0.5900, 0.3720, 0.4500),
        (0.5870, 0.3400, 0.3360)], 0.0058, 'hose'))
    for i, zc in enumerate((0.5300, 0.4100)):
        add(cube(f'{PREFIX}hose_clip_{i + 1}', (0.5860, 0.3760, zc),
                 (0.0200, 0.0300, 0.0160), 'steel', r=0.0040))
    add(cube(PREFIX + 'hose_bulkhead', (0.5860, 0.3250, 0.3250),
             (0.0140, 0.0560, 0.0560), 'steel', r=0.0045))
    add(cyl(PREFIX + 'hose_tail', (0.5800, 0.3000, 0.3250),
            (0.5700, 0.2780, 0.3250), 0.0095, 'brass', vertices=16,
            r2=0.0075, bev=0.0010))

    # ---- маркировка ----------------------------------------------------
    add(text(PREFIX + 'label_dock', 'SERVICE DOCK', 0.0300,
             (0.0, -0.4007, 0.6300), 'graphite'))
    add(text(PREFIX + 'label_code', 'SRV-DOCK-01', 0.0260,
             (0.0, 0.3237, 0.9220), 'graphite'))
    add(text(PREFIX + 'label_max', 'MAX 80 kg', 0.0160,
             (0.3350, -0.4007, 0.6120), 'graphite'))
    add(text(PREFIX + 'label_pwr', 'PWR', 0.0170,
             (CONN_X, 0.1870, 0.6070), 'ivory', rot=(0, 0, 0)))
    add(text(PREFIX + 'label_air', 'AIR', 0.0170,
             (AIR_X, 0.1880, 0.6070), 'ivory', rot=(0, 0, 0)))
    add(text(PREFIX + 'label_drain', 'DRAIN', 0.0150,
             (DRAIN_X, 0.1880, 0.6070), 'ivory', rot=(0, 0, 0)))
    add(text(PREFIX + 'label_lock', 'LOCK', 0.0130,
             (LATCH_X, -0.3927, 0.7100), 'ivory'))
    add(text(PREFIX + 'label_panel', 'SRV-DOCK-01', 0.0110,
             (0.5040, 0.2570, 0.7420), 'graphite'))

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

    def bb(name):
        o = bpy.data.objects[PREFIX + name]
        a, b = mesh_bbox([o])
        return [round(v, 5) for v in a] + [round(v, 5) for v in b]

    tol = 0.020
    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [1.20, 0.80, 1.00],
        'bbox_ok': bool(abs(size.x - 1.20) <= tol and abs(size.y - 0.80) <= tol
                        and abs(size.z - 1.00) <= tol),
        'floor_contact_mm': round((mn.z - 0.0) * 1000.0, 3),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'tray_depth_mm': round((DECK_Z1 - PAN_Z1) * 1000.0, 1),
        'rail_length_mm': round((RAIL_Y1 - RAIL_RAMP_Y) * 1000.0, 1),
        'rail_top_mm': round(RAIL_Z1 * 1000.0, 1),
        'pin_count': 4,
        'pin_top_mm': round(PIN_TOP * 1000.0, 1),
        'contact_count': 8,
        'lever_tip_mm': bb('latch_grip'),
        'connector_bbox': bb('connector_body'),
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
    scene.view_settings.exposure = -0.05
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

    bpy.ops.mesh.primitive_plane_add(size=4.0,
                                     location=(center.x, center.y, mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, off, energy, sz in (
            ('key', (0.62, -0.82, 0.80), 44.0, 0.90),
            ('fill', (-1.05, -0.78, 0.50), 17.0, 1.30),
            ('rim', (0.10, 0.98, 0.78), 30.0, 1.00)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = center + Vector(off)
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
    # крупный план: фиксатор, штифты, разъём, муфта, поддон
    close_a = Vector((-0.430, -0.400, 0.5850))
    close_b = Vector((0.270, 0.320, 0.7900))
    close_t = (close_a + close_b) * 0.5
    c_close = box_corners(close_a - close_t, close_b - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(objs, fill):
        worst = 0.0
        for o in objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    # для крупного плана кадрируем только детали лотка
    close_objs = []
    for o in mesh_objs:
        a, b = mesh_bbox([o])
        if (a.x >= close_a.x - 0.02 and b.x <= close_b.x + 0.02
                and a.y >= close_a.y - 0.02 and b.y <= close_b.y + 0.02
                and a.z >= close_a.z - 0.02 and b.z <= close_b.z + 0.02):
            close_objs.append(o)

    views = [
        ('3q', (0.72, -0.78, 0.42), center + Vector((0, 0, 0.010)), 68, c_main, 0.90, mesh_objs),
        ('front', (0.05, -1.00, 0.18), center + Vector((0, 0, 0.010)), 70, c_main, 0.90, mesh_objs),
        ('side', (1.00, -0.07, 0.14), center + Vector((0, 0, 0.010)), 70, c_main, 0.90, mesh_objs),
        ('closeup', (0.40, -0.82, 0.46), close_t, 90, c_close, 0.95, close_objs),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, objs in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(6):
            got = max_ndc(objs, fill)
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
        print(f'RENDERED {tag} fill={max_ndc(objs, fill):.3f} objs={len(objs)} {fp}',
              flush=True)
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
    if not (rep['bbox_ok'] and rep['floor_contact_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
