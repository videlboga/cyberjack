"""Standalone builder: work_foot_cradle (WRK-FOOT-06, «Стопа-ложе»).

Ложе для стоп: две анатомические ванночки (левая/правая) с молочным
силиконовым ложем, пятовым упором, дренажными прорезями и быстросъёмными
вкладышами; общая стальная рама, ОДИН поперечный вал (ось Y) с тремя
массажными валиками в каждой ванночке, привод сбоку, кабель и разъём.
Плиты нет — конструкция на трубчатой раме.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_foot_cradle.py

Выход:
  public/models/machine-modules/components/work_foot_cradle.glb

Геометрия (Blender Z-up, метры):
  ось вала      = Y (поперечно, через обе ванночки), линия x=0, z=Z0
  anim-пустышка = (0, 0, Z0) — ровно на оси вала
  вращаются: shaft, roller_left_1..3, roller_right_1..3,
             bearing_race_left, bearing_race_right, bearing_race_center
  статичны:  рама, ванночки, ложа, пятовые упоры, вкладыши, привод, кабель
"""
from pathlib import Path
import json
import math
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
CID = 'work_foot_cradle'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.0575                    # высота оси вала (общая для обеих ванночек)
TUB_Y = 0.0600                 # центры ванночек по Y (левая +Y, правая -Y)
TUB_HX = 0.1970                # внешняя полу-длина ванночки
TUB_HY = 0.0500                # внешняя полу-ширина ванночки
TUB_Z_BOT = 0.0240             # низ ванночки (лежит на раме)
TUB_FLOOR = 0.0320             # дно внутри
TUB_WALL = 0.0072              # толщина стенки

RAIL_Z0, RAIL_Z1 = 0.010, 0.024
RAIL_Y = 0.1120                # ось продольной балки (под ванночкой)
RAIL_W = 0.0200
FRAME_X = 0.212                # полу-длина рамы

SHAFT_R = 0.0080
ROLLER_R = 0.0190
ROLLER_RIB = 0.0028
ROLLER_LEN = 0.0200
ROLLER_DY = 0.0320             # шаг валиков вдоль вала
SLOT_W = 0.0035                # дренажная прорезь
GAP_X = 0.042                  # свободная зона под валики в ложементе

MOTOR_Y0, MOTOR_Y1 = 0.1320, 0.1580
MOTOR_R = 0.0235
GEAR_Y0, GEAR_Y1 = 0.1180, 0.1320
BEAR_Y = 0.1145                # плоскость корпусов подшипников

PALETTE = {
    'ivory': (0.972, 0.966, 0.951),
    'silicone': (0.898, 0.862, 0.812),
    'blush': (0.885, 0.612, 0.652),
    'steel': (0.620, 0.628, 0.622),
    'graphite': (0.215, 0.222, 0.235),
    'dark': (0.115, 0.120, 0.132),
    'cyan': (0.640, 0.900, 0.930),
}
ROUGH = {'ivory': 0.48, 'silicone': 0.74, 'blush': 0.42, 'steel': 0.34,
         'graphite': 0.50, 'dark': 0.82, 'cyan': 0.22}
METAL = {'steel': 0.90, 'graphite': 0.40}
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
    bsdf.inputs['Roughness'].default_value = ROUGH.get(role, 0.55)
    bsdf.inputs['Metallic'].default_value = METAL.get(role, 0.0)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.60
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


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    e.rotation_mode = 'XYZ'
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


def bm_box(bm, center, size):
    cx, cy, cz = center
    sx, sy, sz = (s * 0.5 for s in size)
    vs = [bm.verts.new((cx + dx * sx, cy + dy * sy, cz + dz * sz))
          for dx in (-1, 1) for dy in (-1, 1) for dz in (-1, 1)]
    for idx in ((0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1),
                (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)):
        bm.faces.new([vs[i] for i in idx])


def loft(bm, rings, cap_start=True, cap_end=True):
    n = len(rings[0])
    for i in range(len(rings) - 1):
        a_, b_ = rings[i], rings[i + 1]
        for k in range(n):
            bm.faces.new((a_[k], a_[(k + 1) % n], b_[(k + 1) % n], b_[k]))
    if cap_start:
        bm.faces.new(list(reversed(rings[0])))
    if cap_end:
        bm.faces.new(rings[-1])


def rr_2d(hx, hy, r, seg=6):
    """Прямоугольник со скруглёнными углами в плане (XY)."""
    pts = []
    for cx, cy, a0 in ((hx - r, hy - r, 0.0), (-(hx - r), hy - r, 90.0),
                       (-(hx - r), -(hy - r), 180.0), (hx - r, -(hy - r), 270.0)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90.0 * k / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


# --- ванночка с задранным задним бортом -----------------------------------
RIM_PROFILE = [(-0.1970, 0.1460), (-0.1700, 0.1400), (-0.1300, 0.1260),
               (-0.0800, 0.1110), (-0.0200, 0.1010), (0.0400, 0.0960),
               (0.1100, 0.0920), (0.1970, 0.0890)]


def rim_z(x):
    if x <= RIM_PROFILE[0][0]:
        return RIM_PROFILE[0][1]
    if x >= RIM_PROFILE[-1][0]:
        return RIM_PROFILE[-1][1]
    for i in range(len(RIM_PROFILE) - 1):
        x0, z0 = RIM_PROFILE[i]
        x1, z1 = RIM_PROFILE[i + 1]
        if x0 <= x <= x1:
            s = (x - x0) / (x1 - x0)
            return z0 + (z1 - z0) * s
    return RIM_PROFILE[-1][1]


def tub_shell(name, cx, cy):
    """Открытая анатомическая ванночка: высокий задний борт, низкая кромка."""
    bm = bmesh.new()
    out_b = rr_2d(TUB_HX - 0.008, TUB_HY - 0.0045, 0.020)
    out_t = rr_2d(TUB_HX, TUB_HY, 0.024)
    in_b = rr_2d(TUB_HX - 0.008 - TUB_WALL, TUB_HY - 0.0045 - TUB_WALL, 0.014)
    in_t = rr_2d(TUB_HX - TUB_WALL, TUB_HY - TUB_WALL, 0.018)

    def level(pts, z_lo, frac):
        return [bm.verts.new((cx + x, cy + y, z_lo + (rim_z(x) - z_lo) * frac))
                for (x, y) in pts]

    out_rings = [level(out_b, TUB_Z_BOT, 0.0), level(out_b, TUB_Z_BOT, 0.55),
                 level(out_t, TUB_Z_BOT, 1.0)]
    # между 0.55 и кромкой плавно перейти на внешний контур
    out_rings.insert(2, level(out_t, TUB_Z_BOT, 0.55))
    in_rings = [level(in_b, TUB_FLOOR, 0.0), level(in_b, TUB_FLOOR, 0.55),
                level(in_t, TUB_FLOOR, 0.55), level(in_t, TUB_FLOOR, 1.0)]

    n = len(out_rings[0])
    for i in range(len(out_rings) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((out_rings[i][k], out_rings[i][k2],
                          out_rings[i + 1][k2], out_rings[i + 1][k]))
    for i in range(len(in_rings) - 1):
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((in_rings[i][k2], in_rings[i][k],
                          in_rings[i + 1][k], in_rings[i + 1][k2]))
    for k in range(n):                                   # борт
        k2 = (k + 1) % n
        bm.faces.new((out_rings[-1][k], out_rings[-1][k2],
                      in_rings[-1][k2], in_rings[-1][k]))
    bm.faces.new(list(reversed(out_rings[0])))           # наружное дно
    bm.faces.new(in_rings[0])                            # внутреннее дно
    obj = mesh_from_bm(name, bm, 'ivory')
    bevel(obj, 0.0016, 2)
    return apply(obj, 'ivory', True)


def arc_wall(name, cx, cy, r_in, r_out, z0, z1, a0_deg, a1_deg, seg, role):
    """Стенка-сектор в плане (вокруг Z): пятовый упор / борт ложа."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = math.radians(a0_deg + (a1_deg - a0_deg) * i / seg)
        dx, dy = math.cos(a), math.sin(a)
        rings.append([
            bm.verts.new((cx + dx * r_in, cy + dy * r_in, z0)),
            bm.verts.new((cx + dx * r_out, cy + dy * r_out, z0)),
            bm.verts.new((cx + dx * r_out, cy + dy * r_out, z1)),
            bm.verts.new((cx + dx * r_in, cy + dy * r_in, z1)),
        ])
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((a_[k], a_[k2], b_[k2], b_[k]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    obj = mesh_from_bm(name, bm, role)
    bevel(obj, 0.0020, 2)
    return apply(obj, role, True)


def rim_seal(name, cx, cy, role='silicone'):
    """Силиконовый борт-уплотнитель по кромке ванночки (обводит устье)."""
    bm = bmesh.new()
    seg = 6
    inner = rr_2d(TUB_HX - TUB_WALL, TUB_HY - TUB_WALL, 0.014, seg)
    outer = rr_2d(TUB_HX - 0.0004, TUB_HY - 0.0004, 0.024, seg)
    n = len(inner)

    def band(pts, dz):
        return [bm.verts.new((cx + x, cy + y, rim_z(x) + dz)) for (x, y) in pts]

    ob, ot = band(outer, -0.0026), band(outer, 0.0010)
    it, ib = band(inner, 0.0010), band(inner, -0.0026)
    for k in range(n):
        k2 = (k + 1) % n
        bm.faces.new((ob[k], ob[k2], ot[k2], ot[k]))     # наружная стенка
        bm.faces.new((ot[k], ot[k2], it[k2], it[k]))     # верхняя полка
        bm.faces.new((it[k], it[k2], ib[k2], ib[k]))     # внутренняя стенка
        bm.faces.new((ib[k], ib[k2], ob[k2], ob[k]))     # низ
    return mesh_from_bm(name, bm, role)


# --- силиконовое ложе (2 полосы с дренажными прорезями) ------------------
EXP = 6.0


def prof_eval(prof, x):
    if x <= prof[0][0]:
        return prof[0][1:]
    if x >= prof[-1][0]:
        return prof[-1][1:]
    for i in range(len(prof) - 1):
        x0, *p0 = prof[i]
        x1, *p1 = prof[i + 1]
        if x0 <= x <= x1:
            s = 0.0 if x1 - x0 < 1e-9 else (x - x0) / (x1 - x0)
            return tuple(a + (b - a) * s for a, b in zip(p0, p1))
    return prof[-1][1:]


def se_ring(bm, cx, cy, x, ry, z0, z1, yoff, seg=30):
    zc, rz = (z0 + z1) * 0.5, (z1 - z0) * 0.5
    ring = []
    for k in range(seg):
        a = math.tau * k / seg
        ca, sa = math.cos(a), math.sin(a)
        y = cy + yoff + ry * math.copysign(abs(ca) ** (2.0 / EXP), ca)
        z = zc + rz * math.copysign(abs(sa) ** (2.0 / EXP), sa)
        ring.append(bm.verts.new((cx + x, y, z)))
    return ring


def bed_segments(x0, x1, slots):
    segs, prev = [], x0
    for sx in slots:
        a, b = sx - SLOT_W * 0.5, sx + SLOT_W * 0.5
        if x0 < a < x1:
            segs.append((prev, a))
            prev = b
    segs.append((prev, x1))
    return [(a, b) for a, b in segs if b - a > 0.004]


def add_bed(bm, cx, cy, prof, x0, x1, slots):
    for (s0, s1) in bed_segments(x0, x1, slots):
        n = max(4, int((s1 - s0) / 0.006))
        rings = []
        for i in range(n + 1):
            x = s0 + (s1 - s0) * i / n
            ry, z0, z1, yoff = prof_eval(prof, x)
            rings.append(se_ring(bm, cx, cy, x, ry, z0, z1, yoff))
        loft(bm, rings)


BED_HEEL = [(-0.184, 0.030, 0.0315, 0.0430, 0.000),
            (-0.170, 0.035, 0.0312, 0.0462, 0.000),
            (-0.140, 0.039, 0.0310, 0.0520, 0.001),
            (-0.100, 0.041, 0.0310, 0.0600, 0.001),
            (-0.070, 0.0415, 0.0310, 0.0600, 0.000),
            (-0.0420, 0.0410, 0.0312, 0.0560, -0.001)]
BED_TOE = [(0.0420, 0.0408, 0.0312, 0.0552, -0.001),
           (0.060, 0.0410, 0.0310, 0.0570, -0.001),
           (0.100, 0.0405, 0.0310, 0.0520, 0.000),
           (0.140, 0.0380, 0.0310, 0.0465, 0.001),
           (0.172, 0.0330, 0.0315, 0.0420, 0.002),
           (0.186, 0.0250, 0.0320, 0.0395, 0.002)]


# --- валики --------------------------------------------------------------
def roller_profile(t, r_end=0.0105, r_body=ROLLER_R, rib=ROLLER_RIB, ribs=3):
    e = 0.12
    if t < e:
        base = r_end + (r_body - r_end) * (t / e)
    elif t > 1.0 - e:
        base = r_end + (r_body - r_end) * ((1.0 - t) / e)
    else:
        base = r_body
        u = (t - e) / (1.0 - 2.0 * e)
        base += rib * 0.5 * (1.0 + math.cos(math.tau * ribs * u))
    return base


def roller(name, y0, y1, zc=Z0, seg=30, n=44):
    bm = bmesh.new()
    rings = []
    for i in range(n + 1):
        t = i / n
        y = y0 + (y1 - y0) * t
        r = roller_profile(t)
        rings.append([bm.verts.new((r * math.cos(a), y, zc + r * math.sin(a)))
                      for a in (math.tau * k / seg for k in range(seg))])
    loft(bm, rings)
    return mesh_from_bm(name, bm, 'blush')


def tube_y(name, y0, y1, r_in, r_out, role, seg=32):
    bm = bmesh.new()
    rings = []
    for y in (y0, y1):
        ring = []
        for k in range(seg):
            a = math.tau * k / seg
            ring.append(bm.verts.new((r_in * math.cos(a), y, Z0 + r_in * math.sin(a))))
        for k in range(seg):
            a = math.tau * k / seg
            ring.append(bm.verts.new((r_out * math.cos(a), y, Z0 + r_out * math.sin(a))))
        rings.append(ring)
    a_, b_ = rings
    for k in range(seg):
        k2 = (k + 1) % seg
        bm.faces.new((a_[k], a_[k2], b_[k2], b_[k]))
        bm.faces.new((a_[seg + k], b_[seg + k], b_[seg + k2], a_[seg + k2]))
        bm.faces.new((a_[k], a_[seg + k], a_[seg + k2], a_[k2]))
        bm.faces.new((b_[k2], b_[seg + k2], b_[seg + k], b_[k]))
    return mesh_from_bm(name, bm, role)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- рама (труба / сталь) ------------------------------------------
    for tag, sy in (('left', 1.0), ('right', -1.0)):
        cube(PREFIX + f'frame_rail_{tag}', (0.0, sy * RAIL_Y, (RAIL_Z0 + RAIL_Z1) * 0.5),
             (2 * FRAME_X, RAIL_W, RAIL_Z1 - RAIL_Z0), 'steel', r=0.0024)
        for tag2, sx in (('front', 1.0), ('back', -1.0)):
            cube(PREFIX + f'frame_pad_{tag2}_{tag}', (sx * 0.174, sy * 0.0885, 0.0055),
                 (0.048, 0.028, 0.011), 'dark', r=0.0024)
    for tag, sx in (('front', 1.0), ('back', -1.0)):
        cube(PREFIX + f'frame_cross_{tag}', (sx * 0.204, 0.0, (RAIL_Z0 + RAIL_Z1) * 0.5),
             (0.016, 2 * RAIL_Y - 0.004, RAIL_Z1 - RAIL_Z0), 'steel', r=0.0022)
    cube(PREFIX + 'housing_tray', (0.0, 0.0, 0.0145),
         (0.386, 0.190, 0.007), 'graphite', r=0.0016)
    cube(PREFIX + 'frame_spine', (0.0, 0.0, 0.0400),
         (0.386, 0.0155, 0.0320), 'graphite', r=0.0020)

    # ---- ванночки + ложа + упоры ---------------------------------------
    for tag, sy in (('left', 1.0), ('right', -1.0)):
        cy = sy * TUB_Y
        tub_shell(PREFIX + f'tub_{tag}', 0.0, cy)

        bm = bmesh.new()
        add_bed(bm, 0.0, cy, BED_HEEL, -0.184, -0.042, (-0.112,))
        mesh_from_bm(PREFIX + f'bed_heel_{tag}', bm, 'silicone')

        bm = bmesh.new()
        add_bed(bm, 0.0, cy, BED_TOE, 0.042, 0.186, (0.090, 0.142))
        mesh_from_bm(PREFIX + f'bed_toe_{tag}', bm, 'silicone')

        # дренажные каналы под прорезями ложа
        bm = bmesh.new()
        for sx in (-0.112, 0.090, 0.142):
            ry = prof_eval(BED_HEEL if sx < 0 else BED_TOE, sx)[0]
            bm_box(bm, (sx, cy, 0.0305), (SLOT_W + 0.004, ry * 2.0, 0.0090))
        mesh_from_bm(PREFIX + f'drain_slots_{tag}', bm, 'dark')

        # пятовый упор (молочный силикон, чаша под пятку)
        arc_wall(PREFIX + f'heel_stop_{tag}', -0.140, cy, 0.0350, 0.0470,
                 0.0325, 0.1330, 126.0, 234.0, 20, 'silicone')

        # быстросъёмный вкладыш: прижимная планка + барашек
        rim_seal(PREFIX + f'rim_seal_{tag}', 0.0, cy, 'silicone')
        cube(PREFIX + f'latch_{tag}', (0.176, cy, 0.0925),
             (0.032, 0.042, 0.0065), 'steel', r=0.0016)
        cyl(PREFIX + f'latch_screw_{tag}', (0.166, cy, 0.0910), (0.166, cy, 0.1010),
            0.0036, 'graphite', vertices=14)


    # ---- подшипники (корпуса статичны, кольца вращаются) ---------------
    for tag, sy in (('left', 1.0), ('right', -1.0)):
        cube(PREFIX + f'bearing_pedestal_{tag}', (0.0, sy * BEAR_Y, 0.0445),
             (0.056, 0.0110, 0.0410), 'steel', r=0.0024)
        tube_y(PREFIX + f'bearing_housing_{tag}', sy * (BEAR_Y + 0.0042),
               sy * (BEAR_Y - 0.0042), 0.0104, 0.0158, 'graphite')
        rotating.append(cyl(PREFIX + f'bearing_race_{tag}',
                            (0.0, sy * (BEAR_Y + 0.0052), Z0),
                            (0.0, sy * (BEAR_Y - 0.0052), Z0),
                            0.0101, 'steel', vertices=28, smooth=False))
    tube_y(PREFIX + 'bearing_housing_center', -0.0075, 0.0075, 0.0104, 0.0146, 'graphite')
    rotating.append(cyl(PREFIX + 'bearing_race_center', (0.0, -0.0085, Z0),
                        (0.0, 0.0085, Z0), 0.0101, 'steel', vertices=28))

    # ---- вал + валики (вращаются) --------------------------------------
    rotating.append(cyl(PREFIX + 'shaft', (0.0, -0.1240, Z0), (0.0, 0.1180, Z0),
                        SHAFT_R, 'steel', vertices=24))
    for tag, sy in (('left', 1.0), ('right', -1.0)):
        cy = sy * TUB_Y
        for i, dy in enumerate((-ROLLER_DY, 0.0, ROLLER_DY), start=1):
            yc = cy + dy
            rotating.append(roller(PREFIX + f'roller_{tag}_{i}',
                                   yc - ROLLER_LEN * 0.5, yc + ROLLER_LEN * 0.5))

    # ---- пульт с двумя циановыми индикаторами (торец) -------------------
    cube(PREFIX + 'control_panel', (0.2135, 0.0, 0.0470),
         (0.010, 0.118, 0.030), 'graphite', r=0.0022)
    for tag, sy in (('left', 1.0), ('right', -1.0)):
        sphere(PREFIX + f'led_{tag}', (0.2185, sy * 0.030, 0.0470), 0.0042, 'cyan',
               segs=18, rings=12)

    # ---- привод сбоку (+Y) ---------------------------------------------
    cube(PREFIX + 'drive_bracket', (0.0, 0.1150, 0.0315),
         (0.054, 0.0330, 0.0150), 'steel', r=0.0022)
    cube(PREFIX + 'gearbox', (0.0, (GEAR_Y0 + GEAR_Y1) * 0.5, Z0),
         (0.060, GEAR_Y1 - GEAR_Y0, 0.044), 'graphite', r=0.0035)
    cyl(PREFIX + 'gearbox_ring', (0.0, GEAR_Y0 - 0.0035, Z0), (0.0, GEAR_Y0, Z0),
        0.0200, 'steel', vertices=32, bev=0.0015)
    cyl(PREFIX + 'motor', (0.0, MOTOR_Y0, Z0), (0.0, MOTOR_Y1, Z0), MOTOR_R,
        'ivory', vertices=40, bev=0.0035)
    cyl(PREFIX + 'motor_band', (0.0, 0.1445, Z0), (0.0, 0.1505, Z0), MOTOR_R + 0.0010,
        'blush', vertices=40, bev=0.0015)
    cyl(PREFIX + 'motor_cap', (0.0, MOTOR_Y1, Z0), (0.0, MOTOR_Y1 + 0.0065, Z0),
        MOTOR_R - 0.0035, 'graphite', vertices=32, bev=0.0018)
    cyl(PREFIX + 'motor_mount', (0.0, MOTOR_Y0 + 0.004, Z0 - 0.017),
        (0.0, MOTOR_Y1 - 0.010, Z0 - 0.017), 0.0055, 'steel', vertices=16)

    # кабель + разъём
    cube(PREFIX + 'strain_relief', (0.028, MOTOR_Y1 + 0.0038, Z0 - 0.0090),
         (0.012, 0.012, 0.013), 'graphite', r=0.0022)
    curve_tube(PREFIX + 'cable',
               [(0.028, MOTOR_Y1 + 0.0062, Z0 - 0.0120),
                (0.024, MOTOR_Y1 + 0.0082, Z0 - 0.0240),
                (-0.008, 0.1560, 0.0290),
                (-0.058, 0.1420, 0.0210),
                (-0.096, 0.1265, 0.0175)], 0.0034, 'graphite')
    cube(PREFIX + 'connector', (-0.1070, 0.1225, 0.0175),
         (0.023, 0.015, 0.011), 'graphite', r=0.0022)

    # ---- анимационная пустышка ровно на оси вала -----------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    anim['axis_blender'] = 'Y'
    anim['axis_three_js'] = 'Z'
    anim['rad_per_s'] = 1.1
    bpy.context.view_layer.update()   # иначе matrix_world ещё identity и дети съедут
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
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, math.radians(90), 0.0)   # вокруг оси вала = Y
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    roller = bpy.data.objects[PREFIX + 'roller_left_2']
    r_mn, r_mx = mesh_bbox([roller])
    shaft = bpy.data.objects[PREFIX + 'shaft']
    s_mn, s_mx = mesh_bbox([shaft])
    bed = bpy.data.objects[PREFIX + 'bed_heel_left']
    b_mn2, b_mx2 = mesh_bbox([bed])

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.46 and size.y <= 0.31 and size.z <= 0.16),
        'anim_name': anim.name,
        'anim_loc': [round(v, 6) for v in anim.location],
        'anim_on_shaft_axis': bool((Vector(anim.location) - Vector((0.0, 0.0, Z0))).length < 1e-6),
        'anim_axis_blender': 'Y',
        'anim_axis_three_js': 'Z',
        'rad_per_s': 1.1,
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 4),
        'pivot_ok': bool(pivot_shift < 0.001),
        'roller_z_center': round((r_mn.z + r_mx.z) * 0.5, 5),
        'roller_diameter': round(r_mx.z - r_mn.z, 5),
        'roller_top_above_bed': round(r_mx.z - b_mx2.z, 5),
        'shaft_y_span': [round(s_mn.y, 5), round(s_mx.y, 5)],
        'materials': sorted(m.name for m in bpy.data.materials),
        'non_children_static': sorted(o.name for o in bpy.data.objects
                                      if o.name.startswith(PREFIX)
                                      and o.type == 'MESH' and o not in kids),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
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
    if not path.is_file() or path.stat().st_size < 12000:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok'] or not rep['pivot_ok'] or not rep['anim_on_shaft_axis']:
        raise SystemExit('checks failed')


main()
