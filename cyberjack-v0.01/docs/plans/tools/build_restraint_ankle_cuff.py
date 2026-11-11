"""Standalone builder: restraint_ankle_cuff (RST-AN-02, «Манжета стопы»).

Мягкая регулируемая манжета щиколотки/стопы: широкий графитовый нейлоновый
ремень 80x30 мм с молочной окантовкой, толстая силиконовая подкладка с
поперечными валиками и ахилловым каналом (два мягких валика по бокам от
сухожилия), стальная пряжка-кам с рычагом быстросъёма, боковой
быстросъёмный флажок, D-полукольцо на тканевой петле, стальной
ограничитель длины со стопором и маркировка размера M.
Плиты-основания нет: манжета стоит на собственном ремне.

Не зависит от build_component_library.py / build_restraint_wrist_cuff.py.
Визуальный язык — как у restraint_wrist_cuff (тот же нейлон/молочная
окантовка/розовый силикон/сталь/графит).

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_ankle_cuff.py

Выход:
  public/models/machine-modules/components/restraint_ankle_cuff.glb
  docs/plans/blockout/component-library/restraint_ankle_cuff/*.png
  docs/plans/blockout/component-library/restraint_ankle_cuff/report.json

Геометрия (Blender Z-up, метры):
  ось манжеты (= ось голени) = Y, центр кольца в (0, 0, CZ)
  разъём, замок, пряжка и D-ring направлены в +X
  z_bottom = 0 -> ремень стоит на полу, манжета лежит на боку, как надевается
  вращения нет (motion: none), анимационная пустышка не нужна.

Габарит по паспорту 0,10 x 0,08 x 0,03 м (оси паспорта: длина с застёжкой,
наружный диаметр, ширина ремня):
  X = диаметр + пряжка + D-ring, Z = наружный диаметр, Y = ширина ремня.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_ankle_cuff'
CID = 'restraint_ankle_cuff'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
R_OUT = 0.0400          # наружный радиус ремня -> диаметр 80 мм (паспорт)
HALF_W = 0.0150         # половина ширины ремня -> 30 мм
CZ = R_OUT              # центр кольца: нижняя точка ремня на z=0

R_WEB_IN = 0.0380       # нейлон 2,0 мм
R_PAD = 0.0340          # силиконовая подкладка 4,0 мм
R_ROLL = 0.0336         # ось поперечных валиков подкладки
ROLL_R = 0.0019         # радиус валика -> выступ 2,3 мм внутрь

A_GAP = math.radians(23.0)          # разъём: -23°..+23° (46°, хорда 31 мм)
A_TONGUE_A = math.radians(23.0)     # лента начинается у конца ремня
A_TONGUE_B = math.radians(-54.0)    # свободный конец ленты
R_T_IN = 0.0404
R_T_OUT = 0.0416

A_BUCKLE = math.radians(2.0)
R_BUCKLE = 0.0444
A_ROLLER = math.radians(5.0)
R_ROLLER = 0.0424
ROLLER_R = 0.0040
A_LEVER0 = math.radians(9.5)        # ось рычага у валика
A_LEVER1 = math.radians(-3.5)       # поднятый носок рычага
R_LEVER0 = 0.0476
R_LEVER1 = 0.0516
A_CATCH = math.radians(2.5)
A_COLLAR = math.radians(19.5)
A_STOP = math.radians(-53.0)

A_DRING = math.radians(-30.0)
R_DRING_BAR = 0.0518        # прямая полка D-полукольца над петлёй
DRING_BAR_HALF = 0.0118     # половина длины полки -> 24 мм
DRING_ARC = 0.0118          # радиус полуокружности
DRING_TUBE = 0.0027

A_ACH0, A_ACH1 = math.radians(60.0), math.radians(120.0)   # ахиллов канал
A_ROLL0 = A_GAP + math.radians(3.0)
A_ROLL1 = math.radians(58.0)

PALETTE = {
    'graphite': (0.082, 0.086, 0.096),
    'milk': (0.880, 0.866, 0.836),
    'blush': (0.870, 0.560, 0.600),
    'silicone': (0.912, 0.700, 0.716),
    'steel': (0.600, 0.610, 0.625),
    'dark': (0.028, 0.030, 0.036),
    'cream': (0.940, 0.925, 0.888),
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
    if role == 'steel':
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.28
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.35
        bsdf.inputs['Roughness'].default_value = 0.42
    elif role == 'blush':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.42
    elif role == 'silicone':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.55
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.78
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.82
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


def bevel(obj, width=0.0010, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(35)
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


def cyl(name, a, b, radius, role, vertices=24, smooth=True, r2=None, bev=0.0):
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
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


# --- геометрия кольца вокруг оси Y ---------------------------------------
def d3(a):
    """Направление в плоскости кольца (XZ): a=0 -> +X, a=90° -> +Z."""
    return Vector((math.cos(a), 0.0, math.sin(a)))


def t3(a):
    """Касательная в плоскости кольца."""
    return Vector((-math.sin(a), 0.0, math.cos(a)))


def p3(a, r, y=0.0):
    d = d3(a)
    return Vector((d.x * r, y, CZ + d.z * r))


def plate(name, a, r, su, sv, st, role, tilt=0.0, y=0.0, bev=0.0008,
          smooth=False):
    """Пластина на кольце: su - вдоль обхвата, sv - по ширине, st - по радиусу."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=p3(a, r, y))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (su, sv, st)
    obj.rotation_euler = (tilt, a + math.pi / 2, 0.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if bev > 0:
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def lever(name, a0, a1, r0, r1, hs0, hs1, thick, role, bev=0.0010):
    """Клин-рычаг: от (a0,r0) к (a1,r1), ширина hs0 -> hs1, толщина по радиусу."""
    bm = bmesh.new()
    vs = []
    for a, r, hs in ((a0, r0, hs0), (a1, r1, hs1)):
        for dr in (0.0, thick):
            for y in (-hs, hs):
                vs.append(bm.verts.new(p3(a, r + dr, y)))
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4),
              (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)):
        bm.faces.new([vs[i] for i in f])
    obj = mesh_from_bm(name, bm, role, False)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


def arc_band(name, r_in, r_out, y0, y1, a0, a1, seg, role, smooth=True,
             bevel_w=0.0):
    """Сектор кольца вокруг оси Y (ремень, подкладка, лента)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        d = d3(a)
        ring = []
        for y, r in ((y0, r_in), (y0, r_out), (y1, r_out), (y1, r_in)):
            ring.append(bm.verts.new((d.x * r, y, CZ + d.z * r)))
        rings.append(ring)
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((a_[k], a_[k2], b_[k2], b_[k]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, smooth)
    if bevel_w > 0:
        bevel(obj, bevel_w, 2)
    return obj


def arc_tube_bm(bm, rc, y, rt, a0, a1, seg_a=44, seg_c=10, taper=0.0):
    """Труба по дуге кольца: валик подкладки / мягкая кромка."""
    rings = []
    for i in range(seg_a + 1):
        u = i / seg_a
        a = a0 + (a1 - a0) * u
        rr = rt * (1.0 - taper * (1.0 - math.sin(math.pi * u)))
        c = p3(a, rc, y)
        e1, e2 = d3(a), Vector((0.0, 1.0, 0.0))
        rings.append([bm.verts.new(c + e1 * (rr * math.cos(math.tau * k / seg_c))
                                   + e2 * (rr * math.sin(math.tau * k / seg_c)))
                      for k in range(seg_c)])
    for i in range(seg_a):
        A, B = rings[i], rings[i + 1]
        for k in range(seg_c):
            k2 = (k + 1) % seg_c
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def rect_ring(name, center, u, v, w, su, sv, bar, thick, role, bev=0.0007):
    """Прямоугольная рамка: u,v - плоскость окна, w - толщина."""
    center = Vector(center)
    u, v, w = (Vector(x).normalized() for x in (u, v, w))
    bm = bmesh.new()
    lo, hi = [], []
    for sgn_w, store in ((-0.5, lo), (0.5, hi)):
        for layer in (0, 1):
            su2 = su * 0.5 if layer == 0 else su * 0.5 - bar
            sv2 = sv * 0.5 if layer == 0 else sv * 0.5 - bar
            quad = []
            for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
                p = (center + u * (sx * su2) + v * (sy * sv2)
                     + w * (sgn_w * thick))
                quad.append(bm.verts.new(p))
            store.append(quad)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((lo[0][i], lo[0][j], lo[1][j], lo[1][i]))
        bm.faces.new((lo[0][i], hi[0][i], hi[0][j], lo[0][j]))
        bm.faces.new((lo[1][i], lo[1][j], hi[1][j], hi[1][i]))
        bm.faces.new((hi[0][i], hi[0][j], hi[1][j], hi[1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, False)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


def tube_path(name, pts, normal, rt, role, seg=10, smooth=True):
    """Труба по замкнутому плоскому контуру (D-полукольцо)."""
    N = Vector(normal).normalized()
    pts = [Vector(p) for p in pts]
    n = len(pts)
    bm = bmesh.new()
    rings = []
    for i in range(n):
        t = pts[(i + 1) % n] - pts[(i - 1) % n]
        if t.length < 1e-9:
            t = Vector((1.0, 0.0, 0.0))
        t.normalize()
        n1 = t.cross(N)
        if n1.length < 1e-6:
            n1 = t.cross(Vector((0.0, 0.0, 1.0)))
        n1.normalize()
        n2 = n1.cross(t).normalized()
        rings.append([bm.verts.new(pts[i] + n1 * (rt * math.cos(math.tau * k / seg))
                                   + n2 * (rt * math.sin(math.tau * k / seg)))
                      for k in range(seg)])
    for i in range(n):
        A, B = rings[i], rings[(i + 1) % n]
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    return mesh_from_bm(name, bm, role, smooth)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    # ---- ремень --------------------------------------------------------
    parts.append(arc_band(PREFIX + 'band', R_WEB_IN, R_OUT, -HALF_W, HALF_W,
                          A_GAP, math.tau - A_GAP, 72, 'graphite',
                          bevel_w=0.0006))

    # молочная окантовка по обеим наружным кромкам ремня (обшивка)
    for tag, y0, y1 in (('hi', HALF_W - 0.0018, HALF_W + 0.0002),
                        ('lo', -HALF_W - 0.0002, -HALF_W + 0.0018)):
        parts.append(arc_band(PREFIX + f'band_bind_{tag}', R_WEB_IN - 0.0002,
                              R_OUT + 0.0002, y0, y1, A_GAP + 0.004,
                              math.tau - A_GAP - 0.004, 64, 'milk'))
    # обшитые торцы ремня у разъёма
    for tag, a0, a1 in (('a', A_GAP - 0.004, A_GAP + 0.020),
                        ('b', math.tau - A_GAP - 0.020,
                         math.tau - A_GAP + 0.004)):
        parts.append(arc_band(PREFIX + f'band_end_{tag}', R_WEB_IN - 0.0003,
                              R_OUT + 0.0003, -HALF_W - 0.0003,
                              HALF_W + 0.0003, a0, a1, 6, 'milk',
                              bevel_w=0.0004))
    # два шва по наружной стороне ремня (строчка)
    for tag, y in (('hi', 0.0105), ('lo', -0.0105)):
        bm = bmesh.new()
        arc_tube_bm(bm, R_OUT + 0.0001, y, 0.0005, A_GAP + 0.030,
                    math.tau - A_GAP - 0.030, 56, 8)
        parts.append(mesh_from_bm(PREFIX + f'band_seam_{tag}', bm, 'dark'))

    # ---- толстая силиконовая подкладка ---------------------------------
    parts.append(arc_band(PREFIX + 'lining', R_PAD, R_WEB_IN + 0.0004,
                          -HALF_W + 0.0012, HALF_W - 0.0012,
                          A_GAP + 0.022, math.tau - A_GAP - 0.022, 72,
                          'blush', bevel_w=0.0008))
    # мягкие скруглённые кромки подкладки
    bm = bmesh.new()
    for y in (HALF_W - 0.0028, -HALF_W + 0.0028):
        arc_tube_bm(bm, R_PAD - 0.0002, y, 0.0017, A_GAP + 0.040,
                    math.tau - A_GAP - 0.040, 56, 10, taper=0.35)
    parts.append(mesh_from_bm(PREFIX + 'lining_edges', bm, 'silicone'))

    # поперечные валики по всему обхвату, кроме ахилловой зоны
    bm = bmesh.new()
    for y in (-0.0104, -0.0052, 0.0, 0.0052, 0.0104):
        for a0, a1 in ((A_ROLL0, A_ACH0),
                       (A_ACH1, math.tau - A_ROLL0)):
            arc_tube_bm(bm, R_ROLL, y, ROLL_R, a0, a1, 46, 10, taper=0.45)
    parts.append(mesh_from_bm(PREFIX + 'pad_rolls', bm, 'silicone'))

    # ахиллов канал: два мягких валика по бокам от сухожилия
    bm = bmesh.new()
    for y in (0.0088, -0.0088):
        arc_tube_bm(bm, 0.0331, y, 0.0033, A_ACH0, A_ACH1, 26, 12, taper=0.60)
    parts.append(mesh_from_bm(PREFIX + 'pad_bolsters', bm, 'silicone'))

    # ---- регулировочная лента (молочный нейлон) ------------------------
    parts.append(arc_band(PREFIX + 'tongue', R_T_IN, R_T_OUT + 0.0010,
                          -0.0128, 0.0128, A_TONGUE_B,
                          A_TONGUE_A, 52, 'milk', bevel_w=0.0006))
    # подшитые кромки ленты
    bm = bmesh.new()
    for y in (0.0110, -0.0110):
        arc_tube_bm(bm, R_T_OUT + 0.0002, y, 0.0007, A_TONGUE_B + 0.020,
                    A_TONGUE_A - 0.020, 48, 8)
    parts.append(mesh_from_bm(PREFIX + 'tongue_hems', bm, 'milk'))
    # утолщённый кончик ленты
    parts.append(arc_band(PREFIX + 'tongue_tip', R_T_IN, R_T_OUT - 0.0002,
                          -0.0122, 0.0122, A_TONGUE_B, A_TONGUE_B + 0.055,
                          8, 'milk', bevel_w=0.0008))

    # ---- маркировка размера M на ремне ---------------------------------
    a_tag = math.radians(58.0)
    parts.append(arc_band(PREFIX + 'size_patch', R_OUT + 0.0001,
                          R_OUT + 0.0009, -0.0056, 0.0056,
                          a_tag - math.radians(9.5), a_tag + math.radians(9.5),
                          16, 'cream', bevel_w=0.0004))
    bm = bmesh.new()
    for i, da in enumerate((-4.2, 0.0, 4.2)):
        a0 = a_tag + math.radians(da - 1.1)
        a1 = a_tag + math.radians(da + 1.1)
        arc_tube_bm(bm, R_OUT + 0.0011, 0.0, 0.0009, a0, a1, 4, 8)
    parts.append(mesh_from_bm(PREFIX + 'size_ticks', bm, 'graphite'))

    # ---- пряжка-кам + рычаг быстросъёма --------------------------------
    u_b, v_b, w_b = t3(A_BUCKLE), Vector((0, 1, 0)), d3(A_BUCKLE)
    parts.append(rect_ring(PREFIX + 'buckle_frame', p3(A_BUCKLE, R_BUCKLE),
                            u_b, v_b, w_b, 0.0205, 0.0318, 0.0052, 0.0028,
                            'steel', bev=0.0007))
    # прижимной валик-кулачок в окне рамки
    parts.append(cyl(PREFIX + 'buckle_roller',
                     p3(A_ROLLER, R_ROLLER, -0.0143),
                     p3(A_ROLLER, R_ROLLER, 0.0143), ROLLER_R, 'steel',
                     vertices=24, bev=0.0005))
    # ось рычага на валике
    parts.append(cyl(PREFIX + 'buckle_pin',
                     p3(A_LEVER0, 0.0450, -0.0124),
                     p3(A_LEVER0, 0.0450, 0.0124), 0.0012, 'steel',
                     vertices=12))
    # рычаг: сужается к поднятому носку, лежит вдоль ленты
    parts.append(lever(PREFIX + 'qr_lever', A_LEVER0, A_LEVER1, R_LEVER0,
                       R_LEVER1, 0.0102, 0.0060, 0.0032, 'dark', bev=0.0010))
    # боковой быстросъёмный флажок-защёлка на ребре рамки
    parts.append(plate(PREFIX + 'qr_catch', A_CATCH, 0.0450, 0.0092, 0.0036,
                       0.0074, 'dark', y=0.0158, bev=0.0009))
    parts.append(cyl(PREFIX + 'qr_catch_pin',
                     p3(A_CATCH, 0.0458, 0.0136),
                     p3(A_CATCH, 0.0458, 0.0176), 0.0013, 'steel',
                     vertices=10))

    # ---- тканевая петля и D-полукольцо ---------------------------------
    # тканевый хомут-петля, охватывающий полку полукольца
    parts.append(plate(PREFIX + 'dring_loop', A_DRING, 0.0462, 0.0078, 0.0146,
                       0.0048, 'milk', bev=0.0009))
    parts.append(cyl(PREFIX + 'dring_loop_seam',
                     p3(A_DRING, 0.0506, -0.0068),
                     p3(A_DRING, 0.0506, 0.0068), 0.0007, 'dark',
                     vertices=8))

    # D-полукольцо: прямая полка в петле + полуокружность наружу
    base = p3(A_DRING, R_DRING_BAR, 0.0)
    e_out, e_side = d3(A_DRING), t3(A_DRING)
    path = []
    n_arc = 28
    for i in range(n_arc + 1):
        ang = math.pi / 2 - math.pi * i / n_arc          # +90° -> -90°
        path.append(base + e_out * (DRING_ARC * math.cos(ang))
                    + e_side * (DRING_BAR_HALF * math.sin(ang)))
    for i in range(1, 5):
        path.append(base + e_side * (DRING_BAR_HALF * (1.0 - 2.0 * i / 5.0)))
    parts.append(tube_path(PREFIX + 'dring', path, e_side, DRING_TUBE,
                           'steel', seg=12))

    # ---- ограничитель длины --------------------------------------------
    # стальной хомут-слайдер на ленте у входа в пряжку + винт
    parts.append(arc_band(PREFIX + 'limit_collar', R_T_IN - 0.0004,
                          R_T_OUT + 0.0026, -0.0146, 0.0146,
                          A_COLLAR - 0.050, A_COLLAR + 0.050, 10, 'steel',
                          bevel_w=0.0005))
    parts.append(cyl(PREFIX + 'limit_screw',
                     p3(A_COLLAR, 0.0400, -0.0090),
                     p3(A_COLLAR, 0.0454, -0.0090), 0.0017, 'steel',
                     vertices=12, bev=0.0004))
    # стальной наконечник-стопор на конце ленты: не даёт вытянуть ленту
    parts.append(plate(PREFIX + 'limit_stop', A_STOP, 0.0418,
                       0.0062, 0.0262, 0.0038, 'steel', bev=0.0012))

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
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn

    rep = {
        'component': CID,
        'code': 'RST-AN-02',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_target_passport': [0.10, 0.08, 0.03],
        'bbox_axes_note': 'X=длина с застёжкой, Z=наружный диаметр, Y=ширина',
        'bbox_ok': bool(size.x <= 0.112 and size.y <= 0.036
                        and size.z <= 0.086 and mn.z > -0.002),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'bore_axis': 'Y',
        'bore_axis_z': round(CZ, 5),
        'bore_clear_diameter_mm': round(2 * (R_ROLL - ROLL_R) * 1000, 1),
        'cuff_width_mm': round(2 * HALF_W * 1000, 1),
        'outer_diameter_mm': round(2 * R_OUT * 1000, 1),
        'gap_deg': round(2 * math.degrees(A_GAP), 1),
        'achilles_channel_mm': round(2 * (0.0078 - 0.0030) * 1000, 1),
        'lining_thickness_mm': round((R_WEB_IN - R_PAD) * 1000, 1),
        'dring_width_mm': round(2 * (DRING_BAR_HALF + DRING_TUBE) * 1000, 1),
        'materials': sorted(m.name for m in bpy.data.materials if m.users),
        'material_count': len([m for m in bpy.data.materials if m.users]),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
        'plate': False,
    }
    return rep


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objects:
        o['component'] = CID
        o['motion'] = 'none'
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').split('_')[0]
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
    scene.view_settings.exposure = 0.0
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

    bpy.ops.mesh.primitive_plane_add(size=4,
                                     location=(center.x, center.y, mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.32, -0.34, 0.32), 1.75, 0.34),
            ('fill', (-0.34, -0.26, 0.18), 0.65, 0.46),
            ('rim', (0.06, 0.34, 0.28), 1.05, 0.38)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.85))
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
    # крупный план: пряжка, рычаг, флажок, петля и D-ring
    close_t = Vector((0.0360, 0.0, 0.0230))
    c_close = box_corners(Vector((0.0100, -0.0215, CZ - 0.0400)) - close_t,
                          Vector((0.0640, 0.0215, CZ + 0.0110)) - close_t)

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
        ('3q', (0.82, 0.54, 0.42), center, 70, c_main, 0.90),
        ('front', (0.12, -1.00, 0.20), center, 70, c_main, 0.90),
        ('side', (1.00, -0.10, 0.12), center, 70, c_main, 0.90),
        ('closeup', (0.74, -0.56, 0.34), close_t, 80, c_close, 0.94),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4):
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
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
