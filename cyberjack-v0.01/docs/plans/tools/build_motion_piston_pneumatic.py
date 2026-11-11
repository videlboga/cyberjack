"""Standalone builder: motion_piston_pneumatic (MOT-PIS-02, «Пневматический поршень»).

Пневмоцилиндр двустороннего действия Ø32 x 120 мм с двумя воздушными
портами, пневмошлангами, распределителем 5/2 с двумя катушками,
регулятором с манометром, вилкой на штоке, задней проушиной и двумя
опорами-лапами. Плиты-основания нет.

Не зависит от build_component_library.py / build_work_*.py / build_motion_piston_rod.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_piston_pneumatic.py

Выход:
  public/models/machine-modules/components/motion_piston_pneumatic.glb
  docs/plans/blockout/component-library/motion_piston_pneumatic/*.png
  docs/plans/blockout/component-library/motion_piston_pneumatic/report.json

Геометрия (Blender Z-up, метры):
  ось цилиндра   = X, z = 0.050; Blender X -> glTF X (export_yup)
  гильза         = Ø32 x 120 мм, габарит сборки ~0.206 (X) x 0.044 (Y) x 0.114 (Z)
  анимация       = сдвиг пустышки motion_piston_pneumatic__anim по X, 0..0.10 м
  двигается      = шток, поршень, уплотнения поршня, вилка, щёки вилки, палец
  статично       = гильза, крышки, шпильки, втулка, грязесъёмник, шланги,
                   порты и штуцеры, клапан с катушками, регулятор, манометр,
                   проушина, опоры, шильдик
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_piston_pneumatic'
CID = 'motion_piston_pneumatic'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
AXIS_Z = 0.050                      # высота оси штока
BARREL_X0, BARREL_X1 = -0.084, 0.036
BARREL_R = 0.016                   # Ø32 по паспорту
TRAVEL = 0.10                      # ход по паспорту 0..100 мм
ANIM_SPEED = 1.2

REAR_HEAD_X0, REAR_HEAD_X1 = -0.096, -0.084
FRONT_HEAD_X0, FRONT_HEAD_X1 = 0.036, 0.048
HEAD_R = 0.0178
BUSH_X0, BUSH_X1 = 0.048, 0.056
BUSH_R = 0.0125

ROD_R = 0.0045
ROD_X0, ROD_X1 = -0.078, 0.080
PISTON_X0, PISTON_X1 = -0.080, -0.068
PISTON_R = 0.0148

FORK_X0, FORK_X1 = 0.080, 0.100
PIN_X = 0.0955

PORT_REAR_X, PORT_FRONT_X = -0.072, 0.028
FOOT_REAR_X, FOOT_FRONT_X = -0.062, 0.010

VALVE_X0, VALVE_X1 = -0.056, 0.000
VALVE_Z0, VALVE_Z1 = 0.086, 0.106

PALETTE = {
    'alu': (0.700, 0.712, 0.722),
    'graphite': (0.185, 0.196, 0.212),
    'steel': (0.600, 0.610, 0.612),
    'chrome': (0.845, 0.855, 0.862),
    'dark': (0.085, 0.090, 0.100),
    'cyan': (0.180, 0.620, 0.720),
    'ivory': (0.960, 0.955, 0.935),
    'red': (0.700, 0.060, 0.050),
    'brass': (0.700, 0.545, 0.250),
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
    bsdf.inputs['Roughness'].default_value = 0.55
    metal = {'alu': 0.42, 'steel': 0.70, 'chrome': 0.95,
             'brass': 0.80, 'graphite': 0.12}.get(role, 0.0)
    bsdf.inputs['Metallic'].default_value = metal
    if role == 'alu':
        bsdf.inputs['Roughness'].default_value = 0.36
    if role == 'chrome':
        bsdf.inputs['Roughness'].default_value = 0.12
    if role == 'steel':
        bsdf.inputs['Roughness'].default_value = 0.34
    if role == 'dark':
        bsdf.inputs['Roughness'].default_value = 0.80
    if role == 'cyan':
        bsdf.inputs['Roughness'].default_value = 0.45
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.30
    if role == 'red':
        bsdf.inputs['Roughness'].default_value = 0.42
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


def curve_tube(name, points, radius, role, res=10):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 14
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def text_label(name, body, loc, size, role, rot=(math.radians(90), 0, 0)):
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


def hexnut(name, x, y, z0, z1, r, role):
    """Шестигранная гайка / штуцер на оси Z."""
    return cyl(name, (x, y, z0), (x, y, z1), r, role, vertices=6, smooth=False)


def foot(tag, x):
    """Опора-лапа: стяжное кольцо на гильзе, ребро, подошва, болты."""
    torus(PREFIX + f'mount_ring_{tag}', (x, 0, AXIS_Z), BARREL_R + 0.0016, 0.0024,
          'alu', 'X', segs=44, rings=8)
    cube(PREFIX + f'mount_rib_{tag}', (x, 0.0, 0.021),
         (0.010, 0.038, 0.026), 'alu', r=0.0012)
    cube(PREFIX + f'mount_pad_{tag}', (x, 0.0, 0.004),
         (0.030, 0.050, 0.008), 'graphite', r=0.0012)
    bm = bmesh.new()
    for sy in (-1, 1):
        for dx in (-0.0095, 0.0095):
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12,
                                  radius1=0.0033, radius2=0.0033, depth=0.0035,
                                  matrix=Matrix.Translation((x + dx, sy * 0.0175,
                                                             0.00975)))
    mesh_from_bm(PREFIX + f'mount_bolts_{tag}', bm, 'steel')


# --- сборка --------------------------------------------------------------
def build():
    reset()
    movers = []
    Z = AXIS_Z

    # ---------- гильза + циановые линии (по паспорту: графит + циан) ----
    cyl(PREFIX + 'barrel', (BARREL_X0, 0, Z), (BARREL_X1, 0, Z), BARREL_R,
        'graphite', vertices=56, bev=0.0016)
    for tag, x in (('rear', BARREL_X0 + 0.005), ('front', BARREL_X1 - 0.005)):
        torus(PREFIX + f'stripe_{tag}', (x, 0, Z), BARREL_R + 0.0009, 0.0015,
              'cyan', 'X', segs=48, rings=8)

    # 4 шпильки стяжки по углам 45°
    bm = bmesh.new()
    rot = Vector((1, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    for a in (45, 135, 225, 315):
        d = math.radians(a)
        m = (Matrix.Translation(((-0.096 + 0.048) * 0.5, math.sin(d) * 0.0168,
                                 Z + math.cos(d) * 0.0168)) @ rot)
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12,
                              radius1=0.0021, radius2=0.0021, depth=0.144, matrix=m)
    mesh_from_bm(PREFIX + 'tie_rods', bm, 'steel')

    # ---------- крышки, втулка, грязесъёмник -----------------------------
    cyl(PREFIX + 'rear_head', (REAR_HEAD_X0, 0, Z), (REAR_HEAD_X1, 0, Z), HEAD_R,
        'alu', vertices=48, bev=0.0022)
    cyl(PREFIX + 'front_head', (FRONT_HEAD_X0, 0, Z), (FRONT_HEAD_X1, 0, Z), HEAD_R,
        'alu', vertices=48, bev=0.0022)
    cyl(PREFIX + 'rod_bush', (BUSH_X0, 0, Z), (BUSH_X1, 0, Z), BUSH_R,
        'steel', vertices=32, bev=0.0012)
    torus(PREFIX + 'wiper_seal', (BUSH_X1 + 0.0008, 0, Z), 0.0098, 0.0020,
          'dark', 'X', segs=36, rings=8)

    # ---------- задняя проушина + палец ---------------------------------
    for tag, sy in (('l', -1), ('r', 1)):
        cube(PREFIX + f'clevis_{tag}', (-0.100, sy * 0.0090, Z),
             (0.012, 0.006, 0.034), 'alu', r=0.0014)
    cyl(PREFIX + 'clevis_pin', (-0.100, -0.0135, Z), (-0.100, 0.0135, Z), 0.0036,
        'steel', vertices=18)

    # ---------- опоры-лапы (низ на z = 0) -------------------------------
    foot('rear', FOOT_REAR_X)
    foot('front', FOOT_FRONT_X)

    # ---------- воздушные порты + штуцеры --------------------------------
    for tag, x in (('rear', PORT_REAR_X), ('front', PORT_FRONT_X)):
        cyl(PREFIX + f'port_boss_{tag}', (x, 0, Z + 0.0140), (x, 0, Z + 0.0200),
            0.0062, 'alu', vertices=18, bev=0.0008)
        hexnut(PREFIX + f'port_nut_{tag}', x, 0, Z + 0.0200, Z + 0.0285,
               0.0072, 'brass')
        cyl(PREFIX + f'port_nipple_{tag}', (x, 0, Z + 0.0285), (x, 0, Z + 0.0350),
            0.0030, 'brass', vertices=14)

    # ---------- пневмошланги: порт -> клапан ----------------------------
    curve_tube(PREFIX + 'hose_supply',
               [(PORT_REAR_X, 0.0, Z + 0.0320),
                (PORT_REAR_X, -0.010, Z + 0.0405),
                (-0.058, -0.016, Z + 0.0455),
                (-0.048, -0.017, Z + 0.0455),
                (-0.042, -0.018, Z + 0.0445)], 0.0034, 'cyan')
    curve_tube(PREFIX + 'hose_exhaust',
               [(PORT_FRONT_X, 0.0, Z + 0.0320),
                (PORT_FRONT_X, -0.010, Z + 0.0405),
                (0.016, -0.016, Z + 0.0455),
                (-0.004, -0.017, Z + 0.0455),
                (-0.016, -0.018, Z + 0.0445)], 0.0034, 'graphite')

    # ---------- распределитель 5/2: корпус, катушки, LED ----------------
    cube(PREFIX + 'valve_body', ((VALVE_X0 + VALVE_X1) * 0.5, 0.004,
                                 (VALVE_Z0 + VALVE_Z1) * 0.5),
         (VALVE_X1 - VALVE_X0, 0.032, VALVE_Z1 - VALVE_Z0), 'graphite', r=0.0022)
    for tag, x0, x1 in (('rear', -0.070, VALVE_X0), ('front', VALVE_X1, 0.014)):
        cyl(PREFIX + f'valve_coil_{tag}', (x0, 0.004, 0.096), (x1, 0.004, 0.096),
            0.0100, 'dark', vertices=32, bev=0.0016)
        cyl(PREFIX + f'valve_led_{tag}',
            (x0 - 0.0012 if tag == 'rear' else x1, 0.004, 0.096),
            (x0 if tag == 'rear' else x1 + 0.0012, 0.004, 0.096),
            0.0034, 'cyan', vertices=14)

    # стойки-кронштейны клапана на гильзу
    for tag, x in (('rear', -0.048), ('front', -0.008)):
        cube(PREFIX + f'valve_post_{tag}', (x, 0.008, Z + 0.023),
             (0.014, 0.026, 0.028), 'alu', r=0.0014)

    # ---------- регулятор + манометр ------------------------------------
    cyl(PREFIX + 'regulator', (0.014, 0.004, 0.096), (0.030, 0.004, 0.096),
        0.0095, 'alu', vertices=32, bev=0.0014)
    torus(PREFIX + 'regulator_ring', (0.0175, 0.004, 0.096), 0.0097, 0.0011,
          'cyan', 'X', segs=32, rings=6)
    cyl(PREFIX + 'regulator_knob', (0.030, 0.004, 0.096), (0.0375, 0.004, 0.096),
        0.0068, 'dark', vertices=28, bev=0.0012)
    torus(PREFIX + 'knob_grip', (0.0345, 0.004, 0.096), 0.0069, 0.0008, 'steel', 'X',
          segs=28, rings=6)

    cyl(PREFIX + 'gauge_stem', (-0.028, 0.004, VALVE_Z1 - 0.002),
        (-0.028, 0.004, VALVE_Z1 + 0.007), 0.0040, 'steel', vertices=16)
    cyl(PREFIX + 'gauge_face', (-0.028, 0.004, VALVE_Z1 + 0.0065),
        (-0.028, 0.004, VALVE_Z1 + 0.0075), 0.0100, 'ivory', vertices=36)
    torus(PREFIX + 'gauge_bezel', (-0.028, 0.004, VALVE_Z1 + 0.0075), 0.0108, 0.0018,
          'dark', 'Z', segs=40, rings=8)
    cube(PREFIX + 'gauge_needle', (-0.0252, 0.004, VALVE_Z1 + 0.0082),
         (0.0075, 0.0016, 0.0008), 'red', r=0.0003)
    cyl(PREFIX + 'gauge_hub', (-0.028, 0.004, VALVE_Z1 + 0.0075),
        (-0.028, 0.004, VALVE_Z1 + 0.0088), 0.0018, 'dark', vertices=12)

    # ---------- штуцеры шлангов на клапане ------------------------------
    for tag, x in (('supply', -0.042), ('exhaust', -0.016)):
        cyl(PREFIX + f'fitting_{tag}', (x, -0.006, 0.0945), (x, -0.019, 0.0945),
            0.0030, 'brass', vertices=16)
        cyl(PREFIX + f'fitting_nut_{tag}', (x, -0.019, 0.0945), (x, -0.0255, 0.0945),
            0.0048, 'brass', vertices=6, smooth=False)

    # ---------- шильдик --------------------------------------------------
    cube(PREFIX + 'label_plate', (-0.038, -0.0154, Z),
         (0.026, 0.0012, 0.013), 'graphite', r=0.0008)
    text_label(PREFIX + 'label_text', 'MOT-PIS-02',
               (-0.038, -0.0163, Z), 0.0034, 'ivory')

    # ---------- подвижная группа: поршень, шток, вилка -------------------
    movers.append(cyl(PREFIX + 'piston', (PISTON_X0, 0, Z), (PISTON_X1, 0, Z),
                      PISTON_R, 'graphite', vertices=40, bev=0.0008))
    for tag, x in (('rear', PISTON_X0 + 0.002), ('front', PISTON_X1 - 0.002)):
        movers.append(torus(PREFIX + f'piston_seal_{tag}', (x, 0, Z), 0.0146, 0.0012,
                            'dark', 'X', segs=36, rings=6))
    movers.append(cyl(PREFIX + 'rod', (ROD_X0, 0, Z), (ROD_X1, 0, Z), ROD_R,
                      'chrome', vertices=28))
    movers.append(cube(PREFIX + 'fork_body', ((FORK_X0 + 0.005), 0.0, Z),
                       (0.010, 0.016, 0.016), 'steel', r=0.0012))
    for tag, sy in (('l', -1), ('r', 1)):
        movers.append(cube(PREFIX + f'fork_cheek_{tag}', (0.095, sy * 0.0095, Z),
                           (0.010, 0.006, 0.026), 'steel', r=0.0010))
    movers.append(cyl(PREFIX + 'fork_pin', (PIN_X, -0.014, Z), (PIN_X, 0.014, Z),
                       0.0032, 'steel', vertices=16))

    # ---------- привязка к анимационной пустышке ------------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z))
    anim['motion_type'] = 'slide'
    anim['motion_axis'] = 'X'
    anim['motion_amount'] = TRAVEL
    anim['motion_speed'] = ANIM_SPEED
    anim['travel'] = TRAVEL
    bpy.context.view_layer.update()
    for o in movers:
        parent(o, anim)
        o['moving'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in movers:
            o['moving'] = False

    bpy.context.view_layer.update()
    return anim, movers


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


def check(anim, movers):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn

    kids = [o for o in anim.children if o.type == 'MESH']
    kid_names = {o.name for o in kids}

    # --- тест хода: едет только подвижная группа, статика заморожена ---
    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    anim.location = Vector((anim.location.x + TRAVEL, anim.location.y, anim.location.z))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}

    move_err = max((after[n] - before[n] - Vector((TRAVEL, 0, 0))).length
                   for n in kid_names)
    static_err = max(((after[n] - before[n]).length for n in before if n not in kid_names),
                     default=0.0)

    # поршень не должен выйти из гильзы на полном ходу
    p_mn, p_mx = mesh_bbox([bpy.data.objects[PREFIX + 'piston']])
    piston_ext_max = p_mx.x
    ext_mn, ext_mx = mesh_bbox(meshes)

    anim.location = Vector((anim.location.x - TRAVEL, anim.location.y, anim.location.z))
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    pivot_shift = max((restored[n] - before[n]).length for n in before)

    # --- «не висит в воздухе» -------------------------------------------
    boxes = {o.name: mesh_bbox([o]) for o in meshes}
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0015
                   for other in boxes):
            floating.append(name)

    anim_loc = anim.location.copy()
    axis_ok = (abs(anim_loc.x) < 1e-6 and abs(anim_loc.y) < 1e-6
               and abs(anim_loc.z - AXIS_Z) < 1e-6)

    b_mn, b_mx = mesh_bbox([bpy.data.objects[PREFIX + 'barrel']])
    barrel_d = min(b_mx.y - b_mn.y, b_mx.z - b_mn.z)
    barrel_len = b_mx.x - b_mn.x

    length_ok = 0.190 <= size.x <= 0.215
    bore_ok = 0.025 <= barrel_d <= 0.040
    height_ok = size.z <= 0.130

    report = {
        'component': CID,
        'code': 'MOT-PIS-02',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in ((mn + mx) * 0.5)],
        'bbox_passport': 'Ø25-40 x 200 мм (гильза Ø%d x %d мм)'
                         % (round(barrel_d * 1000), round(barrel_len * 1000)),
        'barrel_diameter_m': round(barrel_d, 5),
        'barrel_length_m': round(barrel_len, 5),
        'length_ok': bool(length_ok),
        'bore_ok': bool(bore_ok),
        'height_ok': bool(height_ok),
        'bbox_ok': bool(length_ok and bore_ok and height_ok),
        'floor_contact_z': round(mn.z, 6),
        'floor_contact_ok': bool(abs(mn.z) < 0.0006),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim_loc],
        'anim_on_rod_axis_ok': bool(axis_ok),
        'anim_type': anim.get('motion_type'),
        'anim_axis': anim.get('motion_axis'),
        'anim_amount_m': anim.get('motion_amount'),
        'anim_speed_rad_s': anim.get('motion_speed'),
        'anim_children': sorted(kid_names),
        'anim_children_count': len(kids),
        'static_parts': sorted(o.name for o in meshes if o.name not in kid_names),
        'static_count': len([o for o in meshes if o.name not in kid_names]),
        'slide_delta_m': TRAVEL,
        'mover_error_m': round(move_err, 9),
        'static_error_m': round(static_err, 9),
        'slide_rigid_ok': bool(move_err < 1e-6),
        'static_frozen_ok': bool(static_err < 1e-9),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_ok': bool(pivot_shift < 1e-6 and axis_ok),
        'piston_max_x_at_stroke': round(piston_ext_max, 5),
        'piston_clearance_ok': bool(piston_ext_max <= BARREL_X1 - 0.001),
        'bbox_extended_x': round((ext_mx - ext_mn).x, 5),
        'floating_parts': floating,
        'no_floating_ok': bool(not floating),
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
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.05
    try:
        scene.eevee.taa_render_samples = 128
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
    bg.inputs['Color'].default_value = (0.640, 0.636, 0.628, 1.0)
    bg.inputs['Strength'].default_value = 0.30

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=9,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.520, 0.514, 0.502, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.38, -0.42, 0.52), 3.20, 0.46),
            ('fill', (-0.50, -0.34, 0.30), 0.80, 0.70),
            ('rim', (0.04, 0.48, 0.46), 1.80, 0.46)):
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
            need = max(need,
                       abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(mn - center, mx - center)
    # крупный план: передняя крышка, втулка, шток, вилка, передний порт и шланг
    close_t = Vector((0.065, 0.0, 0.055))
    c_close = box_corners(Vector((0.024, -0.024, 0.030)) - close_t,
                          Vector((0.106, 0.024, 0.082)) - close_t)

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

    close_names = {'fork_body', 'fork_cheek_l', 'fork_cheek_r', 'fork_pin',
                   'front_head', 'rod_bush', 'wiper_seal', 'port_boss_front',
                   'port_nut_front', 'port_nipple_front', 'stripe_front'}
    close_objs = [o for o in mesh_objs if o.name[len(PREFIX):] in close_names]

    views = [
        ('3q', (0.78, -0.76, 0.60), center + Vector((0, 0, 0.006)), 70, c_main,
         0.92, None),
        ('front', (1.00, -0.12, 0.18), center + Vector((0.006, 0, 0.004)), 70,
         c_main, 0.90, None),
        ('side', (0.04, -1.00, 0.18), center + Vector((0, 0, 0.006)), 70, c_main,
         0.92, None),
        ('closeup', (0.56, -0.80, 0.40), close_t, 85, c_close, 0.94, close_objs),
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
    anim, movers = build()
    rep = check(anim, movers)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok'] and rep['pivot_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and rep['no_floating_ok'] and rep['static_frozen_ok']
            and rep['slide_rigid_ok'] and rep['piston_clearance_ok']):
        raise SystemExit('checks failed')


main()
