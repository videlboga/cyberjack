"""Standalone builder: restraint_stirrup (RST-ST-07, «Стремя»).

Жёсткое регулируемое стремя: широкое композитное ложе-чашка с мягким
вкладышем и рёбрами, две графитовые боковые стойки, верхняя молочная дуга,
шарнир стопы на оси Y с секторным ограничителем угла и стопорным винтом,
регулировочный ремень через подъём стопы с кам-пряжкой и хвостовиком,
быстросъёмный док с рычагом на верхней дуге и стальной D-ring на задней
проушине. Плиты-основания нет: стремя стоит на своих протекторах.

Вращения нет (motion: none), анимационная пустышка не нужна.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_restraint_stirrup.py

Выход:
  public/models/machine-modules/components/restraint_stirrup.glb
  docs/plans/blockout/component-library/restraint_stirrup/*.png
  docs/plans/blockout/component-library/restraint_stirrup/report.json

Геометрия (Blender Z-up, метры):
  носок стопы -> +X, пятка -> -X, ось шарнира = Y
  z=0 — плоскость протекторов, ложе стоит на полу
  X — длина ложа (паспорт 0,20), Y — ширина по стойкам (0,15),
  Z — высота по доку (0,10)
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/restraint_stirrup'
CID = 'restraint_stirrup'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
SOLE_X0, SOLE_X1 = -0.0820, 0.1040     # ложе 186 мм
SOLE_HW = 0.0485                       # полуширина ложа -> 97 мм
SOLE_ZB = 0.0070                       # низ ложа (протекторы 0..7 мм)
SOLE_T = 0.0075                        # толщина композита ложа

HX, HZ = -0.0700, 0.0460               # ось шарнира (пятка)
HINGE_EYE_R = 0.0115
HINGE_CAP_R = 0.0135
HINGE_Y_OUT = 0.0685                   # наружная плоскость проушины
HINGE_Y_CAP = 0.0735                   # наружная плоскость крышки
HINGE_Y_SOCK = 0.0746                  # гнездо под шестигранник

ARCH_X = -0.0260                       # плоскость верхней дуги
ARCH_Z = 0.0755                        # низ дуги по краям
ARCH_HALF = 0.0420
ARCH_RISE = 0.0040

MOUNT_Z = 0.0875                       # центр зажимного блока
DOCK_Z = 0.0960                        # центр стальной док-пластины

STRAP_X = 0.0200                       # плоскость ремня через подъём
STRAP_HALF = 0.0170                    # половина ширины ремня -> 34 мм
BUCKLE_Y = -0.0540                     # пряжка на ближней стороне (вид 3/4)
BUCKLE_Z = 0.0210

PALETTE = {
    'milk': (0.885, 0.872, 0.842),
    'graphite': (0.080, 0.084, 0.094),
    'steel': (0.600, 0.610, 0.625),
    'blush': (0.870, 0.560, 0.600),
    'silicone': (0.905, 0.700, 0.712),
    'dark': (0.030, 0.032, 0.038),
    'cream': (0.940, 0.925, 0.888),
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
    if role == 'steel':
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.28
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.15
        bsdf.inputs['Roughness'].default_value = 0.58
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.80
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.62 if role == 'milk' else 0.52
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


def bevel(obj, width=0.0010, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(35)
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


def cyl(name, a, b, radius, role, vertices=24, smooth=True, r2=None, bev=0.0):
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


def box(name, center, size, role, r=0.0010, rot=(0.0, 0.0, 0.0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if r > 0:
        bevel(obj, r, 2)
    return apply(obj, role, smooth)


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def ss(u, a, b):
    """Smoothstep с прижатием к границам."""
    if b <= a:
        return 1.0 if u >= b else 0.0
    t = min(max((u - a) / (b - a), 0.0), 1.0)
    return t * t * (3.0 - 2.0 * t)


def loft_tray(name, stations, t, role, smooth=True):
    """Ложе: U-образная лента, протянутая по X.

    station = (x, half_width, z_bottom_out, z_top_edge); сечение — замкнутый
    контур из 12 точек: наружная стенка с фаской, дно и внутренняя стенка.
    """
    bm = bmesh.new()
    rings = []
    for (x, hw, zb, zt) in stations:
        c = max(0.0006, min(0.0050, hw * 0.30, (zt - zb - t) * 0.45))
        loop = [(-hw, zt), (-hw, zb + c), (-hw + c, zb),
                (hw - c, zb), (hw, zb + c), (hw, zt),
                (hw - t, zt), (hw - t, zb + t + c),
                (hw - t - c, zb + t), (-(hw - t - c), zb + t),
                (-(hw - t), zb + t + c), (-(hw - t), zt)]
        rings.append([bm.verts.new((x, y, z)) for (y, z) in loop])
    n = len(rings[0])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    caps = [bm.faces.new(rings[0]), bm.faces.new(tuple(reversed(rings[-1])))]
    bmesh.ops.triangulate(bm, faces=caps)
    return mesh_from_bm(name, bm, role, smooth)


def band(name, pts, thick_x, width, role, smooth=True, bev_w=0.0):
    """Лента по пути в плоскости YZ: толщина thick_x по X, width по нормали."""
    pts = [Vector(p) for p in pts]
    bm = bmesh.new()
    rings = []
    for i, p in enumerate(pts):
        if i == 0:
            tan = pts[1] - p
        elif i == len(pts) - 1:
            tan = p - pts[-2]
        else:
            tan = pts[i + 1] - pts[i - 1]
        tan.x = 0.0
        if tan.length < 1e-9:
            tan = Vector((0.0, 0.0, 1.0))
        tan.normalize()
        nrm = Vector((0.0, -tan.z, tan.y))
        hx, hw = thick_x * 0.5, width * 0.5
        rings.append([
            bm.verts.new(p + Vector((sx * hx, 0.0, 0.0)) + nrm * (sy * hw))
            for sx, sy in ((-1, -1), (-1, 1), (1, 1), (1, -1))])
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    obj = mesh_from_bm(name, bm, role, smooth)
    if bev_w > 0:
        bevel(obj, bev_w, 2)
    return obj


def arc_plate(name, cz, y0, y1, r0, r1, a0, a1, seg, role):
    """Сектор в плоскости XZ вокруг (HX, HZ), протянутый по Y."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        ca, sa = math.cos(a), math.sin(a)
        quad = []
        for y in (y0, y1):
            for r in (r0, r1):
                quad.append(bm.verts.new((HX + ca * r, y, cz + sa * r)))
        rings.append(quad)
    for i in range(seg):
        A, B = rings[i], rings[i + 1]
        bm.faces.new((A[0], A[1], B[1], B[0]))
        bm.faces.new((A[3], A[2], B[2], B[3]))
        bm.faces.new((A[0], A[3], B[3], B[0]))
        bm.faces.new((A[1], A[2], B[2], B[1]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    return mesh_from_bm(name, bm, role, False)


def rect_ring(name, center, u, v, w, su, sv, bar, thick, role, bev=0.0007):
    """Прямоугольная рамка: u,v - плоскость окна, w - толщина."""
    center = Vector(center)
    u, v, w = (Vector(x).normalized() for x in (u, v, w))
    bm = bmesh.new()
    lo, hi = [], []
    for sgn_w, store in ((-0.5, lo), (0.5, hi)):
        for layer in (0, 1):
            su2 = su * 0.5 if layer == 0 else su * 0.5 - bar
            sv2 = sv * 0.5 if layer == 0 else sv * 0.5 - bar
            quad = []
            for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1)):
                quad.append(bm.verts.new(
                    center + u * (sx * su2) + v * (sy * sv2)
                    + w * (sgn_w * thick)))
            store.append(quad)
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((lo[0][i], lo[0][j], lo[1][j], lo[1][i]))
        bm.faces.new((lo[0][i], hi[0][i], hi[0][j], lo[0][j]))
        bm.faces.new((lo[1][i], lo[1][j], hi[1][j], hi[1][i]))
        bm.faces.new((hi[0][i], hi[0][j], hi[1][j], hi[1][i]))
    obj = mesh_from_bm(name, bm, role, False)
    if bev > 0:
        bevel(obj, bev, 2)
    return obj


def tube_path(name, pts, normal, rt, role, seg=10):
    """Труба по замкнутому плоскому контуру (D-ring)."""
    N = Vector(normal).normalized()
    pts = [Vector(p) for p in pts]
    n = len(pts)
    bm = bmesh.new()
    rings = []
    for i in range(n):
        t = pts[(i + 1) % n] - pts[(i - 1) % n]
        if t.length < 1e-9:
            t = Vector((1.0, 0.0, 0.0))
        t.normalize()
        n1 = t.cross(N)
        if n1.length < 1e-6:
            n1 = t.cross(Vector((0.0, 0.0, 1.0)))
        n1.normalize()
        n2 = n1.cross(t).normalized()
        rings.append([bm.verts.new(pts[i]
                                   + n1 * (rt * math.cos(math.tau * k / seg))
                                   + n2 * (rt * math.sin(math.tau * k / seg)))
                      for k in range(seg)])
    for i in range(n):
        A, B = rings[i], rings[(i + 1) % n]
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((A[k], A[k2], B[k2], B[k]))
    return mesh_from_bm(name, bm, role, True)


# --- сборка --------------------------------------------------------------
def tray_profile(u, shrink=0.0, lift=0.0, zt_off=0.0):
    hw = SOLE_HW - 0.0100 * ss(u, 0.55, 0.97) - shrink
    zt = (0.0230
          + 0.0140 * (1.0 - ss(u, 0.0, 0.26)) ** 1.3
          + 0.0210 * ss(u, 0.60, 1.00) ** 1.5
          + zt_off)
    return hw, SOLE_ZB + lift, zt


def tray_stations(n=26):
    return [(SOLE_X0 + (SOLE_X1 - SOLE_X0) * i / (n - 1),)
            + tray_profile(i / (n - 1)) for i in range(n)]


def liner_stations(n=26):
    """Вкладыш: тонкий U-профиль на внутренней поверхности ложа."""
    out = []
    for i in range(n):
        u = i / (n - 1)
        hw, zb, zt = tray_profile(u, shrink=SOLE_T + 0.0006,
                                  lift=SOLE_T + 0.0002,
                                  zt_off=-0.0018)
        out.append((SOLE_X0 + (SOLE_X1 - SOLE_X0) * u, hw, zb, zt))
    return out


def build():
    reset()
    parts = []

    # ---- ложе-чашка -----------------------------------------------------
    parts.append(loft_tray(PREFIX + 'sole_cradle', tray_stations(26),
                            SOLE_T, 'milk'))
    # мягкий вкладыш: сидит на внутренней поверхности ложа
    parts.append(loft_tray(PREFIX + 'sole_liner', liner_stations(26),
                           0.0026, 'silicone'))

    # поперечные рёбра вкладыша
    bm = bmesh.new()
    for x in (0.046, 0.066, 0.086):
        bmesh.ops.create_cube(
            bm, size=1.0,
            matrix=(Matrix.Translation((x, 0.0, 0.0190))
                    @ Matrix.Diagonal((0.005, 0.058, 0.0032, 1.0))))
    parts.append(mesh_from_bm(PREFIX + 'grip_ribs', bm, 'dark', False))

    # протекторы под ложем: стоят на полу
    bm = bmesh.new()
    for x in (-0.060, -0.026, 0.030, 0.072):
        bmesh.ops.create_cube(
            bm, size=1.0,
            matrix=(Matrix.Translation((x, 0.0, 0.0035))
                    @ Matrix.Diagonal((0.028, 0.076, 0.0070, 1.0))))
    parts.append(mesh_from_bm(PREFIX + 'tread_pads', bm, 'dark', False))

    # задняя стенка-чашка + мягкая накладка на пятку
    parts.append(box(PREFIX + 'heel_guard', (-0.0835, 0.0, 0.0310),
                     (0.0100, 0.0890, 0.0400), 'milk', r=0.0035,
                     rot=(0.0, math.radians(7.0), 0.0), smooth=True))
    parts.append(box(PREFIX + 'heel_pad', (-0.0762, 0.0, 0.0290),
                     (0.0060, 0.0720, 0.0300), 'silicone', r=0.0025,
                     rot=(0.0, math.radians(7.0), 0.0), smooth=True))

    # ---- шарнир стопы: проушины, ось, крышки -----------------------------
    for side, sy in (('r', 1.0), ('l', -1.0)):
        parts.append(band(PREFIX + f'hinge_lug_{side}',
                          [(-0.0715, sy * 0.0465, 0.0225),
                           (-0.0710, sy * 0.0525, 0.0340),
                           (-0.0702, sy * 0.0580, 0.0450)],
                          0.0125, 0.0110, 'milk'))
        parts.append(cyl(PREFIX + f'hinge_eye_{side}',
                         (HX, sy * 0.0580, HZ), (HX, sy * HINGE_Y_OUT, HZ),
                         HINGE_EYE_R, 'steel', vertices=28, bev=0.0012))
        parts.append(cyl(PREFIX + f'hinge_cap_{side}',
                         (HX, sy * HINGE_Y_OUT, HZ),
                         (HX, sy * HINGE_Y_CAP, HZ),
                         HINGE_CAP_R, 'steel', vertices=28, bev=0.0015))
        parts.append(cyl(PREFIX + f'hinge_socket_{side}',
                         (HX, sy * HINGE_Y_CAP, HZ),
                         (HX, sy * HINGE_Y_SOCK, HZ),
                         0.0048, 'dark', vertices=6, smooth=False))
    parts.append(cyl(PREFIX + 'hinge_axle', (HX, -HINGE_Y_OUT, HZ),
                     (HX, HINGE_Y_OUT, HZ), 0.0045, 'steel', vertices=18))

    # ограничитель угла: сектор на наружной стороне правой проушины
    parts.append(arc_plate(PREFIX + 'limiter_arc', HZ, 0.0702, 0.0742,
                           0.0255, 0.0360,
                           math.radians(-44.0), math.radians(16.0), 22,
                           'graphite'))
    parts.append(cyl(PREFIX + 'limiter_lock',
                     (HX + 0.0305 * math.cos(math.radians(-10.0)), 0.0680,
                      HZ + 0.0305 * math.sin(math.radians(-10.0))),
                     (HX + 0.0305 * math.cos(math.radians(-10.0)), 0.0770,
                      HZ + 0.0305 * math.sin(math.radians(-10.0))),
                     0.0050, 'steel', vertices=16, bev=0.0008))
    parts.append(box(PREFIX + 'limiter_handle',
                     (HX + 0.0305 * math.cos(math.radians(-10.0)), 0.0735,
                      HZ + 0.0305 * math.sin(math.radians(-10.0))),
                     (0.0075, 0.0045, 0.0165), 'steel', r=0.0012,
                     rot=(math.radians(-10.0), 0.0, 0.0)))
    bm = bmesh.new()
    for a_deg in (-34.0, -20.0, -2.0):
        a = math.radians(a_deg)
        bmesh.ops.create_cone(
            bm, cap_ends=True, cap_tris=False, segments=10,
            radius1=0.0026, radius2=0.0026, depth=0.0012,
            matrix=(Matrix.Translation(
                        (HX + 0.0320 * math.cos(a), 0.0744,
                         HZ + 0.0320 * math.sin(a)))
                    @ Vector((0.0, 1.0, 0.0)).to_track_quat('Z', 'Y')
                    .to_matrix().to_4x4()))
    parts.append(mesh_from_bm(PREFIX + 'limiter_holes', bm, 'dark', False))

    # ---- боковые стойки и верхняя дуга ----------------------------------
    arm_path = [(-0.0700, 0.0600, 0.0490),
                (-0.0660, 0.0655, 0.0575),
                (-0.0560, 0.0680, 0.0660),
                (-0.0440, 0.0650, 0.0720),
                (-0.0320, 0.0560, 0.0752),
                (-0.0265, 0.0455, 0.0758)]
    for side, sy in (('r', 1.0), ('l', -1.0)):
        pts = [(x, sy * y, z) for (x, y, z) in arm_path]
        parts.append(band(PREFIX + f'arm_{side}', pts, 0.0135, 0.0135,
                          'graphite', bev_w=0.0022))
        # молочный башмак стойки у шарнира
        parts.append(box(PREFIX + f'arm_shoe_{side}',
                         (-0.0695, sy * 0.0608, 0.0505),
                         (0.0175, 0.0135, 0.0145), 'milk', r=0.0030,
                         rot=(0.0, math.radians(-14.0), 0.0), smooth=True))

    ARCH_HALF = 0.0465
    arch_pts = []
    for i in range(13):
        y = -ARCH_HALF + 2.0 * ARCH_HALF * i / 12
        arch_pts.append((ARCH_X, y,
                         ARCH_Z + ARCH_RISE * (1.0 - (y / ARCH_HALF) ** 2)))
    parts.append(band(PREFIX + 'arch', arch_pts, 0.0240, 0.0125, 'milk',
                      bev_w=0.0024))

    # ---- ремень через подъём стопы + пряжка ------------------------------
    strap_pts = [(-0.0515, 0.0155), (-0.0500, 0.0240), (-0.0360, 0.0355),
                 (-0.0120, 0.0405), (0.0120, 0.0405), (0.0360, 0.0355),
                 (0.0500, 0.0240), (0.0515, 0.0155)]
    parts.append(band(PREFIX + 'strap',
                      [(STRAP_X, y, z) for (y, z) in strap_pts],
                      2.0 * STRAP_HALF, 0.0040, 'dark', bev_w=0.0008))
    for side, sy in (('l', -1.0), ('r', 1.0)):
        parts.append(box(PREFIX + f'strap_lug_{side}',
                         (STRAP_X, sy * 0.0505, 0.0195),
                         (0.0380, 0.0075, 0.0110), 'graphite', r=0.0016))

    # кам-пряжка на правом конце ремня
    parts.append(rect_ring(PREFIX + 'buckle_frame',
                            (STRAP_X, BUCKLE_Y, BUCKLE_Z),
                            (1, 0, 0), (0, 0, 1), (0, 1, 0),
                            0.0360, 0.0260, 0.0040, 0.0030, 'steel'))
    parts.append(cyl(PREFIX + 'buckle_roller',
                     (STRAP_X - 0.0155, BUCKLE_Y + 0.0015, BUCKLE_Z + 0.0072),
                     (STRAP_X + 0.0155, BUCKLE_Y + 0.0015, BUCKLE_Z + 0.0072),
                     0.0032, 'dark', vertices=14))
    parts.append(box(PREFIX + 'buckle_cam',
                     (STRAP_X - 0.0010, BUCKLE_Y - 0.0042, BUCKLE_Z + 0.0010),
                     (0.0260, 0.0045, 0.0170), 'steel', r=0.0012,
                     rot=(math.radians(8.0), 0.0, 0.0)))
    parts.append(band(PREFIX + 'strap_tail',
                      [(STRAP_X - 0.0020, -0.0525, 0.0210),
                       (STRAP_X, -0.0545, 0.0130),
                       (STRAP_X + 0.0015, -0.0555, 0.0055)],
                      0.0280, 0.0035, 'dark', bev_w=0.0007))

    # ---- быстросъёмный док сверху ---------------------------------------
    parts.append(box(PREFIX + 'mount_block', (ARCH_X, 0.0, MOUNT_Z),
                     (0.0300, 0.0380, 0.0100), 'graphite', r=0.0022,
                     smooth=True))
    parts.append(box(PREFIX + 'dock_plate', (ARCH_X, 0.0, DOCK_Z),
                     (0.0360, 0.0420, 0.0070), 'steel', r=0.0016))
    parts.append(box(PREFIX + 'dock_slot', (ARCH_X, 0.0, DOCK_Z + 0.0038),
                     (0.0200, 0.0130, 0.0016), 'dark', r=0.0004))
    parts.append(cyl(PREFIX + 'qr_pin', (-0.0200, 0.0240, 0.0902),
                     (-0.0200, 0.0240, 0.0988), 0.0035, 'steel',
                     vertices=16))
    parts.append(box(PREFIX + 'qr_lever', (-0.0180, 0.0390, 0.0945),
                     (0.0130, 0.0300, 0.0080), 'graphite', r=0.0018))
    parts.append(box(PREFIX + 'qr_grip', (-0.0165, 0.0555, 0.0945),
                     (0.0130, 0.0080, 0.0080), 'blush', r=0.0022,
                     smooth=True))

    # ---- D-ring на задней проушине --------------------------------------
    parts.append(box(PREFIX + 'dring_tab', (-0.0455, 0.0, 0.0890),
                     (0.0115, 0.0160, 0.0105), 'milk', r=0.0022,
                     smooth=True))
    ring = [(-0.0400, 0.0, 0.0930), (-0.0512, 0.0, 0.0930),
            (-0.0625, 0.0, 0.0930)]
    for i in range(1, 17):
        a = math.pi + math.pi * i / 17.0
        ring.append((-0.0512 + 0.0113 * math.cos(a), 0.0,
                     0.0930 + 0.0113 * math.sin(a)))
    parts.append(tube_path(PREFIX + 'dring', ring, (0, 1, 0), 0.0032, 'steel',
                           seg=10))

    bpy.context.view_layer.update()
    return parts


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
    return mesh_bbox([bpy.data.objects[name]])


def check(parts):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    names = sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX))

    s_mn, s_mx = part_bbox(PREFIX + 'sole_cradle')
    l_mn, l_mx = part_bbox(PREFIX + 'sole_liner')
    st_mn, st_mx = part_bbox(PREFIX + 'strap')
    a_mn, a_mx = part_bbox(PREFIX + 'arch')
    d_mn, d_mx = part_bbox(PREFIX + 'dring')
    k_mn, k_mx = part_bbox(PREFIX + 'dock_plate')
    h_mn, h_mx = part_bbox(PREFIX + 'hinge_axle')
    u_strap = (STRAP_X - SOLE_X0) / (SOLE_X1 - SOLE_X0)
    liner_top_at_strap = liner_stations(26)[
        int(round(u_strap * 25))][3]

    rep = {
        'component': CID,
        'code': 'RST-ST-07',
        'nodes': len(names),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_target_passport': [0.20, 0.15, 0.10],
        'bbox_axes_note': 'X=длина ложа с пяткой, Y=ширина по стойкам, '
                          'Z=высота по доку',
        'bbox_ok': bool(size.x <= 0.205 and size.y <= 0.155
                        and size.z <= 0.105),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'sole_length_mm': round((s_mx.x - s_mn.x) * 1000, 1),
        'sole_width_mm': round((s_mx.y - s_mn.y) * 1000, 1),
        'sole_depth_mm': round((s_mx.z - s_mn.z) * 1000, 1),
        'liner_top_mm': round(l_mx.z * 1000, 1),
        'strap_peak_mm': round(st_mx.z * 1000, 1),
        'liner_top_at_strap_mm': round(liner_top_at_strap * 1000, 1),
        'strap_clearance_over_liner_mm': round(
            (st_mx.z - liner_top_at_strap) * 1000, 1),
        'strap_width_mm': round((st_mx.x - st_mn.x) * 1000, 1),
        'arch_span_mm': round((a_mx.y - a_mn.y) * 1000, 1),
        'arch_top_mm': round(a_mx.z * 1000, 1),
        'hinge_axis': 'Y',
        'hinge_axis_loc': [HX, round(HZ, 4)],
        'hinge_cap_span_mm': round((h_mx.y - h_mn.y) * 1000, 1),
        'dock_top_mm': round(k_mx.z * 1000, 1),
        'dring_bbox_mm': [round((d_mx.x - d_mn.x) * 1000, 1),
                          round((d_mx.z - d_mn.z) * 1000, 1)],
        'materials': sorted(m.name for m in bpy.data.materials if m.users),
        'material_count': len([m for m in bpy.data.materials if m.users]),
        'parts': names,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
        'plate': False,
    }
    rep['strap_ok'] = bool(6.0 <= rep['strap_clearance_over_liner_mm'] <= 45.0)
    rep['sole_ok'] = bool(170.0 <= rep['sole_length_mm'] <= 195.0
                          and 90.0 <= rep['sole_width_mm'] <= 125.0)
    return rep


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objects:
        o['component'] = CID
        o['motion'] = 'none'
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
    scene.view_settings.exposure = 0.0
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

    bpy.ops.mesh.primitive_plane_add(size=4,
                                     location=(center.x, center.y,
                                               mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.32, -0.34, 0.34), 1.85, 0.34),
            ('fill', (-0.34, -0.26, 0.18), 0.68, 0.46),
            ('rim', (0.06, 0.34, 0.30), 1.10, 0.38)):
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

    def fit_dist(direction, lens, corners, margin=1.14):
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
    # крупный план: пряжка, ремень, хвостовик, ограничитель
    close_t = Vector((0.0240, -0.0420, 0.0300))
    c_close = box_corners(Vector((-0.0420, -0.0720, 0.0040)) - close_t,
                          Vector((0.0640, -0.0040, 0.0540)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0,
                            abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (1.05, -0.72, 0.50), center, 70, c_main, 0.90),
        ('front', (1.00, 0.10, 0.26), center, 70, c_main, 0.90),
        ('side', (0.04, 1.00, 0.13), center, 70, c_main, 0.90),
        ('closeup', (0.52, -0.82, 0.34), close_t, 80, c_close, 0.94),
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
            got = max_ndc(fill)
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
        print(f'RENDERED {tag} fill={max_ndc(fill):.3f} {fp}', flush=True)
    return outs


def main():
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['sole_ok']
            and rep['strap_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
