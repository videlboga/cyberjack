"""Standalone builder: motion_piston_hydraulic (MOT-PIS-03, «Гидравлический поршень»).

Тяжёлый стальной гидроцилиндр двустороннего действия Ø40 x 220 мм:
толстостенная гильза (стенка 4 мм, расточка Ø32), массивная задняя крышка
с болтовым кругом, фланец-кольцо на 6 болтов, проушина-вилка с пальцем,
передняя головка с буртом и болтами, уплотнение (wiper), хромированный шток
Ø18 с накатанной резьбой и вилкой на пальце, поршень с бронзовым кольцом,
два гидропорта высокого давления с гайками и жёсткими трубками, блок
предохранительного клапана с регулировочным винтом, гибкий шланг слива,
янтарная маркировочная полоса и шильдик. Плиты-основания нет.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_piston_hydraulic.py

Выход:
  public/models/machine-modules/components/motion_piston_hydraulic.glb
  docs/plans/blockout/component-library/motion_piston_hydraulic/*.png
  docs/plans/blockout/component-library/motion_piston_hydraulic/report.json

Геометрия (Blender Z-up, метры):
  ось цилиндра  = X, y = 0, z = 0.045; Blender X -> glTF X (export_yup)
  габарит       = 0.220 (X) x 0.078 (Y) x 0.069 (Z); паспорт Ø20–40 x 220
                  (сечение больше паспортного за счёт портов, клапана и
                  клапанного блока — сама гильза Ø40, стенка 4 мм)
  анимация      = сдвиг пустышки motion_piston_hydraulic__anim по X, 0..0.08 м
  двигается     = шток, поршень с кольцом, резьбовой конец, вилка (2 щеки,
                  тело) с пальцем
  статично      = гильза с бандажами, квадратный фланец с болтами, шейка,
                  проушина с пальцем, головка с буртом и болтами, wiper,
                  два порта, жёсткие трубки, клапанный блок, шланг, шильдик
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_piston_hydraulic'
CID = 'motion_piston_hydraulic'
PREFIX = CID + '__'
CODE = 'MOT-PIS-03'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.045                      # высота оси цилиндра
X_MIN, X_MAX = -0.110, 0.110    # паспорт: длина 220 мм

BARREL_X0, BARREL_X1 = -0.0660, 0.0380
BARREL_R = 0.0200               # гильза Ø40
BORE_R = 0.0160                 # расточка Ø32 -> стенка 4 мм
WALL = BARREL_R - BORE_R

FLANGE_X0, FLANGE_X1 = -0.0790, -0.0655   # квадратный задний фланец-крышка
FLANGE_HALF = 0.0262
NECK_X0, NECK_X1 = -0.0880, -0.0740
NECK_R = 0.0100

G_FLANGE_X0, G_FLANGE_X1 = 0.0340, 0.0420
G_FLANGE_R = 0.0235
G_BODY_X0, G_BODY_X1 = 0.0420, 0.0500
G_BODY_R = 0.0212
GUIDE_X0, GUIDE_X1 = 0.0500, 0.0530
GUIDE_R = 0.0140
WIPER_X0, WIPER_X1 = 0.0528, 0.0552

ROD_R = 0.0090                  # шток Ø18, хром
ROD_X0, ROD_X1 = -0.0550, 0.0855
ROD_BOSS_X0, ROD_BOSS_X1 = 0.0790, 0.0840
ROD_BOSS_R = 0.0118

REAR_EYE_X = -0.0965
REAR_EYE_R = 0.0135
REAR_EYE_HOLE = 0.0058
REAR_EYE_T = 0.0160
REAR_PIN_R = 0.0054

FRONT_EYE_X = 0.0962
FRONT_EYE_R = 0.0138
FRONT_EYE_HOLE = 0.0048
FRONT_EYE_T = 0.0055
FRONT_EYE_Y = 0.0070

PISTON_X0, PISTON_X1 = -0.0620, -0.0440
PISTON_R = BORE_R - 0.0002

PORT_A_X = -0.0480
PORT_B_X = 0.0180
PORT_BOSS_R = 0.0076
PORT_NUT_R = 0.0094
PORT_STUB_R = 0.0056
PORT_TOP = Z0 + 0.0385

MANI_X0, MANI_X1 = -0.0360, -0.0060
MANI_Y0, MANI_Y1 = -0.0300, -0.0120
MANI_Z0, MANI_Z1 = Z0 - 0.0120, Z0 + 0.0200

TRAVEL = 0.08
ANIM_SPEED = 0.7

PALETTE = {
    'steel': (0.545, 0.556, 0.572),
    'chrome': (0.880, 0.895, 0.910),
    'dark': (0.150, 0.155, 0.165),
    'graphite': (0.300, 0.312, 0.330),
    'amber': (0.880, 0.560, 0.090),
    'bronze': (0.700, 0.480, 0.240),
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
    metal, rough = {
        'steel': (0.88, 0.42),
        'chrome': (1.00, 0.08),
        'dark': (0.30, 0.74),
        'graphite': (0.45, 0.55),
        'amber': (0.00, 0.44),
        'bronze': (0.80, 0.42),
    }[role]
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Roughness'].default_value = rough
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


def torus(name, loc, major, minor, role, axis='Z', segs=44, rings=10):
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


def curve_tube(name, points, radius, role, res=8, smooth=True):
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
    obj.data.materials.append(mat(role))
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
    if smooth:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def ring_solid(name, center, direction, r_out, r_in, depth, role, segs=40,
               smooth=True):
    """Кольцо-тело с настоящим отверстием (труба/шайба/проушина)."""
    d = Vector(direction).normalized()
    ref = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = d.cross(ref).normalized()
    v = d.cross(u).normalized()
    c0 = Vector(center) - d * (depth * 0.5)
    c1 = Vector(center) + d * (depth * 0.5)
    bm = bmesh.new()
    o0, o1, i0, i1 = [], [], [], []
    for k in range(segs):
        a = math.tau * k / segs
        rad = u * math.cos(a) + v * math.sin(a)
        o0.append(bm.verts.new(c0 + rad * r_out))
        o1.append(bm.verts.new(c1 + rad * r_out))
        i0.append(bm.verts.new(c0 + rad * r_in))
        i1.append(bm.verts.new(c1 + rad * r_in))
    for k in range(segs):
        n = (k + 1) % segs
        bm.faces.new((o0[k], o0[n], o1[n], o1[k]))
        bm.faces.new((i0[n], i0[k], i1[k], i1[n]))
        bm.faces.new((o0[n], o0[k], i0[k], i0[n]))
        bm.faces.new((o1[k], o1[n], i1[n], i1[k]))
    return mesh_from_bm(name, bm, role, smooth)


def bolt_ring(name, x0, x1, ring_r, r, count, role, phase=0.0, segs=6,
              axis='X', center=(0.0, 0.0, Z0)):
    """Круг болтов/гаек вдоль оси X (или Y)."""
    bm = bmesh.new()
    cx, cy, cz = center
    if axis == 'X':
        m_rot = Vector((1, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    else:
        m_rot = Vector((0, 1, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4()
    for k in range(count):
        a = phase + math.tau * k / count
        if axis == 'X':
            loc = Vector((cx + (x0 + x1) * 0.5, cy + ring_r * math.cos(a),
                          cz + ring_r * math.sin(a)))
        else:
            loc = Vector((cx + ring_r * math.cos(a), cy + (x0 + x1) * 0.5,
                          cz + ring_r * math.sin(a)))
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                              radius1=r, radius2=r, depth=abs(x1 - x0),
                              matrix=Matrix.Translation(loc) @ m_rot)
    return mesh_from_bm(name, bm, role, False)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def port(tag, x):
    """Гидропорт высокого давления: бобышка, гайка, штуцер. Возвращает точку."""
    cyl(PREFIX + f'port_{tag}_boss', (x, 0, Z0 + 0.0160), (x, 0, Z0 + 0.0285),
        PORT_BOSS_R, 'steel', vertices=24, bev=0.0008)
    cyl(PREFIX + f'port_{tag}_nut', (x, 0, Z0 + 0.0270), (x, 0, Z0 + 0.0340),
        PORT_NUT_R, 'graphite', vertices=6, smooth=False, bev=0.0006)
    cyl(PREFIX + f'port_{tag}_stub', (x, 0, Z0 + 0.0330), (x, 0, PORT_TOP),
        PORT_STUB_R, 'steel', vertices=16)
    torus(PREFIX + f'port_{tag}_oring', (x, 0, Z0 + 0.0278), 0.0082, 0.0013,
          'dark', 'Z', segs=28, rings=8)
    return Vector((x, 0.0, PORT_TOP - 0.0018))


# --- сборка --------------------------------------------------------------
def build():
    reset()
    movers = []

    # ---------- гильза и бандажи ----------
    cyl(PREFIX + 'barrel', (BARREL_X0, 0, Z0), (BARREL_X1, 0, Z0), BARREL_R,
        'steel', vertices=56, bev=0.0008)
    torus(PREFIX + 'barrel_hoop_rear', (-0.0585, 0, Z0), BARREL_R + 0.0005,
          0.0026, 'steel', 'X')
    torus(PREFIX + 'barrel_hoop_front', (0.0310, 0, Z0), BARREL_R + 0.0005,
          0.0026, 'steel', 'X')
    torus(PREFIX + 'band_amber', (0.0090, 0, Z0), BARREL_R + 0.0006, 0.0024,
          'amber', 'X')

    # шильдик на боку гильзы
    cube(PREFIX + 'tag_plate', (-0.0130, 0.0195, Z0), (0.0220, 0.0022, 0.0125),
         'amber', r=0.0006)

    # ---------- квадратный задний фланец с 4 болтами ----------
    cube(PREFIX + 'rear_flange', ((FLANGE_X0 + FLANGE_X1) * 0.5, 0.0, Z0),
         (FLANGE_X1 - FLANGE_X0, 2 * FLANGE_HALF, 2 * FLANGE_HALF),
         'steel', r=0.0050)
    torus(PREFIX + 'rear_flange_seal', (FLANGE_X1 + 0.0010, 0, Z0),
          0.0206, 0.0017, 'dark', 'X', segs=48, rings=8)
    bm = bmesh.new()
    for sy in (-1, 1):
        for sz in (-1, 1):
            m = (Matrix.Translation((-0.0808, sy * 0.0200, Z0 + sz * 0.0200))
                 @ Vector((1, 0, 0)).to_track_quat('Z', 'Y').to_matrix().to_4x4())
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=6,
                                  radius1=0.0034, radius2=0.0034, depth=0.0078,
                                  matrix=m)
    mesh_from_bm(PREFIX + 'rear_flange_bolts', bm, 'graphite', False)

    # ---------- шейка и проушина (задняя серьга) с пальцем ----------
    cyl(PREFIX + 'rear_neck', (NECK_X0, 0, Z0), (NECK_X1, 0, Z0), NECK_R,
        'steel', vertices=28, bev=0.0008)
    ring_solid(PREFIX + 'rear_eye', (REAR_EYE_X, 0.0, Z0), (0, 1, 0),
               REAR_EYE_R, REAR_EYE_HOLE, REAR_EYE_T, 'steel', segs=40)
    cyl(PREFIX + 'rear_eye_pin', (REAR_EYE_X, -0.0135, Z0),
        (REAR_EYE_X, 0.0135, Z0), REAR_PIN_R, 'chrome', vertices=20)
    cyl(PREFIX + 'rear_eye_pin_head', (REAR_EYE_X, -0.0165, Z0),
        (REAR_EYE_X, -0.0130, Z0), 0.0070, 'graphite', vertices=6,
        smooth=False)

    # ---------- передняя головка: бурт, корпус, направляющая, wiper ----------
    cyl(PREFIX + 'gland_flange', (G_FLANGE_X0, 0, Z0), (G_FLANGE_X1, 0, Z0),
        G_FLANGE_R, 'steel', vertices=52, bev=0.0016)
    cyl(PREFIX + 'gland_body', (G_BODY_X0, 0, Z0), (G_BODY_X1, 0, Z0),
        G_BODY_R, 'steel', vertices=48, bev=0.0012)
    bolt_ring(PREFIX + 'gland_bolts', G_FLANGE_X1 - 0.0006, G_FLANGE_X1 + 0.0040,
              0.0206, 0.0026, 6, 'graphite', phase=0.0)
    ring_solid(PREFIX + 'rod_guide', ((GUIDE_X0 + GUIDE_X1) * 0.5, 0.0, Z0),
               (1, 0, 0), GUIDE_R, 0.0094, GUIDE_X1 - GUIDE_X0, 'steel')
    ring_solid(PREFIX + 'wiper_seal', ((WIPER_X0 + WIPER_X1) * 0.5, 0.0, Z0),
               (1, 0, 0), 0.0112, 0.0092, WIPER_X1 - WIPER_X0, 'dark')

    # ---------- подвижная группа: поршень, шток, вилка ----------
    piston = cyl(PREFIX + 'piston', (PISTON_X0, 0, Z0), (PISTON_X1, 0, Z0),
                 PISTON_R, 'bronze', vertices=44, bev=0.0008)
    piston_ring = torus(PREFIX + 'piston_ring', (-0.0500, 0, Z0), PISTON_R,
                        0.0015, 'dark', 'X', segs=44, rings=8)
    rod = cyl(PREFIX + 'rod', (ROD_X0, 0, Z0), (ROD_X1, 0, Z0), ROD_R,
              'chrome', vertices=28)
    rod_thread = torus(PREFIX + 'rod_thread', (0.0765, 0, Z0), ROD_R + 0.0002,
                       0.0011, 'chrome', 'X', segs=28, rings=8)
    boss = cyl(PREFIX + 'rod_boss', (ROD_BOSS_X0, 0, Z0), (ROD_BOSS_X1, 0, Z0),
               ROD_BOSS_R, 'graphite', vertices=24, bev=0.0010)
    clevis = []
    for tag, sy in (('l', -1), ('r', 1)):
        clevis.append(ring_solid(PREFIX + f'rod_clevis_{tag}',
                                 (FRONT_EYE_X, sy * FRONT_EYE_Y, Z0), (0, 1, 0),
                                 FRONT_EYE_R, FRONT_EYE_HOLE, FRONT_EYE_T,
                                 'steel', segs=32))
    clevis.append(cube(PREFIX + 'rod_clevis_web', (0.0900, 0.0, Z0),
                       (0.0190, 0.0136, 0.0210), 'steel', r=0.0010))
    pin = cyl(PREFIX + 'rod_pin', (FRONT_EYE_X, -0.0115, Z0),
              (FRONT_EYE_X, 0.0115, Z0), 0.0044, 'chrome', vertices=18)
    pin_head = cyl(PREFIX + 'rod_pin_head', (FRONT_EYE_X, 0.0108, Z0),
                   (FRONT_EYE_X, 0.0135, Z0), 0.0060, 'graphite', vertices=6,
                   smooth=False)
    movers += [piston, piston_ring, rod, rod_thread, boss, pin, pin_head] + clevis

    # ---------- гидропорты + жёсткие трубки ----------
    top_a = port('a', PORT_A_X)
    top_b = port('b', PORT_B_X)

    curve_tube(PREFIX + 'pipe_cap_end',
               [top_a,
                (PORT_A_X - 0.0030, -0.0130, Z0 + 0.0345),
                (PORT_A_X + 0.0080, -0.0250, Z0 + 0.0190),
                (-0.0210, -0.0190, Z0 + 0.0065)], 0.0042, 'steel')
    curve_tube(PREFIX + 'pipe_rod_end',
               [top_b,
                (PORT_B_X - 0.0030, -0.0120, Z0 + 0.0380),
                (0.0040, -0.0300, Z0 + 0.0300),
                (-0.0140, -0.0300, Z0 + 0.0205),
                (-0.0250, -0.0285, Z0 + 0.0150)], 0.0042, 'steel')
    torus(PREFIX + 'pipe_clamp_rod_end', (0.0040, -0.0300, Z0 + 0.0300),
          0.0050, 0.0016, 'dark', 'Z', segs=20, rings=8)

    # ---------- блок предохранительного клапана ----------
    cube(PREFIX + 'manifold', ((MANI_X0 + MANI_X1) * 0.5, (MANI_Y0 + MANI_Y1) * 0.5,
                               (MANI_Z0 + MANI_Z1) * 0.5),
         (MANI_X1 - MANI_X0, MANI_Y1 - MANI_Y0, MANI_Z1 - MANI_Z0),
         'graphite', r=0.0020)
    cyl(PREFIX + 'valve_body', (-0.0130, MANI_Y0, Z0 + 0.0040),
        (-0.0130, MANI_Y0 - 0.0090, Z0 + 0.0040), 0.0088, 'graphite',
        vertices=28, bev=0.0010)
    cyl(PREFIX + 'valve_cap', (-0.0130, MANI_Y0 - 0.0090, Z0 + 0.0040),
        (-0.0130, MANI_Y0 - 0.0160, Z0 + 0.0040), 0.0100, 'steel',
        vertices=6, smooth=False, bev=0.0008)
    cyl(PREFIX + 'valve_screw', (-0.0130, MANI_Y0 - 0.0160, Z0 + 0.0040),
        (-0.0130, MANI_Y0 - 0.0215, Z0 + 0.0040), 0.0036, 'dark',
        vertices=16)
    cube(PREFIX + 'valve_tag', (-0.0280, MANI_Y0 - 0.0012, Z0 + 0.0125),
         (0.0075, 0.0020, 0.0055), 'amber', r=0.0005)

    # ---------- гибкий шланг слива: уходит назад под фланцем ----------
    curve_tube(PREFIX + 'drain_hose',
               [(-0.0335, -0.0240, Z0 - 0.0090),
                (-0.0480, -0.0340, Z0 - 0.0120),
                (-0.0600, -0.0380, Z0 - 0.0110)], 0.0040, 'dark')
    cyl(PREFIX + 'hose_fitting', (-0.0600, -0.0380, Z0 - 0.0110),
        (-0.0690, -0.0400, Z0 - 0.0100), 0.0060, 'graphite', vertices=20)
    cyl(PREFIX + 'hose_fitting_nut', (-0.0690, -0.0400, Z0 - 0.0100),
        (-0.0745, -0.0410, Z0 - 0.0095), 0.0072, 'dark', vertices=6,
        smooth=False)

    # ---------- привязка к анимационной пустышке ----------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    anim['motion_type'] = 'slide'
    anim['motion_axis'] = 'X'
    anim['motion_amount'] = TRAVEL
    anim['motion_speed'] = ANIM_SPEED
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

    # --- тест хода: едет только подвижная группа ---
    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    anim.location = Vector((anim.location.x + TRAVEL, anim.location.y,
                            anim.location.z))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}
    move_err = 0.0
    for name in kid_names:
        move_err = max(move_err,
                       (after[name] - before[name] - Vector((TRAVEL, 0, 0))).length)
    static_err = max(((after[n] - before[n]).length for n in before
                      if n not in kid_names), default=0.0)

    ext_mn, ext_mx = mesh_bbox(meshes)
    anim.location = Vector((anim.location.x - TRAVEL, anim.location.y,
                            anim.location.z))
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    pivot_shift = max((restored[n] - before[n]).length for n in before)

    # --- «не висит в воздухе» ---
    boxes = {o.name: mesh_bbox([o]) for o in meshes}
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0015
                   for other in boxes):
            floating.append(name)

    anim_loc = anim.location.copy()
    axis_ok = (abs(anim_loc.x) < 1e-6 and abs(anim_loc.y) < 1e-6
               and abs(anim_loc.z - Z0) < 1e-6)

    rod_boss_mn, _ = mesh_bbox([bpy.data.objects[PREFIX + 'rod_boss']])
    exposed = rod_boss_mn.x - WIPER_X1

    bbox_ok = (abs(size.x - 0.220) <= 0.005
               and 0.040 <= size.y <= 0.090
               and 0.040 <= size.z <= 0.090)
    wall_ok = 0.003 <= WALL <= 0.008

    report = {
        'component': CID,
        'code': CODE,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in (mn + mx) * 0.5],
        'bbox_ok': bool(bbox_ok),
        'bbox_extended_size_xyz': [round(v, 5) for v in (ext_mx - ext_mn)],
        'barrel_outer_d_mm': round(BARREL_R * 2000, 2),
        'barrel_bore_d_mm': round(BORE_R * 2000, 2),
        'wall_thickness_mm': round(WALL * 1000, 2),
        'wall_ok': bool(wall_ok),
        'rod_d_mm': round(ROD_R * 2000, 2),
        'rod_exposed_mm': round(exposed * 1000, 2),
        'rod_exposed_ok': bool(exposed > 0.015),
        'port_count': 2,
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim_loc],
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
    scene.view_settings.exposure = 0.02
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
    bg.inputs['Color'].default_value = (0.700, 0.694, 0.684, 1.0)
    bg.inputs['Strength'].default_value = 0.40

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5
    span = max((mx - mn).x, 0.22)

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
            ('key', (0.30, -0.26, 0.34), 2.30, 0.26),
            ('fill', (-0.40, -0.24, 0.20), 0.70, 0.40),
            ('rim', (0.02, 0.34, 0.30), 1.20, 0.26)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) * (span / 0.22) + Vector((center.x, center.y,
                                                           center.z * 0.55))
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
    close_t = Vector((0.0700, -0.0040, Z0 + 0.0040))
    c_close = box_corners(Vector((0.0150, -0.0420, 0.0080)) - close_t,
                          Vector((0.1130, 0.0330, 0.0900)) - close_t)

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

    close_objs = [o for o in mesh_objs if mesh_bbox([o])[1].x > 0.030]

    views = [
        ('3q', (0.78, -0.80, 0.58), center + Vector((0, 0, 0.006)), 70, c_main,
         0.92, None),
        ('front', (1.00, -0.12, 0.18), center + Vector((0.004, 0, 0.004)), 70,
         c_main, 0.88, None),
        ('side', (0.03, -1.00, 0.20), center + Vector((0, 0, 0.004)), 70, c_main,
         0.92, None),
        ('closeup', (0.62, -0.72, 0.40), close_t, 85, c_close, 0.94, close_objs),
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

    # миниатюра 300 px по короткой стороне — проверка читаемости
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
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000 and rep['no_floating_ok']
            and rep['static_frozen_ok'] and rep['slide_rigid_ok']
            and rep['rod_exposed_ok'] and rep['wall_ok']):
        raise SystemExit('checks failed')


main()
