"""Standalone builder: motion_linear_x (MOT-X-01, «X-каретка»).

Линейная X-ось: две алюминиевые профильные балки с распорками и лапами,
два профильных рельса, каретка на четырёх башмаках, ШВП по центру
(винт + гайка с кронштейном), серво с редуктором на торце, концевые упоры
с резиновыми подушками, концевики с LED, кабельный лоток с энергоцепью,
кожух-гармошка на оба конца, монтажные фланцы, шильдик.
Плиты-основания нет.

Не зависит от build_component_library.py / build_motion_linear_y.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_linear_x.py

Выход:
  public/models/machine-modules/components/motion_linear_x.glb
  docs/plans/blockout/component-library/motion_linear_x/*.png
  docs/plans/blockout/component-library/motion_linear_x/report.json

Геометрия (Blender Z-up, метры):
  ось движения   = X; габарит 1,2 (X) x 0,3 (Y) x 0,2 (Z); низ на z = 0
  анимация       = сдвиг пустышки motion_linear_x__anim по X, 0..0,20 м
  двигается      = carriage_bottom (с гайкой ШВП, кронштейном и креплением
                   кабеля), carriage_top (плита с фланцами),
                   carriage_cheek_F / carriage_cheek_B (щёки с башмаками)
  статично       = балки, распорки, лапы, рельсы, винт и его опоры,
                   привод, упоры, концевики, лоток с цепью, гармошка,
                   фланцы, шильдик
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_linear_x'
CID = 'motion_linear_x'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
X_OUT = 0.600                      # половина габарита по X (по паспорту 1,2)
BEAM_X = 0.470                     # концы профильных балок
BEAM_IY, BEAM_OY = 0.023, 0.101    # внутренняя/внешняя кромка балки
BEAM_Z0, BEAM_Z1 = 0.012, 0.058
RAIL_Y = 0.062                     # ось каждого из двух рельсов
RAIL_X0, RAIL_X1 = -0.520, 0.520
RAIL_BODY_HW, RAIL_HEAD_HW = 0.022, 0.015
RAIL_Z = (0.058, 0.066, 0.100, 0.112)   # база / тело / головка (низ, верх)

CARR_HX, CARR_HY = 0.104, 0.126
YOKE_Z = (0.112, 0.132)
CHEEK_X = (0.090, 0.104)
CHEEK_Z = (0.112, 0.176)
TOP_Z = (0.176, 0.192)
FLANGE_Z = (0.192, 0.198)
BOLT_TOP = 0.200                   # верх габарита

SCREW_Y = 0.0
SCREW_Z = 0.082
SCREW_R = 0.0115
SCREW_X0, SCREW_X1 = -0.480, 0.510

TRAY_Y = (-0.150, -0.132)          # лоток кабельного контура, -Y (сторона обзора)
TRAY_FLOOR_Z = (0.080, 0.088)
TRAY_WALL_Z = (0.088, 0.118)

STOP_X = 0.353                     # центр концевого упора
BELLOWS_X = (0.380, 0.480)         # гармошка на каждом конце

ANIM_Z = (YOKE_Z[0] + YOKE_Z[1]) * 0.5     # 0.122 — центр каретки

PALETTE = {
    'alu': (0.735, 0.742, 0.748),
    'steel': (0.660, 0.666, 0.658),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.150, 0.156, 0.166),
    'ivory': (0.980, 0.973, 0.957),
    'blush': (0.910, 0.725, 0.749),
    'red': (0.720, 0.070, 0.060),
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
    bsdf.inputs['Roughness'].default_value = 0.58
    metal = 0.55 if role in ('alu', 'steel') else 0.30 if role == 'graphite' else 0.0
    bsdf.inputs['Metallic'].default_value = metal
    if role == 'alu':
        bsdf.inputs['Roughness'].default_value = 0.42
    if role == 'ivory':
        bsdf.inputs['Roughness'].default_value = 0.50
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.55
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


def sphere(name, loc, radius, role, segs=18, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


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
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def text_label(name, body, loc, size, role,
               rot=(math.radians(90), 0, 0)):
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


def join_as(target, others):
    """Слить детали в один узел: остаётся имя target."""
    select_only(target)
    for o in others:
        o.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()
    return bpy.context.object


# --- сборка --------------------------------------------------------------
def build():
    reset()
    movers = []

    anim = empty(PREFIX + 'anim', (0.0, 0.0, ANIM_Z))
    bpy.context.view_layer.update()

    # ---------- станина: две профильные балки + распорки + лапы ----------
    for tag, sy in (('L', -1), ('R', 1)):
        yc = sy * RAIL_Y
        cube(PREFIX + f'beam_{tag}', (0.0, yc, (BEAM_Z0 + BEAM_Z1) * 0.5),
             (BEAM_X * 2, BEAM_OY - BEAM_IY, BEAM_Z1 - BEAM_Z0), 'alu', r=0.004)
        cube(PREFIX + f'beam_groove_{tag}', (0.0, sy * (BEAM_OY + 0.0008), 0.036),
             (BEAM_X * 1.86, 0.0032, 0.014), 'dark', r=0.0008)
        for i, x in enumerate((-0.300, 0.0, 0.300)):
            cube(PREFIX + f'foot_{tag}{i}', (x, yc, 0.007),
                 (0.062, 0.072, 0.014), 'graphite', r=0.0025)
    for i, x in enumerate((-0.400, 0.0, 0.400)):
        cube(PREFIX + f'cross_strut_{i}', (x, 0.0, 0.035),
             (0.026, BEAM_OY * 2 - 0.004, 0.030), 'graphite', r=0.003)

    # ---------- рельсы ----------
    for tag, sy in (('L', -1), ('R', 1)):
        yc = sy * RAIL_Y
        cube(PREFIX + f'rail_bed_{tag}', (0.0, yc, 0.062),
             (RAIL_X1 - RAIL_X0, 0.052, RAIL_Z[1] - RAIL_Z[0]), 'dark', r=0.002)
        cube(PREFIX + f'rail_{tag}', (0.0, yc, (RAIL_Z[1] + RAIL_Z[2]) * 0.5),
             (RAIL_X1 - RAIL_X0, RAIL_BODY_HW * 2, RAIL_Z[2] - RAIL_Z[1]),
             'alu', r=0.0016)
        cube(PREFIX + f'rail_head_{tag}', (0.0, yc, (RAIL_Z[2] + RAIL_Z[3]) * 0.5),
             (RAIL_X1 - RAIL_X0, RAIL_HEAD_HW * 2, RAIL_Z[3] - RAIL_Z[2]),
             'steel', r=0.0009)
        for s, sgn in (('i', -1), ('o', 1)):
            cube(PREFIX + f'rail_slot_{tag}{s}',
                 (0.0, yc + sgn * (RAIL_BODY_HW - 0.0035), 0.083),
                 (RAIL_X1 - RAIL_X0 - 0.030, 0.0032, 0.012), 'dark', r=0.0007)

    # ---------- торцевые башмаки «молочные концы» ----------
    for tag, sx in (('L', -1), ('R', 1)):
        cube(PREFIX + f'end_cap_{tag}', (sx * 0.485, 0.0, 0.056),
             (0.030, 0.240, 0.088), 'ivory', r=0.004)
        cube(PREFIX + f'end_cap_groove_{tag}', (sx * 0.4995, 0.0, 0.074),
             (0.0030, 0.180, 0.012), 'dark', r=0.0008)

    # ---------- монтажные фланцы (крепление «док») ----------
    for tag, sx in (('L', -1), ('R', 1)):
        cube(PREFIX + f'mount_flange_{tag}', (sx * 0.492, 0.0, 0.006),
             (0.064, 0.300, 0.012), 'alu', r=0.0035)
        for i, (dx, dy) in enumerate(((-0.022, -1), (0.022, -1),
                                      (-0.022, 1), (0.022, 1))):
            cyl(PREFIX + f'mount_bolt_{tag}{i}',
                (sx * 0.492 + dx, dy * 0.132, 0.012),
                (sx * 0.492 + dx, dy * 0.132, 0.021), 0.0052, 'steel',
                vertices=12, bev=0.0008)

    # ---------- концевые упоры и подушки ----------
    for tag, sx in (('L', -1), ('R', 1)):
        cube(PREFIX + f'stop_{tag}', (sx * STOP_X, 0.0, 0.128),
             (0.026, 0.160, 0.032), 'red', r=0.003)
        cube(PREFIX + f'stop_pad_{tag}', (sx * (STOP_X - 0.0145), 0.0, 0.128),
             (0.006, 0.140, 0.024), 'dark', r=0.0012)

    # ---------- концевики с LED ----------
    for tag, sx in (('L', -1), ('R', 1)):
        cube(PREFIX + f'sensor_{tag}', (sx * 0.334, -0.108, 0.038),
             (0.036, 0.014, 0.028), 'graphite', r=0.002)
        sphere(PREFIX + f'sensor_led_{tag}', (sx * 0.334, -0.1155, 0.040),
               0.0040, 'cyan')

    # ---------- кожух-гармошка на обоих концах ----------
    for tag, sx in (('L', -1), ('R', 1)):
        x0, x1 = BELLOWS_X
        for i in range(5):
            x = sx * (x0 + 0.010 + i * 0.020)
            w = 0.196 if i % 2 == 0 else 0.182
            cube(PREFIX + f'bellows_{tag}_pleat_{i}', (x, 0.0, 0.094),
                 (0.007, w, 0.070), 'dark', r=0.0012)
        for e, xe in (('in', x0 - 0.004), ('out', x1 + 0.004)):
            cube(PREFIX + f'bellows_{tag}_plate_{e}', (sx * xe, 0.0, 0.096),
                 (0.010, 0.208, 0.078), 'graphite', r=0.0018)

    # ---------- ШВП: винт, кольца резьбы, опоры ----------
    cyl(PREFIX + 'screw', (SCREW_X0, SCREW_Y, SCREW_Z),
        (SCREW_X1, SCREW_Y, SCREW_Z), SCREW_R, 'steel', vertices=24, bev=0.0006)
    x = SCREW_X0 + 0.014
    ring = 0
    while x < SCREW_X1 - 0.010:
        if abs(x) > 0.070:                    # зона гайки
            cyl(PREFIX + f'screw_ring_{ring:02d}', (x, SCREW_Y, SCREW_Z),
                (x + 0.0055, SCREW_Y, SCREW_Z), SCREW_R + 0.0013, 'steel',
                vertices=20, bev=0.0004)
            ring += 1
        x += 0.030
    for tag, sx in (('L', -1), ('R', 1)):
        # литая стойка на торцевом башмаке
        cube(PREFIX + f'screw_pedestal_{tag}', (sx * 0.486, 0.0, 0.086),
             (0.030, 0.104, 0.056), 'graphite', r=0.0035)
        cyl(PREFIX + f'screw_boss_{tag}', (sx * 0.500, 0.0, SCREW_Z),
            (sx * 0.470, 0.0, SCREW_Z), 0.019, 'steel', vertices=22, bev=0.0012)
        cyl(PREFIX + f'screw_boss_cap_{tag}', (sx * 0.5015, 0.0, SCREW_Z),
            (sx * 0.5055, 0.0, SCREW_Z), 0.013, 'graphite', vertices=16,
            bev=0.0008)

    # ---------- концевая опора винта и торцевая крышка (-X) ----------
    cyl(PREFIX + 'screw_housing_L', (-0.584, 0.0, SCREW_Z), (-0.500, 0.0, SCREW_Z),
        0.0245, 'graphite', vertices=28, bev=0.0025)
    torus(PREFIX + 'screw_housing_ring_L', (-0.512, 0.0, SCREW_Z), 0.0252, 0.0018,
          'steel', 'X')
    cube(PREFIX + 'end_cover_L', (-0.592, 0.0, 0.088), (0.016, 0.132, 0.104),
         'graphite', r=0.0035)
    torus(PREFIX + 'end_cover_ring_L', (-0.5905, 0.0, SCREW_Z), 0.0272, 0.0022,
          'steel', 'X')
    cube(PREFIX + 'end_cover_groove_L', (-0.5852, 0.0, 0.088),
         (0.0030, 0.096, 0.012), 'dark', r=0.0008)

    # ---------- привод: серво с редуктором на торце ----------
    cube(PREFIX + 'motor_flange', (0.505, 0.0, 0.085), (0.010, 0.144, 0.112),
         'graphite', r=0.003)
    for i, (dy, dz) in enumerate(((-0.058, -0.044), (0.058, -0.044),
                                  (-0.058, 0.044), (0.058, 0.044))):
        cyl(PREFIX + f'motor_flange_bolt_{i}', (0.510, dy, 0.085 + dz),
            (0.516, dy, 0.085 + dz), 0.0046, 'steel', vertices=12, bev=0.0006)
    cyl(PREFIX + 'gearbox', (0.508, 0.0, SCREW_Z), (0.536, 0.0, SCREW_Z),
        0.040, 'graphite', vertices=36, bev=0.0035)
    cube(PREFIX + 'gearbox_nose', (0.522, 0.0, 0.116), (0.036, 0.060, 0.044),
         'graphite', r=0.003)
    cyl(PREFIX + 'motor', (0.536, 0.0, SCREW_Z), (0.584, 0.0, SCREW_Z),
        0.045, 'blush', vertices=36, bev=0.0035)
    for i, mx in enumerate((0.548, 0.562, 0.575)):
        torus(PREFIX + f'motor_fin_{i}', (mx, 0.0, SCREW_Z), 0.0462, 0.0022,
              'steel', 'X')
    cyl(PREFIX + 'motor_cap', (0.584, 0.0, SCREW_Z), (0.600, 0.0, SCREW_Z),
        0.038, 'graphite', vertices=30, bev=0.0025)
    torus(PREFIX + 'motor_cap_ring', (0.594, 0.0, SCREW_Z), 0.0362, 0.0018,
          'steel', 'X')

    # ---------- терминал и кабель привода ----------
    cube(PREFIX + 'motor_terminal', (0.583, -0.062, 0.130), (0.026, 0.042, 0.032),
         'graphite', r=0.0025)
    cube(PREFIX + 'motor_terminal_face', (0.597, -0.062, 0.130),
         (0.003, 0.030, 0.020), 'cyan', r=0.0008)
    curve_tube(PREFIX + 'motor_cable',
                [(0.583, -0.075, 0.126), (0.578, -0.104, 0.118),
                 (0.552, -0.122, 0.112), (0.508, -0.136, 0.106),
                 (0.462, -0.138, 0.100)], 0.0042, 'dark')

    # ---------- кабельный лоток + энергоцепь ----------
    cube(PREFIX + 'duct_tray', (0.0, (TRAY_Y[0] + TRAY_Y[1]) * 0.5, 0.084),
         (0.960, TRAY_Y[1] - TRAY_Y[0], TRAY_FLOOR_Z[1] - TRAY_FLOOR_Z[0]),
         'dark', r=0.0018)
    cube(PREFIX + 'duct_wall_in', (0.0, TRAY_Y[0] + 0.003, 0.103),
         (0.960, 0.006, TRAY_WALL_Z[1] - TRAY_WALL_Z[0]), 'graphite', r=0.0012)
    cube(PREFIX + 'duct_wall_out', (0.0, TRAY_Y[1] - 0.003, 0.096),
         (0.960, 0.006, 0.016), 'graphite', r=0.0012)
    for i, x in enumerate((-0.350, 0.0, 0.350)):
        cube(PREFIX + f'duct_bracket_{i}', (x, -0.115, 0.076),
             (0.024, 0.034, 0.020), 'graphite', r=0.0018)

    link = (0.027, 0.014, 0.018)
    cy = (TRAY_Y[0] + TRAY_Y[1]) * 0.5
    n = 0

    def chain_link(x, z, rot=0.0):
        nonlocal n
        obj = cube(PREFIX + f'chain_link_{n:02d}', (x, cy, z), link, 'graphite',
                   r=0.002, rot=(0.0, rot, 0.0))
        n += 1
        return obj

    x = -0.462
    while x < -0.212:                      # нижняя ветвь в лотке
        chain_link(x, 0.100)
        x += 0.026
    chain_link(-0.196, 0.110, math.radians(28))
    chain_link(-0.184, 0.120, math.radians(58))
    chain_link(-0.178, 0.128, math.radians(84))
    for i in range(6):                     # верхняя ветвь к каретке
        chain_link(-0.160 + i * 0.026, 0.132)
    cube(PREFIX + 'chain_anchor', (-0.474, cy, 0.098), (0.020, 0.018, 0.026),
         'graphite', r=0.002)

    # ---------- разъём питания и шильдик ----------
    cube(PREFIX + 'power_connector', (0.300, -0.107, 0.038), (0.052, 0.012, 0.030),
         'graphite', r=0.002)
    cube(PREFIX + 'power_connector_face', (0.300, -0.1135, 0.038),
         (0.034, 0.003, 0.018), 'cyan', r=0.0008)

    cube(PREFIX + 'label_plate', (-0.240, -0.1035, 0.036), (0.130, 0.005, 0.030),
         'graphite', r=0.0010)
    text_label(PREFIX + 'label_text', 'MOT-X-01', (-0.240, -0.1072, 0.036),
               0.0115, 'ivory')

    # ---------- каретка: 4 движущихся узла ----------
    # 1) нижний блок: ярмо + гайка ШВП + кронштейн + крепление кабеля
    yoke = cube(PREFIX + 'carriage_bottom', (0.0, 0.0, (YOKE_Z[0] + YOKE_Z[1]) * 0.5),
                (CARR_HX * 2, CARR_HY * 2, YOKE_Z[1] - YOKE_Z[0]), 'graphite', r=0.004)
    nut = cube(PREFIX + 'carriage_bottom_nut', (0.0, SCREW_Y, 0.080),
               (0.088, 0.042, 0.036), 'graphite', r=0.0025)
    nut_carrier = cube(PREFIX + 'carriage_bottom_nut_carrier', (0.0, 0.0, 0.103),
                       (0.104, 0.058, 0.020), 'steel', r=0.0025)
    nut_collars = []
    for i, sx in enumerate((-1, 1)):
        nut_collars.append(cyl(PREFIX + f'carriage_bottom_nut_collar_{i}',
                               (sx * 0.044, SCREW_Y, 0.080),
                               (sx * 0.056, SCREW_Y, 0.080), 0.019, 'steel',
                               vertices=20, bev=0.0010))
    chain_bracket = cube(PREFIX + 'carriage_bottom_chain_bracket',
                         (0.0, -0.133, 0.130), (0.056, 0.030, 0.016), 'steel', r=0.002)
    movers.append(join_as(yoke, [nut, nut_carrier, *nut_collars, chain_bracket]))

    # 2) верхняя плита с монтажными фланцами
    top = cube(PREFIX + 'carriage_top', (0.0, 0.0, (TOP_Z[0] + TOP_Z[1]) * 0.5),
               (CARR_HX * 2, CARR_HY * 2, TOP_Z[1] - TOP_Z[0]), 'alu', r=0.0035)
    top_parts = []
    for i, (sx, sy) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        top_parts.append(cube(PREFIX + f'carriage_top_flange_{i}',
                              (sx * 0.078, sy * 0.100, (FLANGE_Z[0] + FLANGE_Z[1]) * 0.5),
                              (0.040, 0.040, FLANGE_Z[1] - FLANGE_Z[0]), 'alu',
                              r=0.0018))
        top_parts.append(cyl(PREFIX + f'carriage_top_bolt_{i}',
                              (sx * 0.078, sy * 0.100, 0.194),
                              (sx * 0.078, sy * 0.100, BOLT_TOP), 0.0062, 'steel',
                              vertices=14, bev=0.0008))
    movers.append(join_as(top, top_parts))

    # 3-4) щёки с башмаками
    for tag, sx in (('F', 1), ('B', -1)):
        cheek = cube(PREFIX + f'carriage_cheek_{tag}',
                     (sx * (CHEEK_X[0] + CHEEK_X[1]) * 0.5, 0.0,
                      (CHEEK_Z[0] + CHEEK_Z[1]) * 0.5),
                     (CHEEK_X[1] - CHEEK_X[0], CARR_HY * 2, CHEEK_Z[1] - CHEEK_Z[0]),
                     'graphite', r=0.0025)
        parts = []
        for i, sy in enumerate((-1, 1)):
            parts.append(cube(PREFIX + f'carriage_cheek_{tag}_shoe_{i}',
                              (sx * 0.094, sy * 0.095, 0.093),
                              (0.020, 0.014, 0.046), 'steel', r=0.0018))
            parts.append(cube(PREFIX + f'carriage_cheek_{tag}_pad_{i}',
                              (sx * 0.094, sy * 0.087, 0.093),
                              (0.014, 0.006, 0.034), 'dark', r=0.0010))
        parts.append(cube(PREFIX + f'carriage_cheek_{tag}_web',
                          (sx * 0.090, 0.0, 0.120),
                          (0.018, 0.150, 0.014), 'graphite', r=0.0018))
        # сервисная панель на торце щёки + крепёж
        parts.append(cube(PREFIX + f'carriage_cheek_{tag}_panel',
                          (sx * 0.1055, 0.0, 0.146),
                          (0.005, 0.168, 0.036), 'dark', r=0.0014))
        for i, (dy, dz) in enumerate(((-0.072, -0.016), (0.072, -0.016),
                                      (-0.072, 0.016), (0.072, 0.016))):
            parts.append(cyl(PREFIX + f'carriage_cheek_{tag}_bolt_{i}',
                             (sx * 0.104, dy, 0.146 + dz),
                             (sx * 0.1095, dy, 0.146 + dz), 0.0046, 'steel',
                             vertices=12, bev=0.0006))
        movers.append(join_as(cheek, parts))

    # ---------- привязка к анимационной пустышке ----------
    bpy.context.view_layer.update()
    for o in movers:
        parent(o, anim)
        o['moving'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in movers:
            o['moving'] = False

    anim['motion_type'] = 'slide'
    anim['motion_axis'] = 'x'
    anim['motion_amount'] = 0.20
    anim['motion_speed'] = 0.82
    anim['motion_parts'] = ['carriage_bottom', 'carriage_top',
                            'carriage_cheek_F', 'carriage_cheek_B']

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


def point_box_dist(p, mn, mx):
    """Расстояние от точки до bbox (0 — внутри)."""
    d = 0.0
    for i in range(3):
        if p[i] < mn[i]:
            d = max(d, mn[i] - p[i])
        elif p[i] > mx[i]:
            d = max(d, p[i] - mx[i])
    return d


def mesh_bbox_boxes(objects):
    return {o.name: mesh_bbox([o]) for o in objects if o.type == 'MESH'}


def box_gap(a_mn, a_mx, b_mn, b_mx):
    gap = 0.0
    for i in range(3):
        d = max(b_mn[i] - a_mx[i], a_mn[i] - b_mx[i])
        gap = max(gap, d)
    return gap


BLOCKERS = ('stop_', 'bellows_', 'end_cap_', 'motor', 'gearbox',
            'sensor_', 'duct_wall', 'mount_flange', 'screw_pedestal')


def check(anim, movers):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    passport = (1.200, 0.300, 0.200)
    got_sorted = tuple(sorted((round(size.x, 5), round(size.y, 5), round(size.z, 5)),
                              reverse=True))
    bbox_ok = all(abs(g - p) <= 0.004 for g, p in zip(got_sorted, passport))

    kids = [o for o in anim.children if o.type == 'MESH']
    kid_names = {o.name for o in kids}

    # --- ход: двигается только каретка, статика заморожена ---
    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    delta = 0.200
    base_loc = anim.location.copy()
    anim.location = Vector((base_loc.x + delta, base_loc.y, base_loc.z))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}

    move_err = 0.0
    for name in kid_names:
        move_err = max(move_err, (after[name] - before[name] - Vector((delta, 0, 0))).length)
    static_err = max(((after[n] - before[n]).length for n in before if n not in kid_names),
                     default=0.0)

    anim.location = base_loc
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    pivot_shift = max((restored[n] - before[n]).length for n in before)

    # --- просвет по всему ходу относительно неподвижных узлов ---
    blocker_boxes = {}
    for o in meshes:
        if o.name in kid_names:
            continue
        short = o.name[len(PREFIX):]
        if short.startswith(BLOCKERS):
            blocker_boxes[o.name] = mesh_bbox([o])

    travel = 0.220
    clearance = 1e9
    clearance_at = None
    for step in (-1.0, -0.5, 0.0, 0.5, 1.0):
        anim.location = Vector((base_loc.x + travel * step, base_loc.y, base_loc.z))
        bpy.context.view_layer.update()
        for o in kids:
            mw = o.matrix_world
            pts = [mw @ v.co for v in o.data.vertices]
            for bn, (c, d) in blocker_boxes.items():
                g = min(point_box_dist(p, c, d) for p in pts)
                if g < clearance:
                    clearance = g
                    clearance_at = (round(travel * step, 3),
                                    o.name[len(PREFIX):], bn[len(PREFIX):])
    anim.location = base_loc
    bpy.context.view_layer.update()

    # --- крайние узлы по каждой оси (диагностика габарита) ---
    extremes = {}
    for name, (a, b) in mesh_bbox_boxes(meshes).items():
        for i, axis in enumerate('xyz'):
            for side, val in (('min', a[i]), ('max', b[i])):
                key = f'{axis}_{side}'
                cur = extremes.get(key)
                if cur is None or (val < cur[0] if side == 'min' else val > cur[0]):
                    extremes[key] = (val, name[len(PREFIX):])

    # --- «не висит в воздухе» ---
    boxes = {}
    for o in meshes:
        a, b = mesh_bbox([o])
        boxes[o.name] = (a, b)
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0016
                   for other in boxes):
            floating.append(name[len(PREFIX):])

    axis_ok = (abs(base_loc.x) < 1e-6 and abs(base_loc.y) < 1e-6
               and abs(base_loc.z - ANIM_Z) < 1e-6)

    report = {
        'component': CID,
        'code': 'MOT-X-01',
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
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in base_loc],
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'static_parts': sorted(o.name[len(PREFIX):] for o in meshes
                               if o.name not in kid_names),
        'static_count': len([o for o in meshes if o.name not in kid_names]),
        'slide_delta_m': delta,
        'mover_error_m': round(move_err, 9),
        'static_error_m': round(static_err, 9),
        'slide_rigid_ok': bool(move_err < 1e-6),
        'static_frozen_ok': bool(static_err < 1e-9),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_ok': bool(pivot_shift < 1e-6 and axis_ok),
        'travel_m': 0.200,
        'travel_max_m': travel,
        'min_clearance_m': round(clearance, 5),
        'min_clearance_at': clearance_at,
        'travel_clear_ok': bool(clearance > 0.0015),
        'extreme_parts': {k: [round(v, 5), n]
                          for k, (v, n) in sorted(extremes.items())},
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
    scene.view_settings.exposure = 0.10
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.38

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3.2,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.55, -0.60, 0.62), 3.40, 0.55),
            ('fill', (-0.70, -0.50, 0.34), 1.05, 0.80),
            ('rim', (0.05, 0.62, 0.50), 1.60, 0.60)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.55))
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
    # крупный план: каретка, башмаки, гайка ШВП, привод
    close_t = Vector((0.020, -0.020, 0.148))
    c_close = box_corners(Vector((-0.150, -0.155, 0.085)) - close_t,
                          Vector((0.170, 0.130, 0.205)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

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
                if p.z <= 0.0:          # за камерой — не учитываем
                    continue
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    close_lo = close_t + Vector((-0.175, -0.175, -0.075))
    close_hi = close_t + Vector((0.195, 0.155, 0.075))
    views = [
        ('3q', (0.86, -0.72, 0.46), center + Vector((0, 0, 0.010)), 72, c_main, 0.94, None),
        ('front', (1.00, -0.14, 0.16), center + Vector((0.28, 0, 0.004)), 78, c_main, 0.88, None),
        ('side', (0.10, -1.00, 0.14), center + Vector((0, 0, 0.004)), 72, c_main, 0.94, None),
        ('closeup', (0.58, -0.72, 0.40), close_t, 85, c_close, 0.92,
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
            and rep['travel_clear_ok']):
        raise SystemExit('checks failed')


main()
