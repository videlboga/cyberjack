"""Standalone builder: effect_thermal (EFF-THM-01, «Термо-вставка»).

Слой «эффект»: вставка в гнездо на корпусе базы. Тела не касается, насадки
нет, движения нет (motion: none), пустышка anim не нужна.

Устройство (снизу вверх):
  - контактная юбка-гильза из алюминия Ø32 с кольцом посадки Ø36;
  - датчик PT1000 на юбке (цилиндрик с проводом, вкручен сбоку);
  - янтарная шкала-метка на гильзе (поясок + риски);
  - пакет Пельтье между двумя керамическими пластинами (молочный корпус);
  - радиатор с рёбрами с другой стороны пакета;
  - кабельный ввод с пигтейлом на торце пакета;
  - монтажный фланец с двумя винтами.

Не зависит от build_component_library.py, helpers продублированы намеренно.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_effect_thermal.py

Выход:
  public/models/machine-modules/components/effect_thermal.glb
  docs/plans/blockout/component-library/effect_thermal/report.json

Геометрия (Blender Z-up, метры):
  X — длина 0.090 м (фланец -0.0450 … пигтейл ~+0.0445)
  Y — ширина 0.054 м (фланец ±0.0270)
  Z — высота: 0.000 (контактная плоскость) … 0.0560 (верх рёбер)
  ось юбки/кольца посадки — вертикальная Z, центр (SKX, 0)
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
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/effect_thermal'
CID = 'effect_thermal'
PREFIX = CID + '__'
CODE = 'EFF-THM-01'

# --- ключевые размеры (м) ------------------------------------------------
SKX = -0.0200                # ось юбки / кольца посадки
SK_R = 0.0160                # Ø32 контактная юбка
RING_R = 0.0180              # Ø36 кольцо посадки
Z_SK1 = 0.0260               # верх юбки = низ пакета

BST_X = -0.0140              # центр пакета Пельтье / радиатора
PLATE_X, PLATE_Y = 0.0480, 0.0480
Z_PL0, Z_PL1 = 0.0292, 0.0332        # нижняя керамика
Z_PU0, Z_PU1 = 0.0366, 0.0404        # верхняя керамика
Z_HS0, Z_HS1 = 0.0404, 0.0436        # основание радиатора
Z_FIN1 = 0.0568                      # верх рёбер

FL_X0, FL_X1 = -0.0450, -0.0365      # монтажный фланец-пятка (2 винта)
FL_HY = 0.0270
Z_FL0, Z_FL1 = 0.0250, 0.0292

PALETTE = {
    'milk': (0.945, 0.937, 0.918),      # керамика, корпус
    'alu': (0.725, 0.728, 0.718),       # юбка, радиатор
    'graphite': (0.205, 0.212, 0.231),  # фланец, кабельный ввод
    'dark': (0.070, 0.074, 0.084),      # зев, элементы Пельтье, кабель
    'steel': (0.620, 0.630, 0.632),     # кольцо посадки, винты, датчик
    'amber': (0.851, 0.635, 0.290),     # шкала-метка
}
ROUGH = {'milk': 0.52, 'alu': 0.44, 'graphite': 0.50, 'dark': 0.55,
         'steel': 0.28, 'amber': 0.38}
METAL = {'milk': 0.0, 'alu': 0.82, 'graphite': 0.28, 'dark': 0.35,
         'steel': 0.95, 'amber': 0.35}
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
    bsdf.inputs['Roughness'].default_value = ROUGH[role]
    bsdf.inputs['Metallic'].default_value = METAL[role]
    if role == 'amber':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.35
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


def bevel(obj, width=0.0012, segments=2):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(40)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def cube(name, loc, size, role, r=0.0010, rot=(0, 0, 0), seg=2, sharp=35.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    r = min(r, min(size) * 0.34)
    if r > 0.00015:
        bevel(obj, r, seg)
    apply(obj, role)
    return shade(obj, sharp)


def box(name, x0, x1, y0, y1, z0, z1, role, r=0.0010, seg=2, sharp=35.0):
    return cube(name, ((x0 + x1) * 0.5, (y0 + y1) * 0.5, (z0 + z1) * 0.5),
                (x1 - x0, y1 - y0, z1 - z0), role, r=r, seg=seg, sharp=sharp)


def cyl(name, a, b, radius, role, vertices=32, r2=None, bev=0.0, sharp=35.0):
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
    apply(obj, role)
    return shade(obj, sharp)


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
    apply(obj, role)
    return shade(obj, 50.0)


def curve_tube(name, points, radius, role, res=5):
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
    obj = bpy.context.object
    obj.name = name
    return shade(obj, 50.0)


def mesh_from_bm(name, bm, role, smooth_angle=35.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    return shade(obj, smooth_angle)


def bm_box(bm, loc, size, rotz=0.0):
    m = (Matrix.Translation(Vector(loc))
         @ Matrix.Rotation(rotz, 4, 'Z')
         @ Matrix.Diagonal((size[0], size[1], size[2], 1.0)))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def bm_cyl(bm, a, b, r1, r2=None, segs=20):
    a, b = Vector(a), Vector(b)
    d = b - a
    m = (Matrix.Translation((a + b) * 0.5)
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r1, radius2=r1 if r2 is None else r2,
                          depth=d.length, matrix=m)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    parts = []

    def add(o):
        parts.append(o)
        return o

    # ---- контактная юбка-гильза ----------------------------------------
    add(cyl(PREFIX + 'skirt', (SKX, 0.0, 0.0000), (SKX, 0.0, Z_SK1),
            SK_R, 'alu', vertices=48, bev=0.0014))
    # контактная плоскость: алюминиевый торец + тёмный зев
    add(cyl(PREFIX + 'skirt_face', (SKX, 0.0, 0.0000), (SKX, 0.0, 0.0016),
            0.0148, 'alu', vertices=44, sharp=45.0))
    add(cyl(PREFIX + 'skirt_bore', (SKX, 0.0, 0.0002), (SKX, 0.0, 0.0014),
            0.0108, 'dark', vertices=36, sharp=45.0))

    # ---- кольцо посадки Ø36 --------------------------------------------
    add(cyl(PREFIX + 'seat_ring', (SKX, 0.0, 0.0165), (SKX, 0.0, 0.0288),
            RING_R, 'steel', vertices=48, bev=0.0012))
    add(torus(PREFIX + 'seat_oring', (SKX, 0.0, 0.0278), 0.0175, 0.0013,
              'dark', 'Z', segs=44, rings=8))
    bm = bmesh.new()
    for i in range(6):
        a = math.radians(-150.0 + i * 60.0)
        bm_box(bm, (SKX + 0.0178 * math.cos(a), 0.0178 * math.sin(a), 0.0224),
               (0.0012, 0.0017, 0.0082), rotz=a)
    add(mesh_from_bm(PREFIX + 'seat_notches', bm, 'dark', 30.0))
    add(box(PREFIX + 'seat_index', SKX - 0.0016, SKX + 0.0016,
            -0.0187, -0.0175, 0.0198, 0.0254, 'amber', r=0.0002))

    # ---- янтарная шкала-метка на гильзе --------------------------------
    add(cyl(PREFIX + 'scale_band', (SKX, 0.0, 0.0055), (SKX, 0.0, 0.0080),
            SK_R + 0.0002, 'amber', vertices=44, sharp=45.0))
    bm = bmesh.new()
    for i in range(5):
        a = math.radians(-154.0 + i * 32.0)      # риски по фронту (-Y)
        bm_box(bm, (SKX + 0.0164 * math.cos(a), 0.0164 * math.sin(a), 0.0068),
               (0.0007, 0.0012, 0.0022), rotz=a)
    add(mesh_from_bm(PREFIX + 'scale_ticks', bm, 'dark', 25.0))

    # ---- датчик PT1000 на контактной юбке ------------------------------
    add(cyl(PREFIX + 'sensor', (SKX, -0.0156, 0.0145), (SKX, -0.0220, 0.0145),
            0.0030, 'steel', vertices=20, bev=0.0004))
    add(cyl(PREFIX + 'sensor_nut', (SKX, -0.0156, 0.0145), (SKX, -0.0184, 0.0145),
            0.0044, 'steel', vertices=6))
    add(cyl(PREFIX + 'sensor_cap', (SKX, -0.0218, 0.0145), (SKX, -0.0230, 0.0145),
            0.0021, 'dark', vertices=16))
    add(curve_tube(PREFIX + 'sensor_wire',
                   [(SKX, -0.0230, 0.0145),
                    (SKX - 0.0030, -0.0246, 0.0192),
                    (SKX - 0.0056, -0.0230, 0.0252),
                    (SKX - 0.0048, -0.0192, 0.0284),
                    (SKX - 0.0018, -0.0172, 0.0288)], 0.0013, 'dark'))

    # ---- пакет Пельтье между керамическими пластинами ------------------
    add(box(PREFIX + 'plate_lower', BST_X - PLATE_X * 0.5, BST_X + PLATE_X * 0.5,
            -PLATE_Y * 0.5, PLATE_Y * 0.5, Z_PL0, Z_PL1, 'milk', r=0.0012,
            seg=3))
    bm = bmesh.new()
    for ix in range(5):
        for iy in range(4):
            bm_box(bm, (BST_X - 0.0160 + ix * 0.0080,
                        -0.0135 + iy * 0.0090, (Z_PL1 + Z_PU0) * 0.5),
                   (0.0050, 0.0050, Z_PU0 - Z_PL1))
    add(mesh_from_bm(PREFIX + 'peltier_array', bm, 'dark', 30.0))
    add(box(PREFIX + 'plate_upper', BST_X - PLATE_X * 0.5, BST_X + PLATE_X * 0.5,
            -PLATE_Y * 0.5, PLATE_Y * 0.5, Z_PU0, Z_PU1, 'milk', r=0.0012,
            seg=3))

    # ---- радиатор с рёбрами -------------------------------------------
    add(box(PREFIX + 'heatsink_base', BST_X - 0.0230, BST_X + 0.0230,
            -0.0220, 0.0220, Z_HS0, Z_HS1, 'alu', r=0.0010, seg=2))
    bm = bmesh.new()
    for i in range(7):
        bm_box(bm, (BST_X - 0.0180 + i * 0.0060, 0.0, (Z_HS1 + Z_FIN1) * 0.5),
               (0.0022, 0.0420, Z_FIN1 - Z_HS1))
    add(mesh_from_bm(PREFIX + 'heatsink_fins', bm, 'alu', 30.0))

    # ---- монтажный фланец с двумя винтами ------------------------------
    add(box(PREFIX + 'flange', FL_X0, FL_X1, -FL_HY, FL_HY, Z_FL0, Z_FL1,
            'graphite', r=0.0014, seg=2))
    bm = bmesh.new()
    for sy in (-0.0175, 0.0175):
        bm_cyl(bm, (FL_X0 + 0.0042, sy, Z_FL1 - 0.0012),
               (FL_X0 + 0.0042, sy, Z_FL1 + 0.0030), 0.0026, segs=16)
        bm_cyl(bm, (FL_X0 + 0.0042, sy, Z_FL1 - 0.0004),
               (FL_X0 + 0.0042, sy, Z_FL1 + 0.0004), 0.0042, segs=18)
    add(mesh_from_bm(PREFIX + 'flange_screws', bm, 'steel', 42.0))

    # ---- кабельный ввод и пигтейл --------------------------------------
    add(cyl(PREFIX + 'cable_gland', (0.0094, 0.0, 0.0348), (0.0206, 0.0, 0.0348),
            0.0050, 'graphite', vertices=24, bev=0.0005))
    add(cyl(PREFIX + 'cable_gland_nut', (0.0186, 0.0, 0.0348),
            (0.0216, 0.0, 0.0348), 0.0062, 'graphite', vertices=6))
    add(curve_tube(PREFIX + 'pigtail',
                   [(0.0214, 0.0000, 0.0348),
                    (0.0266, 0.0016, 0.0338),
                    (0.0322, 0.0036, 0.0280),
                    (0.0376, 0.0056, 0.0196),
                    (0.0416, 0.0074, 0.0130),
                    (0.0434, 0.0080, 0.0120)], 0.0026, 'dark'))
    add(cyl(PREFIX + 'pigtail_boot', (0.0392, 0.0064, 0.0158),
            (0.0418, 0.0076, 0.0132), 0.0031, 'graphite', vertices=18,
            bev=0.0004))

    # ---- extras --------------------------------------------------------
    for o in parts:
        o['component'] = CID
        if o.type == 'MESH' and o.data.materials:
            o['role'] = o.data.materials[0].name.replace('CJ_', '').rsplit('_', 1)[0]
        o['motion'] = 'none'
        o['amount'] = 0.0
        o['speed'] = 0.0

    bpy.context.view_layer.update()
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


def static_check(objs):
    """motion=none: ни один узел не должен быть способен двигаться."""
    moving, reasons = [], {}
    for o in objs:
        why = []
        ad = o.animation_data
        if ad is not None:
            if ad.action is not None:
                why.append('action')
            if len(ad.drivers):
                why.append('drivers')
            if ad.nla_tracks and any(t.strips for t in ad.nla_tracks):
                why.append('nla')
        if len(getattr(o, 'constraints', ()) or ()):
            why.append('constraint')
        if o.parent is not None:
            why.append('parent:' + o.parent.name)
        if o.type == 'EMPTY':
            why.append('empty')
        if why:
            moving.append(o.name)
            reasons[o.name] = why
    return sorted(moving), sorted(o.name for o in objs if o.name not in moving), reasons


def check(parts):
    bpy.context.view_layer.update()
    objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
    meshes = [o for o in objs if o.type == 'MESH']
    mn, mx = mesh_bbox(meshes)
    size = mx - mn
    center = (mn + mx) * 0.5
    tris = 0
    for o in meshes:
        o.data.calc_loop_triangles()
        tris += len(o.data.loop_triangles)

    skirt = bpy.data.objects[PREFIX + 'skirt']
    ring = bpy.data.objects[PREFIX + 'seat_ring']
    s_mn, s_mx = mesh_bbox([skirt])
    r_mn, r_mx = mesh_bbox([ring])
    skirt_d = min((s_mx - s_mn).x, (s_mx - s_mn).y)
    ring_d = min((r_mx - r_mn).x, (r_mx - r_mn).y)

    moving, static, reasons = static_check(objs)
    passport = (0.090, 0.060, 0.032)

    bbox_ok = bool(0.0850 <= size.x <= 0.0950
                   and size.y <= 0.0555
                   and 0.0300 <= skirt_d <= 0.0340
                   and ring_d <= 0.0361)

    report = {
        'component': CID,
        'code': CODE,
        'nodes': len(objs),
        'mesh_nodes': len(meshes),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_size_mm': [round(v * 1000, 2) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_passport': list(passport),
        'bbox_delta_mm': [round((size[i] - passport[i]) * 1000, 1) for i in range(3)],
        'bbox_rules': {'length_m': [0.085, 0.095], 'width_max_m': 0.055,
                       'skirt_d_m': [0.030, 0.034], 'seat_ring_d_max_m': 0.036},
        'skirt_d': round(skirt_d, 5),
        'seat_ring_d': round(ring_d, 5),
        'bbox_ok': bbox_ok,
        'material_count': len(bpy.data.materials),
        'materials': sorted(m.name for m in bpy.data.materials),
        'motion': 'none',
        'moving_nodes': moving,
        'static_nodes': static,
        'static_node_count': len(static),
        'pivot_ok': bool(len(moving) == 0),
        'pivot_note': ('motion=none: пустышки anim нет, все узлы без родителей, '
                       'без action/драйверов/констрейнтов — вращать нечего'),
        'moving_reasons': reasons,
        'tris': tris,
        'bad_names': sorted(o.name for o in objs if not o.name.startswith(PREFIX)),
        'unprefixed_meshes': sorted(o.name for o in bpy.data.objects
                                    if o.type == 'MESH'
                                    and not o.name.startswith(PREFIX)),
        'reads': ('Читается гильза-вставка: алюминиевая контактная юбка с кольцом '
                  'посадки и датчиком, над ней керамический пакет Пельтье '
                  'и ребристый радиатор'),
    }
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
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
    parts = build()
    rep = check(parts)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['material_count'] >= 4
            and rep['nodes'] >= 8 and not rep['bad_names']
            and rep['glb_bytes'] > 10240):
        raise SystemExit('checks failed')


main()
