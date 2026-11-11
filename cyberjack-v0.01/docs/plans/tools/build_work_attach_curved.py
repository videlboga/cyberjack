"""Standalone builder: work_attach_curved (WRK-ATT-07, «Изогнутая насадка»).

Сменный силиконовый наконечник с плавным изгибом корпуса (banana/angulated,
22° у основания), rounded tip, посадочная гильза-цанга, стальное
быстросъёмное кольцо с флажком, видимый внутренний сердечник с фланцем,
графитовая метка угла и бирюзовая метка размера. Без опорной плиты.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_curved.py

Выход:
  public/models/machine-modules/components/work_attach_curved.glb

Геометрия (Blender Z-up, метры):
  ось посадки  = X, линия y=0, z=Z0 (насадка лежит на полу, Z0 = R_BASE + 1 мм)
  изгиб        = 22° в плоскости XZ (вверх)
  anim-пустышка = (X_PIVOT, 0, Z0) — на продольной оси, в основании головки
  вращаются: core, core_flange, body, tip_band, seam, gate
  статичны:  shank, grip, release_ring, release_tab, collar, size_band,
             collar_key, angle_mark

Спин: X, 0.9 рад/с (демо) — вращается только головка/наконечник,
гильза и кольцо быстросъёма статичны.
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
CID = 'work_attach_curved'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
X_BACK = -0.0745          # торец посадочного хвостовика
X_RING0, X_RING1 = -0.0640, -0.0560     # быстросъёмное кольцо
X_COLL0, X_COLL1 = -0.0560, -0.0455     # посадочная гильза-цанга
X_FLANGE0, X_FLANGE1 = -0.0453, -0.0420  # фланец сердечника (виден в зазоре)
X_REAR = -0.0378          # задний торец силиконового тела
X_PIVOT = -0.0440         # ось спина: основание головки, на продольной оси

L1 = 0.0500               # прямой участок тела от торца до начала изгиба
ARC_R = 0.0700            # радиус гиба
THETA = math.radians(22.0)          # полный угол изгиба
L_ARC = ARC_R * THETA
L3 = 0.0300               # прямой участок за гибом (шейка)
L_TOTAL = L1 + L_ARC + L3           # длина осевой линии тела до носка
DOME = 0.0092             # длина скругления носка

R_BASE = 0.0195           # Ø39 в основании (паспорт Ø20–50)
R_TIP = 0.0105            # Ø21 перед скруглением носка
Z0 = R_BASE + 0.0010      # ось над полом
SPIN_SPEED = 0.9
SEGMENTS = 64

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'steel': (0.725, 0.729, 0.718),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.204, 0.212, 0.231),
    'blush': (0.910, 0.725, 0.749),
    'pale': (0.949, 0.843, 0.851),
    'cyan': (0.470, 0.830, 0.880),
    'red': (0.720, 0.070, 0.060),
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
    if role in ('steel', 'graphite'):
        bsdf.inputs['Roughness'].default_value = 0.38
        bsdf.inputs['Metallic'].default_value = 0.62
    elif role in ('blush', 'pale'):
        # силикон Shore 20A: матовая, чуть просвечивающая поверхность
        bsdf.inputs['Roughness'].default_value = 0.36
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Specular IOR Level'].default_value = 0.48
    else:
        bsdf.inputs['Roughness'].default_value = 0.55
        bsdf.inputs['Metallic'].default_value = 0.0
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.16
    m.diffuse_color = (*color, 1.0)
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
    return obj


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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, smooth)
    select_only(obj)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(38))
    except Exception:
        if smooth:
            for p in obj.data.polygons:
                p.use_smooth = True
    return obj


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def lerp(a, b, t):
    return a + (b - a) * t


# --- осевая линия с изгибом ---------------------------------------------
def cl(s):
    """Точка и касательная осевой линии на дуговой длине s от заднего торца.

    s < 0 — продолжение назад по оси посадки (гильза/кольцо),
    0..L1 — прямая, L1..L1+L_ARC — гиб радиусом ARC_R на угол THETA,
    далее — прямая шейка до носка.
    """
    if s <= L1:
        return Vector((X_REAR + s, 0.0, Z0)), Vector((1.0, 0.0, 0.0))
    a = min((s - L1) / ARC_R, THETA)
    o = Vector((X_REAR + L1, 0.0, Z0 + ARC_R))
    p = o + Vector((math.sin(a) * ARC_R, 0.0, -math.cos(a) * ARC_R))
    t = Vector((math.cos(a), 0.0, math.sin(a)))
    if s > L1 + L_ARC:
        p = p + t * (s - L1 - L_ARC)
    return p, t


def frame(s):
    """Радиальный базис сечения: U = +Y, V = касательная x Y (в плоскости XZ)."""
    p, t = cl(s)
    u = Vector((0.0, 1.0, 0.0))
    v = t.cross(u).normalized()
    return p, t, u, v


def r_body(s):
    """Радиус силиконового тела вдоль осевой линии (мягкое брюшко, сужение)."""
    t = max(0.0, min(1.0, s / L_TOTAL))
    r = R_TIP + (R_BASE - R_TIP) * (1.0 - t) ** 1.20
    r += 0.00075 * math.sin(math.pi * min(1.0, t * 1.18))   # лёгкое брюшко
    return r


def sweep_xz(name, profile, role, segments=SEGMENTS, smooth=True):
    """Тело вращения вокруг изогнутой осевой линии; r=0 -> полюс."""
    bm = bmesh.new()
    rings = []
    for (s, r) in profile:
        p, _t, u, v = frame(s)
        if r <= 1e-6:
            rings.append([bm.verts.new(p)])
            continue
        ring = []
        for i in range(segments):
            a = math.tau * i / segments
            ring.append(bm.verts.new(p + u * (math.sin(a) * r)
                                     + v * (math.cos(a) * r)))
        rings.append(ring)

    def bridge(a, b):
        if len(a) == 1 and len(b) > 1:
            for i in range(len(b)):
                bm.faces.new((a[0], b[i], b[(i + 1) % len(b)]))
        elif len(b) == 1 and len(a) > 1:
            for i in range(len(a)):
                bm.faces.new((a[i], a[(i + 1) % len(a)], b[0]))
        elif len(a) == len(b):
            n = len(a)
            for i in range(n):
                j = (i + 1) % n
                bm.faces.new((a[i], a[j], b[j], b[i]))

    for i in range(len(rings) - 1):
        bridge(rings[i], rings[i + 1])
    return mesh_from_bm(name, bm, role, smooth)


def sweep_bar(name, s0, s1, ang, half_ang, height, role, rfun,
              steps=26, sink=0.0004):
    """Продольный валик/метка, лежащая на изогнутой поверхности (замкнутый)."""
    bm = bmesh.new()
    secs = []
    for i in range(steps + 1):
        s = s0 + (s1 - s0) * i / steps
        p, _t, u, v = frame(s)
        rb = rfun(s) - sink
        rt = rfun(s) + height
        quad = []
        for (da, r) in ((-half_ang, rb), (-half_ang, rt),
                        (half_ang, rt), (half_ang, rb)):
            a = ang + da
            quad.append(bm.verts.new(p + u * (math.sin(a) * r)
                                     + v * (math.cos(a) * r)))
        secs.append(quad)
    for i in range(steps):
        a_, b_ = secs[i], secs[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((a_[k], a_[k2], b_[k2], b_[k]))
    bm.faces.new(secs[0])
    bm.faces.new(tuple(reversed(secs[-1])))
    return mesh_from_bm(name, bm, role, True)


def sweep_ring(name, s0, s1, height, role, rfun, segments=SEGMENTS,
               sink=0.0006):
    """Замкнутое кольцо-манжета по всей окружности изогнутого тела."""
    bm = bmesh.new()
    rows = []
    for s in (s0, s1):
        p, _t, u, v = frame(s)
        inner, outer = [], []
        for i in range(segments):
            a = math.tau * i / segments
            d = u * math.sin(a) + v * math.cos(a)
            inner.append(bm.verts.new(p + d * (rfun(s) - sink)))
            outer.append(bm.verts.new(p + d * (rfun(s) + height)))
        rows.append((inner, outer))
    (i0, o0), (i1, o1) = rows
    n = segments
    for k in range(n):
        k2 = (k + 1) % n
        bm.faces.new((o0[k], o0[k2], o1[k2], o1[k]))     # наружная лента
        bm.faces.new((i0[k2], i0[k], i1[k], i1[k2]))     # внутренняя
        bm.faces.new((o0[k], i0[k], i0[k2], o0[k2]))     # торец s0
        bm.faces.new((o1[k2], i1[k2], i1[k], o1[k]))     # торец s1
    return mesh_from_bm(name, bm, role, True)


def body_profile():
    """Профиль силиконового тела вдоль осевой линии: торец -> носок -> купол."""
    p = [(-0.0022, 0.0), (-0.0018, 0.0062), (-0.0009, 0.0106),
         (0.0, 0.0130), (0.0016, 0.0152), (0.0042, 0.0180),
         (0.0078, R_BASE)]
    n = 34
    for i in range(1, n + 1):
        s = 0.0078 + (L_TOTAL - 0.0078) * i / n
        p.append((s, r_body(s)))
    rn = r_body(L_TOTAL)
    for i in range(1, 15):
        u = i / 14.0
        p.append((L_TOTAL + DOME * u, rn * (1.0 - u ** 2.7) ** 0.60
                  if u < 1.0 else 0.0))
    return p


def collar_r(x):
    """Радиус посадочной гильзы-цанги (конус)."""
    u = max(0.0, min(1.0, (x - X_COLL0) / (X_COLL1 - X_COLL0)))
    return lerp(0.0192, 0.0156, u)


def collar_r_s(s):
    return collar_r(X_REAR + s)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ================= посадочный узел (статичен) ======================
    cyl(PREFIX + 'shank', (X_BACK, 0, Z0), (X_RING0, 0, Z0),
        0.0132, 'steel', vertices=40, bev=0.0018)
    cyl(PREFIX + 'grip', (-0.0740, 0, Z0), (-0.0678, 0, Z0), 0.0139,
        'graphite', vertices=40, bev=0.0008)

    # стальное быстросъёмное кольцо + флажок-защёлка
    cyl(PREFIX + 'release_ring', (X_RING0, 0, Z0), (X_RING1, 0, Z0),
        0.0197, 'steel', vertices=48, bev=0.0016)
    cube(PREFIX + 'release_tab', (-0.0600, 0.0, Z0 + 0.0199),
         (0.0106, 0.0112, 0.0072), 'graphite', r=0.0018)

    # посадочная гильза-цанга, метка размера, метка угла
    cyl(PREFIX + 'collar', (X_COLL0, 0, Z0), (X_COLL1, 0, Z0),
        0.0192, 'steel', vertices=48, r2=0.0156, bev=0.0010)
    # стальной буртик на торце цанги — упирается в силиконовую манжету
    torus_lip = cyl(PREFIX + 'collar_lip', (X_COLL1 - 0.0012, 0, Z0),
                    (X_COLL1 + 0.0006, 0, Z0), 0.0161, 'steel', vertices=48,
                    bev=0.0006)
    cyl(PREFIX + 'size_band', (-0.0542, 0, Z0), (-0.0514, 0, Z0),
        0.0191, 'cyan', vertices=48, r2=0.0184, bev=0.0005)
    # шпоночный гребень цанги (только одна ориентация посадки)
    s_key0, s_key1 = X_COLL0 + 0.0018 - X_REAR, X_COLL1 - 0.0012 - X_REAR
    sweep_bar(PREFIX + 'collar_key', s_key0, s_key1, math.pi, math.radians(4.0),
              0.0009, 'steel', collar_r_s, steps=10, sink=0.0004)
    # графитовая метка угла 22° — сектор на верху гильзы, в сторону изгиба
    sweep_bar(PREFIX + 'angle_mark', s_key0, s_key1, 0.0, math.radians(7.0),
              0.0005, 'graphite', collar_r_s, steps=10, sink=0.0004)

    # ================= вращающаяся головка ============================
    core = cyl(PREFIX + 'core', (X_FLANGE0, 0, Z0), (0.0160, 0, Z0),
               0.0088, 'steel', vertices=32)
    flange = cyl(PREFIX + 'core_flange', (X_FLANGE0, 0, Z0),
                 (X_FLANGE1, 0, Z0), 0.0148, 'steel', vertices=40, bev=0.0010)

    body = sweep_xz(PREFIX + 'body', body_profile(), 'blush')

    # палевая манжета у носка + литьевой шов по верху (вращаются с телом)
    s_band = L_TOTAL - 0.0105
    tip_band = sweep_ring(PREFIX + 'tip_band', s_band, s_band + 0.0050,
                           0.00055, 'pale', r_body, sink=0.0007)
    seam = sweep_bar(PREFIX + 'seam', 0.0120, L_TOTAL - 0.0035, 0.0,
                     math.radians(3.2), 0.00032, 'pale', r_body, steps=44,
                     sink=0.0005)
    # литниковый остаток на заднем торце тела
    gate = cyl(PREFIX + 'gate', (X_REAR + 0.0012, 0.0104, Z0),
               (X_REAR - 0.0026, 0.0104, Z0), 0.0013, 'pale', vertices=16,
               r2=0.0009, bev=0.0002)

    rotating += [core, flange, body, tip_band, seam, gate]

    # ================= анимационная пустышка ===========================
    anim = empty(PREFIX + 'anim', (X_PIVOT, 0.0, Z0))
    bpy.context.view_layer.update()
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in rotating:
            o['rotating'] = False
    anim['spin_axis'] = 'x'
    anim['spin_speed'] = SPIN_SPEED

    bpy.context.view_layer.update()
    return anim, rotating


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


def axis_keys(objects):
    """Инвариант вращения вокруг X-линии: (x, расстояние до оси y=0,z=Z0)."""
    keys = []
    for o in objects:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        for v in o.data.vertices:
            p = mw @ v.co
            keys.append((round(p.x, 7), round(math.hypot(p.y, p.z - Z0), 7)))
    keys.sort()
    return keys


def check(anim, rotating):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    kids = list(anim.children)

    # --- pivot: инвариантность радиусов относительно оси спина ---
    k0 = axis_keys(kids)
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    k1 = axis_keys(kids)
    pivot_shift = max(abs(a[1] - b[1]) for a, b in zip(k0, k1)) if k0 else 0.0
    x_shift = max(abs(a[0] - b[0]) for a, b in zip(k0, k1)) if k0 else 0.0
    b_mn, b_mx = mesh_bbox(kids)
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    # --- угол изгиба на носке ---
    _p, t_tip = cl(L_TOTAL)
    bend_deg = math.degrees(math.atan2(t_tip.z, t_tip.x))

    body = bpy.data.objects[PREFIX + 'body']

    # диаметр тела — расстояние до МЕСТНОЙ осевой линии (а не до оси посадки)
    samples = [cl(-0.006 + (L_TOTAL + DOME + 0.006) * i / 500.0)[0]
               for i in range(501)]
    r_max = 0.0
    for v in body.data.vertices:
        p = body.matrix_world @ v.co
        r_max = max(r_max, min((p - q).length for q in samples))
    tip_off = math.hypot(*(cl(L_TOTAL)[0] - Vector((0, 0, Z0))).yz)

    tri = sum(len(o.data.polygons) for o in all_mesh)
    verts = sum(len(o.data.vertices) for o in all_mesh)

    rep = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_objects': len(all_mesh),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'length_x_mm': round(size.x * 1000, 2),
        'diameter_max_mm': round(max(size.y, size.z) * 1000, 2),
        'body_diameter_max_mm': round(2 * r_max * 1000, 2),
        'height_mm': round(size.z * 1000, 2),
        'bbox_ok': bool(0.080 <= size.x <= 0.180
                        and 0.020 <= 2 * r_max <= 0.050
                        and mn.z > -0.0005),
        'bend_deg': round(bend_deg, 2),
        'bend_ok': bool(15.0 <= bend_deg <= 25.0),
        'tip_runout_mm': round(tip_off * 1000, 2),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_on_axis': bool(abs(anim.location.y) < 1e-9
                             and abs(anim.location.z - Z0) < 1e-9),
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'kids_bbox_center_rot90': [round(v, 5) for v in ((b_mn + b_mx) * 0.5)],
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_shift_x_m': round(x_shift, 9),
        'pivot_ok': bool(pivot_shift < 0.0002 and x_shift < 1e-6),
        'static_out': sorted(o.name for o in bpy.data.objects
                             if o.name.startswith(PREFIX)
                             and o.type == 'MESH' and o not in kids),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'verts': verts,
        'faces': tri,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    return rep


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
        raise RuntimeError(f'export too small: {path} ({path.stat().st_size} B)')
    return path


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['anim_on_axis']
            and rep['bend_ok'] and rep['material_count'] >= 4
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
