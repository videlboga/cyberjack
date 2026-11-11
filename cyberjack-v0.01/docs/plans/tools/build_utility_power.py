"""Standalone builder: utility_power (UTL-PWR-01, «Питание»).

Вводной щит питания: графитовый корпус на стену/техшкаф с козырьком,
дверца с окном, внутри DIN-рейка с вводным 3P-рубильником, УЗО с кнопкой
TEST и четырьмя автоматами, клеммники с шиной, жёлтые метки линий,
на двери справа — разъёмы 380 В (5P, красный) и 230 В (синий), слева-снизу
гермоввод с вводным кабелем, крепёжные ушки с болтами.

Плиты-основания нет. Вращения нет (motion: none), анимационная пустышка
не нужна.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_utility_power.py

Выход:
  public/models/machine-modules/components/utility_power.glb
  docs/plans/blockout/component-library/utility_power/*.png
  docs/plans/blockout/component-library/utility_power/report.json

Геометрия (Blender Z-up, метры):
  габарит по паспорту 0,30 x 0,20 x 0,15 м
    X: -0.150 .. +0.150  (ширина)
    Y: -0.100 .. +0.100  (глубина, перед = -Y)
    Z:  0.000 .. 0.150   (высота, низ = 0)
  корпус 0.010..0.144, козырёк 0.144..0.150, кабель/ушки до z=0
  бэкбокс (кабельная ниша) +0.020..+0.100, передняя часть -0.080..+0.024
  дверца y -0.088..-0.080, окно x -0.140..0.024, z 0.040..0.128
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/utility_power'
CID = 'utility_power'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- габарит / ключевые размеры (м) -------------------------------------
BX = 0.150                      # полуширина корпуса
BY_F, BY_B = -0.080, 0.100      # передняя часть: лицо / тыл
BZ0, BZ1 = 0.010, 0.150         # низ / верх корпуса
Y_FRONT_EXTREME = -0.100        # лицевая плоскость разъёмов / козырька
DOOR_Y0, DOOR_Y1 = -0.088, -0.080

AP_X0, AP_X1 = -0.140, 0.024    # окно дверцы
AP_Z0, AP_Z1 = 0.040, 0.124
DOOR_Z0, DOOR_Z1 = 0.016, 0.136
STILE_R = 0.030                 # правая стойка дверцы (колонка разъёмов)

# DIN-рейка и аппараты
RAIL_Z = 0.084
BR_Z0, BR_Z1 = 0.070, 0.122
BR_Y0, BR_Y1 = -0.066, -0.030
MW, MGAP = 0.0176, 0.0009       # модуль 17,6 мм + зазор
APP_X0 = -0.1385
TERM_Z0, TERM_Z1 = 0.0400, 0.0506
BUS_Z0, BUS_Z1 = 0.0530, 0.0568

PALETTE = {
    'graphite': (0.106, 0.112, 0.122),   # корпус, дверца, козырёк
    'dark': (0.028, 0.031, 0.036),       # рычаги, кабель, надписи-плашки
    'steel': (0.560, 0.575, 0.580),      # шины, клеммы, крепёж, рейка
    'ivory': (0.905, 0.895, 0.868),      # корпуса автоматов, клеммники
    'yellow': (0.840, 0.610, 0.030),     # метки линий, TEST, предупреждение
    'red': (0.600, 0.048, 0.038),        # 380 В разъём, вводной рычаг
    'blue': (0.048, 0.185, 0.400),       # 230 В разъём
}
MATS = {}
FONT = None


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
    bsdf.inputs['Roughness'].default_value = {
        'graphite': 0.48, 'dark': 0.58, 'steel': 0.38,
        'ivory': 0.52, 'yellow': 0.44, 'red': 0.42, 'blue': 0.42,
    }[role]
    bsdf.inputs['Metallic'].default_value = 0.85 if role == 'steel' else (
        0.35 if role == 'graphite' else 0.0)
    m.diffuse_color = (*color, 1.0)
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


def bevel(obj, width=0.0015, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40) if angle else math.radians(179)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), seg=2, sharp=35.0):
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


def torus(name, loc, major, minor, role, axis='Z', segs=48, rings=10):
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


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0), extrude=0.0004):
    global FONT
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    cu.resolution_u = 5
    if FONT_PATH.is_file():
        if FONT is None:
            FONT = bpy.data.fonts.load(str(FONT_PATH))
        cu.font = FONT
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = rot
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
    return shade(obj, 25.0)


def prism_xz(name, pts, y0, y1, role, sharp=30.0):
    """Призма по контуру в плоскости XZ, вытянутая по Y."""
    bm = bmesh.new()
    front = [bm.verts.new((x, y0, z)) for x, z in pts]
    back = [bm.verts.new((x, y1, z)) for x, z in pts]
    bm.faces.new(front)
    bm.faces.new(tuple(reversed(back)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((front[i], front[j], back[j], back[i]))
    return mesh_from_bm(name, bm, role, sharp)



def prism_yz(name, pts, x0, x1, role, sharp=30.0):
    """Призма по контуру в плоскости YZ, вытянутая по X."""
    bm = bmesh.new()
    left = [bm.verts.new((x0, y, z)) for y, z in pts]
    right = [bm.verts.new((x1, y, z)) for y, z in pts]
    bm.faces.new(left)
    bm.faces.new(tuple(reversed(right)))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((left[i], left[j], right[j], right[i]))
    return mesh_from_bm(name, bm, role, sharp)

# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ================= корпус =================
    body = add(box(PREFIX + 'body', -BX, BX, BY_F, 0.024, BZ0, BZ1, 'graphite',
                   r=0.011, seg=3))
    # ниша под аппараты: вырез окна в лицевой стенке
    bpy.ops.mesh.primitive_cube_add(
        size=1, location=((AP_X0 + AP_X1) * 0.5, (BY_F - 0.020) * 0.5,
                          (AP_Z0 + AP_Z1) * 0.5))
    cutter = bpy.context.object
    cutter.scale = (AP_X1 - AP_X0, 0.0600, AP_Z1 - AP_Z0)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = body.modifiers.new('win', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    select_only(body)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)
    shade(body, 35.0)

    # задняя кабельная ниша (на 4 мм уже корпуса -> виден шов)
    add(box(PREFIX + 'body_rear', -BX + 0.004, BX - 0.004, 0.020, BY_B,
            BZ0, BZ1, 'graphite', r=0.008, seg=3))

    # прорези задней ниши (крупнее, по бокам)
    bm = bmesh.new()
    for sx in (-1, 1):
        for i in range(6):
            bm_box(bm, (sx * (BX - 0.0042), 0.0410 + i * 0.0092, 0.0860),
                   (0.0016, 0.0052, 0.0400))
    add(mesh_from_bm(PREFIX + 'rear_vents', bm, 'dark', 30.0))

    # шильдик на боку корпуса (обе стороны): IP54 / 0,4 кВ
    for side, rx in (('r', math.pi / 2), ('l', -math.pi / 2)):
        sx = 1.0 if side == 'r' else -1.0
        x_in, x_out = sorted((sx * 0.1480, sx * 0.1494))
        add(box(PREFIX + f'side_plate_{side}', x_in, x_out, -0.0640, -0.0220,
                0.0580, 0.1080, 'dark', r=0.0008))
        add(text(PREFIX + f'side_plate_text_{side}', 'IP54', 0.0064,
                 (sx * 0.1494, -0.0570, 0.0962), 'yellow',
                 rot=(math.pi / 2, 0, rx)))
        add(text(PREFIX + f'side_plate_text2_{side}', '0,4 кВ', 0.0048,
                 (sx * 0.1494, -0.0570, 0.0800), 'ivory',
                 rot=(math.pi / 2, 0, rx)))

    # крепление на стену: задняя плита-фланец + болты по углам
    add(box(PREFIX + 'wall_plate', -0.1400, 0.1400, 0.0930, BY_B, 0.0120,
            0.1330, 'graphite', r=0.0020))
    bm = bmesh.new()
    for sx in (-1, 1):
        for sz in (-1, 1):
            bm_cyl(bm, (sx * 0.1250, BY_B - 0.0002, 0.0725 + sz * 0.0470),
                   (sx * 0.1250, BY_B - 0.0034, 0.0725 + sz * 0.0470),
                   0.0054, segs=6)
    add(mesh_from_bm(PREFIX + 'back_bolts', bm, 'steel', 40.0))

    # ================= дверца с окном =================
    add(box(PREFIX + 'door_top', -0.146, STILE_R, DOOR_Y0, DOOR_Y1, AP_Z1,
            DOOR_Z1, 'graphite', r=0.0016))
    add(box(PREFIX + 'door_bottom', -0.146, STILE_R, DOOR_Y0, DOOR_Y1,
            DOOR_Z0, AP_Z0, 'graphite', r=0.0016))
    add(box(PREFIX + 'door_stile_l', -0.146, AP_X0, DOOR_Y0, DOOR_Y1, AP_Z0,
            AP_Z1, 'graphite', r=0.0014))
    add(box(PREFIX + 'door_stile_m', AP_X1, STILE_R, DOOR_Y0, DOOR_Y1, AP_Z0,
            AP_Z1, 'graphite', r=0.0014))
    add(box(PREFIX + 'door_panel_r', STILE_R, 0.146, DOOR_Y0, DOOR_Y1,
            DOOR_Z0, DOOR_Z1, 'graphite', r=0.0022, seg=3))

    # петли слева (петля + планка на дверце)
    bm = bmesh.new()
    bm_k = bmesh.new()
    for z in (0.0500, 0.1080):
        bm_cyl(bm, (-0.1434, -0.0842, z - 0.0130), (-0.1434, -0.0842, z + 0.0130),
               0.0062, segs=18)
        bm_box(bm, (-0.1408, -0.0892, z), (0.0116, 0.0030, 0.0250))
        bm_cyl(bm_k, (-0.1434, -0.0842, z - 0.0160), (-0.1434, -0.0842, z - 0.0130),
               0.0034, segs=12)
        bm_cyl(bm_k, (-0.1434, -0.0842, z + 0.0130), (-0.1434, -0.0842, z + 0.0160),
               0.0034, segs=12)
    add(mesh_from_bm(PREFIX + 'door_hinges', bm, 'steel', 40.0))
    add(mesh_from_bm(PREFIX + 'door_hinge_pins', bm_k, 'graphite', 40.0))

    # замок-защёлка справа: корпус, головка, Т-ручка, скважина
    add(cyl(PREFIX + 'lock_body', (0.1368, DOOR_Y0, 0.0780),
            (0.1368, -0.0954, 0.0780), 0.0092, 'graphite', vertices=28,
            bev=0.0012))
    add(cyl(PREFIX + 'lock_knob', (0.1368, -0.0954, 0.0780),
            (0.1368, -0.0990, 0.0780), 0.0058, 'steel', vertices=20,
            bev=0.0008))
    add(box(PREFIX + 'lock_handle', 0.1334, 0.1402, -0.0994, -0.0982, 0.0490,
            0.0790, 'steel', r=0.0010))
    add(cyl(PREFIX + 'lock_keyhole', (0.1368, -0.0990, 0.0780),
            (0.1368, -0.0997, 0.0780), 0.0020, 'dark', vertices=12))

    # ================= маркировка на дверце =================
    add(box(PREFIX + 'label_lines', -0.1420, 0.0220, -0.0894, DOOR_Y0, 0.1268,
            0.1340, 'yellow', r=0.0008))
    add(text(PREFIX + 'label_lines_text', 'L1  L2  L3  N  PE', 0.0048,
             (-0.0600, -0.0899, 0.1304), 'dark'))

    add(box(PREFIX + 'label_name_plate', -0.1380, -0.0570, -0.0895, DOOR_Y0,
            0.0198, 0.0362, 'dark', r=0.0010))
    add(text(PREFIX + 'label_name_text', 'ЩИТ ВВОДНОЙ', 0.0062,
             (-0.0975, -0.0900, 0.0280), 'ivory'))
    add(box(PREFIX + 'label_volt', -0.0500, 0.0220, -0.0895, DOOR_Y0, 0.0208,
            0.0352, 'yellow', r=0.0008))
    add(text(PREFIX + 'label_volt_text', '380/230 В', 0.0052,
             (-0.0140, -0.0900, 0.0280), 'dark'))

    # знак электробезопасности
    tri_s = 0.0135
    tcx, tcz = 0.0458, 0.0272
    tri = [(tcx, tcz + tri_s * 0.66),
           (tcx - tri_s * 0.62, tcz - tri_s * 0.42),
           (tcx + tri_s * 0.62, tcz - tri_s * 0.42)]
    add(prism_xz(PREFIX + 'label_warning', tri, -0.0892, DOOR_Y0, 'yellow',
                 sharp=20.0))
    bolt = [(0.0018, 0.0052), (-0.0042, -0.0004), (-0.0006, -0.0004),
            (-0.0022, -0.0056), (0.0044, 0.0006), (0.0009, 0.0006)]
    add(prism_xz(PREFIX + 'label_warning_bolt',
                 [(tcx + x, tcz + z) for x, z in bolt], -0.0899, -0.0890,
                 'dark', sharp=20.0))

    # ================= разъёмы 230/380 В =================
    def socket(tag, cx, cz, r_fl, r_co, r_lid, y_tip, role, label):
        add(cyl(PREFIX + f'socket_{tag}_flange', (cx, DOOR_Y0, cz),
                (cx, DOOR_Y0 - 0.0032, cz), r_fl, role, vertices=40,
                bev=0.0010))
        add(cyl(PREFIX + f'socket_{tag}_collar', (cx, DOOR_Y0 - 0.0032, cz),
                (cx, DOOR_Y0 - 0.0076, cz), r_co, role, vertices=36,
                bev=0.0010))
        add(cyl(PREFIX + f'socket_{tag}_lid', (cx, DOOR_Y0 - 0.0076, cz),
                (cx, y_tip, cz), r_lid, role, vertices=36, r2=r_lid * 0.80,
                sharp=45.0))
        add(torus(PREFIX + f'socket_{tag}_ring', (cx, DOOR_Y0 - 0.0076, cz),
                  r_lid + 0.0011, 0.0009, 'dark', axis='Y', segs=36, rings=6))
        add(box(PREFIX + f'socket_{tag}_tab', cx - 0.0035, cx + 0.0035,
                y_tip + 0.0004, y_tip + 0.0030, cz - r_lid - 0.0028,
                cz - r_lid + 0.0014, role, r=0.0006))
        bm = bmesh.new()
        for i in range(4):
            a = math.radians(45.0 + 90.0 * i)
            px = cx + (r_fl - 0.0040) * math.cos(a)
            pz = cz + (r_fl - 0.0040) * math.sin(a)
            bm_cyl(bm, (px, DOOR_Y0, pz), (px, DOOR_Y0 - 0.0022, pz),
                   0.0017, segs=10)
        add(mesh_from_bm(PREFIX + f'socket_{tag}_screws', bm, 'steel', 40.0))
        lx = 0.0392
        add(box(PREFIX + f'socket_{tag}_tag', lx - 0.0082, lx + 0.0082,
                -0.0896, DOOR_Y0, cz - 0.0044, cz + 0.0044, 'yellow',
                r=0.0006))
        add(text(PREFIX + f'socket_{tag}_tag_text', label, 0.0042,
                 (lx, -0.0901, cz), 'dark'))

    socket('380', 0.0880, 0.0985, 0.0285, 0.0206, 0.0180, Y_FRONT_EXTREME,
           'red', '380')
    socket('230', 0.0880, 0.0452, 0.0232, 0.0168, 0.0146, -0.0986,
           'blue', '230')
    add(box(PREFIX + 'socket_divider', STILE_R + 0.002, 0.1430, -0.0892,
            DOOR_Y0, 0.0682, 0.0724, 'yellow', r=0.0006))

    # ================= внутреннее наполнение =================
    add(box(PREFIX + 'back_panel', AP_X0, AP_X1, -0.0198, -0.0172, AP_Z0,
            AP_Z1, 'dark', r=0.0010))

    bm = bmesh.new()
    for x in (-0.1280, 0.0160):
        bm_cyl(bm, (x, -0.0172, RAIL_Z), (x, -0.0300, RAIL_Z), 0.0042, segs=14)
    add(mesh_from_bm(PREFIX + 'rail_standoffs', bm, 'steel', 40.0))
    add(box(PREFIX + 'din_rail', -0.1400, 0.0260, -0.0300, -0.0250, 0.0800,
            0.0880, 'steel', r=0.0006))
    add(box(PREFIX + 'din_rail_web', -0.1400, 0.0260, -0.0350, -0.0300, 0.0816,
            0.0864, 'steel', r=0.0004))
    add(box(PREFIX + 'din_rail_back', -0.1400, 0.0260, -0.0392, -0.0350, 0.0780,
            0.0900, 'steel', r=0.0006))

    # ---- аппараты на рейке ------------------------------------------------
    layout = [('main', 3), ('rcd', 2), ('mcb1', 1), ('mcb2', 1),
              ('mcb3', 1), ('mcb4', 1)]
    x = APP_X0
    for tag, nmod in layout:
        x1 = x + nmod * MW + (nmod - 1) * MGAP
        cx = (x + x1) * 0.5
        w = x1 - x
        body_role = 'graphite' if tag == 'main' else 'ivory'
        add(box(PREFIX + f'app_{tag}_body', x, x1, BR_Y0, BR_Y1, BR_Z0, BR_Z1,
                body_role, r=0.0014))
        add(box(PREFIX + f'app_{tag}_flag', x + 0.0028, x1 - 0.0028,
                BR_Y0 - 0.0008, BR_Y0 - 0.0001, 0.0902, 0.0958,
                'dark', r=0.0004))
        lever_role = 'red' if tag == 'main' else 'dark'
        tilt = math.radians(-16.0 if tag in ('main', 'rcd', 'mcb2') else 14.0)
        add(cube(PREFIX + f'app_{tag}_lever',
                 (cx, BR_Y0 - 0.0052, 0.1068), (min(w - 0.0060, 0.0118),
                  0.0082, 0.0160), lever_role, r=0.0011, rot=(tilt, 0, 0)))
        add(box(PREFIX + f'app_{tag}_tag', x + 0.0020, x1 - 0.0020,
                BR_Y0 - 0.0007, BR_Y0 - 0.0001, 0.0788, 0.0844,
                'yellow', r=0.0004))
        bm = bmesh.new()
        for z in (0.0754, 0.1166):
            bm_cyl(bm, (cx, BR_Y0, z), (cx, BR_Y0 - 0.0022, z), 0.0030,
                   segs=12)
        add(mesh_from_bm(PREFIX + f'app_{tag}_screws', bm, 'steel', 40.0))
        x = x1 + MGAP

    add(cyl(PREFIX + 'app_rcd_test', (-0.0778, BR_Y0, 0.0862),
            (-0.0778, BR_Y0 - 0.0040, 0.0862), 0.0038, 'yellow', vertices=18,
            bev=0.0008))
    add(torus(PREFIX + 'app_rcd_test_ring', (-0.0778, BR_Y0 - 0.0009, 0.0862),
              0.0046, 0.0007, 'dark', axis='Y', segs=18, rings=6))
    add(text(PREFIX + 'app_rcd_test_text', 'TEST', 0.0030,
             (-0.0690, BR_Y0 - 0.0001, 0.0862), 'dark'))
    add(text(PREFIX + 'app_main_text', 'ВВОД', 0.0040,
             (-0.1112, BR_Y0 - 0.0001, 0.0862), 'ivory'))

    # ---- клеммники, шина, провода ---------------------------------------
    add(box(PREFIX + 'terminal_block', -0.1360, 0.0240, -0.0560, -0.0262,
            TERM_Z0, TERM_Z1, 'ivory', r=0.0016))
    bm = bmesh.new()
    bm_s = bmesh.new()
    for i in range(7):
        tx = -0.1360 + i * (0.1600 / 6.0)
        if i < 6:
            bm_box(bm, (tx + 0.0133, -0.0572, 0.0453), (0.0012, 0.0024, 0.0106))
    add(mesh_from_bm(PREFIX + 'terminal_dividers', bm, 'graphite', 30.0))
    for i in range(6):
        tx = -0.1290 + i * 0.0274
        bm_cyl(bm_s, (tx, -0.0560, 0.0452), (tx, -0.0586, 0.0452), 0.0032,
               segs=6)
    add(mesh_from_bm(PREFIX + 'terminal_screws', bm_s, 'steel', 40.0))

    # шина-гребёнка перед клеммником (видна в окне)
    bm = bmesh.new()
    bm_box(bm, (-0.0540, -0.0590, (BUS_Z0 + BUS_Z1) * 0.5),
           (0.1580, 0.0062, BUS_Z1 - BUS_Z0))
    for i in range(6):
        bm_box(bm, (-0.1290 + i * 0.0274, -0.0590, BUS_Z1 + 0.0016),
               (0.0086, 0.0062, 0.0032))
    add(mesh_from_bm(PREFIX + 'busbar', bm, 'steel', 40.0))
    bm = bmesh.new()
    for tx in (-0.1290, -0.0468, 0.0072):
        bm_cyl(bm, (tx, -0.0262, BUS_Z0 + 0.0010), (tx, -0.0560, BUS_Z0 + 0.0010),
               0.0018, segs=10)
    add(mesh_from_bm(PREFIX + 'busbar_posts', bm, 'steel', 40.0))

    # провода от автоматов на шину
    for i, tx in enumerate((-0.1290 + i * 0.0274 for i in range(6))):
        role = ('red', 'dark', 'dark', 'blue', 'dark', 'dark')[i]
        add(curve_tube(PREFIX + f'wire_{i}',
                       [(tx + 0.0016, BR_Y0 - 0.0032, 0.0702),
                        (tx + 0.0034, -0.0560, 0.0632),
                        (tx + 0.0018, -0.0582, 0.0580),
                        (tx, -0.0562, 0.0562)], 0.0017, role))

    # ================= гермоввод и вводной кабель =================
    gx, gy = -0.1050, 0.0560
    add(cyl(PREFIX + 'gland_body', (gx, gy, BZ0 + 0.0036), (gx, gy, 0.0022),
            0.0090, 'graphite', vertices=24, bev=0.0010))
    add(cyl(PREFIX + 'gland_nut', (gx, gy, 0.0022), (gx, gy, 0.0002), 0.0102,
            'steel', vertices=6))
    add(cyl(PREFIX + 'gland_seal', (gx, gy, 0.0006), (gx, gy, 0.0000), 0.0074,
            'dark', vertices=20))
    add(curve_tube(PREFIX + 'cable', [
        (gx, gy, 0.0036),
        (gx + 0.0010, gy + 0.0110, 0.0036),
        (gx + 0.0040, gy + 0.0220, 0.0034),
        (gx + 0.0090, gy + 0.0300, 0.0034),
        (gx + 0.0150, gy + 0.0340, 0.0034),
    ], 0.0034, 'dark'))
    add(box(PREFIX + 'cable_clip', gx - 0.0060, gx + 0.0060,
            gy + 0.0090, gy + 0.0150, 0.0004, 0.0074, 'graphite', r=0.0010))

    # ---- extras / имена ------------------------------------------------
    for o in parts:
        o['component'] = CID
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').split('_')[0]

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


def check(parts):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    tol = 0.004
    passport = (0.30, 0.20, 0.15)
    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(passport),
        'bbox_ok': bool(all(abs(size[i] - passport[i]) <= tol for i in range(3))),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
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
    bg.inputs['Strength'].default_value = 0.55

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.620, 0.614, 0.602, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.62, -0.74, 0.66), 13.0, 0.55),
            ('fill', (-0.78, -0.52, 0.36), 6.5, 0.75),
            ('rim', (0.08, 0.72, 0.58), 9.5, 0.60)):
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
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized()

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
    close_t = Vector((-0.0560, -0.0560, 0.0900))
    c_close = box_corners(Vector((-0.1420, -0.0790, 0.0520)) - close_t,
                          Vector((0.0280, -0.0290, 0.1260)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(objs=None):
        worst = 0.0
        for o in (objs if objs is not None else mesh_objs):
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    keys = ('app_', 'terminal', 'busbar', 'din_rail', 'back_panel', 'wire_',
            'label_lines', 'door_top')
    near_close = [o for o in mesh_objs if any(k in o.name for k in keys)]

    views = [
        ('3q', (0.62, -1.00, 0.24), center + Vector((0, 0, 0.004)), 72, c_main,
         0.90, mesh_objs),
        ('front', (0.0, -1.0, 0.05), center, 72, c_main, 0.92, mesh_objs),
        ('side', (-1.0, -0.46, 0.05), center + Vector((0, 0, 0.004)), 72, c_main,
         0.90, mesh_objs),
        ('closeup', (0.34, -0.94, 0.20), close_t, 85, c_close, 0.96, near_close),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, objs in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4):
            got = max_ndc(objs)
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
        print(f'RENDERED {tag} fill={max_ndc(objs):.3f} {fp}', flush=True)
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
    if not (rep['bbox_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
