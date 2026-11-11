"""Standalone builder: work_probe_linear (WRK-PEN-01, «Линейный зонд»).

Компактный разъёмный линейный зонд Ø46 × ~186 мм на быстросъёмной муфте:
розовый корпус-рукоятка с продольным рифлением, светлая шкала хода с делениями
и красной меткой, циановый датчик в тёмной обойме, стальная быстросъёмная муфта
с отжимным рычагом, стальная цанга, латунная направляющая втулка-раструб,
выдвижной стальной шток, сменный наконечник (латунная обойма с резьбой,
шейка, силиконовый скруглённый колпачок). Плиты/основания нет — зонд ложится
на плоскость корпусом.

ОСЬ. Каталог компонентов задаёт для этого узла `model.motion.axis = "z"` и
зритель двигает пустышку `<prefix>anim` вдоль three.js Z. Поэтому продольная
ось зонда (ось штока) обязана совпадать с glTF/three.js Z. После export_yup
Blender (x, y, z) -> glTF (x, z, -y), т.е. three.js +Z == Blender -Y. Модель
строится вдоль Blender -Y: положительный ход = к наконечнику (+Z в three.js).

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_probe_linear.py

Выход:
  public/models/machine-modules/components/work_probe_linear.glb
  docs/plans/blockout/component-library/work_probe_linear/work_probe_linear_{3q,front,side,closeup}.png
  docs/plans/blockout/component-library/work_probe_linear/report.json

Геометрия (Blender Z-up, метры, s = станция вдоль оси, +s к наконечнику):
  ось        = линия x=0, z=Z_AX=0.0255
  задний колпачок  s -0.0860..-0.0800
  корпус           s -0.0800..0.0000, Ø46.4 (рифление -0.0660..-0.0280)
  шкала            s -0.0300..-0.0100, Ø49.2
  муфта (сталь)    s  0.0000..0.0130, Ø42
  цанга            s  0.0130..0.0240, Ø35.2
  втулка-раструб   s  0.0240..0.0760, Ø33.6 -> Ø24 (латунь)
  шток             s -0.0100..0.0885 (снаружи 0.0760..0.0885)
  наконечник       s  0.0760..0.0973

Анимация: пустышка `work_probe_linear__anim` в (0, 0, Z_AX) — на оси штока;
slide по three.js Z (= Blender -Y), 0.10 м, 0.9 рад/с. Двигаются rod, rod_end,
tip_ferrule, tip_thread_0/1, tip_neck, tip_ball; корпус, цанга, быстросъём,
втулка, датчик, кабель статичны. Бэйк-экшенов нет (движение задаёт приложение).
"""
from pathlib import Path
import json
import math
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/work_probe_linear'
CID = 'work_probe_linear'
PREFIX = CID + '__'

# --- оси -----------------------------------------------------------------
# продольная ось зонда: Blender -Y == glTF/three.js +Z (export_yup)
AXIS = Vector((0.0, -1.0, 0.0))
AXIS_BLENDER = '-Y'
AXIS_THREE = '+Z'
Z_AX = 0.0255                  # высота оси над полом

# --- ключевые размеры (м, станции вдоль оси) ------------------------------
S_CAP0, S_CAP1 = -0.0820, -0.0760
S_BODY0, S_BODY1 = -0.0760, 0.0000
R_BODY = 0.0232
S_COUPL0, S_COUPL1 = 0.0000, 0.0130
R_COUPL = 0.0210
S_COLLET0, S_COLLET1 = 0.0130, 0.0240
S_BELL0, S_BELL1 = 0.0238, 0.0760     # латунная втулка-раструб
BORE_BELL = 0.0102
BORE_SHAFT = 0.0046
S_ROD0, S_ROD1 = -0.0100, 0.0885
R_ROD = 0.0044
S_FERR0, S_FERR1 = 0.0760, 0.0818     # латунная обойма наконечника
S_NECK0, S_NECK1 = 0.0818, 0.0862
TIP_BALL_C, TIP_BALL_R = 0.0896, 0.0068
TIP_BALL_SY = 1.15                    # вытянутость колпачка вдоль оси
S_TIP_FRONT = TIP_BALL_C + TIP_BALL_R * TIP_BALL_SY   # 0.09742

S_BAND0, S_BAND1 = -0.0335, -0.0150   # шкала хода
R_BAND = 0.0246
S_KNURL0, S_KNURL1 = -0.0640, -0.0345
KNURL_N, R_KNURL = 38, 0.0228
# в шкале оставлен пропуск под красную метку
TICK_S = [-0.0320 + i * 0.0028 for i in range(6) if i != 3]
TRAVEL_MARK_S = -0.0236
SENSOR_S = -0.0072

MOTION_AMOUNT = 0.10
MOTION_SPEED = 0.9
STROKE = MOTION_AMOUNT * 0.5          # приложение: amount*0.5*sin(t) -> ±50 мм

PALETTE = {
    'shell': (0.905, 0.730, 0.755),     # blush-розовый кожух
    'steel': (0.705, 0.710, 0.705),
    'graphite': (0.255, 0.263, 0.273),
    'brass': (0.760, 0.585, 0.305),
    'ivory': (0.958, 0.948, 0.928),
    'silicone': (0.930, 0.925, 0.902),
    'cyan': (0.300, 0.860, 0.930),
    'red': (0.720, 0.080, 0.070),
}
# роль -> (roughness, metallic, emission_strength)
MATSPEC = {
    'shell': (0.46, 0.00, 0.00),
    'steel': (0.30, 0.90, 0.00),
    'graphite': (0.52, 0.35, 0.00),
    'brass': (0.34, 0.92, 0.00),
    'ivory': (0.48, 0.00, 0.00),
    'silicone': (0.42, 0.00, 0.00),
    'cyan': (0.24, 0.00, 0.50),
    'red': (0.42, 0.00, 0.00),
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
    rough, metal, emit = MATSPEC[role]
    m = bpy.data.materials.new(f'CJ_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit > 0.0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
        mod = obj.modifiers.new('es', 'EDGE_SPLIT')
        mod.use_edge_angle = True
        mod.split_angle = math.radians(38)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


def bevel(obj, width=0.0012, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def P(s, x=0.0, h=0.0):
    """Точка по станции s вдоль оси зонда: x — поперёк, h — по высоте от оси."""
    return Vector((x, -s, Z_AX + h))


def cube(name, center, size, role, r=0.0010, smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        select_only(obj)
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


def sphere(name, center, radius, role, segs=32, rings=20, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


def torus(name, center, major, minor, role, axis='Y', segs=48, rings=10):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=center)
    obj = bpy.context.object
    obj.name = name
    if axis == 'Y':           # ось кольца вдоль оси зонда
        obj.rotation_euler = (math.pi / 2, 0, 0)
    elif axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
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
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def bm_radial_boxes(bm, s_mid, radius, n, size, phase=0.0,
                    skip_center=None, skip_half=0.0):
    """n радиальных рёбер вокруг оси: size = (тангенциально, вдоль оси, радиально).

    skip_center/skip_half — пропуск рёбер вокруг заданного угла (там садится
    отжимной рычаг), угол отсчитывается от +Z к +X.
    """
    for k in range(n):
        a = math.tau * k / n + phase
        if skip_center is not None:
            da = abs(math.atan2(math.sin(a - skip_center), math.cos(a - skip_center)))
            if da < skip_half:
                continue
        c = Vector((math.sin(a) * radius, -s_mid, Z_AX + math.cos(a) * radius))
        m = (Matrix.Translation(c) @ Matrix.Rotation(a, 4, 'Y')
             @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def lathe(name, stations, role, bore=None, seg=56, smooth=True):
    """Тело вращения вокруг оси зонда. stations = [(s, r), ...]; bore — канал."""
    bm = bmesh.new()
    ang = [math.tau * k / seg for k in range(seg)]

    def ring(s, r):
        return [bm.verts.new((math.sin(a) * r, -s, Z_AX + math.cos(a) * r))
                for a in ang]

    outer = [ring(s, r) for s, r in stations]
    for i in range(len(outer) - 1):
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((outer[i][k], outer[i][k2],
                          outer[i + 1][k2], outer[i + 1][k]))
    if bore is None:
        bm.faces.new(tuple(reversed(outer[0])))
        bm.faces.new(tuple(outer[-1]))
    else:
        inner = [ring(s, bore) for s, _ in stations]
        for i in range(len(inner) - 1):
            for k in range(seg):
                k2 = (k + 1) % seg
                bm.faces.new((inner[i][k2], inner[i][k],
                              inner[i + 1][k], inner[i + 1][k2]))
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((outer[0][k], inner[0][k], inner[0][k2], outer[0][k2]))
            bm.faces.new((outer[-1][k], outer[-1][k2], inner[-1][k2], inner[-1][k]))
    return mesh_from_bm(name, bm, role, smooth)


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


# --- сборка --------------------------------------------------------------
def build():
    reset()
    moving = []

    # ---- корпус-рукоятка (розовый, полый: ось штока проходит внутри) -----
    lathe(PREFIX + 'body_housing', [
        (S_BODY0, 0.0118),
        (S_BODY0 + 0.0028, 0.0192),
        (S_BODY0 + 0.0058, 0.0222),
        (S_BODY0 + 0.0092, R_BODY),
        (-0.0100, R_BODY),
        (-0.0040, 0.0222),
        (S_BODY1, 0.0202),
    ], 'shell', bore=0.0105, seg=56)

    # продольное рифление рукоятки
    bm = bmesh.new()
    s_mid = (S_KNURL0 + S_KNURL1) * 0.5
    bm_radial_boxes(bm, s_mid, R_KNURL, KNURL_N,
                    (0.0017, S_KNURL1 - S_KNURL0, 0.0022))
    mesh_from_bm(PREFIX + 'housing_knurl', bm, 'shell', smooth=False)

    # ---- задний колпачок + разгрузка кабеля ------------------------------
    cyl(PREFIX + 'end_cap', P(S_CAP0), P(S_CAP1), 0.0180, 'graphite',
        vertices=48, bev=0.0022)
    torus(PREFIX + 'end_cap_ring', P(S_CAP1 - 0.0012), 0.0182, 0.0016, 'steel')
    cyl(PREFIX + 'strain_relief', P(-0.0855, -0.0055, -0.0090),
        P(-0.0770, -0.0055, -0.0090), 0.0046, 'graphite', vertices=24,
        r2=0.0042, bev=0.0006)
    curve_tube(PREFIX + 'cable',
               [P(-0.0868, -0.0055, -0.0090),
                P(-0.0878, -0.0165, -0.0160),
                P(-0.0835, -0.0262, -0.0200),
                P(-0.0755, -0.0308, -0.0212),
                P(-0.0660, -0.0312, -0.0213)], 0.0030, 'graphite')
    cube(PREFIX + 'connector', P(-0.0560, -0.0310, -0.0211),
         (0.0090, 0.0145, 0.0080), 'graphite', r=0.0018)
    bm = bmesh.new()
    for dx in (-0.0022, 0.0022):
        c = P(-0.0487, -0.0310 + dx, -0.0211)
        m = (Matrix.Translation(c) @ Matrix.Diagonal((0.0020, 0.0020, 0.0020, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    mesh_from_bm(PREFIX + 'connector_pins', bm, 'brass', smooth=False)

    # ---- шкала хода: светлая кольцевая полоса, деления, красная метка ----
    lathe(PREFIX + 'scale_band', [(S_BAND0, R_BAND), (S_BAND1, R_BAND)],
          'ivory', bore=R_BODY - 0.0002, seg=64)
    bm = bmesh.new()
    for ts in TICK_S:
        c = P(ts, 0.0, R_BAND - 0.0004)
        m = (Matrix.Translation(c) @ Matrix.Diagonal((0.0072, 0.0009, 0.0012, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    mesh_from_bm(PREFIX + 'scale_ticks', bm, 'graphite', smooth=False)
    bm = bmesh.new()
    c = P(TRAVEL_MARK_S, 0.0, R_BAND - 0.0003)
    m = (Matrix.Translation(c) @ Matrix.Diagonal((0.0032, 0.0016, 0.0022, 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    mesh_from_bm(PREFIX + 'travel_mark', bm, 'red', smooth=False)

    # ---- датчик (циановое окно в тёмной обойме) на верхней грани ---------
    cyl(PREFIX + 'sensor_bezel', P(SENSOR_S, 0, 0.0180), P(SENSOR_S, 0, 0.0234),
        0.0042, 'graphite', vertices=24, bev=0.0006)
    cyl(PREFIX + 'sensor_lens', P(SENSOR_S, 0, 0.0226), P(SENSOR_S, 0, 0.0252),
        0.0029, 'cyan', vertices=24, bev=0.0005)
    torus(PREFIX + 'sensor_bezel_ring', P(SENSOR_S, 0, 0.0235), 0.0036, 0.0007,
          'graphite', axis='Z', segs=32, rings=8)

    # ---- быстросъёмная муфта (сталь, отжимной рычаг) ---------------------
    lathe(PREFIX + 'coupler', [
        (S_COUPL0, 0.0204),
        (S_COUPL0 + 0.0006, R_COUPL),
        (S_COUPL1 - 0.0006, R_COUPL),
        (S_COUPL1, 0.0204),
    ], 'steel', bore=BORE_SHAFT, seg=56)
    bm = bmesh.new()
    bm_radial_boxes(bm, 0.0065, 0.0211, 24, (0.0020, 0.0085, 0.0024),
                    skip_center=math.pi / 2, skip_half=math.radians(14.0))
    mesh_from_bm(PREFIX + 'coupler_knurl', bm, 'graphite', smooth=False)
    torus(PREFIX + 'coupler_ring', P(0.0006), 0.0216, 0.0013, 'steel')
    cube(PREFIX + 'release_lever', (0.0245, -0.0078, Z_AX),
         (0.0086, 0.0090, 0.0060), 'steel', r=0.0014)
    cube(PREFIX + 'release_lever_pad', (0.0292, -0.0078, Z_AX),
         (0.0032, 0.0082, 0.0048), 'graphite', r=0.0012)
    cyl(PREFIX + 'release_lever_screw', (0.0170, -0.0046, Z_AX),
        (0.0205, -0.0046, Z_AX), 0.0021, 'steel', vertices=16)

    # ---- цанга (статична, сталь) с графитовым рифлением ------------------
    lathe(PREFIX + 'collet', [
        (S_COLLET0, 0.0166),
        (S_COLLET0 + 0.0008, 0.0176),
        (S_COLLET1 - 0.0008, 0.0176),
        (S_COLLET1, 0.0170),
    ], 'steel', bore=BORE_SHAFT, seg=56)
    bm = bmesh.new()
    bm_radial_boxes(bm, 0.0185, 0.0175, 22, (0.0016, 0.0080, 0.0018))
    mesh_from_bm(PREFIX + 'collet_knurl', bm, 'graphite', smooth=False)

    # ---- направляющая втулка-раструб (латунь, статична) ------------------
    lathe(PREFIX + 'guide_bushing', [
        (S_BELL0, 0.0168),
        (0.0280, 0.0158),
        (0.0330, 0.0146),
        (0.0400, 0.0136),
        (0.0600, 0.0124),
        (0.0700, 0.0122),
        (S_BELL1, 0.0120),
    ], 'brass', bore=BORE_BELL, seg=56)
    # грязесъёмное кольцо на устье раструба
    torus(PREFIX + 'wiper_seal', P(S_BELL1 + 0.0004), 0.0096, 0.0020,
          'graphite', segs=40, rings=10)

    # ---- шток (движется) -------------------------------------------------
    moving.append(cyl(PREFIX + 'rod', P(S_ROD0), P(S_ROD1), R_ROD, 'steel',
                      vertices=28))
    moving.append(cyl(PREFIX + 'rod_end', P(S_ROD1 - 0.0012), P(S_ROD1),
                      R_ROD * 0.80, 'steel', vertices=28))

    # ---- сменный контактный наконечник (движется вместе со штоком) ------
    moving.append(cyl(PREFIX + 'tip_ferrule', P(S_FERR0), P(S_FERR1), 0.0062,
                      'brass', vertices=32, bev=0.0006))
    for i, ts in enumerate((S_FERR0 + 0.0018, S_FERR0 + 0.0034)):
        moving.append(torus(PREFIX + f'tip_thread_{i}', P(ts), 0.0063, 0.0006,
                            'brass', segs=32, rings=8))
    moving.append(cyl(PREFIX + 'tip_neck', P(S_NECK0), P(S_NECK1), 0.0056,
                      'steel', vertices=28))
    moving.append(sphere(PREFIX + 'tip_ball', P(TIP_BALL_C), TIP_BALL_R,
                         'silicone', scale=(1.0, TIP_BALL_SY, 1.0)))

    # ---- анимационная пустышка на оси штока ------------------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z_AX))
    anim['motion_type'] = 'slide'
    anim['motion_axis'] = 'z'                       # three.js Z == Blender -Y
    anim['motion_axis_blender'] = AXIS_BLENDER
    anim['motion_amount'] = MOTION_AMOUNT
    anim['motion_speed'] = MOTION_SPEED
    anim['motion_parts'] = json.dumps([o.name[len(PREFIX):] for o in moving])
    anim['motion_note'] = ('slide along three.js Z (Blender -Y) = probe/rod '
                           'axis; positive = tip forward')

    bpy.context.view_layer.update()
    for o in moving:
        parent(o, anim)
        o['moving'] = True
        o['part'] = o.name[len(PREFIX):]
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in moving:
            o['moving'] = False
            o['part'] = o.name[len(PREFIX):]
    bpy.context.view_layer.update()
    return anim, moving


# --- проверки ------------------------------------------------------------
def mesh_objs():
    return [o for o in bpy.data.objects
            if o.name.startswith(PREFIX) and o.type == 'MESH']


def verts_world(objects):
    bpy.context.view_layer.update()
    pts = []
    for o in objects:
        mw = o.matrix_world
        pts.extend(mw @ v.co for v in o.data.vertices)
    return pts


def stats(objects):
    pts = verts_world(objects)
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def bvh(o):
    mw = o.matrix_world
    verts = [mw @ v.co for v in o.data.vertices]
    polys = [list(p.vertices) for p in o.data.polygons]
    return BVHTree.FromPolygons(verts, polys, all_triangles=False, epsilon=0.0)


def overlaps(pairs):
    out = []
    for a, b in pairs:
        ta, tb = bvh(a), bvh(b)
        if ta.overlap(tb):
            out.append(tuple(sorted((a.name[len(PREFIX):], b.name[len(PREFIX):]))))
    return sorted(set(out))


def obj_box(o):
    mw = o.matrix_world
    pts = [mw @ Vector(c) for c in o.bound_box]
    return (Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts))),
            Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts))))


def boxes_hit(a, b, pad=0.0006):
    return all(a[0][i] <= b[1][i] + pad and b[0][i] <= a[1][i] + pad
               for i in range(3))


def bbox_overlap(a, b, tol=0.0):
    return boxes_hit(obj_box(a), obj_box(b), tol)


def set_slide(anim, base, d):
    anim.location = base + AXIS * d
    bpy.context.view_layer.update()


def check(anim, moving):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = mesh_objs()
    static = [o for o in meshes if o not in moving]
    mn, mx = stats(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    # --- ось: длиннейшая ось bbox (Blender) и соответствие каталогу ------
    axis_idx = max(range(3), key=lambda i: size[i])
    axis_letter = 'XYZ'[axis_idx]
    second = sorted(size)[-2]

    # --- шток: направление методом главных компонент ---------------------
    import numpy as np
    rod = bpy.data.objects[PREFIX + 'rod']
    rpts = np.array([[(rod.matrix_world @ v.co).x, (rod.matrix_world @ v.co).y,
                      (rod.matrix_world @ v.co).z] for v in rod.data.vertices])
    rmm = rpts - rpts.mean(axis=0)
    evals, evecs = np.linalg.eigh(rmm.T @ rmm)
    rdir = evecs[:, int(np.argmax(evals))]
    rdir = rdir / np.linalg.norm(rdir)
    rod_axis = Vector((float(rdir[0]), float(rdir[1]), float(rdir[2])))
    if rod_axis.dot(AXIS) < 0:
        rod_axis = -rod_axis
    rod_angle_deg = math.degrees(math.acos(max(-1.0, min(1.0, rod_axis.dot(AXIS)))))
    r_mn, r_mx = stats([rod])
    rod_center = (r_mn + r_mx) * 0.5
    rod_axis_off = math.hypot(rod_center.x, rod_center.z - Z_AX)

    # --- все движущиеся детали центрированы на оси ------------------------
    m_mn, m_mx = stats(moving)
    m_c = (m_mn + m_mx) * 0.5
    moving_off = math.hypot(m_c.x, m_c.z - Z_AX)
    max_part_off = 0.0
    for o in moving:
        omn, omx = stats([o])
        oc = (omn + omx) * 0.5
        max_part_off = max(max_part_off, math.hypot(oc.x, oc.z - Z_AX))

    # --- pivot: пустышка на оси штока --------------------------------------
    pivot_lat = math.hypot(anim.location.x, anim.location.z - Z_AX)

    # --- slide-тест: bbox смещается только вдоль оси -----------------------
    base = anim.location.copy()
    samples = {}
    for d in (-STROKE, 0.0, STROKE):
        set_slide(anim, base, d)
        smn, smx = stats(meshes)
        samples[d] = (smn, smx)
    rest = samples[0.0]
    # поперечный дрейф габарита всей модели (мм) на всём ходе
    lat_drift = 0.0
    for i in range(3):
        if i == axis_idx:
            continue
        for d in (-STROKE, STROKE):
            lat_drift = max(lat_drift, abs(samples[d][0][i] - rest[0][i]),
                            abs(samples[d][1][i] - rest[1][i]))
    # габарит группы «движется»: все шесть граней, сдвиг строго по оси
    mover_faces = {}
    for d in (-STROKE, 0.0, STROKE):
        set_slide(anim, base, d)
        mmn, mmx = stats(moving)
        mover_faces[d] = (mmn, mmx)
    m_rest = mover_faces[0.0]
    mover_axis_shift = [(mover_faces[STROKE][1][axis_idx] - m_rest[1][axis_idx]),
                        (mover_faces[-STROKE][1][axis_idx] - m_rest[1][axis_idx])]
    mover_lat_drift = 0.0
    for i in range(3):
        if i == axis_idx:
            continue
        for d in (-STROKE, STROKE):
            mover_lat_drift = max(mover_lat_drift,
                                  abs(mover_faces[d][0][i] - m_rest[0][i]),
                                  abs(mover_faces[d][1][i] - m_rest[1][i]))
    bbox_slide_ok = bool(lat_drift <= 0.0002 and mover_lat_drift <= 0.0002
                         and abs(mover_axis_shift[0] + STROKE) <= 1e-5
                         and abs(mover_axis_shift[1] - STROKE) <= 1e-5)

    # --- статика заморожена ------------------------------------------------
    s0 = stats(static)
    set_slide(anim, base, STROKE)
    s1 = stats(static)
    static_delta = max(abs(s1[0][i] - s0[0][i]) for i in range(3))
    # смещение группы «движется» на всём ходе — строго вдоль оси
    mover_off_axis = 0.0
    for d in (-STROKE, STROKE):
        dv = ((mover_faces[d][0] + mover_faces[d][1]) * 0.5
              - (m_rest[0] + m_rest[1]) * 0.5)
        mover_off_axis = max(mover_off_axis, (dv - AXIS * dv.dot(AXIS)).length)
    # фактический ход наконечника (по bbox) и его передняя точка в покое
    tip = bpy.data.objects[PREFIX + 'tip_ball']
    set_slide(anim, base, -STROKE)
    tmn, tmx = stats([tip])
    tip_back = (tmn + tmx) * 0.5
    set_slide(anim, base, STROKE)
    tmn, tmx = stats([tip])
    tip_fwd = (tmn + tmx) * 0.5
    tip_travel = (tip_fwd - tip_back).dot(AXIS)

    # --- pivot-тест: поворот вокруг оси не должен двигать bbox ----------
    set_slide(anim, base, 0.0)
    c0 = (stats(moving)[0] + stats(moving)[1]) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, math.radians(90.0), 0.0)   # вокруг Blender Y
    bpy.context.view_layer.update()
    c1 = (stats(moving)[0] + stats(moving)[1]) * 0.5
    rot_shift = (c1 - c0).length
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    # --- пересечения: движущееся <-> статика на трёх положениях ----------
    sboxes = {o: obj_box(o) for o in static}
    collisions = {}
    for d in (-STROKE, 0.0, STROKE):
        set_slide(anim, base, d)
        mboxes = {o: obj_box(o) for o in moving}
        pairs = [(a, b) for a in moving for b in static
                 if boxes_hit(mboxes[a], sboxes[b])]
        collisions[f'{d:+.3f}'] = overlaps(pairs)
    set_slide(anim, base, 0.0)
    collide_total = sum(len(v) for v in collisions.values())

    # --- пересечения внутри статики (с учётом штатных посадок) ------------
    MATE_RULES = (
        ('body_housing', 'housing_knurl'),
        ('body_housing', 'scale_band'),
        ('body_housing', 'end_cap'),
        ('body_housing', 'sensor_bezel'),
        ('body_housing', 'sensor_lens'),
        ('body_housing', 'sensor_bezel_ring'),
        ('body_housing', 'coupler'),
        ('scale_band', 'scale_ticks'),
        ('scale_band', 'travel_mark'),
        ('sensor_bezel', 'sensor_lens'),
        ('sensor_bezel', 'sensor_bezel_ring'),
        ('sensor_lens', 'sensor_bezel_ring'),
        ('end_cap', 'end_cap_ring'),
        ('end_cap', 'strain_relief'),
        ('strain_relief', 'cable'),
        ('cable', 'connector'),
        ('connector', 'connector_pins'),
        ('coupler', 'coupler_knurl'),
        ('coupler', 'coupler_ring'),
        ('coupler', 'release_lever'),
        ('coupler', 'release_lever_screw'),
        ('coupler', 'collet'),
        ('release_lever', 'release_lever_pad'),
        ('release_lever', 'release_lever_screw'),
        ('collet', 'collet_knurl'),
        ('collet', 'guide_bushing'),
        ('guide_bushing', 'wiper_seal'),
    )
    mates = set(tuple(sorted(m)) for m in MATE_RULES)
    spairs = [(a, b) for i, a in enumerate(static) for b in static[i + 1:]
              if bbox_overlap(a, b, 0.0005)]
    static_overlaps = overlaps(spairs)
    unplanned = [p for p in static_overlaps if p not in mates]

    # --- читаемость и паспорт --------------------------------------------
    body = bpy.data.objects[PREFIX + 'body_housing']
    b_mn, b_mx = stats([body])
    t_mn, t_mx = stats([tip])

    materials = sorted({m.name for o in meshes for m in o.data.materials if m})
    for o in meshes:
        o.data.calc_loop_triangles()
    report = {
        'component': CID,
        'code': 'WRK-PEN-01',
        'name': 'Линейный зонд',
        'nodes': len(objs),
        'mesh_nodes': len(meshes),
        'objects_total': len(bpy.data.objects),
        'verts': sum(len(o.data.vertices) for o in meshes),
        'tris': sum(len(o.data.loop_triangles) for o in meshes),
        'axis': {
            'catalog_motion_axis_three': 'z',
            'blender_axis': AXIS_BLENDER,
            'three_axis': AXIS_THREE,
            'gltf_axis_index': 2,
            'bbox_longest_axis_blender': axis_letter,
            'bbox_longest_axis_three': 'Z',
            'longest_vs_second_ratio': round(size[axis_idx] / max(second, 1e-9), 2),
            'match_catalog': bool(axis_idx == 1 and size[1] > 1.6 * second),
            'why': ('export_yup: Blender (x,y,z) -> glTF (x,z,-y); the rod axis '
                    'is built along Blender -Y, so in glTF/three.js it is +Z, '
                    'exactly the axis the catalog drives'),
        },
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_blender': [round(v, 5) for v in size],
        'bbox_size_mm': [round(v * 1000, 1) for v in size],
        'bbox_size_three_xyz': [round(size[0], 5), round(size[2], 5), round(size[1], 5)],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok_0.20x0.075x0.075': bool(size[1] <= 0.200 and size[0] <= 0.075
                                         and size[2] <= 0.075),
        'floor_contact_mm': round(mn.z * 1000, 3),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'body_diam_mm': round((b_mx.x - b_mn.x) * 1000, 1),
        'body_len_mm': round((b_mx.y - b_mn.y) * 1000, 1),
        'rod_len_mm': round((r_mx.y - r_mn.y) * 1000, 1),
        'rod_diam_mm': round((r_mx.x - r_mn.x) * 1000, 1),
        'rod_dir_blender': [round(v, 4) for v in rod_axis],
        'rod_angle_to_axis_deg': round(rod_angle_deg, 4),
        'rod_axis_offset_mm': round(rod_axis_off * 1000, 4),
        'moving_center_offset_mm': round(moving_off * 1000, 4),
        'moving_part_max_offset_mm': round(max_part_off * 1000, 4),
        'pivot_lateral_mm': round(pivot_lat * 1000, 4),
        'pivot_rot90_shift_mm': round(rot_shift * 1000, 4),
        'pivot_ok': bool(pivot_lat < 1e-4 and rot_shift < 0.001),
        'stroke_m': STROKE * 2,
        'stroke_applied_m': MOTION_AMOUNT,
        'tip_travel_m': round(tip_travel, 5),
        'tip_front_rest_m': round(-t_mn.y, 5),
        'slide_bbox_lateral_drift_mm': round(lat_drift * 1000, 4),
        'slide_mover_lateral_drift_mm': round(mover_lat_drift * 1000, 4),
        'slide_mover_axis_shift_m': [round(v, 5) for v in mover_axis_shift],
        'slide_mover_off_axis_mm': round(mover_off_axis * 1000, 5),
        'slide_static_delta_m': static_delta,
        'slide_ok': bool(bbox_slide_ok and mover_off_axis <= 0.0002
                         and static_delta <= 1e-6),
        'collisions_moving_vs_static': collisions,
        'collisions_total': collide_total,
        'static_overlaps': static_overlaps,
        'static_overlaps_unplanned': unplanned,
        'materials': materials,
        'material_count': len(materials),
        'nodes_list': sorted(o.name for o in objs),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_extras': {k: anim[k] for k in anim.keys() if k != '_RNA_UI'},
        'anim_children': sorted(o.name for o in anim.children),
        'anim_children_count': len(anim.children),
        'static_meshes': sorted(o.name for o in static),
        'actions': [a.name for a in bpy.data.actions],
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
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
        export_animations=False,
    )
    if not path.is_file() or path.stat().st_size < 20000:
        raise RuntimeError(f'export too small: {path}')
    return path


# --- рендеры -------------------------------------------------------------
def render_glb(path=None):
    """4 ракурса по уже экспортированному GLB (независимая проверка выгрузки)."""
    path = Path(path) if path else OUT / f'{CID}.glb'
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 96
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.955, 0.950, 0.938, 1)
    bg.inputs['Strength'].default_value = 0.34

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.0003))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.855, 0.842, 0.822, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=0.075, fill_type='NGON',
                                      location=(0, -0.012, -0.0002))
    shadow = bpy.context.object
    shadow.name = 'contact_shadow'
    shadow.scale = (0.60, 1.62, 1.0)
    ms = bpy.data.materials.new('contact')
    ms.use_nodes = True
    bs = ms.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (0.50, 0.48, 0.47, 1)
    bs.inputs['Roughness'].default_value = 1.0
    bs.inputs['Alpha'].default_value = 0.20
    ms.surface_render_method = 'BLENDED'
    shadow.data.materials.append(ms)

    for name, direction, energy in [
        ('key', (0.55, -1.20, 1.40), 1.15),
        ('fill', (-1.30, -0.75, 0.60), 0.42),
        ('rim', (0.15, 1.25, 0.95), 0.70),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(18)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()

    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()

    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in sc.objects:
        if o.type != 'MESH' or o.name in ('Plane', 'contact_shadow'):
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    center = (mn + mx) * 0.5
    size = mx - mn
    print('IMPORTED bbox mm', [round(v * 1000, 1) for v in size], flush=True)

    def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=90,
             res=(1180, 780)):
        sc.render.resolution_x, sc.render.resolution_y = res
        cam = bpy.data.objects.get('cam')
        if cam is None:
            cd = bpy.data.cameras.new('cam')
            cam = bpy.data.objects.new('cam', cd)
            sc.collection.objects.link(cam)
        sc.camera = cam
        d = Vector(direction).normalized()
        if ortho_scale:
            cam.data.type = 'ORTHO'
            cam.data.ortho_scale = ortho_scale
            cam.location = Vector(target) + d * 1.2
        else:
            cam.data.type = 'PERSP'
            cam.data.lens = lens
            cam.location = Vector(target) + d * dist
        cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = str(RENDER_DIR / f'{CID}_{name}.png')
        bpy.ops.render.render(write_still=True)
        print('RENDER', sc.render.filepath, flush=True)
        return sc.render.filepath

    long_side = max(size.x, size.y, size.z)
    out = []
    out.append(shot('3q', (0.95, -1.25, 0.82), center, ortho_scale=long_side * 1.16))
    out.append(shot('front', (0.10, -1.0, 0.12), (0.0, -0.070, Z_AX),
                    ortho_scale=0.086, res=(900, 780)))
    out.append(shot('side', (1.0, 0.10, 0.10), center, ortho_scale=long_side * 1.12))
    out.append(shot('closeup', (0.85, -0.95, 0.52), (0.0, -0.062, Z_AX),
                    dist=0.165, lens=95, res=(1000, 820)))
    return out


# --- main ----------------------------------------------------------------
def main():
    anim, moving = build()
    rep = check(anim, moving)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['glb_ok_gt_20kb'] = bool(rep['glb_bytes'] > 20000)
    renders = render_glb(path)
    rep['renders'] = [str(Path(p).relative_to(PROJECT)) for p in renders]
    rep['render_count'] = len(renders)

    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)

    fails = []
    if not rep['axis']['match_catalog']:
        fails.append('axis')
    if rep['rod_angle_to_axis_deg'] > 0.5 or rep['rod_axis_offset_mm'] > 0.2:
        fails.append('rod_axis')
    if not rep['pivot_ok']:
        fails.append('pivot')
    if not rep['slide_ok']:
        fails.append('slide')
    if rep['collisions_total']:
        fails.append('collisions')
    if rep['static_overlaps_unplanned']:
        fails.append('static_overlaps')
    if not rep['bbox_ok_0.20x0.075x0.075']:
        fails.append('bbox')
    if not rep['floor_contact_ok']:
        fails.append('ground')
    if not (4 <= rep['material_count'] <= 8):
        fails.append('materials')
    if rep['nodes'] != 32:
        fails.append(f'nodes={rep["nodes"]}')
    if rep['bad_names']:
        fails.append('names')
    if not rep['glb_ok_gt_20kb']:
        fails.append('glb_size')
    if rep['render_count'] != 4:
        fails.append('renders')
    if fails:
        raise SystemExit('checks failed: ' + ','.join(fails))


if __name__ == '__main__':
    main()
