"""Standalone builder: motion_piston_telescopic (MOT-PIS-04, «Телескопический поршень»).

Трёхступенчатый телескопический гидроцилиндр: квадратный задний фланец,
графитовый корпус с задней опорной лапой, два порта (давление +Y, слив -Y),
передняя головка с направляющей втулкой и сальником (wiper), защитный
гофрированный чехол на входе, три вложенные ступени 0.045 / 0.036 / 0.028
с тонкими буртиками-упорами, уплотнениями и направляющими кольцами,
полированный шток и вилка с пальцем. Плиты-основания нет.

Не зависит от build_component_library.py / build_motion_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \\
      --python docs/plans/tools/build_motion_piston_telescopic.py

Выход:
  public/models/machine-modules/components/motion_piston_telescopic.glb
  docs/plans/blockout/component-library/motion_piston_telescopic/*.png
  docs/plans/blockout/component-library/motion_piston_telescopic/report.json

Геометрия (Blender Z-up, метры):
  ось привода     = X, z = AXIS_Z (0.058); Blender X -> glTF X (export_yup)
  габарит         = 0.400 (X) x 0.120 (Y) x 0.120 (Z)
  анимация        = сдвиг пустышки motion_piston_telescopic__anim по X, 0..0.12
  двигается       = ступени 1..3 с буртиками/уплотнениями/кольцами, шток,
                    вилка с пальцем, защитный чехол
  статично        = фланец с болтами, лапа, корпус, порты, головка с болтами,
                    направляющая втулка, сальник, датчики с LED, кабель, шильдик
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_piston_telescopic'
CID = 'motion_piston_telescopic'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
X_MIN, X_MAX = -0.200, 0.200        # габарит по паспорту 0,40
AXIS_Z = 0.058                     # высота оси
R_BODY = 0.056                     # корпус Ø0,112
TRAVEL = 0.12                      # ход по паспорту
ANIM_SPEED = 0.65

FLANGE_X0, FLANGE_X1 = -0.200, -0.192
FLANGE_HALF = 0.0575               # квадратный фланец 0,115 x 0,115
BODY_X0, BODY_X1 = -0.192, 0.004
HEAD_X0 = 0.004                    # головка: 0.004..0.020 R0.058, 0.020..0.028 R0.0545
BUSH_X0, BUSH_X1 = 0.028, 0.034

# ступени: наружная -> внутренняя (диаметры читаются ступенями)
R_S1, R_S2, R_S3, R_ROD = 0.045, 0.036, 0.028, 0.014

TUBE1 = (-0.130, 0.092)            # на полном ходе задний конец в теле головки
TUBE2 = (-0.030, 0.140)
TUBE3 = (0.010, 0.1665)
ROD = (0.040, 0.186)

COL1 = (0.0895, 0.0965)            # тонкий буртик-упор
COL2 = (0.1335, 0.1405)
COL3 = (0.1635, 0.1705)
SEAL1_X, SEAL2_X, SEAL3_X = 0.0975, 0.1415, 0.1715
GR1, GR2, GR3 = (0.0640, 0.0672), (0.1090, 0.1122), (0.1520, 0.1552)
BOOT_X0, BOOT_X1 = 0.036, 0.050
CLEVIS_BODY = (0.184, 0.190)
CLEVIS_CHEEK = (0.190, 0.200)
PIN_X, PIN_R = 0.1950, 0.0038

STAGE_FRACTIONS = (0.34, 0.67, 1.00)   # последовательность выдвижения ступеней

PALETTE = {
    'alu': (0.845, 0.852, 0.856),
    'steel': (0.470, 0.476, 0.472),
    'graphite': (0.232, 0.242, 0.256),
    'dark': (0.108, 0.114, 0.126),
    'blush': (0.900, 0.688, 0.722),
    'ivory': (0.972, 0.964, 0.948),
    'red': (0.665, 0.072, 0.062),
    'cyan': (0.700, 0.895, 0.930),
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
    if role == 'alu':
        bsdf.inputs['Metallic'].default_value = 0.78
        bsdf.inputs['Roughness'].default_value = 0.26
    elif role == 'steel':
        bsdf.inputs['Metallic'].default_value = 0.70
        bsdf.inputs['Roughness'].default_value = 0.38
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.25
        bsdf.inputs['Roughness'].default_value = 0.62
    elif role == 'dark':
        bsdf.inputs['Roughness'].default_value = 0.88
    elif role == 'blush':
        bsdf.inputs['Metallic'].default_value = 0.10
        bsdf.inputs['Roughness'].default_value = 0.54
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.70
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


def join(objs, name, role):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
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
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def bm_cyl(bm, a, b, radius, segments=32):
    """Цилиндр между двумя точками (ось произвольная)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=radius, radius2=radius, depth=d.length,
                          matrix=m)


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def stepped(name, steps, role, seg=48, smooth=True):
    """Ступенчатая втулка/буртик одним узлом: steps = [(x0, x1, r), ...]."""
    bm = bmesh.new()
    for x0, x1, r in steps:
        bm_cyl(bm, (x0, 0.0, AXIS_Z), (x1, 0.0, AXIS_Z), r, seg)
    return mesh_from_bm(name, bm, role, smooth)


def ring_x(name, x0, x1, radius, role, seg=48):
    return stepped(name, [(x0, x1, radius)], role, seg)


def hex_head(name, axis, base, sign, length, radius, role):
    b = Vector(base)
    d = {'X': Vector((sign, 0, 0)), 'Y': Vector((0, sign, 0)),
         'Z': Vector((0, 0, sign))}[axis]
    return cyl(name, b, b + d * length, radius, role, vertices=6, smooth=False)


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


def autosmooth(objs, angle_deg=30.0):
    """Резкие рёбра -> split_edges, полигоны остаются гладкими.

    Надёжнее bpy.ops.object.shade_auto_smooth: не зависит от ассетов
    «Smooth by Angle» и переживает экспорт без модификаторов.
    """
    lim = math.radians(angle_deg)
    for obj in objs:
        if obj.type != 'MESH':
            continue
        me = obj.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bm.normal_update()
        sharp = [e for e in bm.edges
                 if len(e.link_faces) == 2 and e.calc_face_angle(0.0) > lim]
        if sharp:
            bmesh.ops.split_edges(bm, edges=sharp)
        bm.to_mesh(me)
        bm.free()
        for p in me.polygons:
            p.use_smooth = True


# --- сборка --------------------------------------------------------------
def build():
    reset()
    movers = []          # (obj, stage_index)
    Z = AXIS_Z

    # ---------- задний квадратный фланец + угловые болты ----------
    cube(PREFIX + 'rear_flange', ((FLANGE_X0 + FLANGE_X1) * 0.5, 0.0, Z),
         (FLANGE_X1 - FLANGE_X0, 2 * FLANGE_HALF, 2 * FLANGE_HALF),
         'graphite', r=0.0030)
    bm = bmesh.new()
    for sy in (-1, 1):
        for sz in (-1, 1):
            bm_cyl(bm, (FLANGE_X1, sy * 0.0440, Z + sz * 0.0440),
                   (FLANGE_X1 + 0.0060, sy * 0.0440, Z + sz * 0.0440),
                   0.0046, 6)
    mesh_from_bm(PREFIX + 'flange_bolts', bm, 'steel', smooth=False)

    # ---------- задняя опорная лапа ----------
    cube(PREFIX + 'rear_foot', (-0.1600, 0.0, 0.017),
         (0.050, 0.076, 0.034), 'graphite', r=0.0026)
    bm = bmesh.new()
    for sy in (-1, 1):
        bm_cyl(bm, (-0.1355, sy * 0.024, 0.017), (-0.1295, sy * 0.024, 0.017),
               0.0055, 6)
    mesh_from_bm(PREFIX + 'foot_bolts', bm, 'steel', smooth=False)

    # ---------- корпус ----------
    cyl(PREFIX + 'body', (BODY_X0, 0, Z), (BODY_X1, 0, Z), R_BODY,
        'graphite', vertices=64, bev=0.0028)
    ring_x(PREFIX + 'body_band_rear', -0.168, -0.1585, 0.0572, 'dark')
    ring_x(PREFIX + 'body_band_front', -0.028, -0.0185, 0.0572, 'dark')

    # ---------- два порта: давление +Y, слив -Y ----------
    for tag, xc, sy in (('pressure', -0.148, 1), ('tank', -0.098, -1)):
        bm = bmesh.new()
        bm_cyl(bm, (xc, sy * 0.020, Z), (xc, sy * 0.048, Z), 0.0130, 24)
        bm_cyl(bm, (xc, sy * 0.048, Z), (xc, sy * 0.0555, Z), 0.0105, 6)
        bm_cyl(bm, (xc, sy * 0.0555, Z), (xc, sy * 0.0600, Z), 0.0072, 18)
        mesh_from_bm(PREFIX + f'port_{tag}', bm, 'steel', smooth=False)

    # ---------- передняя головка, втулка, сальник ----------
    stepped(PREFIX + 'front_head',
            [(HEAD_X0, 0.020, 0.0580), (0.020, 0.028, 0.0545)], 'steel', seg=56)
    bm = bmesh.new()
    for i in range(8):
        a = math.tau * i / 8 + math.radians(22.5)
        y, z = math.sin(a) * 0.0505, Z + math.cos(a) * 0.0505
        bm_cyl(bm, (0.0200, y, z), (0.0262, y, z), 0.0036, 6)
    mesh_from_bm(PREFIX + 'head_bolts', bm, 'ivory', smooth=False)
    cyl(PREFIX + 'guide_bush', (BUSH_X0, 0, Z), (BUSH_X1, 0, Z), 0.0470,
        'alu', vertices=48, bev=0.0010)
    torus(PREFIX + 'wiper_seal', (0.0348, 0, Z), 0.0464, 0.0030, 'dark', 'X')

    # ---------- датчики концевых положений + LED + шина ----------
    for tag, xc in (('rear', -0.132), ('front', -0.062)):
        cube(PREFIX + f'sensor_{tag}', (xc, 0.0, 0.114),
             (0.020, 0.019, 0.012), 'graphite', r=0.0020)
        cyl(PREFIX + f'led_{tag}', (xc, -0.0095, 0.1140), (xc, -0.0140, 0.1140),
            0.0032, 'cyan', vertices=14)
    curve_tube(PREFIX + 'sensor_bus',
               [(-0.132, 0.0110, 0.1155),
                (-0.150, 0.0140, 0.1122),
                (-0.172, 0.0168, 0.1106),
                (-0.184, 0.0190, 0.1082)], 0.0025, 'dark')
    cube(PREFIX + 'bus_connector', (-0.1875, 0.0200, 0.1068),
         (0.010, 0.010, 0.010), 'graphite', r=0.0016)

    # ---------- шильдик ----------
    cube(PREFIX + 'label_plate', (-0.0580, -(R_BODY - 0.0020), Z),
         (0.046, 0.004, 0.019), 'dark', r=0.0010)
    if FONT_PATH.is_file():
        text_label(PREFIX + 'label_text', 'MOT-PIS-04',
                   (-0.0580, -0.0574, 0.0580), 0.0078, 'ivory')

    # ---------- защитный гофрированный чехол на входе 1-й ступени ----------
    bm = bmesh.new()
    bm_cyl(bm, (BOOT_X0, 0, Z), (BOOT_X1, 0, Z), 0.0463, 40)
    movers.append((mesh_from_bm(PREFIX + 'boot_gaiter', bm, 'dark'), 0))
    ribs = []
    for i in range(3):
        xc = BOOT_X0 + 0.0034 + i * 0.0043
        ribs.append(torus(f'{PREFIX}boot_rib_{i}', (xc, 0, Z), 0.0482, 0.0026,
                          'dark', 'X'))
    for i, xc in ((0, BOOT_X0 + 0.0015), (1, BOOT_X1 - 0.0015)):
        ribs.append(torus(f'{PREFIX}boot_clamp_{i}', (xc, 0, Z), 0.0488, 0.0019,
                          'steel', 'X'))
    movers.append((join(ribs, PREFIX + 'boot_ribs', 'dark'), 0))

    # ---------- ступень 1 ----------
    movers.append((cyl(PREFIX + 'stage_1', (TUBE1[0], 0, Z), (TUBE1[1], 0, Z),
                       R_S1, 'alu', vertices=64), 1))
    movers.append((ring_x(PREFIX + 'guide_ring_1', GR1[0], GR1[1], 0.0462, 'dark'),
                   1))
    bm = bmesh.new()
    for i in range(3):
        xc = 0.0520 + i * 0.0046
        bm_cyl(bm, (xc, 0, Z), (xc + 0.0014, 0, Z), R_S1 + 0.0005, 48)
    movers.append((mesh_from_bm(PREFIX + 'stroke_ticks', bm, 'red'), 1))
    movers.append((ring_x(PREFIX + 'collar_1', COL1[0], COL1[1], 0.0475, 'steel'),
                   1))
    movers.append((torus(PREFIX + 'seal_1', (SEAL1_X, 0, Z), 0.0385, 0.0024,
                         'dark', 'X'), 1))

    # ---------- ступень 2 ----------
    movers.append((cyl(PREFIX + 'stage_2', (TUBE2[0], 0, Z), (TUBE2[1], 0, Z),
                       R_S2, 'alu', vertices=56), 2))
    movers.append((ring_x(PREFIX + 'guide_ring_2', GR2[0], GR2[1], 0.0372, 'dark'),
                   2))
    movers.append((ring_x(PREFIX + 'collar_2', COL2[0], COL2[1], 0.0385, 'steel'),
                   2))
    movers.append((torus(PREFIX + 'seal_2', (SEAL2_X, 0, Z), 0.0305, 0.0022,
                         'dark', 'X'), 2))

    # ---------- ступень 3 ----------
    movers.append((cyl(PREFIX + 'stage_3', (TUBE3[0], 0, Z), (TUBE3[1], 0, Z),
                       R_S3, 'alu', vertices=48), 3))
    movers.append((ring_x(PREFIX + 'guide_ring_3', GR3[0], GR3[1], 0.0292, 'dark'),
                   3))
    movers.append((ring_x(PREFIX + 'collar_3', COL3[0], COL3[1], 0.0305, 'steel'),
                   3))
    movers.append((torus(PREFIX + 'seal_3', (SEAL3_X, 0, Z), 0.0166, 0.0020,
                         'dark', 'X'), 3))

    # ---------- шток и вилка ----------
    movers.append((cyl(PREFIX + 'rod', (ROD[0], 0, Z), (ROD[1], 0, Z), R_ROD,
                       'alu', vertices=32, bev=0.0009), 3))
    movers.append((cube(PREFIX + 'clevis_body',
                        ((CLEVIS_BODY[0] + CLEVIS_BODY[1]) * 0.5, 0.0, Z),
                        (CLEVIS_BODY[1] - CLEVIS_BODY[0], 0.038, 0.038),
                        'blush', r=0.0020), 3))
    for tag, sy in (('l', -1), ('r', 1)):
        movers.append((cube(PREFIX + f'clevis_cheek_{tag}',
                            ((CLEVIS_CHEEK[0] + CLEVIS_CHEEK[1]) * 0.5,
                             sy * 0.0110, Z),
                            (CLEVIS_CHEEK[1] - CLEVIS_CHEEK[0], 0.008, 0.030),
                            'blush', r=0.0010), 3))
    movers.append((cyl(PREFIX + 'clevis_pin', (PIN_X, -0.0180, Z),
                       (PIN_X, 0.0180, Z), PIN_R, 'steel', vertices=18), 3))

    # ---------- привязка к анимационной пустышке ----------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z))
    anim['motion_type'] = 'slide'
    anim['motion_axis'] = 'X'
    anim['motion_amount'] = TRAVEL
    anim['motion_speed'] = ANIM_SPEED
    anim['travel'] = TRAVEL
    anim['stages'] = 3
    anim['stage_extend_fraction'] = ';'.join(f'{f:.2f}' for f in STAGE_FRACTIONS)
    anim['sequence'] = 'outer_to_inner'
    bpy.context.view_layer.update()
    mover_names = set()
    for obj, idx in movers:
        parent(obj, anim)
        obj['moving'] = True
        obj['stage_index'] = idx
        if idx:
            obj['extend_fraction'] = STAGE_FRACTIONS[idx - 1]
        mover_names.add(obj.name)
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o.name not in mover_names:
            o['moving'] = False
            o['stage_index'] = 0

    autosmooth([o for o in bpy.data.objects if o.type == 'MESH'])
    bpy.context.view_layer.update()
    return anim, [m for m, _ in movers]


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

    passport = (0.400, 0.120, 0.120)
    got = tuple(round(v, 5) for v in size)
    bbox_ok = all(abs(g - p) <= 0.004 for g, p in zip(got, passport))

    kids = [o for o in anim.children if o.type == 'MESH']
    kid_names = {o.name for o in kids}
    statics = sorted(o.name for o in meshes if o.name not in kid_names)

    # --- тест хода: едет вся ступенчатая группа, статика заморожена ---
    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    anim.location = Vector((anim.location.x + TRAVEL, anim.location.y,
                            anim.location.z))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}
    move_err = max((after[n] - before[n] - Vector((TRAVEL, 0, 0))).length
                   for n in kid_names)
    static_err = max(((after[n] - before[n]).length for n in before
                      if n not in kid_names), default=0.0)
    ext_mn, ext_mx = mesh_bbox(meshes)

    anim.location = Vector((anim.location.x - TRAVEL, anim.location.y,
                            anim.location.z))
    bpy.context.view_layer.update()
    restored = {o.name: o.matrix_world.translation.copy() for o in meshes}
    pivot_shift = max((restored[n] - before[n]).length for n in before)

    anim_loc = anim.location.copy()
    # location хранится во float32 -> допуск 1 мкм
    axis_ok = (abs(anim_loc.x) < 1e-6 and abs(anim_loc.y) < 1e-6
               and abs(anim_loc.z - AXIS_Z) < 1e-6)

    # --- «не висит в воздухе» ---
    boxes = {o.name: mesh_bbox([o]) for o in meshes}
    floating = []
    for name, (a, b) in boxes.items():
        if not any(other != name and box_gap(a, b, *boxes[other]) <= 0.0016
                   for other in boxes):
            floating.append(name)

    # --- читаемость: вложенные ступени с убывающим диаметром ---
    stage_radii = []
    for nm in ('stage_1', 'stage_2', 'stage_3', 'rod'):
        o = bpy.data.objects.get(PREFIX + nm)
        r = max(o.dimensions.y, o.dimensions.z) * 0.5
        stage_radii.append((nm, round(r, 4)))
    nested_ok = all(stage_radii[i][1] > stage_radii[i + 1][1]
                    for i in range(len(stage_radii) - 1))

    exposed = {
        'stage_1': round(COL1[0] - BOOT_X1, 4),
        'stage_2': round(COL2[0] - SEAL1_X, 4),
        'stage_3': round(COL3[0] - SEAL2_X, 4),
        'rod': round(CLEVIS_BODY[0] - SEAL3_X, 4),
    }
    exposed_ok = all(v >= 0.0085 for v in exposed.values())

    report = {
        'component': CID,
        'code': 'MOT-PIS-04',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_xyz': [round(v, 5) for v in size],
        'bbox_passport_m': list(passport),
        'bbox_ok': bool(bbox_ok),
        'bbox_extended_size_xyz': [round(v, 5) for v in (ext_mx - ext_mn)],
        'floor_contact_z': round(mn.z, 6),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim_loc],
        'anim_axis_ok': bool(axis_ok),
        'anim_type': anim.get('motion_type'),
        'anim_axis': anim.get('motion_axis'),
        'anim_amount_m': anim.get('motion_amount'),
        'anim_speed_rad_s': anim.get('motion_speed'),
        'anim_children': sorted(kid_names),
        'anim_children_count': len(kids),
        'static_parts': statics,
        'static_count': len(statics),
        'slide_delta_m': TRAVEL,
        'mover_error_m': round(move_err, 9),
        'static_error_m': round(static_err, 9),
        'slide_rigid_ok': bool(move_err < 1e-6),
        'static_frozen_ok': bool(static_err < 1e-9),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_ok': bool(pivot_shift < 1e-6 and axis_ok),
        'stage_radii_m': dict(stage_radii),
        'nested_ok': bool(nested_ok),
        'exposed_tube_m': exposed,
        'exposed_ok': bool(exposed_ok),
        'stage_fractions': list(STAGE_FRACTIONS),
        'floating_parts': sorted(floating),
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
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        pass
    scene.view_settings.exposure = 0.10
    try:
        scene.eevee.taa_render_samples = 128
        scene.eevee.shadow_ray_count = 4
        scene.eevee.shadow_step_count = 8
        scene.eevee.use_shadow_high_bitdepth = True
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.690, 0.686, 0.678, 1.0)
    bg.inputs['Strength'].default_value = 0.40

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=9,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.505, 0.500, 0.492, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.44, -0.50, 0.60), 3.30, 0.46),
            ('fill', (-0.56, -0.42, 0.34), 0.75, 0.80),
            ('rim', (0.05, 0.54, 0.50), 2.10, 0.50)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.6))
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
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(mn - center, mx - center)
    close_t = Vector((0.106, 0.0, AXIS_Z))
    c_close = box_corners(Vector((0.010, -0.062, 0.004)) - close_t,
                          Vector((0.205, 0.062, 0.120)) - close_t)

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

    close_objs = [o for o in mesh_objs if mesh_bbox([o])[1].x > 0.026]

    views = [
        ('3q', (0.78, -0.76, 0.60), center + Vector((0, 0, 0.008)), 72,
         c_main, 0.92, None),
        ('front', (1.00, -0.16, 0.20), center + Vector((0.004, 0, 0.006)), 72,
         c_main, 0.90, None),
        ('side', (0.03, -1.00, 0.18), center + Vector((0, 0, 0.005)), 72,
         c_main, 0.92, None),
        ('closeup', (0.50, -0.82, 0.36), close_t, 92, c_close, 0.95, close_objs),
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


# --- проверка уже экспортированного GLB ----------------------------------
def verify_glb(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    anim = bpy.data.objects.get(PREFIX + 'anim')
    if anim is None:
        raise RuntimeError('anim node lost in export')
    kids = [o for o in anim.children if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn

    before = {o.name: o.matrix_world.translation.copy() for o in meshes}
    anim.location = Vector((anim.location.x + TRAVEL, anim.location.y,
                            anim.location.z))
    bpy.context.view_layer.update()
    after = {o.name: o.matrix_world.translation.copy() for o in meshes}
    kid_names = {o.name for o in kids}
    move_err = max((after[n] - before[n] - Vector((TRAVEL, 0, 0))).length
                   for n in kid_names)
    static_err = max(((after[n] - before[n]).length for n in before
                      if n not in kid_names), default=0.0)

    return {
        'glb_nodes': len(objs),
        'glb_meshes': len(meshes),
        'glb_materials': sorted(m.name for m in bpy.data.materials
                                if m.name.startswith('CJ_')),
        'glb_bbox_size_xyz': [round(v, 5) for v in size],
        'glb_anim_children': len(kids),
        'glb_anim_extras': {k: anim[k] for k in anim.keys()
                            if k in ('motion_type', 'motion_axis',
                                     'motion_amount', 'motion_speed',
                                     'stage_extend_fraction', 'sequence')},
        'glb_slide_error_m': round(move_err, 9),
        'glb_static_error_m': round(static_err, 9),
        'glb_roundtrip_ok': bool(move_err < 1e-6 and static_err < 1e-9
                                 and abs(size.x - 0.400) < 0.004
                                 and abs(size.y - 0.120) < 0.004
                                 and abs(size.z - 0.120) < 0.004),
    }


def main():
    anim, movers = build()
    rep = check(anim, movers)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    rep['glb_verify'] = verify_glb(path)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    v = rep['glb_verify']
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['slide_rigid_ok']
            and rep['static_frozen_ok'] and rep['material_count'] >= 4
            and rep['nested_ok'] and rep['exposed_ok']
            and rep['glb_bytes'] > 10000 and v['glb_roundtrip_ok']):
        raise SystemExit('checks failed')


main()
