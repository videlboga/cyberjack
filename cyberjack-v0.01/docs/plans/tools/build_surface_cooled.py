"""Standalone builder: surface_cooled (SRF-COLD-04, «Охлаждение»).

Охлаждаемый мат 2,0 x 0,9 x 0,05 м: молочный силиконовый чехол со
скруглённой кромкой, верхняя обшивка с внутренним серпантином каналов
(циановые полосы) и валиками сварных швов, распределительная голова на
торце с двумя штуцерами (вход/выход), короткие шланги с разъёмами,
датчик температуры с кабелем, липучки-ремни по длинным кромкам и
люверсы для крепления в раму. Плиты-основания нет, вращения нет.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_surface_cooled.py

Выход:
  public/models/machine-modules/components/surface_cooled.glb
  docs/plans/blockout/component-library/surface_cooled/*.png
  docs/plans/blockout/component-library/surface_cooled/report.json

Геометрия (Blender Z-up, метры):
  X = длина 2,000, Y = ширина 0,900, Z = высота 0,049 (шланги/штуцеры),
  тело мата 0,030 по паспорту, лежит на z = 0, центр в XY в нуле.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/surface_cooled'
CID = 'surface_cooled'
PREFIX = CID + '__'

# --- ключевые размеры (м) -------------------------------------------------
# корпус
BODY_HX, BODY_HY, BODY_R = 0.988, 0.438, 0.032
BODY_Z0, BODY_Z1 = 0.0022, 0.0300
BACK_HX, BACK_HY, BACK_R = 0.984, 0.434, 0.030
BACK_Z1 = 0.0032

# кант-трубка: путь 0,992 x 0,442, трубка Ø16 -> внешний габарит 2,000 x 0,900
RIM_HX, RIM_HY, RIM_R = 0.992, 0.442, 0.032
RIM_BEVEL, RIM_Z = 0.0080, 0.0165

# верхняя обшивка (охлаждающая поверхность)
COV_HX, COV_HY, COV_R = 0.966, 0.416, 0.026
COV_LEVELS = [(0.0296, 0.0016), (0.0306, 0.0), (0.0332, 0.0), (0.0344, 0.0022)]
COV_TOP = 0.0344

# серпантин каналов: 12 проходов вдоль Y, полукруглые повороты на торцах
NPASS = 12
FX0, FX1 = -0.800, 0.800
PITCH = (FX1 - FX0) / (NPASS - 1)          # 0,14545
YRUN = 0.300                                # прямые участки -0,30..+0,30
TURN_R = PITCH * 0.5
CH_R, CH_SQUASH_Z = 0.0075, 0.0342          # Ø15, сжат по Z до 55 %
CH_LOW = 0.0318                             # заглубление под головой
CH_SQUASH = 0.45
RETURN_Y = -0.392                           # обратная магистраль по нижней кромке

# сварные швы между каналами
SEAM_HW, SEAM_Z0, SEAM_Z1 = 0.0042, 0.0326, 0.0356
SEAM_ZONE_HW = 0.0062
ZONE_SEAMS = (3, 7)

# распределительная голова + штуцеры (левый торец)
HEAD_X0, HEAD_X1 = -0.950, -0.892
HEAD_Y0, HEAD_Y1 = -0.330, -0.130
HEAD_Z0, HEAD_Z1 = 0.0300, 0.0372
PORT_X = -0.921
PORT_YS = (-0.285, -0.185)
PORT_Z = 0.0415          # ось углового патрубка (высота сборки <= 0,05)
BARB_R = 0.0076

HOSE_R = 0.0060
HOSE_A = [(-0.869, -0.285, 0.0418), (-0.845, -0.300, 0.0421),
          (-0.832, -0.322, 0.0398), (-0.826, -0.340, 0.0364)]
HOSE_B = [(-0.869, -0.185, 0.0418), (-0.884, -0.152, 0.0424),
          (-0.892, -0.060, 0.0428), (-0.891, 0.090, 0.0424),
          (-0.882, 0.225, 0.0402), (-0.873, 0.320, 0.0372),
          (-0.870, 0.352, 0.0356)]
COUP_A = (-0.826, -0.350, 0.0312)
COUP_B = (-0.870, 0.372, 0.0320)

# датчик температуры (правый борт)
SEN_CX, SEN_CY = 0.905, 0.060
SEN_HX, SEN_HY = 0.030, 0.042
SEN_Z0, SEN_Z1 = 0.0338, 0.0452

# ремни-липучки и люверсы
STRAP_HX, STRAP_HY = 0.050, 0.018
STRAP_XS = (-0.420, 0.420)
STRAP_TOP_Y, STRAP_BOT_Y = 0.400, -0.420
GROMMET_XS = (-0.880, 0.880)
GROMMET_TOP_Y, GROMMET_BOT_Y = 0.404, -0.418

LABEL_CX, LABEL_CY = 0.0, 0.400

PALETTE_TAIL = {
    'milk': (0.890, 0.872, 0.838),
    'ivory': (0.942, 0.932, 0.912),
    'groove': (0.300, 0.288, 0.276),
    'seam': (0.632, 0.610, 0.582),
    'cyan': (0.235, 0.685, 0.775),
    'graphite': (0.130, 0.138, 0.148),
    'steel': (0.552, 0.568, 0.580),
    'webbing': (0.300, 0.365, 0.420),
    'velcro': (0.205, 0.210, 0.218),
    'backing': (0.375, 0.410, 0.412),
}
PALETTE = PALETTE_TAIL
ROUGH = {'milk': 0.78, 'ivory': 0.82, 'groove': 0.86, 'seam': 0.93, 'cyan': 0.34,
         'graphite': 0.56, 'steel': 0.44, 'webbing': 0.92,
         'velcro': 0.96, 'backing': 0.60}
METAL = {'steel': 0.72, 'graphite': 0.06}
MATS = {}


# --- helpers --------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_cool_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = METAL.get(role, 0.0)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.30
    try:
        bsdf.inputs['Sheen Weight'].default_value = 0.35 if role in (
            'ivory', 'milk', 'webbing') else 0.10
        bsdf.inputs['Specular IOR Level'].default_value = 0.44
    except Exception:
        pass
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def rounded_rect(hx, hy, r, seg=8):
    """Замкнутый контур со скруглёнными углами, CCW."""
    r = max(min(r, hx, hy), 1e-5)
    cx, cy = hx - r, hy - r
    pts = []
    for ox, oy, a0 in ((cx, cy, 0.0), (-cx, cy, math.pi * 0.5),
                       (-cx, -cy, math.pi), (cx, -cy, math.pi * 1.5)):
        for k in range(seg + 1):
            a = a0 + (math.pi * 0.5) * k / seg
            pts.append((ox + r * math.cos(a), oy + r * math.sin(a)))
    return pts


def prism(name, hx, hy, r, levels, role, cx=0.0, cy=0.0, seg=10, smooth=True):
    """Скруглённая по углам плита по профилю levels=[(z, inset), ...]."""
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


def piping(name, hx, hy, r, bevel, z, role):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel
    cu.bevel_resolution = 5
    cu.resolution_u = 4
    pts = rounded_rect(hx, hy, r, seg=10)
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


def curve_mesh(name, pts, radius, role, squash=1.0, squash_z=0.0, res=4):
    """Трубка по полилинии; squash<1 -> плоская лента (канал, шланг)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 1
    cu.use_fill_caps = True
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, co in zip(sp.points, pts):
        p.co = (co[0], co[1], co[2], 1.0)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    o.name = name
    if squash != 1.0:
        for v in o.data.vertices:
            v.co.z = squash_z + (v.co.z - squash_z) * squash
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def bar(bm, p0, p1, hw, z0, z1, arc=4):
    """Брусок с полукруглым верхом между 2D-точками p0..p1."""
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
        ring = [bm.verts.new((base.x + s.x * u, base.y + s.y * u, w))
                for u, w in prof]
        rings.append(ring)
    n = len(prof)
    for k in range(n):
        bm.faces.new((rings[0][k], rings[0][(k + 1) % n],
                      rings[1][(k + 1) % n], rings[1][k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[1]))


def disc(bm, cx, cy, z, r, segs=24):
    c = bm.verts.new((cx, cy, z))
    ring = [bm.verts.new((cx + r * math.cos(math.tau * k / segs),
                          cy + r * math.sin(math.tau * k / segs), z))
            for k in range(segs)]
    for k in range(segs):
        bm.faces.new((c, ring[k], ring[(k + 1) % segs]))


def flat_ring(bm, cx, cy, z, major, minor, segs=28, rings=7):
    grid = []
    for i in range(segs):
        th = math.tau * i / segs
        row = []
        for j in range(rings):
            ph = math.tau * j / rings
            rr = major + minor * math.cos(ph)
            row.append(bm.verts.new((cx + rr * math.cos(th),
                                     cy + rr * math.sin(th),
                                     z + minor * math.sin(ph))))
        grid.append(row)
    for i in range(segs):
        for j in range(rings):
            a = grid[i][j]
            b = grid[(i + 1) % segs][j]
            c = grid[(i + 1) % segs][(j + 1) % rings]
            d = grid[i][(j + 1) % rings]
            bm.faces.new((a, b, c, d))


def dome(bm, cx, cy, r, h, z0, segs=12, rings=4):
    top = bm.verts.new((cx, cy, z0 + h))
    rows = []
    for i in range(1, rings + 1):
        th = (math.pi * 0.5) * i / rings
        rr, zz = r * math.sin(th), z0 + h * math.cos(th)
        rows.append([bm.verts.new((cx + rr * math.cos(math.tau * k / segs),
                                   cy + rr * math.sin(math.tau * k / segs), zz))
                     for k in range(segs)])
    for k in range(segs):
        bm.faces.new((top, rows[0][k], rows[0][(k + 1) % segs]))
    for i in range(len(rows) - 1):
        for k in range(segs):
            bm.faces.new((rows[i][k], rows[i][(k + 1) % segs],
                          rows[i + 1][(k + 1) % segs], rows[i + 1][k]))
    bm.faces.new(tuple(reversed(rows[-1])))


def cyl(name, a, b, radius, role, vertices=24, r2=None, bevel=0.0):
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
    if bevel > 0:
        select_only(obj)
        mod = obj.modifiers.new('bev', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(40)
        bpy.ops.object.modifier_apply(modifier=mod.name)
    return apply(obj, role, True)


def text_obj(name, body, size, cx, cy, z, role, extrude=0.0004, spacing=1.0,
             rot_z=0.0):
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    cu.space_character = spacing
    if cu.font is None and len(bpy.data.fonts):
        cu.font = bpy.data.fonts[0]
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = (cx, cy, z)
    obj.rotation_euler = (0.0, 0.0, rot_z)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = False
    return o


# --- сборка ---------------------------------------------------------------
def serpentine_pts():
    """Серпантин по полю + обратная магистраль по нижней кромке."""
    pts = []
    for i in range(NPASS):
        x = FX0 + i * PITCH
        y_from, y_to = ((-YRUN, YRUN) if i % 2 == 0 else (YRUN, -YRUN))
        if i == 0:
            pts.append((x, y_from, CH_SQUASH_Z))
        pts.append((x, y_to, CH_SQUASH_Z))
        if i < NPASS - 1:
            cx = x + TURN_R
            for k in range(1, 12):
                if y_to > 0:
                    a = math.pi - math.pi * k / 12.0
                else:
                    a = math.pi + math.pi * k / 12.0
                pts.append((cx + TURN_R * math.cos(a),
                            y_to + TURN_R * math.sin(a), CH_SQUASH_Z))
    # обратная магистраль: вниз с правого торца, вдоль нижней кромки к голове
    pts += [(FX1 + 0.040, -0.318, CH_SQUASH_Z),
            (FX1 + 0.068, -0.344, CH_SQUASH_Z),
            (FX1 + 0.076, -0.372, CH_SQUASH_Z),
            (FX1 + 0.056, RETURN_Y, CH_SQUASH_Z),
            (-0.838, RETURN_Y, CH_SQUASH_Z),
            (-0.878, -0.378, CH_SQUASH_Z - 0.0008),
            (-0.900, -0.350, CH_SQUASH_Z - 0.0020),
            (-0.912, -0.324, CH_LOW)]
    return pts


def build():
    reset()
    parts = []

    # 1. нижняя подложка
    parts.append(prism(PREFIX + 'base_backing', BACK_HX, BACK_HY, BACK_R,
                       [(0.0, 0.0040), (0.0012, 0.0008),
                        (BACK_Z1, 0.0008)], 'backing', seg=12, smooth=True))

    # 2. молочный чехол со скруглённой кромкой
    parts.append(prism(PREFIX + 'cover_body', BODY_HX, BODY_HY, BODY_R,
                       [(BODY_Z0, 0.0075), (0.0070, 0.0012),
                        (0.0250, 0.0012), (BODY_Z1, 0.0060)],
                       'milk', seg=14, smooth=True))

    # 3. кант по периметру
    parts.append(piping(PREFIX + 'edge_rim', RIM_HX, RIM_HY, RIM_R,
                         RIM_BEVEL, RIM_Z, 'ivory'))

    # 4. верхняя обшивка (рабочая охлаждающая поверхность)
    parts.append(prism(PREFIX + 'top_cover', COV_HX, COV_HY, COV_R,
                       COV_LEVELS, 'ivory', seg=14, smooth=True))

    # 5. внутренний контур охлаждения: 12 каналов + обратная магистраль
    parts.append(curve_mesh(PREFIX + 'coolant_channels', serpentine_pts(),
                            CH_R, 'cyan', squash=CH_SQUASH,
                            squash_z=CH_SQUASH_Z, res=4))

    # 6. сварные швы-валики между каналами (4-й и 8-й — межзональные)
    bm = bmesh.new()
    for i in range(NPASS - 1):
        x = FX0 + (i + 0.5) * PITCH
        hw = SEAM_ZONE_HW if i in ZONE_SEAMS else SEAM_HW
        bar(bm, (x, -YRUN - 0.004), (x, YRUN + 0.004), hw, SEAM_Z0, SEAM_Z1,
            arc=3)
    parts.append(mesh_from_bm(PREFIX + 'weld_seams', bm, 'seam'))

    # 7. распределительная голова
    parts.append(prism(PREFIX + 'manifold_head',
                       (HEAD_X1 - HEAD_X0) * 0.5, (HEAD_Y1 - HEAD_Y0) * 0.5,
                       0.009,
                       [(HEAD_Z0, 0.0018), (HEAD_Z0 + 0.0022, 0.0),
                        (HEAD_Z1 - 0.0018, 0.0), (HEAD_Z1, 0.0018)],
                       'graphite', cx=(HEAD_X0 + HEAD_X1) * 0.5,
                       cy=(HEAD_Y0 + HEAD_Y1) * 0.5, seg=6, smooth=True))

    # 8. подвод канала от головы в серпантин
    parts.append(curve_mesh(
        PREFIX + 'channel_supply',
        [(-0.906, -0.302, CH_LOW), (-0.872, -0.301, CH_LOW + 0.0010),
         (-0.836, -0.300, CH_SQUASH_Z - 0.0004),
         (FX0, -YRUN, CH_SQUASH_Z)],
        CH_R, 'cyan', squash=CH_SQUASH, squash_z=CH_SQUASH_Z, res=4))

    # 9..12. штуцеры: шестигранник, стояк, угловой патрубок, циановая обойма
    for tag, py in zip(('in', 'out'), PORT_YS):
        cyl(PREFIX + f'port_{tag}_nut', (PORT_X, py, HEAD_Z1),
            (PORT_X, py, HEAD_Z1 + 0.0036), 0.0118, 'steel', vertices=6,
            bevel=0.0009)
        cyl(PREFIX + f'port_{tag}_riser', (PORT_X, py, HEAD_Z1 + 0.0024),
            (PORT_X, py, PORT_Z), 0.0070, 'steel', vertices=18,
            bevel=0.0006)
        cyl(PREFIX + f'port_{tag}_elbow', (PORT_X, py, PORT_Z),
            (PORT_X + 0.049, py, PORT_Z), BARB_R, 'steel', vertices=18,
            bevel=0.0008)
        cyl(PREFIX + f'port_{tag}_collar', (PORT_X + 0.0385, py, PORT_Z),
            (PORT_X + 0.0495, py, PORT_Z), BARB_R + 0.0006, 'cyan',
            vertices=18, bevel=0.0005)

    # 13..16. шланги + хомуты + быстросъёмные разъёмы
    for tag, pts, coup in (('in', HOSE_A, COUP_A), ('out', HOSE_B, COUP_B)):
        parts.append(curve_mesh(PREFIX + f'hose_{tag}', pts, HOSE_R,
                                'graphite', res=5))
        # хомут на патрубке
        cyl(PREFIX + f'hose_{tag}_clamp', (pts[0][0] - 0.004, pts[0][1],
                                           PORT_Z),
            (pts[0][0] + 0.006, pts[0][1], PORT_Z), BARB_R + 0.0014,
            'steel', vertices=16, bevel=0.0005)
        # обойма разъёма — кольцо вокруг шланга у входа в корпус
        p1 = Vector(pts[-1])
        p0 = Vector(pts[-2])
        d = (p1 - p0).normalized()
        cyl(PREFIX + f'coupling_{tag}_collar', p1 - d * 0.020, p1 - d * 0.011,
            HOSE_R + 0.0022, 'cyan', vertices=16, bevel=0.0004)
        cx, cy, cz = coup
        parts.append(prism(PREFIX + f'coupling_{tag}_body', 0.023, 0.026,
                           0.006,
                           [(cz - 0.0125, 0.0022), (cz - 0.0095, 0.0),
                            (cz + 0.0090, 0.0), (cz + 0.0112, 0.0022)],
                           'graphite', cx=cx, cy=cy, seg=6, smooth=True))
        cyl(PREFIX + f'coupling_{tag}_cap', (cx + 0.023, cy, cz - 0.001),
            (cx + 0.028, cy, cz - 0.001), 0.0098, 'steel', vertices=14,
            bevel=0.0005)

    # 17..20. датчик температуры + кабель + разъём
    parts.append(prism(PREFIX + 'sensor_body', SEN_HX, SEN_HY, 0.008,
                       [(SEN_Z0, 0.0020), (SEN_Z0 + 0.0024, 0.0),
                        (SEN_Z1 - 0.0018, 0.0), (SEN_Z1, 0.0018)],
                       'graphite', cx=SEN_CX, cy=SEN_CY, seg=8, smooth=True))
    bm = bmesh.new()
    flat_ring(bm, SEN_CX, SEN_CY + 0.016, SEN_Z1 + 0.0002, 0.0125, 0.0022,
              28, 7)
    disc(bm, SEN_CX, SEN_CY + 0.016, SEN_Z1 + 0.0001, 0.0112, 26)
    parts.append(mesh_from_bm(PREFIX + 'sensor_probe', bm, 'steel'))
    bm = bmesh.new()
    dome(bm, SEN_CX, SEN_CY - 0.026, 0.0052, 0.0026, SEN_Z1 - 0.0004, 14, 4)
    parts.append(mesh_from_bm(PREFIX + 'sensor_led', bm, 'cyan'))
    parts.append(curve_mesh(
        PREFIX + 'sensor_cable',
        [(SEN_CX - 0.004, SEN_CY - 0.042, 0.0360),
         (SEN_CX - 0.006, SEN_CY - 0.090, 0.0352),
         (SEN_CX - 0.012, SEN_CY - 0.135, 0.0348),
         (SEN_CX - 0.020, SEN_CY - 0.168, 0.0344)],
        0.0034, 'graphite', res=4))
    parts.append(prism(PREFIX + 'sensor_plug', 0.010, 0.013, 0.004,
                       [(0.0336, 0.0012), (0.0342, 0.0), (0.0420, 0.0),
                        (0.0430, 0.0014)],
                       'graphite', cx=SEN_CX - 0.022, cy=SEN_CY - 0.185,
                       seg=6, smooth=True))

    # 21..24. ремни-липучки по длинным кромкам
    bmv = bmesh.new()
    for tag, y in (('top', STRAP_TOP_Y), ('bot', STRAP_BOT_Y)):
        for i, x in enumerate(STRAP_XS):
            parts.append(prism(
                PREFIX + f'strap_{tag}_{i}', STRAP_HX, STRAP_HY, 0.007,
                [(0.0338, 0.0014), (0.0344, 0.0),
                 (0.0354, 0.0), (0.0358, 0.0012)],
                'webbing', cx=x, cy=y, seg=8, smooth=True))
            parts.append(prism(
                PREFIX + f'velcro_{tag}_{i}',
                STRAP_HX - 0.012, STRAP_HY - 0.005, 0.004,
                [(0.0356, 0.0008), (0.0359, 0.0), (0.0366, 0.0),
                 (0.0369, 0.0008)],
                'velcro', cx=x, cy=y, seg=6, smooth=True))

    # 25..28. люверсы крепления в раму
    bm = bmesh.new()
    for x in GROMMET_XS:
        for y in (GROMMET_TOP_Y, GROMMET_BOT_Y):
            disc(bm, x, y, 0.0341, 0.0128, 24)
    parts.append(mesh_from_bm(PREFIX + 'grommet_holes', bm, 'groove'))
    bm = bmesh.new()
    for x in GROMMET_XS:
        for y in (GROMMET_TOP_Y, GROMMET_BOT_Y):
            flat_ring(bm, x, y, 0.0343, 0.0112, 0.0024, 30, 8)
    parts.append(mesh_from_bm(PREFIX + 'grommets', bm, 'steel'))

    # 29..31. маркировка
    parts.append(prism(PREFIX + 'label_plate', 0.082, 0.026, 0.008,
                       [(0.0342, 0.0012), (0.0348, 0.0),
                        (0.0356, 0.0), (0.0360, 0.0010)],
                       'milk', cx=LABEL_CX, cy=LABEL_CY, seg=8, smooth=True))
    parts.append(text_obj(PREFIX + 'label_text', 'COOLED', 0.0090,
                          LABEL_CX, LABEL_CY + 0.0082, 0.0360, 'graphite',
                          extrude=0.0004, spacing=1.10))
    parts.append(text_obj(PREFIX + 'label_code', 'SRF-COLD-04', 0.0050,
                          LABEL_CX, LABEL_CY - 0.0088, 0.0360, 'graphite',
                          extrude=0.0003, spacing=1.06))

    bpy.context.view_layer.update()
    return parts


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
    objs = [o for o in bpy.data.objects]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    mats = sorted(m.name for m in bpy.data.materials if m.users)
    verts = sum(len(o.data.vertices) for o in meshes)
    tris = sum(len(o.data.loop_triangles) for o in meshes)

    rep = {
        'component': CID,
        'code': 'SRF-COLD-04',
        'class': 'SURFACE',
        'nodes': len(objs),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport_body': [2.0, 0.9, 0.03],
        'bbox_target_assembly': [2.0, 0.9, 0.05],
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.004
                        and abs(size.y - 0.9) <= 0.004
                        and 0.044 <= size.z <= 0.052),
        'flat_on_floor': bool(abs(mn.z) < 2e-4),
        'materials': mats,
        'material_count': len(mats),
        'channel_passes': NPASS,
        'channel_pitch_mm': round(PITCH * 1000, 1),
        'channel_width_mm': round(CH_R * 2000, 1),
        'verts': verts,
        'tris': tris,
        'parts': sorted(o.name for o in objs),
        'bad_names': sorted(o.name for o in objs
                            if not o.name.startswith(PREFIX)),
        'motion': 'none',
    }
    return rep


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objects:
        o['component'] = CID
        o['motion'] = 'none'
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_cool_', '') \
                .rsplit('_', 1)[0]
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


# --- рендеры --------------------------------------------------------------
def render_views():
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 1400
    scene.render.resolution_y = 1050
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    scene.view_settings.view_transform = 'AgX'
    try:
        scene.view_settings.look = 'AgX - Medium High Contrast'
    except TypeError:
        pass
    scene.view_settings.exposure = -0.22
    try:
        scene.eevee.taa_render_samples = 96
        scene.eevee.use_raytracing = True
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.700, 0.698, 0.688, 1.0)
    bg.inputs['Strength'].default_value = 0.40

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5
    S = max((mx - mn).x, (mx - mn).y)

    bpy.ops.mesh.primitive_plane_add(size=S * 3.0,
                                     location=(center.x, center.y,
                                               mn.z - 0.0002))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.440, 0.436, 0.426, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    for name, offset, energy, sz in (
            ('key', (0.45 * S, -0.75 * S, 1.05 * S), 80.0, 1.05 * S),
            ('fill', (-0.80 * S, -0.55 * S, 0.55 * S), 22.0, 1.30 * S),
            ('rim', (0.55 * S, 0.85 * S, 0.70 * S), 42.0, 1.00 * S)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(offset) + Vector((center.x, center.y, center.z))
        lo.rotation_euler = (center - lo.location).to_track_quat(
            '-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 62
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
    close_t = Vector((-0.878, -0.262, 0.030))
    c_close = box_corners(Vector((-0.999, -0.452, 0.000)) - close_t,
                          Vector((-0.755, -0.070, 0.056)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc(fill):
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0,
                            abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (-0.62, -0.95, 0.62), center, 58, c_main, 0.94, True,
         (1400, 1000)),
        ('front', (0.02, -1.00, 0.44), center, 62, c_main, 0.95, True,
         (1400, 620)),
        ('side', (-1.00, -0.34, 0.15), center, 62, c_main, 0.96, True,
         (1400, 760)),
        ('closeup', (-0.72, -0.68, 0.40), close_t, 80, c_close, 0.94, False,
         (1250, 1050)),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, fb, res in views:
        scene.render.resolution_x, scene.render.resolution_y = res
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners, 1.10 if fb else 1.06)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat(
            '-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        if fb:
            for _ in range(4):
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


def main():
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['flat_on_floor']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
