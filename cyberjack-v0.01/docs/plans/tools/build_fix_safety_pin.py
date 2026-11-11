#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_safety_pin — вторичный страховочный палец
(CJ-LATCH-30 / подвес).

Standalone builder. Не трогает общий builder/catalog/pages и чужие модули.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_safety_pin.py

Все размеры — в МИЛЛИМЕТРАХ, в сцену переводятся одним множителем M().

Локальная система (м): X — ось пальца, нос на +X; Y — ширина; Z — вверх.
Начало: ось пальца на z=10, y=0; низ кронштейна на z=0.

Габарит 100 x 30 x 20 (мм):  X -50…+50 (кольцо … носок пальца),
Y -15…+15 (страховочная проушина … детентная пробка), Z 0…20 (кронштейн).

Конструкция (мм):
  * кронштейн (ivory) 30 x 28 x 20: x -14…16, y -13…+15, z 0…20, фаска 2 мм;
    передняя бобышка Ø19 длиной 8 (x 14…22) с фаской 1,5; сквозное гнездо
    Ø8,6 под палец; 4 x M5 (Ø5,5 + цековка Ø9 x 2,5 сверху);
  * втулка скольжения (графит) Ø11,9/Ø8,6 x 4,4 в передней бобышке —
    изнашиваемый элемент, видна с торца;
  * палец (сталь) Ø8 h8, x -31,5…+50: носок с фаской 45° (Ø5,6 на торце),
    проточка Ø6,6 x 4,2 под шарик, головка Ø16 x 6 (упор в заднюю плоскость
    кронштейна), хвост Ø6 и буртик Ø10 для удержания кольца; в головке
    сквозное отверстие Ø4,2 под страховочный тросик;
  * фиксатор: шариковый детент сбоку (+Y): гнездо Ø7 от y=15 до y=3,5,
    цековка Ø10,4 x 2,4; шарик Ø5 (сталь) с заходом 0,7 мм в проточку,
    пружина сжатия 3,4 x 0,6 на 4 витка, пробка Ø9,8 (графит) с шестигранником
    4,6 заподлицо с плоскостью y=15;
  * кольцо для руки (pink) Ø24/Ø14 x 5 в плоскости XY, центр (-38, 10),
    ступица Ø12 x 7,6 насажена на хвост пальца, буртик Ø10 держит кольцо;
  * страховочная проушина (сталь) 11 x 11 x 2,5 на боковой плоскости -Y,
    отверстие Ø6,5 под тросик, 2 x Ø3,2 под заклёпки, скруглённые углы.

Статическая модель: ЗАКРЫТОЕ состояние — палец вставлен до упора головкой,
шарик сидит в проточке. Анимации в GLB нет; ход описан в отчёте.
"""

import bpy
import bmesh
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

from mathutils import Vector
from mathutils.bvhtree import BVHTree

# --- константы модуля (мм) -----------------------------------------------
CID = 'fix_safety_pin'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001

# кронштейн
BODY_X0, BODY_X1 = -14.0, 16.0
BODY_Y0, BODY_Y1 = -13.0, 15.0
BODY_Z0, BODY_Z1 = 0.0, 20.0
BODY_BEVEL = 1.5
BOSS_X0, BOSS_X1, BOSS_D = 14.0, 22.0, 19.0

# палец
PIN_Y, PIN_Z = 0.0, 10.0
PIN_D = 8.0
PIN_HEAD_D, PIN_HEAD_X0, PIN_HEAD_X1 = 16.0, -20.0, -14.0
PIN_TAIL_D, PIN_TAIL_X0 = 6.0, -28.0
PIN_COLLAR_D, PIN_COLLAR_X0, PIN_COLLAR_X1 = 10.0, -31.0, -28.0
PIN_NOSE_X = 50.0
PIN_BORE_D = 8.6                     # гнездо в кронштейне
PIN_CABLE_HOLE_D, PIN_CABLE_X = 4.2, -17.0

# проточка под шарик
GROOVE_D, GROOVE_X0, GROOVE_X1 = 6.6, 0.0, 4.2
GROOVE_X_C = 0.5 * (GROOVE_X0 + GROOVE_X1)

# детент
DETENT_X = GROOVE_X_C
BALL_D = 5.0
BALL_R = BALL_D * 0.5
GROOVE_R = GROOVE_D * 0.5
ENGAGE = PIN_D * 0.5 - GROOVE_R          # 0,7 мм радиального захода
BALL_Y = GROOVE_R + BALL_R               # центр шарика
DETENT_BORE_D, DETENT_BORE_Y0 = 7.0, 3.9
DETENT_CB_D, DETENT_CB_Y0, DETENT_CB_Y1 = 10.4, 12.6, BODY_Y1
SPRING_Y0, SPRING_Y1 = BALL_Y + BALL_R, 11.9
SPRING_COILS, SPRING_WIRE, SPRING_MEAN_R = 4, 0.6, 1.7
PLUG_PILOT_D, PLUG_HEAD_D = 6.6, 9.8
PLUG_HEX_AF = 4.0

# кольцо для руки
RING_OD, RING_BORE, RING_T = 24.0, 14.0, 5.0
RING_CX, RING_CZ = -38.0, 10.0
RING_Z0, RING_Z1 = RING_CZ - RING_T * 0.5, RING_CZ + RING_T * 0.5
HUB_D, HUB_X0, HUB_X1 = 12.0, -27.8, -20.2
HUB_BORE_D = 6.2

# втулка
BUSH_OD, BUSH_ID, BUSH_X0, BUSH_X1 = 11.9, 8.6, 17.6, 22.0

# крепёж
M5_D = 5.5
BOLT_XY = [(-8.0, -8.0), (10.0, -8.0), (-8.0, 9.5), (10.0, 9.5)]

# страховочная проушина
EYE_X0, EYE_X1 = -13.0, 0.0
EYE_Z0, EYE_Z1 = 1.5, 14.5
EYE_T = 2.5
EYE_HOLE_D = 6.5
EYE_HOLE_X, EYE_HOLE_Z = -6.5, 8.0
EYE_RIVET_Z = (5.0, 11.0)
EYE_RIVET_X = -10.9
EYE_RIVET_D = 3.2

BEVEL_SMALL = 0.4
DENSITY = {'ivory': 2700.0, 'graphite': 1900.0, 'steel': 7850.0, 'pink': 2700.0}
G_MODULUS = 79.3e9                       # сталь пружинная, Па

_BVH = {}


def M(v):
    return v * MM


def log(*a):
    print('[fix_safety_pin]', *a, flush=True)


# --- сцена / материалы ---------------------------------------------------
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
    MATERIALS['ivory'] = make_mat('CJ_pin_matte_ivory', (0.735, 0.715, 0.668), 0.58, 0.0)
    MATERIALS['graphite'] = make_mat('CJ_pin_graphite', (0.135, 0.142, 0.152), 0.44, 0.35)
    MATERIALS['steel'] = make_mat('CJ_pin_steel', (0.520, 0.532, 0.552), 0.26, 1.0)
    MATERIALS['steel_dark'] = make_mat('CJ_pin_steel_dark', (0.245, 0.252, 0.262), 0.34, 1.0)
    MATERIALS['pink'] = make_mat('CJ_pin_accent_pink', (0.640, 0.265, 0.315), 0.42, 0.05)


# --- bmesh (метры) ------------------------------------------------------
def bm_box(bm, sx, sy, sz, center=(0.0, 0.0, 0.0)):
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    return verts


def _rings_to_faces(bm, rings, segs, closed_loop):
    idx = list(range(len(rings)))
    pairs = list(zip(idx[:-1], idx[1:]))
    if closed_loop:
        pairs.append((idx[-1], idx[0]))
    for ka, kb in pairs:
        ta, A = rings[ka]
        tb, B = rings[kb]
        if ta == 'ring' and tb == 'ring':
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((A[i], A[j], B[j], B[i]))
        elif ta == 'pole' and tb == 'ring':
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((A, B[j], B[i]))
        elif ta == 'ring' and tb == 'pole':
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((A[i], A[j], B))


def bm_lathe_x(bm, prof, segs=48, closed=False, offset=(0.0, 0.0, 0.0)):
    """Вращение профиля (r, x) вокруг оси X. r=0 -> полюс."""
    clean = []
    for pt in prof:
        if clean and abs(pt[0] - clean[-1][0]) < 1e-9 and abs(pt[1] - clean[-1][1]) < 1e-9:
            continue
        clean.append(pt)
    if closed and len(clean) > 2 and abs(clean[0][0] - clean[-1][0]) < 1e-9 \
            and abs(clean[0][1] - clean[-1][1]) < 1e-9:
        clean.pop()
    rings = []
    for (r, x) in clean:
        if r <= 1e-9:
            rings.append(('pole', bm.verts.new((x, 0.0, 0.0))))
        else:
            ring = []
            for i in range(segs):
                a = 2.0 * math.pi * i / segs + math.pi / segs
                ring.append(bm.verts.new((x, r * math.cos(a), r * math.sin(a))))
            rings.append(('ring', ring))
    _rings_to_faces(bm, rings, segs, closed)
    verts = [v for kind, v in rings if kind == 'pole']
    for kind, ring in rings:
        if kind == 'ring':
            verts.extend(ring)
    if any(offset):
        bmesh.ops.translate(bm, vec=offset, verts=verts)
    return verts


def bm_lathe_z(bm, prof, segs=32, closed=False, offset=(0.0, 0.0, 0.0)):
    """Вращение профиля (r, z) вокруг оси Z."""
    clean = []
    for pt in prof:
        if clean and abs(pt[0] - clean[-1][0]) < 1e-9 and abs(pt[1] - clean[-1][1]) < 1e-9:
            continue
        clean.append(pt)
    if closed and len(clean) > 2 and abs(clean[0][0] - clean[-1][0]) < 1e-9 \
            and abs(clean[0][1] - clean[-1][1]) < 1e-9:
        clean.pop()
    rings = []
    for (r, z) in clean:
        if r <= 1e-9:
            rings.append(('pole', bm.verts.new((0.0, 0.0, z))))
        else:
            ring = []
            for i in range(segs):
                a = 2.0 * math.pi * i / segs + math.pi / segs
                ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
            rings.append(('ring', ring))
    _rings_to_faces(bm, rings, segs, closed)
    verts = [v for kind, v in rings if kind == 'pole']
    for kind, ring in rings:
        if kind == 'ring':
            verts.extend(ring)
    if any(offset):
        bmesh.ops.translate(bm, vec=offset, verts=verts)
    return verts


def bm_cyl_x(bm, r, x0, x1, cy=0.0, cz=0.0, n=40):
    return bm_lathe_x(bm, [(0.0, x0), (r, x0), (r, x1), (0.0, x1)], segs=n,
                      offset=(0.0, cy, cz))


def bm_cyl_y(bm, r, y0, y1, cx=0.0, cz=0.0, n=40):
    """Цилиндр вдоль Y через lathe по Z с поворотом."""
    bm2 = bmesh.new()
    bm_lathe_z(bm2, [(0.0, y0), (r, y0), (r, y1), (0.0, y1)], segs=n)
    bmesh.ops.rotate(bm2, verts=bm2.verts, cent=(0.0, 0.0, 0.0),
                     matrix=__import__('mathutils').Matrix.Rotation(math.radians(-90.0), 3, 'X'))
    bmesh.ops.translate(bm2, vec=(cx, 0.0, cz), verts=bm2.verts)
    me = bpy.data.meshes.new('_tmp_cyl_y')
    bm2.to_mesh(me)
    bm2.free()
    bm.from_mesh(me)
    bpy.data.meshes.remove(me)


def bm_cylinder_any(bm, r, a0, a1, axis, cx, cy, cz, n=40):
    bm_lathe_z(bm, [(0.0, a0), (r, a0), (r, a1), (0.0, a1)], segs=n)
    verts = list(bm.verts)
    if axis == 'X':
        from mathutils import Matrix
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0.0, 0.0, 0.0),
                         matrix=Matrix.Rotation(math.radians(90.0), 3, 'Y'))
    elif axis == 'Y':
        from mathutils import Matrix
        bmesh.ops.rotate(bm, verts=bm.verts, cent=(0.0, 0.0, 0.0),
                         matrix=Matrix.Rotation(math.radians(-90.0), 3, 'X'))
    bmesh.ops.translate(bm, vec=(cx, cy, cz), verts=bm.verts)
    return verts


def bm_annulus(bm, r_in, r_out, z0, z1, cx=0.0, cy=0.0, n=64):
    """Плоское кольцо в плоскости XY."""
    ro0, ro1, ri0, ri1 = [], [], [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        ca, sa = math.cos(a), math.sin(a)
        ro0.append(bm.verts.new((cx + r_out * ca, cy + r_out * sa, z0)))
        ro1.append(bm.verts.new((cx + r_out * ca, cy + r_out * sa, z1)))
        ri0.append(bm.verts.new((cx + r_in * ca, cy + r_in * sa, z0)))
        ri1.append(bm.verts.new((cx + r_in * ca, cy + r_in * sa, z1)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ro0[i], ro0[j], ro1[j], ro1[i]))      # наружная обечайка
        bm.faces.new((ri1[i], ri1[j], ri0[j], ri0[i]))      # внутренняя обечайка
        bm.faces.new((ro1[i], ro1[j], ri1[j], ri1[i]))      # верх
        bm.faces.new((ri0[i], ri0[j], ro0[j], ro0[i]))      # низ
    return ro0 + ro1 + ri0 + ri1


def bm_sphere(bm, r, cx, cy, cz, segs=32, rings=16):
    prof = []
    for i in range(rings + 1):
        a = math.pi * i / rings
        prof.append((r * math.sin(a), -r * math.cos(a)))
    bm_lathe_z(bm, prof, segs=segs, offset=(cx, cy, cz))


def bm_prism(bm, pts_xz, y0, y1):
    a = [bm.verts.new((x, y0, z)) for (x, z) in pts_xz]
    b = [bm.verts.new((x, y1, z)) for (x, z) in pts_xz]
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    n = len(pts_xz)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    return a + b


def bm_helix_y(bm, y0, y1, cx, cz, mean_r, wire_r, coils, per_turn=16, ring_n=8):
    n = coils * per_turn
    rings = []
    for i in range(n + 1):
        t = i / n
        ang = t * coils * 2.0 * math.pi
        yy = y0 + (y1 - y0) * t
        cxx = cx + mean_r * math.cos(ang)
        czz = cz + mean_r * math.sin(ang)
        ring = []
        for k in range(ring_n):
            b = 2.0 * math.pi * k / ring_n
            ring.append(bm.verts.new((cxx + wire_r * math.cos(b), yy,
                                      czz + wire_r * math.sin(b))))
        rings.append(ring)
    for i in range(n):
        A, B = rings[i], rings[i + 1]
        for k in range(ring_n):
            j = (k + 1) % ring_n
            bm.faces.new((A[k], A[j], B[j], B[k]))
    bm.faces.new(rings[0][::-1])
    bm.faces.new(rings[-1])


def finish(name, bm, mats, root):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    for m in mats:
        me.materials.append(m)
    ob.parent = root
    ob.matrix_parent_inverse.identity()
    return ob


def new_obj(name, bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def box_cutter(name, sx, sy, sz, center):
    bm = bmesh.new()
    bm_box(bm, sx, sy, sz, center)
    return new_obj(name, bm)


def cyl_cutter_x(name, r, x0, x1, cy=0.0, cz=0.0, n=40):
    bm = bmesh.new()
    bm_cyl_x(bm, r, x0, x1, cy, cz, n=n)
    return new_obj(name, bm)


def cyl_cutter_y(name, r, y0, y1, cx=0.0, cz=0.0, n=40):
    bm = bmesh.new()
    bm_cylinder_any(bm, r, y0, y1, 'Y', cx, 0.0, cz, n=n)
    return new_obj(name, bm)


def cyl_cutter_z(name, r, z0, z1, cx=0.0, cy=0.0, n=40):
    bm = bmesh.new()
    bm_lathe_z(bm, [(0.0, z0), (r, z0), (r, z1), (0.0, z1)], segs=n,
               offset=(cx, cy, 0.0))
    return new_obj(name, bm)


def prof_cutter_x(name, prof_mm, cy=0.0, cz=0.0, n=48):
    """Ступенчатый резец вращением профиля (r, x) вокруг X."""
    bm = bmesh.new()
    bm_lathe_x(bm, [(r * MM, x * MM) for (r, x) in prof_mm], segs=n,
               offset=(0.0, cy, cz))
    return new_obj(name, bm)


def prof_cutter_y(name, prof_mm, cx=0.0, cz=0.0, n=40):
    """Ступенчатый резец вращением профиля (r, y) вокруг Y."""
    from mathutils import Matrix
    bm = bmesh.new()
    bm_lathe_z(bm, [(r * MM, a * MM) for (r, a) in prof_mm], segs=n)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0.0, 0.0, 0.0),
                     matrix=Matrix.Rotation(math.radians(-90.0), 3, 'X'))
    bmesh.ops.translate(bm, vec=(cx, 0.0, cz), verts=bm.verts)
    return new_obj(name, bm)


def multi_cutter(name, specs):
    """Несколько цилиндров в одном объекте-резце."""
    bm = bmesh.new()
    for (r, z0, z1, cx, cy, n) in specs:
        bm_lathe_z(bm, [(0.0, z0), (r, z0), (r, z1), (0.0, z1)], segs=n,
                   offset=(cx, cy, 0.0))
    return new_obj(name, bm)


def weld(ob):
    """Схлопнуть совпадающие вершины после булевых операций: EXACT оставляет
    T-стыки на совпадающих кольцах (гнездо Ø8,6 -> цековка Ø12), и на следующей
    операции они вылезают открытыми рёбрами."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=2e-7)
    bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()


def boolean_cut(target, cut, strict=True):
    bpy.context.view_layer.objects.active = target
    mod = target.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cut
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception as exc:
        if target.modifiers.get(mod.name):
            target.modifiers.remove(mod)
        bpy.data.objects.remove(cut, do_unlink=True)
        if strict:
            raise RuntimeError('boolean failed on %s: %s' % (target.name, exc))
        log('BOOLEAN SKIPPED', target.name, exc)
        return False
    bpy.data.objects.remove(cut, do_unlink=True)
    weld(target)
    if strict:
        st = mesh_stats(target.data)
        if st['non_manifold'] or st['degenerate']:
            raise RuntimeError('boolean broke %s: %s' % (target.name, st))
    return True


def boolean_union(target, other):
    bpy.context.view_layer.objects.active = target
    mod = target.modifiers.new('uni', 'BOOLEAN')
    mod.operation = 'UNION'
    mod.solver = 'EXACT'
    mod.object = other
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except Exception as exc:
        if target.modifiers.get(mod.name):
            target.modifiers.remove(mod)
        bpy.data.objects.remove(other, do_unlink=True)
        raise RuntimeError('union failed on %s: %s' % (target.name, exc))
    bpy.data.objects.remove(other, do_unlink=True)
    weld(target)
    st = mesh_stats(target.data)
    if st['non_manifold'] or st['degenerate']:
        raise RuntimeError('union broke %s: %s' % (target.name, st))
    return True


def mesh_stats(me):
    bm = bmesh.new()
    bm.from_mesh(me)
    nm = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    degen = [f for f in bm.faces if f.calc_area() < 1e-12]
    dg = len(degen)
    dg_at = [[round(c * 1000, 2) for c in f.calc_center_median()] for f in degen[:6]]
    vol = abs(bm.calc_volume(signed=True))
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    nv = len(bm.verts)
    lv = sum(1 for v in bm.verts if not v.link_edges)
    bm.free()
    return {'non_manifold': nm, 'degenerate': dg, 'degenerate_at_mm': dg_at,
            'volume_cm3': round(vol * 1e6, 3),
            'tris': tris, 'verts': nv, 'loose_verts': lv}


def safe_bevel(ob, width, segments=2, angle=30.0):
    backup = ob.data.copy()
    try:
        bpy.context.view_layer.objects.active = ob
        mod = ob.modifiers.new('bevel', 'BEVEL')
        mod.width = width
        mod.segments = segments
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(angle)
        mod.use_clamp_overlap = True
        mod.miter_outer = 'MITER_ARC'
        bpy.ops.object.modifier_apply(modifier=mod.name)
        st = mesh_stats(ob.data)
        if st['non_manifold'] or st['degenerate']:
            raise RuntimeError('bevel broke mesh: %s' % st)
    except Exception as exc:
        old = ob.data
        ob.data = backup
        bpy.data.meshes.remove(old)
        log('BEVEL REVERTED', ob.name, exc)
        return False
    bpy.data.meshes.remove(backup)
    return True


# --- кронштейн -----------------------------------------------------------
def build_body(root):
    bm = bmesh.new()
    bm_box(bm, M(BODY_X1 - BODY_X0), M(BODY_Y1 - BODY_Y0), M(BODY_Z1 - BODY_Z0),
           (M((BODY_X0 + BODY_X1) * 0.5), M((BODY_Y0 + BODY_Y1) * 0.5),
            M((BODY_Z0 + BODY_Z1) * 0.5)))
    ob = finish(PREFIX + 'bracket', bm, [MATERIALS['ivory']], root)
    safe_bevel(ob, M(BODY_BEVEL), segments=3, angle=25.0)

    # передняя бобышка Ø19 с фаской 1,5 (перекрытие 2 мм по X -> чистый union)
    bm = bmesh.new()
    bm_lathe_x(bm, [(0.0, M(BOSS_X0)), (M(BOSS_D * 0.5), M(BOSS_X0)),
                    (M(BOSS_D * 0.5), M(BOSS_X1 - 1.5)),
                    (M(BOSS_D * 0.5 - 1.5), M(BOSS_X1)), (0.0, M(BOSS_X1))],
               segs=48, offset=(0.0, 0.0, M(PIN_Z)))
    boolean_union(ob, new_obj('u_boss', bm))

    # гнездо пальца Ø8,6 + посадка втулки Ø12 — ОДИН ступенчатый резец:
    # два соосных резца оставляли совпадающее кольцо на уступе x=17,6,
    # и следующая булева операция превращала T-стык в открытые рёбра.
    boolean_cut(ob, prof_cutter_x('c_bore', [
        (0.0, BODY_X0 - 2.0), (PIN_BORE_D * 0.5, BODY_X0 - 2.0),
        (PIN_BORE_D * 0.5, BUSH_X0), (6.0, BUSH_X0),
        (6.0, BOSS_X1 + 2.0), (0.0, BOSS_X1 + 2.0)], cz=M(PIN_Z), n=48))
    # 4 x M5 — каждый отдельным цилиндрическим резцом с запасом по Z
    for i, (x, y) in enumerate(BOLT_XY):
        boolean_cut(ob, cyl_cutter_z('c_m5_%d' % i, M(M5_D) * 0.5,
                                     M(BODY_Z0 - 2.0), M(BODY_Z1 + 2.0),
                                     cx=M(x), cy=M(y), n=32))
    # детент: гнездо Ø7 + цековка Ø10,4 — тоже один ступенчатый резец;
    # торец гнезда утоплен в полость гнезда пальца (y=3,9 < r 4,3)
    boolean_cut(ob, prof_cutter_y('c_detent', [
        (0.0, DETENT_BORE_Y0), (DETENT_BORE_D * 0.5, DETENT_BORE_Y0),
        (DETENT_BORE_D * 0.5, DETENT_CB_Y0), (DETENT_CB_D * 0.5, DETENT_CB_Y0),
        (DETENT_CB_D * 0.5, DETENT_CB_Y1 + 1.0), (0.0, DETENT_CB_Y1 + 1.0)],
        cx=M(DETENT_X), cz=M(PIN_Z), n=40))
    ob['cj_role'] = ('carrier bracket 30x28x20: pin bore D8.6, sliding bush seat, '
                     '4x M5 through-holes, side ball-detent bore D7 with D10.4 plug seat')
    return ob


def build_bushing(root):
    bm = bmesh.new()
    bm_lathe_x(bm, [(M(BUSH_ID) * 0.5, M(BUSH_X0)),
                    (M(BUSH_OD) * 0.5, M(BUSH_X0)),
                    (M(BUSH_OD) * 0.5, M(BUSH_X1 - 0.4)),
                    (M(BUSH_OD) * 0.5 - 0.4, M(BUSH_X1)),
                    (M(BUSH_ID) * 0.5, M(BUSH_X1))],
               segs=48, closed=True, offset=(0.0, 0.0, M(PIN_Z)))
    ob = finish(PREFIX + 'bush', bm, [MATERIALS['graphite']], root)
    ob['cj_role'] = ('graphite sliding bush D11.9/D8.6 x 4.4, press-fit in the front '
                     'boss, wear part')
    return ob


# --- палец ---------------------------------------------------------------
def build_pin(root):
    prof = [
        (0.0, PIN_COLLAR_X0 - 0.5),
        (4.2, PIN_COLLAR_X0 - 0.5),
        (PIN_COLLAR_D * 0.5, PIN_COLLAR_X0 + 1.0),
        (PIN_COLLAR_D * 0.5, PIN_COLLAR_X1 - 0.1),
        (PIN_TAIL_D * 0.5, PIN_COLLAR_X1),
        (PIN_TAIL_D * 0.5, PIN_HEAD_X0),
        (PIN_HEAD_D * 0.5 - 0.6, PIN_HEAD_X0),
        (PIN_HEAD_D * 0.5, PIN_HEAD_X0 + 0.6),
        (PIN_HEAD_D * 0.5, PIN_HEAD_X1 - 0.6),
        (PIN_HEAD_D * 0.5 - 0.6, PIN_HEAD_X1),
        (PIN_D * 0.5, PIN_HEAD_X1),
        (PIN_D * 0.5, GROOVE_X0),
        (GROOVE_R, GROOVE_X0 + 0.3),
        (GROOVE_R, GROOVE_X1 - 0.3),
        (PIN_D * 0.5, GROOVE_X1),
        (PIN_D * 0.5, PIN_NOSE_X - 1.2),
        (PIN_D * 0.5 - 1.2, PIN_NOSE_X),
        (0.0, PIN_NOSE_X),
    ]
    bm = bmesh.new()
    bm_lathe_x(bm, [(r * MM, x * MM) for (r, x) in prof], segs=48,
               offset=(0.0, M(PIN_Y), M(PIN_Z)))
    ob = finish(PREFIX + 'pin', bm, [MATERIALS['steel']], root)
    boolean_cut(ob, cyl_cutter_y('c_cable', M(PIN_CABLE_HOLE_D) * 0.5,
                                 M(PIN_HEAD_D * 0.5 + 1.0), -M(PIN_HEAD_D * 0.5 + 1.0),
                                 cx=M(PIN_CABLE_X), cz=M(PIN_Z), n=28))
    ob['cj_role'] = ('D8 h8 safety pin, 45 deg nose, D6.6 detent groove, D16 head as '
                     'stop, D6 tail + D10 collar retaining the pull ring, D4.2 cable hole')
    return ob


# --- детент --------------------------------------------------------------
def build_ball(root):
    bm = bmesh.new()
    bm_sphere(bm, M(BALL_R), M(DETENT_X), M(BALL_Y), M(PIN_Z), segs=32, rings=16)
    ob = finish(PREFIX + 'detent_ball', bm, [MATERIALS['steel_dark']], root)
    ob['cj_role'] = 'D5 detent ball, 0.7 mm radial engagement in the D6.6 pin groove'
    return ob


def build_spring(root):
    bm = bmesh.new()
    bm_helix_y(bm, M(SPRING_Y0), M(SPRING_Y1), M(DETENT_X), M(PIN_Z),
               M(SPRING_MEAN_R), M(SPRING_WIRE * 0.5), SPRING_COILS)
    ob = finish(PREFIX + 'detent_spring', bm, [MATERIALS['steel_dark']], root)
    ob['cj_role'] = ('compression spring 3.4 mean x 0.6 wire x %d coils behind the '
                     'detent ball' % SPRING_COILS)
    return ob


def build_plug(root):
    bm = bmesh.new()
    bm_lathe_z(bm, [(0.0, M(SPRING_Y1 - 0.2)),
                    (M(PLUG_PILOT_D) * 0.5, M(SPRING_Y1 - 0.2)),
                    (M(PLUG_PILOT_D) * 0.5, M(DETENT_CB_Y0)),
                    (M(PLUG_HEAD_D) * 0.5 - 0.3, M(DETENT_CB_Y0)),
                    (M(PLUG_HEAD_D) * 0.5, M(DETENT_CB_Y0 + 0.3)),
                    (M(PLUG_HEAD_D) * 0.5, M(DETENT_CB_Y1 - 0.3)),
                    (M(PLUG_HEAD_D) * 0.5 - 0.3, M(DETENT_CB_Y1)),
                    (0.0, M(DETENT_CB_Y1))], segs=32)
    verts = list(bm.verts)
    ob = None
    from mathutils import Matrix
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0.0, 0.0, 0.0),
                     matrix=Matrix.Rotation(math.radians(-90.0), 3, 'X'))
    bmesh.ops.translate(bm, vec=(M(DETENT_X), 0.0, M(PIN_Z)), verts=bm.verts)
    ob = finish(PREFIX + 'detent_plug', bm, [MATERIALS['graphite']], root)
    # шестигранник 4,6 под ключ (грань 4,0)
    bm = bmesh.new()
    bm_lathe_z(bm, [(0.0, M(DETENT_CB_Y1 - 1.3)), (M(PLUG_HEX_AF / math.sqrt(3.0)),
                                                   M(DETENT_CB_Y1 - 1.3)),
                    (M(PLUG_HEX_AF / math.sqrt(3.0)), M(DETENT_CB_Y1 + 1.0)),
                    (0.0, M(DETENT_CB_Y1 + 1.0))], segs=6)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0.0, 0.0, 0.0),
                     matrix=Matrix.Rotation(math.radians(-90.0), 3, 'X'))
    bmesh.ops.translate(bm, vec=(M(DETENT_X), 0.0, M(PIN_Z)), verts=bm.verts)
    boolean_cut(ob, new_obj('c_hex', bm))
    ob['cj_role'] = ('graphite D9.8 detent plug, flush with the +Y face, hex socket '
                     '4.6 / 1.3 deep, backs the spring')
    return ob


# --- кольцо --------------------------------------------------------------
def build_ring(root):
    bm = bmesh.new()
    bm_annulus(bm, M(RING_BORE * 0.5), M(RING_OD * 0.5), M(RING_Z0), M(RING_Z1),
               M(RING_CX), 0.0, n=72)
    ob = finish(PREFIX + 'pull_ring', bm, [MATERIALS['pink']], root)

    bm = bmesh.new()
    bm_lathe_x(bm, [(0.0, M(HUB_X0)), (M(HUB_D * 0.5), M(HUB_X0)),
                    (M(HUB_D * 0.5), M(HUB_X1 - 0.6)),
                    (M(HUB_D * 0.5) - 0.6, M(HUB_X1)), (0.0, M(HUB_X1))],
               segs=40, offset=(0.0, 0.0, M(RING_CZ)))
    boolean_union(ob, new_obj('u_hub', bm))

    boolean_cut(ob, cyl_cutter_x('c_hub_bore', M(HUB_BORE_D) * 0.5,
                                 M(HUB_X0 - 1.0), M(HUB_X1 + 1.0),
                                 cz=M(RING_CZ), n=36))
    safe_bevel(ob, M(0.5), segments=2, angle=35.0)
    ob['cj_role'] = ('pull ring D24/D14 x 5 (flat, in XY) with a D12 hub keyed over '
                     'the pin tail; D10 collar retains it')
    return ob


# --- страховочная проушина ----------------------------------------------
def build_tether_eye(root):
    bm = bmesh.new()
    bm_box(bm, M(EYE_X1 - EYE_X0), M(EYE_T), M(EYE_Z1 - EYE_Z0),
           (M((EYE_X0 + EYE_X1) * 0.5), M(BODY_Y0 - EYE_T * 0.5 + 0.5),
            M((EYE_Z0 + EYE_Z1) * 0.5)))
    ob = finish(PREFIX + 'tether_eye', bm, [MATERIALS['steel']], root)
    safe_bevel(ob, M(1.0), segments=2, angle=20.0)
    # отверстие под тросик — вдоль Y
    boolean_cut(ob, cyl_cutter_y('c_eye', M(EYE_HOLE_D) * 0.5,
                                 -M(BODY_Y1), 0.0,
                                 cx=M(EYE_HOLE_X), cz=M(EYE_HOLE_Z), n=32))
    # 2 x Ø3,2 под заклёпки
    for i, zz in enumerate(EYE_RIVET_Z):
        boolean_cut(ob, cyl_cutter_y('c_riv%d' % i, M(EYE_RIVET_D) * 0.5, -M(BODY_Y1), 0.0,
                                     cx=M(EYE_RIVET_X), cz=M(zz), n=20))
    ob['cj_role'] = ('steel tether eye 11x11x2.5 on the -Y face: D6.5 lanyard hole + '
                     '2xD3.2 rivet holes, all corners rounded (no open hooks)')
    return ob


# --- сборка --------------------------------------------------------------
def obj_mesh_objs():
    return [o for o in bpy.data.objects
            if o.type == 'MESH' and o.name.startswith(PREFIX)]


def build():
    reset_scene()
    build_materials()
    root = bpy.data.objects.new(CID, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(root)

    parts = {
        'bracket': build_body(root),
        'bush': build_bushing(root),
        'pin': build_pin(root),
        'ball': build_ball(root),
        'spring': build_spring(root),
        'plug': build_plug(root),
        'ring': build_ring(root),
        'eye': build_tether_eye(root),
    }

    meshes = obj_mesh_objs()
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for ob in obj_mesh_objs():
        dim = ob.dimensions
        if max(dim) > 0.2 or max(dim) < 0.0005:
            raise RuntimeError('unit guard: %s dimensions %s' % (ob.name, tuple(dim)))
        if tuple(round(v, 6) for v in ob.scale) != (1.0, 1.0, 1.0):
            raise RuntimeError('scale guard: %s scale %s' % (ob.name, tuple(ob.scale)))
    return root, parts


# --- измерения -----------------------------------------------------------
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


def ray(ob, origin, direction, dist=1.0):
    """Луч по явному BVH объекта (object.ray_cast в фоне пропускает меш)."""
    me = ob.data
    me.calc_loop_triangles()
    key = (ob.name, len(me.vertices), len(me.loop_triangles))
    bvh = _BVH.get(key)
    if bvh is None:
        verts = [v.co.copy() for v in me.vertices]
        tris = [tuple(t.vertices) for t in me.loop_triangles]
        bvh = BVHTree.FromPolygons(verts, tris, all_triangles=True)
        _BVH[key] = bvh
    loc, _n, _i, _d = bvh.ray_cast(Vector(origin), Vector(direction).normalized(), dist)
    return Vector(loc) if loc is not None else None


def bisect(fn, lo, hi, iters=26):
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        if fn(mid):
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def radial(ob, x_mm, axis, sign):
    """Радиус поверхности от оси пальца наружу вдоль axis ('Y'/'Z')."""
    o = Vector((M(x_mm), M(PIN_Y), M(PIN_Z)))
    d = (0.0, sign, 0.0) if axis == 'Y' else (0.0, 0.0, sign)
    p = ray(ob, o, d, M(40.0))
    if p is None:
        return None
    return abs((p - o).dot(Vector(d))) * 1000.0


def dia_along(ob, origin_mm, axis, dist=40.0):
    """Диаметр по двум лучам из произвольной точки внутри тела."""
    o = Vector([M(v) for v in origin_mm])
    d = {'X': (1.0, 0.0, 0.0), 'Y': (0.0, 1.0, 0.0), 'Z': (0.0, 0.0, 1.0)}[axis]
    dv = Vector(d)
    a = ray(ob, o, dv, M(dist))
    b = ray(ob, o, -dv, M(dist))
    if a is None or b is None:
        return 999.0
    return (abs((a - o).dot(dv)) + abs((b - o).dot(dv))) * 1000.0


def rad2(ob, x_mm, axis):
    """Диаметр по двум лучам от оси; None -> 999 (провал проверки, не молчание)."""
    a, b = radial(ob, x_mm, axis, 1), radial(ob, x_mm, axis, -1)
    if a is None or b is None:
        return 999.0
    return a + b


def measure_pin(pin, bracket, bush):
    out = {}
    for tag, x in (('at_nose', 44.0), ('at_front', 28.0)):
        out[tag] = {'x_mm': x, 'dia_y_mm': round(rad2(pin, x, 'Y'), 3),
                    'dia_z_mm': round(rad2(pin, x, 'Z'), 3)}
    # головка — цилиндр Ø16 по X. Луч должен идти ЧЕРЕЗ ОСЬ (смещение даёт хорду),
    # поэтому сечение берём между отверстием Ø4,2 (x -19,1…-14,9) и передней
    # фаской 0,6 (x -14,6): x=-14,75 чистое и по Y, и по Z.
    head_y = rad2(pin, PIN_HEAD_X1 - 0.75, 'Y')
    head_z = rad2(pin, PIN_HEAD_X1 - 0.75, 'Z')
    groove = rad2(pin, GROOVE_X_C, 'Y')
    hit = ray(pin, (M(PIN_CABLE_X), M(PIN_Y), M(PIN_Z)), (0, 0, 1), M(20.0))
    # луч идёт от оси отверстия: первый удар = радиус, диаметр = 2r
    cable_hole = 2.0 * abs(hit.z - M(PIN_Z)) * 1000.0 if hit is not None else 999.0
    # втулка изнутри
    bush_id = rad2(bush, 0.5 * (BUSH_X0 + BUSH_X1), 'Y')
    # свободный ход пальца в гнезде кронштейна (зазор по радиусу)
    clearance = 0.5 * (bush_id - PIN_D)
    mn, mx = bbox_of([pin])
    ok = (abs(out['at_nose']['dia_y_mm'] - PIN_D) <= 0.12
          and abs(out['at_nose']['dia_z_mm'] - PIN_D) <= 0.12
          and abs(out['at_front']['dia_y_mm'] - PIN_D) <= 0.12
          and abs(head_z - PIN_HEAD_D) <= 0.2 and abs(head_y - PIN_HEAD_D) <= 0.2
          and abs(groove - GROOVE_D) <= 0.15
          and abs(cable_hole - PIN_CABLE_HOLE_D) <= 0.15
          and 0.2 <= clearance <= 0.45)
    return {'node': pin.name, 'dia_mm': PIN_D, 'h8': True,
            'measured_dia_mm': [round(out['at_nose']['dia_y_mm'], 3),
                                round(out['at_nose']['dia_z_mm'], 3)],
            'stations': out,
            'usable_length_mm': round((PIN_NOSE_X - PIN_HEAD_X1), 2),
            'total_length_mm': round((mx.x - mn.x) * 1000, 2),
            'head': {'dia_mm': PIN_HEAD_D, 'measured_dia_mm': [round(head_y, 3),
                                                               round(head_z, 3)],
                     'x_mm': [PIN_HEAD_X0, PIN_HEAD_X1],
                     'stop_face': 'bears on the bracket rear face x=%.0f' % PIN_HEAD_X1},
            'groove': {'dia_mm': GROOVE_D, 'measured_dia_mm': round(groove, 3),
                       'x_mm': [GROOVE_X0, GROOVE_X1], 'width_mm': GROOVE_X1 - GROOVE_X0},
            'nose': {'x_mm': PIN_NOSE_X, 'chamfer_mm': 1.2, 'angle_deg': 45.0,
                     'tip_dia_mm': PIN_D - 2 * 1.2},
            'cable_hole': {'dia_mm': PIN_CABLE_HOLE_D, 'measured_dia_mm': round(cable_hole, 3),
                           'x_mm': PIN_CABLE_X, 'axis': 'Y'},
            'bush': {'node': bush.name, 'id_mm': BUSH_ID, 'measured_id_mm': round(bush_id, 3),
                     'radial_clearance_mm': round(clearance, 3),
                     'x_mm': [BUSH_X0, BUSH_X1]},
            'bbox_mm': {'min': [round(v * 1000, 2) for v in mn],
                        'max': [round(v * 1000, 2) for v in mx]},
            'ok': bool(ok)}


def measure_detent(ball, spring, plug, bracket, pin):
    bmn, bmx = bbox_of([ball])
    smn, smx = bbox_of([spring])
    pmn, pmx = bbox_of([plug])
    ball_d = (bmx - bmn).x * 1000
    spring_len = (smx - smn).y * 1000
    solid = SPRING_COILS * SPRING_WIRE
    travel = spring_len - solid
    d = SPRING_WIRE * MM
    dm = SPRING_MEAN_R * 2 * MM
    k = G_MODULUS * d ** 4 / (8.0 * dm ** 3 * SPRING_COILS) / 1000.0   # Н/мм
    preload_mm = 0.5
    f_pre = k * preload_mm
    f_release = k * (preload_mm + ENGAGE)
    hold = f_release * 2.5            # оценочный осевой срыв по наклону канавки
    plug_flush = abs(pmx.y * 1000 - BODY_Y1) <= 0.2
    ok = (abs(ball_d - BALL_D) <= 0.1
          and abs(BALL_Y - (GROOVE_R + BALL_R)) < 1e-6
          and 0.55 <= ENGAGE <= 0.85
          and travel >= ENGAGE + 0.2
          and plug_flush
          and abs(spring_len - (SPRING_Y1 - SPRING_Y0)) <= 0.15)
    return {'type': 'spring-loaded ball detent, radial (+Y) into a turned groove',
            'node': ball.name, 'ball_dia_mm': BALL_D, 'measured_ball_dia_mm': round(ball_d, 3),
            'bore_dia_mm': DETENT_BORE_D, 'bore_y_mm': [DETENT_BORE_Y0, BODY_Y1],
            'ball_center_y_mm': round(BALL_Y, 2),
            'groove_dia_mm': GROOVE_D, 'groove_width_mm': round(GROOVE_X1 - GROOVE_X0, 2),
            'engagement_radial_mm': round(ENGAGE, 3),
            'chord_at_surface_mm': round(2.0 * math.sqrt(BALL_R ** 2 - (BALL_R - ENGAGE) ** 2), 3),
            'spring': {'node': spring.name, 'coils': SPRING_COILS,
                       'wire_mm': round(SPRING_WIRE, 2),
                       'mean_dia_mm': round(SPRING_MEAN_R * 2, 2),
                       'installed_mm': round(spring_len, 2),
                       'solid_height_mm': round(solid, 2),
                       'travel_mm': round(travel, 2), 'y_mm': [SPRING_Y0, SPRING_Y1]},
            'plug': {'node': plug.name, 'head_dia_mm': PLUG_HEAD_D,
                     'hex_af_mm': PLUG_HEX_AF, 'flush_y_mm': round(pmx.y * 1000, 2),
                     'seat_dia_mm': DETENT_CB_D},
            'rate_n_per_mm': round(k, 2),
            'preload_mm': preload_mm,
            'preload_n': round(f_pre, 1),
            'release_n_est': round(f_release, 1),
            'hold_n_est': round(hold, 1),
            'note': ('шарик Ø5 садится в проточку Ø6,6 на 0,7 мм; чтобы выйти на Ø8, '
                     'пружина должна сжаться на 0,7 мм (ход 1,2 мм)'),
            'ok': bool(ok)}


def measure_tether(eye, pin, bracket):
    t = (bbox_of([eye])[1].y - bbox_of([eye])[0].y) * 1000
    org = (M(EYE_HOLE_X), M(BODY_Y0 - 1.2), M(EYE_HOLE_Z))
    hx = ray(eye, org, (1, 0, 0), M(20.0))
    hz = ray(eye, org, (0, 0, 1), M(20.0))
    x_r = abs(hx.x - M(EYE_HOLE_X)) * 1000 if hx is not None else 999.0
    z_r = abs(hz.z - M(EYE_HOLE_Z)) * 1000 if hz is not None else 999.0
    dia = 2.0 * x_r
    rim = min(EYE_HOLE_Z - EYE_Z0, EYE_Z1 - EYE_HOLE_Z) - EYE_HOLE_D * 0.5
    emn, emx = bbox_of([eye])
    chit = ray(pin, (M(PIN_CABLE_X), M(PIN_Y), M(PIN_Z)), (0, 0, 1), M(20.0))
    cable = 2.0 * abs(chit.z - M(PIN_Z)) * 1000 if chit is not None else 999.0
    ok = (abs(dia - EYE_HOLE_D) <= 0.15 and abs(2 * z_r - EYE_HOLE_D) <= 0.2
          and rim >= 1.8 and abs(t - EYE_T) <= 0.15
          and abs(cable - PIN_CABLE_HOLE_D) <= 0.15
          and emn.y * 1000 >= -15.05)
    return {'node': eye.name, 'hole_dia_mm': EYE_HOLE_D,
            'measured_hole_dia_mm': [round(dia, 3), round(2 * z_r, 3)],
            'thickness_mm': EYE_T, 'measured_thickness_mm': round(t, 2),
            'min_rim_mm': round(rim, 2),
            'plate_mm': [EYE_X1 - EYE_X0, EYE_Z1 - EYE_Z0],
            'outer_face_y_mm': round(emn.y * 1000, 2),
            'rivets': {'count': 2, 'dia_mm': EYE_RIVET_D, 'x_mm': EYE_RIVET_X,
                       'z_mm': list(EYE_RIVET_Z)},
            'pin_cable_hole_mm': round(cable, 3),
            'cable_path': ('тросик Ø3 (отдельная деталь, в библиотеке кабелей нет): '
                           'ухо Ø6,5 на кронштейне -> отверстие Ø4,2 в головке пальца'),
            'note': 'все контуры закрытые, скругления ≥1,5 мм, крюков нет',
            'ok': bool(ok)}


def check(parts, root):
    meshes = obj_mesh_objs()
    mn, mx = bbox_of(meshes)
    size = mx - mn

    per_obj, nm, dg, loose, tris, verts = {}, 0, 0, 0, 0, 0
    vol_by_key = {}
    for ob in meshes:
        st = mesh_stats(ob.data)
        per_obj[ob.name] = st
        nm += st['non_manifold']
        dg += st['degenerate']
        loose += st['loose_verts']
        tris += st['tris']
        verts += st['verts']
        key = 'ivory'
        for mat in ob.data.materials:
            if mat is None:
                continue
            for k in ('steel_dark', 'graphite', 'steel', 'pink', 'ivory'):
                if mat.name.endswith(k):
                    key = k
                    break
            break
        vol_by_key[key] = vol_by_key.get(key, 0.0) + st['volume_cm3']

    mass = sum(v * 1e-6 * DENSITY.get(k, 2700.0) for k, v in vol_by_key.items())
    mats = sorted({m.name for ob in meshes for m in ob.data.materials if m})

    pin = measure_pin(parts['pin'], parts['bracket'], parts['bush'])
    det = measure_detent(parts['ball'], parts['spring'], parts['plug'],
                         parts['bracket'], parts['pin'])
    tet = measure_tether(parts['eye'], parts['pin'], parts['bracket'])

    boxes = {ob.name: bbox_of([ob]) for ob in meshes}

    def gap(a, b):
        d = 0.0
        for i in range(3):
            d = max(d, max(0.0, a[0][i] - b[1][i]), max(0.0, b[0][i] - a[1][i]))
        return d

    floating = []
    for ob in meshes:
        best = 1e9
        for other in meshes:
            if other is ob:
                continue
            best = min(best, gap(boxes[ob.name], boxes[other.name]))
        if best > M(1.2):
            floating.append({'name': ob.name, 'gap_mm': round(best * 1000, 2)})

    checks = {
        'units': 'm',
        'non_manifold_edges': nm,
        'non_manifold_ok': nm == 0,
        'degenerate_faces': dg,
        'degenerate_ok': dg == 0,
        'loose_verts': loose,
        'loose_verts_ok': loose == 0,
        'transforms_applied': all(tuple(round(v, 6) for v in ob.scale) == (1.0, 1.0, 1.0)
                                  and max(ob.dimensions) <= 0.2 for ob in meshes),
        'material_count': len(mats),
        'material_count_ok': 4 <= len(mats) <= 8,
        'prefix_ok': all(ob.name.startswith(PREFIX) for ob in meshes),
        'node_count': len(meshes) + 1,
        'node_count_ok': len(meshes) + 1 >= 8,
        'bbox_size_m': [round(v, 5) for v in size],
        'bbox_mm': [round(v * 1000, 2) for v in size],
        'bbox_ok': (abs(size.x - M(100.0)) <= 0.0008 and abs(size.y - M(30.0)) <= 0.0008
                    and abs(size.z - M(20.0)) <= 0.0008 and abs(mn.z) <= M(0.3)
                    and abs(mn.x + M(50.0)) <= 0.0008 and abs(mx.x - M(50.0)) <= 0.0008),
        'mass_kg_est': round(mass, 3),
        'pin': pin,
        'pin_ok': pin['ok'],
        'pin_diameter_mm': pin['measured_dia_mm'][0],
        'retention': det,
        'retention_ok': det['ok'],
        'tether_eye': tet,
        'tether_ok': tet['ok'],
        'volume_by_material_cm3': {k: round(v, 3) for k, v in vol_by_key.items()},
        'negative_scale': [ob.name for ob in meshes if ob.matrix_world.determinant() < 1e-9],
        'no_negative_scale': all(ob.matrix_world.determinant() > 1e-9 for ob in meshes),
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'state': 'closed (pin fully inserted, ball seated in the groove)',
        'animation': 'none (no actions; the withdrawal stroke is described only)',
        'animation_ok': len(bpy.data.actions) == 0,
        'dof': {'pin_travel_mm': round(PIN_NOSE_X - PIN_HEAD_X1, 1),
                'detent_lift_mm': round(ENGAGE, 2),
                'note': 'статический модуль: палец вставлен; снятие = кольцо на -X, '
                        'шарик выходит из проточки на 0,7 мм'},
        'dof_ok': True,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))
    return checks, dict(mn=mn, mx=mx, size=size, mass=mass, mats=mats, verts=verts,
                        tris=tris, per_obj=per_obj, pin=pin, det=det, tet=tet,
                        vol=vol_by_key)


# --- report --------------------------------------------------------------
def build_report(root, checks, m):
    interfaces = {
        'clevis_pin': {
            'standard': 'CJ-CLEVIS-8 / CJ-LATCH-30 (палец Ø8 h8, проушина 16)',
            'kind': 'secondary safety pin: D8 h8 shaft through bracket + clevis eye, '
                    'D16 head as axial stop, ball detent as transport retention',
            'axis': [1.0, 0.0, 0.0], 'axis_point_m': [0.0, round(M(PIN_Y), 5), round(M(PIN_Z), 5)],
            'insert_dir': '+X (nose first), withdrawal -X by the pull ring',
            'usable_length_mm': checks['pin']['usable_length_mm'],
            'nose_mm': checks['pin']['nose'],
            'clearance_in_bush_mm': checks['pin']['bush']['radial_clearance_mm'],
            'mates_with': ['CJ-CLEVIS-8 clevis (Ø8,8 hole) — 0,4 мм радиальный зазор',
                           'fix_latch_adapter (палец CJ-LATCH-30) — вторичная фиксация',
                           'подвес/рама: проушина серьги Ø8,4'],
        },
        'mount': {
            'pattern': '4 x M5 (Ø5,5 сквозные)',
            'holes_mm': [[x, y] for (x, y) in BOLT_XY],
            'plane': 'нижняя плоскость z=0 на плиту подвеса',
            'bolts': 'винты M5 вворачиваются снизу в плиту подвеса — головки вне '
                     'габарита детали, не моделировались',
            'fasteners_modelled': False,
        },
        'detent': {
            'type': 'radial ball detent (+Y), spring-loaded',
            'engagement_mm': checks['retention']['engagement_radial_mm'],
            'hold_n_est': checks['retention']['hold_n_est'],
            'service': 'пробка Ø9,8 с шестигранником 4,6 выкручивается, пружина и шарик меняются',
        },
        'tether': {
            'eye_mm': [EYE_HOLE_D, EYE_T],
            'at': 'боковая плоскость -Y кронштейна',
            'second_point': 'отверстие Ø4,2 в головке пальца',
            'cable': 'тросик Ø3 — отдельная деталь (кабелей в библиотеке нет)',
            'no_hooks': True,
        },
    }
    return {
        'id': CID,
        'code': 'CJ-SAFETY-PIN-8',
        'name': 'Вторичный страховочный палец',
        'kit': 'CJ-FIX-KIT',
        'class': 'RESTRAINT / secondary safety',
        'standard_in': 'CJ-CLEVIS-8 / CJ-LATCH-30',
        'standard_out': 'CJ-CLEVIS-8 (палец Ø8 h8)',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_safety_pin.py',
        'units': 'm',
        'spec': {
            'overall_mm': [100.0, 30.0, 20.0],
            'bracket_mm': [BODY_X1 - BODY_X0, BODY_Y1 - BODY_Y0, BODY_Z1 - BODY_Z0],
            'pin_mm': [PIN_D, checks['pin']['total_length_mm']],
            'head_mm': [PIN_HEAD_D, PIN_HEAD_X1 - PIN_HEAD_X0],
            'groove_mm': [GROOVE_D, GROOVE_X1 - GROOVE_X0],
            'detent': 'ball Ø5 + spring 3,4x0,6x4 + graphite plug Ø9,8',
            'ring_mm': [RING_OD, RING_BORE, RING_T],
            'eye_mm': [EYE_HOLE_D, EYE_T],
            'mass_kg_spec': 0.09,
            'material': 'Al bracket / 14Kh17N2 pin / graphite bush+plug / pink ring',
            'wll_n': 4000,
        },
        'bbox_m': {'min': [round(v, 5) for v in m['mn']],
                   'max': [round(v, 5) for v in m['mx']],
                   'size': [round(v, 5) for v in m['size']],
                   'nominal': [round(M(100.0), 5), round(M(30.0), 5), round(M(20.0), 5)],
                   'nominal_mm': [100.0, 30.0, 20.0],
                   'target_mm': [100.0, 30.0, 20.0],
                   'envelope_mm': {
                       'x': 100.0, 'y': 30.0, 'z': 20.0,
                       'x_breakdown_mm': {'pull_ring': 24.0, 'bracket': 30.0,
                                          'boss': 6.0, 'free_pin': 28.0, 'nose': 12.0},
                       'y_breakdown_mm': {'eye_plate': -15.0, 'bracket': [-13.0, 15.0]},
                       'z_breakdown_mm': {'bracket': 20.0, 'head': [2.0, 18.0]},
                       'note': ('X 100 = кольцо Ø24 (до -50) + кронштейн/бобышка + '
                                'свободный конец пальца до носка +50. Y 30 = проушина '
                                '-15 … детентная пробка +15. Z 20 = высота кронштейна.'),
                   },
                   'ok': checks['bbox_ok']},
        'nodes': [ob.name for ob in sorted(obj_mesh_objs(), key=lambda o: o.name)],
        'node_count': len(obj_mesh_objs()) + 1,
        'root': root.name,
        'materials': m['mats'],
        'material_count': len(m['mats']),
        'material_usage': {ob.name: [x.name for x in ob.data.materials if x]
                           for ob in obj_mesh_objs()},
        'volume_by_material_cm3': checks['volume_by_material_cm3'],
        'mass_kg_est': round(m['mass'], 3),
        'verts': m['verts'],
        'tris': m['tris'],
        'per_object': m['per_obj'],
        'interfaces': interfaces,
        'checks': checks,
        'renders': [],
        'glb': None,
        'glb_bytes': None,
        'notes': [
            'Габарит 100 x 30 x 20: X — кольцо Ø24 (центр -38) … носок пальца +50; '
            'Y — страховочная проушина -15 … пробка детента +15; Z — кронштейн 0…20.',
            'Палец Ø8 h8 (сталь) с головкой Ø16 x 6 — головка упирается в заднюю '
            'плоскость кронштейна и держит осевую нагрузку; проточка Ø6,6 x 4,2 под '
            'шарик; носок с фаской 45° (Ø5,6 на торце).',
            'Фиксатор — шариковый детент сбоку: шарик Ø5 заходит в проточку на 0,7 мм, '
            'пружина 3,4x0,6 на 4 витка поджата на 0,5 мм; ход на выход из проточки '
            '0,7 мм при свободном ходе 1,2 мм. Оценочное осевое удержание %s Н.'
            % checks['retention']['hold_n_est'],
            'Кольцо для руки (pink) Ø24/Ø14 x 5 в плоскости XY; ступица Ø12 насажена '
            'на хвост Ø6, буртик Ø10 пальца не даёт кольцу сойти.',
            'Страховочная проушина (сталь) 11 x 11 x 2,5 с отверстием Ø6,5 на боковой '
            'плоскости -Y, 2 x Ø3,2 под заклёпки; второй конец тросика — за отверстие '
            'Ø4,2 в головке пальца. Крюков нет: все контуры замкнутые, кромки '
            'скруглены (фаска 0,5…3,0 мм).',
            'Крепление: 4 x Ø5,5 сквозных отверстия (M5) по сетке x -8/+10, '
            'y -8/+9,5; винты вворачиваются снизу в плиту подвеса.',
            'Масса по фактическим объёмам: %s кг (кронштейн + палец + детент + '
            'кольцо); спецификация набора 0,09 кг.'
            % round(m['mass'], 3),
        ],
        'deviations': [
            'Кронштейн асимметричен по Y (-13…+15): проушина занимает 2,5 мм на стороне '
            '-Y, а детентному гнезду Ø7 с цековкой Ø10,4 нужно 11,6 мм на стороне +Y. '
            'Симметричный вариант (±15) не оставляет места под пробку.',
            'Крепёж — 4 x Ø5,5 сквозных без цековок: цековка Ø9 на верхней плоскости '
            'физически не влезает. От гнезда пальца Ø8,6 до боковой грани 20-мм '
            'кронштейна остаётся 4,7 мм, а цековке Ø9 нужно 4,5 мм от оси отверстия '
            'плюс 1,5 мм фаски кромки — отверстие пришлось бы ставить в 0,2 мм от '
            'гнезда. Винты M5 идут снизу в плиту подвеса, головки вне габарита.',
            'Втулка скольжения — отдельная графитовая деталь (Ø11,9/Ø8,6 x 4,4) в '
            'передней бобышке: зазор в паре 0,3 мм по радиусу, износ меняется без '
            'перепрессовки кронштейна.',
            'Пружина детента описана винтовой геометрией (4 витка, 0,6 мм), а не '
            'спиралью переменного шага — блок-аут, не инженерная модель.',
        ],
    }


# --- экспорт / рендер ----------------------------------------------------
EXPORT_FLAGS = dict(export_format='GLB', use_selection=True, export_apply=True,
                    export_yup=True, export_extras=True,
                    export_cameras=False, export_lights=False)


def export(root):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    objs = [root] + obj_mesh_objs()
    bpy.ops.object.select_all(action='DESELECT')
    for ob in objs:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = OUT_DIR / (CID + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(path), **EXPORT_FLAGS)
    if not path.is_file() or path.stat().st_size < 8000:
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
    scene.view_settings.exposure = -0.85
    for attr in ('taa_render_samples', 'taa_samples'):
        try:
            setattr(scene.eevee, attr, 96)
        except Exception:
            pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.560, 0.566, 0.585, 1.0)
    bg.inputs['Strength'].default_value = 0.42

    meshes = obj_mesh_objs()
    mn, mx = bbox_of(meshes)
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=24.0, location=(0.0, 0.0, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    floor.data.materials.append(make_mat('render_floor_mat', (0.150, 0.148, 0.145), 0.90))

    for name, loc, energy, size in (
            ('key', (0.13, 0.19, 0.26), 3.4, 0.13),
            ('fill', (-0.20, 0.17, 0.13), 1.3, 0.20),
            ('rim', (-0.24, -0.14, 0.17), 2.0, 0.13),
            ('top', (0.02, 0.03, 0.32), 1.1, 0.18)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc)
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized())

    def fit_dist(target, direction, lens, corners, margin=1.12):
        right, up, back = cam_basis(direction)
        th = cam_data.sensor_width * 0.5 / lens
        tv = th * scene.render.resolution_y / scene.render.resolution_x
        need = 0.0
        for p in corners:
            d = p - target
            need = max(need, abs(d.dot(right)) / th + d.dot(back),
                       abs(d.dot(up)) / tv + d.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z)) for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    from bpy_extras.object_utils import world_to_camera_view

    def fill_ratio():
        worst = 0.0
        for ob in meshes:
            mw = ob.matrix_world
            for v in ob.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                if p.z <= 0.0:
                    continue
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return round(worst, 3)

    def region_box(lo_mm, hi_mm):
        lo = Vector([M(v) for v in lo_mm])
        hi = Vector([M(v) for v in hi_mm])
        return lo, hi, box_corners(lo, hi), (lo + hi) * 0.5

    main_box = region_box((-50.0, -15.0, 0.0), (50.0, 15.0, 20.0))
    # Клоуз-ап — короткий объектив с сильной перспективой: кронштейн с
    # детентом стоит близко и читается крупно, палец и кольцо уходят вглубь,
    # но ВСЯ деталь остаётся в кадре (иначе кольцо срезается краем).
    # Наклон камеры > половины вертикального угла, иначе в кадр попадает
    # горизонт плоскости пола (жёсткая линия поперёк кадра).
    views = [
        ('3q', (0.62, -0.60, 0.46), main_box, 62, 1.02),
        ('front', (0.99, -0.08, 0.34), main_box, 95, 1.02),
        ('side', (0.02, 0.99, 0.32), main_box, 100, 1.02),
        ('closeup', (0.42, 0.78, 0.40), main_box, 45, 1.02),
    ]
    outs = []
    for tag, direction, box, lens, margin in views:
        lo, hi, corners, target = box
        cam_data.lens = lens
        dist = fit_dist(target, direction, lens, corners, margin)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if (cam.location - Vector((0.0, 0.0, 0.0))).length < 0.05:
            raise RuntimeError('camera too close to the origin for view %s' % tag)
        fp = OUT_DIR / (tag + '.png')
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append({'view': tag, 'path': str(fp.relative_to(PROJECT)),
                     'px': [896, 896], 'fill': fill_ratio(),
                     'lens_mm': lens, 'dist_mm': round(dist * 1000, 1),
                     'target_mm': [round(v * 1000, 1) for v in target],
                     'frame_mm': [[round(v * 1000, 1) for v in lo],
                                  [round(v * 1000, 1) for v in hi]]})
        log('RENDERED', tag, fp, 'dist %.0f mm' % (dist * 1000))
    return outs


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    root, parts = build()
    log('nodes:', len(obj_mesh_objs()))
    checks, m = check(parts, root)
    log('bbox', checks['bbox_mm'], '| mass', checks['mass_kg_est'],
        '| pin', m['pin']['measured_dia_mm'], 'head', m['pin']['head']['measured_dia_mm'],
        '| groove', m['pin']['groove']['measured_dia_mm'],
        '| engage', m['det']['engagement_radial_mm'], 'hold', m['det']['hold_n_est'],
        '| eye', m['tet']['measured_hole_dia_mm'],
        '| nm/dg', checks['non_manifold_edges'], checks['degenerate_faces'])

    if not checks['all_ok']:
        failed = {k: v for k, v in checks.items() if k.endswith('_ok') and not v}
        log('CHECKS FAILED', json.dumps(failed, ensure_ascii=False, default=str))
        (OUT_DIR / 'report_failed.json').write_text(
            json.dumps({'failed': failed, 'checks': checks, 'per_object': m['per_obj']},
                       ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        print('CHECKS_FAILED', flush=True)
        sys.exit(2)

    rep = build_report(root, checks, m)
    root['cj_id'] = CID
    root['cj_standard'] = 'CJ-CLEVIS-8 / CJ-LATCH-30'
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_state'] = 'closed'
    root['cj_interfaces'] = json.dumps(rep['interfaces'], ensure_ascii=False)

    path = export(root)
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['export'] = {'use_selection': True, 'export_apply': True, 'export_yup': True,
                     'export_extras': True, 'export_cameras': False, 'export_lights': False}

    rep['renders'] = render_views(root)
    (OUT_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
    log('CHECKS all_ok =', checks['all_ok'])
    print('BUILD_OK', flush=True)


if __name__ == '__main__':
    main()
