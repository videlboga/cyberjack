"""Standalone builder: effect_electric (EFF-ELE-01, «Электро-модуль»).

Вставка в гнездо базы, без насадки: изолированный графитовый корпус на
кольце посадки CJ-EFF-ELE, поверх — изоляционная дека с двумя каналами
(никелевые контактные площадки и клеммы), центральный барьер и видимые
рёбра creepage с прорезями, радиатор ограничителя тока на заднем торце,
разъём M8 4-pin с пигтейлом, два индикатора с линзами (циан/янтарь) на
переднем торце, жёлтая пластина опасности и маркировка.

Движения нет (каталог: motion none) — пустышки anim нет, все узлы статичны.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_effect_electric.py

Выход:
  public/models/machine-modules/components/effect_electric.glb
  docs/plans/blockout/component-library/effect_electric/report.json

Геометрия (Blender Z-up, метры):
  низ на z = 0 (кольцо посадки), верх = 0.030 (барьер/клеммы)
  габарит      = 0.070 (X) x 0.050 (Y) x 0.030 (Z)  — паспорт EFF-ELE-01
  перед        = -Y (индикаторы, маркировка), зад = +Y (M8, радиатор)
  крепление    = кольцо CJ-EFF-ELE снизу, 2 кулачка
"""
from pathlib import Path
import json
import math
import struct

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/effect_electric'
CID = 'effect_electric'
CODE = 'EFF-ELE-01'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
HX, HY = 0.035, 0.020              # полугабариты корпуса (Y: -0.022..0.018)
SHELL_Y0, SHELL_Y1 = -0.022, 0.018
SHELL_Z0, SHELL_Z1 = 0.0050, 0.0270
DECK_Z0, DECK_Z1 = 0.0270, 0.0286
Z_TOP = 0.0300                     # барьер и клеммы = габарит
MOUNT_R0, MOUNT_R1 = 0.0140, 0.0200
BARRIER_HX = 0.0012
CH_X = 0.0190                      # оси каналов
CH_PLATE_HX = 0.0075
CH_PLATE_Y = (-0.0120, 0.0080)
PORT_Y = -0.0248                   # линзы индикаторов (передний габарит)
REAR_Y = 0.0246                    # пины M8 / рёбра радиатора (задний габарит)

PALETTE = {
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.150, 0.156, 0.166),
    'steel': (0.690, 0.700, 0.706),
    'nickel': (0.800, 0.800, 0.780),
    'body': (0.945, 0.937, 0.918),
    'cyan': (0.110, 0.790, 0.915),
    'amber': (0.870, 0.590, 0.160),
    'glass': (0.880, 0.930, 0.940),
}
MATS = {}

ROLES = {
    'graphite': dict(rough=0.54, metal=0.32),
    'dark': dict(rough=0.74, metal=0.10),
    'steel': dict(rough=0.28, metal=1.00),
    'nickel': dict(rough=0.22, metal=0.90),
    'body': dict(rough=0.46, metal=0.00),
    'amber': dict(rough=0.42, metal=0.05),
}


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
    spec = ROLES.get(role)
    if spec:
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = spec['rough']
        bsdf.inputs['Metallic'].default_value = spec['metal']
    elif role == 'glass':
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.05
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Alpha'].default_value = 0.30
        bsdf.inputs['IOR'].default_value = 1.50
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
        if hasattr(m, 'use_backface_culling'):
            m.use_backface_culling = False
    elif role in ('cyan', 'amber'):
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.28
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.85 if role == 'cyan' else 0.35
    m.diffuse_color = (*color, 1.0 if role != 'glass' else 0.35)
    MATS[role] = m
    return m


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


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


def cube(name, loc, size, role, r=0.0010, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, vertices=28, smooth=True, r2=None, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-7:
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


def torus(name, loc, major, minor, role, axis=(0, 0, 1), segs=40, rings=8):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = Vector(axis).normalized().to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def cr_resample(points, per_seg=8):
    P = [Vector(p) for p in points]
    P = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(per_seg):
            t = k / per_seg
            t2, t3 = t * t, t * t * t
            out.append(0.5 * (2 * p1 + (-p0 + p2) * t
                              + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2
                              + (-p0 + 3 * p1 - 3 * p2 + p3) * t3))
    out.append(P[-2])
    return out


def curve_tube(name, points, radius, role, res=4, per_seg=8):
    pts = cr_resample(points, per_seg)
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for i, p in enumerate(pts):
        sp.points[i].co = (p.x, p.y, p.z, 1.0)
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


def text_label(name, body, loc, size, role, rot=(math.radians(90), 0, 0)):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = 0.0002
    obj.data.align_x = 'CENTER'
    obj.data.align_y = 'CENTER'
    try:
        obj.data.font = bpy.data.fonts.load(str(FONT_PATH))
    except Exception:
        pass
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role)


def radial(a_deg):
    a = math.radians(a_deg)
    return Vector((math.sin(a), -math.cos(a), 0.0))


def at(a_deg, r, z=0.0, cx=0.0, cy=0.0):
    d = radial(a_deg)
    return Vector((cx + d.x * r, cy + d.y * r, z))


def rr_profile(r0, r1, z0, z1, cr, n=4):
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


def ring(name, prof, a0, a1, seg, role, cx=0.0, cy=0.0, full=False):
    bm = bmesh.new()
    prof = list(prof)
    m = len(prof)
    n = seg if full else seg + 1
    rings = []
    for i in range(n):
        a = a0 + (a1 - a0) * i / seg
        d = radial(a)
        rings.append([bm.verts.new((cx + p[0] * d.x, cy + p[0] * d.y, p[1]))
                      for p in prof])
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


def bm_cyl(bm, a, b, radius, segments=12):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=d.length, matrix=m)


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ---------- кольцо посадки CJ-EFF-ELE + кулачки ---------------------
    ring(PREFIX + 'mount_ring',
         rr_profile(MOUNT_R0, MOUNT_R1, 0.0000, 0.0055, 0.0011, 4),
         0.0, 360.0, 44, 'graphite', full=True)
    bm = bmesh.new()
    for a in (90.0, 270.0):
        bm_box(bm, at(a, 0.0212, 0.0028), (0.0100, 0.0044, 0.0040),
               math.radians(a))
    mesh_from_bm(PREFIX + 'mount_lugs', bm, 'steel')

    # ---------- изолированный корпус ------------------------------------
    cube(PREFIX + 'shell', (0.0, (SHELL_Y0 + SHELL_Y1) * 0.5,
                            (SHELL_Z0 + SHELL_Z1) * 0.5),
         (2 * HX, SHELL_Y1 - SHELL_Y0, SHELL_Z1 - SHELL_Z0),
         'graphite', r=0.0028)
    # изоляционная дека (светлая) — каналы и барьеры видны на ней
    cube(PREFIX + 'deck', (0.0, -0.002, (DECK_Z0 + DECK_Z1) * 0.5),
         (0.0620, 0.0340, DECK_Z1 - DECK_Z0), 'body', r=0.0010)

    # центральный барьер между каналами
    cube(PREFIX + 'barrier_center',
         (0.0, -0.002, (DECK_Z1 + Z_TOP) * 0.5),
         (2 * BARRIER_HX, 0.0290, Z_TOP - DECK_Z1), 'body', r=0.0006)
    # рёбра creepage по обе стороны барьера
    bm = bmesh.new()
    for sx in (-1.0, 1.0):
        for i, off in enumerate((0.0042, 0.0072)):
            bm_box(bm, (sx * off, -0.002, DECK_Z1 + 0.00055),
                   (0.0009, 0.0290, 0.0011))
    mesh_from_bm(PREFIX + 'creepage_ribs', bm, 'body', smooth=False)
    # прорези между рёбрами (видимый путь утечки)
    bm = bmesh.new()
    for sx in (-1.0, 1.0):
        for off in (0.0057, 0.0087):
            bm_box(bm, (sx * off, -0.002, DECK_Z1 + 0.00025),
                   (0.0016, 0.0270, 0.0006))
    mesh_from_bm(PREFIX + 'creepage_slots', bm, 'dark', smooth=False)

    # ---------- два канала: никелевые площадки и клеммы -----------------
    for tag, sx in (('a', -1.0), ('b', 1.0)):
        cx = sx * CH_X
        cube(PREFIX + f'contact_plate_{tag}',
             (cx, -0.002, DECK_Z1 + 0.0006),
             (2 * CH_PLATE_HX, 0.0190, 0.0012), 'nickel', r=0.0005)
        for i, cy in enumerate((0.0065, -0.0105)):
            cyl(PREFIX + f'terminal_{tag}{i}', (cx, cy, DECK_Z1),
                (cx, cy, 0.0296), 0.0026, 'nickel', vertices=16, bev=0.0004)
            cyl(PREFIX + f'clamp_screw_{tag}{i}', (cx - 0.0028, cy, 0.0290),
                (cx + 0.0028, cy, 0.0290), 0.0010, 'steel', vertices=10)
        # маркировка канала
        text_label(PREFIX + f'channel_mark_{tag}', tag.upper(),
                   (cx * 1.35, -0.0170, DECK_Z1 + 0.0008), 0.0050, 'graphite',
                   rot=(0, 0, 0))

    # ---------- радиатор ограничителя тока (задний торец) ---------------
    cube(PREFIX + 'limiter_base', (-0.0180, SHELL_Y1 + 0.0020, 0.0150),
         (0.0260, 0.0040, 0.0180), 'graphite', r=0.0010)
    bm = bmesh.new()
    for i in range(6):
        fx = -0.0295 + i * 0.0046
        bm_box(bm, (fx, SHELL_Y1 + 0.0052, 0.0150), (0.0018, 0.0048, 0.0180))
    mesh_from_bm(PREFIX + 'limiter_fins', bm, 'steel', smooth=False)
    cube(PREFIX + 'limiter_label', (-0.0180, SHELL_Y1 + 0.0044, 0.0246),
         (0.0200, 0.0022, 0.0028), 'amber', r=0.0004)

    # ---------- разъём M8 4-pin + пигтейл -------------------------------
    cyl(PREFIX + 'conn_body', (0.0175, SHELL_Y1 - 0.0004, 0.0160),
        (0.0175, 0.0230, 0.0160), 0.0062, 'graphite', vertices=24, bev=0.0008)
    torus(PREFIX + 'conn_collar', (0.0175, 0.0210, 0.0160), 0.0064, 0.0010,
          'steel', axis=(0, 1, 0), segs=24, rings=6)
    cyl(PREFIX + 'conn_face', (0.0175, 0.0230, 0.0160),
        (0.0175, 0.0238, 0.0160), 0.0050, 'steel', vertices=24, bev=0.0005)
    bm = bmesh.new()
    for px, pz in ((-0.0024, -0.0024), (0.0024, -0.0024),
                   (-0.0024, 0.0024), (0.0024, 0.0024)):
        bm_cyl(bm, (0.0175 + px, 0.0238, 0.0160 + pz),
               (0.0175 + px, REAR_Y, 0.0160 + pz), 0.0010, 8)
    mesh_from_bm(PREFIX + 'conn_pins', bm, 'nickel')
    cyl(PREFIX + 'conn_boot', (0.0175, 0.0196, 0.0110),
        (0.0175, 0.0224, 0.0086), 0.0044, 'dark', vertices=16, r2=0.0034,
        bev=0.0004)
    curve_tube(PREFIX + 'pigtail',
               [(0.0175, 0.0220, 0.0092), (0.0240, 0.0192, 0.0074),
                (0.0298, 0.0122, 0.0090), (0.0318, 0.0030, 0.0116),
                (0.0308, -0.0060, 0.0126)], 0.0022, 'dark')

    # ---------- индикаторы с линзами (передний торец) -------------------
    for tag, ix, role in (('cyan', -0.0215, 'cyan'), ('amber', -0.0095, 'amber')):
        cyl(PREFIX + f'ind_{tag}_bezel', (ix, SHELL_Y0 + 0.0002, 0.0195),
            (ix, -0.0230, 0.0195), 0.0048, 'graphite', vertices=22, bev=0.0005)
        cyl(PREFIX + f'ind_{tag}_led', (ix, -0.0228, 0.0195),
            (ix, -0.0242, 0.0195), 0.0040, role, vertices=22)
        cyl(PREFIX + f'ind_{tag}_lens', (ix, -0.0242, 0.0195),
            (ix, PORT_Y, 0.0195), 0.0036, 'glass', vertices=22, r2=0.0032)

    # ---------- жёлтая пластина опасности + код ------------------------
    cube(PREFIX + 'hazard_plate', (0.0168, SHELL_Y0 - 0.0011, 0.0170),
         (0.0190, 0.0022, 0.0100), 'amber', r=0.0006)
    text_label(PREFIX + 'hazard_text', '4 kV', (0.0168, SHELL_Y0 - 0.0024, 0.0170),
               0.0042, 'dark')
    text_label(PREFIX + 'label_code', CODE, (0.0168, SHELL_Y0 - 0.0003, 0.0086),
               0.0034, 'body')

    # ---------- крепёж корпуса -----------------------------------------
    bm = bmesh.new()
    for sx in (-1.0, 1.0):
        for sy in (-0.0165, 0.0125):
            bm_cyl(bm, (sx * 0.0324, sy, SHELL_Z1 - 0.0002),
                   (sx * 0.0324, sy, SHELL_Z1 + 0.0016), 0.0022, 12)
    mesh_from_bm(PREFIX + 'shell_screws', bm, 'steel')

    for o in bpy.data.objects:
        if o.name.startswith(PREFIX):
            o['moving'] = False
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


def box_gap(a_mn, a_mx, b_mn, b_mx):
    gap = 0.0
    for i in range(3):
        gap = max(gap, max(b_mn[i] - a_mx[i], a_mn[i] - b_mx[i]))
    return gap


def verify_glb(path):
    data = path.read_bytes()
    magic, ver, _ = struct.unpack('<III', data[:12])
    if magic != 0x46546C67 or ver != 2:
        raise RuntimeError('bad glb header')
    clen, ctype = struct.unpack('<II', data[12:20])
    if ctype != 0x4E4F534A:
        raise RuntimeError('no json chunk')
    j = json.loads(data[20:20 + clen])
    nodes = j.get('nodes', [])
    return {
        'glb_bytes': len(data),
        'glb_nodes': len(nodes),
        'glb_meshes': len(j.get('meshes', [])),
        'glb_prefix_nodes': len([n for n in nodes
                                 if n.get('name', '').startswith(PREFIX)]),
        'glb_materials': sorted(m.get('name', '') for m in j.get('materials', [])),
        'glb_anim_nodes': [n.get('name', '') for n in nodes
                           if n.get('name', '').endswith('__anim')],
        'glb_bad_names': [n.get('name', '') for n in nodes
                          if n.get('mesh') is not None
                          and not n.get('name', '').startswith(PREFIX)],
        'glb_has_camera': bool(j.get('cameras')),
    }


def check(glb_info=None):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    passport = (0.070, 0.050, 0.030)
    bbox_err = [round((size[i] - passport[i]) * 1000, 2) for i in range(3)]
    bbox_ok = all(abs(size[i] - passport[i]) <= passport[i] * 0.05 for i in range(3))

    boxes = {o.name: mesh_bbox([o]) for o in meshes}
    extremes = {}
    for axis, idx in (('x', 0), ('y', 1), ('z', 2)):
        lo = min(boxes.items(), key=lambda kv: kv[1][0][idx])[0]
        hi = max(boxes.items(), key=lambda kv: kv[1][1][idx])[0]
        extremes[axis] = [lo, hi]
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0015
                   for other in boxes):
            floating.append(name)

    # изоляция: высота барьера над декой и зазор каналов до края
    barrier_top = mesh_bbox([bpy.data.objects[PREFIX + 'barrier_center']])[1].z
    channel_gap = 2 * CH_X - 2 * CH_PLATE_HX
    mats = sorted(m.name for m in bpy.data.materials)
    bad = sorted(o.name for o in bpy.data.objects if not o.name.startswith(PREFIX))
    nodes = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    anims = [o for o in bpy.data.objects if o.type == 'EMPTY']

    rep = {
        'component': CID,
        'code': CODE,
        'layer': 'effect',
        'passport': {'size_m': list(passport), 'mass_kg': 0.22,
                     'mount': 'CJ-EFF-ELE, M8 4-pin'},
        'nodes': len(nodes),
        'objects_total': len(bpy.data.objects),
        'mesh_nodes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_error_mm': bbox_err,
        'bbox_ok': bool(bbox_ok),
        'bbox_extremes': extremes,
        'floor_contact_z': round(mn.z, 6),
        'material_count': len(mats),
        'materials': mats,
        'motion': 'none',
        'anim_name': None,
        'anim_children_count': 0,
        'anim_empty_count': len(anims),
        'pivot_shift_m': 0.0,
        'pivot_shift_mm': 0.0,
        'pivot_ok': True,
        'pivot_note': 'движения нет: ось анимации не требуется, смещение pivot 0',
        'moving_parts': [],
        'static_parts': sorted(o.name for o in meshes),
        'static_count': len(meshes),
        'barrier_height_mm': round((barrier_top - DECK_Z0) * 1000, 2),
        'channel_gap_mm': round(channel_gap * 1000, 2),
        'indicator_lenses': sorted(o.name for o in meshes
                                   if '__lens' in o.name),
        'floating_parts': floating,
        'no_floating_ok': bool(not floating),
        'bad_names': bad,
        'bad_names_ok': bool(not bad),
        'headline': ('Читается изолированная дека с двумя каналами: никелевые '
                     'площадки и клеммы, центральный барьер с рёбрами creepage, '
                     'циановый и янтарный индикаторы с линзами, радиатор и '
                     'M8 4-pin с пигтейлом на заднем торце.'),
    }
    if glb_info:
        rep.update(glb_info)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    return rep


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
    path = export()
    rep = check(verify_glb(path))
    rep['glb'] = str(path.relative_to(PROJECT))
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    ok = (rep['bbox_ok'] and rep['pivot_ok'] and rep['material_count'] >= 4
          and not rep['bad_names'] and rep['nodes'] >= 8
          and rep['glb_bytes'] > 10000 and not rep['glb_anim_nodes'])
    if not ok:
        raise SystemExit('checks failed')


main()
