#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_riser — телескопическая стойка 300…600 мм, 60x60.

Standalone builder. Не трогает общий builder / catalog / pages и чужие GLB.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_riser.py

Роль в наборе: подъёмная проставка. Плиты 60x60x8 несут ту же сетку крепежа,
что торцы fix_post_600 / fix_rail_1000 (4 x M8 Ø9 по ±15 мм + Ø6 в центре),
поэтому стойка встаёт между узлами набора без переходников.

Ориентация:
  * рабочая (длинная) ось — +Z, стойка вертикальная, центр габарита в XY (0,0);
  * низ нижней плиты — z = 0 (стойка стоит на плоскости), верх — z = 0.600;
  * поперечное сечение — 60x60, трубы квадратные, соосные;
  * модуль собран В ВЫДВИНУТОМ состоянии (600 мм) — это габаритный ориентир.

Кинематика (почему три ступени, а не две):
  * полный ход 300 мм при минимальной высоте 300 мм требует отношения 2:1;
  * при двух ступенях внутренняя труба на минимальной высоте целиком спрятана
    во внешней, то есть её длина <= 292 мм (300 минус плита), а на полном
    выдвижении перекрытие = L_внутр - 300 <= -8 мм — ноль или минус;
  * поэтому введена переходная ступень: 60 -> 55 -> 50, все длиной 284 мм,
    перекрытие на полном выдвижении 134 мм на каждом стыке. Внешняя труба
    60x60 и внутренняя 50x50 — по заданию, 55x55 — промежуточная.

Фиксация высоты:
  * каждая подвижная ступень несёт палец Ø8 у своего нижнего торца;
  * на трубе под ней — сквозной ряд отверстий Ø8.6 с шагом 50 мм; на +X грани
    внешней трубы ряд виден снаружи (6 отверстий, z 22…272 мм);
  * палец 1 (стык 60->55, +X) — индекс высоты, палец 2 (стык 55->50, +Y) —
    страховочный: держит вторую ступень и дублирует фиксацию;
  * H = 300 + m + i, m,i in {0,50,100,150} -> 300/350/…/600 (7 положений).

Геометрия:
  * плиты 60x60x8 (графит): 4 x Ø9 (M8) по сетке ±15 мм + Ø6.1 в центре;
  * трубы 60x60 / 55x55 / 50x50, стенка 2 мм, зазор в паре 0.5 мм на сторону;
  * 8 стальных бобышек Ø12 с Ø6.8 (по 4 под каждой плитой) — плита
    притягивается болтами изнутри трубы;
  * палец: вал Ø8 + головка Ø16 x 2 заподлицо в цековке Ø17, головка розовая;
  * тёмные пояса на верхних торцах ступеней (втулки стыков) — раскладка
    материала (графит), не геометрия;
  * материалов 4: ivory / graphite / steel / pin pink.

Выход:
  docs/plans/blockout/component-library/fix_riser/fix_riser.glb
  docs/plans/blockout/component-library/fix_riser/{3q,front,joint,top}.png
  docs/plans/blockout/component-library/fix_riser/report.json

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

from mathutils import Matrix, Vector

# --- константы модуля ----------------------------------------------------
CID = 'fix_riser'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001

PLATE_W = 60.0              # плита 60x60
PLATE_T = 8.0               # толщина плиты
BOLT_GRID = 15.0            # сетка M8 ±15 мм
M8_D = 9.0                  # отверстие под M8
PIN_BORE = 6.1              # центральное Ø6

TUBE_OUT = 60.0             # внешняя труба
TUBE_MID = 55.0             # промежуточная
TUBE_IN = 50.0              # внутренняя
WALL_OUT = 2.0
WALL_MID = 2.0
WALL_IN = 2.0

STAGE_L = 284.0             # длина каждой ступени
STAGE_TRAVEL = 150.0        # ход одной ступени
H_MIN = 300.0               # минимальная фиксируемая высота
H_MAX = 600.0               # максимальная (габарит)
H_STEP = 50.0               # шаг фиксации

ROW_PITCH = 50.0            # шаг ряда отверстий
ROW_OFF = 14.0              # ось пальца от нижнего торца ступени
ROW_N = 6                   # отверстий в видимом ряду внешней трубы

PIN_D = 8.0                 # вал пальца
PIN_HOLE = 8.6              # отверстие под палец
PIN_HEAD = 16.0             # головка
PIN_HEAD_T = 2.0            # толщина головки (заподлицо в стенке)
PIN_RECESS = 17.0           # цековка под головку

BOSS_D = 12.0               # бобышка-гнездо под плитой
BOSS_BORE = 6.8             # резьбовой Ø6.8 (M8)
BOSS_LEN = 16.0

BEVEL_TUBE = 0.8
BEVEL_PLATE = 1.0

DENSITY_AL = 2700.0         # алюминий, кг/м3
DENSITY_ST = 7850.0         # сталь, кг/м3

# --- положение в выдвинутом состоянии (600 мм) ---------------------------
BASE_Z0, BASE_Z1 = 0.0, PLATE_T                     # 0..8
OUT_Z0, OUT_Z1 = BASE_Z1, BASE_Z1 + STAGE_L         # 8..292
MID_Z0 = BASE_Z1 + STAGE_TRAVEL                     # 158
MID_Z1 = MID_Z0 + STAGE_L                           # 442
IN_Z0 = BASE_Z1 + 2.0 * STAGE_TRAVEL                # 308
IN_Z1 = IN_Z0 + STAGE_L                             # 592
TOP_Z0, TOP_Z1 = IN_Z1, IN_Z1 + PLATE_T             # 592..600

TOTAL_H = TOP_Z1
assert abs(TOTAL_H - H_MAX) < 1e-9, TOTAL_H

# ряды отверстий (абсолютный Z в выдвинутом состоянии)
ROW_OUT_Z = [BASE_Z1 + ROW_OFF + ROW_PITCH * k for k in range(ROW_N)]
ROW_MID_Z = [MID_Z0 + ROW_OFF + ROW_PITCH * k for k in range(4)]
ROW_IN_Z = [IN_Z0 + ROW_OFF + ROW_PITCH * k for k in range(4)]

PIN_A_Z = MID_Z0 + ROW_OFF          # 172 — палец стыка 60->55 (+X)
PIN_B_Z = IN_Z0 + ROW_OFF           # 322 — палец стыка 55->50 (+Y)

# тёмные пояса (материал graphite), абсолютный Z
# каждый стык отмечен графитовой втулкой на верхнем торце нижней ступени
BAND_OUT = (OUT_Z1 - 12.0, OUT_Z1)
BAND_MID = (MID_Z1 - 12.0, MID_Z1)
BAND_IN = (IN_Z1 - 12.0, IN_Z1)

SKIP_RENDER = os.environ.get('CJ_SKIP_RENDER', '0') not in ('0', '', 'false', 'no')


def log(*a):
    print('[fix_riser]', *a, flush=True)


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
    """4 материала: ivory труб, графит плит/поясов, сталь, розовый палец."""
    MATERIALS['tube'] = make_mat('CJ_riser_tube_ivory', (0.735, 0.715, 0.668), 0.58, 0.0, 0.45)
    MATERIALS['plate'] = make_mat('CJ_riser_plate_graphite', (0.075, 0.080, 0.090), 0.55, 0.08, 0.30)
    MATERIALS['steel'] = make_mat('CJ_riser_steel', (0.520, 0.532, 0.552), 0.28, 1.0)
    MATERIALS['pin'] = make_mat('CJ_riser_pin_pink', (0.640, 0.380, 0.395), 0.42, 0.05, 0.50)


def link(ob, mats, root, name=None):
    bpy.context.scene.collection.objects.link(ob)
    if name:
        ob.name = name
        ob.data.name = name
    for m in mats:
        ob.data.materials.append(m)
    if root is not None:
        ob.parent = root
        ob.matrix_parent_inverse.identity()
    return ob


def bevel_apply(ob, width, segments=2, angle_deg=30.0):
    bpy.context.view_layer.objects.active = ob
    mod = ob.modifiers.new('bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle_deg)
    mod.use_clamp_overlap = True
    mod.miter_outer = 'MITER_ARC'
    bpy.ops.object.modifier_apply(modifier=mod.name)


# --- примитивы -----------------------------------------------------------
def mesh_box_world(name, sx, sy, sz, z0):
    """Бокс в мировых координатах: z0..z0+sz, центр в XY (0,0)."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(0.0, 0.0, z0 + sz * 0.5), verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return bpy.data.objects.new(name, me)


def mesh_tube(name, size, wall, zs):
    """Квадратная труба: внешний size, стенка wall, кольца на высотах zs."""
    a = size * 0.5
    b = a - wall
    bm = bmesh.new()
    corners = ((-1, -1), (1, -1), (1, 1), (-1, 1))
    vo = []
    vi = []
    for z in zs:
        vo.append([bm.verts.new((sx * a, sy * a, z)) for sx, sy in corners])
        vi.append([bm.verts.new((sx * b, sy * b, z)) for sx, sy in corners])
    n = len(zs)
    for k in range(n - 1):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((vo[k][i], vo[k][j], vo[k + 1][j], vo[k + 1][i]))
            bm.faces.new((vi[k + 1][i], vi[k + 1][j], vi[k][j], vi[k][i]))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((vo[-1][i], vo[-1][j], vi[-1][j], vi[-1][i]))
        bm.faces.new((vo[0][j], vo[0][i], vi[0][i], vi[0][j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return bpy.data.objects.new(name, me)


def mesh_pin(name, rings, axis='X', segs=32, z_off=0.0):
    """Тело вращения по образующей rings=[(t, r), ...] вдоль axis, торцы закрыты.

    z_off — высота оси пальца над плитой (мировые метры).
    """
    bm = bmesh.new()
    loops = []
    for (t, r) in rings:
        loop = []
        for i in range(segs):
            ang = 2.0 * math.pi * i / segs
            c, s = math.cos(ang) * r, math.sin(ang) * r
            if axis == 'X':
                p = (t, c, s + z_off)
            elif axis == 'Y':
                p = (c, t, s + z_off)
            else:
                p = (c, s, t + z_off)
            loop.append(bm.verts.new(p))
        loops.append(loop)
    for k in range(len(loops) - 1):
        A, B = loops[k], loops[k + 1]
        for i in range(segs):
            j = (i + 1) % segs
            try:
                bm.faces.new((A[i], A[j], B[j], B[i]))
            except ValueError:
                pass
    try:
        bm.faces.new(loops[0])
    except ValueError:
        pass
    try:
        bm.faces.new(loops[-1][::-1])
    except ValueError:
        pass
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return bpy.data.objects.new(name, me)


def hollow_cyl_into(bm, centre, r_out, r_in, length, segs=28):
    """Полый цилиндр с кольцевыми крышками, добавляется в общий BMesh."""
    cx, cy, z0 = centre
    vo0, vo1, vi0, vi1 = [], [], [], []
    for i in range(segs):
        a = 2.0 * math.pi * i / segs
        c, s = math.cos(a), math.sin(a)
        vo0.append(bm.verts.new((cx + c * r_out, cy + s * r_out, z0)))
        vo1.append(bm.verts.new((cx + c * r_out, cy + s * r_out, z0 + length)))
        vi0.append(bm.verts.new((cx + c * r_in, cy + s * r_in, z0)))
        vi1.append(bm.verts.new((cx + c * r_in, cy + s * r_in, z0 + length)))
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((vo0[i], vo0[j], vo1[j], vo1[i]))
        bm.faces.new((vi1[i], vi1[j], vi0[j], vi0[i]))
        bm.faces.new((vo1[i], vo1[j], vi1[j], vi1[i]))
        bm.faces.new((vo0[j], vo0[i], vi0[i], vi0[j]))


def axis_rot(direction):
    d = Vector(direction)
    d.normalize()
    return Vector((0.0, 0.0, 1.0)).rotation_difference(d).to_matrix().to_4x4()


def cutter_set(name, specs):
    """Набор независимых цилиндров-вырезов в одном меше (один Boolean на деталь).

    specs: (centre_m, axis_vector, radius_m, length_m)
    """
    bm = bmesh.new()
    for (centre, axis, radius, length) in specs:
        ret = bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False,
                                    segments=32, radius1=radius, radius2=radius,
                                    depth=length)
        mat = Matrix.Translation(Vector(centre)) @ axis_rot(axis)
        bmesh.ops.transform(bm, matrix=mat, verts=ret['verts'])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return bpy.data.objects.new(name, me)


def boolean_cut(target, cutter):
    bpy.context.view_layer.objects.active = target
    mod = target.modifiers.new('cut_' + cutter.name, 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    mod.use_self = False
    bpy.ops.object.modifier_apply(modifier=mod.name)
    me = cutter.data
    bpy.data.objects.remove(cutter, do_unlink=True)
    if me.users == 0:
        bpy.data.meshes.remove(me)


# --- сборка --------------------------------------------------------------
def build_plate(root, name, z0, tag):
    """Плита 60x60x8: 4 x Ø9 (M8, ±15) + Ø6.1 в центре, сквозные."""
    plate = mesh_box_world(name, PLATE_W * MM, PLATE_W * MM, PLATE_T * MM, z0 * MM)
    link(plate, [MATERIALS['plate']], root, name)
    bevel_apply(plate, BEVEL_PLATE * MM, segments=2)

    specs = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            specs.append(((sx * BOLT_GRID * MM, sy * BOLT_GRID * MM,
                           (z0 + PLATE_T * 0.5) * MM),
                          (0.0, 0.0, 1.0), M8_D * 0.5 * MM, (PLATE_T + 4.0) * MM))
    specs.append(((0.0, 0.0, (z0 + PLATE_T * 0.5) * MM),
                  (0.0, 0.0, 1.0), PIN_BORE * 0.5 * MM, (PLATE_T + 4.0) * MM))
    boolean_cut(plate, cutter_set('cut_' + name, specs))

    plate['cj_role'] = 'plate 60x60x8 — CJ-FIX-KIT pattern 4xM8 ±15 + Ø6 (%s)' % tag
    plate['cj_accent'] = False
    return plate


def build_tube(root, name, size, wall, z0, z1, band, row_z, axis='X', pre_cut=None):
    """Труба ступени: сквозные отверстия ряда Ø8.6 на высотах row_z.

    band — (lo, hi) пояс графита; axis — ось сверления ряда.
    """
    lo, hi = band
    ring = hi if hi < z1 - 1e-9 else lo
    zs = [z0 * MM, ring * MM, z1 * MM] if z0 < ring < z1 else [z0 * MM, z1 * MM]
    tube = mesh_tube(name, size * MM, wall * MM, zs)
    link(tube, [MATERIALS['tube'], MATERIALS['plate']], root, name)
    bevel_apply(tube, BEVEL_TUBE * MM, segments=2)

    if pre_cut:
        boolean_cut(tube, cutter_set('cut_pre_' + name, pre_cut))

    depth = (size + 8.0) * MM
    specs = [((0.0, 0.0, z * MM),
              (1.0, 0.0, 0.0) if axis == 'X' else (0.0, 1.0, 0.0),
              PIN_HOLE * 0.5 * MM, depth)
             for z in row_z]
    if specs:
        boolean_cut(tube, cutter_set('cut_' + name, specs))

    # тёмный пояс ступени — раскладка материала
    n_band = 0
    for poly in tube.data.polygons:
        zc = poly.center.z * 1000.0
        if lo - 1e-4 <= zc <= hi + 1e-4:
            poly.material_index = 1
            n_band += 1
        else:
            poly.material_index = 0
    if n_band == 0:
        raise RuntimeError('band faces not painted on %s' % name)
    tube['cj_band_z_mm'] = [round(lo, 1), round(hi, 1)]
    tube['cj_row_z_mm'] = [round(z, 1) for z in row_z]
    return tube, n_band


def build_bosses(root):
    """8 стальных бобышек Ø12 / Ø6.8 под плитами (по 4 сверху и снизу)."""
    bm = bmesh.new()
    for (z0) in (BASE_Z1, TOP_Z0 - BOSS_LEN):
        for sx in (-1, 1):
            for sy in (-1, 1):
                hollow_cyl_into(bm, (sx * BOLT_GRID * MM, sy * BOLT_GRID * MM, z0 * MM),
                                BOSS_D * 0.5 * MM, BOSS_BORE * 0.5 * MM, BOSS_LEN * MM)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(PREFIX + 'bolt_seats')
    bm.to_mesh(me)
    bm.free()
    seats = link(bpy.data.objects.new(PREFIX + 'bolt_seats', me),
                 [MATERIALS['steel']], root, PREFIX + 'bolt_seats')
    seats['cj_role'] = 'M8 / Ø6 seats inside tube ends (4 top, 4 bottom)'
    return seats


def build_pin(root, name, axis, t0, t1, head_t, z_station):
    """Палец: вал Ø8 от t0 до t1-head_t, головка Ø16 заподлицо на t1."""
    r = PIN_D * 0.5 * MM
    rh = PIN_HEAD * 0.5 * MM
    rings = [(t0 * MM, r), ((t1 - head_t) * MM, r),
             ((t1 - head_t) * MM, rh), (t1 * MM, rh)]
    pin = mesh_pin(name, rings, axis=axis, segs=32, z_off=z_station * MM)
    link(pin, [MATERIALS['steel'], MATERIALS['pin']], root, name)
    head_from = (t1 - head_t - 0.01) * MM
    n_head = 0
    for poly in pin.data.polygons:
        t = poly.center.x if axis == 'X' else poly.center.y
        if t >= head_from:
            poly.material_index = 1
            n_head += 1
    if n_head == 0:
        raise RuntimeError('pin head not painted: %s' % name)
    pin['cj_role'] = 'pin Ø8, head Ø16 x %.1f flush with face' % head_t
    return pin


def build():
    reset_scene()
    build_materials()
    root = bpy.data.objects.new(CID, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.08
    bpy.context.scene.collection.objects.link(root)

    base = build_plate(root, PREFIX + 'base_plate', BASE_Z0, 'bottom mount')

    # цековка Ø17 под головку пальца 1 — режется ДО ряда, иначе отверстие
    # ряда Ø8.6 попадает в уже удалённую стенку и оставляет неманифолдные рёбра
    recess_a = [(((TUBE_OUT * 0.5 - 1.2) * MM, 0.0, PIN_A_Z * MM), (1.0, 0.0, 0.0),
                 PIN_RECESS * 0.5 * MM, 4.4 * MM)]
    outer, nb_o = build_tube(root, PREFIX + 'tube_outer', TUBE_OUT, WALL_OUT,
                             OUT_Z0, OUT_Z1, BAND_OUT, ROW_OUT_Z, axis='X',
                             pre_cut=recess_a)
    middle, nb_m = build_tube(root, PREFIX + 'tube_middle', TUBE_MID, WALL_MID,
                              MID_Z0, MID_Z1, BAND_MID, ROW_MID_Z, axis='X')
    inner, nb_i = build_tube(root, PREFIX + 'tube_inner', TUBE_IN, WALL_IN,
                             IN_Z0, IN_Z1, BAND_IN, ROW_IN_Z, axis='Y')
    log('band faces outer/middle/inner:', nb_o, nb_m, nb_i)

    # цековка Ø17 под головку пальца 2 (только ближняя стенка средней ступени)
    # цековка снимает стенку насквозь (25.1…28.6): если начать её от 25.6, под
    # головкой пальца остаётся 0.1 мм стенки — реальное проникновение
    boolean_cut(middle, cutter_set('cut_recess_b', [
        ((0.0, (TUBE_MID * 0.5 - 0.65) * MM, PIN_B_Z * MM), (0.0, 1.0, 0.0),
         PIN_RECESS * 0.5 * MM, 3.5 * MM)]))

    # ряд по Y у средней ступени (палец 2 идёт сквозь неё)
    mid_y = [((0.0, 0.0, z * MM), (0.0, 1.0, 0.0), PIN_HOLE * 0.5 * MM,
              (TUBE_MID + 8.0) * MM) for z in ROW_MID_Z]
    boolean_cut(middle, cutter_set('cut_mid_y', mid_y))

    top = build_plate(root, PREFIX + 'top_plate', TOP_Z0, 'top mount')
    seats = build_bosses(root)

    pin_a = build_pin(root, PREFIX + 'pin_index', 'X',
                      TUBE_OUT * 0.5 - 6.5, TUBE_OUT * 0.5, PIN_HEAD_T, PIN_A_Z)
    pin_b = build_pin(root, PREFIX + 'pin_safety', 'Y',
                      TUBE_MID * 0.5 - 6.0, TUBE_MID * 0.5, PIN_HEAD_T, PIN_B_Z)

    meshes = obj_mesh_objs(root)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    parts = {'base': base, 'outer': outer, 'middle': middle, 'inner': inner,
             'top': top, 'seats': seats, 'pin_index': pin_a, 'pin_safety': pin_b}
    return root, parts


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


def measure_plate(plate, face_z_mm, sign, thick_mm=PLATE_T):
    """4 x M8 (Ø9) + Ø6.1 на внешней плоскости плиты, замер лучами."""
    face_z = face_z_mm * MM
    z_out = face_z + sign * 0.0008
    d = (0.0, 0.0, float(-sign))

    def through(x, y):
        return ray(plate, (x, y, z_out), d, dist=thick_mm * 0.6 * MM) is None

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
            gx, gy = sx * BOLT_GRID * MM, sy * BOLT_GRID * MM
            xc, yc, dx, dy = edges(gx, gy)
            holes.append({
                'id': 'M8_%s%s' % ('plus' if sx > 0 else 'minus',
                                   'plus' if sy > 0 else 'minus'),
                'grid_mm': [round(sx * BOLT_GRID, 1), round(sy * BOLT_GRID, 1)],
                'center_m': [round(xc, 5), round(yc, 5), round(face_z, 5)],
                'offset_from_grid_mm': [round((xc - gx) * 1000, 3),
                                        round((yc - gy) * 1000, 3)],
                'dia_mm': [round(dx * 1000, 2), round(dy * 1000, 2)],
            })
    px, py, dpx, dpy = edges(0.0, 0.0)
    bore = {'center_m': [round(px, 5), round(py, 5), round(face_z, 5)],
            'dia_mm': [round(dpx * 1000, 2), round(dpy * 1000, 2)]}

    holes_ok = all(abs(h['dia_mm'][0] - M8_D) <= 0.5 and
                   abs(h['dia_mm'][1] - M8_D) <= 0.5 for h in holes)
    grid_ok = all(abs(h['offset_from_grid_mm'][0]) <= 0.35 and
                  abs(h['offset_from_grid_mm'][1]) <= 0.35 for h in holes)
    bore_ok = (abs(bore['dia_mm'][0] - PIN_BORE) <= 0.35 and
               abs(bore['dia_mm'][1] - PIN_BORE) <= 0.35 and
               abs(bore['center_m'][0]) < 0.0004 and
               abs(bore['center_m'][1]) < 0.0004)
    return holes, bore, {'holes_ok': holes_ok, 'grid_ok': grid_ok, 'bore_ok': bore_ok}


def measure_row(tube, z_expected, face_mm=TUBE_OUT * 0.5, dist=1.5, dia_map=None):
    """Отверстия ряда на грани +X: центр по Z и диаметр (луч снаружи внутрь).

    dia_map — ожидаемый диаметр на станции (станция с цековкой Ø17 шире ряда).
    """
    x0 = (face_mm + 1.0) * MM
    dia_map = dia_map or {}

    def through(z):
        return ray(tube, (x0, 0.0, z), (-1.0, 0.0, 0.0), dist=dist * MM) is None

    recs = []
    for z_mm in z_expected:
        z = z_mm * MM
        want = dia_map.get(round(z_mm, 1), PIN_HOLE)
        if not through(z):
            recs.append({'station_mm': round(z_mm, 1), 'open': False,
                         'expected_mm': want, 'center_mm': None, 'dia_mm': None})
            continue
        zp = bisect(lambda d: through(z + d), 0.0, 10.0 * MM)
        zm = bisect(lambda d: through(z - d), 0.0, 10.0 * MM)
        recs.append({'station_mm': round(z_mm, 1), 'open': True, 'expected_mm': want,
                     'center_mm': round((z + (zp - zm) * 0.5) * 1000.0, 2),
                     'dia_mm': round((zp + zm) * 1000.0, 2)})
    open_z = [r['center_mm'] for r in recs if r['open']]
    pitch_ok = len(open_z) == len(z_expected) and all(
        abs((b - a) - ROW_PITCH) <= 0.8 for a, b in zip(open_z, open_z[1:]))
    dia_ok = all(r['open'] and abs(r['dia_mm'] - r['expected_mm']) <= 1.2
                 for r in recs)
    return {'face': '+X at x=+%.1f mm' % face_mm, 'pitch_mm': ROW_PITCH,
            'index_station_mm': PIN_A_Z, 'holes': recs, 'count_open': len(open_z),
            'pitch_ok': pitch_ok, 'dia_ok': dia_ok, 'ok': pitch_ok and dia_ok}


def check_mesh(ob):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    non_manifold = sum(1 for e in bm.edges if len(e.link_faces) != 2)
    degenerate = sum(1 for f in bm.faces if f.calc_area() < 1e-11)
    loose = sum(1 for v in bm.verts if not v.link_edges)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    verts = len(bm.verts)
    vol = abs(bm.calc_volume(signed=True))
    bm.free()
    return {'non_manifold': non_manifold, 'degenerate': degenerate,
            'loose_verts': loose, 'tris': tris, 'verts': verts, 'volume_m3': vol}


def height_model():
    """H = 16 + 284 + m + i, m,i in {0,50,100,150} -> 300 + m + i."""
    grid = [0.0, 50.0, 100.0, 150.0]
    reach = {}
    for m in grid:
        for i in grid:
            reach.setdefault(H_MIN + m + i, []).append((m, i))
    positions = [H_MIN + H_STEP * k for k in range(int((H_MAX - H_MIN) / H_STEP) + 1)]
    return reach, positions


def check(parts, root):
    meshes = obj_mesh_objs(root)
    mn, mx = bbox_of(meshes)
    size = mx - mn

    per_obj = {}
    nm_total = deg_total = loose_total = tris = verts = 0
    mass = 0.0
    for ob in meshes:
        r = check_mesh(ob)
        per_obj[ob.name] = {k: v for k, v in r.items() if k != 'volume_m3'}
        nm_total += r['non_manifold']
        deg_total += r['degenerate']
        loose_total += r['loose_verts']
        tris += r['tris']
        verts += r['verts']
        steel = any(m and 'steel' in m.name for m in ob.data.materials)
        mass += r['volume_m3'] * (DENSITY_ST if steel else DENSITY_AL)

    mats = sorted({m.name for ob in meshes for m in ob.data.materials if m})
    neg_scale = [ob.name for ob in meshes if ob.matrix_world.determinant() < 1e-9]

    holes_b, bore_b, ok_b = measure_plate(parts['base'], BASE_Z0, -1)
    holes_t, bore_t, ok_t = measure_plate(parts['top'], TOP_Z1, +1)
    row = measure_row(parts['outer'], ROW_OUT_Z,
                      dia_map={round(PIN_A_Z, 1): PIN_RECESS})

    # --- пальцы ---
    pins = []
    pin_ok = True
    for tag, ob, axis, z_pin, face_mm, wall_in_mm, target_len in (
            ('index', parts['pin_index'], 'X', PIN_A_Z,
             TUBE_OUT * 0.5, TUBE_OUT * 0.5 - WALL_OUT, 6.5),
            ('safety', parts['pin_safety'], 'Y', PIN_B_Z,
             TUBE_MID * 0.5, TUBE_MID * 0.5 - WALL_MID, 6.0)):
        p_mn, p_mx = bbox_of([ob])
        along = ((p_mx.x - p_mn.x) if axis == 'X' else (p_mx.y - p_mn.y)) * 1000.0
        outer_t = (p_mx.x if axis == 'X' else p_mx.y) * 1000.0
        head_dia = (p_mx.z - p_mn.z) * 1000.0
        reach_mm = face_mm - along
        flush = abs(outer_t - face_mm) <= 0.25
        on_station = abs((p_mn.z + p_mx.z) * 0.5 * 1000.0 - z_pin) <= 0.25
        centred = (abs((p_mn.y + p_mx.y) * 0.5) < 0.0002 if axis == 'X'
                   else abs((p_mn.x + p_mx.x) * 0.5) < 0.0002)
        passes = reach_mm <= (wall_in_mm - 1.0)
        length_ok = abs(along - target_len) <= 0.3
        ok = flush and on_station and centred and passes and length_ok
        pins.append({'id': tag, 'axis': axis, 'station_z_mm': round(z_pin, 1),
                     'face_mm': face_mm, 'length_mm': round(along, 2),
                     'length_ok': bool(length_ok),
                     'head_dia_mm': round(head_dia, 2),
                     'head_thickness_mm': PIN_HEAD_T,
                     'shaft_dia_mm': PIN_D, 'hole_dia_mm': PIN_HOLE,
                     'clearance_mm': round((PIN_HOLE - PIN_D) * 0.5, 2),
                     'flush': bool(flush), 'on_station': bool(on_station),
                     'centred_cross': bool(centred),
                     'passes_both_walls': bool(passes),
                     'inner_end_mm': round(reach_mm, 2)})
        pin_ok = pin_ok and ok

    row_centres = [r['center_mm'] for r in row['holes'] if r['open']]
    align_row = bool(row_centres) and any(abs(c - PIN_A_Z) <= 0.8 for c in row_centres)

    # --- высоты ---
    reach, positions = height_model()
    reachable = [p for p in positions if p in reach]
    heights_ok = (abs(H_MIN - 300.0) < 1e-9 and abs(H_MAX - 600.0) < 1e-9 and
                  len(positions) == 7 and reachable == positions and
                  abs(TOP_Z1 - H_MAX) < 1e-6 and
                  abs((PLATE_T * 2 + STAGE_L) - H_MIN) < 1e-9)
    step_ok = (abs(STAGE_TRAVEL % H_STEP) < 1e-9 and
               abs((H_MIN + 2.0 * STAGE_TRAVEL) - H_MAX) < 1e-9)

    clearances = {
        'outer_to_middle_mm': round((TUBE_OUT - 2 * WALL_OUT - TUBE_MID) * 0.5, 2),
        'middle_to_inner_mm': round((TUBE_MID - 2 * WALL_MID - TUBE_IN) * 0.5, 2),
        'pin_to_hole_mm': round((PIN_HOLE - PIN_D) * 0.5, 2),
        'head_to_recess_mm': round((PIN_RECESS - PIN_HEAD) * 0.5, 2),
        'boss_to_middle_wall_mm': round((TUBE_MID * 0.5 - WALL_MID) -
                                        (BOLT_GRID + BOSS_D * 0.5), 2),
        'overlap_full_extension_mm': round(STAGE_L - STAGE_TRAVEL, 2),
    }
    clearance_ok = all(v > 0.0 for k, v in clearances.items()
                       if k != 'overlap_full_extension_mm')

    # --- плавающие детали (bbox-зазор до соседей) ---
    def gap(a_mn, a_mx, b_mn, b_mx):
        d = 0.0
        for i in range(3):
            d = max(d, max(0.0, a_mn[i] - b_mx[i]), max(0.0, b_mn[i] - a_mx[i]))
        return d

    boxes = {ob.name: bbox_of([ob]) for ob in meshes}
    host_names = [parts['base'].name, parts['top'].name, parts['outer'].name,
                  parts['middle'].name, parts['inner'].name]
    floating = []
    for ob in meshes:
        if ob.name in host_names:
            continue
        o_mn, o_mx = boxes[ob.name]
        g = min(gap(o_mn, o_mx, *boxes[h]) for h in host_names)
        if g > 0.0015:
            floating.append({'name': ob.name, 'gap_mm': round(g * 1000.0, 2)})

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
        'bbox_target_m': [round(PLATE_W * MM, 5), round(PLATE_W * MM, 5),
                          round(H_MAX * MM, 5)],
        'bbox_ok': (abs(size.x - PLATE_W * MM) <= 0.0010 and
                    abs(size.y - PLATE_W * MM) <= 0.0010 and
                    abs(size.z - H_MAX * MM) <= 0.0010),
        'vertical_axis': 'Z',
        'telescope_axis': 'Z',
        'no_negative_scale': not neg_scale,
        'negative_scale_nodes': neg_scale,
        'end_bottom_m8_ok': ok_b['holes_ok'] and ok_b['grid_ok'],
        'end_top_m8_ok': ok_t['holes_ok'] and ok_t['grid_ok'],
        'm8_ok': ok_b['holes_ok'] and ok_b['grid_ok'] and ok_t['holes_ok'] and ok_t['grid_ok'],
        'centrebore_ok': ok_b['bore_ok'] and ok_t['bore_ok'],
        'hole_row_ok': row['ok'],
        'hole_row': row,
        'height_range_ok': bool(heights_ok),
        'height_step_ok': bool(step_ok),
        'height_positions_mm': positions,
        'height_positions_reachable': sorted(reach.keys()),
        'pin_ok': bool(pin_ok and align_row),
        'pin_row_alignment_ok': align_row,
        'clearances_ok': bool(clearance_ok),
        'clearances': clearances,
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'animation': 'none (static module, height set by pins)',
        'animation_ok': len(bpy.data.actions) == 0,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))

    rep = {
        'id': CID,
        'code': 'CJ-RISER-60',
        'name': 'Телескопическая стойка 300–600',
        'kit': 'CJ-FIX-KIT',
        'class': 'STRUCTURE / riser (telescopic)',
        'standard': 'CJ-FIX-KIT mount pattern (4xM8 ±15 + Ø6)',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_riser.py',
        'units': 'm',
        'orientation': {
            'long_axis': 'Z',
            'mount': 'стойка стоит на плоскости: низ плиты z=0, верх z=0.600, '
                     'центр габарита в XY (0,0)',
            'cross_section_plane': 'XY',
            'state': 'extended (600 мм) — габаритный ориентир',
            'ends': {'end_bottom': {'plane': 'z=0', 'normal': [0, 0, -1]},
                     'end_top': {'plane': 'z=0.6', 'normal': [0, 0, 1]}},
            'm8_grid_plane': 'XY на каждой плите',
            'pattern_source': 'fix_post_600 / fix_rail_1000 (CJ-FIX-KIT)',
            'pattern_delta': 'Сетка M8 ±15 мм (Ø9) + Ø6.1 в центре совпадает с '
                             'торцами стоек набора; плита 60x60 вместо 45x45, '
                             'узлы стыкуются без переходников.',
        },
        'spec': {
            'bbox_target_mm': [PLATE_W, PLATE_W, H_MAX],
            'plate_mm': [PLATE_W, PLATE_W, PLATE_T],
            'plate_count': 2,
            'tubes_mm': {'outer': [TUBE_OUT, TUBE_OUT, STAGE_L],
                         'middle': [TUBE_MID, TUBE_MID, STAGE_L],
                         'inner': [TUBE_IN, TUBE_IN, STAGE_L]},
            'wall_mm': [WALL_OUT, WALL_MID, WALL_IN],
            'stages': 3,
            'stage_travel_mm': STAGE_TRAVEL,
            'stage_length_mm': STAGE_L,
            'overlap_full_extension_mm': STAGE_L - STAGE_TRAVEL,
            'height_min_mm': H_MIN,
            'height_max_mm': H_MAX,
            'height_step_mm': H_STEP,
            'height_positions_mm': positions,
            'height_formula': 'H = 8 + 284 + m + i (m,i in 0/50/100/150) = 300 + m + i',
            'bolt': 'M8',
            'hole_dia_mm': M8_D,
            'end_grid_mm': BOLT_GRID,
            'pin_dia_mm': PIN_D,
            'pin_hole_dia_mm': PIN_HOLE,
            'pin_head_mm': [PIN_HEAD, PIN_HEAD_T],
            'row_pitch_mm': ROW_PITCH,
            'bevel_mm': [BEVEL_TUBE, BEVEL_PLATE],
            'material': 'Al 6063-T5 (трубы, плиты) + сталь (пальцы, бобышки)',
            'accent': 'приглушённо-розовые головки пальцев (единственный акцент)',
            'mass_kg_nominal': round(mass, 2),
        },
        'bbox_m': {'min': [round(v, 5) for v in mn],
                   'max': [round(v, 5) for v in mx],
                   'size': [round(v, 5) for v in size]},
        'bbox_target': {'size': [round(PLATE_W * MM, 4), round(PLATE_W * MM, 4),
                                 round(H_MAX * MM, 4)]},
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
            'end_bottom': {
                'role': 'bottom plate 60x60x8 — mount to base / post',
                'center_m': [0.0, 0.0, 0.0],
                'normal': [0.0, 0.0, -1.0],
                'plane': 'XY',
                'plate_mm': [PLATE_W, PLATE_W, PLATE_T],
                'bolts': 'M8 x4 (Ø9 through), grid ±15 mm',
                'm8': holes_b,
                'centrebore': {'dia_mm': PIN_BORE, 'measured_mm': bore_b['dia_mm'],
                               'center_m': bore_b['center_m'], 'ok': ok_b['bore_ok']},
            },
            'end_top': {
                'role': 'top plate 60x60x8 — mount upper node',
                'center_m': [0.0, 0.0, round(H_MAX * MM, 5)],
                'normal': [0.0, 0.0, 1.0],
                'plane': 'XY',
                'plate_mm': [PLATE_W, PLATE_W, PLATE_T],
                'bolts': 'M8 x4 (Ø9 through), grid ±15 mm',
                'm8': holes_t,
                'centrebore': {'dia_mm': PIN_BORE, 'measured_mm': bore_t['dia_mm'],
                               'center_m': bore_t['center_m'], 'ok': ok_t['bore_ok']},
            },
            'tube_joints': {
                'outer_to_middle': {'z_mm': [round(MID_Z0, 1), round(OUT_Z1, 1)],
                                    'overlap_mm': round(OUT_Z1 - MID_Z0, 2),
                                    'clearance_mm': clearances['outer_to_middle_mm']},
                'middle_to_inner': {'z_mm': [round(IN_Z0, 1), round(MID_Z1, 1)],
                                    'overlap_mm': round(MID_Z1 - IN_Z0, 2),
                                    'clearance_mm': clearances['middle_to_inner_mm']},
            },
        },
        'height': {
            'min_mm': H_MIN, 'max_mm': H_MAX, 'step_mm': H_STEP,
            'positions_mm': positions, 'count': len(positions),
            'stage_travel_mm': [STAGE_TRAVEL, STAGE_TRAVEL],
            'reachable': {('%d' % k): v for k, v in sorted(reach.items())},
            'extended_state': {'m_mm': STAGE_TRAVEL, 'i_mm': STAGE_TRAVEL,
                               'total_mm': H_MIN + 2 * STAGE_TRAVEL},
            'collapsed_state_total_mm': PLATE_T * 2 + STAGE_L,
            'pin_stations_mm': {'index_z': PIN_A_Z, 'safety_z': PIN_B_Z},
        },
        'pin': {
            'count': 2, 'dia_mm': PIN_D, 'hole_dia_mm': PIN_HOLE,
            'head_mm': [PIN_HEAD, PIN_HEAD_T],
            'row_pitch_mm': ROW_PITCH,
            'row_offset_from_stage_bottom_mm': ROW_OFF,
            'visible_row': {'face': 'outer tube +X', 'holes': ROW_N,
                            'stations_z_mm': [round(z, 1) for z in ROW_OUT_Z]},
            'pins': pins,
            'row_alignment_ok': align_row,
            'role': {
                'index': 'палец стыка 60->55 (+X), задаёт m; ряд отверстий виден '
                         'внешней трубой',
                'safety': 'палец стыка 55->50 (+Y), держит вторую ступень и '
                          'дублирует фиксацию (страховочный)',
            },
        },
        'checks': checks,
        'renders': [],
        'glb': None,
        'glb_bytes': None,
        'notes': [
            'Стойка собрана в выдвинутом состоянии: 60 x 60 x 600 мм, низ плиты '
            'на z = 0.',
            'Три ступени 60/55/50, стенка 2 мм, зазор 0.5 мм на сторону: при двух '
            'ступенях ход 300 мм и минимальная высота 300 мм несовместимы '
            '(внутренняя труба ограничена 292 мм, перекрытие на полном выдвижении '
            'выходит в ноль), поэтому введена переходная 55x55; внешняя 60x60 и '
            'внутренняя 50x50 — по заданию.',
            'Высота набирается ступенями: H = 300 + m + i, m,i in {0,50,100,150}, '
            'шаг 50 мм -> 300/350/400/450/500/550/600 (7 положений).',
            'Перекрытие на полном выдвижении 134 мм на каждом стыке — палец '
            'работает по стенке, а не по кромке.',
            'Каждая подвижная ступень несёт палец Ø8 у нижнего торца, на трубе под '
            'ней — сквозной ряд отверстий Ø8.6 с шагом 50 мм. Ряд на +X грани '
            'внешней трубы виден снаружи: 6 отверстий, z 22…272 мм.',
            'Головка пальца Ø16 x 2 утоплена в цековку Ø17 заподлицо с гранью — '
            'габарит 60x60 не растёт, палец остаётся пальцевым (плоская розовая '
            'кнопка).',
            'Плиты 60x60x8 несут сетку CJ-FIX-KIT: 4 x Ø9 (M8) по ±15 мм + Ø6.1 в '
            'центре; изнутри под плитами стоят 8 стальных бобышек Ø12 с Ø6.8 — '
            'плита притягивается болтами изнутри трубы.',
            'Тёмные пояса — раскладка материала (графит), не геометрия: на '
            'верхнем торце каждой ступени сидит втулка стыка, поэтому все три '
            'стыка читаются одинаково (внешняя 60 -> 55 на 280…292, средняя '
            '55 -> 50 на 430…442, внутренняя 50 -> плита на 580…592).',
            'Материалов 4: ivory (трубы), графит (плиты, пояса), сталь (пальцы, '
            'бобышки), приглушённо-розовый (головки пальцев).',
        ],
        'deviations': [
            'Введена третья (переходная) ступень 55x55: при двух ступенях ход '
            '300 мм и минимальная высота 300 мм несовместимы — внутренняя труба '
            'ограничена 292 мм (300 минус плита), а на полном выдвижении её '
            'перекрытие с внешней выходит в ноль. Внешняя 60x60 и внутренняя 50x50 '
            'выполнены по заданию.',
            'Высота задаётся двумя пальцами (по одному на стык), а не одним: одна '
            'ступень физически не даёт 300 мм хода в габарите 60 мм. Шаг фиксации '
            'остаётся 50 мм, ряд отверстий сквозной, оба пальца видны и работают '
            'от пальца.',
            'Плиты сквозные по Ø9: болты M8 вводятся изнутри трубы в бобышки, '
            'поэтому крепёж ставится до сборки колонны (наружного доступа к '
            'головкам нет — плита 60x60 равна сечению трубы).',
            'Модуль статический: DOF в сцене нет, высота задаётся положением '
            'ступеней и пальцами; actions/анимации нет.',
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
        lo.rotation_euler = (Vector((0.0, 0.0, 0.0)) - lo.location).to_track_quat(
            '-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

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
        return [Vector((x, y, z)) for x in (a.x, b.x) for y in (a.y, b.y)
                for z in (a.z, b.z)]

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

    c_main = box_corners(mn, mx)

    j_lo = Vector((-0.032, -0.032, 0.130))
    j_hi = Vector((0.032, 0.032, 0.390))
    j_t = (j_lo + j_hi) * 0.5
    c_joint = box_corners(j_lo, j_hi)

    t_lo = Vector((-0.031, -0.031, 0.560))
    t_hi = Vector((0.031, 0.031, TOP_Z1 * MM + 0.0015))
    t_t = (t_lo + t_hi) * 0.5
    c_top = box_corners(t_lo, t_hi)

    # оба пальца смотрят на +X и +Y, ряд отверстий — на +X: камеры взяты
    # с этой стороны, иначе рабочая грань и страховочный палец не читаются
    views = [
        ('3q', (0.66, 0.72, 0.10), center, 62, c_main, 0.945, None),
        ('front', (0.998, 0.02, 0.02), center, 120, c_main, 0.960, None),
        ('joint', (0.62, 0.70, 0.36), j_t, 80, c_joint, 0.92, (j_lo, j_hi)),
        ('top', (0.44, 0.56, 0.70), t_t, 78, c_top, 0.90, (t_lo, t_hi)),
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
            got = max_ndc(region)
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat(
                '-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = OUT_DIR / (tag + '.png')
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append({'view': tag, 'path': str(fp.relative_to(PROJECT)),
                     'fill': round(max_ndc(region), 3)})
        log('RENDERED', tag, fp)
    return outs


def main():
    root, parts = build()
    log('built nodes:', len(obj_mesh_objs(root)))

    rep = check(parts, root)
    root['cj_id'] = CID
    root['cj_standard'] = 'CJ-RISER-60'
    root['cj_kit'] = 'CJ-FIX-KIT'
    root['cj_orient'] = 'vertical telescopic, long axis +Z, bottom plate at z=0'
    root['cj_bbox_m'] = json.dumps(rep['bbox_m']['size'])
    root['cj_height_mm'] = json.dumps([H_MIN, H_MAX, H_STEP])
    root['cj_interfaces'] = json.dumps(rep['interfaces'], ensure_ascii=False)
    root['cj_pin'] = json.dumps(rep['pin'], ensure_ascii=False)

    path = export(root)
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['export'] = {'use_selection': True, 'export_apply': True, 'export_yup': True,
                     'export_extras': True, 'export_cameras': False,
                     'export_lights': False}

    if SKIP_RENDER:
        log('render skipped (CJ_SKIP_RENDER=1)')
    else:
        rep['renders'] = render_views(root)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    log('CHECKS all_ok =', rep['checks']['all_ok'])
    if not rep['checks']['all_ok']:
        log('CHECKS FAILED', json.dumps(
            {k: v for k, v in rep['checks'].items()
             if k.endswith('_ok') and not v}, ensure_ascii=False))
        print('CHECKS_FAILED', flush=True)
        sys.exit(3)
    print('BUILD_OK', flush=True)


if __name__ == '__main__':
    main()
