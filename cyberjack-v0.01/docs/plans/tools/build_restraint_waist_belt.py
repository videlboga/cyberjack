"""Standalone builder: restraint_waist_belt (RST-WA-04, «Поясной ремень»).

Широкий мягкий регулируемый пояс, разложенный вдоль оси X (монтажный вид
компонентной библиотеки): нейлоновый ремень 86 мм с мягкой силиконовой
подкладкой 104 мм (мягкий борт-валик по краю), стальная пряжка-кам с рычагом
быстросъёма и стропным язычком, четыре стальных D-кольца на стропных петлях,
ограничитель длины со стопорным винтом, шкала длины и маркировка размера M.
Плиты-основания нет: ремень лежит на собственной подкладке.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_waist_belt.py

Выход:
  public/models/machine-modules/components/restraint_waist_belt.glb
  docs/plans/blockout/component-library/restraint_waist_belt/*.png
  docs/plans/blockout/component-library/restraint_waist_belt/report.json

Геометрия (Blender Z-up, метры):
  ось ремня = X, середина в x=0, подкладка на z=0 (лежит на полу)
  ширина: Y (ремень 86 мм, подкладка 104 мм)
  пряжка у x≈-0.395 (t=0.105), свободный конец (t=1) поднят на 24 мм
  вращения нет (motion: none), анимационная пустышка не нужна.

Габарит по паспорту 1,0 x 0,12 x 0,05 м (длина ремня, ширина с подкладкой,
высота с фурнитурой): X = длина ремня, Y = ширина, Z = высота над полом.
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_waist_belt'
CID = 'restraint_waist_belt'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
L = 1.000                     # длина ремня (паспорт)
X0 = -L * 0.5
T_BELT0, T_BELT1 = 0.004, 0.996   # кромки стропы (чуть внутрь паспортной длины)

H_STRAP = 0.043               # половина ширины стропы -> 86 мм
H_PAD = 0.052                 # половина ширины подкладки -> 104 мм
TH_PAD = 0.00215              # половина толщины подкладки
TH_STRAP = 0.00250            # половина толщины стропы
B_PAD = -0.00125              # центр подкладки относительно середины пакета
B_STRAP = 0.00210             # центр стропы
Z_MID = 0.00340               # середина пакета над полом -> подкладка на z=0
STRAP_TOP = B_STRAP + TH_STRAP    # 0.0046 — верхняя плоскость стропы

ARC1 = 0.0100                 # мягкая дуга ремня по Y (не линейка)
ARC2 = 0.0020

T_PAD0, T_PAD1 = 0.010, 0.870     # подкладка не доходит до концов
T_LIFT0 = 0.855               # свободный конец поднимается
LIFT_Z = 0.024
T_ROLL0 = 0.905
ROLL_MAX = math.radians(14.0)

TB = 0.105                    # пряжка (t == метры от начала ремня)
T_RINGS = (0.260, 0.400, 0.540, 0.680)
T_LIMIT = 0.745
T_TAG = 0.812
T_KEEPER = 0.888
T_BIND = 0.990                # окантовка торца ремня

PALETTE = {
    'graphite': (0.118, 0.124, 0.138),
    'blush': (0.870, 0.560, 0.600),
    'milk': (0.880, 0.866, 0.836),
    'steel': (0.600, 0.610, 0.628),
    'dark': (0.031, 0.033, 0.040),
    'cream': (0.945, 0.930, 0.893),
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
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.30
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.30
        bsdf.inputs['Roughness'].default_value = 0.44
    elif role == 'blush':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.46
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.80
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.84
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


def bevel(obj, width=0.0010, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(35)
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


def cyl(name, a, b, radius, role, vertices=24, smooth=True, r2=None, bev=0.0):
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


def ring_loop(name, center, normal, major, minor, role, segs=40, rings=9,
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


def curve_tube(name, points, radius, role, res=6, caps=True):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 10
    cu.use_fill_caps = caps
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


def rect_ring(name, center, u, v, w, su, sv, bar, thick, role, bev=0.0007):
    """Прямоугольная рамка: u,v — плоскость окна, w — толщина."""
    center = Vector(center)
    u, v, w = (Vector(x).normalized() for x in (u, v, w))
    bm = bmesh.new()
    lo, hi = [], []
    for sgn_w, store in ((-0.5, lo), (0.5, hi)):
        for layer in (0, 1):
            su2 = su * 0.5 if layer == 0 else su * 0.5 - bar
            sv2 = sv * 0.5 if layer == 0 else sv * 0.5 - bar
            quad = []
            for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
                p = (center + u * (sx * su2) + v * (sy * sv2)
                     + w * (sgn_w * thick))
                quad.append(bm.verts.new(p))
            store.append(quad)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((lo[0][i], lo[0][j], lo[1][j], lo[1][i]))
        bm.faces.new((lo[0][i], hi[0][i], hi[0][j], lo[0][j]))
        bm.faces.new((lo[1][i], lo[1][j], hi[1][j], hi[1][i]))
        bm.faces.new((hi[0][i], hi[0][j], hi[1][j], hi[1][i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, False)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


# --- осевая линия и кадр ремня -------------------------------------------
def lift(t):
    if t <= T_LIFT0:
        return 0.0
    s = (t - T_LIFT0) / (1.0 - T_LIFT0)
    return LIFT_Z * s * s


def roll(t):
    if t <= T_ROLL0:
        return 0.0
    s = (t - T_ROLL0) / (1.0 - T_ROLL0)
    return ROLL_MAX * (s ** 1.5)


def spine(t):
    x = X0 + L * t
    y = ARC1 * math.sin(math.pi * t) + ARC2 * math.sin(2.0 * math.pi * t)
    return Vector((x, y, Z_MID + lift(t)))


def frame_at(t):
    """p, T (по длине), wa (по ширине), wb (вверх); t в [0,1]."""
    t = min(max(t, 0.0), 1.0)
    ds = 5.0e-4
    p = spine(t)
    T = (spine(min(1.0, t + ds)) - spine(max(0.0, t - ds)))
    T.normalize()
    S = Vector((-T.y, T.x, 0.0))
    if S.length < 1e-6:
        S = Vector((0.0, 1.0, 0.0))
    S.normalize()
    U = T.cross(S)
    r = roll(t)
    wa = S * math.cos(r) + U * math.sin(r)
    wb = -S * math.sin(r) + U * math.cos(r)
    return p, T, wa, wb


def pt(t, a=0.0, b=0.0):
    p, _T, wa, wb = frame_at(t)
    return p + wa * a + wb * b


def frame_dir(t, k):
    return frame_at(t)[1 + k]


def rot_at(t):
    p, T, wa, wb = frame_at(t)
    return Matrix(((T.x, wa.x, wb.x),
                   (T.y, wa.y, wb.y),
                   (T.z, wa.z, wb.z))).to_euler()


def tilt(obj, ang, axis='Y'):
    obj.matrix_world = obj.matrix_world @ Matrix.Rotation(ang, 4, axis)
    return obj


def rrect(ha, hb, r, seg=3):
    """Скруглённый прямоугольник в координатах (a, b), против часовой."""
    r = min(r, ha * 0.9, hb * 0.9)
    cs = [(ha - r, hb - r), (-(ha - r), hb - r),
          (-(ha - r), -(hb - r)), (ha - r, -(hb - r))]
    pts = []
    for (cx, cy), ang in zip(cs, (0, 90, 180, 270)):
        for i in range(seg + 1):
            th = math.radians(ang + 90.0 * i / seg)
            pts.append((cx + r * math.cos(th), cy + r * math.sin(th)))
    return pts


def sweep_band(name, t0, t1, prof, role, b_off=0.0, nseg=160):
    """Протяжка профиля вдоль ремня (ремень, подкладка, окантовка)."""
    bm = bmesh.new()
    rings = []
    for i in range(nseg + 1):
        t = t0 + (t1 - t0) * i / nseg
        p, _T, wa, wb = frame_at(t)
        rings.append([bm.verts.new(p + wa * a + wb * (b + b_off))
                      for (a, b) in prof])
    m = len(prof)
    for i in range(nseg):
        r0, r1 = rings[i], rings[i + 1]
        for k in range(m):
            k2 = (k + 1) % m
            bm.faces.new((r0[k], r0[k2], r1[k2], r1[k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, False)


def strap_loop(t, name, half_len=0.0050, role='milk', over=0.0026, drop=0.0095):
    """Стропная петля, обхватывающая стропу сверху и с боков."""
    rot = rot_at(t)
    parts = [
        cube(name + '_top', pt(t, 0.0, STRAP_TOP + over * 0.5),
             (2 * half_len, 2 * (H_STRAP - 0.0038), over), role,
             r=0.0009, rot=rot),
    ]
    for tag, sgn in (('a', 1.0), ('b', -1.0)):
        parts.append(cube(name + '_side_' + tag,
                          pt(t, sgn * (H_STRAP - 0.0030), B_STRAP + 0.0002),
                          (2 * half_len, 0.0024, drop), role,
                          r=0.0008, rot=rot))
    return parts


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    # ---- подкладка (мягкая, шире стропы -> мягкий борт по краю) ---------
    parts.append(sweep_band(PREFIX + 'pad', T_PAD0, T_PAD1,
                            rrect(H_PAD, TH_PAD, 0.0019, seg=3), 'blush',
                            b_off=B_PAD, nseg=170))
    # строчка по борту подкладки, обе стороны
    for tag, a in (('a', 0.0480), ('b', -0.0480)):
        pts = [pt(t, a, B_PAD + TH_PAD + 0.0002)
               for t in (T_PAD0 + 0.022 + (T_PAD1 - T_PAD0 - 0.044) * i / 18.0
                         for i in range(19))]
        parts.append(curve_tube(PREFIX + f'pad_stitch_{tag}', pts, 0.0005,
                                'milk'))

    # ---- нейлоновый ремень ---------------------------------------------
    parts.append(sweep_band(PREFIX + 'strap', T_BELT0, T_BELT1,
                            rrect(H_STRAP, TH_STRAP, 0.0009, seg=2),
                            'graphite', b_off=B_STRAP, nseg=190))
    # молочная окантовка кромок стропы (язык манжет)
    for tag, a in (('a', H_STRAP), ('b', -H_STRAP)):
        pts = [pt(t, a, B_STRAP)
               for t in (0.008 + 0.984 * i / 22.0 for i in range(23))]
        parts.append(curve_tube(PREFIX + f'strap_bind_{tag}', pts, 0.0012,
                                'milk'))
    # строчка по стропе
    for tag, a in (('a', 0.0380), ('b', -0.0380)):
        pts = [pt(t, a, STRAP_TOP + 0.0002)
               for t in (0.150 + 0.690 * i / 20.0 for i in range(21))]
        parts.append(curve_tube(PREFIX + f'strap_stitch_{tag}', pts, 0.0005,
                                'dark'))

    # ---- пряжка-кам с рычагом быстросъёма -------------------------------
    wa_b, Tb, wb_b = frame_dir(TB, 1), frame_dir(TB, 0), frame_dir(TB, 2)
    parts.append(rect_ring(PREFIX + 'buckle_frame', pt(TB, 0.0, 0.0078),
                            wa_b, Tb, wb_b, 0.050, 0.052, 0.0050, 0.0026,
                            'steel', bev=0.0006))
    # прижимной кулачок-валик
    parts.append(cyl(PREFIX + 'buckle_cam', pt(TB, -0.0445, 0.0112),
                      pt(TB, 0.0445, 0.0112), 0.0060, 'steel', vertices=26,
                      bev=0.0005))
    # боковые щёки
    for tag, sgn in (('a', 1.0), ('b', -1.0)):
        parts.append(cube(PREFIX + 'buckle_cheek_' + tag,
                          pt(TB, sgn * (H_STRAP + 0.0034), 0.0068),
                          (0.056, 0.0046, 0.0092), 'steel', r=0.0010,
                          rot=rot_at(TB)))
    # рычаг быстросъёма и его приподнятый носок
    tilt(cube(PREFIX + 'buckle_lever', pt(TB - 0.014, 0.0, 0.0158),
              (0.030, 0.070, 0.0036), 'dark', r=0.0013, rot=rot_at(TB)),
         math.radians(-9.0))
    tilt(cube(PREFIX + 'buckle_lever_tip', pt(TB - 0.034, 0.0, 0.0188),
              (0.016, 0.058, 0.0032), 'dark', r=0.0013, rot=rot_at(TB)),
         math.radians(-30.0))
    # стропный язычок быстросъёма, выходит из-под носка рычага
    tilt(cube(PREFIX + 'buckle_pull', pt(TB - 0.058, 0.0, 0.0092),
              (0.034, 0.056, 0.0024), 'milk', r=0.0009, rot=rot_at(TB)),
         math.radians(-4.0))
    parts.append(ring_loop(PREFIX + 'pull_eyelet', pt(TB - 0.068, 0.0, 0.0106),
                            frame_dir(TB, 2), 0.0036, 0.0011, 'steel',
                            segs=26, rings=8))
    # заклёпки на спинке рамки
    for tag, a in (('a', 0.0355), ('b', -0.0355)):
        parts.append(cyl(PREFIX + f'buckle_rivet_{tag}',
                         pt(TB - 0.0255, a, 0.0052),
                         pt(TB - 0.0255, a, 0.0114), 0.0022, 'steel',
                         vertices=14))
    # стропный хомут, которым рамка пришита к ремню
    parts += strap_loop(TB + 0.042, PREFIX + 'buckle_web', half_len=0.0065)

    # ---- четыре D-кольца на стропных петлях ----------------------------
    for i, t in enumerate(T_RINGS):
        tag = 'abcd'[i]
        parts += strap_loop(t, PREFIX + f'dring_loop_{tag}', half_len=0.0055)
        n = Vector((0.16 * (1.0 if i % 2 == 0 else -1.0), 0.96, 0.10))
        parts.append(ring_loop(PREFIX + f'dring_{tag}',
                                pt(t, 0.0, STRAP_TOP + 0.0128),
                                n, 0.0210, 0.0032, 'steel',
                                segs=44, rings=10, scale_u=1.0, scale_v=0.82))
        parts.append(cyl(PREFIX + f'dring_rivet_{tag}',
                         pt(t, 0.0, STRAP_TOP + 0.0022),
                         pt(t, 0.0, STRAP_TOP + 0.0044),
                         0.0017, 'steel', vertices=12))

    # ---- ограничитель длины (стальной ползун) ---------------------------
    parts.append(rect_ring(PREFIX + 'limit_frame', pt(T_LIMIT, 0.0, 0.0090),
                            frame_dir(T_LIMIT, 1), frame_dir(T_LIMIT, 0),
                            frame_dir(T_LIMIT, 2), 0.102, 0.030, 0.0055,
                            0.0040, 'steel', bev=0.0008))
    parts.append(cube(PREFIX + 'limit_plate', pt(T_LIMIT, 0.0, 0.0146),
                      (0.016, 0.040, 0.0034), 'steel', r=0.0009,
                      rot=rot_at(T_LIMIT)))
    parts.append(cyl(PREFIX + 'limit_screw',
                     pt(T_LIMIT, -(H_STRAP + 0.0038), 0.0060),
                     pt(T_LIMIT, -(H_STRAP + 0.0038), 0.0150),
                     0.0019, 'steel', vertices=14))
    # шкала длины перед ограничителем
    for i, t in enumerate((0.700, 0.7155, 0.731)):
        parts.append(cube(PREFIX + f'length_tick_{"abc"[i]}',
                          pt(t, 0.020, STRAP_TOP + 0.0005),
                          (0.0042, 0.026, 0.0010), 'dark', r=0.0003,
                          rot=rot_at(t)))

    # ---- маркировка размера M ------------------------------------------
    parts.append(cube(PREFIX + 'size_tag', pt(T_TAG, 0.0, STRAP_TOP + 0.0009),
                      (0.022, 0.036, 0.0018), 'cream', r=0.0012,
                      rot=rot_at(T_TAG)))
    parts.append(cube(PREFIX + 'size_mark', pt(T_TAG, 0.0, STRAP_TOP + 0.0020),
                      (0.0115, 0.0034, 0.0009), 'dark', r=0.0003,
                      rot=rot_at(T_TAG)))
    for tag, a in (('a', 0.0122), ('b', -0.0122)):
        parts.append(cube(PREFIX + f'size_tick_{tag}',
                          pt(T_TAG, a, STRAP_TOP + 0.0020),
                          (0.0092, 0.0018, 0.0009), 'dark', r=0.0003,
                          rot=rot_at(T_TAG)))

    # ---- хомутик на свободном конце и окантовка торца ------------------
    parts += strap_loop(T_KEEPER, PREFIX + 'tail_keeper', half_len=0.0060)
    parts.append(sweep_band(PREFIX + 'tail_bind', T_BIND, 0.9992,
                            rrect(H_STRAP + 0.0012, TH_STRAP + 0.0016,
                                  0.0010, seg=2), 'milk',
                            b_off=B_STRAP, nseg=10))

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
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    mats = sorted(m.name for m in bpy.data.materials if m.users)
    rep = {
        'component': CID,
        'code': 'RST-WA-04',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_target_passport': [1.0, 0.12, 0.05],
        'bbox_ok': bool(size.x <= 1.005 and size.y <= 0.125
                        and size.z <= 0.055 and mn.z > -0.001),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'belt_length_mm': round(size.x * 1000, 1),
        'strap_width_mm': round(2 * H_STRAP * 1000, 1),
        'pad_width_mm': round(2 * H_PAD * 1000, 1),
        'pack_height_mm': round((STRAP_TOP - (B_PAD - TH_PAD)) * 1000, 1),
        'drings': len(T_RINGS),
        'materials': mats,
        'material_count': len(mats),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
        'plate': False,
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
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
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

    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(mesh_objs)
    size = mx - mn
    center = (mn + mx) * 0.5
    S = max(size)
    k = S / 0.085          # масштаб светового рига относительно манжеты

    bpy.ops.mesh.primitive_plane_add(size=10.0 * S,
                                     location=(center.x, center.y,
                                               mn.z - 0.0002 * S))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.26, -0.30, 0.30), 1.55, 0.30),
            ('fill', (-0.30, -0.24, 0.16), 0.60, 0.42),
            ('rim', (0.06, 0.30, 0.28), 0.95, 0.34)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy * k * k
        ld.shape = 'DISK'
        ld.size = sz * k
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = center + Vector(loc) * k
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 80
    cam_data.clip_end = 200.0 * max(1.0, S)
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized()

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
    # крупный план: пряжка, язычок быстросъёма и первый D-ring
    close_a = Vector((-0.492, min(mn.y, -0.050), -0.004))
    close_b = Vector((-0.212, max(mx.y, 0.050), 0.044))
    close_t = (close_a + close_b) * 0.5
    c_close = box_corners(close_a - close_t, close_b - close_t)

    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (-0.56, 0.50, 0.62), center, 85, c_main, 0.97, True),
        ('front', (0.06, -1.00, 0.30), center, 70, c_main, 0.95, True),
        ('side', (0.82, -0.50, 0.28), center, 70, c_main, 0.95, True),
        ('closeup', (-0.34, -0.66, 0.66), close_t, 80, c_close, 0.96, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, refine in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4 if refine else 0):
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
        print(f'RENDERED {tag} fill={max_ndc(fill) if refine else fill:.3f} {fp}',
              flush=True)
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
