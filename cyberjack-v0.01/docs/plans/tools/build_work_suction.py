"""Standalone builder + renderer: work_suction (WRK-FL-04, «Отсос»).

Компактный вакуумный отсос: силиконовая чаша-присоска с уплотнительной
кромкой и видимой камерой разрежения, жёсткий полипропиленовый корпус,
вакуумный порт с регулировочным игольчатым клапаном, быстросъёмная
цанга-муфта с накаткой, короткий гофрированный шланг с ферулой и
модуль датчика давления. Плиты-основания нет.

Не зависит от build_component_library.py и от других build_* скриптов.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_suction.py

Выход:
  public/models/machine-modules/components/work_suction.glb
  docs/plans/blockout/component-library/work_suction/*.png

Геометрия (Blender Z-up, метры):
  ось отсоса     = X, чаша смотрит в +X, шланг уходит в -X
  y = 0, z = 0 — ось симметрии корпуса
  анимации нет, вращения нет (motion.type = none)
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
SHOTS = PROJECT / 'docs/plans/blockout/component-library/work_suction'
CID = 'work_suction'
PREFIX = CID + '__'

TAU = math.tau

# --- ключевые размеры (м) ------------------------------------------------
X_MOUTH = 0.0470            # плоскость присасывания
X_BODY0, X_BODY1 = -0.0040, 0.0300
CUP_RO = 0.0184             # наружный радиус кромки чаши (Ø0,0368)
CUP_RI = 0.0158             # внутренний радиус кромки
CAVITY_X = 0.0324           # горловина камеры разрежения

X_COLLAR0, X_COLLAR1 = -0.0245, -0.0135   # быстросъёмная муфта
COLLAR_R = 0.0162
X_BAY0, X_BAY1 = -0.0200, -0.0045
BAY_R = 0.0130
X_FER0, X_FER1 = -0.0312, -0.0245         # ферула шланга
FER_R = 0.0075

HOSE_R = 0.0042
HOSE_RIBS = 15

VALVE_X = 0.0090
PORT_Z0, PORT_Z1 = 0.0122, 0.0243

PALETTE = {
    'silicone': (0.925, 0.943, 0.953),   # молочный силикон чаши
    'cavity': (0.352, 0.412, 0.452),     # камера разрежения (изнутри)
    'lip': (0.585, 0.652, 0.678),        # уплотнительная кромка
    'pp': (0.955, 0.950, 0.936),         # полипропиленовый корпус
    'steel': (0.742, 0.750, 0.744),
    'graphite': (0.245, 0.262, 0.282),
    'rubber': (0.145, 0.158, 0.176),     # шланг
    'cyan': (0.255, 0.660, 0.640),       # бирюзовая метка
    'glass': (0.560, 0.800, 0.808),      # смотровое окно
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
    bsdf.inputs['Roughness'].default_value = 0.30 if role in ('silicone', 'lip', 'glass') else 0.62
    metallic = {'steel': 0.85, 'graphite': 0.35}.get(role, 0.0)
    bsdf.inputs['Metallic'].default_value = metallic
    if role in ('silicone', 'lip', 'glass'):
        bsdf.inputs['IOR'].default_value = 1.42
        if 'Transmission Weight' in bsdf.inputs:
            bsdf.inputs['Transmission Weight'].default_value = 0.15 if role != 'glass' else 0.35
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.55
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


def lathe(name, profile, role, segs=56, smooth=True, xform=None,
          flutes=0, amp=0.0, face_dir='out'):
    """Тело вращения вокруг локальной оси X; profile = [(x, r), ...].

    face_dir='out' — нормали наружу (наружные поверхности),
    face_dir='in'  — нормали к оси (внутренняя поверхность чаши).
    """
    bm = bmesh.new()
    rings = []
    for x, r in profile:
        if r <= 1e-7:
            rings.append([bm.verts.new((x, 0.0, 0.0))])
            continue
        ring = []
        for s in range(segs):
            a = TAU * s / segs
            rr = r * (1.0 + amp * math.cos(flutes * a)) if flutes else r
            ring.append(bm.verts.new((x, rr * math.cos(a), rr * math.sin(a))))
        rings.append(ring)

    for i in range(len(rings) - 1):
        a_, b_ = rings[i], rings[i + 1]
        if len(a_) == 1 and len(b_) == 1:
            continue
        if len(a_) == 1:
            for s in range(segs):
                bm.faces.new((a_[0], b_[s], b_[(s + 1) % segs]))
        elif len(b_) == 1:
            for s in range(segs):
                bm.faces.new((a_[s], a_[(s + 1) % segs], b_[0]))
        else:
            for s in range(segs):
                bm.faces.new((a_[s], a_[(s + 1) % segs],
                              b_[(s + 1) % segs], b_[s]))

    bm.normal_update()
    score = 0.0
    for f in bm.faces:
        c = f.calc_center_median()
        score += f.normal.dot(Vector((0.0, c.y, c.z)))
    want = 1.0 if face_dir == 'out' else -1.0
    if score * want < 0:
        bmesh.ops.reverse_faces(bm, faces=bm.faces)

    if xform is not None:
        bmesh.ops.transform(bm, matrix=xform, verts=bm.verts)

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def axis_z(base):
    """Локальная ось X -> мировая Z, начало в base."""
    return Matrix.Translation(Vector(base)) @ Matrix.Rotation(-math.pi / 2, 4, 'Y')


def prof_r(profile, x):
    """Радиус профиля (список (x, r) по убыванию x) в точке x."""
    pts = sorted(profile)
    for (x0, r0), (x1, r1) in zip(pts, pts[1:]):
        if x0 <= x <= x1:
            t = (x - x0) / (x1 - x0) if x1 > x0 else 0.0
            return r0 + (r1 - r0) * t
    return pts[0][1] if x < pts[0][0] else pts[-1][1]


def catmull(pts, n):
    P = [pts[0]] + list(pts) + [pts[-1]]
    out = []
    segs = len(pts) - 1
    for i in range(n + 1):
        u = (i / n) * segs
        k = min(int(u), segs - 1)
        t = u - k
        p0, p1, p2, p3 = P[k], P[k + 1], P[k + 2], P[k + 3]
        out.append(0.5 * ((2 * p1) + (-p0 + p2) * t
                          + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                          + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t))
    return out


def sweep(name, pts, radius_fn, role, segs=14, caps=True):
    """Заметание окружности по Catmull-Rom пути с переменным радиусом."""
    n = len(pts) - 1
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        p_prev = pts[max(i - 1, 0)]
        p_next = pts[min(i + 1, n)]
        t = (p_next - p_prev)
        if t.length < 1e-9:
            t = Vector((1, 0, 0))
        t.normalize()
        ref = Vector((0, 0, 1))
        if abs(t.dot(ref)) > 0.95:
            ref = Vector((0, 1, 0))
        nv = (ref - t * ref.dot(t)).normalized()
        bv = t.cross(nv)
        r = radius_fn(i / n)
        ring = [bm.verts.new(p + nv * (r * math.cos(TAU * s / segs))
                             + bv * (r * math.sin(TAU * s / segs)))
                for s in range(segs)]
        rings.append(ring)
    for i in range(len(rings) - 1):
        a_, b_ = rings[i], rings[i + 1]
        for s in range(segs):
            bm.faces.new((a_[s], a_[(s + 1) % segs],
                          b_[(s + 1) % segs], b_[s]))
    if caps:
        bm.faces.new(tuple(reversed(rings[0])))
        bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, True)


# --- профили -------------------------------------------------------------
CUP_OUTER = [
    (0.0470, 0.0181),    # кромка присасывания
    (0.0460, 0.0183),    # скруглённый загиб кромки
    (0.0422, 0.0168),
    (0.0388, 0.0151),
    (0.0354, 0.0139),
    (0.0316, 0.0135),    # шейка чаши
    (0.0274, 0.0139),    # юбка
    (0.0240, 0.0142),
    (0.0222, 0.0138),    # задняя кромка юбки (садится на корпус)
]

CUP_INNER = [
    (0.0466, 0.0158),    # внутренняя кромка
    (0.0432, 0.0146),
    (0.0400, 0.0126),
    (0.0366, 0.0096),
    (0.0338, 0.0064),
    (0.0318, 0.0044),
    (0.0300, 0.0040),    # горловина вакуумного канала
]

BODY = [
    (0.0282, 0.0),
    (0.0282, 0.0096),
    (0.0276, 0.0110),
    (0.0230, 0.0122),
    (0.0140, 0.0126),
    (0.0070, 0.0134),
    (0.0020, 0.0144),
    (-0.0010, 0.0146),
    (-0.0030, 0.0142),
    (-0.0040, 0.0134),
    (-0.0040, 0.0),
]

HOSE_PTS = [
    Vector((-0.0295, 0.0000, 0.0000)),
    Vector((-0.0430, 0.0004, -0.0022)),
    Vector((-0.0570, 0.0012, -0.0064)),
    Vector((-0.0700, 0.0018, -0.0100)),
    Vector((-0.0810, 0.0016, -0.0112)),
    Vector((-0.0900, 0.0008, -0.0086)),
]


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ---- чаша-присоска: наружная оболочка + камера + кромка ------------
    lathe(PREFIX + 'cup', CUP_OUTER, 'silicone', segs=72, face_dir='out')
    lathe(PREFIX + 'cup_cavity', CUP_INNER, 'cavity', segs=72, face_dir='in')
    # закатанная уплотнительная кромка (перекрывает стык оболочек)
    torus(PREFIX + 'cup_lip', (0.0462, 0.0, 0.0), 0.0169, 0.0015,
          'lip', axis='X', segs=72, rings=14)
    # рёбра жёсткости на юбке — снаружи оболочки
    torus(PREFIX + 'cup_rib_1', (0.0330, 0.0, 0.0),
          prof_r(CUP_OUTER, 0.0330) + 0.0003, 0.0009,
          'silicone', axis='X', segs=64, rings=8)
    # задний валик юбки, которым чаша садится на корпус
    torus(PREFIX + 'cup_cuff', (0.0228, 0.0, 0.0), 0.0139, 0.0008,
          'silicone', axis='X', segs=64, rings=8)

    # ---- корпус (полипропилен) -----------------------------------------
    lathe(PREFIX + 'body', BODY, 'pp', segs=56)
    torus(PREFIX + 'body_collar', (0.0008, 0.0, 0.0),
          prof_r(BODY, 0.0008) + 0.0004, 0.0011,
          'graphite', axis='X', segs=56, rings=8)
    torus(PREFIX + 'body_mark', (0.0046, 0.0, 0.0),
          prof_r(BODY, 0.0046) + 0.0002, 0.00055,
          'cyan', axis='X', segs=56, rings=8)
    # гнездо вакуумного канала в горловине камеры (утоплено)
    cyl(PREFIX + 'orifice', (0.0286, 0, 0), (0.0296, 0, 0), 0.0038,
        'graphite', vertices=24)

    # ---- смотровое окно камеры разрежения (сбоку, -Y) ------------------
    cyl(PREFIX + 'view_bezel', (0.0168, -0.0116, 0.0), (0.0168, -0.0152, 0.0),
        0.0046, 'graphite', vertices=28)
    cyl(PREFIX + 'view_port', (0.0168, -0.0143, 0.0), (0.0168, -0.0154, 0.0),
        0.0037, 'glass', vertices=28)

    # ---- вакуумный порт + регулировочный клапан (сверху, +Z) -----------
    port = [
        (PORT_Z0, 0.0),
        (PORT_Z0, 0.0046),
        (PORT_Z1 - 0.0012, 0.0042),
        (PORT_Z1, 0.0040),
        (PORT_Z1, 0.0),
    ]
    lathe(PREFIX + 'port', port, 'pp', segs=32, xform=axis_z((VALVE_X, 0.0, 0.0)))
    torus(PREFIX + 'port_barb', (VALVE_X, 0.0, PORT_Z1 - 0.0018), 0.0044,
          0.00065, 'pp', axis='Z', segs=32, rings=6)
    # шестигранная гайка клапана
    cyl(PREFIX + 'valve_nut', (VALVE_X, 0, 0.0228), (VALVE_X, 0, 0.0278),
        0.0054, 'graphite', vertices=6, smooth=False)
    # накатанная головка регулировки
    knob = [
        (0.0276, 0.0),
        (0.0276, 0.0052),
        (0.0282, 0.0059),
        (0.0340, 0.0059),
        (0.0346, 0.0052),
        (0.0346, 0.0),
    ]
    lathe(PREFIX + 'valve_knob', knob, 'graphite', segs=64, flutes=12, amp=0.055,
          xform=axis_z((VALVE_X, 0.0, 0.0)))
    torus(PREFIX + 'valve_mark', (VALVE_X, 0.0, 0.0310), 0.0059, 0.0007,
          'cyan', axis='Z', segs=48, rings=6)

    # ---- быстросъём: байонетная гильза + цанга с накаткой ---------------
    cyl(PREFIX + 'bayonet_sleeve', (X_BAY0, 0, 0), (X_BAY1, 0, 0), BAY_R,
        'graphite', vertices=48, bev=0.0010)
    for tag, sy in (('a', 1.0), ('b', -1.0)):
        cube(PREFIX + f'bayonet_lug_{tag}', (-0.0122, sy * 0.0138, 0.0),
             (0.0062, 0.0050, 0.0072), 'graphite', r=0.0012)
    collar = [
        (X_COLLAR1, 0.0),
        (X_COLLAR1, 0.0148),
        (X_COLLAR1 - 0.0012, COLLAR_R),
        (X_COLLAR0 + 0.0016, COLLAR_R),
        (X_COLLAR0, 0.0150),
        (X_COLLAR0, 0.0),
    ]
    lathe(PREFIX + 'release_collar', collar, 'pp', segs=72, flutes=18, amp=0.035)
    torus(PREFIX + 'spring_ring', (X_COLLAR1 + 0.0008, 0.0, 0.0), 0.0143,
          0.00125, 'steel', axis='X', segs=48, rings=8)

    # ---- ферула шланга -------------------------------------------------
    cyl(PREFIX + 'hose_ferrule', (X_FER0, 0, 0), (X_FER1, 0, 0), FER_R,
        'steel', vertices=40, bev=0.0009)
    for i, x in enumerate((X_FER0 + 0.0016, X_FER0 + 0.0042)):
        torus(PREFIX + f'ferrule_crimp_{i + 1}', (x, 0.0, 0.0), FER_R + 0.0002,
              0.00055, 'steel', axis='X', segs=36, rings=6)

    # ---- гофрированный шланг -------------------------------------------
    pts = catmull(HOSE_PTS, 232)

    def hose_r(t):
        return HOSE_R + 0.00075 * (0.5 - 0.5 * math.cos(TAU * HOSE_RIBS * t))

    sweep(PREFIX + 'hose', pts, hose_r, 'rubber', segs=16)

    # концевая ферула + разъём на свободном конце шланга
    p_end = pts[-1]
    t_end = (pts[-1] - pts[-6]).normalized()
    a = p_end - t_end * 0.0008
    b = p_end + t_end * 0.0052
    cyl(PREFIX + 'end_ferrule', a, b, 0.0054, 'steel', vertices=32, bev=0.0007)
    cyl(PREFIX + 'end_plug', b, b + t_end * 0.0042, 0.0046, 'graphite',
        vertices=28, bev=0.0006)

    # ---- датчик давления + кабель (на стороне камеры, -Y) --------------
    cube(PREFIX + 'sensor_body', (-0.0092, -0.0168, -0.0022),
         (0.0130, 0.0084, 0.0104), 'graphite', r=0.0018)
    sphere(PREFIX + 'sensor_led', (-0.0092, -0.0212, -0.0022), 0.0019, 'cyan')
    cyl(PREFIX + 'sensor_boss', (-0.0092, -0.0128, -0.0022),
        (-0.0092, -0.0122, -0.0022), 0.0032, 'steel', vertices=20)
    curve_tube(PREFIX + 'sensor_cable',
               [(-0.0092, -0.0170, -0.0074),
                (-0.0136, -0.0148, -0.0120),
                (-0.0196, -0.0106, -0.0133),
                (-0.0250, -0.0064, -0.0112)], 0.0016, 'rubber')
    cube(PREFIX + 'sensor_connector', (-0.0268, -0.0048, -0.0104),
         (0.0064, 0.0076, 0.0058), 'graphite', r=0.0012)
    torus(PREFIX + 'cable_clip', (-0.0284, 0.0, 0.0), 0.0082, 0.0011,
          'steel', axis='X', segs=36, rings=6)

    bpy.context.view_layer.update()

    # метаданные узлов (уходят в GLB через export_extras)
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX):
            o['component'] = CID
            o['motion'] = 'none'


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
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    cup = [bpy.data.objects[PREFIX + 'cup'], bpy.data.objects[PREFIX + 'cup_lip']]
    c_mn, c_mx = mesh_bbox(cup)
    mouth_dia = max(c_mx.y - c_mn.y, c_mx.z - c_mn.z)

    cav = bpy.data.objects[PREFIX + 'cup_cavity']
    k_mn, k_mx = mesh_bbox([cav])
    cavity_depth = X_MOUTH - k_mn.x

    hose = bpy.data.objects[PREFIX + 'hose']
    h_mn, h_mx = mesh_bbox([hose])

    mats = sorted(m.name for m in bpy.data.materials if m.users)
    names = sorted(o.name for o in bpy.data.objects)
    report = {
        'component': CID,
        'code': 'WRK-FL-04',
        'motion': 'none',
        'nodes': len(names),
        'mesh_objects': len(all_mesh),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'length_m': round(size.x, 5),
        'length_ok': bool(0.135 <= size.x <= 0.165),
        'mouth_diameter_m': round(mouth_dia, 5),
        'mouth_ok': bool(0.028 <= mouth_dia <= 0.040),
        'cavity_depth_m': round(cavity_depth, 5),
        'hose_span': [round(v, 5) for v in (h_mx - h_mn)],
        'bbox_ok': bool(size.x <= 0.170 and size.y <= 0.075 and size.z <= 0.080),
        'materials': mats,
        'material_count': len(mats),
        'parts': names,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'loose_verts': sorted(o.name for o in all_mesh
                              if len(o.data.vertices) == 0),
    }
    report['ok'] = bool(report['bbox_ok'] and report['length_ok']
                        and report['mouth_ok'] and report['material_count'] >= 4
                        and not report['bad_names'] and not report['loose_verts'])
    return report


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = next(o for o in objects if o.type == 'MESH')
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
def setup_render(floor_z):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 96
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = -0.55
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.660, 0.670, 0.690, 1)
    bg.inputs['Strength'].default_value = 0.50

    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, floor_z))
    floor = bpy.context.object
    floor.name = 'render_floor'
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.70, 0.70, 0.71, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.15, 1.35), 1.75),
        ('fill', (-1.2, -0.8, 0.55), 0.36),
        ('rim', (0.25, 1.15, 0.85), 0.95),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(18)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()


def shot(name, direction, target, ortho_scale=None, dist=0.6, lens=85,
         res=(900, 760)):
    sc = bpy.context.scene
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
    sc.render.filepath = str(SHOTS / f'{CID}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


def render(rep):
    SHOTS.mkdir(parents=True, exist_ok=True)
    setup_render(floor_z=rep['bbox_min'][2] - 0.006)
    cx = rep['bbox_center'][0]
    tgt = (cx, 0.002, 0.008)
    shot('3q', (1.05, -1.50, 0.70), tgt, ortho_scale=0.178, res=(960, 640))
    shot('front', (1.0, -0.10, 0.06), (0.030, 0.0, 0.002), ortho_scale=0.054,
         res=(700, 700))
    shot('side', (0.0, -1.0, 0.02), tgt, ortho_scale=0.196, res=(1100, 430))
    shot('closeup', (0.78, -0.64, 0.44), (0.030, 0.0, 0.002), dist=0.132,
         lens=85, res=(980, 760))
    shot('preview300', (1.05, -1.50, 0.70), tgt, ortho_scale=0.163,
         res=(300, 300))
    rep['renders'] = sorted(str(p.relative_to(PROJECT)) for p in SHOTS.glob('*.png'))


def main():
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    render(rep)
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['ok']:
        raise SystemExit('checks failed')


main()
