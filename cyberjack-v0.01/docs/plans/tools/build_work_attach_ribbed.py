"""Standalone builder: work_attach_ribbed (WRK-ATT-02, «Ребристая насадка»).

Сменная силиконовая насадка на продольной оси X: 10 кольцевых рёбер
мягкого профиля (латентная поверхность, не диски), скруглённый торец,
стальная посадочная гильза с буртиком-фиксатором, быстросъёмное
кольцо с защёлкой и байонетными выступами, внутренний сердечник,
метка размера и метка направления.

Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_attach_ribbed.py

Выход:
  public/models/machine-modules/components/work_attach_ribbed.glb

Геометрия (Blender Z-up, метры, ось вращения = X, центр оси z=Z0):
  bbox X: -0.0740 .. 0.0590  (длина 0.133)
  bbox Ø: 0.054 (по буртику), рёбра Ø 0.0472, тело Ø 0.0388
  anim-пустышка = (-0.0310, 0, Z0) — на продольной оси в основании насадки
  вращаются: core, head, ribs
  статичны:  sleeve, retainer, flange, collar, latch, bayonet,
             size_band, dir_mark
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
CID = 'work_attach_ribbed'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
Z0 = 0.040                  # высота продольной оси

# стальная посадка (статична)
FLANGE_X0, FLANGE_X1, FLANGE_R = -0.0740, -0.0704, 0.0270
COLLAR_X0, COLLAR_X1, COLLAR_R = -0.0704, -0.0552, 0.0234
SLEEVE_X0, SLEEVE_X1, SLEEVE_R = -0.0552, -0.0300, 0.0222
RETAINER_X0, RETAINER_X1, RETAINER_R = -0.0300, -0.0258, 0.0234

# силикон (вращается)
HEAD_X0, HEAD_X1 = -0.0330, 0.0575
HEAD_R = 0.0198
TIP_X = 0.0415

RIBS = 10
RIB_X0, RIB_X1 = -0.0290, 0.0430
RIB_PITCH = (RIB_X1 - RIB_X0) / RIBS
RIB_AMP = 0.0020           # амплитуда синусоиды вокруг середины
RIB_LIFT = 0.00215         # середина над телом: впадина ~касательна тела
RIB_EDGE = 0.0018          # заглубление торцов оболочки в тело

CORE_R = 0.0072

ANIM_X = -0.0310           # основание насадки, на оси
SPIN_SPEED = 1.2          # рад/с

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'steel': (0.615, 0.627, 0.632),
    'graphite': (0.300, 0.310, 0.322),
    'dark': (0.180, 0.188, 0.205),
    'blush': (0.885, 0.760, 0.775),
    'pale': (0.925, 0.820, 0.830),
    'cyan': (0.200, 0.520, 0.560),
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
        bsdf.inputs['Metallic'].default_value = 0.55
        bsdf.inputs['Roughness'].default_value = 0.36
    elif role in ('graphite', 'dark'):
        bsdf.inputs['Metallic'].default_value = 0.30
        bsdf.inputs['Roughness'].default_value = 0.48
    if role in ('pale', 'blush'):
        bsdf.inputs['Roughness'].default_value = 0.42       # силикон
        bsdf.inputs['Subsurface Weight'].default_value = 0.10
    if role == 'cyan':
        bsdf.inputs['Roughness'].default_value = 0.40
    m.diffuse_color = (*color, 1.0)
    MATS[role] = m
    return m


def apply(obj, role, smooth=False):
    obj.data.materials.append(mat(role))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
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


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def lathe(name, prof, role, seg=72, smooth=True, wave=None):
    """Тело вращения вокруг оси X (z=Z0). prof = [(x, r), ...] от -X к +X.

    r == 0 -> полюс. wave=(count, amp, phase) даёт осевые долы (накатка).
    """
    bm = bmesh.new()
    rings = []
    for x, r in prof:
        if r <= 1e-7:
            rings.append([bm.verts.new((x, 0.0, Z0))])
            continue
        ring = []
        for i in range(seg):
            a = math.tau * i / seg
            rr = r + (wave[1] * math.cos(wave[0] * a + wave[2]) if wave else 0.0)
            ring.append(bm.verts.new((x, math.sin(a) * rr, Z0 + math.cos(a) * rr)))
        rings.append(ring)
    for i in range(len(rings) - 1):
        A, B = rings[i], rings[i + 1]
        if len(A) == 1 and len(B) == 1:
            continue
        if len(A) == 1:
            for k in range(seg):
                bm.faces.new((A[0], B[k], B[(k + 1) % seg]))
        elif len(B) == 1:
            for k in range(seg):
                bm.faces.new((A[k], A[(k + 1) % seg], B[0]))
        else:
            for k in range(seg):
                bm.faces.new((A[k], A[(k + 1) % seg], B[(k + 1) % seg], B[k]))
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
def head_r(x):
    """Внешний радиус силиконового тела в точке x."""
    if x <= TIP_X:
        t = max(0.0, min(1.0, (x - HEAD_X0) / (TIP_X - HEAD_X0)))
        return HEAD_R - 0.0009 * t
    u = max(0.0, min(1.0, (x - TIP_X) / (HEAD_X1 - TIP_X)))
    return (HEAD_R - 0.0009) * max(0.0, 1.0 - u * u) ** 0.62


def rib_edge_env(x):
    """Окно 0..1: торцы оболочки рёбер уходят внутрь тела."""
    t = min(x - RIB_X0, RIB_X1 - x) / RIB_EDGE
    if t >= 1.0:
        return 1.0
    t = max(0.0, t)
    return 0.5 - 0.5 * math.cos(math.pi * t)


def rib_wave(x):
    """Непрерывная косинусоида: 10 мягких гребней и впадин, без острых кромок."""
    return math.cos(math.tau * (x - RIB_X0 - RIB_PITCH * 0.5) / RIB_PITCH)


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- вращающийся сердечник -----------------------------------------
    core = lathe(PREFIX + 'core', [
        (-0.0500, 0.0), (-0.0500, 0.0090), (-0.0490, 0.0106),
        (-0.0452, 0.0106), (-0.0440, CORE_R),
        (0.0420, CORE_R), (0.0452, 0.0064), (0.0472, 0.0044),
        (0.0486, 0.0),
    ], 'steel', seg=40)
    rotating.append(core)

    # ---- силиконовое тело (гладкая основа + скруглённый торец) ---------
    prof = [(-0.0330, 0.0), (-0.0330, 0.0150), (-0.0327, 0.0188),
            (-0.0318, 0.0200)]
    x = -0.0310
    while x < TIP_X - 1e-6:
        prof.append((x, head_r(x)))
        x += 0.0014
    for i in range(1, 33):
        u = i / 32.0
        prof.append((TIP_X + u * (HEAD_X1 - TIP_X),
                     head_r(TIP_X + u * (HEAD_X1 - TIP_X))))
    prof.append((HEAD_X1, 0.0))
    head = lathe(PREFIX + 'head', prof, 'pale', seg=72)
    rotating.append(head)

    # ---- кольцевые рёбра: единая мягкая гофрированная оболочка ----------
    rprof = [(RIB_X0, 0.0),
             (RIB_X0, head_r(RIB_X0) - RIB_EDGE)]
    n = 240
    for i in range(1, n):
        x = RIB_X0 + (RIB_X1 - RIB_X0) * i / n
        e = rib_edge_env(x)
        r = head_r(x) - RIB_EDGE + (RIB_EDGE + RIB_LIFT + RIB_AMP * rib_wave(x)) * e
        rprof.append((x, r))
    rprof += [(RIB_X1, head_r(RIB_X1) - RIB_EDGE),
              (RIB_X1, 0.0)]
    ribs = lathe(PREFIX + 'ribs', rprof, 'blush', seg=72)
    ribs['rib_count'] = RIBS
    rotating.append(ribs)

    # ---- посадочная гильза (статична) -----------------------------------
    sleeve = lathe(PREFIX + 'sleeve', [
        (SLEEVE_X0, 0.0), (SLEEVE_X0, 0.0206), (SLEEVE_X0 + 0.0007, SLEEVE_R),
        (-0.0466, SLEEVE_R), (-0.0452, 0.0210), (-0.0440, SLEEVE_R),
        (-0.0322, SLEEVE_R), (-0.0310, 0.0226), (SLEEVE_X1, 0.0226),
        (SLEEVE_X1, 0.0),
    ], 'steel', seg=64)
    sleeve['rotating'] = False

    # буртик-фиксатор силикона
    retainer = lathe(PREFIX + 'retainer', [
        (RETAINER_X0, 0.0), (RETAINER_X0, 0.0228), (RETAINER_X0 + 0.0006, RETAINER_R),
        (RETAINER_X1 - 0.0011, RETAINER_R), (RETAINER_X1, 0.0227),
        (RETAINER_X1, 0.0200), (RETAINER_X1, 0.0),
    ], 'steel', seg=64)
    retainer['rotating'] = False

    # задний буртик (привалочная плоскость к зонду)
    flange = lathe(PREFIX + 'flange', [
        (FLANGE_X0, 0.0), (FLANGE_X0, 0.0244), (FLANGE_X0 + 0.0006, FLANGE_R),
        (FLANGE_X1 - 0.0012, FLANGE_R), (FLANGE_X1, 0.0240),
        (FLANGE_X1, 0.0210), (FLANGE_X1, 0.0),
    ], 'steel', seg=64)
    flange['rotating'] = False

    # ---- быстросъёмное кольцо с накаткой --------------------------------
    collar = lathe(PREFIX + 'collar', [
        (COLLAR_X0, 0.0), (COLLAR_X0, 0.0212), (COLLAR_X0 + 0.0008, 0.0228),
        (-0.0690, COLLAR_R), (-0.0566, COLLAR_R), (-0.0558, 0.0226),
        (COLLAR_X1, 0.0216), (COLLAR_X1, 0.0),
    ], 'graphite', seg=144, wave=(36, 0.00035, 0.0))
    collar['rotating'] = False

    # байонетные выступы (2 шт., по ±Y)
    bm = bmesh.new()
    for s in (1, -1):
        box(bm, ((-0.0552 - 0.0026), s * 0.0238, Z0),
            (0.0092, 0.0044, 0.0084), rot=(0.0, 0.0, s * math.radians(6)))
    bayonet = mesh_from_bm(PREFIX + 'bayonet', bm, 'steel')
    bayonet['rotating'] = False

    # защёлка быстросъёма: пластина с носком и осью на заднем конце
    bm = bmesh.new()
    box(bm, (-0.0634, 0.0, Z0 + 0.0236), (0.0132, 0.0082, 0.0034))
    box(bm, (-0.0561, 0.0, Z0 + 0.0242), (0.0044, 0.0066, 0.0050))
    bmesh.ops.create_cone(
        bm, cap_ends=True, cap_tris=False, segments=16,
        radius1=0.0022, radius2=0.0022, depth=0.0104,
        matrix=Matrix.Translation((-0.0674, 0.0, Z0 + 0.0236))
        @ Matrix.Rotation(math.radians(90), 4, 'X'))
    latch = mesh_from_bm(PREFIX + 'latch', bm, 'graphite')
    latch['rotating'] = False

    # метка размера: цветное кольцо на гильзе
    size_band = lathe(PREFIX + 'size_band', [
        (-0.0454, 0.0), (-0.0454, 0.0212), (-0.0450, 0.0234),
        (-0.0414, 0.0234), (-0.0410, 0.0212), (-0.0410, 0.0),
    ], 'cyan', seg=64)
    size_band['rotating'] = False

    # метка направления: два шеврона «>» по +X на бортах гильзы (±Y)
    bm = bmesh.new()
    a = math.atan2(0.0026, 0.0050)
    for k in range(2):
        bx = -0.0396 + k * 0.0058
        for side in (1, -1):
            for sgn in (1, -1):
                box(bm, (bx - 0.0025, side * 0.0222, Z0 + sgn * 0.0013),
                    (0.0058, 0.0012, 0.0018),
                    rot=(0.0, sgn * a, 0.0))
    dir_mark = mesh_from_bm(PREFIX + 'dir_mark', bm, 'dark', smooth=False)
    dir_mark['rotating'] = False

    # ---- анимационная пустышка на оси в основании ----------------------
    anim = empty(PREFIX + 'anim', (ANIM_X, 0.0, Z0))
    anim['spin_axis'] = 'X'
    anim['spin_speed'] = SPIN_SPEED
    anim['rib_count'] = RIBS
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

    ribs = bpy.data.objects[PREFIX + 'ribs']
    r_mn, r_mx = mesh_bbox([ribs])
    silicone_d = max(r_mx.y - r_mn.y, r_mx.z - r_mn.z)
    axis_r = max(max(abs(mn.y), abs(mx.y)),
                 abs(mx.z - Z0), abs(mn.z - Z0))
    # число рёбер: локальные максимумы радиуса по кольцам меша
    prof = {}
    for v in ribs.data.vertices:
        r = math.hypot(v.co.y, v.co.z - Z0)
        key = round(v.co.x, 5)
        prof[key] = max(prof.get(key, 0.0), r)
    seq = [prof[k] for k in sorted(prof)]
    crests = sum(1 for i in range(1, len(seq) - 1)
                 if seq[i] > seq[i - 1] and seq[i] >= seq[i + 1])

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
        'silicone_diameter_mm': round(silicone_d * 1000, 2),
        'rib_crests_detected': int(crests),
        'ribs_param': RIBS,
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_children': sorted(o.name for o in kids),
        'anim_extras': {'spin_axis': anim.get('spin_axis'),
                        'spin_speed': anim.get('spin_speed')},
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
            and rep['rib_crests_detected'] >= RIBS - 1
            and len(rotating) == 3):
        raise SystemExit('checks failed')


main()
