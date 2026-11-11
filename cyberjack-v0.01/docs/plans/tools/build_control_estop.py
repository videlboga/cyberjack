"""Standalone builder: control_estop (CTL-ESTOP-03, «Аварийный стоп»).

Промышленная кнопка аварийного отключения: жёлтый корпус-стакан на графитовом
клеммном основании, красный грибовидный толкатель с фиксацией (чёрное
поворотное кольцо с накаткой и указателем), защитная скоба-кольцо на четырёх
стойках, контактные блоки с винтовыми клеммами, кабельный ввод с кабелем,
маркировка STOP / АВАРИЯ, крепёжные болты с шайбами. Плиты-основания нет.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_control_estop.py

Выход:
  public/models/machine-modules/components/control_estop.glb
  docs/plans/blockout/component-library/control_estop/*.png
  docs/plans/blockout/component-library/control_estop/report.json

Геометрия (Blender Z-up, метры):
  ось кнопки = Z, центр в (0, 0), низ корпуса на z = 0
  перед (-Y) — сторона с маркировкой, клеммами и кабелем
  габарит по паспорту 0,12 x 0,12 x 0,08 м
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/control_estop'
CID = 'control_estop'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
# клеммное основание
BASE_HX, BASE_HY = 0.0520, 0.0520
BASE_Z1 = 0.0180

# жёлтый корпус: фланец 120x120, стакан 99x99, верх на 0.050
HOU_HX, HOU_HY = 0.0600, 0.0600
HOU_TOP = 0.0500

# привод
BEZEL_R, BEZEL_Z0, BEZEL_Z1 = 0.0305, HOU_TOP, 0.0552
COLLAR_R, COLLAR_Z0, COLLAR_Z1 = 0.0215, 0.0550, 0.0622
HEAD_TOP = 0.0800
CAGE_R, CAGE_TOP = 0.0356, 0.0734
CAGE_POST_R = 0.0030
CAGE_POST_ANGLES = (45.0, 135.0, 225.0, 315.0)

# клеммные блоки на передней грани основания
CB_X = 0.0235
CB_W, CB_H, CB_FRONT = 0.0420, 0.0140, -0.0575

PALETTE = {
    'yellow': (0.820, 0.500, 0.016),       # RAL 1023, корпус / защитное кольцо
    'red': (0.610, 0.032, 0.026),         # RAL 3000, гриб
    'graphite': (0.094, 0.099, 0.110),    # литой корпус, клеммник
    'dark': (0.028, 0.030, 0.035),        # накатка, кабель, надписи-плашки
    'steel': (0.605, 0.618, 0.612),       # крепёж, клеммы, кольцо
    'ivory': (0.950, 0.940, 0.905),       # трафарет
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
        'yellow': 0.40, 'red': 0.38, 'graphite': 0.50, 'dark': 0.58,
        'steel': 0.40, 'ivory': 0.52,
    }[role]
    bsdf.inputs['Metallic'].default_value = 0.90 if role == 'steel' else 0.0
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role):
    obj.data.materials.append(mat(role))
    return obj


def shade(obj, angle=35.0):
    """Сглаживание с автоматическими рёбрами жёсткости (Blender 4.x sharp)."""
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


def torus(name, loc, major, minor, role, axis='Z', segs=64, rings=12):
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


def loft(name, rings, role, per_corner=8, sharp=32.0):
    """Тело по сечениям: rings = [(z, hx, hy, r), ...] снизу вверх."""
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


def lathe(name, profile, role, segs=64, sharp=60.0):
    """Тело вращения вокруг Z: profile = [(r, z), ...] снизу вверх."""
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


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0), extrude=0.0006):
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

    # ---- клеммное основание (графит) -----------------------------------
    add(loft(PREFIX + 'contact_base',
             [(0.0000, BASE_HX - 0.0010, BASE_HY - 0.0010, 0.0095),
              (0.0025, BASE_HX, BASE_HY, 0.0100),
              (0.0155, BASE_HX, BASE_HY, 0.0100),
              (BASE_Z1, BASE_HX - 0.0022, BASE_HY - 0.0022, 0.0090)],
             'graphite', per_corner=9))

    # клеммные блоки на передней грани: два блока по три винта
    for tag, x in (('a', -CB_X), ('b', CB_X)):
        add(cube(f'{PREFIX}contact_block_{tag}',
                 (x, -0.0530, 0.0095), (CB_W, 0.0090, CB_H), 'graphite', r=0.0016))
        add(cube(f'{PREFIX}contact_mark_{tag}', (x, CB_FRONT - 0.0006, 0.0158),
                 (0.0300, 0.0012, 0.0014), 'red', r=0.0002))
        add(cube(f'{PREFIX}contact_groove_{tag}', (x, CB_FRONT - 0.0006, 0.0064),
                 (0.0340, 0.0010, 0.0016), 'dark', r=0.0002))

    # винтовые клеммы: 6 шт, сталь, с крестовым шлицем
    bm = bmesh.new()
    bm_slot = bmesh.new()
    for x in (-CB_X, CB_X):
        for dx in (-0.0130, 0.0, 0.0130):
            px = x + dx
            bm_cyl(bm, (px, CB_FRONT, 0.0095), (px, CB_FRONT - 0.0015, 0.0095),
                   0.0032, segs=20)
            bm_cyl(bm_slot, (px, CB_FRONT - 0.0015, 0.0095),
                   (px, CB_FRONT - 0.0019, 0.0095), 0.0020, segs=14)
            bm_box(bm_slot, (px, CB_FRONT - 0.0017, 0.0095),
                   (0.0026, 0.0010, 0.0007))
            bm_box(bm_slot, (px, CB_FRONT - 0.0017, 0.0095),
                   (0.0007, 0.0010, 0.0026))
    add(mesh_from_bm(PREFIX + 'contact_screws', bm, 'steel', 40.0))
    add(mesh_from_bm(PREFIX + 'contact_screw_slots', bm_slot, 'dark', 40.0))

    # боковые крепёжные винты основания (4 шт, скрытые головки)
    bm = bmesh.new()
    bm_side = bmesh.new()
    for sy in (-1, 1):
        for sx in (-1, 1):
            px, py = sx * BASE_HX, sy * 0.0210
            bm_cyl(bm, (px, py, 0.0105), (px + sx * 0.0022, py, 0.0105),
                   0.0030, segs=18)
            bm_cyl(bm_side, (px + sx * 0.0022, py, 0.0105),
                   (px + sx * 0.0026, py, 0.0105), 0.0017, segs=12)
    add(mesh_from_bm(PREFIX + 'base_screws', bm, 'steel', 40.0))
    add(mesh_from_bm(PREFIX + 'base_screw_sockets', bm_side, 'dark', 40.0))

    # ---- жёлтый корпус: фланец 120x120 -> стакан 99x99 ------------------
    add(loft(PREFIX + 'housing',
             [(0.0180, HOU_HX, HOU_HY, 0.0160),
              (0.0222, HOU_HX, HOU_HY, 0.0160),
              (0.0250, HOU_HX - 0.0032, HOU_HY - 0.0032, 0.0150),
              (0.0266, 0.0520, 0.0520, 0.0130),
              (0.0282, 0.0495, 0.0495, 0.0120),
              (0.0468, 0.0495, 0.0495, 0.0120),
              (0.0492, 0.0486, 0.0486, 0.0115),
              (HOU_TOP, 0.0468, 0.0468, 0.0110)],
             'yellow', per_corner=9))

    # вертикальные рёбра жёсткости (скруглённые) на боку и тыле корпуса
    bm = bmesh.new()
    for dy in (-0.0210, 0.0, 0.0210):
        bm_cyl(bm, (0.0490, dy, 0.0298), (0.0490, dy, 0.0468), 0.0024, segs=14)
    for dx in (-0.0210, 0.0, 0.0210):
        bm_cyl(bm, (dx, 0.0490, 0.0298), (dx, 0.0490, 0.0468), 0.0024, segs=14)
    add(mesh_from_bm(PREFIX + 'housing_ribs', bm, 'yellow', 30.0))

    # вентиляционные прорези на левом боку
    bm = bmesh.new()
    for i in range(5):
        bm_box(bm, (-0.0500, -0.0126 + i * 0.0063, 0.0358),
               (0.0018, 0.0030, 0.0092))
    add(mesh_from_bm(PREFIX + 'housing_vents', bm, 'dark', 30.0))

    # крепёжные болты с шайбами (4 шт) в углах фланца
    bm = bmesh.new()
    bm_sock = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            px, py = sx * 0.0505, sy * 0.0505
            bm_cyl(bm, (px, py, 0.0252), (px, py, 0.0274), 0.0060, segs=26)  # шайба
            bm_cyl(bm, (px, py, 0.0270), (px, py, 0.0312), 0.0043, segs=6)   # шестигранник
            bm_cyl(bm_sock, (px, py, 0.0310), (px, py, 0.0316), 0.0023, segs=6)
    add(mesh_from_bm(PREFIX + 'housing_bolts', bm, 'steel', 40.0))
    add(mesh_from_bm(PREFIX + 'housing_bolt_sockets', bm_sock, 'dark', 40.0))

    # ---- маркировка на передней грани ----------------------------------
    add(cube(PREFIX + 'label_frame', (0.0, -0.0494, 0.0375),
             (0.0760, 0.0020, 0.0190), 'red', r=0.0022))
    add(cube(PREFIX + 'label_plate', (0.0, -0.0500, 0.0375),
             (0.0720, 0.0022, 0.0160), 'dark', r=0.0014))
    add(text(PREFIX + 'label_stop', 'STOP', 0.0135, (0.0, -0.0507, 0.0406), 'ivory'))
    add(text(PREFIX + 'label_avariya', 'АВАРИЯ', 0.0058, (0.0, -0.0507, 0.0324),
             'ivory'))

    # ---- привод: чёрное кольцо-держатель, поворотная втулка -------------
    add(cyl(PREFIX + 'bezel', (0, 0, BEZEL_Z0), (0, 0, BEZEL_Z1), BEZEL_R,
            'graphite', vertices=64, bev=0.0016))
    add(torus(PREFIX + 'bezel_ring', (0, 0, 0.0546), 0.0298, 0.0008, 'steel'))
    add(cyl(PREFIX + 'collar', (0, 0, COLLAR_Z0), (0, 0, COLLAR_Z1), COLLAR_R,
            'graphite', vertices=64, bev=0.0010))

    # накатка на поворотной втулке (24 ребра) + 4 сектора-захвата
    bm = bmesh.new()
    knurl_r = COLLAR_R + 0.0003
    for i in range(24):
        a = math.tau * i / 24.0
        bm_box(bm, (knurl_r * math.cos(a), knurl_r * math.sin(a), 0.0586),
               (0.0013, 0.0018, 0.0060), rotz=a)
    for i in range(4):
        a = math.radians(45.0 + 90.0 * i)
        bm_box(bm, (knurl_r * math.cos(a), knurl_r * math.sin(a), 0.0578),
               (0.0028, 0.0036, 0.0088), rotz=a)
    add(mesh_from_bm(PREFIX + 'collar_knurl', bm, 'dark', 30.0))

    # указатель фиксации (спереди, на втулке)
    add(cube(PREFIX + 'collar_index', (0.0, -(COLLAR_R + 0.0007), 0.0592),
             (0.0026, 0.0016, 0.0042), 'ivory', r=0.0003))

    # ---- защитная скоба: 4 стойки + жёлтое кольцо ----------------------
    bm = bmesh.new()
    for a_deg in CAGE_POST_ANGLES:
        a = math.radians(a_deg)
        px, py = CAGE_R * math.cos(a), CAGE_R * math.sin(a)
        bm_cyl(bm, (px, py, HOU_TOP - 0.0015), (px, py, CAGE_TOP), CAGE_POST_R,
               segs=18)
        bm_cyl(bm, (px, py, 0.0502), (px, py, 0.0524), 0.0060, segs=18)  # пятка
    add(mesh_from_bm(PREFIX + 'cage_posts', bm, 'graphite', 40.0))
    add(torus(PREFIX + 'cage_ring', (0, 0, CAGE_TOP), CAGE_R, 0.0034, 'yellow',
              segs=72, rings=16))

    # ---- красный гриб (тело вращения) ----------------------------------
    add(lathe(PREFIX + 'mushroom', [
        (0.0000, 0.0552),
        (0.0124, 0.0552),   # хвостовик внутри втулки
        (0.0124, 0.0630),
        (0.0196, 0.0648),   # нижняя сторона шляпки
        (0.0238, 0.0662),
        (0.0257, 0.0680),
        (0.0258, 0.0742),   # вертикальный борт шляпки
        (0.0244, 0.0774),
        (0.0198, 0.0794),
        (0.0098, 0.0800),
        (0.0000, 0.0800),
    ], 'red', segs=72))

    # тонкая юбка-уплотнение в зазоре хода
    add(torus(PREFIX + 'mushroom_seal', (0, 0, 0.0638), 0.0130, 0.0015, 'dark',
              segs=64, rings=10))

    # ---- кабельный ввод и кабель ---------------------------------------
    bm = bmesh.new()
    bm_cyl(bm, (0.0258, BASE_HY, 0.0105), (0.0258, BASE_HY + 0.0042, 0.0105),
           0.0078, segs=6)                                   # контргайка
    add(mesh_from_bm(PREFIX + 'gland_nut', bm, 'steel', 40.0))
    add(cyl(PREFIX + 'gland_body', (0.0258, BASE_HY + 0.0040, 0.0105),
            (0.0258, BASE_HY + 0.0080, 0.0105), 0.0060, 'graphite',
            vertices=24, r2=0.0044))

    add(curve_tube(PREFIX + 'cable', [
        (0.0258, 0.0576, 0.0102),
        (0.0398, 0.0532, 0.0078),
        (0.0512, 0.0378, 0.0062),
        (0.0558, 0.0118, 0.0058),
        (0.0530, -0.0140, 0.0058),
        (0.0450, -0.0330, 0.0058),
    ], 0.0030, 'dark'))
    add(torus(PREFIX + 'cable_tie', (0.0557, 0.0000, 0.0058), 0.0042, 0.0010,
              'graphite', axis='Y', segs=20, rings=6))

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

    txt = {o.name.split('__')[-1]: [round(v, 5) for v in mesh_bbox([o])[0]] +
           [round(v, 5) for v in mesh_bbox([o])[1]]
           for o in meshes if o.name.endswith(('label_stop', 'label_avariya'))}

    tol = 0.006
    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [0.12, 0.12, 0.08],
        'bbox_ok': bool(abs(size.x - 0.12) <= tol and abs(size.y - 0.12) <= tol
                        and abs(size.z - 0.08) <= tol),
        'floor_contact_mm': round((mn.z - 0.0) * 1000.0, 3),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'text_bbox': txt,
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
    # крупный план: гриб, кольцо, втулка, маркировка, правый клеммник
    close_t = Vector((0.0, -0.014, 0.052))
    c_close = box_corners(Vector((-0.050, -0.058, 0.004)) - close_t,
                          Vector((0.050, 0.006, 0.083)) - close_t)

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
        ('3q', (0.74, -0.76, 0.50), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('front', (0.10, -1.00, 0.24), center + Vector((0, 0, 0.006)), 70, c_main, 0.90),
        ('side', (1.00, -0.12, 0.18), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('closeup', (0.66, -0.72, 0.40), close_t, 85, c_close, 0.94),
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
