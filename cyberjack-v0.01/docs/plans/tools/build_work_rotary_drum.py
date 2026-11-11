"""Standalone builder: work_rotary_drum (WRK-ROT-02, «Барабан насадок»).

Крупный вращающийся барабан насадок Ø 0,29 x 0,24 м на горизонтальной оси X
с шестью быстросъёмными сегментами по окружности (2 перьевых, 2 силиконовых,
2 щёточных), стальными бандажными кольцами, графитовым валом, статичной
вилкой/опорой, ротационным доком и кожухом-сектором.

Не зависит от build_component_library.py / build_work_tickle_firm.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_rotary_drum.py

Выход:
  public/models/machine-modules/components/work_rotary_drum.glb
  docs/plans/blockout/component-library/work_rotary_drum/*.png

Геометрия (Blender Z-up, метры):
  ось барабана = X, линия y=0, z=Z0=0.150
  anim-пустышка = (0, 0, Z0) — ровно центр оси барабана
  вращаются: hub, flanges, 6 сегментов, перья, силикон, щетина, бандажи,
             кольца, вал
  статично:  док, рычаг дока, кабель, разъём, опора-вилка, подшипник,
             кожух-сектор, кронштейн кожуха, LED
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/work_rotary_drum'
CID = 'work_rotary_drum'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.150                      # высота оси барабана
DRUM_HALF = 0.120               # длина барабана 0.24 по X
HUB_R = 0.090                   # тело барабана
FLANGE_R = 0.101                # торцевые буртики
SEG_X = 0.092                   # полухорда сегмента по X
SEG_RI = 0.086                  # внутренний радиус сегмента (втоплен в тело)
SEG_RO = 0.132                  # наружный радиус основания сегмента
SEG_HALF = math.radians(27.0)   # 6 сегментов x 54°, зазор 6°
R_TIP = 0.1490                  # максимальный радиус контактных элементов
BAND_X0, BAND_X1 = 0.074, 0.086  # стальные бандажные кольца на краю сегментов
BAND_R = 0.1336
RING_X0, RING_X1 = 0.1015, 0.1095  # стопорные кольца на буртиках
RING_R = 0.1035
SHAFT_X0, SHAFT_X1 = -0.148, 0.130
SHAFT_R = 0.0145

DOCK_X0, DOCK_X1 = -0.172, -0.150   # ротационный док
DOCK_R = 0.038
DOCK_FLANGE_X0 = -0.174
DOCK_FLANGE_R = 0.047

BEAR_X0, BEAR_X1 = 0.118, 0.146     # статичный подшипник
BEAR_R = 0.036
FORK_ARM_X0, FORK_ARM_X1 = 0.148, 0.161
FORK_ARM_Y = 0.052
FORK_Z_TOP = Z0 + 0.042
FORK_FOOT_X0, FORK_FOOT_X1 = 0.138, 0.163
FORK_FOOT_Y = 0.062

GUARD_X0, GUARD_X1 = -0.104, 0.104
GUARD_RI, GUARD_RO = 0.1515, 0.1600
GUARD_A0, GUARD_A1 = math.radians(45.0), math.radians(135.0)

# сегменты: центр (град) -> тип; пары симметричны относительно y=0,
# поэтому bbox вращающейся группы остаётся симметричен оси (pivot-тест)
SEGMENTS = [
    (0.0, 'brush'),      # верх
    (60.0, 'silicone'),
    (120.0, 'feather'),
    (180.0, 'brush'),    # низ
    (240.0, 'feather'),
    (300.0, 'silicone'),
]

PALETTE = {
    'ivory': (0.925, 0.902, 0.862),
    'blush': (0.858, 0.545, 0.598),
    'rose': (0.752, 0.290, 0.372),
    'pale': (0.955, 0.822, 0.812),
    'steel': (0.660, 0.672, 0.678),
    'graphite': (0.098, 0.106, 0.120),
    'cyan': (0.400, 0.840, 0.900),
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
    bsdf.inputs['Roughness'].default_value = (0.34 if role == 'steel' else
                                              0.58 if role == 'graphite' else
                                              0.46 if role == 'cyan' else 0.68)
    bsdf.inputs['Metallic'].default_value = (0.88 if role == 'steel' else
                                             0.25 if role == 'graphite' else 0.0)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.9
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


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def box(name, a, b, role, r=0.0015, smooth=False):
    """Куб по двум углам (мировые координаты)."""
    a, b = Vector(a), Vector(b)
    return cube(name, (a + b) * 0.5, b - a, role, r=r, smooth=smooth)


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
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=20, rings=12, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    if scale:
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='X', segs=44, rings=10):
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


def radial(a):
    """Радиальное направление вокруг оси X: a=0 -> +Z, a=+90° -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


def sector_geo(bm, x0, x1, ri, ro, a_c, half, seg):
    """Твёрдый кольцевой сектор вокруг оси X -> накопление в bmesh."""
    rings = []
    for i in range(seg + 1):
        a = a_c - half + 2.0 * half * i / seg
        d = radial(a)
        ring = []
        for x in (x0, x1):
            for r in (ri, ro):
                ring.append(bm.verts.new((x, d.y * r, Z0 + d.z * r)))
        rings.append(ring)
    for i in range(seg):
        A, B = rings[i], rings[i + 1]
        bm.faces.new((A[1], B[1], B[3], A[3]))   # наружная
        bm.faces.new((A[0], A[2], B[2], B[0]))   # внутренняя
        bm.faces.new((A[0], A[1], B[1], B[0]))   # торец x0
        bm.faces.new((A[2], A[3], B[3], B[2]))   # торец x1
    bm.faces.new(tuple(rings[0]))
    bm.faces.new(tuple(reversed(rings[-1])))


def sector(name, x0, x1, ri, ro, a_c, half, seg, role, bev=0.0018, smooth=False):
    bm = bmesh.new()
    sector_geo(bm, x0, x1, ri, ro, a_c, half, seg)
    obj = mesh_from_bm(name, bm, role, smooth)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = 0.05
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def bm_cone(bm, base, direction, length, r1, r2, segments=6, squash=1.0):
    """Конус вдоль direction; squash — сжатие по локальной X (вдоль вала)."""
    d = Vector(direction).normalized()
    rot = d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
    m = (Matrix.Translation(Vector(base) + d * (length * 0.5)) @ rot
         @ Matrix.Diagonal((squash, 1.0, 1.0, 1.0)))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=r1, radius2=r2, depth=length, matrix=m)


def bm_blade(bm, base, a_dir, length, w0, w1, thick):
    """Плоская сужающаяся лопасть (перо): шестигранная призма вдоль радиуса."""
    d = radial(a_dir)
    t = Vector((0.0, math.cos(a_dir), -math.sin(a_dir)))
    hx = Vector((thick * 0.5, 0.0, 0.0))
    tip = Vector(base) + d * length
    rings = []
    for pt, wid in ((Vector(base), w0), (tip, w1)):
        rings.append([pt - t * (wid * 0.5) - hx, pt + t * (wid * 0.5) - hx,
                      pt + t * (wid * 0.5) + hx, pt - t * (wid * 0.5) + hx])
    v0 = [bm.verts.new(p) for p in rings[0]]
    v1 = [bm.verts.new(p) for p in rings[1]]
    bm.faces.new(tuple(reversed(v0)))
    bm.faces.new(tuple(v1))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((v0[i], v0[j], v1[j], v1[i]))


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []
    P = PREFIX

    # ---- тело барабана (молочный) -------------------------------
    hub = cyl(P + 'hub', (-DRUM_HALF + 0.008, 0, Z0), (DRUM_HALF - 0.008, 0, Z0),
              HUB_R, 'ivory', vertices=56, bev=0.003)
    rotating.append(hub)
    for tag, xa, xb in (('rear', -DRUM_HALF, -RING_X0 + 0.0015),
                        ('front', RING_X0 - 0.0015, DRUM_HALF)):
        rotating.append(cyl(P + f'flange_{tag}', (xa, 0, Z0), (xb, 0, Z0),
                            FLANGE_R, 'ivory', vertices=56, bev=0.0035))

    # ---- 6 быстросъёмных сегментов -------------------------------
    kind_count = {}
    for deg, kind in SEGMENTS:
        role = {'feather': 'blush', 'silicone': 'rose', 'brush': 'pale'}[kind]
        n = kind_count.get(kind, 0)
        kind_count[kind] = n + 1
        obj = sector(P + f'seg_{kind}_{"ab"[n]}', SEG_X, -SEG_X, SEG_RI,
                     SEG_RO, math.radians(deg), SEG_HALF, 10, role)
        rotating.append(obj)

    # ---- перьевые вставки (2 сегмента) --------------------------
    bm = bmesh.new()
    r0 = SEG_RO - 0.0058
    for deg in (120.0, 240.0):
        for row in (-0.056, 0.0, 0.056):
            for k in range(7):
                off = math.radians(-21.0 + 7.0 * k)
                a_base = math.radians(deg) + off
                a_dir = math.radians(deg) + off * 1.55   # веер, симметричный по y
                d0 = radial(a_base)
                base = Vector((row, d0.y * r0, Z0 + d0.z * r0))
                bm_blade(bm, base, a_dir, R_TIP - r0, 0.0118, 0.0046, 0.0026)
    rotating.append(mesh_from_bm(P + 'feather_blades', bm, 'pale'))

    # ---- силиконовые рёбра (2 сегмента) -------------------------
    bm = bmesh.new()
    for deg in (60.0, 300.0):
        for off in (-15.5, 0.0, 15.5):
            sector_geo(bm, -0.070, 0.070, 0.1295, 0.1364,
                       math.radians(deg + off), math.radians(3.6), 4)
    pads = mesh_from_bm(P + 'silicone_pads', bm, 'pale')
    bevel(pads, 0.0018, 2)
    rotating.append(pads)

    # ---- щёточная щетина (2 сегмента) ---------------------------
    bm = bmesh.new()
    for deg in (0.0, 180.0):
        for row in (-0.062, -0.031, 0.0, 0.031, 0.062):
            for k in range(13):
                a = math.radians(deg) + math.radians(-24.0 + 4.0 * k)
                d = radial(a)
                base = Vector((row, d.y * (SEG_RO - 0.005), Z0 + d.z * (SEG_RO - 0.005)))
                bm_cone(bm, base, d, R_TIP - (SEG_RO - 0.005), 0.0036, 0.0018,
                        segments=5, squash=1.0)
    rotating.append(mesh_from_bm(P + 'bristle_tufts', bm, 'rose'))

    # ---- стальные бандажные + стопорные кольца -------------------
    for tag, xa, xb in (('rear', -BAND_X0, -BAND_X1), ('front', BAND_X0, BAND_X1)):
        rotating.append(cyl(P + f'band_{tag}', (xa, 0, Z0), (xb, 0, Z0),
                            BAND_R, 'steel', vertices=64, bev=0.0012))
    for tag, xa, xb in (('rear', -RING_X1, -RING_X0), ('front', RING_X0, RING_X1)):
        rotating.append(cyl(P + f'retain_ring_{tag}', (xa, 0, Z0), (xb, 0, Z0),
                            RING_R, 'steel', vertices=56, bev=0.0010))

    # ---- кольцевые проточки на торцах ----------------------------
    for tag, sx in (('rear', -1.0), ('front', 1.0)):
        rotating.append(torus(P + f'face_ring_{tag}',
                              (sx * (DRUM_HALF - 0.0006), 0, Z0),
                              0.0705, 0.0032, 'steel', 'X', segs=56, rings=8))

    # ---- графитовый вал ------------------------------------------
    rotating.append(cyl(P + 'shaft', (SHAFT_X0, 0, Z0), (SHAFT_X1, 0, Z0),
                        SHAFT_R, 'graphite', vertices=24))
    for tag, xa, xb in (('rear', SHAFT_X0, SHAFT_X0 + 0.009),
                        ('front', SHAFT_X1 - 0.008, SHAFT_X1)):
        rotating.append(cyl(P + f'shaft_boss_{tag}', (xa, 0, Z0), (xb, 0, Z0),
                            0.0195, 'graphite', vertices=24, bev=0.0008))

    # ---- статичный ротационный док (задний торец) ----------------
    cyl(P + 'dock_body', (DOCK_X0, 0, Z0), (DOCK_X1, 0, Z0), DOCK_R,
        'graphite', vertices=40, bev=0.003)
    cyl(P + 'dock_flange', (DOCK_FLANGE_X0, 0, Z0), (DOCK_X0, 0, Z0),
        DOCK_FLANGE_R, 'steel', vertices=48, bev=0.0025)
    torus(P + 'dock_ring', (DOCK_FLANGE_X0 + 0.0008, 0, Z0), 0.0415, 0.0026, 'cyan')
    cube(P + 'dock_lever', (-0.1605, 0.0, Z0 + 0.0455), (0.021, 0.011, 0.0085),
         'steel', r=0.0014)
    cube(P + 'dock_lever_neck', (-0.1560, 0.0, Z0 + 0.0385), (0.0075, 0.0095, 0.0155),
         'graphite', r=0.0012)
    sphere(P + 'dock_led', (-0.1610, -0.0355, Z0 + 0.0090), 0.0044, 'cyan')

    # ---- статичный кабель + разъём -------------------------------
    curve_tube(P + 'cable',
               [(-0.1655, 0.008, Z0 - 0.034),
                (-0.1700, 0.028, 0.092),
                (-0.1580, 0.043, 0.034),
                (-0.1465, 0.047, 0.021)], 0.0038, 'graphite')
    cube(P + 'connector', (-0.1395, 0.0485, 0.0185), (0.0135, 0.0110, 0.0095),
         'graphite', r=0.0016)
    cube(P + 'connector_tab', (-0.1330, 0.0485, 0.0185), (0.0045, 0.0075, 0.0055),
         'steel', r=0.0008)

    # ---- статичная опора: подшипник + вилка ----------------------
    cyl(P + 'bearing_housing', (BEAR_X0, 0, Z0), (BEAR_X1, 0, Z0), BEAR_R,
        'graphite', vertices=40, bev=0.0025)
    cyl(P + 'bearing_ring', (BEAR_X0, 0, Z0), (BEAR_X0 + 0.006, 0, Z0),
        0.0405, 'steel', vertices=48, bev=0.0012)
    for tag, sy in (('l', 1.0), ('r', -1.0)):
        box(P + f'fork_arm_{tag}',
            (FORK_ARM_X0, sy * (FORK_ARM_Y - 0.006), 0.004),
            (FORK_ARM_X1, sy * (FORK_ARM_Y + 0.006), FORK_Z_TOP),
            'steel', r=0.0016)
    box(P + 'fork_foot', (FORK_FOOT_X0, -FORK_FOOT_Y, 0.002),
        (FORK_FOOT_X1, FORK_FOOT_Y, 0.014), 'graphite', r=0.0020)
    for tag, sy in (('l', 1.0), ('r', -1.0)):
        cyl(P + f'fork_bolt_{tag}',
            (FORK_FOOT_X1 - 0.010, sy * (FORK_FOOT_Y - 0.010), 0.013),
            (FORK_FOOT_X1 - 0.010, sy * (FORK_FOOT_Y - 0.010), 0.020),
            0.0052, 'graphite', vertices=12)

    # ---- статичный кожух-сектор (сзади-сверху) --------------------
    sector(P + 'guard', GUARD_X0, GUARD_X1, GUARD_RI, GUARD_RO,
           math.radians(90.0), math.radians(45.0), 30, 'ivory', bev=0.0014)
    for tag, a in (('low', GUARD_A0), ('high', GUARD_A1)):
        r_mid = (GUARD_RI + GUARD_RO) * 0.5
        d = radial(a)
        cyl(P + f'guard_lip_{tag}',
            (GUARD_X0, d.y * r_mid, Z0 + d.z * r_mid),
            (GUARD_X1, d.y * r_mid, Z0 + d.z * r_mid),
            (GUARD_RO - GUARD_RI) * 0.5 + 0.0006, 'ivory', vertices=14)
    for tag, sx in (('l', 1.0), ('r', -1.0)):
        box(P + f'guard_leg_{tag}',
            (sx * 0.083, 0.104, 0.003), (sx * 0.097, 0.118, 0.048),
            'steel', r=0.0016)
        box(P + f'guard_foot_{tag}',
            (sx * 0.077, 0.098, 0.002), (sx * 0.103, 0.126, 0.012),
            'graphite', r=0.0016)

    # ---- анимационная пустышка ровно в центре оси барабана --------
    anim = empty(P + 'anim', (0.0, 0.0, Z0))
    bpy.context.view_layer.update()
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    for o in bpy.data.objects:
        if o.name.startswith(P) and o.type == 'MESH' and o not in rotating:
            o['rotating'] = False

    anim['spin'] = {'axis': 'x', 'rpm_max': 60, 'speed': 1.1,
                    'segments': 6, 'diameter': 0.29, 'length': 0.24}
    bpy.context.view_layer.update()
    return anim, rotating


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


def check(anim, rotating):
    bpy.context.view_layer.update()
    prefixed = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    all_mesh = [o for o in prefixed if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    # pivot-тест: bbox-центр вращающейся группы до/после 90° вокруг X
    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    # заодно: ось вращения = ось барабана (осевые точки не должны уезжать)
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    drum = bpy.data.objects[PREFIX + 'hub']
    d_mn, d_mx = mesh_bbox([drum])
    seg_count = len([o for o in rotating if '.seg_' in o.name or
                     '__seg_' in o.name])

    report = {
        'component': CID,
        'code': 'WRK-ROT-02',
        'nodes': len(prefixed),
        'mesh_nodes': len(all_mesh),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.340 and size.y <= 0.340 and size.z <= 0.300),
        'drum_diameter': round(2.0 * R_TIP, 5),
        'rotor_bbox_y': [round(v, 4) for v in (k_mx.y - k_mn.y,)],
        'drum_length': round(DRUM_HALF * 2, 5),
        'hub_diameter': round((d_mx - d_mn).z, 5),
        'segments': SEGMENTS and seg_count,
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 4),
        'pivot_ok': bool(pivot_shift < 0.001),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'static_nodes': sorted(o.name for o in prefixed
                               if o.type == 'MESH' and o not in kids),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': {'type': 'spin', 'axis': 'x', 'speed': 1.1,
                   'rpm_max': 60, 'node': anim.name},
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
    if not path.is_file() or path.stat().st_size < 15000:
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
    scene.view_settings.exposure = -0.62
    try:
        scene.eevee.taa_render_samples = 48
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.780, 0.772, 0.760, 1.0)
    bg.inputs['Strength'].default_value = 0.62

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=6,
                                     location=(center.x, center.y, mn.z - 0.0005))
    floor = bpy.context.object
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.690, 0.684, 0.672, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.55, -0.75, 0.75), 22, 0.80),
            ('fill', (-0.70, -0.50, 0.42), 9, 1.00),
            ('rim', (0.05, 0.70, 0.60), 13, 0.80)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((center.x, center.y, 0))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 60
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        right = q @ Vector((1, 0, 0))
        up = q @ Vector((0, 1, 0))
        back = Vector(direction).normalized()
        return right, up, back

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

    hub_target = Vector((0.0, 0.0, Z0))
    c_main = box_corners(mn - center, mx - center)
    close_target = Vector((0.0, -0.052, Z0 - 0.010))
    c_close = box_corners(Vector((-0.086, -0.152, 0.052)) - close_target,
                          Vector((0.086, 0.006, 0.196)) - close_target)
    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.92, -1.00, 0.36), center, 70, c_main, 0.93),
        ('front', (0.00, -1.00, 0.06), center, 70, c_main, 0.93),
        ('side', (-1.00, -0.17, 0.09), center, 70, c_main, 0.93),
        ('closeup', (0.42, -1.00, 0.26), close_target, 85, c_close, 0.96),
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
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['material_count'] >= 5
            and rep['nodes'] >= 24):
        raise SystemExit('checks failed')


main()
