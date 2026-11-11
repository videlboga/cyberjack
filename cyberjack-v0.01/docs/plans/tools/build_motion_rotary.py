"""Standalone builder: motion_rotary (MOT-ROT-04, «Поворотный модуль»).

Компактный ротатор Ø 0,30 × 0,30 м на горизонтальной оси X:
задний монтажный фланец (док), литой корпус редуктора с оребрением,
серво/шаговый мотор сверху, ременная передача (шкивы + зубчатый ремень)
в открытом окне, полый шпиндель на подшипниковом узле, выходной фланец,
трёхкулачковый патрон, энкодер с циановым кольцом, фиксатор (штифт)
и метка нуля на фланце, кожух ремня, кабельные вводы.
Плиты-основания нет.

Не зависит от build_component_library.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_rotary.py

Выход:
  public/models/machine-modules/components/motion_rotary.glb
  docs/plans/blockout/component-library/motion_rotary/*.png
  docs/plans/blockout/component-library/motion_rotary/report.json

Геометрия (Blender Z-up, метры):
  ось вращения   = X, линия y = 0, z = Z0 = 0,150
  габарит        = 0,300 (X) x 0,296 (Y) x 0,296 (Z); низ z ≈ 0,002
  анимация       = spin вокруг X, 1,1 раде/с (пустышка motion_rotary__anim)
  вращаются      = spindle, spindle_pulley, pulley_teeth, locknut,
                   output_flange, flange_bolts, hub, chuck_body, chuck_ring,
                   jaw_*, zero_mark
  статично       = rear_boss, rear_cover, mount_flange, flange_bolts_fixed,
                   cone, gearbox, gearbox_ribs, status_ring, belt_gap_web,
                   motor*, motor_pulley, belt, belt_guard, bearing_housing,
                   bearing_cap, bearing_bolt_*, encoder*, index_*, lock_*,
                   gland, cable, connector
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_rotary'
CID = 'motion_rotary'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.150                       # высота оси вращения
AXIS = Vector((0.0, 0.0, Z0))

# X-станции: -0.150 ... +0.150
X_REAR0, X_REAR1 = -0.150, -0.121   # задняя крышка / подшипниковый бурт
X_COVER0, X_COVER1 = -0.121, -0.109  # задняя крышка корпуса
X_FLG0, X_FLG1 = -0.109, -0.097     # монтажный фланец (док)
R_FLANGE = 0.122                    # тело фланца; лапы доводят до Ø 0,30
R_LUG = 0.134                       # центр лапы крепления
X_CONE0, X_CONE1 = -0.097, -0.079   # литой конус-переход
R_CONE0, R_CONE1 = 0.110, 0.086
X_GB0, X_GB1 = -0.079, -0.034       # корпус редуктора
R_GEARBOX = 0.086
X_GAP0, X_GAP1 = -0.034, 0.014      # окно ременной передачи
X_BRG0, X_BRG1 = 0.014, 0.088       # подшипниковый узел
R_BRG = 0.058
X_CAP0, X_CAP1 = 0.088, 0.098       # передняя крышка подшипника
R_CAP = 0.048
X_OFL0, X_OFL1 = 0.098, 0.112       # выходной фланец
R_OFL = 0.072
X_HUB0, X_HUB1 = 0.112, 0.118       # ступица
R_HUB = 0.050
X_CHK0, X_CHK1 = 0.118, 0.140       # корпус патрона
R_CHK = 0.060
X_JAW0, X_JAW1 = 0.138, 0.150       # кулачки

X_SPIN0, X_SPIN1 = -0.142, 0.098     # полый шпиндель
R_SPIN_OUT, R_SPIN_IN = 0.024, 0.013

X_PUL0, X_PUL1 = -0.031, 0.001      # шкив шпинделя
R_PUL = 0.040
R_PUL_TOOTH = 0.0435
X_BELT0, X_BELT1 = -0.022, -0.008   # ремень (по X)
BELT_T = 0.0032

MOT_Z = Z0 + 0.096                  # ось мотора 0,246
MOT_R = 0.050
X_MOT0, X_MOT1 = -0.108, -0.038
X_MOTCAP0 = -0.120
X_MOTBOSS1 = -0.031
R_MOT_PUL = 0.034

GUARD_X0, GUARD_X1 = X_GAP0, X_GAP1
GUARD_RI, GUARD_RO = 0.056, 0.064
GUARD_A0, GUARD_A1 = math.radians(135.0), math.radians(225.0)

ENC_BODY0, ENC_BODY1 = -0.150, -0.120   # энкодер на торце мотора (соосно)
ENC_BODY_R = 0.026

JAW_ANGLES = (math.radians(90.0), math.radians(210.0), math.radians(330.0))

PALETTE = {
    'ivory': (0.945, 0.937, 0.918),
    'steel': (0.760, 0.768, 0.775),
    'graphite': (0.300, 0.312, 0.325),
    'dark': (0.160, 0.168, 0.180),
    'blush': (0.855, 0.700, 0.712),
    'cyan': (0.180, 0.780, 0.860),
    'red': (0.780, 0.095, 0.080),
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
    bsdf.inputs['Metallic'].default_value = 0.30 if role in ('steel', 'graphite') else 0.0
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


def bevel(obj, width=0.0015, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), smooth=False):
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


def tube(name, x0, x1, r_out, r_in, role, seg=36, smooth=True, cz=Z0):
    """Полый цилиндр по X (видно отверстие с торца), ось на высоте cz."""
    bm = bmesh.new()
    rings = []
    for x in (x0, x1):
        for r in (r_out, r_in):
            ring = []
            for i in range(seg):
                a = math.tau * i / seg
                ring.append(bm.verts.new((x, math.sin(a) * r,
                                          cz + math.cos(a) * r)))
            rings.append(ring)
    o0, i0, o1, i1 = rings
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((o0[i], o0[j], o1[j], o1[i]))      # наружная
        bm.faces.new((i0[i], i1[i], i1[j], i0[j]))      # внутренняя
        bm.faces.new((o0[i], i0[i], i0[j], o0[j]))      # торец x0
        bm.faces.new((o1[i], o1[j], i1[j], i1[i]))      # торец x1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='X', segs=48, rings=10):
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


def curve_tube(name, points, radius, role, res=6):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 10
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


def arc_shell(name, x0, x1, r_in, r_out, a0, a1, seg, role, cy=0.0, cz=Z0):
    """Тонкий кожух-сектор вокруг оси X: a=0 -> +Z, a=+90° -> +Y."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        dy, dz = math.sin(a), math.cos(a)
        ring = []
        for x in (x0, x1):
            for r in (r_in, r_out):
                ring.append(bm.verts.new((x, cy + dy * r, cz + dz * r)))
        rings.append(ring)
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        bm.faces.new((a_[0], a_[2], b_[2], b_[0]))
        bm.faces.new((a_[1], b_[1], b_[3], a_[3]))
        bm.faces.new((a_[0], a_[1], b_[1], b_[0]))
        bm.faces.new((a_[2], a_[3], b_[3], b_[2]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, True)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def radial(a):
    """Радиальное направление вокруг оси X: a=0 -> +Z, a=+90° -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


def radial_box(name, x, a, r, size, role, r_bevel=0.0012):
    """Коробка на радиусе r под углом a; size = (по X, тангенс, радиус)."""
    p = Vector((x, 0.0, 0.0)) + radial(a) * r + Vector((0.0, 0.0, Z0))
    obj = cube(name, p, size, role, r=r_bevel, rot=(-a, 0.0, 0.0))
    return obj


def radial_cyl(name, x, a, r0, r1, radius, role, vertices=20, bev=0.0):
    d = radial(a)
    base = Vector((x, 0.0, Z0))
    return cyl(name, base + d * r0, base + d * r1, radius, role,
               vertices=vertices, bev=bev)


def belt_loop(name, x0, x1, r_a, r_b, dz_b, t, role, n_arc=30):
    """Зубчатый ремень: замкнутая лента вокруг двух шкивов в плоскости YZ.

    Шкив A — на оси (0, Z0), B — на (0, Z0+dz_b). Контур = огибающая двух
    окружностей (две дуги + два прямых участка), толщина t по нормали.
    """
    ca, cb = (0.0, 0.0), (0.0, dz_b)
    d = dz_b
    u = (0.0, 1.0)
    v = (-1.0, 0.0)
    cosd = max(-1.0, min(1.0, (r_a - r_b) / d))
    delta = math.acos(cosd)

    n1 = (math.cos(delta) * u[0] + math.sin(delta) * v[0],
          math.cos(delta) * u[1] + math.sin(delta) * v[1])
    n2 = (math.cos(delta) * u[0] - math.sin(delta) * v[0],
          math.cos(delta) * u[1] - math.sin(delta) * v[1])
    a1 = math.atan2(n1[0], n1[1])
    a2 = math.atan2(n2[0], n2[1])
    s = (a2 - a1 + math.pi) % math.tau - math.pi
    lng = s - math.tau * (1.0 if s > 0 else -1.0)

    angs_a = [a1 + lng * i / n_arc for i in range(n_arc + 1)]     # длинная дуга A (низ)
    angs_b = [a2 - s * i / n_arc for i in range(1, n_arc + 1)]     # короткая дуга B (верх)

    def ring(r_a_, r_b_):
        pts = []
        for a in angs_a:
            pts.append((ca[0] + math.sin(a) * r_a_, ca[1] + math.cos(a) * r_a_))
        for a in angs_b:
            pts.append((cb[0] + math.sin(a) * r_b_, cb[1] + math.cos(a) * r_b_))
        return pts

    outer = ring(r_a + t, r_b + t)
    inner = ring(r_a, r_b)
    bm = bmesh.new()
    so, si = [], []
    for (y, z) in outer:
        so.append((bm.verts.new((x0, y, z + Z0)), bm.verts.new((x1, y, z + Z0))))
    for (y, z) in inner:
        si.append((bm.verts.new((x0, y, z + Z0)), bm.verts.new((x1, y, z + Z0))))
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((so[i][0], so[j][0], so[j][1], so[i][1]))     # наружная
        bm.faces.new((si[i][1], si[j][1], si[j][0], si[i][0]))     # внутренняя
        bm.faces.new((so[i][1], so[j][1], si[j][1], si[i][1]))     # бок x1
        bm.faces.new((so[i][0], si[i][0], si[j][0], so[j][0]))     # бок x0
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm, role)


def pulley_teeth(name, x0, x1, r_in, r_out, role, count=30, cz=Z0):
    bm = bmesh.new()
    for k in range(count):
        a = math.tau * k / count
        r = (r_in + r_out) * 0.5
        pos = Vector((0.0, 0.0, cz)) + radial(a) * r + Vector(((x0 + x1) * 0.5, 0, 0))
        m = (Matrix.Translation(pos)
             @ Matrix.Rotation(-a, 4, 'X')
             @ Matrix.Diagonal((x1 - x0, math.tau * r_in / count * 0.62, r_out - r_in, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return mesh_from_bm(name, bm, role)


def bolt_ring(prefix, x0, x1, radius, count, role, r_bolt=0.0042, phase=0.0):
    out = []
    for k in range(count):
        a = math.tau * k / count + phase
        p = radial(a) * radius + Vector((0.0, 0.0, Z0))
        out.append(cyl(f'{prefix}_{k}', (x0, p.y, p.z), (x1, p.y, p.z),
                       r_bolt, role, vertices=12, bev=0.0005))
    return out


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---------- вращающаяся группа ----------
    tube(PREFIX + 'spindle', X_SPIN0, X_SPIN1, R_SPIN_OUT, R_SPIN_IN, 'steel', seg=40)
    rotating.append(bpy.data.objects[PREFIX + 'spindle'])

    # шкив шпинделя + зубья
    cyl(PREFIX + 'spindle_pulley', (X_PUL0, 0, Z0), (X_PUL1, 0, Z0), R_PUL,
        'graphite', vertices=44, bev=0.0012)
    cyl(PREFIX + 'pulley_rim_rear', (X_PUL0, 0, Z0), (X_PUL0 + 0.0025, 0, Z0),
        R_PUL_TOOTH + 0.0035, 'steel', vertices=44)
    pulley_teeth(PREFIX + 'pulley_teeth', X_PUL0 + 0.003, X_PUL1 - 0.003,
                 R_PUL - 0.001, R_PUL_TOOTH, 'dark', count=30)
    rotating += [bpy.data.objects[PREFIX + n] for n in
                 ('spindle_pulley', 'pulley_rim_rear', 'pulley_teeth')]

    # гайка шпинделя
    cyl(PREFIX + 'locknut', (0.001, 0, Z0), (0.012, 0, Z0), 0.031,
        'steel', vertices=24, bev=0.0010)
    torus(PREFIX + 'locknut_groove', (0.0065, 0, Z0), 0.0312, 0.0018, 'dark', 'X')
    rotating += [bpy.data.objects[PREFIX + n] for n in ('locknut', 'locknut_groove')]

    # выходной фланец, ступица, крепёж патрона
    cyl(PREFIX + 'output_flange', (X_OFL0, 0, Z0), (X_OFL1, 0, Z0), R_OFL,
        'steel', vertices=52, bev=0.0018)
    cyl(PREFIX + 'hub', (X_HUB0, 0, Z0), (X_HUB1, 0, Z0), R_HUB,
        'graphite', vertices=36, bev=0.0012)
    rotating += [bpy.data.objects[PREFIX + n] for n in ('output_flange', 'hub')]
    rotating += bolt_ring(PREFIX + 'flange_bolt', 0.1115, 0.1175, 0.058, 6,
                          'dark', r_bolt=0.0044, phase=math.radians(30))

    # патрон: корпус, кольцо, 3 кулачка
    tube(PREFIX + 'chuck_body', X_CHK0, X_CHK1, R_CHK, 0.022, 'graphite', seg=40)
    cyl(PREFIX + 'chuck_bore', (X_CHK0 + 0.004, 0, Z0), (X_CHK1 - 0.006, 0, Z0),
        0.0215, 'dark', vertices=28, smooth=True)
    tube(PREFIX + 'chuck_ring', X_CHK1, X_CHK1 + 0.004, R_CHK - 0.001, 0.045,
         'steel', seg=40)
    rotating += [bpy.data.objects[PREFIX + n] for n in
                 ('chuck_body', 'chuck_bore', 'chuck_ring')]
    for i, a in enumerate(JAW_ANGLES):
        jaw = radial_box(f'{PREFIX}jaw_{i + 1}', 0.142, a, 0.034,
                         (0.008, 0.028, 0.032), 'steel', r_bevel=0.0010)
        step = radial_box(f'{PREFIX}jaw_{i + 1}_step', 0.1475, a, 0.030,
                          (0.005, 0.020, 0.024), 'steel', r_bevel=0.0008)
        rotating += [jaw, step]

    # метка нуля на ободе фланца (внутри R_OFL — bbox не смещает)
    rotating.append(radial_box(PREFIX + 'zero_mark', 0.105, 0.0, 0.068,
                               (0.013, 0.010, 0.008), 'red', r_bevel=0.0006))

    # ---------- статика: задний узел и корпус ----------
    cyl(PREFIX + 'rear_boss', (X_REAR0, 0, Z0), (X_REAR1, 0, Z0), 0.030,
        'graphite', vertices=32, bev=0.0020)
    torus(PREFIX + 'rear_boss_ring', (X_REAR0 + 0.002, 0, Z0), 0.0305, 0.0022,
          'steel', 'X')
    cyl(PREFIX + 'rear_cover', (X_COVER0, 0, Z0), (X_COVER1, 0, Z0), 0.090,
        'graphite', vertices=44, bev=0.0025)
    cyl(PREFIX + 'mount_flange', (X_FLG0, 0, Z0), (X_FLG1, 0, Z0), R_FLANGE,
        'graphite', vertices=64, bev=0.0030)
    # четыре лапы крепления к доку (доводят габарит до Ø 0,30)
    for i in range(4):
        a = math.radians(90.0 * i)
        radial_box(f'{PREFIX}mount_lug_{i + 1}', (X_FLG0 + X_FLG1) * 0.5, a,
                   R_LUG, (0.012, 0.042, 0.032), 'graphite', r_bevel=0.0035)
        p = radial(a) * R_LUG
        cyl(f'{PREFIX}mount_bolt_{i + 1}', (X_FLG1 - 0.001, p.y, Z0 + p.z),
            (X_FLG1 + 0.006, p.y, Z0 + p.z), 0.0062, 'steel', vertices=14,
            bev=0.0006)
    cyl(PREFIX + 'cone', (X_CONE0, 0, Z0), (X_CONE1, 0, Z0), R_CONE0,
        'graphite', vertices=52, r2=R_CONE1, bev=0.0025)
    # литые рёбра-косынки на конусе
    for i in range(6):
        radial_box(f'{PREFIX}cone_rib_{i + 1}', -0.088,
                   math.radians(30 + 60 * i), 0.100,
                   (0.018, 0.016, 0.036), 'graphite', r_bevel=0.0014)
    cyl(PREFIX + 'gearbox', (X_GB0, 0, Z0), (X_GB1, 0, Z0), R_GEARBOX,
        'graphite', vertices=48, bev=0.0030)
    # оребрение корпуса
    for i, x in enumerate((-0.070, -0.058, -0.046)):
        cyl(f'{PREFIX}gearbox_rib_{i + 1}', (x, 0, Z0), (x + 0.005, 0, Z0),
            R_GEARBOX + 0.006, 'graphite', vertices=48, bev=0.0012)
    # циановое кольцо на переднем бурте корпуса
    cyl(PREFIX + 'gearbox_collar', (X_GB1 - 0.008, 0, Z0), (X_GB1, 0, Z0),
        R_GEARBOX + 0.008, 'graphite', vertices=48, bev=0.0015)
    torus(PREFIX + 'status_ring', (X_GB1 - 0.003, 0, Z0), R_GEARBOX + 0.0086,
          0.0030, 'cyan', 'X')

    # нижняя перемычка через окно ременной передачи
    cube(PREFIX + 'belt_gap_web', (-0.010, 0.0, 0.0785), (0.048, 0.104, 0.033),
         'graphite', r=0.0030)
    for sy in (-1, 1):
        cube(f'{PREFIX}belt_web_gusset_{"A" if sy < 0 else "B"}',
             (-0.010, sy * 0.040, 0.1005), (0.030, 0.010, 0.020),
             'graphite', r=0.0016)

    # ---------- мотор + ременная передача ----------
    cyl(PREFIX + 'motor', (X_MOT0, 0, MOT_Z), (X_MOT1, 0, MOT_Z), MOT_R,
        'blush', vertices=48, bev=0.0035)
    for i, x in enumerate((-0.096, -0.082, -0.068, -0.054)):
        cyl(f'{PREFIX}motor_fin_{i + 1}', (x, 0, MOT_Z), (x + 0.004, 0, MOT_Z),
            MOT_R + 0.003, 'graphite', vertices=44, bev=0.0010)
    cyl(PREFIX + 'motor_cap', (X_MOTCAP0, 0, MOT_Z), (X_MOT0, 0, MOT_Z), 0.045,
        'dark', vertices=36, bev=0.0025)
    cyl(PREFIX + 'motor_boss', (X_MOT1 - 0.003, 0, MOT_Z), (X_MOTBOSS1, 0, MOT_Z),
        0.044, 'dark', vertices=36, bev=0.0022)
    cyl(PREFIX + 'motor_pulley', (X_PUL0, 0, MOT_Z), (X_PUL1, 0, MOT_Z), R_MOT_PUL,
        'graphite', vertices=36, bev=0.0012)
    pulley_teeth(PREFIX + 'motor_pulley_teeth', X_PUL0 + 0.002, X_PUL1 - 0.002,
                 R_MOT_PUL - 0.001, R_MOT_PUL + 0.0035, 'dark', count=26, cz=MOT_Z)
    cyl(PREFIX + 'motor_pulley_rim', (X_PUL0, 0, MOT_Z), (X_PUL0 + 0.0025, 0, MOT_Z),
        R_MOT_PUL + 0.0050, 'steel', vertices=36)
    # клеммная коробка на +Y борту мотора
    cube(PREFIX + 'motor_terminal', (X_MOT0 + 0.030, -0.046, MOT_Z + 0.002),
         (0.032, 0.026, 0.024), 'graphite', r=0.0020)
    cube(PREFIX + 'motor_terminal_lid', (X_MOT0 + 0.030, -0.048, MOT_Z + 0.010),
         (0.026, 0.022, 0.004), 'dark', r=0.0010)

    belt_loop(PREFIX + 'belt', X_BELT0, X_BELT1, R_PUL_TOOTH,
              R_MOT_PUL + 0.0005, MOT_Z - Z0, BELT_T, 'dark')

    # кожух ремня (низ/бока, верх открыт для ремня и мотора)
    arc_shell(PREFIX + 'belt_guard', GUARD_X0, GUARD_X1, GUARD_RI, GUARD_RO,
              GUARD_A0, GUARD_A1, 32, 'ivory')
    # шильдик на корпусе подшипникового узла
    cube(PREFIX + 'nameplate', (0.052, 0.0, Z0 + R_BRG + 0.0012),
         (0.026, 0.019, 0.0024), 'dark', r=0.0006)
    cube(PREFIX + 'nameplate_edge', (0.052, 0.0, Z0 + R_BRG + 0.0030),
         (0.020, 0.013, 0.0012), 'steel', r=0.0004)

    # ---------- подшипниковый узел ----------
    cyl(PREFIX + 'bearing_housing', (X_BRG0, 0, Z0), (X_BRG1, 0, Z0), R_BRG,
        'graphite', vertices=48, bev=0.0030)
    cyl(PREFIX + 'bearing_housing_collar', (X_BRG0, 0, Z0), (X_BRG0 + 0.008, 0, Z0),
        R_BRG + 0.006, 'graphite', vertices=48, bev=0.0015)
    cyl(PREFIX + 'bearing_cap', (X_CAP0, 0, Z0), (X_CAP1, 0, Z0), R_CAP,
        'steel', vertices=44, bev=0.0022)
    torus(PREFIX + 'bearing_seal', (X_CAP0 + 0.0005, 0, Z0), 0.0295, 0.0032,
          'dark', 'X')
    for i, a in enumerate((math.radians(45), math.radians(135),
                            math.radians(225), math.radians(315))):
        radial_cyl(f'{PREFIX}bearing_bolt_{i + 1}', 0.0745, a, R_BRG - 0.002,
                    R_BRG + 0.006, 0.0052, 'dark', vertices=14, bev=0.0005)

    # ---------- энкодер на торце мотора (соосно валу) ----------
    cyl(PREFIX + 'encoder_body', (ENC_BODY0, 0, MOT_Z), (ENC_BODY1, 0, MOT_Z),
        ENC_BODY_R, 'dark', vertices=32, bev=0.0022)
    cyl(PREFIX + 'encoder_face', (ENC_BODY0, 0, MOT_Z), (ENC_BODY0 + 0.004, 0, MOT_Z),
        ENC_BODY_R - 0.005, 'graphite', vertices=28, bev=0.0010)
    torus(PREFIX + 'encoder_ring', (ENC_BODY0 + 0.006, 0, MOT_Z),
          ENC_BODY_R + 0.0012, 0.0022, 'cyan', 'X')
    cyl(PREFIX + 'encoder_clamp', (ENC_BODY1 - 0.004, 0, MOT_Z),
        (ENC_BODY1 + 0.002, 0, MOT_Z), ENC_BODY_R + 0.003, 'steel',
        vertices=28, bev=0.0010)
    curve_tube(PREFIX + 'encoder_cable',
               [(ENC_BODY0 + 0.004, -0.010, MOT_Z - 0.021),
                (ENC_BODY0 + 0.014, -0.024, MOT_Z - 0.030),
                (-0.112, -0.038, MOT_Z - 0.022),
                (-0.086, -0.046, MOT_Z + 0.002)],
               0.0030, 'dark')

    # ---------- фиксатор (штифт) и метка нуля ----------
    lock_a = math.radians(250.0)
    radial_box(PREFIX + 'lock_bracket', X_CAP0 + 0.004, lock_a, 0.066,
               (0.008, 0.024, 0.036), 'graphite', r_bevel=0.0012)
    radial_cyl(PREFIX + 'lock_body', 0.104, lock_a, 0.074, 0.097, 0.0125,
               'dark', vertices=20, bev=0.0012)
    radial_cyl(PREFIX + 'lock_pin', 0.104, lock_a, 0.0735, 0.086, 0.0055,
               'steel', vertices=14)
    # неподвижная риска-указатель у обода фланца (0° = +Z)
    radial_box(PREFIX + 'index_bracket', X_CAP0 + 0.003, 0.0, 0.062,
               (0.010, 0.018, 0.032), 'graphite', r_bevel=0.0010)
    radial_box(PREFIX + 'index_pointer', 0.0945, 0.0, 0.0765,
               (0.007, 0.012, 0.006), 'cyan', r_bevel=0.0006)

    # ---------- кабельный ввод на -Y-склоне корпуса ----------
    g_a = math.radians(205.0)
    radial_cyl(PREFIX + 'gland', -0.062, g_a, R_GEARBOX - 0.004, R_GEARBOX + 0.020,
               0.0105, 'dark', vertices=20, bev=0.0012)
    radial_cyl(PREFIX + 'gland_nut', -0.062, g_a, R_GEARBOX + 0.018,
               R_GEARBOX + 0.028, 0.0135, 'graphite', vertices=16, bev=0.0010)
    g_end = Vector((-0.062, 0.0, Z0)) + radial(g_a) * (R_GEARBOX + 0.028)
    curve_tube(PREFIX + 'cable',
               [(g_end.x, g_end.y, g_end.z),
                (g_end.x - 0.012, g_end.y - 0.008, g_end.z - 0.016),
                (g_end.x - 0.030, g_end.y - 0.012, g_end.z - 0.030),
                (g_end.x - 0.048, g_end.y - 0.014, g_end.z - 0.034)],
               0.0034, 'dark')
    cube(PREFIX + 'connector',
         (g_end.x - 0.056, g_end.y - 0.014, g_end.z - 0.034),
         (0.012, 0.009, 0.008), 'graphite', r=0.0014)

    # ---------- анимационная пустышка на оси шпинделя ----------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    bpy.context.view_layer.update()
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    names = {o.name for o in rotating}
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o.name not in names:
            o['rotating'] = False

    anim['motion_type'] = 'spin'
    anim['motion_axis'] = 'x'
    anim['motion_speed'] = 1.1
    anim['motion_parts'] = sorted(n[len(PREFIX):] for n in names)
    anim['motion_note'] = 'spin around X, output flange faces +X'

    bpy.context.view_layer.update()
    return anim, rotating


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


def check(anim, rotating):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    passport = (0.300, 0.300, 0.300)
    sorted_size = sorted((round(size.x, 5), round(size.y, 5), round(size.z, 5)),
                          reverse=True)
    bbox_ok = all(abs(v - 0.300) <= 0.006 for v in sorted_size)

    kids = [o for o in anim.children if o.type == 'MESH']
    kid_names = {o.name for o in kids}

    # --- spin: жёсткий поворот детей, статика заморожена ---
    before = {o.name: (o.matrix_world.translation.copy(),
                       (o.matrix_world @ Vector(o.bound_box[0])).copy())
              for o in meshes}
    base_rot = anim.rotation_euler.copy()
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0.0, 0.0)
    bpy.context.view_layer.update()
    after = {o.name: (o.matrix_world.translation.copy(),
                      (o.matrix_world @ Vector(o.bound_box[0])).copy())
             for o in meshes}

    # радиус от оси должен сохраняться, X — тоже
    rad_err = 0.0
    for name in kid_names:
        p0 = before[name][1]
        p1 = after[name][1]
        r0 = math.hypot(p0.y, p0.z - Z0)
        r1 = math.hypot(p1.y, p1.z - Z0)
        rad_err = max(rad_err, abs(r0 - r1), abs(p0.x - p1.x))
    static_err = max(((after[n][1] - before[n][1]).length
                      for n in before if n not in kid_names), default=0.0)

    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length

    anim.rotation_euler = base_rot
    bpy.context.view_layer.update()
    restored = {o.name: (o.matrix_world @ Vector(o.bound_box[0])).copy()
                for o in meshes}
    restore_err = max((restored[n] - before[n][1]).length for n in before)

    axis_ok = (abs(anim.location.y) < 1e-6
               and abs(anim.location.z - Z0) < 1e-6
               and abs(anim.location.x) < 1e-6)

    # --- статика не должна попадать в зону вращения по X ---
    rot_x0 = min((o.matrix_world @ Vector(c)).x
                 for o in kids for c in o.bound_box)
    rot_x1 = max((o.matrix_world @ Vector(c)).x
                 for o in kids for c in o.bound_box)

    mats = sorted(m.name for m in bpy.data.materials)

    report = {
        'component': CID,
        'code': 'MOT-ROT-04',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_sorted_m': sorted_size,
        'bbox_passport_m': list(passport),
        'bbox_ok': bool(bbox_ok),
        'axis_z': Z0,
        'material_count': len(mats),
        'materials': mats,
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children': sorted(o.name[len(PREFIX):] for o in kids),
        'anim_children_count': len(kids),
        'rotating_x_range': [round(rot_x0, 5), round(rot_x1, 5)],
        'static_parts': sorted(o.name[len(PREFIX):] for o in meshes
                               if o.name not in kid_names),
        'static_count': len([o for o in meshes if o.name not in kid_names]),
        'spin_radius_err_m': round(rad_err, 9),
        'spin_rigid_ok': bool(rad_err < 1e-6),
        'static_frozen_ok': bool(static_err < 1e-9),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_restore_err_m': round(restore_err, 9),
        'pivot_ok': bool(pivot_shift < 1e-6 and restore_err < 1e-9 and axis_ok),
        'motion': {'type': 'spin', 'axis': 'x', 'speed': 1.1},
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
    bg.inputs['Strength'].default_value = 0.38

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=2.4, location=(center.x, center.y,
                                                         mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.52, -0.58, 0.60), 3.20, 0.55),
            ('fill', (-0.66, -0.48, 0.32), 1.00, 0.80),
            ('rim', (0.05, 0.60, 0.48), 1.55, 0.60)):
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
    # крупный план: патрон, кулачки, выходной фланец, метка нуля
    close_t = Vector((0.118, 0.0, Z0 + 0.004))
    c_close = box_corners(Vector((0.052, -0.085, Z0 - 0.080)) - close_t,
                          Vector((0.185, 0.085, Z0 + 0.080)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill, region=None):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                q = mw @ v.co
                if region is not None:
                    lo, hi = region
                    if any(q[i] < lo[i] or q[i] > hi[i] for i in range(3)):
                        continue
                p = world_to_camera_view(scene, cam, q)
                if p.z <= 0.0:
                    continue
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    close_lo = close_t + Vector((-0.075, -0.100, -0.075))
    close_hi = close_t + Vector((0.080, 0.100, 0.080))
    views = [
        ('3q', (0.82, -0.74, 0.44), center + Vector((0, 0, 0.006)), 72, c_main, 0.94, None),
        ('front', (1.00, -0.16, 0.13), center + Vector((0.02, 0, 0.004)), 78, c_main, 0.88, None),
        ('side', (0.10, -1.00, 0.12), center + Vector((0, 0, 0.004)), 72, c_main, 0.94, None),
        ('closeup', (0.62, -0.68, 0.34), close_t, 85, c_close, 0.92,
         (close_lo, close_hi)),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, region in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(8):
            got = max_ndc(fill, region)
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
        print(f'RENDERED {tag} fill={max_ndc(fill, region):.3f} {fp}', flush=True)
    return outs


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000 and rep['static_frozen_ok']
            and rep['spin_rigid_ok']):
        raise SystemExit('checks failed')


main()
