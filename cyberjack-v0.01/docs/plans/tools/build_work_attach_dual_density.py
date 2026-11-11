"""Standalone builder: work_attach_dual_density (WRK-ATT-08,
«Двухплотностная насадка»).

Сменный наконечник с явной двухслойной структурой на продольной оси X:
  - мягкая внешняя оболочка (blush, Shore 10A): полый тонкостенный
    цилиндр с бочкообразным профилем и скруглённым венчиком на торце;
  - плотный внутренний сердечник (pale, Shore 40A): стержень с куполом,
    который выходит из оболочки на торце и обнажается кольцевым пояском
    у основания — граница слоёв читается и у основания, и на торце;
  - тонкие графитовые швы-риски по границе слоёв (основание и торец);
  - стальная посадочная гильза с накаткой, быстросъёмное разрезное
    кольцо с рычагом и байонетными выступами, метка размера (cyan)
    и метка сорта плотности (3 риски).

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_dual_density.py

Выход:
  public/models/machine-modules/components/work_attach_dual_density.glb

Геометрия (Blender Z-up, метры, ось вращения = X, центр оси z=Z0):
  bbox X: -0.0740 .. 0.0740   (длина 0.148)
  bbox Ø: 0.0516 по быстросъёмному кольцу; оболочка Ø 0.0450
  anim-пустышка = (-0.0350, 0, Z0) — на продольной оси в основании насадки
  вращаются: shell, core, seam_base, seam_tip
  статичны:  flange, sleeve, quick_ring, split_slot, lever, pivot_pin,
             bayonet, size_band, grade_marks
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
CID = 'work_attach_dual_density'
PREFIX = CID + '__'

TAU = math.tau

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.040                    # высота продольной оси

# стальная посадка (статична)
FLANGE_X0, FLANGE_X1, FLANGE_R = -0.0740, -0.0700, 0.0250
SLEEVE_X0, SLEEVE_X1, SLEEVE_R = -0.0700, -0.0400, 0.0230
SLEEVE_BORE = 0.0184
RING_X0, RING_X1, RING_R = -0.0672, -0.0560, 0.0258

# оболочка (вращается) — мягкий внешний слой
SHELL_X0 = -0.0338            # срез оболочки у основания
SHELL_X1 = 0.0600             # плоскость торца
SHELL_BORE = 0.0150           # внутренний диаметр оболочки
SHELL_R = 0.0225              # максимальный внешний радиус (бочка)
SHELL_BASE_R = 0.0212         # внешний радиус у основания

# сердечник (вращается) — плотный внутренний слой
CORE_R = 0.0146               # тело сердечника внутри оболочки
CORE_SHOULDER_R = 0.0226      # обнажённый поясок у основания
CORE_SHOULDER_X0 = -0.0398    # от среза гильзы ...
CORE_SHOULDER_X1 = -0.0338    # ... до среза оболочки (6 мм)
CORE_REAR_X = -0.0450         # спрятанный хвост внутри гильзы
CORE_TIP_X = 0.0696           # полюс купола

ANIM_X = -0.0350              # основание насадки, на оси
SPIN_SPEED = 1.0              # рад/с (паспорт: spin X, 1.0)
GRADE_TICKS = 3

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'steel': (0.548, 0.558, 0.568),
    'graphite': (0.300, 0.310, 0.322),
    'dark': (0.180, 0.188, 0.205),
    'blush': (0.848, 0.612, 0.648),      # мягкий внешний слой
    'pale': (0.968, 0.918, 0.888),       # плотный сердечник
    'cyan': (0.200, 0.560, 0.600),
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
    bsdf.inputs['Roughness'].default_value = 0.52
    bsdf.inputs['Metallic'].default_value = 0.0
    if role == 'steel':
        bsdf.inputs['Metallic'].default_value = 0.85
        bsdf.inputs['Roughness'].default_value = 0.50
    elif role in ('graphite', 'dark'):
        bsdf.inputs['Metallic'].default_value = 0.28
        bsdf.inputs['Roughness'].default_value = 0.46
    elif role == 'blush':
        # мягкий силикон 10A: матовый, слегка просвечивающий
        bsdf.inputs['Roughness'].default_value = 0.86
        bsdf.inputs['Subsurface Weight'].default_value = 0.16
        bsdf.inputs['Subsurface Radius'].default_value = (0.012, 0.006, 0.005)
    elif role == 'pale':
        # плотный силикон 40A: гладкий, с заметным блеском
        bsdf.inputs['Roughness'].default_value = 0.30
        bsdf.inputs['Specular IOR Level'].default_value = 0.62
    elif role == 'cyan':
        bsdf.inputs['Roughness'].default_value = 0.38
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.35
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def lathe(name, prof, role, seg=72, closed=False, wave=None, smooth=True):
    """Тело вращения вокруг оси X (центр оси z=Z0).

    prof = [(x, r), ...] от -X к +X.  r == 0 -> полюс.
    closed=True — профиль замкнут (последняя точка соединяется с первой),
    концы не закрываются: так строятся полые оболочки с буртиками.
    wave=(count, amp, phase) — осевые долы (накатка).
    """
    bm = bmesh.new()
    rings = []
    for x, r in prof:
        if r <= 1e-7:
            rings.append([bm.verts.new((x, 0.0, Z0))])
            continue
        ring = []
        for i in range(seg):
            a = TAU * i / seg
            rr = r + (wave[1] * math.cos(wave[0] * a + wave[2]) if wave else 0.0)
            ring.append(bm.verts.new((x, math.sin(a) * rr, Z0 + math.cos(a) * rr)))
        rings.append(ring)

    def bridge(A, B):
        if len(A) == 1 and len(B) == 1:
            return
        if len(A) == 1:
            for k in range(seg):
                bm.faces.new((A[0], B[k], B[(k + 1) % seg]))
        elif len(B) == 1:
            for k in range(seg):
                bm.faces.new((A[k], A[(k + 1) % seg], B[0]))
        else:
            for k in range(seg):
                bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))

    for i in range(len(rings) - 1):
        bridge(rings[i], rings[i + 1])
    if closed:
        bridge(rings[-1], rings[0])
    else:
        if len(rings[0]) > 1:
            bm.faces.new(tuple(reversed(rings[0])))
        if len(rings[-1]) > 1:
            bm.faces.new(tuple(rings[-1]))
    return mesh_from_bm(name, bm, role, smooth)


def box(bm, loc, size, rot=(0.0, 0.0, 0.0)):
    m = (Matrix.Translation(Vector(loc))
         @ Matrix.Rotation(rot[2], 4, 'Z')
         @ Matrix.Rotation(rot[1], 4, 'Y')
         @ Matrix.Rotation(rot[0], 4, 'X')
         @ Matrix.Diagonal(Vector((*size, 1.0))))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


# --- профили -------------------------------------------------------------
def shell_profile():
    """Замкнутый профиль мягкой оболочки: наружная бочка -> венчик ->
    торец (кольцо слоя) -> внутренняя расточка назад к срезу."""
    xs_out = [
        (SHELL_X0, SHELL_BASE_R),
        (-0.0316, 0.0212),
        (-0.0220, 0.0218),
        (-0.0100, 0.0222),
        (0.0030, SHELL_R),
        (0.0160, 0.0225),
        (0.0290, 0.0221),
        (0.0410, 0.0213),
        (0.0500, 0.0204),
        (0.0552, 0.0196),
        (0.0584, 0.0186),
        (0.0600, 0.0172),      # начало скругления венчика
        (0.0606, 0.0159),
        (0.0600, SHELL_BORE),  # кромка торца: кольцо слоя 3.0 мм
        (SHELL_X0 + 0.0002, SHELL_BORE),   # расточка назад к срезу
    ]
    return xs_out


def core_profile():
    """Плотный сердечник: скрытый хвост в гильзе, обнажённый поясок у
    основания, тело внутри оболочки, седло под кромкой торца, купол."""
    prof = [
        (CORE_REAR_X, 0.0),
        (CORE_REAR_X, 0.0126),
        (CORE_REAR_X + 0.0006, 0.0158),
        (CORE_REAR_X + 0.0028, 0.0176),
        (CORE_SHOULDER_X0, CORE_SHOULDER_R),
        (CORE_SHOULDER_X1 + 0.0012, CORE_SHOULDER_R),
        (CORE_SHOULDER_X1, 0.0170),      # плавный переход в тело
        (CORE_SHOULDER_X1 - 0.0002, 0.0152),
        (SHELL_X0 + 0.0008, CORE_R),
        (0.0300, CORE_R),
        (0.0480, CORE_R),
        (0.0552, CORE_R - 0.0002),
    ]
    # седло под кромкой торца оболочки: видимая ступень границы слоёв
    x = 0.0552
    while x < SHELL_X1 + 0.0010:
        u = (x - 0.0552) / (SHELL_X1 + 0.0010 - 0.0552)
        prof.append((x, CORE_R - 0.0002 - 0.0011 * u))
        x += 0.0010
    prof.append((0.0608, CORE_R - 0.0015))
    # купол, выступающий из оболочки (полный, чуть уплощённый)
    dome_len = CORE_TIP_X - 0.0608
    r0 = CORE_R - 0.0015
    n = 26
    for i in range(1, n + 1):
        u = i / n
        prof.append((0.0608 + dome_len * u,
                     r0 * max(0.0, 1.0 - u * u) ** 0.47))
    prof.append((CORE_TIP_X, 0.0))
    return prof


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- мягкая внешняя оболочка (blush) -------------------------------
    shell = lathe(PREFIX + 'shell', shell_profile(), 'blush', seg=84, closed=True)
    shell['shore'] = '10A'
    shell['layer'] = 'outer_soft'
    shell['wall_mm'] = round((SHELL_BASE_R - SHELL_BORE) * 1000, 1)
    rotating.append(shell)

    # ---- плотный сердечник (pale) --------------------------------------
    core = lathe(PREFIX + 'core', core_profile(), 'pale', seg=64)
    core['shore'] = '40A'
    core['layer'] = 'inner_dense'
    core['tip_protrusion_mm'] = round((CORE_TIP_X - SHELL_X1) * 1000, 1)
    rotating.append(core)

    # ---- графитовые швы по границе слоёв -------------------------------
    seam_base = lathe(PREFIX + 'seam_base', [
        (SHELL_X0 - 0.0003, 0.0), (SHELL_X0 - 0.0003, SHELL_BASE_R - 0.0008),
        (SHELL_X0 - 0.0002, SHELL_BASE_R + 0.0004),
        (SHELL_X0 + 0.0004, SHELL_BASE_R + 0.0004),
        (SHELL_X0 + 0.0005, SHELL_BASE_R - 0.0008),
        (SHELL_X0 + 0.0005, 0.0),
    ], 'graphite', seg=84)
    seam_base['role'] = 'layer_boundary_base'
    rotating.append(seam_base)

    seam_tip = lathe(PREFIX + 'seam_tip', [
        (SHELL_X1 - 0.0003, 0.0), (SHELL_X1 - 0.0003, SHELL_BORE - 0.0007),
        (SHELL_X1 - 0.0001, SHELL_BORE - 0.0002),
        (SHELL_X1 + 0.0006, SHELL_BORE - 0.0002),
        (SHELL_X1 + 0.0008, SHELL_BORE - 0.0007),
        (SHELL_X1 + 0.0008, 0.0),
    ], 'graphite', seg=84)
    seam_tip['role'] = 'layer_boundary_tip'
    rotating.append(seam_tip)

    # ---- привалочный фланец (статичен) ---------------------------------
    flange = lathe(PREFIX + 'flange', [
        (FLANGE_X0, 0.0), (FLANGE_X0, 0.0228), (FLANGE_X0 + 0.0005, FLANGE_R),
        (FLANGE_X1 - 0.0010, FLANGE_R), (FLANGE_X1, 0.0236),
        (FLANGE_X1, SLEEVE_R), (FLANGE_X1, 0.0),
    ], 'steel', seg=72)
    flange['rotating'] = False

    # ---- посадочная гильза/цанга с накаткой ----------------------------
    sleeve = lathe(PREFIX + 'sleeve', [
        (SLEEVE_X0, 0.0), (SLEEVE_X0, SLEEVE_R - 0.0014),
        (SLEEVE_X0 + 0.0012, SLEEVE_R),
        (SLEEVE_X1 - 0.0022, SLEEVE_R),
        (SLEEVE_X1 - 0.0010, SLEEVE_R - 0.0006),
        (SLEEVE_X1, SLEEVE_R - 0.0022),
        (SLEEVE_X1, SLEEVE_BORE),
        (SLEEVE_X0 + 0.0010, SLEEVE_BORE),
        (SLEEVE_X0, 0.0),
    ], 'steel', seg=120, wave=(44, 0.00035, 0.0))
    sleeve['rotating'] = False
    sleeve['bore_mm'] = round(SLEEVE_BORE * 2000, 1)

    # ---- быстросъёмное разрезное кольцо --------------------------------
    quick_ring = lathe(PREFIX + 'quick_ring', [
        (RING_X0, 0.0), (RING_X0, SLEEVE_R + 0.0008),
        (RING_X0 + 0.0008, RING_R),
        (RING_X1 - 0.0009, RING_R),
        (RING_X1, SLEEVE_R + 0.0008),
        (RING_X1, 0.0),
    ], 'steel', seg=144, wave=(56, 0.00032, 0.0))
    quick_ring['rotating'] = False
    quick_ring['kind'] = 'quick_release_split_ring'

    # разрез кольца: узкий графитовый паз по +Y
    bm = bmesh.new()
    box(bm, ((RING_X0 + RING_X1) * 0.5, 0.0, Z0 + RING_R - 0.0004),
        (RING_X1 - RING_X0 - 0.0022, 0.0018, 0.0012))
    split_slot = mesh_from_bm(PREFIX + 'split_slot', bm, 'graphite', smooth=False)
    split_slot['rotating'] = False

    # рычаг быстросъёма: стержень с шаровой пятой и осью, поверх кольца
    bm = bmesh.new()
    p0 = Vector((-0.0632, 0.0, Z0 + RING_R + 0.0010))
    p1 = Vector((-0.0436, 0.0, Z0 + SLEEVE_R + 0.0030))
    axis = p1 - p0
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=16,
        radius1=0.0026, radius2=0.0022, depth=axis.length,
        matrix=Matrix.Translation((p0 + p1) * 0.5)
        @ axis.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=18,
        radius1=0.0036, radius2=0.0030, depth=0.0074,
        matrix=Matrix.Translation((-0.0434, 0.0, Z0 + SLEEVE_R + 0.0028))
        @ Matrix.Rotation(math.radians(90), 4, 'Y'))
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=18,
        radius1=0.0029, radius2=0.0029, depth=0.0086,
        matrix=Matrix.Translation((-0.0648, 0.0, Z0 + RING_R - 0.0004))
        @ Matrix.Rotation(math.radians(90), 4, 'X'))
    lever = mesh_from_bm(PREFIX + 'lever', bm, 'graphite')
    lever['rotating'] = False
    lever['kind'] = 'quick_release_lever'

    # байонетные выступы (2 шт., по ±Y)
    bm = bmesh.new()
    for s in (1, -1):
        box(bm, (-0.0520, s * 0.0244, Z0), (0.0082, 0.0044, 0.0062))
    bayonet = mesh_from_bm(PREFIX + 'bayonet', bm, 'graphite')
    bayonet['rotating'] = False

    # буртик-фиксатор: прижимает оболочку и обнажает поясок сердечника
    retainer = lathe(PREFIX + 'retainer', [
        (-0.0406, 0.0), (-0.0406, SLEEVE_R - 0.0014),
        (-0.0402, 0.0243), (-0.0394, 0.0243),
        (-0.0392, 0.0226), (-0.0392, 0.0),
    ], 'steel', seg=72)
    retainer['rotating'] = False
    retainer['kind'] = 'shell_clamp_lip'

    # ---- метка размера (cyan) и метка сорта (3 риски) ------------------
    size_band = lathe(PREFIX + 'size_band', [
        (-0.0472, 0.0), (-0.0472, SLEEVE_R - 0.0010),
        (-0.0468, SLEEVE_R + 0.0011),
        (-0.0432, SLEEVE_R + 0.0011),
        (-0.0428, SLEEVE_R - 0.0010),
        (-0.0428, 0.0),
    ], 'cyan', seg=72)
    size_band['rotating'] = False
    size_band['kind'] = 'size_mark'

    bm = bmesh.new()
    a45 = math.radians(-45.0)
    r_tick = SLEEVE_R - 0.0006
    for k in range(GRADE_TICKS):
        box(bm, (-0.0548 + k * 0.0026, math.sin(a45) * r_tick,
                 Z0 + math.cos(a45) * r_tick),
            (0.0018, 0.0024, 0.0026), rot=(a45, 0.0, 0.0))
    grade_marks = mesh_from_bm(PREFIX + 'grade_marks', bm, 'graphite', smooth=False)
    grade_marks['rotating'] = False
    grade_marks['count'] = GRADE_TICKS

    # ---- анимационная пустышка на оси в основании ----------------------
    anim = empty(PREFIX + 'anim', (ANIM_X, 0.0, Z0))
    anim['spin_axis'] = 'X'
    anim['spin_speed'] = SPIN_SPEED
    anim['layers'] = 2
    anim['layer_outer'] = 'blush/10A'
    anim['layer_inner'] = 'pale/40A'
    bpy.context.view_layer.update()      # иначе matrix_world ещё identity
    for o in rotating:
        parent(o, anim)
        o['rotating'] = True

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


def check(anim):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (c1 - c0).length
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

    shell = bpy.data.objects[PREFIX + 'shell']
    core = bpy.data.objects[PREFIX + 'core']
    s_mn, s_mx = mesh_bbox([shell])
    c_mn, c_mx = mesh_bbox([core])
    shell_d = max(s_mx.y - s_mn.y, s_mx.z - s_mn.z)
    shoulder_mm = (CORE_SHOULDER_X1 - CORE_SHOULDER_X0) * 1000
    tip_overhang_mm = (c_mx.x - s_mx.x) * 1000
    axis_r = max(max(abs(mn.y), abs(mx.y)), abs(mx.z - Z0), abs(mn.z - Z0))

    # толщина мягкого слоя по торцу (видимая граница слоёв)
    wall_tip_mm = (SHELL_R - SHELL_BORE) * 1000 * 0.5 * 2  # = R - bore
    wall_tip_mm = (SHELL_R - SHELL_BORE) * 1000

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'length_mm': round(size.x * 1000, 1),
        'diameter_mm': round(axis_r * 2000, 1),
        'bbox_ok': bool(0.080 <= size.x <= 0.200 and axis_r * 2 <= 0.060),
        'shell_diameter_mm': round(shell_d * 1000, 2),
        'core_tip_overhang_mm': round(tip_overhang_mm, 2),
        'core_shoulder_band_mm': round(shoulder_mm, 2),
        'soft_wall_mm': round(wall_tip_mm, 2),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children': sorted(o.name for o in kids),
        'anim_extras': {'spin_axis': anim.get('spin_axis'),
                        'spin_speed': anim.get('spin_speed'),
                        'layers': anim.get('layers')},
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.0002),
        'materials': sorted(m.name for m in bpy.data.materials),
        'static_meshes': sorted(o.name for o in bpy.data.objects
                                if o.name.startswith(PREFIX)
                                and o.type == 'MESH' and o not in kids),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'tris': sum(len(o.data.loop_triangles) if o.type == 'MESH' else 0
                    for o in bpy.data.objects),
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
    if not path.is_file() or path.stat().st_size < 10 * 1024:
        raise RuntimeError(f'export too small: {path}')
    return path


def main():
    anim, rotating = build()
    rep = check(anim)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok']
            and len(rep['materials']) >= 4
            and rep['core_tip_overhang_mm'] >= 8.0
            and rep['core_shoulder_band_mm'] >= 4.0
            and len(rotating) == 4):
        raise SystemExit('checks failed')


main()
