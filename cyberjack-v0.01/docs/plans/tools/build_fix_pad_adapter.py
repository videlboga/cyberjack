#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_pad_adapter — переходник carriage/rail -> CJ-PAD (подушка/ложемент).

Standalone builder. Не трогает общий builder/catalog/pages и чужие модули.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_pad_adapter.py

Все размеры заданы в МИЛЛИМЕТРАХ, в сцену переводятся одним множителем M().

Локальная система (м): X — глубина, Y — ширина, Z — вверх. Начало координат —
центр плиты по X/Y, низ плиты по Z.

Конструкция (мм):
  * плита 80x60x8 (z 0…8): 4 x Ø9 (M8) по сетке +-15 + цековка Ø15x4 снизу,
    центральное гнездо Ø6,1 под штифт каретки — тот же паттерн, что top_plate
    fix_carriage и площадки fix_corner_node / fix_latch_adapter;
  * шейка 58x42 (z 8…16) — переход с плиты на площадку, скругление 2 мм по
    кромкам, без декоративных элементов;
  * площадка 70x50x14 (z 16…30) с посадочным гнездом 62x42 глубиной 4 мм
    (z 26…30), верхняя кромка площадки скруглена 2,5 мм — мягкий бортик;
  * графитовое ложе 61,6x41,6x2,5 (z 26…28,5) вклеено в гнездо: над ним
    остаётся бортик 1,5 мм, который ловит съёмную подушку по контуру;
  * 4 x M6 на сетке 44x26 (+-22 / +-13): сквозное Ø6,4 + плоская цековка Ø11x6
    с ненулевым дном (z 22,5); винты M6x12 (сталь) сидят заподлицо с ложем;
  * pink-акцент: пружинная защёлка подушки на -Y кромке площадки (язык 24x3,
    вылет 4,3 мм за площадку, крючок поднимается на 2,1 мм над ложем) —
    единственная цветная деталь, она держит борт подушки.

Подушка CJ-PAD в модуль не входит (сменный элемент): показано состояние
«адаптер поставлен, подушка снята, крепёж M6 на месте».
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
CID = 'fix_pad_adapter'
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

# шейка
NECK_X, NECK_Y = 58.0, 42.0
NECK_Z0, NECK_Z1 = 8.0, 16.0
BEVEL_NECK = 2.0

# площадка подушки
PLAT_X, PLAT_Y = 70.0, 50.0
PLAT_Z0, PLAT_Z1 = 16.0, 30.0
SEAT_X, SEAT_Y = 62.0, 42.0          # посадочное гнездо под ложе
SEAT_DEPTH = 4.0
SEAT_Z0, SEAT_Z1 = PLAT_Z1 - SEAT_DEPTH, PLAT_Z1
LINER_X, LINER_Y, LINER_T = 61.6, 41.6, 2.5
LINER_Z0, LINER_Z1 = SEAT_Z0, SEAT_Z0 + LINER_T
LIP_MM = PLAT_Z1 - LINER_Z1          # 1,5 мм бортика над ложем
BEVEL_PLAT = 2.5

# M6 под подушку: прямое Ø6,4 + плоская цековка Ø11x6 с ненулевым дном
M6_NOM = 6.0
M6_HOLE = 6.4
M6_CB_D = 11.0
M6_HEAD_D = 10.0
M6_HEAD_K = 6.0                      # головка M6 DIN 912: Ø10 x 6
M6_GRID_X, M6_GRID_Y = 22.0, 13.0
M6_LEN = 12.0
M6_CB_FLOOR = LINER_Z1 - M6_HEAD_K   # 22,5 — плоское дно цековки
M6_SHANK_BOT = M6_CB_FLOOR - (M6_LEN - M6_HEAD_K)   # 16,5 — конец винта

# pink-защёлка подушки
TAB_X0, TAB_X1 = -10.0, 10.0
TAB_Y0, TAB_Y1 = -29.8, -21.5
TAB_Z0, TAB_Z1 = 27.1, 29.5
TAB_LIP_X = 2.2                      # толщина крючка по Y
TAB_LIP_Z = 29.9                     # верх крючка (в габарите 30)

BEVEL_PLATE = 2.0
DENSITY = {'ivory': 2700.0, 'graphite': 1900.0, 'steel': 7850.0, 'pink': 2700.0}

_BVH = {}


def M(v):
    return v * MM


def log(*a):
    print('[fix_pad_adapter]', *a, flush=True)


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
    MATERIALS['ivory'] = make_mat('CJ_pad_matte_ivory', (0.735, 0.715, 0.668), 0.60, 0.0)
    MATERIALS['graphite'] = make_mat('CJ_pad_seat_graphite', (0.112, 0.118, 0.128), 0.55, 0.15)
    MATERIALS['steel'] = make_mat('CJ_pad_steel', (0.470, 0.482, 0.502), 0.38, 1.0)
    MATERIALS['pink'] = make_mat('CJ_pad_accent_pink', (0.640, 0.265, 0.315), 0.44, 0.05)


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


def bm_prism_yz(bm, pts_yz, x0, x1):
    """Призма: 2D-полигон в YZ, выдавленный по X."""
    a = [bm.verts.new((x0, y, z)) for (y, z) in pts_yz]
    b = [bm.verts.new((x1, y, z)) for (y, z) in pts_yz]
    bm.faces.new(a)
    bm.faces.new(b[::-1])
    n = len(pts_yz)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    return a + b


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


# --- плита ---------------------------------------------------------------
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
    ob['cj_role'] = ('mounting plate 80x60x8, 4x D9 (M8) on +-15 grid with D15x4 washer '
                     'counterbore + centre D6.1 dowel bore')
    return ob


def build_neck(root):
    bm = bmesh.new()
    bm_box(bm, M(NECK_X), M(NECK_Y), M(NECK_Z1 - NECK_Z0),
           (0.0, 0.0, M((NECK_Z0 + NECK_Z1) * 0.5)))
    ob = finish(PREFIX + 'neck', bm, [MATERIALS['ivory']], root)
    safe_bevel(ob, M(BEVEL_NECK), segments=2, angle=25.0)
    ob['cj_role'] = ('transition block 58x42x8 carrying the load from the 70x50 pad plate '
                     'into the 80x60 mounting plate')
    return ob


def build_platform(root):
    bm = bmesh.new()
    bm_box(bm, M(PLAT_X), M(PLAT_Y), M(PLAT_Z1 - PLAT_Z0),
           (0.0, 0.0, M((PLAT_Z0 + PLAT_Z1) * 0.5)))
    ob = finish(PREFIX + 'pad_platform', bm, [MATERIALS['ivory']], root)
    # мягкий бортик: скругление верхней кромки ДО выреза гнезда
    safe_bevel(ob, M(BEVEL_PLAT), segments=3, angle=25.0)
    # посадочное гнездо под графитовое ложе
    boolean_cut(ob, box_cutter('c_seat', M(SEAT_X), M(SEAT_Y), M(SEAT_DEPTH + 1.0),
                               (0.0, 0.0, M((SEAT_Z0 + PLAT_Z1 + 1.0) * 0.5))))
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = M(sx * M6_GRID_X), M(sy * M6_GRID_Y)
            boolean_cut(ob, cyl_cutter('c_m6', M(M6_HOLE) * 0.5, M(PLAT_Z0 - 1.0),
                                       M(PLAT_Z1 + 1.0), center=(cx, cy), n=32))
            boolean_cut(ob, cyl_cutter('c_m6_cb', M(M6_CB_D) * 0.5, M(M6_CB_FLOOR),
                                       M(PLAT_Z1 + 1.0), center=(cx, cy), n=36))
    ob['cj_role'] = ('pad plate 70x50x14: 62x42x4 seat pocket, 4x M6 (D6.4 through + flat '
                     'D11x6 counterbore) on a 44x26 grid, 2.5 mm soft roundover on the top rim')
    return ob


def build_liner(root):
    bm = bmesh.new()
    bm_box(bm, M(LINER_X), M(LINER_Y), M(LINER_T),
           (0.0, 0.0, M((LINER_Z0 + LINER_Z1) * 0.5)))
    ob = finish(PREFIX + 'pad_seat', bm, [MATERIALS['graphite']], root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = M(sx * M6_GRID_X), M(sy * M6_GRID_Y)
            boolean_cut(ob, cyl_cutter('c_m6_cb', M(M6_CB_D) * 0.5, M(M6_CB_FLOOR),
                                       M(LINER_Z1 + 1.0), center=(cx, cy), n=36))
    ob['cj_role'] = ('graphite pad seat 61.6x41.6x2.5 bonded into the 62x42 pocket; its top '
                     'face is the pad bearing plane (z 28.5), screw heads sit flush in '
                     'flat D11 counterbores')
    return ob


def build_tab(root):
    pts = [(TAB_Y1, TAB_Z0), (TAB_Y0, TAB_Z0), (TAB_Y0, TAB_LIP_Z),
           (TAB_Y0 + TAB_LIP_X, TAB_LIP_Z), (TAB_Y0 + TAB_LIP_X, TAB_Z1),
           (TAB_Y1, TAB_Z1)]
    bm = bmesh.new()
    bm_prism_yz(bm, [(M(y), M(z)) for (y, z) in pts], M(TAB_X0), M(TAB_X1))
    ob = finish(PREFIX + 'pad_tab', bm, [MATERIALS['pink']], root)
    ob['cj_role'] = ('muted pink spring tab on the -Y rim: 24 wide, 4.3 mm overhang, hook '
                     'rises 2.1 mm above the pad seat and retains the pad edge')
    return ob


def build_bolt(tag, sx, sy, root):
    head_top = LINER_Z1 - 0.05
    prof = [(0.0, M6_SHANK_BOT), (M6_HOLE * 0.5 - 0.2, M6_SHANK_BOT),
            (M6_HOLE * 0.5 - 0.2, M6_CB_FLOOR),
            (M6_HEAD_D * 0.5 - 0.1, M6_CB_FLOOR),
            (M6_HEAD_D * 0.5 - 0.1, head_top),
            (2.6, head_top), (2.6, head_top - 2.6),
            (0.0, head_top - 2.6)]
    bm = bmesh.new()
    bm_lathe(bm, [(M(r), M(z)) for (r, z) in prof], segs=32, closed=True,
             offset=(M(sx * M6_GRID_X), M(sy * M6_GRID_Y), 0.0))
    ob = finish(PREFIX + 'm6_bolt_' + tag, bm, [MATERIALS['steel']], root)
    ob['cj_role'] = ('M6x%g socket head screw holding the CJ-PAD, head flush with the '
                     'graphite seat in a flat D11 counterbore' % M6_LEN)
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
    parts['plate'] = build_plate(root)
    parts['neck'] = build_neck(root)
    parts['platform'] = build_platform(root)
    parts['liner'] = build_liner(root)
    parts['tab'] = build_tab(root)
    for sx in (-1, 1):
        for sy in (-1, 1):
            tag = ('p' if sx > 0 else 'm') + ('p' if sy > 0 else 'm')
            parts['bolt_' + tag] = build_bolt(tag, sx, sy, root)

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
            z_lip = M(M8_CB_T + 1.0)       # над цековкой, внутри Ø9

            def open_up(x, y, z):
                return ray(plate, (x, y, z), (0, 0, 1), M(12.0)) is None

            def open_dn(x, y, z):
                return ray(plate, (x, y, z), (0, 0, -1), M(12.0)) is None

            through = open_up(cx, cy, z_lip) and open_dn(cx, cy, z_lip)
            dia = cb = None
            if open_dn(cx, cy, z_lip):
                ex = bisect(lambda o: open_dn(cx + o, cy, z_lip), 0.0, M(6.0))
                ey = bisect(lambda o: open_dn(cx, cy + o, z_lip), 0.0, M(6.0))
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

    pin_open = open_c(0.0, 0.0, M(1.0)) and ray(plate, (0.0, 0.0, M(1.0)),
                                               (0, 0, -1), M(12.0)) is None
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
                         'depth_mm': PLATE_T, 'role': 'D6.1 H7 bore over the D6 dowel of the carriage top plate'},
            'ok': ok}


def measure_pad(platform, liner, tab):
    holes = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = M(sx * M6_GRID_X), M(sy * M6_GRID_Y)
            z_mid = M(20.0)                # в платформе, ниже цековки

            def open_up(x, y, z):
                return ray(platform, (x, y, z), (0, 0, 1), M(20.0)) is None

            def open_dn(x, y, z):
                return ray(platform, (x, y, z), (0, 0, -1), M(20.0)) is None

            through = open_up(cx, cy, z_mid) and open_dn(cx, cy, z_mid)
            dia = cb = None
            if open_up(cx, cy, z_mid):
                ex = bisect(lambda o: open_up(cx + o, cy, z_mid), 0.0, M(6.0))
                ey = bisect(lambda o: open_up(cx, cy + o, z_mid), 0.0, M(6.0))
                dia = [round(ex * 2000, 2), round(ey * 2000, 2)]
            # плоская цековка Ø11 меряется внутри платформы на z=24
            z_cb = M(24.0)

            def cb_open(x, y):
                return ray(platform, (x, y, z_cb), (0, 0, 1), M(3.0)) is None

            if cb_open(cx, cy):
                ex = bisect(lambda o: cb_open(cx + o, cy), 0.0, M(7.0))
                ey = bisect(lambda o: cb_open(cx, cy + o), 0.0, M(7.0))
                cb = [round(ex * 2000, 2), round(ey * 2000, 2)]
            # плоское дно цековки: луч вниз на r=4 от оси (между Ø6,4 и Ø11)
            fl = ray(platform, (cx + M(4.0), cy, M(28.0)), (0, 0, -1), M(8.0))
            cb_floor = round(fl.z * 1000, 3) if fl else None
            holes.append({'id': 'M6_%s%s' % ('plus' if sx > 0 else 'minus',
                                             'plus' if sy > 0 else 'minus'),
                          'grid_mm': [sx * M6_GRID_X, sy * M6_GRID_Y],
                          'center_m': [round(cx, 5), round(cy, 5), round(M(LINER_Z1), 5)],
                          'through': through, 'dia_mm': dia,
                          'counterbore_mm': cb,
                          'counterbore_floor_z_mm': cb_floor})

    coords = sorted({tuple(h['grid_mm']) for h in holes})
    liner_top = ray(liner, (0.0, 0.0, M(35.0)), (0, 0, -1), M(15.0))
    # верх рамки — по плоской полке гнезда (y 21…22,5), а не по скруглению
    rim_samples = [ray(platform, (0.0, M(y), M(35.0)), (0, 0, -1), M(15.0))
                   for y in (-21.4, -21.75, -22.1)]
    rim_samples = [r for r in rim_samples if r is not None]
    rim_top = max(rim_samples, key=lambda v: v.z) if rim_samples else None
    lip = round((rim_top.z - liner_top.z) * 1000, 3) if (rim_top and liner_top) else None

    # гнездо 62x42 меряется выше ложа (z 29,2)
    rec = {}
    for tag, d in (('x', (1, 0, 0)), ('y', (0, 1, 0))):
        p = ray(platform, (0.0, 0.0, M(29.2)), d, M(40.0))
        rec[tag] = round(abs(getattr(p, 'x' if tag == 'x' else 'y')) * 1000, 3) if p else None
    # ложе 61,6x41,6 меряется ниже верхней кромки (z 27,4)
    lin = {}
    for tag, d in (('x', (1, 0, 0)), ('y', (0, 1, 0))):
        p = ray(liner, (0.0, 0.0, M(27.4)), d, M(40.0))
        lin[tag] = round(abs(getattr(p, 'x' if tag == 'x' else 'y')) * 1000, 3) if p else None

    tab_mn, tab_mx = bbox_of([tab])
    ok = (len(coords) == 4 and all(h['through'] for h in holes)
          and all(h['dia_mm'] and abs(h['dia_mm'][0] - M6_HOLE) <= 0.25
                  and abs(h['dia_mm'][1] - M6_HOLE) <= 0.25 for h in holes)
          and all(h['counterbore_mm'] and abs(h['counterbore_mm'][0] - M6_CB_D) <= 0.35
                  for h in holes)
          and all(h['counterbore_floor_z_mm'] is not None
                  and abs(h['counterbore_floor_z_mm'] - M6_CB_FLOOR) <= 0.2 for h in holes)
          and lip is not None and abs(lip - LIP_MM) <= 0.15
          and rec['x'] and rec['y'] and abs(rec['x'] * 2 - SEAT_X) <= 0.3
          and abs(rec['y'] * 2 - SEAT_Y) <= 0.3
          and lin['x'] and lin['y'] and abs(lin['x'] * 2 - LINER_X) <= 0.3
          and abs(lin['y'] * 2 - LINER_Y) <= 0.3
          and abs(tab_mx.z * 1000 - TAB_LIP_Z) <= 0.15)
    return {'grid_mm': [M6_GRID_X * 2, M6_GRID_Y * 2],
            'hole_grid_mm': [M6_GRID_X, M6_GRID_Y],
            'thread': 'M6', 'clearance_mm': M6_HOLE,
            'counterbore': {'dia_mm': M6_CB_D, 'depth_mm': M6_HEAD_K,
                            'floor_z_mm': M6_CB_FLOOR, 'bottom': 'flat'},
            'holes': holes, 'coords_distinct': len(coords),
            'z_range_mm': [PLAT_Z0, PLAT_Z1],
            'hole_z_range_mm': [PLAT_Z0, LINER_Z1],
            'seat': {'pocket_mm': [SEAT_X, SEAT_Y, SEAT_DEPTH],
                     'pocket_z_mm': [SEAT_Z0, SEAT_Z1],
                     'measured_pocket_mm': [round(rec['x'] * 2, 3) if rec['x'] else None,
                                            round(rec['y'] * 2, 3) if rec['y'] else None],
                     'liner_mm': [LINER_X, LINER_Y, LINER_T],
                     'measured_liner_mm': [round(lin['x'] * 2, 3) if lin['x'] else None,
                                           round(lin['y'] * 2, 3) if lin['y'] else None],
                     'liner_top_z_mm': round(liner_top.z * 1000, 3) if liner_top else None,
                     'rim_top_z_mm': round(rim_top.z * 1000, 3) if rim_top else None,
                     'lip_mm': lip, 'lip_spec_mm': LIP_MM,
                     'rim_roundover_mm': BEVEL_PLAT},
            'retention_tab': {'node': tab.name, 'width_mm': TAB_X1 - TAB_X0,
                              'overhang_mm': round(-TAB_Y0 - PLAT_Y * 0.5, 2),
                              'hook_top_z_mm': round(tab_mx.z * 1000, 2),
                              'hook_above_seat_mm': round(tab_mx.z * 1000 - LINER_Z1, 2),
                              'material': 'CJ_pad_accent_pink'},
            'ok': bool(ok)}


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
    pad = measure_pad(parts['platform'], parts['liner'], parts['tab'])

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
                    and abs(size.z - M(PLAT_Z1)) <= 0.0008 and abs(mn.z) <= 0.0008
                    and abs(mn.x + M(PLATE_X * 0.5)) <= 0.0008
                    and abs(mx.x - M(PLATE_X * 0.5)) <= 0.0008),
        'mass_kg_est': round(mass, 3),
        'plate': plate,
        'plate_pattern_ok': plate['ok'],
        'pad': pad,
        'pad_pattern_ok': pad['ok'],
        'volume_by_material_cm3': {k: round(v, 3) for k, v in vol_by_key.items()},
        'negative_scale': [ob.name for ob in meshes if ob.matrix_world.determinant() < 1e-9],
        'no_negative_scale': all(ob.matrix_world.determinant() > 1e-9 for ob in meshes),
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'state': 'adapter mounted, pad removed, 4x M6 fasteners in place',
        'animation': 'none (no actions; the tab is a passive spring clip)',
        'animation_ok': len(bpy.data.actions) == 0,
        'dof': {'pad_lift_mm': PLAT_Z1, 'tab_deflection_mm': 2.1,
                'note': 'static module: pad is lifted off the seat; the pink tab deflects '
                        'by ~2 mm to release the pad edge'},
        'dof_ok': True,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))
    return checks, dict(mn=mn, mx=mx, size=size, mass=mass, mats=mats, verts=verts,
                        tris=tris, per_obj=per_obj, plate=plate, pad=pad, vol=vol_by_key)


# --- report --------------------------------------------------------------
def build_report(root, checks, m):
    interfaces = {
        'rail_plate': {
            'role': 'bolts down onto the fix_carriage top plate (4x M8 + D6 pattern)',
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
            'compatibility': ('same 4x D9 on +-15 mm + centre D6.1 bore as the fix_carriage '
                              'top deck, fix_corner_node pads and fix_latch_adapter'),
        },
        'pad_seat': {
            'standard': 'CJ-PAD',
            'kind': 'flat seat 70x50 with a 62x42x4 pocket, graphite liner and 4x M6',
            'plane': 'XY at z=30 mm nominal; pad bearing plane z=%s mm (liner top)'
                     % m['pad']['seat']['liner_top_z_mm'],
            'plate_mm': [PLAT_X, PLAT_Y, PLAT_Z1 - PLAT_Z0],
            'z_range_mm': [PLAT_Z0, PLAT_Z1],
            'seat_pocket_mm': [SEAT_X, SEAT_Y, SEAT_DEPTH],
            'measured_pocket_mm': m['pad']['seat']['measured_pocket_mm'],
            'liner': {'node': PREFIX + 'pad_seat',
                      'material': 'CJ_pad_seat_graphite',
                      'size_mm': [LINER_X, LINER_Y, LINER_T],
                      'measured_size_mm': m['pad']['seat']['measured_liner_mm'],
                      'top_z_mm': m['pad']['seat']['liner_top_z_mm'],
                      'bond_gap_per_side_mm': round((SEAT_X - LINER_X) * 0.5, 2)},
            'rim': {'width_mm': round((PLAT_X - SEAT_X) * 0.5, 2),
                    'lip_above_liner_mm': m['pad']['seat']['lip_mm'],
                    'roundover_mm': BEVEL_PLAT},
            'm6': [{'id': h['id'], 'grid_mm': h['grid_mm'], 'center_m': h['center_m'],
                    'thread': 'M6', 'clearance_dia_mm': M6_HOLE,
                    'measured_dia_mm': h['dia_mm'],
                    'counterbore_mm': [M6_CB_D, M6_HEAD_K],
                    'measured_counterbore_mm': h['counterbore_mm'],
                    'counterbore_floor_z_mm': h['counterbore_floor_z_mm'],
                    'through': h['through']} for h in m['pad']['holes']],
            'pattern_mm': [M6_GRID_X * 2, M6_GRID_Y * 2],
            'coords_distinct': m['pad']['coords_distinct'],
            'fasteners': {'type': 'M6x%g countersunk socket screw' % M6_LEN,
                          'count': 4, 'material': 'CJ_pad_steel',
                          'head': 'flush with the graphite seat (z=%s)' % LINER_Z1},
            'retention': m['pad']['retention_tab'],
            'load_kn': 1.0,
            'wll_n': 1000,
        },
    }
    return {
        'id': CID,
        'code': 'CJ-PAD-ADAPTER',
        'name': 'Переходник подушки rail -> CJ-PAD',
        'kit': 'CJ-FIX-KIT',
        'class': 'INTERFACE / adapter',
        'standard_in': 'CJ-RAIL-45 (top plate pattern)',
        'standard_out': 'CJ-PAD',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_pad_adapter.py',
        'units': 'm',
        'spec': {
            'overall_mm': [PLATE_X, PLATE_Y, PLAT_Z1],
            'plate_mm': [PLATE_X, PLATE_Y, PLATE_T],
            'neck_mm': [NECK_X, NECK_Y, NECK_Z1 - NECK_Z0],
            'pad_plate_mm': [PLAT_X, PLAT_Y, PLAT_Z1 - PLAT_Z0],
            'seat_pocket_mm': [SEAT_X, SEAT_Y, SEAT_DEPTH],
            'm6': '4 x M6 (D6.4 through + flat D11x6 counterbore) on a %gx%g grid'
                  % (M6_GRID_X * 2, M6_GRID_Y * 2),
            'mass_kg_spec': 0.3,
            'material': 'Al adapter body / graphite pad seat / M6 steel screws / pink tab',
            'wll_n': 1000,
        },
        'bbox_m': {'min': [round(v, 5) for v in m['mn']],
                   'max': [round(v, 5) for v in m['mx']],
                   'size': [round(v, 5) for v in m['size']],
                   'nominal': [round(M(PLATE_X), 5), round(M(PLATE_Y), 5), round(M(PLAT_Z1), 5)],
                   'nominal_mm': [PLATE_X, PLATE_Y, PLAT_Z1],
                   'target_mm': [80.0, 60.0, 30.0],
                   'envelope_mm': {
                       'x': PLATE_X, 'y': PLATE_Y, 'z': PLAT_Z1,
                       'z_breakdown_mm': {'plate': PLATE_T, 'neck': NECK_Z1 - NECK_Z0,
                                          'pad_plate': PLAT_Z1 - PLAT_Z0},
                       'note': '8 плита + 8 шейка + 14 площадка = 30 мм; ориентир 80x60x30 '
                               'выдержан целиком, включая pink-защёлку (она в габарите плиты '
                               'по Y: -29,8 при -30).',
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
            'Габарит 80 x 60 x 30 мм = плита 8 + шейка 8 + площадка подушки 14. Ориентир '
            'выдержан без натяжек: X/Y задаёт плита (80x60), Z — стек 8/8/14.',
            'Плита несёт тот же паттерн, что top_plate каретки: 4 x Ø9 (M8) по сетке '
            '±15 мм с цековкой Ø15x4 снизу и центральное гнездо Ø6,1 под штифт Ø6 '
            'каретки (паттерн измерен лучами: Ø9,0 x4, цековка Ø15,0, центр Ø6,1).',
            'Площадка 70x50x14: посадочное гнездо 62x42 глубиной 4 мм, в него вклеено '
            'графитовое ложе 61,6x41,6x2,5. Верх ложа (z=28,5) — плоскость посадки '
            'подушки; над ним остаётся бортик 1,5 мм, а верхняя кромка площадки '
            'скруглена 2,5 мм — это и есть «мягкий бортик» под съёмную подушку.',
            '4 x M6 на сетке 44x26 (±22 / ±13): сквозное Ø6,4 + плоская цековка '
            'Ø11x6 с дном на z=22,5 (дно измерено лучами — цековка не сквозная). '
            'Винты M6x12 (сталь) сидят головкой Ø10 в цековке заподлицо с ложем, '
            'подушка ложится ровно.',
            'Pink-акцент — пружинная защёлка подушки на -Y кромке: язык 24 x 3 мм, '
            'вылет 4,3 мм за площадку, крючок поднимается на 2,1 мм над ложем и ловит '
            'борт подушки. Других цветных деталей нет.',
            'Подушка CJ-PAD в модуль не входит (сменный элемент): состояние модели — '
            'адаптер поставлен, подушка снята, крепёж M6 на месте.',
            'Масса по фактическим объёмам: %s кг (алюминий + графит + сталь) — '
            'спецификация набора 0,3 кг.' % round(m['mass'], 2),
        ],
        'deviations': [
            'Крепёж M8 не моделировался: Ø9 + цековка Ø15x4 снизу — тот же паттерн и та '
            'же оговорка, что у fix_latch_adapter. При плите 8 мм головка DIN 7991 '
            'встаёт заподлицо только с цековкой 4,4 мм, поэтому в каретке нужны '
            'резьбовые вставки M8 (в fix_carriage плита 4,75 мм — там то же).',
            'Резьба M6 в площадке не моделирована: отверстие показано как клиренс Ø6,4 '
            'с плоской цековкой Ø11x6 (паттерн меряется по нему). В металле — M6 в '
            'плите площадки либо резьбовая вставка на 6 мм глубины под цековкой.',
            'Защёлка подушки — пассивная пружинная пластина (ход ~2 мм), не замок: '
            'удержание подушки от сдвига, а не силовой фиксатор. Нагрузка 1,0 кН идёт '
            'через 4 x M6, защёлка её не несёт.',
            'Площадка подушки намеренно уже плиты (70x50 против 80x60): 5 мм свеса на '
            'сторону дают доступ к головкам M8 при монтаже на каретку.',
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
            ('key', (0.18, 0.24, 0.34), 4.2, 0.18),
            ('fill', (-0.26, 0.16, 0.16), 1.5, 0.26),
            ('rim', (-0.08, -0.26, 0.22), 2.8, 0.18),
            ('top', (0.02, 0.06, 0.42), 1.1, 0.24)):
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
    cam_data.clip_start = 0.01          # closeup стоит ближе 100 мм
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
    # closeup: площадка подушки — гнездо, ложе, 4 x M6, бортик и защёлка
    close_lo = Vector((M(-30.0), M(-31.5), M(23.5)))
    close_hi = Vector((M(10.0), M(2.0), M(31.0)))
    c_close = box_corners(close_lo, close_hi)
    close_t = (close_lo + close_hi) * 0.5

    views = [
        ('3q', (0.56, 0.66, 0.46), center, 62, c_main, 0.880, None),
        ('front', (0.04, 0.99, 0.20), center, 100, c_main, 0.885, None),
        ('side', (0.99, -0.12, 0.16), center, 100, c_main, 0.900, None),
        ('closeup', (0.32, -0.84, 0.44), close_t, 60, c_close, 0.860, (close_lo, close_hi)),
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
                     'px': [896, 896], 'fill': round(max_ndc(fill, region), 3),
                     'lens_mm': lens, 'dist_mm': round(dist * 1000, 1)})
        log('RENDERED', tag, fp, 'dist %.0f mm' % (dist * 1000))
    return outs


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    root, parts = build()
    log('nodes:', len(obj_mesh_objs(root)))
    checks, m = check(parts, root)
    log('bbox', checks['bbox_size_m'], '| mass', checks['mass_kg_est'],
        '| plate', [h['dia_mm'] for h in m['plate']['holes']],
        '| pin', m['plate']['pin_bore']['measured_dia_mm'],
        '| m6', [h['dia_mm'] for h in m['pad']['holes']],
        '| cb', [h['counterbore_mm'] for h in m['pad']['holes']],
        '| cb_floor', [h['counterbore_floor_z_mm'] for h in m['pad']['holes']],
        '| lip', m['pad']['seat']['lip_mm'],
        '| seat', m['pad']['seat']['measured_pocket_mm'],
        '| liner', m['pad']['seat']['measured_liner_mm'],
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
    root['cj_standard'] = 'CJ-PAD'
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_state'] = 'pad removed'
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
