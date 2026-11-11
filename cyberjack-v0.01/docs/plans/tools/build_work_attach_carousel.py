"""Standalone builder + renderer: work_attach_carousel (WRK-ATT-14, «Карусель насадок»).

Настольный док-магазин на 6 насадок Ø0,30 × 0,15 м: неподвижное основание
с мотором и пружинным фиксатором, поворотный диск с 6 гнёздами-держателями
(вилка с вальцованными щеками + пружинный прижим) и 6 упрощёнными сменными
насадками разной формы (гладкая, ребристая, спиральная, конусная,
с утолщением, изогнутая), открытая защитная стойка (3 стойки с шаровыми
наконечниками + низкий обвод), метки позиций, кабель с разъёмом.
Плиты-основания нет.

Не зависит от build_component_library.py и от других build_* скриптов.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_carousel.py

Выход:
  public/models/machine-modules/components/work_attach_carousel.glb
  docs/plans/blockout/component-library/work_attach_carousel/*.png + report.json

Геометрия (Blender Z-up, метры):
  ось вращения    = Z (после export_yup -> Y в three.js, spin Y 0.9 рад/с)
  anim-пустышка   = (0, 0, 0) — на вертикальной оси, pivot = 0
  вращаются: platter, platter_rim, hub, hub_cap, index_rings,
             socket_0..5, clip_0..5, ferrule_0..5, attach_0..5
  статичны:  base_foot, base_body, base_trim, base_gasket, base_seam,
             base_plate, cable_gland, motor_body, motor_fins, motor_flange, motor_gland,
             guard_post_0..2, guard_rail, detent_bracket, detent_stem,
             detent_spring, detent_arm, detent_pin, detent_knob, pos_marks,
             cable, connector, spec_plate, led
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
SHOTS = PROJECT / 'docs/plans/blockout/component-library/work_attach_carousel'
CID = 'work_attach_carousel'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
R_OUT = 0.150                      # Ø 0,30

Z_FOOT1 = 0.010                    # фланец-подошва
Z_BODY1 = 0.030                    # корпус основания (усечённый конус)
Z_TRIM1 = 0.034                    # стальной поясок
Z_PLATE1 = 0.037                   # монтажная плита мотора
Z_MOTOR1 = 0.055                   # верх мотора (виден в зазоре)
MOTOR_R = 0.042

Z_DISC0, Z_DISC1 = 0.055, 0.068    # поворотный диск
DISC_R0, DISC_R1 = 0.124, 0.121
Z_HUB1 = 0.079
Z_CAP1 = 0.0865

Z_TOOL = 0.0905                    # ось насадок (горизонтальная, радиальная)
Z_PAD1 = 0.0720                    # верх подкладки гнезда
Z_RAIL = 0.0865                    # верх щёк гнезда

N_SEATS = 6
POST_A = (90.0, 210.0, 330.0)      # стойки — между насадками
R_POST = 0.1440
Z_GUARD = 0.1445

PALETTE = {
    'body': (0.930, 0.920, 0.900),
    'ivory': (0.968, 0.960, 0.940),
    'steel': (0.640, 0.648, 0.640),
    'graphite': (0.300, 0.310, 0.325),
    'dark': (0.170, 0.176, 0.190),
    'blush': (0.890, 0.690, 0.720),
    'pale': (0.945, 0.820, 0.832),
    'cyan': (0.700, 0.880, 0.905),
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
        if i > 0:                                   # параллельный перенос
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
    bm.faces.new(tuple(rings[-1]))


# --- радиальный кадр ------------------------------------------------------
def seat_frame(deg):
    a = math.radians(deg)
    d = Vector((math.cos(a), math.sin(a), 0.0))
    t = Vector((-math.sin(a), math.cos(a), 0.0))
    M = Matrix.Identity(4)
    M.col[0].xyz = d
    M.col[1].xyz = t
    M.col[2].xyz = Vector((0.0, 0.0, 1.0))
    return d, t, M


def wp(M, x, y, z):
    """Локальные (радиальная, тангенциальная, высота) -> мир."""
    return M @ Vector((x, y, z))


# --- насадки --------------------------------------------------------------
def tool_specs():
    """(вид, станция прижима, мажорный радиус прижима)."""
    return [
        ('smooth', 0.086, 0.0142),
        ('ribbed', 0.084, 0.0148),
        ('spiral', 0.086, 0.0152),
        ('tapered', 0.086, 0.0122),
        ('bulbous', 0.090, 0.0134),
        ('curved', 0.070, 0.0132),
    ]


def build_tool(bm, kind, M):
    """Насадка в локальном кадре: ось = X (радиальная), высота = Z_TOOL."""
    ZT = Z_TOOL
    if kind == 'smooth':
        bm_cyl(bm, wp(M, 0.054, 0, ZT), wp(M, 0.1060, 0, ZT), 0.0122, segs=32)
        bm_sphere(bm, wp(M, 0.1060, 0, ZT), 0.0122)
        bm_sphere(bm, wp(M, 0.0552, 0, ZT), 0.0121)
    elif kind == 'ribbed':
        bm_cyl(bm, wp(M, 0.054, 0, ZT), wp(M, 0.1040, 0, ZT), 0.0112, segs=32)
        for i in range(5):
            bm_torus_arc(bm, wp(M, 0.0625 + i * 0.0093, 0, ZT), M.col[0].xyz,
                         0.0115, 0.0026, tseg=32, sseg=10)
        bm_sphere(bm, wp(M, 0.1040, 0, ZT), 0.0112)
        bm_sphere(bm, wp(M, 0.0565, 0, ZT), 0.0116)
    elif kind == 'spiral':
        bm_cyl(bm, wp(M, 0.053, 0, ZT), wp(M, 0.1015, 0, ZT), 0.0104, segs=28)
        axis = M.col[0].xyz
        u = Vector((0.0, 0.0, 1.0))
        v = axis.cross(u)
        turns, npts = 3.4, 90
        pts = []
        for i in range(npts + 1):
            f = i / npts
            x = 0.0575 + f * (0.0970 - 0.0575)
            ang = math.tau * turns * f
            pts.append(wp(M, x, 0, ZT)
                       + (math.cos(ang) * u + math.sin(ang) * v) * 0.0111)
        bm_tube(bm, pts, 0.0028, sides=9)
        bm_sphere(bm, wp(M, 0.1015, 0, ZT), 0.0104)
        bm_sphere(bm, wp(M, 0.0555, 0, ZT), 0.0108)
    elif kind == 'tapered':
        bm_cyl(bm, wp(M, 0.053, 0, ZT), wp(M, 0.1080, 0, ZT), 0.0165, 0.0050,
               segs=36)
        bm_sphere(bm, wp(M, 0.1080, 0, ZT), 0.0050)
        bm_torus_arc(bm, wp(M, 0.0573, 0, ZT), M.col[0].xyz, 0.0169, 0.0017,
                     tseg=36, sseg=8)
    elif kind == 'bulbous':
        bm_cyl(bm, wp(M, 0.053, 0, ZT), wp(M, 0.0855, 0, ZT), 0.0096, segs=28)
        bm_sphere(bm, wp(M, 0.0955, 0, ZT), 0.0182, segs=30, rings=18)
        bm_torus_arc(bm, wp(M, 0.0578, 0, ZT), M.col[0].xyz, 0.0100, 0.0016,
                     tseg=28, sseg=8)
        bm_torus_arc(bm, wp(M, 0.0812, 0, ZT), M.col[0].xyz, 0.0100, 0.0018,
                     tseg=28, sseg=8)
    elif kind == 'curved':
        pts = [wp(M, 0.053, 0, ZT), wp(M, 0.067, 0, ZT),
               wp(M, 0.079, 0, ZT + 0.002), wp(M, 0.0900, 0, ZT + 0.009),
               wp(M, 0.0975, 0, ZT + 0.019), wp(M, 0.1015, 0, ZT + 0.029),
               wp(M, 0.1035, 0, ZT + 0.036)]
        dense = []
        for i in range(len(pts) - 1):
            for k in range(6):
                dense.append(pts[i].lerp(pts[i + 1], k / 6.0))
        dense.append(pts[-1])
        bm_tube(bm, dense, 0.0102, sides=14)
        bm_sphere(bm, pts[-1], 0.0102)
        bm_sphere(bm, wp(M, 0.0545, 0, ZT), 0.0106)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- неподвижное основание -----------------------------------------
    bm = bmesh.new()
    bm_cyl(bm, (0, 0, 0.0), (0, 0, Z_FOOT1), R_OUT, 0.1478, segs=72)
    bm_torus_arc(bm, (0, 0, Z_FOOT1 - 0.0004), (0, 0, 1), 0.1476, 0.0014,
                 tseg=72, sseg=8)
    mesh_from_bm(PREFIX + 'base_foot', bm, 'dark')

    bm = bmesh.new()
    bm_cyl(bm, (0, 0, Z_FOOT1), (0, 0, Z_BODY1), 0.1472, 0.1280, segs=72)
    mesh_from_bm(PREFIX + 'base_body', bm, 'body')

    bm = bmesh.new()
    bm_cyl(bm, (0, 0, 0.0296), (0, 0, Z_TRIM1), 0.1312, 0.1304, segs=72)
    bm_torus_arc(bm, (0, 0, Z_TRIM1 - 0.0006), (0, 0, 1), 0.1304, 0.0016,
                 tseg=72, sseg=8)
    mesh_from_bm(PREFIX + 'base_trim', bm, 'steel')

    bm = bmesh.new()
    bm_cyl(bm, (0, 0, Z_TRIM1 - 0.0006), (0, 0, Z_TRIM1 + 0.0032), 0.1318,
           0.1310, segs=72)
    mesh_from_bm(PREFIX + 'base_gasket', bm, 'dark')

    bm = bmesh.new()
    bm_torus_arc(bm, (0, 0, 0.0175), (0, 0, 1), 0.1402, 0.0020,
                 tseg=72, sseg=8)
    mesh_from_bm(PREFIX + 'base_seam', bm, 'dark')

    bm = bmesh.new()
    bm_cyl(bm, (0, 0, Z_TRIM1 + 0.0026), (0, 0, Z_PLATE1), 0.1220, 0.1208,
           segs=56)
    mesh_from_bm(PREFIX + 'base_plate', bm, 'graphite')

    # кабельный ввод в корпус основания
    a_gl = math.radians(77.0)
    d_gl = Vector((math.cos(a_gl), math.sin(a_gl), 0.0))
    bm = bmesh.new()
    bm_cyl(bm, d_gl * 0.1240 + Vector((0, 0, 0.0255)),
           d_gl * 0.1360 + Vector((0, 0, 0.0255)), 0.0064, 0.0056, segs=20)
    bm_torus_arc(bm, d_gl * 0.1352 + Vector((0, 0, 0.0255)), d_gl,
                 0.0058, 0.0012, tseg=20, sseg=8)
    mesh_from_bm(PREFIX + 'cable_gland', bm, 'graphite')

    # ---- мотор (статичен, виден в зазоре под диском) --------------------
    bm = bmesh.new()
    bm_cyl(bm, (0, 0, Z_PLATE1 - 0.001), (0, 0, Z_MOTOR1 - 0.0016), MOTOR_R,
           0.0402, segs=48)
    bm_cyl(bm, (0, 0, Z_MOTOR1 - 0.0020), (0, 0, Z_MOTOR1), 0.0402, 0.0355,
           segs=48)
    mesh_from_bm(PREFIX + 'motor_body', bm, 'graphite')

    bm = bmesh.new()
    for i in range(16):
        a = math.tau * i / 16
        d = Vector((math.cos(a), math.sin(a), 0.0))
        t = Vector((-math.sin(a), math.cos(a), 0.0))
        Fr = Matrix.Identity(4)
        Fr.col[0].xyz = d
        Fr.col[1].xyz = t
        Fr.col[2].xyz = Vector((0, 0, 1))
        bm_box(bm, d * 0.0443 + Vector((0, 0, 0.0462)),
               (0.0062, 0.0022, 0.0150), Fr)
    mesh_from_bm(PREFIX + 'motor_fins', bm, 'dark')

    bm = bmesh.new()
    bm_cyl(bm, (0, 0, Z_PLATE1 - 0.0015), (0, 0, Z_PLATE1 + 0.0028), 0.0498,
           0.0488, segs=48)
    bm_torus_arc(bm, (0, 0, Z_PLATE1 + 0.0028), (0, 0, 1), 0.0488, 0.0018,
                 tseg=48, sseg=8)
    mesh_from_bm(PREFIX + 'motor_flange', bm, 'steel')

    # ---- поворотный диск ------------------------------------------------
    bm = bmesh.new()
    bm_cyl(bm, (0, 0, Z_DISC0), (0, 0, Z_DISC1), DISC_R0, DISC_R1, segs=72)
    bm_torus_arc(bm, (0, 0, Z_DISC1), (0, 0, 1), DISC_R1, 0.0022,
                 tseg=72, sseg=8)
    bm_cyl(bm, (0, 0, Z_DISC0 + 0.0006), (0, 0, Z_DISC0 + 0.0062), 0.1228,
           0.1228, segs=72)
    rotating.append(mesh_from_bm(PREFIX + 'platter', bm, 'ivory'))

    bm = bmesh.new()
    bm_cyl(bm, (0, 0, Z_DISC0 + 0.0012), (0, 0, Z_DISC0 + 0.0074), 0.1252,
           0.1252, segs=72)
    rotating.append(mesh_from_bm(PREFIX + 'platter_rim', bm, 'steel'))

    bm = bmesh.new()
    bm_cyl(bm, (0, 0, Z_DISC1 - 0.0015), (0, 0, Z_HUB1), 0.0530, 0.0500,
           segs=48)
    bm_torus_arc(bm, (0, 0, Z_HUB1 - 0.0008), (0, 0, 1), 0.0500, 0.0018,
                 tseg=48, sseg=8)
    rotating.append(mesh_from_bm(PREFIX + 'hub', bm, 'blush'))

    bm = bmesh.new()
    bm_cyl(bm, (0, 0, Z_HUB1 - 0.0020), (0, 0, Z_CAP1 - 0.0035), 0.0165,
           0.0158, segs=32)
    bm_sphere(bm, (0, 0, Z_CAP1 - 0.0035), 0.0158, segs=30, rings=12)
    rotating.append(mesh_from_bm(PREFIX + 'hub_cap', bm, 'graphite'))

    # ---- 6 гнёзд: подкладка + вилка с вальцованными щеками -------------
    for k in range(N_SEATS):
        d, t, M = seat_frame(k * 360.0 / N_SEATS)
        bm = bmesh.new()
        bm_box(bm, wp(M, 0.0680, 0, (Z_DISC1 + Z_PAD1) * 0.5),
               (0.048, 0.060, Z_PAD1 - Z_DISC1), M)
        for sgn in (1, -1):
            bm_box(bm, wp(M, 0.0680, sgn * 0.0205, (Z_PAD1 + Z_RAIL) * 0.5),
                   (0.044, 0.0068, Z_RAIL - Z_PAD1), M)
            bm_cyl(bm, wp(M, 0.0465, sgn * 0.0205, Z_RAIL),
                   wp(M, 0.0895, sgn * 0.0205, Z_RAIL), 0.0026, segs=14)
        # наружная перемычка, связывающая щёки
        bm_box(bm, wp(M, 0.0870, 0, (Z_PAD1 + 0.0785) * 0.5),
               (0.0072, 0.0480, 0.0785 - Z_PAD1), M)
        # седло под гильзу насадки
        for sgn in (1, -1):
            bm_box(bm, wp(M, 0.0525, sgn * 0.0178, (Z_PAD1 + 0.0766) * 0.5),
                   (0.0210, 0.0062, 0.0766 - Z_PAD1), M)
        rotating.append(mesh_from_bm(PREFIX + f'socket_{k}', bm, 'blush'))

    # ---- 6 пружинных прижимов (дуга вокруг насадки) ---------------------
    for k, (kind, clip_r, clip_major) in enumerate(tool_specs()):
        d, t, M = seat_frame(k * 360.0 / N_SEATS)
        bm = bmesh.new()
        centre = wp(M, clip_r, 0, Z_TOOL)
        bm_torus_arc(bm, centre, d, clip_major, 0.0016,
                     a0=math.radians(40), a1=math.radians(320),
                     tseg=28, sseg=8, closed=False)
        rot_u = Vector((0, 0, 1))
        rot_v = d.cross(rot_u)
        for a_deg in (40.0, 320.0):
            a = math.radians(a_deg)
            end = centre + (math.cos(a) * rot_u + math.sin(a) * rot_v) * clip_major
            bm_box(bm, end - d * 0.0035, (0.0075, 0.0050, 0.0060), M)
        rotating.append(mesh_from_bm(PREFIX + f'clip_{k}', bm, 'steel'))

    # ---- 6 насадок + стальные гильзы ------------------------------------
    for k, (kind, clip_r, clip_major) in enumerate(tool_specs()):
        d, t, M = seat_frame(k * 360.0 / N_SEATS)
        bm = bmesh.new()
        build_tool(bm, kind, M)
        tool = mesh_from_bm(PREFIX + f'attach_{k}', bm, 'pale')
        tool['variant'] = kind
        rotating.append(tool)

        bm = bmesh.new()
        bm_cyl(bm, wp(M, 0.0455, 0, Z_TOOL), wp(M, 0.0570, 0, Z_TOOL),
               0.0150, 0.0144, segs=32)
        bm_torus_arc(bm, wp(M, 0.0570, 0, Z_TOOL), d, 0.0144, 0.0017,
                     tseg=32, sseg=8)
        bm_torus_arc(bm, wp(M, 0.0457, 0, Z_TOOL), d, 0.0149, 0.0015,
                     tseg=32, sseg=8)
        ferrule = mesh_from_bm(PREFIX + f'ferrule_{k}', bm, 'steel')
        ferrule['variant'] = kind
        rotating.append(ferrule)

    # ---- метки позиций на диске (между насадками) -----------------------
    bm = bmesh.new()
    for k in range(N_SEATS):
        a = math.radians(k * 360.0 / N_SEATS + 30.0)
        d = Vector((math.cos(a), math.sin(a), 0.0))
        bm_torus_arc(bm, d * 0.1065 + Vector((0, 0, Z_DISC1 + 0.0006)),
                     (0, 0, 1), 0.0066, 0.0016, tseg=24, sseg=8)
    rotating.append(mesh_from_bm(PREFIX + 'index_rings', bm, 'steel'))

    # ---- открытая защитная стойка: 3 стойки + верхнее кольцо -----------
    for i, deg in enumerate(POST_A):
        a = math.radians(deg)
        d = Vector((math.cos(a), math.sin(a), 0.0))
        t = Vector((-math.sin(a), math.cos(a), 0.0))
        Fr = Matrix.Identity(4)
        Fr.col[0].xyz = d
        Fr.col[1].xyz = t
        Fr.col[2].xyz = Vector((0, 0, 1))
        bm = bmesh.new()
        bm_box(bm, d * R_POST + Vector((0, 0, (Z_FOOT1 + Z_GUARD) * 0.5)),
               (0.0105, 0.0105, Z_GUARD - Z_FOOT1), Fr)
        bm_box(bm, d * 0.1424 + Vector((0, 0, Z_FOOT1 + 0.0040)),
               (0.0136, 0.0136, 0.0080), Fr)
        bm_sphere(bm, d * R_POST + Vector((0, 0, Z_GUARD)), 0.0048,
                  segs=18, rings=10)
        mesh_from_bm(PREFIX + f'guard_post_{i}', bm, 'steel')

    bm = bmesh.new()
    bm_torus_arc(bm, (0, 0, 0.0630), (0, 0, 1), R_POST, 0.0030,
                 tseg=96, sseg=10)
    mesh_from_bm(PREFIX + 'guard_rail', bm, 'steel')

    # ---- мотор-редуктор на стенке основания (сзади-слева, 150°) ---------
    d_gm, t_gm, Mgm = seat_frame(15.0)
    bm = bmesh.new()
    bm_cyl(bm, wp(Mgm, 0.1110, 0, 0.0245), wp(Mgm, 0.1445, 0, 0.0245),
           0.0198, 0.0186, segs=36)
    bm_cyl(bm, wp(Mgm, 0.1445, 0, 0.0245), wp(Mgm, 0.1480, 0, 0.0245),
           0.0205, 0.0180, segs=36)
    bm_torus_arc(bm, wp(Mgm, 0.1445, 0, 0.0245), d_gm, 0.0202, 0.0016,
                 tseg=36, sseg=8)
    mesh_from_bm(PREFIX + 'gear_motor', bm, 'graphite')

    bm = bmesh.new()
    bm_box(bm, wp(Mgm, 0.1250, 0, 0.0400), (0.0260, 0.0230, 0.0145), Mgm)
    mesh_from_bm(PREFIX + 'motor_terminal', bm, 'dark')

    bm = bmesh.new()
    bm_cyl(bm, wp(Mgm, 0.1085, 0, 0.0245), wp(Mgm, 0.1145, 0, 0.0245),
           0.0232, 0.0228, segs=36)
    mesh_from_bm(PREFIX + 'motor_flange_out', bm, 'steel')

    # ---- фиксатор (перед, -Y): кронштейн, стойка, пружина, рычаг, палец --
    d, t, Mdet = seat_frame(270.0)
    bm = bmesh.new()
    bm_box(bm, wp(Mdet, 0.1315, 0, 0.0300), (0.0300, 0.0560, 0.0160), Mdet)
    mesh_from_bm(PREFIX + 'detent_bracket', bm, 'blush')

    bm = bmesh.new()
    bm_cyl(bm, wp(Mdet, 0.1368, 0, 0.0330), wp(Mdet, 0.1368, 0, 0.0535),
           0.0074, 0.0068, segs=24)
    bm_box(bm, wp(Mdet, 0.1368, 0, 0.0320), (0.0170, 0.0210, 0.0070), Mdet)
    mesh_from_bm(PREFIX + 'detent_stem', bm, 'graphite')

    bm = bmesh.new()
    for i in range(4):
        bm_torus_arc(bm, wp(Mdet, 0.1368, 0, 0.0372 + i * 0.0044), (0, 0, 1),
                     0.0088, 0.0017, tseg=22, sseg=8)
    mesh_from_bm(PREFIX + 'detent_spring', bm, 'steel')

    bm = bmesh.new()
    bm_box(bm, wp(Mdet, 0.1250, 0, 0.0515), (0.0340, 0.0175, 0.0050), Mdet)
    mesh_from_bm(PREFIX + 'detent_arm', bm, 'graphite')

    bm = bmesh.new()
    bm_cyl(bm, wp(Mdet, 0.1160, 0, 0.0430), wp(Mdet, 0.1160, 0, 0.0532),
           0.0036, 0.0030, segs=16)
    mesh_from_bm(PREFIX + 'detent_pin', bm, 'dark')

    bm = bmesh.new()
    bm_cyl(bm, wp(Mdet, 0.1396, 0, 0.0235), wp(Mdet, 0.1470, 0, 0.0235),
           0.0090, 0.0080, segs=24)
    bm_torus_arc(bm, wp(Mdet, 0.1452, 0, 0.0235), Mdet.col[0].xyz, 0.0078,
                 0.0012, tseg=24, sseg=8)
    mesh_from_bm(PREFIX + 'detent_knob', bm, 'blush')

    # ---- метки позиций на основании (6 рисок) ---------------------------
    bm = bmesh.new()
    for k in range(N_SEATS):
        a = math.radians(k * 360.0 / N_SEATS - 90.0)
        d = Vector((math.cos(a), math.sin(a), 0.0))
        t = Vector((-math.sin(a), math.cos(a), 0.0))
        Fr = Matrix.Identity(4)
        Fr.col[0].xyz = d
        Fr.col[1].xyz = t
        Fr.col[2].xyz = Vector((0, 0, 1))
        bm_box(bm, d * 0.1262 + Vector((0, 0, Z_TRIM1 + 0.0022)),
               (0.0090, 0.0042, 0.0018), Fr)
    mesh_from_bm(PREFIX + 'pos_marks', bm, 'cyan')

    # ---- кабель + разъём ------------------------------------------------
    cu = bpy.data.curves.new(PREFIX + 'cable', 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = 0.0040
    cu.bevel_resolution = 6
    cu.resolution_u = 14
    sp = cu.splines.new('BEZIER')
    cab_pts = [(0.0303, 0.1312, 0.0255),
               (0.0542, 0.1272, 0.0222),
               (0.0792, 0.1192, 0.0184),
               (0.1000, 0.1042, 0.0160),
               (0.1120, 0.0902, 0.0150)]
    sp.bezier_points.add(len(cab_pts) - 1)
    for bp, p in zip(sp.bezier_points, cab_pts):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cab = bpy.data.objects.new(PREFIX + 'cable', cu)
    bpy.context.scene.collection.objects.link(cab)
    apply(cab, 'graphite')
    bpy.ops.object.select_all(action='DESELECT')
    cab.select_set(True)
    bpy.context.view_layer.objects.active = cab
    bpy.ops.object.convert(target='MESH')
    cable = bpy.context.object
    for p in cable.data.polygons:
        p.use_smooth = True

    a_cab = math.radians(39.0)
    d_cab = Vector((math.cos(a_cab), math.sin(a_cab), 0.0))
    bm = bmesh.new()
    bm_cyl(bm, d_cab * 0.1400 + Vector((0, 0, 0.0150)),
           d_cab * 0.1468 + Vector((0, 0, 0.0150)), 0.0062, 0.0054, segs=20)
    bm_torus_arc(bm, d_cab * 0.1458 + Vector((0, 0, 0.0150)), d_cab,
                 0.0056, 0.0012, tseg=20, sseg=8)
    mesh_from_bm(PREFIX + 'connector', bm, 'graphite')

    # ---- шильдик и LED --------------------------------------------------
    a_lab = math.radians(318.0)
    d_lab = Vector((math.cos(a_lab), math.sin(a_lab), 0.0))
    t_lab = Vector((-math.sin(a_lab), math.cos(a_lab), 0.0))
    Fr = Matrix.Identity(4)
    Fr.col[0].xyz = d_lab
    Fr.col[1].xyz = t_lab
    Fr.col[2].xyz = Vector((0, 0, 1))
    bm = bmesh.new()
    bm_box(bm, d_lab * 0.1160 + Vector((0, 0, 0.0306)),
           (0.0300, 0.0155, 0.0018), Fr)
    mesh_from_bm(PREFIX + 'spec_plate', bm, 'ivory')

    bm = bmesh.new()
    a_led = math.radians(310.0)
    d_led = Vector((math.cos(a_led), math.sin(a_led), 0.0))
    bm_cyl(bm, d_led * 0.1268 + Vector((0, 0, Z_TRIM1 - 0.0016)),
           d_led * 0.1268 + Vector((0, 0, Z_TRIM1 + 0.0018)), 0.0044, 0.0040,
           segs=20)
    bm_sphere(bm, d_led * 0.1268 + Vector((0, 0, Z_TRIM1 + 0.0020)), 0.0032,
              segs=18, rings=10)
    mesh_from_bm(PREFIX + 'led', bm, 'cyan')

    # ---- анимационная пустышка на вертикальной оси, pivot 0 -------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, 0.0))
    anim.rotation_mode = 'XYZ'
    anim['spin_axis'] = 'y'          # three.js: Y после export_yup
    anim['spin_speed'] = 0.9         # рад/с
    anim['seats'] = N_SEATS
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
    """Поворот на 90° вокруг вертикали: r и z каждой вершины инвариантны."""
    bpy.context.view_layer.update()
    pts0, pts1 = [], []
    for o in rotating:
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            pts0.append((p.x, p.y, p.z))
    anim.rotation_euler = (0.0, 0.0, math.radians(90.0))
    bpy.context.view_layer.update()
    for o in rotating:
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            pts1.append((p.x, p.y, p.z))
    worst_r = worst_z = 0.0
    for (x0, y0, z0), (x1, y1, z1) in zip(pts0, pts1):
        worst_r = max(worst_r, abs(math.hypot(x1, y1) - math.hypot(x0, y0)))
        worst_z = max(worst_z, abs(z1 - z0))
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    return worst_r, worst_z


def check(anim, rotating):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5
    kids = list(anim.children)
    static = [o for o in bpy.data.objects
              if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in kids]
    worst_r, worst_z = pivot_test(anim, rotating)

    diam = max(size.x, size.y)
    rep = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'diameter_m': round(diam, 4),
        'height_m': round(size.z, 4),
        'bbox_ok': bool(0.290 <= diam <= 0.3015 and 0.135 <= size.z <= 0.152),
        'seats': N_SEATS,
        'tool_variants': [s[0] for s in tool_specs()],
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children': sorted(o.name for o in kids),
        'anim_child_count': len(kids),
        'static_count': len(static),
        'pivot_r_dev_m': round(worst_r, 9),
        'pivot_z_dev_m': round(worst_z, 9),
        'pivot_ok': bool(worst_r < 1e-6 and worst_z < 1e-6
                         and (anim.location - Vector((0, 0, 0))).length < 1e-9),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'rotating_parts': sorted(o.name for o in rotating),
        'static_parts': sorted(o.name for o in static),
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
    scene.view_settings.exposure = -0.20
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.330, 0.335, 0.345, 1.0)
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
    nb.inputs['Base Color'].default_value = (0.300, 0.300, 0.308, 1.0)
    nb.inputs['Roughness'].default_value = 0.85
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.40, -0.46, 0.54), 6.2, 0.30),
            ('fill', (-0.48, -0.40, 0.28), 2.1, 0.52),
            ('rim', (0.05, 0.50, 0.40), 3.8, 0.36)):
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
    # кадр крупного плана: два соседних гнезда с насадками
    close_t = Vector((0.052, -0.044, 0.098))
    c_close = box_corners(Vector((-0.048, -0.046, -0.034)),
                          Vector((0.050, 0.048, 0.032)))

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

    def near_objs(target, radius):
        out = []
        for o in mesh_objs:
            om, ox = mesh_bbox([o])
            c = (om + ox) * 0.5
            if (c - target).length <= radius:
                out.append(o)
        return out

    close_objs = near_objs(close_t, 0.090)

    views = [
        ('3q',      (0.90, -0.96, 0.44), center + Vector((0, 0, 0.004)),
         70, c_main, 0.92, mesh_objs, True),
        ('front',   (0.02, -1.00, 0.26), center + Vector((0, 0, 0.006)),
         70, c_main, 0.92, mesh_objs, True),
        ('side',    (1.00, 0.05, 0.26), center + Vector((0, 0, 0.006)),
         70, c_main, 0.92, mesh_objs, True),
        ('closeup', (0.52, -0.86, 0.34), close_t,
         92, c_close, 0.94, close_objs, 0.335),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, objs, refine in views:
        cam_data.lens = lens
        dist = (refine if isinstance(refine, float)
                else fit_dist(direction, lens, corners))
        refine = bool(refine is True)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if refine:
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
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} dist={dist:.3f} ndc={max_ndc(objs):.3f} {fp}',
              flush=True)
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
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and rep['glb_anim_child_count'] == len(rotating)):
        raise SystemExit('checks failed')


main()
