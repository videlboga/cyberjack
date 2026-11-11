"""Standalone builder: control_telemetry (CTL-TEL-02, «Телеметрия»).

Промышленный блок сбора данных: графитовый корпус, молочная лицевая рамка,
утопленный дисплей с трассой, 16 клеммных каналов (8–32 по паспорту),
2 × Ethernet + USB-C, циановые индикаторы, энкодер и кнопки,
DIN-рейка на задней стенке, вентиляционные прорези, кабель питания.
Без плиты-подставки. Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_control_telemetry.py

Выход:
  public/models/machine-modules/components/control_telemetry.glb

Геометрия (Blender Z-up, метры), паспорт 0,30 × 0,20 × 0,08 м:
  X — ширина 0.300, Z — высота 0.200 (низ на z=0), Y — глубина 0.080
  передняя плоскость смотрит в -Y, задняя стенка с DIN-рейкой в +Y
  анимации нет (motion.type = none) — статичная сборка
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
CID = 'control_telemetry'
PREFIX = CID + '__'

# --- габарит по паспорту (м) ---------------------------------------------
W, H, D = 0.300, 0.200, 0.080
X0, X1 = -W * 0.5, W * 0.5
Z0, Z1 = 0.0, H

Y_BODY0, Y_BODY1 = -0.024, 0.030      # корпус: 54 мм глубины
Y_BEZ0 = -0.034                       # лицевая рамка выступает на 10 мм
Y_PANEL = -0.0295                     # утопленная панель под рамкой
Y_KNOB = -0.0395                      # торец энкодера
Y_RAIL = 0.0370                       # DIN-рейка

# лицевая рамка
BEZ_X, BEZ_Z0, BEZ_Z1 = 0.146, 0.005, 0.195
WIN_X, WIN_Z0, WIN_Z1 = 0.126, 0.034, 0.170

# дисплей
DSP_X0, DSP_X1 = -0.120, 0.022
DSP_Z0, DSP_Z1 = 0.096, 0.169
DSP_IX0, DSP_IX1 = -0.113, 0.015
DSP_IZ0, DSP_IZ1 = 0.103, 0.162
Y_GLASS = -0.0336

# клеммы: 2 ряда × 8 каналов
CH_N = 8
CH_PITCH = 0.0170
CH_W = 0.0148
CH_X0 = -0.115
CH_ROWS = (0.0790, 0.0550)
CH_H = 0.0125

PALETTE = {
    'graphite': (0.245, 0.258, 0.272),
    'body': (0.930, 0.922, 0.902),
    'steel': (0.700, 0.706, 0.696),
    'dark': (0.115, 0.124, 0.138),
    'screen': (0.020, 0.042, 0.050),
    'cyan': (0.120, 0.640, 0.760),
    'teal': (0.180, 0.470, 0.520),
    'copper': (0.760, 0.590, 0.300),
}
SPEC = {   # metallic, roughness, emission_strength
    'graphite': (0.30, 0.52, 0.0),
    'body': (0.0, 0.56, 0.0),
    'steel': (0.72, 0.34, 0.0),
    'dark': (0.15, 0.60, 0.0),
    'screen': (0.10, 0.10, 0.22),
    'cyan': (0.0, 0.26, 0.70),
    'teal': (0.0, 0.38, 0.35),
    'copper': (0.88, 0.30, 0.0),
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
    metallic, rough, emit = SPEC[role]
    m = bpy.data.materials.new('CJ_%s_100' % role)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metallic
    if emit > 0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit
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


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), smooth=False):
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


def torus(name, loc, major, minor, role, axis='Z', segs=36, rings=8):
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
    return bpy.context.object


def bm_box(bm, center, size):
    m = Matrix.Translation(Vector(center)) @ Matrix.Diagonal(
        Vector((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m, calc_uvs=False)


def bm_seg(bm, a, b, thick_y, thick_z):
    """Тонкий отрезок между двумя точками (для трассы на экране)."""
    a, b = Vector(a), Vector(b)
    d = b - a
    L = d.length
    if L < 1e-7:
        return
    ang = math.atan2(-d.z, d.x)
    m = (Matrix.Translation((a + b) * 0.5)
         @ Matrix.Rotation(ang, 4, 'Y')
         @ Matrix.Diagonal(Vector((L * 1.02, thick_y, thick_z, 1.0))))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m, calc_uvs=False)


def mesh_from_bm(name, bm, role, smooth=False, bev=0.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, smooth)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev, 2)
    return obj


def frame_plate(name, x0, x1, z0, z1, ix0, ix1, iz0, iz1, y0, y1, role, bev=0.0010):
    """Плоская рамка с прямоугольным окном, выдавленная по Y."""
    bm = bmesh.new()
    o = [(x0, z0), (x1, z0), (x1, z1), (x0, z1)]
    i = [(ix0, iz0), (ix1, iz0), (ix1, iz1), (ix0, iz1)]
    vo0 = [bm.verts.new((x, y0, z)) for x, z in o]
    vo1 = [bm.verts.new((x, y1, z)) for x, z in o]
    vi0 = [bm.verts.new((x, y0, z)) for x, z in i]
    vi1 = [bm.verts.new((x, y1, z)) for x, z in i]
    for k in range(4):
        n = (k + 1) % 4
        bm.faces.new((vo0[k], vo0[n], vi0[n], vi0[k]))     # передняя кромка
        bm.faces.new((vo1[k], vo1[n], vi1[n], vi1[k]))     # задняя кромка
        bm.faces.new((vo0[k], vo0[n], vo1[n], vo1[k]))     # наружная стенка
        bm.faces.new((vi0[k], vi0[n], vi1[n], vi1[k]))     # окно, стенка
    return mesh_from_bm(name, bm, role, False, bev)


def extrude_profile(name, profile_yz, x0, x1, role, bev=0.0):
    """Призма из профиля в плоскости YZ, выдавленная по X."""
    bm = bmesh.new()
    v0 = [bm.verts.new((x0, y, z)) for y, z in profile_yz]
    v1 = [bm.verts.new((x1, y, z)) for y, z in profile_yz]
    n = len(profile_yz)
    for k in range(n):
        m = (k + 1) % n
        bm.faces.new((v0[k], v0[m], v1[m], v1[k]))
    bm.faces.new(tuple(reversed(v0)))
    bm.faces.new(tuple(v1))
    return mesh_from_bm(name, bm, role, False, bev)


def text(name, body, loc, size, role, align='LEFT', extrude=0.00018, res=3):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = 'CENTER'
    cu.resolution_u = res
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = Vector(loc)
    obj.rotation_euler = (math.radians(90), 0, 0)   # +Z -> -Y, читается с фронта
    obj.data.materials.append(mat(role))
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
    return obj


# --- сборка --------------------------------------------------------------
def build_core():
    # цоколь-плитнус (тёмный) + корпус
    cube(PREFIX + 'plinth', (0.0, 0.003, 0.0040), (0.292, 0.052, 0.0080), 'dark', r=0.0016)
    cube(PREFIX + 'housing', (0.0, 0.003, 0.1040), (W, 0.054, 0.192), 'graphite', r=0.0050)

    # лицевая молочная рамка с окном под панель
    frame_plate(PREFIX + 'bezel', -BEZ_X, BEZ_X, BEZ_Z0, BEZ_Z1,
                -WIN_X, WIN_X, WIN_Z0, WIN_Z1, Y_BEZ0, Y_BODY0, 'body', 0.0014)
    # утопленная тёмная панель внутри окна (между лицевой рамкой и корпусом)
    cube(PREFIX + 'panel', (0.0, (Y_PANEL + Y_BODY0) * 0.5, (WIN_Z0 + WIN_Z1) * 0.5),
         (2 * WIN_X + 0.002, abs(Y_PANEL - Y_BODY0), WIN_Z1 - WIN_Z0 + 0.002),
         'dark', r=0.0010)

    # винты по углам рамки
    bm_h = bmesh.new()
    bm_s = bmesh.new()
    for x in (-0.1375, 0.1375):
        for z in (0.0190, 0.1810):
            bmesh.ops.create_cone(bm_h, cap_ends=True, cap_tris=False, segments=16,
                                  radius1=0.0038, radius2=0.0038, depth=0.0016,
                                  matrix=Matrix.Translation((x, Y_BEZ0 - 0.0006, z))
                                  @ Matrix.Rotation(math.pi / 2, 4, 'X'))
            bm_box(bm_s, (x, Y_BEZ0 - 0.0014, z), (0.0046, 0.0006, 0.0011))
    mesh_from_bm(PREFIX + 'bezel_screws', bm_h, 'steel', True)
    mesh_from_bm(PREFIX + 'bezel_slots', bm_s, 'dark', False)


def build_display():
    frame_plate(PREFIX + 'display_frame', DSP_X0, DSP_X1, DSP_Z0, DSP_Z1,
                DSP_IX0, DSP_IX1, DSP_IZ0, DSP_IZ1,
                Y_BEZ0 - 0.0005, Y_PANEL, 'graphite', 0.0010)
    cube(PREFIX + 'display_glass',
         ((DSP_IX0 + DSP_IX1) * 0.5, Y_GLASS + 0.0006, (DSP_IZ0 + DSP_IZ1) * 0.5),
         (DSP_IX1 - DSP_IX0 - 0.0006, 0.0012, DSP_IZ1 - DSP_IZ0 - 0.0006),
         'screen', r=0.0)

    y = Y_GLASS - 0.0004
    x0, x1 = DSP_IX0 + 0.0035, DSP_IX1 - 0.0035
    # строка заголовка
    bm = bmesh.new()
    bm_box(bm, ((x0 + x1) * 0.5, y, 0.1585), (x1 - x0, 0.0003, 0.0040))
    mesh_from_bm(PREFIX + 'screen_header', bm, 'cyan')

    # основная трасса сигнала (непрерывная линия по сегментам)
    ta, tb = x0, -0.032
    n = 46

    def wave(t, amp, freq, phase):
        return 0.1335 + amp * math.sin(t * freq + phase) \
            + 0.0032 * math.sin(t * freq * 2.7 + 0.4)

    bm = bmesh.new()
    pa = (ta, y, wave(0.0, 0.0125, 6.2, 0.2))
    for k in range(1, n + 1):
        t = k / n
        pb = (ta + (tb - ta) * t, y, wave(t, 0.0125, 6.2, 0.2))
        bm_seg(bm, pa, pb, 0.0003, 0.0012)
        pa = pb
    mesh_from_bm(PREFIX + 'screen_trace', bm, 'cyan')

    # вторая, приглушённая трасса
    bm = bmesh.new()
    pa = (ta, y, 0.1125 + 0.0032 * math.sin(1.1))
    for k in range(1, n + 1):
        t = k / n
        pb = (ta + (tb - ta) * t, y, 0.1125 + 0.0032 * math.sin(t * 4.4 + 1.1))
        bm_seg(bm, pa, pb, 0.0003, 0.0009)
        pa = pb
    mesh_from_bm(PREFIX + 'screen_trace_sub', bm, 'teal')

    # колонка показаний справа: подпись + значение
    bm = bmesh.new()
    bm_dim = bmesh.new()
    for k in range(4):
        z = 0.1500 - k * 0.0095
        bm_box(bm, (-0.0205, y, z), (0.0125, 0.0003, 0.0022))
        bm_box(bm_dim, (0.0005, y, z), (0.0250, 0.0003, 0.0022))
    bm_box(bm, ((x0 + x1) * 0.5, y, 0.1055), (x1 - x0, 0.0003, 0.0016))
    bm_box(bm_dim, (-0.0300, y, 0.1300), (0.0006, 0.0003, 0.0460))   # разделитель зон
    mesh_from_bm(PREFIX + 'screen_readouts', bm, 'cyan')
    mesh_from_bm(PREFIX + 'screen_rows_dim', bm_dim, 'teal')

    # маркировка под дисплеем не нужна — подпись в нижней полосе рамки


def build_channels():
    """16 клеммных каналов: молочные колодки + стальные винты + гнёзда."""
    bm_b = bmesh.new()
    bm_s = bmesh.new()
    bm_h = bmesh.new()
    for rz in CH_ROWS:
        for k in range(CH_N):
            x = CH_X0 + k * CH_PITCH
            bm_box(bm_b, (x, -0.0320, rz), (CH_W, 0.0050, CH_H))
            bmesh.ops.create_cone(bm_s, cap_ends=True, cap_tris=False, segments=14,
                                  radius1=0.0032, radius2=0.0032, depth=0.0015,
                                  matrix=Matrix.Translation((x, -0.0352, rz + 0.0012))
                                  @ Matrix.Rotation(math.pi / 2, 4, 'X'))
            bm_box(bm_h, (x, -0.0361, rz + 0.0012), (0.0044, 0.0005, 0.0010))
            # гнездо провода под колодкой
            bmesh.ops.create_cone(bm_h, cap_ends=True, cap_tris=False, segments=12,
                                  radius1=0.0015, radius2=0.0015, depth=0.0012,
                                  matrix=Matrix.Translation((x, -0.0349, rz - 0.0044))
                                  @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    mesh_from_bm(PREFIX + 'channel_blocks', bm_b, 'body', False, 0.0007)
    mesh_from_bm(PREFIX + 'channel_screws', bm_s, 'steel', True)
    mesh_from_bm(PREFIX + 'channel_holes', bm_h, 'dark', False)

    # разделительная планка между рядами + подпись каналов
    cube(PREFIX + 'channel_divider', (CH_X0 + CH_PITCH * (CH_N - 1) * 0.5,
                                      -0.0292, 0.0670),
         (CH_PITCH * CH_N - 0.0022, 0.0028, 0.0034), 'graphite', r=0.0006)
    text(PREFIX + 'mark_ch', 'CH 01-16', (-0.1225, Y_PANEL - 0.0004, 0.0905),
         0.0048, 'body')
    text(PREFIX + 'mark_ch_r', '8-32 CH', (0.0120, Y_PANEL - 0.0004, 0.0905),
         0.0040, 'steel', align='RIGHT')


def build_indicators():
    # колонка из 4 циановых индикаторов + подписи
    labels = ('PWR', 'LINK', 'LOG', 'EVT')
    for k, z in enumerate((0.1520, 0.1360, 0.1200, 0.1040)):
        cyl(PREFIX + 'led_ring_%d' % k, (0.0400, Y_PANEL, z),
            (0.0400, Y_PANEL - 0.0012, z), 0.0053, 'graphite', vertices=18)
        cyl(PREFIX + 'led_%d' % k, (0.0400, Y_PANEL - 0.0006, z),
            (0.0400, Y_PANEL - 0.0042, z), 0.0033, 'cyan', vertices=16)
        text(PREFIX + 'led_label_%d' % k, labels[k], (0.0485, Y_PANEL, z), 0.0036,
             'steel')

    # энкодер
    cyl(PREFIX + 'encoder_flange', (0.1000, Y_PANEL, 0.1400),
        (0.1000, Y_PANEL - 0.0022, 0.1400), 0.0175, 'graphite', vertices=34, bev=0.0008)
    cyl(PREFIX + 'encoder_knob', (0.1000, Y_PANEL - 0.0022, 0.1400),
        (0.1000, Y_KNOB + 0.0007, 0.1400), 0.0142, 'steel', vertices=32, bev=0.0022)
    torus(PREFIX + 'encoder_face', (0.1000, Y_KNOB + 0.0005, 0.1400),
          0.0108, 0.0010, 'dark', 'Y')
    cube(PREFIX + 'encoder_pointer', (0.1000, Y_KNOB + 0.0002, 0.1492),
         (0.0022, 0.0018, 0.0072), 'dark', r=0.0004)

    # кнопки
    for k, (x, cap) in enumerate(((0.0820, 'dark'), (0.1000, 'dark'), (0.1180, 'cyan'))):
        cyl(PREFIX + 'button_barrel_%d' % k, (x, Y_PANEL, 0.1080),
            (x, Y_PANEL - 0.0070, 0.1080), 0.0064, 'graphite', vertices=20)
        cyl(PREFIX + 'button_cap_%d' % k, (x, Y_PANEL - 0.0070, 0.1080),
            (x, Y_PANEL - 0.0090, 0.1080), 0.0053, 'steel', vertices=20, bev=0.0008)
        torus(PREFIX + 'button_mark_%d' % k, (x, Y_PANEL - 0.0092, 0.1080),
              0.0024, 0.0007, cap, 'Y')
    for k, (x, lbl) in enumerate(((0.0820, 'MODE'), (0.1000, 'SET'), (0.1180, 'RUN'))):
        text(PREFIX + 'button_label_%d' % k, lbl, (x, Y_PANEL, 0.0985), 0.0030,
             'steel', align='CENTER')


def build_ports():
    # 2 × RJ45 (утоплены в панель) + USB-C
    bm_body = bmesh.new()
    bm_cav = bmesh.new()
    bm_pin = bmesh.new()
    bm_clip = bmesh.new()
    for k, x in enumerate((0.0450, 0.0770)):
        bm_box(bm_body, (x, Y_PANEL - 0.0012, 0.0560), (0.0170, 0.0030, 0.0152))
        bm_box(bm_cav, (x, Y_PANEL - 0.0026, 0.0560), (0.0136, 0.0036, 0.0116))
        for p in range(8):
            px = x - 0.0056 + p * 0.0016
            bm_box(bm_pin, (px, Y_PANEL - 0.0040, 0.0606), (0.0008, 0.0012, 0.0040))
        bm_box(bm_clip, (x, Y_PANEL - 0.0014, 0.0638), (0.0080, 0.0022, 0.0016))
    mesh_from_bm(PREFIX + 'eth_frames', bm_body, 'steel', False, 0.0006)
    mesh_from_bm(PREFIX + 'eth_cavities', bm_cav, 'dark')
    mesh_from_bm(PREFIX + 'eth_pins', bm_pin, 'copper')
    mesh_from_bm(PREFIX + 'eth_clips', bm_clip, 'steel')

    # USB-C
    cube(PREFIX + 'usbc_frame', (0.1080, Y_PANEL - 0.0012, 0.0560),
         (0.0104, 0.0028, 0.0050), 'steel', r=0.0016)
    cube(PREFIX + 'usbc_slot', (0.1080, Y_PANEL - 0.0026, 0.0560),
         (0.0076, 0.0022, 0.0028), 'dark', r=0.0012)

    for x, lbl in ((0.0450, 'ETH 1'), (0.0770, 'ETH 2'), (0.1080, 'USB-C')):
        text(PREFIX + 'port_label_%s' % lbl.replace(' ', '').replace('-', ''),
             lbl, (x, Y_PANEL, 0.0455), 0.0032, 'steel', align='CENTER')

    # переключатель питания рядом с портами
    cube(PREFIX + 'power_switch', (0.1080, Y_PANEL - 0.0016, 0.0725),
         (0.0120, 0.0044, 0.0090), 'graphite', r=0.0012)
    cube(PREFIX + 'power_switch_rocker', (0.1080, Y_PANEL - 0.0038, 0.0725),
         (0.0088, 0.0016, 0.0062), 'dark', r=0.0006)


def build_vents():
    # верхняя решётка (тёмные ламели вровень с верхней плоскостью)
    bm = bmesh.new()
    for k in range(9):
        bm_box(bm, (-0.1050 + k * 0.0115, 0.0060, 0.1983), (0.0055, 0.0440, 0.0038))
    mesh_from_bm(PREFIX + 'vent_top', bm, 'dark')

    # боковые прорези: две группы по три щели
    for tag, sx in (('l', -1.0), ('r', 1.0)):
        bm = bmesh.new()
        for base in (0.0560, 0.1260):
            for k in range(3):
                bm_box(bm, (sx * 0.1486, 0.0040, base + k * 0.0080),
                       (0.0032, 0.0300, 0.0034))
        mesh_from_bm(PREFIX + 'vent_side_%s' % tag, bm, 'dark')

    # прорези в цоколе (фронтальная полоса)
    bm = bmesh.new()
    for k in range(7):
        bm_box(bm, (-0.0450 + k * 0.0150, -0.0236, 0.0042), (0.0090, 0.0018, 0.0034))
    mesh_from_bm(PREFIX + 'vent_bottom', bm, 'dark')


def build_mount():
    # DIN-рейка 35 мм: профиль-шляпа на задней стенке
    prof = [(0.0300, 0.0790), (0.0335, 0.0790), (0.0335, 0.0850),
            (0.0370, 0.0886), (0.0370, 0.1114), (0.0335, 0.1150),
            (0.0335, 0.1210), (0.0300, 0.1210)]
    extrude_profile(PREFIX + 'din_rail', prof, -0.1400, 0.1400, 'steel', 0.0004)
    for tag, x in (('l', -0.1325), ('r', 0.1325)):
        cube(PREFIX + 'din_clip_%s' % tag, (x, 0.0338, 0.1000),
             (0.0090, 0.0090, 0.0430), 'graphite', r=0.0010)

    # задние монтажные винты по углам
    bm = bmesh.new()
    for x in (-0.1280, 0.1280):
        for z in (0.0300, 0.1700):
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16,
                                  radius1=0.0050, radius2=0.0050, depth=0.0032,
                                  matrix=Matrix.Translation((x, Y_BODY1 - 0.0008, z))
                                  @ Matrix.Rotation(math.pi / 2, 4, 'X'))
    mesh_from_bm(PREFIX + 'back_screws', bm, 'steel', True)


def build_cable():
    # кабельный ввод снизу-сзади, гофра вниз, концевая муфта
    cyl(PREFIX + 'gland', (0.0950, Y_BODY1 - 0.0010, 0.0180),
        (0.0950, 0.0340, 0.0180), 0.0068, 'graphite', vertices=20, bev=0.0010)
    torus(PREFIX + 'gland_ring', (0.0950, 0.0335, 0.0180), 0.0062, 0.0012,
          'steel', 'Y')
    curve_tube(PREFIX + 'cable',
               [(0.0950, 0.0340, 0.0180),
                (0.0954, 0.0374, 0.0136),
                (0.0962, 0.0386, 0.0088),
                (0.0972, 0.0362, 0.0052)], 0.0032, 'dark')
    cyl(PREFIX + 'cable_boot', (0.0972, 0.0344, 0.0052),
        (0.0972, 0.0382, 0.0052), 0.0042, 'graphite', vertices=16, bev=0.0012)


def build_markings():
    y = Y_BEZ0 - 0.0002
    text(PREFIX + 'mark_model', 'CTL-TEL-02', (-0.1290, y, 0.0155), 0.0092, 'graphite')
    text(PREFIX + 'mark_spec', 'TELEMETRY  /  12 V DC  /  ETH USB-C',
         (0.1290, y, 0.0155), 0.0048, 'graphite', align='RIGHT')
    text(PREFIX + 'mark_top', 'SESSION LOGGER  /  16 CH TERMINAL',
         (-0.1290, y, 0.1825), 0.0046, 'graphite')
    text(PREFIX + 'mark_top_r', 'ISO 12V', (0.1290, y, 0.1825), 0.0046,
         'graphite', align='RIGHT')
    # подпись выключателя питания
    text(PREFIX + 'mark_pwr', 'PWR', (0.0990, Y_PANEL - 0.0004, 0.0725), 0.0032,
         'steel', align='RIGHT')


def build():
    reset()
    build_core()
    build_display()
    build_channels()
    build_indicators()
    build_ports()
    build_vents()
    build_mount()
    build_cable()
    build_markings()
    bpy.context.view_layer.update()
    return [o for o in bpy.data.objects if o.name.startswith(PREFIX)]


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


def check():
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    short = {o.name[len(PREFIX):] for o in objs}

    # паспорт: 0.30 (X) × 0.20 (Z) × 0.08 (Y)
    dev = (size.x - W, size.z - H, size.y - D)
    bbox_ok = (abs(dev[0]) <= 0.004 and abs(dev[1]) <= 0.004 and abs(dev[2]) <= 0.006)

    rep = {
        'component': CID,
        'nodes': len(objs),
        'meshes': len(meshes),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_roles': sorted(MATS),
        'materials_ok': bool(len(bpy.data.materials) >= 4),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'spec_size_xzy': [W, H, D],
        'spec_dev': [round(v, 5) for v in dev],
        'bbox_ok': bool(bbox_ok),
        'stands_on_floor': bool(abs(mn.z) <= 0.0015),
        'front_faces_neg_y': bool(mn.y < -0.030 and mx.y > 0.030),
        'channels': 2 * CH_N,
        'channels_ok': bool(8 <= 2 * CH_N <= 32),
        'eth_ports': 2,
        'usbc_ports': 1,
        'leds': len([n for n in short if n.startswith('led_') and n[4:].isdigit()]),
        'has_screen': bool({'display_frame', 'display_glass', 'screen_trace'} <= short),
        'has_terminals': bool({'channel_blocks', 'channel_screws'} <= short),
        'has_ports': bool({'eth_frames', 'eth_cavities', 'usbc_frame'} <= short),
        'has_mount': bool({'din_rail', 'din_clip_l', 'din_clip_r'} <= short),
        'has_vents': bool({'vent_top', 'vent_side_l', 'vent_side_r'} <= short),
        'has_cable': bool({'cable', 'gland', 'cable_boot'} <= short),
        'has_markings': bool({'mark_model', 'mark_ch', 'mark_top'} <= short),
        'has_buttons': bool({'button_cap_0', 'encoder_knob'} <= short),
        'plate_like': sorted(n for n in short if 'plate' in n and n != 'label_plate'),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'names': sorted(short),
    }
    return rep


def export():
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = OUT / ('%s.glb' % CID)
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError('export too small: %s' % path)
    return path


def main():
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    ok = (rep['bbox_ok'] and rep['materials_ok'] and rep['channels_ok']
          and rep['has_screen'] and rep['has_terminals'] and rep['has_ports']
          and rep['has_mount'] and rep['has_vents'] and rep['has_cable']
          and rep['has_markings'] and rep['has_buttons']
          and rep['stands_on_floor'] and not rep['bad_names'])
    if not ok:
        raise SystemExit('checks failed')


main()
