"""Standalone builder: work_probe_inflatable (WRK-PEN-03, «Надувной зонд»).

Компактный надувной зонд: жёсткий внутренний сердечник, мягкая полупрозрачная
камера с розовыми концевыми манжетами, быстросъёмная база с байонетными
усиками и рычагом, пневмотрубка с разъёмом, датчик давления с циановым LED.
Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_probe_inflatable.py

Выход:
  public/models/machine-modules/components/work_probe_inflatable.glb

Геометрия (Blender Z-up, метры):
  ось зонда      = Z, x=y=0
  anim-пустышка   = (0, 0, 0.105) — ровно центр камеры (z 0.040..0.170)
  надуваются:    chamber, cuff_lower, cuff_upper, tip_dome
  статичны:      socket, socket_lip, bayonet_lugs, collar, collar_knurl,
                 release_lever, flange, safety_valve, valve_cap, sensor_body,
                 sensor_led, pressure_port, port_barb, hose, hose_connector,
                 core, core_boss, core_tip

Анимация обхвата: scale по Y/Z узла anim (amount 0.10, speed 1.1).
Пустышка повёрнута на 90° вокруг Y, поэтому её локальные оси Y и Z совпадают
с двумя радиальными осями зонда (мировые Y и X), а локальная X — с осью
зонда. Так канал анимации остаётся буквально 'yz' (как в паспорте), но
камера надувается в обхвате и не вытягивается по длине.
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Vector, Matrix, Quaternion

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
CID = 'work_probe_inflatable'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z_SOCK0, Z_SOCK1 = 0.0000, 0.0130      # нижний стакан быстросъёма
SOCK_R = 0.0260
Z_COLL0, Z_COLL1 = 0.0130, 0.0250      # отжимная муфта
COLL_R = 0.0295
Z_FLG0, Z_FLG1 = 0.0250, 0.0305        # фланец-крышка базы
FLG_R = 0.0235

CORE_R = 0.0062                        # жёсткий сердечник Ø12.4
Z_CORE0, Z_CORE1 = 0.0280, 0.1740

Z_CH0, Z_CH1 = 0.0400, 0.1700          # мягкая камера, длина 0.130
CH_R0 = 0.0150                         # радиус у торцов (Ø0.030)
CH_BULGE = 0.0075                      # +7.5 мм в середине -> Ø0.045
CH_WALL = 0.0016
CH_CENTER = (Z_CH0 + Z_CH1) * 0.5      # 0.105 — центр камеры

CUFF_R = 0.0205
Z_CUFF0, CUFF_H = 0.0388, 0.0132
Z_CUFF1 = 0.1583
CUFF1_H = 0.0122
CUFF1_R = 0.0178

DOME_R = 0.0150
DOME_Z = 0.1705
DOME_SZ = 0.95

ANIM_AMOUNT = 0.10
ANIM_SPEED = 1.1

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'steel': (0.725, 0.729, 0.718),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.204, 0.212, 0.231),
    'blush': (0.910, 0.725, 0.749),
    'pale': (0.949, 0.843, 0.851),
    'cyan': (0.750, 0.900, 0.920),
    'hose': (0.600, 0.652, 0.700),
    'silicone': (0.880, 0.930, 0.945),
    'silicone_cap': (0.905, 0.945, 0.955),
}
# роль -> (alpha, roughness, metallic)
MATSPEC = {
    'body': (1.00, 0.58, 0.0),
    'ivory': (1.00, 0.55, 0.0),
    'steel': (1.00, 0.38, 0.55),
    'graphite': (1.00, 0.52, 0.30),
    'dark': (1.00, 0.60, 0.10),
    'blush': (1.00, 0.48, 0.0),
    'pale': (1.00, 0.55, 0.0),
    'cyan': (1.00, 0.30, 0.0),
    'hose': (1.00, 0.45, 0.05),
    'silicone': (0.28, 0.06, 0.0),
    'silicone_cap': (0.46, 0.10, 0.0),
}
MATS = {}


# --- helpers (те же, что в build_work_tickle_firm.py) ---------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role):
    if role in MATS:
        return MATS[role]
    color = PALETTE[role]
    alpha, rough, metal = MATSPEC[role]
    m = bpy.data.materials.new(f'CJ_{role}_{int(round(alpha * 100))}')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Alpha'].default_value = alpha
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.55
    if alpha < 1.0:
        # Blender 4.2 (EEVEE Next) — surface_render_method; старее — blend_method
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
        if hasattr(m, 'show_transparent_back'):
            m.show_transparent_back = True
        if hasattr(m, 'use_transparent_shadow'):
            m.use_transparent_shadow = True
        m.use_backface_culling = False
    m.diffuse_color = (*color, alpha)
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


def sphere(name, loc, radius, role, segs=24, rings=16, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=40, rings=10):
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


def bm_box(bm, center, size, rz=0.0):
    m = (Matrix.Translation(Vector(center))
         @ Matrix.Rotation(rz, 4, 'Z')
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def lathe_tube(name, z0, z1, radius_fn, wall, role, steps=18, seg=48):
    """Замкнутая оболочка-обечайка: внешняя стенка, внутренняя, торцы-кольца."""
    bm = bmesh.new()
    rings = []
    for i in range(steps + 1):
        t = i / steps
        z = z0 + (z1 - z0) * t
        ro = radius_fn(t)
        ri = max(ro - wall, 0.0010)
        out_r, in_r = [], []
        for k in range(seg):
            a = math.tau * k / seg
            ca, sa = math.cos(a), math.sin(a)
            out_r.append(bm.verts.new((ca * ro, sa * ro, z)))
            in_r.append(bm.verts.new((ca * ri, sa * ri, z)))
        rings.append((out_r, in_r))
    for i in range(steps):
        o0, i0 = rings[i]
        o1, i1 = rings[i + 1]
        for k in range(seg):
            k2 = (k + 1) % seg
            bm.faces.new((o0[k], o0[k2], o1[k2], o1[k]))
            bm.faces.new((i1[k], i1[k2], i0[k2], i0[k]))
    for (o, i_), flip in ((rings[0], False), (rings[-1], True)):
        for k in range(seg):
            k2 = (k + 1) % seg
            if flip:
                bm.faces.new((o[k2], i_[k2], i_[k], o[k]))
            else:
                bm.faces.new((o[k], i_[k], i_[k2], o[k2]))
    return mesh_from_bm(name, bm, role)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    inflating = []

    # ---- быстросъёмная база -------------------------------------------
    cyl(PREFIX + 'socket', (0, 0, Z_SOCK0), (0, 0, Z_SOCK1), SOCK_R,
        'dark', vertices=44, bev=0.0022)
    cyl(PREFIX + 'socket_lip', (0, 0, 0.0012), (0, 0, 0.0052), 0.0272,
        'steel', vertices=44, bev=0.0009)

    # байонетные усики: два уха по ±X
    bm = bmesh.new()
    for sx in (1, -1):
        bm_box(bm, (sx * 0.0280, 0.0, 0.0074), (0.0095, 0.0130, 0.0052))
    mesh_from_bm(PREFIX + 'bayonet_lugs', bm, 'steel', smooth=False)

    # отжимная муфта + накатка
    cyl(PREFIX + 'collar', (0, 0, Z_COLL0), (0, 0, Z_COLL1), COLL_R,
        'body', vertices=44, bev=0.0018)
    bm = bmesh.new()
    for k in range(24):
        a = math.tau * k / 24
        bm_box(bm, (math.cos(a) * 0.0297, math.sin(a) * 0.0297, 0.0190),
               (0.0014, 0.0036, 0.0094), rz=a)
    mesh_from_bm(PREFIX + 'collar_knurl', bm, 'steel', smooth=False)

    # рычаг быстросъёма (+X, читается в силуэте): плечо + нажимная пятка + шарнир
    bm = bmesh.new()
    bm_box(bm, (0.0385, 0.0, 0.0200), (0.0170, 0.0090, 0.0062))
    bm_box(bm, (0.0455, 0.0, 0.0194), (0.0060, 0.0130, 0.0082))
    mesh_from_bm(PREFIX + 'release_lever', bm, 'steel', smooth=False)
    cyl(PREFIX + 'lever_pivot', (0.0300, -0.0125, 0.0200), (0.0300, 0.0125, 0.0200),
        0.0048, 'dark', vertices=18, bev=0.0008)

    # фланец-крышка, герметизирует камеру
    cyl(PREFIX + 'flange', (0, 0, Z_FLG0), (0, 0, Z_FLG1), FLG_R,
        'graphite', vertices=44, bev=0.0014)

    # предохранительный клапан (-X)
    cyl(PREFIX + 'safety_valve', (-0.0170, 0, 0.0278), (-0.0320, 0, 0.0278),
        0.0042, 'graphite', vertices=18, bev=0.0008)
    cyl(PREFIX + 'valve_cap', (-0.0336, 0, 0.0278), (-0.0318, 0, 0.0278),
        0.0056, 'steel', vertices=20, bev=0.0006)

    # датчик давления + циановый LED (+Y)
    cube(PREFIX + 'sensor_body', (0.0, 0.0270, 0.0216),
         (0.0168, 0.0130, 0.0136), 'dark', r=0.0016)
    sphere(PREFIX + 'sensor_led', (0.0034, 0.0337, 0.0243),
           0.0021, 'cyan', segs=16, rings=10)

    # пневмопорт (-Y) + барб + трубка + разъём
    cyl(PREFIX + 'pressure_port', (0, -0.0220, 0.0288), (0, -0.0335, 0.0288),
        0.0048, 'steel', vertices=20, bev=0.0008)
    torus(PREFIX + 'port_barb', (0, -0.0318, 0.0288), 0.0053, 0.0010,
          'steel', 'Y')
    curve_tube(PREFIX + 'hose',
               [(0.0, -0.0310, 0.0288),
                (0.0, -0.0388, 0.0248),
                (0.0, -0.0402, 0.0135),
                (0.0, -0.0395, 0.0082)], 0.0030, 'hose')
    cube(PREFIX + 'hose_connector', (0.0, -0.0395, 0.0050),
         (0.0105, 0.0095, 0.0092), 'graphite', r=0.0015)

    # ---- жёсткий сердечник (статичен, виден сквозь камеру) -----------
    cyl(PREFIX + 'core', (0, 0, Z_CORE0), (0, 0, Z_CORE1), CORE_R,
        'steel', vertices=28)
    cyl(PREFIX + 'core_boss', (0, 0, 0.0268), (0, 0, 0.0406), 0.0098,
        'graphite', vertices=32, bev=0.0012)
    sphere(PREFIX + 'core_tip', (0, 0, 0.1690), 0.0046, 'steel',
           segs=20, rings=12)

    # ---- мягкая камера (надувается) ------------------------------------
    def profile(t):
        return CH_R0 + CH_BULGE * math.sin(math.pi * t) ** 0.85

    chamber = lathe_tube(PREFIX + 'chamber', Z_CH0, Z_CH1, profile,
                         CH_WALL, 'silicone', steps=20, seg=48)
    cuff_lo = cyl(PREFIX + 'cuff_lower', (0, 0, Z_CUFF0),
                  (0, 0, Z_CUFF0 + CUFF_H), CUFF_R, 'blush',
                  vertices=44, bev=0.0028)
    cuff_hi = cyl(PREFIX + 'cuff_upper', (0, 0, Z_CUFF1),
                  (0, 0, Z_CUFF1 + CUFF1_H), CUFF1_R, 'blush',
                  vertices=44, bev=0.0028)
    dome = sphere(PREFIX + 'tip_dome', (0, 0, DOME_Z), DOME_R, 'silicone_cap',
                  segs=32, rings=20, scale=(1.0, 1.0, DOME_SZ))
    inflating += [chamber, cuff_lo, cuff_hi, dome]

    # ---- анимационная пустышка в центре камеры -------------------------
    # поворот на 90° вокруг Y: локальные Y/Z = радиальные оси (мир Y/X),
    # локальная X = ось зонда. Канал scale 'yz' -> чистый обхват.
    anim = empty(PREFIX + 'anim', (0.0, 0.0, CH_CENTER))
    anim.rotation_mode = 'QUATERNION'
    anim.rotation_quaternion = Quaternion((0.0, 1.0, 0.0), math.radians(90))
    bpy.context.view_layer.update()

    for o in inflating:
        parent(o, anim)
        o['inflates'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in inflating:
            o['inflates'] = False

    bpy.context.view_layer.update()
    return anim, inflating


# --- анимация ------------------------------------------------------------
def animate(anim):
    sc = bpy.context.scene
    sc.render.fps = 30
    sc.frame_start, sc.frame_end = 1, 61
    sc.frame_set(1)

    peak = 1.0 + ANIM_AMOUNT
    # 7 отсчётов полуволны: линейная скорость на старте -> мягкий вдох
    keys = [(1, 1.0), (11, 1.0 + 0.42 * ANIM_AMOUNT), (21, 1.0 + 0.79 * ANIM_AMOUNT),
            (31, peak), (41, 1.0 + 0.79 * ANIM_AMOUNT),
            (51, 1.0 + 0.42 * ANIM_AMOUNT), (61, 1.0)]
    anim.scale = (1.0, 1.0, 1.0)
    anim.keyframe_insert('scale', frame=1)
    for f, s in keys:
        anim.scale = (1.0, s, s)
        anim.keyframe_insert('scale', frame=f)
    anim.scale = (1.0, 1.0, 1.0)

    ad = anim.animation_data
    if ad and ad.action:
        ad.action.name = CID + '__inflate'
        for fc in ad.action.fcurves:
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
            fc.update()

    anim['motion_type'] = 'scale'
    anim['motion_axis'] = 'yz'
    anim['motion_amount'] = ANIM_AMOUNT
    anim['motion_speed'] = ANIM_SPEED
    anim['motion_space'] = 'node-local; Y/Z = radial (probe axis = local X)'
    anim['inflates'] = True
    sc.frame_set(1)


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


def check(anim, inflating):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx, nverts = stats(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    # --- scale-тест: камера до/после надува ---
    ch = bpy.data.objects[PREFIX + 'chamber']
    c_mn, c_mx, _ = stats([ch])
    c_size0 = c_mx - c_mn
    c_ctr0 = (c_mn + c_mx) * 0.5

    kids = list(anim.children)
    k_mn, k_mx, _ = stats(kids)
    k_ctr0 = (k_mn + k_mx) * 0.5

    anim.scale = (1.0, 1.0 + ANIM_AMOUNT, 1.0 + ANIM_AMOUNT)
    bpy.context.view_layer.update()
    c_mn2, c_mx2, _ = stats([ch])
    c_size1 = c_mx2 - c_mn2
    c_ctr1 = (c_mn2 + c_mx2) * 0.5
    k_mn2, k_mx2, _ = stats(kids)
    k_ctr1 = (k_mn2 + k_mx2) * 0.5
    anim.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()

    growth = [c_size1.x / max(c_size0.x, 1e-9), c_size1.y / max(c_size0.y, 1e-9),
              c_size1.z / max(c_size0.z, 1e-9)]
    chamber_center_shift = (c_ctr1 - c_ctr0).length
    subtree_center_shift = (k_ctr1 - k_ctr0).length
    pivot_offset = math.hypot(c_ctr0.x - anim.location.x, c_ctr0.y - anim.location.y)
    pivot_z = abs(c_ctr0.z - anim.location.z)

    diam_rest = c_size0.x
    diam_full = c_size1.x

    report = {
        'component': CID,
        'code': 'WRK-PEN-03',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'meshes': len(meshes),
        'verts': nverts,
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok_0.10x0.10x0.22': bool(size.x <= 0.10 and size.y <= 0.10
                                       and size.z <= 0.22),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_extras': {k: anim[k] for k in anim.keys() if k != '_RNA_UI'},
        'anim_children': sorted(o.name for o in kids),
        'static_meshes': sorted(o.name for o in meshes if o not in kids),
        'chamber_diam_rest': round(diam_rest, 5),
        'chamber_diam_inflated': round(diam_full, 5),
        'chamber_size_rest': [round(v, 5) for v in c_size0],
        'chamber_size_inflated': [round(v, 5) for v in c_size1],
        'growth_xyz': [round(g, 4) for g in growth],
        'growth_ok_radial_only': bool(abs(growth[0] - 1.10) < 0.01
                                      and abs(growth[1] - 1.10) < 0.01
                                      and abs(growth[2] - 1.0) < 0.005),
        'chamber_center_shift_mm': round(chamber_center_shift * 1000, 4),
        'subtree_center_shift_mm': round(subtree_center_shift * 1000, 4),
        'pivot_axis_offset_mm': round(pivot_offset * 1000, 4),
        'pivot_z_offset_mm': round(pivot_z * 1000, 4),
        'pivot_ok_lt_1mm': bool(chamber_center_shift < 0.001
                                and subtree_center_shift < 0.001
                                and pivot_offset < 0.001 and pivot_z < 0.001),
        'materials': sorted({m.name for o in meshes for m in o.data.materials if m}),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'action': (anim.animation_data.action.name
                   if anim.animation_data and anim.animation_data.action else None),
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
        export_animations=True, export_frame_range=True,
        export_animation_mode='ACTIONS', export_optimize_animation_size=False,
    )
    if not path.is_file() or path.stat().st_size < 10240:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    anim, inflating = build()
    animate(anim)
    rep = check(anim, inflating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    fails = []
    if not rep['bbox_ok_0.10x0.10x0.22']:
        fails.append('bbox')
    if not rep['pivot_ok_lt_1mm']:
        fails.append('pivot')
    if not rep['growth_ok_radial_only']:
        fails.append('growth')
    if len(rep['materials']) < 4:
        fails.append('materials')
    if len(anim.children) < 2:
        fails.append('children')
    if fails:
        raise SystemExit('checks failed: ' + ','.join(fails))


main()
