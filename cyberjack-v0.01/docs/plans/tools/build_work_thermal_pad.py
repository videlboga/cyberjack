"""Standalone builder: work_thermal_pad (WRK-TH-01, «Термо-площадка»).

Тонкая гибкая термо-площадка ~0.199 x 0.143 x 0.017 м (тело 0.176 x 0.130):
графитовая изолирующая подложка -> силиконовое тело -> две зоны дорожек-
змеек (янтарная «тёплая», циановая «прохладная») -> зажимная рамка по
периметру -> шины, уходящие под рамку -> модуль датчика на кромке (+X)
со светодиодом -> силовой ввод со стопором, кабелем и разъёмом ->
быстросъёмный язычок на кромке (-X). Маркировка температуры — шкала
рисок на верхней полке рамки, метки зон — на нижней.

Несущей плиты нет: только гибкий слоистый пакет.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_thermal_pad.py

Выход:
  public/models/machine-modules/components/work_thermal_pad.glb

Геометрия (Blender Z-up, метры, вращений/анимации нет):
  X — длина (датчик и ввод +X, язычок -X), Y — ширина, Z — толщина.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
CID = 'work_thermal_pad'
PREFIX = CID + '__'

# --- габарит и слои (м) --------------------------------------------------
PAD_X, PAD_Y = 0.1760, 0.1300          # гибкий пакет по внешнему контуру рамки
BACK_Z0, BACK_Z1 = 0.0000, 0.0020      # графитовая подложка
BODY_Z0, BODY_Z1 = 0.0020, 0.0072      # силиконовое тело
TRACE_Z0, TRACE_Z1 = 0.0074, 0.0084    # дорожки-змейки (над поверхностью)
BUS_Z0, BUS_Z1 = 0.0074, 0.0080        # шины/подводы
FRAME_Z0, FRAME_Z1 = 0.0020, 0.0100    # зажимная рамка
FRAME_IN_X, FRAME_IN_Y = 0.1600, 0.1140
OPEN_X, OPEN_Y = FRAME_IN_X * 0.5, FRAME_IN_Y * 0.5   # 0.080 / 0.057

# --- нагревательные зоны (дорожки вдоль Y) ------------------------------
ZONE_Y0, ZONE_Y1 = -0.0430, 0.0430
ZONE_RUNS = 7
ZONE_PITCH = 0.01125
WARM_X0 = -0.0750                      # 7 прогонов -> до -0.0075
COOL_X0 = 0.0075                       # 7 прогонов -> до +0.0750
TRACE_W = 0.0034
TURN_SEG = 14

BUS_W = 0.0038
BUS_BOT_Y = -0.0545
BUS_TOP_Y = 0.0545
EDGE_X = 0.0832                        # уход шин под рамку

SENS = dict(cx=0.0850, cy=0.0120, sx=0.0160, sy=0.0260)
SENS_Z1 = 0.0124
CAN_Z1 = 0.0148

INLET = dict(cx=0.0855, cy=-0.0400, sx=0.0170, sy=0.0230, z1=0.0126)

TAB_X0, TAB_X1 = -0.0860, -0.0960      # быстросъёмный язычок
TAB_CY = -0.0200
TAB_HW = 0.0190
TAB_TH = 0.0013

CABLE_Y = INLET['cy']

PALETTE = {
    'body': (0.930, 0.922, 0.900),     # молочный силикон/гель
    'graphite': (0.235, 0.245, 0.265),
    'dark': (0.100, 0.108, 0.122),
    'silver': (0.640, 0.655, 0.660),
    'bus': (0.205, 0.216, 0.235),
    'amber': (0.985, 0.560, 0.110),
    'cool': (0.170, 0.700, 0.890),
    'print': (0.880, 0.870, 0.840),
    'tab': (0.760, 0.735, 0.690),      # окрашенный силикон быстросъёма
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
    bsdf.inputs['Roughness'].default_value = 0.62
    bsdf.inputs['Metallic'].default_value = 0.0
    if role == 'body':
        bsdf.inputs['Roughness'].default_value = 0.52
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.32
        bsdf.inputs['Roughness'].default_value = 0.46
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.18
        bsdf.inputs['Roughness'].default_value = 0.50
    elif role == 'silver':
        bsdf.inputs['Metallic'].default_value = 0.92
        bsdf.inputs['Roughness'].default_value = 0.30
    elif role == 'bus':
        bsdf.inputs['Metallic'].default_value = 0.38
        bsdf.inputs['Roughness'].default_value = 0.46
    elif role == 'amber':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.05
    elif role == 'cool':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.85
    elif role == 'print':
        bsdf.inputs['Roughness'].default_value = 0.58
    elif role == 'tab':
        bsdf.inputs['Roughness'].default_value = 0.66
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
        select_only(obj)
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=32, rings=8):
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
    return bpy.context.object


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


# --- bmesh primitives ----------------------------------------------------
def rounded_outline(sx, sy, r, seg=6):
    """Замкнутый CCW-контур скруглённого прямоугольника в XY."""
    r = max(1e-4, min(r, sx * 0.5 - 1e-5, sy * 0.5 - 1e-5))
    hx, hy = sx * 0.5 - r, sy * 0.5 - r
    pts = []
    for cx, cy, a0 in ((hx, hy, 0.0), (-hx, hy, 90.0),
                       (-hx, -hy, 180.0), (hx, -hy, 270.0)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90.0 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def slab(name, sx, sy, z0, z1, r, role, seg=8, smooth=False, cx=0.0, cy=0.0):
    pts = rounded_outline(sx, sy, r, seg)
    bm = bmesh.new()
    bot = [bm.verts.new((cx + x, cy + y, z0)) for x, y in pts]
    top = [bm.verts.new((cx + x, cy + y, z1)) for x, y in pts]
    n = len(pts)
    bm.faces.new(tuple(reversed(bot)))
    bm.faces.new(tuple(top))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    return mesh_from_bm(name, bm, role, smooth)


def ring_slab(name, sox, soy, six, siy, ro, ri, z0, z1, role, seg=10,
              smooth=False):
    po = rounded_outline(sox, soy, ro, seg)
    pi = rounded_outline(six, siy, ri, seg)
    bm = bmesh.new()
    ob = [bm.verts.new((x, y, z0)) for x, y in po]
    ot = [bm.verts.new((x, y, z1)) for x, y in po]
    ib = [bm.verts.new((x, y, z0)) for x, y in pi]
    it = [bm.verts.new((x, y, z1)) for x, y in pi]
    n = len(po)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ot[i], ot[j], it[j], it[i]))
        bm.faces.new((ib[i], ib[j], ob[j], ob[i]))
        bm.faces.new((ob[i], ob[j], ot[j], ot[i]))
        bm.faces.new((it[i], it[j], ib[j], ib[i]))
    return mesh_from_bm(name, bm, role, smooth)


def bm_box(bm, cx, cy, z0, z1, sx, sy):
    x0, x1 = cx - sx * 0.5, cx + sx * 0.5
    y0, y1 = cy - sy * 0.5, cy + sy * 0.5
    v = [bm.verts.new(p) for p in (
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
              (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new(tuple(v[i] for i in f))


def bm_ribbon(bm, pts, width, z0, z1):
    """Плоская дорожка по ломаной с митром на изломах (без ступенек)."""
    P = [Vector((p[0], p[1])) for p in pts]
    Q = [P[0]]
    for p in P[1:]:
        if (p - Q[-1]).length > 1e-9:
            Q.append(p)
    P = Q
    n = len(P)
    segn = []
    for a, b in zip(P, P[1:]):
        d = b - a
        segn.append(Vector((-d.y, d.x)).normalized())
    hw = width * 0.5
    left, right = [], []
    for i in range(n):
        if i == 0:
            o = segn[0]
        elif i == n - 1:
            o = segn[-1]
        else:
            n1, n2 = segn[i - 1], segn[i]
            bis = n1 + n2
            if bis.length < 1e-9:
                o = n1
            else:
                bis.normalize()
                o = bis * (1.0 / max(0.40, bis.dot(n2)))
        off = o * hw
        left.append(P[i] + off)
        right.append(P[i] - off)
    rows = []
    for l, r in zip(left, right):
        rows.append([bm.verts.new((l.x, l.y, z0)),
                     bm.verts.new((r.x, r.y, z0)),
                     bm.verts.new((r.x, r.y, z1)),
                     bm.verts.new((l.x, l.y, z1))])
    for a, b in zip(rows, rows[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(tuple(reversed(rows[0])))
    bm.faces.new(tuple(rows[-1]))


def ribbon_x(name, cy, stations, thick, role, smooth=True):
    """Ленточка вдоль X: станции (x, z, полуширина) -> изогнутый язычок."""
    bm = bmesh.new()
    rows = []
    for x, z, hw in stations:
        rows.append([
            bm.verts.new((x, cy - hw, z)),
            bm.verts.new((x, cy + hw, z)),
            bm.verts.new((x, cy + hw, z + thick)),
            bm.verts.new((x, cy - hw, z + thick)),
        ])
    for a, b in zip(rows, rows[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(tuple(reversed(rows[0])))
    bm.faces.new(tuple(rows[-1]))
    return mesh_from_bm(name, bm, role, smooth)


# --- геометрия зон -------------------------------------------------------
def serpentine_pts(x0, runs, pitch, y0, y1):
    """Змейка вдоль Y: прогоны по X, повороты полукругом в торцах."""
    pts = [(x0, y0)]
    for k in range(runs):
        x = x0 + k * pitch
        y_end = y0 if k % 2 else y1
        pts.append((x, y_end))
        if k < runs - 1:
            r = pitch * 0.5
            sgn = 1.0 if k % 2 == 0 else -1.0
            cxc = x + r
            for i in range(1, TURN_SEG):
                a = math.pi * i / TURN_SEG
                pts.append((cxc - r * math.cos(a), y_end + sgn * r * math.sin(a)))
    return pts


def serpentine(name, x0, role):
    bm = bmesh.new()
    bm_ribbon(bm, serpentine_pts(x0, ZONE_RUNS, ZONE_PITCH, ZONE_Y0, ZONE_Y1),
              TRACE_W, TRACE_Z0, TRACE_Z1)
    return mesh_from_bm(name, bm, role, smooth=False)


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # 1. графитовая изолирующая подложка (гибкая, без плиты)
    slab(PREFIX + 'backing', PAD_X - 0.0040, PAD_Y - 0.0040,
         BACK_Z0, BACK_Z1, 0.0135, 'graphite', seg=12)
    # 2. силиконовое тело — рабочая поверхность
    body = slab(PREFIX + 'silicone_body', PAD_X - 0.0100, PAD_Y - 0.0100,
                BODY_Z0, BODY_Z1, 0.0128, 'body', seg=12)
    select_only(body)
    bevel(body, 0.0016, 2)

    # 3. зажимная рамка по периметру (профиль-скоба)
    frame = ring_slab(PREFIX + 'clamp_frame', PAD_X, PAD_Y,
                      FRAME_IN_X, FRAME_IN_Y, 0.0145, 0.0098,
                      FRAME_Z0, FRAME_Z1, 'dark', seg=12)
    select_only(frame)
    bevel(frame, 0.0011, 2)

    # 4. зоны нагревательных дорожек: янтарная (тёплая), циановая (прохладная)
    serpentine(PREFIX + 'heater_warm', WARM_X0, 'amber')
    serpentine(PREFIX + 'heater_cool', COOL_X0, 'cool')

    # 5. шины: два полюса, подводы обеих зон уходят под рамку к вводу
    w_last = WARM_X0 + (ZONE_RUNS - 1) * ZONE_PITCH        # -0.0075
    c_last = COOL_X0 + (ZONE_RUNS - 1) * ZONE_PITCH        # +0.0750
    bm = bmesh.new()
    bm_ribbon(bm, [(WARM_X0, ZONE_Y0), (WARM_X0, BUS_BOT_Y)], BUS_W,
              BUS_Z0, BUS_Z1)
    bm_ribbon(bm, [(COOL_X0, ZONE_Y0), (COOL_X0, BUS_BOT_Y)], BUS_W,
              BUS_Z0, BUS_Z1)
    bm_ribbon(bm, [(WARM_X0, BUS_BOT_Y), (EDGE_X, BUS_BOT_Y),
                   (EDGE_X, INLET['cy'] + 0.0060)], BUS_W, BUS_Z0, BUS_Z1)
    mesh_from_bm(PREFIX + 'bus_minus', bm, 'bus', smooth=False)

    bm = bmesh.new()
    bm_ribbon(bm, [(w_last, ZONE_Y1), (w_last, BUS_TOP_Y)], BUS_W,
              BUS_Z0, BUS_Z1)
    bm_ribbon(bm, [(c_last, ZONE_Y1), (c_last, BUS_TOP_Y)], BUS_W,
              BUS_Z0, BUS_Z1)
    bm_ribbon(bm, [(w_last, BUS_TOP_Y), (EDGE_X + 0.0024, BUS_TOP_Y),
                   (EDGE_X + 0.0024, INLET['cy'] - 0.0060)], BUS_W,
              BUS_Z0, BUS_Z1)
    mesh_from_bm(PREFIX + 'bus_plus', bm, 'bus', smooth=False)

    # 6. разделительный гребень между зонами
    cube(PREFIX + 'zone_divider', (0.0, 0.0, (BUS_Z0 + 0.0092) * 0.5),
         (0.0026, 0.0940, 0.0018), 'dark', r=0.0005, smooth=True)

    # 7. модуль датчика температуры на кромке +X
    slab(PREFIX + 'sensor_gasket', SENS['sx'] + 0.0022, SENS['sy'] + 0.0022,
         0.0060, FRAME_Z1 + 0.0002, 0.0080, 'dark', seg=6,
         cx=SENS['cx'], cy=SENS['cy'])
    cube(PREFIX + 'sensor_base', (SENS['cx'], SENS['cy'],
                                  (FRAME_Z1 + SENS_Z1) * 0.5 + 0.0002),
         (SENS['sx'], SENS['sy'], SENS_Z1 - FRAME_Z1), 'dark', r=0.0010,
         smooth=True)
    cube(PREFIX + 'sensor_can', (SENS['cx'], SENS['cy'], (SENS_Z1 + CAN_Z1) * 0.5),
         (SENS['sx'] - 0.0036, SENS['sy'] - 0.0056, CAN_Z1 - SENS_Z1),
         'silver', r=0.0009, smooth=True)
    cube(PREFIX + 'sensor_label', (SENS['cx'] - 0.0008, SENS['cy'] - 0.0086,
                                   CAN_Z1 + 0.00016),
         (0.0078, 0.0030, 0.00032), 'print', r=0.0001)
    cube(PREFIX + 'sensor_rib', (SENS['cx'] - 0.0008, SENS['cy'] - 0.0038,
                                 CAN_Z1 + 0.00014),
         (0.0084, 0.0010, 0.00028), 'dark', r=0.0001)
    torus(PREFIX + 'sensor_led_ring', (SENS['cx'] + 0.0032, SENS['cy'] + 0.0076,
                                       CAN_Z1 + 0.00020),
          0.0022, 0.00042, 'dark', 'Z')
    sphere(PREFIX + 'sensor_led', (SENS['cx'] + 0.0032, SENS['cy'] + 0.0076,
                                   CAN_Z1 + 0.00048), 0.00165, 'amber')
    # сенсорный подвод из поля к датчику
    bm = bmesh.new()
    bm_ribbon(bm, [(0.0560, SENS['cy']), (0.0802, SENS['cy'])], 0.0018,
              BUS_Z0, BUS_Z1 + 0.0002)
    mesh_from_bm(PREFIX + 'sensor_trace', bm, 'cool', smooth=False)

    # 8. силовой ввод со стопором, кабелем и разъёмом
    cube(PREFIX + 'power_inlet', (INLET['cx'], INLET['cy'],
                                  (FRAME_Z1 + INLET['z1']) * 0.5),
         (INLET['sx'], INLET['sy'], INLET['z1'] - FRAME_Z1), 'dark',
         r=0.0014, smooth=True)
    bm = bmesh.new()
    for dy in (-0.0060, 0.0060):
        bm_box(bm, INLET['cx'] - 0.0010, INLET['cy'] + dy,
               INLET['z1'], INLET['z1'] + 0.00034, 0.0090, 0.0044)
    mesh_from_bm(PREFIX + 'power_pads', bm, 'silver', smooth=False)
    cyl(PREFIX + 'strain_relief', (0.0930, CABLE_Y, 0.0068),
        (0.0986, CABLE_Y, 0.0068), 0.0040, 'dark', vertices=18, r2=0.0032,
        bev=0.0006)
    curve_tube(PREFIX + 'cable',
               [(0.0978, CABLE_Y, 0.0068),
                (0.1004, -0.0470, 0.0088),
                (0.0958, -0.0570, 0.0062),
                (0.0880, -0.0662, 0.0034)], 0.0028, 'dark')
    cube(PREFIX + 'connector', (0.0790, -0.0685, 0.0032),
         (0.0170, 0.0120, 0.0062), 'graphite', r=0.0013,
         rot=(0, 0, math.radians(-16)), smooth=True)
    bm = bmesh.new()
    for dy in (-0.0024, 0.0024):
        bm_box(bm, 0.0706, -0.0664 + dy, 0.0020, 0.0046, 0.0050, 0.0012)
    mesh_from_bm(PREFIX + 'connector_pins', bm, 'silver', smooth=False)
    cube(PREFIX + 'connector_latch', (0.0852, -0.0716, 0.0054),
         (0.0062, 0.0046, 0.0016), 'silver', r=0.0004, smooth=True)

    # 9. быстросъёмный язычок на кромке -X
    ribbon_x(PREFIX + 'pull_tab', TAB_CY,
             [(TAB_X0, 0.0078, TAB_HW),
              (-0.0900, 0.0090, TAB_HW),
              (-0.0934, 0.0106, TAB_HW * 0.95),
              (TAB_X1, 0.0126, TAB_HW * 0.78)], TAB_TH, 'tab', smooth=True)
    bm = bmesh.new()
    for dx in (0.0022, 0.0054, 0.0086):
        t = dx / (TAB_X0 - TAB_X1)
        zz = 0.0078 + 0.0044 * t ** 1.25
        bm_box(bm, TAB_X0 - dx, TAB_CY, zz + TAB_TH - 0.00004,
               zz + TAB_TH + 0.00036, 0.0011, TAB_HW * 1.78)
    mesh_from_bm(PREFIX + 'pull_tab_ribs', bm, 'dark', smooth=False)

    # 10. маркировка температуры на верхней полке рамки
    bm = bmesh.new()
    z0, z1 = FRAME_Z1, FRAME_Z1 + 0.00026
    for i in range(9):
        x = -0.0580 + i * 0.0145
        long_tick = i % 2 == 0
        bm_box(bm, x, 0.0608, z0, z1,
               0.0020 if long_tick else 0.0011,
               0.0050 if long_tick else 0.0031)
    mesh_from_bm(PREFIX + 'temp_scale', bm, 'print', smooth=False)
    bm = bmesh.new()
    bm_box(bm, -0.0678, 0.0608, z0, z1, 0.0034, 0.0050)
    mesh_from_bm(PREFIX + 'temp_mark_warm', bm, 'amber', smooth=False)
    bm = bmesh.new()
    bm_box(bm, 0.0678, 0.0608, z0, z1, 0.0034, 0.0050)
    mesh_from_bm(PREFIX + 'temp_mark_cool', bm, 'cool', smooth=False)

    # 11. метки зон на нижней полке рамки
    bm = bmesh.new()
    bm_box(bm, -0.0380, -0.0608, z0, z1, 0.0062, 0.0032)
    mesh_from_bm(PREFIX + 'zone_mark_warm', bm, 'amber', smooth=False)
    bm = bmesh.new()
    bm_box(bm, 0.0380, -0.0608, z0, z1, 0.0062, 0.0032)
    mesh_from_bm(PREFIX + 'zone_mark_cool', bm, 'cool', smooth=False)

    # 12. пустышка-якорь (движения нет)
    empty(PREFIX + 'anim', (0.0, 0.0, 0.0))

    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH':
            o['rotating'] = False


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


def check():
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    report = {
        'component': CID,
        'nodes': len(objs),
        'mesh_nodes': len(meshes),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_size_mm': [round(v * 1000, 2) for v in size],
        'bbox_ok': bool(size.x <= 0.2050 and size.y <= 0.1560 and size.z <= 0.0220),
        'thickness_ok': bool(size.z <= 0.0200),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'node_names': sorted(o.name for o in objs),
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
        'tris': tris,
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
    if not path.is_file() or path.stat().st_size < 10240:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok'] or not rep['thickness_ok']:
        raise SystemExit('checks failed')


main()
