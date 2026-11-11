"""Standalone builder: fix_cross_node (CJ-NODE-45, «Крестовый узел»).

Четырёхсторонний узел набора CJ-FIX-KIT под рельс CJ-RAIL-45 (45x45),
габарит 140 x 140 x 60 мм, четыре монтажные плоскости (0/90/180/270).

Схема (Blender Z-up, метры, центр плана в 0):
  - план — крест: четыре плеча шириной 45, доходящие до +-70 (габарит 140);
  - «полка» (база) — плита 12 мм по кресту до +-62; на ней четыре косынки;
  - центр — стойка 45x45 на всю высоту 60 со сквозным буртом Ø34 (кабельный
    проход) и запрессованной втулкой Ø33.8/Ø29.6 (сталь, заподлицо сверху);
  - монтажная плоскость — НАРУЖНАЯ грань фланца: 4 фланца 54 x 15 x 60 на
    x/y = +-70, наружная грань = плоскость прижима торца рельса;
  - на каждой плоскости посадочное поле 45 x 45 (центр на z = 36), 4 x M8
    (Ø9) по сетке +-15 мм, центральный штифт Ø6 заподлицо;
  - болты M8 ввёрнуты С ВНУТРЕННЕЙ стороны плеча, головки утоплены в
    цековки Ø14.5 x 8.5 (глубина от внутренней грани), ключ подходит из
    открытого пространства плеча (33 мм до стойки);
  - косынка — вертикальное ребро 8 мм по оси плеча, вогнутая кромка
    (квадратичная дуга), утоплена в стойку/базу/фланец — стыки без совпадения
    граней, булевы союзы чистые;
  - посадочное поле поднято на z = 36 (а не 30): цековки Ø14.5 не врезаются
    в базу (полка 12 мм) и не выходят на фаску верхней кромки фланца.

Не зависит от build_component_library.py, build_fix_corner_node.py и прочих
сборщиков, ничего общего не трогает.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_fix_cross_node.py

Выход:
  public/models/machine-modules/components/fix_cross_node.glb
  docs/plans/blockout/component-library/fix_cross_node/{3q,front,side,closeup}.png
  docs/plans/blockout/component-library/fix_cross_node/report.json

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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/fix_cross_node'
CID = 'fix_cross_node'
PREFIX = CID + '__'
CODE = 'CJ-NODE-45'

# --- ключевые размеры (м) ------------------------------------------------
MOUNT_R = 0.070         # монтажная плоскость на +-70 от центра (габарит 140)
H = 0.060               # высота узла
ARM_HW = 0.0225         # полуширина плеча креста (45)
BASE_T = 0.012          # толщина полки-базы
BASE_R = 0.062          # вылет базы по кресту
COL_HW = 0.0225         # полуразмер центральной стойки (45x45)
BORE_R = 0.017          # сквозной бурт Ø34

PLATE_T = 0.015         # толщина фланца (прижимная плита)
PLATE_HW = 0.027        # полуширина фланца (54) — запас под цековки и фаску

SEAT = 0.045            # посадочное поле под торец рельса 45x45
SEAT_Z = 0.036          # центр поля по высоте
BOLT_OFF = 0.015        # сетка M8 +-15 мм
D_HOLE = 0.009          # Ø9 под M8
D_CBORE = 0.0145        # цековка под головку M8 (DIN 912 Ø13)
CBORE_DEPTH = 0.0085
CBORE_SEAT = MOUNT_R - (PLATE_T - CBORE_DEPTH)   # 0.0635 — дно цековки
PIN_D = 0.006           # штифт Ø6

COLLAR_OD = 0.0338
COLLAR_ID = 0.0296
COLLAR_Z0 = 0.0540

GUSSET_T = 0.008
GUSSET_A = (0.021, 0.058)   # (s по оси плеча, z) — в стойке
GUSSET_B = (0.058, 0.011)   # во фланце и в базе
GUSSET_C = (0.021, 0.011)   # внутренний угол (стойка/база) — контрольная точка

BEVEL_BODY = 0.0010
BEVEL_EDGE = 0.0015

PALETTE = {
    'ivory': (0.855, 0.840, 0.808),
    'graphite': (0.085, 0.089, 0.099),
    'steel': (0.610, 0.620, 0.634),
    'dark': (0.030, 0.032, 0.038),
    'slate': (0.330, 0.345, 0.360),
}
MATS = {}


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
        'dark': (0.30, 0.55),
        'slate': (0.45, 0.50),
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


def cyl_local(name, radius, z0, z1, uv=(0.0, 0.0), verts=40):
    depth = abs(z1 - z0)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=verts, radius=radius, depth=depth,
        location=(uv[0], uv[1], (z0 + z1) * 0.5))
    obj = bpy.context.object
    obj.name = name
    return obj


def place(obj, M):
    obj.matrix_world = M @ obj.matrix_world
    select_only(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return obj


def prism(name, pts, z0, z1, role='ivory'):
    """Экструзия плоского многоугольника (X,Y) по Z — одно чистое тело."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z0)) for x, y in pts]
    face = bm.faces.new(vs)
    ret = bmesh.ops.extrude_face_region(bm, geom=[face])
    new_verts = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=new_verts, vec=(0.0, 0.0, z1 - z0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm, role, False)


def box(name, lo, hi, role='ivory'):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    sx, sy, sz = (hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2])
    cx, cy, cz = ((hi[0] + lo[0]) * 0.5, (hi[1] + lo[1]) * 0.5,
                  (hi[2] + lo[2]) * 0.5)
    for v in bm.verts:
        v.co = Vector((cx + v.co.x * sx, cy + v.co.y * sy, cz + v.co.z * sz))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm, role, False)


def plus_polygon(r, hw):
    """Крест в плане: плечи полушириной hw, вылет +-r."""
    return [(hw, hw), (r, hw), (r, -hw), (hw, -hw),
            (hw, -r), (-hw, -r), (-hw, -hw), (-r, -hw),
            (-r, hw), (-hw, hw), (-hw, r), (hw, r)]


def square_polygon(hw):
    return [(hw, hw), (-hw, hw), (-hw, -hw), (hw, -hw)]


def bolt_uv():
    return [(-BOLT_OFF, -BOLT_OFF), (-BOLT_OFF, BOLT_OFF),
            (BOLT_OFF, -BOLT_OFF), (BOLT_OFF, BOLT_OFF)]


# --- монтажные плоскости -------------------------------------------------
# Локальная система плоскости: z = 0 — монтажная грань (торец рельса),
# материал в z in [-PLATE_T, 0], +z смотрит НАРУЖУ узла.
FACES = []


def build_faces():
    FACES.clear()
    frames = [
        ('face_0', Vector((1.0, 0.0, 0.0)), Vector((0.0, 1.0, 0.0)), 0),
        ('face_90', Vector((0.0, 1.0, 0.0)), Vector((-1.0, 0.0, 0.0)), 90),
        ('face_180', Vector((-1.0, 0.0, 0.0)), Vector((0.0, -1.0, 0.0)), 180),
        ('face_270', Vector((0.0, -1.0, 0.0)), Vector((1.0, 0.0, 0.0)), 270),
    ]
    up = Vector((0.0, 0.0, 1.0))
    for name, n, u, ang in frames:
        c = n * MOUNT_R + up * SEAT_Z
        M = Matrix(((u.x, up.x, n.x, c.x),
                    (u.y, up.y, n.y, c.y),
                    (u.z, up.z, n.z, c.z),
                    (0.0, 0.0, 0.0, 1.0)))
        FACES.append({'name': name, 'n': n, 'u': u, 'v': up, 'angle': ang,
                      'center': c, 'M': M})
    return FACES


def plate_solid(name, f):
    n = f['n']
    ax = 0 if abs(n.x) > 0.5 else 1
    s = 1.0 if n[ax] > 0 else -1.0
    tang = 1 - ax
    lo = [0.0, 0.0, 0.0]
    hi = [0.0, 0.0, 0.0]
    lo[ax] = s * (MOUNT_R - PLATE_T)
    hi[ax] = s * MOUNT_R
    lo[tang] = -PLATE_HW
    hi[tang] = PLATE_HW
    lo[2] = 0.0
    hi[2] = H
    return box(name, lo, hi)


def bezier_profile(a, b, c, steps=16):
    """Квадратичная дуга a->b с контролем в c: вогнутая кромка косынки."""
    pts = [a]
    for i in range(1, steps + 1):
        t = i / steps
        s = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t ** 2 * b[0]
        z = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t ** 2 * b[1]
        pts.append((s, z))
    return pts


def gusset_solid(name, f):
    n = f['n']
    t = Vector((-n.y, n.x, 0.0))
    prof = bezier_profile(GUSSET_A, GUSSET_B, GUSSET_C) + [GUSSET_C]
    bm = bmesh.new()
    vs = [bm.verts.new(n * s + Vector((0.0, 0.0, z)) - t * (GUSSET_T * 0.5))
          for s, z in prof]
    face = bm.faces.new(vs)
    ret = bmesh.ops.extrude_face_region(bm, geom=[face])
    nv = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=t * GUSSET_T)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bm(name, bm, 'ivory', False)


def face_cutters(prefix, M, cutters):
    """Вырезы в локальной системе плоскости (z=0 — монтажная грань).

    Только цилиндры: сквозное Ø9, цековка Ø14.5 с внутренней стороны,
    центральный Ø6. Никаких конусов и рельефа — они дают неманифолдные кромки.
    """
    zf = -PLATE_T
    made = []
    for i, (u, v) in enumerate(bolt_uv()):
        made.append(cyl_local(f'{prefix}_cut_{i}_thru', D_HOLE * 0.5,
                              zf - 0.002, 0.002, (u, v)))
        made.append(cyl_local(f'{prefix}_cut_{i}_cb', D_CBORE * 0.5,
                              zf - 0.002, zf + CBORE_DEPTH, (u, v)))
    made.append(cyl_local(f'{prefix}_cut_pin', PIN_D * 0.5 + 0.000025,
                          zf - 0.002, 0.002, (0.0, 0.0)))
    for o in made:
        place(o, M)
    cutters.extend(made)
    return made


def paint_cbore_seats(body):
    """Дно цековок — второй слот материала (CJ_dark_100).

    Только раскладка материала по существующим граням: геометрия не меняется.
    Дно цековки лежит на плоскости MOUNT_R - (PLATE_T - CBORE_DEPTH) = 63.5 мм
    по |x| (плоскости +-X) и по |y| (плоскости +-Y).
    """
    me = body.data
    me.materials.append(mat('dark'))
    idx = len(me.materials) - 1
    plane = CBORE_SEAT
    n = 0
    for p in me.polygons:
        if all(abs(abs(me.vertices[i].co[0]) - plane) < 2e-6 for i in p.vertices) or \
                all(abs(abs(me.vertices[i].co[1]) - plane) < 2e-6 for i in p.vertices):
            p.material_index = idx
            n += 1
    if n == 0:
        raise RuntimeError('cbore seat faces not found: material slot unused')
    return n


def face_hardware(prefix, M):
    """Головки M8 с шестигранным гнездом и штифт Ø6 (заподлицо)."""
    zf = -PLATE_T
    out = []
    seat = zf + CBORE_DEPTH            # дно цековки = опорная грань головки
    head0 = seat - 0.0080              # свободный торец головки (гнездо)
    for i, (u, v) in enumerate(bolt_uv()):
        head = cyl_local(f'{prefix}_bolt_{i}', 0.0065, head0, seat, (u, v),
                         verts=40)
        place(head, M)
        bevel(head, 0.0004, 2, 40.0)
        apply(head, 'graphite', False)
        head.data.polygons.foreach_set(
            'use_smooth', [True] * len(head.data.polygons))
        head.data.update()
        hexa = cyl_local(f'{prefix}_hex_{i}', 0.0033, head0 - 0.0015,
                         head0 + 0.0042, (u, v), verts=6)
        place(hexa, M)
        boolean(head, hexa)
        out.append(head)
    pin = cyl_local(f'{prefix}_pin', PIN_D * 0.5, zf, 0.0, (0.0, 0.0), verts=32)
    place(pin, M)
    bevel(pin, 0.0004, 2, 40.0)
    apply(pin, 'steel', True)
    out.append(pin)
    return out


def collar():
    """Втулка Ø33.8/Ø29.6 в бурте стойки, заподлицо с верхом (сталь)."""
    outer = cyl_local(PREFIX + 'collar', COLLAR_OD * 0.5, COLLAR_Z0, H, (0, 0),
                      verts=64)
    inner = cyl_local(PREFIX + 'collar_bore', COLLAR_ID * 0.5,
                      COLLAR_Z0 - 0.002, H + 0.002, (0, 0), verts=64)
    apply(outer, 'steel', True)
    boolean(outer, inner)
    return outer


def build():
    reset()
    build_faces()
    parts = []

    # полка-база (крест) — стартовое тело
    body = prism(PREFIX + 'body', plus_polygon(BASE_R, ARM_HW), 0.0, BASE_T)
    # центральная стойка
    column = prism(PREFIX + 'column', square_polygon(COL_HW), 0.0, H)
    boolean(body, column, 'UNION')
    # четыре фланца
    for f in FACES:
        boolean(body, plate_solid(PREFIX + 'plate_' + f['name'][-1], f), 'UNION')
    # четыре косынки
    for f in FACES:
        boolean(body, gusset_solid(PREFIX + 'web_' + f['name'][-1], f), 'UNION')

    # бурт — до фасок, чтобы кромка бурта тоже получила фаску
    boolean(body, cyl_local(PREFIX + 'cut_bore', BORE_R, -0.002, H + 0.002,
                            (0, 0), verts=64), 'DIFFERENCE')
    bevel(body, BEVEL_BODY, 2, 42.0)

    # отверстия — по одному чистому цилиндру (склейка вырезов в один меш даёт
    # самопересечение и рваные кромки на EXACT-солвере)
    cutters = []
    for f in FACES:
        face_cutters(PREFIX + f['name'][-1], f['M'], cutters)
    for c in cutters:
        boolean(body, c, 'DIFFERENCE')
    paint_cbore_seats(body)
    body.data.polygons.foreach_set(
        'use_smooth', [False] * len(body.data.polygons))
    body.data.update()
    parts.append(body)

    for f in FACES:
        parts.extend(face_hardware(PREFIX + f['name'][-1], f['M']))
    parts.append(collar())

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


def check_holes(body_bvh, all_bvh, spec):
    n, u, v, c = spec['n'], spec['u'], spec['v'], spec['center']
    out = {'bolts': [], 'pin': {}}

    def local(uu, vv):
        return c + u * uu + v * vv

    for i, (uu, vv) in enumerate(bolt_uv()):
        p = local(uu, vv)
        o_out = p + n * 0.040
        loc_through, d_through = hit(body_bvh, o_out, -n, 0.080)
        open_hole = loc_through is None
        loc_b, d_b = hit(all_bvh, o_out, -n, 0.080)
        head_z = None
        if loc_b is not None:
            head_z = round(-(loc_b - p).dot(n) * 1000.0, 2)
        wall = []
        for du, dv in ((0.0055, 0.0), (-0.0055, 0.0), (0.0, 0.0055), (0.0, -0.0055)):
            lp, dd = hit(body_bvh, local(uu + du, vv + dv) + n * 0.040, -n, 0.080)
            wall.append(round((0.040 - dd) * 1000.0, 2) if dd is not None else None)
        # цековка: луч изнутри на r=6.5 упирается в дно цековки
        ino = local(uu + 0.0065, vv) - n * 0.040
        loc_cb, d_cb = hit(body_bvh, ino, n, 0.080)
        cb_depth = round((d_cb - 0.040 + PLATE_T) * 1000.0, 2) if d_cb is not None else None
        ino2 = local(uu + 0.0085, vv) - n * 0.040
        loc_cb2, d_cb2 = hit(body_bvh, ino2, n, 0.080)
        cb_wall = round((d_cb2 - 0.040 + PLATE_T) * 1000.0, 2) if d_cb2 is not None else None
        # доступ ключа: от торца головки (гнездо) вглубь плеча — свободный ход.
        # головка занимает local z [-PLATE_T+CBORE_DEPTH-0.008, -PLATE_T+CBORE_DEPTH]
        # = [-14.5, -6.5] мм, гнездо открыто в сторону внутренней грани (55 мм).
        key_start = local(uu, vv) - n * (PLATE_T - CBORE_DEPTH + 0.008)
        loc_key, d_key = hit(all_bvh, key_start - n * 0.0005, -n, 0.045)
        key_clear = round(d_key * 1000.0, 2) if d_key is not None else 45.0
        out['bolts'].append({
            'index': i,
            'coord_m': [round(x, 5) for x in p],
            'through_open': bool(open_hole),
            'head_face_mm': head_z,
            'wall_hits_mm': wall,
            'counterbore_depth_mm': cb_depth,
            'counterbore_wall_mm': cb_wall,
            'key_clearance_mm': key_clear,
        })

    pp = local(0.0, 0.0)
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
            if math.hypot(uu, vv) < 0.0062:
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
            'nominal': [0.140, 0.140, 0.060],
            'ok': bool(all(abs(size[i] - v) < 0.0015
                           for i, v in enumerate((0.140, 0.140, 0.060)))),
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
    rep['mass_kg_spec'] = 1.6
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
    key_ok = True
    for f in FACES:
        spec = f
        h = check_holes(body_bvh, all_bvh, spec)
        acc = check_face_access(all_bvh, spec)
        n, c = spec['n'], spec['center']
        ifaces[f['name']] = {
            'angle_deg': f['angle'],
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
                    and abs(b['head_face_mm'] - (PLATE_T - CBORE_DEPTH) * 1000) < 0.4
                    and abs(b['counterbore_depth_mm'] - 8.5) < 0.4
                    and all(w is not None and abs(w) < 0.4 for w in b['wall_hits_mm'])):
                holes_ok = False
            if b['key_clearance_mm'] < 25.0:
                key_ok = False
        if not h['pin']['present'] or abs(h['pin']['tip_offset_mm']) > 0.05:
            holes_ok = False
        if acc['blocked'] > 0 or acc['samples'] < 40:
            access_ok = False
    rep['interfaces'] = ifaces

    # углы между плоскостями: соседние = 90, противоположные = 180
    normals = {f['name']: f['n'] for f in FACES}
    def ang(a, b):
        return round(math.degrees(math.acos(
            max(-1.0, min(1.0, a.dot(b))))), 3)
    adj = [ang(normals['face_0'], normals['face_90']),
           ang(normals['face_90'], normals['face_180']),
           ang(normals['face_180'], normals['face_270']),
           ang(normals['face_270'], normals['face_0'])]
    opp = [ang(normals['face_0'], normals['face_180']),
           ang(normals['face_90'], normals['face_270'])]
    centers = [[round(x, 5) for x in f['center']] for f in FACES]
    distinct_n = len({tuple(round(x, 3) for x in f['n']) for f in FACES}) == 4
    distinct_c = len({tuple(c) for c in centers}) == 4
    bolt_sets = {f['name']: sorted(tuple(b['coord_m'])
                                   for b in ifaces[f['name']]['bolts_M8'])
                 for f in FACES}
    distinct_b = len({tuple(v) for v in bolt_sets.values()}) == 4

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
        'key_clearance_ok': key_ok,
        'faces_count': len(FACES),
        'adjacent_angles_deg': adj,
        'adjacent_90_ok': all(abs(a - 90.0) < 0.01 for a in adj),
        'opposite_angles_deg': opp,
        'opposite_180_ok': all(abs(a - 180.0) < 0.01 for a in opp),
        'distinct_normals': distinct_n,
        'distinct_centers': distinct_c,
        'distinct_m8_patterns': distinct_b,
        'pin_diameter_mm': 6.0,
        'pin_placement': 'seat centre (u=0, v=0), shared origin of the +-15 mm M8 grid',
        'seat_z_mm': round(SEAT_Z * 1000, 2),
    }
    rep['checks']['all_ok'] = bool(
        non_manifold == 0 and degenerate == 0
        and rep['checks']['materials_in_range'] and rep['bbox_m']['ok']
        and not neg_scale and holes_ok and access_ok and key_ok
        and distinct_n and distinct_c and distinct_b
        and rep['checks']['adjacent_90_ok'] and rep['checks']['opposite_180_ok']
        and len(FACES) == 4)
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
            ('key', (0.10, -0.50, 0.40), 3.0, 0.30),
            ('fill', (-0.46, -0.28, 0.20), 1.0, 0.46),
            ('rim', (0.18, 0.46, 0.36), 1.7, 0.36)):
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
        th = sensor * 0.5 / lens
        tv = th
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
    close_t = Vector((0.062, 0.000, 0.036))
    close_lo = Vector((0.040, -0.030, 0.004))
    close_hi = Vector((0.071, 0.030, 0.060))
    c_close = box_corners(close_lo - close_t, close_hi - close_t)

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

    views = [
        # 3q снят с противоположного угла (-X,+Y): вместе с front (-Y) и side (+X)
        # четыре кадра покрывают ВСЕ четыре монтажные плоскости
        ('3q', (-1.00, 1.00, 0.62), center, 70, c_main, 0.86, None),
        ('front', (0.02, -1.00, 0.10), center, 70, c_main, 0.86, None),
        ('side', (1.00, -0.02, 0.10), center, 70, c_main, 0.86, None),
        ('closeup', (1.00, -0.72, 0.44), close_t, 85, c_close, 0.96,
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
        'Четыре монтажные плоскости — наружные грани фланцев на x=+-70 и y=+-70: '
        'торцы четырёх рельсов прижимаются снаружи, рельсы уходят наружу узла и '
        'не пересекаются в центре креста.',
        'План — крест: плечи шириной 45, полка-база 12 мм, центр — стойка 45x45 на '
        'всю высоту 60 со сквозным буртом Ø34 и стальной втулкой Ø33.8/Ø29.6 '
        'заподлицо с верхом.',
        'Посадочное поле 45x45 поднято на z=36 (не 30): цековки Ø14.5 не врезаются '
        'в полку (12 мм) и не выходят на фаску верхней кромки фланца; поля всех '
        'четырёх плоскостей лежат на одной высоте.',
        'Болты M8 ввёрнуты с внутренней стороны плеча, головки утоплены в цековки '
        'Ø14.5x8.5 на 6.5 мм от плоскости; ключ подходит из открытого пространства '
        'плеча — 33 мм до стойки.',
        'Косынки — четыре вертикальных ребра 8 мм по осям плеч с вогнутой кромкой '
        '(квадратичная дуга); утоплены в стойку, полку и фланец, поэтому стыки не '
        'имеют совпадающих граней и союз остаётся чистым.',
        'Штифты Ø6 стоят по центру посадочных полей (общее начало сетки M8 +-15), '
        'заподлицо с плоскостью; ответное отверстие Ø6.1 — в торце рельса.',
        f'Объём тела {rep["volume_cm3"]} см³: алюминий {rep["mass_est_kg"]["alu_2_70"]} кг, '
        f'сталь {rep["mass_est_kg"]["steel_7_85"]} кг; паспортные 1.6 кг — номинал '
        'литого узла.',
        'Палитра: CJ_ivory_100 (тело), CJ_graphite_100 (головки M8), CJ_steel_100 '
        '(штифты и втулка), CJ_dark_100 (дно цековок — только раскладка материала '
        'по существующим граням). Розового акцента нет.',
        'Фаски — только модификатор BEVEL: корпус 1.0 мм до вырезов, аппарат 0.4 мм. '
        'Конусных вырезов и рельефа нет: они давали неманифолдные кромки.',
    ]
    rep['deviations'] = [
        'Габарит 140x140x60 при четырёх плоскостях по 45x45: фланец 54x60 шире '
        'посадочного поля на 4.5 мм с каждой стороны — иначе цековка Ø14.5 на сетке '
        '+-15 выходит на фаску кромки (запас 0.25 мм).',
        'Косынка — ребро 8 мм по оси плеча, а не пара боковых рёбер: боковые рёбра '
        'перекрывали доступ ключа к головкам при сетке +-15.',
        'Штифты и головки болтов не выступают за монтажную плоскость (0 мм), иначе '
        'габарит вырос бы до 152x152x60.',
    ]
    rep['renders'] = []
    rep['glb_bytes'] = path.stat().st_size
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    blob = json.dumps(rep, ensure_ascii=False, indent=2)
    if not rep['checks']['all_ok']:
        # битый прогон не должен выглядеть собранным: старые кадры убираем,
        # отчёт кладём отдельным именем, report.json не трогаем
        for stale in RENDER_DIR.glob('*.png'):
            stale.unlink()
        rep['blocker'] = sorted(k for k, v in rep['checks'].items() if v is False)
        (RENDER_DIR / 'report.FAILED.json').write_text(blob, encoding='utf-8')
        print('REPORT ' + json.dumps(
            {k: rep[k] for k in ('id', 'bbox_m', 'checks', 'material_count',
                                 'triangles', 'verts', 'glb_bytes', 'volume_cm3')},
            ensure_ascii=False), flush=True)
        print('BLOCKER ' + json.dumps(
            {'failed_checks': rep['blocker'], 'report': 'report.FAILED.json'},
            ensure_ascii=False), flush=True)
        raise SystemExit('checks failed: ' + ', '.join(rep['blocker']))
    (RENDER_DIR / 'report.json').write_text(blob, encoding='utf-8')
    stale_fail = RENDER_DIR / 'report.FAILED.json'
    if stale_fail.exists():
        stale_fail.unlink()
    print('REPORT ' + json.dumps(
        {k: rep[k] for k in ('id', 'bbox_m', 'checks', 'material_count',
                             'triangles', 'verts', 'glb_bytes', 'volume_cm3')},
        ensure_ascii=False), flush=True)
    print('BUILD_OK', flush=True)
    if os.environ.get('CJ_SKIP_RENDER') == '1':
        print('SKIP_RENDER', flush=True)
        return
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('DONE', flush=True)


main()
