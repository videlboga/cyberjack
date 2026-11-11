"""Standalone builder: motion_piston_servo (MOT-PIS-06, «Сервоцилиндр»).

Сервоцилиндр с обратной связью: серво-мотор с энкодером сзади, открытая
зубчатая (ременная) передача на ШВП, ШВП с ходовой гайкой на каретке,
две направляющие, корпус-цилиндр с головкой и уплотнением, контроллер
с клеммной колодкой на корпусе, разъёмы, кабельный лоток с кабелем,
два концевых датчика с LED, шильдик; полированный шток с вилкой.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_piston_servo.py

Выход:
  public/models/machine-modules/components/motion_piston_servo.glb
  docs/plans/blockout/component-library/motion_piston_servo/*.png
  docs/plans/blockout/component-library/motion_piston_servo/report.json

Геометрия (Blender Z-up, метры):
  ось привода  = X, z = 0.090; низ на z = 0
  габарит      = 0.60 (X) x 0.18 (Y) x 0.18 (Z)  — паспорт MOT-PIS-06
  анимация     = сдвиг пустышки motion_piston_servo__anim по X, 0.07 м, 1.1 рад/с
  двигается    = гайка ШВП с кареткой и башмаками, труба-толкатель, шток,
                 контргайка, наконечник, вилка с пальцем
  статично     = энкодер, мотор с рёбрами и клеммной коробкой, плита-фланец,
                 зубчатый ремень с шкивами, опора винта, винт ШВП,
                 канал с направляющими, корпус, головка, втулка, уплотнение,
                 контроллер, клеммная колодка, разъёмы, кабель, лоток,
                 датчики, шильдик, лапы с болтами
"""
from pathlib import Path
import json
import math
import struct
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_piston_servo'
CID = 'motion_piston_servo'
CODE = 'MOT-PIS-06'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
AXIS_Z = 0.090                    # высота оси винта/штока
X_REAR, X_TIP = -0.300, 0.300     # габарит по паспорту 0,60
HALF_Y = 0.090                    # полугабарит 0,18
Z_TOP = 0.180                     # верх контроллера

# энкодер (сзади мотора)
ENC_X0, ENC_X1 = -0.300, -0.288
ENC_R = 0.030
# серво-мотор (сверху, ось параллельна винту -> ремень в плоскости Y-Z)
MOTOR_X0, MOTOR_X1 = -0.288, -0.214
MOTOR_R = 0.042
MOTOR_Y = 0.0
MOTOR_Z = 0.132
# плита-фланец мотора
PLATE_X0, PLATE_X1 = -0.214, -0.207
# шкивы и ремень
PUL_X0, PUL_X1 = -0.210, -0.194
PUL_R = 0.0265
BELT_R = 0.0295                  # средняя линия ремня
BELT_X = -0.200
BELT_W = 0.012
BELT_T = 0.005
BELT_TEETH = 28
# опора винта
BRG_X0, BRG_X1 = -0.186, -0.172
# ШВП
SCREW_X0, SCREW_X1 = -0.180, -0.014
SCREW_R = 0.0145
# канал с направляющими
CAGE_X0, CAGE_X1 = -0.172, -0.020
CAGE_HY = 0.067
RAIL_Y = 0.048
RAIL_R = 0.0065
# гайка (покой) и подвижная группа
NUT_X0, NUT_X1 = -0.108, -0.080
NUT_R = 0.027
TUBE_X1 = -0.006
# корпус
BULK_X0, BULK_X1 = -0.020, -0.004
BODY_X0, BODY_X1 = -0.004, 0.126
BODY_R = 0.056
COLLAR_X0, COLLAR_X1 = 0.126, 0.144
BUSH_X0, BUSH_X1 = 0.144, 0.154
# шток и вилка
ROD_R = 0.017
ROD_X0, ROD_X1 = -0.006, 0.268
CLEVIS_X0, CLEVIS_X1 = 0.276, 0.300
TRAVEL = 0.070
ANIM_SPEED = 1.1

PALETTE = {
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.180, 0.186, 0.196),
    'steel': (0.660, 0.666, 0.658),
    'alu': (0.735, 0.742, 0.748),
    'ivory': (0.980, 0.973, 0.957),
    'body': (0.945, 0.937, 0.918),
    'blush': (0.910, 0.725, 0.749),
    'cyan': (0.330, 0.845, 0.930),
    'red': (0.720, 0.070, 0.060),
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
        bsdf.inputs['Emission Strength'].default_value = 0.30
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


def ring_stack(name, x0, x1, count, radius, depth, role, seg=18, y=0.0, z=AXIS_Z):
    """Пакет узких колец-витков (резьба ШВП) одним мешем."""
    bm = bmesh.new()
    span = x1 - x0
    rot = Vector((1, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    for i in range(count):
        xc = x0 + (i + 0.5) * span / count
        m = Matrix.Translation((xc, y, z)) @ rot
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=radius, radius2=radius, depth=depth,
                              matrix=m)
    return mesh_from_bm(name, bm, role, True)


# --- зубчатый ремень -----------------------------------------------------
def _stadium(c0, c1, r, t):
    """Точка на «стадионе» (два равных шкива) и касательная в плоскости Y-Z."""
    y0, z0 = c0
    y1, z1 = c1
    dy, dz = y1 - y0, z1 - z0
    d = math.hypot(dy, dz)
    uy, uz = dy / d, dz / d
    ny, nz = -uz, uy
    L = 2 * d + 2 * math.pi * r
    t = t % L
    if t < d:                                   # прямая c0 -> c1 (сторона +n)
        s = t
        return (y0 + uy * s + ny * r, z0 + uz * s + nz * r), (uy, uz)
    t -= d
    if t < math.pi * r:                         # дуга вокруг c1 через +u
        a = t / r
        cy = ny * math.cos(a) + uy * math.sin(a)
        cz = nz * math.cos(a) + uz * math.sin(a)
        ty = -ny * math.sin(a) + uy * math.cos(a)
        tz = -nz * math.sin(a) + uz * math.cos(a)
        return (y1 + cy * r, z1 + cz * r), (ty, tz)
    t -= math.pi * r
    if t < d:                                   # обратная прямая
        s = t
        return (y1 - uy * s - ny * r, z1 - uz * s - nz * r), (-uy, -uz)
    t -= d
    a = t / r                                   # дуга вокруг c0 через -u
    cy = -ny * math.cos(a) - uy * math.sin(a)
    cz = -nz * math.cos(a) - uz * math.sin(a)
    ty = ny * math.sin(a) - uy * math.cos(a)
    tz = nz * math.sin(a) - uz * math.cos(a)
    return (y0 + cy * r, z0 + cz * r), (ty, tz)


def timing_belt(name, x_c, width, c0, c1, r, thickness, teeth, role):
    """Зубчатый ремень: блоки-зубья по замкнутому контуру двух шкивов."""
    mid = ((c0[0] + c1[0]) * 0.5, (c0[1] + c1[1]) * 0.5)
    dy, dz = c1[0] - c0[0], c1[1] - c0[1]
    d = math.hypot(dy, dz)
    L = 2 * d + 2 * math.pi * r
    pitch = L / teeth
    bm = bmesh.new()
    for k in range(teeth):
        p, tg = _stadium(c0, c1, r, (k + 0.5) * pitch)
        ty, tz = tg
        # радиальная нормаль — от центра контура наружу
        ny, nz = -tz, ty
        if ny * (p[0] - mid[0]) + nz * (p[1] - mid[1]) < 0:
            ny, nz = -ny, -nz
        m = Matrix.Identity(4)
        m[0][0], m[1][0], m[2][0] = 1.0, 0.0, 0.0
        m[0][1], m[1][1], m[2][1] = 0.0, ty, tz
        m[0][2], m[1][2], m[2][2] = 0.0, ny, nz
        m.translation = Vector((x_c, p[0], p[1]))
        bmesh.ops.create_cube(bm, size=1.0,
                              matrix=m @ Matrix.Diagonal((width, pitch * 0.92,
                                                          thickness, 1.0)))
    return mesh_from_bm(name, bm, role, False)


def belt_runs(name, x_c, width, c0, c1, r_in, r_out, role, seg=56):
    """Сплошная лента ремня под зубьями (замкнутый контур)."""
    bm = bmesh.new()
    d = math.hypot(c1[0] - c0[0], c1[1] - c0[1])
    L = 2 * d + 2 * math.pi * r_out
    rings = []
    for i in range(seg):
        p, _ = _stadium(c0, c1, r_out, i * L / seg)
        mid = ((c0[0] + c1[0]) * 0.5, (c0[1] + c1[1]) * 0.5)
        ny, nz = p[0] - mid[0], p[1] - mid[1]
        ln = math.hypot(ny, nz)
        ny, nz = ny / ln, nz / ln
        ring = []
        for x in (x_c - width * 0.5, x_c + width * 0.5):
            for rr in (r_in, r_out):
                ring.append(bm.verts.new((x, p[0] + ny * 0.0 + (rr - r_out) * ny,
                                          p[1] + (rr - r_out) * nz)))
        rings.append(ring)
    n = len(rings)
    for i in range(n):
        a_, b_ = rings[i], rings[(i + 1) % n]
        bm.faces.new((a_[0], a_[2], b_[2], b_[0]))
        bm.faces.new((a_[1], b_[1], b_[3], a_[3]))
        bm.faces.new((a_[0], a_[1], b_[1], b_[0]))
        bm.faces.new((a_[2], a_[3], b_[3], b_[2]))
    return mesh_from_bm(name, bm, role, True)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    movers = []
    Z = AXIS_Z

    # ---------- энкодер сзади мотора ----------
    cyl(PREFIX + 'encoder_cap', (ENC_X0, MOTOR_Y, MOTOR_Z),
        (ENC_X0 + 0.008, MOTOR_Y, MOTOR_Z),
        0.026, 'dark', vertices=32, bev=0.0012)
    cyl(PREFIX + 'encoder_body', (ENC_X0 + 0.008, MOTOR_Y, MOTOR_Z),
        (ENC_X1, MOTOR_Y, MOTOR_Z),
        ENC_R, 'graphite', vertices=32, bev=0.0010)
    cyl(PREFIX + 'encoder_ring', (ENC_X0 + 0.0125, MOTOR_Y, MOTOR_Z),
        (ENC_X0 + 0.0215, MOTOR_Y, MOTOR_Z),
        0.0322, 'cyan', vertices=32, bev=0.0010)
    torus(PREFIX + 'encoder_ring_edge', (ENC_X0 + 0.0220, MOTOR_Y, MOTOR_Z),
          0.0318, 0.0018, 'cyan', 'X')
    torus(PREFIX + 'encoder_face_ring', (ENC_X0 + 0.0015, MOTOR_Y, MOTOR_Z),
          0.0262, 0.0030, 'cyan', 'X')
    cyl(PREFIX + 'encoder_screw', (ENC_X0 + 0.004, MOTOR_Y, MOTOR_Z),
        (ENC_X0 + 0.001, MOTOR_Y, MOTOR_Z), 0.0075, 'steel', vertices=12)
    cube(PREFIX + 'encoder_connector', (ENC_X0 + 0.012, MOTOR_Y - 0.020, MOTOR_Z - 0.022),
         (0.016, 0.018, 0.017), 'graphite', r=0.0012)

    # ---------- серво-мотор с рёбрами ----------
    cyl(PREFIX + 'motor', (MOTOR_X0, MOTOR_Y, MOTOR_Z),
        (MOTOR_X1, MOTOR_Y, MOTOR_Z),
        MOTOR_R, 'dark', vertices=44, bev=0.0022)
    for i, x in enumerate((-0.281, -0.267, -0.253, -0.239, -0.225)):
        torus(PREFIX + f'motor_fin_{i}', (x, MOTOR_Y, MOTOR_Z), MOTOR_R + 0.0006,
              0.0028, 'steel', 'X')
    cyl(PREFIX + 'motor_nose', (-0.2165, MOTOR_Y, MOTOR_Z),
        (-0.2075, MOTOR_Y, MOTOR_Z), 0.030, 'steel', vertices=32, bev=0.0012)
    cube(PREFIX + 'motor_terminal', (-0.252, MOTOR_Y - 0.0455, MOTOR_Z),
         (0.032, 0.020, 0.026), 'graphite', r=0.0014)
    for i in range(3):
        cyl(PREFIX + f'terminal_post_{i}',
            (-0.262 + i * 0.010, MOTOR_Y - 0.0555, MOTOR_Z),
            (-0.262 + i * 0.010, MOTOR_Y - 0.0600, MOTOR_Z), 0.0032,
            'steel', vertices=10)

    # ---------- плита-фланец мотора ----------
    cube(PREFIX + 'motor_flange', ((PLATE_X0 + PLATE_X1) * 0.5, 0.0, 0.094),
         (PLATE_X1 - PLATE_X0, 0.146, 0.164), 'graphite', r=0.0020)
    cube(PREFIX + 'flange_bracket', (-0.196, 0.0, 0.052), (0.024, 0.070, 0.012),
         'graphite', r=0.0012)
    for i, (sy, sz) in enumerate(((-0.062, 0.030), (0.062, 0.030),
                                  (-0.062, 0.158), (0.062, 0.158))):
        cyl(PREFIX + f'flange_bolt_{i}', (PLATE_X1, sy, sz), (PLATE_X1 + 0.0035, sy, sz),
            0.0052, 'steel', vertices=10)

    # ---------- зубчатая передача: шкивы + ремень ----------
    pulleys = (('screw', Z), ('motor', MOTOR_Z))
    for tag, pz in pulleys:
        cyl(PREFIX + f'pulley_{tag}', (PUL_X0, 0.0, pz), (PUL_X1, 0.0, pz), PUL_R,
            'alu', vertices=32, bev=0.0012)
        for side, x in (('a', PUL_X0 + 0.0012), ('b', PUL_X1 - 0.0012)):
            torus(PREFIX + f'pulley_{tag}_flange_{side}', (x, 0.0, pz),
                  PUL_R + 0.0018, 0.0016, 'steel', 'X')
    cyl(PREFIX + 'pulley_screw_shaft', (PUL_X0, 0.0, Z), (BRG_X0, 0.0, Z),
        0.012, 'steel', vertices=20)
    cyl(PREFIX + 'pulley_motor_shaft', (PUL_X0, 0.0, MOTOR_Z),
        (MOTOR_X1, 0.0, MOTOR_Z), 0.012, 'steel', vertices=20)
    belt_runs(PREFIX + 'belt_band', BELT_X, BELT_W,
              (0.0, Z), (0.0, MOTOR_Z), BELT_R - BELT_T, BELT_R,
              'dark', seg=72)
    timing_belt(PREFIX + 'belt_teeth', BELT_X, BELT_W,
                (0.0, Z), (0.0, MOTOR_Z), BELT_R, BELT_T,
                BELT_TEETH, 'graphite')

    # ---------- опора винта ----------
    cyl(PREFIX + 'screw_bearing', (BRG_X0, 0, Z), (BRG_X1, 0, Z), 0.030,
        'steel', vertices=32, bev=0.0014)
    torus(PREFIX + 'bearing_ring', (BRG_X1 - 0.0015, 0, Z), 0.0306, 0.0026,
          'dark', 'X')

    # ---------- ШВП ----------
    cyl(PREFIX + 'screw', (SCREW_X0, 0, Z), (SCREW_X1, 0, Z), SCREW_R,
        'steel', vertices=24)
    ring_stack(PREFIX + 'screw_thread', SCREW_X0 + 0.003, SCREW_X1 - 0.004, 14,
               SCREW_R + 0.0013, 0.0052, 'steel', seg=18)

    # ---------- канал, направляющие ----------
    cube(PREFIX + 'cage_floor', ((CAGE_X0 + CAGE_X1) * 0.5, 0.0, 0.020),
         (CAGE_X1 - CAGE_X0, 2 * CAGE_HY - 0.012, 0.012), 'graphite', r=0.0015)
    for tag, sy in (('l', -1), ('r', 1)):
        cube(PREFIX + f'cage_wall_{tag}',
             ((CAGE_X0 + CAGE_X1) * 0.5, sy * (CAGE_HY - 0.003), 0.043),
             (CAGE_X1 - CAGE_X0, 0.006, 0.058), 'graphite', r=0.0012)
        cyl(PREFIX + f'guide_rail_{tag}', (CAGE_X0 - 0.002, sy * RAIL_Y, Z),
            (CAGE_X1 + 0.006, sy * RAIL_Y, Z), RAIL_R, 'alu', vertices=16)
        for side, x in (('rear', CAGE_X0 + 0.004), ('front', CAGE_X1 - 0.004)):
            cyl(PREFIX + f'rail_boss_{tag}_{side}', (x - 0.005, sy * RAIL_Y, Z),
                (x + 0.005, sy * RAIL_Y, Z), RAIL_R + 0.0055, 'steel',
                vertices=16, bev=0.0010)

    # ---------- контроллер с клеммной колодкой (на корпусе) ----------
    cube(PREFIX + 'controller', (0.056, 0.0, 0.163), (0.072, 0.092, 0.034),
         'graphite', r=0.0022)
    cube(PREFIX + 'controller_bracket', (0.056, 0.0, 0.1475),
         (0.062, 0.074, 0.010), 'graphite', r=0.0012)
    cube(PREFIX + 'controller_terminal', (0.056, -0.0480, 0.1630),
         (0.060, 0.007, 0.019), 'ivory', r=0.0010)
    for i in range(4):
        cyl(PREFIX + f'terminal_screw_{i}', (0.034 + i * 0.0147, -0.0515, 0.1630),
            (0.034 + i * 0.0147, -0.0455, 0.1630), 0.0032, 'steel', vertices=10)
    for i, role in enumerate(('cyan', 'cyan', 'red')):
        cyl(PREFIX + f'controller_led_{i}', (0.030 + i * 0.0075, -0.0462, 0.1745),
            (0.030 + i * 0.0075, -0.0500, 0.1745), 0.0028, role, vertices=10)
    cyl(PREFIX + 'controller_conn', (0.020, -0.030, 0.1580), (0.0135, -0.030, 0.1580),
        0.0085, 'steel', vertices=16, bev=0.0010)
    torus(PREFIX + 'controller_conn_ring', (0.0175, -0.030, 0.1580), 0.0088, 0.0018,
          'dark', 'X')

    # ---------- корпус: бобышка, цилиндр, головка, втулка, уплотнение ----------
    cyl(PREFIX + 'bulkhead', (BULK_X0, 0, Z), (BULK_X1, 0, Z), 0.058,
        'steel', vertices=40, bev=0.0018)
    for i in range(6):
        a = math.tau * i / 6 + 0.26
        cyl(PREFIX + f'bulkhead_bolt_{i}',
            (BULK_X1 - 0.0015, 0.0450 * math.cos(a), Z + 0.0450 * math.sin(a)),
            (BULK_X1 + 0.0025, 0.0450 * math.cos(a), Z + 0.0450 * math.sin(a)),
            0.0042, 'dark', vertices=8)
    cyl(PREFIX + 'body', (BODY_X0, 0, Z), (BODY_X1, 0, Z), BODY_R,
        'graphite', vertices=48, bev=0.0022)
    for tag, x in (('rear', 0.016), ('front', 0.110)):
        torus(PREFIX + f'body_band_{tag}', (x, 0, Z), BODY_R + 0.0012, 0.0034,
              'dark', 'X')
    cyl(PREFIX + 'collar', (COLLAR_X0, 0, Z), (COLLAR_X1, 0, Z), 0.060,
        'steel', vertices=44, bev=0.0018)
    torus(PREFIX + 'collar_mark', (COLLAR_X0 + 0.005, 0, Z), 0.0608, 0.0022,
          'red', 'X')
    cyl(PREFIX + 'guide_bush', (BUSH_X0, 0, Z), (BUSH_X1, 0, Z), 0.031,
        'alu', vertices=28, bev=0.0010)
    torus(PREFIX + 'wiper_seal', (BUSH_X1 + 0.0008, 0, Z), 0.0212, 0.0044,
          'dark', 'X')

    # ---------- шильдик ----------
    cube(PREFIX + 'label_plate', (0.070, -(BODY_R + 0.0010), Z),
         (0.056, 0.005, 0.024), 'ivory', r=0.0010)
    text_label(PREFIX + 'label_text', CODE,
               (0.070, -(BODY_R + 0.0042), Z), 0.0078, 'dark')

    # ---------- концевые датчики с LED и шиной ----------
    for tag, x in (('rear', -0.132), ('front', -0.044)):
        cube(PREFIX + f'sensor_{tag}', (x, -(CAGE_HY + 0.0055), 0.060),
             (0.020, 0.013, 0.023), 'graphite', r=0.0012)
        cyl(PREFIX + f'sensor_led_{tag}', (x, -(CAGE_HY + 0.0120), 0.060),
            (x, -(CAGE_HY + 0.0168), 0.060), 0.0040, 'cyan', vertices=12)
    curve_tube(PREFIX + 'sensor_bus',
               [(-0.132, -(CAGE_HY + 0.0045), 0.060),
                (-0.110, -(CAGE_HY + 0.0075), 0.062),
                (-0.066, -(CAGE_HY + 0.0075), 0.062),
                (-0.044, -(CAGE_HY + 0.0045), 0.060)], 0.0026, 'dark')

    # ---------- кабели по стенке канала, хомуты ----------
    curve_tube(PREFIX + 'cable_motor',
               [(-0.252, -0.0555, MOTOR_Z),
                (-0.256, -0.0700, 0.1120),
                (-0.246, -0.0765, 0.0640),
                (-0.220, -0.0745, 0.0465),
                (-0.150, -0.0745, 0.0450),
                (-0.060, -0.0745, 0.0450),
                (0.000, -0.0720, 0.0700),
                (0.012, -0.0640, 0.1200),
                (0.018, -0.0520, 0.1520)], 0.0034, 'dark')
    curve_tube(PREFIX + 'cable_encoder',
               [(-0.294, -0.0300, MOTOR_Z - 0.030),
                (-0.288, -0.0470, 0.0980),
                (-0.262, -0.0660, 0.0660),
                (-0.236, -0.0740, 0.0500),
                (-0.190, -0.0790, 0.0455),
                (-0.100, -0.0790, 0.0455),
                (-0.034, -0.0765, 0.0600),
                (0.008, -0.0680, 0.1200),
                (0.016, -0.0560, 0.1500)], 0.0028, 'dark')
    for i, x in enumerate((-0.196, -0.120, -0.048)):
        cube(PREFIX + f'cable_clamp_{i}', (x, -0.0765, 0.0455),
             (0.012, 0.014, 0.014), 'graphite', r=0.0010)

    # ---------- лапы-основание с болтами ----------
    FX0, FX1 = -0.298, 0.122
    for tag, sy in (('l', -1), ('r', 1)):
        cube(PREFIX + f'foot_rail_{tag}', ((FX0 + FX1) * 0.5, sy * 0.077, 0.007),
             (FX1 - FX0, 0.026, 0.014), 'graphite', r=0.0016)
        for i, x in enumerate((-0.278, -0.204, -0.060, 0.104)):
            cyl(PREFIX + f'foot_bolt_{tag}_{i}', (x, sy * 0.077, 0.0125),
                (x, sy * 0.077, 0.0180), 0.0050, 'steel', vertices=10)
    for tag, x, half in (('rear', -0.240, 0.058), ('mid', -0.096, 0.058),
                         ('front', 0.096, 0.058)):
        cube(PREFIX + f'foot_cross_{tag}', (x, 0.0, 0.007), (half * 2, 0.154, 0.014),
             'graphite', r=0.0016)

    # ---------- подвижная группа: гайка, каретка, толкатель, шток, вилка ----------
    movers.append(cyl(PREFIX + 'screw_nut', (NUT_X0, 0, Z), (NUT_X1, 0, Z),
                      NUT_R, 'blush', vertices=28, bev=0.0016))
    for tag, x in (('a', NUT_X0 + 0.002), ('b', NUT_X1 - 0.002)):
        movers.append(torus(PREFIX + f'nut_flange_{tag}', (x, 0, Z),
                            NUT_R + 0.0018, 0.0032, 'steel', 'X'))
    movers.append(cube(PREFIX + 'carriage_plate',
                       ((NUT_X0 + NUT_X1) * 0.5, 0.0, 0.0705),
                       (0.044, 0.130, 0.017), 'alu', r=0.0012))
    for tag, sy in (('l', -1), ('r', 1)):
        movers.append(cube(PREFIX + f'bearing_block_{tag}',
                           ((NUT_X0 + NUT_X1) * 0.5, sy * RAIL_Y, Z),
                           (0.042, 0.024, 0.024), 'graphite', r=0.0012))
    movers.append(cyl(PREFIX + 'push_tube', (NUT_X1, 0, Z), (TUBE_X1, 0, Z),
                      0.024, 'steel', vertices=28, bev=0.0012))
    movers.append(cyl(PREFIX + 'rod', (ROD_X0, 0, Z), (ROD_X1, 0, Z), ROD_R,
                      'alu', vertices=28, bev=0.0012))
    movers.append(cyl(PREFIX + 'rod_locknut', (0.196, 0, Z), (0.208, 0, Z),
                      0.0235, 'blush', vertices=24, bev=0.0014))
    movers.append(torus(PREFIX + 'rod_locknut_knurl', (0.202, 0, Z), 0.0242, 0.0022,
                        'steel', 'X'))
    movers.append(cyl(PREFIX + 'rod_coupling', (0.268, 0, Z), (CLEVIS_X0, 0, Z),
                      0.022, 'blush', vertices=24, bev=0.0014))
    movers.append(cube(PREFIX + 'clevis_block', (0.286, 0.0, Z),
                       (0.016, 0.050, 0.043), 'blush', r=0.0018))
    for tag, sy in (('l', -1), ('r', 1)):
        movers.append(cube(PREFIX + f'clevis_cheek_{tag}',
                           (0.2945, sy * 0.0165, Z), (0.011, 0.0085, 0.036),
                           'blush', r=0.0010))
    movers.append(cyl(PREFIX + 'clevis_pin', (0.2945, -0.0250, Z),
                      (0.2945, 0.0250, Z), 0.0042, 'steel', vertices=16))

    # ---------- анимационная пустышка на оси штока ----------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z))
    anim['motion_type'] = 'slide'
    anim['motion_axis'] = 'X'
    anim['motion_amount'] = TRAVEL
    anim['motion_speed'] = ANIM_SPEED
    anim['travel'] = 0.20
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

    passport = (0.600, 0.180, 0.180)
    got_sorted = tuple(sorted((round(size.x, 5), round(size.y, 5), round(size.z, 5)),
                              reverse=True))
    bbox_ok = all(abs(g - p) <= 0.004 for g, p in zip(got_sorted, passport))

    kids = [o for o in anim.children if o.type == 'MESH']
    kid_names = {o.name for o in kids}

    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    anim.location = Vector((anim.location.x + TRAVEL, anim.location.y,
                            anim.location.z))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}

    move_err = 0.0
    for name in kid_names:
        move_err = max(move_err,
                       (after[name] - before[name] - Vector((TRAVEL, 0, 0))).length)
    static_err = max(((after[n] - before[n]).length for n in before
                      if n not in kid_names), default=0.0)

    ext_mn, ext_mx = mesh_bbox(meshes)
    anim.location = Vector((anim.location.x - TRAVEL, anim.location.y,
                            anim.location.z))
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    pivot_shift = max((restored[n] - before[n]).length for n in before)

    boxes = {o.name: mesh_bbox([o]) for o in meshes}
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0015
                   for other in boxes):
            floating.append(name)

    anim_loc = anim.location.copy()
    axis_ok = (abs(anim_loc.x) < 1e-6 and abs(anim_loc.y) < 1e-6
               and abs(anim_loc.z - AXIS_Z) < 1e-6)

    rod_mn, rod_mx = mesh_bbox([bpy.data.objects[PREFIX + 'clevis_cheek_l']])
    protrusion = rod_mx.x - BUSH_X1

    report = {
        'component': CID,
        'code': CODE,
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


def verify_glb(path):
    """Читаем GLB-контейнер: узлы, дети anim, материалы (без рендера)."""
    data = path.read_bytes()
    magic, ver, _ = struct.unpack('<III', data[:12])
    if magic != 0x46546C67 or ver != 2:
        raise RuntimeError('bad glb header')
    clen, ctype = struct.unpack('<II', data[12:20])
    if ctype != 0x4E4F534A:
        raise RuntimeError('no json chunk')
    j = json.loads(data[20:20 + clen])
    nodes = j.get('nodes', [])
    anim_nodes = [n for n in nodes if n.get('name') == PREFIX + 'anim']
    kids = []
    if anim_nodes:
        kids = sorted(nodes[i].get('name', '') for i in anim_nodes[0].get('children', []))
    prefix_nodes = [n.get('name', '') for n in nodes if n.get('name', '').startswith(PREFIX)]
    return {
        'glb_bytes': len(data),
        'glb_nodes': len(nodes),
        'glb_prefix_nodes': len(prefix_nodes),
        'glb_materials': sorted(m.get('name', '') for m in j.get('materials', [])),
        'glb_meshes': len(j.get('meshes', [])),
        'glb_anim_children': kids,
        'glb_anim_children_count': len(kids),
        'glb_anim_extras': (anim_nodes[0].get('extras') if anim_nodes else None),
        'glb_bad_names': [n for n in nodes
                          if n.get('mesh') is not None and not n.get('name', '').startswith(PREFIX)],
    }


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
    # крупный план: мотор с энкодером, ремень, ШВП с гайкой, направляющие
    close_t = Vector((-0.120, 0.0, 0.095))
    c_close = box_corners(Vector((-0.302, -0.090, 0.010)) - close_t,
                          Vector((-0.020, 0.090, 0.172)) - close_t)

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

    close_objs = [o for o in mesh_objs if mesh_bbox([o])[0].x < -0.015]

    views = [
        ('3q', (0.72, -0.82, 0.55), center + Vector((0, 0, 0.012)), 70, c_main,
         0.92, None),
        ('front', (1.00, -0.10, 0.16), center + Vector((0.004, 0, 0.010)), 70,
         c_main, 0.90, None),
        ('side', (0.04, -1.00, 0.22), center + Vector((0, 0, 0.008)), 70, c_main,
         0.92, None),
        ('closeup', (0.62, -0.78, 0.40), close_t, 85, c_close, 0.94, close_objs),
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
    rep.update(verify_glb(path))
    norender = '--norender' in sys.argv
    rep['renders'] = [] if norender else render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['pivot_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and rep['no_floating_ok'] and rep['static_frozen_ok']
            and rep['slide_rigid_ok'] and rep['rod_protrusion_ok']
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
