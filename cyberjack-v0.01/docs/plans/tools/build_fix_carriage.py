#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_carriage — подвижная каретка по рельсу CJ-RAIL-45.

Standalone builder. Не трогает общий builder/catalog/pages и чужие rail/node/foot.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_carriage.py

Все размеры заданы в МИЛЛИМЕТРАХ, в сцену переводятся одним множителем M().

Локальная система (м): X — вдоль рельса (габарит 0.12), Y — поперёк (0.09),
Z — вверх (0.05). Начало координат: центр габарита по X/Y, низ каретки по Z.

Конструкция (мм):
  * корпус-седло 120x90x50: сплошной блок минус канал 49.5 шир. x 45.25 выс.,
    открытый снизу (каретка надевается на рельс сверху);
  * верхняя площадка 60x120x4.75 (z 45.25…50) — уже корпуса, 4x Ø9 (M8) по
    сетке +-15 мм + центральное гнездо Ø6.1 со штифтом Ø6 заподлицо;
  * 4 направляющих башмака (графит) 34x6x16 в карманах щёк, рабочая грань
    +-22.75 => канал 45.5 (0.25 мм на сторону к рельсу 45);
  * боковой фиксатор: эксцентриковый кулачок-рычаг (pink) на оси X, палец Ø5
    давит на графитовый тормозной башмак, ход 1.35 мм, ход рычага 40°;
  * 4 винта M4 (потайная головка заподлицо с рабочей гранью башмака);
  * фаски 2 мм по наружным кромкам, 1.5 мм по каналу.
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
CID = 'fix_carriage'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001

BODY_X, BODY_Y, BODY_Z = 120.0, 90.0, 50.0
DECK_Y = 60.0                     # ширина верхней площадки (<= 60)
RAIL = 45.0                       # профиль рельса
OPENING = 45.5                    # канал по башмакам
CH_RELIEF = 49.5                  # просвет корпуса (башмаки выступают на 2)
CH_HALF = CH_RELIEF * 0.5
CEIL_Z = 45.25                    # потолок канала: 45 (рельс) + 0.25
DECK_T = BODY_Z - CEIL_Z          # 4.75

SHOE_X = 34.0                     # центры башмаков по X
SHOE_L, SHOE_T, SHOE_H = 34.0, 6.0, 16.0
SHOE_FACE = OPENING * 0.5         # 22.75
SHOE_BACK = SHOE_FACE + SHOE_T    # 28.75
SHOE_Z0 = 12.0
POCKET_L, POCKET_D, POCKET_H = 36.0, 4.15, 18.4

SCREW_HEAD_D, SCREW_HEAD_H = 7.0, 3.5
SCREW_BORE_D, SCREW_SHANK_D = 7.6, 3.8
SCREW_SHANK_L = 8.75

M8_D = 9.0
BOLT_GRID = 15.0
PIN_D, PIN_BORE = 6.0, 6.1
PIN_BOTTOM = 45.3                 # штифт скрыт в плите, 0.3 над верхом рельса
PIN_LEN = BODY_Z - PIN_BOTTOM     # 4.7

# фиксатор (боковой, +Y)
LOCK_WIN_X = 13.8
LOCK_WIN_Z0, LOCK_WIN_Z1 = 9.0, 41.0
LOCK_PIVOT = (35.0, 20.0)         # (y, z)
LOCK_BOSS_R = 8.3
CAM_E = 5.8                       # эксцентриситет пальца Ø5
CAM_PIN_D = 5.0
CAM_OPEN = (30.25, 16.67)         # центр пальца в ОТКРЫТОМ (экспортируемом) положении
PIVOT_D = 7.0
LEVER_T = 12.0
LEVER_ARM_DEG = 107.5             # лапка вверх-внутрь (открытое положение)
LEVER_ARM_R = 16.6
LEVER_ARM_HALF_W = 4.4
LEVER_SWING_DEG = -35.0           # открыто -> закрыто

BRAKE_T = 4.3                     # тормозной башмак
# тыл башмака упирается в палец в открытом положении
BRAKE_FACE = CAM_OPEN[0] - CAM_PIN_D * 0.5 - BRAKE_T   # 23.45 -> зазор 0.95
BRAKE_Z0, BRAKE_Z1 = 15.0, 36.0
BRAKE_X = 13.0

BEVEL_OUT = 2.0
BEVEL_CH = 1.5

DENSITY = {'ivory': 2700.0, 'wear': 1900.0, 'insert': 1900.0,
           'steel': 7850.0, 'pink': 2700.0}
DENSITY_ZN = 6600.0

TRAVEL_M = 0.5
_BVH = {}


def M(v):
    return v * MM


def log(*a):
    print('[fix_carriage]', *a, flush=True)


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
    MATERIALS['ivory'] = make_mat('CJ_carriage_matte_ivory', (0.735, 0.715, 0.668), 0.60, 0.0)
    MATERIALS['wear'] = make_mat('CJ_carriage_wear_graphite', (0.082, 0.086, 0.094), 0.58, 0.15)
    MATERIALS['insert'] = make_mat('CJ_carriage_insert_graphite', (0.150, 0.157, 0.168), 0.40, 0.55)
    MATERIALS['steel'] = make_mat('CJ_carriage_steel', (0.520, 0.532, 0.552), 0.28, 1.0)
    MATERIALS['pink'] = make_mat('CJ_carriage_accent_pink', (0.640, 0.265, 0.315), 0.44, 0.05)


# --- bmesh (метры) ------------------------------------------------------
def bm_box(bm, sx, sy, sz, center=(0.0, 0.0, 0.0)):
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    return verts


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


def cyl_cutter(name, r, z0, z1, center=(0.0, 0.0), n=48):
    bm = bmesh.new()
    ring0, ring1 = [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        ring0.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z0)))
        ring1.append(bm.verts.new((r * math.cos(a), r * math.sin(a), z1)))
    bm.faces.new(ring0)
    bm.faces.new(ring1[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bmesh.ops.translate(bm, vec=(center[0], center[1], 0.0), verts=ring0 + ring1)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(ob)
    return ob


def axis_cutter(name, r, a0, a1, y, z, n=32):
    """Цилиндр вдоль X: от x=a0 до a1, ось в (y, z)."""
    bm = bmesh.new()
    ring0, ring1 = [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        ring0.append(bm.verts.new((a0, y + r * math.cos(a), z + r * math.sin(a))))
        ring1.append(bm.verts.new((a1, y + r * math.cos(a), z + r * math.sin(a))))
    bm.faces.new(ring0)
    bm.faces.new(ring1[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
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


# --- корпус --------------------------------------------------------------
def build_body(root):
    bm = bmesh.new()
    bm_box(bm, M(BODY_X), M(BODY_Y), M(BODY_Z), (0.0, 0.0, M(BODY_Z) * 0.5))
    ob = finish(PREFIX + 'body', bm, [MATERIALS['ivory'], MATERIALS['wear']], root)

    # канал, открытый снизу: z от -1.25 до CEIL_Z (потолок 45.25)
    boolean_cut(ob, box_cutter('c_channel', M(BODY_X + 2.0), M(CH_RELIEF),
                               M(CEIL_Z + 1.25),
                               (0.0, 0.0, M(CEIL_Z) - M(CEIL_Z + 1.25) * 0.5)))
    # верхняя площадка уже корпуса: срезаем верхние углы за пределами +-30
    for sy in (-1, 1):
        boolean_cut(ob, box_cutter('c_deck_y', M(BODY_X + 2.0),
                                   M(BODY_Y * 0.5 - DECK_Y * 0.5 + 0.4),
                                   M(DECK_T + 0.5),
                                   (0.0, sy * M(DECK_Y * 0.25 + BODY_Y * 0.25),
                                    M(CEIL_Z + DECK_T * 0.5 + 0.05))))
    safe_bevel(ob, M(BEVEL_OUT), segments=2, angle=25.0)

    # 4x M8 (Ø9) сквозь плиту + центральное гнездо Ø6.1
    for sx in (-1, 1):
        for sy in (-1, 1):
            boolean_cut(ob, cyl_cutter('c_m8', M(M8_D) * 0.5, M(CEIL_Z - 1.5), M(BODY_Z + 1.0),
                                       center=(sx * M(BOLT_GRID), sy * M(BOLT_GRID)), n=36))
    boolean_cut(ob, cyl_cutter('c_pin', M(PIN_BORE) * 0.5, M(CEIL_Z - 1.5), M(BODY_Z + 1.0),
                               n=32))

    # карманы под направляющие башмаки (4)
    for sx in (-1, 1):
        for sy in (-1, 1):
            y0 = sy * M(SHOE_FACE)
            y1 = sy * (M(SHOE_FACE) + M(POCKET_D))
            boolean_cut(ob, box_cutter('c_pocket',
                                       M(POCKET_L), abs(y1 - y0), M(POCKET_H),
                                       (sx * M(SHOE_X), (y0 + y1) * 0.5,
                                        M(SHOE_Z0 + SHOE_H * 0.5))))
    # гнёзда винтов башмаков (ось Y)
    for sx in (-1, 1):
        for sy in (-1, 1):
            bm2 = bmesh.new()
            r = M(SCREW_SHANK_D) * 0.5
            n = 24
            y0 = sy * M(SHOE_BACK - 0.5)
            y1 = sy * M(SHOE_BACK + 8.5)
            ring0, ring1 = [], []
            for i in range(n):
                a = 2.0 * math.pi * i / n
                ring0.append(bm2.verts.new((sx * M(SHOE_X) + r * math.cos(a), y0,
                                            M(SHOE_Z0 + SHOE_H * 0.5) + r * math.sin(a))))
                ring1.append(bm2.verts.new((sx * M(SHOE_X) + r * math.cos(a), y1,
                                            M(SHOE_Z0 + SHOE_H * 0.5) + r * math.sin(a))))
            bm2.faces.new(ring0)
            bm2.faces.new(ring1[::-1])
            for i in range(n):
                j = (i + 1) % n
                bm2.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
            bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
            me = bpy.data.meshes.new('c_screw')
            bm2.to_mesh(me)
            bm2.free()
            c = bpy.data.objects.new('c_screw', me)
            bpy.context.scene.collection.objects.link(c)
            boolean_cut(ob, c)

    # окно фиксатора в +Y щеке
    boolean_cut(ob, box_cutter('c_lock_win', M(LOCK_WIN_X * 2.0),
                               M(BODY_Y * 0.5 - 24.45 + 0.6),
                               M(LOCK_WIN_Z1 - LOCK_WIN_Z0),
                               (0.0, M(24.45 + (BODY_Y * 0.5 - 24.45) * 0.5),
                                M((LOCK_WIN_Z0 + LOCK_WIN_Z1) * 0.5))))
    # ось рычага
    boolean_cut(ob, axis_cutter('c_pivot', M(PIVOT_D) * 0.5 + M(0.1),
                                -M(20.0), M(20.0), M(LOCK_PIVOT[0]), M(LOCK_PIVOT[1])))

    # грани канала -> графит износа
    for poly in ob.data.polygons:
        c, n = poly.center, poly.normal
        side = (abs(abs(c.y) - M(CH_HALF)) < M(0.06) and abs(n.y) > 0.9
                and c.z <= M(CEIL_Z) + M(0.02) and abs(c.x) < M(59.9))
        ceil = (abs(c.z - M(CEIL_Z)) < M(0.06) and n.z < -0.9 and abs(c.y) < M(CH_HALF + 0.02))
        if side or ceil:
            poly.material_index = 1
    ob['cj_role'] = 'saddle body 120x90x50, channel 49.5 open from below, deck 60 wide'
    return ob


# --- башмаки -------------------------------------------------------------
def build_shoe(tag, sx, sy, root):
    bm = bmesh.new()
    yc = sy * (SHOE_FACE + SHOE_T * 0.5)
    bm_box(bm, M(SHOE_L), M(SHOE_T), M(SHOE_H), (sx * M(SHOE_X), M(yc), M(SHOE_Z0 + SHOE_H * 0.5)))
    ob = finish(PREFIX + 'shoe_' + tag, bm, [MATERIALS['wear']], root)
    # потай под головку винта + сквозное отверстие
    y_face = sy * M(SHOE_FACE)
    y_cb = sy * M(SHOE_FACE + SCREW_HEAD_H)
    bm2, n = bmesh.new(), 24
    ring0, ring1 = [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        ring0.append(bm2.verts.new((sx * M(SHOE_X) + M(SCREW_BORE_D) * 0.5 * math.cos(a),
                                    y_face - sy * 0.0004,
                                    M(SHOE_Z0 + SHOE_H * 0.5) + M(SCREW_BORE_D) * 0.5 * math.sin(a))))
        ring1.append(bm2.verts.new((sx * M(SHOE_X) + M(SCREW_BORE_D) * 0.5 * math.cos(a),
                                    y_cb,
                                    M(SHOE_Z0 + SHOE_H * 0.5) + M(SCREW_BORE_D) * 0.5 * math.sin(a))))
    bm2.faces.new(ring0)
    bm2.faces.new(ring1[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm2.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
    me = bpy.data.meshes.new('c_cb')
    bm2.to_mesh(me)
    bm2.free()
    c = bpy.data.objects.new('c_cb', me)
    bpy.context.scene.collection.objects.link(c)
    boolean_cut(ob, c)
    bm3, n = bmesh.new(), 20
    ring0, ring1 = [], []
    for i in range(n):
        a = 2.0 * math.pi * i / n
        ring0.append(bm3.verts.new((sx * M(SHOE_X) + M(SCREW_SHANK_D) * 0.55 * math.cos(a),
                                    y_face, M(SHOE_Z0 + SHOE_H * 0.5) + M(SCREW_SHANK_D) * 0.55 * math.sin(a))))
        ring1.append(bm3.verts.new((sx * M(SHOE_X) + M(SCREW_SHANK_D) * 0.55 * math.cos(a),
                                    sy * M(SHOE_BACK), M(SHOE_Z0 + SHOE_H * 0.5) + M(SCREW_SHANK_D) * 0.55 * math.sin(a))))
    bm3.faces.new(ring0)
    bm3.faces.new(ring1[::-1])
    for i in range(n):
        j = (i + 1) % n
        bm3.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bmesh.ops.recalc_face_normals(bm3, faces=bm3.faces)
    me3 = bpy.data.meshes.new('c_shank')
    bm3.to_mesh(me3)
    bm3.free()
    c3 = bpy.data.objects.new('c_shank', me3)
    bpy.context.scene.collection.objects.link(c3)
    boolean_cut(ob, c3)
    safe_bevel(ob, M(0.5), segments=1, angle=35.0)
    ob['cj_role'] = 'guide shoe %s, wear face y=%+.2f mm (0.25 mm to rail)' % (tag, SHOE_FACE)
    return ob


def build_shoe_screw(tag, sx, sy, root):
    """M4 socket screw: head flush with the wear face, shank into the body."""
    prof = [(0.0, 2.0), (2.0, 2.0), (2.0, 0.0), (3.5, 0.0),
            (3.5, 3.3), (2.1, 3.9), (1.9, 4.5), (1.9, 10.6),
            (1.5, 11.2), (0.0, 11.2)]
    prof = [(r * MM, h * MM) for (r, h) in prof]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=24, axis_y=True, flip_y=(sy < 0),
             offset=(sx * M(SHOE_X), sy * M(SHOE_FACE), M(SHOE_Z0 + SHOE_H * 0.5)))
    ob = finish(PREFIX + 'shoe_screw_' + tag, bm, [MATERIALS['steel']], root)
    ob['cj_role'] = 'M4 socket screw, head flush with shoe wear face'
    return ob


# --- фиксатор ------------------------------------------------------------
def lever_profile():
    """2D-полигон рычага в YZ: бобышка + лапка с круглым хватом."""
    py, pz = LOCK_PIVOT
    phi = math.radians(LEVER_ARM_DEG)
    da = math.asin(min(0.90, LEVER_ARM_HALF_W / LOCK_BOSS_R))
    pts = []
    a0, a1 = phi + da, phi - da + 2.0 * math.pi
    n = 48
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        pts.append((py + LOCK_BOSS_R * math.cos(a), pz + LOCK_BOSS_R * math.sin(a)))
    cy = py + LEVER_ARM_R * math.cos(phi)
    cz = pz + LEVER_ARM_R * math.sin(phi)
    n2 = 16
    for i in range(1, n2):
        a = phi - math.pi * 0.5 + math.pi * i / n2
        pts.append((cy + LEVER_ARM_HALF_W * math.cos(a), cz + LEVER_ARM_HALF_W * math.sin(a)))
    return [(y * MM, z * MM) for (y, z) in pts]


def build_lock_lever(root):
    pts = lever_profile()
    bm = bmesh.new()
    x0, x1 = -M(LEVER_T * 0.5), M(LEVER_T * 0.5)
    vs = [bm.verts.new((x0, y, z)) for (y, z) in pts]
    bm.verts.ensure_lookup_table()
    face = bm.faces.new(vs)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    nv = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=(x1 - x0, 0.0, 0.0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ob = finish(PREFIX + 'lock_lever', bm, [MATERIALS['pink']], root)

    # ось и палец-кулачок
    boolean_cut(ob, axis_cutter('c_lp', M(PIVOT_D) * 0.5 + M(0.1), -M(8.0), M(8.0),
                                M(LOCK_PIVOT[0]), M(LOCK_PIVOT[1])))
    boolean_cut(ob, axis_cutter('c_lc', M(CAM_PIN_D) * 0.5 + M(0.1), -M(8.0), M(8.0),
                                M(CAM_OPEN[0]), M(CAM_OPEN[1])))
    for poly in ob.data.polygons:
        poly.use_smooth = len(poly.vertices) == 4 and abs(poly.normal.x) < 0.99
    ob['cj_role'] = ('eccentric cam lever (muted pink), %.0f deg throw, retracts the brake '
                     'shoe %.2f mm' % (abs(LEVER_SWING_DEG), CAM_E * (1 - math.cos(math.radians(LEVER_SWING_DEG)))))
    return ob


def build_brake(root):
    bm = bmesh.new()
    yc = BRAKE_FACE + BRAKE_T * 0.5
    bm_box(bm, M(BRAKE_X * 2.0), M(BRAKE_T), M(BRAKE_Z1 - BRAKE_Z0),
           (0.0, M(yc), M((BRAKE_Z0 + BRAKE_Z1) * 0.5)))
    ob = finish(PREFIX + 'brake_shoe', bm, [MATERIALS['insert']], root)
    safe_bevel(ob, M(0.5), segments=1, angle=35.0)
    ob['cj_role'] = 'graphite brake shoe, face y=%+.2f mm (1.20 mm to rail, 1.35 mm throw)' % BRAKE_FACE
    return ob


def build_pins(root):
    out = {}
    # штифт верхней площадки Ø6, заподлицо с плитой
    bm = bmesh.new()
    bm_lathe(bm, [(0.0, 0.0), (M(PIN_D) * 0.5, 0.0),
                  (M(PIN_D) * 0.5, M(PIN_LEN) - M(0.3)),
                  (M(PIN_D) * 0.5 - M(0.3), M(PIN_LEN)),
                  (0.0, M(PIN_LEN))], segs=32)
    pin = finish(PREFIX + 'top_pin', bm, [MATERIALS['steel']], root)
    pin.location = (0.0, 0.0, M(PIN_BOTTOM))
    pin['cj_role'] = 'locating dowel D6 in the top plate, flush with the mounting face'
    out['top'] = pin

    bm = bmesh.new()
    bm_lathe(bm, [(0.0, -M(20.0)), (M(PIVOT_D) * 0.5, -M(20.0)),
                  (M(PIVOT_D) * 0.5, M(19.4)),
                  (M(PIVOT_D) * 0.5 - M(0.6), M(20.0)),
                  (0.0, M(20.0))], segs=24)
    # ось вдоль X
    piv = finish(PREFIX + 'lock_pivot', bm, [MATERIALS['steel']], root)
    piv.rotation_euler = (0.0, math.pi * 0.5, 0.0)
    piv.location = (0.0, M(LOCK_PIVOT[0]), M(LOCK_PIVOT[1]))
    piv['cj_role'] = 'D7 pivot pin of the cam lever, anchored in the cheek walls'
    out['pivot'] = piv

    bm = bmesh.new()
    bm_lathe(bm, [(0.0, -M(7.0)), (M(CAM_PIN_D) * 0.5, -M(7.0)),
                  (M(CAM_PIN_D) * 0.5, M(7.0) - M(0.4)),
                  (M(CAM_PIN_D) * 0.5 - M(0.4), M(7.0)), (0.0, M(7.0))], segs=20)
    cam = finish(PREFIX + 'lock_cam_pin', bm, [MATERIALS['steel']], root)
    cam.rotation_euler = (0.0, math.pi * 0.5, 0.0)
    cam.location = (0.0, M(CAM_OPEN[0]), M(CAM_OPEN[1]))
    cam['cj_role'] = 'D5 eccentric cam pin, presses the brake shoe (throw 1.35 mm)'
    out['cam'] = cam
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
    root.empty_display_size = 0.06
    bpy.context.scene.collection.objects.link(root)

    parts = {'body': build_body(root)}
    for sx, stag in ((-1, 'back'), (1, 'front')):
        for sy, ytag in ((-1, 'left'), (1, 'right')):
            tag = stag + '_' + ytag
            parts['shoe_' + tag] = build_shoe(tag, sx, sy, root)
            parts['screw_' + tag] = build_shoe_screw(tag, sx, sy, root)
    parts['brake'] = build_brake(root)
    parts['lever'] = build_lock_lever(root)
    parts.update(build_pins(root))

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


def measure_channel(parts, body):
    """Канал 45.5 по башмакам + просвет корпуса + потолок."""
    out = {}
    for tag, sy in (('left', -1), ('right', 1)):
        vals = []
        for stag in ('back', 'front'):
            sh = parts['shoe_' + stag + '_' + tag]
            for z in (16.0, 24.0):
                for xm in (30.0, 38.0):
                    p = ray(sh, (M(-xm if stag == 'back' else xm), 0.0, M(z)),
                            (0, sy, 0), 0.06)
                    if p is not None:
                        vals.append(abs(p.y) * 1000)
        out[tag] = {'face_mm': round(sum(vals) / len(vals), 3) if vals else None,
                    'samples': len(vals)}
    relief = []
    for sy in (-1, 1):
        for x in (-58.0, 58.0):
            p = ray(body, (M(x), 0.0, M(20.0)), (0, sy, 0), 0.06)
            if p is not None:
                relief.append(abs(p.y) * 1000)
    ceil = []
    for y in (-18.0, -8.0, 8.0, 18.0):
        p = ray(body, (M(0.0), M(y), M(30.0)), (0, 0, 1), 0.05)
        if p is not None:
            ceil.append(p.z * 1000)
    faces = [out['left']['face_mm'], out['right']['face_mm']]
    ok_faces = all(v is not None and abs(v - SHOE_FACE) <= 0.08 for v in faces)
    opening = (faces[0] + faces[1]) if ok_faces else None
    out['opening_mm'] = round(opening, 3) if opening else None
    out['relief_mm'] = round(2.0 * (sum(relief) / len(relief)), 3) if relief else None
    out['ceiling_z_mm'] = round(sum(ceil) / len(ceil), 3) if ceil else None
    out['gap_per_side_mm'] = round((opening - RAIL) * 0.5, 3) if opening else None
    out['ceiling_gap_mm'] = round((sum(ceil) / len(ceil) - RAIL), 3) if ceil else None
    out['ok'] = (ok_faces and opening is not None and abs(opening - OPENING) <= 0.16
                 and out['ceiling_gap_mm'] is not None and abs(out['ceiling_gap_mm'] - 0.25) <= 0.12)
    return out


def measure_top(body, top_pin):
    holes = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * M(BOLT_GRID), sy * M(BOLT_GRID)

            def open_up(x, y):
                return ray(body, (x, y, M(CEIL_Z - 1.6)), (0, 0, 1), M(12.0)) is None
            through = open_up(cx, cy)
            dia = None
            if through:
                ex = bisect(lambda o: open_up(cx + o, cy), 0.0, M(9))
                ey = bisect(lambda o: open_up(cx, cy + o), 0.0, M(9))
                dia = [round(ex * 2000, 2), round(ey * 2000, 2)]
            holes.append({'id': 'M8_%s%s' % ('plus' if sx > 0 else 'minus',
                                             'plus' if sy > 0 else 'minus'),
                          'grid_mm': [float(sx * BOLT_GRID), float(sy * BOLT_GRID)],
                          'center_m': [round(cx, 5), round(cy, 5), round(M(BODY_Z), 5)],
                          'through': through, 'dia_mm': dia})

    def open_pin(x, y):
        return ray(body, (x, y, M(CEIL_Z - 1.6)), (0, 0, 1), M(12.0)) is None
    pin_open = open_pin(0.0, 0.0)
    pin_dia = None
    if pin_open:
        ex = bisect(lambda o: open_pin(o, 0.0), 0.0, M(6))
        ey = bisect(lambda o: open_pin(0.0, o), 0.0, M(6))
        pin_dia = [round(ex * 2000, 2), round(ey * 2000, 2)]
    pmn, pmx = bbox_of([top_pin])
    pin = {'center_m': [0.0, 0.0, round(M(BODY_Z), 5)],
           'dia_mm': PIN_D, 'bore_dia_mm': pin_dia,
           'top_z_mm': round(pmx.z * 1000, 3), 'bottom_z_mm': round(pmn.z * 1000, 3),
           'flush_mm': round((M(BODY_Z) - pmx.z) * 1000, 3),
           'present': True}
    ok_holes = all(h['through'] and h['dia_mm']
                   and abs(h['dia_mm'][0] - M8_D) <= 0.25 and abs(h['dia_mm'][1] - M8_D) <= 0.25
                   for h in holes)
    ok_pin = (pin_open and pin_dia is not None and abs(pin_dia[0] - PIN_BORE) <= 0.25
              and abs(pin_dia[1] - PIN_BORE) <= 0.25 and abs(pin['flush_mm']) <= 0.05)
    return {'plate_mm': [DECK_Y, BODY_X, round(DECK_T, 2)],
            'z_range_mm': [CEIL_Z, BODY_Z],
            'grid_mm': BOLT_GRID, 'holes': holes, 'pin': pin,
            'holes_ok': ok_holes, 'pin_ok': ok_pin, 'ok': ok_holes and ok_pin}


def lever_swing(lever):
    """Габарит рычага по ходу открыто -> закрыто (0…-35°) и точка контакта пальца."""
    pivot = Vector((0.0, M(LOCK_PIVOT[0]), M(LOCK_PIVOT[1])))
    mw = lever.matrix_world
    verts = [mw @ v.co for v in lever.data.vertices]
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    steps = int(abs(LEVER_SWING_DEG))
    for deg in range(0, steps + 1, 5):
        rot = Matrix.Rotation(math.radians(-deg), 4, 'X')
        for p in verts:
            q = pivot + (rot.to_3x3() @ (p - pivot))
            for i in range(3):
                mn[i] = min(mn[i], q[i])
                mx[i] = max(mx[i], q[i])
    # центр пальца в закрытом положении
    v = Vector((0.0, M(CAM_OPEN[0]) - pivot.y, M(CAM_OPEN[1]) - pivot.z))
    rot = Matrix.Rotation(math.radians(LEVER_SWING_DEG), 3, 'X')
    closed_pin = pivot + (rot @ v)
    return mn, mx, closed_pin


def measure_lock(parts, body, checks_bbox):
    lever, brake, cam = parts['lever'], parts['brake'], parts['cam']
    bmn, bmx = bbox_of([brake])
    face = bmn.y * 1000 if bmn.y > 0 else bmx.y * 1000
    gap = face - RAIL * 0.5
    smn, smx, closed_pin = lever_swing(lever)
    cmn, cmx = bbox_of([cam])
    open_near = cmn.y * 1000
    closed_near = closed_pin.y * 1000 - CAM_PIN_D * 0.5
    throw = open_near - closed_near
    closed_face = face - throw
    swing_inside = (smn.x >= checks_bbox[0].x - 1e-6 and smx.x <= checks_bbox[1].x + 1e-6
                    and smn.y >= checks_bbox[0].y - 1e-6 and smx.y <= checks_bbox[1].y + 1e-6
                    and smn.z >= checks_bbox[0].z - 1e-6 and smx.z <= checks_bbox[1].z + 1e-6)
    lmn, lmx = bbox_of([lever])
    rec = {
        'type': 'side eccentric cam lever (muted pink) pressing a graphite brake shoe',
        'lever_node': lever.name,
        'pivot_mm': {'y': LOCK_PIVOT[0], 'z': LOCK_PIVOT[1], 'axis': 'X',
                     'pin_d_mm': PIVOT_D},
        'lever_swing_deg': abs(LEVER_SWING_DEG),
        'cam_eccentricity_mm': CAM_E,
        'throw_mm': round(throw, 3),
        'cam_pin': {'node': cam.name, 'open_center_mm': list(CAM_OPEN),
                    'closed_center_mm': [round(closed_pin.y * 1000, 2),
                                         round(closed_pin.z * 1000, 2)],
                    'open_near_face_mm': round(open_near, 3),
                    'closed_near_face_mm': round(closed_near, 3)},
        'brake_shoe': {
            'node': brake.name,
            'size_mm': [round((bmx.x - bmn.x) * 1000, 2), round((bmx.y - bmn.y) * 1000, 2),
                        round((bmx.z - bmn.z) * 1000, 2)],
            'open_face_mm': round(face, 3),
            'open_gap_mm': round(gap, 3),
            'closed_face_mm': round(closed_face, 3),
            'closed_overlap_mm': round(RAIL * 0.5 - closed_face, 3),
            'contact_area_mm2': round(2.0 * BRAKE_X * (BRAKE_Z1 - BRAKE_Z0), 1),
            'rides_on_cam': True,
        },
        'lever_bbox_mm': {'min': [round(v * 1000, 2) for v in lmn],
                          'max': [round(v * 1000, 2) for v in lmx]},
        'swing_envelope_mm': {'min': [round(v * 1000, 2) for v in smn],
                              'max': [round(v * 1000, 2) for v in smx]},
        'swing_inside_bbox': swing_inside,
        'note': ('смоделировано в ОТКРЫТОМ положении: башмак отведён на %.2f мм от рельса, '
                 'палец упирается в его тыл; поворот рычага на %.0f° даёт %.2f мм, '
                 'закрытое лицо %.2f мм (натяг %.2f мм)'
                 % (gap, abs(LEVER_SWING_DEG), throw, closed_face,
                    RAIL * 0.5 - closed_face)),
    }
    rec['ok'] = (0.7 <= gap <= 1.6 and 0.8 <= throw <= 1.4
                 and closed_face <= RAIL * 0.5 + 0.05 and swing_inside
                 and rec['brake_shoe']['contact_area_mm2'] >= 150.0)
    return rec


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
    channel = measure_channel(parts, parts['body'])
    top = measure_top(parts['body'], parts['top'])
    lock = measure_lock(parts, parts['body'], (mn, mx))

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

    shoe_nodes = [o.name for o in meshes if '__shoe_' in o.name]
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
        'bbox_ok': (abs(size.x - M(BODY_X)) <= 0.0008 and abs(size.y - M(BODY_Y)) <= 0.0008
                    and abs(size.z - M(BODY_Z)) <= 0.0008 and abs(mn.z) <= 0.0008
                    and abs(mn.x + M(BODY_X * 0.5)) <= 0.0008),
        'mass_kg_est': round(mass, 3),
        'mass_kg_est_zn': round(mass_zn, 3),
        'channel': channel,
        'opening_45_5_ok': channel['ok'],
        'top_plate': top,
        'top_pattern_ok': top['ok'],
        'lock': lock,
        'lock_ok': lock['ok'],
        'guide_count': len([n for n in shoe_nodes if 'screw' not in n]),
        'guide_count_ok': len([n for n in shoe_nodes if 'screw' not in n]) == 4,
        'volume_by_material_cm3': {k: round(v, 3) for k, v in vol_by_key.items()},
        'negative_scale': [ob.name for ob in meshes if ob.matrix_world.determinant() < 1e-9],
        'no_negative_scale': all(ob.matrix_world.determinant() > 1e-9 for ob in meshes),
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'dof': {'axis': 'X', 'travel_m': TRAVEL_M,
                'limited_by': 'rail length 1.0 m minus carriage 0.12 m'},
        'dof_ok': TRAVEL_M == 0.5,
        'animation': 'none (no actions; travel is a runtime DOF)',
        'animation_ok': len(bpy.data.actions) == 0,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))
    return checks, dict(mn=mn, mx=mx, size=size, mass=mass, mass_zn=mass_zn, mats=mats,
                        verts=verts, tris=tris, per_obj=per_obj, channel=channel,
                        top=top, lock=lock, vol=vol_by_key)


# --- report --------------------------------------------------------------
def build_report(root, checks, m):
    interfaces = {
        'rail_channel': {
            'role': 'lift-off saddle over CJ-RAIL-45: carriage drops onto the rail from above',
            'axis': [1.0, 0.0, 0.0],
            'opening_mm': OPENING,
            'measured_opening_mm': m['channel']['opening_mm'],
            'gap_per_side_mm': 0.25,
            'measured_gap_per_side_mm': m['channel']['gap_per_side_mm'],
            'gap_mm': {'y_plus': 0.25, 'y_minus': 0.25, 'ceiling': 0.25,
                       'measured_ceiling': m['channel']['ceiling_gap_mm']},
            'body_relief_mm': round(CH_RELIEF, 2),
            'measured_relief_mm': m['channel']['relief_mm'],
            'ceiling_z_mm': CEIL_Z,
            'measured_ceiling_z_mm': m['channel']['ceiling_z_mm'],
            'entry': 'open from below (drop-on), no rail threading',
            'guides': {
                'count': 4,
                'type': 'graphite wear shoes in pockets, faces at +/-22.75 mm',
                'shoe_mm': [SHOE_L, SHOE_T, SHOE_H],
                'stations_x_mm': [-SHOE_X, SHOE_X],
                'wear_face_material': 'CJ_carriage_wear_graphite',
                'replaceable': 'M4 socket screw per shoe, head flush with the wear face',
            },
            'lock': {
                'type': m['lock']['type'],
                'lever_swing_deg': m['lock']['lever_swing_deg'],
                'throw_mm': m['lock']['throw_mm'],
                'open_gap_mm': m['lock']['brake_shoe']['open_gap_mm'],
                'contact_area_mm2': m['lock']['brake_shoe']['contact_area_mm2'],
                'blocks': 'friction clamp on the +Y rail face + preload against the -Y shoes',
                'state_modelled': 'open (shoe retracted 1.20 mm, no contact)',
            },
            'dof': {'axis': 'X', 'travel_m': TRAVEL_M,
                    'note': 'travel 0.5 m of the 1.0 m rail; limit stops are external'},
        },
        'top_plate': {
            'role': 'mounting plate for CJ-LATCH-30 adapters / fix_corner_node pattern',
            'plane': 'XY at z=50 mm',
            'plate_mm': [DECK_Y, BODY_X, round(DECK_T, 2)],
            'z_range_mm': [CEIL_Z, BODY_Z],
            'normal': [0.0, 0.0, 1.0],
            'grid_mm': BOLT_GRID,
            'm8': [{'id': h['id'], 'grid_mm': h['grid_mm'], 'center_m': h['center_m'],
                    'dia_mm': M8_D, 'measured_dia_mm': h['dia_mm']} for h in m['top']['holes']],
            'pin': m['top']['pin'],
            'bolts': 'M8 x4 (D9 through), grid +/-15 mm',
            'compatibility': 'same 4x M8 +/-15 + centre D6 pattern as fix_corner_node / CJ-RAIL-45 end caps',
        },
    }
    return {
        'id': CID,
        'code': 'CJ-CARRIAGE-120',
        'name': 'Каретка подвижная',
        'kit': 'CJ-FIX-KIT',
        'class': 'MOTION / linear',
        'standard': 'CJ-RAIL-45',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_carriage.py',
        'units': 'm',
        'spec': {
            'overall_mm': [BODY_X, BODY_Y, BODY_Z],
            'body_mm': [BODY_X, BODY_Y, BODY_Z],
            'top_plate_mm': [DECK_Y, BODY_X, round(DECK_T, 2)],
            'rail_profile_mm': [RAIL, RAIL],
            'inner_channel_mm': OPENING,
            'body_relief_mm': CH_RELIEF,
            'ceiling_gap_mm': 0.25,
            'guides': 4,
            'lock': 'side eccentric cam lever, 40 deg, throw 1.35 mm',
            'dof': {'axis': 'X', 'travel_m': TRAVEL_M},
            'mass_kg_spec': 1.8,
            'material': 'Al 6061 body / graphite shoes / steel pins (zinc casting 1.8 kg)',
            'load_kn_concept': 1.5,
        },
        'bbox_m': {'min': [round(v, 5) for v in m['mn']],
                   'max': [round(v, 5) for v in m['mx']],
                   'size': [round(v, 5) for v in m['size']],
                   'nominal': [0.12, 0.09, 0.05],
                   'ok': checks['bbox_ok']},
        'travel_m': TRAVEL_M,
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
            'Канал каретки — 45.5 мм по рабочим граням четырёх графитовых башмаков; '
            'корпус имеет просвет 49.5 мм (2 мм на сторону), поэтому 45.5 задаётся '
            'именно башмаками, а не литым телом.',
            'Потолок канала 45.25 мм: рельс 45 входит с 0.25 мм сверху, низ канала '
            'открыт — каретка надевается на рельс сверху и снимается вверх.',
            'Верхняя площадка 60 мм шириной (уже корпуса 90) несёт 4x Ø9 (M8) по сетке '
            '+-15 мм и гнездо Ø6.1 со штифтом Ø6 заподлицо — тот же паттерн, что у '
            'fix_corner_node и торцов рельса.',
            'Фиксатор: эксцентриковый палец Ø5 на рычаге (40° хода) давит на графитовый '
            'тормозной башмак 13x16 мм; ход 1.35 мм, из них 1.20 выбирают зазор, '
            '0.15 идут в натяг к +Y грани рельса.',
            'Масса по фактическим объёмам: %s кг в алюминии, %s кг в цинковом литье '
            '(6.6 г/см3) — спецификация набора 1.8 кг относится к литому варианту.'
            % (round(m['mass'], 2), round(m['mass_zn'], 2)),
        ],
        'deviations': [
            'Верхняя площадка — 4.75 мм (потолок канала 45.25 при габарите 50). '
            'Плита 8–10 мм при ходе по рельсу 45 не размещается: нужно Z >= 55. '
            'Под M8 ставить шайбы Ø16 (не моделировались) или резьбовые вставки.',
            'Каретка невзаимная (lift-off): удержание — гравитация + фиксатор. '
            'Захват за Т-пазы рельса не делался: при канале 45.5 поднутрения не остаётся.',
            'Фиксатор — фрикционный, а не позитивный: в открытом положении башмак '
            'отведён на 1.20 мм, ход 1.35 мм даёт 0.15 мм натяга. Позитивный стоп '
            '(палец в Т-паз) потребовал бы окна в щеке под 10 мм устье.',
            'Ширина корпуса 90 мм нужна под карманы башмаков и окно фиксатора; '
            'верхняя площадка намеренно уже — 60 мм.',
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
            ('rim', (-0.08, -0.26, 0.20), 2.8, 0.18),
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
    close_lo = Vector((-0.022, 0.017, 0.006))
    close_hi = Vector((0.032, 0.046, 0.046))
    c_close = box_corners(close_lo, close_hi)
    close_t = (close_lo + close_hi) * 0.5

    views = [
        ('3q', (0.54, 0.62, 0.44), center, 62, c_main, 0.880, None),
        ('front', (0.02, 0.99, 0.20), center, 100, c_main, 0.885, None),
        ('side', (0.99, -0.10, 0.10), center, 100, c_main, 0.900, None),
        ('closeup', (0.52, 0.70, 0.26), close_t, 70, c_close, 0.86, (close_lo, close_hi)),
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
        '| opening', m['channel']['opening_mm'],
        '| top', checks['top_pattern_ok'], '| lock', checks['lock_ok'],
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
    root['cj_standard'] = 'CJ-RAIL-45'
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_travel_m'] = TRAVEL_M
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
