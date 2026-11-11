"""Standalone builder: work_attach_inflatable (WRK-ATT-10, «Надувная насадка»).

Сменный наконечник с надувной эластичной камерой на жёстком сердечнике:
  - chamber   — тонкостенная полупрозрачная оболочка-бочка (стенка 2.2 мм),
                торец закрыт кольцевой кромкой: видно, что это камера, а не
                сплошной цилиндр; внутренняя расточка читается изнутри;
  - chamber_ribs — 6 приподнятых поясов-рёбер по оболочке (силовой каркас);
  - cuff_base / cuff_tip — плотные розовые буртики, зажимающие камеру на
                сердечнике с двух концов;
  - core      — жёсткий внутренний сердечник с куполом, выходящим из камеры
                на торце (виден сквозь оболочку и выступает на 15.6 мм);
  - valve_stem / valve_barb / valve_cap — штуцер подкачки с ёлочным барбом и
                пылевым колпачком (диагональ +Y/+Z у основания);
  - sensor_body / sensor_led — датчик давления с циановым индикатором
                (диагональ −Y/−Z у основания);
  - flange / sleeve / quick_ring / split_slot / lever / pivot_pin / bayonet /
    size_band — стальная посадка с накаткой и быстросъёмным разрезным кольцом.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_inflatable.py

Выход:
  public/models/machine-modules/components/work_attach_inflatable.glb

Геометрия (Blender Z-up, метры, ось насадки = X, центр оси z=Z0):
  bbox X: -0.0750 .. 0.0800  (длина 0.155)
  bbox Ø: 0.0538 по рычагу быстросъёма; камера в покое Ø 0.0400
  anim-пустышка = (0.0105, 0, Z0) — ровно центр камеры
  надуваются: chamber, chamber_ribs, cuff_base, cuff_tip
  статичны:  core, core_boss, flange, sleeve, quick_ring, split_slot, lever,
             pivot_pin, bayonet, size_band, valve_stem, valve_barb, valve_cap,
             sensor_body, sensor_led

Анимация обхвата: scale по Y/Z узла anim (amount 0.07, speed 1.2) —
локальная X пустышки совпадает с осью насадки, Y/Z — радиальные оси.
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
CID = 'work_attach_inflatable'
PREFIX = CID + '__'

TAU = math.tau

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.045                       # высота продольной оси

# стальная посадка
FLG_X0, FLG_X1, FLG_R = -0.0750, -0.0712, 0.0242
SLV_X0, SLV_X1, SLV_R = -0.0712, -0.0420, 0.0226
SLV_BORE = 0.0174
RING_X0, RING_X1, RING_R = -0.0688, -0.0576, 0.0252

# надувная камера (надувается)
CH_X0, CH_X1 = -0.0430, 0.0640   # длина 0.107
CH_R0 = 0.0150                   # радиус у концов  -> Ø 0.0300
CH_BULGE = 0.0050                # +5.0 мм в середине -> Ø 0.0400
CH_WALL = 0.0022                 # толщина стенки камеры
CH_CENTER = (CH_X0 + CH_X1) * 0.5
RIBS = 5
RIB_H = 0.0016
RIB_HW0 = 0.0064             # половина ширины пояса

# жёсткий сердечник (статичен)
CORE_X0 = -0.0400
CORE_R = 0.0124
CORE_X1 = 0.0800                 # полюс купола
CORE_BODY_X1 = 0.0644            # срез тела = срез камеры

# буртики камеры
CUFF_B_X0, CUFF_B_X1 = -0.0436, -0.0368
CUFF_B_R = 0.0172
CUFF_T_X0, CUFF_T_X1 = 0.0556, 0.0618
CUFF_T_R = 0.0164

# штуцер подкачки (диагональ +Y/+Z) и датчик (диагональ −Y/−Z)
VALVE_X = -0.0450
VALVE_ANG = math.radians(40.0)
VALVE_BASE_R = 0.0175
VALVE_TIP_R = 0.0244
VALVE_R = 0.0060
BARB_R = 0.0246
BARB_MAJOR, BARB_MINOR = 0.0062, 0.0010
CAP_R0, CAP_R1, CAP_R = 0.0240, 0.0254, 0.0062

SENSOR_X = -0.0452
SENSOR_ANG = math.radians(-140.0)
SENSOR_C_R = 0.0234
SENSOR_SIZE = (0.0140, 0.0098, 0.0060)   # (по оси X, тангенциально, радиально)
LED_R = 0.0246
LED_DX = 0.0038

ANIM_AMOUNT = 0.07
ANIM_SPEED = 1.2
FPS = 30
F_START, F_END = 1, 61

PALETTE = {
    'bladder': (0.855, 0.640, 0.658),    # силиконовая камера
    'blush': (0.855, 0.640, 0.658),      # буртики и рёбра (тон же)
    'pale': (0.972, 0.945, 0.930),
    'core_steel': (0.395, 0.408, 0.422),  # жёсткий сердечник (тёмная сталь)
    'steel': (0.560, 0.572, 0.580),
    'graphite': (0.285, 0.295, 0.310),
    'dark': (0.165, 0.172, 0.185),
    'cyan': (0.180, 0.560, 0.600),
}
# роль -> (alpha, roughness, metallic)
MATSPEC = {
    'bladder': (1.00, 0.46, 0.0),
    'blush': (1.00, 0.55, 0.0),
    'pale': (1.00, 0.34, 0.0),
    'core_steel': (1.00, 0.30, 0.88),
    'steel': (1.00, 0.34, 0.85),
    'graphite': (1.00, 0.50, 0.30),
    'dark': (1.00, 0.55, 0.15),
    'cyan': (1.00, 0.30, 0.0),
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
    alpha, rough, metal = MATSPEC[role]
    m = bpy.data.materials.new(f'CJ_{role}_{int(round(alpha * 100))}')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Alpha'].default_value = alpha
    if role == 'bladder':
        # мягкий силикон камеры: матовость + лёгкая подповерхностная мягкость
        bsdf.inputs['Subsurface Weight'].default_value = 0.20
        bsdf.inputs['Subsurface Radius'].default_value = (0.011, 0.006, 0.005)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.60
    if alpha < 1.0:
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
        if hasattr(m, 'show_transparent_back'):
            m.show_transparent_back = True
        if hasattr(m, 'use_transparent_shadow'):
            m.use_transparent_shadow = True
        m.use_backface_culling = False
    m.diffuse_color = (*color, alpha)
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def lathe(name, prof, role, seg=72, closed=False, wave=None, smooth=True):
    """Тело вращения вокруг оси X (центр оси z=Z0). prof = [(x, r), ...].

    r == 0 -> полюс.  closed=True — профиль замкнут: так строятся полые
    оболочки (наружная стенка -> торец -> расточка -> основание) и пояса.
    wave=(count, amp, phase) — накатка/рифление.
    """
    bm = bmesh.new()
    rings = []
    for x, r in prof:
        if r <= 1e-7:
            rings.append([bm.verts.new((x, 0.0, Z0))])
            continue
        ring = []
        for i in range(seg):
            a = TAU * i / seg
            rr = r + (wave[1] * math.cos(wave[0] * a + wave[2]) if wave else 0.0)
            ring.append(bm.verts.new((x, math.sin(a) * rr, Z0 + math.cos(a) * rr)))
        rings.append(ring)

    def bridge(A, B):
        if len(A) == 1 and len(B) == 1:
            return
        if len(A) == 1:
            for k in range(seg):
                bm.faces.new((A[0], B[k], B[(k + 1) % seg]))
        elif len(B) == 1:
            for k in range(seg):
                bm.faces.new((A[k], A[(k + 1) % seg], B[0]))
        else:
            for k in range(seg):
                bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))

    for i in range(len(rings) - 1):
        bridge(rings[i], rings[i + 1])
    if closed:
        bridge(rings[-1], rings[0])
    else:
        if len(rings[0]) > 1:
            bm.faces.new(tuple(reversed(rings[0])))
        if len(rings[-1]) > 1:
            bm.faces.new(tuple(rings[-1]))
    return mesh_from_bm(name, bm, role, smooth)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, bevel=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=d.length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bevel > 0:
        select_only(obj)
        md = obj.modifiers.new('bev', 'BEVEL')
        md.width = bevel
        md.segments = 2
        md.limit_method = 'ANGLE'
        md.angle_limit = math.radians(40)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=md.name)
    return apply(obj, role, smooth)


def torus_dir(name, loc, direction, major, minor, role, segs=48, rings=12):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def sphere(name, loc, radius, role, segs=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def box_dir(bm, center, size, zdir):
    """Коробка, у которой локальная Z смотрит по zdir, локальная X — по оси X."""
    z = Vector(zdir).normalized()
    y = z.cross(Vector((1.0, 0.0, 0.0))).normalized()
    x = y.cross(z).normalized()
    c = Vector(center)
    m = Matrix(((x.x, y.x, z.x, c.x),
                (x.y, y.y, z.y, c.y),
                (x.z, y.z, z.z, c.z),
                (0.0, 0.0, 0.0, 1.0)))
    bmesh.ops.create_cube(bm, size=1.0,
                           matrix=m @ Matrix.Diagonal(Vector((*size, 1.0))))


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def radial_x(a):
    """Радиальное направление вокруг оси X при a=0 -> +Z, a=+90° -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


def ch_radius(x):
    t = (x - CH_X0) / (CH_X1 - CH_X0)
    return CH_R0 + CH_BULGE * math.sin(math.pi * min(max(t, 0.0), 1.0)) ** 0.75


# --- профили -------------------------------------------------------------
def chamber_profile():
    n = 30
    outer = []
    for i in range(n + 1):
        t = i / n
        x = CH_X0 + (CH_X1 - CH_X0) * t
        outer.append((x, ch_radius(x)))
    # замкнутый контур: расточка у основания -> наружная бочка -> торец ->
    # расточка назад; торец и основание получают кольцевые кромки стенки
    prof = [(CH_X0, outer[0][1] - CH_WALL)]
    prof += outer
    prof.append((CH_X1, outer[-1][1] - CH_WALL))
    prof += [(x, r - CH_WALL) for (x, r) in outer[-2:0:-1]]
    return prof


def rib_profile(xc, rs):
    """Плавный пояс-бугор оболочки: касательный вход в поверхность без
    ступеньки (иначе пояс читается надетым кольцом), снизу — тонкий скирт
    внутри стенки камеры."""
    pts = []
    for o in (-1.0, -0.74, -0.50, -0.26, 0.0, 0.26, 0.50, 0.74, 1.0):
        h = RIB_H * (0.5 * (1.0 + math.cos(math.pi * abs(o)))) ** 0.85
        pts.append((xc + o * RIB_HW0, rs + h))
    pts += [(xc + RIB_HW0, rs - 0.0009), (xc - RIB_HW0, rs - 0.0009)]
    return pts


def core_profile():
    prof = [(CORE_X0, 0.0), (CORE_X0, CORE_R - 0.0008),
            (CORE_X0 + 0.0008, CORE_R),
            (CORE_BODY_X1, CORE_R)]
    # купол, выходящий из камеры: плавное закрытие на полюсе 0.0800
    n = 24
    dome_len = CORE_X1 - CORE_BODY_X1
    for i in range(1, n + 1):
        u = i / n
        prof.append((CORE_BODY_X1 + dome_len * u,
                     CORE_R * max(0.0, 1.0 - u * u) ** 0.55))
    prof.append((CORE_X1, 0.0))
    return prof


# --- сборка --------------------------------------------------------------
def build():
    reset()
    inflating = []

    # ---- надувная камера: тонкая оболочка-бочка (надувается) ----------
    chamber = lathe(PREFIX + 'chamber', chamber_profile(), 'bladder',
                    seg=96, closed=True)
    chamber['inflates'] = True
    chamber['wall_mm'] = round(CH_WALL * 1000, 1)
    chamber['rest_diameter_mm'] = round((CH_R0 + CH_BULGE) * 2000, 1)
    chamber['max_pressure_bar'] = 0.4
    inflating.append(chamber)

    # рёбра-пояса камеры
    xs = [CH_X0 + (CH_X1 - CH_X0) * (i + 0.5) / RIBS for i in range(RIBS)]
    rib_objs = []
    for i, xc in enumerate(xs):
        rib = lathe(PREFIX + f'chamber_rib_{i + 1:02d}',
                    rib_profile(xc, ch_radius(xc)), 'blush', seg=96, closed=True)
        rib['inflates'] = True
        rib_objs.append(rib)
    inflating += rib_objs

    # буртики, зажимающие камеру на сердечнике
    cuff_b = lathe(PREFIX + 'cuff_base', [
        (CUFF_B_X0, CUFF_B_R - 0.0012),
        (CUFF_B_X0 + 0.0006, CUFF_B_R),
        (CUFF_B_X1 - 0.0008, CUFF_B_R),
        (CUFF_B_X1, CUFF_B_R - 0.0014),
        (CUFF_B_X1, 0.0144),
        (CUFF_B_X0, 0.0144),
    ], 'blush', seg=96, closed=True)
    cuff_b['inflates'] = True
    cuff_t = lathe(PREFIX + 'cuff_tip', [
        (CUFF_T_X0, CUFF_T_R - 0.0012),
        (CUFF_T_X0 + 0.0006, CUFF_T_R),
        (CUFF_T_X1 - 0.0008, CUFF_T_R),
        (CUFF_T_X1, CUFF_T_R - 0.0014),
        (CUFF_T_X1, 0.0122),
        (CUFF_T_X0, 0.0122),
    ], 'blush', seg=96, closed=True)
    cuff_t['inflates'] = True
    inflating += [cuff_b, cuff_t]

    # ---- жёсткий сердечник (статичен, виден сквозь камеру) -------------
    core = lathe(PREFIX + 'core', core_profile(), 'core_steel', seg=64)
    core['role'] = 'rigid_core'
    core['protrusion_mm'] = round((CORE_X1 - CUFF_T_X1) * 1000, 1)

    core_boss = lathe(PREFIX + 'core_boss', [
        (-0.0460, 0.0), (-0.0460, 0.0150), (-0.0452, 0.0158),
        (-0.0396, 0.0158), (-0.0390, 0.0148), (-0.0390, 0.0),
    ], 'graphite', seg=56)
    core_boss['role'] = 'core_anchor'

    # ---- стальная посадка ----------------------------------------------
    flange = lathe(PREFIX + 'flange', [
        (FLG_X0, 0.0), (FLG_X0, 0.0230), (FLG_X0 + 0.0006, FLG_R),
        (FLG_X1 - 0.0008, FLG_R), (FLG_X1, 0.0234), (FLG_X1, SLV_R), (FLG_X1, 0.0),
    ], 'steel', seg=72)

    sleeve = lathe(PREFIX + 'sleeve', [
        (SLV_X0, 0.0), (SLV_X0, SLV_R - 0.0014),
        (SLV_X0 + 0.0012, SLV_R),
        (SLV_X1 - 0.0018, SLV_R),
        (SLV_X1 - 0.0008, SLV_R - 0.0006),
        (SLV_X1, SLV_R - 0.0020),
        (SLV_X1, SLV_BORE),
        (SLV_X0 + 0.0010, SLV_BORE),
        (SLV_X0, 0.0),
    ], 'steel', seg=128, wave=(46, 0.00030, 0.0))
    sleeve['bore_mm'] = round(SLV_BORE * 2000, 1)

    quick_ring = lathe(PREFIX + 'quick_ring', [
        (RING_X0, 0.0), (RING_X0, SLV_R + 0.0007),
        (RING_X0 + 0.0008, RING_R),
        (RING_X1 - 0.0009, RING_R),
        (RING_X1, SLV_R + 0.0007), (RING_X1, 0.0),
    ], 'steel', seg=144, wave=(58, 0.00030, 0.0))
    quick_ring['kind'] = 'quick_release_split_ring'

    bm = bmesh.new()
    box_dir(bm, ((RING_X0 + RING_X1) * 0.5, 0.0, Z0 + RING_R - 0.0002),
            (RING_X1 - RING_X0 - 0.0022, 0.0016, 0.0011), (0.0, 0.0, 1.0))
    split_slot = mesh_from_bm(PREFIX + 'split_slot', bm, 'graphite', smooth=False)

    # рычаг быстросъёма лежит вдоль кольца, поверх него (+Z)
    bm = bmesh.new()
    box_dir(bm, (-0.0616, 0.0, Z0 + 0.0246), (0.0130, 0.0080, 0.0032),
            (0.0, 0.0, 1.0))
    box_dir(bm, (-0.0538, 0.0, Z0 + 0.0238), (0.0046, 0.0092, 0.0048),
            (0.0, 0.0, 1.0))
    lever = mesh_from_bm(PREFIX + 'lever', bm, 'graphite')
    lever['kind'] = 'quick_release_lever'

    cyl(PREFIX + 'pivot_pin', (-0.0658, -0.0048, Z0 + 0.0234),
        (-0.0658, 0.0048, Z0 + 0.0234), 0.0026, 'dark', vertices=18, bevel=0.0005)

    bm = bmesh.new()
    for s in (1, -1):
        box_dir(bm, (-0.0530, s * 0.0242, Z0), (0.0092, 0.0040, 0.0056),
                (0.0, s * 1.0, 0.0))
    bayonet = mesh_from_bm(PREFIX + 'bayonet', bm, 'graphite')

    size_band = lathe(PREFIX + 'size_band', [
        (FLG_X0 + 0.0004, 0.0), (FLG_X0 + 0.0004, FLG_R - 0.0009),
        (FLG_X0 + 0.0009, FLG_R + 0.0010),
        (FLG_X1 - 0.0012, FLG_R + 0.0010),
        (FLG_X1 - 0.0007, FLG_R - 0.0009),
        (FLG_X1 - 0.0007, 0.0),
    ], 'cyan', seg=72)
    size_band['kind'] = 'size_mark'

    # ---- штуцер подкачки (диагональ +Y/+Z) ------------------------------
    dv = radial_x(VALVE_ANG)
    base = Vector((VALVE_X, 0.0, Z0)) + dv * VALVE_BASE_R
    tip = Vector((VALVE_X, 0.0, Z0)) + dv * VALVE_TIP_R
    valve_stem = cyl(PREFIX + 'valve_stem', base, tip, VALVE_R, 'steel',
                     vertices=24, bevel=0.0006)
    valve_stem['kind'] = 'inlet_barb_nozzle'

    barb = torus_dir(PREFIX + 'valve_barb',
                     Vector((VALVE_X, 0.0, Z0)) + dv * BARB_R, dv,
                     BARB_MAJOR, BARB_MINOR, 'steel', segs=40, rings=10)
    barb['kind'] = 'hose_barb'

    valve_cap = cyl(PREFIX + 'valve_cap',
                    Vector((VALVE_X, 0.0, Z0)) + dv * CAP_R0,
                    Vector((VALVE_X, 0.0, Z0)) + dv * CAP_R1,
                    CAP_R, 'graphite', vertices=24, bevel=0.0007)
    valve_cap['kind'] = 'dust_cap'

    # ---- датчик давления (диагональ −Y/−Z) -----------------------------
    ds = radial_x(SENSOR_ANG)
    bm = bmesh.new()
    box_dir(bm, Vector((SENSOR_X, 0.0, Z0)) + ds * SENSOR_C_R, SENSOR_SIZE, ds)
    sensor_body = mesh_from_bm(PREFIX + 'sensor_body', bm, 'dark', smooth=False)
    sensor_body['kind'] = 'pressure_sensor'

    led = sphere(PREFIX + 'sensor_led',
                 Vector((SENSOR_X + LED_DX, 0.0, Z0)) + ds * LED_R, 0.0018,
                 'cyan', segs=16, rings=10)
    led['kind'] = 'pressure_led'

    # ---- анимационная пустышка в центре камеры -------------------------
    anim = empty(PREFIX + 'anim', (CH_CENTER, 0.0, Z0))
    anim['inflates'] = True
    bpy.context.view_layer.update()     # иначе matrix_world ещё identity
    for o in inflating:
        parent(o, anim)
        o['inflates'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in inflating:
            o['inflates'] = False

    bpy.context.view_layer.update()
    return anim, inflating


# --- анимация ------------------------------------------------------------
def animate(anim):
    sc = bpy.context.scene
    sc.render.fps = FPS
    sc.frame_start, sc.frame_end = F_START, F_END
    sc.frame_set(F_START)

    peak = 1.0 + ANIM_AMOUNT
    keys = [(1, 1.0), (11, 1.0 + 0.40 * ANIM_AMOUNT),
            (21, 1.0 + 0.78 * ANIM_AMOUNT), (31, peak),
            (41, 1.0 + 0.78 * ANIM_AMOUNT),
            (51, 1.0 + 0.40 * ANIM_AMOUNT), (61, 1.0)]
    anim.scale = (1.0, 1.0, 1.0)
    anim.keyframe_insert('scale', frame=F_START)
    for f, s in keys:
        anim.scale = (1.0, s, s)
        anim.keyframe_insert('scale', frame=f)
    anim.scale = (1.0, 1.0, 1.0)

    ad = anim.animation_data
    if ad and ad.action:
        ad.action.name = CID + '__inflate'
        for fc in ad.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
            fc.update()

    anim['motion'] = 'scale'
    anim['axis'] = 'yz'
    anim['amount'] = ANIM_AMOUNT
    anim['speed'] = ANIM_SPEED
    anim['motion_type'] = 'scale'
    anim['motion_axis'] = 'yz'
    anim['motion_amount'] = ANIM_AMOUNT
    anim['motion_speed'] = ANIM_SPEED
    anim['motion_space'] = 'node-local; Y/Z = radial (attachment axis = local X)'
    sc.frame_set(F_START)


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


def check(anim):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (c1 - c0).length
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    # тест надувания: scale 1.07 по Y/Z, центр камеры должен стоять
    chamber = bpy.data.objects[PREFIX + 'chamber']
    rest_mn, rest_mx = mesh_bbox([chamber])
    anim.scale = (1.0, 1.0 + ANIM_AMOUNT, 1.0 + ANIM_AMOUNT)
    bpy.context.view_layer.update()
    inf_mn, inf_mx = mesh_bbox([chamber])
    anim.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()
    rest_d = rest_mx.y - rest_mn.y
    inf_d = inf_mx.y - inf_mn.y
    c_shift = (((inf_mn + inf_mx) * 0.5) - ((rest_mn + rest_mx) * 0.5)).length
    x_growth = abs((inf_mx.x - inf_mn.x) - (rest_mx.x - rest_mn.x))

    axis_r = max(max(abs(mn.y), abs(mx.y)), abs(mx.z - Z0), abs(mn.z - Z0))
    dia = axis_r * 2
    length = size.x

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'length_mm': round(length * 1000, 1),
        'diameter_mm': round(dia * 1000, 1),
        'bbox_ok': bool(0.080 <= length <= 0.180 and 0.020 <= dia <= 0.055),
        'chamber_rest_diameter_mm': round(rest_d * 1000, 1),
        'chamber_wall_mm': round(CH_WALL * 1000, 1),
        'chamber_bulge_mm': round(CH_BULGE * 1000, 1),
        'ribs': RIBS,
        'inflate_test': {
            'scale': 1.0 + ANIM_AMOUNT,
            'diameter_gain_mm': round((inf_d - rest_d) * 1000, 2),
            'center_shift_mm': round(c_shift * 1000, 4),
            'x_growth_mm': round(x_growth * 1000, 4),
        },
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_center_ok': bool((Vector(anim.location) - Vector((CH_CENTER, 0, Z0))).length < 1e-6),
        'anim_extras': {k: anim.get(k) for k in ('motion', 'axis', 'amount', 'speed')},
        'anim_action': anim.animation_data.action.name if anim.animation_data
        and anim.animation_data.action else None,
        'anim_children': sorted(o.name for o in kids),
        'children_count': len(kids),
        'static_meshes': sorted(o.name for o in all_mesh
                                if o.name.startswith(PREFIX) and o not in kids),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.0005),
        'materials': sorted(m.name for m in bpy.data.materials),
        'core_protrusion_mm': round((CORE_X1 - CUFF_T_X1) * 1000, 1),
        'valve_radius_mm': round(VALVE_TIP_R * 1000, 2),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'tris': sum(len(o.data.loop_triangles) if o.type == 'MESH' else 0
                    for o in bpy.data.objects),
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
    if not path.is_file() or path.stat().st_size < 10 * 1024:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    anim, inflating = build()
    animate(anim)
    rep = check(anim)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['glb_kb'] = round(path.stat().st_size / 1024, 1)
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['anim_center_ok']
            and len(rep['materials']) >= 4
            and rep['children_count'] == 3 + RIBS
            and rep['inflate_test']['diameter_gain_mm'] > 1.5
            and rep['inflate_test']['center_shift_mm'] < 0.01):
        raise SystemExit('checks failed')


main()
