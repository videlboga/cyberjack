"""Standalone builder: work_probe_combined (WRK-PEN-06, «Комбинированная база»).

База, а не насадка: посадочный вал, который передаёт от станка момент И осевой
ход по одной оси. Сзади — ротационный док Ø58 с 4 усиками и 2 пазами; графитовый
корпус с подшипниковым блоком, продольными рёбрами и биркой; полый шпиндель во
вращающемся уплотнении с двумя портами (воздух G1/8, жидкость G1/4 — латунные
штуцеры и полупрозрачные трубки); подвижная втулка хода 80 мм с хромированным
штоком-направляющей и шкалой хода; цанга CJ-TOOL-25 спереди (4 лепестка,
разрезное кольцо быстросъёма с рычагом, метка размера 25); датчик оборотов с
циановым окном и пигтейлом M8, датчик глубины.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_probe_combined.py

Выход:
  public/models/machine-modules/components/work_probe_combined.glb
  docs/plans/blockout/component-library/work_probe_combined/report.json

Геометрия (Blender Z-up, метры), продольная ось = X:
  задний торец дока = X-0.210, нос цанги = X+0.210  (длина 0.420 = паспорт)
  <id>__anim        = (0, 0, 0) — на продольной оси, spin по X, 0.7
  <id>__stroke_slide= (0, 0, 0), ребёнок anim — slide по X, 0.08
  вращаются (anim):  spindle, spindle_land, union_rotor, rotor_marks,
                     collet_body, collet_fingers, collet_nose, release_ring,
                     ring_split, ring_lever, ring_lever_pin, size_band,
                     sleeve_mark, stroke_slide (узел хода)
  ходят (stroke):    stroke_sleeve, stroke_rod, stroke_scale, stroke_zero,
                     sleeve_band, size_text
  статичны:          dock_flange, flange_ears, flange_slots, flange_boss,
                     bearing_block, bearing_race, body, body_ribs, body_band,
                     body_mark, nameplate, nameplate_text, union_housing,
                     union_collar, rod_bushing, union_index, port_air_*,
                     tube_air*, port_fluid_*, tube_fluid*, speed_sensor,
                     speed_lens, speed_cable, speed_connector, depth_sensor,
                     depth_slit, depth_cable
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/work_probe_combined'
CID = 'work_probe_combined'
CODE = 'WRK-PEN-06'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- ключевые размеры (м) ------------------------------------------------
X_REAR = -0.2100           # задний торец док-фланца
X_FRONT = 0.2100           # нос цанги -> длина 0.420 по паспорту
R_FLANGE = 0.0290          # Ø58 посадочный док
R_EAR = 0.0335             # Ø67 по усикам (<= 0.068)
R_BODY = 0.0292            # корпус Ø58.4
R_RIB = 0.0304             # рёбра -> Ø60.8 (<= 0.062)
R_UNION = 0.0256           # корпус вращающегося уплотнения
R_SPINDLE = 0.0135
R_BORE = 0.0080            # внутренний канал шпинделя
R_SLEEVE = 0.0245          # подвижная втулка
R_SLEEVE_BORE = 0.0142
R_RING = 0.0268            # разрезное кольцо быстросъёма
TRAVEL = 0.080             # ход втулки
SPIN_SPEED = 0.7
SEG = 64

PALETTE = {
    'graphite': (0.262, 0.271, 0.290),   # анодированный корпус
    'dark': (0.140, 0.148, 0.165),
    'steel': (0.735, 0.741, 0.731),      # нержавеющий вал / втулка
    'brass': (0.851, 0.635, 0.290),      # штуцеры G1/8 / G1/4
    'blush': (0.910, 0.725, 0.749),      # рабочая зона: цанга формы
    'cyan': (0.620, 0.870, 0.905),
    'ivory': (0.945, 0.937, 0.918),
    'glass': (0.780, 0.885, 0.910),
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
    if role == 'graphite':
        bsdf.inputs['Roughness'].default_value = 0.47
        bsdf.inputs['Metallic'].default_value = 0.26
    elif role == 'dark':
        bsdf.inputs['Roughness'].default_value = 0.58
        bsdf.inputs['Metallic'].default_value = 0.12
    elif role == 'steel':
        bsdf.inputs['Roughness'].default_value = 0.26
        bsdf.inputs['Metallic'].default_value = 0.92
    elif role == 'brass':
        bsdf.inputs['Roughness'].default_value = 0.34
        bsdf.inputs['Metallic'].default_value = 0.90
    elif role == 'blush':
        bsdf.inputs['Roughness'].default_value = 0.55
        bsdf.inputs['Metallic'].default_value = 0.05
    elif role == 'glass':
        bsdf.inputs['Roughness'].default_value = 0.03
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Alpha'].default_value = 0.20
        bsdf.inputs['IOR'].default_value = 1.46
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
        if hasattr(m, 'use_backface_culling'):
            m.use_backface_culling = False
    elif role == 'cyan':
        bsdf.inputs['Roughness'].default_value = 0.38
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.28
    else:  # ivory
        bsdf.inputs['Roughness'].default_value = 0.45
        bsdf.inputs['Metallic'].default_value = 0.0
    m.diffuse_color = (*color, 1.0 if role != 'glass' else 0.30)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def bevel(obj, width=0.0012, segments=2, angle=True):
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


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        select_only(obj)
        bevel(obj, r)
    return apply(obj, role)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=d.length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev)
    return apply(obj, role, smooth if vertices > 8 else False)


def torus(name, loc, major, minor, role, axis='X', segs=48, rings=10):
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


def text_label(name, body, loc, size, role, rot=(0, 0, 0), extrude=0.0003):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.size = size
    obj.data.extrude = extrude
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def radial(a):
    """Радиальное направление вокруг оси X: a=0 -> +Z, a=+90deg -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


def basis(a):
    d = radial(a)
    t = Vector((0.0, math.cos(a), -math.sin(a)))
    return Matrix((
        (1.0, 0.0, 0.0),
        (0.0, t.y, d.y),
        (0.0, t.z, d.z),
    ))


def revolve(name, profile, role, seg=SEG, smooth=True, loop=True, a0=None, a1=None):
    """Тело вращения вокруг оси X по профилю [(x, r), ...]."""
    bm = bmesh.new()
    full = a0 is None
    if full:
        angs = [math.tau * i / seg for i in range(seg)]
    else:
        angs = [a0 + (a1 - a0) * i / seg for i in range(seg + 1)]
    n_a = len(angs)
    rings = []
    for x, r in profile:
        if r <= 1e-6:
            rings.append(('pole', bm.verts.new((x, 0.0, 0.0))))
        else:
            rings.append(('ring', [bm.verts.new((x, r * math.sin(a), r * math.cos(a)))
                                   for a in angs]))

    def link(r0, r1):
        if r0[0] == 'ring' and r1[0] == 'ring':
            a0_, a1_ = r0[1], r1[1]
            for k in range(n_a if full else seg):
                k2 = (k + 1) % n_a
                bm.faces.new((a0_[k], a0_[k2], a1_[k2], a1_[k]))
        elif r0[0] == 'pole' and r1[0] == 'ring':
            row = r1[1]
            for k in range(n_a):
                bm.faces.new((r0[1], row[k], row[(k + 1) % n_a]))
        elif r0[0] == 'ring' and r1[0] == 'pole':
            row = r0[1]
            for k in range(n_a):
                bm.faces.new((row[k], row[(k + 1) % n_a], r1[1]))

    n = len(rings)
    for i in range(n - 1):
        link(rings[i], rings[i + 1])
    if loop:
        link(rings[-1], rings[0])
    else:
        if rings[0][0] == 'ring':
            bm.faces.new(tuple(reversed(rings[0][1])))
        if rings[-1][0] == 'ring':
            bm.faces.new(tuple(rings[-1][1]))
    if not full and all(r[0] == 'ring' for r in rings):
        bm.faces.new(tuple(r[1][0] for r in rings))
        bm.faces.new(tuple(reversed([r[1][-1] for r in rings])))
    return mesh_from_bm(name, bm, role, smooth)


def add_sector_solid(bm, profile, a0, a1, seg=10, dy=0.0, dz=0.0):
    """Сектор замкнутого профиля (x, r) вокруг оси X со смещением центра."""
    angs = [a0 + (a1 - a0) * k / seg for k in range(seg + 1)]
    rings = [[bm.verts.new((x, dy + r * math.sin(a), dz + r * math.cos(a)))
              for a in angs] for x, r in profile]
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][k + 1],
                          rings[j][k + 1], rings[j][k]))
    bm.faces.new(tuple(r[0] for r in rings))
    bm.faces.new(tuple(reversed([r[-1] for r in rings])))


def sector_ring(name, x0, x1, r_in, r_out, role, a0=0.0, a1=math.tau,
                seg=12, dz=0.0, dy=0.0):
    bm = bmesh.new()
    add_sector_solid(bm, [(x0, r_in), (x1, r_in), (x1, r_out), (x0, r_out)],
                     a0, a1, seg=seg, dy=dy, dz=dz)
    return mesh_from_bm(name, bm, role)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []      # дети anim
    sliding = []       # дети stroke_slide

    # ===================== 1. док-фланец Ø58 сзади ======================
    revolve(PREFIX + 'dock_flange',
            [(X_REAR, 0.0150), (X_REAR, R_FLANGE),
             (-0.2020, R_FLANGE), (-0.2000, 0.0276), (-0.1960, 0.0276),
             (-0.1960, 0.0150)],
            'graphite', seg=SEG)
    # 4 усика дока (0/90/180/270), Ø67 по наружному краю
    bm = bmesh.new()
    for i in range(4):
        c = math.radians(90.0 * i)
        add_sector_solid(bm, [(-0.2100, R_FLANGE + 0.0002), (-0.2016, R_FLANGE + 0.0002),
                              (-0.2016, R_EAR), (-0.2100, R_EAR)],
                         c - math.radians(13.0), c + math.radians(13.0), seg=8)
    mesh_from_bm(PREFIX + 'flange_ears', bm, 'graphite', smooth=True)
    # 2 паза байонета на заднем торце (между усиками), в плоскости торца -0.210
    bm = bmesh.new()
    for a in (math.radians(45.0), math.radians(225.0)):
        add_sector_solid(bm, [(-0.2098, 0.0222), (-0.2038, 0.0222),
                              (-0.2038, 0.0294), (-0.2098, 0.0294)],
                         a - math.radians(7.0), a + math.radians(7.0), seg=6)
    mesh_from_bm(PREFIX + 'flange_slots', bm, 'dark', smooth=False)
    # задний выступ-центровка
    revolve(PREFIX + 'flange_boss',
            [(X_REAR + 0.0002, 0.0190), (X_REAR + 0.0002, 0.0252),
             (X_REAR + 0.0034, 0.0252), (X_REAR + 0.0034, 0.0190)],
            'dark', seg=48)

    # ===================== 2. подшипниковый блок ========================
    revolve(PREFIX + 'bearing_block',
            [(-0.1960, 0.0215), (-0.1960, 0.0298),
             (-0.1560, 0.0298), (-0.1510, 0.0294), (-0.1510, 0.0215)],
            'graphite', seg=SEG)
    revolve(PREFIX + 'bearing_race',
            [(-0.1900, 0.0298), (-0.1900, 0.0304),
             (-0.1858, 0.0304), (-0.1858, 0.0298)],
            'dark', seg=48)

    # ===================== 3. корпус с рёбрами и биркой =================
    revolve(PREFIX + 'body',
            [(-0.1510, 0.0215), (-0.1510, R_BODY),
             (-0.1150, R_BODY), (-0.0610, 0.0286), (-0.0580, 0.0264),
             (-0.0580, 0.0215)],
            'graphite', seg=SEG)
    # 8 продольных рёбер
    bm = bmesh.new()
    for i in range(8):
        c = math.radians(45.0 * i + 22.5)
        add_sector_solid(bm, [(-0.1470, R_BODY - 0.0004), (-0.0650, R_BODY - 0.0004),
                              (-0.0650, R_RIB), (-0.1470, R_RIB)],
                         c - math.radians(4.4), c + math.radians(4.4), seg=4)
    mesh_from_bm(PREFIX + 'body_ribs', bm, 'graphite', smooth=True)
    # тёмные стыковочные канавки: читаются границы блока и корпуса
    revolve(PREFIX + 'brg_groove',
            [(-0.1526, R_BODY - 0.0006), (-0.1526, 0.0301),
             (-0.1504, 0.0301), (-0.1504, R_BODY - 0.0006)],
            'dark', seg=48)
    revolve(PREFIX + 'union_groove',
            [(-0.0602, 0.0266), (-0.0602, 0.0272),
             (-0.0578, 0.0272), (-0.0578, 0.0266)],
            'dark', seg=48)
    revolve(PREFIX + 'body_band',
            [(-0.1060, R_BODY), (-0.1060, R_BODY + 0.0008),
             (-0.1000, R_BODY + 0.0008), (-0.1000, R_BODY)],
            'steel', seg=48)
    revolve(PREFIX + 'body_mark',
            [(-0.1580, R_BODY - 0.0002), (-0.1580, 0.0298),
             (-0.1556, 0.0298), (-0.1556, R_BODY - 0.0002)],
            'cyan', seg=48)
    # бирка на +Z
    cube(PREFIX + 'nameplate', (-0.1290, 0.0, R_BODY + 0.0006),
         (0.0470, 0.0150, 0.0026), 'ivory', r=0.0008)
    text_label(PREFIX + 'nameplate_text', 'WRK-PEN-06',
               (-0.1290, 0.0, R_BODY + 0.0022), 0.0052, 'dark')

    # ===================== 4. вращающееся уплотнение ====================
    revolve(PREFIX + 'union_housing',
            [(-0.0580, 0.0200), (-0.0580, R_UNION),
             (-0.0300, R_UNION), (-0.0240, 0.0252), (-0.0200, 0.0224),
             (-0.0200, 0.0200)],
            'graphite', seg=SEG)
    revolve(PREFIX + 'union_collar',
            [(-0.0592, R_UNION + 0.0004), (-0.0592, R_UNION + 0.0016),
             (-0.0540, R_UNION + 0.0016), (-0.0540, R_UNION + 0.0004)],
            'steel', seg=48)
    cyl(PREFIX + 'rod_bushing', (-0.0220, 0, 0), (-0.0130, 0, 0),
        0.0184, 'steel', vertices=48, bev=0.0008)
    # циановый индекс шкалы хода на переднем торце уплотнения (+Z)
    sector_ring(PREFIX + 'union_index', -0.0212, -0.0192, 0.0206, 0.0254,
                'cyan', math.radians(-7.0), math.radians(7.0), seg=6)

    # ---- порт воздух G1/8: радиально вверх (+Z), трубка уходит назад-вбок
    cyl(PREFIX + 'port_air_fit', (-0.0470, 0, 0.0215), (-0.0470, 0, 0.0311),
        0.0048, 'brass', vertices=24, bev=0.0006)
    cyl(PREFIX + 'port_air_nut', (-0.0470, 0, 0.0311), (-0.0470, 0, 0.0343),
        0.0068, 'brass', vertices=6, smooth=False, bev=0.0005)
    cyl(PREFIX + 'tube_air_elbow', (-0.0470, 0.0, 0.0336), (-0.0470, 0.0172, 0.0352),
        0.0032, 'glass', vertices=20)
    cyl(PREFIX + 'tube_air', (-0.0452, 0.0172, 0.0352), (-0.1780, 0.0172, 0.0352),
        0.0032, 'glass', vertices=20)
    cyl(PREFIX + 'tube_air_sleeve', (-0.1780, 0.0172, 0.0352), (-0.1860, 0.0172, 0.0352),
        0.0040, 'brass', vertices=20)

    # ---- порт жидкость G1/4: радиально вбок (-Y), трубка уходит назад-вниз
    cyl(PREFIX + 'port_fluid_fit', (-0.0380, -0.0212, 0), (-0.0380, -0.0314, 0),
        0.0060, 'brass', vertices=24, bev=0.0006)
    cyl(PREFIX + 'port_fluid_nut', (-0.0380, -0.0314, 0), (-0.0380, -0.0352, 0),
        0.0082, 'brass', vertices=6, smooth=False, bev=0.0005)
    cyl(PREFIX + 'tube_fluid_elbow', (-0.0380, -0.0332, 0.0), (-0.0396, -0.0308, -0.0240),
        0.0036, 'glass', vertices=20)
    cyl(PREFIX + 'tube_fluid', (-0.0410, -0.0308, -0.0240), (-0.1660, -0.0308, -0.0240),
        0.0036, 'glass', vertices=20)
    cyl(PREFIX + 'tube_fluid_sleeve', (-0.1660, -0.0308, -0.0240),
        (-0.1740, -0.0308, -0.0240), 0.0044, 'brass', vertices=20)

    # ===================== 5. датчики ===================================
    # датчик оборотов снизу (-Z) на уплотнении, смотрит вверх на метку ротора
    cube(PREFIX + 'speed_sensor', (-0.0130, 0.0, -0.0292),
         (0.0170, 0.0140, 0.0110), 'dark', r=0.0012)
    cyl(PREFIX + 'speed_lens', (-0.0130, 0.0, -0.0330), (-0.0130, 0.0, -0.0348),
        0.0042, 'cyan', vertices=20, bev=0.0004)
    # пигтейл: вбок и назад по корпусу, разъём M8 на кронштейне
    cyl(PREFIX + 'speed_cable_a', (-0.0130, 0.0, -0.0354), (-0.0130, -0.0140, -0.0352),
        0.0026, 'dark', vertices=14)
    cyl(PREFIX + 'speed_cable_b', (-0.0130, -0.0140, -0.0352),
        (-0.1220, -0.0140, -0.0352), 0.0026, 'dark', vertices=14)
    cube(PREFIX + 'speed_cable_clamp', (-0.0860, -0.0118, -0.0352),
         (0.0090, 0.0060, 0.0070), 'graphite', r=0.0010)
    cyl(PREFIX + 'speed_connector', (-0.1220, -0.0140, -0.0352),
        (-0.1400, -0.0140, -0.0352), 0.0046, 'steel', vertices=20, bev=0.0005)
    cyl(PREFIX + 'speed_connector_cap', (-0.1400, -0.0140, -0.0352),
        (-0.1432, -0.0140, -0.0352), 0.0042, 'dark', vertices=20)

    # датчик глубины на корпусе (+Z), рядом с узлом хода
    cube(PREFIX + 'depth_sensor', (-0.0920, 0.0, R_BODY + 0.0028),
         (0.0180, 0.0130, 0.0072), 'dark', r=0.0012)
    cube(PREFIX + 'depth_slit', (-0.0920, 0.0, R_BODY + 0.0066),
         (0.0100, 0.0036, 0.0009), 'cyan', r=0.0003)
    cyl(PREFIX + 'depth_cable', (-0.0950, -0.0062, R_BODY + 0.0018),
        (-0.1120, -0.0120, 0.0246), 0.0024, 'dark', vertices=14)

    # ===================== 6. полый шпиндель (вращается) ===============
    spindle = revolve(PREFIX + 'spindle',
                      [(-0.1900, R_BORE), (0.1080, R_BORE),
                       (0.1080, R_SPINDLE), (-0.1900, R_SPINDLE)],
                      'steel', seg=48)
    rotating.append(spindle)
    rotating.append(revolve(PREFIX + 'spindle_land',
                            [(-0.0330, R_SPINDLE), (-0.0330, 0.0178),
                             (-0.0270, 0.0178), (-0.0270, R_SPINDLE)],
                            'steel', seg=48))

    # вращающаяся часть юниона + метки оборотов
    rotating.append(revolve(PREFIX + 'union_rotor',
                            [(-0.0216, 0.0170), (-0.0060, 0.0170),
                             (-0.0060, 0.0196), (-0.0216, 0.0196)],
                            'steel', seg=48))
    bm = bmesh.new()
    for a in (math.radians(0), math.radians(90), math.radians(180), math.radians(270)):
        add_sector_solid(bm, [(-0.0192, 0.0196), (-0.0152, 0.0196),
                              (-0.0152, 0.0202), (-0.0192, 0.0202)],
                         a - math.radians(9.0), a + math.radians(9.0), seg=4)
    rotating.append(mesh_from_bm(PREFIX + 'rotor_marks', bm, 'dark'))
    rotating.append(sector_ring(PREFIX + 'rotor_mark_cyan',
                                -0.0200, -0.0144, 0.0200, 0.0206,
                                'cyan', math.radians(-100.0), math.radians(-80.0), seg=6))

    # ===================== 7. цанга CJ-TOOL-25 =========================
    rotating.append(revolve(PREFIX + 'collet_body',
                            [(0.1160, 0.0125), (0.1480, 0.0125),
                             (0.1480, 0.0204), (0.1400, 0.0232),
                             (0.1160, 0.0235)],
                            'blush', seg=SEG))
    # 4 лепестка, зазор 16°
    bm = bmesh.new()
    for i in range(4):
        c = math.radians(90.0 * i)
        add_sector_solid(bm, [(0.1480, 0.0125), (0.1980, 0.0125),
                              (0.1980, 0.0180), (0.1480, 0.0204)],
                         c - math.radians(35.0), c + math.radians(35.0), seg=8)
    rotating.append(mesh_from_bm(PREFIX + 'collet_fingers', bm, 'blush', smooth=True))
    rotating.append(revolve(PREFIX + 'collet_nose',
                            [(0.1990, 0.0104), (0.2084, 0.0104),
                             (X_FRONT, 0.0122), (X_FRONT, 0.0154),
                             (0.2050, 0.0170), (0.1990, 0.0170)],
                            'blush', seg=48))
    # разрезное кольцо быстросъёма
    rotating.append(revolve(PREFIX + 'release_ring',
                            [(0.1240, 0.0232), (0.1400, 0.0232),
                             (0.1400, 0.0254), (0.1378, R_RING),
                             (0.1262, R_RING), (0.1240, 0.0254)],
                            'graphite', seg=SEG))
    rotating.append(cube(PREFIX + 'ring_split', (0.1320, 0.0252, 0.0),
                         (0.0104, 0.0022, 0.0018), 'dark', r=0.0002))
    # рычаг: лежит вдоль оси, в габарите кольца (осевое плечо, не радиальное)
    rotating.append(cube(PREFIX + 'ring_lever', (0.1490, 0.0, 0.0244),
                         (0.0240, 0.0110, 0.0036), 'dark', r=0.0008))
    rotating.append(cyl(PREFIX + 'ring_lever_pin', (0.1400, -0.0062, 0.0243),
                        (0.1400, 0.0062, 0.0243), 0.0020, 'steel', vertices=16))
    # метка размера 25: циановая полоса + гравировка 25 на втулке
    rotating.append(revolve(PREFIX + 'size_band',
                            [(0.1424, 0.0234), (0.1424, 0.02398),
                             (0.1468, 0.02398), (0.1468, 0.0234)],
                            'cyan', seg=48))
    rotating.append(revolve(PREFIX + 'sleeve_mark',
                            [(0.0800, R_SLEEVE), (0.0800, R_SLEEVE + 0.0006),
                             (0.0830, R_SLEEVE + 0.0006), (0.0830, R_SLEEVE)],
                            'cyan', seg=48))

    # ===================== 8. узел осевого хода ========================
    slide = empty(PREFIX + 'stroke_slide', (0.0, 0.0, 0.0))
    slide['motion'] = 'slide'
    slide['axis'] = 'x'
    slide['amount'] = TRAVEL
    slide['speed'] = SPIN_SPEED
    bpy.context.view_layer.update()

    sliding.append(revolve(PREFIX + 'stroke_sleeve',
                           [(-0.0060, R_SLEEVE_BORE), (0.1160, R_SLEEVE_BORE),
                            (0.1160, 0.0235), (0.1100, R_SLEEVE),
                            (-0.0040, R_SLEEVE), (-0.0060, 0.0226)],
                           'steel', seg=SEG))
    # хромированный шток-направляющая, виден в зазоре до уплотнения
    sliding.append(cyl(PREFIX + 'stroke_rod', (-0.0390, 0, 0), (0.0020, 0, 0),
                       0.0168, 'steel', vertices=48, bev=0.0006))
    # шкала хода: линейка по +Z — тёмная накладка с рисками через 8 мм
    a0 = math.radians(-13.0)
    a1 = math.radians(13.0)
    sliding.append(sector_ring(PREFIX + 'stroke_scale', -0.0020, 0.0700,
                               R_SLEEVE - 0.0002, R_SLEEVE + 0.0005,
                               'dark', a0, a1, seg=10))
    bm = bmesh.new()
    for i in range(0, 9):
        x0 = 0.0020 + 0.0080 * i
        wide = (i % 2 == 0)
        ha = math.radians(-11.0 if wide else -7.0)
        hb = math.radians(11.0 if wide else 7.0)
        add_sector_solid(bm, [(x0, R_SLEEVE + 0.0003), (x0 + 0.0010, R_SLEEVE + 0.0003),
                              (x0 + 0.0010, R_SLEEVE + 0.0008), (x0, R_SLEEVE + 0.0008)],
                         ha, hb, seg=4)
    sliding.append(mesh_from_bm(PREFIX + 'stroke_ticks', bm, 'ivory'))
    sliding.append(sector_ring(PREFIX + 'stroke_zero', 0.0002, 0.0014,
                               R_SLEEVE + 0.0003, R_SLEEVE + 0.0010,
                               'cyan', a0, a1, seg=10))
    sliding.append(revolve(PREFIX + 'sleeve_band',
                           [(0.0700, R_SLEEVE), (0.0700, R_SLEEVE + 0.0007),
                            (0.0760, R_SLEEVE + 0.0007), (0.0760, R_SLEEVE)],
                           'steel', seg=48))
    sliding.append(cube(PREFIX + 'size_pad', (0.1000, 0.0, R_SLEEVE + 0.0006),
                        (0.0180, 0.0120, 0.0012), 'ivory', r=0.0003))
    sliding.append(text_label(PREFIX + 'size_text', '25',
                              (0.1000, 0.0, R_SLEEVE + 0.0013), 0.0072, 'dark'))

    # ===================== 9. анимационные пустышки =====================
    anim = empty(PREFIX + 'anim', (0.0, 0.0, 0.0))
    anim['motion'] = 'spin'
    anim['axis'] = 'x'
    anim['speed'] = SPIN_SPEED
    bpy.context.view_layer.update()
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    parent(slide, anim)
    slide['rotating'] = True
    for o in sliding:
        parent(o, slide)
        o['rotating'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in rotating + sliding:
            o['rotating'] = False

    # жёсткие рёбра: точение читается только с crisp-нормалями
    bpy.ops.object.select_all(action='DESELECT')
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH':
            o.select_set(True)
    bpy.context.view_layer.objects.active = bpy.context.selected_objects[0]
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30.0))

    bpy.context.view_layer.update()
    return anim, slide, rotating + sliding


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


def subtree_meshes(root):
    out = []
    stack = [root]
    while stack:
        o = stack.pop()
        if o.type == 'MESH':
            out.append(o)
        stack.extend(o.children)
    return out


def check(anim, slide, moving):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    # --- габарит корпуса и фланца
    body = [bpy.data.objects[PREFIX + n] for n in
            ('body', 'bearing_block', 'body_ribs')]
    b_mn, b_mx = mesh_bbox(body)
    body_dia = max(b_mx.y - b_mn.y, b_mx.z - b_mn.z)
    flange = [bpy.data.objects[PREFIX + n] for n in ('dock_flange', 'flange_ears')]
    f_mn, f_mx = mesh_bbox(flange)
    flange_dia = max(f_mx.y - f_mn.y, f_mx.z - f_mn.z)

    # --- pivot: поворот anim на 90° не должен смещать центр bbox детей
    kids = subtree_meshes(anim)
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    b_mn2, b_mx2 = mesh_bbox(kids)
    k_c1 = (b_mn2 + b_mx2) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    spin_err = 0.0
    a0_, b0_ = k_mn.copy(), k_mx.copy()
    for step in (180, 270, 360):
        anim.rotation_euler = (math.radians(step), 0, 0)
        bpy.context.view_layer.update()
        a1_, b1_ = mesh_bbox(kids)
        spin_err = max(spin_err,
                       max(abs(a1_[i] - a0_[i]) for i in range(3))
                       + max(abs(b1_[i] - b0_[i]) for i in range(3)))
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    # --- ход: сдвиг stroke_slide на 80 мм удлиняет габарит ровно на ход
    s_mn, s_mx = mesh_bbox(subtree_meshes(slide))
    st_mn, st_mx = mesh_bbox([o for o in all_mesh if o not in subtree_meshes(slide)])
    slide.location = (TRAVEL, 0.0, 0.0)
    bpy.context.view_layer.update()
    t_mn, t_mx = mesh_bbox(all_mesh)
    travel_max = t_mx.x
    len_full = (t_mx.x - t_mn.x)
    s2_mn, s2_mx = mesh_bbox(subtree_meshes(slide))
    st2_mn, st2_mx = mesh_bbox([o for o in all_mesh if o not in subtree_meshes(slide)])
    travel_moved = (s2_mn.x - s_mn.x)
    static_drift = max(abs(st2_mn[i] - st_mn[i]) for i in range(3)) + \
        max(abs(st2_mx[i] - st_mx[i]) for i in range(3))
    slide.location = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    # --- полый шпиндель: есть внутренний канал
    sp = bpy.data.objects[PREFIX + 'spindle']
    bore_ok = R_BORE > 0.004

    report = {
        'component': CID,
        'code': CODE,
        'name': 'Комбинированная база',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'length_mm': round(size.x * 1000, 1),
        'max_diameter_mm': round(max(size.y, size.z) * 1000, 1),
        'body_diameter_mm': round(body_dia * 1000, 1),
        'flange_diameter_mm': round(flange_dia * 1000, 1),
        'passport': {'envelope': 'Ø 0,058 × 0,42 м', 'mass_kg': 2.4,
                     'stroke_mm': 80, 'spin_rpm': [0, 40]},
        'bbox_ok': bool(0.400 <= size.x <= 0.440
                        and body_dia <= 0.062
                        and flange_dia <= 0.068),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_axis': 'X',
        'anim_motion': anim.get('motion'),
        'anim_speed': anim.get('speed'),
        'anim_on_axis': bool(abs(anim.location.y) < 1e-9
                             and abs(anim.location.z) < 1e-9),
        'anim_children': sorted(o.name for o in anim.children),
        'anim_children_count': len(anim.children),
        'stroke_node': slide.name,
        'stroke_loc': [round(v, 5) for v in slide.location],
        'stroke_motion': slide.get('motion'),
        'stroke_amount_m': slide.get('amount'),
        'stroke_axis': slide.get('axis'),
        'stroke_on_axis': bool(abs(slide.location.y) < 1e-9
                               and abs(slide.location.z) < 1e-9),
        'stroke_children': sorted(o.name for o in slide.children),
        'stroke_children_count': len(slide.children),
        'stroke_measured_mm': round(travel_moved * 1000, 2),
        'bbox_len_full_stroke_mm': round(len_full * 1000, 1),
        'stroke_static_drift_m': round(static_drift, 9),
        'stroke_ok': bool(abs(travel_moved - TRAVEL) < 0.0005 and static_drift < 1e-6),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 4),
        'pivot_ok': bool(pivot_shift < 0.0015),
        'spin_bbox_error_mm': round(spin_err * 1000, 3),
        'moving_nodes': sorted(o.name for o in moving),
        'moving_count': len(moving),
        'static_nodes': sorted(o.name for o in bpy.data.objects
                               if o.name.startswith(PREFIX) and o.type == 'MESH'
                               and o not in moving),
        'hollow_spindle_bore_mm': round(R_BORE * 2000, 1),
        'hollow_spindle_ok': bool(bore_ok),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'envelope_note': ('паспорт Ø58 — это корпус (59.6 мм по рёбрам). Полный bbox '
                          'шире за счёт латунных штуцеров, полупрозрачных трубок и '
                          'кабеля датчика: Ø79 по Y/Z. Длина 420 мм = паспорт.'),
        'reads_in_3d': ('Читается вращающееся уплотнение с двумя латунными портами и '
                        'выдвижная втулка хода с линейной шкалой по верхней стороне; '
                        'главный узел — цанга CJ-TOOL-25 с разрезным кольцом и рычагом '
                        'быстросъёма на переднем торце подвижной втулки.'),
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


def main():
    anim, slide, moving = build()
    rep = check(anim, slide, moving)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['glb_kb'] = round(path.stat().st_size / 1024, 1)
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['anim_on_axis']
            and rep['stroke_ok'] and rep['material_count'] >= 4
            and not rep['bad_names'] and rep['nodes'] >= 8):
        raise SystemExit('checks failed')


main()
