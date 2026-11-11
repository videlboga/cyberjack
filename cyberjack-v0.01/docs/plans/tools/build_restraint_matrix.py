"""Standalone builder: restraint_matrix (RST-MX-11, «Матрица фиксации»).

Молочная рама 2,0 x 1,0 x 0,4 м на четырёх винтовых опорах/домкратах с
анкерными болтами M12. Продольные и поперечные стальные рельсы с
графитовыми каретками (7 шт.), каждая каретка — подвижной узел:
ролики на рельсе, зажимной рычаг, фиксирующий винт, мягкая манжета-ложе
с розовой подкладкой и быстросъём (красная кнопка + штифт + кольцо).
Центральная зона ложа — узкий матрас между продольными рельсами.
Плиты-основания нет. Вращения нет (motion: none), анимационная пустышка
не нужна.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_matrix.py

Выход:
  public/models/machine-modules/components/restraint_matrix.glb
  docs/plans/blockout/component-library/restraint_matrix/*.png
  docs/plans/blockout/component-library/restraint_matrix/report.json

Геометрия (Blender Z-up, метры):
  X — длинная ось рамы (2,0 м), голова со стороны -X
  Y — ширина (1,0 м), продольные рельсы на y = ±0,355
  Z — высота (0,4 м), пол на z = 0, верх манжет на z = 0,400
  поперечные рельсы на x = -0,66 (голова) и x = +0,50 (таз)
  каретки: 4 на продольных рельсах (запястья/стопы), 1 на головном,
           2 на тазовом поперечном
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_matrix'
CID = 'restraint_matrix'
PREFIX = CID + '__'

# --- габарит по паспорту (м) ---------------------------------------------
HX = 1.000                 # половина длины рамы -> X = 2,0
HY = 0.500                 # половина ширины рамы -> Y = 1,0
BEAM_W = 0.050             # ширина обвязки
BEAM_Z0, BEAM_Z1 = 0.215, 0.270

LEG_X, LEG_Y = 0.930, 0.440
LEG_HALF = 0.036           # стойка 72 x 72 мм
LEG_Z0, LEG_Z1 = 0.060, 0.215

RAIL_LONG_Y = 0.355        # оси продольных рельсов
RAIL_Z0, RAIL_Z1 = 0.264, 0.292
RAIL_W = 0.056
STRIP_Z1 = 0.298           # графитовая направляющая сверху рельса

XRAIL_HEAD = -0.660        # поперечный рельс у головы
XRAIL_PELVIS = 0.500       # поперечный рельс у таза
XRAIL_HALF_Y = 0.450

BODY_Z0, BODY_Z1 = 0.276, 0.330
CUFF_CZ = 0.3525           # центр манжеты; обод сверху -> верх рамы 0,400
CUFF_R_IN, CUFF_R_OUT = 0.034, 0.046
CUFF_HALF_W = 0.034
CUFF_A = math.radians(103.0)   # полураствор манжеты (открыта сверху, ~154°)

PALETTE = {
    'cream': (0.930, 0.917, 0.886),
    'cream_hi': (0.968, 0.960, 0.938),
    'steel': (0.700, 0.712, 0.726),
    'graphite': (0.088, 0.093, 0.103),
    'dark': (0.030, 0.032, 0.038),
    'blush': (0.872, 0.618, 0.652),
    'pale': (0.944, 0.838, 0.828),
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
    if role == 'steel':
        bsdf.inputs['Metallic'].default_value = 0.80
        bsdf.inputs['Roughness'].default_value = 0.30
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.14
        bsdf.inputs['Roughness'].default_value = 0.48
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.28
        bsdf.inputs['Roughness'].default_value = 0.42
    elif role == 'red':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.36
    elif role in ('cream', 'cream_hi'):
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.44 if role == 'cream' else 0.36
    else:                                   # blush / pale — мягкие
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.90
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


def ring_loop(name, center, normal, major, minor, role, segs=32, rings=8,
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
                          radius1=radius, radius2=radius, depth=d.length,
                          matrix=m)


def bm_box(bm, loc, size, rot=(0.0, 0.0, 0.0)):
    m = (Matrix.Translation(Vector(loc))
         @ Euler(rot).to_matrix().to_4x4()
         @ Matrix.Diagonal(Vector((size[0], size[1], size[2], 1.0))))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def arc_into(bm, C, A, S, r_in, r_out, w0, w1, a0, a1, seg):
    """Сектор кольца вокруг оси S: точка = C + (A*sin a + Z*cos a)*r + S*w."""
    C, A, S = Vector(C), Vector(A), Vector(S)
    up = Vector((0.0, 0.0, 1.0))
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        d = A * math.sin(a) + up * math.cos(a)
        rings.append([bm.verts.new(C + d * r + S * w)
                      for w, r in ((w0, r_in), (w0, r_out),
                                   (w1, r_out), (w1, r_in))])
    for i in range(seg):
        P, Q = rings[i], rings[i + 1]
        bm.faces.new((P[0], P[1], Q[1], Q[0]))
        bm.faces.new((P[1], P[2], Q[2], Q[1]))
        bm.faces.new((P[2], P[3], Q[3], Q[2]))
        bm.faces.new((P[3], P[0], Q[0], Q[3]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))


def arc_band(name, C, A, S, r_in, r_out, w0, w1, a0, a1, seg, role):
    bm = bmesh.new()
    arc_into(bm, C, A, S, r_in, r_out, w0, w1, a0, a1, seg)
    return mesh_from_bm(name, bm, role)


# --- каркас каретки: локальные оси ---------------------------------------
def frame(center, rail_axis):
    """rail_axis: 'X' (продольный рельс) или 'Y' (поперечный)."""
    A = Vector((1.0, 0.0, 0.0)) if rail_axis == 'X' else Vector((0.0, 1.0, 0.0))
    S = Vector((0.0, 1.0, 0.0)) if rail_axis == 'X' else Vector((1.0, 0.0, 0.0))
    return Vector(center), A, S


def wpt(F, u, v, z):
    C, A, S = F
    p = C + A * u + S * v
    return Vector((p.x, p.y, z))


def cbox(F, name, u, v, du, dv, z0, z1, role, r=0.0015):
    C, A, S = F
    p = C + A * u + S * v
    p.z = (z0 + z1) * 0.5
    if abs(A.x) > 0.5:
        size = (2 * du, 2 * dv, z1 - z0)
    else:
        size = (2 * dv, 2 * du, z1 - z0)
    return cube(name, p, size, role, r=r)


def ccyl(F, name, u0, v0, u1, v1, radius, role, z0, z1=0.0,
         vertices=20, smooth=True, bev=0.0):
    """Цилиндр между двумя локальными точками (z задаётся отдельно)."""
    a = wpt(F, u0, v0, z0)
    b = wpt(F, u1, v1, z1 if z1 else z0)
    return cyl(name, a, b, radius, role, vertices=vertices, smooth=smooth,
               bev=bev)


# --- каретка -------------------------------------------------------------
def carriage(tag, center, rail_axis, u=0.0):
    """Подвижный узел на рельсе. center — точка на оси рельса (z не важен)."""
    F = frame(center, rail_axis)
    C = F[0]
    A, S = F[1], F[2]
    CC = Vector((C.x, C.y, CUFF_CZ))     # центр манжеты выше корпуса
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ---- корпус, обхватывающий рельс ----
    add(cbox(F, f'{PREFIX}carriage_body_{tag}', 0.0, 0.0, 0.055, 0.039,
             BODY_Z0, BODY_Z1, 'graphite', r=0.0060))
    # верхняя прижимная плита
    add(cbox(F, f'{PREFIX}carriage_plate_{tag}', 0.0, 0.0, 0.048, 0.035,
             BODY_Z1, BODY_Z1 + 0.008, 'steel', r=0.0016))
    # боковые ролики на рельсе (4 шт.) + оси
    bm = bmesh.new()
    for su in (-0.040, 0.040):
        for sv in (-1.0, 1.0):
            bm_cyl(bm, wpt(F, su, sv * 0.0620, 0.301),
                   wpt(F, su, sv * 0.0440, 0.301), 0.0118, 24)
        bm_cyl(bm, wpt(F, su, -0.068, 0.301), wpt(F, su, 0.068, 0.301),
               0.0030, 10)
    add(mesh_from_bm(f'{PREFIX}carriage_rollers_{tag}', bm, 'steel',
                     smooth=False))
    # нижние зажимные губки под рельсом
    for sv in (-1.0, 1.0):
        add(cbox(F, f'{PREFIX}carriage_jaw_{tag}_{"a" if sv < 0 else "b"}',
                 0.0, sv * 0.039, 0.042, 0.009, 0.256, 0.270, 'graphite',
                 r=0.0018))

    # ---- зажимной рычаг с фиксатором (одна сторона) ----
    add(ccyl(F, f'{PREFIX}lock_arm_{tag}', 0.012, -0.046, 0.012, -0.082,
             0.0062, 'graphite', 0.324, 0.300, vertices=12))
    add(ccyl(F, f'{PREFIX}lock_grip_{tag}', 0.012, -0.081, 0.012, -0.098,
             0.0092, 'red', 0.303, 0.286, vertices=14))
    add(cyl(f'{PREFIX}lock_pivot_{tag}', wpt(F, 0.012, -0.052, 0.324),
            wpt(F, 0.012, -0.038, 0.324), 0.0072, 'steel', vertices=14))
    # винт-фиксатор с накатанной головкой (другая сторона)
    add(ccyl(F, f'{PREFIX}lock_screw_{tag}', -0.010, 0.044, -0.010, 0.066,
             0.0125, 'graphite', 0.316, vertices=12))
    add(ccyl(F, f'{PREFIX}lock_screw_ring_{tag}', -0.010, 0.052, -0.010, 0.058,
             0.0140, 'steel', 0.316, vertices=16, bev=0.0006))

    # ---- мягкое ложе-манжета ----
    add(arc_band(f'{PREFIX}cuff_shell_{tag}', CC, A, S,
                 CUFF_R_IN, CUFF_R_OUT, -CUFF_HALF_W, CUFF_HALF_W,
                 -CUFF_A, CUFF_A, 46, 'cream_hi'))
    # графитовые ободы по кромкам — задают силуэт манжеты
    for sw in (-1.0, 1.0):
        add(arc_band(f'{PREFIX}cuff_roll_{tag}_{"a" if sw < 0 else "b"}',
                     CC, A, S, CUFF_R_IN + 0.0004, CUFF_R_OUT + 0.0016,
                     sw * CUFF_HALF_W, sw * (CUFF_HALF_W + 0.0030),
                     -CUFF_A, CUFF_A, 44, 'graphite'))
    # розовая подкладка секторами
    bm = bmesh.new()
    n_pad, gap = 4, math.radians(5.5)
    span = 2 * CUFF_A - gap * (n_pad - 1)
    pad = span / n_pad
    a = -CUFF_A
    for _ in range(n_pad):
        arc_into(bm, CC, A, S, CUFF_R_IN - 0.0064, CUFF_R_IN + 0.0006,
                 -0.0300, 0.0300, a, a + pad, 12)
        a += pad + gap
    add(mesh_from_bm(f'{PREFIX}cuff_lining_{tag}', bm, 'blush'))
    # светлая подушечка в глубине ложа
    add(arc_band(f'{PREFIX}cuff_pad_{tag}', CC, A, S,
                 CUFF_R_IN - 0.0108, CUFF_R_IN - 0.0052,
                 -0.0272, 0.0272, -math.radians(70.0), math.radians(70.0),
                 26, 'pale'))
    # стяжная лента через разъём: манжета читается закрытой
    # стяжка-хомутик у разъёма (полукольцо, не закрывает ложе)
    add(arc_band(f'{PREFIX}cuff_buckle_{tag}', CC, A, S,
                 CUFF_R_OUT + 0.0012, CUFF_R_OUT + 0.0050,
                 -0.0130, 0.0130,
                 CUFF_A - math.radians(26.0), CUFF_A - math.radians(2.0),
                 8, 'steel'))
    # красный лепесток быстросъёма на разъёме манжеты
    _d = A * math.sin(CUFF_A) + Vector((0.0, 0.0, 1.0)) * math.cos(CUFF_A)
    _p = CC + _d * (CUFF_R_OUT + 0.0016)
    add(cube(f'{PREFIX}cuff_tab_{tag}', _p,
             (0.011, 0.024, 0.011), 'red', r=0.0016))
    # замок-защёлка у разъёма манжеты
    add(arc_band(f'{PREFIX}cuff_latch_{tag}', CC, A, S,
                 CUFF_R_OUT, CUFF_R_OUT + 0.0050,
                 -CUFF_HALF_W - 0.0020, CUFF_HALF_W + 0.0020,
                 CUFF_A - math.radians(13.0), CUFF_A + math.radians(2.0),
                 8, 'graphite'))

    # ---- быстросъём: красная кнопка + штифт + кольцо ----
    add(ccyl(F, f'{PREFIX}qr_button_{tag}', 0.055, 0.0, 0.070, 0.0,
             0.0078, 'red', 0.312, vertices=18, bev=0.0008))
    add(ccyl(F, f'{PREFIX}qr_collar_{tag}', 0.052, 0.0, 0.058, 0.0,
             0.0102, 'steel', 0.312, vertices=20))
    add(ccyl(F, f'{PREFIX}qr_pin_{tag}', 0.068, 0.0, 0.081, 0.0,
             0.0030, 'steel', 0.312, vertices=10))
    add(ring_loop(f'{PREFIX}qr_ring_{tag}', wpt(F, 0.086, 0.0, 0.312),
                  (A.x, A.y, 0.0), 0.0082, 0.0016, 'steel', segs=24, rings=6))

    # ---- маркировочная площадка на корпусе ----
    add(cbox(F, f'{PREFIX}carriage_index_{tag}', -0.044, 0.0, 0.009, 0.016,
             BODY_Z1, BODY_Z1 + 0.0016, 'cream', r=0.0006))
    return parts


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(obj):
        parts.append(obj)
        return obj

    # ================= опоры / домкраты ================================
    for ix, sx in ((-1, -1.0), (1, 1.0)):
        for iy, sy in ((-1, -1.0), (1, 1.0)):
            tag = f'{"r" if sx < 0 else "f"}{"l" if sy < 0 else "r"}'
            x, y = sx * LEG_X, sy * LEG_Y
            # пята-опора
            add(cyl(f'{PREFIX}foot_pad_{tag}', (x, y, 0.0), (x, y, 0.012),
                    0.058, 'steel', vertices=32, bev=0.0018))
            add(cyl(f'{PREFIX}foot_ring_{tag}', (x, y, 0.012), (x, y, 0.017),
                    0.052, 'graphite', vertices=32, bev=0.0008))
            # винтовой домкрат: накатанный барабан + гайка + шток
            add(cyl(f'{PREFIX}jack_barrel_{tag}', (x, y, 0.014), (x, y, 0.052),
                    0.0295, 'graphite', vertices=12, bev=0.0016))
            add(cyl(f'{PREFIX}jack_nut_{tag}', (x, y, 0.052), (x, y, 0.064),
                    0.0335, 'steel', vertices=6, bev=0.0012))
            add(cyl(f'{PREFIX}jack_rod_{tag}', (x, y, 0.060), (x, y, 0.076),
                    0.0130, 'steel', vertices=16))
            # анкерный болт M12 рядом с опорой
            ax = x - sx * 0.052
            ay = y - sy * 0.052
            add(cyl(f'{PREFIX}anchor_washer_{tag}', (ax, ay, 0.0),
                    (ax, ay, 0.010), 0.0205, 'graphite', vertices=20,
                    bev=0.0012))
            add(cyl(f'{PREFIX}anchor_washer_in_{tag}', (ax, ay, 0.010),
                    (ax, ay, 0.014), 0.0175, 'steel', vertices=20))
            add(cyl(f'{PREFIX}anchor_bolt_{tag}', (ax, ay, 0.013),
                    (ax, ay, 0.032), 0.0120, 'steel', vertices=6,
                    bev=0.0009))
            # стойка
            add(cube(f'{PREFIX}leg_{tag}', (x, y, (LEG_Z0 + LEG_Z1) * 0.5),
                     (2 * LEG_HALF, 2 * LEG_HALF, LEG_Z1 - LEG_Z0),
                     'cream', r=0.0028))
            add(cube(f'{PREFIX}leg_collar_{tag}', (x, y, 0.070),
                     (2 * LEG_HALF + 0.012, 2 * LEG_HALF + 0.012, 0.020),
                     'steel', r=0.0022))

    # ================= обвязка рамы =====================================
    add(cube(f'{PREFIX}beam_long_rear', (0.0, -HY + BEAM_W * 0.5,
                                         (BEAM_Z0 + BEAM_Z1) * 0.5),
             (2 * HX, BEAM_W, BEAM_Z1 - BEAM_Z0), 'cream', r=0.0040))
    add(cube(f'{PREFIX}beam_long_front', (0.0, HY - BEAM_W * 0.5,
                                          (BEAM_Z0 + BEAM_Z1) * 0.5),
             (2 * HX, BEAM_W, BEAM_Z1 - BEAM_Z0), 'cream', r=0.0040))
    for tag, sx in (('rear', -1.0), ('front', 1.0)):
        add(cube(f'{PREFIX}beam_end_{tag}', (sx * (HX - BEAM_W * 0.5), 0.0,
                                             (BEAM_Z0 + BEAM_Z1) * 0.5),
                 (BEAM_W, 2 * (HY - BEAM_W), BEAM_Z1 - BEAM_Z0), 'cream',
                 r=0.0040))
        # внутренняя полка обвязки — тёмная линия стыка
        add(cube(f'{PREFIX}beam_shadow_{tag}',
                 (sx * (HX - BEAM_W), 0.0, BEAM_Z0 + 0.004),
                 (0.003, 2 * (HY - BEAM_W) - 0.006, 0.008), 'dark', r=0.0006))

    # поперечные балки под рельсами
    for tag, bx in (('head', XRAIL_HEAD), ('pelvis', XRAIL_PELVIS)):
        add(cube(f'{PREFIX}crossbeam_{tag}', (bx, 0.0, 0.243),
                 (0.038, 2 * (HY - BEAM_W), 0.046), 'cream', r=0.0026))

    # ================= продольные рельсы ================================
    for tag, sy in (('l', -1.0), ('r', 1.0)):
        y = sy * RAIL_LONG_Y
        add(cube(f'{PREFIX}rail_long_{tag}', (0.0, y,
                                              (RAIL_Z0 + RAIL_Z1) * 0.5),
                 (2 * (HX - 0.070), RAIL_W, RAIL_Z1 - RAIL_Z0), 'steel',
                 r=0.0020))
        add(cube(f'{PREFIX}rail_long_way_{tag}', (0.0, y,
                                                  (RAIL_Z1 + STRIP_Z1) * 0.5),
                 (2 * (HX - 0.070), RAIL_W - 0.026, STRIP_Z1 - RAIL_Z1),
                 'graphite', r=0.0008))
        for etag, ex in (('rear', -1.0), ('front', 1.0)):
            add(cube(f'{PREFIX}rail_long_stop_{tag}_{etag}',
                     (ex * 0.936, y, 0.285),
                     (0.016, RAIL_W + 0.012, 0.040), 'graphite', r=0.0022))
        # опорные рёбра под рельсом
        bm = bmesh.new()
        for rx in (-0.800, -0.060, 0.700):
            bm_box(bm, (rx, y, 0.2480), (0.058, 0.088, 0.032))
        add(mesh_from_bm(f'{PREFIX}rail_long_ribs_{tag}', bm, 'cream_hi'))
        # шкала-насечки на наружной боковине
        bm = bmesh.new()
        for i in range(19):
            tx = -0.900 + i * 0.100
            ln = 0.012 if i % 2 == 0 else 0.007
            bm_box(bm, (tx, y + sy * (RAIL_W * 0.5 + 0.0006), RAIL_Z0 + 0.013),
                   (0.0018, 0.0012, ln))
        add(mesh_from_bm(f'{PREFIX}rail_long_ticks_{tag}', bm, 'dark',
                         smooth=False))

    # ================= поперечные рельсы ===============================
    for tag, bx in (('head', XRAIL_HEAD), ('pelvis', XRAIL_PELVIS)):
        # сегменты поперечного рельса в обход пересечений с продольными
        segs = ((-XRAIL_HALF_Y, -0.387), (-0.323, 0.323), (0.387, XRAIL_HALF_Y))
        for si, (y0, y1) in enumerate(segs):
            add(cube(f'{PREFIX}rail_cross_{tag}_{si}', (bx, (y0 + y1) * 0.5,
                                                        (RAIL_Z0 + RAIL_Z1) * 0.5),
                     (RAIL_W, y1 - y0, RAIL_Z1 - RAIL_Z0), 'steel',
                     r=0.0020))
            add(cube(f'{PREFIX}rail_cross_way_{tag}_{si}',
                     (bx, (y0 + y1) * 0.5,
                      (RAIL_Z1 + STRIP_Z1) * 0.5),
                     (RAIL_W - 0.026, y1 - y0, STRIP_Z1 - RAIL_Z1),
                     'graphite', r=0.0008))
        # узлы пересечения рельсов
        for jtag, jy in (('l', -RAIL_LONG_Y), ('r', RAIL_LONG_Y)):
            add(cube(f'{PREFIX}rail_cross_junction_{tag}_{jtag}',
                     (bx, jy, (RAIL_Z0 + STRIP_Z1) * 0.5 + 0.001),
                     (0.064, 0.070, 0.042), 'graphite', r=0.0030))
        # торцевые упоры поперечного рельса
        for etag, ey in (('l', -1.0), ('r', 1.0)):
            add(cube(f'{PREFIX}rail_cross_stop_{tag}_{etag}',
                     (bx, ey * (XRAIL_HALF_Y - 0.007), (RAIL_Z0 + RAIL_Z1) * 0.5
                      + 0.012),
                     (RAIL_W + 0.012, 0.014, 0.042), 'graphite', r=0.0022))
        bm = bmesh.new()
        for i in range(9):
            ty = -0.360 + i * 0.090
            bm_box(bm, (bx, ty, RAIL_Z0 + 0.013),
                   (0.0012, 0.0018, 0.010 if i % 2 == 0 else 0.006))
        add(mesh_from_bm(f'{PREFIX}rail_cross_ticks_{tag}', bm, 'dark',
                         smooth=False))

    # ================= центральная зона ложа ===========================
    add(cube(f'{PREFIX}bed_tray', (-0.080, 0.0, 0.243),
             (1.000, 0.600, 0.034), 'cream', r=0.0070))
    add(cube(f'{PREFIX}bed_tray_lip', (-0.080, 0.0, 0.2605),
             (0.950, 0.550, 0.009), 'cream_hi', r=0.0045))
    # опорные рёбра ложа между поперечными балками
    bm = bmesh.new()
    for rx in (-0.400, 0.020, 0.300):
        bm_box(bm, (rx, 0.0, 0.2320), (0.036, 0.560, 0.030))
    add(mesh_from_bm(f'{PREFIX}bed_ribs', bm, 'cream_hi'))
    # две мягкие подушки матраса с осевым зазором
    for tag, py in (('l', -1.0), ('r', 1.0)):
        add(cube(f'{PREFIX}bed_pad_{tag}', (-0.080, py * 0.1325, 0.2665),
                 (0.912, 0.240, 0.022), 'blush', r=0.0110, smooth=True))
    # осевая линия в зазоре между подушками
    add(cube(f'{PREFIX}bed_axis_x', (-0.080, 0.0, 0.2762),
             (0.900, 0.0070, 0.0024), 'graphite', r=0.0006))
    # поперечные метки оси Y на кромке ложа
    bm = bmesh.new()
    for py in (-0.255, 0.0, 0.255):
        bm_box(bm, (-0.080, py, 0.2652), (0.0026, 0.014, 0.0016))
    add(mesh_from_bm(f'{PREFIX}bed_seams', bm, 'graphite', smooth=False))

    # ================= каретки =========================================
    # 4 на продольных рельсах: запястья (x ~ -0.30) и стопы (x ~ +0.34)
    long_pts = [
        ('wrist_l', -0.310, -RAIL_LONG_Y),
        ('wrist_r', -0.268, RAIL_LONG_Y),
        ('ankle_l', 0.348, -RAIL_LONG_Y),
        ('ankle_r', 0.312, RAIL_LONG_Y),
    ]
    for tag, cx, cy in long_pts:
        parts += carriage(tag, (cx, cy, RAIL_Z1), 'X')
        # маркировочная точка на наружной стороне обвязки
        my = HY - BEAM_W * 0.5 if cy > 0 else -HY + BEAM_W * 0.5
        add(cube(f'{PREFIX}point_mark_{tag}', (cx, my, 0.240),
                 (0.030, BEAM_W - 0.0002, 0.020), 'cream_hi', r=0.0012))
        add(cyl(f'{PREFIX}point_dot_{tag}',
                (cx, my + (0.0012 if cy > 0 else -0.0012), 0.240),
                (cx, my + (0.0034 if cy > 0 else -0.0034), 0.240),
                0.0052, 'red', vertices=16))

    # 2 на тазовом поперечном рельсе
    for tag, cy in (('pelvis_l', -0.168), ('pelvis_r', 0.176)):
        parts += carriage(tag, (XRAIL_PELVIS, cy, RAIL_Z1), 'Y')
        add(cube(f'{PREFIX}point_mark_{tag}', (HX - 0.0016, cy, 0.240),
                 (0.0032, 0.030, 0.020), 'cream_hi', r=0.0008))
        add(cyl(f'{PREFIX}point_dot_{tag}', (HX - 0.0022, cy, 0.240),
                (HX - 0.0050, cy, 0.240), 0.0052, 'red', vertices=16))

    # 1 на головном поперечном рельсе — широкое ложе под голову
    parts += carriage('head', (XRAIL_HEAD, 0.0, RAIL_Z1), 'Y')
    add(cube(f'{PREFIX}point_mark_head', (-HX + 0.0016, 0.0, 0.240),
             (0.0032, 0.030, 0.020), 'cream_hi', r=0.0008))
    add(cyl(f'{PREFIX}point_dot_head', (-HX + 0.0022, 0.0, 0.240),
            (-HX + 0.0050, 0.0, 0.240), 0.0052, 'red', vertices=16))
    # подголовник-подушка под головной кареткой
    add(cube(f'{PREFIX}head_pillow', (XRAIL_HEAD + 0.086, 0.0, 0.2755),
             (0.104, 0.210, 0.034), 'blush', r=0.0140, smooth=True))

    # ================= шильдик =========================================
    add(cube(f'{PREFIX}nameplate', (0.640, HY - BEAM_W * 0.5, 0.238),
             (0.180, BEAM_W - 0.0004, 0.034), 'cream_hi', r=0.0018))
    bm = bmesh.new()
    for i in range(3):
        bm_box(bm, (0.575 + i * 0.024, HY - BEAM_W * 0.5 + 0.0012, 0.238),
               (0.016, 0.0010, 0.0055))
    add(mesh_from_bm(f'{PREFIX}nameplate_marks', bm, 'graphite', smooth=False))
    add(cyl(f'{PREFIX}nameplate_dot', (0.700, HY - BEAM_W * 0.5 + 0.0012,
                                       0.238),
            (0.700, HY - BEAM_W * 0.5 + 0.0032, 0.238), 0.0044, 'red',
            vertices=14))

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
    carriages = sorted({o.name.split('_body_')[-1] for o in meshes
                        if '_body_' in o.name})
    extremes = []
    for o in meshes:
        omn = Vector((1e9,) * 3)
        omx = Vector((-1e9,) * 3)
        for c in o.bound_box:
            q = o.matrix_world @ Vector(c)
            for i in range(3):
                omn[i] = min(omn[i], q[i])
                omx[i] = max(omx[i], q[i])
        extremes.append((o.name,
                         max(abs(omn.x), abs(omx.x)),
                         max(abs(omn.y), abs(omx.y)),
                         omx.z))
    worst = {
        'max_abs_x': sorted(extremes, key=lambda e: -e[1])[:3],
        'max_abs_y': sorted(extremes, key=lambda e: -e[2])[:3],
        'max_z': sorted(extremes, key=lambda e: -e[3])[:3],
    }
    rep = {
        'component': CID,
        'code': 'RST-MX-11',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in (mn + mx) * 0.5],
        'bbox_target_passport': '2,0 x 1,0 x 0,4 м',
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.02 and abs(size.y - 1.0) <= 0.02
                        and abs(size.z - 0.4) <= 0.02),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'carriages': carriages,
        'carriage_count': len(carriages),
        'carriage_count_ok': bool(6 <= len(carriages) <= 8),
        'materials': sorted(m.name for m in mats),
        'material_count': len(mats),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
        'bbox_offenders': None,
    }
    if not rep['bbox_ok']:
        rep['bbox_offenders'] = {k: [(n, round(a, 4), round(b, 4), round(c, 4))
                                     for n, a, b, c in v]
                                 for k, v in worst.items()}
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
    scene.view_settings.exposure = -0.35
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

    bpy.ops.mesh.primitive_plane_add(size=8,
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
            ('key', (1.55, -2.05, 2.10), 130.0, 1.60),
            ('fill', (-2.30, -1.70, 1.15), 48.0, 2.40),
            ('rim', (0.35, 2.30, 1.60), 78.0, 1.60)):
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
    # крупный план: каретка запястья на продольном рельсе
    close_t = Vector((-0.290, RAIL_LONG_Y, 0.306))
    c_close = box_corners(Vector((-0.436, 0.256, 0.232)) - close_t,
                          Vector((-0.146, 0.456, 0.406)) - close_t)

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
        ('3q', (0.72, -0.86, 0.42), center, 70, c_main, 0.92, True),
        ('front', (0.02, -1.00, 0.16), center, 70, c_main, 0.92, True),
        ('side', (1.00, -0.20, 0.20), center, 70, c_main, 0.92, True),
        ('closeup', (0.58, -0.74, 0.66), close_t, 80, c_close, 0.94, False),
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
            and rep['carriage_count_ok'] and rep['material_count'] >= 5
            and rep['glb_bytes'] > 10000 and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
