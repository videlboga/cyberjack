"""Standalone builder: work_probe_thermal (WRK-PEN-04, «Термо-зонд»).

Компактный термо-зонд: графитовое основание с байонетным быстросъёмом,
тёмная накатная муфта, молочный корпус сужается кверху, янтарная шкала
температуры с делениями, циановый LED, тонкий стальной вал, силиконовая
изолирующая манжета, металлическая гильза нагревателя с канавками и
янтарным кольцом, латунное стопорное кольцо, керамический изолятор и
крошечный датчик на кончике; кабель с разъёмом на -Y.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_probe_thermal.py

Выход:
  public/models/machine-modules/components/work_probe_thermal.glb

Геометрия (Blender Z-up, метры):
  ось зонда    = Z, x=y=0; основание стоит на z=0
  основание    = z 0.000..0.0118 (плита Ø38, байонетное кольцо, уши ±X)
  рычаг        = +Y, z ~0.0110
  муфта        = z 0.0118..0.0288 (graphite, накатка)
  корпус       = z 0.0288..0.1136 (ivory, сужается 0.0136 -> 0.0114)
  шкала        = z 0.0910..0.0950 (amber) + деления
  вал          = z 0.1246..0.1480 (steel Ø7.2)
  манжета      = z 0.1450..0.1570 (silicone)
  гильза       = z 0.1552..0.1742 (steel, 3 канавки + короткий конус)
  датчик       = z 0.1742..0.1799 (dark + стальная головка)
  кабель       = -Y, разъём ~y -0.034

Анимации нет (паспорт: motion none) — вращения/пульсации не делаем,
пустышка `work_probe_thermal__anim` стоит якорем в начале координат
и помечена motion_type='none'.
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
CID = 'work_probe_thermal'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z_PLATE0, Z_PLATE1 = 0.0000, 0.0060      # плита основания Ø38
PLATE_R = 0.0190
Z_RING0, Z_RING1 = 0.0060, 0.0118       # байонетное кольцо
RING_R = 0.0166
Z_EAR = 0.0092                          # уши байонета (±X)
Z_COLL0, Z_COLL1 = 0.0118, 0.0288       # накатная отжимная муфта
COLL_R = 0.0146
Z_BODY0, Z_BODY1 = 0.0304, 0.1136       # молочный корпус
BODY_R0, BODY_R1 = 0.0136, 0.0114
Z_SHAFT0, Z_SHAFT1 = 0.1246, 0.1480     # стальной вал
SHAFT_R = 0.0036

MUFF_Z0, MUFF_Z1 = 0.1450, 0.1570       # силиконовая манжета
MUFF_R = 0.0068

TIP_Z0, TIP_Z1 = 0.1552, 0.1742         # металлическая гильза нагревателя
TIP_R = 0.0056
HEATER_RING_Z = 0.1615                  # янтарное кольцо нагрева
BRASS_RING_Z = 0.1676                   # латунное стопорное кольцо

SENS_Z0, SENS_Z1 = 0.1742, 0.1784       # датчик на кончике
SENS_R = 0.0022
SENS_BEAD_Z = 0.1786
SENS_BEAD_R = 0.00125

AMB_Z0, AMB_Z1 = 0.0910, 0.0950         # янтарная метка температуры
LED_Z = 0.1080                          # циановый LED

PALETTE = {
    'body': (0.935, 0.925, 0.905),
    'steel': (0.660, 0.668, 0.658),
    'graphite': (0.235, 0.245, 0.258),
    'dark': (0.108, 0.113, 0.124),
    'amber': (0.930, 0.430, 0.040),
    'brass': (0.730, 0.560, 0.300),
    'cyan': (0.330, 0.845, 0.945),
    'silicone': (0.905, 0.915, 0.905),
}
# роль -> (alpha, roughness, metallic, emission_strength)
MATSPEC = {
    'body': (1.00, 0.50, 0.00, 0.00),
    'steel': (1.00, 0.28, 0.90, 0.00),
    'graphite': (1.00, 0.56, 0.18, 0.00),
    'dark': (1.00, 0.62, 0.10, 0.00),
    'amber': (1.00, 0.32, 0.00, 0.35),
    'brass': (1.00, 0.32, 0.92, 0.00),
    'cyan': (1.00, 0.24, 0.00, 0.45),
    'silicone': (1.00, 0.42, 0.00, 0.00),
}
MATS = {}


# --- helpers (как в build_work_tickle_firm.py / build_work_probe_inflatable.py)
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    alpha, rough, metal, emit = MATSPEC[role]
    m = bpy.data.materials.new(f'CJ_{role}_{int(round(alpha * 100))}')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
        if hasattr(m, 'show_transparent_back'):
            m.show_transparent_back = True
    if emit > 0.0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit
    m.diffuse_color = (*color, alpha)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
        # авто-сглаживание по углу (в 4.2 auto_smooth убран): рвём резкие кромки
        mod = obj.modifiers.new('es', 'EDGE_SPLIT')
        mod.use_edge_angle = True
        mod.split_angle = math.radians(38)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=mod.name)
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


def cube(name, loc, size, role, r=0.0010, rot=(0, 0, 0), smooth=False):
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


def sphere(name, loc, radius, role, segs=20, rings=12, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def bm_box(bm, center, size, rz=0.0):
    m = (Matrix.Translation(Vector(center))
         @ Matrix.Rotation(rz, 4, 'Z')
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def lathe_solid(name, stations, role, seg=44, smooth=True):
    """Тело вращения вокруг Z по профилю [(z, r), ...] (снизу вверх)."""
    bm = bmesh.new()
    rings = []
    for z, r in stations:
        ring = []
        for k in range(seg):
            a = math.tau * k / seg
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        r0, r1 = rings[i], rings[i + 1]
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((r0[k], r0[k2], r1[k2], r1[k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))
    return mesh_from_bm(name, bm, role, smooth)


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ---- 1. графитовое основание с байонетным быстросъёмом -------------
    cyl(PREFIX + 'base_plate', (0, 0, 0.0000), (0, 0, 0.0052), 0.0190,
        'graphite', vertices=56, bev=0.0018)
    torus(PREFIX + 'base_seal', (0, 0, 0.0013), 0.0166, 0.0008, 'dark', 'Z',
          segs=48, rings=8)
    cyl(PREFIX + 'bayonet_ring', (0, 0, 0.0052), (0, 0, 0.0122), 0.0162,
        'steel', vertices=48, bev=0.0010)
    # два байонетных уха по ±X с крючком-фиксатором — читаемый быстросъём
    bm = bmesh.new()
    for sx in (1, -1):
        bm_box(bm, (sx * 0.0205, 0.0, 0.0087), (0.0095, 0.0075, 0.0070))
        bm_box(bm, (sx * 0.0245, 0.0, 0.0127), (0.0025, 0.0075, 0.0030))
    mesh_from_bm(PREFIX + 'bayonet_ears', bm, 'steel', smooth=False)

    # рычаг отжима на +Y: плечо + нажимная пятка + шарнир
    bm = bmesh.new()
    bm_box(bm, (0.0, 0.0202, 0.0138), (0.0100, 0.0150, 0.0034))
    bm_box(bm, (0.0, 0.0284, 0.0122), (0.0110, 0.0052, 0.0060))
    mesh_from_bm(PREFIX + 'release_lever', bm, 'graphite', smooth=False)
    cyl(PREFIX + 'lever_pivot', (-0.0104, 0.0128, 0.0140),
        (0.0104, 0.0128, 0.0140), 0.0032, 'steel', vertices=20, bev=0.0006)

    # тёмная накатная муфта
    cyl(PREFIX + 'grip_collar', (0, 0, 0.0122), (0, 0, 0.0272), COLL_R,
        'graphite', vertices=48, bev=0.0016)
    bm = bmesh.new()
    for k in range(26):
        a = math.tau * k / 26
        bm_box(bm, (math.cos(a) * 0.0149, math.sin(a) * 0.0149, 0.0197),
               (0.0013, 0.0034, 0.0122), rz=a)
    mesh_from_bm(PREFIX + 'collar_knurl', bm, 'dark', smooth=False)

    # ---- 2. молочный корпус (сужается кверху) --------------------------
    cyl(PREFIX + 'body_ferrule', (0, 0, 0.0272), (0, 0, 0.0288), 0.0137,
        'steel', vertices=48, bev=0.0008)
    lathe_solid(PREFIX + 'body', [
        (0.0288, 0.0138),
        (0.0500, 0.0138),
        (0.0506, 0.0138),
        (0.0512, 0.0132),
        (0.0720, 0.0126),
        (0.0980, 0.0119),
        (Z_BODY1, 0.0112),
    ], 'body', seg=56)
    cyl(PREFIX + 'body_seam', (0, 0, 0.0986), (0, 0, 0.1010), 0.0124,
        'graphite', vertices=48, bev=0.0004)

    # янтарная метка температуры + деления
    cyl(PREFIX + 'temp_mark', (0, 0, AMB_Z0), (0, 0, AMB_Z1), 0.0126,
        'amber', vertices=48, bev=0.0003)
    bm = bmesh.new()
    for dy in (-0.0046, -0.0015, 0.0015, 0.0046):
        bm_box(bm, (0.0123, dy, (AMB_Z0 + AMB_Z1) * 0.5),
               (0.0014, 0.0007, 0.0044))
    mesh_from_bm(PREFIX + 'temp_ticks', bm, 'dark', smooth=False)

    # техническая плашка на -X
    cube(PREFIX + 'label_plate', (-0.0136, 0.0, 0.0480),
         (0.0014, 0.0130, 0.0064), 'dark', r=0.0005)
    bm = bmesh.new()
    for i in range(3):
        bm_box(bm, (-0.0141, -0.0038 + i * 0.0038, 0.0480),
               (0.0006, 0.0026, 0.0038))
    mesh_from_bm(PREFIX + 'label_lines', bm, 'body', smooth=False)

    # циановый LED в графитовой бобышке
    torus(PREFIX + 'led_bezel', (0.0114, 0.0, LED_Z), 0.0027, 0.0006,
          'graphite', 'X', segs=28, rings=8)
    cyl(PREFIX + 'led_socket', (0.0108, 0.0, LED_Z), (0.0120, 0.0, LED_Z),
        0.0023, 'dark', vertices=24)
    sphere(PREFIX + 'led', (0.0122, 0.0, LED_Z), 0.0017, 'cyan',
           segs=18, rings=12)

    # верхняя графитовая обойма (точёная ступень) + вал
    lathe_solid(PREFIX + 'top_collar', [
        (Z_BODY1, 0.0112),
        (0.1140, 0.0114),
        (0.1166, 0.0114),
        (0.1168, 0.0092),
        (0.1214, 0.0092),
    ], 'graphite', seg=48)
    cyl(PREFIX + 'shaft_bushing', (0, 0, 0.1214), (0, 0, Z_SHAFT0), 0.0054,
        'steel', vertices=28, bev=0.0005)
    cyl(PREFIX + 'shaft', (0, 0, Z_SHAFT0), (0, 0, Z_SHAFT1), 0.0032,
        'steel', vertices=24)

    # ---- 3. силиконовая изолирующая манжета ----------------------------
    lathe_solid(PREFIX + 'silicone_muff', [
        (0.1442, 0.0038),
        (0.1456, 0.0056),
        (0.1472, 0.0065),
        (0.1518, 0.0065),
        (0.1546, 0.0056),
        (0.1566, 0.0046),
    ], 'silicone', seg=44)
    torus(PREFIX + 'muff_rib_a', (0, 0, 0.1480), 0.0065, 0.00055, 'silicone',
          'Z', segs=44, rings=8)
    torus(PREFIX + 'muff_rib_b', (0, 0, 0.1526), 0.0065, 0.00055, 'silicone',
          'Z', segs=44, rings=8)

    # ---- 4. металлическая гильза нагревателя (точёный профиль) --------
    lathe_solid(PREFIX + 'heater_sleeve', [
        (0.1538, 0.0040),
        (0.1550, 0.0047),
        (0.1558, 0.0047),
        (0.1560, 0.0041),
        (0.1576, 0.0041),
        (0.1578, 0.0047),
        (0.1600, 0.0047),
        (0.1602, 0.0041),
        (0.1618, 0.0041),
        (0.1620, 0.0047),
        (0.1680, 0.0047),
        (0.1682, 0.0042),
        (0.1692, 0.0042),
    ], 'steel', seg=48)
    torus(PREFIX + 'heater_ring', (0, 0, 0.1568), 0.0042, 0.00045,
          'amber', 'Z', segs=44, rings=8)
    torus(PREFIX + 'sleeve_lock_ring', (0, 0, 0.1650), 0.0047, 0.00040,
          'brass', 'Z', segs=44, rings=8)

    # ---- 5. керамический изолятор и датчик на кончике ------------------
    lathe_solid(PREFIX + 'sensor_isolator', [
        (0.1688, 0.0036),
        (0.1700, 0.0028),
        (0.1724, 0.0028),
        (0.1726, 0.0033),
    ], 'body', seg=32)
    lathe_solid(PREFIX + 'sensor_body', [
        (0.1722, 0.0021),
        (0.1728, 0.0023),
        (0.1764, 0.0023),
        (0.1766, 0.0018),
    ], 'dark', seg=28)
    sphere(PREFIX + 'sensor_bead', (0, 0, 0.1767), 0.00110,
           'steel', segs=20, rings=12, scale=(1.0, 1.0, 0.75))

    # ---- 6. кабель и разъём по диагонали -X/-Y ------------------------
    cyl(PREFIX + 'strain_relief', (-0.0104, -0.0104, 0.0094),
        (-0.0176, -0.0176, 0.0078), 0.0042, 'graphite', vertices=22, bev=0.0007)
    cyl(PREFIX + 'strain_ring', (-0.0170, -0.0170, 0.0079),
        (-0.0190, -0.0190, 0.0075), 0.0044, 'steel', vertices=22, bev=0.0004)
    curve_tube(PREFIX + 'cable',
               [(-0.0186, -0.0186, 0.0076),
                (-0.0224, -0.0224, 0.0056),
                (-0.0246, -0.0246, 0.0042),
                (-0.0256, -0.0256, 0.0036)], 0.0024, 'dark')
    cube(PREFIX + 'connector', (-0.0302, -0.0302, 0.0034),
         (0.0098, 0.0124, 0.0068), 'graphite', r=0.0010,
         rot=(0, 0, math.radians(135)))
    bm = bmesh.new()
    for s in (-1, 1):
        bm_box(bm, (-0.0348 + 0.0018 * s, -0.0348 - 0.0018 * s, 0.0034),
               (0.0013, 0.0019, 0.0012), rz=math.radians(135))
    mesh_from_bm(PREFIX + 'connector_pins', bm, 'brass', smooth=False)

    # ---- 7. якорная пустышка (движения нет) ----------------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, 0.0))
    anim['motion_type'] = 'none'
    anim['motion_axis'] = 'none'

    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH':
            o['rotating'] = False
            o['part'] = o.name[len(PREFIX):]
    # пометки для читаемости/проверок
    for tag, needle in (('heater', 'heater'), ('heater', 'sleeve_lock'),
                        ('sensor', 'sensor'), ('quick_release', 'bayonet'),
                        ('quick_release', 'release_lever'),
                        ('quick_release', 'lever_pivot'),
                        ('quick_release', 'grip_collar'),
                        ('quick_release', 'collar_knurl'),
                        ('cable', 'cable'), ('cable', 'connector'),
                        ('cable', 'strain')):
        for o in bpy.data.objects:
            if o.name.startswith(PREFIX) and needle in o.name:
                o[tag] = True
    bpy.context.view_layer.update()
    return anim


# --- проверки ------------------------------------------------------------
def verts_world(objects):
    pts = []
    for o in objects:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        pts.extend(mw @ v.co for v in o.data.vertices)
    return pts


def stats(objects):
    pts = verts_world(objects)
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx, len(pts)


def check(anim):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx, nverts = stats(meshes)
    size = mx - mn

    tip = [o for o in meshes if any(k in o.name for k in
                                    ('heater', 'sensor', 'sleeve', 'muff'))]
    t_mn, t_mx, _ = stats(tip)
    body = [o for o in meshes if o.name == PREFIX + 'body'][0]
    b_mn, b_mx, _ = stats([body])

    report = {
        'component': CID,
        'code': 'WRK-PEN-04',
        'nodes': len(objs),
        'mesh_nodes': len(meshes),
        'objects_total': len(bpy.data.objects),
        'verts': nverts,
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_size_mm': [round(v * 1000, 1) for v in size],
        'bbox_ok_0.08x0.08x0.22': bool(size.x <= 0.080 and size.y <= 0.080
                                       and size.z <= 0.220),
        'bbox_from_ground': bool(abs(mn.z) < 1e-5),
        'probe_axis_z_centered': bool(abs((b_mn.x + b_mx.x) * 0.5) < 1e-5
                                      and abs((b_mn.y + b_mx.y) * 0.5) < 1e-5),
        'body_diam': round(b_mx.x - b_mn.x, 5),
        'tip_zone_z': [round(t_mn.z, 5), round(t_mx.z, 5)],
        'tip_diam': round(t_mx.x - t_mn.x, 5),
        'materials': sorted({m.name for o in meshes for m in o.data.materials if m}),
        'nodes_list': sorted(o.name for o in objs),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_extras': {k: anim[k] for k in anim.keys() if k != '_RNA_UI'},
        'animations': [a.name for a in bpy.data.actions],
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
        'tris': sum(len(o.data.loop_triangles) for o in meshes
                    if o.data.calc_loop_triangles() or True),
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
        export_animations=False,
    )
    if not path.is_file() or path.stat().st_size < 10240:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    anim = build()
    rep = check(anim)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['glb_ok_gt_10kb'] = bool(rep['glb_bytes'] > 10240)
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    fails = []
    if not rep['bbox_ok_0.08x0.08x0.22']:
        fails.append('bbox')
    if not rep['bbox_from_ground']:
        fails.append('ground')
    if not rep['probe_axis_z_centered']:
        fails.append('axis')
    if len(rep['materials']) < 4:
        fails.append('materials')
    if rep['bad_names']:
        fails.append('names')
    if fails:
        raise SystemExit('checks failed: ' + ','.join(fails))


main()
