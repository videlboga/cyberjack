#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_latch_adapter — переходник rail/carriage -> CJ-LATCH-30.

Standalone builder. Не трогает общий builder/catalog/pages и чужие модули.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_latch_adapter.py

Все размеры заданы в МИЛЛИМЕТРАХ, в сцену переводятся одним множителем M().

Локальная система (м): X — глубина приёмника, устье (окно) на +X; Y — ширина;
Z — вверх. Начало координат: центр плиты по X/Y, низ плиты по Z.

Конструкция (мм):
  * плита 80x60x8: 4 x Ø9 (M8) по сетке +-15 + Ø15x4 цековка снизу под шайбу,
    центральное гнездо Ø6,1 под штифт каретки/узла (тот же паттерн, что
    top_plate fix_carriage и площадки fix_corner_node);
  * корпус 64x60x42 — рамка с фронтальным окном 48x34: боковины 6 мм,
    верхний блок 8 мм (42…50), задняя стенка 10 мм; окно открыто вперёд,
    внутри — карман 48x34 глубиной 54 под графитовую кассету;
  * кассета (графит) — две щеки 47,9x53,8x13,8 с зевом 6,4 между ними
    (21,8…28,2), фаска входа языка 2,5x45° на обеих щеках, 2 x Ø5,2 H7
    антипроворотных гнезда на 26 мм, штифты Ø5 в заднюю стенку;
  * палец Ø12 h8 (сталь): ось на 36 мм от устья, закладной сверху, проходит
    верхнюю щеку, зев и гнездо нижней щеки; проточка Ø10 под собачку и
    головка Ø16 в верхней полости;
  * собачка (сталь) на вертикальной оси Ø6: нос 1,4 мм входит в проточку
    радиально на 1,2 мм, пружина сжатия 4,8 x 0,5 на 5 витков за хвостом;
  * рычаг сброса (pink, 3 мм) на той же оси: плечо выходит через паз задней
    стенки на заднюю площадку плиты, накладка 16x10 с отверстием Ø8 под палец;
    ход 25° -> нос собачки уходит из проточки на 4,6 мм.

Статическая модель: показано ЗАКРЫТОЕ (запертое) состояние — палец вставлен,
собачка в проточке, рычаг на упоре. Анимации в GLB нет, ход описан в отчёте.
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
CID = 'fix_latch_adapter'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001

# плита / интерфейс каретки
PLATE_X, PLATE_Y, PLATE_T = 80.0, 60.0, 8.0
M8_D = 9.0
M8_CB_D, M8_CB_T = 15.0, 4.0
BOLT_GRID = 15.0
PIN_BORE_D = 6.1

# корпус
BODY_X0, BODY_X1 = -26.0, 40.0
BODY_Y, BODY_Z0, BODY_Z1 = 60.0, 8.0, 50.0
WIN_W, WIN_H = 48.0, 34.0
WIN_Z0, WIN_Z1 = 8.0, 42.0
FRAME_HALF_Y = WIN_W * 0.5          # 24
TOP_BLOCK_Z0 = 42.0
POCKET_X0 = -14.0                   # задняя стенка 12 мм
POCKET_X1 = 40.0

# зев / щёки
THROAT = 6.4
T_FLOOR, T_CEIL = 21.8, 28.2        # 21,8…28,2 = 6,4 по центру окна (25,0)
CHEEK_X0, CHEEK_X1 = -13.85, 39.8
CHEEK_HALF_Y = 47.9 * 0.5
CHEEK_T = 13.8
CHEEK_LOW_Z0, CHEEK_LOW_Z1 = 8.0, T_FLOOR
CHEEK_UP_Z0, CHEEK_UP_Z1 = T_CEIL, 42.0
CHAMFER = 2.5                       # фаска входа языка, 45°

# палец
PIN_X, PIN_Y = 4.0, 0.0
PIN_D = 12.0
PIN_BORE = 12.15
PIN_Z0 = 9.0
PIN_DEPTH = BODY_X1 - PIN_X         # 36 мм от устья
PIN_GROOVE_D, PIN_GROOVE_Z0, PIN_GROOVE_Z1 = 10.0, 42.6, 44.4
PIN_HEAD_D, PIN_HEAD_Z0, PIN_HEAD_Z1 = 16.0, 44.4, 47.0
ANTIROT_D, ANTIROT_DEPTH, ANTIROT_SPACING = 5.2, 6.0, 26.0
ANTIROT_X = 0.0

# полость механизма
CAV_X0, CAV_X1 = -21.0, 26.0
CAV_HALF_Y = 8.0
CAV_Z0 = 42.0
SLOT_X0, SLOT_X1, SLOT_HALF_Y, SLOT_Z0 = -26.5, -21.0, 7.0, 47.2

# собачка / ось / пружина
AXLE_X, AXLE_Y = -8.0, 0.0
AXLE_D = 6.0
PAWL_Z0, PAWL_Z1 = 42.8, 44.2
PAWL_HUB_R = 5.5
PAWL_R_TIP = 4.8                    # радиус носка от оси пальца
PAWL_TIP_X = PIN_X - PAWL_R_TIP     # -0,8 мм: заход 1,2 мм от Ø12
PAWL_TAIL_X0 = -16.4
PAWL_FIN_Z1 = 47.15
SPRING_X0, SPRING_X1 = -20.75, -16.55
SPRING_Z = 44.7
SPRING_MEAN_R, SPRING_WIRE = 1.9, 0.5
SPRING_COILS = 5

# рычаг
LEVER_Z0, LEVER_Z1 = 47.4, 49.8
LEVER_PAD_X0, LEVER_PAD_X1 = -38.0, -28.0
LEVER_PAD_HALF_Y = 8.0
LEVER_HOLE_D = 8.0

# крепление кассеты
DOWEL_D, DOWEL_X0, DOWEL_X1 = 5.0, -22.0, -6.0
DOWEL_Z_LOW, DOWEL_Z_UP = 15.0, 35.0

BEVEL_PLATE = 2.0
BEVEL_BODY = 1.5

DENSITY = {'ivory': 2700.0, 'graphite': 1900.0, 'steel': 7850.0, 'pink': 2700.0}

TONGUES = [
    {'id': 'T-26', 'w': 26.0, 't': 6.0, 'l': 26.0, 'hole_from_nose': 26.0 - 14.3},
    {'id': 'T-30', 'w': 30.0, 't': 6.0, 'l': 34.0, 'hole_from_nose': 34.0 - 18.7},
    {'id': 'T-44', 'w': 44.0, 't': 6.0, 'l': 36.0, 'hole_from_nose': 36.0 - 19.8},
]
TRAVEL = 26.0                       # концевой ход языка по CJ-LATCH-30

_BVH = {}


def M(v):
    return v * MM


def log(*a):
    print('[fix_latch_adapter]', *a, flush=True)


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
    MATERIALS['ivory'] = make_mat('CJ_latch_matte_ivory', (0.735, 0.715, 0.668), 0.60, 0.0)
    MATERIALS['graphite'] = make_mat('CJ_latch_receiver_graphite', (0.135, 0.142, 0.152), 0.46, 0.35)
    MATERIALS['steel'] = make_mat('CJ_latch_steel', (0.520, 0.532, 0.552), 0.28, 1.0)
    MATERIALS['pink'] = make_mat('CJ_latch_accent_pink', (0.640, 0.265, 0.315), 0.44, 0.05)


# --- bmesh (метры) ------------------------------------------------------
def bm_box(bm, sx, sy, sz, center=(0.0, 0.0, 0.0)):
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    return verts


def bm_cyl(bm, r, z0, z1, cx=0.0, cy=0.0, n=40):
    ring0, ring1 = [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        ring0.append(bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a), z0)))
        ring1.append(bm.verts.new((cx + r * math.cos(a), cy + r * math.sin(a), z1)))
    bm.faces.new(ring0)
    bm.faces.new(ring1[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    return ring0 + ring1


def bm_lathe(bm, prof, segs=48, closed=False, offset=(0.0, 0.0, 0.0)):
    """Вращение профиля (r, z) вокруг оси Z. r=0 -> полюс."""
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


def bm_prism(bm, pts_xz, y0, y1):
    """Призма: 2D-полигон в XZ, выдавленный по Y."""
    a = [bm.verts.new((x, y0, z)) for (x, z) in pts_xz]
    b = [bm.verts.new((x, y1, z)) for (x, z) in pts_xz]
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    n = len(pts_xz)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    return a + b


def bm_helix(bm, x0, x1, cy, cz, mean_r, wire_r, coils, per_turn=14):
    n = coils * per_turn
    rings = []
    for i in range(n + 1):
        t = i / n
        ang = t * coils * 2.0 * math.pi
        cxx = x0 + (x1 - x0) * t
        cyy = cy + mean_r * math.cos(ang)
        czz = cz + mean_r * math.sin(ang)
        ring = []
        for k in range(8):
            b = 2.0 * math.pi * k / 8
            ring.append(bm.verts.new((cxx, cyy + wire_r * math.cos(b),
                                      czz + wire_r * math.sin(b))))
        rings.append(ring)
    for i in range(n):
        A, B = rings[i], rings[i + 1]
        for k in range(8):
            j = (k + 1) % 8
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


def cyl_cutter(name, r, z0, z1, center=(0.0, 0.0), n=40):
    bm = bmesh.new()
    bm_cyl(bm, r, z0, z1, center[0], center[1], n=n)
    return new_obj(name, bm)


def prism_cutter(name, pts_xz_mm, y0, y1):
    bm = bmesh.new()
    bm_prism(bm, [(x * MM, z * MM) for (x, z) in pts_xz_mm], y0, y1)
    return new_obj(name, bm)


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
    if strict:
        st = mesh_stats(target.data)
        if st['non_manifold'] or st['degenerate']:
            raise RuntimeError('boolean broke %s: %s' % (target.name, st))
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


# --- корпус / плита ------------------------------------------------------
def build_plate(root):
    bm = bmesh.new()
    bm_box(bm, M(PLATE_X), M(PLATE_Y), M(PLATE_T), (0.0, 0.0, M(PLATE_T) * 0.5))
    ob = finish(PREFIX + 'plate', bm, [MATERIALS['ivory']], root)
    safe_bevel(ob, M(BEVEL_PLATE), segments=2, angle=25.0)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * M(BOLT_GRID), sy * M(BOLT_GRID)
            boolean_cut(ob, cyl_cutter('c_m8', M(M8_D) * 0.5, -M(1.0), M(PLATE_T + 1.0),
                                       center=(cx, cy), n=40))
            boolean_cut(ob, cyl_cutter('c_m8_cb', M(M8_CB_D) * 0.5, -M(1.0), M(M8_CB_T),
                                       center=(cx, cy), n=44))
    boolean_cut(ob, cyl_cutter('c_pin', M(PIN_BORE_D) * 0.5, -M(1.0), M(PLATE_T + 1.0),
                               n=32))
    ob['cj_role'] = ('mounting plate 80x60x8, 4x D9 (M8) on +-15 grid with D15x4 '
                     'washer counterbore + centre D6.1 dowel bore')
    return ob


def build_body(root):
    bm = bmesh.new()
    bm_box(bm, M(BODY_X1 - BODY_X0), M(BODY_Y), M(BODY_Z1 - BODY_Z0),
           (M((BODY_X0 + BODY_X1) * 0.5), 0.0, M((BODY_Z0 + BODY_Z1) * 0.5)))
    ob = finish(PREFIX + 'body', bm, [MATERIALS['ivory']], root)
    safe_bevel(ob, M(BEVEL_BODY), segments=2, angle=25.0)

    # карман под графитовую кассету: окно 48x34 открыто вперёд
    boolean_cut(ob, box_cutter('c_pocket', M(POCKET_X1 - POCKET_X0 + 1.0), M(WIN_W),
                               M(WIN_Z1 - WIN_Z0 + 0.5),
                               (M((POCKET_X0 + POCKET_X1 + 1.0) * 0.5), 0.0,
                                M((WIN_Z0 - 0.5 + WIN_Z1) * 0.5))))
    # полость механизма в верхнем блоке (открыта сверху под закладной палец)
    boolean_cut(ob, box_cutter('c_cav', M(CAV_X1 - CAV_X0), M(CAV_HALF_Y * 2.0),
                               M(BODY_Z1 + 1.0 - CAV_Z0),
                               (M((CAV_X0 + CAV_X1) * 0.5), 0.0,
                                M((CAV_Z0 + BODY_Z1 + 1.0) * 0.5))))
    # паз рычага в задней стенке
    boolean_cut(ob, box_cutter('c_slot', M(SLOT_X1 - SLOT_X0), M(SLOT_HALF_Y * 2.0),
                               M(BODY_Z1 + 1.0 - SLOT_Z0),
                               (M((SLOT_X0 + SLOT_X1) * 0.5), 0.0,
                                M((SLOT_Z0 + BODY_Z1 + 1.0) * 0.5))))
    ob['cj_role'] = ('receiver housing: 48x34 front window, 54 deep cassette pocket, '
                     'pawl cavity in the 8 mm top block, lever slot in the back wall')
    return ob


# --- графитовые щёки -----------------------------------------------------
def build_cheek(tag, z0, z1, chamfer_up, root):
    bm = bmesh.new()
    bm_box(bm, M(CHEEK_X1 - CHEEK_X0), M(CHEEK_HALF_Y * 2.0), M(z1 - z0),
           (M((CHEEK_X0 + CHEEK_X1) * 0.5), 0.0, M((z0 + z1) * 0.5)))
    ob = finish(PREFIX + 'cheek_' + tag, bm, [MATERIALS['graphite']], root)
    safe_bevel(ob, M(0.6), segments=1, angle=40.0)
    boolean_cut(ob, cyl_cutter('c_pin', M(PIN_BORE) * 0.5, M(z0 - 1.0), M(z1 + 1.0),
                               center=(M(PIN_X), M(PIN_Y)), n=40))
    if tag == 'lower':
        for sy in (-1, 1):
            boolean_cut(ob, cyl_cutter('c_antirot', M(ANTIROT_D) * 0.5,
                                       M(T_FLOOR - ANTIROT_DEPTH), M(T_FLOOR + 1.0),
                                       center=(M(ANTIROT_X),
                                               sy * M(ANTIROT_SPACING * 0.5)), n=24))
    # фаска входа языка 2,5x45° на кромке зева со стороны устья
    z_edge = T_FLOOR if chamfer_up else T_CEIL
    sgn = 1.0 if chamfer_up else -1.0        # +1: срезаем ниже кромки, -1: выше
    x0 = CHEEK_X1
    pts = [(x0 - CHAMFER, z_edge), (x0 + 2.0, z_edge),
           (x0 + 2.0, z_edge - sgn * (CHAMFER + 2.0))]
    boolean_cut(ob, prism_cutter('c_chamfer', pts, -M(CHEEK_HALF_Y + 1.0),
                                 M(CHEEK_HALF_Y + 1.0)))
    ob['cj_role'] = ('graphite receiver cheek %s, z %.1f…%.1f, throat side '
                     'z=%.2f, entry chamfer 2.5x45' % (tag, z0, z1, z_edge))
    return ob


# --- палец / собачка / ось / пружина / рычаг ----------------------------
def build_pin(root):
    prof = [(0.0, PIN_Z0), (PIN_D * 0.5, PIN_Z0), (PIN_D * 0.5, PIN_GROOVE_Z0 - 0.2),
            (PIN_GROOVE_D * 0.5, PIN_GROOVE_Z0), (PIN_GROOVE_D * 0.5, PIN_GROOVE_Z1),
            (PIN_D * 0.5, PIN_GROOVE_Z1 + 0.2), (PIN_HEAD_D * 0.5, PIN_HEAD_Z1 - 1.2),
            (PIN_HEAD_D * 0.5 - 0.9, PIN_HEAD_Z1), (0.0, PIN_HEAD_Z1)]
    bm = bmesh.new()
    bm_lathe(bm, [(r * MM, z * MM) for (r, z) in prof], segs=44,
             offset=(M(PIN_X), M(PIN_Y), 0.0))
    ob = finish(PREFIX + 'pin', bm, [MATERIALS['steel']], root)
    ob['cj_role'] = ('D12 h8 drop pin, axis %0.0f mm behind the mouth, turned D10 groove '
                     'for the pawl, D16 head in the top cavity' % PIN_DEPTH)
    return ob


def build_pawl(root):
    bm = bmesh.new()
    z0, z1 = M(PAWL_Z0), M(PAWL_Z1)
    hub_r_edge = AXLE_X + PAWL_HUB_R       # -2,5
    hub_l_edge = AXLE_X - PAWL_HUB_R       # -13,5
    # ступица на оси Ø6
    bm_cyl(bm, M(PAWL_HUB_R), z0, z1, M(AXLE_X), M(AXLE_Y), n=36)
    # плечо к пальцу + нос в проточку (радиус носка 4,8 от оси пальца)
    bm_box(bm, M(PAWL_TIP_X - hub_r_edge + 0.4), M(5.0), z1 - z0,
           (M((hub_r_edge + PAWL_TIP_X) * 0.5), 0.0, (z0 + z1) * 0.5))
    bm_box(bm, M(1.8), M(4.4), z1 - z0,
           (M(PAWL_TIP_X - 0.9), 0.0, (z0 + z1) * 0.5))
    # хвост под пружину + вертикальное ребро (пружина толкает по X)
    bm_box(bm, M(hub_l_edge - PAWL_TAIL_X0 + 0.4), M(5.0), z1 - z0,
           (M((hub_l_edge + PAWL_TAIL_X0) * 0.5), 0.0, (z0 + z1) * 0.5))
    bm_box(bm, M(2.8), M(5.0), M(PAWL_FIN_Z1 - PAWL_Z0),
           (M(PAWL_TAIL_X0 + 1.4), 0.0, M((PAWL_Z0 + PAWL_FIN_Z1) * 0.5)))
    ob = finish(PREFIX + 'pawl', bm, [MATERIALS['steel']], root)
    ob['cj_role'] = ('spring pawl on the D6 axle, nose at r %.1f (%.1f mm into the D10 '
                     'pin groove), tail pressed by the coil spring'
                     % (PAWL_R_TIP, PIN_D * 0.5 - PAWL_R_TIP))
    return ob


def build_axle(root):
    prof = [(0.0, 41.2), (AXLE_D * 0.5, 41.2), (AXLE_D * 0.5, 42.4),
            (4.5, 42.4), (4.5, 42.8), (AXLE_D * 0.5, 42.8),
            (AXLE_D * 0.5, 46.9), (4.2, 46.9), (4.2, 47.4), (AXLE_D * 0.5, 47.4),
            (AXLE_D * 0.5, 49.6), (2.6, 49.9), (0.0, 49.9)]
    bm = bmesh.new()
    bm_lathe(bm, [(r * MM, z * MM) for (r, z) in prof], segs=28,
             offset=(M(AXLE_X), M(AXLE_Y), 0.0))
    ob = finish(PREFIX + 'pawl_axle', bm, [MATERIALS['steel']], root)
    ob['cj_role'] = ('D6 shouldered axle: pawl seat + lever hub seat, socketed in the '
                     'graphite cheek')
    return ob


def build_spring(root):
    bm = bmesh.new()
    bm_helix(bm, M(SPRING_X0), M(SPRING_X1), M(AXLE_Y), M(SPRING_Z),
             M(SPRING_MEAN_R), M(SPRING_WIRE), SPRING_COILS)
    ob = finish(PREFIX + 'pawl_spring', bm, [MATERIALS['steel']], root)
    ob['cj_role'] = ('compression spring 4.8 x 0.5 x %d coils behind the pawl tail '
                     '(axial, along X)' % SPRING_COILS)
    return ob


def build_lever(root):
    bm = bmesh.new()
    z0, z1 = M(LEVER_Z0), M(LEVER_Z1)
    bm_cyl(bm, M(6.0), z0, z1, M(AXLE_X), M(AXLE_Y), n=32)
    bm_box(bm, M(LEVER_PAD_X1 - AXLE_X), M(12.0), z1 - z0,
           (M((AXLE_X + LEVER_PAD_X1) * 0.5), 0.0, (z0 + z1) * 0.5))
    bm_box(bm, M(LEVER_PAD_X1 - LEVER_PAD_X0), M(LEVER_PAD_HALF_Y * 2.0), z1 - z0,
           (M((LEVER_PAD_X0 + LEVER_PAD_X1) * 0.5), 0.0, (z0 + z1) * 0.5))
    ob = finish(PREFIX + 'release_lever', bm, [MATERIALS['pink']], root)
    boolean_cut(ob, cyl_cutter('c_finger', M(LEVER_HOLE_D) * 0.5,
                               M(LEVER_Z0 - 1.0), M(LEVER_Z1 + 1.0),
                               center=(M(-33.0), 0.0), n=28), strict=False)
    ob['cj_role'] = ('release lever (muted pink) keyed to the pawl axle, exits through '
                     'the back-wall slot, 25 deg throw, D8 finger hole in the pad')
    return ob


def build_dowels(root):
    out = []
    for tag, z in (('lower', DOWEL_Z_LOW), ('upper', DOWEL_Z_UP)):
        bm = bmesh.new()
        ring0, ring1 = [], []
        n = 20
        for i in range(n):
            a = 2.0 * math.pi * i / n
            ring0.append(bm.verts.new((M(DOWEL_X0), M(DOWEL_D) * 0.5 * math.cos(a),
                                       M(z) + M(DOWEL_D) * 0.5 * math.sin(a))))
            ring1.append(bm.verts.new((M(DOWEL_X1), M(DOWEL_D) * 0.5 * math.cos(a),
                                       M(z) + M(DOWEL_D) * 0.5 * math.sin(a))))
        bm.faces.new(ring0)
        bm.faces.new(ring1[::-1])
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
        ob = finish(PREFIX + 'dowel_' + tag, bm, [MATERIALS['steel']], root)
        ob['cj_role'] = 'D5 dowel retaining the %s graphite cheek in the housing' % tag
        out.append(ob)
    return out


# --- сборка --------------------------------------------------------------
def obj_mesh_objs(root):
    return [o for o in bpy.data.objects
            if o.type == 'MESH' and o.name.startswith(PREFIX)]


def build():
    reset_scene()
    build_materials()
    root = bpy.data.objects.new(CID, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.05
    bpy.context.scene.collection.objects.link(root)

    parts = {}
    parts['plate'] = build_plate(root)
    parts['body'] = build_body(root)
    parts['cheek_lower'] = build_cheek('lower', CHEEK_LOW_Z0, CHEEK_LOW_Z1, True, root)
    parts['cheek_upper'] = build_cheek('upper', CHEEK_UP_Z0, CHEEK_UP_Z1, False, root)
    parts['pin'] = build_pin(root)
    parts['pawl'] = build_pawl(root)
    parts['axle'] = build_axle(root)
    parts['spring'] = build_spring(root)
    parts['lever'] = build_lever(root)
    for ob in build_dowels(root):
        parts[ob.name.split('__')[-1]] = ob

    meshes = obj_mesh_objs(root)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for ob in obj_mesh_objs(root):
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


def measure_plate(plate):
    holes = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = M(sx * BOLT_GRID), M(sy * BOLT_GRID)

            def open_at(x, y, z=M(1.0)):
                return ray(plate, (x, y, z), (0, 0, 1), M(12.0)) is None

            through = (open_at(cx, cy)
                       and ray(plate, (cx, cy, M(PLATE_T - 1.0)), (0, 0, -1), M(12.0)) is None)
            dia = cb = None
            # Ø9 меряем вверх от z=6 (свободный выход в карман), цековку Ø15 —
            # вниз от z=1,5 (свободный выход через нижнюю плоскость)
            def open_up(x, y, z):
                return ray(plate, (x, y, z), (0, 0, 1), M(12.0)) is None

            def open_dn(x, y, z):
                return ray(plate, (x, y, z), (0, 0, -1), M(12.0)) is None

            if open_up(cx, cy, M(6.0)):
                ex = bisect(lambda o: open_up(cx + o, cy, M(6.0)), 0.0, M(6.0))
                ey = bisect(lambda o: open_up(cx, cy + o, M(6.0)), 0.0, M(6.0))
                dia = [round(ex * 2000, 2), round(ey * 2000, 2)]
            if open_dn(cx, cy, M(1.5)):
                ex = bisect(lambda o: open_dn(cx + o, cy, M(1.5)), 0.0, M(9.0))
                ey = bisect(lambda o: open_dn(cx, cy + o, M(1.5)), 0.0, M(9.0))
                cb = [round(ex * 2000, 2), round(ey * 2000, 2)]
            holes.append({'id': 'M8_%s%s' % ('plus' if sx > 0 else 'minus',
                                             'plus' if sy > 0 else 'minus'),
                          'grid_mm': [sx * BOLT_GRID, sy * BOLT_GRID],
                          'center_m': [round(cx, 5), round(cy, 5), round(M(PLATE_T), 5)],
                          'through': through, 'dia_mm': dia,
                          'counterbore_mm': cb})

    def open_c(x, y, z):
        return ray(plate, (x, y, z), (0, 0, 1), M(12.0)) is None

    pin_open = open_c(0.0, 0.0, M(1.0))
    pin_dia = None
    if pin_open:
        ex = bisect(lambda o: open_c(o, 0.0, M(1.0)), 0.0, M(5.0))
        ey = bisect(lambda o: open_c(0.0, o, M(1.0)), 0.0, M(5.0))
        pin_dia = [round(ex * 2000, 2), round(ey * 2000, 2)]

    coords = sorted({tuple(h['grid_mm']) for h in holes})
    ok = (len(coords) == 4 and all(h['through'] for h in holes)
          and all(h['dia_mm'] and abs(h['dia_mm'][0] - M8_D) <= 0.25
                  and abs(h['dia_mm'][1] - M8_D) <= 0.25 for h in holes)
          and all(h['counterbore_mm'] and abs(h['counterbore_mm'][0] - M8_CB_D) <= 0.35
                  for h in holes)
          and pin_open and pin_dia and abs(pin_dia[0] - PIN_BORE_D) <= 0.25
          and abs(pin_dia[1] - PIN_BORE_D) <= 0.25)
    return {'plate_mm': [PLATE_X, PLATE_Y, PLATE_T],
            'z_range_mm': [0.0, PLATE_T], 'grid_mm': BOLT_GRID,
            'holes': holes, 'coords_distinct': len(coords),
            'pin_bore': {'center_m': [0.0, 0.0, round(M(PLATE_T), 5)],
                         'dia_mm': PIN_BORE_D, 'measured_dia_mm': pin_dia,
                         'depth_mm': PLATE_T, 'role': 'D6 dowel bore (female)'},
            'ok': ok}


def measure_window(body, plate, cheeks):
    w = []
    for d in (1.0, -1.0):
        p = ray(body, (0.0, 0.0, M(25.0)), (0.0, d, 0.0), M(40.0))
        w.append(abs(p.y) * 1000 if p is not None else None)
    top = ray(body, (0.0, M(15.0), M(25.0)), (0.0, 0.0, 1.0), M(25.0))
    bot = ray(plate, (0.0, M(15.0), M(25.0)), (0.0, 0.0, -1.0), M(30.0))
    width = (w[0] + w[1]) if all(v is not None for v in w) else None
    height = (top.z * 1000 - bot.z * 1000) if (top and bot) else None

    # зев между щеками + фаска входа
    def throat_at(x_mm, y_mm=0.0):
        lo = ray(cheeks[0], (M(x_mm), M(y_mm), M(15.0)), (0, 0, 1), M(20.0))
        hi = ray(cheeks[1], (M(x_mm), M(y_mm), M(38.0)), (0, 0, -1), M(20.0))
        if lo is None or hi is None:
            return None
        return round((hi.z - lo.z) * 1000, 3), round(lo.z * 1000, 3), round(hi.z * 1000, 3)

    samples = [throat_at(x, y) for x in (36.0, 30.0, 10.0, -8.0)
               for y in (-20.0, 0.0, 20.0)]
    ok_s = [s for s in samples if s]
    throat = round(sum(s[0] for s in ok_s) / len(ok_s), 3) if ok_s else None
    deep = [s[0] for s in ok_s if s[0] is not None]
    mouth_h = throat_at(39.0)[0] if throat_at(39.0) else None
    z_floor = round(min(s[1] for s in ok_s), 2) if ok_s else None
    z_ceil = round(max(s[2] for s in ok_s), 2) if ok_s else None

    ok = (width is not None and abs(width - WIN_W) <= 0.25
          and height is not None and abs(height - WIN_H) <= 0.25
          and throat is not None and abs(throat - THROAT) <= 0.12
          and mouth_h is not None and 2.0 <= mouth_h - THROAT <= 5.0)
    return {'window_mm': [WIN_W, WIN_H], 'measured_width_mm': round(width, 3) if width else None,
            'measured_height_mm': round(height, 3) if height else None,
            'mouth_plane_x_mm': BODY_X1,
            'pocket_depth_mm': BODY_X1 - POCKET_X0,
            'side_wall_mm': (PLATE_Y - WIN_W) * 0.5,
            'top_wall_mm': BODY_Z1 - WIN_Z1,
            'throat_mm': THROAT, 'measured_throat_mm': throat,
            'throat_z_mm': [z_floor, z_ceil],
            'throat_samples_mm': deep,
            'mouth_throat_mm': mouth_h,
            'entry_chamfer_mm': round(mouth_h - THROAT, 3) if mouth_h else None,
            'cassette': [c.name for c in cheeks],
            'ok': ok}


def measure_pin(pin, cheeks, body):
    def rad(direction, origin=(M(PIN_X), M(PIN_Y), M(25.0))):
        p = ray(pin, origin, direction, M(30.0))
        return abs((p - Vector(origin)).dot(Vector(direction).normalized())) * 1000 \
            if p is not None else None

    dia_x = [rad((1, 0, 0)), rad((-1, 0, 0))]
    dia_y = [rad((0, 1, 0)), rad((0, -1, 0))]
    groove = [rad((1, 0, 0), (M(PIN_X), M(PIN_Y), M(43.5))),
              rad((-1, 0, 0), (M(PIN_X), M(PIN_Y), M(43.5)))]
    bore = [rad((1, 0, 0), (M(PIN_X), M(PIN_Y), M(35.0))) ]
    # диаметр гнезда в графитовой щеке
    bore_hit = ray(cheeks[1], (M(PIN_X), M(PIN_Y), M(35.0)), (1, 0, 0), M(30.0))
    bore_d = abs(bore_hit.x - M(PIN_X)) * 2000 if bore_hit is not None else None
    mn, mx = bbox_of([pin])
    ok = (dia_x[0] and dia_x[1] and abs(dia_x[0] + dia_x[1] - PIN_D) <= 0.12
          and dia_y[0] and dia_y[1] and abs(dia_y[0] + dia_y[1] - PIN_D) <= 0.12
          and groove[0] and abs(groove[0] + groove[1] - PIN_GROOVE_D) <= 0.15
          and abs((mx.z - mn.z) * 1000 - (PIN_HEAD_Z1 - PIN_Z0)) <= 0.2)
    return {'node': pin.name, 'dia_mm': PIN_D, 'h8': True,
            'measured_dia_mm': [round(dia_x[0] + dia_x[1], 3), round(dia_y[0] + dia_y[1], 3)],
            'axis_depth_mm': PIN_DEPTH, 'axis': [0.0, 0.0, 1.0],
            'center_m': [round(M(PIN_X), 5), round(M(PIN_Y), 5)],
            'z_range_mm': [round(mn.z * 1000, 2), round(mx.z * 1000, 2)],
            'length_mm': round((mx.z - mn.z) * 1000, 2),
            'groove': {'dia_mm': PIN_GROOVE_D,
                       'measured_dia_mm': round(groove[0] + groove[1], 3)
                       if groove[0] else None,
                       'z_mm': [PIN_GROOVE_Z0, PIN_GROOVE_Z1]},
            'socket_bore': {'dia_mm': PIN_BORE, 'measured_dia_mm': round(bore_d, 3)
                            if bore_d else None,
                            'clearance_mm': round((PIN_BORE - PIN_D) * 0.5, 3)},
            'head': {'dia_mm': PIN_HEAD_D, 'z_mm': [PIN_HEAD_Z0, PIN_HEAD_Z1]},
            'insertion': 'drop-in from the top cavity, after the tongue is seated',
            'ok': bool(ok)}


def measure_pawl(pawl, pin, spring, lever, body, plate, cheeks):
    pmn, pmx = bbox_of([pawl])
    smn, smx = bbox_of([spring])
    lmn, lmx = bbox_of([lever])
    # радиальный заход носа в проточку: от поверхности Ø12 до кромки носка
    engage = PIN_D * 0.5 - PAWL_R_TIP
    # зазор пружины до стенки полости и до хвоста собачки
    wall = ray(body, (M(POCKET_X0), 0.0, M(SPRING_Z)), (-1, 0, 0), M(20.0))
    wall_gap = round((smn.x - wall.x) * 1000, 2) if wall is not None else None
    tail_gap = round((M(PAWL_TAIL_X0) - smx.x) * 1000, 2)
    # свободное место под накладкой рычага
    under = ray(plate, (M(-33.0), 0.0, M(LEVER_Z0 - 0.4)), (0, 0, -1), M(60.0))
    under_mm = round((M(LEVER_Z0) - under.z) * 1000, 2) if under is not None else None
    # ход носка при повороте рычага на 25°
    tip = Vector((M(PAWL_TIP_X), 0.0))
    piv = Vector((M(AXLE_X), 0.0))
    rot = Matrix.Rotation(math.radians(-25.0), 2)
    tip_open = piv + (rot @ (tip - piv))
    r_open = (tip_open - Vector((M(PIN_X), 0.0))).length * 1000
    r_closed = (tip - Vector((M(PIN_X), 0.0))).length * 1000
    ok = (abs(engage - 1.2) <= 0.25
          and abs(pmn.z * 1000 - PAWL_Z0) <= 0.1 and abs(pmx.z * 1000 - PAWL_FIN_Z1) <= 0.15
          and wall_gap is not None and 0.0 <= wall_gap <= 0.6
          and abs(tail_gap) <= 0.6
          and under_mm is not None and under_mm >= 20.0
          and r_open > PIN_GROOVE_D * 0.5 + 0.40)
    return {'node': pawl.name,
            'type': 'spring-loaded pawl on a vertical D6 axle, nose into the pin groove',
            'engagement_radial_mm': round(engage, 2),
            'nose_tip_r_mm': round(r_closed, 2), 'groove_r_mm': PIN_GROOVE_D * 0.5,
            'nose_z_mm': [PAWL_Z0, PAWL_Z1], 'groove_z_mm': [PIN_GROOVE_Z0, PIN_GROOVE_Z1],
            'pawl_bbox_mm': {'min': [round(v * 1000, 2) for v in pmn],
                             'max': [round(v * 1000, 2) for v in pmx]},
            'spring': {'node': spring.name, 'coils': SPRING_COILS,
                       'wire_mm': round(SPRING_WIRE * 2, 2),
                       'mean_dia_mm': round(SPRING_MEAN_R * 2, 2),
                       'x_mm': [SPRING_X0, SPRING_X1], 'z_mm': SPRING_Z,
                       'wall_gap_mm': wall_gap, 'tail_gap_mm': tail_gap,
                       'preload_mm_est': 0.4},
            'lever': {'node': lever.name,
                      'throw_deg': 25.0,
                      'tip_r_closed_mm': round(r_closed, 2),
                      'tip_r_open_mm': round(r_open, 2),
                      'clears_groove_r_mm': round(PIN_GROOVE_D * 0.5 + 0.4, 2),
                      'pad_mm': [LEVER_PAD_X1 - LEVER_PAD_X0, LEVER_PAD_HALF_Y * 2,
                                 LEVER_Z1 - LEVER_Z0],
                      'pad_bbox_mm': {'min': [round(v * 1000, 2) for v in lmn],
                                      'max': [round(v * 1000, 2) for v in lmx]},
                      'free_under_pad_mm': under_mm,
                      'overhang_mm': round(abs(lmn.x * 1000 - BODY_X0), 2),
                      'accessible_from': 'behind the housing, above the plate deck'},
            'ok': bool(ok)}


def measure_entry(parts, cheeks):
    """Свободный коридор входа языка + первая преграда (палец) по глубине."""
    ys = (-13.0, -8.0, 0.0, 8.0, 13.0)
    zs = (22.4, 23.5, 24.6, 25.7, 26.8, 27.6)
    blocked = []
    for y in ys:
        for z in zs:
            for ob in (parts['pin'], cheeks[0], cheeks[1], parts['body']):
                p = ray(ob, (M(39.5), M(y), M(z)), (-1, 0, 0), M(TRAVEL))
                if p is not None:
                    blocked.append({'y_mm': y, 'z_mm': z, 'on': ob.name,
                                    'depth_mm': round((M(39.5) - p.x) * 1000, 2)})
    first = None
    for ob in (parts['pin'], cheeks[0], cheeks[1]):
        p = ray(ob, (M(39.5), 0.0, M(25.0)), (-1, 0, 0), M(60.0))
        if p is not None:
            d = round((M(39.5) - p.x) * 1000, 2)
            first = d if first is None else min(first, d)
    tongues = []
    for t in TONGUES:
        nose_depth = PIN_DEPTH + t['hole_from_nose']
        tongues.append({'id': t['id'], 'width_mm': t['w'], 'thickness_mm': t['t'],
                        'length_mm': t['l'],
                        'hole_depth_needed_mm': round(nose_depth, 1),
                        'fits_throat_depth_mm': BODY_X1 - POCKET_X0,
                        'fits': nose_depth <= (BODY_X1 - POCKET_X0) - 0.5,
                        'width_fits_window': t['w'] <= WIN_W - 0.5 and t['t'] <= THROAT - 0.3})
    return {'window_mm': [WIN_W, WIN_H], 'throat_mm': THROAT,
            'travel_mm': TRAVEL,
            'corridor_clear': not blocked,
            'blocked_samples': blocked[:6],
            'corridor_samples': len(ys) * len(zs),
            'first_obstruction_depth_mm': first,
            'free_before_pin_mm': round(first - TRAVEL, 2) if first else None,
            'tongues': tongues,
            'ok': (not blocked and first is not None and first >= TRAVEL
                   and all(t['fits'] and t['width_fits_window'] for t in tongues))}


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
            for k in ('graphite', 'steel', 'pink', 'ivory'):
                if mat.name.endswith(k):
                    key = k
                    break
            break
        vol_by_key[key] = vol_by_key.get(key, 0.0) + st['volume_cm3']

    mass = sum(v * 1e-6 * DENSITY.get(k, 2700.0) for k, v in vol_by_key.items())
    mats = sorted({m.name for ob in meshes for m in ob.data.materials if m})

    plate = measure_plate(parts['plate'])
    win = measure_window(parts['body'], parts['plate'],
                         [parts['cheek_lower'], parts['cheek_upper']])
    pin = measure_pin(parts['pin'],
                      [parts['cheek_lower'], parts['cheek_upper']], parts['body'])
    pawl = measure_pawl(parts['pawl'], parts['pin'], parts['spring'], parts['lever'],
                        parts['body'], parts['plate'],
                        [parts['cheek_lower'], parts['cheek_upper']])
    entry = measure_entry(parts, [parts['cheek_lower'], parts['cheek_upper']])

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
        'bbox_size_m': [round(v, 5) for v in size],
        'bbox_ok': (abs(size.x - M(PLATE_X)) <= 0.0008 and abs(size.y - M(PLATE_Y)) <= 0.0008
                    and abs(size.z - M(BODY_Z1)) <= 0.0008 and abs(mn.z) <= 0.0008
                    and abs(mn.x + M(PLATE_X * 0.5)) <= 0.0008
                    and abs(mx.x - M(PLATE_X * 0.5)) <= 0.0008),
        'mass_kg_est': round(mass, 3),
        'plate': plate,
        'plate_pattern_ok': plate['ok'],
        'receiver': win,
        'receiver_window_ok': win['ok'],
        'pin': pin,
        'pin_ok': pin['ok'],
        'pawl': pawl,
        'pawl_ok': pawl['ok'],
        'entry': entry,
        'entry_corridor_ok': entry['ok'],
        'volume_by_material_cm3': {k: round(v, 3) for k, v in vol_by_key.items()},
        'negative_scale': [ob.name for ob in meshes if ob.matrix_world.determinant() < 1e-9],
        'no_negative_scale': all(ob.matrix_world.determinant() > 1e-9 for ob in meshes),
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'state': 'closed (pin in, pawl in the groove, lever at rest)',
        'animation': 'none (no actions; the 25 deg release stroke is described only)',
        'animation_ok': len(bpy.data.actions) == 0,
        'dof': {'pawl_travel_deg': 25.0, 'pin_drop_mm': round(PIN_HEAD_Z1 - PIN_Z0, 1),
                'note': 'static module: latch closed; release = lever 25 deg + pin out'},
        'dof_ok': True,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))
    return checks, dict(mn=mn, mx=mx, size=size, mass=mass, mats=mats, verts=verts,
                        tris=tris, per_obj=per_obj, plate=plate, win=win, pin=pin,
                        pawl=pawl, entry=entry, vol=vol_by_key)


# --- report --------------------------------------------------------------
def build_report(root, checks, m):
    interfaces = {
        'rail_plate': {
            'role': 'bolts down onto fix_carriage top_plate / fix_corner_node 4xM8 + D6 pattern',
            'plane': 'XY at z=0 (mounting face, normal -Z); plate top at z=8 mm',
            'plate_mm': [PLATE_X, PLATE_Y, PLATE_T],
            'grid_mm': BOLT_GRID,
            'bolt_count': 4,
            'm8': [{'id': h['id'], 'grid_mm': h['grid_mm'], 'center_m': h['center_m'],
                    'dia_mm': M8_D, 'measured_dia_mm': h['dia_mm'],
                    'counterbore_mm': [M8_CB_D, M8_CB_T],
                    'measured_counterbore_mm': h['counterbore_mm'],
                    'through': h['through']} for h in m['plate']['holes']],
            'coords_distinct': m['plate']['coords_distinct'],
            'pin': m['plate']['pin_bore'],
            'compatibility': ('same 4x D9 on +-15 mm + centre D6.1 bore as the '
                              'fix_carriage top deck (D6 dowel) and fix_corner_node pads'),
        },
        'latch_receiver': {
            'standard': 'CJ-LATCH-30',
            'kind': 'clevis receiver: 48x34 window, 6.4 throat, D12 h8 drop pin, '
                    'spring pawl in the pin groove, release lever',
            'mouth_plane_mm': BODY_X1, 'insert_axis': [1.0, 0.0, 0.0],
            'window_mm': [WIN_W, WIN_H],
            'measured_window_mm': [m['win']['measured_width_mm'],
                                   m['win']['measured_height_mm']],
            'window_depth_mm': m['win']['pocket_depth_mm'],
            'window_frame_mm': {'side_wall': m['win']['side_wall_mm'],
                                'top_wall': m['win']['top_wall_mm'],
                                'bottom': 'plate top surface (z=8)'},
            'throat_mm': THROAT,
            'measured_throat_mm': m['win']['measured_throat_mm'],
            'throat_z_mm': m['win']['throat_z_mm'],
            'throat_depth_mm': m['win']['pocket_depth_mm'],
            'cassette': {'material': 'CJ_latch_receiver_graphite',
                         'cheeks': m['win']['cassette'],
                         'cheek_thickness_mm': CHEEK_T,
                         'retention': '2 x D5 dowels from the back wall'},
            'pin': m['pin'],
            'pawl': m['pawl'],
            'tongue_entry': {
                'chamfer': {'size_mm': CHAMFER, 'angle_deg': 45.0,
                            'measured_flare_mm': m['win']['entry_chamfer_mm'],
                            'at': 'both graphite cheeks, mouth side'},
                'clear_corridor_mm': m['entry']['first_obstruction_depth_mm'],
                'travel_mm': TRAVEL,
                'pin_behind_mouth_mm': PIN_DEPTH,
                'samples': m['entry']['corridor_samples'],
                'blocked_samples': m['entry']['blocked_samples'],
                'tongues': m['entry']['tongues'],
                'note': ('палец стоит на 36 мм от устья: 26-мм ход языка проходит без '
                         'касания, палец заводится сверху после посадки языка'),
            },
            'antirot': {'bores': 2, 'dia_mm': ANTIROT_D, 'spacing_mm': ANTIROT_SPACING,
                        'center_x_mm': ANTIROT_X,
                        'depth_mm': ANTIROT_DEPTH, 'in': 'lower graphite cheek'},
            'state_modelled': 'closed / latched',
            'unlatch': ('рычаг 25° -> нос собачки уходит из проточки (r %.2f -> %.2f мм), '
                        'палец поднимается из гнезда'
                        % (m['pawl']['lever']['tip_r_closed_mm'],
                           m['pawl']['lever']['tip_r_open_mm'])),
            'wll_n': 5000,
        },
    }
    return {
        'id': CID,
        'code': 'CJ-LATCH-ADAPTER',
        'name': 'Переходник защёлки rail -> CJ-LATCH-30',
        'kit': 'CJ-FIX-KIT',
        'class': 'INTERFACE / adapter',
        'standard_in': 'CJ-RAIL-45 (top plate pattern)',
        'standard_out': 'CJ-LATCH-30',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_latch_adapter.py',
        'units': 'm',
        'spec': {
            'overall_mm': [PLATE_X, PLATE_Y, BODY_Z1],
            'plate_mm': [PLATE_X, PLATE_Y, PLATE_T],
            'housing_mm': [BODY_X1 - BODY_X0, BODY_Y, BODY_Z1 - BODY_Z0],
            'window_mm': [WIN_W, WIN_H],
            'throat_mm': THROAT,
            'pin_mm': [PIN_D, PIN_DEPTH],
            'pawl': 'pawl on D6 axle + compression spring, nose 1.2 mm in the groove',
            'lever': 'release lever 25 deg, pad 10x16 with D8 finger hole',
            'tongues': [t['id'] for t in TONGUES],
            'mass_kg_spec': 0.7,
            'material': 'Al housing / graphite cheeks / 14Kh17N2 pin / pink lever',
            'wll_n': 5000,
        },
        'bbox_m': {'min': [round(v, 5) for v in m['mn']],
                   'max': [round(v, 5) for v in m['mx']],
                   'size': [round(v, 5) for v in m['size']],
                   'nominal': [round(M(PLATE_X), 5), round(M(PLATE_Y), 5), round(M(BODY_Z1), 5)],
                   'nominal_mm': [PLATE_X, PLATE_Y, BODY_Z1],
                   'target_mm': [PLATE_X, PLATE_Y, BODY_Z1],
                   'envelope_mm': {
                       'x': PLATE_X, 'y': PLATE_Y, 'z': BODY_Z1,
                       'z_breakdown_mm': {'plate': PLATE_T,
                                          'window': WIN_H,
                                          'top_block': BODY_Z1 - TOP_BLOCK_Z0},
                       'top_block_contents': 'палец Ø12 (проточка Ø10 + головка Ø16), '
                                             'полость собачки, ступица рычага',
                       'note': ('Габарит 80 x 60 x 50 — это корпус целиком: 8 плита + '
                                '34 окно + 8 верхний блок. 50 мм — не высота головки '
                                'пальца (головка кончается на Z=47).'),
                   },
                   'ok': checks['bbox_ok']},
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
            'Габарит 80 x 60 x 50 мм: плита 80 x 60 x 8, корпус 66 x 60 x 42 с окном '
            '48 x 34 и верхний блок 8 мм (полость пальца Ø12 / собачки / ступицы '
            'рычага) — 8 + 34 + 8 = 50 по Z.',
            'Окно 48x34 — реальная геометрия: рамка корпуса (боковины 6 мм, верхний '
            'блок 8 мм, плита снизу) образует проём, измеренный лучами по внутренним '
            'граням 48,0 x 34,0 мм.',
            'В проёме стоит графитовая кассета: две щеки 13,8 мм с зевом 6,4 мм '
            '(21,8…28,2). Зев, фаска входа 2,5x45° и гнёзда под штифты языка — '
            'резаная геометрия, а не текстура.',
            'Палец Ø12 h8 — закладной сверху: ось 36 мм от устья, проходит верхнюю '
            'щеку, зев и гнездо нижней; проточка Ø10 под собачку, головка Ø16 в '
            'верхней полости (в неё упирается при подъёме).',
            'Собачка на вертикальной оси Ø6 входит носом в проточку на 1,2 мм по '
            'радиусу; пружина сжатия 4,8x0,5 (5 витков) стоит между задней стенкой '
            'полости и хвостом собачки, поджатие ~0,4 мм.',
            'Рычаг (pink) на той же оси выходит через паз задней стенки на заднюю '
            'площадку плиты: накладка 10x16 с отверстием Ø8, свободное место под '
            'накладкой %s мм. Ход 25° уводит нос собачки из проточки.'
            % m['pawl']['lever']['free_under_pad_mm'],
            'Масса по фактическим объёмам: %s кг (алюминий + графит + сталь) — '
            'спецификация набора 0,7 кг.' % round(m['mass'], 2),
        ],
        'deviations': [
            'Габарит зафиксирован: 80 x 60 x 50 мм (мин [-0.04,-0.03,0] — макс '
            '[0.04,0.03,0.05] м). Разбивка по Z: плита 8 + окно 34 + верхний блок '
            '8 = 50. Верхний блок — не головка пальца (головка Ø16 кончается на '
            'Z=47 и утоплена на 3 мм), а полость механизма: палец Ø12 с проточкой '
            'Ø10, собачка с осью Ø6 и ступица рычага. Ориентир Z=40 отклонён: при '
            'окне 34 мм на две щеки под палец Ø12 и ось Ø6 остаётся 6 мм — '
            'геометрически невозможно. X/Y совпадают с ориентиром 80 x 60.',
            'Окно 48x34 заполнено графитовой кассетой заподлицо (зазор 0,2 мм по '
            'глубине): проём меряется по внутренним граням рамки корпуса, а не по '
            'свободному воздуху — так же устроен приёмник CJ-LATCH-30 (язык входит '
            'в зев между щеками).',
            'Крепёж M8 не моделировался: Ø9 + цековка Ø15x4 снизу под шайбу; при '
            'плите 8 мм головка DIN 7991 встаёт заподлицо только с цековкой 4,4 мм, '
            'поэтому в каретке нужны резьбовые вставки M8 (в fix_carriage плита '
            '4,75 мм — там та же оговорка).',
            'Палец — закладной (drop-in) сверху, а не подпружиненный: закрытое '
            'состояние показано с пальцем в гнезде; на время заведения языка палец '
            'вынут. Это совпадает с принятой реализацией CJ-LATCH-30 в '
            'restraint_quick_release_hard (палец + проточка + собачка + рычаг).',
            'Рычаг в габарите плиты (накладка до x=-38), но выходит за корпус на '
            '14 мм — иначе его не взять рукой; сверху он не выступает ( z 47,4…49,8 '
            'при верхе корпуса 50).',
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
            ('key', (0.16, 0.22, 0.32), 4.6, 0.16),
            ('fill', (-0.24, 0.20, 0.16), 1.6, 0.24),
            ('rim', (-0.30, -0.16, 0.20), 2.6, 0.16),
            ('top', (0.02, 0.04, 0.40), 1.3, 0.22)):
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

    def fit_dist(target, direction, lens, corners, margin=1.12):
        """Дистанция, при которой все углы рамки попадают в кадр.

        Смещения считаются ОТ ЦЕНТРА РАМКИ: абсолютные координаты давали
        дистанцию порядка расстояния от начала координат (камера внутри детали).
        """
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

    def max_ndc(region=None):
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

    def region_box(lo_mm, hi_mm):
        lo = Vector([M(v) for v in lo_mm])
        hi = Vector([M(v) for v in hi_mm])
        return lo, hi, box_corners(lo, hi), (lo + hi) * 0.5

    # рамка общая (плита 80x60 + корпус 50 по Z) и окно closeup
    main_box = region_box((-PLATE_X * 0.5, -PLATE_Y * 0.5, 0.0), (PLATE_X * 0.5, PLATE_Y * 0.5, BODY_Z1))
    # closeup: окно 48x34 (x=40) + палец (x=4) + полость собачки/рычага
    close_box = region_box((-16.0, -24.0, 6.0), (42.0, 24.0, 50.0))

    # tag, direction, box, lens, margin
    views = [
        ('3q', (0.72, 0.55, 0.42), main_box, 62, 1.125),
        ('front', (0.99, 0.04, 0.16), main_box, 100, 1.130),
        ('side', (0.04, 0.99, 0.13), main_box, 100, 1.115),
        ('closeup', (0.74, 0.28, 0.61), close_box, 66, 1.115),
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
                     'px': [896, 896], 'fill': round(max_ndc(1.0, (lo, hi)), 3),
                     'lens_mm': lens, 'dist_mm': round(dist * 1000, 1),
                     'target_mm': [round(v * 1000, 1) for v in target],
                     'frame_mm': [[round(v * 1000, 1) for v in lo],
                                  [round(v * 1000, 1) for v in hi]]})
        log('RENDERED', tag, fp, 'dist %.0f mm' % (dist * 1000))
    return outs


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    root, parts = build()
    log('nodes:', len(obj_mesh_objs(root)))
    checks, m = check(parts, root)
    log('bbox', checks['bbox_size_m'], '| mass', checks['mass_kg_est'],
        '| window', m['win']['measured_width_mm'], 'x', m['win']['measured_height_mm'],
        '| throat', m['win']['measured_throat_mm'],
        '| pin', m['pin']['measured_dia_mm'], 'depth', m['pin']['axis_depth_mm'],
        '| corridor', m['entry']['first_obstruction_depth_mm'],
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
    root['cj_standard'] = 'CJ-LATCH-30'
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
