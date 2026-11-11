"""Standalone builder: work_electro_collar (WRK-EL-02, «Шоковый ошейник»).

Компактный регулируемый ошейник: графитовая лента с мягкой внутренней
подкладкой, два утопленных контакта в подкладке, модуль импеданса с циановым
LED, быстросъёмная защёлка и короткий кабель с разъёмом. Плиты нет.

Паспорт: Ø 0,14 × 0,04 м, композит/силикон, быстросъём,
«графитовый ошейник, циановые контакты».

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_electro_collar.py

Выход:
  public/models/machine-modules/components/work_electro_collar.glb

Система координат (Blender Z-up, метры):
  ось ошейника  = Z, центр кольца в начале координат
  азимут        = от -Y: a=0 -> -Y (перед, модуль импеданса),
                  a=90 -> +X (защёлка), a=315 -> лево-перед (регулировка),
                  a=180 -> +Y (затылок)
  радиусы       = лента 0.0560..0.0635, подкладка 0.0520..0.0562
  контакты      = азимуты ±20°, стакан утоплен на 2.9 мм в подкладку
  кабель        = вниз от модуля, короткий хвост с разъёмом
Движения нет (каталог: motion none), анимации нет.
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
CID = 'work_electro_collar'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
BAND_R_IN, BAND_R_OUT = 0.0560, 0.0635     # лента: 7.5 мм по радиусу
BAND_HH = 0.0135                            # полувысота ленты (ширина 27 мм)
LINER_R_IN, LINER_R_OUT = 0.0520, 0.0562    # мягкая подкладка: 4.2 мм
LINER_HH = 0.0115

EL_AZ = (-20.0, 20.0)          # азимуты контактов (у горла, под модулем)
EL_WIN = 4.5                   # полуширина окна в подкладке, градусы
EL_Z_HOLE = 0.0058             # полувысота окна
EL_SOCKET_R = 0.0078           # стакан: перекрывает углы окна
EL_FACE_R = 0.0546             # дно стакана = 2.6 мм от подкладки
EL_CONTACT_RADIUS = 0.0038
EL_RIM_MAJOR = 0.0082          # силиконовый буртик вокруг окна

BUCKLE_Y = -0.0630             # защёлка строится на -Y и поворачивается на +X
MODULE_Y = 0.0645              # модуль строится на +Y и поворачивается на -Y
Z_TOP = 0.0180                 # верх модуля
CABLE_Z = -0.0348              # низ разъёма (паспортная высота — без хвоста)

PALETTE = {
    'graphite': (0.205, 0.215, 0.228),
    'graphite_l': (0.285, 0.298, 0.312),
    'dark': (0.085, 0.092, 0.102),
    'steel': (0.690, 0.700, 0.706),
    'silicon': (0.855, 0.845, 0.822),
    'cyan': (0.180, 0.900, 0.940),
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
        bsdf.inputs['Roughness'].default_value = 0.34
        bsdf.inputs['Metallic'].default_value = 0.85
    elif role == 'graphite':
        bsdf.inputs['Roughness'].default_value = 0.54
        bsdf.inputs['Metallic'].default_value = 0.32
    elif role == 'graphite_l':
        bsdf.inputs['Roughness'].default_value = 0.62
        bsdf.inputs['Metallic'].default_value = 0.26
    elif role == 'dark':
        bsdf.inputs['Roughness'].default_value = 0.74
        bsdf.inputs['Metallic'].default_value = 0.10
    elif role == 'silicon':
        bsdf.inputs['Roughness'].default_value = 0.88
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Sheen Weight'].default_value = 0.25
    if role == 'cyan':
        bsdf.inputs['Roughness'].default_value = 0.30
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 2.20
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        select_only(obj)
        try:
            bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
        except Exception:
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


def cyl(name, a, b, radius, role, vertices=32, smooth=True, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-7:
        raise ValueError(name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=d.length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def torus(name, loc, major, minor, role, axis=(0, 0, 1), segs=64, rings=10):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = Vector(axis).normalized().to_track_quat('Z', 'Y').to_euler()
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def radial(a_deg):
    """Радиальное направление: a=0 -> -Y (перед), a=90 -> +X, a=180 -> +Y."""
    a = math.radians(a_deg)
    return Vector((math.sin(a), -math.cos(a), 0.0))


def at(a_deg, r, z=0.0):
    d = radial(a_deg)
    return Vector((d.x * r, d.y * r, z))


# --- профильная лента по азимуту -----------------------------------------
def rr_profile(r0, r1, z0, z1, cr, n=4):
    """Замкнутый профиль (r, z) — прямоугольник со скруглёнными углами."""
    cr = max(1e-5, min(cr, (r1 - r0) * 0.5 - 1e-5, (z1 - z0) * 0.5 - 1e-5))
    pts = []
    for cc_r, cc_z, a0, a1 in (
        (r1 - cr, z0 + cr, -90.0, 0.0),
        (r1 - cr, z1 - cr, 0.0, 90.0),
        (r0 + cr, z1 - cr, 90.0, 180.0),
        (r0 + cr, z0 + cr, 180.0, 270.0),
    ):
        for k in range(n + 1):
            a = math.radians(a0 + (a1 - a0) * k / n)
            pts.append((cc_r + math.cos(a) * cr, cc_z + math.sin(a) * cr))
    return pts


def ring(name, prof, a0, a1, seg, role, full=False):
    """Тело вращения профиля (r,z) по дуге азимутов; full=True — замкнутое."""
    bm = bmesh.new()
    prof = list(prof)
    m = len(prof)
    n = seg if full else seg + 1
    rings = []
    for i in range(n):
        a = a0 + (a1 - a0) * i / seg
        d = radial(a)
        rings.append([bm.verts.new((p[0] * d.x, p[0] * d.y, p[1])) for p in prof])
    pairs = ([(i, (i + 1) % n) for i in range(n)] if full
             else [(i, i + 1) for i in range(n - 1)])
    for i0, i1 in pairs:
        r0_, r1_ = rings[i0], rings[i1]
        for j in range(m):
            bm.faces.new((r0_[j], r1_[j], r1_[(j + 1) % m], r0_[(j + 1) % m]))
    if not full:
        bm.faces.new(rings[0])
        bm.faces.new(tuple(reversed(rings[-1])))
    return mesh_from_bm(name, bm, role)


def bm_box(bm, center, size, rot_z=0.0):
    m = (Matrix.Translation(Vector(center))
         @ Matrix.Rotation(rot_z, 4, 'Z')
         @ Matrix.Diagonal(Vector((*size, 1.0))))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_cyl(bm, a, b, radius, segments=10):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=d.length, matrix=m)


def rotate_group(objs, deg):
    """Поворот готовых объектов вокруг оси Z на заданный угол (запекается)."""
    if abs(deg) < 1e-9:
        return objs
    R = Matrix.Rotation(math.radians(deg), 4, 'Z')
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.matrix_world = R @ o.matrix_world
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=False)
    return objs


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ---- лента ошейника ------------------------------------------------
    ring(PREFIX + 'band',
         rr_profile(BAND_R_IN, BAND_R_OUT, -BAND_HH, BAND_HH, 0.0030, 4),
         0.0, 360.0, 64, 'graphite', full=True)

    # ---- мягкая подкладка: два сектора + перемычки над/под окнами ------
    ring(PREFIX + 'liner_a',
         rr_profile(LINER_R_IN, LINER_R_OUT, -LINER_HH, LINER_HH, 0.0017, 4),
         EL_AZ[1] + EL_WIN, 360.0 + EL_AZ[0] - EL_WIN, 64, 'silicon')
    ring(PREFIX + 'liner_b',
         rr_profile(LINER_R_IN, LINER_R_OUT, -LINER_HH, LINER_HH, 0.0017, 4),
         360.0 + EL_AZ[0] + EL_WIN, 360.0 + EL_AZ[1] - EL_WIN, 12, 'silicon')
    for tag, az in zip(('l', 'r'), EL_AZ):
        for side, z0, z1 in (('top', EL_Z_HOLE, LINER_HH),
                             ('bot', -LINER_HH, -EL_Z_HOLE)):
            ring(PREFIX + f'liner_bridge_{tag}_{side}',
                 rr_profile(LINER_R_IN, LINER_R_OUT, z0, z1, 0.0009, 3),
                 az - EL_WIN, az + EL_WIN, 6, 'silicon')

    # ---- контакты: утопленные стаканы с циановыми площадками -----------
    for tag, az in zip(('l', 'r'), EL_AZ):
        d = radial(az)
        c = Vector((0, 0, 0))
        torus(PREFIX + f'electrode_rim_{tag}', c + d * LINER_R_IN,
              EL_RIM_MAJOR, 0.0010, 'silicon', axis=d, segs=32, rings=8)
        cyl(PREFIX + f'electrode_socket_{tag}', c + d * EL_FACE_R,
            c + d * LINER_R_OUT, EL_SOCKET_R, 'dark', vertices=26)
        torus(PREFIX + f'electrode_ring_{tag}', c + d * (EL_FACE_R - 0.0002),
              0.0050, 0.0006, 'steel', axis=d, segs=26, rings=8)
        cyl(PREFIX + f'electrode_contact_{tag}', c + d * (EL_FACE_R - 0.0001),
            c + d * (EL_FACE_R + 0.00035), EL_CONTACT_RADIUS, 'cyan', vertices=26)

    # ---- металлическая окантовка ленты и шов ---------------------------
    for tag, z in (('top', BAND_HH - 0.0010), ('bot', -BAND_HH + 0.0010)):
        torus(PREFIX + f'band_trim_{tag}', (0, 0, z), 0.0632, 0.0009, 'steel',
              axis=(0, 0, 1), segs=56, rings=6)
    torus(PREFIX + 'band_seam', (0, 0, 0.0), 0.0637, 0.0006, 'dark',
          axis=(0, 0, 1), segs=56, rings=6)

    # ---- страховочные заклёпки ленты (рядом с защёлкой) ----------------
    bm = bmesh.new()
    for az in (66.0, 114.0):
        c = at(az, 0.0635, 0.0106)
        bm_cyl(bm, c, c + radial(az) * 0.0012, 0.0019, 12)
    mesh_from_bm(PREFIX + 'band_rivets', bm, 'steel')

    # ---- быстросъёмная защёлка: строится на -Y, ставится на +X ---------
    buckle = []
    g0 = set(bpy.data.objects)
    buckle.append(cube(PREFIX + 'buckle_body', (0.0, BUCKLE_Y, -0.0005),
                       (0.0300, 0.0130, 0.0250), 'graphite_l', r=0.0032))
    buckle.append(cube(PREFIX + 'buckle_lip', (0.0, -0.0570, 0.0),
                       (0.0330, 0.0060, 0.0286), 'graphite', r=0.0016))
    buckle.append(cyl(PREFIX + 'buckle_hinge', (-0.0162, -0.0648, 0.0076),
                      (0.0162, -0.0648, 0.0076), 0.0024, 'steel', vertices=18))
    for tag, sx in (('l', -1.0), ('r', 1.0)):
        buckle.append(cube(PREFIX + f'buckle_tab_{tag}',
                           (sx * 0.0168, -0.0620, -0.0044),
                           (0.0066, 0.0126, 0.0126), 'steel',
                           r=0.0016, rot=(0, 0, sx * math.radians(8))))
    # три ребра на лицевой площадке + поперечный шов корпуса
    bm = bmesh.new()
    for i in range(3):
        bm_box(bm, (0.0, -0.0694, -0.0090 + i * 0.0054), (0.0170, 0.0018, 0.0020))
    mesh_from_bm(PREFIX + 'buckle_ribs', bm, 'dark', smooth=False)
    cube(PREFIX + 'buckle_seam', (0.0, -0.0693, 0.0048), (0.0260, 0.0016, 0.0014),
         'dark', r=0.0004)
    buckle.append(cube(PREFIX + 'buckle_lever', (0.0, -0.0662, 0.0152),
                       (0.0180, 0.0076, 0.0072), 'graphite_l', r=0.0012,
                       rot=(math.radians(20), 0, 0)))
    buckle = [o for o in bpy.data.objects if o not in g0]
    rotate_group(buckle, 90.0)

    # ---- регулировка: ползун + свободный хвост ремня -------------------
    adj = []
    g0 = set(bpy.data.objects)
    adj.append(cube(PREFIX + 'adjuster_plate', (0.0655, 0.0, 0.0),
                    (0.0082, 0.0220, 0.0262), 'graphite_l', r=0.0020))
    for tag, sz in (('top', 0.0149), ('bot', -0.0149)):
        adj.append(cube(PREFIX + f'adjuster_rail_{tag}', (0.0610, 0.0, sz),
                        (0.0134, 0.0200, 0.0052), 'steel', r=0.0014))
    bm = bmesh.new()
    for i in range(3):
        bm_box(bm, (0.0697, 0.0, -0.0062 + i * 0.0062), (0.0016, 0.0140, 0.0026))
    mesh_from_bm(PREFIX + 'adjuster_grip', bm, 'dark', smooth=False)
    adj.append(ring(PREFIX + 'strap_tail',
                    rr_profile(0.0632, 0.0679, -0.0118, 0.0118, 0.0016, 4),
                    58.0, 92.0, 20, 'graphite_l'))
    adj.append(ring(PREFIX + 'strap_keeper',
                    rr_profile(0.0628, 0.0696, -0.0132, 0.0132, 0.0014, 3),
                    64.0, 68.0, 6, 'steel'))
    bm = bmesh.new()
    for k in range(3):
        az = 72.0 + k * 6.0
        c = at(az, 0.0681)
        bm_cyl(bm, c, c + radial(az) * 0.0008, 0.0016, 12)
    mesh_from_bm(PREFIX + 'strap_holes', bm, 'dark')
    adj = [o for o in bpy.data.objects if o not in g0]
    rotate_group(adj, 225.0)

    # ---- модуль импеданса: строится на +Y, ставится на -Y --------------
    mod = []
    g0 = set(bpy.data.objects)
    mod.append(cube(PREFIX + 'module_shell', (0.0, MODULE_Y, 0.0),
                    (0.0340, 0.0100, 0.0360), 'graphite', r=0.0034))
    mod.append(cube(PREFIX + 'module_panel', (0.0, 0.0688, 0.0020),
                    (0.0250, 0.0020, 0.0210), 'dark', r=0.0012))
    mod.append(cyl(PREFIX + 'module_led', (0.0, 0.0689, 0.0098),
                   (0.0, 0.0702, 0.0098), 0.0026, 'cyan', vertices=20))
    mod.append(cyl(PREFIX + 'module_button', (0.0088, 0.0689, 0.0096),
                   (0.0088, 0.0698, 0.0096), 0.0020, 'steel', vertices=16))
    bm = bmesh.new()
    for i in range(3):
        bm_box(bm, (-0.0062 + i * 0.0036, 0.0700, -0.0058),
               (0.0024, 0.0010, 0.0013))
    mesh_from_bm(PREFIX + 'impedance_marks', bm, 'cyan', smooth=False)
    bm = bmesh.new()
    for z in (0.0132, -0.0132):
        bm_box(bm, (0.0, MODULE_Y + 0.0052, z), (0.0330, 0.0012, 0.0015))
    mesh_from_bm(PREFIX + 'module_seam', bm, 'dark', smooth=False)
    bm = bmesh.new()
    for sx in (-1.0, 1.0):
        for sz in (-1.0, 1.0):
            c = Vector((sx * 0.0142, MODULE_Y + 0.0048, sz * 0.0152))
            bm_cyl(bm, c, c + Vector((0, 0.0012, 0)), 0.0016, 12)
    mesh_from_bm(PREFIX + 'module_screws', bm, 'steel')
    # кабель и разъём
    mod.append(cyl(PREFIX + 'strain_relief', (0.0, 0.0638, -0.0128),
                   (0.0, 0.0674, -0.0182), 0.0044, 'graphite',
                   vertices=16, bev=0.0006))
    mod.append(curve_tube(PREFIX + 'cable',
                          [(0.0, 0.0674, -0.0182),
                           (0.0035, 0.0710, -0.0222),
                           (0.0090, 0.0706, -0.0258),
                           (0.0136, 0.0666, -0.0276)], 0.0026, 'dark'))
    # разъём — короткий штекер вдоль касательной кабеля
    p0 = Vector((0.0136, 0.0666, -0.0276))
    dd = Vector((0.0058, -0.0045, -0.0026)).normalized()
    mod.append(cyl(PREFIX + 'connector', p0, p0 + dd * 0.0130, 0.0044,
                   'graphite_l', vertices=16, bev=0.0006))
    mod.append(cyl(PREFIX + 'connector_collar', p0 + dd * 0.0026,
                   p0 + dd * 0.0048, 0.0052, 'dark', vertices=16))
    mod.append(cyl(PREFIX + 'connector_face', p0 + dd * 0.0130,
                   p0 + dd * 0.0146, 0.0032, 'silicon', vertices=16))
    mod = [o for o in bpy.data.objects if o not in g0]
    rotate_group(mod, 180.0)

    for o in bpy.data.objects:
        if o.name.startswith(PREFIX):
            o['rotating'] = False
    bpy.context.view_layer.update()


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


def radial_extent(obj):
    rmin, rmax = 1e9, -1e9
    for v in obj.data.vertices:
        p = obj.matrix_world @ v.co
        r = math.hypot(p.x, p.y)
        rmin, rmax = min(rmin, r), max(rmax, r)
    return rmin, rmax


def check():
    bpy.context.view_layer.update()
    all_obj = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in all_obj if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn

    pigtail = [o for o in meshes
               if o.name.split(PREFIX)[-1].split('_')[0]
               in ('cable', 'connector', 'strain')]
    body = [o for o in meshes if o not in pigtail]
    b_mn, b_mx = mesh_bbox(body)
    b_size = b_mx - b_mn

    contact = bpy.data.objects[PREFIX + 'electrode_contact_l']
    c_min, _ = radial_extent(contact)
    liner = bpy.data.objects[PREFIX + 'liner_a']
    l_min, _ = radial_extent(liner)
    recess = c_min - l_min

    rim_top = bpy.data.objects[PREFIX + 'electrode_rim_l']
    rim_min, _ = radial_extent(rim_top)

    return {
        'component': CID,
        'nodes': len(all_obj),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in (mn + mx) * 0.5],
        'collar_bbox_size': [round(v, 5) for v in b_size],
        'collar_bbox_ok': bool(b_size.x <= 0.146 and b_size.y <= 0.146
                               and b_size.z <= 0.042),
        'bbox_ok': bool(size.x <= 0.150 and size.y <= 0.150 and size.z <= 0.060),
        'bore_radius': round(l_min, 5),
        'bore_diameter': round(l_min * 2, 5),
        'electrode_recess_mm': round(recess * 1000, 3),
        'electrode_recessed': bool(recess >= 0.0015),
        'electrode_rim_proud_mm': round((l_min - rim_min) * 1000, 3),
        'materials': sorted(m.name for m in bpy.data.materials),
        'parts': sorted(o.name for o in all_obj),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if o.type == 'MESH' and not o.name.startswith(PREFIX)),
    }


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


def main():
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['collar_bbox_ok'] and rep['electrode_recessed']):
        raise SystemExit('checks failed')


main()
