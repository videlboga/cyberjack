"""Standalone builder: work_roller (WRK-FL-02, «Аппликатор-валик»).

Компактный прижимной валик Ø 0,065 x 0,166 м с мягким силиконовым покрытием,
стальными торцевыми кольцами и осью, статичной вилкой из двух подшипниковых
щёк, пружинным прижимом (2 пружины + направляющие), быстросъёмным кулачковым
рычагом и подачей состава через штуцер/трубку в клапанный блок.

Не зависит от build_component_library.py / build_work_tickle_firm.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_work_roller.py

Выход:
  public/models/machine-modules/components/work_roller.glb
  docs/plans/blockout/component-library/work_roller/*.png
  docs/plans/blockout/component-library/work_roller/report.json

Геометрия (Blender Z-up, метры):
  ось валика = Y, линия x=0, z=Z0=0.040
  anim-пустышка = (0, 0, Z0) — ровно центр оси валика
  вращаются (дети anim): sleeve, sleeve_mark, groove_a, groove_b,
                         ring_n, ring_f, shaft
  статичны:              boss_n/f, arm_n/f, bridge, seat_a/b, rod_a/b,
                         spring_a/b, plate, screw_a/b, valve_block,
                         valve_knob, union, barb, feed_tube, qr_cam,
                         qr_lever, qr_grip, qr_knob, led

Ориентация для three.js (после export_yup): ось валика = Z, вращение вокруг Z.
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/work_roller'
CID = 'work_roller'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.040                      # высота оси валика
SLEEVE_Y0, SLEEVE_Y1 = -0.075, 0.075   # рабочая поверхность 0.150
SLEEVE_R = 0.0310               # Ø 0.062 — мягкое покрытие
RING_Y = 0.0080                 # ширина торцевых колец
RING_R = 0.0330
SHAFT_Y0, SHAFT_Y1 = -0.106, 0.108
SHAFT_R = 0.0050
BOSS_IN, BOSS_OUT = 0.088, 0.0995      # подшипниковые щёки (вилка)
BOSS_R = 0.0172
ARM_Y = 0.0935
BRIDGE_X, BRIDGE_Z = 0.046, 0.087      # траверса вилки
BRIDGE_SZ = (0.016, 0.196, 0.013)
ROD_Y = 0.034                          # направляющие пружин
ROD_R = 0.0038
SPRING_R = 0.0095
PLATE_Z0, PLATE_Z1 = 0.108, 0.117      # стативная опора

PALETTE = {
    'silicone': (0.945, 0.937, 0.923),
    'body': (0.965, 0.957, 0.941),
    'steel': (0.735, 0.739, 0.729),
    'graphite': (0.300, 0.310, 0.325),
    'cyan': (0.330, 0.760, 0.790),
    'brass': (0.760, 0.612, 0.352),
    'rubber': (0.170, 0.178, 0.190),
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
    rough = {'silicone': 0.86, 'rubber': 0.72, 'steel': 0.34,
             'brass': 0.30, 'graphite': 0.55}.get(role, 0.62)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = 0.85 if role in ('steel', 'brass') else (
        0.30 if role == 'graphite' else 0.0)
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.55
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


def sphere(name, loc, radius, role, segs=20, rings=12):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
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
    cu.resolution_u = 14
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


def helix_spring(name, base, height, coil_r, wire_r, turns, role):
    """Витая пружина сжатия вдоль Z в точке base."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = wire_r
    cu.bevel_resolution = 3
    sp = cu.splines.new('POLY')
    n = max(24, int(turns * 20))
    sp.points.add(n)
    b = Vector(base)
    for i in range(n + 1):
        t = i / n
        a = t * turns * math.tau
        sp.points[i].co = (b.x + coil_r * math.cos(a),
                           b.y + coil_r * math.sin(a),
                           b.z + height * t, 1.0)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.object
    obj.name = name
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


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []
    C = Vector((0.0, 0.0, Z0))

    # ---- вращающийся валик ---------------------------------------------
    sleeve = cyl(PREFIX + 'sleeve', (0, SLEEVE_Y0, Z0), (0, SLEEVE_Y1, Z0),
                 SLEEVE_R, 'silicone', vertices=56, bev=0.0022)
    mark = cyl(PREFIX + 'sleeve_mark', (0, 0.050, Z0), (0, 0.060, Z0),
               SLEEVE_R + 0.0004, 'cyan', vertices=48, bev=0.0008)
    groove_a = torus(PREFIX + 'groove_a', (0, -0.030, Z0),
                     SLEEVE_R - 0.0006, 0.0013, 'graphite', 'Y', segs=48)
    groove_b = torus(PREFIX + 'groove_b', (0, 0.014, Z0),
                     SLEEVE_R - 0.0006, 0.0013, 'graphite', 'Y', segs=48)
    ring_n = cyl(PREFIX + 'ring_n', (0, SLEEVE_Y0 - RING_Y, Z0), (0, SLEEVE_Y0, Z0),
                 RING_R, 'steel', vertices=48, bev=0.0012)
    ring_f = cyl(PREFIX + 'ring_f', (0, SLEEVE_Y1, Z0), (0, SLEEVE_Y1 + RING_Y, Z0),
                 RING_R, 'steel', vertices=48, bev=0.0012)
    shaft = cyl(PREFIX + 'shaft', (0, SHAFT_Y0, Z0), (0, SHAFT_Y1, Z0),
                SHAFT_R, 'steel', vertices=24)
    rotating += [sleeve, mark, groove_a, groove_b, ring_n, ring_f, shaft]

    # ---- статичная вилка: подшипниковые щёки + рычаги + траверса --------
    for tag, ys in (('n', -1.0), ('f', 1.0)):
        cyl(PREFIX + f'boss_{tag}', (0, ys * BOSS_IN, Z0), (0, ys * BOSS_OUT, Z0),
            BOSS_R, 'graphite', vertices=32, bev=0.0016)
        cyl(PREFIX + f'arm_{tag}', (0.002, ys * ARM_Y, Z0),
            (BRIDGE_X - 0.001, ys * ARM_Y, BRIDGE_Z - 0.005),
            0.0060, 'steel', vertices=18)
    cube(PREFIX + 'bridge', (BRIDGE_X, 0.0, BRIDGE_Z), BRIDGE_SZ, 'graphite',
         r=0.0018)

    # ---- пружинный прижим: направляющие, пружины, опорная плита ---------
    for tag, ys in (('a', -1.0), ('b', 1.0)):
        cyl(PREFIX + f'seat_{tag}', (BRIDGE_X, ys * ROD_Y, BRIDGE_Z + 0.0065),
            (BRIDGE_X, ys * ROD_Y, BRIDGE_Z + 0.0098), 0.0115, 'graphite',
            vertices=20, bev=0.0008)
        cyl(PREFIX + f'rod_{tag}', (BRIDGE_X, ys * ROD_Y, BRIDGE_Z + 0.0065),
            (BRIDGE_X, ys * ROD_Y, PLATE_Z0 + 0.004), ROD_R, 'steel', vertices=14)
        helix_spring(PREFIX + f'spring_{tag}',
                     (BRIDGE_X, ys * ROD_Y, BRIDGE_Z + 0.0100),
                     0.0115, SPRING_R, 0.0014, 4.0, 'steel')
    cube(PREFIX + 'plate', (0.040, 0.0, (PLATE_Z0 + PLATE_Z1) * 0.5),
         (0.036, 0.098, PLATE_Z1 - PLATE_Z0), 'body', r=0.0022)
    for tag, ys in (('a', -1.0), ('b', 1.0)):
        cyl(PREFIX + f'screw_{tag}', (0.039, ys * 0.044, PLATE_Z1 - 0.001),
            (0.039, ys * 0.044, PLATE_Z1 + 0.0015), 0.0042, 'steel',
            vertices=14, bev=0.0006)
    sphere(PREFIX + 'led', (0.030, -0.030, PLATE_Z1 + 0.0022),
           0.0034, 'cyan')

    # ---- подача состава: клапанный блок + трубка + штуцер ---------------
    cube(PREFIX + 'valve_block', (0.030, -0.084, 0.1000),
         (0.026, 0.028, 0.020), 'body', r=0.0018)
    cyl(PREFIX + 'valve_knob', (0.030, -0.084, 0.1100),
        (0.030, -0.084, 0.1180), 0.0070, 'cyan', vertices=20, bev=0.0008)
    curve_tube(PREFIX + 'feed_tube',
                [(0.0, -0.1232, Z0),
                 (-0.004, -0.1275, 0.0565),
                 (0.004, -0.1230, 0.0730),
                 (0.016, -0.1120, 0.0868),
                 (0.026, -0.0990, 0.0942),
                 (0.028, -0.0905, 0.0952)], 0.0030, 'rubber')
    cyl(PREFIX + 'union', (0.0, -0.100, Z0), (0.0, -0.1132, Z0),
        0.0096, 'graphite', vertices=24, bev=0.0012)
    cyl(PREFIX + 'barb', (0.0, -0.1132, Z0), (0.0, -0.1240, Z0),
        0.0058, 'brass', vertices=18, r2=0.0042)

    # ---- быстросъём: кулачок + рычаг + откидная рукоятка ----------------
    cyl(PREFIX + 'qr_cam', (0.0, 0.0955, 0.0575), (0.0, 0.1055, 0.0575),
        0.0086, 'graphite', vertices=24, bev=0.0010)
    cube(PREFIX + 'qr_lever', (0.0160, 0.1005, 0.0692),
         (0.036, 0.0062, 0.0100), 'steel', r=0.0008,
         rot=(0, math.radians(24), 0))
    sphere(PREFIX + 'qr_grip', (0.0330, 0.1005, 0.0775), 0.0062, 'graphite',
           segs=16, rings=10)
    cyl(PREFIX + 'qr_knob', (0.0, 0.1000, Z0), (0.0, 0.1120, Z0),
        0.0075, 'graphite', vertices=20, bev=0.0012)

    # ---- анимационная пустышка в центре оси валика ----------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    bpy.context.view_layer.update()   # иначе matrix_world ещё identity и дети съедут
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
    all_mesh = [o for o in bpy.data.objects
                if o.type == 'MESH' and o.name.startswith(PREFIX)]
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    sleeve = bpy.data.objects[PREFIX + 'sleeve']
    s_mn, s_mx = mesh_bbox([sleeve])
    sleeve_len = s_mx.y - s_mn.y
    sleeve_dia = max(s_mx.x - s_mn.x, s_mx.z - s_mn.z)
    s_c = (s_mn + s_mx) * 0.5
    axis_off = math.hypot(anim.location.x - s_c.x, anim.location.z - s_c.z)

    # pivot-тест: bbox-центр вращающейся группы до/после 90° вокруг Y
    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, math.radians(90.0), 0.0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    # ось подтверждаем: центр валика не должен уезжать при повороте на 20°
    anim.rotation_euler = (0.0, math.radians(20.0), 0.0)
    bpy.context.view_layer.update()
    r_mn, r_mx = mesh_bbox([sleeve])
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    spin_shift = ((r_mn + r_mx) * 0.5 - s_c).length

    static = sorted(o.name for o in bpy.data.objects
                    if o.name.startswith(PREFIX) and o.type == 'MESH'
                    and o not in kids)
    prefixed = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]

    report = {
        'component': CID,
        'code': 'WRK-FL-02',
        'nodes': len(prefixed),
        'mesh_nodes': len(all_mesh),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.120 and size.y <= 0.250 and size.z <= 0.120),
        'sleeve_diameter': round(sleeve_dia, 5),
        'sleeve_diameter_ok': bool(0.050 <= sleeve_dia <= 0.070),
        'sleeve_length': round(sleeve_len, 5),
        'sleeve_length_ok': bool(0.150 <= sleeve_len <= 0.200),
        'roller_axis': 'y',
        'anim_name': anim.name,
        'anim_type': anim.type,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_at_axis_m': round(axis_off, 9),
        'anim_at_axis_mm': round(axis_off * 1000, 5),
        'anim_at_axis_ok': bool(axis_off < 0.001),
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.001),
        'spin_center_shift_mm': round(spin_shift * 1000, 5),
        'spin_center_ok': bool(spin_shift < 0.001),
        'static_nodes': static,
        'static_count': len(static),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion': {
            'type': 'spin',
            'axis': 'y',                 # Blender-ось валика
            'threejs_axis': 'z',         # после export_yup: Blender Y -> glTF Z
            'speed': 1.2,
            'speed_unit': 'rad/s',
            'node': anim.name,
            'parts': sorted(o.name for o in kids),
            'static_parts': static,
        },
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
    scene.view_settings.exposure = -0.25
    try:
        scene.eevee.taa_render_samples = 48
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.780, 0.772, 0.760, 1.0)
    bg.inputs['Strength'].default_value = 0.62

    mn, mx = mesh_bbox([o for o in bpy.data.objects if o.type == 'MESH'])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=4,
                                     location=(center.x, center.y, mn.z - 0.0005))
    floor = bpy.context.object
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.690, 0.684, 0.672, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.34, -0.42, 0.34), 6.5, 0.42),
            ('fill', (-0.36, -0.30, 0.20), 2.4, 0.50),
            ('rim', (0.10, 0.40, 0.30), 3.6, 0.42)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((0, 0, center.z * 0.9))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
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
    # крупный план: валик + вилка + пружинный узел
    close_t = Vector((0.018, -0.008, 0.096))
    c_close = box_corners(Vector((-0.040, -0.136, 0.058)) - close_t,
                          Vector((0.064, 0.122, 0.126)) - close_t)

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
        ('3q', (0.80, 0.95, 0.48), center, 70, c_main, 0.92),
        ('front', (0.18, -1.00, 0.13), center, 70, c_main, 0.92),
        ('side', (-1.00, -0.22, 0.11), center, 70, c_main, 0.92),
        ('closeup', (0.36, -0.52, 0.80), close_t, 80, c_close, 0.96),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
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
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['anim_at_axis_ok']
            and rep['spin_center_ok'] and rep['material_count'] >= 4
            and rep['sleeve_length_ok'] and rep['sleeve_diameter_ok']):
        raise SystemExit('checks failed')


main()
