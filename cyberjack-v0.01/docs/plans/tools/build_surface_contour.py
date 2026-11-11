"""Standalone builder: surface_contour (SRF-CONT-08, «Контур»).

Анатомически профилированный силиконовый мат 2,0 x 0,9 x 0,1 м
(вакуумная формовка по телу, крепление в раму):

  * молочный/ivory мягкий слой с плавным рельефом, без плиты;
  * центральный канал по линии позвоночника (глубже в крестце);
  * параспинальные валики, лопаточные площадки с выемками, тазовая чаша,
    бёдерные желоба, коленные подушечки, пяточные выемки, ложе головы;
  * скруглённая кромка с откатом, кант-шнур и строчка по периметру и каналу;
  * ремни по четырём углам + два поперечных пояса, липучки-накладки;
  * маркировка зон по бортам и поперечные швы секций;
  * графитовый вакуумный клапан с патрубком, шланг и фильтр-насадка;
  * крепление в раму: направляющие в нижней нише + фиксаторы ремней.

Не зависит от build_component_library.py. Вращений и анимации нет.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_surface_contour.py

Выход:
  public/models/machine-modules/components/surface_contour.glb
  docs/plans/blockout/component-library/surface_contour/*.png  (4 ракурса)
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
SHOTS = PROJECT / 'docs/plans/blockout/component-library/surface_contour'
CID = 'surface_contour'
PREFIX = CID + '__'

# --- ключевые размеры (м) -------------------------------------------------
AX, AY = 0.9900, 0.4435        # полугабариты мата (1,98 x 0,887)
RC = 0.0550                    # скругление плана
Z0 = 0.0000                    # низ мата
HB = 0.0775                    # опорная высота верхней поверхности
RR = 0.0240                    # радиус отката кромки
RECESS = 0.0078                # ниша снизу (мат — оболочка, не плита)

N_LONG, N_SHORT, N_CORNER = 112, 14, 5
N_ARC, N_WALL = 6, 3

PALETTE = {
    'skin': (0.958, 0.949, 0.930),
    'shade': (0.836, 0.824, 0.803),
    'graphite': (0.268, 0.280, 0.298),
    'thread': (0.848, 0.742, 0.726),
    'velcro': (0.680, 0.662, 0.640),
    'mark': (0.435, 0.470, 0.492),
}
ROUGH = {'skin': 0.80, 'shade': 0.78, 'graphite': 0.42,
         'thread': 0.93, 'velcro': 0.97, 'mark': 0.55}
METAL = {'graphite': 0.24}
MATS = {}


# --- helpers --------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_contour_{role}_100')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = METAL.get(role, 0.0)
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


def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3.0 - 2.0 * t)


def bm_to_obj(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def bevel_mod(obj, width, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0010, rot=(0, 0, 0), smooth=False):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel_mod(obj, r)
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
        select_only(obj)
        bevel_mod(obj, bev, 2)
    return apply(obj, role, smooth)


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


def curve_tube(name, points, radius, role, cyclic=False, res=3, smooth=True):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 1
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for p, q in zip(sp.points, points):
        p.co = (q[0], q[1], q[2], 1.0)
    sp.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return apply(bpy.context.object, role, smooth)


def ribbon(name, path, half_w, role, thickness=0.0045):
    """Лента по (P, W); Solidify даёт толщину."""
    bm = bmesh.new()
    rows = []
    for p, w in path:
        rows.append([bm.verts.new(p + w * half_w), bm.verts.new(p - w * half_w)])
    for i in range(len(rows) - 1):
        a, b = rows[i], rows[i + 1]
        bm.faces.new((a[0], b[0], b[1], a[1]))
    obj = bm_to_obj(name, bm, role, True)
    mod = obj.modifiers.new('sol', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = 0.0
    mod.use_even_offset = False
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    for poly in obj.data.polygons:
        poly.use_smooth = True
    return obj


def outline_pts(ax, ay, rc, n=12):
    """Замкнутый контур скруглённого прямоугольника."""
    pts = []
    for cx, cy, a0 in ((ax - rc, ay - rc, 0.0),
                       (-(ax - rc), ay - rc, math.pi / 2),
                       (-(ax - rc), -(ay - rc), math.pi),
                       (ax - rc, -(ay - rc), 1.5 * math.pi)):
        for k in range(n):
            a = a0 + (math.pi / 2) * k / n
            pts.append(Vector((cx + rc * math.cos(a), cy + rc * math.sin(a), 0.0)))
    return pts


def ring_points(ax, ay, rc):
    rc = max(rc, 1e-4)
    pts = []
    for k in range(N_SHORT):                      # x=+ax
        pts.append((ax, -(ay - rc) + 2 * (ay - rc) * k / (N_SHORT - 1)))
    for k in range(1, N_CORNER):                  # NE
        a = (math.pi / 2) * k / N_CORNER
        pts.append((ax - rc + rc * math.cos(a), ay - rc + rc * math.sin(a)))
    for k in range(N_LONG):                       # y=+ay
        pts.append((ax - rc - 2 * (ax - rc) * k / (N_LONG - 1), ay))
    for k in range(1, N_CORNER):                  # NW
        a = math.pi / 2 + (math.pi / 2) * k / N_CORNER
        pts.append((-ax + rc + rc * math.cos(a), ay - rc + rc * math.sin(a)))
    for k in range(N_SHORT):                      # x=-ax
        pts.append((-ax, ay - rc - 2 * (ay - rc) * k / (N_SHORT - 1)))
    for k in range(1, N_CORNER):                  # SW
        a = math.pi + (math.pi / 2) * k / N_CORNER
        pts.append((-ax + rc + rc * math.cos(a), -ay + rc + rc * math.sin(a)))
    for k in range(N_LONG):                       # y=-ay
        pts.append((-ax + rc + 2 * (ax - rc) * k / (N_LONG - 1), -ay))
    for k in range(1, N_CORNER):                  # SE
        a = 1.5 * math.pi + (math.pi / 2) * k / N_CORNER
        pts.append((ax - rc + rc * math.cos(a), -ay + rc + rc * math.sin(a)))
    return pts


# --- анатомический рельеф -------------------------------------------------
def interior(x, y):
    """Расстояние от точки до кромки (внутрь > 0)."""
    qx = abs(x) - (AX - RC)
    qy = abs(y) - (AY - RC)
    d = (math.hypot(max(qx, 0.0), max(qy, 0.0))
         + min(max(qx, qy), 0.0) - RC)
    return -d


def win(x, a, b, f=0.09):
    """Окно по X: 0 -> 1 -> 0 с мягкими склонами."""
    return smoothstep((x - a) / f) * (1.0 - smoothstep((x - b) / f))


def g2(x, y, cx, cy, sx, sy):
    return math.exp(-(((x - cx) / sx) ** 2 + ((y - cy) / sy) ** 2))


def relief(x, y):
    """Отклонение верхней поверхности от опорной плоскости (м)."""
    ay = abs(y)
    r = 0.0
    # --- позвоночный канал: плоское дно, чёткие плечи ---------------------
    ch = 1.0 / (1.0 + (ay / 0.046) ** 4.0)
    ch_len = win(x, -0.100, 0.888, 0.115)
    r -= 0.0205 * ch * ch_len
    # крестцовая впадина
    r -= 0.0055 * g2(x, ay, 0.070, 0.0, 0.130, 0.098) * ch_len
    # поясничная подушка (дно канала приподнято)
    r += 0.0050 * g2(x, y, 0.320, 0.0, 0.098, 0.042)
    # --- параспинальные валики (непрерывные) ------------------------------
    r += 0.0162 * math.exp(-((ay - 0.104) / 0.030) ** 2) * win(x, -0.845, 0.875, 0.090)
    # --- податливая зона по борту тела (боковой жёлоб) ---------------------
    r -= 0.0058 * math.exp(-((ay - 0.268) / 0.052) ** 2) * win(x, -0.880, 0.865, 0.100)
    # --- лопаточная площадка (подъём борта у головы) ----------------------
    sp_x = smoothstep((x - 0.210) / 0.150) * (1.0 - smoothstep((x - 0.690) / 0.140))
    sp_y = smoothstep((ay - 0.128) / 0.075) * (1.0 - smoothstep((ay - 0.320) / 0.085))
    r += 0.0088 * sp_x * sp_y
    # подлопаточная выемка
    r -= 0.0058 * g2(x, ay, 0.500, 0.248, 0.082, 0.052)
    # --- тазовая чаша -----------------------------------------------------
    r -= 0.0135 * g2(x, y, 0.095, 0.0, 0.145, 0.225)
    # --- бёдерные желоба --------------------------------------------------
    r -= 0.0112 * math.exp(-((ay - 0.192) / 0.060) ** 2) * win(x, -0.905, -0.015, 0.100)
    # --- коленные подушечки ----------------------------------------------
    r += 0.0062 * g2(x, ay, -0.362, 0.192, 0.074, 0.056)
    # --- пяточные выемки --------------------------------------------------
    r -= 0.0110 * g2(x, ay, -0.792, 0.180, 0.076, 0.060)
    # --- подъём у торца (стопы) ------------------------------------------
    r += 0.0048 * g2(x, y, -0.930, 0.0, 0.052, 0.285)
    # --- ложе головы и шейная выемка -------------------------------------
    r -= 0.0122 * g2(x, y, 0.858, 0.0, 0.094, 0.126)
    r -= 0.0040 * g2(x, y, 0.735, 0.0, 0.050, 0.084)
    return r


def fade(x, y):
    return smoothstep((interior(x, y) - 0.020) / 0.055)


def top_z(x, y):
    return HB + relief(x, y) * fade(x, y)


def bottom_z(x, y):
    """Ниша снизу: мат — оболочка, а не плита."""
    return Z0 + RECESS * smoothstep((interior(x, y) - 0.040) / 0.034)


# --- сборка ---------------------------------------------------------------
def build_pad():
    bm = bmesh.new()
    stations = []

    # верх: от линии центра к кромке, плотнее у канала
    y = 0.0009
    while y < AY - RR - 0.0004:
        if y < 0.085:
            step = 0.0034
        elif y < 0.165:
            step = 0.0054
        elif y < 0.340:
            step = 0.0082
        else:
            step = 0.0062
        stations.append(('top', AY - y, None))
        y += step
    stations.append(('top', RR, None))
    for k in range(1, N_ARC + 1):                 # откат кромки
        a = (math.pi / 2) * k / N_ARC
        stations.append(('z', RR * (1 - math.sin(a)), HB - RR * (1 - math.cos(a))))
    for k in range(1, N_WALL + 1):                # борт
        stations.append(('z', 0.0, (HB - RR) - (HB - 2 * RR) * k / N_WALL))
    for k in range(1, N_ARC + 1):                 # откат снизу
        a = math.pi / 2 - (math.pi / 2) * k / N_ARC
        stations.append(('z', RR * (1 - math.sin(a)), Z0 + RR * (1 - math.cos(a))))
    y = RR
    while y < AY - 0.0009:
        stations.append(('bot', AY - y, None))
        y += 0.0062 if y < 0.130 else 0.0090
    stations.append(('bot', AY - 0.0009, None))

    rings, kinds = [], []
    for kind, inset, zval in stations:
        loop = ring_points(AX - inset, AY - inset, RC - inset)
        ring = []
        for x, yy in loop:
            if kind == 'top':
                z = top_z(x, yy)
            elif kind == 'bot':
                z = bottom_z(x, yy)
            else:
                z = zval
            ring.append(bm.verts.new((x, yy, z)))
        rings.append(ring)
        kinds.append(kind)

    n = len(rings[0])
    for i in range(len(rings) - 1):
        a, b_ = rings[i], rings[i + 1]
        mi = 0 if (kinds[i] == 'top' and kinds[i + 1] == 'top') else 1
        for j in range(n):
            k = (j + 1) % n
            f = bm.faces.new((a[j], a[k], b_[k], b_[j]))
            f.material_index = mi
    f = bm.faces.new(tuple(reversed(rings[0])))
    f.material_index = 0
    f = bm.faces.new(rings[-1])
    f.material_index = 1

    obj = bm_to_obj(PREFIX + 'pad', bm, 'skin', True)
    obj.data.materials.append(mat('shade'))
    return obj, len(rings) * n, len(rings)


def dash(bm, x, y, w, length, width=0.0017, thick=0.0011, lift=0.0002):
    t = Vector((w[0], w[1], 0.0)).normalized()
    nr = Vector((-t.y, t.x, 0.0))
    base = Vector((x, y, top_z(x, y) + lift))
    quad = ((0.5, 0.5), (0.5, -0.5), (-0.5, -0.5), (-0.5, 0.5))
    low = [bm.verts.new(base + t * (a * length) + nr * (b * width)) for a, b in quad]
    high = [bm.verts.new(base + t * (a * length) + nr * (b * width)
                         + Vector((0, 0, thick))) for a, b in quad]
    bm.faces.new(low)
    bm.faces.new(tuple(reversed(high)))
    for i in range(4):
        j = (i + 1) % 4
        bm.faces.new((low[i], low[j], high[j], high[i]))


def surface_patch(name, cx, cy, hx, hy, role, lift=0.0007, thick=0.0016, nx=7, ny=4):
    """Тонкая накладка, лежащая по рельефу (маркировка, липучка)."""
    bm = bmesh.new()
    grid = []
    for i in range(nx):
        row = []
        x = cx - hx + 2 * hx * i / (nx - 1)
        for j in range(ny):
            y = cy - hy + 2 * hy * j / (ny - 1)
            row.append(Vector((x, y, top_z(x, y) + lift)))
        grid.append(row)
    top = [[bm.verts.new(p) for p in row] for row in grid]
    bot = [[bm.verts.new(p - Vector((0, 0, thick))) for p in row] for row in grid]
    for i in range(nx - 1):
        for j in range(ny - 1):
            bm.faces.new((top[i][j], top[i + 1][j], top[i + 1][j + 1], top[i][j + 1]))
            bm.faces.new((bot[i][j + 1], bot[i + 1][j + 1], bot[i + 1][j], bot[i][j]))
    for i in range(nx - 1):
        bm.faces.new((top[i][0], top[i + 1][0], bot[i + 1][0], bot[i][0]))
        bm.faces.new((bot[i][ny - 1], bot[i + 1][ny - 1], top[i + 1][ny - 1],
                      top[i][ny - 1]))
    for j in range(ny - 1):
        bm.faces.new((bot[0][j], bot[0][j + 1], top[0][j + 1], top[0][j]))
        bm.faces.new((top[nx - 1][j], top[nx - 1][j + 1], bot[nx - 1][j + 1],
                      bot[nx - 1][j]))
    return bm_to_obj(name, bm, role, True)


def belt_z(x0, y, bridge=0.048):
    """Пояс натянут: сглаженный профиль, огибает углубления и валики."""
    ds = (-bridge, -bridge * 0.72, -bridge * 0.44, -bridge * 0.2, 0.0,
          bridge * 0.2, bridge * 0.44, bridge * 0.72, bridge)
    ws = (0.55, 0.85, 1.25, 1.55, 1.65, 1.55, 1.25, 0.85, 0.55)
    acc = sum(w * top_z(x0, min(max(y + d, -(AY - 0.004)), AY - 0.004))
              for d, w in zip(ds, ws))
    return acc / sum(ws) + 0.0019


def end_wrap_path(sx, y0, off=0.0019):
    """Путь ремня через торец x=±AX: верх -> откат -> борт -> низ."""
    pts = []
    for dx in (0.118, 0.098, 0.080, 0.064, 0.048, 0.034, 0.023):
        x = sx * (AX - dx)
        pts.append(Vector((x, y0, top_z(x, y0) + off + 0.0003)))
    for k in range(0, 7):
        a = (math.pi / 2) * k / 6
        pts.append(Vector((sx * (AX - RR * (1 - math.sin(a)) + off * math.sin(a)),
                           y0,
                           HB - RR * (1 - math.cos(a)) + off * math.cos(a))))
    for z in (HB - RR - 0.022, HB - RR - 0.050, Z0 + RR + 0.018):
        pts.append(Vector((sx * (AX + off), y0, z)))
    for k in range(6, -1, -1):
        a = (math.pi / 2) * k / 6
        pts.append(Vector((sx * (AX - RR * (1 - math.sin(a)) + off * math.sin(a)),
                           y0,
                           max(Z0 + RR * (1 - math.cos(a)) - off * math.cos(a), 0.0034))))
    pts.append(Vector((sx * (AX - 0.010), y0, 0.0034)))
    return pts


def side_wrap_path(x0, off=0.0019):
    """Путь поперечного пояса через оба борта y=±AY."""
    pts = [Vector((x0, -(AY - 0.052), 0.0034)),
           Vector((x0, -(AY - 0.014), 0.0034)),
           Vector((x0, -(AY + off), Z0 + 0.0080))]
    for z in (Z0 + RR + 0.007, 0.030, HB - RR - 0.030, HB - RR - 0.003):
        pts.append(Vector((x0, -(AY + off), z)))
    for k in range(5, -1, -1):
        a = (math.pi / 2) * k / 5
        pts.append(Vector((x0,
                           -(AY - RR * (1 - math.sin(a)) + off * math.sin(a)),
                           HB - RR * (1 - math.cos(a)) + off * math.cos(a))))
    y = -(AY - RR) + 0.006
    while y < AY - RR - 0.004:
        pts.append(Vector((x0, y, belt_z(x0, y))))
        y += 0.016
    for k in range(0, 6):
        a = (math.pi / 2) * k / 5
        pts.append(Vector((x0,
                           AY - RR * (1 - math.sin(a)) + off * math.sin(a),
                           HB - RR * (1 - math.cos(a)) + off * math.cos(a))))
    for z in (HB - RR - 0.003, HB - RR - 0.030, 0.030, Z0 + RR + 0.007):
        pts.append(Vector((x0, AY + off, z)))
    pts.append(Vector((x0, AY + off, Z0 + 0.0080)))
    pts.append(Vector((x0, AY - 0.014, 0.0034)))
    pts.append(Vector((x0, AY - 0.052, 0.0034)))
    return pts


def build_parts():
    # --- кант-шнур по периметру (по откату кромки) ------------------------
    loop = outline_pts(AX - 0.0135, AY - 0.0135, RC - 0.0135, n=22)
    curve_tube(PREFIX + 'piping',
               [(p.x, p.y, HB + 0.0013) for p in loop],
               0.0052, 'thread', cyclic=True, res=4)

    bm = bmesh.new()

    # --- строчка по периметру --------------------------------------------
    per = outline_pts(AX - 0.0305, AY - 0.0305, RC - 0.0305, n=22)
    total = sum((per[(i + 1) % len(per)] - per[i]).length for i in range(len(per)))
    n_st = int(total / 0.0170)
    for i in range(n_st):
        d = (i + 0.5) * total / n_st
        acc, p, w = 0.0, per[-1], per[0] - per[-1]
        for j in range(len(per)):
            seg = (per[(j + 1) % len(per)] - per[j]).length
            if acc + seg >= d:
                f = (d - acc) / seg
                p = per[j].lerp(per[(j + 1) % len(per)], f)
                w = per[(j + 1) % len(per)] - per[j]
                break
            acc += seg
        dash(bm, p.x, p.y, (w.x, w.y), 0.0095)

    # --- строчка вдоль канала --------------------------------------------
    for sy in (-1, 1):
        y = sy * 0.0790
        x = -0.812
        while x <= 0.856:
            dash(bm, x, y, (1.0, 0.0), 0.0095)
            x += 0.0170

    # --- поперечные швы секций + маркировка зон ---------------------------
    zones = (0.700, 0.300, -0.020, -0.700)
    for zx in zones:
        y = -0.404
        while y <= 0.404:                       # шов через всю ширину
            dash(bm, zx, y, (0.0, 1.0), 0.0085)
            y += 0.0150
    bm_to_obj(PREFIX + 'stitching', bm, 'thread', False)

    bm = bmesh.new()
    for zx in zones:
        for sy in (-1, 1):
            y0, y1 = sy * 0.318, sy * 0.402
            rows = []
            for i in range(9):
                y = y0 + (y1 - y0) * i / 8
                rows.append((Vector((zx, y, top_z(zx, y) + 0.0006)),
                             Vector((0.0032, 0.0, 0.0))))
            low = [bm.verts.new(p - w) for p, w in rows]
            high = [bm.verts.new(p + w) for p, w in rows]
            for i in range(len(rows) - 1):
                bm.faces.new((low[i], low[i + 1], high[i + 1], high[i]))
            for ty in (sy * 0.292, sy * 0.428):  # насечки-риски зоны
                for sx in (-1, 1):
                    x0 = zx + sx * 0.006
                    cube(PREFIX + '_tick', (x0, ty, top_z(x0, ty) + 0.0005),
                         (0.010, 0.0030, 0.0014), 'mark', r=0.0004)
    marks = bm_to_obj(PREFIX + 'zone_marks', bm, 'mark', True)
    ticks = [o for o in bpy.data.objects if o.name.startswith(PREFIX + '_tick')]
    if ticks:
        bpy.ops.object.select_all(action='DESELECT')
        for o in ticks:
            o.select_set(True)
        marks.select_set(True)
        bpy.context.view_layer.objects.active = marks
        bpy.ops.object.join()

    # --- шнуры-канты по плечам канала ------------------------------------
    for sy in (-1, 1):
        y = sy * 0.0585
        path = []
        for i in range(31):
            x = -0.790 + (0.860 + 0.790) * i / 30
            path.append((x, y, top_z(x, y) + 0.0012))
        curve_tube(PREFIX + f'channel_cord_{"p" if sy > 0 else "n"}',
                   path, 0.0025, 'thread', res=2)

    # --- ремни с липучками по четырём углам -------------------------------
    for sx in (-1, 1):
        for sy in (-1, 1):
            tag = ('p' if sx > 0 else 'n') + ('p' if sy > 0 else 'n')
            y0 = sy * 0.300
            ribbon(PREFIX + f'strap_{tag}',
                   [(p, Vector((0.0, 1.0, 0.0)))
                    for p in end_wrap_path(sx, y0)],
                   0.0300, 'graphite', 0.0044)
            px = sx * (AX - 0.066)
            surface_patch(PREFIX + f'velcro_{tag}', px, y0, 0.042, 0.024,
                          'velcro', lift=0.0050, thick=0.0016, nx=6, ny=4)
            cube(PREFIX + f'buckle_{tag}',
                 (sx * (AX + 0.0044), y0, HB - RR - 0.036),
                 (0.0070, 0.030, 0.0130), 'graphite', r=0.0012)

    # --- поперечные пояса фиксации ---------------------------------------
    for tag, bx in (('chest', 0.430), ('shin', -0.430)):
        ribbon(PREFIX + f'belt_{tag}',
               [(p, Vector((1.0, 0.0, 0.0))) for p in side_wrap_path(bx)],
               0.0320, 'graphite', 0.0038)
        for sy in (-1, 1):                      # пряжки-держатели пояса
            py = sy * 0.148
            cube(PREFIX + f'belt_keeper_{tag}_{"p" if sy > 0 else "n"}',
                 (bx, py, belt_z(bx, py) + 0.0028),
                 (0.076, 0.016, 0.0050), 'graphite', r=0.0010)
            cube(PREFIX + f'belt_keeper_slot_{tag}_{"p" if sy > 0 else "n"}',
                 (bx, py, belt_z(bx, py) + 0.0034),
                 (0.052, 0.0068, 0.0026), 'graphite', r=0.0004)
        cube(PREFIX + f'belt_buckle_{tag}', (bx, 0.0, top_z(bx, 0.0) + 0.0056),
             (0.034, 0.040, 0.0072), 'graphite', r=0.0014)
        cube(PREFIX + f'belt_buckle_slot_{tag}', (bx, 0.0, top_z(bx, 0.0) + 0.0092),
             (0.019, 0.011, 0.0026), 'graphite', r=0.0005)

    # --- направляющие в нижней нише (крепление в раму) ---------------------
    for sy in (-1, 1):
        cube(PREFIX + f'mount_rail_{"p" if sy > 0 else "n"}',
             (0.0, sy * 0.290, RECESS * 0.5), (1.540, 0.024, RECESS),
             'graphite', r=0.0015)
    for sx in (-1, 1):
        cube(PREFIX + f'mount_tab_{"p" if sx > 0 else "n"}',
             (sx * 0.462, 0.0, RECESS * 0.5), (0.140, 0.022, RECESS),
             'graphite', r=0.0014)

    # --- вакуумный клапан (графит) ----------------------------------------
    vx, vy = 0.848, -0.352
    zb = top_z(vx, vy)
    cyl(PREFIX + 'valve_boss', (vx, vy, zb - 0.004), (vx, vy, zb + 0.0076),
        0.0205, 'graphite', vertices=30, bev=0.0018)
    torus(PREFIX + 'valve_ring', (vx, vy, zb + 0.0076), 0.0178, 0.0024, 'graphite')
    cyl(PREFIX + 'valve_cap', (vx, vy, zb + 0.0082), (vx, vy, zb + 0.0126),
        0.0144, 'graphite', vertices=26, bev=0.0013)
    cyl(PREFIX + 'valve_stem', (vx, vy, zb + 0.0122), (vx, vy, zb + 0.0158),
        0.0070, 'graphite', vertices=16)
    cyl(PREFIX + 'valve_nub', (vx, vy - 0.013, zb + 0.0044),
        (vx, vy - 0.036, zb + 0.0038), 0.0062, 'graphite', vertices=14, bev=0.0008)

    # шланг: от патрубка через кромку вниз, к фильтру под бортом
    curve_tube(PREFIX + 'hose',
               [(vx, vy - 0.034, zb + 0.0038),
                (vx, vy - 0.048, zb + 0.0012),
                (vx + 0.002, vy - 0.060, zb - 0.012),
                (vx + 0.004, vy - 0.062, 0.046),
                (vx + 0.006, vy - 0.058, 0.034)],
               0.0056, 'graphite', res=4)

    # фильтр-насадка (под кромкой, на шланге)
    f0 = Vector((vx + 0.006, vy - 0.058, 0.034))
    f1 = Vector((vx + 0.008, vy - 0.050, 0.006))
    cyl(PREFIX + 'filter', f0, f1, 0.0150, 'graphite', vertices=20, bev=0.0012)
    for i in range(5):
        a = math.pi * 0.2 + i * math.pi * 0.4
        cyl(PREFIX + f'filter_slot_{i}',
            Vector((f0.x + math.cos(a) * 0.0156, f0.y + math.sin(a) * 0.0156, 0.028)),
            Vector((f0.x + math.cos(a) * 0.0156, f0.y + math.sin(a) * 0.0156, 0.032)),
            0.0016, 'graphite', vertices=6)
    curve_tube(PREFIX + 'filter_tail',
               [(f1.x, f1.y, 0.008), (f1.x - 0.004, f1.y + 0.030, 0.006),
                (f1.x - 0.010, f1.y + 0.070, 0.005)],
               0.0046, 'graphite', res=3)

    # --- эвакуационный порт в начале канала --------------------------------
    px, py = -0.700, 0.0
    zp = top_z(px, py)
    cyl(PREFIX + 'duct_port', (px, py, zp - 0.005), (px, py, zp + 0.0020),
        0.0136, 'graphite', vertices=22, bev=0.0012)
    torus(PREFIX + 'duct_ring', (px, py, zp + 0.0018), 0.0124, 0.0015, 'graphite')

    # --- тканевая бирка ---------------------------------------------------
    lx, ly = -0.870, 0.400
    surface_patch(PREFIX + 'label', lx, ly, 0.032, 0.011, 'skin',
                  lift=0.0006, thick=0.0012, nx=5, ny=3)
    surface_patch(PREFIX + 'label_bar', lx, ly, 0.020, 0.0028, 'thread',
                  lift=0.0017, thick=0.0006, nx=4, ny=2)


def build():
    reset()
    pad, verts, rings = build_pad()
    build_parts()
    return pad, verts, rings


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


def check(verts, rings):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    for o in meshes:
        o.data.calc_loop_triangles()
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    mats = sorted({m.name for o in meshes for m in o.data.materials if m})
    samples = [top_z(x / 60, y / 100) for x in range(-59, 60, 2)
               for y in range(-43, 44, 2)]
    rep = {
        'component': CID,
        'nodes': len(objs),
        'meshes': len(meshes),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(abs(size.x - 2.0) <= 0.012 and abs(size.y - 0.9) <= 0.012
                        and 0.090 <= size.z <= 0.102),
        'verts_total': sum(len(o.data.vertices) for o in meshes),
        'tris_total': sum(len(o.data.loop_triangles) for o in meshes),
        'materials': mats,
        'mat_count': len(mats),
        'objects': sorted(o.name for o in meshes),
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
        'relief_mm': {
            'channel_bottom_sacrum': round((top_z(0.075, 0.0) - HB) * 1000, 2),
            'channel_bottom_thorax': round((top_z(0.500, 0.0) - HB) * 1000, 2),
            'ridge_top': round((top_z(0.600, 0.108) - HB) * 1000, 2),
            'pelvis_bowl': round((top_z(0.095, 0.150) - HB) * 1000, 2),
            'scapula_platform': round((top_z(0.500, 0.230) - HB) * 1000, 2),
            'thigh_groove': round((top_z(-0.450, 0.192) - HB) * 1000, 2),
            'heel_pocket': round((top_z(-0.795, 0.180) - HB) * 1000, 2),
            'head_bed': round((top_z(0.858, 0.0) - HB) * 1000, 2),
        },
        'relief_span_mm': round((max(samples) - min(samples)) * 1000, 2),
        'pad_verts': verts,
        'pad_rings': rings,
    }
    return rep


def export():
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
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
def render_setup(glb):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    try:
        sc.eevee.use_raytracing = True
        sc.eevee.ray_tracing_options.use_denoise = True
    except AttributeError:
        pass
    try:
        sc.eevee.use_fast_gi = True
        sc.eevee.fast_gi_method = 'AMBIENT_OCCLUSION_ONLY'
        sc.eevee.fast_gi_distance = 0.06
        sc.eevee.fast_gi_resolution = '2'
    except AttributeError:
        pass
    sc.render.image_settings.file_format = 'PNG'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.700, 0.696, 0.686, 1)
    bg.inputs['Strength'].default_value = 0.28
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Punchy'
    except TypeError:
        pass
    sc.view_settings.exposure = 0.15

    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.0025))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.560, 0.550, 0.532, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (0.42, -0.88, 0.34), 2.60),
        ('fill', (-1.05, -0.55, 0.30), 0.40),
        ('rim', (0.15, 1.00, 0.42), 0.72),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(16)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()

    bpy.ops.import_scene.gltf(filepath=str(glb))
    bpy.context.view_layer.update()

    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in sc.objects:
        if o.type != 'MESH' or o.name == 'Plane':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    return mn, mx


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=70,
         res=(1000, 640)):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    cam = bpy.data.objects.get('cam')
    if cam is None:
        cd = bpy.data.cameras.new('cam')
        cam = bpy.data.objects.new('cam', cd)
        sc.collection.objects.link(cam)
    sc.camera = cam
    d = Vector(direction).normalized()
    if ortho_scale:
        cam.data.type = 'ORTHO'
        cam.data.ortho_scale = ortho_scale
        cam.location = Vector(target) + d * 2.0
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
        cam.location = Vector(target) + d * dist
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat(
        '-Z', 'Y').to_euler()
    sc.render.filepath = str(SHOTS / f'{CID}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)
    return sc.render.filepath


def render_shots(glb):
    SHOTS.mkdir(parents=True, exist_ok=True)
    mn, mx = render_setup(glb)
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx],
          flush=True)
    center = (mn + mx) * 0.5
    size = mx - mn
    out = []
    out.append(shot('3q', (1.05, -1.35, 0.60), center,
                    ortho_scale=size.x * 1.06, res=(1000, 660)))
    out.append(shot('front', (0.04, -1.0, 0.26), center,
                    ortho_scale=size.x * 1.03, res=(1000, 540)))
    out.append(shot('side', (1.0, -0.40, 0.22), center,
                    ortho_scale=1.04, res=(1000, 660)))
    out.append(shot('closeup', (-1.0, -0.09, 0.15), (0.620, 0.000, 0.062),
                    dist=0.82, lens=78, res=(900, 780)))
    return out


def main():
    pad, verts, rings = build()
    rep = check(verts, rings)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    shots = render_shots(path)
    rep['renders'] = [str(Path(s).relative_to(PROJECT)) for s in shots]
    rep['render_bytes'] = {Path(s).name: Path(s).stat().st_size for s in shots}
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok']:
        raise SystemExit('bbox check failed')
    if rep['mat_count'] < 4 or rep['bad_names']:
        raise SystemExit('material/name check failed')


main()
