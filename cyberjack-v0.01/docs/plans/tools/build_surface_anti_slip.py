"""Standalone builder: surface_anti_slip (SRF-AS-02, «Антискольжение»).

Тонкий съёмный сетчатый коврик: молочная силиконовая основа, бледно-розовая
сетка из мягких рёбер, регулярные мягкие выступы двух размеров (крупные
полусферы + мелкие кластеры), кант-трубка по периметру со строчкой,
четыре ременных лепестка-липучки на углах коротких сторон, тканая бирка
с маркировкой. Плиты-основания нет.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_surface_anti_slip.py

Выход:
  public/models/machine-modules/components/surface_anti_slip.glb
  docs/plans/blockout/component-library/surface_anti_slip/*.png
  docs/plans/blockout/component-library/surface_anti_slip/report.json

Геометрия (Blender Z-up, метры):
  X = длина 2,000 (вместе с лепестками-липучками), Y = ширина 0,900,
  Z = толщина 0,020; коврик лежит на z = 0, центр в XY в нуле.
  вращения нет (motion: none), анимационная пустышка не нужна.
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/surface_anti_slip'
CID = 'surface_anti_slip'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
SLAB_HX, SLAB_HY = 0.9405, 0.4405     # силиконовая основа
SLAB_R = 0.0500                      # радиус угла
SLAB_Z0, SLAB_Z1 = 0.0, 0.008        # 8 мм

PIPE_HX, PIPE_HY, PIPE_R = 0.9445, 0.4445, 0.0540
PIPE_BEVEL = 0.0055                  # кант-трубка Ø11 мм -> внешний габарит 1,90 x 0,90
PIPE_Z = 0.0055

FIELD_HX, FIELD_HY = 0.9210, 0.4150  # площадка-канал под сеткой
FLOOR_Z0, FLOOR_Z1 = 0.0080, 0.0095

GRID_HX, GRID_HY = 0.9120, 0.4060    # поле сетки
RIB_HW = 0.0040                      # ребро 8 мм
RIB_Z0, RIB_Z1 = 0.0095, 0.0135

DOME_R, DOME_H = 0.0125, 0.0110      # крупный выступ: верх z = 0,020
FINE_R, FINE_H = 0.0060, 0.0060      # мелкий выступ: верх z = 0,015
DOME_Z0 = 0.0090

TAB_LEN, TAB_W = 0.1000, 0.0720      # лепесток-липучка (X от 0,900 до 1,000)
TAB_CX = 0.9500
TAB_CY = 0.3900
TAB_Z0, TAB_Z1 = 0.0088, 0.0106
TAB_R = 0.0120

VELCRO_L, VELCRO_W = 0.0340, 0.0500
VELCRO_CX = 0.9680
VELCRO_Z0, VELCRO_Z1 = 0.0106, 0.0122

LABEL_X0, LABEL_X1 = -0.7600, -0.5600
LABEL_Y0, LABEL_Y1 = 0.2620, 0.3060
LABEL_CX = (LABEL_X0 + LABEL_X1) * 0.5
LABEL_CY = (LABEL_Y0 + LABEL_Y1) * 0.5
POCKET_MARGIN = 0.0080
PLATE_Z0, PLATE_Z1 = 0.0095, 0.0120

SEAM_HX, SEAM_HY, SEAM_R = 0.9295, 0.4235, 0.0300
SEAM_Z0, SEAM_Z1 = 0.0080, 0.0089

PALETTE = {
    'milk': (0.930, 0.905, 0.870),      # молочная основа
    'ivory': (0.972, 0.962, 0.945),     # тканая бирка
    'blush': (0.820, 0.495, 0.525),     # бледно-розовая сетка + крупные выступы
    'pale': (0.930, 0.745, 0.762),      # мелкие выступы, кант, ремни
    'groove': (0.560, 0.510, 0.492),    # дно каналов, строчка
    'graphite': (0.150, 0.155, 0.165),  # липучка-крючок, маркировка
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
    bsdf.inputs['Metallic'].default_value = 0.0
    rough = {
        'milk': 0.78, 'ivory': 0.84, 'blush': 0.62, 'pale': 0.66,
        'groove': 0.88, 'graphite': 0.52,
    }[role]
    bsdf.inputs['Roughness'].default_value = rough
    try:
        bsdf.inputs['Sheen Weight'].default_value = 0.35 if role in (
            'ivory', 'pale', 'milk') else 0.12
        bsdf.inputs['Specular IOR Level'].default_value = 0.42
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


def prism(name, hx, hy, r, levels, role, cx=0.0, cy=0.0, seg=10, smooth=False):
    """Скруглённая по углам плита по профилю levels=[(z, inset), ...]."""
    bm = bmesh.new()
    rings = []
    for z, ins in levels:
        pts = rounded_rect(hx - ins, hy - ins, max(r - ins, 0.0006), seg)
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


def dome(bm, cx, cy, r, h, z0, segs=10, rings=4):
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


def flat_ring(bm, cx, cy, z, major, minor, segs=24, rings=6):
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


def polyline_dashes(bm, pts, dash, gap, hw, z0, z1):
    """Пунктир строчки по замкнутому контуру pts (2D)."""
    segs = []
    total = 0.0
    n = len(pts)
    for i in range(n):
        a = Vector((pts[i][0], pts[i][1], 0.0))
        b = Vector((pts[(i + 1) % n][0], pts[(i + 1) % n][1], 0.0))
        L = (b - a).length
        if L > 1e-9:
            segs.append((a, b, L, total))
            total += L

    def at(s):
        s = s % total
        for a, b, L, s0 in segs:
            if s <= s0 + L:
                t = (s - s0) / L
                return a.lerp(b, t)
        return segs[-1][1]

    s = 0.0
    while s + dash < total:
        bar(bm, (at(s).x, at(s).y), (at(s + dash).x, at(s + dash).y),
            hw, z0, z1, arc=2)
        s += dash + gap


def text_obj(name, body, size, cx, cy, z, role, extrude=0.0005, spacing=1.0):
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
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    o = bpy.context.object
    o.name = name
    for p in o.data.polygons:
        p.use_smooth = False
    return o


def in_pocket(x, y, m=0.0):
    return (LABEL_X0 - m <= x <= LABEL_X1 + m
            and LABEL_Y0 - m <= y <= LABEL_Y1 + m)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    # 1. силиконовая основа со скруглёнными рёбрами
    parts.append(prism(
        PREFIX + 'base_sheet', SLAB_HX, SLAB_HY, SLAB_R,
        [(SLAB_Z0, 0.0016), (SLAB_Z0 + 0.0016, 0.0),
         (SLAB_Z1 - 0.0016, 0.0), (SLAB_Z1, 0.0016)],
        'milk', seg=12, smooth=True))

    # 2. кант по периметру (трубка в обхват кромки)
    parts.append(piping(PREFIX + 'rim', PIPE_HX, PIPE_HY, PIPE_R,
                         PIPE_BEVEL, PIPE_Z, 'pale'))

    # 3. строчка по внутренней кромке канта
    bm = bmesh.new()
    polyline_dashes(bm, rounded_rect(SEAM_HX, SEAM_HY, SEAM_R, seg=8),
                    0.0060, 0.0055, 0.0011, SEAM_Z0, SEAM_Z1)
    parts.append(mesh_from_bm(PREFIX + 'rim_seam', bm, 'groove'))

    # 4. светлое дно каналов сетки (слегка утоплено, чуть темнее основы)
    parts.append(prism(
        PREFIX + 'field_floor', FIELD_HX, FIELD_HY, 0.024,
        [(FLOOR_Z0, 0.0), (FLOOR_Z1, 0.0008)],
        'groove', seg=10, smooth=False))

    # 5. сетка рёбер + 6./7. мягкие выступы
    nx = max(2, round(GRID_HX * 2.0 / 0.048))
    ny = max(2, round(GRID_HY * 2.0 / 0.048))
    px = GRID_HX * 2.0 / nx
    py = GRID_HY * 2.0 / ny

    bmg = bmesh.new()
    for i in range(nx + 1):
        x = -GRID_HX + i * px
        if LABEL_X0 - POCKET_MARGIN < x < LABEL_X1 + POCKET_MARGIN:
            y0 = LABEL_Y0 - POCKET_MARGIN
            y1 = LABEL_Y1 + POCKET_MARGIN
            if -GRID_HY < y0:
                bar(bmg, (x, -GRID_HY), (x, y0), RIB_HW, RIB_Z0, RIB_Z1)
            if y1 < GRID_HY:
                bar(bmg, (x, y1), (x, GRID_HY), RIB_HW, RIB_Z0, RIB_Z1)
        else:
            bar(bmg, (x, -GRID_HY), (x, GRID_HY), RIB_HW, RIB_Z0, RIB_Z1)
    for j in range(ny + 1):
        y = -GRID_HY + j * py
        if LABEL_Y0 - POCKET_MARGIN < y < LABEL_Y1 + POCKET_MARGIN:
            x0 = LABEL_X0 - POCKET_MARGIN
            x1 = LABEL_X1 + POCKET_MARGIN
            if -GRID_HX < x0:
                bar(bmg, (-GRID_HX, y), (x0, y), RIB_HW, RIB_Z0, RIB_Z1)
            if x1 < GRID_HX:
                bar(bmg, (x1, y), (GRID_HX, y), RIB_HW, RIB_Z0, RIB_Z1)
        else:
            bar(bmg, (-GRID_HX, y), (GRID_HX, y), RIB_HW, RIB_Z0, RIB_Z1)
    parts.append(mesh_from_bm(PREFIX + 'field_grid', bmg, 'blush'))

    bmc = bmesh.new()
    bmf = bmesh.new()
    cells = 0
    for i in range(nx):
        for j in range(ny):
            cx = -GRID_HX + (i + 0.5) * px
            cy = -GRID_HY + (j + 0.5) * py
            if in_pocket(cx, cy, 0.006):
                continue
            cells += 1
            if (i + j) % 2 == 0:
                dome(bmc, cx, cy, DOME_R, DOME_H, DOME_Z0, 12, 4)
            else:
                for ox in (-0.0105, 0.0105):
                    for oy in (-0.0105, 0.0105):
                        dome(bmf, cx + ox, cy + oy, FINE_R, FINE_H,
                             DOME_Z0, 8, 3)
    parts.append(mesh_from_bm(PREFIX + 'bumps_coarse', bmc, 'blush'))
    parts.append(mesh_from_bm(PREFIX + 'bumps_fine', bmf, 'pale'))

    # 8..15. ременные лепестки-липучки по углам коротких сторон
    bmts = bmesh.new()
    for sx, sy, tag in ((1, 1, 'ne'), (1, -1, 'se'), (-1, 1, 'nw'), (-1, -1, 'sw')):
        bx = sx * TAB_CX
        by = sy * TAB_CY
        parts.append(prism(
            PREFIX + f'tab_{tag}_pos', TAB_LEN * 0.5, TAB_W * 0.5, TAB_R,
            [(TAB_Z0, 0.0005), (TAB_Z0 + 0.0007, 0.0),
             (TAB_Z1 - 0.0005, 0.0), (TAB_Z1, 0.0005)],
            'pale', cx=bx, cy=by, seg=8, smooth=True))
        vx = sx * VELCRO_CX
        parts.append(prism(
            PREFIX + f'tab_{tag}_velcro', VELCRO_L * 0.5, VELCRO_W * 0.5,
            0.0070,
            [(VELCRO_Z0, 0.0004), (VELCRO_Z0 + 0.0005, 0.0),
             (VELCRO_Z1 - 0.0004, 0.0), (VELCRO_Z1, 0.0004)],
            'graphite', cx=vx, cy=by, seg=6, smooth=True))
        # закрепка строчкой у основания и у конца лепестка
        for xd in (sx * (TAB_CX - TAB_LEN * 0.5 + 0.010),
                   sx * (TAB_CX + TAB_LEN * 0.5 - 0.009)):
            yy = -TAB_W * 0.5 + 0.008
            while yy < TAB_W * 0.5 - 0.006:
                bar(bmts, (xd - sx * 0.0012, by + yy),
                    (xd + sx * 0.0012, by + yy), 0.0007,
                    TAB_Z1 - 0.0002, TAB_Z1 + 0.0007, arc=2)
                yy += 0.0080
    parts.append(mesh_from_bm(PREFIX + 'tab_stitch', bmts, 'groove'))

    # 17..20. маркировка: тканая бирка, тексты, значки ухода
    parts.append(prism(
        PREFIX + 'label_plate', (LABEL_X1 - LABEL_X0) * 0.5,
        (LABEL_Y1 - LABEL_Y0) * 0.5, 0.0075,
        [(PLATE_Z0, 0.0006), (PLATE_Z0 + 0.0008, 0.0),
         (PLATE_Z1 - 0.0008, 0.0), (PLATE_Z1, 0.0006)],
        'ivory', cx=LABEL_CX, cy=LABEL_CY, seg=8, smooth=True))

    parts.append(text_obj(PREFIX + 'label_text', 'ANTI-SLIP', 0.0092,
                          LABEL_CX - 0.011, LABEL_CY + 0.0062, PLATE_Z1,
                          'graphite', extrude=0.00045, spacing=1.06))
    parts.append(text_obj(PREFIX + 'code_text', 'SRF-AS-02', 0.0050,
                          LABEL_CX - 0.011, LABEL_CY - 0.0088, PLATE_Z1,
                          'graphite', extrude=0.00035, spacing=1.05))

    bmw = bmesh.new()
    wx, wy = LABEL_X1 - 0.0135, LABEL_CY - 0.0005
    flat_ring(bmw, wx, wy, PLATE_Z1 + 0.0002, 0.0062, 0.0009, 24, 6)
    for k, (ox, oy) in enumerate(((-0.0030, 0.0), (0.0030, 0.0), (0.0, -0.0032))):
        dome(bmw, wx + ox, wy + oy, 0.0017, 0.0011, PLATE_Z1 + 0.0002, 8, 2)
    parts.append(mesh_from_bm(PREFIX + 'wash_icons', bmw, 'graphite'))

    bpy.context.view_layer.update()
    return parts, (nx, ny, len(parts))


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


def check(grid_info):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5
    verts = sum(len(o.data.vertices) for o in all_mesh)
    tris = sum(len(o.data.loop_triangles) for o in all_mesh)
    mats = sorted(m.name for m in bpy.data.materials if m.users)

    rep = {
        'component': CID,
        'code': 'SRF-AS-02',
        'class': 'SURFACE',
        'nodes': len([o for o in bpy.data.objects]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_target_passport': [2.0, 0.9, 0.02],
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.004
                        and abs(size.y - 0.9) <= 0.004
                        and abs(size.z - 0.02) <= 0.0015),
        'flat_on_floor': bool(abs(mn.z) < 1e-4),
        'materials': mats,
        'material_count': len(mats),
        'grid_cells': grid_info[0] * grid_info[1],
        'grid_pitch_mm': [round(GRID_HX * 2.0 / grid_info[0] * 1000, 1),
                          round(GRID_HY * 2.0 / grid_info[1] * 1000, 1)],
        'verts': verts,
        'tris': tris,
        'parts': sorted(o.name for o in bpy.data.objects),
        'bad_names': sorted(o.name for o in bpy.data.objects
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
    scene.view_settings.exposure = 0.0
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

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5
    S = max((mx - mn).x, (mx - mn).y)

    bpy.ops.mesh.primitive_plane_add(size=S * 4.0,
                                     location=(center.x, center.y, mn.z - 0.0002))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.480, 0.474, 0.464, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    for name, offset, energy, sz in (
            ('key', (0.55 * S, -0.85 * S, 0.95 * S), 84.0, 1.10 * S),
            ('fill', (-0.85 * S, -0.55 * S, 0.45 * S), 24.0, 1.30 * S),
            ('rim', (0.05 * S, 0.90 * S, 0.75 * S), 46.0, 1.00 * S)):
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
    close_t = Vector((0.905, 0.372, 0.010))
    c_close = box_corners(Vector((0.855, 0.335, 0.0)) - close_t,
                          Vector((1.002, 0.432, 0.021)) - close_t)

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

    # feedback=True -> авто-подгонка по всему мешу; для close-up только по своей рамке
    views = [
        ('3q', (-0.84, 0.60, 0.47), center, 55, c_main, 0.90, True),
        ('front', (0.05, -1.00, 0.22), center, 55, c_main, 0.97, True),
        ('side', (1.00, -0.07, 0.22), center, 55, c_main, 0.97, True),
        ('closeup', (0.62, -0.72, 0.42), close_t, 78, c_close, 0.94, False),
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
    parts, grid_info = build()
    rep = check(grid_info)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['flat_on_floor']
            and rep['material_count'] >= 4 and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
