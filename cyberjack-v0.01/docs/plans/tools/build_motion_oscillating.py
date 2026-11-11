"""Standalone builder: motion_oscillating (MOT-OSC-05, «Осциллятор»).

Открытый кривошипно-ползунный механизм:
вертикальный мотор-редуктор -> плоская кривошипная плита с радиальным пазом
амплитуды и противовесом -> палец -> шатун -> ползун на двух направляющих.
Корпуса-кожуха нет: только несущая рама (лыжи + поперечины + стойки),
опорная плита привода и сам механизм.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_motion_oscillating.py

Выход:
  public/models/machine-modules/components/motion_oscillating.glb
  docs/plans/blockout/component-library/motion_oscillating/*.png (+ report.json)

Геометрия (Blender Z-up, метры), габарит по паспорту 0.5 x 0.3 x 0.25:
  ось кривошипа = Z (в three.js после Y-up — Y), центр плиты C
  ось хода ползуна = X, линия хода y = -0.012, z = 0.120
  __anim       = C, центр кривошипной плиты; дети — вращающиеся детали + шарнир шатуна
  __rod_pivot  = ДИТЯ __anim, сидит на пальце кривошипа (локальный сдвиг = радиус
                 кривошипа). Положение и базовая ориентация шатуна приходят
                 от иерархии; рантайму остаётся один угол поворота вокруг Y.
  __rod_end    = ДИТЯ __slide, точка малой проушины (центр пальца ползуна).
                 Даёт two-point решение: шатун целится из своего шарнира в эту точку.
  __slide      = каретка ползуна, отдельная ветвь в корне, призматика по X
  статичны     = рама, опорная плита, мотор-редуктор, стойки, направляющие

Кинематика (кривошип-ползун), числа выгружаются в
docs/plans/tools/kinematics_oscillating.json — этот файл и есть контракт для
рантайма; он генерируется здесь, поэтому не может разойтись с моделью.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_oscillating'
CID = 'motion_oscillating'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
C = Vector((-0.150, -0.012, 0.0))       # ось кривошипа
DISC_R = 0.052
DISC_Z0, DISC_Z1 = 0.120, 0.138         # плита 18 мм
R_CRANK = 0.020                         # радиус кривошипа (амплитуда 0.02)
TH0 = math.radians(270.0)               # рабочая фаза: палец вперёд (-Y)
ROD_L = 0.204                           # межцентровое расстояние шатуна
ROD_Z0, ROD_Z1 = 0.154, 0.170           # плоскость шатуна (проушины)
RAIL_Y = (-0.058, 0.040)
RAIL_Z = 0.120
RAIL_R = 0.006
SX0 = C.x + math.sqrt(ROD_L ** 2 - R_CRANK ** 2)   # 0.05302 — середина хода
SY0 = C.y
PIN_R = 0.006
EYE_RI = 0.0072

PALETTE = {
    'ivory': (0.960, 0.950, 0.925),
    'steel': (0.632, 0.638, 0.630),
    'steel_matte': (0.578, 0.584, 0.576),
    'graphite': (0.248, 0.256, 0.266),
    'dark': (0.115, 0.120, 0.132),
    'blush': (0.898, 0.706, 0.732),
    'mark': (0.858, 0.243, 0.373),
}
# роль -> (roughness, metallic): плита и торец кривошипа матовые, чтобы
# плоская поверхность не читалась «вогнутой чашей» от блика среды
FINISH = {
    'steel': (0.52, 0.55),
    'steel_matte': (0.78, 0.14),
    'graphite': (0.68, 0.12),
    'dark': (0.74, 0.04),
    'ivory': (0.62, 0.0),
    'blush': (0.58, 0.05),
    'mark': (0.55, 0.05),
}
MATS = {}
GROUPS = {k: [] for k in ('frame', 'drive', 'crank', 'rod', 'slider')}
MOVE_GROUPS = ('crank', 'rod', 'slider')


def P(name):
    return PREFIX + name


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    for k in GROUPS:
        GROUPS[k].clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    rough, metal = FINISH[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=None):
    obj.data.materials.append(mat(role))
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bevel(obj, width=0.0015, segments=1, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def smooth_sides(obj, axis):
    """Сглаживаем только боковую поверхность: торцы остаются плоскими."""
    axis = Vector(axis).normalized()
    for p in obj.data.polygons:
        p.use_smooth = abs(p.normal.dot(axis)) < 0.4


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r, 1)
    return apply(obj, role)


def slab(name, x0, x1, y0, y1, z0, z1, role, r=0.0012):
    return cube(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2),
                (abs(x1 - x0), abs(y1 - y0), abs(z1 - z0)), role, r)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, r2=None, bev=0.0,
        flat=False):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(f'{name}: zero length')
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
        bevel(obj, bev, 1)
    apply(obj, role)
    if flat:
        for p in obj.data.polygons:
            p.use_smooth = False
    elif smooth:
        smooth_sides(obj, d)
    return obj


def tube(name, p0, p1, r_in, r_out, role, seg=32, flat=False):
    """Полый цилиндр (втулка/проушина/подшипник) — реальное отверстие."""
    a, b = Vector(p0), Vector(p1)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(f'{name}: zero length')
    q = d.to_track_quat('Z', 'Y')
    bm = bmesh.new()
    rows = []
    for i in range(seg):
        ang = math.tau * i / seg
        ci, si = math.cos(ang), math.sin(ang)
        ri = Vector((ci * r_in, si * r_in, 0.0))
        ro = Vector((ci * r_out, si * r_out, 0.0))
        rows.append((bm.verts.new(a + q @ ri), bm.verts.new(a + q @ ro),
                     bm.verts.new(b + q @ ri), bm.verts.new(b + q @ ro)))
    for i in range(seg):
        v0, v1 = rows[i], rows[(i + 1) % seg]
        bm.faces.new((v0[0], v1[0], v1[2], v0[2]))     # внутренняя стенка
        bm.faces.new((v0[1], v0[3], v1[3], v1[1]))     # наружная стенка
        bm.faces.new((v0[0], v0[1], v1[1], v1[0]))     # торец a
        bm.faces.new((v0[2], v1[2], v1[3], v0[3]))     # торец b
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    dn = d.normalized()
    for poly in me.polygons:
        poly.use_smooth = (not flat) and abs(poly.normal.dot(dn)) < 0.4
    return apply(obj, role)


def torus(name, loc, major, minor, role, segs=48, rings=8):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def curve_tube(name, points, radius, role, res=6):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 10
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    for p in obj.data.polygons:
        p.use_smooth = True
    return obj


def mesh_from_bm(name, bm, role, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def boxes(name, items, role):
    bm = bmesh.new()
    for m in items:
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    return mesh_from_bm(name, bm, role)


def sector(name, center, r_in, r_out, a0, a1, z0, z1, role, n=28):
    """Сектор кольца — противовес кривошипа (плоский, гранёный)."""
    cx, cy = center[0], center[1]
    bm = bmesh.new()
    rows = []
    for i in range(n + 1):
        a = a0 + (a1 - a0) * i / n
        ca, sa = math.cos(a), math.sin(a)
        rows.append((
            bm.verts.new((cx + r_in * ca, cy + r_in * sa, z0)),
            bm.verts.new((cx + r_out * ca, cy + r_out * sa, z0)),
            bm.verts.new((cx + r_in * ca, cy + r_in * sa, z1)),
            bm.verts.new((cx + r_out * ca, cy + r_out * sa, z1)),
        ))
    for i in range(n):
        A, B = rows[i], rows[i + 1]
        bm.faces.new((A[0], B[0], B[1], A[1]))
        bm.faces.new((A[2], A[3], B[3], B[2]))
        bm.faces.new((A[0], A[2], B[2], B[0]))
        bm.faces.new((A[1], B[1], B[3], A[3]))
    bm.faces.new((rows[0][0], rows[0][1], rows[0][3], rows[0][2]))
    bm.faces.new((rows[-1][0], rows[-1][2], rows[-1][3], rows[-1][1]))
    return mesh_from_bm(name, bm, role)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.empty_display_type = 'ARROWS'
    e.location = loc
    e.rotation_mode = 'XYZ'
    return e


def mount(obj, pivot, rest):
    """Пекём геометрию в локальные координаты ветви, чтобы у узла GLB
    не было паразитных трансформов, а вращение шло строго вокруг pivot."""
    local = rest.inverted() @ obj.matrix_world
    obj.parent = None
    obj.matrix_world = local
    select_only(obj)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.parent = pivot
    obj.matrix_parent_inverse = Matrix.Identity(4)
    obj.matrix_basis = Matrix.Identity(4)
    return obj


def reg(group, obj):
    GROUPS[group].append(obj.name)
    obj['group'] = group
    obj['moving'] = group in MOVE_GROUPS
    return obj


def radial(r, off=0.0, z=0.0):
    u = Vector((math.cos(TH0), math.sin(TH0), 0.0))
    v = Vector((-math.sin(TH0), math.cos(TH0), 0.0))
    return Vector((C.x, C.y, 0.0)) + u * r + v * off + Vector((0.0, 0.0, z))


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ===================== РАМА ==========================================
    for tag, ys in (('l', -1.0), ('r', 1.0)):
        yc = ys * 0.132
        reg('frame', slab(P(f'skid_{tag}'), -0.248, 0.248, yc - 0.013,
                          yc + 0.013, 0.012, 0.036, 'graphite', r=0.0030))
        for x in (-0.216, 0.216):
            reg('frame', cyl(P(f'foot_{tag}{int(x * 1000)}'), (x, yc, 0.0),
                              (x, yc, 0.014), 0.017, 'dark', vertices=20,
                              bev=0.0025, flat=True))

    for i, xc in enumerate((-0.196, -0.100, -0.004, 0.226)):
        reg('frame', slab(P(f'cross_{i}'), xc - 0.013, xc + 0.013,
                          -0.132, 0.132, 0.016, 0.034, 'graphite', r=0.0026))

    # стойки направляющих: портал, а не стол — между стойками пусто
    for btag, xc in (('rear', -0.004), ('front', 0.226)):
        for tag, y in (('f', RAIL_Y[0]), ('b', RAIL_Y[1])):
            reg('frame', slab(P(f'post_{btag}_{tag}'), xc - 0.009, xc + 0.009,
                              y - 0.009, y + 0.009, 0.034, 0.1065,
                              'graphite', r=0.0016))
            reg('frame', slab(P(f'post_cap_{btag}_{tag}'), xc - 0.015,
                              xc + 0.015, y - 0.0145, y + 0.0145, 0.103,
                              0.112, 'graphite', r=0.0016))
            reg('frame', tube(P(f'bearing_{btag}_{tag}'),
                               (xc - 0.015, y, RAIL_Z), (xc + 0.015, y, RAIL_Z),
                               RAIL_R + 0.0012, 0.0135, 'steel', seg=24))

    for tag, y in (('f', RAIL_Y[0]), ('b', RAIL_Y[1])):
        reg('frame', cyl(P(f'rail_{tag}'), (-0.030, y, RAIL_Z),
                          (0.241, y, RAIL_Z), RAIL_R, 'steel', vertices=20))
        for etag, x0, x1 in (('r', -0.036, -0.030), ('f', 0.241, 0.247)):
            reg('frame', cyl(P(f'rail_nut_{tag}{etag}'), (x0, y, RAIL_Z),
                              (x1, y, RAIL_Z), 0.0105, 'graphite',
                              vertices=16, bev=0.0010, flat=True))

    # ограничители хода — вне рабочего хода ползуна (0.033..0.073)
    for stag, x0 in (('a', 0.008), ('b', 0.100)):
        reg('frame', tube(P(f'stop_{stag}'), (x0, RAIL_Y[1], RAIL_Z),
                          (x0 + 0.006, RAIL_Y[1], RAIL_Z), RAIL_R + 0.0002,
                          0.0125, 'graphite', seg=20, flat=True))

    # ===================== ПРИВОД (мотор-редуктор) ======================
    # опорная плита на двух поперечинах + 4 болта
    reg('drive', slab(P('motor_plate'), -0.205, -0.095, -0.060, 0.048,
                      0.034, 0.038, 'steel_matte', r=0.0016))
    for tag, bx, by in (('a', -0.196, -0.052), ('b', -0.196, 0.040),
                        ('c', -0.104, -0.052), ('d', -0.104, 0.040)):
        reg('drive', cyl(P(f'plate_bolt_{tag}'), (bx, by, 0.038),
                          (bx, by, 0.0435), 0.0052, 'steel', vertices=16,
                          bev=0.0008, flat=True))

    MX, MY = C.x, C.y
    reg('drive', cyl(P('motor_foot'), (MX, MY, 0.038), (MX, MY, 0.048),
                      0.046, 'graphite', vertices=56, bev=0.0020))
    reg('drive', cyl(P('motor_body'), (MX, MY, 0.048), (MX, MY, 0.108),
                      0.038, 'graphite', vertices=56, bev=0.0016))
    reg('drive', torus(P('motor_seam'), (MX, MY, 0.078), 0.0382, 0.0012,
                        'dark', segs=56, rings=6))
    reg('drive', torus(P('motor_band'), (MX, MY, 0.100), 0.0383, 0.0016,
                        'blush', segs=56, rings=6))
    reg('drive', cyl(P('motor_bell'), (MX, MY, 0.108), (MX, MY, 0.1135),
                      0.031, 'steel', vertices=48, bev=0.0012))
    reg('drive', cyl(P('motor_flange'), (MX, MY, 0.1135), (MX, MY, 0.116),
                      0.042, 'steel_matte', vertices=56, bev=0.0010))
    for i in range(6):
        a = math.tau * i / 6 + math.radians(15)
        bx, by = MX + 0.0355 * math.cos(a), MY + 0.0355 * math.sin(a)
        reg('drive', cyl(P(f'flange_bolt_{i}'), (bx, by, 0.116),
                          (bx, by, 0.1176), 0.0034, 'steel', vertices=12,
                          flat=True))

    # клеммная коробка на +X стороне корпуса и кабель на плиту
    reg('drive', slab(P('terminal_box'), MX + 0.036, MX + 0.052,
                      MY - 0.020, MY + 0.016, 0.064, 0.090, 'graphite',
                      r=0.0020))
    reg('drive', slab(P('terminal_lid'), MX + 0.035, MX + 0.053,
                      MY - 0.022, MY + 0.018, 0.090, 0.0925, 'steel',
                      r=0.0010))
    reg('drive', cyl(P('cable_gland'), (MX + 0.047, MY - 0.002, 0.070),
                      (MX + 0.047, MY - 0.002, 0.064), 0.0055, 'ivory',
                      vertices=16, bev=0.0008, flat=True))

    # ===================== КРИВОШИП (только вращающееся) =================
    reg('crank', cyl(P('crank_stub'), (C.x, C.y, 0.1165), (C.x, C.y, DISC_Z0),
                      0.012, 'steel', vertices=32, flat=True))
    reg('crank', cyl(P('crank_disc'), (C.x, C.y, DISC_Z0), (C.x, C.y, DISC_Z1),
                      DISC_R, 'steel_matte', vertices=128, bev=0.0012,
                      flat=True))
    reg('crank', cyl(P('crank_hub'), (C.x, C.y, DISC_Z1), (C.x, C.y, 0.148),
                      0.016, 'steel_matte', vertices=48, bev=0.0010,
                      flat=True))
    reg('crank', cyl(P('crank_nut'), (C.x, C.y, 0.148), (C.x, C.y, 0.1525),
                      0.009, 'graphite', vertices=6, flat=True))

    # противовес — сектор кольца на свободной половине плиты
    reg('crank', sector(P('counterweight'), (C.x, C.y), 0.024, 0.050,
                        TH0 + math.radians(180 - 58), TH0 + math.radians(180 + 58),
                        DISC_Z1, DISC_Z1 + 0.012, 'graphite'))
    for i, da in enumerate((-38, 0, 38)):
        a = TH0 + math.radians(180 + da)
        bx, by = C.x + 0.040 * math.cos(a), C.y + 0.040 * math.sin(a)
        reg('crank', cyl(P(f'cw_bolt_{i}'), (bx, by, DISC_Z1 + 0.012),
                          (bx, by, DISC_Z1 + 0.0134), 0.0032, 'steel',
                          vertices=14, flat=True))

    # радиальный паз амплитуды: реальная выборка в теле плиты + тёмный лайнер
    cutter = cube(P('slot_cutter'), radial(0.0225, 0.0, DISC_Z1 + 0.0015),
                  (0.021, 0.019, 0.0040), 'dark', r=0.0, rot=(0, 0, TH0))
    disc = bpy.data.objects[P('crank_disc')]
    mod = disc.modifiers.new('slot', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    select_only(disc)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    for p in disc.data.polygons:
        p.use_smooth = False
    reg('crank', disc)
    reg('crank', cube(P('slot_liner'), radial(0.0225, 0.0, DISC_Z1 - 0.0013),
                      (0.020, 0.018, 0.0008), 'dark', r=0.0, rot=(0, 0, TH0)))

    # шкала амплитуды — риски на плите рядом с пазом
    items = []
    for i in range(6):
        p = radial(0.014 + i * 0.0038, 0.0132, DISC_Z1 + 0.0004)
        items.append(Matrix.Translation(p) @ Matrix.Rotation(TH0, 4, 'Z')
                     @ Matrix.Diagonal((0.0016, 0.0060, 0.0008, 1.0)))
    reg('crank', boxes(P('amp_scale'), items, 'graphite'))

    # каретка пальца, зажимные винты, палец
    reg('crank', cube(P('amp_carriage'), radial(0.0225, 0.0, 0.1412),
                      (0.014, 0.018, 0.0075), 'graphite', rot=(0, 0, TH0),
                      r=0.0010))
    reg('crank', cube(P('amp_cap'), radial(0.0225, 0.0, 0.1458),
                      (0.012, 0.015, 0.0016), 'blush', rot=(0, 0, TH0),
                      r=0.0005))
    for tag, off in (('a', 0.0060), ('b', -0.0060)):
        reg('crank', cyl(P(f'amp_screw_{tag}'),
                          radial(0.0225, off, 0.1466),
                          radial(0.0225, off, 0.1500),
                          0.0032, 'steel', vertices=14, flat=True))

    pin_xy = Vector((C.x + R_CRANK * math.cos(TH0),
                     C.y + R_CRANK * math.sin(TH0)))
    reg('crank', cyl(P('crank_pin'), (pin_xy.x, pin_xy.y, 0.1458),
                      (pin_xy.x, pin_xy.y, 0.1705), PIN_R, 'steel',
                      vertices=20, flat=True))
    reg('crank', cyl(P('crank_pin_cap'), (pin_xy.x, pin_xy.y, 0.1705),
                      (pin_xy.x, pin_xy.y, 0.1755), 0.0095, 'graphite',
                      vertices=24, bev=0.0010, flat=True))

    # ===================== ШАТУН =========================================
    S0 = Vector((SX0, SY0))
    a0 = math.atan2(S0.y - pin_xy.y, S0.x - pin_xy.x)
    rod_dir = Vector((math.cos(a0), math.sin(a0)))
    mid = (pin_xy + S0) * 0.5
    reg('rod', cube(P('rod_bar'), (mid.x, mid.y, (ROD_Z0 + ROD_Z1) * 0.5),
                    (ROD_L - 0.024, 0.017, 0.011), 'steel',
                    rot=(0, 0, a0), r=0.0016))
    reg('rod', tube(P('rod_eye_big'), (pin_xy.x, pin_xy.y, ROD_Z0),
                    (pin_xy.x, pin_xy.y, ROD_Z1), EYE_RI, 0.017,
                    'steel', seg=36))
    reg('rod', tube(P('rod_eye_small'), (S0.x, S0.y, ROD_Z0),
                    (S0.x, S0.y, ROD_Z1), EYE_RI, 0.014, 'steel', seg=32))
    for tag, s in (('a', 1.0), ('b', -1.0)):
        p = pin_xy + rod_dir * (0.0135 * s)
        reg('rod', cyl(P(f'rod_bolt_{tag}'), (p.x, p.y, ROD_Z1 - 0.0002),
                       (p.x, p.y, ROD_Z1 + 0.0028), 0.0030, 'graphite',
                       vertices=14, flat=True))

    # ===================== ПОЛЗУН ========================================
    reg('slider', slab(P('crosshead'), SX0 - 0.016, SX0 + 0.016,
                       -0.062, 0.044, 0.1315, 0.139, 'graphite', r=0.0018))
    for tag, y in (('f', RAIL_Y[0]), ('b', RAIL_Y[1])):
        reg('slider', tube(P(f'bush_{tag}'),
                           (SX0 - 0.018, y, RAIL_Z), (SX0 + 0.018, y, RAIL_Z),
                           RAIL_R + 0.0012, 0.0125, 'steel', seg=28))
    reg('slider', cyl(P('slider_boss'), (SX0, SY0, 0.139), (SX0, SY0, 0.1465),
                      0.014, 'steel_matte', vertices=28, bev=0.0010))
    reg('slider', cyl(P('slider_pin'), (SX0, SY0, 0.1465), (SX0, SY0, 0.1705),
                      PIN_R, 'steel', vertices=20, flat=True))
    reg('slider', cyl(P('slider_pin_cap'), (SX0, SY0, 0.1705), (SX0, SY0, 0.1755),
                      0.0095, 'graphite', vertices=24, bev=0.0010, flat=True))
    reg('slider', slab(P('slider_mark'), SX0 - 0.008, SX0 + 0.008,
                       -0.0624, -0.0612, 0.1330, 0.1376, 'blush', r=0.0004))

    # ===================== ИЕРАРХИЯ ФАЗЫ =================================
    # __anim (кривошип, ось Y в three.js) -> __rod_pivot (шарнир на пальце)
    # __slide (призматика X)             -> __rod_end  (центр малой проушины)
    # Шатун не висит в корне: его шарнир — дитя кривошипа, поэтому положение
    # большого уха и базовая ориентация звена получаются из иерархии.
    # Рантайму остаётся ровно один скаляр — угол шатуна вокруг Y.
    ROD_MID_Z = (ROD_Z0 + ROD_Z1) * 0.5
    ANIM_Z = (DISC_Z0 + DISC_Z1) * 0.5
    anim = empty(P('anim'), (C.x, C.y, ANIM_Z))
    rod_pivot = empty(P('rod_pivot'), (pin_xy.x, pin_xy.y, ROD_MID_Z))
    rod_end = empty(P('rod_end'), (SX0, SY0, ROD_MID_Z))
    slide = empty(P('slide'), (SX0, SY0, RAIL_Z))
    for e in (anim, rod_pivot, rod_end, slide):
        e.rotation_mode = 'XYZ'
    bpy.context.view_layer.update()

    # --- шатун на пальце: локальный сдвиг = радиус кривошипа ---------------
    pin_local = Vector((pin_xy.x - C.x, pin_xy.y - C.y, ROD_MID_Z - ANIM_Z))
    rod_pivot.parent = anim
    rod_pivot.matrix_parent_inverse = Matrix.Identity(4)
    rod_pivot.location = pin_local
    rod_pivot.rotation_euler = (0.0, 0.0, 0.0)
    # --- точка малой проушины на ползуне ----------------------------------
    eye_local = Vector((0.0, 0.0, ROD_MID_Z - RAIL_Z))
    rod_end.parent = slide
    rod_end.matrix_parent_inverse = Matrix.Identity(4)
    rod_end.location = eye_local
    rod_end.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    anim['motion_type'] = 'slide'
    anim['motion_axis'] = 'X'
    anim['motion_amount'] = 2 * R_CRANK
    anim['motion_speed'] = 1.5
    anim['crank_axis'] = 'Z'
    anim['crank_axis_three'] = 'Y'
    anim['driver'] = 'crank'
    anim['rod_hinge'] = P('rod_pivot')
    rod_pivot['driver'] = 'rod'
    rod_pivot['joint'] = 'revolute'
    rod_pivot['axis_blender'] = 'Z'
    rod_pivot['axis_three'] = 'Y'
    rod_pivot['rides_on'] = 'crank_pin'
    rod_pivot['target'] = P('rod_end')
    rod_pivot['local_offset_m'] = [round(v, 6) for v in pin_local]
    rod_end['driver'] = 'rod_target'
    rod_end['role'] = 'small-eye centre on the slider'
    rod_end['local_offset_m'] = [round(v, 6) for v in eye_local]
    slide['driver'] = 'slider'
    slide['axis_blender'] = 'X'
    slide['axis_three'] = 'X'
    slide['stroke_m'] = 2 * R_CRANK

    rest_crank = anim.matrix_world.copy()
    rest_rod = Matrix.Translation((pin_xy.x, pin_xy.y, ROD_MID_Z))
    rest_slide = slide.matrix_world.copy()

    for name in GROUPS['crank']:
        mount(bpy.data.objects[name], anim, rest_crank)
    for name in GROUPS['rod']:
        mount(bpy.data.objects[name], rod_pivot, rest_rod)
    for name in GROUPS['slider']:
        mount(bpy.data.objects[name], slide, rest_slide)
    bpy.context.view_layer.update()

    return anim, rod_pivot, slide, pin_xy, a0


# --- позы, проверки ------------------------------------------------------
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


def mesh_center(obj):
    """Центр масс вершин: для симметричной втулки/проушины = центр отверстия."""
    mw = obj.matrix_world
    acc = Vector((0.0, 0.0, 0.0))
    for v in obj.data.vertices:
        acc += mw @ v.co
    return acc / max(len(obj.data.vertices), 1)


def wrap_pi(a):
    return (a + math.pi) % math.tau - math.pi


def objs_of(group):
    return [bpy.data.objects[n] for n in GROUPS[group]]


def group_tree(group):
    verts, polys = [], []
    for o in objs_of(group):
        mw = o.matrix_world
        base = len(verts)
        verts.extend(tuple(mw @ v.co) for v in o.data.vertices)
        polys.extend(tuple(base + i for i in p.vertices) for p in o.data.polygons)
    return BVHTree.FromPolygons(verts, polys, all_triangles=False)


def pose(anim, rod_pivot, slide, theta, a0):
    """Точная кинематика кривошипно-ползунного механизма в фазе theta.

    Возвращает то же, что положит рантайм: поворот __anim вокруг Y,
    один угол шатуна вокруг Y и сдвиг __slide по X.
    """
    phi = theta - TH0
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, 0.0, phi)

    px = C.x + R_CRANK * math.cos(theta)
    py = C.y + R_CRANK * math.sin(theta)
    sx = (C.x + math.sqrt(ROD_L ** 2 - (R_CRANK * math.sin(theta)) ** 2)
          + R_CRANK * math.cos(theta))
    a = math.atan2(SY0 - py, sx - px)
    # геометрия шатуна испечена под углом a0 в системе пальца; кривошип уже
    # довернул ветвь на phi, поэтому локальный угол = a - a0 - phi
    rod_pivot.rotation_euler = (0.0, 0.0, a - a0 - phi)
    slide.location = (sx, SY0, RAIL_Z)
    bpy.context.view_layer.update()
    return Vector((px, py)), Vector((sx, SY0))


def check(anim, rod_pivot, slide, pin_xy, a0):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size, center = mx - mn, (mn + mx) * 0.5

    # ---- pivot: anim на оси кривошипа, в центре плиты --------------------
    d_mn, d_mx = mesh_bbox([bpy.data.objects[P('crank_disc')]])
    disc_c = (d_mn + d_mx) * 0.5
    pivot_off = math.hypot(anim.location.x - disc_c.x,
                           anim.location.y - disc_c.y)

    # вращение не должно «уводить» кривошип: центр вращающейся группы стоит
    c_mn, c_mx = mesh_bbox(objs_of('crank'))
    c0 = (c_mn + c_mx) * 0.5
    spin_shift = 0.0
    for deg in (37, 90, 143, 180, 251):
        anim.rotation_euler = (0.0, 0.0, math.radians(deg))
        bpy.context.view_layer.update()
        k_mn, k_mx = mesh_bbox(objs_of('crank'))
        spin_shift = max(spin_shift, ((k_mn + k_mx) * 0.5 - c0).length)
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    # ---- ход, амплитуда, длина и посадка шатуна, пересечения -------------
    xs, radii, rod_len, rod_yaw_err, pin_track = [], [], [], [], []
    slide_rot = 0.0
    eye_gap_pin, eye_gap_slide, rod_end_gap = 0.0, 0.0, 0.0
    rod_off_drift = 0.0
    phase_rows = []
    n = 36
    collisions = []
    static_trees = {g: group_tree(g) for g in ('frame', 'drive')}
    pairs = [('crank', 'frame'), ('crank', 'drive'),
             ('rod', 'frame'), ('rod', 'drive'), ('rod', 'crank'),
             ('slider', 'frame'), ('slider', 'drive'),
             ('slider', 'crank'), ('slider', 'rod')]
    overflow = -1.0
    crosshead = bpy.data.objects[P('crosshead')]
    eye_big = bpy.data.objects[P('rod_eye_big')]
    eye_small = bpy.data.objects[P('rod_eye_small')]
    rod_end = bpy.data.objects[P('rod_end')]
    rod_off0 = rod_pivot.location.copy()
    for i in range(n):
        theta = TH0 + math.tau * i / n
        pin, sld = pose(anim, rod_pivot, slide, theta, a0)
        s_mn, s_mx = mesh_bbox([crosshead])
        xs.append((s_mn + s_mx).x * 0.5)
        radii.append((pin - Vector((C.x, C.y))).length)
        pin_track.append((pin.x, pin.y))
        q = crosshead.matrix_world.to_quaternion()
        slide_rot = max(slide_rot, math.degrees(q.angle))
        big = mesh_center(eye_big)
        small = mesh_center(eye_small)
        rod_len.append(math.hypot(small.x - big.x, small.y - big.y))
        eye_gap_pin = max(eye_gap_pin, math.hypot(big.x - pin.x, big.y - pin.y))
        eye_gap_slide = max(eye_gap_slide,
                            math.hypot(small.x - sld.x, small.y - sld.y))
        tgt = rod_end.matrix_world.translation
        rod_end_gap = max(rod_end_gap, math.hypot(tgt.x - small.x,
                                                  tgt.y - small.y))
        rod_off_drift = max(rod_off_drift, (rod_pivot.location - rod_off0).length)
        want = math.atan2(SY0 - pin.y, sld.x - pin.x)
        got = math.atan2(small.y - big.y, small.x - big.x)
        rod_yaw_err.append(abs(math.degrees(wrap_pi(got - want))))
        phase_rows.append({
            'phase_deg': round(math.degrees(theta) % 360, 3),
            'crank_rot_y_deg': round(math.degrees(theta - TH0), 4),
            'pin_m': [round(pin.x, 6), round(pin.y, 6)],
            'slide_x_m': round(sld.x, 6),
            'rod_local_rot_y_deg': round(math.degrees(rod_pivot.rotation_euler.z), 4),
            'rod_yaw_deg': round(math.degrees(got), 4),
        })
        trees = {g: group_tree(g) for g in MOVE_GROUPS}
        for a, b in pairs:
            ta = trees.get(a) or static_trees[a]
            tb = trees.get(b) or static_trees[b]
            hit = ta.overlap(tb)
            if hit:
                collisions.append({'phase_deg': round(math.degrees(theta) % 360, 1),
                                   'pair': f'{a}:{b}', 'faces': len(hit)})
        for g in MOVE_GROUPS:
            g_mn, g_mx = mesh_bbox(objs_of(g))
            overflow = max(overflow, mn.x - g_mn.x, g_mx.x - mx.x,
                           mn.y - g_mn.y, g_mx.y - mx.y,
                           mn.z - g_mn.z, g_mx.z - mx.z)
    stroke = max(xs) - min(xs)
    pose(anim, rod_pivot, slide, TH0, a0)

    s_mn, s_mx = mesh_bbox(objs_of('frame') + objs_of('drive'))
    statics_ok = abs(s_mn.z - mn.z) < 1e-6

    statics = [n_ for g in ('frame', 'drive') for n_ in GROUPS[g]]
    moving = [n_ for g in MOVE_GROUPS for n_ in GROUPS[g]]

    report = {
        'component': CID,
        'title': 'Осциллятор MOT-OSC-05 — открытый кривошипно-ползунный механизм',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_nodes': len([o for o in bpy.data.objects
                           if o.name.startswith(PREFIX) and o.type == 'MESH']),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(x, 5) for x in mn],
        'bbox_max': [round(x, 5) for x in mx],
        'bbox_size': [round(x, 5) for x in size],
        'bbox_center': [round(x, 5) for x in center],
        'bbox_passport': [0.50, 0.30, 0.25],
        'bbox_tolerance': {'x_m': 0.5005, 'y_m': 0.3005, 'z_m': 0.2505,
                           'note': 'паспорт 0.50 x 0.30 x 0.25 плюс 0.5 мм на допуск'},
        'bbox_z_headroom_m': round(0.2505 - size.z, 5),
        'highest_parts': sorted(
            ((round(mesh_bbox([o])[1].z, 4), o.name) for o in all_mesh),
            reverse=True)[:5],
        'bbox_ok': bool(size.x <= 0.5005 and size.y <= 0.3005 and size.z <= 0.2505
                        and size.x > 0.47 and size.y > 0.28),
        'floor_contact_mm': round(mn.z * 1000.0, 3),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),

        'hierarchy': {
            'root_children': [anim.name, slide.name],
            'anim': {'parent': None, 'role': 'crank pivot at disc centre',
                     'children': sorted(o.name for o in anim.children)},
            'rod_pivot': {'parent': rod_pivot.parent.name if rod_pivot.parent else None,
                          'role': 'connecting-rod hinge riding on the crank pin',
                          'local_offset_m': [round(v, 6) for v in rod_pivot.location],
                          'children': sorted(o.name for o in rod_pivot.children)},
            'rod_end': {'parent': rod_end.parent.name if rod_end.parent else None,
                        'role': 'small-eye centre, child of the slider',
                        'local_offset_m': [round(v, 6) for v in rod_end.location]},
            'slide': {'parent': None, 'role': 'slider carriage',
                      'children': sorted(o.name for o in slide.children)},
            'static_root_nodes': sorted(GROUPS['frame'] + GROUPS['drive']),
        },
        'anim_name': anim.name,
        'anim_loc': [round(x, 5) for x in anim.location],
        'anim_axis_blender': 'Z',
        'anim_axis_three': 'Y',
        'anim_children': sorted(o.name for o in anim.children),
        'anim_child_count': len(anim.children),
        'crank_pivot_to_disc_center_mm': round(pivot_off * 1000, 4),
        'crank_spin_bbox_shift_mm': round(spin_shift * 1000, 4),
        'pivot_ok': bool(pivot_off < 0.001 and spin_shift < 0.001),
        'slider_node': slide.name,
        'slider_parent': slide.parent.name if slide.parent else None,
        'rod_node': rod_pivot.name,
        'rod_parent': rod_pivot.parent.name if rod_pivot.parent else None,
        'rod_end_node': rod_end.name,
        'rod_end_parent': rod_end.parent.name if rod_end.parent else None,
        'rod_hinge_on_pin_ok': bool(rod_pivot.parent is anim
                                    and (rod_pivot.location - Vector(
                                        (pin_xy.x - C.x, pin_xy.y - C.y,
                                         (ROD_Z0 + ROD_Z1) * 0.5
                                         - (DISC_Z0 + DISC_Z1) * 0.5))).length
                                    < 1e-6),
        'rod_end_on_slide_ok': bool(rod_end.parent is slide
                                    and rod_end.location.length > 0),

        'stroke_m': round(stroke, 6),
        'stroke_ok': bool(abs(stroke - 2 * R_CRANK) < 5e-4),
        'amplitude_m': round(stroke * 0.5, 6),
        'crank_radius_measured_m': round(sum(radii) / len(radii), 6),
        'slider_x_range': [round(min(xs), 5), round(max(xs), 5)],
        'slider_axis': 'X',
        'slider_rotation_max_deg': round(slide_rot, 6),
        'slider_no_rotation_ok': bool(slide_rot < 1e-4),
        'rod_length_m': round(sum(rod_len) / len(rod_len), 6),
        'rod_length_min_m': round(min(rod_len), 6),
        'rod_length_max_m': round(max(rod_len), 6),
        'rod_length_drift_mm': round((max(rod_len) - min(rod_len)) * 1000, 6),
        'rod_length_ok': bool(max(rod_len) - min(rod_len) < 2e-4),
        'rod_eye_pin_offset_mm': round(eye_gap_pin * 1000, 6),
        'rod_eye_slider_offset_mm': round(eye_gap_slide * 1000, 6),
        'rod_end_marker_offset_mm': round(rod_end_gap * 1000, 6),
        'rod_yaw_vs_formula_max_deg': round(max(rod_yaw_err), 6),
        'rod_hinge_local_drift_mm': round(rod_off_drift * 1000, 6),
        'rod_attached_ok': bool(eye_gap_pin < 2e-4 and eye_gap_slide < 2e-4
                                and rod_end_gap < 2e-4
                                and max(rod_yaw_err) < 0.05
                                and rod_off_drift < 1e-6),
        'rod_tolerance_mm': 0.2,
        'rod_phase_checked': n,
        'rod_moves_ok': bool(max(rod_yaw_err) > 0
                             and (max(rod_len) - min(rod_len)) < 2e-4
                             and max(abs(r['rod_local_rot_y_deg'])
                                     for r in phase_rows) > 1.0),

        'phase_samples': n,
        'phase_table': phase_rows,
        'intersections': collisions,
        'intersection_count': len(collisions),
        'intersections_ok': bool(not collisions),
        'moving_overflow_m': round(max(overflow, 0.0), 6),
        'flying_ok': bool(overflow <= 0.0005),
        'statics_restored': bool(statics_ok),

        'drivers': [
            {'id': 'crank', 'node': P('anim'), 'joint': 'revolute',
             'axis_blender': 'Z', 'axis_three': 'Y',
             'law': 'phase', 'ratio': 1.0,
             'formula': 'rot_Y = phase - 270deg',
             'note': 'node rotation; children = rotating crank parts + rod hinge'},
            {'id': 'rod', 'node': P('rod_pivot'), 'joint': 'revolute',
             'axis_blender': 'Z', 'axis_three': 'Y', 'law': 'link_two_point',
             'formula': ('rot_Y = atan2(SY0 - py, sx - px) - a0 - (phase - TH0); '
                         'position comes from the parent __anim'),
             'note': ('hinge is a child of __anim at the crank pin: translation '
                      'and base yaw are free, only the link angle is driven'),
             'target': P('rod_end')},
            {'id': 'slider', 'node': P('slide'), 'joint': 'prismatic',
             'axis_blender': 'X', 'axis_three': 'X', 'law': 'crank_slider',
             'formula': 'x = R*cos(t) + sqrt(L^2 - (R*sin(t))^2)',
             'note': 'carriage translation only, no rotation'},
        ],

        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'groups': {g: sorted(v) for g, v in GROUPS.items()},
        'moving_parts': sorted(moving),
        'static_parts': sorted(statics),
        'parts': sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX)),
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


def glb_audit(path):
    data = path.read_bytes()
    assert data[:4] == b'glTF', 'not a GLB'
    ln = int.from_bytes(data[12:16], 'little')
    gltf = json.loads(data[20:20 + ln].decode('utf-8'))
    nodes = gltf.get('nodes', [])
    names = [n.get('name', '') for n in nodes]
    idx = {n.get('name'): i for i, n in enumerate(nodes)}

    def kids(name):
        i = idx.get(name)
        if i is None:
            return []
        return sorted(nodes[c].get('name', '') for c in nodes[i].get('children', []))

    def parent_of(name):
        i = idx.get(name)
        for j, n in enumerate(nodes):
            if i is not None and i in n.get('children', []):
                return n.get('name')
        return None

    scene_roots = sorted(names[i] for i in gltf['scenes'][gltf.get('scene', 0)]['nodes'])
    anim = P('anim')
    rod = P('rod_pivot')
    rod_end = P('rod_end')
    slide = P('slide')
    anim_kids = kids(anim)

    def descendants(name):
        out, stack = set(), list(kids(name))
        while stack:
            cur = stack.pop()
            out.add(cur)
            stack.extend(kids(cur))
        return out

    inside = descendants(anim)

    def trs(name):
        i = idx.get(name)
        if i is None:
            return None
        n = nodes[i]
        return {'name': name,
                'translation': [round(v, 6) for v in n.get('translation', [0, 0, 0])],
                'rotation_quat': [round(v, 6) for v in n.get('rotation',
                                                             [0, 0, 0, 1])]}

    return {
        'glb_nodes': len(names),
        'glb_node_names': sorted(names),
        'glb_all_prefixed': bool(all(x.startswith(PREFIX) for x in names)),
        'glb_cameras': len(gltf.get('cameras', [])),
        'glb_lights': len(gltf.get('KHR_lights_punctual', {}).get('lights', [])),
        'glb_has_anim_node': bool(anim in names),
        'glb_has_rod_end_node': bool(rod_end in names),
        'glb_extras_on_objects': bool(any('extras' in n for n in nodes)),
        'glb_meshes': len(gltf.get('meshes', [])),
        'glb_materials': len(gltf.get('materials', [])),
        'glb_rest_trs': {n: trs(n) for n in (anim, rod, rod_end, slide)},
        'glb_hierarchy': {
            'scene_roots_anim_rod_slide': [r for r in scene_roots
                                           if r in (anim, rod, rod_end, slide)],
            'anim_parent': parent_of(anim),
            'rod_parent': parent_of(rod),
            'rod_end_parent': parent_of(rod_end),
            'slide_parent': parent_of(slide),
            'anim_children': anim_kids,
            'rod_children': kids(rod),
            'slide_children': kids(slide),
            'rod_inside_anim': bool(rod in inside),
            'rod_end_inside_slide': bool(rod_end in descendants(slide)),
        },
        'glb_hierarchy_ok': bool(
            parent_of(anim) is None and parent_of(slide) is None
            and parent_of(rod) == anim and parent_of(rod_end) == slide
            and anim in scene_roots and slide in scene_roots
            and rod not in scene_roots and rod_end not in scene_roots
            and rod in anim_kids and slide not in anim_kids
            and rod in inside and rod_end not in inside),
    }


# --- кинематический контракт для рантайма --------------------------------
def runtime_sim(trs, n=36):
    """Проигрывает ровно то, что должен делать three.js-viewer, по числам из
    GLB (Y-up). Никакой геометрии Blender: только узлы + документированные
    формулы. Возвращает максимальные невязки — это и есть доказательство
    пригодности модели для рантайма."""
    anim_t = Vector(trs[P('anim')]['translation'])
    rod_t = Vector(trs[P('rod_pivot')]['translation'])
    end_t = Vector(trs[P('rod_end')]['translation'])
    slide_t = Vector(trs[P('slide')]['translation'])

    # three.js: x -> x, y -> z, z -> -y
    sx0 = slide_t.x
    a0 = math.atan2(SY0 - pin_rest_y(), SX0 - pin_rest_x())
    local_small = Vector((ROD_L * math.cos(a0), 0.0, -ROD_L * math.sin(a0)))
    local_dir = Vector((math.cos(a0), 0.0, -math.sin(a0)))

    worst = {'eye_pin_mm': 0.0, 'eye_slider_mm': 0.0, 'length_mm': 0.0,
             'rod_end_mm': 0.0, 'yaw_deg': 0.0, 'two_point_deg': 0.0,
             'slide_rot_deg': 0.0, 'slide_z_mm': 0.0}
    lens = []
    for i in range(n):
        theta = TH0 + math.tau * i / n
        phi = theta - TH0
        # crank
        animM = Matrix.Translation(anim_t) @ Matrix.Rotation(phi, 4, 'Y')
        # slider (формула из документа)
        sx = C.x + math.sqrt(ROD_L ** 2 - (R_CRANK * math.sin(theta)) ** 2) \
            + R_CRANK * math.cos(theta)
        slideM = Matrix.Translation(slide_t + Vector((sx - sx0, 0.0, 0.0)))
        # rod: closed form
        px = C.x + R_CRANK * math.cos(theta)
        py = C.y + R_CRANK * math.sin(theta)
        yaw = math.atan2(SY0 - py, sx - px)
        rodM = animM @ Matrix.Translation(rod_t) \
            @ Matrix.Rotation(yaw - a0 - phi, 4, 'Y')

        big = rodM.translation.copy()
        small = rodM @ local_small
        pin_w = (animM @ Matrix.Translation(rod_t)).translation
        end_w = (slideM @ Matrix.Translation(end_t)).translation

        worst['eye_pin_mm'] = max(worst['eye_pin_mm'],
                                  (Vector((big.x - pin_w.x, 0, big.z - pin_w.z))).length * 1000)
        worst['eye_slider_mm'] = max(worst['eye_slider_mm'],
                                     (Vector((small.x - end_w.x, 0,
                                              small.z - end_w.z))).length * 1000)
        worst['rod_end_mm'] = max(worst['rod_end_mm'],
                                  (small - end_w).length * 1000)
        lens.append((small - big).length)
        # направление звена в мире: локальная ось шатуна испечена под a0,
        # поэтому берём именно этот вектор, а не ось X узла
        dir3 = rodM.to_3x3() @ local_dir
        got = math.atan2(-dir3.z, dir3.x)
        worst['yaw_deg'] = max(worst['yaw_deg'],
                               abs(math.degrees(wrap_pi(got - yaw))))
        # two-point вариант: целиться из шарнира в __rod_end
        d = end_w - big
        yaw2 = math.atan2(-d.z, d.x)
        worst['two_point_deg'] = max(worst['two_point_deg'],
                                     abs(math.degrees(wrap_pi(yaw2 - yaw))))
        q = slideM.to_quaternion()
        worst['slide_rot_deg'] = max(worst['slide_rot_deg'],
                                     math.degrees(q.angle))
        worst['slide_z_mm'] = max(worst['slide_z_mm'],
                                  abs(end_w.z - small.z) * 1000)
    worst['length_mm'] = (max(lens) - min(lens)) * 1000
    worst['length_mean_m'] = sum(lens) / len(lens)
    return {k: round(v, 6) for k, v in worst.items()}


def pin_rest_x():
    return C.x + R_CRANK * math.cos(TH0)


def pin_rest_y():
    return C.y + R_CRANK * math.sin(TH0)


def build_kinematics(rep):
    """Единый JSON-контракт шатуна для рантайма (three.js, Y-up)."""
    trs = rep['glb_rest_trs']
    a0 = math.atan2(SY0 - pin_rest_y(), SX0 - pin_rest_x())
    sim = runtime_sim(trs)
    sim_blender = {
        'eye_pin_mm': rep['rod_eye_pin_offset_mm'],
        'eye_slider_mm': rep['rod_eye_slider_offset_mm'],
        'length_drift_mm': rep['rod_length_drift_mm'],
        'yaw_deg': rep['rod_yaw_vs_formula_max_deg'],
        'samples': rep['rod_phase_checked'],
    }
    nodes = {}
    node_parent = {
        'crank': None,
        'rod': rep['rod_parent'],
        'rod_end': rep['rod_end_parent'],
        'slider': rep['slider_parent'],
    }
    for key, name, role in (
            ('crank', P('anim'), 'кривошип: вращение вокруг Y в центре плиты'),
            ('rod', P('rod_pivot'), 'шарнир шатуна, дитя __anim, сидит на пальце'),
            ('rod_end', P('rod_end'), 'центр малой проушины, дитя __slide'),
            ('slider', P('slide'), 'каретка ползуна, призматика по X')):
        nodes[key] = {
            'name': name,
            'parent': node_parent[key],
            'role': role,
            'rest_translation_m': trs[name]['translation'],
            'rest_rotation_quat_xyzw': trs[name]['rotation_quat'],
        }
    json_doc = {
        'schema': 'cj-kinematics-oscillating/2',
        'component': CID,
        'code': 'MOT-OSC-05',
        'model': 'public/models/machine-modules/components/motion_oscillating.glb',
        'generated_by': 'docs/plans/tools/build_motion_oscillating.py',
        'units': {'length': 'm', 'angle': 'rad'},
        'coordinate_system': {
            'engine': 'three.js',
            'up': '+Y',
            'handedness': 'right',
            'axis_mapping': 'x_gltf = x_blender, y_gltf = z_blender, z_gltf = -y_blender',
            'note': ('все числа ниже — уже в системе GLB (Y-up). Blender-координаты '
                     'в отчёте получаются обратным отображением: '
                     'x_b = x, y_b = -z, z_b = y'),
        },
        'mechanism': 'crank-slider (кривошип-ползун), 1 DOF',
        'motion_plane': {
            'plane': 'XZ модели',
            'angle_reference': ('угол кривошипа theta отсчитывается от +X к -Z '
                                '(в Blender это +X к +Y), поэтому точка пальца: '
                                'p = (C.x + R cos theta, *, C.z - R sin theta)'),
            'note': 'C.z = -C.y(Blender); линия ползуна z = C.z = 0.012',
        },
        'geometry': {
            'crank_center_m': [round(C.x, 6), round((DISC_Z0 + DISC_Z1) * 0.5, 6),
                               round(-C.y, 6)],
            'crank_radius_m': R_CRANK,
            'rod_length_m': ROD_L,
            'rod_rest_yaw_deg': round(math.degrees(a0), 6),
            'rod_rest_yaw_rad': round(a0, 9),
            'pin_radius_m': PIN_R,
            'eye_bore_m': EYE_RI,
            'slider_line_m': {'z': round(-SY0, 6), 'y': round(RAIL_Z, 6)},
            'slider_x_rest_m': round(SX0, 6),
            'slider_x_range_m': rep['slider_x_range'],
            'stroke_m': rep['stroke_m'],
            'rod_local_small_eye_m': [round(ROD_L * math.cos(a0), 6), 0.0,
                                      round(-ROD_L * math.sin(a0), 6)],
            'rod_local_big_eye_m': [0.0, 0.0, 0.0],
        },
        'nodes': nodes,
        'phase': {
            'parameter': 'phase',
            'range_rad': [0.0, round(math.tau, 9)],
            'wrap': True,
            'rest_phase_rad': round(TH0, 9),
            'rest_phase_deg': 270.0,
            'viewer_phase_law': 'phase = PI * (1 - cos(t * speed))  // как в components-viewer.js',
            'crank_offset_rad': round(TH0, 9),
            'note': ('рабочая фаза 270° — палец смотрит вперёд (-Y Blender); '
                     'все формулы используют theta = phase'),
        },
        'drivers': [
            {
                'id': 'crank', 'node': P('anim'), 'joint': 'revolute',
                'axis': 'y', 'law': 'phase', 'ratio': 1.0,
                'offset_rad': round(TH0, 9),
                'target_property': 'rotation.y',
                'formula': 'anim.rotation.y = phase - TH0',
                'critical': ('поворот должен применяться к самому узлу __anim. '
                             'Текущая ветка components-viewer.js для joint=revolute '
                             'создаёт Group в bbox-центре members и attach()-ит '
                             'меши — это НЕ этот узел и не эта ось.'),
            },
            {
                'id': 'rod', 'node': P('rod_pivot'), 'joint': 'revolute',
                'axis': 'y', 'law': 'link_two_point',
                'target_node': P('rod_end'),
                'target_property': 'rotation.y',
                'position_source': 'parent __anim (иерархия; в рантайме не трогать)',
                'formula_closed': (
                    'theta = phase; '
                    'px = C.x + R*cos(theta); pz = C.z - R*sin(theta); '
                    'sx = C.x + R*cos(theta) + sqrt(L^2 - (R*sin(theta))^2); '
                    'rod.rotation.y = atan2(pz - C.z, sx - px) - a0 - (phase - TH0) '
                    '// C = [-0.15, 0.129, 0.012], R = 0.02, L = 0.204, '
                    'a0 = 0.09819695 rad, TH0 = 4.71238898 rad'),
                'formula_two_point': (
                    'p = rod.getWorldPosition(); t = rod_end.getWorldPosition(); '
                    'd = t - p; rod.rotation.y = atan2(-d.z, d.x) - (phase - TH0)'),
                'note': ('two_point не требует знать R/L/C и устойчив к любой '
                         'реализации ползуна, но требует, чтобы __rod_end стоял '
                         'ровно в центре малой проушины (он там и стоит). '
                         'Поправка -(phase - TH0) нужна, потому что узел — дитя '
                         'вращающегося __anim.'),
            },
            {
                'id': 'slider', 'node': P('slide'), 'joint': 'prismatic',
                'axis': 'x', 'law': 'crank_slider_full',
                'target_property': 'position.x',
                'base_x_m': round(SX0, 6),
                'formula': ('slide.position.x = SX0 + R*cos(theta) + '
                            'sqrt(L^2 - (R*sin(theta))^2) - sqrt(L^2 - R^2)'),
                'warning': ('нынешний закон crank_slider в components-viewer.js '
                            'возвращает R*sin(phase) — это НЕ ход кривошипно-'
                            'ползунного механизма, амплитуда и форма неверные.'),
            },
        ],
        'tolerances': {
            'eye_to_pin_m': 0.0002,
            'eye_to_slider_m': 0.0002,
            'rod_length_drift_m': 0.0002,
            'rod_yaw_deg': 0.05,
            'slide_rotation_deg': 0.001,
            'note': '0.2 мм на посадку и постоянство длины — как в задании',
        },
        'verification': {
            'method': ('1) Blender: 36 фаз, поза считается формулой, центры проушин '
                       'берутся как среднее вершин втулок; '
                       '2) runtime_sim: те же 36 фаз считаются из rest-трансформов '
                       'GLB по формулам этого файла (three.js math), без сцены Blender'),
            'samples': rep['rod_phase_checked'],
            'blender': sim_blender,
            'runtime_sim': sim,
            'rod_swing_deg': round(max(r['rod_yaw_deg'] for r in rep['phase_table'])
                                   - min(r['rod_yaw_deg'] for r in rep['phase_table']), 4),
            'rest_pose': ('в GLB записана поза theta = 270 deg: anim.rotation.y = 0, '
                          'rod_pivot.rotation.y = 0, slide.position.x = 0; '
                          'все формулы отсчитываются от неё'),
            'ok': bool(sim['eye_pin_mm'] < 0.2 and sim['eye_slider_mm'] < 0.2
                       and sim['length_mm'] < 0.2 and sim['yaw_deg'] < 0.05
                       and sim['two_point_deg'] < 0.05
                       and sim['slide_rot_deg'] < 0.001
                       and rep['rod_attached_ok'] and rep['intersections_ok']),
        },
        'phase_table': rep['phase_table'],
        'viewer_integration': {
            'status': 'модель и данные готовы; код components-viewer.js НЕ менялся',
            'required': [
                'Ветка joint=revolute должна вращать сам узел d.node вокруг d.axis '
                '(rotation.y), а не создавать Group в bbox-центре members.',
                'Заменить закон crank_slider на формулу из drivers[slider].formula '
                '(позиция относительно base_x_m).',
                'Добавить драйвер шатуна: law=link_two_point (или formula_closed) '
                'и писать результат в rod.rotation.y; position шатуна не трогать.',
                'Проверять невязки по tolerances: big eye <-> pin, small eye <-> '
                '__rod_end, длина звена постоянна.',
            ],
            'blocked_by': [
                'component-catalog.json / component-models.json / '
                'component-contracts.json / components.html / '
                'components-viewer.js не входят в скоуп этой задачи — их правка '
                'осталась за владельцем каталога.',
                'В component-contracts.json у motion_oscillating нет драйвера шатуна '
                '(только crank и slider) — контракт нужно дополнить из этого файла.',
            ],
        },
        'acceptance': {
            'big_eye_on_pin_mm': rep['rod_eye_pin_offset_mm'],
            'small_eye_on_slider_mm': rep['rod_eye_slider_offset_mm'],
            'rod_length_drift_mm': rep['rod_length_drift_mm'],
            'rod_yaw_vs_formula_deg': rep['rod_yaw_vs_formula_max_deg'],
            'slide_rotation_deg': rep['slider_rotation_max_deg'],
            'intersections': rep['intersection_count'],
            'phases': rep['rod_phase_checked'],
        },
    }
    return json_doc, sim


# --- рендеры -------------------------------------------------------------
def render_views(pose_fn=None):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.26
    try:
        scene.eevee.taa_render_samples = 96
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.655, 0.650, 0.642, 1.0)
    bg.inputs['Strength'].default_value = 0.38

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3, location=(center.x, center.y,
                                                       mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.560, 0.556, 0.548, 1.0)
    nb.inputs['Roughness'].default_value = 0.95
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.36, -0.48, 0.62), 6.60, 0.50),
            ('fill', (-0.62, -0.42, 0.30), 2.60, 0.62),
            ('rim', (0.10, 0.58, 0.46), 3.40, 0.48)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.55))
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
        return [Vector((x, y, z)) for x in (a.x, b.x) for y in (a.y, b.y)
                for z in (a.z, b.z)]

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc():
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    c_main = box_corners(mn - center, mx - center)
    # крупный план: плита с пазом, палец, шатун, ползун на направляющих
    close_t = Vector((-0.046, -0.020, 0.138))
    c_close = box_corners(Vector((-0.214, -0.082, 0.104)) - close_t,
                          Vector((0.098, 0.048, 0.184)) - close_t)

    views = [
        # tag, direction, target, lens, corners, fill (None = без автофита)
        ('3q', (0.74, -0.70, 0.46), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('front', (0.05, -1.00, 0.28), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('side', (1.00, -0.08, 0.18), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('closeup', (0.40, -0.88, 0.44), close_t, 88, c_close, None),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        # closeup снимаем не в покое, а в рабочей фазе: по нему видно, что
        # шатун реально наклонён и оба уха сидят на своих пальцах
        if tag == 'closeup' and pose_fn is not None:
            pose_fn(TH0 + math.radians(90.0))
            bpy.context.view_layer.update()
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners, 1.02 if fill is None else 1.12)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if fill is not None:
            for _ in range(4):
                got = max_ndc()
                if abs(got - fill) < 0.02:
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
        print(f'RENDERED {tag} dist={dist:.3f} {fp}', flush=True)
    return outs


def main():
    anim, rod_pivot, slide, pin_xy, a0 = build()
    rep = check(anim, rod_pivot, slide, pin_xy, a0)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep.update(glb_audit(path))
    kin, sim = build_kinematics(rep)
    kin_path = HERE / 'kinematics_oscillating.json'
    kin_path.write_text(json.dumps(kin, ensure_ascii=False, indent=2),
                        encoding='utf-8')
    rep['kinematics_json'] = str(kin_path.relative_to(PROJECT))
    rep['kinematics_schema'] = kin['schema']
    rep['kinematics_runtime_sim'] = sim
    rep['kinematics_ok'] = kin['verification']['ok']
    rep['renders'] = render_views(lambda th: pose(anim, rod_pivot, slide, th, a0))
    pose(anim, rod_pivot, slide, TH0, a0)
    rep['envelope'] = {
        'passport_m': [0.50, 0.30, 0.25],
        'measured_m': [round(v, 5) for v in rep['bbox_size']],
        'tolerance_m': [0.5005, 0.3005, 0.2505],
        'headroom_z_m': rep['bbox_z_headroom_m'],
        'ok': rep['bbox_ok'],
    }
    rep['runtime_notes'] = [
        'GLB экспортирован Y-up: ось кривошипа в three.js — +Y (в Blender +Z).',
        'Драйвер кривошипа: вращать сам узел __anim вокруг Y на (phase - 270deg). '
        'НЕ через bbox-группу: нынешняя revolute-ветка components-viewer.js '
        'строит Group в bbox-центре members и attach()-ит меши — для этого '
        'компонента это даёт качание вокруг неверной оси.',
        'Драйвер шатуна: __rod_pivot — дитя __anim, локальный сдвиг '
        '= радиус кривошипа (0, -0.020, 0.033) Blender / (0, 0.033, 0.020) glTF. '
        'Позицию в рантайме НЕ трогать; писать только rotation.y '
        '= atan2(SY0-py, sx-px) - a0 - (phase - TH0), a0 = 5.626 град.',
        'Драйвер ползуна: __slide, призматика по X, без поворота '
        '(замер: 0 градусов на 36 фазах). Формула полная: '
        'x = SX0 + R cos t + sqrt(L^2 - (R sin t)^2) - sqrt(L^2 - R^2). '
        'Закон crank_slider в components-viewer.js (R*sin(phase)) неверен по форме.',
        'Маркер __rod_end — дитя __slide в центре малой проушины: позволяет '
        'считать угол two-point (getWorldPosition обоих узлов), не зная R/L/C.',
        'Осталось в viewer (код не менялся, вне скоупа): 1) revolute-драйвер '
        'должен крутить узел, а не bbox-группу; 2) заменить закон crank_slider; '
        '3) добавить драйвер шатуна по kinematics_oscillating.json; '
        '4) в component-contracts.json / component-catalog.json нет драйвера '
        'шатуна и нет узла rod_end — контракт и каталог дополнить из JSON.',
    ]
    rep['notes'] = [
        'Шатун перестал быть статичной деталью: его шарнир — дитя __anim и сидит '
        'ровно на пальце кривошипа, поэтому большое ухо едет по окружности '
        'вместе с пальцем при любом повороте кривошипа, а не отстаёт от него.',
        'Геометрия шатуна не менялась: те же ROD_L 0.204, проушины, болты. '
        'Перепеклись только трансформы (родитель + локальный сдвиг), '
        'вершины в мировых координатах в позе 270 град остались прежними.',
        'Проверено на 36 фазах: невязка большого уха к пальцу 0.000 мм, '
        'малого уха к ползуну 0.000 мм, дрейф длины шатуна 0.000 мм; '
        'поворот ползуна 0 градусов; пересечений нет.',
        'Отдельный маркер __rod_end (дитя __slide) добавлен в GLB, чтобы рантайм '
        'мог решать угол шатуна two-point способом без констант механизма.',
        'Числа кинематики выгружены в docs/plans/tools/kinematics_oscillating.json '
        'и продублированы в отчёте — это контракт для правки viewer.',
        'closeup снят в фазе 0 град (кривошип довёрнут на 90 град от рабочей), '
        'остальные три ракурса — в покое 270 град, как раньше.',
        'Плита кривошипа — плоский цилиндр 128 граней с плоской фаской 1.2 мм, '
        'shading плоский (smooth выключен), материал steel_matte (metallic 0.14, '
        'roughness 0.78) — блик среды больше не рисует «вогнутую чашу».',
        'Корпус-кожух убран: вместо глухого редукторного бокса — компактный '
        'мотор-редуктор на опорной плите на двух поперечинах; кривошип '
        'и шатун полностью открыты.',
        'Кинематика: ход 0.040 м = 2 x R 0.020; 36 фаз без пересечений; '
        'рама/привод восстанавливаются в исходной позе.',
    ]
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(
        {k: rep[k] for k in ('nodes', 'mesh_nodes', 'bbox_size', 'pivot_ok',
                             'stroke_m', 'amplitude_m', 'intersection_count',
                             'slider_rotation_max_deg', 'rod_length_ok',
                             'rod_attached_ok', 'rod_moves_ok',
                             'rod_eye_pin_offset_mm', 'rod_eye_slider_offset_mm',
                             'rod_length_drift_mm', 'kinematics_ok',
                             'moving_overflow_m', 'glb_bytes',
                             'glb_hierarchy_ok')},
        ensure_ascii=False), flush=True)
    ok = (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['pivot_ok']
          and rep['stroke_ok'] and rep['rod_length_ok'] and rep['rod_attached_ok']
          and rep['rod_moves_ok'] and rep['kinematics_ok']
          and rep['rod_hinge_on_pin_ok'] and rep['rod_end_on_slide_ok']
          and rep['intersections_ok'] and rep['flying_ok']
          and rep['slider_no_rotation_ok'] and rep['glb_hierarchy_ok']
          and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
          and rep['glb_all_prefixed'] and rep['glb_cameras'] == 0
          and rep['glb_lights'] == 0 and rep['statics_restored']
          and rep['glb_has_rod_end_node'])
    if not ok:
        raise SystemExit('checks failed')


main()
