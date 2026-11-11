"""Standalone builder: motion_spreader (MOT-SPR-06, «Разведение»).

Симметричный раздвижной узел: серебристый профильный рельс с закалённой
направляющей, две графитовые каретки с быстросъёмами и D-ring, ШВП перед
рельсом с гайками на каретках, ручной маховик с ручкой справа, шкала ширины
с нониусными метками и красными указателями на каретках, концевые упоры.
Плиты-основания нет.

Не зависит от build_component_library.py / build_work_*.py.

Запуск:
  /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
      --python docs/plans/tools/build_motion_spreader.py

Выход:
  public/models/machine-modules/components/motion_spreader.glb
  docs/plans/blockout/component-library/motion_spreader/*.png
  docs/plans/blockout/component-library/motion_spreader/report.json

Геометрия (Blender Z-up, метры):
  ось рельса = X, линия y=0, z=Z0 (0.029) — центр рельса
  anim-пустышка = (0, 0, Z0) — центр рельса, ровно между каретками
  каретки — дети anim, стоят симметрично в x = ±CAR_X (0.186)
  движение: scale по X от центра (amount 0.08) -> каретки расходятся
            симметрично; рельс, ШВП, маховик, шкала, упоры статичны
  габарит по паспорту 0,8 × 0,2 × 0,15 м
"""
from pathlib import Path
import json
import math

import bpy
import bmesh
from mathutils import Matrix, Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/motion_spreader'
CID = 'motion_spreader'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
RAIL_X = 0.365                 # половина длины рельса -> 0.730
RAIL_HY = 0.040                # половина глубины профиля
RAIL_Z0, RAIL_Z1 = 0.0, 0.058  # низ / верх профиля
Z0 = (RAIL_Z0 + RAIL_Z1) * 0.5  # 0.029 — центр рельса = центр anim

CAR_X = 0.186                  # центры кареток, симметрично
CAR_HX = 0.045                 # половина длины каретки
CAR_HY = 0.052                 # половина глубины каретки
CAR_Z0, CAR_Z1 = 0.020, 0.100  # каретка обхватывает рельс, низ приподнят
COVER_Z = CAR_Z1 + 0.0045      # стальная накладка сверху

SCREW_Y = -0.055               # ось ШВП перед рельсом
SCREW_Z = 0.070
SCREW_R = 0.0085
SCREW_X0, SCREW_X1 = -0.350, 0.362

HUB_X = (0.360, 0.371)         # ступица маховика
DISC_X = (0.371, 0.380)        # диск маховика
WHEEL_R = 0.050
CRANK_X = (0.377, 0.391)       # ручка на ободе
CRANK_Y, CRANK_Z = SCREW_Y - 0.030, SCREW_Z + 0.040

AMOUNT = 0.08                  # ход: scale X ±0.08

PALETTE = {
    'alu': (0.700, 0.712, 0.728),
    'alu_light': (0.808, 0.820, 0.836),
    'steel': (0.640, 0.652, 0.670),
    'graphite': (0.062, 0.066, 0.074),
    'dark': (0.030, 0.032, 0.038),
    'red': (0.700, 0.075, 0.062),
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
    if role in ('alu', 'alu_light'):
        bsdf.inputs['Metallic'].default_value = 0.94
        bsdf.inputs['Roughness'].default_value = 0.30 if role == 'alu' else 0.20
    elif role == 'steel':
        bsdf.inputs['Metallic'].default_value = 1.0
        bsdf.inputs['Roughness'].default_value = 0.24
    elif role == 'graphite':
        bsdf.inputs['Metallic'].default_value = 0.32
        bsdf.inputs['Roughness'].default_value = 0.46
    elif role == 'dark':
        bsdf.inputs['Metallic'].default_value = 0.32
        bsdf.inputs['Roughness'].default_value = 0.42
    else:
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Roughness'].default_value = 0.38
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


def bevel(obj, width=0.0012, segments=2, angle=40.0):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    if angle:
        mod.limit_method = 'ANGLE'
        mod.angle_limit = math.radians(angle)
    select_only(obj)
    try:
        bpy.ops.object.modifier_apply(modifier=mod.name)
    except RuntimeError:
        obj.modifiers.remove(mod)


def cube(name, loc, size, role, r=0.0012, rot=(0, 0, 0), smooth=False):
    """size = полные габариты (x, y, z)."""
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
        bevel(obj, bev, 2)
    return apply(obj, role, smooth)


def bar(name, a, b, width, thick, role, r=0.0010, smooth=False):
    """Прямой брусок от a к b: thick — по X, width — поперёк оси."""
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    obj.scale = (thick, width, d.length)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth)


def sphere(name, loc, radius, role, segs=18, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True)


def torus(name, center, axis, major, minor, role, segs=48, rings=12):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor,
                                     location=center)
    obj = bpy.context.object
    obj.name = name
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    return apply(obj, role, True)


def mesh_from_bm(name, bm, role, smooth=False):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def tick_mesh(name, x0, x1, step, y0, y1, z_top, major_every,
              major_len, minor_len, width, role):
    """Риски шкалы одним мешем: от z_top вниз."""
    bm = bmesh.new()
    n = int(round((x1 - x0) / step))
    for i in range(n + 1):
        x = x0 + i * step
        ln = major_len if i % major_every == 0 else minor_len
        res = bmesh.ops.create_cube(bm, size=1.0)
        m = (Matrix.Translation((x, (y0 + y1) * 0.5, z_top - ln * 0.5))
             @ Matrix.Diagonal(Vector((width, y1 - y0, ln, 1.0))))
        bmesh.ops.transform(bm, matrix=m, verts=res['verts'])
    return mesh_from_bm(name, bm, role)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    e.empty_display_size = 0.03
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


# --- сборка --------------------------------------------------------------
def build():
    reset()

    # ---- статичный рельс / направляющая --------------------------------
    cube(PREFIX + 'rail_body', (0, 0, Z0), (2 * RAIL_X, 2 * RAIL_HY, 0.058),
         'alu', r=0.0030)
    # закалённая направляющая сверху профиля
    cube(PREFIX + 'rail_guide', (0, 0, RAIL_Z1 + 0.0035),
         (2 * RAIL_X, 0.040, 0.007), 'steel', r=0.0008)
    # продольные Т-пазы на боковинах (тёмная вставка)
    for tag, y in (('l', -RAIL_HY - 0.0002), ('r', RAIL_HY + 0.0002)):
        cube(f'{PREFIX}rail_groove_{tag}', (0, y, 0.034),
             (2 * RAIL_X - 0.030, 0.0014, 0.010), 'graphite', r=0.0)

    # ---- шкала ширины на передней грани рельса -------------------------
    cube(PREFIX + 'scale_plate', (0, -RAIL_HY - 0.0008, 0.010),
         (0.700, 0.0016, 0.014), 'alu_light', r=0.0004)
    tick_mesh(PREFIX + 'scale_ticks', -0.340, 0.340, 0.010,
              -RAIL_HY - 0.0016, -RAIL_HY - 0.0034, 0.016,
              5, 0.013, 0.007, 0.0016, 'dark')
    cube(PREFIX + 'scale_index', (0, -RAIL_HY - 0.0024, 0.0095),
         (0.0038, 0.0042, 0.017), 'red', r=0.0006)
    for tag, x in (('l', -0.320), ('r', 0.320)):
        cube(f'{PREFIX}scale_limit_{tag}', (x, -RAIL_HY - 0.0024, 0.0095),
             (0.0050, 0.0040, 0.015), 'red', r=0.0006)

    # ---- концевые упоры ------------------------------------------------
    cube(PREFIX + 'end_stop_l', (-RAIL_X - 0.017, 0, 0.034),
         (0.017, 0.090, 0.068), 'graphite', r=0.0030)
    cube(PREFIX + 'end_stop_r', (RAIL_X + 0.017, 0, 0.034),
         (0.017, 0.090, 0.068), 'graphite', r=0.0030)
    for tag, s in (('l', -1), ('r', 1)):
        cube(f'{PREFIX}bumper_{tag}', (s * (RAIL_X + 0.0068), 0, 0.036),
             (0.004, 0.072, 0.052), 'red', r=0.0014)

    # ---- ШВП перед рельсом --------------------------------------------
    for tag, x in (('l', -0.356), ('r', 0.352)):
        cube(f'{PREFIX}screw_bearing_{tag}', (x, -0.0475, 0.068),
             (0.012, 0.055, 0.056), 'graphite', r=0.0020)
    cyl(PREFIX + 'screw_boss_l', (-0.352, SCREW_Y, SCREW_Z),
        (-0.340, SCREW_Y, SCREW_Z), 0.0150, 'steel', vertices=24, bev=0.0010)
    cyl(PREFIX + 'screw', (SCREW_X0, SCREW_Y, SCREW_Z),
        (SCREW_X1, SCREW_Y, SCREW_Z), SCREW_R, 'steel', vertices=24)
    cyl(PREFIX + 'screw_collar', (0.332, SCREW_Y, SCREW_Z),
        (0.342, SCREW_Y, SCREW_Z), 0.0125, 'dark', vertices=20, bev=0.0008)

    # ---- маховик -------------------------------------------------------
    cyl(PREFIX + 'handwheel_hub', (HUB_X[0], SCREW_Y, SCREW_Z),
        (HUB_X[1], SCREW_Y, SCREW_Z), 0.0115, 'steel', vertices=24,
        bev=0.0010)
    cyl(PREFIX + 'handwheel_disc', (DISC_X[0], SCREW_Y, SCREW_Z),
        (DISC_X[1], SCREW_Y, SCREW_Z), WHEEL_R, 'alu', vertices=48,
        bev=0.0010)
    torus(PREFIX + 'handwheel_rim', ((DISC_X[0] + DISC_X[1]) * 0.5,
                                     SCREW_Y, SCREW_Z), 'X',
          WHEEL_R, 0.0060, 'steel', segs=48, rings=10)
    bm = bmesh.new()
    for i in range(3):
        a = math.radians(90 + i * 120)
        y = SCREW_Y + math.cos(a) * WHEEL_R * 0.52
        z = SCREW_Z + math.sin(a) * WHEEL_R * 0.52
        res = bmesh.ops.create_cube(bm, size=1.0)
        d = Vector((0, math.cos(a), math.sin(a)))
        q = d.to_track_quat('Z', 'Y')
        m = (Matrix.Translation(((DISC_X[0] + DISC_X[1]) * 0.5, y, z))
             @ q.to_matrix().to_4x4()
             @ Matrix.Diagonal(Vector((0.009, 0.010, WHEEL_R * 1.05, 1.0))))
        bmesh.ops.transform(bm, matrix=m, verts=res['verts'])
    mesh_from_bm(PREFIX + 'handwheel_spokes', bm, 'dark')
    cyl(PREFIX + 'handwheel_crank', (CRANK_X[0], CRANK_Y, CRANK_Z),
        (CRANK_X[1], CRANK_Y, CRANK_Z), 0.0068, 'dark', vertices=16,
        bev=0.0010)
    sphere(PREFIX + 'handwheel_crank_cap', (CRANK_X[1] + 0.0015,
                                            CRANK_Y, CRANK_Z), 0.0074,
           'steel')

    # ---- каретки (движутся) -------------------------------------------
    moving = []
    for tag, s in (('l', -1), ('r', 1)):
        cx = s * CAR_X
        moving.append(cube(f'{PREFIX}carriage_body_{tag}', (cx, 0, 0.060),
                           (2 * CAR_HX, 2 * CAR_HY, CAR_Z1 - CAR_Z0),
                           'graphite', r=0.0040))
        moving.append(cube(f'{PREFIX}carriage_cover_{tag}',
                           (cx, 0, COVER_Z), (2 * CAR_HX - 0.012, 0.096, 0.009),
                           'steel', r=0.0015))
        moving.append(cube(f'{PREFIX}carriage_end_{tag}',
                           (cx + s * 0.0475, 0, 0.060),
                           (0.006, 0.096, 0.070), 'alu_light', r=0.0012))

        # ШВП-гайка, врезанная в переднюю грань каретки
        moving.append(cyl(f'{PREFIX}nut_{tag}',
                          (cx - 0.019, SCREW_Y, SCREW_Z),
                          (cx + 0.019, SCREW_Y, SCREW_Z), 0.0165,
                          'steel', vertices=24, bev=0.0012))
        moving.append(cyl(f'{PREFIX}nut_flange_{tag}',
                          (cx - 0.024, SCREW_Y, SCREW_Z),
                          (cx - 0.019, SCREW_Y, SCREW_Z), 0.0210,
                          'alu', vertices=24, bev=0.0008))

        # быстросъём: колодка + ось + рычаг + головка
        moving.append(cube(f'{PREFIX}qr_block_{tag}', (cx, 0.008, 0.1140),
                           (0.044, 0.056, 0.014), 'graphite', r=0.0022))
        moving.append(cube(f'{PREFIX}qr_bracket_{tag}', (cx, 0.030, 0.1095),
                           (0.036, 0.030, 0.013), 'steel', r=0.0016))
        moving.append(cyl(f'{PREFIX}qr_pin_{tag}', (cx - 0.021, 0.030, 0.118),
                          (cx + 0.021, 0.030, 0.118), 0.0052, 'steel',
                          vertices=16))
        moving.append(bar(f'{PREFIX}qr_lever_{tag}', (cx, 0.026, 0.120),
                          (cx, 0.062, 0.130), 0.012, 0.019, 'dark', r=0.0016))
        moving.append(cyl(f'{PREFIX}qr_grip_{tag}', (cx, 0.044, 0.1245),
                          (cx, 0.062, 0.130), 0.0078, 'dark', vertices=16))
        moving.append(sphere(f'{PREFIX}qr_knob_{tag}', (cx, 0.062, 0.130),
                             0.0078, 'dark', segs=16, rings=10))
        for j, dx in enumerate((-0.014, 0.014)):
            moving.append(cyl(f'{PREFIX}qr_bolt_{tag}_{j}',
                              (cx + dx, 0.022, 0.1185),
                              (cx + dx, 0.022, 0.1235), 0.0046, 'steel',
                              vertices=12))

        # красный указатель ширины на шкале
        moving.append(cube(f'{PREFIX}pointer_{tag}',
                           (cx, -0.0432, 0.0115), (0.0056, 0.0050, 0.0180),
                           'red', r=0.0007))

        # D-ring на наружном торце
        moving.append(cube(f'{PREFIX}dring_tab_{tag}',
                           (cx + s * 0.0525, 0, 0.060),
                           (0.011, 0.040, 0.038), 'alu', r=0.0020))
        moving.append(torus(f'{PREFIX}dring_{tag}',
                            (cx + s * 0.0715, 0, 0.062), 'Y', 0.0210, 0.0054,
                            'steel', segs=40, rings=10))

    # ---- анимационная пустышка в центре рельса -------------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z0))
    bpy.context.view_layer.update()   # иначе matrix_world ещё identity
    for o in moving:
        parent(o, anim)
        o['moving'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in moving:
            o['moving'] = False

    anim['motion_type'] = 'scale'
    anim['motion_axis'] = 'x'
    anim['motion_amount'] = AMOUNT
    anim['component'] = CID

    bpy.context.view_layer.update()
    return anim, moving


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


def check(anim, moving):
    bpy.context.view_layer.update()
    meshes = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5

    rail = bpy.data.objects[PREFIX + 'rail_body']
    r_mn, r_mx = mesh_bbox([rail])
    r_c = (r_mn + r_mx) * 0.5
    pivot_off = (Vector(anim.location) - r_c).length

    kids = sorted(anim.children, key=lambda o: o.name)

    def car_centers():
        out = {}
        for tag in ('l', 'r'):
            b = bpy.data.objects[f'{PREFIX}carriage_body_{tag}']
            b_mn, b_mx = mesh_bbox([b])
            out[tag] = (b_mn + b_mx) * 0.5
        return out

    c0 = car_centers()
    anim.scale = (1.0 + AMOUNT, 1.0, 1.0)
    bpy.context.view_layer.update()
    c1 = car_centers()
    dl = (c1['l'].x - c0['l'].x) * 1000.0
    dr = (c1['r'].x - c0['r'].x) * 1000.0
    anim.scale = (1.0, 1.0, 1.0)
    bpy.context.view_layer.update()

    gap = (c0['r'].x - c0['l'].x) * 1000.0
    sym_err = abs(dl + dr)
    mid_x = (c0['l'].x + c0['r'].x) * 0.5

    return {
        'component': CID,
        'code': 'MOT-SPR-06',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': [0.80, 0.20, 0.15],
        'bbox_ok': bool(size.x <= 0.801 and size.y <= 0.201 and size.z <= 0.151
                        and size.x >= 0.70),
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'rail_center': [round(v, 5) for v in r_c],
        'pivot_offset_mm': round(pivot_off * 1000, 4),
        'pivot_ok': bool(pivot_off < 0.001),
        'anim_children': [o.name for o in kids],
        'anim_child_count': len(kids),
        'motion': {'type': 'scale', 'axis': 'x', 'amount': AMOUNT,
                   'driver': PREFIX + 'anim'},
        'carriage_center_x': {'l': round(c0['l'].x, 5),
                              'r': round(c0['r'].x, 5)},
        'carriage_mid_x_mm': round(mid_x * 1000, 4),
        'carriage_gap_mm': round(gap, 2),
        'scale_test': {'left_shift_mm': round(dl, 3),
                       'right_shift_mm': round(dr, 3),
                       'symmetry_error_mm': round(sym_err, 4),
                       'symmetric_ok': bool(sym_err < 0.01
                                            and dl < 0 < dr)},
        'static_parts': sorted(o.name for o in bpy.data.objects
                               if o.name.startswith(PREFIX)
                               and o.type == 'MESH' and o not in kids),
        'parts': sorted(o.name for o in bpy.data.objects
                        if o.name.startswith(PREFIX)),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
    }


def export():
    objects = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    for o in objects:
        o['component'] = CID
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
        scene.eevee.taa_render_samples = 64
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.760, 0.752, 0.740, 1.0)
    bg.inputs['Strength'].default_value = 0.45

    mn, mx = mesh_bbox([o for o in bpy.data.objects
                        if o.type == 'MESH' and o.name.startswith(PREFIX)])
    center = (mn + mx) * 0.5

    bpy.ops.mesh.primitive_plane_add(size=4,
                                     location=(center.x, center.y, mn.z - 0.0003))
    floor = bpy.context.object
    floor.name = 'render_floor'
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.640, 0.634, 0.622, 1.0)
    nb.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(fm)

    for name, off, energy, sz in (
            ('key', (0.62, -0.95, 0.92), 26.0, 0.90),
            ('fill', (-1.05, -0.80, 0.55), 9.0, 1.20),
            ('rim', (0.15, 1.05, 0.72), 14.0, 0.85)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = center + Vector(off)
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 70
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        return (q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0)),
                Vector(direction).normalized())

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
    # крупный план: правая каретка с гайкой ШВП, быстросъёмом, D-ring и шкалой
    close_t = Vector((0.245, -0.012, 0.072))
    c_close = box_corners(Vector((0.118, -0.116, -0.004)) - close_t,
                          Vector((0.408, 0.078, 0.144)) - close_t)

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
        ('3q', (0.60, -0.78, 0.40), center, 70, c_main, 0.92, True),
        ('front', (0.02, -1.00, 0.12), center, 70, c_main, 0.92, True),
        ('side', (1.00, -0.30, 0.40), center, 70, c_main, 0.92, True),
        ('closeup', (0.52, -0.80, 0.36), close_t, 80, c_close, 0.95, False),
    ]
    outs = []
    for tag, direction, target, lens, corners, fill, refine in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        dirn = Vector(direction).normalized()
        cam.location = target + dirn * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.view_layer.update()
        for _ in range(5 if refine else 0):
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
    anim, moving = build()
    rep = check(anim, moving)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['material_count'] >= 4
            and rep['scale_test']['symmetric_ok'] and rep['glb_bytes'] > 10000
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
