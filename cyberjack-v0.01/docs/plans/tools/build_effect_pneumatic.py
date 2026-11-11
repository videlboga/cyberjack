"""Standalone builder: effect_pneumatic (EFF-PNE-01, «Пневмо-модуль»).

Слой «эффект»: вставка в гнездо на корпусе базы, G1/8. Тела не касается,
насадки нет, движения нет (motion: none), пустышка anim не нужна.

Устройство (снизу вверх):
  - кольцо посадки CJ-EFF-PNE Ø30 с контактной плоскостью;
  - прозрачная колба влагоотделителя с фильтроэлементом и накидной гайкой;
  - корпус регулятора с циановой меткой и насечкой;
  - манометр на фронте: циановый циферблат с рисками и янтарной стрелкой;
  - трёхходовой клапан сверху: блок, соленоид с торца, видимый янтарный рычаг;
  - два быстросъёма G1/8 по оси X с полупрозрачными трубками;
  - датчик давления на корпусе с проводом;
  - бирка на передней грани блока клапана.

Не зависит от build_component_library.py, helpers продублированы намеренно.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_effect_pneumatic.py

Выход:
  public/models/machine-modules/components/effect_pneumatic.glb
  docs/plans/blockout/component-library/effect_pneumatic/report.json

Геометрия (Blender Z-up, метры):
  X — длина 0.081 м (трубки быстросъёмов -0.0404 … +0.0404)
  Y — ширина 0.049 м (манометр -0.0260 … датчик +0.0228)
  Z — высота 0.0686 м (кольцо посадки 0.000 … верх рычага)
  ось корпуса — вертикальная Z, центр (BX, 0), Ø корпуса 0.030
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/effect_pneumatic'
CID = 'effect_pneumatic'
PREFIX = CID + '__'
CODE = 'EFF-PNE-01'

# --- ключевые размеры (м) ------------------------------------------------
BX = -0.0060                 # ось корпуса
BR = 0.0150                  # Ø корпуса 0.030
Z_RING1 = 0.0070             # кольцо посадки
Z_BOWL1 = 0.0272             # верх стеклянной колбы
Z_COLLAR0, Z_COLLAR1 = 0.0250, 0.0304
Z_BODY0, Z_BODY1 = 0.0304, 0.0492
Z_CAP0, Z_CAP1 = 0.0492, 0.0524
Z_VALV0, Z_VALV1 = 0.0524, 0.0594

GAX, GZ = BX, 0.0430         # манометр (ось Y)
CJZ = 0.0392                 # ось быстросъёмов / трубок (X)

PALETTE = {
    'milk': (0.945, 0.937, 0.918),      # верхняя крышка, бирка, фильтроэлемент
    'graphite': (0.205, 0.212, 0.231),  # корпус регулятора, блок клапана, кольцо
    'steel': (0.620, 0.630, 0.632),     # накидная гайка, быстросъёмы, безель
    'dark': (0.070, 0.074, 0.084),      # соленоид, уплотнения, риски
    'glass': (0.735, 0.855, 0.875),     # колба
    'tube': (0.620, 0.845, 0.865),      # полупрозрачные трубки (CJ_glass_101)
    'cyan': (0.190, 0.780, 0.830),      # циферблат, метка
    'amber': (0.851, 0.635, 0.290),     # рычаг, стрелка
}
ALPHA = {'glass': 0.24, 'tube': 0.55}
ROUGH = {'milk': 0.52, 'graphite': 0.46, 'steel': 0.28, 'dark': 0.55,
         'glass': 0.05, 'tube': 0.12, 'cyan': 0.42, 'amber': 0.36}
METAL = {'milk': 0.0, 'graphite': 0.30, 'steel': 0.95, 'dark': 0.35,
         'glass': 0.0, 'tube': 0.0, 'cyan': 0.0, 'amber': 0.35}
GLASS_NAME = {'glass': 'CJ_glass_100', 'tube': 'CJ_glass_101'}
MATS = {}


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(GLASS_NAME.get(role, f'CJ_{role}_100'))
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = METAL[role]
    if role in ALPHA:
        bsdf.inputs['Alpha'].default_value = ALPHA[role]
        for attr, val in (('blend_method', 'BLEND'),
                          ('surface_render_method', 'BLENDED'),
                          ('shadow_method', 'HASHED')):
            try:
                setattr(m, attr, val)
            except Exception:
                pass
        m.use_backface_culling = False
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.45
    if role == 'amber':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.22
    m.diffuse_color = (*color, ALPHA.get(role, 1.0))
    MATS[role] = m
    return m


def apply(obj, role):
    obj.data.materials.append(mat(role))
    return obj


def shade(obj, angle=35.0):
    if obj.type != 'MESH':
        return obj
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for f in bm.faces:
        f.smooth = True
    lim = math.radians(angle)
    for e in bm.edges:
        if len(e.link_faces) == 2:
            e.smooth = e.calc_face_angle(0.0) < lim
        else:
            e.smooth = False
    bm.to_mesh(obj.data)
    bm.free()
    return obj


def bevel(obj, width=0.0012, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cube(name, loc, size, role, r=0.0010, rot=(0, 0, 0), seg=2, sharp=35.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    r = min(r, min(size) * 0.34)
    if r > 0.00015:
        bevel(obj, r, seg)
    apply(obj, role)
    return shade(obj, sharp)


def box(name, x0, x1, y0, y1, z0, z1, role, r=0.0010, seg=2, sharp=35.0):
    return cube(name, ((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5),
                (x1 - x0, y1 - y0, z1 - z0), role, r=r, seg=seg, sharp=sharp)


def cyl(name, a, b, radius, role, vertices=32, r2=None, bev=0.0, sharp=35.0):
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
        select_only(obj)
        bevel(obj, bev, 2)
    apply(obj, role)
    return shade(obj, sharp)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    apply(obj, role)
    return shade(obj, 60.0)


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
    apply(obj, role)
    return shade(obj, 50.0)


def curve_tube(name, points, radius, role, res=5):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 16
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
    return shade(obj, 50.0)


def mesh_from_bm(name, bm, role, smooth_angle=35.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    return shade(obj, smooth_angle)


def bm_box(bm, loc, size, rotz=0.0):
    m = (Matrix.Translation(Vector(loc))
         @ Matrix.Rotation(rotz, 4, 'Z')
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_cyl(bm, a, b, r1, r2=None, segs=20):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r1 if r2 is None else r2,
                          depth=d.length, matrix=m)


def bm_knurl_z(bm, cx, cy, z0, z1, r, count, thick=0.0011, wide=0.0022):
    """Продольные насечки вокруг оси Z (накидные гайки, корпус)."""
    h = z1 - z0
    for i in range(count):
        a = math.tau * i / count
        bm_box(bm, (cx + r * math.cos(a), cy + r * math.sin(a), (z0 + z1) * 0.5),
               (thick, wide, h), rotz=a)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ---- кольцо посадки CJ-EFF-PNE (Ø31) -------------------------------
    add(cyl(PREFIX + 'seat_ring', (BX, 0.0, 0.0000), (BX, 0.0, Z_RING1),
            0.0155, 'graphite', vertices=48, bev=0.0012))
    add(cyl(PREFIX + 'seat_face', (BX, 0.0, 0.0000), (BX, 0.0, 0.0014),
            0.0130, 'steel', vertices=44, sharp=45.0))
    add(cyl(PREFIX + 'seat_bore', (BX, 0.0, 0.0002), (BX, 0.0, 0.0012),
            0.0092, 'dark', vertices=36, sharp=45.0))

    # ---- колба влагоотделителя ----------------------------------------
    add(cyl(PREFIX + 'bowl', (BX, 0.0, 0.0068), (BX, 0.0, Z_BOWL1),
            0.0132, 'glass', vertices=44, r2=0.0138, sharp=45.0))
    add(cyl(PREFIX + 'bowl_bottom', (BX, 0.0, 0.0066), (BX, 0.0, 0.0098),
            0.0128, 'graphite', vertices=44, bev=0.0010))
    add(cyl(PREFIX + 'filter_element', (BX, 0.0, 0.0104), (BX, 0.0, 0.0236),
            0.0094, 'milk', vertices=36, bev=0.0008))
    bm = bmesh.new()
    bm_knurl_z(bm, BX, 0.0, 0.0118, 0.0224, 0.0094, 14, 0.0022, 0.0024)
    add(mesh_from_bm(PREFIX + 'filter_ribs', bm, 'milk', 42.0))
    add(cyl(PREFIX + 'bowl_collar', (BX, 0.0, Z_COLLAR0), (BX, 0.0, Z_COLLAR1),
            0.0157, 'steel', vertices=48, bev=0.0012))
    bm = bmesh.new()
    bm_knurl_z(bm, BX, 0.0, 0.0258, 0.0296, 0.0157, 22, 0.0014, 0.0020)
    add(mesh_from_bm(PREFIX + 'bowl_collar_knurl', bm, 'dark', 42.0))

    # ---- корпус регулятора --------------------------------------------
    add(cyl(PREFIX + 'body', (BX, 0.0, Z_BODY0), (BX, 0.0, Z_BODY1), BR,
            'graphite', vertices=48, bev=0.0018))
    add(cyl(PREFIX + 'body_mark', (BX, 0.0, 0.0452), (BX, 0.0, 0.0464),
            BR + 0.0002, 'cyan', vertices=48, sharp=45.0))
    bm = bmesh.new()
    bm_knurl_z(bm, BX, 0.0, 0.0324, 0.0376, BR + 0.0002, 20, 0.0012, 0.0018)
    add(mesh_from_bm(PREFIX + 'body_knurl', bm, 'dark', 42.0))
    add(cyl(PREFIX + 'top_cap', (BX, 0.0, Z_CAP0), (BX, 0.0, Z_CAP1), 0.0142,
            'milk', vertices=44, bev=0.0012))

    # ---- трёхходовой клапан: блок, соленоид, рычаг ---------------------
    add(box(PREFIX + 'valve_block', -0.0210, 0.0072, -0.0120, 0.0120,
            Z_VALV0, Z_VALV1, 'graphite', r=0.0028, seg=3))
    # третий выход клапана (трёхходовой): отвод в +Y
    add(cyl(PREFIX + 'valve_port3', (-0.0142, 0.0116, 0.0556),
            (-0.0142, 0.0172, 0.0556), 0.0046, 'steel', vertices=20,
            bev=0.0005))
    add(cyl(PREFIX + 'valve_port3_ring', (-0.0142, 0.0160, 0.0556),
            (-0.0142, 0.0174, 0.0556), 0.0054, 'dark', vertices=20))
    # соленоид на торце блока, через стальной фланец
    add(cyl(PREFIX + 'solenoid_flange', (0.0068, -0.0040, 0.0556),
            (0.0096, -0.0040, 0.0556), 0.0100, 'steel', vertices=28,
            bev=0.0006))
    add(cyl(PREFIX + 'solenoid', (0.0092, -0.0040, 0.0556),
            (0.0176, -0.0040, 0.0556), 0.0084, 'dark', vertices=24,
            bev=0.0008))
    add(cyl(PREFIX + 'solenoid_cap', (0.0174, -0.0040, 0.0556),
            (0.0190, -0.0040, 0.0556), 0.0066, 'steel', vertices=24,
            bev=0.0006))
    # видимый рычаг: цапфа -> тяга -> шар
    add(cyl(PREFIX + 'lever_pivot', (-0.0216, -0.0126, 0.0562),
            (-0.0216, -0.0074, 0.0562), 0.0029, 'steel', vertices=16,
            bev=0.0004))
    add(cyl(PREFIX + 'lever_arm', (-0.0216, -0.0124, 0.0562),
            (-0.0322, -0.0124, 0.0644), 0.0026, 'amber', vertices=16,
            bev=0.0004))
    add(sphere(PREFIX + 'lever_knob', (-0.0332, -0.0124, 0.0652), 0.0038,
               'amber', segs=20, rings=12))

    # ---- манометр на фронте -------------------------------------------
    add(cyl(PREFIX + 'gauge_boss', (GAX, -0.0120, GZ), (GAX, -0.0158, GZ),
            0.0086, 'graphite', vertices=28, bev=0.0006))
    add(cyl(PREFIX + 'gauge_bezel', (GAX, -0.0156, GZ), (GAX, -0.0232, GZ),
            0.0118, 'steel', vertices=44, bev=0.0012))
    add(cyl(PREFIX + 'gauge_rim', (GAX, -0.0230, GZ), (GAX, -0.0242, GZ),
            0.0109, 'dark', vertices=44))
    add(cyl(PREFIX + 'gauge_dial', (GAX, -0.0236, GZ), (GAX, -0.0244, GZ),
            0.0102, 'cyan', vertices=44, sharp=45.0))
    bm = bmesh.new()
    for i in range(9):
        a = math.radians(-135.0 + i * 33.75)
        bm_cyl(bm, (GAX + 0.0084 * math.sin(a), -0.0243, GZ + 0.0084 * math.cos(a)),
               (GAX + 0.0084 * math.sin(a), -0.0248, GZ + 0.0084 * math.cos(a)),
               0.0006, segs=8)
    add(mesh_from_bm(PREFIX + 'gauge_ticks', bm, 'dark', 60.0))
    add(cube(PREFIX + 'gauge_needle', (GAX + 0.0030, -0.0249, GZ + 0.0028),
             (0.0014, 0.0006, 0.0082), 'amber', r=0.0002,
             rot=(0, math.radians(-28.0), 0)))
    add(cyl(PREFIX + 'gauge_hub', (GAX, -0.0244, GZ), (GAX, -0.0252, GZ),
            0.0019, 'steel', vertices=16))

    # ---- два быстросъёма G1/8 + полупрозрачные трубки ------------------
    bm = bmesh.new()
    bm_cyl(bm, (BX - 0.0150, 0.0, CJZ), (-0.0262, 0.0, CJZ), 0.0076, segs=6)
    bm_cyl(bm, (0.0090, 0.0, CJZ), (0.0142, 0.0, CJZ), 0.0076, segs=6)
    add(mesh_from_bm(PREFIX + 'coupler_nuts', bm, 'steel', 40.0))
    bm = bmesh.new()
    bm_cyl(bm, (-0.0262, 0.0, CJZ), (-0.0326, 0.0, CJZ), 0.0054, segs=24)
    bm_cyl(bm, (0.0142, 0.0, CJZ), (0.0206, 0.0, CJZ), 0.0054, segs=24)
    add(mesh_from_bm(PREFIX + 'coupler_sleeves', bm, 'steel', 42.0))
    bm = bmesh.new()
    bm_cyl(bm, (-0.0316, 0.0, CJZ), (-0.0300, 0.0, CJZ), 0.0062, segs=24)
    bm_cyl(bm, (0.0180, 0.0, CJZ), (0.0196, 0.0, CJZ), 0.0062, segs=24)
    add(mesh_from_bm(PREFIX + 'coupler_rings', bm, 'dark', 42.0))
    add(curve_tube(PREFIX + 'tube_left',
                   [(-0.0326, 0.0000, CJZ),
                    (-0.0360, -0.0010, 0.0382),
                    (-0.0388, -0.0020, 0.0362),
                    (-0.0402, -0.0026, 0.0346)], 0.0034, 'tube'))
    add(curve_tube(PREFIX + 'tube_right',
                   [(0.0206, 0.0000, CJZ),
                    (0.0246, 0.0008, 0.0384),
                    (0.0366, 0.0020, 0.0366),
                    (0.0402, 0.0026, 0.0352)], 0.0034, 'tube'))

    # ---- датчик давления ----------------------------------------------
    add(cyl(PREFIX + 'sensor_base', (0.0025, 0.0122, 0.0462),
            (0.0025, 0.0148, 0.0462), 0.0054, 'steel', vertices=6))
    add(cyl(PREFIX + 'sensor', (0.0025, 0.0146, 0.0462),
            (0.0025, 0.0208, 0.0462), 0.0040, 'steel', vertices=20,
            bev=0.0005))
    add(cyl(PREFIX + 'sensor_cap', (0.0025, 0.0206, 0.0462),
            (0.0025, 0.0216, 0.0462), 0.0026, 'dark', vertices=16))
    add(curve_tube(PREFIX + 'sensor_wire',
                   [(0.0025, 0.0216, 0.0462),
                    (0.0052, 0.0206, 0.0512),
                    (0.0044, 0.0150, 0.0532),
                    (0.0016, 0.0108, 0.0526)], 0.0012, 'dark'))

    # ---- бирка на передней грани блока клапана -------------------------
    add(box(PREFIX + 'tag', -0.0182, -0.0084, -0.0144, -0.0130, 0.0538,
            0.0586, 'milk', r=0.0006))
    bm = bmesh.new()
    bm_box(bm, (-0.0168, -0.0147, 0.0554), (0.0038, 0.0006, 0.0014))
    bm_box(bm, (-0.0168, -0.0147, 0.0572), (0.0038, 0.0006, 0.0010))
    add(mesh_from_bm(PREFIX + 'tag_bars', bm, 'cyan', 25.0))
    bm = bmesh.new()
    bm_box(bm, (-0.0116, -0.0147, 0.0563), (0.0036, 0.0006, 0.0030))
    add(mesh_from_bm(PREFIX + 'tag_mark', bm, 'amber', 25.0))

    # ---- extras --------------------------------------------------------
    for o in parts:
        o['component'] = CID
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').rsplit('_', 1)[0]
        o['motion'] = 'none'
        o['amount'] = 0.0
        o['speed'] = 0.0

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


def static_check(objs):
    """motion=none: ни один узел не должен быть способен двигаться."""
    moving, reasons = [], {}
    for o in objs:
        why = []
        ad = o.animation_data
        if ad is not None:
            if ad.action is not None:
                why.append('action')
            if len(ad.drivers):
                why.append('drivers')
            if ad.nla_tracks and any(t.strips for t in ad.nla_tracks):
                why.append('nla')
        if len(getattr(o, 'constraints', ()) or ()):
            why.append('constraint')
        if o.parent is not None:
            why.append('parent:' + o.parent.name)
        if o.type == 'EMPTY':
            why.append('empty')
        if why:
            moving.append(o.name)
            reasons[o.name] = why
    return sorted(moving), sorted(o.name for o in objs if o.name not in moving), reasons


def check(parts):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)

    body = bpy.data.objects[PREFIX + 'body']
    b_mn, b_mx = mesh_bbox([body])
    body_d = min((b_mx - b_mn).x, (b_mx - b_mn).y)

    moving, static, reasons = static_check(objs)
    passport = (0.080, 0.050, 0.030)

    bbox_ok = bool(0.0750 <= size.x <= 0.0850
                   and size.y <= 0.0500
                   and 0.0280 <= body_d <= 0.0320)

    report = {
        'component': CID,
        'code': CODE,
        'nodes': len(objs),
        'mesh_nodes': len(meshes),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_size_mm': [round(v * 1000, 2) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(passport),
        'bbox_delta_mm': [round((size[i] - passport[i]) * 1000, 1) for i in range(3)],
        'bbox_rules': {'length_m': [0.075, 0.085], 'width_max_m': 0.050,
                       'body_d_m': [0.028, 0.032]},
        'body_d': round(body_d, 5),
        'bbox_ok': bbox_ok,
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'motion': 'none',
        'moving_nodes': moving,
        'static_nodes': static,
        'static_node_count': len(static),
        'pivot_ok': bool(len(moving) == 0),
        'pivot_note': ('motion=none: пустышки anim нет, все узлы без родителей, '
                       'без action/драйверов/констрейнтов — вращать нечего'),
        'moving_reasons': reasons,
        'tris': tris,
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
        'unprefixed_meshes': sorted(o.name for o in bpy.data.objects
                                    if o.type == 'MESH'
                                    and not o.name.startswith(PREFIX)),
        'reads': ('Читается пневмо-вставка: стеклянная колба влагоотделителя под '
                  'корпусом регулятора, циановый манометр на фронте и клапан '
                  'с соленоидом и янтарным рычагом сверху'),
    }
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
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
    if not path.is_file() or path.stat().st_size < 10240:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['material_count'] >= 4
            and rep['nodes'] >= 8 and not rep['bad_names']
            and rep['glb_bytes'] > 10240):
        raise SystemExit('checks failed')


main()
