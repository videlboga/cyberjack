"""Standalone builder: restraint_wrist_cuff (RST-WR-01, «Манжета кисти»).

Мягкая регулируемая манжета запястья: графитовый нейлоновый ремень 60x26 мм
с молочной регулировочной лентой, силиконовая подкладка с поперечными
роликами и подушечкой под ладонную сторону, стальная пряжка-кам с рычагом
быстросъёма, D-полукольцо на тканевой петле, ограничитель длины и маркировка
размера S/M/L. Плиты-основания нет: манжета лежит на собственном ремне.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_wrist_cuff.py

Выход:
  public/models/machine-modules/components/restraint_wrist_cuff.glb
  docs/plans/blockout/component-library/restraint_wrist_cuff/*.png
  docs/plans/blockout/component-library/restraint_wrist_cuff/report.json

Геометрия (Blender Z-up, метры):
  ось манжеты (= ось запястья) = Y, центр кольца в (0, 0, R_OUT)
  разъём и вся застёжка направлены в +X; D-ring в +X
  z_bottom = 0 -> ремень стоит на полу, манжета лежит на боку, как надевается
  вращения нет (motion: none), анимационная пустышка не нужна.

Габарит по паспорту 0,080 x 0,060 x 0,030 м (оси паспорта: длина с застёжкой,
диаметр, ширина ремня):
  X = диаметр + пряжка + D-ring, Z = наружный диаметр, Y = ширина ремня.
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_wrist_cuff'
CID = 'restraint_wrist_cuff'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
R_OUT = 0.0300          # наружный радиус ремня -> диаметр 60 мм (паспорт)
HALF_W = 0.0130         # половина ширины ремня -> 26 мм (паспорт ~30)
CZ = R_OUT              # центр кольца: нижняя точка ремня на z=0

R_WEB_IN = 0.0282       # нейлон 1,8 мм
R_PAD = 0.0252          # силиконовая подкладка 3,0 мм
R_RIB = 0.0238          # поперечные ролики подкладки выступают внутрь
R_CRADLE = 0.0228       # мягкая подушечка под ладонную сторону

A_GAP = math.radians(28.0)     # разъём: -28°..+28° (56°)
A_TONGUE_A = math.radians(28.0)     # лента начинается у конца ремня
A_TONGUE_B = math.radians(-31.0)    # свободный конец ленты
R_TONGUE_IN = 0.0302
R_TONGUE_OUT = 0.0314

A_BUCKLE = math.radians(-2.0)
R_BUCKLE = 0.0319
A_DRING = math.radians(-18.0)

PALETTE = {
    'graphite': (0.082, 0.086, 0.096),
    'milk': (0.880, 0.866, 0.836),
    'blush': (0.870, 0.560, 0.600),
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


def sphere(name, loc, radius, role, segs=18, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def ring_loop(name, center, normal, major, minor, role, segs=32, rings=10,
              scale_u=1.0, scale_v=1.0):
    """Кольцо/полукольцо: тор, ось которого направлена по normal."""
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=center)
    obj = bpy.context.object
    obj.name = name
    q = Vector(normal).normalized().to_track_quat('Z', 'Y')
    obj.rotation_euler = q.to_euler()
    obj.scale = (scale_u, scale_v, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
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


def arc_band(name, r_in, r_out, y0, y1, a0, a1, seg, role, smooth=True,
             bevel_w=0.0):
    """Сектор кольца вокруг оси Y (ремень, подкладка, ролики)."""
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


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    # ---- ремень --------------------------------------------------------
    parts.append(arc_band(PREFIX + 'band', R_WEB_IN, R_OUT, -HALF_W, HALF_W,
                          A_GAP, math.tau - A_GAP, 64, 'graphite',
                          bevel_w=0.0006))

    # молочная окантовка по наружной кромке ремня (обшивка)
    parts.append(arc_band(PREFIX + 'band_bind_outer', R_WEB_IN - 0.0002,
                          R_OUT + 0.0002, HALF_W - 0.0016, HALF_W + 0.0002,
                          A_GAP + 0.012, math.tau - A_GAP - 0.012, 56, 'milk'))
    # обшитые торцы ремня у разъёма (тонкая кромка, не блок)
    for tag, a0, a1 in (('a', A_GAP - 0.006, A_GAP + 0.020),
                        ('b', math.tau - A_GAP - 0.020, math.tau - A_GAP + 0.006)):
        parts.append(arc_band(PREFIX + f'band_end_{tag}', R_WEB_IN - 0.0003,
                              R_OUT + 0.0003, -HALF_W - 0.0003,
                              HALF_W + 0.0003, a0, a1, 6, 'milk',
                              bevel_w=0.0004))
    # два шва по наружной стороне ремня (разбивают плоскость, читаются как строчка)
    for tag, y in (('a', 0.0090), ('b', -0.0090)):
        pts = [p3(math.radians(29.0) + math.radians(302.0) * i / 14.0,
                  R_OUT + 0.0001, y) for i in range(15)]
        parts.append(curve_tube(PREFIX + f'band_seam_{tag}', pts, 0.0005,
                                'dark'))

    # ---- силиконовая подкладка -----------------------------------------
    parts.append(arc_band(PREFIX + 'lining', R_PAD, R_WEB_IN + 0.0004,
                          -HALF_W + 0.0012, HALF_W - 0.0012,
                          A_GAP + 0.024, math.tau - A_GAP - 0.024, 64,
                          'blush', bevel_w=0.0008))
    # поперечные ролики подкладки (мягкие валики)
    for i, y in enumerate((-0.0062, 0.0, 0.0062)):
        parts.append(arc_band(PREFIX + f'pad_rib_{"abc"[i]}', R_RIB,
                              R_PAD + 0.0006, y - 0.0017, y + 0.0017,
                              math.radians(36.0), math.radians(324.0), 56,
                              'blush'))
    # мягкая подушечка под ладонную сторону
    parts.append(arc_band(PREFIX + 'pad_cradle', R_CRADLE, R_PAD - 0.0002,
                          -0.0100, 0.0100, math.radians(150.0),
                          math.radians(210.0), 26, 'blush', bevel_w=0.0014))
    # скруглённые кромки подкладки
    for tag, y in (('a', HALF_W - 0.0026), ('b', -HALF_W + 0.0026)):
        pts = [p3(math.radians(30.0) + math.radians(300.0) * i / 10.0,
                  0.0266, y) for i in range(11)]
        parts.append(curve_tube(PREFIX + f'lining_roll_{tag}', pts, 0.0017,
                                'blush'))

    # ---- регулировочная лента (молочный нейлон) ------------------------
    parts.append(arc_band(PREFIX + 'tongue', R_TONGUE_IN, R_TONGUE_OUT,
                          -HALF_W + 0.0008, HALF_W - 0.0008, A_TONGUE_B,
                          A_TONGUE_A, 34, 'milk', bevel_w=0.0006))
    # подшитые кромки ленты (читаемый контур ремня поверх манжеты)
    for tag, yy in (('a', 0.0118), ('b', -0.0118)):
        pts = [p3(A_TONGUE_B + 0.012 + (A_TONGUE_A - A_TONGUE_B - 0.024) * i / 12.0,
                  0.0313, yy) for i in range(13)]
        parts.append(curve_tube(PREFIX + f'tongue_hem_{tag}', pts, 0.0006,
                                'milk'))
    # утолщённый кончик ленты
    parts.append(arc_band(PREFIX + 'tongue_tip', R_TONGUE_IN,
                          R_TONGUE_OUT - 0.0002, -0.0106, 0.0106,
                          A_TONGUE_B, A_TONGUE_B + 0.055, 8, 'milk',
                          bevel_w=0.0008))

    # ---- маркировка размера S / M / L на ленте -------------------------
    a_tag = math.radians(-23.5)
    parts.append(cube(PREFIX + 'size_tag', p3(a_tag, 0.0319),
                      (0.0009, 0.0124, 0.0162), 'cream', r=0.0003,
                      rot=(0, 0, a_tag)))
    for i, da in enumerate((-3.0, 0.0, 3.0)):
        aa = a_tag + math.radians(da)
        parts.append(cube(PREFIX + f'size_tick_{"abc"[i]}',
                          p3(aa, 0.0325),
                          (0.0007, 0.0016, 0.0084), 'graphite', r=0.0002,
                          rot=(0, 0, aa)))
    # тканевый держатель свободного конца ленты
    a_keep = math.radians(-28.6)
    parts.append(rect_ring(PREFIX + 'keep_loop', p3(a_keep, 0.0314),
                            t3(a_keep), Vector((0, 1, 0)), d3(a_keep),
                            0.0046, 0.0262, 0.0018, 0.0030, 'milk',
                            bev=0.0005))

    # ---- ограничитель длины: стальной слайдер по ленте -----------------
    a_lim = math.radians(16.0)
    parts.append(rect_ring(PREFIX + 'limit_slider', p3(a_lim, 0.0312),
                            t3(a_lim), Vector((0, 1, 0)), d3(a_lim),
                            0.0058, 0.0308, 0.0017, 0.0032, 'steel',
                            bev=0.0006))
    parts.append(cyl(PREFIX + 'limit_screw',
                     p3(a_lim, 0.0312, -0.0074), p3(a_lim, 0.0340, -0.0074),
                     0.0018, 'steel', vertices=12, bev=0.0004))

    # ---- быстросъёмный замок: пряжка-кам + рычаг -----------------------
    u_b = t3(A_BUCKLE)
    parts.append(rect_ring(PREFIX + 'buckle_frame', p3(A_BUCKLE, R_BUCKLE),
                            u_b, Vector((0, 1, 0)), d3(A_BUCKLE),
                            0.0122, 0.0296, 0.0032, 0.0032, 'steel',
                            bev=0.0007))
    # прижимной кулачок-валик
    parts.append(cyl(PREFIX + 'buckle_roller',
                     p3(A_BUCKLE + 0.29, 0.0306, -0.0138),
                     p3(A_BUCKLE + 0.29, 0.0306, 0.0138), 0.0032, 'steel',
                     vertices=20, bev=0.0005))
    # рычаг быстросъёма: плоская пластина вдоль ленты с приподнятым носком
    a_lev = math.radians(13.0)
    parts.append(cube(PREFIX + 'qr_lever', p3(a_lev, 0.0338),
                      (0.0030, 0.0126, 0.0138), 'dark', r=0.0012,
                      rot=(0, math.radians(-5.0), a_lev)))
    parts.append(cube(PREFIX + 'qr_lever_tip', p3(math.radians(20.0), 0.0352),
                      (0.0028, 0.0072, 0.0122), 'dark', r=0.0012,
                      rot=(0, math.radians(-22.0), math.radians(20.0))))
    parts.append(cyl(PREFIX + 'qr_pin',
                     p3(A_BUCKLE + 0.29, 0.0306, -0.0152),
                     p3(A_BUCKLE + 0.29, 0.0306, 0.0152), 0.0013, 'steel',
                     vertices=10))

    # ---- тканевая петля и D-полукольцо ---------------------------------
    a_loop = A_DRING
    # стальная планка-спинка D, приклёпанная к ленте
    parts.append(cube(PREFIX + 'dring_bar', p3(a_loop, 0.0334),
                      (0.0044, 0.0058, 0.0148), 'steel', r=0.0007,
                      rot=(0, 0, a_loop)))
    for tag, dy in (('a', 0.0090), ('b', -0.0090)):
        parts.append(cyl(PREFIX + f'dring_rivet_{tag}',
                         p3(a_loop, 0.0310, dy), p3(a_loop, 0.0342, dy),
                         0.0016, 'steel', vertices=12))
    # D-полукольцо: кольцо в плоскости XZ (нормаль +Y), стоит на планке
    parts.append(ring_loop(PREFIX + 'dring', p3(a_loop, 0.0410),
                            Vector((0, 1, 0)), 0.0060, 0.0016, 'steel',
                            segs=40, rings=9))

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

    bore_r = min(R_CRADLE, R_RIB, R_PAD)
    rep = {
        'component': CID,
        'code': 'RST-WR-01',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_target_passport': [0.080, 0.060, 0.030],
        'bbox_ok': bool(size.x <= 0.085 and size.y <= 0.036
                        and size.z <= 0.066 and mn.z > -0.002),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'bore_axis': 'Y',
        'bore_axis_z': round(CZ, 5),
        'bore_clear_diameter_mm': round(2 * bore_r * 1000, 1),
        'cuff_height_mm': round(2 * HALF_W * 1000, 1),
        'outer_diameter_mm': round(2 * R_OUT * 1000, 1),
        'gap_deg': round(2 * math.degrees(A_GAP), 1),
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
    # extras для three.js/каталога: роль материала, компонент, тип движения
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
            ('key', (0.26, -0.30, 0.26), 1.55, 0.30),
            ('fill', (-0.30, -0.24, 0.16), 0.60, 0.42),
            ('rim', (0.06, 0.30, 0.24), 0.95, 0.34)):
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
    # крупный план: пряжка, рычаг, петля и D-ring
    close_t = Vector((0.0300, 0.0, CZ + 0.0035))
    c_close = box_corners(Vector((0.0175, -0.0175, CZ - 0.0150)) - close_t,
                          Vector((0.0500, 0.0175, CZ + 0.0195)) - close_t)

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
