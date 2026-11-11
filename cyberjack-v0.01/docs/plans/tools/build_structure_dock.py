"""Standalone builder: structure_dock (STR-DOCK-08, «Док»).

Быстросъёмная док-плита 0,60 x 0,60 x 0,10 м для смены модулей и головок:
графитовая плита с фрезерованным карманом, два посадочных штифта и две
опорные площадки, механический фиксатор с рычагом и прижимной губой,
разъёмы питания / данных / жидкости (вверх, под посадку головки),
циановый индикатор посадки, 4 x M12, маркировка.

Не зависит от build_component_library.py / build_*.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_structure_dock.py

Выход:
  public/models/machine-modules/components/structure_dock.glb
  docs/plans/blockout/component-library/structure_dock/*.png
  docs/plans/blockout/component-library/structure_dock/report.json

Геометрия (Blender Z-up, метры):
  X / Y — плита 0,600 x 0,600, Z — 0 .. 0,0995 (рычаг фиксатора)
  низ на z = 0 (заходной пояс), верх плиты 0,048, дно кармана 0,036
  вращения нет (motion: none), анимационная пустышка не нужна
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector, Matrix
from bpy_extras.object_utils import world_to_camera_view

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/structure_dock'
CID = 'structure_dock'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- габарит (м) ---------------------------------------------------------
HX = 0.300                 # половина плиты по X и Y
H_TOP = 0.048              # верх плиты
H_FOOT = 0.006             # заходной пояс (плита стоит на нём)
HX_FOOT = 0.288
POCKET_HALF = 0.200        # фрезерованный карман 0,40 x 0,40
POCKET_Z = 0.036           # дно кармана (глубина 12 мм)
RIM = HX - POCKET_HALF     # полка 0,10

# --- посадочные элементы -------------------------------------------------
PIN_X = 0.150
PIN_Y = -0.130
PIN_R = 0.0115
PIN_Z1 = 0.0760
PIN_TIP = 0.0880

PAD_X = 0.150
PAD_Y = 0.140
PAD_R = 0.0160
PAD_TOP = 0.0520

# --- фиксатор ------------------------------------------------------------
BRK_Y = 0.248
BRK_W = 0.050
BRK_TOP = 0.070
BRK_WX = 0.128
EAR_X = 0.052
EAR_TOP = 0.090
PIVOT_Z = 0.082
HANDLE_X1 = 0.158
HANDLE_Z1 = 0.0895
GRIP_X0, GRIP_X1 = 0.098, 0.160
GRIP_R = 0.0105
GRIP_Z = (0.0895, 0.0895)

# --- разъёмы -------------------------------------------------------------
PWR = (-0.085, 0.010)
DAT = (0.010, 0.010)
FLUID = ((0.120, 0.080), (0.120, -0.020))

PALETTE = {
    'graphite': (0.085, 0.090, 0.100),
    'steel': (0.700, 0.708, 0.700),
    'ivory': (0.945, 0.937, 0.918),
    'dark': (0.040, 0.043, 0.048),
    'cyan': (0.090, 0.700, 0.820),
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
        bsdf.inputs['Emission Strength'].default_value = 0.60
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


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), sharp=30.0):
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
    apply(obj, role)
    return shade(obj, 60.0)


def curve_tube(name, points, radius, role, res=10):
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


def text(name, body, size, loc, role, rot=(0, 0, 0), extrude=0.0006):
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
    return apply(obj, role)


def bm_prism(bm, pts, z0, z1):
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]
    hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    bm.faces.new(tuple(reversed(lo)))
    bm.faces.new(tuple(hi))
    for i in range(len(pts)):
        j = (i + 1) % len(pts)
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))


def plate(role='graphite'):
    """Плита одним телом: заходной пояс, полный контур, карман."""
    bm = bmesh.new()
    sq = lambda h: [(h, h), (-h, h), (-h, -h), (h, -h)]
    F = [bm.verts.new((x, y, 0.0)) for x, y in sq(HX_FOOT)]
    G = [bm.verts.new((x, y, H_FOOT)) for x, y in sq(HX)]
    T = [bm.verts.new((x, y, H_TOP)) for x, y in sq(HX)]
    P = [bm.verts.new((x, y, H_TOP)) for x, y in sq(POCKET_HALF)]
    Q = [bm.verts.new((x, y, POCKET_Z)) for x, y in sq(POCKET_HALF)]
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((F[i], F[j], G[j], G[i]))      # заходной пояс
        bm.faces.new((G[i], G[j], T[j], T[i]))      # стенка
        bm.faces.new((T[i], T[j], P[j], P[i]))      # полка
        bm.faces.new((P[i], P[j], Q[j], Q[i]))      # стенка кармана
    bm.faces.new(tuple(Q))                          # дно кармана
    bm.faces.new(tuple(reversed(F)))                # низ
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(PREFIX + 'base_plate')
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(PREFIX + 'base_plate', me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    bevel(obj, 0.0022, 2)
    return shade(obj, 26.0)


# --- узлы ----------------------------------------------------------------
def locating_pin(tag, x, y):
    out = [cyl(f'{PREFIX}pin_{tag}_body', (x, y, POCKET_Z), (x, y, PIN_Z1),
               PIN_R, 'steel', 30, bev=0.0012)]
    out.append(cyl(f'{PREFIX}pin_{tag}_tip', (x, y, PIN_Z1), (x, y, PIN_TIP),
                   PIN_R, 'steel', 30, r2=PIN_R * 0.80))
    out.append(cyl(f'{PREFIX}pin_{tag}_collar', (x, y, POCKET_Z),
                   (x, y, POCKET_Z + 0.0055), PIN_R + 0.0035, 'dark', 30,
                   bev=0.0008))
    return out


def rest_pad(tag, x, y):
    out = [cyl(f'{PREFIX}pad_{tag}', (x, y, POCKET_Z), (x, y, PAD_TOP),
               PAD_R, 'steel', 32, bev=0.0016)]
    out.append(cyl(f'{PREFIX}pad_{tag}_ring', (x, y, POCKET_Z),
                   (x, y, POCKET_Z + 0.0028), PAD_R + 0.0032, 'dark', 32))
    return out


def m12_bolt(idx, x, y):
    out = [cyl(f'{PREFIX}bolt_{idx}_washer', (x, y, H_TOP),
               (x, y, H_TOP + 0.0022), 0.0160, 'steel', 32, bev=0.0005)]
    out.append(cyl(f'{PREFIX}bolt_{idx}_head', (x, y, H_TOP + 0.0022),
                   (x, y, H_TOP + 0.0142), 0.0115, 'steel', 6, bev=0.0012))
    out.append(cyl(f'{PREFIX}bolt_{idx}_socket', (x, y, H_TOP + 0.0072),
                   (x, y, H_TOP + 0.01432), 0.0050, 'dark', 6))
    return out


def power_connector():
    x, y = PWR
    out = [cube(f'{PREFIX}conn_power_flange', (x, y, POCKET_Z + 0.0024),
                (0.098, 0.072, 0.0048), 'graphite', r=0.0015)]
    out.append(cube(f'{PREFIX}conn_power_body', (x, y, POCKET_Z + 0.0140),
                    (0.086, 0.060, 0.0180), 'dark', r=0.0020))
    out.append(cube(f'{PREFIX}conn_power_shroud', (x - 0.030, y, POCKET_Z + 0.0230),
                    (0.020, 0.044, 0.0070), 'graphite', r=0.0012))
    pins = bmesh.new()
    for dx in (-0.021, 0.0, 0.021):
        bm_prism(pins, [(x + dx - 0.0026, y - 0.0026), (x + dx + 0.0026, y - 0.0026),
                        (x + dx + 0.0026, y + 0.0026), (x + dx - 0.0026, y + 0.0026)],
                 POCKET_Z + 0.0225, POCKET_Z + 0.0300)
    out.append(mesh_from_bm(f'{PREFIX}conn_power_pins', pins, 'steel', 40.0))
    out.append(text(f'{PREFIX}label_pwr', 'PWR', 0.0078,
                    (x, y + 0.0475, POCKET_Z + 0.0004), 'ivory'))
    return out


def data_connector():
    x, y = DAT
    out = [cube(f'{PREFIX}conn_data_body', (x, y, POCKET_Z + 0.0080),
                (0.050, 0.040, 0.0160), 'dark', r=0.0016)]
    out.append(cube(f'{PREFIX}conn_data_shroud', (x, y - 0.0185, POCKET_Z + 0.0150),
                    (0.046, 0.0050, 0.0100), 'graphite', r=0.0008))
    contacts = bmesh.new()
    for i in range(8):
        cx = x - 0.0155 + i * 0.00443
        bm_prism(contacts, [(cx - 0.0011, y - 0.0055), (cx + 0.0011, y - 0.0055),
                            (cx + 0.0011, y + 0.0055), (cx - 0.0011, y + 0.0055)],
                 POCKET_Z + 0.0158, POCKET_Z + 0.0176)
    out.append(mesh_from_bm(f'{PREFIX}conn_data_contacts', contacts, 'steel', 40.0))
    out.append(text(f'{PREFIX}label_eth', 'ETH', 0.0078,
                    (x, y + 0.0330, POCKET_Z + 0.0004), 'ivory'))
    return out


def fluid_coupler(tag, x, y):
    out = [cyl(f'{PREFIX}fluid_{tag}_body', (x, y, POCKET_Z), (x, y, 0.0660),
               0.0130, 'steel', 28, bev=0.0014)]
    out.append(cyl(f'{PREFIX}fluid_{tag}_collar', (x, y, 0.0600), (x, y, 0.0716),
                   0.0150, 'dark', 28, bev=0.0010))
    out.append(cyl(f'{PREFIX}fluid_{tag}_ring', (x, y, 0.0440), (x, y, 0.0482),
                   0.0144, 'red', 28, bev=0.0006))
    out.append(cyl(f'{PREFIX}fluid_{tag}_bore', (x, y, 0.0618), (x, y, 0.0719),
                   0.0078, 'dark', 20))
    return out


def clamp_lever():
    """Механический фиксатор: кронштейн, щёки, ось, рычаг, тяга, губа."""
    out = [cube(f'{PREFIX}clamp_bracket', (0.0, BRK_Y, (H_TOP + BRK_TOP) * 0.5),
                (BRK_WX, BRK_W, BRK_TOP - H_TOP), 'graphite', r=0.0025)]
    for tag, sx in (('l', -1.0), ('r', 1.0)):
        out.append(cube(f'{PREFIX}clamp_ear_{tag}',
                        (sx * EAR_X, BRK_Y, (BRK_TOP + EAR_TOP) * 0.5),
                        (0.012, 0.030, EAR_TOP - BRK_TOP), 'steel', r=0.0015))
    out.append(cyl(f'{PREFIX}clamp_pivot', (-EAR_X - 0.012, BRK_Y, PIVOT_Z),
                   (EAR_X + 0.012, BRK_Y, PIVOT_Z), 0.0045, 'steel', 18))
    for tag, sx in (('l', -1.0), ('r', 1.0)):
        out.append(cyl(f'{PREFIX}clamp_pivot_cap_{tag}',
                       (sx * (EAR_X + 0.009), BRK_Y, PIVOT_Z),
                       (sx * (EAR_X + 0.014), BRK_Y, PIVOT_Z), 0.0072,
                       'dark', 16))
    ang = -math.atan2(HANDLE_Z1 - PIVOT_Z, HANDLE_X1)
    out.append(cube(f'{PREFIX}clamp_handle',
                    (HANDLE_X1 * 0.5, BRK_Y, (PIVOT_Z + HANDLE_Z1) * 0.5),
                    (HANDLE_X1, 0.028, 0.0130), 'steel', r=0.0024,
                    rot=(0, ang, 0)))
    out.append(cyl(f'{PREFIX}clamp_grip', (GRIP_X0, BRK_Y, GRIP_Z[0]),
                   (GRIP_X1, BRK_Y, GRIP_Z[1]), GRIP_R, 'dark', 24, bev=0.0030))
    out.append(torus(f'{PREFIX}clamp_grip_ring', (GRIP_X0 + 0.010, BRK_Y,
                                                GRIP_Z[0] - 0.0022),
                     GRIP_R - 0.0002, 0.0016, 'red', 'X'))
    out.append(cyl(f'{PREFIX}clamp_link', (0.046, BRK_Y, 0.0850),
                   (0.008, 0.192, 0.0715), 0.0050, 'dark', 16))
    out.append(cube(f'{PREFIX}clamp_hook_arm', (0.005, 0.2100, 0.0640),
                    (0.040, 0.036, 0.0125), 'steel', r=0.0016))
    out.append(cube(f'{PREFIX}clamp_hook', (0.005, 0.1810, 0.0690),
                    (0.076, 0.034, 0.0090), 'steel', r=0.0014))
    out.append(cube(f'{PREFIX}clamp_hook_cap', (0.005, 0.1810, 0.0736),
                    (0.062, 0.024, 0.0022), 'dark', r=0.0006))
    out.append(cube(f'{PREFIX}clamp_hook_lip', (0.005, 0.1555, 0.0580),
                    (0.076, 0.0100, 0.0135), 'steel', r=0.0012))
    out.append(cyl(f'{PREFIX}clamp_spring', (0.005, 0.205, H_TOP),
                   (0.005, 0.205, 0.0665), 0.0062, 'dark', 16))
    out.append(cube(f'{PREFIX}clamp_stop_pad', (0.0, 0.2225, H_TOP + 0.0035),
                    (0.074, 0.009, 0.0070), 'dark', r=0.0012))
    return out


def seat_indicator(x=0.215, y=-0.245):
    out = [cyl(f'{PREFIX}indicator_bezel', (x, y, H_TOP), (x, y, H_TOP + 0.0100),
               0.0205, 'dark', 36, bev=0.0016)]
    out.append(cyl(f'{PREFIX}indicator_ring', (x, y, H_TOP + 0.0100),
                   (x, y, H_TOP + 0.0122), 0.0220, 'steel', 36, bev=0.0008))
    out.append(cyl(f'{PREFIX}indicator_lens', (x, y, H_TOP + 0.0072),
                   (x, y, H_TOP + 0.0132), 0.0150, 'cyan', 36, bev=0.0016))
    out.append(text(f'{PREFIX}label_seat', 'SEAT', 0.0078,
                    (x - 0.002, y + 0.0295, H_TOP + 0.0004), 'ivory'))
    return out


def cables():
    out = [cyl(f'{PREFIX}grommet_power', (-0.178, 0.075, 0.0335),
               (-0.178, 0.075, 0.0430), 0.0090, 'dark', 22, bev=0.0012)]
    out.append(cyl(f'{PREFIX}grommet_data', (0.086, -0.048, 0.0335),
                   (0.086, -0.048, 0.0430), 0.0082, 'dark', 22, bev=0.0012))
    out.append(curve_tube(f'{PREFIX}cable_power',
                          [(-0.128, 0.012, 0.0455),
                           (-0.150, 0.030, 0.0415),
                           (-0.172, 0.062, 0.0395),
                           (-0.176, 0.074, 0.0390)], 0.0042, 'dark'))
    out.append(curve_tube(f'{PREFIX}cable_data',
                          [(0.035, 0.010, 0.0475),
                           (0.060, -0.006, 0.0435),
                           (0.080, -0.036, 0.0400),
                           (0.086, -0.046, 0.0392)], 0.0036, 'dark'))
    return out


def marks():
    out = []
    # гравировка на лицевой грани (y = -0.300)
    out.append(text(f'{PREFIX}label_code', 'STR-DOCK-08', 0.0190,
                    (0.0, -0.29945, 0.0305), 'ivory',
                    rot=(math.pi / 2, 0, 0), extrude=0.0006))
    out.append(text(f'{PREFIX}label_title', 'QUICK-CHANGE DOCK', 0.0092,
                    (0.0, -0.29945, 0.0125), 'ivory',
                    rot=(math.pi / 2, 0, 0), extrude=0.0006))
    # полка: нагрузка, крепление, защита
    out.append(text(f'{PREFIX}label_max', 'MAX 60 kg', 0.0125,
                    (-0.250, 0.058, H_TOP + 0.0004), 'ivory'))
    out.append(text(f'{PREFIX}label_m12', '4x M12', 0.0125,
                    (-0.250, -0.058, H_TOP + 0.0004), 'ivory'))
    out.append(text(f'{PREFIX}label_ip', 'IP54', 0.0125,
                    (0.252, 0.040, H_TOP + 0.0004), 'ivory'))
    out.append(text(f'{PREFIX}label_fluid', 'FLUID', 0.0072,
                    (0.098, 0.118, POCKET_Z + 0.0004), 'ivory'))
    # индекс посадки: треугольник на полке со стороны штифтов
    bm = bmesh.new()
    bm_prism(bm, [(0.0, -0.2940), (-0.0130, -0.2760), (0.0130, -0.2760)],
             H_TOP, H_TOP + 0.0008)
    out.append(mesh_from_bm(f'{PREFIX}mark_index', bm, 'dark', 45.0))
    return out


def build():
    reset()
    parts = [plate()]
    parts += locating_pin('a', -PIN_X, PIN_Y)
    parts += locating_pin('b', PIN_X, PIN_Y)
    parts += rest_pad('1', -PAD_X, PAD_Y)
    parts += rest_pad('2', PAD_X, PAD_Y)
    k = 1
    for sx in (-1.0, 1.0):
        for sy in (-1.0, 1.0):
            parts += m12_bolt(k, sx * 0.258, sy * 0.258)
            k += 1
    parts += power_connector()
    parts += data_connector()
    for i, (fx, fy) in enumerate(FLUID):
        parts += fluid_coupler('a' if i == 0 else 'b', fx, fy)
    parts += clamp_lever()
    parts += seat_indicator()
    parts += cables()
    parts += marks()
    # индексные отверстия в дне кармана
    for tag, yy in (('a', 0.185), ('b', -0.185)):
        parts.append(cyl(f'{PREFIX}bore_{tag}', (0.0, yy, POCKET_Z - 0.0005),
                         (0.0, yy, POCKET_Z + 0.0006), 0.0060, 'dark', 20))
    bpy.context.view_layer.update()
    return parts


# --- проверки ------------------------------------------------------------
def mesh_bbox(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objects:
        if o.type not in ('MESH', 'FONT'):
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def check(parts):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(objs)
    size = mx - mn
    center = (mn + mx) * 0.5
    names = sorted(o.name for o in objs)
    tol = 0.010

    def cnt(tag):
        return len([n for n in names if tag in n])

    report = {
        'component': CID,
        'nodes': len(names),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [0.600, 0.600, 0.100],
        'bbox_ok': bool(abs(size.x - 0.600) <= tol and abs(size.y - 0.600) <= tol
                        and abs(size.z - 0.100) <= tol),
        'floor_contact_mm': round((mn.z - 0.0) * 1000.0, 3),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'pins': cnt('pin_') // 3,
        'pads': cnt('pad_') // 2,
        'bolts_m12': cnt('_head'),
        'connectors': cnt('conn_'),
        'fluid_ports': len([n for n in names if n.endswith('_body')
                            and 'fluid_' in n]),
        'indicator_parts': cnt('indicator_'),
        'labels': cnt('label_'),
        'parts': names,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    report['checks_ok'] = bool(
        report['bbox_ok'] and report['material_count'] >= 4
        and report['pins'] == 2 and report['pads'] == 2
        and report['bolts_m12'] == 4 and report['fluid_ports'] == 2
        and report['indicator_parts'] == 3 and report['nodes'] >= 40
        and not report['bad_names'])
    return report


def export():
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = OUT / f'{CID}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    return path


# --- GLB -> сцена, рендеры ----------------------------------------------
def load_glb(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects]
    mn, mx = mesh_bbox(objs)
    return objs, mn, mx


def render_views(mn, mx):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1280
    scene.render.resolution_y = 1000
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.25
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.640, 0.640, 0.650, 1.0)
    bg.inputs['Strength'].default_value = 0.26

    center = (mn + mx) * 0.5
    L = max((mx - mn).x, (mx - mn).y, (mx - mn).z)

    bpy.ops.mesh.primitive_plane_add(size=L * 6.0,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.300, 0.298, 0.292, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    for name, off, energy, sz in (
            ('key', (0.62, -0.92, 0.90), 24.0, 0.85),
            ('fill', (-0.85, -0.62, 0.40), 6.0, 1.40),
            ('rim', (0.05, 0.90, 0.62), 16.0, 1.10)):
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
            need = max(need, abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(mn - center, mx - center)
    # крупный план: штифты, площадки, PWR/ETH/жидкость, индикатор
    close_a = Vector((-0.205, -0.215, 0.030))
    close_b = Vector((0.155, 0.105, 0.082))
    close_t = (close_a + close_b) * 0.5
    c_close = box_corners(close_a - close_t, close_b - close_t)

    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name != 'render_floor']
    close_objs = [o for o in mesh_objs
                  if all(mesh_bbox([o])[0][i] >= (close_a[i] - 0.05)
                         and mesh_bbox([o])[1][i] <= (close_b[i] + 0.05)
                         for i in range(3))]

    def max_ndc(objs, fill):
        worst = 0.0
        for o in objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.82, -1.00, 0.62), center, 62, c_main, 0.90, mesh_objs),
        ('front', (0.02, -1.00, 0.20), center + Vector((0, 0, -0.004)), 80, c_main, 0.90, mesh_objs),
        ('side', (1.00, 0.04, 0.18), center + Vector((0, 0, -0.004)), 80, c_main, 0.90, mesh_objs),
        ('closeup', (0.62, -0.86, 0.44), close_t, 85, c_close, 0.93, close_objs),
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
            got = max_ndc(objs, fill) if objs else fill
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
        print(f'RENDERED {tag} fill={max_ndc(objs, fill) if objs else 0:.3f} '
              f'objs={len(objs)} {fp}', flush=True)
    return outs


def main():
    build()
    rep = check(None)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size

    # проверяем именно выгруженный GLB и рендерим из него
    objs, mn, mx = load_glb(path)
    size = mx - mn
    rep['glb_nodes'] = len(objs)
    rep['glb_materials'] = len([m for m in bpy.data.materials if m.name.startswith('CJ_')])
    rep['glb_bbox_size'] = [round(v, 5) for v in size]
    rep['glb_bbox_ok'] = bool(abs(size.x - 0.600) <= 0.010
                              and abs(size.y - 0.600) <= 0.010
                              and abs(size.z - 0.100) <= 0.010)
    rep['renders'] = render_views(mn, mx)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps({k: v for k, v in rep.items() if k != 'parts'},
                                 ensure_ascii=False), flush=True)
    if not (rep['checks_ok'] and rep['glb_bbox_ok'] and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
