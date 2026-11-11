"""Standalone builder: work_impact_roller (WRK-IMP-02, «Валик»).

Компактный контактный валик Ø 0,08 x 0,225 м на упругой оси (ось Y) с
рифлёной силиконовой рабочей поверхностью, графитовыми торцевыми кольцами,
молочной осью, статичной вилкой из двух подшипниковых щёк на задней балке,
пружинной подвеской (4 пружины + направляющие), быстросъёмным кулачковым
зажимом, ограничителем давления, LED и коротким кабелем.

Не зависит от build_component_library.py / build_work_tickle_firm.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_work_impact_roller.py

Выход:
  public/models/machine-modules/components/work_impact_roller.glb
  docs/plans/blockout/component-library/work_impact_roller/*.png
  docs/plans/blockout/component-library/work_impact_roller/report.json

Геометрия (Blender Z-up, метры):
  ось ролика = Y, линия x=0, z=Z0
  anim-пустышка = (0, 0, Z0) — ровно центр оси ролика
  вращаются (дети anim): roller_body, ring_n, ring_f, shaft, washer_n,
                         washer_f, collar_n, collar_f
  статичны:              spine, plate_n/f, bearing_ring_n/f, rod_* (4),
                         spring_* (4), limiter_stem/knob/cap, qr_block,
                         qr_cam, qr_lever, qr_pin, strain_relief, cable,
                         connector, led, badge, scale_marks

Ориентация для three.js (после export_yup): ось ролика = Z, вращение вокруг Z.
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
SHOTS = PROJECT / 'docs/plans/blockout/component-library/work_impact_roller'
CID = 'work_impact_roller'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.056                      # высота оси ролика
R = 0.040                       # радиус ролика по вершинам рифлей (Ø 0,08)
BODY_HALF = 0.110               # половина длины тела ролика (0,22)
FLUTES = 24                    # продольные рифли
FLUTE_AMP = 0.0018             # глубина рифли
RING_Y0, RING_Y1 = 0.110, 0.1185   # графитовые торцевые кольца
RING_R = 0.0412
SHAFT_R = 0.0062               # молочная ось
SHAFT_HALF = 0.1430
PLATE_Y = 0.1295               # центр подшипниковой щеки
PLATE_T = 0.013
PLATE_R = 0.0305
WASHER_Y0, WASHER_Y1 = 0.1363, 0.1375
WASHER_R = 0.0097
COLLAR_Y0, COLLAR_Y1 = 0.1375, 0.1430
COLLAR_R = 0.0087

SPINE_X0, SPINE_X1 = -0.060, -0.048    # задняя балка (не плита: «лук»)
SPINE_HALF_Y = 0.130
SPRING_X0, SPRING_X1 = -0.048, -0.0175  # пружины по X (входят в щёку)
SPRING_R = 0.0062
SPRING_TUBE = 0.0014
SPRING_TURNS = 4.8
SPRING_Z = 0.022
ROD_X0, ROD_X1 = -0.048, -0.019
ROD_R = 0.0045

LIM_X = -0.054                 # ограничитель давления сверху балки
QR_X0, QR_X1 = -0.070, -0.060  # кулачковый быстросъём снизу-сзади

PALETTE = {
    'ivory': (0.925, 0.902, 0.862),
    'steel': (0.660, 0.672, 0.678),
    'graphite': (0.204, 0.212, 0.231),
    'rubber': (0.118, 0.121, 0.131),
    'cyan': (0.400, 0.840, 0.900),
    'red': (0.620, 0.090, 0.078),
}
ROUGH = {'steel': 0.30, 'graphite': 0.52, 'rubber': 0.86,
         'cyan': 0.42, 'red': 0.48, 'ivory': 0.66}
METAL = {'steel': 0.90, 'graphite': 0.30, 'rubber': 0.0,
         'cyan': 0.0, 'red': 0.0, 'ivory': 0.0}
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
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = METAL[role]
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
    a, b = Vector(a), Vector(b)
    return cube(name, (a + b) * 0.5, b - a, role, r=r, smooth=smooth)


def bar(name, a, b, w, th, role, r=0.0012):
    """Брусок от a до b: w по X, th по Y, длина по b-a."""
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (w, th, d.length)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role)


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


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


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


def curve_tube(name, points, radius, role, res=4, spline='POLY'):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 12
    sp = cu.splines.new(spline)
    if spline == 'BEZIER':
        sp.bezier_points.add(len(points) - 1)
        for bp, p in zip(sp.bezier_points, points):
            bp.co = Vector(p)
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
    else:
        sp.points.add(len(points) - 1)
        for bp, p in zip(sp.points, points):
            bp.co = (p[0], p[1], p[2], 1.0)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def helix_x(name, x0, x1, y, z, radius, turns, tube_r, role, samples=68):
    pts = []
    for i in range(samples + 1):
        f = i / samples
        a = math.tau * turns * f
        pts.append((x0 + (x1 - x0) * f,
                    y + radius * math.cos(a),
                    z + radius * math.sin(a)))
    return curve_tube(name, pts, tube_r, role, res=2, spline='POLY')


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
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


def prism_x(name, prof, x0, x1, role, bev=0.0016, smooth=False):
    """Призма: замкнутый профиль (y, z-относительно Z0), выдавленный по X."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, Z0 + z)) for (y, z) in prof]
    b = [bm.verts.new((x1, y, Z0 + z)) for (y, z) in prof]
    n = len(prof)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    obj = mesh_from_bm(name, bm, role, smooth)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev)
    return obj


def fluted_roller(name, prof, role):
    """Ролик: профиль (y, коэфф. радиуса) + продольные рифли по окружности."""
    n = FLUTES * 6
    bm = bmesh.new()
    rings = []
    for (y, k) in prof:
        ring = []
        for j in range(n):
            th = math.tau * j / n
            r = ((R - FLUTE_AMP) + FLUTE_AMP * math.cos(FLUTES * th)) * k
            ring.append(bm.verts.new((r * math.cos(th), y, Z0 + r * math.sin(th))))
        rings.append(ring)
    for i in range(len(rings) - 1):
        a_, b_ = rings[i], rings[i + 1]
        for j in range(n):
            jn = (j + 1) % n
            bm.faces.new((a_[j], a_[jn], b_[jn], b_[j]))
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return mesh_from_bm(name, bm, role, smooth=True)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- ролик: рифлёная силиконовая поверхность ------------------------
    prof = [
        (-BODY_HALF, 0.955),
        (-BODY_HALF + 0.0025, 1.0),
        (-0.0975, 1.0),
        (-0.0955, 0.962),      # кольцевая канавка
        (-0.0915, 0.962),
        (-0.0895, 1.0),
        (0.0895, 1.0),
        (0.0915, 0.962),
        (0.0955, 0.962),
        (0.0975, 1.0),
        (BODY_HALF - 0.0025, 1.0),
        (BODY_HALF, 0.955),
    ]
    roller = fluted_roller(PREFIX + 'roller_body', prof, 'rubber')
    rotating.append(roller)

    # графитовые торцевые кольца
    for tag, s in (('n', -1.0), ('f', 1.0)):
        cyl(PREFIX + f'ring_{tag}', (0, s * RING_Y0, Z0), (0, s * RING_Y1, Z0),
            RING_R, 'graphite', vertices=56, bev=0.0012)
        rotating.append(bpy.data.objects[PREFIX + f'ring_{tag}'])

    # молочная ось, прижимные шайбы, стальные цапфы
    shaft = cyl(PREFIX + 'shaft', (0, -SHAFT_HALF, Z0), (0, SHAFT_HALF, Z0),
                SHAFT_R, 'ivory', vertices=24)
    rotating.append(shaft)
    for tag, s in (('n', -1.0), ('f', 1.0)):
        cyl(PREFIX + f'washer_{tag}', (0, s * WASHER_Y0, Z0), (0, s * WASHER_Y1, Z0),
            WASHER_R, 'steel', vertices=28, bev=0.0008)
        cyl(PREFIX + f'collar_{tag}', (0, s * COLLAR_Y0, Z0), (0, s * COLLAR_Y1, Z0),
            COLLAR_R, 'steel', vertices=24, bev=0.0010)
        rotating += [bpy.data.objects[PREFIX + f'washer_{tag}'],
                     bpy.data.objects[PREFIX + f'collar_{tag}']]

    # ---- статичная вилка: две подшипниковые щеки ------------------------
    for tag, s in (('n', -1.0), ('f', 1.0)):
        y0 = s * (PLATE_Y - PLATE_T * 0.5)
        y1 = s * (PLATE_Y + PLATE_T * 0.5)
        cyl(PREFIX + f'plate_{tag}', (0, y0, Z0), (0, y1, Z0), PLATE_R,
            'ivory', vertices=56, bev=0.0022)
        torus(PREFIX + f'bearing_ring_{tag}', (0, s * (PLATE_Y - PLATE_T * 0.5 - 0.0004), Z0),
              0.0128, 0.0024, 'steel', 'Y', segs=40, rings=8)

    # задняя балка-«лук» (не плита: узкая в середине, широкая у щёк)
    spine_prof = [
        (-SPINE_HALF_Y, -0.0295),
        (-0.096, -0.0245),
        (-0.048, -0.0165),
        (0.0, -0.0135),
        (0.048, -0.0165),
        (0.096, -0.0245),
        (SPINE_HALF_Y, -0.0295),
        (SPINE_HALF_Y, 0.0295),
        (0.096, 0.0245),
        (0.048, 0.0165),
        (0.0, 0.0135),
        (-0.048, 0.0165),
        (-0.096, 0.0245),
        (-SPINE_HALF_Y, 0.0295),
    ]
    prism_x(PREFIX + 'spine', spine_prof, SPINE_X0, SPINE_X1, 'steel', bev=0.0024)

    # ---- упругая ось: направляющие + пружины ----------------------------
    for tag, s in (('n', -1.0), ('f', 1.0)):
        for ztag, zs in (('up', 1.0), ('dn', -1.0)):
            y = s * PLATE_Y
            z = Z0 + zs * SPRING_Z
            cyl(PREFIX + f'rod_{tag}_{ztag}', (ROD_X0, y, z), (ROD_X1, y, z),
                ROD_R, 'steel', vertices=14)
            helix_x(PREFIX + f'spring_{tag}_{ztag}', SPRING_X0, SPRING_X1,
                    y, z, SPRING_R, SPRING_TURNS, SPRING_TUBE, 'steel')

    # ---- ограничитель давления -----------------------------------------
    cyl(PREFIX + 'limiter_stem', (LIM_X, 0, Z0 + 0.010), (LIM_X, 0, Z0 + 0.030),
        0.0065, 'graphite', vertices=16, bev=0.0008)
    cyl(PREFIX + 'limiter_knob', (LIM_X, 0, Z0 + 0.0295), (LIM_X, 0, Z0 + 0.0435),
        0.0105, 'graphite', vertices=18, smooth=False, bev=0.0012)
    torus(PREFIX + 'limiter_cap', (LIM_X, 0, Z0 + 0.0435), 0.0100, 0.0013,
          'steel', 'Z', segs=32, rings=6)
    cube(PREFIX + 'limiter_mark', (LIM_X + 0.0104, 0, Z0 + 0.0365),
         (0.0022, 0.0052, 0.0052), 'red', r=0.0006)

    # шкала давления на передней грани балки
    bm = bmesh.new()
    for i in range(4):
        y = 0.0190 + i * 0.0072
        h = 0.0082 if i % 2 == 0 else 0.0050
        bmesh.ops.create_cube(bm, size=1.0,
                              matrix=(Matrix.Translation(Vector((-0.0540, y, Z0 + 0.0152)))
                                      @ Matrix.Diagonal(Vector((0.0022, h, 0.0016, 1.0)))))
    mesh_from_bm(PREFIX + 'scale_marks', bm, 'graphite', smooth=False)

    # шильдик у щеки
    box(PREFIX + 'badge', (SPINE_X1 - 0.0002, 0.1060, Z0 + 0.0110),
        (SPINE_X1 + 0.0016, 0.1195, Z0 + 0.0196), 'graphite', r=0.0006)

    # ---- быстросъёмный кулачковый зажим --------------------------------
    QR_Y = -0.117
    box(PREFIX + 'qr_block', (QR_X0 + 0.001, QR_Y - 0.0165, Z0 - 0.0335),
        (QR_X1, QR_Y + 0.0165, Z0 - 0.0015), 'graphite', r=0.0024)
    cam_x = QR_X0 + 0.0065
    cam_y0, cam_y1 = QR_Y - 0.0205, QR_Y + 0.0205
    cyl(PREFIX + 'qr_cam', (cam_x, cam_y0, Z0 - 0.0265),
        (cam_x, cam_y1, Z0 - 0.0265), 0.0095, 'graphite',
        vertices=30, bev=0.0014)
    bar(PREFIX + 'qr_lever', (cam_x - 0.0015, QR_Y, Z0 - 0.0330),
        (QR_X0 - 0.0045, QR_Y, Z0 - 0.0455), 0.0082, 0.0056, 'graphite', r=0.0015)
    cyl(PREFIX + 'qr_pin', (cam_x, cam_y0 - 0.0018, Z0 - 0.0265),
        (cam_x, cam_y1 + 0.0018, Z0 - 0.0265), 0.0030, 'steel',
        vertices=12)

    # ---- кабель, разъём, LED --------------------------------------------
    cyl(PREFIX + 'strain_relief', (SPINE_X0 + 0.0010, 0.0940, Z0 + 0.0010),
        (SPINE_X0 - 0.0044, 0.0962, Z0 - 0.0095), 0.0046, 'graphite',
        vertices=16, bev=0.0008)
    curve_tube(PREFIX + 'cable',
               [(SPINE_X0 - 0.0036, 0.0960, Z0 - 0.0090),
                (SPINE_X0 - 0.0064, 0.0972, Z0 - 0.0225),
                (SPINE_X0 - 0.0074, 0.0948, Z0 - 0.0330),
                (SPINE_X0 - 0.0070, 0.0900, Z0 - 0.0390)],
               0.0026, 'graphite', res=4)
    box(PREFIX + 'connector', (-0.0712, 0.0838, Z0 - 0.0432),
        (-0.0640, 0.0942, Z0 - 0.0360), 'graphite', r=0.0012)
    sphere(PREFIX + 'led', (SPINE_X1 + 0.0006, -0.1180, Z0 + 0.0125), 0.0030, 'cyan')

    # ---- анимационная пустышка в центре оси ролика ---------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    bpy.context.view_layer.update()
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
    all_mesh = [o for o in bpy.data.objects
                if o.type == 'MESH' and o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    roller = bpy.data.objects[PREFIX + 'roller_body']
    r_mn, r_mx = mesh_bbox([roller])
    roller_len = r_mx.y - r_mn.y
    roller_dia = max(r_mx.x - r_mn.x, r_mx.z - r_mn.z)
    roller_c = (r_mn + r_mx) * 0.5
    # расстояние от anim до оси ролика (линия x=roller_c.x, z=roller_c.z по Y)
    axis_off = math.hypot(anim.location.x - roller_c.x, anim.location.z - roller_c.z)

    # pivot-тест: bbox-центр вращающейся группы до/после 90° вокруг Y
    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, math.radians(90.0), 0.0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    # ось Y подтверждаем смещением вдоль X при повороте на 20° (ролик не должен «качаться»)
    anim.rotation_euler = (0.0, math.radians(20.0), 0.0)
    bpy.context.view_layer.update()
    s_mn, s_mx = mesh_bbox([roller])
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    spin_center_shift = ((s_mn + s_mx) * 0.5 - roller_c).length

    static = sorted(o.name for o in bpy.data.objects
                    if o.name.startswith(PREFIX) and o.type == 'MESH'
                    and o not in kids)
    prefixed = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]

    report = {
        'component': CID,
        'code': 'WRK-IMP-02',
        'nodes': len(prefixed),
        'mesh_nodes': len(all_mesh),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.120 and size.y <= 0.300 and size.z <= 0.120),
        'roller_diameter': round(roller_dia, 5),
        'roller_diameter_ok': bool(0.076 <= roller_dia <= 0.082),
        'roller_length': round(roller_len, 5),
        'roller_length_ok': bool(0.2195 <= roller_len <= 0.2505),
        'roller_axis': 'y',
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_at_axis_m': round(axis_off, 9),
        'anim_at_axis_mm': round(axis_off * 1000, 5),
        'anim_at_axis_ok': bool(axis_off < 0.001),
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.001),
        'spin_center_shift_mm': round(spin_center_shift * 1000, 5),
        'spin_center_ok': bool(spin_center_shift < 0.001),
        'static_nodes': static,
        'static_count': len(static),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': {
            'type': 'spin',
            'axis': 'y',                 # Blender-ось ролика
            'threejs_axis': 'z',         # после export_yup: Blender Y -> glTF Z
            'speed': 1.2,
            'speed_unit': 'rad/s',
            'node': anim.name,
            'parts': sorted(o.name for o in kids),
        },
    }
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
def setup_render(mn):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = -0.25
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.700, 0.702, 0.712, 1.0)
    bg.inputs['Strength'].default_value = 0.62

    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, mn.z - 0.0006))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.695, 0.697, 0.705, 1.0)
    nb.inputs['Roughness'].default_value = 0.90
    floor.data.materials.append(fm)

    for name, direction, energy in [
            ('key', (1.0, -1.1, 1.35), 1.35),
            ('fill', (-1.2, -0.9, 0.55), 0.50),
            ('rim', (0.25, 1.05, 0.85), 0.95)]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(16)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()


def shot(name, direction, target, ortho_scale=None, dist=0.6, lens=85,
         res=(900, 760), floor=True):
    sc = bpy.context.scene
    fl = bpy.data.objects.get('render_floor')
    if fl is not None:
        fl.hide_render = not floor
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


def render(rep, anim, mn):
    SHOTS.mkdir(parents=True, exist_ok=True)
    for old in SHOTS.glob('*.png'):
        old.unlink()
    setup_render(mn)
    # 3/4: ролик между щеками, пружины и кулачковый зажим
    shot('3q', (0.85, -1.25, 0.52), (-0.010, 0.0, Z0 - 0.002), ortho_scale=0.325,
         res=(1280, 800))
    # фронт: рабочая поверхность ролика с рифлями
    shot('front', (-0.30, -1.0, 0.14), (-0.020, 0.0, Z0 - 0.002), ortho_scale=0.205,
         res=(920, 780))
    # торец: щека, цапфа, пружины, ограничитель, зажим
    shot('side', (1.0, -0.10, 0.07), (-0.004, 0.0, Z0), ortho_scale=0.348,
         res=(1280, 560))
    # крупный план торца: кольцо, ось, пружина
    shot('closeup', (0.55, -0.95, 0.34), (-0.002, -0.086, Z0 + 0.002), dist=0.300,
         lens=88, res=(980, 760), floor=False)
    # контроль читаемости на 300 px
    shot('preview300', (0.85, -1.25, 0.52), (-0.010, 0.0, Z0 - 0.002),
         ortho_scale=0.325, res=(300, 300))
    # доказательство вращения вокруг Y: тот же кадр, ролик повёрнут на 22,5°
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, math.radians(22.5), 0.0)
    bpy.context.view_layer.update()
    shot('spin22', (0.85, -1.25, 0.52), (-0.010, 0.0, Z0 - 0.002),
         ortho_scale=0.325, res=(1280, 800), floor=False)
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    rep['renders'] = sorted(str(p.relative_to(PROJECT)) for p in SHOTS.glob('*.png'))


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    mn = Vector(rep['bbox_min'])
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    render(rep, anim, mn)
    SHOTS.mkdir(parents=True, exist_ok=True)
    (SHOTS / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['anim_at_axis_ok']
            and rep['spin_center_ok'] and rep['roller_length_ok']
            and rep['roller_diameter_ok'] and rep['material_count'] >= 4
            and rep['nodes'] >= 20):
        raise SystemExit('checks failed')


main()
