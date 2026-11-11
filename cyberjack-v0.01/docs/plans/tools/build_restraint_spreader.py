"""Standalone builder: restraint_spreader (RST-SP-08, «Раздвижная штанга»).

Телескопическая штанга-раздвижка с двумя манжетами: наружная и внутренняя
трубчатые секции, зажимной хомут-фиксатор с кулачковым рычагом, страховочный
штифт с кольцом, барашек-фиксатор, шкала длины с красной меткой предела,
две мягкие манжеты (графитовая оболочка + мягкая подкладка из секторов),
быстросъёмы со штифтом/кнопкой/рычажком, D-ring на каждой манжете.
Плиты-основания нет.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_spreader.py

Выход:
  public/models/machine-modules/components/restraint_spreader.glb
  docs/plans/blockout/component-library/restraint_spreader/*.png
  docs/plans/blockout/component-library/restraint_spreader/report.json

Геометрия (Blender Z-up, метры):
  ось штанги = X, ось штанги по высоте z = Z0 (0.0395)
  ось манжет = Y, центры манжет в (±CUFF_X, 0, Z0)
  разъём манжеты (и лента-стяжка) направлен вверх (+Z),
  быстросъём крепится с внутренней стороны манжеты (к центру),
  D-ring — с наружной стороны манжеты.
  нижняя точка манжет z = 0 -> штанга стоит на манжетах.
  вращения нет (motion: none), анимационная пустышка не нужна.

Габарит по паспорту 0,6-1,2 м (длина), модель показана в среднем разведении.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Euler, Matrix, Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_spreader'
CID = 'restraint_spreader'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
R_OUT_TUBE = 0.0185            # наружная секция, Ø37
R_IN_TUBE = 0.0132             # внутренняя секция, Ø26.4
X_BAR_L = -0.300               # левый конец наружной трубы (в быстросъёме)
X_OUT_END = 0.048              # правый конец наружной трубы (в хомуте)
X_IN_START = 0.020             # внутренняя труба входит в наружную
X_IN_END = 0.300               # правый конец внутренней трубы (в быстросъёме)

COLLAR_X0, COLLAR_X1 = 0.036, 0.100   # зажимной хомут
BUS_X0, BUS_X1 = 0.100, 0.112         # стальная втулка-направляющая

CUFF_X = 0.3655               # центры манжет
CUFF_HY = 0.0290              # половина ширины оболочки манжеты
R_CUFF_OUT = 0.0395           # наружный радиус манжеты, Ø79
R_CUFF_IN = 0.0332
R_LINING_IN = 0.0292          # мягкая подкладка, просвет Ø58.4
A_GAP = math.radians(23.0)    # половина разъёма манжеты (46°)

QR_HX = 0.0150                # половина длины быстросъёма
QR_HY = 0.0180
QR_HZ = 0.0170
QR_X = 0.3150                 # центр быстросъёма по X (модуль)
Z0 = R_CUFF_OUT + 0.0009      # ось штанги = центр манжет; низ манжеты на z=0

PALETTE = {
    'alu': (0.720, 0.728, 0.742),
    'alu_light': (0.810, 0.818, 0.830),
    'steel': (0.615, 0.625, 0.640),
    'graphite': (0.088, 0.093, 0.103),
    'dark': (0.030, 0.032, 0.038),
    'cream': (0.928, 0.912, 0.878),
    'blush': (0.900, 0.700, 0.712),
    'red': (0.700, 0.075, 0.062),
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
    if role in ('alu', 'alu_light'):
        bsdf.inputs['Metallic'].default_value = 0.92
        bsdf.inputs['Roughness'].default_value = 0.30 if role == 'alu' else 0.22
    elif role == 'steel':
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.26
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.12
        bsdf.inputs['Roughness'].default_value = 0.52
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.30
        bsdf.inputs['Roughness'].default_value = 0.44
    elif role == 'red':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.38
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.86
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


def bevel(obj, width=0.0010, segments=2, angle=40.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(angle)
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


def cube(name, loc, size, role, r=0.0008, rot=(0, 0, 0), smooth=False):
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


def bar(name, a, b, width, thick, role, r=0.0012, smooth=False):
    """Прямой брусок от a к b: width — по Y, thick — в плоскости оси."""
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    obj.scale = (thick, width, d.length)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=18, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def ring_loop(name, center, normal, major, minor, role, segs=40, rings=10,
              scale_u=1.0, scale_v=1.0):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=center)
    obj = bpy.context.object
    obj.name = name
    q = Vector(normal).normalized().to_track_quat('Z', 'Y')
    obj.rotation_euler = q.to_euler()
    obj.scale = (scale_u, scale_v, 1.0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return apply(obj, role, True)


# --- bmesh-геометрия ------------------------------------------------------
def bm_cyl(bm, a, b, radius, segments=16):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=d.length, matrix=m)


def bm_box(bm, loc, size, rot=(0.0, 0.0, 0.0)):
    m = (Matrix.Translation(Vector(loc))
         @ Euler(rot).to_matrix().to_4x4()
         @ Matrix.Diagonal(Vector((size[0], size[1], size[2], 1.0))))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_sphere(bm, loc, radius, segs=10, rings=6):
    m = Matrix.Translation(Vector(loc))
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings,
                              radius=radius, matrix=m)


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def arc_into(bm, cx, sx, r_in, r_out, y0, y1, a0, a1, seg):
    """Сектор кольца вокруг оси Y (центр манжеты (cx,0,Z0)), a от +Z к +X*sx."""
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        s, c = math.sin(a), math.cos(a)
        ring = [bm.verts.new((cx + sx * s * r, y, Z0 + c * r))
                for y, r in ((y0, r_in), (y0, r_out), (y1, r_out), (y1, r_in))]
        rings.append(ring)
    for i in range(seg):
        A, B = rings[i], rings[i + 1]
        bm.faces.new((A[0], A[1], B[1], B[0]))
        bm.faces.new((A[1], A[2], B[2], B[1]))
        bm.faces.new((A[2], A[3], B[3], B[2]))
        bm.faces.new((A[3], A[0], B[0], B[3]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))


def arc_band(name, cx, sx, r_in, r_out, y0, y1, a0, a1, seg, role):
    bm = bmesh.new()
    arc_into(bm, cx, sx, r_in, r_out, y0, y1, a0, a1, seg)
    return mesh_from_bm(name, bm, role)


def p3(cx, sx, a, r, y=0.0):
    return Vector((cx + sx * math.sin(a) * r, y, Z0 + math.cos(a) * r))


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(obj):
        parts.append(obj)
        return obj

    # ================= телескопическая штанга ==========================
    add(cyl(PREFIX + 'outer_tube', (X_BAR_L, 0, Z0), (X_OUT_END, 0, Z0),
            R_OUT_TUBE, 'alu', vertices=48, bev=0.0016))
    add(cyl(PREFIX + 'inner_tube', (X_IN_START, 0, Z0), (X_IN_END, 0, Z0),
            R_IN_TUBE, 'alu_light', vertices=40, bev=0.0012))
    add(cyl(PREFIX + 'ferrule_left', (X_BAR_L + 0.002, 0, Z0),
            (X_BAR_L + 0.018, 0, Z0), R_OUT_TUBE + 0.0013, 'steel',
            vertices=44, bev=0.0008))
    add(cyl(PREFIX + 'ferrule_right', (X_IN_END - 0.018, 0, Z0),
            (X_IN_END - 0.002, 0, Z0), R_IN_TUBE + 0.0018, 'steel',
            vertices=36, bev=0.0008))

    # ---- зажимной хомут на стыке секций ----
    add(cyl(PREFIX + 'lock_collar', (COLLAR_X0, 0, Z0), (COLLAR_X1, 0, Z0),
            0.0205, 'graphite', vertices=48, bev=0.0022))
    add(cyl(PREFIX + 'collar_ring', (COLLAR_X0, 0, Z0),
            (COLLAR_X0 + 0.007, 0, Z0), 0.0212, 'steel', vertices=48,
            bev=0.0007))
    add(cyl(PREFIX + 'index_mark', (COLLAR_X1 - 0.007, 0, Z0),
            (COLLAR_X1 - 0.002, 0, Z0), 0.0209, 'red', vertices=40))
    add(cyl(PREFIX + 'guide_bushing', (BUS_X0, 0, Z0), (BUS_X1, 0, Z0),
            0.0165, 'steel', vertices=36, bev=0.0008))

    # ---- кулачковый фиксатор длины ----
    add(cube(PREFIX + 'cam_lug', (0.062, 0, Z0 + 0.0115),
             (0.026, 0.021, 0.014), 'graphite', r=0.0018))
    add(cyl(PREFIX + 'cam_disc', (0.062, -0.0078, Z0 + 0.0200),
            (0.062, 0.0078, Z0 + 0.0200), 0.0074, 'graphite', vertices=28,
            bev=0.0008))
    add(cyl(PREFIX + 'cam_pivot', (0.062, -0.0112, Z0 + 0.0188),
            (0.062, 0.0112, Z0 + 0.0188), 0.0044, 'steel', vertices=20,
            bev=0.0006))
    add(bar(PREFIX + 'cam_lever', (0.062, 0, Z0 + 0.0210),
            (0.002, 0, Z0 + 0.0488), 0.0165, 0.0090, 'graphite', r=0.0016))
    add(bar(PREFIX + 'cam_grip', (-0.001, 0, Z0 + 0.0484),
            (-0.016, 0, Z0 + 0.0546), 0.0190, 0.0115, 'red', r=0.0018))

    # ---- страховочный штифт и барашек ----
    add(cyl(PREFIX + 'safety_pin', (0.081, 0, Z0 + 0.0125),
            (0.081, 0, Z0 + 0.0288), 0.0030, 'steel', vertices=16))
    add(ring_loop(PREFIX + 'safety_ring', (0.081, 0, Z0 + 0.0322), (0, 1, 0),
                  0.0072, 0.0015, 'steel', segs=28, rings=8))
    add(cyl(PREFIX + 'lock_wheel', (0.068, 0, Z0 - 0.0282),
            (0.068, 0, Z0 - 0.0176), 0.0132, 'graphite', vertices=32,
            bev=0.0012))
    bm = bmesh.new()
    for i in range(12):
        a_k = i * math.tau / 12
        bm_box(bm, (0.068 + math.cos(a_k) * 0.0128,
                    math.sin(a_k) * 0.0128, Z0 - 0.0229),
               (0.0034, 0.0016, 0.0092), rot=(0.0, 0.0, a_k))
    add(mesh_from_bm(PREFIX + 'lock_wheel_knurl', bm, 'graphite', smooth=False))
    add(cyl(PREFIX + 'lock_wheel_screw', (0.068, 0, Z0 - 0.0180),
            (0.068, 0, Z0 - 0.0095), 0.0036, 'steel', vertices=14))

    # ---- шкала длины и метка предела ----
    # насечки шкалы: штрихи сверху и спереди внутренней секции
    bm = bmesh.new()
    for i in range(6):
        x = 0.130 + i * 0.0245
        ln = 0.0120 if i % 2 == 0 else 0.0070
        bm_box(bm, (x, 0, Z0 + R_IN_TUBE + 0.00015), (0.0011, ln, 0.00035))
        bm_box(bm, (x, -(R_IN_TUBE + 0.00015), Z0), (0.0011, 0.00035, ln))
    add(mesh_from_bm(PREFIX + 'scale_ticks', bm, 'graphite', smooth=False))
    add(cyl(PREFIX + 'limit_band', (0.2755, 0, Z0), (0.2815, 0, Z0),
            R_IN_TUBE + 0.0007, 'red', vertices=32, bev=0.0005))

    # ---- шильдик на наружной секции ----
    add(cyl(PREFIX + 'nameplate', (-0.170, 0, Z0), (-0.070, 0, Z0),
            R_OUT_TUBE + 0.0006, 'graphite', vertices=44, bev=0.0005))
    bm = bmesh.new()
    for i in range(5):
        bm_box(bm, (-0.162 + i * 0.021, 0, Z0 + R_OUT_TUBE + 0.0011),
               (0.011, 0.011, 0.0011))
    add(mesh_from_bm(PREFIX + 'nameplate_marks', bm, 'cream', smooth=False))

    # ================= манжеты + быстросъёмы ============================
    for tag, sx in (('l', -1.0), ('r', 1.0)):
        cx = sx * CUFF_X

        # оболочка манжеты с разъёмом сверху
        add(arc_band(PREFIX + f'cuff_shell_{tag}', cx, sx, R_CUFF_IN, R_CUFF_OUT,
                     -CUFF_HY, CUFF_HY, A_GAP, math.tau - A_GAP, 48, 'cream'))
        for ytag, y0, y1 in (('rear', -CUFF_HY - 0.0030, -CUFF_HY),
                             ('front', CUFF_HY, CUFF_HY + 0.0030)):
            add(arc_band(PREFIX + f'cuff_roll_{ytag}_{tag}', cx, sx,
                         R_CUFF_IN + 0.0006, R_CUFF_OUT + 0.0009, y0, y1,
                         A_GAP, math.tau - A_GAP, 48, 'cream'))

        # мягкая подкладка: 6 секторов с зазорами
        bm = bmesh.new()
        n_pad, pad_gap = 6, math.radians(4.5)
        span_a = math.radians(300.0) - pad_gap * (n_pad - 1)
        pad = span_a / n_pad
        a = math.radians(30.0)
        for _ in range(n_pad):
            arc_into(bm, cx, sx, R_LINING_IN, R_CUFF_IN + 0.0004,
                     -0.0248, 0.0248, a, a + pad, 12)
            a += pad + pad_gap
        add(mesh_from_bm(PREFIX + f'cuff_lining_{tag}', bm, 'blush'))

        # лента-стяжка через разъём + свободный конец
        add(arc_band(PREFIX + f'strap_{tag}', cx, sx, R_CUFF_OUT + 0.0003,
                     R_CUFF_OUT + 0.0013, -0.0176, 0.0176,
                     -math.radians(31.0), math.radians(31.0), 20, 'graphite'))
        add(arc_band(PREFIX + f'strap_tongue_{tag}', cx, sx,
                     R_CUFF_OUT + 0.0007, R_CUFF_OUT + 0.0013,
                     -0.0156, 0.0156, math.radians(30.0), math.radians(63.0),
                     14, 'graphite'))

        # пряжка-рамка из стальной проволоки
        bm = bmesh.new()
        for a_b in (math.radians(13.0), math.radians(26.0)):
            bm_cyl(bm, p3(cx, sx, a_b, R_CUFF_OUT + 0.0026, -0.0225),
                   p3(cx, sx, a_b, R_CUFF_OUT + 0.0026, 0.0225), 0.0018, 12)
        for y in (-0.0225, 0.0225):
            bm_cyl(bm, p3(cx, sx, math.radians(13.0), R_CUFF_OUT + 0.0026, y),
                   p3(cx, sx, math.radians(26.0), R_CUFF_OUT + 0.0026, y),
                   0.0018, 12)
        bm_cyl(bm, p3(cx, sx, math.radians(10.0), R_CUFF_OUT + 0.0031, -0.0180),
               p3(cx, sx, math.radians(10.0), R_CUFF_OUT + 0.0031, 0.0180),
               0.0013, 10)
        add(mesh_from_bm(PREFIX + f'buckle_{tag}', bm, 'steel'))

        # заклёпки ленты
        bm = bmesh.new()
        for a_r in (math.radians(-18.0), math.radians(0.0), math.radians(18.0)):
            bm_sphere(bm, p3(cx, sx, a_r, R_CUFF_OUT + 0.0014), 0.0021, 10, 6)
        add(mesh_from_bm(PREFIX + f'strap_rivets_{tag}', bm, 'steel'))

        # D-ring с наружной стороны манжеты
        add(arc_band(PREFIX + f'dring_tab_{tag}', cx, sx,
                     R_CUFF_OUT + 0.0002, R_CUFF_OUT + 0.0013,
                     -0.0135, 0.0135, math.radians(84.5), math.radians(95.5),
                     8, 'graphite'))
        add(ring_loop(PREFIX + f'dring_{tag}',
                      p3(cx, sx, math.radians(90.0), R_CUFF_OUT + 0.0072),
                      (0, 1, 0), 0.0105, 0.0020, 'steel', segs=32, rings=8,
                      scale_u=0.86, scale_v=1.0))

        # монтажная бобышка под быстросъём (внутренняя сторона манжеты)
        add(arc_band(PREFIX + f'cuff_socket_{tag}', cx, sx, R_CUFF_OUT - 0.0005,
                     R_CUFF_OUT + 0.0043, -0.0165, 0.0165,
                     math.radians(263.0), math.radians(277.0), 12, 'graphite'))

        # ---- быстросъём ----
        qx = sx * QR_X
        add(cube(PREFIX + f'qr_body_{tag}', (qx, 0, Z0),
                 (2 * QR_HX, 2 * QR_HY, 2 * QR_HZ), 'graphite', r=0.0034))
        add(cyl(PREFIX + f'qr_button_{tag}', (qx, 0, Z0 + 0.0155),
                (qx, 0, Z0 + 0.0258), 0.0056, 'red', vertices=24,
                bev=0.0008))
        add(ring_loop(PREFIX + f'qr_button_ring_{tag}',
                      (qx, 0, Z0 + 0.0163), (0, 0, 1), 0.0066, 0.0013,
                      'steel', segs=24, rings=6))
        add(cube(PREFIX + f'qr_paddle_{tag}', (qx, -0.0228, Z0 + 0.0018),
                 (0.0105, 0.0230, 0.0062), 'steel', r=0.0016,
                 rot=(math.radians(-26.0), 0, 0)))
        add(cyl(PREFIX + f'qr_pin_{tag}', (qx, -0.0188, Z0 + 0.0035),
                (qx, 0.0188, Z0 + 0.0035), 0.0026, 'steel', vertices=16))
        bm = bmesh.new()
        for bx in (QR_X - 0.0092, QR_X + 0.0092):
            for bz in (-0.0092, 0.0092):
                bm_cyl(bm, (sx * bx, -QR_HY, Z0 + bz),
                       (sx * bx, -QR_HY - 0.0025, Z0 + bz), 0.0024, 12)
        add(mesh_from_bm(PREFIX + f'qr_bolts_{tag}', bm, 'steel'))

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

    mats = [m for m in bpy.data.materials if m.users]
    rep = {
        'component': CID,
        'code': 'RST-SP-08',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in (mn + mx) * 0.5],
        'bbox_target_passport': '0,6-1,2 м (длина), Ø манжеты 80 мм',
        'bbox_ok': bool(0.60 <= size.x <= 1.25 and size.y <= 0.16
                        and size.z <= 0.16),
        'deployed_length_m': round(size.x, 4),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'bar_diameter_mm': round(2 * R_OUT_TUBE * 1000, 1),
        'inner_section_diameter_mm': round(2 * R_IN_TUBE * 1000, 1),
        'telescope_overlap_mm': round((X_OUT_END - X_IN_START) * 1000, 1),
        'cuff_outer_diameter_mm': round(2 * R_CUFF_OUT * 1000, 1),
        'cuff_bore_diameter_mm': round(2 * R_LINING_IN * 1000, 1),
        'cuff_gap_deg': round(2 * math.degrees(A_GAP), 1),
        'materials': sorted(m.name for m in mats),
        'material_count': len(mats),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
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

    for name, off, energy, sz in (
            ('key', (0.62, -0.95, 0.92), 22.0, 0.85),
            ('fill', (-1.05, -0.80, 0.55), 8.5, 1.20),
            ('rim', (0.15, 1.05, 0.72), 13.0, 0.85)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = center + Vector(off)
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
    # крупный план: зажимной хомут + шкала + правая манжета с быстросъёмом
    close_t = Vector((0.300, 0.0, Z0 + 0.002))
    c_close = box_corners(Vector((0.185, -0.048, Z0 - 0.046)) - close_t,
                          Vector((0.428, 0.048, Z0 + 0.060)) - close_t)

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
        ('3q', (0.62, 0.72, 0.34), center, 70, c_main, 0.92, True),
        ('front', (0.02, -1.00, 0.10), center, 70, c_main, 0.92, True),
        ('side', (1.00, -0.22, 0.18), center, 70, c_main, 0.92, True),
        ('closeup', (0.55, -0.78, 0.34), close_t, 80, c_close, 0.94, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, refine in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(5 if refine else 0):
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
