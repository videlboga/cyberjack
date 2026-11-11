"""Standalone builder: structure_portal (STR-PORT-02, «Портал»).

П-образный промышленный портал 1,20 x 0,32 x 1,67 м: две стойки 45x45 в
молочной облицовке на башмаках с косынками, сварная балка (нижняя полка,
стенка, верхняя крышка, четыре поперечных ребра жёсткости, концевые плиты),
монтажная плита под подъёмную ось с 4 x M10, 4 x M12 в полу, вертикальные
направляющие, кабельный лоток с цепью на балке, кабельный канал по стойке,
клеммная коробка 230 В / Ethernet (IP54), шильдик, уровень и шкала высоты.

Движения нет (motion: none) — anim-пустышка не создаётся. Плиты-основания нет.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_structure_portal.py

Выход:
  public/models/machine-modules/components/structure_portal.glb
  docs/plans/blockout/component-library/structure_portal/*.png
  docs/plans/blockout/component-library/structure_portal/report.json

Геометрия (Blender Z-up, метры):
  X — ширина 1,200 (наружные плоскости концевых плит / головки болтов)
  Y — глубина 0,320 (башмаки)
  Z — высота 1,670 (верх балки), низ на z = 0
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/structure_portal'
CID = 'structure_portal'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- габарит (м) ---------------------------------------------------------
W, D, H = 1.200, 0.320, 1.670
HX, HY = W * 0.5, D * 0.5                  # 0.600 / 0.160

POST_S = 0.045                            # труба стойки 45 x 45
POST_X = HX - POST_S * 0.5                # 0.5775 — наружная плоскость на 0.600
POST_Z0, POST_Z1 = 0.022, 1.470

FOOT_W, FOOT_T = 0.155, 0.022             # башмак 0.155 x 0.320 x 0.022
FOOT_CX = HX - FOOT_W * 0.5               # 0.5225

CLAD_W, CLAD_T = 0.056, 0.012             # молочная облицовка стойки
CLAD_X = HX - CLAD_W * 0.5                # 0.572
CLAD_Z0, CLAD_Z1 = 0.160, 1.360
CLAD_Y = POST_S * 0.5 + CLAD_T * 0.5      # 0.0285

BEAM_Z0 = 1.465                           # низ балки
FLANGE_Z1 = 1.479                         # низ..верх нижней полки
BEAM_BODY_Z1 = 1.636                      # верх стенки
CAP_Z0, CAP_Z1 = 1.636, H                 # крышка, 1.670
BEAM_D = 0.150
CAP_D = 0.196
END_W = 0.020                             # концевая плита
BEAM_BODY_X = HX - END_W - 0.0015         # 0.5785
BEAM_BODY_MID = (FLANGE_Z1 + BEAM_BODY_Z1) * 0.5
BEAM_MID = (BEAM_Z0 + CAP_Z1) * 0.5

RIB_W, RIB_D = 0.020, 0.212               # поперечные рёбра: насквозь по Y
RIB_X = (-0.420, -0.140, 0.140, 0.420)

RAIL_X = 0.543                            # внутренняя плоскость облицовки
RAIL_Z0, RAIL_Z1 = 0.300, 1.320

PALETTE = {
    'graphite': (0.098, 0.104, 0.115),
    'steel': (0.706, 0.712, 0.700),
    'ivory': (0.945, 0.937, 0.918),
    'dark': (0.040, 0.043, 0.048),
    'cyan': (0.360, 0.830, 0.880),
    'red': (0.640, 0.070, 0.055),
}
ROUGH = {'graphite': 0.50, 'steel': 0.30, 'ivory': 0.46, 'dark': 0.66,
         'cyan': 0.28, 'red': 0.40}
METAL = {'graphite': 0.15, 'steel': 0.92, 'ivory': 0.0, 'dark': 0.30,
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
        bsdf.inputs['Emission Strength'].default_value = 0.90
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


def bevel(obj, width=0.0015, segments=2, angle=40.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
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


def bm_box(bm, loc, size, rot_y=0.0):
    m = (Matrix.Translation(Vector(loc))
         @ Matrix.Rotation(rot_y, 4, 'Y')
         @ Matrix.Diagonal(Vector((size[0], size[1], size[2], 1.0))))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_cyl(bm, a, b, radius, segs=16):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=radius, radius2=radius, depth=d.length,
                          matrix=m)


def bm_hex(bm, z0, z1, loc_xy, radius):
    bm_cyl(bm, (loc_xy[0], loc_xy[1], z0), (loc_xy[0], loc_xy[1], z1),
           radius, 6)


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0),
         extrude=0.0005):
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
    return bpy.context.object


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ---- башмаки и анкеры M12 ------------------------------------------
    bolt_bm = bmesh.new()
    for sx in (-1, 1):
        t = 'p' if sx > 0 else 'm'
        add(cube(f'{PREFIX}foot_{t}', (sx * FOOT_CX, 0.0, FOOT_T * 0.5),
                 (FOOT_W, D, FOOT_T), 'graphite', r=0.0045))
        add(cube(f'{PREFIX}foot_rib_{t}', (sx * (HX - 0.098), 0.0,
                                           FOOT_T + 0.016),
                 (0.030, D - 0.030, 0.032), 'graphite', r=0.003))
        for dy in (-1, 1):
            bx, by = sx * 0.478, dy * 0.110
            bm_cyl(bolt_bm, (bx, by, FOOT_T), (bx, by, FOOT_T + 0.0042),
                   0.0125, 16)                                  # шайба
            bm_hex(bolt_bm, FOOT_T + 0.0042, FOOT_T + 0.0165, (bx, by), 0.0098)
            bm_cyl(bolt_bm, (bx, by, FOOT_T + 0.0165),
                   (bx, by, FOOT_T + 0.0250), 0.0060, 12)        # шпилька
    add(mesh_from_bm(PREFIX + 'anchor_bolts_m12', bolt_bm, 'steel', 45.0))

    # ---- стойки, облицовка, хомуты, косынки ----------------------------
    for sx in (-1, 1):
        t = 'p' if sx > 0 else 'm'
        px = sx * POST_X
        add(cube(f'{PREFIX}post_core_{t}',
                 (px, 0.0, (POST_Z0 + POST_Z1) * 0.5),
                 (POST_S, POST_S, POST_Z1 - POST_Z0), 'graphite', r=0.0035))
        for i, sy in enumerate((-1, 1)):
            add(cube(f'{PREFIX}post_clad_{t}_{i}',
                     (sx * CLAD_X, sy * CLAD_Y, (CLAD_Z0 + CLAD_Z1) * 0.5),
                     (CLAD_W, CLAD_T, CLAD_Z1 - CLAD_Z0), 'ivory', r=0.004))
        add(cube(f'{PREFIX}post_clad_inner_{t}',
                 (sx * RAIL_X, 0.0, (CLAD_Z0 + CLAD_Z1) * 0.5),
                 (CLAD_T, CLAD_W, CLAD_Z1 - CLAD_Z0), 'ivory', r=0.004))
        for i, z in enumerate((CLAD_Z0 - 0.011, CLAD_Z1 + 0.011)):
            add(cube(f'{PREFIX}post_cap_{t}_{i}', (sx * CLAD_X, 0.0, z),
                     (CLAD_W, CLAD_W + CLAD_T * 2, 0.022), 'steel', r=0.0035))
        for i, sy in enumerate((-1, 1)):
            yy = sy * (CLAD_Y + CLAD_T * 0.5 + 0.005)
            add(tri_plate(f'{PREFIX}foot_gusset_{t}_{i}',
                          [(sx * 0.5550, FOOT_T), (sx * 0.5550, 0.142),
                           (sx * 0.4520, FOOT_T)], yy, 0.010, 'graphite'))
            add(tri_plate(f'{PREFIX}knee_gusset_{t}_{i}',
                          [(sx * 0.5550, BEAM_Z0), (sx * 0.5550, 1.252),
                           (sx * 0.3560, BEAM_Z0)], yy, 0.010, 'graphite'))
        # вертикальные направляющие на внутренней плоскости
        add(cube(f'{PREFIX}guide_rail_{t}',
                 (sx * (RAIL_X - 0.005), -0.006, (RAIL_Z0 + RAIL_Z1) * 0.5),
                 (0.010, 0.030, RAIL_Z1 - RAIL_Z0), 'steel', r=0.0015))
        add(cube(f'{PREFIX}guide_wear_{t}',
                 (sx * (RAIL_X - 0.0120), -0.006,
                  (RAIL_Z0 + RAIL_Z1) * 0.5),
                 (0.004, 0.018, RAIL_Z1 - RAIL_Z0 - 0.020), 'dark', r=0.0008))

    # ---- балка: нижняя полка, стенка, крышка, рёбра --------------------
    add(cube(PREFIX + 'beam_bottom_flange',
             (0.0, 0.0, (BEAM_Z0 + FLANGE_Z1) * 0.5),
             (BEAM_BODY_X * 2, CAP_D, FLANGE_Z1 - BEAM_Z0), 'graphite',
             r=0.0035))
    add(cube(PREFIX + 'beam_web', (0.0, 0.0, BEAM_BODY_MID),
             (BEAM_BODY_X * 2, BEAM_D, BEAM_BODY_Z1 - FLANGE_Z1), 'graphite',
             r=0.0045))
    add(cube(PREFIX + 'beam_cap', (0.0, 0.0, (CAP_Z0 + CAP_Z1) * 0.5),
             (BEAM_BODY_X * 2, CAP_D, CAP_Z1 - CAP_Z0), 'graphite', r=0.0035))
    for i, x in enumerate(RIB_X):
        add(cube(f'{PREFIX}beam_stiffener_{i}',
                 (x, 0.0, (FLANGE_Z1 + BEAM_BODY_Z1) * 0.5),
                 (RIB_W, RIB_D, BEAM_BODY_Z1 - FLANGE_Z1), 'graphite',
                 r=0.0025))

    # концевые плиты + болты заподлицо с габаритом (наружная плоскость 0.600)
    bolt_end = bmesh.new()
    for sx in (-1, 1):
        t = 'p' if sx > 0 else 'm'
        add(cube(f'{PREFIX}beam_end_plate_{t}',
                 (sx * (HX - END_W * 0.5 - 0.0015), 0.0, BEAM_MID),
                 (END_W, CAP_D, CAP_Z1 - BEAM_Z0), 'steel', r=0.0035))
        for j, dz in enumerate((-0.086, -0.029, 0.029, 0.086)):
            for k, dy in enumerate((-0.058, 0.058)):
                bm_cyl(bolt_end, (sx * (HX - 0.0015), dy, BEAM_MID + dz),
                       (sx * HX, dy, BEAM_MID + dz), 0.0076, 16)
    add(mesh_from_bm(PREFIX + 'beam_end_bolts', bolt_end, 'steel', 45.0))

    # монтажная плита под подъёмную ось
    PAD_Z0 = BEAM_Z0 - 0.016
    add(cube(PREFIX + 'mount_pad', (0.0, 0.0, (PAD_Z0 + BEAM_Z0) * 0.5),
             (0.250, 0.140, BEAM_Z0 - PAD_Z0), 'steel', r=0.003))
    add(cyl(PREFIX + 'mount_boss', (0.0, 0.0, PAD_Z0 - 0.010),
            (0.0, 0.0, PAD_Z0), 0.050, 'graphite', 40, bev=0.002))
    add(cyl(PREFIX + 'mount_bore', (0.0, 0.0, PAD_Z0 - 0.0115),
            (0.0, 0.0, PAD_Z0 - 0.0095), 0.026, 'dark', 32))
    bolt_pad = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            bm_cyl(bolt_pad, (sx * 0.092, sy * 0.048, PAD_Z0 - 0.0105),
                   (sx * 0.092, sy * 0.048, PAD_Z0 - 0.008), 0.0125, 16)
            bm_hex(bolt_pad, PAD_Z0 - 0.008, PAD_Z0,
                   (sx * 0.092, sy * 0.048), 0.0085)
    add(mesh_from_bm(PREFIX + 'mount_pad_bolts', bolt_pad, 'steel', 45.0))

    # ---- кабельная цепь под балкой (в проёме, между косынками) ---------
    CH_Z0 = BEAM_Z0 - 0.013               # верх подвеса цепи
    CH_X0, CH_X1 = -0.505, -0.150
    add(cube(PREFIX + 'chain_bracket_p', (CH_X1 + 0.006, 0.0, CH_Z0 + 0.0075),
             (0.030, 0.086, 0.015), 'steel', r=0.0015))
    add(cube(PREFIX + 'chain_bracket_m', (CH_X0 - 0.004, 0.0, CH_Z0 + 0.0075),
             (0.030, 0.086, 0.015), 'steel', r=0.0015))

    chain = bmesh.new()
    N_LINK = 14
    for i in range(N_LINK):
        t = i / (N_LINK - 1)
        x = CH_X0 + (CH_X1 - CH_X0) * t
        z = CH_Z0 - 0.115 * math.sin(math.pi * t)
        ang = -math.atan2(-0.115 * math.pi * math.cos(math.pi * t) / (CH_X1 - CH_X0), 1.0)
        bm_box(chain, (x, 0.0, z), (0.030, 0.030, 0.019), rot_y=ang)
        bm_box(chain, (x + 0.014 * math.cos(ang), 0.0,
                       z - 0.014 * math.sin(ang)),
               (0.012, 0.036, 0.011), rot_y=ang)
    add(mesh_from_bm(PREFIX + 'cable_chain', chain, 'dark', 40.0))

    # кабельный ввод от коробки к началу цепи
    add(curve_tube(PREFIX + 'cable_riser',
                   [(-0.572, -0.048, 1.112),
                    (-0.576, -0.060, 1.250),
                    (-0.560, -0.055, 1.390),
                    (-0.526, -0.024, 1.440),
                    (-0.505, 0.0, 1.452)],
                   0.0062, 'dark'))

    # ---- клеммная коробка 230 В / Ethernet -----------------------------
    JBX, JBZ = -CLAD_X, 1.040
    add(cube(PREFIX + 'power_box_plate', (JBX + 0.0015, -0.0385, JBZ),
             (0.058, 0.008, 0.150), 'steel', r=0.0025))
    add(cube(PREFIX + 'power_box', (JBX + 0.0015, -0.0565, JBZ),
             (0.058, 0.030, 0.130), 'graphite', r=0.004))
    add(cube(PREFIX + 'power_box_lid', (JBX + 0.0020, -0.0755, JBZ),
             (0.060, 0.008, 0.138), 'ivory', r=0.0035))
    add(cube(PREFIX + 'power_inlet_iec', (-0.5810, -0.0845, 1.072),
             (0.030, 0.010, 0.022), 'dark', r=0.0015))
    add(cube(PREFIX + 'power_switch', (-0.5470, -0.0835, 1.012),
             (0.013, 0.008, 0.019), 'red', r=0.0015))
    add(cube(PREFIX + 'net_socket_rj45', (-0.5470, -0.0842, 1.072),
             (0.016, 0.009, 0.014), 'steel', r=0.0012))
    add(cube(PREFIX + 'power_led', (-0.5830, -0.0838, 1.012),
             (0.008, 0.006, 0.008), 'cyan', r=0.0008))
    # вертикальный кабельный канал вниз по стойке до башмака
    add(cube(PREFIX + 'power_channel_base', (JBX, -0.0385, 0.494),
             (0.034, 0.008, 0.900), 'graphite', r=0.0015))
    add(cube(PREFIX + 'power_channel_cover', (JBX, -0.0455, 0.494),
             (0.030, 0.006, 0.880), 'steel', r=0.0012))
    for i, z in enumerate((0.200, 0.500, 0.800)):
        add(cube(f'{PREFIX}power_channel_clip_{i}', (JBX, -0.0495, z),
                 (0.040, 0.014, 0.012), 'steel', r=0.0012))
    add(cube(PREFIX + 'power_channel_end', (JBX, -0.0435, 0.034),
             (0.044, 0.018, 0.012), 'steel', r=0.0015))
    add(cyl(PREFIX + 'power_gland', (JBX, -0.0475, 0.976),
            (JBX, -0.0475, 0.941), 0.0115, 'dark', 20, bev=0.0015))
    add(text(PREFIX + 'label_voltage', '230V~', 0.0072,
             (-0.5810, -0.0802, 1.046), 'dark', extrude=0.0004))
    add(text(PREFIX + 'label_net', 'ETH', 0.0068, (-0.5470, -0.0802, 1.046),
             'dark', extrude=0.0004))

    # ---- шильдик --------------------------------------------------------
    add(cube(PREFIX + 'nameplate', (-0.255, -0.0765, 1.560),
             (0.190, 0.003, 0.070), 'steel', r=0.0015))
    rivets = bmesh.new()
    for dx in (-0.086, 0.086):
        for dz in (-0.028, 0.028):
            bm_cyl(rivets, (-0.255 + dx, -0.0780, 1.560 + dz),
                   (-0.255 + dx, -0.0792, 1.560 + dz), 0.0032, 12)
    add(mesh_from_bm(PREFIX + 'nameplate_rivets', rivets, 'steel', 45.0))
    add(text(PREFIX + 'label_code', 'STR-PORT-02', 0.0135,
             (-0.255, -0.0786, 1.5800), 'dark', extrude=0.0004))
    add(text(PREFIX + 'label_spec', 'IP54   230V / ETHERNET', 0.0070,
             (-0.255, -0.0786, 1.5520), 'dark', extrude=0.0004))
    add(text(PREFIX + 'label_size', 'MAX 120 kg     M12 x 4', 0.0066,
             (-0.255, -0.0786, 1.5340), 'dark', extrude=0.0004))

    # ---- уровень --------------------------------------------------------
    add(cube(PREFIX + 'level_housing', (0.330, -0.0830, 1.560),
             (0.110, 0.016, 0.030), 'graphite', r=0.003))
    add(cube(PREFIX + 'level_window', (0.330, -0.0905, 1.560),
             (0.092, 0.004, 0.013), 'dark', r=0.0012))
    add(cube(PREFIX + 'level_bubble', (0.330, -0.0921, 1.560),
             (0.020, 0.002, 0.008), 'cyan', r=0.0008))
    for i, dx in enumerate((-0.041, 0.041)):
        add(cube(f'{PREFIX}level_tick_{i}', (0.330 + dx, -0.0915, 1.560),
                 (0.002, 0.002, 0.014), 'steel', r=0.0))

    # ---- шкала высоты на стойке +X --------------------------------------
    add(cube(PREFIX + 'scale_plate', (CLAD_X, -0.0365, 0.740),
             (0.030, 0.004, 1.120), 'steel', r=0.0012))
    ticks = bmesh.new()
    z, k = 0.200, 0
    while z <= 1.301:
        long = (k % 2 == 0)
        bm_box(ticks, (0.5665, -0.0390, z),
               (0.016 if long else 0.010, 0.002, 0.0045 if long else 0.0028))
        z += 0.050
        k += 1
    add(mesh_from_bm(PREFIX + 'scale_ticks', ticks, 'cyan', 45.0))
    for i in range(6):
        zz = 0.200 + i * 0.200
        add(text(f'{PREFIX}scale_num_{i}', f'{int(round(zz * 1000))}', 0.0055,
                 (0.5820, -0.0396, zz), 'dark', extrude=0.0003))
    add(text(PREFIX + 'scale_unit', 'mm', 0.0052, (0.5665, -0.0396, 1.276),
             'dark', extrude=0.0003))

    add(text(PREFIX + 'label_ip54', 'IP54', 0.0105, (0.330, -0.0763, 1.490),
             'graphite', extrude=0.0004))

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


def check():
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    names = sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX))
    tol = 0.004

    def cnt(pat):
        rx = re.compile(pat)
        return len([n for n in names if rx.search(n)])

    report = {
        'component': CID,
        'nodes': len(names),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [1.20, 0.32, 1.67],
        'bbox_ok': bool(abs(size.x - W) <= tol and abs(size.y - D) <= tol
                        and abs(size.z - H) <= tol),
        'floor_contact_mm': round(mn.z * 1000.0, 3),
        'motion': 'none',
        'anim': None,
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'posts': cnt(r'__post_core_[mp]$'),
        'feet': cnt(r'__foot_[mp]$'),
        'knee_gussets': cnt(r'__knee_gusset_'),
        'foot_gussets': cnt(r'__foot_gusset_'),
        'beam_stiffeners': cnt(r'__beam_stiffener_'),
        'beam_end_plates': cnt(r'__beam_end_plate_'),
        'anchor_m12': 4,
        'guides': cnt(r'__guide_rail_'),
        'cable_parts': cnt(r'cable_|power_|net_'),
        'nameplate': cnt(r'__nameplate$'),
        'level_marks': cnt(r'scale_|level_'),
        'parts': names,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    report['checks_ok'] = bool(
        report['bbox_ok'] and abs(mn.z) < 0.0015
        and report['material_count'] >= 4 and report['posts'] == 2
        and report['feet'] == 2 and report['knee_gussets'] == 4
        and report['foot_gussets'] == 4 and report['beam_stiffeners'] == 4
        and report['beam_end_plates'] == 2 and report['guides'] == 2
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
    scene.render.resolution_x = 1300
    scene.render.resolution_y = 1000
    scene.render.image_settings.file_format = 'PNG'
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
    bg.inputs['Color'].default_value = (0.780, 0.772, 0.758, 1.0)
    bg.inputs['Strength'].default_value = 0.42

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5
    size = mx - mn
    L = max(size.x, size.y, size.z)

    bpy.ops.mesh.primitive_plane_add(
        size=L * 3.0, location=(center.x, center.y, mn.z - 0.0006))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.560, 0.556, 0.546, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, off, energy, sz in (
            ('key', (2.30, -2.90, 2.20), 420.0, 2.20),
            ('fill', (-2.90, -2.20, 1.10), 110.0, 3.40),
            ('rim', (0.50, 3.00, 2.10), 300.0, 2.60)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = center + Vector(off)
        lo.rotation_euler = (center - lo.location).to_track_quat(
            '-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

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
    close_a = Vector((-0.725, -0.115, 0.930))
    close_b = Vector((-0.360, 0.075, 1.700))
    close_t = (close_a + close_b) * 0.5
    c_close = box_corners(close_a - close_t, close_b - close_t)

    views = [
        ('3q', (0.70, -1.00, 0.40), center + Vector((0, 0, -0.020)), 62,
         c_main, 0.90),
        ('front', (0.02, -1.00, 0.10), center + Vector((0, 0, -0.020)), 70,
         c_main, 0.90),
        ('side', (1.00, -0.28, 0.09), center + Vector((0, 0, -0.020)), 70,
         c_main, 0.90),
        ('closeup', (0.52, -0.86, 0.26), close_t, 85, c_close, 0.94),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat(
            '-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} dist={dist:.3f} {fp}', flush=True)
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
