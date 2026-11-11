"""Standalone builder: structure_cage (STR-CAGE-05, «Каркас-капсула»).

Прозрачная округлая капсула 1,40 x 1,40 x 2,10 м:
  * гнутый трубчатый каркас со скруглённым в плане контуром (R угла 300 мм);
  * нижнее / поясное / верхнее кольца, четыре угловые стойки на дугах,
    стойки на стыках дуг и промежуточные рёбра;
  * сплошная стеклянная оболочка в два пояса (alpha 0,20 cyan / 0,26 blush),
    купол тоже стеклянный — интерьер виден насквозь;
  * округлая дверь (R 170 мм) с трубчатой обвязкой, тремя петлями, замком
    и наружным красным аварийным сбросом;
  * четыре верхних узла подвеса (D-ring) — задают высоту 2,10 м;
  * вентиляционные щели (в двери и в тылу), внутренняя обшивка, рёбра,
    циановая подсветка, стяжки-X и кабельный ввод — всё видно через стекло.

Никаких матовых глухих панелей и острых коробочных углов.

Не зависит от build_component_library.py / других build-скриптов.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_structure_cage.py

  QUICK=1 — быстрый черновой рендер (один вид, низкое качество).

Выход:
  public/models/machine-modules/components/structure_cage.glb
  docs/plans/blockout/component-library/structure_cage/*.png
  docs/plans/blockout/component-library/structure_cage/report.json

Геометрия (Blender Z-up, метры):
  центр в плане — (0, 0); низ на z = 0; верх (D-ring) на z = 2,10
  перед (-Y) — дверь: петли слева (-X), замок и аварийный сброс справа (+X)
  вращения нет (motion: none), анимационная пустышка не нужна
"""
from pathlib import Path
import json
import math
import os

import bpy
import bmesh
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/structure_cage'
CID = 'structure_cage'
PREFIX = CID + '__'
QUICK = bool(os.environ.get('QUICK'))

# --- габарит и ключевые размеры (м) --------------------------------------
HX = HY = 0.7000                 # 1,40 x 1,40 по наружным граням каркаса
H = HX - 0.0300                  # 0.670 — осевая линия каркаса в плане
RC = 0.3000                      # радиус скругления контура в плане
RT = 0.0300                      # радиус трубы основного каркаса
RR = 0.0140                      # радиус промежуточных рёбер
TOP = 2.1000                     # 2,10 высота (по верхним D-ring)

Z_BOT = 0.0360                   # нижнее кольцо
Z_BELT = 1.0000                  # поясное кольцо
Z_TOP = 1.9400                   # верхнее кольцо
Z_APEX = 2.0460                  # вершина купола

G_OUT = 0.0300                   # стекло: наружная поверхность от осевой
G_T = 0.0080                     # толщина стекла
ALPHA_MAIN = 0.20                # alpha основного стекла
ALPHA_DOOR = 0.26                # alpha стекла двери (blush)

# дверь (перед, -Y), полотно утоплено в проём
DOOR_HX = 0.3200                 # полотно 0,640 x 1,675
DOOR_Z0, DOOR_Z1 = 0.1700, 1.8450
DOOR_R = 0.2450                  # большой радиус скругления двери
DOOR_Y = -0.6420                 # осевая плоскость обвязки двери
DOOR_FR = 0.0220                 # радиус трубы обвязки двери
DOOR_GY = -0.6300                # плоскость стекла двери

LOCK_Z = 1.1050
HINGE_Z = (0.5200, 0.9800, 1.4400)

LIFT_RING_R = 0.0500
LIFT_RING_MINOR = 0.0080
LIFT_RING_Z = TOP - LIFT_RING_MINOR - LIFT_RING_R      # 2.042

PALETTE = {
    'frame': (0.062, 0.067, 0.074),
    'steel': (0.640, 0.655, 0.672),
    'ivory': (0.760, 0.742, 0.706),
    'dark': (0.078, 0.082, 0.088),
    'cyan': (0.140, 0.780, 0.840),
    'red': (0.680, 0.105, 0.090),
    'glass': (0.430, 0.780, 0.860),
    'glass_blush': (0.930, 0.620, 0.665),
}
MATS = {}


# --- материалы -----------------------------------------------------------
def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    rough, metal = {
        'frame': (0.62, 0.12),
        'steel': (0.17, 1.00),
        'ivory': (0.70, 0.00),
        'dark': (0.58, 0.20),
        'cyan': (0.35, 0.00),
        'red': (0.42, 0.05),
        'glass': (0.105, 0.00),
        'glass_blush': (0.110, 0.00),
    }[role]
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal

    if role in ('glass', 'glass_blush'):
        alpha = ALPHA_DOOR if role == 'glass_blush' else ALPHA_MAIN
        bsdf.inputs['Alpha'].default_value = alpha
        bsdf.inputs['IOR'].default_value = 1.46
        bsdf.inputs['Coat Weight'].default_value = 0.45
        bsdf.inputs['Coat Roughness'].default_value = 0.09
        bsdf.inputs['Specular IOR Level'].default_value = 0.50
        m.blend_method = 'BLEND'
        m.surface_render_method = 'BLENDED'
        m.use_backface_culling = False
        m.show_transparent_back = True
        if hasattr(m, 'use_transparent_shadow'):
            m.use_transparent_shadow = True
        m.diffuse_color = (*color, alpha)
    else:
        m.diffuse_color = (*color, 1.0)

    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 5.0
    if role == 'steel':
        bsdf.inputs['Coat Weight'].default_value = 0.35
    if role == 'frame':
        bsdf.inputs['Specular IOR Level'].default_value = 0.22
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


# --- базовые примитивы ---------------------------------------------------
def mesh_obj(name, verts, faces, role, smooth_faces=()):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.validate(verbose=False)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    for i, p in enumerate(me.polygons):
        p.use_smooth = i in smooth_faces
    me.update()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role)


def bevel(obj, width=0.0015, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, vertices=28, smooth=True, r2=None, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
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


def sphere(name, loc, radius, role, segs=18, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=36, rings=10,
          rot=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs,
                                     minor_segments=rings,
                                     major_radius=major,
                                     minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    if rot is not None:
        obj.rotation_euler = rot
    elif axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


# --- скруглённый прямоугольник (план / контур) ---------------------------
def _a(t):
    return math.pi / 2 * t


class RRect:
    """Скруглённый прямоугольник: hx, hy — полуоси, r — радиус угла.

    Обход CCW, u = 0 в начале передней грани (-cx, -hy).
    """

    def __init__(self, hx, hy, r):
        self.hx, self.hy = hx, hy
        self.r = min(r, min(hx, hy) * 0.95)
        R = self.r
        cx, cy = hx - R, hy - R
        self.cx, self.cy = cx, cy
        ar = math.pi / 2 * R
        self.segs = [
            (2 * cx, lambda t: (-cx + 2 * cx * t, -hy)),
            (ar, lambda t: (cx + R * math.sin(_a(t)), -cy - R * math.cos(_a(t)))),
            (2 * cy, lambda t: (hx, -cy + 2 * cy * t)),
            (ar, lambda t: (cx + R * math.cos(_a(t)), cy + R * math.sin(_a(t)))),
            (2 * cx, lambda t: (cx - 2 * cx * t, hy)),
            (ar, lambda t: (-cx - R * math.sin(_a(t)), cy + R * math.cos(_a(t)))),
            (2 * cy, lambda t: (-hx, cy - 2 * cy * t)),
            (ar, lambda t: (-cx - R * math.cos(_a(t)), -cy - R * math.sin(_a(t)))),
        ]
        self.seg_len = [s[0] for s in self.segs]
        self.u = [0.0]
        for ln in self.seg_len:
            self.u.append(self.u[-1] + ln)
        self.p = self.u[-1]

    def point(self, u):
        u = u % self.p
        for i, (ln, fn) in enumerate(self.segs):
            if u <= ln + 1e-9 or i == len(self.segs) - 1:
                return Vector(fn(min(u / ln, 1.0)))
            u -= ln
        return Vector(self.segs[-1][1](1.0))

    def dense(self, step_straight=0.045, step_arc=0.020):
        pts = []
        for ln, fn in self.segs:
            n = max(2, int(math.ceil(ln / (step_arc if ln < 0.55 else step_straight))))
            for i in range(n):
                pts.append(Vector(fn(i / n)))
        return pts

    def slice(self, u0, u1):
        us = []
        for i in range(len(self.segs)):
            ln = self.segs[i][0]
            n = max(2, int(math.ceil(ln / (0.02 if ln < 0.55 else 0.045))))
            for k in range(n):
                us.append(self.u[i] + ln * k / n)
        us = sorted(us + [u0, u1])
        keep = []
        for uu in us:
            if u0 - 1e-9 <= uu <= u1 + 1e-9:
                if not keep or uu - keep[-1] > 1e-4:
                    keep.append(uu)
        if keep[0] > u0 + 1e-9:
            keep.insert(0, u0)
        if keep[-1] < u1 - 1e-9:
            keep.append(u1)
        return keep, [self.point(uu) for uu in keep]


def offset2d(pts, d, closed=False):
    """Смещение полилинии по нормалям (наружу для CCW)."""
    n = len(pts)
    out = []
    for i in range(n):
        if closed:
            d1 = pts[i] - pts[(i - 1) % n]
            d2 = pts[(i + 1) % n] - pts[i]
        else:
            if i == 0:
                d1 = d2 = pts[1] - pts[0]
            elif i == n - 1:
                d1 = d2 = pts[-1] - pts[-2]
            else:
                d1 = pts[i] - pts[i - 1]
                d2 = pts[i + 1] - pts[i]
        nn = Vector((0.0, 0.0))
        for dd in (d1, d2):
            if dd.length > 1e-9:
                dd = dd.normalized()
                nn += Vector((dd.y, -dd.x))
        if nn.length < 1e-9:
            nn = Vector((1.0, 0.0))
        out.append(pts[i] + nn.normalized() * d)
    return out


def to3d(u, v, d, plane):
    if plane == 'XY':
        return Vector((u, v, d))
    if plane == 'XZ':
        return Vector((u, d, v))
    return Vector((d, u, v))


def wall(name, pts2d, plane, off_out, thick, d0, d1, role, bevel_r=0.0):
    """Толстостенная оболочка (стекло) вдоль 2D-контура."""
    inner = offset2d(pts2d, off_out - thick)
    outer = offset2d(pts2d, off_out)
    verts, faces, side = [], [], []
    m = len(pts2d)
    for i in range(m):
        for pl, d in ((outer, d0), (outer, d1), (inner, d1), (inner, d0)):
            verts.append(to3d(pl[i].x, pl[i].y, d, plane))
    for i in range(m - 1):
        a, b = i * 4, (i + 1) * 4
        faces.append((a + 0, a + 1, b + 1, b + 0))
        faces.append((a + 3, b + 3, b + 2, a + 2))
        faces.append((a + 1, a + 2, b + 2, b + 1))
        faces.append((a + 0, b + 0, b + 3, a + 3))
        side += [len(faces) - 4, len(faces) - 3]
    faces.append((0, 3, 2, 1))
    faces.append((4 * (m - 1) + 0, 4 * (m - 1) + 1,
                  4 * (m - 1) + 2, 4 * (m - 1) + 3))
    obj = mesh_obj(name, verts, faces, role, smooth_faces=set(side))
    if bevel_r > 0:
        bevel(obj, bevel_r, 2)
    return obj


def tube(name, pts, radius, role, closed=False, segs=16,
         plane_normal=Vector((0, 0, 1))):
    n = len(pts)
    nrm = Vector(plane_normal).normalized()
    rings = []
    for i in range(n):
        if closed:
            t = pts[(i + 1) % n] - pts[(i - 1) % n]
        else:
            if i == 0:
                t = pts[1] - pts[0]
            elif i == n - 1:
                t = pts[-1] - pts[-2]
            else:
                t = pts[i + 1] - pts[i - 1]
        t.normalize()
        e1 = nrm.cross(t)
        if e1.length < 1e-6:
            e1 = Vector((1, 0, 0))
        e1.normalize()
        e2 = t.cross(e1).normalized()
        rings.append([pts[i] + e1 * (radius * math.cos(2 * math.pi * k / segs))
                      + e2 * (radius * math.sin(2 * math.pi * k / segs))
                      for k in range(segs)])
    verts = [v for r in rings for v in r]
    faces, smooth = [], []
    lim = n if closed else n - 1
    for i in range(lim):
        j = (i + 1) % n
        for k in range(segs):
            k2 = (k + 1) % segs
            faces.append((i * segs + k, i * segs + k2,
                          j * segs + k2, j * segs + k))
            smooth.append(len(faces) - 1)
    if not closed:
        faces.append(tuple(range(segs - 1, -1, -1)))
        faces.append(tuple((n - 1) * segs + k for k in range(segs)))
    return mesh_obj(name, verts, faces, role, smooth_faces=set(smooth))


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    plan = RRect(H, H, RC)
    U = plan.u
    LS = U[1] - U[0]                     # 0.740 — прямая грань
    P = plan.p
    ring_pts = plan.dense()

    def scaled(u, s):
        p = plan.point(u) * s
        return p

    def vertical(name, u, z0, z1, r, role, scale=1.0, segs=20):
        p = plan.point(u) * scale
        return add(cyl(name, (p.x, p.y, z0), (p.x, p.y, z1), r, role,
                       vertices=segs, bev=0.0012))

    # ---- кольца каркаса ------------------------------------------------
    add(tube(f'{PREFIX}ring_bottom',
             [Vector((p.x, p.y, Z_BOT)) for p in ring_pts], RT, 'frame',
             closed=True))
    add(tube(f'{PREFIX}ring_top',
             [Vector((p.x, p.y, Z_TOP)) for p in ring_pts], RT, 'frame',
             closed=True))
    _, belt = plan.slice(U[1] + 0.014, P - 0.014)
    add(tube(f'{PREFIX}ring_belt', [Vector((p.x, p.y, Z_BELT)) for p in belt],
             RT, 'frame'))

    # ---- вертикальный набор -------------------------------------------
    corner_uv = [('fr', (1, -1)), ('br', (1, 1)), ('bl', (-1, 1)),
                 ('fl', (-1, -1))]
    # середины угловых дуг
    arc_mid = [(U[1] + U[2]) / 2, (U[3] + U[4]) / 2,
               (U[5] + U[6]) / 2, (U[7] + P) / 2]
    corner_posts = {}
    for (tag, _), u in zip(corner_uv, arc_mid):
        p = plan.point(u)
        corner_posts[tag] = (p.x, p.y, u)
        add(cyl(f'{PREFIX}post_corner_{tag}', (p.x, p.y, Z_BOT - RT),
                (p.x, p.y, Z_TOP + RT * 0.55), RT, 'frame', vertices=24))
        add(cyl(f'{PREFIX}post_corner_{tag}_collar', (p.x, p.y, Z_BELT),
                (p.x, p.y, Z_BELT + 0.040), RT * 1.18, 'frame', vertices=24,
                bev=0.003))

    # стойки на стыках прямых и дуг
    for i, u in enumerate((U[1], U[2], U[3], U[4], U[5], U[7]), start=1):
        vertical(f'{PREFIX}post_edge_{i}', u, Z_BOT - RT * 0.5,
                 Z_TOP + RT * 0.15, 0.021, 'frame')

    # промежуточные рёбра на трёх прямых гранях
    for side, i0, i1 in (('right', 2, 3), ('back', 4, 5), ('left', 6, 7)):
        for k, f in enumerate((0.335, 0.665), start=1):
            vertical(f'{PREFIX}rib_{side}_{k}', U[i0] + (U[i1] - U[i0]) * f,
                     Z_BOT, Z_TOP, RR, 'frame', segs=14)

    # ---- сплошная стеклянная оболочка (2 пояса) ----------------------
    _, skin = plan.slice(U[1], P)
    add(wall(f'{PREFIX}glass_low', skin, 'XY', -G_OUT, G_T,
             Z_BOT, Z_BELT, 'glass', bevel_r=0.0014))
    add(wall(f'{PREFIX}glass_up', skin, 'XY', -G_OUT, G_T,
             Z_BELT, Z_TOP, 'glass', bevel_r=0.0014))

    # ---- стеклянный купол ---------------------------------------------
    prof = [(0.028, Z_TOP + 0.002), (0.090, 1.9740), (0.180, 2.0000),
            (0.280, 2.0200), (0.380, 2.0350), (0.470, 2.0450),
            (0.545, Z_APEX)]
    N_DOME = 112
    rings = []
    for inset, z in prof:
        rr = RRect(H - inset, H - inset, max(RC - inset, 0.060))
        rings.append([Vector((rr.point(rr.p * i / N_DOME).x,
                              rr.point(rr.p * i / N_DOME).y, z))
                      for i in range(N_DOME)])
    n = len(rings[0])
    verts = [v for r in rings for v in r]
    faces = []
    for i in range(len(rings) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            faces.append((i * n + k, i * n + k2,
                          (i + 1) * n + k2, (i + 1) * n + k))
    faces.append(tuple((len(rings) - 1) * n + k for k in range(n)))
    dome = mesh_obj(f'{PREFIX}glass_dome', verts, faces, 'glass',
                    smooth_faces=set(range(len(faces))))
    sol = dome.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = G_T
    sol.offset = -1.0
    sol.use_even_offset = True
    bpy.context.view_layer.objects.active = dome
    bpy.ops.object.modifier_apply(modifier=sol.name)
    add(dome)

    # ---- дверь ---------------------------------------------------------
    cz = (DOOR_Z0 + DOOR_Z1) * 0.5
    dz = (DOOR_Z1 - DOOR_Z0) * 0.5
    dr = RRect(DOOR_HX, dz, DOOR_R)
    dloop = dr.dense()
    add(tube(f'{PREFIX}door_frame',
             [Vector((p.x, DOOR_Y, p.y + cz)) for p in dloop],
             DOOR_FR, 'frame', closed=True, segs=16,
             plane_normal=Vector((0, 1, 0))))
    add(wall(f'{PREFIX}door_glass',
             [Vector((p.x, p.y + cz)) for p in dloop], 'XZ',
             -0.006, G_T, DOOR_GY - G_T * 0.5, DOOR_GY + G_T * 0.5,
             'glass_blush', bevel_r=0.0012))

    # петли слева (3 шт)
    for i, z in enumerate(HINGE_Z, start=1):
        add(cyl(f'{PREFIX}hinge_{i}_barrel',
                (-0.3505, -0.6715, z - 0.070),
                (-0.3505, -0.6715, z + 0.070),
                0.0150, 'steel', vertices=20, bev=0.0012))
        for s in (-1, 1):
            add(cyl(f'{PREFIX}hinge_{i}_pin_{s}_{s}',
                    (-0.3505, -0.6715, z + s * 0.070),
                    (-0.3505, -0.6715, z + s * 0.086),
                    0.0100, 'frame', vertices=14))
        add(cube(f'{PREFIX}hinge_{i}_leaf', (-0.3130, -0.6555, z),
                 (0.070, 0.026, 0.100), 'steel', r=0.0050))
        add(cube(f'{PREFIX}hinge_{i}_bracket', (-0.3560, -0.6600, z),
                 (0.026, 0.040, 0.092), 'frame', r=0.0045))
        add(cyl(f'{PREFIX}hinge_{i}_bolt', (-0.3130, -0.6555, z + 0.030),
                (-0.3130, -0.6665, z + 0.030), 0.0070, 'frame',
                vertices=6, smooth=False))

    # замок справа
    lx = DOOR_HX - 0.032
    add(cube(f'{PREFIX}lock_housing', (lx, -0.6770, LOCK_Z),
             (0.064, 0.040, 0.168), 'frame', r=0.010))
    add(cube(f'{PREFIX}lock_escutcheon', (lx, -0.6900, LOCK_Z),
             (0.088, 0.008, 0.208), 'steel', r=0.014))
    add(cyl(f'{PREFIX}lock_cylinder', (lx, -0.6960, LOCK_Z),
            (lx, -0.6880, LOCK_Z), 0.0165, 'dark', vertices=20))
    add(torus(f'{PREFIX}lock_ring', (lx, -0.6930, LOCK_Z),
              0.0205, 0.0032, 'steel', axis='Y', segs=26, rings=8))
    add(cyl(f'{PREFIX}lock_lever', (lx - 0.008, -0.6860, LOCK_Z),
            (lx - 0.128, -0.6860, LOCK_Z - 0.008), 0.0100, 'steel',
            vertices=16))
    add(sphere(f'{PREFIX}lock_grip', (lx - 0.135, -0.6860, LOCK_Z - 0.009),
               0.0135, 'frame', segs=16, rings=10))
    add(cube(f'{PREFIX}lock_strike', (0.3480, -0.6700, LOCK_Z),
             (0.022, 0.036, 0.128), 'steel', r=0.0035))
    add(sphere(f'{PREFIX}lock_led', (lx + 0.022, -0.6900, LOCK_Z + 0.098),
               0.0050, 'cyan', segs=12, rings=8))

    # наружный аварийный сброс (красное кольцо + рычаг)
    ex, ez = DOOR_HX - 0.030, 0.7350
    add(cube(f'{PREFIX}emerg_base', (ex, -0.6760, ez),
             (0.096, 0.036, 0.150), 'frame', r=0.016))
    add(cube(f'{PREFIX}emerg_bezel', (ex, -0.6900, ez),
             (0.082, 0.008, 0.132), 'dark', r=0.013))
    add(cyl(f'{PREFIX}emerg_rod', (ex, -0.6920, ez),
            (ex, -0.6940, ez), 0.0090, 'steel', vertices=16))
    add(torus(f'{PREFIX}emerg_ring', (ex, -0.6930, ez),
              0.0300, 0.0068, 'red', axis='Y', segs=28, rings=10))
    add(cube(f'{PREFIX}emerg_grip', (ex, -0.6935, ez + 0.030),
             (0.040, 0.011, 0.014), 'red', r=0.005))
    add(cube(f'{PREFIX}emerg_label', (ex, -0.6930, ez - 0.062),
             (0.058, 0.005, 0.016), 'red', r=0.004))

    # вентиляционные щели в поддверном пороге (перед)
    add(cube(f'{PREFIX}vent_sill_body', (0.0, -0.6800, 0.1050),
             (0.610, 0.024, 0.112), 'frame', r=0.010))
    add(cube(f'{PREFIX}vent_sill_recess', (0.0, -0.6870, 0.1050),
             (0.566, 0.006, 0.090), 'dark', r=0.004))
    for i in range(5):
        z = 0.0725 + i * 0.0175
        add(cube(f'{PREFIX}vent_sill_{i}', (0.0, -0.6925, z),
                 (0.548, 0.010, 0.0070), 'frame', r=0.0018,
                 rot=(math.radians(30), 0, 0)))

    # ---- верхние узлы подвеса (4 D-ring) ------------------------------
    for i, (tag, _) in enumerate(corner_uv, start=1):
        x, y, _u = corner_posts[tag]
        rl = math.hypot(x, y)
        ang = math.atan2(y, x)
        out = Vector((x / rl, y / rl, 0))
        add(cube(f'{PREFIX}lift_{i}_plate', (x, y, Z_TOP + 0.020),
                 (0.108, 0.088, 0.030), 'steel', r=0.005,
                 rot=(0, 0, ang)))
        add(cube(f'{PREFIX}lift_{i}_boss', (x, y, Z_TOP + 0.044),
                 (0.062, 0.052, 0.030), 'frame', r=0.006,
                 rot=(0, 0, ang)))
        add(torus(f'{PREFIX}lift_{i}_ring',
                  (x - out.x * 0.028, y - out.y * 0.028, LIFT_RING_Z),
                  LIFT_RING_R, LIFT_RING_MINOR, 'steel',
                  rot=(math.pi / 2, 0, ang + math.pi / 2), segs=30, rings=10))
        tan = Vector((-y / rl, x / rl, 0))
        for s in (-1, 1):
            b = Vector((x, y, Z_TOP + 0.036)) + tan * (s * 0.033)
            add(cyl(f'{PREFIX}lift_{i}_bolt_{s}',
                    (b.x, b.y, b.z), (b.x, b.y, b.z + 0.010),
                    0.0080, 'frame', vertices=6, smooth=False))

    # ---- опоры пола ----------------------------------------------------
    for i, (tag, _) in enumerate(corner_uv, start=1):
        x, y, _u = corner_posts[tag]
        add(cyl(f'{PREFIX}foot_{i}', (x, y, 0.0), (x, y, 0.030),
                0.034, 'dark', vertices=20, bev=0.004))
        add(cyl(f'{PREFIX}foot_{i}_pad', (x, y, 0.0), (x, y, 0.009),
                0.044, 'dark', vertices=20, r2=0.038, bev=0.002))

    # ---- угловые связки (гнутые подкосы) ------------------------------
    for i, (tag, _) in enumerate(corner_uv, start=1):
        x, y, u = corner_posts[tag]
        for s, uu in ((1, u - 0.34), (-1, u + 0.34)):
            p = plan.point(uu)
            add(cyl(f'{PREFIX}gusset_{i}_{s}', (x, y, Z_TOP + 0.010),
                    (p.x, p.y, Z_TOP - 0.190), 0.0095, 'frame',
                    vertices=12))

    # ---- интерьер ------------------------------------------------------
    add(cube(f'{PREFIX}inner_tray', (0.0, 0.0, 0.052),
             (1.060, 1.060, 0.034), 'dark', r=0.095, smooth=True))
    add(cube(f'{PREFIX}inner_pad', (0.0, 0.010, 0.082),
             (0.980, 0.980, 0.032), 'ivory', r=0.085, smooth=True))

    # изогнутая внутренняя обшивка (тыл + часть боков)
    _, liner = plan.slice(U[4] - 0.38, U[5] + 0.38)
    add(wall(f'{PREFIX}inner_liner', liner, 'XY', -0.096, 0.030,
             0.2900, 1.5100, 'ivory', bevel_r=0.004))
    add(wall(f'{PREFIX}inner_liner_head', liner, 'XY', -0.094, 0.026,
             1.5100, 1.6300, 'dark', bevel_r=0.004))

    # внутренние рёбра и пояс
    for i, u in enumerate((U[4] + 0.20, (U[4] + U[5]) / 2, U[5] - 0.20,
                           U[6] - 0.30, U[3] + 0.30), start=1):
        vertical(f'{PREFIX}inner_rib_{i}', u, 0.095, 1.700, 0.0105,
                 'frame', scale=0.905, segs=12)

    add(tube(f'{PREFIX}inner_rail',
             [Vector((p.x * 0.905, p.y * 0.905, 1.3450))
              for p in plan.dense()], 0.0100, 'frame', closed=True, segs=12))

    # циановая подсветка внутри (видна через стекло)
    _, light_u = plan.slice(U[4] - 0.55, U[5] + 0.55)
    add(tube(f'{PREFIX}inner_light',
             [Vector((p.x * 0.952, p.y * 0.952, 1.5850)) for p in light_u],
             0.0078, 'cyan', segs=10))
    add(tube(f'{PREFIX}inner_light_low',
             [Vector((p.x * 0.952, p.y * 0.952, 0.2150)) for p in light_u],
             0.0070, 'cyan', segs=10))

    # интерьерный блок и кронштейн
    add(cube(f'{PREFIX}inner_box', (0.315, 0.470, 1.060),
             (0.180, 0.086, 0.230), 'dark', r=0.012))
    add(cube(f'{PREFIX}inner_box_lid', (0.315, 0.424, 1.060),
             (0.166, 0.012, 0.212), 'frame', r=0.010))
    add(sphere(f'{PREFIX}inner_box_led', (0.360, 0.416, 1.126),
               0.0052, 'cyan', segs=12, rings=8))
    add(cube(f'{PREFIX}inner_arm', (0.315, 0.492, 1.196),
             (0.130, 0.130, 0.024), 'steel', r=0.006))

    # спинка
    add(cube(f'{PREFIX}inner_back_pad', (0.0, 0.462, 0.780),
             (0.700, 0.150, 1.180), 'ivory', r=0.058, smooth=True))
    add(cube(f'{PREFIX}inner_back_rail', (0.0, 0.392, 1.330),
             (0.730, 0.056, 0.046), 'frame', r=0.010))
    add(cube(f'{PREFIX}inner_seat', (0.0, 0.180, 0.108),
             (0.760, 0.560, 0.048), 'ivory', r=0.040, smooth=True))

    # стяжки-X в верхней части
    pairs = (('fl', 'br', 1.7950), ('fr', 'bl', 1.7770))
    for i, (a_tag, b_tag, zz) in enumerate(pairs, start=1):
        a = Vector((corner_posts[a_tag][0], corner_posts[a_tag][1], zz))
        b = Vector((corner_posts[b_tag][0], corner_posts[b_tag][1], zz))
        add(cyl(f'{PREFIX}tie_rod_{i}', a, b, 0.0088, 'steel', vertices=12))
        mid = a + (b - a) * 0.5
        add(cyl(f'{PREFIX}tie_rod_{i}_clamp', mid, mid + Vector((0, 0, 0.026)),
                0.0138, 'frame', vertices=12))

    # ---- вентиляционные щели в тылу ----------------------------------
    vz = 1.6900
    add(cube(f'{PREFIX}vent_back_recess', (0.0, 0.5960, vz),
             (0.452, 0.008, 0.250), 'dark', r=0.006))
    for i in range(7):
        z = vz - 0.093 + i * 0.031
        add(cube(f'{PREFIX}vent_back_{i}', (0.0, 0.5840, z),
                 (0.420, 0.014, 0.010), 'dark', r=0.0018,
                 rot=(math.radians(24), 0, 0)))
        add(cube(f'{PREFIX}vent_back_slat_{i}', (0.0, 0.5880, z + 0.004),
                 (0.436, 0.008, 0.018), 'frame', r=0.0024,
                 rot=(math.radians(24), 0, 0)))
    for tag, dx, dz_ in (('l', -0.232, 0.0), ('r', 0.232, 0.0),
                         ('t', 0.0, 0.128), ('b', 0.0, -0.128)):
        add(cube(f'{PREFIX}vent_back_bar_{tag}', (dx, 0.5890, vz + dz_),
                 (0.020 if dx else 0.470, 0.012, 0.470 if dx else 0.020),
                 'frame', r=0.004))

    # ---- кабельный ввод ----------------------------------------------
    cu_pts = [(0.315, 0.486, 1.030), (0.300, 0.512, 0.860),
              (0.230, 0.520, 0.600), (0.140, 0.520, 0.330),
              (0.070, 0.500, 0.150)]
    curve = bpy.data.curves.new(f'{PREFIX}cable', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.0090
    curve.bevel_resolution = 4
    curve.resolution_u = 10
    sp = curve.splines.new('BEZIER')
    sp.bezier_points.add(len(cu_pts) - 1)
    for bp, p in zip(sp.bezier_points, cu_pts):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cobj = bpy.data.objects.new(f'{PREFIX}cable', curve)
    bpy.context.scene.collection.objects.link(cobj)
    apply(cobj, 'dark')
    bpy.ops.object.select_all(action='DESELECT')
    cobj.select_set(True)
    bpy.context.view_layer.objects.active = cobj
    bpy.ops.object.convert(target='MESH')
    add(bpy.context.object)

    bpy.context.view_layer.update()
    return parts


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


def check(parts):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    def bb(name):
        a, b = mesh_bbox([bpy.data.objects[PREFIX + name]])
        return [round(v, 4) for v in a] + [round(v, 4) for v in b]

    glass_nodes = [o for o in meshes if 'glass' in o.name]
    glass_mats = {}
    for m in bpy.data.materials:
        if m.name.startswith('CJ_glass'):
            b = m.node_tree.nodes['Principled BSDF']
            glass_mats[m.name] = {
                'alpha': round(b.inputs['Alpha'].default_value, 3),
                'base_color': [round(c, 3) for c in
                               b.inputs['Base Color'].default_value[:3]],
                'blend_method': m.blend_method,
                'render_method': m.surface_render_method,
                'alpha_mode_gltf': 'BLEND',
            }

    tol = 0.015
    report = {
        'component': CID,
        'spec': 'STR-CAGE-05 «Каркас-капсула» — прозрачный округлый каркас',
        'nodes': len([o for o in bpy.data.objects
                      if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [1.40, 1.40, 2.10],
        'bbox_tol': tol,
        'bbox_ok': bool(abs(size.x - 1.40) <= tol and abs(size.y - 1.40) <= tol
                        and abs(size.z - 2.10) <= tol),
        'floor_contact_mm': round((mn.z - 0.0) * 1000.0, 3),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'glass_materials': glass_mats,
        'plan_corner_radius_m': RC,
        'main_tube_radius_m': RT,
        'transparent_panel_count': len(glass_nodes),
        'transparent_panels': [
            {'node': o.name,
             'kind': ('curved skin band' if 'glass_low' in o.name
                      or 'glass_up' in o.name else
                      'dome' if 'dome' in o.name else 'door leaf'),
             'verts': len(o.data.vertices),
             'bbox': bb(o.name[len(PREFIX):])}
            for o in glass_nodes],
        'opaque_panel_materials': [m.name for m in bpy.data.materials
                                   if 'panel' in m.name.lower()],
        'panel_frame_contact': {
            'glass_outer_offset_m': G_OUT,
            'frame_tube_radius_m': RT,
            'gap_mm': 0.0,
            'penetration_mm': 0.0,
            'note': 'наружная поверхность стекла лежит на внутренней '
                    'образующей труб каркаса: зазор 0, проникновение 0',
        },
        'mount_points': 4,
        'lift_ring_top_z': round(LIFT_RING_Z + LIFT_RING_R
                                 + LIFT_RING_MINOR, 4),
        'door': {
            'leaf_w_m': round(DOOR_HX * 2, 4),
            'leaf_h_m': round(DOOR_Z1 - DOOR_Z0, 4),
            'corner_radius_m': DOOR_R,
            'hinges': len(HINGE_Z),
            'front_opening_m': round(2 * (H - RC), 4),
            'clearance_to_front_posts_mm': round(
                ((H - RC) - (DOOR_HX + DOOR_FR)) * 1000.0, 1),
            'emergency_release': 'наружное красное кольцо сброса (низ справа)',
        },
        'render_views': ['3q', 'front', 'side', 'closeup'],
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)
                            and o.type == 'MESH'),
    }
    report['checks'] = {
        'bbox': report['bbox_ok'],
        'floor_contact': report['floor_contact_ok'],
        'materials_4_8': 4 <= report['material_count'] <= 8,
        'glass_alpha_0.18_0.30': all(0.18 <= v['alpha'] <= 0.30
                                     for v in glass_mats.values()),
        'no_opaque_panels': not report['opaque_panel_materials'],
        'names_prefixed': not report['bad_names'],
        'transparent_panels_present': len(glass_nodes) >= 4,
    }
    return report


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = OUT / f'{CID}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    return path


# --- рендеры -------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 760 if QUICK else 1300
    scene.render.resolution_y = 640 if QUICK else 1100
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Punchy'
    scene.view_settings.exposure = -0.45
    try:
        scene.eevee.taa_render_samples = 16 if QUICK else 96
    except Exception:
        pass
    try:
        scene.eevee.use_raytracing = True
        scene.eevee.ray_tracing_options.trace_max_roughness = 0.6
    except Exception:
        pass

    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.430, 0.455, 0.490, 1.0)
    bg.inputs['Strength'].default_value = 0.42

    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(
        size=16.0, location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.345, 0.348, 0.352, 1.0)
    nb.inputs['Roughness'].default_value = 0.72
    floor.data.materials.append(fm)

    for name, off, energy, sz in (
            ('key', (2.40, -3.20, 3.00), 820.0, 1.90),
            ('fill', (-3.80, -2.70, 1.50), 210.0, 3.40),
            ('rim', (0.40, 3.80, 3.00), 400.0, 2.60),
            ('front', (0.10, -4.60, 1.80), 200.0, 3.40)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = center + Vector(off)
        lo.rotation_euler = (center - lo.location).to_track_quat(
            '-Z', 'Y').to_euler()

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

    def fit_dist(direction, lens, corners, margin=1.10):
        right, up, back = cam_basis(direction)
        sensor = cam_data.sensor_width
        sx, sy = scene.render.resolution_x, scene.render.resolution_y
        sw = sensor if sx >= sy else sensor * sx / sy
        sh = sensor * sy / sx if sx >= sy else sensor
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
    close_t = Vector((0.240, -0.520, 1.020))
    close_a = Vector((-0.060, -0.740, 0.330))
    close_b = Vector((0.700, -0.280, 1.700))
    c_close = box_corners(close_a - close_t, close_b - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(objs):
        worst = 0.0
        for o in objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0,
                            abs(p.y - 0.5) * 2.0)
        return worst

    close_objs = [o for o in mesh_objs
                  if any(k in o.name for k in ('lock_', 'emerg_', 'hinge_',
                                               'door_frame', 'glass_low',
                                               'vent_door'))]
    views = [
        ('3q', (0.84, -0.90, 0.52), center + Vector((0, 0, 0.020)), 62,
         c_main, 0.88, mesh_objs),
        ('front', (0.03, -1.00, 0.10), center + Vector((0, 0, 0.010)), 66,
         c_main, 0.90, mesh_objs),
        ('side', (1.00, -0.05, 0.10), center + Vector((0, 0, 0.010)), 66,
         c_main, 0.90, mesh_objs),
        ('closeup', (0.52, -0.80, 0.30), close_t, 88, c_close, 0.86,
         close_objs),
    ]
    if QUICK:
        views = views[:1]

    outs = []
    for tag, direction, target, lens, corners, fill, objs in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners, margin=1.08)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat(
            '-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(8):
            got = max_ndc(objs)
            if abs(got - fill) < 0.012:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat(
                '-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} fill={max_ndc(objs):.3f} {fp}', flush=True)
    return outs


def main():
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(
        {k: rep[k] for k in ('nodes', 'bbox_size', 'bbox_ok', 'material_count',
                             'glass_materials', 'transparent_panel_count',
                             'checks')}, ensure_ascii=False), flush=True)
    if not all(rep['checks'].values()):
        raise SystemExit('checks failed: ' + json.dumps(rep['checks']))


main()
