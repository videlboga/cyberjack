"""Standalone builder: work_tickle_radial (WRK-TIC-03, «Радиальная щётка»).

Тонкий вращающийся диск с плотным венцом радиальных пучков: несущая розетка
Ø 80 мм, стальные прижимные фланцы, ступица на арборе, 432 пучка по внешнему
радиусу (вершины на Ø 148 мм). Ось вращения = X через ступицу. Кожуха нет:
рабочая поверхность — открытый венец; привод — ротационный док по оси -X с
монтажной плитой и опорой шпинделя. Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_tickle_radial.py

Выход:
  public/models/machine-modules/components/work_tickle_radial.glb
  docs/plans/blockout/component-library/work_tickle_radial/*.png + report.json

Геометрия (Blender Z-up, метры):
  ось диска     = X, y=0, z=Z0
  anim-пустышка = (0, 0, Z0) — ровно центр ступицы/диска
  вращаются:  core, core_band, flange_front, flange_rear, hub, hub_ring, arbor,
              washer, nut, flange_bolts, bristles_crown, bristles_crown_blush
  статичны:   dock_body, dock_band, dock_collar, dock_lugs, dock_seal,
              dock_index, release_lever, release_pin, strain_relief, cable,
              connector, led, rating_marks, name_plate, dock_screws,
              bearing_boss, bearing_flange, mount_plate, mount_gasket,
              mount_bolts, dock_fin_a..d
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/work_tickle_radial'
CID = 'work_tickle_radial'
PREFIX = CID + '__'
CODE = 'WRK-TIC-03'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.080                  # высота оси/центра диска

CORE_R = 0.0400             # несущая розетка Ø 0.080
CORE_X = 0.0105             # полуширина диска
FLANGE_R = 0.0345           # стальной прижимной фланец Ø 0.069
FLANGE_T = 0.0022
HUB_R = 0.0185              # графитовая ступица
HUB_X = 0.0170
ARBOR_R = 0.0058

TUFT_R0 = 0.0335            # корень пучка — внутри розетки
TUFT_R1 = 0.0740            # вершины -> внешний Ø 0.148
TUFT_LEN = TUFT_R1 - TUFT_R0
TUFT_RB = 0.0017
TUFT_RT = 0.00085
TUFT_W = 1.35               # пучок плоский: шире по касательной
TUFT_T = 0.95
SWEEP = 0.055               # лёгкий наклон по ходу вращения
SECTORS = 48                # 90° = ровно 12 шагов -> точный pivot-тест
ROWS = 9
ROW_SPAN = 0.0095
FLARE = math.radians(5.0)   # крайние ряды отгибаются наружу по X

# привод-док: корпус, байонетное кольцо, опора шпинделя, монтажная плита
DOCK_X0, DOCK_X1 = -0.0610, -0.0345
DOCK_R = 0.0215
COLLAR_X0, COLLAR_X1 = -0.0350, -0.0272
COLLAR_R = 0.0262

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.978, 0.972, 0.957),
    'steel': (0.712, 0.716, 0.706),
    'graphite': (0.300, 0.312, 0.326),
    'dark': (0.185, 0.194, 0.212),
    'blush': (0.895, 0.680, 0.706),
    'rose': (0.845, 0.545, 0.578),
    'pale': (0.968, 0.905, 0.902),
    'cyan': (0.750, 0.900, 0.920),
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
    bsdf.inputs['Metallic'].default_value = 0.28 if role in ('steel', 'graphite') else 0.0
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.45
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
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


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


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


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=48, rings=8):
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


def arc_shell(name, x0, x1, r_in, r_out, a0, a1, seg, role, cy=0.0, cz=Z0):
    """Тонкая оболочка-сектор вокруг оси X: a=0 -> +Z, a>0 -> +Y."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        dy, dz = math.sin(a), math.cos(a)
        ring = []
        for x in (x0, x1):
            for r in (r_in, r_out):
                ring.append(bm.verts.new((x, cy + dy * r, cz + dz * r)))
        rings.append(ring)
    for i in range(seg):
        a_, b_ = rings[i], rings[i + 1]
        bm.faces.new((a_[0], a_[2], b_[2], b_[0]))   # inner
        bm.faces.new((a_[1], b_[1], b_[3], a_[3]))   # outer
        bm.faces.new((a_[0], a_[1], b_[1], b_[0]))   # x0 side
        bm.faces.new((a_[2], a_[3], b_[3], b_[2]))   # x1 side
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    return mesh_from_bm(name, bm, role, True)


def arc_tube(name, x, r, a0, a1, minor, role, segs=40, msegs=10):
    """Труба по дуге радиуса r в плоскости YZ при заданном x."""
    bm = bmesh.new()
    rings = []
    for i in range(segs + 1):
        a = a0 + (a1 - a0) * i / segs
        cy, cz = math.sin(a) * r, Z0 + math.cos(a) * r
        ring = []
        for j in range(msegs):
            b = math.tau * j / msegs
            rr, axx = math.cos(b) * minor, math.sin(b) * minor
            ring.append(bm.verts.new((x + axx, cy + rr * math.sin(a),
                                      cz + rr * math.cos(a))))
        rings.append(ring)
    for i in range(segs):
        for j in range(msegs):
            j2 = (j + 1) % msegs
            bm.faces.new((rings[i][j], rings[i][j2], rings[i + 1][j2], rings[i + 1][j]))
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    return mesh_from_bm(name, bm, role, True)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
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


def radial(a):
    """Радиальное направление вокруг оси X: a=0 -> +Z, a=+90° -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


def tangent(a):
    return Vector((0.0, math.cos(a), -math.sin(a)))


def tuft(bm, base, direction, length, r0, r1, w=TUFT_W, t=TUFT_T, segs=8, cap=True):
    """Плоский сужающийся пучок: шире по касательной, тоньше по оси X."""
    d = Vector(direction).normalized()
    ax = Vector((1.0, 0.0, 0.0))
    th = ax - d * ax.dot(d)
    if th.length < 1e-6:
        th = Vector((0.0, 1.0, 0.0))
    th.normalize()
    wd = th.cross(d).normalized()
    c = Vector(base) + d * (length * 0.5)
    m = Matrix(((wd.x * r0 * w, th.x * r0 * t, d.x * length, c.x),
                (wd.y * r0 * w, th.y * r0 * t, d.y * length, c.y),
                (wd.z * r0 * w, th.z * r0 * t, d.z * length, c.z),
                (0.0, 0.0, 0.0, 1.0)))
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                           radius1=1.0, radius2=r1 / r0, depth=1.0, matrix=m)
    if cap:
        tip = Vector(base) + d * (length - r1 * 0.5)
        cm = Matrix(((wd.x * r1 * w, th.x * r1 * t, d.x * r1 * 0.95, tip.x),
                     (wd.y * r1 * w, th.y * r1 * t, d.y * r1 * 0.95, tip.y),
                     (wd.z * r1 * w, th.z * r1 * t, d.z * r1 * 0.95, tip.z),
                     (0.0, 0.0, 0.0, 1.0)))
        bmesh.ops.create_icosphere(bm, subdivisions=1, radius=1.0, matrix=cm)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []
    C = Vector((0.0, 0.0, Z0))

    # ---- диск (вращается) ----------------------------------------------
    core = cyl(PREFIX + 'core', (-CORE_X, 0, Z0), (CORE_X, 0, Z0), CORE_R,
               'blush', vertices=72, bev=0.0024)
    core_band = cyl(PREFIX + 'core_band', (-0.0034, 0, Z0), (0.0034, 0, Z0),
                    CORE_R + 0.0007, 'rose', vertices=72, bev=0.0006)
    flange_front = cyl(PREFIX + 'flange_front', (CORE_X, 0, Z0),
                       (CORE_X + FLANGE_T, 0, Z0), FLANGE_R, 'steel',
                       vertices=64, bev=0.0008)
    flange_rear = cyl(PREFIX + 'flange_rear', (-CORE_X - FLANGE_T, 0, Z0),
                      (-CORE_X, 0, Z0), FLANGE_R, 'steel',
                      vertices=64, bev=0.0008)
    hub = cyl(PREFIX + 'hub', (-HUB_X, 0, Z0), (HUB_X, 0, Z0), HUB_R,
              'graphite', vertices=48, bev=0.0022)
    hub_ring = torus(PREFIX + 'hub_ring', (HUB_X + 0.0002, 0, Z0), 0.0166,
                     0.0018, 'blush', 'X', segs=44, rings=8)
    arbor = cyl(PREFIX + 'arbor', (-0.0300, 0, Z0), (0.0300, 0, Z0), ARBOR_R,
                'steel', vertices=24)
    washer = cyl(PREFIX + 'washer', (HUB_X, 0, Z0), (HUB_X + 0.0026, 0, Z0),
                  0.0135, 'steel', vertices=32, bev=0.0006)
    nut = cyl(PREFIX + 'nut', (HUB_X + 0.0026, 0, Z0), (HUB_X + 0.0106, 0, Z0),
              0.0105, 'graphite', vertices=6, bev=0.0009)

    # 8 прижимных болтов на каждом фланце
    bm = bmesh.new()
    for sx in (1.0, -1.0):
        x0 = sx * (CORE_X + 0.0002)
        x1 = sx * (CORE_X + 0.0026)
        for k in range(8):
            a = math.radians(22.5 + 45.0 * k)
            d = radial(a)
            base = Vector((x0, d.y * 0.0262, Z0 + d.z * 0.0262))
            tip = Vector((x1, d.y * 0.0262, Z0 + d.z * 0.0262))
            bmesh.ops.create_cone(
                bm, cap_ends=True, cap_tris=False, segments=10,
                radius1=0.0024, radius2=0.0019, depth=(tip - base).length,
                matrix=(Matrix.Translation((base + tip) * 0.5)
                        @ Vector((sx, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()))
    bolts = mesh_from_bm(PREFIX + 'flange_bolts', bm, 'graphite', smooth=False)
    rotating += [core, core_band, flange_front, flange_rear, hub, hub_ring,
                 arbor, washer, nut, bolts]

    # ---- венец радиальных пучков (вращается) -----------------------------
    bm_pale = bmesh.new()
    bm_blush = bmesh.new()
    row_x = [-ROW_SPAN + i * (2.0 * ROW_SPAN / (ROWS - 1)) for i in range(ROWS)]
    for ri, x in enumerate(row_x):
        phase = (math.tau / SECTORS) * (0.5 if ri % 2 else 0.0)
        flare = FLARE * (x / ROW_SPAN)
        for k in range(SECTORS):
            # детерминированный разброс с периодом 12 пучков = 90°:
            # поворот на 90° переводит венец сам в себя -> pivot не уезжает
            h = ((k % 12) * 2654435761 + ri * 40503) % 997 / 997.0
            a = phase + k * math.tau / SECTORS + math.radians((h - 0.5) * 1.6)
            d = Vector((math.tan(flare),
                        math.sin(a) + SWEEP * math.cos(a),
                        math.cos(a) - SWEEP * math.sin(a))).normalized()
            base = Vector((x, 0.0, Z0)) + radial(a) * TUFT_R0
            target = bm_blush if ri in (3, 4, 5) else bm_pale
            tuft(target, base, d, TUFT_LEN * (0.955 + 0.090 * h),
                 TUFT_RB, TUFT_RT)
    bristles = mesh_from_bm(PREFIX + 'bristles_crown', bm_pale, 'pale')
    bristles_blush = mesh_from_bm(PREFIX + 'bristles_crown_blush', bm_blush, 'blush')
    rotating += [bristles, bristles_blush]

    # ---- док / быстросъём (статичен) ------------------------------------
    cyl(PREFIX + 'dock_body', (DOCK_X0, 0, Z0), (DOCK_X1, 0, Z0), DOCK_R,
        'graphite', vertices=56, bev=0.0035)
    cyl(PREFIX + 'dock_band', (-0.0520, 0, Z0), (-0.0435, 0, Z0), 0.0232,
        'blush', vertices=56, bev=0.0012)
    cyl(PREFIX + 'dock_collar', (COLLAR_X0, 0, Z0), (COLLAR_X1, 0, Z0),
        COLLAR_R, 'steel', vertices=64, bev=0.0016)
    bm = bmesh.new()
    for k in range(3):                      # байонетные усы 20/25 мм
        a = math.radians(90.0 + 120.0 * k)
        d = radial(a)
        c = Vector((COLLAR_X1 - 0.0046, d.y * 0.0256, Z0 + d.z * 0.0256))
        bmesh.ops.create_cube(bm, size=1.0, matrix=(
            Matrix.Translation(c)
            @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
            @ Matrix.Diagonal((0.0098, 0.0074, 0.0052, 1.0))))
    mesh_from_bm(PREFIX + 'dock_lugs', bm, 'steel', smooth=False)
    torus(PREFIX + 'dock_seal', (-0.0270, 0, Z0), 0.0240, 0.0012, 'dark',
          'X', segs=48, rings=8)
    d = radial(math.radians(140.0))
    cyl(PREFIX + 'dock_index',
        (-0.0300, d.y * 0.0242, Z0 + d.z * 0.0242),
        (-0.0300, d.y * 0.0272, Z0 + d.z * 0.0272), 0.0024, 'steel', vertices=12)
    # рычаг быстросъёма на ближней (-Y) стороне тела дока
    cube(PREFIX + 'release_lever', (-0.0475, -0.0242, Z0 + 0.0010),
         (0.0165, 0.0060, 0.0095), 'steel', r=0.0012)
    cyl(PREFIX + 'release_pin', (-0.0415, -0.0300, Z0 + 0.0010),
        (-0.0415, -0.0195, Z0 + 0.0010), 0.0024, 'dark', vertices=14)
    cyl(PREFIX + 'strain_relief', (-0.0728, 0.0130, Z0 - 0.0020),
        (-0.0686, 0.0130, Z0 - 0.0020), 0.0060, 'graphite', vertices=20, bev=0.0012)
    curve_tube(PREFIX + 'cable',
               [(-0.0726, 0.0130, Z0 - 0.0022),
                (-0.0740, 0.0200, Z0 - 0.0140),
                (-0.0695, 0.0262, Z0 - 0.0250),
                (-0.0628, 0.0266, Z0 - 0.0295)], 0.0032, 'dark')
    cube(PREFIX + 'connector', (-0.0576, 0.0266, Z0 - 0.0300),
         (0.0105, 0.0080, 0.0072), 'graphite', r=0.0016)
    sphere(PREFIX + 'led', (-0.0490, -0.0205, Z0 + 0.0075), 0.0028, 'cyan')
    # маркировка жёсткости + шильдик
    bm = bmesh.new()
    for i in range(3):
        x = -0.0580 + i * 0.0052
        bmesh.ops.create_cone(
            bm, cap_ends=True, cap_tris=False, segments=12,
            radius1=0.0017, radius2=0.0015, depth=0.0022,
            matrix=(Matrix.Translation(Vector((x, -0.0213, Z0 - 0.0070)))
                    @ Vector((0, -1, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()))
    mesh_from_bm(PREFIX + 'rating_marks', bm, 'dark', smooth=False)
    cube(PREFIX + 'name_plate', (-0.0555, -0.0190, Z0 + 0.0110),
         (0.0140, 0.0032, 0.0068), 'dark', r=0.0008)
    # 4 болта приёмного кольца
    bm = bmesh.new()
    for k in range(4):
        a = math.radians(45.0 + 90.0 * k)
        d = radial(a)
        c = Vector((COLLAR_X0 + 0.0004, d.y * 0.0228, Z0 + d.z * 0.0228))
        bmesh.ops.create_cone(
            bm, cap_ends=True, cap_tris=False, segments=10,
            radius1=0.0021, radius2=0.0017, depth=0.0024,
            matrix=(Matrix.Translation(c)
                    @ Vector((-1, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()))
    mesh_from_bm(PREFIX + 'dock_screws', bm, 'steel', smooth=False)

    # ---- опора шпинделя вплотную к диску (статична) ---------------------
    cyl(PREFIX + 'bearing_boss', (-0.0272, 0, Z0), (-0.0190, 0, Z0), 0.0168,
        'graphite', vertices=40, bev=0.0018)
    cyl(PREFIX + 'bearing_flange', (-0.0196, 0, Z0), (-0.0188, 0, Z0), 0.0172,
        'steel', vertices=40, bev=0.0006)

    # ---- монтажная плита модуля + прокладка + болты ---------------------
    cube(PREFIX + 'mount_plate', (-0.0645, 0.0, Z0),
         (0.0075, 0.0460, 0.0460), 'ivory', r=0.0028)
    cyl(PREFIX + 'mount_gasket', (-0.0618, 0, Z0), (-0.0602, 0, Z0), 0.0222,
        'dark', vertices=56, bev=0.0004)
    bm = bmesh.new()
    for sy in (1.0, -1.0):
        for sz in (1.0, -1.0):
            c = Vector((-0.0670, sy * 0.0185, Z0 + sz * 0.0185))
            bmesh.ops.create_cone(
                bm, cap_ends=True, cap_tris=False, segments=10,
                radius1=0.0032, radius2=0.0030, depth=0.0040,
                matrix=(Matrix.Translation(c)
                        @ Vector((-1, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()))
    mesh_from_bm(PREFIX + 'mount_bolts', bm, 'steel', smooth=False)

    # ---- рёбра корпуса дока --------------------------------------------
    for tag, ang in (('a', 45.0), ('b', 135.0), ('c', 225.0), ('d', 315.0)):
        d = radial(math.radians(ang))
        bm = bmesh.new()
        bmesh.ops.create_cube(bm, size=1.0, matrix=(
            Matrix.Translation(Vector((-0.0570, d.y * 0.0234, Z0 + d.z * 0.0234)))
            @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
            @ Matrix.Diagonal((0.0080, 0.0014, 0.0040, 1.0))))
        mesh_from_bm(PREFIX + f'dock_fin_{tag}', bm, 'graphite', smooth=False)

    # ---- anim-пустышка ровно в центре ступицы ---------------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    bpy.context.view_layer.update()   # иначе matrix_world ещё identity и дети съедут
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in rotating:
            o['rotating'] = False
    anim['axis'] = 'x'
    anim['max_rpm'] = 150
    anim['module'] = CID
    anim['code'] = CODE

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


def vert_radius_max(objects):
    rmax = 0.0
    for o in objects:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            rmax = max(rmax, math.hypot(p.y, p.z - Z0))
    return rmax


def check(anim, rotating):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    # pivot: центр bbox детей anim до/после поворота на 90° вокруг X
    kids = [o for o in anim.children]
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5

    statics = [o for o in all_mesh if o not in kids]
    s_before = {o.name: mesh_bbox([o])[0].copy() for o in statics}

    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    statics_drift = max((mesh_bbox([o])[0] - s_before[o.name]).length
                        for o in statics) if statics else 0.0
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    axis_err = math.hypot(k_c0.y - anim.location.y, k_c0.z - anim.location.z)
    r_tips = vert_radius_max([bpy.data.objects[PREFIX + 'bristles_crown'],
                              bpy.data.objects[PREFIX + 'bristles_crown_blush']])
    core = bpy.data.objects[PREFIX + 'core']
    c_mn, c_mx = mesh_bbox([core])
    disc_thickness = c_mx.x - c_mn.x

    # ни одна статичная деталь не заходит в плоскость вращения диска
    slab = CORE_X + FLANGE_T + 0.0006
    in_slab = []
    for o in statics:
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            if abs(p.x) < slab:
                in_slab.append((o.name, round(math.hypot(p.y, p.z - Z0) * 1000, 1)))
                break

    for o in all_mesh:
        o.data.calc_loop_triangles()

    report = {
        'component': CID,
        'code': CODE,
        'kind': 'radial disc brush — thin wheel, dense radial tuft crown',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.130 and size.y <= 0.160 and size.z <= 0.160),
        'crown_outer_diameter': round(2.0 * r_tips, 5),
        'crown_depth': round(r_tips - CORE_R, 5),
        'disc_diameter': round(2.0 * CORE_R, 5),
        'disc_thickness': round(disc_thickness, 5),
        'thickness_to_diameter': round(disc_thickness / (2.0 * r_tips), 3),
        'thin_disc_ok': bool(disc_thickness / (2.0 * r_tips) < 0.20),
        'tuft_rows': ROWS,
        'tufts_per_row': SECTORS,
        'tufts': ROWS * SECTORS,
        'hood_outer_radius': None,
        'static_in_disc_plane': in_slab,
        'disc_plane_clear_ok': bool(not in_slab),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.001),
        'axis_center_err_mm': round(axis_err * 1000, 4),
        'static_drift_mm': round(statics_drift * 1000, 5),
        'static_frozen_ok': bool(statics_drift < 0.0005),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'non_children_static': sorted(o.name for o in statics),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'tris': sum(len(o.data.loop_triangles) for o in all_mesh),
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
    if not path.is_file() or path.stat().st_size < 20000:
        raise RuntimeError(f'export too small: {path}')
    return path


# --- рендеры -------------------------------------------------------------
def render_views(anim):
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    scene.view_settings.exposure = 0.10
    try:
        scene.eevee.taa_render_samples = 96
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.38

    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(mesh_objs)
    center = (mn + mx) * 0.5
    disc_objs = list(anim.children)
    d_mn, d_mx = mesh_bbox(disc_objs)
    d_center = (d_mn + d_mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3.2,
                                     location=(center.x, center.y, mn.z - 0.0006))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.62, -0.66, 0.66), 3.40, 0.55),
            ('fill', (-0.72, -0.52, 0.36), 1.05, 0.80),
            ('rim', (0.04, 0.66, 0.52), 1.70, 0.60)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.55))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 72
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

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

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_all = box_corners(mn - center, mx - center)
    c_disc = box_corners(d_mn - d_center, d_mx - d_center)

    from bpy_extras.object_utils import world_to_camera_view

    def max_ndc(fill, region=None):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                q = mw @ v.co
                if region is not None:
                    lo, hi = region
                    if any(q[i] < lo[i] or q[i] > hi[i] for i in range(3)):
                        continue
                p = world_to_camera_view(scene, cam, q)
                if p.z <= 0.0:
                    continue
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    # крупный план: ступица, гайка, фланец, корни пучков
    close_t = Vector((0.006, -0.006, Z0 + 0.004))
    close_lo = close_t + Vector((-0.032, -0.060, -0.046))
    close_hi = close_t + Vector((0.030, 0.056, 0.044))
    c_close = box_corners(close_lo - close_t, close_hi - close_t)

    views = [
        ('3q', (0.82, -0.62, 0.38), d_center + Vector((-0.012, 0, 0.002)),
         72, c_disc, 0.93, None),
        ('front', (1.00, -0.10, 0.10), d_center, 80, c_disc, 0.88, None),
        ('side', (0.12, -1.00, 0.14), center + Vector((0.004, 0, 0.0)),
         74, c_all, 0.93, None),
        ('closeup', (0.52, -0.72, 0.34), close_t, 88, c_close, 0.92,
         (close_lo, close_hi)),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, region in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(8):
            got = max_ndc(fill, region)
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
        print(f'RENDERED {tag} fill={max_ndc(fill, region):.3f} {fp}', flush=True)
    return outs


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views(anim)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['thin_disc_ok']
            and rep['disc_plane_clear_ok'] and rep['static_frozen_ok']
            and rep['material_count'] >= 8 and rep['nodes'] == 37
            and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
