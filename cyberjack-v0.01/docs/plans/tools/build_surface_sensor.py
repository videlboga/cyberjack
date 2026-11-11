"""Standalone builder: surface_sensor (SRF-SENS-07, «Сенсорный мат»).

Тонкий сенсорный мат 2,0 x 0,9 м: молочная силиконовая основа с плёночным
сенсорным слоем, печатная сетка 16 x 8 = 128 ячеек (графитовые дорожки +
контактные узлы), верхняя шина-шлейф, боковая сборка выводов, контроллер
на коротком торце с индикаторами и портом, кабель в клипсах с разъёмом,
ремни с липучками и заклёпками по углам, маркировка осей X/Y.
Без плиты, без вращений, без анимации. Не зависит от
build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_surface_sensor.py

Выход:
  public/models/machine-modules/components/surface_sensor.glb
  docs/plans/blockout/component-library/surface_sensor/*.png
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/surface_sensor'
CID = 'surface_sensor'
PREFIX = CID + '__'

# --- габарит по паспорту (м) ----------------------------------------------
HX, HY = 1.000, 0.450           # полугабариты 2,0 x 0,9
R_MAT = 0.045                   # скругление плана
Z_SLAB1 = 0.0088                # верх силиконовой основы
Z_FILM1 = 0.0094                # верх сенсорной плёнки (толщина мата 10,5 мм с кантом)

# --- сенсорное поле -------------------------------------------------------
FX, FY = 0.820, 0.345           # полугабариты поля 1,64 x 0,69
NX, NY = 16, 8                  # 128 ячеек (вариант «128 зон»)
PX, PY = 2 * FX / NX, 2 * FY / NY
FRAME_W = 0.014                 # печатная рамка вокруг поля
Z_TRACE0, Z_TRACE1 = Z_FILM1, Z_FILM1 + 0.0003
Z_NODE1 = Z_FILM1 + 0.0006
Z_PAD1 = Z_FILM1 + 0.0006
BUS_Y = 0.379                   # ось верхней шины-шлейфа
RAIL_X = -0.855                 # ось боковой сборки выводов

# --- контроллер / кабель --------------------------------------------------
POD_X0, POD_X1 = -0.950, -0.855
POD_Y0, POD_Y1 = -0.045, 0.045
POD_Z1 = 0.0132
LID_Z1 = 0.0140
CABLE_Z = 0.0112
CABLE_R = 0.0027

# --- ремни ----------------------------------------------------------------
STRAP_HW = 0.018
STRAP_Z0, STRAP_Z1 = Z_FILM1 + 0.0002, Z_FILM1 + 0.0014
STRAP_LEN = 0.105

PALETTE = {
    'milk': (0.885, 0.878, 0.862),
    'pale': (0.945, 0.940, 0.928),
    'graphite': (0.105, 0.112, 0.125),
    'dark': (0.055, 0.060, 0.070),
    'steel': (0.690, 0.696, 0.690),
    'cyan': (0.520, 0.870, 0.910),
    'strap': (0.185, 0.200, 0.225),
    'hook': (0.660, 0.652, 0.632),
    'ink': (0.060, 0.066, 0.075),
}
ROUGH = {'milk': 0.70, 'pale': 0.52, 'graphite': 0.42, 'dark': 0.44,
         'steel': 0.30, 'cyan': 0.38, 'strap': 0.90, 'hook': 0.94,
         'ink': 0.48}
METAL = {'steel': 0.88, 'graphite': 0.0, 'dark': 0.0}
MATS = {}


# --- helpers --------------------------------------------------------------
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
    bsdf.inputs['Roughness'].default_value = ROUGH.get(role, 0.6)
    bsdf.inputs['Metallic'].default_value = METAL.get(role, 0.0)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.30
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def bevel(obj, width=0.0015, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def rounded_rect(hx, hy, r, seg=12):
    r = max(r, 1e-4)
    pts = []
    for ox, oy, a0 in ((hx - r, hy - r, 0.0), (-(hx - r), hy - r, math.pi * 0.5),
                       (-(hx - r), -(hy - r), math.pi),
                       (hx - r, -(hy - r), math.pi * 1.5)):
        for k in range(seg + 1):
            a = a0 + (math.pi * 0.5) * k / seg
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def prism(name, hx, hy, r, levels, role, cx=0.0, cy=0.0, seg=12, smooth=False):
    """Плита со скруглённым планом и профилем levels=[(z, inset), ...]."""
    bm = bmesh.new()
    rings = []
    for z, ins in levels:
        pts = rounded_rect(hx - ins, hy - ins, max(r - ins, 0.0008), seg)
        rings.append([bm.verts.new((cx + x, cy + y, z)) for x, y in pts])
    n = len(rings[0])
    for i in range(len(rings) - 1):
        for k in range(n):
            a, b = rings[i][k], rings[i][(k + 1) % n]
            c, d = rings[i + 1][(k + 1) % n], rings[i + 1][k]
            bm.faces.new((a, b, c, d))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))
    return mesh_from_bm(name, bm, role, smooth)


def piping(name, hx, hy, r, bevel_r, z, role):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel_r
    cu.bevel_resolution = 5
    cu.resolution_u = 4
    pts = rounded_rect(hx, hy, r, seg=12)
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, (x, y) in zip(sp.points, pts):
        p.co = (x, y, z, 1.0)
    sp.use_cyclic_u = True
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def add_box(bm, center, size, rot_z=0.0):
    m = (Matrix.Translation(Vector(center))
         @ Matrix.Rotation(rot_z, 4, 'Z')
         @ Matrix.Diagonal(Vector(size).to_4d()))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bar(bm, p0, p1, hw, z0, z1, arc=3):
    """Печатная дорожка (брусок с полукруглым верхом) между 2D-точками."""
    a = Vector((p0[0], p0[1], 0.0))
    b = Vector((p1[0], p1[1], 0.0))
    d = b - a
    if d.length < 1e-6:
        return
    d.normalize()
    s = Vector((-d.y, d.x, 0.0))
    rt = min(hw, max(z1 - z0, 1e-5))
    prof = [(-hw, z0), (hw, z0)]
    for k in range(arc + 1):
        ang = math.pi * k / arc
        prof.append((rt * math.cos(ang), z1 - rt + rt * math.sin(ang)))
    rings = []
    for base in (a, b):
        rings.append([bm.verts.new((base.x + s.x * u, base.y + s.y * u, w))
                      for u, w in prof])
    n = len(prof)
    for k in range(n):
        bm.faces.new((rings[0][k], rings[0][(k + 1) % n],
                      rings[1][(k + 1) % n], rings[1][k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[1]))


def disc(bm, cx, cy, r, z0, z1, segs=16):
    bot = [bm.verts.new((cx + r * math.cos(math.tau * k / segs),
                         cy + r * math.sin(math.tau * k / segs), z0))
           for k in range(segs)]
    top = [bm.verts.new((cx + r * math.cos(math.tau * k / segs),
                         cy + r * math.sin(math.tau * k / segs), z1))
           for k in range(segs)]
    for k in range(segs):
        bm.faces.new((bot[k], bot[(k + 1) % segs], top[(k + 1) % segs], top[k]))
    bm.faces.new(tuple(reversed(bot)))
    bm.faces.new(tuple(top))


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
        select_only(obj)
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def curve_tube(name, points, radius, role, res=8):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 16
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
    o = bpy.context.object
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def text_obj(name, body, size, loc, role, rot_z=0.0, extrude=0.0002):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'LEFT'
    cu.align_y = 'BOTTOM_BASELINE'
    cu.extrude = extrude
    if cu.font is None and len(bpy.data.fonts):
        cu.font = bpy.data.fonts[0]
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    obj.rotation_euler = (0.0, 0.0, rot_z)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def sweep_band(bm, path, hw, z0, thickness):
    """Горизонтальная лента постоянной ширины по 2D-пути (план)."""
    n = len(path)
    frames = []
    for i, p in enumerate(path):
        a = path[max(i - 1, 0)]
        b = path[min(i + 1, n - 1)]
        t = Vector((b[0] - a[0], b[1] - a[1], 0.0))
        if t.length < 1e-9:
            t = Vector((1.0, 0.0, 0.0))
        t.normalize()
        s = Vector((t.y, -t.x, 0.0)) * hw
        c = Vector((p[0], p[1], z0))
        frames.append((c - s, c + s, thickness))
    rings = []
    for c0, c1, th in frames:
        rings.append([bm.verts.new(c0),
                      bm.verts.new(c1),
                      bm.verts.new(c1 + Vector((0, 0, th))),
                      bm.verts.new(c0 + Vector((0, 0, th)))])
    for a, b in zip(rings, rings[1:]):
        for k in range(4):
            bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))


# --- сборка ---------------------------------------------------------------
def build():
    reset()
    parts = []

    # 1. силиконовая основа
    parts.append(prism(
        PREFIX + 'base_sheet', HX, HY, R_MAT,
        [(0.0, 0.0018), (0.0010, 0.0), (Z_SLAB1 - 0.0012, 0.0),
         (Z_SLAB1, 0.0016)],
        'milk', seg=14, smooth=True))

    # 2. сенсорная плёнка (молочный верхний слой)
    parts.append(prism(
        PREFIX + 'sensor_film', HX - 0.0018, HY - 0.0018, R_MAT - 0.0018,
        [(Z_SLAB1, 0.0000), (Z_FILM1 - 0.0002, 0.0), (Z_FILM1, 0.0004)],
        'pale', seg=14, smooth=True))

    # 3. кант по кромке
    parts.append(piping(PREFIX + 'edge_rim', HX - 0.0050, HY - 0.0050,
                         R_MAT - 0.0050, 0.0010, Z_FILM1 - 0.0002, 'graphite'))

    # 4. печатная рамка поля
    bm = bmesh.new()
    fo_x, fo_y = FX + FRAME_W, FY + FRAME_W
    for cz, ext in (((FY + fo_y) * 0.5, (fo_y - FY) * 0.5 + 0.0008),
                    (-(FY + fo_y) * 0.5, (fo_y - FY) * 0.5 + 0.0008)):
        add_box(bm, (0.0, cz, Z_FILM1 + 0.0002),
                (2 * fo_x, ext * 2, 0.00045))
    for cx, ext in (((FX + fo_x) * 0.5, (fo_x - FX) * 0.5 + 0.0008),
                    (-(FX + fo_x) * 0.5, (fo_x - FX) * 0.5 + 0.0008)):
        add_box(bm, (cx, 0.0, Z_FILM1 + 0.0002),
                (ext * 2, 2 * FY, 0.00045))
    parts.append(mesh_from_bm(PREFIX + 'field_frame', bm, 'dark', False))

    # координаты ячеек
    col_x = [-FX + (i + 0.5) * PX for i in range(NX)]
    row_y = [-FY + (j + 0.5) * PY for j in range(NY)]

    # 5. столбцовые дорожки
    bm = bmesh.new()
    for x in col_x:
        bar(bm, (x, -FY), (x, FY), 0.0020, Z_TRACE0, Z_TRACE1, 2)
    parts.append(mesh_from_bm(PREFIX + 'trace_columns', bm, 'graphite', False))

    # 6. строчные дорожки
    bm = bmesh.new()
    for y in row_y:
        bar(bm, (-FX, y), (FX, y), 0.0020, Z_TRACE0, Z_TRACE1, 2)
    parts.append(mesh_from_bm(PREFIX + 'trace_rows', bm, 'graphite', False))

    # 7. сенсорные узлы (ячейки матрицы)
    bm = bmesh.new()
    for x in col_x:
        for y in row_y:
            disc(bm, x, y, 0.0065, Z_FILM1, Z_NODE1, 16)
    parts.append(mesh_from_bm(PREFIX + 'sensor_nodes', bm, 'dark', False))

    # 8. контактные площадки нижней кромки поля
    bm = bmesh.new()
    for x in col_x:
        add_box(bm, (x, -FY - 0.0092, Z_FILM1 + 0.0002),
                (0.0110, 0.0075, 0.00065))
    for y in row_y:
        add_box(bm, (-FX - 0.0072, y, Z_FILM1 + 0.0002),
                (0.0075, 0.0110, 0.00065))
    parts.append(mesh_from_bm(PREFIX + 'contact_pads', bm, 'steel', False))

    # 9. выводы столбцов к верхней шине
    bm = bmesh.new()
    for x in col_x:
        bar(bm, (x, FY + FRAME_W + 0.0015), (x, BUS_Y + 0.008), 0.0013,
            Z_TRACE0, Z_TRACE1, 2)
    parts.append(mesh_from_bm(PREFIX + 'column_leads', bm, 'graphite', False))

    # 10. выводы строк к боковой сборке
    bm = bmesh.new()
    for y in row_y:
        bar(bm, (-FX - FRAME_W - 0.0015, y), (RAIL_X + 0.004, y), 0.0013,
            Z_TRACE0, Z_TRACE1, 2)
    parts.append(mesh_from_bm(PREFIX + 'row_leads', bm, 'graphite', False))

    # 11. боковая сборка выводов
    bm = bmesh.new()
    bar(bm, (RAIL_X, FY + 0.010), (RAIL_X, 0.030), 0.0050,
        Z_FILM1, Z_FILM1 + 0.0007, 2)
    parts.append(mesh_from_bm(PREFIX + 'lead_bundle', bm, 'dark', False))

    # 12. верхняя шина-шлейф
    bm = bmesh.new()
    bar(bm, (RAIL_X, BUS_Y), (FX + 0.006, BUS_Y), 0.0125,
        Z_FILM1, Z_FILM1 + 0.0007, 2)
    for dy in (-0.0060, -0.0030, 0.0, 0.0030, 0.0060):
        bar(bm, (RAIL_X + 0.004, BUS_Y + dy), (FX + 0.004, BUS_Y + dy),
            0.00055, Z_FILM1 + 0.0007, Z_FILM1 + 0.0009, 2)
    parts.append(mesh_from_bm(PREFIX + 'flex_bus', bm, 'dark', False))

    # 13. корпус контроллера
    cx, cy = (POD_X0 + POD_X1) * 0.5, (POD_Y0 + POD_Y1) * 0.5
    hx_p, hy_p = (POD_X1 - POD_X0) * 0.5, (POD_Y1 - POD_Y0) * 0.5
    parts.append(prism(
        PREFIX + 'controller_body', hx_p, hy_p, 0.010,
        [(Z_FILM1, 0.0012), (Z_FILM1 + 0.0006, 0.0),
         (POD_Z1 - 0.0010, 0.0), (POD_Z1, 0.0010)],
        'graphite', cx=cx, cy=cy, seg=8, smooth=True))

    # 14. крышка / панель индикации
    parts.append(prism(
        PREFIX + 'controller_lid', hx_p - 0.010, hy_p - 0.011, 0.006,
        [(POD_Z1, 0.0), (LID_Z1 - 0.0003, 0.0), (LID_Z1, 0.0004)],
        'dark', cx=cx, cy=cy, seg=6, smooth=False))

    # 15. порт (USB-C) на торце контроллера
    bm = bmesh.new()
    add_box(bm, (POD_X0 + 0.005, cy - 0.012, 0.0112),
            (0.012, 0.021, 0.0038))
    parts.append(mesh_from_bm(PREFIX + 'controller_port', bm, 'dark', False))

    # 16. индикаторы
    bm = bmesh.new()
    for dy, r in ((0.026, 0.0028), (0.014, 0.0026)):
        disc(bm, cx + 0.020, cy + dy, r, LID_Z1, LID_Z1 + 0.0005, 14)
    parts.append(mesh_from_bm(PREFIX + 'led_power', bm, 'cyan', True))

    bm = bmesh.new()
    disc(bm, cx + 0.020, cy + 0.002, 0.0026, LID_Z1, LID_Z1 + 0.0005, 14)
    parts.append(mesh_from_bm(PREFIX + 'led_link', bm, 'cyan', True))

    # 17. винты крышки
    bm = bmesh.new()
    for sx in (-1, 1):
        for sy in (-1, 1):
            disc(bm, cx + sx * (hx_p - 0.010), cy + sy * (hy_p - 0.011),
                 0.0032, LID_Z1 - 0.0004, LID_Z1 + 0.0002, 12)
    parts.append(mesh_from_bm(PREFIX + 'screws', bm, 'steel', False))

    # 18. маркировка на крышке
    parts.append(text_obj(PREFIX + 'label_code', 'SRF-SENS-07', 0.0072,
                          (cx - 0.038, cy - 0.004, LID_Z1 + 0.0001), 'pale',
                          extrude=0.00015))
    parts.append(text_obj(PREFIX + 'label_zones', '128 ZONES', 0.0058,
                          (cx - 0.038, cy - 0.020, LID_Z1 + 0.0001), 'pale',
                          extrude=0.00012))

    # 19. гермоввод
    parts.append(cyl(PREFIX + 'strain_relief',
                      (POD_X0 + 0.002, -0.010, CABLE_Z),
                      (POD_X0 - 0.012, -0.010, CABLE_Z),
                      0.0040, 'dark', vertices=16, smooth=True, r2=0.0032))

    # 20. кабель по левой кромке
    parts.append(curve_tube(PREFIX + 'cable', [
        (POD_X0 - 0.010, -0.012, CABLE_Z),
        (POD_X0 - 0.021, -0.026, CABLE_Z),
        (POD_X0 - 0.026, -0.070, CABLE_Z),
        (POD_X0 - 0.026, -0.160, CABLE_Z),
        (POD_X0 - 0.024, -0.250, CABLE_Z),
        (POD_X0 - 0.018, -0.286, CABLE_Z),
        (POD_X0 - 0.006, -0.300, CABLE_Z),
    ], CABLE_R, 'graphite'))

    # 21. клипсы кабеля (седло: две стойки + перекладина)
    bm = bmesh.new()
    for cyc in (-0.105, -0.205):
        cxc = POD_X0 - 0.026
        for s in (-1, 1):
            add_box(bm, (cxc, cyc + s * (CABLE_R + 0.0020),
                         Z_FILM1 + 0.0023), (0.015, 0.0032, 0.0046))
        add_box(bm, (cxc, cyc, Z_FILM1 + 0.0051),
                (0.015, 2 * (CABLE_R + 0.0044), 0.0010))
    parts.append(mesh_from_bm(PREFIX + 'cable_clips', bm, 'steel', False))

    # 22. разъём на конце кабеля
    bm = bmesh.new()
    add_box(bm, (POD_X0 + 0.006, -0.308, CABLE_Z + 0.0008),
            (0.0125, 0.024, 0.0056))
    add_box(bm, (POD_X0 + 0.006, -0.322, CABLE_Z + 0.0018),
            (0.0075, 0.008, 0.0034))
    parts.append(mesh_from_bm(PREFIX + 'connector_body', bm, 'dark', False))

    parts.append(cyl(PREFIX + 'connector_ferrule',
                     (POD_X0 + 0.002, -0.288, CABLE_Z),
                     (POD_X0 + 0.002, -0.298, CABLE_Z),
                     0.0032, 'steel', vertices=14, smooth=True))

    # 23-26. ремни по углам (лента вдоль кромки + загиб вниз)
    straps = []
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        tag = ('p' if sx > 0 else 'n') + ('p' if sy > 0 else 'n')
        name = PREFIX + f'strap_{tag}'
        ax, ay = sx * (HX - R_MAT), sy * (HY - R_MAT)
        path = []
        # вдоль длинной кромки
        x0 = sx * (HX - STRAP_LEN)
        for i in range(9):
            t = i / 8.0
            path.append((x0 + (ax - x0) * t, sy * (HY - STRAP_HW)))
        # дуга угла
        rin = R_MAT - STRAP_HW
        for i in range(1, 13):
            th = (math.pi * 0.5) * i / 12
            path.append((ax + sx * rin * math.sin(th), ay + sy * rin * math.cos(th)))
        # вдоль короткой кромки
        y0 = sy * (HY - R_MAT)
        for i in range(1, 9):
            t = i / 8.0
            path.append((sx * (HX - STRAP_HW),
                         y0 + (sy * (HY - STRAP_LEN) - y0) * t))
        bm = bmesh.new()
        sweep_band(bm, path, STRAP_HW, STRAP_Z0, STRAP_Z1 - STRAP_Z0)
        straps.append(mesh_from_bm(name, bm, 'strap', False))

    # язычок-загиб на углу
    bm = bmesh.new()
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        ax, ay = sx * (HX - R_MAT), sy * (HY - R_MAT)
        d = Vector((sx, sy, 0.0)).normalized()
        s = Vector((-sy, sx, 0.0)).normalized()
        c0 = Vector((ax, ay, 0.0)) + d * (R_MAT - STRAP_HW)
        frames = []
        for t, dz, up in ((0.0, 0.0, Vector((0, 0, 1))),
                          (0.008, -0.0012, (d * 0.7 + Vector((0, 0, 0.7))).normalized()),
                          (0.015, -0.0042, d),
                          (0.017, -0.0068, d)):
            c = c0 + d * t + Vector((0, 0, STRAP_Z0 + dz))
            frames.append((c, s * STRAP_HW, up * (STRAP_Z1 - STRAP_Z0)))
        rings = []
        for c, sv, up in frames:
            rings.append([bm.verts.new(c - sv),
                          bm.verts.new(c + sv),
                          bm.verts.new(c + sv + up),
                          bm.verts.new(c - sv + up)])
        for a, b in zip(rings, rings[1:]):
            for k in range(4):
                bm.faces.new((a[k], a[(k + 1) % 4], b[(k + 1) % 4], b[k]))
        bm.faces.new(tuple(reversed(rings[0])))
        bm.faces.new(tuple(rings[-1]))
    parts.append(mesh_from_bm(PREFIX + 'strap_tabs', bm, 'strap', False))

    # 27. липучки на ремнях
    bm = bmesh.new()
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        add_box(bm, (sx * (HX - STRAP_LEN + 0.022), sy * (HY - STRAP_HW),
                     STRAP_Z1 + 0.00025),
                (0.026, 0.0190, 0.0005))
        add_box(bm, (sx * (HX - STRAP_HW), sy * (HY - STRAP_LEN + 0.022),
                     STRAP_Z1 + 0.00025),
                (0.0190, 0.026, 0.0005))
    parts.append(mesh_from_bm(PREFIX + 'velcro_patches', bm, 'hook', False))

    # 28. заклёпки крепления ремней
    bm = bmesh.new()
    for sx, sy in ((1, 1), (-1, 1), (1, -1), (-1, -1)):
        for cx2, cy2 in ((sx * (HX - STRAP_LEN + 0.010), sy * (HY - STRAP_HW)),
                         (sx * (HX - STRAP_HW), sy * (HY - STRAP_LEN + 0.010))):
            disc(bm, cx2, cy2, 0.0040, STRAP_Z1, STRAP_Z1 + 0.0009, 12)
    parts.append(mesh_from_bm(PREFIX + 'strap_rivets', bm, 'steel', True))

    # 29. маркировка осей
    ox, oy = -0.762, -0.430
    bm = bmesh.new()
    bar(bm, (ox, oy), (ox + 0.082, oy), 0.0017, Z_FILM1, Z_FILM1 + 0.0005, 2)
    bar(bm, (ox + 0.082, oy), (ox + 0.068, oy + 0.0062), 0.0016,
        Z_FILM1, Z_FILM1 + 0.0005, 2)
    bar(bm, (ox + 0.082, oy), (ox + 0.068, oy - 0.0062), 0.0016,
        Z_FILM1, Z_FILM1 + 0.0005, 2)
    parts.append(mesh_from_bm(PREFIX + 'axis_x', bm, 'ink', False))

    bm = bmesh.new()
    bar(bm, (ox, oy), (ox, oy + 0.050), 0.0017, Z_FILM1, Z_FILM1 + 0.0005, 2)
    bar(bm, (ox, oy + 0.050), (ox + 0.0062, oy + 0.0365), 0.0016,
        Z_FILM1, Z_FILM1 + 0.0005, 2)
    bar(bm, (ox, oy + 0.050), (ox - 0.0062, oy + 0.0365), 0.0016,
        Z_FILM1, Z_FILM1 + 0.0005, 2)
    parts.append(mesh_from_bm(PREFIX + 'axis_y', bm, 'ink', False))

    parts.append(text_obj(PREFIX + 'label_x', 'X', 0.015,
                          (ox + 0.090, oy - 0.0055, Z_FILM1 + 0.0001), 'ink'))
    parts.append(text_obj(PREFIX + 'label_y', 'Y', 0.015,
                          (ox + 0.0036, oy + 0.0545, Z_FILM1 + 0.0001), 'ink'))
    parts.append(text_obj(PREFIX + 'label_field', 'SENSOR FIELD 128', 0.011,
                          (ox + 0.170, oy + 0.006, Z_FILM1 + 0.0001), 'ink'))

    bpy.context.view_layer.update()
    return parts


# --- проверки -------------------------------------------------------------
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
    mats = sorted({m.name for o in meshes for m in o.data.materials if m})
    verts = sum(len(o.data.vertices) for o in meshes)
    tris = sum(len(o.data.loop_triangles) for o in meshes)
    rep = {
        'component': CID,
        'code': 'SRF-SENS-07',
        'class': 'SURFACE',
        'nodes': len(objs),
        'meshes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [2.0, 0.9, 0.01],
        'mat_thickness_mm': round((Z_FILM1 + 0.0010) * 1000, 2),
        'assembly_thickness_mm': round(size.z * 1000, 2),
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.004
                        and abs(size.y - 0.9) <= 0.004
                        and 0.012 <= size.z <= 0.018),
        'flat_on_floor': bool(abs(mn.z) < 2e-4),
        'grid': [NX, NY],
        'zones': NX * NY,
        'pitch_mm': [round(PX * 1000, 2), round(PY * 1000, 2)],
        'field_mm': [round(2 * FX * 1000, 1), round(2 * FY * 1000, 1)],
        'materials': mats,
        'material_count': len(mats),
        'verts': verts,
        'tris': tris,
        'parts': sorted(o.name for o in objs),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
        'animations': 0,
    }
    return rep, meshes


def export():
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objs:
        o['component'] = CID
        o['motion'] = 'none'
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').split('_')[0]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    path = OUT / f'{CID}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    return path


# --- рендеры --------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.22
    try:
        scene.eevee.taa_render_samples = 128
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.740, 0.735, 0.725, 1.0)
    bg.inputs['Strength'].default_value = 0.35

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5
    S = max((mx - mn).x, (mx - mn).y)

    bpy.ops.mesh.primitive_plane_add(size=S * 4.0,
                                     location=(center.x, center.y, mn.z - 0.0002))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.470, 0.464, 0.455, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    for name, offset, energy, sz in (
            ('key', (0.55 * S, -0.85 * S, 0.95 * S), 96.0, 1.10 * S),
            ('fill', (-0.85 * S, -0.55 * S, 0.45 * S), 26.0, 1.30 * S),
            ('rim', (0.05 * S, 0.90 * S, 0.75 * S), 48.0, 1.00 * S)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(offset) + Vector((center.x, center.y, center.z))
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
    # close-up: узел «поле + контроллер + шина»
    close_t = Vector((-0.795, 0.035, 0.006))
    c_close = box_corners(Vector((-0.995, -0.345, 0.0)) - close_t,
                          Vector((-0.60, 0.42, 0.02)) - close_t)

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
        ('3q', (-0.80, 0.62, 0.50), center, 55, c_main, 0.92, True),
        ('front', (0.04, -1.00, 0.22), center, 55, c_main, 0.97, True),
        ('side', (1.00, -0.06, 0.22), center, 55, c_main, 0.97, True),
        ('closeup', (0.72, -0.62, 0.45), close_t, 80, c_close, 0.95, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, fb in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners, 1.06 if not fb else 1.12)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if fb:
            for _ in range(5):
                got = max_ndc(fill)
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
        print(f'RENDERED {tag} fill={max_ndc(fill):.3f} {fp}', flush=True)
    return outs


def preview_300():
    """Уменьшенные копии 300 px — проверка читаемости силуэта."""
    outs = []
    for tag in ('3q', 'front', 'side', 'closeup'):
        src = RENDER_DIR / f'{CID}_{tag}.png'
        if not src.is_file():
            continue
        img = bpy.data.images.load(str(src))
        w, h = img.size
        nw = 300
        nh = max(1, round(h * nw / w))
        img.scale(nw, nh)
        dst = RENDER_DIR / f'{CID}_{tag}_300px.png'
        img.filepath_raw = str(dst)
        img.file_format = 'PNG'
        img.save()
        bpy.data.images.remove(img)
        outs.append(str(dst.relative_to(PROJECT)))
    return outs


def main():
    parts = build()
    rep, meshes = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    rep['previews_300px'] = preview_300()
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['flat_on_floor']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and rep['zones'] == 128):
        raise SystemExit('checks failed')


main()
