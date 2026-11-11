"""Standalone builder: structure_bed_frame (STR-BED-04, «Рама-ложе»).

Рама-ложе с регулируемым наклоном: молочный каркас-шасси на четырёх
анкерных опорах 4 x M12, графитовые рельсы по периметру каретки с
T-образным пазом, две стойки-шарнира на оси наклона, секторный
механизм наклона 0-30° с дуговым пазом, стопорным пальцем и ручным
винтом, линейный актуатор, кабельный канал с петлёй запаса,
розовые мягкие подушки и бортики с быстросъёмными пряжками.

Плиты (деки) нет: рама открыта, поверхности (surface_*) ставятся сверху.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_structure_bed_frame.py

Выход:
  public/models/machine-modules/components/structure_bed_frame.glb
  docs/plans/blockout/component-library/structure_bed_frame/*.png + report.json

Геометрия (Blender Z-up, метры):
  +X = изголовье (приподнятый конец), -X = ножной конец
  +Y = задний борт, -Y = передний борт (там сектор наклона)
  z=0 — плоскость пола
  ось наклона = Y в точке (0, PIVOT_Z); статичная поза TILT_DEG,
  вращения/анимации нет (motion: none).
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/structure_bed_frame'
CID = 'structure_bed_frame'
PREFIX = CID + '__'

A = math.radians

# --- паспорт -------------------------------------------------------------
BBOX_PASSPORT = (2.00, 0.90, 0.35)      # STR-BED-04: 2,0 x 0,9 x 0,35 м

# --- ключевые размеры (м) ------------------------------------------------
TILT_DEG = 5.0                 # статичная поза, диапазон механизма 0-30°
TILT = A(TILT_DEG)
PIVOT_Z = 0.212                # ось наклона по Y
PIVOT_X = 0.0

BASE_TOP = 0.072               # верх шасси
BASE_Z0 = 0.016                # низ балок шасси (на анкерах)
FOOT_Z1 = 0.016
BEAM_W = 0.044                 # ширина балок шасси
BASE_Y = 0.405                 # оси продольных балок шасси
BASE_X = 0.930                 # оси поперечных балок шасси
FOOT_X, FOOT_Y = 0.955, 0.405  # 4 x M12
FOOT_R_IN, FOOT_R_OUT = 0.0085, 0.0375   # M12 -> отверстие 17 мм

RAIL_Y = 0.340                 # оси боковых рельсов каретки
RAIL_X0, RAIL_X1 = -0.925, 0.925
RAIL_HW, RAIL_HH = 0.025, 0.014           # полуширина/полувысота профиля
RAIL_GW, RAIL_GD = 0.010, 0.008           # паз

DECK_TOP = 0.014               # верх рельса в локальной плоскости каретки

# мягкие элементы
PAD_W = 0.580                  # ширина подушки по Y
PAD_T = 0.026                 # толщина
BOLSTER_R = 0.019

PALETTE = {
    'milk': (0.880, 0.866, 0.836),
    'cream': (0.930, 0.917, 0.888),
    'graphite': (0.098, 0.103, 0.114),
    'steel': (0.615, 0.625, 0.640),
    'dark': (0.030, 0.032, 0.038),
    'blush': (0.870, 0.560, 0.600),
    'silicone': (0.912, 0.700, 0.716),
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
    if role == 'steel':
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.30
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.30
        bsdf.inputs['Roughness'].default_value = 0.45
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.10
        bsdf.inputs['Roughness'].default_value = 0.52
    elif role == 'blush':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.48
    elif role == 'silicone':
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.58
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.80
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


def bevel(obj, width=0.0010, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(35)
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


def mesh_from_bm(name, bm, role, smooth=True, bevel_w=0.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, smooth)
    if bevel_w > 0:
        bevel(obj, bevel_w, 2)
    return obj


def cube(name, loc, size, role, r=0.0010, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def cyl(name, a, b, radius, role, vertices=24, smooth=True, r2=None, bev=0.0):
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
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=32, rings=10):
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


def poly_tube(name, points, radius, role, res=4):
    """Трубка по ломаной (швы подушек, канты) без провисаний Безье."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 1
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        sp.points[i].co = (p[0], p[1], p[2], 1.0)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


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


def annulus(name, cx, cy, z0, z1, r_in, r_out, role, segs=28):
    """Кольцо (плита с настоящим отверстием) вокруг вертикальной оси."""
    bm = bmesh.new()
    rings = {}
    for zi, z in enumerate((z0, z1)):
        for ri, r in enumerate((r_in, r_out)):
            rings[(zi, ri)] = [bm.verts.new((cx + math.cos(A(360.0 * i / segs)) * r,
                                            cy + math.sin(A(360.0 * i / segs)) * r,
                                            z)) for i in range(segs)]
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new((rings[(0, 0)][i], rings[(0, 0)][j],
                      rings[(0, 1)][j], rings[(0, 1)][i]))      # низ
        bm.faces.new((rings[(1, 0)][i], rings[(1, 1)][i],
                      rings[(1, 1)][j], rings[(1, 0)][j]))      # верх
        bm.faces.new((rings[(0, 0)][i], rings[(0, 0)][j],
                      rings[(1, 0)][j], rings[(1, 0)][i]))      # внутр. стенка
        bm.faces.new((rings[(0, 1)][i], rings[(1, 1)][i],
                      rings[(1, 1)][j], rings[(0, 1)][j]))      # внешн. стенка
    return mesh_from_bm(name, bm, role, True)


def rail_profile(name, x0, x1, cy, cz, role, hw=RAIL_HW, hh=RAIL_HH,
                 gw=RAIL_GW, gd=RAIL_GD, bevel_w=0.0012):
    """Профиль рельса с T-пазом сверху, вытянутый по X."""
    prof = [(-hw, -hh), (hw, -hh), (hw, hh), (gw, hh),
            (gw, hh - gd), (-gw, hh - gd), (-gw, hh), (-hw, hh)]
    bm = bmesh.new()
    rings = []
    for x in (x0, x1):
        rings.append([bm.verts.new((x, cy + p[0], cz + p[1])) for p in prof])
    n = len(prof)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[1]))
    return mesh_from_bm(name, bm, role, False, bevel_w)


def arc_plate_y(name, y0, y1, r_in, r_out, a0, a1, seg, role, cx=0.0, cz=0.0,
                smooth=True):
    """Дуговой сектор в плоскости XZ (толщина по Y). a0/a1 в градусах от +X."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = A(a0 + (a1 - a0) * i / seg)
        dx, dz = math.cos(a), math.sin(a)
        ring = []
        for y in (y0, y1):
            for r in (r_in, r_out):
                ring.append(bm.verts.new((cx + dx * r, y, cz + dz * r)))
        rings.append(ring)
    for i in range(seg):
        p, q = rings[i], rings[i + 1]
        bm.faces.new((p[0], p[2], q[2], q[0]))     # внутренняя дуга
        bm.faces.new((p[1], q[1], q[3], p[3]))     # наружная дуга
        bm.faces.new((p[0], p[1], q[1], q[0]))     # торец y0
        bm.faces.new((p[2], q[2], q[3], p[3]))     # торец y1
    bm.faces.new(rings[0])
    bm.faces.new(tuple(reversed(rings[-1])))
    return mesh_from_bm(name, bm, role, smooth)


def u_channel(name, x0, x1, cy, cz, width, depth, wall, role):
    """П-образный кабельный лоток открытый вверх, по X."""
    bm = bmesh.new()
    prof = [(-width / 2, -depth / 2), (width / 2, -depth / 2),
            (width / 2, depth / 2), (width / 2 - wall, depth / 2),
            (width / 2 - wall, -depth / 2 + wall),
            (-width / 2 + wall, -depth / 2 + wall),
            (-width / 2 + wall, depth / 2), (-width / 2, depth / 2)]
    rings = []
    for x in (x0, x1):
        rings.append([bm.verts.new((x, cy + p[0], cz + p[1])) for p in prof])
    n = len(prof)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((rings[0][i], rings[0][j], rings[1][j], rings[1][i]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[1]))
    return mesh_from_bm(name, bm, role, False, 0.0008)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'PLAIN_AXES'
    return e


# --- сборка --------------------------------------------------------------
CRADLE = []          # объекты, вращающиеся вместе с рамой каретки


def crad(obj):
    CRADLE.append(obj)
    return obj


def build():
    reset()

    # ================= ШАССИ (статично) ================================
    # 4 x M12: анкерная плита-кольцо + утопленное гнездо
    for tag, sx, sy in (('fl', -1, -1), ('fr', -1, 1),
                        ('rl', 1, -1), ('rr', 1, 1)):
        x, y = sx * FOOT_X, sy * FOOT_Y
        annulus(PREFIX + f'foot_anchor_{tag}', x, y, 0.0, FOOT_Z1,
                FOOT_R_IN, FOOT_R_OUT, 'steel', segs=26)
        annulus(PREFIX + f'anchor_recess_{tag}', x, y, 0.0, 0.004,
                FOOT_R_IN, FOOT_R_IN + 0.004, 'dark', segs=22)
        cyl(PREFIX + f'anchor_stud_{tag}', (x, y, 0.0), (x, y, 0.0055),
            FOOT_R_IN - 0.0006, 'dark', vertices=18)

    # продольные балки шасси
    for tag, sy in (('neg', -1), ('pos', 1)):
        cube(PREFIX + f'base_beam_{tag}',
             (0.0, sy * BASE_Y, (BASE_Z0 + BASE_TOP) * 0.5),
             (2 * BASE_X, BEAM_W, BASE_TOP - BASE_Z0), 'milk', r=0.0026)
    # поперечины шасси
    for tag, sx in (('head', 1), ('tail', -1)):
        cube(PREFIX + f'base_cross_{tag}',
             (sx * (BASE_X - 0.020), 0.0, (BASE_Z0 + BASE_TOP) * 0.5),
             (0.045, 2 * (BASE_Y - 0.010), BASE_TOP - BASE_Z0),
             'milk', r=0.0026)
    # поперечина под актуатор наклона
    cube(PREFIX + 'base_cross_lift', (0.430, 0.0, (BASE_Z0 + BASE_TOP) * 0.5),
         (0.048, 2 * (BASE_Y - 0.010), BASE_TOP - BASE_Z0), 'milk', r=0.0026)

    # угловые косынки шасси
    for tag, sx, sy in (('fl', -1, -1), ('fr', -1, 1),
                        ('rl', 1, -1), ('rr', 1, 1)):
        bm = bmesh.new()
        ax, ay = sx * BASE_X, sy * BASE_Y
        p = [(ax, ay - sy * 0.010, BASE_TOP), (ax - sx * 0.115, ay - sy * 0.010, BASE_TOP),
             (ax - sx * 0.115, ay - sy * 0.010, BASE_Z0 + 0.030)]
        v0 = [bm.verts.new(q) for q in p]
        v1 = [bm.verts.new((q[0], q[1] + sy * 0.008, q[2])) for q in p]
        bm.faces.new(v0)
        bm.faces.new(tuple(reversed(v1)))
        for i in range(3):
            j = (i + 1) % 3
            bm.faces.new((v0[i], v0[j], v1[j], v1[i]))
        mesh_from_bm(PREFIX + f'base_gusset_{tag}', bm, 'milk', False, 0.0008)

    # стойки-шарниры наклона
    for tag, sy in (('neg', -1), ('pos', 1)):
        cube(PREFIX + f'tower_{tag}', (0.0, sy * 0.399, (BASE_TOP + PIVOT_Z + 0.030) * 0.5),
             (0.056, 0.024, PIVOT_Z + 0.030 - BASE_TOP), 'milk', r=0.0022)
        # подкос стойки к поперечине шасси
        bm = bmesh.new()
        base_p = [(-0.085, sy * 0.399, BASE_TOP), (0.0, sy * 0.399, BASE_TOP),
                  (0.0, sy * 0.399, PIVOT_Z - 0.010)]
        v0 = [bm.verts.new(q) for q in base_p]
        v1 = [bm.verts.new((q[0], q[1] - sy * 0.012, q[2])) for q in base_p]
        bm.faces.new(v0)
        bm.faces.new(tuple(reversed(v1)))
        for i in range(3):
            j = (i + 1) % 3
            bm.faces.new((v0[i], v0[j], v1[j], v1[i]))
        mesh_from_bm(PREFIX + f'tower_rib_{tag}', bm, 'milk', False, 0.0008)

        # подшипниковый узел
        cyl(PREFIX + f'hinge_boss_{tag}', (0.0, sy * 0.376, PIVOT_Z),
            (0.0, sy * 0.428, PIVOT_Z), 0.031, 'steel', vertices=30, bev=0.0022)
        cyl(PREFIX + f'hinge_cap_{tag}', (0.0, sy * 0.428, PIVOT_Z),
            (0.0, sy * 0.437, PIVOT_Z), 0.0245, 'graphite', vertices=26,
            bev=0.0016)
        cyl(PREFIX + f'hinge_pin_{tag}', (0.0, sy * 0.435, PIVOT_Z),
            (0.0, sy * 0.446, PIVOT_Z), 0.0105, 'dark', vertices=14)

    # ось наклона (труба каретки)
    cyl(PREFIX + 'pivot_shaft', (0.0, -0.395, PIVOT_Z), (0.0, 0.395, PIVOT_Z),
        0.0150, 'steel', vertices=26, bev=0.0014)

    # питание / док
    cube(PREFIX + 'power_inlet', (0.905, -0.250, 0.052),
         (0.030, 0.052, 0.040), 'graphite', r=0.0018)
    cube(PREFIX + 'inlet_flange', (0.888, -0.250, 0.052),
         (0.012, 0.070, 0.056), 'graphite', r=0.0016)
    cyl(PREFIX + 'inlet_socket', (0.915, -0.250, 0.052), (0.932, -0.250, 0.052),
        0.0145, 'dark', vertices=20)

    # ================= КАРЕТКА (наклоняется) ===========================
    # боковые рельсы с T-пазом по периметру
    for tag, sy in (('neg', -1), ('pos', 1)):
        crad(rail_profile(PREFIX + f'rail_{tag}', RAIL_X0, RAIL_X1,
                           sy * RAIL_Y, 0.0, 'graphite'))
        # шкала-лента по внешней стороне рельса
        cube(PREFIX + f'rail_scale_{tag}',
             (0.180, sy * (RAIL_Y + RAIL_HW + 0.0006), 0.004),
             (0.760, 0.0012, 0.0070), 'steel', r=0.0)
        CRADLE.append(bpy.data.objects[PREFIX + f'rail_scale_{tag}'])
        # концевые заглушки
        for ctag, sx in (('head', 1), ('tail', -1)):
            crad(cube(PREFIX + f'rail_endcap_{ctag}_{tag}',
                      (sx * (RAIL_X1 + 0.008), sy * RAIL_Y, 0.0),
                      (0.016, RAIL_HW * 2 + 0.006, RAIL_HH * 2 + 0.004),
                      'steel', r=0.0014))

    # поперечины каретки
    for tag, x, hw in (('head', 0.900, 0.018), ('tail', -0.900, 0.018),
                       ('pivot', 0.0, 0.020)):
        crad(cube(PREFIX + f'cross_{tag}', (x, 0.0, -0.002),
                  (hw * 2, RAIL_Y * 2, 0.026), 'graphite', r=0.0018))
    for tag, x in (('h', 0.560), ('f', -0.560)):
        crad(cube(PREFIX + f'strut_{tag}', (x, 0.0, -0.004),
                  (0.030, RAIL_Y * 2, 0.020), 'graphite', r=0.0014))
    # продольные ламели-опоры мата
    for tag, sy in (('neg', -1), ('pos', 1)):
        crad(cube(PREFIX + f'deck_slat_{tag}', (0.0, sy * 0.200, 0.004),
                  (1.780, 0.030, 0.018), 'graphite', r=0.0012))

    # каретки-зажимы на рельсах (4 шт.)
    for ctag, x in (('h', 0.300), ('f', -0.330)):
        for tag, sy in (('neg', -1), ('pos', 1)):
            crad(cube(PREFIX + f'carriage_{ctag}_{tag}',
                      (x, sy * RAIL_Y, 0.019),
                      (0.062, RAIL_HW * 2 + 0.016, 0.026),
                      'graphite', r=0.0016))
            crad(cube(PREFIX + f'carriage_tab_{ctag}_{tag}',
                      (x, sy * (RAIL_Y + RAIL_HW + 0.006), 0.030),
                      (0.030, 0.010, 0.013), 'steel', r=0.0012))
            crad(cyl(PREFIX + f'carriage_lever_{ctag}_{tag}',
                      (x, sy * (RAIL_Y + RAIL_HW + 0.010), 0.034),
                      (x + 0.026, sy * (RAIL_Y + RAIL_HW + 0.010), 0.047),
                      0.0042, 'steel', vertices=12))
            crad(sphere(PREFIX + f'carriage_knob_{ctag}_{tag}',
                        (x + 0.028, sy * (RAIL_Y + RAIL_HW + 0.010), 0.049),
                        0.0072, 'blush', segs=16, rings=10))

    # ================= МЕХАНИЗМ НАКЛОНА =================================
    SEC_Y0, SEC_Y1 = -0.378, -0.367          # сектор между рельсом и балкой
    arc_plate_y(PREFIX + 'tilt_sector', SEC_Y0, SEC_Y1, 0.040, 0.132,
                -30.0, 40.0, 22, 'steel')
    CRADLE.append(bpy.data.objects[PREFIX + 'tilt_sector'])
    # зубчатый венец сектора (читается как механизм наклона)
    for i in range(11):
        ta = A(-26.0 + 62.0 * i / 10.0)
        CRADLE.append(cube(PREFIX + f'tilt_sector_tooth_{i}',
                           (math.cos(ta) * 0.1345, (SEC_Y0 + SEC_Y1) * 0.5,
                            math.sin(ta) * 0.1345),
                           (0.017, 0.0150, 0.0115), 'steel', r=0.0012,
                           rot=(0, -ta, 0)))
    # дуговой паз стопорения
    slot = arc_plate_y(PREFIX + 'tilt_sector_slot', SEC_Y0 - 0.0008, SEC_Y0 + 0.0008,
                       0.078, 0.092, -26.0, 36.0, 22, 'dark')
    CRADLE.append(slot)
    # ступица сектора + ручной винт наклона
    CRADLE.append(cyl(PREFIX + 'tilt_hub', (0.0, SEC_Y0 - 0.002, 0.0),
                      (0.0, SEC_Y1 + 0.004, 0.0), 0.048, 'steel',
                      vertices=30, bev=0.0018))
    crank_a = A(207.0)
    crank_end = (math.cos(crank_a) * 0.082, math.sin(crank_a) * 0.082)
    CRADLE.append(cyl(PREFIX + 'tilt_crank_arm', (0.0, SEC_Y0 - 0.006, 0.0),
                      (crank_end[0], SEC_Y0 - 0.006, crank_end[1]), 0.0078,
                      'steel', vertices=14))
    CRADLE.append(cyl(PREFIX + 'tilt_crank_grip',
                      (crank_end[0], SEC_Y0 + 0.002, crank_end[1]),
                      (crank_end[0], SEC_Y0 - 0.044, crank_end[1]), 0.0094,
                      'blush', vertices=16, bev=0.0022))
    CRADLE.append(cyl(PREFIX + 'tilt_crank_boss',
                      (crank_end[0], SEC_Y0 - 0.004, crank_end[1]),
                      (crank_end[0], SEC_Y0 + 0.006, crank_end[1]), 0.0132,
                      'steel', vertices=16))

    # стопорный палец в дуговом пазу (статичен, на стойке)
    lock_a = A(14.0)
    lp = Vector((math.cos(lock_a) * 0.085, 0.0, PIVOT_Z + math.sin(lock_a) * 0.085))
    cyl(PREFIX + 'lock_pin', (lp.x, -0.442, lp.z), (lp.x, SEC_Y0 + 0.002, lp.z),
        0.0075, 'steel', vertices=16)
    cyl(PREFIX + 'lock_sleeve', (lp.x, -0.404, lp.z), (lp.x, -0.384, lp.z),
        0.0125, 'graphite', vertices=18, bev=0.0012)
    cyl(PREFIX + 'lock_knob', (lp.x, -0.446, lp.z), (lp.x, -0.426, lp.z),
        0.0115, 'dark', vertices=16, bev=0.0016)

    # линейный актуатор наклона
    ax_y = 0.300
    lower = Vector((0.430, ax_y, 0.108))
    upper_local = Vector((0.470, ax_y, -0.020))
    upper = Vector((PIVOT_X + upper_local.x * math.cos(TILT)
                    + upper_local.z * math.sin(TILT), ax_y,
                    PIVOT_Z + upper_local.x * math.sin(TILT)
                    - upper_local.z * math.cos(TILT)))
    cube(PREFIX + 'actuator_mount_lower', (lower.x, ax_y, 0.089),
         (0.060, 0.046, 0.034), 'graphite', r=0.0018)
    cube(PREFIX + 'actuator_mount_upper', (upper_local.x, ax_y,
                                          upper_local.z - 0.005),
         (0.052, 0.040, 0.028), 'graphite', r=0.0016)
    CRADLE.append(bpy.data.objects[PREFIX + 'actuator_mount_upper'])
    mid = lower + (upper - lower) * 0.52
    cyl(PREFIX + 'actuator_body', lower + (upper - lower) * 0.04, mid,
        0.0195, 'graphite', vertices=22, bev=0.0018)
    cyl(PREFIX + 'actuator_rod', mid, upper - (upper - lower) * 0.02, 0.0092,
        'steel', vertices=14)
    cyl(PREFIX + 'actuator_collar', mid, mid + (upper - lower) * 0.10, 0.0135,
        'steel', vertices=18)
    for tag, p in (('lower', lower), ('upper', upper)):
        cyl(PREFIX + f'actuator_bolt_{tag}',
            (p.x, ax_y - 0.024, p.z), (p.x, ax_y + 0.024, p.z), 0.0052,
            'steel', vertices=12)

    # ================= МЯГКИЕ ЭЛЕМЕНТЫ ==================================
    for tag, x, ln in (('head', 0.700, 0.300), ('foot', -0.760, 0.250)):
        pad_z = DECK_TOP + PAD_T * 0.5
        CRADLE.append(cube(PREFIX + f'pad_{tag}', (x, 0.0, pad_z),
                           (ln, PAD_W, PAD_T), 'blush', r=0.0095, smooth=True))
        # кант-шов по периметру подушки
        hx, hy = ln * 0.5 - 0.006, PAD_W * 0.5 - 0.006
        pts = [(x + hx, -hy, pad_z), (x + hx, hy, pad_z),
               (x - hx, hy, pad_z), (x - hx, -hy, pad_z),
               (x + hx, -hy, pad_z)]
        seam = poly_tube(PREFIX + f'pad_{tag}_seam',
                         [(px, py, pz + PAD_T * 0.22) for px, py, pz in pts],
                         0.0024, 'silicone')
        CRADLE.append(seam)
        # кнопки-стяжки
        for btag, bx, by in (('a', -ln * 0.26, -PAD_W * 0.16),
                            ('b', -ln * 0.26, PAD_W * 0.16),
                            ('c', ln * 0.26, 0.0)):
            CRADLE.append(cyl(PREFIX + f'pad_{tag}_button_{btag}',
                              (x + bx, by, pad_z + PAD_T * 0.5 - 0.002),
                              (x + bx, by, pad_z + PAD_T * 0.5 + 0.0035),
                              0.0062, 'dark', vertices=14))

    # бортики-валики вдоль рельсов
    for tag, sy in (('neg', -1), ('pos', 1)):
        b = cyl(PREFIX + f'bolster_{tag}', (-0.560, sy * (RAIL_Y - 0.030), DECK_TOP + BOLSTER_R * 0.55),
                (0.560, sy * (RAIL_Y - 0.030), DECK_TOP + BOLSTER_R * 0.55),
                BOLSTER_R, 'silicone', vertices=22, bev=0.0028)
        CRADLE.append(b)
        for etag, ex in (('head', 1), ('tail', -1)):
            CRADLE.append(sphere(PREFIX + f'bolster_{tag}_cap_{etag}',
                                 (ex * 0.560, sy * (RAIL_Y - 0.030),
                                  DECK_TOP + BOLSTER_R * 0.55),
                                 BOLSTER_R, 'silicone', segs=18, rings=12))

    # быстросъёмные ремни с пряжками
    for tag, sy in (('neg', -1), ('pos', 1)):
        CRADLE.append(cube(PREFIX + f'strap_tab_{tag}',
                           (0.180, sy * (RAIL_Y - 0.005), DECK_TOP + 0.020),
                           (0.055, 0.014, 0.042), 'blush', r=0.0022))
        CRADLE.append(cube(PREFIX + f'strap_buckle_{tag}',
                           (0.180, sy * (RAIL_Y + 0.004), DECK_TOP + 0.036),
                           (0.034, 0.010, 0.014), 'steel', r=0.0014))

    # ================= КАБЕЛЬНЫЙ КАНАЛ ==================================
    u_channel(PREFIX + 'cable_channel', -0.700, 0.360, -0.300, 0.034,
              0.052, 0.030, 0.0045, 'graphite')
    for i, x in enumerate((-0.540, -0.140, 0.240)):
        cube(PREFIX + f'cable_clip_{i}', (x, -0.300, 0.050),
             (0.014, 0.070, 0.012), 'dark', r=0.0010)
    # петля запаса от канала к каретке
    curve_tube(PREFIX + 'cable_loop',
               [(0.335, -0.300, 0.046),
                (0.400, -0.296, 0.090),
                (0.404, -0.288, 0.140),
                (0.330, -0.280, 0.180),
                (0.250, -0.276, 0.198)],
               0.0058, 'dark')
    cube(PREFIX + 'cable_gland', (0.244, -0.274, 0.196),
         (0.026, 0.028, 0.020), 'graphite', r=0.0014)
    cube(PREFIX + 'cable_outlet', (-0.700, -0.300, 0.036),
         (0.030, 0.048, 0.034), 'graphite', r=0.0014)

    # ================= наклон каретки ===================================
    bpy.context.view_layer.update()
    Rm = (Matrix.Translation(Vector((PIVOT_X, 0.0, PIVOT_Z)))
          @ Matrix.Rotation(-TILT, 4, 'Y'))
    for o in CRADLE:
        o.matrix_world = Rm @ o.matrix_world
    bpy.context.view_layer.update()

    root = empty(PREFIX + 'root', (0.0, 0.0, 0.0))
    for o in CRADLE:
        o.parent = root
        o.matrix_parent_inverse = root.matrix_world.inverted()
    bpy.context.view_layer.update()
    return CRADLE


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


def check(cradle_objs):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    mats = sorted(m.name for m in bpy.data.materials if m.users)
    bad = sorted(o.name for o in bpy.data.objects if not o.name.startswith(PREFIX))

    rails = [o for o in meshes if '_rail_' in o.name or o.name.endswith('rail_neg')
             or o.name.endswith('rail_pos')]
    rail_mn, rail_mx = mesh_bbox(rails)

    return {
        'component': CID,
        'code': 'STR-BED-04',
        'nodes': len(objs),
        'mesh_parts': len(meshes),
        'verts': sum(len(o.data.vertices) for o in meshes),
        'faces': sum(len(o.data.polygons) for o in meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(BBOX_PASSPORT),
        'bbox_delta_pct': [round((size[i] / BBOX_PASSPORT[i] - 1) * 100, 1)
                           for i in range(3)],
        'bbox_ok': bool(size.x <= BBOX_PASSPORT[0] * 1.05
                        and size.y <= BBOX_PASSPORT[1] * 1.05
                        and size.z <= BBOX_PASSPORT[2] * 1.02),
        'floor_contact_z': round(mn.z, 5),
        'floor_contact_ok': bool(abs(mn.z) <= 0.001),
        'tilt_deg': TILT_DEG,
        'tilt_range': [0, 30],
        'tilt_lift_head_m': round(mx.z - PIVOT_Z, 4),
        'rail_span_x': round(rail_mx.x - rail_mn.x, 4),
        'rail_span_y': round(rail_mx.y - rail_mn.y, 4),
        'material_count': len(mats),
        'materials': mats,
        'cradle_parts': len(cradle_objs),
        'top_parts': sorted(
            ({'part': o.name.replace(PREFIX, ''),
              'z_max': round(max((o.matrix_world @ Vector(c)).z
                                 for c in o.bound_box), 4)}
             for o in meshes), key=lambda d: -d['z_max'])[:6],
        'motion': 'none',
        'plate': False,
        'bad_names': bad,
        'parts': sorted(o.name.replace(PREFIX, '') for o in objs),
    }


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objects:
        o['component'] = CID
        o['motion'] = 'none'
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').split('_')[0]
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
    scene.view_settings.exposure = 0.15
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

    bpy.ops.mesh.primitive_plane_add(size=6,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.55, 0.60, 0.75), 9.0, 0.80),
            ('fill', (-0.65, 0.45, 0.35), 3.4, 1.00),
            ('rim', (0.10, -0.70, 0.55), 5.0, 0.70)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, 0.10))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), \
            Vector(direction).normalized()

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
    # крупный план: шарнир, сектор наклона, стопорный палец
    close_t = Vector((0.010, -0.352, 0.222))
    c_close = box_corners(Vector((-0.160, -0.476, 0.132)) - close_t,
                          Vector((0.175, -0.296, 0.302)) - close_t)

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

    near = [o for o in mesh_objs
            if ((mesh_bbox([o])[0] + mesh_bbox([o])[1]) * 0.5 - close_t).length < 0.26]

    views = [
        ('3q', (0.80, -0.58, 0.40), center, 85, c_main, 0.92, mesh_objs),
        ('front', (0.02, 1.00, 0.16), center, 85, c_main, 0.94, mesh_objs),
        ('side', (1.00, 0.03, 0.11), center, 85, c_main, 0.94, mesh_objs),
        ('closeup', (0.34, -0.90, 0.26), close_t, 90, c_close, None, near),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, fit_objs in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(0 if fill is None else 5):
            got = max_ndc(fit_objs)
            if abs(got - fill) < 0.015:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} fill={max_ndc(fit_objs):.3f} {fp}', flush=True)
    return outs


def main():
    cradle = build()
    rep = check(cradle)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps({k: v for k, v in rep.items() if k != 'parts'},
                                ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['floor_contact_ok']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
