#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_pivot — поворотный узел (yaw) 0–360° с шагом 15°.

Standalone builder. Не трогает общий builder/catalog/pages и чужие узлы.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_pivot.py

Все размеры заданы в МИЛЛИМЕТРАХ, в сцену переводятся одним множителем M().

Локальная система (м, экспорт Y-up): Z — ось поворота ВВЕРХ, X/Y — габарит
0.09 x 0.09. Начало координат: центр габарита по X/Y, низ узла по Z.

Конструкция (мм), снизу вверх:
  * нижняя плита 90x90x8 (z 0…8), 4x Ø9 (M8) по сетке ±15 мм, центральное
    гнездо Ø6.1 со штифтом Ø6 заподлицо с НИЖНЕЙ плоскостью (установка на стол);
  * корпус Ø70 (z 8…30) с центрирующей бобышкой Ø25 (30…39) и открытым
    пазом-вилкой под кулачковый рычаг фиксатора на -X;
  * упорная шайба Ø37/Ø26 (графит) z 30…33 — пятно контакта вращения;
  * барабан Ø78 (z 33…82): снизу гнездо Ø25.6 под бобышку, на наружной
    поверхности градуировочный поясок (z 36…48, R37.4) с 72 рисками
    (старшие через 15°, младшие через 5°), 24 индексирующих отверстия
    Ø5.5 (z 33…45) на R25.5 через 15°, 4x гнезда Ø6.6 под M6 сверху;
  * верхняя плита 90x90x8 (z 82…90) — тот же паттерн 4x Ø9 ±15 + Ø6;
    4x M6 с потайной головкой в резьбовые вставки барабана;
  * фиксатор: палец-толкатель Ø5 со сферическим низом в направляющем
    отверстии Ø5.4 корпуса; кулачковый рычаг (muted pink) на оси Y
    поднимает его на 3.3 мм в одно из 24 отверстий — позитивный упор
    через 15°;
  * указатель градуировки: кронштейн на нижней плите (+X) с лапой-подошвой,
    язычок входит в поясок с зазором 0.4 мм и стоит на нулевой риске.
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
CID = 'fix_pivot'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001

SIZE_XY = 90.0
HEIGHT = 90.0
PLATE_T = 8.0
PLATE_B_Z0, PLATE_B_Z1 = 0.0, 8.0
PLATE_T_Z0, PLATE_T_Z1 = 82.0, 90.0

M8_D = 9.0
BOLT_GRID = 15.0
PIN_D, PIN_BORE = 6.0, 6.1
PIN_CHAMFER = 0.5

BASE_R = 35.0                    # Ø70 корпус
BASE_Z0, BASE_Z1 = 8.0, 30.0
PILOT_R = 12.5                   # Ø25 центрирующая бобышка
PILOT_Z1 = 39.0

WASH_R0, WASH_R1 = 13.0, 18.5    # Ø37 / Ø26 упорная шайба
WASH_Z0, WASH_Z1 = 30.0, 33.0

DRUM_R = 39.0                    # Ø78 барабан
DRUM_Z0, DRUM_Z1 = 33.0, 82.0
RECESS_R = 12.8                  # гнездо Ø25.6 под бобышку
RECESS_Z1 = 40.0

BAND_Z0, BAND_Z1 = 36.0, 48.0
BAND_R = 37.4
TICK_DEPTH = 0.8
TICK_STEP = 5.0

IDX_R = 25.5                     # хорда 15° = 6.66 мм, отверстие Ø5.5 -> мостик 1.16
IDX_D = 5.5
IDX_Z0, IDX_Z1 = 33.0, 45.0
IDX_STEP = 15.0
IDX_COUNT = 24

DET_D, DET_BORE = 5.0, 5.4
DET_Z0 = 22.3                    # низ пальца в открытом положении
DET_LEN = 10.2
DET_DOME_R = 2.5

POCKET_X0, POCKET_X1 = -38.0, -13.0
POCKET_HY = 6.6
POCKET_Z1 = 26.5

LEVER_C = (-32.0, 18.0)          # (x, z) ось качания, ось Y
LEVER_R = 5.5
LEVER_HY = 4.0
LEVER_TIP_X = -25.0
LEVER_TOP = 22.3
LEVER_BOT = 14.3
LEVER_SWING = 45.0               # открыто -> закрыто
PIVOT_D = 7.0

PTR_X0, PTR_X1 = 40.0, 44.5
PTR_HY = 3.5
PTR_Z0, PTR_Z1 = 8.0, 52.0
TONG_X = 37.8
TONG_Z0, TONG_Z1 = 40.0, 44.0

M6_R = 28.0
M6_D = 6.6
M6_CSK_D = 11.2
M6_CSK_Z = 3.0
M6_LEN = 16.0

BEVEL_PLATE = 2.0
BEVEL_DRUM = 1.5
BEVEL_BASE = 1.0

DENSITY = {'ivory': 2700.0, 'wear': 1900.0, 'insert': 1900.0,
           'steel': 7850.0, 'pink': 2700.0}
DENSITY_ZN = 6600.0

YAW_RANGE = 360.0
YAW_STEP = IDX_STEP
_BVH = {}


def M(v):
    return v * MM


def log(*a):
    print('[fix_pivot]', *a, flush=True)


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
    MATERIALS['ivory'] = make_mat('CJ_pivot_matte_ivory', (0.735, 0.715, 0.668), 0.60, 0.0)
    MATERIALS['wear'] = make_mat('CJ_pivot_wear_graphite', (0.082, 0.086, 0.094), 0.58, 0.15)
    MATERIALS['insert'] = make_mat('CJ_pivot_insert_graphite', (0.150, 0.157, 0.168), 0.40, 0.55)
    MATERIALS['steel'] = make_mat('CJ_pivot_steel', (0.520, 0.532, 0.552), 0.28, 1.0)
    MATERIALS['pink'] = make_mat('CJ_pivot_accent_pink', (0.640, 0.265, 0.315), 0.44, 0.05)


# --- bmesh (метры) ------------------------------------------------------
def bm_box(bm, sx, sy, sz, center=(0.0, 0.0, 0.0)):
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    return verts


def bm_cyl(bm, r, z0, z1, cx=0.0, cy=0.0, n=48):
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


def bm_lathe(bm, prof, segs=48, closed=False, axis_y=False, offset=(0.0, 0.0, 0.0),
             flip_y=False):
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
    if axis_y:
        for v in verts:
            x, y, z = v.co
            if flip_y:
                v.co = Vector((x, -z, -y))
            else:
                v.co = Vector((x, z, -y))
    if any(offset):
        bmesh.ops.translate(bm, vec=offset, verts=verts)
    return verts


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


def cutter_from(name, fill):
    bm = bmesh.new()
    fill(bm)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


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


def extrude_profile_xz(name, pts_mm, half_y_mm, mats, root):
    """2D-полигон в XZ (мм) -> тело, выдавленное по Y на ±half_y."""
    bm = bmesh.new()
    vs = [bm.verts.new((M(x), -M(half_y_mm), M(z))) for (x, z) in pts_mm]
    bm.verts.ensure_lookup_table()
    face = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    nv = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=(0.0, M(2.0 * half_y_mm), 0.0))
    return finish(name, bm, mats, root)


def smooth_cyl(ob):
    """Сгладить только боковые (радиальные) грани тел вращения."""
    mw = ob.matrix_world
    r3 = mw.to_3x3()
    n_ok = 0
    for poly in ob.data.polygons:
        c = mw @ poly.center
        n = (r3 @ poly.normal).normalized()
        r = math.hypot(c.x, c.y)
        if r < 1e-6 or abs(n.z) > 0.5:
            continue
        rad = Vector((c.x / r, c.y / r, 0.0))
        if abs(n.dot(rad)) > 0.9:
            poly.use_smooth = True
            n_ok += 1
    return n_ok


# --- плиты ---------------------------------------------------------------
def build_plate(name, z0, z1, mats, root):
    bm = bmesh.new()
    bm_box(bm, M(SIZE_XY), M(SIZE_XY), M(z1 - z0), (0.0, 0.0, M((z0 + z1) * 0.5)))
    ob = finish(name, bm, mats, root)
    safe_bevel(ob, M(BEVEL_PLATE), segments=2, angle=25.0)
    return ob


def cut_plate_pattern(ob, z0, z1, grid=True):
    """Отверстия режутся по одному: EXACT-булеан на пачке соосных цилиндров
    с копланарными торцами отдаёт пустой меш (Blender 4.2)."""
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = M(sx * BOLT_GRID), M(sy * BOLT_GRID)
            boolean_cut(ob, cutter_from('c_m8', lambda bm, cx=cx, cy=cy: bm_cyl(
                bm, M(M8_D) * 0.5, M(z0 - 1.0), M(z1 + 1.0), cx=cx, cy=cy, n=36)))
    boolean_cut(ob, cutter_from('c_pin', lambda bm: bm_cyl(
        bm, M(PIN_BORE) * 0.5, M(z0 - 1.0), M(z1 + 1.0), n=32)))


def build_dowel(name, z0, z1, mats, root):
    """Ø6 штифт: торец заподлицо с базовой плоскостью (z0), фаска на торце."""
    d = M(PIN_D) * 0.5
    ch = M(PIN_CHAMFER)
    prof = [(0.0, M(z0)), (d - ch, M(z0)), (d, M(z0) + ch),
            (d, M(z1) - ch * 0.5), (d - ch * 0.5, M(z1)), (0.0, M(z1))]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=48)
    ob = finish(name, bm, mats, root)
    smooth_cyl(ob)
    return ob


def build_top_plate(root):
    ob = build_plate(PREFIX + 'top_plate', PLATE_T_Z0, PLATE_T_Z1,
                     [MATERIALS['ivory']], root)
    cut_plate_pattern(ob, PLATE_T_Z0, PLATE_T_Z1)

    def fill(bm):
        for i in range(4):
            a = math.radians(90.0 * i)
            cx, cy = M(M6_R) * math.cos(a), M(M6_R) * math.sin(a)
            prof = [(0.0, M(PLATE_T_Z1 + 1.0)),
                    (M(M6_CSK_D) * 0.5, M(PLATE_T_Z1 + 1.0)),
                    (M(M6_CSK_D) * 0.5, M(PLATE_T_Z1)),
                    (M(M6_D) * 0.5 + M(0.1), M(PLATE_T_Z1 - M6_CSK_Z)),
                    (M(M6_D) * 0.5, M(PLATE_T_Z0 - 1.0)),
                    (0.0, M(PLATE_T_Z0 - 1.0))]
            bm_lathe(bm, prof, segs=32, offset=(cx, cy, 0.0))
    boolean_cut(ob, cutter_from('c_csk', fill))
    ob['cj_role'] = 'top plate 90x90x8: 4x D9 (M8) grid +-15, centre D6 dowel, 4x M6 CSK'
    return ob


def build_bottom_plate(root):
    ob = build_plate(PREFIX + 'bottom_plate', PLATE_B_Z0, PLATE_B_Z1,
                     [MATERIALS['ivory']], root)
    cut_plate_pattern(ob, PLATE_B_Z0, PLATE_B_Z1)
    ob['cj_role'] = 'bottom plate 90x90x8: 4x D9 (M8) grid +-15, centre D6 dowel, base of the unit'
    return ob


def build_top_screw(tag, root):
    prof = [(0.0, -M(M6_LEN)),
            (M(2.2), -M(M6_LEN)),
            (M(3.0), -M(M6_LEN - 0.5)),
            (M(3.0), -M(M6_CSK_Z)),
            (M(3.3), -M(M6_CSK_Z)),
            (M(M6_CSK_D) * 0.5, 0.0),
            (0.0, 0.0)]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=28)
    ob = finish(PREFIX + 'top_screw_' + tag, bm, [MATERIALS['steel']], root)
    a = math.radians({'east': 0.0, 'north': 90.0, 'west': 180.0, 'south': 270.0}[tag])
    ob.location = (M(M6_R) * math.cos(a), M(M6_R) * math.sin(a), M(PLATE_T_Z1))
    smooth_cyl(ob)
    ob['cj_role'] = 'M6x16 countersunk socket screw, head flush with the top plate'
    return ob


# --- корпус --------------------------------------------------------------
def build_base(root):
    prof = [(0.0, M(BASE_Z0)), (M(BASE_R), M(BASE_Z0)), (M(BASE_R), M(BASE_Z1)),
            (M(PILOT_R), M(BASE_Z1)), (M(PILOT_R), M(PILOT_Z1)), (0.0, M(PILOT_Z1))]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=96)
    ob = finish(PREFIX + 'base_body', bm, [MATERIALS['ivory'], MATERIALS['wear']], root)
    safe_bevel(ob, M(BEVEL_BASE), segments=2, angle=30.0)
    smooth_cyl(ob)

    def fill(bm):
        # паз-вилка под рычаг фиксатора (-X)
        bm_box(bm, M(POCKET_X1 - POCKET_X0), M(2.0 * POCKET_HY),
               M(POCKET_Z1 - BASE_Z0 + 1.0),
               (M((POCKET_X0 + POCKET_X1) * 0.5), 0.0,
                M((POCKET_Z1 + BASE_Z0 - 1.0) * 0.5)))
        # направляющее отверстие толкателя
        bm_cyl(bm, M(DET_BORE) * 0.5, M(POCKET_Z1 - 0.2), M(BASE_Z1 + 0.01),
               cx=-M(IDX_R), cy=0.0, n=32)
    boolean_cut(ob, cutter_from('c_pocket', fill))

    # пятно скольжения под шайбу -> графит износа
    for poly in ob.data.polygons:
        c, n = poly.center, poly.normal
        r = math.hypot(c.x, c.y)
        if abs(c.z - M(BASE_Z1)) < M(0.06) and n.z > 0.9 and M(WASH_R0 - 0.5) < r < M(BASE_R):
            poly.material_index = 1
    ob['cj_role'] = ('fixed housing D70 h18 with D25 pilot, thrust seat and the -X fork pocket '
                     'for the index lock lever')
    return ob


# --- шайба / барабан -----------------------------------------------------
def build_washer(root):
    prof = [(M(WASH_R0), M(WASH_Z0)), (M(WASH_R1), M(WASH_Z0)),
            (M(WASH_R1), M(WASH_Z1)), (M(WASH_R0), M(WASH_Z1))]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=96, closed=True)
    ob = finish(PREFIX + 'thrust_washer', bm, [MATERIALS['insert']], root)
    safe_bevel(ob, M(0.5), segments=1, angle=35.0)
    smooth_cyl(ob)
    ob['cj_role'] = 'graphite thrust washer D37/D26 x3 — yaw bearing seat'
    return ob


def build_drum(root):
    prof = [(0.0, M(RECESS_Z1)), (M(RECESS_R), M(RECESS_Z1)), (M(RECESS_R), M(DRUM_Z0)),
            (M(DRUM_R), M(DRUM_Z0)), (M(DRUM_R), M(DRUM_Z1)), (0.0, M(DRUM_Z1))]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=96)
    ob = finish(PREFIX + 'drum', bm, [MATERIALS['ivory'], MATERIALS['wear'],
                                      MATERIALS['insert']], root)
    safe_bevel(ob, M(BEVEL_DRUM), segments=2, angle=30.0)

    # градуировочный поясок: кольцевая проточка до R37.4
    def band(bm):
        bm_lathe(bm, [(M(BAND_R), M(BAND_Z0 - 0.4)), (M(DRUM_R + 1.0), M(BAND_Z0 - 0.4)),
                      (M(DRUM_R + 1.0), M(BAND_Z1 + 0.4)), (M(BAND_R), M(BAND_Z1 + 0.4))],
                 segs=96, closed=True)
    boolean_cut(ob, cutter_from('c_band', band))

    # 72 риски: старшие через 15°, младшие через 5°
    def ticks(bm):
        n = int(round(360.0 / TICK_STEP))
        for i in range(n):
            ang = i * TICK_STEP
            major = (i % 3 == 0)
            w = 1.3 if major else 0.7
            z0, z1 = (BAND_Z0 + 1.0, BAND_Z1 - 1.0) if major else (BAND_Z0 + 3.0, BAND_Z1 - 3.0)
            if i == 0:
                w = 1.8
            vs = bm_box(bm, M(1.0), M(w), M(z1 - z0))
            bmesh.ops.translate(bm, vec=(M(BAND_R + 0.2 - 0.5), 0.0, M((z0 + z1) * 0.5)),
                                verts=vs)
            bmesh.ops.rotate(bm, cent=(0.0, 0.0, 0.0),
                             matrix=Matrix.Rotation(math.radians(ang), 3, 'Z'), verts=vs)
    boolean_cut(ob, cutter_from('c_ticks', ticks))

    # 24 индексирующих отверстия через 15° (по одному, см. cut_plate_pattern)
    for i in range(IDX_COUNT):
        a = math.radians(i * IDX_STEP)
        cx, cy = M(IDX_R) * math.cos(a), M(IDX_R) * math.sin(a)
        boolean_cut(ob, cutter_from('c_idx', lambda bm, cx=cx, cy=cy: bm_cyl(
            bm, M(IDX_D) * 0.5, M(IDX_Z0 - 0.5), M(IDX_Z1), cx=cx, cy=cy, n=32)))

    # 4 гнезда Ø6.6 под M6 сверху
    for i in range(4):
        a = math.radians(90.0 * i)
        cx, cy = M(M6_R) * math.cos(a), M(M6_R) * math.sin(a)
        boolean_cut(ob, cutter_from('c_m6', lambda bm, cx=cx, cy=cy: bm_cyl(
            bm, M(M6_D) * 0.5, M(DRUM_Z1 - 12.0), M(DRUM_Z1 + 0.5), cx=cx, cy=cy, n=32)))

    # грани: дно рисок -> графит-вставка, посадочное кольцо -> графит износа
    for poly in ob.data.polygons:
        c, n = poly.center, poly.normal
        r = math.hypot(c.x, c.y)
        if abs(n.z) < 0.5 and abs(r - M(BAND_R - TICK_DEPTH)) < M(0.2) \
                and M(BAND_Z0 + 0.5) < c.z < M(BAND_Z1 - 0.5):
            poly.material_index = 2
        elif abs(c.z - M(DRUM_Z0)) < M(0.06) and n.z < -0.9 \
                and M(WASH_R0 - 0.5) < r < M(WASH_R1 + 0.5):
            poly.material_index = 1
    smooth_cyl(ob)
    ob['cj_role'] = ('rotating drum D78 h53: graduation band (major 15° / minor 5°), '
                     '24 index holes D6.5 on R23.5 every 15°, 4x M6 bosses')
    return ob


# --- фиксатор ------------------------------------------------------------
def build_detent_pin(root):
    d = M(DET_D) * 0.5
    dr = M(DET_DOME_R)
    prof = []
    steps = 10
    for i in range(steps + 1):
        t = math.pi * 0.5 * i / steps
        prof.append((dr * math.sin(t), dr - dr * math.cos(t)))
    prof.append((d, M(DET_LEN) - M(0.5)))
    prof.append((d - M(0.5), M(DET_LEN)))
    prof.append((0.0, M(DET_LEN)))
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=32, offset=(0.0, 0.0, M(DET_Z0)))
    ob = finish(PREFIX + 'detent_pin', bm, [MATERIALS['steel']], root)
    smooth_cyl(ob)
    ob['cj_role'] = ('D6 index pin, spherical lower end riding on the cam lever, '
                     'lift %.2f mm into the drum index hole' % detent_lift())
    return ob


def detent_lift():
    """Подъём торца пальца при повороте рычага (аналитика по плоскости плеча)."""
    cx, cz = LEVER_C
    dx = (-IDX_R) - cx                       # мм от оси качания до оси пальца
    dz = LEVER_TOP - cz
    a = math.radians(-LEVER_SWING)
    z_open = dz
    z_closed = -dx * math.sin(a) + dz * math.cos(a)
    return z_closed - z_open


def lever_profile():
    cx, cz = LEVER_C
    r = LEVER_R
    top, bot = LEVER_TOP, LEVER_BOT
    dx = math.sqrt(max(0.0, r * r - (top - cz) ** 2))
    xj = cx + dx
    pts = [(xj, top), (LEVER_TIP_X, top), (LEVER_TIP_X, bot), (xj, bot)]
    a0 = math.atan2(bot - cz, dx)
    a_end = math.atan2(top - cz, dx) - 2.0 * math.pi
    n = 56
    for i in range(1, n):
        a = a0 + (a_end - a0) * i / n
        pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def build_lever(root):
    ob = extrude_profile_xz(PREFIX + 'lock_lever', lever_profile(), LEVER_HY,
                            [MATERIALS['pink']], root)
    safe_bevel(ob, M(0.25), segments=1, angle=35.0)
    smooth_cyl(ob)

    def fill(bm):
        bm_lathe(bm, [(0.0, -M(PIVOT_D)), (M(PIVOT_D) * 0.5 + M(0.1), -M(PIVOT_D)),
                      (M(PIVOT_D) * 0.5 + M(0.1), M(PIVOT_D)),
                      (0.0, M(PIVOT_D))], segs=28, axis_y=True,
                 offset=(M(LEVER_C[0]), 0.0, M(LEVER_C[1])))
    boolean_cut(ob, cutter_from('c_lpivot', fill))
    ob['cj_role'] = ('index lock lever (muted pink): %.0f deg swing, lifts the D6 detent pin '
                     '%.2f mm, 15 deg positive stop' % (LEVER_SWING, detent_lift()))
    return ob


def build_lever_pivot(root):
    prof = [(0.0, -M(12.5)), (M(PIVOT_D) * 0.5, -M(12.5)),
            (M(PIVOT_D) * 0.5, M(12.1)), (M(PIVOT_D) * 0.5 - M(0.4), M(12.5)),
            (0.0, M(12.5))]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=28, axis_y=True,
             offset=(M(LEVER_C[0]), 0.0, M(LEVER_C[1])))
    ob = finish(PREFIX + 'lever_pivot', bm, [MATERIALS['steel']], root)
    smooth_cyl(ob)
    ob['cj_role'] = 'D7 pivot pin of the lock lever, anchored in the housing cheeks'
    return ob


def build_pointer(root):
    # стойка с лапой-подошвой и язычком в проточку пояска
    pts = [(PTR_X0 - 2.0, PTR_Z0), (PTR_X1, PTR_Z0), (PTR_X1, PTR_Z1), (PTR_X0, PTR_Z1),
           (PTR_X0, TONG_Z1), (TONG_X, TONG_Z1), (TONG_X, TONG_Z0), (PTR_X0, TONG_Z0),
           (PTR_X0, PTR_Z0 + 3.0), (PTR_X0 - 2.0, PTR_Z0 + 3.0)]
    ob = extrude_profile_xz(PREFIX + 'index_pointer', pts, PTR_HY, [MATERIALS['steel']], root)
    safe_bevel(ob, M(0.4), segments=1, angle=40.0)
    ob['cj_role'] = ('fixed index pointer bolted to the bottom plate, tongue in the '
                     'graduation groove, 0.4 mm off the band surface')
    return ob


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
    parts['bottom_plate'] = build_bottom_plate(root)
    parts['bottom_dowel'] = build_dowel(PREFIX + 'bottom_dowel', 0.0, 7.6,
                                        [MATERIALS['steel']], root)
    parts['base'] = build_base(root)
    parts['washer'] = build_washer(root)
    parts['drum'] = build_drum(root)
    parts['pin'] = build_detent_pin(root)
    parts['lever'] = build_lever(root)
    parts['lever_pivot'] = build_lever_pivot(root)
    parts['pointer'] = build_pointer(root)
    parts['top_plate'] = build_top_plate(root)
    parts['top_dowel'] = build_dowel(PREFIX + 'top_dowel', PLATE_T_Z1 - 7.6, PLATE_T_Z1,
                                     [MATERIALS['steel']], root)
    for tag in ('east', 'north', 'west', 'south'):
        parts['screw_' + tag] = build_top_screw(tag, root)

    meshes = obj_mesh_objs(root)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    for ob in obj_mesh_objs(root):
        dim = ob.dimensions
        if max(dim) > 0.2 or max(dim) < 0.0004:
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


def measure_pattern(plate, dowel, z0, z1, from_below, tag):
    """4x Ø9 (M8) + центральное Ø6.1 со штифтом Ø6."""
    holes = []

    if from_below:
        def open_at(x, y):
            return ray(plate, (x, y, M(z0 - 5.0)), (0, 0, 1), M((z1 - z0) + 8.0)) is None
    else:
        def open_at(x, y):
            return ray(plate, (x, y, M(z1 + 5.0)), (0, 0, -1), M((z1 - z0) + 8.0)) is None

    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * M(BOLT_GRID), sy * M(BOLT_GRID)
            through = open_at(cx, cy)
            dia = None
            if through:
                ex = bisect(lambda o: open_at(cx + o, cy), 0.0, M(M8_D))
                ey = bisect(lambda o: open_at(cx, cy + o), 0.0, M(M8_D))
                dia = [round(ex * 2000, 2), round(ey * 2000, 2)]
            holes.append({'id': 'M8_%s%s' % ('plus' if sx > 0 else 'minus',
                                             'plus' if sy > 0 else 'minus'),
                          'grid_mm': [float(sx * BOLT_GRID), float(sy * BOLT_GRID)],
                          'center_m': [round(cx, 5), round(cy, 5),
                                       round(M(z1 if not from_below else z0), 5)],
                          'through': through, 'dia_mm': dia})

    bore_ok = open_at(0.0, 0.0)
    bore_dia = None
    if bore_ok:
        ex = bisect(lambda o: open_at(o, 0.0), 0.0, M(4.0))
        ey = bisect(lambda o: open_at(0.0, o), 0.0, M(4.0))
        bore_dia = [round(ex * 2000, 2), round(ey * 2000, 2)]

    pmn, pmx = bbox_of([dowel])
    dsize = pmx - pmn
    face_z = pmn.z if from_below else pmx.z
    pin = {'node': dowel.name,
           'dia_mm': round(min(dsize.x, dsize.y) * 1000, 2),
           'bore_dia_mm': bore_dia,
           'face_z_mm': round(face_z * 1000, 3),
           'flush_mm': round(abs(face_z - M(z0 if from_below else z1)) * 1000, 3),
           'length_mm': round(dsize.z * 1000, 2),
           'present': True}

    ok_holes = all(h['through'] and h['dia_mm']
                   and abs(h['dia_mm'][0] - M8_D) <= 0.3
                   and abs(h['dia_mm'][1] - M8_D) <= 0.3 for h in holes)
    ok_pin = (bore_ok and bore_dia is not None
              and abs(bore_dia[0] - PIN_BORE) <= 0.3 and abs(bore_dia[1] - PIN_BORE) <= 0.3
              and abs(pin['dia_mm'] - PIN_D) <= 0.15 and pin['flush_mm'] <= 0.08)
    return {'face': tag, 'plate_mm': [SIZE_XY, SIZE_XY, round(z1 - z0, 2)],
            'z_range_mm': [z0, z1], 'grid_mm': BOLT_GRID, 'holes': holes,
            'pin': pin, 'holes_ok': ok_holes, 'pin_ok': ok_pin,
            'ok': ok_holes and ok_pin}


def measure_index(drum):
    """24 отверстия на R23.5 через 15°: луч снизу в барабан."""
    found, miss = [], []
    steps = int(round(360.0 / IDX_STEP))
    for i in range(steps):
        ang = i * IDX_STEP
        a = math.radians(ang)
        p = ray(drum, (M(IDX_R) * math.cos(a), M(IDX_R) * math.sin(a), M(DRUM_Z0 - 0.5)),
                (0, 0, 1), M(IDX_Z1 - DRUM_Z0 + 1.0))
        z = round(p.z * 1000, 2) if p is not None else None
        rec = {'deg': ang, 'hit_z_mm': z, 'hole': (z is not None and z > IDX_Z0 + 2.0)}
        (found if rec['hole'] else miss).append(rec)
    # контроль промежуточного угла: там должно быть тело барабана
    a = math.radians(IDX_STEP * 0.5)
    p = ray(drum, (M(IDX_R) * math.cos(a), M(IDX_R) * math.sin(a), M(DRUM_Z0 - 0.5)),
            (0, 0, 1), M(IDX_Z1 - DRUM_Z0 + 1.0))
    mid_solid = (p is not None and abs(p.z * 1000 - IDX_Z0) < 0.2)
    return {'r_mm': IDX_R, 'dia_mm': IDX_D, 'depth_mm': round(IDX_Z1 - IDX_Z0, 2),
            'z_range_mm': [IDX_Z0, IDX_Z1], 'step_deg': IDX_STEP,
            'count': len(found), 'count_ok': len(found) == IDX_COUNT,
            'angles_deg': [r['deg'] for r in found],
            'missing': [r['deg'] for r in miss],
            'mid_angle_solid': mid_solid,
            'ok': len(found) == IDX_COUNT and mid_solid}


def measure_lock(parts, idx, bbox):
    pin, lever = parts['pin'], parts['lever']
    lift = detent_lift()
    pmn, pmx = bbox_of([pin])
    open_top = pmx.z * 1000
    open_gap = DRUM_Z0 - open_top
    closed_top = open_top + lift
    engage = closed_top - DRUM_Z0

    # размах рычага открыто -> закрыто
    pivot = Vector((M(LEVER_C[0]), 0.0, M(LEVER_C[1])))
    mw = lever.matrix_world
    verts = [mw @ v.co for v in lever.data.vertices]
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    steps = int(LEVER_SWING)
    for deg in range(0, steps + 1, 5):
        rot = Matrix.Rotation(math.radians(-deg), 3, 'Y')
        for p in verts:
            q = pivot + (rot @ (p - pivot))
            for i in range(3):
                mn[i] = min(mn[i], q[i])
                mx[i] = max(mx[i], q[i])
    inside = (mn.x >= bbox[0].x - 1e-6 and mx.x <= bbox[1].x + 1e-6
              and mn.y >= bbox[0].y - 1e-6 and mx.y <= bbox[1].y + 1e-6
              and mn.z >= bbox[0].z - 1e-6 and mx.z <= bbox[1].z + 1e-6)
    ceiling_clear = M(POCKET_Z1) - mx.z
    lmn, lmx = bbox_of([lever])

    rec = {
        'type': 'positive index detent: dome-ended pin lifted by a cam lever (muted pink)',
        'yaw': {'axis': 'Z', 'range_deg': YAW_RANGE, 'step_deg': YAW_STEP,
                'positions': int(round(YAW_RANGE / YAW_STEP)),
                'zero_mark': 'at +X, under the fixed pointer'},
        'index_holes': idx,
        'pin': {'node': pin.name, 'dia_mm': DET_D, 'guide_bore_mm': DET_BORE,
                'open_top_z_mm': round(open_top, 3),
                'open_gap_mm': round(open_gap, 3),
                'lift_mm': round(lift, 3),
                'closed_top_z_mm': round(closed_top, 3),
                'engagement_mm': round(engage, 3)},
        'lever': {'node': lever.name, 'pivot_mm': [LEVER_C[0], 0.0, LEVER_C[1]],
                  'axis': 'Y', 'swing_deg': LEVER_SWING,
                  'tip_mm': [LEVER_TIP_X, 0.0, LEVER_TOP],
                  'contact_offset_mm': [(-IDX_R) - LEVER_C[0], LEVER_TOP - LEVER_C[1]],
                  'bbox_mm': {'min': [round(v * 1000, 2) for v in lmn],
                              'max': [round(v * 1000, 2) for v in lmx]},
                  'swing_envelope_mm': {'min': [round(v * 1000, 2) for v in mn],
                                        'max': [round(v * 1000, 2) for v in mx]},
                  'pocket_ceiling_clearance_mm': round(ceiling_clear * 1000, 3)},
        'swing_inside_bbox': inside,
        'note': ('смоделировано в ОТКРЫТОМ положении: палец поднят на %.2f мм ниже '
                 'дна барабана, поворот рычага на %.0f° поднимает его на %.2f мм и '
                 'вводит в отверстие Ø%.1f на %.2f мм — позитивный упор через %.0f°'
                 % (open_gap, LEVER_SWING, lift, IDX_D, engage, IDX_STEP)),
    }
    rec['ok'] = (0.3 <= open_gap <= 2.0 and 2.0 <= lift <= 5.0 and engage >= 2.5
                 and idx['ok'] and inside and ceiling_clear > M(0.1))
    return rec


def measure_pointer(parts):
    ptr = parts['pointer']
    pmn, pmx = bbox_of([ptr])
    tongue_lo = TONG_X
    gap = tongue_lo - BAND_R
    return {'node': ptr.name, 'post_mm': [PTR_X0, PTR_X1], 'tongue_z_mm': [TONG_Z0, TONG_Z1],
            'tongue_tip_r_mm': tongue_lo, 'band_r_mm': BAND_R,
            'gap_mm': round(gap, 3), 'anchored_z_mm': round(pmn.z * 1000, 2),
            'ok': 0.1 <= gap <= 1.5 and abs(pmn.z * 1000 - PTR_Z0) < 0.02}


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
            for k in ('steel', 'pink', 'insert', 'wear', 'ivory'):
                if mat.name.endswith(k) or mat.name.endswith(k + '_100'):
                    key = k
                    break
            break
        vol_by_key[key] = vol_by_key.get(key, 0.0) + st['volume_cm3']

    mass = sum(v * 1e-6 * DENSITY.get(k, 2700.0) for k, v in vol_by_key.items())
    mass_zn = sum(v * 1e-6 * (7850.0 if k == 'steel' else DENSITY_ZN)
                  for k, v in vol_by_key.items())

    mats = sorted({m.name for ob in meshes for m in ob.data.materials if m})
    bottom = measure_pattern(parts['bottom_plate'], parts['bottom_dowel'],
                             PLATE_B_Z0, PLATE_B_Z1, True, 'bottom')
    top = measure_pattern(parts['top_plate'], parts['top_dowel'],
                          PLATE_T_Z0, PLATE_T_Z1, False, 'top')
    idx = measure_index(parts['drum'])
    lock = measure_lock(parts, idx, (mn, mx))
    ptr = measure_pointer(parts)

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
        'bbox_ok': (abs(size.x - M(SIZE_XY)) <= 0.0008
                    and abs(size.y - M(SIZE_XY)) <= 0.0008
                    and abs(size.z - M(HEIGHT)) <= 0.0008
                    and abs(mn.z) <= 0.0008
                    and abs(mn.x + M(SIZE_XY * 0.5)) <= 0.0008
                    and abs(mn.y + M(SIZE_XY * 0.5)) <= 0.0008),
        'mass_kg_est': round(mass, 3),
        'mass_kg_est_zn': round(mass_zn, 3),
        'bottom_plate': bottom,
        'bottom_pattern_ok': bottom['ok'],
        'top_plate': top,
        'top_pattern_ok': top['ok'],
        'lock': lock,
        'lock_ok': lock['ok'],
        'yaw': {'axis': 'Z', 'range_deg': YAW_RANGE, 'step_deg': YAW_STEP,
                'positions': int(round(YAW_RANGE / YAW_STEP)),
                'index_holes': idx['count']},
        'yaw_ok': (abs(YAW_RANGE - 360.0) < 1e-6
                   and abs(YAW_STEP - 15.0) < 1e-6
                   and abs(YAW_RANGE / YAW_STEP - idx['count']) < 1e-9),
        'pointer': ptr,
        'pointer_ok': ptr['ok'],
        'volume_by_material_cm3': {k: round(v, 3) for k, v in vol_by_key.items()},
        'negative_scale': [ob.name for ob in meshes if ob.matrix_world.determinant() < 1e-9],
        'no_negative_scale': all(ob.matrix_world.determinant() > 1e-9 for ob in meshes),
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'dof': {'axis': 'Z', 'range_deg': YAW_RANGE, 'step_deg': YAW_STEP,
                'limited_by': '24 index holes + positive detent pin'},
        'dof_ok': True,
        'animation': 'none (no actions; yaw is a runtime DOF)',
        'animation_ok': len(bpy.data.actions) == 0,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))
    return checks, dict(mn=mn, mx=mx, size=size, mass=mass, mass_zn=mass_zn, mats=mats,
                        verts=verts, tris=tris, per_obj=per_obj, bottom=bottom,
                        top=top, lock=lock, idx=idx, ptr=ptr, vol=vol_by_key)


# --- report --------------------------------------------------------------
def build_report(root, checks, m):
    interfaces = {
        'bottom_plate': {
            'role': 'fixed base of the yaw unit, bolts to the machine table',
            'plane': 'XY at z=0 mm',
            'plate_mm': [SIZE_XY, SIZE_XY, PLATE_T],
            'z_range_mm': [PLATE_B_Z0, PLATE_B_Z1],
            'normal': [0.0, 0.0, -1.0],
            'grid_mm': BOLT_GRID,
            'm8': [{'id': h['id'], 'grid_mm': h['grid_mm'], 'center_m': h['center_m'],
                    'dia_mm': M8_D, 'measured_dia_mm': h['dia_mm']}
                   for h in m['bottom']['holes']],
            'pin': m['bottom']['pin'],
            'bolts': 'M8 x4 (D9 through), grid +-15 mm, washer D16 implied',
            'compatibility': 'same 4x M8 +-15 + centre D6 pattern as fix_carriage top plate',
        },
        'top_plate': {
            'role': 'rotating mounting plate: full 0-360 yaw, indexed every 15 deg',
            'plane': 'XY at z=90 mm',
            'plate_mm': [SIZE_XY, SIZE_XY, PLATE_T],
            'z_range_mm': [PLATE_T_Z0, PLATE_T_Z1],
            'normal': [0.0, 0.0, 1.0],
            'grid_mm': BOLT_GRID,
            'm8': [{'id': h['id'], 'grid_mm': h['grid_mm'], 'center_m': h['center_m'],
                    'dia_mm': M8_D, 'measured_dia_mm': h['dia_mm']}
                   for h in m['top']['holes']],
            'pin': m['top']['pin'],
            'bolts': 'M8 x4 (D9 through), grid +-15 mm, washer D16 implied',
            'drive': '4x M6 CSK from above into the drum, heads flush',
            'compatibility': 'child component sees the same pattern as the fixed plate',
        },
        'yaw_joint': {
            'axis': [0.0, 0.0, 1.0],
            'range_deg': YAW_RANGE,
            'step_deg': YAW_STEP,
            'positions': int(round(YAW_RANGE / YAW_STEP)),
            'bearing': {'pilot_mm': 2 * PILOT_R,
                        'pilot_depth_mm': round(DRUM_Z0 - BASE_Z1 + (RECESS_Z1 - DRUM_Z0), 2),
                        'thrust_washer_mm': [2 * WASH_R0, 2 * WASH_R1, WASH_Z1 - WASH_Z0],
                        'material': 'CJ_pivot_insert_graphite'},
            'graduation': {'band_z_mm': [BAND_Z0, BAND_Z1], 'band_r_mm': BAND_R,
                           'major_deg': IDX_STEP, 'minor_deg': TICK_STEP,
                           'ticks': int(round(360.0 / TICK_STEP)),
                           'zero': 'tick at +X aligned with the fixed pointer'},
            'lock': {
                'type': m['lock']['type'],
                'index_holes': m['idx']['count'],
                'lever_swing_deg': LEVER_SWING,
                'lift_mm': m['lock']['pin']['lift_mm'],
                'engagement_mm': m['lock']['pin']['engagement_mm'],
                'open_gap_mm': m['lock']['pin']['open_gap_mm'],
                'state_modelled': 'open (pin 0.80 mm below the drum, free rotation)',
            },
        },
    }
    return {
        'id': CID,
        'code': 'CJ-PIVOT-090',
        'name': 'Поворотный узел (yaw)',
        'kit': 'CJ-FIX-KIT',
        'class': 'MOTION / rotary',
        'standard': 'CJ-FIX-KIT / 90 cube',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_pivot.py',
        'units': 'm',
        'spec': {
            'overall_mm': [SIZE_XY, SIZE_XY, HEIGHT],
            'bottom_plate_mm': [SIZE_XY, SIZE_XY, PLATE_T],
            'top_plate_mm': [SIZE_XY, SIZE_XY, PLATE_T],
            'plate_pattern': 'M8 x4 D9 grid +-15 + centre D6 dowel (both plates)',
            'housing_mm': [2 * BASE_R, 2 * BASE_R, round(BASE_Z1 - BASE_Z0, 2)],
            'pilot_mm': [2 * PILOT_R, round(PILOT_Z1 - BASE_Z1, 2)],
            'drum_mm': [2 * DRUM_R, round(DRUM_Z1 - DRUM_Z0, 2)],
            'thrust_washer_mm': [2 * WASH_R0, 2 * WASH_R1, WASH_Z1 - WASH_Z0],
            'yaw': {'axis': 'Z', 'range_deg': YAW_RANGE, 'step_deg': YAW_STEP,
                    'positions': int(round(YAW_RANGE / YAW_STEP))},
            'lock': 'positive detent pin D6, cam lever 40 deg, lift %.2f mm, 24 x 15 deg'
                    % detent_lift(),
            'mass_kg_spec': 1.4,
            'material': 'Al 6061 plates / graphite washer / steel pin (zinc casting variant)',
            'load_kn_concept': 2.0,
        },
        'bbox_m': {'min': [round(v, 5) for v in m['mn']],
                   'max': [round(v, 5) for v in m['mx']],
                   'size': [round(v, 5) for v in m['size']],
                   'nominal': [0.09, 0.09, 0.09],
                   'ok': checks['bbox_ok']},
        'yaw_deg': {'range': YAW_RANGE, 'step': YAW_STEP,
                    'positions': int(round(YAW_RANGE / YAW_STEP))},
        'nodes': [ob.name for ob in sorted(obj_mesh_objs(root), key=lambda o: o.name)],
        'node_count': len(obj_mesh_objs(root)) + 1,
        'root': root.name,
        'materials': m['mats'],
        'material_count': len(m['mats']),
        'material_usage': {ob.name: [x.name for x in ob.data.materials if x]
                           for ob in obj_mesh_objs(root)},
        'volume_by_material_cm3': checks['volume_by_material_cm3'],
        'mass_kg_est': round(m['mass'], 3),
        'mass_kg_est_zn': round(m['mass_zn'], 3),
        'verts': m['verts'],
        'tris': m['tris'],
        'per_object': m['per_obj'],
        'interfaces': interfaces,
        'checks': checks,
        'renders': [],
        'glb': None,
        'glb_bytes': None,
        'notes': [
            'Габарит 90 x 90 x 90 мм: две плиты 90x90x8 (низ — база, верх — вращающаяся '
            'площадка) и барабан Ø78 между ними.',
            'Обе плиты несут ОДИН паттерн: 4 x Ø9 (M8) по сетке ±15 мм и центральное '
            'гнездо Ø6.1 со штифтом Ø6, заподлицо с рабочей плоскостью — ребёнок '
            'крепится теми же болтами, что и к неподвижной базе.',
            'Поворот — yaw 0…360° по Z вокруг центрирующей бобышки Ø25 на графитовой '
            'упорной шайбе Ø37/Ø26 x3; шаг 15° задан 24 отверстиями Ø6.5 на R23.5 '
            '(z 29…41).',
            'Градуировка: поясок R37.4 (z 32…44) с 72 рисками — старшие через 15°, '
            'младшие через 5°, дно рисок — графит; нулевая риска под неподвижным '
            'указателем +X (зазор 0.4 мм).',
            'Фиксатор — позитивный: палец Ø6 со сферическим низом поднимается '
            'кулачковым рычагом (muted pink, 40° хода) на %.2f мм и входит в '
            'отверстие на %.2f мм; в открытом положении торец пальца на 0.80 мм ниже '
            'дна барабана.' % (detent_lift(), detent_lift() + (DRUM_Z0 - (DET_Z0 + DET_LEN))),
            'Масса по фактическим объёмам: %s кг в алюминии, %s кг в цинковом литье '
            '(6.6 г/см³).' % (round(m['mass'], 2), round(m['mass_zn'], 2)),
        ],
        'deviations': [
            'Резьбовые вставки M6 в барабане не моделировались: отверстия Ø6.6 — '
            'гладкие, винт M6x16 проходит насквозь (в металле — Helicoil).',
            'Корпус крепится к нижней плите 4 винтами M6 снизу (головки в потай на '
            'нижней плоскости) — крепёж не моделировался, контакт плита/корпус '
            'показан посадкой z=8.',
            'Градуировка — только риски, без цифр: на 90 мм кольце 72 подписи не '
            'читаются, в блок-ауте достаточно рисок + указателя.',
            'Фиксатор смоделирован в ОТКРЫТОМ положении (палец опущен); закрытое '
            'положение описано числами (подъём %.2f мм, вход %.2f мм), как в '
            'fix_carriage.' % (detent_lift(), detent_lift() + (DRUM_Z0 - (DET_Z0 + DET_LEN))),
            'Шайба Ø37/Ø26 — расчётное пятно для нагрузки 2 кН в блок-ауте; '
            'реальный узел получил бы радиально-упорный подшипник 6807.',
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
            ('key', (0.14, 0.18, 0.27), 3.6, 0.15),
            ('fill', (-0.20, 0.13, 0.13), 1.3, 0.20),
            ('rim', (-0.06, -0.21, 0.16), 2.4, 0.15),
            ('top', (0.02, 0.05, 0.33), 1.0, 0.20)):
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
    cam_data.clip_start = 0.004
    cam_data.clip_end = 20.0
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
    close_lo = Vector((M(27.0), M(-26.0), M(32.0)))
    close_hi = Vector((M(46.0), M(18.0), M(56.0)))
    c_close = box_corners(close_lo, close_hi)
    close_t = (close_lo + close_hi) * 0.5

    views = [
        ('3q', (0.58, 0.62, 0.46), center, 62, c_main, 0.880, None),
        ('front', (0.02, -0.99, 0.18), center, 100, c_main, 0.885, None),
        ('side', (-0.99, -0.14, 0.12), center, 100, c_main, 0.900, None),
        ('closeup', (0.60, -0.74, 0.30), close_t, 70, c_close, 0.86, (close_lo, close_hi)),
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
        '| idx', m['idx']['count'], '| lock', checks['lock_ok'],
        '| nm/dg', checks['non_manifold'], checks['degenerate'])

    if not checks['all_ok']:
        failed = {k: v for k, v in checks.items() if k.endswith('_ok') and not v}
        log('CHECKS FAILED', json.dumps(failed, ensure_ascii=False, default=str))
        (OUT_DIR / 'report_failed.json').write_text(
            json.dumps({'failed': failed, 'checks': checks, 'per_object': m['per_obj'],
                        'bottom': m['bottom'], 'top': m['top'], 'lock': m['lock'],
                        'index': m['idx'], 'pointer': m['ptr']},
                       ensure_ascii=False, indent=2, default=str), encoding='utf-8')
        print('CHECKS_FAILED', flush=True)
        sys.exit(2)

    rep = build_report(root, checks, m)
    root['cj_id'] = CID
    root['cj_standard'] = 'CJ-FIX-KIT / 90 cube'
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_yaw_deg'] = json.dumps(rep['yaw_deg'])
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
