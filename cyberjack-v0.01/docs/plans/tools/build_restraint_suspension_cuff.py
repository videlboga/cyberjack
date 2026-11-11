"""Standalone builder: restraint_suspension_cuff (RST-SU-09, «Подвесная манжета»).

Широкая мягкая манжета для подвеса: графитовый нейлоновый ремень 50 мм с
молочной обшивкой усиленных кромок, силиконовая подкладка с поперечными
валиками, стальное подвесное кольцо, продетое в сложенную и прошитую петлю
стропы (стропа пришита к ремню), быстросъёмная пряжка-кам с рычагом на
разъёме, регулировочный слайдер со свободным концом ленты, жёлтая метка
нагрузки и датчик натяжения с индикатором на стропе. Вторая страховка —
малая D-петля на ремне. Плиты-основания нет: манжета стоит на собственном
ремне.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_suspension_cuff.py

Выход:
  public/models/machine-modules/components/restraint_suspension_cuff.glb
  docs/plans/blockout/component-library/restraint_suspension_cuff/*.png
  docs/plans/blockout/component-library/restraint_suspension_cuff/report.json

Геометрия (Blender Z-up, метры):
  ось манжеты (= ось руки/бедра) = Y, центр кольца в (0, 0, CZ)
  кольцо и стропа  = плоскость XZ, вверх (+Z); разъём и пряжка = +X
  z_bottom = 0 -> ремень стоит на полу
  вращения нет (motion: none), анимационная пустышка не нужна.

Габарит по паспорту 0,10 x 0,08 x 0,05 м (оси паспорта: высота подвеса с
кольцом, диаметр с пряжкой, ширина ремня):
  Z = 0.10 (ремень + стропа + кольцо), X = 0.08 (диаметр + пряжка),
  Y = 0.05 (ширина манжеты).
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_suspension_cuff'
CID = 'restraint_suspension_cuff'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
R_OUT = 0.0350          # наружный радиус ремня -> диаметр 70 мм
R_WEB_IN = 0.0326       # нейлон 2,4 мм
R_PAD = 0.0294          # силиконовая подкладка 3,2 мм
R_RIB = 0.0284          # поперечные валики подкладки (+1,0 мм внутрь)
HALF_W = 0.0250         # половина ширины ремня -> 50 мм (широкая манжета)
CZ = R_OUT              # центр манжеты: низ ремня на z = 0
BAND_TOP = CZ + R_OUT   # 0.0700

A_GAP = math.radians(23.0)      # разъём: -23°..+23° (46°), направлен в +X
A_TONGUE_A = math.radians(27.0)     # лента уходит под ремень
A_TONGUE_B = math.radians(-34.0)    # свободный конец ленты
R_TONGUE_IN = R_OUT + 0.0002
R_TONGUE_OUT = R_OUT + 0.0024
TONGUE_HALF_Y = 0.0200

R_BUCKLE = R_TONGUE_OUT + 0.0010
A_ROLLER = math.radians(9.0)
A_LABEL = math.radians(45.0)

# --- стропа подвеса + кольцо --------------------------------------------
TT = 0.0038             # толщина стропы
TAPE_CX = 0.0051        # смещение ветвей петли от оси
FOLD_R_IN = 0.0034      # внутренний радиус перегиба = зазор под кольцо
FOLD_R_OUT = 0.0068
STRAP_Z0 = 0.0655
FOLD_CZ = 0.0735        # центр перегиба
STRAP_HALF_Y = 0.0115   # ширина стропы 23 мм
RING_CZ = 0.0855
RING_MAJOR = 0.0098
RING_MINOR = 0.0030
RING_SX, RING_SZ = 0.90, 1.12
RING_TOP = RING_CZ + RING_MAJOR * RING_SZ + RING_MINOR

A_ANCHOR = math.radians(-52.0)   # вторая страховка на ремне

PALETTE = {
    'graphite': (0.075, 0.079, 0.090),
    'milk': (0.760, 0.748, 0.720),
    'blush': (0.855, 0.545, 0.585),
    'steel': (0.580, 0.590, 0.605),
    'dark': (0.022, 0.024, 0.030),
    'cream': (0.930, 0.915, 0.875),
    'yellow': (0.900, 0.700, 0.090),
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
        bsdf.inputs['Roughness'].default_value = 0.26
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.30
        bsdf.inputs['Roughness'].default_value = 0.38
    elif role == 'blush':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.40
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.74
    elif role == 'yellow':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.55
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.84
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


def cube(name, loc, size, role, r=0.0008, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


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


def ring_oval(name, center, normal, major, minor, role, sx=1.0, sz=1.0,
              segs=48, rings=12):
    """Тор вокруг normal; sx/sz — овализация в плоскости кольца."""
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=center)
    obj = bpy.context.object
    obj.name = name
    q = Vector(normal).normalized().to_track_quat('Z', 'Y')
    obj.rotation_euler = q.to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    obj.scale = (sx, 1.0, sz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


def curve_tube(name, points, radius, role, res=6, caps=True):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 10
    cu.use_fill_caps = caps
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


# --- геометрия вокруг оси Y ----------------------------------------------
def d3(a):
    """Направление в плоскости кольца (XZ): a=0 -> +X, a=90° -> +Z."""
    return Vector((math.cos(a), 0.0, math.sin(a)))


def t3(a):
    """Касательная к кольцу."""
    return Vector((-math.sin(a), 0.0, math.cos(a)))


def p3(a, r, y=0.0, cz=None):
    d = d3(a)
    z0 = CZ if cz is None else cz
    return Vector((d.x * r, y, z0 + d.z * r))


def plate_tangent(name, a, r, size_t, size_y, size_r, role, bev=0.0004):
    """Пластина на поверхности ремня: тонкая ось смотрит наружу по d3(a)."""
    return cube(name, p3(a, r), (size_t, size_y, size_r), role, r=bev,
                rot=(0, math.pi / 2 - a, 0))


def arc_band(name, r_in, r_out, y0, y1, a0, a1, seg, role, smooth=True,
             bevel_w=0.0, cz=None):
    """Сектор кольца вокруг оси Y (ремень, подкладка, валики, петля)."""
    z0 = CZ if cz is None else cz
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        d = d3(a)
        ring = []
        for y, r in ((y0, r_in), (y0, r_out), (y1, r_out), (y1, r_in)):
            ring.append(bm.verts.new((d.x * r, y, z0 + d.z * r)))
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


def rect_ring(name, center, u, v, w, su, sv, bar, thick, role, bev=0.0006):
    """Прямоугольная рамка: u,v — плоскость окна, w — нормаль (толщина)."""
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


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    # ---- ремень: нейлон, обшитые усиленные кромки -----------------------
    parts.append(arc_band(PREFIX + 'band', R_WEB_IN, R_OUT, -HALF_W, HALF_W,
                          A_GAP, math.tau - A_GAP, 72, 'graphite',
                          bevel_w=0.0007))
    for tag, y0, y1 in (('a', HALF_W - 0.0012, HALF_W + 0.0004),
                        ('b', -HALF_W - 0.0004, -HALF_W + 0.0012)):
        parts.append(arc_band(PREFIX + f'band_bind_{tag}', R_WEB_IN - 0.0003,
                              R_OUT + 0.0004, y0, y1,
                              A_GAP + 0.010, math.tau - A_GAP - 0.010, 64,
                              'milk', bevel_w=0.0005))
    # обшитые торцы ремня у разъёма
    for tag, a0, a1 in (('a', A_GAP - 0.006, A_GAP + 0.022),
                        ('b', math.tau - A_GAP - 0.022, math.tau - A_GAP + 0.006)):
        parts.append(arc_band(PREFIX + f'band_end_{tag}', R_WEB_IN - 0.0004,
                              R_OUT + 0.0006, -HALF_W - 0.0006,
                              HALF_W + 0.0006, a0, a1, 6, 'milk',
                              bevel_w=0.0005))
    # две строчки по наружной стороне ремня
    for tag, y in (('a', 0.0192), ('b', -0.0192)):
        parts.append(arc_band(PREFIX + f'band_seam_{tag}', R_OUT - 0.0002,
                              R_OUT + 0.0004, y - 0.0005, y + 0.0005,
                              A_GAP + 0.06, math.tau - A_GAP - 0.06, 64,
                              'milk', bevel_w=0.0002))

    # ---- силиконовая подкладка -----------------------------------------
    parts.append(arc_band(PREFIX + 'lining', R_PAD, R_WEB_IN + 0.0005,
                          -HALF_W + 0.0012, HALF_W - 0.0012,
                          A_GAP + 0.024, math.tau - A_GAP - 0.024, 72,
                          'blush', bevel_w=0.0008))
    for i, y in enumerate((-0.0115, 0.0, 0.0115)):
        parts.append(arc_band(PREFIX + f'pad_rib_{"abc"[i]}', R_RIB,
                              R_PAD + 0.0006, y - 0.0014, y + 0.0014,
                              math.radians(29.0), math.radians(331.0), 64,
                              'blush'))
    # скруглённые кромки подкладки
    for tag, y in (('a', HALF_W - 0.0022), ('b', -HALF_W + 0.0022)):
        pts = [p3(math.radians(25.0) + math.radians(310.0) * i / 12.0,
                  0.0272, y) for i in range(13)]
        parts.append(curve_tube(PREFIX + f'lining_roll_{tag}', pts, 0.0013,
                                'blush'))

    # ---- регулировочная лента и свободный конец ------------------------
    parts.append(arc_band(PREFIX + 'tongue', R_TONGUE_IN, R_TONGUE_OUT,
                          -TONGUE_HALF_Y, TONGUE_HALF_Y, A_TONGUE_B,
                          A_TONGUE_A, 40, 'milk', bevel_w=0.0005))
    for tag, yy in (('a', TONGUE_HALF_Y - 0.0016),
                    ('b', -TONGUE_HALF_Y + 0.0016)):
        pts = [p3(A_TONGUE_B + 0.012 + (A_TONGUE_A - A_TONGUE_B - 0.026)
                  * i / 14.0, R_TONGUE_OUT + 0.0001, yy) for i in range(15)]
        parts.append(curve_tube(PREFIX + f'tongue_hem_{tag}', pts, 0.0006,
                                'milk'))
    # две строчки по ленте (читается как прошитая стропа)
    for tag, yy in (('a', 0.0132), ('b', -0.0132)):
        pts = [p3(A_TONGUE_B + 0.020 + (A_TONGUE_A - A_TONGUE_B - 0.034)
                  * i / 14.0, R_TONGUE_OUT + 0.0002, yy) for i in range(15)]
        parts.append(curve_tube(PREFIX + f'tongue_stitch_{tag}', pts, 0.00045,
                                'dark'))
    parts.append(arc_band(PREFIX + 'tongue_tip', R_TONGUE_IN,
                          R_TONGUE_OUT - 0.0004, -TONGUE_HALF_Y + 0.0010,
                          TONGUE_HALF_Y - 0.0010, A_TONGUE_B,
                          A_TONGUE_B + 0.050, 8, 'milk', bevel_w=0.0006))

    # ---- маркировка нагрузки: жёлтая метка (по поверхности) ------------
    parts.append(arc_band(PREFIX + 'load_label', R_OUT + 0.0001,
                          R_OUT + 0.0014, -0.0122, 0.0122,
                          A_LABEL - 0.175, A_LABEL + 0.175, 10, 'yellow',
                          bevel_w=0.0003))
    for i, dy in enumerate((0.0064, 0.0, -0.0064)):
        parts.append(arc_band(PREFIX + f'label_line_{"abc"[i]}',
                              R_OUT + 0.0013, R_OUT + 0.0019, dy - 0.0008,
                              dy + 0.0008, A_LABEL - 0.112, A_LABEL + 0.112,
                              8, 'dark', bevel_w=0.0001))

    # ---- быстросъёмная пряжка-кам на разъёме ----------------------------
    parts.append(rect_ring(PREFIX + 'buckle_frame', p3(0.0, R_BUCKLE),
                            t3(0.0), Vector((0, 1, 0)), d3(0.0),
                            0.0168, 0.0432, 0.0026, 0.0013, 'steel',
                            bev=0.0005))
    parts.append(cyl(PREFIX + 'buckle_roller',
                     p3(A_ROLLER, R_TONGUE_OUT + 0.0010, -0.0182),
                     p3(A_ROLLER, R_TONGUE_OUT + 0.0010, 0.0182), 0.0026,
                     'steel', vertices=22, bev=0.0004))
    parts.append(cyl(PREFIX + 'buckle_axle',
                     p3(A_ROLLER, R_TONGUE_OUT + 0.0010, -0.0196),
                     p3(A_ROLLER, R_TONGUE_OUT + 0.0010, 0.0196), 0.0010,
                     'dark', vertices=10))
    parts.append(plate_tangent(PREFIX + 'qr_lever', math.radians(-7.0),
                               R_BUCKLE + 0.0020, 0.0126, 0.0176, 0.0020,
                               'dark', bev=0.0008))
    parts.append(plate_tangent(PREFIX + 'qr_lever_tip', math.radians(-16.0),
                               R_BUCKLE + 0.0038, 0.0080, 0.0154, 0.0018,
                               'dark', bev=0.0008))
    # регулировочный слайдер на ленте
    a_sl = math.radians(-27.0)
    parts.append(rect_ring(PREFIX + 'adjust_slider',
                            p3(a_sl, R_TONGUE_OUT + 0.0012),
                            t3(a_sl), Vector((0, 1, 0)), d3(a_sl),
                            0.0052, 0.0386, 0.0014, 0.0014, 'steel',
                            bev=0.0004))
    parts.append(cyl(PREFIX + 'adjust_screw',
                     p3(a_sl + 0.052, R_TONGUE_OUT + 0.0012, -0.0118),
                     p3(a_sl + 0.052, R_TONGUE_OUT + 0.0012, 0.0118),
                     0.0015, 'steel', vertices=12))

    # ---- стропа подвеса: две ветви + перегиб через кольцо ---------------
    strap_z1 = FOLD_CZ + 0.0004
    for tag, sx in (('a', -1.0), ('b', 1.0)):
        parts.append(cube(PREFIX + f'strap_leg_{tag}',
                          (sx * TAPE_CX, 0.0, (STRAP_Z0 + strap_z1) * 0.5),
                          (TT, 2 * STRAP_HALF_Y, strap_z1 - STRAP_Z0),
                          'milk', r=0.0009))
    parts.append(arc_band(PREFIX + 'strap_fold', FOLD_R_IN, FOLD_R_OUT,
                          -STRAP_HALF_Y + 0.0006, STRAP_HALF_Y - 0.0006,
                          math.pi, 0.0, 30, 'milk', bevel_w=0.0009,
                          cz=FOLD_CZ))
    # прошивка петли: по две вертикальные строчки на каждой ветви
    for tag, sx in (('a', -1.0), ('b', 1.0)):
        for j, yy in ((1, 0.0074), (2, -0.0074)):
            x = sx * (FOLD_R_OUT + 0.0001)
            parts.append(curve_tube(PREFIX + f'strap_stitch_{tag}{j}',
                                    [(x, yy, STRAP_Z0 + 0.0012),
                                     (x, yy, FOLD_CZ - 0.0006)],
                                    0.0004, 'dark'))
    # закрепки стропы на ремне (две строчки у основания)
    for tag, yy in (('a', 0.0128), ('b', -0.0128)):
        parts.append(arc_band(PREFIX + f'strap_sew_{tag}', R_OUT - 0.0001,
                              R_OUT + 0.0005, yy - 0.0006, yy + 0.0006,
                              1.318, 1.824, 10, 'milk', bevel_w=0.0002))
    for tag, sx in (('a', -1.0), ('b', 1.0)):
        x = sx * (FOLD_R_OUT + 0.0001)
        parts.append(curve_tube(PREFIX + f'strap_bartack_{tag}',
                                [(x, 0.0064, STRAP_Z0 + 0.0014),
                                 (x, -0.0064, STRAP_Z0 + 0.0014)],
                                0.0005, 'dark'))

    # ---- стальное подвесное кольцо -------------------------------------
    parts.append(ring_oval(PREFIX + 'suspension_ring', (0.0, 0.0, RING_CZ),
                           Vector((0, 1, 0)), RING_MAJOR, RING_MINOR, 'steel',
                           sx=RING_SX, sz=RING_SZ))

    # ---- датчик натяжения на передней ветви стропы ---------------------
    parts.append(cube(PREFIX + 'tension_link', (0.0080, 0.0, 0.0698),
                      (0.0026, 0.0130, 0.0060), 'steel', r=0.0007))
    parts.append(cube(PREFIX + 'tension_led', (0.0094, 0.0034, 0.0698),
                      (0.0007, 0.0032, 0.0017), 'yellow', r=0.0002))
    for j, yy in ((1, -0.0042), (2, 0.0049)):
        parts.append(cyl(PREFIX + f'tension_screw_{j}',
                         (0.0092, yy, 0.0698), (0.0098, yy, 0.0698),
                         0.0008, 'dark', vertices=8))

    # ---- вторая страховка: малая D-петля на ремне ----------------------
    parts.append(plate_tangent(PREFIX + 'anchor_tab', A_ANCHOR,
                               R_OUT + 0.0010, 0.0094, 0.0140, 0.0020,
                               'milk', bev=0.0004))
    parts.append(ring_oval(PREFIX + 'anchor_ring',
                           p3(A_ANCHOR, R_OUT + 0.0016), d3(A_ANCHOR),
                           0.0032, 0.0012, 'steel', segs=32, rings=10))

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
        'code': 'RST-SU-09',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_target_passport': [0.100, 0.080, 0.050],
        'bbox_axis_mapping': {'Z': '0.100 высота подвеса (ремень+стропа+кольцо)',
                              'X': '0.080 диаметр + пряжка',
                              'Y': '0.050 ширина манжеты'},
        'bbox_ok': bool(size.z <= 0.103 and size.x <= 0.084
                        and size.y <= 0.053 and mn.z > -0.0012),
        'floor_contact_ok': bool(abs(mn.z) < 0.0012),
        'bore_axis': 'Y',
        'bore_axis_z': round(CZ, 5),
        'bore_clear_diameter_mm': round(2 * R_RIB * 1000, 1),
        'cuff_width_mm': round(2 * HALF_W * 1000, 1),
        'outer_diameter_mm': round(2 * R_OUT * 1000, 1),
        'gap_deg': round(2 * math.degrees(A_GAP), 1),
        'band_top_z': round(BAND_TOP, 5),
        'strap_fold_top_z': round(FOLD_CZ + FOLD_R_OUT, 5),
        'ring_top_z': round(RING_TOP, 5),
        'ring_above_band_mm': round((RING_TOP - BAND_TOP) * 1000, 1),
        'hanging_ok': bool(RING_TOP > BAND_TOP + 0.020),
        'materials': sorted(m.name for m in bpy.data.materials if m.users),
        'material_count': len([m for m in bpy.data.materials if m.users]),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
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
    scene.view_settings.exposure = 0.35
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.450, 0.446, 0.436, 1.0)
    bg.inputs['Strength'].default_value = 0.55

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5
    span = max(mx - mn)

    bpy.ops.mesh.primitive_plane_add(size=span * 40,
                                     location=(center.x, center.y, mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.430, 0.426, 0.416, 1.0)
    nb.inputs['Roughness'].default_value = 0.95
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (2.9, -3.3, 3.2), 2.9, 2.6),
            ('fill', (-3.6, -2.4, 1.4), 0.75, 3.8),
            ('rim', (0.5, 3.2, 2.8), 1.9, 3.0)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz * span
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector((loc[0] * span, loc[1] * span,
                              loc[2] * span + center.z * 0.9))
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

    sensor = cam_data.sensor_width

    def fit_dist(direction, lens, corners, margin=1.10):
        right, up, back = cam_basis(direction)
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

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill, region=None):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = mw @ v.co
                if region is not None:
                    lo_, hi_ = region
                    if not (lo_.x <= p.x <= hi_.x and lo_.y <= p.y <= hi_.y
                            and lo_.z <= p.z <= hi_.z):
                        continue
                q = world_to_camera_view(scene, cam, p)
                worst = max(worst, abs(q.x - 0.5) * 2.0, abs(q.y - 0.5) * 2.0)
        return worst

    c_main = box_corners(mn - center, mx - center)
    # крупный план: стропа, кольцо, датчик
    close_lo = Vector((-0.018, -0.018, 0.0580))
    close_hi = Vector((0.018, 0.018, RING_TOP + 0.0012))
    close_t = (close_lo + close_hi) * 0.5
    c_close = box_corners(close_lo - close_t, close_hi - close_t)

    views = [
        ('3q', (0.80, 0.60, 0.32), center, 70, c_main, 0.90, None),
        ('front', (0.10, -1.00, 0.17), center, 70, c_main, 0.90, None),
        ('side', (1.00, -0.12, 0.10), center, 72, c_main, 0.90, None),
        ('closeup', (0.72, -0.64, 0.30), close_t, 85, c_close, 0.94,
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
        for _ in range(6):
            got = max_ndc(fill, region)
            if got < 0.02 or abs(got - fill) < 0.02:
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
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['hanging_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
