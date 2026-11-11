"""Standalone builder: motion_turntable (MOT-TUR-08, «Поворотный стол»).

Компактный поворотный стол Ø0,9 × 0,15 м на катковом (роликовом) кольце:
молочный рабочий диск, графитовое роликовое кольцо, стационарная база-обечайка,
ролики в сепараторе, привод (серво + планетарный редуктор + шестерня),
зубчатый венец, фиксатор в 12 положениях, датчик угла с фрикционным роликом,
кабельный контур с разъёмом, метки азимута и посадочная бобышка.
Плиты-основания нет: база — кольцевая обечайка с утопленным днищем,
полость под диском занята приводом.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_turntable.py

Выход:
  public/models/machine-modules/components/motion_turntable.glb
  docs/plans/blockout/component-library/motion_turntable/*.png
  docs/plans/blockout/component-library/motion_turntable/report.json

Геометрия (Blender Z-up, метры):
  ось вращения  = Z (вертикаль); Blender Z -> glTF/three.js Y (export_yup)
  габарит       = Ø0,900 x 0,150; низ на z = 0
  anim-пустышка = (0, 0, 0.119) — строго на оси, в центре вращающегося пакета
  вращается     = disc, disc_boss, disc_spigot, azimuth_marks, index_mark,
                  disc_bolts, ring, ring_web, ring_gear
  статично      = base_skirt, base_band, base_floor, base_race, anchor_bolts,
                  rollers, roller_axles, cage_ring, drive_motor, drive_fan_cover,
                  drive_gearbox, drive_pinion, drive_mount, lock_bracket,
                  lock_pin, lock_spring, lock_lever, lock_knob, angle_sensor,
                  sensor_shaft, sensor_wheel, sensor_led, cable_loop,
                  cable_connector, nameplate
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_turntable'
CID = 'motion_turntable'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
DISC_R = 0.450                    # Ø 0,900
DISC_Z0, DISC_Z1 = 0.1260, 0.1445
SPIG_Z1 = 0.1500                  # верх габарита
BOSS_R, BOSS_Z1 = 0.115, 0.1490

RING_RO, RING_RI = 0.446, 0.348   # графитовое кольцо
RING_Z0, RING_Z1 = 0.0880, 0.1260
WEB_Z0, WEB_Z1 = 0.1100, 0.1260   # тарелка кольца

BASE_RO, BASE_RI = 0.430, 0.394   # обечайка
BASE_Z1 = 0.0580
WINDOW_AZ0, WINDOW_AZ1 = 188.0, 236.0   # сервисный проём к приводу
WINDOW_Z0, WINDOW_Z1 = 0.0060, 0.0540
FLOOR_R, FLOOR_Z0, FLOOR_Z1 = 0.398, 0.0000, 0.0100
RACE_RI, RACE_RO = 0.372, 0.4360
RACE_Z0, RACE_Z1 = 0.0520, 0.0620

ROLL_PITCH = 0.416                # катковое кольцо (наружу, в силуэт)
ROLL_R = 0.0130
ROLL_HALF = 0.0120
ROLL_Z = 0.0750                   # 0.0620 .. 0.0880
ROLL_COUNT = 44
CAGE_RI, CAGE_RO = 0.336, 0.352
CAGE_Z0, CAGE_Z1 = 0.0500, 0.0720

GEAR_RI, GEAR_RO = 0.302, 0.336   # зубчатый венец (внутренние зубья)
GEAR_TEETH, GEAR_TIP = 48, 0.288
GEAR_Z0, GEAR_Z1 = 0.0940, 0.1100

DRIVE_AZ = math.radians(202.0)    # привод: серво тангенциально, перед-лево
MOTOR_R = 0.020
MOTOR_RAD = 0.3470
MOTOR_HALF = 0.0580               # половина длины корпуса по дуге
MOTOR_Z = 0.0295
GEARBOX_AZ = math.radians(219.0)  # редуктор на конце мотора
PINION_AZ = GEARBOX_AZ
PINION_RAD = 0.2880
PINION_BODY, PINION_TIP = 0.0110, 0.0150
PINION_TEETH = 14
PINION_Z0, PINION_Z1 = 0.0680, 0.1080

LOCK_AZ = math.radians(258.0)     # фиксатор: фронт-лево
SENS_AZ = math.radians(75.0)      # датчик угла: тыл-право
ANIM_Z = 0.1190

PALETTE = {
    'body': (0.930, 0.921, 0.900),
    'ivory': (0.975, 0.968, 0.952),
    'steel': (0.620, 0.628, 0.620),
    'graphite': (0.185, 0.192, 0.204),
    'dark': (0.072, 0.076, 0.082),
    'red': (0.720, 0.070, 0.060),
    'cyan': (0.700, 0.880, 0.920),
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
    bsdf.inputs['Roughness'].default_value = 0.62
    metal = 0.60 if role == 'steel' else 0.14 if role == 'graphite' else 0.0
    bsdf.inputs['Metallic'].default_value = metal
    if role == 'body':
        bsdf.inputs['Roughness'].default_value = 0.46
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.85
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
        select_only(obj)
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


def mesh_from_bm(name, bm, role, smooth=True, flat_caps=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, False)
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = (not flat_caps) or abs(p.normal.z) < 0.55
    return obj


def annulus(name, r_in, r_out, z0, z1, role, segs=96):
    bm = bmesh.new()

    def ring(r, z):
        return [bm.verts.new((math.cos(math.tau * i / segs) * r,
                              math.sin(math.tau * i / segs) * r, z))
                for i in range(segs)]

    lo_i, lo_o = ring(r_in, z0), ring(r_out, z0)
    hi_i, hi_o = ring(r_in, z1), ring(r_out, z1)
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((lo_o[i], lo_o[j], hi_o[j], hi_o[i]))   # outer wall
        bm.faces.new((lo_i[j], lo_i[i], hi_i[i], hi_i[j]))   # inner wall
        bm.faces.new((hi_i[i], hi_i[j], hi_o[j], hi_o[i]))   # top
        bm.faces.new((lo_i[j], lo_i[i], lo_o[i], lo_o[j]))   # bottom
    return mesh_from_bm(name, bm, role)


def annulus_sector(name, r_in, r_out, z0, z1, a0, a1, role, segs=96):
    """Сектор кольца (a0 < a1, радианы) с торцевыми крышками."""
    bm = bmesh.new()
    n = max(2, int(round(segs * (a1 - a0) / math.tau)))

    def ring(r, z):
        out = []
        for i in range(n + 1):
            a = a0 + (a1 - a0) * i / n
            out.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        return out

    lo_i, lo_o = ring(r_in, z0), ring(r_out, z0)
    hi_i, hi_o = ring(r_in, z1), ring(r_out, z1)
    for i in range(n):
        j = i + 1
        bm.faces.new((lo_o[i], lo_o[j], hi_o[j], hi_o[i]))
        bm.faces.new((lo_i[j], lo_i[i], hi_i[i], hi_i[j]))
        bm.faces.new((hi_i[i], hi_i[j], hi_o[j], hi_o[i]))
        bm.faces.new((lo_i[j], lo_i[i], lo_o[i], lo_o[j]))
    bm.faces.new((lo_i[0], lo_o[0], hi_o[0], hi_i[0]))
    bm.faces.new((lo_o[n], lo_i[n], hi_i[n], hi_o[n]))
    return mesh_from_bm(name, bm, role)


def bm_cyl(bm, a, b, radius, segments=24):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=d.length, matrix=m)


def bm_box(bm, center, size, rot_z=0.0):
    m = (Matrix.Translation(Vector(center))
         @ Matrix.Rotation(rot_z, 4, 'Z')
         @ Matrix.Diagonal(Vector(size).to_4d()))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def polar(az, r, z):
    return Vector((math.cos(az) * r, math.sin(az) * r, z))


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- вращающийся пакет: диск / бобышка / шпигот ----------------------
    disc = cyl(PREFIX + 'disc', (0, 0, DISC_Z0), (0, 0, DISC_Z1), DISC_R,
               'body', vertices=96, bev=0.0035)
    boss = cyl(PREFIX + 'disc_boss', (0, 0, DISC_Z1 - 0.0005),
               (0, 0, BOSS_Z1), BOSS_R, 'ivory', vertices=72, bev=0.0022)
    spigot = annulus(PREFIX + 'disc_spigot', 0.050, 0.072, BOSS_Z1 - 0.006, SPIG_Z1,
                     'steel', segs=72)
    rotating += [disc, boss, spigot]

    # ---- метки азимута: 12 положенийфиксации + красный индекс -----------
    bm = bmesh.new()
    for k in range(12):
        a = math.tau * k / 12.0
        bm_box(bm, polar(a, 0.400, DISC_Z1 + 0.0014),
               (0.050, 0.0090, 0.0028), a)
    marks = mesh_from_bm(PREFIX + 'azimuth_marks', bm, 'graphite', flat_caps=True)

    index = cube(PREFIX + 'index_mark', (0.0, -0.4185, DISC_Z1 + 0.0015),
                 (0.0470, 0.0260, 0.0030), 'red', r=0.0008)
    rotating += [marks, index]

    # пазы посадочного поля: 4 радиальных Т-паза на рабочей поверхности
    bm = bmesh.new()
    for k in range(4):
        a = math.radians(45.0 + 90.0 * k)
        d = Vector((math.cos(a), math.sin(a), 0.0))
        c = d * 0.3000 + Vector((0, 0, DISC_Z1 + 0.0002))
        bm_box(bm, c, (0.2100, 0.0125, 0.0010), a)
    mesh_from_bm(PREFIX + 'disc_slots', bm, 'graphite', flat_caps=True)

    # 8 крепёжных болтов диска к кольцу
    bm = bmesh.new()
    for k in range(8):
        a = math.tau * k / 8.0 + math.tau / 16.0
        bm_cyl(bm, polar(a, 0.340, DISC_Z1 - 0.001), polar(a, 0.340, DISC_Z1 + 0.0045),
               0.0068, 16)
    bolts = mesh_from_bm(PREFIX + 'disc_bolts', bm, 'steel', flat_caps=True)
    rotating.append(bolts)

    # ---- графитовое роликовое кольцо + тарелка + зубчатый венец ---------
    ring = annulus(PREFIX + 'ring', RING_RI, RING_RO, RING_Z0, RING_Z1, 'graphite')
    web = cyl(PREFIX + 'ring_web', (0, 0, WEB_Z0), (0, 0, WEB_Z1), RING_RI + 0.006,
              'graphite', vertices=96, bev=0.0015)
    rotating += [ring, web]

    bm = bmesh.new()
    seg = 96
    ring_v = []
    for r, z in ((GEAR_RI, GEAR_Z0), (GEAR_RO, GEAR_Z0),
                 (GEAR_RO, GEAR_Z1), (GEAR_RI, GEAR_Z1)):
        ring_v.append([bm.verts.new((math.cos(math.tau * i / seg) * r,
                                     math.sin(math.tau * i / seg) * r, z))
                       for i in range(seg)])
    lo_i, lo_o, hi_o, hi_i = ring_v
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((lo_o[i], lo_o[j], hi_o[j], hi_o[i]))
        bm.faces.new((lo_i[j], lo_i[i], hi_i[i], hi_i[j]))
        bm.faces.new((hi_i[i], hi_i[j], hi_o[j], hi_o[i]))
        bm.faces.new((lo_i[j], lo_i[i], lo_o[i], lo_o[j]))
    depth = (GEAR_RI - GEAR_TIP)
    for k in range(GEAR_TEETH):
        a = math.tau * k / GEAR_TEETH
        bm_box(bm, polar(a, GEAR_TIP + depth * 0.5, (GEAR_Z0 + GEAR_Z1) * 0.5),
               (depth, 0.0165, GEAR_Z1 - GEAR_Z0), a)
    gear = mesh_from_bm(PREFIX + 'ring_gear', bm, 'graphite', flat_caps=True)
    rotating.append(gear)

    # ---- стационарная база: обечайка с сервисным проёмом к приводу ------
    annulus(PREFIX + 'base_skirt_rail_lo', BASE_RI, BASE_RO, 0.0, WINDOW_Z0, 'graphite')
    annulus(PREFIX + 'base_skirt_rail_hi', BASE_RI, BASE_RO, WINDOW_Z1, BASE_Z1, 'graphite')
    annulus_sector(PREFIX + 'base_skirt', BASE_RI, BASE_RO, WINDOW_Z0, WINDOW_Z1,
                   math.radians(WINDOW_AZ1), math.radians(WINDOW_AZ0 + 360.0),
                   'graphite')
    annulus(PREFIX + 'base_band', BASE_RO, 0.4345, 0.0, 0.0080, 'ivory')
    cyl(PREFIX + 'base_floor', (0, 0, FLOOR_Z0), (0, 0, FLOOR_Z1), FLOOR_R,
        'dark', vertices=96, bev=0.0012)
    annulus(PREFIX + 'base_race', RACE_RI, RACE_RO, RACE_Z0, RACE_Z1, 'steel')

    bm = bmesh.new()
    for k in range(6):
        adeg = 30.0 + 60.0 * k
        if WINDOW_AZ0 - 8.0 < adeg < WINDOW_AZ1 + 8.0:
            continue
        a = math.radians(adeg)
        bm_cyl(bm, polar(a, 0.4300, 0.0160), polar(a, 0.4415, 0.0160), 0.0075, 12)
    mesh_from_bm(PREFIX + 'anchor_bolts', bm, 'steel', flat_caps=True)

    # ---- ролики в сепараторе -------------------------------------------
    bm = bmesh.new()
    axle = bmesh.new()
    for k in range(ROLL_COUNT):
        a = math.tau * k / ROLL_COUNT
        d = Vector((math.cos(a), math.sin(a), 0.0))
        c = d * ROLL_PITCH + Vector((0, 0, ROLL_Z))
        bm_cyl(bm, c - d * ROLL_HALF, c + d * ROLL_HALF, ROLL_R, 24)
        bm_cyl(axle, d * CAGE_RI + Vector((0, 0, ROLL_Z)),
               d * (ROLL_PITCH + ROLL_HALF) + Vector((0, 0, ROLL_Z)), 0.0038, 12)
    mesh_from_bm(PREFIX + 'rollers', bm, 'steel')
    mesh_from_bm(PREFIX + 'roller_axles', axle, 'dark', flat_caps=True)
    annulus(PREFIX + 'cage_ring', CAGE_RI, CAGE_RO, CAGE_Z0, CAGE_Z1, 'dark')

    # ---- привод: серво + редуктор + шестерня ---------------------------
    # серво лежит тангенциально у сервисного проёма, редуктор — на его конце
    tang = Vector((-math.sin(DRIVE_AZ), math.cos(DRIVE_AZ), 0.0))
    motor_c = polar(DRIVE_AZ, MOTOR_RAD, MOTOR_Z)
    cube(PREFIX + 'drive_mount', polar(DRIVE_AZ, MOTOR_RAD, 0.0060),
         (0.0560, 2 * MOTOR_HALF + 0.0160, 0.0120), 'graphite', r=0.0025,
         rot=(0, 0, DRIVE_AZ))
    cyl(PREFIX + 'drive_motor', motor_c - tang * MOTOR_HALF,
        motor_c + tang * MOTOR_HALF, MOTOR_R, 'ivory', vertices=40, bev=0.0025)
    cyl(PREFIX + 'drive_fan_cover', motor_c - tang * (MOTOR_HALF + 0.0130),
        motor_c - tang * MOTOR_HALF, 0.0210, 'graphite', vertices=32, bev=0.0016)
    cube(PREFIX + 'drive_gearbox', polar(GEARBOX_AZ, 0.2975, 0.0380),
         (0.0600, 0.0620, 0.0640), 'graphite', r=0.0030, rot=(0, 0, GEARBOX_AZ))

    bm = bmesh.new()
    pc = polar(PINION_AZ, PINION_RAD, (PINION_Z0 + PINION_Z1) * 0.5)
    bm_cyl(bm, pc - Vector((0, 0, 0.0160)), pc + Vector((0, 0, 0.0160)),
           PINION_BODY, 28)
    for k in range(PINION_TEETH):
        a = math.tau * k / PINION_TEETH
        tr = PINION_BODY + 0.0021
        tc = Vector((pc.x + math.cos(a) * tr,
                     pc.y + math.sin(a) * tr,
                     (PINION_Z0 + PINION_Z1) * 0.5))
        bm_box(bm, tc, (0.0042, 0.0052, PINION_Z1 - PINION_Z0), a)
    mesh_from_bm(PREFIX + 'drive_pinion', bm, 'steel', flat_caps=True)

    # ---- фиксатор в 12 положениях --------------------------------------
    cube(PREFIX + 'lock_bracket', polar(LOCK_AZ, 0.4270, 0.0240),
         (0.0340, 0.0720, 0.0480), 'graphite', r=0.0025, rot=(0, 0, LOCK_AZ))
    cyl(PREFIX + 'lock_pin', polar(LOCK_AZ, 0.4150, 0.0400),
        polar(LOCK_AZ, 0.4150, 0.0980), 0.0080, 'steel', vertices=20)
    cyl(PREFIX + 'lock_spring', polar(LOCK_AZ, 0.4150, 0.0400),
        polar(LOCK_AZ, 0.4150, 0.0620), 0.0128, 'dark', vertices=24)
    cube(PREFIX + 'lock_lever', polar(LOCK_AZ, 0.4280, 0.0455),
         (0.0300, 0.0130, 0.0110), 'steel', r=0.0012, rot=(0, 0, LOCK_AZ))
    sphere(PREFIX + 'lock_knob', polar(LOCK_AZ, 0.4375, 0.0420), 0.0080, 'red',
           segs=20, rings=12)

    # ---- датчик угла ----------------------------------------------------
    cube(PREFIX + 'angle_sensor', polar(SENS_AZ, 0.4375, 0.0320),
         (0.0180, 0.0500, 0.0320), 'graphite', r=0.0022, rot=(0, 0, SENS_AZ))
    cyl(PREFIX + 'sensor_shaft', polar(SENS_AZ, 0.4360, 0.0460),
        polar(SENS_AZ, 0.4360, 0.0690), 0.0050, 'steel', vertices=16)
    tang = Vector((-math.sin(SENS_AZ), math.cos(SENS_AZ), 0.0))
    wc = polar(SENS_AZ, 0.4360, 0.0778)
    cyl(PREFIX + 'sensor_wheel', wc - tang * 0.0070, wc + tang * 0.0070,
        0.0104, 'dark', vertices=24)
    sphere(PREFIX + 'sensor_led', polar(SENS_AZ, 0.4420, 0.0380), 0.0035, 'cyan')

    # ---- кабельный контур ----------------------------------------------
    cable = []
    for adeg, rr, zz in ((-62.0, 0.4340, 0.0130), (-52.0, 0.4425, 0.0180),
                         (-34.0, 0.4450, 0.0220), (-16.0, 0.4425, 0.0200),
                         (-7.0, 0.4350, 0.0300)):
        cable.append(polar(math.radians(adeg), rr, zz))
    curve_tube(PREFIX + 'cable_loop', cable, 0.0035, 'dark')
    cube(PREFIX + 'cable_connector', polar(math.radians(-63.0), 0.4340, 0.0180),
         (0.0200, 0.0320, 0.0200), 'graphite', r=0.0022,
         rot=(0, 0, math.radians(-63.0)))
    cube(PREFIX + 'nameplate', polar(math.radians(320.0), 0.4300, 0.0370),
         (0.0050, 0.0440, 0.0130), 'ivory', r=0.0010,
         rot=(0, 0, math.radians(320.0)))

    # ---- анимационная пустышка в центре вертикальной оси ----------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, ANIM_Z))
    bpy.context.view_layer.update()
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
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    passport = (0.900, 0.900, 0.150)
    got_sorted = tuple(sorted((round(size.x, 5), round(size.y, 5), round(size.z, 5)),
                              reverse=True))
    bbox_ok = all(abs(g - p) <= 0.004 for g, p in zip(got_sorted, passport))

    kids = [o for o in anim.children if o.type == 'MESH']
    kid_names = {o.name for o in kids}
    static_meshes = [o for o in meshes if o.name not in kid_names]

    # --- тест оси: поворот anim на 90° вокруг вертикали -------------------
    c0 = {o.name: (mesh_bbox([o])[0] + mesh_bbox([o])[1]) * 0.5 for o in kids}
    s0 = {o.name: o.matrix_world.translation.copy() for o in static_meshes}
    k_mn0, k_mx0 = mesh_bbox(kids)
    g0 = (k_mn0 + k_mx0) * 0.5

    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, 0.0, math.radians(90.0))
    bpy.context.view_layer.update()

    c1 = {o.name: (mesh_bbox([o])[0] + mesh_bbox([o])[1]) * 0.5 for o in kids}
    k_mn1, k_mx1 = mesh_bbox(kids)
    g1 = (k_mn1 + k_mx1) * 0.5
    s1 = {o.name: o.matrix_world.translation.copy() for o in static_meshes}

    rot_err = 0.0
    for name, p0 in c0.items():
        expect = Vector((-p0.y, p0.x, p0.z))
        rot_err = max(rot_err, (c1[name] - expect).length)
    static_err = max(((s1[n] - s0[n]).length for n in s0), default=0.0)
    bbox_shift = (g1 - g0).length

    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    back = {o.name: (mesh_bbox([o])[0] + mesh_bbox([o])[1]) * 0.5 for o in kids}
    restore_err = max((back[n] - c0[n]).length for n in c0)

    anim_loc = anim.location.copy()
    axis_ok = abs(anim_loc.x) < 1e-9 and abs(anim_loc.y) < 1e-9
    k_mn, k_mx = mesh_bbox(kids)
    axis_in_pack = k_mn.z < anim_loc.z < k_mx.z

    disc = bpy.data.objects[PREFIX + 'disc']
    d_mn, d_mx = mesh_bbox([disc])
    disc_dia = d_mx.x - d_mn.x

    report = {
        'component': CID,
        'code': 'MOT-TUR-08',
        'passport': 'Ø0,900 x 0,150 м',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_sorted_m': list(got_sorted),
        'bbox_passport_m': list(passport),
        'bbox_ok': bool(bbox_ok),
        'floor_contact_z': round(mn.z, 6),
        'floor_contact_ok': bool(abs(mn.z) < 0.0006),
        'disc_diameter_m': round(disc_dia, 5),
        'disc_diameter_ok': bool(abs(disc_dia - 0.900) <= 0.004),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim_loc],
        'anim_axis': 'Z (вертикаль; Blender Z -> three.js Y)',
        'anim_on_axis_ok': bool(axis_ok),
        'anim_inside_rotating_pack': bool(axis_in_pack),
        'anim_children': sorted(kid_names),
        'anim_children_count': len(kids),
        'static_parts': sorted(o.name for o in static_meshes),
        'static_count': len(static_meshes),
        'spin_speed_rad_s': 0.8,
        'pivot_bbox_shift_mm': round(bbox_shift * 1000, 6),
        'pivot_child_rot_error_mm': round(rot_err * 1000, 6),
        'pivot_restore_error_mm': round(restore_err * 1000, 6),
        'static_error_mm': round(static_err * 1000, 6),
        'pivot_ok': bool(bbox_shift < 0.001 and rot_err < 0.001
                         and restore_err < 1e-9 and static_err < 1e-9),
        'rollers': ROLL_COUNT,
        'gear_teeth': GEAR_TEETH,
        'azimuth_marks': 12,
        'lock_positions': 12,
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
    scene.view_settings.look = 'AgX - High Contrast'
    scene.view_settings.exposure = 0.05
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.780, 0.772, 0.760, 1.0)
    bg.inputs['Strength'].default_value = 0.60

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3.4,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.660, 0.654, 0.642, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.58, -0.62, 0.62), 2.45, 0.62),
            ('fill', (-0.70, -0.48, 0.34), 0.90, 0.80),
            ('rim', (0.05, 0.66, 0.50), 1.55, 0.60),
            ('low', (-0.10, -0.80, 0.09), 0.48, 0.55),
            ('bay', (-0.50, -0.30, 0.055), 1.40, 0.26)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.35))
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

    c_main = box_corners(mn - center, mx - center)
    # крупный план: катковое кольцо, привод в проёме, фиксатор
    close_t = Vector((-0.235, -0.225, 0.058))
    c_close = box_corners(Vector((-0.455, -0.445, 0.000)) - close_t,
                          Vector((-0.020, -0.015, 0.152)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (-0.80, -0.74, 0.36), center + Vector((0, 0, 0.004)), 70, c_main, 0.90, True),
        ('front', (-0.06, -1.00, 0.24), center + Vector((0, 0, 0.002)), 70, c_main, 0.90, True),
        ('side', (1.00, -0.10, 0.20), center + Vector((0, 0, 0.002)), 70, c_main, 0.90, True),
        ('closeup', (-0.52, -0.84, 0.17), close_t, 100, c_close, 0.94, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, fit_all in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if fit_all:
            for _ in range(6):
                got = max_ndc(fill)
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
        print(f'RENDERED {tag} fill={max_ndc(fill):.3f} {fp}', flush=True)
    return outs


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['pivot_ok']
            and rep['anim_on_axis_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000 and rep['disc_diameter_ok']):
        raise SystemExit('checks failed')


main()
