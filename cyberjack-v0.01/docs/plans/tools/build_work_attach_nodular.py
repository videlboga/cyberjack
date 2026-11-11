"""Standalone builder: work_attach_nodular (WRK-ATT-04, «Нодулярная насадка»).

Сменный силиконовый наконечник на быстросъёмной посадке: посадочная гильза-цанга
(4 реальных лепестка с зазорами), разрезное кольцо быстросъёма с рычагом,
внутренний стальной сердечник, мягкая силиконовая головка с регулярной сеткой
объёмных нодулей (3 ряда x 4 со сдвигом) и rounded tip. Плиты нет.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_nodular.py

Выход:
  public/models/machine-modules/components/work_attach_nodular.glb

Геометрия (Blender Z-up, метры), продольная ось = X:
  база (посадка) = X-0.065, кончик = X+0.060
  anim-пустышка   = (-0.065, 0, 0) — на продольной оси в основании
  вращаются:     core, core_collar, head, nodules
  статичны:      sleeve, collet_fingers, sleeve_seat, release_ring,
                 ring_knurl, ring_lever, ring_lever_pad, ring_pin,
                 ring_split, size_band, size_pips
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
CID = 'work_attach_nodular'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
X_BASE = -0.0650            # торец посадки
X_SLEEVE_END = -0.0414      # конец тела гильзы
X_FINGER_END = -0.0334      # конец лепестков цанги
X_HEAD0 = -0.0300           # начало силикона
X_TIP = 0.0604
HEAD_R = 0.0186
CORE_R = 0.0050
SLEEVE_R = 0.0177
FLANGE_R = 0.0202
RING_R = 0.0209
NOD_PROT = 0.0055           # выступ нодуля над телом, 5.5 мм
NOD_SKIRT = 0.0115          # радиус мягкой юбки нодуля
NOD_RINGS = 3
NOD_COLS = 4                # 3 x 4 = 12 нодулей (паспорт: 6–12)
NOD_X = (-0.0080, 0.0120, 0.0300)
NOD_ANGLE0 = 0.0

PALETTE = {
    'silicone': (0.855, 0.612, 0.643),
    'silicone_pale': (0.884, 0.672, 0.697),
    'steel': (0.735, 0.741, 0.731),
    'graphite': (0.262, 0.271, 0.290),
    'dark': (0.140, 0.148, 0.165),
    'cyan': (0.620, 0.870, 0.905),
    'ivory': (0.972, 0.965, 0.950),
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
    if 'silicone' in role:
        bsdf.inputs['Roughness'].default_value = 0.62
        bsdf.inputs['Metallic'].default_value = 0.0
    elif role == 'graphite':
        bsdf.inputs['Roughness'].default_value = 0.46
        bsdf.inputs['Metallic'].default_value = 0.35
    elif role == 'dark':
        bsdf.inputs['Roughness'].default_value = 0.55
        bsdf.inputs['Metallic'].default_value = 0.10
    else:
        bsdf.inputs['Roughness'].default_value = 0.40
        bsdf.inputs['Metallic'].default_value = 0.85
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.40
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def bevel(obj, width=0.0012, segments=2, angle=True):
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


def torus(name, loc, major, minor, role, axis='X', segs=40, rings=10):
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


def radial(a):
    """Радиальное направление вокруг оси X: a=0 -> +Z, a=+90deg -> +Y."""
    return Vector((0.0, math.sin(a), math.cos(a)))


def basis(a):
    """3x3: локальные (x, y, z) -> (мировая X, тангенс, радиаль)."""
    d = radial(a)
    t = Vector((0.0, math.cos(a), -math.sin(a)))
    return Matrix((
        (1.0, 0.0, 0.0),
        (0.0, t.y, d.y),
        (0.0, t.z, d.z),
    ))


def revolve(name, profile, role, seg=48, smooth=True, loop=True, a0=None, a1=None):
    """Тело вращения вокруг оси X по профилю [(x, r), ...].

    loop=True  — профиль замкнут (труба/кольцо, торцы-аннулусы);
    loop=False — открытый профиль от заднего торца к концу, торец крышкой,
                 точки с r=0 становятся полюсами (rounded tip).
    a0/a1      — сектор (радианы); при None — полный оборот.
    """
    bm = bmesh.new()
    full = a0 is None
    if full:
        angs = [math.tau * i / seg for i in range(seg)]
    else:
        angs = [a0 + (a1 - a0) * i / seg for i in range(seg + 1)]
    n_a = len(angs)
    rings = []
    for x, r in profile:
        if r <= 1e-6:
            rings.append(('pole', bm.verts.new((x, 0.0, 0.0))))
        else:
            rings.append(('ring', [bm.verts.new((x, r * math.sin(a), r * math.cos(a)))
                                   for a in angs]))

    def link(r0, r1):
        if r0[0] == 'ring' and r1[0] == 'ring':
            a0_, a1_ = r0[1], r1[1]
            for k in range(seg if not full else n_a):
                k2 = (k + 1) % n_a
                bm.faces.new((a0_[k], a0_[k2], a1_[k2], a1_[k]))
        elif r0[0] == 'pole' and r1[0] == 'ring':
            row = r1[1]
            for k in range(n_a):
                bm.faces.new((r0[1], row[k], row[(k + 1) % n_a]))
        elif r0[0] == 'ring' and r1[0] == 'pole':
            row = r0[1]
            for k in range(n_a):
                bm.faces.new((row[k], row[(k + 1) % n_a], r1[1]))

    n = len(rings)
    for i in range(n - 1):
        link(rings[i], rings[i + 1])
    if loop:
        link(rings[-1], rings[0])
    else:
        if rings[0][0] == 'ring':
            bm.faces.new(tuple(reversed(rings[0][1])))
        if rings[-1][0] == 'ring':
            bm.faces.new(tuple(rings[-1][1]))
    if not full and all(r[0] == 'ring' for r in rings):
        bm.faces.new(tuple(r[1][0] for r in rings))
        bm.faces.new(tuple(reversed([r[1][-1] for r in rings])))
    return mesh_from_bm(name, bm, role, smooth)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- статичная посадочная гильза ------------------------------------
    sleeve_profile = [
        (X_BASE, 0.0056),              # внутренняя стенка, зад
        (X_SLEEVE_END, 0.0056),        # внутренняя стенка, перед
        (X_SLEEVE_END, 0.0176),        # передний торец (аннулярная плоскость)
        (-0.0451, SLEEVE_R),
        (-0.0572, SLEEVE_R),
        (-0.0610, FLANGE_R),           # фланец посадки
        (-0.0646, FLANGE_R),
        (-0.0650, FLANGE_R - 0.0032),
    ]
    revolve(PREFIX + 'sleeve', sleeve_profile, 'graphite', seg=44)
    torus(PREFIX + 'sleeve_seat', (-0.0642, 0, 0), 0.0184, 0.0013, 'steel')

    # 4 лепестка цанги как отдельные сектора с зазорами 12°
    finger_profile = [
        (-0.0416, 0.0057),
        (-0.0334, 0.0063),
        (-0.0334, 0.0132),
        (-0.0352, 0.0147),
        (-0.0416, 0.0176),
    ]
    bm = bmesh.new()
    for i in range(4):
        c0 = math.radians(-39.0 + 90.0 * i)
        c1 = math.radians(39.0 + 90.0 * i)
        seg = 7
        angs = [c0 + (c1 - c0) * k / seg for k in range(seg + 1)]
        rings = [[bm.verts.new((x, r * math.sin(a), r * math.cos(a))) for a in angs]
                 for x, r in finger_profile]
        n = len(finger_profile)
        for a_i in range(n):
            b_i = (a_i + 1) % n
            for k in range(seg):
                bm.faces.new((rings[a_i][k], rings[a_i][k + 1],
                              rings[b_i][k + 1], rings[b_i][k]))
        bm.faces.new(tuple(r[0] for r in rings))
        bm.faces.new(tuple(reversed([r[-1] for r in rings])))
    mesh_from_bm(PREFIX + 'collet_fingers', bm, 'graphite', smooth=True)

    # ---- разрезное быстросъёмное кольцо (статично) ---------------------
    ring_profile = [
        (-0.0528, 0.0175),
        (-0.0432, 0.0175),
        (-0.0426, 0.0192),
        (-0.0436, RING_R),
        (-0.0524, RING_R),
        (-0.0534, 0.0192),
    ]
    revolve(PREFIX + 'release_ring', ring_profile, 'steel', seg=44)

    # накатка: 22 радиальных ребра в одном меше
    bm = bmesh.new()
    n_rib = 22
    for i in range(n_rib):
        a = math.tau * i / n_rib
        d = radial(a)
        M = (Matrix.Translation((-0.0480, d.y * 0.0201, d.z * 0.0201))
             @ basis(a).to_4x4()
             @ Matrix.Diagonal((0.0074, 0.0024, 0.0022, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    mesh_from_bm(PREFIX + 'ring_knurl', bm, 'steel', smooth=False)

    # разрез кольца по +Y
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((-0.0480, 0.0206, 0.0))
                          @ Matrix.Diagonal((0.0090, 0.0026, 0.0013, 1.0)))
    mesh_from_bm(PREFIX + 'ring_split', bm, 'dark', smooth=False)

    # рычаг быстросъёма: +Z, с площадкой под палец
    cyl(PREFIX + 'ring_lever',
        (-0.0478, 0.0, 0.0196), (-0.0478, 0.0, 0.0284),
        0.0040, 'steel', vertices=16, bev=0.0012)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((-0.0478, 0.0, 0.0300))
                          @ Matrix.Diagonal((0.0104, 0.0080, 0.0040, 1.0)))
    pad = mesh_from_bm(PREFIX + 'ring_lever_pad', bm, 'graphite', smooth=False)
    select_only(pad)
    bevel(pad, 0.0014, 2)
    cyl(PREFIX + 'ring_pin', (-0.0500, 0.0, 0.0196), (-0.0456, 0.0, 0.0196),
        0.0026, 'graphite', vertices=14)

    # ---- метка размера: полоса + 2 пипса «M» ---------------------------
    revolve(PREFIX + 'size_band',
            [(-0.0596, SLEEVE_R - 0.0003), (-0.0576, SLEEVE_R - 0.0003),
             (-0.0576, 0.0182), (-0.0596, 0.0182)], 'cyan', seg=40)
    bm = bmesh.new()
    for a in (math.radians(38), math.radians(-38)):
        d = radial(a)
        M = (Matrix.Translation((-0.0608, d.y * 0.0179, d.z * 0.0179))
             @ basis(a).to_4x4()
             @ Matrix.Diagonal((0.0026, 0.0026, 0.0018, 1.0)))
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12,
                              radius1=1.0, radius2=0.70, depth=1.0, matrix=M)
    mesh_from_bm(PREFIX + 'size_pips', bm, 'ivory', smooth=True)

    # ---- вращающийся внутренний сердечник ------------------------------
    core = cyl(PREFIX + 'core', (-0.0600, 0, 0), (0.0170, 0, 0), CORE_R,
               'steel', vertices=24, bev=0.0010)
    core_collar = torus(PREFIX + 'core_collar', (-0.0318, 0, 0), 0.0062, 0.0015,
                        'graphite', segs=28)
    rotating += [core, core_collar]

    # ---- силиконовая головка (тело вращения, rounded tip) --------------
    head_profile = [
        (-0.0300, 0.0122),
        (-0.0292, 0.0148),
        (-0.0274, 0.0170),
        (-0.0248, 0.0182),
        (-0.0212, HEAD_R),
        (0.0322, HEAD_R),
        (0.0372, 0.0184),
        (0.0424, 0.0174),
        (0.0476, 0.0156),
        (0.0522, 0.0128),
        (0.0560, 0.0090),
        (0.0586, 0.0048),
        (X_TIP, 0.0),
    ]
    head = revolve(PREFIX + 'head', head_profile, 'silicone', seg=56, loop=False)
    rotating += [head]

    # ---- регулярная сетка нодулей: 3 ряда x 4, со сдвигом 45° ----------
    # Нодуль — формованная «подушка» с плоской касательной юбкой (без гребешка
    # на стыке с телом): z(ρ) = 0.5·(prot+sink)·(1+cos(π·ρ/b)) − sink.
    bm = bmesh.new()
    b = NOD_SKIRT                 # радиус юбки нодуля
    sink = 0.0012                 # юбка уходит в тело (чистое пересечение, без z-fight)
    prof = [0.0, 0.24, 0.44, 0.60, 0.74, 0.86, 1.0]
    nseg = 24
    dome = []
    for t in prof:
        rho = t * b
        w = (NOD_PROT + sink) * 0.5 * (1.0 + math.cos(math.pi * t)) - sink
        dome.append((rho, w))
    for ri, x in enumerate(NOD_X):
        phase = NOD_ANGLE0 + (math.pi / NOD_COLS if ri % 2 else 0.0)
        for k in range(NOD_COLS):
            a = phase + math.tau * k / NOD_COLS
            d = radial(a)
            t = Vector((0.0, math.cos(a), -math.sin(a)))
            rings = []
            for rho, w in dome:
                Rc = HEAD_R + w
                if rho < 1e-9:
                    rings.append(('pole', bm.verts.new(
                        (x, Rc * math.sin(a), Rc * math.cos(a)))))
                    continue
                row = []
                for s in range(nseg):
                    ph = math.tau * s / nseg
                    u, v = rho * math.cos(ph), rho * math.sin(ph)
                    ang = a + v / Rc          # обёртка по цилиндру (arc-length)
                    row.append(bm.verts.new((x + u,
                                             Rc * math.sin(ang),
                                             Rc * math.cos(ang))))
                rings.append(('ring', row))
            for i in range(len(rings) - 1):
                r0, r1 = rings[i], rings[i + 1]
                if r0[0] == 'pole':
                    for s in range(nseg):
                        bm.faces.new((r0[1], r1[1][s], r1[1][(s + 1) % nseg]))
                else:
                    for s in range(nseg):
                        s2 = (s + 1) % nseg
                        bm.faces.new((r0[1][s], r0[1][s2], r1[1][s2], r1[1][s]))
    nodules = mesh_from_bm(PREFIX + 'nodules', bm, 'silicone_pale', smooth=True)
    rotating.append(nodules)

    # ---- anim-пустышка на продольной оси в основании -------------------
    anim = empty(PREFIX + 'anim', (X_BASE, 0.0, 0.0))
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

    nod = bpy.data.objects[PREFIX + 'nodules']
    n_mn, n_mx = mesh_bbox([nod])

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'length_mm': round(size.x * 1000, 1),
        'max_diameter_mm': round(max(size.y, size.z) * 1000, 1),
        'bbox_ok': bool(0.080 <= size.x <= 0.200
                        and 0.020 <= max(size.y, size.z) <= 0.060),
        'nodule_span_mm': [round(v * 1000, 1) for v in (n_mx - n_mn)],
        'nodule_count': NOD_RINGS * NOD_COLS,
        'nodule_grid': f'{NOD_RINGS}x{NOD_COLS}',
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_axis': 'X',
        'anim_children': sorted(o.name for o in kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 4),
        'pivot_ok': bool(pivot_shift < 0.001),
        'materials': sorted(m.name for m in bpy.data.materials),
        'non_children_static': sorted(o.name for o in bpy.data.objects
                                      if o.name.startswith(PREFIX)
                                      and o.type == 'MESH' and o not in kids),
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
    if not path.is_file() or path.stat().st_size < 10000:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['glb_kb'] = round(path.stat().st_size / 1024, 1)
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not rep['bbox_ok'] or not rep['pivot_ok'] or len(rep['materials']) < 4:
        raise SystemExit('checks failed')


main()
