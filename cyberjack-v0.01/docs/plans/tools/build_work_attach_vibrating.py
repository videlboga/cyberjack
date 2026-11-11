"""Standalone builder: work_attach_vibrating (WRK-ATT-09, «Вибрирующая насадка»).

Сменный силиконовый наконечник с внутренним вибрирующим мотором: в продольном
окне на верхней стороне виден стальной эксцентрик с тёмным противовесом под
прозрачной панелью и двумя рёбрами-скобами. Посадочная гильза с 4 лепестками
цанги, разрезное кольцо быстросъёма с рычагом, кнопка-контакт, циановая метка
размера и метка вибрации. Плиты нет.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_vibrating.py

Выход:
  public/models/machine-modules/components/work_attach_vibrating.glb

Геометрия (Blender Z-up, метры), продольная ось = X:
  база (торец посадки) = X-0.074, кончик = X+0.0632
  anim-пустышка         = (X_HEAD0, 0, 0) — на продольной оси, в основании головки
  вибрируют/вращаются:  head_rear, head_window, head_tip, window_pane,
                        window_bezel, window_ribs, cavity_liner, motor_body,
                        motor_cap, shaft, eccentric, eccentric_hub, motor_led,
                        vibe_band
  статичны:             sleeve, sleeve_seat, collet_fingers, release_ring,
                        ring_knurl, ring_split, ring_lever, ring_lever_pad,
                        ring_pin, size_band, size_pips, contact_collar,
                        contact_button
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
CID = 'work_attach_vibrating'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
X_BASE = -0.0740            # торец посадочной гильзы
X_SLEEVE_END = -0.0390      # передний конец тела гильзы
X_HEAD0 = -0.0330           # задний торец силиконового наконечника (шпигот)
X_TIP = 0.0632              # вершина rounded tip
R_HEAD = 0.0178             # максимальный радиус силикона -> Ø 35.6 мм
R_CAVITY = 0.0148           # внутренняя стенка кармана мотора (стенка 3.0 мм)
XW0, XW1 = -0.0010, 0.0310  # продольное окно над эксцентриком
WIN_HALF = math.radians(33.0)
SLEEVE_R = 0.0166
FLANGE_R = 0.0194
RING_R = 0.0212
ECC_OFF = 0.0048            # смещение оси эксцентрика от продольной оси
SEG = 56

PALETTE = {
    'silicone': (0.855, 0.612, 0.643),
    'steel': (0.735, 0.741, 0.731),
    'graphite': (0.262, 0.271, 0.290),
    'dark': (0.140, 0.148, 0.165),
    'cyan': (0.620, 0.870, 0.905),
    'ivory': (0.972, 0.965, 0.950),
    'glass': (0.780, 0.885, 0.910),
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
    if role == 'silicone':
        bsdf.inputs['Roughness'].default_value = 0.62
        bsdf.inputs['Metallic'].default_value = 0.0
    elif role == 'graphite':
        bsdf.inputs['Roughness'].default_value = 0.46
        bsdf.inputs['Metallic'].default_value = 0.35
    elif role == 'dark':
        bsdf.inputs['Roughness'].default_value = 0.55
        bsdf.inputs['Metallic'].default_value = 0.10
    elif role == 'glass':
        bsdf.inputs['Roughness'].default_value = 0.02
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Alpha'].default_value = 0.12
        bsdf.inputs['IOR'].default_value = 1.49
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
        if hasattr(m, 'use_backface_culling'):
            m.use_backface_culling = False
    elif role == 'cyan':
        bsdf.inputs['Roughness'].default_value = 0.40
        bsdf.inputs['Metallic'].default_value = 0.0
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.40
    else:  # steel / ivory
        bsdf.inputs['Roughness'].default_value = 0.40
        bsdf.inputs['Metallic'].default_value = 0.85 if role == 'steel' else 0.0
    m.diffuse_color = (*color, 1.0 if role != 'glass' else 0.30)
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


def cube(name, loc, size, role, r=0.0014, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        select_only(obj)
        bevel(obj, r)
    return apply(obj, role)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, bev=0.0):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius,
                                        depth=d.length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    if bev > 0:
        select_only(obj)
        bevel(obj, bev)
    return apply(obj, role, smooth)


def torus(name, loc, major, minor, role, axis='X', segs=48, rings=10):
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


def revolve(name, profile, role, seg=SEG, smooth=True, loop=True, a0=None, a1=None):
    """Тело вращения вокруг оси X по профилю [(x, r), ...].

    loop=True  — профиль замкнут (труба/кольцо, торцы-аннулусы);
    loop=False — открытый профиль от заднего торца к концу, торец крышкой,
                 точки с r=0 становятся полюсами (rounded tip);
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
            for k in range(n_a if full else seg):
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


def add_sector_solid(bm, profile, a0, a1, seg=10, dy=0.0, dz=0.0):
    """Сектор замкнутого профиля (x, r) вокруг оси X со смещением центра."""
    angs = [a0 + (a1 - a0) * k / seg for k in range(seg + 1)]
    rings = [[bm.verts.new((x, dy + r * math.sin(a), dz + r * math.cos(a)))
              for a in angs] for x, r in profile]
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        for k in range(seg):
            bm.faces.new((rings[i][k], rings[i][k + 1],
                          rings[j][k + 1], rings[j][k]))
    bm.faces.new(tuple(r[0] for r in rings))
    bm.faces.new(tuple(reversed([r[-1] for r in rings])))


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ================= статичная посадочная гильза ======================
    sleeve_profile = [
        (X_BASE, 0.0122),            # внутренняя стенка, зад
        (X_SLEEVE_END, 0.0122),     # внутренняя стенка, перед
        (X_SLEEVE_END, 0.0154),     # передний торец (аннулярная плоскость)
        (-0.0430, SLEEVE_R),
        (-0.0610, SLEEVE_R),
        (-0.0676, FLANGE_R),        # фланец посадки
        (-0.0730, FLANGE_R),
        (-0.0740, 0.0170),
    ]
    revolve(PREFIX + 'sleeve', sleeve_profile, 'graphite', seg=48)
    torus(PREFIX + 'sleeve_seat', (-0.0734, 0, 0), 0.0180, 0.0012, 'steel')

    # 4 лепестка цанги отдельными секторами с зазорами 12°
    finger_profile = [
        (-0.0390, 0.0126),
        (-0.0276, 0.0126),
        (-0.0258, 0.0138),
        (-0.0264, 0.0174),
        (-0.0292, 0.0166),
        (-0.0390, 0.0166),
    ]
    bm = bmesh.new()
    for i in range(4):
        c = math.radians(90.0 * i)
        add_sector_solid(bm, finger_profile, c - math.radians(39.0),
                         c + math.radians(39.0), seg=8)
    mesh_from_bm(PREFIX + 'collet_fingers', bm, 'graphite', smooth=True)

    # ================= разрезное кольцо быстросъёма =====================
    ring_profile = [
        (-0.0530, 0.0173),
        (-0.0418, 0.0173),
        (-0.0410, 0.0190),
        (-0.0422, RING_R),
        (-0.0526, RING_R),
        (-0.0536, 0.0190),
    ]
    revolve(PREFIX + 'release_ring', ring_profile, 'steel', seg=48)

    # накатка: 22 радиальных ребра в одном меше
    bm = bmesh.new()
    n_rib = 22
    for i in range(n_rib):
        a = math.tau * i / n_rib
        d = radial(a)
        M = (Matrix.Translation((-0.0478, d.y * 0.0206, d.z * 0.0206))
             @ basis(a).to_4x4()
             @ Matrix.Diagonal((0.0072, 0.0024, 0.0022, 1.0)))
        bmesh.ops.create_cube(bm, size=1.0, matrix=M)
    mesh_from_bm(PREFIX + 'ring_knurl', bm, 'steel', smooth=False)

    # разрез кольца по +Y
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0, matrix=Matrix.Translation((-0.0478, 0.0212, 0.0))
                          @ Matrix.Diagonal((0.0094, 0.0026, 0.0014, 1.0)))
    mesh_from_bm(PREFIX + 'ring_split', bm, 'dark', smooth=False)

    # рычаг быстросъёма: +Z, с площадкой под палец
    cyl(PREFIX + 'ring_lever', (-0.0476, 0.0, 0.0200), (-0.0476, 0.0, 0.0292),
        0.0040, 'steel', vertices=16, bev=0.0012)
    cube(PREFIX + 'ring_lever_pad', (-0.0476, 0.0, 0.0308),
         (0.0104, 0.0082, 0.0042), 'graphite', r=0.0014)
    cyl(PREFIX + 'ring_pin', (-0.0502, 0.0, 0.0206), (-0.0452, 0.0, 0.0206),
        0.0026, 'graphite', vertices=14)

    # ================= метка размера: циановая полоса + 2 пипса =========
    revolve(PREFIX + 'size_band',
            [(-0.0700, 0.0196), (-0.0682, 0.0196),
             (-0.0682, 0.0202), (-0.0700, 0.0202)], 'cyan', seg=44)
    bm = bmesh.new()
    for a in (math.radians(-150), math.radians(-175)):
        d = radial(a)
        M = (Matrix.Translation((-0.0691, d.y * 0.0204, d.z * 0.0204))
             @ basis(a).to_4x4()
             @ Matrix.Diagonal((0.0026, 0.0028, 0.0016, 1.0)))
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=12,
                              radius1=1.0, radius2=0.70, depth=1.0, matrix=M)
    mesh_from_bm(PREFIX + 'size_pips', bm, 'ivory', smooth=True)

    # ================= кнопка-контакт на гильзе (-Y) ====================
    cyl(PREFIX + 'contact_collar', (-0.0588, -0.0158, 0.0), (-0.0588, -0.0186, 0.0),
        0.0062, 'graphite', vertices=20, bev=0.0012)
    cyl(PREFIX + 'contact_button', (-0.0588, -0.0182, 0.0), (-0.0588, -0.0212, 0.0),
        0.0042, 'cyan', vertices=20, bev=0.0010)

    # ================= силиконовый наконечник ===========================
    # задняя часть: шпигот в цанге + мягкая юбка (сплошное тело вращения)
    head_rear_profile = [
        (X_HEAD0, 0.0122),
        (-0.0286, 0.0122),
        (-0.0270, 0.0152),
        (-0.0244, 0.0168),
        (-0.0206, 0.0177),
        (-0.0170, R_HEAD),
        (XW0, R_HEAD),
    ]
    head_rear = revolve(PREFIX + 'head_rear', head_rear_profile, 'silicone',
                        seg=SEG, loop=False)
    rotating.append(head_rear)

    # секция с окном: трубчатый сектор с толщиной стенки 5.2 мм
    head_window = revolve(PREFIX + 'head_window',
                          [(XW0, R_CAVITY), (XW1, R_CAVITY),
                           (XW1, R_HEAD), (XW0, R_HEAD)],
                          'silicone', seg=44, loop=True,
                          a0=WIN_HALF, a1=math.tau - WIN_HALF)
    rotating.append(head_window)

    # передняя часть: конус к rounded tip
    head_tip_profile = [
        (XW1, R_HEAD),
        (0.0400, 0.0174),
        (0.0450, 0.0164),
        (0.0495, 0.0150),
        (0.0535, 0.0128),
        (0.0570, 0.0100),
        (0.0598, 0.0068),
        (0.0618, 0.0036),
        (X_TIP, 0.0),
    ]
    head_tip = revolve(PREFIX + 'head_tip', head_tip_profile, 'silicone',
                       seg=SEG, loop=False)
    rotating.append(head_tip)

    # прозрачная панель окна (поликарбонат), вровень с силиконом
    pane = revolve(PREFIX + 'window_pane',
                   [(XW0 + 0.0014, 0.01708), (XW1 - 0.0014, 0.01708),
                    (XW1 - 0.0014, 0.01792), (XW0 + 0.0014, 0.01792)],
                   'glass', seg=20, loop=True,
                   a0=math.radians(-31.0), a1=math.radians(31.0))
    rotating.append(pane)

    # рамка окна: два тёмных пояса по краям + 2 ребра-скобы поверх панели
    bm = bmesh.new()
    for x0 in (XW0 + 0.0002, XW1 - 0.0020):
        add_sector_solid(bm,
                         [(x0, 0.01786), (x0 + 0.0018, 0.01786),
                          (x0 + 0.0018, 0.01846), (x0, 0.01846)],
                         math.radians(-33.4), math.radians(33.4), seg=14)
    bezel = mesh_from_bm(PREFIX + 'window_bezel', bm, 'dark')
    rotating.append(bezel)

    bm = bmesh.new()
    for xc in (0.0072, 0.0226):
        add_sector_solid(bm,
                         [(xc - 0.0013, 0.01770), (xc + 0.0013, 0.01770),
                          (xc + 0.0013, 0.01855), (xc - 0.0013, 0.01855)],
                         math.radians(-32.2), math.radians(32.2), seg=12)
    rotating.append(mesh_from_bm(PREFIX + 'window_ribs', bm, 'graphite'))

    # тёмная обкладка кармана: контраст для эксцентрика
    bm = bmesh.new()
    add_sector_solid(bm,
                     [(XW0 - 0.0006, 0.01400), (XW1 + 0.0006, 0.01400),
                      (XW1 + 0.0006, 0.01460), (XW0 - 0.0006, 0.01460)],
                     math.radians(46.0), math.radians(314.0), seg=32)
    rotating.append(mesh_from_bm(PREFIX + 'cavity_liner', bm, 'dark'))

    # ================= мотор и эксцентрик внутри кармана =================
    rotating.append(cyl(PREFIX + 'motor_body', (-0.0050, 0, 0), (0.0076, 0, 0),
                        0.0122, 'dark', vertices=32, bev=0.0012))
    rotating.append(cyl(PREFIX + 'motor_cap', (0.0076, 0, 0), (0.0102, 0, 0),
                        0.0114, 'graphite', vertices=32, bev=0.0010))
    rotating.append(cyl(PREFIX + 'shaft', (0.0096, 0, 0), (0.0294, 0, 0),
                        0.0022, 'steel', vertices=16))
    # собственно эксцентрик: массивный диск на смещённой оси + ступица
    rotating.append(cyl(PREFIX + 'eccentric',
                        (0.0098, 0, ECC_OFF), (0.0264, 0, ECC_OFF),
                        0.0080, 'steel', vertices=28, bev=0.0008))
    rotating.append(cyl(PREFIX + 'eccentric_hub',
                        (0.0092, 0, 0), (0.0270, 0, 0),
                        0.0034, 'graphite', vertices=20, bev=0.0006))
    # циановая LED-метка вибрации на задней стенке кармана, видна в окне
    rotating.append(torus(PREFIX + 'motor_led', (0.0012, 0, 0), 0.0116, 0.0011,
                          'cyan', segs=32, rings=8))

    # ================= циановая метка вибрации на головке ================
    rotating.append(revolve(PREFIX + 'vibe_band',
                            [(0.0338, 0.01755), (0.0354, 0.01745),
                             (0.0354, 0.01815), (0.0338, 0.01825)],
                            'cyan', seg=44))

    # ================= anim-пустышка на продольной оси в основании =======
    anim = empty(PREFIX + 'anim', (X_HEAD0, 0.0, 0.0))
    anim['motion'] = 'vibrate'
    anim['axis'] = 'x'
    anim['amount'] = 0.003
    anim['speed'] = 28
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
    # 4 шага по 90°: суммарная ошибка bbox после полного оборота
    spin_err = 0.0
    a0_, b0_ = k_mn.copy(), k_mx.copy()
    for step in (180, 270, 360):
        anim.rotation_euler = (math.radians(step), 0, 0)
        bpy.context.view_layer.update()
        a1_, b1_ = mesh_bbox(kids)
        spin_err = max(spin_err,
                       max(abs(a1_[i] - a0_[i]) for i in range(3))
                       + max(abs(b1_[i] - b0_[i]) for i in range(3)))
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    # эксцентрик действительно смещён от оси
    ecc = bpy.data.objects[PREFIX + 'eccentric']
    e_mn, e_mx = mesh_bbox([ecc])
    e_center = (e_mn + e_mx) * 0.5
    ecc_offset = math.hypot(e_center.y, e_center.z)

    # тело без рычага: диаметр по головке и кольцу
    body = [bpy.data.objects[PREFIX + 'head_rear'],
            bpy.data.objects[PREFIX + 'head_tip'],
            bpy.data.objects[PREFIX + 'release_ring']]
    bb_mn, bb_mx = mesh_bbox(body)
    body_dia = max(bb_mx.y - bb_mn.y, bb_mx.z - bb_mn.z)

    pane = bpy.data.objects[PREFIX + 'window_pane']
    p_mn, p_mx = mesh_bbox([pane])
    glass_ok = any(m.name.startswith('CJ_glass') for m in pane.data.materials)

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
        'body_diameter_mm': round(body_dia * 1000, 1),
        'bbox_ok': bool(0.080 <= size.x <= 0.180
                        and body_dia <= 0.050
                        and size.y <= 0.060 and size.z <= 0.060),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_axis': 'X',
        'anim_motion': anim.get('motion'),
        'anim_amount': anim.get('amount'),
        'anim_speed': anim.get('speed'),
        'anim_on_axis': bool(abs(anim.location.y) < 1e-9
                             and abs(anim.location.z) < 1e-9),
        'anim_children': sorted(o.name for o in kids),
        'anim_children_count': len(kids),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 4),
        'pivot_ok': bool(pivot_shift < 0.0015),
        'spin_bbox_error_mm': round(spin_err * 1000, 3),
        'window_mm': [round((XW1 - XW0) * 1000, 1),
                      round(math.degrees(WIN_HALF) * 2, 1)],
        'pane_span_mm': [round((p_mx.x - p_mn.x) * 1000, 1)],
        'pane_glass_ok': bool(glass_ok),
        'eccentric_offset_mm': round(ecc_offset * 1000, 2),
        'eccentric_ok': bool(ecc_offset > 0.003),
        'materials': sorted(m.name for m in bpy.data.materials),
        'material_count': len(bpy.data.materials),
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
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['anim_on_axis']
            and rep['material_count'] >= 4 and rep['eccentric_ok']
            and rep['pane_glass_ok']):
        raise SystemExit('checks failed')


main()
