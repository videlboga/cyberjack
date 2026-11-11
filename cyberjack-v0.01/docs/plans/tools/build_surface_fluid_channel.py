"""Standalone builder: surface_fluid_channel (SRF-DR-05, «Дренаж»).

Тонкий герметичный мат-лоток 2,0 x 0,9 x 0,03 м для отвода жидкости:
  молочный формованный поддон, сеть каналов (гребёнка: коллектор -> 5 каналов
  -> сборник со сливом Ø20), входной штуцер с быстросъёмом, герметизирующий
  кант с губкой-уплотнителем, ремни с липучками по кромке, стальные
  кронштейны крепления в раму, маркировка потока (шевроны, IN/OUT).
Без плиты, без вращений, без анимации.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_surface_fluid_channel.py

Выход:
  public/models/machine-modules/components/surface_fluid_channel.glb
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
CID = 'surface_fluid_channel'
PREFIX = CID + '__'

# --- ключевые размеры (м) -------------------------------------------------
PAN_AX, PAN_AY = 0.9700, 0.4460     # полугабариты поддона (1,94 x 0,892)
PAN_RC = 0.0680                    # скругление плана
PAN_T = 0.0120                     # верх поддона = дно каналов
PAN_RR = 0.0045                    # радиус верхней/нижней кромки поддона

BEAD_R = 0.0100                    # радиус герметизирующего канта
BEAD_CZ = 0.0155                   # ось канта -> верх 0,0255
BEAD_INSET = 0.0105                # ось канта от кромки (касание кромки поддона)
LIP_R = 0.0034                     # губка-уплотнитель
LIP_INSET = 0.0262

STRAP_T = 0.0040                   # толщина ремня
STRAP_ZMAX = 0.0264                # потолок осевой линии ремня (верх ~0,030)

WALL_Z0 = 0.0090                   # низ стенки (утоплен в поддон)
WALL_Z1 = 0.0242                   # верх продольных стенок
WALL_Z1T = 0.0239                  # верх поперечных стенок (без z-fight)
RIB_HW_T = 0.0195                  # полуширина ребра по верху
RIB_HW_B = 0.0255                  # полуширина ребра по низу
RIB_R = 0.0050
WALL_HW_T = 0.0250                 # полуширина боковой стенки по верху
WALL_HW_B = 0.0315                 # полуширина боковой стенки по низу
WALL_R = 0.0060

CH_W = 0.0940                      # ширина канала
CH_PITCH = 0.1450                  # шаг каналов
CH_Y = (0.2900, 0.1450, 0.0, -0.1450, -0.2900)
CH_X0, CH_X1 = -0.8000, 0.8000     # длина каналов
DIV_Y = (0.2175, 0.0725, -0.0725, -0.2175)
XCH = ((0.4280, 0.4820), (-0.4820, -0.4280))   # поперечные каналы-связки
DIV_SEG = ((-0.8000, -0.4820), (-0.4280, 0.4280), (0.4820, 0.8000))
SIDE_Y = 0.3685                    # ось боковой стенки поля
FIELD_Y = 0.4005                   # внешняя грань поля каналов

MAN_W = 0.0820                     # ширина коллектора/сборника
MAN_CX = 0.8410                    # ось коллектора (x = -0.882..-0.800)
MANWALL_CX = 0.9135                # ось поперечной стенки
MANWALL_X = 0.9450                 # внешняя грань стенки

PORT_Z_IN = 0.0152                 # ось входного штуцера
PORT_Z_OUT = 0.0148                # ось слива

PALETTE = {
    'milk': (0.947, 0.939, 0.921),
    'shell': (0.862, 0.855, 0.837),
    'pale': (0.788, 0.792, 0.780),
    'teal': (0.128, 0.478, 0.508),
    'teal_deep': (0.088, 0.352, 0.382),
    'steel': (0.726, 0.732, 0.720),
    'graphite': (0.247, 0.256, 0.268),
    'web': (0.298, 0.302, 0.316),
    'velcro': (0.412, 0.392, 0.386),
    'rubber': (0.176, 0.184, 0.196),
}
ROUGH = {'milk': 0.55, 'shell': 0.60, 'pale': 0.52, 'teal': 0.34,
         'teal_deep': 0.38, 'steel': 0.30, 'graphite': 0.55, 'web': 0.90,
         'velcro': 0.95, 'rubber': 0.94}
MATS = {}


# --- helpers --------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_fluid_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = 0.85 if role == 'steel' else 0.0
    if role in ('teal', 'teal_deep'):
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.05
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


def bevel_mod(obj, width, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def bm_to_obj(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel_mod(obj, r, 2)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, r2=None, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-7:
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
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bev > 0:
        select_only(obj)
        bevel_mod(obj, bev, 2)
    return apply(obj, role, smooth)


def torus(name, loc, major, minor, role, axis='Z', segs=48, rings=10):
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


def curve_tube(name, points, radius, role, res=4, cyclic=False):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 8
    cu.use_fill_caps = True
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


def ring_points(ax, ay, rc, n_short=12, n_long=52, n_corner=7):
    """Замкнутый контур скруглённого прямоугольника (без дублей)."""
    rc = max(rc, 1e-4)
    ax = max(ax, rc + 1e-4)
    ay = max(ay, rc + 1e-4)
    pts = []
    for k in range(n_short):                    # x=+ax, y вверх
        pts.append((ax, -(ay - rc) + 2 * (ay - rc) * k / (n_short - 1)))
    for k in range(1, n_corner):                # NE
        a = (math.pi / 2) * k / n_corner
        pts.append((ax - rc + rc * math.cos(a), ay - rc + rc * math.sin(a)))
    for k in range(n_long):                     # y=+ay, x влево
        pts.append((ax - rc - 2 * (ax - rc) * k / (n_long - 1), ay))
    for k in range(1, n_corner):                # NW
        a = math.pi / 2 + (math.pi / 2) * k / n_corner
        pts.append((-ax + rc + rc * math.cos(a), ay - rc + rc * math.sin(a)))
    for k in range(n_short):                    # x=-ax, y вниз
        pts.append((-ax, ay - rc - 2 * (ay - rc) * k / (n_short - 1)))
    for k in range(1, n_corner):                # SW
        a = math.pi + (math.pi / 2) * k / n_corner
        pts.append((-ax + rc + rc * math.cos(a), -ay + rc + rc * math.sin(a)))
    for k in range(n_long):                     # y=-ay, x вправо
        pts.append((-ax + rc + 2 * (ax - rc) * k / (n_long - 1), -ay))
    for k in range(1, n_corner):                # SE
        a = 1.5 * math.pi + (math.pi / 2) * k / n_corner
        pts.append((ax - rc + rc * math.cos(a), -ay + rc + rc * math.sin(a)))
    return pts


def bm_prism(bm, poly, z0, h):
    lo = [bm.verts.new((p[0], p[1], z0)) for p in poly]
    hi = [bm.verts.new((p[0], p[1], z0 + h)) for p in poly]
    bm.faces.new(lo)
    bm.faces.new(tuple(reversed(hi)))
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))


def bm_box(bm, center, size, rot_z=0.0):
    m = (Matrix.Translation(Vector(center))
         @ Matrix.Rotation(rot_z, 4, 'Z')
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def wall_profile(hw_b, hw_t, z_bot, z_top, r, seg=4, n_top=4):
    """Замкнутый профиль стенки (u, z) против часовой стрелки."""
    pts = [(hw_b, z_bot), (hw_t, z_top - r)]
    cx, cz = hw_t - r, z_top - r
    for k in range(1, seg + 1):
        a = (math.pi / 2) * k / seg
        pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    for k in range(1, n_top):
        t = k / n_top
        pts.append((hw_t - r - 2 * (hw_t - r) * t, z_top))
    for k in range(seg + 1):
        a = (math.pi / 2) * (1 - k / seg)
        pts.append((-(hw_t - r) - r * math.cos(a), cz + r * math.sin(a)))
    pts.append((-hw_b, z_bot))
    return pts


def sweep_bar(name, p0, p1, profile, role, extend=0.0):
    """Протяжка профиля по прямой (p0 -> p1) в плоскости XY."""
    p0 = Vector((p0[0], p0[1], 0.0))
    p1 = Vector((p1[0], p1[1], 0.0))
    d = (p1 - p0).normalized()
    p0 -= d * extend
    p1 += d * extend
    n = Vector((-d.y, d.x, 0.0))
    bm = bmesh.new()
    L0 = [bm.verts.new((p0.x + n.x * u, p0.y + n.y * u, z)) for u, z in profile]
    L1 = [bm.verts.new((p1.x + n.x * u, p1.y + n.y * u, z)) for u, z in profile]
    m = len(profile)
    for i in range(m):
        j = (i + 1) % m
        bm.faces.new((L0[i], L0[j], L1[j], L1[i]))
    bm.faces.new(L0)
    bm.faces.new(tuple(reversed(L1)))
    return bm_to_obj(name, bm, role, True)


def cr2(points, n):
    """Catmull-Rom по 2D-точкам (u, z)."""
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


def ribbon(name, path, half_w, role, thickness=0.004):
    """Лента по (P, W); Solidify даёт толщину."""
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


def strap(name, axis, sgn, fixed, width, ctrl, role='web'):
    """Ремень, обхватывающий кромку.

    axis='x' -> плоскость XZ у торца x=sgn*PAN_AX, ширина по Y;
    axis='y' -> плоскость YZ у длинной кромки, ширина по X.
    ctrl = [(u, z)], u — координата вдоль обхватываемой кромки.
    """
    pts = cr2(ctrl, 100)
    path = []
    if axis == 'x':
        w = Vector((0.0, 1.0, 0.0))
        for u, z in pts:
            path.append((Vector((sgn * u, fixed, min(z, STRAP_ZMAX))), w))
    else:
        w = Vector((1.0, 0.0, 0.0))
        for u, z in pts:
            path.append((Vector((fixed, sgn * u, min(z, STRAP_ZMAX))), w))
    return ribbon(name, path, width * 0.5, role, STRAP_T)


# --- сборка ---------------------------------------------------------------
def build_pan():
    """Формованный поддон: плоский верх, скруглённая кромка, стенка, низ."""
    bm = bmesh.new()
    stations = [('z', PAN_RR, PAN_T)]
    for k in range(1, 6):
        a = (math.pi / 2) * k / 5
        stations.append(('z', PAN_RR * (1 - math.sin(a)),
                         PAN_T - PAN_RR * (1 - math.cos(a))))
    for k in range(1, 3):
        stations.append(('z', 0.0, (PAN_T - PAN_RR)
                         - (PAN_T - 2 * PAN_RR) * k / 2))
    for k in range(1, 6):
        a = (math.pi / 2) * (1 - k / 5)
        stations.append(('z', PAN_RR * (1 - math.sin(a)),
                         PAN_RR * (1 - math.cos(a))))
    stations.append(('z', PAN_RR, 0.0))

    rings = []
    for _, inset, z in stations:
        loop = ring_points(PAN_AX - inset, PAN_AY - inset, PAN_RC - inset)
        rings.append([bm.verts.new((x, y, z)) for x, y in loop])

    n = len(rings[0])
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        for j in range(n):
            k = (j + 1) % n
            bm.faces.new((a[j], a[k], b[k], b[j]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    obj = bm_to_obj(PREFIX + 'tray_pan', bm, 'milk', True)
    return obj, len(rings) * n


def build_field():
    """Сеть каналов: коллектор -> 5 каналов -> сборник."""
    prof = wall_profile(RIB_HW_B, RIB_HW_T, WALL_Z0, WALL_Z1, RIB_R)
    prof_side = wall_profile(WALL_HW_B, WALL_HW_T, WALL_Z0, WALL_Z1, WALL_R)
    prof_t = wall_profile(WALL_HW_B, WALL_HW_T, WALL_Z0, WALL_Z1T, WALL_R)

    for i, y in enumerate(DIV_Y):
        bm = bmesh.new()
        for x0, x1 in DIV_SEG:
            L0 = [bm.verts.new((x0, y + u, z)) for u, z in prof]
            L1 = [bm.verts.new((x1, y + u, z)) for u, z in prof]
            m = len(prof)
            for k in range(m):
                j = (k + 1) % m
                bm.faces.new((L0[k], L0[j], L1[j], L1[k]))
            bm.faces.new(L0)
            bm.faces.new(tuple(reversed(L1)))
        bm_to_obj(PREFIX + f'channel_wall_{i + 1}', bm, 'shell', True)

    for tag, s in (('l', -1), ('r', 1)):
        sweep_bar(PREFIX + f'field_wall_{tag}', (-MANWALL_X, s * SIDE_Y),
                  (MANWALL_X, s * SIDE_Y), prof_side, 'shell')

    for tag, s in (('in', -1), ('out', 1)):
        sweep_bar(PREFIX + f'manifold_wall_{tag}',
                  (s * MANWALL_CX, -FIELD_Y), (s * MANWALL_CX, FIELD_Y),
                  prof_t, 'shell', extend=0.004)

    # дно каналов (светлый полимер), приподнято на 0,8 мм
    bm = bmesh.new()
    for y in CH_Y:
        for x0, x1 in DIV_SEG:
            bm_prism(bm, [(x0, y - CH_W / 2), (x1, y - CH_W / 2),
                          (x1, y + CH_W / 2), (x0, y + CH_W / 2)],
                     PAN_T, 0.0008)
    for x0, x1 in XCH:
        bm_prism(bm, [(x0, -0.3450), (x1, -0.3450),
                      (x1, 0.3450), (x0, 0.3450)], PAN_T, 0.0008)
    bm_to_obj(PREFIX + 'channel_floor', bm, 'pale', False)

    # дно коллектора и сборника (бирюзовое, «мокрое»)
    bm = bmesh.new()
    for s in (-1, 1):
        bm_prism(bm, [(s * MAN_CX - MAN_W / 2, -0.3440),
                      (s * MAN_CX + MAN_W / 2, -0.3440),
                      (s * MAN_CX + MAN_W / 2, 0.3440),
                      (s * MAN_CX - MAN_W / 2, 0.3440)], PAN_T, 0.0009)
    bm_to_obj(PREFIX + 'manifold_floor', bm, 'teal_deep', False)


def bead_runs(inset, z, gap_half=0.048):
    """Два прогона по периметру — с окнами под штуцеры на торцах."""
    loop = ring_points(PAN_AX - inset, PAN_AY - inset, PAN_RC - inset,
                       n_short=14, n_long=54, n_corner=7)
    runs, cur = [], []
    for x, y in loop:
        in_window = abs(y) < gap_half and abs(x) > PAN_AX - 0.075
        if in_window:
            if len(cur) > 2:
                runs.append(cur)
            cur = []
        else:
            cur.append((x, y, z))
    if len(cur) > 2:
        runs.append(cur)
    if len(runs) > 1:
        merged = runs[-1] + runs[0]
        runs = [merged] + runs[1:-1]
    return runs


def build_bead():
    for i, run in enumerate(bead_runs(BEAD_INSET, BEAD_CZ)):
        curve_tube(PREFIX + f'seal_bead_{i + 1}', run, BEAD_R, 'milk', res=5)
    for i, run in enumerate(bead_runs(LIP_INSET, PAN_T + LIP_R, 0.044)):
        curve_tube(PREFIX + f'seal_lip_{i + 1}', run, LIP_R, 'rubber', res=4)


def build_inlet():
    """Входной штуцер: формованная площадка в разрыве канта + быстросъём."""
    z = PORT_Z_IN
    ax = PAN_AX
    # площадка-уплотнитель, закрывает разрыв канта
    cube(PREFIX + 'inlet_pad', (-(ax - 0.0155), 0, 0.0146),
         (0.0260, 0.0980, 0.0224), 'milk', r=0.0045)
    cyl(PREFIX + 'inlet_boss', (-(ax - 0.0950), 0, z), (-(ax - 0.0030), 0, z),
        0.0130, 'milk', vertices=36, bev=0.0014)
    cyl(PREFIX + 'inlet_coupling', (-(ax + 0.0105), 0, z),
        (-(ax + 0.0215), 0, z), 0.0140, 'steel', vertices=44, bev=0.0012)
    for i, x in enumerate((0.0130, 0.0160, 0.0190)):
        torus(PREFIX + f'inlet_knurl_{i + 1}', (-(ax + x), 0, z), 0.0141,
              0.0007, 'steel', 'X', segs=44, rings=8)
    cyl(PREFIX + 'inlet_spout', (-(ax + 0.0215), 0, z), (-(ax + 0.0295), 0, z),
        0.0115, 'graphite', vertices=32, bev=0.0012)
    torus(PREFIX + 'inlet_barb', (-(ax + 0.0280), 0, z), 0.0115, 0.0013,
          'steel', 'X')
    torus(PREFIX + 'inlet_lock_ring', (-(ax + 0.0112), 0, z), 0.0139, 0.0009,
          'teal', 'X')
    # курок быстросъёма — плоский рычаг на боковине стакана
    cube(PREFIX + 'inlet_lever', (-(ax + 0.0165), 0.0172, 0.0238),
         (0.0240, 0.0070, 0.0052), 'graphite', r=0.0012,
         rot=(0, 0, math.radians(12)))
    cyl(PREFIX + 'inlet_pin', (-(ax + 0.0120), -0.0150, z + 0.0020),
        (-(ax + 0.0120), -0.0150, z + 0.0090), 0.0018, 'graphite', vertices=12)


def build_outlet():
    """Слив: площадка в разрыве канта, стакан, штуцер Ø20."""
    z = PORT_Z_OUT
    ax = PAN_AX
    cube(PREFIX + 'outlet_pad', (ax - 0.0155, 0, 0.0142),
         (0.0260, 0.0980, 0.0216), 'milk', r=0.0045)
    cyl(PREFIX + 'outlet_boss', (ax - 0.0980, 0, z), (ax - 0.0030, 0, z),
        0.0120, 'milk', vertices=36, bev=0.0014)
    cyl(PREFIX + 'outlet_coupling', (ax + 0.0105, 0, z), (ax + 0.0210, 0, z),
        0.0138, 'steel', vertices=44, bev=0.0012)
    for i, x in enumerate((0.0130, 0.0160, 0.0190)):
        torus(PREFIX + f'outlet_knurl_{i + 1}', (ax + x, 0, z), 0.0139,
              0.0007, 'steel', 'X', segs=44, rings=8)
    cyl(PREFIX + 'outlet_spout', (ax + 0.0210, 0, z), (ax + 0.0290, 0, z),
        0.0105, 'graphite', vertices=32, bev=0.0012)
    torus(PREFIX + 'outlet_oring', (ax + 0.0112, 0, z), 0.0139, 0.0009,
          'teal', 'X')
    torus(PREFIX + 'outlet_d20', (ax + 0.0262, 0, z), 0.0105, 0.0012,
          'steel', 'X')


def build_drain():
    """Сборник: стакан, устье, решётка, датчик протечки."""
    cyl(PREFIX + 'sump_well', (MAN_CX - 0.0135, 0.0, PAN_T),
        (MAN_CX - 0.0135, 0.0, PAN_T + 0.0018), 0.0560, 'teal',
        vertices=48, bev=0.0008)
    torus(PREFIX + 'sump_rim', (MAN_CX - 0.0135, 0.0, PAN_T + 0.0026),
          0.0572, 0.0024, 'teal', 'Z', segs=56)
    cyl(PREFIX + 'sump_mouth', (MAN_CX + 0.0180, 0.0, PAN_T),
        (MAN_CX + 0.0180, 0.0, PAN_T + 0.0042), 0.0300, 'teal_deep',
        vertices=40, bev=0.0008)

    bm = bmesh.new()
    for k in range(-2, 3):
        y = k * 0.0120
        bm_prism(bm, [(MAN_CX + 0.0060, y - 0.0025),
                      (MAN_CX + 0.0340, y - 0.0025),
                      (MAN_CX + 0.0340, y + 0.0025),
                      (MAN_CX + 0.0060, y + 0.0025)],
                 PAN_T + 0.0036, 0.0024)
    for k in range(-1, 2):
        x = MAN_CX + 0.0200 + k * 0.0140
        bm_prism(bm, [(x - 0.0021, -0.0320), (x + 0.0021, -0.0320),
                      (x + 0.0021, 0.0320), (x - 0.0021, 0.0320)],
                 PAN_T + 0.0052, 0.0018)
    bm_to_obj(PREFIX + 'drain_grate', bm, 'steel', False)

    torus(PREFIX + 'drain_grate_ring', (MAN_CX + 0.0200, 0.0, PAN_T + 0.0044),
          0.0335, 0.0020, 'steel', 'Z', segs=48)

    cyl(PREFIX + 'leak_sensor', (MAN_CX, 0.1300, PAN_T),
        (MAN_CX, 0.1300, PAN_T + 0.0032), 0.0090, 'milk',
        vertices=24, bev=0.0008)
    cyl(PREFIX + 'leak_sensor_led', (MAN_CX, 0.1300, PAN_T + 0.0030),
        (MAN_CX, 0.1300, PAN_T + 0.0046), 0.0040, 'teal', vertices=18)


def build_straps():
    """Ремни по кромке + липучки (крепление мата в раму)."""
    top = PAN_T + 0.0022
    bead_x = PAN_AX - BEAD_INSET          # ось канта на торце
    face_x = PAN_AX + 0.0022              # осевая линия ремня на торце
    ctrl_end = [
        (0.8300, top),
        (0.9050, top),
        (0.9280, 0.0174),
        (0.9380, 0.0226),
        (bead_x, STRAP_ZMAX),
        (bead_x + 0.0090, 0.0258),
        (face_x, 0.0180),
        (face_x, 0.0072),
        (PAN_AX - 0.0008, 0.0016),
    ]
    for s in (1, -1):
        for sy in (0.2800, -0.2800):
            tag = ('p' if s > 0 else 'n') + ('p' if sy > 0 else 'n')
            strap(PREFIX + f'strap_end_{tag}', 'x', s, sy, 0.0700, ctrl_end)
            cube(PREFIX + f'velcro_pad_{tag}', (s * 0.8800, sy, PAN_T + 0.0007),
                 (0.0620, 0.0580, 0.0016), 'velcro', r=0.0004)
            cube(PREFIX + f'velcro_hook_{tag}', (s * 0.9130, sy, PAN_T + 0.0009),
                 (0.0110, 0.0500, 0.0012), 'graphite', r=0.0003)
            cube(PREFIX + f'strap_keeper_{tag}', (s * 0.8620, sy, 0.0146),
                 (0.0160, 0.0790, 0.0092), 'steel', r=0.0014)

    bead_y = PAN_AY - BEAD_INSET
    face_y = PAN_AY + 0.0022
    ctrl_side = [
        (0.3300, top),
        (0.3600, top),
        (0.3900, 0.0174),
        (0.4040, 0.0226),
        (bead_y, STRAP_ZMAX),
        (bead_y + 0.0090, 0.0258),
        (face_y, 0.0180),
        (face_y, 0.0072),
        (PAN_AY - 0.0008, 0.0016),
    ]
    for s in (1, -1):
        for sx in (0.2900, -0.2900):
            tag = ('p' if sx > 0 else 'n') + ('p' if s > 0 else 'n')
            strap(PREFIX + f'strap_side_{tag}', 'y', s, sx, 0.0560, ctrl_side)
            cube(PREFIX + f'velcro_side_{tag}', (sx, s * 0.3560, PAN_T + 0.0007),
                 (0.0500, 0.0320, 0.0016), 'velcro', r=0.0004)


def build_clips():
    """Стальные кронштейны крепления в раму (4 шт., с пазом под винт)."""
    for sx in (1, -1):
        for sy in (1, -1):
            tag = ('p' if sx > 0 else 'n') + ('p' if sy > 0 else 'n')
            x = sx * 0.6200
            bm = bmesh.new()
            bm_box(bm, (x, sy * 0.4115, PAN_T + 0.0020),
                   (0.0480, 0.0200, 0.0040))
            bm_box(bm, (x, sy * 0.4212, PAN_T + 0.0071),
                   (0.0480, 0.0038, 0.0142))
            bm_box(bm, (x, sy * 0.4115, PAN_T + 0.0123),
                   (0.0480, 0.0224, 0.0038))
            for k in (-1, 1):
                bm_box(bm, (x + k * 0.0155, sy * 0.4205, PAN_T + 0.0063),
                       (0.0130, 0.0090, 0.0086))
            bm_to_obj(PREFIX + f'frame_clip_{tag}', bm, 'steel', False)
            cyl(PREFIX + f'clip_screw_{tag}', (x, sy * 0.4125, PAN_T + 0.0018),
                (x, sy * 0.4125, PAN_T + 0.0140), 0.0042, 'graphite',
                vertices=16)


def build_marks():
    """Маркировка потока: шевроны в каналах, осевые нити, IN/OUT."""
    bm = bmesh.new()
    xs = (-0.6100, -0.2800, 0.0600, 0.4000, 0.6600)
    for y in CH_Y:
        for x in xs:
            tip = Vector((x, y))
            for s in (-1, 1):
                back = Vector((x - 0.0265, y + s * 0.0195))
                d = (back - tip).normalized()
                p = Vector((-d.y, d.x))
                t = 0.0034
                poly = [tip + p * t, tip - p * t, back - p * t, back + p * t]
                bm_prism(bm, poly, PAN_T + 0.0009, 0.0009)
    for y in CH_Y:
        for x0, x1 in DIV_SEG:
            bm_prism(bm, [(x0 + 0.0040, y - 0.0028), (x1 - 0.0040, y - 0.0028),
                          (x1 - 0.0040, y + 0.0028), (x0 + 0.0040, y + 0.0028)],
                     PAN_T + 0.0009, 0.0012)
    bm_to_obj(PREFIX + 'flow_marks', bm, 'teal', False)

    # поперечные стрелки в коллекторе и сборнике
    bm = bmesh.new()
    for s in (-1, 1):
        for y in (0.2400, 0.0900, -0.0900, -0.2400):
            tip = Vector((s * MAN_CX, y * 0.55))
            back = Vector((s * MAN_CX, y))
            d = (back - tip).normalized()
            p = Vector((-d.y, d.x))
            t = 0.0030
            bm_prism(bm, [tip + p * t, tip - p * t, back - p * t, back + p * t],
                     PAN_T + 0.0009, 0.0010)
    bm_to_obj(PREFIX + 'manifold_marks', bm, 'teal', False)

    # IN / OUT на верхушках поперечных стенок: плашка + шевроны по потоку
    for tag, s in (('in', -1), ('out', 1)):
        cube(PREFIX + f'port_tag_{tag}', (s * MANWALL_CX, 0.0, WALL_Z1T + 0.0010),
             (0.0460, 0.0780, 0.0016), 'teal', r=0.0005)
        bm = bmesh.new()
        for k in range(3):
            y = (k - 1) * 0.0225
            tip = Vector((s * MANWALL_CX, y))
            back = Vector((tip.x - 0.0245, y))
            for sg in (-1, 1):
                b = Vector((back.x, y + sg * 0.0170))
                d = (b - tip).normalized()
                p = Vector((-d.y, d.x))
                t = 0.0030
                bm_prism(bm, [tip + p * t, tip - p * t, b - p * t, b + p * t],
                         WALL_Z1T + 0.0018, 0.0010)
        bm_to_obj(PREFIX + f'port_tag_mark_{tag}', bm, 'milk', False)

    # шильдик параметров на свободном поле у кромки
    cube(PREFIX + 'label_plate', (-0.7000, 0.4105, PAN_T + 0.0008),
         (0.0760, 0.0130, 0.0016), 'milk', r=0.0004)
    bm = bmesh.new()
    for k in range(4):
        x = -0.7280 + k * 0.0186
        bm_prism(bm, [(x, 0.4052), (x + 0.0110, 0.4052),
                      (x + 0.0110, 0.4158), (x, 0.4158)],
                 PAN_T + 0.0014, 0.0008)
    bm_to_obj(PREFIX + 'label_type', bm, 'graphite', False)

    # номер компонента на свободном поле у торца
    bm = bmesh.new()
    for k in range(3):
        x = -0.8950 + k * 0.0175
        bm_prism(bm, [(x, -0.4060), (x + 0.0080, -0.4060),
                      (x + 0.0080, -0.4250), (x, -0.4250)],
                 PAN_T + 0.0002, 0.0010)
    bm_to_obj(PREFIX + 'spec_marks', bm, 'graphite', False)


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


def check(pan_verts):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    for o in meshes:
        o.data.calc_loop_triangles()
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    mats = sorted({m.name for o in meshes for m in o.data.materials if m})
    rep = {
        'component': CID,
        'nodes': len(objs),
        'meshes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in (mn + mx) * 0.5],
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.008 and abs(size.y - 0.9) <= 0.008
                        and 0.027 <= size.z <= 0.033),
        'channel_depth': round(WALL_Z1 - PAN_T, 5),
        'channels': len(CH_Y),
        'pan_verts': pan_verts,
        'verts_total': sum(len(o.data.vertices) for o in meshes),
        'tris_total': sum(len(o.data.loop_triangles) for o in meshes),
        'materials': mats,
        'mat_count': len(mats),
        'objects': sorted(o.name for o in meshes),
        'bad_names': sorted(o.name for o in bpy.data.objects
                           if not o.name.startswith(PREFIX)),
    }
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
    _, pan_verts = build_pan()
    build_field()
    build_bead()
    build_inlet()
    build_outlet()
    build_drain()
    build_straps()
    build_clips()
    build_marks()
    rep = check(pan_verts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok'] or rep['mat_count'] < 4:
        raise SystemExit('checks failed')


main()
