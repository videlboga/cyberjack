"""Standalone builder: effect_hydraulic (EFF-HYD-01, «Гидро-модуль»).

Перистальтический насос-вставка в гнездо базы, без насадки: графитовая
отливка на кольце посадки CJ-EFF-HYD, вертикальная головка насоса с
прозрачной передней крышкой (стекло), ротор с четырьмя роликами и
силиконовая трубка, огибающая ролики; мотор-редуктор сзади (червячный,
с рёбрами и клеммной коробкой), два штуцера G1/4 (латунь) с
полупрозрачными трубками на переднем торце, врезной датчик расхода с
кабелем и датчик давления, бирка с маркировкой потока.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_effect_hydraulic.py

Выход:
  public/models/machine-modules/components/effect_hydraulic.glb
  docs/plans/blockout/component-library/effect_hydraulic/report.json

Геометрия (Blender Z-up, метры):
  низ на z = 0 (кольцо посадки), верх = 0.050 (прижимы крышки)
  габарит      = 0.120 (X) x 0.070 (Y) x 0.050 (Z)  — паспорт EFF-HYD-01
  ось ротора   = вертикальная (Blender +Z; в GLB это +Y — Y-up на экспорте),
                 центр ротора (x = -0.024, y = -0.002, z = 0.040)
  анимация     = вращение пустышки effect_hydraulic__anim вокруг Z, 0.8 рад/с
  двигается    = ротор, ступица, 4 ролика, 4 втулки
  статично     = отливка, кольцо посадки с кулачками, лапы с прижимами,
                 головка насоса (обечайка + стеклянная крышка + обод + лид),
                 силиконовая трубка, штуцеры G1/4 с трубками, мотор-редуктор,
                 датчик расхода с кабелем, датчик давления, бирка
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/effect_hydraulic'
CID = 'effect_hydraulic'
CODE = 'EFF-HYD-01'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
AX_X, AX_Y = -0.024, -0.002       # ось ротора (вертикальная)
ROT_Z = 0.0390                    # центр ротора по высоте
DRUM_R_IN, DRUM_R_OUT = 0.0245, 0.0280
DRUM_Z0, DRUM_Z1 = 0.0300, 0.0460
RIM_Z0, RIM_Z1 = 0.0455, 0.0471
TUBE_R = 0.0032
LOOP_R = 0.0213                   # средняя линия трубки в головке
ROLL_R, ROLL_ST = 0.0045, 0.0136  # ролик и радиус его установки
ROTOR_R = 0.0165
HUB_R = 0.0055
CLIP_Z1 = 0.0496                  # верх прижимной скобы = габарит
HOUS_X, HOUS_Y0, HOUS_Y1 = 0.056, -0.028, 0.024
HOUS_Z0, HOUS_Z1 = 0.006, 0.032
PORT_Y = -0.0318                  # носок штуцера
GEAR_Y1 = 0.0345                  # торец мотор-редуктора
MOUNT_R0, MOUNT_R1 = 0.0180, 0.0260
ANIM_SPEED = 0.8                  # рад/с

PALETTE = {
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.150, 0.156, 0.166),
    'steel': (0.690, 0.700, 0.706),
    'body': (0.945, 0.937, 0.918),
    'brass': (0.760, 0.548, 0.262),
    'silicone': (0.940, 0.915, 0.875),
    'glass': (0.780, 0.885, 0.910),
    'tube': (0.815, 0.900, 0.905),
    'cyan': (0.330, 0.845, 0.930),
}
MATS = {}

ROLES = {
    'graphite': dict(rough=0.54, metal=0.32),
    'dark': dict(rough=0.74, metal=0.10),
    'steel': dict(rough=0.26, metal=1.00),
    'body': dict(rough=0.52, metal=0.00),
    'brass': dict(rough=0.34, metal=0.95),
    'silicone': dict(rough=0.86, metal=0.00, sheen=0.30),
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
        if 'sheen' in spec:
            bsdf.inputs['Sheen Weight'].default_value = spec['sheen']
    elif role == 'glass':
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.02
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Alpha'].default_value = 0.16
        bsdf.inputs['IOR'].default_value = 1.49
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
        if hasattr(m, 'use_backface_culling'):
            m.use_backface_culling = False
    elif role == 'tube':
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.16
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Alpha'].default_value = 0.52
        bsdf.inputs['IOR'].default_value = 1.42
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
        if hasattr(m, 'use_backface_culling'):
            m.use_backface_culling = False
    elif role == 'cyan':
        bsdf.inputs['Base Color'].default_value = (*color, 1.0)
        bsdf.inputs['Roughness'].default_value = 0.30
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.80
    m.diffuse_color = (*color, 1.0 if role not in ('glass', 'tube') else 0.35)
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


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), smooth=False):
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


def torus(name, loc, major, minor, role, axis=(0, 0, 1), segs=48, rings=8):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = Vector(axis).normalized().to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def cr_resample(points, per_seg=8):
    """Catmull-Rom по опорным точкам: плотная выборка без выбросов за габарит."""
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
    obj.data.extrude = 0.00025
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


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def radial(a_deg):
    """a=0 -> -Y (перед), a=90 -> +X, a=180 -> +Y (зад)."""
    a = math.radians(a_deg)
    return Vector((math.sin(a), -math.cos(a), 0.0))


def at(a_deg, r, z=0.0, cx=0.0, cy=0.0):
    d = radial(a_deg)
    return Vector((cx + d.x * r, cy + d.y * r, z))


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


def ring(name, prof, a0, a1, seg, role, cx=0.0, cy=0.0, full=False):
    """Тело вращения профиля (r,z) по дуге азимутов; full=True — замкнутое."""
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


def tube_arc(name, cx, cy, r, z, a0, a1, radius, role, pts=13):
    """Дуга трубки вокруг вертикальной оси."""
    path = [tuple(at(a0 + (a1 - a0) * i / (pts - 1), r, z, cx, cy))
            for i in range(pts)]
    return curve_tube(name, path, radius, role)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    movers = []

    # ---------- кольцо посадки CJ-EFF-HYD + кулачки ---------------------
    ring(PREFIX + 'mount_ring',
         rr_profile(MOUNT_R0, MOUNT_R1, 0.0000, 0.0062, 0.0012, 4),
         0.0, 360.0, 56, 'graphite', cx=AX_X, cy=AX_Y, full=True)
    bm = bmesh.new()
    for a in (90.0, 210.0, 330.0):
        c = at(a, 0.0272, 0.0032, AX_X, AX_Y)
        bm_box(bm, c, (0.0125, 0.0050, 0.0044), math.radians(a))
    mesh_from_bm(PREFIX + 'mount_lugs', bm, 'steel')

    # ---------- отливка корпуса ----------------------------------------
    cube(PREFIX + 'housing', (0.0, (HOUS_Y0 + HOUS_Y1) * 0.5, 0.022),
         (2 * HOUS_X, HOUS_Y1 - HOUS_Y0, HOUS_Z1 - HOUS_Z0),
         'graphite', r=0.0035)

    # лапы крепления к базе + прижимные винты (габарит 0.120 по X)
    for tag, sx in (('l', -1.0), ('r', 1.0)):
        cube(PREFIX + f'mount_ear_{tag}', (sx * 0.0560, -0.002, 0.0040),
             (0.0080, 0.0380, 0.0080), 'graphite', r=0.0012)
        for i, sy in enumerate((-0.0140, 0.0100)):
            cyl(PREFIX + f'clamp_screw_{tag}{i}', (sx * 0.0560, sy, 0.0075),
                (sx * 0.0560, sy, 0.0130), 0.0036, 'steel', vertices=12,
                bev=0.0005)
            cyl(PREFIX + f'clamp_knob_{tag}{i}', (sx * 0.0560, sy, 0.0130),
                (sx * 0.0560, sy, 0.0150), 0.0038, 'dark', vertices=14,
                bev=0.0006)

    # ---------- головка насоса: фланец, обечайка, стекло, обод ----------
    ring(PREFIX + 'drum_flange', rr_profile(0.0276, 0.0308, 0.0320, 0.0340,
                                            0.0012, 4),
         0.0, 360.0, 44, 'graphite', cx=AX_X, cy=AX_Y, full=True)
    bm = bmesh.new()
    for a in (45.0, 135.0, 225.0, 315.0):
        bm_cyl(bm, at(a, 0.0292, 0.0338, AX_X, AX_Y),
               at(a, 0.0292, 0.0354, AX_X, AX_Y), 0.0020, 10)
    mesh_from_bm(PREFIX + 'flange_screws', bm, 'steel')

    # дно головки (тёмное — контраст для трубки и роликов)
    cyl(PREFIX + 'drum_floor', (AX_X, AX_Y, 0.0288), (AX_X, AX_Y, 0.0318),
        DRUM_R_IN, 'dark', vertices=44, bev=0.0008)
    # обечайка (задняя часть) и прозрачная передняя крышка
    ring(PREFIX + 'drum_shell', rr_profile(0.0245, 0.0280, 0.0300, 0.0458,
                                           0.0010, 3),
         66.0, 294.0, 40, 'graphite', cx=AX_X, cy=AX_Y)
    ring(PREFIX + 'drum_window', rr_profile(0.0248, 0.0279, 0.0304, 0.0455,
                                            0.0008, 3),
         -66.0, 66.0, 24, 'glass', cx=AX_X, cy=AX_Y)
    ring(PREFIX + 'drum_rim', rr_profile(0.0240, 0.0284, RIM_Z0, RIM_Z1,
                                         0.0010, 3),
         0.0, 360.0, 44, 'graphite', cx=AX_X, cy=AX_Y, full=True)
    # прижимная планка над головкой: узкая шина + осевой колпачок
    bm = bmesh.new()
    bm_box(bm, (AX_X, AX_Y, 0.0482), (0.0044, 0.0568, 0.0018))
    mesh_from_bm(PREFIX + 'head_clamp', bm, 'steel', smooth=False)
    for sy in (-1, 1):
        cyl(PREFIX + f'clamp_post_{abs(sy)}',
            (AX_X, AX_Y + sy * 0.0272, RIM_Z0 + 0.0002),
            (AX_X, AX_Y + sy * 0.0272, 0.0492), 0.0020, 'steel', vertices=10)
    cyl(PREFIX + 'clamp_cap', (AX_X, AX_Y, 0.0470), (AX_X, AX_Y, 0.0495),
        0.0072, 'dark', vertices=20, bev=0.0006)

    # ---------- силиконовая трубка вокруг роликов ----------------------
    tube_arc(PREFIX + 'tube_loop', AX_X, AX_Y, LOOP_R, 0.0400,
             210.0, 510.0, TUBE_R, 'silicone', pts=31)

    # ---------- штуцеры G1/4 (латунь) + полупрозрачные трубки ----------
    for tag, px in (('a', -0.046), ('b', -0.002)):
        cyl(PREFIX + f'port_{tag}_nut', (px, HOUS_Y0 - 0.0002, 0.0185),
            (px, -0.0300, 0.0185), 0.0086, 'brass', vertices=6,
            smooth=False, bev=0.0006)
        cyl(PREFIX + f'port_{tag}_barb', (px, -0.0300, 0.0185),
            (px, PORT_Y, 0.0185), 0.0054, 'brass', vertices=20, bev=0.0005)
        torus(PREFIX + f'port_{tag}_barb_ring', (px, -0.0310, 0.0185),
              0.0056, 0.0007, 'brass', axis=(0, 1, 0), segs=20, rings=5)
    curve_tube(PREFIX + 'tube_in',
               [(-0.046, PORT_Y, 0.0185), (-0.0510, -0.0308, 0.0225),
                (-0.0545, -0.0265, 0.0275), (-0.0550, -0.0205, 0.0305),
                (-0.0545, -0.0150, 0.0315)], 0.0035, 'tube')
    curve_tube(PREFIX + 'tube_out',
               [(-0.002, PORT_Y, 0.0185), (0.0025, -0.0308, 0.0225),
                (0.0065, -0.0275, 0.0270), (0.0080, -0.0225, 0.0295),
                (0.0075, -0.0175, 0.0305)], 0.0035, 'tube')

    # ---------- мотор-редуктор сзади -----------------------------------
    cyl(PREFIX + 'gearbox_body', (AX_X, HOUS_Y1 - 0.002, 0.0235),
        (AX_X, 0.0330, 0.0235), 0.0170, 'graphite', vertices=36, bev=0.0016)
    for i, gy in enumerate((0.0258, 0.0286, 0.0314)):
        torus(PREFIX + f'gearbox_fin_{i}', (AX_X, gy, 0.0235), 0.0174, 0.0016,
              'steel', axis=(0, 1, 0), segs=32, rings=6)
    cyl(PREFIX + 'gearbox_cap', (AX_X, 0.0330, 0.0235), (AX_X, GEAR_Y1, 0.0235),
        0.0152, 'steel', vertices=32, bev=0.0012)
    cyl(PREFIX + 'gearbox_shaft', (AX_X, GEAR_Y1, 0.0235),
        (AX_X, GEAR_Y1 + 0.0006, 0.0235), 0.0048, 'dark', vertices=16)
    cube(PREFIX + 'motor_terminal', (AX_X + 0.0400, 0.0140, 0.0330),
         (0.0160, 0.0120, 0.0090), 'graphite', r=0.0012)
    cube(PREFIX + 'motor_terminal_lid', (AX_X + 0.0400, 0.0140, 0.0375),
         (0.0120, 0.0085, 0.0018), 'body', r=0.0006)
    cyl(PREFIX + 'motor_gland', (AX_X + 0.0400, 0.0200, 0.0330),
        (AX_X + 0.0400, 0.0218, 0.0330), 0.0034, 'dark', vertices=14,
        bev=0.0005)
    curve_tube(PREFIX + 'power_cable',
               [(AX_X + 0.0400, 0.0216, 0.0330),
                (AX_X + 0.0430, 0.0272, 0.0300),
                (AX_X + 0.0430, 0.0290, 0.0220),
                (AX_X + 0.0410, 0.0272, 0.0140)], 0.0024, 'dark')

    # ---------- датчик расхода (врезной) + кабель ----------------------
    cyl(PREFIX + 'flow_sensor', (0.0140, -0.0135, 0.0378),
        (0.0340, -0.0135, 0.0378), 0.0058, 'body', vertices=26, bev=0.0012)
    for tag, px in (('in', 0.0140), ('out', 0.0340)):
        cyl(PREFIX + f'flow_{tag}_barb', (px, -0.0135, 0.0378),
            (px + (-0.0042 if tag == 'in' else 0.0042), -0.0135, 0.0378),
            0.0038, 'brass', vertices=18, bev=0.0004)
    cyl(PREFIX + 'flow_sensor_cap', (0.0240, -0.0135, 0.0378),
        (0.0240, -0.0135, 0.0420), 0.0050, 'steel', vertices=6, smooth=False)
    cyl(PREFIX + 'flow_led', (0.0240, -0.0135, 0.0420),
        (0.0240, -0.0135, 0.0426), 0.0026, 'cyan', vertices=12)
    curve_tube(PREFIX + 'flow_cable',
               [(0.0240, -0.0148, 0.0396), (0.0272, -0.0060, 0.0390),
                (0.0306, 0.0060, 0.0362), (0.0316, 0.0160, 0.0330),
                (0.0300, 0.0228, 0.0290)], 0.0028, 'dark')

    # ---------- датчик давления ----------------------------------------
    cyl(PREFIX + 'pressure_nut', (0.0465, -0.0035, 0.0318),
        (0.0465, -0.0035, 0.0358), 0.0072, 'brass', vertices=6, smooth=False,
        bev=0.0006)
    cyl(PREFIX + 'pressure_sensor', (0.0465, -0.0035, 0.0358),
        (0.0465, -0.0035, 0.0388), 0.0052, 'body', vertices=20, bev=0.0006)
    curve_tube(PREFIX + 'pressure_cable',
               [(0.0465, -0.0035, 0.0388), (0.0470, 0.0060, 0.0378),
                (0.0455, 0.0160, 0.0342), (0.0420, 0.0230, 0.0300)],
               0.0026, 'dark')

    # ---------- бирка с маркировкой потока -----------------------------
    cube(PREFIX + 'label_plate', (0.0310, HOUS_Y0 - 0.0006, 0.0240),
         (0.0330, 0.0022, 0.0140), 'body', r=0.0006)
    text_label(PREFIX + 'label_code', CODE, (0.0310, HOUS_Y0 - 0.0022, 0.0268),
               0.0040, 'dark')
    text_label(PREFIX + 'label_flow', 'FLOW >>>', (0.0310, HOUS_Y0 - 0.0022, 0.0212),
               0.0036, 'brass')

    # ---------- движущаяся группа: ротор, ступица, ролики, втулки -------
    movers.append(cyl(PREFIX + 'rotor', (AX_X, AX_Y, 0.0318), (AX_X, AX_Y, 0.0342),
                      ROTOR_R, 'steel', vertices=40, bev=0.0008))
    movers.append(cyl(PREFIX + 'rotor_hub', (AX_X, AX_Y, 0.0314), (AX_X, AX_Y, 0.0450),
                      HUB_R, 'dark', vertices=24, bev=0.0006))
    movers.append(torus(PREFIX + 'rotor_hub_ring', (AX_X, AX_Y, 0.0448),
                        HUB_R + 0.0006, 0.0012, 'steel', segs=24, rings=6))
    for i in range(4):
        a = 45.0 + 90.0 * i
        p = at(a, ROLL_ST, 0.0, AX_X, AX_Y)
        movers.append(cyl(PREFIX + f'roller_{i}', (p.x, p.y, 0.0344),
                          (p.x, p.y, 0.0452), ROLL_R, 'steel', vertices=20,
                          bev=0.0006))
        movers.append(torus(PREFIX + f'bush_{i}', (p.x, p.y, 0.0346),
                            ROLL_R + 0.0004, 0.0011, 'brass', segs=20, rings=6))

    # ---------- анимационная пустышка на оси ротора --------------------
    anim = empty(PREFIX + 'anim', (AX_X, AX_Y, ROT_Z))
    anim['motion'] = 'spin'
    anim['axis'] = 'z'          # вертикальная ось; в GLB (Y-up) это +Y
    anim['amount'] = 0.0
    anim['speed'] = ANIM_SPEED
    bpy.context.view_layer.update()   # иначе matrix_world ещё identity
    for o in movers:
        parent(o, anim)
        o['moving'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in movers:
            o['moving'] = False

    bpy.context.view_layer.update()
    return anim, movers


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
    anim_nodes = [n for n in nodes if n.get('name') == PREFIX + 'anim']
    kids = []
    if anim_nodes:
        kids = sorted(nodes[i].get('name', '') for i in anim_nodes[0].get('children', []))
    return {
        'glb_bytes': len(data),
        'glb_nodes': len(nodes),
        'glb_meshes': len(j.get('meshes', [])),
        'glb_prefix_nodes': len([n for n in nodes
                                 if n.get('name', '').startswith(PREFIX)]),
        'glb_materials': sorted(m.get('name', '') for m in j.get('materials', [])),
        'glb_anim_children': kids,
        'glb_anim_children_count': len(kids),
        'glb_anim_extras': (anim_nodes[0].get('extras') if anim_nodes else None),
        'glb_bad_names': [n.get('name', '') for n in nodes
                          if n.get('mesh') is not None
                          and not n.get('name', '').startswith(PREFIX)],
        'glb_has_camera': bool(j.get('cameras')),
    }


def check(anim, movers, glb_info=None):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    passport = (0.120, 0.070, 0.050)
    bbox_err = [round((size[i] - passport[i]) * 1000, 2) for i in range(3)]
    bbox_ok = all(abs(size[i] - passport[i]) <= passport[i] * 0.05 for i in range(3))

    kids = [o for o in anim.children if o.type == 'MESH']
    kid_names = {o.name for o in kids}
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5

    # поворот на 90° вокруг вертикальной оси: центр bbox детей не смещается
    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, 0.0, math.radians(90))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    static_err = max(((after[n] - before[n]).length for n in before
                      if n not in kid_names), default=0.0)
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    restore_err = max((restored[n] - before[n]).length for n in before)

    anim_loc = anim.location.copy()
    axis_ok = (abs(anim_loc.x - AX_X) < 1e-6 and abs(anim_loc.y - AX_Y) < 1e-6
               and abs(anim_loc.z - ROT_Z) < 1e-6)
    on_rotor = abs(k_c0.x - AX_X) < 1e-4 and abs(k_c0.y - AX_Y) < 1e-4

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

    mats = sorted(m.name for m in bpy.data.materials)
    bad = sorted(o.name for o in bpy.data.objects if not o.name.startswith(PREFIX))
    nodes = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]

    rep = {
        'component': CID,
        'code': CODE,
        'layer': 'effect',
        'passport': {'size_m': list(passport), 'mass_kg': 0.5,
                     'mount': 'CJ-EFF-HYD, G1/4'},
        'nodes': len(nodes),
        'objects_total': len(bpy.data.objects),
        'mesh_nodes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_error_mm': bbox_err,
        'bbox_ok': bool(bbox_ok),
        'floor_contact_z': round(mn.z, 6),
        'material_count': len(mats),
        'materials': mats,
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim_loc],
        'anim_axis': 'z (Blender) / +y (GLB Y-up)',
        'anim_on_rotor_axis': bool(on_rotor),
        'anim_extras': {'motion': anim['motion'], 'axis': anim['axis'],
                        'amount': anim['amount'], 'speed': anim['speed']},
        'anim_children': sorted(kid_names),
        'anim_children_count': len(kids),
        'anim_children_center': [round(v, 5) for v in k_c0],
        'moving_parts': sorted(kid_names),
        'static_parts': sorted(o.name for o in meshes if o.name not in kid_names),
        'static_count': len([o for o in meshes if o.name not in kid_names]),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.0015 and axis_ok),
        'static_frozen_ok': bool(static_err < 1e-9),
        'static_drift_m': round(static_err, 9),
        'transform_restore_m': round(restore_err, 9),
        'bbox_extremes': extremes,
        'floating_parts': floating,
        'no_floating_ok': bool(not floating),
        'bad_names': bad,
        'bad_names_ok': bool(not bad),
        'headline': ('Читается вертикальная головка перистальтического насоса: '
                     'стеклянная передняя крышка, ротор с четырьмя роликами и '
                     'силиконовая трубка в просвете; сзади — мотор-редуктор, '
                     'спереди — латунные G1/4 и бирка потока.'),
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
    anim, movers = build()
    path = export()
    rep = check(anim, movers, verify_glb(path))
    rep['glb'] = str(path.relative_to(PROJECT))
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    ok = (rep['bbox_ok'] and rep['pivot_ok'] and rep['material_count'] >= 4
          and not rep['bad_names'] and rep['nodes'] >= 8
          and rep['glb_bytes'] > 10000 and rep['anim_children_count'] == 11)
    if not ok:
        raise SystemExit('checks failed')


main()
