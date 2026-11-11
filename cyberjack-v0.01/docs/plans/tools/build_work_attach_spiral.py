"""Standalone builder + renderer: work_attach_spiral (WRK-ATT-03, «Спиральная насадка»).

Сменный силиконовый наконечник (Shore 25A) с объёмной двухзаходной
спиральной навивкой-лентой, скруглённым торцом, посадочной гильзой-цангой,
быстросъёмным стальным кольцом с байонетными выступами и открытым стальным
сердечником в зазоре. Плиты-основания нет.

Не зависит от build_component_library.py и от других build_* скриптов.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_spiral.py

Выход:
  public/models/machine-modules/components/work_attach_spiral.glb
  docs/plans/blockout/component-library/work_attach_spiral/*.png

Геометрия (Blender Z-up, метры):
  ось насадки     = X, линия y=0 z=0
  anim-пустышка   = основание головки на оси (HEAD_X0, 0, 0)
  вращаются: core, seat, head, ribs_a, ribs_b
  статичны:  sleeve, release_collar, knurl, release_ring, size_band,
             size_dot, collet, collar, collar_lip
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
SHOTS = PROJECT / 'docs/plans/blockout/component-library/work_attach_spiral'
CID = 'work_attach_spiral'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
X_SL0, X_SL1 = -0.0800, -0.0560       # посадочная гильза (статика)
SL_R = 0.0180
X_COL0, X_COL1 = -0.0560, -0.0490     # цанга (статика)
COL_R0, COL_R1 = 0.0190, 0.0173
X_FL0, X_FL1 = -0.0490, -0.0450       # фланец-упор (статика)
FL_R = 0.0204

X_CORE0, X_CORE1 = -0.0505, -0.0345   # стальной сердечник (вращается)
CORE_R = 0.0064
X_SEAT0, X_SEAT1 = -0.0400, -0.0355   # графитовая посадка силикона (вращается)
SEAT_R = 0.0174

HEAD_X0, HEAD_X1 = -0.0355, 0.0620    # силиконовая головка (вращается)
HEAD_R = 0.0165                       # цилиндрическая часть под навивкой
X_SHOULDER = 0.0450                   # начало скругления к торцу
TIP_R = 0.0125                        # радиус скруглённого торца
NOSE_ARC = 12

RIB_X0, RIB_X1 = -0.0270, 0.0500      # зона навивки
RIB_STARTS = 2                        # двухзаходная навивка
RIB_PITCH = 0.0310                    # шаг навивки
RIB_H = 0.0052                        # высота ленты (радиально)
RIB_W = 0.0062                        # полуширина ленты (по оси)
RIB_EMBED = 0.0022                    # утопление ленты в тело

SPIN_SPEED = 1.1                      # рад/с, ось X

PALETTE = {
    'silicone': (0.820, 0.500, 0.570),       # розовый силикон тела
    'silicone_rib': (0.700, 0.282, 0.362),   # насыщенная лента навивки
    'steel': (0.725, 0.729, 0.718),
    'graphite': (0.290, 0.300, 0.312),
    'ivory': (0.960, 0.952, 0.935),
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
        bsdf.inputs['Roughness'].default_value = 0.36 if role == 'steel' else 0.55
        bsdf.inputs['Metallic'].default_value = 0.62 if role == 'steel' else 0.22
    else:
        bsdf.inputs['Roughness'].default_value = 0.40
        bsdf.inputs['Metallic'].default_value = 0.0
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


def torus(name, loc, major, minor, role, axis='Z', segs=48, rings=12):
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
    e.empty_display_size = 0.012
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def smoothstep(a, b, x):
    if b <= a:
        return 1.0 if x >= b else 0.0
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3.0 - 2.0 * t)


def lathe_x(name, profile, role, segs=64, smooth=True):
    """Тело вращения вокруг оси X. profile: [(x, r), ...]; r=0 -> вершина."""
    bm = bmesh.new()
    rings = []
    for x, r in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((x, 0.0, 0.0))])
            continue
        rings.append([bm.verts.new((x, math.sin(math.tau * k / segs) * r,
                                    math.cos(math.tau * k / segs) * r))
                      for k in range(segs)])
    for i in range(len(rings) - 1):
        a_, b_ = rings[i], rings[i + 1]
        if len(a_) == 1:
            for k in range(segs):
                bm.faces.new((a_[0], b_[k], b_[(k + 1) % segs]))
        elif len(b_) == 1:
            for k in range(segs):
                bm.faces.new((a_[k], a_[(k + 1) % segs], b_[0]))
        else:
            for k in range(segs):
                bm.faces.new((a_[k], a_[(k + 1) % segs],
                              b_[(k + 1) % segs], b_[k]))
    if len(rings[0]) > 1:
        bm.faces.new(tuple(reversed(rings[0])))
    return mesh_from_bm(name, bm, role, smooth)


def head_r_at(x):
    """Цилиндр под навивкой + плавный переход к скруглённому торцу."""
    if x <= X_SHOULDER:
        return HEAD_R
    s = min(1.0, (x - X_SHOULDER) / (HEAD_X1 - X_SHOULDER))
    return HEAD_R + (TIP_R - HEAD_R) * smoothstep(0.0, 1.0, s)


def spiral_ribbon(name, phase, role, segs=16, step=0.0011,
                  fade=0.020, sink=0.0058):
    """Спиральная лента постоянного сечения: эллипс в плоскости,
    перпендикулярной пути, с радиальной осью."""
    n = max(12, int((RIB_X1 - RIB_X0) / step))
    pts = []
    for i in range(n + 1):
        u = i / n
        x = RIB_X0 + (RIB_X1 - RIB_X0) * u
        th = phase + math.tau * (x - RIB_X0) / RIB_PITCH
        r = head_r_at(x)
        f = smoothstep(0.0, fade, x - RIB_X0) * smoothstep(0.0, fade, RIB_X1 - x)
        off = RIB_EMBED * f - sink * (1.0 - f) ** 1.6
        d = Vector((0.0, math.sin(th), math.cos(th)))
        pts.append((Vector((x, 0.0, 0.0)) + d * (r + off), d, f))

    bm = bmesh.new()
    rings = []
    for i, (c, d, f) in enumerate(pts):
        if i == 0:
            t = pts[1][0] - pts[0][0]
        elif i == n:
            t = pts[n][0] - pts[n - 1][0]
        else:
            t = pts[i + 1][0] - pts[i - 1][0]
        t.normalize()
        dperp = (d - t * d.dot(t))
        if dperp.length < 1e-7:
            dperp = Vector((0.0, 1.0, 0.0))
        dperp.normalize()
        lat = t.cross(dperp).normalized()
        hh = RIB_H * (0.45 + 0.55 * f)
        ww = RIB_W * (0.45 + 0.55 * f)
        rings.append([bm.verts.new(c + dperp * (math.cos(a) * hh)
                                   + lat * (math.sin(a) * ww))
                      for a in [math.tau * k / segs for k in range(segs)]])
    for i in range(n):
        for k in range(segs):
            bm.faces.new((rings[i][k], rings[i][(k + 1) % segs],
                          rings[i + 1][(k + 1) % segs], rings[i + 1][k]))
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(tuple(rings[-1]))
    return mesh_from_bm(name, bm, role, True)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []
    static = []

    # ---- посадочная гильза + быстросъём (статика) ----------------------
    static.append(cyl(PREFIX + 'sleeve', (X_SL0, 0, 0), (X_SL1, 0, 0), SL_R,
                      'graphite', vertices=52, bev=0.0022))

    # накидное быстросъёмное кольцо: широкий графитовый хомут с насечкой
    static.append(cyl(PREFIX + 'release_collar', (-0.0800, 0, 0), (-0.0692, 0, 0),
                      0.0210, 'graphite', vertices=60, bev=0.0024))
    bm = bmesh.new()
    for i in range(14):
        a = math.tau * i / 14
        rr = 0.0210
        m = (Matrix.Translation(Vector((-0.0746, math.sin(a) * rr, math.cos(a) * rr)))
             @ Matrix.Rotation(a, 4, 'X')
             @ Matrix.Diagonal(Vector((0.0062, 0.0013, 0.0014, 1.0))))
        bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    static.append(mesh_from_bm(PREFIX + 'knurl', bm, 'graphite', False))

    # стальное пружинное кольцо в стыке хомута и гильзы
    static.append(torus(PREFIX + 'release_ring', (-0.0668, 0, 0),
                        0.0194, 0.0026, 'steel', 'X', segs=52, rings=12))

    # метка размера: светлый поясок + точка-код на гильзе
    static.append(torus(PREFIX + 'size_band', (-0.0602, 0, 0),
                        0.0183, 0.0013, 'ivory', 'X', segs=44, rings=8))
    static.append(cyl(PREFIX + 'size_dot', (-0.0568, 0.0, 0.0179),
                      (-0.0568, 0.0, 0.0200), 0.0018, 'ivory', vertices=14))

    # цанга + фланец-упор под силикон
    static.append(cyl(PREFIX + 'collet', (X_COL0, 0, 0), (X_COL1, 0, 0),
                      COL_R0, 'steel', vertices=48, r2=COL_R1, bev=0.0014))
    static.append(cyl(PREFIX + 'collar', (X_FL0, 0, 0), (X_FL1, 0, 0), FL_R,
                      'ivory', vertices=48, bev=0.0018))
    static.append(torus(PREFIX + 'collar_lip', (-0.0454, 0, 0),
                        0.0200, 0.0014, 'steel', 'X', segs=44, rings=10))

    # ---- вращающаяся группа -------------------------------------------
    rotating.append(cyl(PREFIX + 'core', (X_CORE0, 0, 0), (X_CORE1, 0, 0),
                        CORE_R, 'steel', vertices=24, bev=0.0008))
    rotating.append(cyl(PREFIX + 'seat', (X_SEAT0, 0, 0), (X_SEAT1, 0, 0),
                        SEAT_R, 'graphite', vertices=44, bev=0.0014))

    # головка: цилиндр под навивкой + плавное скругление торца
    prof = []
    N = 40
    for i in range(N + 1):
        u = i / N
        prof.append((HEAD_X0 + (HEAD_X1 - HEAD_X0) * u,
                     head_r_at(HEAD_X0 + (HEAD_X1 - HEAD_X0) * u)))
    for k in range(1, NOSE_ARC + 1):
        a = (math.pi / 2.0) * k / NOSE_ARC
        prof.append((HEAD_X1 + TIP_R * math.sin(a), TIP_R * math.cos(a)))
    rotating.append(lathe_x(PREFIX + 'head', prof, 'silicone', segs=64))

    # объёмная двухзаходная спиральная навивка
    rotating.append(spiral_ribbon(PREFIX + 'ribs_a', 0.0, 'silicone_rib'))
    rotating.append(spiral_ribbon(PREFIX + 'ribs_b', math.pi, 'silicone_rib'))

    # ---- анимационная пустышка в основании головки ---------------------
    anim = empty(PREFIX + 'anim', (HEAD_X0, 0.0, 0.0))
    anim['spin_axis'] = 'X'
    anim['spin_speed_rad_s'] = SPIN_SPEED
    anim['rotating'] = True
    bpy.context.view_layer.update()      # иначе matrix_world ещё identity и дети съедут
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    for o in static:
        o['rotating'] = False

    bpy.context.view_layer.update()
    turns = (RIB_X1 - RIB_X0) / RIB_PITCH
    return anim, rotating, static, turns


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


def check(anim, rotating, static, turns):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    axis_off = max(abs(k_c0.y), abs(k_c0.z))
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    s_mn0, s_mx0 = mesh_bbox(static)
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()
    s_mn1, s_mx1 = mesh_bbox(static)
    static_shift = max((s_mn1 - s_mn0).length, (s_mx1 - s_mx0).length)

    length = size.x
    dia = max(size.y, size.z)

    rep = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'length_mm': round(length * 1000, 2),
        'diameter_mm': round(dia * 1000, 2),
        'bbox_ok': bool(0.080 <= length <= 0.200 and 0.020 <= dia <= 0.055),
        'rot_axis_offset_mm': round(axis_off * 1000, 4),
        'axis_ok': bool(axis_off < 5e-5),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 4),
        'pivot_ok': bool(pivot_shift < 0.001),
        'static_shift_mm': round(static_shift * 1000, 4),
        'static_ok': bool(static_shift < 1e-6),
        'spiral_turns_per_start': round(turns, 3),
        'spiral_starts': RIB_STARTS,
        'rib_section_mm': [round(RIB_W * 2000, 2), round(RIB_H * 2000, 2)],
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'rotating_parts': sorted(o.name for o in rotating),
        'static_parts': sorted(o.name for o in static),
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
    scene.view_settings.exposure = -0.22
    try:
        scene.eevee.taa_render_samples = 48
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.640, 0.635, 0.628, 1.0)
    bg.inputs['Strength'].default_value = 0.38

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=1.2,
                                     location=(center.x, center.y, mn.z - 0.0004))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.560, 0.556, 0.548, 1.0)
    nb.inputs['Roughness'].default_value = 0.95
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.30, -0.42, 0.46), 5.40, 0.32),
            ('fill', (-0.42, -0.34, 0.22), 2.40, 0.44),
            ('rim', (0.06, 0.44, 0.40), 3.40, 0.34)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.55))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    SHOTS.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)), Vector(direction).normalized()

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
            need = max(need,
                       abs(p.dot(right)) / th + p.dot(back),
                       abs(p.dot(up)) / tv + p.dot(back))
        return need * margin

    def box_corners(a, b):
        return [Vector((x, y, z))
                for x in (a.x, b.x) for y in (a.y, b.y) for z in (a.z, b.z)]

    c_main = box_corners(mn - center, mx - center)
    close_t = Vector((0.028, 0.0, 0.0))
    c_close = box_corners(Vector((-0.014, -0.028, -0.028)) - close_t,
                           Vector((0.074, 0.028, 0.028)) - close_t)

    from bpy_extras.object_utils import world_to_camera_view
    mesh_objs = [o for o in bpy.data.objects
                 if o.type == 'MESH' and o.name.startswith(PREFIX)]

    def max_ndc():
        worst = 0.0
        for o in mesh_objs:
            mw = o.matrix_world
            for v in o.data.vertices:
                p = world_to_camera_view(scene, cam, mw @ v.co)
                worst = max(worst, abs(p.x - 0.5) * 2.0, abs(p.y - 0.5) * 2.0)
        return worst

    views = [
        ('3q', (0.74, -0.72, 0.40), center + Vector((0, 0, 0.004)), 70, c_main, 0.90),
        ('front', (0.02, -1.00, 0.12), center + Vector((0, 0, 0.005)), 70, c_main, 0.90),
        ('side', (0.12, 1.00, 0.14), center + Vector((0, 0, 0.003)), 70, c_main, 0.90),
        ('closeup', (0.52, -0.82, 0.28), close_t, 90, c_close, 0.94),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(5):
            got = max_ndc()
            if abs(got - fill) < 0.02:
                break
            dist *= got / fill
            cam.location = target + dirn * dist
            cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
            bpy.context.view_layer.update()
        fp = SHOTS / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print(f'RENDERED {tag} fill={max_ndc():.3f} {fp}', flush=True)
    return outs


def main():
    anim, rotating, static, turns = build()
    rep = check(anim, rotating, static, turns)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    SHOTS.mkdir(parents=True, exist_ok=True)
    (SHOTS / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['axis_ok']
            and rep['static_ok'] and rep['material_count'] >= 4
            and rep['glb_bytes'] > 10000):
        raise SystemExit('checks failed')


main()
