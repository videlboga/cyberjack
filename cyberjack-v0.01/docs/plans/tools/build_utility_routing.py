"""Standalone builder: utility_routing (UTL-ROUTE-06, «Кабельный контур»).

Перфорированный кабельный лоток с тремя секциями (два разделителя),
пучком силовых / сигнальных кабелей и рифлёным шлангом, стяжками,
маркировкой, съёмными графитовыми крышками и опорными кронштейнами.

Плиты-основания нет. Вращения нет (motion: pulse на drive_connector),
анимационная пустышка не нужна.

Не зависит от build_component_library.py / build_utility_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_utility_routing.py

Выход:
  public/models/machine-modules/components/utility_routing.glb
  docs/plans/blockout/component-library/utility_routing/*.png
  docs/plans/blockout/component-library/utility_routing/report.json

Геометрия (Blender Z-up, метры):
  габарит по паспорту 1,0 x 0,10 x 0,05 м
    X: -0.500 .. +0.500  (длина трассы)
    Y: -0.050 .. +0.050  (ширина лотка)
    Z:  0.000 .. +0.050  (кронштейн 0..0.020, дно 0.020..0.024,
                          стенка 0.024..0.046, крышка 0.046..0.0495)
  открытый участок крышки: x -0.285 .. +0.030 (видны кабели)
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/utility_routing'
CID = 'utility_routing'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- габарит / ключевые размеры (м) --------------------------------------
XL = 0.500                  # полудинна трассы
WY = 0.050                  # полуширина лотка
ZF0, ZF1 = 0.020, 0.024     # дно лотка (низ / верх)
ZW0, ZW1 = 0.024, 0.043     # стойки стенки
ZR0, ZR1 = 0.043, 0.046     # верхний обвязочный профиль
ZL0, ZL1 = 0.046, 0.0495    # съёмные крышки
WALL_Y0, WALL_Y1 = 0.044, 0.050    # стенка: внутри / снаружи
LIP_Y0, LIP_Y1 = 0.038, 0.044      # отбортовка под крышку
DIV_Y = 0.017               # оси разделителей (3 секции)
DIV_T = 0.0016              # полутолщина разделителя
RIB_PITCH, RIB_HW = 0.036, 0.006   # перфорация дна: шаг / полуширина
POST_PITCH, POST_HW = 0.0748, 0.005  # перфорация стенки
LID_SPANS = [(-0.496, -0.300), (0.090, 0.496)]   # крышки (между ними открыто)
CABLE_X0, CABLE_X1 = -0.487, 0.482

PALETTE = {
    'body': (0.902, 0.892, 0.866),      # молочный полимер лотка
    'graphite': (0.108, 0.114, 0.124),  # крышки, разделители, разъём
    'steel': (0.600, 0.612, 0.622),     # крепёж, кронштейны, обоймы
    'dark': (0.046, 0.049, 0.054),      # кабели, шланг, стяжки
    'red': (0.612, 0.056, 0.046),       # силовой кабель / метка
    'blue': (0.055, 0.160, 0.360),      # сигнальный кабель
    'cyan': (0.090, 0.400, 0.500),      # data / LED
    'yellow': (0.830, 0.650, 0.055),    # маркировка шланга
    'white': (0.940, 0.938, 0.926),     # бирки, надписи
    'nylon': (0.760, 0.762, 0.746),     # нейлоновые стяжки
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
        'body': 0.55, 'graphite': 0.46, 'steel': 0.34, 'dark': 0.62,
        'red': 0.46, 'blue': 0.48, 'cyan': 0.44, 'yellow': 0.44,
        'white': 0.52, 'nylon': 0.66,
    }[role]
    bsdf.inputs['Metallic'].default_value = 0.88 if role == 'steel' else (
        0.30 if role == 'graphite' else 0.0)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.9
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


def bevel(obj, width=0.0012, segments=2, angle=40.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
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


def bm_cube(bm, x0, x1, y0, y1, z0, z1):
    m = (Matrix.Translation(((x0 + x1) * .5, (y0 + y1) * .5, (z0 + z1) * .5))
         @ Matrix.Diagonal((x1 - x0, y1 - y0, z1 - z0, 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_cyl(bm, a, b, r, segs=16):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r, radius2=r, depth=d.length, matrix=m)


def bm_cyl2(bm, a, b, r1, r2, segs=16):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r2, depth=d.length, matrix=m)


def mesh_from_bm(name, bm, role, smooth_angle=35.0, bev=0.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, 2)
    return shade(obj, smooth_angle)


def cyl(name, a, b, radius, role, vertices=24, bev=0.0, sharp=35.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=d.length,
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


def torus(name, loc, major, minor, role, axis='Z', segs=48, rings=10,
          scale=None):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=loc)
    obj = bpy.context.object
    obj.name = name
    if scale is not None:
        obj.scale = scale
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    apply(obj, role)
    return shade(obj, 50.0)


def curve_tube(name, points, radius, role, res=6):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 10
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


def text(name, body, size, loc, role, rot=(0, 0, 0), extrude=0.00022):
    global FONT
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    cu.resolution_u = 4
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


def wave(x, y0, amp, period, phase):
    return y0 + amp * math.sin(2.0 * math.pi * (x - CABLE_X0) / period + phase)


# --- сборка корпуса лотка -------------------------------------------------
def build_tray():
    parts = []
    L = XL - 0.006          # дно не доходит до торцевых рамок

    # перфорированное дно: поперечные рёбра + два продольных ребра под
    # разделителями (щели 0.024 x 0.026 -> читается как перфорация)
    bm = bmesh.new()
    n_rib = int(round((2 * L) / RIB_PITCH)) + 1
    for i in range(n_rib):
        x = -L + 0.006 + i * (2 * L - 0.012) / (n_rib - 1)
        bm_cube(bm, x - RIB_HW, x + RIB_HW, -WALL_Y0, WALL_Y0, ZF0, ZF1)
    parts.append(mesh_from_bm(PREFIX + 'tray_floor_ribs', bm, 'body', 30.0,
                              0.0006))

    for tag, yc in (('l', -DIV_Y), ('r', DIV_Y)):
        parts.append(box(PREFIX + f'tray_rail_{tag}', -L, L,
                         yc - 0.004, yc + 0.004, ZF0, ZF1, 'body', r=0.0006))

    # стенки: нижний профиль + стойки + верхний профиль + отбортовка
    for tag, s in (('l', -1.0), ('r', 1.0)):
        y0, y1 = sorted((s * WALL_Y0, s * WALL_Y1))
        parts.append(box(PREFIX + f'tray_wall_base_{tag}', -XL, XL, y0, y1,
                         ZF0, ZW0, 'body', r=0.0010))
        parts.append(box(PREFIX + f'tray_wall_rim_{tag}', -XL, XL, y0, y1,
                         ZR0, ZR1, 'body', r=0.0010))
        ly0, ly1 = sorted((s * LIP_Y0, s * LIP_Y1))
        parts.append(box(PREFIX + f'tray_lip_{tag}', -XL, XL, ly0, ly1,
                         LIP_Y1 - 0.0018, ZR1, 'body', r=0.0005))

        bm = bmesh.new()
        n_post = int(round((2 * XL - 0.028) / POST_PITCH)) + 1
        for i in range(n_post):
            x = -XL + 0.014 + i * (2 * XL - 0.028) / (n_post - 1)
            bm_cube(bm, x - POST_HW, x + POST_HW, y0, y1, ZW0, ZR0)
        parts.append(mesh_from_bm(PREFIX + f'tray_wall_posts_{tag}', bm,
                                  'body', 30.0, 0.0006))

    # торцевые рамки (открытые, чтобы пучок читался с торца)
    for tag, x0, x1 in (('l', -XL, -XL + 0.006), ('r', XL - 0.006, XL)):
        bm = bmesh.new()
        bm_cube(bm, x0, x1, -WY, WY, ZF0, ZW0)
        bm_cube(bm, x0, x1, -WY, WY, ZR0, ZR1)
        bm_cube(bm, x0, x1, -WY, -WALL_Y0, ZW0, ZR0)
        bm_cube(bm, x0, x1, WALL_Y0, WY, ZW0, ZR0)
        parts.append(mesh_from_bm(PREFIX + f'tray_end_frame_{tag}', bm, 'body',
                                  30.0, 0.0008))

    # разделители с просечкой (нижняя/верхняя полки + стойки)
    for tag, yc in (('l', -DIV_Y), ('r', DIV_Y)):
        bm = bmesh.new()
        bm_cube(bm, -XL + 0.010, XL - 0.010, yc - DIV_T, yc + DIV_T,
                ZF1, ZF1 + 0.0060)
        bm_cube(bm, -XL + 0.010, XL - 0.010, yc - DIV_T, yc + DIV_T,
                ZR1 - 0.0060, ZR1)
        n = 11
        for i in range(n + 1):
            x = -XL + 0.016 + i * (2 * XL - 0.032) / n
            bm_cube(bm, x - 0.0055, x + 0.0055, yc - DIV_T, yc + DIV_T,
                    ZF1 + 0.0060, ZR1 - 0.0060)
        parts.append(mesh_from_bm(PREFIX + f'divider_{tag}', bm, 'body',
                                  30.0, 0.0005))
    return parts


# --- кабельный пучок ------------------------------------------------------
CABLES = [
    # силовая секция (y от -0.044 до -0.0186)
    dict(name='cable_pwr_a', y=-0.0372, r=0.0064, role='dark',
         amp=0.0010, period=0.44, phase=0.0),
    dict(name='cable_pwr_b', y=-0.0254, r=0.0056, role='red',
         amp=0.0009, period=0.39, phase=1.9),
    # сигнальная секция (y от -0.0154 до 0.0154)
    dict(name='cable_data_a', y=-0.0068, r=0.0034, role='cyan',
         amp=0.0013, period=0.31, phase=0.4),
    dict(name='cable_data_b', y=0.0000, r=0.0034, role='blue',
         amp=0.0012, period=0.34, phase=2.4),
    dict(name='cable_data_c', y=0.0068, r=0.0032, role='dark',
         amp=0.0014, period=0.36, phase=4.1),
    # шланговая секция (y от 0.0186 до 0.044)
    dict(name='cable_signal', y=0.0378, r=0.0040, role='dark',
         amp=0.0009, period=0.47, phase=3.0),
]
HOSE = dict(y=0.0262, r=0.0074, amp=0.0011, period=0.52, phase=0.8)


def build_cables():
    parts = []
    for c in CABLES:
        z = ZF1 + c['r']
        n = 14
        pts = []
        for i in range(n):
            x = CABLE_X0 + (CABLE_X1 - CABLE_X0) * i / (n - 1)
            pts.append((x, wave(x, c['y'], c['amp'], c['period'], c['phase']),
                        z))
        parts.append(curve_tube(PREFIX + c['name'], pts, c['r'], c['role']))

    # рифлёный шланг
    parts.append(ribbed_hose(PREFIX + 'hose', CABLE_X0, CABLE_X1,
                             HOSE['y'], ZF1 + HOSE['r'], HOSE['r'],
                             0.0009, 0.026, HOSE['amp'], HOSE['period'],
                             HOSE['phase']))

    # сервисная петля сигнального кабеля в открытой части лотка
    parts.append(curve_tube(PREFIX + 'service_loop',
                            [(-0.170, 0.0055, 0.0288),
                             (-0.140, 0.0090, 0.0362),
                             (-0.108, 0.0035, 0.0430),
                             (-0.077, -0.0040, 0.0360),
                             (-0.048, 0.0, 0.0286)], 0.0026, 'blue'))

    # цветовые бирки-обмотки на кабелях
    bm = bmesh.new()
    for x, c in ((-0.300, CABLES[0]), (0.190, CABLES[0]),
                 (-0.300, CABLES[2]), (0.190, CABLES[1])):
        cy = wave(x, c['y'], c['amp'], c['period'], c['phase'])
        z = ZF1 + c['r']
        bm_cyl(bm, (x - 0.0035, cy, z), (x + 0.0035, cy, z), c['r'] + 0.0004, 18)
    parts.append(mesh_from_bm(PREFIX + 'cable_bands', bm, 'yellow', 50.0))

    # стяжки: силовой пучок и сигнальный пучок
    tie_stations = [(-0.455, 'pwr'), (-0.372, 'pwr'), (-0.215, 'pwr'),
                    (-0.088, 'pwr'), (0.150, 'pwr'), (0.400, 'pwr'),
                    (-0.455, 'data'), (-0.372, 'data'), (-0.215, 'data'),
                    (-0.088, 'data'), (0.150, 'data'), (0.400, 'data')]
    bm_tie = bmesh.new()
    for x, kind in tie_stations:
        if kind == 'pwr':
            cy = (wave(x, CABLES[0]['y'], CABLES[0]['amp'], CABLES[0]['period'],
                       CABLES[0]['phase'])
                  + wave(x, CABLES[1]['y'], CABLES[1]['amp'],
                         CABLES[1]['period'], CABLES[1]['phase'])) * 0.5
            cz = ZF1 + 0.0060
            ry, rz = 0.0129, 0.0076
        else:
            cy = (wave(x, CABLES[2]['y'], CABLES[2]['amp'], CABLES[2]['period'],
                       CABLES[2]['phase'])
                  + wave(x, CABLES[4]['y'], CABLES[4]['amp'],
                         CABLES[4]['period'], CABLES[4]['phase'])) * 0.5
            cz = ZF1 + 0.0034
            ry, rz = 0.0106, 0.0044
        parts.append(tie_band(PREFIX + f'tie_{kind}_{int((x + 0.5) * 1000):03d}',
                              x, cy, cz, ry, rz, 'nylon'))
    bm_tie.free()
    return parts


def ribbed_hose(name, x0, x1, y0, z0, r, rib, period, amp, wperiod, phase,
                seg=12, step=0.0032):
    bm = bmesh.new()
    n = max(8, int((x1 - x0) / step))
    rings = []
    for i in range(n + 1):
        x = x0 + (x1 - x0) * i / n
        y = wave(x, y0, amp, wperiod, phase)
        rr = r + rib * (0.5 + 0.5 * math.cos(2.0 * math.pi * (x - x0) / period))
        ring = []
        for k in range(seg):
            a = 2.0 * math.pi * k / seg
            ring.append(bm.verts.new((x, y + rr * math.cos(a),
                                      z0 + rr * math.sin(a))))
        rings.append(ring)
    for i in range(n):
        a_, b_ = rings[i], rings[i + 1]
        for k in range(seg):
            j = (k + 1) % seg
            bm.faces.new((a_[k], a_[j], b_[j], b_[k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[-1])
    return mesh_from_bm(name, bm, 'dark', 50.0)


def tie_band(name, cx, cy, cz, ry, rz, role):
    """Плоская стяжка-эллипс вокруг пучка (кольцо в плоскости YZ)."""
    t = 0.0011                       # толщина ленты
    obj = torus(name, (cx, cy, cz), 1.0, 0.06, role, axis=None,
                segs=44, rings=8, scale=(rz, ry, t / 0.12))
    obj.rotation_euler = (0, math.pi / 2, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    # хвостик стяжки
    tail = box(name + '_tail', cx - 0.0008, cx + 0.0008,
               cy + ry - 0.0016, cy + ry + 0.0042,
               cz - 0.0006, cz + 0.0006, role, r=0.0003)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    tail.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.join()
    return obj


# --- крышки, крепления, разъём, маркировка -------------------------------
def build_lids():
    parts = []
    for i, (x0, x1) in enumerate(LID_SPANS):
        tag = 'a' if i == 0 else 'b'
        parts.append(box(PREFIX + f'lid_{tag}', x0, x1, -0.0455, 0.0455,
                         ZL0, ZL1, 'graphite', r=0.0014))
        parts.append(box(PREFIX + f'lid_rib_{tag}', x0 + 0.008, x1 - 0.008,
                         -0.016, 0.016, ZL1 - 0.0002, ZL1 + 0.0004,
                         'graphite', r=0.0004))
        # отбортовка крышки, заходящая на рамку
        for s in (-1.0, 1.0):
            y0, y1 = sorted((s * 0.0455, s * 0.0488))
            parts.append(box(PREFIX + f'lid_edge_{tag}_{"l" if s < 0 else "r"}',
                             x0 + 0.002, x1 - 0.002, y0, y1,
                             ZR1 - 0.0004, ZL1, 'graphite', r=0.0004))

    # винты крышек + болты кронштейнов
    bm = bmesh.new()
    for x in (0.090, 0.440, -0.470, -0.300):
        for y in (-0.040, 0.040):
            bm_cyl(bm, (x, y, ZL1 - 0.0010), (x, y, ZL1 + 0.0005), 0.0026, 16)
    parts.append(mesh_from_bm(PREFIX + 'lid_screws', bm, 'steel', 40.0))

    # маркировка на крышке панели A (две строки по обе стороны ребра)
    parts.append(text(PREFIX + 'mark_lid_code', 'UTL-ROUTE-06', 0.0075,
                      (0.263, 0.0205, ZL1 + 0.0003), 'white'))
    parts.append(text(PREFIX + 'mark_lid_spec', 'CABLE ROUTE 1.0 m   IP54',
                      0.0048, (0.263, -0.0205, ZL1 + 0.0003), 'white'))
    return parts


def build_brackets():
    parts = []
    for i, x in enumerate((-0.420, 0.0, 0.420)):
        tag = f'{i + 1}'
        # резиновая подушка, опорная лапа, седло под дно лотка
        parts.append(box(PREFIX + f'bracket_pad_{tag}', x - 0.024, x + 0.024,
                         -0.040, 0.040, 0.0000, 0.0030, 'dark', r=0.0008))
        parts.append(box(PREFIX + f'bracket_foot_{tag}', x - 0.027, x + 0.027,
                         -0.044, 0.044, 0.0028, 0.0072, 'steel', r=0.0010))
        parts.append(box(PREFIX + f'bracket_saddle_{tag}', x - 0.024, x + 0.024,
                         -0.042, 0.042, ZF0 - 0.0030, ZF0, 'steel',
                         r=0.0008))
        # две несущие стойки-стенки между лапой и седлом
        bm = bmesh.new()
        for s in (-1.0, 1.0):
            y0, y1 = sorted((s * 0.0295, s * 0.0385))
            bm_cube(bm, x - 0.022, x + 0.022, y0, y1, 0.0072, ZF0 - 0.0030)
        parts.append(mesh_from_bm(PREFIX + f'bracket_stems_{tag}', bm, 'steel',
                                  35.0, 0.0006))
        # раскосы внутрь
        bm = bmesh.new()
        for s in (-1.0, 1.0):
            bm_cyl(bm, (x, s * 0.0375, 0.0092), (x, s * 0.011, ZF0 - 0.0040),
                   0.0034, 12)
        parts.append(mesh_from_bm(PREFIX + f'bracket_struts_{tag}', bm, 'steel',
                                  40.0))
        # болты лапы к полу
        bm = bmesh.new()
        for dx in (-0.019, 0.019):
            for dy in (-0.034, 0.034):
                bm_cyl(bm, (x + dx, dy, 0.0072), (x + dx, dy, 0.0100),
                       0.0025, 12)
        parts.append(mesh_from_bm(PREFIX + f'bracket_bolts_{tag}', bm, 'steel',
                                  40.0))
    return parts


def build_connector():
    parts = []
    x0, x1 = -0.300, -0.258
    yc = -0.0312
    parts.append(box(PREFIX + 'drive_connector', x0, x1, yc - 0.0105,
                     yc + 0.0105, ZF1 + 0.0010, ZF1 + 0.0165, 'graphite',
                     r=0.0016))
    for i in range(3):
        xx = x0 + 0.007 + i * 0.013
        parts.append(box(PREFIX + f'drive_connector_rib_{i + 1}', xx,
                         xx + 0.0045, yc - 0.0108, yc + 0.0108,
                         ZF1 + 0.0012, ZF1 + 0.0170, 'graphite', r=0.0006))
    # гермоввод и статусный светодиод (pulse)
    parts.append(cyl(PREFIX + 'drive_strain_relief', (x1, yc, ZF1 + 0.0085),
                     (x1 + 0.0060, yc, ZF1 + 0.0085), 0.0052, 'graphite',
                     vertices=20, bev=0.0008))
    parts.append(cyl(PREFIX + 'drive_led', (x0 + 0.020, yc - 0.0035,
                                            ZF1 + 0.0172),
                     (x0 + 0.020, yc - 0.0035, ZF1 + 0.0186), 0.0018, 'cyan',
                     vertices=16))
    # прижим пучка перед вводной коробкой
    parts.append(box(PREFIX + 'cable_clamp', 0.430, 0.440, -0.043, 0.043,
                     ZR0 - 0.0035, ZR0, 'steel', r=0.0008))
    bm = bmesh.new()
    for y in (-0.036, 0.036):
        bm_cyl(bm, (0.435, y, ZR0 - 0.0012), (0.435, y, ZR0 + 0.0022), 0.0022,
               12)
    parts.append(mesh_from_bm(PREFIX + 'cable_clamp_bolts', bm, 'steel', 40.0))

    # вводная (переходная) коробка: пучок уходит в неё на торце
    parts.append(box(PREFIX + 'entry_box', 0.468, 0.496, -0.044, 0.044,
                     ZF1, 0.0432, 'graphite', r=0.0016))
    parts.append(box(PREFIX + 'entry_box_lid', 0.472, 0.492, -0.038, 0.038,
                     0.0432, 0.0450, 'graphite', r=0.0010))
    parts.append(box(PREFIX + 'entry_box_grommet', 0.4665, 0.4695, -0.041,
                     0.041, ZF1 + 0.0015, 0.0405, 'dark', r=0.0008))
    bm = bmesh.new()
    for y in (-0.033, 0.033):
        bm_cyl(bm, (0.482, y, 0.0449), (0.482, y, 0.0462), 0.0022, 12)
    parts.append(mesh_from_bm(PREFIX + 'entry_box_screws', bm, 'steel', 40.0))

    # гермовводы на торцевой панели коробки: силовой / сигнальный / шланг
    bm = bmesh.new()
    for y, z, r in ((-0.0312, 0.0305, 0.0092), (0.0000, 0.0274, 0.0072),
                    (0.0262, 0.0314, 0.0092)):
        bm_cyl2(bm, (0.4955, y, z), (0.4991, y, z), r, r, 6)
        bm_cyl2(bm, (0.4991, y, z), (0.5000, y, z), r * 0.62, r * 0.46, 12)
    parts.append(mesh_from_bm(PREFIX + 'entry_box_glands', bm, 'steel', 30.0))
    return parts


def build_marking():
    parts = []
    # бирки на отбортовке лотка
    for tag, x, label in (('pwr', -0.246, 'PWR 1'), ('data', -0.186, 'DATA')):
        parts.append(box(PREFIX + f'tag_rim_{tag}', x - 0.017, x + 0.017,
                         LIP_Y0 + 0.0006, LIP_Y1 - 0.0006, ZR1, ZR1 + 0.0012,
                         'white', r=0.0004))
        parts.append(text(PREFIX + f'tag_rim_{tag}_text', label, 0.0036,
                          (x, (LIP_Y0 + LIP_Y1) * 0.5, ZR1 + 0.0013), 'dark'))

    # шильдик на наружной стенке
    parts.append(box(PREFIX + 'label_side_plate', -0.222, -0.140, -0.0509,
                     -0.0499, 0.0285, 0.0415, 'white', r=0.0004))
    parts.append(text(PREFIX + 'label_side_text', 'UTL-ROUTE-06', 0.0056,
                      (-0.181, -0.0513, 0.0368), 'graphite',
                      rot=(math.pi / 2, 0, 0)))
    parts.append(text(PREFIX + 'label_side_ip', 'IP54 / 2.5 kg', 0.0034,
                      (-0.181, -0.0513, 0.0312), 'graphite',
                      rot=(math.pi / 2, 0, 0)))
    return parts


def build():
    reset()
    parts = []
    parts += build_tray()
    parts += build_cables()
    parts += build_lids()
    parts += build_brackets()
    parts += build_connector()
    parts += build_marking()
    for o in parts:
        if not o.name.startswith(PREFIX):
            o.name = PREFIX + o.name
        # extras уходят в GLB (export_extras=True)
        o['component'] = CID
        o['role'] = o.data.materials[0].name
    conn = bpy.data.objects.get(PREFIX + 'drive_connector')
    if conn is not None:
        conn['motion'] = 'pulse'
        conn['motion_speed'] = 1.5
        conn['motion_part'] = 'drive_connector'
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
    passport = (1.000, 0.100, 0.050)
    tol = 0.004
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(objs)
    size = mx - mn
    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in ((mn + mx) * 0.5)],
        'bbox_passport': list(passport),
        'bbox_ok': bool(all(abs(size[i] - passport[i]) <= tol for i in range(3))),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'tray_sections': 3,
        'divider_count': len([o for o in objs if 'divider' in o.name]),
        'floor_ribs': int(round((2 * (XL - 0.006)) / RIB_PITCH)) + 1,
        'cables': len([o for o in objs if 'cable' in o.name]),
        'brackets': len([o for o in objs if 'bracket_pad' in o.name]),
        'glb': None,
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
    scene.view_settings.exposure = -0.25
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.585, 0.588, 0.596, 1.0)
    bg.inputs['Strength'].default_value = 0.40

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=3,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.620, 0.614, 0.602, 1.0)
    nb.inputs['Roughness'].default_value = 0.95
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.50, -0.58, 0.44), 7.5, 0.34),
            ('fill', (-0.66, -0.40, 0.24), 3.4, 0.50),
            ('rim', (0.10, 0.54, 0.38), 5.0, 0.44),
            ('top', (0.0, -0.06, 0.52), 2.6, 0.46)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.35))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 60
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
    # крупный план открытого участка с пучком
    close_t = Vector((-0.120, 0.0, 0.0340))
    c_close = box_corners(Vector((-0.285, -0.053, 0.0180)) - close_t,
                          Vector((0.055, 0.053, 0.0510)) - close_t)
    # торец (поперечное сечение): рамка вокруг правого конца
    end_t = Vector((0.430, 0.0, 0.0260))
    c_end = box_corners(Vector((0.390, -0.054, -0.002)) - end_t,
                        Vector((0.500, 0.054, 0.0510)) - end_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(objs):
        worst = 0.0
        for o in objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.60, -0.78, 0.72), center + Vector((0, 0, 0.002)), 65,
         c_main, 0.96, mesh_objs),
        ('front', (-0.04, -1.0, 0.14), center, 58, c_main, 0.96, mesh_objs),
        ('side', (1.0, -0.22, 0.26), end_t, 85, c_end, 0.96, None),
        ('closeup', (0.30, -0.60, 0.74), close_t, 85, c_close, 0.96, None),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, objs in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat(
            '-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if objs is not None:
            for _ in range(4):
                got = max_ndc(objs)
                if abs(got - fill) < 0.02:
                    break
                dist *= got / fill
                cam.location = target + dirn * dist
                cam.rotation_euler = (target - cam.location).to_track_quat(
                    '-Z', 'Y').to_euler()
                bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        got_txt = f'{max_ndc(objs):.3f}' if objs is not None else 'crop'
        print(f'RENDERED {tag} fill={got_txt} {fp}', flush=True)
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
