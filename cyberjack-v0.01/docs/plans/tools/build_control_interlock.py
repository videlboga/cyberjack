"""Standalone builder: control_interlock (CTL-INT-04, «Блокировки»).

Промышленный блок логики безопасности: графитовый корпус на DIN-рейке TS35
с пружинным зажимом, молочная лицевая панель, 16 винтовых клемм в один ряд с
нумерацией каналов и цветовой кодировкой A/B, два реле в молочных кассетах с
прижимными скобами, статусная панель из красных/циановых LED, красная кнопка
сброса, ключ-переключатель AUTO/OFF на верхней панели, RJ45 Ethernet, кабельный
ввод с кабелем, боковая маркировка. Плиты-основания нет.

Не зависит от build_component_library.py / build_work_*.py / build_control_estop.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_control_interlock.py

Выход:
  public/models/machine-modules/components/control_interlock.glb
  docs/plans/blockout/component-library/control_interlock/*.png
  docs/plans/blockout/component-library/control_interlock/report.json

Геометрия (Blender Z-up, метры):
  перед (-Y) — клеммы, реле, индикаторы; тыл (+Y) — DIN-рейка и зажим
  верх (+Z) — ключ, сброс, светодиод питания, винты, дефлекторы
  габарит по паспорту 0,20 x 0,15 x 0,10 м, низ корпуса на z = 0
  вращения нет (motion: none), анимационная пустышка не нужна
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/control_interlock'
CID = 'control_interlock'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
# корпус
BODY_HX, BODY_HY = 0.0935, 0.0660      # 0.187 x 0.132
BODY_Z1 = 0.0890

# клеммная колодка на передней грани
DECK_HX = 0.0880
DECK_Z0, DECK_Z1 = 0.0050, 0.0300
DECK_Y = -0.0730                      # лицевая плоскость колодки
TERM_N = 16
TERM_PITCH = 0.0110
TERM_X0 = -0.0825
SCREW_Z = 0.0205
SLOT_Z = 0.0098
NUM_Z = 0.0272

# полосы передней панели
BAND_MID_Z0, BAND_MID_Z1 = 0.0335, 0.0525
BAND_TOP_Z0, BAND_TOP_Z1 = 0.0550, 0.0880

# кассетный отсек реле
BAY_X0, BAY_X1 = -0.0870, 0.0240
BAY_FRONT = -0.0730
RELAY_W, RELAY_H, RELAY_ZC = 0.0460, 0.0250, 0.0712
RELAY_XS = (-0.0565, -0.0065)

# статусная панель
STAT_X0, STAT_X1 = 0.0280, 0.0880

# DIN-рейка TS35
RAIL_X = 0.0990
RAIL_Y0, RAIL_Y1 = 0.0672, 0.0755
RAIL_Z0, RAIL_Z1 = 0.0190, 0.0540

# верхняя панель
PAD_X0, PAD_X1 = -0.0460, 0.0360
PAD_Y0, PAD_Y1 = -0.0450, -0.0030
PAD_TOP = 0.0904
KEY_XY = (-0.0180, -0.0230)
RESET_XY = (0.0190, -0.0230)
KEY_TOP = 0.0995

PALETTE = {
    'graphite': (0.082, 0.086, 0.094),    # корпус, кассета
    'milk': (0.930, 0.924, 0.902),        # молочная панель, кассеты реле
    'dark': (0.028, 0.030, 0.036),        # окна, кабель, шлицы, паз
    'steel': (0.605, 0.618, 0.612),       # рейка, клеммы, скобы, ключ
    'red': (0.615, 0.040, 0.030),         # метки, LED, сброс
    'cyan': (0.045, 0.470, 0.510),        # LED, метки каналов B
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
        'graphite': 0.52, 'milk': 0.44, 'dark': 0.58,
        'steel': 0.38, 'red': 0.40, 'cyan': 0.36,
    }[role]
    bsdf.inputs['Metallic'].default_value = 0.90 if role == 'steel' else 0.0
    if role in ('cyan', 'red'):
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = {
            'cyan': 0.85, 'red': 0.55,
        }[role]
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


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), sharp=35.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    apply(obj, role)
    return shade(obj, sharp)


def cyl(name, a, b, radius, role, vertices=32, r2=None, bev=0.0, sharp=35.0):
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


def curve_tube(name, points, radius, role, res=8):
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


def _cyl(bm, a, b, r1, r2=None, segs=24):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r1 if r2 is None else r2,
                          depth=d.length, matrix=m)


def rr_ring(hx, hy, r, per_corner=8):
    r = min(r, hx, hy)
    pts = []
    corners = ((hx - r, -(hy - r), -90.0), (hx - r, hy - r, 0.0),
               (-(hx - r), hy - r, 90.0), (-(hx - r), -(hy - r), 180.0))
    for cx, cy, a0 in corners:
        for i in range(per_corner):
            a = math.radians(a0 + 90.0 * i / per_corner)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def loft(name, rings, role, per_corner=8, sharp=32.0):
    bm = bmesh.new()
    levels = []
    n = None
    for (z, hx, hy, r) in rings:
        pts = rr_ring(hx, hy, r, per_corner)
        n = len(pts)
        levels.append([bm.verts.new((x, y, z)) for (x, y) in pts])
    for i in range(len(levels) - 1):
        low, up = levels[i], levels[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((low[k], low[k2], up[k2], up[k]))
    bm.faces.new(tuple(reversed(levels[0])))
    bm.faces.new(tuple(levels[-1]))
    return mesh_from_bm(name, bm, role, sharp)


def lathe(name, profile, role, segs=48, sharp=60.0):
    bm = bmesh.new()
    ang = [math.tau * i / segs for i in range(segs)]
    levels = []
    for (r, z) in profile:
        if r <= 1e-9:
            levels.append([bm.verts.new((0.0, 0.0, z))])
        else:
            levels.append([bm.verts.new((r * math.cos(a), r * math.sin(a), z))
                           for a in ang])
    for i in range(len(levels) - 1):
        low, up = levels[i], levels[i + 1]
        if len(low) == 1 and len(up) == 1:
            continue
        if len(low) == 1:
            for k in range(segs):
                bm.faces.new((low[0], up[k], up[(k + 1) % segs]))
        elif len(up) == 1:
            for k in range(segs):
                bm.faces.new((low[k], low[(k + 1) % segs], up[0]))
        else:
            for k in range(segs):
                k2 = (k + 1) % segs
                bm.faces.new((low[k], low[k2], up[k2], up[k]))
    return mesh_from_bm(name, bm, role, sharp)


def extrude_profile(name, prof_yz, x0, x1, role, sharp=30.0):
    bm = bmesh.new()
    rings = [[bm.verts.new((x, y, z)) for (y, z) in prof_yz] for x in (x0, x1)]
    n = len(prof_yz)
    for k in range(n):
        k2 = (k + 1) % n
        bm.faces.new((rings[0][k], rings[0][k2], rings[1][k2], rings[1][k]))
    bm.faces.new(tuple(rings[0]))
    bm.faces.new(tuple(reversed(rings[1])))
    return mesh_from_bm(name, bm, role, sharp)


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0), extrude=0.00035):
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


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ==== 1. корпус =====================================================
    add(loft(PREFIX + 'housing', [
        (0.0000, BODY_HX - 0.0022, BODY_HY - 0.0022, 0.0080),
        (0.0035, BODY_HX, BODY_HY, 0.0090),
        (0.0090, BODY_HX, BODY_HY, 0.0090),
        (0.0828, BODY_HX, BODY_HY, 0.0090),
        (0.0864, BODY_HX - 0.0018, BODY_HY - 0.0018, 0.0078),
        (BODY_Z1, BODY_HX - 0.0042, BODY_HY - 0.0042, 0.0062),
    ], 'graphite', per_corner=9))

    # нижний цоколь (полка под клеммной колодкой)
    add(cube(PREFIX + 'base_plate', (0.0, -0.0010, 0.0018),
             (0.1870, 0.1350, 0.0036), 'graphite', r=0.0014))

    # горизонтальная расшивка корпуса между полосами
    add(cube(PREFIX + 'seam_mid', (0.0, -0.0656, 0.0316),
             (0.1800, 0.0016, 0.0018), 'dark', r=0.0004))
    add(cube(PREFIX + 'seam_top', (0.0, -0.0656, 0.0536),
             (0.1800, 0.0016, 0.0018), 'dark', r=0.0004))

    # ==== 2. DIN-рейка TS35 + пружинный зажим ===========================
    rail = [
        (RAIL_Y0, RAIL_Z0),
        (RAIL_Y0, RAIL_Z0 + 0.0028),
        (RAIL_Y0 + 0.0040, RAIL_Z0 + 0.0058),
        (RAIL_Y0 + 0.0040, RAIL_Z1 - 0.0058),
        (RAIL_Y0, RAIL_Z1 - 0.0028),
        (RAIL_Y0, RAIL_Z1),
        (RAIL_Y1, RAIL_Z1),
        (RAIL_Y1, RAIL_Z0),
    ]
    add(extrude_profile(PREFIX + 'din_rail', rail, -RAIL_X, RAIL_X, 'steel'))

    # прорези под крепёж рейки (потай на задней полке)
    bm = bmesh.new()
    for x in (-0.0855, 0.0855):
        bm_box(bm, (x, RAIL_Y1 + 0.0002, (RAIL_Z0 + RAIL_Z1) * 0.5),
               (0.0090, 0.0012, 0.0120))
    add(mesh_from_bm(PREFIX + 'rail_slots', bm, 'dark', 30.0))

    # зажим: два крюка над губками рейки + пружинный язычок
    bm = bmesh.new()
    for zc in (RAIL_Z0 + 0.0012, RAIL_Z1 - 0.0012):
        bm_box(bm, (0.0, 0.0668, zc), (0.0340, 0.0034, 0.0042))
        bm_box(bm, (0.0, 0.0691, zc + (0.0016 if zc < 0.03 else -0.0016)),
               (0.0340, 0.0022, 0.0028))
    add(mesh_from_bm(PREFIX + 'rail_clip_hooks', bm, 'steel', 30.0))
    add(cube(PREFIX + 'rail_clip_spring', (0.0, 0.0694, 0.0365),
             (0.0260, 0.0030, 0.0130), 'graphite', r=0.0008))
    add(cube(PREFIX + 'rail_clip_pad', (0.0, 0.0712, 0.0365),
             (0.0150, 0.0018, 0.0090), 'steel', r=0.0006))
    # винт зажима
    add(cyl(PREFIX + 'rail_clip_screw', (0.0, 0.0640, 0.0365),
            (0.0, 0.0676, 0.0365), 0.0034, 'steel', vertices=16))

    # ==== 3. клеммная колодка: 16 клемм =================================
    add(cube(PREFIX + 'terminal_deck', (0.0, DECK_Y + 0.0040, 0.0175),
             (DECK_HX * 2, 0.0080, DECK_Z1 - DECK_Z0), 'graphite', r=0.0016))

    bm_body = bmesh.new()
    bm_ring = bmesh.new()
    bm_screw = bmesh.new()
    bm_slot = bmesh.new()
    bm_hole = bmesh.new()
    for k in range(TERM_N):
        px = TERM_X0 + k * TERM_PITCH
        # изолятор секции клеммы
        bm_box(bm_body, (px, DECK_Y + 0.0018, 0.0168),
               (0.0012, 0.0016, 0.0196))
        # тёмное гнездо-цоколь вокруг винта
        _cyl(bm_ring, (px, DECK_Y + 0.0006, SCREW_Z),
             (px, DECK_Y - 0.0008, SCREW_Z), 0.0039, segs=22)
        # головка винта (выступает над гнездом)
        _cyl(bm_screw, (px, DECK_Y - 0.0004, SCREW_Z),
             (px, DECK_Y - 0.0015, SCREW_Z), 0.0029, segs=22)
        # крестовой шлиц
        bm_box(bm_slot, (px, DECK_Y - 0.0016, SCREW_Z),
               (0.0042, 0.0009, 0.0009))
        bm_box(bm_slot, (px, DECK_Y - 0.0016, SCREW_Z),
               (0.0009, 0.0009, 0.0042))
        # ввод провода (окно с рычажком)
        bm_box(bm_hole, (px, DECK_Y - 0.0002, SLOT_Z),
               (0.0056, 0.0009, 0.0022))
    add(mesh_from_bm(PREFIX + 'terminal_dividers', bm_body, 'dark', 30.0))
    add(mesh_from_bm(PREFIX + 'terminal_cups', bm_ring, 'dark', 40.0))
    add(mesh_from_bm(PREFIX + 'terminal_screws', bm_screw, 'steel', 40.0))
    add(mesh_from_bm(PREFIX + 'terminal_slots', bm_slot, 'dark', 40.0))
    add(mesh_from_bm(PREFIX + 'wire_ports', bm_hole, 'dark', 30.0))

    # планка с нумерацией каналов
    add(cube(PREFIX + 'channel_strip', (0.0, DECK_Y + 0.0002, NUM_Z),
             (TERM_N * TERM_PITCH + 0.0040, 0.0020, 0.0042), 'milk', r=0.0005))

    nums = []
    for k in range(TERM_N):
        px = TERM_X0 + k * TERM_PITCH
        nums.append(text(f'{PREFIX}num_{k + 1:02d}', str(k + 1), 0.0030,
                         (px, DECK_Y - 0.0009, NUM_Z), 'dark',
                         extrude=0.00016))
    bpy.ops.object.select_all(action='DESELECT')
    for o in nums:
        o.select_set(True)
    bpy.context.view_layer.objects.active = nums[0]
    bpy.ops.object.join()
    nums[0].name = PREFIX + 'channel_numbers'
    add(nums[0])

    # цветокодировка каналов A/B над клеммами (8 пар)
    bm_red = bmesh.new()
    bm_cyan = bmesh.new()
    for pair in range(8):
        px = TERM_X0 + (pair * 2 + 1) * TERM_PITCH * 0.5 + TERM_PITCH * 0.5
        bmp = bm_red if pair % 2 == 0 else bm_cyan
        bm_box(bmp, (px, DECK_Y - 0.0004, 0.0246), (0.0180, 0.0009, 0.0011))
    add(mesh_from_bm(PREFIX + 'channel_marks_a', bm_red, 'red', 30.0))
    add(mesh_from_bm(PREFIX + 'channel_marks_b', bm_cyan, 'cyan', 30.0))

    # ==== 4. табличка с наименованием ===================================
    add(cube(PREFIX + 'name_plate', (-0.0370, -0.0668, 0.0430),
             (0.0990, 0.0018, 0.0192), 'milk', r=0.0014))
    add(text(PREFIX + 'label_name', 'БЛОКИРОВКИ', 0.0070,
             (-0.0370, -0.0679, 0.0466), 'dark'))
    add(text(PREFIX + 'label_code', 'CTL-INT-04   24V DC', 0.0032,
             (-0.0370, -0.0679, 0.0382), 'dark'))
    add(cube(PREFIX + 'label_tab', (-0.0868, -0.0668, 0.0430),
             (0.0060, 0.0018, 0.0192), 'red', r=0.0008))

    # ==== 5. RJ45 Ethernet ==============================================
    add(cube(PREFIX + 'eth_body', (0.0362, -0.0688, 0.0430),
             (0.0196, 0.0070, 0.0164), 'milk', r=0.0012))
    add(cube(PREFIX + 'eth_mouth', (0.0362, -0.0726, 0.0414),
             (0.0132, 0.0016, 0.0090), 'dark', r=0.0004))
    add(cube(PREFIX + 'eth_latch', (0.0362, -0.0726, 0.0476),
             (0.0104, 0.0014, 0.0020), 'steel', r=0.0003))
    add(text(PREFIX + 'label_eth', 'ETH', 0.0030, (0.0570, -0.0672, 0.0430),
             'milk'))
    add(cube(PREFIX + 'barcode_plate', (0.0712, -0.0668, 0.0430),
             (0.0270, 0.0016, 0.0104), 'milk', r=0.0004))
    bm = bmesh.new()
    for i, w in enumerate((0.0007, 0.0014, 0.0007, 0.0020, 0.0007, 0.0012)):
        bm_box(bm, (0.0612 + i * 0.0022, -0.0678, 0.0434), (w, 0.0008, 0.0068))
    add(mesh_from_bm(PREFIX + 'label_barcode', bm, 'dark', 30.0))

    # ==== 6. кассетный отсек с двумя реле ===============================
    mid_x = (BAY_X0 + BAY_X1) * 0.5
    bay_w = BAY_X1 - BAY_X0
    # молочная рамка-кассета: верх/низ/бока/центральная стойка
    add(cube(PREFIX + 'bay_frame_top', (mid_x, -0.0695, 0.0866),
             (bay_w, 0.0080, 0.0030), 'graphite', r=0.0008))
    add(cube(PREFIX + 'bay_frame_bottom', (mid_x, -0.0695, 0.0565),
             (bay_w, 0.0080, 0.0032), 'graphite', r=0.0008))
    add(cube(PREFIX + 'bay_frame_left', (BAY_X0 + 0.0018, -0.0695, 0.0715),
             (0.0036, 0.0080, 0.0334), 'graphite', r=0.0008))
    add(cube(PREFIX + 'bay_frame_right', (BAY_X1 - 0.0018, -0.0695, 0.0715),
             (0.0036, 0.0080, 0.0334), 'graphite', r=0.0008))
    add(cube(PREFIX + 'bay_backplate', (mid_x, -0.0654, 0.0715),
             (bay_w - 0.0070, 0.0022, 0.0290), 'dark', r=0.0004))

    # направляющие и гнёзда реле
    bm = bmesh.new()
    for cx in RELAY_XS:
        bm_box(bm, (cx, -0.0664, 0.0592), (0.0430, 0.0036, 0.0040))
        bm_box(bm, (cx, -0.0664, 0.0838), (0.0430, 0.0036, 0.0036))
    add(mesh_from_bm(PREFIX + 'relay_sockets', bm, 'dark', 30.0))

    # два реле: молочная кассета, тёмное основание, красный рычаг, стальная скоба
    for idx, cx in enumerate(RELAY_XS):
        tag = 'a' if idx == 0 else 'b'
        add(cube(f'{PREFIX}relay_{tag}', (cx, -0.0702, RELAY_ZC),
                 (RELAY_W, 0.0076, RELAY_H), 'milk', r=0.0012))
        add(cube(f'{PREFIX}relay_base_{tag}', (cx, -0.0741, 0.0604),
                 (0.0404, 0.0008, 0.0030), 'dark', r=0.0003))
        add(cube(f'{PREFIX}relay_window_{tag}', (cx - 0.0040, -0.0741, 0.0800),
                 (0.0230, 0.0008, 0.0072), 'dark', r=0.0004))
        add(text(f'{PREFIX}relay_label_{tag}', 'K%d' % (idx + 1), 0.0052,
                 (cx + 0.0140, -0.0743, 0.0800), 'dark'))
        add(cube(f'{PREFIX}relay_actuator_{tag}', (cx + 0.0158, -0.0739, 0.0646),
                 (0.0044, 0.0010, 0.0050), 'red', r=0.0004))
        bm = bmesh.new()
        for sx in (-1, 1):
            bm_box(bm, (cx + sx * 0.0208, -0.0742, 0.0706),
                   (0.0016, 0.0012, 0.0256))
        bm_box(bm, (cx, -0.0742, 0.0830), (0.0430, 0.0012, 0.0016))
        bm_box(bm, (cx, -0.0742, 0.0586), (0.0430, 0.0012, 0.0016))
        add(mesh_from_bm(f'{PREFIX}relay_clip_{tag}', bm, 'steel', 30.0))

    # ==== 7. статусная панель: LED + сброс ==============================
    add(cube(PREFIX + 'status_plate', ((STAT_X0 + STAT_X1) * 0.5, -0.0668, 0.0715),
             (STAT_X1 - STAT_X0 - 0.0050, 0.0018, 0.0310), 'milk', r=0.0012))
    add(cube(PREFIX + 'status_plate_inner', ((STAT_X0 + STAT_X1) * 0.5, -0.0676, 0.0715),
             (STAT_X1 - STAT_X0 - 0.0110, 0.0008, 0.0260), 'dark', r=0.0004))

    led_xs = (0.0390, 0.0478, 0.0566, 0.0654)
    led_roles = ('red', 'cyan', 'cyan', 'red')
    for i, (lx, role) in enumerate(zip(led_xs, led_roles), start=1):
        add(cyl(f'{PREFIX}led_{i:02d}', (lx, -0.0674, 0.0814),
                (lx, -0.0694, 0.0814), 0.0026, role, vertices=20, bev=0.0004))
        add(torus(f'{PREFIX}led_rim_{i:02d}', (lx, -0.0676, 0.0814), 0.0028,
                  0.0006, 'steel', axis='Y', segs=24, rings=6))

    add(torus(PREFIX + 'reset_bezel', (0.0574, -0.0674, 0.0646),
              0.0072, 0.0013, 'steel', axis='Y', segs=32, rings=8))
    add(cyl(PREFIX + 'reset_button', (0.0574, -0.0674, 0.0646),
            (0.0574, -0.0714, 0.0646), 0.0059, 'red', vertices=28, bev=0.0008))
    add(text(PREFIX + 'label_reset', 'RESET', 0.0024, (0.0574, -0.0679, 0.0748),
             'milk'))

    # ==== 8. верхняя панель: ключ, сброс, LED, винты, дефлекторы ========
    add(cube(PREFIX + 'top_pad', ((PAD_X0 + PAD_X1) * 0.5, (PAD_Y0 + PAD_Y1) * 0.5,
                                  BODY_Z1 - 0.0006),
             (PAD_X1 - PAD_X0, PAD_Y1 - PAD_Y0, 0.0022), 'milk', r=0.0016))

    kx, ky = KEY_XY
    # кольцо-безель ключа, барабан, ключ
    add(torus(PREFIX + 'key_bezel', (kx, ky, BODY_Z1 + 0.0018), 0.0114, 0.0016,
              'steel', axis='Z', segs=48, rings=8))
    add(cyl(PREFIX + 'key_collar', (kx, ky, BODY_Z1 + 0.0014),
            (kx, ky, BODY_Z1 + 0.0060), 0.0102, 'graphite', vertices=40,
            bev=0.0006))
    add(cyl(PREFIX + 'key_barrel', (kx, ky, BODY_Z1 + 0.0058),
            (kx, ky, BODY_Z1 + 0.0088), 0.0064, 'steel', vertices=32))
    # бородка ключа: стержень + плоское полотно-поводок, повернуто на 32°
    ang = math.radians(32.0)
    add(cyl(PREFIX + 'key_shaft', (kx, ky, BODY_Z1 + 0.0086),
            (kx, ky, BODY_Z1 + 0.0098), 0.0036, 'steel', vertices=24))
    add(cube(PREFIX + 'key_blade',
             (kx + math.cos(ang) * 0.0075, ky + math.sin(ang) * 0.0075,
              BODY_Z1 + 0.0096),
             (0.0180, 0.0064, 0.0016), 'steel', r=0.0005,
             rot=(0, 0, ang)))
    add(cube(PREFIX + 'key_index', (kx + 0.0060, ky - 0.0086, BODY_Z1 + 0.0038),
             (0.0030, 0.0016, 0.0030), 'red', r=0.0003))

    add(cyl(PREFIX + 'top_reset_ring', (RESET_XY[0], RESET_XY[1], BODY_Z1 + 0.0006),
            (RESET_XY[0], RESET_XY[1], BODY_Z1 + 0.0030), 0.0082, 'steel',
            vertices=32, bev=0.0004))
    add(cyl(PREFIX + 'top_reset_cap', (RESET_XY[0], RESET_XY[1], BODY_Z1 + 0.0026),
            (RESET_XY[0], RESET_XY[1], BODY_Z1 + 0.0064), 0.0062, 'red',
            vertices=28, bev=0.0008))
    add(cyl(PREFIX + 'top_led', (-0.0400, -0.0230, BODY_Z1 + 0.0010),
            (-0.0400, -0.0230, BODY_Z1 + 0.0024), 0.0024, 'cyan',
            vertices=20, bev=0.0004))

    add(text(PREFIX + 'label_auto', 'AUTO', 0.0034, (kx, PAD_Y0 + 0.0064, PAD_TOP),
             'dark', rot=(0, 0, 0)))
    add(text(PREFIX + 'label_off', 'OFF', 0.0028, (kx, PAD_Y1 - 0.0050, PAD_TOP),
             'dark', rot=(0, 0, 0)))
    add(text(PREFIX + 'label_reset_top', 'RESET', 0.0028,
             (RESET_XY[0], PAD_Y0 + 0.0050, PAD_TOP), 'dark', rot=(0, 0, 0)))
    add(text(PREFIX + 'label_pwr', 'PWR', 0.0026, (-0.0400, PAD_Y0 + 0.0052, PAD_TOP),
             'dark', rot=(0, 0, 0)))

    # винты крышки (4 шт) и дефлекторы
    bm = bmesh.new()
    bm_sock = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            px, py = sx * 0.0762, sy * 0.0492
            _cyl(bm, (px, py, BODY_Z1 - 0.0012), (px, py, BODY_Z1 + 0.0022),
                 0.0048, segs=24)
            _cyl(bm_sock, (px, py, BODY_Z1 + 0.0020), (px, py, BODY_Z1 + 0.0026),
                 0.0022, segs=12)
            bm_box(bm_sock, (px, py, BODY_Z1 + 0.0023), (0.0030, 0.0009, 0.0007))
    add(mesh_from_bm(PREFIX + 'top_screws', bm, 'steel', 40.0))
    add(mesh_from_bm(PREFIX + 'top_screw_slots', bm_sock, 'dark', 40.0))

    bm = bmesh.new()
    for i in range(6):
        bm_box(bm, (-0.0300 + i * 0.0120, 0.0300, BODY_Z1 - 0.0004),
               (0.0072, 0.0130, 0.0018))
    add(mesh_from_bm(PREFIX + 'top_louvres', bm, 'dark', 30.0))

    # ==== 9. боковая маркировка и вентиляция ============================
    add(cube(PREFIX + 'side_label', (0.0939, -0.0150, 0.0620),
             (0.0012, 0.0470, 0.0170), 'milk', r=0.0006))
    add(text(PREFIX + 'side_label_text', 'CTL-INT-04', 0.0040,
             (0.0946, -0.0150, 0.0620), 'dark', rot=(math.pi / 2, 0, math.pi / 2)))
    add(cube(PREFIX + 'side_label_bar', (0.0940, -0.0150, 0.0530),
             (0.0012, 0.0470, 0.0018), 'red', r=0.0003))

    bm = bmesh.new()
    for sx in (-1, 1):
        for i in range(4):
            bm_box(bm, (sx * 0.0941, -0.0400 + i * 0.0090, 0.0205),
                   (0.0014, 0.0048, 0.0130))
    add(mesh_from_bm(PREFIX + 'side_vents', bm, 'dark', 30.0))

    # ==== 10. кабельный ввод и кабель ===================================
    add(cyl(PREFIX + 'cable_gland', (-0.0926, -0.0080, 0.0170),
            (-0.0972, -0.0080, 0.0170), 0.0078, 'graphite', vertices=6))
    add(cyl(PREFIX + 'cable_gland_nut', (-0.0968, -0.0080, 0.0170),
            (-0.0994, -0.0080, 0.0170), 0.0070, 'steel', vertices=6))
    add(curve_tube(PREFIX + 'cable', [
        (-0.0968, -0.0080, 0.0170),
        (-0.0972, -0.0200, 0.0130),
        (-0.0972, -0.0340, 0.0090),
        (-0.0966, -0.0480, 0.0062),
        (-0.0952, -0.0600, 0.0054),
    ], 0.0034, 'dark'))
    add(cube(PREFIX + 'cable_boot', (-0.0944, -0.0648, 0.0054),
             (0.0076, 0.0100, 0.0072), 'graphite', r=0.0014))
    add(cube(PREFIX + 'cable_plug', (-0.0936, -0.0708, 0.0058),
             (0.0068, 0.0046, 0.0058), 'graphite', r=0.0012))
    add(cube(PREFIX + 'cable_plug_key', (-0.0936, -0.0708, 0.0098),
             (0.0030, 0.0036, 0.0030), 'steel', r=0.0004))

    # ==== 11. extras / имена ===========================================
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

    tol = 0.006
    passport = (0.20, 0.15, 0.10)
    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(passport),
        'bbox_delta_mm': [round((size[i] - passport[i]) * 1000.0, 2) for i in range(3)],
        'bbox_ok': bool(all(abs(size[i] - passport[i]) <= tol for i in range(3))),
        'floor_contact_mm': round((mn.z - 0.0) * 1000.0, 3),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'motion': 'none',
        'empties': sorted(o.name for o in bpy.data.objects if o.type == 'EMPTY'),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'unprefixed_meshes': sorted(o.name for o in meshes
                                    if not o.name.startswith(PREFIX)),
    }
    # ключевые габариты узлов
    def one(name):
        o = bpy.data.objects.get(PREFIX + name)
        if not o:
            return None
        a, b = mesh_bbox([o])
        return [round((b[i] - a[i]) * 1000.0, 2) for i in range(3)]

    report['key_sizes_mm'] = {
        'housing': one('housing'),
        'din_rail': one('din_rail'),
        'terminal_screws': one('terminal_screws'),
        'relay_a': one('relay_a'),
        'relay_b': one('relay_b'),
        'key_shaft': one('key_shaft'),
        'cable': one('cable'),
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
    bg.inputs['Strength'].default_value = 0.55

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3,
                                     location=(center.x, center.y, mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.34, -0.38, 0.34), 2.60, 0.34),
            ('fill', (-0.40, -0.30, 0.18), 1.10, 0.46),
            ('rim', (0.06, 0.38, 0.30), 1.60, 0.36)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.60))
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
    # крупный план: реле, клеммы, LED-панель, ключ
    close_t = Vector((-0.0080, -0.0500, 0.0745))
    c_close = box_corners(Vector((-0.0930, -0.0800, 0.0500)) - close_t,
                          Vector((0.0910, 0.0080, 0.1005)) - close_t)

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
        ('3q', (-0.72, -0.86, 0.44), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('front', (0.08, -1.00, 0.22), center + Vector((0, 0, 0.006)), 70, c_main, 0.90),
        ('side', (1.00, -0.10, 0.16), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('closeup', (0.66, -0.72, 0.42), close_t, 85, c_close, None),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners, margin=1.12)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if fill is not None:
            for _ in range(4):
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
        print(f'RENDERED {tag} fill={max_ndc(fill or 0.0):.3f} {fp}', flush=True)
    return outs


def main():
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
