"""Standalone builder + renderer: work_probe_rotary (WRK-PEN-02, «Ротационный зонд»).

Компактный зонд на ротационном доке: розовый корпус дока с быстросъёмным
стальным фланцем и графитовым кольцом, стальной вал на оси X, силиконовая
насадка с лёгким рельефом (5 кольцевых рёбер + 4 спиральных гребня в одной
скиновой оболочке) и скруглённым торцом. Плита-основание не используется:
док держится на стальном хомуте с короткой опорой-цапфой.

Не зависит от build_component_library.py и от других build_* скриптов.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_probe_rotary.py

Выход:
  public/models/machine-modules/components/work_probe_rotary.glb
  docs/plans/blockout/component-library/work_probe_rotary/*.png

Геометрия (Blender Z-up, метры):
  ось зонда      = X, линия y=0 z=0
  anim-пустышка  = середина вала на оси, y=z=0
  вращаются: shaft, chuck_ring, chuck_bead, sleeve (насадка + торец)
  статичны:  dock_body, dock_cap, dock_ring, flange, flange_lug_*,
             flange_slot_*, clamp_band, clamp_ear_*, clamp_bolt,
             bracket, mount_pin, strain_relief, cable, connector,
             led, led_bezel, torque_marks
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
SHOTS = PROJECT / 'docs/plans/blockout/component-library/work_probe_rotary'
CID = 'work_probe_rotary'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
X_BACK = -0.1000            # задний торец дока
X_CAP0, X_CAP1 = -0.1000, -0.0960
X_DOCK0, X_DOCK1 = -0.0960, -0.0570
DOCK_R = 0.0325
X_DRING0, X_DRING1 = -0.0570, -0.0540     # графитовое кольцо дока (шов)
DRING_R = 0.0338
X_FL0, X_FL1 = -0.0540, -0.0470           # быстросъёмный фланец (статика)
FL_R = 0.0290

X_SHAFT0, X_SHAFT1 = -0.0640, 0.0480      # вал по всей оси
SHAFT_R = 0.0085
X_CH0, X_CH1 = -0.0380, -0.0300           # графитовое кольцо-цанга (вращается)
CH_R = 0.0250

SLEEVE_X0 = -0.0290
DOME_X0 = 0.0880
X_TIP = 0.1000
SLEEVE_R = 0.0242                         # радиус у основания насадки
TIP_TAPER = 0.0026                        # лёгкая конусность к торцу
DOME_L = X_TIP - DOME_X0                  # 0.0120 — скруглённый торец
SLEEVE_R_END = SLEEVE_R - TIP_TAPER       # 0.0216 у начала скругления

RIB_X0, RIB_X1 = 0.0030, 0.0760
RIB_PITCH = 0.0152                        # 5 кольцевых рёбер
RIB_AMP = 0.0023
RIB_SHARP = 1.45                          # >1 => узкий гребень, плоская канавка
HX0, HX1 = -0.0220, 0.0830
HELIX_STARTS = 4                          # 4 захода => 90°-симметрия (pivot-тест = 0)
HELIX_TURNS = 2.0
HELIX_AMP = 0.0005

ANIM_X = 0.5 * (X_SHAFT0 + X_SHAFT1)      # ровно середина вала

PALETTE = {
    'silicone': (0.905, 0.700, 0.715),
    'blush': (0.845, 0.455, 0.505),
    'rose': (0.760, 0.300, 0.370),
    'steel': (0.705, 0.715, 0.710),
    'graphite': (0.205, 0.212, 0.225),
    'dark': (0.112, 0.118, 0.132),
    'cyan': (0.560, 0.880, 0.930),
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
    rough = {'silicone': 0.52, 'blush': 0.56, 'rose': 0.48, 'steel': 0.32,
             'graphite': 0.44, 'dark': 0.64, 'cyan': 0.26}[role]
    metal = {'steel': 0.34, 'graphite': 0.22, 'dark': 0.10}.get(role, 0.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 2.2
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


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), smooth=False):
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


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='X', segs=44, rings=10):
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


def curve_tube(name, points, radius, role, res=6):
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
    apply(obj, role, True)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = 0.014
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3.0 - 2.0 * t)


def radial(a):
    """Радиальное направление вокруг оси X: a=0 -> +Z, a=+90° -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


def base_radius(x):
    """Лёгкая конусность корпуса насадки от основания к торцу."""
    t = min(1.0, max(0.0, (x - SLEEVE_X0) / (DOME_X0 - SLEEVE_X0)))
    return SLEEVE_R - TIP_TAPER * t


def relief_radius(x, th):
    """Радиус насадки: кольцевые рёбра + спиральные гребни (одна скиновая оболочка)."""
    r = base_radius(x)
    if RIB_X0 <= x <= RIB_X1:
        t = (x - RIB_X0) / (RIB_X1 - RIB_X0)
        win = smoothstep(t / 0.06) * smoothstep((1.0 - t) / 0.06)
        bump = 0.5 * (1.0 + math.cos(math.tau * (x - RIB_X0) / RIB_PITCH))
        r += RIB_AMP * (bump ** RIB_SHARP) * win
    if HX0 <= x <= HX1:
        t = (x - HX0) / (HX1 - HX0)
        fade = smoothstep(t / 0.07) * smoothstep((1.0 - t) / 0.07)
        phase = HELIX_STARTS * (th - math.tau * HELIX_TURNS * t)
        r += HELIX_AMP * 0.5 * (1.0 + math.cos(phase)) * fade
    return r


def sleeve_skin(name, role, nt=72, n_cyl=150, n_dome=28):
    """Единая оболочка насадки: цилиндр с рельефом + скруглённый торец полюсом."""
    xs = [SLEEVE_X0 + (DOME_X0 - SLEEVE_X0) * i / n_cyl for i in range(n_cyl + 1)]
    rings_x = [(x, 1.0) for x in xs]
    for i in range(1, n_dome + 1):
        s = (i / n_dome) * 0.992
        rings_x.append((DOME_X0 + s * DOME_L, math.sqrt(max(0.0, 1.0 - s * s))))

    bm = bmesh.new()
    rings = []
    for x, scale in rings_x:
        ring = []
        for k in range(nt):
            th = math.tau * k / nt
            r = relief_radius(x, th) if scale >= 1.0 else SLEEVE_R_END * scale
            ring.append(bm.verts.new((x, math.sin(th) * r, math.cos(th) * r)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        a_, b_ = rings[i], rings[i + 1]
        for k in range(nt):
            k2 = (k + 1) % nt
            bm.faces.new((a_[k], a_[k2], b_[k2], b_[k]))
    bm.faces.new(tuple(reversed(rings[0])))          # задняя крышка (внутри цанги)
    pole = bm.verts.new((X_TIP, 0.0, 0.0))
    last = rings[-1]
    for k in range(nt):
        k2 = (k + 1) % nt
        bm.faces.new((last[k], last[k2], pole))
    return mesh_from_bm(name, bm, role, smooth=True)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- вращающаяся часть: вал / цанга / насадка ------------------------
    shaft = cyl(PREFIX + 'shaft', (X_SHAFT0, 0, 0), (X_SHAFT1, 0, 0), SHAFT_R,
                'steel', vertices=24)
    shaft_land = torus(PREFIX + 'shaft_land', (X_SHAFT1 - 0.0022, 0, 0),
                       0.0090, 0.0011, 'steel', 'X', segs=32, rings=8)
    chuck = cyl(PREFIX + 'chuck_ring', (X_CH0, 0, 0), (X_CH1, 0, 0), CH_R,
                'graphite', vertices=48, bev=0.0014)
    bead = torus(PREFIX + 'chuck_bead', (X_CH1 - 0.0014, 0, 0), 0.0248, 0.0016,
                 'graphite', 'X', segs=48, rings=10)
    sleeve = sleeve_skin(PREFIX + 'sleeve', 'silicone')
    rotating += [shaft, shaft_land, chuck, bead, sleeve]

    # ---- док: корпус, крышка, кольцо дока --------------------------------
    dock = cyl(PREFIX + 'dock_body', (X_DOCK0, 0, 0), (X_DOCK1, 0, 0), DOCK_R,
               'blush', vertices=56, bev=0.0022)
    for i, gx in enumerate((-0.0900, -0.0770)):
        torus(PREFIX + f'dock_groove_{i}', (gx, 0, 0), DOCK_R - 0.0006, 0.0012,
              'dark', 'X', segs=48, rings=6)
    cap = cyl(PREFIX + 'dock_cap', (X_CAP0, 0, 0), (X_CAP1, 0, 0), 0.0272,
              'graphite', vertices=40, bev=0.0018)
    dring = cyl(PREFIX + 'dock_ring', (X_DRING0, 0, 0), (X_DRING1, 0, 0), DRING_R,
                'graphite', vertices=56, bev=0.0016)

    # ---- быстросъёмный фланец (статичен) ---------------------------------
    flange = cyl(PREFIX + 'flange', (X_FL0, 0, 0), (X_FL1, 0, 0), FL_R,
                 'steel', vertices=48, bev=0.0016)
    for i in range(4):
        d = radial(math.radians(90.0 * i))
        cube(PREFIX + f'flange_lug_{i}',
             ((X_FL0 + X_FL1) * 0.5, d.y * FL_R, d.z * FL_R),
             (0.0062, 0.0088, 0.0088), 'steel', r=0.0012)
    for i in range(2):
        d = radial(math.radians(180.0 * i))
        cube(PREFIX + f'flange_slot_{i}',
             ((X_FL1 + 0.0004), d.y * 0.0206, d.z * 0.0206),
             (0.0010, 0.0050, 0.0050), 'dark', r=0.0004)
    torus(PREFIX + 'flange_seam', (X_FL0 + 0.0008, 0, 0), FL_R + 0.0002, 0.0014,
          'dark', 'X', segs=48, rings=8)

    # ---- опора: стальной хомут + цапфа (без плиты) -----------------------
    cyl(PREFIX + 'clamp_band', (-0.0755, 0, 0), (-0.0685, 0, 0), 0.0348,
        'steel', vertices=56, bev=0.0014)
    for tag, sy in (('a', 1.0), ('b', -1.0)):
        cube(PREFIX + f'clamp_ear_{tag}', (-0.0720, sy * 0.0345, 0.0),
             (0.0100, 0.0110, 0.0092), 'steel', r=0.0012)
        cyl(PREFIX + f'clamp_bolt_{tag}',
            (-0.0720, sy * 0.0300, 0.0), (-0.0720, sy * 0.0408, 0.0),
            0.0026, 'graphite', vertices=14)
    cube(PREFIX + 'bracket', (-0.0720, 0.0, -0.0345), (0.0150, 0.0210, 0.0230),
         'steel', r=0.0016)
    cyl(PREFIX + 'mount_socket', (-0.0720, -0.0135, -0.0452),
        (-0.0720, 0.0135, -0.0452), 0.0082, 'graphite', vertices=24, bev=0.0010)
    for tag, sy in (('a', 1.0), ('b', -1.0)):
        torus(PREFIX + f'socket_collar_{tag}', (-0.0720, sy * 0.0132, -0.0452),
              0.0085, 0.0013, 'steel', 'Y', segs=24, rings=8)
    cyl(PREFIX + 'mount_rod', (-0.0720, -0.0245, -0.0452),
        (-0.0720, 0.0245, -0.0452), 0.0038, 'steel', vertices=18)

    # ---- кабель, разъём, светодиод, метки --------------------------------
    cyl(PREFIX + 'strain_relief', (-0.0955, -0.0075, -0.0080),
        (-0.0919, -0.0098, -0.0128), 0.0055, 'graphite', vertices=20, bev=0.0011)
    curve_tube(PREFIX + 'cable',
               [(-0.0924, -0.0096, -0.0120),
                (-0.0920, -0.0142, -0.0218),
                (-0.0892, -0.0178, -0.0295),
                (-0.0852, -0.0194, -0.0338)], 0.0031, 'dark')
    cube(PREFIX + 'connector', (-0.0822, -0.0196, -0.0352),
         (0.0090, 0.0070, 0.0080), 'dark', r=0.0014)
    sphere(PREFIX + 'led', (-0.0838, 0.0, 0.0326), 0.0030, 'cyan', segs=18, rings=10)
    torus(PREFIX + 'led_bezel', (-0.0838, 0.0, 0.0334), 0.0034, 0.0009, 'steel',
          'Z', segs=20, rings=6)

    # шкала момента: три коротких графитовых насечки на теле дока
    for i in range(3):
        x = -0.0952 + i * 0.0036
        cyl(PREFIX + f'torque_mark_{i}', (x, 0.0, DOCK_R - 0.0012),
            (x, 0.0, DOCK_R + 0.0012), 0.0016, 'graphite', vertices=10)

    # ---- анимационная пустышка ровно на оси вала -------------------------
    anim = empty(PREFIX + 'anim', (ANIM_X, 0.0, 0.0))
    anim['spin_axis'] = 'X'
    anim['spin_rad_s'] = 1.6
    anim['spin_rpm_max'] = 60
    anim['stroke_m'] = 0.120
    bpy.context.view_layer.update()
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in rotating:
            o['rotating'] = False

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


def check(anim, rotating):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    # ось: центр детей должен лежать на линии y=z=0 (ось вала)
    axis_off = max(abs(k_c0.y), abs(k_c0.z))
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    sleeve = bpy.data.objects[PREFIX + 'sleeve']
    s_mn, s_mx = mesh_bbox([sleeve])
    body_d = max(s_mx.y - s_mn.y, s_mx.z - s_mn.z)
    body_len = s_mx.x - s_mn.x
    shaft = bpy.data.objects[PREFIX + 'shaft']
    sh_mn, sh_mx = mesh_bbox([shaft])
    shaft_center_x = (sh_mn.x + sh_mx.x) * 0.5

    mats = sorted({m.name for o in all_mesh for m in o.data.materials if m})
    static = sorted(o.name for o in bpy.data.objects
                    if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in kids)

    report = {
        'component': CID,
        'code': 'WRK-PEN-02',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_nodes': len(all_mesh),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.240 and size.y <= 0.100 and size.z <= 0.100),
        'length_m': round(size.x, 5),
        'length_ok': bool(0.190 <= size.x <= 0.210),
        'sleeve_diameter_m': round(body_d, 5),
        'sleeve_diameter_ok': bool(0.040 <= body_d <= 0.070),
        'sleeve_length_m': round(body_len, 5),
        'anim_name': anim.name,
        'anim_loc': [round(v, 6) for v in anim.location],
        'shaft_center_x': round(shaft_center_x, 6),
        'anim_on_shaft_axis': bool(abs(anim.location.y) < 1e-9
                                   and abs(anim.location.z) < 1e-9),
        'anim_at_shaft_center': bool(abs(anim.location.x - shaft_center_x) < 1e-6),
        'rotating_axis_offset_mm': round(axis_off * 1000, 5),
        'anim_children': sorted(o.name for o in kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.001),
        'materials': mats,
        'materials_count': len(mats),
        'static_parts': static,
        'extras': {k: anim[k] for k in anim.keys() if not k.startswith('_')},
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    report['ok'] = bool(report['bbox_ok'] and report['length_ok']
                        and report['sleeve_diameter_ok'] and report['pivot_ok']
                        and report['anim_on_shaft_axis']
                        and report['anim_at_shaft_center']
                        and len(mats) >= 4 and len(kids) >= 3)
    return report


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    bpy.context.view_layer.objects.active = next(o for o in objects if o.type == 'MESH')
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
def setup_render(floor_z):
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = -0.62
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.680, 0.684, 0.700, 1)
    bg.inputs['Strength'].default_value = 0.48

    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, floor_z))
    floor = bpy.context.object
    floor.name = 'render_floor'
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.70, 0.70, 0.71, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.1, 1.4), 1.70),
        ('fill', (-1.2, -0.8, 0.5), 0.34),
        ('rim', (0.2, 1.1, 0.9), 0.90),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(18)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()


def shot(name, direction, target, ortho_scale=None, dist=0.6, lens=85,
         res=(900, 760)):
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
        cam.location = Vector(target) + d * 1.2
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
        cam.location = Vector(target) + d * dist
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(SHOTS / f'{CID}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


def render(rep):
    SHOTS.mkdir(parents=True, exist_ok=True)
    setup_render(floor_z=rep['bbox_min'][2] - 0.006)
    tgt = (0.0, 0.0, 0.0)
    shot('3q', (1.05, -1.55, 0.72), tgt, ortho_scale=0.232, res=(920, 640))
    shot('front', (1.0, -0.16, 0.08), (0.0, 0.0, -0.004), ortho_scale=0.090,
         res=(700, 700))
    shot('side', (0.0, -1.0, 0.02), tgt, ortho_scale=0.235, res=(1000, 400))
    shot('closeup', (0.62, -0.80, 0.46), (0.042, 0.0, 0.0), dist=0.300, lens=85,
         res=(980, 760))
    shot('preview300', (1.05, -1.55, 0.72), tgt, ortho_scale=0.232,
         res=(300, 300))
    rep['renders'] = sorted(str(p.relative_to(PROJECT)) for p in SHOTS.glob('*.png'))


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    render(rep)
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['ok']:
        raise SystemExit('checks failed')


main()
