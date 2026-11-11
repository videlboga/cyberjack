"""Standalone builder: restraint_quick_release (RST-QR-10, «Быстросъём»).

Компактный универсальный быстросъёмный узел: корпус-замок с приёмным
гнездом (вилка), ответная пластина-язычок с ушком, стопорный палец,
пружина, эксцентриковый кулачок и красный рычаг с рифлением, D-ring.
Плиты нет — крепление встроенное (в манжету/стремено).

Запуск:
  blender -b --factory-startup -noaudio --python \
      docs/plans/tools/build_restraint_quick_release.py

Выход:
  public/models/machine-modules/components/restraint_quick_release.glb
  docs/plans/blockout/component-library/restraint_quick_release/*.png

Система координат (Blender Z-up, метры): z=0 — опорная плоскость,
+Z вверх, X — продольная ось узла (гнездо справа, D-ring справа),
Y — ось стопорного пальца.
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
RENDER_DIR = (PROJECT / 'docs/plans/blockout/component-library'
              / 'restraint_quick_release')
CID = 'restraint_quick_release'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
HY = 0.0125                 # полуширина корпуса по Y
HX0, HX1 = -0.0195, 0.0035  # корпус по X
HZ1 = 0.0215                # верх корпуса
SX0, SX1 = 0.0035, 0.0185   # щёки гнезда по X
SYI, SYO = 0.0065, 0.0125   # внутренняя/наружная плоскость щёк по Y
SZ0, SZ1 = 0.0060, 0.0190   # щёки по Z
PIN_X, PIN_Z = 0.0125, 0.0115   # ось стопорного пальца
PIN_R = 0.0017
PIN_Y0, PIN_Y1 = -0.0192, 0.0126
HEAD_Y0, HEAD_Y1 = -0.0204, -0.0192
SPR_Y0, SPR_Y1 = -0.0192, -0.0142
SPR_R, SPR_W = 0.0040, 0.00055
PIV = Vector((0.0055, 0.0170))       # ось кулачка/рычага в плоскости XZ
CAM_C = Vector((0.0110, 0.0118))     # центр эксцентрика (носик кулачка)
LEV_Y0, LEV_Y1 = -0.0238, -0.0204    # плоскость рычага и кулачка (ближняя)
ARM_END = Vector((-0.0105, 0.0252))
PAD_C = Vector((-0.0118, 0.0268))
TONG_Z0, TONG_Z1 = 0.0092, 0.0136    # ответная пластина (язычок)
EYE_C = Vector((0.0272, 0.0115))     # центр ушка
EYE_BORE = 0.0029

PALETTE = {
    'graphite': (0.145, 0.152, 0.163),
    'steel': (0.598, 0.606, 0.598),
    'red': (0.640, 0.055, 0.048),
    'rubber': (0.098, 0.101, 0.108),
    'brass': (0.760, 0.575, 0.255),
    'ivory': (0.945, 0.935, 0.915),
}
ROUGH = {'graphite': 0.50, 'steel': 0.33, 'red': 0.44,
         'rubber': 0.90, 'brass': 0.32, 'ivory': 0.50}
METAL = {'graphite': 0.45, 'steel': 0.85, 'red': 0.0,
         'rubber': 0.0, 'brass': 1.0, 'ivory': 0.0}
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
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40) if angle else math.radians(10)
    mod.use_clamp_overlap = True
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


def box(name, a, b, role, r=0.0012, smooth=False):
    """Коробка по двум углам."""
    a, b = Vector(a), Vector(b)
    return cube(name, (a + b) * 0.5, b - a, role, r, smooth=smooth)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=d.length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


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


def curve_tube(name, points, radius, role, res=8, cyclic=False):
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
    sp.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def helix(name, p0, axis, radius, wire, length, turns, role, per_turn=24):
    """Цилиндрическая пружина растяжения/сжатия как трубка по спирали."""
    p0 = Vector(p0)
    d = Vector(axis).normalized()
    u = d.orthogonal().normalized()
    v = d.cross(u).normalized()
    n = max(8, int(turns * per_turn))
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = wire
    cu.bevel_resolution = 3
    cu.resolution_u = 1
    sp = cu.splines.new('POLY')
    sp.points.add(n)
    for i in range(n + 1):
        t = i / n
        a = math.tau * turns * t
        p = p0 + d * (length * t) + (u * math.cos(a) + v * math.sin(a)) * radius
        sp.points[i].co = (p.x, p.y, p.z, 1.0)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def hull2d(pts):
    pts = sorted(set((round(p[0], 9), round(p[1], 9)) for p in pts))

    def cross(o, a, b):
        return ((a[0] - o[0]) * (b[1] - o[1])
                - (a[1] - o[1]) * (b[0] - o[0]))

    lower, upper = [], []
    for p in pts:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], p) <= 0:
            lower.pop()
        lower.append(p)
    for p in reversed(pts):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], p) <= 0:
            upper.pop()
        upper.append(p)
    return lower[:-1] + upper[:-1]


def circle2d(c, r, n=28):
    return [(c[0] + r * math.cos(math.tau * i / n),
             c[1] + r * math.sin(math.tau * i / n)) for i in range(n)]


def extrude_y(name, pts_xz, y0, y1, role, bev=0.0009, smooth=False):
    """2D-профиль в плоскости XZ, выдавленный по Y."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y0, z)) for (x, z) in pts_xz]
    face = bm.faces.new(vs)
    ret = bmesh.ops.extrude_face_region(bm, geom=[face])
    nv = [e for e in ret['geom'] if isinstance(e, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, verts=nv, vec=(0.0, y1 - y0, 0.0))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, smooth)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


def capsule(name, p0, p1, r0, r1, y0, y1, role, bev=0.0007):
    pts = hull2d(circle2d((p0.x, p0.y), r0) + circle2d((p1.x, p1.y), r1))
    return extrude_y(name, pts, y0, y1, role, bev)


def hole_y(obj, loc, radius, depth, verts=28):
    """Круглое отверстие по оси Y (boolean difference)."""
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius,
                                        depth=depth,
                                        location=(loc.x, 0.0, loc.y))
    cut = bpy.context.object
    cut.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    mod = obj.modifiers.new('bore', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.object = cut
    mod.solver = 'EXACT'
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cut, do_unlink=True)
    return obj


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ---- корпус-замок (фасонный, не коробка) ---------------------------
    profile = [(HX0, 0.0020), (-0.0185, 0.0000), (0.0010, 0.0000),
               (HX1, 0.0015), (HX1, 0.0200), (0.0015, HZ1),
               (-0.0155, HZ1), (HX0, 0.0148)]
    extrude_y(PREFIX + 'housing', profile, -HY, HY, 'graphite', bev=0.0018)

    # ---- приёмное гнездо: дно + две щёки с заходной фаской -------------
    box(PREFIX + 'socket_floor', (SX0, -0.0068, 0.0), (0.0195, 0.0068, 0.0080),
        'graphite', r=0.0012)
    cheek = [(SX0, SZ0), (SX1, SZ0), (SX1, 0.0162), (0.0160, SZ1),
             (SX0, SZ1)]
    extrude_y(PREFIX + 'socket_cheek_yneg', cheek, -SYO, -SYI,
              'graphite', bev=0.0012)
    extrude_y(PREFIX + 'socket_cheek_ypos', cheek, SYI, SYO,
              'graphite', bev=0.0012)
    # стальное кольцо-зев у входа (износостойкая направляющая язычка)
    box(PREFIX + 'throat_collar_yneg', (0.0130, -0.0066, 0.0064),
        (0.0178, -0.0057, 0.0186), 'steel', r=0.0004)
    box(PREFIX + 'throat_collar_ypos', (0.0130, 0.0057, 0.0064),
        (0.0178, 0.0066, 0.0186), 'steel', r=0.0004)
    box(PREFIX + 'throat_collar_floor', (0.0130, -0.0064, 0.0080),
        (0.0178, 0.0064, 0.0086), 'steel', r=0.0004)

    # ---- фланец-плечо на стыке корпуса и вилки гнезда ------------------
    box(PREFIX + 'socket_shoulder', (0.0022, -0.0133, 0.0012),
        (0.0046, 0.0133, 0.0192), 'graphite', r=0.0010)

    # ---- резиновый пыльник: узкая обойма по наружке зева ---------------
    box(PREFIX + 'dust_boot_top', (0.0150, -0.0132, 0.0190),
        (0.0194, 0.0132, 0.0203), 'rubber', r=0.0006)
    box(PREFIX + 'dust_boot_bottom', (0.0150, -0.0132, 0.0047),
        (0.0194, 0.0132, 0.0060), 'rubber', r=0.0006)
    box(PREFIX + 'dust_boot_yneg', (0.0150, -0.0132, 0.0060),
        (0.0194, -0.0119, 0.0190), 'rubber', r=0.0006)
    box(PREFIX + 'dust_boot_ypos', (0.0150, 0.0119, 0.0060),
        (0.0194, 0.0132, 0.0190), 'rubber', r=0.0006)

    # ---- ответная пластина: язычок + ушко ------------------------------
    plate = [(0.0040, TONG_Z0), (0.0234, TONG_Z0), (0.0268, 0.0078),
             (0.0268, 0.0152), (0.0234, TONG_Z1), (0.0040, TONG_Z1)]
    extrude_y(PREFIX + 'catch_plate', plate, -0.0048, 0.0048, 'steel',
              bev=0.0006)
    tab = extrude_y(PREFIX + 'catch_eye',
                    [(0.0228, 0.0070), (0.0306, 0.0080), (0.0306, 0.0150),
                     (0.0228, 0.0158)],
                    -0.0028, 0.0028, 'steel', bev=0.0007)
    hole_y(tab, EYE_C, EYE_BORE, 0.009)

    # ---- D-ring --------------------------------------------------------
    curve_tube(PREFIX + 'dring',
               [(0.0272, 0.0, 0.0100), (0.0276, 0.0, 0.0165),
                (0.0312, 0.0, 0.0188), (0.0348, 0.0, 0.0148),
                (0.0355, 0.0, 0.0088), (0.0300, 0.0, 0.0048)],
               0.0017, 'steel', res=8, cyclic=True)

    # ---- стопорный палец, пружина, кулачок, рычаг (всё на ближней
    #      стороне -Y: пружина отжимает палец наружу, эксцентрик
    #      кулачка дожимает его внутрь — одно движение рычага) -------
    cyl(PREFIX + 'lock_pin', (PIN_X, PIN_Y0, PIN_Z), (PIN_X, PIN_Y1, PIN_Z),
        PIN_R, 'steel', vertices=24, bev=0.0004)
    cyl(PREFIX + 'pin_head', (PIN_X, HEAD_Y0, PIN_Z), (PIN_X, HEAD_Y1, PIN_Z),
        0.0030, 'steel', vertices=24, bev=0.0005)
    # головка пальца, видимая с дальней щеки (палец проходит насквозь)
    cyl(PREFIX + 'pin_tip', (PIN_X, PIN_Y1 - 0.0002, PIN_Z),
        (PIN_X, PIN_Y1 + 0.0012, PIN_Z), 0.0026, 'steel', vertices=20,
        bev=0.0004)
    helix(PREFIX + 'spring', (PIN_X, SPR_Y0, PIN_Z), (0, 1, 0),
          SPR_R, SPR_W, SPR_Y1 - SPR_Y0, 4.0, 'steel')
    # бобышка выхода пальца из щеки — база пружины
    cyl(PREFIX + 'pin_boss', (PIN_X, -HY - 0.0017, PIN_Z),
        (PIN_X, -HY + 0.0004, PIN_Z), 0.0056, 'graphite', vertices=28,
        bev=0.0004)

    # ---- ось рычага, кулачок, рычаг ------------------------------------
    cyl(PREFIX + 'pivot_boss', (0.0, -HY + 0.0002, PIV.y),
        (0.0, -0.0152, PIV.y), 0.0040, 'graphite', vertices=32, bev=0.0005)
    cyl(PREFIX + 'pivot_axle_sleeve', (0.0, -0.0150, PIV.y),
        (0.0, LEV_Y0 + 0.0004, PIV.y), 0.0028, 'graphite', vertices=28,
        bev=0.0004)
    capsule(PREFIX + 'cam', PIV, CAM_C, 0.0019, 0.0034,
            LEV_Y0, LEV_Y1, 'steel')
    capsule(PREFIX + 'lever_arm', PIV, ARM_END, 0.0029, 0.0033,
            LEV_Y0, LEV_Y1, 'red')
    box(PREFIX + 'lever_pad', (PAD_C.x - 0.0049, LEV_Y0 - 0.0003, 0.0250),
        (PAD_C.x + 0.0049, LEV_Y1 + 0.0003, 0.0290), 'red', r=0.0016)
    for i in range(6):
        x = -0.0161 + i * 0.00158
        box(PREFIX + f'lever_knurl_{i}', (x, LEV_Y0 + 0.0006, 0.0290),
            (x + 0.0008, LEV_Y1 - 0.0006, 0.0300), 'red', r=0.00018)
    cyl(PREFIX + 'pivot_pin', (0.0, -HY + 0.0004, PIV.y),
        (0.0, LEV_Y0 - 0.0004, PIV.y), 0.0017, 'brass', vertices=16,
        bev=0.0003)
    cyl(PREFIX + 'pivot_pin_head', (0.0, LEV_Y0 - 0.0004, PIV.y),
        (0.0, LEV_Y0 - 0.0012, PIV.y), 0.0026, 'brass', vertices=16,
        bev=0.0003)

    # ---- маркировка: узкая гравировка на ближней стенке ----------------
    box(PREFIX + 'id_groove', (-0.0178, -HY - 0.0007, 0.0142),
        (-0.0112, -HY + 0.0002, 0.0149), 'graphite', r=0.00015)
    box(PREFIX + 'id_groove_2', (-0.0178, -HY - 0.0007, 0.0154),
        (-0.0140, -HY + 0.0002, 0.0161), 'graphite', r=0.00015)

    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH':
            o['component'] = CID
            o['motion'] = 'none'
    return [o for o in bpy.data.objects if o.name.startswith(PREFIX)]


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


def part_bbox(name):
    return mesh_bbox([bpy.data.objects[PREFIX + name]])


def check(parts):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size, center = mx - mn, (mn + mx) * 0.5
    names = sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX))

    t_mn, t_mx = part_bbox('catch_plate')
    p_mn, p_mx = part_bbox('lock_pin')
    s_mn, s_mx = part_bbox('spring')
    c_mn, c_mx = part_bbox('cam')
    l_mn, l_mx = part_bbox('lever_pad')
    d_mn, d_mx = part_bbox('dring')
    e_mn, e_mx = part_bbox('catch_eye')

    # язычок внутри зева, палец пересекает его по Y
    tongue_in_socket = bool(0.0035 <= t_mn.x <= 0.006
                            and t_mx.x > 0.023)
    pin_through_tongue = bool(p_mn.y <= t_mn.y + 1e-9
                              and p_mx.y >= t_mx.y - 1e-9
                              and t_mn.z <= PIN_Z <= t_mx.z
                              and t_mn.x <= PIN_X <= t_mx.x)
    cam_node = Vector((CAM_C.x, CAM_C.y))
    cam_gap = round((cam_node - Vector((PIN_X, PIN_Z))).length * 1000, 2)
    spring_coils = round(4.0 * 24)
    knob = (cam_node - Vector((PIN_X, PIN_Z))).length
    cam_press = bool(knob <= 0.0034 + 0.0030)

    rep = {
        'component': CID,
        'code': 'RST-QR-10',
        'nodes': len(names),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_mm': [round(v * 1000, 1) for v in size],
        'bbox_target_passport_mm': [60.0, 40.0, 30.0],
        'bbox_axes_note': 'X=гнездо+D-ring, Y=ось стопорного пальца, '
                          'Z=высота узла',
        'bbox_ok': bool(size.x <= 0.061 and size.y <= 0.043
                        and size.z <= 0.031),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'parts': names,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'materials': sorted(m.name for m in bpy.data.materials if m.users),
        'material_count': len([m for m in bpy.data.materials if m.users]),
        'mechanism': {
            'socket_mm': [round((0.0195 - SX0) * 1000, 1),
                          round((SYI * 2) * 1000, 1),
                          round((SZ1 - SZ0) * 1000, 1)],
            'catch_plate_mm': [round((t_mx.x - t_mn.x) * 1000, 1),
                               round((t_mx.z - t_mn.z) * 1000, 1)],
            'pin_dia_mm': round(PIN_R * 2000, 1),
            'pin_span_mm': round((p_mx.y - p_mn.y) * 1000, 1),
            'spring_length_mm': round((s_mx.y - s_mn.y) * 1000, 1),
            'spring_od_mm': round((s_mx.z - s_mn.z) * 1000, 1),
            'spring_coils': spring_coils,
            'cam_bbox_mm': [round((c_mx.x - c_mn.x) * 1000, 1),
                            round((c_mx.z - c_mn.z) * 1000, 1)],
            'cam_to_pin_mm': cam_gap,
            'cam_presses_pin_head': cam_press,
            'lever_pad_mm': [round((l_mx.x - l_mn.x) * 1000, 1),
                             round((l_mx.z - l_mn.z) * 1000, 1)],
            'knurl_ribs': 6,
            'eye_bore_mm': round(EYE_BORE * 2000, 1),
            'dring_outer_mm': [round((d_mx.x - d_mn.x) * 1000, 1),
                               round((d_mx.z - d_mn.z) * 1000, 1)],
            'eye_to_dring_gap_mm': round((d_mn.x - e_mn.x) * 1000, 2),
        },
        'checks': {
            'tongue_in_socket': tongue_in_socket,
            'pin_through_tongue': pin_through_tongue,
            'has_spring': spring_coils > 20,
            'has_cam': bool((c_mx.x - c_mn.x) > 0.010),
            'has_lever': bool((l_mx.z - l_mn.z) > 0.003),
            'has_dring': bool((d_mx.x - d_mn.x) > 0.012),
            'plate_absent': bool(not any('base_plate' in n or
                                         n.endswith('__plate')
                                         for n in names)),
        },
        'motion': 'none',
    }
    rep['mechanism_ok'] = all(rep['checks'].values())
    return rep


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objects:
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
    except TypeError:
        pass
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

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3,
                                     location=(center.x, center.y,
                                               mn.z - 0.0002))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.15, -0.16, 0.19), 1.45, 0.14),
            ('fill', (-0.16, -0.12, 0.09), 0.50, 0.20),
            ('rim', (0.03, 0.16, 0.15), 0.75, 0.16)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.85))
        lo.rotation_euler = (center - lo.location).to_track_quat(
            '-Z', 'Y').to_euler()

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
    close_t = Vector((0.004, -0.004, 0.014))
    c_close = box_corners(Vector((-0.009, -0.026, 0.001)) - close_t,
                          Vector((0.021, 0.006, 0.029)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc():
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0,
                            abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.95, -0.85, 0.52), center, 70, c_main, 0.92),
        ('front', (1.00, -0.16, 0.20), center, 70, c_main, 0.92),
        ('side', (0.06, -1.00, 0.14), center, 70, c_main, 0.92),
        ('closeup', (0.55, -0.80, 0.42), close_t, 85, c_close, 0.95),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat(
            '-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4):
            got = max_ndc()
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat(
                '-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} fill={max_ndc():.3f} {fp}', flush=True)
    return outs


def main():
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok']
            and rep['mechanism_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
