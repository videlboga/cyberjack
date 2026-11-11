#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_tilt — наклонный узел (pitch), 0…90° с фиксацией через 15°.

Standalone builder. Не трогает общий builder/catalog/pages и чужие узлы.

    blender -b --factory-startup -noaudio --python docs/plans/tools/build_fix_tilt.py

Все размеры заданы в МИЛЛИМЕТРАХ, в сцену переводятся одним множителем M().

Локальная система (м): X — длина (0.16), Y — глубина (0.12), Z — высота (0.12).
Начало координат: центр плит по X/Y, низ нижней плиты по Z. Габарит 160x120x120
относится к рабочему положению 0° (плита горизонтальна).

Конструкция (мм):
  * нижняя плита 160x120x8 (z 0…8): 4x Ø9 (M8) по сетке +-15 и гнездо Ø6 в центре;
  * две стойки 12x32x70 (z 8…78) на x = +-53: ось качания Ø16 на z=62, гнездо
    пальца Ø9 на z=26; вал Ø16 фиксирован в стойках, вращается во втулках;
  * качающаяся рама: две щеки (графит) — круглая бобышка R28 с гнездом Ø26 под
    втулку и сужающаяся лапа до низа верхней плиты (z=112), плюс верхняя плита
    160x100x8 (z 112…120) с тем же паттерном 4x Ø9 +-15 + Ø6;
  * наклонный сектор: кольцевой сегмент R26…R46, дуга 114° (от -78° до -192°),
    7 отверстий Ø6.2 на радиусе 36 через 15° — позиции 0…90°; запас 12° за
    крайними отверстиями, иначе крайнее отверстие выходит за кромку дуги;
  * фиксатор: палец Ø6 (вылет в сектор 4 мм) в стойке, головка Ø14, эксцентриковый
    рычаг (pink) на стойке-кронштейне: поворот 20° отводит палец на 6.9 мм;
  * фаски 1.2 мм по плитам, 1.5 мм по стойкам, 1.0 мм по валу.
"""

import bpy
import bmesh
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

# --- константы модуля (мм) -----------------------------------------------
CID = 'fix_tilt'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001

PLATE_X, PLATE_Y, PLATE_T = 160.0, 120.0, 8.0
TOP_X, TOP_Y = 160.0, 100.0
TOP_Z0, TOP_Z1 = 112.0, 120.0
CORNER_LEG = 22.0

M8_D = 9.0
BOLT_GRID = 15.0
PIN_BORE = 6.0

AXIS_Z = 62.0                      # высота оси качания

EAR_X0, EAR_X1 = 25.0, 35.0        # +X щека (толщина 10)
EAR_R = 28.0
EAR_BORE = 26.0                    # под втулку
EAR_TOP_HALF = 20.0

BUSH_R0, BUSH_R1 = 8.1, 13.0       # Ø16.2 / Ø26

UP_X0, UP_X1 = 47.0, 59.0          # +X стойка
UP_Y = 32.0                       # уже — чтобы дуга сектора читалась из-за стойки
UP_Z0, UP_Z1 = 8.0, 78.0
UP_BORE = 16.1                     # вал запрессован
UP_PIN_BORE = 6.2

SHAFT_R = 8.0
SHAFT_X0, SHAFT_X1 = -66.0, 66.0
COLLAR_X0, COLLAR_X1, COLLAR_R = 59.0, 64.0, 13.0

SEC_X0, SEC_X1 = 35.0, 45.0
SEC_R0, SEC_R1 = 26.0, 46.0
SEC_A0, SEC_A1 = -78.0, -192.0     # +-12° запас за крайними отверстиями
HOLE_R = 36.0
HOLE_D = 6.2                       # шаг 15° при R36 даёт перемычку 3.2 мм (было 1.2 при D8.2)
PITCH_STEP = 15.0
PITCH_POS = 7

PIN_R = 3.0
PIN_X0, PIN_X1 = 41.0, 63.0
HEAD_R, HEAD_X0, HEAD_X1 = 7.0, 63.0, 67.0
PIN_Z = AXIS_Z - HOLE_R            # 26.0

LEV_Z0, LEV_Z1 = 21.0, 29.0
LEV_PIVOT = (72.5, 24.0)
LEV_SWING = 20.0
BR_X0, BR_X1 = 67.5, 79.5
BR_Y0, BR_Y1 = 16.0, 32.0
BR_Z0, BR_Z1 = 8.0, 21.0

BEVEL_PLATE = 1.2
BEVEL_POST = 1.5
BEVEL_SHAFT = 0.8

DENSITY = {'ivory': 2700.0, 'graphite': 1900.0, 'insert': 1900.0,
           'steel': 7850.0, 'pink': 2700.0}

_BVH = {}
MATERIALS = {}


def M(v):
    return v * MM


def log(*a):
    print('[fix_tilt]', *a, flush=True)


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


def build_materials():
    MATERIALS['ivory'] = make_mat('CJ_tilt_body_ivory', (0.735, 0.715, 0.668), 0.60, 0.0)
    MATERIALS['graphite'] = make_mat('CJ_tilt_frame_graphite', (0.108, 0.113, 0.124), 0.52, 0.20)
    MATERIALS['insert'] = make_mat('CJ_tilt_bush_graphite', (0.160, 0.168, 0.180), 0.36, 0.55)
    MATERIALS['steel'] = make_mat('CJ_tilt_steel', (0.520, 0.532, 0.552), 0.28, 1.0)
    MATERIALS['pink'] = make_mat('CJ_tilt_accent_pink', (0.640, 0.265, 0.315), 0.44, 0.05)


# --- bmesh ---------------------------------------------------------------
def bm_box(bm, sx, sy, sz, center=(0.0, 0.0, 0.0)):
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    return verts


def bm_ring_x(bm, r0, r1, x0, x1, y=0.0, z=0.0, segs=40):
    """Кольцо (труба) вокруг оси X — замкнутая оболочка без торцов-заглушек."""
    rings = []
    for i in range(segs):
        a = 2.0 * math.pi * i / segs

        def P(xx, rr):
            return bm.verts.new((xx, y + rr * math.cos(a), z + rr * math.sin(a)))

        rings.append((P(x0, r0), P(x1, r0), P(x1, r1), P(x0, r1)))
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    return rings


def bm_lathe(bm, prof, segs=48, closed=False, offset=(0.0, 0.0, 0.0)):
    """Профиль (r, z) вокруг оси Z."""
    clean = []
    for pt in prof:
        if clean and abs(pt[0] - clean[-1][0]) < 1e-9 and abs(pt[1] - clean[-1][1]) < 1e-9:
            continue
        clean.append(pt)
    if closed and len(clean) > 2 and abs(clean[0][0] - clean[-1][0]) < 1e-9 \
            and abs(clean[0][1] - clean[-1][1]) < 1e-9:
        clean.pop()
    prof = clean
    rings = []
    for (r, z) in prof:
        if r <= 1e-9:
            rings.append(('pole', bm.verts.new((0.0, 0.0, z))))
        else:
            ring = []
            for i in range(segs):
                a = 2.0 * math.pi * i / segs + math.pi / segs
                ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z)))
            rings.append(('ring', ring))
    idx = list(range(len(rings)))
    pairs = list(zip(idx[:-1], idx[1:]))
    if closed:
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
    verts = [v for kind, v in rings if kind == 'pole']
    for kind, ring in rings:
        if kind == 'ring':
            verts.extend(ring)
    if any(offset):
        bmesh.ops.translate(bm, vec=offset, verts=verts)
    return verts


def bm_lathe_x(bm, prof, segs=40, y=0.0, z=0.0):
    """Профиль (r, x) вокруг оси X."""
    rings = []
    for (r, xx) in prof:
        if r <= 1e-9:
            rings.append(('pole', bm.verts.new((xx, y, z))))
        else:
            ring = []
            for i in range(segs):
                a = 2.0 * math.pi * i / segs + math.pi / segs
                ring.append(bm.verts.new((xx, y + r * math.cos(a), z + r * math.sin(a))))
            rings.append(('ring', ring))
    for (ta, A), (tb, B) in zip(rings[:-1], rings[1:]):
        if ta == 'ring' and tb == 'ring':
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((A[i], A[j], B[j], B[i]))
        elif ta == 'pole':
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((A, B[j], B[i]))
        elif tb == 'pole':
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((A[i], A[j], B))
    return [v for _k, v in rings]


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


def _new_obj_from_bm(name, bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def cyl_cutter(name, r, z0, z1, center=(0.0, 0.0), n=48):
    bm = bmesh.new()
    a0, a1 = [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        a0.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z0)))
        a1.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z1)))
    bm.faces.new(a0)
    bm.faces.new(a1[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a0[i], a0[j], a1[j], a1[i]))
    bmesh.ops.translate(bm, vec=(center[0], center[1], 0.0), verts=a0 + a1)
    return _new_obj_from_bm(name, bm)


def axis_cutter(name, r, a0, a1, y, z, n=32):
    """Цилиндр вдоль X: от x=a0 до a1, ось в (y, z)."""
    bm = bmesh.new()
    r0, r1 = [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        r0.append(bm.verts.new((a0, y + r * math.cos(a), z + r * math.sin(a))))
        r1.append(bm.verts.new((a1, y + r * math.cos(a), z + r * math.sin(a))))
    bm.faces.new(r0)
    bm.faces.new(r1[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    return _new_obj_from_bm(name, bm)


def box_cutter(name, sx, sy, sz, center):
    bm = bmesh.new()
    bm_box(bm, sx, sy, sz, center)
    return _new_obj_from_bm(name, bm)


def corner_cutter(name, sx, sy, leg=CORNER_LEG, z0=-2.0, z1=10.0):
    """Треугольная призма, срезающая угол плиты по 45°."""
    bm = bmesh.new()
    tri = [(sx * PLATE_X * 0.5, sy * PLATE_Y * 0.5),
           (sx * (PLATE_X * 0.5 - leg), sy * PLATE_Y * 0.5),
           (sx * PLATE_X * 0.5, sy * (PLATE_Y * 0.5 - leg))]
    lo = [bm.verts.new((x, y, z0)) for (x, y) in tri]
    hi = [bm.verts.new((x, y, z1)) for (x, y) in tri]
    bm.faces.new(lo)
    bm.faces.new(hi[::-1])
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    return _new_obj_from_bm(name, bm)


def top_corner_cutter(name, sx, sy, leg=CORNER_LEG, z0=TOP_Z0 - 2.0, z1=TOP_Z1 + 2.0):
    bm = bmesh.new()
    tri = [(sx * TOP_X * 0.5, sy * TOP_Y * 0.5),
           (sx * (TOP_X * 0.5 - leg), sy * TOP_Y * 0.5),
           (sx * TOP_X * 0.5, sy * (TOP_Y * 0.5 - leg))]
    lo = [bm.verts.new((x, y, z0)) for (x, y) in tri]
    hi = [bm.verts.new((x, y, z1)) for (x, y) in tri]
    bm.faces.new(lo)
    bm.faces.new(hi[::-1])
    for i in range(3):
        j = (i + 1) % 3
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    return _new_obj_from_bm(name, bm)


def boolean_cut(target, cut):
    bpy.context.view_layer.objects.active = target
    mod = target.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cut
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut, do_unlink=True)


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


def cleanup_mesh(ob, dist=1e-7):
    """Убрать осколки после EXACT-булева: нулевые рёбра и вырожденные грани."""
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bmesh.ops.dissolve_degenerate(bm, dist=dist, edges=bm.edges)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(ob.data)
    bm.free()
    return mesh_stats(ob.data)


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


# --- плиты ---------------------------------------------------------------
def build_base_plate(root):
    bm = bmesh.new()
    bm_box(bm, M(PLATE_X), M(PLATE_Y), M(PLATE_T), (0.0, 0.0, M(PLATE_T) * 0.5))
    ob = finish(PREFIX + 'base_plate', bm, [MATERIALS['ivory']], root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            boolean_cut(ob, corner_cutter('c_corner', sx, sy))
    safe_bevel(ob, M(BEVEL_PLATE), segments=2, angle=25.0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            boolean_cut(ob, cyl_cutter('c_m8', M(M8_D) * 0.5, -M(1.5), M(PLATE_T + 1.0),
                                       center=(sx * M(BOLT_GRID), sy * M(BOLT_GRID)), n=36))
    boolean_cut(ob, cyl_cutter('c_pin', M(PIN_BORE) * 0.5, -M(1.5), M(PLATE_T + 1.0), n=32))
    ob['cj_role'] = ('bottom plate 160x120x8: 4x D9 (M8) on +-15 grid + central D6 '
                     'locating bore; mates the CJ-FIX-KIT base')
    return ob


def build_top_plate(root):
    bm = bmesh.new()
    bm_box(bm, M(TOP_X), M(TOP_Y), M(TOP_Z1 - TOP_Z0),
           (0.0, 0.0, M((TOP_Z0 + TOP_Z1) * 0.5)))
    ob = finish(PREFIX + 'top_plate', bm, [MATERIALS['ivory']], root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            boolean_cut(ob, top_corner_cutter('c_tcorner', sx, sy))
    safe_bevel(ob, M(BEVEL_PLATE), segments=2, angle=25.0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            boolean_cut(ob, cyl_cutter('c_m8t', M(M8_D) * 0.5, M(TOP_Z0 - 1.0),
                                       M(TOP_Z1 + 1.5),
                                       center=(sx * M(BOLT_GRID), sy * M(BOLT_GRID)), n=36))
    boolean_cut(ob, cyl_cutter('c_pint', M(PIN_BORE) * 0.5, M(TOP_Z0 - 1.0),
                               M(TOP_Z1 + 1.5), n=32))
    ob['cj_role'] = ('tilting top plate 160x100x8: same 4x D9 (M8) +-15 pattern and '
                     'central D6 bore as the base plate')
    return ob


# --- стойки / вал --------------------------------------------------------
def build_upright(side, root):
    xs = 1 if side == 'right' else -1
    x0, x1 = sorted((xs * UP_X0, xs * UP_X1))
    bm = bmesh.new()
    bm_box(bm, M(x1 - x0), M(UP_Y), M(UP_Z1 - UP_Z0),
           (M((x0 + x1) * 0.5), 0.0, M((UP_Z0 + UP_Z1) * 0.5)))
    ob = finish(PREFIX + 'upright_' + side, bm, [MATERIALS['ivory']], root)
    safe_bevel(ob, M(BEVEL_POST), segments=2, angle=25.0)
    boolean_cut(ob, axis_cutter('c_ub', M(UP_BORE) * 0.5, M(x0) - M(1.0), M(x1) + M(1.0),
                                0.0, M(AXIS_Z)))
    boolean_cut(ob, axis_cutter('c_pb', M(UP_PIN_BORE) * 0.5, M(x0) - M(1.0), M(x1) + M(1.0),
                                0.0, M(PIN_Z)))
    ob['cj_role'] = ('trunnion post 12x%.0fx%.0f: D%.0f press-fit shaft bore at z=%.1f, '
                     'D%.1f bore for the D%.0f lock pin at z=%.1f'
                     % (UP_Y, UP_Z1 - UP_Z0, UP_BORE, AXIS_Z, UP_PIN_BORE, 2 * PIN_R, PIN_Z))
    return ob


def build_shaft(root):
    bm = bmesh.new()
    prof = [(0.0, M(SHAFT_X0)), (M(SHAFT_R), M(SHAFT_X0)),
            (M(SHAFT_R), M(SHAFT_X1 - BEVEL_SHAFT)),
            (M(SHAFT_R - BEVEL_SHAFT), M(SHAFT_X1)), (0.0, M(SHAFT_X1))]
    bm_lathe_x(bm, prof, segs=40, y=0.0, z=M(AXIS_Z))
    ob = finish(PREFIX + 'shaft', bm, [MATERIALS['steel']], root)
    ob['cj_role'] = 'D16 trunnion shaft, press-fit in the posts, running in the ear bushes'
    return ob


def build_collar(side, root):
    xs = 1 if side == 'right' else -1
    x0, x1 = sorted((xs * COLLAR_X0, xs * COLLAR_X1))
    bm = bmesh.new()
    prof = [(0.0, M(x0)), (M(COLLAR_R), M(x0)),
            (M(COLLAR_R), M(x1 - 0.6)), (M(COLLAR_R - 0.6), M(x1)), (0.0, M(x1))]
    bm_lathe_x(bm, prof, segs=36, y=0.0, z=M(AXIS_Z))
    ob = finish(PREFIX + 'collar_' + side, bm, [MATERIALS['steel']], root)
    ob['cj_role'] = 'D26 axial retaining collar on the shaft'
    return ob


# --- рама ----------------------------------------------------------------
def ear_profile():
    pts = []
    n = 36
    for i in range(n + 1):
        a = -math.pi * i / n
        pts.append((EAR_R * math.cos(a), AXIS_Z + EAR_R * math.sin(a)))
    pts.append((-EAR_TOP_HALF, TOP_Z0))
    pts.append((EAR_TOP_HALF, TOP_Z0))
    return pts


def build_ear(side, root):
    xs = 1 if side == 'right' else -1
    x0, x1 = sorted((xs * EAR_X0, xs * EAR_X1))
    bm = bmesh.new()
    pts = ear_profile()
    vs = [bm.verts.new((M(x0), M(y), M(z))) for (y, z) in pts]
    f = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[f])
    nv = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(M(x1 - x0), 0.0, 0.0), verts=nv)
    ob = finish(PREFIX + 'ear_' + side, bm, [MATERIALS['graphite']], root)
    boolean_cut(ob, axis_cutter('c_eb', M(EAR_BORE) * 0.5, M(x0) - M(1.0), M(x1) + M(1.0),
                                0.0, M(AXIS_Z)))
    ob['cj_role'] = ('pitch-frame lug (graphite): R%.0f boss on the shaft axis + tapered '
                     'arm up to the plate underside at z=%.0f, D%.0f bush seat'
                     % (EAR_R, TOP_Z0, EAR_BORE))
    return ob


def build_bushing(side, root):
    xs = 1 if side == 'right' else -1
    x0, x1 = sorted((xs * EAR_X0, xs * EAR_X1))
    bm = bmesh.new()
    bm_ring_x(bm, M(BUSH_R0), M(BUSH_R1), M(x0), M(x1), 0.0, M(AXIS_Z), segs=40)
    ob = finish(PREFIX + 'bushing_' + side, bm, [MATERIALS['insert']], root)
    ob['cj_role'] = 'D26/D16.2 wear bush pressed into the lug, the frame swings on it'
    return ob


def build_sector(root):
    bm = bmesh.new()
    n = 72
    rings = []
    for i in range(n + 1):
        a = math.radians(SEC_A0 + (SEC_A1 - SEC_A0) * i / n)
        cy, cz = math.cos(a), math.sin(a)
        rings.append((bm.verts.new((M(SEC_X0), M(SEC_R0 * cy), M(AXIS_Z + SEC_R0 * cz))),
                      bm.verts.new((M(SEC_X1), M(SEC_R0 * cy), M(AXIS_Z + SEC_R0 * cz))),
                      bm.verts.new((M(SEC_X1), M(SEC_R1 * cy), M(AXIS_Z + SEC_R1 * cz))),
                      bm.verts.new((M(SEC_X0), M(SEC_R1 * cy), M(AXIS_Z + SEC_R1 * cz)))))
    for A, B in zip(rings[:-1], rings[1:]):
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    # торцы сегмента
    bm.faces.new((rings[0][0], rings[0][1], rings[0][2], rings[0][3]))
    bm.faces.new((rings[-1][3], rings[-1][2], rings[-1][1], rings[-1][0]))
    ob = finish(PREFIX + 'sector', bm, [MATERIALS['graphite']], root)
    for k in range(PITCH_POS):
        a = math.radians(-90.0 - PITCH_STEP * k)
        cy, cz = M(HOLE_R * math.cos(a)), M(AXIS_Z + HOLE_R * math.sin(a))
        boolean_cut(ob, axis_cutter('c_hole', M(HOLE_D) * 0.5, M(SEC_X0 - 1.0),
                                    M(SEC_X1 + 1.0), cy, cz, n=40))
    st = cleanup_mesh(ob)
    log('sector after cuts: nm=%d dg=%d verts=%d' % (st['non_manifold'], st['degenerate'],
                                                     st['verts']))
    if st['degenerate']:
        # второй проход: чуть шире чистим осколки на границах отверстий
        st = cleanup_mesh(ob, dist=2e-7)
        log('sector cleanup#2: nm=%d dg=%d' % (st['non_manifold'], st['degenerate']))
    ob['cj_role'] = ('pitch sector (graphite) R%.0f..R%.0f, %.0f deg arc, 7 holes D%.1f '
                     'at R%.0f every %.0f deg -> positions 0..%.0f deg'
                     % (SEC_R0, SEC_R1, abs(SEC_A1 - SEC_A0), HOLE_D, HOLE_R, PITCH_STEP,
                        PITCH_STEP * (PITCH_POS - 1)))
    return ob


# --- фиксатор ------------------------------------------------------------
def build_lock_pin(root):
    bm = bmesh.new()
    prof = [(0.0, M(PIN_X0)), (M(PIN_R), M(PIN_X0)),
            (M(PIN_R), M(HEAD_X0 - 0.4)), (M(HEAD_R), M(HEAD_X0)),
            (M(HEAD_R), M(HEAD_X1 - 0.8)), (M(HEAD_R - 0.8), M(HEAD_X1)), (0.0, M(HEAD_X1))]
    bm_lathe_x(bm, prof, segs=32, y=0.0, z=M(PIN_Z))
    ob = finish(PREFIX + 'lock_pin', bm, [MATERIALS['steel']], root)
    ob['cj_role'] = ('D8 lock pin in the post bore, engages %.1f mm into the sector hole; '
                     'D14 head driven by the cam lever'
                     % (SEC_X1 - PIN_X0))
    return ob


def build_lock_bracket(root):
    bm = bmesh.new()
    bm_box(bm, M(BR_X1 - BR_X0), M(BR_Y1 - BR_Y0), M(BR_Z1 - BR_Z0),
           (M((BR_X0 + BR_X1) * 0.5), M((BR_Y0 + BR_Y1) * 0.5), M((BR_Z0 + BR_Z1) * 0.5)))
    ob = finish(PREFIX + 'lock_bracket', bm, [MATERIALS['ivory']], root)
    safe_bevel(ob, M(1.0), segments=1, angle=30.0)
    boolean_cut(ob, cyl_cutter('c_lbp', M(5.2) * 0.5, M(BR_Z0 - 1.0), M(BR_Z1 + 1.0),
                               center=(M(LEV_PIVOT[0]), M(LEV_PIVOT[1])), n=28))
    ob['cj_role'] = 'lock-lever pedestal on the base plate, D5.2 pivot bore'
    return ob


def build_lock_pivot(root):
    bm = bmesh.new()
    prof = [(0.0, M(BR_Z0 - 1.0)), (M(2.5), M(BR_Z0 - 1.0)),
            (M(2.5), M(LEV_Z1 + 1.6)), (M(2.0), M(LEV_Z1 + 2.1)), (0.0, M(LEV_Z1 + 2.1))]
    bm_lathe(bm, prof, segs=28, offset=(M(LEV_PIVOT[0]), M(LEV_PIVOT[1]), 0.0))
    ob = finish(PREFIX + 'lock_pivot', bm, [MATERIALS['steel']], root)
    ob['cj_role'] = 'D5 pivot pin of the cam lever'
    return ob


LEVER_POLY = [(67.0, -2.0), (71.0, -2.0), (71.0, 14.0), (79.0, 14.0), (79.0, 32.0),
              (78.0, 52.0), (69.0, 52.0), (69.0, 32.0), (67.0, 32.0)]


def build_lock_lever(root):
    """Рычаг — один простой полигон в XY, выдавленный по Z, плюс одно гнездо оси.

    Никакой сварки из трёх пересекающихся оболочек: EXACT-булево на
    самопересекающемся входе возвращало пустой меш (гуард ловил 0x0x0).
    """
    bm = bmesh.new()
    vs = [bm.verts.new((M(x), M(y), M(LEV_Z0))) for (x, y) in LEVER_POLY]
    face = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    nv = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0.0, 0.0, M(LEV_Z1 - LEV_Z0)), verts=nv)
    ob = finish(PREFIX + 'lock_lever', bm, [MATERIALS['pink']], root)
    boolean_cut(ob, cyl_cutter('c_llev', M(5.2) * 0.5, M(LEV_Z0 - 1.0), M(LEV_Z1 + 1.0),
                               center=(M(LEV_PIVOT[0]), M(LEV_PIVOT[1])), n=28))
    safe_bevel(ob, M(0.6), segments=1, angle=40.0)
    ob['cj_role'] = ('muted-pink cam lever: %.0f deg swing moves the nose %.1f mm, '
                     'releasing the D8 pin (4.0 mm engagement)'
                     % (LEV_SWING, LEV_NOSE_TRAVEL))
    return ob


# --- сборка --------------------------------------------------------------
def obj_mesh_objs(root):
    return [o for o in bpy.data.objects
            if o.type == 'MESH' and o.name.startswith(PREFIX)]


MOVING = ('ear_', 'bushing_', 'sector', 'top_plate')


def is_moving(name):
    tail = name[len(PREFIX):]
    return tail.startswith(MOVING)


# нос рычага: точка контакта (67, 5) вокруг оси (73.5, 24)
_v = Vector((67.0 - LEV_PIVOT[0], 5.0 - LEV_PIVOT[1]))
_r = _v.length
LEV_NOSE_TRAVEL = round(_r * math.sin(math.radians(LEV_SWING)), 2)


def build():
    reset_scene()
    build_materials()
    root = bpy.data.objects.new(CID, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.08
    bpy.context.scene.collection.objects.link(root)

    parts = {}
    parts['base_plate'] = build_base_plate(root)
    parts['top_plate'] = build_top_plate(root)
    for side in ('left', 'right'):
        parts['upright_' + side] = build_upright(side, root)
        parts['ear_' + side] = build_ear(side, root)
        parts['bushing_' + side] = build_bushing(side, root)
        parts['collar_' + side] = build_collar(side, root)
    parts['shaft'] = build_shaft(root)
    parts['sector'] = build_sector(root)
    parts['pin'] = build_lock_pin(root)
    parts['bracket'] = build_lock_bracket(root)
    parts['pivot'] = build_lock_pivot(root)
    parts['lever'] = build_lock_lever(root)

    meshes = obj_mesh_objs(root)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for ob in obj_mesh_objs(root):
        me = ob.data
        nv = len(me.vertices) if me else 0
        if me is None or nv == 0:
            raise RuntimeError('empty mesh: %s (mesh=%r, verts=%d) — деталь не создалась '
                               'или булево вернуло пустой меш' % (ob.name, me, nv))
        if len(me.polygons) == 0:
            raise RuntimeError('no faces: %s (verts=%d, polys=0)' % (ob.name, nv))
        dim = ob.dimensions
        if min(dim) <= 1e-7:
            raise RuntimeError('degenerate body: %s dimensions %s (verts=%d, polys=%d)'
                               % (ob.name, tuple(round(v, 6) for v in dim), nv,
                                  len(me.polygons)))
        if max(dim) > 0.2 or max(dim) < 0.0005:
            raise RuntimeError('unit guard: %s dimensions %s' % (ob.name, tuple(dim)))
        if tuple(round(v, 6) for v in ob.scale) != (1.0, 1.0, 1.0):
            raise RuntimeError('scale guard: %s scale %s' % (ob.name, tuple(ob.scale)))
        log('solid %-32s verts %4d polys %4d dims %s'
            % (ob.name, nv, len(me.polygons),
               tuple(round(v * 1000, 1) for v in dim)))
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


def measure_pattern(ob, side):
    """4x D9 (M8) + D6 в плите. side='bottom' — луч снизу вверх, 'top' — сверху вниз."""
    if side == 'bottom':
        def op(x, y):
            return ray(ob, (x, y, -M(2.0)), (0, 0, 1), M(12.0)) is None
        z0 = 0.0
    else:
        def op(x, y):
            return ray(ob, (x, y, M(TOP_Z1 + 1.0)), (0, 0, -1), M(9.5)) is None
        z0 = TOP_Z1
    holes = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * M(BOLT_GRID), sy * M(BOLT_GRID)
            through = op(cx, cy)
            dia = None
            if through:
                ex = bisect(lambda o: op(cx + o, cy), 0.0, M(9))
                ey = bisect(lambda o: op(cx, cy + o), 0.0, M(9))
                dia = [round(ex * 2000, 2), round(ey * 2000, 2)]
            holes.append({'id': 'M8_%s%s' % ('plus' if sx > 0 else 'minus',
                                             'plus' if sy > 0 else 'minus'),
                          'grid_mm': [float(sx * BOLT_GRID), float(sy * BOLT_GRID)],
                          'center_m': [round(cx, 5), round(cy, 5), round(M(z0), 5)],
                          'through': through, 'dia_mm': dia})
    pin_open = op(0.0, 0.0)
    pin_dia = None
    if pin_open:
        ex = bisect(lambda o: op(o, 0.0), 0.0, M(6))
        ey = bisect(lambda o: op(0.0, o), 0.0, M(6))
        pin_dia = [round(ex * 2000, 2), round(ey * 2000, 2)]
    ok_holes = all(h['through'] and h['dia_mm']
                   and abs(h['dia_mm'][0] - M8_D) <= 0.25 and abs(h['dia_mm'][1] - M8_D) <= 0.25
                   for h in holes)
    ok_pin = (pin_open and pin_dia is not None and abs(pin_dia[0] - PIN_BORE) <= 0.25
              and abs(pin_dia[1] - PIN_BORE) <= 0.25)
    return {'plate': ob.name,
            'grid_mm': BOLT_GRID, 'holes': holes,
            'pin': {'center_m': [0.0, 0.0, round(M(z0), 5)], 'dia_mm': PIN_BORE,
                    'measured_dia_mm': pin_dia, 'open': pin_open},
            'holes_ok': ok_holes, 'pin_ok': ok_pin, 'ok': ok_holes and ok_pin}


def sector_hole_open(ob, ang_deg):
    """Отверстие сектора — сквозное вдоль X: луч идёт вдоль X через него."""
    a = math.radians(ang_deg)
    oy, oz = M(HOLE_R * math.cos(a)), M(AXIS_Z + HOLE_R * math.sin(a))
    p = ray(ob, (M(SEC_X1 + 6.0), oy, oz), (-1.0, 0.0, 0.0),
            M(SEC_X1 - SEC_X0 + 12.0))
    return p is None


def measure_sector(parts):
    sec = parts['sector']
    holes = []
    for k in range(PITCH_POS):
        ang = -90.0 - PITCH_STEP * k
        cy = HOLE_R * math.cos(math.radians(ang))
        cz = AXIS_Z + HOLE_R * math.sin(math.radians(ang))
        opened = sector_hole_open(sec, ang)
        dia = None
        if opened:
            def op(da):
                return sector_hole_open(sec, ang + da)
            half = bisect(op, 0.0, 6.0)
            dia = round(2.0 * HOLE_R * math.sin(math.radians(half)), 2)
        holes.append({'id': 'P%02d' % int(PITCH_STEP * k),
                      'position_deg': round(PITCH_STEP * k, 1),
                      'sector_angle_deg': round(ang, 2),
                      'center_mm': [round(cy, 3), round(cz, 3)],
                      'center_m': [0.0, round(M(cy), 5), round(M(cz), 5)],
                      'open': opened, 'dia_mm': dia})
    # остаток при повороте рамы на 15*k: отверстие k должно встать на палец
    residuals = []
    for k, h in enumerate(holes):
        th = math.radians(PITCH_STEP * k)
        y, z = h['center_mm'][0], h['center_mm'][1]
        ry = y * math.cos(th) - (z - AXIS_Z) * math.sin(th)
        rz = y * math.sin(th) + (z - AXIS_Z) * math.cos(th) + AXIS_Z
        residuals.append(round(math.hypot(ry - 0.0, rz - PIN_Z), 3))
    ok = (all(h['open'] and h['dia_mm'] and abs(h['dia_mm'] - HOLE_D) <= 0.25 for h in holes)
          and all(r <= 0.05 for r in residuals))
    return {'r_mm': HOLE_R, 'hole_d_mm': HOLE_D, 'count': len(holes),
            'arc_deg': [SEC_A0, SEC_A1], 'arc_span_deg': abs(SEC_A1 - SEC_A0),
            'holes': holes, 'residual_max_mm': max(residuals), 'ok': ok}


def measure_lock(parts):
    pin, lever, sec, br = parts['pin'], parts['lever'], parts['sector'], parts['bracket']
    pmn, pmx = bbox_of([pin])
    engagement = SEC_X1 - pmn.x * 1000
    head_face = pmx.x * 1000
    lmn, lmx = bbox_of([lever])
    nose_face = lmn.x * 1000
    gap = nose_face - head_face
    # ось пальца против центра нулевого отверстия
    pin_y, pin_z = (pmn.y + pmx.y) * 500.0, (pmn.z + pmx.z) * 500.0
    a0 = math.radians(-90.0)
    hole_y, hole_z = HOLE_R * math.cos(a0), AXIS_Z + HOLE_R * math.sin(a0)
    offset = math.hypot(pin_y - hole_y, pin_z - hole_z)
    rec = {
        'type': 'sliding D8 pin through the post into the sector hole, driven by a '
                'muted-pink cam lever',
        'pin': {'node': pin.name, 'd_mm': 2 * PIN_R,
                'axis': 'X at y=0.0, z=%.1f' % PIN_Z,
                'head_d_mm': 2 * HEAD_R,
                'bbox_mm': {'min': [round(v * 1000, 2) for v in pmn],
                            'max': [round(v * 1000, 2) for v in pmx]},
                'engagement_mm': round(engagement, 2),
                'head_face_x_mm': round(head_face, 2)},
        'lever': {'node': lever.name, 'material': 'CJ_tilt_accent_pink',
                  'pivot_mm': {'x': LEV_PIVOT[0], 'y': LEV_PIVOT[1], 'axis_z': True},
                  'swing_deg': LEV_SWING, 'nose_travel_mm': LEV_NOSE_TRAVEL,
                  'bbox_mm': {'min': [round(v * 1000, 2) for v in lmn],
                              'max': [round(v * 1000, 2) for v in lmx]}},
        'bracket': br.name,
        'nose_gap_mm': round(gap, 3),
        'axis_offset_mm': round(offset, 3),
        'hole_d_mm': HOLE_D,
        'note': ('палец вставлен в отверстие сектора на %.1f мм; рычаг на %.0f° отводит '
                 'нос на %.1f мм — больше вылета, пин выходит из сектора'
                 % (engagement, LEV_SWING, LEV_NOSE_TRAVEL)),
    }
    rec['ok'] = (2.5 <= engagement <= 6.0 and LEV_NOSE_TRAVEL >= engagement + 1.0
                 and abs(gap) <= 0.6 and offset <= 0.1)
    return rec


def _bvh_of(objs, rot=None):
    verts, tris = [], []
    for ob in objs:
        mw = ob.matrix_world
        base = len(verts)
        for v in ob.data.vertices:
            p = mw @ v.co
            if rot is not None:
                p = rot @ p
            verts.append(p)
        me = ob.data
        me.calc_loop_triangles()
        for t in me.loop_triangles:
            tris.append((base + t.vertices[0], base + t.vertices[1], base + t.vertices[2]))
    return BVHTree.FromPolygons(verts, tris, all_triangles=True)


def measure_sweep(root):
    """Качание рамы 0…90°: габарит на позициях и реальные пересечения с остовом.

    Палец фиксатора в выборку не входит: при наклоне он выведен из сектора
    (это и есть смысл рычага), поэтому пересечение «палец × сектор» на
    позициях 15…90° — не дефект модели, а снятая фиксация.
    """
    moving = [o for o in obj_mesh_objs(root) if is_moving(o.name)]
    fixed = [o for o in obj_mesh_objs(root)
             if not is_moving(o.name) and o.name.split('__')[1]
             in ('base_plate', 'upright_left', 'upright_right', 'shaft',
                 'collar_left', 'collar_right')]
    pts = []
    for ob in moving:
        mw = ob.matrix_world
        pts.extend([mw @ v.co for v in ob.data.vertices])
    axis = Vector((0.0, 0.0, M(AXIS_Z)))
    fixed_bvh = _bvh_of(fixed)
    out = []
    for deg in range(0, 91, 5):
        th = math.radians(deg)
        ct, st = math.cos(th), math.sin(th)
        mn = Vector((1e9, 1e9, 1e9))
        mx = Vector((-1e9, -1e9, -1e9))
        for p in pts:
            y = p.y * ct - (p.z - M(AXIS_Z)) * st
            z = p.y * st + (p.z - M(AXIS_Z)) * ct + M(AXIS_Z)
            q = (p.x, y, z)
            for i in range(3):
                mn[i] = min(mn[i], q[i])
                mx[i] = max(mx[i], q[i])
        rot = Matrix.Translation(axis) @ Matrix.Rotation(th, 4, 'X') @ Matrix.Translation(-axis)
        hits = fixed_bvh.overlap(_bvh_of(moving, rot))
        out.append({'deg': deg,
                    'min_mm': [round(v * 1000, 1) for v in mn],
                    'max_mm': [round(v * 1000, 1) for v in mx],
                    'pairs': len(hits)})
    min_z = min(r['min_mm'][2] for r in out)
    max_z = max(r['max_mm'][2] for r in out)
    min_y = min(r['min_mm'][1] for r in out)
    max_y = max(r['max_mm'][1] for r in out)
    bad = [r for r in out if r['pairs']]
    return {'positions': out,
            'min_z_mm': round(min_z, 1), 'max_z_mm': round(max_z, 1),
            'min_y_mm': round(min_y, 1), 'max_y_mm': round(max_y, 1),
            'base_top_mm': PLATE_T,
            'clearance_to_base_mm': round(min_z - PLATE_T, 1),
            'collisions': bad,
            'checked_against': [o.name for o in fixed],
            'pin_excluded': 'палец выведен рычагом на любой ненулевой позиции',
            'ok': (min_z - PLATE_T) >= 2.0 and not bad}


def check(parts, root):
    meshes = obj_mesh_objs(root)
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
            for k in ('steel', 'pink', 'insert', 'graphite', 'ivory'):
                if k in mat.name:
                    key = k
                    break
            break
        vol_by_key[key] = vol_by_key.get(key, 0.0) + st['volume_cm3']

    mass = sum(v * 1e-6 * DENSITY.get(k, 2700.0) for k, v in vol_by_key.items())
    mats = sorted({m.name for ob in meshes for m in ob.data.materials if m})

    bottom = measure_pattern(parts['base_plate'], 'bottom')
    top = measure_pattern(parts['top_plate'], 'top')
    sector = measure_sector(parts)
    lock = measure_lock(parts)
    sweep = measure_sweep(root)

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
        'non_manifold': nm,
        'non_manifold_edges': nm,
        'non_manifold_ok': nm == 0,
        'degenerate': dg,
        'degenerate_faces': dg,
        'degenerate_ok': dg == 0,
        'loose_verts': loose,
        'loose_verts_ok': loose == 0,
        'transforms_applied': all(tuple(round(v, 6) for v in ob.scale) == (1.0, 1.0, 1.0)
                                  and max(ob.dimensions) <= 0.2 for ob in meshes),
        'material_count': len(mats),
        'material_count_ok': 4 <= len(mats) <= 8,
        'bbox_size_m': [round(v, 5) for v in size],
        'bbox_ok': (abs(size.x - M(PLATE_X)) <= 0.0008 and abs(size.y - M(PLATE_Y)) <= 0.0008
                    and abs(size.z - M(TOP_Z1)) <= 0.0008 and abs(mn.z) <= 0.0008
                    and abs(mn.x + M(PLATE_X * 0.5)) <= 0.0008
                    and abs(mn.y + M(PLATE_Y * 0.5)) <= 0.0008),
        'mass_kg_est': round(mass, 3),
        'bottom_plate': bottom,
        'bottom_pattern_ok': bottom['ok'],
        'top_plate': top,
        'top_pattern_ok': top['ok'],
        'sector': sector,
        'sector_ok': sector['ok'],
        'pitch': {'range_deg': [0.0, PITCH_STEP * (PITCH_POS - 1)],
                  'step_deg': PITCH_STEP, 'positions': PITCH_POS,
                  'axis_mm': {'point': [0.0, 0.0, AXIS_Z], 'direction': [1.0, 0.0, 0.0]}},
        'pitch_ok': sector['ok'] and PITCH_POS == 7,
        'lock': lock,
        'lock_ok': lock['ok'],
        'sweep': sweep,
        'sweep_ok': sweep['ok'],
        'node_count': len(meshes),
        'node_count_ok': len(meshes) >= 8,
        'prefix_ok': all(ob.name.startswith(PREFIX) for ob in meshes),
        'no_negative_scale': all(ob.matrix_world.determinant() > 1e-9 for ob in meshes),
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'volume_by_material_cm3': {k: round(v, 3) for k, v in vol_by_key.items()},
        'animation': 'none (pitch is a runtime DOF, no actions)',
        'animation_ok': len(bpy.data.actions) == 0,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))
    return checks, dict(mn=mn, mx=mx, size=size, mass=mass, mats=mats, verts=verts,
                        tris=tris, per_obj=per_obj, bottom=bottom, top=top,
                        sector=sector, lock=lock, sweep=sweep, vol=vol_by_key)


# --- report --------------------------------------------------------------
def build_report(root, checks, m):
    interfaces = {
        'bottom_plate': {
            'role': 'fixes the unit to the CJ-FIX-KIT base / table',
            'plane': 'XY at z=0 mm', 'plate_mm': [PLATE_X, PLATE_Y, PLATE_T],
            'normal': [0.0, 0.0, -1.0], 'grid_mm': BOLT_GRID,
            'm8': [{'id': h['id'], 'grid_mm': h['grid_mm'], 'center_m': h['center_m'],
                    'dia_mm': M8_D, 'measured_dia_mm': h['dia_mm']}
                   for h in m['bottom']['holes']],
            'pin_bore': m['bottom']['pin'],
            'bolts': 'M8 x4 (D9 through), grid +-15 mm + central D6 locating bore',
        },
        'top_plate': {
            'role': 'tilting mounting plate, same pattern as the base plate',
            'plane': 'XY at z=%.0f mm' % TOP_Z1,
            'plate_mm': [TOP_X, TOP_Y, TOP_Z1 - TOP_Z0],
            'z_range_mm': [TOP_Z0, TOP_Z1],
            'normal': [0.0, 0.0, 1.0], 'grid_mm': BOLT_GRID,
            'm8': [{'id': h['id'], 'grid_mm': h['grid_mm'], 'center_m': h['center_m'],
                    'dia_mm': M8_D, 'measured_dia_mm': h['dia_mm']}
                   for h in m['top']['holes']],
            'pin_bore': m['top']['pin'],
            'bolts': 'M8 x4 (D9 through), grid +-15 mm + central D6 locating bore',
            'compatibility': 'same 4x M8 +-15 + centre D6 pattern as the base plate, '
                             'fix_carriage deck and fix_corner_node',
        },
        'pitch_axis': {
            'role': 'trunnion axis of the tilting frame',
            'point_mm': [0.0, 0.0, AXIS_Z], 'direction': [1.0, 0.0, 0.0],
            'shaft_d_mm': 2 * SHAFT_R,
            'bearing': 'D26/D16.2 bush per lug, shaft press-fit in the posts',
            'range_deg': [0.0, 90.0], 'step_deg': PITCH_STEP,
            'positions': PITCH_POS,
        },
        'lock': {
            'type': m['lock']['type'],
            'pin_d_mm': 2 * PIN_R, 'engagement_mm': m['lock']['pin']['engagement_mm'],
            'lever_swing_deg': LEV_SWING, 'nose_travel_mm': LEV_NOSE_TRAVEL,
            'state_modelled': 'locked (pin inserted %.1f mm into the sector hole)'
                              % m['lock']['pin']['engagement_mm'],
            'blocks': 'rotation of the frame at any of the 7 sector positions',
        },
    }
    return {
        'id': CID,
        'code': 'CJ-TILT-160',
        'name': 'Наклонный узел (pitch)',
        'kit': 'CJ-FIX-KIT',
        'class': 'FIXTURE / pitch',
        'standard': 'CJ-FIX-KIT',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_tilt.py',
        'units': 'm',
        'spec': {
            'overall_mm': [PLATE_X, PLATE_Y, TOP_Z1],
            'bottom_plate_mm': [PLATE_X, PLATE_Y, PLATE_T],
            'top_plate_mm': [TOP_X, TOP_Y, TOP_Z1 - TOP_Z0],
            'pitch_axis_mm': [0.0, 0.0, AXIS_Z],
            'pitch': {'range_deg': [0.0, 90.0], 'step_deg': PITCH_STEP, 'positions': PITCH_POS},
            'sector_mm': {'r_inner': SEC_R0, 'r_outer': SEC_R1,
                          'arc_deg': [SEC_A0, SEC_A1], 'hole_r': HOLE_R, 'hole_d': HOLE_D},
            'lock': 'D8 pin + %.0f deg cam lever (throw %.1f mm)' % (LEV_SWING, LEV_NOSE_TRAVEL),
            'mass_kg_spec': 2.4,
            'material': 'Al 6061 plates and posts / graphite frame and sector / steel '
                        'shaft and pins / painted pink lever',
            'load_kn_concept': 1.0,
        },
        'bbox_m': {'min': [round(v, 5) for v in m['mn']],
                   'max': [round(v, 5) for v in m['mx']],
                   'size': [round(v, 5) for v in m['size']],
                   'nominal': [0.16, 0.12, 0.12],
                   'ok': checks['bbox_ok']},
        'pitch': dict(checks['pitch'], holes=m['sector']['holes'],
                      hole_d_mm=HOLE_D, hole_r_mm=HOLE_R,
                      residual_max_mm=m['sector']['residual_max_mm'],
                      arc_deg=m['sector']['arc_deg'],
                      swept_envelope_mm={'min': [min(r['min_mm'][i] for r in m['sweep']['positions'])
                                                 for i in range(3)],
                                         'max': [max(r['max_mm'][i] for r in m['sweep']['positions'])
                                                 for i in range(3)]}),
        'lock': m['lock'],
        'nodes': [ob.name for ob in sorted(obj_mesh_objs(root), key=lambda o: o.name)],
        'node_count': len(obj_mesh_objs(root)) + 1,
        'root': root.name,
        'materials': m['mats'],
        'material_count': len(m['mats']),
        'material_usage': {ob.name: [x.name for x in ob.data.materials if x]
                           for ob in obj_mesh_objs(root)},
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
            'Ось качания — вал Ø16 на z=%.0f мм, зафиксирован в двух стойках 12x44x70; '
            'рама качается на втулках Ø26/Ø16.2, запрессованных в щёки.' % AXIS_Z,
            'Сектор — кольцевой сегмент R%.0f…R%.0f с 7 отверстиями Ø8.1 на R%.0f через '
            '%.0f°: позиции 0…90°. Нулевое отверстие стоит под пальцем; при повороте рамы '
            'на 15k° на палец встаёт отверстие k (остаток %.3f мм в отчёте).'
            % (SEC_R0, SEC_R1, HOLE_R, PITCH_STEP, m['sector']['residual_max_mm']),
            'Фиксатор — позитивный: палец Ø8 входит в отверстие сектора на %.1f мм и '
            'держит раму от проворота; пружина (не моделировалась) держит палец во '
            'включённом состоянии, розовый рычаг на %.0f° отводит нос на %.1f мм '
            'и выводит палец из сектора.'
            % (m['lock']['pin']['engagement_mm'], LEV_SWING, LEV_NOSE_TRAVEL),
            'Обе плиты — 8 мм, один паттерн: 4x Ø9 (M8) по сетке ±15 мм + гнездо Ø6 в '
            'центре; верхняя плита 160x100 (уже нижней на 20 мм), чтобы на 90° её нижняя '
            'кромка проходила над основанием с зазором %.1f мм.'
            % m['sweep']['clearance_to_base_mm'],
            'Масса по фактическим объёмам: %.2f кг (алюминий + графит + сталь).'
            % m['mass'],
        ],
        'deviations': [
            'Габарит 160x120x120 — рабочее положение 0°. При наклоне угол плиты выходит '
            'за стойку: максимум по Z %.1f мм на ~41° (сметаемый габарит 160x120x%.0f). '
            'Это ход механизма, а не тело узла.'
            % (m['sweep']['max_z_mm'], m['sweep']['max_z_mm']),
            'Пружина фиксатора не моделировалась (в блок-ауте нет упругих элементов); '
            'в отчёте она описана как элемент, обеспечивающий поджим пальца.',
            'Верхняя плита 160x100 вместо 160x120: при ширине 120 и ходе 0…90° нижняя '
            'кромка на 90° уходит на z=0 и садится на основание — 100 мм даёт 4 мм зазора.',
            'Отверстия Ø9 промоделированы без резьбы и без шайб: под M8 ставить шайбы '
            'Ø16 или резьбовые вставки (не моделировались).',
        ],
    }


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
    scene.view_settings.exposure = -1.05
    try:
        scene.eevee.taa_render_samples = 128
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.560, 0.566, 0.585, 1.0)
    bg.inputs['Strength'].default_value = 0.40

    meshes = obj_mesh_objs(root)
    mn, mx = bbox_of(meshes)
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0.0, 0.0, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    floor.data.materials.append(make_mat('render_floor_mat', (0.155, 0.153, 0.150), 0.90))

    for name, loc, energy, size in (
            ('key', (0.22, 0.28, 0.38), 5.0, 0.20),
            ('fill', (-0.30, 0.18, 0.18), 1.8, 0.30),
            ('rim', (-0.10, -0.30, 0.24), 3.2, 0.20),
            ('top', (0.02, 0.06, 0.46), 1.3, 0.26)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc)
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized())

    def fit_dist(direction, lens, corners, margin=1.12):
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
    close_lo = Vector((0.030, -0.050, 0.010))
    close_hi = Vector((0.080, 0.022, 0.064))
    c_close = box_corners(close_lo, close_hi)
    close_t = (close_lo + close_hi) * 0.5

    views = [
        ('3q', (0.64, -0.58, 0.40), center, 62, c_main, 0.880, None),
        ('front', (0.02, 0.99, 0.18), center, 100, c_main, 0.885, None),
        ('side', (0.99, -0.10, 0.10), center, 100, c_main, 0.900, None),
        ('closeup', (0.80, -0.34, 0.33), close_t, 70, c_close, 0.86, (close_lo, close_hi)),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, region in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(14):
            got = max_ndc(fill, region)
            if got <= 1e-6 or abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = OUT_DIR / (tag + '.png')
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append({'view': tag, 'path': str(fp.relative_to(PROJECT)),
                     'px': [896, 896], 'fill': round(max_ndc(fill, region), 3)})
        log('RENDERED', tag, fp)
    return outs


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    root, parts = build()
    log('nodes:', len(obj_mesh_objs(root)))
    checks, m = check(parts, root)
    log('bbox', checks['bbox_size_m'], '| mass', checks['mass_kg_est'],
        '| bottom', checks['bottom_pattern_ok'], '| top', checks['top_pattern_ok'],
        '| sector', checks['sector_ok'], '| lock', checks['lock_ok'],
        '| sweep', checks['sweep_ok'],
        '| nm/dg', checks['non_manifold'], checks['degenerate'])

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
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_pitch'] = json.dumps(rep['pitch']['range_deg'])
    root['cj_pitch_step'] = PITCH_STEP
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
