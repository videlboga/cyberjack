"""Standalone builder: support_cradle (SUP-CRAD-01, «Опоры-ложементы»).

Пара регулируемых опор-ложементов: машинная станина на регулируемых ножках
с передним/задним выносом и 4 x M12, телескопическая стойка (3 ступени) с
ручным маховиком, двумя фиксаторами-зажимами и шкалой высоты, сверху —
жёлоб-ложе с мягким анатомическим ложементом, подкладкой, ремнями и
петлями. Без движения (motion none) — узла __anim нет.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_support_cradle.py

Выход:
  public/models/machine-modules/components/support_cradle.glb
  docs/plans/blockout/component-library/support_cradle/*.png (+300 px)
  docs/plans/blockout/component-library/support_cradle/report.json

Геометрия (Blender Z-up, метры):
  две опоры зеркально по X: центры x = -0.29 и +0.29
  габарит по паспорту 0.90 x 0.60 x 0.48..0.96
  собрано на середине хода: верх ложемента 0.722, ход 2 x 0.24 = 0.48
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/support_cradle'
CID = 'support_cradle'
PREFIX = CID + '__'

# --- паспорт -------------------------------------------------------------
PASS = {'x': 0.90, 'y': 0.60, 'z_min': 0.48, 'z_max': 0.96}
UNIT_X = 0.29                       # центры опор

# --- станина -------------------------------------------------------------
FOOT_R, FOOT_Z = 0.017, 0.012
FOOT_XY = (0.128, 0.128)
PLINTH = (0.160, 0.160, 0.028)      # полугабарит X, Y, радиус угла
PLINTH_Z = (0.012, 0.052)
OUT_Y = (0.145, 0.298)              # вынос вперёд/назад
OUT_X, OUT_Z = 0.052, (0.016, 0.050)
BODY_LEVELS = [(0.052, 0.140, 0.130, 0.022),
               (0.100, 0.143, 0.133, 0.022),
               (0.200, 0.138, 0.128, 0.020),
               (0.235, 0.128, 0.118, 0.016)]
TOP = (0.150, 0.140, 0.024)         # полугабарит X, Y, радиус угла
TOP_Z = (0.235, 0.258)

# --- стойка --------------------------------------------------------------
SOCK_R, SOCK_Z = 0.072, (0.258, 0.284)
SLEEVE_R, SLEEVE_Z = 0.050, (0.284, 0.412)     # ступень 1 (неподвижная)
C1_R, C1_Z = 0.057, (0.404, 0.426)
STAGE2_R, STAGE2_Z = 0.036, (0.372, 0.516)     # ступень 2
C2_R, C2_Z = 0.042, (0.504, 0.524)
STAGE3_R, STAGE3_Z = 0.0245, (0.480, 0.612)    # ступень 3 -> ложе
TRAVEL_STAGE = 0.24                            # ход каждой ступени

# --- ложе ----------------------------------------------------------------
PLATE = (0.110, 0.200)
PLATE_Z = (0.640, 0.676)
BOSS_R, BOSS_Z = 0.044, (0.556, 0.640)
PAD_Y = (-0.190, 0.190)
PAD_ZTOP_MID, PAD_ZTOP_END = 0.716, 0.720
EXP = 2.4                                      # форма желоба
STRAP_Y = (-0.100, 0.100)
WHEEL_C = (0.0, -0.074, 0.338)                 # центр маховика (X, Y, Z)
WHEEL_R = 0.046

PALETTE = {
    'ivory': (0.960, 0.953, 0.934),
    'pale': (0.985, 0.972, 0.950),
    'silicone': (0.900, 0.872, 0.828),
    'blush': (0.915, 0.672, 0.706),
    'steel': (0.648, 0.656, 0.646),
    'graphite': (0.230, 0.236, 0.248),
    'dark': (0.110, 0.116, 0.128),
    'red': (0.780, 0.140, 0.120),
    'cyan': (0.640, 0.900, 0.930),
}
ROUGH = {'ivory': 0.46, 'pale': 0.54, 'silicone': 0.80, 'blush': 0.60,
         'steel': 0.30, 'graphite': 0.52, 'dark': 0.86, 'red': 0.38,
         'cyan': 0.22}
METAL = {'steel': 0.90, 'graphite': 0.35}
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
        bsdf.inputs['Emission Strength'].default_value = 0.75
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
                                            depth=d.length,
                                            location=(a + b) * 0.5)
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


def sphere(name, loc, radius, role, segs=18, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=32, rings=10):
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


def rr_2d(hx, hy, r, seg=5):
    """Прямоугольник со скруглёнными углами в плане (XY)."""
    pts = []
    for cx, cy, a0 in ((hx - r, hy - r, 0.0), (-(hx - r), hy - r, 90.0),
                       (-(hx - r), -(hy - r), 180.0), (hx - r, -(hy - r), 270.0)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90.0 * k / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def loft(bm, rings, cap_start=True, cap_end=True):
    n = len(rings[0])
    for i in range(len(rings) - 1):
        a_, b_ = rings[i], rings[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((a_[k], a_[k2], b_[k2], b_[k]))
    if cap_start:
        bm.faces.new(list(reversed(rings[0])))
    if cap_end:
        bm.faces.new(list(rings[-1]))


def prism(name, levels, role, seg=5, bevel_w=0.0, smooth=False):
    bm = bmesh.new()
    rings = []
    for (z, hx, hy, cr) in levels:
        rings.append([bm.verts.new((x, y, z)) for (x, y) in rr_2d(hx, hy, cr, seg)])
    loft(bm, rings)
    obj = mesh_from_bm(name, bm, role, smooth)
    if bevel_w > 0:
        bevel(obj, bevel_w, 2)
    return obj


# --- профиль ложемента ---------------------------------------------------
def shape_f(t):
    """0 на торцах, 1 в середине — плавное сужение ложа к краям."""
    return max(0.0, math.sin(math.pi * min(max(t, 0.0), 1.0))) ** 0.45


def pad_hx(t):
    return 0.070 + 0.016 * shape_f(t)


def pad_dep(t):
    return 0.038 + 0.014 * shape_f(t)


def pad_ztop(t):
    return PAD_ZTOP_MID + (PAD_ZTOP_END - PAD_ZTOP_MID) * (1.0 - shape_f(t))


def pan_hx(t):
    return pad_hx(t) + 0.012


def pan_dep(t):
    return pad_dep(t) + 0.006


def pan_ztop(t):
    return pad_ztop(t) - 0.010


TS = [i / 40.0 for i in range(41)]
PAD_ZBOT = round(PLATE_Z[1] - 0.026, 6)
PAN_ZBOT = round(min(pan_ztop(t) - pan_dep(t) for t in TS) - 0.004, 6)
LIN_ZBOT = round(min(pad_ztop(t) - pad_dep(t) for t in TS) - 0.004, 6)


def u_ring(hx, depth, z_top, z_bot, n=20, taper=0.86, rr=0.010):
    """Замкнутый профиль ложемента XZ: чаша, скруглённая кромка, борта, низ."""
    hxe = max(hx - rr, 0.004)
    z_wall = z_top - rr
    pts = []
    for k in range(4, 0, -1):                   # правая кромка: низ-наружу -> верх-внутрь
        th = math.radians(90.0 * k / 4.0)
        pts.append((hxe + rr * math.sin(th), z_wall + rr * math.cos(th)))
    for i in range(n + 1):                      # чаша от +X к -X
        a = math.pi * i / n
        ca, sa = math.cos(a), math.sin(a)
        pts.append((hxe * math.copysign(abs(ca) ** (2.0 / EXP), ca),
                    z_top - depth * abs(sa) ** (2.0 / EXP)))
    for k in range(1, 5):                       # левая кромка: верх-внутрь -> низ-наружу
        th = math.radians(90.0 - 90.0 * k / 4.0)
        pts.append((-(hxe + rr * math.cos(th)), z_wall + rr * math.sin(th)))
    for f in (0.45, 0.80):                      # левый борт вниз
        xb = hx * (1.0 - (1.0 - taper) * f)
        pts.append((-xb, z_wall - (z_wall - z_bot) * f))
    pts.append((-hx * taper, z_bot))
    pts.append((hx * taper, z_bot))
    for f in (0.80, 0.45):                      # правый борт вверх
        xb = hx * (1.0 - (1.0 - taper) * f)
        pts.append((xb, z_wall - (z_wall - z_bot) * f))
    return pts


def trough(name, role, hx_f, dep_f, ztop_f, zbot, y_ext=0.0, ny=24, nx=18,
           taper=0.86):
    """Жёлоб: профиль u_ring по Y; y_ext — вынос торцов за габарит ложа."""
    y0, y1 = PAD_Y[0] - y_ext, PAD_Y[1] + y_ext
    bm = bmesh.new()
    rings = []
    for j in range(ny + 1):
        t = j / ny
        y = y0 + (y1 - y0) * t
        prof = u_ring(hx_f(t), dep_f(t), ztop_f(t), zbot, nx, taper)
        rings.append([bm.verts.new((x, y, z)) for (x, z) in prof])
    loft(bm, rings)
    return mesh_from_bm(name, bm, role, True)


def strap(name, y, width, role, th=0.0045, n=34):
    """Ремень по поверхности ложемента: от кромки справа до кромки слева."""
    t = (y - PAD_Y[0]) / (PAD_Y[1] - PAD_Y[0])
    hx, dep, zt = pad_hx(t), pad_dep(t), pad_ztop(t)
    rr = 0.010
    hxe = max(hx - rr, 0.004)
    zc = zt - dep
    surf = []
    for i in range(n + 1):
        a = math.pi * i / n
        ca, sa = math.cos(a), math.sin(a)
        surf.append((hxe * math.copysign(abs(ca) ** (2.0 / EXP), ca),
                     zt - dep * abs(sa) ** (2.0 / EXP)))
    for k in range(1, 5):                       # заход на правую кромку
        th = math.radians(90.0 * k / 4.0)
        surf.insert(0, (hxe + rr * math.sin(th), zt - rr + rr * math.cos(th)))
    for k in range(1, 5):                       # заход на левую кромку
        th = math.radians(90.0 - 90.0 * k / 4.0)
        surf.append((-(hxe + rr * math.cos(th)), zt - rr + rr * math.sin(th)))

    bm = bmesh.new()
    rings = []
    for i, (x, z) in enumerate(surf):
        nv = Vector((x, 0.0, z - zc))
        nv = nv.normalized() if nv.length > 1e-6 else Vector((0.0, 0.0, 1.0))
        inner = Vector((x, 0.0, z)) + nv * 0.0015
        outer = Vector((x, 0.0, z)) + nv * (0.0015 + th)
        rings.append([bm.verts.new((inner.x, y - width * 0.5, inner.z)),
                      bm.verts.new((inner.x, y + width * 0.5, inner.z)),
                      bm.verts.new((outer.x, y + width * 0.5, outer.z)),
                      bm.verts.new((outer.x, y - width * 0.5, outer.z))])
    loft(bm, rings)
    return mesh_from_bm(name, bm, role, True)


def hex_head(name, loc, r, h, role='steel', bev=0.0008):
    return cyl(name, (loc[0], loc[1], loc[2]), (loc[0], loc[1], loc[2] + h),
               r, role, vertices=6, smooth=False, bev=bev)


# --- сборка одной опоры --------------------------------------------------
def build_side(tag, ox, objs):
    def add(o):
        o.location.x += ox
        objs.append(o)
        return o

    n = lambda part: f'{PREFIX}{part}_{tag}'

    # ---- ножки, плита, выносы, анкеры -----------------------------------
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        add(cyl(n(f'foot_{i}'), (sx * FOOT_XY[0], sy * FOOT_XY[1], 0.0),
                (sx * FOOT_XY[0], sy * FOOT_XY[1], FOOT_Z), FOOT_R,
                'dark', vertices=20, bev=0.0012))
    add(prism(n('plinth'), [(PLINTH_Z[0], PLINTH[0], PLINTH[1], PLINTH[2]),
                            (PLINTH_Z[0] + 0.012, PLINTH[0], PLINTH[1], PLINTH[2]),
                            (PLINTH_Z[1], PLINTH[0] - 0.002, PLINTH[1] - 0.002,
                             PLINTH[2] - 0.002)],
              'ivory', seg=6, bevel_w=0.0020))

    for i, sy in enumerate((-1, 1)):
        y0, y1 = sorted((sy * OUT_Y[0], sy * OUT_Y[1]))
        add(cube(n(f'outrigger_{i}'), (0.0, (y0 + y1) * 0.5, 0.033),
                 (OUT_X * 2, y1 - y0, OUT_Z[1] - OUT_Z[0]), 'ivory', r=0.007))
        # пятка выноса под анкер M12
        add(cube(n(f'pad_{i}'), (0.0, sy * 0.276, 0.030),
                 (0.092, 0.048, 0.032), 'graphite', r=0.007))
        add(cyl(n(f'anchor_washer_{i}'), (0.0, sy * 0.276, OUT_Z[1]),
                (0.0, sy * 0.276, OUT_Z[1] + 0.005), 0.0160, 'steel',
                vertices=24, bev=0.0008))
        add(hex_head(n(f'anchor_bolt_{i}'), (0.0, sy * 0.276, OUT_Z[1] + 0.005),
                     0.0115, 0.016))

    # ---- корпус станины ------------------------------------------------
    add(prism(n('body'), BODY_LEVELS, 'ivory', seg=6, bevel_w=0.0024))
    add(prism(n('top_plate'), [(TOP_Z[0], TOP[0], TOP[1], TOP[2]),
                               (TOP_Z[0] + 0.008, TOP[0], TOP[1], TOP[2]),
                               (TOP_Z[1], TOP[0] - 0.003, TOP[1] - 0.003,
                                TOP[2] - 0.002)],
              'ivory', seg=6, bevel_w=0.0026))
    add(cube(n('body_panel'), (0.0, -0.1275, 0.150), (0.208, 0.013, 0.128),
             'graphite', r=0.0022))
    for i in range(3):
        add(cube(n(f'louver_{i}'), (0.0, -0.1355, 0.122 + i * 0.030),
                 (0.152, 0.007, 0.0085), 'dark', r=0.0012))
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        add(cube(n(f'rib_{i}'), (sx * 0.1425, sy * 0.070, 0.148),
                 (0.010, 0.030, 0.150), 'ivory', r=0.0022))
    for i in range(2):
        add(cube(n(f'vent_{i}'), (0.0, -0.1315, 0.072 - i * 0.015),
                 (0.088, 0.008, 0.006), 'dark', r=0.0012))

    # шильдик
    add(cube(n('nameplate'), (0.0, -0.1300, 0.219), (0.116, 0.006, 0.030),
             'graphite', r=0.0010))
    bm = bmesh.new()
    for i, w in enumerate((0.072, 0.052, 0.038)):
        x0 = -w * 0.5
        bmesh.ops.create_cube(bm, size=1.0,
                               matrix=(Matrix.Translation((x0 + w * 0.5, -0.1338,
                                                           0.2262 - i * 0.0062))
                                       @ Matrix.Diagonal((w, 0.0024, 0.0028, 1.0))))
    add(mesh_from_bm(n('nameplate_bars'), bm, 'pale', False))
    for i, sx in enumerate((-1, 1)):
        add(cyl(n(f'nameplate_screw_{i}'), (sx * 0.046, -0.1332, 0.2145),
                (sx * 0.046, -0.1332, 0.2205), 0.0030, 'graphite',
                vertices=12, bev=0.0005))
    add(sphere(n('led'), (0.096, -0.108, 0.2595), 0.0050, 'cyan'))
    add(cyl(n('grommet'), (0.0, 0.100, TOP_Z[1]), (0.0, 0.100, TOP_Z[1] + 0.010),
            0.013, 'graphite', vertices=20, bev=0.0012))

    # ---- стойка: гнездо, ступени, хомуты --------------------------------
    add(cyl(n('socket'), (0, 0, SOCK_Z[0]), (0, 0, SOCK_Z[1]), SOCK_R,
            'graphite', vertices=40, bev=0.0022))
    bm = bmesh.new()
    for k in range(4):
        a = math.tau * k / 4 + math.radians(45)
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6,
                              radius1=0.0058, radius2=0.0058, depth=0.006,
                              matrix=Matrix.Translation((0.060 * math.cos(a),
                                                         0.060 * math.sin(a),
                                                         SOCK_Z[1] + 0.003)))
    add(mesh_from_bm(n('socket_screws'), bm, 'steel', False))

    add(cyl(n('sleeve'), (0, 0, SLEEVE_Z[0]), (0, 0, SLEEVE_Z[1]), SLEEVE_R,
            'ivory', vertices=44, bev=0.0024))
    add(cyl(n('sleeve_collar'), (0, 0, C1_Z[0]), (0, 0, C1_Z[1]), C1_R,
            'graphite', vertices=40, bev=0.0018))
    add(cyl(n('stage2'), (0, 0, STAGE2_Z[0]), (0, 0, STAGE2_Z[1]), STAGE2_R,
            'steel', vertices=36, bev=0.0016))
    add(cyl(n('stage2_collar'), (0, 0, C2_Z[0]), (0, 0, C2_Z[1]), C2_R,
            'graphite', vertices=36, bev=0.0016))
    add(cyl(n('stage3'), (0, 0, STAGE3_Z[0]), (0, 0, STAGE3_Z[1]), STAGE3_R,
            'steel', vertices=28, bev=0.0012))

    # ---- фиксаторы (зажимные рычаги) -----------------------------------
    add(cube(n('lock_block_a'), (C1_R + 0.008, -0.014, 0.415),
             (0.032, 0.028, 0.024), 'graphite', r=0.0020))
    add(cyl(n('lock_lever_a'), (C1_R + 0.020, -0.014, 0.415),
            (C1_R + 0.058, -0.014, 0.402), 0.0058, 'graphite',
            vertices=16, bev=0.0009))
    add(sphere(n('lock_knob_a'), (C1_R + 0.064, -0.014, 0.400), 0.0092,
               'graphite'))
    add(cube(n('lock_block_b'), (-(C2_R + 0.008), 0.0, 0.514),
             (0.026, 0.024, 0.019), 'graphite', r=0.0016))
    add(cyl(n('lock_lever_b'), (-(C2_R + 0.019), 0.0, 0.514),
            (-(C2_R + 0.050), 0.0, 0.502), 0.0050, 'graphite',
            vertices=14, bev=0.0008))
    add(sphere(n('lock_knob_b'), (-(C2_R + 0.055), 0.0, 0.501), 0.0082,
               'graphite'))

    # ---- маховик --------------------------------------------------------
    wx, wy, wz = WHEEL_C
    add(cyl(n('wheel_shaft'), (0, -SLEEVE_R + 0.004, wz), (wx, wy - 0.008, wz),
            0.012, 'steel', vertices=16, bev=0.0010))
    add(torus(n('wheel_rim'), (wx, wy, wz), WHEEL_R, 0.0080, 'graphite',
              axis='Y', segs=40, rings=10))
    add(cyl(n('wheel_hub'), (wx, wy - 0.010, wz), (wx, wy + 0.010, wz), 0.016,
            'graphite', vertices=24, bev=0.0014))
    bm = bmesh.new()
    for k in range(5):
        a = math.tau * k / 5 + math.radians(18)
        p0 = Vector((0.013 * math.cos(a), wy, wz + 0.013 * math.sin(a)))
        p1 = Vector((WHEEL_R * math.cos(a), wy, wz + WHEEL_R * math.sin(a)))
        d = p1 - p0
        mtx = (Matrix.Translation((p0 + p1) * 0.5)
               @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=10,
                              radius1=0.0050, radius2=0.0042, depth=d.length,
                              matrix=mtx)
    add(mesh_from_bm(n('wheel_spokes'), bm, 'graphite', True))
    add(cyl(n('wheel_crank'), (wx + WHEEL_R * 0.60, wy - 0.006, wz + 0.040),
            (wx + WHEEL_R * 0.60, wy - 0.028, wz + 0.040), 0.0052, 'steel',
            vertices=14, bev=0.0008))
    add(sphere(n('wheel_crank_knob'), (wx + WHEEL_R * 0.60, wy - 0.035,
                                       wz + 0.040), 0.0090, 'graphite'))

    # ---- шкала высоты ---------------------------------------------------
    add(cube(n('scale_boss'), (-0.030, -0.044, 0.345), (0.019, 0.013, 0.148),
             'graphite', r=0.0014))
    bm = bmesh.new()
    z0, z1 = SLEEVE_Z[0] + 0.008, SLEEVE_Z[1] - 0.004
    for i in range(9):
        z = z0 + (z1 - z0) * i / 8.0
        w = 0.0115 if i % 2 == 0 else 0.0078
        h = 0.0022 if i % 2 == 0 else 0.0017
        bmesh.ops.create_cube(bm, size=1.0,
                              matrix=(Matrix.Translation((-0.030 - 0.0095 + w * 0.5,
                                                          -0.0515, z))
                                      @ Matrix.Diagonal((w, 0.0020, h, 1.0))))
    add(mesh_from_bm(n('scale_ticks'), bm, 'steel', False))
    add(cube(n('scale_pointer'), (-0.030, -0.0545, C2_Z[0] + 0.004),
             (0.015, 0.006, 0.005), 'red', r=0.0007))

    # ---- ложе: плита, рёбра, жёлоб, ложемент ---------------------------
    add(cyl(n('saddle_boss'), (0, 0, BOSS_Z[0]), (0, 0, BOSS_Z[0] + 0.030),
            BOSS_R - 0.014, 'graphite', vertices=32, bev=0.0018))
    add(cyl(n('saddle_neck'), (0, 0, BOSS_Z[0] + 0.030), (0, 0, BOSS_Z[1]),
            BOSS_R, 'graphite', vertices=32, r2=BOSS_R - 0.006, bev=0.0018))
    add(prism(n('saddle_plate'), [(PLATE_Z[0], PLATE[0], PLATE[1], 0.026),
                                  (PLATE_Z[0] + 0.004, PLATE[0], PLATE[1], 0.026),
                                  (PLATE_Z[1], PLATE[0] - 0.003,
                                   PLATE[1] - 0.003, 0.024)],
              'ivory', seg=6, bevel_w=0.0038))
    for i, sx in enumerate((-1, 1)):
        add(cube(n(f'saddle_rib_{i}'), (sx * 0.050, 0.0, 0.628),
                 (0.044, 0.052, 0.030), 'ivory', r=0.006))
    for i, sx in enumerate((-1, 1)):
        add(hex_head(n(f'saddle_bolt_{i}'), (sx * 0.086, 0.0, PLATE_Z[1]),
                     0.0068, 0.008))

    for i, sx in enumerate((-1, 1)):
        add(cube(n(f'cheek_{i}'), (sx * 0.096, 0.0, 0.692),
                 (0.010, 0.396, 0.036), 'ivory', r=0.0040))
    add(trough(n('pad'), 'blush', pad_hx, pad_dep, pad_ztop, PAD_ZBOT, ny=24,
               taper=0.88))
    add(trough(n('pad_lining'), 'silicone',
               lambda t: 0.034 + 0.010 * shape_f(t),
               lambda t: 0.0060,
               lambda t: pad_ztop(t) - pad_dep(t) + 0.0090, LIN_ZBOT,
               y_ext=-0.008, ny=24, taper=0.80))

    # ремни с пряжками и хвостами
    for i, sy in enumerate(STRAP_Y):
        add(strap(n(f'strap_{i}'), sy, 0.040, 'graphite', th=0.0050))
        tp = (sy - PAD_Y[0]) / (PAD_Y[1] - PAD_Y[0])
        bx = pad_hx(tp) + 0.008
        bz = pad_ztop(tp) - 0.010
        add(cube(n(f'buckle_{i}'), (bx, sy, bz + 0.004), (0.022, 0.044, 0.016),
                 'steel', r=0.0024))
        add(cube(n(f'buckle_slot_{i}'), (bx + 0.0045, sy, bz + 0.004),
                 (0.010, 0.026, 0.007), 'dark', r=0.0008))
        add(cube(n(f'strap_tail_{i}'), (bx + 0.004, sy, bz - 0.026),
                 (0.005, 0.030, 0.036), 'graphite', r=0.0008))
    # петли (D-кольца) по бокам ложа
    for i, sx in enumerate((-1, 1)):
        add(torus(n(f'loop_{i}'), (sx * 0.104, 0.0, 0.688),
                  0.013, 0.0032, 'steel', axis='X', segs=24, rings=8))
    return objs


def build():
    reset()
    objs = []
    build_side('left', -UNIT_X, objs)
    build_side('right', UNIT_X, objs)
    bpy.context.view_layer.update()
    for o in objs:
        o['motion'] = 'static'
    return objs


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


def check():
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    names = sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX))
    bad = sorted(o.name for o in bpy.data.objects if not o.name.startswith(PREFIX))
    pad = bpy.data.objects[PREFIX + 'pad_left']
    p_mn, p_mx = mesh_bbox([pad])
    travel = 2 * TRAVEL_STAGE
    h_min = round(p_mx.z - travel / 2, 4)
    h_max = round(p_mx.z + travel / 2, 4)
    return {
        'component': CID,
        'code': 'SUP-CRAD-01',
        'nodes': len(names),
        'objects_total': len(bpy.data.objects),
        'mesh_objects': len(meshes),
        'node_names': names,
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_passport_m': [PASS['x'], PASS['y'], f'{PASS["z_min"]}..{PASS["z_max"]}'],
        'bbox_ok': bool(abs(size.x - PASS['x']) < 0.012
                        and abs(size.y - PASS['y']) < 0.012
                        and PASS['z_min'] <= size.z <= PASS['z_max']),
        'floor_contact_z': round(mn.z, 5),
        'pad_top_z_built': round(p_mx.z, 4),
        'column_travel_m': round(travel, 4),
        'height_min_m': h_min,
        'height_max_m': h_max,
        'height_range_ok': bool(abs(h_min - PASS['z_min']) < 0.02
                                and abs(h_max - PASS['z_max']) < 0.02),
        'both_units': bool(all(bpy.data.objects.get(PREFIX + f'{p}_{s}')
                               for p in ('pad', 'sleeve', 'plinth', 'wheel_rim')
                               for s in ('left', 'right'))),
        'handwheels': len([o for o in bpy.data.objects
                           if o.name.startswith(PREFIX + 'wheel_rim')]),
        'locks': len([o for o in bpy.data.objects if 'lock_lever' in o.name]),
        'm12_bolts': len([o for o in bpy.data.objects
                          if 'anchor_bolt' in o.name]),
        'straps': len([o for o in bpy.data.objects
                       if o.name.startswith(PREFIX + 'strap_')
                       and 'tail' not in o.name]),
        'height_scales': len([o for o in bpy.data.objects
                              if 'scale_ticks' in o.name]),
        'nameplates': len([o for o in bpy.data.objects
                           if o.name.startswith(PREFIX + 'nameplate_')
                           and 'bar' not in o.name and 'screw' not in o.name]),
        'material_count': len([m for m in bpy.data.materials
                               if m.name.startswith('CJ_')]),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_node': bool(bpy.data.objects.get(PREFIX + 'anim')),
        'no_anim_ok': bpy.data.objects.get(PREFIX + 'anim') is None,
        'bad_names': bad,
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


# --- рендеры -------------------------------------------------------------
def render_views(mn, mx):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1380
    scene.render.resolution_y = 1080
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    scene.view_settings.exposure = 0.0
    try:
        scene.eevee.taa_render_samples = 96
        scene.eevee.shadow_ray_count = 4
        scene.eevee.shadow_step_count = 8
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.560, 0.556, 0.548, 1.0)
    bg.inputs['Strength'].default_value = 0.35

    center = (mn + mx) * 0.5
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.300, 0.298, 0.292, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.85, -1.05, 1.40), 15.0, 0.70),
            ('fill', (-1.05, -0.80, 0.72), 4.5, 1.20),
            ('rim', (0.15, 1.10, 1.25), 11.0, 0.90)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc)
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 78
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
            need = max(need, abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z)) for x in (a.x, b.x)
                for y in (a.y, b.y) for z in (a.z, b.z)]

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

    c_main = box_corners(mn - center, mx - center)
    close_t = Vector((-UNIT_X, -0.02, mx.z - 0.13))
    c_close = box_corners(Vector((-UNIT_X - 0.19, -0.20, 0.26)) - close_t,
                          Vector((-UNIT_X + 0.19, 0.20, mx.z + 0.01)) - close_t)
    close_objs = [o for o in mesh_objs
                  if mesh_bbox([o])[0].x < -0.06 and mesh_bbox([o])[1].z > 0.24]

    views = [
        ('3q', (0.72, -0.94, 0.46), center + Vector((0, 0, 0.01)), 78,
         c_main, 0.94, None),
        ('front', (1.00, -0.10, 0.10), center + Vector((0, 0, 0.02)), 78,
         c_main, 0.90, None),
        ('side', (0.02, -1.00, 0.08), center + Vector((0, 0, 0.01)), 78,
         c_main, 0.92, None),
        ('closeup', (0.60, -0.86, 0.28), close_t, 90, c_close, 0.96,
         close_objs),
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
        print(f'RENDERED {tag} fill={max_ndc(fill, focus):.3f} {fp}', flush=True)

    # миниатюры 300 px по ширине — контроль читаемости силуэта
    for tag in ('3q', 'front', 'side', 'closeup'):
        src = RENDER_DIR / f'{CID}_{tag}.png'
        img = bpy.data.images.load(str(src))
        w = 300
        h = max(1, int(round(w * img.size[1] / img.size[0])))
        img.scale(w, h)
        thumb = RENDER_DIR / f'{CID}_{tag}_300px.png'
        img.filepath_raw = str(thumb)
        img.file_format = 'PNG'
        img.save()
        outs.append(str(thumb.relative_to(PROJECT)))
        print(f'THUMB {thumb} {w}x{h}', flush=True)
    return outs


def verify_glb(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    return {
        'glb_nodes': len(objs),
        'glb_meshes': len(meshes),
        'glb_materials': sorted(m.name for m in bpy.data.materials
                                if m.name.startswith('CJ_')),
        'glb_bbox_size_xyz': [round(v, 5) for v in size],
        'glb_anim_node': bool(bpy.data.objects.get(PREFIX + 'anim')),
        'glb_left_parts': len([o for o in objs if 'left' in o.name]),
        'glb_roundtrip_ok': bool(abs(size.x - PASS['x']) < 0.012
                                 and abs(size.y - PASS['y']) < 0.012
                                 and PASS['z_min'] <= size.z <= PASS['z_max']
                                 and len(meshes) >= 60),
    }


def main():
    build()
    rep = check()
    mn = Vector(rep['bbox_min'])
    mx = Vector(rep['bbox_max'])
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views(mn, mx)
    rep['glb_verify'] = verify_glb(path)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps({k: v for k, v in rep.items()
                                  if k != 'node_names'}, ensure_ascii=False),
          flush=True)
    v = rep['glb_verify']
    if not (rep['bbox_ok'] and rep['both_units'] and rep['no_anim_ok']
            and rep['height_range_ok'] and rep['material_count'] >= 4
            and not rep['bad_names'] and rep['glb_bytes'] > 10000
            and v['glb_roundtrip_ok']):
        raise SystemExit('checks failed')


main()