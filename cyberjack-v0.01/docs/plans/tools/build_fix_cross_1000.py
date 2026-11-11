#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_cross_1000 — поперечный рельс 45x45x1000, стандарт CJ-RAIL-45.

Standalone builder (cross-деталь). Не трогает общий builder/catalog/pages/rail/node
и не импортирует чужие GLB.

    blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_cross_1000.py

Отличие от fix_rail_1000 (cross-деталь):
  * НЕТ розового акцента: оба торца — graphite/neutral, интерфейсы идентичны;
  * штифт Ø6 стоит на КАЖДОМ торце (симметрия end_a == end_b, заподлицо);
  * материалов 4: ivory body / graphite slot / graphite insert / steel.

Геометрия:
  * профиль 45x45, длина 1000 мм по X, центр в начале координат;
  * четыре продольных T-паза: устье 10 мм, полость 20 мм, глубина 12 мм;
  * торцевые плиты 45x45x12 (по одной на торец), внутри габарита 45x45;
  * 4x M8 (Ø9) сквозных по сетке +-15 мм на каждом торце + центральное Ø6.1;
  * по штифту Ø6 в каждом торце (посадка 24 мм, заподлицо);
  * 4 T-гайки (drop-in) в пазах на монтажных позициях с шагом 50 мм;
  * фаски 1.0-1.5 мм по рёбрам.
"""

import bpy
import bmesh
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

from mathutils import Matrix, Vector

# --- константы модуля ----------------------------------------------------
CID = 'fix_cross_1000'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001
LENGTH = 1000.0 * MM        # габарит по X = 1.000 м
PROFILE = 45.0 * MM         # 45x45
HALF = PROFILE * 0.5

SLOT_MOUTH = 10.0 * MM      # устье T-паза
SLOT_MOUTH_DEPTH = 5.0 * MM  # глубина устья (толщина губки)
SLOT_CAVITY = 20.0 * MM     # ширина полости
SLOT_DEPTH = 12.0 * MM      # полная глубина паза

M8_D = 9.0 * MM             # отверстие под M8
PIN_D = 6.0 * MM            # штифт
PIN_BORE = 6.1 * MM         # гнездо штифта (посадка с зазором 0.1)
PIN_ENGAGE = 24.0 * MM      # посадка штифта в гнездо
BOLT_GRID = 15.0 * MM       # сетка +-15 мм
HOLE_PITCH = 50.0 * MM      # шаг монтажных позиций

CAP_T = 12.0 * MM           # толщина торцевой плиты (45x45x12)
CAP_A_X0, CAP_A_X1 = LENGTH * 0.5 - CAP_T, LENGTH * 0.5      # +X
CAP_B_X0, CAP_B_X1 = -LENGTH * 0.5, -LENGTH * 0.5 + CAP_T    # -X
BODY_X0, BODY_X1 = CAP_B_X1, CAP_A_X0                        # 976 мм

BEVEL_PROFILE = 1.0 * MM
BEVEL_CAP = 1.5 * MM

DENSITY = 2700.0            # алюминий, кг/м3
TNUT_RECESS = 0.4 * MM      # утопление T-гайки от поверхности паза

# оба торца — одинаковые neutral/graphite интерфейсы (cross-деталь)
ENDS = (
    ('a', +1, CAP_A_X0, CAP_A_X1),
    ('b', -1, CAP_B_X0, CAP_B_X1),
)


def log(*a):
    print('[fix_cross_1000]', *a, flush=True)


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
    # 4 материала, без акцентного цвета
    MATERIALS['body'] = make_mat('CJ_cross_matte_ivory', (0.735, 0.715, 0.668), 0.60, 0.0)
    MATERIALS['slot'] = make_mat('CJ_cross_slot_graphite', (0.082, 0.086, 0.094), 0.58, 0.15)
    MATERIALS['insert'] = make_mat('CJ_cross_insert_graphite', (0.150, 0.157, 0.168), 0.40, 0.55)
    MATERIALS['steel'] = make_mat('CJ_cross_steel', (0.520, 0.532, 0.552), 0.28, 1.0)


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
    """Bevel-модификатор по острым рёбрам (angle limit). Применяется после булевых."""
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new('bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle_deg)
    mod.use_clamp_overlap = True
    mod.miter_outer = 'MITER_ARC'
    bpy.ops.object.modifier_apply(modifier=mod.name)


# --- профиль CJ-RAIL-45 --------------------------------------------------
def profile_loop():
    """Замкнутый контур 45x45 с четырьмя T-пазами, CCW при взгляде с +X."""
    mouth_h = SLOT_MOUTH * 0.5
    cav_h = SLOT_CAVITY * 0.5
    # локально: a — вдоль грани, b — вглубь от поверхности
    side = [(-HALF, 0.0), (-mouth_h, 0.0), (-mouth_h, SLOT_MOUTH_DEPTH),
            (-cav_h, SLOT_MOUTH_DEPTH), (-cav_h, SLOT_DEPTH),
            (cav_h, SLOT_DEPTH), (cav_h, SLOT_MOUTH_DEPTH),
            (mouth_h, SLOT_MOUTH_DEPTH), (mouth_h, 0.0), (HALF, 0.0)]
    maps = (
        lambda a, b: (a, -HALF + b),           # низ, внутрь +Z, вдоль +Y
        lambda a, b: (HALF - b, a),            # +Y, внутрь -Y, вдоль +Z
        lambda a, b: (-a, HALF - b),           # верх, внутрь -Z, вдоль -Y
        lambda a, b: (-HALF + b, -a),          # -Y, внутрь +Y, вдоль -Z
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


def mesh_cyl(name, radius, length, axis='X', segs=48, r_top=None):
    """Замкнутый цилиндр (опц. усечённый конус) вдоль axis, центр в нуле."""
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
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    elif axis == 'Y':
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, 'X'))
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


def drill(name, mouth_center, radius, depth, inward_x, segs=48):
    """Сверло: торец в mouth_center, ось внутрь по знаку inward_x (+1 / -1)."""
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
    rot = Matrix.Rotation(inward_x * math.pi / 2, 3, 'Y')
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = mouth_center
    return ob


def drill_through(name, mouth_center, radius, length, inward_x, segs=40):
    """Сквозное отверстие: цилиндр от торца внутрь на length."""
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
    rot = Matrix.Rotation(inward_x * math.pi / 2, 3, 'Y')
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=rot)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.location = mouth_center
    return ob


# --- сборка --------------------------------------------------------------
def build_body(root):
    pts = profile_loop()
    bm = bmesh.new()
    verts = [bm.verts.new((BODY_X0, y, z)) for (y, z) in pts]
    bm.verts.ensure_lookup_table()
    face = bm.faces.new(verts)
    extruded = bmesh.ops.extrude_face_region(bm, geom=[face])
    new_verts = [g for g in extruded['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=new_verts, vec=(BODY_X1 - BODY_X0, 0.0, 0.0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(PREFIX + 'body')
    bm.to_mesh(me)
    bm.free()

    # гнёзда штифтов Ø6.1 в центральном ядре на ОБОИХ торцах (симметрия).
    # Булево — до фаски: exact-солвер нестабилен на сфаскованном профиле пазов.
    body = new_object(PREFIX + 'body', me, [MATERIALS['body'], MATERIALS['slot']], root)
    bpy.context.view_layer.objects.active = body
    for _tag, _sign, x0, x1 in ENDS:
        mouth = (x0 - 0.004) if _sign < 0 else (x1 + 0.004)
        cutter = drill('cut_body_pin_' + _tag, (mouth, 0.0, 0.0), PIN_BORE * 0.5,
                       CAP_T + 0.010, +_sign if _sign < 0 else -1)
        boolean_cut(body, cutter)
    # посадочные гнёзда M8 в теле за плитами (Ø7 x 22) — отверстия читаются
    # как глубокие, а не как глухие лунки в плите
    for _tag, _sign, x0, x1 in ENDS:
        for sy in (-1, 1):
            for sz in (-1, 1):
                if _sign < 0:
                    mouth = x0 - 0.006
                    inward = +1
                else:
                    mouth = x1 + 0.006
                    inward = -1
                cutter = drill('cut_body_m8_' + _tag,
                               (mouth, sy * BOLT_GRID, sz * BOLT_GRID),
                               7.0 * MM * 0.5, CAP_T + 0.028, inward, segs=32)
                boolean_cut(body, cutter)
    bevel_apply(body, BEVEL_PROFILE, segments=2)

    # грани пазов -> графит
    eps = 1e-4
    for poly in body.data.polygons:
        c = poly.center
        n = poly.normal
        slot = False
        if (HALF - SLOT_DEPTH - eps) <= c.y <= HALF + eps and abs(c.z) <= SLOT_CAVITY * 0.5 + eps and n.y <= 1e-4:
            slot = True
        elif (-HALF - eps) <= c.y <= (-HALF + SLOT_DEPTH + eps) and abs(c.z) <= SLOT_CAVITY * 0.5 + eps and n.y >= -1e-4:
            slot = True
        elif (HALF - SLOT_DEPTH - eps) <= c.z <= HALF + eps and abs(c.y) <= SLOT_CAVITY * 0.5 + eps and n.z <= 1e-4:
            slot = True
        elif (-HALF - eps) <= c.z <= (-HALF + SLOT_DEPTH + eps) and abs(c.y) <= SLOT_CAVITY * 0.5 + eps and n.z >= -1e-4:
            slot = True
        poly.material_index = 1 if slot else 0
    return body, profile_area_m2(pts)


def build_cap(root, tag, sign, x0, x1):
    """Торцевая плита 45x45x12: 4x M8 Ø9 сквозных + центральное Ø6.1.

    Оба торца — graphite/neutral (cross-деталь), акцентного цвета нет.
    """
    centre = ((x0 + x1) * 0.5, 0.0, 0.0)
    cap = mesh_box(PREFIX + 'endcap_' + tag, (x1 - x0, PROFILE, PROFILE), centre, bevel=0.0)
    face_x = x1 if sign > 0 else x0          # внешняя плоскость торца
    mouth = face_x + sign * 0.004            # старт сверла снаружи
    inward = -sign                           # направление в тело
    for sy in (-1, 1):
        for sz in (-1, 1):
            cut = drill_through('cut_' + tag, (mouth, sy * BOLT_GRID, sz * BOLT_GRID),
                                M8_D * 0.5, CAP_T + 0.020, inward, segs=40)
            boolean_cut(cap, cut)
    cut = drill_through('cut_pin_' + tag, (mouth, 0.0, 0.0), PIN_BORE * 0.5,
                        CAP_T + 0.020, inward, segs=32)
    boolean_cut(cap, cut)
    bevel_apply(cap, BEVEL_CAP, segments=2)

    for _ in range(len(cap.data.materials)):
        cap.data.materials.pop(index=0)
    cap.data.materials.append(MATERIALS['insert'])
    cap.name = PREFIX + 'endcap_' + tag
    cap.data.name = cap.name
    cap.parent = root
    cap['cj_accent'] = False
    cap['cj_role'] = 'cross end plate 45x45x12 — neutral/graphite interface'
    return cap


def mirror_cap(src, root, tag):
    """Точное зеркало плиты по X: cross-деталь требует идентичных торцов.

    Копирование меша (а не повторный булев) исключает расхождение топологии
    между endcap_a и endcap_b на уровне 1-2 треугольников.
    """
    me = src.data.copy()
    me.name = PREFIX + 'endcap_' + tag
    bm = bmesh.new()
    bm.from_mesh(me)
    for v in bm.verts:
        v.co.x = -v.co.x
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(PREFIX + 'endcap_' + tag, me)
    bpy.context.scene.collection.objects.link(ob)
    ob.parent = root
    ob.matrix_parent_inverse.identity()
    # меш ещё в локальных координатах (transform_apply идёт позже), поэтому
    # смещение объекта тоже зеркалим — иначе плита уедет в ноль
    ob.location = (round(-src.location.x, 9), src.location.y, src.location.z)
    ob.rotation_euler = src.rotation_euler
    ob['cj_accent'] = False
    ob['cj_role'] = 'cross end plate 45x45x12 — neutral/graphite interface (mirror of endcap_a)'
    ob['cj_mirrored_from'] = src.name
    return ob


def build_dowel(root, tag, sign):
    """Штифт Ø6 на торце: посадка 24 мм, заподлицо (габарит 1000 не растёт)."""
    dowel = mesh_cyl(PREFIX + 'dowel_' + tag, PIN_D * 0.5, PIN_ENGAGE, axis='X', segs=32,
                     r_top=PIN_D * 0.5 - 0.0003)
    centre_x = sign * (LENGTH * 0.5 - PIN_ENGAGE * 0.5)
    dowel.location = (centre_x, 0.0, 0.0)
    dowel.data.materials.append(MATERIALS['steel'])
    dowel.parent = root
    dowel['cj_role'] = 'locating dowel Ø6, flush with end_%s face' % tag
    return dowel


T_NUT_STATIONS = (
    ('top', -0.150, 'Z', +1),
    ('bottom', -0.300, 'Z', -1),
    ('left', 0.100, 'Y', -1),
    ('right', 0.250, 'Y', +1),
)


def build_t_nut(name, x, axis, sign, root):
    """Drop-in T-гайка: буртик Ø9.5 в устье + плитка Ø19 в полости + М8 Ø8.4."""
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
    off = -TNUT_RECESS
    if axis == 'Z':
        if sign > 0:                      # верхняя грань: внутрь -Z
            nut.rotation_euler = (math.pi, 0.0, 0.0)
            nut.location = (x, 0.0, HALF + off)
        else:
            nut.location = (x, 0.0, -HALF - off)
    else:
        if sign > 0:                      # +Y: внутрь -Y
            nut.rotation_euler = (math.pi / 2, 0.0, 0.0)
            nut.location = (x, HALF + off, 0.0)
        else:
            nut.rotation_euler = (-math.pi / 2, 0.0, 0.0)
            nut.location = (x, -HALF - off, 0.0)
    nut.data.materials.append(MATERIALS['insert'])
    nut.parent = root
    nut['cj_role'] = 'M8 drop-in T-nut in T-slot'
    nut['cj_station_x_mm'] = round(x * 1000.0, 1)
    return nut


def build():
    reset_scene()
    build_materials()
    root = bpy.data.objects.new(CID, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.08
    bpy.context.scene.collection.objects.link(root)

    body, area = build_body(root)
    caps = {}
    dowels = {}
    caps['a'] = build_cap(root, 'a', +1, CAP_A_X0, CAP_A_X1)
    caps['b'] = mirror_cap(caps['a'], root, 'b')
    for tag, sign, x0, x1 in ENDS:
        dowels[tag] = build_dowel(root, tag, sign)
    nuts = [build_t_nut(PREFIX + 't_nut_' + key, x, axis, sign, root)
            for key, x, axis, sign in T_NUT_STATIONS]
    # печём трансформы в меши: локальные координаты == мировые,
    # поэтому ray_cast и замеры работают в одной системе
    meshes = obj_mesh_objs(root)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    mass = area * (BODY_X1 - BODY_X0) * DENSITY
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


def measure_faces(body, x_sample=None):
    """Профиль T-паза по лучам на середине длины, все 4 грани.

    Каждый замер — луч из гарантированно пустой/внешней точки:
      depth  — осевой луч в центр устья (проходит устье и полость до дна);
      mouth  — бисекция осевого луча по тангенциальной координате;
      cavity — два тангенциальных луча в полости на глубине 8.5 мм;
      lip    — тангенциальный луч из полости на глубине 8.5 мм обратно наружу.
    """
    surface = HALF
    mid_depth = (SLOT_MOUTH_DEPTH + SLOT_DEPTH) * 0.5      # 8.5 мм
    xs = 0.0 if x_sample is None else x_sample
    frames = {
        'y+': (Vector((0, 1, 0)), Vector((0, 0, 1))),
        'y-': (Vector((0, -1, 0)), Vector((0, 0, 1))),
        'z+': (Vector((0, 0, 1)), Vector((0, 1, 0))),
        'z-': (Vector((0, 0, -1)), Vector((0, 1, 0))),
    }

    def proj(p, e):
        return p.dot(e)

    out = {}
    ok_all = True
    for key, (e, u) in frames.items():
        base = Vector((xs, 0.0, 0.0))

        def axial(c):
            origin = base + e * (surface + 0.060) + u * c
            p = ray(body, origin, -e)
            return None if p is None else surface - proj(p, e)

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
    """Центры и диаметры 4x M8 и центрального Ø6.1 на торце по лучам."""
    face_x = sign * LENGTH * 0.5
    x_out = sign * (LENGTH * 0.5 + 0.0008)
    d = (-sign, 0.0, 0.0)

    def through(y, z):
        p = ray(cap, (x_out, y, z), d, dist=CAP_T * 0.6)
        return p is None

    def edges(y0, z0):
        ey_p = bisect(lambda o: through(y0 + o, z0), 0.0, 0.010)
        ey_m = bisect(lambda o: through(y0 - o, z0), 0.0, 0.010)
        yc = y0 + (ey_p - ey_m) * 0.5
        ez_p = bisect(lambda o: through(yc, z0 + o), 0.0, 0.010)
        ez_m = bisect(lambda o: through(yc, z0 - o), 0.0, 0.010)
        zc = z0 + (ez_p - ez_m) * 0.5
        return yc, zc, ey_p + ey_m, ez_p + ez_m

    holes = []
    for sy in (1, -1):
        for sz in (1, -1):
            gy, gz = sy * BOLT_GRID, sz * BOLT_GRID
            yc, zc, dy, dz = edges(gy, gz)
            holes.append({
                'id': 'M8_%s%s' % ('plus' if sy > 0 else 'minus', 'plus' if sz > 0 else 'minus'),
                'grid_mm': [round(gy * 1000, 1), round(gz * 1000, 1)],
                'center_m': [round(face_x, 4), round(yc, 5), round(zc, 5)],
                'offset_from_grid_mm': [round((yc - gy) * 1000, 3), round((zc - gz) * 1000, 3)],
                'dia_mm': [round(dy * 1000, 2), round(dz * 1000, 2)],
            })
    py, pz, dpy, dpz = edges(0.0, 0.0)
    pin = {'center_m': [round(face_x, 4), round(py, 5), round(pz, 5)],
           'dia_mm': [round(dpy * 1000, 2), round(dpz * 1000, 2)]}

    holes_ok = all(abs(h['dia_mm'][0] - 9.0) <= 0.45 and abs(h['dia_mm'][1] - 9.0) <= 0.45
                   for h in holes)
    grid_ok = all(abs(h['offset_from_grid_mm'][0]) <= 0.35 and
                  abs(h['offset_from_grid_mm'][1]) <= 0.35 for h in holes)
    pin_ok = (abs(pin['dia_mm'][0] - PIN_BORE * 1000) <= 0.35 and
              abs(pin['dia_mm'][1] - PIN_BORE * 1000) <= 0.35 and
              abs(pin['center_m'][1]) < 0.0004 and abs(pin['center_m'][2]) < 0.0004)
    return holes, pin, {'holes_ok': holes_ok, 'grid_ok': grid_ok, 'pin_bore_ok': pin_ok}


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

    slot = measure_faces(body)
    # второй контрольный замер паза ближе к торцу — профиль не должен меняться
    slot_far = measure_faces(body, x_sample=BODY_X1 - 0.060)
    holes_b, pin_b, ok_b = measure_end(caps['b'], -1)
    holes_a, pin_a, ok_a = measure_end(caps['a'], +1)

    # штифты: геометрия посадки на обоих торцах
    dowel_rec = {}
    dowel_ok = True
    for tag, _sign, _x0, _x1 in ENDS:
        d_mn, d_mx = bbox_of([dowels[tag]])
        dia = round((d_mx.y - d_mn.y) * 1000.0, 2)
        ln = round((d_mx.x - d_mn.x) * 1000.0, 2)
        flush_x = (abs(d_mn.x - (-LENGTH * 0.5)) <= 0.0006 if tag == 'b'
                   else abs(d_mx.x - (LENGTH * 0.5)) <= 0.0006)
        good = (abs(dia - PIN_D * 1000) <= 0.1 and abs(ln - PIN_ENGAGE * 1000) <= 0.6 and
                flush_x and abs((d_mn.y + d_mx.y) * 0.5) < 0.0002 and
                abs((d_mn.z + d_mx.z) * 0.5) < 0.0002)
        dowel_rec[tag] = {'node': dowels[tag].name, 'dia_mm': dia, 'length_mm': ln,
                          'flush': bool(flush_x), 'ok': bool(good)}
        dowel_ok = dowel_ok and good

    # симметрия торцов (cross-деталь): end_a == end_b при зеркале по X
    sym_err_mm = 0.0
    for ha, hb in zip(holes_a, holes_b):
        sym_err_mm = max(sym_err_mm,
                         abs(ha['center_m'][0] + hb['center_m'][0]) * 1000.0,
                         abs(ha['center_m'][1] - hb['center_m'][1]) * 1000.0,
                         abs(ha['center_m'][2] - hb['center_m'][2]) * 1000.0)
    sym_err_mm = max(sym_err_mm,
                     abs(pin_a['center_m'][1] - pin_b['center_m'][1]) * 1000.0,
                     abs(pin_a['center_m'][2] - pin_b['center_m'][2]) * 1000.0)
    symmetry_ok = sym_err_mm <= 0.3
    caps_match_ok = (abs((per_obj[caps['a'].name]['verts']) -
                         (per_obj[caps['b'].name]['verts'])) == 0 and
                     abs((per_obj[caps['a'].name]['tris']) -
                         (per_obj[caps['b'].name]['tris'])) == 0)
    no_accent_ok = not any(('pink' in m.lower() or 'accent' in m.lower()) for m in mats)

    # плавающие детали: bbox-зазор до тела / плит
    def gap(a_mn, a_mx, b_mn, b_mx):
        d = 0.0
        for i in range(3):
            d = max(d, max(0.0, a_mn[i] - b_mx[i]), max(0.0, b_mn[i] - a_mx[i]))
        return d

    body_box = (body_mn, body_mx)
    cap_boxes = [bbox_of([caps[t]]) for t, _s, _x0, _x1 in ENDS]
    floating = []
    for ob in meshes:
        if ob is body:
            continue
        o_mn, o_mx = bbox_of([ob])
        g = min([gap(o_mn, o_mx, *body_box)] +
                [gap(o_mn, o_mx, *cb) for cb in cap_boxes])
        if g > 0.0015:
            floating.append({'name': ob.name, 'gap_mm': round(g * 1000.0, 2)})

    stations_mm = [s[1] * 1000.0 for s in T_NUT_STATIONS]
    pitch_ok = all(abs(x / 50.0 - round(x / 50.0)) < 1e-6 for x in stations_mm)

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
        'bbox_ok': (abs(size.x - LENGTH) <= 0.0008 and
                    abs(size.y - PROFILE) <= 0.0006 and
                    abs(size.z - PROFILE) <= 0.0006),
        'body_size_m': [round(v, 5) for v in body_size],
        'body_bbox_ok': (abs(body_size.x - (BODY_X1 - BODY_X0)) <= 0.0008 and
                         abs(body_size.y - PROFILE) <= 0.0006 and
                         abs(body_size.z - PROFILE) <= 0.0006),
        'length_budget_ok': abs((CAP_T * 2 + (BODY_X1 - BODY_X0)) - LENGTH) <= 0.0005,
        'no_negative_scale': not neg_scale,
        'negative_scale_nodes': neg_scale,
        'slot_profile': slot,
        'slot_profile_check_x_mm': round((BODY_X1 - 0.060) * 1000, 1),
        'slot_profile_far_ok_all': slot_far['ok_all'],
        'slot_ok': slot['ok_all'] and slot_far['ok_all'],
        'end_a_holes_ok': ok_a['holes_ok'] and ok_a['grid_ok'],
        'end_b_holes_ok': ok_b['holes_ok'] and ok_b['grid_ok'],
        'pin_bore_a_ok': ok_a['pin_bore_ok'],
        'pin_bore_b_ok': ok_b['pin_bore_ok'],
        'dowel_geometry_ok': dowel_ok,
        'end_symmetry_ok': symmetry_ok,
        'end_symmetry_max_error_mm': round(sym_err_mm, 4),
        'end_caps_identical_ok': caps_match_ok,
        'no_accent_ok': no_accent_ok,
        'holes_ok': (ok_a['holes_ok'] and ok_b['holes_ok'] and
                     ok_a['grid_ok'] and ok_b['grid_ok']),
        't_nut_pitch_ok': pitch_ok,
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'animation': 'none (static module)',
        'animation_ok': len(bpy.data.actions) == 0,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))

    def iface(tag, sign, holes, pin_rec, role, bore_ok):
        return {
            'role': role,
            'accent': False,
            'center_m': [sign * LENGTH * 0.5, 0.0, 0.0],
            'axis': [sign, 0.0, 0.0],
            'normal': [sign, 0.0, 0.0],
            'plane': 'YZ',
            'plate_mm': [PROFILE * 1000, PROFILE * 1000, CAP_T * 1000],
            'bolts': 'M8 x4 (Ø9 through), grid ±15 mm',
            'hole_pitch_mm': HOLE_PITCH * 1000,
            'm8': holes,
            'pin': {'dia_mm': 6.0, 'bore_dia_mm': round(PIN_BORE * 1000, 2),
                    'center_m': pin_rec['center_m'],
                    'measured_bore_mm': pin_rec['dia_mm'],
                    'inserted': True,
                    'engagement_mm': round(PIN_ENGAGE * 1000, 1),
                    'flush': dowel_rec[tag]['flush'],
                    'bore_ok': bore_ok,
                    'node': dowels[tag].name},
        }

    rep = {
        'id': CID,
        'code': 'CJ-RAIL-45',
        'name': 'Поперечина 1000',
        'kit': 'CJ-FIX-KIT',
        'class': 'STRUCTURE / cross',
        'role': 'transverse rail (кровать/рама); оба торца — равноправные интерфейсы',
        'standard': 'CJ-RAIL-45',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_cross_1000.py',
        'units': 'm',
        'spec': {
            'profile_mm': [45.0, 45.0],
            'length_mm': 1000.0,
            'body_length_mm': round((BODY_X1 - BODY_X0) * 1000, 2),
            'end_cap_mm': [45.0, 45.0, CAP_T * 1000],
            'end_cap_count': 2,
            'slot': {'mouth_mm': 10.0, 'cavity_mm': 20.0, 'depth_mm': 12.0,
                     'faces': 4, 'standard': 'T-slot 10 (CJ-RAIL-45)'},
            'bolt': 'M8',
            'hole_dia_mm': 9.0,
            'hole_pitch_mm': 50.0,
            'end_grid_mm': 15.0,
            'pin_dia_mm': 6.0,
            'material': 'Al 6063-T5 (assumed)',
            'mass_kg_nominal': 3.2,
            'accent': 'none (cross detail — both ends neutral/graphite)',
        },
        'bbox_m': {'min': [round(v, 5) for v in mn], 'max': [round(v, 5) for v in mx],
                   'size': [round(v, 5) for v in size]},
        'bbox_rail_body_m': {'min': [round(v, 5) for v in body_mn],
                             'max': [round(v, 5) for v in body_mx],
                             'size': [round(v, 5) for v in body_size]},
        'body_span_x_m': [round(BODY_X0, 5), round(BODY_X1, 5)],
        'cross_section_area_mm2': round(area * 1e6, 1),
        'mass_kg_est': round(mass, 3),
        'node_count': len(meshes) + 1,
        'nodes': [ob.name for ob in sorted(meshes, key=lambda o: o.name)],
        'root': root.name,
        'verts': verts,
        'tris': tris,
        'per_object': per_obj,
        'materials': mats,
        'material_usage': {ob.name: [m.name for m in ob.data.materials if m] for ob in meshes},
        'interfaces': {
            'end_a': iface('a', +1, holes_a, pin_a,
                           'graphite end plate (mounting interface), +X', ok_a['pin_bore_ok']),
            'end_b': iface('b', -1, holes_b, pin_b,
                           'graphite end plate (mounting interface), -X', ok_b['pin_bore_ok']),
            'slots': {'count': 4, 'mouth_mm': 10.0, 'cavity_mm': 20.0, 'depth_mm': 12.0,
                      't_nut_stations_x_mm': {k: round(x * 1000, 1) for k, x, _a, _s in T_NUT_STATIONS},
                      'station_pitch_mm': 50.0,
                      'profile': {k: v for k, v in slot.items() if k != 'ok_all'}},
        },
        'dowels': dowel_rec,
        'checks': checks,
        'renders': [],
        'glb': None,
        'glb_bytes': None,
        'notes': [
            'Cross-деталь: розового акцента нет, оба торца получили одинаковую '
            'graphite-плиту 45x45x12 и одинаковый штифт Ø6 (симметрия end_a == end_b).',
            'T-пазы выполнены реальным сечением (устье 10 мм, полость 20 мм, глубина 12 мм) '
            'и подтверждены замерами по лучам на всех четырёх гранях в двух сечениях.',
            'Внутренние поверхности пазов несут отдельный графитовый материал — контраст '
            'даёт читаемость паза без геометрического шума.',
            'Торцевые плиты 45x45x12 не выходят за профиль: тело 976 мм + 2 x 12 мм = 1000 мм.',
            'Каждый торец: 4 x M8 (Ø9, сквозные) по сетке ±15 мм + центральное Ø6.1. '
            'За торцом — массив тела, поэтому отверстия читаются как глубокие гнёзда.',
            'Штифты Ø6 на обоих торцах: посадка 24 мм, заподлицо — габарит 1000x45x45 не растёт.',
            'T-гайки (drop-in, Ø9.5 буртик в устье + Ø19 плитка в полости) стоят на '
            'монтажных позициях с шагом 50 мм; их гнёзда Ø8.4 задают интерфейс M8.',
            'Материалов 4: matte ivory / graphite slot / graphite insert / steel.',
        ],
        'deviations': [
            'Штифт Ø6 размещён по центру торца (согласовано с узлом): сетка M8 ±15 мм '
            '(Ø9, r=4.5) занимает все четыре угловых блока 12x12 профиля, поэтому '
            'угловое гнездо Ø6 перекрывается с отверстием M8.',
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
    scene.view_settings.exposure = -0.10
    try:
        scene.eevee.taa_render_samples = 128
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.560, 0.566, 0.585, 1.0)
    bg.inputs['Strength'].default_value = 0.55

    meshes = obj_mesh_objs(root)
    mn, mx = bbox_of(meshes)
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0.0, 0.0, mn.z - 0.0006))
    floor = bpy.context.object
    floor.name = 'render_floor'
    floor.data.materials.append(make_mat('render_floor_mat', (0.245, 0.243, 0.240), 0.88))

    for name, loc, energy, size in (
            ('key', (0.60, -0.85, 1.05), 110.0, 1.20),
            ('fill', (-1.15, -0.90, 0.55), 38.0, 1.80),
            ('rim', (-0.25, 0.95, 0.75), 80.0, 1.20),
            ('top', (0.10, -0.15, 1.55), 26.0, 1.60)):
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
    # closeup: торец end_a (+X, graphite) целиком — 4x M8 + Ø6 + участок паза
    close_lo = Vector((LENGTH * 0.5 - 0.050, -0.024, -0.024))
    close_hi = Vector((LENGTH * 0.5 + 0.002, 0.024, 0.024))
    close_t = (close_lo + close_hi) * 0.5
    c_close = box_corners(close_lo, close_hi)

    # side: торец + начало профиля, чтобы читалось сечение и уход пазов
    end_lo = Vector((LENGTH * 0.5 - 0.160, -0.026, -0.026))
    end_hi = Vector((LENGTH * 0.5 + 0.002, 0.026, 0.026))
    end_t = (end_lo + end_hi) * 0.5
    c_end = box_corners(end_lo, end_hi)

    views = [
        ('3q', (-0.52, -0.80, 0.33), center, 58, c_main, 0.965, None),
        ('front', (0.02, -0.985, 0.17), center, 120, c_main, 0.965, None),
        ('side', (1.00, -0.16, 0.09), end_t, 110, c_end, 0.90, (end_lo, end_hi)),
        ('closeup', (0.80, -0.50, 0.30), close_t, 85, c_close, 0.92, (close_lo, close_hi)),
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


def main():
    root, body, caps, dowels, nuts, mass, area = build()
    log('built nodes:', len(obj_mesh_objs(root)))

    rep = check(mass, area, root, body, caps, dowels, nuts)
    root['cj_id'] = CID
    root['cj_standard'] = 'CJ-RAIL-45'
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_class'] = 'STRUCTURE / cross'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_interfaces'] = json.dumps(rep['interfaces'], ensure_ascii=False)

    path = export(root)
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['export'] = {'use_selection': True, 'export_apply': True, 'export_yup': True,
                     'export_extras': True, 'export_cameras': False, 'export_lights': False}

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
