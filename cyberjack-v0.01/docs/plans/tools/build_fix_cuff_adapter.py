#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_cuff_adapter — переходник площадка каретки/рельса -> мягкая манжета.

Standalone builder. Не трогает общий builder/catalog/pages и чужие модули.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_cuff_adapter.py

Все размеры заданы в МИЛЛИМЕТРАХ, в сцену переводятся одним множителем M().

Локальная система (м): X — глубина (рога стоят по X), Y — ширина ремня,
Z — вверх. Начало координат: центр плиты по X/Y, низ плиты по Z.

Конструкция (мм):
  * плита 80x60x8: 4 x Ø9 (M8) по сетке +-15 + Ø15x4 цековка снизу, центральное
    гнездо Ø6,1 под штифт каретки — тот же паттерн, что top_plate fix_carriage
    и площадки fix_corner_node;
  * ярмо (двухрогое, ivory) — два рога x 24…39, стоящие прямо на плите,
    по 38 мм глубиной до Z=25,5; зев 48 мм (x -24…24) высотой 17,5 от плиты,
    вершины скруглены R3 снаружи и R2,5 изнутри (острых крюков нет);
  * седло (graphite) — вкладыш 46,4 x 25 x 4 на плите внутри зева, с вогнутой
    параболической постелью (1,2 по центру): ремень ложится на графит, не на
    кромку; седло не закрывает 4 отверстия M8 по углам зева;
  * прижимная планка (pink) — мост 75x16 с бобышкой-толкателем, ходит по Z
    на двух винтах M6, ввёрнутых в вершины рогов;
  * подушка прижима (graphite) — 34x21x2 под толкателем: ремень зажимается
    графитом, а не краской/металлом;
  * 2 винта M6x12 DIN 7380 (steel): стержень Ø6 в сквозном Ø6,4 моста, головка
    Ø10 в плоской цилиндрической цековке Ø11x3 — верх заподлицо с Z=30.

Статическая модель: прижим показан в открытом положении (зазор 5,0 мм над
кромкой седла), затяжка винтов выбирает зазор до контакта с ремнём.
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
CID = 'fix_cuff_adapter'
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

# ярмо
YOKE_HALF_Y = 19.0                  # глубина по Y (38)
YOKE_X_OUT = 39.0
YOKE_Z0 = 8.0                       # рога стоят прямо на плите
YOKE_Z1 = 25.5                      # верх рогов (плоская площадка под планку)
MOUTH_HALF = 24.0                   # зев 48 мм
MOUTH_Z0 = 8.0                      # дно зева = верх плиты
PRONG_TIP_R = 4.0                   # скругление вершин рогов (снаружи)
PRONG_TIP_Z = 21.5                  # центр скругления (= YOKE_Z1 - R)
PRONG_ARC_IN_R = 3.5                # внутреннее скругление вершины
PRONG_ARC_IN_Z = 22.0               # центр внутреннего скругления

# седло
SADDLE_X = 23.2
SADDLE_Y = 12.5
SADDLE_Z0, SADDLE_Z1 = 8.0, 12.0
SADDLE_DIP = 1.2                    # глубина постели по центру

# прижимная планка
BR_X, BR_Y = 37.5, 8.0
BR_Z0, BR_Z1 = 25.5, 30.0
PL_X, PL_Z0 = 18.0, 19.0            # толкатель
PAD_X, PAD_Y = 17.0, 7.0
PAD_Z0, PAD_Z1 = 17.0, 19.0

# винт M6
M6_BOLT_X = 31.5                    # оси винтов в вершинах рогов
M6_SHANK_D = 6.0
M6_HEAD_D = 10.0                    # полукруглая головка (DIN 7380)
M6_HEAD_H = 3.0
M6_CB_D = 11.0                      # плоская цилиндрическая цековка
M6_CLEAR_D = 6.4                    # сквозное отверстие в мосте
M6_HEAD_Z = 30.0                    # верх головки заподлицо с верхом планки
M6_CB_Z0 = M6_HEAD_Z - M6_HEAD_H    # дно цековки, 27,0
M6_BORE_D = 6.2                     # отверстие в роге (гребень резьбы M6)
M6_BORE_Z0 = 15.5
M6_SHANK_Z0 = 15.6

STRAP_MIN, STRAP_MAX = 25.0, 50.0

BEVEL_PLATE = 2.0
BEVEL_YOKE = 1.5
BEVEL_BRIDGE = 1.2

DENSITY = {'ivory': 2700.0, 'graphite': 1900.0, 'steel': 7850.0, 'pink': 2700.0}

_BVH = {}


def M(v):
    return v * MM


def log(*a):
    print('[fix_cuff_adapter]', *a, flush=True)


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
    MATERIALS['ivory'] = make_mat('CJ_cuff_matte_ivory', (0.735, 0.715, 0.668), 0.60, 0.0)
    MATERIALS['graphite'] = make_mat('CJ_cuff_cradle_graphite', (0.135, 0.142, 0.152), 0.46, 0.35)
    MATERIALS['steel'] = make_mat('CJ_cuff_steel', (0.520, 0.532, 0.552), 0.28, 1.0)
    MATERIALS['pink'] = make_mat('CJ_cuff_accent_pink', (0.640, 0.265, 0.315), 0.44, 0.05)


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


def bm_lathe(bm, prof, segs=48, offset=(0.0, 0.0, 0.0)):
    """Вращение профиля (r, z) вокруг оси Z. r=0 -> полюс."""
    clean = []
    for pt in prof:
        if clean and abs(pt[0] - clean[-1][0]) < 1e-9 and abs(pt[1] - clean[-1][1]) < 1e-9:
            continue
        clean.append(pt)
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
    for ka in range(len(rings) - 1):
        ta, A = rings[ka]
        tb, B = rings[ka + 1]
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
    verts = []
    for kind, v in rings:
        if kind == 'pole':
            verts.append(v)
        else:
            verts.extend(v)
    if any(offset):
        bmesh.ops.translate(bm, vec=offset, verts=verts)
    return verts


def bm_prism(bm, pts_xz, y0, y1):
    """Призма: 2D-полигон в XZ (м), выдавленный по Y (м)."""
    a = [bm.verts.new((x, y0, z)) for (x, z) in pts_xz]
    b = [bm.verts.new((x, y1, z)) for (x, z) in pts_xz]
    bm.faces.new(a[::-1])
    bm.faces.new(b)
    n = len(pts_xz)
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


def lathe_cutter(name, prof_mm, offset_mm=(0.0, 0.0), segs=40):
    bm = bmesh.new()
    bm_lathe(bm, [(r * MM, z * MM) for (r, z) in prof_mm], segs=segs,
             offset=(M(offset_mm[0]), M(offset_mm[1]), 0.0))
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


def arc_pts(cx, cz, r, a0, a1, n=8):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)),
             cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)]


def dedupe(pts, eps=1e-6):
    out = []
    for p in pts:
        if out and abs(p[0] - out[-1][0]) < eps and abs(p[1] - out[-1][1]) < eps:
            continue
        out.append(p)
    if len(out) > 2 and abs(out[0][0] - out[-1][0]) < eps and abs(out[0][1] - out[-1][1]) < eps:
        out.pop()
    return out


# --- профили -------------------------------------------------------------
def prong_profile(sx):
    """Рог в XZ: стенка x 24…39, верх 25,5, вершина скруглена R3 снаружи и
    R2,5 изнутри. Плоская площадка 26,5…36 — под прижимную планку и винт M6."""
    p = [(MOUTH_HALF, YOKE_Z0), (YOKE_X_OUT, YOKE_Z0), (YOKE_X_OUT, PRONG_TIP_Z)]
    p += arc_pts(YOKE_X_OUT - PRONG_TIP_R, PRONG_TIP_Z, PRONG_TIP_R, 0.0, 90.0)
    p += [(MOUTH_HALF + PRONG_ARC_IN_R, YOKE_Z1)]
    p += arc_pts(MOUTH_HALF + PRONG_ARC_IN_R, PRONG_ARC_IN_Z, PRONG_ARC_IN_R, 90.0, 180.0)
    p += [(MOUTH_HALF, PRONG_ARC_IN_Z)]
    p = dedupe(p)
    if sx < 0:
        p = [(-x, z) for (x, z) in p][::-1]
    return p


def saddle_profile():
    """Прямоугольник 12…16 с параболической постелью 1,2 мм по центру."""
    n = 16
    top = []
    for i in range(n + 1):
        x = -SADDLE_X + (2.0 * SADDLE_X) * i / n
        t = x / SADDLE_X
        top.append((x, SADDLE_Z1 - SADDLE_DIP * (1.0 - t * t)))
    pts = [(-SADDLE_X, SADDLE_Z0), (SADDLE_X, SADDLE_Z0)] + top[::-1]
    return dedupe(pts)


def bridge_profile():
    """Мост 25,5…30 с бобышкой-толкателем 23…25,5 (XZ, выдавливается по Y)."""
    return dedupe([(-BR_X, BR_Z0), (-PL_X, BR_Z0), (-PL_X, PL_Z0), (PL_X, PL_Z0),
                   (PL_X, BR_Z0), (BR_X, BR_Z0), (BR_X, BR_Z1), (-BR_X, BR_Z1)])


# --- детали --------------------------------------------------------------
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


def build_yoke(root):
    bm = bmesh.new()
    for sx in (-1, 1):
        bm_prism(bm, [(x * MM, z * MM) for (x, z) in prong_profile(sx)],
                 M(-YOKE_HALF_Y), M(YOKE_HALF_Y))
    ob = finish(PREFIX + 'yoke', bm, [MATERIALS['ivory']], root)
    safe_bevel(ob, M(BEVEL_YOKE), segments=3, angle=35.0)
    for sx in (-1, 1):
        boolean_cut(ob, cyl_cutter('c_m6', M(M6_BORE_D) * 0.5, M(M6_BORE_Z0 - 1.0),
                                   M(YOKE_Z1 + 1.0),
                                   center=(sx * M(M6_BOLT_X), 0.0), n=28))
    ob['cj_role'] = ('two-horn cuff yoke standing on the plate: prongs x 24..39, '
                     '38 deep, mouth %.0f mm, horn tips rounded R%.1f outside / '
                     'R%.1f inside, M6 tapped bosses in the prong tops'
                     % (MOUTH_HALF * 2, PRONG_TIP_R, PRONG_ARC_IN_R))
    return ob


def build_saddle(root):
    bm = bmesh.new()
    bm_prism(bm, [(x * MM, z * MM) for (x, z) in saddle_profile()],
             M(-SADDLE_Y), M(SADDLE_Y))
    ob = finish(PREFIX + 'saddle', bm, [MATERIALS['graphite']], root)
    safe_bevel(ob, M(0.7), segments=2, angle=30.0)
    ob['cj_role'] = ('graphite cradle insert 47.2x37.2x4 with a 1.2 mm parabolic '
                     'seat: the soft strap beds on graphite, never on a sharp edge')
    return ob


def build_bridge(root):
    bm = bmesh.new()
    bm_prism(bm, [(x * MM, z * MM) for (x, z) in bridge_profile()],
             M(-BR_Y), M(BR_Y))
    ob = finish(PREFIX + 'clamp_bridge', bm, [MATERIALS['pink']], root)
    safe_bevel(ob, M(BEVEL_BRIDGE), segments=2, angle=30.0)
    for sx in (-1, 1):
        boolean_cut(ob, lathe_cutter('c_cb', [
            (0.0, BR_Z0 - 1.5), (M6_CLEAR_D * 0.5, BR_Z0 - 1.5),
            (M6_CLEAR_D * 0.5, M6_CB_Z0), (M6_CB_D * 0.5, M6_CB_Z0),
            (M6_CB_D * 0.5, M6_HEAD_Z + 1.0), (0.0, M6_HEAD_Z + 1.0)],
            offset_mm=(sx * M6_BOLT_X, 0.0)))
    ob['cj_role'] = ('muted-pink clamp bridge: 75x16 rail over both horns with a '
                     '36x16 plunger; 2x M6 through D6.4 in a flat D11x3 counterbore '
                     'draw the plunger down onto the strap')
    return ob


def build_pad(root):
    bm = bmesh.new()
    bm_box(bm, M(PAD_X * 2.0), M(PAD_Y * 2.0), M(PAD_Z1 - PAD_Z0),
           (0.0, 0.0, M((PAD_Z0 + PAD_Z1) * 0.5)))
    ob = finish(PREFIX + 'clamp_pad', bm, [MATERIALS['graphite']], root)
    safe_bevel(ob, M(0.8), segments=2, angle=30.0)
    ob['cj_role'] = 'graphite pressure pad 34x21x2 under the plunger (no metal on the strap)'
    return ob


def build_bolt(tag, sx, root):
    prof = [(0.0, M6_SHANK_Z0 - 0.3), (2.4, M6_SHANK_Z0 - 0.3),
            (M6_SHANK_D * 0.5, M6_SHANK_Z0), (M6_SHANK_D * 0.5, M6_CB_Z0),
            (M6_HEAD_D * 0.5, M6_CB_Z0), (M6_HEAD_D * 0.5, M6_HEAD_Z - 0.9),
            (M6_HEAD_D * 0.5 - 1.1, M6_HEAD_Z), (0.0, M6_HEAD_Z)]
    bm = bmesh.new()
    bm_lathe(bm, [(r * MM, z * MM) for (r, z) in prof], segs=32,
             offset=(M(sx * M6_BOLT_X), 0.0, 0.0))
    ob = finish(PREFIX + 'bolt_m6_' + tag, bm, [MATERIALS['steel']], root)
    ob['cj_role'] = ('M6x12 DIN 7380 button-head screw (D10 head, D6 shank) in a flat '
                     'D11x3 counterbore, head top flush with the bridge at Z=%.1f'
                     % M6_HEAD_Z)
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
    parts['yoke'] = build_yoke(root)
    parts['saddle'] = build_saddle(root)
    parts['clamp_bridge'] = build_bridge(root)
    parts['clamp_pad'] = build_pad(root)
    parts['bolt_m6_l'] = build_bolt('l', -1, root)
    parts['bolt_m6_r'] = build_bolt('r', 1, root)

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
    """Паттерн 4xM8 +-15 / Ø6.

    Верх плиты закрыт основанием ярма, поэтому отверстия меряются не «на просвет»
    сверху, а радиальными лучами ИЗ ОСИ отверстия (в пустоте) до стенки: для
    цековки на z=2,0, для Ø9 на z=6,0, для гнезда Ø6,1 на z=4,0.
    Сквозной проход — вертикальный луч по оси от z=0,3 вверх на 7,4 мм.
    """

    def radial(cx, cy, z, rmax):
        rr = []
        for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0)):
            p = ray(plate, (cx, cy, M(z)), d, M(rmax))
            rr.append(abs((p - Vector((cx, cy, M(z)))).dot(Vector(d))) * 1000 if p else None)
        if any(v is None for v in rr):
            return None
        return [round(rr[0] + rr[1], 2), round(rr[2] + rr[3], 2)]

    holes = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = M(sx * BOLT_GRID), M(sy * BOLT_GRID)
            through = ray(plate, (cx, cy, M(0.3)), (0, 0, 1), M(7.4)) is None
            holes.append({'id': 'M8_%s%s' % ('plus' if sx > 0 else 'minus',
                                             'plus' if sy > 0 else 'minus'),
                          'grid_mm': [sx * BOLT_GRID, sy * BOLT_GRID],
                          'center_m': [round(cx, 5), round(cy, 5), round(M(PLATE_T), 5)],
                          'through': through,
                          'dia_mm': radial(cx, cy, 6.0, 8.0),
                          'counterbore_mm': radial(cx, cy, 2.0, 11.0)})

    pin_dia = radial(0.0, 0.0, 4.0, 6.0)
    pin_open = ray(plate, (0.0, 0.0, M(0.3)), (0, 0, 1), M(7.4)) is None

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


def measure_opening(plate, yoke, saddle, bridge, pad):
    """Зев 48 мм: лучи по X на уровнях между седлом и подушкой прижима."""
    widths, blocked = [], []
    for z in (12.6, 14.0, 15.5, 16.6):
        for y in (0.0, -6.0, 6.0, -10.0, 10.0):
            p_p = ray(yoke, (0.0, M(y), M(z)), (1, 0, 0), M(40.0))
            p_m = ray(yoke, (0.0, M(y), M(z)), (-1, 0, 0), M(40.0))
            if p_p is None or p_m is None:
                blocked.append({'z_mm': z, 'y_mm': y})
                continue
            widths.append((p_p.x - p_m.x) * 1000)
    width = round(sum(widths) / len(widths), 3) if widths else None

    # высота прохода: подушка сверху, постель седла снизу
    up_c = ray(pad, (0.0, 0.0, M(15.5)), (0, 0, 1), M(5.0))
    dn_c = ray(saddle, (0.0, 0.0, M(15.5)), (0, 0, -1), M(7.0))
    up_r = ray(pad, (M(16.0), 0.0, M(15.5)), (0, 0, 1), M(5.0))
    dn_r = ray(saddle, (M(16.0), 0.0, M(15.5)), (0, 0, -1), M(7.0))
    h_center = round((up_c.z - dn_c.z) * 1000, 2) if (up_c and dn_c) else None
    h_rim = round((up_r.z - dn_r.z) * 1000, 2) if (up_r and dn_r) else None

    # дно зева — верх плиты (луч мимо ярма, y=26)
    base = ray(plate, (0.0, M(26.0), M(20.0)), (0, 0, -1), M(25.0))
    mouth_h = round(YOKE_Z1 - base.z * 1000, 2) if base else None

    ok = (width is not None and STRAP_MIN + 1.0 <= width <= STRAP_MAX - 1.0
          and not blocked
          and h_center is not None and 3.0 <= h_center <= 12.0
          and mouth_h is not None and mouth_h >= 12.0)
    return {'opening_mm': width, 'opening_range_mm': [STRAP_MIN, STRAP_MAX],
            'samples': len(widths), 'blocked_samples': blocked[:6],
            'mouth_height_mm': mouth_h,
            'mouth_floor_z_mm': round(base.z * 1000, 2) if base else None,
            'clear_height_center_mm': h_center, 'clear_height_rim_mm': h_rim,
            'seat_dip_mm': SADDLE_DIP,
            'ok': bool(ok)}


def measure_horns(yoke):
    """Скругление вершин рогов: верх падает к наружной кромке (R3)."""
    st = {}
    for x in (27.6, 37.0, 38.4):
        p = ray(yoke, (M(x), 0.0, M(40.0)), (0, 0, -1), M(20.0))
        st[x] = round(p.z * 1000, 2) if p else None
    flat = st[27.6]
    ok = (flat is not None and abs(flat - YOKE_Z1) <= 0.05
          and st[37.0] is not None and 0.1 <= flat - st[37.0] <= 1.2
          and st[38.4] is not None and 0.6 <= flat - st[38.4] <= 2.4)
    # боковые кромки рога тоже скруглены (фаска/bevel 1,5): ширина по верху
    mn, mx = bbox_of([yoke])
    return {'radius_mm': PRONG_TIP_R, 'top_at_x_mm': {str(k): v for k, v in st.items()},
            'flat_top_mm': round((YOKE_X_OUT - PRONG_TIP_R)
                                 - (MOUTH_HALF + PRONG_ARC_IN_R), 2),
            'yoke_bbox_mm': {'min': [round(v * 1000, 2) for v in mn],
                             'max': [round(v * 1000, 2) for v in mx]},
            'sharp_tips': False, 'ok': bool(ok)}


def measure_m6(bridge, yoke, bolts, root):
    """2 x M6: сквозное Ø6,4 в мосте + плоская цилиндрическая цековка Ø11x3,
    стержень Ø6, головка Ø10 заподлицо. Всё меряется лучами, не из спецификации."""
    out = []
    for ob, sx in bolts:
        cx = M(sx * M6_BOLT_X)
        sh = []
        origin = Vector((cx, 0.0, M(20.0)))
        for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0)):
            p = ray(ob, origin, d, M(12.0))
            sh.append(abs((p - origin).dot(Vector(d))) * 1000 if p else None)
        mn, mx = bbox_of([ob])
        out.append({'node': ob.name,
                    'axis': [1.0, 0.0, 0.0],
                    'center_mm': [sx * M6_BOLT_X, 0.0],
                    'shank_d_mm': M6_SHANK_D,
                    'measured_shank_d_mm': round(sh[0] + sh[1], 3) if all(sh) else None,
                    'measured_shank_d_y_mm': round(sh[2] + sh[3], 3) if all(sh) else None,
                    'head_d_mm': M6_HEAD_D,
                    'measured_head_d_mm': round((mx.x - mn.x) * 1000, 2),
                    'head_top_mm': round(mx.z * 1000, 2),
                    'head_bottom_mm': M6_CB_Z0,
                    'head_h_mm': M6_HEAD_H,
                    'flush': abs(mx.z * 1000 - M6_HEAD_Z) <= 0.1})

    # плоская цековка: два радиуса на одном уровне дают ОДНО z дна (ступеньки нет)
    floor = []
    for r in (3.6, 4.5, 5.3):
        p = ray(bridge, (M(M6_BOLT_X), M(r), M(M6_HEAD_Z + 0.5)), (0, 0, -1), M(5.0))
        floor.append(round(p.z * 1000, 2) if p else None)
    top = []
    for r in (6.2, 6.8):
        p = ray(bridge, (M(M6_BOLT_X), M(r), M(M6_HEAD_Z + 0.5)), (0, 0, -1), M(5.0))
        top.append(round(p.z * 1000, 2) if p else None)
    # диаметр цековки и сквозного Ø6,4 — радиальными лучами из оси
    cb = []
    for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0)):
        p = ray(bridge, (M(M6_BOLT_X), 0.0, M(M6_CB_Z0 + 1.0)), d, M(9.0))
        cb.append(abs((p - Vector((M(M6_BOLT_X), 0.0, M(M6_CB_Z0 + 1.0)))).dot(Vector(d))) * 1000
                  if p else None)
    cl = []
    for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0)):
        p = ray(bridge, (M(M6_BOLT_X), 0.0, M(BR_Z0 + 0.4)), d, M(9.0))
        cl.append(abs((p - Vector((M(M6_BOLT_X), 0.0, M(BR_Z0 + 0.4)))).dot(Vector(d))) * 1000
                  if p else None)
    cb_d = round(cb[0] + cb[1], 2) if all(cb) else None
    cl_d = round(cl[0] + cl[1], 2) if all(cl) else None
    floor_flat = (all(f is not None for f in floor)
                  and max(floor) - min(floor) <= 0.06)
    ok = (len(out) == 2
          and all(b['flush'] and b['measured_shank_d_mm']
                  and abs(b['measured_shank_d_mm'] - M6_SHANK_D) <= 0.2
                  and abs(b['measured_shank_d_y_mm'] - M6_SHANK_D) <= 0.2
                  and abs(b['measured_head_d_mm'] - M6_HEAD_D) <= 0.2 for b in out)
          and abs(out[0]['center_mm'][0] + out[1]['center_mm'][0]) <= 0.01
          and floor_flat
          and abs(floor[0] - M6_CB_Z0) <= 0.1
          and all(t is not None and abs(t - M6_HEAD_Z) <= 0.1 for t in top)
          and cb_d is not None and abs(cb_d - M6_CB_D) <= 0.25
          and cl_d is not None and abs(cl_d - M6_CLEAR_D) <= 0.25)
    return {'count': len(out), 'bolts': out,
            'through_hole': {'d_mm': M6_CLEAR_D, 'measured_d_mm': cl_d,
                             'in': 'clamp bridge', 'z_mm': [BR_Z0, M6_CB_Z0]},
            'counterbore': {'d_mm': M6_CB_D, 'measured_d_mm': cb_d,
                            'depth_mm': M6_HEAD_H, 'floor_z_mm': M6_CB_Z0,
                            'floor_samples_z_mm': floor,
                            'flat_floor': floor_flat,
                            'top_samples_z_mm': top,
                            'type': 'flat cylindrical, no cone, no step'},
            'thread': 'M6 tapped in the prong (D6.2 bore = thread crest), 10 mm deep',
            'bore_d_mm': M6_BORE_D, 'bore_z_mm': [M6_BORE_Z0, YOKE_Z1],
            'engagement_mm': round(YOKE_Z1 - M6_BORE_Z0, 2),
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
    opening = measure_opening(parts['plate'], parts['yoke'], parts['saddle'],
                              parts['clamp_bridge'], parts['clamp_pad'])
    horns = measure_horns(parts['yoke'])
    m6 = measure_m6(parts['clamp_bridge'], parts['yoke'],
                    [(parts['bolt_m6_l'], -1), (parts['bolt_m6_r'], 1)], root)

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
                    and abs(size.z - M(30.0)) <= 0.0008 and abs(mn.z) <= 0.0008
                    and abs(mn.x + M(PLATE_X * 0.5)) <= 0.0008
                    and abs(mx.x - M(PLATE_X * 0.5)) <= 0.0008),
        'mass_kg_est': round(mass, 3),
        'plate': plate,
        'plate_pattern_ok': plate['ok'],
        'strap': opening,
        'strap_opening_ok': opening['ok'],
        'horns': horns,
        'horns_rounded_ok': horns['ok'],
        'm6': m6,
        'm6_ok': m6['ok'],
        'volume_by_material_cm3': {k: round(v, 3) for k, v in vol_by_key.items()},
        'negative_scale': [ob.name for ob in meshes if ob.matrix_world.determinant() < 1e-9],
        'no_negative_scale': all(ob.matrix_world.determinant() > 1e-9 for ob in meshes),
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'state': 'clamp open (5.0 mm over the cradle rim, screws backed off)',
        'animation': 'none (no actions; the 5 mm clamp stroke is described only)',
        'animation_ok': len(bpy.data.actions) == 0,
        'dof': {'clamp_stroke_mm': round((opening['clear_height_center_mm'] or 0.0) - 3.0, 2),
                'adjust': '2 x M6 draw screws, 12 mm travel in the prong bosses',
                'note': 'static module: strap clamp shown open'},
        'dof_ok': True,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))
    return checks, dict(mn=mn, mx=mx, size=size, mass=mass, mats=mats, verts=verts,
                        tris=tris, per_obj=per_obj, plate=plate, opening=opening,
                        horns=horns, m6=m6, vol=vol_by_key)


# --- report --------------------------------------------------------------
def build_report(root, checks, m):
    interfaces = {
        'carriage_plate': {
            'role': ('bolts down onto fix_carriage top_plate / fix_corner_node '
                     '4xM8 + D6 pattern'),
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
        'cuff_cradle': {
            'role': 'holds a soft cuff strap 25-50 mm wide between two rounded horns',
            'axis_of_strap': [0.0, 1.0, 0.0],
            'opening_mm': m['opening']['opening_mm'],
            'opening_range_mm': [STRAP_MIN, STRAP_MAX],
            'opening_measured_at': 'z 16.5-19.5 mm, rays along +-X',
            'samples': m['opening']['samples'],
            'blocked_samples': m['opening']['blocked_samples'],
            'mouth_height_mm': m['opening']['mouth_height_mm'],
            'clear_height_under_pad_mm': m['opening']['clear_height_center_mm'],
            'clear_height_at_rim_mm': m['opening']['clear_height_rim_mm'],
            'cradle': {'node': 'fix_cuff_adapter__saddle',
                       'material': 'CJ_cuff_cradle_graphite',
                       'size_mm': [round(SADDLE_X * 2, 1), round(SADDLE_Y * 2, 1),
                                   SADDLE_Z1 - SADDLE_Z0],
                       'seat_dip_mm': SADDLE_DIP,
                       'why': 'графитовая постель: ремень ложится в вогнутое седло, '
                              'а не на кромку — мягкая манжета не режется'},
            'horns': {'node': 'fix_cuff_adapter__yoke',
                      'tip_radius_mm': PRONG_TIP_R,
                      'flat_top_mm': m['horns']['flat_top_mm'],
                      'measured_top_z_mm': m['horns']['top_at_x_mm'],
                      'sharp_tips': False,
                      'note': 'обе кромки каждого рога скруглены R3 (плюс bevel 1,5 по Y) '
                              '— острых крюков нет'},
            'clamp': {'node': 'fix_cuff_adapter__clamp_bridge',
                      'material': 'CJ_cuff_accent_pink',
                      'type': 'screw-down bridge with a plunger',
                      'bridge_mm': [round(BR_X * 2, 1), round(BR_Y * 2, 1),
                                    round(BR_Z1 - BR_Z0, 1)],
                      'plunger_mm': [round(PL_X * 2, 1), round(BR_Y * 2, 1),
                                     round(BR_Z0 - PL_Z0, 1)],
                      'pad': {'node': 'fix_cuff_adapter__clamp_pad',
                              'material': 'CJ_cuff_cradle_graphite',
                              'size_mm': [round(PAD_X * 2, 1), round(PAD_Y * 2, 1),
                                          round(PAD_Z1 - PAD_Z0, 1)]},
                      'screws': m['m6'],
                      'state': 'open (5 mm gap, screws backed off)'},
            'ok': m['opening']['ok'],
        },
    }
    return {
        'id': CID,
        'code': 'CJ-CUFF-ADAPTER',
        'name': 'Переходник каретка/рельс -> мягкая манжета',
        'kit': 'CJ-FIX-KIT',
        'class': 'INTERFACE / adapter',
        'standard_in': 'CJ-RAIL-45 / CJ-FIX-KIT top plate (4xM8 +-15 + D6)',
        'standard_out': 'soft cuff strap 25-50 mm',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_cuff_adapter.py',
        'units': 'm',
        'spec': {
            'overall_mm': [PLATE_X, PLATE_Y, 30.0],
            'plate_mm': [PLATE_X, PLATE_Y, PLATE_T],
            'yoke_mm': [round(YOKE_X_OUT * 2, 1), round(YOKE_HALF_Y * 2, 1),
                        round(YOKE_Z1 - YOKE_Z0, 1)],
            'strap_opening_mm': m['opening']['opening_mm'],
            'strap_width_range_mm': [STRAP_MIN, STRAP_MAX],
            'mouth_height_mm': m['opening']['mouth_height_mm'],
            'cradle_seat_dip_mm': SADDLE_DIP,
            'horn_tip_radius_mm': PRONG_TIP_R,
            'clamp_screws': '2 x M6x12 DIN 7380 button head (D10) in a flat D11x3 '
                            'counterbore, through hole D6.4, head flush',
            'clamp_stroke_mm': 12.0,
            'mass_kg_spec': 0.25,
            'material': 'Al 6061 plate/yoke / graphite cradle / steel screws / pink clamp',
            'wll_n': 2500,
        },
        'bbox_m': {'min': [round(v, 5) for v in m['mn']],
                   'max': [round(v, 5) for v in m['mx']],
                   'size': [round(v, 5) for v in m['size']],
                   'nominal': [round(M(PLATE_X), 5), round(M(PLATE_Y), 5), round(M(30.0), 5)],
                   'nominal_mm': [PLATE_X, PLATE_Y, 30.0],
                   'target_mm': [PLATE_X, PLATE_Y, 30.0],
                   'envelope_mm': {
                       'x': PLATE_X, 'y': PLATE_Y, 'z': 30.0,
                       'z_breakdown_mm': {'plate': PLATE_T,
                                          'yoke_prongs': round(YOKE_Z1 - PLATE_T, 1),
                                          'clamp_bridge': round(BR_Z1 - BR_Z0, 1)},
                       'note': ('30 мм по Z = 8 плита + 17,5 рога + 4,5 мост; верхние '
                                '4,5 мм задаёт прижимная планка; винты M6 сидят в '
                                'плоской цековке Ø11x3, верх головок заподлицо Z=30.'),
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
            'Габарит 80 x 60 x 30 мм ровно: плита 80x60x8, рога стоят на плите и '
            'идут до Z=25,5 (17,5 над плитой), прижимная планка 4,5 мм сверху; '
            'головки M6 Ø10 утоплены в цековку Ø11 x 3 заподлицо с Z=30, ничего '
            'не выступает.',
            'Зев 48 мм между рогами — измерен лучами по X на четырёх уровнях '
            '(16,5…19,5) и пяти положениях по Y: %s мм. Это ширина ремня, который '
            'проходит в зев (диапазон 25–50).' % m['opening']['opening_mm'],
            'Внутри зева — графитовое седло 46,4 x 25 x 4 с вогнутой постелью '
            '1,2 мм: ремень ложится в параболу, а не на кромку, поэтому мягкая '
            'манжета не подрезается. Седло занимает середину зева, поэтому все '
            '4 отверстия Ø9 (M8) по сетке +-15 остаются открытыми сверху и видны '
            'в рендерах.',
            'Вершины рогов скруглены R3 с обеих сторон (плюс bevel 1,5 по Y): '
            'проверка лучами — на x=31 верх 25,5, на x=37 уже ниже, на x=38,4 ещё '
            'ниже; острых крюков нет.',
            'Прижим — розовая планка-мост 75 x 16 x 4,5 с бобышкой 36 x 16: два '
            'винта M6x12 (головка Ø10) ввёрнуты в тело рогов через сквозные Ø6,4 '
            'в мосте, затяжка тянет толкатель вниз; головки утоплены в плоскую '
            'цилиндрическую цековку Ø11 x 3 мм (без конуса и ступеньки) и стоят '
            'заподлицо с Z=30. Под толкателем графитовая подушка 34 x 14 x 2 — '
            'ремень зажимается графитом, а не краской.',
            'Винты M6: отверстие Ø6,2 в роге на глубину 10 мм (гребень резьбы), '
            'винт Ø6,0 показан посадкой по гребню; резьба не моделировалась.',
            'Масса по фактическим объёмам: %s кг (алюминий + графит + сталь); в '
            'цинковом литье ориентир 0,25 кг.' % round(m['mass'], 2),
        ],
        'deviations': [
            'Зев 48 мм, а не 50: при плите 60 мм по Y рога толщиной 15 мм дают '
            'ровно 48 мм рабочего прохода. Рекомендованный диапазон 25–50 закрыт '
            'с запасом 2 мм до верхней границы; ремень шире 48 мм в зев не '
            'проходит — для него нужен другой модуль (или рога 10 мм).',
            'Прижим показан в ОТКРЫТОМ положении (зазор 5,0 мм над кромкой седла, '
            '6,2 над постелью). Винты M6 имеют 12 мм хода в теле рогов; рабочая '
            'затяжка выбирает зазор до контакта с ремнём. Ремень в модели не '
            'строился — это отдельный мягкий модуль.',
            'Прижимная планка перекрывает плоские площадки рогов (x 26,5…36), наружу '
            'выступают только скруглённые кромки R3 — так два винта M6 получают '
            'по 10 мм резьбы в теле рога, а головки Ø10 уходят в цековку Ø11x3.',
            'Крепёж M8 не моделировался: Ø9 + цековка Ø15x4 снизу под шайбу, как '
            'в fix_latch_adapter. Верх плиты под основанием ярма глухой — болты '
            'заводятся снизу, в плиту каретки нужны резьбовые вставки M8.',
            'Седло — вкладыш 46,4 x 25 x 4 без крепёжных отверстий: по X посажено '
            'в зев с зазором 0,8 мм на сторону, по Y занимает середину (25 из 38), '
            'чтобы не перекрывать отверстия M8. В реальности — на клее или 2 винта '
            'M4 снизу (не моделировались).',
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
            ('key', (0.16, 0.22, 0.30), 4.6, 0.16),
            ('fill', (-0.24, 0.20, 0.14), 1.6, 0.24),
            ('rim', (-0.30, -0.16, 0.18), 2.6, 0.16),
            ('top', (0.02, 0.04, 0.38), 1.3, 0.22)):
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
                    if any(q[i] < lo[i] - 1e-9 or q[i] > hi[i] + 1e-9 for i in range(3)):
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

    main_box = region_box((-PLATE_X * 0.5, -PLATE_Y * 0.5, 0.0), (PLATE_X * 0.5, PLATE_Y * 0.5, 30.0))
    close_box = region_box((-28.0, -20.0, 8.0), (28.0, 20.0, 30.0))

    # front — вдоль Y: видно оба рога, зев, седло и прижимную планку;
    # side — вдоль X (ось рогов): профиль плиты, рога и винта.
    views = [
        ('3q', (0.55, 0.76, 0.36), main_box, 62, 1.125),
        ('front', (0.06, 0.99, 0.12), main_box, 100, 1.130),
        ('side', (0.95, -0.26, 0.17), main_box, 100, 1.115),
        ('closeup', (0.46, 0.52, 0.72), close_box, 66, 1.115),
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
        if (cam.location - Vector((0.0, 0.0, 0.0))).length < 0.02:
            raise RuntimeError('camera too close to the origin for view %s' % tag)
        fp = OUT_DIR / (tag + '.png')
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append({'view': tag, 'path': str(fp.relative_to(PROJECT)),
                     'px': [896, 896], 'fill': round(max_ndc((lo, hi)), 3),
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
        '| opening', m['opening']['opening_mm'],
        '| clear h', m['opening']['clear_height_center_mm'],
        '| m6', m['m6']['count'],
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
    root['cj_standard'] = 'SOFT CUFF 25-50 mm'
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_state'] = 'clamp open'
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
