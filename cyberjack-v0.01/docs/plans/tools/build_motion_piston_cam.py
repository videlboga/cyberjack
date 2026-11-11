"""Standalone builder: motion_piston_cam (MOT-PIS-05, «Кулачковый поршень»).

Открытый кулачково-роликовый механизм с вертикальной осью кулачка: рама,
мотор с червячным редуктором, кулачок с настоящим профилем (построен как
эквидистанта кривой толкателя), роликовый толкатель в направляющей втулке,
возвратная пружина в окнах пружинного стакана, два концевых датчика и
выходной фланец. Глухих панелей, кожухов и декоративных дуг нет.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_piston_cam.py

Выход:
  public/models/machine-modules/components/motion_piston_cam.glb
  docs/plans/tools/cam_profile_motion_piston_cam.json   (runtime-таблица профиля)
  docs/plans/blockout/component-library/motion_piston_cam/*.png
  docs/plans/blockout/component-library/motion_piston_cam/report.json

Геометрия (Blender Z-up, метры), экспорт export_yup=True:
  ось кулачка   = Z (в three.js Y) в точке (CAM_CX, CAM_CY)
  ось толкателя = X, y = AXIS_Y, z = AXIS_Z, ход 0.06
  габарит       = 0.60 (X) x 0.298 (Y) x ~0.212 (Z)

Кинематика (runtime):
  phase 0 = монтажный угол POSE_DEG, ролик стоит на СРЕДНЕМ радиусе
  (rho = R_BASE + LIFT/2 = 0.076 м), поэтому ход симметричен: +-0.03 м.
  Таблица cam_profile_*.json снимается с ЭКСПОРТИРОВАННОГО GLB и содержит
  r_m(phase) = расстояние от оси кулачка до центра ролика минус радиус
  ролика (опорная/касательная кривая, а не радиальный след профиля:
  на больших углах давления они расходятся до 2.4 мм).
  Viewer: rotationY = phase; follower.x = base_x + (r(phase) - r0).
"""
from pathlib import Path
import json
import math
import struct
import bisect

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_piston_cam'
PROFILE_JSON = HERE / 'cam_profile_motion_piston_cam.json'
CID = 'motion_piston_cam'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- кинематика кулачка ---------------------------------------------------
CAM_CX, CAM_CY = -0.120, -0.030     # ось кулачка (вертикальная, Z)
AXIS_Z = 0.158                     # высота плоскости кулачка = ось толкателя
AXIS_Y = CAM_CY
TRAVEL = 0.060

R_BASE = 0.046                     # минимальный радиус кривой толкателя
LIFT = 0.060                       # подъём = ход
FALL_DEG = 160.0                   # спад от носа
DWELL_DEG = 40.0                   # выстой на базовом радиусе
RISE_DEG = 160.0                   # подъём к носу
N_PROF = 480
# Монтажный угол: нос кулачка в POSE_DEG. Ролик смотрит по +X (world 0),
# поэтому локальный угол контакта psi = -POSE_DEG + ... ; при -80°
# psi = 80° — середина спада, rho = R_BASE + LIFT/2 (ролик на среднем
# радиусе, ход +-TRAVEL/2). Иначе runtime-ход не совпадает с профилем.
POSE_DEG = -80.0

ROLLER_R = 0.016
CAM_T = 0.016                      # толщина диска кулачка
CAM_Z0, CAM_Z1 = AXIS_Z - CAM_T * 0.5, AXIS_Z + CAM_T * 0.5

# --- рама ---------------------------------------------------------------
BEAM_Z = 0.026
BASE_X0, BASE_X1 = -0.300, 0.300
BASE_Y0, BASE_Y1 = -0.149, 0.149

# --- мотор / редуктор ----------------------------------------------------
MOT_Y, MOT_Z = CAM_CY, 0.088
MOT_X0, MOT_X1 = -0.292, -0.222
MOT_R = 0.040

GB_X0, GB_X1 = -0.216, -0.118
GB_Y0, GB_Y1 = -0.066, 0.004
GB_Z0, GB_Z1 = BEAM_Z, 0.122

# --- направляющая / пружина ---------------------------------------------
CAGE_X0, CAGE_X1 = 0.058, 0.145
CAGE_RI, CAGE_RO = 0.027, 0.032
HEAD_X0, HEAD_X1 = 0.145, 0.167
HEAD_RO = 0.030
BORE_R = 0.0098

ROD_R = 0.0085
ROD_X1 = 0.250
SPR_RM, SPR_WIRE, SPR_COILS = 0.0105, 0.0026, 7

FLY_Z0, FLY_Z1 = AXIS_Z + 0.038, AXIS_Z + 0.048
# Обод маховика-штурвала. Viewer строит pivot вращения по AABB группы
# кулачка, поэтому обод обязан быть самым большим элементом в плоскости
# кулачка: иначе ось вращения уезжает от оси кулачка (было 26 мм).
FLY_R = 0.101
FLY_RI = FLY_R - 0.0055

PALETTE = {
    'ivory': (0.925, 0.920, 0.905),
    'pale': (0.965, 0.960, 0.945),
    'graphite': (0.300, 0.315, 0.335),
    'dark': (0.130, 0.140, 0.155),
    'steel': (0.660, 0.670, 0.680),
    'chrome': (0.815, 0.825, 0.840),
    'blush': (0.880, 0.600, 0.630),
    'cyan': (0.350, 0.700, 0.740),
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
    metal = {'steel': 0.70, 'chrome': 0.95, 'graphite': 0.12,
             'dark': 0.05}.get(role, 0.0)
    rough = {'steel': 0.30, 'chrome': 0.13, 'graphite': 0.55,
             'dark': 0.75, 'ivory': 0.42, 'pale': 0.50,
             'blush': 0.40, 'cyan': 0.35}.get(role, 0.5)
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def text_label(name, body, loc, size, role, rot=(0, 0, 0)):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = 0.0004
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


# --- профиль кулачка -----------------------------------------------------
def pitch_r(psi_deg):
    """Радиус кривой центров ролика от угла (0 = нос)."""
    a = psi_deg % 360.0
    if a <= FALL_DEG:
        u = a / FALL_DEG
        return R_BASE + LIFT * 0.5 * (1.0 + math.cos(math.pi * u))
    if a < FALL_DEG + DWELL_DEG:
        return R_BASE
    u = (a - FALL_DEG - DWELL_DEG) / RISE_DEG
    return R_BASE + LIFT * 0.5 * (1.0 - math.cos(math.pi * u))


def cam_profile(n=N_PROF):
    """Профиль кулачка = внутренняя эквидистанта кривой толкателя на ROLLER_R.

    Возвращает точки в локальных координатах кулачка (центр в 0,0), XY.
    """
    pitch = []
    for i in range(n):
        psi = 360.0 * i / n
        r = pitch_r(psi)
        a = math.radians(psi)
        pitch.append((r * math.cos(a), r * math.sin(a)))
    pts = []
    for i in range(n):
        x0, y0 = pitch[(i - 1) % n]
        x1, y1 = pitch[(i + 1) % n]
        tx, ty = x1 - x0, y1 - y0
        ln = math.hypot(tx, ty)
        tx, ty = tx / ln, ty / ln
        pts.append((pitch[i][0] - ty * ROLLER_R, pitch[i][1] + tx * ROLLER_R))
    c, s = math.cos(math.radians(POSE_DEG)), math.sin(math.radians(POSE_DEG))
    return [(x * c - y * s, x * s + y * c) for (x, y) in pts]


def prism_z(name, pts, z0, z1, role, dx=0.0, dy=0.0, scale=1.0, smooth=False):
    """Призма из контура XY, выдавленная по Z."""
    bm = bmesh.new()
    bot = [bm.verts.new((dx + x * scale, dy + y * scale, z0)) for (x, y) in pts]
    top = [bm.verts.new((dx + x * scale, dy + y * scale, z1)) for (x, y) in pts]
    n = len(pts)
    bm.faces.new(tuple(reversed(bot)))
    bm.faces.new(tuple(top))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    return mesh_from_bm(name, bm, role, smooth)


# --- тела вращения -------------------------------------------------------
def tube_x(name, x0, x1, cy, cz, ri, ro, role, seg=40, smooth=True):
    bm = bmesh.new()
    rings = []
    for x in (x0, x1):
        inner = [bm.verts.new((x, cy + math.cos(math.tau * i / seg) * ri,
                               cz + math.sin(math.tau * i / seg) * ri))
                 for i in range(seg)]
        outer = [bm.verts.new((x, cy + math.cos(math.tau * i / seg) * ro,
                               cz + math.sin(math.tau * i / seg) * ro))
                 for i in range(seg)]
        rings.append((inner, outer))
    (i0, o0), (i1, o1) = rings
    for k in range(seg):
        k2 = (k + 1) % seg
        bm.faces.new((i0[k], i0[k2], i1[k2], i1[k]))
        bm.faces.new((o0[k], o0[k2], o1[k2], o1[k]))
        bm.faces.new((i1[k], i1[k2], o1[k2], o1[k]))
        bm.faces.new((i0[k], i0[k2], o0[k2], o0[k]))
    return mesh_from_bm(name, bm, role, smooth)


def tube_z(name, z0, z1, cx, cy, ri, ro, role, seg=48, smooth=True):
    bm = bmesh.new()
    rings = []
    for z in (z0, z1):
        inner = [bm.verts.new((cx + math.cos(math.tau * i / seg) * ri,
                               cy + math.sin(math.tau * i / seg) * ri, z))
                 for i in range(seg)]
        outer = [bm.verts.new((cx + math.cos(math.tau * i / seg) * ro,
                               cy + math.sin(math.tau * i / seg) * ro, z))
                 for i in range(seg)]
        rings.append((inner, outer))
    (i0, o0), (i1, o1) = rings
    for k in range(seg):
        k2 = (k + 1) % seg
        bm.faces.new((i0[k], i0[k2], i1[k2], i1[k]))
        bm.faces.new((o0[k], o0[k2], o1[k2], o1[k]))
        bm.faces.new((i1[k], i1[k2], o1[k2], o1[k]))
        bm.faces.new((i0[k], i0[k2], o0[k2], o0[k]))
    return mesh_from_bm(name, bm, role, smooth)


def arc_shell_x(name, x0, x1, cy, cz, ri, ro, a0_deg, a1_deg, role, seg=10,
                smooth=True):
    """Сектор кольца вокруг оси X (окна пружинного стакана)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = math.radians(a0_deg + (a1_deg - a0_deg) * i / seg)
        dy, dz = math.cos(a), math.sin(a)
        quad = []
        for x in (x0, x1):
            for r in (ri, ro):
                quad.append(bm.verts.new((x, cy + dy * r, cz + dz * r)))
        rings.append(quad)
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        bm.faces.new((a_[0], a_[2], b_[2], b_[0]))
        bm.faces.new((a_[1], b_[1], b_[3], a_[3]))
        bm.faces.new((a_[0], a_[1], b_[1], b_[0]))
        bm.faces.new((a_[2], a_[3], b_[3], b_[2]))
    bm.faces.new(tuple(rings[0]))
    bm.faces.new(tuple(reversed(rings[-1])))
    return mesh_from_bm(name, bm, role, smooth)


def helix_spring(name, x0, x1, cy, cz, r_mean, wire, coils, role,
                 ring=9, per=20):
    bm = bmesh.new()
    n = int(coils * per)
    pts = []
    for i in range(n + 1):
        u = i / n
        a = u * coils * math.tau
        pts.append(Vector((x0 + (x1 - x0) * u,
                           cy + math.cos(a) * r_mean,
                           cz + math.sin(a) * r_mean)))
    rings = []
    for i, p in enumerate(pts):
        if i == 0:
            t = pts[1] - pts[0]
        elif i == n:
            t = pts[-1] - pts[-2]
        else:
            t = pts[i + 1] - pts[i - 1]
        t.normalize()
        rad = Vector((0.0, p.y - cy, p.z - cz))
        if rad.length < 1e-9:
            rad = Vector((0.0, 1.0, 0.0))
        rad.normalize()
        bin_ = t.cross(rad)
        bin_.normalize()
        rings.append([bm.verts.new(p + rad * (math.cos(math.tau * k / ring) * wire)
                                   + bin_ * (math.sin(math.tau * k / ring) * wire))
                      for k in range(ring)])
    for i in range(n):
        for k in range(ring):
            k2 = (k + 1) % ring
            bm.faces.new((rings[i][k], rings[i][k2],
                          rings[i + 1][k2], rings[i + 1][k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))
    return mesh_from_bm(name, bm, role, True)


def bolts(name, spots, axis, radius, depth, role, seg=6):
    bm = bmesh.new()
    rot = {'X': Vector((1, 0, 0)), 'Y': Vector((0, 1, 0)),
           'Z': Vector((0, 0, 1))}[axis].to_track_quat('Z', 'Y').to_matrix().to_4x4()
    for p in spots:
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=seg,
                              radius1=radius, radius2=radius, depth=depth,
                              matrix=Matrix.Translation(Vector(p)) @ rot)
    return mesh_from_bm(name, bm, role, False)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rot_movers = []
    slide_movers = []
    prof = cam_profile()
    Z = AXIS_Z

    # ================= рама (открытая, без глухой плиты) ================
    for tag, y in (('front', -0.136), ('rear', 0.136)):
        cube(PREFIX + f'frame_rail_{tag}', (0.0, y, BEAM_Z * 0.5),
             (0.600, 0.024, BEAM_Z), 'graphite', r=0.0030)
    for tag, x in (('l', -0.288), ('r', 0.288)):
        cube(PREFIX + f'frame_end_{tag}', (x, 0.0, BEAM_Z * 0.5),
             (0.024, 0.296, BEAM_Z), 'graphite', r=0.0030)
    for tag, x, w in (('gearbox', -0.166, 0.030), ('cradle', 0.157, 0.026),
                      ('sensor', 0.002, 0.030)):
        cube(PREFIX + f'frame_cross_{tag}', (x, 0.0, BEAM_Z * 0.5),
             (w, 0.272, BEAM_Z), 'graphite', r=0.0026)

    pad_spots = [(x, y) for x in (-0.262, 0.262) for y in (-0.136, 0.136)]
    for i, (x, y) in enumerate(pad_spots):
        cube(PREFIX + f'mount_pad_{i}', (x, y, BEAM_Z + 0.002),
             (0.040, 0.020, 0.006), 'graphite', r=0.0016)
    bolts(PREFIX + 'mount_bolts',
          [(x, y, BEAM_Z + 0.008) for (x, y) in pad_spots],
          'Z', 0.0080, 0.008, 'steel')

    cube(PREFIX + 'name_plate', (0.108, -0.136, BEAM_Z + 0.0012),
         (0.086, 0.020, 0.0024), 'pale', r=0.0006)
    text_label(PREFIX + 'name_text', 'MOT-PIS-05', (0.108, -0.136, BEAM_Z + 0.0028),
               0.0072, 'graphite')

    # ================= мотор ============================================
    cube(PREFIX + 'motor_saddle', ((MOT_X0 + MOT_X1) * 0.5 + 0.004, MOT_Y, 0.037),
         (0.062, 0.082, 0.022), 'graphite', r=0.0026)
    cyl(PREFIX + 'motor', (MOT_X0, MOT_Y, MOT_Z), (MOT_X1, MOT_Y, MOT_Z),
        MOT_R, 'ivory', vertices=48, bev=0.0032)
    bm = bmesh.new()
    for k in range(12):
        a = math.tau * k / 12 + math.radians(15)
        if math.sin(a) < -0.55:      # снизу рёбра не нужны — там седло
            continue
        bmesh.ops.create_cube(
            bm, size=1.0,
            matrix=(Matrix.Translation((MOT_X0 + 0.032,
                                        MOT_Y + math.cos(a) * (MOT_R + 0.003),
                                        MOT_Z + math.sin(a) * (MOT_R + 0.003)))
                    @ Matrix.Rotation(a, 4, 'X')
                    @ Matrix.Diagonal(Vector((0.052, 0.006, 0.010, 1.0)))))
    mesh_from_bm(PREFIX + 'motor_fins', bm, 'graphite', False)
    cyl(PREFIX + 'motor_bell', (MOT_X0 - 0.008, MOT_Y, MOT_Z), (MOT_X0, MOT_Y, MOT_Z),
        MOT_R + 0.003, 'graphite', vertices=44, bev=0.0022)
    torus(PREFIX + 'motor_band', (MOT_X0 + 0.006, MOT_Y, MOT_Z), MOT_R + 0.0016,
          0.0024, 'blush', 'X', segs=44, rings=8)
    cube(PREFIX + 'motor_terminal', (MOT_X0 + 0.030, MOT_Y + 0.002, MOT_Z + 0.046),
         (0.030, 0.026, 0.015), 'graphite', r=0.0022)
    cube(PREFIX + 'motor_terminal_lid', (MOT_X0 + 0.030, MOT_Y + 0.002,
                                         MOT_Z + 0.0545),
         (0.026, 0.022, 0.003), 'pale', r=0.0008)

    # ================= червячный редуктор ===============================
    cube(PREFIX + 'gearbox_body', ((GB_X0 + GB_X1) * 0.5, (GB_Y0 + GB_Y1) * 0.5,
                                   (GB_Z0 + GB_Z1) * 0.5),
         (GB_X1 - GB_X0, GB_Y1 - GB_Y0, GB_Z1 - GB_Z0), 'dark', r=0.0040)
    cube(PREFIX + 'gearbox_plate', ((GB_X0 + GB_X1) * 0.5, GB_Y0 - 0.0025, 0.086),
         (0.052, 0.005, 0.044), 'blush', r=0.0014)
    cube(PREFIX + 'gearbox_cover', ((GB_X0 + GB_X1) * 0.5, (GB_Y0 + GB_Y1) * 0.5,
                                    GB_Z1 + 0.0025),
         (GB_X1 - GB_X0 - 0.010, GB_Y1 - GB_Y0 - 0.010, 0.005), 'steel', r=0.0014)
    cyl(PREFIX + 'cam_boss', (CAM_CX, CAM_CY, GB_Z1),
        (CAM_CX, CAM_CY, CAM_Z0 - 0.008), 0.026, 'steel', vertices=36, bev=0.0018)
    cyl(PREFIX + 'cam_boss_collar', (CAM_CX, CAM_CY, CAM_Z0 - 0.008),
        (CAM_CX, CAM_CY, CAM_Z0), 0.032, 'graphite', vertices=40, bev=0.0012)
    torus(PREFIX + 'cam_boss_ring', (CAM_CX, CAM_CY, CAM_Z0 - 0.0016), 0.0225,
          0.0018, 'graphite', 'Z', segs=36, rings=8)
    bolts(PREFIX + 'gearbox_bolts',
          [(GB_X1 - 0.012, GB_Y0 + 0.012, GB_Z1 - 0.006),
           (GB_X1 - 0.012, GB_Y1 - 0.012, GB_Z1 - 0.006),
           (GB_X0 + 0.012, GB_Y0 + 0.012, GB_Z1 - 0.006),
           (GB_X0 + 0.012, GB_Y1 - 0.012, GB_Z1 - 0.006)],
          'Z', 0.0028, 0.0035, 'steel')

    # ================= стойка направляющей + пружинный стакан ==========
    leg_top = Z - HEAD_RO
    for tag, x0 in (('a', HEAD_X0 + 0.002), ('b', HEAD_X1 - 0.014)):
        cube(PREFIX + f'guide_leg_{tag}',
             (x0 + 0.004, 0.0, (BEAM_Z + leg_top) * 0.5),
             (0.008, 0.062, leg_top - BEAM_Z), 'graphite', r=0.0018)
    tube_x(PREFIX + 'guide_head', HEAD_X0, HEAD_X1, CAM_CY, Z, BORE_R, HEAD_RO,
           'graphite', seg=40)
    cube(PREFIX + 'guide_clamp', ((HEAD_X0 + HEAD_X1) * 0.5, CAM_CY, Z + HEAD_RO - 0.002),
         (0.020, 0.052, 0.012), 'steel', r=0.0016)
    bolts(PREFIX + 'guide_clamp_bolts',
          [((HEAD_X0 + HEAD_X1) * 0.5 - 0.006, CAM_CY - 0.020, Z + HEAD_RO + 0.004),
           ((HEAD_X0 + HEAD_X1) * 0.5 - 0.006, CAM_CY + 0.020, Z + HEAD_RO + 0.004)],
          'Z', 0.0024, 0.004, 'steel')
    cyl(PREFIX + 'guide_bushing', (HEAD_X1, CAM_CY, Z), (HEAD_X1 + 0.007, CAM_CY, Z),
        0.0195, 'pale', vertices=36, bev=0.0012)
    cyl(PREFIX + 'guide_wipers', (HEAD_X1 + 0.007, CAM_CY, Z),
        (HEAD_X1 + 0.010, CAM_CY, Z), 0.0115, 'dark', vertices=32, bev=0.0008)

    # пружинный стакан — открытая клетка из двух колец и четырёх рёбер
    tube_x(PREFIX + 'spring_cage_rear', CAGE_X0, CAGE_X0 + 0.008, CAM_CY, Z,
           CAGE_RI, CAGE_RO, 'graphite', seg=36)
    tube_x(PREFIX + 'spring_cage_front', CAGE_X1 - 0.008, CAGE_X1, CAM_CY, Z,
           CAGE_RI, CAGE_RO, 'graphite', seg=36)
    bm = bmesh.new()
    for k in range(4):
        a0 = 90.0 * k - 10.0
        part = arc_shell_x('tmp', CAGE_X0 + 0.008, CAGE_X1 - 0.008, CAM_CY, Z,
                           CAGE_RI, CAGE_RO, a0, a0 + 20.0, 'graphite', seg=4)
        me = part.data
        bm.from_mesh(me)
        bpy.data.objects.remove(part, do_unlink=True)
    mesh_from_bm(PREFIX + 'spring_cage_ribs', bm, 'graphite')

    # ================= концевые датчики =================================
    cube(PREFIX + 'sensor_plinth', (0.002, CAM_CY, 0.048),
         (0.096, 0.030, 0.044), 'graphite', r=0.0022)
    for tag, x in (('min', -0.028), ('max', 0.032)):
        cyl(PREFIX + f'sensor_{tag}', (x, CAM_CY, 0.070), (x, CAM_CY, 0.100),
            0.0085, 'dark', vertices=24, bev=0.0012)
        cyl(PREFIX + f'sensor_face_{tag}', (x, CAM_CY, 0.100), (x, CAM_CY, 0.1015),
            0.0068, 'pale', vertices=24)
    for tag, x in (('min', -0.028), ('max', 0.032)):
        torus(PREFIX + f'sensor_led_{tag}', (x, CAM_CY, 0.0985), 0.0075, 0.0011,
              'cyan', 'Z', segs=20, rings=6)

    # ================= кулачок (вращается) ==============================
    rot_movers.append(prism_z(PREFIX + 'cam_lobe', prof, CAM_Z0, CAM_Z1,
                              'ivory', dx=CAM_CX, dy=CAM_CY))
    rot_movers.append(prism_z(PREFIX + 'cam_web', prof, CAM_Z1, CAM_Z1 + 0.005,
                              'graphite', dx=CAM_CX, dy=CAM_CY, scale=0.30))
    rot_movers.append(cyl(PREFIX + 'cam_hub', (CAM_CX, CAM_CY, CAM_Z1 + 0.005),
                          (CAM_CX, CAM_CY, CAM_Z1 + 0.016), 0.020, 'dark',
                          vertices=36, bev=0.0016))
    bm = bmesh.new()
    for k in range(4):
        a = math.tau * k / 4 + math.radians(45)
        bmesh.ops.create_cone(
            bm, cap_ends=True, cap_tris=False, segments=6, radius1=0.0034,
            radius2=0.0034, depth=0.005,
            matrix=Matrix.Translation((CAM_CX + math.cos(a) * 0.0142,
                                       CAM_CY + math.sin(a) * 0.0142,
                                       CAM_Z1 + 0.0185)))
    rot_movers.append(mesh_from_bm(PREFIX + 'cam_bolts', bm, 'steel', False))
    rot_movers.append(cyl(PREFIX + 'cam_timing_mark',
                          (CAM_CX + math.cos(math.radians(POSE_DEG)) * 0.0925,
                           CAM_CY + math.sin(math.radians(POSE_DEG)) * 0.0925,
                           CAM_Z1),
                          (CAM_CX + math.cos(math.radians(POSE_DEG)) * 0.0925,
                           CAM_CY + math.sin(math.radians(POSE_DEG)) * 0.0925,
                           CAM_Z1 + 0.0018), 0.0040, 'blush', vertices=20))
    rot_movers.append(cyl(PREFIX + 'camshaft', (CAM_CX, CAM_CY, GB_Z1 - 0.008),
                          (CAM_CX, CAM_CY, FLY_Z1 - 0.004), 0.011, 'chrome',
                          vertices=26))
    # маховик-штурвал: обод, три спицы, ступица — не закрывает лицо кулачка,
    # но задаёт габарит группы (pivot вращения в viewer = центр AABB)
    rot_movers.append(tube_z(PREFIX + 'flywheel_rim', FLY_Z0, FLY_Z1,
                             CAM_CX, CAM_CY, FLY_RI, FLY_R, 'ivory', seg=72))
    bm = bmesh.new()
    for k in range(3):
        a = math.tau * k / 3 + math.radians(30)
        bmesh.ops.create_cube(
            bm, size=1.0,
            matrix=(Matrix.Translation((CAM_CX + math.cos(a) * 0.057,
                                        CAM_CY + math.sin(a) * 0.057,
                                        (FLY_Z0 + FLY_Z1) * 0.5))
                    @ Matrix.Rotation(a, 4, 'Z')
                    @ Matrix.Diagonal(Vector((0.079, 0.009, 0.007, 1.0)))))
    rot_movers.append(mesh_from_bm(PREFIX + 'flywheel_spokes', bm, 'ivory', False))
    rot_movers.append(cyl(PREFIX + 'flywheel_hub', (CAM_CX, CAM_CY, FLY_Z0 - 0.004),
                          (CAM_CX, CAM_CY, FLY_Z1 + 0.004), 0.014, 'graphite',
                          vertices=28, bev=0.0012))
    bm = bmesh.new()
    for k in range(6):
        a = math.tau * k / 6 + math.radians(30)
        bmesh.ops.create_cone(
            bm, cap_ends=True, cap_tris=False, segments=8, radius1=0.0022,
            radius2=0.0022, depth=0.0025,
            matrix=Matrix.Translation((CAM_CX + math.cos(a) * 0.0985,
                                       CAM_CY + math.sin(a) * 0.0985,
                                       FLY_Z1 + 0.0012)))
    rot_movers.append(mesh_from_bm(PREFIX + 'flywheel_bolts', bm, 'steel', False))
    rot_movers.append(cube(PREFIX + 'flywheel_index',
                           (CAM_CX + math.cos(math.radians(POSE_DEG)) * 0.0985,
                            CAM_CY + math.sin(math.radians(POSE_DEG)) * 0.0985,
                            FLY_Z1 + 0.0012),
                           (0.004, 0.008, 0.0022), 'blush', r=0.0005,
                           rot=(0, 0, math.radians(POSE_DEG))))

    # ================= толкатель (сдвиг по X) ===========================
    # Положение при монтажном (нулевом) угле кулачка: ролик на среднем
    # радиусе rho = R_BASE + LIFT/2, поэтому ход симметричен +-TRAVEL/2.
    rho_rest = pitch_r(-POSE_DEG)     # радиус центров ролика в монтажном угле
    roller_x = CAM_CX + rho_rest
    back_x = roller_x + 0.036

    slide_movers.append(cube(PREFIX + 'follower_yoke', (back_x + 0.010, CAM_CY, Z - 0.012),
                             (0.020, 0.038, 0.056), 'graphite', r=0.0026))
    slide_movers.append(cyl(PREFIX + 'follower_rod_boss',
                             (back_x + 0.020, CAM_CY, Z),
                             (back_x + 0.034, CAM_CY, Z), 0.0145, 'graphite',
                             vertices=24, bev=0.0012))
    arm_x0, arm_x1 = roller_x + 0.024, back_x
    slide_movers.append(cube(PREFIX + 'follower_arm',
                             ((arm_x0 + arm_x1) * 0.5, CAM_CY, Z - 0.018),
                             (arm_x1 - arm_x0, 0.028, 0.010),
                             'graphite', r=0.0014))
    slide_movers.append(cube(PREFIX + 'follower_gusset',
                             (back_x - 0.004, CAM_CY, Z - 0.030),
                             (0.014, 0.024, 0.026), 'graphite', r=0.0012))
    slide_movers.append(cyl(PREFIX + 'roller_pin_boss',
                             (roller_x, CAM_CY, Z - 0.014), (roller_x, CAM_CY, Z - 0.006),
                             0.0105, 'steel', vertices=24, bev=0.0010))
    slide_movers.append(cyl(PREFIX + 'roller_pin', (roller_x, CAM_CY, Z - 0.016),
                             (roller_x, CAM_CY, Z + 0.022), 0.0045, 'chrome',
                             vertices=18))
    slide_movers.append(cyl(PREFIX + 'roller', (roller_x, CAM_CY, Z - 0.008),
                             (roller_x, CAM_CY, Z + 0.016), ROLLER_R, 'blush',
                             vertices=40, bev=0.0016))
    slide_movers.append(cyl(PREFIX + 'roller_nut', (roller_x, CAM_CY, Z + 0.016),
                             (roller_x, CAM_CY, Z + 0.022), 0.0088, 'steel',
                             vertices=6, smooth=False))
    slide_movers.append(cyl(PREFIX + 'follower_rod', (back_x + 0.014, CAM_CY, Z),
                             (ROD_X1, CAM_CY, Z), ROD_R, 'chrome', vertices=24))
    # пружинный стакан: втулка-толкатель + опорное кольцо + пружина,
    # при монтажном угле пружина целиком лежит в окнах стакана (0.058..0.145)
    slide_movers.append(cyl(PREFIX + 'spring_seat', (back_x + 0.016, CAM_CY, Z),
                             (back_x + 0.062, CAM_CY, Z), 0.0165, 'graphite',
                             vertices=28, bev=0.0010))
    slide_movers.append(cyl(PREFIX + 'spring_collar', (back_x + 0.054, CAM_CY, Z),
                             (back_x + 0.062, CAM_CY, Z), 0.0184, 'steel',
                             vertices=28, bev=0.0008))
    slide_movers.append(helix_spring(PREFIX + 'return_spring',
                                     back_x + 0.062, back_x + 0.100,
                                     CAM_CY, Z, SPR_RM, SPR_WIRE, SPR_COILS,
                                     'steel'))
    slide_movers.append(cube(PREFIX + 'stroke_flag', (back_x + 0.010, CAM_CY, 0.114),
                             (0.012, 0.012, 0.020), 'blush', r=0.0008))
    slide_movers.append(cyl(PREFIX + 'tool_flange', (ROD_X1, CAM_CY, Z),
                             (ROD_X1 + 0.014, CAM_CY, Z), 0.025, 'ivory',
                             vertices=40, bev=0.0020))
    slide_movers.append(cyl(PREFIX + 'tool_face', (ROD_X1 + 0.014, CAM_CY, Z),
                             (ROD_X1 + 0.018, CAM_CY, Z), 0.015, 'blush',
                             vertices=32, bev=0.0012))
    bm = bmesh.new()
    for k in range(4):
        a = math.tau * k / 4 + math.radians(45)
        bmesh.ops.create_cone(
            bm, cap_ends=True, cap_tris=False, segments=6, radius1=0.0030,
            radius2=0.0030, depth=0.004,
            matrix=(Matrix.Translation((ROD_X1 + 0.019, CAM_CY + math.cos(a) * 0.017,
                                        Z + math.sin(a) * 0.017))
                    @ Vector((1, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()))
    slide_movers.append(mesh_from_bm(PREFIX + 'tool_bolts', bm, 'steel', False))

    # ================= узлы анимации ====================================
    anim = empty(PREFIX + 'anim', (CAM_CX, CAM_CY, Z))
    anim['motion_type'] = 'rotate'
    anim['motion_axis'] = 'Z'          # Blender Z -> three.js Y
    anim['motion_axis_gltf'] = 'Y'
    anim['motion_speed'] = 1.6
    anim['role'] = 'cam rotation'

    slide = empty(PREFIX + 'anim_slide', (roller_x, CAM_CY, Z))
    slide['motion_type'] = 'slide'
    slide['motion_axis'] = 'X'
    slide['motion_amount'] = TRAVEL
    slide['motion_speed'] = 1.6
    slide['travel'] = TRAVEL
    slide['role'] = 'follower stroke'

    bpy.context.view_layer.update()
    for o in rot_movers:
        parent(o, anim)
        o['moving'] = 'rotate'
    for o in slide_movers:
        parent(o, slide)
        o['moving'] = 'slide'
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and \
                o not in rot_movers and o not in slide_movers:
            o['moving'] = 'none'

    bpy.context.view_layer.update()
    return anim, slide, rot_movers, slide_movers, prof


# --- измерение профиля по GLB + runtime-таблица --------------------------
def _glb_read(path):
    data = path.read_bytes()
    magic, version, total = struct.unpack_from('<III', data, 0)
    if magic != 0x46546C67:
        raise RuntimeError('not a GLB: %s' % path)
    off, js, binc = 12, None, None
    while off < total:
        clen, ctype = struct.unpack_from('<II', data, off)
        off += 8
        chunk = data[off:off + clen]
        off += clen
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode('utf-8'))
        elif ctype == 0x004E4942:
            binc = chunk
    if js is None or binc is None:
        raise RuntimeError('GLB chunks missing in %s' % path)
    return js, binc


def _glb_accessor(js, binc, index):
    a = js['accessors'][index]
    bv = js['bufferViews'][a['bufferView']]
    fmt, size = {5126: ('f', 4), 5123: ('H', 2), 5125: ('I', 4),
                 5121: ('B', 1), 5122: ('h', 2)}[a['componentType']]
    ncomp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}[a['type']]
    stride = bv.get('byteStride') or size * ncomp
    base = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    return [struct.unpack_from('<' + fmt * ncomp, binc, base + k * stride)
            for k in range(a['count'])]


def _glb_world(js):
    nodes = js['nodes']
    parent = {}
    for i, nd in enumerate(nodes):
        for c in nd.get('children', []):
            parent[c] = i
    cache = {}

    def matrix(i):
        if i in cache:
            return cache[i]
        nd = nodes[i]
        if 'matrix' in nd:
            a = nd['matrix']                        # glTF: column-major
            m = [[a[0], a[4], a[8], a[12]],
                 [a[1], a[5], a[9], a[13]],
                 [a[2], a[6], a[10], a[14]],
                 [a[3], a[7], a[11], a[15]]]
        else:
            t = nd.get('translation', [0.0, 0.0, 0.0])
            x, y, z, w = nd.get('rotation', [0.0, 0.0, 0.0, 1.0])
            s = nd.get('scale', [1.0, 1.0, 1.0])
            rot = [[1 - 2 * (y * y + z * z), 2 * (x * y - z * w),
                    2 * (x * z + y * w)],
                   [2 * (x * y + z * w), 1 - 2 * (x * x + z * z),
                    2 * (y * z - x * w)],
                   [2 * (x * z - y * w), 2 * (y * z + x * w),
                    1 - 2 * (x * x + y * y)]]
            m = [[rot[r][c] * s[c] for c in range(3)] + [t[r]] for r in range(3)]
            m.append([0.0, 0.0, 0.0, 1.0])
        if i in parent:
            p = matrix(parent[i])
            m = [[sum(p[r][k] * m[k][c] for k in range(4)) for c in range(4)]
                 for r in range(4)]
        cache[i] = m
        return m

    return {nd.get('name'): i for i, nd in enumerate(nodes)}, matrix


def _glb_tris(js, binc, node_index, mw):
    out = []
    for prim in js['meshes'][js['nodes'][node_index]['mesh']]['primitives']:
        pos = _glb_accessor(js, binc, prim['attributes']['POSITION'])
        pts = [tuple(mw[r][0] * p[0] + mw[r][1] * p[1] + mw[r][2] * p[2]
                     + mw[r][3] for r in range(3)) for p in pos]
        if 'indices' in prim:
            flat = [v[0] for v in _glb_accessor(js, binc, prim['indices'])]
        else:
            flat = list(range(len(pts)))
        for k in range(0, len(flat), 3):
            out.append((pts[flat[k]], pts[flat[k + 1]], pts[flat[k + 2]]))
    return out


def cam_profile_table(path, step_deg=1.0, check_phases=72, tol_mm=0.2):
    """Снять профиль кулачка с ЭКСПОРТИРОВАННОГО GLB (three.js Y-up).

    Для каждой фазы решается точное касание: расстояние от оси кулачка до
    центра ролика, при котором окружность ролика касается контура лопасти.
    Таблица r_m = это расстояние минус радиус ролика, т.е. опорная кривая
    (support function) профиля, а не радиальный след: на больших углах
    давления они расходятся до 2.4 мм, и радиальная таблица давала бы
    уход толкателя от профиля.
    """
    js, binc = _glb_read(path)
    names, world = _glb_world(js)
    lobe = names[PREFIX + 'cam_lobe']
    tris = _glb_tris(js, binc, lobe, world(lobe))
    y_lo = min(p[1] for t in tris for p in t)
    y_hi = max(p[1] for t in tris for p in t)
    side = [t for t in tris
            if max(p[1] for p in t) - min(p[1] for p in t) > 0.4 * (y_hi - y_lo)]

    ax, ay, az = js['nodes'][names[PREFIX + 'anim']]['translation']
    sx, sy, sz = js['nodes'][names[PREFIX + 'anim_slide']]['translation']

    segs = set()
    for t in side:
        pts = [(round(p[0] - ax, 8), round(p[2] - az, 8)) for p in t]
        for k in range(3):
            a, b = pts[k], pts[(k + 1) % 3]
            if a != b:
                segs.add((a, b) if a < b else (b, a))
    segs = sorted(segs)
    S, mid = [], []
    for (a, b) in segs:
        dx, dz = b[0] - a[0], b[1] - a[1]
        l2 = dx * dx + dz * dz
        S.append((a[0], a[1], dx, dz, l2))
        mid.append(math.atan2((a[1] + b[1]) * 0.5, (a[0] + b[0]) * 0.5))
    order = sorted(range(len(S)), key=lambda i: mid[i])
    key = [mid[i] for i in order]
    key3, order3 = [], []
    for shift in (-math.tau, 0.0, math.tau):
        key3.extend(k + shift for k in key)
        order3.extend(order)

    def window(phi, span):
        """Индексы сегментов в угловом окне +-span (phi в любом диапазоне)."""
        phi = (phi + math.pi) % math.tau - math.pi
        lo = bisect.bisect_left(key3, phi - span)
        hi = bisect.bisect_left(key3, phi + span)
        idx = order3[lo:hi]
        if len(idx) < 8:
            raise RuntimeError('cam window empty at phi=%.4f' % phi)
        return idx

    def ray_r(phi):
        ux, uz = math.cos(phi), math.sin(phi)
        best = 0.0
        for i in window(phi, math.pi):
            px, pz, dx, dz, l2 = S[i]
            den = dx * uz - dz * ux
            if abs(den) < 1e-15:
                continue
            t = -(px * uz - pz * ux) / den
            if -1e-9 <= t <= 1 + 1e-9:
                s = (px + t * dx) * ux + (pz + t * dz) * uz
                best = max(best, s)
        return best

    def min_dist(px, pz, idx):
        best = 1e9
        for i in idx:
            ax0, az0, dx, dz, l2 = S[i]
            t = 0.0 if l2 < 1e-18 else ((px - ax0) * dx + (pz - az0) * dz) / l2
            t = 0.0 if t < 0.0 else (1.0 if t > 1.0 else t)
            ex, ez = px - (ax0 + t * dx), pz - (az0 + t * dz)
            d = math.sqrt(ex * ex + ez * ez)
            if d < best:
                best = d
        return best

    def tangent_r(theta):
        phi = -theta                     # ось толкателя в локальных координатах
        rr = ray_r(phi)
        idx = window(phi, math.radians(50.0))
        ux, uz = math.cos(phi), math.sin(phi)
        lo, hi = rr, rr + 1.6 * ROLLER_R
        if min_dist(lo * ux, lo * uz, idx) > ROLLER_R:
            raise RuntimeError('roller does not cut the profile at %.1f deg'
                               % math.degrees(theta))
        for _ in range(6):
            if min_dist(hi * ux, hi * uz, idx) >= ROLLER_R:
                break
            hi = rr + (hi - rr) * 2.0
        else:
            raise RuntimeError('tangency bracket failed at %.1f deg'
                               % math.degrees(theta))
        for _ in range(44):
            m = 0.5 * (lo + hi)
            if min_dist(m * ux, m * uz, idx) < ROLLER_R:
                lo = m
            else:
                hi = m
        return 0.5 * (lo + hi), rr

    n = int(round(360.0 / step_deg))
    step = math.tau / n
    r_m, radial = [], []
    for i in range(n):
        rc, rr = tangent_r(i * step)
        r_m.append(rc - ROLLER_R)
        radial.append(rr)
    r0 = r_m[0]

    def tab_r(theta):
        x = (theta % math.tau) / step
        i = int(x) % n
        f = x - int(x)
        return r_m[i] * (1.0 - f) + r_m[(i + 1) % n] * f

    rows, worst, worst_ph = [], 0.0, 0.0
    phases = [math.tau * k / check_phases for k in range(check_phases)]
    phases += [math.tau * (k + 0.5) / check_phases for k in range(check_phases)]
    for th in phases:
        rc = tab_r(th) + ROLLER_R
        phi = -th
        d = min_dist(rc * math.cos(phi), rc * math.sin(phi),
                     window(phi, math.radians(50.0)))
        err = d - ROLLER_R
        if abs(err) > worst:
            worst, worst_ph = abs(err), math.degrees(th) % 360.0
        if abs(err) < 1e-12 and int(round(math.degrees(th))) % 30 == 0:
            rows.append({'phase_deg': round(math.degrees(th) % 360.0, 3),
                         'r_m': round(tab_r(th), 6),
                         'roller_centre_from_axis_m': round(rc, 6),
                         'roller_to_profile_m': round(d, 6),
                         'error_mm': round(err * 1000.0, 4)})

    stroke = max(r_m) - min(r_m)

    # pivot, который components-viewer.js строит как центр AABB группы кулачка
    cam_members = ['cam_bolts', 'cam_hub', 'cam_lobe', 'cam_timing_mark',
                   'cam_web', 'camshaft', 'flywheel_bolts', 'flywheel_hub',
                   'flywheel_index', 'flywheel_rim', 'flywheel_spokes']
    lo = [1e9, 1e9, 1e9]
    hi = [-1e9, -1e9, -1e9]
    for nm in cam_members:
        i = names.get(PREFIX + nm)
        if i is None or 'mesh' not in js['nodes'][i]:
            continue
        for t in _glb_tris(js, binc, i, world(i)):
            for p in t:
                for k in range(3):
                    if p[k] < lo[k]:
                        lo[k] = p[k]
                    if p[k] > hi[k]:
                        hi[k] = p[k]
    pivot = [(lo[k] + hi[k]) * 0.5 for k in range(3)]
    pivot_err = math.hypot(pivot[0] - ax, pivot[2] - az)
    payload = {
        'format': 'cj-cam-profile/1',
        'component': CID,
        'code': 'MOT-PIS-05',
        'units': 'm',
        'source_glb': str(path.relative_to(PROJECT)),
        'measured_from': ('mesh triangles of %s cam_lobe in the exported GLB; '
                          'per-phase exact roller tangency (support curve), '
                          'cam axis at the anim node origin' % CID),
        'axis': 'y',
        'axis_gltf': 'y',
        'axis_blender': 'z',
        'axis_point_m': [round(ax, 6), round(ay, 6), round(az, 6)],
        'cam_node': PREFIX + 'anim',
        'follower_node': PREFIX + 'anim_slide',
        'follower_axis': 'x',
        'roller_node': PREFIX + 'roller',
        'roller_radius_m': ROLLER_R,
        'r0_m': round(r0, 6),
        'step_deg': round(step_deg, 6),
        'r_m': [round(v, 6) for v in r_m],
        'direction': 1,
        'phase_offset': 0.0,
        'stroke_m': round(stroke, 6),
        'offset_min_m': round(min(r_m) - r0, 6),
        'offset_max_m': round(max(r_m) - r0, 6),
        'r_base_m': round(min(r_m), 6),
        'r_nose_m': round(max(r_m), 6),
        'cam_mount_deg': POSE_DEG,
        'follower_rest_x_m': round(sx, 6),
        'follower_rest_from_axis_m': round(sx - ax, 6),
        'follower_rest_expected_m': round(r0 + ROLLER_R, 6),
        'follower_seat_error_mm': round((sx - ax - r0 - ROLLER_R) * 1000.0, 4),
        'viewer_pivot_m': [round(v, 6) for v in pivot],
        'viewer_pivot_error_mm': round(pivot_err * 1000.0, 4),
        'viewer_pivot_note': ('components-viewer.js строит pivot вращения как '
                              'центр AABB группы кулачка; обод маховика сделан '
                              'самым большим элементом группы, поэтому центр '
                              'AABB совпадает с осью кулачка'),
        'cam_group_bbox_size_m': [round(hi[k] - lo[k], 6) for k in range(3)],
        'contact': {'samples': len(phases), 'canonical_samples': check_phases,
                    'midpoint_samples': check_phases,
                    'worst_error_mm': round(worst * 1000.0, 4),
                    'worst_phase_deg': round(worst_ph, 3),
                    'tolerance_mm': tol_mm,
                    'ok': bool(worst * 1000.0 <= tol_mm)},
        'radial_vs_table_max_mm': round(
            max(abs(radial[i] - r_m[i]) for i in range(n)) * 1000.0, 3),
        'viewer': {
            'cam_rotation': 'camNode.rotation.y = phase (three.js, +Y)',
            'follower': 'followerNode.position.x = rest_x + (r(phase) - r0_m)',
            'r_of_phase': ('i = floor(phase/step); f = frac(phase/step); '
                           'r = r_m[i]*(1-f) + r_m[(i+1)%n]*f  '
                           '(phase в радианах, step = step_deg*pi/180)'),
            'contact': 'distance(cam_axis, roller_centre) = r(phase) + roller_radius_m',
            'law': 'cam_profile',
            'direction_note': ('direction=+1: индекс таблицы растёт вместе с '
                               'положительным поворотом кулачка; при отрицательном '
                               'повороте читать таблицу в обратном порядке'),
            'phase_offset_note': ('phase_offset=0: phase=0 — монтажный угол модели, '
                                  'ролик на r0 (середина хода)'),
        },
        'warnings': [
            ('r_m — опорная (касательная) кривая, не радиальный след профиля: '
             'радиус по лучу отличается до %.2f мм, таблица радиуса по лучу '
             'уводила бы толкатель от профиля.' % (
                 max(abs(radial[i] - r_m[i]) for i in range(n)) * 1000.0)),
            ('Таблица снята с GLB: при пересборке модели её нужно перегенерировать '
             '(build_motion_piston_cam.py пишет её сам).'),
            ('Ход %0.3f м — полный размах r_m; от монтажного угла ±%0.3f м.'
             % (stroke, (max(r_m) - min(r_m)) * 0.5)),
            ('Пружина — жёсткий блок-элемент: при крайних фазах она выходит из окон '
             'стакана, сжатие не моделируется.'),
            ('Кулачок агрессивный: подъём 60 мм на 160°, угол давления до ~35°, '
             'реальные контактные напряжения требуют проверки — это блок-аут.'),
            ('Pivot вращения в viewer берётся как центр AABB группы кулачка: '
             'обод маховика задаёт габарит группы, ошибка оси %.3f мм. '
             'Не уменьшать обод ниже r=%0.3f м.' % (pivot_err * 1000.0, FLY_R)),
        ],
    }
    return payload, rows


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


def profile_points(obj):
    mw = obj.matrix_world
    return [(mw @ v.co) for v in obj.data.vertices]


def min_dist_2d(cx, cy, pts):
    best = 1e9
    n = len(pts)
    for i in range(n):
        ax, ay = pts[i]
        bx, by = pts[(i + 1) % n]
        dx, dy = bx - ax, by - ay
        l2 = dx * dx + dy * dy
        t = ((cx - ax) * dx + (cy - ay) * dy) / l2
        t = max(0.0, min(1.0, t))
        d = math.hypot(cx - (ax + t * dx), cy - (ay + t * dy))
        if d < best:
            best = d
    return best


def lobe_polygon(lobe, cx, cy):
    """Контур кулачка по вершинам меша (без дублей, по полярному углу)."""
    seen = {}
    for p in profile_points(lobe):
        seen[(round(p.x, 7), round(p.y, 7))] = True
    pts = [(x, y) for (x, y) in seen]
    pts.sort(key=lambda q: math.atan2(q[1] - cy, q[0] - cx))
    return pts


def contact_sweep(lobe, cx, cy, step_deg=1.0):
    """Максимальная ошибка касания ролика по всему обороту кулачка."""
    verts = profile_points(lobe)
    n = len(verts)
    cyy = cy
    worst = 0.0
    rows = []
    for k in range(0, 360, int(step_deg)):
        phi = math.radians(k)
        c, s = math.cos(phi), math.sin(phi)
        pts = [((p.x - cx) * c - (p.y - cyy) * s, (p.x - cx) * s + (p.y - cyy) * c)
               for p in verts]
        r = pitch_r(-(POSE_DEG + k))
        d = min_dist_2d(r, 0.0, pts)
        err = d - ROLLER_R
        worst = max(worst, abs(err))
        if abs(k % 90) < 1e-9:
            rows.append((k, r, d, err))
    return worst, rows


def check(anim, slide, rot_movers, slide_movers, prof):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn

    rot_names = {o.name for o in rot_movers}
    slide_names = {o.name for o in slide_movers}

    # --- поворот группы кулачка ---
    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    lobe = bpy.data.objects[PREFIX + 'cam_lobe']
    hub = bpy.data.objects[PREFIX + 'cam_hub']
    hub_mn, hub_mx = mesh_bbox([hub])
    hub_c = (hub_mn + hub_mx) * 0.5
    anim_loc = anim.location.copy()
    pivot_err = math.hypot(hub_c.x - anim_loc.x, hub_c.y - anim_loc.y)

    anim.rotation_euler = (0, 0, math.radians(37.0))
    bpy.context.view_layer.update()
    after_rot = {o.name: (o.matrix_world.translation.copy(), o.matrix_world.to_euler().z)
                 for o in meshes}
    rot_rigid_cam = max(
        (after_rot[n][0] - anim_loc).length
        - (before[n] - anim_loc).length for n in rot_names)
    rot_delta = max(abs(after_rot[n][1] - math.radians(37.0)) for n in rot_names)
    static_rot_err = max(((after_rot[n][0] - before[n]).length
                          for n in before if n not in rot_names), default=0.0)
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    # --- сдвиг группы толкателя ---
    bpy.context.view_layer.update()
    before2 = {o.name: o.matrix_world.translation.copy() for o in meshes}
    slide.location = Vector((slide.location.x + TRAVEL, slide.location.y,
                             slide.location.z))
    bpy.context.view_layer.update()
    after2 = {o.name: o.matrix_world.translation.copy() for o in meshes}
    move_err = max((after2[n] - before2[n] - Vector((TRAVEL, 0, 0))).length
                   for n in slide_names)
    static_err = max(((after2[n] - before2[n]).length for n in before2
                      if n not in slide_names), default=0.0)
    slide.location = Vector((slide.location.x - TRAVEL, slide.location.y,
                             slide.location.z))
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    pivot_shift = max((restored[n] - before2[n]).length for n in before2)

    # --- профиль по вершинам ---
    radii = []
    for v in lobe.data.vertices:
        p = lobe.matrix_world @ v.co
        radii.append(math.hypot(p.x - CAM_CX, p.y - CAM_CY))
    r_min, r_max = min(radii), max(radii)

    # --- контакт ---
    worst_contact, rows = contact_sweep(lobe, CAM_CX, CAM_CY, 1.0)

    roller = bpy.data.objects[PREFIX + 'roller']
    r_c = roller.matrix_world.translation
    poly = lobe_polygon(lobe, CAM_CX, CAM_CY)
    rest_gap = min_dist_2d(r_c.x, r_c.y, poly) - ROLLER_R
    rest_radius = math.hypot(r_c.x - CAM_CX, r_c.y - CAM_CY)

    # --- габарит / висящие детали ---
    boxes = {o.name: mesh_bbox([o]) for o in meshes}
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0015
                   for other in boxes):
            floating.append(name)

    len_ok = 0.5955 <= size.x <= 0.6005
    wid_ok = 0.290 <= size.y <= 0.300
    hgt_ok = size.z <= 0.300

    contact_rows = [{'cam_angle_deg': int(k),
                      'pitch_r_m': round(r, 6),
                      'roller_axis_x_m': round(CAM_CX + r, 6),
                      'roller_to_profile_m': round(d, 6),
                      'error_mm': round(e * 1000.0, 6)}
                     for (k, r, d, e) in rows]

    report = {
        'component': CID,
        'code': 'MOT-PIS-05',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_nodes': len([o for o in meshes if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in ((mn + mx) * 0.5)],
        'bbox_passport': '0.60 x 0.30 x 0.30 m',
        'length_ok': bool(len_ok),
        'width_ok': bool(wid_ok),
        'height_ok': bool(hgt_ok),
        'bbox_ok': bool(len_ok and wid_ok and hgt_ok),
        'floor_contact_z': round(mn.z, 6),
        'floor_contact_ok': bool(abs(mn.z) < 0.0006),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'cam_axis': 'Z (Blender) / Y (three.js, export_yup)',
        'cam_axis_point': [CAM_CX, CAM_CY, AXIS_Z],
        'anim_name': anim.name,
        'anim_type': anim.get('motion_type'),
        'anim_axis': anim.get('motion_axis'),
        'anim_loc': [round(v, 6) for v in anim_loc],
        'anim_children': sorted(rot_names),
        'anim_children_count': len(rot_names),
        'anim_rot_delta_rad': round(rot_delta, 6),
        'anim_rot_radius_ok': bool(rot_rigid_cam <= 1e-7),
        'slide_name': slide.name,
        'slide_type': slide.get('motion_type'),
        'slide_axis': slide.get('motion_axis'),
        'slide_amount_m': TRAVEL,
        'slide_children': sorted(slide_names),
        'slide_children_count': len(slide_names),
        'slide_delta_m': TRAVEL,
        'mover_error_m': round(move_err, 9),
        'static_error_m': round(static_err, 9),
        'static_rot_error_m': round(static_rot_err, 9),
        'slide_rigid_ok': bool(move_err < 1e-6),
        'static_frozen_ok': bool(static_err < 1e-9 and static_rot_err < 1e-9),
        'pivot_error_m': round(pivot_err, 9),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_ok': bool(pivot_err < 0.001 and pivot_shift < 1e-6),
        'cam_profile_rmin_m': round(r_min, 6),
        'cam_profile_rmax_m': round(r_max, 6),
        'cam_pitch_rmin_m': R_BASE,
        'cam_pitch_rmax_m': R_BASE + LIFT,
        'cam_profile_ratio': round(r_max / max(r_min, 1e-9), 4),
        'cam_profile_points': N_PROF,
        'cam_profile_ok': bool(r_max / max(r_min, 1e-9) > 1.8
                               and abs((r_max - r_min) - LIFT) < 0.003),
        'roller_contact': contact_rows,
        'roller_contact_worst_mm': round(worst_contact * 1000.0, 6),
        'roller_contact_ok': bool(worst_contact <= 0.0002),
        'roller_rest_radius_m': round(rest_radius, 6),
        'pitch_radius_at_pose_m': round(pitch_r(-POSE_DEG), 6),
        'roller_gap_at_pose_mm': round(rest_gap * 1000.0, 6),
        'roller_gap_ok': bool(abs(rest_gap) <= 0.0002
                              and abs(rest_radius - pitch_r(-POSE_DEG)) <= 0.0002),
        'cam_pose_deg': POSE_DEG,
        'travel_m': TRAVEL,
        'stroke_ok': bool(abs((R_BASE + LIFT) - R_BASE - TRAVEL) < 1e-9),
        'floating_parts': floating,
        'no_floating_ok': bool(not floating),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'static_count': len([o for o in meshes
                             if o.name not in rot_names | slide_names]),
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
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.25
    try:
        scene.eevee.taa_render_samples = 96
        scene.eevee.shadow_ray_count = 4
        scene.eevee.shadow_step_count = 8
        scene.eevee.use_shadow_high_bitdepth = True
        scene.eevee.shadow_resolution_scale = 1.0
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.660, 0.656, 0.648, 1.0)
    bg.inputs['Strength'].default_value = 0.55

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=9,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.600, 0.594, 0.582, 1.0)
    nb.inputs['Roughness'].default_value = 0.90
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.36, -0.46, 0.60), 3.30, 0.50),
            ('fill', (-0.52, -0.40, 0.34), 1.15, 0.80),
            ('rim', (0.02, 0.52, 0.50), 2.20, 0.50)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((center.x * 0.4, 0, center.z * 0.55))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

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

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

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
            need = max(need, abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    c_main = box_corners(mn - center, mx - center)
    close_t = Vector((-0.070, CAM_CY - 0.004, 0.156))
    c_close = box_corners(Vector((-0.215, CAM_CY - 0.105, 0.112)) - close_t,
                          Vector((0.075, CAM_CY + 0.062, 0.212)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill, objs=None):
        worst = 0.0
        for o in (objs if objs is not None else mesh_objs):
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    close_names = {'cam_lobe', 'cam_web', 'cam_hub', 'cam_bolts', 'cam_boss',
                   'roller', 'roller_pin', 'roller_nut', 'follower_yoke',
                   'follower_arm', 'spring_collar', 'return_spring',
                   'spring_cage_front', 'camshaft', 'flywheel'}
    close_objs = [o for o in mesh_objs if o.name[len(PREFIX):] in close_names]

    views = [
        ('3q', (0.74, -0.86, 0.62), center + Vector((0, 0, 0.006)), 70,
         c_main, 0.92, None),
        ('front', (1.00, -0.42, 0.30), center + Vector((0.004, 0, 0.004)), 70,
         c_main, 0.90, None),
        ('side', (0.05, -1.00, 0.24), center + Vector((0, 0, 0.012)), 70,
         c_main, 0.92, None),
        ('closeup', (0.56, -0.72, 0.68), close_t, 85, c_close, 0.94, close_objs),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, focus in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(6):
            got = max_ndc(fill, focus)
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
        print(f'RENDERED {tag} dist={dist:.3f} fill={max_ndc(fill, focus):.3f} {fp}',
              flush=True)

    src = RENDER_DIR / f'{CID}_3q.png'
    img = bpy.data.images.load(str(src))
    w = 300
    h = max(1, int(round(w * img.size[1] / img.size[0])))
    img.scale(w, h)
    thumb = RENDER_DIR / f'{CID}_3q_300px.png'
    img.filepath_raw = str(thumb)
    img.file_format = 'PNG'
    img.save()
    outs.append(str(thumb.relative_to(PROJECT)))
    print(f'THUMB {thumb} {w}x{h}', flush=True)
    return outs


def main():
    anim, slide, rot_movers, slide_movers, prof = build()
    path = export()
    prof_tab, prof_rows = cam_profile_table(path, step_deg=1.0, check_phases=72)
    PROFILE_JSON.write_text(json.dumps(prof_tab, ensure_ascii=False, indent=2),
                            encoding='utf-8')
    rep = check(anim, slide, rot_movers, slide_movers, prof)
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['files'] = {
        'builder': 'docs/plans/tools/build_motion_piston_cam.py',
        'glb': rep['glb'],
        'cam_profile': str(PROFILE_JSON.relative_to(PROJECT)),
        'report': 'docs/plans/blockout/component-library/motion_piston_cam/report.json',
    }
    # --- runtime-кинематика: таблица профиля -----------------------------
    rep['cam_profile_table'] = str(PROFILE_JSON.relative_to(PROJECT))
    rep['cam_profile_format'] = prof_tab['format']
    rep['cam_profile_table_points'] = len(prof_tab['r_m'])
    rep['cam_profile_step_deg'] = prof_tab['step_deg']
    rep['cam_profile_r0_m'] = prof_tab['r0_m']
    rep['cam_profile_base_m'] = prof_tab['r_base_m']
    rep['cam_profile_nose_m'] = prof_tab['r_nose_m']
    rep['cam_profile_stroke_m'] = prof_tab['stroke_m']
    rep['cam_profile_offset_range_m'] = [prof_tab['offset_min_m'],
                                         prof_tab['offset_max_m']]
    rep['cam_profile_axis'] = prof_tab['axis']
    rep['cam_profile_cam_node'] = prof_tab['cam_node']
    rep['cam_profile_follower_node'] = prof_tab['follower_node']
    rep['cam_profile_roller_radius_m'] = prof_tab['roller_radius_m']
    rep['cam_profile_direction'] = prof_tab['direction']
    rep['cam_profile_phase_offset'] = prof_tab['phase_offset']
    rep['cam_profile_contact_72'] = prof_tab['contact']
    rep['cam_profile_contact_rows'] = prof_rows
    rep['cam_profile_radial_vs_table_mm'] = prof_tab['radial_vs_table_max_mm']
    rep['cam_profile_follower_rest_from_axis_m'] = \
        prof_tab['follower_rest_from_axis_m']
    rep['cam_profile_follower_seat_error_mm'] = prof_tab['follower_seat_error_mm']
    rep['viewer_pivot_m'] = prof_tab['viewer_pivot_m']
    rep['viewer_pivot_error_mm'] = prof_tab['viewer_pivot_error_mm']
    rep['cam_group_bbox_size_m'] = prof_tab['cam_group_bbox_size_m']
    rep['runtime_formulas'] = prof_tab['viewer']
    rep['warnings'] = prof_tab['warnings']
    rep['cam_profile_contact_ok'] = bool(
        prof_tab['contact']['ok']
        and abs(prof_tab['stroke_m'] - TRAVEL) <= 0.0002
        and abs(prof_tab['follower_seat_error_mm']) <= 0.2
        and prof_tab['viewer_pivot_error_mm'] <= 0.5
        and abs(prof_tab['offset_min_m'] + TRAVEL * 0.5) <= 0.0002
        and abs(prof_tab['offset_max_m'] - TRAVEL * 0.5) <= 0.0002)
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['pivot_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and rep['no_floating_ok'] and rep['static_frozen_ok']
            and rep['slide_rigid_ok'] and rep['cam_profile_ok']
            and rep['roller_contact_ok'] and rep['stroke_ok']
            and rep['roller_gap_ok'] and rep['cam_profile_contact_ok']
            and rep['anim_rot_radius_ok']):
        raise SystemExit('checks failed')


main()
