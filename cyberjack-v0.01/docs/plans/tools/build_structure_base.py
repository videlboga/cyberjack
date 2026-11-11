"""Standalone builder: structure_base (STR-BASE-01, «Станина»).

Опорная станина 1,28 × 0,84 × 0,24 м под 150 кг: сварная стальная рама
3 мм, молочные композитные панели, 4 регулируемые ножки, 4 × M12 (шаг
0,6 м), монтажные T-пазы, док-площадка, ввод 230 В, Ethernet, кабельный
лоток, шильдик и предупреждающие метки. Не зависит от
build_component_library.py. Движения нет (motion none), anim не нужна.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_structure_base.py

Выход:
  public/models/machine-modules/components/structure_base.glb
  docs/plans/blockout/component-library/structure_base/*.png + report.json

Геометрия (Blender Z-up, метры):
  пол          z = 0
  верх плиты   z = 0.2148
  верх станины z = 0.240 (штыри док-площадки)
  X: -0.640 .. 0.640, Y: -0.420 .. 0.420  (по плите)
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
CID = 'structure_base'
PREFIX = CID + '__'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/structure_base'

# --- паспорт -------------------------------------------------------------
PASSPORT = (1.280, 0.840, 0.240)

# --- ключевые размеры (м) ------------------------------------------------
HX, HY = 0.640, 0.420          # полугабарит плиты
DECK_R = 0.045                 # скругление углов плиты

LEG = 0.045                    # стойка 45×45
CX, CY = 0.5975, 0.3775        # оси стоек (рама 1.24 × 0.80)
Z_LEG0, Z_LEG1 = 0.078, 0.196

Z_SILL0, Z_SILL1 = 0.078, 0.108    # нижняя обвязка 30 мм
Z_PAN0, Z_PAN1 = 0.108, 0.150      # молочные панели 42 мм
Z_RIM0, Z_RIM1 = 0.150, 0.196      # верхняя обвязка 46 мм
Z_DECK0, Z_DECK1 = 0.196, 0.212    # плита (графитовый корпус)
Z_TOP0, Z_TOP1 = 0.212, 0.2148     # молочная накладка плиты

PANEL_T = 0.012
PANEL_REC = 0.006              # утопление панели от наружной плоскости рамы

# ножки
Z_PAD0, Z_PAD1 = 0.000, 0.010       # резиновая пятка
Z_SHIM0, Z_SHIM1 = 0.010, 0.018     # стальная шайба-пята
Z_STEM1 = Z_LEG0                    # резьбовая шпилька до стойки
Z_NUT0, Z_NUT1 = 0.060, 0.078       # регулировочная гайка

# крепление
BOLT_PITCH = 0.600
BOLT_R = 0.0070                # отверстие M12 (Ø14)

# док-площадка
DOCK_X0, DOCK_X1 = 0.280, 0.600
DOCK_Y0, DOCK_Y1 = -0.150, 0.150
Z_DOCK1 = 0.2262
Z_DOCK_RIM = 0.236
Z_DOCK_PIN = 0.240

PALETTE = {
    # роль: (цвет, шероховатость, металличность)
    'steel': ((0.400, 0.415, 0.432), 0.42, 0.58),
    'steel_dark': ((0.280, 0.295, 0.310), 0.46, 0.65),
    'graphite': ((0.165, 0.178, 0.190), 0.55, 0.28),
    'ivory': ((0.925, 0.920, 0.900), 0.46, 0.00),
    'ivory_dim': ((0.820, 0.816, 0.798), 0.54, 0.00),
    'dark': ((0.065, 0.070, 0.080), 0.62, 0.10),
    'red': ((0.620, 0.075, 0.060), 0.38, 0.00),
    'hazard': ((0.880, 0.690, 0.090), 0.42, 0.00),
    'earth': ((0.130, 0.480, 0.260), 0.55, 0.00),
    'rubber': ((0.048, 0.050, 0.055), 0.90, 0.00),
}
MATS = {}


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color, rough, metal = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
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


def prism(name, pts, w0, w1, role, plane='XY', smooth=False):
    """Плоский профиль pts в плоскости (u, v), выдавленный по w0..w1."""
    bm = bmesh.new()

    def vert(u, v, w):
        if plane == 'XY':
            return bm.verts.new((u, v, w))
        if plane == 'XZ':
            return bm.verts.new((u, w, v))
        if plane == 'YZ':
            return bm.verts.new((w, u, v))
        raise ValueError(plane)

    lower = [vert(u, v, w0) for u, v in pts]
    upper = [vert(u, v, w1) for u, v in pts]
    bm.faces.new(lower)
    bm.faces.new(tuple(reversed(upper)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lower[i], lower[j], upper[j], upper[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def rounded_plate(name, hx, hy, z0, z1, radius, role, seg=10):
    pts = []
    corners = ((hx - radius, hy - radius, 0.0),
               (-(hx - radius), hy - radius, math.pi * 0.5),
               (-(hx - radius), -(hy - radius), math.pi),
               (hx - radius, -(hy - radius), math.pi * 1.5))
    for cx, cy, a0 in corners:
        for i in range(seg + 1):
            a = a0 + (math.pi * 0.5) * i / seg
            pts.append((cx + math.cos(a) * radius, cy + math.sin(a) * radius))
    return prism(name, pts, z0, z1, role)


def annulus(name, cx, cy, z0, z1, r_in, r_out, role, segs=32):
    bm = bmesh.new()
    rings = []
    for r in (r_in, r_out):
        for z in (z0, z1):
            ring = [bm.verts.new((cx + math.cos(2 * math.pi * i / segs) * r,
                                  cy + math.sin(2 * math.pi * i / segs) * r, z))
                    for i in range(segs)]
            rings.append(ring)
    ri0, ri1, ro0, ro1 = rings
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((ri0[i], ri0[j], ri1[j], ri1[i]))   # inner wall
        bm.faces.new((ro1[i], ro1[j], ro0[j], ro0[i]))   # outer wall
        bm.faces.new((ri1[i], ri1[j], ro1[j], ro1[i]))   # top
        bm.faces.new((ro0[i], ro0[j], ri0[j], ri0[i]))   # bottom
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, True)


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


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


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ---- 4 регулируемые ножки ------------------------------------------
    feet = []
    for ix, sx in enumerate((-1, 1)):
        for iy, sy in enumerate((-1, 1)):
            tag = f'{ix}{iy}'
            fx, fy = sx * CX, sy * CY
            feet.append((tag, fx, fy))
            cyl(PREFIX + f'foot_pad_{tag}', (fx, fy, Z_PAD0), (fx, fy, Z_PAD1),
                0.040, 'rubber', vertices=32, bev=0.0020)
            cyl(PREFIX + f'foot_shim_{tag}', (fx, fy, Z_SHIM0), (fx, fy, Z_SHIM1),
                0.031, 'steel_dark', vertices=32, bev=0.0012)
            cyl(PREFIX + f'foot_stem_{tag}', (fx, fy, Z_SHIM1 - 0.001),
                (fx, fy, Z_STEM1), 0.0105, 'steel', vertices=18, bev=0.0008)
            cyl(PREFIX + f'foot_nut_{tag}', (fx, fy, Z_NUT0), (fx, fy, Z_NUT1),
                0.0185, 'steel', vertices=6, smooth=False, bev=0.0010)
            cyl(PREFIX + f'foot_lock_{tag}', (fx, fy, Z_NUT0 - 0.009),
                (fx, fy, Z_NUT0 - 0.001), 0.0150, 'steel_dark',
                vertices=6, smooth=False, bev=0.0008)

    # ---- стойки рамы ----------------------------------------------------
    for tag, fx, fy in feet:
        cube(PREFIX + f'leg_{tag}', (fx, fy, (Z_LEG0 + Z_LEG1) * 0.5),
             (LEG, LEG, Z_LEG1 - Z_LEG0), 'steel', r=0.0018)
        # опорная пластина-башмак под стойкой
        cube(PREFIX + f'leg_plate_{tag}', (fx, fy, Z_LEG0 - 0.004),
             (LEG + 0.014, LEG + 0.014, 0.008), 'steel_dark', r=0.0012)

    # ---- нижняя обвязка (профиль 35×30) --------------------------------
    sill_w, sill_h = 0.035, Z_SILL1 - Z_SILL0
    sill_z = (Z_SILL0 + Z_SILL1) * 0.5
    cube(PREFIX + 'rail_sill_front', (0.0, -CY, sill_z),
         (CX * 2 - LEG, sill_w, sill_h), 'steel', r=0.0016)
    cube(PREFIX + 'rail_sill_back', (0.0, CY, sill_z),
         (CX * 2 - LEG, sill_w, sill_h), 'steel', r=0.0016)
    cube(PREFIX + 'rail_sill_left', (-CX, 0.0, sill_z),
         (sill_w, CY * 2, sill_h), 'steel', r=0.0016)
    cube(PREFIX + 'rail_sill_right', (CX, 0.0, sill_z),
         (sill_w, CY * 2, sill_h), 'steel', r=0.0016)

    # ---- верхняя обвязка (45×46) --------------------------------------
    rim_h = Z_RIM1 - Z_RIM0
    rim_z = (Z_RIM0 + Z_RIM1) * 0.5
    cube(PREFIX + 'rail_rim_front', (0.0, -CY, rim_z),
         (CX * 2 - LEG, LEG, rim_h), 'steel', r=0.0018)
    cube(PREFIX + 'rail_rim_back', (0.0, CY, rim_z),
         (CX * 2 - LEG, LEG, rim_h), 'steel', r=0.0018)
    cube(PREFIX + 'rail_rim_left', (-CX, 0.0, rim_z),
         (LEG, CY * 2, rim_h), 'steel', r=0.0018)
    cube(PREFIX + 'rail_rim_right', (CX, 0.0, rim_z),
         (LEG, CY * 2, rim_h), 'steel', r=0.0018)

    # ---- молочные композитные панели (в проёмах, утоплены 6 мм) --------
    pan_z = (Z_PAN0 + Z_PAN1) * 0.5
    pan_h = Z_PAN1 - Z_PAN0
    py = CY + LEG * 0.5 - PANEL_REC - PANEL_T * 0.5
    px = CX + LEG * 0.5 - PANEL_REC - PANEL_T * 0.5
    cube(PREFIX + 'panel_front', (0.0, -py, pan_z),
         (CX * 2 - LEG * 1.02, PANEL_T, pan_h), 'ivory', r=0.0010)
    cube(PREFIX + 'panel_back', (0.0, py, pan_z),
         (CX * 2 - LEG * 1.02, PANEL_T, pan_h), 'ivory', r=0.0010)
    cube(PREFIX + 'panel_left', (-px, 0.0, pan_z),
         (PANEL_T, CY * 2 - LEG * 1.02, pan_h), 'ivory', r=0.0010)
    cube(PREFIX + 'panel_right', (px, 0.0, pan_z),
         (PANEL_T, CY * 2 - LEG * 1.02, pan_h), 'ivory', r=0.0010)

    # крепёж панелей: по 4 винта на сторону
    for i, (sx, sz) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        x = sx * (CX - 0.075)
        z = pan_z + sz * (pan_h * 0.5 - 0.010)
        cyl(PREFIX + f'panel_screw_front_{i}', (x, -py - PANEL_T * 0.5, z),
            (x, -py - PANEL_T * 0.5 - 0.0022, z), 0.0042, 'steel',
            vertices=12, smooth=True)
        cyl(PREFIX + f'panel_screw_back_{i}', (x, py + PANEL_T * 0.5, z),
            (x, py + PANEL_T * 0.5 + 0.0022, z), 0.0042, 'steel',
            vertices=12, smooth=True)
        y = sx * (CY - 0.075)
        cyl(PREFIX + f'panel_screw_side_{i}', (px + PANEL_T * 0.5, y, z),
            (px + PANEL_T * 0.5 + 0.0022, y, z), 0.0042, 'steel',
            vertices=12, smooth=True)
        cyl(PREFIX + f'panel_screw_side_l_{i}', (-px - PANEL_T * 0.5, y, z),
            (-px - PANEL_T * 0.5 - 0.0022, y, z), 0.0042, 'steel',
            vertices=12, smooth=True)

    # жалюзи на передней панели (слева и справа от лотка)
    for i in range(6):
        cube(PREFIX + f'panel_louver_{i}',
             (-0.505 + i * 0.030, -py - PANEL_T * 0.5 - 0.0016, pan_z + 0.002),
             (0.018, 0.0032, pan_h - 0.014), 'dark', r=0.0008)
    for i in range(6):
        cube(PREFIX + f'panel_louver_r{i}',
             (0.300 + i * 0.030, -py - PANEL_T * 0.5 - 0.0016, pan_z + 0.002),
             (0.018, 0.0032, pan_h - 0.014), 'dark', r=0.0008)
    # жалюзи на боковых панелях
    for side, sx in (('r', 1), ('l', -1)):
        for i in range(7):
            y = -0.240 + i * 0.080
            cube(PREFIX + f'panel_louver_side_{side}_{i}',
                 (sx * (px + PANEL_T * 0.5 + 0.0016), y, pan_z + 0.002),
                 (0.0032, 0.020, pan_h - 0.014), 'dark', r=0.0008)

    # ---- плита: графитовый корпус + молочная накладка ------------------
    rounded_plate(PREFIX + 'deck', HX, HY, Z_DECK0, Z_DECK1, DECK_R, 'graphite')
    rounded_plate(PREFIX + 'deck_top', HX - 0.028, HY - 0.028,
                  Z_TOP0, Z_TOP1, DECK_R - 0.016, 'ivory', seg=10)
    # декоративный кант по свесу плиты
    cube(PREFIX + 'deck_edge_front', (0.0, -HY + 0.006, Z_DECK1 - 0.006),
         (HX * 2 - 0.12, 0.010, 0.006), 'steel_dark', r=0.0008)
    cube(PREFIX + 'deck_edge_back', (0.0, HY - 0.006, Z_DECK1 - 0.006),
         (HX * 2 - 0.12, 0.010, 0.006), 'steel_dark', r=0.0008)

    # ---- монтажные T-пазы ---------------------------------------------
    for tag, sy in (('left', -1), ('right', 1)):
        y = sy * 0.165
        xs0, xs1 = -0.555, 0.245
        cube(PREFIX + f'mount_rail_{tag}', ((xs0 + xs1) * 0.5, y, Z_TOP1 + 0.007),
             (xs1 - xs0, 0.038, 0.014), 'graphite', r=0.0012)
        cube(PREFIX + f'mount_slot_{tag}', ((xs0 + xs1) * 0.5, y, Z_TOP1 + 0.0132),
             (xs1 - xs0 - 0.004, 0.015, 0.0036), 'dark', r=0.0006)
        for i, xe in enumerate((xs0, xs1)):
            cube(PREFIX + f'mount_cap_{tag}_{i}', (xe, y, Z_TOP1 + 0.007),
                 (0.010, 0.042, 0.016), 'steel_dark', r=0.0010)

    # ---- 4 × M12, шаг 0.6 м -------------------------------------------
    for ix, sx in enumerate((-1, 1)):
        for iy, sy in enumerate((-1, 1)):
            tag = f'{ix}{iy}'
            hx, hy = sx * BOLT_PITCH * 0.5, sy * BOLT_PITCH * 0.5
            annulus(PREFIX + f'bolt_boss_{tag}', hx, hy, Z_TOP1,
                    Z_TOP1 + 0.0095, BOLT_R, 0.0295, 'steel', segs=40)
            cyl(PREFIX + f'bolt_hole_{tag}', (hx, hy, Z_TOP1 + 0.0004),
                (hx, hy, Z_TOP1 + 0.0010), 0.0066, 'dark', vertices=28)
            annulus(PREFIX + f'bolt_pad_{tag}', hx, hy, Z_TOP1 - 0.0002,
                    Z_TOP1 + 0.0022, 0.0300, 0.0380, 'ivory_dim', segs=40)

    # ---- док-площадка (справа) -----------------------------------------
    dcx = (DOCK_X0 + DOCK_X1) * 0.5
    dcy = (DOCK_Y0 + DOCK_Y1) * 0.5
    dw = DOCK_X1 - DOCK_X0
    dh = DOCK_Y1 - DOCK_Y0
    cube(PREFIX + 'dock_plate', (dcx, dcy, (Z_TOP1 + Z_DOCK1) * 0.5),
         (dw, dh, Z_DOCK1 - Z_TOP1), 'graphite', r=0.0016)
    cube(PREFIX + 'dock_well', (dcx, dcy, Z_DOCK1 + 0.0004),
         (dw - 0.048, dh - 0.048, 0.0016), 'dark', r=0.0008)
    rim_w = 0.014
    rim_zc = (Z_TOP1 + Z_DOCK_RIM) * 0.5
    rim_h2 = Z_DOCK_RIM - Z_TOP1
    cube(PREFIX + 'dock_rim_front', (dcx, DOCK_Y0 + rim_w * 0.5, rim_zc),
         (dw, rim_w, rim_h2), 'graphite', r=0.0018)
    cube(PREFIX + 'dock_rim_back', (dcx, DOCK_Y1 - rim_w * 0.5, rim_zc),
         (dw, rim_w, rim_h2), 'graphite', r=0.0018)
    cube(PREFIX + 'dock_rim_left', (DOCK_X0 + rim_w * 0.5, dcy, rim_zc),
         (rim_w, dh - rim_w * 2, rim_h2), 'graphite', r=0.0018)
    cube(PREFIX + 'dock_rim_right', (DOCK_X1 - rim_w * 0.5, dcy, rim_zc),
         (rim_w, dh - rim_w * 2, rim_h2), 'graphite', r=0.0018)

    # направляющие штыри (верх 0.240)
    for i, sy in enumerate((-1, 1)):
        x = 0.352
        y = dcy + sy * 0.093
        cyl(PREFIX + f'dock_pin_{i}', (x, y, Z_DOCK1), (x, y, Z_DOCK1 + 0.0130),
            0.0080, 'steel', vertices=20, bev=0.0008)
        cyl(PREFIX + f'dock_pin_tip_{i}', (x, y, Z_DOCK1 + 0.0130),
            (x, y, Z_DOCK_PIN), 0.0080, 'steel', vertices=20, r2=0.0048)
        cyl(PREFIX + f'dock_socket_{i}', (x, y, Z_DOCK1 + 0.0006),
            (x, y, Z_DOCK1 + 0.0020), 0.0115, 'dark', vertices=20)

    # разъём дока: корпус + 2×8 контактов
    ccx = DOCK_X1 - 0.042
    cube(PREFIX + 'dock_connector', (ccx, dcy, Z_DOCK1 + 0.0055),
         (0.042, 0.094, 0.011), 'graphite', r=0.0012)
    cube(PREFIX + 'dock_connector_face', (ccx, dcy, Z_DOCK1 + 0.0122),
         (0.030, 0.080, 0.0026), 'dark', r=0.0006)
    bm = bmesh.new()
    for row in range(2):
        for col in range(8):
            px_ = ccx + (row - 0.5) * 0.014
            py_ = dcy + (col - 3.5) * 0.0088
            m = Matrix.Translation((px_, py_, Z_DOCK1 + 0.0123))
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=8,
                                  radius1=0.0022, radius2=0.0022,
                                  depth=0.0030, matrix=m)
    mesh_from_bm(PREFIX + 'dock_connector_pins', bm, 'steel_dark')

    cube(PREFIX + 'dock_label', (dcx - 0.070, DOCK_Y1 - 0.032, Z_DOCK1 + 0.0012),
         (0.086, 0.020, 0.0020), 'ivory_dim', r=0.0006)
    for i in range(3):
        cube(PREFIX + f'dock_label_bar_{i}',
             (dcx - 0.101 + i * 0.017, DOCK_Y1 - 0.032, Z_DOCK1 + 0.0026),
             (0.011, 0.010, 0.0008), 'dark', r=0.0)

    # ---- ввод 230 В / Ethernet на передней обвязке ---------------------
    face_y = -CY - LEG * 0.5                      # наружная плоскость рамы -0.400
    plate_x = -0.235
    plate_z = 0.1705
    cube(PREFIX + 'ctrl_plate', (plate_x, face_y - 0.0035, plate_z),
         (0.520, 0.007, 0.036), 'graphite', r=0.0014)
    cf = face_y - 0.007                          # лицо панели

    # IEC C15/C14
    cube(PREFIX + 'ctrl_inlet_flange', (plate_x - 0.190, cf - 0.0020, plate_z),
         (0.040, 0.0040, 0.028), 'steel_dark', r=0.0010)
    cube(PREFIX + 'ctrl_inlet_body', (plate_x - 0.190, cf - 0.0040, plate_z),
         (0.030, 0.0026, 0.021), 'dark', r=0.0008)
    for i, dx in enumerate((-0.0060, 0.0, 0.0060)):
        cube(PREFIX + f'ctrl_inlet_pin_{i}',
             (plate_x - 0.190 + dx, cf - 0.0052, plate_z - 0.001),
             (0.0032, 0.0016, 0.0066), 'steel_dark', r=0.0004)

    # выключатель
    cube(PREFIX + 'ctrl_switch_bezel', (plate_x - 0.140, cf - 0.0022, plate_z),
         (0.026, 0.0044, 0.030), 'dark', r=0.0010)
    cube(PREFIX + 'ctrl_switch_lever', (plate_x - 0.140, cf - 0.0056, plate_z + 0.003),
         (0.015, 0.0064, 0.015), 'red', r=0.0010)

    # RJ45
    cube(PREFIX + 'ctrl_rj45_body', (plate_x - 0.096, cf - 0.0028, plate_z),
         (0.021, 0.0036, 0.018), 'dark', r=0.0008)
    cube(PREFIX + 'ctrl_rj45_shell', (plate_x - 0.096, cf - 0.0046, plate_z - 0.001),
         (0.019, 0.0028, 0.013), 'steel_dark', r=0.0005)
    cube(PREFIX + 'ctrl_rj45_label', (plate_x - 0.096, cf - 0.0052, plate_z + 0.0125),
         (0.022, 0.0012, 0.0060), 'ivory_dim', r=0.0002)

    # клемма заземления
    cyl(PREFIX + 'ctrl_earth_stud', (plate_x - 0.058, cf - 0.001, plate_z),
        (plate_x - 0.058, cf - 0.007, plate_z), 0.0070, 'steel',
        vertices=16, bev=0.0006)
    cyl(PREFIX + 'ctrl_earth_label', (plate_x - 0.058, cf - 0.0068, plate_z),
        (plate_x - 0.058, cf - 0.0076, plate_z), 0.0086, 'earth', vertices=16)

    # шильдик на панели
    cube(PREFIX + 'nameplate', (plate_x + 0.110, cf - 0.0014, plate_z),
         (0.150, 0.0028, 0.026), 'steel', r=0.0008)
    for i in range(3):
        cube(PREFIX + f'nameplate_bar_{i}',
             (plate_x + 0.110, cf - 0.0028, plate_z + 0.008 - i * 0.0075),
             (0.120 - i * 0.018, 0.0008, 0.0028), 'dark', r=0.0)
    for i, dx in enumerate((-1, 1)):
        cyl(PREFIX + f'nameplate_rivet_{i}',
            (plate_x + 0.110 + dx * 0.066, cf - 0.0026, plate_z),
            (plate_x + 0.110 + dx * 0.066, cf - 0.0034, plate_z),
            0.0024, 'steel_dark', vertices=10)

    # ---- предупреждающая метка на обвязке ------------------------------
    wx = 0.120
    cube(PREFIX + 'warn_label', (wx, face_y - 0.0016, plate_z),
         (0.062, 0.0032, 0.034), 'hazard', r=0.0008)
    prism(PREFIX + 'warn_triangle',
          [(-0.013, -0.0095), (0.013, -0.0095), (0.0, 0.0115)],
          face_y - 0.0032, face_y - 0.0046, 'dark', plane='XZ')
    bpy.data.objects[PREFIX + 'warn_triangle'].location = (wx, 0.0, plate_z)

    # ---- кабельный лоток (правая часть, под свесом плиты) --------------
    tray_y = -0.3995
    tray_z0, tray_z1 = 0.150, 0.186
    tray_d = 0.030
    tray_x0, tray_x1 = 0.215, 0.585
    cube(PREFIX + 'tray_base', ((tray_x0 + tray_x1) * 0.5, tray_y, tray_z0 + 0.003),
         (tray_x1 - tray_x0, tray_d, 0.006), 'steel_dark', r=0.0010)
    cube(PREFIX + 'tray_lip', ((tray_x0 + tray_x1) * 0.5, tray_y - tray_d * 0.5,
                               tray_z0 + 0.013),
         (tray_x1 - tray_x0, 0.005, 0.026), 'steel_dark', r=0.0010)
    cube(PREFIX + 'tray_back', ((tray_x0 + tray_x1) * 0.5, tray_y + tray_d * 0.5,
                                tray_z0 + 0.013),
         (tray_x1 - tray_x0, 0.005, 0.026), 'steel_dark', r=0.0010)
    cube(PREFIX + 'tray_end', (tray_x1, tray_y, tray_z0 + 0.013),
         (0.006, tray_d, 0.026), 'graphite', r=0.0008)
    for i in range(5):
        x = tray_x0 + 0.035 + i * 0.070
        cube(PREFIX + f'tray_rib_{i}', (x, tray_y, tray_z0 + 0.010),
             (0.005, tray_d, 0.014), 'graphite', r=0.0006)
    # перфорация лотка
    for i in range(7):
        x = tray_x0 + 0.022 + i * 0.046
        cube(PREFIX + f'tray_hole_{i}', (x, tray_y - tray_d * 0.5 - 0.0012,
                                         tray_z0 + 0.010),
             (0.020, 0.0026, 0.009), 'dark', r=0.0004)

    # ---- кабели --------------------------------------------------------
    cable = curve_tube(PREFIX + 'cable_power',
                        [(-0.365, cf - 0.003, plate_z - 0.012),
                         (-0.300, -0.404, 0.148),
                         (-0.120, -0.400, 0.160),
                         (0.120, -0.398, 0.164),
                         (0.400, -0.398, 0.164),
                         (0.520, -0.396, 0.168),
                         (0.556, -0.382, 0.196),
                         (0.566, -0.362, 0.2145)],
                        0.0078, 'dark', res=8)
    cable.name = PREFIX + 'cable_power'
    cable.data.name = PREFIX + 'cable_power'

    curve_tube(PREFIX + 'cable_dock',
               [(0.566, -0.352, 0.226),
                (0.552, -0.290, 0.222),
                (0.524, -0.222, 0.219),
                (0.500, -0.170, 0.222),
                (0.492, -0.152, 0.227)],
               0.0058, 'graphite', res=8)

    cyl(PREFIX + 'cable_gland', (0.566, -0.360, Z_TOP1 - 0.002),
        (0.566, -0.360, Z_TOP1 + 0.011), 0.0170, 'steel_dark',
        vertices=20, bev=0.0012)
    cyl(PREFIX + 'cable_gland_nut', (0.566, -0.360, Z_TOP1 + 0.011),
        (0.566, -0.360, Z_TOP1 + 0.016), 0.0115, 'steel',
        vertices=6, smooth=False)

    # ---- земляная метка на правой стойке -------------------------------
    cube(PREFIX + 'earth_label', (CX + LEG * 0.5 + 0.0013, -0.120, Z_SILL1 + 0.013),
         (0.0026, 0.036, 0.022), 'earth', r=0.0006)
    cyl(PREFIX + 'earth_stud', (CX + LEG * 0.5, -0.120, Z_SILL1 + 0.013),
        (CX + LEG * 0.5 + 0.010, -0.120, Z_SILL1 + 0.013), 0.0058, 'steel',
        vertices=14, bev=0.0006)

    # ---- упоры по краю плиты -------------------------------------------
    for i, sy in enumerate((-1, 1)):
        cube(PREFIX + f'deck_stop_{i}', (-0.360, sy * 0.362, Z_TOP1 + 0.008),
             (0.150, 0.020, 0.016), 'steel_dark', r=0.0012)

    bpy.context.view_layer.update()
    return


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
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(objs)
    size = mx - mn
    center = (mn + mx) * 0.5

    report = {
        'component': CID,
        'code': 'STR-BASE-01',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(PASSPORT),
        'bbox_ok': bool(all(abs(size[i] - PASSPORT[i]) <= 0.006 for i in range(3))),
        'floats_from_floor': bool(abs(mn.z) <= 0.001),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'parts': sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'feet': 4,
        'bolt_holes': 4,
        'bolt_pitch_m': BOLT_PITCH,
        'motion': 'none',
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
    bg.inputs['Color'].default_value = (0.640, 0.635, 0.628, 1.0)
    bg.inputs['Strength'].default_value = 0.42

    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(mesh_objs)
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=4.0,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.540, 0.536, 0.528, 1.0)
    nb.inputs['Roughness'].default_value = 0.95
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.50, -0.62, 0.86), 9.60, 0.60),
            ('fill', (-0.62, -0.52, 0.42), 4.20, 0.75),
            ('rim', (0.20, 0.66, 0.66), 6.40, 0.60)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.5))
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
    close_t = Vector((-0.12, -0.30, 0.185))
    c_close = box_corners(Vector((-0.480, -0.412, 0.145)) - close_t,
                          Vector((0.250, -0.330, 0.238)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.72, -0.86, 0.52), center + Vector((0, 0, 0.004)), 68, c_main, 0.90, True),
        ('front', (0.0, -1.0, 0.16), center + Vector((0, 0, 0.002)), 68, c_main, 0.90, True),
        ('side', (1.0, -0.02, 0.14), center + Vector((0, 0, 0.002)), 68, c_main, 0.90, True),
        ('closeup', (0.26, -0.94, 0.22), close_t, 85, c_close, 0.94, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, fit_all in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4):
            if not fit_all:
                break
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
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000 and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
