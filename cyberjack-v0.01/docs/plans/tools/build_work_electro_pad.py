"""Standalone builder: work_electro_pad (WRK-EL-01, «Электроплощадка»).

Тонкий одноразовый электродный контакт 0.08 x 0.08 x 0.011 м:
графитовая гибкая подложка -> печатные серебряные электроды (встречно-
гребёнчатая сетка + дорожки) -> печатная изолирующая рамка -> гидрогелевая
подушка -> липкий манжетный край с язычком быстросъёма; на краю — модуль
датчика импеданса (циановый LED) и короткий кабель с разъёмом.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_electro_pad.py

Выход:
  public/models/machine-modules/components/work_electro_pad.glb

Геометрия (Blender Z-up, метры, вращений/анимации нет):
  X — вправо (сторона датчика/кабеля), Y — назад, Z — вверх (толщина).
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
CID = 'work_electro_pad'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
PAD = 0.0800              # графитовая подложка 80 мм
PAD_R = 0.0110
BACK_Z0, BACK_Z1 = 0.00000, 0.00160

COND_Z0, COND_Z1 = 0.00160, 0.00220      # слой печатного серебра
TRACE_W = 0.00200

# электродное поле (встречно-гребёнчатая сетка)
EX = 0.0240               # полуширина шины по X
EBUS = 0.0232             # ось шин по Y
EBUS_H = 0.0022           # полувысота шины
EFING_W = 0.0022          # ширина пальца
EFING_X = 0.01950         # крайний палец по X
EFING_STEP = 0.00650
EFING_TIP_POS = -0.00800  # куда достаёт палец положительной шины
EFING_TIP_NEG = 0.00800

FRAME_OS, FRAME_IS = 0.0600, 0.0552      # печатная изолирующая рамка
FRAME_OR, FRAME_IR = 0.0086, 0.0078
FRAME_Z0, FRAME_Z1 = 0.00160, 0.00255

GEL_SQ = 0.0548           # гидрогель в проёме рамки, без нахлёста
GEL_R = 0.0076
GEL_Z = 0.00190
GEL_EDGE = 0.00045
GEL_DOME = 0.00780

RIM_OS, RIM_IS = 0.0740, 0.0682          # липкий манжетный край
RIM_OR, RIM_IR = 0.0108, 0.0090
RIM_Z0, RIM_Z1 = 0.00120, 0.00210

TAIL_X0, TAIL_X1 = 0.0340, 0.0492        # гибкий хвост под датчиком
TAIL_HW = 0.0100

SENS = dict(cx=0.0400, cy=0.0, sx=0.0170, sy=0.0250)
SENS_Z0, SENS_Z1 = 0.00215, 0.00340      # цоколь
CAN_Z1 = 0.00630                         # металлический экран

TAB_Y0, TAB_Y1 = -0.0341, -0.0455        # язычок быстросъёма (от края манжеты)
TAB_X = -0.0120
TAB_HALF = 0.0070
TAB_Z = 0.00215
TAB_LIFT = 0.00580
TAB_TH = 0.00105

PALETTE = {
    'graphite': (0.315, 0.330, 0.350),
    'silver': (0.615, 0.635, 0.635),
    'nickel': (0.500, 0.525, 0.530),
    'gel': (0.455, 0.820, 0.875),
    'soft': (0.888, 0.800, 0.812),
    'dark': (0.105, 0.112, 0.128),
    'cyan': (0.120, 0.780, 0.930),
    'print': (0.930, 0.925, 0.905),
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
    bsdf.inputs['Roughness'].default_value = 0.62
    bsdf.inputs['Metallic'].default_value = 0.0
    if role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.35
        bsdf.inputs['Roughness'].default_value = 0.48
    elif role == 'silver':
        bsdf.inputs['Metallic'].default_value = 0.94
        bsdf.inputs['Roughness'].default_value = 0.40
    elif role == 'nickel':
        bsdf.inputs['Metallic'].default_value = 0.90
        bsdf.inputs['Roughness'].default_value = 0.28
    elif role == 'gel':
        bsdf.inputs['Roughness'].default_value = 0.22
        bsdf.inputs['Alpha'].default_value = 0.40
        for k in ('Transmission Weight', 'Transmission'):
            if k in bsdf.inputs:
                bsdf.inputs[k].default_value = 0.12
                break
        if hasattr(m, 'blend_method'):
            try:
                m.blend_method = 'BLEND'
            except Exception:
                pass
        if hasattr(m, 'surface_render_method'):
            try:
                m.surface_render_method = 'BLENDED'
            except Exception:
                pass
        m.use_backface_culling = False
    elif role == 'soft':
        bsdf.inputs['Roughness'].default_value = 0.80
    elif role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.85
    elif role == 'print':
        bsdf.inputs['Roughness'].default_value = 0.45
    m.diffuse_color = (*color, m.diffuse_color[3])
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


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), smooth=False):
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


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=32, rings=8):
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


# --- bmesh primitives ----------------------------------------------------
def rounded_outline(sx, sy, r, seg=6):
    """Замкнутый CCW-контур скруглённого прямоугольника в XY."""
    r = max(1e-4, min(r, sx * 0.5 - 1e-5, sy * 0.5 - 1e-5))
    hx, hy = sx * 0.5 - r, sy * 0.5 - r
    pts = []
    for cx, cy, a0 in ((hx, hy, 0.0), (-hx, hy, 90.0),
                       (-hx, -hy, 180.0), (hx, -hy, 270.0)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90.0 * i / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts


def slab(name, sx, sy, z0, z1, r, role, seg=6, smooth=False, cx=0.0, cy=0.0):
    pts = rounded_outline(sx, sy, r, seg)
    bm = bmesh.new()
    bot = [bm.verts.new((cx + x, cy + y, z0)) for x, y in pts]
    top = [bm.verts.new((cx + x, cy + y, z1)) for x, y in pts]
    n = len(pts)
    bm.faces.new(tuple(reversed(bot)))
    bm.faces.new(tuple(top))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((bot[i], bot[j], top[j], top[i]))
    return mesh_from_bm(name, bm, role, smooth)


def ring_slab(name, so, si, ro, ri, z0, z1, role, seg=6, smooth=False):
    po = rounded_outline(so, so, ro, seg)
    pi = rounded_outline(si, si, ri, seg)
    bm = bmesh.new()
    ob = [bm.verts.new((x, y, z0)) for x, y in po]
    ot = [bm.verts.new((x, y, z1)) for x, y in po]
    ib = [bm.verts.new((x, y, z0)) for x, y in pi]
    it = [bm.verts.new((x, y, z1)) for x, y in pi]
    n = len(po)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ot[i], ot[j], it[j], it[i]))    # верхнее кольцо
        bm.faces.new((ib[i], ib[j], ob[j], ob[i]))    # нижнее кольцо
        bm.faces.new((ob[i], ob[j], ot[j], ot[i]))    # внешняя стенка
        bm.faces.new((it[i], it[j], ib[j], ib[i]))    # внутренняя стенка
    return mesh_from_bm(name, bm, role, smooth)


def gel_pillow(name, sx, sy, r, z_base, edge_h, dome_h, role,
               rings=8, seg=6, smooth=True):
    """Гидрогелевая подушка: юбка + купол с мягким профилем."""
    bm = bmesh.new()
    outer = rounded_outline(sx, sy, r, seg)
    n = len(outer)
    base = [bm.verts.new((x, y, z_base)) for x, y in outer]
    skirt = [bm.verts.new((x, y, z_base + edge_h * 0.5)) for x, y in outer]
    loops = [skirt]
    for k in range(1, rings + 1):
        s = k / rings
        f = 1.0 - 0.955 * s
        z = z_base + edge_h + dome_h * math.sqrt(max(0.0, 2.0 * s - s * s))
        loop = [bm.verts.new((x * f, y * f, z)) for x, y in outer]
        loops.append(loop)
    bm.faces.new(tuple(reversed(base)))
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((base[i], base[j], skirt[j], skirt[i]))
    for a, b in zip(loops, loops[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(tuple(loops[-1]))
    return mesh_from_bm(name, bm, role, smooth)


def bm_box(bm, cx, cy, z0, z1, sx, sy):
    x0, x1 = cx - sx * 0.5, cx + sx * 0.5
    y0, y1 = cy - sy * 0.5, cy + sy * 0.5
    v = [bm.verts.new(p) for p in (
        (x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
        (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1))]
    for f in ((0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4),
              (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)):
        bm.faces.new(tuple(v[i] for i in f))


def bm_disc(bm, cx, cy, z0, z1, r, seg=14):
    lo = [bm.verts.new((cx + r * math.cos(math.tau * i / seg),
                        cy + r * math.sin(math.tau * i / seg), z0))
          for i in range(seg)]
    hi = [bm.verts.new((cx + r * math.cos(math.tau * i / seg),
                        cy + r * math.sin(math.tau * i / seg), z1))
          for i in range(seg)]
    bm.faces.new(tuple(reversed(lo)))
    bm.faces.new(tuple(hi))
    for i in range(seg):
        j = (i + 1) % seg
        bm.faces.new((lo[i], lo[j], hi[j], hi[i]))


def bm_strip(bm, pts, width, z0, z1):
    """Плоская дорожка по ломаной (стыки закрыты квадратными вставками)."""
    P = [Vector((p[0], p[1])) for p in pts]
    for a, b in zip(P, P[1:]):
        d = b - a
        L = d.length
        if L < 1e-9:
            continue
        nn = Vector((-d.y, d.x)) / L * (width * 0.5)
        q = [a + nn, a - nn, b - nn, b + nn]
        lo = [bm.verts.new((p.x, p.y, z0)) for p in q]
        hi = [bm.verts.new((p.x, p.y, z1)) for p in q]
        bm.faces.new(tuple(reversed(lo)))
        bm.faces.new(tuple(hi))
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    for p in P[1:-1]:
        bm_box(bm, p.x, p.y, z0, z1, width, width)


def curl_ribbon(name, cx, stations, thick, role, smooth=True):
    """Ленточка-язычок: станции (y, z, полуширина) -> изогнутая полоса."""
    bm = bmesh.new()
    rows = []
    for y, z, hw in stations:
        rows.append([
            bm.verts.new((cx - hw, y, z)),
            bm.verts.new((cx + hw, y, z)),
            bm.verts.new((cx + hw, y, z + thick)),
            bm.verts.new((cx - hw, y, z + thick)),
        ])
    for a, b in zip(rows, rows[1:]):
        for i in range(4):
            j = (i + 1) % 4
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(tuple(reversed(rows[0])))
    bm.faces.new(tuple(rows[-1]))
    return mesh_from_bm(name, bm, role, smooth)


def tab_z(t):
    return TAB_Z + TAB_LIFT * (t ** 2.6)


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # 1. графитовая гибкая подложка + хвост под датчиком
    slab(PREFIX + 'backing', PAD, PAD, BACK_Z0, BACK_Z1, PAD_R, 'graphite', seg=12)
    slab(PREFIX + 'flex_tail', TAIL_X1 - TAIL_X0, TAIL_HW * 2.0,
         BACK_Z0, BACK_Z1, TAIL_HW * 0.55, 'graphite', seg=8,
         cx=(TAIL_X0 + TAIL_X1) * 0.5)

    # 2. печатные серебряные электроды: две встречно-гребёнчатые шины
    bm = bmesh.new()
    bm_box(bm, 0.0, EBUS, COND_Z0, COND_Z1, EX * 2.0, EBUS_H * 2.0)
    fin_top = EBUS - EBUS_H
    for i in range(7):
        x = -EFING_X + i * EFING_STEP
        bm_box(bm, x, (fin_top + EFING_TIP_POS) * 0.5, COND_Z0, COND_Z1,
               EFING_W, fin_top - EFING_TIP_POS)
        bm_disc(bm, x, EFING_TIP_POS, COND_Z0, COND_Z1, EFING_W * 0.55, 10)
    mesh_from_bm(PREFIX + 'electrode_pos', bm, 'nickel', smooth=False)

    bm = bmesh.new()
    bm_box(bm, 0.0, -EBUS, COND_Z0, COND_Z1, EX * 2.0, EBUS_H * 2.0)
    fin_bot = -EBUS + EBUS_H
    for i in range(6):
        x = -EFING_X + EFING_STEP * 0.5 + i * EFING_STEP
        bm_box(bm, x, (fin_bot + EFING_TIP_NEG) * 0.5, COND_Z0, COND_Z1,
               EFING_W, EFING_TIP_NEG - fin_bot)
        bm_disc(bm, x, EFING_TIP_NEG, COND_Z0, COND_Z1, EFING_W * 0.55, 10)
    mesh_from_bm(PREFIX + 'electrode_neg', bm, 'nickel', smooth=False)

    # 3. контактные дорожки к датчику
    bm = bmesh.new()
    bm_strip(bm, [(0.0140, EBUS), (0.0330, EBUS), (0.0344, 0.0170), (0.0344, 0.0068)],
             TRACE_W, COND_Z0, COND_Z1)
    bm_disc(bm, 0.0140, EBUS, COND_Z0, COND_Z1, 0.0019, 12)
    mesh_from_bm(PREFIX + 'trace_pos', bm, 'nickel', smooth=False)

    bm = bmesh.new()
    bm_strip(bm, [(-0.0060, -EBUS), (0.0330, -EBUS), (0.0344, -0.0170), (0.0344, -0.0068)],
             TRACE_W, COND_Z0, COND_Z1)
    bm_disc(bm, -0.0060, -EBUS, COND_Z0, COND_Z1, 0.0019, 12)
    mesh_from_bm(PREFIX + 'trace_neg', bm, 'nickel', smooth=False)

    # 4. гидрогель (полупрозрачная подушка над сеткой)
    gel_pillow(PREFIX + 'hydrogel', GEL_SQ, GEL_SQ, GEL_R, GEL_Z,
               GEL_EDGE, GEL_DOME, 'gel', rings=10, seg=10)

    # 5. печатная изолирующая рамка вокруг гидрогеля
    ring_slab(PREFIX + 'dielectric_frame', FRAME_OS, FRAME_IS,
              FRAME_OR, FRAME_IR, FRAME_Z0, FRAME_Z1, 'dark', seg=10)

    # 6. липкий манжетный край
    ring_slab(PREFIX + 'adhesive_rim', RIM_OS, RIM_IS,
              RIM_OR, RIM_IR, RIM_Z0, RIM_Z1, 'soft', seg=14, smooth=True)

    # 7. язычок быстросъёма с рёбрами
    N = 12
    stations = []
    for i in range(N + 1):
        t = i / N
        y = TAB_Y0 + (TAB_Y1 - TAB_Y0) * t
        # скругление к кончику: язычок не читается как «карточка»
        hw = TAB_HALF * math.sqrt(max(0.0, 1.0 - (max(0.0, t - 0.72) / 0.28) ** 2))
        hw = max(0.0018, hw)
        stations.append((y, tab_z(t), hw))
    curl_ribbon(PREFIX + 'peel_tab', TAB_X, stations, TAB_TH, 'soft', smooth=True)
    bm = bmesh.new()
    for i in range(3):
        t = 0.34 + i * 0.17
        y = TAB_Y0 + (TAB_Y1 - TAB_Y0) * t
        z0 = tab_z(t) + TAB_TH
        hw = TAB_HALF * math.sqrt(max(0.0, 1.0 - (max(0.0, t - 0.72) / 0.28) ** 2))
        bm_box(bm, TAB_X, y, z0 - 0.00003, z0 + 0.00040, 2.0 * hw * 0.86, 0.00110)
    mesh_from_bm(PREFIX + 'peel_tab_ribs', bm, 'dark', smooth=False)

    # 8. модуль датчика импеданса
    slab(PREFIX + 'sensor_gasket', SENS['sx'] + 0.0014, SENS['sy'] + 0.0080,
         0.00160, SENS_Z0, 0.0024, 'dark', seg=5,
         cx=SENS['cx'], cy=SENS['cy'])
    cube(PREFIX + 'sensor_base', (SENS['cx'], SENS['cy'], (SENS_Z0 + SENS_Z1) * 0.5),
         (SENS['sx'], SENS['sy'], SENS_Z1 - SENS_Z0), 'dark', r=0.0012, smooth=True)
    cube(PREFIX + 'sensor_can', (SENS['cx'], SENS['cy'], (SENS_Z1 + CAN_Z1) * 0.5),
         (SENS['sx'] - 0.0030, SENS['sy'] - 0.0040, CAN_Z1 - SENS_Z1),
         'silver', r=0.0009, smooth=True)
    cube(PREFIX + 'sensor_label', (SENS['cx'] - 0.0012, SENS['cy'] - 0.0062, CAN_Z1 + 0.00016),
         (0.0082, 0.0030, 0.00032), 'print', r=0.0001)
    cube(PREFIX + 'sensor_rib', (SENS['cx'] - 0.0012, SENS['cy'] - 0.0020, CAN_Z1 + 0.00014),
         (0.0090, 0.0011, 0.00028), 'dark', r=0.0001)
    cube(PREFIX + 'sensor_ic', (SENS['cx'] - 0.0034, SENS['cy'] + 0.0018, CAN_Z1 + 0.00036),
         (0.0058, 0.0052, 0.00072), 'dark', r=0.0003)
    torus(PREFIX + 'sensor_led_ring', (SENS['cx'] + 0.0040, SENS['cy'] + 0.0074, CAN_Z1 + 0.00022),
          0.0023, 0.00045, 'dark', 'Z')
    sphere(PREFIX + 'sensor_led', (SENS['cx'] + 0.0040, SENS['cy'] + 0.0074, CAN_Z1 + 0.00048),
           0.00175, 'cyan')
    cube(PREFIX + 'sensor_clip', (SENS['cx'] + 0.0008, SENS['cy'] + 0.0142, 0.00320),
         (0.0074, 0.0052, 0.0022), 'silver', r=0.0005, smooth=True)

    # 9. кабель и разъём
    cyl(PREFIX + 'strain_relief', (0.0462, SENS['cy'], 0.00480),
        (0.0498, SENS['cy'], 0.00480), 0.00300, 'dark', vertices=18, r2=0.0026,
        bev=0.0005)
    curve_tube(PREFIX + 'cable',
               [(0.0490, 0.0012, 0.00490),
                (0.0528, 0.0088, 0.00870),
                (0.0518, 0.0195, 0.00720),
                (0.0498, 0.0272, 0.00420)], 0.00240, 'dark')
    cube(PREFIX + 'connector', (0.0495, 0.0338, 0.00220),
         (0.0092, 0.0170, 0.00440), 'graphite', r=0.0010, smooth=True)
    bm = bmesh.new()
    for i in (-1, 1):
        bm_box(bm, 0.0495 + i * 0.0022, 0.0426, 0.00110, 0.00190, 0.0013, 0.0032)
    mesh_from_bm(PREFIX + 'connector_pins', bm, 'silver', smooth=False)
    cube(PREFIX + 'connector_latch', (0.0495, 0.0402, 0.00440),
         (0.0056, 0.0040, 0.0016), 'silver', r=0.0004, smooth=True)

    # 10. маркировка полярности и партии на графитовом поле
    z0, z1 = BACK_Z1, BACK_Z1 + 0.00022
    bm = bmesh.new()
    bm_box(bm, -0.0112, 0.0322, z0, z1, 0.0050, 0.00135)
    bm_box(bm, -0.0112, 0.0322, z0, z1, 0.00135, 0.0050)
    mesh_from_bm(PREFIX + 'mark_plus', bm, 'cyan', smooth=False)
    bm = bmesh.new()
    bm_box(bm, 0.0036, 0.0322, z0, z1, 0.0050, 0.00135)
    mesh_from_bm(PREFIX + 'mark_minus', bm, 'cyan', smooth=False)

    bm = bmesh.new()
    for h, y in ((0.0060, -0.0110), (0.0028, -0.0060), (0.0038, -0.0002),
                 (0.0024, 0.0052), (0.0054, 0.0098)):
        zz0 = BACK_Z1
        zz1 = BACK_Z1 + 0.00020
        bm_box(bm, -0.0322, y, zz0, zz1, 0.00130, h)
    mesh_from_bm(PREFIX + 'mark_code', bm, 'print', smooth=False)

    # 11. пустышка-якорь (движения нет)
    empty(PREFIX + 'anim', (0.0, 0.0, 0.0))

    bpy.context.view_layer.update()
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH':
            o['rotating'] = False


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
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)
    report = {
        'component': CID,
        'nodes': len(objs),
        'mesh_nodes': len(meshes),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_size_mm': [round(v * 1000, 2) for v in size],
        'bbox_ok': bool(size.x <= 0.100 and size.y <= 0.100 and size.z <= 0.030),
        'materials': sorted(m.name for m in bpy.data.materials),
        'node_names': sorted(o.name for o in objs),
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
        'tris': tris,
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
    if not path.is_file() or path.stat().st_size < 10240:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    build()
    rep = check()
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok']:
        raise SystemExit('bbox check failed')


main()
