"""Standalone builder: structure_gantry (STR-GANT-03, «Гентри»).

Жёсткая двухосевая рама 3,0 x 2,0 x 2,6 м: четыре стойки с анкерными плитами и
косынками, продольные и поперечные балки с рёбрами, рельсы X на продольных
балках, подвесной мост с рельсами Y, две каретки X (на роликах) и две каретки Y
(ролики + быстросъёмные плиты под головки), кабельный контур (лоток, гирлянда,
петля, распределительная коробка), метки осей X/Y/Z, концевые упоры и
концевики. Плиты-основания нет.

Не зависит от build_component_library.py / build_*.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_structure_gantry.py

Выход:
  public/models/machine-modules/components/structure_gantry.glb
  docs/plans/blockout/component-library/structure_gantry/*.png
  docs/plans/blockout/component-library/structure_gantry/report.json

Геометрия (Blender Z-up, метры):
  X — пролёт 3,0 (рельсы X), Y — глубина 2,0 (ход моста), Z — высота 2,6
  низ на z = 0 (анкерные плиты), верх = 2,600 (корпус каретки X)
  вращения нет (motion: none), анимационная пустышка не нужна
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/structure_gantry'
CID = 'structure_gantry'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- габарит и каркас (м) -----------------------------------------------
POST_X, POST_Y = 1.360, 0.860
POST_S = 0.160
POST_Z0, POST_Z1 = 0.030, 2.240

FOOT_S, FOOT_Z = 0.280, 0.030          # 1,36 + 0,14 = 1,50 / 0,86 + 0,14 = 1,00

BEAM_Z0, BEAM_Z1 = 2.240, 2.460
BEAM_W = 0.170
BEAM_X0, BEAM_X1 = -1.440, 1.440

CROSS_W = 0.160
CROSS_Z0, CROSS_Z1 = 2.260, 2.460
CROSS_Y = 0.940

PAD_Z0, PAD_Z1 = 2.460, 2.472
RAIL_Z0, RAIL_Z1 = 2.472, 2.527
RAIL_W = 0.042

# --- мост и ось Y -------------------------------------------------------
BX = 0.400                              # положение моста по X
BR_Z0, BR_Z1 = 2.100, 2.260
BR_W = 0.160
BR_Y = 0.755
BR_CAP_Z0, BR_CAP_Z1 = 2.260, 2.272
HANGER_Y, HANGER_Z0 = 0.765, 2.250

YRAIL_PAD_X, YRAIL_PAD_T = 0.080, 0.008
YRAIL_X, YRAIL_T = 0.092, 0.012
YRAIL_Z0, YRAIL_Z1 = 2.152, 2.197
YRAIL_Y = 0.660

# --- каретки X (на рельсах X) ------------------------------------------
TRUCK_WX, TRUCK_WY = 0.220, 0.200
TRUCK_Z0, TRUCK_Z1 = 2.530, 2.590
TRUCK_CAP_Z1 = 2.600
JAW_W, JAW_Z0 = 0.024, 2.436
ROLLER_R, ROLLER_Y = 0.0155, 0.037
ROLLER_DX = 0.062

# --- каретки Y (под головки) -------------------------------------------
CARR_Y = (-0.440, 0.400)
CARR_HX, CARR_HY = 0.150, 0.120
CARR_TOP_Z0, CARR_TOP_Z1 = 2.272, 2.294
CARR_BOT_Z0, CARR_BOT_Z1 = 2.085, 2.105
CARR_POST_Y, CARR_POST_T = 0.112, 0.020
QP_Z0, QP_Z1 = 2.055, 2.085
QP_HX, QP_HY = 0.130, 0.115
FLANGE_Z0, FLANGE_Z1 = 2.041, 2.055
SOCK_Z0, SOCK_Z1 = 1.990, 2.041
HEAD_Z0, HEAD_Z1 = 1.962, 1.990

# --- кабельный контур ---------------------------------------------------
TRAY_Y0, TRAY_Y1 = 0.884, 0.984
TRAY_Z0, TRAY_Z1 = 2.460, 2.500
TRAY_X0, TRAY_X1 = -1.230, 0.320

PALETTE = {
    'graphite': (0.085, 0.090, 0.100),
    'steel': (0.700, 0.708, 0.700),
    'ivory': (0.945, 0.937, 0.918),
    'dark': (0.040, 0.043, 0.048),
    'cyan': (0.360, 0.830, 0.880),
    'red': (0.640, 0.070, 0.055),
}
ROUGH = {'graphite': 0.52, 'steel': 0.32, 'ivory': 0.44, 'dark': 0.62,
         'cyan': 0.30, 'red': 0.40}
METAL = {'steel': 0.90, 'graphite': 0.14, 'dark': 0.32, 'ivory': 0.0,
         'cyan': 0.0, 'red': 0.0}
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
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.10
    m.diffuse_color = (*color, 1.0)
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


def tri_plate(name, pts_xz, y, thick, role, sharp=35.0):
    """Треугольная накладка в плоскости XZ, выдавленная по Y."""
    bm = bmesh.new()
    lo = [bm.verts.new((x, y - thick * 0.5, z)) for (x, z) in pts_xz]
    hi = [bm.verts.new((x, y + thick * 0.5, z)) for (x, z) in pts_xz]
    bm.faces.new(tuple(reversed(lo)))
    bm.faces.new(tuple(hi))
    n = len(pts_xz)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    return mesh_from_bm(name, bm, role, sharp)


def bm_box(bm, loc, size, rot_z=0.0, rot_y=0.0):
    m = (Matrix.Translation(Vector(loc))
         @ Matrix.Rotation(rot_z, 4, 'Z')
         @ Matrix.Rotation(rot_y, 4, 'Y')
         @ Matrix.Diagonal(Vector((size[0], size[1], size[2], 1.0))))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0), extrude=0.0008):
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
    return obj


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    def tag(sx, sy):
        return f'{"p" if sx > 0 else "m"}{"p" if sy > 0 else "m"}'

    # ---- анкерные плиты, стойки, косынки ------------------------------
    bolt_bm = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            t = tag(sx, sy)
            px, py = sx * POST_X, sy * POST_Y
            add(cube(f'{PREFIX}anchor_plate_{t}', (px, py, FOOT_Z * 0.5),
                     (FOOT_S, FOOT_S, FOOT_Z), 'graphite', r=0.006))
            add(cube(f'{PREFIX}post_{t}', (px, py, (POST_Z0 + POST_Z1) * 0.5),
                     (POST_S, POST_S, POST_Z1 - POST_Z0), 'graphite', r=0.004))
            add(cube(f'{PREFIX}post_collar_{t}', (px, py, 0.090),
                     (POST_S + 0.030, POST_S + 0.030, 0.126), 'graphite', r=0.007))
            add(cube(f'{PREFIX}post_cap_{t}', (px, py, 2.220),
                     (POST_S + 0.036, POST_S + 0.036, 0.036), 'steel', r=0.005))
            # 2 x M12 в каждой плите, наружу от стойки
            for dy in (-1, 1):
                bx = px + sx * 0.098
                by = py + sy * dy * 0.098
                bm_box(bolt_bm, (bx, by, 0.058), (0.021, 0.021, 0.072))
                bm_box(bolt_bm, (bx, by, 0.0885), (0.036, 0.036, 0.009))
                bm_box(bolt_bm, (bx, by, 0.1010), (0.031, 0.031, 0.018))
    add(mesh_from_bm(PREFIX + 'anchor_bolts', bolt_bm, 'steel', 45.0))

    # ---- продольные балки ---------------------------------------------
    for sy in (-1, 1):
        t = 'p' if sy > 0 else 'm'
        y = sy * POST_Y
        add(cube(f'{PREFIX}beam_long_{t}', (0.0, y, (BEAM_Z0 + BEAM_Z1) * 0.5),
                 (BEAM_X1 - BEAM_X0, BEAM_W, BEAM_Z1 - BEAM_Z0), 'graphite', r=0.005))
        add(cube(f'{PREFIX}beam_long_rib_{t}',
                 (0.0, y + sy * (BEAM_W * 0.5 + 0.008), 2.352),
                 (BEAM_X1 - BEAM_X0 - 0.34, 0.016, 0.130), 'graphite', r=0.004))
        # косынка стойка—балка (жёсткость рамы, треугольная накладка)
        for sx in (-1, 1):
            px = sx * (POST_X - POST_S * 0.5)
            add(tri_plate(f'{PREFIX}knee_brace_{t}_{"p" if sx > 0 else "m"}',
                          [(px, 1.905), (px, BEAM_Z0), (px - sx * 0.470, BEAM_Z0)],
                          y, 0.022, 'graphite'))

    # ---- поперечные балки ---------------------------------------------
    for sx in (-1, 1):
        t = 'p' if sx > 0 else 'm'
        add(cube(f'{PREFIX}beam_cross_{t}', (sx * POST_X, 0.0,
                                             (CROSS_Z0 + CROSS_Z1) * 0.5),
                 (CROSS_W, CROSS_Y * 2, CROSS_Z1 - CROSS_Z0), 'graphite', r=0.005))
        add(cube(f'{PREFIX}anchor_ceiling_{t}', (sx * POST_X, 0.0, 2.469),
                 (0.190, 0.190, 0.018), 'steel', r=0.004))
        add(cyl(f'{PREFIX}anchor_ceiling_stud_{t}', (sx * POST_X, 0.0, 2.478),
                (sx * POST_X, 0.0, 2.532), 0.0095, 'steel', 12, bev=0.0015))

    for sx in (-1, 1):
        for sy in (-1, 1):
            add(cube(f'{PREFIX}corner_gusset_{tag(sx, sy)}',
                     (sx * 1.245, sy * 0.740, 2.360), (0.260, 0.016, 0.110),
                     'graphite', r=0.003, rot=(0, 0, sx * sy * math.pi / 4)))

    # ---- рельсы X ------------------------------------------------------
    for sy in (-1, 1):
        t = 'p' if sy > 0 else 'm'
        y = sy * POST_Y
        add(cube(f'{PREFIX}rail_x_pad_{t}', (0.0, y, (PAD_Z0 + PAD_Z1) * 0.5),
                 (2.770, 0.100, PAD_Z1 - PAD_Z0), 'dark', r=0.002))
        add(cube(f'{PREFIX}rail_x_{t}', (0.0, y, (RAIL_Z0 + RAIL_Z1) * 0.5),
                 (2.800, RAIL_W, RAIL_Z1 - RAIL_Z0), 'steel', r=0.0035))
        add(cube(f'{PREFIX}rail_x_wear_{t}', (0.0, y, RAIL_Z1 + 0.0015),
                 (2.780, 0.009, 0.005), 'dark', r=0.001))

        clamps = bmesh.new()
        for i in range(7):
            x = -1.200 + i * 0.400
            for dy in (-1, 1):
                bm_box(clamps, (x, y + dy * 0.036, 2.4655),
                       (0.026, 0.026, 0.011))
        add(mesh_from_bm(f'{PREFIX}rail_clamps_{t}', clamps, 'steel', 40.0))

        # концевые упоры
        for sx in (-1, 1):
            tt = 'p' if sx > 0 else 'm'
            add(cube(f'{PREFIX}rail_stop_{t}_{tt}', (sx * 1.386, y, 2.509),
                     (0.048, 0.112, 0.096), 'graphite', r=0.006))
            add(cube(f'{PREFIX}rail_stop_pad_{t}_{tt}', (sx * 1.352, y, 2.509),
                     (0.022, 0.088, 0.074), 'red', r=0.004))

        # концевики: спереди на наружной кромке, сзади — под лотком
        zc = 2.499 if sy < 0 else 2.392
        for sx in (-1, 1):
            tt = 'p' if sx > 0 else 'm'
            add(cube(f'{PREFIX}limit_switch_{t}_{tt}',
                     (sx * 1.286, y + sy * 0.108, zc),
                     (0.052, 0.046, 0.062), 'red', r=0.005))
            add(cyl(f'{PREFIX}limit_roller_{t}_{tt}',
                    (sx * 1.286, y + sy * 0.086, zc),
                    (sx * 1.286, y + sy * 0.070, zc), 0.010, 'steel', 12))

    # ---- каретки X (на рельсах X) -------------------------------------
    for sy in (-1, 1):
        t = 'p' if sy > 0 else 'm'
        y = sy * POST_Y
        add(cube(f'{PREFIX}carriage_x_{t}_body', (BX, y, (TRUCK_Z0 + TRUCK_Z1) * 0.5),
                 (TRUCK_WX, TRUCK_WY, TRUCK_Z1 - TRUCK_Z0), 'ivory', r=0.008))
        add(cube(f'{PREFIX}carriage_x_{t}_top_cap', (BX, y, 2.595),
                 (TRUCK_WX - 0.034, TRUCK_WY - 0.030, 0.010), 'graphite', r=0.004))
        for j, dy in enumerate((-1, 1)):
            add(cube(f'{PREFIX}carriage_x_{t}_jaw_{j}', (BX, y + dy * 0.083,
                                                         (JAW_Z0 + TRUCK_Z0) * 0.5),
                     (TRUCK_WX - 0.012, JAW_W, TRUCK_Z0 - JAW_Z0), 'graphite', r=0.005))
        for i, dx in enumerate((-1, 1)):
            for j, dy in enumerate((-1, 1)):
                rx = BX + dx * ROLLER_DX
                ry = y + dy * ROLLER_Y
                add(cyl(f'{PREFIX}carriage_x_{t}_roller_{i}{j}',
                        (rx, ry - 0.011, 2.492), (rx, ry + 0.011, 2.492),
                        ROLLER_R, 'steel', 20, bev=0.0018))
                add(cyl(f'{PREFIX}carriage_x_{t}_axle_{i}{j}',
                        (rx, ry - dy * 0.052, 2.492), (rx, ry - dy * 0.014, 2.492),
                        0.0055, 'steel', 10))
        add(cube(f'{PREFIX}carriage_x_{t}_hanger', (BX, y - sy * 0.092,
                                                    (HANGER_Z0 + 2.520) * 0.5),
                 (0.150, 0.026, 2.520 - HANGER_Z0), 'steel', r=0.005))
        add(cyl(f'{PREFIX}carriage_x_{t}_led', (BX + 0.076, y - sy * 0.104, 2.520),
                (BX + 0.076, y - sy * 0.104, 2.536), 0.0115, 'cyan', 16))

    # ---- мост ----------------------------------------------------------
    add(cube(PREFIX + 'bridge', (BX, 0.0, (BR_Z0 + BR_Z1) * 0.5),
             (BR_W, BR_Y * 2, BR_Z1 - BR_Z0), 'graphite', r=0.006))
    add(cube(PREFIX + 'bridge_cap', (BX, 0.0, (BR_CAP_Z0 + BR_CAP_Z1) * 0.5),
             (BR_W + 0.012, BR_Y * 2 - 0.020, BR_CAP_Z1 - BR_CAP_Z0), 'steel', r=0.004))
    add(cube(PREFIX + 'bridge_web', (BX, 0.0, 2.180),
             (BR_W + 0.020, BR_Y * 2 - 0.34, 0.036), 'graphite', r=0.004))
    for sy in (-1, 1):
        add(cube(f'{PREFIX}bridge_end_cap_{"p" if sy > 0 else "m"}',
                 (BX, sy * (BR_Y - 0.014), 2.180),
                 (BR_W + 0.030, 0.028, 0.170), 'graphite', r=0.005))

    # ---- рельсы Y на мосту --------------------------------------------
    for sx in (-1, 1):
        t = 'p' if sx > 0 else 'm'
        add(cube(f'{PREFIX}rail_y_pad_{t}',
                 (BX + sx * YRAIL_PAD_X, 0.0, (YRAIL_Z0 + YRAIL_Z1) * 0.5),
                 (YRAIL_PAD_T, YRAIL_Y * 2, YRAIL_Z1 - YRAIL_Z0), 'dark', r=0.002))
        add(cube(f'{PREFIX}rail_y_{t}',
                 (BX + sx * (YRAIL_X + YRAIL_T * 0.5), 0.0,
                  (YRAIL_Z0 + YRAIL_Z1) * 0.5),
                 (YRAIL_T, YRAIL_Y * 2, YRAIL_Z1 - YRAIL_Z0), 'steel', r=0.0025))

    # ---- каретки Y под головки ----------------------------------------
    for ci, yc in enumerate(CARR_Y):
        t = 'a' if ci == 0 else 'b'
        add(cube(f'{PREFIX}carriage_y_{t}_top_plate',
                 (BX, yc, (CARR_TOP_Z0 + CARR_TOP_Z1) * 0.5),
                 (CARR_HX * 2, CARR_HY * 2, CARR_TOP_Z1 - CARR_TOP_Z0), 'ivory', r=0.006))
        add(cube(f'{PREFIX}carriage_y_{t}_bottom_plate',
                 (BX, yc, (CARR_BOT_Z0 + CARR_BOT_Z1) * 0.5),
                 (CARR_HX * 2 - 0.020, CARR_HY * 2 - 0.008,
                  CARR_BOT_Z1 - CARR_BOT_Z0), 'ivory', r=0.005))
        for j, dy in enumerate((-1, 1)):
            add(cube(f'{PREFIX}carriage_y_{t}_post_{j}',
                     (BX, yc + dy * CARR_POST_Y,
                      (CARR_BOT_Z0 + CARR_TOP_Z1) * 0.5),
                     (CARR_HX * 2 - 0.030, CARR_POST_T,
                      CARR_TOP_Z1 - CARR_BOT_Z0), 'ivory', r=0.005))
            for i, dx in enumerate((-1, 1)):
                rx = BX + dx * 0.108
                ry = yc + dy * 0.062
                add(cyl(f'{PREFIX}carriage_y_{t}_roller_{j}{i}',
                        (rx, ry - 0.009, 2.163), (rx, ry + 0.009, 2.163),
                        0.0145, 'steel', 20, bev=0.0016))
                add(cube(f'{PREFIX}carriage_y_{t}_lug_{j}{i}',
                         (rx, ry, 2.214), (0.018, 0.034, 0.108),
                         'graphite', r=0.004))
        add(cube(f'{PREFIX}carriage_y_{t}_quick_plate', (BX, yc, (QP_Z0 + QP_Z1) * 0.5),
                 (QP_HX * 2, QP_HY * 2, QP_Z1 - QP_Z0), 'ivory', r=0.006))
        for i, dx in enumerate((-1, 1)):
            for j, dy in enumerate((-1, 1)):
                add(cyl(f'{PREFIX}carriage_y_{t}_qp_bolt_{i}{j}',
                        (BX + dx * 0.104, yc + dy * 0.090, QP_Z0),
                        (BX + dx * 0.104, yc + dy * 0.090, QP_Z0 - 0.010),
                        0.011, 'steel', 12))
        add(cube(f'{PREFIX}carriage_y_{t}_quick_flange', (BX, yc,
                                                         (FLANGE_Z0 + FLANGE_Z1) * 0.5),
                 (0.170, 0.150, FLANGE_Z1 - FLANGE_Z0), 'graphite', r=0.004))
        add(cyl(f'{PREFIX}carriage_y_{t}_socket', (BX, yc, SOCK_Z0),
                (BX, yc, SOCK_Z1), 0.058, 'graphite', 40, bev=0.003))
        add(torus(f'{PREFIX}carriage_y_{t}_socket_ring', (BX, yc, SOCK_Z0 + 0.005),
                  0.052, 0.007, 'steel'))
        add(cyl(f'{PREFIX}carriage_y_{t}_head_disc', (BX, yc, HEAD_Z0),
                (BX, yc, HEAD_Z1), 0.042, 'steel', 40, bev=0.002))
        for i, dx in enumerate((-1, 1)):
            add(cyl(f'{PREFIX}carriage_y_{t}_pin_{i}',
                    (BX + dx * 0.082, yc - QP_HY - 0.014, 2.071),
                    (BX + dx * 0.082, yc + QP_HY + 0.014, 2.071),
                    0.0085, 'steel', 14))
        add(cube(f'{PREFIX}carriage_y_{t}_latch', (BX + 0.118, yc - 0.030, 2.071),
                 (0.034, 0.066, 0.046), 'graphite', r=0.005))
        add(cube(f'{PREFIX}carriage_y_{t}_latch_grip', (BX + 0.142, yc - 0.090, 2.071),
                 (0.020, 0.070, 0.024), 'steel', r=0.004))
        add(cyl(f'{PREFIX}carriage_y_{t}_led', (BX - 0.104, yc - 0.098, 2.090),
                (BX - 0.104, yc - 0.098, 2.104), 0.0115, 'cyan', 16))
        add(text(f'{PREFIX}carriage_y_{t}_label', 'MAX 80', 0.0140,
                 (BX, yc - QP_HY - 0.0015, 2.070), 'dark'))

    # ---- кабельный контур ---------------------------------------------
    add(cube(PREFIX + 'cable_tray_base', ((TRAY_X0 + TRAY_X1) * 0.5,
                                         (TRAY_Y0 + TRAY_Y1) * 0.5, TRAY_Z0 + 0.007),
             (TRAY_X1 - TRAY_X0, TRAY_Y1 - TRAY_Y0, 0.014), 'graphite', r=0.003))
    for k, yy in enumerate((TRAY_Y0 + 0.007, TRAY_Y1 - 0.007)):
        add(cube(f'{PREFIX}cable_tray_lip_{k}', ((TRAY_X0 + TRAY_X1) * 0.5, yy,
                                                TRAY_Z0 + 0.021),
                 (TRAY_X1 - TRAY_X0, 0.011, 0.042), 'graphite', r=0.003))
    for k, xx in enumerate((-1.05, -0.36, 0.28)):
        add(cube(f'{PREFIX}cable_tray_bracket_{k}', (xx, POST_Y + 0.086, 2.446),
                 (0.046, 0.098, 0.034), 'steel', r=0.004))

    chain = bmesh.new()
    for i in range(18):
        x = -1.190 + i * 0.084
        drop = max(0.0, (x - 0.02) / 0.30)
        z = 2.478 - 0.072 * drop * drop
        bm_box(chain, (x, 0.934, z), (0.060, 0.082, 0.026))
        bm_box(chain, (x + 0.042, 0.934, z + 0.002), (0.016, 0.068, 0.019))
    add(mesh_from_bm(PREFIX + 'cable_chain', chain, 'graphite', 40.0))

    add(curve_tube(PREFIX + 'cable_loop',
                   [(0.288, 0.934, 2.470),
                    (0.352, 0.900, 2.418),
                    (0.404, 0.826, 2.330),
                    (0.400, 0.786, 2.286),
                    (0.400, 0.742, 2.262)], 0.0130, 'dark'))
    add(curve_tube(PREFIX + 'cable_head_loop',
                   [(0.478, 0.128, 2.240),
                    (0.520, 0.190, 2.300),
                    (0.548, 0.318, 2.262),
                    (0.536, 0.404, 2.196)], 0.0075, 'dark'))

    add(cube(PREFIX + 'junction_box', (-1.276, 0.790, 1.520),
             (0.110, 0.190, 0.260), 'graphite', r=0.008))
    add(cube(PREFIX + 'junction_face', (-1.276, 0.692, 1.520),
             (0.082, 0.014, 0.196), 'ivory', r=0.004))
    add(cyl(PREFIX + 'junction_connector', (-1.276, 0.682, 1.596),
            (-1.276, 0.634, 1.596), 0.020, 'steel', 20, bev=0.002))
    add(cyl(PREFIX + 'junction_led', (-1.276, 0.684, 1.440), (-1.276, 0.673, 1.440),
            0.010, 'cyan', 16))
    add(curve_tube(PREFIX + 'cable_riser',
                   [(-1.276, 0.682, 1.650),
                    (-1.286, 0.760, 1.860),
                    (-1.270, 0.860, 2.180),
                    (-1.248, 0.924, 2.420),
                    (-1.208, 0.936, 2.462)], 0.0115, 'dark'))
    add(curve_tube(PREFIX + 'cable_feed',
                   [(-1.276, 0.634, 1.596),
                    (-1.292, 0.560, 1.500),
                    (-1.306, 0.640, 1.220),
                    (-1.310, 0.760, 0.520),
                    (-1.300, 0.800, 0.075)], 0.0095, 'dark'))

    # ---- метки осей и шильдики ----------------------------------------
    add(text(PREFIX + 'mark_x', 'X', 0.115, (1.148, -0.9435, 2.352), 'cyan'))
    add(text(PREFIX + 'mark_y', 'Y', 0.095, (BX, -0.7565, 2.176), 'cyan'))
    add(text(PREFIX + 'mark_z', 'Z', 0.100, (1.4385, -0.860, 1.520), 'cyan',
             rot=(math.pi / 2, 0, math.pi / 2)))
    add(text(PREFIX + 'label_code', 'STR-GANT-03', 0.056,
             (-0.560, -0.9435, 2.372), 'ivory'))
    add(text(PREFIX + 'label_max', 'MAX 80 kg / HEAD', 0.036,
             (-0.560, -0.9435, 2.306), 'ivory'))

    ticks = bmesh.new()
    for i in range(13):
        x = -1.200 + i * 0.200
        long = (i % 5 == 0)
        bm_box(ticks, (x, -0.9435, 2.330),
               (0.011 if not long else 0.017, 0.004, 0.042 if long else 0.026))
    add(mesh_from_bm(PREFIX + 'mark_ticks_x', ticks, 'cyan', 45.0))

    ticks_y = bmesh.new()
    for i in range(9):
        y = -0.640 + i * 0.160
        bm_box(ticks_y, (BX, y, 2.158), (0.010, 0.006, 0.026))
    add(mesh_from_bm(PREFIX + 'mark_ticks_y', ticks_y, 'cyan', 45.0))

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
    names = sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX))
    tol = 0.010

    def cnt(pat):
        rx = re.compile(pat)
        return len([n for n in names if rx.search(n)])

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [3.0, 2.0, 2.6],
        'bbox_ok': bool(abs(size.x - 3.0) <= tol and abs(size.y - 2.0) <= tol
                        and abs(size.z - 2.6) <= tol),
        'floor_contact_mm': round((mn.z - 0.0) * 1000.0, 3),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'post_count': cnt(r'__post_[mp][mp]$'),
        'beam_long': cnt(r'__beam_long_[mp]$'),
        'beam_cross': cnt(r'__beam_cross_[mp]$'),
        'knee_braces': cnt(r'__knee_brace_'),
        'rail_x_count': cnt(r'__rail_x_[mp]$'),
        'rail_y_count': cnt(r'__rail_y_[mp]$'),
        'carriage_x_count': cnt(r'__carriage_x_[mp]_body$'),
        'carriage_y_count': cnt(r'__carriage_y_[ab]_quick_plate$'),
        'roller_count': cnt(r'_roller_[0-9]+$'),
        'anchor_plates': cnt(r'__anchor_plate_'),
        'anchor_bolts_m12': 8,
        'rail_top_mm': round(RAIL_Z1 * 1000.0, 1),
        'bridge_bottom_mm': round(BR_Z0 * 1000.0, 1),
        'head_plate_bottom_mm': round(HEAD_Z0 * 1000.0, 1),
        'cable_parts': cnt(r'cable_|junction'),
        'axis_marks': [n for n in names
                       if re.search(r'__mark_[xyz]$', n)],
        'parts': names,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    report['checks_ok'] = bool(
        report['bbox_ok'] and report['floor_contact_ok']
        and report['material_count'] >= 4 and report['post_count'] == 4
        and report['rail_x_count'] == 2 and report['rail_y_count'] == 2
        and report['carriage_x_count'] == 2 and report['carriage_y_count'] == 2
        and report['roller_count'] == 16 and report['anchor_plates'] == 4
        and not report['bad_names'])
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
    scene.view_settings.exposure = -0.10
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.36

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5
    L = max((mx - mn).x, (mx - mn).y, (mx - mn).z)

    bpy.ops.mesh.primitive_plane_add(size=L * 2.6,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.520, 0.516, 0.506, 1.0)
    nb.inputs['Roughness'].default_value = 0.95
    floor.data.materials.append(fm)

    for name, off, energy, sz in (
            ('key', (2.15, -2.70, 2.70), 360.0, 2.00),
            ('fill', (-2.85, -2.15, 1.25), 78.0, 3.40),
            ('rim', (0.40, 2.95, 2.35), 240.0, 2.60)):
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

    def fit_dist(direction, lens, corners, margin=1.10):
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
    # крупный план: каретка Y «b», рельс Y, мост, каретка X с роликами
    close_a = Vector((0.180, -0.020, 1.930))
    close_b = Vector((0.620, 0.990, 2.610))
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

    close_objs = []
    for o in mesh_objs:
        a, b = mesh_bbox([o])
        if (a.x >= close_a.x - 0.03 and b.x <= close_b.x + 0.03
                and a.y >= close_a.y - 0.03 and b.y <= close_b.y + 0.03
                and a.z >= close_a.z - 0.03 and b.z <= close_b.z + 0.03):
            close_objs.append(o)

    views = [
        ('3q', (0.86, -1.00, 0.62), center + Vector((0, 0, -0.010)), 60, c_main, 0.90, mesh_objs),
        ('front', (0.02, -1.00, 0.12), center + Vector((0, 0, -0.030)), 70, c_main, 0.90, mesh_objs),
        ('side', (1.00, 0.03, 0.10), center + Vector((0, 0, -0.030)), 70, c_main, 0.90, mesh_objs),
        ('closeup', (0.66, -0.80, 0.30), close_t, 85, c_close, 0.93, close_objs),
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
    build()
    rep = check(None)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps({k: v for k, v in rep.items() if k != 'parts'},
                                 ensure_ascii=False), flush=True)
    if not (rep['checks_ok'] and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()