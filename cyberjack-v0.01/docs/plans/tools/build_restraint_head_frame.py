"""Standalone builder: restraint_head_frame (RST-HD-06, «Рама головы»).

Открытая регулируемая рамка головы: молочная затылочная плита с мягкой
подушкой, два прямых боковых луча к вискам, боковые прижимы-тарелки с
барашками, две щёчные рейки вниз к мягкой чашке подбородка, поднятая
надбровная дуга с подушкой лба, шарниры наклона с ограничителями,
быстросъёмные замки, мягкие стяжки с пряжками и D-образное кольцо.
Плиты-основания нет: рамка стоит на чашке подбородка.

Лицо открыто: между надбровной подушкой и чашкой подбородка остаётся
окно ~105 x 78 мм, спереди проходят только две тонкие щёчные рейки.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_head_frame.py

Выход:
  public/models/machine-modules/components/restraint_head_frame.glb
  docs/plans/blockout/component-library/restraint_head_frame/*.png + report.json

Геометрия (Blender Z-up, метры), ось головы = Z в точке (CX, CY):
  фронт (лицо) = +Y, затылок = -Y, левый борт = -X, правый = +X
  z=0 — низ чашки подбородка (рамка стоит на ней)
  вращения нет (motion: none), анимационная пустышка не нужна.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_head_frame'
CID = 'restraint_head_frame'
PREFIX = CID + '__'

A = math.radians

# --- ключевые размеры (м) ------------------------------------------------
CX, CY = 0.0, -0.004          # ось головы в плане

# затылочная плита (только задняя дуга 140 градусов)
R_P_IN, R_P_OUT, R_P_MID = 0.096, 0.112, 0.104
Z_P0, Z_P1, Z_P2, Z_P3 = 0.066, 0.082, 0.114, 0.130
PLATE_A0, PLATE_A1 = 200.0, 340.0

# мягкая подушка затылка
PAD_OCC_R = (0.0855, 0.0975)
PAD_OCC_Z = (0.0725, 0.1235)
PAD_OCC_A = (222.0, 318.0)

# прямые боковые лучи к вискам
ARM_BACK = (0.0977, -0.0396, 0.0985)
ARM_FRONT = (0.0855, 0.0560, 0.1060)

# прижим к виску (по оси X)
EAR_PAD_R = 0.0185
EAR_HOUSING_R = 0.0160
EAR_KNOB_R = 0.0094
EAR_X_IN, EAR_X_OUT = 0.0790, 0.1440

# надбровная дуга
BROW_CAR_R = (0.0900, 0.1000)
BROW_PAD_R = (0.0740, 0.0915)
BROW_Z = (0.1260, 0.1400)
BROW_A = (54.0, 126.0)

# чашка подбородка
CHIN_R = (0.062, 0.080)
CHIN_Z = (0.010, 0.036)
CHIN_A = (45.0, 135.0)

# шарнир наклона на щёчной рейке
HINGE_P = (0.0850, 0.0330, 0.0680)

PALETTE = {
    'graphite': (0.082, 0.086, 0.096),
    'milk': (0.880, 0.866, 0.836),
    'blush': (0.870, 0.560, 0.600),
    'silicone': (0.912, 0.700, 0.716),
    'steel': (0.600, 0.610, 0.625),
    'dark': (0.028, 0.030, 0.036),
    'cream': (0.940, 0.925, 0.888),
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
    if role == 'steel':
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.28
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.35
        bsdf.inputs['Roughness'].default_value = 0.42
    elif role == 'blush':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.46
    elif role == 'silicone':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.55
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.70
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.80
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
        mod.angle_limit = math.radians(35)
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


def mesh_from_bm(name, bm, role, smooth=True, bevel_w=0.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, smooth)
    if bevel_w > 0:
        bevel(obj, bevel_w, 2)
    return obj


def cyl(name, a, b, radius, role, vertices=24, smooth=True, r2=None, bev=0.0):
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


def torus(name, loc, major, minor, role, axis='X', segs=32, rings=10):
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


def box_axis(name, center, u, v, w, su, sv, sw, role, bevel_w=0.0008,
             smooth=False):
    c = Vector(center)
    u, v, w = (Vector(x).normalized() for x in (u, v, w))
    bm = bmesh.new()
    vs = []
    for k in (0, 1):
        for j in (0, 1):
            for i in (0, 1):
                vs.append(bm.verts.new(c
                                       + u * (su * (i - 0.5))
                                       + v * (sv * (j - 0.5))
                                       + w * (sw * (k - 0.5))))
    # индекс = i + 2*j + 4*k
    for f in ((0, 2, 3, 1), (4, 5, 7, 6), (0, 1, 5, 4),
              (1, 3, 7, 5), (3, 2, 6, 7), (2, 0, 4, 6)):
        bm.faces.new([vs[i] for i in f])
    return mesh_from_bm(name, bm, role, smooth, bevel_w)


def beam(name, p0, p1, wdir, sw, st, role, bevel_w=0.0008, smooth=False):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    d.normalize()
    w = Vector(wdir)
    w = w - d * w.dot(d)
    if w.length < 1e-6:
        w = Vector((1, 0, 0)) if abs(d.x) < 0.9 else Vector((0, 1, 0))
        w = w - d * w.dot(d)
    w.normalize()
    t = w.cross(d).normalized()
    bm = bmesh.new()
    vs = []
    for p in (p0, p1):
        for b in (-1, 1):
            for a in (-1, 1):
                vs.append(bm.verts.new(p + w * (a * sw * 0.5)
                                       + t * (b * st * 0.5)))
    for f in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 2, 6, 4),
              (1, 5, 7, 3), (0, 4, 5, 1), (2, 3, 7, 6)):
        bm.faces.new([vs[i] for i in f])
    return mesh_from_bm(name, bm, role, smooth, bevel_w)


# --- геометрия вокруг вертикальной оси головы ----------------------------
def ring_sector(name, r_in, r_out, z0, z1, a0, a1, seg, role, bevel_w=0.0,
                smooth=True):
    """Сектор кольца вокруг Z в точке (CX, CY). a0/a1 в градусах."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = A(a0 + (a1 - a0) * i / seg)
        dx, dy = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((CX + dx * r, CY + dy * r, z))
                      for r, z in ((r_in, z0), (r_out, z0),
                                   (r_out, z1), (r_in, z1))])
    for i in range(seg):
        p, q = rings[i], rings[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((p[k], p[k2], q[k2], q[k]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    return mesh_from_bm(name, bm, role, smooth, bevel_w)


def ring_tube(bm, rc, z, rt, a0, a1, seg_a=32, seg_c=8, taper=0.0):
    """Труба по дуге вокруг Z (валики подушек, мягкие кромки, строчка)."""
    rings = []
    for i in range(seg_a + 1):
        u = i / seg_a
        a = A(a0 + (a1 - a0) * u)
        rr = rt * (1.0 - taper * (1.0 - math.sin(math.pi * u)))
        dx, dy = math.cos(a), math.sin(a)
        c = Vector((CX + dx * rc, CY + dy * rc, z))
        e1 = Vector((dx, dy, 0.0))
        rings.append([bm.verts.new(c + e1 * (rr * math.cos(math.tau * k / seg_c))
                                   + Vector((0, 0, rr * math.sin(math.tau * k / seg_c))))
                      for k in range(seg_c)])
    for i in range(seg_a):
        p, q = rings[i], rings[i + 1]
        for k in range(seg_c):
            k2 = (k + 1) % seg_c
            bm.faces.new((p[k], p[k2], q[k2], q[k]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))


def sector_x(name, x0, x1, r_in, r_out, a0, a1, seg, role, cy, cz,
             bevel_w=0.0):
    """Сектор кольца вокруг оси X (ограничитель шарнира)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = A(a0 + (a1 - a0) * i / seg)
        yy, zz = math.cos(a), math.sin(a)
        rings.append([bm.verts.new((x, cy + yy * r, cz + zz * r))
                      for x, r in ((x0, r_in), (x0, r_out),
                                   (x1, r_out), (x1, r_in))])
    for i in range(seg):
        p, q = rings[i], rings[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((p[k], p[k2], q[k2], q[k]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    return mesh_from_bm(name, bm, role, True, bevel_w)


def radial(a_deg):
    a = A(a_deg)
    return Vector((math.cos(a), math.sin(a), 0.0))


def at_ring(a_deg, r, z):
    d = radial(a_deg)
    return Vector((CX + d.x * r, CY + d.y * r, z))


def ribbon(name, pts, width, thick, role, bevel_w=0.0006):
    """Плоская мягкая стяжка: ширина по касательной к голове, толщина по радиусу."""
    pts = [Vector(p) for p in pts]
    n = len(pts)
    rings = []
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)])
        if t.length < 1e-9:
            t = Vector((0, 0, 1))
        t.normalize()
        rad = Vector((p.x - CX, p.y - CY, 0.0))
        if rad.length < 1e-6:
            rad = Vector((0, 1, 0))
        rad.normalize()
        w = t.cross(rad)
        if w.length < 1e-6:
            w = t.cross(Vector((0, 0, 1)))
        w.normalize()
        nrm = w.cross(t).normalized()
        rings.append([p + w * (a * width * 0.5) + nrm * (b * thick * 0.5)
                      for a, b in ((-1, -1), (1, -1), (1, 1), (-1, 1))])
    bm = bmesh.new()
    vr = [[bm.verts.new(v) for v in ring] for ring in rings]
    for i in range(n - 1):
        p, q = vr[i], vr[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((p[k], p[k2], q[k2], q[k]))
    bm.faces.new(vr[0])
    bm.faces.new(tuple(reversed(vr[-1])))
    return mesh_from_bm(name, bm, role, False, bevel_w)


def tube_path(name, pts, normal, rt, role, seg=12, smooth=True):
    """Труба по замкнутому плоскому контуру (D-кольцо)."""
    N = Vector(normal).normalized()
    pts = [Vector(p) for p in pts]
    n = len(pts)
    bm = bmesh.new()
    rings = []
    for i in range(n):
        t = pts[(i + 1) % n] - pts[(i - 1) % n]
        if t.length < 1e-9:
            t = Vector((1.0, 0.0, 0.0))
        t.normalize()
        n1 = t.cross(N)
        if n1.length < 1e-6:
            n1 = t.cross(Vector((0.0, 0.0, 1.0)))
        n1.normalize()
        n2 = n1.cross(t).normalized()
        rings.append([bm.verts.new(pts[i] + n1 * (rt * math.cos(math.tau * k / seg))
                                   + n2 * (rt * math.sin(math.tau * k / seg)))
                      for k in range(seg)])
    for i in range(n):
        p, q = rings[i], rings[(i + 1) % n]
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((p[k], p[k2], q[k2], q[k]))
    return mesh_from_bm(name, bm, role, smooth)


def rect_ring(name, center, u, v, w, su, sv, bar, thick, role, bevel_w=0.0006):
    """Прямоугольная рамка-петля: u,v — плоскость окна, w — толщина."""
    center = Vector(center)
    u, v, w = (Vector(x).normalized() for x in (u, v, w))
    bm = bmesh.new()
    lo, hi = [], []
    for sgn, store in ((-0.5, lo), (0.5, hi)):
        for layer in (0, 1):
            su2 = su * 0.5 if layer == 0 else su * 0.5 - bar
            sv2 = sv * 0.5 if layer == 0 else sv * 0.5 - bar
            quad = []
            for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
                quad.append(bm.verts.new(center + u * (sx * su2)
                                         + v * (sy * sv2)
                                         + w * (sgn * thick)))
            store.append(quad)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((lo[0][i], lo[0][j], lo[1][j], lo[1][i]))
        bm.faces.new((lo[0][i], hi[0][i], hi[0][j], lo[0][j]))
        bm.faces.new((lo[1][i], lo[1][j], hi[1][j], hi[1][i]))
        bm.faces.new((hi[0][i], hi[0][j], hi[1][j], hi[1][i]))
    return mesh_from_bm(name, bm, role, False, bevel_w)


# --- сборка --------------------------------------------------------------
def offset_radial(p, dr):
    """Сдвиг точки по радиусу от оси головы (накладки на рейки)."""
    p = Vector(p)
    r = Vector((p.x - CX, p.y - CY, 0.0))
    if r.length < 1e-9:
        return p
    return p + r.normalized() * dr


def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ================= затылочная плита =================================
    add(ring_sector(PREFIX + 'plate_rim_lo', R_P_IN, R_P_OUT, Z_P0, Z_P1,
                    PLATE_A0, PLATE_A1, 32, 'milk', bevel_w=0.0018))
    add(ring_sector(PREFIX + 'plate_rim_hi', R_P_IN, R_P_OUT, Z_P2, Z_P3,
                    PLATE_A0, PLATE_A1, 32, 'milk', bevel_w=0.0018))
    add(ring_sector(PREFIX + 'plate_core', 0.1035, 0.1095, Z_P1, Z_P2,
                    PLATE_A0, PLATE_A1, 32, 'graphite', bevel_w=0.0008))
    # рёбра-стойки через канавку: плита читается как композитная рама
    for deg in (212.0, 240.0, 270.0, 300.0, 328.0):
        d = radial(deg)
        add(box_axis(PREFIX + f'plate_rib_{int(deg):03d}',
                     (CX + d.x * 0.1042, CY + d.y * 0.1042, 0.098),
                     d, Vector((-d.y, d.x, 0.0)), (0, 0, 1),
                     0.0155, 0.0080, 0.064, 'milk', bevel_w=0.0009))
    # мягкая подушка затылка
    add(ring_sector(PREFIX + 'pad_occiput', PAD_OCC_R[0], PAD_OCC_R[1],
                    PAD_OCC_Z[0], PAD_OCC_Z[1], PAD_OCC_A[0], PAD_OCC_A[1],
                    26, 'silicone', bevel_w=0.0045))
    bm = bmesh.new()
    for z in (0.0800, 0.0980, 0.1160):
        ring_tube(bm, 0.0858, z, 0.0023, 226.0, 314.0, 30, 8)
    for z in (0.0745, 0.1215):
        ring_tube(bm, 0.0870, z, 0.0028, 223.0, 317.0, 34, 8, taper=0.35)
    add(mesh_from_bm(PREFIX + 'pad_occiput_rolls', bm, 'blush'))
    # стяжка по наружной стороне плиты + пряжка
    add(ring_sector(PREFIX + 'plate_strap', 0.1120, 0.1152, 0.0700, 0.1260,
                    262.0, 278.0, 8, 'graphite', bevel_w=0.0006))
    add(box_axis(PREFIX + 'plate_buckle',
                 (CX, CY - 0.1148, 0.0980), (0, -1, 0), (1, 0, 0), (0, 0, 1),
                 0.0045, 0.0190, 0.0140, 'steel', bevel_w=0.0008))

    # ================= боковые лучи =====================================
    for tag, sx in (('l', -1.0), ('r', 1.0)):
        p0 = (sx * ARM_BACK[0], ARM_BACK[1], ARM_BACK[2])
        p1 = (sx * ARM_FRONT[0], ARM_FRONT[1], ARM_FRONT[2])
        add(beam(PREFIX + f'arm_{tag}', p0, p1, (0, 0, 1), 0.0205, 0.0110,
                 'milk', bevel_w=0.0012))
        add(beam(PREFIX + f'arm_spine_{tag}',
                 (sx * (ARM_BACK[0] + 0.0042), ARM_BACK[1] + 0.006,
                  ARM_BACK[2] - 0.0025),
                 (sx * (ARM_FRONT[0] + 0.0042), ARM_FRONT[1] - 0.006,
                  ARM_FRONT[2] - 0.0025),
                 (0, 0, 1), 0.0090, 0.0040, 'graphite', bevel_w=0.0006))

        # узел-тройник на переднем конце луча (луч + лоб + щека)
        add(box_axis(PREFIX + f'node_{tag}',
                     (sx * 0.0855, 0.0545, 0.1050), (1, 0, 0), (0, 1, 0),
                     (0, 0, 1), 0.0175, 0.0250, 0.0300, 'milk',
                     bevel_w=0.0035))
        add(box_axis(PREFIX + f'node_cap_{tag}',
                     (sx * 0.0955, 0.0545, 0.1050), (1, 0, 0), (0, 1, 0),
                     (0, 0, 1), 0.0040, 0.0190, 0.0230, 'graphite',
                     bevel_w=0.0010))
        add(cyl(PREFIX + f'node_pin_{tag}', (sx * 0.0855, 0.0400, 0.1050),
                (sx * 0.0855, 0.0695, 0.1050), 0.0042, 'steel', vertices=16))

        # прижим к виску: мягкая тарелка, корпус, шпиндель, барашек
        add(cyl(PREFIX + f'ear_pad_{tag}', (sx * EAR_X_IN, CY, 0.1000),
                (sx * 0.0885, CY, 0.1000), EAR_PAD_R, 'silicone',
                vertices=28, bev=0.0032))
        add(cyl(PREFIX + f'ear_housing_{tag}', (sx * 0.0980, CY, 0.1000),
                (sx * 0.1140, CY, 0.1000), EAR_HOUSING_R, 'graphite',
                vertices=24, bev=0.0018))
        add(cyl(PREFIX + f'ear_knob_{tag}', (sx * 0.1140, CY, 0.1000),
                (sx * 0.1390, CY, 0.1000), 0.0106, 'steel',
                vertices=32, bev=0.0012))
        for kk in range(8):
            a = math.tau * kk / 8.0
            add(cyl(PREFIX + f'ear_knurl_{tag}{kk}',
                    (sx * 0.1148, CY + 0.0104 * math.cos(a),
                     0.1000 + 0.0104 * math.sin(a)),
                    (sx * 0.1382, CY + 0.0104 * math.cos(a),
                     0.1000 + 0.0104 * math.sin(a)),
                    0.0013, 'graphite', vertices=8))
        add(cyl(PREFIX + f'ear_knob_cap_{tag}', (sx * 0.1390, CY, 0.1000),
                (sx * EAR_X_OUT, CY, 0.1000), 0.0078, 'graphite',
                vertices=24, bev=0.0008))

        # щёчная рейка вниз к чашке подбородка
        path = [(sx * 0.0855, 0.0560, 0.0985),
                (sx * 0.0850, 0.0330, 0.0680),
                (sx * 0.0720, 0.0330, 0.0430),
                (sx * 0.0502, 0.0420, 0.0265)]
        add(ribbon(PREFIX + f'cheek_rail_{tag}', path, 0.0220, 0.0092,
                   'milk', bevel_w=0.0012))
        strap = [offset_radial(pp, 0.0062) for pp in path]
        add(ribbon(PREFIX + f'cheek_strap_{tag}', strap, 0.0130, 0.0028,
                   'graphite'))
        add(box_axis(PREFIX + f'cheek_buckle_{tag}',
                     (sx * 0.0900, 0.0328, 0.0690), (1, 0, 0), (0, 1, 0),
                     (0, 0, 1), 0.0060, 0.0195, 0.0200, 'steel',
                     bevel_w=0.0010))

        # шарнир наклона с ограничителем
        hx, hy, hz = sx * HINGE_P[0], HINGE_P[1], HINGE_P[2]
        add(cyl(PREFIX + f'cheek_hinge_pin_{tag}', (hx - 0.0125, hy, hz),
                (hx + 0.0125, hy, hz), 0.0042, 'steel', vertices=18))
        add(box_axis(PREFIX + f'cheek_limiter_{tag}',
                     (sx * 0.0858, hy - 0.0195, hz - 0.0130),
                     (0.36, -0.93, 0.0), (0.93, 0.36, 0.0), (0, 0, 1),
                     0.0210, 0.0090, 0.0095, 'graphite', bevel_w=0.0008))

        # быстросъёмный замок у чашки подбородка
        ch = at_ring(CHIN_A[0] if sx > 0 else 135.0, 0.0710, 0.0280)
        add(box_axis(PREFIX + f'chin_latch_{tag}', ch, (1, 0, 0), (0, 1, 0),
                     (0, 0, 1), 0.0170, 0.0165, 0.0190, 'graphite',
                     bevel_w=0.0022))
        add(cyl(PREFIX + f'chin_latch_pin_{tag}',
                (ch.x - 0.0110, ch.y, ch.z), (ch.x + 0.0110, ch.y, ch.z),
                0.0032, 'steel', vertices=14))

        # замок-кулачок на надбровной тяге у тройника
        add(cyl(PREFIX + f'brow_hinge_pin_{tag}',
                (sx * 0.0855, 0.0490, 0.1205), (sx * 0.0855, 0.0630, 0.1205),
                0.0038, 'steel', vertices=16))

    # ================= надбровная дуга ==================================
    add(ring_sector(PREFIX + 'brow_carrier', BROW_CAR_R[0], BROW_CAR_R[1],
                    BROW_Z[0], BROW_Z[1], BROW_A[0], BROW_A[1], 26, 'milk',
                    bevel_w=0.0018))
    add(ring_sector(PREFIX + 'pad_brow', BROW_PAD_R[0], BROW_PAD_R[1],
                    0.1160, 0.1500, 56.0, 124.0, 26, 'silicone',
                    bevel_w=0.0046))
    bm = bmesh.new()
    for z in (0.1225, 0.1330, 0.1435):
        ring_tube(bm, 0.0750, z, 0.0024, 60.0, 120.0, 24, 8)
    add(mesh_from_bm(PREFIX + 'pad_brow_rolls', bm, 'blush'))

    # тяга от тройника к надбровной дуге (регулировка наклона)
    for tag, sx in (('l', -1.0), ('r', 1.0)):
        add(beam(PREFIX + f'brow_link_{tag}',
                 (sx * 0.0855, 0.0560, 0.1150),
                 (sx * 0.0555, 0.0725, 0.1330), (0, 0, 1), 0.0150, 0.0100,
                 'milk', bevel_w=0.0010))

    # ================= чашка подбородка =================================
    add(ring_sector(PREFIX + 'chin_cup', CHIN_R[0], CHIN_R[1], CHIN_Z[0],
                    CHIN_Z[1], CHIN_A[0], CHIN_A[1], 24, 'silicone',
                    bevel_w=0.0046))
    add(ring_sector(PREFIX + 'chin_rim', 0.0600, 0.0822, 0.000, 0.0102,
                    CHIN_A[0] - 2.0, CHIN_A[1] + 2.0, 24, 'milk',
                    bevel_w=0.0016))
    add(ring_sector(PREFIX + 'chin_lip', 0.0755, 0.0820, CHIN_Z[1] - 0.002,
                    CHIN_Z[1] + 0.0115, CHIN_A[0], CHIN_A[1], 24, 'blush',
                    bevel_w=0.0018))
    add(ring_sector(PREFIX + 'chin_strap', 0.0822, 0.0850, 0.0180, 0.0285,
                    CHIN_A[0] + 14, CHIN_A[1] - 14, 18, 'graphite',
                    bevel_w=0.0006))
    add(box_axis(PREFIX + 'chin_buckle', (0.0, CY + 0.0858, 0.0230),
                 (0, 1, 0), (1, 0, 0), (0, 0, 1), 0.0055, 0.0165, 0.0135,
                 'steel', bevel_w=0.0008))
    bm = bmesh.new()
    ring_tube(bm, 0.0632, 0.0110, 0.0026, CHIN_A[0] + 3, CHIN_A[1] - 3, 22, 8,
              taper=0.35)
    add(mesh_from_bm(PREFIX + 'chin_cup_edge', bm, 'blush'))

    # ================= D-кольцо на петле ================================
    add(rect_ring(PREFIX + 'dring_tab', (0.0, CY - 0.1062, 0.1290),
                  (1, 0, 0), (0, 0, 1), (0, 1, 0), 0.024, 0.026, 0.0034,
                  0.0042, 'milk'))
    yc, zc = CY - 0.1062, 0.1275
    ry, rz = 0.0072, 0.0155
    pts = [(0.0, yc + ry * math.cos(math.pi * i / 12.0),
            zc + rz * math.sin(math.pi * i / 12.0)) for i in range(13)]
    for k in (0.75, 0.50, 0.25):
        pts.append((0.0, yc - ry + 2 * ry * k, zc))
    add(tube_path(PREFIX + 'dring', pts, (1, 0, 0), 0.0028, 'steel', seg=10))

    # ================= маркировка размера на правом луче ===============
    add(box_axis(PREFIX + 'size_plate', (0.0986, 0.0060, 0.1020),
                 (1, 0, 0), (0, 1, 0), (0, 0, 1),
                 0.0016, 0.0150, 0.0066, 'cream', bevel_w=0.0004))
    for k, dy in enumerate((-0.0042, 0.0, 0.0042)):
        add(box_axis(PREFIX + f'size_tick_{k}', (0.0982, 0.0060 + dy, 0.1020),
                     (1, 0, 0), (0, 1, 0), (0, 0, 1),
                     0.0014, 0.0016, 0.0044, 'dark', bevel_w=0.0002))

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
    mats = sorted(m.name for m in bpy.data.materials if m.name.startswith('CJ_'))
    bad = sorted(o.name for o in bpy.data.objects
                 if not o.name.startswith(PREFIX))

    # окно лица: между верхом чашки подбородка и низом надбровной подушки,
    # по ширине — между внутренними кромками щёчных реек
    win_w = 2 * 0.0500
    win_h = 0.1205 - 0.0475
    rep = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_parts': len(parts),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [0.30, 0.20, 0.15],
        'bbox_delta_pct': [round((size[i] / (0.30, 0.20, 0.15)[i] - 1) * 100, 1)
                           for i in range(3)],
        'bbox_ok': bool(size.x <= 0.315 and size.y <= 0.235 and size.z <= 0.175),
        'face_window_m': [round(win_w, 4), round(win_h, 4)],
        'floor_contact_z': round(mn.z, 5),
        'floor_contact_ok': bool(abs(mn.z) <= 0.002),
        'material_count': len(mats),
        'materials': mats,
        'motion': 'none',
        'plate': False,
        'bad_names': bad,
        'bbox_reach': sorted(
            ({'part': o.name.replace(PREFIX, ''),
              'y_max': round(max((o.matrix_world @ Vector(c)).y for c in o.bound_box), 4)}
             for o in meshes if o.name.startswith(PREFIX)),
            key=lambda d: -d['y_max'])[:5],
    }
    return rep


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objects:
        o['component'] = CID
        o['motion'] = 'none'
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').split('_')[0]
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
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.0
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.45

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=4,
                                     location=(center.x, center.y, mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.30, 0.34, 0.34), 1.75, 0.36),
            ('fill', (-0.36, 0.22, 0.20), 0.65, 0.48),
            ('rim', (0.04, -0.36, 0.30), 1.05, 0.40)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.85))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), \
            Vector(direction).normalized()

    def fit_dist(direction, lens, corners, margin=1.12):
        right, up, back = cam_basis(direction)
        sensor = cam_data.sensor_width
        sx, sy = scene.render.resolution_x, scene.render.resolution_y
        sw = sensor if sx >= sy else sensor * sx / sy
        sh = sensor * sy / sx if sx >= sy else sensor
        th = sw * 0.5 / lens
        tv = sh * 0.5 / lens
        need = 0.0
        for p in corners:
            need = max(need, abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(mn - center, mx - center)
    # крупный план: шарнир, зажим, замок и стяжка у левого виска
    close_t = Vector((-0.090, 0.020, 0.086))
    c_close = box_corners(Vector((-0.148, -0.058, 0.036)) - close_t,
                          Vector((-0.030, 0.090, 0.136)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.82, 0.62, 0.28), center, 105, c_main, 0.90),
        ('front', (0.06, 1.00, 0.12), center, 105, c_main, 0.90),
        ('side', (1.00, 0.04, 0.10), center, 105, c_main, 0.90),
        ('closeup', (-0.54, 0.76, 0.26), close_t, 100, c_close, 0.94),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4):
            got = max_ndc(fill)
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} fill={max_ndc(fill):.3f} {fp}', flush=True)
    return outs


def main():
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()