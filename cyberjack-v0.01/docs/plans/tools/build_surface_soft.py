"""Standalone builder: surface_soft (SRF-SOFT-01, «Мягкое ложе»).

Съёмный пенный мат в чехле, 2,0 x 0,9 x 0,06 м:
  молочная ткань, розовый кант по верхнему шву, три продольных секции
  с розовой строчкой, ремни с липучками по углам, ручка-язычок для снятия,
  водонепроницаемая подложка. Без плиты, без вращений, без анимации.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_surface_soft.py

Выход:
  public/models/machine-modules/components/surface_soft.glb
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
CID = 'surface_soft'
PREFIX = CID + '__'

# --- ключевые размеры (м) -------------------------------------------------
AX, AY = 0.9900, 0.4400       # полугабариты чехла (1,98 x 0,88)
RC = 0.045                    # скругление плана
Z0, Z1 = 0.0035, 0.0505       # низ / плоский верх чехла (толщина 47 мм)
RR = 0.021                    # радиус отката кромки, борт 5 мм
PUFF = 0.0078                 # набивка канала
DIP = 0.0045                  # вмятина строчки в шве
CH_W = 0.296                  # период каналов
GROOVE = 0.148                # координаты продольных швов y = +-0.148

N_LONG, N_SHORT, N_CORNER = 76, 12, 9
N_TOP, N_ARC, N_WALL, N_BOT = 28, 6, 3, 6

PALETTE = {
    'linen': (0.949, 0.941, 0.918),
    'shade': (0.806, 0.793, 0.768),
    'pink': (0.902, 0.541, 0.596),
    'pink_deep': (0.831, 0.404, 0.474),
    'web': (0.252, 0.260, 0.278),
    'velcro': (0.395, 0.372, 0.372),
    'backing': (0.560, 0.588, 0.588),
    'ivory': (0.976, 0.970, 0.957),
}
ROUGH = {'linen': 0.94, 'shade': 0.92, 'pink': 0.86, 'pink_deep': 0.83,
         'web': 0.84, 'velcro': 0.96, 'backing': 0.58, 'ivory': 0.88}
MATS = {}


# --- helpers --------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_soft_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = 0.0
    if role == 'backing':
        bsdf.inputs['Metallic'].default_value = 0.06
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


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def puff(x, y):
    """Набивка канала (3 секции) минус вмятина шва; затухает к кромке/торцам."""
    edge = 1.0 - smoothstep((abs(y) - (AY - 0.100)) / 0.070)
    end = 1.0 - smoothstep((abs(x) / AX - 0.860) / 0.120)
    ch = abs(math.cos(math.pi * y / CH_W)) ** 0.8
    dip = DIP * math.exp(-((abs(y) - GROOVE) / 0.0125) ** 2)
    return (PUFF * ch * edge - dip) * end


def top_z(x, y):
    return Z1 + puff(x, y)


def bm_to_obj(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def bevel_mod(obj, width, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0010, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel_mod(obj, r)
    return apply(obj, role, smooth)


def bm_box(bm, center, size, rot_z=0.0):
    m = (Matrix.Translation(Vector(center))
         @ Matrix.Rotation(rot_z, 4, 'Z')
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def rounded_prism(name, ax, ay, rc, z0, z1, role, bevel=0.0010):
    """Скруглённая в плане плитка (подложка)."""
    bm = bmesh.new()
    pts = outline_pts(ax, ay, rc, n=10)
    bot = [bm.verts.new((p.x, p.y, z0)) for p in pts]
    top = [bm.verts.new((p.x, p.y, z1)) for p in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bm.faces.new(bot)
    bm.faces.new(top)
    obj = bm_to_obj(name, bm, role, False)
    if bevel > 0:
        bevel_mod(obj, bevel)
    return obj


def outline_pts(ax, ay, rc, n=10):
    """Замкнутый контур скруглённого прямоугольника без дублей."""
    pts = []
    for cx, cy, a0 in ((ax - rc, ay - rc, 0.0),
                       (-(ax - rc), ay - rc, math.pi / 2),
                       (-(ax - rc), -(ay - rc), math.pi),
                       (ax - rc, -(ay - rc), 1.5 * math.pi)):
        for k in range(n):
            a = a0 + (math.pi / 2) * k / n
            pts.append(Vector((cx + rc * math.cos(a), cy + rc * math.sin(a), 0.0)))
    return pts


def curve_tube(name, points, radius, role, cyclic=False, res=3):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 1
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for p, q in zip(sp.points, points):
        p.co = (q[0], q[1], q[2], 1.0)
    sp.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return apply(bpy.context.object, role, True)


def ribbon(name, path, half_w, role, thickness=0.005):
    """Лента по (P, W); Solidify даёт толщину ремня."""
    bm = bmesh.new()
    rows = []
    for p, w in path:
        rows.append([bm.verts.new(p + w * half_w), bm.verts.new(p - w * half_w)])
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        bm.faces.new((a[0], b[0], b[1], a[1]))
    obj = bm_to_obj(name, bm, role, True)
    mod = obj.modifiers.new('sol', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 0.0
    mod.use_even_offset = False
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def catmull(points, n):
    """Равномерный Catmull-Rom по 2D-точкам (s, z)."""
    pts = [points[0]] + list(points) + [points[-1]]
    out = []
    segs = len(pts) - 3
    for i in range(n):
        t = i / (n - 1) * segs
        k = min(int(t), segs - 1)
        u = t - k
        p0, p1, p2, p3 = pts[k], pts[k + 1], pts[k + 2], pts[k + 3]
        u2, u3 = u * u, u * u * u
        out.append(tuple(
            0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u
                   + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2
                   + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3)
            for j in range(2)))
    return out


def ring_points(ax, ay, rc):
    """Кольцо: 2 длинных стороны (N_LONG), 2 торца (N_SHORT), 4 дуги."""
    rc = max(rc, 1e-4)
    pts = []
    for k in range(N_SHORT):                     # x=+ax, y вверх
        pts.append((ax, -(ay - rc) + 2 * (ay - rc) * k / (N_SHORT - 1)))
    for k in range(1, N_CORNER):                 # NE
        a = (math.pi / 2) * k / N_CORNER
        pts.append((ax - rc + rc * math.cos(a), ay - rc + rc * math.sin(a)))
    for k in range(N_LONG):                      # y=+ay, x влево
        pts.append((ax - rc - 2 * (ax - rc) * k / (N_LONG - 1), ay))
    for k in range(1, N_CORNER):                 # NW
        a = math.pi / 2 + (math.pi / 2) * k / N_CORNER
        pts.append((-ax + rc + rc * math.cos(a), ay - rc + rc * math.sin(a)))
    for k in range(N_SHORT):                     # x=-ax, y вниз
        pts.append((-ax, ay - rc - 2 * (ay - rc) * k / (N_SHORT - 1)))
    for k in range(1, N_CORNER):                 # SW
        a = math.pi + (math.pi / 2) * k / N_CORNER
        pts.append((-ax + rc + rc * math.cos(a), -ay + rc + rc * math.sin(a)))
    for k in range(N_LONG):                      # y=-ay, x вправо
        pts.append((-ax + rc + 2 * (ax - rc) * k / (N_LONG - 1), -ay))
    for k in range(1, N_CORNER):                 # SE
        a = 1.5 * math.pi + (math.pi / 2) * k / N_CORNER
        pts.append((ax - rc + rc * math.cos(a), -ay + rc + rc * math.sin(a)))
    return pts


# --- сборка ---------------------------------------------------------------
def build_cover():
    """Лофт скруглённой плиты: плоский верх с набивкой, откат, борт, низ."""
    bm = bmesh.new()
    i_max = AY - 0.0007
    stations = []
    for k in range(N_TOP):
        stations.append(('top', i_max + (RR - i_max) * k / (N_TOP - 1), None))
    for k in range(1, N_ARC + 1):
        a = (math.pi / 2) * k / N_ARC
        stations.append(('z', RR * (1 - math.sin(a)), Z1 - RR * (1 - math.cos(a))))
    for k in range(1, N_WALL + 1):
        stations.append(('z', 0.0,
                         (Z1 - RR) - (Z1 - RR - Z0 - RR) * k / N_WALL))
    for k in range(1, N_ARC + 1):
        a = math.pi / 2 - (math.pi / 2) * k / N_ARC
        stations.append(('z', RR * (1 - math.sin(a)), Z0 + RR * (1 - math.cos(a))))
    for k in range(1, N_BOT + 1):
        stations.append(('bot', RR + (i_max - RR) * k / N_BOT, None))

    rings = []
    for kind, inset, zval in stations:
        loop = ring_points(AX - inset, AY - inset, RC - inset)
        ring = []
        for x, y in loop:
            if kind == 'top':
                z = Z1 + puff(x, y)
            elif kind == 'bot':
                z = Z0
            else:
                z = zval
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)

    n = len(rings[0])
    kinds = [s[0] for s in stations]
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        # 1 = материал борта/отката (боковина чехла чуть темнее полотна)
        mi = 1 if kinds[i + 1] == 'z' else 0
        for j in range(n):
            k = (j + 1) % n
            f = bm.faces.new((a[j], a[k], b[k], b[j]))
            f.material_index = mi
    f = bm.faces.new(rings[0])
    f.material_index = 0
    f = bm.faces.new(tuple(reversed(rings[-1])))
    f.material_index = 1
    obj = bm_to_obj(PREFIX + 'cover', bm, 'linen', True)
    obj.data.materials.append(mat('shade'))
    return obj, len(rings) * n


def build_parts():
    # --- водонепроницаемая подложка (габарит 2,0 x 0,9) --------------------
    rounded_prism(PREFIX + 'backing', 1.0, 0.45, 0.050, 0.0, 0.0045,
                  'backing', bevel=0.0010)

    # --- кант по верхнему шву --------------------------------------------
    loop = outline_pts(AX - 0.0008, AY - 0.0008, RC - 0.0008, n=26)
    path = [(p.x, p.y, Z1 - RR + 0.0018) for p in loop]
    curve_tube(PREFIX + 'piping', path, 0.0050, 'pink_deep', cyclic=True)

    # --- продольные швы-канты --------------------------------------------
    for tag, sy in (('l', -1), ('r', 1)):
        y = sy * GROOVE
        curve_tube(PREFIX + f'seam_cord_{tag}',
                   [(-0.902, y, Z1 - 0.0048), (-0.888, y, Z1 - 0.0014),
                    (-0.45, y, Z1 - 0.0008), (0.0, y, Z1 - 0.0008),
                    (0.45, y, Z1 - 0.0008), (0.888, y, Z1 - 0.0014),
                    (0.902, y, Z1 - 0.0048)], 0.0036, 'pink')
        for sx in (-1, 1):
            cube(PREFIX + f'seam_tack_{tag}_{"a" if sx < 0 else "b"}',
                 (sx * 0.884, y, Z1 - 0.0012), (0.014, 0.010, 0.0032),
                 'pink_deep', r=0.0008)

    # --- строчка: дашевая розовая нить -----------------------------------
    bm = bmesh.new()

    def dash(x, y, w, length, width=0.0016, thick=0.0010):
        t = Vector((w[0], w[1], 0.0)).normalized()
        nr = Vector((-t.y, t.x, 0.0))
        base = Vector((x, y, top_z(x, y) + 0.0002))
        quad = ((0.5, 0.5), (0.5, -0.5), (-0.5, -0.5), (-0.5, 0.5))
        low = [bm.verts.new(base + t * (a * length) + nr * (b * width)) for a, b in quad]
        high = [bm.verts.new(base + t * (a * length) + nr * (b * width)
                             + Vector((0, 0, thick))) for a, b in quad]
        bm.faces.new(low)
        bm.faces.new(tuple(reversed(high)))
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((low[i], low[j], high[j], high[i]))

    per = outline_pts(AX - 0.030, AY - 0.030, RC - 0.030, n=26)
    total = sum((per[(i + 1) % len(per)] - per[i]).length for i in range(len(per)))
    n_st = int(total / 0.016)
    for i in range(n_st):
        d = (i + 0.5) * total / n_st
        acc, p, w = 0.0, per[-1], per[0] - per[-1]
        for j in range(len(per)):
            seg = (per[(j + 1) % len(per)] - per[j]).length
            if acc + seg >= d:
                f = (d - acc) / seg
                p = per[j].lerp(per[(j + 1) % len(per)], f)
                w = per[(j + 1) % len(per)] - per[j]
                break
            acc += seg
        dash(p.x, p.y, (w.x, w.y), 0.009)

    for sy in (-1, 1):
        for off in (-0.0088, 0.0088):
            y = sy * (GROOVE + off)
            x = -0.892
            while x <= 0.892:
                dash(x, y, (1.0, 0.0), 0.009)
                x += 0.016
    bm_to_obj(PREFIX + 'stitching', bm, 'pink', False)

    # --- ремни с липучками по углам (обхват торца у каждого угла) --------
    for sx in (-1, 1):
        for sy in (-1, 1):
            tag = ('p' if sx > 0 else 'n') + ('p' if sy > 0 else 'n')
            ex = sx * AX
            y0 = sy * 0.356
            ctrl = []
            for i in (0.072, 0.058, 0.046, 0.036, 0.027):
                x = ex - sx * i
                ctrl.append((x, top_z(x, y0) + 0.0006))
            for a in (0.0, 0.22, 0.45, 0.68, 0.90, 1.12, 1.32, 1.48, math.pi / 2):
                ctrl.append((ex - sx * RR * (1 - math.sin(a)),
                             Z1 - RR * (1 - math.cos(a))))
            for z in (Z1 - RR - 0.0038, Z1 - RR - 0.0085, Z0 + RR):
                ctrl.append((ex + sx * 0.0002, z))
            for a in (1.48, 1.32, 1.12, 0.90, 0.68, 0.45, 0.22, 0.0):
                ctrl.append((ex - sx * RR * (1 - math.sin(a)),
                             Z0 + RR * (1 - math.cos(a))))
            path = [(Vector((x, y0, z)), Vector((0.0, 1.0, 0.0))) for x, z in ctrl]
            ribbon(PREFIX + f'corner_strap_{tag}', path, 0.0320, 'web', 0.0044)

            px = ex - sx * 0.040
            cube(PREFIX + f'corner_pad_{tag}',
                 (px, y0, top_z(px, y0) + 0.0021), (0.032, 0.056, 0.0020),
                 'velcro', r=0.0007)
            tx = ex - sx * 0.060
            cube(PREFIX + f'corner_tack_{tag}',
                 (tx, y0, top_z(tx, y0) + 0.0020), (0.005, 0.062, 0.0014),
                 'pink_deep', r=0.0004)

    # --- ручка-язычок для снятия ----------------------------------------
    u = [Vector((0.876, -0.030, 0)), Vector((0.912, -0.033, 0)),
         Vector((0.945, -0.028, 0)), Vector((0.958, 0.0, 0)),
         Vector((0.945, 0.028, 0)), Vector((0.912, 0.033, 0)),
         Vector((0.876, 0.030, 0))]
    raw = []
    for i, q in enumerate(u):
        t = i / (len(u) - 1)
        raw.append(Vector((q.x, q.y, top_z(q.x, q.y) + 0.0006
                           + 0.0019 * math.sin(math.pi * t) ** 0.6)))
    path = []
    for i, q in enumerate(raw):
        a = raw[max(0, i - 1)]
        b = raw[min(len(raw) - 1, i + 1)]
        d = Vector((b.x - a.x, b.y - a.y, 0)).normalized()
        path.append((q, Vector((-d.y, d.x, 0))))
    ribbon(PREFIX + 'pull_handle', path, 0.0170, 'pink', 0.0022)
    for sx in (-1, 1):
        y = sx * 0.030
        cube(PREFIX + f'handle_keeper_{"l" if sx < 0 else "r"}',
             (0.862, y, top_z(0.862, y) + 0.0013),
             (0.020, 0.048, 0.0010), 'pink_deep', r=0.0005)

    # --- молния по длинному борту -Y ------------------------------------
    zy = 0.0272
    cube(PREFIX + 'zip_tape', (0.0, -(AY + 0.0006), zy), (1.30, 0.0020, 0.0074),
         'shade', r=0.0005)
    bm = bmesh.new()
    x = -0.640
    while x <= 0.640:
        bm_box(bm, (x, -(AY + 0.0019), zy), (0.0032, 0.0020, 0.0022))
        x += 0.0074
    bm_to_obj(PREFIX + 'zip_teeth', bm, 'web', False)
    cube(PREFIX + 'zip_slider', (0.300, -(AY + 0.0023), zy),
         (0.018, 0.0060, 0.0080), 'web', r=0.0012)
    cube(PREFIX + 'zip_pull', (0.300, -(AY + 0.0028), 0.0198),
         (0.006, 0.0020, 0.0110), 'web', r=0.0006)

    # --- тканевая бирка --------------------------------------------------
    lx, ly = -0.720, -0.393
    cube(PREFIX + 'label', (lx, ly, top_z(lx, ly) + 0.0008),
         (0.078, 0.026, 0.0012), 'ivory', r=0.0004)
    cube(PREFIX + 'label_bar', (lx, ly, top_z(lx, ly) + 0.0016),
         (0.052, 0.0055, 0.0007), 'pink', r=0.0002)


# --- проверки ------------------------------------------------------------
def mesh_bbox(objects):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in objects:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def check(cover_verts):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    rep = {
        'component': CID,
        'nodes': len(objs),
        'meshes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.01 and abs(size.y - 0.9) <= 0.01
                        and 0.055 <= size.z <= 0.062),
        'verts_total': sum(len(o.data.vertices) for o in meshes),
        'tris_total': sum(len(o.data.loop_triangles) for o in meshes),
        'cover_verts': cover_verts,
        'materials': sorted({m.name for o in meshes for m in o.data.materials if m}),
        'mat_count': len({m.name for o in meshes for m in o.data.materials if m}),
        'objects': sorted(o.name for o in meshes),
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
        'puff_peak': round(max(top_z(x, 0.0) for x in (-0.6, -0.3, 0.0, 0.3, 0.6)), 5),
        'piping_z': round(Z1 - RR + 0.0018, 5),
    }
    for o in meshes:
        o.data.calc_loop_triangles()
    rep['tris_total'] = sum(len(o.data.loop_triangles) for o in meshes)
    return rep


def export():
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = OUT / f'{CID}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    reset()
    cover, cover_verts = build_cover()
    build_parts()
    rep = check(cover_verts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok']:
        raise SystemExit('bbox check failed')


main()
