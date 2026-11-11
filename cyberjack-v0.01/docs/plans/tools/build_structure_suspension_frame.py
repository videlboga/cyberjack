"""Standalone builder: structure_suspension_frame (STR-SUSP-06, «Потолочная рама»).

Потолочная несущая балка 2,6 м: стальной двутавр 0,12 x 0,18 м, четыре потолочных
анкера на двух подвесах (резьбовые штанги, талрепы, контргайки), рельс по низу
балки с прижимами, каретка на четырёх роликах с проушиной под подвес, концевые
упоры с резиновыми накладками и концевиками, две точки крепления 150 кг с
жёлтыми маркировочными плашками, кабельный контур (ввод, гирлянда, петля,
распределительная коробка, стояк к потолку), шильдик и маркировка длины.

Напольной плиты нет; вращений и анимации нет (motion: none).

Не зависит от build_component_library.py / build_*, другие GLB не трогает.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_structure_suspension_frame.py

Выход:
  public/models/machine-modules/components/structure_suspension_frame.glb
  docs/plans/blockout/component-library/structure_suspension_frame/*.png
  docs/plans/blockout/component-library/structure_suspension_frame/report.json

Геометрия (Blender Z-up, метры):
  X — длина балки 2,600 (от -1,300 до +1,300)
  Y — глубина 0,200 (потолочные плиты 0,20 x 0,17)
  Z — высота подвеса 0,620: потолочные плиты 0,596..0,620, балка 0,300..0,480,
      рельс 0,238..0,300, каретка 0,128..0,280, проушина до 0,000
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/structure_suspension_frame'
CID = 'structure_suspension_frame'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- габарит -------------------------------------------------------------
LEN_H = 1.300                          # X: -1,300 .. +1,300 -> 2,600
CEIL_Z = 0.620                         # верх bbox (потолочные плиты)

# --- потолочные анкеры и подвесы ----------------------------------------
PLATE_Z0, PLATE_Z1 = 0.596, 0.620
PLATE_SX, PLATE_SY = 0.170, 0.200      # SY даёт ровно Y = 0,200
HANGER_X = (-0.980, 0.980)
ROD_DX = 0.052                         # две штанги на подвес
ROD_R = 0.0105
ROD_Z0, ROD_Z1 = 0.452, PLATE_Z0
NUT_R, NUT_H = 0.0190, 0.0240
TB_R, TB_Z0, TB_Z1 = 0.0225, 0.498, 0.578      # корпус талрепа

# --- балка (двутавр 0,12 x 0,18) -----------------------------------------
BEAM_Z0, BEAM_Z1 = 0.300, 0.480
BF_W, BF_T = 0.120, 0.024              # полка: ширина Y, толщина Z
WEB_T = 0.036                          # стенка: толщина Y
CLEVIS_Z0, CLEVIS_Z1 = 0.480, 0.492

# --- рельс ---------------------------------------------------------------
RAIL_X0, RAIL_X1 = -1.242, 1.242
RAIL_PAD_Z0, RAIL_PAD_Z1 = 0.288, 0.300
RAIL_WEB_Z0, RAIL_WEB_Z1 = 0.252, 0.288
RAIL_WEB_W = 0.056
RAIL_FL_Z0, RAIL_FL_Z1 = 0.238, 0.252
RAIL_FL_W = 0.096

# --- каретка -------------------------------------------------------------
CX = 0.180                             # положение каретки по X
CA_HX = 0.115                          # половина длины по X
CA_SIDE_Y0, CA_SIDE_Y1 = 0.044, 0.062
CA_SIDE_Z0, CA_SIDE_Z1 = 0.150, 0.280
CA_BOT_Z0, CA_BOT_Z1 = 0.128, 0.150
ROLLER_R, ROLLER_T = 0.0170, 0.0130
ROLLER_Z = RAIL_FL_Z1 + ROLLER_R - 0.0008
ROLLER_DX = 0.074
LUG_Z0, LUG_Z1 = 0.052, 0.128
EYE_Z, EYE_R, EYE_r = 0.041, 0.030, 0.011      # низ проушины = 0,000

# --- точки крепления 150 кг ---------------------------------------------
LP_X = (-0.620, 0.620)
LP_Y = -0.060
LP_TAG_Z0, LP_TAG_Z1 = 0.286, 0.336
LP_EYE_Z, LP_EYE_R, LP_EYE_r = 0.206, 0.021, 0.0075

# --- концевые упоры ------------------------------------------------------
STOP_X = 1.268
STOP_HX, STOP_HY = 0.026, 0.050
STOP_Z0, STOP_Z1 = 0.244, 0.372

# --- кабельный контур ----------------------------------------------------
CHAIN_Y, CHAIN_Z = -0.070, 0.415
CHAIN_X0, CHAIN_X1 = -1.020, 0.020
BOX_X, BOX_Z0, BOX_Z1 = -1.100, 0.330, 0.460

PALETTE = {
    'graphite': (0.085, 0.090, 0.100),
    'steel': (0.700, 0.708, 0.700),
    'ivory': (0.945, 0.937, 0.918),
    'dark': (0.040, 0.043, 0.048),
    'cyan': (0.360, 0.830, 0.880),
    'red': (0.640, 0.070, 0.055),
    'amber': (0.930, 0.690, 0.055),
}
ROUGH = {'graphite': 0.52, 'steel': 0.32, 'ivory': 0.44, 'dark': 0.62,
         'cyan': 0.30, 'red': 0.42, 'amber': 0.34}
METAL = {'steel': 0.90, 'graphite': 0.14, 'dark': 0.32, 'ivory': 0.0,
         'cyan': 0.0, 'red': 0.0, 'amber': 0.10}
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


def bm_box(bm, loc, size, rot_z=0.0):
    m = (Matrix.Translation(Vector(loc))
         @ Matrix.Rotation(rot_z, 4, 'Z')
         @ Matrix.Diagonal(Vector((size[0], size[1], size[2], 1.0))))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


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
    return obj


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ---- потолочные плиты и анкерный крепёж ---------------------------
    nuts = bmesh.new()
    for i, hx in enumerate(HANGER_X):
        t = 'p' if hx > 0 else 'm'
        add(cube(f'{PREFIX}anchor_plate_{t}', (hx, 0.0, (PLATE_Z0 + PLATE_Z1) * 0.5),
                 (PLATE_SX, PLATE_SY, PLATE_Z1 - PLATE_Z0), 'steel', r=0.005))
        add(cube(f'{PREFIX}anchor_plate_shim_{t}', (hx, 0.0, 0.5885),
                 (PLATE_SX - 0.024, PLATE_SY - 0.030, 0.015), 'dark', r=0.003))
        for sx in (-1, 1):
            for sy in (-1, 1):
                bx, by = hx + sx * 0.062, sy * 0.074
                # гайка снизу плиты + шпилька анкера
                bm_box(nuts, (bx, by, 0.5825), (0.030, 0.030, 0.027))
                bm_box(nuts, (bx, by, 0.5965), (0.038, 0.038, 0.008))
    add(mesh_from_bm(PREFIX + 'anchor_nuts', nuts, 'graphite', 45.0))

    # ---- резьбовые штанги, талрепы, контргайки ------------------------
    rods = bmesh.new()
    for i, hx in enumerate(HANGER_X):
        t = 'p' if hx > 0 else 'm'
        for sx in (-1, 1):
            u = 'a' if sx < 0 else 'b'
            rx = hx + sx * ROD_DX
            add(cyl(f'{PREFIX}hanger_rod_{t}_{u}', (rx, 0.0, ROD_Z0),
                    (rx, 0.0, ROD_Z1), ROD_R, 'steel', 16, bev=0.0012))
            bm_box(rods, (rx, 0.0, 0.4725), (0.032, 0.032, NUT_H))
            bm_box(rods, (rx, 0.0, 0.587), (0.030, 0.030, 0.020))
        add(cyl(f'{PREFIX}hanger_turnbuckle_{t}', (hx, 0.0, TB_Z0),
                (hx, 0.0, TB_Z1), TB_R, 'graphite', 24, bev=0.002))
        add(cube(f'{PREFIX}hanger_turnbuckle_flat_{t}', (hx, 0.0, (TB_Z0 + TB_Z1) * 0.5),
                 (TB_R * 1.9, TB_R * 1.35, 0.086), 'graphite', r=0.004))
        # косынки подвеса на верхней полке балки
        add(cube(f'{PREFIX}beam_clevis_{t}', (hx, 0.0, (CLEVIS_Z0 + CLEVIS_Z1) * 0.5),
                 (0.150, 0.150, CLEVIS_Z1 - CLEVIS_Z0), 'steel', r=0.004))
    add(mesh_from_bm(PREFIX + 'hanger_nuts', rods, 'graphite', 45.0))

    # ---- балка: двутавр 0,12 x 0,18 ------------------------------------
    add(cube(PREFIX + 'beam_top_flange', (0.0, 0.0, BEAM_Z1 - BF_T * 0.5),
             (2 * LEN_H, BF_W, BF_T), 'steel', r=0.0035))
    add(cube(PREFIX + 'beam_bottom_flange', (0.0, 0.0, BEAM_Z0 + BF_T * 0.5),
             (2 * LEN_H, BF_W, BF_T), 'steel', r=0.0035))
    add(cube(PREFIX + 'beam_web', (0.0, 0.0, (BEAM_Z0 + BEAM_Z1) * 0.5),
             (2 * LEN_H, WEB_T, BEAM_Z1 - BEAM_Z0 - 2 * BF_T), 'steel', r=0.0025))
    for sx in (-1, 1):
        add(cube(f'{PREFIX}beam_end_cap_{"p" if sx > 0 else "m"}',
                 (sx * (LEN_H - 0.016), 0.0, (BEAM_Z0 + BEAM_Z1) * 0.5),
                 (0.032, BF_W * 0.98, BEAM_Z1 - BEAM_Z0 - 0.004), 'graphite', r=0.004))
    # рёбра жёсткости стенки
    ribs = bmesh.new()
    for xx in (-1.060, -0.400, 0.400, 1.060):
        for sy in (-1, 1):
            bm_box(ribs, (xx, sy * (WEB_T * 0.5 + 0.006), 0.390),
                   (0.016, 0.012, 0.116))
    add(mesh_from_bm(PREFIX + 'beam_ribs', ribs, 'graphite', 40.0))

    # ---- рельс ----------------------------------------------------------
    add(cube(PREFIX + 'rail_pad', (0.0, 0.0, (RAIL_PAD_Z0 + RAIL_PAD_Z1) * 0.5),
             (RAIL_X1 - RAIL_X0, 0.076, RAIL_PAD_Z1 - RAIL_PAD_Z0), 'dark', r=0.002))
    add(cube(PREFIX + 'rail_body', (0.0, 0.0, (RAIL_WEB_Z0 + RAIL_WEB_Z1) * 0.5),
             (RAIL_X1 - RAIL_X0, RAIL_WEB_W, RAIL_WEB_Z1 - RAIL_WEB_Z0), 'steel', r=0.003))
    add(cube(PREFIX + 'rail_head', (0.0, 0.0, (RAIL_FL_Z0 + RAIL_FL_Z1) * 0.5),
             (RAIL_X1 - RAIL_X0, RAIL_FL_W, RAIL_FL_Z1 - RAIL_FL_Z0), 'steel', r=0.003))
    add(cube(PREFIX + 'rail_wear_strip', (0.0, 0.0, RAIL_FL_Z1 + 0.0012),
             (RAIL_X1 - RAIL_X0 - 0.036, 0.011, 0.0024), 'dark', r=0.0008))

    clamps = bmesh.new()
    for i in range(7):
        x = -1.140 + i * 0.380
        for sy in (-1, 1):
            bm_box(clamps, (x, sy * 0.042, 0.2965), (0.030, 0.030, 0.013))
            bm_box(clamps, (x, sy * 0.062, 0.2900), (0.026, 0.012, 0.026))
    add(mesh_from_bm(PREFIX + 'rail_clamps', clamps, 'graphite', 40.0))

    # ---- концевые упоры + концевики ------------------------------------
    for sx in (-1, 1):
        t = 'p' if sx > 0 else 'm'
        add(cube(f'{PREFIX}end_stop_{t}', (sx * STOP_X, 0.0, (STOP_Z0 + STOP_Z1) * 0.5),
                 (2 * STOP_HX, 2 * STOP_HY, STOP_Z1 - STOP_Z0), 'graphite', r=0.006))
        add(cube(f'{PREFIX}end_stop_pad_{t}',
                 (sx * (STOP_X - STOP_HX - 0.008), 0.0, (STOP_Z0 + STOP_Z1) * 0.5 - 0.010),
                 (0.016, 0.072, 0.096), 'red', r=0.004))
        add(cube(f'{PREFIX}end_stop_bolt_{t}', (sx * STOP_X, 0.0, STOP_Z1 + 0.003),
                 (0.040, 0.052, 0.010), 'steel', r=0.003))
        # концевик на передней кромке упора
        add(cube(f'{PREFIX}limit_switch_{t}', (sx * (STOP_X - 0.040), -0.050, 0.330),
                 (0.046, 0.036, 0.058), 'red', r=0.004))
        add(cyl(f'{PREFIX}limit_switch_roller_{t}',
                (sx * (STOP_X - 0.040), -0.070, 0.330),
                (sx * (STOP_X - 0.040), -0.092, 0.330), 0.009, 'steel', 14))

    # ---- каретка на роликах с проушиной --------------------------------
    add(cube(PREFIX + 'carriage_side_0', (CX, -(CA_SIDE_Y0 + CA_SIDE_Y1) * 0.5,
                                          (CA_SIDE_Z0 + CA_SIDE_Z1) * 0.5),
             (2 * CA_HX, CA_SIDE_Y1 - CA_SIDE_Y0, CA_SIDE_Z1 - CA_SIDE_Z0),
             'graphite', r=0.006))
    add(cube(PREFIX + 'carriage_side_1', (CX, (CA_SIDE_Y0 + CA_SIDE_Y1) * 0.5,
                                          (CA_SIDE_Z0 + CA_SIDE_Z1) * 0.5),
             (2 * CA_HX, CA_SIDE_Y1 - CA_SIDE_Y0, CA_SIDE_Z1 - CA_SIDE_Z0),
             'graphite', r=0.006))
    add(cube(PREFIX + 'carriage_bottom_plate', (CX, 0.0, (CA_BOT_Z0 + CA_BOT_Z1) * 0.5),
             (2 * CA_HX - 0.010, 0.160, CA_BOT_Z1 - CA_BOT_Z0), 'graphite', r=0.005))
    add(cube(PREFIX + 'carriage_top_tie', (CX, 0.0, CA_SIDE_Z1 - 0.012),
             (2 * CA_HX - 0.018, 0.140, 0.024), 'graphite', r=0.004))
    for i, dx in enumerate((-1, 1)):
        for j, sy in enumerate((-1, 1)):
            rx = CX + dx * ROLLER_DX
            y0 = sy * CA_SIDE_Y1
            y1 = sy * (CA_SIDE_Y1 + ROLLER_T)
            add(cyl(f'{PREFIX}carriage_roller_{i}{j}', (rx, y0, ROLLER_Z),
                    (rx, y1, ROLLER_Z), ROLLER_R, 'steel', 24, bev=0.0018))
            add(cyl(f'{PREFIX}carriage_roller_hub_{i}{j}', (rx, y0 + sy * 0.006, ROLLER_Z),
                    (rx, y1 + sy * 0.002, ROLLER_Z), 0.0072, 'dark', 14))
            add(cyl(f'{PREFIX}carriage_roller_axle_{i}{j}',
                    (rx, sy * 0.020, ROLLER_Z), (rx, y1 + sy * 0.004, ROLLER_Z),
                    0.0048, 'steel', 12))
    # болты боковых щёк каретки + шильдик
    plate_bolts = bmesh.new()
    for sy in (-1, 1):
        for dx in (-1, 1):
            for dz in (-1, 1):
                bm_box(plate_bolts, (CX + dx * 0.082, sy * CA_SIDE_Y1,
                                     0.196 if dz < 0 else 0.242),
                       (0.013, 0.007, 0.013))
    add(mesh_from_bm(PREFIX + 'carriage_bolts', plate_bolts, 'steel', 45.0))
    add(cube(PREFIX + 'carriage_wear_pad_0', (CX, -(CA_SIDE_Y0 - 0.004),
                                              (CA_SIDE_Z0 + CA_SIDE_Z1) * 0.5),
             (2 * CA_HX - 0.030, 0.008, 0.070), 'steel', r=0.003))
    add(cube(PREFIX + 'carriage_wear_pad_1', (CX, (CA_SIDE_Y0 - 0.004),
                                              (CA_SIDE_Z0 + CA_SIDE_Z1) * 0.5),
             (2 * CA_HX - 0.030, 0.008, 0.070), 'steel', r=0.003))
    add(cube(PREFIX + 'carriage_lug', (CX, 0.0, (LUG_Z0 + LUG_Z1) * 0.5),
             (0.070, 0.034, LUG_Z1 - LUG_Z0), 'graphite', r=0.006))
    add(cube(PREFIX + 'carriage_lug_web', (CX, 0.0, LUG_Z1 + 0.008),
             (0.110, 0.120, 0.016), 'graphite', r=0.004))
    add(torus(PREFIX + 'carriage_eye', (CX, 0.0, EYE_Z), EYE_R, EYE_r, 'steel',
              axis='Y', segs=40, rings=10))
    add(cyl(PREFIX + 'carriage_eye_pin', (CX, -0.030, EYE_Z + 0.024),
            (CX, 0.030, EYE_Z + 0.024), 0.0065, 'steel', 14, bev=0.001))
    add(cyl(PREFIX + 'carriage_led', (CX - 0.092, -0.052, 0.238),
            (CX - 0.092, -0.064, 0.238), 0.0105, 'cyan', 16))

    # ---- точки крепления 150 кг (жёлтые метки) ------------------------
    for i, lx in enumerate(LP_X):
        t = 'p' if lx > 0 else 'm'
        add(cube(f'{PREFIX}load_point_{t}_tag', (lx, LP_Y - 0.001,
                                                  (LP_TAG_Z0 + LP_TAG_Z1) * 0.5),
                 (0.104, 0.026, LP_TAG_Z1 - LP_TAG_Z0), 'amber', r=0.004))
        add(cube(f'{PREFIX}load_point_{t}_strap', (lx, LP_Y - 0.002, 0.256),
                 (0.052, 0.016, 0.070), 'graphite', r=0.004))
        add(torus(f'{PREFIX}load_point_{t}_eye', (lx, LP_Y - 0.002, LP_EYE_Z),
                  LP_EYE_R, LP_EYE_r, 'steel', axis='Y', segs=32, rings=10))
        add(cyl(f'{PREFIX}load_point_{t}_bolt', (lx - 0.026, LP_Y + 0.014, 0.312),
                (lx - 0.026, LP_Y - 0.016, 0.312), 0.0085, 'steel', 12))
        add(cyl(f'{PREFIX}load_point_{t}_bolt2', (lx + 0.026, LP_Y + 0.014, 0.312),
                (lx + 0.026, LP_Y - 0.016, 0.312), 0.0085, 'steel', 12))
        add(text(f'{PREFIX}load_point_{t}_label', '150 kg', 0.0150,
                 (lx, LP_Y - 0.0145, (LP_TAG_Z0 + LP_TAG_Z1) * 0.5 + 0.001),
                 'dark'))
        # насечки у метки
        for k, dz in enumerate((0.018, 0.0, -0.018)):
            add(cube(f'{PREFIX}load_point_{t}_tick_{k}',
                     (lx + (0.040 if lx > 0 else -0.040), LP_Y - 0.0146,
                      (LP_TAG_Z0 + LP_TAG_Z1) * 0.5 + dz),
                     (0.014, 0.002, 0.006), 'dark', r=0.0))

    # ---- кабельный контур ----------------------------------------------
    add(cube(PREFIX + 'cable_inlet', (BOX_X, -0.048, (BOX_Z0 + BOX_Z1) * 0.5),
             (0.086, 0.060, BOX_Z1 - BOX_Z0), 'graphite', r=0.008))
    add(cube(PREFIX + 'cable_inlet_gland', (BOX_X, -0.070, 0.444),
             (0.038, 0.026, 0.032), 'steel', r=0.004))
    add(cube(PREFIX + 'cable_box_face', (BOX_X, -0.080, 0.382),
             (0.064, 0.006, 0.096), 'ivory', r=0.003))
    add(cyl(PREFIX + 'cable_box_connector', (BOX_X, -0.080, 0.410),
            (BOX_X, -0.100, 0.410), 0.0115, 'steel', 16, bev=0.0015))
    add(cyl(PREFIX + 'cable_box_led', (BOX_X + 0.020, -0.082, 0.348),
            (BOX_X + 0.020, -0.092, 0.348), 0.0075, 'cyan', 12))
    add(cube(PREFIX + 'cable_box_bracket', (BOX_X, -0.034, 0.470),
             (0.070, 0.050, 0.020), 'graphite', r=0.003))

    chain = bmesh.new()
    n_links = 14
    step = (CHAIN_X1 - CHAIN_X0) / (n_links - 1)
    for i in range(n_links):
        x = CHAIN_X0 + i * step
        bm_box(chain, (x, CHAIN_Y, CHAIN_Z), (0.062, 0.030, 0.020))
        bm_box(chain, (x + step * 0.5, CHAIN_Y, CHAIN_Z + 0.001),
               (step * 0.55, 0.024, 0.012))
    add(mesh_from_bm(PREFIX + 'cable_chain', chain, 'graphite', 40.0))
    for k, xx in enumerate((-0.900, -0.520, -0.130)):
        add(cube(f'{PREFIX}cable_chain_bracket_{k}', (xx, -0.046, 0.392),
                 (0.034, 0.062, 0.022), 'graphite', r=0.004))
    add(curve_tube(PREFIX + 'cable_loop',
                   [(0.020, CHAIN_Y, CHAIN_Z),
                    (0.086, -0.082, 0.372),
                    (0.132, -0.078, 0.320),
                    (0.160, -0.072, 0.284)], 0.0092, 'dark'))
    add(curve_tube(PREFIX + 'cable_riser',
                   [(BOX_X, -0.062, 0.460),
                    (-1.088, -0.070, 0.514),
                    (-1.032, -0.072, 0.568),
                    (-0.982, -0.068, 0.592)], 0.0105, 'dark'))

    # ---- шильдик, маркировка длины, нагрузка ---------------------------
    add(text(PREFIX + 'label_code', 'STR-SUSP-06', 0.0155,
             (-0.230, -0.0616, 0.3125), 'dark'))
    add(text(PREFIX + 'label_length', 'L 2600', 0.0140,
             (0.320, -0.0616, 0.3125), 'dark'))
    add(text(PREFIX + 'label_max', 'MAX 2 x 150 kg', 0.0140,
             (-0.840, -0.0616, 0.3125), 'dark'))
    add(text(PREFIX + 'label_class', 'CEILING RAIL', 0.0125,
             (0.560, -0.0616, 0.3125), 'dark'))
    for sx in (-1, 1):
        t = 'p' if sx > 0 else 'm'
        add(cube(f'{PREFIX}mark_load_{t}', (sx * 0.920, -0.0606,
                                             (BEAM_Z0 + BF_T * 0.5)),
                 (0.120, 0.002, 0.016), 'amber', r=0.0))

    bpy.context.view_layer.update()
    return parts


# --- проверки ------------------------------------------------------------
def mesh_bbox(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objects:
        if o.type not in {'MESH', 'FONT', 'CURVE'}:
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def check():
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.type in {'MESH', 'FONT'}]
    mn, mx = mesh_bbox(objs)
    size = mx - mn
    center = (mn + mx) * 0.5
    names = sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX))
    tol = 0.006

    def cnt(pat):
        rx = re.compile(pat)
        return len([n for n in names if rx.search(n)])

    # фактическая проверка «нет напольной плиты»: ни одна деталь у z~0 не
    # должна быть крупной горизонтальной плитой
    zmin_parts = []
    floor_plate = False
    for o in objs:
        if o.type != 'MESH':
            continue
        a, b = mesh_bbox([o])
        zmin_parts.append((a.z, o.name))
        if a.z < 0.012 and ((b.x - a.x) > 1.5 or (b.y - a.y) > 0.40):
            floor_plate = True
    zmin_parts.sort()
    zmax_parts = sorted(((mesh_bbox([o])[1].z, o.name) for o in objs
                         if o.type == 'MESH'), reverse=True)

    report = {
        'component': CID,
        'code': 'STR-SUSP-06',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [2.6, 0.2, 0.62],
        'bbox_len_ok': bool(abs(size.x - 2.6) <= tol),
        'bbox_passport_ok': bool(abs(size.x - 2.6) <= tol and abs(size.y - 0.2) <= tol
                                 and abs(size.z - 0.62) <= tol),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anchor_plates': cnt(r'__anchor_plate_[mp]$'),
        'anchor_nuts_obj': cnt(r'__anchor_nuts$'),
        'hanger_rods': cnt(r'__hanger_rod_[mp]_[ab]$'),
        'hanger_turnbuckles': cnt(r'__hanger_turnbuckle_[mp]$'),
        'beam_flanges': cnt(r'__beam_(top|bottom)_flange$'),
        'rail_objects': cnt(r'__rail_(pad|body|head)$'),
        'rail_clamps_obj': cnt(r'__rail_clamps$'),
        'end_stops': cnt(r'__end_stop_[mp]$'),
        'end_stop_pads': cnt(r'__end_stop_pad_[mp]$'),
        'carriages': cnt(r'__carriage_bottom_plate$'),
        'rollers': cnt(r'__carriage_roller_[0-9][0-9]$'),
        'eye_lug': cnt(r'__carriage_eye$'),
        'load_points': cnt(r'__load_point_[mp]_tag$'),
        'load_marks_amber': cnt(r'__(load_point_[mp]_tag|mark_load_[mp])$'),
        'cable_parts': cnt(r'__cable_'),
        'labels': cnt(r'__label_'),
        'beam_len_mm': round((mx.x - mn.x) * 1000.0, 1),
        'beam_section_mm': [120, 180],
        'ceil_top_mm': round(mx.z * 1000.0, 1),
        'lowest_point_mm': round(mn.z * 1000.0, 1),
        'floor_plate_present': floor_plate,
        'lowest_part': zmin_parts[0][1],
        'highest_part': zmax_parts[0][1],
        'motion': 'none',
        'animation': None,
        'parts': names,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    report['checks_ok'] = bool(
        report['bbox_passport_ok'] and report['material_count'] >= 4
        and report['anchor_plates'] == 2 and report['anchor_nuts_obj'] == 1
        and report['hanger_rods'] == 4 and report['hanger_turnbuckles'] == 2
        and report['beam_flanges'] == 2 and report['rail_objects'] == 3
        and report['end_stops'] == 2 and report['end_stop_pads'] == 2
        and report['carriages'] == 1 and report['rollers'] == 4
        and report['eye_lug'] == 1 and report['load_points'] == 2
        and 'CJ_amber_100' in report['materials']
        and not report['floor_plate_present']
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
    scene.view_settings.exposure = -0.05
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.755, 0.750, 0.742, 1.0)
    bg.inputs['Strength'].default_value = 0.42

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    # напольной плиты нет намеренно: это потолочный узел, он висит в воздухе
    for name, off, energy, sz in (
            ('key', (1.95, -2.35, 2.10), 300.0, 1.90),
            ('fill', (-2.55, -1.95, 0.55), 68.0, 3.10),
            ('rim', (0.35, 2.45, 1.75), 210.0, 2.30),
            ('top', (0.10, -0.55, 2.05), 90.0, 1.60)):
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
    # крупный план: каретка, ролики, проушина, рельс, точка крепления
    close_a = Vector((0.020, -0.110, 0.030))
    close_b = Vector((0.330, 0.110, 0.300))
    close_t = Vector((0.175, 0.0, 0.165))
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
    if len(close_objs) < 6:
        close_objs = mesh_objs

    views = [
        ('3q', (0.58, -1.00, 0.17), center + Vector((0, 0, 0.006)), 52, c_main, 0.94, mesh_objs, False),
        ('front', (0.02, -1.00, 0.05), center + Vector((0, 0, 0.0)), 55, c_main, 0.95, mesh_objs, False),
        ('side', (1.00, 0.0015, 0.0), Vector((CX, 0.0, 0.310)), 55, c_main, None, mesh_objs, True),
        ('closeup', (0.46, -0.92, 0.30), close_t, 90, c_close, 0.95, close_objs, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, objs, ortho in views:
        dirn = Vector(direction).normalized()
        if ortho:
            # ортогональная проекция вдоль балки: чистый боковой разрез без
            # перспективного наплыва ближнего торца
            cam_data.type = 'ORTHO'
            cam_data.ortho_scale = 0.940
            dist = 8.0
        else:
            cam_data.type = 'PERSP'
            cam_data.lens = lens
            dist = fit_dist(direction, lens, corners)
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        # для вида вдоль длинной оси уточнение по NDC нестабильно (часть точек
        # уходит за камеру) — там кадрируем только по габаритным углам
        for _ in range(8 if fill is not None else 0):
            got = max_ndc(objs, fill)
            if got <= 0.02 or got > 1.60:
                dist *= 1.22
            elif abs(got - fill) < 0.02:
                break
            else:
                dist *= min(1.30, max(0.76, got / fill))
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} fill={max_ndc(objs, fill if fill else 0.9):.3f} '
              f'objs={len(objs)} {fp}', flush=True)
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
    print('REPORT ' + json.dumps({k: v for k, v in rep.items() if k != 'parts'},
                                 ensure_ascii=False), flush=True)
    if not (rep['checks_ok'] and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
