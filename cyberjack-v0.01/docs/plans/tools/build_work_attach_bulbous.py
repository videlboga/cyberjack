"""Standalone builder: work_attach_bulbous (WRK-ATT-06, «Насадка с утолщением»).

Сменный силиконовый наконечник с выраженной луковицей у торца: тонкая шейка
у посадочной гильзы, плавное утолщение (+40 % по диаметру), блант-rounded tip,
литьевой шов и метка максимального диаметра. Стальная цанга с прорезями,
быстросъёмное кольцо с флажком-защёлкой и штифтом, видимый внутренний
стальной сердечник с фланцем, бирюзовая метка размера. Без опорной плиты.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_bulbous.py

Выход:
  public/models/machine-modules/components/work_attach_bulbous.glb

Геометрия (Blender Z-up, метры):
  ось насадки    = X, линия y=0, z=Z0 (насадка лежит на полу, Z0 = R_BULB + 1.3 мм)
  anim-пустышка  = (X_PIVOT, 0, Z0) — на продольной оси, в основании головки
  вращаются: core, core_flange, body, seam, crest_ring, gate
  статичны:  shank, grip, grip_rib, release_ring, release_tab, tab_pin,
             collet_fingers, size_band

Спин: X, 1.0 рад/с (задание; в паспорте 0.85) — вращается только головка,
гильза/цанга/кольцо быстросъёма статичны.
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
CID = 'work_attach_bulbous'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
X_BACK = -0.0750          # торец посадочного хвостовика
X_TIP = 0.0750            # вершина rounded tip
X_REAR = -0.0345          # задний торец силиконового тела (основание головки)
X_PIVOT = X_REAR          # ось спина: основание головки
X_WAIST = -0.0080         # самая узкая точка шейки
X_CREST = 0.0500          # максимальный диаметр (луковица)

R_BASE = 0.0196           # радиус у посадочного торца силикона
R_WAIST = 0.0186          # шейка
R_BULB = 0.0260           # луковица -> Ø 52.0 мм (утолщение +40 %)
Z0 = R_BULB + 0.0013      # ось насадки над полом
SEGMENTS = 56             # сегментов вращения (гладкий силуэт)

MATS = {}

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'steel': (0.725, 0.729, 0.718),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.204, 0.212, 0.231),
    'blush': (0.910, 0.725, 0.749),
    'pale': (0.949, 0.843, 0.851),
    'cyan': (0.750, 0.900, 0.920),
    'red': (0.720, 0.070, 0.060),
}


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
        bsdf.inputs['Roughness'].default_value = 0.42
        bsdf.inputs['Metallic'].default_value = 0.55
    elif role in ('blush', 'pale'):
        # силикон Shore 15A — мягкий полуглянец
        bsdf.inputs['Roughness'].default_value = 0.34
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Specular IOR Level'].default_value = 0.55
    else:
        bsdf.inputs['Roughness'].default_value = 0.55
        bsdf.inputs['Metallic'].default_value = 0.0
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


def sphere(name, loc, radius, role, segs=24, rings=14, scale=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    if scale:
        obj.scale = scale
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


def torus(name, loc, major, minor, role, axis='Z', segs=56, rings=10):
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


def revolve_x(name, profile, role, segments=SEGMENTS, cz=0.0, smooth=True):
    """Тело вращения вокруг оси X из профиля [(x, r), ...] (r=0 -> полюс)."""
    bm = bmesh.new()
    rings = []
    for (x, r) in profile:
        if r <= 1e-6:
            rings.append([bm.verts.new((x, 0.0, cz))])
        else:
            ring = []
            for i in range(segments):
                a = math.tau * i / segments
                ring.append(bm.verts.new((x, math.sin(a) * r, cz + math.cos(a) * r)))
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


# --- профиль силикона ----------------------------------------------------
N_NECK, N_SWELL, N_DOME = 14, 30, 34


def r_neck(x):
    """Шейка: от посадочного торца к минимуму у X_WAIST (плавный вход)."""
    t = (x - (X_REAR + 0.0012)) / (X_WAIST - (X_REAR + 0.0012))
    t = max(0.0, min(1.0, t))
    return lerp(R_BASE, R_WAIST, 0.5 - 0.5 * math.cos(math.pi * t))


def body_profile():
    p = []
    # задний торец: слегка выпуклый, от оси к кромке
    for i in range(0, 6):
        u = i / 5.0
        p.append((X_REAR - 0.0005 * (1.0 - u * u), (R_BASE - 0.0009) * u))
    # скруглённая кромка -> посадка в цангу
    p.append((X_REAR + 0.0002, R_BASE - 0.0003))
    p.append((X_REAR + 0.0012, R_BASE))
    # шейка
    x0 = X_REAR + 0.0012
    for i in range(1, N_NECK + 1):
        x = lerp(x0, X_WAIST, i / N_NECK)
        p.append((x, r_neck(x)))
    # утолщение: степень >1 -> медленный вход и резкий набор у луковицы
    for i in range(1, N_SWELL + 1):
        t = i / N_SWELL
        x = lerp(X_WAIST, X_CREST, t)
        r = R_WAIST + (R_BULB - R_WAIST) * (0.5 - 0.5 * math.cos(math.pi * t)) ** 1.75
        p.append((x, r))
    # rounded tip: блант-купол, горизонтальная касательная на гребне, полюс в торце
    a = X_TIP - X_CREST
    for i in range(1, N_DOME + 1):
        s = i / N_DOME
        r = R_BULB * (1.0 - s ** 2.05) ** 0.58 if s < 1.0 else 0.0
        p.append((X_CREST + a * s, r))
    return p


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ================= посадочный узел (статичен) ======================
    # хвостовик в зонд + рифлёный грип
    cyl(PREFIX + 'shank', (X_BACK, 0, Z0), (-0.0570, 0, Z0), 0.0118,
        'steel', vertices=40, bev=0.0018)
    cyl(PREFIX + 'grip', (-0.0744, 0, Z0), (-0.0668, 0, Z0), 0.0126,
        'graphite', vertices=40, bev=0.0008)
    torus(PREFIX + 'grip_rib', (-0.0706, 0, Z0), 0.0126, 0.0007,
          'graphite', 'X', segs=40, rings=8)

    # быстросъёмное кольцо + флажок-защёлка со штифтом
    cyl(PREFIX + 'release_ring', (-0.0602, 0, Z0), (-0.0520, 0, Z0), 0.0210,
        'graphite', vertices=48, bev=0.0016)
    cube(PREFIX + 'release_tab', (-0.0561, 0.0, Z0 + 0.0229),
         (0.0108, 0.0122, 0.0076), 'graphite', r=0.0018)
    cyl(PREFIX + 'tab_pin', (-0.0561, 0.0, Z0 + 0.0200),
        (-0.0561, 0.0, Z0 + 0.0238), 0.0020, 'steel', vertices=14)

    # посадочная гильза-цанга: базовое кольцо + 6 лепестков с прорезями
    # бирюзовая метка размера — опорное кольцо цанги
    cyl(PREFIX + 'size_band', (-0.0522, 0, Z0), (-0.0496, 0, Z0),
        0.0215, 'cyan', vertices=48, bev=0.0006)

    # 6 лепестков: криволинейные сектора по образующей конуса, с прорезями
    F_X0, F_X1 = -0.0498, -0.0404
    F_R0, F_R1 = 0.0202, 0.0181
    F_TH, F_HALF = 0.0024, math.radians(26.0)
    bm = bmesh.new()
    for k in range(6):
        a_mid = math.tau * k / 6
        vs = {}
        for xi, x in enumerate((F_X0, F_X1)):
            r_out = lerp(F_R0, F_R1, (x - F_X0) / (F_X1 - F_X0))
            for ai, a in enumerate((a_mid - F_HALF, a_mid + F_HALF)):
                for ri, r in enumerate((r_out, r_out - F_TH)):
                    vs[(xi, ai, ri)] = bm.verts.new(
                        (x, math.sin(a) * r, Z0 + math.cos(a) * r))
        bm.faces.new((vs[(0, 0, 0)], vs[(0, 1, 0)], vs[(1, 1, 0)], vs[(1, 0, 0)]))
        bm.faces.new((vs[(0, 0, 1)], vs[(1, 0, 1)], vs[(1, 1, 1)], vs[(0, 1, 1)]))
        bm.faces.new((vs[(0, 0, 0)], vs[(0, 0, 1)], vs[(0, 1, 1)], vs[(0, 1, 0)]))
        bm.faces.new((vs[(1, 0, 0)], vs[(1, 1, 0)], vs[(1, 1, 1)], vs[(1, 0, 1)]))
        bm.faces.new((vs[(0, 0, 0)], vs[(1, 0, 0)], vs[(1, 0, 1)], vs[(0, 0, 1)]))
        bm.faces.new((vs[(0, 1, 0)], vs[(0, 1, 1)], vs[(1, 1, 1)], vs[(1, 1, 0)]))
    mesh_from_bm(PREFIX + 'collet_fingers', bm, 'steel')

    # ================= вращающаяся головка ============================
    # сердечник виден в зазоре между цангой и силиконом (5.9 мм)
    core = cyl(PREFIX + 'core', (-0.0408, 0, Z0), (0.0200, 0, Z0),
               0.0090, 'steel', vertices=32)
    flange = cyl(PREFIX + 'core_flange', (-0.0404, 0, Z0),
                 (-0.0368, 0, Z0), 0.0176, 'steel', vertices=40, bev=0.0012)
    body = revolve_x(PREFIX + 'body', body_profile(), 'blush')
    # меш построен вокруг оси (cz=0) -> начало координат на оси, трансформ чистый
    body.location.z = Z0

    seam = torus(PREFIX + 'seam', (-0.0200, 0, Z0), 0.0187, 0.00035,
                 'pale', 'X', segs=64, rings=8)
    crest = torus(PREFIX + 'crest_ring', (X_CREST - 0.0004, 0, Z0),
                  R_BULB - 0.0002, 0.00045, 'pale', 'X', segs=64, rings=8)
    gate = sphere(PREFIX + 'gate', (X_TIP - 0.0004, 0, Z0), 0.0012, 'pale',
                  segs=20, rings=12, scale=(1.25, 1.0, 1.0))
    rotating += [core, flange, body, seam, crest, gate]

    # ================= анимационная пустышка ===========================
    # на продольной оси, в основании головки (стык цанги и сердечника)
    anim = empty(PREFIX + 'anim', (X_PIVOT, 0.0, Z0))
    bpy.context.view_layer.update()
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in rotating:
            o['rotating'] = False
    anim['spin_axis'] = 'x'
    anim['spin_speed'] = 1.0

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
    static = [o for o in all_mesh if o not in kids]
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    s_mn, s_mx = mesh_bbox(static)
    s_c0 = (s_mn + s_mx) * 0.5

    # pivot-тест: поворот пустышки на 90° вокруг X не должен сдвигать головку
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    st_mn, st_mx = mesh_bbox(static)
    static_shift = ((st_mn + st_mx) * 0.5 - s_c0).length
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    body = bpy.data.objects[PREFIX + 'body']
    b_mn2, b_mx2 = mesh_bbox([body])
    bulb_d = (b_mx2 - b_mn2).y
    waist_d = 2.0 * R_WAIST
    ratio = bulb_d / waist_d

    verts = sum(len(o.data.vertices) for o in all_mesh)
    faces = sum(len(o.data.polygons) for o in all_mesh)

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_objects': len(all_mesh),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'length_x': round(size.x, 5),
        'diameter_max': round(max(size.y, size.z), 5),
        'bulb_diameter': round(bulb_d, 5),
        'waist_diameter': round(waist_d, 5),
        'bulb_ratio': round(ratio, 4),
        'bulb_ratio_ok': bool(1.20 <= ratio <= 1.42),
        'bbox_ok': bool(0.070 <= size.x <= 0.170
                        and 0.020 <= max(size.y, size.z) <= 0.065),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_on_axis': bool(abs(anim.location.y) < 1e-6
                             and abs(anim.location.z - Z0) < 1e-6),
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'kids_bbox_center': [round(v, 5) for v in k_c0],
        'kids_off_axis': round(math.hypot(k_c0.y, k_c0.z - Z0), 9),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.0002),
        'static_shift_under_pivot_mm': round(static_shift * 1000, 5),
        'static_stay_out': sorted(o.name for o in static),
        'static_count': len(static),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
        'verts': verts,
        'faces': faces,
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
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
    if not path.is_file() or path.stat().st_size < 10240:
        raise RuntimeError(f'export too small: {path} ({path.stat().st_size} B)')
    return path


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['bulb_ratio_ok']
            and rep['anim_on_axis'] and rep['material_count'] >= 4
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
