"""Standalone builder: work_feather_fan (WRK-FEA-04, «Перьевой веер»).

Лёгкая быстросъёмная головка-веер из изогнутых перьев на гибкой ножке.
Работает КАЧАНИЕМ (swing) вокруг оси шарнира, а не вращением.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_feather_fan.py

Выход:
  public/models/machine-modules/components/work_feather_fan.glb
  docs/plans/blockout/component-library/work_feather_fan/*.png  (4 ракурса)
  docs/plans/blockout/component-library/work_feather_fan/report.json

Геометрия (Blender Z-up, метры):
  ось шарнира  = Y (поперечная), точка pivot = (0, 0, HINGE_Z)
  anim-пустышка = (0, 0, HINGE_Z) — в ОСНОВАНИИ шарнира, не в центре веера
  качаются (дети anim): hinge_sleeve, stem, fan_hub, quill_binding,
                        feathers, quills
  статичны: mount_flange, bolt_*, clamp_ring, clamp_tab_*, clamp_screw,
            clamp_lever, clamp_grip, drive_housing, drive_panel, cam_boss,
            swing_marks, led, led_bezel, strain_relief, cable, connector,
            yoke_left, yoke_right, hinge_pin, hinge_cap_*
"""
from pathlib import Path
import json
import math
import random

import bpy
import bmesh
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
RENDER_DIR = PROJECT / 'docs/plans/blockout/component-library/work_feather_fan'
CID = 'work_feather_fan'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
HINGE_Z = 0.068            # высота оси шарнира == pivot anim
HUB_Z = 0.100              # основание веера (вершина ножки)
HUB_Y = 0.0120             # веер вынесен вперёд по Y (плоскость веера XZ)
FAN_SPAN = 58.0            # полураствор веера, градусы
FAN_N = 12                 # число перьев
L_CENTER = 0.080           # длина центрального пера
L_EDGE = 0.059             # длина крайнего пера
VANE_W = 0.0170            # полная ширина опахала в широкой части
VANE_T = 0.0009            # толщина опахала (solidify)
CURL_Y = 0.0062            # выгиб веера вперёд (в толщину)
BOW_Y = 0.0028             # крайние перья отведены назад -> веер-чаша

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'milk': (0.972, 0.949, 0.930),
    'pale': (0.944, 0.824, 0.840),
    'blush': (0.880, 0.652, 0.688),
    'rose': (0.812, 0.564, 0.602),
    'steel': (0.725, 0.729, 0.718),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.204, 0.212, 0.231),
    'cyan': (0.750, 0.900, 0.920),
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
    bsdf.inputs['Roughness'].default_value = 0.55
    bsdf.inputs['Metallic'].default_value = 0.30 if role in ('steel', 'graphite') else 0.0
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.6
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
        select_only(obj)
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


def sphere(name, loc, radius, role, segs=20, rings=12, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return apply(obj, role, True)


def curve_tube(name, points, radius, role, res=8, u=12):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = u
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.use_fill_caps = True
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


def taper_tube(name, points, radii, role, res=6, u=18):
    """Труба с переменным радиусом вдоль Bezier-сплайна."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = u
    cu.bevel_depth = 1.0
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, p, r in zip(sp.bezier_points, points, radii):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
        bp.radius = r
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def spline_tubes(name, splines, role, res=2, u=10):
    """Один меш из нескольких гладких трубок с переменным радиусом."""
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = u
    cu.bevel_depth = 1.0
    cu.bevel_resolution = res
    cu.use_fill_caps = True
    for pts, radii in splines:
        sp = cu.splines.new('BEZIER')
        sp.bezier_points.add(len(pts) - 1)
        for bp, p, r in zip(sp.bezier_points, pts, radii):
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
            bp.radius = r
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def ring_sector(name, cx, cy, r_in, r_out, z0, z1, a0, a1, seg, role):
    """С-образное кольцо вокруг оси Z (хомут с разрезом)."""
    bm = bmesh.new()
    rings = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        ca, sa = math.cos(a), math.sin(a)
        ring = []
        for r in (r_in, r_out):
            for z in (z0, z1):
                ring.append(bm.verts.new((cx + ca * r, cy + sa * r, z)))
        rings.append(ring)
    for i in range(seg):
        p, q = rings[i], rings[i + 1]
        bm.faces.new((p[0], p[1], q[1], q[0]))      # inner
        bm.faces.new((p[3], p[2], q[2], q[3]))      # outer
        bm.faces.new((p[1], p[3], q[3], q[1]))      # top
        bm.faces.new((p[0], q[0], q[2], p[2]))      # bottom
    bm.faces.new(tuple(reversed(rings[0])))
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
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


def bmesh_cone(bm, base, direction, length, r1, r2, segments=8):
    d = Vector(direction)
    if d.length < 1e-9:
        return
    d = d.normalized()
    from mathutils import Matrix
    m = (Matrix.Translation(Vector(base) + d * (length * 0.5))
         @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4())
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments,
                          radius1=r1, radius2=r2, depth=length, matrix=m)


def mesh_from_bm(name, bm, role, smooth=True):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    return apply(obj, role, smooth)


def solidify(obj, thickness, offset=0.0):
    mod = obj.modifiers.new('sol', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = offset
    mod.use_rim = True
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj


# --- профиль опахала -----------------------------------------------------
VANE_PROFILE = [
    (0.00, 0.08), (0.05, 0.30), (0.14, 0.58), (0.27, 0.83),
    (0.42, 0.97), (0.55, 1.00), (0.68, 0.95), (0.80, 0.82),
    (0.89, 0.62), (0.96, 0.36), (1.00, 0.05),
]


def vane_profile(s):
    lo = VANE_PROFILE[0]
    for hi in VANE_PROFILE[1:]:
        if s <= hi[0]:
            t = (s - lo[0]) / max(hi[0] - lo[0], 1e-9)
            t = t * t * (3 - 2 * t)          # smoothstep
            return lo[1] + (hi[1] - lo[1]) * t
        lo = hi
    return VANE_PROFILE[-1][1]


# --- сборка --------------------------------------------------------------
def build_feathers(hub, anim_children):
    """Веер: 11 перьев, каждое — изогнутая лопасть на тонком стержне."""
    rng = random.Random(4417)
    bm_vane = bmesh.new()
    quill_splines = []
    NS, NV = 10, 6
    s_start = 0.13
    hub_v = Vector(hub)

    for i in range(FAN_N):
        t = i / (FAN_N - 1)
        a = math.radians(-FAN_SPAN + 2 * FAN_SPAN * t)
        a_norm = abs(-FAN_SPAN + 2 * FAN_SPAN * t / 2) / FAN_SPAN  # 0..1 от центра
        a_norm = abs(a) / math.radians(FAN_SPAN)
        L = L_EDGE + (L_CENTER - L_EDGE) * (1.0 - a_norm ** 1.7)
        L *= 1.0 + 0.022 * math.sin(i * 2.7 + 0.6)      # живая разница длин
        w_full = VANE_W * (0.55 + 0.45 * (1.0 - a_norm ** 2))
        d = Vector((math.sin(a), 0.0, math.cos(a)))
        e = Vector((math.cos(a), 0.0, -math.sin(a)))    # поперёк пера, в плоскости веера
        bend = 0.0045 * math.sin(2.4 * (t - 0.5))       # лёгкий S в плоскости веера
        curl = CURL_Y * (0.78 + 0.30 * math.sin(i * 1.9 + 1.1))
        y_jit = (-BOW_Y * a_norm ** 1.3
                 + 0.0012 * math.sin(i * 3.3))          # веер-чаша, не плоскость

        def spine(s, d=d, e=e, L=L, bend=bend, curl=curl, y_jit=y_jit):
            return (hub_v + d * (L * s) + e * (bend * s * s)
                    + Vector((0.0, y_jit + curl * s * s, 0.0)))

        # --- опахало (лопасть) ------------------------------------------
        rows = []
        for ri in range(NS + 1):
            sr = ri / NS
            s = s_start + (1.0 - s_start) * sr
            c = spine(s)
            w = w_full * vane_profile(sr)
            w *= (1.0 + 0.055 * math.sin(9.1 * sr + i * 1.7)   # живой край
                  + 0.075 * sr ** 2 * math.sin(21.0 * sr + i * 2.3))
            outward = 1.0 if a >= 0 else -1.0
            row = []
            for k in range(NV + 1):
                v = -1.0 + 2.0 * k / NV
                # у настоящего пера опахало шире с наружной стороны
                wv = w * (1.0 + 0.17 * outward * v)
                arch = 0.0014 * (v * v) * (0.35 + 0.65 * sr)
                p = c + e * (v * wv) + Vector((0.0, arch, 0.0))
                row.append(bm_vane.verts.new(p))
            rows.append(row)
        for ri in range(NS):
            for k in range(NV):
                bm_vane.faces.new((rows[ri][k], rows[ri][k + 1],
                                   rows[ri + 1][k + 1], rows[ri + 1][k]))

        # --- стержень (rachis): изогнутый, сужается к концу --------------
        qs = [-0.16, 0.15, 0.45, 0.75, 1.0, 1.035]
        quill_splines.append((
            [spine(s) for s in qs],
            [0.0026, 0.0022, 0.0016, 0.0011, 0.0007, 0.0004],
        ))

    vanes = mesh_from_bm(PREFIX + 'feathers', bm_vane, 'pale', smooth=True)
    solidify(vanes, VANE_T, 0.0)
    quills = spline_tubes(PREFIX + 'quills', quill_splines, 'rose')
    anim_children.extend([vanes, quills])
    return vanes, quills


def build():
    reset()
    anim_kids = []

    # ================= быстросъёмное крепление (статично) ===============
    cube(PREFIX + 'mount_flange', (0.0, 0.004, 0.0035),
         (0.058, 0.046, 0.007), 'steel', r=0.0022)
    for tag, sx, sy in (('a', 0.021, 0.013), ('b', -0.021, 0.013),
                        ('c', 0.021, -0.011), ('d', -0.021, -0.011)):
        cyl(PREFIX + f'bolt_{tag}', (sx, sy, 0.0062), (sx, sy, 0.0105),
            0.0034, 'graphite', vertices=14, bev=0.0008)

    # С-образный хомут с разрезом спереди (-Y)
    a0 = math.radians(-73.0)
    a1 = math.radians(287.0)
    ring_sector(PREFIX + 'clamp_ring', 0.0, 0.004, 0.0158, 0.0206,
                0.0095, 0.0235, a0, a1, 40, 'steel')
    for tag, sx in (('left', 0.0068), ('right', -0.0068)):
        cube(PREFIX + f'clamp_tab_{tag}', (sx, -0.0186, 0.0165),
             (0.0060, 0.0110, 0.0210), 'steel', r=0.0012)
    cyl(PREFIX + 'clamp_screw', (-0.0110, -0.0186, 0.0165),
        (0.0110, -0.0186, 0.0165), 0.0026, 'graphite', vertices=14)
    # курок-переключатель быстросъёма: рычаг вниз-наружу от щёчек разреза
    cyl(PREFIX + 'clamp_lever', (0.0080, -0.0195, 0.0212),
        (0.0252, -0.0245, 0.0108), 0.0040, 'steel', vertices=16)
    sphere(PREFIX + 'clamp_grip', (0.0268, -0.0250, 0.0102), 0.0058, 'blush',
           segs=18, rings=10, scale=(1.05, 1.0, 0.80))

    # ================= корпус качающего привода (статично) ==============
    cube(PREFIX + 'drive_housing', (0.0, 0.001, 0.0400),
         (0.0440, 0.0320, 0.0380), 'blush', r=0.0060, smooth=True)
    cyl(PREFIX + 'drive_panel', (0.0, -0.0165, 0.0415), (0.0, -0.0215, 0.0415),
        0.0155, 'ivory', vertices=40, bev=0.0010)
    # эксцентрик/кулачок, видимый на панели
    cyl(PREFIX + 'cam_boss', (-0.0062, -0.0198, 0.0455), (-0.0062, -0.0242, 0.0455),
        0.0062, 'graphite', vertices=24, bev=0.0008)
    cyl(PREFIX + 'cam_pin', (-0.0062, -0.0230, 0.0455), (-0.0062, -0.0262, 0.0455),
        0.0026, 'steel', vertices=12)
    # дуговая шкала амплитуды качания (ограничитель ±30°)
    bm = bmesh.new()
    for k in range(7):
        ang = math.radians(-30.0 + k * 10.0)
        px = 0.0155 * math.sin(ang)
        pz = 0.0415 + 0.0155 * math.cos(ang)
        p = 0.0019 if k in (0, 6) else 0.0012
        bmesh_cone(bm, (px, -0.0214, pz), (0, -0.0022, 0), 0.0022, p, p, 8)
    mesh_from_bm(PREFIX + 'swing_marks', bm, 'graphite', smooth=False)
    # LED
    cyl(PREFIX + 'led_bezel', (0.0138, -0.0172, 0.0330), (0.0138, -0.0205, 0.0330),
        0.0044, 'graphite', vertices=20)
    sphere(PREFIX + 'led', (0.0138, -0.0218, 0.0330), 0.0031, 'cyan', segs=18, rings=10)

    # ================= кабель (статично) ================================
    cyl(PREFIX + 'strain_relief', (0.0, 0.0165, 0.0295), (0.0, 0.0215, 0.0250),
        0.0060, 'graphite', vertices=18, bev=0.0010)
    curve_tube(PREFIX + 'cable',
               [(0.0, 0.0205, 0.0255),
                (0.001, 0.0270, 0.0195),
                (0.004, 0.0310, 0.0115),
                (0.008, 0.0315, 0.0060)], 0.0034, 'graphite')
    cube(PREFIX + 'connector', (0.0098, 0.0310, 0.0062),
         (0.0110, 0.0075, 0.0085), 'graphite', r=0.0016)

    # ================= шарнир: статичные щёки и палец ====================
    for tag, sy in (('left', 0.0130), ('right', -0.0130)):
        cube(PREFIX + f'yoke_{tag}', (0.0, sy, 0.0620),
             (0.0140, 0.0052, 0.0170), 'steel', r=0.0016)
    cyl(PREFIX + 'hinge_pin', (0.0, -0.0180, HINGE_Z), (0.0, 0.0180, HINGE_Z),
        0.0042, 'steel', vertices=18)
    for tag, sy in (('left', 0.0186), ('right', -0.0186)):
        cyl(PREFIX + f'hinge_cap_{tag}', (0.0, sy - 0.0016, HINGE_Z),
            (0.0, sy + 0.0016, HINGE_Z), 0.0060, 'graphite', vertices=18,
            bev=0.0006)

    # ================= качающаяся часть =================================
    # втулка шарнира — она же основание гибкой ножки
    sleeve = cyl(PREFIX + 'hinge_sleeve', (0.0, -0.0085, HINGE_Z),
                 (0.0, 0.0085, HINGE_Z), 0.0092, 'blush', vertices=28)
    anim_kids.append(sleeve)

    # гибкая молочная ножка: изогнута вперёд, сужается к верху
    stem = taper_tube(
        PREFIX + 'stem',
        [(0.0, 0.000, HINGE_Z + 0.001),
         (0.0, 0.0035, 0.0790),
         (0.0, 0.0095, 0.0925),
         (0.0, HUB_Y, HUB_Z - 0.001)],
        [0.0078, 0.0066, 0.0054, 0.0046], 'milk')
    anim_kids.append(stem)

    # хаб веера + обойма, стягивающая основания перьев
    hub = cube(PREFIX + 'fan_hub', (0.0, HUB_Y, HUB_Z - 0.0015),
               (0.0170, 0.0140, 0.0190), 'blush', r=0.0055, smooth=True)
    anim_kids.append(hub)
    binding = cyl(PREFIX + 'quill_binding', (0.0, HUB_Y, HUB_Z - 0.0060),
                  (0.0, HUB_Y, HUB_Z + 0.0105), 0.0128, 'ivory',
                  vertices=32, r2=0.0092, bev=0.0010)
    anim_kids.append(binding)

    build_feathers((0.0, HUB_Y, HUB_Z + 0.0015), anim_kids)

    # ================= анимационная пустышка ============================
    anim = empty(PREFIX + 'anim', (0.0, 0.0, HINGE_Z))
    bpy.context.view_layer.update()      # иначе matrix_world ещё identity
    for o in anim_kids:
        parent(o, anim)
        o['swinging'] = True
    for o in bpy.data.objects:
        if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in anim_kids:
            o['swinging'] = False

    bpy.context.view_layer.update()
    return anim, anim_kids


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


def world_verts(obj):
    mw = obj.matrix_world
    return [mw @ v.co for v in obj.data.vertices]


def tri_count(objects):
    total = 0
    for o in objects:
        if o.type != 'MESH':
            continue
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    return total


def check(anim, kids):
    bpy.context.view_layer.update()
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    size = mx - mn
    center = (mn + mx) * 0.5

    # ---- pivot-тест: качание, а не спин -------------------------------
    k_mn, k_mx = mesh_bbox(kids)
    c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, math.radians(30.0), 0.0)   # качание вокруг Y
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    c1 = (b_mn + b_mx) * 0.5
    shift = (c1 - c0).length

    # статичные узлы не должны ехать от поворота anim
    pivot_pt = anim.matrix_world.translation.copy()
    yoke = bpy.data.objects[PREFIX + 'yoke_left']
    y_mn, y_mx = mesh_bbox([yoke])
    y_c = (y_mn + y_mx) * 0.5
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()
    pivot_rest = anim.matrix_world.translation.copy()

    # основание качающейся части должно сидеть на pivot
    min_d = 1e9
    for o in kids:
        for p in world_verts(o):
            min_d = min(min_d, (p - pivot_rest).length)

    pin = bpy.data.objects[PREFIX + 'hinge_pin']
    p_mn, p_mx = mesh_bbox([pin])
    pin_c = (p_mn + p_mx) * 0.5

    vanes = bpy.data.objects[PREFIX + 'feathers']
    v_mn, v_mx = mesh_bbox([vanes])
    vane_size = v_mx - v_mn

    ztops = {o.name: round(mesh_bbox([o])[1].z, 5) for o in all_mesh}
    top = sorted(ztops.items(), key=lambda kv: -kv[1])[:3]

    report = {
        'component': CID,
        'top_objects': top,
        'code': 'WRK-FEA-04',
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.14 and size.y <= 0.08 and size.z <= 0.20),
        'bbox_limit': '0.20 (Z) x 0.14 (X) x 0.08 (Y)',
        'tris': tri_count(all_mesh),
        'fan_size': [round(v, 5) for v in vane_size],
        'feathers': FAN_N,
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'pivot_is_hinge': bool((pin_c - pivot_rest).length < 0.001),
        'pivot_to_pin_mm': round((pin_c - pivot_rest).length * 1000, 4),
        'anim_children': sorted(o.name for o in kids),
        'child_base_min_dist_mm': round(min_d * 1000, 3),
        'base_ok': bool(min_d < 0.010),
        'swing_center_shift_m': round(shift, 5),
        'swing_center_shift_mm': round(shift * 1000, 2),
        'swing_ok': bool(0.015 < shift < 0.09),
        'static_nodes_after_rot': sorted(
            o.name for o in bpy.data.objects
            if o.name.startswith(PREFIX) and o.type == 'MESH' and o not in kids),
        'materials': sorted(m.name for m in bpy.data.materials),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'motion_recommended': {
            'type': 'swing', 'axis': 'y',
            'amount': 26.0, 'amount_unit': 'deg', 'speed': 1.2,
            'node': anim.name,
            'parts': sorted(o.name for o in kids),
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
    if not path.is_file() or path.stat().st_size < 20000:
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
    scene.view_settings.exposure = -0.30
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
    size = max((mx - mn).x, (mx - mn).y, (mx - mn).z)

    bpy.ops.mesh.primitive_plane_add(size=6, location=(center.x, center.y, mn.z - 0.0005))
    floor = bpy.context.object
    fm = bpy.data.materials.new('floor')
    fm.use_nodes = True
    nb = fm.node_tree.nodes['Principled BSDF']
    nb.inputs['Base Color'].default_value = (0.690, 0.684, 0.672, 1.0)
    nb.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(fm)

    for name, loc, energy, sz in (
            ('key', (0.45, -0.62, 0.62), 18, 0.75),
            ('fill', (-0.62, -0.42, 0.36), 8, 0.95),
            ('rim', (0.05, 0.62, 0.55), 12, 0.75)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = sz
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc) + Vector((center.x, center.y, 0))
        lo.rotation_euler = (center - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 60
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    RENDER_DIR.mkdir(parents=True, exist_ok=True)

    def cam_basis(direction):
        q = Vector(direction).normalized().to_track_quat('Z', 'Y')
        right = q @ Vector((1, 0, 0))
        up = q @ Vector((0, 1, 0))
        back = Vector(direction).normalized()
        return right, up, back

    def fit_dist(direction, lens, corners, margin=1.03):
        """Дистанция, при которой проекция углов влезает в кадр (без обрезки)."""
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

    hub_target = Vector((0.0, 0.0, 0.0))
    c_main = box_corners(mn - center, mx - center)
    c_close = box_corners(Vector((-0.040, -0.034, 0.040)) - hub_target,
                          Vector((0.040, 0.030, 0.130)) - hub_target)
    views = [
        ('3q', (0.85, -1.00, 0.40), center, 70, c_main),
        ('front', (0.00, -1.00, 0.05), center, 70, c_main),
        ('side', (1.00, -0.09, 0.09), center, 70, c_main),
        ('closeup', (0.55, -1.00, 0.30), hub_target, 85, c_close),
    ]
    outs = []
    for tag, direction, target, lens, corners in views:
        cam_data.lens = lens
        dist = fit_dist(direction, lens, corners)
        cam.location = target + Vector(direction).normalized() * dist
        cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
        fp = RENDER_DIR / f'{CID}_{tag}.png'
        scene.render.filepath = str(fp)
        bpy.ops.render.render(write_still=True)
        outs.append(str(fp.relative_to(PROJECT)))
        print('RENDERED', fp, flush=True)
    return outs


def main():
    anim, kids = build()
    rep = check(anim, kids)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    rep['renders'] = render_views()
    RENDER_DIR.mkdir(parents=True, exist_ok=True)
    (RENDER_DIR / 'report.json').write_text(
        json.dumps(rep, ensure_ascii=False, indent=2), encoding='utf-8')
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['swing_ok'] and rep['base_ok']
            and rep['pivot_is_hinge']):
        raise SystemExit('checks failed')


main()
