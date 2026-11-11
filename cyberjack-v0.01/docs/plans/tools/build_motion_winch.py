"""Standalone builder: motion_winch (MOT-WIN-07, «Лебёдка») — v3.

Ключевое отличие от v2: навивка собрана из 12 ОТДЕЛЬНЫХ витков
(rope_turn_00 … rope_turn_11), которые при выпуске ветви последовательно
скрываются, а при втягивании появляются. Витки — по одному обороту спирали
на барабане (шаг 0,0098 м), передний виток turn_00 заканчивается ровно в
точке схода, откуда вертикально вниз уходит ветвь rope_branch (0 … 0,30 м).

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_motion_winch.py

Выход:
  public/models/machine-modules/components/motion_winch.glb
  docs/plans/blockout/component-library/motion_winch/*.png + report.json

Геометрия (Blender Z-up, метры):
  ось барабана        = X, линия y=0, z=Z0 = 0,032
  anim-пустышка       = (0, 0, Z0); её ребёнок __drum — группа вращения,
                        в ней бочка, фланцы, рёбра, болты, метки, вал и витки
  виток i             = 1 оборот спирали, x ∈ [X_EXIT-(i+1)p, X_EXIT-i*p],
                        центр трубы на радиусе COIL_R = 0,0592
  точка схода         = (X_EXIT, -COIL_R, Z0) — передний конец turn_00,
                        касательная там вертикальна => ветвь висит вниз
  rope_payout         = пустышка в точке схода (не вращается)
    rope_branch       = труба длиной 1,0 м по локальной -Z, масштабируется
    rope_end          = пустышка на конце ветви, несёт крюковую подвеску

Кинематика:
  L = θ · COIL_R, θ(L) = (L - 0,30) / 0,0592  (θ=0 в состоянии L=0,30 = GLB).
  Положительное приращение θ (вращение вокруг +X) = ВЫПУСК (ветвь уходит
  вниз), отрицательное = НАМОТКА. Один оборот барабана = 0,37196 м троса.

Схема видимости витков (визуальное кодирование намотки):
  виток i виден, пока L < L_hide(i),  L_hide(i) = 0,05 + (12 - i) · 0,03125
  => L=0,05: 12 витков, L=0,18: 8 витков, L=0,30: 4 витка.
  Шаг 0,03125 м выбран, чтобы намотка читалась на ходе 0,25 м (физически
  один оборот барабана = 0,372 м, т.е. «физически» на этом ходе сходит
  менее одного витка — поэтому витки и есть визуальный индекс навивки).

three.js после export_yup=True: ось барабана остаётся X; локальная Z ветви
смотрит вниз, поэтому scale.z = L работает без правок.
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_winch'
CID = 'motion_winch'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.032                    # высота оси барабана

DRUM_X0, DRUM_X1 = -0.076, 0.076      # бочка барабана (0.152)
DRUM_R = 0.054
FL_T = 0.016                          # толщина реборды
FL_X0 = DRUM_X0 - FL_T                # -0.092
FL_R = 0.070

CHEEK_X = 0.113               # внешняя плоскость щеки
CHEEK_T = 0.014
CHEEK_Y = 0.098               # полуглубина щеки
CHEEK_Z0 = -0.048
CHEEK_Z1 = 0.118

BEAM_Y = 0.058                # оси поперечных траверс рамы
BEAM_Z0, BEAM_Z1 = 0.104, 0.120
RAIL_X = (0.086, 0.102)               # стенка рельса
RAIL_Z0, RAIL_Z1 = 0.120, 0.144
CAP_X = (0.073, 0.115)                # полка рельса
CAP_Z0, CAP_Z1 = 0.144, 0.150
RAIL_Y = 0.150

# --- навивка и выпуск ----------------------------------------------------
ROPE_R = 0.0046               # радиус троса (Ø9,2 мм)
COIL_R = 0.0592               # радиус осевой линии навивки
TURN_PITCH = 0.0098           # шаг витка (осевой ход за оборот)
TURN_GAP = 0.0000             # осевой зазор между витками (срез идёт по углу)
SEAM_GAP_RAD = 0.014          # угловой зазор стыка витков (~0,83 мм дуги)
N_TURNS = 12                  # всего витков в модели
X_EXIT = 0.0480               # передняя плоскость навивки = точка схода (X)
X_START = X_EXIT - N_TURNS * TURN_PITCH        # -0.0696 (задний виток)
R_END = COIL_R                # ветвь висит по y = -COIL_R
PAYOUT_MIN = 0.050            # втянуто (все 12 витков)
PAYOUT_MID = 0.180            # середина хода
PAYOUT_MAX = 0.300            # полный выпуск (паспортное состояние, GLB)
TURNS_MIN = 4                 # сколько витков остаётся при L = 0,30
WIND_STEP = (PAYOUT_MAX - PAYOUT_MIN) / (N_TURNS - TURNS_MIN)   # 0,03125
HOOK_H = 0.0821               # высота крюковой подвески
BBOX_TOP = 0.150
BBOX_MIN_Z = -0.3501

# --- свободный конец троса: клин-коуш-шакл-крюк ---------------------------
# Порядок сверху вниз = порядок сборки; все узлы — дети rope_end.
FE_PARTS = (
    'rope_end_stub',          # трос внутри гнезда
    'wedge_socket_body',      # корпус клиновой заделки
    'wedge_socket_wedge',     # клин
    'wedge_socket_pin',       # стопорный штифт
    'wedge_socket_nut',       # гайка штифта
    'wedge_socket_eye',       # проушина корпуса
    'shackle_bow',            # скоба: щёки + дуга + проушина (поковка)
    'shackle_thimble',        # коуш в проушине скобы
    'shackle_pin',            # палец скобы
    'shackle_nut',            # гайка пальца
    'shackle_cotter',         # шплинт
    'hook_clevis',            # вилка крюка
    'hook_pin',               # палец крюка
    'hook_nut',               # гайка пальца крюка
    'hook',                   # крюк с зевом
    'hook_latch',             # предохранительная защёлка
    'hook_latch_pin',         # ось защёлки
)

FE_ROLES = {
    'rope_end_stub': 'трос в конусном гнезде, обрыв внутри заделки',
    'wedge_socket_body': 'корпус клиновой заделки с конусным гнездом',
    'wedge_socket_wedge': 'клин, забитый вдоль троса, выступает над торцом',
    'wedge_socket_pin': 'стопорный штифт под клином (с головкой)',
    'wedge_socket_nut': 'гайка стопорного штифта',
    'wedge_socket_eye': 'проушина корпуса (ось отверстия X)',
    'shackle_bow': 'скоба: щёки под палец, дуга, проушина — одна поковка',
    'shackle_thimble': 'коуш: подковообразная втулка в проушине скобы',
    'shackle_pin': 'палец скобы (ось X) с головкой',
    'shackle_nut': 'гайка пальца скобы',
    'shackle_cotter': 'шплинт пальца скобы',
    'hook_clevis': 'вилка крюка: щёки по Y + мост',
    'hook_pin': 'палец крюка (ось Y) с головкой',
    'hook_nut': 'гайка пальца крюка',
    'hook': 'крюк: шейка, спина, зев, загнутый носок',
    'hook_latch': 'предохранительная защёлка зева',
    'hook_latch_pin': 'ось защёлки',
}

# расчётные контакты внутри концевой сборки (шарниры и сварные соединения);
# всё, что НЕ перечислено здесь, считается настоящим пересечением
FE_JOINTS = (
    frozenset(('rope_branch', 'rope_end_stub')),
    frozenset(('wedge_socket_body', 'wedge_socket_eye')),
    frozenset(('wedge_socket_body', 'wedge_socket_pin')),
    frozenset(('wedge_socket_pin', 'wedge_socket_nut')),
    frozenset(('wedge_socket_eye', 'shackle_pin')),
    frozenset(('shackle_bow', 'shackle_pin')),
    frozenset(('shackle_pin', 'shackle_nut')),
    frozenset(('shackle_pin', 'shackle_cotter')),
    frozenset(('shackle_bow', 'shackle_thimble')),
    frozenset(('shackle_thimble', 'hook_pin')),
    frozenset(('hook_clevis', 'hook_pin')),
    frozenset(('hook_pin', 'hook_nut')),
    frozenset(('hook_clevis', 'hook')),
    frozenset(('hook', 'hook_latch')),
    frozenset(('hook_latch', 'hook_latch_pin')),
    frozenset(('hook', 'hook_pin')),
)

ROPE_Y = -R_END
# торец трубы витка (curve-bevel) не доходит до последней точки ~0,8 мм,
# поэтому ветвь стыкуется с торцом приподнятой на TAKEOFF_LIFT
TAKEOFF_LIFT = 0.0008
Z_BRANCH = Z0 + TAKEOFF_LIFT
ROPE_END_Z = Z_BRANCH - PAYOUT_MAX
ROLLER_Y, ROLLER_Z, ROLLER_R = -0.0870, -0.026, 0.012

GEAR_X0, GEAR_X1 = 0.113, 0.150
GEAR_Y, GEAR_Z = 0.054, 0.054
MOTOR_X0, MOTOR_X1 = 0.150, 0.196
MOTOR_R = 0.042
CAP_X1 = 0.200

PALETTE = {
    'graphite': (0.214, 0.224, 0.240),
    'steel': (0.762, 0.767, 0.756),
    'dark': (0.104, 0.110, 0.122),
    'yellow': (0.935, 0.700, 0.055),
    'red': (0.690, 0.100, 0.070),
    'cyan': (0.640, 0.905, 0.935),
    'rope': (0.700, 0.688, 0.640),
}
METAL = {'graphite': 0.35, 'steel': 0.90, 'dark': 0.55, 'rope': 0.85}
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
    bsdf.inputs['Roughness'].default_value = 0.72 if role not in ('steel', 'rope') else (
        0.40 if role == 'steel' else 0.62)
    bsdf.inputs['Metallic'].default_value = METAL.get(role, 0.0)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.60
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


def cyl(name, a, b, radius, role, vertices=32, smooth=True, r2=None, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                            depth=d.length, location=(a + b) * 0.5)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius,
                                        radius2=r2, depth=d.length,
                                        location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=40, rings=10):
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


def curve_tube(name, points, radius, role, res=8, resu=12):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    cu.resolution_u = resu
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
    return bpy.context.object


def poly_tube(name, points, radius, role, res=3, cyclic=False):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
    sp.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def plate_yz(name, x0, x1, pts, role, bev=0.0035):
    """Пластина постоянной толщины по контуру в плоскости YZ."""
    bm = bmesh.new()
    va = [bm.verts.new((x0, y, z)) for y, z in pts]
    vb = [bm.verts.new((x1, y, z)) for y, z in pts]
    bm.faces.new(va)
    bm.faces.new(list(reversed(vb)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((va[i], va[j], vb[j], vb[i]))
    obj = mesh_from_bm(name, bm, role, smooth=False)
    select_only(obj)
    bevel(obj, bev, 2)
    return obj



def plate_xz_bm(bm, y0, y1, pts):
    """Пластина постоянной толщины по контуру в плоскости XZ (в bmesh)."""
    n = len(pts)
    va = [bm.verts.new((x, y0, z)) for x, z in pts]
    vb = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(va)
    bm.faces.new(list(reversed(vb)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((va[i], va[j], vb[j], vb[i]))


def plate_xz(name, y0, y1, pts, role, bev=0.0012, smooth=False):
    bm = bmesh.new()
    plate_xz_bm(bm, y0, y1, pts)
    obj = mesh_from_bm(name, bm, role, smooth)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, 2)
    return obj


def sweep(name, pts, r, role, seg=16, closed=False, smooth=True):
    """Труба постоянного радиуса по ломаной (без бугров на стыках).

    Контур считается плоским в XZ, поэтому опорная ось кольца — Y.
    """
    P = [Vector(p) for p in pts]
    n = len(P)
    bm = bmesh.new()
    rings = []
    YAX = Vector((0.0, 1.0, 0.0))
    for i in range(n):
        if closed:
            t = P[(i + 1) % n] - P[(i - 1) % n]
        elif i == 0:
            t = P[1] - P[0]
        elif i == n - 1:
            t = P[-1] - P[-2]
        else:
            t = P[i + 1] - P[i - 1]
        t.normalize()
        side = YAX - t * t.dot(YAX)
        if side.length < 1e-6:
            side = Vector((1.0, 0.0, 0.0)) - t * t.x
        side.normalize()
        nrm = t.cross(side).normalized()
        ring = []
        for k in range(seg):
            a = math.tau * k / seg
            ring.append(bm.verts.new(P[i] + side * (math.cos(a) * r)
                                     + nrm * (math.sin(a) * r)))
        rings.append(ring)
    cnt = n if closed else n - 1
    for i in range(cnt):
        A, B = rings[i], rings[(i + 1) % n]
        for k in range(seg):
            bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))
    if not closed:
        bm.faces.new(list(reversed(rings[0])))
        bm.faces.new(rings[-1])
    return mesh_from_bm(name, bm, role, smooth)


def join(objs, name):
    """Слить несколько тел в один узел (поковка/сварная деталь)."""
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    ob = bpy.context.object
    ob.name = name
    return ob


def boolean_cut(obj, cutters):
    for cut in cutters:
        mod = obj.modifiers.new('cut', 'BOOLEAN')
        mod.operation = 'DIFFERENCE'
        mod.object = cut
        try:
            mod.solver = 'EXACT'
        except Exception:
            pass
        select_only(obj)
        bpy.ops.object.modifier_apply(modifier=mod.name)
        bpy.data.objects.remove(cut, do_unlink=True)
    return obj


def hole_cyl(x, y, z, r=0.026, verts=28):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=0.08,
                                        location=(x, y, z),
                                        rotation=(0, math.pi / 2, 0))
    return bpy.context.object


def ring_bolts(name, x0, x1, radius, count, r=0.0042, role='steel',
               phase=0.0, z=Z0):
    bm = bmesh.new()
    for i in range(count):
        a = phase + math.tau * i / count
        c = Vector(((x0 + x1) * 0.5, math.sin(a) * radius, z + math.cos(a) * radius))
        m = Matrix.Translation(c) @ Matrix.Rotation(math.pi / 2, 4, 'Y')
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=8,
                              radius1=r, radius2=r, depth=(x1 - x0), matrix=m)
    return mesh_from_bm(name, bm, role)


def ratchet_wheel(name, x0, x1, r_body, r_tip, teeth, role):
    bm = bmesh.new()
    m = (Matrix.Translation(Vector(((x0 + x1) * 0.5, 0.0, Z0)))
         @ Matrix.Rotation(math.pi / 2, 4, 'Y'))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=48,
                          radius1=r_body, radius2=r_body, depth=(x1 - x0), matrix=m)
    for i in range(teeth):
        a = math.tau * i / teeth
        rt = (r_body + r_tip) * 0.5
        c = Vector(((x0 + x1) * 0.5, math.sin(a) * rt, Z0 + math.cos(a) * rt))
        mm = (Matrix.Translation(c) @ Matrix.Rotation(a, 4, 'X')
              @ Matrix.Diagonal((x1 - x0, r_tip - r_body + 0.006, 0.010, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=mm)
    return mesh_from_bm(name, bm, role)


def ring_sector(name, x0, x1, r0, r1, a0, a1, role, seg=18):
    """Плоский сектор кольца в плоскости YZ (маркировка на реборде)."""
    bm = bmesh.new()
    inner_a, outer_a, inner_b, outer_b = [], [], [], []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        sy, cz = math.sin(a), math.cos(a)
        inner_a.append(bm.verts.new((x0, sy * r0, Z0 + cz * r0)))
        outer_a.append(bm.verts.new((x0, sy * r1, Z0 + cz * r1)))
        inner_b.append(bm.verts.new((x1, sy * r0, Z0 + cz * r0)))
        outer_b.append(bm.verts.new((x1, sy * r1, Z0 + cz * r1)))
    for i in range(seg):
        bm.faces.new((inner_a[i], outer_a[i], outer_a[i + 1], inner_a[i + 1]))
        bm.faces.new((inner_b[i], inner_b[i + 1], outer_b[i + 1], outer_b[i]))
        bm.faces.new((outer_a[i], outer_b[i], outer_b[i + 1], outer_a[i + 1]))
        bm.faces.new((inner_a[i], inner_a[i + 1], inner_b[i + 1], inner_b[i]))
    bm.faces.new((inner_a[0], inner_b[0], outer_b[0], outer_a[0]))
    bm.faces.new((inner_a[-1], outer_a[-1], outer_b[-1], inner_b[-1]))
    return mesh_from_bm(name, bm, role, smooth=False)


def empty(name, loc, display='ARROWS'):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = display
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def cyl_bm(bm, a, b, r, seg=24):
    """Цилиндр в bmesh между точками a и b (для сварки нескольких тел в один)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                          radius1=r, radius2=r, depth=d.length, matrix=m)


def bore(obj, a, b, r, verts=28, pad=0.004):
    """Сквозное отверстие цилиндрическим вырезом (EXACT boolean)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r,
                                        depth=d.length + pad,
                                        location=(a + b) * 0.5)
    cut = bpy.context.object
    cut.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return boolean_cut(obj, [cut])


def revolve(name, profile, role, cx, cy, cz, seg=40, smooth=True):
    """Тело вращения вокруг вертикальной оси (cx, cy).

    profile — ЗАМКНУТЫЙ контур [(r, z), …] в полуплоскости r>=0; последняя
    точка соединяется с первой, поэтому и наружная стенка, и гнездо
    получаются одной оболочкой без булевых операций. r=0 — полюс.
    """
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r < 1e-6:
            rings.append([bm.verts.new((cx, cy, cz + z))])
            continue
        ring = []
        for i in range(seg):
            a = math.tau * i / seg
            ring.append(bm.verts.new((cx + math.cos(a) * r,
                                      cy + math.sin(a) * r, cz + z)))
        rings.append(ring)
    n = len(rings)
    for k in range(n):
        A, B = rings[k], rings[(k + 1) % n]
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            for i in range(seg):
                bm.faces.new((A[0], B[i], B[(i + 1) % seg]))
        elif len(B) == 1:
            for i in range(seg):
                bm.faces.new((A[i], A[(i + 1) % seg], B[0]))
        else:
            for i in range(seg):
                bm.faces.new((A[i], A[(i + 1) % seg],
                              B[(i + 1) % seg], B[i]))
    return mesh_from_bm(name, bm, role, smooth)


def sector_shell(name, levels, a0, a1, role, cx=0.0, cy=0.0, cz=0.0, seg=12,
                 smooth=False):
    """Сектор кольца переменного сечения вокруг оси Z (клин, коуш).

    levels = [(z, r_in, r_out), …] снизу вверх; a0..a1 — угловой сектор.
    Замкнутая оболочка: наружная и внутренняя поверхности, два торца,
    верхняя и нижняя крышки — без самопересечений.
    """
    bm = bmesh.new()
    rings = []
    for z, r_in, r_out in levels:
        ri, ro = [], []
        for i in range(seg + 1):
            a = a0 + (a1 - a0) * i / seg
            ca, sa = math.cos(a), math.sin(a)
            ri.append(bm.verts.new((cx + ca * r_in, cy + sa * r_in, cz + z)))
            ro.append(bm.verts.new((cx + ca * r_out, cy + sa * r_out, cz + z)))
        rings.append((ri, ro))
    for k in range(len(rings) - 1):
        (ri0, ro0), (ri1, ro1) = rings[k], rings[k + 1]
        for i in range(seg):
            bm.faces.new((ri0[i], ri0[i + 1], ri1[i + 1], ri1[i]))
            bm.faces.new((ro0[i], ro1[i], ro1[i + 1], ro0[i + 1]))
        bm.faces.new((ri0[0], ri1[0], ro1[0], ro0[0]))
        bm.faces.new((ri0[seg], ro0[seg], ro1[seg], ri1[seg]))
    ri, ro = rings[0]
    for i in range(seg):
        bm.faces.new((ri[i], ro[i], ro[i + 1], ri[i + 1]))
    ri, ro = rings[-1]
    for i in range(seg):
        bm.faces.new((ri[i], ri[i + 1], ro[i + 1], ro[i]))
    return mesh_from_bm(name, bm, role, smooth)


# --- навивка: дискретные витки -------------------------------------------
def theta_for(L):
    """Угол барабана: θ=0 при L=0,30 (состояние GLB), θ<0 при намотке."""
    return (L - PAYOUT_MAX) / COIL_R


def turn_x_range(i):
    """Осевой отрезок витка i. start сдвинут на TURN_GAP: торцы соседних
    витков не совпадают (шов), поэтому BVH не даёт ложных пересечений."""
    x_front = X_EXIT - i * TURN_PITCH
    return x_front - TURN_PITCH + TURN_GAP, x_front


def hide_at(i):
    """Порог выпуска, при котором виток i снимается с барабана."""
    return PAYOUT_MIN + (N_TURNS - i) * WIND_STEP


def visible_count(L):
    k = int(math.floor((L - PAYOUT_MIN) / WIND_STEP + 1e-9))
    k = max(0, min(N_TURNS - TURNS_MIN, k))
    return N_TURNS - k


def build_turn(i, theta):
    """Один виток = оборот спирали 2π-δ; конец — точно в точке схода.

    Стык между витками режется ПО ХОДУ ТРОСА (по углу, δ=0,014 рад ≈ 0,8 мм
    дуги), а не по X: при осевом срезе торцы соседних витков оказываются
    сдвинутыми в собственной плоскости и трубы пересекаются. Конец каждого
    витка остаётся на угле a_end (низ, передняя точка), начало — на a_end-δ,
    поэтому зазор между витками — по касательной.
    """
    name = f'{PREFIX}rope_turn_{i:02d}'
    old = bpy.data.objects.get(name)
    if old is not None:
        bpy.data.objects.remove(old, do_unlink=True)
    x0, x1 = turn_x_range(i)
    a_end = theta - math.pi / 2        # после поворота anim на θ: угол -π/2
    seg = 96
    d = SEAM_GAP_RAD
    pts = []
    for k in range(seg + 1):
        t = k / seg
        a = (a_end + d) + (math.tau - d) * (1.0 - t)
        pts.append((x0 + (x1 - x0) * t, math.sin(a) * COIL_R,
                    Z0 + math.cos(a) * COIL_R))
    obj = poly_tube(name, pts, ROPE_R, 'rope', res=3)
    obj['rotating'] = True
    obj['turn_index'] = i
    obj['hide_at_payout_m'] = round(hide_at(i), 5)
    obj['x_span_m'] = [round(x0, 5), round(x1, 5)]
    return obj


def wrap_scale():
    """Шкала витков на бочке: метки видны там, где витки уже сняты."""
    bm = bmesh.new()
    a0, a1 = math.radians(-100), math.radians(-80)
    n = 8
    for i in range(N_TURNS):
        xa, xb = turn_x_range(i)
        xc = (xa + xb) * 0.5
        rows = []
        for j in range(n + 1):
            a = a0 + (a1 - a0) * j / n
            row = []
            for dx in (-0.0013, 0.0013):
                row.append(bm.verts.new((xc + dx, math.sin(a) * 0.05405,
                                         Z0 + math.cos(a) * 0.05405)))
            rows.append(row)
        for j in range(n):
            bm.faces.new((rows[j][0], rows[j][1], rows[j + 1][1], rows[j + 1][0]))
    o = mesh_from_bm(PREFIX + 'wrap_scale', bm, 'yellow', smooth=False)
    o['rotating'] = True
    o['role'] = 'шкала витков на бочке (видна в местах, где витки сняты)'
    return o


# --- сборка --------------------------------------------------------------
def build():
    reset()

    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    anim.rotation_mode = 'XYZ'
    drum = empty(PREFIX + 'drum', (0.0, 0.0, Z0))
    bpy.context.view_layer.update()
    parent(drum, anim)

    rotating = []

    # ================= вращающийся барабан ==============================
    barrel = cyl(PREFIX + 'drum_barrel', (DRUM_X0, 0, Z0), (DRUM_X1, 0, Z0),
                 DRUM_R, 'dark', vertices=52, bev=0.0024)
    rotating.append(barrel)

    fl_rear = cyl(PREFIX + 'flange_rear', (FL_X0, 0, Z0), (DRUM_X0, 0, Z0), FL_R,
                  'graphite', vertices=56, bev=0.0028)
    fl_front = cyl(PREFIX + 'flange_front', (DRUM_X1, 0, Z0),
                   (DRUM_X1 + FL_T, 0, Z0), FL_R, 'graphite', vertices=56, bev=0.0028)
    rotating += [fl_rear, fl_front]

    rotating.append(torus(PREFIX + 'flange_rim_rear', (FL_X0 + 0.0012, 0, Z0),
                          FL_R - 0.0025, 0.0042, 'steel', 'X', segs=52))
    rotating.append(torus(PREFIX + 'flange_rim_front', (DRUM_X1 + FL_T - 0.0012, 0, Z0),
                          FL_R - 0.0025, 0.0042, 'steel', 'X', segs=52))

    # рёбра на передней реборде — читают вращение (6 шт: bbox симметричен)
    bm = bmesh.new()
    for i in range(6):
        a = math.tau * i / 6
        rr = (0.024 + 0.050) * 0.5
        c = Vector((DRUM_X1 + FL_T + 0.0016, math.sin(a) * rr, Z0 + math.cos(a) * rr))
        mm = (Matrix.Translation(c) @ Matrix.Rotation(a, 4, 'X')
              @ Matrix.Diagonal((0.0032, 0.0070, 0.026, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=mm)
    rotating.append(mesh_from_bm(PREFIX + 'flange_ribs', bm, 'steel'))

    rotating.append(ring_bolts(PREFIX + 'flange_bolts', DRUM_X1 + 0.0005,
                               DRUM_X1 + FL_T + 0.0032, 0.0615, 6,
                               r=0.0032, role='steel', phase=math.radians(30)))

    # жёлтые метки нагрузки на бочке — читают вращение барабана
    # (x >= 0.057: перед навивкой, чтобы не пересекаться с тросом)
    rotating.append(ring_sector(PREFIX + 'drum_load_mark', 0.0570, 0.0745,
                                DRUM_R + 0.0004, DRUM_R + 0.0016,
                                math.radians(-122), math.radians(-58),
                                'yellow', seg=16))
    rotating.append(ring_sector(PREFIX + 'drum_load_mark_b', 0.0570, 0.0745,
                                DRUM_R + 0.0004, DRUM_R + 0.0016,
                                math.radians(58), math.radians(122),
                                'yellow', seg=16))

    rotating.append(cyl(PREFIX + 'shaft', (-0.126, 0, Z0), (0.126, 0, Z0), 0.0105,
                        'steel', vertices=24))
    rotating.append(wrap_scale())

    # ================= станина: щёки и рама =============================
    cheek_pts = [
        (-CHEEK_Y, CHEEK_Z1), (CHEEK_Y, CHEEK_Z1),
        (CHEEK_Y, -0.018), (0.088, -0.042), (0.062, -0.048),
        (-0.062, -0.048), (-0.088, -0.042), (-CHEEK_Y, -0.018),
    ]
    for tag, sx in (('left', -1.0), ('right', 1.0)):
        x_out = sx * CHEEK_X
        x_in = sx * (CHEEK_X - CHEEK_T)
        xm = sx * (CHEEK_X - CHEEK_T * 0.5)
        cheek = plate_yz(PREFIX + f'cheek_{tag}', min(x_out, x_in), max(x_out, x_in),
                         cheek_pts, 'graphite', bev=0.0045)
        boolean_cut(cheek, [hole_cyl(xm, sy * 0.066, 0.074, r=0.0170, verts=24)
                            for sy in (-1.0, 1.0)])

    # поперечные траверсы (вместо сплошной плиты)
    for tag, sy in (('front', -1.0), ('rear', 1.0)):
        cube(PREFIX + f'beam_{tag}',
             (0.0, sy * BEAM_Y, (BEAM_Z0 + BEAM_Z1) * 0.5),
             (CHEEK_X * 2.0, 0.026, BEAM_Z1 - BEAM_Z0), 'graphite', r=0.0028)

    # потолочные рельсы: стенка + полка + болты
    for tag, sx in (('left', -1.0), ('right', 1.0)):
        xm = sx * (RAIL_X[0] + RAIL_X[1]) * 0.5
        cube(PREFIX + f'rail_{tag}', (xm, 0.0, (RAIL_Z0 + RAIL_Z1) * 0.5),
             (RAIL_X[1] - RAIL_X[0], RAIL_Y * 2.0, RAIL_Z1 - RAIL_Z0),
             'graphite', r=0.0022)
        cube(PREFIX + f'rail_cap_{tag}', (xm, 0.0, (CAP_Z0 + CAP_Z1) * 0.5),
             (CAP_X[1] - CAP_X[0], RAIL_Y * 2.0, CAP_Z1 - CAP_Z0),
             'steel', r=0.0016)
        for j, sy in enumerate((-1.0, 1.0)):
            cyl(PREFIX + f'anchor_bolt_{tag}_{j}',
                (xm, sy * 0.130, CAP_Z0 - 0.001), (xm, sy * 0.130, CAP_Z1),
                0.0062, 'steel', vertices=6, smooth=False)
            cyl(PREFIX + f'anchor_washer_{tag}_{j}',
                (xm, sy * 0.130, CAP_Z1 - 0.0035), (xm, sy * 0.130, CAP_Z1 - 0.0015),
                0.0105, 'steel', vertices=20)

    # ================= редуктор + мотор ================================
    cube(PREFIX + 'gearbox', ((GEAR_X0 + GEAR_X1) * 0.5, 0.0, Z0),
         (GEAR_X1 - GEAR_X0, GEAR_Y * 2.0, GEAR_Z * 2.0), 'graphite', r=0.0085)
    cube(PREFIX + 'gearbox_cover', (GEAR_X1 - 0.010, -GEAR_Y - 0.0015, Z0 - 0.004),
         (0.024, 0.004, 0.052), 'dark', r=0.0030)
    cyl(PREFIX + 'gearbox_boss', (GEAR_X1, 0, Z0), (GEAR_X1 + 0.004, 0, Z0),
        0.040, 'graphite', vertices=32, bev=0.0018)
    cyl(PREFIX + 'gearbox_breather', (0.128, 0.030, Z0 + 0.040),
        (0.128, 0.030, Z0 + 0.058), 0.0065, 'steel', vertices=14)
    ring_bolts(PREFIX + 'gearbox_bolts', GEAR_X1 + 0.004, GEAR_X1 + 0.0075,
               0.036, 8, r=0.0036, role='steel', phase=math.radians(22.5))

    cyl(PREFIX + 'motor', (MOTOR_X0, 0, Z0), (MOTOR_X1, 0, Z0), MOTOR_R,
        'dark', vertices=44, bev=0.0032)
    for i, x in enumerate((0.158, 0.166, 0.174, 0.182)):
        torus(PREFIX + f'motor_fin_{i}', (x, 0, Z0), MOTOR_R + 0.0015,
              0.0026, 'steel', 'X', segs=44, rings=8)
    cyl(PREFIX + 'motor_cap', (MOTOR_X1, 0, Z0), (CAP_X1, 0, Z0),
        0.029, 'steel', vertices=32, bev=0.0022)

    cube(PREFIX + 'terminal_box', (0.170, 0.0, 0.0815),
         (0.030, 0.038, 0.018), 'graphite', r=0.0026)
    sphere(PREFIX + 'terminal_led', (0.179, -0.0135, 0.0870), 0.0032, 'cyan')
    curve_tube(PREFIX + 'motor_cable',
               [(0.170, 0.019, 0.086), (0.162, 0.050, 0.070),
                (0.148, 0.068, 0.078), (0.138, 0.074, 0.102),
                (0.131, 0.062, 0.118)], 0.0032, 'dark')

    # ================= тормоз / храповик (слева) =======================
    cyl(PREFIX + 'bearing_boss_l', (-0.128, 0, Z0), (-0.108, 0, Z0),
        0.032, 'steel', vertices=32, bev=0.0022)
    ratchet_wheel(PREFIX + 'ratchet', -0.142, -0.128, 0.052, 0.060, 20, 'steel')
    cyl(PREFIX + 'brake_disc', (-0.158, 0, Z0), (-0.142, 0, Z0), 0.050,
        'steel', vertices=44, bev=0.0022)
    cyl(PREFIX + 'brake_housing', (-0.188, 0, Z0), (-0.158, 0, Z0), 0.046,
        'graphite', vertices=40, bev=0.0042)
    cube(PREFIX + 'brake_arm', (-0.172, 0.0, 0.0790), (0.030, 0.012, 0.016),
         'graphite', r=0.0022)
    cyl(PREFIX + 'handwheel', (-0.196, 0, Z0), (-0.188, 0, Z0), 0.032,
        'red', vertices=32, bev=0.0025)
    cyl(PREFIX + 'handwheel_hub', (-CAP_X1, 0, Z0), (-0.196, 0, Z0), 0.012,
        'steel', vertices=20, bev=0.0018)
    for i in range(3):
        a = math.tau * i / 3 + math.radians(90)
        cyl(PREFIX + f'handwheel_grip_{i}',
            (-0.1992, math.sin(a) * 0.022, Z0 + math.cos(a) * 0.022),
            (-0.196, math.sin(a) * 0.022, Z0 + math.cos(a) * 0.022),
            0.0040, 'steel', vertices=12)

    cube(PREFIX + 'pawl', (-0.135, 0.0, 0.0705), (0.017, 0.011, 0.030),
         'steel', r=0.0022, rot=(math.radians(-14), 0, 0))
    cube(PREFIX + 'pawl_spring', (-0.146, 0.0, 0.0615), (0.017, 0.007, 0.006),
         'dark', r=0.0018, rot=(math.radians(24), 0, 0))

    # ================= направляющий ролик (перед ветвью) ===============
    cyl(PREFIX + 'roller', (-0.090, ROLLER_Y, ROLLER_Z), (0.090, ROLLER_Y, ROLLER_Z),
        ROLLER_R, 'steel', vertices=32, bev=0.0016)
    for i, x in enumerate((-0.088, 0.088)):
        torus(PREFIX + f'roller_ring_{i}', (x, ROLLER_Y, ROLLER_Z), 0.0128,
              0.0024, 'steel', 'X', segs=28, rings=8)
    cyl(PREFIX + 'roller_axle', (-0.122, ROLLER_Y, ROLLER_Z),
        (0.098, ROLLER_Y, ROLLER_Z), 0.0040, 'graphite', vertices=16)
    cyl(PREFIX + 'roller_boss_right', (0.090, ROLLER_Y, ROLLER_Z),
        (CHEEK_X + 0.004, ROLLER_Y, ROLLER_Z), 0.0105, 'graphite',
        vertices=20, bev=0.0016)

    # ================= датчик натяжения (в линии оси ролика) ===========
    cube(PREFIX + 'tension_sensor', (-0.126, -0.083, -0.026),
         (0.026, 0.032, 0.034), 'graphite', r=0.0032)
    cyl(PREFIX + 'sensor_pin', (-0.145, ROLLER_Y, ROLLER_Z),
        (-0.118, ROLLER_Y, ROLLER_Z), 0.0075, 'steel', vertices=18)
    sphere(PREFIX + 'sensor_led', (-0.126, -0.0995, -0.016), 0.0034, 'cyan')
    curve_tube(PREFIX + 'sensor_cable',
               [(-0.126, -0.092, -0.043), (-0.126, -0.098, -0.062),
                (-0.120, -0.101, -0.080), (-0.113, -0.096, -0.088)], 0.0030, 'dark')
    cube(PREFIX + 'sensor_plug', (-0.113, -0.0955, -0.0905),
         (0.008, 0.010, 0.009), 'dark', r=0.0016)

    # ================= узел выпуска троса ===============================
    payout = empty(PREFIX + 'rope_payout', (X_EXIT, -R_END, Z_BRANCH), 'PLAIN_AXES')
    payout['payout_axis'] = 'local_y (gltf/three.js), local_z в Blender'
    payout['payout_min_m'] = PAYOUT_MIN
    payout['payout_max_m'] = PAYOUT_MAX
    payout['payout_sign'] = 'scale_y = L в three.js (scale_z в Blender), ветвь вниз'
    payout['exit_is_fixed'] = True

    # ветвь: труба длиной 1,0 м от начала координат вниз, масштаб 1.0 = 1 м
    branch = cyl(PREFIX + 'rope_branch', (0, 0, -0.5), (0, 0, 0.5), ROPE_R,
                 'rope', vertices=20, bev=0.0)
    branch.data.transform(Matrix.Translation(Vector((0.0, 0.0, -0.5))))
    branch.location = (X_EXIT, -R_END, Z_BRANCH)   # начало ветви = торец turn_00
    branch['unit_length_m'] = 1.0
    branch['scale_axis'] = 'y (gltf/three.js), z в Blender'
    parent(branch, payout)

    z_end = Z_BRANCH - PAYOUT_MAX
    end = empty(PREFIX + 'rope_end', (X_EXIT, -R_END, z_end), 'PLAIN_AXES')
    parent(end, payout)
    end['payload_node'] = True

    # ================= свободный конец: клин → коуш → шакл → крюк ========
    # Все координаты локальны от точки rope_end (ZB = конец ветви): z вниз
    # отрицательный, ось троса (AX, AY). Весь узел — дети rope_end и едет
    # вместе с концом ветви; rope_branch остаётся отдельным узлом.
    AX, AY = X_EXIT, -R_END
    ZB = z_end

    def fz(dz):
        return ZB + dz

    fe = []

    # ---- 1. трос входит в гнездо и обрывается внутри, зажатый клином ----
    fe.append(cyl(PREFIX + 'rope_end_stub', (AX, AY, fz(0.0020)),
                  (AX, AY, fz(-0.0092)), ROPE_R, 'rope', vertices=20))

    # ---- 2. корпус клиновой заделки: конусное гнездо, цельный -----------
    # наружная стенка и гнездо — один замкнутый контур вращения
    SOCKET_PROFILE = [
        (0.0082, -0.0150), (0.0086, -0.0115), (0.0100, -0.0050),
        (0.0104, -0.0010), (0.0100, 0.0035),          # наружная стенка
        (0.0079, 0.0035),                            # верхний торец
        (0.0065, -0.0035), (0.0052, -0.0085),        # конус гнезда
        (0.0036, -0.0120), (0.0012, -0.0145), (0.0, -0.0149),
    ]
    body = revolve(PREFIX + 'wedge_socket_body', SOCKET_PROFILE, 'steel',
                   AX, AY, ZB, seg=40)
    # паз в торце под клин: через него видно, как клин входит в гнездо
    pa = math.radians(-50)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=(
        Matrix.Translation(Vector((AX + math.cos(pa) * 0.0080,
                                   AY + math.sin(pa) * 0.0080, ZB + 0.0004)))
        @ Matrix.Rotation(pa, 4, 'Z')
        @ Matrix.Diagonal((0.0150, 0.0110, 0.0098, 1.0))))
    body = boolean_cut(body, [mesh_from_bm(PREFIX + 'notch_tmp', bm, 'steel')])
    body.name = PREFIX + 'wedge_socket_body'
    fe.append(body)

    # ---- 3. клин, забитый в гнездо вдоль троса (+X) ---------------------
    WEDGE_LEVELS = [(-0.0075, 0.00480, 0.00515), (-0.0020, 0.00480, 0.00585),
                    (0.0035, 0.00480, 0.00760), (0.0068, 0.00480, 0.00860),
                    (0.0090, 0.00480, 0.00680)]     # верх скошен от удара
    # клин развёрнут на камеру крупного плана (азимут -50°), чтобы было
    # видно, как он заклинен между тросом и стенкой гнезда
    fe.append(sector_shell(PREFIX + 'wedge_socket_wedge', WEDGE_LEVELS,
                           math.radians(-76), math.radians(-24), 'dark',
                           AX, AY, ZB, seg=10))

    # ---- 4. стопорный штифт под клином (с головкой) и гайка ------------
    bm = bmesh.new()
    cyl_bm(bm, (AX, AY - 0.0108, fz(-0.0118)), (AX, AY + 0.0100, fz(-0.0118)),
           0.00185, seg=16)
    cyl_bm(bm, (AX, AY - 0.0108, fz(-0.0118)), (AX, AY - 0.0094, fz(-0.0118)),
           0.00330, seg=6)
    fe.append(mesh_from_bm(PREFIX + 'wedge_socket_pin', bm, 'steel'))
    fe.append(cyl(PREFIX + 'wedge_socket_nut', (AX, AY + 0.0094, fz(-0.0118)),
                  (AX, AY + 0.0122, fz(-0.0118)), 0.00310, 'graphite',
                  vertices=6))

    # ---- 5. проушина корпуса (ось отверстия — X) ------------------------
    fe.append(torus(PREFIX + 'wedge_socket_eye', (AX, AY, fz(-0.0215)),
                    0.0048, 0.0022, 'steel', 'X', segs=32, rings=12))

    # ---- 6. скоба: дуга с щеками + проушина в замке (одна поковка) -----
    R_BOW, Z_TOP, Z_ARC = 0.0074, -0.0252, -0.0330
    path = []
    for i in range(5):                                   # левая щека вниз
        path.append((-R_BOW, Z_TOP + (Z_ARC - Z_TOP) * i / 4.0))
    for i in range(1, 25):                               # низ дуги
        a = math.pi - math.pi * i / 24.0
        path.append((R_BOW * math.cos(a), Z_ARC - R_BOW * math.sin(a)))
    for i in range(1, 6):                                # правая щека вверх
        path.append((R_BOW, Z_ARC + (Z_TOP - Z_ARC) * i / 5.0))
    bow = sweep(PREFIX + 'shackle_bow', [(AX + x, AY, fz(z)) for x, z in path],
                0.0036, 'graphite', seg=18)
    lugs = []
    for sx in (-1, 1):                    # щёки под палец: шайба с отверстием
        bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.0046,
                                            depth=0.0034,
                                            location=(AX + sx * 0.0074, AY,
                                                      fz(-0.0215)),
                                            rotation=(0, math.pi / 2, 0))
        lug = bpy.context.object
        lug.name = PREFIX + f'lug_tmp{0 if sx < 0 else 1}'
        apply(lug, 'graphite', True)
        bore(lug, (AX + sx * 0.0120, AY, fz(-0.0215)),
             (AX + sx * 0.0040, AY, fz(-0.0215)), 0.00235, verts=26)
        lugs.append(lug)
    eye = torus(PREFIX + 'eye_tmp', (AX, AY, fz(-0.0515)), 0.0052, 0.0022,
                'graphite', 'Y', segs=40, rings=12)
    bow = join([bow] + lugs + [eye], PREFIX + 'shackle_bow')
    fe.append(bow)

    # ---- 7. коуш (thimble): подкова-втулка в проушине скобы ------------
    th = sector_shell(PREFIX + 'shackle_thimble',
                      [(-0.0030, 0.00215, 0.00295), (0.0030, 0.00215, 0.00295)],
                      math.radians(118), math.radians(422), 'steel', seg=30)
    th.rotation_euler = (math.pi / 2, 0, 0)               # ось втулки → Y
    select_only(th)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    th.location = Vector((AX, AY, fz(-0.0515)))
    fe.append(th)

    # ---- 8. палец скобы (ось X) + гайка + шплинт ------------------------
    bm = bmesh.new()
    cyl_bm(bm, (AX - 0.0092, AY, fz(-0.0215)), (AX + 0.0142, AY, fz(-0.0215)),
           0.0022, seg=18)
    cyl_bm(bm, (AX - 0.0124, AY, fz(-0.0215)), (AX - 0.0092, AY, fz(-0.0215)),
           0.0040, seg=6)
    fe.append(mesh_from_bm(PREFIX + 'shackle_pin', bm, 'steel'))
    fe.append(cyl(PREFIX + 'shackle_nut', (AX + 0.0094, AY, fz(-0.0215)),
                  (AX + 0.0126, AY, fz(-0.0215)), 0.00360, 'steel',
                  vertices=6))
    bm = bmesh.new()
    cot = [(AX + 0.0139, AY - 0.0046, fz(-0.0189)),
           (AX + 0.0139, AY - 0.0040, fz(-0.0215)),
           (AX + 0.0139, AY + 0.0040, fz(-0.0215)),
           (AX + 0.0139, AY + 0.0046, fz(-0.0189))]
    for a, b in zip(cot[:-1], cot[1:]):
        cyl_bm(bm, a, b, 0.00078, seg=10)
    for q in cot:
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=0.00078,
                                   matrix=Matrix.Translation(q))
    fe.append(mesh_from_bm(PREFIX + 'shackle_cotter', bm, 'dark'))

    # ---- 9. вилка крюка: две щеки по Y со скруглённой головкой ---------
    CLV_BOT, CLV_W = -0.0650, 0.0042          # низ щеки и радиус головки
    Z_PIN = -0.0515                          # ось пальца крюка
    bm = bmesh.new()
    head = []
    for i in range(19):                      # скруглённая головка щеки
        a = math.pi * i / 18.0
        head.append((CLV_W * math.cos(a), Z_PIN + CLV_W * math.sin(a)))
    for sy in (-1, 1):
        pts = [(CLV_W, CLV_BOT)] + head + [(-CLV_W, CLV_BOT)]
        plate_xz_bm(bm, AY + sy * 0.0034, AY + sy * 0.0062,
                    [(AX + x, fz(z)) for x, z in pts])
    clv = mesh_from_bm(PREFIX + 'hook_clevis', bm, 'graphite', smooth=False)
    select_only(clv)
    bevel(clv, 0.0008, 2)
    bore(clv, (AX, AY - 0.0120, fz(-0.0515)), (AX, AY + 0.0120, fz(-0.0515)),
         0.00220, verts=22)
    fe.append(clv)

    # ---- 10. палец крюка (ось Y) + гайка --------------------------------
    bm = bmesh.new()
    cyl_bm(bm, (AX, AY - 0.0082, fz(-0.0515)), (AX, AY + 0.0088, fz(-0.0515)),
           0.00205, seg=18)
    cyl_bm(bm, (AX, AY - 0.0084, fz(-0.0515)), (AX, AY - 0.0064, fz(-0.0515)),
           0.00290, seg=6)
    fe.append(mesh_from_bm(PREFIX + 'hook_pin', bm, 'steel'))
    fe.append(cyl(PREFIX + 'hook_nut', (AX, AY + 0.0066, fz(-0.0515)),
                  (AX, AY + 0.0092, fz(-0.0515)), 0.00270, 'steel',
                  vertices=6))

    # ---- 11. крюк: шейка, спина, зев, загнутый носок (плоская поковка) --
    HC = (0.0095, -0.0745)                  # центр зева
    RO, RI = 0.0130, 0.0060                 # наружный/внутренний радиус
    hook_prof = [(HC[0] - RO, -0.0640), (HC[0] - RO, HC[1])]
    for i in range(1, 27):                  # наружная дуга: 180° → 380° (низ)
        a = math.radians(180 + 200 * i / 26.0)
        hook_prof.append((HC[0] + RO * math.cos(a), HC[1] + RO * math.sin(a)))
    for i in range(26, -1, -1):             # внутренняя дуга обратно к шейке
        a = math.radians(180 + 200 * i / 26.0)
        hook_prof.append((HC[0] + RI * math.cos(a), HC[1] + RI * math.sin(a)))
    hook_prof.append((HC[0] - RI, -0.0640))
    hook = plate_xz(PREFIX + 'hook', AY - 0.0045, AY + 0.0045,
                    [(AX + x, fz(z)) for x, z in hook_prof], 'steel', bev=0.0012)
    fe.append(hook)

    # ---- 12. предохранительная защёлка зева на щеке крюка ---------------
    lat = [(AX + 0.0042, AY - 0.0054, fz(-0.0700)),
           (AX + 0.0080, AY - 0.0054, fz(-0.0712)),
           (AX + 0.0120, AY - 0.0054, fz(-0.0714)),
           (AX + 0.0162, AY - 0.0054, fz(-0.0718))]
    fe.append(curve_tube(PREFIX + 'hook_latch', lat, 0.0017, 'yellow',
                         res=6, resu=12))
    fe.append(cyl(PREFIX + 'hook_latch_pin', (AX + 0.0044, AY - 0.0064,
                                              fz(-0.0700)),
                  (AX + 0.0044, AY - 0.0038, fz(-0.0700)), 0.0018, 'dark',
                  vertices=16))

    for p in fe:
        parent(p, end)

    # ================= жёлтая метка нагрузки на раме ====================
    cube(PREFIX + 'load_plate', (0.0, -BEAM_Y - 0.0124, 0.1120),
         (0.050, 0.0028, 0.0120), 'yellow', r=0.0010)
    for i in range(3):
        cube(PREFIX + f'load_tick_{i}', (-0.013 + i * 0.013, -BEAM_Y - 0.0139, 0.1120),
             (0.0065, 0.0020, 0.0068), 'dark', r=0.0007)

    # ================= вращающаяся группа ===============================
    bpy.context.view_layer.update()
    for o in rotating:
        parent(o, drum)
        o['rotating'] = True
    bpy.context.view_layer.update()

    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in rotating:
            o['rotating'] = False

    return anim, drum, payout, end, branch


# --- состояние -----------------------------------------------------------
def apply_state(L):
    """Собрать состояние: угол барабана, набор витков, длина ветви."""
    theta = theta_for(L)
    anim = bpy.data.objects[PREFIX + 'anim']
    drum = bpy.data.objects[PREFIX + 'drum']
    anim.rotation_euler = (theta, 0.0, 0.0)
    bpy.context.view_layer.update()

    n_vis = visible_count(L)
    turns = []
    for i in range(N_TURNS):
        t = build_turn(i, theta)
        parent(t, drum)
        hidden = (i >= n_vis)
        t.hide_render = hidden
        t.hide_viewport = False
        t['visible_at_payout_m'] = (not hidden)
        turns.append(t)

    branch = bpy.data.objects[PREFIX + 'rope_branch']
    branch.scale = (1.0, 1.0, L)
    end = bpy.data.objects[PREFIX + 'rope_end']
    end.location = (X_EXIT, -R_END, Z_BRANCH - L)
    bpy.context.view_layer.update()
    return turns, n_vis


def show_all_turns():
    for i in range(N_TURNS):
        t = bpy.data.objects.get(f'{PREFIX}rope_turn_{i:02d}')
        if t is not None:
            t.hide_render = False


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


def bvh_world(obj, deps):
    ev = obj.evaluated_get(deps)
    me = ev.to_mesh()
    verts = [ev.matrix_world @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    tree = BVHTree.FromPolygons(verts, polys, all_triangles=False, epsilon=0.0)
    ev.to_mesh_clear()
    return tree


def rope_parts_names():
    return tuple(f'rope_turn_{i:02d}' for i in range(N_TURNS)) + (
        'rope_branch',) + FE_PARTS


# расчётные контакты: ветвь продолжает последний виток в точке схода
CONTACT_PAIRS = {frozenset(('rope_branch', 'rope_turn_00'))}


def collisions():
    """Трос (витки, ветвь, крюковая подвеска) против корпуса.

    Внутренние стыки крюковой подвески (коуш-ферула-крюк) и стык
    ветвь↔turn_00 — расчётные контакты одной сборки, не коллизии.
    """
    deps = bpy.context.evaluated_depsgraph_get()
    names = rope_parts_names()
    rope = [o for o in bpy.data.objects
            if o.type == 'MESH' and o.name.startswith(PREFIX)
            and o.name[len(PREFIX):] in names and not o.hide_render]
    shell = [o for o in bpy.data.objects
             if o.type == 'MESH' and o.name.startswith(PREFIX)
             and o.name[len(PREFIX):] not in names and not o.hide_render]
    trees = {o.name: bvh_world(o, deps) for o in rope + shell}
    hits = []
    for r in rope:
        for s in shell:
            pair = frozenset((r.name[len(PREFIX):], s.name[len(PREFIX):]))
            if pair in CONTACT_PAIRS:
                continue
            if trees[r.name].overlap(trees[s.name]):
                hits.append(sorted([r.name, s.name]))
    return sorted(hits)


def turn_overlaps():
    """Витки не должны пересекаться между собой (зазор TURN_GAP)."""
    deps = bpy.context.evaluated_depsgraph_get()
    turns = [bpy.data.objects[f'{PREFIX}rope_turn_{i:02d}'] for i in range(N_TURNS)
             if not bpy.data.objects[f'{PREFIX}rope_turn_{i:02d}'].hide_render]
    trees = {o.name: bvh_world(o, deps) for o in turns}
    hits = []
    for i in range(len(turns)):
        for j in range(i + 1, len(turns)):
            if trees[turns[i].name].overlap(trees[turns[j].name]):
                hits.append(sorted([turns[i].name, turns[j].name]))
    return sorted(hits)


def report_metrics(anim, drum):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    rot_meshes = [o for o in bpy.data.objects
                  if o.type == 'MESH' and o.name.startswith(PREFIX)
                  and is_descendant(o, anim)]
    r_mn, r_mx = mesh_bbox(rot_meshes)
    k_c0 = (r_mn + r_mx) * 0.5

    axis_world = (anim.matrix_world.to_3x3() @ Vector((1, 0, 0))).normalized()
    bl_axis = max(('x', 'y', 'z'), key=lambda a: abs(axis_world['xyz'.index(a)]))

    saved = tuple(anim.rotation_euler)
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    p_mn, p_mx = mesh_bbox(rot_meshes)
    k_c1 = (p_mn + p_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    axis_off = math.hypot(k_c0.y - anim.location.y, k_c0.z - anim.location.z)
    anim.rotation_euler = saved
    bpy.context.view_layer.update()

    barrel = bpy.data.objects[PREFIX + 'drum_barrel']
    d_mn, d_mx = mesh_bbox([barrel])
    d_c = (d_mn + d_mx) * 0.5

    branch = bpy.data.objects[PREFIX + 'rope_branch']
    br_len = round(abs(branch.scale.z), 5)
    b_mw = branch.matrix_world
    b_top = b_mw @ Vector((0.0, 0.0, 0.0))
    b_dir = (b_mw.to_3x3() @ Vector((0.0, 0.0, 1.0))).normalized()
    end = bpy.data.objects[PREFIX + 'rope_end']

    tangency = abs(math.hypot(b_top.y, b_top.z - Z0) - COIL_R)
    barrel_gap = math.hypot(b_top.y, b_top.z - Z0) - DRUM_R - ROPE_R
    vert_dev = math.degrees(math.acos(min(1.0, abs(b_dir.z))))

    hook_top = (end.matrix_world @ Vector((0, 0, 0))).z
    hook_bottom = bpy.data.objects[PREFIX + 'hook']
    h_mn, _ = mesh_bbox([hook_bottom])

    turns = [bpy.data.objects[f'{PREFIX}rope_turn_{i:02d}'] for i in range(N_TURNS)]
    t_mn, t_mx = mesh_bbox([t for t in turns if not t.hide_render])
    t_r = []
    for t in turns:
        mw = t.matrix_world
        for v in t.data.vertices:
            p = mw @ v.co
            t_r.append(math.hypot(p.y, p.z - Z0))

    return {
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [0.40, 0.30, 0.50],
        'bbox_ok': bool(abs(size.x - 0.40) <= 0.006 and abs(size.y - 0.30) <= 0.006
                        and abs(size.z - 0.50) <= 0.006),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_axis_blender': bl_axis,
        'anim_axis_threejs': bl_axis,
        'anim_spin_rad_s': 0.9,
        'anim_children': sorted(o.name for o in anim.children),
        'rotating_group': drum.name,
        'rotating_parts': sorted(o.name for o in bpy.data.objects
                                 if o.type == 'MESH' and o.name.startswith(PREFIX)
                                 and is_descendant(o, anim)),
        'drum_center': [round(v, 5) for v in d_c],
        'drum_length': round((d_mx - d_mn).x, 5),
        'drum_radius': DRUM_R,
        'axis_offset_mm': round(axis_off * 1000, 4),
        'axis_ok': bool(axis_off < 0.001),
        'pivot_shift_mm': round(pivot_shift * 1000, 4),
        'pivot_ok': bool(pivot_shift < 0.001),
        'coil_x_range': [round(t_mn.x, 5), round(t_mx.x, 5)],
        'coil_outer_radius': round(max(t_r), 5),
        'coil_inner_radius': round(min(t_r), 5),
        'branch_length_m': br_len,
        'branch_top_world': [round(v, 5) for v in b_top],
        'branch_dir_world': [round(v, 4) for v in b_dir],
        'branch_vertical_dev_deg': round(vert_dev, 3),
        'branch_vertical_ok': bool(vert_dev < 0.05),
        'branch_tangency_mm': round(tangency * 1000, 4),
        'branch_barrel_gap_mm': round(barrel_gap * 1000, 4),
        'hook_top_z': round(hook_top, 5),
        'hook_bottom_z': round(h_mn.z, 5),
        'hook_on_end_ok': bool(abs(hook_top - (Z_BRANCH - br_len)) < 0.0008),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }


def free_end_report(branch_tree, branch_z):
    """Замеры и проверки концевой заделки (клин → коуш → шакл → крюк)."""
    deps = bpy.context.evaluated_depsgraph_get()
    objs = [bpy.data.objects[PREFIX + n] for n in FE_PARTS]
    trees = {o.name: bvh_world(o, deps) for o in objs}
    trees[PREFIX + 'rope_branch'] = branch_tree

    def short(n):
        return n[len(PREFIX):]

    pairs = []
    names = [o.name for o in objs] + [PREFIX + 'rope_branch']
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            if trees[names[i]].overlap(trees[names[j]]):
                pairs.append(frozenset((short(names[i]), short(names[j]))))
    joint = [sorted(p) for p in pairs if p in FE_JOINTS]
    clash = [sorted(p) for p in pairs if p not in FE_JOINTS]

    boxes = {}
    for o in objs:
        mn, mx = mesh_bbox([o])
        boxes[short(o.name)] = (mn, mx)

    # связность: узлы, чьи bbox ближе 2,5 мм, считаются соединёнными
    names_s = [short(o.name) for o in objs] + ['rope_branch']
    boxes['rope_branch'] = (mesh_bbox([bpy.data.objects[PREFIX + 'rope_branch']]))

    def gap(a, b):
        (a0, a1), (b0, b1) = boxes[a], boxes[b]
        d = Vector((max(0.0, max(a0.x, b0.x) - min(a1.x, b1.x)),
                    max(0.0, max(a0.y, b0.y) - min(a1.y, b1.y)),
                    max(0.0, max(a0.z, b0.z) - min(a1.z, b1.z))))
        return d.length

    adj = {n: set() for n in names_s}
    for i in range(len(names_s)):
        for j in range(i + 1, len(names_s)):
            if gap(names_s[i], names_s[j]) <= 0.0025:
                adj[names_s[i]].add(names_s[j])
                adj[names_s[j]].add(names_s[i])
    seen, stack = set(), ['rope_branch']
    while stack:
        n = stack.pop()
        if n in seen:
            continue
        seen.add(n)
        stack.extend(adj[n] - seen)
    unconnected = sorted(set(names_s) - seen)

    mn, mx = mesh_bbox(objs)
    axis = Vector((X_EXIT, -R_END))
    off = {}
    for n, (a, b) in boxes.items():
        c = (a + b) * 0.5
        off[n] = round(math.hypot(c.x - axis.x, c.y - axis.y) * 1000, 2)

    stub = bpy.data.objects[PREFIX + 'rope_end_stub']
    s_mn, s_mx = mesh_bbox([stub])
    body = bpy.data.objects[PREFIX + 'wedge_socket_body']
    b_mn, b_mx = mesh_bbox([body])
    wedge = bpy.data.objects[PREFIX + 'wedge_socket_wedge']
    w_mn, w_mx = mesh_bbox([wedge])
    hook = bpy.data.objects[PREFIX + 'hook']
    h_mn, h_mx = mesh_bbox([hook])

    parts = []
    for n in FE_PARTS:
        a, b = boxes[n]
        o = bpy.data.objects[PREFIX + n]
        parts.append({
            'node': PREFIX + n,
            'role': FE_ROLES.get(n, ''),
            'material': o.data.materials[0].name if o.data.materials else '',
            'z_span_m': [round(a.z - branch_z, 4), round(b.z - branch_z, 4)],
            'size_mm': [round((b - a).x * 1000, 1), round((b - a).y * 1000, 1),
                        round((b - a).z * 1000, 1)],
            'center_offset_mm': off[n],
        })

    return {
        'node': PREFIX + 'rope_end',
        'parent_of_all': True,
        'axis': [round(X_EXIT, 5), round(-R_END, 5)],
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'total_drop_m': round(branch_z - mn.z, 4),
        'socket_body_len_mm': round((b_mx.z - b_mn.z) * 1000, 1),
        'socket_body_dia_mm': [round((b_mx - b_mn).x * 1000, 1)],
        'socket_cavity_mouth_dia_mm': round(0.0079 * 2 * 1000, 1),
        'socket_cavity_depth_mm': round((0.0035 - (-0.0149)) * 1000, 1),
        'wedge_protrusion_mm': round((w_mx.z - b_mx.z) * 1000, 1),
        'wedge_len_mm': round((w_mx.z - w_mn.z) * 1000, 1),
        'wedge_sector_deg': 76,
        'rope_stub_inside_mm': round((b_mx.z - s_mn.z) * 1000, 1),
        'hook_height_mm': round((h_mx.z - h_mn.z) * 1000, 1),
        'hook_bottom_z': round(h_mn.z, 5),
        'parts': parts,
        'joint_contacts': joint,
        'internal_clashes': clash,
        'joints_ok': not clash,
        'chain_connected': not unconnected,
        'unconnected': unconnected,
        'max_center_offset_mm': max(off.values()),
        'coaxial_ok': max(off.values()) < 4.0,
        'rope_gripped': bool(s_mn.z > b_mn.z and s_mn.z < b_mx.z),
        'stack': ['трос в гнезде', 'клин', 'корпус заделки', 'проушина',
                  'палец шакла', 'скоба', 'коуш', 'вилка крюка', 'палец крюка',
                  'крюк', 'защёлка'],
    }


def is_descendant(obj, root):
    p = obj.parent
    while p is not None:
        if p == root:
            return True
        p = p.parent
    return False


def turn_table():
    rows = []
    for i in range(N_TURNS):
        x0, x1 = turn_x_range(i)
        rows.append({
            'node': f'{PREFIX}rope_turn_{i:02d}',
            'index': i,
            'x_span_m': [round(x0, 5), round(x1, 5)],
            'hide_at_payout_m': round(hide_at(i), 5),
            'never_hidden': bool(hide_at(i) > PAYOUT_MAX + 1e-9),
        })
    return rows


def turn_tip_end(i, theta):
    """Последняя точка осевой линии витка и направление хода троса в ней."""
    x0, x1 = turn_x_range(i)
    a_end = theta - math.pi / 2
    back = 1.0 / 96.0
    a_prev = a_end + (math.tau - SEAM_GAP_RAD) * back
    p_end = Vector((x1, math.sin(a_end) * COIL_R, Z0 + math.cos(a_end) * COIL_R))
    p_prev = Vector((x1 - (x1 - x0) * back,
                     math.sin(a_prev) * COIL_R,
                     Z0 + math.cos(a_prev) * COIL_R))
    return p_end, (p_end - p_prev).normalized()


def turn_takeoff_check():
    """Торец turn_00 должен совпадать с началом ветви (точка схода).

    Центр торца ищем как центроид вершин, лежащих в плоскости торца
    (|dot(p - payout, t)| < 0,3 мм) и не дальше 8 мм от точки схода: сама
    труба уходит из этой плоскости, соседнее кольцо спирали — на 3,9 мм.
    """
    obj = bpy.data.objects[f'{PREFIX}rope_turn_00']
    payout_pt = Vector((X_EXIT, -R_END, Z_BRANCH))
    _, t_hat = turn_tip_end(0, theta_for(PAYOUT_MAX))
    mw = obj.matrix_world
    ring = [mw @ v.co for v in obj.data.vertices
            if abs(((mw @ v.co) - payout_pt).dot(t_hat)) < 0.0003
            and ((mw @ v.co) - payout_pt).length < 0.008]
    if not ring:
        return 999.0, 0
    c = sum(ring, Vector()) / len(ring)
    return round((c - payout_pt).length * 1000, 4), len(ring)


# --- экспорт -------------------------------------------------------------
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
def setup_scene(baseline_mn):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.10
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.640, 0.635, 0.628, 1.0)
    bg.inputs['Strength'].default_value = 0.38

    bpy.ops.mesh.primitive_plane_add(size=2.4,
                                     location=(0.0, 0.0, baseline_mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.560, 0.556, 0.548, 1.0)
    nb.inputs['Roughness'].default_value = 0.95
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.36, -0.46, 0.52), 5.40, 0.34),
            ('fill', (-0.48, -0.36, 0.24), 2.40, 0.46),
            ('rim', (0.08, 0.48, 0.44), 3.40, 0.36)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc)
        lo.rotation_euler = (Vector((0, 0, 0.04)) - lo.location).to_track_quat(
            '-Z', 'Y').to_euler()

    # отдельный источник для крупного плана свободного конца: он висит на
    # 0,3 м ниже оси барабана, где общий свет уже почти не добивает
    fe_ld = bpy.data.lights.new('fe_key', 'AREA')
    fe_ld.energy = 2.20
    fe_ld.shape = 'DISK'
    fe_ld.size = 0.26
    fe_lo = bpy.data.objects.new('fe_key', fe_ld)
    scene.collection.objects.link(fe_lo)
    fe_lo.hide_render = True

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    return cam, cam_data, fe_lo


def render_views():
    scene = bpy.context.scene
    base_mn, base_mx = mesh_bbox([o for o in bpy.data.objects
                                  if o.type == 'MESH' and o.name.startswith(PREFIX)])
    cam, cam_data, fe_lo = setup_scene(base_mn)
    center = (base_mn + base_mx) * 0.5

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized()

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
            need = max(need,
                       abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(base_mn - center, base_mx - center)
    close_t = Vector((X_EXIT - 0.050, -0.040, 0.004))
    c_close = box_corners(Vector((X_START - 0.010, -0.098, 0.005)) - close_t,
                          Vector((X_EXIT + 0.040, 0.024, 0.082)) - close_t)
    close_measure = {PREFIX + n for n in (
        'drum_barrel', 'flange_front', 'flange_rim_front', 'wrap_scale',
        'drum_load_mark', 'flange_bolts')}
    close_measure |= {f'{PREFIX}rope_turn_{i:02d}' for i in range(N_TURNS)}

    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(fill, only=None):
        worst = 0.0
        for o in bpy.data.objects:
            if o.type != 'MESH' or not o.name.startswith(PREFIX):
                continue
            if o.hide_render:
                continue
            if only is not None and o.name not in only:
                continue
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    def aim(direction, target, lens, corners, fill, only=None):
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(6):
            got = max_ndc(fill, only)
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        return Vector(cam.location), Vector(cam.rotation_euler), cam_data.lens

    def shoot(tag):
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        print(f'RENDERED {tag} -> {fp}', flush=True)
        return str(fp.relative_to(PROJECT))

    outs = []
    views = [
        ('3q', (0.78, -0.74, 0.44), center + Vector((0, 0, 0.004)), 70, c_main, 0.94),
        ('front', (0.02, -1.00, 0.14), center + Vector((0, 0, 0.006)), 70, c_main, 0.94),
        ('side', (1.00, -0.07, 0.11), center + Vector((0, 0, 0.004)), 70, c_main, 0.94),
        ('closeup', (0.63, -0.76, 0.22), close_t, 88, c_close, 0.95),
    ]
    saved = None
    for tag, direction, target, lens, corners, fill in views:
        tr = aim(direction, target, lens, corners, fill,
                 close_measure if tag == 'closeup' else None)
        if tag == '3q':
            saved = (Vector(tr[0]), Vector(tr[1]), tr[2])
        outs.append(shoot(tag))

    # --- крупный план свободного конца: клин → коуш → шакл → крюк ------
    fe_names = {PREFIX + n for n in FE_PARTS}
    end = bpy.data.objects[PREFIX + 'rope_end']
    e = Vector(end.matrix_world.translation)
    fe_t = e + Vector((0.0, 0.0, -0.041))
    c_fe = box_corners(Vector((X_EXIT - 0.030, -R_END - 0.020, e.z + 0.036)),
                       Vector((X_EXIT + 0.030, -R_END + 0.018, e.z - 0.086)))
    fe_lo.location = Vector((X_EXIT + 0.20, -R_END - 0.26, e.z - 0.005))
    fe_lo.rotation_euler = (Vector(fe_t) - fe_lo.location).to_track_quat(
        '-Z', 'Y').to_euler()
    fe_lo.hide_render = False
    aim((0.56, -0.80, 0.14), fe_t, 90, c_fe, 0.92, fe_names)
    outs.append(shoot('closeup_free_end'))
    fe_lo.hide_render = True

    # --- контрольные состояния тем же кадром 3q -------------------------
    loc, rot, lens = saved
    cam.location = loc
    cam.rotation_euler = rot
    cam_data.lens = lens
    for tag, L in (('wound', PAYOUT_MIN), ('mid', PAYOUT_MID), ('unwound', PAYOUT_MAX)):
        apply_state(L)
        bpy.context.view_layer.update()
        outs.append(shoot(tag))
    return outs


def main():
    anim, drum, payout, end, branch = build()
    apply_state(PAYOUT_MAX)
    rep = report_metrics(anim, drum)
    takeoff_mm, takeoff_ring = turn_takeoff_check()

    coll = {}
    turns_ovl = {}
    counts = {}
    for tag, L in (('wound', PAYOUT_MIN), ('mid', PAYOUT_MID),
                   ('unwound', PAYOUT_MAX)):
        _, nv = apply_state(L)
        counts[tag] = nv
        coll[tag] = collisions()
        turns_ovl[tag] = turn_overlaps()

    apply_state(PAYOUT_MAX)
    deps = bpy.context.evaluated_depsgraph_get()
    fe_rep = free_end_report(bvh_world(bpy.data.objects[PREFIX + 'rope_branch'], deps),
                             Z_BRANCH - PAYOUT_MAX)
    show_all_turns()
    path = export()
    glb_nodes = len([o for o in bpy.data.objects if o.name.startswith(PREFIX)])

    # состояние для стандартных рендеров — то же, что в отчёте (L=0,30)
    apply_state(PAYOUT_MAX)
    renders = render_views()
    apply_state(PAYOUT_MAX)

    table = turn_table()
    rep.update({
        'component': CID,
        'code': 'MOT-WIN-07',
        'nodes': glb_nodes,
        'objects_total': len(bpy.data.objects),
        'winding': {
            'scheme': 'discrete_turns',
            'helix_axis': 'X',
            'turns_total': N_TURNS,
            'turns_min': TURNS_MIN,
            'turn_nodes': [r['node'] for r in table],
            'turn_pitch_m': TURN_PITCH,
            'seam_gap_rad': SEAM_GAP_RAD,
            'seam_gap_mm': round(SEAM_GAP_RAD * COIL_R * 1000, 3),
            'coil_radius_m': COIL_R,
            'rope_radius_m': ROPE_R,
            'rope_diameter_m': round(ROPE_R * 2, 5),
            'coil_span_full_m': round(X_EXIT - X_START, 5),
            'x_exit_m': X_EXIT,
            'x_start_m': round(X_START, 5),
            'exit_point': [round(X_EXIT, 5), round(-R_END, 5), round(Z_BRANCH, 5)],
            'exit_role': ('передняя точка навивки; конец turn_00; касательная '
                          'вертикальна => ветвь висит вниз'),
            'takeoff_turn': f'{PREFIX}rope_turn_00',
            'takeoff_end_offset_mm': takeoff_mm,
            'takeoff_ring_vertices': takeoff_ring,
            'hide_rule': ('виток i скрывается при L >= L_hide(i); '
                          'L_hide(i) = 0,05 + (12 - i) * 0,03125'),
            'hide_step_m': round(WIND_STEP, 5),
            'hide_table': table,
            'visible_counts': {
                'wound_L_0.05': counts['wound'],
                'mid_L_0.18': counts['mid'],
                'unwound_L_0.30': counts['unwound'],
            },
            'hidden_at_unwound': [f'{PREFIX}rope_turn_{i:02d}'
                                  for i in range(TURNS_MIN, N_TURNS)],
            'note': ('витки — визуальный индекс навивки: шаг снятия 0,03125 м '
                     'на ходе 0,25 м. Физически один оборот барабана = 0,372 м '
                     '(L = θ·R), поэтому «физическая» размотка на этом ходе '
                     'даёт < 1 витка и не читается — схема выбрана для '
                     'читаемости, углы барабана при этом физические.'),
        },
        'render_states': {
            'standard': ('3q/front/side/closeup сняты в состоянии L=0,300 м '
                         '(как GLB): видны turn_00…turn_03, ветвь 0,300 м'),
            'wound': 'L=0,050 м, θ=-4,22 рад, все 12 витков',
            'mid': 'L=0,180 м, θ=-2,03 рад, 8 витков',
            'unwound': 'L=0,300 м, θ=0, 4 витка',
            'note': ('все три состояния сняты ОДНИМ кадром 3q, угол барабана '
                     'θ(L) = (L-0,30)/0,0592 — разница видна по числу витков и '
                     'по длине ветви'),
        },
        'payout': {
            'node': PREFIX + 'rope_payout',
            'node_role': 'пустышка в точке схода троса (не вращается)',
            'payout_point': [round(X_EXIT, 5), round(-R_END, 5), round(Z_BRANCH, 5)],
            'payout_point_fixed': True,
            'branch_node': PREFIX + 'rope_branch',
            'branch_unit_length_m': 1.0,
            'branch_scale_axis_blender': 'z',
            'branch_scale_axis_gltf': 'y',
            'end_node': PREFIX + 'rope_end',
            'end_move_axis_blender': 'z',
            'end_move_axis_gltf': 'y',
            'how': ('three.js: rope_branch.scale.y = L; rope_end.position.y = -L. '
                    'L в метрах (1.0 = 1 м), ветвь тянется вниз по локальной -Y. '
                    'В Blender те же величины по local Z (scale.z / location.z). '
                    'Точка схода неподвижна при любом L. Крюковая подвеска — '
                    'дети rope_end и едут вместе с концом.'),
            'min_m': PAYOUT_MIN,
            'max_m': PAYOUT_MAX,
            'states': {
                'wound': {'payout_m': PAYOUT_MIN, 'turns_visible': counts['wound'],
                          'drum_angle_rad': round(theta_for(PAYOUT_MIN), 4)},
                'mid': {'payout_m': PAYOUT_MID, 'turns_visible': counts['mid'],
                        'drum_angle_rad': round(theta_for(PAYOUT_MID), 4)},
                'unwound': {'payout_m': PAYOUT_MAX, 'turns_visible': counts['unwound'],
                            'drum_angle_rad': 0.0},
            },
            'drum_angle_between_states_deg':
                round(math.degrees((PAYOUT_MAX - PAYOUT_MIN) / COIL_R), 2),
        },
        'kinematics': {
            'law': 'L = (theta - theta0) * coil_radius, theta0 = 0 при L = 0,30',
            'theta_of_L': 'theta(L) = (L - 0.30) / 0.0592',
            'spin_axis': 'x',
            'payout_sign': ('+x вращение = выпуск (ветвь вниз), '
                            '-x вращение = намотка'),
            'm_per_revolution': round(math.tau * COIL_R, 5),
            'turns_per_meter': round(1.0 / (math.tau * COIL_R), 4),
        },
        'integration': {
            'spin': ('вращать motion_winch__anim (или motion_winch__drum) вокруг X; '
                     'витки и фланцы — потомки __drum, поэтому крутятся вместе'),
            'turns': ('по таблице winding.hide_table скрывать/показывать '
                      'rope_turn_XX (visible=false) в зависимости от L'),
            'rope': 'rope_branch.scale.y = L; rope_end.position.y = -L',
            'glb_visibility': ('в GLB присутствуют ВСЕ 12 витков (для управления '
                               'из рантайма); в состоянии L=0,30 видимы только '
                               'turn_00…turn_03 — их и надо оставить, остальные '
                               'скрыть по таблице'),
            'contact': ('стык rope_branch ↔ rope_turn_00 в точке схода — '
                        'расчётный контакт, не коллизия'),
        },
        'free_end': fe_rep,
        'collisions_wound': coll['wound'],
        'collisions_mid': coll['mid'],
        'collisions_unwound': coll['unwound'],
        'turn_overlaps': turns_ovl,
        'collisions_ok': bool(not coll['wound'] and not coll['mid']
                              and not coll['unwound']
                              and not turns_ovl['wound'] and not turns_ovl['mid']
                              and not turns_ovl['unwound']),
        'turns_ok': bool(len(table) == N_TURNS and counts['wound'] == N_TURNS
                         and counts['mid'] == 8 and counts['unwound'] == TURNS_MIN),
        'takeoff_ok': bool(takeoff_mm < 0.5),
        'static_parts': sorted(o.name for o in bpy.data.objects
                               if o.name.startswith(PREFIX) and o.type == 'MESH'
                               and not is_descendant(o, anim)),
        'glb': str(path.relative_to(PROJECT)),
        'glb_bytes': path.stat().st_size,
        'renders': renders,
    })
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)

    ok = (rep['bbox_ok'] and rep['pivot_ok'] and rep['axis_ok']
          and rep['hook_on_end_ok'] and rep['collisions_ok']
          and rep['branch_vertical_ok'] and rep['turns_ok'] and rep['takeoff_ok']
          and fe_rep['joints_ok'] and fe_rep['chain_connected']
          and fe_rep['coaxial_ok'] and fe_rep['rope_gripped']
          and rep['material_count'] >= 4 and rep['material_count'] <= 8
          and rep['glb_bytes'] > 10000
          and abs(rep['branch_length_m'] - PAYOUT_MAX) < 0.001
          and rep['branch_tangency_mm'] < 0.5)
    if not ok:
        raise SystemExit('checks failed: ' + json.dumps({
            k: rep[k] for k in ('bbox_ok', 'pivot_ok', 'axis_ok', 'hook_on_end_ok',
                                'collisions_ok', 'branch_vertical_ok', 'turns_ok',
                                'takeoff_ok', 'branch_tangency_mm',
                                'material_count', 'branch_length_m')}
            | {'fe_clash': fe_rep['internal_clashes'],
               'fe_unconnected': fe_rep['unconnected'],
               'fe_offset_mm': fe_rep['max_center_offset_mm'],
               'fe_grip': fe_rep['rope_gripped'],
               'fe_bbox': [fe_rep['bbox_min'], fe_rep['bbox_max']],
               'fe_drop': fe_rep['total_drop_m']}))


main()