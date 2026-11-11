"""Standalone builder: motion_lift_z (MOT-Z-03, «Подъём»).

Вертикальный подъём 0,40 × 0,30 × 1,30 м: массивное основание с привалочным
фланцем и анкерами, две цилиндрические направляющие, вертикальная коробчатая
стойка, каретка-мост с быстросъёмной плитой и разрезными башмаками, ШВП
(винт + гайка-корпус в каретке) с опорами, мотор с редуктором внизу,
кожух-гармошка над и под кареткой, концевые упоры с датчиками и LED,
вертикальная кабельная цепь в лотке, верхний монтажный фланец с 4 × M12,
шильдик. Плиты-основания (structure_base) нет — только собственное
основание подъёма.

Не зависит от build_component_library.py / build_motion_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_lift_z.py

Выход:
  public/models/machine-modules/components/motion_lift_z.glb
  docs/plans/blockout/component-library/motion_lift_z/*.png
  docs/plans/blockout/component-library/motion_lift_z/report.json

Геометрия (Blender Z-up, метры):
  ось движения   = Z (вертикаль); Blender Z -> glTF/three.js Y (export_yup)
  габарит        = 0,40 (X) x 0,30 (Y) x 1,30 (Z); низ на z = 0
  animation      = slide пустышки motion_lift_z__anim по Z, 0,10 м, 0,78 рад/с
                   (каталог: axis y, amount 0.1, speed 0.78)
  двигается      = carriage_bridge (каретка-мост + плита + корпус гайки),
                   carriage_cheek_L, carriage_cheek_R (башмаки)
  статично       = основание, стойка, направляющие, ШВП и опоры, привод,
                   упоры, датчики, гармошка, кабельная цепь, фланец, шильдик
"""
from pathlib import Path
import json
import math
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_lift_z'
CID = 'motion_lift_z'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
HB_X, HB_Y = 0.200, 0.150          # полугабарит 0,40 x 0,30
BASE_Z0, BASE_Z1 = 0.000, 0.042
STEP_Z0, STEP_Z1 = 0.042, 0.072
FLANGE_Z0, FLANGE_Z1 = 0.072, 0.092

COL_X0, COL_X1 = -0.075, 0.075
COL_Y0, COL_Y1 = 0.008, 0.140
COL_Z0, COL_Z1 = FLANGE_Z1, 1.205

RAIL_X = 0.115
RAIL_Y = -0.070
RAIL_R = 0.015
RAIL_Z0, RAIL_Z1 = 0.100, 1.200

CROSS_LOW_Z0, CROSS_LOW_Z1 = 0.100, 0.150
CROSS_HIGH_Z0, CROSS_HIGH_Z1 = 1.112, 1.162

SCREW_Y = -0.058
SCREW_R = 0.011
SCREW_Z0, SCREW_Z1 = 0.170, 1.140

ANIM_Z = 0.630                     # середина зоны хода каретки
BRIDGE_Z0, BRIDGE_Z1 = 0.552, 0.708
CHEEK_Z0, CHEEK_Z1 = 0.584, 0.676
TRAVEL = 0.100                     # total slide, 0,10 м по паспорту

STOP_LOW_Z1 = 0.474
STOP_HIGH_Z0 = 0.770
TOP_FLANGE_Z0, TOP_FLANGE_Z1 = 1.245, 1.278
BOLT_TOP_Z = 1.300

PALETTE = {
    'alu': (0.760, 0.768, 0.775),
    'body': (0.945, 0.937, 0.918),
    'steel': (0.660, 0.666, 0.658),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.180, 0.186, 0.196),
    'blush': (0.910, 0.725, 0.749),
    'ivory': (0.980, 0.973, 0.957),
    'red': (0.720, 0.070, 0.060),
    'cyan': (0.750, 0.900, 0.920),
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
    bsdf.inputs['Roughness'].default_value = 0.54
    metal = 0.32 if role in ('alu', 'steel') else 0.18 if role == 'graphite' else 0.0
    bsdf.inputs['Metallic'].default_value = metal
    if role == 'alu':
        bsdf.inputs['Roughness'].default_value = 0.34
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.9
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


def box(name, x0, x1, y0, y1, z0, z1, role, r=0.0015):
    return cube(name, ((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5),
                (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)), role, r=r)


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


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


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


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = 0.08
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


def text_label(name, body, loc, size, role, rot=(math.radians(90), 0, 0)):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = 0.0004
    obj.data.align_x = 'CENTER'
    obj.data.align_y = 'CENTER'
    try:
        obj.data.font = bpy.data.fonts.load(str(FONT_PATH))
    except Exception:
        pass
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    movers = []
    static = []

    anim = empty(PREFIX + 'anim', (0.0, 0.0, ANIM_Z))
    bpy.context.view_layer.update()

    # ---------- основание: массивная плита, привалочный фланец, анкеры ----
    static.append(box(PREFIX + 'base_plate', -HB_X, HB_X, -HB_Y, HB_Y,
                      BASE_Z0, BASE_Z1, 'graphite', r=0.007))
    static.append(box(PREFIX + 'base_step', -0.180, 0.180, -0.132, 0.132,
                      STEP_Z0, STEP_Z1, 'dark', r=0.004))
    static.append(box(PREFIX + 'base_flange', -0.170, 0.170, -0.125, 0.128,
                      FLANGE_Z0, FLANGE_Z1, 'steel', r=0.004))
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        static.append(cyl(PREFIX + f'anchor_bolt_{i}',
                          (sx * 0.148, sy * 0.106, FLANGE_Z1),
                          (sx * 0.148, sy * 0.106, 0.108),
                          0.0085, 'steel', vertices=14, bev=0.0010))
        static.append(box(PREFIX + f'anchor_pad_{i}',
                           sx * 0.148 - 0.016, sx * 0.148 + 0.016,
                           sy * 0.106 - 0.016, sy * 0.106 + 0.016,
                           FLANGE_Z1, 0.0995, 'graphite', r=0.0012))

    # ---------- вертикальная стойка --------------------------------------
    static.append(box(PREFIX + 'column', COL_X0, COL_X1, COL_Y0, COL_Y1,
                      COL_Z0, COL_Z1, 'steel', r=0.006))
    static.append(box(PREFIX + 'column_panel', -0.066, 0.066, 0.004, 0.012,
                      0.152, 1.158, 'graphite', r=0.0018))
    for tag, zb in (('mid', 0.700), ('upper', 0.900)):
        static.append(box(PREFIX + f'column_band_{tag}', -0.079, 0.079, 0.004, 0.146,
                          zb, zb + 0.016, 'graphite', r=0.0020))
    static.append(box(PREFIX + 'column_rib_rear', -0.054, 0.054, 0.140, 0.148,
                      0.150, 1.150, 'steel', r=0.0018))
    for tag, sx in (('L', -1), ('R', 1)):
        static.append(box(PREFIX + f'column_gusset_{tag}',
                           min(sx * 0.075, sx * 0.098), max(sx * 0.075, sx * 0.098),
                           -0.006, 0.138, FLANGE_Z1, 0.238, 'graphite', r=0.0025))
        static.append(cube(PREFIX + f'gusset_bolt_{tag}',
                           (sx * 0.086, 0.070, 0.226), (0.014, 0.030, 0.012),
                           'steel', r=0.0012))

    # ---------- две направляющие + поперечины ----------------------------
    for tag, sx in (('L', -1), ('R', 1)):
        static.append(cyl(PREFIX + f'guide_{tag}',
                          (sx * RAIL_X, RAIL_Y, RAIL_Z0),
                          (sx * RAIL_X, RAIL_Y, RAIL_Z1), RAIL_R,
                          'alu', vertices=28))
    static.append(box(PREFIX + 'cross_low', -0.147, 0.147, -0.090, 0.030,
                      CROSS_LOW_Z0, CROSS_LOW_Z1, 'graphite', r=0.004))
    static.append(box(PREFIX + 'cross_high', -0.147, 0.147, -0.090, 0.030,
                      CROSS_HIGH_Z0, CROSS_HIGH_Z1, 'graphite', r=0.004))
    for tag, sx in (('L', -1), ('R', 1)):
        parts = [box(PREFIX + f'guide_block_low_{tag}',
                     sx * RAIL_X - 0.032, sx * RAIL_X + 0.032, -0.092, -0.024,
                     0.112, 0.176, 'steel', r=0.003),
                 box(PREFIX + f'guide_block_low_{tag}_face',
                     sx * RAIL_X - 0.024, sx * RAIL_X + 0.024, -0.098, -0.090,
                     0.120, 0.168, 'graphite', r=0.0015)]
        static.append(join(parts, PREFIX + f'guide_block_low_{tag}'))
        parts = [box(PREFIX + f'guide_block_high_{tag}',
                     sx * RAIL_X - 0.032, sx * RAIL_X + 0.032, -0.092, -0.024,
                     1.086, 1.150, 'steel', r=0.003),
                 box(PREFIX + f'guide_block_high_{tag}_face',
                     sx * RAIL_X - 0.024, sx * RAIL_X + 0.024, -0.098, -0.090,
                     1.094, 1.142, 'graphite', r=0.0015)]
        static.append(join(parts, PREFIX + f'guide_block_high_{tag}'))

    # ---------- ШВП: винт, резьба, опоры --------------------------------
    screw_parts = [cyl(PREFIX + 'screw', (0.0, SCREW_Y, SCREW_Z0),
                       (0.0, SCREW_Y, SCREW_Z1), SCREW_R, 'steel', vertices=24)]
    z = SCREW_Z0 + 0.030
    k = 0
    while z < SCREW_Z1 - 0.024:
        in_nut = 0.500 < z < 0.760
        if not in_nut:
            screw_parts.append(cyl(PREFIX + f'screw_thread_{k:02d}',
                                   (0.0, SCREW_Y, z), (0.0, SCREW_Y, z + 0.0050),
                                   0.0144, 'steel', vertices=18, bev=0.0003))
            k += 1
        z += 0.0125
    static.append(join(screw_parts, PREFIX + 'screw'))
    static.append(cyl(PREFIX + 'screw_bearing_low', (0.0, SCREW_Y, 0.144),
                      (0.0, SCREW_Y, 0.190), 0.021, 'graphite',
                      vertices=24, bev=0.0018))
    static.append(cyl(PREFIX + 'screw_bearing_high', (0.0, SCREW_Y, 1.074),
                      (0.0, SCREW_Y, 1.120), 0.021, 'graphite',
                      vertices=24, bev=0.0018))
    static.append(torus(PREFIX + 'bearing_ring_low', (0.0, SCREW_Y, 0.184),
                        0.0215, 0.0022, 'steel', 'Z'))
    static.append(torus(PREFIX + 'bearing_ring_high', (0.0, SCREW_Y, 1.080),
                        0.0215, 0.0022, 'steel', 'Z'))

    # ---------- привод: редуктор + мотор внизу ---------------------------
    static.append(box(PREFIX + 'gearbox', 0.006, 0.082, -0.104, -0.012,
                      0.128, 0.250, 'graphite', r=0.004))
    static.append(box(PREFIX + 'gearbox_cover', 0.014, 0.074, -0.110, -0.104,
                      0.150, 0.232, 'steel', r=0.0018))
    static.append(box(PREFIX + 'motor_flange', 0.078, 0.088, -0.112, -0.004,
                      0.146, 0.252, 'steel', r=0.0025))
    static.append(cyl(PREFIX + 'motor', (0.088, -0.058, 0.196),
                      (0.168, -0.058, 0.196), 0.042, 'blush',
                      vertices=32, bev=0.0035))
    for i, x in enumerate((0.100, 0.122, 0.144)):
        static.append(torus(PREFIX + f'motor_fin_{i}', (x, -0.058, 0.196),
                            0.0432, 0.0022, 'steel', 'X'))
    static.append(cyl(PREFIX + 'motor_cap', (0.168, -0.058, 0.196),
                      (0.180, -0.058, 0.196), 0.036, 'graphite',
                      vertices=28, bev=0.0022))
    static.append(box(PREFIX + 'motor_terminal', 0.150, 0.170, -0.084, -0.056,
                      0.226, 0.244, 'graphite', r=0.0018))

    # ---------- кабельная цепь в вертикальном лотке ----------------------
    static.append(box(PREFIX + 'chain_track', 0.184, 0.192, -0.016, 0.030,
                      0.286, 1.074, 'graphite', r=0.0018))
    static.append(box(PREFIX + 'chain_lip_in', 0.168, 0.196, -0.024, -0.014,
                      0.286, 1.074, 'graphite', r=0.0012))
    static.append(box(PREFIX + 'chain_lip_out', 0.168, 0.196, 0.030, 0.040,
                      0.286, 1.074, 'graphite', r=0.0012))
    links = []
    z = 0.300
    i = 0
    while z <= 1.060:
        links.append(box(f'link_{i:02d}', 0.157, 0.185, -0.012, 0.028,
                         z, z + 0.030, 'dark', r=0.0022))
        i += 1
        z += 0.032
    static.append(join(links, PREFIX + 'chain'))
    static.append(box(PREFIX + 'chain_arm_low', 0.066, 0.192, -0.008, 0.024,
                      0.286, 0.316, 'steel', r=0.0020))
    static.append(box(PREFIX + 'chain_arm_high', 0.066, 0.192, -0.008, 0.024,
                      1.044, 1.074, 'steel', r=0.0020))

    # ---------- концевые упоры и датчики --------------------------------
    # упоры — пара башмаков под кареткой слева/справа от ШВП (винт проходит между)
    stop_parts = [box(PREFIX + 'stop_bracket_low', -0.145, 0.145, -0.094, 0.006,
                      0.416, 0.446, 'graphite', r=0.0025)]
    for tag, sx in (('L', -1), ('R', 1)):
        stop_parts.append(box(PREFIX + f'stop_low_{tag}',
                              min(sx * 0.094, sx * 0.138), max(sx * 0.094, sx * 0.138),
                              -0.106, -0.090, STOP_LOW_Z1 - 0.028, STOP_LOW_Z1,
                              'red', r=0.0035))
    static.append(join(stop_parts, PREFIX + 'stop_low'))
    stop_parts = [box(PREFIX + 'stop_bracket_high', -0.145, 0.145, -0.094, 0.006,
                      0.798, 0.828, 'graphite', r=0.0025)]
    for tag, sx in (('L', -1), ('R', 1)):
        stop_parts.append(box(PREFIX + f'stop_high_{tag}',
                              min(sx * 0.094, sx * 0.138), max(sx * 0.094, sx * 0.138),
                              -0.106, -0.090, STOP_HIGH_Z0, STOP_HIGH_Z0 + 0.028,
                              'red', r=0.0035))
    static.append(join(stop_parts, PREFIX + 'stop_high'))

    for tag, z0, z1 in (('low', 0.430, 0.462), ('high', 0.812, 0.844)):
        static.append(box(PREFIX + f'sensor_{tag}', -0.098, -0.052, -0.070, -0.028,
                          z0, z1, 'graphite', r=0.0022))
        static.append(sphere(PREFIX + f'sensor_led_{tag}', (-0.090, -0.048, z1),
                              0.0036, 'cyan'))
        static.append(box(PREFIX + f'sensor_cable_{tag}', -0.096, -0.082, -0.028, 0.014,
                          z0 + 0.004, z0 + 0.026, 'dark', r=0.0010))

    # ---------- кожух-гармошка над и под каретки ------------------------
    def bellows(name, z0, z1, seg=0.016):
        parts = []
        z = z0
        i = 0
        big = True
        while z < z1 - 0.004:
            w = 0.030 if big else 0.024
            d = 0.030 if big else 0.024
            parts.append(box(f'{name}_seg_{i:02d}', -w, w, -0.058 - d, -0.058 + d,
                             z, z + seg, 'dark', r=0.0016))
            z += seg
            i += 1
            big = not big
        return join(parts, PREFIX + name)

    static.append(bellows('bellows_low', 0.144, 0.262))
    static.append(bellows('bellows_high', 0.828, 1.112))
    static.append(box(PREFIX + 'bellows_clamp_low', -0.034, 0.034, -0.094, -0.022,
                      0.144, 0.156, 'steel', r=0.0018))
    static.append(box(PREFIX + 'bellows_clamp_high', -0.034, 0.034, -0.094, -0.022,
                      1.100, 1.112, 'steel', r=0.0018))

    # ---------- кабель привода -> цепь ----------------------------------
    static.append(curve_tube(PREFIX + 'cable',
                             [(0.166, -0.070, 0.230), (0.180, -0.036, 0.256),
                              (0.178, -0.002, 0.278), (0.170, 0.008, 0.300)],
                             0.005, 'dark'))
    static.append(box(PREFIX + 'cable_connector', 0.158, 0.172, -0.082, -0.056,
                      0.218, 0.240, 'graphite', r=0.0018))

    # ---------- верхний монтажный фланец --------------------------------
    static.append(box(PREFIX + 'top_cap', -0.085, 0.085, -0.002, 0.148,
                      COL_Z1, TOP_FLANGE_Z0, 'graphite', r=0.0035))
    static.append(box(PREFIX + 'top_flange', -0.120, 0.120, -0.020, 0.150,
                      TOP_FLANGE_Z0, TOP_FLANGE_Z1, 'steel', r=0.0035))
    for i, (sx, y) in enumerate(((-1, 0.022), (1, 0.022), (-1, 0.122), (1, 0.122))):
        static.append(cyl(PREFIX + f'flange_bolt_{i}',
                          (sx * 0.100, y, TOP_FLANGE_Z1),
                          (sx * 0.100, y, BOLT_TOP_Z), 0.0068, 'graphite',
                          vertices=14, bev=0.0009))

    # ---------- шильдик на стойке --------------------------------------
    static.append(box(PREFIX + 'label_plate', 0.075, 0.081, 0.046, 0.124,
                      0.982, 1.050, 'ivory', r=0.0012))
    static.append(text_label(PREFIX + 'label_text', 'MOT-Z-03',
                             (0.0815, 0.085, 1.016), 0.019, 'graphite',
                             rot=(math.radians(90), 0, math.radians(90))))

    # ---------- каретка-мост + плита + корпус гайки (движется) ----------
    bridge_parts = [
        box(PREFIX + 'carriage_bridge', -0.132, 0.132, -0.124, -0.082,
            BRIDGE_Z0, BRIDGE_Z1, 'graphite', r=0.004),
        box(PREFIX + 'bridge_face', -0.086, 0.086, -0.132, -0.124,
            0.592, 0.668, 'alu', r=0.0025),
        cyl(PREFIX + 'tool_boss', (0.0, -0.124, 0.630), (0.0, -0.146, 0.630),
            0.030, 'steel', vertices=28, bev=0.0025),
        box(PREFIX + 'nut_carrier', -0.048, 0.048, -0.106, -0.020,
            0.596, 0.664, 'steel', r=0.0030),
        box(PREFIX + 'nut_housing', -0.031, 0.031, -0.086, -0.030,
            0.575, 0.685, 'graphite', r=0.0030),
    ]
    for i, (sx, sz) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        bridge_parts.append(cyl(PREFIX + f'bridge_bolt_{i}',
                                 (sx * 0.118, -0.127, 0.630 + sz * 0.052),
                                 (sx * 0.118, -0.118, 0.630 + sz * 0.052),
                                 0.0075, 'dark', vertices=12, bev=0.0008))
    movers.append(join(bridge_parts, PREFIX + 'carriage_bridge'))

    for tag, sx in (('L', -1), ('R', 1)):
        cheek_parts = [
            box(PREFIX + f'carriage_cheek_{tag}',
                sx * RAIL_X - 0.040, sx * RAIL_X + 0.040, -0.102, -0.038,
                CHEEK_Z0, CHEEK_Z1, 'graphite', r=0.0035),
            cyl(PREFIX + f'cheek_bush_top_{tag}',
                (sx * RAIL_X, RAIL_Y, CHEEK_Z1), (sx * RAIL_X, RAIL_Y, CHEEK_Z1 + 0.012),
                0.0215, 'steel', vertices=24, bev=0.0010),
            cyl(PREFIX + f'cheek_bush_bot_{tag}',
                (sx * RAIL_X, RAIL_Y, CHEEK_Z0 - 0.012), (sx * RAIL_X, RAIL_Y, CHEEK_Z0),
                0.0215, 'steel', vertices=24, bev=0.0010),
            cyl(PREFIX + f'cheek_clamp_{tag}',
                (sx * (RAIL_X + 0.030), RAIL_Y, 0.630),
                (sx * (RAIL_X + 0.040), RAIL_Y, 0.630),
                0.0075, 'dark', vertices=12, bev=0.0008),
        ]
        movers.append(join(cheek_parts, PREFIX + f'carriage_cheek_{tag}'))

    # ---------- привязка к анимационной пустышке ------------------------
    bpy.context.view_layer.update()
    for o in movers:
        parent(o, anim)
        o['moving'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH':
            o['moving'] = o in movers

    bpy.context.view_layer.update()
    return anim, movers, static


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


def box_gap(a_mn, a_mx, b_mn, b_mx):
    gap = 0.0
    for i in range(3):
        gap = max(gap, b_mn[i] - a_mx[i], a_mn[i] - b_mx[i])
    return gap


def check(anim, movers):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    passport = (0.400, 0.300, 1.300)
    got_sorted = tuple(sorted((round(size.x, 5), round(size.y, 5), round(size.z, 5)),
                              reverse=True))
    passport_sorted = tuple(sorted(passport, reverse=True))
    bbox_ok = all(abs(g - p) <= 0.004 for g, p in zip(got_sorted, passport_sorted))

    kids = [o for o in anim.children if o.type == 'MESH']
    kid_names = {o.name for o in kids}
    passport_parts = {'carriage_bridge', 'carriage_cheek_L', 'carriage_cheek_R'}
    parts_ok = ({n.replace(PREFIX, '') for n in kid_names} == passport_parts)

    # --- slide-тест: жёсткий сдвиг каретки по Z, статика заморожена ------
    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    delta = TRAVEL * 0.5
    anim.location = Vector((anim.location.x, anim.location.y,
                            anim.location.z + delta))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}
    move_err = max((after[n] - before[n] - Vector((0, 0, delta))).length
                   for n in kid_names)
    static_err = max(((after[n] - before[n]).length
                      for n in before if n not in kid_names), default=0.0)

    anim.location = Vector((anim.location.x, anim.location.y,
                            anim.location.z - delta))
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    pivot_shift = max((restored[n] - before[n]).length for n in before)

    anim_loc = anim.location.copy()
    axis_ok = (abs(anim_loc.x) < 1e-6 and abs(anim_loc.y) < 1e-6
               and BRIDGE_Z0 < anim_loc.z < BRIDGE_Z1)

    # --- зазоры хода: каретка не задевает упоры/опоры -------------------
    k_mn, k_mx = mesh_bbox(kids)
    clearance_low = k_mn.z - STOP_LOW_Z1
    clearance_high = STOP_HIGH_Z0 - k_mx.z
    travel_ok = (clearance_low > delta + 0.004) and (clearance_high > delta + 0.004)

    # --- «не висит в воздухе» --------------------------------------------
    boxes = {}
    for o in meshes:
        boxes[o.name] = mesh_bbox([o])
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0015
                   for other in boxes):
            floating.append(name)

    report = {
        'component': CID,
        'code': 'MOT-Z-03',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_sorted_m': list(got_sorted),
        'bbox_passport_m': list(passport),
        'bbox_ok': bool(bbox_ok),
        'floor_contact_z': round(mn.z, 6),
        'floor_contact_ok': bool(abs(mn.z) < 0.0006),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim_loc],
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'anim_parts_ok': bool(parts_ok),
        'static_parts': sorted(o.name for o in meshes if o.name not in kid_names),
        'static_count': len([o for o in meshes if o.name not in kid_names]),
        'slide_delta_m': delta,
        'mover_error_m': round(move_err, 9),
        'static_error_m': round(static_err, 9),
        'slide_rigid_ok': bool(move_err < 1e-6),
        'static_frozen_ok': bool(static_err < 1e-9),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_ok': bool(pivot_shift < 1e-6 and axis_ok),
        'clearance_low_m': round(clearance_low, 5),
        'clearance_high_m': round(clearance_high, 5),
        'travel_ok': bool(travel_ok),
        'travel_m': TRAVEL,
        'speed_rad_s': 0.78,
        'axis_blender': 'Z (вертикаль)',
        'axis_three_js': 'Y (Blender Z -> glTF Y, export_yup)',
        'floating_parts': floating,
        'no_floating_ok': bool(not floating),
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
    scene.view_settings.exposure = 0.10
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.26

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=6,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.55, -0.80, 1.50), 14.0, 0.95),
            ('fill', (-1.00, -0.55, 0.75), 2.2, 1.30),
            ('rim', (0.15, 1.00, 1.25), 7.0, 1.00)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.35))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

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
    close_t = Vector((0.0, -0.055, ANIM_Z - 0.01))
    c_close = box_corners(Vector((-0.190, -0.160, 0.470)) - close_t,
                          Vector((0.190, 0.070, 0.790)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.74, -0.86, 0.42), center + Vector((0, 0, 0.010)), 70, c_main, 0.92, True),
        ('front', (0.03, -1.00, 0.16), center + Vector((0, 0, 0.006)), 70, c_main, 0.92, True),
        ('side', (1.00, -0.12, 0.12), center + Vector((0, 0, 0.004)), 70, c_main, 0.92, True),
        ('closeup', (0.52, -0.82, 0.20), close_t, 80, c_close, 0.94, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, fit_all in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(6 if fit_all else 0):
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
    anim, movers, static = build()
    rep = check(anim, movers)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['pivot_ok']
            and rep['anim_parts_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000 and rep['no_floating_ok']
            and rep['static_frozen_ok'] and rep['slide_rigid_ok']
            and rep['travel_ok']):
        raise SystemExit('checks failed')


main()
