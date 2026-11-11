"""Standalone builder: structure_stall_row (STR-STALL-07, «Ряд кабин»).

Ряд из 7 прозрачных округлых кабин-капсул 6,8 x 1,0 x 2,1 м: общий подиум с
жалюзи, 7 отдельных капсульных модулей (скруглённый план, цилиндрические
стойки, кольцевые обвязки, сводчатая стеклянная кровля с рёбрами), панорамные
стеклянные двери с большими радиусами углов на петлях с ручками, прозрачные
боковые/задние панели, тонкие рамы перегородок вместо глухих стен, видимый
интерьер (настил, скамья, полка, штанга, потолочный светильник, щиток),
статусные лампы занятости, вентиляционные решётки, общий кабельный лоток с
стояком и вводом.

Не зависит от build_component_library.py / build_*.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_structure_stall_row.py

Выход:
  public/models/machine-modules/components/structure_stall_row.glb
  docs/plans/blockout/component-library/structure_stall_row/*.png
  docs/plans/blockout/component-library/structure_stall_row/report.json

Геометрия (Blender Z-up, метры):
  X - длина ряда 6,8 (7 кабин, шаг 0,9714), Y - глубина 1,0 (фасад -Y),
  Z - высота 2,1.  Низ на z = 0 (подиум), верх = 2,100 (конёк свода + ребро).
  вращения нет (motion: none), анимационная пустышка не нужна.
"""
from pathlib import Path
import json
import math
import re

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/structure_stall_row'
CID = 'structure_stall_row'
PREFIX = CID + '__'
FONT_PATH = Path('/usr/share/fonts/TTF/DejaVuSans-Bold.ttf')

# --- габарит и шаг кабин (м) --------------------------------------------
W_ROW, DEPTH, HEIGHT = 6.8, 1.0, 2.1
X0, X1 = -W_ROW * 0.5, W_ROW * 0.5
BAYS = 7
PITCH = W_ROW / BAYS                     # 0,9714
GAP = 0.056                              # зазор между капсулами
POD_W = PITCH - GAP                      # 0,9154 ширина капсулы
POD_HW = POD_W * 0.5
POD_HD = 0.470                           # полуглубина капсулы (0,94)
POST_R = 0.030

# --- подиум --------------------------------------------------------------
PLINTH_Z0, PLINTH_Z1 = 0.0, 0.078
PAD_Z0, PAD_Z1 = 0.078, 0.128            # скруглённая плита капсулы
DECK_Z0, DECK_Z1 = 0.128, 0.148
BASE_RING_Z = 0.152
RING_R = 0.024

# --- каркас капсулы ------------------------------------------------------
POST_Z0, POST_Z1 = 0.128, 1.795
TOP_RING_Z = 1.795
TOP_RING_R = 0.034
VAULT_Y = 0.455
VAULT_Z_EDGE = 1.825
VAULT_APEX = 2.084
VAULT_T = 0.012
RIB_R = 0.016
VAULT_DZ = VAULT_APEX - VAULT_Z_EDGE                              # 0,149
VAULT_R = (VAULT_Y ** 2 + VAULT_DZ ** 2) / (2.0 * VAULT_DZ)       # 0,7695
VAULT_ZC = VAULT_APEX - VAULT_R
VAULT_HALF_A = math.asin(VAULT_Y / VAULT_R)

# --- проём и дверь -------------------------------------------------------
OPEN_Y = -0.434                          # плоскость неподвижной рамы проёма
OPEN_W, OPEN_H, OPEN_R, OPEN_RT = 0.760, 1.585, 0.100, 0.340
OPEN_CZ = 0.9675
DOOR_Y = -0.466                          # плоскость полотна
DOOR_W, DOOR_H, DOOR_R, DOOR_RT = 0.768, 1.585, 0.105, 0.345
DOOR_CZ = 0.9775
DOOR_T = 0.010

# --- стекло --------------------------------------------------------------
BACK_Y = 0.446
PART_T = 0.012
GLASS_Z0, GLASS_Z1 = 0.160, 1.795

# --- фриз, лоток ---------------------------------------------------------
LAMP_Z = 1.795
CABLE_Z0, CABLE_Z1 = 1.688, 1.742

PALETTE = {
    'shell': (0.830, 0.838, 0.838),
    'graphite': (0.105, 0.112, 0.122),
    'glass': (0.560, 0.730, 0.790),
    'tint': (0.250, 0.450, 0.520),
    'steel': (0.700, 0.712, 0.722),
    'interior': (0.620, 0.570, 0.480),
    'green': (0.090, 0.720, 0.280),
    'warm': (1.000, 0.930, 0.820),
}
ROUGH = {'shell': 0.44, 'graphite': 0.30, 'glass': 0.030, 'tint': 0.045,
         'steel': 0.24, 'interior': 0.62, 'green': 0.30, 'warm': 0.40}
METAL = {'shell': 0.0, 'graphite': 0.40, 'glass': 0.0, 'tint': 0.05,
         'steel': 0.95, 'interior': 0.0, 'green': 0.0, 'warm': 0.0}
ALPHA = {'glass': 0.18, 'tint': 0.25}
EMIT = {'green': 3.60, 'warm': 2.60}
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
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = METAL[role]
    try:
        bsdf.inputs['IOR'].default_value = 1.45
    except KeyError:
        pass
    if role in EMIT:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = EMIT[role]
    if role in ALPHA:
        try:
            bsdf.inputs['Specular IOR Level'].default_value = 0.70
        except KeyError:
            pass
        a = ALPHA[role]
        bsdf.inputs['Alpha'].default_value = a
        m.blend_method = 'BLEND'
        m.surface_render_method = 'BLENDED'
        m.show_transparent_back = True
        m.use_backface_culling = False
        try:
            m.use_transparent_shadow = True
        except AttributeError:
            pass
        m.diffuse_color = (*color, a)
    else:
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


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def bevel(obj, width=0.0015, segments=2, angle=True):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40) if angle else math.radians(179)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), sharp=35.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    apply(obj, role)
    return shade(obj, sharp)


def cyl(name, a, b, radius, role, vertices=20, r2=None, bev=0.0, sharp=35.0):
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
    apply(obj, role)
    return shade(obj, sharp)


def rrect_points(w, h, r, seg=6, r_top=None):
    """Точки скруглённого прямоугольника (CCW); радиус верхних углов отдельно.

    Большой r_top даёт капсульный силуэт: купол сверху, узкое скругление снизу.
    """
    rt = r if r_top is None else r_top
    r = min(r, w * 0.5 - 1e-4, h * 0.5 - 1e-4)
    rt = min(rt, w * 0.5 - 1e-4, h * 0.5 - 1e-4)
    corners = ((w * 0.5 - rt, h * 0.5 - rt, 0.0, rt),
               (-w * 0.5 + rt, h * 0.5 - rt, 0.5 * math.pi, rt),
               (-w * 0.5 + r, -h * 0.5 + r, math.pi, r),
               (w * 0.5 - r, -h * 0.5 + r, 1.5 * math.pi, r))
    pts = []
    for cx, cy, a0, rad in corners:
        for i in range(seg + 1):
            a = a0 + 0.5 * math.pi * (i / seg)
            pts.append((cx + rad * math.cos(a), cy + rad * math.sin(a)))
    return pts


def _map3(u, v, w, plane):
    if plane == 'XY':
        return (u, v, w)
    if plane == 'XZ':
        return (u, w, v)
    return (w, u, v)


def rrect_prism(name, w, h, r, t, role, loc=(0.0, 0.0, 0.0), plane='XZ',
                seg=6, sharp=42.0, r_top=None):
    """Плита со скруглённым контуром: outline w x h, толщина t по нормали."""
    pts = rrect_points(w, h, r, seg, r_top)
    bm = bmesh.new()
    a = [bm.verts.new(_map3(u, v, -t * 0.5, plane)) for u, v in pts]
    b = [bm.verts.new(_map3(u, v, t * 0.5, plane)) for u, v in pts]
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(list(reversed(a)))
    bm.faces.new(list(b))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.location = loc
    apply(obj, role)
    return shade(obj, sharp)


def path_tube(name, pts, radius, role, closed=True, res=2, sharp=45.0):
    """Труба по полилинии (скруглённый контур капсулы)."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    cu.resolution_u = 2
    sp = cu.splines.new('POLY')
    sp.points.add(len(pts) - 1)
    for p, pt in zip(sp.points, pts):
        p.co = (pt[0], pt[1], pt[2], 1.0)
    sp.use_cyclic_u = closed
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return shade(bpy.context.object, sharp)


def sweep_shell(name, prof, x0, x1, t_in, zc, role, sharp=50.0):
    """Сводчатая оболочка: профиль (y,z) по дуге радиуса от (0,zc), толщина внутрь."""
    bm = bmesh.new()
    n = len(prof)
    out = []
    inn = []
    for x in (x0, x1):
        ro, ri = [], []
        for (y, z) in prof:
            d = math.hypot(y, z - zc)
            k = (d - t_in) / d
            ro.append(bm.verts.new((x, y, z)))
            ri.append(bm.verts.new((x, y * k, zc + (z - zc) * k)))
        out.append(ro)
        inn.append(ri)
    (oa, ob), (ia, ib) = out, inn
    for i in range(n - 1):
        bm.faces.new((oa[i], ob[i], ob[i + 1], oa[i + 1]))
        bm.faces.new((ia[i + 1], ib[i + 1], ib[i], ia[i]))
        bm.faces.new((oa[i], oa[i + 1], ia[i + 1], ia[i]))
        bm.faces.new((ib[i], ib[i + 1], ob[i + 1], ob[i]))
    bm.faces.new((oa[0], ia[0], ib[0], ob[0]))
    bm.faces.new((ob[n - 1], ib[n - 1], ia[n - 1], oa[n - 1]))
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    return shade(obj, sharp)


def text(name, body, size, loc, role, rot=(math.pi / 2, 0, 0), extrude=0.0006):
    global FONT
    cu = bpy.data.curves.new(name, 'FONT')
    cu.body = body
    cu.size = size
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.extrude = extrude
    cu.resolution_u = 5
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
    return bpy.context.object


def join(objs, name, origin=None):
    """Склеить примитивы в один узел; при origin — перенести туда пивот."""
    objs = [o for o in objs if o is not None]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1:
        bpy.ops.object.join()
    obj = bpy.context.object
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    obj.name = PREFIX + name
    obj.data.name = PREFIX + name
    if origin is not None:
        origin = Vector(origin)
        obj.data.transform(Matrix.Translation(-origin))
        obj.location = origin
    return obj


def xform(obj, M):
    obj.matrix_world = M @ obj.matrix_world
    return obj


def pod_cx(k):
    return X0 + PITCH * (k + 0.5)


def vault_profile(seg=14, radius=None, apex=None, y_half=VAULT_Y):
    radius = VAULT_R if radius is None else radius
    apex = VAULT_APEX if apex is None else apex
    zc = apex - radius
    a = math.asin(min(1.0, y_half / radius))
    return [(radius * math.sin(-a + 2 * a * i / seg),
             zc + radius * math.cos(-a + 2 * a * i / seg))
            for i in range(seg + 1)]


# --- сборка: подиум ------------------------------------------------------
def build_plinth(parts):
    """Подиум: тёмное ядро + 7 светлых «башмаков» капсул с вентзазором."""
    core = [
        rrect_prism('plinth_core', W_ROW, DEPTH - 0.130, 0.050, 0.072,
                    'graphite', loc=(0.0, 0.0, 0.036), plane='XY', seg=7),
        cube('plinth_groove', (0.0, -DEPTH * 0.5 + 0.052, 0.022),
             (W_ROW - 0.10, 0.016, 0.020), 'steel', 0.003),
    ]
    parts.append(join(core, 'plinth_core'))

    shoes = []
    for k in range(BAYS):
        cx = pod_cx(k)
        # нижняя и верхняя половины башмака, между ними вентиляционная щель
        shoes.append(rrect_prism(f'shoe_lo_{k}', POD_W - 0.004, DEPTH, 0.072,
                                 0.030, 'steel',
                                 loc=(cx, 0.0, 0.015), plane='XY', seg=7))
        shoes.append(rrect_prism(f'shoe_hi_{k}', POD_W - 0.004, DEPTH, 0.072,
                                 0.028, 'steel',
                                 loc=(cx, 0.0, 0.064), plane='XY', seg=7))
        for i in range(7):
            shoes.append(cube(f'shoe_post_{k}_{i}',
                              (cx + (i - 3) * 0.118, -DEPTH * 0.5 + 0.020, 0.040),
                              (0.020, 0.020, 0.020), 'graphite', 0.002))
        # верхняя губка башмака
        shoes.append(rrect_prism(f'shoe_lip_{k}', POD_W + 0.002, DEPTH - 0.004,
                                 0.078, 0.008, 'shell',
                                 loc=(cx, 0.0, 0.082), plane='XY', seg=7))
    parts.append(join(shoes, 'pod_shoes'))

    # скруглённые плиты-основания капсул (настил кабины)
    pads = []
    for k in range(BAYS):
        pads.append(rrect_prism(f'pad_{k}', POD_W - 0.020, POD_HD * 2 - 0.020,
                                0.100, PAD_Z1 - PAD_Z0, 'interior',
                                loc=(pod_cx(k), 0.0, (PAD_Z0 + PAD_Z1) * 0.5),
                                plane='XY', seg=7))
    parts.append(join(pads, 'pod_pads'))


# --- сборка: каркас капсулы ---------------------------------------------
def build_pod_frame(parts, k):
    cx = pod_cx(k)
    objs = []
    # 4 цилиндрические стойки
    for sx in (-1, 1):
        for sy in (-1, 1):
            x = cx + sx * (POD_HW - POST_R)
            y = sy * (POD_HD - POST_R)
            objs.append(cyl(f'post_{k}_{sx:+d}{sy:+d}', (x, y, POST_Z0),
                            (x, y, POST_Z1), POST_R, 'graphite', vertices=18,
                            bev=0.003))
    # нижняя кольцевая обвязка (скруглённый план)
    base = [(cx + px, py, BASE_RING_Z)
            for px, py in rrect_points(POD_W - 0.026, POD_HD * 2 - 0.026,
                                       0.105, 7)]
    objs.append(path_tube(f'base_ring_{k}', base, RING_R, 'steel',
                          closed=True))
    # верхняя кольцевая обвязка
    top = [(cx + px, py, TOP_RING_Z)
           for px, py in rrect_points(POD_W - 0.074, POD_HD * 2 - 0.074,
                                      0.150, 7)]
    objs.append(path_tube(f'top_ring_{k}', top, TOP_RING_R, 'graphite',
                          closed=True))
    # поперечные рёбра верхней обвязки
    for sy in (-1, 1):
        objs.append(cyl(f'top_cross_{k}_{sy:+d}',
                        (cx - POD_HW + 0.02, sy * (POD_HD - 0.003), TOP_RING_Z),
                        (cx + POD_HW - 0.02, sy * (POD_HD - 0.003), TOP_RING_Z),
                        0.020, 'steel', vertices=12))
    # рама проёма (неподвижная, скруглённая)
    opening = [(cx + u, OPEN_Y, OPEN_CZ + v)
               for u, v in rrect_points(OPEN_W, OPEN_H, OPEN_R, 9, OPEN_RT)]
    objs.append(path_tube(f'opening_{k}', opening, 0.016, 'graphite',
                          closed=True))
    # рёбра свода
    prof = vault_profile(14)
    for tag, dx in (('l', -POD_HW + 0.012), ('c', 0.0), ('r', POD_HW - 0.012)):
        pts = [(cx + dx, y, z) for (y, z) in prof]
        objs.append(path_tube(f'vault_rib_{k}_{tag}', pts, RIB_R, 'graphite',
                              closed=False, res=3))
    parts.append(join(objs, f'pod_frame_{k:02d}'))


def build_pod_shell(parts, k):
    """Стекло капсулы: свод + задняя панель (прозрачные)."""
    cx = pod_cx(k)
    glass = []
    prof = vault_profile(16)
    glass.append(sweep_shell(f'vault_glass_{k}', prof,
                             cx - POD_HW + 0.008, cx + POD_HW - 0.008,
                             VAULT_T, VAULT_ZC, 'tint'))
    glass.append(rrect_prism(f'back_glass_{k}', POD_W - 0.050,
                             GLASS_Z1 - GLASS_Z0, 0.070, PART_T, 'tint',
                             loc=(cx, BACK_Y, (GLASS_Z0 + GLASS_Z1) * 0.5),
                             plane='XZ', seg=6, r_top=0.150))
    # тонкий горизонтальный импост по заднему стеклу
    glass.append(cyl(f'back_rail_{k}', (cx - POD_W * 0.5 + 0.030, BACK_Y, 1.560),
                     (cx + POD_W * 0.5 - 0.030, BACK_Y, 1.560), 0.011,
                     'graphite', vertices=10))
    parts.append(join(glass, f'pod_shell_{k:02d}'))


def build_partitions(parts):
    pans = []
    for k in range(1, BAYS):
        x = X0 + PITCH * k
        pans.append(rrect_prism(f'part_pane_{k}', POD_HD * 2 - 0.055,
                                GLASS_Z1 - GLASS_Z0, 0.055, PART_T, 'glass',
                                loc=(x, 0.0, (GLASS_Z0 + GLASS_Z1) * 0.5),
                                plane='YZ', seg=6, r_top=0.120))
        # тонкие рамы перегородки: перед и зад + верх/низ
        for sy in (-1, 1):
            pans.append(cyl(f'part_stile_{k}_{sy:+d}',
                            (x, sy * (POD_HD - 0.040), GLASS_Z0 - 0.010),
                            (x, sy * (POD_HD - 0.040), GLASS_Z1 + 0.010),
                            0.013, 'graphite', vertices=10))
        pans.append(cyl(f'part_cap_{k}', (x, -(POD_HD - 0.040), GLASS_Z1 + 0.010),
                        (x, POD_HD - 0.040, GLASS_Z1 + 0.010), 0.011,
                        'graphite', vertices=10))
        pans.append(cyl(f'part_sill_{k}', (x, -(POD_HD - 0.040), GLASS_Z0 - 0.010),
                        (x, POD_HD - 0.040, GLASS_Z0 - 0.010), 0.011,
                        'graphite', vertices=10))
    parts.append(join(pans, 'partition_frames'))

    ends = []
    for tag, x in (('l', X0 + 0.022), ('r', X1 - 0.022)):
        ends.append(rrect_prism(f'end_pane_{tag}', POD_HD * 2 - 0.030,
                                GLASS_Z1 - GLASS_Z0, 0.070, PART_T, 'glass',
                                loc=(x, 0.0, (GLASS_Z0 + GLASS_Z1) * 0.5),
                                plane='YZ', seg=6, r_top=0.160))
        ends.append(cyl(f'end_stile_{tag}_f', (x, -(POD_HD - 0.026),
                                               GLASS_Z0 - 0.012),
                        (x, -(POD_HD - 0.026), GLASS_Z1 + 0.012), 0.012,
                        'graphite', vertices=10))
        ends.append(cyl(f'end_stile_{tag}_b', (x, (POD_HD - 0.026),
                                               GLASS_Z0 - 0.012),
                        (x, (POD_HD - 0.026), GLASS_Z1 + 0.012), 0.012,
                        'graphite', vertices=10))
    parts.append(join(ends, 'end_panes'))


def build_door(parts, k, angle_deg):
    """Скруглённая стеклянная дверь; локальный X от петли, Z от низа полотна."""
    hw = DOOR_W * 0.5
    z0 = DOOR_CZ - DOOR_H * 0.5
    hz = DOOR_H * 0.5
    objs = []
    # стекло
    objs.append(rrect_prism(f'door_glass_{k}', DOOR_W - 0.030, DOOR_H - 0.030,
                            DOOR_R, DOOR_T, 'glass',
                            loc=(hw, 0.0, hz), plane='XZ', seg=9,
                            r_top=DOOR_RT - 0.010))
    # рама полотна
    ring = [(hw + u, 0.0, hz + v)
            for u, v in rrect_points(DOOR_W, DOOR_H, DOOR_R, 9, DOOR_RT)]
    objs.append(path_tube(f'door_ring_{k}', ring, 0.014, 'graphite',
                          closed=True))
    # петли
    for i, dz in enumerate((0.28, DOOR_H - 0.30)):
        objs.append(cyl(f'hinge_{k}_{i}', (0.004, 0.004, dz - 0.070),
                        (0.004, 0.004, dz + 0.070), 0.016, 'steel',
                        vertices=14, bev=0.002))
    # ручка-штанга
    hx = DOOR_W - 0.078
    objs.append(cyl(f'handle_{k}', (hx, -0.020, hz - 0.115),
                    (hx, -0.020, hz + 0.115), 0.010, 'steel', vertices=12))
    for dz in (hz - 0.100, hz + 0.100):
        objs.append(cyl(f'handle_stem_{k}_{dz:.2f}', (hx, -0.004, dz),
                        (hx, -0.021, dz), 0.0075, 'steel', vertices=10))
    # замок и накладка
    objs.append(cube(f'lock_plate_{k}', (DOOR_W - 0.042, -0.008, hz),
                     (0.026, 0.010, 0.090), 'steel', 0.002))
    objs.append(cube(f'lock_key_{k}', (DOOR_W - 0.042, -0.016, hz - 0.036),
                     (0.012, 0.010, 0.014), 'graphite', 0.0015))
    door = join(objs, f'door_{k:02d}',
                origin=(0.0, 0.0, 0.0))
    M = (Matrix.Translation((pod_cx(k) - hw, DOOR_Y, z0))
         @ Matrix.Rotation(math.radians(angle_deg), 4, 'Z'))
    xform(door, M)
    parts.append(door)


# --- лампы, номера, вентиляция ------------------------------------------
def build_lamps(parts):
    bodies, lenses = [], []
    for k in range(BAYS):
        cx = pod_cx(k)
        bodies.append(cube(f'lamp_body_{k}', (cx, -0.474, LAMP_Z),
                           (0.132, 0.036, 0.052), 'graphite', 0.008))
        bodies.append(cube(f'lamp_tab_{k}', (cx, -0.4905, LAMP_Z),
                           (0.104, 0.008, 0.030), 'steel', 0.002))
        lenses.append(cube(f'lamp_lens_{k}', (cx, -0.4945, LAMP_Z),
                           (0.076, 0.008, 0.018), 'green', 0.003))
    parts.append(join(bodies, 'occupancy_lamp_bodies'))
    parts.append(join(lenses, 'occupancy_lenses'))


def build_numbers(parts):
    plates, nums = [], []
    for k in range(BAYS):
        cx = pod_cx(k)
        plates.append(cube(f'number_plate_{k}', (cx - 0.268, -0.478, LAMP_Z),
                           (0.054, 0.010, 0.036), 'steel', 0.002))
        nums.append(text(f'number_{k}', f'{k + 1:02d}', 0.023,
                         (cx - 0.268, -0.4865, LAMP_Z), 'graphite',
                         extrude=0.0008))
    parts.append(join(plates, 'number_plates'))
    parts.append(join(nums, 'pod_numbers'))


def build_vent(parts):
    vents = []
    for k in range(BAYS):
        cx = pod_cx(k)
        vents.append(cube(f'vent_frame_{k}', (cx, POD_HD - 0.008, 1.700),
                          (0.300, 0.016, 0.066), 'graphite', 0.004))
        for i in range(4):
            vents.append(cube(f'vent_slat_{k}_{i}',
                              (cx, POD_HD + 0.004, 1.674 + i * 0.017),
                              (0.276, 0.010, 0.007), 'steel', 0.0015))
    parts.append(join(vents, 'vent_grilles'))


# --- кабельный контур ----------------------------------------------------
def build_cable(parts):
    tray = [
        cube('tray_body', (0.0, 0.474, (CABLE_Z0 + CABLE_Z1) * 0.5),
             (W_ROW - 0.16, 0.046, CABLE_Z1 - CABLE_Z0), 'graphite', 0.004),
        cube('tray_lid', (0.0, 0.474, CABLE_Z1 + 0.004),
             (W_ROW - 0.16, 0.054, 0.008), 'steel', 0.002),
    ]
    for k in range(BAYS + 1):
        x = X0 + PITCH * k
        x = min(max(x, X0 + 0.14), X1 - 0.14)
        tray.append(cube(f'tray_brk_{k}', (x, 0.478, CABLE_Z0 - 0.026),
                         (0.024, 0.040, 0.052), 'steel', 0.002))
    parts.append(join(tray, 'cable_tray'))

    xo = X0 + 0.070
    riser = [
        cube('riser_channel', (xo, 0.474, 0.930), (0.030, 0.036, 1.560),
             'graphite', 0.004),
        cube('riser_lid', (xo, 0.4905, 0.930), (0.026, 0.007, 1.520),
             'steel', 0.002),
        cube('junction_box', (xo, 0.478, 1.360), (0.110, 0.036, 0.190),
             'graphite', 0.005),
        cube('junction_lid', (xo, 0.4955, 1.360), (0.098, 0.007, 0.170),
             'steel', 0.002),
        cyl('feed_gland', (xo, 0.484, 1.240), (xo, 0.4965, 1.240), 0.018,
            'steel', vertices=14, bev=0.002),
        cube('data_plate', (xo, 0.4945, 1.040), (0.048, 0.006, 0.080),
             'steel', 0.0015),
    ]
    parts.append(join(riser, 'cable_riser'))

    bundle = [
        curve_tube('cable_bundle_a', [(xo + 0.010, 0.478, 1.700),
                                      (xo + 0.010, 0.478, 1.600),
                                      (xo + 0.010, 0.470, 1.420),
                                      (xo + 0.010, 0.468, 1.300)],
                   0.009, 'graphite', res=3),
        curve_tube('cable_bundle_b', [(xo - 0.008, 0.478, 1.640),
                                      (xo - 0.008, 0.470, 1.480),
                                      (xo - 0.008, 0.468, 1.320)],
                   0.007, 'steel', res=3),
    ]
    parts.append(join(bundle, 'cable_bundle'))


def curve_tube(name, points, radius, role, res=4):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 8
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


# --- интерьер ------------------------------------------------------------
def build_interior(parts):
    for k in range(BAYS):
        cx = pod_cx(k)
        objs = []
        # настил
        objs.append(rrect_prism(f'deck_{k}', POD_W - 0.075, POD_HD * 2 - 0.105,
                                0.070, DECK_Z1 - DECK_Z0, 'interior',
                                loc=(cx, 0.0, (DECK_Z0 + DECK_Z1) * 0.5),
                                plane='XY', seg=5))
        # нижняя задняя панель (приватность), верх прозрачен
        objs.append(rrect_prism(f'back_liner_{k}', 0.760, 0.520, 0.040, 0.014,
                                'interior',
                                loc=(cx, BACK_Y - 0.020, 0.410),
                                plane='XZ', seg=5))
        if k != 5:
            # скамья
            objs.append(rrect_prism(f'bench_{k}', 0.690, 0.330, 0.045, 0.048,
                                    'interior',
                                    loc=(cx, 0.270, 0.470), plane='XY', seg=5))
            for sx in (-1, 1):
                objs.append(cube(f'bench_brk_{k}_{sx:+d}',
                                 (cx + sx * 0.250, 0.270, 0.408),
                                 (0.030, 0.240, 0.090), 'steel', 0.003))
        # полка
        objs.append(rrect_prism(f'shelf_{k}', 0.680, 0.210, 0.030, 0.016,
                                'interior',
                                loc=(cx, 0.318, 1.245), plane='XY', seg=4))
        for sx in (-1, 1):
            objs.append(cube(f'shelf_brk_{k}_{sx:+d}',
                             (cx + sx * 0.300, 0.320, 1.212),
                             (0.020, 0.160, 0.055), 'steel', 0.002))
        # штанга с крючками
        objs.append(cyl(f'rail_{k}', (cx - 0.300, 0.300, 1.620),
                        (cx + 0.300, 0.300, 1.620), 0.011, 'steel',
                        vertices=12))
        for sx in (-1, 1):
            objs.append(cyl(f'rail_end_{k}_{sx:+d}',
                            (cx + sx * 0.305, 0.300, 1.620),
                            (cx + sx * 0.315, 0.300, 1.620), 0.018,
                            'shell', vertices=12))
        for i, hx in enumerate((-0.170, 0.0, 0.170)):
            objs.append(cube(f'hook_{k}_{i}', (cx + hx, 0.300, 1.556),
                             (0.010, 0.010, 0.115), 'steel', 0.003))
        # потолочный светильник
        objs.append(cube(f'ceil_{k}', (cx, 0.060, 1.944),
                         (0.460, 0.080, 0.026), 'graphite', 0.004))
        objs.append(cube(f'ceil_led_{k}', (cx, 0.060, 1.929),
                         (0.420, 0.052, 0.008), 'warm', 0.002))
        # щиток управления на перегородке
        objs.append(cube(f'panel_{k}', (cx + 0.320, 0.400, 1.360),
                         (0.014, 0.110, 0.080), 'graphite', 0.002))
        objs.append(cube(f'panel_led_{k}', (cx + 0.314, 0.400, 1.372),
                         (0.008, 0.070, 0.030), 'green', 0.002))
        parts.append(join(objs, f'interior_{k:02d}'))


def build():
    reset()
    parts = []
    build_plinth(parts)
    for k in range(BAYS):
        build_pod_frame(parts, k)
        build_pod_shell(parts, k)
        build_door(parts, k, {2: 16.0, 5: 58.0}.get(k, 0.0))
    build_interior(parts)
    build_partitions(parts)
    build_lamps(parts)
    build_numbers(parts)
    build_vent(parts)
    build_cable(parts)
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


def front_areas(meshes):
    """Площадь фасадных (ny<-0.6) полигонов: стекло против глухого."""
    glass, solid = 0.0, 0.0
    glass_mat = {m.name for m in bpy.data.materials
                 if m.name.split('_')[1] in ALPHA}
    for o in meshes:
        if not o.name.startswith(PREFIX):
            continue
        mw = o.matrix_world
        names = [ms.material.name if ms.material else '' for ms in o.material_slots]
        for p in o.data.polygons:
            n = (mw.to_3x3() @ p.normal).normalized()
            c = mw @ p.center
            if n.y < -0.6 and c.y < -0.30 and 0.20 < c.z < 1.88:
                a = p.area
                if names[p.material_index] in glass_mat:
                    glass += a
                else:
                    solid += a
    return glass, solid


def check():
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox([o for o in meshes if o.name.startswith(PREFIX)])
    size = mx - mn
    center = (mn + mx) * 0.5
    names = sorted(o.name for o in bpy.data.objects if o.name.startswith(PREFIX))
    tol = 0.006

    def cnt(pat):
        rx = re.compile(pat)
        return len([n for n in names if rx.search(n)])

    over = []
    for o in meshes:
        if not o.name.startswith(PREFIX):
            continue
        omn, omx = mesh_bbox([o])
        if (omn.x < X0 - 0.001 or omx.x > X1 + 0.001
                or omn.y < -DEPTH * 0.5 - 0.001 or omx.y > DEPTH * 0.5 + 0.001
                or omx.z > HEIGHT + 0.001 or omn.z < -0.001):
            over.append([o.name, [round(v, 4) for v in omn],
                         [round(v, 4) for v in omx]])

    # пересечения AABB между капсулами (разные кабины не должны врезаться)
    pods = {}
    for o in meshes:
        m = re.match(re.escape(PREFIX) + r'(?:pod_frame|pod_shell|door|interior)_(\d+)', o.name)
        if m:
            pods.setdefault(int(m.group(1)), []).append(o)
    clashes = []
    keys = sorted(pods)
    for i in range(len(keys)):
        for j in range(i + 1, len(keys)):
            a_mn, a_mx = mesh_bbox(pods[keys[i]])
            b_mn, b_mx = mesh_bbox(pods[keys[j]])
            ov = min(a_mx.x, b_mx.x) - max(a_mn.x, b_mn.x)
            ovd = min(a_mx.y, b_mx.y) - max(a_mn.y, b_mn.y)
            if ov > 0.002 and ovd > 0.002:
                clashes.append([keys[i], keys[j], round(ov, 4), round(ovd, 4)])

    glass_area, solid_area = front_areas(meshes)
    mats = sorted(bpy.data.materials, key=lambda m: m.name)
    minfo = []
    for m in mats:
        alpha = 1.0
        b = m.node_tree.nodes.get('Principled BSDF') if m.use_nodes else None
        if b is not None:
            alpha = round(b.inputs['Alpha'].default_value, 3)
        minfo.append({'name': m.name, 'alpha': alpha,
                      'blend': m.blend_method,
                      'render_method': m.surface_render_method})

    doors = [o for o in bpy.data.objects if o.name.startswith(PREFIX + 'door_')]
    open_doors = [o.name for o in doors if abs(o.rotation_euler.z) > 0.01]

    report = {
        'component': CID,
        'concept': 'ряд из 7 прозрачных округлых кабин-капсул',
        'nodes': len(names),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [6.8, 1.0, 2.1],
        'bbox_ok': bool(abs(size.x - 6.8) <= tol and abs(size.y - 1.0) <= tol
                        and abs(size.z - 2.1) <= tol),
        'floor_contact_mm': round(mn.z * 1000.0, 3),
        'floor_contact_ok': bool(abs(mn.z) < 0.0015),
        'material_count': len(mats),
        'materials': minfo,
        'bays': BAYS,
        'pods_built': cnt(r'__pod_frame_\d+$'),
        'pitch_mm': round(PITCH * 1000.0, 1),
        'pod_width_mm': round(POD_W * 1000.0, 1),
        'pod_depth_mm': round(POD_HD * 2000.0, 1),
        'glass_panels': cnt(r'__pod_shell_\d+$') * 2 + (BAYS - 1) + 2,
        'partition_panes': BAYS - 1,
        'partition_node': bool(PREFIX + 'partition_frames' in names),
        'door_count': len(doors),
        'open_doors': sorted(open_doors),
        'hinges': 2 * BAYS,
        'occupancy_lamps': BAYS if PREFIX + 'occupancy_lamp_bodies' in names else 0,
        'glass_alpha_ok': all(0.18 <= m['alpha'] <= 0.30
                              for m in minfo if m['alpha'] < 1.0)
        and len([m for m in minfo if m['alpha'] < 1.0]) == 2,
        'front_glass_area_m2': round(glass_area, 3),
        'front_opaque_area_m2': round(solid_area, 3),
        'front_glass_ratio': round(glass_area / max(glass_area + solid_area, 1e-9), 3),
        'interiors': cnt(r'__interior_\d+$'),
        'cable_parts': cnt(r'cable_|junction'),
        'pod_aabb_clashes': clashes,
        'parts': names,
        'over_bounds': over,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'triangles': sum(len(o.data.loop_triangles) for o in meshes),
    }
    report['checks_ok'] = bool(
        report['bbox_ok'] and report['floor_contact_ok']
        and 4 <= report['material_count'] <= 8
        and report['pods_built'] == BAYS and report['door_count'] == BAYS
        and report['partition_node'] and report['glass_alpha_ok']
        and report['front_glass_ratio'] >= 0.55
        and not report['bad_names'] and not over and not clashes)
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
    for look in ('AgX - Punchy', 'AgX - Medium High Contrast', 'None'):
        try:
            scene.view_settings.look = look
            break
        except TypeError:
            continue
    scene.view_settings.exposure = 0.0
    try:
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.500, 0.530, 0.575, 1.0)
    bg.inputs['Strength'].default_value = 0.30

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5
    L = max((mx - mn).x, (mx - mn).y, (mx - mn).z)

    # внутренний свет кабин — только для рендера (в GLB не попадает)
    for k in range(BAYS):
        ld = bpy.data.lights.new(f'inside_{k}', 'POINT')
        ld.energy = 18.0
        ld.color = (1.0, 0.86, 0.70)
        ld.shadow_soft_size = 0.12
        lo = bpy.data.objects.new(f'inside_{k}', ld)
        scene.collection.objects.link(lo)
        lo.location = Vector((pod_cx(k), 0.10, 1.880))

    bpy.ops.mesh.primitive_plane_add(size=L * 2.4,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.330, 0.335, 0.345, 1.0)
    nb.inputs['Roughness'].default_value = 0.95
    floor.data.materials.append(fm)

    for name, direction, energy, angle in (
            ('key', (0.55, -0.95, 1.05), 3.20, 5.0),
            ('fill', (-0.95, -0.60, 0.45), 0.55, 28.0),
            ('rim', (0.10, 1.05, 0.60), 2.40, 12.0),
            ('endfill', (-1.00, -0.45, 0.30), 0.90, 30.0)):
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(angle)
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = center + Vector(direction) * 4.0
        lo.rotation_euler = (Vector((-direction[0], -direction[1],
                                     -max(direction[2], 0.05)))
                             .to_track_quat('Z', 'Y').to_euler())

    # большой софтбокс спереди: длинные блики по стеклу читают прозрачность
    for name, loc_off, size, energy, target_z in (
            ('softbox_a', (-1.9, -3.4, 2.6), (4.2, 1.5), 110.0, 1.05),
            ('softbox_b', (2.4, -3.2, 1.2), (3.0, 1.1), 60.0, 0.95)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.shape = 'RECTANGLE'
        ld.size, ld.size_y = size
        ld.energy = energy
        ld.color = (0.88, 0.94, 1.0)
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = center + Vector(loc_off)
        look = Vector((center.x, center.y, target_z)) - lo.location
        lo.rotation_euler = look.to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized()

    def fit_dist(direction, lens, corners, margin=1.06):
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
    # крупный план: капсула с прозрачной дверью, петли, ручка, лампа, интерьер
    cc = pod_cx(2)
    close_a = Vector((cc - 0.520, -0.500, 0.070))
    close_b = Vector((cc + 0.520, 0.500, 2.100))
    close_t = (close_a + close_b) * 0.5
    c_close = box_corners(close_a - close_t, close_b - close_t)

    views = [
        ('3q', (0.62, -1.00, 0.30), center + Vector((0, 0, -0.030)), 58,
         c_main, 1.03),
        ('front', (0.010, -1.00, 0.060), center + Vector((0, 0, -0.115)), 68,
         c_main, 1.04),
        ('side', (-1.00, -0.30, 0.09), center + Vector((0, 0, -0.120)), 58,
         c_main, 1.03),
        ('closeup', (0.70, -1.00, 0.10), close_t + Vector((0, 0, -0.040)), 44,
         c_close, 1.05),
    ]
    from bpy_extras.object_utils import world_to_camera_view

    def frame(direction, target, rel_corners, lens, margin):
        """Дистанция по bbox + панорамирование, чтобы bbox стоял по центру кадра."""
        cam_data.lens = lens
        dirn = Vector(direction).normalized()
        target = Vector(target)
        corners = [target + Vector(c) for c in rel_corners]
        th = cam_data.sensor_width * 0.5 / lens
        tv = th * scene.render.resolution_y / scene.render.resolution_x
        dist = 1.0
        for _ in range(6):
            dist = fit_dist(dirn, lens, [c - target for c in corners], margin)
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
            xs, ys = [], []
            for c in corners:
                co = world_to_camera_view(scene, cam, c)
                xs.append(co.x)
                ys.append(co.y)
            cx = (min(xs) + max(xs)) * 0.5 - 0.5
            cy = (min(ys) + max(ys)) * 0.5 - 0.5
            if abs(cx) < 0.003 and abs(cy) < 0.003:
                break
            right, up, _ = cam_basis(dirn)
            target = (target + right * (cx * 2.0 * dist * th)
                      + up * (cy * 2.0 * dist * tv))
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        return dist

    outs = []
    for tag, direction, target, lens, corners, fill in views:
        dist = frame(direction, target, corners, lens, fill)
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} dist={dist:.2f} {fp}', flush=True)
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
    print('REPORT ' + json.dumps({k: v for k, v in rep.items() if k != 'parts'},
                                 ensure_ascii=False), flush=True)
    if not (rep['checks_ok'] and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
