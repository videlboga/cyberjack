"""Standalone builder + renderer: work_impact_paddle (WRK-IMP-01, «Лопатка»).

Сменная лопатка на упругом подвесе: широкая плоская силиконовая пластина со
скруглёнными краями и мягкой рабочей поверхностью, графитовая тыльная сторона,
янтарная метка силы, быстросъёмный зажим на упругом рычаге (рессора-лист).
Статичное основание/док с малым качающим приводом (кулачок + толкатель),
торсионная пружина, ограничитель хода с резиновым бампером, LED, кабель.

Движение — КАЧАНИЕ (swing) вокруг поперечной оси шарнира, не вращение.
anim-пустышка стоит В ШАРНИРЕ, не в центре лопатки.

Не зависит от build_component_library.py и от других build_* скриптов.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_impact_paddle.py

Выход:
  public/models/machine-modules/components/work_impact_paddle.glb
  docs/plans/blockout/component-library/work_impact_paddle/*.png

Геометрия (Blender Z-up, метры):
  длинная ось     = X (лопатка вперёд, +X)
  ось шарнира     = Y (поперечная), точка pivot = (-0.035, 0, 0.042)
  anim-пустышка   = (-0.035, 0, 0.042) — в ОСИ шарнира
  качаются (дети): hinge_boss, arm, arm_leaf, arm_clamp, qr_lever, qr_tab,
                   paddle_back, paddle_pad, paddle_tip_guard, pad_ribs,
                   force_marks
  статичны: dock, dock_lid, mount_flange, bolt_a, bolt_b, yoke_left,
            yoke_right, hinge_pin, spring_coil, spring_leg, drive_foot,
            drive_tower, stop_tongue, stop_bumper, cam_shaft, cam_disc,
            cam_lobe, cam_mark, pushrod, led, led_bezel, strain_relief,
            cable, connector
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
SHOTS = PROJECT / 'docs/plans/blockout/component-library/work_impact_paddle'
CID = 'work_impact_paddle'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
HINGE = Vector((-0.035, 0.0, 0.042))       # ось шарнира по Y
Z_ARM = 0.042                            # нейтраль упругого рычага
DOCK_X0, DOCK_X1 = -0.080, -0.010
DOCK_HY = 0.020
DOCK_Z0, DOCK_Z1 = 0.004, 0.031

PAD_X0, PAD_X1 = 0.014, 0.166             # силиконовая пластина
PAD_HY = 0.060                           # ширина 0.120
PAD_Z0, PAD_Z1 = 0.030, 0.042
BACK_X0, BACK_X1 = 0.024, 0.166          # графитовая тыльная сторона
BACK_HY = 0.058
BACK_Z0, BACK_Z1 = 0.042, 0.050
TIP_X0, TIP_X1 = 0.160, 0.172            # мягкий торец
PAD_R = 0.020                            # радиус скругления углов

PALETTE = {
    'graphite': (0.255, 0.264, 0.276),
    'steel': (0.660, 0.668, 0.660),
    'pale': (0.949, 0.843, 0.851),        # силикон
    'blush': (0.910, 0.725, 0.749),
    'amber': (0.960, 0.620, 0.130),       # метка силы
    'cyan': (0.750, 0.900, 0.920),        # LED
    'dark': (0.204, 0.212, 0.231),        # резина бампера
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
    rough = {'steel': 0.42, 'graphite': 0.55, 'pale': 0.88,
             'dark': 0.92, 'amber': 0.45}.get(role, 0.62)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = 0.30 if role in ('steel', 'graphite') else 0.0
    if role in ('cyan', 'amber'):
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.45 if role == 'cyan' else 0.30
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
    obj.select_set(True)
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
        select_only(obj)
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


def curve_tube(name, points, radius, role, res=8, spline='BEZIER'):
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


def helix(name, center, y0, y1, radius, turns, tube_r, role, samples=52):
    pts = []
    for i in range(samples + 1):
        f = i / samples
        a = math.tau * turns * f
        pts.append((center[0] + radius * math.cos(a),
                    y0 + (y1 - y0) * f,
                    center[2] + radius * math.sin(a)))
    return curve_tube(name, pts, tube_r, role, res=3, spline='POLY')


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def mesh_from_bm(name, bm, role, smooth=False):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def rounded_rect_pts(x0, x1, y0, y1, r, seg=8):
    """CCW-обвод скруглённого прямоугольника (радиус r по углам)."""
    r = min(r, (x1 - x0) * 0.49, (y1 - y0) * 0.49)
    cx0, cx1, cy0, cy1 = x0 + r, x1 - r, y0 + r, y1 - r
    pts = []
    for cx, cy, a0, a1 in ((cx0, cy0, 180, 270), (cx1, cy0, 270, 360),
                           (cx1, cy1, 0, 90), (cx0, cy1, 90, 180)):
        for i in range(seg + 1):
            a = math.radians(a0 + (a1 - a0) * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def rounded_slab(name, cx, cy, cz, sx, sy, sz, r, role, seg=6,
                 bev=0.0015, bev_seg=1, smooth=False):
    """Плита со скруглёнными в плане углами (r) и опциональным мягким ребром."""
    x0, x1 = cx - sx * 0.5, cx + sx * 0.5
    y0, y1 = cy - sy * 0.5, cy + sy * 0.5
    z0, z1 = cz - sz * 0.5, cz + sz * 0.5
    pts = rounded_rect_pts(x0, x1, y0, y1, r, seg)
    bm = bmesh.new()
    lo = [bm.verts.new((x, y, z0)) for x, y in pts]
    hi = [bm.verts.new((x, y, z1)) for x, y in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm.faces.new(tuple(reversed(lo)))
    bm.faces.new(hi)
    obj = mesh_from_bm(name, bm, role, smooth)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, bev_seg)
    return obj


def loft(name, sections, role, bev=0.0011, smooth=False):
    """Лофт по сечениям: (x, half_w, z_center, half_t)."""
    bm = bmesh.new()
    rings = []
    for x, hw, zc, ht in sections:
        rings.append([bm.verts.new((x, -hw, zc - ht)),
                      bm.verts.new((x, hw, zc - ht)),
                      bm.verts.new((x, hw, zc + ht)),
                      bm.verts.new((x, -hw, zc + ht))])
    for a, b in zip(rings, rings[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[-1])
    obj = mesh_from_bm(name, bm, role, smooth)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, 2)
    return obj


# --- сборка --------------------------------------------------------------
def build():
    reset()
    kids = []

    # ================= СТАТИЧНОЕ ОСНОВАНИЕ / ДОК =========================
    rounded_slab(PREFIX + 'dock', -0.045, 0.0, 0.5 * (DOCK_Z0 + DOCK_Z1),
                 DOCK_X1 - DOCK_X0, 2 * DOCK_HY, DOCK_Z1 - DOCK_Z0,
                 0.006, 'graphite', bev=0.0030, bev_seg=2)
    # задняя крышка-люк дока (не подходит под шарнирную бобышку)
    rounded_slab(PREFIX + 'dock_lid', -0.064, 0.0, 0.0332,
                 0.030, 0.034, 0.0044, 0.005, 'steel', bev=0.0012)
    # монтажный фланец + болты (крепление к руке машины)
    rounded_slab(PREFIX + 'mount_flange', -0.0835, 0.0, 0.0185,
                 0.007, 0.074, 0.029, 0.004, 'graphite', bev=0.0014)
    for tag, sy in (('a', 0.028), ('b', -0.028)):
        cyl(PREFIX + f'bolt_{tag}', (-0.0895, sy, 0.018), (-0.0795, sy, 0.018),
            0.0042, 'graphite', vertices=14, bev=0.0008)

    # ---- вилка шарнира ------------------------------------------------
    for tag, y0, y1 in (('left', -0.030, -0.020), ('right', 0.020, 0.030)):
        rounded_slab(PREFIX + f'yoke_{tag}', -0.034, 0.5 * (y0 + y1),
                     0.041, 0.028, y1 - y0, 0.030, 0.004, 'steel', bev=0.0012)
    # ось шарнира (статична, торчит из щёк)
    cyl(PREFIX + 'hinge_pin', (HINGE.x, -0.0345, HINGE.z),
        (HINGE.x, 0.0345, HINGE.z), 0.0032, 'steel', vertices=20, bev=0.0006)
    for tag, sy in (('a', -0.0345), ('b', 0.0345)):
        cyl(PREFIX + f'pin_head_{tag}', (HINGE.x, sy - 0.0018 * (1 if sy > 0 else -1), HINGE.z),
            (HINGE.x, sy + 0.0018 * (1 if sy > 0 else -1), HINGE.z),
            0.0050, 'graphite', vertices=6)

    # ---- торсионная пружина (упругий элемент подвеса) ------------------
    helix(PREFIX + 'spring_coil', (HINGE.x, 0.0, HINGE.z), 0.0205, 0.0300,
          0.0092, 3.0, 0.0015, 'blush')
    cyl(PREFIX + 'spring_leg', (HINGE.x - 0.0092, 0.030, HINGE.z - 0.004),
        (HINGE.x - 0.0092, 0.030, DOCK_Z1 + 0.004), 0.0015, 'blush', vertices=10)
    cyl(PREFIX + 'spring_leg_rear', (HINGE.x + 0.0092, -0.030, HINGE.z - 0.004),
        (HINGE.x + 0.0092, -0.030, DOCK_Z1 + 0.004), 0.0015, 'blush', vertices=10)

    # ---- малый качающий привод: кулачок + толкатель (справа) ----------
    rounded_slab(PREFIX + 'drive_foot', -0.073, 0.030, 0.012,
                 0.014, 0.024, 0.016, 0.004, 'graphite', bev=0.0014)
    rounded_slab(PREFIX + 'drive_tower', -0.076, 0.037, 0.032,
                 0.008, 0.010, 0.040, 0.003, 'steel', bev=0.0010)
    cyl(PREFIX + 'cam_shaft', (-0.060, 0.017, 0.0235), (-0.060, 0.040, 0.0235),
        0.0036, 'steel', vertices=16)
    cyl(PREFIX + 'cam_disc', (-0.060, 0.0295, 0.0235), (-0.060, 0.0385, 0.0235),
        0.0108, 'blush', vertices=36, bev=0.0010)
    # кулачковый лепесток вверх — давит на пятку рычага
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24,
                          radius1=0.0104, radius2=0.0104, depth=0.009,
                          matrix=Matrix.Translation(Vector((-0.060, 0.034, 0.0235)))
                          @ Vector((0, 1, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16,
                          radius1=0.0048, radius2=0.0040, depth=0.009,
                          matrix=Matrix.Translation(Vector((-0.060, 0.034, 0.0295))))
    mesh_from_bm(PREFIX + 'cam_lobe', bm, 'blush', True)
    cyl(PREFIX + 'cam_mark', (-0.0645, 0.0387, 0.0235), (-0.0645, 0.0393, 0.0235),
        0.0021, 'amber', vertices=10)
    cyl(PREFIX + 'pushrod', (-0.060, 0.034, 0.0315), (-0.060, 0.034, 0.0368),
        0.0018, 'steel', vertices=10)
    sphere(PREFIX + 'pushrod_head', (-0.060, 0.034, 0.0372), 0.0028, 'dark',
           segs=14, rings=8)

    # ---- ограничитель хода (рычаг бьёт по бамперу вверх) ---------------
    rounded_slab(PREFIX + 'stop_tongue', -0.066, 0.026, 0.0525,
                 0.026, 0.028, 0.005, 0.003, 'steel', bev=0.0010)
    rounded_slab(PREFIX + 'stop_bumper', -0.0555, 0.026, 0.0488,
                 0.020, 0.022, 0.0034, 0.006, 'dark', bev=0.0010, bev_seg=1)
    cyl(PREFIX + 'stop_screw', (-0.0585, 0.026, 0.0535), (-0.0585, 0.026, 0.0572),
        0.0024, 'graphite', vertices=12)

    # ---- LED + кабель --------------------------------------------------
    cyl(PREFIX + 'led_bezel', (-0.070, -0.0175, 0.020), (-0.070, -0.0222, 0.020),
        0.0046, 'dark', vertices=24, bev=0.0008)
    sphere(PREFIX + 'led', (-0.070, -0.0224, 0.020), 0.0030, 'cyan', segs=16, rings=10)

    cyl(PREFIX + 'strain_relief', (-0.0865, 0.008, 0.0125),
        (-0.0935, 0.008, 0.0120), 0.0058, 'graphite', vertices=18, bev=0.0012)
    curve_tube(PREFIX + 'cable',
                [(-0.0930, 0.008, 0.0120),
                 (-0.0985, 0.0125, 0.0072),
                 (-0.1015, 0.0190, 0.0050),
                 (-0.1005, 0.0250, 0.0046)], 0.0030, 'graphite')
    cube(PREFIX + 'connector', (-0.1010, 0.0262, 0.0046),
         (0.0100, 0.0084, 0.0072), 'graphite', r=0.0018)

    # ================= КАЧАЮЩАЯСЯ ЧАСТЬ ==================================
    # шарнирная бобышка — стоит ровно на оси
    cyl(PREFIX + 'hinge_boss', (HINGE.x, -0.0205, HINGE.z),
        (HINGE.x, 0.0205, HINGE.z), 0.0088, 'graphite', vertices=32, bev=0.0016)
    kids.append(bpy.data.objects[PREFIX + 'hinge_boss'])

    # упругий рычаг-рессора: назад торчит пятка (её толкает кулачок и
    # ловит бампер ограничителя), вперёд — тонкий лист под зажим
    arm = loft(PREFIX + 'arm', [
        (-0.0620, 0.0300, Z_ARM, 0.0050),
        (-0.0500, 0.0330, Z_ARM, 0.0050),
        (-0.0480, 0.0160, Z_ARM + 0.0004, 0.0048),
        (-0.0360, 0.0152, Z_ARM + 0.0024, 0.0050),
        (-0.0200, 0.0180, Z_ARM + 0.0044, 0.0042),
        (0.0000, 0.0224, Z_ARM + 0.0036, 0.0036),
        (0.0140, 0.0264, Z_ARM + 0.0012, 0.0032),
    ], 'steel')
    kids.append(arm)
    # второй лист рессоры (виден как пакет)
    leaf = loft(PREFIX + 'arm_leaf', [
        (-0.0520, 0.0138, Z_ARM - 0.0064, 0.0017),
        (-0.0300, 0.0150, Z_ARM - 0.0046, 0.0017),
        (-0.0120, 0.0170, Z_ARM - 0.0012, 0.0017),
    ], 'graphite')
    kids.append(leaf)

    # быстросъёмный зажим лопатки на рычаге
    rounded_slab(PREFIX + 'arm_clamp', 0.014, 0.0, 0.0405,
                 0.024, 0.064, 0.023, 0.007, 'graphite', bev=0.0018)
    kids.append(bpy.data.objects[PREFIX + 'arm_clamp'])
    cyl(PREFIX + 'qr_lever', (0.010, 0.026, 0.0455), (0.010, 0.0475, 0.0432),
        0.0019, 'steel', vertices=12)
    kids.append(bpy.data.objects[PREFIX + 'qr_lever'])
    cube(PREFIX + 'qr_tab', (0.010, 0.0505, 0.0428), (0.0080, 0.0072, 0.0044),
         'blush', r=0.0016)
    kids.append(bpy.data.objects[PREFIX + 'qr_tab'])

    # графитовая тыльная сторона
    rounded_slab(PREFIX + 'paddle_back', 0.5 * (BACK_X0 + BACK_X1), 0.0,
                 0.5 * (BACK_Z0 + BACK_Z1), BACK_X1 - BACK_X0, 2 * BACK_HY,
                 BACK_Z1 - BACK_Z0, 0.018, 'graphite', bev=0.0018, bev_seg=2)
    kids.append(bpy.data.objects[PREFIX + 'paddle_back'])
    # мягкая силиконовая рабочая пластина
    rounded_slab(PREFIX + 'paddle_pad', 0.5 * (PAD_X0 + PAD_X1), 0.0,
                 0.5 * (PAD_Z0 + PAD_Z1), PAD_X1 - PAD_X0, 2 * PAD_HY,
                 PAD_Z1 - PAD_Z0, PAD_R, 'pale', seg=10, bev=0.0050, bev_seg=2)
    kids.append(bpy.data.objects[PREFIX + 'paddle_pad'])
    # мягкий торец — силикон заходит за графит
    rounded_slab(PREFIX + 'paddle_tip_guard', 0.5 * (TIP_X0 + TIP_X1), 0.0,
                 0.0363, TIP_X1 - TIP_X0, 0.1215, 0.0138, 0.0065,
                 'pale', seg=6, bev=0.0035, bev_seg=2)
    kids.append(bpy.data.objects[PREFIX + 'paddle_tip_guard'])
    # рёбра на рабочей (нижней) поверхности
    bm = bmesh.new()
    for x in (0.045, 0.080, 0.115, 0.150):
        bmesh.ops.create_cube(bm, size=1.0,
                              matrix=Matrix.Translation(Vector((x, 0.0, 0.0284)))
                              @ Matrix.Diagonal(Vector((0.0080, 0.100, 0.0044, 1.0))))
    ribs = mesh_from_bm(PREFIX + 'pad_ribs', bm, 'blush', False)
    select_only(ribs)
    bevel(ribs, 0.0014, 2)
    kids.append(ribs)

    # янтарная метка силы на графитовой тыльной стороне
    bm = bmesh.new()
    for x, hy in ((0.052, 0.0060), (0.065, 0.0092), (0.078, 0.0126)):
        bmesh.ops.create_cube(bm, size=1.0,
                              matrix=Matrix.Translation(Vector((x, 0.0, 0.0508)))
                              @ Matrix.Diagonal(Vector((0.0046, 2 * hy, 0.0022, 1.0))))
    marks = mesh_from_bm(PREFIX + 'force_marks', bm, 'amber', False)
    select_only(marks)
    bevel(marks, 0.0007, 2)
    kids.append(marks)

    # ================= АНИМАЦИОННАЯ ПУСТЫШКА =============================
    anim = empty(PREFIX + 'anim', HINGE)
    anim['motion'] = 'swing'
    anim['axis_blender'] = 'Y'
    anim['axis_three'] = 'z'
    anim['amount_deg'] = 35.0
    anim['speed_hz'] = 1.5
    bpy.context.view_layer.update()
    for o in kids:
        parent(o, anim)
        o['swinging'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in kids:
            o['swinging'] = False

    bpy.context.view_layer.update()
    return anim, kids


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


def world_verts(o):
    mw = o.matrix_world
    return [mw @ v.co for v in o.data.vertices]


def tri_count(objects):
    total = 0
    for o in objects:
        if o.type != 'MESH':
            continue
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    return total


def check(anim, kids):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    statics = [o for o in all_mesh if o not in kids]
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    pad = bpy.data.objects[PREFIX + 'paddle_pad']
    p_mn, p_mx = mesh_bbox([pad])
    pad_c = (p_mn + p_mx) * 0.5

    pivot = anim.matrix_world.translation.copy()
    pin = bpy.data.objects[PREFIX + 'hinge_pin']
    i_mn, i_mx = mesh_bbox([pin])
    pin_c = (i_mn + i_mx) * 0.5

    # качающаяся часть должна сидеть НА оси шарнира (а не висеть в стороне)
    min_d = 1e9
    for o in kids:
        for p in world_verts(o):
            min_d = min(min_d, (p - pivot).length)
    min_axis = 1e9
    for o in kids:
        for p in world_verts(o):
            min_axis = min(min_axis, math.hypot(p.x - pivot.x, p.z - pivot.z))

    # ---- тест качания: 30° вокруг поперечной оси Y ----------------------
    anim.rotation_mode = 'XYZ'
    base0 = {o.name: mesh_bbox([o]) for o in statics}
    k_mn, k_mx = mesh_bbox(kids)
    c0 = (k_mn + k_mx) * 0.5
    tip_i = max(range(len(pad.data.vertices)),
                key=lambda i: (pad.matrix_world @ pad.data.vertices[i].co).x)
    tip0 = pad.matrix_world @ pad.data.vertices[tip_i].co

    anim.rotation_euler = (0.0, math.radians(30.0), 0.0)
    bpy.context.view_layer.update()
    k_mn2, k_mx2 = mesh_bbox(kids)
    c1 = (k_mn2 + k_mx2) * 0.5
    tip1 = pad.matrix_world @ pad.data.vertices[tip_i].co
    swing_shift = (c1 - c0).length
    tip_disp = (tip1 - tip0).length
    tip_drop = tip0.z - tip1.z
    base_shift = max((mesh_bbox([o])[0] - base0[o.name][0]).length
                     + (mesh_bbox([o])[1] - base0[o.name][1]).length
                     for o in statics)

    # для сравнения — «спин» вокруг продольной оси X дал бы почти нулевой сдвиг
    anim.rotation_euler = (math.radians(30.0), 0.0, 0.0)
    bpy.context.view_layer.update()
    s_mn, s_mx = mesh_bbox(kids)
    spin_shift = ((s_mn + s_mx) * 0.5 - c0).length

    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    report = {
        'component': CID,
        'code': 'WRK-IMP-01',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_objects': len(all_mesh),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_limit': '0.30 x 0.16 x 0.08',
        'bbox_ok': bool(size.x <= 0.30 and size.y <= 0.16 and size.z <= 0.08),
        'tris': tri_count(all_mesh),
        'paddle_size': [round(v, 5) for v in (p_mx - p_mn)],
        'paddle_center': [round(v, 5) for v in pad_c],
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'pivot_to_pin_mm': round((pin_c - pivot).length * 1000, 4),
        'pivot_to_paddle_center_mm': round((pad_c - pivot).length * 1000, 1),
        'pivot_is_hinge': bool((pin_c - pivot).length < 0.001
                               and (pad_c - pivot).length > 0.08),
        'anim_children': sorted(o.name for o in kids),
        'child_min_dist_to_pivot_mm': round(min_d * 1000, 2),
        'child_min_dist_to_axis_mm': round(min_axis * 1000, 2),
        'base_ok': bool(min_axis < 0.012),
        'static_nodes': sorted(o.name for o in statics),
        'static_shift_mm_after_30deg': round(base_shift * 1000, 4),
        'swing_center_shift_mm_30deg': round(swing_shift * 1000, 2),
        'spin_center_shift_mm_30deg': round(spin_shift * 1000, 2),
        'tip_disp_mm_30deg': round(tip_disp * 1000, 2),
        'tip_drop_mm_30deg': round(tip_drop * 1000, 2),
        'swing_ok': bool(0.02 < swing_shift < 0.15 and swing_shift > 10 * spin_shift
                         and tip_disp > 0.04 and base_shift < 1e-6),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion_recommended': {
            'type': 'swing',
            'axis': 'z',                 # three.js: поперечная ось (Blender Y)
            'amount': round(math.radians(35.0), 3),
            'amount_deg': 35.0,
            'speed': round(math.tau * 1.5, 3),
            'speed_hz': 1.5,
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
def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = -0.30
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.700, 0.700, 0.710, 1)
    bg.inputs['Strength'].default_value = 0.60

    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, -0.0012))
    floor = bpy.context.object
    floor.name = 'render_floor'
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.70, 0.70, 0.71, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.1, 1.4), 1.25),
        ('fill', (-1.2, -0.9, 0.6), 0.45),
        ('rim', (0.2, 1.1, 0.9), 0.95),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(18)
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


def render(rep, anim):
    SHOTS.mkdir(parents=True, exist_ok=True)
    for old in SHOTS.glob('*.png'):
        old.unlink()
    setup_render()
    # 3/4 со стороны привода: графитовая тыльная сторона, метка силы, механизм
    shot('3q', (0.92, 1.30, 0.95), (0.034, 0.0, 0.028), ortho_scale=0.360,
         res=(1000, 720))
    # фронт: широкая мягкая пластина со скруглёнными краями
    shot('front', (1.0, 0.14, 0.10), (0.100, 0.0, 0.033), ortho_scale=0.152,
         res=(760, 720))
    # профиль: шарнир, рессора, кулачок, ограничитель хода
    shot('side', (0.0, 1.0, 0.05), (0.030, 0.0, 0.028), ortho_scale=0.320,
         res=(1000, 430))
    # крупный план мягкой рабочей поверхности, рёбер и скруглённого торца
    shot('closeup', (0.52, 0.78, -0.42), (0.140, 0.030, 0.033), dist=0.290,
         lens=78, res=(980, 760), floor=False)
    # контроль читаемости на 300 px
    shot('preview300', (0.92, 1.30, 0.95), (0.034, 0.0, 0.028),
         ortho_scale=0.360, res=(300, 300))
    # доказательство качания: тот же профиль при повороте на 30° вокруг оси Y
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, math.radians(30.0), 0.0)
    bpy.context.view_layer.update()
    shot('swing30', (0.0, 1.0, 0.05), (0.030, 0.0, 0.012), ortho_scale=0.340,
         res=(900, 560), floor=False)
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    rep['renders'] = sorted(str(p.relative_to(PROJECT)) for p in SHOTS.glob('*.png'))


def main():
    anim, kids = build()
    rep = check(anim, kids)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    render(rep, anim)
    (SHOTS / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_is_hinge'] and rep['base_ok']
            and rep['swing_ok'] and rep['material_count'] >= 4):
        raise SystemExit('checks failed')


main()
