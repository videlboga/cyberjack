#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_backboard — спинка-ложе 700x1200x60 мм.

Standalone builder. Не трогает общий builder/catalog/pages и чужие узлы.

    blender -b --factory-startup -noaudio --python docs/plans/tools/build_fix_backboard.py
    CJ_SKIP_RENDER=1 blender -b ... (только геометрия + чеки, без рендеров/GLB)

Все размеры заданы в МИЛЛИМЕТРАХ, в сцену переводятся одним множителем M().

Локальная система (м): X — ширина (0.700), Y — толщина (0.060), Z — высота (1.200).
Начало координат: центр по X, середина по толщине, низ по Z=0.
Задняя (интерфейсная) плоскость — y = -30 мм, лицо подушки — y = +29 мм,
стропа-ручка выступает до y = +30 мм (габарит 60 мм).

Конструкция (мм):
  * задняя панель 700x1200x18 (y -22…-4), контур R40, фаска 2.0 — ivory;
  * спина-рельс 180x1180x8 (y -30…-22, z 10…1190), R16, фаска 1.2 — graphite:
    несёт ТРИ паттерна M8 (низ/центр/верх), каждый 4x Ø9 по сетке ±15 + Ø6 в центре;
  * два ребра жёсткости 40x1180x8 (x ±130…±170, y -30…-22) — graphite;
  * рамка-бортик: наружный контур 700x1200 R40, окно 610x1110 R14, глубина 14
    (y -4…+10), фаска 2.5 — graphite (тёмный бортик вокруг подушки);
  * подушка 604x1104, y -4…+29 (33 мм), контур R32, скругление лица R19 —
    зазор 3.0 мм до окна рамки на все четыре стороны (съёмная), мягкий материал;
  * стропа-ручка 180x34x12 (x ±90, z 70…104, y 18…30) — muted pink, выступает
    на 1 мм за лицо подушки, за неё подушка вынимается из рамки;
  * стальные вставки: 12 колец Ø16/Ø9.2 в цековках Ø16x4 + 3 втулки Ø12/Ø6.2
    в цековках Ø12x4 — все заподлицо с задней плоскостью y=-30.

Паттерны на задней плоскости (центр паттерна -> 4x M8 + Ø6):
  primary z=760 | top z=1100 | bottom z=200; сетка ±15 мм по X и Z.
"""

import bpy
import bmesh
import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

# --- константы модуля (мм) -----------------------------------------------
CID = 'fix_backboard'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001

BB_W, BB_H, BB_D = 700.0, 1200.0, 60.0
PANEL_R = 40.0
PANEL_Y0, PANEL_Y1 = -22.0, -4.0
PANEL_T = PANEL_Y1 - PANEL_Y0                       # 18

SPINE_W, SPINE_T = 180.0, 8.0
SPINE_Z0, SPINE_Z1 = 10.0, 1190.0
SPINE_R = 16.0
SPINE_Y0, SPINE_Y1 = -30.0, -22.0

RIB_X0, RIB_X1 = 130.0, 170.0
RIB_Y0, RIB_Y1 = -30.0, -22.0
RIB_R = 8.0

RIM_Y0, RIM_Y1 = -4.0, 10.0
RIM_D = RIM_Y1 - RIM_Y0                             # 14
RIM_BAR = 45.0
RIM_OUT_R = 40.0
RIM_IN_R = 14.0
RIM_IN_W = BB_W - 2.0 * RIM_BAR                     # 610
RIM_IN_H = BB_H - 2.0 * RIM_BAR                     # 1110

PAD_W, PAD_H = RIM_IN_W - 6.0, RIM_IN_H - 6.0       # 604 x 1104, зазор 3.0
PAD_Y0, PAD_Y1 = -4.0, 29.0
PAD_T = PAD_Y1 - PAD_Y0                             # 33
PAD_R = 32.0
PAD_RO_Y0 = 10.0
PAD_RO = PAD_Y1 - PAD_RO_Y0                         # 19
PAD_RO_STEPS = 10
PAD_CORNER_N = 10
PAD_GAP = (RIM_IN_W - PAD_W) * 0.5                  # 3.0

STRAP_X = 90.0
STRAP_Y0, STRAP_Y1 = 18.0, 30.0
STRAP_Z0, STRAP_Z1 = 70.0, 104.0

M8_D = 9.0
M8_BORE = 9.0
BOLT_GRID = 15.0
CB_D = 16.0
CB_DEPTH = 4.0
INSERT_R0 = 4.6                                      # Ø9.2 под M8
INSERT_R1 = 7.9                                      # Ø15.8 в цековке Ø16
PIN_BORE = 6.0
PIN_BORE_INSERT = 6.2
PIN_CB_D = 12.0
PIN_INSERT_R0 = 3.1
PIN_INSERT_R1 = 5.9                                  # Ø11.8 в цековке Ø12

PATTERNS = (('primary', 760.0), ('top', 1100.0), ('bottom', 200.0))

BEVEL_PANEL = 2.0
BEVEL_SPINE = 1.2
BEVEL_RIB = 1.0
BEVEL_RIM = 2.5
BEVEL_STRAP = 1.0

DENSITY = {'ivory': 2700.0, 'graphite': 1900.0, 'pad': 60.0,
           'steel': 7850.0, 'pink': 900.0}

_BVH = {}
MATERIALS = {}
BEVELS = {}


def M(v):
    return v * MM


def log(*a):
    print('[fix_backboard]', *a, flush=True)


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
    MATERIALS['ivory'] = make_mat('CJ_backboard_shell_ivory', (0.735, 0.715, 0.668), 0.58, 0.0)
    MATERIALS['graphite'] = make_mat('CJ_backboard_frame_graphite', (0.108, 0.113, 0.124),
                                     0.52, 0.20)
    MATERIALS['pad'] = make_mat('CJ_backboard_pad_soft', (0.300, 0.315, 0.338), 0.92, 0.0, 0.25)
    MATERIALS['steel'] = make_mat('CJ_backboard_steel', (0.520, 0.532, 0.552), 0.30, 1.0)
    MATERIALS['pink'] = make_mat('CJ_backboard_accent_pink', (0.640, 0.265, 0.315), 0.66, 0.0)


# --- профили -------------------------------------------------------------
def rrect_pts(w, h, r, n=PAD_CORNER_N, n_side=4, cx=0.0, cz=0.0):
    """Точки скруглённого прямоугольника (w x h, радиус r) в плоскости XZ, CCW.

    Прямые участки контура тоже разбиты (n_side): иначе боковая стенка высотой
    1.1 м остаётся одной длинной непалнарной гранью, при триангуляции она
    наклоняется на 0.02° и луч-измеритель промахивается на 0.2 мм внутрь.
    Всегда (n + n_side - 1) точек на угол: индекс точки одинаков между секциями
    с разными w/h/r, поэтому такие секции сшиваются квадами один-к-одному.
    """
    r = max(0.0, min(r, w * 0.5, h * 0.5))
    hx, hz = w * 0.5 - r, h * 0.5 - r
    corners = ((hx, -hz, -90.0), (hx, hz, 0.0), (-hx, hz, 90.0), (-hx, -hz, 180.0))
    pts = []
    for ci, (ox, oz, a0) in enumerate(corners):
        for i in range(n):
            a = math.radians(a0 + 90.0 * i / n)
            pts.append((cx + ox + r * math.cos(a), cz + oz + r * math.sin(a)))
        nx, nz, na = corners[(ci + 1) % 4]
        p_end = (cx + ox + r * math.cos(math.radians(a0 + 90.0)),
                 cz + oz + r * math.sin(math.radians(a0 + 90.0)))
        p_next = (cx + nx + r * math.cos(math.radians(na)),
                  cz + nz + r * math.sin(math.radians(na)))
        for k in range(1, n_side):
            f = k / float(n_side)
            pts.append((p_end[0] + (p_next[0] - p_end[0]) * f,
                        p_end[1] + (p_next[1] - p_end[1]) * f))
    return pts


def loft(bm, sections, cz=0.0):
    """Сшить секции (y, w, h, r) в замкнутое тело: стенки + плоские торцы."""
    loops = []
    for (y, w, h, r) in sections:
        pts = rrect_pts(w, h, r, PAD_CORNER_N, cz=cz)
        loops.append([bm.verts.new((x, y, z)) for (x, z) in pts])
    n = len(loops[0])
    for A, B in zip(loops[:-1], loops[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((A[i], A[j], B[j], B[i]))
    bm.faces.new(loops[0][::-1])
    bm.faces.new(loops[-1])
    return loops


def ring_solid(bm, y0, y1, wo, ho, ro, wi, hi, ri, cz=0.0):
    """Прямоугольная рамка (бортик) как замкнутая оболочка: 2 стенки + 2 торца."""
    o0 = [bm.verts.new((x, y0, z)) for (x, z) in rrect_pts(wo, ho, ro, PAD_CORNER_N, cz=cz)]
    i0 = [bm.verts.new((x, y0, z)) for (x, z) in rrect_pts(wi, hi, ri, PAD_CORNER_N, cz=cz)]
    o1 = [bm.verts.new((x, y1, z)) for (x, z) in rrect_pts(wo, ho, ro, PAD_CORNER_N, cz=cz)]
    i1 = [bm.verts.new((x, y1, z)) for (x, z) in rrect_pts(wi, hi, ri, PAD_CORNER_N, cz=cz)]
    n = len(o0)
    for A, B in ((o0, o1), (i1, i0)):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((A[i], A[j], B[j], B[i]))
    for A, B in ((o0, i0), (i1, o1)):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((A[i], A[j], B[j], B[i]))
    return o0, i0, o1, i1


def bm_box(bm, sx, sy, sz, center=(0.0, 0.0, 0.0)):
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    return verts


def bm_cyl_y(bm, r, y0, y1, cx, cz, n=32):
    """Цилиндр вдоль Y (ось отверстия в задней плоскости)."""
    a0, a1 = [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        a0.append(bm.verts.new((cx + r * math.cos(a), y0, cz + r * math.sin(a))))
        a1.append(bm.verts.new((cx + r * math.cos(a), y1, cz + r * math.sin(a))))
    bm.faces.new(a0)
    bm.faces.new(a1[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a0[i], a0[j], a1[j], a1[i]))


def bm_ring_y(bm, r0, r1, y0, y1, cx=0.0, cz=0.0, segs=40):
    """Стальная вставка: кольцо (труба) вокруг оси Y, замкнутая оболочка."""
    rings = []
    for i in range(segs):
        a = 2.0 * math.pi * i / segs

        def P(yy, rr):
            return bm.verts.new((cx + rr * math.cos(a), yy, cz + rr * math.sin(a)))

        rings.append((P(y0, r0), P(y1, r0), P(y1, r1), P(y0, r1)))
    for i in range(segs):
        A, B = rings[i], rings[(i + 1) % segs]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((A[k], A[k2], B[k2], B[k]))


def _new_obj(name, bm, root, mats):
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


def cutter_multi(name, cyls):
    """Один объект-резак из нескольких цилиндров вдоль Y: (r, y0, y1, x, z)."""
    bm = bmesh.new()
    for (r, y0, y1, cx, cz) in cyls:
        bm_cyl_y(bm, r, y0, y1, cx, cz, n=32)
    return _new_obj(name, bm, None, [])


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
        BEVELS[ob.name] = False
        return False
    bpy.data.meshes.remove(backup)
    BEVELS[ob.name] = True
    return True


# --- детали --------------------------------------------------------------
def pattern_cutters(depth_y1, cb=True):
    """Резаки одного паттерна: 4x Ø9 (±15) + Ø6 в центре, ось Y."""
    out_cb, out_thru = [], []
    y0, y1 = M(-31.0), depth_y1
    for (pid, zc) in PATTERNS:
        for sx in (-1, 1):
            for sz in (-1, 1):
                cx, cz = M(sx * BOLT_GRID), M(zc + sz * BOLT_GRID)
                out_thru.append((M(M8_BORE) * 0.5, y0, y1, cx, cz))
                if cb:
                    out_cb.append((M(CB_D) * 0.5, M(SPINE_Y0 - 1.0),
                                   M(SPINE_Y0 + CB_DEPTH), cx, cz))
        out_thru.append((M(PIN_BORE) * 0.5, y0, y1, 0.0, M(zc)))
        if cb:
            out_cb.append((M(PIN_CB_D) * 0.5, M(SPINE_Y0 - 1.0),
                           M(SPINE_Y0 + CB_DEPTH), 0.0, M(zc)))
    return out_cb, out_thru


def build_panel(root):
    bm = bmesh.new()
    loft(bm, [(M(PANEL_Y0), M(BB_W), M(BB_H), M(PANEL_R)),
              (M(PANEL_Y1), M(BB_W), M(BB_H), M(PANEL_R))], cz=M(BB_H * 0.5))
    ob = _new_obj(PREFIX + 'back_panel', bm, root, [MATERIALS['ivory']])
    safe_bevel(ob, M(BEVEL_PANEL), segments=2, angle=25.0)
    _, thru = pattern_cutters(M(PANEL_Y1) + M(0.5), cb=False)
    boolean_cut(ob, cutter_multi('c_panel_holes', thru))
    st = cleanup_mesh(ob)
    log('panel after cuts: nm=%d dg=%d verts=%d' % (st['non_manifold'], st['degenerate'],
                                                    st['verts']))
    ob['cj_role'] = ('back panel 700x1200x18 (ivory, R40 outline, 2.0 fillet); carries the '
                     'removable pad and the frame; 15 bores D9/D6 for the three M8 patterns')
    return ob


def build_spine(root):
    bm = bmesh.new()
    loft(bm, [(M(SPINE_Y0), M(SPINE_W), M(SPINE_Z1 - SPINE_Z0), M(SPINE_R)),
              (M(SPINE_Y1), M(SPINE_W), M(SPINE_Z1 - SPINE_Z0), M(SPINE_R))],
         cz=M((SPINE_Z0 + SPINE_Z1) * 0.5))
    ob = _new_obj(PREFIX + 'spine_rail', bm, root, [MATERIALS['graphite']])
    safe_bevel(ob, M(BEVEL_SPINE), segments=2, angle=25.0)
    cb, thru = pattern_cutters(M(PANEL_Y1) + M(0.5), cb=True)
    boolean_cut(ob, cutter_multi('c_spine_cb', cb))
    boolean_cut(ob, cutter_multi('c_spine_thru', thru))
    st = cleanup_mesh(ob)
    log('spine after cuts: nm=%d dg=%d verts=%d' % (st['non_manifold'], st['degenerate'],
                                                    st['verts']))
    ob['cj_role'] = ('graphite back rail 180x1180x8 flush with the rear plane y=-30; carries '
                     'the three M8 mounting patterns (primary/top/bottom), counterbored for '
                     'the steel thread inserts')
    return ob


def build_ribs(root):
    bm = bmesh.new()
    for xs in (-1, 1):
        x0, x1 = sorted((xs * M(RIB_X0), xs * M(RIB_X1)))
        bm_box(bm, x1 - x0, M(RIB_Y1 - RIB_Y0), M(SPINE_Z1 - SPINE_Z0),
               ((x0 + x1) * 0.5, M((RIB_Y0 + RIB_Y1) * 0.5),
                M((SPINE_Z0 + SPINE_Z1) * 0.5)))
    ob = _new_obj(PREFIX + 'rear_ribs', bm, root, [MATERIALS['graphite']])
    safe_bevel(ob, M(BEVEL_RIB), segments=2, angle=25.0)
    ob['cj_role'] = ('two 40x8 stiffening ribs on the rear face flanking the spine rail '
                     '(x +-130..+-170); keep the 700 mm board from bowing under load')
    return ob


def build_rim(root):
    bm = bmesh.new()
    ring_solid(bm, M(RIM_Y0), M(RIM_Y1), M(BB_W), M(BB_H), M(RIM_OUT_R),
               M(RIM_IN_W), M(RIM_IN_H), M(RIM_IN_R), cz=M(BB_H * 0.5))
    ob = _new_obj(PREFIX + 'rim_frame', bm, root, [MATERIALS['graphite']])
    safe_bevel(ob, M(BEVEL_RIM), segments=2, angle=25.0)
    ob['cj_role'] = ('graphite surround frame: outer 700x1200 R40 flush with the panel, '
                     '610x1110 R14 window, 14 mm deep, 2.5 mm fillet; retains the pad with a '
                     '3 mm clearance all round')
    return ob


def pad_sections():
    secs = [(M(PAD_Y0), M(PAD_W), M(PAD_H), M(PAD_R)),
            (M(PAD_RO_Y0), M(PAD_W), M(PAD_H), M(PAD_R))]
    steps = PAD_RO_STEPS
    for i in range(1, steps + 1):
        th = math.radians(90.0 * i / steps)
        inset = PAD_RO * (1.0 - math.cos(th))
        y = PAD_RO_Y0 + PAD_RO * math.sin(th)
        secs.append((M(y), M(PAD_W - 2.0 * inset), M(PAD_H - 2.0 * inset),
                     M(max(4.0, PAD_R - inset))))
    return secs


def build_pad(root):
    bm = bmesh.new()
    loft(bm, pad_sections(), cz=M(BB_H * 0.5))
    ob = _new_obj(PREFIX + 'pad', bm, root, [MATERIALS['pad']])
    for p in ob.data.polygons:
        p.use_smooth = True
    ob['cj_role'] = ('removable soft pad 604x1104x33 (y -4..+29), R32 outline, 19 mm '
                     'roundover on the face -> no sharp edges; 3 mm clearance to the rim')
    return ob


def build_strap(root):
    bm = bmesh.new()
    bm_box(bm, M(2.0 * STRAP_X), M(STRAP_Y1 - STRAP_Y0), M(STRAP_Z1 - STRAP_Z0),
           (0.0, M((STRAP_Y0 + STRAP_Y1) * 0.5), M((STRAP_Z0 + STRAP_Z1) * 0.5)))
    ob = _new_obj(PREFIX + 'pad_strap', bm, root, [MATERIALS['pink']])
    safe_bevel(ob, M(BEVEL_STRAP), segments=2, angle=30.0)
    ob['cj_role'] = ('muted-pink pull strap 180x34x12 sewn into the pad face (1 mm proud); '
                     'pull it to lift the pad out of the frame')
    return ob


def build_inserts(root):
    bm = bmesh.new()
    for (pid, zc) in PATTERNS:
        for sx in (-1, 1):
            for sz in (-1, 1):
                bm_ring_y(bm, M(INSERT_R0), M(INSERT_R1), M(SPINE_Y0),
                          M(SPINE_Y0 + CB_DEPTH), M(sx * BOLT_GRID), M(zc + sz * BOLT_GRID))
        bm_ring_y(bm, M(PIN_INSERT_R0), M(PIN_INSERT_R1), M(SPINE_Y0),
                  M(SPINE_Y0 + CB_DEPTH), 0.0, M(zc))
    ob = _new_obj(PREFIX + 'rear_inserts', bm, root, [MATERIALS['steel']])
    ob['cj_role'] = ('12 steel thread inserts D16/D9.2 for M8 + 3 locating bushes D12/D6.2, '
                     'all flush with the rear plane y=-30')
    return ob


def obj_mesh_objs(root=None):
    return [o for o in bpy.data.objects
            if o.type == 'MESH' and o.name.startswith(PREFIX)]


def build():
    reset_scene()
    build_materials()
    root = bpy.data.objects.new(CID, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.16
    bpy.context.scene.collection.objects.link(root)

    parts = {}
    parts['panel'] = build_panel(root)
    parts['spine'] = build_spine(root)
    parts['ribs'] = build_ribs(root)
    parts['rim'] = build_rim(root)
    parts['pad'] = build_pad(root)
    parts['strap'] = build_strap(root)
    parts['inserts'] = build_inserts(root)

    meshes = obj_mesh_objs()
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for ob in obj_mesh_objs():
        me = ob.data
        nv = len(me.vertices) if me else 0
        if me is None or nv == 0:
            raise RuntimeError('empty mesh: %s (mesh=%r, verts=%d)' % (ob.name, me, nv))
        if len(me.polygons) == 0:
            raise RuntimeError('no faces: %s (verts=%d, polys=0)' % (ob.name, nv))
        dim = ob.dimensions
        if min(dim) <= 1e-7:
            raise RuntimeError('degenerate body: %s dimensions %s' % (ob.name, tuple(dim)))
        if max(dim) > 1.5 or max(dim) < 0.0005:
            raise RuntimeError('unit guard: %s dimensions %s' % (ob.name, tuple(dim)))
        if tuple(round(v, 6) for v in ob.scale) != (1.0, 1.0, 1.0):
            raise RuntimeError('scale guard: %s scale %s' % (ob.name, tuple(ob.scale)))
        log('solid %-34s verts %5d polys %5d dims %s'
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


def bisect(fn, lo, hi, iters=24):
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        if fn(mid):
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def measure_rear_patterns(parts):
    """Каждый паттерн: 4x M8 (Ø9) + Ø6, сквозь спинку и панель, слепо в подушку."""
    panel, spine = parts['panel'], parts['spine']
    objs = [panel, spine]
    out = {}

    def open_at(x, z, dist=M(26.5)):
        for ob in objs:
            if ray(ob, (x, M(-35.0), z), (0.0, 1.0, 0.0), dist) is not None:
                return False
        return True

    for (pid, zc) in PATTERNS:
        holes = []
        for sx in (-1, 1):
            for sz in (-1, 1):
                cx, cz = M(sx * BOLT_GRID), M(zc + sz * BOLT_GRID)
                ok = open_at(cx, cz)
                dia = None
                if ok:
                    ex = bisect(lambda o: open_at(cx + o, cz), 0.0, M(9))
                    ez = bisect(lambda o: open_at(cx, cz + o), 0.0, M(9))
                    dia = [round(ex * 2000, 2), round(ez * 2000, 2)]
                holes.append({'id': '%s_M8_%s%s' % (pid, '+' if sx > 0 else '-',
                                                    '+' if sz > 0 else '-'),
                              'grid_mm': [sx * BOLT_GRID, sz * BOLT_GRID],
                              'grid_abs_mm': [sx * BOLT_GRID, zc + sz * BOLT_GRID],
                              'center_m': [round(cx, 5), round(M(-30.0), 5), round(cz, 5)],
                              'open': ok, 'dia_mm': dia})
        pin_open = open_at(0.0, M(zc))
        pin_dia = None
        if pin_open:
            ex = bisect(lambda o: open_at(o, M(zc)), 0.0, M(6))
            ez = bisect(lambda o: open_at(0.0, M(zc) + o), 0.0, M(6))
            pin_dia = [round(ex * 2000, 2), round(ez * 2000, 2)]
        holes_ok = all(h['open'] and h['dia_mm'] and abs(h['dia_mm'][0] - M8_D) <= 0.3
                       and abs(h['dia_mm'][1] - M8_D) <= 0.3 for h in holes)
        pin_ok = (pin_open and pin_dia is not None
                  and abs(pin_dia[0] - PIN_BORE) <= 0.3
                  and abs(pin_dia[1] - PIN_BORE) <= 0.3)
        # болт не должен выходить в подушку: луч спереди упирается в подушку/стропу
        blind = ray(parts['pad'], (0.0, M(35.0), M(zc)), (0.0, -1.0, 0.0), M(40.0)) is not None
        out[pid] = {'pattern_z_mm': zc, 'plane_mm': 'y=-30 (rear face)',
                    'grid_mm': BOLT_GRID, 'holes': holes,
                    'pin': {'center_mm': [0.0, zc], 'dia_mm': PIN_BORE,
                            'measured_dia_mm': pin_dia, 'open': pin_open},
                    'blind_into_pad': blind,
                    'holes_ok': holes_ok, 'pin_ok': pin_ok, 'blind_ok': blind,
                    'ok': holes_ok and pin_ok and blind}
    return out


def pad_analytic_half_w(y_mm):
    """Полуширина подушки по X на глубине y (мм) — по тому же профилю, что в loft."""
    if y_mm <= PAD_RO_Y0:
        return PAD_W * 0.5
    s = min(1.0, max(0.0, (y_mm - PAD_RO_Y0) / PAD_RO))
    th = math.asin(s)
    return PAD_W * 0.5 - PAD_RO * (1.0 - math.cos(th))


def measure_pad(parts):
    pad, rim, strap = parts['pad'], parts['rim'], parts['strap']
    mn, mx = bbox_of([pad])
    zc = M(BB_H * 0.5)

    def half_w_of(ob, sign, y, z=zc):
        """Полуширина по X с указанной стороны: луч снаружи внутрь, берём |x|."""
        p = ray(ob, (M(sign * 400.0), y, z), (-sign, 0.0, 0.0), M(700.0))
        return abs(p.x) * 1000.0 if p else None

    # подушка: обе стороны в среднем сечении (y=0) -> размер + симметрия
    pad_plus = half_w_of(pad, 1, 0.0)
    pad_minus = half_w_of(pad, -1, 0.0)
    half_w = pad_plus if pad_plus is not None else pad_minus
    pad_sym = round(abs(pad_plus - pad_minus), 3) if (pad_plus and pad_minus) else None
    # окно рамки: луч из прорези зазора наружу
    p_rim = ray(rim, (M(-(PAD_W * 0.5 + PAD_GAP * 0.5)), 0.0, zc), (-1.0, 0.0, 0.0), M(6.0))
    rim_in_x = abs(p_rim.x) * 1000.0 if p_rim else None
    # верх подушки и низ окна рамки
    p_top = ray(pad, (0.0, 0.0, M(600.0)), (0.0, 0.0, 1.0), M(800.0))
    pad_top = abs(p_top.z) * 1000.0 if p_top else None
    p_rim_top = ray(rim, (0.0, 0.0, M(RIM_IN_H * 0.5 + BB_H * 0.5 - PAD_GAP * 0.5)),
                    (0.0, 0.0, 1.0), M(6.0))
    rim_in_top = abs(p_rim_top.z) * 1000.0 if p_rim_top else None
    # скругление лица: полуширина на нескольких глубинах против аналитики.
    # Последние 0.1 мм перед лицом не сэмплируем: там поверхность почти
    # параллельна лучу и попадание вырождается в шум, а не в замер.
    prof = []
    for y in (0.0, 10.0, 13.0, 16.0, 19.0, 22.0, 25.0, 27.5):
        meas = half_w_of(pad, 1, M(y))
        exp = pad_analytic_half_w(y)
        prof.append({'y_mm': y, 'half_w_mm': round(meas, 2) if meas else None,
                     'expected_mm': round(exp, 2),
                     'residual_mm': round(abs(meas - exp), 2) if meas else None})
    res = [p['residual_mm'] for p in prof if p['residual_mm'] is not None]
    front_w = 2.0 * (PAD_W * 0.5 - PAD_RO)
    strap_mn, strap_mx = bbox_of([strap])
    gap = round((rim_in_x - half_w), 3) if (rim_in_x is not None and half_w) else None
    gap_top = round((rim_in_top - pad_top), 3) if (rim_in_top and pad_top) else None
    rec = {
        'node': pad.name,
        'size_mm': [round(v * 1000, 2) for v in (mx - mn)],
        'y_range_mm': [round(mn.y * 1000, 2), round(mx.y * 1000, 2)],
        'z_range_mm': [round(mn.z * 1000, 2), round(mx.z * 1000, 2)],
        'nominal_mm': [PAD_W, PAD_H, PAD_T],
        'measured_half_w_mm': round(half_w, 2) if half_w else None,
        'measured_half_w_plus_mm': round(pad_plus, 2) if pad_plus else None,
        'measured_half_w_minus_mm': round(pad_minus, 2) if pad_minus else None,
        'symmetry_delta_mm': pad_sym,
        'nominal_half_w_mm': PAD_W * 0.5,
        'rim_inner_half_w_mm': round(rim_in_x, 2) if rim_in_x else None,
        'side_gap_mm': gap,
        'nominal_gap_mm': PAD_GAP,
        'measured_pad_top_mm': round(pad_top, 2) if pad_top else None,
        'rim_inner_top_mm': round(rim_in_top, 2) if rim_in_top else None,
        'top_gap_mm': gap_top,
        'front_plane_mm': round(mx.y * 1000, 2),
        'rim_front_mm': RIM_Y1,
        'face_roundover_mm': PAD_RO,
        'face_width_mm': front_w,
        'protrusion_over_rim_mm': round(mx.y * 1000 - RIM_Y1, 2),
        'surface_profile': prof,
        'profile_max_residual_mm': round(max(res), 3) if res else None,
        'strap': {'node': strap.name, 'material': 'CJ_backboard_accent_pink',
                  'bbox_mm': {'min': [round(v * 1000, 2) for v in strap_mn],
                              'max': [round(v * 1000, 2) for v in strap_mx]},
                  'proud_of_face_mm': round((strap_mx.y - mx.y) * 1000, 2)},
        'removable': 'зазор %.1f мм по контуру; подушка лежит на панели и держится рамкой, '
                     'вынимается за розовую стропу' % PAD_GAP,
        'ok': (abs(gap - PAD_GAP) <= 0.3 if gap is not None else False)
              and (abs(gap_top - PAD_GAP) <= 0.3 if gap_top is not None else False)
              and abs((mx - mn).x * 1000 - PAD_W) <= 0.3
              and abs((mx - mn).z * 1000 - PAD_H) <= 0.3
              and abs(mx.y * 1000 - PAD_Y1) <= 0.4
              and abs(mn.y * 1000 - PAD_Y0) <= 0.4
              and (pad_sym is not None and pad_sym <= 0.1)
              and (max(res) <= 0.6 if res else False),
    }
    return rec


def measure_corners(parts):
    """Контур R40 панели и рамки: на 0.5 мм ниже верха полуширина должна быть < 350.

    Луч идёт снаружи внутрь, поэтому полуширина = |x попадания|; знак в отчёте
    не имеет смысла, а разность |x| - ожидание и есть остаток.
    """
    z = M(BB_H - 0.5)
    exp = (BB_W * 0.5 - PANEL_R) + math.sqrt(PANEL_R ** 2 - (PANEL_R - 0.5) ** 2)
    out = {}
    for tag, ob, y in (('panel', parts['panel'], M(-13.0)), ('rim', parts['rim'], M(0.0))):
        vals = {}
        for sign in (1, -1):
            p = ray(ob, (M(sign * 400.0), y, z), (-sign, 0.0, 0.0), M(700.0))
            vals[sign] = abs(p.x) * 1000.0 if p else None
        meas = vals[1] if vals[1] is not None else vals[-1]
        out[tag] = {'node': ob.name, 'z_mm': BB_H - 0.5,
                    'half_w_mm': round(meas, 2) if meas else None,
                    'half_w_plus_mm': round(vals[1], 2) if vals[1] else None,
                    'half_w_minus_mm': round(vals[-1], 2) if vals[-1] else None,
                    'symmetry_delta_mm': (round(abs(vals[1] - vals[-1]), 3)
                                          if (vals[1] and vals[-1]) else None),
                    'expected_mm': round(exp, 2),
                    'residual_mm': round(abs(meas - exp), 2) if meas else None,
                    'radius_mm': PANEL_R}
    ok = all(v['residual_mm'] is not None and v['residual_mm'] <= 0.6
             and v['symmetry_delta_mm'] is not None and v['symmetry_delta_mm'] <= 0.1
             and v['half_w_mm'] < BB_W * 0.5 - 10.0 for k, v in out.items() if k != 'ok')
    out['ok'] = ok
    return out


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
            for k in ('steel', 'pink', 'pad', 'graphite', 'ivory'):
                if k in mat.name:
                    key = k
                    break
            break
        vol_by_key[key] = vol_by_key.get(key, 0.0) + st['volume_cm3']

    mass = sum(v * 1e-6 * DENSITY.get(k, 2700.0) for k, v in vol_by_key.items())
    mats = sorted({m.name for ob in meshes for m in ob.data.materials if m})

    rear = measure_rear_patterns(parts)
    pad = measure_pad(parts)
    corners = measure_corners(parts)

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
                                  and max(ob.dimensions) <= 1.5 for ob in meshes),
        'material_count': len(mats),
        'material_count_ok': 4 <= len(mats) <= 8,
        'bbox_size_m': [round(v, 5) for v in size],
        'bbox_ok': (abs(size.x - M(BB_W)) <= 0.0008 and abs(size.y - M(BB_D)) <= 0.0008
                    and abs(size.z - M(BB_H)) <= 0.0008
                    and abs(mn.z) <= 0.0008 and abs(mn.x + M(BB_W * 0.5)) <= 0.0008
                    and abs(mn.y + M(BB_D * 0.5)) <= 0.0008),
        'mass_kg_est': round(mass, 3),
        'rear_patterns': rear,
        'rear_pattern_ok': all(v['ok'] for v in rear.values()),
        'pattern_count': len(rear),
        'pad': pad,
        'pad_ok': pad['ok'],
        'outline_corners': corners,
        'outline_ok': corners['ok'],
        'bevels': dict(BEVELS),
        'bevel_ok': all(BEVELS.values()) if BEVELS else False,
        'node_count': len(meshes),
        'node_count_ok': len(meshes) >= 7,
        'prefix_ok': all(ob.name.startswith(PREFIX) for ob in meshes),
        'no_negative_scale': all(ob.matrix_world.determinant() > 1e-9 for ob in meshes),
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'volume_by_material_cm3': {k: round(v, 3) for k, v in vol_by_key.items()},
        'animation': 'none (static fixture part)',
        'animation_ok': len(bpy.data.actions) == 0,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))
    return checks, dict(mn=mn, mx=mx, size=size, mass=mass, mats=mats, verts=verts,
                        tris=tris, per_obj=per_obj, rear=rear, pad=pad, corners=corners,
                        vol=vol_by_key)


# --- report --------------------------------------------------------------
def build_report(root, checks, m):
    rear_if = {}
    for pid, zc in PATTERNS:
        r = m['rear'][pid]
        rear_if[pid] = {
            'role': ('primary interface to fix_tilt' if pid == 'primary'
                     else 'alternative mounting point (%s edge)' % pid),
            'plane': 'Y at y=-30 mm (rear face), normal +Y into the board',
            'pattern_center_mm': [0.0, -30.0, zc],
            'grid_mm': BOLT_GRID,
            'plate_compat': 'fix_tilt top plate 160x100 with 4x M8 +-15 + centre D6',
            'm8': [{'id': h['id'], 'grid_mm': h['grid_mm'],
                    'center_m': h['center_m'],
                    'dia_mm': M8_D, 'measured_dia_mm': h['dia_mm']} for h in r['holes']],
            'pin_bore': r['pin'],
            'bolts': 'M8 x4 (D9 through 18 mm panel + 8 mm spine, blind at the pad) + '
                     'D6 locating bore',
            'blind_ok': r['blind_into_pad'],
        }
    return {
        'id': CID,
        'code': 'CJ-BACK-700-1200',
        'name': 'Спинка-ложе 700x1200',
        'kit': 'CJ-FIX-KIT',
        'class': 'FIXTURE / support surface',
        'standard': 'CJ-FIX-KIT',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_backboard.py',
        'units': 'm',
        'spec': {
            'overall_mm': [BB_W, BB_H, BB_D],
            'orientation': 'X width, Y thickness (rear at -30, face at +29/+30), Z height',
            'panel_mm': [BB_W, BB_H, PANEL_T],
            'panel_y_mm': [PANEL_Y0, PANEL_Y1],
            'spine_mm': [SPINE_W, SPINE_T, SPINE_Z1 - SPINE_Z0],
            'ribs_mm': [2 * (RIB_X1 - RIB_X0), RIB_Y1 - RIB_Y0, SPINE_Z1 - SPINE_Z0],
            'rim_mm': {'outer': [BB_W, BB_H], 'window': [RIM_IN_W, RIM_IN_H],
                       'depth': RIM_D, 'bar': RIM_BAR},
            'pad_mm': [PAD_W, PAD_H, PAD_T],
            'pad_clearance_mm': PAD_GAP,
            'pad_roundover_mm': PAD_RO,
            'patterns': [{'id': pid, 'center_z_mm': zc, 'grid_mm': BOLT_GRID,
                          'bolts': '4x M8 D9', 'locating': 'D6'}
                         for pid, zc in PATTERNS],
            'mass_kg_spec': 48.0,
            'material': 'Al 6061 panel / graphite spine, ribs and rim / foam pad with '
                        'textile face / steel inserts / painted pink strap',
            'load_kn_concept': 1.5,
        },
        'bbox_m': {'min': [round(v, 5) for v in m['mn']],
                   'max': [round(v, 5) for v in m['mx']],
                   'size': [round(v, 5) for v in m['size']],
                   'nominal': [round(M(BB_W), 5), round(M(BB_D), 5), round(M(BB_H), 5)],
                   'nominal_mm': [BB_W, BB_D, BB_H],
                   'ok': checks['bbox_ok']},
        'rear_patterns': m['rear'],
        'rear_pattern_coords_mm': {
            pid: {'center': [0.0, -30.0, zc],
                  'm8': [[h['grid_abs_mm'][0], zc + h['grid_mm'][1]] for h in m['rear'][pid]['holes']],
                  'pin': [0.0, zc]} for pid, zc in PATTERNS},
        'pad': m['pad'],
        'outline_corners': m['corners'],
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
        'interfaces': {
            'rear_primary': rear_if['primary'],
            'rear_top': rear_if['top'],
            'rear_bottom': rear_if['bottom'],
            'pad_seat': {
                'role': 'removable pad seat',
                'plane': 'Y at y=-4 mm (panel front face)',
                'window_mm': [RIM_IN_W, RIM_IN_H], 'window_radius_mm': RIM_IN_R,
                'pad_clearance_mm': PAD_GAP, 'pad_depth_mm': RIM_D,
                'retention': 'recessed rim frame, 3 mm clearance, lift by the pink strap',
            },
            'frame_face': {
                'role': 'outer face plane of the surround frame',
                'plane': 'Y at y=+10 mm', 'outline_mm': [BB_W, BB_H],
                'pad_protrusion_mm': round(m['pad']['front_plane_mm'] - RIM_Y1, 2),
            },
        },
        'checks': checks,
        'renders': [],
        'glb': None,
        'glb_bytes': None,
        'notes': [
            'Габарит 700x1200x60: панель 18 мм (y -22…-4) + спина-рельс 8 мм (y -30…-22) '
            '+ подушка 33 мм (y -4…+29); до 60 мм глубину добирает стропа-ручка (y +30).',
            'Три паттерна M8 на задней плоскости y=-30: primary z=760 (интерфейс fix_tilt), '
            'top z=1100 и bottom z=200 — альтернативные точки крепления. В каждом 4x Ø9 по '
            'сетке ±15 мм и Ø6 в центре; отверстия идут сквозь спинку и панель (26 мм) и '
            'упираются в подушку, т.е. болт не выходит на лицо.',
            'Подушка съёмная: окно рамки 610x1110, подушка 604x1104 — зазор %.1f мм по '
            'контуру; лицо имеет скругление R%.0f, кромки рамки и панели — фаски 2.5/2.0 мм, '
            'острых кромок нет.' % (PAD_GAP, PAD_RO),
            'Стальные вставки (12x Ø16/Ø9.2 + 3x Ø12/Ø6.2) стоят заподлицо в цековках '
            'спинки: под M8 вкручиваются в резьбовые вставки, Ø6 — центрирующий палец.',
            'Масса по фактическим объёмам: %.1f кг (алюминиевая панель + графитовые спина/'
            'рёбра/рамка + пена).' % m['mass'],
        ],
        'deviations': [
            'Резьба M8 не моделировалась: отверстия Ø9 + стальные вставки Ø16/Ø9.2 в '
            'цековках 4 мм; вставки держат болт, панель служит только затяжкой.',
            'Механизм фиксации подушки — только геометрия посадки (зазор 3 мм + рамка); '
            'пружинные защёлки не моделировались, съём рукой за стропу.',
            'Общая глубина 60 мм включает стропу-ручку, выступающую на 1 мм за лицо '
            'подушки (29 -> 30); сама подушка заканчивается на y=+29.',
            'Наклон/рабочий угол спинки задаётся узлом fix_tilt, здесь его нет: спинка '
            'отдаётся вертикально (0°), плоскость интерфейса — задняя.',
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
    scene.view_settings.exposure = -1.05
    try:
        scene.eevee.taa_render_samples = 96
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.560, 0.566, 0.585, 1.0)
    bg.inputs['Strength'].default_value = 0.45

    meshes = obj_mesh_objs()
    mn, mx = bbox_of(meshes)
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=8.0, location=(0.0, 0.0, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    floor.data.materials.append(make_mat('render_floor_mat', (0.155, 0.153, 0.150), 0.90))

    for name, loc, energy, size in (
            ('key', (0.75, 1.05, 1.55), 70.0, 0.55),
            ('fill', (-1.00, 0.70, 0.70), 22.0, 0.90),
            ('rim', (-0.45, -1.30, 1.45), 52.0, 0.55),
            ('top', (0.10, 0.25, 2.10), 18.0, 0.80)):
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
    # крупный план задней части первичного паттерна (интерфейс fix_tilt)
    close_lo = Vector((-0.055, -0.032, 0.700))
    close_hi = Vector((0.055, -0.016, 0.820))
    c_close = box_corners(close_lo, close_hi)
    close_t = (close_lo + close_hi) * 0.5

    views = [
        ('3q', (0.62, 0.70, 0.32), center, 62, c_main, 0.885, None),
        ('front', (0.02, 0.99, 0.14), center, 100, c_main, 0.900, None),
        ('side', (0.94, 0.30, 0.10), center, 100, c_main, 0.905, None),
        ('closeup', (-0.18, -0.97, 0.14), close_t, 70, c_close, 0.86, (close_lo, close_hi)),
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
    log('nodes:', len(obj_mesh_objs()))
    checks, m = check(parts, root)
    log('bbox', checks['bbox_size_m'], '| mass', checks['mass_kg_est'],
        '| rear', checks['rear_pattern_ok'], '| pad', checks['pad_ok'],
        '| corners', checks['outline_ok'], '| bevels', checks['bevel_ok'],
        '| nm/dg', checks['non_manifold'], checks['degenerate'])

    if not checks['all_ok']:
        failed = {k: v for k, v in checks.items() if k.endswith('_ok') and not v}
        log('CHECKS FAILED', json.dumps(failed, ensure_ascii=False, default=str))
        (OUT_DIR / 'report.FAILED.json').write_text(
            json.dumps({'blocker': failed, 'checks': checks, 'per_object': m['per_obj']},
                       ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        print('CHECKS_FAILED', flush=True)
        sys.exit(2)

    rep = build_report(root, checks, m)
    root['cj_id'] = CID
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_interfaces'] = json.dumps(rep['interfaces'], ensure_ascii=False)

    if os.environ.get('CJ_SKIP_RENDER') == '1':
        (OUT_DIR / 'report_geom.json').write_text(
            json.dumps(rep, ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        log('GEOM ONLY: all_ok =', checks['all_ok'])
        print('BUILD_OK_GEOM', flush=True)
        return

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
