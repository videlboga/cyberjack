"""Standalone builder: work_attach_tapered (WRK-ATT-05, «Конусная насадка»).

Сменный силиконовый наконечник с выраженным конусным профилем вращения:
толстое основание (Ø46) -> узкий rounded tip (Ø18), посадочная гильза-цанга,
стальное быстросъёмное кольцо с флажком, видимый внутренний сердечник с
фланцем, литьевой шов, бирюзовая метка размера на гильзе и направляющий
шпоночный гребень цанги. Без опорной плиты.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_tapered.py

Выход:
  public/models/machine-modules/components/work_attach_tapered.glb

Геометрия (Blender Z-up, метры):
  ось насадки    = X, линия y=0, z=Z0 (насадка лежит на полу, Z0 = R_BASE)
  anim-пустышка  = (X_PIVOT, 0, Z0) — на продольной оси, в основании головки
  вращаются: core, core_flange, body, seam, gate
  статичны:  mount, grip, release_ring, release_tab, collar, size_band,
             dir_mark

Спин: X, 1.0 рад/с (демо) — вращается только головка/наконечник,
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
CID = 'work_attach_tapered'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
X_BACK = -0.0750          # торец посадочного хвостовика
X_TIP = 0.0757            # вершина rounded tip  -> длина 0.1507
X_PIVOT = -0.0400         # ось спина: основание головки (стык цанги)
X_REAR = -0.0308          # задний торец силиконового тела
X_BASE = -0.0280          # начало конусной образующей (толстое основание)
X_NOSE = 0.0595           # начало скругления торца (узкий конец)
R_BASE = 0.0230           # Ø46 в основании
R_NOSE = 0.0092           # Ø18.4 у носка
Z0 = R_BASE + 0.0013      # ось насадки над полом
SEGMENTS = 64             # сегментов вращения (гладкий силуэт)
N_BODY, N_NOSE = 30, 26
PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'steel': (0.725, 0.729, 0.718),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.204, 0.212, 0.231),
    'blush': (0.910, 0.725, 0.749),
    'pale': (0.949, 0.843, 0.851),
    'cyan': (0.520, 0.840, 0.890),
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
        bsdf.inputs['Roughness'].default_value = 0.34
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Specular IOR Level'].default_value = 0.55
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


def torus(name, loc, major, minor, role, axis='Z', segs=64, rings=8):
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


def revolve_x(name, profile, role, segments=SEGMENTS, cz=Z0, smooth=True):
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


def surface_bar(name, x0, x1, ang, half_angle, height, role, r_of_x,
                steps=24, sink=0.0005):
    """Продольный гребень/метка, лежащая на поверхности вращения.

    Сечение — трапеция: заглублённая база (r-sink) и гребень (r+height)
    на угле +-half_angle вокруг radial(ang). Замкнутая оболочка.
    """
    bm = bmesh.new()
    sections = []
    for i in range(steps + 1):
        x = x0 + (x1 - x0) * i / steps
        rb = r_of_x(x) - sink
        rt = r_of_x(x) + height
        quad = []
        for (da, r) in ((-half_angle, rb), (-half_angle, rt),
                        (half_angle, rt), (half_angle, rb)):
            a = ang + da
            quad.append(bm.verts.new((x, math.sin(a) * r, Z0 + math.cos(a) * r)))
        sections.append(quad)
    for i in range(steps):
        a_, b_ = sections[i], sections[i + 1]
        for k in range(4):
            k2 = (k + 1) % 4
            bm.faces.new((a_[k], a_[k2], b_[k2], b_[k]))
    bm.faces.new(sections[0])
    bm.faces.new(tuple(reversed(sections[-1])))
    return mesh_from_bm(name, bm, role, smooth=True)


# --- профиль конуса ------------------------------------------------------
def r_body(x):
    """Радиус силиконового тела: почти прямая конусная образующая.

    Показатель 0.88 даёт мягкое выпуклое сопряжение у толстого основания
    и почти линейный участок к носку.
    """
    if x <= X_BASE:
        return R_BASE
    if x >= X_NOSE:
        return R_NOSE
    t = (x - X_BASE) / (X_NOSE - X_BASE)
    return R_NOSE + (R_BASE - R_NOSE) * (1.0 - t) ** 0.88


def body_profile():
    p = []
    # задний торец: слегка выпуклый, от оси к кромке
    for i in range(0, 7):
        u = i / 6.0
        p.append((X_REAR - 0.0006 * (1.0 - u * u), 0.0218 * u))
    p.append((X_REAR + 0.0007, 0.0227))
    p.append((X_BASE, R_BASE))
    # конусная образующая
    for i in range(1, N_BODY + 1):
        x = lerp(X_BASE, X_NOSE, i / N_BODY)
        p.append((x, r_body(x)))
    # rounded tip: вытянутый купол, касательная на стыке
    a = X_TIP - X_NOSE
    rn = R_NOSE
    for i in range(1, N_NOSE + 1):
        t = i / N_NOSE
        r = rn * (1.0 - t ** 2.6) ** 0.62 if t < 1.0 else 0.0
        p.append((X_NOSE + a * t, r))
    return p


def collar_r(x):
    return lerp(0.0206, 0.0176, (x + 0.0525) / 0.0093)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ================= посадочный узел (статичен) ======================
    cyl(PREFIX + 'mount', (X_BACK, 0, Z0), (-0.0570, 0, Z0),
        0.0158, 'steel', vertices=40, bev=0.0020)
    cyl(PREFIX + 'grip', (-0.0746, 0, Z0), (-0.0686, 0, Z0), 0.0164,
        'graphite', vertices=40, bev=0.0008)

    # стальное быстросъёмное кольцо + флажок-защёлка
    cyl(PREFIX + 'release_ring', (-0.0600, 0, Z0), (-0.0525, 0, Z0), 0.0218,
        'steel', vertices=48, bev=0.0016)
    cube(PREFIX + 'release_tab', (-0.0562, 0.0, Z0 + 0.0200),
         (0.0110, 0.0130, 0.0088), 'graphite', r=0.0018)

    # посадочная гильза-цанга (конус) + бирюзовая метка размера
    cyl(PREFIX + 'collar', (-0.0525, 0, Z0), (-0.0432, 0, Z0),
        0.0206, 'steel', vertices=48, r2=0.0176, bev=0.0010)
    cyl(PREFIX + 'size_band', (-0.0516, 0, Z0), (-0.0484, 0, Z0),
        0.0208, 'cyan', vertices=48, r2=0.0196, bev=0.0005)
    # направляющий шпоночный гребень цанги (ориентация посадки)
    surface_bar(PREFIX + 'collar_key', -0.0482, -0.0436, -math.pi / 2,
                math.radians(4.5), 0.0008, 'steel', collar_r, steps=8,
                sink=0.0004)

    # ================= вращающаяся головка ============================
    core = cyl(PREFIX + 'core', (-0.0432, 0, Z0), (0.0300, 0, Z0), 0.0090,
               'steel', vertices=32)
    flange = cyl(PREFIX + 'core_flange', (-0.0432, 0, Z0), (-0.0382, 0, Z0),
                 0.0176, 'steel', vertices=40, bev=0.0012)
    body = revolve_x(PREFIX + 'body', body_profile(), 'blush')
    # начало координат меша — на оси, чтобы локальный трансформ был чистым
    for v in body.data.vertices:
        v.co.z -= Z0
    body.location.z = Z0

    seam = torus(PREFIX + 'seam', (-0.0100, 0, Z0), 0.02052, 0.00026,
                 'pale', 'X', segs=72, rings=8)
    gate = cyl(PREFIX + 'gate', (X_TIP - 0.0018, 0, Z0), (X_TIP + 0.0002, 0, Z0),
               0.0013, 'pale', vertices=16, bev=0.0002)
    rotating += [core, flange, body, seam, gate]

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


def body_radius_at_slice(body, x0, x1):
    vals = [math.hypot(v.co.y, v.co.z) for v in body.data.vertices
            if x0 <= v.co.x <= x1]
    return max(vals) if vals else 0.0


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

    body = bpy.data.objects[PREFIX + 'body']
    r_base = body_radius_at_slice(body, X_BASE - 0.002, X_BASE + 0.006)
    r_nose = body_radius_at_slice(body, X_NOSE - 0.006, X_NOSE + 0.002)

    tri = sum(len(o.data.polygons) for o in all_mesh)
    verts = sum(len(o.data.vertices) for o in all_mesh)

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'mesh_objects': len(all_mesh),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'length_x_mm': round(size.x * 1000, 2),
        'diameter_max_mm': round(max(size.y, size.z) * 1000, 2),
        'bbox_ok': bool(0.080 <= size.x <= 0.180
                        and 0.015 <= max(size.y, size.z) <= 0.050),
        'body_radius_base_mm': round(r_base * 1000, 2),
        'body_radius_nose_mm': round(r_nose * 1000, 2),
        'taper_ratio': round(r_base / r_nose, 3) if r_nose else 0.0,
        'taper_ok': bool(r_nose > 0 and r_base / r_nose >= 1.8),
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
    if not path.is_file() or path.stat().st_size < 20000:
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
            and rep['taper_ok'] and rep['material_count'] >= 4
            and not rep['bad_names']):
        raise SystemExit('checks failed')


main()
