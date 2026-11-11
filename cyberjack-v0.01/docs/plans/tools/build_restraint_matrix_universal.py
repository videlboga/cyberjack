"""Standalone builder: restraint_matrix_universal (RST-MX-12, «Матрица универсальная», Mk-II).

Универсальное поле T-slot 45 (паз 15): периметр 2,0 x 1,0 м на четырёх винтовых
опорах/домкратах с 4 x M12 (поле 1,756 x 0,776), три траверсы, шесть продольных
рельсов с шагом 0,100 по Z, 18 перекрёстных замков, 6 фиксированных гнёзд
CJ-LATCH-30R (сборка V) и 8 кареток (до 12) с гнёздами CJ-LATCH-30R (сборка P).

Каретка — три последовательных DOF:
  carriage_<nn>      X   призма     -0,900 … +0,900   (ход 1,800; зона на рельс)
  slide_plate_<nn>   Z   призма      0 … 0,024        (односторонний, по стороне)
  yaw_plate_<nn>     Y   вращение    0 … 345°         (24 фиксатора по 15°)

Ход слайда по Z ОДНОСТОРОННИЙ и направлен от межрельсового коридора:
у кареток внутреннего рельса (±0,24) — к центру рамы, у кареток наружного
(±0,34) — наружу, к обвязке. Причина в цифрах: габарит каретки по Z 0,078
при шаге рельсов 0,100, то есть коридор 0,022 на сторону 0,011. Любой
двусторонний ход ставит соседей по коридору в контакт (нужно ≥ 0,078 +
2·|dz|), а односторонний — только разводит их: габариты уходят от коридора.
Проверено на 24 фиксаторах поворота, 7 точках X и предельном ходе.

Рабочая зона по X у кареток одного рельса — своя доля: две каретки на одном
рельсе не расходятся, граница — середина между посадочными X. Ось пальца
гнезда — y = 0,372 (как у Mk-I 0,3709).

Геометрия собрана в координатах спеки (glTF/three.js: X — длинная ось,
Y — вверх, Z — ширина). В Blender пересчёт b = (gx, -gz, gy), см. P().
Уровни по Y: рама 0,195…0,240; рельс 0,240…0,285; каретка 0,285…0,325;
слайд 0,325…0,341; поворот 0,341…0,353; гнездо 0,353…0,395; палец 0,372.

Не зависит от build_restraint_matrix.py (Mk-I не трогается).

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_matrix_universal.py

Выход:
  public/models/machine-modules/components/restraint_matrix_universal.glb
  docs/plans/blockout/component-library/restraint_matrix_universal/*.png
  docs/plans/blockout/component-library/restraint_matrix_universal/report.json
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
import numpy as np
from mathutils import Euler, Matrix, Vector
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_matrix_universal'
CID = 'restraint_matrix_universal'
CODE = 'RST-MX-12'
PREFIX = CID + '__'

# --- габарит и уровни (glTF, метры) --------------------------------------
HX, HZ = 1.000, 0.500          # половина длины / ширины -> 2,0 x 1,0
LEG_X, LEG_Z = 0.930, 0.440    # оси стоек/домкратов
PAD_HALF = 0.058               # подошва 116 x 116
LEG_HALF = 0.036               # стойка 72 x 72
LEG_Y0, LEG_Y1 = 0.060, 0.195
JACK_Y0, JACK_Y1 = 0.012, 0.060

ANCHOR_X, ANCHOR_Z = 0.878, 0.388   # 4 x M12, поле 1,756 x 0,776

BEAM_Z = 0.4775                # ось продольной обвязки
BEAM_X = 0.9775                # ось торцевой обвязки
LONG_HALF = 0.955              # обвязка/рельс до внутренней грани углового кубика
PROF = 0.045                   # профиль T-slot 45 x 45
FRAME_Y0, FRAME_Y1 = 0.195, 0.240
RAIL_Y0, RAIL_Y1 = 0.240, 0.285

RAILS_Z = [-0.44, -0.34, -0.24, 0.24, 0.34, 0.44]
RAILS_Z = RAILS_Z          # r0…r5
INNER_RAIL_Z = 0.24        # рельсы кареток: внутренний и наружный
OUTER_RAIL_Z = 0.34
TIES_X = [-0.72, -0.05, 0.62]

BODY_Y0, BODY_Y1 = 0.2855, 0.3250    # низ корпуса +0,5 мм над рельсом
SLIDE_BASE_Y0, SLIDE_BASE_Y1 = 0.3255, 0.3310
SLIDE_Y0, SLIDE_Y1 = 0.3315, 0.3410
RING_Y0, RING_Y1 = 0.3415, 0.3465
YAW_Y0, YAW_Y1 = 0.3475, 0.3525
RECV_BASE_Y0, RECV_BASE_Y1 = 0.3530, 0.3585
RECV_Y0, RECV_Y1 = 0.3585, 0.3900      # окно 32 мм по высоте
LEVER_Y0, LEVER_Y1 = 0.3920, 0.3980
PAD_Y0, PAD_Y1 = 0.3920, 0.4000
PIN_Y = 0.372

CAR_X_HALF = 0.056             # каретка 112 мм по X
CAR_Z_HALF = 0.022             # 44 мм по Z
DOF_X = 0.895
Z_STROKE = 0.024               # односторонний ход слайда по Z (было ±0,045)
DOF_Z = Z_STROKE
Z_STOP_CLOSED = 0.0151         # упор с закрытой стороны (0,0022 толщиной)
Z_STOP_OPEN = 0.0396           # упор с открытой стороны: ход + 0,0156
YAW_MAX = 345.0


def z_dir_of(z0):
    """±1 — направление одностороннего хода слайда (glTF Z).

    Каретки внутреннего рельса (|z0| = 0,24) идут к центру рамы, наружного
    (|z0| = 0,34) — наружу. Так габариты соседей по межрельсовому коридору
    только расходятся: ход любого из них не сокращает зазор, а увеличивает.
    """
    inward = abs(abs(z0) - INNER_RAIL_Z) < 1e-6
    return (-1.0 if inward else 1.0) * (1.0 if z0 > 0 else -1.0)

# каретки: (id, zone, x, z, yaw_home) — c05/c06 перенесены с ±0,44 на ±0,24
CARRIAGES_SPEC = [
    ('c01', 'wrist_l', -0.28, 0.34, 0.0),
    ('c02', 'wrist_r', -0.28, -0.34, 180.0),
    ('c03', 'ankle_l', 0.52, 0.34, 0.0),
    ('c04', 'ankle_r', 0.52, -0.34, 180.0),
    ('c05', 'thigh_l', 0.10, 0.24, 0.0),
    ('c06', 'thigh_r', 0.10, -0.24, 180.0),
    ('c07', 'waist_l', 0.34, 0.24, 0.0),
    ('c08', 'neck', -0.62, -0.24, 90.0),
]
SOCKETS_SPEC = [
    ('s01', -0.72, 0.44), ('s02', -0.72, -0.44),
    ('s03', -0.05, 0.44), ('s04', -0.05, -0.44),
    ('s05', 0.62, 0.44), ('s06', 0.62, -0.44),
]

PALETTE = {
    'cream': (0.930, 0.917, 0.886),
    'cream_hi': (0.968, 0.960, 0.938),
    'steel': (0.700, 0.712, 0.726),
    'graphite': (0.098, 0.104, 0.114),
    'dark': (0.030, 0.032, 0.038),
    'blush': (0.872, 0.618, 0.652),
    'pale': (0.944, 0.838, 0.828),
    'red': (0.700, 0.075, 0.062),
}
MATS = {}

# реестры для проверок
CARRIAGES = []          # dicts
STATIC_PARTS = []       # objects вне кареток
ALL_PARTS = []


# --- базовые помощники ----------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    CARRIAGES.clear()
    STATIC_PARTS.clear()
    ALL_PARTS.clear()


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
    """glTF/three.js (X,Y вверх,Z) -> Blender (X,Y,Z вверх)."""
    return Vector((gx, -gz, gy))


def GS(sx, sy, sz):
    """glTF-габарит -> Blender-габарит."""
    return (sx, sz, sy)


def gbox(name, c, size, role, r=0.0008, rotz=0.0, smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=P(*c))
    o = bpy.context.object
    o.name = name
    o.scale = GS(*size)
    if rotz:
        o.rotation_euler = (0, 0, rotz)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bevel(o, r)
    return apply(o, role, smooth)


def gcyl(name, a, b, radius, role, vertices=24, r2=None, smooth=True, bev=0.0):
    a, b = P(*a), P(*b)
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
    o = bpy.context.object
    o.name = name
    o.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        bevel(o, bev, 2)
    return apply(o, role, smooth)


def ghex(name, c, across, h, role, axis='y'):
    """Шестигранная головка болта."""
    if axis == 'y':
        a = (c[0], c[1] - h * 0.5, c[2])
        b = (c[0], c[1] + h * 0.5, c[2])
    else:
        a = (c[0] - h * 0.5, c[1], c[2])
        b = (c[0] + h * 0.5, c[1], c[2])
    o = gcyl(name, a, b, across * 0.5, role, vertices=6, smooth=False)
    return o


def gtorus(name, c, axis_dir, major, minor, role, segs=24, rings=8):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=P(*c))
    o = bpy.context.object
    o.name = name
    d = P(*axis_dir) - P(0, 0, 0)
    o.rotation_euler = d.normalized().to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(o, role, True)


# --- T-slot профиль -------------------------------------------------------
def slot_profile(half=PROF * 0.5, chamfer=0.0018, open_half=0.0075,
                 neck=0.006, chamber_half=0.0105):
    """Сечение 45 x 45 рельса: паз 15, шейка 6.

    Боковые пазы (по ±Z) — глубокие: камера 21 x 14 (глубина 6…20), в ней
    ходят ролики Ø14 x 8 каретки. Верх/низ — камера 21 x 4 (6…10) под
    T-болт и графитовую дорожку. Глубины разные намеренно: камеры соседних
    граней не пересекаются (иначе сечение самопересекается и выдавливание
    даёт мусорную геометрию).
    """
    depth_by_face = {0: 0.010, 1: 0.020, 2: 0.010, 3: 0.020}
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
    # грань 0 (низ): слева направо
    pts.append((-half + c, -half))
    pts += path(0)
    pts.append((half - c, -half))
    # грань 1 (право): снизу вверх
    pts.append((half, -half + c))
    pts += path(1)
    pts.append((half, half - c))
    # грань 2 (верх): справа налево
    pts.append((half - c, half))
    pts += path(2)
    pts.append((-half + c, half))
    # грань 3 (лево): сверху вниз
    pts.append((-half, half - c))
    pts += path(3)
    pts.append((-half, -half + c))
    return pts


PROFILE = slot_profile()


def profile_solid(name, axis, l0, l1, c_u, c_v, role, poly=None,
                  smooth=False):
    """Выдавить сечение T-slot вдоль оси axis ('x'|'z') от l0 до l1."""
    poly = poly or PROFILE
    n = len(poly)
    verts = []
    for t in (l0, l1):
        for (u, v) in poly:
            if axis == 'x':                 # u -> gltf Z, v -> gltf Y
                verts.append(P(t, c_v + v, c_u + u))
            else:                           # u -> gltf X, v -> gltf Y
                verts.append(P(c_u + u, c_v + v, t))
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, n + j, n + i))
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


def bm_box(bm, c, size):
    """Прямоугольник в bmesh (glTF-координаты центра и габарита)."""
    cx, cy, cz = P(*c)
    sx, sy, sz = GS(*size)
    hx, hy, hz = sx * 0.5, sy * 0.5, sz * 0.5
    vs = [bm.verts.new((cx + x, cy + y, cz + z))
          for x, y, z in ((-hx, -hy, -hz), (hx, -hy, -hz), (hx, hy, -hz),
                          (-hx, hy, -hz), (-hx, -hy, hz), (hx, -hy, hz),
                          (hx, hy, hz), (-hx, hy, hz))]
    for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1),
              (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)):
        bm.faces.new([vs[i] for i in f])


def bm_cyl(bm, a, b, radius, segments=16):
    a, b = P(*a), P(*b)
    d = (b - a)
    if d.length < 1e-7:
        raise ValueError('bm_cyl zero')
    q = d.normalized().to_track_quat('Z', 'Y')
    up = q @ Vector((0, 0, 1))
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
    return up


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


def add(o, static=True):
    ALL_PARTS.append(o)
    if static:
        STATIC_PARTS.append(o)
    return o


def empty(name, loc, rot=(0.0, 0.0, 0.0)):
    e = bpy.data.objects.new(name, None)
    e.empty_display_type = 'PLAIN_AXES'
    e.empty_display_size = 0.06
    bpy.context.scene.collection.objects.link(e)
    e.location = P(*loc)
    e.rotation_euler = rot
    return e


def parent_keep(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()


# =======================  СТОЙКИ И ДОМКРАТЫ  ==============================
def build_legs():
    for sx, tagx in ((1, 'r'), (-1, 'f')):
        for sz, tagz in ((1, 'l'), (-1, 'r')):
            x = sx * LEG_X
            z = sz * LEG_Z
            t = f'{tagx}{tagz}'
            add(gbox(f'{PREFIX}foot_pad_{t}', (x, 0.006, z),
                     (PAD_HALF * 2, 0.012, PAD_HALF * 2), 'cream', r=0.0045,
                     smooth=False))
            add(gcyl(f'{PREFIX}foot_ring_{t}', (x, 0.012, z), (x, 0.019, z),
                     0.031, 'steel', vertices=32, bev=0.0012))
            add(gcyl(f'{PREFIX}jack_barrel_{t}', (x, 0.018, z), (x, 0.044, z),
                     0.029, 'graphite', vertices=32))
            add(ghex(f'{PREFIX}jack_nut_{t}', (x, 0.050, z), 0.062, 0.016,
                     'steel'))
            add(gcyl(f'{PREFIX}jack_rod_{t}', (x, 0.040, z), (x, 0.070, z),
                     0.014, 'steel', vertices=20))
            add(gbox(f'{PREFIX}leg_{t}', (x, (LEG_Y0 + LEG_Y1) * 0.5, z),
                     (LEG_HALF * 2, LEG_Y1 - LEG_Y0, LEG_HALF * 2), 'cream',
                     r=0.0055))
            add(gbox(f'{PREFIX}leg_collar_{t}', (x, 0.181, z),
                     (0.082, 0.016, 0.082), 'cream_hi', r=0.0035))
            # анкер M12 в поле 1,756 x 0,776 (на подошве, ближе к центру)
            ax = sx * ANCHOR_X
            az = sz * ANCHOR_Z
            add(gcyl(f'{PREFIX}anchor_washer_{t}', (ax, 0.012, az),
                     (ax, 0.018, az), 0.021, 'steel', vertices=24, bev=0.001))
            add(gcyl(f'{PREFIX}anchor_washer_in_{t}', (ax, 0.009, az),
                     (ax, 0.0122, az), 0.026, 'dark', vertices=24))
            add(ghex(f'{PREFIX}anchor_bolt_{t}', (ax, 0.023, az), 0.019, 0.011,
                     'dark'))
    return


# ==============================  РАМА  ====================================
def build_frame():
    yc = (FRAME_Y0 + FRAME_Y1) * 0.5
    # продольные балки (вдоль X)
    for zs, tag in ((1, 'front'), (-1, 'rear')):
        add(profile_solid(f'{PREFIX}beam_long_{tag}', 'x', -LONG_HALF,
                          LONG_HALF, zs * BEAM_Z, yc, 'cream'))
    # торцевые балки (вдоль Z)
    for xs, tag in ((1, 'pelvis'), (-1, 'head')):
        add(profile_solid(f'{PREFIX}beam_end_{tag}', 'z', -0.455, 0.455,
                          xs * BEAM_X, yc, 'cream'))
    # угловые кубики
    for xs, tx in ((1, 'r'), (-1, 'l')):
        for zs, tz in ((1, 'f'), (-1, 'r')):
            add(gbox(f'{PREFIX}corner_{tx}{tz}', (xs * BEAM_X, yc, zs * BEAM_Z),
                     (PROF, PROF, PROF), 'cream', r=0.0032))
    # тёмные вставки в верхние пазы обвязки
    lips = [('beam_slot_lip_a', (0.0, 0.236, BEAM_Z), (1.860, 0.006, 0.013)),
            ('beam_slot_lip_b', (0.0, 0.236, -BEAM_Z), (1.860, 0.006, 0.013)),
            ('beam_slot_lip_c', (BEAM_X, 0.236, 0.0), (0.013, 0.006, 0.860)),
            ('beam_slot_lip_d', (-BEAM_X, 0.236, 0.0), (0.013, 0.006, 0.860))]
    for nm, c, s in lips:
        add(gbox(f'{PREFIX}{nm}', c, s, 'dark', r=0.0008))
    return


# =============================  ТРАВЕРСЫ  =================================
def build_ties():
    yc = (FRAME_Y0 + FRAME_Y1) * 0.5
    for i, x in enumerate(TIES_X):
        tag = ('head', 'mid', 'pelvis')[i]
        add(profile_solid(f'{PREFIX}tie_body_{tag}', 'z', -0.455, 0.455, x, yc,
                          'cream_hi'))
        for j, (zs) in enumerate((1, -1)):
            z = zs * 0.4475
            add(ghex(f'{PREFIX}tie_bolt_{tag}_{j}', (x + 0.018, yc, z), 0.017,
                     0.020, 'steel', axis='z'))
            add(gbox(f'{PREFIX}tie_bolt_pad_{tag}_{j}',
                     (x + 0.018, yc, zs * 0.4395),
                     (0.030, 0.026, 0.006), 'steel', r=0.0008))
    return


# ==============================  РЕЛЬСЫ  ==================================
def build_rails():
    for i, z in enumerate(RAILS_Z):
        add(profile_solid(f'{PREFIX}rail_body_r{i}', 'x', -LONG_HALF, LONG_HALF,
                          z, (RAIL_Y0 + RAIL_Y1) * 0.5, 'cream_hi'))
        # графитовая дорожка в верхнем пазу (лежит на дне камеры, верх 0,281)
        add(gbox(f'{PREFIX}rail_way_r{i}', (0.0, 0.2780, z),
                 (1.890, 0.0060, 0.0130), 'graphite', r=0.0008))
        for xs, tg in ((1, 'rear'), (-1, 'front')):
            add(gbox(f'{PREFIX}rail_cap_r{i}_{tg}', (xs * 0.9515, 0.2625, z),
                     (0.008, 0.047, 0.047), 'cream', r=0.0020))
        # риски шага 100 мм — в верхнем пазу рядом с дорожкой
        zt = z + (0.0085 if z > 0 else -0.0085)
        bm = bmesh.new()
        for k in range(-8, 9):
            if abs(k) <= 2:
                continue
            bm_box(bm, (k * 0.100, 0.2816, zt), (0.0022, 0.0010, 0.0022))
        add(mesh_from_bm(f'{PREFIX}rail_ticks_r{i}', bm, 'graphite'))
        # шкала у нуля (тоже в пазу)
        add(gbox(f'{PREFIX}rail_scale_r{i}', (0.0, 0.2814, zt),
                 (0.190, 0.0012, 0.0040), 'dark', r=0.0004))
    return


# =========================  ПЕРЕКРЁСТНЫЕ ЗАМКИ  ============================
def build_crosslocks():
    for i, z in enumerate(RAILS_Z):
        for j, x in enumerate(TIES_X):
            bm = bmesh.new()
            bm_box(bm, (x, 0.191, z), (0.016, 0.008, 0.061))          # низ
            bm_box(bm, (x + 0.016, 0.2175, z), (0.008, 0.045, 0.061))  # бок +
            bm_box(bm, (x - 0.016, 0.2175, z), (0.008, 0.045, 0.061))  # бок −
            add(mesh_from_bm(f'{PREFIX}cross_lock_r{i}_t{j}', bm, 'graphite'))
            bm = bmesh.new()
            for dz in (0.022, -0.022):
                for dx in (0.004, -0.004):
                    bm_box(bm, (x + dx, 0.1845, z + dz),
                           (0.013, 0.009, 0.013))
            add(mesh_from_bm(f'{PREFIX}cross_bolt_r{i}_t{j}', bm, 'dark'))
    return


# ===============================  ЛОЖЕ  ===================================
def build_bed():
    add(gbox(f'{PREFIX}bed_tray', (0.0, 0.249, 0.0),
             (1.420, 0.018, 0.400), 'cream', r=0.0040, smooth=False))
    bm = bmesh.new()
    for zs in (1, -1):
        bm_box(bm, (0.0, 0.2575, zs * 0.196), (1.420, 0.016, 0.008))
    for xs in (1, -1):
        bm_box(bm, (xs * 0.706, 0.2575, 0.0), (0.008, 0.016, 0.400))
    add(mesh_from_bm(f'{PREFIX}bed_tray_lip', bm, 'cream_hi'))
    bm = bmesh.new()
    for k in range(-2, 3):
        bm_box(bm, (k * 0.250, 0.2435, 0.0), (0.026, 0.014, 0.380))
    add(mesh_from_bm(f'{PREFIX}bed_ribs', bm, 'cream_hi'))
    for zs, tg in ((1, 'l'), (-1, 'r')):
        add(gbox(f'{PREFIX}bed_pad_{tg}', (0.0, 0.2665, zs * 0.099),
                 (1.380, 0.017, 0.176), 'blush', r=0.0060, smooth=True))
    bm = bmesh.new()
    bm_box(bm, (0.0, 0.2752, 0.0), (1.380, 0.0022, 0.006))
    for k in range(-3, 4):
        if k == 0:
            continue
        bm_box(bm, (k * 0.190, 0.2752, 0.0), (0.005, 0.0022, 0.300))
    add(mesh_from_bm(f'{PREFIX}bed_seams', bm, 'graphite'))
    add(gbox(f'{PREFIX}bed_axis_x', (-0.560, 0.2755, 0.0),
             (0.260, 0.0026, 0.0040), 'red', r=0.0004))
    return


# ======================  ФИКСИРОВАННЫЕ ГНЁЗДА (V)  =======================
def build_sockets():
    """Гнездо CJ-LATCH-30R, сборка V (палец вертикально), палец y = 0,372.

    Стоит на траверсе седлом через наружный рельс: две ножки (внутренняя —
    на траверсе z 0,394…0,4165, наружная — на обвязке z 0,472…0,494),
    траверса над рельсом y 0,300…0,312, корпус 0,312…0,386 за пределом
    хода каретки (её максимальный вылет по Z — 0,4246).
    """
    for sid, xs, zs in SOCKETS_SPEC:
        inb = -1.0 if zs > 0 else 1.0
        out = -inb
        tag = sid[1:]
        bm = bmesh.new()
        bm_box(bm, (xs, 0.270, zs + inb * 0.035), (0.034, 0.060, 0.0225))
        bm_box(bm, (xs, 0.270, zs - inb * 0.043), (0.034, 0.060, 0.0220))
        bm_box(bm, (xs, 0.306, zs + inb * 0.004), (0.040, 0.012, 0.100))
        add(mesh_from_bm(f'{PREFIX}socket_riser_{tag}', bm, 'cream_hi'))
        add(gbox(f'{PREFIX}socket_body_{tag}',
                 (xs, 0.349, zs - inb * 0.019), (0.056, 0.074, 0.054),
                 'cream', r=0.0035))
        # вилка: две горизонтальные щеки, зазор 20 мм под язык 6 мм
        bm = bmesh.new()
        bm_box(bm, (xs, 0.357, zs - inb * 0.004), (0.048, 0.006, 0.030))
        bm_box(bm, (xs, 0.383, zs - inb * 0.004), (0.048, 0.006, 0.030))
        bm_box(bm, (xs, 0.370, zs + inb * 0.0115), (0.048, 0.026, 0.007))
        add(mesh_from_bm(f'{PREFIX}socket_fork_{tag}', bm, 'steel'))
        add(gcyl(f'{PREFIX}socket_pin_{tag}', (xs, 0.360, zs - inb * 0.019),
                 (xs, 0.384, zs - inb * 0.019), 0.006, 'steel', vertices=20,
                 bev=0.0008))
        add(gtorus(f'{PREFIX}socket_spring_{tag}',
                   (xs, 0.3705, zs - inb * 0.019), (0, 1, 0), 0.0095, 0.0016,
                   'steel', segs=20, rings=6))
        add(gbox(f'{PREFIX}socket_lever_{tag}',
                 (xs, 0.3795, zs - inb * 0.040), (0.014, 0.008, 0.030),
                 'cream_hi', r=0.0015))
        add(gbox(f'{PREFIX}socket_lever_pad_{tag}',
                 (xs, 0.3795, zs - inb * 0.0495), (0.016, 0.009, 0.012),
                 'red', r=0.0018))
        bm = bmesh.new()
        for dx in (0.017, -0.017):
            for dz in (0.017, -0.017):
                bm_box(bm, (xs + dx, 0.3835, zs - inb * 0.019 + dz),
                       (0.011, 0.005, 0.011))
        add(mesh_from_bm(f'{PREFIX}socket_bolt_row_{tag}', bm, 'dark'))
        add(gbox(f'{PREFIX}socket_mark_{tag}',
                 (xs + 0.022, 0.3866, zs - inb * 0.019),
                 (0.006, 0.0012, 0.014), 'graphite', r=0.0003))
    return


# ==============================  КАРЕТКА  =================================
def carriage(spec):
    """Каретка: корпус (X) -> поперечный слайд (Z) -> поворот (YAW) -> гнездо.

    Все посадки разведены зазором 0,5 мм; ролики Ø14 x 8 идут в боковых
    камерах паза (глубина 6…20 мм), корпус стоит на 0,5 мм выше рельса.
    """
    cid, zone, x0, z0, yaw_home = spec
    tag = cid[1:]
    inb = -1.0 if z0 > 0 else 1.0          # к центру рамы (glTF Z)
    out = -inb
    d = z_dir_of(z0)                       # направление одностороннего хода Z
    units = {'body': [], 'slide': [], 'yaw': []}

    def n(s):
        return f'{PREFIX}{s}_{tag}'

    def reg(unit, obj, static=False):
        add(obj, static=static)
        units[unit].append(obj)
        return obj

    # ---------- корпус (DOF X) ----------
    body = reg('body', gbox(n('carriage'), (x0, 0.30525, z0),
                            (0.112, 0.0395, 0.044), 'graphite', r=0.0045))
    for s, tg in ((1, 'a'), (-1, 'b')):
        reg('body', gbox(n(f'carriage_jaw_{tg}'), (x0, 0.2685, z0 + s * 0.0265),
                         (0.112, 0.033, 0.0050), 'graphite', r=0.0012))
    # 4 ролика Ø14 x 8 в боковых камерах + полуоси
    bm = bmesh.new()
    for sx in (1, -1):
        for sz in (1, -1):
            zc = z0 + sz * 0.0110
            bm_cyl(bm, (x0 + sx * 0.038, 0.2592, zc - 0.004),
                   (x0 + sx * 0.038, 0.2592, zc + 0.004), 0.0070, 16)
            bm_cyl(bm, (x0 + sx * 0.038, 0.2592, zc + sz * 0.004),
                   (x0 + sx * 0.038, 0.2592, z0 + sz * 0.0300), 0.0030, 10)
    reg('body', mesh_from_bm(n('carriage_rollers'), bm, 'steel', smooth=True))
    # клиновой зажим
    reg('body', gbox(n('carriage_clamp_pad'), (x0 + 0.006, 0.292,
                                              z0 + out * 0.0315),
                     (0.048, 0.022, 0.010), 'graphite', r=0.0012))
    bm = bmesh.new()
    bm_box(bm, (x0 - 0.006, 0.3105, z0 + out * 0.0255), (0.104, 0.009, 0.013))
    bm_cyl(bm, (x0 + 0.042, 0.3105, z0 + out * 0.0210),
           (x0 + 0.042, 0.3105, z0 + out * 0.0290), 0.0085, 16)
    bm_cyl(bm, (x0 - 0.048, 0.3105, z0 + out * 0.0180),
           (x0 - 0.048, 0.3105, z0 + out * 0.0250), 0.0080, 16)
    reg('body', mesh_from_bm(n('carriage_clamp_lever'), bm, 'cream_hi',
                             smooth=True))
    for s, tg in ((1, 'a'), (-1, 'b')):
        reg('body', ghex(n(f'carriage_tbolt_{tg}'),
                         (x0 + s * 0.048, 0.328, z0 + inb * 0.0180),
                         0.014, 0.006, 'dark'))
    reg('body', gbox(n('carriage_index'), (x0, 0.3252, z0 + out * 0.0190),
                     (0.010, 0.0012, 0.006), 'red', r=0.0003))
    reg('body', gbox(n('carriage_scale'), (x0, 0.3030, z0 + out * 0.0224),
                     (0.070, 0.010, 0.0022), 'cream_hi', r=0.0004))
    bm = bmesh.new()
    for k in range(-3, 4):
        bm_box(bm, (x0 + k * 0.009, 0.3030, z0 + out * 0.0236),
               (0.0016, 0.008, 0.0008))
    reg('body', mesh_from_bm(n('carriage_scale_marks'), bm, 'graphite'))

    # ---------- поперечный слайд (DOF Z, односторонний) ----------
    # Направляющая должна быть длиннее хода: 0,058 = ход 0,024 + плита 0,026
    # + 0,008 запаса. В старой схеме основание было 0,030 при ходе 0,090 —
    # плита на краю хода держалась на 4 мм.
    reg('body', gbox(n('slide_base'), (x0, 0.32825, z0 + d * 0.012),
                     (0.076, 0.0055, 0.058), 'steel', r=0.0012))
    # упоры хода: закрытый (плита на 0) и открытый (плита на +0,024),
    # оба на уровне плиты — это реальные тела, за которые ход не проходит
    bm = bmesh.new()
    for s in (-1.0, 1.0):
        zc = -Z_STOP_CLOSED if s < 0 else Z_STOP_OPEN
        bm_box(bm, (x0, 0.33325, z0 + d * zc), (0.070, 0.0155, 0.0022))
    reg('body', mesh_from_bm(n('slide_stop'), bm, 'dark'))

    bm = bmesh.new()
    bm_box(bm, (x0, 0.33625, z0), (0.088, 0.0095, 0.026))        # плита
    bm_box(bm, (x0 + 0.056, 0.336, z0), (0.014, 0.0080, 0.020))  # гайка M12
    plate = reg('slide', mesh_from_bm(n('slide_plate'), bm, 'steel'))
    # винт перекрывает весь ход; маховик — с закрытой стороны, вне пути плиты
    reg('body', gcyl(n('slide_screw'), (x0 + 0.062, 0.3290, z0 - d * 0.0300),
                     (x0 + 0.062, 0.3290, z0 + d * 0.0380), 0.0040, 'steel',
                     vertices=16))
    bm = bmesh.new()
    bm_cyl(bm, (x0 + 0.0580, 0.3290, z0 - d * 0.0300),
           (x0 + 0.0640, 0.3290, z0 - d * 0.0300), 0.0070, 24)
    bm_cyl(bm, (x0 + 0.0575, 0.3290, z0 - d * 0.0300),
           (x0 + 0.0645, 0.3290, z0 - d * 0.0300), 0.0034, 14)
    reg('body', mesh_from_bm(n('slide_handwheel'), bm, 'cream_hi', smooth=True))
    reg('body', gcyl(n('slide_handwheel_grip'),
                     (x0 + 0.0640, 0.3290, z0 - d * 0.0300),
                     (x0 + 0.0665, 0.3290, z0 - d * 0.0300), 0.0028,
                     'graphite', vertices=12))
    reg('slide', gbox(n('slide_scale'), (x0 - 0.0455, 0.337, z0),
                      (0.0030, 0.006, 0.024), 'cream_hi', r=0.0003))
    bm = bmesh.new()
    for k in range(-2, 3):
        bm_box(bm, (x0 - 0.0465, 0.337, z0 + k * 0.0055),
               (0.0016, 0.005, 0.0012))
    reg('slide', mesh_from_bm(n('slide_scale_marks'), bm, 'graphite'))

    # ---------- поворот (DOF YAW) ----------
    reg('slide', gcyl(n('yaw_ring'), (x0, RING_Y0, z0), (x0, RING_Y1, z0),
                      0.0330, 'steel', vertices=40, bev=0.0008))
    bm = bmesh.new()
    for k in range(24):
        a = 2 * math.pi * k / 24
        bm_box(bm, (x0 + 0.0305 * math.cos(a), 0.3468,
                    z0 + 0.0305 * math.sin(a)), (0.0016, 0.0008, 0.0055))
    reg('slide', mesh_from_bm(n('yaw_marks'), bm, 'dark'))
    yaw = reg('yaw', gcyl(n('yaw_plate'), (x0, YAW_Y0, z0), (x0, YAW_Y1, z0),
                          0.0350, 'graphite', vertices=40, bev=0.0008))

    bm = bmesh.new()
    bm_box(bm, (x0 + 0.0300, 0.3565, z0), (0.014, 0.007, 0.020))
    bm_cyl(bm, (x0 + 0.0300, 0.3565, z0), (x0 + 0.0300, 0.3565, z0 + 0.012),
           0.0050, 14)
    reg('yaw', mesh_from_bm(n('yaw_lever'), bm, 'cream_hi', smooth=True))
    bm = bmesh.new()
    bm_box(bm, (x0 + inb * 0.0, 0.3545, z0 + out * 0.0300),
           (0.020, 0.011, 0.016))
    bm_cyl(bm, (x0, 0.3545, z0 + out * 0.0340),
           (x0, 0.3545, z0 + out * 0.0400), 0.0025, 12)
    reg('yaw', mesh_from_bm(n('yaw_detent'), bm, 'steel', smooth=True))

    # ---------- гнездо CJ-LATCH-30R (P: палец по X) ----------
    bm = bmesh.new()
    bm_box(bm, (x0, 0.3557, z0), (0.050, 0.0055, 0.050))             # база
    bm_box(bm, (x0, 0.3742, z0 + out * 0.0175), (0.046, 0.0315, 0.011))
    reg('yaw', mesh_from_bm(n('recv_body'), bm, 'steel'))
    bm = bmesh.new()
    for s in (1, -1):
        bm_box(bm, (x0 + s * 0.010, 0.3742, z0 + inb * 0.0050),
               (0.012, 0.0315, 0.048))
    reg('yaw', mesh_from_bm(n('recv_fork'), bm, 'steel'))
    reg('yaw', gcyl(n('recv_pin'), (x0 - 0.0205, PIN_Y, z0 + inb * 0.0050),
                    (x0 + 0.0205, PIN_Y, z0 + inb * 0.0050), 0.0060, 'steel',
                    vertices=24, bev=0.0008))
    bm = bmesh.new()
    bm_box(bm, (x0, 0.3790, z0 + inb * 0.0200), (0.009, 0.016, 0.011))
    bm_cyl(bm, (x0 - 0.0195, 0.3825, z0 + inb * 0.0200),
           (x0 + 0.0195, 0.3825, z0 + inb * 0.0200), 0.0030, 12)
    reg('yaw', mesh_from_bm(n('recv_pawl'), bm, 'steel', smooth=True))
    reg('yaw', gtorus(n('recv_spring'), (x0 + 0.0165, 0.3825, z0 + inb * 0.0200),
                      (1, 0, 0), 0.0065, 0.0015, 'steel', segs=18, rings=6))
    # рычаг сброса: стойка от оси собачки вверх, затем перо наружу над щеками
    bm = bmesh.new()
    bm_box(bm, (x0, 0.3875, z0 + inb * 0.0200), (0.012, 0.011, 0.010))
    bm_box(bm, (x0, 0.3950, z0 + out * 0.0230), (0.014, 0.006, 0.032))
    reg('yaw', mesh_from_bm(n('recv_lever'), bm, 'steel'))
    reg('yaw', gbox(n('recv_lever_pad'), (x0, 0.3955, z0 + out * 0.0330),
                    (0.016, 0.009, 0.014), 'red', r=0.0020))
    bm = bmesh.new()
    for s in (1, -1):
        bm_box(bm, (x0 + s * 0.0155, 0.3860, z0 + inb * 0.0245),
               (0.006, 0.012, 0.022))
    bm_box(bm, (x0, 0.3900, z0 + inb * 0.0245), (0.036, 0.006, 0.008))
    reg('yaw', mesh_from_bm(n('recv_guard'), bm, 'cream_hi'))
    bm = bmesh.new()
    for dx in (0.017, -0.017):
        for dz in (0.017, -0.017):
            bm_box(bm, (x0 + dx, 0.3598, z0 + dz), (0.010, 0.005, 0.010))
    for dz in (0.0110, -0.0110):                       # антипроворот Ø5
        bm_cyl(bm, (x0, 0.3590, z0 + dz), (x0, 0.3645, z0 + dz), 0.0025, 12)
    reg('yaw', mesh_from_bm(n('recv_bolt_row'), bm, 'dark'))
    reg('yaw', gbox(n('recv_mark'), (x0 + 0.0210, 0.3593, z0),
                    (0.005, 0.0012, 0.012), 'graphite', r=0.0003))
    for s, tg in ((1, 'a'), (-1, 'b')):
        reg('yaw', gbox(n(f'recv_pad_{tg}'), (x0 + s * 0.0042, 0.3742,
                                            z0 + inb * 0.0050),
                        (0.0016, 0.024, 0.040), 'blush', r=0.0005))
    reg('yaw', gbox(n('recv_stop'), (x0, 0.3747, z0 + out * 0.0145),
                    (0.028, 0.020, 0.006), 'graphite', r=0.0008))
    reg('yaw', gbox(n('recv_axis'), (x0, 0.3904, z0 + out * 0.0175),
                    (0.030, 0.0012, 0.0040), 'red', r=0.0003))

    # ---------- иерархия: body -> plate -> yaw ----------
    bpy.context.view_layer.update()
    for o in units['body']:
        if o is not body:
            parent_keep(o, body)
    parent_keep(plate, body)
    for o in units['slide']:
        if o is not plate:
            parent_keep(o, plate)
    parent_keep(yaw, plate)
    for o in units['yaw']:
        if o is not yaw:
            parent_keep(o, yaw)

    CARRIAGES.append({
        'id': cid, 'zone': zone, 'tag': tag, 'x0': x0, 'z0': z0,
        'yaw_home': yaw_home, 'z_dir': d, 'body': body, 'plate': plate,
        'yaw': yaw,
        'units': units,
        'names': {'body': [o.name for o in units['body']],
                  'slide': [o.name for o in units['slide']],
                  'yaw': [o.name for o in units['yaw']]},
    })
    return body


def build_carriages():
    for spec in CARRIAGES_SPEC:
        carriage(spec)
    return


def build_misc():
    add(gbox(f'{PREFIX}nameplate', (0.9989, 0.2175, 0.090),
             (0.0022, 0.036, 0.190), 'cream_hi', r=0.0006))
    bm = bmesh.new()
    for i in range(3):
        bm_box(bm, (0.9994, 0.2175, 0.038 + i * 0.024),
               (0.0008, 0.0040, 0.016))
    add(mesh_from_bm(f'{PREFIX}nameplate_marks', bm, 'graphite'))
    add(gbox(f'{PREFIX}nameplate_dot', (0.9994, 0.2175, 0.140),
             (0.0012, 0.004, 0.008), 'red', r=0.0002))
    return


def build():
    reset()
    build_legs()
    build_frame()
    build_ties()
    build_rails()
    build_crosslocks()
    build_bed()
    build_sockets()
    build_carriages()
    build_misc()
    bpy.context.view_layer.update()
    return ALL_PARTS


# ============================  ПРОВЕРКИ  ==================================
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


# --- кинематические проверки ---------------------------------------------
# Единственная объявленная посадка с пересечением объёмов: винт M12 в гайке
# плиты (резьба не смоделирована, тела винта и гайки совпадают по построению).
# Палец Ø12 в щеках вилки и ось собачки — посадки с зазором: пересечения там
# НЕТ, поэтому они не в белом списке (иначе белый список мог бы скрыть
# настоящее столкновение). Межкареточные пары не могут быть в этом списке
# ни при каких условиях — см. проверку в pose_test().
JOINTS = {
    ('slide_plate', 'slide_screw'): 'винт M12 в гайке плиты (резьба не смоделирована)',
}
# посадки с зазором — только для протокола, пересечения не ожидается
FITS = {
    ('recv_fork', 'recv_pin'): 'палец Ø12 в отверстиях щёк вилки, зазор 0,1 мм',
    ('recv_fork', 'recv_pawl'): 'ось собачки Ø6 в щеках, зазор 0,1 мм',
}


def base_name(nm):
    s = nm[len(PREFIX):] if nm.startswith(PREFIX) else nm
    parts = s.rsplit('_', 1)
    if len(parts) == 2 and parts[1].isdigit():
        return parts[0]
    return s


def _arrays(meshes):
    V, T = {}, {}
    for o in meshes:
        me = o.data
        n = len(me.vertices)
        co = np.empty(n * 3, dtype=np.float64)
        me.vertices.foreach_get('co', co)
        V[o.name] = co.reshape(n, 3)
        me.calc_loop_triangles()
        tri = np.empty(len(me.loop_triangles) * 3, dtype=np.int32)
        me.loop_triangles.foreach_get('vertices', tri)
        T[o.name] = tri.reshape(-1, 3)
    return V, T


def _mk(name, M, V, T):
    a = np.array(M.to_3x3(), dtype=np.float64)
    t = np.array(M.translation, dtype=np.float64)
    w = V[name] @ a.T + t
    bvh = BVHTree.FromPolygons([tuple(p) for p in w], [tuple(map(int, f)) for f in T[name]])
    return bvh, w.min(axis=0), w.max(axis=0)


def _hit(bb1, bb2, pad=0.0008):
    for i in range(3):
        if bb1[1][i] < bb2[0][i] - pad or bb1[0][i] > bb2[1][i] + pad:
            return False
    return True


# габарит каретки по X: −0,058 … +0,0665 (клещевой рычаг / маховик Z)
CAR_X_MIN, CAR_X_MAX = -0.058, 0.0665
GAP_X = 0.002
GAP_Z = 0.0030          # минимальный зазор движущейся группы по Z
PAIR_GAP_X = 0.0060     # минимальный зазор между каретками одного рельса
X_PAIR_GAP = (CAR_X_MAX - CAR_X_MIN) + PAIR_GAP_X  # 0,1305 — минимум между
#                                                  центрами двух кареток


def allowed_x(car):
    """Рабочая зона по X — своя доля рельса.

    Две каретки на одном рельсе разойтись не могут: их зоны по X обязаны быть
    непересекающимися. Граница — середина между посадочными X плюс половина
    габаритного зазора. В прежней схеме зона считалась только по габаритам
    соседа «дома», поэтому две каретки одного рельса могли получить
    перекрывающиеся X (это и давало 264 из 270 «одновременных» столкновений).
    """
    lo, hi = -DOF_X, DOF_X
    for other in CARRIAGES:
        if other is car or abs(other['z0'] - car['z0']) > 1e-6:
            continue
        mid = (car['x0'] + other['x0']) * 0.5
        if other['x0'] > car['x0']:
            hi = min(hi, mid - X_PAIR_GAP * 0.5)
        else:
            lo = max(lo, mid + X_PAIR_GAP * 0.5)
    return lo, hi


def _matrices(car, dx, dz, ang, HOME):
    """Матрицы трёх узлов каретки: X (корпус), X+Z (слайд), X+Z+YAW (поворот)."""
    p = Vector((car['x0'], -car['z0'], 0.0))
    Mx = Matrix.Translation((dx, 0.0, 0.0))
    Mz = Mx @ Matrix.Translation((0.0, -dz, 0.0))
    My = Mz @ (Matrix.Translation(p) @ Matrix.Rotation(math.radians(ang), 4, 'Z')
               @ Matrix.Translation(-p))
    return Mx, Mz, My


def _gbox(names, mat_of, V):
    """AABB группы деталей в координатах спеки (glTF): x, y вверх, z ширина.

    Считается по вершинам, а не по повёрнутым углам bound_box: иначе поворот
    на 15° раздувал бы габарит и занижал рабочую зону.
    """
    mn = np.array([1e9, 1e9, 1e9])
    mx = np.array([-1e9, -1e9, -1e9])
    for nm in names:
        M = mat_of(nm)
        P = V[nm] @ np.array(M.to_3x3(), dtype=np.float64).T + np.array(M.translation)
        mn = np.minimum(mn, P.min(axis=0))
        mx = np.maximum(mx, P.max(axis=0))
    # Blender (bx, by, bz) -> glTF (bx, bz, -by)
    return (float(mn[0]), float(mx[0]), float(mn[2]), float(mx[2]),
            float(-mx[1]), float(-mn[1]))


def _pose_aabb(car, dx, dz, ang, V, HOME, units=('slide', 'yaw')):
    Mx, Mz, My = _matrices(car, dx, dz, ang, HOME)
    names = []
    for u in units:
        names += car['names'][u]

    def mat_of(nm):
        if nm in car['names']['yaw']:
            return My @ HOME[nm]
        if nm in car['names']['slide']:
            return Mz @ HOME[nm]
        return Mx @ HOME[nm]

    return _gbox(names, mat_of, V)


def _car_aabbs(car, dx, dz, ang, V, HOME):
    """AABB всех деталей каретки в позе — препятствия для соседей."""
    Mx, Mz, My = _matrices(car, dx, dz, ang, HOME)
    out = []
    for nm in car['names']['body']:
        out.append((nm,) + _gbox([nm], lambda n, M=Mx @ HOME[nm]: M, V))
    for nm in car['names']['slide']:
        out.append((nm,) + _gbox([nm], lambda n, M=Mz @ HOME[nm]: M, V))
    for nm in car['names']['yaw']:
        out.append((nm,) + _gbox([nm], lambda n, M=My @ HOME[nm]: M, V))
    return out


def _pose_aabbs_parts(car, dx, dz, ang, V, HOME):
    """AABB каждой детали движущейся группы (слайд + поворот) в позе."""
    Mx, Mz, My = _matrices(car, dx, dz, ang, HOME)
    out = []
    for nm in car['names']['slide']:
        out.append(_gbox([nm], lambda n, M=Mz @ HOME[nm]: M, V))
    for nm in car['names']['yaw']:
        out.append(_gbox([nm], lambda n, M=My @ HOME[nm]: M, V))
    return out


def _travel_limit(car, dx, ang, obst, V, HOME, cap=None):
    """Ход слайда вдоль z_dir в позе (x, yaw), ограниченный габаритами.

    Считается по AABB КАЖДОЙ детали, а не по объединённому AABB группы:
    объединённый даёт пустые углы и занижает ход (в прежней схеме — до 20 мм,
    из-за чего 887 из 930 проб за пределом зоны оказывались в воздухе).

    Возвращает (limit, blocked_by). limit ≤ cap; blocked_by — детали, с
    которыми группа уже пересекается при dz = 0 (тогда limit = 0).
    """
    cap = Z_STROKE if cap is None else cap
    parts = _pose_aabbs_parts(car, dx, 0.0, ang, V, HOME)
    d = car['z_dir']
    lim = cap
    blocked = []
    for (gx0, gx1, gy0, gy1, gz0, gz1) in parts:
        for (onm, ox0, ox1, oy0, oy1, oz0, oz1) in obst:
            if ox1 < gx0 - GAP_X or ox0 > gx1 + GAP_X:
                continue
            if oy1 < gy0 - GAP_Z or oy0 > gy1 + GAP_Z:   # разные уровни по высоте
                continue
            if d > 0:
                if oz0 >= gz1:
                    lim = min(lim, oz0 - gz1 - GAP_Z)
                elif oz1 > gz0:
                    blocked.append(onm)
            else:
                if oz1 <= gz0:
                    lim = min(lim, gz0 - oz1 - GAP_Z)
                elif oz0 < gz1:
                    blocked.append(onm)
    if blocked:
        return 0.0, blocked
    return max(0.0, lim), blocked


def _pose_bvh(car, dx, dz, ang, V, T, HOME):
    Mx, Mz, My = _matrices(car, dx, dz, ang, HOME)
    out = {}
    for nm in car['names']['body']:
        out[nm] = _mk(nm, Mx @ HOME[nm], V, T)
    for nm in car['names']['slide']:
        out[nm] = _mk(nm, Mz @ HOME[nm], V, T)
    for nm in car['names']['yaw']:
        out[nm] = _mk(nm, My @ HOME[nm], V, T)
    return out


def _unit_of(car, nm):
    if nm in car['names']['yaw']:
        return 'yaw'
    if nm in car['names']['slide']:
        return 'slide'
    return 'body'


def _selftest(CARRIAGES_LOCAL, V, T, HOME, static_cache):
    """Проверка самой проверки: детектор обязан ловить заведомые пересечения
    и не выдумывать их там, где есть зазор."""
    out = {}
    made = []
    bpy.ops.mesh.primitive_cube_add(size=0.10, location=(0, 0, 5))
    a = bpy.context.object
    a.name = f'{PREFIX}probe_a'
    made.append(a)
    Va, Ta = _arrays([a])
    ba, _, _ = _mk(a.name, a.matrix_world.copy(), Va, Ta)
    for tag, dx, expect in (('overlap_1mm', 0.099, True),
                            ('exact_touch', 0.100, True),
                            ('gap_3mm', 0.103, False)):
        bpy.ops.mesh.primitive_cube_add(size=0.10, location=(dx, 0, 5))
        b = bpy.context.object
        b.name = f'{PREFIX}probe_{tag}'
        made.append(b)
        Vb, Tb = _arrays([b])
        bb, _, _ = _mk(b.name, b.matrix_world.copy(), Vb, Tb)
        n = len(ba.overlap(bb))
        out[tag] = {'tri_pairs': n, 'expect_hit': expect, 'ok': bool(n > 0) == expect}
    for o in made:
        bpy.data.objects.remove(o, do_unlink=True)

    c01 = CARRIAGES_LOCAL[0]
    sname2 = {nm: bb for nm, bb in static_cache.items()}
    forced = 0
    for nm in c01['names']['body']:
        b1, a1, c1 = _mk(nm, Matrix.Translation((0, 0, -0.006)) @ HOME[nm], V, T)
        for sname, (b2, a2, c2) in sname2.items():
            if _hit((a1, c1), (a2, c2)) and b1.overlap(b2):
                forced += 1
    out['forced_6mm_into_rail'] = {'hits': forced, 'expect_hit': True,
                                   'ok': forced > 0}
    out['ok'] = all(v['ok'] for v in out.values() if isinstance(v, dict))
    return out


def pose_test():
    import random
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    V, T = _arrays(meshes)
    HOME = {o.name: o.matrix_world.copy() for o in meshes}

    static_names = [o.name for o in STATIC_PARTS]
    static_cache = {nm: _mk(nm, HOME[nm], V, T) for nm in static_names}
    static_aabb = [(nm,) + _gbox([nm], lambda n, nm=nm: HOME[nm], V)
                   for nm in static_names]

    results = {'poses': 0, 'pairs': 0, 'collisions': [],
               'intended_joints': {}, 'declared_fits': {},
               'per_carriage': {}, 'z_workspace': {},
               'boundary': {'states': 0, 'detected': 0, 'undetected': [],
                            'by_side': {'open': 0, 'closed': 0},
                            'blocked_by': {}, 'decision': ''},
               'simultaneous': {'samples': 0, 'pairs': 0, 'collisions': [],
                                'states': [], 'kinds': {},
                                'counterfactual': {'samples': 0, 'pairs': 0,
                                                   'collisions': []}},
               'detector_selftest': {}}
    results['detector_selftest'] = _selftest(CARRIAGES, V, T, HOME, static_cache)

    # чужие каретки «дома» — BVH и габариты
    home_bvh = {}
    home_aabb = {}
    for car in CARRIAGES:
        names = car['names']['body'] + car['names']['slide'] + car['names']['yaw']
        home_bvh[car['id']] = {nm: _mk(nm, HOME[nm], V, T) for nm in names}
        home_aabb[car['id']] = _car_aabbs(car, 0.0, 0.0, car['yaw_home'], V, HOME)

    def record(sink, car, x, dz, ang, label, n1, n2):
        sink.append({
            'carriage': car['id'], 'pose': [round(x, 4), round(dz, 4), ang],
            'label': label, 'pair': [n1, n2]})

    def test_pose(car, x, dz, ang, label, others_home=True, other_bvh=None,
                  sink=None):
        if sink is None:
            sink = results['collisions']
        """Полный тест одной позы: внутри узлов, против статики, против соседей."""
        hits = 0
        objs = _pose_bvh(car, x - car['x0'], dz, ang, V, T, HOME)
        items = list(objs.items())
        for i in range(len(items)):
            n1, (b1, a1, c1) = items[i]
            u1 = _unit_of(car, n1)
            for j in range(i + 1, len(items)):
                n2, (b2, a2, c2) = items[j]
                if u1 == _unit_of(car, n2):
                    continue
                if not _hit((a1, c1), (a2, c2)):
                    continue
                results['pairs'] += 1
                if not b1.overlap(b2):
                    continue
                key = tuple(sorted((base_name(n1), base_name(n2))))
                if key in JOINTS:
                    k = key[0] + ' x ' + key[1]
                    jj = results['intended_joints'].setdefault(
                        k, {'note': JOINTS[key], 'poses': 0, 'by_carriage': {}})
                    jj['poses'] += 1
                    jj['by_carriage'][car['id']] = \
                        jj['by_carriage'].get(car['id'], 0) + 1
                    continue
                hits += 1
                record(sink, car, x, dz, ang, label, n1, n2)
            for sname, (b2, a2, c2) in static_cache.items():
                if not _hit((a1, c1), (a2, c2)):
                    continue
                results['pairs'] += 1
                if b1.overlap(b2):
                    hits += 1
                    record(sink, car, x, dz, ang, label, n1, sname)
        pool = other_bvh if other_bvh is not None else {
            cid: d for cid, d in home_bvh.items() if cid != car['id']}
        for cid, objs2 in pool.items():
            if cid == car['id']:
                continue
            for n1, (b1, a1, c1) in items:
                for n2, (b2, a2, c2) in objs2.items():
                    if not _hit((a1, c1), (a2, c2)):
                        continue
                    results['pairs'] += 1
                    if b1.overlap(b2):
                        hits += 1
                        record(sink, car, x, dz, ang, label, n1, n2)
        return hits

    obst_home = {}
    for car in CARRIAGES:
        obst = list(static_aabb)
        for oc in CARRIAGES:
            if oc is car:
                continue
            obst += home_aabb[oc['id']]
        obst_home[car['id']] = obst

    for car in CARRIAGES:
        lo, hi = allowed_x(car)
        xs = [lo + (hi - lo) * k / 6.0 for k in range(7)]
        angs = [k * 15.0 for k in range(24)]
        d = car['z_dir']
        st = {'poses': 0, 'hits': 0, 'x_range': [round(lo, 4), round(hi, 4)],
              'pairs_tested': 0, 'z_dir': d, 'z_max': Z_STROKE,
              'z_geom_min': Z_STROKE, 'z_states': 0,
              'z_geometry_limited': 0, 'blocked_by': {},
              'x_span': round(hi - lo, 4)}
        zw = []
        for x in xs:
            zx = Z_STROKE
            for ang in angs:
                lim, blocked = _travel_limit(car, x - car['x0'], ang,
                                             obst_home[car['id']], V, HOME)
                zx = min(zx, lim)
                st['z_states'] += 1
                if blocked:
                    for bn in blocked:
                        st['blocked_by'][bn] = st['blocked_by'].get(bn, 0) + 1
                if lim < Z_STROKE - 1e-6:
                    st['z_geometry_limited'] += 1
                for t in sorted({0.0, round(lim * 0.5, 6), round(lim, 6)}):
                    st['poses'] += 1
                    results['poses'] += 1
                    before = results['pairs']
                    h = test_pose(car, x, d * t, ang,
                                  f'x{round(x, 3)}/z{round(t, 3)}/y{int(ang)}')
                    st['hits'] += h
                    st['pairs_tested'] += results['pairs'] - before
                # --- граница: за ходом обязано быть твёрдое тело -------------
                # открытая сторона: предел по геометрии либо наружный упор
                bd = results['boundary']
                bcol = []
                bd['states'] += 1
                bd['by_side']['open'] += 1
                test_pose(car, x, d * (lim + 0.010), ang,
                          f'boundary_open/{round(lim + 0.010, 3)}/y{int(ang)}',
                          sink=bcol)
                if bcol:
                    bd['detected'] += 1
                    for c in bcol:
                        kp = (base_name(c['pair'][0]).split('__')[-1] + ' x ' +
                              base_name(c['pair'][1]).split('__')[-1])
                        bp = bd['blocked_by']
                        bp[kp] = bp.get(kp, 0) + 1
                else:
                    bd['undetected'].append(
                        {'carriage': car['id'], 'x': round(x, 4), 'yaw': ang,
                         'side': 'open', 'limit': round(lim, 4)})
                # закрытая сторона: плита упирается в закрытый упор
                if ang % 120.0 == 0.0:
                    ccol = []
                    bd['states'] += 1
                    bd['by_side']['closed'] += 1
                    test_pose(car, x, -d * 0.008, ang,
                              f'boundary_closed/-0.008/y{int(ang)}', sink=ccol)
                    if ccol:
                        bd['detected'] += 1
                        for c in ccol:
                            kp = (base_name(c['pair'][0]).split('__')[-1] + ' x ' +
                                  base_name(c['pair'][1]).split('__')[-1])
                            bp = bd['blocked_by']
                            bp[kp] = bp.get(kp, 0) + 1
                    else:
                        bd['undetected'].append(
                            {'carriage': car['id'], 'x': round(x, 4),
                             'yaw': ang, 'side': 'closed', 'limit': -0.008})
            zw.append({'x': round(x, 4), 'z_max': round(zx, 4)})
            st['z_geom_min'] = min(st['z_geom_min'], round(zx, 4))
        results['per_carriage'][car['id']] = st
        results['z_workspace'][car['id']] = zw
        print(f"POSE {car['id']} d={d:+.0f} poses={st['poses']} "
              f"pairs={st['pairs_tested']} hits={st['hits']} x={st['x_range']} "
              f"z_max(min over x,yaw)={st['z_geom_min']:.4f} "
              f"geom_limited={st['z_geometry_limited']}/{st['z_states']}",
              flush=True)

    bd = results['boundary']
    bd['decision'] = (
        f"пробы ЗА пределом хода: {bd['detected']} из {bd['states']} упираются "
        f"в реальное тело (AABB деталей + BVH), свободных проб — "
        f"{bd['states'] - bd['detected']}. Открытая сторона ({bd['by_side']['open']}): "
        f"предел по геометрии (гнездо/вилка/обвязка) либо наружный упор "
        f"slide_stop на +{Z_STOP_OPEN:.4f}; закрытая сторона "
        f"({bd['by_side']['closed']}): закрытый упор на -{Z_STOP_CLOSED:.4f}. "
        f"Обе стороны — тела, а не воздух: ход за предел физически невозможен.")
    print(f"BOUNDARY states={bd['states']} detected={bd['detected']} "
          f"open={bd['by_side']['open']} closed={bd['by_side']['closed']}",
          flush=True)

    # --- каретки соседних рельсов одновременно (попарный тест этого не ловит) --
    # --- одновременные позы: все 8 кареток в своих допустимых состояниях -----
    # Гарантия (доказательство, а не подбор): у соседей по коридору
    # (|Δz| = 0,100) ход направлен В РАЗНЫЕ стороны от коридора — каретка
    # внутреннего рельса уходит к центру рамы, наружного — к обвязке. Поэтому
    # при любых допустимых dz и любом фиксаторе поворота габариты соседей
    # только расходятся, и зазор не меньше, чем при dz = 0. Ниже это измерено
    # на 40 состояниях (включая адверсарные: пара на одном X, полный ход) и
    # на 12 контрольных позах с ходом ПРОТИВ DOF — они обязаны сталкиваться.
    import random
    rnd = random.Random(20261111)
    sim = results['simultaneous']
    adj = []
    for i, a in enumerate(CARRIAGES):
        for b in CARRIAGES[i + 1:]:
            if abs(abs(a['z0'] - b['z0']) - 0.1) < 1e-6:
                adj.append((a, b))

    def static_limit(car, x, ang):
        lim, _blk = _travel_limit(car, x - car['x0'], ang, static_aabb, V, HOME)
        return lim

    def run_sample(kind, states, pair, sink):
        """Одна одновременная поза: все каретки, все пары, статика.

        Поза обязана быть допустимой: X каждой каретки — внутри её рабочей
        зоны (доли рельса), Z — внутри хода. Иначе тест сравнивал бы
        положения, которых механизм не принимает, и «столкновение» в такой
        позе ничего не доказывало бы.
        """
        built = {}
        for car in CARRIAGES:
            x, t, ang = states[car['id']]
            lo, hi = allowed_x(car)
            if not (lo - 1e-9 <= x <= hi + 1e-9):
                raise AssertionError(
                    f'{kind}: {car["id"]} x={x:.4f} вне зоны [{lo:.4f}, {hi:.4f}]')
            if abs(t) > Z_STROKE + 1e-9:
                raise AssertionError(
                    f'{kind}: {car["id"]} dz={t:.4f} вне хода {Z_STROKE}')
            dz = car['z_dir'] * t
            built[car['id']] = _pose_bvh(car, x - car['x0'], dz, ang, V, T, HOME)
        sim['samples'] += 1
        sim['kinds'][kind] = sim['kinds'].get(kind, 0) + 1
        if sink is sim['collisions']:
            sim['states'].append({'kind': kind, 'pair': pair,
                                  'state': {cid: [round(v[0], 4),
                                                  round(v[1], 4), v[2]]
                                            for cid, v in states.items()}})
        ub = {}
        for cid, objs in built.items():
            ub[cid] = ([min(v[1][i] for v in objs.values()) for i in range(3)],
                       [max(v[2][i] for v in objs.values()) for i in range(3)])
        for i, ca in enumerate(CARRIAGES):
            for cb in CARRIAGES[i + 1:]:
                (la, ha), (lb, hb) = ub[ca['id']], ub[cb['id']]
                if not _hit((la, ha), (lb, hb)):
                    continue
                for n1, (b1, a1, c1) in built[ca['id']].items():
                    for n2, (b2, a2, c2) in built[cb['id']].items():
                        if not _hit((a1, c1), (a2, c2)):
                            continue
                        sim['pairs'] += 1
                        if b1.overlap(b2):
                            sink.append({'cars': [ca['id'], cb['id']],
                                         'kind': kind,
                                         'pose': [round(states[ca['id']][0], 4),
                                                  round(states[ca['id']][1], 4),
                                                  states[ca['id']][2]],
                                         'pair': [n1, n2]})
            items = list(built[ca['id']].items())
            for sname, (b2, a2, c2) in static_cache.items():
                for n1, (b1, a1, c1) in items:
                    if not _hit((a1, c1), (a2, c2)):
                        continue
                    sim['pairs'] += 1
                    if b1.overlap(b2):
                        sink.append({'cars': [ca['id'], 'static'],
                                     'kind': kind,
                                     'pose': [round(states[ca['id']][0], 4),
                                              round(states[ca['id']][1], 4),
                                              states[ca['id']][2]],
                                     'pair': [n1, sname]})

    def home_states():
        out = {}
        for car in CARRIAGES:
            lo, hi = allowed_x(car)
            x = min(max(car['x0'], lo), hi)
            ang = rnd.randrange(24) * 15.0
            out[car['id']] = [x, static_limit(car, x, ang), ang]
        return out

    # (a) адверсарные: соседи по коридору на одном X, полный ход.
    # Пары, у которых зоны по X не пересекаются (разные доли рельсов), в
    # такой позе физически невозможны — они считаются отдельно.
    reach = [(a, b) for (a, b) in adj
             if max(allowed_x(a)[0], allowed_x(b)[0])
             <= min(allowed_x(a)[1], allowed_x(b)[1])]
    sim['adjacent_pairs_total'] = len(adj)
    sim['adjacent_pairs_same_x_reachable'] = [[a['id'], b['id']] for a, b in reach]
    sim['adjacent_pairs_same_x_blocked_by_partition'] = [
        [a['id'], b['id']] for a, b in adj if (a, b) not in reach]
    if not reach:
        raise AssertionError('нет ни одной пары соседних рельсов с общим X')
    for k in range(24):
        a, b = reach[k % len(reach)]
        lo = max(allowed_x(a)[0], allowed_x(b)[0])
        hi = min(allowed_x(a)[1], allowed_x(b)[1])
        xa = rnd.uniform(lo, hi)
        states = home_states()
        for c in (a, b):
            ang = rnd.randrange(24) * 15.0
            states[c['id']] = [xa, static_limit(c, xa, ang), ang]
        run_sample('adjacent_same_x', states, [a['id'], b['id']],
                   sim['collisions'])
    # (b) общий случай: все каретки разъезжаются
    for k in range(8):
        states = home_states()
        for car in CARRIAGES:
            lo, hi = allowed_x(car)
            x = rnd.uniform(lo, hi)
            ang = rnd.randrange(24) * 15.0
            states[car['id']] = [x, static_limit(car, x, ang), ang]
        run_sample('random_all', states, None, sim['collisions'])
    # (c) худшее по X: каретки одного рельса прижаты друг к другу
    for k in range(8):
        states = home_states()
        for car in CARRIAGES:
            lo, hi = allowed_x(car)
            partner = [o for o in CARRIAGES
                       if o is not car and abs(o['z0'] - car['z0']) < 1e-6]
            x = hi if partner and partner[0]['x0'] > car['x0'] else lo
            ang = rnd.randrange(24) * 15.0
            states[car['id']] = [x, static_limit(car, x, ang), ang]
        run_sample('rails_tight', states, None, sim['collisions'])
    # (d) контроль: ход ПРОТИВ DOF (в коридор) обязан давать столкновение —
    #     иначе односторонний ход не нужен и проверка ничего не доказывает.
    # Берём фиксатор поворота, при котором габарит каретки обращён к коридору
    # максимально, и сдвигаем обе каретки на 15 мм в коридор (30 мм на пару
    # против зазора 19,6 мм) — контакт обязан появиться.
    def corridor_yaw(car):
        sg = 1.0 if car['z0'] > 0 else -1.0
        inner = abs(abs(car['z0']) - INNER_RAIL_Z) < 1e-6
        cdir = sg if inner else -sg
        best, bang = -1.0, 0.0
        for ang in [k * 15.0 for k in range(24)]:
            g = _pose_aabb(car, 0.0, 0.0, ang, V, HOME)
            e = (g[5] - car['z0']) if cdir > 0 else (car['z0'] - g[4])
            if e > best:
                best, bang = e, ang
        return bang, best

    cf = sim['counterfactual']
    cf['push_into_corridor'] = -0.015
    for k in range(12):
        a, b = reach[k % len(reach)]
        lo = max(allowed_x(a)[0], allowed_x(b)[0])
        hi = min(allowed_x(a)[1], allowed_x(b)[1])
        xa = rnd.uniform(lo, hi)
        states = home_states()
        for c in (a, b):
            ang, ext = corridor_yaw(c)
            states[c['id']] = [xa, -0.015, ang]
        b4 = len(cf['collisions'])
        run_sample('counterfactual_into_corridor', states,
                   [a['id'], b['id']], cf['collisions'])
        cf['samples'] += 1
        if len(cf['collisions']) > b4:
            cf['samples_hit'] = cf.get('samples_hit', 0) + 1
    print(f"SIM samples={sim['samples']} pairs={sim['pairs']} "
          f"collisions={len(sim['collisions'])} "
          f"cf_samples={cf['samples']} cf_hit={cf.get('samples_hit', 0)} "
          f"cf_collisions={len(cf['collisions'])}", flush=True)

    # --- посадки с зазором: фиксируем факт «пересечения нет» -----------------
    for key, note in FITS.items():
        results['declared_fits'][key[0] + ' x ' + key[1]] = {
            'note': note, 'poses': 0}
    return results


def check(parts):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    mats = [m for m in bpy.data.materials if m.users]

    def center(o):
        a, b = obj_bbox(o)
        return (a + b) * 0.5, (b - a)

    rail_z = []
    for i in range(6):
        o = bpy.data.objects.get(f'{PREFIX}rail_body_r{i}')
        c, s = center(o)
        rail_z.append(round(-c.y, 4))
    pin_y = []
    for car in CARRIAGES:
        o = bpy.data.objects[f'{PREFIX}recv_pin_{car["tag"]}']
        c, s = center(o)
        pin_y.append(round(c.z, 4))
    sock_pin_y = []
    for sid, xs, zs in SOCKETS_SPEC:
        o = bpy.data.objects[f'{PREFIX}socket_pin_{sid[1:]}']
        c, s = center(o)
        sock_pin_y.append(round(c.z, 4))

    anchors = []
    for t in ('rl', 'rr', 'fl', 'fr'):
        o = bpy.data.objects[f'{PREFIX}anchor_bolt_{t}']
        c, s = center(o)
        anchors.append([round(c.x, 4), round(-c.y, 4)])

    ties = [o.name for o in meshes if '__tie_body_' in o.name]
    locks = [o.name for o in meshes if '__cross_lock_' in o.name]
    sockets = [o.name for o in meshes if '__socket_body_' in o.name]

    stroke_joint = round(2 * LONG_HALF - (CAR_X_MAX - CAR_X_MIN), 4)
    dof = []
    for car in CARRIAGES:
        lo, hi = allowed_x(car)
        d = car['z_dir']
        dof.append({
            'id': car['id'], 'zone': car['zone'],
            'node_x': car['body'].name, 'node_z': car['plate'].name,
            'node_yaw': car['yaw'].name,
            'home': [car['x0'], car['z0'], car['yaw_home']],
            'x_range_joint': [-DOF_X, DOF_X],
            'x_stroke_joint': stroke_joint,
            'x_workspace': [round(lo, 4), round(hi, 4)],
            'x_workspace_span': round(hi - lo, 4),
            'z_dir': d,
            'z_range_joint': [0.0, round(d * Z_STROKE, 6)] if d > 0
                             else [round(d * Z_STROKE, 6), 0.0],
            'z_stroke': Z_STROKE,
            'z_stop_closed': round(-d * (Z_STOP_CLOSED + 0.0011), 4),
            'z_stop_open': round(d * (Z_STOP_OPEN + 0.0011), 4),
            'z_workspace_eff': None,      # заполняется из pose_test (по X и yaw)
            'yaw_range_deg': [0.0, YAW_MAX],
            'yaw_step_deg': 15.0,
        })

    # --- межрельсовый коридор: габарит каретки по Z и запас ----------------
    # corridor_dir — сторона каретки, обращённая к соседнему рельсу пары.
    Vk, _Tk = _arrays([o for o in meshes if o.type == 'MESH'])
    HOMEk = {o.name: o.matrix_world.copy() for o in meshes if o.type == 'MESH'}
    env = {}
    for car in CARRIAGES:
        sg = 1.0 if car['z0'] > 0 else -1.0
        inner = abs(abs(car['z0']) - INNER_RAIL_Z) < 1e-6
        cdir = sg if inner else -sg
        e_in = e_out = 0.0
        for ang in [k * 15.0 for k in range(24)]:
            g = _pose_aabb(car, 0.0, 0.0, ang, Vk, HOMEk)
            e_in = max(e_in, (car['z0'] - g[4]) if cdir > 0 else (g[5] - car['z0']))
            e_out = max(e_out, (g[5] - car['z0']) if cdir > 0 else (car['z0'] - g[4]))
        env[car['id']] = {'rail_z': car['z0'],
                          'corridor_side': 'in' if inner else 'out',
                          'corridor_extent': round(e_in, 4),
                          'opposite_extent': round(e_out, 4),
                          'envelope_z': round(e_in + e_out, 4),
                          'z_dir': car['z_dir']}
    pairs = []
    for i, a in enumerate(CARRIAGES):
        for b in CARRIAGES[i + 1:]:
            if abs(abs(a['z0'] - b['z0']) - 0.1) > 1e-6:
                continue
            if (a['z0'] > 0) != (b['z0'] > 0):
                continue
            inner = a if abs(abs(a['z0']) - INNER_RAIL_Z) < 1e-6 else b
            outer = b if inner is a else a
            gap = 0.1 - env[inner['id']]['corridor_extent'] - \
                env[outer['id']]['corridor_extent']
            lo = max(allowed_x(inner)[0], allowed_x(outer)[0])
            hi = min(allowed_x(inner)[1], allowed_x(outer)[1])
            pairs.append({'pair': [inner['id'], outer['id']],
                          'pitch': 0.1, 'gap_at_dz0': round(gap, 4),
                          'gap_rule': GAP_Z,
                          'gap_ok': bool(gap >= GAP_Z),
                          'yaw_combos': 24 * 24,
                          'same_x_reachable': bool(lo <= hi),
                          'x_common': [round(lo, 4), round(hi, 4)] if lo <= hi
                                      else None,
                          'z_dir': [inner['z_dir'], outer['z_dir']]})
    min_gap = min(p['gap_at_dz0'] for p in pairs) if pairs else 0.0

    deviations = [
        'каретки c05/c06 перенесены с z ±0,44 на ±0,24: на наружных рельсах '
        'стоят 6 фиксированных гнёзд, каретка мимо них не проходит',
        'фиксированные гнёзда s01…s06: стойка-седло через наружный рельс, '
        'корпус гнезда 0,430…0,486 — за пределом вылета каретки (0,4246)',
        'обвязка: продольные балки −0,955…+0,955, торцевые −0,455…+0,455 '
        '+ угловые кубики 45³ (в спеке длины внахлёст — физически несовместимо)',
        'уровни: рама 0,195…0,240 (в спеке 0,205…0,250), рельс 0,240…0,285, '
        'каретка 0,2855…0,325, палец 0,372 (совпадает)',
        'ход X узла 1,790 м вместо 1,800: торцевые крышки рельса занимают 8 мм '
        'с каждого конца; рабочая зона — своя доля рельса (см. ниже)',
        'ход Z слайда 0,024 односторонний вместо симметричных ±0,045 (0,090): '
        'габарит каретки по Z 0,078 при шаге рельсов 0,100, межрельсовый '
        'коридор 0,022 — двусторонний ход физически невозможен; направление '
        'хода — от коридора (внутренний рельс к центру рамы, наружный к '
        'обвязке), поэтому габариты соседей только расходятся',
        'направляющая слайда 0,058 вместо 0,030 при прежнем ходе 0,090: на '
        'краю хода плита держалась на 4 мм; теперь 0,024 + плита 0,026 + запас',
        'упоры хода слайда — реальные тела на уровне плиты (закрытый −0,0162, '
        'открытый +0,0396): в прежней схеме сухари стояли под плитой и ход не '
        'ограничивали; проба за предел теперь упирается в тело',
        'рабочие зоны по X у кареток одного рельса не пересекаются (граница — '
        'середина между посадочными X): две каретки одного рельса не '
        'расходятся, иначе они въезжают друг в друга',
        'окно гнезда 48 × 32 (в спеке 34): 34 мм + рычаг не влезают в габарит 0,400',
        'рычаг сброса 40 мм (в спеке 70): два 70-мм рычага соседних гнёзд '
        'при шаге 0,100 не расходятся (2 × 0,077 > 0,100); заодно срезан '
        'вылет площадки рычага до 0,040 — иначе габарит каретки по Z рос',
        'ролик Ø14 × 8 вместо 608-2RS (Ø22): Ø22 не входит в паз 15',
        'перекрёстный замок — U-хомут на траверсе под рельсом, а не плоская '
        'пластина 45 × 45 × 8 (плоская подняла бы рельс выше 0,285)',
        'траверсы 0,195…0,240 (в спеке 0,205…0,245) — выровнены с обвязкой',
    ]
    rep = {
        'component': CID,
        'code': CODE,
        'label': 'Универсальная (Mk-II)',
        'variant_of': 'restraint_matrix',
        'prefix': PREFIX,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in (mn + mx) * 0.5],
        'bbox_target': '2,0 x 1,0 x 0,4 м',
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.002 and abs(size.y - 1.0) <= 0.002
                        and abs(size.z - 0.4) <= 0.002),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'carriages': [c['id'] for c in CARRIAGES],
        'carriage_count': len(CARRIAGES),
        'carriage_count_ok': len(CARRIAGES) == 8,
        'sockets': len(sockets),
        'sockets_ok': len(sockets) == 6,
        'rails_z': rail_z,
        'rails_pitch_ok': bool(all(abs(rail_z[i + 1] - rail_z[i] - 0.1) < 1e-6
                                   for i in range(2))
                               and all(abs(rail_z[i + 1] - rail_z[i] - 0.1) < 1e-6
                                       for i in range(3, 5))),
        'ties': len(ties),
        'crossings': len(locks),
        'crossings_ok': len(locks) == 18,
        'pin_y_carriages': pin_y,
        'pin_y_ok': bool(all(abs(v - PIN_Y) < 0.0005 for v in pin_y)),
        'pin_y_sockets': sock_pin_y,
        'pin_y_sockets_ok': bool(all(abs(v - PIN_Y) < 0.0005 for v in sock_pin_y)),
        'anchor_field': anchors,
        'anchor_ok': bool(sorted(round(a[0], 3) for a in anchors) ==
                          [-0.878, -0.878, 0.878, 0.878] and
                          sorted(round(a[1], 3) for a in anchors) ==
                          [-0.388, -0.388, 0.388, 0.388]),
        'materials': sorted(m.name for m in mats),
        'material_count': len(mats),
        'z_corridor': {
            'rail_pitch': 0.1,
            'z_stroke': Z_STROKE,
            'z_stop_closed': -Z_STOP_CLOSED - 0.0011,
            'z_stop_open': Z_STOP_OPEN - 0.0011,
            'envelope_by_carriage': env,
            'pairs': pairs,
            'min_gap_at_dz0': round(min_gap, 4),
            'rule': 'хода по Z у соседей пары направлены в противоположные '
                    'стороны от коридора: габарит расходится, зазор не '
                    'уменьшается ни при каком допустимом dz',
        },
        'z_corridor_ok': bool(min_gap >= GAP_Z and
                              all(p['gap_ok'] for p in pairs)),
        'dof': dof,
        'dof_joint_stroke_x': stroke_joint,
        'deviations': deviations,
        'parts': sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX) and o.type != 'MESH'),
    }
    return rep


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
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    return path


# --- рендеры --------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 1100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.30
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.45

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=9,
                                     location=(center.x, center.y, mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, off, energy, sz in (
            ('key', (1.60, -2.10, 2.20), 150.0, 1.70),
            ('fill', (-2.35, -1.75, 1.20), 55.0, 2.50),
            ('rim', (0.40, 2.35, 1.65), 90.0, 1.70)):
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
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

    def fit_dist(direction, lens, corners, margin=1.08):
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

    c_main = box_corners(mn - center, mx - center)
    c_car = box_corners(Vector((-0.400, 0.240, 0.240)) - Vector((-0.28, 0.34, 0.0)),
                        Vector((-0.160, 0.420, 0.410)) - Vector((-0.28, 0.34, 0.0)))

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
        ('3q', (0.78, -0.90, 0.46), center, 70, c_main, 0.93, True),
        ('front', (0.02, -1.00, 0.20), center, 70, c_main, 0.93, True),
        ('side', (1.00, -0.22, 0.24), center, 70, c_main, 0.93, True),
        ('top', (0.02, -0.10, 1.00), center, 70, c_main, 0.93, True),
        ('closeup', (0.62, -0.70, 0.62), Vector((-0.28, -0.34, 0.0)), 85,
         c_car, 0.94, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, refine in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(5 if refine else 0):
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
    import time
    t0 = time.time()
    build()
    # домашние углы поворота для экспорта/рендера
    for car in CARRIAGES:
        car['yaw'].rotation_euler = (0.0, 0.0,
                                     math.radians(car['yaw_home']))
    bpy.context.view_layer.update()

    rep = check(ALL_PARTS)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('EXPORTED', path, path.stat().st_size, flush=True)

    t1 = time.time()
    rep['pose_test'] = pose_test()
    rep['pose_test']['seconds'] = round(time.time() - t1, 1)
    # эффективная зона по Z (из проверки) -> в описание DOF
    for d in rep['dof']:
        zw = rep['pose_test']['z_workspace'].get(d['id'], [])
        d['z_workspace_eff'] = {
            'full_stroke_x': [w['x'] for w in zw
                              if abs(w['z_max'] - Z_STROKE) < 1e-6],
            'min_travel': min((w['z_max'] for w in zw), default=0.0),
            'by_x': zw,
        }
    rep['renders'] = render_views()
    rep['build_seconds'] = round(time.time() - t0, 1)

    pt = rep['pose_test']
    bt = pt['boundary']
    cf = pt['simultaneous']['counterfactual']
    boundary_ok = bool(bt['states'] > 0 and bt['detected'] == bt['states'])
    cf_ok = bool(cf['samples'] > 0 and cf.get('samples_hit', 0) == cf['samples'])
    rep['checks'] = {
        'pose_collisions': len(pt['collisions']),
        'simultaneous_collisions': len(pt['simultaneous']['collisions']),
        'simultaneous_samples': pt['simultaneous']['samples'],
        'boundary_states': bt['states'],
        'boundary_detected': bt['detected'],
        'boundary_ok': boundary_ok,
        'counterfactual_samples': cf['samples'],
        'counterfactual_hit': cf.get('samples_hit', 0),
        'counterfactual_push': cf.get('push_into_corridor'),
        'counterfactual_ok': cf_ok,
        'selftest_ok': bool(pt['detector_selftest'].get('ok')),
        'z_corridor_ok': rep['z_corridor_ok'],
        'min_corridor_gap': rep['z_corridor']['min_gap_at_dz0'],
        'corridor_yaw_combos': sum(p['yaw_combos'] for p in
                                   rep['z_corridor']['pairs']),
        'x_pair_gap_rule': PAIR_GAP_X,
        'adjacent_pairs_total': pt['simultaneous'].get('adjacent_pairs_total'),
        'adjacent_pairs_same_x': pt['simultaneous'].get(
            'adjacent_pairs_same_x_reachable'),
        'adjacent_pairs_partitioned': pt['simultaneous'].get(
            'adjacent_pairs_same_x_blocked_by_partition'),
    }
    ok = (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['carriage_count_ok']
          and rep['sockets_ok'] and rep['crossings_ok'] and rep['pin_y_ok']
          and rep['pin_y_sockets_ok'] and rep['anchor_ok']
          and rep['material_count'] >= 6 and rep['glb_bytes'] > 10000
          and not pt['collisions'] and not pt['simultaneous']['collisions']
          and bool(pt['detector_selftest'].get('ok'))
          and boundary_ok and cf_ok and rep['z_corridor_ok']
          and not rep['bad_names'])
    rep['all_checks_pass'] = bool(ok)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT_OK', json.dumps({k: rep[k] for k in
                                   ('bbox_size', 'nodes', 'carriage_count',
                                    'sockets', 'crossings', 'material_count',
                                    'all_checks_pass')}, ensure_ascii=False),
          flush=True)
    if not ok:
        raise SystemExit('checks failed')


if __name__ == '__main__':
    main()
