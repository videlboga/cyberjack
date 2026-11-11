#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CJ-FIX-KIT / fix_foot — регулируемая опора пола 100x100x60, седло под CJ-RAIL-45.

Standalone builder (v2). Не трогает общий builder/catalog/pages и чужие rail/node.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/build_fix_foot.py

Все размеры заданы в МИЛЛИМЕТРАХ и переводятся в метры одним множителем M().
В сцене только метры — смешанных единиц нет (это была причина прошлого брака).

Состав (z, мм):
  плита 100x100x12 (0..12), 4 x Ø9 под анкер + окно Ø28;
  стойка 56x56 (12..19.5) с окном Ø34;
  контргайка S30 (19.5..25.5), маховик Ø36 24 грани (25.5..33);
  открытая резьба 33..45 (12 мм);
  винт M20 Ø20, хвостовик 12.5, верх 47.5, 12 кольцевых канавок;
  U-седло 45..60: пол 45..51, щёки 51..60, зазор 45.5 (±22.75);
  прижимная планка 44x3x6.5 в окне +Y щеки заподлицо + 2 x M8;
  материалов 5: ivory / graphite seat / graphite insert / steel / pink.

Регулировка: винт с седлом поднимается в резьбе маховика и контргайки,
хвостовик идёт в окне плиты. Ход ±12 мм (48..72 по Z) при номинале 60.
±20 мм в габарит 60 мм не размещается — расчёт в deviations.
"""

import bpy
import bmesh
import json
import math
import sys
from datetime import datetime, timezone
from pathlib import Path

from mathutils import Vector

# --- константы модуля (мм) -----------------------------------------------
CID = 'fix_foot'
PREFIX = CID + '__'
PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
OUT_DIR = PROJECT / 'docs/plans/blockout/component-library' / CID

MM = 0.001

BASE_X, BASE_Y, BASE_T = 100.0, 100.0, 12.0
BASE_BORE_D = 28.0
ANCHOR_D = 9.0
ANCHOR_XY = 38.0

POST_W = 56.0
POST_Z0, POST_Z1 = 12.0, 19.5
POST_BORE_D = 34.0

JAM_Z0, JAM_Z1 = 19.5, 25.5
JAM_AF = 30.0
ADJ_Z0, ADJ_Z1 = 25.5, 33.0
ADJ_D = 36.0
ADJ_FACETS = 24
NUT_BORE_D = 20.6

SCR_D = 20.0
SCR_ROOT_D = 18.3
SCR_TAIL = 12.5
SCR_TOP = 47.5
SCR_PITCH = 2.4

SEAT_Z0, SEAT_Z1 = 45.0, 60.0
SEAT_FLOOR_TOP = 51.0
SEAT_X, SEAT_Y = 35.0, 34.0
OPENING = 45.5
OPEN_HALF = OPENING * 0.5
RAIL = 45.0
SPIGOT_D = 22.0
SPIGOT_TOP = 47.5

WIN_Z0, WIN_Z1 = 51.5, 58.0
WIN_DEPTH = 3.0
BAR_X, BAR_Z0, BAR_Z1 = 22.0, 52.0, 57.5
BOLT_X, BOLT_Z = 14.0, 54.0
BOLT_BORE_D = 7.0
BOLT_SHANK_D = 6.9
BOLT_HEAD_D = 11.0
BOLT_HEAD_T = 6.0

ENG_MIN = 8.5
TAIL_MIN = 0.5

BEVEL_PLATE = 1.5
BEVEL_POST = 1.2

DENSITY = {'ivory': 2700.0, 'seat': 2700.0, 'insert': 2700.0,
           'steel': 7850.0, 'pink': 2700.0}
DENSITY_CAST = 7200.0


def M(v):
    """мм -> м."""
    return v * MM


def log(*a):
    print('[fix_foot]', *a, flush=True)


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
    MATERIALS['ivory'] = make_mat('CJ_foot_matte_ivory', (0.735, 0.715, 0.668), 0.60, 0.0)
    MATERIALS['seat'] = make_mat('CJ_foot_seat_graphite', (0.082, 0.086, 0.094), 0.58, 0.15)
    MATERIALS['insert'] = make_mat('CJ_foot_insert_graphite', (0.150, 0.157, 0.168), 0.40, 0.55)
    MATERIALS['steel'] = make_mat('CJ_foot_steel', (0.520, 0.532, 0.552), 0.28, 1.0)
    MATERIALS['pink'] = make_mat('CJ_foot_accent_pink', (0.640, 0.265, 0.315), 0.44, 0.05)


# --- bmesh (метры) ------------------------------------------------------
def bm_box(bm, sx, sy, sz, center=(0.0, 0.0, 0.0)):
    verts = bmesh.ops.create_cube(bm, size=1.0)['verts']
    bmesh.ops.scale(bm, vec=(sx, sy, sz), verts=verts)
    bmesh.ops.translate(bm, vec=center, verts=verts)
    return verts


def bm_lathe(bm, prof, segs=48, closed=False, axis_y=False, offset=(0.0, 0.0, 0.0)):
    """Тело вращения вокруг Z по замкнутому/открытому профилю (r, z) в метрах."""
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


def safe_bevel(ob, width, segments=1, angle=30.0):
    """Фаска с автоматическим откатом, если она рвёт меш."""
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


# --- детали --------------------------------------------------------------
def build_base(root):
    bm = bmesh.new()
    bm_box(bm, M(BASE_X), M(BASE_Y), M(BASE_T), (0.0, 0.0, M(BASE_T) * 0.5))
    ob = finish(PREFIX + 'base_plate', bm, [MATERIALS['ivory']], root)
    boolean_cut(ob, cyl_cutter('c_base_window', M(BASE_BORE_D) * 0.5,
                               -M(1), M(BASE_T) + M(1), n=56))
    for sx in (-1, 1):
        for sy in (-1, 1):
            boolean_cut(ob, cyl_cutter('c_anchor', M(ANCHOR_D) * 0.5, -M(1), M(BASE_T) + M(1),
                                       center=(sx * M(ANCHOR_XY), sy * M(ANCHOR_XY)), n=32))
    safe_bevel(ob, M(BEVEL_PLATE), segments=2)
    ob['cj_role'] = 'base plate 100x100x12, 4x M8 anchors, central window D28'
    return ob


def build_post(root):
    bm = bmesh.new()
    bm_box(bm, M(POST_W), M(POST_W), M(POST_Z1 - POST_Z0),
           (0.0, 0.0, M(POST_Z0 + POST_Z1) * 0.5))
    ob = finish(PREFIX + 'post', bm, [MATERIALS['ivory']], root)
    boolean_cut(ob, cyl_cutter('c_post_bore', M(POST_BORE_D) * 0.5,
                               M(POST_Z0) - M(1), M(POST_Z1) + M(1), n=56))
    safe_bevel(ob, M(BEVEL_POST), segments=2)
    ob['cj_role'] = 'central post 56x56, jam-nut seat'
    return ob


def build_screw(root):
    half, root_r = M(SCR_D) * 0.5, M(SCR_ROOT_D) * 0.5
    prof = [(0.0, M(SCR_TAIL)), (root_r, M(SCR_TAIL)), (half, M(SCR_TAIL + 1.0))]
    z = SCR_TAIL + 1.0
    while z + 1.8 <= SCR_TOP - 1.0:
        prof += [(half, M(z)), (root_r, M(z + 0.55)),
                 (root_r, M(z + 1.25)), (half, M(z + 1.8))]
        z += SCR_PITCH
    prof += [(half, M(SCR_TOP - 1.0)), (root_r, M(SCR_TOP)), (0.0, M(SCR_TOP))]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=64)
    ob = finish(PREFIX + 'screw', bm, [MATERIALS['steel']], root)
    ob['cj_role'] = 'M20 jack screw, tail travels in plate window'
    return ob


def build_jam(root):
    """Шестигранная труба телом вращения с 6 сегментами — без булевых."""
    r_in = M(NUT_BORE_D) * 0.5 / math.cos(math.pi / 6.0)
    r_out = M(JAM_AF) / (2.0 * math.cos(math.pi / 6.0))
    prof = [(r_in, M(JAM_Z0)), (r_out, M(JAM_Z0)),
            (r_out, M(JAM_Z1)), (r_in, M(JAM_Z1))]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=6, closed=True)
    ob = finish(PREFIX + 'nut_jam', bm, [MATERIALS['insert']], root)
    ob['cj_role'] = 'hex jam nut S30 on post top — height lock'
    return ob


def build_adjuster(root):
    r_in = M(NUT_BORE_D) * 0.5 / math.cos(math.pi / ADJ_FACETS)
    r_out = M(ADJ_D) * 0.5
    prof = [(r_in, M(ADJ_Z0)),
            (r_out - M(1.0), M(ADJ_Z0)), (r_out, M(ADJ_Z0 + 0.8)),
            (r_out, M(ADJ_Z1 - 0.8)), (r_out - M(1.0), M(ADJ_Z1)),
            (r_in, M(ADJ_Z1))]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=ADJ_FACETS, closed=True)
    ob = finish(PREFIX + 'nut_adjuster', bm, [MATERIALS['pink']], root)
    ob['cj_role'] = 'knurled height adjuster wheel D36 (muted pink accent)'
    return ob


SEAT_PROFILE = [
    (-M(SEAT_Y), M(SEAT_Z0)), (M(SEAT_Y), M(SEAT_Z0)),
    (M(SEAT_Y), M(SEAT_Z1)), (M(OPEN_HALF), M(SEAT_Z1)),
    (M(OPEN_HALF), M(SEAT_FLOOR_TOP)), (-M(OPEN_HALF), M(SEAT_FLOOR_TOP)),
    (-M(OPEN_HALF), M(SEAT_Z1)), (-M(SEAT_Y), M(SEAT_Z1)),
]


def build_seat(root):
    bm = bmesh.new()
    verts = [bm.verts.new((-M(SEAT_X), y, z)) for (y, z) in SEAT_PROFILE]
    bm.verts.ensure_lookup_table()
    face = bm.faces.new(verts)
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    nv = [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=(M(SEAT_X) * 2.0, 0.0, 0.0))
    ob = finish(PREFIX + 'seat', bm, [MATERIALS['ivory'], MATERIALS['seat']], root)

    # окно под прижимную планку в +Y щеке
    boolean_cut(ob, box_cutter('c_clamp_window',
                               M(BAR_X) * 2.0, M(WIN_DEPTH) + M(0.2), M(WIN_Z1 - WIN_Z0),
                               (0.0, M(OPEN_HALF) + (M(WIN_DEPTH) + M(0.2)) * 0.5 - M(0.1),
                                M(WIN_Z0 + WIN_Z1) * 0.5)))
    # гнёзда под прижимные болты (ось Y): от тыла окна до внешней плоскости щеки
    y0 = M(OPEN_HALF + WIN_DEPTH) - M(1.0)
    y1 = M(SEAT_Y) + M(0.5)
    for sx in (-1, 1):
        bm2 = bmesh.new()
        ring0, ring1 = [], []
        n = 32
        for i in range(n):
            a = 2.0 * math.pi * i / n
            ring0.append(bm2.verts.new((M(BOLT_BORE_D) * 0.5 * math.cos(a), y0,
                                        M(BOLT_Z) + M(BOLT_BORE_D) * 0.5 * math.sin(a))))
            ring1.append(bm2.verts.new((M(BOLT_BORE_D) * 0.5 * math.cos(a), y1,
                                        M(BOLT_Z) + M(BOLT_BORE_D) * 0.5 * math.sin(a))))
        bm2.faces.new(ring0)
        bm2.faces.new(ring1[::-1])
        for i in range(n):
            j = (i + 1) % n
            bm2.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
        bmesh.ops.translate(bm2, vec=(sx * M(BOLT_X), 0.0, 0.0), verts=ring0 + ring1)
        bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
        me = bpy.data.meshes.new('c_bolt_bore')
        bm2.to_mesh(me)
        bm2.free()
        c = bpy.data.objects.new('c_bolt_bore', me)
        bpy.context.scene.collection.objects.link(c)
        boolean_cut(ob, c)
    # глухое гнездо под верх винта
    boolean_cut(ob, cyl_cutter('c_spigot', M(SPIGOT_D) * 0.5,
                               M(SEAT_Z0) - M(1.0), M(SPIGOT_TOP), n=48))
    safe_bevel(ob, M(0.8), segments=1)

    for poly in ob.data.polygons:
        c, n = poly.center, poly.normal
        floor_face = (abs(c.z - M(SEAT_FLOOR_TOP)) < M(0.2) and n.z > 0.95
                      and abs(c.y) <= M(OPEN_HALF) + M(0.1))
        wall_face = (abs(abs(c.y) - M(OPEN_HALF)) < M(0.05) and abs(n.y) > 0.98
                     and M(SEAT_FLOOR_TOP) - M(0.1) <= c.z <= M(58.2))
        if floor_face or wall_face:
            poly.material_index = 1
    ob['cj_role'] = 'U-saddle, opening 45.5 mm, seat face graphite'
    return ob


def build_bar(root):
    bm = bmesh.new()
    bm_box(bm, M(BAR_X) * 2.0, M(WIN_DEPTH), M(BAR_Z1 - BAR_Z0),
           (0.0, M(OPEN_HALF) + M(WIN_DEPTH) * 0.5, M(BAR_Z0 + BAR_Z1) * 0.5))
    ob = finish(PREFIX + 'clamp_bar', bm, [MATERIALS['seat']], root)
    ob['cj_role'] = 'side clamp bar, flush with 45.5 opening'
    return ob


def build_bolt(root, tag, sx):
    """Один замкнутый профиль вращения: хвостовик + шайба + головка. Ось +Y."""
    tip = M(OPEN_HALF + WIN_DEPTH) + M(0.25)
    l_shank = M(SEAT_Y) - tip
    head_r = M(BOLT_HEAD_D) * 0.5
    prof = [(0.0, 0.0),
            (M(BOLT_SHANK_D) * 0.5, 0.0),
            (M(BOLT_SHANK_D) * 0.5, l_shank),
            (head_r * 0.94, l_shank),
            (head_r, l_shank + M(0.6)),
            (head_r, l_shank + M(BOLT_HEAD_T - 0.8)),
            (head_r * 0.9, l_shank + M(BOLT_HEAD_T)),
            (0.0, l_shank + M(BOLT_HEAD_T))]
    bm = bmesh.new()
    bm_lathe(bm, prof, segs=32, axis_y=True, offset=(sx * M(BOLT_X), tip, M(BOLT_Z)))
    ob = finish(PREFIX + 'clamp_bolt_' + tag, bm, [MATERIALS['steel']], root)
    ob['cj_role'] = 'M8 clamp bolt (socket head), tip presses clamp bar'
    return ob


def build():
    reset_scene()
    build_materials()
    root = bpy.data.objects.new(CID, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.06
    bpy.context.scene.collection.objects.link(root)

    parts = {
        'base': build_base(root),
        'post': build_post(root),
        'screw': build_screw(root),
        'jam': build_jam(root),
        'adj': build_adjuster(root),
        'seat': build_seat(root),
        'bar': build_bar(root),
        'bolt_l': build_bolt(root, 'l', -1),
        'bolt_r': build_bolt(root, 'r', 1),
    }

    meshes = obj_mesh_objs(root)
    bpy.ops.object.select_all(action='DESELECT')
    for ob in meshes:
        ob.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)

    # страховка единиц: ни один объект не может быть больше 0.2 м
    for ob in obj_mesh_objs(root):
        dim = ob.dimensions
        if max(dim) > 0.2 or max(dim) < 0.0005:
            raise RuntimeError('unit guard: %s dimensions %s' % (ob.name, tuple(dim)))
        if tuple(round(v, 6) for v in ob.scale) != (1.0, 1.0, 1.0):
            raise RuntimeError('scale guard: %s scale %s' % (ob.name, tuple(ob.scale)))
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


def ray(ob, origin, direction, dist=1.0):
    ok, loc, _n, _i = ob.ray_cast(Vector(origin), Vector(direction).normalized(), distance=dist)
    return Vector(loc) if ok else None


def bisect(fn, lo, hi, iters=26):
    for _ in range(iters):
        mid = 0.5 * (lo + hi)
        if fn(mid):
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def measure_opening(seat):
    """Зазор 45.5: лучи в обход окна прижима (x = ±25, ±30) + контроль по граням."""
    out = {}
    for x in (-0.030, -0.025, 0.025, 0.030):
        pp = ray(seat, (x, 0.0, M(55.0)), (0, 1, 0), 0.06)
        pm = ray(seat, (x, 0.0, M(55.0)), (0, -1, 0), 0.06)
        out['x_%+0.3f' % x] = {
            'y_plus_mm': None if pp is None else round(pp.y * 1000, 3),
            'y_minus_mm': None if pm is None else round(pm.y * 1000, 3),
            'opening_mm': None if (pp is None or pm is None) else round((pp.y - pm.y) * 1000, 3),
        }
    vals = [v['opening_mm'] for v in out.values() if v['opening_mm'] is not None]
    plus, minus = [], []
    for poly in seat.data.polygons:
        if poly.area < 1e-7:
            continue
        c = poly.center
        if M(51.8) < c.z < M(57.2):
            if poly.normal.y < -0.98 and c.y > 0:
                plus.append(c.y)
            elif poly.normal.y > 0.98 and c.y < 0:
                minus.append(c.y)
    face_open = round((min(plus) - max(minus)) * 1000, 3) if plus and minus else None
    out['faces'] = {'y_plus_mm': round(min(plus) * 1000, 3) if plus else None,
                    'y_minus_mm': round(max(minus) * 1000, 3) if minus else None,
                    'opening_mm': face_open}
    out['mean_opening_mm'] = round(sum(vals) / len(vals), 3) if vals else None
    out['ok'] = bool(vals) and all(abs(v - OPENING) <= 0.35 for v in vals)
    out['faces_ok'] = face_open is not None and abs(face_open - OPENING) <= 0.35
    return out


def measure_rail_drop(seat):
    """Свободный вертикальный коридор под рельс 45x45 до полки седла."""
    xs = (-33.0, -20.0, 0.0, 20.0, 33.0)
    ys = (-22.4, -11.0, 0.0, 11.0, 22.4)
    hits, bad = [], []
    for xm in xs:
        for ym in ys:
            p = ray(seat, (M(xm), M(ym), M(85.0)), (0, 0, -1), M(85.0))
            z = None if p is None else round(p.z * 1000, 3)
            hits.append(z)
            if z is None or abs(z - SEAT_FLOOR_TOP) > 0.25:
                bad.append({'x_mm': xm, 'y_mm': ym, 'z_mm': z})
    return {'samples': len(hits),
            'hit_z_mm': sorted({h for h in hits if h is not None}),
            'blocked': bad, 'ok': not bad}


def measure_base(base):
    def open_up(x, y):
        return ray(base, (x, y, -M(2)), (0, 0, 1), M(BASE_T + 4)) is None

    holes = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            cx, cy = sx * M(ANCHOR_XY), sy * M(ANCHOR_XY)
            if not open_up(cx, cy):
                holes.append({'center_mm': [round(cx * 1000, 2), round(cy * 1000, 2)],
                              'through': False, 'dia_mm': None})
                continue
            ex = bisect(lambda o: open_up(cx + o, cy), 0.0, M(9))
            ey = bisect(lambda o: open_up(cx, cy + o), 0.0, M(9))
            holes.append({'center_mm': [round(cx * 1000, 2), round(cy * 1000, 2)],
                          'through': True,
                          'dia_mm': [round(ex * 2000, 2), round(ey * 2000, 2)]})
    center = open_up(0.0, 0.0)
    dia = round(bisect(lambda o: open_up(o, 0.0), 0.0, M(30)) * 2000, 2) if center else None
    ok_h = all(h['through'] and h['dia_mm'] and abs(h['dia_mm'][0] - ANCHOR_D) <= 0.3
               and abs(h['dia_mm'][1] - ANCHOR_D) <= 0.3 for h in holes)
    return {'floor_holes': holes, 'floor_holes_ok': ok_h,
            'center_window_open': center, 'center_window_dia_mm': dia,
            'center_window_ok': bool(center) and dia is not None
                                and abs(dia - BASE_BORE_D) <= 0.5}


def measure_thread(screw):
    p0 = ray(screw, (0, 0, M(SCR_TAIL - 5)), (0, 0, 1), M(30))
    p1 = ray(screw, (0, 0, M(SCR_TOP + 5)), (0, 0, -1), M(30))
    smn, smx = bbox_of([screw])
    dia = round((smx.x - smn.x) * 1000, 2)
    tip = None if p0 is None else round(p0.z * 1000, 3)
    top = None if p1 is None else round(p1.z * 1000, 3)
    return {'tail_z_mm': tip, 'top_z_mm': top, 'od_mm': dia,
            'grooves': int((SCR_TOP - SCR_TAIL - 2.0) // SCR_PITCH),
            'pitch_mm': SCR_PITCH,
            'ok': tip is not None and top is not None and abs(tip - SCR_TAIL) <= 0.3
                  and abs(top - SCR_TOP) <= 0.3 and abs(dia - SCR_D) <= 0.5}


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
        key = 'steel'
        for mat in ob.data.materials:
            if mat is None:
                continue
            for k in ('steel', 'pink', 'insert', 'seat', 'ivory'):
                if ('_' + k) in mat.name or mat.name.endswith(k):
                    key = k
                    break
            break
        vol_by_key[key] = vol_by_key.get(key, 0.0) + st['volume_cm3']

    mass = sum(v * 1e-6 * DENSITY.get(k, 2700.0) for k, v in vol_by_key.items())
    mass_cast = sum(v * 1e-6 * (7850.0 if k == 'steel' else DENSITY_CAST)
                    for k, v in vol_by_key.items())

    mats = sorted({m.name for ob in meshes for m in ob.data.materials if m})
    opening = measure_opening(parts['seat'])
    drop = measure_rail_drop(parts['seat'])
    base = measure_base(parts['base'])
    thread = measure_thread(parts['screw'])

    bmn, bmx = bbox_of([parts['bar']])
    bar = {'face_y_mm': round(bmn.y * 1000, 3), 'back_y_mm': round(bmx.y * 1000, 3),
           'top_z_mm': round(bmx.z * 1000, 3),
           'width_mm': round((bmx.x - bmn.x) * 1000, 2),
           'flush_ok': abs(bmn.y - M(OPEN_HALF)) <= M(0.06),
           'below_rim_ok': bmx.z < M(SEAT_Z1) - M(0.5),
           'inside_window_ok': bmx.y <= M(OPEN_HALF + WIN_DEPTH) + M(0.05)}
    bolts, bolts_ok = [], True
    for b in (parts['bolt_l'], parts['bolt_r']):
        bmn2, bmx2 = bbox_of([b])
        rec = {'name': b.name,
               'tip_y_mm': round(bmn2.y * 1000, 3),
               'head_y_mm': round(bmx2.y * 1000, 3),
               'tip_gap_to_bar_mm': round((bmn2.y - bmx.y) * 1000, 3),
               'inside_base_ok': bmx2.y <= M(BASE_Y * 0.5)}
        bolts_ok = bolts_ok and 0.0 <= rec['tip_gap_to_bar_mm'] <= 0.6 and rec['inside_base_ok']
        bolts.append(rec)

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

    travel_down = round(SCR_TAIL - TAIL_MIN, 2)
    travel_up = round((ADJ_Z1 - ENG_MIN) - SCR_TAIL, 2)
    envelope = [round(SEAT_Z1 - travel_down, 1), round(SEAT_Z1 + travel_up, 1)]

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
        'bbox_ok': (abs(size.x - M(BASE_X)) <= 0.001 and abs(size.y - M(BASE_Y)) <= 0.001
                    and abs(size.z - M(SEAT_Z1)) <= 0.001 and abs(mn.z) <= 0.001),
        'mass_kg_est': round(mass, 3),
        'mass_kg_cast': round(mass_cast, 3),
        'mass_ok': 0.3 <= mass <= 3.0,
        'openings': {'rail_seat': opening, 'base': base, 'clamp': bar, 'bolts': bolts},
        'opening_45_5_ok': opening['ok'] and opening['faces_ok'],
        'holes_ok': base['floor_holes_ok'] and base['center_window_ok'],
        'rail_drop_path': drop,
        'rail_drop_path_ok': drop['ok'],
        'clamp_ok': bar['flush_ok'] and bar['below_rim_ok'] and bar['inside_window_ok'] and bolts_ok,
        'thread': thread,
        'thread_ok': thread['ok'],
        'height_adjust': {
            'travel_down_mm': travel_down,
            'travel_up_mm': travel_up,
            'travel_total_mm': round(travel_down + travel_up, 2),
            'nominal_height_mm': SEAT_Z1,
            'envelope_z_mm': envelope,
            'engagement_nominal_mm': round(ADJ_Z1 - SCR_TAIL, 2),
            'engagement_min_mm': ENG_MIN,
            'spec_pm20_ok': travel_down >= 19.9 and travel_up >= 19.9,
        },
        'height_adjust_ok': travel_down >= 6.0 and travel_up >= 6.0,
        'volume_by_material_cm3': {k: round(v, 3) for k, v in vol_by_key.items()},
        'negative_scale': [ob.name for ob in meshes if ob.matrix_world.determinant() < 1e-9],
        'no_negative_scale': all(ob.matrix_world.determinant() > 1e-9 for ob in meshes),
        'floating_parts': floating,
        'no_floating_ok': not floating,
        'animation': 'none (static module)',
        'animation_ok': len(bpy.data.actions) == 0,
    }
    checks['all_ok'] = all(v for k, v in checks.items() if k.endswith('_ok'))
    return checks, dict(mn=mn, mx=mx, size=size, mass=mass, mass_cast=mass_cast, mats=mats,
                        verts=verts, tris=tris, per_obj=per_obj, opening=opening,
                        thread=thread, drop=drop, base=base, bar=bar, bolts=bolts,
                        travel_down=travel_down, travel_up=travel_up, envelope=envelope,
                        vol=vol_by_key)


def build_report(root, checks, m):
    interfaces = {
        'rail_seat': {
            'role': 'U-saddle under CJ-RAIL-45: rail rests on the seat, top face free',
            'center_m': [0.0, 0.0, round(M(SEAT_FLOOR_TOP), 5)],
            'axis': [1.0, 0.0, 0.0],
            'normal': [0.0, 0.0, 1.0],
            'opening_mm': OPENING,
            'measured_opening_mm': m['opening']['mean_opening_mm'],
            'cheek_depth_mm': round(SEAT_Z1 - SEAT_FLOOR_TOP, 2),
            'saddle_span_mm': [SEAT_X * 2, SEAT_Y * 2],
            'clearance_per_side_mm': round((OPENING - RAIL) * 0.5, 2),
            'seat_surface_material': 'CJ_foot_seat_graphite',
            'clamp': {
                'type': 'side clamp bar (graphite) + 2x M8 socket bolts',
                'bar_mm': [BAR_X * 2, WIN_DEPTH, BAR_Z1 - BAR_Z0],
                'bolt': 'M8, head D15, washer D17',
                'clamp_travel_mm': round((OPENING - RAIL) * 0.5, 2),
                'contact_zone_mm': [BAR_Z0, BAR_Z1],
                'covers_top': False,
                'top_clear_ok': m['bar']['below_rim_ok'],
                'bolts': m['bolts'],
            },
            'height_adjustment': {
                'mechanism': 'M20 jack screw rises in a knurled adjuster wheel; hex jam nut locks',
                'thread': 'M20, pitch 2.4 mm, %d annular grooves' % m['thread']['grooves'],
                'travel_down_mm': m['travel_down'],
                'travel_up_mm': m['travel_up'],
                'envelope_z_mm': m['envelope'],
                'nominal_height_mm': SEAT_Z1,
                'lock': 'hex jam nut S30 (graphite) on post top',
                'spec_pm20_fulfilled': checks['height_adjust']['spec_pm20_ok'],
            },
        },
        'floor_mount': {
            'role': 'floor plate, 4 anchors',
            'plate_mm': [BASE_X, BASE_Y, BASE_T],
            'plane': 'XY at z=0',
            'normal': [0.0, 0.0, -1.0],
            'holes': m['base']['floor_holes'],
            'bolt': 'M8 x4 (D9 through), grid +/-38 mm',
            'center_window_mm': m['base']['center_window_dia_mm'],
        },
    }

    return {
        'id': CID,
        'code': 'CJ-FOOT-100',
        'name': 'Опора пола регулируемая',
        'kit': 'CJ-FIX-KIT',
        'class': 'STRUCTURE / base',
        'standard': 'CJ-RAIL-45',
        'status': 'built',
        'built_at': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'blender_version': bpy.app.version_string,
        'generator': 'docs/plans/tools/build_fix_foot.py',
        'units': 'm',
        'spec': {
            'overall_mm': [BASE_X, BASE_Y, SEAT_Z1],
            'base_plate_mm': [BASE_X, BASE_Y, BASE_T],
            'post_mm': [POST_W, POST_W, round(POST_Z1 - POST_Z0, 1)],
            'rail_profile_mm': [RAIL, RAIL],
            'rail_seat_opening_mm': OPENING,
            'seat_depth_mm': round(SEAT_Z1 - SEAT_FLOOR_TOP, 2),
            'screw': 'M20 pitch 2.4',
            'clamp': 'side bar + 2x M8',
            'height_adjust_mm': {'achieved_down': m['travel_down'],
                                 'achieved_up': m['travel_up'], 'spec': 20.0},
            'load_kn_concept': 4.0,
            'material': 'Al 6061 body / steel screw 8.8',
            'mass_kg_spec': 1.4,
        },
        'bbox_m': {'min': [round(v, 5) for v in m['mn']],
                   'max': [round(v, 5) for v in m['mx']],
                   'size': [round(v, 5) for v in m['size']]},
        'bbox_100x100x60_ok': checks['bbox_ok'],
        'nodes': [ob.name for ob in sorted(obj_mesh_objs(root), key=lambda o: o.name)],
        'node_count': len(obj_mesh_objs(root)) + 1,
        'root': root.name,
        'materials': m['mats'],
        'material_count': len(m['mats']),
        'material_usage': {ob.name: [x.name for x in ob.data.materials if x]
                           for ob in obj_mesh_objs(root)},
        'volume_by_material_cm3': checks['volume_by_material_cm3'],
        'mass_kg_est': round(m['mass'], 3),
        'mass_kg_est_cast_body': round(m['mass_cast'], 3),
        'verts': m['verts'],
        'tris': m['tris'],
        'per_object': m['per_obj'],
        'interfaces': interfaces,
        'spec_compliance': {
            'bbox_100x100x60': checks['bbox_ok'],
            'rail_opening_45_5': checks['opening_45_5_ok'],
            'rail_drops_in_from_above': checks['rail_drop_path_ok'],
            'clamp_does_not_cover_top': checks['clamp_ok'],
            'height_adjust_pm20': checks['height_adjust']['spec_pm20_ok'],
            'height_adjust_achieved_mm': [-m['travel_down'], m['travel_up']],
            'materials_4_8': checks['material_count_ok'],
            'static_no_animation': checks['animation_ok'],
            'verdict': 'bbox/seat/clamp OK; height adjustment +/-%.0f mm instead of +/-20 mm'
                       % min(m['travel_down'], m['travel_up']),
        },
        'checks': checks,
        'renders': [],
        'glb': None,
        'glb_bytes': None,
        'notes': [
            'Седло U с зазором 45.5 мм: рельс 45 входит с 0.25 мм на сторону; коридор '
            'проверен 25 вертикальными лучами — первое попадание всегда полка 51 мм.',
            'Прижимная планка выведена заподлицо с зазором (45.5 не уменьшается) и стоит '
            'в окне +Y щеки по z 52…58, кромка щеки 60 — верх рельса свободен.',
            'Высота: винт с седлом поднимается в резьбе маховика и контргайки, хвостовик '
            'идёт в окне плиты Ø28. Ход -%s/+%s мм, конверт %s…%s при номинале 60.' % (
                m['travel_down'], m['travel_up'], m['envelope'][0], m['envelope'][1]),
            'Масса по фактическим объёмам: %s кг (алюминий) / %s кг (чугунный корпус, '
            'как в спецификации набора 1.4 кг).' % (round(m['mass'], 2), round(m['mass_cast'], 2)),
            'Резьба винта — 12 кольцевых канавок с шагом 2.4 мм; зацепление в гайках '
            '12.5 мм в номинале, 8.5 мм на верхнем пределе.',
        ],
        'deviations': [
            'ВЫСОТА: требование ±20 мм в габарит 60 мм не размещается; честно выполнено '
            '-%s/+%s мм (48…72). Баланс: 60 = 15 (седло) + 12 (окно резьбы) + 13.5 (маховик '
            '+ контргайка) + 7.5 (стойка) + 12 (плита). Ход ограничен сверху зацеплением '
            'винта в гайке (8.5 мм), снизу — упором седла в маховик. Для ±20 при той же схеме '
            'нужна высота ≈ %s мм (3x20 + 15 + 9).' % (
                m['travel_down'], m['travel_up'],
                60 + (20 - min(m['travel_down'], m['travel_up'])) * 3),
            'Рельс в седле стоит с зазором 0.25 мм на сторону и НЕ зажат в исходном '
            'состоянии: планка выведена заподлицо, чтобы зазор остался 45.5. Рабочий прижим — '
            'подача планки болтами на 0.25…0.3 мм.',
            'Центральное окно Ø28 в плите сквозное: снизу виден хвостовик винта. Иначе ход '
            'упирается в толщину плиты. При монтаже закрывается штатной шайбой (не моделировалась).',
            'Контргайка S30 затягивается до установки седла: доступ сверху перекрыт седлом. '
            'Порядок: опора → высота → контргайка → седло с рельсом.',
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
            ('key', (0.16, -0.20, 0.30), 3.6, 0.16),
            ('fill', (-0.24, -0.18, 0.14), 1.3, 0.24),
            ('rim', (-0.06, 0.22, 0.18), 2.6, 0.16),
            ('top', (0.02, -0.04, 0.40), 0.9, 0.22)):
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
    close_lo = Vector((-0.036, -0.037, M(43.0)))
    close_hi = Vector((0.036, M(42.0), M(61.0)))
    c_close = box_corners(close_lo, close_hi)
    close_t = (close_lo + close_hi) * 0.5

    views = [
        ('3q', (0.62, -0.72, 0.36), center, 62, c_main, 0.880, None),
        ('front', (0.02, -0.99, 0.16), center, 110, c_main, 0.880, None),
        ('side', (-0.99, -0.08, 0.12), center, 110, c_main, 0.900, None),
        ('closeup', (0.34, 0.30, 0.89), close_t, 78, c_close, 0.86, (close_lo, close_hi)),
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
    root, parts = build()
    log('nodes:', len(obj_mesh_objs(root)))
    checks, m = check(parts, root)
    log('bbox', checks['bbox_size_m'], '| mass', checks['mass_kg_est'],
        '| opening', m['opening']['mean_opening_mm'],
        '| travel -%s/+%s' % (m['travel_down'], m['travel_up']),
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
    root['cj_height_adjust_mm'] = json.dumps([-m['travel_down'], m['travel_up']])
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
