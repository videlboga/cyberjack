"""Standalone builder: work_tickle_soft (WRK-TIC-01, «Мягкая щётка»).

Компактная быстросъёмная кассета с мягким густым ворсом на цилиндрическом
барабане (ось X). Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_tickle_soft.py

Выход:
  public/models/machine-modules/components/work_tickle_soft.glb

Геометрия (Blender Z-up, метры):
  ось барабана   = X, линия y=0, z=Z0
  anim-пустышка  = (0, 0, Z0) — ровно центр оси барабана
  вращаются: drum, pile_base, bristles, bristle_tips, drum_ring_rear,
             drum_ring_front, shaft, washer_rear, washer_front, drum_nut
  статичны:  guard, guard_lip_front, guard_lip_rear, silicone_bumper,
             guard_post, guard_arm_rear, guard_arm_front, motor, motor_cap,
             motor_ring, strain_relief, cable, cable_connector, led,
             led_bezel, softness_dots, clamp_band, clamp_lug, clamp_lever,
             clamp_screw, bearing_boss, bearing_cap, yoke_arm_l, yoke_arm_r,
             yoke_bridge
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
CID = 'work_tickle_soft'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.042                              # высота оси барабана
DRUM_X0, DRUM_X1 = -0.0540, 0.0580      # тело барабана, длина 0.112
CORE_R = 0.0265                         # графитовый сердечник Ø0.053
RING_X = 0.0070                         # ширина розовых концевых колец
RING_R = 0.0308
PILE_X0, PILE_X1 = -0.0385, 0.0425      # зона ворса, 0.081
SLEEVE_R = 0.0296                       # бледная силиконовая основа ворса
BRISTLE_R0 = 0.0270                     # утоплено в основу
BRISTLE_LEN = 0.0086                    # ~8.6 мм выступает
BRISTLE_RB = 0.00210                    # основание пучка
BRISTLE_RT = 0.00128                    # кончик пучка (слабая конусность = мягко)
TIP_R = 0.00128                         # мягкое округлое окончание
ROWS = 16                               # рядов по длине
PER_ROW = 24                            # пучков в ряду
SHAFT_X0, SHAFT_X1 = -0.0700, 0.0775
SHAFT_R = 0.0045

MOTOR_X0, MOTOR_X1 = -0.0780, -0.0585
MOTOR_R = 0.0215
GUARD_X0, GUARD_X1 = -0.0470, 0.0520
GUARD_RI, GUARD_RO = 0.0372, 0.0392
# дуга: от -35° (перед-верх) через верх к +140° (зад-низ);
# открыта спереди-снизу — со стороны контакта ворса
GUARD_A0, GUARD_A1 = math.radians(-34.0), math.radians(130.0)

CLAMP_X0, CLAMP_X1 = -0.0715, -0.0635
CLAMP_R = 0.0250

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.982, 0.975, 0.960),
    'pale': (0.956, 0.870, 0.874),
    'blush': (0.918, 0.735, 0.756),
    'steel': (0.735, 0.741, 0.732),
    'graphite': (0.330, 0.341, 0.353),
    'cyan': (0.740, 0.905, 0.925),
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
    bsdf.inputs['Roughness'].default_value = 0.74 if role in ('pale', 'ivory') else 0.58
    bsdf.inputs['Metallic'].default_value = 0.32 if role in ('steel', 'graphite') else 0.0
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


def bevel(obj, width=0.0015, segments=2, angle=True):
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


def arc_shell(name, x0, x1, r_in, r_out, a0, a1, seg, role, cy=0.0, cz=Z0):
    """Тонкий кожух-сектор: дуга от +Z в сторону +Y, открыт снизу."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        dy, dz = math.sin(a), math.cos(a)
        ring = []
        for x in (x0, x1):
            for r in (r_in, r_out):
                ring.append(bm.verts.new((x, cy + dy * r, cz + dz * r)))
        rings.append(ring)
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        bm.faces.new((a_[0], a_[2], b_[2], b_[0]))   # inner
        bm.faces.new((a_[1], b_[1], b_[3], a_[3]))   # outer
        bm.faces.new((a_[0], a_[1], b_[1], b_[0]))   # x0 cap
        bm.faces.new((a_[2], a_[3], b_[3], b_[2]))   # x1 cap
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, True)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def bmesh_cone(bm, base, direction, length, r1, r2, segments=8):
    d = Vector(direction).normalized()
    m = (Matrix.Translation(Vector(base) + d * (length * 0.5))
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=r1, radius2=r2, depth=length, matrix=m)


def bmesh_bead(bm, base, radius, u=6, v=4):
    bmesh.ops.create_uvsphere(bm, u_segments=u, v_segments=v, radius=radius,
                              matrix=Matrix.Translation(Vector(base)))


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def radial(a):
    """Радиальное направление вокруг оси X: a=0 -> +Z, a=+90° -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


def jitter(i, k, seed=0):
    """Детерминированный «человеческий» разброс для мягкого ворса."""
    return math.sin(i * 12.9898 + k * 78.233 + seed * 3.17) * 0.5


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []
    C = Vector((0.0, 0.0, Z0))

    # ---- барабан: графитовый сердечник + розовые кольца ----------------
    drum = cyl(PREFIX + 'drum', (DRUM_X0, 0, Z0), (DRUM_X1, 0, Z0), CORE_R,
               'graphite', vertices=48, bev=0.0020)
    ring_rear = cyl(PREFIX + 'drum_ring_rear', (DRUM_X0, 0, Z0),
                    (DRUM_X0 + RING_X, 0, Z0), RING_R, 'blush',
                    vertices=44, bev=0.0016)
    ring_front = cyl(PREFIX + 'drum_ring_front', (DRUM_X1 - RING_X, 0, Z0),
                     (DRUM_X1, 0, Z0), RING_R, 'blush', vertices=44, bev=0.0016)
    # бледная эластичная основа ворса — гасит «дыры» между пучками
    sleeve = cyl(PREFIX + 'pile_base', (PILE_X0, 0, Z0), (PILE_X1, 0, Z0),
                 SLEEVE_R, 'ivory', vertices=44, bev=0.0009)
    rotating += [drum, ring_rear, ring_front, sleeve]

    # ---- мягкий густой ворс: 16 рядов × 24 пучка = 384 -------------------
    bm = bmesh.new()
    tip_bm = bmesh.new()
    step = (PILE_X1 - PILE_X0) / (ROWS - 1)
    dphi = math.tau / PER_ROW
    for ri in range(ROWS):
        x = PILE_X0 + ri * step
        phase = dphi * 0.5 * (ri % 2)                     # шахматный сдвиг
        lean = 0.045 if ri % 2 else -0.045                # мягкий «мех» наклон
        for k in range(PER_ROW):
            j1, j2, j3 = jitter(ri, k, 1), jitter(ri, k, 2), jitter(ri, k, 3)
            ang = phase + k * dphi + j1 * 0.020           # ±1.1°
            length = BRISTLE_LEN + j2 * 0.00040           # ±0.4 мм
            d = radial(ang + lean + j3 * 0.055)
            base = C + Vector((x + j1 * 0.0006, 0, 0)) + d * BRISTLE_R0
            bmesh_cone(bm, base, d, length, BRISTLE_RB, BRISTLE_RT, 8)
            # мягкое округлое окончание вместо среза
            bmesh_bead(tip_bm, base + d * length, TIP_R, 7, 4)
    bristles = mesh_from_bm(PREFIX + 'bristles', bm, 'pale')
    tips = mesh_from_bm(PREFIX + 'bristle_tips', tip_bm, 'ivory')
    rotating += [bristles, tips]

    # ---- вал по оси барабана -------------------------------------------
    shaft = cyl(PREFIX + 'shaft', (SHAFT_X0, 0, Z0), (SHAFT_X1, 0, Z0),
                SHAFT_R, 'steel', vertices=20)
    rotating.append(shaft)

    # ---- стальные шайбы и осевая гайка ---------------------------------
    washer_rear = cyl(PREFIX + 'washer_rear', (-0.0585, 0, Z0),
                       (DRUM_X0, 0, Z0), 0.0220, 'steel', vertices=36, bev=0.0010)
    washer_front = cyl(PREFIX + 'washer_front', (DRUM_X1, 0, Z0),
                        (0.0625, 0, Z0), 0.0220, 'steel', vertices=36, bev=0.0010)
    nut = cyl(PREFIX + 'drum_nut', (0.0625, 0, Z0), (0.0675, 0, Z0), 0.0105,
              'graphite', vertices=6, bev=0.0008)
    rotating += [washer_rear, washer_front, nut]

    # ---- моторный корпус (статичен) ------------------------------------
    cyl(PREFIX + 'motor', (MOTOR_X0, 0, Z0), (MOTOR_X1, 0, Z0), MOTOR_R,
        'blush', vertices=44, bev=0.0035)
    cyl(PREFIX + 'motor_cap', (-0.0790, 0, Z0), (MOTOR_X0, 0, Z0), 0.0230,
        'graphite', vertices=40, bev=0.0022)
    torus(PREFIX + 'motor_ring', (-0.0776, 0, Z0), 0.0222, 0.0013, 'steel', 'X')

    # кабель: назад-вниз через гермоввод, короткий хвост с разъёмом
    d_out = radial(math.radians(-132.0))
    sr0 = Vector((-0.0718, 0, Z0)) + d_out * 0.0170
    sr1 = Vector((-0.0718, 0, Z0)) + d_out * 0.0262
    cyl(PREFIX + 'strain_relief', sr0, sr1, 0.0052, 'graphite',
        vertices=18, bev=0.0010)
    curve_tube(PREFIX + 'cable',
               [tuple(sr1), (-0.0702, -0.0262, Z0 - 0.0245),
                (-0.0672, -0.0272, Z0 - 0.0312),
                (-0.0628, -0.0252, Z0 - 0.0340)], 0.0028, 'graphite')
    cube(PREFIX + 'cable_connector', (-0.0585, -0.0248, Z0 - 0.0348),
         (0.0104, 0.0078, 0.0070), 'graphite', r=0.0016)

    # ---- индикатор: циановый LED на -Y (сторона камеры) ----------------
    led_p = (-0.0705, -0.0205, Z0 + 0.0048)
    sphere(PREFIX + 'led', led_p, 0.0024, 'cyan', 16, 10)
    torus(PREFIX + 'led_bezel', (led_p[0], -0.0209, led_p[2]), 0.0029, 0.0007,
          'graphite', 'Y', segs=20, rings=8)

    # маркировка мягкости: две бледно-розовые точки
    bm = bmesh.new()
    for i in range(2):
        x = -0.0690 - i * 0.0050
        bmesh_cone(bm, (x, -MOTOR_R + 0.0006, Z0 - 0.0045), (0, -1, 0),
                   0.0012, 0.0024, 0.0022, 12)
    mesh_from_bm(PREFIX + 'softness_dots', bm, 'pale')

    # ---- быстросъёмный хомут (байонетная обойма на моторе) -------------
    cyl(PREFIX + 'clamp_band', (CLAMP_X0, 0, Z0), (CLAMP_X1, 0, Z0), CLAMP_R,
        'steel', vertices=48, bev=0.0016)
    cube(PREFIX + 'clamp_lug', (-0.0675, 0.0, Z0 + 0.0262),
         (0.0086, 0.0132, 0.0080), 'steel', r=0.0014)
    cube(PREFIX + 'clamp_lever', (-0.0675, 0.0128, Z0 + 0.0318),
         (0.0062, 0.0180, 0.0068), 'steel', r=0.0012,
         rot=(math.radians(-18), 0, 0))
    cyl(PREFIX + 'clamp_screw', (-0.0675, 0.0, Z0 + 0.0290),
        (-0.0675, 0.0, Z0 + 0.0348), 0.0026, 'graphite', vertices=12)

    # ---- молочный кожух-дуга (открыт спереди-снизу) --------------------
    arc_shell(PREFIX + 'guard', GUARD_X0, GUARD_X1, GUARD_RI, GUARD_RO,
              GUARD_A0, GUARD_A1, 30, 'ivory')
    r_mid = (GUARD_RI + GUARD_RO) * 0.5
    for tag, a in (('front', GUARD_A0), ('rear', GUARD_A1)):
        d = radial(a)
        cyl(PREFIX + f'guard_lip_{tag}',
            (GUARD_X0, d.y * r_mid, Z0 + d.z * r_mid),
            (GUARD_X1, d.y * r_mid, Z0 + d.z * r_mid), 0.0016, 'body', vertices=14)
    # мягкий силиконовый бампер на передней кромке кожуха
    d = radial(GUARD_A0)
    cyl(PREFIX + 'silicone_bumper',
        (GUARD_X0 + 0.0025, d.y * (GUARD_RO - 0.0007), Z0 + d.z * (GUARD_RO - 0.0007)),
        (GUARD_X1 - 0.0025, d.y * (GUARD_RO - 0.0007), Z0 + d.z * (GUARD_RO - 0.0007)),
        0.0026, 'blush', vertices=26)

    # ---- несущие кронштейны кожуха (по краям зоны ворса) ---------------
    cyl(PREFIX + 'guard_strut', (-0.0680, 0.0, Z0 + 0.0258),
        (-0.0470, 0.0, Z0 + 0.0374), 0.0040, 'steel', vertices=14)
    cube(PREFIX + 'guard_arm_front', (0.0575, 0.0, Z0 + 0.0348),
         (0.0210, 0.0105, 0.0046), 'steel', r=0.0010)

    # ---- подшипниковая вилка напротив мотора ---------------------------
    cyl(PREFIX + 'bearing_boss', (0.0675, 0, Z0), (0.0745, 0, Z0), 0.0148,
        'graphite', vertices=28, bev=0.0016)
    cyl(PREFIX + 'bearing_cap', (0.0745, 0, Z0), (0.0765, 0, Z0), 0.0114,
        'steel', vertices=28, bev=0.0008)
    for tag, sy in (('l', -1.0), ('r', 1.0)):
        cube(PREFIX + f'yoke_arm_{tag}', (0.0695, sy * 0.0112, Z0 + 0.0192),
             (0.0064, 0.0050, 0.0272), 'steel', r=0.0011)
    cube(PREFIX + 'yoke_bridge', (0.0695, 0.0, Z0 + 0.0348),
         (0.0074, 0.0272, 0.0044), 'steel', r=0.0009)

    # ---- анимационная пустышка ровно в центре оси барабана -------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    bpy.context.view_layer.update()   # иначе matrix_world ещё identity
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in rotating:
            o['rotating'] = False

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
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    # pivot-тест: bbox-центр детей anim до/после 90° вокруг X
    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    drum = bpy.data.objects[PREFIX + 'drum']
    d_mn, d_mx = mesh_bbox([drum])
    brush_mn, brush_mx = mesh_bbox([bpy.data.objects[PREFIX + 'bristles'],
                                    bpy.data.objects[PREFIX + 'bristle_tips']])
    axis_err = math.hypot(k_c0.y, k_c0.z - Z0)

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.160 and size.y <= 0.080 and size.z <= 0.100),
        'drum_length': round((d_mx - d_mn).x, 5),
        'drum_length_ok': bool(0.110 <= (d_mx - d_mn).x <= 0.120),
        'brush_diameter': round(max(brush_mx.y - brush_mn.y,
                                    brush_mx.z - brush_mn.z), 5),
        'bristle_tufts': ROWS * PER_ROW,
        'bristle_rows': ROWS,
        'bristle_per_row': PER_ROW,
        'bristle_len_mm': round(BRISTLE_LEN * 1000, 2),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children_rotating': sorted(o.name for o in kids),
        'anim_child_count': len(kids),
        'pivot_shift_mm': round(pivot_shift * 1000, 4),
        'pivot_axis_error_mm': round(axis_err * 1000, 4),
        'pivot_ok': bool(pivot_shift < 0.001),
        'static_meshes': sorted(o.name for o in bpy.data.objects
                                if o.name.startswith(PREFIX)
                                and o.type == 'MESH' and o not in kids),
        'materials': sorted(m.name for m in bpy.data.materials),
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
    if not path.is_file() or path.stat().st_size < 20000:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['drum_length_ok']):
        raise SystemExit('checks failed')


main()
