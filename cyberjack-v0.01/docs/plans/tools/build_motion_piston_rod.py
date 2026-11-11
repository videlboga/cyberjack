"""Standalone builder: motion_piston_rod (MOT-PIS-01, «Штоковый поршень»).

Штоковый линейный привод (rod-style electric cylinder) с ШВП:
задний фланец-опора, серво с редуктором, стальная опора винта, открытая
секция с винтом ШВП и ходовой гайкой на ползуне, направляющая планка,
графитовый цилиндр с передней головкой, бронзовая втулка-направляющая,
уплотнение (wiper), полированный шток с лыской и резьбовым концом,
быстросъёмная розовая муфта и вилка-наконечник с пальцем,
два концевых датчика с LED и кабель. Плиты-основания нет.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_piston_rod.py

Выход:
  public/models/machine-modules/components/motion_piston_rod.glb
  docs/plans/blockout/component-library/motion_piston_rod/*.png
  docs/plans/blockout/component-library/motion_piston_rod/report.json

Геометрия (Blender Z-up, метры):
  ось привода    = X, z = 0.075; Blender X -> glTF X (export_yup)
  габарит        = 0.50 (X) x 0.15 (Y) x 0.15 (Z), низ на z = 0
  анимация       = сдвиг пустышки motion_piston_rod__anim по X, 0..0.09 м
  двигается      = гайка ШВП с ползуном, поршневая труба, шток,
                   резьбовой конец, лыска, муфта, вилка, палец
  статично       = фланец с болтами, мотор и редуктор, опора винта,
                   винт ШВП, рама-канал, направляющая, цилиндр,
                   головка, втулка, уплотнение, датчики, кабель
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_piston_rod'
CID = 'motion_piston_rod'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
X_MIN, X_MAX = -0.250, 0.250        # габарит по паспорту 0,50
HALF_YZ = 0.075                     # полусечение 0,15 x 0,15
AXIS_Z = 0.075                      # высота оси штока

FLANGE_X0, FLANGE_X1 = -0.250, -0.238
MOTOR_X0, MOTOR_X1 = -0.238, -0.186
MOTOR_R = 0.044
GEAR_X0, GEAR_X1 = -0.186, -0.148
SCREW_X0, SCREW_X1 = -0.148, -0.018
SCREW_R = 0.015

CAGE_X0, CAGE_X1 = -0.148, -0.014   # открытая секция ШВП
CAGE_HY = 0.044
WALL_T = 0.007
CAGE_Z0 = 0.025
WALL_Z1 = 0.102

BODY_X0, BODY_X1 = -0.010, 0.104
BODY_R = 0.056
COLLAR_X0, COLLAR_X1 = 0.104, 0.124
COLLAR_R = 0.060
BUSH_X0, BUSH_X1 = 0.124, 0.132
BUSH_R = 0.030

ROD_R = 0.017
ROD_X0, ROD_X1 = -0.016, 0.198
TRAVEL = 0.09
ANIM_SPEED = 0.9

NUT_X0, NUT_X1 = -0.140, -0.110
NUT_R = 0.027
TUBE_X0, TUBE_X1 = -0.110, -0.016
TUBE_R = 0.024

COUPLING_X0, COUPLING_X1 = 0.196, 0.230
TIP_X0, TIP_X1 = 0.230, 0.250

PALETTE = {
    'alu': (0.735, 0.742, 0.748),
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'steel': (0.660, 0.666, 0.658),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.180, 0.186, 0.196),
    'blush': (0.910, 0.725, 0.749),
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
    bsdf.inputs['Roughness'].default_value = 0.58
    metal = 0.55 if role in ('alu', 'steel') else 0.30 if role == 'graphite' else 0.0
    bsdf.inputs['Metallic'].default_value = metal
    if role == 'alu':
        bsdf.inputs['Roughness'].default_value = 0.38
    if role == 'steel':
        bsdf.inputs['Roughness'].default_value = 0.30
    if role == 'dark':
        bsdf.inputs['Roughness'].default_value = 0.82
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.55
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bevel(obj, width=0.0015, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


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


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def ring_stack(name, x0, x1, count, radius, depth, role, seg=20):
    """Пакет узких колец-витков (резьба / ШВП) одним мешем."""
    bm = bmesh.new()
    span = x1 - x0
    rot = Vector((1, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    for i in range(count):
        xc = x0 + (i + 0.5) * span / count
        m = Matrix.Translation((xc, 0.0, AXIS_Z)) @ rot
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=radius, radius2=radius, depth=depth,
                              matrix=m)
    return mesh_from_bm(name, bm, role, True)


def rod_with_flat():
    """Шток с фрезерованной лыской под ключ (boolean-срез со стороны -Y)."""
    rod = cyl(PREFIX + 'rod', (ROD_X0, 0, AXIS_Z), (ROD_X1, 0, AXIS_Z), ROD_R,
              'steel', vertices=28)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.152, -0.0240, AXIS_Z))
    cut = bpy.context.object
    cut.scale = (0.020, 0.0210, 0.060)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = rod.modifiers.new('flat', 'BOOLEAN')
    mod.object = cut
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    select_only(rod)
    bpy.ops.object.modifier_apply(modifier='flat')
    bpy.data.objects.remove(cut, do_unlink=True)
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(32))
    except Exception:
        pass
    return rod


# --- сборка --------------------------------------------------------------
def build():
    reset()
    movers = []
    Z = AXIS_Z

    # ---------- задняя опора: фланец на полу + болты ----------
    cube(PREFIX + 'rear_flange', ((FLANGE_X0 + FLANGE_X1) * 0.5, 0.0, Z),
         (FLANGE_X1 - FLANGE_X0, 2 * HALF_YZ, 2 * HALF_YZ), 'graphite', r=0.006)
    bm = bmesh.new()
    for sy in (-1, 1):
        for sz in (-1, 1):
            m = (Matrix.Translation((-0.247, sy * 0.052, Z + sz * 0.052))
                 @ Vector((1, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4())
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12,
                                  radius1=0.0058, radius2=0.0058, depth=0.006,
                                  matrix=m)
    mesh_from_bm(PREFIX + 'flange_bolts', bm, 'ivory')

    # ---------- мотор с рёбрами и клеммной коробкой ----------
    cyl(PREFIX + 'motor', (MOTOR_X0, 0, Z), (MOTOR_X1, 0, Z), MOTOR_R,
        'blush', vertices=44, bev=0.0030)
    for i, x in enumerate((-0.230, -0.215, -0.200)):
        torus(PREFIX + f'motor_fin_{i}', (x, 0, Z), MOTOR_R + 0.0016, 0.0032,
              'steel', 'X')
    cube(PREFIX + 'motor_terminal', (-0.211, 0.0, Z + 0.0505),
         (0.030, 0.032, 0.021), 'graphite', r=0.0018)

    # ---------- редуктор ----------
    cube(PREFIX + 'gearbox', ((GEAR_X0 + GEAR_X1) * 0.5, 0.0, Z),
         (GEAR_X1 - GEAR_X0, 0.094, 0.094), 'graphite', r=0.005)
    cube(PREFIX + 'gearbox_plate', (GEAR_X1 - 0.004, 0.0, Z),
         (0.008, 0.084, 0.084), 'steel', r=0.0025)

    # ---------- опора винта ШВП и открытая секция ----------
    cyl(PREFIX + 'screw_bearing', (SCREW_X0 - 0.001, 0, Z), (SCREW_X0 + 0.008, 0, Z),
        0.028, 'steel', vertices=28, bev=0.0012)
    torus(PREFIX + 'bearing_ring', (SCREW_X0 + 0.008, 0, Z), 0.0286, 0.0026,
          'dark', 'X')

    cube(PREFIX + 'cage_floor', ((CAGE_X0 + CAGE_X1) * 0.5, 0.0, CAGE_Z0 + 0.005),
         (CAGE_X1 - CAGE_X0, 0.088, 0.010), 'graphite', r=0.0015)
    for tag, sy in (('l', -1), ('r', 1)):
        cube(PREFIX + f'cage_wall_{tag}',
             ((CAGE_X0 + CAGE_X1) * 0.5, sy * (CAGE_HY - WALL_T * 0.5),
              (CAGE_Z0 + WALL_Z1) * 0.5),
             (CAGE_X1 - CAGE_X0, WALL_T, WALL_Z1 - CAGE_Z0), 'graphite', r=0.0015)
    # направляющая планка по дну канала (статична)
    cube(PREFIX + 'guide_rail', ((CAGE_X0 + CAGE_X1) * 0.5, 0.0, CAGE_Z0 + 0.0145),
         (CAGE_X1 - CAGE_X0 - 0.006, 0.028, 0.007), 'alu', r=0.0012)
    cyl(PREFIX + 'cage_bulkhead', (CAGE_X1 - 0.006, 0, Z), (BODY_X0, 0, Z),
        0.058, 'steel', vertices=40, bev=0.0015)

    # винт ШВП + витки
    cyl(PREFIX + 'screw', (SCREW_X0, 0, Z), (SCREW_X1, 0, Z), SCREW_R,
        'steel', vertices=24)
    ring_stack(PREFIX + 'screw_thread', SCREW_X0 + 0.004, SCREW_X1 - 0.002, 10,
                SCREW_R + 0.0014, 0.0042, 'steel', seg=18)

    # ---------- корпус: цилиндр, головка, втулка, уплотнение ----------
    cyl(PREFIX + 'body', (BODY_X0, 0, Z), (BODY_X1, 0, Z), BODY_R,
        'graphite', vertices=48, bev=0.0022)
    for tag, x in (('rear', 0.004), ('front', 0.094)):
        torus(PREFIX + f'body_band_{tag}', (x, 0, Z), BODY_R + 0.0012, 0.0034,
              'dark', 'X')
    cyl(PREFIX + 'collar', (COLLAR_X0, 0, Z), (COLLAR_X1, 0, Z), COLLAR_R,
        'steel', vertices=44, bev=0.0018)
    torus(PREFIX + 'collar_mark', (0.109, 0, Z), COLLAR_R + 0.0008, 0.0022, 'red', 'X')
    cyl(PREFIX + 'guide_bush', (BUSH_X0, 0, Z), (BUSH_X1, 0, Z), BUSH_R,
        'alu', vertices=28, bev=0.0010)
    torus(PREFIX + 'wiper_seal', (BUSH_X1 + 0.0006, 0, Z), 0.0208, 0.0044, 'dark', 'X')

    # ---------- концевые датчики с LED и шиной ----------
    for tag, x in (('rear', -0.132), ('front', -0.046)):
        cube(PREFIX + f'sensor_{tag}', (x, -(CAGE_HY + 0.0050), 0.0935),
             (0.018, 0.014, 0.021), 'graphite', r=0.0014)
        cyl(PREFIX + f'led_{tag}', (x, -(CAGE_HY + 0.0112), 0.0935),
            (x, -(CAGE_HY + 0.0158), 0.0935), 0.0046, 'cyan', vertices=14)
    curve_tube(PREFIX + 'sensor_bus',
               [(-0.150, -(CAGE_HY + 0.0050), 0.0935),
                (-0.100, -(CAGE_HY + 0.0050), 0.0935),
                (-0.046, -(CAGE_HY + 0.0050), 0.0935),
                (-0.016, -(CAGE_HY + 0.0040), 0.0950),
                (-0.004, -(CAGE_HY + 0.0030), 0.1000)], 0.0032, 'dark')
    cube(PREFIX + 'cable_clamp', (-0.151, -(CAGE_HY + 0.0045), 0.0935),
         (0.013, 0.017, 0.015), 'graphite', r=0.0010)

    # ---------- кабель питания и разъём ----------
    curve_tube(PREFIX + 'cable',
               [(-0.212, -0.008, Z + 0.0600),
                (-0.222, -0.038, Z + 0.0530),
                (-0.232, -0.058, Z + 0.0200),
                (-0.234, -0.064, Z - 0.0200)], 0.0042, 'dark')
    cube(PREFIX + 'connector', (-0.235, -0.066, Z - 0.0280),
         (0.030, 0.014, 0.024), 'graphite', r=0.0020)

    # ---------- шильдик ----------
    cube(PREFIX + 'label_plate', (0.046, -(BODY_R + 0.0012), Z),
         (0.062, 0.006, 0.024), 'graphite', r=0.0012)
    text_label(PREFIX + 'label_text', 'MOT-PIS-01',
               (0.046, -(BODY_R + 0.0048), Z), 0.0092, 'ivory')

    # ---------- подвижная группа: гайка, труба, шток, муфта, вилка ----------
    movers.append(cyl(PREFIX + 'screw_nut', (NUT_X0, 0, Z), (NUT_X1, 0, Z), NUT_R,
                      'blush', vertices=28, bev=0.0016))
    for tag, x in (('a', NUT_X0 + 0.002), ('b', NUT_X1 - 0.002)):
        movers.append(torus(PREFIX + f'nut_flange_{tag}', (x, 0, Z),
                            NUT_R + 0.0018, 0.0030, 'steel', 'X'))
    movers.append(cube(PREFIX + 'guide_shoe',
                       ((NUT_X0 + NUT_X1) * 0.5, 0.0, CAGE_Z0 + 0.0215),
                       (0.044, 0.024, 0.013), 'alu', r=0.0012))
    movers.append(cyl(PREFIX + 'piston_tube', (TUBE_X0, 0, Z), (TUBE_X1, 0, Z),
                      TUBE_R, 'steel', vertices=32, bev=0.0012))
    movers.append(rod_with_flat())
    movers.append(ring_stack(PREFIX + 'rod_thread', 0.158, 0.194, 7,
                              ROD_R + 0.0013, 0.0040, 'steel', seg=18))
    movers.append(cyl(PREFIX + 'rod_coupling', (COUPLING_X0, 0, Z),
                      (COUPLING_X1, 0, Z), 0.026, 'blush', vertices=28, bev=0.0020))
    movers.append(torus(PREFIX + 'coupling_knurl', (0.213, 0, Z), 0.0265, 0.0022,
                        'steel', 'X'))
    movers.append(cube(PREFIX + 'rod_tip', (0.2355, 0.0, Z),
                       (0.011, 0.044, 0.038), 'blush', r=0.0018))
    for tag, sy in (('l', -1), ('r', 1)):
        movers.append(cube(PREFIX + f'clevis_cheek_{tag}', (0.2445, sy * 0.0135, Z),
                           (0.011, 0.009, 0.032), 'blush', r=0.0010))
    movers.append(cyl(PREFIX + 'clevis_pin', (0.245, -0.020, Z), (0.245, 0.020, Z),
                       0.0038, 'steel', vertices=16))

    # ---------- привязка к анимационной пустышке ----------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z))
    anim['motion_type'] = 'slide'
    anim['motion_axis'] = 'X'
    anim['motion_amount'] = TRAVEL
    anim['motion_speed'] = ANIM_SPEED
    anim['travel'] = 0.15
    bpy.context.view_layer.update()
    for o in movers:
        parent(o, anim)
        o['moving'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in movers:
            o['moving'] = False

    bpy.context.view_layer.update()
    return anim, movers


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
        gap = max(gap, max(b_mn[i] - a_mx[i], a_mn[i] - b_mx[i]))
    return gap


def check(anim, movers):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    passport = (0.500, 0.150, 0.150)
    got_sorted = tuple(sorted((round(size.x, 5), round(size.y, 5), round(size.z, 5)),
                              reverse=True))
    bbox_ok = all(abs(g - p) <= 0.004 for g, p in zip(got_sorted, passport))

    kids = [o for o in anim.children if o.type == 'MESH']
    kid_names = {o.name for o in kids}

    # --- тест хода: едет только подвижная группа, статика заморожена ---
    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    anim.location = Vector((anim.location.x + TRAVEL, anim.location.y,
                            anim.location.z))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}

    move_err = 0.0
    for name in kid_names:
        move_err = max(move_err, (after[name] - before[name] - Vector((TRAVEL, 0, 0))).length)
    static_err = max(((after[n] - before[n]).length for n in before if n not in kid_names),
                     default=0.0)

    ext_mn, ext_mx = mesh_bbox(meshes)          # габарит в выдвинутом положении
    anim.location = Vector((anim.location.x - TRAVEL, anim.location.y,
                            anim.location.z))
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    pivot_shift = max((restored[n] - before[n]).length for n in before)

    # --- «не висит в воздухе» ---
    boxes = {o.name: mesh_bbox([o]) for o in meshes}
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0015
                   for other in boxes):
            floating.append(name)

    anim_loc = anim.location.copy()
    axis_ok = (abs(anim_loc.x) < 1e-6 and abs(anim_loc.y) < 1e-6
               and abs(anim_loc.z - AXIS_Z) < 1e-6)

    rod_mn, rod_mx = mesh_bbox([bpy.data.objects[PREFIX + 'rod_tip']])
    protrusion = rod_mx.x - BUSH_X1

    report = {
        'component': CID,
        'code': 'MOT-PIS-01',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in (mn + mx) * 0.5],
        'bbox_sorted_m': list(got_sorted),
        'bbox_passport_m': list(passport),
        'bbox_ok': bool(bbox_ok),
        'bbox_extended_size_xyz': [round(v, 5) for v in (ext_mx - ext_mn)],
        'floor_contact_z': round(mn.z, 6),
        'floor_contact_ok': bool(abs(mn.z) < 0.0006),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim_loc],
        'anim_type': anim.get('motion_type'),
        'anim_axis': anim.get('motion_axis'),
        'anim_amount_m': anim.get('motion_amount'),
        'anim_speed_rad_s': anim.get('motion_speed'),
        'anim_children': sorted(kid_names),
        'anim_children_count': len(kids),
        'static_parts': sorted(o.name for o in meshes if o.name not in kid_names),
        'static_count': len([o for o in meshes if o.name not in kid_names]),
        'slide_delta_m': TRAVEL,
        'mover_error_m': round(move_err, 9),
        'static_error_m': round(static_err, 9),
        'slide_rigid_ok': bool(move_err < 1e-6),
        'static_frozen_ok': bool(static_err < 1e-9),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_ok': bool(pivot_shift < 1e-6 and axis_ok),
        'rod_protrusion_m': round(protrusion, 5),
        'rod_protrusion_ok': bool(protrusion > 0.09),
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
    scene.view_settings.exposure = 0.02
    try:
        scene.eevee.taa_render_samples = 128
        scene.eevee.shadow_ray_count = 4
        scene.eevee.shadow_step_count = 8
        scene.eevee.use_shadow_high_bitdepth = True
        scene.eevee.shadow_resolution_scale = 1.0
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.700, 0.694, 0.684, 1.0)
    bg.inputs['Strength'].default_value = 0.40

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=9,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.520, 0.514, 0.502, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.42, -0.46, 0.58), 3.40, 0.50),
            ('fill', (-0.55, -0.38, 0.34), 0.85, 0.75),
            ('rim', (0.05, 0.52, 0.50), 1.90, 0.50)):
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
    # крупный план: выход штока, уплотнение, втулка, муфта, вилка
    close_t = Vector((0.175, 0.0, 0.075))
    c_close = box_corners(Vector((0.060, -0.070, 0.010)) - close_t,
                          Vector((0.262, 0.070, 0.150)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill, objs=None):
        worst = 0.0
        for o in (objs if objs is not None else mesh_objs):
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    # крупный план кадрируем только по узлам выхода штока
    close_objs = [o for o in mesh_objs if mesh_bbox([o])[1].x > 0.050]

    views = [
        ('3q', (0.80, -0.74, 0.62), center + Vector((0, 0, 0.012)), 70, c_main,
         0.92, None),
        ('front', (1.00, -0.10, 0.16), center + Vector((0.004, 0, 0.010)), 70,
         c_main, 0.90, None),
        ('side', (0.04, -1.00, 0.22), center + Vector((0, 0, 0.008)), 70, c_main,
         0.92, None),
        ('closeup', (0.58, -0.78, 0.42), close_t, 85, c_close, 0.94, close_objs),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, focus in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(6):
            got = max_ndc(fill, focus)
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
        print(f'RENDERED {tag} fill={max_ndc(fill, focus):.3f} {fp}', flush=True)

    # миниатюра 300 px по короткой стороне — проверка читаемости
    src = RENDER_DIR / f'{CID}_3q.png'
    img = bpy.data.images.load(str(src))
    w = 300
    h = max(1, int(round(w * img.size[1] / img.size[0])))
    img.scale(w, h)
    thumb = RENDER_DIR / f'{CID}_3q_300px.png'
    img.filepath_raw = str(thumb)
    img.file_format = 'PNG'
    img.save()
    outs.append(str(thumb.relative_to(PROJECT)))
    print(f'THUMB {thumb} {w}x{h}', flush=True)
    return outs


def main():
    anim, movers = build()
    rep = check(anim, movers)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['pivot_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and rep['no_floating_ok'] and rep['static_frozen_ok']
            and rep['rod_protrusion_ok']):
        raise SystemExit('checks failed')


main()
