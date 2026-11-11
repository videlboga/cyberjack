"""Standalone builder: sensory_visor (SNS-VIS-02, «Визор»).

Маска-визор на голову: молочный композитный корпус-скорлупа с вырезом под
панорамный экран, мягкий силиконовый обтюратор по лицу, тёмный изогнутый
экран с циановой подсветкой HUD, камера eye-трекинга в верхней рамке,
боковые шарниры-диски, ремень с пряжкой на затылке, кабель с разъёмом,
LED-индикаторы и вентиляционные прорези. Без плиты, без вращений,
без анимации. Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_sensory_visor.py

Выход:
  public/models/machine-modules/components/sensory_visor.glb
  docs/plans/blockout/component-library/sensory_visor/*.png

Геометрия (Blender Z-up, метры, лицевая сторона = -Y):
  габарит по паспорту 0,20 x 0,15 x 0,10; после сборки модель опускается
  на пол (z_min = 0), как остальные компоненты библиотеки.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/sensory_visor'
CID = 'sensory_visor'
PREFIX = CID + '__'

PASSPORT = (0.200, 0.150, 0.100)     # X, Y, Z по component-catalog.json

# --- параметры скорлупы ---------------------------------------------------
RX, RY = 0.0960, 0.0680            # эллипс обвода (полуоси по X / Y)
BULGE = 0.030                       # выпуклость по высоте
Z_TOP = 0.0470                      # верхняя кромка корпуса
Z_BOT = -0.0445                     # нижняя кромка по бокам
NOTCH = 0.0190                      # вырез под переносицу (подъём к центру)
NOTCH_HW = math.radians(21.0)
A_MAX = math.radians(78.0)          # угловой охват корпуса
SHELL_T = 0.0042                    # толщина скорлупы

# проём под экран (в параметрах угла/высоты)
A_AP = math.radians(46.8)
Z_AP0, Z_AP1 = -0.0225, 0.0325

PALETTE = {
    'milk': (0.908, 0.900, 0.879),
    'soft': (0.965, 0.955, 0.936),
    'graphite': (0.112, 0.119, 0.132),
    'dark': (0.026, 0.030, 0.038),
    'steel': (0.700, 0.706, 0.700),
    'cyan': (0.470, 0.880, 0.930),
    'red': (0.790, 0.085, 0.070),
    'strap': (0.140, 0.155, 0.176),
}
ROUGH = {'milk': 0.55, 'soft': 0.93, 'graphite': 0.42, 'dark': 0.09,
         'steel': 0.27, 'cyan': 0.35, 'red': 0.35, 'strap': 0.88}
METAL = {'steel': 0.92, 'graphite': 0.55, 'dark': 0.30}
EMIT = {'cyan': 2.2, 'red': 1.7}
MATS = {}


# --- helpers --------------------------------------------------------------
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
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = METAL.get(role, 0.0)
    if role in EMIT:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = EMIT[role]
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


def apply_mod(obj, mod):
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def bevel(obj, width=0.0012, segments=2, angle=40.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    apply_mod(obj, mod)


def weld(obj, dist=1e-6):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()


def solidify(obj, thickness, offset=-1.0):
    mod = obj.modifiers.new('sol', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = offset
    # even offset даёт «шипы» на углах выреза проёма — держим выключенным
    mod.use_even_offset = False
    apply_mod(obj, mod)


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


def curve_tube(name, points, radius, role, res=8, resolution=12):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = resolution
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
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


# --- параметрическая поверхность корпуса ----------------------------------
def bulge(z):
    t = (z - Z_BOT) / (Z_TOP - Z_BOT)
    t = min(1.0, max(0.0, t))
    return 1.0 + BULGE * math.sin(math.pi * t)


def pnt(a, z, off=0.0):
    """Точка обвода: a=0 -> нос (-Y), a=+90° -> правый бок (+X)."""
    s = bulge(z)
    return Vector(((RX * s + off) * math.sin(a),
                   -(RY * s + off) * math.cos(a),
                   z))


def z_bottom(a):
    u = a / NOTCH_HW
    bump = 0.5 * (1.0 + math.cos(math.pi * u)) if abs(u) < 1.0 else 0.0
    return Z_BOT + NOTCH * bump


def konst(v):
    return lambda a, _v=v: _v


def add_patch(bm, a0, a1, na, z_lo, z_hi, nz, off=0.0):
    """Лофт-патч по (угол, высота); z_lo/z_hi — функции от угла."""
    rows = []
    for j in range(nz + 1):
        f = j / nz
        row = []
        for i in range(na + 1):
            a = a0 + (a1 - a0) * i / na
            z = z_lo(a) + (z_hi(a) - z_lo(a)) * f
            row.append(bm.verts.new(pnt(a, z, off)))
        rows.append(row)
    for j in range(nz):
        for i in range(na):
            bm.faces.new((rows[j][i], rows[j][i + 1],
                          rows[j + 1][i + 1], rows[j + 1][i]))
    return rows


def surf_obj(name, role, patches, off=0.0, thickness=0.0, bev=0.0, smooth=True,
             sol_offset=-1.0):
    bm = bmesh.new()
    for (a0, a1, na, lo, hi, nz) in patches:
        add_patch(bm, a0, a1, na, lo, hi, nz, off)
    obj = mesh_from_bm(name, bm, role, smooth)
    weld(obj)
    if thickness > 0:
        solidify(obj, thickness, sol_offset)
    if bev > 0:
        bevel(obj, bev, 2, 45.0)
    return obj


def tube_path(bm, pts, r, seg=12, closed=False):
    n = len(pts)
    tans = []
    for i in range(n):
        if closed:
            t = pts[(i + 1) % n] - pts[(i - 1) % n]
        else:
            t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        tans.append(t.normalized())
    ref = Vector((0, 0, 1)) if abs(tans[0].z) < 0.9 else Vector((1, 0, 0))
    u = (ref - tans[0] * ref.dot(tans[0])).normalized()
    rings = []
    for i in range(n):
        t = tans[i]
        u = u - t * u.dot(t)
        if u.length < 1e-6:
            ref = Vector((0, 0, 1)) if abs(t.z) < 0.9 else Vector((1, 0, 0))
            u = ref - t * ref.dot(t)
        u.normalize()
        v = t.cross(u)
        rings.append([bm.verts.new(pts[i] + (u * math.cos(math.tau * k / seg)
                                             + v * math.sin(math.tau * k / seg)) * r)
                      for k in range(seg)])
    last = n if closed else n - 1
    for i in range(last):
        ra, rb = rings[i], rings[(i + 1) % n]
        for k in range(seg):
            try:
                bm.faces.new((ra[k], ra[(k + 1) % seg],
                              rb[(k + 1) % seg], rb[k]))
            except ValueError:
                pass
    return rings


def band_path(bm, pts, width, thick, up_hint=Vector((0, 0, 1))):
    """Плоская лента: ширина по up, толщина по нормали к ленте.
    width — число или список ширин по точкам."""
    n = len(pts)
    tans = []
    for i in range(n):
        t = pts[min(i + 1, n - 1)] - pts[max(i - 1, 0)]
        tans.append(t.normalized())
    rings = []
    for i in range(n):
        t = tans[i]
        side = t.cross(up_hint)
        if side.length < 1e-5:
            raise ValueError(f'band_path: degenerate frame at {pts[i]}')
        side.normalize()
        up = side.cross(t).normalized()
        w = width[i] if isinstance(width, (list, tuple)) else width
        hw, ht = w * 0.5, thick * 0.5
        rings.append([bm.verts.new(pts[i] + up * hw + side * ht),
                      bm.verts.new(pts[i] + up * hw - side * ht),
                      bm.verts.new(pts[i] - up * hw - side * ht),
                      bm.verts.new(pts[i] - up * hw + side * ht)])
    for i in range(n - 1):
        ra, rb = rings[i], rings[i + 1]
        for k in range(4):
            try:
                bm.faces.new((ra[k], ra[(k + 1) % 4], rb[(k + 1) % 4], rb[k]))
            except ValueError:
                pass
    return rings


def cap_ring(bm, ring):
    try:
        bm.faces.new(ring)
    except ValueError:
        pass


# --- сборка ---------------------------------------------------------------
def build():
    reset()
    made = []

    # ---- 1. корпус-скорлупа с вырезом под экран -------------------------
    brow = (-A_MAX, A_MAX, 48, konst(Z_AP1), konst(Z_TOP), 3)
    cheek = (-A_MAX, A_MAX, 48, z_bottom, konst(Z_AP0), 3)
    left = (-A_MAX, -A_AP, 10, konst(Z_AP0), konst(Z_AP1), 4)
    right = (A_AP, A_MAX, 10, konst(Z_AP0), konst(Z_AP1), 4)
    shell = surf_obj(PREFIX + 'shell', 'milk', [brow, cheek, left, right],
                     thickness=SHELL_T, bev=0.0014)
    made.append(shell)

    # ---- 2. рамка-безель вокруг проёма (растёт наружу) ------------------
    bez = [
        (-A_AP, A_AP, 34, konst(Z_AP1), konst(Z_AP1 + 0.0072), 1),
        (-A_AP, A_AP, 34, konst(Z_AP0 - 0.0072), konst(Z_AP0), 1),
        (-A_AP - 0.0054, -A_AP, 3, konst(Z_AP0), konst(Z_AP1), 4),
        (A_AP, A_AP + 0.0054, 3, konst(Z_AP0), konst(Z_AP1), 4),
    ]
    made.append(surf_obj(PREFIX + 'bezel', 'graphite', bez,
                         thickness=0.0045, bev=0.0010, sol_offset=1.0))

    # ---- 3. экран --------------------------------------------------------
    screen = surf_obj(PREFIX + 'screen', 'dark',
                      [(-A_AP - 0.004, A_AP + 0.004, 40,
                        lambda a: Z_AP0 - 0.0012, lambda a: Z_AP1 + 0.0012, 6)],
                      off=-0.0034, thickness=0.0018, bev=0.0006)
    made.append(screen)

    # ---- 4. HUD / подсветка кромки экрана -------------------------------
    bm = bmesh.new()
    for (a0, a1, z0, z1) in (
            (math.radians(-24), math.radians(20), 0.0080, 0.0098),
            (math.radians(-40), math.radians(-30), -0.0060, -0.0046),
            (math.radians(-40), math.radians(-33), -0.0108, -0.0094),
            (math.radians(-40), math.radians(-35), -0.0156, -0.0142),
            (math.radians(28), math.radians(34), 0.0100, 0.0176),
            (-A_AP + 0.02, A_AP - 0.02, Z_AP0 + 0.0018, Z_AP0 + 0.0040)):
        rows = []
        for f in (0.0, 1.0):
            row = []
            for i in range(25):
                a = a0 + (a1 - a0) * i / 24
                row.append(bm.verts.new(pnt(a, z0 + (z1 - z0) * f, -0.0028)))
            rows.append(row)
        for i in range(24):
            bm.faces.new((rows[0][i], rows[0][i + 1],
                          rows[1][i + 1], rows[1][i]))
    made.append(mesh_from_bm(PREFIX + 'screen_glow', bm, 'cyan', False))

    # ---- 5. обтюратор (мягкое уплотнение по лицу) -----------------------
    OFF_BROW, OFF_CHEEK = -0.0086, -0.0050
    Z_BROW = 0.0424
    Z_SIDE0 = z_bottom(A_MAX) + 0.0015
    ring_pts = []
    for i in range(41):
        a = -A_MAX + 2 * A_MAX * i / 40
        ring_pts.append(pnt(a, Z_BROW - 0.0016 * (a / A_MAX) ** 2, OFF_BROW))
    for i in range(1, 8):
        f = i / 7
        ring_pts.append(pnt(A_MAX,
                            (Z_BROW - 0.0016) + (Z_SIDE0 - Z_BROW + 0.0016) * f,
                            OFF_BROW + (OFF_CHEEK - OFF_BROW) * f))
    for i in range(41):
        a = A_MAX - 2 * A_MAX * i / 40
        ring_pts.append(pnt(a, z_bottom(a) + 0.0015, OFF_CHEEK))
    for i in range(1, 8):
        f = i / 7
        ring_pts.append(pnt(-A_MAX, Z_SIDE0 + (Z_BROW - 0.0016 - Z_SIDE0) * f,
                            OFF_CHEEK + (OFF_BROW - OFF_CHEEK) * f))
    bm = bmesh.new()
    tube_path(bm, ring_pts, 0.0062, seg=12, closed=True)
    made.append(mesh_from_bm(PREFIX + 'obturator', bm, 'soft', True))

    # носовая вставка-подушка в вырезе
    made.append(cube(PREFIX + 'nose_pad',
                     (0.0, -0.0615, Z_BOT + NOTCH - 0.0055),
                     (0.030, 0.016, 0.0110), 'soft', r=0.0034, smooth=True))

    # ---- 6. камера eye-трекинга в верхней рамке ------------------------
    cam_y = -(RY * bulge(0.0355) + 0.0045)
    made.append(cyl(PREFIX + 'eye_camera',
                    (0.0, cam_y + 0.0135, 0.0355), (0.0, cam_y - 0.0006, 0.0355),
                    0.0068, 'graphite', vertices=28, bev=0.0010))
    made.append(cyl(PREFIX + 'eye_lens',
                    (0.0, cam_y - 0.0004, 0.0355), (0.0, cam_y - 0.0012, 0.0355),
                    0.0046, 'dark', vertices=24))
    made.append(torus(PREFIX + 'eye_ring', (0.0, cam_y - 0.0008, 0.0355),
                      0.0068, 0.0012, 'steel', 'Y', segs=28, rings=8))

    # ---- 7. боковые шарниры + кронштейны --------------------------------
    for tag, sx in (('r', 1.0), ('l', -1.0)):
        p = pnt(sx * A_MAX, 0.0125, 0.0)
        made.append(cyl(PREFIX + f'hinge_boss_{tag}',
                        (sx * 0.0930, p.y, 0.0125), (sx * 0.0996, p.y, 0.0125),
                        0.0138, 'graphite', vertices=32, bev=0.0012))
        made.append(cyl(PREFIX + f'hinge_pin_{tag}',
                        (sx * 0.0982, p.y, 0.0125), (sx * 0.1000, p.y, 0.0125),
                        0.0054, 'steel', vertices=20))
        made.append(cube(PREFIX + f'hinge_yoke_{tag}',
                         (sx * 0.0936, 0.0042, 0.0142),
                         (0.0078, 0.0165, 0.0210), 'graphite', r=0.0018))

    # ---- 8. ремень: одна непрерывная лента от шарнира до шарнира ------
    strap_pts, strap_w = [], []
    n_st = 49
    for i in range(n_st):
        phi = math.radians(-90.0 + 180.0 * i / (n_st - 1))
        strap_pts.append(Vector((0.0950 * math.sin(phi),
                                 -0.0010 + 0.0685 * math.cos(phi),
                                 0.0140 + 0.0060 * math.cos(phi))))
        strap_w.append(0.0240 + 0.0060 * (0.5 + 0.5 * math.cos(phi)))
    bm = bmesh.new()
    rings = band_path(bm, strap_pts, strap_w, 0.0042)
    cap_ring(bm, rings[0])
    cap_ring(bm, list(reversed(rings[-1])))
    strap = mesh_from_bm(PREFIX + 'strap', bm, 'strap', False)
    bevel(strap, 0.0009, 2, 45.0)
    made.append(strap)

    # пряжка на затылке: рамка + язычок + хвост
    bz = 0.0200
    bars = ((0.0052, 0.0400, 0.0155, 0.0),
            (0.0052, 0.0400, -0.0155, 0.0),
            (0.0360, 0.0052, 0.0, 0.0192),
            (0.0360, 0.0052, 0.0, -0.0192))
    for i, (sx_, sz_, px, pz) in enumerate(bars):
        made.append(cube(PREFIX + f'buckle_bar_{i}',
                         (px, 0.0718, bz + pz), (sx_, 0.0052, sz_),
                         'steel', r=0.0011))
    made.append(cube(PREFIX + 'buckle_prong', (0.0028, 0.0736, bz),
                     (0.0220, 0.0030, 0.0032), 'steel', r=0.0008))
    bm = bmesh.new()
    t_pts = [Vector((0.0, 0.0716, bz - 0.0130)),
             Vector((0.0, 0.0732, bz - 0.0250)),
             Vector((0.0, 0.0706, bz - 0.0355))]
    rings = band_path(bm, t_pts, 0.0220, 0.0038, Vector((1, 0, 0)))
    cap_ring(bm, rings[0])
    cap_ring(bm, list(reversed(rings[-1])))
    made.append(mesh_from_bm(PREFIX + 'buckle_tail', bm, 'strap', False))

    # ---- 9. кабель + разъём (низ-слева) ---------------------------------
    a_ex = math.radians(-58.0)
    exit_p = pnt(a_ex, -0.0330, 0.0)
    out_v = Vector((math.sin(a_ex), -math.cos(a_ex), 0.0)).normalized()
    made.append(cyl(PREFIX + 'port',
                    exit_p - out_v * 0.0010, exit_p + out_v * 0.0062,
                    0.0078, 'graphite', vertices=24, bev=0.0012))
    made.append(cyl(PREFIX + 'strain_relief',
                    exit_p + out_v * 0.0050, exit_p + out_v * 0.0135,
                    0.0052, 'graphite', vertices=20, r2=0.0044, bev=0.0008))
    cab0 = exit_p + out_v * 0.0130
    made.append(curve_tube(PREFIX + 'cable',
                           [cab0,
                            Vector((-0.0925, -0.0290, -0.0410)),
                            Vector((-0.0900, -0.0040, -0.0472)),
                            Vector((-0.0800, 0.0250, -0.0486)),
                            Vector((-0.0700, 0.0450, -0.0430))],
                           0.0033, 'graphite'))
    made.append(cyl(PREFIX + 'connector',
                    (-0.0700, 0.0450, -0.0430), (-0.0640, 0.0560, -0.0405),
                    0.0060, 'graphite', vertices=20, bev=0.0010))
    made.append(cyl(PREFIX + 'connector_ferrule',
                    (-0.0640, 0.0560, -0.0405), (-0.0618, 0.0600, -0.0395),
                    0.0044, 'steel', vertices=18))
    made.append(cube(PREFIX + 'cable_clip', (-0.0855, 0.0100, -0.0478),
                     (0.0090, 0.0120, 0.0075), 'graphite', r=0.0016))

    # ---- 10. LED-индикаторы --------------------------------------------
    for tag, ang, role in (('status', math.radians(52.0), 'cyan'),
                           ('panic', math.radians(-52.0), 'red')):
        p = pnt(ang, 0.0300, 0.0)
        n = Vector((math.sin(ang), -math.cos(ang), 0.0)).normalized()
        made.append(cyl(PREFIX + f'led_socket_{tag}', p + n * 0.0010,
                        p + n * 0.0038, 0.0048, 'graphite',
                        vertices=18, bev=0.0008))
        made.append(cyl(PREFIX + f'led_{tag}', p + n * 0.0034,
                        p + n * 0.0050, 0.0034, role, vertices=16))

    # ---- 11. вентиляционные прорези на скулах --------------------------
    bm = bmesh.new()
    for sx in (1.0, -1.0):
        for k in range(4):
            a_c = math.radians((53.0 + k * 5.4) * sx)
            da = math.radians(1.15)
            add_patch(bm, a_c - da, a_c + da, 2,
                      konst(-0.0398), konst(-0.0300), 1, 0.0027)
    made.append(mesh_from_bm(PREFIX + 'vents', bm, 'dark', False))

    # ---- 12. гравировка-маркировка на брови ----------------------------
    bm = bmesh.new()
    for k in range(3):
        a0 = math.radians(9.0 + k * 4.2)
        add_patch(bm, a0, a0 + math.radians(2.4), 2,
                  konst(0.0372), konst(0.0388), 1, 0.0026)
    made.append(mesh_from_bm(PREFIX + 'brow_marks', bm, 'dark', False))

    # ---- посадка на пол + метки ---------------------------------------
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    for o in meshes:
        o.location.z -= mn.z
        o['part'] = o.name
        o['component'] = CID
    bpy.context.view_layer.update()
    return made


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


# --- проверки -------------------------------------------------------------
def check():
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    verts = sum(len(o.data.vertices) for o in meshes)
    tris = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in meshes)

    names = sorted(o.name for o in bpy.data.objects)
    bad = [n for n in names if not n.startswith(PREFIX)]
    dev = [abs(size[i] - PASSPORT[i]) / PASSPORT[i] for i in range(3)]

    screen = bpy.data.objects.get(PREFIX + 'screen')
    s_mn, s_mx = mesh_bbox([screen]) if screen else (mn, mx)
    s_size = s_mx - s_mn

    rep = {
        'component': CID,
        'code': 'SNS-VIS-02',
        'class': 'SENSORY',
        'nodes': len(names),
        'meshes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(PASSPORT),
        'bbox_dev_pct': [round(d * 100, 2) for d in dev],
        'bbox_ok': bool(max(dev) <= 0.04),
        'on_floor': bool(abs(mn.z) < 1e-4),
        'screen_size': [round(v, 5) for v in s_size],
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'verts': verts,
        'tris': tris,
        'parts': names,
        'bad_names': bad,
    }
    return rep, meshes


# --- экспорт --------------------------------------------------------------
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


# --- рендеры --------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.18
    try:
        scene.eevee.taa_render_samples = 128
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.740, 0.735, 0.725, 1.0)
    bg.inputs['Strength'].default_value = 0.38

    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(mesh_objs)
    center = (mn + mx) * 0.5
    S = max((mx - mn).x, (mx - mn).y)

    bpy.ops.mesh.primitive_plane_add(size=S * 4.0,
                                     location=(center.x, center.y, mn.z - 0.0002))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.470, 0.464, 0.455, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    # мощность площадных ламп ~ S^2 (иначе объект 0,2 м пересвечен)
    e_scale = (S / 2.0) ** 2
    for name, offset, energy, sz in (
            ('key', (0.55 * S, -0.85 * S, 0.95 * S), 96.0, 1.10 * S),
            ('fill', (-0.85 * S, -0.55 * S, 0.45 * S), 26.0, 1.30 * S),
            ('rim', (0.05 * S, 0.90 * S, 0.75 * S), 48.0, 1.00 * S)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy * e_scale
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(offset) + Vector((center.x, center.y, center.z))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 60
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

    def fit_dist(direction, lens, corners, margin=1.12):
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

    c_main = box_corners(mn - center, mx - center)
    # close-up: порт, кабель, кромка обтюратора, вентиляция
    close_t = Vector((-0.0700, -0.0300, 0.0210))
    close_w = 0.092

    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (-0.78, -0.80, 0.46), center, 58, 0.92, True, None),
        ('front', (0.02, -1.00, 0.14), center, 58, 0.97, True, None),
        ('side', (1.00, -0.10, 0.20), center, 58, 0.97, True, None),
        ('closeup', (-0.62, -0.74, 0.26), close_t, 72, 0.95, False, close_w),
    ]
    outs = []
    for tag, direction, target, lens, fill, fb, frame_w in views:
        cam_data.lens = lens
        if frame_w:
            fov = 2.0 * math.atan(cam_data.sensor_width * 0.5 / lens)
            dist = (frame_w * 0.5) / math.tan(fov * 0.5)
        else:
            dist = fit_dist(direction, lens, c_main, 1.06 if not fb else 1.12)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if fb:
            for _ in range(5):
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


def preview_300():
    outs = []
    for tag in ('3q', 'front', 'side', 'closeup'):
        src = RENDER_DIR / f'{CID}_{tag}.png'
        if not src.is_file():
            continue
        img = bpy.data.images.load(str(src))
        w, h = img.size
        nw = 300
        nh = max(1, round(h * nw / w))
        img.scale(nw, nh)
        dst = RENDER_DIR / f'{CID}_{tag}_300px.png'
        img.filepath_raw = str(dst)
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
        outs.append(str(dst.relative_to(PROJECT)))
    return outs


def main():
    build()
    rep, meshes = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    rep['previews_300px'] = preview_300()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['on_floor']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
