"""Standalone builder: surface_heated (SRF-HOT-03, «Обогрев»).

Гибкий нагревательный мат в молочном силиконовом чехле, 2,0 x 0,9 x 0,05 м:
  скруглённый в плане чехол с откатом кромки, кант по периметру, шов-разделитель,
  четыре независимые нагревательные зоны (янтарные серпантинные дорожки в
  утопленных секциях), поверхностный датчик температуры с выводом, тонкий
  контроллер с галетой и LED, кабель питания в клипсах с разъёмом,
  ремни с липучками и стальные люверсы по углам (крепление в раму),
  маркировка зон.
Без плиты, без вращений, без анимации.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_surface_heated.py

Выход:
  public/models/machine-modules/components/surface_heated.glb
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
CID = 'surface_heated'
PREFIX = CID + '__'

# --- ключевые размеры (м), Blender Z-up --------------------------------
AX, AY = 0.9950, 0.4500      # полугабариты чехла (1,990 x 0,900)
RC = 0.055                   # скругление плана
Z0 = 0.0                     # низ мата
Z1 = 0.0380                  # плоский верх чехла (толщина 38 мм)
RR = 0.0085                  # радиус отката кромки
CROWN = 0.0009               # лёгкая выпуклость полотна

# нагревательные зоны: 4 полосы по Y
ZONE_CY = (-0.30375, -0.10125, 0.10125, 0.30375)
PANEL_HW = 0.0885            # полуширина секции (0,177)
PANEL_X0, PANEL_X1 = -0.8650, 0.8450
PANEL_HX = (PANEL_X1 - PANEL_X0) * 0.5      # 0,855
PANEL_CX = (PANEL_X0 + PANEL_X1) * 0.5
PANEL_Z0, PANEL_Z1 = 0.0372, 0.0394
SEAM_Y = (-0.2025, 0.0, 0.2025)

TRACK_R = 0.0038             # радиус янтарной дорожки (~7,6 мм)
TRACK_Z = 0.0404
TRACK_RUNS = 9
TRACK_PITCH = 0.019
TRACK_X0, TRACK_X1 = -0.8300, 0.8300

SENSOR_XY = (0.8620, 0.30375)     # датчик у торца зоны 4, рядом с трассой
CTRL_XY = (0.9150, 0.1000)        # контроллер в торцевом поле
CTRL_SX, CTRL_SY = 0.0720, 0.1150

CABLE_R = 0.0055
CABLE_Z = 0.0432

N_LONG, N_SHORT, N_CORNER = 64, 10, 8
N_TOP, N_ARC, N_WALL, N_BOT = 7, 4, 2, 6

PALETTE = {
    'cover': (0.940, 0.925, 0.902),
    'zone': (0.912, 0.780, 0.586),
    'amber': (0.858, 0.330, 0.038),
    'seam': (0.780, 0.735, 0.668),
    'edge': (0.690, 0.596, 0.470),
    'graphite': (0.196, 0.202, 0.212),
    'steel': (0.770, 0.774, 0.768),
    'web': (0.286, 0.292, 0.302),
    'velcro': (0.520, 0.505, 0.482),
    'marking': (0.235, 0.242, 0.252),
}
ROUGH = {'cover': 0.76, 'zone': 0.58, 'amber': 0.30, 'seam': 0.88,
         'edge': 0.74, 'graphite': 0.52, 'steel': 0.33, 'web': 0.90,
         'velcro': 0.98, 'marking': 0.80}
MATS = {}


# --- helpers ------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_heat_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = 0.75 if role == 'steel' else 0.0
    if role == 'amber':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.30
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


def bevel_mod(obj, width, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0010, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel_mod(obj, r)
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
        bevel_mod(obj, bev, 2)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=32, rings=8):
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


def curve_tube(name, points, radius, role, res=3, cyclic=False):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 1
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for p, q in zip(sp.points, points):
        p.co = (q[0], q[1], q[2], 1.0)
    sp.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return apply(bpy.context.object, role, True)


def bm_to_obj(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def bm_box(bm, center, size, rot_z=0.0):
    m = (Matrix.Translation(Vector(center))
         @ Matrix.Rotation(rot_z, 4, 'Z')
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def outline_pts(ax, ay, rc, n=10):
    """Замкнутый контур скруглённого прямоугольника без дублей."""
    rc = max(rc, 1e-4)
    pts = []
    for cx, cy, a0 in ((ax - rc, ay - rc, 0.0),
                       (-(ax - rc), ay - rc, math.pi / 2),
                       (-(ax - rc), -(ay - rc), math.pi),
                       (ax - rc, -(ay - rc), 1.5 * math.pi)):
        for k in range(n):
            a = a0 + (math.pi / 2) * k / n
            pts.append(Vector((cx + rc * math.cos(a), cy + rc * math.sin(a), 0.0)))
    return pts


def rounded_prism(name, ax, ay, rc, z0, z1, role, bevel=0.0006):
    bm = bmesh.new()
    pts = outline_pts(ax, ay, rc, n=10)
    bot = [bm.verts.new((p.x, p.y, z0)) for p in pts]
    top = [bm.verts.new((p.x, p.y, z1)) for p in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    bm.faces.new(bot)
    bm.faces.new(top)
    obj = bm_to_obj(name, bm, role, False)
    if bevel > 0:
        bevel_mod(obj, bevel)
    return obj


def ribbon(name, path, half_w, role, thickness=0.0040):
    """Лента по (P, W); Solidify даёт толщину ремня."""
    bm = bmesh.new()
    rows = []
    for p, w in path:
        rows.append([bm.verts.new(p + w * half_w), bm.verts.new(p - w * half_w)])
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        bm.faces.new((a[0], b[0], b[1], a[1]))
    obj = bm_to_obj(name, bm, role, True)
    mod = obj.modifiers.new('sol', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 0.0
    mod.use_even_offset = False
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def ring_points(ax, ay, rc):
    """Кольцо: 2 длинных стороны, 2 торца, 4 дуги (для лофта чехла)."""
    rc = max(rc, 1e-4)
    pts = []
    for k in range(N_SHORT):
        pts.append((ax, -(ay - rc) + 2 * (ay - rc) * k / (N_SHORT - 1)))
    for k in range(1, N_CORNER):
        a = (math.pi / 2) * k / N_CORNER
        pts.append((ax - rc + rc * math.cos(a), ay - rc + rc * math.sin(a)))
    for k in range(N_LONG):
        pts.append((ax - rc - 2 * (ax - rc) * k / (N_LONG - 1), ay))
    for k in range(1, N_CORNER):
        a = math.pi / 2 + (math.pi / 2) * k / N_CORNER
        pts.append((-ax + rc + rc * math.cos(a), ay - rc + rc * math.sin(a)))
    for k in range(N_SHORT):
        pts.append((-ax, ay - rc - 2 * (ay - rc) * k / (N_SHORT - 1)))
    for k in range(1, N_CORNER):
        a = math.pi + (math.pi / 2) * k / N_CORNER
        pts.append((-ax + rc + rc * math.cos(a), -ay + rc + rc * math.sin(a)))
    for k in range(N_LONG):
        pts.append((-ax + rc + 2 * (ax - rc) * k / (N_LONG - 1), -ay))
    for k in range(1, N_CORNER):
        a = 1.5 * math.pi + (math.pi / 2) * k / N_CORNER
        pts.append((ax - rc + rc * math.cos(a), -ay + rc + rc * math.sin(a)))
    return pts


def crown(x, y):
    """Лёгкая выпуклость полотна (максимум в центре)."""
    fx = max(0.0, 1.0 - (abs(x) / AX) ** 2)
    fy = max(0.0, 1.0 - (abs(y) / AY) ** 2)
    return CROWN * (fx ** 0.6) * (fy ** 0.6)


# --- сборка --------------------------------------------------------------
def build_cover():
    """Лофт чехла: плоский верх с выпуклостью, откат кромки, борт, низ."""
    bm = bmesh.new()
    i_max = AY - 0.0014
    stations = []
    for k in range(N_TOP):
        stations.append(('top', i_max + (RR - i_max) * k / (N_TOP - 1), None))
    for k in range(1, N_ARC + 1):
        a = (math.pi / 2) * k / N_ARC
        stations.append(('z', RR * (1 - math.sin(a)), Z1 - RR * (1 - math.cos(a))))
    for k in range(1, N_WALL + 1):
        stations.append(('z', 0.0,
                         (Z1 - RR) - (Z1 - RR - Z0 - RR) * k / N_WALL))
    for k in range(1, N_ARC + 1):
        a = math.pi / 2 - (math.pi / 2) * k / N_ARC
        stations.append(('z', RR * (1 - math.sin(a)), Z0 + RR * (1 - math.cos(a))))
    for k in range(1, N_BOT + 1):
        stations.append(('bot', RR + (i_max - RR) * k / N_BOT, None))

    rings = []
    for kind, inset, zval in stations:
        loop = ring_points(AX - inset, AY - inset, RC - inset)
        ring = []
        for x, y in loop:
            if kind == 'top':
                z = Z1 + crown(x, y)
            elif kind == 'bot':
                z = Z0
            else:
                z = zval
            ring.append(bm.verts.new((x, y, z)))
        rings.append(ring)

    n = len(rings[0])
    kinds = [s[0] for s in stations]
    for i in range(len(rings) - 1):
        a, b = rings[i], rings[i + 1]
        mi = 1 if kinds[i + 1] == 'z' else 0
        for j in range(n):
            k = (j + 1) % n
            f = bm.faces.new((a[j], a[k], b[k], b[j]))
            f.material_index = mi
    f = bm.faces.new(rings[0])
    f.material_index = 0
    f = bm.faces.new(tuple(reversed(rings[-1])))
    f.material_index = 1
    obj = bm_to_obj(PREFIX + 'cover', bm, 'cover', True)
    obj.data.materials.append(mat('seam'))
    return obj, len(rings) * n


def serpentine(cy, x0, x1, runs=TRACK_RUNS, pitch=TRACK_PITCH, arc_seg=8):
    """Полилиния нагревательной дорожки: проходы по X + полукруглые развороты."""
    ys = [cy - (runs - 1) * pitch / 2 + i * pitch for i in range(runs)]
    rr = pitch / 2
    pts = []
    for i, y in enumerate(ys):
        fwd = (i % 2 == 0)
        if i == 0:
            pts.append((x0, y))
        xe = x1 if fwd else x0
        if i == runs - 1:
            pts.append((xe, y))
            break
        y_next = ys[i + 1]
        out = 1.0 if fwd else -1.0
        for k in range(arc_seg + 1):
            t = math.pi * k / arc_seg
            pts.append((xe + out * rr * math.sin(t),
                        y + math.copysign(rr * (1 - math.cos(t)), y_next - y)))
    return pts


def build_parts():
    # --- 4 независимые нагревательные секции + янтарные дорожки ----------
    for i, cy in enumerate(ZONE_CY, start=1):
        rounded_prism(PREFIX + f'zone_panel_{i}',
                      (PANEL_X1 - PANEL_X0) * 0.5, PANEL_HW, 0.012,
                      PANEL_Z0, PANEL_Z1, 'zone', bevel=0.0006)
        obj = bpy.context.object
        obj.location.x = (PANEL_X0 + PANEL_X1) * 0.5
        obj.location.y = cy
        bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)

        frame = outline_pts(PANEL_HX - 0.0038, PANEL_HW - 0.0038, 0.0082, n=6)
        curve_tube(PREFIX + f'zone_frame_{i}',
                   [(PANEL_CX + q.x, cy + q.y, PANEL_Z1 - 0.0003) for q in frame],
                   0.0022, 'edge', res=2, cyclic=True)

        path = serpentine(cy, TRACK_X0, TRACK_X1)
        curve_tube(PREFIX + f'heater_track_{i}',
                   [(x, y, TRACK_Z) for x, y in path], TRACK_R, 'amber', res=2)

    # --- швы-разделители между зонами -------------------------------------
    for tag, sy in (('center', 0.0), ('pos', SEAM_Y[2]), ('neg', SEAM_Y[0])):
        curve_tube(PREFIX + f'zone_seam_{tag}',
                   [(-0.880, sy, 0.0396), (-0.830, sy, 0.0399),
                    (0.0, sy, 0.0401), (0.830, sy, 0.0399),
                    (0.880, sy, 0.0396)], 0.0038, 'seam', res=3)

    # --- кант по периметру + строчка активной зоны ----------------------
    loop = outline_pts(AX - 0.0180, AY - 0.0180, RC - 0.0180, n=26)
    curve_tube(PREFIX + 'edge_binding',
               [(p.x, p.y, 0.0387) for p in loop], 0.0026, 'seam',
               res=3, cyclic=True)

    # --- маркировка зон (таблички + янтарные риски 1..4) -----------------
    bm = bmesh.new()
    bm_tick = bmesh.new()
    for i, cy in enumerate(ZONE_CY, start=1):
        lx = -0.780
        bm_box(bm, (lx, -0.4060, 0.0386), (0.062, 0.019, 0.0016))
        for k in range(i):
            bm_box(bm_tick, (lx - 0.021 + k * 0.0075, -0.4060, 0.0397),
                   (0.0045, 0.0090, 0.0018))
    bm_to_obj(PREFIX + 'zone_labels', bm, 'marking', False)
    bm_to_obj(PREFIX + 'zone_ticks', bm_tick, 'amber', False)

    # --- стальные люверсы по углам (крепление в раму) --------------------
    for sx in (-1, 1):
        for sy in (-1, 1):
            tag = ('p' if sx > 0 else 'n') + ('p' if sy > 0 else 'n')
            torus(PREFIX + f'grommet_{tag}', (sx * 0.620, sy * 0.4215, 0.0384),
                  0.0105, 0.0020, 'steel', 'Z', segs=26, rings=8)

    # --- поверхностный датчик температуры с выводом ----------------------
    sx0, sy0 = SENSOR_XY
    cube(PREFIX + 'sensor_pad', (sx0 + 0.0005, sy0, PANEL_Z1 + 0.0005),
         (0.040, 0.040, 0.0010), 'edge', r=0.0010)
    cyl(PREFIX + 'sensor_body', (sx0, sy0, PANEL_Z1 + 0.0012),
        (sx0, sy0, PANEL_Z1 + 0.0072), 0.0135, 'graphite', vertices=28, bev=0.0012)
    cyl(PREFIX + 'sensor_cap', (sx0, sy0, PANEL_Z1 + 0.0072),
        (sx0, sy0, PANEL_Z1 + 0.0082), 0.0102, 'steel', vertices=24, bev=0.0006)
    torus(PREFIX + 'sensor_ring', (sx0, sy0, PANEL_Z1 + 0.0016),
          0.0168, 0.0013, 'amber', 'Z', segs=28, rings=6)
    cyl(PREFIX + 'sensor_stem', (sx0 + 0.0128, sy0, PANEL_Z1 + 0.0044),
        (sx0 + 0.0250, sy0, PANEL_Z1 + 0.0044), 0.0044, 'graphite',
        vertices=16, bev=0.0008)
    curve_tube(PREFIX + 'sensor_lead',
               [(sx0 + 0.0245, sy0, PANEL_Z1 + 0.0042),
                (0.8920, 0.2860, 0.0416),
                (0.8945, 0.2440, 0.0418),
                (0.8965, 0.2000, 0.0418),
                (0.8990, 0.1720, 0.0416),
                (0.9020, 0.1580, 0.0414)],
               0.0022, 'graphite', res=2)

    # --- контроллер: тонкий корпус, галета, LED, шильдик -----------------
    cx, cy = CTRL_XY
    cube(PREFIX + 'controller_body', (cx, cy, 0.0424),
         (CTRL_SX, CTRL_SY, 0.0078), 'graphite', r=0.0022, smooth=False)
    cube(PREFIX + 'controller_face', (cx, cy, 0.0468),
         (CTRL_SX - 0.010, CTRL_SY - 0.010, 0.0012), 'marking', r=0.0008)
    cyl(PREFIX + 'controller_dial', (cx - 0.010, cy + 0.0320, 0.0474),
        (cx - 0.010, cy + 0.0320, 0.0496), 0.0125, 'steel', vertices=26, bev=0.0008)
    cyl(PREFIX + 'controller_dial_mark', (cx - 0.010, cy + 0.0320, 0.0494),
        (cx - 0.010, cy + 0.0320, 0.0500), 0.0034, 'graphite', vertices=12)
    for k, cy_off in enumerate((-0.030, -0.012, 0.006)):
        sphere(PREFIX + f'controller_led_{k}', (cx + 0.019, cy + cy_off, 0.0472),
               0.0028, 'amber', segs=14, rings=8)
    cube(PREFIX + 'controller_label', (cx + 0.006, cy + 0.0445, 0.0474),
         (0.048, 0.014, 0.0012), 'cover', r=0.0005)
    cube(PREFIX + 'controller_label_bar', (cx + 0.006, cy + 0.0445, 0.0481),
         (0.036, 0.0032, 0.0009), 'amber', r=0.0002)

    # --- гермоввод + кабель питания в клипсах + разъём -------------------
    cyl(PREFIX + 'cable_gland', (cx, cy - CTRL_SY * 0.5 - 0.0040, 0.0426),
        (cx, cy - CTRL_SY * 0.5 + 0.0040, 0.0426), 0.0072, 'graphite',
        vertices=20, bev=0.0012)
    cable_pts = [(cx, cy - CTRL_SY * 0.5 - 0.0035, CABLE_Z),
                 (cx + 0.004, 0.0120, CABLE_Z),
                 (cx + 0.012, -0.0560, CABLE_Z - 0.0004),
                 (cx + 0.019, -0.1300, CABLE_Z - 0.0006),
                 (cx + 0.020, -0.2050, CABLE_Z - 0.0006),
                 (cx + 0.014, -0.2550, CABLE_Z - 0.0004),
                 (cx + 0.004, -0.2830, CABLE_Z)]
    curve_tube(PREFIX + 'power_cable', cable_pts, CABLE_R, 'graphite', res=3)
    for k, (px, py) in enumerate(((cx + 0.017, -0.0900), (cx + 0.020, -0.1700))):
        cube(PREFIX + f'cable_clip_{k}', (px, py, 0.0428),
             (0.016, 0.020, 0.0104), 'web', r=0.0016)
    cube(PREFIX + 'cable_connector', (cx + 0.002, -0.2985, 0.0432),
         (0.030, 0.020, 0.0120), 'graphite', r=0.0022,
         rot=(0, 0, math.radians(-8)))
    cube(PREFIX + 'cable_connector_lip', (cx + 0.002, -0.3120, 0.0432),
         (0.020, 0.008, 0.0090), 'steel', r=0.0012,
         rot=(0, 0, math.radians(-8)))

    # --- ремни с липучками по четырём углам -----------------------------
    for sx in (-1, 1):
        for sy in (-1, 1):
            tag = ('p' if sx > 0 else 'n') + ('p' if sy > 0 else 'n')
            ex = sx * AX
            y0 = sy * 0.3550
            ctrl = []
            for i in (0.086, 0.070, 0.056, 0.044, 0.034):
                x = ex - sx * i
                ctrl.append((x, Z1 + crown(x, y0) + 0.0020))
            for a in (0.0, 0.22, 0.45, 0.68, 0.90, 1.12, 1.32, 1.48, math.pi / 2):
                ctrl.append((ex - sx * RR * (1 - math.sin(a)),
                             Z1 - RR * (1 - math.cos(a))))
            for z in (Z1 - RR - 0.0045, Z1 - RR - 0.0110, Z0 + RR):
                ctrl.append((ex + sx * 0.0012, z))
            path = [(Vector((x, y0, z)), Vector((0.0, 1.0, 0.0))) for x, z in ctrl]
            ribbon(PREFIX + f'corner_strap_{tag}', path, 0.0300, 'web', 0.0040)

            vx = ex - sx * 0.0560
            vz = Z1 + crown(vx, y0) + 0.0040
            cube(PREFIX + f'corner_velcro_{tag}', (vx, y0, vz + 0.0006),
                 (0.034, 0.0560, 0.0012), 'velcro', r=0.0004)
            cube(PREFIX + f'corner_clip_{tag}', (ex + sx * 0.0022, y0, 0.0205),
                 (0.0055, 0.0340, 0.0125), 'steel', r=0.0012)


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


def check(cover_verts):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    for o in meshes:
        o.data.calc_loop_triangles()

    zones = {}
    for i in range(1, 5):
        o = bpy.data.objects.get(PREFIX + f'heater_track_{i}')
        z_mn, z_mx = mesh_bbox([o])
        zones[str(i)] = {
            'bbox_min': [round(v, 4) for v in z_mn],
            'bbox_max': [round(v, 4) for v in z_mx],
            'len_m': round((z_mx - z_mn).x, 3),
            'verts': len(o.data.vertices),
        }

    rep = {
        'component': CID,
        'nodes': len(objs),
        'meshes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.010 and abs(size.y - 0.9) <= 0.010
                        and 0.046 <= size.z <= 0.055),
        'thickness_mm': round(size.z * 1000, 2),
        'verts_total': sum(len(o.data.vertices) for o in meshes),
        'tris_total': sum(len(o.data.loop_triangles) for o in meshes),
        'cover_verts': cover_verts,
        'materials': sorted({m.name for o in meshes for m in o.data.materials if m}),
        'mat_count': len({m.name for o in meshes for m in o.data.materials if m}),
        'zones': zones,
        'zone_count': len(zones),
        'has_sensor': bool(bpy.data.objects.get(PREFIX + 'sensor_body')),
        'has_controller': bool(bpy.data.objects.get(PREFIX + 'controller_body')),
        'has_cable': bool(bpy.data.objects.get(PREFIX + 'power_cable')),
        'straps': sorted(o.name for o in meshes if 'corner_strap' in o.name),
        'objects': sorted(o.name for o in meshes),
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
        'flat_plate': bool(bpy.data.objects.get(PREFIX + 'plate')),
    }
    return rep


def export():
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
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
    reset()
    cover, cover_verts = build_cover()
    build_parts()
    rep = check(cover_verts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok'] or rep['mat_count'] < 4 or rep['zone_count'] != 4:
        raise SystemExit('checks failed')


main()
