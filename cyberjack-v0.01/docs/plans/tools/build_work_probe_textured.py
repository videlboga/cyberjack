"""Standalone builder + renderer: work_probe_textured (WRK-PEN-05, «Текстурированный зонд»).

Компактная сменная текстурированная насадка: графитовое основание с
быстросъёмом, стальной вал, бледно-розовый силиконовый чулок с выраженным
рельефом (5 кольцевых рёбер + 4 спиральных гребня в одной скиновой оболочке),
скруглённый торец, розовая манжета, LED.

Не зависит от build_component_library.py и от других build_* скриптов.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_probe_textured.py

Выход:
  public/models/machine-modules/components/work_probe_textured.glb
  docs/plans/blockout/component-library/work_probe_textured/*.png  (3q/front/side/closeup + 300px)

Геометрия (Blender Z-up, метры):
  ось зонда      = X, линия y=0 z=0
  anim-пустышка  = (0.036, 0, 0) — центр оси насадки (середина чулка по X)
  вращаются: cap, ribs (в скине), shaft, cuff, cuff_ring, shaft_collar
  статичны:  base_grip, rear_cap, qr_collar, qr_latch, qr_pin, flange,
             drive_mark, led, led_bezel, key_pin, strain_relief, cable
"""
from pathlib import Path
import json
import math
import sys

import bpy
import bmesh
from mathutils import Vector, Matrix

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
SHOTS = PROJECT / 'docs/plans/blockout/component-library/work_probe_textured'
CID = 'work_probe_textured'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
X_BACK = -0.0800           # торец кабельного ввода
X_TIP = 0.0800             # вершина скруглённого торца
CAP_X0 = 0.0000            # начало силиконового чулка
CAP_R = 0.0200             # радиус чулка по телу
CAP_DOME = 0.0680          # начало скругления торца
CAP_DOME_L = X_TIP - CAP_DOME   # 0.0120 — длина скругления
RIB_X0, RIB_X1 = 0.0060, 0.0640  # зона кольцевой гофры
RIB_PITCH = 0.0105
RIB_AMP = 0.0032
HX0, HX1 = 0.0050, 0.0650  # спиральные гребни
HELIX_STARTS = 4           # 4 захода => поверхность 90°-симметрична (pivot-тест = 0)
HELIX_TURNS = 3.0
HELIX_AMP = 0.0014
ANIM_X = 0.5 * (CAP_X0 + X_TIP)

SHAFT_X0, SHAFT_X1 = -0.0320, 0.0040
SHAFT_R = 0.0060
CUFF_X0, CUFF_X1 = -0.0080, 0.0000
CUFF_R = 0.0180

PALETTE = {
    'silicone': (0.945, 0.820, 0.830),
    'blush': (0.870, 0.620, 0.650),
    'rose': (0.790, 0.400, 0.470),
    'steel': (0.700, 0.710, 0.705),
    'graphite': (0.205, 0.212, 0.225),
    'dark': (0.115, 0.120, 0.135),
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
    rough = {'silicone': 0.58, 'blush': 0.60, 'rose': 0.50, 'steel': 0.34,
             'graphite': 0.46, 'dark': 0.66, 'cyan': 0.28}[role]
    metal = {'steel': 0.30, 'graphite': 0.22, 'dark': 0.10}.get(role, 0.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 1.6
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


def sphere(name, loc, radius, role, segs=24, rings=14):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='X', segs=48, rings=12):
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
    e.empty_display_size = 0.012
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def fluted(name, x0, x1, r_out, r_in, n, role):
    """Цилиндр с продольными насечками по образующей (рифлёный хват)."""
    bm = bmesh.new()
    steps = n * 2
    ring0, ring1 = [], []
    for i in range(steps):
        a = math.tau * i / steps
        r = r_out if i % 2 == 0 else r_in
        y, z = math.sin(a) * r, math.cos(a) * r
        ring0.append(bm.verts.new((x0, y, z)))
        ring1.append(bm.verts.new((x1, y, z)))
    for i in range(steps):
        j = (i + 1) % steps
        bm.faces.new((ring0[i], ring0[j], ring1[j], ring1[i]))
    bm.faces.new(tuple(reversed(ring0)))
    bm.faces.new(ring1)
    return mesh_from_bm(name, bm, role, smooth=False)


def smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3.0 - 2.0 * t)


def relief_radius(x, th):
    """Радиус чулка: кольцевая гофра (правильный период) + спиральные гребни."""
    r = CAP_R
    if RIB_X0 <= x <= RIB_X1:
        t = (x - RIB_X0) / (RIB_X1 - RIB_X0)
        win = smoothstep(t / 0.06) * smoothstep((1.0 - t) / 0.06)
        r += RIB_AMP * 0.5 * (1.0 + math.cos(math.tau * (x - RIB_X0) / RIB_PITCH)) * win
    if HX0 <= x <= HX1:
        t = (x - HX0) / (HX1 - HX0)
        fade = smoothstep(t / 0.08) * smoothstep((1.0 - t) / 0.08)
        phase = HELIX_STARTS * (th - math.tau * HELIX_TURNS * t)
        r += HELIX_AMP * 0.5 * (1.0 + math.cos(phase)) * fade
    return r


def cap_skin(name, role, nt=72, n_cyl=140, n_dome=34):
    """Единая оболочка чулка: цилиндр с рельефом + скруглённый торец полюсом."""
    xs = [CAP_X0 + (CAP_DOME - CAP_X0) * i / n_cyl for i in range(n_cyl + 1)]
    rings_x = [(x, 1.0) for x in xs]
    for i in range(1, n_dome + 1):
        s = (i / n_dome) * 0.992
        rings_x.append((CAP_DOME + s * CAP_DOME_L, math.sqrt(max(0.0, 1.0 - s * s))))

    bm = bmesh.new()
    rings = []
    for x, scale in rings_x:
        ring = []
        for k in range(nt):
            th = math.tau * k / nt
            r = relief_radius(x, th) if scale >= 1.0 else CAP_R * scale
            ring.append(bm.verts.new((x, math.sin(th) * r, math.cos(th) * r)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        a_, b_ = rings[i], rings[i + 1]
        for k in range(nt):
            k2 = (k + 1) % nt
            bm.faces.new((a_[k], a_[k2], b_[k2], b_[k]))
    bm.faces.new(tuple(reversed(rings[0])))     # задняя крышка (внутри манжеты)
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

    # ---- статичное основание -------------------------------------------
    cyl(PREFIX + 'strain_relief', (X_BACK, 0, 0), (-0.0744, 0, 0), 0.0094,
        'dark', vertices=24, bev=0.0008)
    cyl(PREFIX + 'rear_cap', (-0.0750, 0, 0), (-0.0700, 0, 0), 0.0170,
        'graphite', vertices=36, bev=0.0012)
    cyl(PREFIX + 'base_grip', (-0.0700, 0, 0), (-0.0470, 0, 0), 0.0220,
        'graphite', vertices=48, bev=0.0014)
    for i, gx in enumerate((-0.0660, -0.0520)):
        torus(PREFIX + f'grip_groove_{i}', (gx, 0, 0), 0.0218, 0.0012, 'dark', 'X',
              segs=48, rings=6)
    cyl(PREFIX + 'qr_collar', (-0.0470, 0, 0), (-0.0355, 0, 0), 0.0240,
        'steel', vertices=56, bev=0.0016)
    torus(PREFIX + 'qr_groove', (-0.0410, 0, 0), 0.0242, 0.0012, 'dark', 'X',
          segs=48, rings=6)
    cube(PREFIX + 'qr_latch', (-0.0410, 0.0, 0.0280), (0.0110, 0.0072, 0.0056),
         'steel', r=0.0010)
    cyl(PREFIX + 'qr_pin', (-0.0410, -0.0044, 0.0240), (-0.0410, -0.0044, 0.0310),
        0.0020, 'steel', vertices=12)
    cyl(PREFIX + 'flange', (-0.0355, 0, 0), (-0.0310, 0, 0), 0.0140,
        'graphite', vertices=36, bev=0.0010)
    torus(PREFIX + 'drive_mark', (-0.0352, 0, 0), 0.0150, 0.0013, 'rose', 'X',
          segs=40, rings=8)
    torus(PREFIX + 'bearing_rear', (-0.0312, 0, 0), 0.0098, 0.0016, 'steel', 'X',
          segs=28, rings=8)
    sphere(PREFIX + 'led', (-0.0600, 0.0, 0.0212), 0.0032, 'cyan')
    torus(PREFIX + 'led_bezel', (-0.0600, 0.0, 0.0222), 0.0035, 0.0010, 'steel', 'Z',
          segs=20, rings=6)
    cyl(PREFIX + 'key_pin', (-0.0585, 0.0, -0.0208), (-0.0585, 0.0, -0.0270),
        0.0022, 'steel', vertices=12)

    # кабель: вниз-вперёд, короткий хвост
    curve_tube(PREFIX + 'cable',
               [(-0.0782, 0.0, -0.0015),
                (-0.0766, 0.0030, -0.0165),
                (-0.0680, 0.0050, -0.0285),
                (-0.0575, 0.0056, -0.0335)], 0.0030, 'dark')

    # ---- вращающаяся часть (дети anim) ---------------------------------
    shaft = cyl(PREFIX + 'shaft', (SHAFT_X0, 0, 0), (SHAFT_X1, 0, 0), SHAFT_R,
                'steel', vertices=24)
    collar = cyl(PREFIX + 'shaft_collar', (-0.0140, 0, 0), (-0.0110, 0, 0), 0.0082,
                  'steel', vertices=20, bev=0.0008)
    cuff = cyl(PREFIX + 'cuff', (CUFF_X0, 0, 0), (CUFF_X1, 0, 0), CUFF_R,
                'blush', vertices=48, bev=0.0016)
    cuff_ring = torus(PREFIX + 'cuff_ring', (CUFF_X1 - 0.0012, 0, 0),
                       0.0188, 0.0018, 'rose', 'X', segs=44, rings=10)
    cap = cap_skin(PREFIX + 'cap', 'silicone')
    rotating += [shaft, collar, cuff, cuff_ring, cap]

    # ---- анимационная пустышка в центре оси насадки --------------------
    anim = empty(PREFIX + 'anim', (ANIM_X, 0.0, 0.0))
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
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    cap = bpy.data.objects[PREFIX + 'cap']
    c_mn, c_mx = mesh_bbox([cap])
    cap_d = max(c_mx.y - c_mn.y, c_mx.z - c_mn.z)
    cap_len = c_mx.x - c_mn.x
    cap_axis_off = max(abs((c_mn.y + c_mx.y) * 0.5), abs((c_mn.z + c_mx.z) * 0.5))

    mats = sorted({m.name for o in all_mesh for m in o.data.materials if m})
    static = sorted(o.name for o in bpy.data.objects
                    if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in kids)
    kids_names = sorted(o.name for o in kids)

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_nodes': len(all_mesh),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.200 and size.y <= 0.100 and size.z <= 0.100),
        'length': round(size.x, 5),
        'length_ok': bool(0.152 <= size.x <= 0.172),
        'cap_diameter': round(cap_d, 5),
        'cap_diameter_ok': bool(0.040 <= cap_d <= 0.080),
        'cap_length': round(cap_len, 5),
        'cap_axis_offset_mm': round(cap_axis_off * 1000, 5),
        'anim_name': anim.name,
        'anim_loc': [round(v, 6) for v in anim.location],
        'anim_on_axis': bool(abs(anim.location.y) < 1e-9 and abs(anim.location.z) < 1e-9),
        'anim_children': kids_names,
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.001),
        'materials': mats,
        'materials_count': len(mats),
        'static_parts': static,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }
    report['ok'] = bool(report['bbox_ok'] and report['length_ok']
                        and report['cap_diameter_ok'] and report['pivot_ok']
                        and report['anim_on_axis'] and len(mats) >= 4)
    return report


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    bpy.ops.object.select_all(action='DESELECT')
    for o in objects:
        o.select_set(True)
    active = next(o for o in objects if o.type == 'MESH')
    bpy.context.view_layer.objects.active = active
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
def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = -0.35
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.700, 0.700, 0.710, 1)
    bg.inputs['Strength'].default_value = 0.60

    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, -0.0500))
    floor = bpy.context.object
    floor.name = 'render_floor'
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.70, 0.70, 0.71, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.1, 1.4), 1.25),
        ('fill', (-1.2, -0.8, 0.5), 0.45),
        ('rim', (0.2, 1.1, 0.9), 0.95),
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
    setup_render()
    shot('3q', (1.05, -1.55, 0.78), (-0.002, 0.0, 0.001), ortho_scale=0.190,
         res=(900, 640))
    shot('front', (1.0, -0.12, 0.07), (0.0, 0.0, 0.001), ortho_scale=0.072, res=(700, 700))
    shot('side', (0.0, -1.0, 0.03), (-0.002, 0.0, 0.001), ortho_scale=0.176,
         res=(1000, 420))
    shot('closeup', (0.62, -0.95, 0.40), (0.036, 0.0, 0.0), dist=0.150, lens=85,
         res=(980, 760))
    shot('preview300', (1.05, -1.55, 0.78), (-0.002, 0.0, 0.001), ortho_scale=0.190,
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
