"""Standalone builder: work_tickle_pair (WRK-PAIR-03, «Парные щётки»).

Две НЕЗАВИСИМЫЕ щёточные головки на общей траверсе. Каждая щётка вращается
вокруг СВОЕЙ вертикальной оси через центр СВОЕЙ ступицы:

  work_tickle_pair__anim_node0  @ (+0.165, 0, 0.089)  ось Z, +2.6 рад/с
  work_tickle_pair__anim_node1  @ (-0.165, 0, 0.089)  ось Z, -2.6 рад/с

Общих осей нет: пустышки — соседи (siblings) в корне сцены, наборы детей не
пересекаются. Траверса, редуктор, мотор, плита и ОБА кожуха статичны.
Щётка (диск + ступица + пучки + вал + болты + маркер) висит на своей оси и
крутится внутри неподвижного кожуха.

Не зависит от build_component_library.py. Других GLB не трогает.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_tickle_pair.py

Выход:
  public/models/machine-modules/components/work_tickle_pair.glb
  docs/plans/blockout/component-library/work_tickle_pair/*.png  (4 ракурса + proof)
  docs/plans/blockout/component-library/work_tickle_pair/report.json

Геометрия (Blender Z-up, метры), bbox ≈ 0.596 x 0.264 x 0.252:
  оси щёток   = vertical Z, через (±0.165, 0)
  после export_yup -> glTF Y (вверх), pivot translation = (±0.165, 0.089, 0)
  вращаются (дети своей пустышки): disc, rim, hub, hub_cap, shaft, bristles,
             bolt_0..2, index_tab   (10 мешей на узел, 20 всего)
  статичны:  mount_plate, flange_collar, status_ring, dock_tab, flange_bolt_*,
             gearbox, bevel_gear, gear_hub, pedestal, cross_arm,
             head_flange_*, head_*, guard_*, shroud_post_*,
             motor, motor_cap, motor_band, motor_cradle, cable, connector
"""
from pathlib import Path
import json
import math
import struct

import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/work_tickle_pair'
CID = 'work_tickle_pair'
PREFIX = CID + '__'

# --- размеры (м) ---------------------------------------------------------
D = 0.165                   # центр ступицы от вертикали машины (+/-X)

BACK_R = 0.110              # тарелка щётки (blush)
BACK_Z0, BACK_Z1 = 0.046, 0.074
RIM_IN, RIM_OUT = 0.110, 0.1136
RIM_Z0, RIM_Z1 = 0.0445, 0.0760

HUB_R, HUB_Z0, HUB_Z1 = 0.038, 0.074, 0.104      # ступица: pivot = её центр
HUB_CZ = (HUB_Z0 + HUB_Z1) * 0.5
CAP_IN, CAP_OUT, CAP_Z0, CAP_Z1 = 0.030, 0.038, 0.104, 0.109

SHAFT_R, SHAFT_Z0, SHAFT_Z1 = 0.0115, 0.104, 0.1385
STICK_LEN = 0.046           # корни на нижней плоскости тарелки, кончики на z=0
STICK_R0, STICK_R1 = 0.0044, 0.0026
RINGS = [(0.040, 10), (0.064, 14), (0.088, 18), (0.104, 22)]   # (радиус, шт)

GUARD_RI, GUARD_RO = 0.118, 0.132       # кожух: внутренний зазор до тарелки 4.4 мм
GUARD_Z0, GUARD_Z1 = 0.028, 0.104
GUARD_HALF = math.radians(105.0)

HEAD_BORE = 0.016                       # зазор вал-втулка 4.5 мм
HEADF_OUT, HEADF_Z0, HEADF_Z1 = 0.038, 0.111, 0.118
HEAD_OUT, HEAD_Z0, HEAD_Z1 = 0.030, 0.118, 0.145     # верх точно в низ траверсы

ARM_Z0, ARM_Z1 = 0.145, 0.159
ARM_HALF_X = 0.298
ARM_HALF_Y = 0.024
POST_X = 0.125                          # стойка кожуха, от оси щётки
POST_HX, POST_HY = 0.0065, 0.011

GEARBOX_R, GEARBOX_Z0, GEARBOX_Z1 = 0.052, 0.145, 0.176
GEAR_RL, GEAR_RT = 0.048, 0.034         # коническая шестерня (низ/верх)
GEAR_TIP = 0.0045
GEAR_Z0, GEAR_Z1 = 0.176, 0.194
GEAR_TEETH = 24
GEAR_HUB_R, GEAR_HUB_Z0, GEAR_HUB_Z1 = 0.024, 0.194, 0.206
PED_R, PED_Z0, PED_Z1 = 0.018, 0.206, 0.210

PLATE_X, PLATE_Y, PLATE_Z0, PLATE_Z1 = 0.234, 0.216, 0.210, 0.224
COLLAR_R, COLLAR_Z0, COLLAR_Z1 = 0.046, 0.224, 0.246
RING_MAJOR, RING_MINOR = 0.0435, 0.0028
RING_Z = COLLAR_Z1 + RING_MINOR

MOTOR_R, MOTOR_Z = 0.025, 0.184
MOTOR_Y0, MOTOR_Y1 = -0.121, -0.068     # -Y хвост / +Y фланец
MOTOR_CAP_R, MOTOR_CAP_Y = 0.0225, -0.132   # заглушка снаружи, ровно по bbox

PALETTE = {
    'ivory': (0.945, 0.937, 0.918),
    'blush': (0.905, 0.700, 0.727),
    'pale': (0.960, 0.870, 0.876),
    'graphite': (0.330, 0.341, 0.353),
    'steel': (0.725, 0.729, 0.718),
    'dark': (0.185, 0.192, 0.205),
    'cyan': (0.660, 0.880, 0.910),
}
METAL = {'steel': (0.80, 0.30), 'graphite': (0.32, 0.46), 'dark': (0.20, 0.55),
         'cyan': (0.0, 0.35)}
MATS = {}

# статичные пары, которые соединены сваркой/посадкой (скрытый нахлёст)
WELDS = {
    tuple(sorted(('cross_arm', 'gearbox'))),
    tuple(sorted(('motor', 'motor_cradle'))),
}


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
    metal, rough = METAL.get(role, (0.0, 0.60))
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.2
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
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def cube(name, loc, size, role, r=0.0015, smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
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
    apply(obj, role, smooth)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


def torus(name, loc, major, minor, role, axis='Z', segs=44, rings=10):
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


def curve_tube(name, points, radius, role, res=8):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 12
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


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = Vector(loc)
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = 0.04
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def bmesh_cone(bm, base, direction, length, r1, r2, segments=8):
    d = Vector(direction).normalized()
    m = (Matrix.Translation(Vector(base) + d * (length * 0.5))
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=r1, radius2=r2, depth=length, matrix=m)


def annulus(name, cx, cy, r_in, r_out, z0, z1, role, seg=48, bev=0.0):
    """Кольцо (труба) вокруг вертикальной оси: без «глухой» заглушки."""
    bm = bmesh.new()
    rings = []
    for i in range(seg):
        a = math.tau * i / seg
        ca, sa = math.cos(a), math.sin(a)
        rings.append([
            bm.verts.new((cx + ca * r_in, cy + sa * r_in, z0)),
            bm.verts.new((cx + ca * r_out, cy + sa * r_out, z0)),
            bm.verts.new((cx + ca * r_out, cy + sa * r_out, z1)),
            bm.verts.new((cx + ca * r_in, cy + sa * r_in, z1)),
        ])
    for i in range(seg):
        A, B = rings[i], rings[(i + 1) % seg]
        bm.faces.new((A[0], A[1], B[1], B[0]))
        bm.faces.new((A[1], A[2], B[2], B[1]))
        bm.faces.new((A[2], A[3], B[3], B[2]))
        bm.faces.new((A[3], A[0], B[0], B[3]))
    obj = mesh_from_bm(name, bm, role)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


def arc_shell_z(name, cx, cy, s, r_in, r_out, a0, a1, z0, z1, seg, role, bev=0.0):
    """Сектор обечайки вокруг вертикальной оси Z (a=0 -> наружу +X*s)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for z in (z0, z1):
            for r in (r_in, r_out):
                ring.append(bm.verts.new((cx + s * ca * r, cy + sa * r, z)))
        rings.append(ring)   # [in_z0, out_z0, in_z1, out_z1]
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        bm.faces.new((a_[0], a_[2], b_[2], b_[0]))
        bm.faces.new((a_[1], b_[1], b_[3], a_[3]))
        bm.faces.new((a_[0], b_[0], b_[1], a_[1]))
        bm.faces.new((a_[2], a_[3], b_[3], b_[2]))
    bm.faces.new(tuple(rings[0]))
    bm.faces.new(tuple(reversed(rings[-1])))
    obj = mesh_from_bm(name, bm, role)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


def star_cone(name, cx, cy, z0, z1, r0, r1, teeth, tip, role, seg_per_tooth=4):
    """Коническая шестерня: звездчатый профиль (зубья — часть того же меша)."""
    bm = bmesh.new()
    n = teeth * seg_per_tooth
    # доля шага -> (радиус-множитель, впадина/вершина)
    frac = [(0.00, 0.0), (0.18, 1.0), (0.34, 1.0), (0.52, 0.0)]
    if seg_per_tooth != 4:
        raise ValueError('star_cone: только 4 сэмпла на зуб')
    ring_bot, ring_top = [], []
    for k in range(teeth):
        for fr, is_tip in frac:
            a = math.tau * (k + fr) / teeth
            ca, sa = math.cos(a), math.sin(a)
            ring_bot.append(bm.verts.new((cx + ca * (r0 + tip * is_tip),
                                          cy + sa * (r0 + tip * is_tip), z0)))
            ring_top.append(bm.verts.new((cx + ca * (r1 + tip * is_tip * 0.75),
                                          cy + sa * (r1 + tip * is_tip * 0.75), z1)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ring_bot[i], ring_bot[j], ring_top[j], ring_top[i]))
    c_bot = bm.verts.new((cx, cy, z0))
    c_top = bm.verts.new((cx, cy, z1))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((c_bot, ring_bot[j], ring_bot[i]))
        bm.faces.new((c_top, ring_top[i], ring_top[j]))
    return mesh_from_bm(name, bm, role)


# --- сборка --------------------------------------------------------------
def brush_node(s, tag, rotating):
    """Одна щётка на СВОЕЙ оси (cx,0). s=+1 -> +X, s=-1 -> -X."""
    cx = s * D
    n = lambda part: f'{PREFIX}node{tag}_{part}'

    disc = cyl(n('disc'), (cx, 0, BACK_Z0), (cx, 0, BACK_Z1), BACK_R,
               'blush', vertices=56, bev=0.0032)
    rim = annulus(n('rim'), cx, 0.0, RIM_IN, RIM_OUT, RIM_Z0, RIM_Z1,
                  'graphite', seg=56, bev=0.0010)
    hub = cyl(n('hub'), (cx, 0, HUB_Z0), (cx, 0, HUB_Z1), HUB_R,
              'graphite', vertices=40, bev=0.0022)
    cap = annulus(n('hub_cap'), cx, 0.0, CAP_IN, CAP_OUT, CAP_Z0, CAP_Z1,
                  'blush', seg=40, bev=0.0008)
    shaft = cyl(n('shaft'), (cx, 0, SHAFT_Z0), (cx, 0, SHAFT_Z1), SHAFT_R,
                'steel', vertices=24)

    # пучки: корни точно на нижней плоскости тарелки (без «утопания»)
    bm = bmesh.new()
    for rad, count in RINGS:
        for k in range(count):
            a = math.tau * k / count
            base = (cx + math.cos(a) * rad, math.sin(a) * rad, BACK_Z0)
            bmesh_cone(bm, base, (0, 0, -1), STICK_LEN, STICK_R0, STICK_R1, 6)
    bristles = mesh_from_bm(n('bristles'), bm, 'pale')

    parts = [disc, rim, hub, cap, shaft, bristles]

    for k in range(3):
        a = math.radians(30 + 120 * k)
        bx, by = cx + math.cos(a) * 0.082, math.sin(a) * 0.082
        parts.append(cyl(n(f'bolt_{k}'), (bx, by, BACK_Z1), (bx, by, BACK_Z1 + 0.007),
                         0.0085, 'steel', vertices=6))

    # индекс-маркер фазы: сразу видно, что диск крутится вокруг ступицы
    parts.append(cube(n('index_tab'), (cx, 0.084, BACK_Z1 + 0.0025),
                      (0.026, 0.009, 0.005), 'dark', r=0.0012))

    rotating += parts
    return parts


def build():
    reset()
    rotating = []

    # ---- две щётки, каждая на своей оси --------------------------------
    brush_node(+1, '0', rotating)
    brush_node(-1, '1', rotating)

    # ---- статичные втулки/подшипники над ступицами ---------------------
    for s, tag in ((+1, '0'), (-1, '1')):
        cx = s * D
        annulus(f'{PREFIX}head_flange_{tag}', cx, 0.0, HEAD_BORE, HEADF_OUT,
                HEADF_Z0, HEADF_Z1, 'graphite', seg=40, bev=0.0012)
        annulus(f'{PREFIX}head_{tag}', cx, 0.0, HEAD_BORE, HEAD_OUT,
                HEAD_Z0, HEAD_Z1, 'graphite', seg=40, bev=0.0012)

    # ---- траверса (статична): несёт обе втулки и стойки кожухов ---------
    cube(f'{PREFIX}cross_arm', (0, 0, (ARM_Z0 + ARM_Z1) * 0.5),
         (ARM_HALF_X * 2, ARM_HALF_Y * 2, ARM_Z1 - ARM_Z0), 'ivory', r=0.0045)
    for s, tag in ((+1, '0'), (-1, '1')):
        px = s * (D + POST_X)
        # прижимная лапка на кромке кожуха: стык «стойка -> кожух» читается
        cube(f'{PREFIX}shroud_foot_{tag}', (s * (D + 0.122), 0, GUARD_Z1 + 0.003),
             (0.020, 0.030, 0.006), 'ivory', r=0.0012)
        cube(f'{PREFIX}shroud_post_{tag}', (px, 0, (GUARD_Z1 + 0.006 + ARM_Z0) * 0.5),
             (POST_HX * 2, POST_HY * 2, ARM_Z0 - GUARD_Z1 - 0.006), 'ivory', r=0.0018)
        arc_shell_z(f'{PREFIX}guard_{tag}', s * D, 0.0, s, GUARD_RI, GUARD_RO,
                    -GUARD_HALF, GUARD_HALF, GUARD_Z0, GUARD_Z1, 30, 'ivory',
                    bev=0.0022)

    # ---- редуктор (статичен) -------------------------------------------
    cyl(f'{PREFIX}gearbox', (0, 0, GEARBOX_Z0), (0, 0, GEARBOX_Z1), GEARBOX_R,
        'graphite', vertices=40, bev=0.0034)
    star_cone(f'{PREFIX}bevel_gear', 0.0, 0.0, GEAR_Z0, GEAR_Z1, GEAR_RL, GEAR_RT,
              GEAR_TEETH, GEAR_TIP, 'steel')
    cyl(f'{PREFIX}gear_hub', (0, 0, GEAR_HUB_Z0), (0, 0, GEAR_HUB_Z1),
        GEAR_HUB_R, 'graphite', vertices=32, bev=0.0018)
    cyl(f'{PREFIX}pedestal', (0, 0, PED_Z0), (0, 0, PED_Z1), PED_R,
        'steel', vertices=24, bev=0.0010)

    # ---- монтажная плита / фланец (статичны, верх) ---------------------
    cube(f'{PREFIX}mount_plate', (0, 0, (PLATE_Z0 + PLATE_Z1) * 0.5),
         (PLATE_X, PLATE_Y, PLATE_Z1 - PLATE_Z0), 'ivory', r=0.0075)
    cyl(f'{PREFIX}flange_collar', (0, 0, COLLAR_Z0), (0, 0, COLLAR_Z1),
        COLLAR_R, 'ivory', vertices=40, bev=0.0028)
    torus(f'{PREFIX}status_ring', (0, 0, RING_Z), RING_MAJOR, RING_MINOR, 'cyan', 'Z')
    cube(f'{PREFIX}dock_tab', (0, 0.078, PLATE_Z1 + 0.003),
         (0.052, 0.014, 0.006), 'ivory', r=0.0022)
    for k in range(4):
        bx = 0.086 if k % 2 == 0 else -0.086
        by = 0.080 if k < 2 else -0.080
        cyl(f'{PREFIX}flange_bolt_{k}', (bx, by, PLATE_Z1),
            (bx, by, PLATE_Z1 + 0.008), 0.0080, 'steel', vertices=6)

    # ---- мотор (статичен, горизонтально вдоль -Y под плитой) ----------
    cyl(f'{PREFIX}motor', (0, MOTOR_Y1, MOTOR_Z), (0, MOTOR_Y0, MOTOR_Z),
        MOTOR_R, 'graphite', vertices=44, bev=0.0035)
    cyl(f'{PREFIX}motor_cap', (0, MOTOR_Y0, MOTOR_Z), (0, MOTOR_CAP_Y, MOTOR_Z),
        MOTOR_CAP_R, 'steel', vertices=36, bev=0.0024)
    # декоративное кольцо-обойма: внутренний радиус больше корпуса мотора
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=0.0288, depth=0.007,
                                        location=(0, -0.0725, MOTOR_Z))
    band = bpy.context.object
    band.name = f'{PREFIX}motor_band'
    band.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.mesh.delete(type='ONLY_FACE')
    bpy.ops.object.mode_set(mode='OBJECT')
    solid = band.modifiers.new('solid', 'SOLIDIFY')
    solid.thickness = 0.0038
    solid.offset = -1.0
    select_only(band)
    bpy.ops.object.modifier_apply(modifier=solid.name)
    apply(band, 'blush', True)

    # седло мотора -> плита, кабель и разъём
    cube(f'{PREFIX}motor_cradle', (0, -0.096, 0.2035), (0.048, 0.032, 0.013),
         'graphite', r=0.0022)
    curve_tube(f'{PREFIX}cable',
               [(0.031, -0.118, 0.192),
                (0.040, -0.098, 0.200),
                (0.046, -0.078, 0.205)], 0.0035, 'graphite')
    cube(f'{PREFIX}connector', (0.046, -0.068, 0.205), (0.012, 0.014, 0.010),
         'graphite', r=0.0020)

    # ---- ДВЕ независимые анимационные пустышки, каждая в центре ступицы
    bpy.context.view_layer.update()
    nodes = []
    for s, tag, speed in ((+1, '0', 2.6), (-1, '1', -2.6)):
        e = empty(f'{PREFIX}anim_node{tag}', (s * D, 0.0, HUB_CZ))
        e.rotation_mode = 'XYZ'
        e['motion'] = 'spin'
        e['spin_axis'] = 'Y'            # glTF Y (после export_yup) = Blender Z
        e['spin_axis_blender'] = 'Z'
        e['spin_speed'] = speed         # рад/с, щётки встречные
        e['spin_pivot'] = 'hub_center'
        e['node_index'] = int(tag)
        nodes.append(e)

    bpy.context.view_layer.update()
    kids = [o for o in rotating]
    # разбиение детей по своей оси: по знаку X центра меша
    for e, tag in ((nodes[0], '0'), (nodes[1], '1')):
        for o in kids:
            cx = sum((o.matrix_world @ Vector(c))[0] for c in o.bound_box) / 8.0
            mine = (cx > 0.0) == (tag == '0')
            if mine:
                parent(o, e)
                o['rotating'] = True
                o['pivot_node'] = e.name
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in kids:
            o['rotating'] = False
        if o.name.startswith(PREFIX):
            o['machine_module'] = CID
            o['module_class'] = 'WORK'

    bpy.context.view_layer.update()
    return nodes, rotating


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


def verts_world(obj):
    mw = obj.matrix_world
    return [mw @ v.co for v in obj.data.vertices]


def tree_world(obj):
    return BVHTree.FromPolygons(verts_world(obj),
                                [tuple(p.vertices) for p in obj.data.polygons],
                                all_triangles=False, epsilon=0.0)


def pivot_metrics(node):
    """Ось пустышки в мире + расхождение с геометрией вала/ступицы/диска."""
    bpy.context.view_layer.update()
    axis = (node.matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
    c = node.matrix_world.translation
    out = {'pivot': node.name, 'axis_world': [round(v, 6) for v in axis],
           'pivot_loc': [round(v, 5) for v in c]}
    for part in ('shaft', 'hub', 'disc', 'bristles', 'rim'):
        obj = bpy.data.objects.get(f'{node.name.replace("anim_node", "node")}_{part}')
        if obj is None:
            continue
        mn, mx = mesh_bbox([obj])
        mid = (mn + mx) * 0.5
        out[f'{part}_center'] = [round(v, 5) for v in mid]
        out[f'{part}_axis_offset_mm'] = round(math.hypot(mid.x - c.x,
                                                         mid.y - c.y) * 1000.0, 4)
        out[f'{part}_size'] = [round(v, 5) for v in (mx - mn)]
    return out


def pivot_test(node, own_kids, other_kids):
    """Крутим ТОЛЬКО этот pivot: r/z своих вершин и ВСЯ вторая группа неизменны."""
    bpy.context.view_layer.update()
    own0 = [(p.x - node.matrix_world.translation.x,
             p.y - node.matrix_world.translation.y, p.z)
            for o in own_kids for p in verts_world(o)]
    oth0 = [p.copy() for o in other_kids for p in verts_world(o)]
    worst_r = worst_z = worst_other = 0.0
    for deg in (90.0, 180.0, 270.0, 45.0):
        node.rotation_euler = (0.0, 0.0, math.radians(deg))
        bpy.context.view_layer.update()
        c = node.matrix_world.translation
        for (x0, y0, z0), p in zip(own0,
                                  [p for o in own_kids for p in verts_world(o)]):
            r0 = math.hypot(x0, y0)
            r1 = math.hypot(p.x - c.x, p.y - c.y)
            worst_r = max(worst_r, abs(r1 - r0))
            worst_z = max(worst_z, abs(p.z - z0))
        for a, p in zip(oth0, [p for o in other_kids for p in verts_world(o)]):
            worst_other = max(worst_other, (p - a).length)
    node.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    return worst_r, worst_z, worst_other


def point_inside(tree, p):
    """Чётность пересечений луча +X -> точка внутри замкнутого меша."""
    o = Vector(p)
    d = Vector((1.0, 0.0, 0.0))
    hits = 0
    for _ in range(96):
        loc, _nor, _idx, _dist = tree.ray_cast(o, d)
        if loc is None:
            break
        hits += 1
        o = loc + d * 1e-6
    return hits % 2 == 1


def penetration(a, ta, b, tb, step=0.0012):
    """Объём взаимного проникновения двух мешей (мм^3) + оценка глубины.

    Касание (совпадающие грани) даёт ~0: пересечение вырождено по объёму.
    """
    amn, amx = mesh_bbox([a])
    bmn, bmx = mesh_bbox([b])
    lo = Vector((max(amn[i], bmn[i]) for i in range(3)))
    hi = Vector((min(amx[i], bmx[i]) for i in range(3)))
    if any(hi[i] - lo[i] <= 1e-5 for i in range(3)):
        return 0.0, 0.0, 0
    dims = [hi[i] - lo[i] for i in range(3)]
    n = [max(1, min(40, int(math.ceil(dims[i] / step)))) for i in range(3)]
    step_i = [dims[i] / n[i] for i in range(3)]
    vol = step_i[0] * step_i[1] * step_i[2] * 1e9        # мм^3 на точку
    cnt = 0
    depth = 0.0
    for ix in range(n[0]):
        x = lo.x + step_i[0] * (ix + 0.5)
        for iy in range(n[1]):
            y = lo.y + step_i[1] * (iy + 0.5)
            for iz in range(n[2]):
                p = Vector((x, y, lo.z + step_i[2] * (iz + 0.5)))
                if not (point_inside(ta, p) and point_inside(tb, p)):
                    continue
                cnt += 1
                da = ta.find_nearest(p)[3]
                db = tb.find_nearest(p)[3]
                depth = max(depth, min(da if da is not None else 9.9,
                                       db if db is not None else 9.9))
    return cnt * vol, depth * 1000.0, cnt


def near(a, b, pad=0.05):
    amn, amx = mesh_bbox([a])
    bmn, bmx = mesh_bbox([b])
    if any(amn[i] > bmx[i] + pad or bmn[i] > amx[i] + pad for i in range(3)):
        return False
    dmn = Vector((max(amn[i], bmn[i]) for i in range(3)))
    dmx = Vector((min(amx[i], bmx[i]) for i in range(3)))
    gap = math.sqrt(sum(max(0.0, dmn[i] - dmx[i]) ** 2 for i in range(3)))
    return gap <= pad


def min_gap(o, trees):
    """Минимальное расстояние вершин объекта до набора статичных поверхностей."""
    best = 9.9
    for p in verts_world(o):
        for tr in trees:
            res = tr.find_nearest(p)
            if res[0] is not None and res[3] < best:
                best = res[3]
    return best


def clearance_check(nodes, rotating):
    """Проникновение объёмов: вращающееся x статика (24 угла), узел x узел, статика x статика."""
    static = [o for o in bpy.data.objects
              if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in rotating]
    by_node = {n.name: [o for o in n.children if o.type == 'MESH'] for n in nodes}

    static_trees = {o.name: tree_world(o) for o in static}
    rot_static_hits = []
    gaps = []
    for node in nodes:
        for deg in range(0, 360, 15):
            node.rotation_euler = (0.0, 0.0, math.radians(deg))
            bpy.context.view_layer.update()
            for o in by_node[node.name]:
                tr = tree_world(o)
                for so in static:
                    if not near(o, so, 0.012):
                        continue
                    if not tr.overlap(static_trees[so.name]):
                        continue
                    vol, depth, cnt = penetration(o, tr, so, static_trees[so.name])
                    if vol > 2.0:
                        rot_static_hits.append([o.name, so.name, deg,
                                                round(vol, 3), round(depth, 3)])
        node.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    # зазор щётки до статики (без пучков — они тонкие и медленные)
    for node in nodes:
        for deg in (0, 90, 180, 270):
            node.rotation_euler = (0.0, 0.0, math.radians(deg))
            bpy.context.view_layer.update()
            for o in by_node[node.name]:
                if o.name.endswith('bristles'):
                    continue
                cand = [static_trees[so.name] for so in static if near(o, so, 0.05)]
                if cand:
                    gaps.append(min_gap(o, cand))
        node.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    # узел 0 x узел 1 (в разных фазах)
    cross_hits = []
    a, b = nodes
    for deg in (0, 45, 90, 135):
        a.rotation_euler = (0, 0, math.radians(deg))
        b.rotation_euler = (0, 0, math.radians(-deg - 30))
        bpy.context.view_layer.update()
        for o0 in by_node[a.name]:
            t0 = tree_world(o0)
            for o1 in by_node[b.name]:
                if not near(o0, o1, 0.01):
                    continue
                t1 = tree_world(o1)
                if not t0.overlap(t1):
                    continue
                vol, depth, cnt = penetration(o0, t0, o1, t1)
                if vol > 2.0:
                    cross_hits.append([o0.name, o1.name, deg, round(vol, 3)])
    a.rotation_euler = (0, 0, 0)
    b.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    static_pairs = []
    for i, o0 in enumerate(static):
        for o1 in static[i + 1:]:
            if not near(o0, o1, 0.002):
                continue
            t0, t1 = static_trees[o0.name], static_trees[o1.name]
            if not t0.overlap(t1):
                continue
            vol, depth, cnt = penetration(o0, t0, o1, t1)
            short = tuple(sorted((o0.name.replace(PREFIX, '').rstrip('0123456789_'),
                                  o1.name.replace(PREFIX, '').rstrip('0123456789_'))))
            static_pairs.append({'pair': [o0.name.replace(PREFIX, ''),
                                          o1.name.replace(PREFIX, '')],
                                 'volume_mm3': round(vol, 3),
                                 'depth_mm': round(depth, 3),
                                 'weld': short in WELDS,
                                 'contact_only': vol <= 2.0})
    return rot_static_hits, cross_hits, static_pairs, (min(gaps) if gaps else None)


def check(nodes, rotating):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size, center = mx - mn, (mn + mx) * 0.5

    kids = {n.name: [o for o in n.children if o.type == 'MESH'] for n in nodes}
    metrics = [pivot_metrics(n) for n in nodes]
    tests = []
    for i, n in enumerate(nodes):
        own = kids[n.name]
        other = [o for o in rotating if o not in own]
        wr, wz, wo = pivot_test(n, own, other)
        tests.append({'pivot': n.name,
                      'children': sorted(o.name for o in own),
                      'children_count': len(own),
                      'radial_dev_m': wr, 'z_dev_m': wz,
                      'other_group_shift_m': wo,
                      'ok': bool(wr < 1e-6 and wz < 1e-6 and wo < 1e-9)})

    rot_static, cross, static_pairs, min_clear = clearance_check(nodes, rotating)
    bad_static = [p for p in static_pairs if not p['contact_only'] and not p['weld']]
    welds_used = [p['pair'] for p in static_pairs
                  if not p['contact_only'] and p['weld']]

    worst_pivot_mm = max(m['shaft_axis_offset_mm'] for m in metrics)
    rep = {
        'component': CID,
        'revision': 'WRK-PAIR-03 two independent coaxial brush axes',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_objects': len(all_mesh),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(abs(size.x - 0.596) < 0.004 and abs(size.y - 0.264) < 0.004
                        and abs(size.z - 0.252) < 0.004),
        'pivots': [{'name': n.name, 'loc': [round(v, 5) for v in n.location],
                    'spin_speed': n['spin_speed'], 'spin_axis_gltf': n['spin_axis'],
                    'spin_axis_blender': n['spin_axis_blender']} for n in nodes],
        'pivot_metrics': metrics,
        'pivot_tests': tests,
        'worst_shaft_axis_offset_mm': round(worst_pivot_mm, 4),
        'pivot_offset_ok': bool(worst_pivot_mm <= 1.0),
        'rotating_static_overlaps': rot_static[:20],
        'rotating_static_overlap_count': len(rot_static),
        'rotating_cross_overlaps': cross[:20],
        'rotating_cross_overlap_count': len(cross),
        'static_pairs_all': static_pairs,
        'static_welds_used': welds_used,
        'static_unwelded_overlaps': bad_static,
        'min_clearance_to_static_mm': round((min_clear or 0.0) * 1000.0, 3),
        'clearance_ok': bool(not rot_static and not cross and not bad_static),
        'rotating_children_total': sum(len(v) for v in kids.values()),
        'tufts_total': sum(c for _, c in RINGS) * 2,
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'static_parts': sorted(o.name for o in all_mesh if o not in rotating),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    rep['children_ok'] = bool(sorted(o.name for v in kids.values() for o in v)
                              == sorted(o.name for o in rotating))
    # точные pivot-дельты: пустышка -> центр ступицы / ось каждого тела вращения
    deltas = []
    for m, n in zip(metrics, nodes):
        d_hub = math.dist(m['pivot_loc'], m['hub_center']) * 1000.0
        deltas.append({
            'pivot': m['pivot'],
            'pivot_loc_blender': m['pivot_loc'],
            'hub_center': m['hub_center'],
            'pivot_to_hub_center_mm': round(d_hub, 6),
            'axis_offset_mm': {'hub': m['hub_axis_offset_mm'],
                               'disc': m['disc_axis_offset_mm'],
                               'shaft': m['shaft_axis_offset_mm'],
                               'bristles': m['bristles_axis_offset_mm'],
                               'rim': m['rim_axis_offset_mm']},
            'max_axis_offset_mm': round(max(m['hub_axis_offset_mm'],
                                            m['disc_axis_offset_mm'],
                                            m['shaft_axis_offset_mm'],
                                            m['bristles_axis_offset_mm'],
                                            m['rim_axis_offset_mm']), 6),
        })
    rep['pivot_deltas_mm'] = deltas
    rep['pivot_deltas_max_mm'] = round(max(d['pivot_to_hub_center_mm'] for d in deltas), 6)
    rep['kinematics'] = {
        'independent_axes': True,
        'shared_parent': None,
        'axes': [{
            'node': n.name,
            'axis_gltf': 'Y',
            'axis_blender': 'Z',
            'axis_world_blender': [0.0, 0.0, 1.0],
            'pivot_blender_m': [round(v, 6) for v in n.location],
            'pivot_gltf_m': [round(n.location.x, 6), round(n.location.z, 6),
                             round(-n.location.y, 6)],
            'spin_rad_s': n['spin_speed'],
            'direction': 'CCW seen from +Z (right-hand rule)' if n['spin_speed'] > 0
                         else 'CW seen from +Z (right-hand rule)',
        } for n in nodes],
        'integration': ('rotate each node about its own local Y by '
                        'angle += spin_rad_s * dt; nodes are siblings in the scene root, '
                        'so no parent transform is shared; brushes counter-rotate'),
    }
    tris = 0
    for o in all_mesh:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    rep['triangles'] = tris
    return rep


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


# --- GLB: независимая проверка каждого pivot -----------------------------
def glb_json(path):
    raw = path.read_bytes()
    assert raw[:4] == b'glTF', 'not a GLB'
    off = 12
    while off < len(raw):
        ln, ty = struct.unpack_from('<II', raw, off)
        off += 8
        if ty == 0x4E4F534A:
            return json.loads(raw[off:off + ln].decode('utf-8'))
        off += ln
    raise RuntimeError('no JSON chunk')


def m4(node):
    if 'matrix' in node:
        m = node['matrix']
        return [[m[0], m[4], m[8], m[12]], [m[1], m[5], m[9], m[13]],
                [m[2], m[6], m[10], m[14]], [m[3], m[7], m[11], m[15]]]
    t = node.get('translation', [0, 0, 0])
    q = node.get('rotation', [0, 0, 0, 1])   # x,y,z,w
    s = node.get('scale', [1, 1, 1])
    x, y, z, w = q
    r = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
         [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
         [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]]
    return [[r[i][j] * s[j] for j in range(3)] + [t[i]] for i in range(3)] + \
           [[0, 0, 0, 1]]


def mmul(a, b):
    return [[sum(a[i][k] * b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]


def glb_check(path, rep):
    js = glb_json(path)
    nodes = js['nodes']
    names = [n.get('name', '') for n in nodes]
    idx = {n: i for i, n in enumerate(names)}
    child_of = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            child_of[c] = i

    # мировые матрицы через граф
    world = {}

    def wm(i):
        if i in world:
            return world[i]
        p = child_of.get(i)
        world[i] = m4(nodes[i]) if p is None else mmul(wm(p), m4(nodes[i]))
        return world[i]

    out = {'glb_nodes': len(nodes), 'glb_meshes': len(js.get('meshes', [])),
           'glb_materials': [m.get('name') for m in js.get('materials', [])],
           'glb_animations': len(js.get('animations', [])),
           'glb_bytes': path.stat().st_size}
    pivots = []
    for tag in ('0', '1'):
        pname = f'{PREFIX}anim_node{tag}'
        i = idx.get(pname)
        if i is None:
            raise RuntimeError(f'pivot {pname} missing in GLB')
        kids = [names[c] for c in nodes[i].get('children', [])]
        t = wm(i)[0][3], wm(i)[1][3], wm(i)[2][3]
        # локальная геометрия детей: bbox меша через accessor min/max
        entry = {
            'pivot': pname,
            'gltf_translation': [round(v, 5) for v in t],
            'children': sorted(kids),
            'children_count': len(kids),
            'extras': nodes[i].get('extras', {}),
            'parent_is_root': i not in child_of,
        }
        per_part = {}
        for c in nodes[i].get('children', []):
            mn_ = [1e9] * 3
            mx_ = [-1e9] * 3
            for prim in js['meshes'][nodes[c]['mesh']]['primitives']:
                acc = js['accessors'][prim['attributes']['POSITION']]
                for k in range(3):
                    mn_[k] = min(mn_[k], acc['min'][k])
                    mx_[k] = max(mx_[k], acc['max'][k])
            cw = wm(c)
            pts = [[x, y, z] for x in (mn_[0], mx_[0])
                   for y in (mn_[1], mx_[1]) for z in (mn_[2], mx_[2])]
            wt = [[sum(cw[r][k] * p[k] for k in range(3)) + cw[r][3] for r in range(3)]
                  for p in pts]
            cmn = [min(p[r] for p in wt) for r in range(3)]
            cmx = [max(p[r] for p in wt) for r in range(3)]
            per_part[names[c]] = [(a + b) * 0.5 for a, b in zip(cmn, cmx)]
        # в glTF горизонтальная плоскость = X,Z; ось = Y
        entry['part_centers_xz'] = {k: [round(v[0], 5), round(v[2], 5)]
                                    for k, v in per_part.items()}
        offs = {}
        for part, ctr in per_part.items():
            short = part.rsplit('_', 1)[-1]
            if short in ('shaft', 'hub', 'disc', 'bristles', 'rim'):
                offs[short] = round(math.hypot(ctr[0] - t[0], ctr[2] - t[2]) * 1000, 4)
        entry['axis_offset_mm'] = offs
        entry['max_axis_offset_mm'] = max(offs.values()) if offs else None
        entry['axis_offset_ok'] = bool(offs and max(offs.values()) <= 1.0)
        # вал: высота по Y, диаметр по X/Z -> ось вертикальна и соосна
        sh = per_part.get(f'{PREFIX}node{tag}_shaft')
        entry['shaft_center_xz'] = [round(sh[0], 5), round(sh[2], 5)] if sh else None
        pivots.append(entry)

    out['glb_pivots'] = pivots
    out['glb_pivots_ok'] = bool(all(p['axis_offset_ok'] and p['parent_is_root']
                                    for p in pivots))
    # независимость: наборы детей не пересекаются, ни один pivot не потомок другого
    s0, s1 = set(pivots[0]['children']), set(pivots[1]['children'])
    out['glb_children_disjoint'] = bool(not (s0 & s1) and s0 and s1)
    out['glb_pivot0_children'] = sorted(s0)
    out['glb_pivot1_children'] = sorted(s1)

    # поворот pivot0 на 90° в графе: мировые матрицы второй группы не меняются
    i0, i1 = idx[f'{PREFIX}anim_node0'], idx[f'{PREFIX}anim_node1']
    before = {names[c]: wm(c) for c in nodes[i1].get('children', [])}
    rot = m4({'rotation': [0.0, math.sin(math.radians(45)), 0.0,
                           math.cos(math.radians(45))], 'translation': list(
        nodes[i0].get('translation', [0, 0, 0]))})
    saved = world.pop(i0, None)
    world[i0] = rot
    after = {}
    for c in nodes[i1].get('children', []):
        world.pop(c, None)
        after[names[c]] = wm(c)
    shift = 0.0
    for k in before:
        for r in range(3):
            for c in range(4):
                shift = max(shift, abs(before[k][r][c] - after[k][r][c]))
    world.pop(i0, None)
    if saved is not None:
        world[i0] = saved
    out['glb_other_group_shift_m'] = round(shift, 12)
    out['glb_independent_ok'] = bool(shift < 1e-12)
    return out


# --- рендеры -------------------------------------------------------------
def render_scene(glb):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.render.resolution_x, sc.render.resolution_y = 1280, 1040
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    sc.view_settings.exposure = 0.05
    try:
        sc.eevee.taa_render_samples = 96
    except Exception:
        pass
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.880, 0.872, 0.856, 1.0)
    bg.inputs['Strength'].default_value = 0.62

    bpy.ops.import_scene.gltf(filepath=str(glb))
    bpy.context.view_layer.update()
    return sc


def measure(exclude=('render_floor',)):
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in bpy.context.scene.objects:
        if o.type != 'MESH' or o.name in exclude or o.name.startswith('PROOF'):
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def studio(center, floor_z):
    sc = bpy.context.scene
    bpy.ops.mesh.primitive_plane_add(size=3.0, location=(center.x, center.y, floor_z))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.760, 0.752, 0.738, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.52, -0.58, 0.66), 7.2, 0.30),
            ('fill', (-0.60, -0.44, 0.34), 1.5, 0.54),
            ('rim', (0.06, 0.60, 0.46), 3.0, 0.40)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((center.x, center.y, center.z * 0.9))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()
    return floor


def make_cam():
    sc = bpy.context.scene
    cd = bpy.data.cameras.new('cam')
    cd.lens = 72
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    sc.camera = cam
    return cam


def cam_basis(direction):
    q = Vector(direction).normalized().to_track_quat('Z', 'Y')
    return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized()


def fit_dist(cam, direction, corners, margin=1.10):
    sc = bpy.context.scene
    right, up, back = cam_basis(direction)
    sensor = cam.data.sensor_width
    sx, sy = sc.render.resolution_x, sc.render.resolution_y
    sw = sensor if sx >= sy else sensor * sx / sy
    sh = sensor * sy / sx if sx >= sy else sensor
    th = sw * 0.5 / cam.data.lens
    tv = sh * 0.5 / cam.data.lens
    need = 0.0
    for p in corners:
        need = max(need, abs(p.dot(right)) / th + p.dot(back),
                   abs(p.dot(up)) / tv + p.dot(back))
    return need * margin


def box_corners(a, b):
    return [Vector((x, y, z)) for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]


def render_views(glb):
    sc = render_scene(glb)
    mn, mx = measure()
    center = (mn + mx) * 0.5
    size = mx - mn
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx],
          'size', [round(v, 4) for v in size], flush=True)
    studio(center, mn.z - 0.0015)
    cam = make_cam()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    from bpy_extras.object_utils import world_to_camera_view

    mesh_objs = [o for o in sc.objects
                 if o.type == 'MESH' and o.name != 'render_floor'
                 and not o.name.startswith('PROOF')]

    def max_ndc(objs):
        worst = 0.0
        for o in objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(sc, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    c_main = box_corners(mn - center, mx - center)
    # крупный план: правая щётка целиком (тарелка + ступица + втулка + кожух)
    t_close = Vector((D, 0.0, 0.072))
    close_objs = []
    for o in mesh_objs:
        omn, omx = Vector((1e9,) * 3), Vector((-1e9,) * 3)
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                omn[i] = min(omn[i], p[i])
                omx[i] = max(omx[i], p[i])
        if ((omn + omx) * 0.5 - t_close).length <= 0.115:
            close_objs.append(o)
    c_close = []
    for o in close_objs:
        omn, omx = Vector((1e9,) * 3), Vector((-1e9,) * 3)
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                omn[i] = min(omn[i], p[i])
                omx[i] = max(omx[i], p[i])
        c_close += box_corners(omn - t_close, omx - t_close)

    views = [
        ('3q',      (0.94, -1.00, 0.52), center + Vector((0.006, 0, 0.004)),
         72, c_main, 0.90, None, mesh_objs),
        ('front',   (0.03, -1.00, 0.24), center + Vector((0, 0, 0.006)),
         72, c_main, 0.90, None, mesh_objs),
        ('side',    (1.00, -0.40, 0.30), center + Vector((-0.010, 0.006, 0.006)),
         72, c_main, 0.90, None, mesh_objs),
        ('closeup', (-0.60, -0.90, 0.36), t_close,
         92, c_close, 0.94, None, close_objs),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, fixed, objs in views:
        cam.data.lens = lens
        dirn = Vector(direction).normalized()
        dist = fixed if fixed else fit_dist(cam, direction, corners)
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(6):
            got = max_ndc(objs)
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        sc.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} dist={dist:.3f} ndc={max_ndc(objs):.3f} '
              f'ndc_all={max_ndc(mesh_objs):.3f}', flush=True)
    return outs, mn, mx


def render_proof(glb):
    """Диагностический кадр: щётки повёрнуты на разные углы, оси показаны."""
    sc = render_scene(glb)
    mn, mx = measure()
    center = (mn + mx) * 0.5
    studio(center, mn.z - 0.0015)
    cam = make_cam()

    axes = {}
    for tag, deg in (('0', 46.0), ('1', -104.0)):
        e = bpy.data.objects.get(f'{PREFIX}anim_node{tag}')
        if e is None:
            raise RuntimeError(f'imported pivot {tag} not found')
        e.rotation_mode = 'XYZ'
        e.rotation_euler = (0.0, 0.0, math.radians(deg))
        axes[tag] = (list(e.matrix_world.translation), e)
    bpy.context.view_layer.update()

    proof_mat = bpy.data.materials.new('PROOF_axis')
    proof_mat.use_nodes = True
    bsdf = proof_mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.10, 0.55, 0.85, 1.0)
    bsdf.inputs['Emission Color'].default_value = (0.10, 0.55, 0.85, 1.0)
    bsdf.inputs['Emission Strength'].default_value = 3.2
    for tag, (loc, _) in axes.items():
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.0013, depth=0.30,
                                            location=(loc[0], loc[1], 0.185))
        rod = bpy.context.object
        rod.name = f'PROOF_axis{tag}'
        rod.data.materials.append(proof_mat)
        # метка на уровне диска: сразу видно, что ось проходит через центр тарелки
        bpy.ops.mesh.primitive_torus_add(major_segments=32, minor_segments=6,
                                         major_radius=0.018, minor_radius=0.0012,
                                         location=(loc[0], loc[1], 0.074))
        ring = bpy.context.object
        ring.name = f'PROOF_ring{tag}'
        ring.data.materials.append(proof_mat)
        # радиальный «флажок фазы»: посажен ВНУТРЬ пустышки, крутится вместе с ней
        bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0))
        bar = bpy.context.object
        bar.name = f'PROOF_phase{tag}'
        bar.scale = (0.096, 0.006, 0.0022)
        bar.data.materials.append(proof_mat)
        bar.parent = axes[tag][1]
        bar.location = (0.052, 0.0, 0.0751 - HUB_CZ)
        bar.rotation_mode = 'XYZ'

    cam.data.lens = 70
    dirn = Vector((0.72, -1.00, 0.72)).normalized()
    corners = box_corners(mn - center, mx - center)
    dist = fit_dist(cam, dirn, corners)
    cam.location = center + dirn * dist
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.context.view_layer.update()
    fp = RENDER_DIR / f'{CID}_axes_proof.png'
    sc.render.filepath = str(fp)
    bpy.ops.render.render(write_still=True)
    print('RENDERED proof', {k: [round(v, 4) for v in a[0]] for k, a in axes.items()},
          flush=True)
    return str(fp.relative_to(PROJECT))


def main():
    nodes, rotating = build()
    rep = check(nodes, rotating)
    path = export()
    rep.update(glb_check(path, rep))
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size

    checks = {
        'bbox': bool(rep['bbox_ok']),
        'pivot_at_hub_center': bool(rep['pivot_offset_ok']),
        'pivot_rotation_tests': bool(all(t['ok'] for t in rep['pivot_tests'])),
        'rotating_vs_static_overlap': rep['rotating_static_overlap_count'] == 0,
        'rotating_node0_vs_node1_overlap': rep['rotating_cross_overlap_count'] == 0,
        'static_penetration': not rep['static_unwelded_overlaps'],
        'clearance': bool(rep['clearance_ok']),
        'children_cover_rotating': bool(rep['children_ok']),
        'glb_pivots': bool(rep['glb_pivots_ok']),
        'glb_children_disjoint': bool(rep['glb_children_disjoint']),
        'glb_independent_axes': bool(rep['glb_independent_ok']),
        'glb_axis_offsets': bool(all(p['axis_offset_ok'] for p in rep['glb_pivots'])),
        'glb_no_shared_parent': bool(all(p['parent_is_root'] for p in rep['glb_pivots'])),
        'materials': rep['material_count'] >= 4,
    }
    rep['checks'] = checks
    rep['checks_ok'] = bool(all(checks.values()))
    rep['checks_failed'] = sorted(k for k, v in checks.items() if not v)

    if not rep['checks_ok']:
        print('REPORT ' + json.dumps(rep, ensure_ascii=False, default=str), flush=True)
        raise SystemExit('checks failed: ' + ', '.join(rep['checks_failed']))

    shots, imn, imx = render_views(path)
    rep['renders'] = shots
    rep['glb_import_bbox_min'] = [round(v, 5) for v in imn]
    rep['glb_import_bbox_max'] = [round(v, 5) for v in imx]
    rep['render_proof'] = render_proof(path)

    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    slim = {k: v for k, v in rep.items()
            if k not in ('static_parts', 'pivot_metrics', 'rotating_static_overlaps',
                         'rotating_cross_overlaps', 'glb_pivots', 'static_pairs_all')}
    print('REPORT ' + json.dumps(slim, ensure_ascii=False, default=str), flush=True)


main()
