#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_post_600 — вертикальная стойка 45x45x600, стандарт CJ-RAIL-45.

Standalone builder. Не трогает общий builder / catalog / pages и чужие GLB.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_post_600.py

Короткая стойка того же профиля, что fix_post_1000: сечение, T-пазы, торцевые
плиты и сетка крепежа совпадают один-в-один, отличается только длина по Z
(600 вместо 1000) и, как следствие, число/высота монтажных позиций T-гаек.

Ориентация:
  * рабочая (длинная) ось — +Z, стойка вертикальная, центр габарита в (0,0,0);
  * поперечное сечение — плоскость XY, T-пазы идут вдоль Z;
  * торцы — горизонтальные плоскости z = +0.3 (end_top) и z = -0.3 (end_bottom);
  * у fix_rail_1000 длинная ось — +X, сечение YZ, сетка M8 ±15 мм и Ø6 в (0,0)
    сохранены, координаты торцов переразложены (x,y) вместо (y,z).

Геометрия:
  * профиль 45x45, тело 576 мм по Z, торцевые плиты 45x45x12 внутри габарита
    (576 + 2 x 12 = 600);
  * четыре продольных T-паза: устье 10 мм, полость 20 мм, глубина 12 мм;
  * каждый торец: 4 x M8 (Ø9, сквозные) по сетке ±15 мм + центральное Ø6.1;
  * штифты Ø6 (сталь) по центру каждого торца, посадка 24 мм, заподлицо;
  * 4 T-гайки (drop-in) в пазах на монтажных позициях с шагом 50 мм;
  * фаски 1.0 мм (тело) / 1.5 мм (плиты);
  * оба торца графитовые: акцентного (розового) цвета нет;
  * материалов 4: matte ivory / slot graphite / plate graphite / steel.

Выход:
  docs/plans/blockout/component-library/fix_post_600/fix_post_600.glb
  docs/plans/blockout/component-library/fix_post_600/{3q,front,side,closeup}.png
  docs/plans/blockout/component-library/fix_post_600/report.json

Отладка без рендера: CJ_SKIP_RENDER=1 (геометрия + проверки + экспорт).
"""

import bpy
import bmesh
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from mathutils import Vector

# --- константы модуля ----------------------------------------------------
CID = 'fix_post_600'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001
LENGTH = 600.0 * MM         # габарит по Z (вертикаль), короткая стойка
REF_LENGTH = 1000.0 * MM    # длина эталонной fix_post_1000 (только для сверки)
PROFILE = 45.0 * MM         # 45x45
HALF = PROFILE * 0.5

SLOT_MOUTH = 10.0 * MM          # устье T-паза
SLOT_MOUTH_DEPTH = 5.0 * MM     # глубина устья (толщина губки)
SLOT_CAVITY = 20.0 * MM         # ширина полости
SLOT_DEPTH = 12.0 * MM          # полная глубина паза

M8_D = 9.0 * MM                 # отверстие под M8
PIN_D = 6.0 * MM                # штифт
PIN_BORE = 6.1 * MM             # гнездо штифта (зазор 0.1)
PIN_ENGAGE = 24.0 * MM          # посадка штифта
BOLT_GRID = 15.0 * MM           # сетка ±15 мм
HOLE_PITCH = 50.0 * MM          # шаг монтажных позиций

CAP_T = 12.0 * MM                                     # плита 45x45x12
CAP_BOT_Z0, CAP_BOT_Z1 = -LENGTH * 0.5, -LENGTH * 0.5 + CAP_T
CAP_TOP_Z1, CAP_TOP_Z0 = LENGTH * 0.5, LENGTH * 0.5 - CAP_T
BODY_Z0, BODY_Z1 = CAP_BOT_Z1, CAP_TOP_Z0             # 976 мм

BEVEL_PROFILE = 1.0 * MM
BEVEL_CAP = 1.5 * MM

DENSITY = 2700.0                # алюминий, кг/м3
TNUT_RECESS = 0.4 * MM          # утопление T-гайки от поверхности паза

SKIP_RENDER = os.environ.get('CJ_SKIP_RENDER', '0') not in ('0', '', 'false', 'no')


def log(*a):
    print('[fix_post_600]', *a, flush=True)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.objects,
                 bpy.data.lights, bpy.data.cameras, bpy.data.worlds):
        for item in list(coll):
            try:
                coll.remove(item)
            except Exception:
                pass


def make_mat(name, base, rough, metal=0.0, spec=0.5):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (base[0], base[1], base[2], 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if 'Specular IOR Level' in bsdf.inputs:
        bsdf.inputs['Specular IOR Level'].default_value = spec
    mat.diffuse_color = (base[0], base[1], base[2], 1.0)
    mat.roughness = rough
    mat.metallic = metal
    return mat


MATERIALS = {}


def build_materials():
    """4 материала: ivory тело, графит пазов, графит плит/вставок, сталь."""
    MATERIALS['body'] = make_mat('CJ_post_body_ivory', (0.735, 0.715, 0.668), 0.60, 0.0, 0.45)
    MATERIALS['slot'] = make_mat('CJ_post_slot_graphite', (0.055, 0.058, 0.065), 0.62, 0.0, 0.30)
    MATERIALS['plate'] = make_mat('CJ_post_plate_graphite', (0.075, 0.080, 0.090), 0.55, 0.08, 0.30)
    MATERIALS['steel'] = make_mat('CJ_post_steel', (0.520, 0.532, 0.552), 0.28, 1.0)


def new_object(name, me, mats, parent):
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    ob.parent = parent
    ob.matrix_parent_inverse.identity()
    return ob


def bevel_mesh(me, width, segments=2):
    bm = bmesh.new()
    bm.from_mesh(me)
    if width > 0 and bm.edges:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=width, offset_type='OFFSET',
                        segments=segments, profile=0.5, affect='EDGES',
                        clamp_overlap=True, loop_slide=True)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()


def bevel_apply(ob, width, segments=2, angle_deg=30.0):
    """Bevel-модификатор по острым рёбрам — только после булевых операций."""
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new('bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle_deg)
    mod.use_clamp_overlap = True
    mod.miter_outer = 'MITER_ARC'
    bpy.ops.object.modifier_apply(modifier=mod.name)


# --- профиль CJ-RAIL-45 в плоскости XY ----------------------------------
def profile_loop():
    """Замкнутый контур 45x45 (XY) с четырьмя T-пазами.

    Локально: a — вдоль грани, b — вглубь от поверхности.
    Обход: -Y -> +X -> +Y -> -X (против часовой при взгляде с +Z).
    """
    mouth_h = SLOT_MOUTH * 0.5
    cav_h = SLOT_CAVITY * 0.5
    side = [(-HALF, 0.0), (-mouth_h, 0.0), (-mouth_h, SLOT_MOUTH_DEPTH),
            (-cav_h, SLOT_MOUTH_DEPTH), (-cav_h, SLOT_DEPTH),
            (cav_h, SLOT_DEPTH), (cav_h, SLOT_MOUTH_DEPTH),
            (mouth_h, SLOT_MOUTH_DEPTH), (mouth_h, 0.0), (HALF, 0.0)]
    maps = (
        lambda a, b: (a, -HALF + b),        # грань -Y, внутрь +Y, вдоль +X
        lambda a, b: (HALF - b, a),         # грань +X, внутрь -X, вдоль +Y
        lambda a, b: (-a, HALF - b),        # грань +Y, внутрь -Y, вдоль -X
        lambda a, b: (-HALF + b, -a),       # грань -X, внутрь +X, вдоль -Y
    )
    pts = []
    for m in maps:
        for a, b in side:
            p = m(a, b)
            if not pts or (abs(p[0] - pts[-1][0]) > 1e-9 or abs(p[1] - pts[-1][1]) > 1e-9):
                pts.append(p)
    if abs(pts[0][0] - pts[-1][0]) < 1e-9 and abs(pts[0][1] - pts[-1][1]) < 1e-9:
        pts.pop()
    return pts


def profile_area_m2(pts):
    s = 0.0
    for i in range(len(pts)):
        y0, z0 = pts[i]
        y1, z1 = pts[(i + 1) % len(pts)]
        s += y0 * z1 - y1 * z0
    return abs(s) * 0.5


# --- примитивы -----------------------------------------------------------
def mesh_box(name, size, center, bevel=0.0, seg=2):
    sx, sy, sz = size
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if bevel > 0:
        bevel_mesh(me, bevel, segments=seg)
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = center
    return ob


def mesh_cyl(name, radius, length, axis='Z', segs=48, r_top=None):
    """Замкнутый цилиндр (опц. усечённый конус) вдоль axis, центр в нуле."""
    from mathutils import Matrix
    bm = bmesh.new()
    r_top = radius if r_top is None else r_top
    ring0, ring1 = [], []
    for i in range(segs):
        a = 2.0 * math.pi * i / segs
        c, s = math.cos(a), math.sin(a)
        ring0.append(bm.verts.new((c * radius, s * radius, -length * 0.5)))
        ring1.append(bm.verts.new((c * r_top, s * r_top, length * 0.5)))
    bm.faces.new(ring0)
    bm.faces.new(ring1[::-1])
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if axis == 'X':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                         matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    elif axis == 'Y':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0),
                         matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def mesh_revolve(name, profile_rz, segs=40):
    """Тело вращения вокруг Z по замкнутому контуру (r, z), r > 0."""
    bm = bmesh.new()
    rings = []
    for (r, z) in profile_rz:
        ring = []
        for i in range(segs):
            a = 2.0 * math.pi * i / segs
            ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
        rings.append(ring)
    n = len(profile_rz)
    for k in range(n):
        A, B = rings[k], rings[(k + 1) % n]
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((A[i], A[j], B[j], B[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def boolean_cut(target, cutter):
    bpy.context.view_layer.objects.active = target
    mod = target.modifiers.new('cut_' + cutter.name, 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    mod.use_self = False
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def axis_rot(direction):
    """Матрица, переводящая локальный +Z в direction."""
    d = Vector(direction)
    d.normalize()
    return Vector((0.0, 0.0, 1.0)).rotation_difference(d).to_matrix()


def drill_at(name, mouth, radius, depth, direction, segs=48):
    """Сверло (плоское кольцо + конус): начало в mouth, ось = direction."""
    bm = bmesh.new()
    ring0, ring1 = [], []
    for i in range(segs):
        a = 2.0 * math.pi * i / segs
        c, s = math.cos(a), math.sin(a)
        ring0.append(bm.verts.new((c * radius, s * radius, 0.0)))
        ring1.append(bm.verts.new((c * radius, s * radius, depth)))
    apex = bm.verts.new((0.0, 0.0, depth + radius * 0.62))
    bm.faces.new(ring0)
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
        bm.faces.new((ring1[i], ring1[j], apex))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=axis_rot(direction))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = mouth
    return ob


def drill_through_at(name, mouth, radius, length, direction, segs=40):
    """Сквозной цилиндр-вырез: начало в mouth, ось = direction."""
    bm = bmesh.new()
    ring0, ring1 = [], []
    for i in range(segs):
        a = 2.0 * math.pi * i / segs
        c, s = math.cos(a), math.sin(a)
        ring0.append(bm.verts.new((c * radius, s * radius, 0.0)))
        ring1.append(bm.verts.new((c * radius, s * radius, length)))
    bm.faces.new(ring0)
    bm.faces.new(ring1[::-1])
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=axis_rot(direction))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = mouth
    return ob


# --- сборка --------------------------------------------------------------
def build_body(root):
    """Тело 45x45x976 с четырьмя T-пазами вдоль Z."""
    pts = profile_loop()
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, BODY_Z0)) for (x, y) in pts]
    bm.verts.ensure_lookup_table()
    face = bm.faces.new(verts)
    extruded = bmesh.ops.extrude_face_region(bm, geom=[face])
    new_verts = [g for g in extruded['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=new_verts, vec=(0.0, 0.0, BODY_Z1 - BODY_Z0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(PREFIX + 'body')
    bm.to_mesh(me)
    bm.free()

    body = new_object(PREFIX + 'body', me, [MATERIALS['body'], MATERIALS['slot']], root)
    bpy.context.view_layer.objects.active = body

    # гнёзда штифта Ø6.1 с обоих торцов (глубина 30 мм в тело)
    for sign in (+1, -1):
        mouth = (0.0, 0.0, sign * (LENGTH * 0.5 + 0.004))
        cutter = drill_at('cut_body_pin_%d' % sign, mouth, PIN_BORE * 0.5,
                          CAP_T + 0.030 + 0.004, (0.0, 0.0, -sign), segs=32)
        boolean_cut(body, cutter)

    # посадочные гнёзда M8 за плитами (Ø7 x 28) — отверстие читается как
    # глубокое гнездо, а не как лунка в тонкой плите
    for sign in (+1, -1):
        mouth_z = sign * (LENGTH * 0.5 + 0.006)
        for sx in (-1, 1):
            for sy in (-1, 1):
                cutter = drill_at('cut_body_m8_%d_%d_%d' % (sign, sx, sy),
                                  (sx * BOLT_GRID, sy * BOLT_GRID, mouth_z),
                                  7.0 * MM * 0.5, CAP_T + 0.028 + 0.006,
                                  (0.0, 0.0, -sign), segs=32)
                boolean_cut(body, cutter)

    bevel_apply(body, BEVEL_PROFILE, segments=2)

    # грани пазов -> графит (только раскладка материала, геометрия та же).
    # Признак — геометрическая полоса глубины от каждой из четырёх граней:
    # нормаль дна паза смотрит ИЗ материала в полость, поэтому проверка по
    # нормали ненадёжна (даёт «перевёрнутый» набор граней).
    eps = 1e-4
    dirs = ((1.0, 0.0), (-1.0, 0.0), (0.0, 1.0), (0.0, -1.0))
    depth_lo, depth_hi = 0.0006, SLOT_DEPTH + 0.0002
    cav = SLOT_CAVITY * 0.5 + 0.0002
    n_slot = 0
    for poly in body.data.polygons:
        c = poly.center
        slot = False
        for ex, ey in dirs:
            depth = HALF - (c.x * ex + c.y * ey)
            if depth_lo < depth <= depth_hi and abs(-c.x * ey + c.y * ex) <= cav:
                slot = True
                break
        poly.material_index = 1 if slot else 0
        n_slot += 1 if slot else 0
    if n_slot == 0:
        raise RuntimeError('slot faces not painted — material slot unused')
    log('body slot faces:', n_slot)
    return body, profile_area_m2(pts)


def build_cap(root, tag, sign):
    """Торцевая плита 45x45x12: 4x M8 Ø9 сквозных + центральное Ø6.1.

    Оба торца нейтральные/графитовые — акцентного цвета в модуле нет.
    """
    if sign > 0:
        z0, z1 = CAP_TOP_Z0, CAP_TOP_Z1
    else:
        z0, z1 = CAP_BOT_Z0, CAP_BOT_Z1
    centre = (0.0, 0.0, (z0 + z1) * 0.5)
    cap = mesh_box(PREFIX + 'endcap_' + tag, (PROFILE, PROFILE, z1 - z0), centre, bevel=0.0)
    face_z = z1 if sign > 0 else z0      # внешняя плоскость торца
    mouth = face_z + sign * 0.004        # старт сверла снаружи
    inward = (0.0, 0.0, -sign)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cut = drill_through_at('cut_' + tag, (sx * BOLT_GRID, sy * BOLT_GRID, mouth),
                                   M8_D * 0.5, CAP_T + 0.020, inward, segs=40)
            boolean_cut(cap, cut)
    cut = drill_through_at('cut_pin_' + tag, (0.0, 0.0, mouth), PIN_BORE * 0.5,
                           CAP_T + 0.020, inward, segs=32)
    boolean_cut(cap, cut)
    bevel_apply(cap, BEVEL_CAP, segments=2)

    for _ in range(len(cap.data.materials)):
        cap.data.materials.pop(index=0)
    cap.data.materials.append(MATERIALS['plate'])
    cap.name = PREFIX + 'endcap_' + tag
    cap.data.name = cap.name
    cap.parent = root
    cap['cj_accent'] = False
    cap['cj_role'] = 'end plate 45x45x12 — neutral/graphite mounting interface, end_' + tag
    return cap


def build_dowel(root, tag, sign):
    """Штифт Ø6 по центру торца: посадка 24 мм, заподлицо (габарит 1000 не растёт)."""
    dowel = mesh_cyl(PREFIX + 'dowel_' + tag, PIN_D * 0.5, PIN_ENGAGE, axis='Z', segs=32)
    dowel.location = (0.0, 0.0, sign * (LENGTH * 0.5 - PIN_ENGAGE * 0.5))
    dowel.data.materials.append(MATERIALS['steel'])
    dowel.parent = root
    dowel['cj_role'] = 'locating dowel Ø6 x 24, flush with end_%s face' % tag
    dowel['cj_engagement_mm'] = PIN_ENGAGE * 1000
    return dowel


# ось грани, знак стороны, высота станции по Z
# тело 576 мм = z -0.288..+0.288, поэтому станции держим внутри тела:
# ±150 и ±250 (шаг сетки 50 мм), плиты на z = ±0.288.. ±0.300 свободны.
T_NUT_STATIONS = (
    ('x_pos', 'X', +1, 0.150),
    ('x_neg', 'X', -1, -0.150),
    ('y_pos', 'Y', +1, 0.250),
    ('y_neg', 'Y', -1, -0.250),
)


def build_t_nut(name, axis, sign, z, root):
    """Drop-in T-гайка: буртик Ø9.5 в устье + плитка Ø19 в полости + M8 Ø8.4."""
    r_in = 8.4 * MM * 0.5
    prof = [
        (r_in, 0.0),
        (4.50 * MM, 0.0),
        (4.78 * MM, 0.55 * MM),
        (4.78 * MM, SLOT_MOUTH_DEPTH),
        (9.50 * MM, SLOT_MOUTH_DEPTH),
        (9.50 * MM, SLOT_DEPTH - 0.7 * MM),
        (9.10 * MM, SLOT_DEPTH - 0.2 * MM),
        (r_in, SLOT_DEPTH - 0.2 * MM),
    ]
    nut = mesh_revolve(name, prof, segs=40)
    off = -TNUT_RECESS                      # локальный +Z = вглубь паза
    if axis == 'X':
        if sign > 0:                        # грань +X: внутрь -X
            nut.rotation_euler = (0.0, -math.pi / 2, 0.0)
            nut.location = (HALF + off, 0.0, z)
        else:
            nut.rotation_euler = (0.0, math.pi / 2, 0.0)
            nut.location = (-HALF - off, 0.0, z)
    else:
        if sign > 0:                        # грань +Y: внутрь -Y
            nut.rotation_euler = (math.pi / 2, 0.0, 0.0)
            nut.location = (0.0, HALF + off, z)
        else:
            nut.rotation_euler = (-math.pi / 2, 0.0, 0.0)
            nut.location = (0.0, -HALF - off, z)
    nut.data.materials.append(MATERIALS['plate'])
    nut.parent = root
    nut['cj_role'] = 'M8 drop-in T-nut in T-slot'
    nut['cj_slot_face'] = ('%s%s' % ('+' if sign > 0 else '-', axis))
    nut['cj_station_z_mm'] = round(z * 1000.0, 1)
    return nut


def build():
    reset_scene()
    build_materials()
    root = bpy.data.objects.new(CID, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.08
    bpy.context.scene.collection.objects.link(root)

    body, area = build_body(root)
    caps = {
        'top': build_cap(root, 'top', +1),
        'bottom': build_cap(root, 'bottom', -1),
    }
    dowels = {
        'top': build_dowel(root, 'top', +1),
        'bottom': build_dowel(root, 'bottom', -1),
    }
    nuts = [build_t_nut(PREFIX + 't_nut_' + key, axis, sign, z, root)
            for key, axis, sign, z in T_NUT_STATIONS]

    # печём трансформы в меши: локальные координаты == мировые,
    # ray_cast и замеры работают в одной системе
    meshes = obj_mesh_objs(root)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    mass = area * (BODY_Z1 - BODY_Z0) * DENSITY + \
        2.0 * (PROFILE * PROFILE * CAP_T) * DENSITY
    return root, body, caps, dowels, nuts, mass, area


# --- измерения -----------------------------------------------------------
def obj_mesh_objs(root):
    return [o for o in bpy.data.objects
            if o.type == 'MESH' and o.name.startswith(PREFIX)]


def bbox_of(objs):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for ob in objs:
        mw = ob.matrix_world
        for v in ob.data.vertices:
            p = mw @ v.co
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def ray(ob, origin, direction, dist=2.0):
    ok, loc, _nor, _idx = ob.ray_cast(Vector(origin), Vector(direction).normalized(),
                                      distance=dist)
    return Vector(loc) if ok else None


def bisect(fn, lo, hi, iters=26):
    """fn(lo) == True, fn(hi) == False -> граница."""
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        if fn(mid):
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def measure_faces(body, z_sample=0.0):
    """Профиль T-паза по лучам на высоте z_sample, все 4 грани (сечение XY).

    depth  — осевой луч в центр устья (устье и полость до дна);
    mouth  — бисекция осевого луча по тангенциальной координате;
    cavity — два тангенциальных луча в полости на глубине 8.5 мм;
    lip    — тангенциальный луч из полости на глубине 8.5 мм обратно наружу.
    """
    surface = HALF
    mid_depth = (SLOT_MOUTH_DEPTH + SLOT_DEPTH) * 0.5      # 8.5 мм
    frames = {
        'x+': (Vector((1, 0, 0)), Vector((0, 1, 0))),
        'x-': (Vector((-1, 0, 0)), Vector((0, 1, 0))),
        'y+': (Vector((0, 1, 0)), Vector((1, 0, 0))),
        'y-': (Vector((0, -1, 0)), Vector((1, 0, 0))),
    }

    def proj(p, e):
        return p.dot(e)

    out = {}
    ok_all = True
    for key, (e, u) in frames.items():
        base = Vector((0.0, 0.0, z_sample))

        def axial(c):
            origin = base + e * (surface + 0.060) + u * c
            p = ray(body, origin, -e)
            return None if p is None else surface - (proj(p, e) - proj(base, e))

        def reaches_floor(c):
            d = axial(c)
            return d is not None and d > (SLOT_DEPTH - 2.0 * MM)

        depth = axial(0.0)
        mouth_h = bisect(reaches_floor, 0.0015, 0.0125)

        o1 = base + e * (surface - mid_depth) + u * (HALF * 0.03)
        o2 = base + e * (surface - mid_depth) - u * (HALF * 0.03)
        h1 = ray(body, o1, -u)
        h2 = ray(body, o2, u)
        cavity = None
        if h1 is not None and h2 is not None:
            cavity = proj(h2, u) - proj(h1, u)

        lip_o = base + e * (surface - mid_depth) + u * (7.0 * MM)
        lip_hit = ray(body, lip_o, e)
        lip = None if lip_hit is None else surface - proj(lip_hit, e)

        rec = {
            'mouth_mm': round(mouth_h * 2 * 1000.0, 2),
            'cavity_mm': None if cavity is None else round(cavity * 1000.0, 2),
            'depth_mm': None if depth is None else round(depth * 1000.0, 2),
            'lip_mm': None if lip is None else round(lip * 1000.0, 2),
        }
        rec['ok'] = (abs(rec['mouth_mm'] - SLOT_MOUTH * 1000) <= 0.7 and
                     rec['cavity_mm'] is not None and
                     abs(rec['cavity_mm'] - SLOT_CAVITY * 1000) <= 0.7 and
                     rec['depth_mm'] is not None and
                     abs(rec['depth_mm'] - SLOT_DEPTH * 1000) <= 0.7 and
                     rec['lip_mm'] is not None and
                     abs(rec['lip_mm'] - SLOT_MOUTH_DEPTH * 1000) <= 0.7)
        ok_all = ok_all and rec['ok']
        out[key] = rec
    out['ok_all'] = ok_all
    return out


def measure_end(cap, sign):
    """Центры и диаметры 4x M8 (Ø9) и центрального Ø6.1 на торце по лучам."""
    face_z = sign * LENGTH * 0.5
    z_out = sign * (LENGTH * 0.5 + 0.0008)
    d = (0.0, 0.0, -sign)

    def through(x, y):
        p = ray(cap, (x, y, z_out), d, dist=CAP_T * 0.6)
        return p is None

    def edges(x0, y0):
        ex_p = bisect(lambda o: through(x0 + o, y0), 0.0, 0.010)
        ex_m = bisect(lambda o: through(x0 - o, y0), 0.0, 0.010)
        xc = x0 + (ex_p - ex_m) * 0.5
        ey_p = bisect(lambda o: through(xc, y0 + o), 0.0, 0.010)
        ey_m = bisect(lambda o: through(xc, y0 - o), 0.0, 0.010)
        yc = y0 + (ey_p - ey_m) * 0.5
        return xc, yc, ex_p + ex_m, ey_p + ey_m

    holes = []
    for sx in (1, -1):
        for sy in (1, -1):
            gx, gy = sx * BOLT_GRID, sy * BOLT_GRID
            xc, yc, dx, dy = edges(gx, gy)
            holes.append({
                'id': 'M8_%s%s' % ('plus' if sx > 0 else 'minus',
                                   'plus' if sy > 0 else 'minus'),
                'grid_mm': [round(gx * 1000, 1), round(gy * 1000, 1)],
                'center_m': [round(xc, 5), round(yc, 5), round(face_z, 4)],
                'offset_from_grid_mm': [round((xc - gx) * 1000, 3),
                                        round((yc - gy) * 1000, 3)],
                'dia_mm': [round(dx * 1000, 2), round(dy * 1000, 2)],
            })
    px, py, dpx, dpy = edges(0.0, 0.0)
    pin = {'center_m': [round(px, 5), round(py, 5), round(face_z, 4)],
           'dia_mm': [round(dpx * 1000, 2), round(dpy * 1000, 2)]}

    holes_ok = all(abs(h['dia_mm'][0] - 9.0) <= 0.45 and abs(h['dia_mm'][1] - 9.0) <= 0.45
                   for h in holes)
    grid_ok = all(abs(h['offset_from_grid_mm'][0]) <= 0.35 and
                  abs(h['offset_from_grid_mm'][1]) <= 0.35 for h in holes)
    pin_ok = (abs(pin['dia_mm'][0] - PIN_BORE * 1000) <= 0.35 and
              abs(pin['dia_mm'][1] - PIN_BORE * 1000) <= 0.35 and
              abs(pin['center_m'][0]) < 0.0004 and abs(pin['center_m'][1]) < 0.0004)
    return holes, pin, {'holes_ok': holes_ok, 'grid_ok': grid_ok, 'pin_bore_ok': pin_ok}


def slot_paint_stats(body):
    """Контроль раскладки материала: дно и стенки каждого паза несут графит.

    Замер лучей проверяет геометрию, но не материал: паз может быть верным по
    сечению и при этом закрашенным телом. Здесь проверяются реальные индексы
    полигонов на плоскостях дна всех четырёх пазов.
    """
    me = body.data
    slot_idx = None
    for i, m in enumerate(me.materials):
        if m and m.name == MATERIALS['slot'].name:
            slot_idx = i
    if slot_idx is None:
        return {'painted_faces': 0, 'slot_material': None, 'floors': {}, 'ok': False}
    painted = sum(1 for p in me.polygons if p.material_index == slot_idx)
    out = {'painted_faces': painted,
           'slot_material': MATERIALS['slot'].name,
           'floors': {}, 'ok': False}
    ok = painted >= 4 * 24
    for tag, ex, ey in (('x+', 1.0, 0.0), ('x-', -1.0, 0.0),
                        ('y+', 0.0, 1.0), ('y-', 0.0, -1.0)):
        faces = [p for p in me.polygons
                 if abs((HALF - (p.center.x * ex + p.center.y * ey)) - SLOT_DEPTH) < 2e-4
                 and abs(-p.center.x * ey + p.center.y * ex) <= SLOT_CAVITY * 0.5]
        good = bool(faces) and all(p.material_index == slot_idx for p in faces)
        out['floors'][tag] = {'floor_faces': len(faces), 'graphite': good}
        ok = ok and good
    out['ok'] = ok
    return out


def check_mesh(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    non_manifold = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    degenerate = sum(1 for f in bm.faces if f.calc_area() < 1e-11)
    loose = sum(1 for v in bm.verts if not v.link_edges)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    verts = len(bm.verts)
    bm.free()
    return {'non_manifold': non_manifold, 'degenerate': degenerate, 'loose_verts': loose,
            'tris': tris, 'verts': verts}


def check(mass, area, root, body, caps, dowels, nuts):
    meshes = obj_mesh_objs(root)
    mn, mx = bbox_of(meshes)
    size = mx - mn
    body_mn, body_mx = bbox_of([body])
    body_size = body_mx - body_mn

    per_obj = {}
    nm_total = deg_total = loose_total = tris = verts = 0
    for ob in meshes:
        r = check_mesh(ob)
        per_obj[ob.name] = r
        nm_total += r['non_manifold']
        deg_total += r['degenerate']
        loose_total += r['loose_verts']
        tris += r['tris']
        verts += r['verts']

    mats = sorted({m.name for ob in meshes for m in ob.data.materials if m})
    neg_scale = [ob.name for ob in meshes if ob.matrix_world.determinant() < 1e-9]

    slot = measure_faces(body, 0.0)
    slot_far = measure_faces(body, 0.200)
    slot_paint = slot_paint_stats(body)
    holes_t, pin_t, ok_t = measure_end(caps['top'], +1)
    holes_b, pin_b, ok_b = measure_end(caps['bottom'], -1)

    # штифты: диаметр, длина, заподлицо, центрирование
    dowel_recs = {}
    dowel_ok = True
    for tag, sign in (('top', +1), ('bottom', -1)):
        d_mn, d_mx = bbox_of([dowels[tag]])
        dia = round((d_mx.x - d_mn.x) * 1000.0, 2)
        length = round((d_mx.z - d_mn.z) * 1000.0, 2)
        flush_z = d_mx.z if sign > 0 else d_mn.z
        flush = abs(flush_z - sign * LENGTH * 0.5) <= 0.0006
        centred = (abs((d_mn.x + d_mx.x) * 0.5) < 0.0002 and
                   abs((d_mn.y + d_mx.y) * 0.5) < 0.0002)
        rec = {'dia_mm': dia, 'length_mm': length, 'flush': bool(flush),
               'centred': bool(centred),
               'outer_face_m': [0.0, 0.0, round(flush_z, 5)]}
        dowel_recs[tag] = rec
        dowel_ok = dowel_ok and abs(dia - PIN_D * 1000) <= 0.1 and \
            abs(length - PIN_ENGAGE * 1000) <= 0.6 and flush and centred

    # плавающие детали: bbox-зазор до тела / плит
    def gap(a_mn, a_mx, b_mn, b_mx):
        d = 0.0
        for i in range(3):
            d = max(d, max(0.0, a_mn[i] - b_mx[i]), max(0.0, b_mn[i] - a_mx[i]))
        return d

    body_box = (body_mn, body_mx)
    cap_boxes = [bbox_of([caps['top']]), bbox_of([caps['bottom']])]
    floating = []
    for ob in meshes:
        if ob is body:
            continue
        o_mn, o_mx = bbox_of([ob])
        g = min([gap(o_mn, o_mx, *body_box)] +
                [gap(o_mn, o_mx, *cb) for cb in cap_boxes])
        if g > 0.0015:
            floating.append({'name': ob.name, 'gap_mm': round(g * 1000.0, 2)})

    stations_mm = [s[3] * 1000.0 for s in T_NUT_STATIONS]
    pitch_ok = all(abs(x / 50.0 - round(x / 50.0)) < 1e-6 for x in stations_mm)

    # 4 координаты M8 на торце должны быть попарно различны
    def distinct(holes):
        keys = {(round(h['center_m'][0], 4), round(h['center_m'][1], 4)) for h in holes}
        return len(keys) == 4

    m8_distinct_ok = distinct(holes_t) and distinct(holes_b)

    # оба торца однотипны и нейтральны: ни розового материала, ни accent-флага
    cap_mats = {m.name for tag in ('top', 'bottom') for m in caps[tag].data.materials if m}
    neutral_ok = (len(cap_mats) == 1 and
                  all('pink' not in m.lower() and 'accent' not in m.lower()
                      for m in mats) and
                  not any(bool(caps[t].get('cj_accent')) for t in ('top', 'bottom')))
    cap_counts = {t: (len(caps[t].data.vertices), len(caps[t].data.polygons))
                  for t in ('top', 'bottom')}
    caps_identical = cap_counts['top'] == cap_counts['bottom']

    centre_ok = all(abs(mn[i] + mx[i]) < 0.0005 for i in range(3))

    def iface(tag, sign, holes, pin_rec, bore_ok, dowel_rec, dowel_node):
        return {
            'role': 'graphite end plate (mounting interface), %s' %
                    ('top (z=+0.3)' if sign > 0 else 'bottom (z=-0.3)'),
            'accent': False,
            'center_m': [0.0, 0.0, round(sign * LENGTH * 0.5, 5)],
            'axis': [0.0, 0.0, float(sign)],
            'normal': [0.0, 0.0, float(sign)],
            'plane': 'XY',
            'plate_mm': [PROFILE * 1000, PROFILE * 1000, CAP_T * 1000],
            'bolts': 'M8 x4 (Ø9 through), grid ±15 mm',
            'hole_pitch_mm': HOLE_PITCH * 1000,
            'm8': holes,
            'pin': {'dia_mm': PIN_D * 1000,
                    'bore_dia_mm': round(PIN_BORE * 1000, 2),
                    'center_m': pin_rec['center_m'],
                    'measured_bore_mm': pin_rec['dia_mm'],
                    'bore_ok': bore_ok,
                    'inserted': True,
                    'engagement_mm': PIN_ENGAGE * 1000,
                    'flush': dowel_rec['flush'],
                    'dia_measured_mm': dowel_rec['dia_mm'],
                    'node': dowel_node},
        }

    checks = {
        'non_manifold_edges': nm_total,
        'non_manifold_ok': nm_total == 0,
        'degenerate_faces': deg_total,
        'degenerate_ok': deg_total == 0,
        'loose_verts': loose_total,
        'loose_verts_ok': loose_total == 0,
        'material_count': len(mats),
        'material_count_ok': 4 <= len(mats) <= 8,
        'bbox_size_m': [round(v, 5) for v in size],
        'bbox_ok': (abs(size.x - PROFILE) <= 0.0006 and
                    abs(size.y - PROFILE) <= 0.0006 and
                    abs(size.z - LENGTH) <= 0.0008),
        'vertical_axis': 'Z',
        'vertical_ok': (size.z > size.x * 10.0 and size.z > size.y * 10.0 and
                        abs(body_size.z - (BODY_Z1 - BODY_Z0)) <= 0.0008),
        'body_size_m': [round(v, 5) for v in body_size],
        'body_bbox_ok': (abs(body_size.x - PROFILE) <= 0.0006 and
                         abs(body_size.y - PROFILE) <= 0.0006 and
                         abs(body_size.z - (BODY_Z1 - BODY_Z0)) <= 0.0008),
        'length_budget_ok': abs((CAP_T * 2 + (BODY_Z1 - BODY_Z0)) - LENGTH) <= 0.0005,
        'origin_centred_ok': centre_ok,
        'no_negative_scale': not neg_scale,
        'negative_scale_nodes': neg_scale,
        'slot_profile': slot,
        'slot_profile_check_z_mm': 0.0,
        'slot_profile_far_ok_all': slot_far['ok_all'],
        'slot_ok': slot['ok_all'] and slot_far['ok_all'],
        'slot_material_paint': slot_paint,
        'slot_material_ok': slot_paint['ok'],
        'end_top_holes_ok': ok_t['holes_ok'] and ok_t['grid_ok'],
        'end_bottom_holes_ok': ok_b['holes_ok'] and ok_b['grid_ok'],
        'holes_ok': (ok_t['holes_ok'] and ok_t['grid_ok'] and
                     ok_b['holes_ok'] and ok_b['grid_ok'] and m8_distinct_ok),
        'm8_coords_distinct_ok': m8_distinct_ok,
        'pin_bore_top_ok': ok_t['pin_bore_ok'],
        'pin_bore_bottom_ok': ok_b['pin_bore_ok'],
        'pin_bore_ok': ok_t['pin_bore_ok'] and ok_b['pin_bore_ok'],
        'dowel_geometry_ok': dowel_ok,
        'ends_neutral_ok': bool(neutral_ok),
        'end_caps_identical_ok': bool(caps_identical),
        't_nut_pitch_ok': pitch_ok,
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'animation': 'none (static module)',
        'animation_ok': len(bpy.data.actions) == 0,
    }
    checks['pattern_reconciliation'] = pattern_reconciliation({'interfaces': {
        'end_top': iface('end_top', +1, holes_t, pin_t, ok_t['pin_bore_ok'],
                         dowel_recs['top'], PREFIX + 'dowel_top')},
        'spec': {'slot': {'mouth_mm': 10.0, 'cavity_mm': 20.0, 'depth_mm': 12.0},
                 'profile_mm': [round(PROFILE * 1000, 2), round(PROFILE * 1000, 2)],
                 'length_mm': round(LENGTH * 1000.0, 2)},
        'bbox_m': {'size': [round(v, 5) for v in size]}})
    checks['pattern_match_ok'] = checks['pattern_reconciliation'].get('ok', False)
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))

    rep = {
        'id': CID,
        'code': 'CJ-RAIL-45',
        'name': 'Стойка 600',
        'kit': 'CJ-FIX-KIT',
        'class': 'STRUCTURE / post',
        'standard': 'CJ-RAIL-45',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_post_1000.py',
        'units': 'm',
        'orientation': {
            'long_axis': 'Z',
            'mount': 'short vertical post, +Z up, габарит отцентрован в (0,0,0)',
            'cross_section_plane': 'XY',
            'profile_extrude_axis': 'Z',
            'slots_run_along': 'Z',
            'slot_faces': ['+X', '-X', '+Y', '-Y'],
            'ends': {'end_top': {'plane': 'z=+0.3', 'normal': [0, 0, 1]},
                     'end_bottom': {'plane': 'z=-0.3', 'normal': [0, 0, -1]}},
            'm8_grid_plane': 'XY на каждом торце',
            'pattern_source': 'fix_post_1000 (CJ-RAIL-45)',
            'pattern_delta': (
                'fix_post_1000: длина 1000 мм (тело 976 мм). fix_post_600: длина '
                '600 мм (тело 576 мм). Сечение 45x45, плоскость XY, T-пазы 10/20/12 '
                'вдоль Z, плиты 45x45x12, сетка M8 ±15 мм (Ø9), Ø6 в (0,0) и '
                'штифт Ø6 x 24 — без изменений; сдвинуты только монтажные позиции '
                'T-гаек (тело короче на 400 мм).'),
        },
        'spec': {
            'profile_mm': [45.0, 45.0],
            'length_mm': round(LENGTH * 1000.0, 2),
            'body_length_mm': round((BODY_Z1 - BODY_Z0) * 1000, 2),
            'end_cap_mm': [45.0, 45.0, CAP_T * 1000],
            'end_cap_count': 2,
            'slot': {'mouth_mm': 10.0, 'cavity_mm': 20.0, 'depth_mm': 12.0,
                     'faces': 4, 'standard': 'T-slot 10 (CJ-RAIL-45)'},
            'bolt': 'M8',
            'hole_dia_mm': 9.0,
            'hole_pitch_mm': 50.0,
            'end_grid_mm': 15.0,
            'pin_dia_mm': 6.0,
            'bevel_mm': [BEVEL_PROFILE * 1000, BEVEL_CAP * 1000],
            'material': 'Al 6063-T5 (assumed)',
            'accent': 'none (both ends graphite/neutral)',
            'mass_kg_nominal': round(mass, 2),
        },
        'bbox_m': {'min': [round(v, 5) for v in mn], 'max': [round(v, 5) for v in mx],
                   'size': [round(v, 5) for v in size]},
        'bbox_body_m': {'min': [round(v, 5) for v in body_mn],
                        'max': [round(v, 5) for v in body_mx],
                        'size': [round(v, 5) for v in body_size]},
        'body_span_z_m': [round(BODY_Z0, 5), round(BODY_Z1, 5)],
        'cross_section_area_mm2': round(area * 1e6, 1),
        'mass_kg_est': round(mass, 3),
        'node_count': len(meshes) + 1,
        'nodes': [ob.name for ob in sorted(meshes, key=lambda o: o.name)],
        'root': root.name,
        'verts': verts,
        'tris': tris,
        'per_object': per_obj,
        'materials': mats,
        'material_usage': {ob.name: [m.name for m in ob.data.materials if m]
                           for ob in meshes},
        'interfaces': {
            'end_top': iface('end_top', +1, holes_t, pin_t, ok_t['pin_bore_ok'],
                             dowel_recs['top'], PREFIX + 'dowel_top'),
            'end_bottom': iface('end_bottom', -1, holes_b, pin_b, ok_b['pin_bore_ok'],
                                dowel_recs['bottom'], PREFIX + 'dowel_bottom'),
            'slots': {'count': 4, 'mouth_mm': 10.0, 'cavity_mm': 20.0, 'depth_mm': 12.0,
                      'faces': ['+X', '-X', '+Y', '-Y'],
                      'run_axis': 'Z',
                      't_nut_stations_z_mm': {k: round(z * 1000, 1)
                                              for k, _a, _s, z in T_NUT_STATIONS},
                      'station_pitch_mm': 50.0},
        },
        'checks': checks,
        'renders': [],
        'glb': None,
        'glb_bytes': None,
        'notes': [
            'Стойка вертикальная: длинная ось +Z (600 мм), поперечное сечение XY, '
            'профиль CJ-RAIL-45 протянут вдоль Z; торцы — плоскости z=±0.3.',
            'T-пазы выполнены реальным сечением (устье 10 мм, полость 20 мм, глубина '
            '12 мм) и подтверждены замерами по лучам на всех четырёх гранях на двух '
            'высотах (z=0 и z=+200 мм).',
            'Внутренние поверхности пазов несут отдельный графитовый материал — '
            'контраст даёт читаемость паза без геометрического шума.',
            'Торцевые плиты 45x45x12 не выходят за профиль: тело 576 мм + 2 x 12 мм = '
            '600 мм по Z.',
            'Каждый торец: 4 x M8 (Ø9, сквозные) по сетке ±15 мм в плоскости XY + '
            'центральное Ø6.1. За плитой — массив тела с гнездом Ø7 x 28, поэтому '
            'отверстия читаются как глубокие гнёзда, а не как лунки.',
            'Штифты Ø6 по центру каждого торца (0,0,±0.3), посадка 24 мм, заподлицо — '
            'габарит 600x45x45 не растёт.',
            'T-гайки (drop-in, Ø9.5 буртик в устье + Ø19 плитка в полости) стоят на '
            'монтажных позициях ±150 / ±250 мм по Z (шаг сетки 50 мм, внутри тела '
            '576 мм); их гнёзда Ø8.4 задают интерфейс M8.',
            'Масса: %d мм2 x %.3f м x 2700 кг/м3 (тело) + 2 плиты 45x45x12.'
            % (round(area * 1e6), round(BODY_Z1 - BODY_Z0, 3)),
            'Оба торца графитовые, акцентного (розового) цвета в модуле нет — '
            'стойка нейтральна, как fix_cross_1000 и fix_post_1000.',
        ],
        'deviations': [
            'Длина отличается от fix_post_1000 намеренно: 600 мм вместо 1000 мм '
            '(тело 576 вместо 976). Сечение 45x45, T-пазы 10/20/12, плиты 45x45x12, '
            'сетка M8 ±15 мм (Ø9) и Ø6/штифт в (0,0) совпадают с эталоном — узлы '
            'стыкуются без переходников.',
            'Монтажные позиции T-гаек перенесены внутрь укороченного тела: ±150 мм '
            'по X и ±250 мм по Y (у post_1000 было ±150 / ±300, где ±300 выходит за '
            'тело 576 мм).',
            'Резьбовые болты M8 в торцы не ввёрнуты: головка DIN 912 (Ø13 x 8) на '
            'сетке ±15 мм в плите 45x45 либо выходит за габарит, либо требует '
            'цековки Ø14.5 с толщиной стенки 0.25 мм до кромки плиты. Поэтому торцы '
            'оставлены с открытыми сквозными Ø9 (крепёж ставится при монтаже), а '
            'сталь в модуле — штифты Ø6 x 2.',
            'Модуль статический: DOF нет, actions/анимации нет.',
        ],
    }
    return rep


# --- экспорт / рендер ----------------------------------------------------
EXPORT_FLAGS = dict(export_format='GLB', use_selection=True, export_apply=True,
                    export_yup=True, export_extras=True,
                    export_cameras=False, export_lights=False)


def export(root):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    objs = [root] + obj_mesh_objs(root)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = OUT_DIR / (CID + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), **EXPORT_FLAGS)
    if not path.is_file() or path.stat().st_size < 15000:
        raise RuntimeError('export too small: %s' % path)
    return path


def render_views(root):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 896
    scene.render.resolution_y = 896
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -1.30
    try:
        scene.eevee.taa_render_samples = 96
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.560, 0.566, 0.585, 1.0)
    bg.inputs['Strength'].default_value = 1.15

    meshes = obj_mesh_objs(root)
    mn, mx = bbox_of(meshes)
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0.0, 0.0, mn.z - 0.0006))
    floor = bpy.context.object
    floor.name = 'render_floor'
    floor.data.materials.append(make_mat('render_floor_mat', (0.300, 0.298, 0.294), 0.88))

    for name, loc, energy, size in (
            ('key', (0.70, -0.95, 1.10), 92.0, 1.20),
            ('fill', (-1.25, -0.95, 0.60), 38.0, 1.80),
            ('rim', (-0.30, 1.00, 0.85), 70.0, 1.20),
            ('top', (0.10, -0.15, 1.70), 12.0, 1.60)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc)
        lo.rotation_euler = (Vector((0.0, 0.0, 0.0)) - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized())

    def fit_dist(direction, lens, corners, margin=1.10):
        right, up, back = cam_basis(direction)
        th = cam_data.sensor_width * 0.5 / lens
        tv = th * scene.render.resolution_y / scene.render.resolution_x
        need = 0.0
        for p in corners:
            need = max(need, abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z)) for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(fill, region=None):
        worst = 0.0
        for ob in meshes:
            mw = ob.matrix_world
            for v in ob.data.vertices:
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

    c_main = box_corners(mn, mx)
    # side: верхние 150 мм стойки — торец + уход пазов в профиль
    side_lo = Vector((-0.026, -0.026, 0.150))
    side_hi = Vector((0.026, 0.026, LENGTH * 0.5 + 0.0015))
    side_t = (side_lo + side_hi) * 0.5
    c_side = box_corners(side_lo, side_hi)
    # closeup: верхняя плита целиком (4x M8 + Ø6) + прилегающий участок паза
    close_lo = Vector((-0.024, -0.024, 0.236))
    close_hi = Vector((0.024, 0.024, LENGTH * 0.5 + 0.0015))
    close_t = (close_lo + close_hi) * 0.5
    c_close = box_corners(close_lo, close_hi)

    views = [
        ('3q', (0.60, -0.79, 0.15), center, 48, c_main, 0.945, None),
        ('front', (0.02, -0.999, 0.04), center, 120, c_main, 0.960, None),
        ('side', (-0.985, -0.155, 0.075), side_t, 105, c_side, 0.90, (side_lo, side_hi)),
        ('closeup', (0.46, -0.66, 0.60), close_t, 85, c_close, 0.92, (close_lo, close_hi)),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, region in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(12):
            got = max_ndc(fill, region)
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = OUT_DIR / (tag + '.png')
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append({'view': tag, 'path': str(fp.relative_to(PROJECT)),
                     'fill': round(max_ndc(fill, region), 3)})
        log('RENDERED', tag, fp)
    return outs


def pattern_reconciliation(rep):
    """Сверка с эталонным report.json fix_post_1000 (CJ-RAIL-45).

    Читаем только чужой отчёт (read-only). Сечение, T-пазы, торцевые плиты,
    сетка M8 и штифт должны совпасть с эталоном; длина по Z отличается
    намеренно (600 против 1000) — она фиксируется отдельным полем
    length_delta_mm и в ok не входит.
    """
    src = PROJECT / 'docs/plans/blockout/component-library/fix_post_1000/report.json'
    out = {'source': 'fix_post_1000/report.json', 'available': False}
    if not src.is_file():
        out['reason'] = 'reference report not found (builder run independently)'
        return out
    try:
        ref = json.loads(src.read_text(encoding='utf-8'))
    except Exception as exc:                     # noqa: BLE001
        out['reason'] = 'reference report unreadable: %s' % exc
        return out
    out['available'] = True
    out['reference_all_ok'] = bool(ref.get('checks', {}).get('all_ok'))

    def grid(iface):
        return sorted(tuple(h['grid_mm']) for h in iface['m8'])

    mine = rep['interfaces']['end_top']
    ref_a = ref['interfaces']['end_top']
    out['m8_grid_match'] = grid(mine) == grid(ref_a)
    out['m8_grid_mm'] = grid(mine)
    out['hole_dia_match'] = (all(abs(h['dia_mm'][0] - 9.0) <= 0.45 for h in mine['m8']) and
                            all(abs(h['dia_mm'][0] - 9.0) <= 0.45 for h in ref_a['m8']))
    out['pin_center_match'] = (abs(mine['pin']['center_m'][0]) < 1e-6 and
                               abs(mine['pin']['center_m'][1]) < 1e-6 and
                               abs(ref_a['pin']['center_m'][0]) < 1e-6 and
                               abs(ref_a['pin']['center_m'][1]) < 1e-6)
    out['pin_dia_match'] = (abs(mine['pin']['dia_mm'] - ref_a['pin']['dia_mm']) < 1e-6)
    out['plate_match'] = mine['plate_mm'] == ref_a['plate_mm']
    out['profile_match'] = (rep['spec'].get('profile_mm') == ref['spec'].get('profile_mm'))
    out['slot_match'] = (rep['spec']['slot']['mouth_mm'] == ref['spec']['slot']['mouth_mm'] and
                         rep['spec']['slot']['cavity_mm'] == ref['spec']['slot']['cavity_mm'] and
                         rep['spec']['slot']['depth_mm'] == ref['spec']['slot']['depth_mm'])
    out['length_mine_mm'] = rep['spec']['length_mm']
    out['length_ref_mm'] = ref['spec']['length_mm']
    out['length_delta_mm'] = round(rep['spec']['length_mm'] - ref['spec']['length_mm'], 2)
    out['length_delta_intentional'] = abs(out['length_delta_mm'] + 400.0) < 1e-6
    ref_axis = ref.get('bbox_m', {}).get('size', [])
    ref_long = max(range(3), key=lambda i: ref_axis[i]) if ref_axis else None
    my_axis = rep['bbox_m']['size']
    my_long = max(range(3), key=lambda i: my_axis[i])
    out['long_axis_ref'] = 'XYZ'[ref_long] if ref_long is not None else None
    out['long_axis_mine'] = 'XYZ'[my_long]
    out['orientation_same'] = ref_long == my_long
    out['plane_ref'] = ref_a['plane']
    out['plane_mine'] = mine['plane']
    cross_mine = [my_axis[0], my_axis[1]]
    cross_ref = [ref_axis[0], ref_axis[1]] if ref_axis else None
    out['cross_section_match'] = (cross_ref is not None and
                                  all(abs(a - b) <= 1e-6
                                      for a, b in zip(cross_mine, cross_ref)))
    out['ok'] = (out['available'] and out['reference_all_ok'] and
                 out['m8_grid_match'] and out['hole_dia_match'] and
                 out['pin_center_match'] and out['pin_dia_match'] and
                 out['plate_match'] and out['slot_match'] and
                 out['profile_match'] and out['cross_section_match'] and
                 out['orientation_same'] and out['length_delta_intentional'])
    return out


def main():
    root, body, caps, dowels, nuts, mass, area = build()
    log('built nodes:', len(obj_mesh_objs(root)))

    rep = check(mass, area, root, body, caps, dowels, nuts)
    rep['pattern_reconciliation'] = pattern_reconciliation(rep)
    root['cj_id'] = CID
    root['cj_standard'] = 'CJ-RAIL-45'
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_orient'] = 'vertical, long axis +Z, cross-section XY'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_interfaces'] = json.dumps(rep['interfaces'], ensure_ascii=False)

    path = export(root)
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['export'] = {'use_selection': True, 'export_apply': True, 'export_yup': True,
                     'export_extras': True, 'export_cameras': False, 'export_lights': False}

    if SKIP_RENDER:
        log('render skipped (CJ_SKIP_RENDER=1)')
    else:
        rep['renders'] = render_views(root)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    log('CHECKS all_ok =', rep['checks']['all_ok'])
    if not rep['checks']['all_ok']:
        log('CHECKS FAILED',
            json.dumps({k: v for k, v in rep['checks'].items() if k.endswith('_ok') and not v}))
        print('CHECKS_FAILED', flush=True)
        sys.exit(3)
    print('BUILD_OK', flush=True)


if __name__ == '__main__':
    main()
