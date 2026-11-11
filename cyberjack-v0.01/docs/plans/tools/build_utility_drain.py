"""Standalone builder: utility_drain (UTL-DRAIN-05, «Слив»).

Компактный дренажный узел: белый полимерный корпус-сумпа с круглым фланцем и
приёмной воронкой-раструбом, съёмная решётка (тёмная плита + стальные прутки),
бутылочный сифон-гидрозатвор слева (корпус, накидная гайка, ревизионная пробка
снизу), патрубок Ø32 с быстросъёмной муфтой (бирюзовый корпус, стопорные
кольца, рычаг), блок датчика протечки с LED-окном и накладной щуп на полу,
кронштейн крепления к стене с анкерными болтами, маркировка DRAIN / DN32 /
LEAK.

Не зависит от build_component_library.py / build_*.py. Плиты-основания нет.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_utility_drain.py

Выход:
  public/models/machine-modules/components/utility_drain.glb
  docs/plans/blockout/component-library/utility_drain/*.png
  docs/plans/blockout/component-library/utility_drain/report.json

Геометрия (Blender Z-up, метры):
  ось воронки = Z, низ корпуса (лапы/щуп/пробка сифона) на z = 0
  перед (-Y) — маркировка, датчик протечки, ревизия сифона
  сифон — вертикальный корпус слева (-X), выход патрубка Ø32 в -X
  габарит по паспорту 0,20 x 0,15 x 0,10 м
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/utility_drain'
CID = 'utility_drain'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
# сумпа: центр (SUM_X, SUM_Y), полугабарит 0.040 x 0.043
SUM_X, SUM_Y = 0.008, -0.002
SUM_HX, SUM_HY = 0.040, 0.043
SUM_Z0, SUM_Z1 = 0.008, 0.062

# приёмная воронка + фланец
FUN_RIM_Z = 0.0946
FUN_RIM_R = 0.0432
FUN_BASE_R = 0.0300
FUN_THROAT_R = 0.0180
FLANGE_Z0, FLANGE_Z1, FLANGE_R = 0.0620, 0.0692, 0.0480
GRATE_Z = 0.0900
GRATE_R = 0.0355

# сифон (бутылочный гидрозатвор) слева
TRAP_X, TRAP_Y = -0.052, -0.004
TRAP_R = 0.0210
TRAP_TOP = 0.0462

# патрубок Ø32 + быстросъём
SPOUT_Z = 0.0330
SPOUT_R = 0.0160
COUP_X0, COUP_X1 = -0.0895, -0.1010

# блок датчика протечки (+X)
BOX_X, BOX_Y = 0.072, -0.001
BOX_HX, BOX_HY = 0.026, 0.031
BOX_Z0, BOX_Z1 = 0.010, 0.052

# накладной щуп на полу (перед-право)
SEN_X, SEN_Y = 0.070, -0.064
SEN_HX, SEN_HY = 0.020, 0.011

# кронштейн на стену (+Y)
BRK_FACE = 0.062
BRK_BACK = 0.075

PALETTE = {
    'body': (0.938, 0.930, 0.910),        # тёплый белый полимер, корпус
    'ivory': (0.975, 0.968, 0.950),       # воронка, патрубок, сифон
    'teal': (0.070, 0.470, 0.510),        # бирюзовый патрубок / окно статуса
    'graphite': (0.150, 0.158, 0.168),    # кронштейн, блок, решётка, щуп
    'steel': (0.700, 0.712, 0.706),       # прутки решётки, крепёж, кольца
    'cyan': (0.320, 0.880, 0.820),        # LED (эмиссия)
    'dark': (0.045, 0.048, 0.052),        # маркировка, кабель, уплотнения
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
        'body': 0.46, 'ivory': 0.42, 'teal': 0.34, 'graphite': 0.52,
        'steel': 0.34, 'cyan': 0.18, 'dark': 0.62,
    }[role]
    bsdf.inputs['Metallic'].default_value = 0.90 if role == 'steel' else 0.0
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.15
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role):
    obj.data.materials.append(mat(role))
    return obj


def shade(obj, angle=35.0):
    """Сглаживание с автоматическими рёбрами жёсткости (Blender 4.x)."""
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


def torus(name, loc, major, minor, role, axis='Z', segs=56, rings=12):
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


def bm_cyl(bm, a, b, r1, r2=None, segs=24):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r1 if r2 is None else r2,
                          depth=d.length, matrix=m)


def rr_ring(hx, hy, r, per_corner=8):
    """Точки скруглённого прямоугольника (CCW), r — радиус угла."""
    r = min(r, hx, hy)
    pts = []
    corners = ((hx - r, -(hy - r), -90.0), (hx - r, hy - r, 0.0),
               (-(hx - r), hy - r, 90.0), (-(hx - r), -(hy - r), 180.0))
    for cx, cy, a0 in corners:
        for i in range(per_corner):
            a = math.radians(a0 + 90.0 * i / per_corner)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def loft(name, rings, role, per_corner=8, sharp=32.0, loc=(0.0, 0.0, 0.0)):
    """Тело по сечениям: rings = [(z, hx, hy, r), ...] снизу вверх."""
    bm = bmesh.new()
    levels = []
    for (z, hx, hy, r) in rings:
        pts = rr_ring(hx, hy, r, per_corner)
        levels.append([bm.verts.new((x, y, z)) for (x, y) in pts])
    n = len(levels[0])
    for i in range(len(levels) - 1):
        low, up = levels[i], levels[i + 1]
        for k in range(n):
            k2 = (k + 1) % n
            bm.faces.new((low[k], low[k2], up[k2], up[k]))
    bm.faces.new(tuple(reversed(levels[0])))
    bm.faces.new(tuple(levels[-1]))
    obj = mesh_from_bm(name, bm, role, sharp)
    obj.location = loc
    return obj


def lathe(name, profile, role, segs=64, sharp=60.0, loc=(0.0, 0.0, 0.0)):
    """Тело вращения вокруг Z: profile = [(r, z), ...]; последняя точка =
    первая -> замкнутая оболочка. r <= 0 -> точка на оси."""
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
    obj = mesh_from_bm(name, bm, role, sharp)
    obj.location = loc
    return obj


def ring_x(name, r_in, r_out, x0, x1, role, segs=48):
    """Кольцо-обойма вокруг оси X (сквозная расточка r_in)."""
    length = abs(x1 - x0)
    obj = lathe(name, [(r_in, 0.0), (r_out, 0.0), (r_out, length),
                       (r_in, length), (r_in, 0.0)],
                role, segs=segs, sharp=40.0, loc=(0.0, 0.0, 0.0))
    obj.rotation_euler = (0.0, math.pi / 2.0, 0.0)
    obj.location = (min(x0, x1), TRAP_Y, SPOUT_Z)
    bpy.context.view_layer.update()
    return obj


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0), extrude=0.0007):
    global FONT
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    cu.resolution_u = 6
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

    # ---- лапы на пол (4 резиновые пяты) --------------------------------
    bm = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            px = SUM_X + sx * (SUM_HX - 0.009)
            py = SUM_Y + sy * (SUM_HY - 0.010)
            bm_cyl(bm, (px, py, 0.0000), (px, py, 0.0094), 0.0068, segs=20)
            bm_cyl(bm, (px, py, 0.0000), (px, py, 0.0018), 0.0060, segs=20)
    add(mesh_from_bm(PREFIX + 'floor_feet', bm, 'dark', 40.0))

    # ---- сумпа (корпус) ------------------------------------------------
    add(loft(PREFIX + 'sump_body',
             [(SUM_Z0, SUM_HX - 0.0026, SUM_HY - 0.0026, 0.0100),
              (SUM_Z0 + 0.0038, SUM_HX, SUM_HY, 0.0110),
              (0.0520, SUM_HX, SUM_HY, 0.0110),
              (SUM_Z1, SUM_HX - 0.0050, SUM_HY - 0.0055, 0.0092)],
             'body', per_corner=9, loc=(SUM_X, SUM_Y, 0.0)))

    # стяжной пояс / шов литья
    add(loft(PREFIX + 'sump_seam',
             [(0.0502, SUM_HX + 0.0008, SUM_HY + 0.0008, 0.0112),
              (0.0524, SUM_HX + 0.0008, SUM_HY + 0.0008, 0.0112)],
             'dark', per_corner=9, loc=(SUM_X, SUM_Y, 0.0)))

    # ---- круглый фланец воронки ---------------------------------------
    add(cyl(PREFIX + 'funnel_flange', (SUM_X, SUM_Y, FLANGE_Z0),
            (SUM_X, SUM_Y, FLANGE_Z1), FLANGE_R, 'ivory', vertices=64,
            bev=0.0018))
    bm = bmesh.new()
    for i in range(4):
        a = math.radians(45.0 + 90.0 * i)
        px = SUM_X + math.cos(a) * (FLANGE_R - 0.0055)
        py = SUM_Y + math.sin(a) * (FLANGE_R - 0.0055)
        bm_cyl(bm, (px, py, FLANGE_Z1 - 0.0004), (px, py, FLANGE_Z1 + 0.0028),
               0.0034, segs=6)
        bm_cyl(bm, (px, py, FLANGE_Z1 + 0.0028), (px, py, FLANGE_Z1 + 0.0036),
               0.0020, segs=12)
    add(mesh_from_bm(PREFIX + 'flange_bolts', bm, 'steel', 40.0))

    # ---- приёмная воронка-раструб --------------------------------------
    add(lathe(PREFIX + 'funnel',
              [(FUN_BASE_R, FLANGE_Z1 - 0.0010),
               (0.0330, 0.0760),
               (0.0372, 0.0830),
               (0.0410, 0.0900),
               (0.0428, FUN_RIM_Z),
               (0.0428, 0.0958),
               (0.0402, 0.0962),
               (0.0394, 0.0930),
               (0.0376, 0.0860),
               (0.0338, 0.0780),
               (0.0286, 0.0700),
               (0.0200, 0.0640),
               (FUN_THROAT_R, 0.0620),
               (FUN_BASE_R, FLANGE_Z1 - 0.0010)],
              'ivory', segs=64, sharp=62.0, loc=(SUM_X, SUM_Y, 0.0)))

    add(torus(PREFIX + 'funnel_rim', (SUM_X, SUM_Y, 0.0952),
              FUN_RIM_R - 0.0024, 0.0026, 'ivory', segs=64, rings=12))

    # ---- решётка: тёмная плита + стальные прутки ------------------------
    add(cyl(PREFIX + 'grate_plate', (SUM_X, SUM_Y, 0.0862),
            (SUM_X, SUM_Y, GRATE_Z), 0.0372, 'graphite', vertices=64,
            bev=0.0008))
    bm = bmesh.new()
    for y in (-0.0290, -0.0145, 0.0, 0.0145, 0.0290):
        half = math.sqrt(max(GRATE_R ** 2 - y ** 2, 1e-6))
        bm_box(bm, (SUM_X, SUM_Y + y, GRATE_Z + 0.0018),
               (2 * half, 0.0028, 0.0036))
    for x in (-0.0290, -0.0145, 0.0, 0.0145, 0.0290):
        half = math.sqrt(max(GRATE_R ** 2 - x ** 2, 1e-6))
        bm_box(bm, (SUM_X + x, SUM_Y, GRATE_Z + 0.0018),
               (0.0028, 2 * half, 0.0036))
    add(mesh_from_bm(PREFIX + 'grate_bars', bm, 'steel', 30.0))
    add(cyl(PREFIX + 'grate_hub', (SUM_X, SUM_Y, GRATE_Z),
            (SUM_X, SUM_Y, GRATE_Z + 0.0038), 0.0074, 'steel',
            vertices=32, bev=0.0006))
    add(cyl(PREFIX + 'grate_screw', (SUM_X, SUM_Y, GRATE_Z + 0.0038),
            (SUM_X, SUM_Y, GRATE_Z + 0.0047), 0.0038, 'dark',
            vertices=6))

    # ---- сифон: бутылочный гидрозатвор слева ---------------------------
    add(lathe(PREFIX + 'trap_cup',
              [(0.0000, 0.0120),
               (0.0190, 0.0120),
               (TRAP_R, 0.0162),
               (TRAP_R, 0.0290),
               (0.0219, 0.0310),
               (0.0219, 0.0350),
               (TRAP_R, 0.0370),
               (TRAP_R, 0.0432),
               (0.0198, 0.0450),
               (0.0000, 0.0454)],
              'ivory', segs=48, sharp=58.0, loc=(TRAP_X, TRAP_Y, 0.0)))

    add(torus(PREFIX + 'trap_seam', (TRAP_X, TRAP_Y, 0.0330), 0.0215,
              0.0014, 'dark', segs=48, rings=8))

    # резьбовая крышка гидрозатвора сверху
    add(torus(PREFIX + 'trap_cap_ring', (TRAP_X, TRAP_Y, 0.0454), 0.0198,
              0.0018, 'steel', segs=40, rings=8))
    add(cyl(PREFIX + 'trap_cap', (TRAP_X, TRAP_Y, 0.0450),
            (TRAP_X, TRAP_Y, 0.0506), 0.0182, 'graphite', vertices=6,
            bev=0.0012))
    add(cyl(PREFIX + 'trap_cap_boss', (TRAP_X, TRAP_Y, 0.0506),
            (TRAP_X, TRAP_Y, 0.0518), 0.0090, 'graphite', vertices=14,
            bev=0.0008))

    # ревизионная пробка снизу
    add(cyl(PREFIX + 'trap_cleanout_cap', (TRAP_X, TRAP_Y, 0.0000),
            (TRAP_X, TRAP_Y, 0.0124), 0.0186, 'ivory', vertices=6,
            bev=0.0014))
    add(cyl(PREFIX + 'trap_cleanout_nut', (TRAP_X, TRAP_Y, 0.0118),
            (TRAP_X, TRAP_Y, 0.0148), 0.0158, 'graphite', vertices=6,
            bev=0.0008))

    # ---- патрубок Ø32 + быстросъём ------------------------------------
    add(cyl(PREFIX + 'spout_pipe', (-0.0750, TRAP_Y, SPOUT_Z),
            (COUP_X1 + 0.0110, TRAP_Y, SPOUT_Z), SPOUT_R, 'ivory',
            vertices=40, bev=0.0008))
    # корпус муфты — кольцо с открытым гнездом (сквозная расточка)
    ring_x(PREFIX + 'coupler_body', SPOUT_R + 0.0004, 0.0208,
           COUP_X1, COUP_X0, 'teal', segs=48)
    add(torus(PREFIX + 'coupler_ring_a', (COUP_X0 - 0.0020, TRAP_Y, SPOUT_Z),
              0.0209, 0.0022, 'steel', axis='X', segs=44, rings=10))
    add(torus(PREFIX + 'coupler_ring_b', (COUP_X1 + 0.0018, TRAP_Y, SPOUT_Z),
              0.0209, 0.0019, 'steel', axis='X', segs=44, rings=10))
    add(torus(PREFIX + 'coupler_seal', (COUP_X1 + 0.0016, TRAP_Y, SPOUT_Z),
              SPOUT_R + 0.0002, 0.0016, 'dark', axis='X', segs=44, rings=8))
    # байонетные упоры на устье
    for tag, sy in (('a', -1), ('b', 1)):
        add(cube(PREFIX + f'coupler_lug_{tag}',
                 (COUP_X1 + 0.0022, TRAP_Y + sy * 0.0206, SPOUT_Z),
                 (0.0072, 0.0044, 0.0098), 'teal', r=0.0008))
    # рычаг-защёлка сверху муфты
    add(cube(PREFIX + 'coupler_lever', (COUP_X1 + 0.0062, TRAP_Y,
                                        SPOUT_Z + 0.0220),
             (0.0168, 0.0110, 0.0052), 'teal', r=0.0016))
    add(cube(PREFIX + 'coupler_lever_pin', (COUP_X1 + 0.0062, TRAP_Y,
                                            SPOUT_Z + 0.0194),
             (0.0096, 0.0072, 0.0044), 'steel', r=0.0009))
    add(cyl(PREFIX + 'coupler_handle', (COUP_X1 + 0.0062, TRAP_Y,
                                         SPOUT_Z + 0.0238),
            (COUP_X1 + 0.0046, TRAP_Y + 0.0136, SPOUT_Z + 0.0330), 0.0028,
            'steel', vertices=16))

    # ---- блок датчика протечки (+X) -----------------------------------
    add(loft(PREFIX + 'sensor_box',
             [(BOX_Z0, BOX_HX - 0.0024, BOX_HY - 0.0024, 0.0060),
              (BOX_Z0 + 0.0030, BOX_HX, BOX_HY, 0.0070),
              (BOX_Z1 - 0.0032, BOX_HX, BOX_HY, 0.0070),
              (BOX_Z1, BOX_HX - 0.0022, BOX_HY - 0.0022, 0.0058)],
             'graphite', per_corner=8, loc=(BOX_X, BOX_Y, 0.0)))

    # окно статуса + LED на передней грани
    add(cube(PREFIX + 'sensor_window', (BOX_X - 0.0016, BOX_Y - BOX_HY + 0.0004,
                                        0.0344),
             (0.0272, 0.0024, 0.0124), 'teal', r=0.0010))
    add(cyl(PREFIX + 'sensor_led', (BOX_X - 0.0092, BOX_Y - BOX_HY - 0.0004, 0.0344),
            (BOX_X - 0.0092, BOX_Y - BOX_HY - 0.0022, 0.0344), 0.0034,
            'cyan', vertices=24))
    add(text(PREFIX + 'label_leak', 'LEAK', 0.0044,
             (BOX_X + 0.0052, BOX_Y - BOX_HY - 0.0010, 0.0344), 'ivory',
             extrude=0.0006))

    # винты крышки блока
    bm = bmesh.new()
    bm_slot = bmesh.new()
    for sx in (-1, 1):
        px = BOX_X + sx * (BOX_HX - 0.0055)
        py = BOX_Y - BOX_HY + 0.0044
        bm_cyl(bm, (px, py, BOX_Z1), (px, py, BOX_Z1 + 0.0018), 0.0030, segs=18)
        bm_box(bm_slot, (px, py, BOX_Z1 + 0.0019), (0.0040, 0.0010, 0.0007))
    add(mesh_from_bm(PREFIX + 'sensor_box_screws', bm, 'steel', 40.0))
    add(mesh_from_bm(PREFIX + 'sensor_box_slots', bm_slot, 'dark', 40.0))

    # кабельный ввод снизу блока
    add(cyl(PREFIX + 'sensor_gland', (BOX_X + 0.0055, BOX_Y - 0.0130, BOX_Z0 + 0.0004),
            (BOX_X + 0.0055, BOX_Y - 0.0130, BOX_Z0 - 0.0052), 0.0042,
            'dark', vertices=6, bev=0.0006))
    add(cyl(PREFIX + 'sensor_gland_nut', (BOX_X + 0.0055, BOX_Y - 0.0130, BOX_Z0 - 0.0006),
            (BOX_X + 0.0055, BOX_Y - 0.0130, BOX_Z0 - 0.0022), 0.0052,
            'steel', vertices=6))

    # ---- накладной щуп на полу ---------------------------------------
    add(loft(PREFIX + 'sensor_probe_body',
             [(0.0000, SEN_HX - 0.0024, SEN_HY - 0.0020, 0.0055),
              (0.0018, SEN_HX, SEN_HY, 0.0062),
              (0.0082, SEN_HX, SEN_HY, 0.0062),
              (0.0102, SEN_HX - 0.0036, SEN_HY - 0.0028, 0.0050)],
             'graphite', per_corner=8, loc=(SEN_X, SEN_Y, 0.0)))
    add(torus(PREFIX + 'sensor_probe_ring', (SEN_X, SEN_Y, 0.0104),
              0.0074, 0.0015, 'teal', segs=40, rings=10))
    add(cyl(PREFIX + 'sensor_probe_lens', (SEN_X, SEN_Y, 0.0100),
            (SEN_X, SEN_Y, 0.0132), 0.0062, 'cyan', vertices=32, bev=0.0014))
    # контактные лепестки под днищем
    bm = bmesh.new()
    for sx in (-1, 1):
        bm_box(bm, (SEN_X + sx * 0.0124, SEN_Y, 0.0012),
               (0.0074, 0.0126, 0.0024))
    add(mesh_from_bm(PREFIX + 'sensor_contacts', bm, 'steel', 30.0))

    # кабель блок -> щуп
    add(curve_tube(PREFIX + 'sensor_cable', [
        (BOX_X + 0.0055, BOX_Y - 0.0130, BOX_Z0 - 0.0048),
        (BOX_X + 0.0040, BOX_Y - 0.0270, 0.0070),
        (SEN_X + 0.0130, SEN_Y + 0.0140, 0.0062),
        (SEN_X + 0.0090, SEN_Y + 0.0055, 0.0094),
    ], 0.0022, 'dark'))

    # ---- кронштейн крепления к стене (+Y) ----------------------------
    add(loft(PREFIX + 'wall_bracket',
             [(0.0120, 0.0230, 0.0052, 0.0030),
              (0.0146, 0.0238, 0.0056, 0.0032),
              (0.0530, 0.0238, 0.0056, 0.0032),
              (0.0552, 0.0208, 0.0048, 0.0024)],
             'graphite', per_corner=8,
             loc=(SUM_X, BRK_FACE + 0.0068, 0.0)))
    # плита-основание кронштейна, примыкающая к корпусу
    add(loft(PREFIX + 'bracket_plate',
             [(0.0130, 0.0242, 0.0118, 0.0030),
              (0.0156, 0.0250, 0.0124, 0.0032),
              (0.0490, 0.0250, 0.0124, 0.0032),
              (0.0512, 0.0224, 0.0106, 0.0026)],
             'graphite', per_corner=8,
             loc=(SUM_X, SUM_Y + SUM_HY + 0.0120, 0.0)))
    # анкерные болты
    bm = bmesh.new()
    bm_was = bmesh.new()
    for sz in (0.0230, 0.0452):
        bm_cyl(bm, (SUM_X, BRK_FACE + 0.0002, sz), (SUM_X, BRK_BACK - 0.0018, sz),
               0.0042, segs=18)
        bm_cyl(bm_was, (SUM_X, BRK_FACE + 0.0002, sz), (SUM_X, BRK_FACE + 0.0018, sz),
               0.0068, segs=18)
    add(mesh_from_bm(PREFIX + 'bracket_bolts', bm, 'steel', 40.0))
    add(mesh_from_bm(PREFIX + 'bracket_washers', bm_was, 'steel', 40.0))

    # ---- маркировка ---------------------------------------------------
    add(text(PREFIX + 'label_drain', 'DRAIN', 0.0084,
             (SUM_X - 0.0062, SUM_Y - SUM_HY - 0.0008, 0.0400), 'dark'))
    add(text(PREFIX + 'label_dn32', 'DN32', 0.0060,
             (SUM_X + 0.0200, SUM_Y - SUM_HY - 0.0008, 0.0268), 'dark'))

    # ---- extras --------------------------------------------------------
    for o in parts:
        o['component'] = CID
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').split('_')[0]
        o['rotating'] = False

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

    coupler = bpy.data.objects[PREFIX + 'coupler_body']
    c_mn, c_mx = mesh_bbox([coupler])
    pipe = bpy.data.objects[PREFIX + 'spout_pipe']
    p_mn, p_mx = mesh_bbox([pipe])
    cup = bpy.data.objects[PREFIX + 'trap_cup']
    t_mn, t_mx = mesh_bbox([cup])

    tol = 0.006
    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [0.20, 0.15, 0.10],
        'bbox_ok': bool(abs(size.x - 0.20) <= tol and abs(size.y - 0.15) <= tol
                        and abs(size.z - 0.10) <= tol),
        'floor_contact_mm': round((mn.z - 0.0) * 1000.0, 3),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'spout_diameter_mm': round((p_mx.z - p_mn.z) * 1000.0, 2),
        'coupler_diameter_mm': round((c_mx.z - c_mn.z) * 1000.0, 2),
        'coupler_x': [round(c_mn.x, 5), round(c_mx.x, 5)],
        'trap_cup_bbox': [[round(v, 5) for v in t_mn], [round(v, 5) for v in t_mx]],
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
    scene.view_settings.exposure = 0.05
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.50

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
            ('key', (0.24, -0.28, 0.28), 1.90, 0.30),
            ('fill', (-0.30, -0.22, 0.15), 0.85, 0.42),
            ('rim', (0.04, 0.30, 0.26), 1.20, 0.34)):
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
    # крупный план: щуп с LED, блок датчика, низ корпуса
    close_t = Vector((0.058, -0.040, 0.024))
    c_close = box_corners(Vector((0.016, -0.082, 0.000)) - close_t,
                          Vector((0.102, -0.002, 0.060)) - close_t)

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
        ('3q', (-0.62, -0.80, 0.30), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('front', (0.06, -1.00, 0.22), center + Vector((0, 0, 0.006)), 70, c_main, 0.90),
        ('side', (-1.00, -0.38, 0.26), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('closeup', (0.52, -0.80, 0.34), close_t, 85, c_close, None),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(4):
            if fill is None:
                break
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
        print(f'RENDERED {tag} fill={max_ndc(fill if fill else 0.95):.3f} {fp}', flush=True)
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
    if not (rep['bbox_ok'] and rep['floor_contact_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
