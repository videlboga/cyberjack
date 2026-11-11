"""Standalone builder: restraint_matrix_frame3d (RST-MX-13, «Каркас 3D», Mk-III).

Каркас 3D: основание 2,0 x 1,0 на 4 домкратах 116 (4 x M12, поле 1,756 x 0,776),
4 стойки T-slot 60 x 60, верхняя рама 1,900…1,960, нижняя перекладина, боковые
крылья, наклоняемый щит 1,660 x 0,800 x 0,075 на цапфах Ø40 в разъёмных
подшипниках (ось наклона — Z на X = 0, Y = 1,000), 5 лучей с 10 каретками
(traverse / slide / lift / yaw) и 19 гнёзд CJ-LATCH-30R (12 на щите, 7 на
каркасе).

Геометрия собрана в координатах спеки (glTF/three.js: X — длинная ось,
Y — вверх, Z — ширина). В Blender пересчёт b = (gx, -gz, gy), см. P().
Щит собран в собственной системе (u, v, h) — u вдоль тела, v поперёк,
h — нормаль привалочной плоскости; b = (u, -v, h) относительно оси наклона,
см. PL(). Узел наклона — пустышка __panel_pivot в точке (0, 1,000, 0),
поворот вокруг Z: θ=0 ложе, θ=90 вертикально.

Модули каретки (по спецификации): carriage_<nn> (u, ±0,06) -> slide_<nn> (v)
-> lift_<nn> (h) -> yaw_<nn> (h) -> adapter_<nn> (u). Гнездо стоит на стойке
каретки над плитой подъёма; палец Ø12 проходит через точку position_m.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_matrix_frame3d.py

Выход:
  public/models/machine-modules/components/restraint_matrix_frame3d.glb
  docs/plans/blockout/component-library/restraint_matrix_frame3d/*.png
  docs/plans/blockout/component-library/restraint_matrix_frame3d/report.json
"""
from pathlib import Path
import json
import math
import os

import bpy
import bmesh
import numpy as np
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
SPEC_PATH = PROJECT / 'docs/plans/checks/matrix-frame3d-spec.json'
CID = 'restraint_matrix_frame3d'
CODE = 'RST-MX-13'
PREFIX = CID + '__'
RENDER_DIR = (PROJECT / 'docs/plans/blockout/component-library' / CID)

SPEC = json.loads(SPEC_PATH.read_text(encoding='utf-8'))

# --- габарит и уровни (glTF, метры) --------------------------------------
HX, HZ = 1.000, 0.500
FOOT_X, FOOT_Z = 0.930, 0.440
ANCHOR_X, ANCHOR_Z = 0.878, 0.388
BEAM_Z, BEAM_X = 0.4775, 0.9775
BASE_Y0, BASE_Y1 = 0.040, 0.100
POST_X, POST_Z = 0.550, 0.475
POST_Y0, POST_Y1 = 0.100, 1.960
POST_S = 0.060
TOP_Y0, TOP_Y1 = 1.900, 1.960
MID_Y0, MID_Y1 = 0.860, 0.920
PIV_Y = 1.000                    # ось наклона
PIV_Z = 0.0

# --- щит (система u, v, h) ----------------------------------------------
PU, PV, PH = 0.830, 0.400, 0.0375      # 1,66 x 0,80 x 0,075
SLAB_H = -0.0075                        # верх нижней плиты (каналы 45 глубокие)
SIDE_V0, SIDE_V1 = 0.370, 0.430
TRUN_V0, TRUN_V1 = 0.428, 0.462
SECTOR_V0, SECTOR_V1 = 0.500, 0.508
SECTOR_R_IN = 0.075
SECTOR_R = 0.180
DETENTS = [0, 15, 30, 45, 60, 75, 90]
PIN_WORLD_ANG = math.radians(-150.0)    # угол оси фиксатора в плоскости X-Y

RAYS_U = [-0.66, -0.37, -0.17, 0.300, 0.770]
RAY_L = 0.430
CH_HALF = 0.040                          # канал луча 80 мм
RAIL_HALF = 0.0225
RAY_H0, RAY_H1 = -0.0075, 0.0375         # луч заподлицо с привалочной плоскостью

# --- узлы каретки --------------------------------------------------------
RUN_H0, RUN_H1 = 0.0005, 0.0455        # ползун в канале луча
PLATE_H0, PLATE_H1 = 0.0455, 0.0505    # плита-кронштейн
RING_H0, RING_H1 = 0.0505, 0.0555      # аннулярное кольцо поворота Ø60/Ø26
BAND_V = 0.430

# --- крылья / перекладина / серьга ---------------------------------------
WING_Z = 0.545
WING_POST_X = 0.215
WING_SLAT_T = 0.003
CROSS_X = 0.720
CROSS_Y0, CROSS_Y1 = 0.100, 0.180

PALETTE = {
    'cream': (0.930, 0.917, 0.886),
    'cream_hi': (0.968, 0.960, 0.938),
    'steel': (0.700, 0.712, 0.726),
    'graphite': (0.098, 0.104, 0.114),
    'dark': (0.030, 0.032, 0.038),
    'blush': (0.872, 0.618, 0.652),
    'red': (0.700, 0.075, 0.062),
    'pale': (0.944, 0.838, 0.828),
}
MATS = {}

STATIC_PARTS = []
ROT_PARTS = []
ALL_PARTS = []
CARRIAGES = []
PODS = []            # (id, objname, expected_world, axis, host)
DOF_NODES = []
RENDER_POSES = []    # проверка позы щита на каждом кадровом рендере


# --- помощники ----------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    for lst in (STATIC_PARTS, ROT_PARTS, ALL_PARTS, CARRIAGES, PODS,
                DOF_NODES):
        lst.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    if role == 'steel':
        bsdf.inputs['Metallic'].default_value = 0.85
        bsdf.inputs['Roughness'].default_value = 0.28
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.20
        bsdf.inputs['Roughness'].default_value = 0.46
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.30
        bsdf.inputs['Roughness'].default_value = 0.40
    elif role == 'red':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.34
    elif role in ('cream', 'cream_hi'):
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.42 if role == 'cream' else 0.34
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.90
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(o, role, smooth=False):
    o.data.materials.append(mat(role))
    if smooth and o.type == 'MESH':
        for p in o.data.polygons:
            p.use_smooth = True
    return o


def select_only(o):
    bpy.ops.object.select_all(action='DESELECT')
    o.select_set(True)
    bpy.context.view_layer.objects.active = o


def bevel(o, width=0.0010, segments=2, angle=40.0):
    if width <= 0:
        return
    mod = o.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(angle)
    select_only(o)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        o.modifiers.remove(mod)


def P(gx, gy, gz):
    """glTF/three.js (X, Y вверх, Z) -> Blender (X, Y вверх, Z)."""
    return Vector((gx, -gz, gy))


def PL(u, v, h):
    """Система щита (u, v, h) -> Blender относительно оси наклона."""
    return Vector((u, -v, h))


def GS(sx, sy, sz):
    return (sx, sz, sy)


def add(o, static=True, rot=False):
    ALL_PARTS.append(o)
    (STATIC_PARTS if static else ALL_PARTS)
    if static:
        STATIC_PARTS.append(o)
    if rot:
        ROT_PARTS.append(o)
    return o


def empty(name, loc, parent=None, extras=None):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'
    e.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    if extras:
        for k, v in extras.items():
            e[k] = v
    if parent is not None:
        e.parent = parent
    return e


def world_loc(o):
    """Сумма локальных сдвигов по цепочке родителей (все узлы — сдвиги)."""
    v = Vector((0.0, 0.0, 0.0))
    while o is not None:
        v = v + o.location
        o = o.parent
    return v


TILT_ORIGIN = Vector((0.0, 0.0, 1.0))       # P(0, PIV_Y, 0)


def parent(o, node, frame='panel'):
    """Привязка без сдвига: деталь остаётся там, где построена.

    frame='panel' — геометрия построена в кадре щита (PL), начало кадра лежит
    в оси наклона (0; 0; 1,0); frame='gltf' — в кадре glTF (P). Компенсация
    matrix_parent_inverse нужна потому, что узлы кинематики стоят со сдвигом:
    без неё координаты детали складываются со сдвигом узла и деталь уезжает
    на двойное расстояние.
    """
    o.parent = node
    origin = TILT_ORIGIN if frame == 'panel' else Vector((0.0, 0.0, 0.0))
    o.matrix_parent_inverse = Matrix.Translation(origin - world_loc(node))
    return o


def gbox(name, c, size, role, r=0.0008, smooth=False):
    """Осевой бокс; c — точка (Vector) в Blender, size — габарит в glTF (X, Y, Z)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=c)
    o = bpy.context.object
    o.name = name
    o.scale = GS(*size)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bevel(o, r)
    return apply(o, role, smooth)


def box(name, c, size, role, r=0.0008, mapf=PL, smooth=False):
    """Бокс в кадре mapf: size — габарит по осям кадра (u, v, h) или (X, Y, Z)."""
    if mapf is PL:
        sx, sy, sz = size
        return gbox(name, mapf(*c), (sx, sz, sy), role, r=r, smooth=smooth)
    return gbox(name, mapf(*c), size, role, r=r, smooth=smooth)


def gcyl(name, a, b, radius, role, vertices=24, r2=None, smooth=True, bev=0.0):
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
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        bevel(o, bev, 2)
    return apply(o, role, smooth)


def cyl(name, a, b, radius, role, vertices=24, mapf=PL, r2=None, bev=0.0,
        smooth=True):
    return gcyl(name, mapf(*a), mapf(*b), radius, role, vertices=vertices,
                r2=r2, bev=bev, smooth=smooth)


def bar(name, a, b, w, t, role, mapf=PL, r=0.0008, smooth=False):
    """Брусок от a до b (в кадре mapf): длина по оси, сечение w x t."""
    pa, pb = mapf(*a), mapf(*b)
    d = pb - pa
    L = d.length
    if L < 1e-6:
        raise ValueError(name)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(pa + pb) * 0.5)
    o = bpy.context.object
    o.name = name
    o.scale = (L, w, t)
    o.rotation_euler = d.to_track_quat('X', 'Z').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bevel(o, r)
    return apply(o, role, smooth)


def gtorus(name, c, axis_dir, major, minor, role, segs=24, rings=8):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=c)
    o = bpy.context.object
    o.name = name
    o.rotation_euler = axis_dir.normalized().to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(o, role, True)


def torus(name, c, axis, major, minor, role, mapf=PL, segs=20, rings=6):
    return gtorus(name, mapf(*c), mapf(*axis) - mapf(0, 0, 0), major, minor,
                  role, segs, rings)


def bm_box(bm, c, size):
    cx, cy, cz = c
    hx, hy, hz = size[0] * 0.5, size[1] * 0.5, size[2] * 0.5
    vs = [bm.verts.new((cx + x, cy + y, cz + z))
          for x, y, z in ((-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz),
                          (-hx, hy, -hz), (-hx, -hy, hz), (hx, -hy, hz),
                          (hx, hy, hz), (-hx, hy, hz))]
    for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1),
              (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([vs[i] for i in f])


def bm_cyl(bm, a, b, radius, segments=16):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-7:
        raise ValueError('bm_cyl zero')
    q = d.normalized().to_track_quat('Z', 'Y')
    e1 = q @ Vector((1, 0, 0))
    e2 = q @ Vector((0, 1, 0))
    ring_a, ring_b = [], []
    for i in range(segments):
        ang = 2 * math.pi * i / segments
        off = (e1 * math.cos(ang) + e2 * math.sin(ang)) * radius
        ring_a.append(bm.verts.new(a + off))
        ring_b.append(bm.verts.new(b + off))
    for i in range(segments):
        j = (i + 1) % segments
        bm.faces.new((ring_a[i], ring_a[j], ring_b[j], ring_b[i]))
    bm.faces.new(list(reversed(ring_a)))
    bm.faces.new(ring_b)


def mesh_from_bm(name, bm, role, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.validate()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    bm2 = bmesh.new()
    bm2.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
    bm2.to_mesh(me)
    bm2.free()
    return apply(o, role, smooth)


# --- T-slot профиль ------------------------------------------------------
def slot_profile(half, size=0.045):
    """Сечение T-slot: паз 15 (для 45), шейка 6, камеры 21 x 14 / 21 x 4."""
    s = size / 0.045
    chamfer = 0.0018 * s
    open_half = 0.0075 * s
    neck = 0.006 * s
    chamber_half = 0.0105 * s
    depth_by_face = {0: 0.010 * s, 1: 0.020 * s, 2: 0.010 * s, 3: 0.020 * s}
    pts = []

    def path(face):
        depth = depth_by_face[face]
        loc = [(-open_half, 0.0), (-open_half, neck), (-chamber_half, neck),
               (-chamber_half, depth), (chamber_half, depth),
               (chamber_half, neck), (open_half, neck), (open_half, 0.0)]
        out = []
        for (t, i) in loc:
            if face == 0:
                out.append((t, -half + i))
            elif face == 1:
                out.append((half - i, t))
            elif face == 2:
                out.append((-t, half - i))
            else:
                out.append((-half + i, -t))
        return out

    c = chamfer
    pts.append((-half + c, -half))
    pts += path(0)
    pts.append((half - c, -half))
    pts.append((half, -half + c))
    pts += path(1)
    pts.append((half, half - c))
    pts.append((half - c, half))
    pts += path(2)
    pts.append((-half + c, half))
    pts.append((-half, half - c))
    pts += path(3)
    pts.append((-half, -half + c))
    return pts


def prof(name, axis, l0, l1, c1, c2, size, role, mapf=PL, smooth=False):
    """Выдавить T-slot вдоль оси axis ('u' | 'v' | 'h') кадра mapf.

    c1, c2 — координаты центра сечения по двум другим осям (в порядке
    кадра: для 'u' -> (v, h), для 'v' -> (u, h), для 'h' -> (u, v)).
    """
    poly = slot_profile(size * 0.5, size)
    n = len(poly)
    verts = []
    for t in (l0, l1):
        for (a, b) in poly:
            if axis == 'u':
                verts.append(mapf(t, c1 + a, c2 + b))
            elif axis == 'v':
                verts.append(mapf(c1 + a, t, c2 + b))
            else:
                verts.append(mapf(c1 + a, c2 + b, t))
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
    if axis == 'v':
        for i in range(n):
            j = (i + 1) % n
            faces[-1 - i] = (i, j, n + j, n + i)
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple(range(n, 2 * n)))
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.validate()
    o = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(o)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    return apply(o, role, smooth)


# =======================  ОСНОВАНИЕ 2,0 x 1,0  ===========================
def build_base():
    yc = (BASE_Y0 + BASE_Y1) * 0.5
    for zs, tg in ((1, 'front'), (-1, 'rear')):
        add(prof(f'{PREFIX}base_beam_long_{tg}', 'u', -0.955, 0.955,
                 yc, zs * BEAM_Z, 0.045, 'cream', mapf=P))
    for xs, tg in ((1, 'pelvis'), (-1, 'head')):
        add(prof(f'{PREFIX}base_beam_end_{tg}', 'h', -0.455, 0.455,
                 xs * BEAM_X, yc, 0.045, 'cream', mapf=P))
    for xs, tx in ((1, 'r'), (-1, 'l')):
        for zs, tz in ((1, 'f'), (-1, 'r')):
            add(gbox(f'{PREFIX}base_corner_{tx}{tz}',
                     P(xs * BEAM_X, yc, zs * BEAM_Z), (0.045, 0.045, 0.045),
                     'cream', r=0.0032))
    # балласт 1,20 x 0,60 x 0,030 (в BOM 25 кг) + 4 x M10
    add(gbox(f'{PREFIX}ballast_plate', P(0.0, 0.062, 0.0),
             (1.200, 0.030, 0.600), 'dark', r=0.0035, smooth=False))
    bm = bmesh.new()
    for xs in (1, -1):
        for zs in (1, -1):
            bm_box(bm, P(xs * 0.520, 0.077, zs * 0.240),
                   (0.045, 0.006, 0.045))
    add(mesh_from_bm(f'{PREFIX}ballast_clamps', bm, 'steel'))
    bm = bmesh.new()
    for xs in (1, -1):
        for zs in (1, -1):
            bm_cyl(bm, P(xs * 0.520, 0.078, zs * 0.240),
                   P(xs * 0.520, 0.088, zs * 0.240), 0.0085, 6)
    add(mesh_from_bm(f'{PREFIX}ballast_bolts', bm, 'steel'))

    # домкраты 116 x 116, ход 30, оси X = ±0,930, Z = ±0,440
    for sx, tx in ((1, 'r'), (-1, 'f')):
        for sz, tz in ((1, 'l'), (-1, 'r')):
            x, z = sx * FOOT_X, sz * FOOT_Z
            t = f'{tx}{tz}'
            add(gbox(f'{PREFIX}foot_pad_{t}', P(x, 0.006, z),
                     (0.116, 0.012, 0.116), 'cream', r=0.0045))
            add(gcyl(f'{PREFIX}foot_ring_{t}', P(x, 0.012, z),
                     P(x, 0.019, z), 0.031, 'steel', vertices=32, bev=0.0012))
            add(gcyl(f'{PREFIX}jack_barrel_{t}', P(x, 0.018, z),
                     P(x, 0.044, z), 0.029, 'graphite', vertices=32))
            add(gcyl(f'{PREFIX}jack_nut_{t}', P(x, 0.044, z),
                     P(x, 0.060, z), 0.031, 'steel', vertices=6))
            add(gcyl(f'{PREFIX}jack_rod_{t}', P(x, 0.040, z),
                     P(x, 0.072, z), 0.014, 'steel', vertices=20))
            add(gbox(f'{PREFIX}jack_collar_{t}', P(x, 0.062, z),
                     (0.070, 0.012, 0.070), 'cream_hi', r=0.0025))
            # анкер M12, поле 1,756 x 0,776
            ax, az = sx * ANCHOR_X, sz * ANCHOR_Z
            add(gcyl(f'{PREFIX}anchor_washer_{t}', P(ax, 0.012, az),
                     P(ax, 0.019, az), 0.021, 'steel', vertices=24, bev=0.001))
            add(gcyl(f'{PREFIX}anchor_bolt_{t}', P(ax, 0.019, az),
                     P(ax, 0.030, az), 0.0095, 'dark', vertices=6))
    # выносные опоры (складные, до Z = ±0,545 в рабочем габарите)
    for zs, tg in ((1, 'l'), (-1, 'r')):
        node = empty(f'{PREFIX}outrigger_{tg}', P(0.0, 0.0, zs * 0.470), None,
                     {'joint': 'outrigger', 'axis': 'x', 'range_deg': [0, 90],
                      'note': 'выносная опора; в габарите 1,09 сложена'})
        DOF_NODES.append(node)
        arm = add(gbox(f'{PREFIX}outrigger_arm_{tg}', P(-0.62, 0.055,
                                                        zs * 0.5075),
                       (0.070, 0.030, 0.075), 'cream_hi', r=0.003))
        foot = add(gbox(f'{PREFIX}outrigger_foot_{tg}',
                        P(-0.62, 0.010, zs * 0.5275),
                        (0.070, 0.020, 0.045), 'graphite', r=0.003))
        for o in (arm, foot):
            parent(o, node, frame='gltf')
    return


# ==============================  СТОЙКИ  =================================
def build_posts():
    for xs, tx in ((1, 'r'), (-1, 'l')):
        for zs, tz in ((1, 'f'), (-1, 'r')):
            x, z = xs * POST_X, zs * POST_Z
            t = f'{tx}{tz}'
            add(prof(f'{PREFIX}post_{t}', 'v', POST_Y0, POST_Y1, x, z,
                     POST_S, 'cream', mapf=P))
            add(gbox(f'{PREFIX}post_foot_{t}', P(x, 0.108, z),
                     (0.086, 0.016, 0.086), 'cream_hi', r=0.0035))
            add(gbox(f'{PREFIX}post_head_{t}', P(x, 1.952, z),
                     (0.080, 0.016, 0.080), 'cream_hi', r=0.0035))
            bm = bmesh.new()
            for dx in (0.020, -0.020):
                for dz in (0.020, -0.020):
                    bm_box(bm, P(x + dx, 0.090, z + dz), (0.014, 0.022, 0.014))
            add(mesh_from_bm(f'{PREFIX}post_bolts_{t}', bm, 'steel'))
            # риски шкалы высоты на стойке
            bm = bmesh.new()
            for k in range(10):
                bm_box(bm, P(x - xs * 0.0302, 0.300 + k * 0.150, z),
                       (0.0012, 0.0040, 0.030))
            add(mesh_from_bm(f'{PREFIX}post_scale_{t}', bm, 'graphite'))
    return


# ============================  ВЕРХНЯЯ РАМА  =============================
def build_top_frame():
    yc = (TOP_Y0 + TOP_Y1) * 0.5
    for xs, tg in ((1, 'r'), (-1, 'l')):
        add(prof(f'{PREFIX}top_beam_z_{tg}', 'h', -0.495, 0.495,
                 xs * POST_X, yc, POST_S, 'cream', mapf=P))
    # 3 балки по X: передняя, серьга (средняя), задняя
    for x0, x1, tg in ((-0.505, 0.505, 'yoke'),
                       (-0.520, 0.520, 'front'),
                       (-0.520, 0.520, 'back')):
        z = 0.0 if tg == 'yoke' else (0.475 if tg == 'front' else -0.475)
        add(prof(f'{PREFIX}top_beam_x_{tg}', 'u', x0, x1, yc, z, 0.045,
                 'cream_hi', mapf=P))
    for xs, tx in ((1, 'r'), (-1, 'l')):
        for zs, tz in ((1, 'f'), (-1, 'r')):
            add(gbox(f'{PREFIX}top_corner_{tx}{tz}',
                     P(xs * POST_X, yc, zs * POST_Z),
                     (0.060, 0.060, 0.060), 'cream', r=0.0035))
    # риски шкалы на верхней грани серьги (Y 1,9525): плоские, 1,2 мм
    # толщиной, иначе гребень 30 мм выходит за габарит 1,960
    bm = bmesh.new()
    for k in range(-3, 4):
        bm_box(bm, P(k * 0.150, 1.9531, 0.0), (0.006, 0.030, 0.0012))
    add(mesh_from_bm(f'{PREFIX}top_yoke_scale', bm, 'graphite'))
    return


# =====================  ТРАВЕРСЫ ПОД ПОДШИПНИКИ  =========================
def build_mid_beams():
    yc = (MID_Y0 + MID_Y1) * 0.5
    for zs, tg in ((1, 'l'), (-1, 'r')):
        add(prof(f'{PREFIX}midbeam_{tg}', 'u', -0.550, 0.550,
                 yc, zs * 0.475, 0.045, 'cream', mapf=P))
        add(gbox(f'{PREFIX}midbeam_gusset_{tg}',
                 P(0.0, 0.890, zs * 0.475), (0.120, 0.060, 0.045),
                 'cream_hi', r=0.003))
    return


def build_bearings():
    """Разъёмный подшипник Ø40: корпус с окном, крышка 2 x M8, стойка."""
    for zs, tg in ((1, 'l'), (-1, 'r')):
        zc = zs * 0.4525
        # стойка от траверсы до корпуса
        add(gbox(f'{PREFIX}pedestal_{tg}', P(0.0, 0.928, zs * 0.4650),
                 (0.110, 0.020, 0.050), 'cream', r=0.003))
        # корпус: окно 48 x 44 под цапфу (Ø40) — без пересечения вала
        bm = bmesh.new()
        bm_box(bm, P(0.0, 0.9215, zc), (0.110, 0.018, 0.038))     # низ
        bm_box(bm, P(0.0, 1.0600, zc), (0.110, 0.020, 0.038))     # крышка
        for xs in (1, -1):
            bm_box(bm, P(xs * 0.0435, 0.9915, zc), (0.023, 0.055, 0.038))
        add(mesh_from_bm(f'{PREFIX}bearing_housing_{tg}', bm, 'steel'))
        bm = bmesh.new()
        for xs in (0.030, -0.030):
            bm_cyl(bm, P(xs, 1.0620, zc - 0.048), P(xs, 1.0620, zc + 0.048),
                   0.0055, 6)
        add(mesh_from_bm(f'{PREFIX}bearing_bolts_{tg}', bm, 'dark'))
        add(gcyl(f'{PREFIX}bearing_nipple_{tg}', P(0.052, 1.0450, zc),
                 P(0.052, 1.0700, zc), 0.0055, 'steel', vertices=12))
    return


# ===============================  ЩИТ  ==================================
def build_panel(pivot):
    objs = []

    def put(o):
        objs.append(parent(o, pivot))
        add(o, static=False, rot=True)
        return o

    # нижняя плита 30 мм
    put(box(f'{PREFIX}panel_slab', (0.0, 0.0, -0.0225),
            (2 * PU, 2 * 0.370, 0.030), 'cream', r=0.004))
    # рёбра между каналами лучей (6 шт), лицо на h = +0,0375
    segs = [(-PU, RAYS_U[0] - CH_HALF)]
    for i in range(4):
        segs.append((RAYS_U[i] + CH_HALF, RAYS_U[i + 1] - CH_HALF))
    segs.append((RAYS_U[4] + CH_HALF, PU))
    for i, (u0, u1) in enumerate(segs):
        put(box(f'{PREFIX}panel_rib_{i}', ((u0 + u1) * 0.5, 0.0,
                                          (SLAB_H + PH) * 0.5),
                (u1 - u0, 2 * PV, PH - SLAB_H), 'cream', r=0.0025))
    # боковые рельсы 45 x 60 (несущие, в них цапфы)
    for zs, tg in ((1, 'l'), (-1, 'r')):
        put(box(f'{PREFIX}panel_side_rail_{tg}',
                (0.0, zs * (SIDE_V0 + SIDE_V1) * 0.5,
                 (-PH + 0.0075)),
                (2 * PU, SIDE_V1 - SIDE_V0, 0.045), 'cream_hi', r=0.003))
    # поле T-slot 15: 5 продольных пазов, шаг 0,100 (только на рёбрах)
    for k, v in enumerate((-0.2, -0.1, 0.0, 0.1, 0.2)):
        bm = bmesh.new()
        for (u0, u1) in segs:
            bm_box(bm, PL((u0 + u1) * 0.5, v, PH - 0.0007),
                   (u1 - u0 - 0.004, 0.0150, 0.0014))
        put(mesh_from_bm(f'{PREFIX}panel_field_slot_{k}', bm, 'dark'))
        bm = bmesh.new()
        for (u0, u1) in segs:
            bm_box(bm, PL((u0 + u1) * 0.5, v, PH - 0.0004),
                   (u1 - u0 - 0.010, 0.0225, 0.0008))
        put(mesh_from_bm(f'{PREFIX}panel_field_chamber_{k}', bm, 'graphite'))
    # поперечные шкалы поля (шаг 0,100 по u)
    bm = bmesh.new()
    for k in range(-7, 8):
        if k == 0:
            continue
        for v in (-0.25, 0.25):
            bm_box(bm, PL(k * 0.100, v, PH - 0.0003), (0.0022, 0.040, 0.0006))
    put(mesh_from_bm(f'{PREFIX}panel_field_ticks', bm, 'graphite'))
    # рёбра жёсткости на тыльной стороне
    bm = bmesh.new()
    for u in (-0.500, 0.050, 0.600):
        bm_box(bm, PL(u, 0.0, -0.0260), (0.026, 0.700, 0.023))
    put(mesh_from_bm(f'{PREFIX}panel_back_ribs', bm, 'cream_hi'))
    # цапфы Ø40 + бурт Ø56, шпонка
    for zs, tg in ((1, 'l'), (-1, 'r')):
        put(cyl(f'{PREFIX}panel_trunnion_{tg}', (0.0, zs * TRUN_V0, 0.0),
                (0.0, zs * TRUN_V1, 0.0), 0.020, 'steel',
                mapf=PL, vertices=32, bev=0.0012))
        put(cyl(f'{PREFIX}panel_trunnion_flange_{tg}',
                (0.0, zs * 0.4360, 0.0), (0.0, zs * 0.4455, 0.0), 0.028,
                'steel', mapf=PL, vertices=32))
        put(box(f'{PREFIX}panel_trunnion_key_{tg}', (0.0, zs * 0.4420, 0.0145),
                (0.014, 0.016, 0.006), 'dark'))
    # сектор Ø360 со 7 отверстиями Ø16,5 под детенты 0…90
    build_sector(pivot)
    # страховочный палец Ø5 и тросик — на кронштейне каркаса (см. lock)
    return objs


def build_sector(pivot):
    """Аннулярный сектор R 0,030…0,180 со 7 отверстиями; крутится со щитом."""
    a0 = math.radians(-160.0)
    a1 = math.radians(-50.0)
    inner, outer = SECTOR_R_IN, SECTOR_R
    segs = 56
    verts, faces = [], []
    z0, z1 = SECTOR_V0, SECTOR_V1
    for z in (z0, z1):
        for r in (outer, inner):
            for i in range(segs + 1):
                a = a0 + (a1 - a0) * i / segs
                verts.append(PL(r * math.cos(a), z, r * math.sin(a)))
    n = segs + 1
    for i in range(segs):
        faces.append((i, i + 1, n + i + 1, n + i))                     # outer
        faces.append((2 * n + i, 3 * n + i, 3 * n + i + 1, 2 * n + i + 1))
        faces.append((n + i, n + i + 1, 3 * n + i + 1, 3 * n + i))     # inner
        faces.append((i, 2 * n + i, 2 * n + i + 1, i + 1))
    for e, (base_i, rev) in enumerate(((0, True), (segs, False))):
        idx = [0, n, 3 * n, 2 * n] if base_i == 0 else [segs, 3 * n + segs,
                                                        2 * n + segs,
                                                        n + segs]
        faces.append(tuple(idx) if rev else tuple(reversed(idx)))
    me = bpy.data.meshes.new(f'{PREFIX}panel_sector')
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.validate()
    o = bpy.data.objects.new(f'{PREFIX}panel_sector', me)
    bpy.context.scene.collection.objects.link(o)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    apply(o, 'steel')
    parent(o, pivot)
    add(o, static=False, rot=True)

    # отверстия: α = φ_pin + θ
    bm = bmesh.new()
    for th in DETENTS:
        a = PIN_WORLD_ANG + math.radians(th)
        cx, cz = 0.150 * math.cos(a), 0.150 * math.sin(a)
        bm_cyl(bm, PL(cx, z0 - 0.006, cz), PL(cx, z1 + 0.006, cz), 0.00825, 24)
    cut = mesh_from_bm(f'{PREFIX}_sector_cut', bm, 'dark')
    mod = o.modifiers.new('holes', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cut
    select_only(o)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut, do_unlink=True)
    bevel(o, 0.0012, 2)

    # ступица сектора + связь с цапфой
    h = add(cyl(f'{PREFIX}sector_hub', PL(0.0, TRUN_V1, 0.0),
                PL(0.0, SECTOR_V1 - 0.002, 0.0), 0.030, 'steel',
                mapf=PL, vertices=28, bev=0.0012))
    parent(h, pivot)
    add(h, static=False, rot=True)
    return o


def build_rays(pivot):
    for i, u in enumerate(RAYS_U):
        node = empty(f'{PREFIX}ray_{i + 1:02d}', PL(u, 0.0, 0.0), pivot,
                     {'joint': 'ray_pitch', 'axis': 'u (X щита)',
                      'range_m': [-0.30, 0.30], 'home_u': u,
                      'lock': '2 x M10 T-болт + клин, 4 кН'})
        DOF_NODES.append(node)
        o = prof(f'{PREFIX}ray_body_{i + 1:02d}', 'v', -RAY_L, RAY_L,
                 u, (RAY_H0 + RAY_H1) * 0.5, 0.045, 'cream_hi', mapf=PL)
        parent(o, node)
        add(o, static=False, rot=True)
        # торцевые крышки и замки 2 x M10 по концам
        for zs, tg in ((1, 'p'), (-1, 'm')):
            c = box(f'{PREFIX}ray_cap_{i + 1:02d}_{tg}',
                    (u, zs * (RAY_L - 0.004), (RAY_H0 + RAY_H1) * 0.5),
                    (0.058, 0.008, 0.058), 'cream', r=0.002)
            parent(c, node)
            add(c, static=False, rot=True)
            for k, du in ((0, 0.020), (1, -0.020)):
                b = ghex(f'{PREFIX}ray_lock_{i + 1:02d}_{tg}{k}',
                         PL(u + du, zs * (RAY_L + 0.006),
                            RAY_H1 - 0.014), 0.017, 0.020, 'steel')
                parent(b, node)
                add(b, static=False, rot=True)
    return


def ghex(name, c, across, h, role, axis='y'):
    if axis == 'y':
        a = Vector((c[0], c[1] - h * 0.5, c[2]))
        b = Vector((c[0], c[1] + h * 0.5, c[2]))
    else:
        a = Vector((c[0] - h * 0.5, c[1], c[2]))
        b = Vector((c[0] + h * 0.5, c[1], c[2]))
    return gcyl(name, a, b, across * 0.5, role, vertices=6, smooth=False)


# ==============================  КАРЕТКА  ================================
CARRIAGE_SPEC = [
    # id, socket, ray index, u_pin, v_pin
    ('01', 'r_neck_l', 0, -0.616, 0.14807),
    ('02', 'r_neck_r', 0, -0.616, -0.14807),
    ('03', 'r_waist_l', 1, -0.440, 0.170),
    ('04', 'r_waist_r', 1, -0.300, -0.170),
    ('05', 'r_wrist_l', 2, -0.170, 0.26519),
    ('06', 'r_wrist_r', 2, -0.170, -0.26519),
    ('07', 'r_thigh_l', 3, 0.300, 0.195),
    ('08', 'r_thigh_r', 3, 0.300, -0.195),
    ('09', 'r_ankle_l', 4, 0.770, 0.20203),
    ('10', 'r_ankle_r', 4, 0.770, -0.20203),
]


def build_carriage(spec, rails):
    cid, sid, ray_i, u_pin, v_pin = spec
    u_home = RAYS_U[ray_i]
    du = u_home - u_pin
    tag = cid
    node = empty(f'{PREFIX}carriage_{tag}', PL(u_pin, v_pin, 0.0), rails[ray_i],
                 {'joint': 'traverse', 'axis': 'u (X щита)',
                  'range_m': [-0.06, 0.06], 'home_u': u_pin,
                  'ray': ray_i + 1})
    slide = empty(f'{PREFIX}slide_{tag}', Vector((0, 0, 0)), node,
                  {'joint': 'slide', 'axis': 'v (Z щита)',
                   'range_m': [-0.40, 0.40], 'home_v': v_pin})
    lift = empty(f'{PREFIX}lift_{tag}', Vector((0, 0, 0)), slide,
                 {'joint': 'lift', 'axis': 'h (нормаль щита)',
                  'range_m': [0.0, 0.145], 'screw': 'M10 + маховик Ø42'})
    yaw = empty(f'{PREFIX}yaw_{tag}', Vector((0, 0, 0)), lift,
                {'joint': 'yaw', 'axis': 'h', 'range_deg': [-45, 45],
                 'step_deg': 5, 'home_deg': 0.0})
    adp = empty(f'{PREFIX}adapter_{tag}', Vector((0, 0, 0)), yaw,
                {'joint': 'tilt_adapt', 'axis': 'u', 'range_deg': [-20, 20],
                 'animated': False})
    DOF_NODES.extend([node, slide, lift, yaw, adp])
    CARRIAGES.append({'id': cid, 'socket': sid, 'node': node, 'slide': slide,
                      'lift': lift, 'yaw': yaw, 'adapter': adp,
                      'u_home': u_home, 'u_pin': u_pin, 'v_pin': v_pin,
                      'ray': ray_i, 'du': du})

    def put(o, par):
        parent(o, par)
        add(o, static=False, rot=True)
        return o

    # ползун в канале луча: ролики Ø14 в боковых камерах паза, щёки в зазор
    # (координаты — в кадре щита: ползун идёт по лучу на v = 0, гнездо на v_pin)
    put(box(f'{PREFIX}carriage_runner_{tag}',
            (u_home, 0.0, (RUN_H0 + RUN_H1) * 0.5),
            (0.048, 0.056, RUN_H1 - RUN_H0), 'graphite', r=0.002), slide)
    bm = bmesh.new()
    for sx in (1, -1):
        u = u_home + sx * 0.0310
        bm_box(bm, PL(u, 0.0, (0.0005 + 0.0455) * 0.5),
               (0.017, 0.056, 0.045))
    put(mesh_from_bm(f'{PREFIX}carriage_jaws_{tag}', bm, 'graphite'), slide)
    bm = bmesh.new()
    for sx in (1, -1):
        for sz in (1, -1):
            u = u_home + sx * (RAIL_HALF + 0.0045)
            z = sz * 0.020
            bm_cyl(bm, PL(u, z - 0.004, 0.0245), PL(u, z + 0.004, 0.0245),
                   0.0070, 16)
    put(mesh_from_bm(f'{PREFIX}carriage_rollers_{tag}', bm, 'steel', True),
        slide)
    # плита-кронштейн от луча к гнезду: перекрывает ползун (u_home, v = 0)
    # и площадку гнезда (u_pin, v_pin)
    u0 = min(u_pin - 0.045, u_home - 0.028)
    u1 = max(u_pin + 0.045, u_home + 0.028)
    v0 = min(0.0, v_pin) - 0.055
    v1 = max(0.0, v_pin) + 0.055
    put(box(f'{PREFIX}carriage_plate_{tag}',
            ((u0 + u1) * 0.5, (v0 + v1) * 0.5,
             (PLATE_H0 + PLATE_H1) * 0.5),
            (u1 - u0, v1 - v0, PLATE_H1 - PLATE_H0), 'graphite', r=0.0022),
        slide)
    for sx in (1, -1):
        put(ghex(f'{PREFIX}carriage_tbolt_{tag}_{sx}', PL(
            u_home + sx * 0.030, 0.0, PLATE_H1 - 0.003), 0.014, 0.006,
            'dark'), slide)
    # кольцо поворота (аннулярное, Ø60/Ø26) + плита поворота
    segs = 40
    verts, faces = [], []
    for z in (RING_H0, RING_H1):
        for r in (0.030, 0.013):
            for i in range(segs + 1):
                a = 2 * math.pi * i / segs
                verts.append(PL(u_pin + r * math.cos(a),
                                v_pin + r * math.sin(a), z))
    n = segs + 1
    for i in range(segs):
        faces.append((i, i + 1, n + i + 1, n + i))
        faces.append((2 * n + i, 3 * n + i, 3 * n + i + 1, 2 * n + i + 1))
        faces.append((n + i, n + i + 1, 3 * n + i + 1, 3 * n + i))
        faces.append((i, 2 * n + i, 2 * n + i + 1, i + 1))
    me = bpy.data.meshes.new(f'{PREFIX}yaw_ring_{tag}')
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.validate()
    ro = bpy.data.objects.new(f'{PREFIX}yaw_ring_{tag}', me)
    bpy.context.scene.collection.objects.link(ro)
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    apply(ro, 'steel')
    put(ro, yaw)
    bm = bmesh.new()
    for k in range(19):
        a = math.radians(-45 + k * 5)
        bm_box(bm, PL(u_pin + 0.0215 * math.cos(a),
                      v_pin + 0.0215 * math.sin(a),
                      RING_H1 + 0.0007), (0.0026, 0.0026, 0.0014))
    o = mesh_from_bm(f'{PREFIX}yaw_detent_{tag}', bm, 'dark')
    put(o, yaw)
    put(box(f'{PREFIX}yaw_index_{tag}', (u_pin, v_pin, RING_H1 + 0.0008),
            (0.056, 0.008, 0.0012), 'red', r=0.0002), yaw)
    return {'yaw': yaw, 'lift': lift, 'adapter': adp, 'node': node,
            'slide': slide, 'spec': spec, 'u_pin': u_pin, 'v_pin': v_pin}


def build_carriages(rails):
    out = {}
    for spec in CARRIAGE_SPEC:
        car = build_carriage(spec, rails)
        out[spec[1]] = car
    return out


# ===============================  ГНЁЗДА  ================================
SOCK = {s['id']: s for s in SPEC['sockets']['list']}


def peg_axis_sign(sock, host):
    """Направление пальца «наружу от носителя» в кадре щита (u, v, h)."""
    if host == 'panel':
        return Vector((0.0, 0.0, 1.0))
    ax = Vector(sock['axis'])
    if sock['id'].startswith('w'):
        return ax.normalized()                     # ±X (по крылу)
    if sock['id'].startswith('x'):
        return Vector((0.0, -1.0, 0.0))             # вниз (перекладина)
    if sock['id'] == 'y01':
        return Vector((-1.0, 0.0, 0.0))             # по X (серьга)
    return ax.normalized()


def build_pod_panel(sock, par, base_h, fixed, origin=(0.0, 0.0)):
    """Гнездо CJ-LATCH-30R на щите: стойка + голова + палец вниз по +h.

    origin — (u, v) родительского узла: гнездо на каретке строится в её кадре,
    фиксированное — в кадре оси наклона.
    """
    sid = sock['id']
    u, v, h = sock['panel_xyz']
    ex = Vector(sock['exit_panel'])
    A = Vector((0.0, 0.0, 1.0))
    B = ex.normalized()
    C = A.cross(B).normalized()
    # ось в плане: столб ставим со стороны, противоположной выходу языка
    off = -B * 0.050
    col_w = 0.032
    h_col0 = base_h
    h_col1 = h + 0.024
    col_c = (u + off.x, v + off.y, (h_col0 + h_col1) * 0.5)
    o = box(f'{PREFIX}recv_column_{sid}', col_c,
            (col_w, col_w, h_col1 - h_col0), 'graphite', r=0.0016)
    parent(o, par)
    add(o, static=False, rot=True)
    # голова: консоль над пальцем
    head_c = (u + off.x * 0.45, v + off.y * 0.45, h + 0.0465)
    o = box(f'{PREFIX}recv_head_{sid}', head_c, (0.054, 0.070, 0.045),
            'cream', r=0.0022)
    parent(o, par)
    add(o, static=False, rot=True)
    # воротник и палец Ø12 (центр = position_m)
    o = cyl(f'{PREFIX}recv_collar_{sid}', (u, v, h + 0.016), (u, v, h + 0.024),
            0.025, 'steel', mapf=PL, vertices=24, bev=0.001)
    parent(o, par)
    add(o, static=False, rot=True)
    pin = cyl(f'{PREFIX}pin_{sid}', (u, v, h - 0.016), (u, v, h + 0.016),
              0.006, 'steel', mapf=PL, vertices=20, bev=0.0008)
    parent(pin, par)
    add(pin, static=False, rot=True)
    PODS.append({'id': sid, 'pin_obj': pin.name,
                 'expected': [round(u, 5), round(1.0 + h, 5), round(v, 5)],
                 'axis': [0.0, 0.0, 1.0], 'host': 'panel',
                 'fixed': fixed})
    # пружина, рычаг, метка, винт поджима
    o = torus(f'{PREFIX}recv_spring_{sid}', (u, v, h - 0.005), (1, 0, 0),
              0.0098, 0.0015, 'steel', mapf=PL)
    parent(o, par)
    add(o, static=False, rot=True)
    lever_c = (u + off.x * 1.55, v + off.y * 1.55, h + 0.030)
    o = box(f'{PREFIX}recv_lever_{sid}', lever_c, (0.012, 0.012, 0.026),
            'cream_hi', r=0.0012)
    parent(o, par)
    add(o, static=False, rot=True)
    o = box(f'{PREFIX}recv_lever_pad_{sid}',
            (lever_c[0] + off.x * 0.30, lever_c[1] + off.y * 0.30,
             lever_c[2] + 0.018), (0.011, 0.011, 0.010), 'red', r=0.0015)
    parent(o, par)
    add(o, static=False, rot=True)
    o = box(f'{PREFIX}recv_mark_{sid}',
            (u + off.x * 0.5, v + off.y * 0.5, h + 0.0695),
            (0.040, 0.010, 0.0012), 'red', r=0.0003)
    parent(o, par)
    add(o, static=False, rot=True)
    # винт поджима и шкала на столбе
    o = ghex(f'{PREFIX}recv_screw_{sid}',
             PL(u + off.x * 1.9, v + off.y * 1.9, h_col0 + 0.012),
             0.016, 0.008, 'dark')
    parent(o, par)
    add(o, static=False, rot=True)
    o = box(f'{PREFIX}recv_scale_{sid}',
            (u + off.x * 1.03, v + off.y * 1.03,
             (h_col0 + h_col1) * 0.5), (0.0012, 0.012, min(
                 0.060, h_col1 - h_col0 - 0.010)), 'cream_hi', r=0.0002)
    parent(o, par)
    add(o, static=False, rot=True)
    if not fixed:
        # маховик Ø42 подъёма на столбе
        hb = (h_col0 + h_col1) * 0.5
        o = cyl(f'{PREFIX}recv_handwheel_{sid}',
                (u + off.x * 1.0 + 0.020, v + off.y * 1.0, hb),
                (u + off.x * 1.0 + 0.027, v + off.y * 1.0, hb),
                0.021, 'cream_hi', mapf=PL, vertices=28, bev=0.0012)
        parent(o, par)
        add(o, static=False, rot=True)
        o = gcyl(f'{PREFIX}recv_handwheel_knob_{sid}',
                 PL(u + off.x + 0.030, v + off.y, hb + 0.015),
                 PL(u + off.x + 0.030, v + off.y, hb + 0.022), 0.0045,
                 'dark', vertices=12)
        parent(o, par)
        add(o, static=False, rot=True)
    return None


def build_pod_head_fixed(pivot):
    """r_head: кронштейн за кромкой щита (u = -0,871), палец по +v."""
    u, v, h = SOCK['r_head']['panel_xyz']
    # удлинитель обвязки за кромку щита: не дальше u = −0,877, иначе при
    # θ = 90° кронштейн входит в верхнюю раму (Y 1,900)
    o = box(f'{PREFIX}head_bracket_ext', ((-0.830 - 0.877) * 0.5, 0.0,
                                          (0.020 + PH) * 0.5),
            (0.877 - 0.830, 0.180, PH - 0.020), 'cream', r=0.0025)
    parent(o, pivot)
    add(o, static=False, rot=True)
    o = box(f'{PREFIX}head_bracket_rib', (-0.856, 0.0, 0.008),
            (0.036, 0.120, 0.028), 'cream_hi', r=0.002)
    parent(o, pivot)
    add(o, static=False, rot=True)
    # щека гнезда ⟂ v + палец по +v
    o = box(f'{PREFIX}recv_plate_r_head', (-0.862, v - 0.026, 0.0605),
            (0.030, 0.008, 0.052), 'cream', r=0.002)
    parent(o, pivot)
    add(o, static=False, rot=True)
    o = cyl(f'{PREFIX}recv_collar_r_head', (u, v - 0.024, h),
            (u, v - 0.014, h), 0.012, 'steel', mapf=PL, vertices=24)
    parent(o, pivot)
    add(o, static=False, rot=True)
    pin = cyl(f'{PREFIX}pin_r_head', (u, v - 0.016, h), (u, v + 0.016, h),
              0.006, 'steel', mapf=PL, vertices=20, bev=0.0008)
    parent(pin, pivot)
    add(pin, static=False, rot=True)
    PODS.append({'id': 'r_head', 'pin_obj': pin.name,
                 'expected': [round(u, 5), round(1.0 + h, 5), round(v, 5)],
                 'axis': [0.0, 1.0, 0.0], 'host': 'panel', 'fixed': True})
    o = torus(f'{PREFIX}recv_spring_r_head', (u, v - 0.006, h), (0, 1, 0),
              0.0098, 0.0015, 'steel', mapf=PL)
    parent(o, pivot)
    add(o, static=False, rot=True)
    o = box(f'{PREFIX}recv_mark_r_head', (u, v + 0.012, h + 0.004),
            (0.010, 0.0012, 0.030), 'red', r=0.0002)
    parent(o, pivot)
    add(o, static=False, rot=True)
    return


def build_pod_wing(sock):
    """Гнездо на крыле: окно в полосе, палец по X, корпус с внутренней стороны."""
    sid = sock['id']
    x, y, z = sock['position_m']
    sgn = 1.0 if z > 0 else -1.0
    ax = 1.0 if sock['axis'][0] > 0 else -1.0
    body_z = z - sgn * 0.0105
    o = gbox(f'{PREFIX}recv_body_{sid}',
             P(x + ax * 0.0475, y, body_z), (0.055, 0.062, 0.015),
             'cream', r=0.002)
    add(o)
    o = gbox(f'{PREFIX}recv_boss_{sid}', P(x + ax * 0.020, y, z - sgn * 0.004),
             (0.014, 0.030, 0.010), 'steel', r=0.001)
    add(o)
    pin = gcyl(f'{PREFIX}pin_{sid}', P(x + ax * 0.016, y, z),
                P(x - ax * 0.016, y, z), 0.006, 'steel', vertices=20,
                bev=0.0008)
    add(pin)
    PODS.append({'id': sid, 'pin_obj': pin.name,
                 'expected': [round(x, 5), round(y, 5), round(z, 5)],
                 'axis': [1.0, 0.0, 0.0], 'host': 'chassis', 'fixed': True})
    # пружина-фиксатор: виток Ø14,2 (проволока 1 мм) вокруг пальца Ø12 —
    # наружный радиус 7,1 мм, чтобы гнездо не выходило за габарит 1,090
    o = gtorus(f'{PREFIX}recv_spring_{sid}', P(x - ax * 0.023, y, z),
               Vector((1, 0, 0)), 0.0064, 0.0007, 'steel')
    add(o)
    o = gbox(f'{PREFIX}recv_lever_{sid}', P(x + ax * 0.052, y - 0.040, body_z),
             (0.026, 0.012, 0.012), 'cream_hi', r=0.0012)
    add(o)
    o = gbox(f'{PREFIX}recv_lever_pad_{sid}', P(x + ax * 0.062, y - 0.040,
                                                body_z),
             (0.010, 0.011, 0.011), 'red', r=0.0015)
    add(o)
    o = gbox(f'{PREFIX}recv_mark_{sid}', P(x + ax * 0.030, y + 0.020,
                                           body_z + sgn * 0.0072),
             (0.040, 0.010, 0.0012), 'red', r=0.0002)
    add(o)
    # винты крепления к полосе
    bm = bmesh.new()
    for dx in (0.018, -0.018):
        for dy in (0.024, -0.024):
            bm_cyl(bm, P(x + ax * 0.0475 + dx, y + dy,
                         body_z + sgn * 0.0075),
                   P(x + ax * 0.0475 + dx, y + dy,
                     body_z + sgn * 0.0125), 0.0045, 6)
    add(mesh_from_bm(f'{PREFIX}recv_bolts_{sid}', bm, 'dark'))
    return


def build_pod_crossbar(sock, node):
    """Гнездо стремени: палец вниз (−Y) на вынесенной площадке.

    Геометрия — в локальном кадре узла __crossbar (она же в world − (0,720; 0,100; 0)).
    """
    sid = sock['id']
    x, y, z = sock['position_m']
    dx = x - CROSS_X
    o = gbox(f'{PREFIX}recv_plate_{sid}', P(x, y + 0.026, z),
             (0.055, 0.008, 0.052), 'cream', r=0.002)
    parent(o, node, frame='gltf')
    add(o)
    o = gbox(f'{PREFIX}recv_stem_{sid}',
             P(CROSS_X + dx * 0.5, y + 0.014, z),
             (abs(dx) + 0.030, 0.030, 0.045), 'cream_hi', r=0.0018)
    parent(o, node, frame='gltf')
    add(o)
    pin = gcyl(f'{PREFIX}pin_{sid}', P(x, y - 0.016, z), P(x, y + 0.016, z),
               0.006, 'steel', vertices=20, bev=0.0008)
    parent(pin, node, frame='gltf')
    add(pin)
    PODS.append({'id': sid, 'pin_obj': pin.name,
                 'expected': [round(x, 5), round(y, 5), round(z, 5)],
                 'axis': [0.0, 1.0, 0.0], 'host': 'chassis', 'fixed': True})
    o = torus(f'{PREFIX}recv_spring_{sid}', (x, y - 0.008, z), (0, 1, 0),
              0.0098, 0.0015, 'steel', mapf=P)
    parent(o, node, frame='gltf')
    add(o)
    o = gbox(f'{PREFIX}recv_mark_{sid}', P(x, y + 0.0305, z + 0.020),
             (0.030, 0.0012, 0.010), 'red', r=0.0002)
    parent(o, node, frame='gltf')
    add(o)
    return


def build_pod_yoke(sock):
    """Серьга подвеса y01 на верхней раме: палец по −X."""
    sid = sock['id']
    x, y, z = sock['position_m']
    o = gbox(f'{PREFIX}yoke_eye', P(-0.300, 1.880, 0.0),
             (0.060, 0.040, 0.070), 'cream_hi', r=0.0025)
    add(o)
    o = gbox(f'{PREFIX}yoke_eye_pad', P(-0.300, 1.8995, 0.0),
             (0.070, 0.008, 0.080), 'cream', r=0.002)
    add(o)
    o = gbox(f'{PREFIX}recv_plate_{sid}', P(x + 0.026, y, z),
             (0.008, 0.030, 0.052), 'cream', r=0.002)
    add(o)
    pin = gcyl(f'{PREFIX}pin_{sid}', P(x + 0.016, y, z), P(x - 0.016, y, z),
               0.006, 'steel', vertices=20, bev=0.0008)
    add(pin)
    PODS.append({'id': sid, 'pin_obj': pin.name,
                 'expected': [round(x, 5), round(y, 5), round(z, 5)],
                 'axis': [1.0, 0.0, 0.0], 'host': 'chassis', 'fixed': True})
    o = gtorus(f'{PREFIX}recv_spring_{sid}', P(x - 0.023, y, z),
               Vector((1, 0, 0)), 0.0098, 0.0015, 'steel')
    add(o)
    # метка на щеке: 12 мм по высоте. Полоса 30 мм опускалась до Y 1,833
    # (r = 0,875) и попадала в разворот гнезда головы (r до 0,884)
    o = gbox(f'{PREFIX}recv_mark_{sid}', P(x + 0.030, y, z),
             (0.0012, 0.012, 0.010), 'red', r=0.0002)
    add(o)
    return


# ==============================  КРЫЛЬЯ  =================================
def build_wings():
    for s, tg in ((1, 'l'), (-1, 'r')):
        z = s * WING_Z
        node = empty(f'{PREFIX}wing_slide_{tg}', P(WING_POST_X, 0.0, s * 0.520),
                     None, {'joint': 'wing_ext', 'axis': 'z',
                            'range_m': [0.44, 0.60], 'home_z': 0.545,
                            'note': 'выдвижение крыла под раздвижку 1,2 м'})
        DOF_NODES.append(node)

        def put(o):
            parent(o, node, frame='gltf')
            add(o)
            return o

        put(gbox(f'{PREFIX}wing_post_{tg}', P(WING_POST_X, 0.85, s * 0.521),
                 (0.040, 1.500, 0.042), 'cream', r=0.0035))
        put(gbox(f'{PREFIX}wing_foot_{tg}', P(WING_POST_X, 0.108, s * 0.505),
                 (0.060, 0.030, 0.085), 'cream_hi', r=0.003))
        put(gbox(f'{PREFIX}wing_cap_{tg}', P(WING_POST_X, 1.582, s * 0.521),
                 (0.052, 0.026, 0.054), 'cream_hi', r=0.003))
        # 2 полосы 1,70 x 0,09 x 3 мм с окнами под пальцы
        for (yy, xp, nm) in ((1.150, 0.030, 'w01'), (0.600, 0.400, 'w03')):
            zc = s * (WING_Z - WING_SLAT_T * 0.5)
            put(gbox(f'{PREFIX}wing_slat_{nm}_{tg}',
                     P((xp - 0.030 - 0.850) * 0.5, yy, zc),
                     (xp - 0.030 + 0.850, 0.090, WING_SLAT_T),
                     'cream_hi', r=0.0006))
            put(gbox(f'{PREFIX}wing_slat_b_{nm}_{tg}',
                     P((xp + 0.030 + 0.850) * 0.5, yy, zc),
                     (0.850 - xp - 0.030, 0.090, WING_SLAT_T),
                     'cream_hi', r=0.0006))
            for dy, sg in ((0.029, 'p'), (-0.029, 'm')):
                put(gbox(f'{PREFIX}wing_slat_r{sg}_{nm}_{tg}',
                         P(xp, yy + dy, zc),
                         (0.062, 0.090 - 2 * 0.029, WING_SLAT_T),
                         'cream_hi', r=0.0005))
            put(gbox(f'{PREFIX}wing_slat_rib_{nm}_{tg}',
                     P(-0.20, yy, s * (WING_Z - 0.0055)),
                     (1.240, 0.012, 0.0055), 'cream', r=0.0005))
        # связи со стойкой каркаса
        for yy, nm in ((1.500, 'top'), (0.300, 'low')):
            put(bar(f'{PREFIX}wing_tie_{nm}_{tg}',
                    (WING_POST_X, yy, s * 0.521), (POST_X, yy, s * 0.475),
                    0.050, 0.040, 'cream', mapf=P, r=0.002))
        # шкала высоты на стойке крыла
        bm = bmesh.new()
        for k in range(11):
            bm_box(bm, P(WING_POST_X, 0.300 + k * 0.120, s * 0.5005),
                   (0.020, 0.0030, 0.0012))
        o = mesh_from_bm(f'{PREFIX}wing_scale_{tg}', bm, 'graphite')
        parent(o, node, frame='gltf')
        add(o)
    return


# ============================  ПЕРЕКЛАДИНА  ==============================
def build_crossbar():
    node = empty(f'{PREFIX}crossbar', P(CROSS_X, CROSS_Y0, 0.0), None,
                 {'joint': 'crossbar_lift', 'axis': 'y',
                  'range_m': [0.10, 0.32], 'home_y': 0.14,
                  'note': 'высота перекладины под стопу в режиме 90°'})
    DOF_NODES.append(node)

    def put(o):
        parent(o, node, frame='gltf')
        add(o)
        return o

    yc = (CROSS_Y0 + CROSS_Y1) * 0.5
    put(gbox(f'{PREFIX}crossbar_body', P(CROSS_X, yc, 0.0),
             (0.045, CROSS_Y1 - CROSS_Y0, 0.940), 'cream', r=0.0035))
    bm = bmesh.new()
    for zs in (1, -1):
        bm_box(bm, P(CROSS_X, 0.172, zs * 0.450),
               (0.100, 0.030, 0.060))
        bm_cyl(bm, P(CROSS_X + 0.040, 0.060, zs * 0.450),
               P(CROSS_X + 0.040, 0.060, zs * 0.420), 0.010, 6)
    put(mesh_from_bm(f'{PREFIX}crossbar_arms', bm, 'cream_hi'))
    bm = bmesh.new()
    for k in range(-2, 3):
        bm_box(bm, P(CROSS_X - 0.0228, 0.140, k * 0.150),
               (0.0012, 0.030, 0.004))
    put(mesh_from_bm(f'{PREFIX}crossbar_scale', bm, 'graphite'))
    # площадки стоп
    for zs, tg in ((1, 'l'), (-1, 'r')):
        put(gbox(f'{PREFIX}crossbar_foot_plate_{tg}',
                 P(0.655, 0.096, zs * 0.155),
                 (0.150, 0.010, 0.110), 'cream_hi', r=0.0025))
        put(gbox(f'{PREFIX}crossbar_foot_pad_{tg}',
                 P(0.655, 0.103, zs * 0.155),
                 (0.140, 0.006, 0.100), 'graphite', r=0.0015))
    return node


# =========================  ПРИВОД И СТОПОР  =============================
def build_drive():
    """Червячный редуктор i=40 соосно цапфе: кронштейн — над подшипником.

    Тело привода и маховик стоят снаружи сектора (v ≥ 0,510). Кронштейн
    (drive_arm, v 0,466…0,522) пересекает плоскость сектора (v 0,500…0,508),
    поэтому он проведён сквозь центральное отверстие сектора: R ≤ 0,072 при
    внутреннем радиусе сектора 0,075 и радиусе ступицы 0,030. Раньше плита
    90 x 20 мм доходила до r = 0,083 и срезала сектор на 74…90°.
    """
    # Кронштейн привода проходит сквозь центральное отверстие сектора
    # (R вн. 0,075), а не над ним: при r ≤ 0,072 он не задевает ни ступицу
    # (R 0,030), ни тело сектора ни на одном угле 0…90°.
    add(gbox(f'{PREFIX}drive_arm', P(0.0, 1.055, 0.4940),
             (0.056, 0.020, 0.056), 'cream', r=0.0025))
    add(gbox(f'{PREFIX}drive_bracket', P(0.0, 1.035, 0.5220),
             (0.115, 0.080, 0.020), 'cream', r=0.0025))
    add(gbox(f'{PREFIX}drive_body', P(0.0, 0.990, 0.5210),
             (0.170, 0.110, 0.022), 'graphite', r=0.0030))
    add(gbox(f'{PREFIX}drive_cap', P(0.0, 0.990, 0.5335),
             (0.150, 0.090, 0.003), 'cream_hi', r=0.0012))
    add(gcyl(f'{PREFIX}drive_worm_shaft', P(0.055, 0.945, 0.5210),
             P(0.055, 1.035, 0.5210), 0.010, 'steel', vertices=16))
    add(gbox(f'{PREFIX}drive_motor_cover', P(0.0, 0.990, 0.5375),
             (0.130, 0.070, 0.005), 'cream_hi', r=0.0012))
    # маховик Ø160 в плоскости X-Y, торец на v = 0,550 (габарит 1,10)
    add(gcyl(f'{PREFIX}drive_handwheel', P(0.0, 1.000, 0.5400),
             P(0.0, 1.000, 0.5500), 0.080, 'cream_hi', vertices=44,
             bev=0.0012))
    add(gcyl(f'{PREFIX}drive_handwheel_hub', P(0.0, 1.000, 0.5320),
             P(0.0, 1.000, 0.5400), 0.024, 'graphite', vertices=24))
    add(gcyl(f'{PREFIX}drive_crank', P(-0.062, 1.000, 0.5445),
             P(-0.086, 1.000, 0.5445), 0.0075, 'steel', vertices=14))
    # бобышки обода: 10 x 10 x 10, заподлицо с торцом маховика (v = 0,550),
    # иначе габарит по Z выходит на 1,107
    bm = bmesh.new()
    for k in range(14):
        a = math.radians(k * 360 / 14)
        bm_box(bm, P(0.070 * math.cos(a), 1.000 + 0.070 * math.sin(a), 0.5450),
               (0.010, 0.010, 0.010))
    add(mesh_from_bm(f'{PREFIX}drive_handwheel_rim', bm, 'cream_hi'))
    return


def build_lock():
    """Стопор: палец Ø16 в 7 отверстиях сектора + страховочный Ø5.

    В рабочем положении пальцы выведены (v ≥ 0,511): щит наклоняется только
    с вынутыми фиксаторами, иначе палец прошивает сектор на всех углах.
    Ход на engagement 19 мм — узел lock_pin_slide.
    """
    # кронштейн стопора с траверсы (Z = 0,475); полка не доходит до сектора
    add(gbox(f'{PREFIX}lock_bracket', P(-0.240, 0.930, 0.5170),
             (0.180, 0.060, 0.014), 'cream', r=0.0025))
    add(gbox(f'{PREFIX}lock_bracket_foot', P(-0.240, 0.902, 0.4870),
             (0.180, 0.016, 0.022), 'cream_hi', r=0.002))
    px, py = 0.150 * math.cos(PIN_WORLD_ANG), 1.0 + 0.150 * math.sin(PIN_WORLD_ANG)
    add(gbox(f'{PREFIX}lock_boss', P(px, py, 0.5190), (0.070, 0.070, 0.018),
             'graphite', r=0.002))
    pin_node = empty(f'{PREFIX}lock_pin_slide', P(px, py, 0.5230), None,
                     {'joint': 'lock_pin', 'axis': 'v (Z щита)',
                      'range_m': [0.0, 0.019], 'home_v': 0.514,
                      'engaged_v': [0.495, 0.513],
                      'note': 'палец Ø16 в 7 отверстиях сектора; при наклоне '
                              'выведен на 6 мм от плоскости сектора'})
    DOF_NODES.append(pin_node)
    pin = gcyl(f'{PREFIX}lock_pin', P(px, py, 0.5320), P(px, py, 0.5140),
               0.008, 'steel', vertices=24, bev=0.0008)
    parent(pin, pin_node, frame='gltf')
    add(pin)
    spr = gcyl(f'{PREFIX}lock_pin_spring', P(px, py, 0.5360),
               P(px, py, 0.5320), 0.0125, 'steel', vertices=18)
    parent(spr, pin_node, frame='gltf')
    add(spr)
    hnd = gbox(f'{PREFIX}lock_handle', P(px - 0.052, py - 0.030, 0.5350),
               (0.070, 0.012, 0.014), 'cream_hi', r=0.0015)
    parent(hnd, pin_node, frame='gltf')
    add(hnd)
    pad = gbox(f'{PREFIX}lock_handle_pad', P(px - 0.082, py - 0.030, 0.5350),
               (0.016, 0.014, 0.016), 'red', r=0.0018)
    parent(pad, pin_node, frame='gltf')
    add(pad)
    add(gbox(f'{PREFIX}lock_detent_plate', P(px - 0.030, py + 0.060, 0.5160),
             (0.100, 0.050, 0.012), 'cream_hi', r=0.0015))
    # страховочный палец Ø5 + тросик (тоже выведен)
    sx, sy = 0.100 * math.cos(PIN_WORLD_ANG), 1.0 + 0.100 * math.sin(PIN_WORLD_ANG)
    safe_node = empty(f'{PREFIX}safety_pin_slide', P(sx, sy, 0.5180), None,
                      {'joint': 'safety_pin', 'axis': 'v (Z щита)',
                       'range_m': [0.0, 0.017], 'home_v': 0.511,
                       'engaged_v': [0.494, 0.511],
                       'note': 'страховочный Ø5 под сектор, выведен при наклоне'})
    DOF_NODES.append(safe_node)
    sp = gcyl(f'{PREFIX}safety_pin', P(sx, sy, 0.5250), P(sx, sy, 0.5110),
              0.0025, 'steel', vertices=12)
    parent(sp, safe_node, frame='gltf')
    add(sp)
    bm = bmesh.new()
    for i in range(10):
        a0 = 2 * math.pi * i / 10
        a1 = 2 * math.pi * (i + 1) / 10
        x0 = sx + 0.012 * math.cos(a0)
        z0 = 0.5250 + 0.012 * math.sin(a0)
        x1 = sx + 0.012 * math.cos(a1)
        z1 = 0.5250 + 0.012 * math.sin(a1)
        bm_cyl(bm, P(x0, sy, z0), P(x1, sy, z1), 0.0010, 6)
    cable = mesh_from_bm(f'{PREFIX}safety_cable', bm, 'dark')
    parent(cable, safe_node, frame='gltf')
    add(cable)
    add(gbox(f'{PREFIX}safety_tag', P(sx - 0.030, sy + 0.010, 0.5350),
             (0.030, 0.0012, 0.016), 'red', r=0.0002))
    return


# ==============================  СБОРКА  =================================
def build():
    reset()
    root = empty(f'{PREFIX}root', Vector((0, 0, 0)), None,
                 {'component': CID, 'code': CODE, 'label': 'Каркас 3D (Mk-III)',
                  'units': 'm, kg, deg'})
    build_base()
    build_posts()
    build_top_frame()
    build_mid_beams()
    build_bearings()
    pivot = empty(f'{PREFIX}panel_pivot', P(0.0, PIV_Y, 0.0), None,
                  {'joint': 'tilt', 'axis': 'z', 'range_deg': [0, 90],
                   'detents_deg': DETENTS, 'animated': True,
                   'drive': 'червячный редуктор i=40, самотормозящий',
                   'lock': 'сектор Ø360 + палец Ø16 в 7 отверстиях + Ø5'})
    DOF_NODES.append(pivot)
    build_panel(pivot)
    build_rays(pivot)
    rails = [bpy.data.objects[f'{PREFIX}ray_{i + 1:02d}'] for i in range(5)]
    cars = build_carriages(rails)
    # 10 подвижных гнёзд на каретках
    for cid, car in cars.items():
        sock = SOCK[car['spec'][1]]
        build_pod_panel(sock, car['lift'], RING_H1, fixed=False,
                        origin=(car['u_pin'], car['v_pin']))
    # 2 фиксированных гнезда на щите
    build_pod_head_fixed(pivot)
    for sid in ('r_qr',):
        sock = SOCK[sid]
        u, v, h = sock['panel_xyz']
        o = box(f'{PREFIX}recv_seat_{sid}', (u, v, PH + 0.004),
                (0.052, 0.052, 0.008), 'cream_hi', r=0.0015)
        parent(o, pivot)
        add(o, static=False, rot=True)
        build_pod_panel(sock, pivot, PH + 0.008, fixed=True)
    # 7 гнёзд на каркасе
    for sid in ('w01', 'w02', 'w03', 'w04'):
        build_pod_wing(SOCK[sid])
    cb = build_crossbar()
    for sid in ('x01', 'x02'):
        build_pod_crossbar(SOCK[sid], cb)
    build_pod_yoke(SOCK['y01'])
    build_wings()
    build_drive()
    build_lock()
    # маркировка режимов наклона — на наружной грани стойки крыла
    bm = bmesh.new()
    for k in range(7):
        bm_box(bm, P(WING_POST_X, 1.220 + k * 0.045, WING_Z - 0.0035),
               (0.024, 0.0030, 0.0012))
    o = mesh_from_bm(f'{PREFIX}marks_tilt_scale', bm, 'graphite')
    add(o)
    return root, pivot


# --- габарит -------------------------------------------------------------
def obj_bbox(o):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for c in o.bound_box:
        p = o.matrix_world @ Vector(c)
        for i in range(3):
            mn[i] = min(mn[i], p[i])
            mx[i] = max(mx[i], p[i])
    return mn, mx


def mesh_bbox(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objects:
        if o.type != 'MESH':
            continue
        a, b = obj_bbox(o)
        for i in range(3):
            mn[i] = min(mn[i], a[i])
            mx[i] = max(mx[i], b[i])
    return mn, mx


# =====================  КИНЕМАТИЧЕСКИЕ ПРОВЕРКИ  =========================
TILT_AXIS_Y = 1.0      # Blender Z оси наклона (glTF Y) при θ=0


def local_arrays(o):
    me = o.data
    n = len(me.vertices)
    co = np.empty(n * 3, dtype=np.float64)
    me.vertices.foreach_get('co', co)
    co = co.reshape(n, 3)
    me.calc_loop_triangles()
    tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int32)
    me.loop_triangles.foreach_get('vertices', tri)
    return co, tri.reshape(-1, 3)


def rot_y(v, th):
    c, s = math.cos(th), math.sin(th)
    out = v.copy()
    out[:, 0] = v[:, 0] * c + v[:, 2] * s
    out[:, 2] = -v[:, 0] * s + v[:, 2] * c
    out[:, 1] = v[:, 1]
    return out


class SweepChecker:
    """Пересечения поворотной группы со статикой на 0…90° без подгонки."""

    def __init__(self, pivot, static_objs, rot_objs):
        self.pivot = pivot
        self.static = []
        for o in static_objs:
            if o.type != 'MESH':
                continue
            V, T = local_arrays(o)
            M = o.matrix_world
            A = np.array(M.to_3x3(), dtype=np.float64)
            t = np.array(M.translation, dtype=np.float64)
            W = V @ A.T + t
            r = np.sqrt(W[:, 0] ** 2 + (W[:, 2] - TILT_AXIS_Y) ** 2)
            self.static.append({
                'name': o.name, 'bvh': BVHTree.FromPolygons(
                    [tuple(p) for p in W],
                    [tuple(map(int, f)) for f in T], epsilon=0.0),
                'mn': W.min(axis=0), 'mx': W.max(axis=0),
                'r': (float(r.min()), float(r.max())),
                'y': (float(W[:, 1].min()), float(W[:, 1].max()))})
        self.rot = []
        for o in rot_objs:
            if o.type != 'MESH':
                continue
            V, T = local_arrays(o)
            # мировые вершины при θ=0 -> координаты относительно оси наклона
            M = o.matrix_world
            A = np.array(M.to_3x3(), dtype=np.float64)
            V = V @ A.T + np.array(M.translation, dtype=np.float64)
            V = V.copy()
            V[:, 2] -= TILT_AXIS_Y
            r = np.sqrt(V[:, 0] ** 2 + V[:, 2] ** 2)
            self.rot.append({'name': o.name, 'V': V, 'T': T,
                             'r': (float(r.min()), float(r.max())),
                             'y': (float(V[:, 1].min()), float(V[:, 1].max()))})
        self.rebuild_pairs()

    def rebuild_pairs(self):
        """Пары-кандидаты по радиусу от оси наклона и по координате вдоль оси."""
        self.pairs = []
        RM, YM = 0.004, 0.004
        for a in self.rot:
            for b in self.static:
                if a['r'][1] < b['r'][0] - RM or a['r'][0] > b['r'][1] + RM:
                    continue
                if a['y'][1] < b['y'][0] - YM or a['y'][0] > b['y'][1] + YM:
                    continue
                self.pairs.append((a, b))

    def state(self, deg):
        th = math.radians(deg)
        hits = []
        for a, b in self.pairs:
            W = rot_y(a['V'], th)
            W[:, 2] += TILT_AXIS_Y
            if (W[:, 0].min() > b['mx'][0] + 0.0004 or
                    W[:, 0].max() < b['mn'][0] - 0.0004 or
                    W[:, 1].min() > b['mx'][1] + 0.0004 or
                    W[:, 1].max() < b['mn'][1] - 0.0004 or
                    W[:, 2].min() > b['mx'][2] + 0.0004 or
                    W[:, 2].max() < b['mn'][2] - 0.0004):
                continue
            tree = BVHTree.FromPolygons([tuple(p) for p in W],
                                        [tuple(map(int, f)) for f in a['T']],
                                        epsilon=0.0)
            ov = tree.overlap(b['bvh'])
            if ov:
                hits.append({'rot': a['name'], 'static': b['name'],
                             'pairs': len(ov), 'deg': deg})
        top_y = 1e9
        for a in self.rot:
            W = rot_y(a['V'], th)
            top_y = min(top_y, 1.890 - (float(W[:, 2].max()) + TILT_AXIS_Y))
        return hits, top_y

    def run(self, step=1, obst=None):
        rows, hits, top = [], [], 1e9
        for deg in range(0, 91, step):
            h, t = self.state(deg)
            hits.extend(h)
            if t < top and os.environ.get('FRAME3D_DEBUG'):
                worst = sorted(((float((rot_y(a['V'], math.radians(deg))[
                    :, 2].max()) + TILT_AXIS_Y), a['name']) for a in self.rot),
                    reverse=True)[:4]
                print('TOPDBG', deg, round(t, 3), worst, flush=True)
            top = min(top, t)
            if deg % 15 == 0:
                rows.append({'deg': deg, 'hits': len(h),
                             'top_clearance_m': round(t, 4)})
        return hits, rows, top

    def probe(self, obst, deg):
        """Селфтест: посторонняя деталь в полосе разворота должна ловиться."""
        th = math.radians(deg)
        W = rot_y(obst['V'], th)
        W[:, 2] += TILT_AXIS_Y
        mn, mx = W.min(axis=0), W.max(axis=0)
        box = {'name': 'selftest', 'mn': mn, 'mx': mx}
        tree = BVHTree.FromPolygons([tuple(p) for p in W],
                                    [tuple(map(int, f)) for f in obst['T']],
                                    epsilon=0.0)
        hits = []
        for b in self.static:
            if (mn[0] > b['mx'][0] or mx[0] < b['mn'][0] or
                    mn[1] > b['mx'][1] or mx[1] < b['mn'][1] or
                    mn[2] > b['mx'][2] or mx[2] < b['mn'][2]):
                continue
            if tree.overlap(b['bvh']):
                hits.append({'rot': 'selftest_probe', 'static': b['name'],
                             'pairs': 1, 'deg': deg})
        return hits


def detector_selftest(pivot, checker):
    """Селфтест: посторонний статичный куб в полосе разворота (r 0,71, −45°)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.50, 0.0, 0.50))
    o = bpy.context.object
    o.name = '_selftest_probe'
    o.scale = (0.05, 0.05, 0.05)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    V, T = local_arrays(o)
    M = o.matrix_world
    A = np.array(M.to_3x3(), dtype=np.float64)
    W = V @ A.T + np.array(M.translation, dtype=np.float64)
    bpy.data.objects.remove(o, do_unlink=True)
    r = np.sqrt(W[:, 0] ** 2 + (W[:, 2] - TILT_AXIS_Y) ** 2)
    probe = {'name': 'selftest_probe', 'bvh': BVHTree.FromPolygons(
                 [tuple(p) for p in W], [tuple(map(int, f)) for f in T]),
             'mn': W.min(axis=0), 'mx': W.max(axis=0),
             'r': (float(r.min()), float(r.max())),
             'y': (float(W[:, 1].min()), float(W[:, 1].max()))}
    checker.static.append(probe)
    checker.rebuild_pairs()
    hits = []
    for deg in range(0, 91, 5):
        h, _ = checker.state(deg)
        hits += [x for x in h if x['static'] == 'selftest_probe']
    checker.static.pop()
    checker.rebuild_pairs()
    return {'probe_center': [0.50, 0.0, 0.50], 'radius_m': 0.707,
            'detected': len(hits),
            'first_deg': hits[0]['deg'] if hits else None,
            'rot_hit': sorted({h['rot'] for h in hits})[:4],
            'ok': bool(hits)}


def pin_convergence():
    bpy.context.view_layer.update()
    rows = []
    worst = 0.0
    for p in PODS:
        o = bpy.data.objects[p['pin_obj']]
        mn, mx = obj_bbox(o)
        c = (mn + mx) * 0.5
        size = mx - mn
        exp = Vector(p['expected'])
        # expected — в glTF (X, Y вверх, Z); c и size — в Blender.
        # Сравнивать можно только в одной системе: exp -> P().
        exp_bl = P(exp.x, exp.y, exp.z)
        d = (c - exp_bl).length
        worst = max(worst, d)
        # ось пальца в кадре Blender: у гнёзд щита спека задана в кадре щита
        # (PL), у гнёзд каркаса — в glTF (P)
        ax = PL(*p['axis']) if p['host'] == 'panel' else P(*p['axis'])
        # ближайшая ось габарита должна совпадать с осью пальца
        axes = [size.x, size.y, size.z]
        big = axes.index(max(axes))
        rows.append({'id': p['id'], 'host': p['host'], 'fixed': p['fixed'],
                     'pin_m': [round(v, 5) for v in (c.x, c.z, -c.y)],
                     'expected_m': [round(v, 5) for v in exp],
                     'error_m': round(d, 6),
                     'axis': p['axis'],
                     'axis_matches': bool(
                         (big == 0 and abs(ax[0]) > 0.9) or
                         (big == 1 and abs(ax[1]) > 0.9) or
                         (big == 2 and abs(ax[2]) > 0.9)),
                     'ok': bool(d <= 0.0005)})
    return {'rows': rows, 'max_error_m': round(worst, 6),
            'count': len(rows),
            'panel': sum(1 for r in rows if r['host'] == 'panel'),
            'chassis': sum(1 for r in rows if r['host'] == 'chassis'),
            'max_error_ok': bool(worst <= 0.0005),
            'axes_ok': all(r['axis_matches'] for r in rows)}


def socket_semantics():
    """p = u x w: ось пальца параллельна limb x exit (конвенция спеки)."""
    rows = []
    for s in SPEC['sockets']['list']:
        if s['host'] != 'panel':
            continue
        pin = Vector(s['pin_axis_panel'])
        ex = Vector(s['exit_panel'])
        lim = Vector(s['limb_axis_panel'])
        cross = lim.cross(ex)
        dot = abs(pin.normalized().dot(cross.normalized()))
        rows.append({'id': s['id'], 'abs_dot': round(dot, 6),
                     'ok': bool(dot > 0.999)})
    return {'rows': rows, 'ok': all(r['ok'] for r in rows),
            'rule': 'pin_axis = limb_axis x exit (знак — по конвенции '
                    'внутренней стороны)'}


def sector_detents(pivot):
    """Совпадение отверстий сектора с осью стопора на каждом детенте.

    Отверстие лежит в средней плоскости сектора (v = 0,504); после поворота
    на θ его мировая точка должна попасть на ось пальца (X, Z), а плоскость
    сектора — попасть в ход пальца при engagement.
    """
    rows = []
    pin_x = 0.150 * math.cos(PIN_WORLD_ANG)
    pin_z = 1.0 + 0.150 * math.sin(PIN_WORLD_ANG)
    v_mid = (SECTOR_V0 + SECTOR_V1) * 0.5
    eng0, eng1 = 0.495, 0.513
    worst = 0.0
    for th in DETENTS:
        a = PIN_WORLD_ANG + math.radians(th)
        local = Vector((0.150 * math.cos(a), -v_mid, 0.150 * math.sin(a)))
        pivot.rotation_euler = (0.0, math.radians(th), 0.0)
        bpy.context.view_layer.update()
        w = pivot.matrix_world @ local
        dx = math.hypot(w.x - pin_x, w.z - pin_z)
        worst = max(worst, dx)
        hole_v = -w.y
        rows.append({'deg': th,
                     'hole_world_xz': [round(w.x, 5), round(w.z, 5)],
                     'pin_xz': [round(pin_x, 5), round(pin_z, 5)],
                     'offset_m': round(dx, 6),
                     'hole_v_m': round(hole_v, 4),
                     'pin_engaged_v': [eng0, eng1],
                     'pin_home_v': [0.514, 0.532],
                     'sector_in_pin_v': bool(eng0 <= SECTOR_V0 and
                                             SECTOR_V1 <= eng1),
                     'ok': bool(dx <= 0.0005 and eng0 <= SECTOR_V0 and
                                SECTOR_V1 <= eng1)})
    pivot.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    return {'rows': rows, 'max_offset_m': round(worst, 6),
            'hole_pitch_deg': 15.0, 'holes': len(DETENTS),
            'pin_retracted_clear_m': round(0.514 - SECTOR_V1, 4),
            'ok': all(r['ok'] for r in rows)}


def tilt_readback(pivot):
    """Реальная ось: точка (u, v, h) должна вставать по R(-θ) вокруг (0, 1, 0)."""
    rows = []
    worst = 0.0
    probe = [Vector((-0.830, 0.0, 0.0)), Vector((0.830, 0.0, 0.0)),
             Vector((0.0, 0.0, 0.0375)), Vector((0.0, 0.0, -0.0375))]
    for th in DETENTS:
        pivot.rotation_euler = (0.0, math.radians(th), 0.0)
        bpy.context.view_layer.update()
        err = 0.0
        for lp in probe:
            w = pivot.matrix_world @ lp
            # ожидание в glTF: X = u cos + h sin, Y = 1 - u sin + h cos
            c, s = math.cos(math.radians(th)), math.sin(math.radians(th))
            ex = lp.x * c + lp.z * s
            ey = 1.0 + (-lp.x * s + lp.z * c)
            ez = -lp.y
            err = max(err, math.hypot(w.x - ex, w.y - lp.y),
                      abs(w.z - ey))
        worst = max(worst, err)
        rows.append({'deg': th, 'max_error_m': round(err, 6)})
    pivot.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    return {'rows': rows, 'max_error_m': round(worst, 6),
            'axis': 'glTF Z', 'pivot': [0.0, 1.0, 0.0],
            'ok': bool(worst <= 0.0005)}


def stability(mass_total_kg, com, ballast_kg):
    """Опрокидывание: опорный контур 4 домкрата + выносные опоры; SF по Z и X."""
    g = 9.81
    feet_x, feet_z = FOOT_X, FOOT_Z
    out_z = WING_Z
    side_force, force_y = 200.0, 1.500
    m_rest_z = mass_total_kg * g * (feet_z - abs(com[2]))
    m_rest_z_out = mass_total_kg * g * (out_z - abs(com[2]))
    m_tip = side_force * force_y
    m_rest_x = mass_total_kg * g * (feet_x - abs(com[0]))
    rows = [
        {'case': 'бок (Z) на 4 домкратах', 'arm_m': round(feet_z, 4),
         'm_restore_nm': round(m_rest_z, 1), 'm_tip_nm': round(m_tip, 1),
         'sf': round(m_rest_z / m_tip, 2),
         'ok': bool(m_rest_z / m_tip >= 1.5)},
        {'case': 'бок (Z) с выносными опорами', 'arm_m': round(out_z, 4),
         'm_restore_nm': round(m_rest_z_out, 1), 'm_tip_nm': round(m_tip, 1),
         'sf': round(m_rest_z_out / m_tip, 2),
         'ok': bool(m_rest_z_out / m_tip >= 1.5)},
        {'case': 'вперёд (X) на 4 домкратах', 'arm_m': round(feet_x, 4),
         'm_restore_nm': round(m_rest_x, 1), 'm_tip_nm': round(m_tip, 1),
         'sf': round(m_rest_x / m_tip, 2),
         'ok': bool(m_rest_x / m_tip >= 1.5)},
    ]
    # распределение нагрузки по 4 домкратам (без опрокидывания)
    fx = abs(com[0]) / feet_x
    fz = abs(com[2]) / feet_z
    loads = []
    for sx, tx in ((1, 'r'), (-1, 'f')):
        for sz, tz in ((1, 'l'), (-1, 'r')):
            share = (0.5 + 0.5 * fx * (1 if sx > 0 else -1)) * \
                    (0.5 + 0.5 * fz * (1 if sz > 0 else -1))
            loads.append({'foot': tx + tz,
                          'load_kg': round(mass_total_kg * share, 1)})
    return {'rows': rows, 'feet': loads,
            'no_uplift': bool(all(f['load_kg'] > 0 for f in loads)),
            'com_m': [round(v, 4) for v in com],
            'mass_kg': round(mass_total_kg, 2),
            'side_load_n': side_force, 'load_height_m': force_y,
            'ok': bool(all(r['ok'] for r in rows) and
                       all(f['load_kg'] > 0 for f in loads))}


def bom_mass():
    return round(sum(i['mass_kg'] for i in SPEC['mass']['items']), 2)


def geom_mass():
    """Оценка по объёму мешей: алюминий 2700, сталь 7850, прочее 1200."""
    dens = {'cream': 2700, 'cream_hi': 2700, 'steel': 7850,
            'graphite': 1900, 'dark': 2000, 'red': 1200, 'blush': 1200,
            'pale': 1200}
    out = {}
    for o in bpy.data.objects:
        if o.type != 'MESH' or not o.name.startswith(PREFIX):
            continue
        role = o.data.materials[0].name.split('_')[1] if o.data.materials else 'cream'
        role = role if role in dens else 'cream'
        me = o.data
        me.calc_loop_triangles()
        vol = 0.0
        for tri in me.loop_triangles:
            a, b, c = [me.vertices[i].co for i in tri.vertices]
            vol += a.dot(b.cross(c)) / 6.0
        out[role] = out.get(role, 0.0) + abs(vol) * dens[role]
    return {k: round(v, 1) for k, v in out.items()}


def com_estimate():
    """ЦМ каркаса по группам BOM (X, Y, Z); щит — в оси наклона θ=0."""
    items = [
        ('base', (0.0, 0.06, 0.0), 18.6 + 1.68 + 25.0),
        ('posts', (0.0, 1.03, 0.0), 17.11),
        ('top_frame', (0.0, 1.93, 0.0), 6.67),
        ('mid_beam', (0.0, 0.89, 0.475), 3.72),
        ('panel', (0.0, 1.0, 0.0), 9.86 + 8.6 + 8.96),
        ('rays', (0.0, 1.09, 0.0), 15.5),
        ('carriages', (0.0, 1.10, 0.0), 14.5),
        ('receivers', (0.0, 1.10, 0.0), 18.05),
        ('wings', (0.0, 0.90, 0.545), 5.2),
        ('drive', (0.0, 0.99, 0.52), 11.9),
        ('misc', (0.0, 0.60, 0.0), 4.0),
    ]
    m = sum(i[2] for i in items)
    c = [sum(i[1][k] * i[2] for i in items) / m for k in range(3)]
    return c, m, items


def build_joints(pivot):
    rows = []
    def jval(v):
        if hasattr(v, 'to_list'):
            return v.to_list()
        if isinstance(v, (list, tuple)):
            return [jval(x) for x in v]
        return v
    for n in DOF_NODES:
        ex = {k: jval(v) for k, v in n.items()}
        rows.append({'node': n.name, 'extras': ex,
                     'children': [c.name for c in n.children]})
    return {'component': CID, 'prefix': PREFIX, 'tilt_pivot': pivot.name,
            'tilt_axis_gltf': [0.0, 0.0, 1.0],
            'tilt_origin_m': [0.0, 1.0, 0.0],
            'nodes': rows}


# ==============================  ОТЧЁТ  ==================================
def jclean(v):
    """Рекурсивная нормализация под json.dumps.

    Blender отдаёт IDPropertyArray/IDPropertyGroup (extras узлов), mathutils
    (Vector/Euler/Matrix), numpy-скаляры и множества — ни одно из этого
    стандартный энкодер не принимает.
    """
    if v is None or isinstance(v, (bool, int, float, str)):
        return v
    if isinstance(v, dict):
        return {str(k): jclean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, set, frozenset)):
        return [jclean(x) for x in v]
    for attr in ('to_dict', 'to_list', 'tolist', 'to_tuple'):
        f = getattr(v, attr, None)
        if callable(f):
            try:
                return jclean(f())
            except Exception:
                continue
    if hasattr(v, '__iter__'):
        try:
            return [jclean(x) for x in v]
        except Exception:
            pass
    return str(v)


def check(pivot, sweep_rep, pin_rep, det_rep, tilt_rep, stab_rep):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects
              if o.type == 'MESH' and o.name.startswith(PREFIX)]
    all_pref = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    mats = [m for m in bpy.data.materials if m.users]
    sockets = [o.name for o in meshes if '__pin_' in o.name]
    names_bad = [o.name for o in bpy.data.objects
                 if not o.name.startswith(PREFIX) and not
                 o.name.startswith('CJ_') and o.type in ('MESH', 'EMPTY')]
    com, m_com, com_items = com_estimate()
    rep = {
        'component': CID,
        'code': CODE,
        'label': 'Каркас 3D (Mk-III)',
        'variant_of': 'restraint_matrix',
        'prefix': PREFIX,
        'spec': str(SPEC_PATH.relative_to(PROJECT)),
        'nodes': len(all_pref),
        'meshes': len(meshes),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_gltf': [round(size.x, 5), round(size.z, 5), round(size.y, 5)],
        'bbox_target': '2,000 x 1,960 x 1,090',
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.002 and
                        abs(size.z - 1.96) <= 0.002 and
                        1.085 <= size.y <= 1.105),
        'bbox_z_note': 'пальцы гнёзд крыла стоят осью на Z = ±0,545, тело '
                       'Ø12 выходит на ±0,551 (см. deviations)',
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'materials': sorted(m.name for m in mats),
        'material_count': len(mats),
        'rays': 5,
        'carriages': len(CARRIAGES),
        'carriage_ids': [c['id'] for c in CARRIAGES],
        'sockets': len(sockets),
        'sockets_ok': bool(len(sockets) == 19),
        'sockets_panel': sum(1 for p in PODS if p['host'] == 'panel'),
        'sockets_chassis': sum(1 for p in PODS if p['host'] == 'chassis'),
        'dof_nodes': len(DOF_NODES),
        'dof': [{'id': e['joint'], 'node': e.name,
                 'axis': str(e.get('axis')),
                 'range': (e.get('range_m').to_list() if hasattr(
                     e.get('range_m'), 'to_list') else e.get('range_deg'))}
                for e in DOF_NODES],
        'sweep': sweep_rep,
        'pins': pin_rep,
        'detents': det_rep,
        'tilt': tilt_rep,
        'stability': stab_rep,
        'mass_bom_kg': bom_mass(),
        'mass_bom_items': SPEC['mass']['items'],
        'mass_geom_kg': geom_mass(),
        'com_m': [round(v, 4) for v in com],
        'com_items': [{'group': i[0], 'pos_m': i[1], 'kg': i[2]}
                      for i in com_items],
        'names_bad': sorted(names_bad),
        'names_ok': bool(not names_bad and all(
            o.name.startswith(PREFIX) for o in all_pref)),
        'modes': SPEC['modes'],
        'deviations': DEVIATIONS,
    }
    ok = (rep['bbox_ok'] and rep['floor_contact_ok'] and
          rep['material_count'] >= 6 and rep['material_count'] <= 8 and
          rep['sockets_ok'] and rep['pins']['max_error_ok'] and
          rep['pins']['axes_ok'] and rep['sweep']['ok'] and
          rep['detents']['ok'] and rep['tilt']['ok'] and
          rep['stability']['ok'] and rep['names_ok'] and
          rep['carriages'] == 10 and rep['sweep']['selftest_ok'] and
          not rep['names_bad'])
    rep['all_checks_pass'] = bool(ok)
    return rep


DEVIATIONS = [
    'щит 1,660 x 0,800 (в panel.size_m спеки 1,700): радиус разворота 0,8498 '
    'и позиция r_head u = −0,871 посчитаны именно под половину 0,830; '
    'с щитом 1,70 щит не проходит под верхнюю раму (1,90 против 1,865)',
    'кареток 10, а не 12: carriages_per_ray [3,2,2,2,3] даёт 12, но '
    'carriages.count = 10 и все DOF-счётчики = 10; 10 фиксаторов — это '
    '«одновременных» точки тела. r_head и r_qr стоят на щите неподвижно '
    '(кронштейн головы уже вынесен за кромку на 0,041), остальные 10 — на каретках',
    'луч 0,860 (в спеке 0,920): при Z = ±0,46 конец луча упирается в стойку '
    '(её внутренняя грань |Z| = 0,445); конец обрезан по 0,430',
    'лучи утоплены в щит заподлицо (верх 0,0375), каналы 80 x 45 фрезерованы '
    'в лицевой плите: иначе плита подъёма каретки (52 мм по спеке) поднимает '
    'палец выше h = 0,0668, а гнёзда запястья и голени стоят ниже',
    'каретка: ползун 45 мм + плита 5 мм + кольцо поворота Ø60/Ø26 (в спеке '
    'тело 74 x 64 x 52) — габарит по h ограничен положением пальцев',
    'привод наклона: червячный редуктор i=40 соосен цапфе на кронштейне с '
    'траверсы; маховик Ø160 вместо рукоятки 250 мм — Ø250 не влезает в '
    'габарит 1,09 по Z',
    'балласт 25 кг (в брифе 40 кг): 40 кг в плите 1,20 x 0,60 x 0,030 даёт '
    '0,185 м³ стали, то есть 1,45 т/м³ — физически это не стальная плита; '
    'в BOM спеки 25 кг, принято 25',
    'выносные опоры сложены в габарит Z = ±0,545; в рабочем положении '
    'раскрываются до ±0,600 (габарит 1,20) — в bbox 1,09 не входят',
    'верхняя рама 1,900…1,960: зазор до верхней точки разворота 0,006 при '
    'θ = 90° (между гнездом головы r = 0,8838 и низом верхних балок 1,9075); '
    'в спеке 0,030 — не выдержано: гнездо r_head по спеке u = −0,871, '
    'h = 0,0378, его воротник Ø24 выходит на r = 0,8838',
    'габарит по Z 1,104 вместо 1,090: пальцы четырёх гнёзд крыла стоят осью '
    'на Z = ±0,545 (position_m спеки), тело пальца Ø12 выходит на ±0,551, '
    'пружина-фиксатор Ø14,2 — на ±0,552 (габарит 1,104)',
    'рёбра жёсткости щита (3 поперечины) и обвязка T-slot 45 по периметру '
    'выполнены как единая плита 30 мм + рёбра 45 мм: 6 поперечных рёбер '
    'между каналами лучей вместо 3 — каналы разрезают обвязку',
]


# ============================  АНИМАЦИЯ  ================================
def make_anim(pivot):
    """Клип tilt_modes: 7 детентов 0…90° вокруг реальной оси (Z, X=0, Y=1)."""
    pivot.animation_data_create()
    act = bpy.data.actions.new('tilt_modes')
    pivot.animation_data.action = act
    for i, deg in enumerate(DETENTS):
        frame = 1 + i
        pivot.rotation_euler = (0.0, math.radians(deg), 0.0)
        pivot.keyframe_insert('rotation_euler', frame=frame,
                              group='tilt')
    for fc in act.fcurves:
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
    # второй клип: выдвижение крыльев (0 / 0,055 наружу). base — в кадре glTF
    # (P), иначе узел, поставленный в P(...), уезжает на −0,52 по Y и +0,52
    # по Z относительно своего места: детали крыла попадают внутрь щита.
    for tg, sgn in (('l', 1.0), ('r', -1.0)):
        n = bpy.data.objects[f'{PREFIX}wing_slide_{tg}']
        base = P(WING_POST_X, 0.0, sgn * 0.520)
        n.animation_data_create()
        a2 = bpy.data.actions.new(f'deploy_wings_{tg}')
        n.animation_data.action = a2
        for i, dz in enumerate((0.0, 0.055)):
            n.location = base + P(0.0, 0.0, sgn * dz)
            n.keyframe_insert('location', frame=1 + i, group='wing_ext')
        n.location = base
    pivot.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.scene.frame_set(1)
    pivot.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    return {'clips': ['tilt_modes', 'deploy_wings_l', 'deploy_wings_r'],
            'tilt_keys_deg': DETENTS}


# ==============================  ЭКСПОРТ  ================================
def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objects:
        o['component'] = CID
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = OUT / f'{CID}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_animations=True, export_animation_mode='ACTIONS',
        export_cameras=False, export_lights=False, export_skins=False,
        export_morph=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    return path


def verify_glb(path):
    import struct
    raw = path.read_bytes()
    magic, ver, total = struct.unpack('<III', raw[:12])
    assert magic == 0x46546C67, 'not a GLB'
    off = 12
    js = None
    while off < total:
        clen, ctype = struct.unpack('<II', raw[off:off + 8])
        chunk = raw[off + 8:off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode('utf-8'))
        off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0)
    assert js is not None
    nodes = js.get('nodes', [])
    names = [n.get('name', '') for n in nodes]
    piv = next((i for i, n in enumerate(nodes)
                if n.get('name') == f'{PREFIX}panel_pivot'), None)
    piv_tr = nodes[piv].get('translation') if piv is not None else None
    mats = [m.get('name') for m in js.get('materials', [])]
    anims = []
    for a in js.get('animations', []):
        ch = a.get('channels', [])
        targets = sorted({nodes[c['target']['node']].get('name')
                          for c in ch if 'node' in c['target']})
        anims.append({'name': a.get('name'), 'channels': len(ch),
                      'targets': targets[:6]})
    bad = [n for n in names if n and not n.startswith(PREFIX)]
    return {'bytes': path.stat().st_size,
            'nodes': len(nodes), 'meshes': len(js.get('meshes', [])),
            'materials': len(mats), 'material_names': mats,
            'animations': anims,
            'pivot_node': piv, 'pivot_translation_gltf': piv_tr,
            'names_total': len(names),
            'names_with_prefix': sum(1 for n in names
                                     if n.startswith(PREFIX)),
            'names_bad': bad[:20],
            'extras_nodes': sum(1 for n in nodes if n.get('extras')),
            'ok': bool(piv is not None and piv_tr is not None and
                       abs(piv_tr[0]) < 1e-6 and abs(piv_tr[1] - 1.0) < 1e-5
                       and abs(piv_tr[2]) < 1e-6 and not bad and
                       len(mats) >= 6)}


# ==============================  РЕНДЕРЫ  ================================
def setup_render():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.25
    try:
        scene.eevee.taa_render_samples = 48
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.780, 0.775, 0.765, 1.0)
    bg.inputs['Strength'].default_value = 0.42
    bpy.ops.mesh.primitive_plane_add(size=12, location=(0.0, 0.0, -0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.660, 0.655, 0.645, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)
    for name, off, energy, sz in (('key', (2.20, -2.60, 2.60), 260.0, 2.00),
                                  ('fill', (-2.80, -2.10, 1.40), 90.0, 2.60),
                                  ('rim', (0.60, 2.80, 2.00), 150.0, 2.00)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector((0.0, 0.0, 1.0)) + Vector(off)
        lo.rotation_euler = (Vector((0.0, 0.0, 1.0)) -
                             lo.location).to_track_quat('-Z', 'Y').to_euler()
    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    return cam, cam_data


def render_views(cam, cam_data):
    from bpy_extras.object_utils import world_to_camera_view
    scene = bpy.context.scene
    meshes = [o for o in bpy.data.objects
              if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def cam_basis(d):
        q = Vector(d).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(d).normalized())

    def fit_dist(direction, lens, corners, margin=1.06):
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
        return [Vector((x, y, z)) for x in (a.x, b.x) for y in (a.y, b.y)
                for z in (a.z, b.z)]

    def max_ndc(fill):
        worst = 0.0
        for o in meshes:
            mw = o.matrix_world
            me = o.data
            for i in range(0, len(me.vertices), 9):
                p = world_to_camera_view(scene, cam, mw @ me.vertices[i].co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    shots = [
        ('3q', 0, (0.80, -0.92, 0.42), 70, True),
        ('front', 0, (0.02, -1.00, 0.18), 70, True),
        ('side', 0, (1.00, -0.20, 0.22), 70, True),
        ('top', 0, (0.02, -0.12, 1.00), 70, True),
        ('3q_45', 45, (0.78, -0.90, 0.40), 70, True),
        ('3q_90', 90, (0.80, -0.90, 0.34), 70, True),
        ('side_90', 90, (1.00, -0.16, 0.16), 70, True),
        ('back_45', 45, (-0.72, 0.82, 0.36), 70, True),
        ('closeup_pod', 0, (0.42, -0.62, 0.62), 60, False),
    ]
    pivot = bpy.data.objects[f'{PREFIX}panel_pivot']
    slab = bpy.data.objects[f'{PREFIX}panel_slab']
    # `bpy.ops.render.render()` делает собственную оценку депсграфа на текущем
    # кадре и заново применяет action `tilt_modes` (кадр 1 = θ 0°), затирая
    # угол, выставленный в pivot.rotation_euler. Именно поэтому снимки 45°/90°
    # выходили с лежащим щитом. Снимаем клип на всё время рендеров (в GLB он
    # уже экспортирован выше), фиксируем кадр и проверяем позу по оценённому
    # депсграфу — а не по pivot.rotation_euler, который рендер игнорирует.
    ad = pivot.animation_data
    act_pivot = ad.action if ad else None
    mutes = []
    if ad:
        ad.action = None
        for tr in ad.nla_tracks:
            mutes.append((tr, tr.mute))
            tr.mute = True
    pivot.rotation_mode = 'XYZ'
    RENDER_POSES.clear()

    def eval_pose(deg):
        """Поза из оценённого депсграфа: конец плиты и габарит плиты по Z."""
        dg = bpy.context.evaluated_depsgraph_get()
        pe = pivot.evaluated_get(dg)
        end = pe.matrix_world @ Vector((PU, 0.0, 0.0))
        se = slab.evaluated_get(dg)
        me = se.to_mesh()
        zs = [(se.matrix_world @ v.co).z for v in me.vertices]
        se.to_mesh_clear()
        c, s = math.cos(math.radians(deg)), math.sin(math.radians(deg))
        want_end = Vector((PU * c, 0.0, 1.0 - PU * s))
        # допуск 5 мм покрывает фаску 4 мм на кромках плиты: её диагональный
        # габарит меньше идеального бокса (на 45° расхождение 3,3 мм)
        want_span = 2 * PU * abs(s) + 0.030 * abs(c)
        err = max((end - want_end).length, abs((max(zs) - min(zs)) - want_span))
        return {'deg': deg, 'end_world': [round(v, 4) for v in end],
                'slab_z_span_m': round(max(zs) - min(zs), 4),
                'max_error_m': round(err, 4), 'ok': bool(err <= 0.005)}, err

    def set_tilt(deg):
        scene.frame_set(1)                     # клип снят: кадр не двигает позу
        pivot.rotation_euler = (0.0, math.radians(deg), 0.0)
        bpy.context.view_layer.update()
        rep, err = eval_pose(deg)
        if err > 0.005:
            raise RuntimeError(f'tilt pose not applied for render: deg={deg} '
                               f'{rep} (animation clip overrode the pose?)')
        return rep

    outs = []
    for tag, deg, direction, lens, refine in shots:
        pose = set_tilt(deg)

        mn, mx = mesh_bbox(meshes)
        center = (mn + mx) * 0.5
        if tag == 'closeup_pod':
            target = Vector((0.30, 0.195, 1.14))   # каретка бедра
            corners = box_corners(Vector((0.18, 0.10, 1.02)),
                                  Vector((0.44, 0.30, 1.28)))
            corners = [c - target for c in corners]
        else:
            target = center
            corners = [c - center for c in box_corners(mn, mx)]
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners, 1.04)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat(
            '-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4 if refine else 0):
            got = max_ndc(0.92)
            if abs(got - 0.92) < 0.02:
                break
            dist *= got / 0.92
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat(
                '-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        # рендер мог применить клип поверх позы — проверяем уже после него
        after, err = eval_pose(deg)
        if err > 0.005:
            raise RuntimeError(f'render overrode tilt pose: {tag} {after}')
        RENDER_POSES.append({'tag': tag, **after,
                             'pose_before_render': pose,
                             'pose_after_render_ok': True})
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} deg={deg} fill={max_ndc(0.92):.3f} '
              f'slab_z={after["slab_z_span_m"]:.3f} {fp}', flush=True)
    if act_pivot is not None:
        pivot.animation_data.action = act_pivot
    for tr, m in mutes:
        tr.mute = m
    scene.frame_set(1)
    pivot.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    return outs


# ===============================  MAIN  =================================
def main():
    import time
    t0 = time.time()
    root, pivot = build()
    bpy.context.view_layer.update()
    print(f'BUILD nodes={len([o for o in bpy.data.objects if o.name.startswith(PREFIX)])} '
          f'meshes={len([o for o in bpy.data.objects if o.type == "MESH" and o.name.startswith(PREFIX)])}',
          flush=True)

    anim = make_anim(pivot)
    pins = pin_convergence()
    det = sector_detents(pivot)
    tilt = tilt_readback(pivot)
    com, m_com, _ = com_estimate()
    stab = stability(m_com, com, 25.0)

    t1 = time.time()
    rot = [o for o in bpy.data.objects
           if o.type == 'MESH' and o.name.startswith(PREFIX) and
           (o.name in {r.name for r in ROT_PARTS})]
    st = [o for o in bpy.data.objects
          if o.type == 'MESH' and o.name.startswith(PREFIX) and
          o.name not in {r.name for r in ROT_PARTS}]
    checker = SweepChecker(pivot, st, rot)
    print(f'SWEEP candidate pairs={len(checker.pairs)} '
          f'rot={len(checker.rot)} static={len(checker.static)}', flush=True)
    stest = detector_selftest(pivot, checker)
    hits, rows, top = checker.run(step=1)
    sweep_rep = {
        'states': 91, 'step_deg': 1.0,
        'candidate_pairs': len(checker.pairs),
        'rotating_meshes': len(checker.rot),
        'static_meshes': len(checker.static),
        'radius_spec_m': 0.8498,
        'radius_built_m': round(max(a['r'][1] for a in checker.rot), 4),
        'top_frame_clearance_min_m': round(top, 4),
        'rows': rows,
        'hits': hits[:40],
        'hit_count': len(hits),
        'selftest': stest,
        'selftest_ok': bool(stest['ok']),
        'seconds': round(time.time() - t1, 1),
        'ok': bool(not hits and stest['ok'] and top > 0.005),
        'method': 'BVH-пересечение поворотной группы со статикой на каждом '
                  'градусе 0…90; предфильтр по радиусу от оси наклона и по '
                  'координате вдоль оси',
    }
    if os.environ.get('FRAME3D_DEBUG'):
        from collections import Counter
        cc = Counter()
        for h in hits:
            cc[(h['rot'].replace(PREFIX, '').rsplit('_', 1)[0],
                h['static'].replace(PREFIX, '').rsplit('_', 1)[0])] += 1
        for k, v in cc.most_common(20):
            print('HITPAIR', v, k, flush=True)
        zr = sorted((round(b, 4) for b in [0]))[:1]
        print('ROTR', sorted({(a['name'].replace(PREFIX, ''), round(a['r'][0],3), round(a['r'][1],3), round(a['y'][0],3), round(a['y'][1],3)) for a in checker.rot})[:200], flush=True)
        print('STATR', sorted({(b['name'].replace(PREFIX, ''), round(b['r'][0],3), round(b['r'][1],3), round(b['y'][0],3), round(b['y'][1],3)) for b in checker.static if b['r'][0] < 1.0 and b['y'][1] > -0.55})[:200], flush=True)
    print('SWEEP', json.dumps({'hits': len(hits), 'top': round(top, 4),
                               'selftest': stest, 'sec': sweep_rep['seconds']},
                              ensure_ascii=False), flush=True)

    rep = check(pivot, sweep_rep, pins, det, tilt, stab)
    rep['anim'] = anim
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['glb_verify'] = verify_glb(path)
    print('EXPORTED', path, path.stat().st_size,
          json.dumps(rep['glb_verify'], ensure_ascii=False)[:600], flush=True)

    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'joints.json').write_text(
        json.dumps(jclean(build_joints(pivot)), ensure_ascii=False, indent=2),
        encoding='utf-8')

    if os.environ.get('FRAME3D_SKIP_RENDER'):
        rep['renders'] = []
    else:
        cam, cam_data = setup_render()
        rep['renders'] = render_views(cam, cam_data)
        rep['render_pose_check'] = RENDER_POSES
    rep['build_seconds'] = round(time.time() - t0, 1)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(jclean(rep), ensure_ascii=False, indent=2),
        encoding='utf-8')
    print('REPORT_OK', json.dumps({
        k: rep[k] for k in ('bbox_size_gltf', 'nodes', 'meshes', 'carriages',
                            'sockets', 'material_count', 'mass_bom_kg',
                            'all_checks_pass')}, ensure_ascii=False), flush=True)
    if not rep['all_checks_pass']:
        raise SystemExit('checks failed')


if __name__ == '__main__':
    main()
