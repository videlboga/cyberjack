"""Standalone builder: fluid_mixer (WRK-FL-05, «Смеситель») — mixing chamber.

Компактная камера смешивания с полупрозрачным корпусом, крышкой на
быстросъёме, вертикальным импеллером на валу, статором-отражателями,
боковым приводом (мотор + угловой редуктор), входным/выходным штуцерами
и коротким кабелем. Без плиты. Не зависит от build_component_library.py.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_work_fluid_mixer.py

Выход:
  public/models/machine-modules/components/fluid_mixer.glb
  docs/plans/blockout/component-library/fluid_mixer/fluid_mixer_{3q,front,side,closeup}.png

Геометрия (Blender Z-up, метры):
  ось импеллера = Z, линия x=0, y=0
  anim-пустышка  = (0, 0, 0.046) — центр рабочего колеса на оси вала
  вращаются: shaft, impeller_hub, impeller_blades
  статичны:  дно/обечайка/фланец/башмаки, крышка, быстросъём, статор,
             редуктор, мотор, штуцеры, кабель, LED
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
SHOTS = PROJECT / 'docs/plans/blockout/component-library/fluid_mixer'
CID = 'fluid_mixer'
PREFIX = CID + '__'

# --- ключевые размеры (м) ------------------------------------------------
R_OUT, R_IN = 0.046, 0.043          # обечайка камеры
Z_HEAD0, Z_HEAD1 = 0.007, 0.026     # днище (усечённый конус, опора на башмаки)
Z_SHELL0, Z_SHELL1 = 0.026, 0.098   # прозрачная обечайка
Z_RIM0, Z_RIM1 = 0.098, 0.104       # фланец горловины
Z_LID0, Z_LID1 = 0.104, 0.112       # крышка
Z_BOSS0, Z_BOSS1 = 0.112, 0.120     # стакан привода на крышке
Z_AXIS = 0.052                      # центр импеллера / anim
OUTLET_AZ = math.radians(40.0)      # выход: азимут штуцера в плане

IMP_R0, IMP_R1 = 0.0095, 0.0305     # лопасти: D колеса/камеры ~0.65
IMP_Z0, IMP_Z1 = 0.040, 0.064
IMP_PITCH = math.radians(34.0)
BLADES = 4

MOTOR_Z = 0.117
MOTOR_X0, MOTOR_X1 = 0.056, 0.102
MOTOR_R = 0.0200
GEAR_C = Vector((0.034, 0.0, 0.1145))
GEAR_S = (0.042, 0.038, 0.026)

PALETTE = {
    'body': (0.945, 0.937, 0.918),
    'ivory': (0.980, 0.973, 0.957),
    'steel': (0.725, 0.729, 0.718),
    'graphite': (0.330, 0.341, 0.353),
    'dark': (0.204, 0.212, 0.231),
    'blush': (0.910, 0.725, 0.749),
    'rose': (0.780, 0.400, 0.430),
    'pale': (0.949, 0.843, 0.851),
    'cyan': (0.750, 0.900, 0.920),
    'glass': (0.800, 0.902, 0.930),
}
MATS = {}


# --- helpers -------------------------------------------------------------
def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role, alpha=1.0):
    key = (role, alpha)
    if key in MATS:
        return MATS[key]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_{int(round(alpha * 100))}')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.06 if role == 'glass' else 0.62
    bsdf.inputs['Metallic'].default_value = 0.28 if role in ('steel', 'graphite') else 0.0
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.45
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'blend_method'):
            m.blend_method = 'BLEND'
        if hasattr(m, 'surface_render_method'):
            m.surface_render_method = 'BLENDED'
        if hasattr(m, 'use_transparent_shadow'):
            m.use_transparent_shadow = True
        if hasattr(m, 'show_transparent_back'):
            m.show_transparent_back = False
    m.diffuse_color = (*color, alpha)
    MATS[key] = m
    return m


def apply(obj, role, smooth=False, alpha=1.0):
    obj.data.materials.append(mat(role, alpha))
    obj.data.name = obj.name + '_mesh'
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


def cube(name, loc, size, role, r=0.0015, rot=(0, 0, 0), smooth=False, alpha=1.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    return apply(obj, role, smooth, alpha)


def cyl(name, a, b, radius, role, vertices=32, smooth=True, r2=None, bev=0.0, alpha=1.0):
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
    return apply(obj, role, smooth, alpha)


def sphere(name, loc, radius, role, segs=20, rings=12, alpha=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings,
                                         radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    return apply(obj, role, True, alpha)


def curve_tube(name, points, radius, role, res=6, alpha=1.0):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = radius
    cu.bevel_resolution = res
    cu.resolution_u = 10
    sp = cu.splines.new('BEZIER')
    sp.bezier_points.add(len(points) - 1)
    for bp, p in zip(sp.bezier_points, points):
        bp.co = Vector(p)
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, False, alpha)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    bpy.context.object.data.name = name + '_mesh'
    return bpy.context.object


def ring_shell(name, z0, z1, r_in, r_out, role, seg=64, alpha=1.0, smooth=True):
    """Замкнутая цилиндрическая обечайка: наружная + внутренняя стенки + торцы."""
    bm = bmesh.new()
    rings = []
    for z, r in ((z0, r_in), (z0, r_out), (z1, r_out), (z1, r_in)):
        ring = []
        for i in range(seg):
            a = math.tau * i / seg
            ring.append(bm.verts.new((math.cos(a) * r, math.sin(a) * r, z)))
        rings.append(ring)
    for k in range(4):
        a_, b_ = rings[k], rings[(k + 1) % 4]
        for i in range(seg):
            j = (i + 1) % seg
            bm.faces.new((a_[i], a_[j], b_[j], b_[i]))
    return mesh_from_bm(name, bm, role, smooth, alpha)


def torus_bm(bm, center, axis, major, minor, seg_major=24, seg_minor=8):
    """Тор в произвольной рамке (axis — нормаль кольца)."""
    c = Vector(center)
    n = Vector(axis).normalized()
    u = n.cross(Vector((0.0, 0.0, 1.0)))
    if u.length < 1e-6:
        u = n.cross(Vector((0.0, 1.0, 0.0)))
    u.normalize()
    v = n.cross(u).normalized()
    grid = []
    for i in range(seg_major):
        a = math.tau * i / seg_major
        dirv = u * math.cos(a) + v * math.sin(a)
        ring = []
        for k in range(seg_minor):
            b = math.tau * k / seg_minor
            p = c + dirv * (major + minor * math.cos(b)) + n * (minor * math.sin(b))
            ring.append(bm.verts.new(p))
        grid.append(ring)
    for i in range(seg_major):
        i2 = (i + 1) % seg_major
        for k in range(seg_minor):
            k2 = (k + 1) % seg_minor
            bm.faces.new((grid[i][k], grid[i2][k], grid[i2][k2], grid[i][k2]))


def empty(name, loc):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    e.empty_display_type = 'ARROWS'
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def mesh_from_bm(name, bm, role, smooth=True, alpha=1.0):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new(name, me)
    bpy.context.scene.collection.objects.link(obj)
    obj.data.name = name + '_mesh'
    return apply(obj, role, smooth, alpha)


def radial(a):
    """Радиальное направление в плоскости XY: a=0 -> +X, a=+90° -> +Y."""
    return Vector((math.cos(a), math.sin(a), 0.0))


def plate(bm, a, r0, r1, z0, z1, thickness, pitch=0.0):
    """Наклонная лопасть/отражатель в радиальной рамке угла a.

    pitch=0 -> вертикальная пластина: высота по Z, толщина по касательной.
    """
    d = radial(a)
    t = Vector((-d.y, d.x, 0.0))
    u = Vector((0.0, 0.0, 1.0))
    p = (t * math.sin(pitch) + u * math.cos(pitch)).normalized()
    n = (t * math.cos(pitch) - u * math.sin(pitch)).normalized()
    zc = (z0 + z1) * 0.5
    hh = (z1 - z0) * 0.5
    idx = {}
    for i, r in enumerate((r0, r1)):
        for j, s in enumerate((-1.0, 1.0)):
            for k, side in enumerate((-1.0, 1.0)):
                co = d * r + Vector((0.0, 0.0, zc)) + p * (s * hh) + n * (side * thickness * 0.5)
                idx[(i, j, k)] = bm.verts.new(co)
    bm.faces.new((idx[(1, 0, 0)], idx[(1, 0, 1)], idx[(1, 1, 1)], idx[(1, 1, 0)]))
    bm.faces.new((idx[(0, 0, 0)], idx[(0, 1, 0)], idx[(0, 1, 1)], idx[(0, 0, 1)]))
    bm.faces.new((idx[(0, 0, 0)], idx[(1, 0, 0)], idx[(1, 0, 1)], idx[(0, 0, 1)]))
    bm.faces.new((idx[(0, 1, 0)], idx[(0, 1, 1)], idx[(1, 1, 1)], idx[(1, 1, 0)]))
    bm.faces.new((idx[(0, 0, 0)], idx[(0, 1, 0)], idx[(1, 1, 0)], idx[(1, 0, 0)]))
    bm.faces.new((idx[(0, 0, 1)], idx[(1, 0, 1)], idx[(1, 1, 1)], idx[(0, 1, 1)]))


# --- сборка --------------------------------------------------------------
def build():
    reset()
    rotating = []

    # ---- корпус камеры -------------------------------------------------
    # опорные башмаки (не плита): три стойки под коническим днищем
    bm = bmesh.new()
    for a in (math.radians(35), math.radians(155), math.radians(275)):
        d = radial(a) * 0.0305
        bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=16,
                              radius1=0.0076, radius2=0.0058, depth=0.0165,
                              matrix=Matrix.Translation(d + Vector((0, 0, 0.00825))))
    mesh_from_bm(PREFIX + 'feet', bm, 'graphite')

    # днище: усечённый конус + плоская пята (стоит на башмаках)
    cyl(PREFIX + 'chamber_head', (0, 0, Z_HEAD0), (0, 0, Z_HEAD1), 0.018,
        'body', vertices=48, r2=R_OUT, bev=0.0022)
    # прозрачная обечайка
    ring_shell(PREFIX + 'chamber_shell', Z_SHELL0, Z_SHELL1, R_IN, R_OUT,
               'glass', seg=64, alpha=0.26)
    # фланец горловины
    cyl(PREFIX + 'chamber_rim', (0, 0, Z_RIM0), (0, 0, Z_RIM1), 0.0535,
        'body', vertices=48, bev=0.0026)
    # метки уровня на обечайке (статичны, часть корпуса)
    bm = bmesh.new()
    torus_bm(bm, (0, 0, 0.079), (0, 0, 1), 0.0460, 0.0009, 44, 6)
    mesh_from_bm(PREFIX + 'fill_line', bm, 'graphite')

    # ---- статор: отражатели у стенки + опорный стакан вала ------------
    bm = bmesh.new()
    for a in (math.radians(30), math.radians(150), math.radians(270)):
        plate(bm, a, 0.0355, 0.0435, 0.028, 0.074, 0.0028)
    mesh_from_bm(PREFIX + 'stator_baffles', bm, 'steel', smooth=False)
    cyl(PREFIX + 'stator_boss', (0, 0, 0.0225), (0, 0, 0.0320), 0.0125, 'graphite',
        vertices=24, bev=0.0012)

    # ---- крышка + быстросъём -------------------------------------------
    cyl(PREFIX + 'lid', (0, 0, Z_LID0), (0, 0, Z_LID1), 0.049, 'body',
        vertices=48, bev=0.0030)
    cyl(PREFIX + 'drive_boss', (0, 0, Z_BOSS0), (0, 0, Z_BOSS1), 0.0195,
        'steel', vertices=28, bev=0.0018)

    # хомут-бандаж по стыку крышки и горловины
    ring_shell(PREFIX + 'clamp_band', 0.0965, 0.1055, 0.0532, 0.0575, 'graphite', seg=48)
    cube(PREFIX + 'clamp_lug', (0.0, -0.0590, 0.1010), (0.024, 0.016, 0.013),
         'steel', r=0.0016)
    cyl(PREFIX + 'clamp_pin', (-0.014, -0.0620, 0.1010), (0.014, -0.0620, 0.1010),
        0.0028, 'steel', vertices=14)
    # откидная рукоятка быстросъёма (короткая, упирается в бандаж)
    cyl(PREFIX + 'clamp_lever', (0.0, -0.0630, 0.0985), (0.0, -0.0765, 0.0835),
        0.0038, 'steel', vertices=16)
    sphere(PREFIX + 'clamp_knob', (0.0, -0.0775, 0.0820), 0.0046, 'steel')

    # ---- импеллер на вертикальном валу (вращается) --------------------
    shaft = cyl(PREFIX + 'shaft', (0, 0, 0.030), (0, 0, 0.1180), 0.0045,
                'steel', vertices=20)
    hub = cyl(PREFIX + 'impeller_hub', (0, 0, 0.0370), (0, 0, 0.0660), 0.0098,
              'steel', vertices=28, bev=0.0012)
    bm = bmesh.new()
    for i in range(BLADES):
        a = math.radians(45.0 + i * 360.0 / BLADES)
        plate(bm, a, IMP_R0, IMP_R1, IMP_Z0, IMP_Z1, 0.0024, pitch=IMP_PITCH)
    # юбка-конус под ступицей: рабочее колесо читается как осевой насос
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=24,
                          radius1=0.0072, radius2=0.0112, depth=0.008,
                          matrix=Matrix.Translation(Vector((0, 0, 0.0390))))
    blades = mesh_from_bm(PREFIX + 'impeller_blades', bm, 'rose', smooth=False)
    rotating += [shaft, hub, blades]

    # ---- привод: угловой редуктор + мотор сбоку -----------------------
    cube(PREFIX + 'gearbox', GEAR_C, GEAR_S, 'graphite', r=0.0040)
    cyl(PREFIX + 'gearbox_cap', (0.034, 0.0, 0.1270), (0.034, 0.0, 0.1325),
        0.0135, 'steel', vertices=24, bev=0.0014)
    cyl(PREFIX + 'motor_coupling', (0.048, 0, MOTOR_Z), (MOTOR_X0, 0, MOTOR_Z),
        0.0145, 'steel', vertices=24, bev=0.0014)
    cyl(PREFIX + 'motor', (MOTOR_X0, 0, MOTOR_Z), (MOTOR_X1, 0, MOTOR_Z),
        MOTOR_R, 'graphite', vertices=40, bev=0.0035)
    cyl(PREFIX + 'motor_cap', (MOTOR_X1, 0, MOTOR_Z), (0.1080, 0, MOTOR_Z),
        0.0182, 'graphite', vertices=32, bev=0.0022)
    cyl(PREFIX + 'motor_hub_cap', (0.1080, 0, MOTOR_Z), (0.1125, 0, MOTOR_Z),
        0.0080, 'steel', vertices=20, bev=0.0010)
    bm = bmesh.new()
    for x in (0.0625, 0.0735, 0.0845, 0.0955):
        torus_bm(bm, (x, 0, MOTOR_Z), (1, 0, 0), 0.0208, 0.0015, 32, 6)
    mesh_from_bm(PREFIX + 'motor_fins', bm, 'steel')
    # кронштейн мотора к редуктору/фланцу горловины
    cube(PREFIX + 'motor_bracket', (0.0525, 0.0, 0.1035), (0.011, 0.030, 0.026),
         'steel', r=0.0016)

    # ---- штуцеры -------------------------------------------------------
    # вход: приподнятый патрубок на крышке, наклонён вверх-влево
    cyl(PREFIX + 'inlet_boss', (-0.026, 0, 0.1105), (-0.026, 0, 0.1175),
        0.0155, 'body', vertices=28, bev=0.0018)
    cyl(PREFIX + 'inlet_pipe', (-0.0285, 0, 0.1158), (-0.0760, 0, 0.1070),
        0.0078, 'steel', vertices=24)
    cyl(PREFIX + 'inlet_nut', (-0.0395, 0, 0.1138), (-0.0490, 0, 0.1122),
        0.0112, 'steel', vertices=8, bev=0.0012, smooth=False)
    bm = bmesh.new()
    for x in (-0.0600, -0.0650, -0.0700, -0.0750):
        z = 0.1158 + (x + 0.0285) * 0.1848
        torus_bm(bm, (x, 0, z), (1, 0, 0), 0.0085, 0.0013, 22, 6)
    mesh_from_bm(PREFIX + 'inlet_barbs', bm, 'graphite')

    # выход: из нижней части обечайки под 40° в плане, с наклоном вниз
    od = radial(OUTLET_AZ)

    def on_axis(s, z):
        return (od.x * s, od.y * s, z)

    cyl(PREFIX + 'outlet_flange', on_axis(0.0415, 0.0300), on_axis(0.0495, 0.0288),
        0.0125, 'body', vertices=28, bev=0.0018)
    cyl(PREFIX + 'outlet_pipe', on_axis(0.0485, 0.0288), on_axis(0.0755, 0.0200),
        0.0078, 'steel', vertices=24)
    cyl(PREFIX + 'outlet_nut', on_axis(0.0550, 0.0271), on_axis(0.0635, 0.0242),
        0.0110, 'steel', vertices=8, bev=0.0012, smooth=False)
    bm = bmesh.new()
    for s in (0.0680, 0.0715, 0.0750):
        z = 0.0288 - (s - 0.0485) * 0.3333
        torus_bm(bm, on_axis(s, z), od, 0.0085, 0.0013, 22, 6)
    mesh_from_bm(PREFIX + 'outlet_barbs', bm, 'graphite')

    # ---- кабель + разъём ----------------------------------------------
    curve_tube(PREFIX + 'cable',
               [(0.1120, -0.0055, MOTOR_Z - 0.0010),
                (0.1150, -0.0130, MOTOR_Z - 0.0090),
                (0.1110, -0.0215, MOTOR_Z - 0.0175),
                (0.1040, -0.0275, MOTOR_Z - 0.0215)], 0.0034, 'graphite')
    cyl(PREFIX + 'strain_relief', (0.1115, -0.0040, MOTOR_Z - 0.0005),
        (0.1145, -0.0090, MOTOR_Z - 0.0055), 0.0066, 'graphite', vertices=18,
        bev=0.0012)
    cube(PREFIX + 'connector', (0.0985, -0.0305, MOTOR_Z - 0.0240),
         (0.0125, 0.0095, 0.0085), 'graphite', r=0.0018)

    # ---- LED состояния -------------------------------------------------
    sphere(PREFIX + 'led', (0.0275, -0.0330, 0.1110), 0.0032, 'cyan')

    # ---- анимационная пустышка на оси импеллера -----------------------
    anim = empty(PREFIX + 'anim', (0.0, 0.0, Z_AXIS))
    anim['spin_axis'] = 'z'
    anim['spin_speed'] = 1.4
    anim['spin_type'] = 'spin'
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

    # ось: bbox-центр группы детей anim до/после поворота на 90° вокруг Z
    kids = list(anim.children)
    k_mn, k_mx = mesh_bbox(kids)
    k_c0 = (k_mn + k_mx) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (0.0, 0.0, math.radians(90))
    bpy.context.view_layer.update()
    b_mn, b_mx = mesh_bbox(kids)
    k_c1 = (b_mn + b_mx) * 0.5
    pivot_shift = (k_c1 - k_c0).length
    anim.rotation_euler = (0.0, 0.0, 0.0)
    bpy.context.view_layer.update()

    # ось по геометрии: вал — цилиндр, у которого Z-протяжённость доминирует
    s_mn, s_mx = mesh_bbox([bpy.data.objects[PREFIX + 'shaft']])
    s_size = s_mx - s_mn
    axis = 'z' if s_size.z > max(s_size.x, s_size.y) else 'x/y'
    shell_mn, shell_mx = mesh_bbox([bpy.data.objects[PREFIX + 'chamber_shell']])
    shell_size = shell_mx - shell_mn

    report = {
        'component': CID,
        'nodes': len([o for o in bpy.data.objects if o.name.startswith(PREFIX)]),
        'objects_total': len(bpy.data.objects),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size': [round(v, 5) for v in size],
        'bbox_center': [round(v, 5) for v in center],
        'bbox_ok': bool(size.x <= 0.200 and size.y <= 0.200 and size.z <= 0.150),
        'chamber_d': round(max(shell_size.x, shell_size.y), 5),
        'chamber_h': round(shell_size.z, 5),
        'axis': axis,
        'shaft_len_z': round(s_size.z, 5),
        'anim_name': anim.name,
        'anim_loc': [round(v, 5) for v in anim.location],
        'anim_extras': {k: anim[k] for k in ('spin_axis', 'spin_speed', 'spin_type')},
        'anim_children': sorted(o.name for o in kids),
        'children_axes_xy': [round(k_c0.x, 6), round(k_c0.y, 6)],
        'children_on_axis_ok': bool(abs(k_c0.x) < 0.0005 and abs(k_c0.y) < 0.0005),
        'pivot_shift_m': round(pivot_shift, 9),
        'pivot_shift_mm': round(pivot_shift * 1000, 5),
        'pivot_ok': bool(pivot_shift < 0.001),
        'materials': sorted(m.name for m in bpy.data.materials),
        'non_children_static': sorted(o.name for o in bpy.data.objects
                                      if o.name.startswith(PREFIX)
                                      and o.type == 'MESH' and o not in kids),
        'bad_names': sorted(o.name for o in bpy.data.objects
                            if not o.name.startswith(PREFIX)),
        'rotating_ok': bool(sorted(o.name for o in kids) ==
                            sorted([PREFIX + 'impeller_blades',
                                    PREFIX + 'impeller_hub',
                                    PREFIX + 'shaft'])),
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


# --- рендеры -------------------------------------------------------------
def render_setup():
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.960, 0.955, 0.940, 1)
    bg.inputs['Strength'].default_value = 0.42

    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, -0.001))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.86, 0.85, 0.83, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.1, 1.4), 1.65),
        ('fill', (-1.2, -0.8, 0.5), 0.55),
        ('rim', (0.2, 1.1, 0.9), 1.25),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(18)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=85, res=(860, 720)):
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


def render(mn, mx):
    SHOTS.mkdir(parents=True, exist_ok=True)
    render_setup()
    center = (mn + mx) * 0.5
    size = mx - mn
    shot('3q', (1.15, -1.45, 0.62), center, ortho_scale=max(size) * 1.60)
    shot('front', (0.0, -1.0, 0.10), center, ortho_scale=max(size.x, size.z) * 1.60)
    shot('side', (1.0, 0.0, 0.09), center, ortho_scale=max(size.y, size.z) * 1.60)
    shot('closeup', (0.62, -0.86, 0.24), (0.0, 0.0, 0.056), dist=0.38, lens=80,
         res=(900, 780))


def main():
    anim, rotating = build()
    rep = check(anim, rotating)
    all_mesh = [o for o in bpy.data.objects if o.type == 'MESH']
    mn, mx = mesh_bbox(all_mesh)
    path = export()
    rep['glb'] = str(path.relative_to(PROJECT))
    rep['glb_bytes'] = path.stat().st_size
    render(mn, mx)
    rep['renders'] = sorted(p.name for p in SHOTS.glob(f'{CID}_*.png'))
    print('REPORT ' + json.dumps(rep, ensure_ascii=False), flush=True)
    if not (rep['bbox_ok'] and rep['pivot_ok'] and rep['rotating_ok']
            and rep['children_on_axis_ok'] and rep['axis'] == 'z'):
        raise SystemExit('checks failed')


main()
