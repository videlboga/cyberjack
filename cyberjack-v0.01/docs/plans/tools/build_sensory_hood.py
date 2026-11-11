"""Standalone builder: sensory_hood (SNS-HOOD-01, «Капюшон», класс SENSORY).

Мягкий сенсорный капюшон: молочный текстиль снаружи, тёмная подкладка,
мягкий валик по лицу (окаймляет окно), регулируемая шнуровка с блочками и
фиксатором, дыхательный порт с решёткой и циановым кольцом, закрытые уши
с нажимными дисками, манжета-крепление с ремнём, пряжкой, D-кольцом и
биркой. Плиты нет, вращения нет, анимации нет.

Не зависит от build_component_library.py.

Запуск (сборка + GLB + 4 рендера):
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_sensory_hood.py

Выход:
  public/models/machine-modules/components/sensory_hood.glb
  docs/plans/blockout/component-library/sensory_hood/sensory_hood_{3q,front,side,closeup}.png

Геометрия (Blender Z-up, метры): ось капюшона = Z, лицо = -Y, затылок = +Y.
  Окно лица вырезается в параметрическом пространстве (z, азимут), поэтому
  валик-окантовка лежит ровно на кромке выреза.
  bbox по паспорту 0.30 x 0.30 x 0.35.
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
RENDER_OUT = PROJECT / 'docs/plans/blockout/component-library/sensory_hood'
CID = 'sensory_hood'
PREFIX = CID + '__'

TAU = math.tau

# --- ключевые размеры (м) -------------------------------------------------
Z_TOP = 0.350
Z_SHELL0 = 0.0215             # низ оболочки спрятан в манжете
COLLAR_Z0, COLLAR_Z1 = 0.010, 0.046
COLLAR_T = 0.0120             # толщина мягкой манжеты
SHELL_T = 0.0050              # толщина текстиля

WIN_CZ = 0.247                # центр окна лица
WIN_RZ = 0.054                # половина высоты окна
WIN_DV = 0.640                # половина угловой ширины окна (рад)
WIN_CUT = 1.100               # вырез чуть больше окантовки: кромка уходит под валик
RIM_S, RIM_R = 1.055, 0.0118  # положение и радиус мягкого валика по лицу

PORT_CZ = 0.158
PORT_RX, PORT_RZ = 0.0300, 0.0178

EYE_X, EYE_Z = 0.0295, (0.1315, 0.1120, 0.0925, 0.0730)
EAR_Z = 0.245
EAR_X = 0.1310
EAR_R = (0.0195, 0.0405, 0.0465)

NV = 100
FOLD_A = 0.0042

PALETTE = {
    'milk': (0.928, 0.921, 0.903),
    'milk_shade': (0.858, 0.850, 0.832),
    'graphite': (0.222, 0.232, 0.250),
    'lining': (0.115, 0.125, 0.144),
    'steel': (0.630, 0.648, 0.668),
    'cyan': (0.380, 0.870, 0.930),
}
ROUGH = {'milk': 0.90, 'milk_shade': 0.92, 'graphite': 0.84,
         'lining': 0.95, 'steel': 0.30, 'cyan': 0.35}
MATS = {}

# профиль: z, rx, ry_back, ry_front, y_offset
PROFILE = [
    (0.0000, 0.0710, 0.0865, 0.0800, 0.0060),
    (0.0300, 0.0820, 0.0985, 0.0900, 0.0060),
    (0.0700, 0.0990, 0.1155, 0.1025, 0.0060),
    (0.1100, 0.1150, 0.1300, 0.1125, 0.0050),
    (0.1500, 0.1265, 0.1405, 0.1205, 0.0040),
    (0.1950, 0.1340, 0.1485, 0.1290, 0.0030),
    (0.2400, 0.1375, 0.1520, 0.1355, 0.0020),
    (0.2800, 0.1330, 0.1475, 0.1340, 0.0010),
    (0.3150, 0.1175, 0.1325, 0.1240, 0.0000),
    (0.3330, 0.0960, 0.1100, 0.1025, 0.0000),
    (0.3440, 0.0640, 0.0745, 0.0690, 0.0000),
    (0.3500, 0.0160, 0.0185, 0.0170, 0.0000),
    (0.3505, 0.0000, 0.0000, 0.0000, 0.0000),
]


# --- helpers --------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_hood_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = 0.85 if role == 'steel' else 0.0
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.6
    m.diffuse_color = (*color, 1.0)
    m.use_backface_culling = False
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


def bm_to_obj(name, bm, role, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def orient_out(bm):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    best = max(bm.faces, key=lambda f: f.calc_center_median().x)
    if best.normal.x < 0.0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bm.normal_update()


def solidify(obj, thickness, offset=-1.0):
    mod = obj.modifiers.new('sol', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = offset
    mod.use_even_offset = False
    mod.use_rim = True
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def bevel_mod(obj, width, segments=2, angle=40.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), matrix=None):
    bm = bmesh.new()
    m = Matrix.Translation(Vector(loc)) @ Matrix.Diagonal(Vector((*size, 1.0)))
    if matrix is not None:
        m = matrix.to_4x4() @ Matrix.Diagonal(Vector((*size, 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    obj = bm_to_obj(name, bm, role, False)
    if r > 0:
        bevel_mod(obj, r)
    return obj


def sphere(name, loc, radius, role, segs=24, rings=14, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    if scale:
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


def tube(name, points, radius, role, cyclic=False, res=3, bezier=False):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 6 if bezier else 1
    sp = cu.splines.new('BEZIER' if bezier else 'POLY')
    if bezier:
        sp.bezier_points.add(len(points) - 1)
        for bp, p in zip(sp.bezier_points, points):
            bp.co = Vector(p)
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
    else:
        sp.points.add(len(points) - 1)
        for pt, p in zip(sp.points, points):
            pt.co = (p[0], p[1], p[2], 1.0)
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


def join(objs, name):
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


def frame(n, hint=(1.0, 0.0, 0.0)):
    """Базис: локальная Z = n, локальная X ~ hint."""
    n = Vector(n).normalized()
    x = Vector(hint) - n * Vector(hint).dot(n)
    if x.length < 1e-5:
        x = Vector((0.0, 0.0, 1.0)) - n * n.z
    x.normalize()
    y = n.cross(x)
    return Matrix(((x.x, y.x, n.x, 0.0),
                   (x.y, y.y, n.y, 0.0),
                   (x.z, y.z, n.z, 0.0),
                   (0.0, 0.0, 0.0, 1.0)))


def rrect(w, h, r, n=5):
    """Контур скруглённого прямоугольника в локальной плоскости XY."""
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0.0),
                       (-(w / 2 - r), h / 2 - r, math.pi / 2),
                       (-(w / 2 - r), -(h / 2 - r), math.pi),
                       (w / 2 - r, -(h / 2 - r), 1.5 * math.pi)):
        for k in range(n):
            a = a0 + (math.pi / 2) * k / n
            pts.append(Vector((cx + r * math.cos(a), cy + r * math.sin(a), 0.0)))
    return pts


def ribbon(name, path, half_w, role, thickness):
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
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


# --- профиль --------------------------------------------------------------
def cr(points, n):
    pts = [points[0]] + list(points) + [points[-1]]
    segs = len(pts) - 3
    out = []
    for i in range(n):
        t = i / (n - 1) * segs
        k = min(int(t), segs - 1)
        u = t - k
        p0, p1, p2, p3 = pts[k], pts[k + 1], pts[k + 2], pts[k + 3]
        u2, u3 = u * u, u * u * u
        vals = []
        for j in range(5):
            vals.append(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * u
                               + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * u2
                               + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * u3))
        vals[1] = max(vals[1], 0.0)
        vals[2] = max(vals[2], 0.0)
        vals[3] = max(vals[3], 0.0)
        out.append(tuple(vals))
    for i in range(1, len(out)):
        if out[i][0] <= out[i - 1][0]:
            out[i] = (out[i - 1][0] + 1e-6,) + out[i][1:]
    return out


SAMPLES = cr(PROFILE, 110)


def prof(z):
    """(rx, ry_back, ry_front, y_off) по сглаженному профилю."""
    z = min(max(z, SAMPLES[0][0]), SAMPLES[-1][0])
    for i in range(len(SAMPLES) - 1):
        z0, rx0, b0, f0, y0 = SAMPLES[i]
        z1, rx1, b1, f1, y1 = SAMPLES[i + 1]
        if z0 <= z <= z1:
            t = 0.0 if z1 - z0 < 1e-9 else (z - z0) / (z1 - z0)
            t = smoothstep(t) * 0.5 + t * 0.5
            return (rx0 + (rx1 - rx0) * t,
                    b0 + (b1 - b0) * t,
                    f0 + (f1 - f0) * t,
                    y0 + (y1 - y0) * t)
    return SAMPLES[-1][1:]


def fold(z, v):
    """Мягкие вертикальные складки ткани; спереди почти нулевые."""
    w = 0.30 + 0.70 * (0.5 + 0.5 * math.sin(v))
    taper = smoothstep((z - 0.02) / 0.07) * (1.0 - smoothstep((z - 0.300) / 0.050))
    a = FOLD_A * w * taper * math.cos(3.0 * (v - math.pi / 2.0))
    b = 0.45 * FOLD_A * w * taper * math.cos(7.0 * (v - math.pi / 2.0) + 0.6)
    return a + b


def front_fold(z):
    return fold(z, -math.pi / 2.0)


def surf(z, v, sx=1.0):
    rx, ryb, ryf, yo = prof(z)
    f = 1.0 + fold(z, v)
    s = math.sin(v)
    ry = 0.5 * (ryb + ryf) + 0.5 * (ryb - ryf) * s
    return Vector((rx * f * sx * math.cos(v), yo + ry * f * sx * s, z))


def front_y(x, z):
    rx, ryb, ryf, yo = prof(z)
    t = 1.0 - (x / max(rx, 1e-5)) ** 2
    if t <= 0.0:
        return yo - 0.0015
    return yo - ryf * (1.0 + front_fold(z)) * math.sqrt(t)


def front_normal(x, z):
    e = 0.0025
    dx = Vector((1.0, (front_y(x + e, z) - front_y(x - e, z)) / (2 * e), 0.0))
    dz = Vector((0.0, (front_y(x, z + e) - front_y(x, z - e)) / (2 * e), 1.0))
    n = dz.cross(dx)
    if n.length < 1e-9:
        n = Vector((0.0, -1.0, 0.0))
    n.normalize()
    return -n if n.y > 0.0 else n


def front_pt(x, z, out=0.0):
    return Vector((x, front_y(x, z), z)) + front_normal(x, z) * out


# --- оболочка и подкладка -------------------------------------------------
def win_dv(v):
    return (v + math.pi / 2.0 + math.pi) % TAU - math.pi


def build_surface(name, sx, winscale, zlo, zhi, role, thick):
    bm = bmesh.new()
    rings = []
    params = []
    vdata = {}
    for (z, rx, ryb, ryf, yo) in SAMPLES:
        if z < zlo - 1e-6 or z > zhi + 1e-6 or rx * sx < 0.0055:
            continue
        ring = []
        for j in range(NV):
            v = TAU * j / NV
            vv = bm.verts.new(surf(z, v, sx))
            vdata[vv] = (z, v)
            ring.append(vv)
        rings.append(ring)
        params.append(z)
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        zc = 0.5 * (params[i] + params[i + 1])
        u = (zc - WIN_CZ) / (WIN_RZ * winscale)
        for j in range(NV):
            k = (j + 1) % NV
            vc = TAU * (j + 0.5) / NV
            w = win_dv(vc) / (WIN_DV * winscale)
            c = (a[j].co + a[k].co + b[k].co + b[j].co) * 0.25
            if c.y < 0.0 and u * u + w * w < 1.0:
                continue
            bm.faces.new((a[j], a[k], b[k], b[j]))
    loose = [v for v in bm.verts if not v.link_faces]
    if loose:
        bmesh.ops.delete(bm, geom=loose, context='VERTS')
    top = rings[-1]
    pole = bm.verts.new((0.0, 0.0, SAMPLES[-1][0]))
    for j in range(NV):
        bm.faces.new((top[j], top[(j + 1) % NV], pole))
    orient_out(bm)
    obj = bm_to_obj(name, bm, role, True)
    solidify(obj, thick, -1.0)
    return obj


def build_shell():
    return build_surface(PREFIX + 'shell', 1.0, WIN_CUT, Z_SHELL0, Z_TOP, 'milk', SHELL_T)


def build_lining():
    return build_surface(PREFIX + 'lining', 0.935, WIN_CUT + 0.30, Z_SHELL0, Z_TOP,
                       'lining', 0.0030)


# --- окно: мягкий валик по кромке ----------------------------------------
def win_point(th, scale=1.0, out=0.0):
    z = WIN_CZ + WIN_RZ * scale * math.sin(th)
    v = -math.pi / 2.0 + WIN_DV * scale * math.cos(th)
    p = surf(z, v)
    if out == 0.0:
        return p
    rx, ryb, ryf, yo = prof(z)
    s = math.sin(v)
    ry = 0.5 * (ryb + ryf) + 0.5 * (ryb - ryf) * s
    n = Vector((math.cos(v) / max(rx, 1e-5), s / max(ry, 1e-5), 0.0)).normalized()
    return p + n * out


def build_rim():
    cnt = 84
    pts = [win_point(TAU * i / cnt, RIM_S) for i in range(cnt)]
    tube(PREFIX + 'rim_roll', pts, RIM_R, 'milk_shade', cyclic=True, res=4)
    inner = [win_point(TAU * i / cnt, RIM_S - 0.075, 0.0034) for i in range(cnt)]
    tube(PREFIX + 'rim_stitch', inner, 0.0014, 'graphite', cyclic=True, res=2)


# --- уши ------------------------------------------------------------------
def build_ears():
    for side, sx in (('l', -1.0), ('r', 1.0)):
        rx, ryb, ryf, yo = prof(EAR_Z)
        sphere(PREFIX + f'ear_pad_{side}', (sx * EAR_X, yo * 0.4, EAR_Z), 1.0,
               'milk_shade', segs=32, rings=18, scale=EAR_R)
        a = EAR_X + EAR_R[0] - 0.0085
        b = EAR_X + EAR_R[0] + 0.0015
        bpy.ops.mesh.primitive_cylinder_add(vertices=30, radius=0.0128,
                                            depth=(b - a),
                                            location=(sx * (a + b) * 0.5, yo * 0.4, EAR_Z),
                                            rotation=(0.0, math.pi / 2.0, 0.0))
        disc = bpy.context.object
        disc.name = PREFIX + f'ear_disc_{side}'
        apply(disc, 'steel', True)
        bevel_mod(disc, 0.0016)
        ring = [(sx * (EAR_X + EAR_R[0] + 0.0012),
                 yo * 0.4 + 0.0180 * math.cos(TAU * i / 36),
                 EAR_Z + 0.0200 * math.sin(TAU * i / 36)) for i in range(36)]
        tube(PREFIX + f'ear_ring_{side}', ring, 0.0019, 'cyan', cyclic=True, res=2)
        seam = [(sx * (EAR_X + 0.0045),
                 yo * 0.4 + EAR_R[1] * 0.88 * math.cos(TAU * i / 40),
                 EAR_Z + EAR_R[2] * 0.88 * math.sin(TAU * i / 40)) for i in range(40)]
        tube(PREFIX + f'ear_seam_{side}', seam, 0.0013, 'graphite', cyclic=True, res=2)


# --- дыхательный порт -----------------------------------------------------
def build_port():
    z = PORT_CZ
    p0 = Vector((0.0, front_y(0.0, z), z))
    n = front_normal(0.0, z)
    M = frame(n, (1.0, 0.0, 0.0))
    M.translation = p0 + n * 0.0035

    def ell(rx, rz, zloc):
        return [M @ Vector((rx * math.cos(TAU * i / 36), rz * math.sin(TAU * i / 36), zloc))
                for i in range(36)]

    bm = bmesh.new()
    back = [bm.verts.new(p) for p in ell(PORT_RX + 0.0040, PORT_RZ + 0.0040, -0.0120)]
    front = [bm.verts.new(p) for p in ell(PORT_RX, PORT_RZ, 0.0)]
    for i in range(36):
        j = (i + 1) % 36
        bm.faces.new((back[i], back[j], front[j], front[i]))
    bm.faces.new(front)
    bm.faces.new(tuple(reversed(back)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    port = bm_to_obj(PREFIX + 'breath_port', bm, 'graphite', False)
    bevel_mod(port, 0.0022, 3)

    slats = []
    for k, dz in enumerate((-0.0092, 0.0, 0.0092)):
        pts = [M @ Vector((PORT_RX * 0.74 * math.cos(TAU * I / 28),
                           PORT_RZ * 0.26 * math.sin(TAU * I / 28) + dz,
                           0.0020)) for I in range(28)]
        slats.append(tube(f'{PREFIX}slat_tmp{k}', pts, 0.0023, 'steel',
                          cyclic=True, res=2))
    join(slats, PREFIX + 'breath_grille')

    tube(PREFIX + 'breath_ring', ell(PORT_RX + 0.0010, PORT_RZ + 0.0010, 0.0014),
         0.0020, 'cyan', cyclic=True, res=2)

    a = M @ Vector((0.0, -PORT_RZ - 0.001, -0.0100))
    b = M @ Vector((0.0, -PORT_RZ - 0.004, -0.0345))
    bpy.ops.mesh.primitive_cylinder_add(vertices=20, radius=0.0064,
                                        depth=(b - a).length,
                                        location=(a + b) * 0.5)
    stub = bpy.context.object
    stub.name = PREFIX + 'breath_stub'
    stub.rotation_mode = 'QUATERNION'
    stub.rotation_quaternion = (b - a).to_track_quat('Z', 'Y')
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    apply(stub, 'graphite', True)


# --- шнуровка -------------------------------------------------------------
def build_lacing():
    pts = []
    for z in EYE_Z:
        for sgn in (-1.0, 1.0):
            pts.append(front_pt(sgn * EYE_X, z, 0.0018))

    eyes = []
    for idx, p in enumerate(pts):
        n = front_normal(p.x, p.z)
        bpy.ops.mesh.primitive_torus_add(major_segments=20, minor_segments=8,
                                         major_radius=0.0053, minor_radius=0.0019,
                                         location=p)
        t = bpy.context.object
        t.name = f'{PREFIX}eye_tmp{idx}'
        t.rotation_mode = 'QUATERNION'
        t.rotation_quaternion = Vector((0.0, 0.0, 1.0)).rotation_difference(n)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
        apply(t, 'steel', True)
        eyes.append(t)
    join(eyes, PREFIX + 'eyelets')

    L = [pts[0], pts[2], pts[4], pts[6]]
    R = [pts[1], pts[3], pts[5], pts[7]]
    cords = []
    k = 0
    for i in range(3):
        for a, b in ((L[i], R[i + 1]), (R[i], L[i + 1])):
            mid = (a + b) * 0.5
            out = Vector((0.0, -0.0034, 0.0))
            path = [a, (a + mid) * 0.5 + out * 0.55, mid + out,
                    (b + mid) * 0.5 + out * 0.55, b]
            cords.append(tube(f'{PREFIX}cord_tmp{k}', path, 0.0021, 'graphite',
                              bezier=True, res=2))
            k += 1

    lock = front_pt(0.0, EYE_Z[3] - 0.0175, 0.0135)
    for a in (L[3], R[3]):
        cords.append(tube(f'{PREFIX}cord_tmp{k}',
                          [a, (a + lock) * 0.5 + Vector((0.0, -0.003, 0.0)), lock],
                          0.0021, 'graphite', bezier=True, res=2))
        k += 1

    # хвосты шнура поверх манжеты
    tail_y = collar_outer(0.0, 0.030)[0].y - 0.0065
    beads = []
    for sgn in (-1.0, 1.0):
        end = Vector((sgn * 0.0130, tail_y, 0.0315))
        cords.append(tube(f'{PREFIX}cord_tmp{k}',
                          [lock, Vector((sgn * 0.0075, tail_y + 0.010, 0.0455)), end],
                          0.0021, 'graphite', bezier=True, res=2))
        k += 1
        beads.append(sphere(f'{PREFIX}bead_tmp{k}', end, 0.0030, 'graphite',
                            segs=16, rings=10))
    join(cords, PREFIX + 'lacing_cord')
    join(beads, PREFIX + 'cord_beads')

    # фиксатор
    n = front_normal(0.0, lock.z)
    M = frame(n, (0.0, 0.0, 1.0))
    M.translation = lock + n * 0.0008
    bm = bmesh.new()
    corners = [(sx, sz, dy) for sx in (0, 1) for sz in (0, 1) for dy in (0, 1)]
    vmap = {}
    for (sx, sz, dy) in corners:
        vmap[(sx, sz, dy)] = bm.verts.new(
            M @ Vector(((sx - 0.5) * 0.0165, (sz - 0.5) * 0.0185, (dy - 0.5) * 0.0085)))
    for f in (((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0)),
              ((0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1)),
              ((0, 0, 0), (1, 0, 0), (1, 0, 1), (0, 0, 1)),
              ((0, 1, 0), (1, 1, 0), (1, 1, 1), (0, 1, 1)),
              ((0, 0, 0), (0, 1, 0), (0, 1, 1), (0, 0, 1)),
              ((1, 0, 0), (1, 1, 0), (1, 1, 1), (1, 0, 1))):
        bm.faces.new([vmap[c] for c in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    lockobj = bm_to_obj(PREFIX + 'cord_lock', bm, 'graphite', False)
    bevel_mod(lockobj, 0.0024, 3)
    sphere(PREFIX + 'cord_lock_button', lock + n * 0.0060, 0.0027, 'cyan',
           segs=16, rings=10)


# --- манжета-крепление ----------------------------------------------------
def collar_ring(v, z, out):
    rx, ryb, ryf, yo = prof(z)
    s = math.sin(v)
    ry = 0.5 * (ryb + ryf) + 0.5 * (ryb - ryf) * s
    f = 1.0 + fold(z, v)
    p = Vector((rx * f * math.cos(v), yo + ry * f * s, z))
    n = Vector((math.cos(v) / max(rx, 1e-5), s / max(ry, 1e-5), 0.0)).normalized()
    return p + n * out, n


def collar_outer(v, z):
    return collar_ring(v, z, 0.0025 + COLLAR_T)


def build_collar():
    bm = bmesh.new()
    st = []
    for j in range(NV):
        v = TAU * j / NV
        ib, _ = collar_ring(v, COLLAR_Z0, 0.0025)
        ob, _ = collar_ring(v, COLLAR_Z0, 0.0025 + COLLAR_T)
        ot, _ = collar_ring(v, COLLAR_Z1, 0.0025 + COLLAR_T * 0.62)
        it, _ = collar_ring(v, COLLAR_Z1, 0.0025)
        st.append([bm.verts.new(p) for p in (ib, ob, ot, it)])
    for j in range(NV):
        a, b = st[j], st[(j + 1) % NV]
        bm.faces.new((a[0], a[1], b[1], b[0]))
        bm.faces.new((a[1], a[2], b[2], b[1]))
        bm.faces.new((a[2], a[3], b[3], b[2]))
        bm.faces.new((a[3], a[0], b[0], b[3]))
    orient_out(bm)
    cuff = bm_to_obj(PREFIX + 'collar', bm, 'milk', True)
    bevel_mod(cuff, 0.0036, 2)

    roll = []
    for j in range(NV):
        v = TAU * j / NV
        p, n = collar_ring(v, COLLAR_Z0 + 0.0055, 0.0025 + COLLAR_T - 0.0045)
        roll.append(p)
    tube(PREFIX + 'collar_roll', roll, 0.0098, 'milk_shade', cyclic=True, res=4)

    for tag, zz in (('lo', COLLAR_Z0 + 0.0090), ('hi', COLLAR_Z1 - 0.0090)):
        seam = [collar_ring(TAU * j / NV, zz, 0.0025 + COLLAR_T + 0.0012)[0]
                for j in range(NV)]
        tube(PREFIX + f'collar_seam_{tag}', seam, 0.0011, 'graphite',
             cyclic=True, res=2)

    # ремень по затылку
    a0, a1 = math.pi / 2 - 1.05, math.pi / 2 + 1.05
    zs = 0.0300
    path = []
    for j in range(34):
        v = a0 + (a1 - a0) * j / 33
        p, n = collar_outer(v, zs)
        path.append((p + n * 0.0020, Vector((0.0, 0.0, 1.0))))
    ribbon(PREFIX + 'collar_strap', path, 0.0125, 'graphite', 0.0038)

    # пряжка на конце ремня
    pe, ne = collar_outer(a0 + 0.045, zs)
    M = frame(ne, (0.0, 0.0, 1.0))
    M.translation = pe + ne * 0.0042
    frame_pts = [M @ p for p in rrect(0.0300, 0.0245, 0.0060, 5)]
    parts = [tube(f'{PREFIX}buck_tmp0', frame_pts, 0.0032, 'steel',
                  cyclic=True, res=2)]
    prong = [M @ Vector((-0.0110 + 0.0220 * i / 8, 0.0, 0.0)) for i in range(9)]
    parts.append(tube(f'{PREFIX}buck_tmp1', prong, 0.0026, 'steel', res=2))
    join(parts, PREFIX + 'buckle')

    # D-кольцо на затылке справа
    v0 = math.pi / 2 - 0.62
    p, n = collar_outer(v0, 0.0235)
    c = p + n * 0.0135
    ring = [c + n * (0.0150 * math.cos(TAU * i / 36))
            + Vector((0.0, 0.0, 0.0145 * math.sin(TAU * i / 36)))
            for i in range(36)]
    tube(PREFIX + 'd_ring', ring, 0.0036, 'steel', cyclic=True, res=3)
    Mt = frame(n, (0.0, 0.0, 1.0))
    Mt.translation = p + n * 0.0035
    cube(PREFIX + 'd_ring_tab', (0, 0, 0), (0.026, 0.017, 0.0060), 'graphite',
         r=0.0018, matrix=Mt)

    # бирка на левом боку манжеты
    v_tag = math.pi / 2 + 0.95
    pt, nt = collar_outer(v_tag, 0.0225)
    Mtg = frame(nt, (0.0, 0.0, 1.0))
    Mtg.translation = pt + nt * 0.0016
    cube(PREFIX + 'tag', (0, 0, 0), (0.0245, 0.0155, 0.0016), 'milk_shade',
         r=0.0014, matrix=Mtg)
    marks = []
    for k, sx in enumerate((-0.0085, 0.0085)):
        Mm = Mtg @ Matrix.Translation(Vector((sx, 0.0, 0.0009)))
        Mm = Mm @ Matrix.Diagonal(Vector((0.0016, 0.0125, 0.0010, 1.0)))
        bm2 = bmesh.new()
        bmesh.ops.create_cube(bm2, size=1.0, matrix=Mm)
        bmesh.ops.recalc_face_normals(bm2, faces=bm2.faces)
        marks.append(bm_to_obj(f'{PREFIX}tagmark_tmp{k}', bm2, 'graphite', False))
    join(marks, PREFIX + 'tag_marks')


def build_seams():
    parts = []
    cc = Vector((0.0, 0.0025, 0.155))
    raw = []
    for i in range(28):
        z = 0.312 + (0.3499 - 0.312) * (i / 27) ** 0.80
        raw.append(Vector((0.0, front_y(0.0, z), z)))
    raw.append(Vector((0.0, 0.0, 0.3505)))
    for i in range(28):
        z = 0.3499 - (0.3499 - 0.252) * (i / 27) ** 0.80
        rx, ryb, ryf, yo = prof(z)
        raw.append(Vector((0.0, yo + ryb * (1.0 + fold(z, math.pi / 2)), z)))
    path = []
    for p in raw:
        n = (p - cc).normalized()
        path.append(p + n * 0.0010)
    parts.append(tube(f'{PREFIX}seam_tmp0', path, 0.0018, 'milk_shade', res=2))

    for k, dv in enumerate((-0.95, 0.95)):
        v = math.pi / 2 + dv
        pts = []
        for i in range(24):
            z = 0.050 + (0.298 - 0.050) * i / 23
            rx, ryb, ryf, yo = prof(z)
            s = math.sin(v)
            ry = 0.5 * (ryb + ryf) + 0.5 * (ryb - ryf) * s
            n = Vector((math.cos(v) / rx, s / ry, 0.0)).normalized()
            pts.append(surf(z, v) + n * 0.0008)
        parts.append(tube(f'{PREFIX}seam_tmp{k + 1}', pts, 0.0016, 'milk_shade', res=2))
    join(parts, PREFIX + 'seams')


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


def check():
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    tris = 0
    for o in meshes:
        tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    report = {
        'component': CID,
        'nodes': len(objs),
        'nodes_mesh': len(meshes),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 4) for v in mn],
        'bbox_max': [round(v, 4) for v in mx],
        'bbox_size': [round(v, 4) for v in size],
        'bbox_passport': [0.30, 0.30, 0.35],
        'bbox_ok': bool(size.x <= 0.312 and size.y <= 0.312 and 0.334 <= size.z <= 0.356),
        'triangles': tris,
        'materials': sorted(m.name for m in bpy.data.materials),
        'node_names': sorted(o.name for o in objs),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
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
def render_all(glb):
    RENDER_OUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.958, 0.953, 0.940, 1)
    bg.inputs['Strength'].default_value = 0.55

    bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, -0.0018))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.855, 0.845, 0.828, 1)
    b.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    for name, direction, energy in [('key', (1.0, -1.15, 1.35), 1.75),
                                    ('fill', (-1.25, -0.85, 0.45), 0.75),
                                    ('rim', (0.15, 1.15, 0.85), 1.25)]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(16)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()

    bpy.ops.import_scene.gltf(filepath=str(glb))
    bpy.context.view_layer.update()

    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in sc.objects:
        if o.type != 'MESH' or o.name == 'Plane':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx], flush=True)

    center = (mn + mx) * 0.5
    size = mx - mn

    def shot(name, direction, target, ortho=None, dist=0.95, lens=85, res=(900, 760)):
        sc.render.resolution_x, sc.render.resolution_y = res
        cam = bpy.data.objects.get('cam')
        if cam is None:
            cd = bpy.data.cameras.new('cam')
            cam = bpy.data.objects.new('cam', cd)
            sc.collection.objects.link(cam)
        sc.camera = cam
        d = Vector(direction).normalized()
        if ortho:
            cam.data.type = 'ORTHO'
            cam.data.ortho_scale = ortho
            cam.location = Vector(target) + d * 1.4
        else:
            cam.data.type = 'PERSP'
            cam.data.lens = lens
            cam.location = Vector(target) + d * dist
        cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = str(RENDER_OUT / f'{CID}_{name}.png')
        bpy.ops.render.render(write_still=True)
        print('RENDER', sc.render.filepath, flush=True)

    shot('3q', (1.20, -1.50, 0.92), center, ortho=max(size) * 1.62)
    shot('front', (0.0, -1.0, 0.05), center, ortho=max(size.x, size.z) * 1.62)
    shot('side', (1.0, 0.0, 0.05), center, ortho=max(size.y, size.z) * 1.62)
    shot('closeup', (0.42, -0.90, 0.22), (0.0, -0.11, 0.180),
         dist=0.44, lens=85, res=(940, 800))


def main():
    reset()
    build_shell()
    build_lining()
    build_rim()
    build_ears()
    build_port()
    build_lacing()
    build_collar()
    build_seams()
    bpy.context.view_layer.update()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok']:
        raise SystemExit('bbox failed')
    render_all(path)
    print('DONE', flush=True)


main()
