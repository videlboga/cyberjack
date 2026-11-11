"""Standalone builder + renderer: work_rotary_disc (WRK-ROT-01, «Ротационный диск»).

Ротационный рабочий диск Ø0,28 м: мягкий силиконовый ротор с 8 лепестками и
текстурой, стоящий ВЕРТИКАЛЬНО в открытой молочной рамке; центральная ступица,
горизонтальный шпиндель, подшипниковая ступица-барабан, соосный мотор с
охлаждающими рёбрами, пьедестал, быстросъёмный фиксатор рамки, метка вращения
и шильдик. Плиты-основания нет.

Геометрия совпадает с Mk-I `work_rotary.glb` (legacyId): там soft_rotor —
вертикальный диск 304 × 304 × 51 мм, 12 лепестков, рамка с боковинами,
привод за диском. Здесь тот же архетип в Ø280.

Ось вращения — ГОРИЗОНТАЛЬНАЯ, перпендикулярно плоскости диска.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_rotary_disc.py

Выход:
  public/models/machine-modules/components/work_rotary_disc.glb
  docs/plans/blockout/component-library/work_rotary_disc/*.png + report.json

Геометрия (Blender Z-up, метры):
  ось вращения    = Y (после export_yup -> Z в three.js, spin Z 1.25 рад/с)
  плоскость диска = XZ, фронт диска = -Y
  anim-пустышка    = (0, 0, 0.1850) — в центре диска, на горизонтальной оси
  вращаются: soft_rotor, soft_lobes, lobe_ribs, rotor_ridges, hub,
             hub_cap, shaft, rotation_mark, rotation_dot
  статичны:  base_foot, base_seam, base_trim, bearing_column,
             bearing_housing, bearing_bolts, motor_body, motor_fins,
             motor_band, motor_head, motor_cable, motor_connector,
             guard_ring, guard_arms, qr_body, qr_pin, qr_spring, qr_knob,
             spec_plate, spec_text, led
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
SHOTS = PROJECT / 'docs/plans/blockout/component-library/work_rotary_disc'
CID = 'work_rotary_disc'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
ZC = 0.1850                # высота центра диска над полом
R_DISC = 0.1000            # тело ротора (Ø0,20)
N_LOBES = 8
R_LOBE_C = 0.0920          # центр лепестка
R_LOBE_A = 0.0340          # радиальный полуразмер -> вылет 0.1260 (Ø0,252)
R_LOBE_T = 0.0380          # тангенциальный полуразмер
LOBE_HY = 0.0245           # полуширина лепестка вдоль оси
A_LOBE0 = 22.5

WHEEL_F = -0.0205          # передняя плоскость ротора (y)
WHEEL_B = 0.0205           # задняя плоскость ротора (y)

COL_R, COL_Y = 0.0450, 0.0960      # стойка-столб под барабаном
COL_Z0, COL_Z1 = 0.0100, 0.1150

HOUS_Y0, HOUS_Y1 = 0.0300, 0.1300  # подшипниковый барабан за диском
R_HOUS = 0.0850

MOT_Y0, MOT_Y1 = 0.1300, 0.1900    # мотор соосно за барабаном
R_MOT = 0.0560

RING_R, RING_MINOR, RING_Y = 0.1365, 0.0045, -0.0040   # рамка Ø0,282

BASE_RX, BASE_RY, BASE_CY = 0.0850, 0.1150, 0.0750
BASE_Z = 0.0130

GUARD_ANGLES = (40.0, 160.0, 320.0)
A_QR = 320.0

PALETTE = {
    'body': (0.895, 0.882, 0.852),
    'ivory': (0.972, 0.966, 0.950),
    'steel': (0.560, 0.572, 0.562),
    'graphite': (0.255, 0.263, 0.278),
    'dark': (0.132, 0.137, 0.150),
    'blush': (0.855, 0.618, 0.658),
    'pale': (0.940, 0.795, 0.822),
    'cyan': (0.560, 0.850, 0.900),
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
    bsdf.inputs['Roughness'].default_value = 0.60
    bsdf.inputs['Metallic'].default_value = 0.0
    if role in ('steel', 'graphite'):
        bsdf.inputs['Metallic'].default_value = 0.55
        bsdf.inputs['Roughness'].default_value = 0.38
    if role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.20
        bsdf.inputs['Roughness'].default_value = 0.55
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.6
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=True):
    obj.data.materials.clear()
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = 0.02
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.validate()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


# --- bmesh примитивы ------------------------------------------------------
def bm_cyl(bm, p0, p1, r1, r2=None, segs=32):
    p0, p1 = Vector(p0), Vector(p1)
    d = p1 - p0
    if d.length < 1e-6:
        raise ValueError('zero-length cylinder')
    m = (Matrix.Translation((p0 + p1) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=(r1 if r2 is None else r2),
                          depth=d.length, matrix=m)


def bm_sphere(bm, c, r, segs=24, rings=14):
    m = Matrix.Translation(Vector(c))
    try:
        bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings,
                                  radius=r, matrix=m)
    except TypeError:                                   # старые API
        bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings,
                                  diameter=r, matrix=m)


def bm_box(bm, center, size, frame=None):
    m = (Matrix.Translation(Vector(center))
         @ (frame or Matrix.Identity(4))
         @ Matrix.Diagonal(Vector(size).to_4d()))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_petal(bm, c, radial, axial, tang, angle, segs=28, rings=16):
    """Эллипсоид-лепесток: local X = радиально, Y = вдоль оси диска, Z = тангенциально."""
    m = (Matrix.Translation(Vector(c))
         @ Matrix.Rotation(-angle, 4, 'Y')
         @ Matrix.Diagonal(Vector((radial, axial, tang)).to_4d()))
    try:
        bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings,
                                  radius=1.0, matrix=m)
    except TypeError:
        bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings,
                                  diameter=1.0, matrix=m)


def bm_torus_arc(bm, center, axis, major, minor, a0=0.0, a1=math.tau,
                 tseg=36, sseg=10, closed=True):
    """Тор (или дуга тора) вокруг оси axis; a0=0 -> направление u."""
    C = Vector(center)
    ax = Vector(axis).normalized()
    ref = Vector((0.0, 0.0, 1.0)) if abs(ax.z) < 0.9 else Vector((1.0, 0.0, 0.0))
    u = (ref - ax * ref.dot(ax)).normalized()
    v = ax.cross(u)
    n = tseg if closed else tseg + 1
    rings = []
    for i in range(n):
        t = a0 + (a1 - a0) * (i / tseg)
        rad = math.cos(t) * u + math.sin(t) * v
        ring = []
        for j in range(sseg):
            s = math.tau * j / sseg
            p = C + (major + minor * math.cos(s)) * rad + (minor * math.sin(s)) * ax
            ring.append(bm.verts.new(p))
        rings.append(ring)
    span = n if closed else n - 1
    for i in range(span):
        a_, b_ = rings[i], rings[(i + 1) % n]
        for j in range(sseg):
            k = (j + 1) % sseg
            bm.faces.new((a_[j], b_[j], b_[k], a_[k]))
    if not closed:
        bm.faces.new(tuple(reversed(rings[0])))
        bm.faces.new(tuple(rings[-1]))


def bm_tube(bm, pts, radius, sides=10):
    """Труба постоянного радиуса по полилинии (параллельный перенос)."""
    P = [Vector(p) for p in pts]
    n = len(P)
    tans = []
    for i in range(n):
        if i == 0:
            t = P[1] - P[0]
        elif i == n - 1:
            t = P[-1] - P[-2]
        else:
            t = P[i + 1] - P[i - 1]
        tans.append(t.normalized())
    ref = Vector((0.0, 0.0, 1.0))
    if abs(tans[0].dot(ref)) > 0.95:
        ref = Vector((1.0, 0.0, 0.0))
    u = (ref - tans[0] * ref.dot(tans[0])).normalized()
    rings = []
    for i in range(n):
        if i > 0:
            t0, t1 = tans[i - 1], tans[i]
            ax = t0.cross(t1)
            if ax.length > 1e-8:
                ang = math.atan2(ax.length, t0.dot(t1))
                u = (Matrix.Rotation(ang, 4, ax.normalized()) @ u).normalized()
            u = (u - tans[i] * u.dot(tans[i])).normalized()
        v = tans[i].cross(u)
        ring = [bm.verts.new(P[i] + radius * (math.cos(math.tau * j / sides) * u
                                              + math.sin(math.tau * j / sides) * v))
                for j in range(sides)]
        rings.append(ring)
    for i in range(n - 1):
        a_, b_ = rings[i], rings[i + 1]
        for j in range(sides):
            k = (j + 1) % sides
            bm.faces.new((a_[j], b_[j], b_[k], a_[k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[-1])


def _stitch(bm, rows, segs, close_loop=False):
    pairs = list(zip(rows, rows[1:]))
    if close_loop:
        pairs.append((rows[-1], rows[0]))
    for a, b in pairs:
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for i in range(segs):
                bm.faces.new((a[0], b[i], b[(i + 1) % segs]))
        elif len(b) == 1:
            for i in range(segs):
                bm.faces.new((a[i], a[(i + 1) % segs], b[0]))
        else:
            for i in range(segs):
                j = (i + 1) % segs
                bm.faces.new((a[i], a[j], b[j], b[i]))


def lathe_y(name, profile, role, zc=ZC, segs=64, smooth=True, close=False):
    """Тело вращения вокруг оси Y через (0, *, zc): профиль [(r, y), ...]."""
    bm = bmesh.new()
    rows = []
    for (r, y) in profile:
        if r <= 1e-6:
            rows.append([bm.verts.new((0.0, y, zc))])
        else:
            rows.append([bm.verts.new((r * math.cos(math.tau * i / segs), y,
                                       zc + r * math.sin(math.tau * i / segs)))
                         for i in range(segs)])
    _stitch(bm, rows, segs, close)
    return mesh_from_bm(name, bm, role, smooth)


def lathe_z(name, profile, role, cx=0.0, cy=0.0, sx=1.0, sy=1.0,
            segs=64, smooth=True, close=False):
    """Тело вращения вокруг Z в точке (cx, cy); профиль [(r, z), ...], r -> r*sx/sy."""
    bm = bmesh.new()
    rows = []
    for (r, z) in profile:
        if r <= 1e-6:
            rows.append([bm.verts.new((cx, cy, z))])
        else:
            rows.append([bm.verts.new((cx + r * sx * math.cos(math.tau * i / segs),
                                       cy + r * sy * math.sin(math.tau * i / segs), z))
                         for i in range(segs)])
    _stitch(bm, rows, segs, close)
    return mesh_from_bm(name, bm, role, smooth)


def frame_xz(a):
    """Кадр у угла a в плоскости диска: X = радиально, Y = вдоль оси, Z = тангенциально."""
    d = Vector((math.cos(a), 0.0, math.sin(a)))
    t = Vector((-d.z, 0.0, d.x))
    F = Matrix.Identity(4)
    F.col[0].xyz = d
    F.col[1].xyz = Vector((0.0, 1.0, 0.0))
    F.col[2].xyz = t
    return F, d, t


def radial(a):
    return Vector((math.cos(a), 0.0, math.sin(a)))


# передняя (фронтальная, -Y) поверхность ротора на радиусе r
ROTOR_PROFILE = [
    (0.0000, -0.0205), (0.0300, -0.0205), (0.0700, -0.0198), (0.0900, -0.0184),
    (0.0975, -0.0125), (0.1000, -0.0030), (0.1000, 0.0030), (0.0975, 0.0125),
    (0.0900, 0.0184), (0.0600, 0.0198), (0.0300, 0.0205), (0.0000, 0.0205),
]


def rotor_front_y(r):
    prof = ROTOR_PROFILE[:6]          # передняя половина: r -> y
    for (r0, y0), (r1, y1) in zip(prof, prof[1:]):
        if r0 <= r <= r1:
            k = (r - r0) / max(1e-9, (r1 - r0))
            return y0 + (y1 - y0) * k
    return -0.0200


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- ротор: мягкий силиконовый диск, стоит вертикально -------------
    soft_rotor = lathe_y(PREFIX + 'soft_rotor', ROTOR_PROFILE, 'blush', segs=72)
    soft_rotor.data.polygons.foreach_set(
        'use_smooth', [True] * len(soft_rotor.data.polygons))
    rotating.append(soft_rotor)

    # 8 мягких лепестков по кромке (вылет до Ø0,252)
    bm = bmesh.new()
    for k in range(N_LOBES):
        a = math.radians(A_LOBE0 + k * 360.0 / N_LOBES)
        c = radial(a) * R_LOBE_C + Vector((0.0, 0.0, ZC))
        bm_petal(bm, c, R_LOBE_A, LOBE_HY, R_LOBE_T, a)
    lobes = mesh_from_bm(PREFIX + 'soft_lobes', bm, 'pale')
    rotating.append(lobes)

    # текстура лепестков: три коротких радиальных ребра на каждом
    bm = bmesh.new()
    for k in range(N_LOBES):
        a = math.radians(A_LOBE0 + k * 360.0 / N_LOBES)
        F, d, t = frame_xz(a)
        for off in (-0.0125, 0.0, 0.0125):
            c = d * 0.0985 + t * off + Vector((0.0, -(LOBE_HY + 0.0010), ZC))
            bm_box(bm, c, (0.0330, 0.0022, 0.0038), F)
    ribs = mesh_from_bm(PREFIX + 'lobe_ribs', bm, 'blush')
    rotating.append(ribs)

    # текстура диска: концентрические валики на передней плоскости
    bm = bmesh.new()
    for r in (0.0400, 0.0545, 0.0690, 0.0835):
        bm_torus_arc(bm, (0.0, rotor_front_y(r) - 0.0004, ZC), (0, 1, 0),
                     r, 0.0012, tseg=64, sseg=8)
    ridges = mesh_from_bm(PREFIX + 'rotor_ridges', bm, 'pale')
    rotating.append(ridges)

    # ---- ступица, вал ------------------------------------------------
    hub = lathe_y(PREFIX + 'hub', [
        (0.0000, -0.0300),
        (0.0130, -0.0300),
        (0.0195, -0.0294),
        (0.0262, -0.0256),
        (0.0300, -0.0212),
        (0.0288, -0.0200),
        (0.0130, -0.0196),
        (0.0000, -0.0196),
    ], 'blush', segs=56)
    rotating.append(hub)

    bm = bmesh.new()
    bm_cyl(bm, (0, -0.0316, ZC), (0, -0.0300, ZC), 0.0125, segs=32)
    for k in range(6):
        a = math.radians(k * 60.0 + 15.0)
        p = radial(a) * 0.0222
        bm_cyl(bm, (p.x, -0.0322, ZC + p.z), (p.x, -0.0304, ZC + p.z),
               0.0028, segs=12)
    hub_cap = mesh_from_bm(PREFIX + 'hub_cap', bm, 'graphite')
    rotating.append(hub_cap)

    bm = bmesh.new()
    bm_cyl(bm, (0, -0.0260, ZC), (0, 0.1400, ZC), 0.0068, segs=24)
    shaft = mesh_from_bm(PREFIX + 'shaft', bm, 'steel')
    rotating.append(shaft)

    # ---- метка вращения на передней плоскости диска -------------------
    a_mark = math.radians(104.0)
    F, d, t = frame_xz(a_mark)
    bm = bmesh.new()
    bm_box(bm, d * 0.0760 + Vector((0.0, rotor_front_y(0.0760) - 0.0009, ZC)),
           (0.0340, 0.0016, 0.0072), F)
    bm_box(bm, d * 0.0945 + Vector((0.0, rotor_front_y(0.0945) - 0.0017, ZC)),
           (0.0090, 0.0016, 0.0180), F)
    mark = mesh_from_bm(PREFIX + 'rotation_mark', bm, 'graphite')
    rotating.append(mark)
    bm = bmesh.new()
    y_dot = rotor_front_y(0.0945)
    bm_cyl(bm, d * 0.0945 + Vector((0.0, y_dot - 0.0020, ZC)),
           d * 0.0945 + Vector((0.0, y_dot + 0.0002, ZC)), 0.0034, segs=16)
    led_rot = mesh_from_bm(PREFIX + 'rotation_dot', bm, 'cyan')
    rotating.append(led_rot)

    # ---- пьедестал (статично, без плиты) ------------------------------
    lathe_z(PREFIX + 'base_foot', [
        (0.0000, 0.0000), (1.0000, 0.0000), (1.0000, 0.0062),
        (0.9400, BASE_Z), (0.0000, BASE_Z),
    ], 'dark', cx=0.0, cy=BASE_CY, sx=BASE_RX, sy=BASE_RY, segs=72)
    lathe_z(PREFIX + 'base_seam', [
        (1.0000, 0.0033), (1.0300, 0.0033), (1.0300, 0.0047), (1.0000, 0.0047),
    ], 'graphite', cx=0.0, cy=BASE_CY, sx=BASE_RX, sy=BASE_RY, segs=72,
        close=True, smooth=False)
    lathe_z(PREFIX + 'base_trim', [
        (0.9750, 0.0094), (1.0140, 0.0094), (1.0140, 0.0126), (0.9750, 0.0126),
    ], 'steel', cx=0.0, cy=BASE_CY, sx=BASE_RX, sy=BASE_RY, segs=72,
        close=True, smooth=False)

    # ---- стойка + подшипниковый барабан (статичны) --------------------
    lathe_z(PREFIX + 'bearing_column', [
        (0.0000, COL_Z0), (COL_R, COL_Z0), (COL_R, COL_Z1 - 0.0100),
        (COL_R - 0.0050, COL_Z1), (0.0000, COL_Z1),
    ], 'graphite', cx=0.0, cy=COL_Y, segs=48)
    lathe_y(PREFIX + 'bearing_housing', [
        (0.0000, HOUS_Y0), (0.0600, HOUS_Y0), (0.0780, HOUS_Y0 + 0.0060),
        (R_HOUS, HOUS_Y0 + 0.0180), (R_HOUS, HOUS_Y1 - 0.0180),
        (0.0780, HOUS_Y1 - 0.0060), (0.0600, HOUS_Y1), (0.0000, HOUS_Y1),
    ], 'graphite', segs=56)
    bm = bmesh.new()
    for k in range(8):
        a = math.radians(k * 45.0 + 22.5)
        p = radial(a) * 0.0720
        bm_cyl(bm, (p.x, HOUS_Y0 - 0.0040, ZC + p.z), (p.x, HOUS_Y0, ZC + p.z),
               0.0034, segs=12)
    mesh_from_bm(PREFIX + 'bearing_bolts', bm, 'steel')

    # ---- соосный мотор со рёбрами (статичен) -------------------------
    bm = bmesh.new()
    bm_cyl(bm, (0, MOT_Y0, ZC), (0, MOT_Y1, ZC), R_MOT, segs=48)
    mesh_from_bm(PREFIX + 'motor_body', bm, 'graphite')
    bm = bmesh.new()
    for k in range(12):
        a = math.tau * k / 12.0
        F, d, t = frame_xz(a)
        bm_box(bm, d * 0.0575 + Vector((0.0, (MOT_Y0 + MOT_Y1) * 0.5 + 0.004, ZC)),
               (0.0032, 0.0480, 0.0026), F)
    mesh_from_bm(PREFIX + 'motor_fins', bm, 'dark')
    bm = bmesh.new()
    bm_torus_arc(bm, (0.0, MOT_Y1 - 0.0080, ZC), (0, 1, 0), R_MOT + 0.0020,
                 0.0018, tseg=48, sseg=8)
    bm_torus_arc(bm, (0.0, MOT_Y0 + 0.0060, ZC), (0, 1, 0), R_MOT + 0.0014,
                 0.0016, tseg=48, sseg=8)
    mesh_from_bm(PREFIX + 'motor_band', bm, 'steel')
    lathe_y(PREFIX + 'motor_head', [
        (0.0000, MOT_Y1), (R_MOT, MOT_Y1), (R_MOT, MOT_Y1 + 0.0080),
        (R_MOT - 0.0080, MOT_Y1 + 0.0160), (0.0000, MOT_Y1 + 0.0160),
    ], 'steel', segs=48)
    bm = bmesh.new()
    bm_tube(bm, [(0.020, MOT_Y1 + 0.010, ZC + 0.022),
                 (0.036, MOT_Y1 + 0.026, ZC - 0.010),
                 (0.040, MOT_Y1 + 0.030, 0.1100),
                 (0.030, MOT_Y1 + 0.012, 0.0330)], 0.0019, sides=8)
    mesh_from_bm(PREFIX + 'motor_cable', bm, 'dark')
    bm = bmesh.new()
    bm_box(bm, (0.030, MOT_Y1 + 0.014, 0.0245), (0.0125, 0.0090, 0.0080))
    mesh_from_bm(PREFIX + 'motor_connector', bm, 'dark')

    # ---- открытая рамка вокруг диска (молочная) -----------------------
    bm = bmesh.new()
    bm_torus_arc(bm, (0.0, RING_Y, ZC), (0, 1, 0), RING_R, RING_MINOR,
                 tseg=84, sseg=12)
    mesh_from_bm(PREFIX + 'guard_ring', bm, 'ivory')
    bm = bmesh.new()
    for deg in GUARD_ANGLES:
        a = math.radians(deg)
        F, d, t = frame_xz(a)
        bm_box(bm, d * 0.1065 + Vector((0.0, 0.0130, ZC)),
               (0.0700, 0.0320, 0.0140), F)
    mesh_from_bm(PREFIX + 'guard_arms', bm, 'steel')

    # ---- быстросъёмный фиксатор рамки ---------------------------------
    a_qr = math.radians(A_QR)
    F, d, t = frame_xz(a_qr)
    bm = bmesh.new()
    bm_box(bm, d * RING_R + Vector((0.0, 0.0060, ZC)),
           (0.0145, 0.0180, 0.0140), F)
    mesh_from_bm(PREFIX + 'qr_body', bm, 'graphite')
    bm = bmesh.new()
    bm_cyl(bm, d * 0.1000 + Vector((0.0, 0.0040, ZC)),
           d * 0.1500 + Vector((0.0, 0.0040, ZC)), 0.0032, segs=16)
    mesh_from_bm(PREFIX + 'qr_pin', bm, 'steel')
    bm = bmesh.new()
    bm_torus_arc(bm, d * 0.1450 + Vector((0.0, 0.0040, ZC)), d,
                 0.0052, 0.0012, tseg=20, sseg=8)
    mesh_from_bm(PREFIX + 'qr_spring', bm, 'steel')
    bm = bmesh.new()
    bm_cyl(bm, d * 0.1500 + Vector((0.0, 0.0040, ZC)),
           d * 0.1620 + Vector((0.0, 0.0040, ZC)), 0.0068, segs=14)
    mesh_from_bm(PREFIX + 'qr_knob', bm, 'dark')

    # ---- шильдик на пьедестале, LED -----------------------------------
    bm = bmesh.new()
    bm_box(bm, (-0.0480, -0.0110, BASE_Z + 0.0011),
           (0.0400, 0.0280, 0.0022))
    mesh_from_bm(PREFIX + 'spec_plate', bm, 'ivory')
    bm = bmesh.new()
    # три строки текста вдоль X
    for k, ln in enumerate((0.0300, 0.0230, 0.0150)):
        bm_box(bm, (-0.0480 - (0.0300 - ln) * 0.5, -0.0042 - k * 0.0046,
                    BASE_Z + 0.0027), (ln, 0.0016, 0.0012))
    mesh_from_bm(PREFIX + 'spec_text', bm, 'graphite')
    bm = bmesh.new()
    bm_cyl(bm, (0.0520, -0.0200, BASE_Z), (0.0520, -0.0200, BASE_Z + 0.0034),
           0.0036, segs=18)
    bm_sphere(bm, (0.0520, -0.0200, BASE_Z + 0.0052), 0.0029, segs=16, rings=10)
    mesh_from_bm(PREFIX + 'led', bm, 'cyan')

    # ---- анимационная пустышка на горизонтальной оси, в центре диска ---
    anim = empty(PREFIX + 'anim', (0.0, 0.0, ZC))
    anim.rotation_mode = 'XYZ'
    anim['spin_axis'] = 'z'          # three.js: Z после export_yup (ось горизонтальна)
    anim['spin_speed'] = 1.25        # рад/с
    anim['spin_direction'] = 1
    anim['lobes'] = N_LOBES
    anim['disc_diameter'] = 0.28
    bpy.context.view_layer.update()  # иначе matrix_world ещё identity
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


def pivot_test(anim, rotating):
    """Поворот на 90° вокруг оси Y: y и радиус в плоскости XZ инвариантны."""
    bpy.context.view_layer.update()
    pts0, pts1 = [], []
    for o in rotating:
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            pts0.append((p.x, p.y, p.z))
    anim.rotation_euler = (0.0, math.radians(90.0), 0.0)
    bpy.context.view_layer.update()
    for o in rotating:
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            pts1.append((p.x, p.y, p.z))
    worst_r = worst_a = 0.0
    for (x0, y0, z0), (x1, y1, z1) in zip(pts0, pts1):
        worst_r = max(worst_r, abs(math.hypot(x1, z1 - ZC) - math.hypot(x0, z0 - ZC)))
        worst_a = max(worst_a, abs(y1 - y0))
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    return worst_r, worst_a


ROTATING_MUST = {'soft_rotor', 'soft_lobes', 'hub', 'shaft', 'rotation_mark',
                 'rotation_dot', 'lobe_ribs', 'rotor_ridges', 'hub_cap'}
STATIC_MUST = {'base_foot', 'bearing_housing', 'guard_ring', 'motor_body'}


def check(anim, rotating):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5
    kids = list(anim.children)
    static = [o for o in bpy.data.objects
              if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in kids]
    worst_r, worst_a = pivot_test(anim, rotating)

    rot_names = {o.name.replace(PREFIX, '') for o in rotating}
    st_names = {o.name.replace(PREFIX, '') for o in static}
    diam = size.x                     # габарит по X = диаметр диска с лепестками
    rep = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'disc_diameter_m': round(diam, 4),
        'depth_m': round(size.y, 4),
        'height_m': round(size.z, 4),
        'bbox_ok': bool(0.2700 <= size.x <= 0.3000 and 0.2350 <= size.y <= 0.2900
                        and 0.3100 <= size.z <= 0.3450),
        'lobes': N_LOBES,
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_axis_blender': 'Y',
        'anim_axis_gltf': 'Z',
        'anim_children': sorted(o.name for o in kids),
        'anim_child_count': len(kids),
        'static_count': len(static),
        'pivot_r_dev_m': round(worst_r, 9),
        'pivot_axial_dev_m': round(worst_a, 9),
        'pivot_ok': bool(worst_r < 1e-6 and worst_a < 1e-6
                         and abs(anim.location.x) < 1e-9
                         and abs(anim.location.y) < 1e-9),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'rotating_parts': sorted(rot_names),
        'static_parts': sorted(st_names),
        'rotating_must_ok': bool(ROTATING_MUST <= rot_names),
        'static_must_ok': bool(STATIC_MUST <= st_names),
        'rotating_static_overlap': sorted(rot_names & st_names),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    tris = 0
    for o in all_mesh:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    rep['triangles'] = tris
    rep['children_ok'] = bool(sorted(o.name for o in kids)
                              == sorted(o.name for o in rotating))
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


def glb_inspect(path):
    raw = path.read_bytes()
    assert raw[:4] == b'glTF'
    off, js = 12, None
    while off < len(raw):
        ln, ty = struct.unpack_from('<II', raw, off)
        off += 8
        if ty == 0x4E4F534A:
            js = json.loads(raw[off:off + ln].decode('utf-8'))
            break
        off += ln
    nodes = js.get('nodes', [])
    names = [n.get('name', '') for n in nodes]
    child_of = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            child_of[c] = i
    anim_idx = [i for i, n in enumerate(nodes) if n.get('name') == PREFIX + 'anim']
    kids = [names[c] for c in nodes[anim_idx[0]].get('children', [])] if anim_idx else []
    return {
        'glb_nodes': len(nodes),
        'glb_meshes': len(js.get('meshes', [])),
        'glb_materials': [m.get('name') for m in js.get('materials', [])],
        'glb_animations': len(js.get('animations', [])),
        'glb_node_names': names,
        'glb_anim_children': sorted(kids),
        'glb_anim_child_count': len(kids),
        'glb_root_nodes': [names[i] for i in range(len(nodes)) if i not in child_of],
        'glb_anim_extras': nodes[anim_idx[0]].get('extras') if anim_idx else None,
    }


# --- рендеры -------------------------------------------------------------
def render_views(glb):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1440
    scene.render.resolution_y = 1120
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    scene.view_settings.exposure = -0.42
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.245, 0.250, 0.262, 1.0)
    bg.inputs['Strength'].default_value = 0.55

    bpy.ops.import_scene.gltf(filepath=str(glb))
    bpy.context.view_layer.update()

    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in scene.objects:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    center = (mn + mx) * 0.5
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx],
          flush=True)

    bpy.ops.mesh.primitive_plane_add(size=1.6,
                                     location=(center.x, center.y, mn.z - 0.0006))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.215, 0.216, 0.224, 1.0)
    nb.inputs['Roughness'].default_value = 0.85
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.36, -0.42, 0.50), 3.1, 0.34),
            ('fill', (-0.44, -0.36, 0.26), 1.25, 0.54),
            ('rim', (0.04, 0.46, 0.38), 2.2, 0.36)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.7))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    SHOTS.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

    def fit_dist(direction, lens, corners, margin=1.08):
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
    # кадр крупного плана: подшипниковый барабан + мотор за диском
    close_t = Vector((0.004, 0.1100, 0.1850))
    c_close = box_corners(Vector((-0.0920, 0.0200, 0.0800)) - close_t,
                          Vector((0.0920, 0.2200, 0.2900)) - close_t)

    mesh_objs = [o for o in scene.objects
                 if o.type == 'MESH' and o.name != 'render_floor']
    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(objs):
        worst = 0.0
        for o in objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    # для крупного плана берём только привод (за диском)
    close_objs = []
    for o in mesh_objs:
        om, ox = mesh_bbox([o])
        c = (om + ox) * 0.5
        if om.y >= -0.0010 and math.hypot(c.x, c.z - 0.1850) <= 0.130:
            close_objs.append(o)

    views = [
        ('3q',      (0.95, -1.00, 0.44), center + Vector((0, 0, 0.002)),
         68, c_main, 0.92, mesh_objs, True, (1440, 1120)),
        ('front',   (0.00, -1.00, 0.10), center + Vector((0, 0, 0.004)),
         68, c_main, 0.92, mesh_objs, True, (1440, 1120)),
        ('side',    (1.00, 0.00, 0.24), center + Vector((0, 0, 0.004)),
         68, c_main, 0.92, mesh_objs, True, (1440, 1120)),
        ('closeup', (0.52, 0.86, 0.30), close_t,
         88, c_close, 0.94, close_objs, True, (1440, 1120)),
        ('3q_300',  (0.95, -1.00, 0.44), center + Vector((0, 0, 0.002)),
         68, c_main, 0.92, mesh_objs, True, (300, 234)),
    ]
    outs = {}
    for tag, direction, target, lens, corners, fill, objs, refine, res in views:
        scene.render.resolution_x, scene.render.resolution_y = res
        cam_data.lens = lens
        dist = (refine if isinstance(refine, float)
                else fit_dist(direction, lens, corners))
        do_refine = bool(refine is True)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if do_refine:
            for _ in range(5):
                got = max_ndc(objs)
                if abs(got - fill) < 0.02:
                    break
                dist *= got / fill
                cam.location = target + dirn * dist
                cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
                bpy.context.view_layer.update()
        fp = SHOTS / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs[tag] = str(fp.relative_to(PROJECT))
        print(f'RENDERED {tag} {res[0]}x{res[1]} dist={dist:.3f} '
              f'ndc={max_ndc(objs):.3f} {fp}', flush=True)
    scene.render.resolution_x, scene.render.resolution_y = 1440, 1120
    return outs, mn, mx


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep.update(glb_inspect(path))
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    shots, imn, imx = render_views(path)
    rep['renders'] = shots
    rep['glb_import_bbox_min'] = [round(v, 5) for v in imn]
    rep['glb_import_bbox_max'] = [round(v, 5) for v in imx]
    SHOTS.mkdir(parents=True, exist_ok=True)
    (SHOTS / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps({k: v for k, v in rep.items()
                                  if k not in ('glb_node_names', 'rotating_parts',
                                               'static_parts', 'anim_children',
                                               'glb_anim_children')},
                                 ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['children_ok']
            and rep['rotating_must_ok'] and rep['static_must_ok']
            and not rep['rotating_static_overlap']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and rep['glb_anim_child_count'] == len(rotating)):
        raise SystemExit('checks failed')


main()
