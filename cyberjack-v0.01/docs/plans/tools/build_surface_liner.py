"""Standalone builder: surface_liner (SRF-LIN-06, «Лайнер»).

Сменный гигиенический вкладыш на ложе: тонкое молочное полотно с приподнятым
краем, кантом-валиком по периметру, прострочкой, тремя анатомическими полосами,
четырьмя угловыми ремнями (2 кнопки + 2 липучки), язычком для снятия и
маркировкой. Без плиты, без вращений, без анимации.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_surface_liner.py

Выход:
  public/models/machine-modules/components/surface_liner.glb

Геометрия (Blender Z-up, метры):
  план полотна       = 1,98 x 0,88, полотно TH = 2,0 мм (паспорт «2,0 x 0,9 x 0,002»)
  кант               = валик r=3,2 мм по контуру, лежит на плоскости z=0
  габарит по Z       = полотно 2 мм + кант/ремень/кнопка до ~9,4 мм
                       (паспортная цифра 0,002 — это толщина полотна, не
                       габарит узла с фурнитурой; см. bbox_axes_note в отчёте)
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/surface_liner'
CID = 'surface_liner'
PREFIX = CID + '__'
CODE = 'SRF-LIN-06'

# --- ключевые размеры (м) -------------------------------------------------
AX, AY = 0.9900, 0.4400      # полугабарит полотна (1,98 x 0,88)
RC = 0.0450                  # скругление плана
TH = 0.0020                  # толщина полотна (паспорт 2 мм)
PUFF = 0.0055               # подъём полотна в центре каждой секции (мягкий слой)
G = 0.1465                   # координаты продольных швов y = +-0.1465 (3 секции)
RW = 0.0040                  # радиус канта-валика
INNER = 0.0155               # отступ прострочки по полотну от канта
BIND_IN, BIND_OUT = 0.0015, 0.0205   # косой кант-окантовка на полотне
STRAP_HW = 0.0230            # полуширина углового ремня 46 мм
STRAP_T = 0.0018
TAB_HW = 0.0290              # язычок 58 мм
STUD_R = 0.0090

NS_CORE, NS_ARC = 60, 9      # станции лофта полотна
NT = 41                      # точек по ширине сечения

PALETTE = {
    'ivory': (0.888, 0.874, 0.844),
    'shade': (0.742, 0.728, 0.700),
    'rose': (0.772, 0.446, 0.478),
    'rose_deep': (0.652, 0.330, 0.372),
    'thread': (0.892, 0.700, 0.722),
    'web': (0.232, 0.228, 0.234),
    'velcro': (0.418, 0.410, 0.402),
    'steel': (0.700, 0.703, 0.694),
    'ink': (0.212, 0.218, 0.230),
}
ROUGH = {'ivory': 0.93, 'shade': 0.90, 'rose': 0.88, 'rose_deep': 0.86,
         'thread': 0.92, 'web': 0.86, 'velcro': 0.97, 'steel': 0.34,
         'ink': 0.72}
MATS = {}


# --- helpers --------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_liner_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = 0.62 if role == 'steel' else 0.0
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


def bevel(obj, width=0.0010, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def solidify(obj, thickness, offset=0.0):
    mod = obj.modifiers.new('sol', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = offset
    mod.use_even_offset = True
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def cube(name, loc, size, role, r=0.0010, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, vertices=24, smooth=True, bev=0.0, r2=None):
    a, b = Vector(a), Vector(b)
    d = b - a
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                            depth=d.length,
                                            location=(a + b) * 0.5)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
                                        radius2=r2, depth=d.length,
                                        location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def torus(name, loc, major, minor, role, axis='Z', segs=36, rings=9):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def curve_tube(name, points, radius, role, cyclic=True, res=4, ru=1):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = ru
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
    obj = bpy.context.object
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def bm_to_obj(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def outline_rect(ax, ay, r, nl, ns, na, z=0.0):
    """Замкнутый контур скруглённого прямоугольника (по часовой от (ax,-cy))."""
    cx, cy = ax - r, ay - r
    pts = []

    def line(p0, p1, n, skip_first=False):
        k0 = 1 if skip_first else 0
        for k in range(k0, n + 1):
            f = k / n
            pts.append((p0[0] + (p1[0] - p0[0]) * f,
                        p0[1] + (p1[1] - p0[1]) * f, z))

    def arc(ccx, ccy, a0, a1, skip_first=True, skip_last=False):
        k0 = 1 if skip_first else 0
        k1 = na - 1 if skip_last else na
        for k in range(k0, k1 + 1):
            a = a0 + (a1 - a0) * k / na
            pts.append((ccx + r * math.cos(a), ccy + r * math.sin(a), z))

    line((ax, -cy), (ax, cy), ns)                     # торец +X
    arc(cx, cy, 0.0, math.pi / 2)                     # NE
    line((cx, ay), (-cx, ay), nl, skip_first=True)    # борт +Y
    arc(-cx, cy, math.pi / 2, math.pi)                # NW
    line((-ax, cy), (-ax, -cy), ns, skip_first=True)  # торец -X
    arc(-cx, -cy, math.pi, 1.5 * math.pi)             # SW
    line((-cx, -ay), (cx, -ay), nl, skip_first=True)  # борт -Y
    arc(cx, -cy, 1.5 * math.pi, 2.0 * math.pi, skip_last=True)   # SE
    return pts


# --- геометрия полотна ----------------------------------------------------
def plan_sdf(x, y):
    """Знаковое расстояние до контура плана: <0 внутри."""
    dx = abs(x) - (AX - RC)
    dy = abs(y) - (AY - RC)
    return (math.hypot(max(dx, 0.0), max(dy, 0.0))
            + min(max(dx, dy), 0.0) - RC)


def half_w(x):
    ax_in = AX - RC
    a = abs(x)
    if a <= ax_in:
        return AY
    if a >= AX:
        return AY - RC
    return AY - RC + math.sqrt(max(0.0, RC * RC - (a - ax_in) ** 2))


def endfall(x):
    return 1.0 - smoothstep((abs(x) / AX - 0.895) / 0.105)


BANDS = ((-AY, -G), (-G, G), (G, AY))
PINCH = 0.0015                # защемление полотна в подшиве у канта
SEAM_PIN = 0.0009             # канал продольного шва


def band_crown(yy):
    """Профиль одной анатомической секции: 1 в центре полосы, 0 на швах."""
    for a, b in BANDS:
        if a - 1e-9 <= yy <= b + 1e-9:
            yc = (a + b) * 0.5
            hb = (b - a) * 0.5
            t = max(-1.0, min(1.0, (yy - yc) / hb))
            return math.cos(math.pi * t * 0.5) ** 0.72
    return 0.0


def puff(x, y):
    """Подъём секции минус защемление в продольных швах и у канта."""
    w = half_w(x)
    if w < 1e-5:
        return 0.0
    ef = endfall(x)
    if ef <= 0.0:
        return 0.0
    yy = y * (AY / w)                       # к торцам полосы сужаются вместе с планом
    crown = PUFF * band_crown(yy) * ef
    pin = SEAM_PIN * math.exp(-((abs(y) - G) / 0.0080) ** 2) * ef
    d_in = -plan_sdf(x, y)
    hem = PINCH * 0.90 * math.exp(-((d_in - 0.0155) / 0.0055) ** 2) * ef
    return crown - pin - hem


def surf(x, y):
    """Верх полотна в точке (x, y)."""
    return TH + puff(x, y)


def bead_top(d_in, gap):
    """Верх канта над точкой на расстоянии d_in от контура (внутрь >0).

    Кант — валик r=RW с осью на контуре на высоте z=RW; сверху по нему идёт
    ремень/язычок с зазором gap.
    """
    d = abs(d_in)
    rr = RW + gap
    if d >= rr:
        return None
    return RW + math.sqrt(max(0.0, rr * rr - d * d))


def support(x, y, gap=0.0012, lift=0.0018):
    """Высота ремня: полотно внутри, валик канта над контуром."""
    d_in = -plan_sdf(x, y)
    z = surf(x, y) + lift if d_in >= 0.0 else 0.0
    bt = bead_top(d_in, gap)
    if bt is not None:
        z = max(z, bt)
    return z


# --- сборка ---------------------------------------------------------------
def build_membrane():
    """Лофт полотна по X: сечение — верх с подъёмом, борт, плоский низ."""
    xs = []
    ax_in = AX - RC
    for i in range(NS_CORE + 1):
        xs.append(-ax_in + 2.0 * ax_in * i / NS_CORE)
    for k in range(1, NS_ARC + 1):
        a = (math.pi / 2) * k / NS_ARC
        xs.append(ax_in + RC * math.sin(a))
        xs.append(-ax_in - RC * math.sin(a))
    xs = sorted({round(v, 7) for v in xs})

    bm = bmesh.new()
    rings = []
    for x in xs:
        w = max(half_w(x), 1e-4)
        ring = []
        ys = [w * math.cos(math.pi * i / (NT - 1)) for i in range(NT)]
        for y in ys:                                   # верх: +w -> -w
            ring.append(bm.verts.new((x, y, surf(x, y))))
        ring.append(bm.verts.new((x, -w, TH * 0.45)))
        ring.append(bm.verts.new((x, -w, 0.0)))
        for y in reversed(ys[1:-1]):                   # низ: -w -> +w
            ring.append(bm.verts.new((x, y, 0.0)))
        ring.append(bm.verts.new((x, w, 0.0)))
        ring.append(bm.verts.new((x, w, TH * 0.45)))
        rings.append(ring)

    faces_top = 0
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        L = len(a)
        for j in range(L):
            k = (j + 1) % L
            f = bm.faces.new((a[j], a[k], b[k], b[j]))
            zavg = sum(v.co.z for v in f.verts) / len(f.verts)
            f.material_index = 0 if zavg > TH * 0.86 else 1
            if f.material_index == 0:
                faces_top += 1

    for ring, rev in ((rings[0], True), (rings[-1], False)):
        c = Vector((0.0, 0.0, 0.0))
        for v in ring:
            c += v.co
        c /= len(ring)
        cv = bm.verts.new(c)
        L = len(ring)
        for j in range(L):
            k = (j + 1) % L
            tri = (ring[k], ring[j], cv) if rev else (ring[j], ring[k], cv)
            f = bm.faces.new(tri)
            f.material_index = 1

    obj = bm_to_obj(PREFIX + 'membrane', bm, 'ivory', True)
    obj.data.materials.append(mat('shade'))
    for p in obj.data.polygons:
        if p.material_index == 1:
            p.use_smooth = False
    return obj, faces_top


def build_welt():
    """Кант-валик по контуру плана, лежит на плоскости z=0."""
    pts = outline_rect(AX, AY, RC, nl=112, ns=44, na=12, z=RW)
    return curve_tube(PREFIX + 'welt', pts, RW, 'rose', cyclic=True, res=4), len(pts)


def inset_loop(inset, n_long=90, n_short=26, n_arc=9):
    """Замкнутый контур, вписанный внутрь плана на inset."""
    pts = outline_rect(AX - inset, AY - inset, RC - inset,
                       nl=n_long, ns=n_short, na=n_arc)
    return [Vector((x, y, 0.0)) for x, y, _ in pts]


def dashes_along(name, pts, role, spacing=0.0165, length=0.0080, width=0.0013,
                 thick=0.00045, lift=0.00035, zfun=None):
    """Пунктирная строчка вдоль замкнутого (или открытого) контура."""
    zf = zfun or (lambda x, y: surf(x, y))
    n = len(pts)
    total = sum((pts[(i + 1) % n] - pts[i]).length for i in range(n))
    count = max(1, int(total / spacing))
    bm = bmesh.new()
    quad = ((0.5, 0.5), (0.5, -0.5), (-0.5, -0.5), (-0.5, 0.5))
    for i in range(count):
        d = (i + 0.5) * total / count
        acc, p, w = 0.0, pts[-1], pts[0] - pts[-1]
        for j in range(n):
            seg = (pts[(j + 1) % n] - pts[j]).length
            if acc + seg >= d:
                f = (d - acc) / seg
                p = pts[j].lerp(pts[(j + 1) % n], f)
                w = pts[(j + 1) % n] - pts[j]
                break
            acc += seg
        t = Vector((w.x, w.y, 0.0)).normalized()
        nr = Vector((-t.y, t.x, 0.0))
        base = Vector((p.x, p.y, zf(p.x, p.y) + lift))
        low = [bm.verts.new(base + t * (a * length) + nr * (b * width))
               for a, b in quad]
        high = [bm.verts.new(base + t * (a * length) + nr * (b * width)
                             + Vector((0, 0, thick))) for a, b in quad]
        bm.faces.new(low)
        bm.faces.new(tuple(reversed(high)))
        for k in range(4):
            m = (k + 1) % 4
            bm.faces.new((low[k], low[m], high[m], high[k]))
    return bm_to_obj(name, bm, role, False), count


def hug_patch(name, cx, cy, half_len, half_wid, ang, role, lift=0.0004,
              thick=0.0011, nu=10, nv=5, zfun=None):
    """Плоская накладка, повторяющая верх полотна (ярлык, липучка)."""
    zf = zfun or (lambda x, y: surf(x, y))
    u = Vector((math.cos(ang), math.sin(ang), 0.0))
    v = Vector((-math.sin(ang), math.cos(ang), 0.0))
    bm = bmesh.new()
    grid = []
    for i in range(nu + 1):
        s = -half_len + 2 * half_len * i / nu
        row = []
        for j in range(nv + 1):
            t = -half_wid + 2 * half_wid * j / nv
            p = Vector((cx, cy, 0.0)) + u * s + v * t
            row.append(bm.verts.new((p.x, p.y, zf(p.x, p.y) + lift)))
        grid.append(row)
    for i in range(nu):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i + 1][j],
                          grid[i + 1][j + 1], grid[i][j + 1]))
    obj = bm_to_obj(name, bm, role, True)
    solidify(obj, thick, offset=0.0)
    return obj


def corner_strap(sx, sy):
    """Угловой ремень: по полотну, через валик канта, вниз под лайнер."""
    tag = ('p' if sx > 0 else 'n') + ('p' if sy > 0 else 'n')
    C = Vector((sx * (AX - RC), sy * (AY - RC), 0.0))
    u = Vector((sx, sy, 0.0)).normalized()
    Pout = C + u * RC
    gap = 0.0012

    # s отсчитывается от контура: <0 внутрь полотна, >0 наружу за кант
    ns = 40
    bm = bmesh.new()
    nv = 6
    grid = []
    s0, s1 = -0.0940, RW + gap + 0.0060
    for i in range(ns + 1):
        s = s0 + (s1 - s0) * (i / (ns - 1))
        hw = STRAP_HW
        if s > s1 - 0.0165:                              # скруглённый носик
            q = (s - (s1 - 0.0165)) / 0.0165
            hw = STRAP_HW * math.sqrt(max(0.14, 1.0 - q * q))
        elif s < s0 + 0.0130:                            # скруглённый внутренний конец
            q = (s0 + 0.0130 - s) / 0.0130
            hw = STRAP_HW * math.sqrt(max(0.30, 1.0 - q * q))
        row = []
        for j in range(nv + 1):
            t = (-1.0 + 2.0 * j / nv) * hw
            # по валику ремень идёт до самой широкой точки, дальше — вниз
            se = min(s, RW + gap)
            p = Pout + u * se + Vector((-u.y, u.x, 0.0)) * t
            z = support(p.x, p.y, gap)
            if s > RW + gap:
                z = max(-0.0016, RW - (s - (RW + gap)) * 1.25)
            row.append(bm.verts.new((p.x, p.y, z)))
        grid.append(row)
    for i in range(ns):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i + 1][j],
                          grid[i + 1][j + 1], grid[i][j + 1]))
    obj = bm_to_obj(PREFIX + f'corner_strap_{tag}', bm, 'web', True)
    solidify(obj, STRAP_T, offset=0.0)
    for p in obj.data.polygons:
        p.use_smooth = True

    # накладка-липучка или кнопка на ремне
    pc = Pout - u * 0.0430
    zc = support(pc.x, pc.y, gap) + STRAP_T * 0.5
    ang = math.atan2(u.y, u.x)
    if sx < 0:                                          # -X: кнопка
        cyl(PREFIX + f'stud_{tag}', (pc.x, pc.y, zc + 0.0002),
            (pc.x, pc.y, zc + 0.0020), STUD_R, 'steel', vertices=28, bev=0.0004)
        cyl(PREFIX + f'stud_boss_{tag}', (pc.x, pc.y, zc + 0.0018),
            (pc.x, pc.y, zc + 0.0030), 0.0052, 'steel', vertices=22,
            bev=0.0003)
        torus(PREFIX + f'stud_ring_{tag}', (pc.x, pc.y, zc + 0.0019),
              STUD_R - 0.0008, 0.00055, 'steel', 'Z', 30, 8)
    else:                                               # +X: липучка
        hug_patch(PREFIX + f'velcro_pad_{tag}', pc.x, pc.y, 0.0190, 0.0175,
                  ang, 'velcro', lift=STRAP_T * 0.5 + 0.0002, thick=0.0010,
                  nu=6, nv=5, zfun=lambda x, y: support(x, y, gap))

    # две закрепки-строчки у внутреннего конца ремня
    for k, sk in enumerate((-0.0760, -0.0640)):
        pts = [Vector((Pout.x + u.x * sk - u.y * (t * STRAP_HW),
                       Pout.y + u.y * sk + u.x * (t * STRAP_HW), 0.0))
               for t in (-1.0, -0.34, 0.34, 1.0)]
        bar, _ = dashes_along(PREFIX + f'strap_tack_{tag}_{k}', pts, 'thread',
                              spacing=0.0105, length=0.0072, width=0.0016,
                              thick=0.0005, lift=STRAP_T * 0.5 + 0.00035,
                              zfun=lambda x, y: support(x, y, gap))
    return tag


def build_seams():
    """Три анатомические секции: шов-жгут + двухрядная строчка."""
    for tag, sy in (('l', -1), ('r', 1)):
        y = sy * G
        pts = []
        x = -0.930
        while x <= 0.9305:
            pts.append((x, y, surf(x, y) + 0.0028))
            x += 0.030
        curve_tube(PREFIX + f'seam_cord_{tag}', pts, 0.0026, 'rose_deep',
                   cyclic=False, res=3)
        for row, off in (('a', -0.0088), ('b', 0.0088)):
            line = [Vector((v, y + off, 0.0)) for v in
                    [-0.906 + 0.0302 * i for i in range(61)]]
            dashes_along(PREFIX + f'seam_stitch_{tag}{row}', line, 'thread',
                         spacing=0.0165, length=0.0082, width=0.0013,
                         thick=0.00045, lift=0.00035)
        for sx in (-1, 1):
            cube(PREFIX + f'seam_tack_{tag}_{"a" if sx < 0 else "b"}',
                 (sx * 0.9070, y, surf(sx * 0.9070, y) + 0.0007),
                 (0.0135, 0.0330, 0.0016), 'rose_deep', r=0.0005)


def build_pull_tab():
    """Язычок для снятия на торце +X: заправлен под кант и торчит наружу."""
    gap = 0.0012
    ns, nv = 22, 6
    x0, x1 = 0.9215, 0.9995
    cap0 = 0.9785                                     # начало скругления носика
    bm = bmesh.new()
    grid = []
    for i in range(ns + 1):
        x = x0 + (x1 - x0) * i / ns
        hw = TAB_HW
        if x > cap0:
            q = (x - cap0) / (x1 - cap0)
            hw = TAB_HW * math.sqrt(max(0.06, 1.0 - q * q))
        row = []
        for j in range(nv + 1):
            y = (-1.0 + 2.0 * j / nv) * hw
            d_in = -plan_sdf(x, y)
            z = support(x, y, gap) + 0.0002
            if d_in < -(RW + gap):
                # носик выходит за кант горизонтально, с лёгким провисанием
                extra = -d_in - (RW + gap)
                z = (RW + gap) - extra * 0.30
            row.append(bm.verts.new((x, y, z)))
        grid.append(row)
    for i in range(ns):
        for j in range(nv):
            bm.faces.new((grid[i][j], grid[i + 1][j],
                          grid[i + 1][j + 1], grid[i][j + 1]))
    obj = bm_to_obj(PREFIX + 'pull_tab', bm, 'rose', True)
    solidify(obj, 0.0022, offset=0.0)
    for p in obj.data.polygons:
        p.use_smooth = True

    # строчка по краям язычка
    for sgn in (-1, 1):
        line = []
        for i in range(15):
            x = 0.9300 + (0.9910 - 0.9300) * i / 14
            hw = TAB_HW
            if x > cap0:
                q = (x - cap0) / (x1 - cap0)
                hw = TAB_HW * math.sqrt(max(0.06, 1.0 - q * q))
            line.append(Vector((x, sgn * (hw - 0.0055), 0.0)))
        dashes_along(PREFIX + f'tab_stitch_{"a" if sgn < 0 else "b"}', line,
                     'thread', spacing=0.0110, length=0.0055, width=0.0011,
                     thick=0.0004, lift=0.0002,
                     zfun=lambda x, y: max(support(x, y, gap) + 0.0015,
                                           RW + gap + 0.0013))
    cube(PREFIX + 'tab_root_bar', (0.9285, 0.0, surf(0.9285, 0.0) + 0.0017),
         (0.0090, 0.0470, 0.0015), 'rose_deep', r=0.0004)
    return obj


def build_label():
    """Маркировка: бирка + розовая полоса + код партии."""
    lx, ly = -0.7450, -0.3480
    hug_patch(PREFIX + 'label', lx, ly, 0.0520, 0.0190, 0.0, 'ivory',
              lift=0.0003, thick=0.0012, nu=12, nv=5)
    hug_patch(PREFIX + 'label_bar', lx - 0.0300, ly, 0.0155, 0.0172, 0.0,
              'rose_deep', lift=0.0016, thick=0.0009, nu=4, nv=4)
    bm = bmesh.new()
    for i in range(4):
        x = lx + 0.0060 + i * 0.0082
        hgt = 0.0042 - (i % 2) * 0.0012
        b = surf(x, ly)
        bmesh.ops.create_cube(bm, size=1.0, matrix=(
            Matrix.Translation((x, ly, b + 0.0016))
            @ Matrix.Diagonal((0.0016, 0.0010, hgt, 1.0))))
    bm_to_obj(PREFIX + 'label_ink', bm, 'ink', False)


def build_binding():
    """Косой кант-окантовка: плоская полоса по периметру под валиком канта."""
    outer = inset_loop(BIND_IN, 96, 28, 10)
    inner = inset_loop(BIND_OUT, 96, 28, 10)
    bm = bmesh.new()
    vo = [bm.verts.new((p.x, p.y, surf(p.x, p.y) + 0.0006)) for p in outer]
    vi = [bm.verts.new((p.x, p.y, surf(p.x, p.y) + 0.0006)) for p in inner]
    n = len(vo)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((vo[i], vo[j], vi[j], vi[i]))
    obj = bm_to_obj(PREFIX + 'binding', bm, 'rose', True)
    solidify(obj, 0.0013, offset=-1.0)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def build():
    reset()
    membrane, faces_top = build_membrane()
    welt, welt_pts = build_welt()
    binding = build_binding()

    # прострочка: по окантовке и по полотну в канале подшива
    stitch_b, n_bind = dashes_along(PREFIX + 'stitch_binding', inset_loop(0.0090),
                                    'thread', spacing=0.0200, length=0.0085,
                                    width=0.0014, thick=0.00045, lift=0.0009)
    stitch, n_edge = dashes_along(PREFIX + 'stitch_edge', inset_loop(INNER),
                                  'thread', spacing=0.0200, length=0.0085,
                                  width=0.0014, thick=0.00045, lift=0.00035)

    build_seams()
    tags = []
    for sx in (-1, 1):
        for sy in (-1, 1):
            tags.append(corner_strap(sx, sy))
    build_pull_tab()
    build_label()
    return membrane, faces_top, n_edge + n_bind, tags, welt_pts


# --- проверки -------------------------------------------------------------
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


def check(faces_top, n_edge, tags, welt_pts):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    for o in meshes:
        o.data.calc_loop_triangles()
    mats = sorted({m.name for o in meshes for m in o.data.materials if m})

    rep = {
        'component': CID,
        'code': CODE,
        'nodes': len(objs),
        'meshes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_target_passport': [2.0, 0.9, 0.002],
        'bbox_axes_note': ('X=длина, Y=ширина, Z=толщина; полотно '
                           f'{TH * 1000:.1f} мм по паспорту, габарит по Z '
                           'включает кант-валик, ремни и кнопки'),
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.012 and abs(size.y - 0.9) <= 0.012),
        'sheet_thickness_mm': round(TH * 1000, 2),
        'bbox_z_total_mm': round(size.z * 1000, 2),
        'flat_on_floor': bool(abs(mn.z) <= 0.0022),
        'sections': 3,
        'welt_radius_mm': round(RW * 1000, 2),
        'welt_points': welt_pts,
        'corner_straps': sorted(tags),
        'studs': ['stud_' + t for t in tags if t[0] == 'n'],
        'velcro': ['velcro_pad_' + t for t in tags if t[0] == 'p'],
        'edge_stitch_dashes': n_edge,
        'membrane_top_faces': faces_top,
        'verts_total': sum(len(o.data.vertices) for o in meshes),
        'tris_total': sum(len(o.data.loop_triangles) for o in meshes),
        'materials': mats,
        'material_count': len(mats),
        'parts': sorted(o.name for o in meshes),
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
        'peak_top_mm': round(max(surf(x, 0.0) for x in (-0.6, -0.3, 0.0, 0.3, 0.6)) * 1000, 2),
    }

    # полотно: толщина по оси Z там, где нет подъёма (у торца)
    rep['membrane_edge_z_mm'] = round(surf(AX - 0.001, 0.0) * 1000, 2)
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
    membrane, faces_top, n_edge, tags, welt_pts = build()
    rep = check(faces_top, n_edge, tags, welt_pts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok']:
        raise SystemExit('bbox check failed')
    if rep['material_count'] < 4:
        raise SystemExit('too few materials')


main()
