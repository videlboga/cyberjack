"""Standalone builder: fix_corner_node (CJ-NODE-45, «Угловой узел»).

Пилотный модуль набора CJ-FIX-KIT. L-образный угловой кронштейн для рельса
CJ-RAIL-45 (45x45), габарит 120 x 120 x 60 мм.

Схема (Blender Z-up, метры):
  - план: угол L в точке (0, 0); полка A вдоль +X (y 0..12), полка B вдоль +Y
    (x 0..12); высота 60;
  - монтажные плоскости — НАРУЖНЫЕ грани полок: y = 0 (нормаль -Y) и x = 0
    (нормаль -X). То есть торец рельса прижимается снаружи, рельс уходит
    наружу от узла (-Y и -X соответственно) и два рельса физически не
    пересекаются в угловом квадрате;
  - на каждой плоскости посадочное поле 45 x 45 (центр (60, z=30) и
    (60, z=30) соответственно), 4 отверстия M8 (Ø9) по сетке ±15 мм и
    штифт Ø6;
  - болты M8 ввёрнуты с ВОГНУТОЙ стороны (изнутри), головки утоплены в
    цековки Ø14.5 x 8.5 — габарит не растёт, «socket» доступен из
    раскрытого угла, а не замурован в косынке;
  - косынка — горизонтальное ребро 6 мм в верхней зоне (z 53.5..59.5),
    полностью вне зоны доступа ключа к головкам болтов.

Не зависит от build_component_library.py и прочих сборщиков.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_fix_corner_node.py

Выход:
  docs/plans/blockout/component-library/fix_corner_node/fix_corner_node.glb
  docs/plans/blockout/component-library/fix_corner_node/{3q,front,side,closeup}.png
  docs/plans/blockout/component-library/fix_corner_node/report.json

Отладка без рендера: CJ_SKIP_RENDER=1 (только геометрия, проверки, экспорт).
"""
from pathlib import Path
import json
import math
import os

import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/fix_corner_node'
CID = 'fix_corner_node'
PREFIX = CID + '__'
CODE = 'CJ-NODE-45'

# --- ключевые размеры (м) ------------------------------------------------
L = 0.120               # длина полки (план)
T = 0.012               # толщина полки
H = 0.060               # высота узла
SEAT = 0.045            # посадочное поле под торец рельса 45x45
SEAT_C = 0.060          # центр посадочного поля по длине полки
SEAT_Z = 0.030          # центр посадочного поля по высоте
BOLT_OFF = 0.015        # сетка M8: ±15 мм от центра поля
D_HOLE = 0.009          # Ø9 под M8
D_CBORE = 0.0145        # цековка под головку M8 (DIN 912 Ø13)
CBORE_DEPTH = 0.0085
PIN_D = 0.006           # штифт Ø6
PIN_V = 0.0             # штифт по центру поля (0, 0) — общее начало сетки M8

GUSSET_T = 0.006
GUSSET_Z0 = 0.0535
GUSSET_Z1 = 0.0595
GUSSET_LEG = 0.108      # вершина треугольника по обеим полкам
GUSSET_EMBED = 0.004    # заход в тело полки

BEVEL_BODY = 0.0010     # фаска корпуса 1.0 мм (паспорт: 1–2 мм)
BEVEL_EDGE = 0.0015     # фаска свободных кромок косынки

PALETTE = {
    'ivory': (0.855, 0.840, 0.808),
    'graphite': (0.085, 0.089, 0.099),
    'steel': (0.610, 0.620, 0.634),
    'blush': (0.855, 0.545, 0.590),
    'dark': (0.030, 0.032, 0.038),
}
MATS = {}

# Локальная система монтажной плоскости:
#   z = 0 — монтажная плоскость (торец рельса), материал z in [-T, 0],
#   z > 0 — пространство рельса, нормаль +Z смотрит НАРУЖУ узла.
M_FACE_A = Matrix(((1.0, 0.0, 0.0, SEAT_C),
                   (0.0, 0.0, -1.0, 0.0),
                   (0.0, 1.0, 0.0, SEAT_Z),
                   (0.0, 0.0, 0.0, 1.0)))
M_FACE_B = Matrix(((0.0, 0.0, -1.0, 0.0),
                   (-1.0, 0.0, 0.0, SEAT_C),
                   (0.0, 1.0, 0.0, SEAT_Z),
                   (0.0, 0.0, 0.0, 1.0)))


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    metal, rough = {
        'ivory': (0.0, 0.72),
        'graphite': (0.55, 0.44),
        'steel': (1.0, 0.26),
        'blush': (0.0, 0.38),
        'dark': (0.30, 0.55),
    }[role]
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def drop(obj):
    me = obj.data if obj.type == 'MESH' else None
    bpy.data.objects.remove(obj, do_unlink=True)
    if me is not None and me.users == 0:
        bpy.data.meshes.remove(me)


def bevel(obj, width, segments=2, angle=42.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    mod.use_clamp_overlap = True
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


def mesh_from_bm(name, bm, role, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def boolean(obj, cutter, op='DIFFERENCE'):
    select_only(obj)
    mod = obj.modifiers.new('bool', 'BOOLEAN')
    mod.operation = op
    mod.solver = 'EXACT'
    mod.object = cutter
    bpy.ops.object.modifier_apply(modifier=mod.name)
    drop(cutter)
    return obj


def join(names, new_name):
    objs = [bpy.data.objects[n] for n in names if n in bpy.data.objects]
    if not objs:
        raise ValueError(new_name)
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = new_name
    return obj


def cyl_local(name, radius, z0, z1, uv=(0.0, 0.0), verts=40):
    depth = abs(z1 - z0)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth,
        location=(uv[0], uv[1], (z0 + z1) * 0.5))
    obj = bpy.context.object
    obj.name = name
    return obj


def cyl(name, a, b, radius, role, verts=32, smooth=True, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-7:
        raise ValueError(name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius,
                                        depth=d.length,
                                        location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def place(obj, M):
    obj.matrix_world = M @ obj.matrix_world
    select_only(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


# --- корпус --------------------------------------------------------------
def l_solid(name, pts, z0, z1):
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z0)) for x, y in pts]
    face = bm.faces.new(vs)
    ret = bmesh.ops.extrude_face_region(bm, geom=[face])
    new_verts = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=new_verts, vec=(0.0, 0.0, z1 - z0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm, 'ivory', False)


def face_cutters(prefix, M, cutters):
    """Вырезы в локальной системе плоскости: z=0 — монтажная грань (торец
    рельса), материал z in [-T, 0], +z — пространство рельса.

    Только цилиндры: сквозное Ø9, цековка Ø14.5 изнутри, центральный Ø6.
    Никаких конусных фасок и рельефа — они дают неманифолдные кромки.
    """
    zf = -T
    made = []
    for i, (u, v) in enumerate(bolt_uv()):
        # сквозное Ø9
        made.append(cyl_local(f'{prefix}_cut_{i}_thru', D_HOLE * 0.5,
                              zf - 0.002, 0.002, (u, v)))
        # цековка Ø14.5 изнутри на глубину 8.5
        made.append(cyl_local(f'{prefix}_cut_{i}_cb', D_CBORE * 0.5,
                              zf - 0.002, zf + CBORE_DEPTH, (u, v)))
    # центральный Ø6 сквозной (посадка 6H7: отверстие 6.05)
    made.append(cyl_local(f'{prefix}_cut_pin', PIN_D * 0.5 + 0.000025,
                          zf - 0.002, 0.002, (0.0, PIN_V)))
    for o in made:
        place(o, M)
    cutters.extend(made)
    return made


def bolt_uv():
    return [(-BOLT_OFF, -BOLT_OFF), (-BOLT_OFF, BOLT_OFF),
            (BOLT_OFF, -BOLT_OFF), (BOLT_OFF, BOLT_OFF)]


def paint_cbore_seats(body):
    """Дно цековок — второй слот материала (CJ_dark_100).

    Только раскладка материала по существующим граням: геометрия не меняется.
    Монтажная грань — local z=0, материал в local z in [-T, 0], поэтому дно
    цековки лежит в world y = +(T - CBORE_DEPTH) для face_a и
    world x = +(T - CBORE_DEPTH) для face_b.
    """
    me = body.data
    me.materials.append(mat('dark'))
    idx = len(me.materials) - 1
    plane = T - CBORE_DEPTH
    n = 0
    for p in me.polygons:
        if all(abs(me.vertices[i].co[0] - plane) < 2e-6 for i in p.vertices) or \
                all(abs(me.vertices[i].co[1] - plane) < 2e-6 for i in p.vertices):
            p.material_index = idx
            n += 1
    if n == 0:
        raise RuntimeError('cbore seat faces not found: material slot unused')
    return body


def face_hardware(prefix, M):
    """Головки M8 с шестигранным гнездом, штифт Ø6, розовое кольцо."""
    zf = -T
    out = []
    seat = zf + CBORE_DEPTH          # дно цековки = опорная грань головки
    head0 = seat - 0.0080            # торец головки со стороны вогнутой грани
    for i, (u, v) in enumerate(bolt_uv()):
        head = cyl_local(f'{prefix}_bolt_{i}', 0.0065, head0, seat, (u, v),
                         verts=40)
        place(head, M)
        bevel(head, 0.0004, 2, 40.0)
        apply(head, 'graphite', False)
        head.data.polygons.foreach_set(
            'use_smooth', [True] * len(head.data.polygons))
        head.data.update()
        # шестигранное гнездо 5.7 A/F, глубина 4.2, открыто в вогнутую сторону
        hexa = cyl_local(f'{prefix}_hex_{i}', 0.0033, head0 - 0.0015,
                         head0 + 0.0042, (u, v), verts=6)
        place(hexa, M)
        boolean(head, hexa)
        out.append(head)
    pin = cyl_local(f'{prefix}_pin', PIN_D * 0.5, zf, 0.0, (0.0, PIN_V), verts=32)
    place(pin, M)
    bevel(pin, 0.0004, 2, 40.0)
    apply(pin, 'steel', True)
    out.append(pin)
    return out


def build():
    reset()
    parts = []

    # корпус: L в плане, высота H
    poly = [(0.0, 0.0), (L, 0.0), (L, T), (T, T), (T, L), (0.0, L)]
    body = l_solid(PREFIX + 'body', poly, 0.0, H)

    # косынка: ребро 6 мм в верхней зоне, заходит в обе полки; свободная
    # кромка — вогнутая дуга (литой радиус в углу), вогнутость в сторону угла
    bm = bmesh.new()
    e = GUSSET_EMBED
    R = GUSSET_LEG - e
    arc = [(e, e), (GUSSET_LEG, e)]
    for i in range(1, 17):
        a = math.radians(-90.0 - 90.0 * i / 17.0)
        arc.append((GUSSET_LEG + R * math.cos(a), GUSSET_LEG + R * math.sin(a)))
    vs = [bm.verts.new((x, y, GUSSET_Z0)) for x, y in arc]
    face = bm.faces.new(vs)
    ret = bmesh.ops.extrude_face_region(bm, geom=[face])
    nv = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=(0.0, 0.0, GUSSET_Z1 - GUSSET_Z0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    gusset = mesh_from_bm(PREFIX + 'gusset', bm, 'ivory', False)
    bevel(gusset, BEVEL_EDGE, 2, 42.0)

    # фаски снимаются до вырезов: на чистом теле bevel даёт ровную кромку,
    # а на меше с десятками отверстий — тысячи вырожденных граней
    bevel(body, BEVEL_BODY, 2, 42.0)

    # объединение корпуса и косынки в одно тело
    boolean(body, gusset, 'UNION')

    # отверстия: по одному чистому цилиндру-вырезу (склейка вырезов в один
    # меш даёт самопересечение и рваные кромки на EXACT-солвере)
    cutters = []
    face_cutters(PREFIX + 'a', M_FACE_A, cutters)
    face_cutters(PREFIX + 'b', M_FACE_B, cutters)
    for c in cutters:
        boolean(body, c, 'DIFFERENCE')
    paint_cbore_seats(body)
    body.data.polygons.foreach_set(
        'use_smooth', [False] * len(body.data.polygons))
    body.data.update()
    parts.append(body)

    parts.extend(face_hardware(PREFIX + 'a', M_FACE_A))
    parts.extend(face_hardware(PREFIX + 'b', M_FACE_B))

    # корень
    root = bpy.data.objects.new(CID, None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.03
    bpy.context.scene.collection.objects.link(root)
    for o in parts:
        if not o.name.startswith(PREFIX):
            raise RuntimeError(f'bad name {o.name}')
        o.parent = root
        o.matrix_parent_inverse = root.matrix_world.inverted()
    return root, parts


# --- измерения -----------------------------------------------------------
def mesh_objects():
    return [o for o in bpy.data.objects
            if o.type == 'MESH' and o.name.startswith(PREFIX)]


def bbox(objs=None):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in (objs if objs is not None else mesh_objects()):
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def bvh_of(objs):
    verts, polys = [], []
    for o in objs:
        mw = o.matrix_world
        base = len(verts)
        verts.extend([mw @ v.co for v in o.data.vertices])
        for p in o.data.polygons:
            polys.append([base + i for i in p.vertices])
    return BVHTree.FromPolygons(verts, polys, all_triangles=False, epsilon=0.0)


def hit(bvh, origin, direction, dist=1.0):
    loc, nrm, idx, d = bvh.ray_cast(Vector(origin), Vector(direction), dist)
    return (loc, d) if loc is not None else (None, None)


FACE_SPECS = {
    'face_a': dict(M=M_FACE_A, n=Vector((0.0, -1.0, 0.0)),
                   u=Vector((1.0, 0.0, 0.0)), v=Vector((0.0, 0.0, 1.0)),
                   center=Vector((SEAT_C, 0.0, SEAT_Z))),
    'face_b': dict(M=M_FACE_B, n=Vector((-1.0, 0.0, 0.0)),
                   u=Vector((0.0, 1.0, 0.0)), v=Vector((0.0, 0.0, 1.0)),
                   center=Vector((0.0, SEAT_C, SEAT_Z))),
}


def check_holes(body_bvh, all_bvh, spec):
    n, u, v, c = spec['n'], spec['u'], spec['v'], spec['center']
    out = {'bolts': [], 'pin': {}}

    def local(uu, vv):
        return c + u * uu + v * vv

    for i, (uu, vv) in enumerate(bolt_uv()):
        p = local(uu, vv)
        o_out = p + n * 0.040
        loc_through, d_through = hit(body_bvh, o_out, -n, 0.080)
        # в корпусе по оси болта материала быть не должно
        open_hole = loc_through is None
        # головка в цековке: луч снаружи упирается в низ головки на 8.5 мм
        loc_b, d_b = hit(all_bvh, o_out, -n, 0.080)
        head_z = None
        if loc_b is not None:
            head_z = round(-(loc_b - p).dot(n) * 1000.0, 2)
        # стенка отверстия на r=5.5
        wall = []
        for du, dv in ((0.0055, 0.0), (-0.0055, 0.0), (0.0, 0.0055), (0.0, -0.0055)):
            lp, dd = hit(body_bvh, local(uu + du, vv + dv) + n * 0.040, -n, 0.080)
            wall.append(round((0.040 - dd) * 1000.0, 2) if dd is not None else None)
        # цековка: луч изнутри на r=6.5 упирается в дно цековки
        ino = local(uu + 0.0065, vv) - n * 0.040
        loc_cb, d_cb = hit(body_bvh, ino, n, 0.080)
        cb_depth = round((d_cb - 0.040 + T) * 1000.0, 2) if d_cb is not None else None
        ino2 = local(uu + 0.0085, vv) - n * 0.040
        loc_cb2, d_cb2 = hit(body_bvh, ino2, n, 0.080)
        cb_wall = round((d_cb2 - 0.040 + T) * 1000.0, 2) if d_cb2 is not None else None
        out['bolts'].append({
            'index': i,
            'coord_m': [round(x, 5) for x in p],
            'through_open': bool(open_hole),
            'head_face_mm': head_z,
            'wall_hits_mm': wall,
            'counterbore_depth_mm': cb_depth,
            'counterbore_wall_mm': cb_wall,
        })

    # штифт
    pp = local(0.0, PIN_V)
    o_out = pp + n * 0.040
    loc_pin, d_pin = hit(all_bvh, o_out, -n, 0.080)
    out['pin'] = {
        'coord_m': [round(x, 5) for x in pp],
        'present': loc_pin is not None,
        'tip_offset_mm': round((0.040 - d_pin) * 1000.0, 2) if d_pin is not None else None,
        'hole_open_in_body': hit(body_bvh, o_out, -n, 0.080)[0] is None,
    }
    return out


def check_face_access(bvh_all, spec):
    """Свободна ли плоскость под торец рельса: лучи на 10 мм перед плоскостью."""
    n, u, v, c = spec['n'], spec['u'], spec['v'], spec['center']
    worst = 0.0
    blocked = 0
    samples = 0
    for i in range(-4, 5):
        for j in range(-4, 5):
            uu, vv = i * 0.005, j * 0.005
            if abs(uu) > SEAT / 2 - 0.001 or abs(vv) > SEAT / 2 - 0.001:
                continue
            skip = False
            for bu, bv in bolt_uv():
                if math.hypot(uu - bu, vv - bv) < 0.0068:
                    skip = True
            if math.hypot(uu - 0.0, vv - PIN_V) < 0.0062:
                skip = True
            if skip:
                continue
            p = c + u * uu + v * vv + n * 0.010
            loc, d = hit(bvh_all, p, -n, 0.040)
            samples += 1
            if loc is None:
                blocked += 1
                continue
            intr = (0.010 - d) * 1000.0
            worst = max(worst, intr)
            if intr > 1.0:
                blocked += 1
    return {'samples': samples, 'blocked': blocked,
            'max_intrusion_mm': round(worst, 2)}


def check():
    objs = mesh_objects()
    mn, mx = bbox()
    size = mx - mn
    rep = {
        'id': CID,
        'code': CODE,
        'kit': 'CJ-FIX-KIT',
        'standard': 'CJ-NODE-45',
        'blender_version': bpy.app.version_string,
        'nodes': sorted([o.name for o in bpy.data.objects
                         if o.name.startswith(PREFIX) or o.name == CID]),
        'node_count': len([o for o in bpy.data.objects
                           if o.name.startswith(PREFIX)]),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if o.type == 'MESH' and not o.name.startswith(PREFIX)),
        'bbox_m': {
            'min': [round(x, 5) for x in mn],
            'max': [round(x, 5) for x in mx],
            'size': [round(x, 5) for x in size],
            'nominal': [0.120, 0.120, 0.060],
            'ok': bool(all(abs(size[i] - v) < 0.0015
                           for i, v in enumerate((0.120, 0.120, 0.060)))),
        },
        'materials': sorted({o.data.materials[p.material_index].name
                             for o in objs for p in o.data.polygons
                             if p.material_index < len(o.data.materials)
                             and o.data.materials[p.material_index]}),
    }
    rep['material_count'] = len(rep['materials'])
    rep['material_usage'] = {
        m.name: sum(1 for o in objs for p in o.data.polygons
                    if p.material_index < len(o.data.materials)
                    and o.data.materials[p.material_index]
                    and o.data.materials[p.material_index].name == m.name)
        for m in bpy.data.materials
    }

    tris = 0
    verts = 0
    vol = 0.0
    non_manifold = 0
    degenerate = 0
    per_object = {}
    for o in objs:
        me = o.data
        tris += sum(len(p.vertices) - 2 for p in me.polygons)
        verts += len(me.vertices)
        bm = bmesh.new()
        bm.from_mesh(me)
        nm = len([e for e in bm.edges if len(e.link_faces) != 2])
        dg = len([f for f in bm.faces if f.calc_area() < 1e-10])
        non_manifold += nm
        degenerate += dg
        if o.name == PREFIX + 'body':
            vol = abs(bm.calc_volume(signed=True))
        per_object[o.name] = {'verts': len(me.vertices), 'non_manifold': nm}
        bm.free()
    rep['triangles'] = tris
    rep['verts'] = verts
    rep['volume_cm3'] = round(vol * 1e6, 1)
    rep['mass_kg_spec'] = 1.1
    rep['mass_est_kg'] = {
        'alu_2_70': round(vol * 2700.0, 3),
        'steel_7_85': round(vol * 7850.0, 3),
    }

    neg_scale = [o.name for o in bpy.data.objects
                 if any(s < 0 for s in o.scale)
                 or o.matrix_world.to_3x3().determinant() < 0]

    body_bvh = bvh_of([bpy.data.objects[PREFIX + 'body']])
    all_bvh = bvh_of(objs)

    ifaces = {}
    holes_ok = True
    access_ok = True
    for key, spec in FACE_SPECS.items():
        h = check_holes(body_bvh, all_bvh, spec)
        acc = check_face_access(all_bvh, spec)
        n, c = spec['n'], spec['center']
        ifaces[key] = {
            'center_m': [round(x, 5) for x in c],
            'axis': [round(x, 3) for x in n],
            'normal': [round(x, 3) for x in n],
            'mounting_plane': {
                'size_m': [SEAT, SEAT],
                'plane_point_m': [round(x, 5) for x in c],
                'u_axis': [round(x, 3) for x in spec['u']],
                'v_axis': [round(x, 3) for x in spec['v']],
                'clear_samples': acc['samples'],
                'blocked_samples': acc['blocked'],
                'max_intrusion_mm': acc['max_intrusion_mm'],
            },
            'bolts_M8': [{
                'coord_m': b['coord_m'],
                'd_hole_mm': 9.0,
                'counterbore_mm': [14.5, 8.5],
                'grid_uv_mm': [round((Vector(b['coord_m']) - c).dot(spec['u']) * 1000, 1),
                               round((Vector(b['coord_m']) - c).dot(spec['v']) * 1000, 1)],
            } for b in h['bolts']],
            'pin': {'coord_m': h['pin']['coord_m'], 'd_mm': 6.0,
                    'flush_mm': h['pin']['tip_offset_mm']},
            'measured': h,
        }
        for b in h['bolts']:
            if not (b['through_open'] and b['head_face_mm'] is not None
                    and abs(b['head_face_mm'] - 3.5) < 0.4
                    and abs(b['counterbore_depth_mm'] - 8.5) < 0.4
                    and all(w is not None and abs(w) < 0.4 for w in b['wall_hits_mm'])):
                holes_ok = False
        if not h['pin']['present'] or abs(h['pin']['tip_offset_mm']) > 0.05:
            holes_ok = False
        if acc['blocked'] > 0 or acc['samples'] < 40:
            access_ok = False
    rep['interfaces'] = ifaces

    na = Vector(ifaces['face_a']['normal'])
    nb = Vector(ifaces['face_b']['normal'])
    angle = round(math.degrees(math.acos(max(-1.0, min(1.0, na.dot(nb))))), 3)

    rep['checks'] = {
        'non_manifold_edges': non_manifold,
        'degenerate_faces': degenerate,
        'materials_count': rep['material_count'],
        'materials_in_range': 4 <= rep['material_count'] <= 8,
        'bbox_ok': rep['bbox_m']['ok'],
        'negative_scale': neg_scale,
        'no_negative_scale': not neg_scale,
        'holes_ok': holes_ok,
        'faces_accessible': access_ok,
        'face_angle_deg': angle,
        'angle_90_ok': abs(angle - 90.0) < 0.01,
        'pin_diameter_mm': 6.0,
        'pin_placement': 'seat centre (u=0, v=0), shared origin of the ±15 mm M8 grid',
    }
    rep['checks']['all_ok'] = bool(
        non_manifold == 0 and degenerate == 0
        and rep['checks']['materials_in_range'] and rep['bbox_m']['ok']
        and not neg_scale and holes_ok and access_ok
        and rep['checks']['angle_90_ok'])
    rep['per_object'] = per_object
    return rep


# --- экспорт -------------------------------------------------------------
def export(root):
    objs = mesh_objects()
    for o in objs:
        o['component'] = CID
        o['standard'] = CODE
        o['motion'] = 'none'
        if o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').split('_')[0]
    root['component'] = CID
    root['standard'] = CODE
    root['motion'] = 'none'
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True)
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = root
    OUT.mkdir(parents=True, exist_ok=True)
    path = OUT / f'{CID}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 8000:
        raise RuntimeError(f'export too small: {path}')
    return path


def glb_summary(path):
    import struct
    data = Path(path).read_bytes()
    if data[:4] != b'glTF':
        raise RuntimeError('not a glb')
    ln = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20 + ln])
    mn = [1e9] * 3
    mx = [-1e9] * 3
    for n in j.get('nodes', []):
        if 'mesh' not in n:
            continue
        for pr in j['meshes'][n['mesh']]['primitives']:
            acc = j['accessors'][pr['attributes']['POSITION']]
            for i in range(3):
                mn[i] = min(mn[i], acc['min'][i])
                mx[i] = max(mx[i], acc['max'][i])
    return {
        'bytes': len(data),
        'nodes': len(j.get('nodes', [])),
        'meshes': len(j.get('meshes', [])),
        'materials': len(j.get('materials', [])),
        'node_names': [n.get('name') for n in j.get('nodes', [])],
        'bbox_gltf_m': [[round(v, 5) for v in mn], [round(v, 5) for v in mx]],
    }


# --- рендеры -------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 896
    scene.render.resolution_y = 896
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.10
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.30

    mn, mx = bbox()
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=6.0,
                                     location=(center.x, center.y, mn.z - 0.0002))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.620, 0.614, 0.600, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.06, -0.44, 0.36), 2.6, 0.28),
            ('fill', (-0.40, -0.24, 0.18), 0.9, 0.44),
            ('rim', (0.16, 0.40, 0.32), 1.5, 0.34)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.6))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

    def fit_dist(direction, lens, corners, margin=1.14):
        right, up, back = cam_basis(direction)
        sensor = cam_data.sensor_width
        sw = sh = sensor
        th = sw * 0.5 / lens
        tv = sh * 0.5 / lens
        need = 0.0
        for p in corners:
            need = max(need,
                       abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(mn - center, mx - center)
    close_t = Vector((0.048, 0.030, 0.040))
    c_close = box_corners(Vector((0.006, 0.000, 0.012)) - close_t,
                          Vector((0.086, 0.078, 0.060)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = mesh_objects()

    def max_ndc(region=None):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                wp = mw @ v.co
                if region is not None:
                    lo, hi = region
                    if not (lo.x - 1e-5 <= wp.x <= hi.x + 1e-5
                            and lo.y - 1e-5 <= wp.y <= hi.y + 1e-5
                            and lo.z - 1e-5 <= wp.z <= hi.z + 1e-5):
                        continue
                p = world_to_camera_view(scene, cam, wp)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    close_lo = Vector((0.006, 0.000, 0.012))
    close_hi = Vector((0.086, 0.078, 0.060))
    views = [
        ('3q', (-1.00, -1.00, 0.60), center, 70, c_main, 0.86, None),
        ('front', (0.02, -1.00, 0.10), center, 70, c_main, 0.86, None),
        ('side', (-1.00, -0.02, 0.10), center, 70, c_main, 0.86, None),
        ('closeup', (0.86, 0.80, 0.46), close_t, 85, c_close, 0.96,
         (close_lo, close_hi)),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, region in views:
        cam_data.lens = lens
        dirn = Vector(direction).normalized()
        dist = fit_dist(direction, lens, corners)
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(8):
            got = max_ndc(region)
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} fill={max_ndc(region):.3f} {fp}', flush=True)
    return outs


# --- main ----------------------------------------------------------------
def main():
    root, parts = build()
    rep = check()
    path = export(root)
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_info'] = glb_summary(path)
    rep['glb_nodes_ok'] = bool(
        all(n is None or n.startswith(PREFIX) or n == CID
            for n in rep['glb_info']['node_names']))

    rep['notes'] = [
        'Монтажные плоскости — наружные грани полок (y=0 нормаль -Y, x=0 нормаль -X): '
        'торец рельса прижимается снаружи, рельсы уходят наружу узла и не пересекаются '
        'в угловом квадрате 45x45.',
        'Болты M8 ввёрнуты с вогнутой стороны, головки утоплены в цековки Ø14.5x8.5; '
        'габарит 120x120x60 сохраняется, ключ подходит из раскрытого угла.',
        'Косынка — горизонтальное ребро 6 мм в зоне z=53.5..59.5, вне сектора доступа '
        'инструмента к головкам болтов (головки не выше z=52.2).',
        'Штифт Ø6 стоит по центру посадочного поля (u=0, v=0), то есть в общем начале '
        'сетки M8 ±15 мм: 21.2 мм до каждого болта, 15 мм до кромки рельса. '
        'Заподлицо с монтажной плоскостью, чтобы не выходить за габарит; '
        'ответное отверстие Ø6 — в торце рельса.',
        f'Расчётный объём тела {rep["volume_cm3"]} см³: в алюминии '
        f'{rep["mass_est_kg"]["alu_2_70"]} кг, в стали {rep["mass_est_kg"]["steel_7_85"]} кг; '
        'паспортные 1.1 кг — номинал для литого/стального варианта.',
        'Палитра: CJ_ivory_100 (корпус и косынка), CJ_graphite_100 (головки M8), '
        'CJ_steel_100 (штифт Ø6), CJ_dark_100 (дно цековок — только раскладка '
        'материала по существующим граням, геометрия не меняется).',
        'Фаски — только модификатор BEVEL: корпус 1.0 мм, свободные кромки косынки '
        '1.5 мм. Конусных вырезов, шва-рельефа и посадочного кольца нет: они давали '
        'неманифолдные кромки и выводили габарит за 120x120x60.',
    ]
    rep['deviations'] = [
        'Штифт и головки болтов не выступают за монтажную плоскость (0 мм), иначе '
        'габарит вырос бы до 126x126x60. Ответная часть штифта — в торце рельса.',
        'Паспорт CJ-NODE-45 говорит «2 болта M8 + штифт Ø6»; здесь 4xM8 на плоскость '
        'по требованию пилота (две плоскости, 8 болтов всего).',
    ]
    rep['renders'] = []
    rep['glb_bytes'] = path.stat().st_size
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(
        {k: rep[k] for k in ('id', 'bbox_m', 'checks', 'material_count',
                             'triangles', 'verts', 'glb_bytes', 'volume_cm3')},
        ensure_ascii=False), flush=True)
    if not rep['checks']['all_ok']:
        raise SystemExit('checks failed')
    print('BUILD_OK', flush=True)
    if os.environ.get('CJ_SKIP_RENDER') == '1':
        print('SKIP_RENDER', flush=True)
        return
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('DONE', flush=True)


main()
