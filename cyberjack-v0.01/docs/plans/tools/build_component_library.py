"""GLB-библиотека компонентов Cyberjack.

Запуск:
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_component_library.py
  blender -b --factory-startup -noaudio --python docs/plans/tools/build_component_library.py -- --only motion_piston_rod,work_attach_spiral

Выход:
  public/models/machine-modules/components/<id>.glb
  public/models/machine-modules/component-models.json
"""
from pathlib import Path
import argparse
import json
import math
import sys

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'public/models/machine-modules/components'
REVIEW = PROJECT / 'docs/plans/blockout/component-library'
OUT.mkdir(parents=True, exist_ok=True)
REVIEW.mkdir(parents=True, exist_ok=True)

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
    'yellow': (0.960, 0.720, 0.080),
}
MATS = {}


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()


def mat(role, alpha=1.0):
    key = (role, alpha)
    if key in MATS:
        return MATS[key]
    color = PALETTE[role]
    m = bpy.data.materials.new(f'CJ_{role}_{int(alpha * 100)}')
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = 0.62
    bsdf.inputs['Metallic'].default_value = 0.22 if role in ('steel', 'graphite') else 0.0
    if role == 'cyan':
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = 0.45
    if alpha < 1.0:
        bsdf.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
        m.show_transparent_back = False
    m.diffuse_color = (*color, alpha)
    MATS[key] = m
    return m


def apply(obj, role, alpha=1.0, smooth=False):
    obj.data.materials.append(mat(role, alpha))
    if smooth and obj.type == 'MESH':
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def bevel(obj, width=0.01, segments=3):
    mod = obj.modifiers.new('bev', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def cube(name, loc, size, role, r=0.01, smooth=False, alpha=1.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if r > 0:
        bevel(obj, r)
    apply(obj, role, alpha, smooth)
    return obj


def cyl(name, a, b, radius, role, vertices=32, smooth=True, alpha=1.0, r2=None):
    a, b = Vector(a), Vector(b)
    d = b - a
    if d.length < 1e-6:
        raise ValueError(name)
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=d.length,
                                            location=(a + b) * 0.5)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=r2,
                                        depth=d.length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
    apply(obj, role, alpha, smooth)
    return obj


def sphere(name, loc, radius, role, segs=24, rings=14, alpha=1.0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=rings, radius=radius,
                                         location=loc)
    obj = bpy.context.object
    obj.name = name
    apply(obj, role, alpha, True)
    return obj


def torus(name, loc, major, minor, role, axis='Z', segs=36, rings=10, alpha=1.0):
    bpy.ops.mesh.primitive_torus_add(major_segments=segs, minor_segments=rings,
                                     major_radius=major, minor_radius=minor, location=loc)
    obj = bpy.context.object
    obj.name = name
    if axis == 'X':
        obj.rotation_euler = (0, math.pi / 2, 0)
    elif axis == 'Y':
        obj.rotation_euler = (math.pi / 2, 0, 0)
    apply(obj, role, alpha, True)
    return obj


def curve_tube(name, points, radius, role, resolution=2, alpha=1.0):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.resolution_u = 6
    cu.bevel_depth = radius
    cu.bevel_resolution = resolution
    cu.resolution_u = 4
    sp = cu.splines.new('POLY')
    sp.points.add(len(points) - 1)
    for i, p in enumerate(points):
        sp.points[i].co = (*p, 1.0)
    obj = bpy.data.objects.new(name, cu)
    bpy.context.scene.collection.objects.link(obj)
    apply(obj, role, alpha, True)
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.convert(target='MESH')
    return bpy.context.object


def empty(name, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    bpy.context.scene.collection.objects.link(e)
    e.location = loc
    return e


def parent(child, e):
    child.parent = e
    child.matrix_parent_inverse = e.matrix_world.inverted()


def piston(cid):
    # Base and rear mount
    cube(f'{cid}__base', (-0.14, 0, 0.025), (0.40, 0.24, 0.05), 'dark', r=0.018)
    cube(f'{cid}__rear_mount', (-0.33, 0, 0.10), (0.07, 0.18, 0.16), 'steel', r=0.012)
    cube(f'{cid}__rear_foot', (-0.33, 0, 0.02), (0.12, 0.22, 0.04), 'graphite', r=0.012)
    # Main cylinder
    cyl(f'{cid}__body', (-0.33, 0, 0.14), (0.03, 0, 0.14), 0.075, 'body', 32)
    torus(f'{cid}__front_collar', (0.03, 0, 0.14), 0.060, 0.012, 'blush', axis='X')
    cyl(f'{cid}__front_guide', (0.03, 0, 0.14), (0.055, 0, 0.14), 0.045, 'steel', 28)
    # Moving rod (not for cam / telescopic: they have their own moving link)
    anim = empty(f'{cid}__anim')
    if cid not in ('motion_piston_telescopic', 'motion_piston_cam'):
        rod = cyl(f'{cid}__rod', (0.03, 0, 0.14), (0.27, 0, 0.14), 0.020, 'steel', 24)
        tip = sphere(f'{cid}__rod_tip', (0.285, 0, 0.14), 0.032, 'pale', 20, 12)
        parent(rod, anim)
        parent(tip, anim)
    # Status LED + cable
    sphere(f'{cid}__led', (-0.10, 0.085, 0.18), 0.012, 'cyan', 12, 8)
    curve_tube(f'{cid}__cable', [(-0.30, -0.10, 0.02), (-0.34, -0.16, 0.02),
                                 (-0.28, -0.22, 0.02), (-0.18, -0.22, 0.02)], 0.009, 'graphite')

    if cid == 'motion_piston_pneumatic':
        for i, y in enumerate((-0.07, 0.07)):
            cyl(f'{cid}__port_{i}', (-0.24, y, 0.14), (-0.24, y * 1.5, 0.14), 0.018, 'cyan', 16)
            curve_tube(f'{cid}__air_{i}', [(-0.24, y * 1.5, 0.14), (-0.30, y * 1.8, 0.10),
                                            (-0.35, y * 1.8, 0.03)], 0.008, 'cyan')
        cube(f'{cid}__valve', (-0.39, 0, 0.08), (0.06, 0.10, 0.08), 'graphite', r=0.008)
    elif cid == 'motion_piston_hydraulic':
        cube(f'{cid}__pump', (-0.38, 0, 0.09), (0.10, 0.18, 0.14), 'graphite', r=0.01)
        for i, y in enumerate((-0.08, 0.08)):
            curve_tube(f'{cid}__hose_{i}', [(-0.38, y, 0.09), (-0.30, y, 0.05),
                                             (-0.22, y, 0.05), (-0.18, y, 0.10)], 0.010, 'yellow')
        cyl(f'{cid}__gauge', (-0.38, 0.10, 0.16), (-0.38, 0.13, 0.16), 0.028, 'steel', 20)
    elif cid == 'motion_piston_telescopic':
        # outer body static; two stages move together
        stage1 = cyl(f'{cid}__stage_1', (-0.02, 0, 0.14), (0.12, 0, 0.14), 0.052, 'steel', 28)
        stage2 = cyl(f'{cid}__stage_2', (0.08, 0, 0.14), (0.28, 0, 0.14), 0.032, 'pale', 24)
        parent(stage1, anim)
        parent(stage2, anim)
    elif cid == 'motion_piston_cam':
        cyl(f'{cid}__motor', (-0.36, 0, 0.14), (-0.20, 0, 0.14), 0.065, 'graphite', 28)
        cyl(f'{cid}__cam', (-0.19, 0, 0.14), (-0.17, 0, 0.14), 0.075, 'blush', 32)
        cyl(f'{cid}__cam_pin', (-0.18, 0.045, 0.14), (-0.16, 0.045, 0.14), 0.012, 'steel', 12)
        slider = cube(f'{cid}__slider', (0.04, 0, 0.14), (0.14, 0.07, 0.07), 'steel', r=0.01)
        link = cyl(f'{cid}__link', (-0.18, 0.045, 0.14), (0.02, 0.045, 0.14), 0.012, 'pale', 16)
        parent(slider, anim)
        parent(link, anim)
    elif cid == 'motion_piston_servo':
        cyl(f'{cid}__motor', (-0.36, 0, 0.14), (-0.24, 0, 0.14), 0.070, 'graphite', 28)
        torus(f'{cid}__encoder', (-0.36, 0, 0.14), 0.040, 0.012, 'cyan', axis='X')
        cube(f'{cid}__driver', (-0.27, 0.10, 0.10), (0.10, 0.06, 0.08), 'dark', r=0.008)
    else:
        # rod: rear linear guide
        cyl(f'{cid}__guide', (-0.10, 0, 0.14), (0.02, 0, 0.14), 0.050, 'steel', 24)

    cube(f'{cid}__stop', (0.03, -0.11, 0.14), (0.02, 0.03, 0.05), 'red', r=0.004)


def attachment(cid):
    base_z = 0.02
    cube(f'{cid}__mount', (-0.05, 0, 0.012), (0.14, 0.12, 0.024), 'graphite', r=0.009)
    cyl(f'{cid}__base', (-0.12, 0, base_z), (0.0, 0, base_z), 0.030, 'steel', 28)
    torus(f'{cid}__collar', (-0.04, 0, base_z), 0.034, 0.008, 'blush', axis='X')
    cyl(f'{cid}__neck', (0.0, 0, base_z), (0.035, 0, base_z), 0.026, 'steel', 24)
    anim = empty(f'{cid}__anim', (0, 0, base_z))
    x0, x1 = 0.035, 0.175
    mid = (x0 + x1) / 2
    length = x1 - x0

    def add(obj):
        parent(obj, anim)

    if cid == 'work_attach_smooth':
        add(cyl(f'{cid}__head', (x0, 0, base_z), (x1, 0, base_z), 0.036, 'pale', 32))
        add(sphere(f'{cid}__tip', (x1, 0, base_z), 0.036, 'pale', 24, 14))
    elif cid == 'work_attach_ribbed':
        add(cyl(f'{cid}__core', (x0, 0, base_z), (x1, 0, base_z), 0.026, 'blush', 28))
        for i in range(5):
            x = x0 + 0.018 + i * (length - 0.036) / 4
            add(torus(f'{cid}__rib_{i}', (x, 0, base_z), 0.036, 0.009, 'pale', axis='X'))
    elif cid == 'work_attach_spiral':
        add(cyl(f'{cid}__core', (x0, 0, base_z), (x1, 0, base_z), 0.028, 'pale', 28))
        pts = []
        turns = 3.2
        for i in range(80):
            t = i / 79
            a = turns * math.tau * t
            pts.append((x0 + 0.01 + (length - 0.02) * t,
                        0.034 * math.cos(a), base_z + 0.034 * math.sin(a)))
        add(curve_tube(f'{cid}__helix', pts, 0.007, 'blush', 2))
    elif cid == 'work_attach_nodular':
        add(cyl(f'{cid}__core', (x0, 0, base_z), (x1, 0, base_z), 0.026, 'pale', 28))
        for i in range(8):
            a = i * math.tau / 8
            x = x0 + 0.02 + (i % 4) * 0.035
            add(sphere(f'{cid}__node_{i}', (x, 0.034 * math.cos(a), base_z + 0.034 * math.sin(a)),
                       0.014, 'blush', 14, 10))
    elif cid == 'work_attach_tapered':
        add(cyl(f'{cid}__cone', (x0, 0, base_z), (x1, 0, base_z), 0.022, 'pale', 32, r2=0.046))
        add(sphere(f'{cid}__tip', (x1, 0, base_z), 0.020, 'pale', 20, 12))
    elif cid == 'work_attach_bulbous':
        add(cyl(f'{cid}__stem', (x0, 0, base_z), (x1 - 0.03, 0, base_z), 0.028, 'pale', 28))
        add(sphere(f'{cid}__bulb', (x1 - 0.015, 0, base_z), 0.052, 'blush', 28, 16))
    elif cid == 'work_attach_curved':
        pts = [(x0, 0, base_z), (0.07, 0, base_z + 0.004), (0.11, 0, base_z + 0.030),
               (0.155, 0, base_z + 0.070), (0.175, 0, base_z + 0.085)]
        add(curve_tube(f'{cid}__curve', pts, 0.028, 'pale', 3))
        add(sphere(f'{cid}__tip', (0.178, 0, base_z + 0.088), 0.028, 'blush', 20, 12))
    elif cid == 'work_attach_dual_density':
        add(cyl(f'{cid}__core', (x0, 0, base_z), (x1, 0, base_z), 0.020, 'graphite', 24))
        add(cyl(f'{cid}__shell', (x0 + 0.005, 0, base_z), (x1 - 0.005, 0, base_z), 0.040, 'pale', 32, alpha=0.72))
        add(sphere(f'{cid}__tip', (x1, 0, base_z), 0.040, 'pale', 24, 14, alpha=0.72))
    elif cid == 'work_attach_vibrating':
        add(cyl(f'{cid}__head', (x0, 0, base_z), (x1 - 0.02, 0, base_z), 0.034, 'pale', 28))
        add(sphere(f'{cid}__tip', (x1, 0, base_z), 0.034, 'pale', 20, 12))
        add(cyl(f'{cid}__motor', (0.08, 0, base_z + 0.045), (0.12, 0, base_z + 0.045), 0.012, 'graphite', 16))
        add(sphere(f'{cid}__led', (0.05, 0, base_z + 0.042), 0.008, 'cyan', 10, 8))
        curve_tube(f'{cid}__cable', [(0.10, 0, base_z + 0.05), (0.02, 0.03, base_z + 0.05),
                                      (-0.02, 0.03, base_z)], 0.005, 'graphite')
    elif cid == 'work_attach_inflatable':
        add(cyl(f'{cid}__core', (x0, 0, base_z), (x1, 0, base_z), 0.018, 'steel', 20))
        add(cyl(f'{cid}__chamber', (x0 + 0.01, 0, base_z), (x1 - 0.01, 0, base_z), 0.045, 'pale', 32, alpha=0.82))
        add(sphere(f'{cid}__tip', (x1, 0, base_z), 0.045, 'pale', 20, 12, alpha=0.82))
        curve_tube(f'{cid}__air', [(-0.08, 0.04, base_z), (-0.02, 0.06, base_z + 0.02),
                                    (0.04, 0.05, base_z + 0.03)], 0.007, 'cyan')
    elif cid == 'work_attach_sleeve':
        add(cyl(f'{cid}__sleeve', (x0, 0, base_z), (x1, 0, base_z), 0.038, 'pale', 32, alpha=0.55))
    elif cid == 'work_attach_adapter':
        add(cyl(f'{cid}__adapter', (x0, 0, base_z), (0.09, 0, base_z), 0.030, 'steel', 24))
        add(torus(f'{cid}__ring', (0.09, 0, base_z), 0.030, 0.008, 'blush', axis='X'))
        for i in range(3):
            a = i * math.tau / 3
            add(cyl(f'{cid}__pin_{i}', (0.09, 0.018 * math.cos(a), base_z + 0.018 * math.sin(a)),
                    (0.105, 0.018 * math.cos(a), base_z + 0.018 * math.sin(a)), 0.006, 'pale', 10))
    elif cid == 'work_attach_sterile_liner':
        add(cyl(f'{cid}__liner', (x0, 0, base_z), (x1, 0, base_z), 0.036, 'pale', 32, alpha=0.35))
    elif cid == 'work_attach_carousel':
        # separate layout: vertical magazine; base static, disc + sockets spin
        for obj in list(bpy.data.objects):
            if obj.name.startswith(cid + '__'):
                bpy.data.objects.remove(obj, do_unlink=True)
        cube(f'{cid}__foot', (0, 0, 0.025), (0.22, 0.22, 0.05), 'dark', r=0.018)
        cyl(f'{cid}__post', (0, 0, 0.05), (0, 0, 0.16), 0.032, 'steel', 24)
        anim = empty(f'{cid}__anim', (0, 0, 0.18))
        disc = cyl(f'{cid}__disc', (0, 0, 0.16), (0, 0, 0.19), 0.145, 'body', 48)
        parent(disc, anim)
        for i in range(6):
            a = i * math.tau / 6
            x, y = 0.095 * math.cos(a), 0.095 * math.sin(a)
            sock = cyl(f'{cid}__socket_{i}', (x, y, 0.19), (x, y, 0.205), 0.028, 'graphite', 20)
            stub = cyl(f'{cid}__stub_{i}', (x, y, 0.205), (x, y, 0.235), 0.018, 'pale', 16)
            parent(sock, anim)
            parent(stub, anim)
        cube(f'{cid}__arm', (0.12, 0, 0.27), (0.18, 0.03, 0.03), 'blush', r=0.008)
        cyl(f'{cid}__arm_post', (0.12, 0, 0.19), (0.12, 0, 0.27), 0.012, 'steel', 16)
    else:
        raise KeyError(cid)

    # cable/status for all attachments
    sphere(f'{cid}__led', (-0.09, 0.028, base_z + 0.02), 0.007, 'cyan', 10, 8)


def sphere_scaled(name, loc, scale, role, segs=24, rings=14, alpha=1.0):
    obj = sphere(name, loc, 1.0, role, segs, rings, alpha)
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return obj


def plate(cid, size, z=0.03, role='dark', r=0.018):
    return cube(f'{cid}__plate', (0, 0, z), (size[0], size[1], z * 2), role, r=r)


def brush_unit(cid, tag, x, z, radius=0.06, bristle_len=0.08, role='pale', stiff=False):
    motor = cyl(f'{cid}__{tag}_motor', (x - 0.12, 0, z), (x - 0.02, 0, z), radius * 0.72, 'blush', 28)
    ring = torus(f'{cid}__{tag}_ring', (x, 0, z), radius, 0.012, role, axis='X')
    parts = [ring]
    for i in range(10):
        a = i * math.tau / 10
        p0 = (x, (radius - 0.006) * math.cos(a), z + (radius - 0.006) * math.sin(a))
        p1 = (x, (radius + bristle_len) * math.cos(a), z + (radius + bristle_len) * math.sin(a))
        parts.append(cyl(f'{cid}__{tag}_bristle_{i}', p0, p1, 0.006 if stiff else 0.004,
                         'steel' if stiff else role, 8))
    return motor, parts


def cuff_ring(cid, tag, loc, major=0.085, minor=0.018, role='pale', axis='X'):
    ring = torus(f'{cid}__{tag}_ring', loc, major, minor, role, axis=axis)
    strap = cube(f'{cid}__{tag}_strap', (loc[0], loc[1], loc[2] + major + 0.02),
                 (0.035, 0.035, major * 1.5), 'graphite', r=0.008)
    buckle = cube(f'{cid}__{tag}_buckle', (loc[0], loc[1], loc[2] + major * 2 + 0.03),
                  (0.05, 0.04, 0.025), 'steel', r=0.006)
    return [ring, strap, buckle]


def generic(cid):
    # STRUCTURE
    if cid == 'structure_gantry':
        for x in (-0.55, 0.55):
            for y in (-0.28, 0.28):
                cube(f'{cid}__post_{x}_{y}', (x, y, 0.9), (0.08, 0.08, 1.8), 'body', r=0.02)
        for y in (-0.28, 0.28):
            cube(f'{cid}__beam_{y}', (0, y, 1.78), (1.3, 0.10, 0.10), 'steel', r=0.015)
        for x in (-0.55, 0.55):
            cube(f'{cid}__cross_{x}', (x, 0, 1.78), (0.10, 0.64, 0.10), 'steel', r=0.015)
        carriage = cube(f'{cid}__carriage', (0, 0, 1.65), (0.24, 0.20, 0.12), 'graphite', r=0.015)
        anim = empty(f'{cid}__anim')
        parent(carriage, anim)
        cube(f'{cid}__head_mount', (0, -0.02, 1.54), (0.14, 0.12, 0.12), 'blush', r=0.02)
    elif cid == 'structure_bed_frame':
        plate(cid, (1.5, 0.82), z=0.07, role='body', r=0.035)
        for x in (-0.65, 0.65):
            for y in (-0.34, 0.34):
                cyl(f'{cid}__leg_{x}_{y}', (x, y, 0.0), (x, y, 0.08), 0.035, 'graphite', 16)
        for y in (-0.40, 0.40):
            cyl(f'{cid}__rail_{y}', (-0.68, y, 0.16), (0.68, y, 0.16), 0.018, 'steel', 20)
        for x in (-0.55, 0.55):
            cube(f'{cid}__end_{x}', (x, 0, 0.14), (0.08, 0.72, 0.12), 'graphite', r=0.012)
    elif cid == 'structure_cage':
        for x in (-0.55, 0.55):
            for y in (-0.45, 0.45):
                cube(f'{cid}__post_{x}_{y}', (x, y, 0.9), (0.07, 0.07, 1.8), 'body', r=0.018)
        for y in (-0.45, 0.45):
            cube(f'{cid}__beam_{y}', (0, y, 1.78), (1.15, 0.08, 0.08), 'steel', r=0.012)
        for x in (-0.55, 0.55):
            cube(f'{cid}__side_{x}', (x, 0, 0.9), (0.03, 0.88, 1.7), 'ivory', r=0.01, alpha=0.35)
        cube(f'{cid}__back', (0, 0.45, 0.9), (1.1, 0.03, 1.7), 'ivory', r=0.01, alpha=0.35)
        cube(f'{cid}__door', (0, -0.45, 0.9), (0.9, 0.04, 1.6), 'ivory', r=0.01, alpha=0.3)
    elif cid == 'structure_suspension_frame':
        for x in (-0.55, 0.55):
            cube(f'{cid}__post_{x}', (x, 0, 1.0), (0.10, 0.10, 2.0), 'body', r=0.02)
        cube(f'{cid}__beam', (0, 0, 2.0), (1.2, 0.12, 0.12), 'steel', r=0.015)
        drum = cyl(f'{cid}__winch', (-0.25, 0, 1.88), (0.05, 0, 1.88), 0.10, 'graphite', 28)
        cable = curve_tube(f'{cid}__cable', [(0.05, 0, 1.88), (0.05, 0, 1.55),
                                             (0.05, 0, 1.15)], 0.008, 'graphite')
        cube(f'{cid}__hook', (0.05, 0, 1.05), (0.06, 0.06, 0.10), 'steel', r=0.01)
        anim = empty(f'{cid}__anim')
        parent(drum, anim)
    elif cid == 'structure_stall_row':
        for i in range(3):
            x = (i - 1) * 0.55
            for y in (-0.35, 0.35):
                cube(f'{cid}__post_{i}_{y}', (x, y, 0.9), (0.06, 0.06, 1.8), 'body', r=0.015)
            cube(f'{cid}__roof_{i}', (x, 0, 1.78), (0.50, 0.74, 0.06), 'body', r=0.012)
            cube(f'{cid}__divider_{i}', (x + 0.27, 0, 0.9), (0.03, 0.68, 1.65), 'ivory', r=0.008)
    elif cid == 'structure_dock':
        plate(cid, (0.55, 0.42), z=0.04, role='graphite', r=0.02)
        for i, (x, y) in enumerate(((-0.18, -0.12), (0.18, -0.12), (-0.18, 0.12), (0.18, 0.12))):
            cyl(f'{cid}__socket_{i}', (x, y, 0.04), (x, y, 0.12), 0.035, 'steel', 20)
        cube(f'{cid}__connector', (0, 0.18, 0.08), (0.12, 0.05, 0.06), 'cyan', r=0.006)

    # MOTION
    elif cid == 'motion_linear_y':
        for x in (-0.35, 0.35):
            cyl(f'{cid}__rail_{x}', (x, -0.45, 0.16), (x, 0.45, 0.16), 0.018, 'steel', 20)
        plate(cid, (0.8, 0.9), z=0.04, role='body', r=0.02)
        carriage = cube(f'{cid}__carriage', (0, 0, 0.22), (0.55, 0.22, 0.10), 'graphite', r=0.012)
        anim = empty(f'{cid}__anim')
        parent(carriage, anim)
    elif cid == 'motion_rotary':
        plate(cid, (0.5, 0.4), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__motor', (-0.15, 0, 0.18), (0.05, 0, 0.18), 0.10, 'graphite', 28)
        flange = cyl(f'{cid}__flange', (0.05, 0, 0.18), (0.10, 0, 0.18), 0.13, 'blush', 32)
        anim = empty(f'{cid}__anim')
        parent(flange, anim)
    elif cid == 'motion_oscillating':
        plate(cid, (0.8, 0.5), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__motor', (-0.22, 0, 0.18), (-0.08, 0, 0.18), 0.09, 'graphite', 28)
        disc = cyl(f'{cid}__crank', (-0.07, 0, 0.18), (-0.05, 0, 0.18), 0.07, 'blush', 28)
        link = cyl(f'{cid}__link', (-0.07, 0.035, 0.18), (0.15, 0.035, 0.18), 0.012, 'pale', 16)
        slider = cube(f'{cid}__slider', (0.20, 0.035, 0.18), (0.16, 0.07, 0.07), 'steel', r=0.01)
        anim = empty(f'{cid}__anim')
        parent(slider, anim)
        parent(link, anim)
        parent(disc, anim)
    elif cid == 'motion_spreader':
        plate(cid, (0.85, 0.4), z=0.04, role='body', r=0.02)
        cube(f'{cid}__beam', (0, 0, 0.14), (0.75, 0.10, 0.10), 'steel', r=0.012)
        for side, y in (('L', -0.30), ('R', 0.30)):
            arm = cube(f'{cid}__arm_{side}', (0, y, 0.30), (0.12, 0.18, 0.05), 'blush', r=0.012)
            cuff = torus(f'{cid}__cuff_{side}', (0, y, 0.42), 0.075, 0.018, 'pale', axis='X')
            anim = empty(f'{cid}__anim_{side}')
            parent(arm, anim)
            parent(cuff, anim)
    elif cid == 'motion_winch':
        plate(cid, (0.55, 0.4), z=0.04, role='body', r=0.02)
        for y in (-0.12, 0.12):
            cube(f'{cid}__post_{y}', (0, y, 0.25), (0.08, 0.06, 0.40), 'steel', r=0.01)
        drum = cyl(f'{cid}__drum', (-0.20, 0, 0.45), (0.20, 0, 0.45), 0.10, 'graphite', 28)
        curve_tube(f'{cid}__cable', [(0.0, 0, 0.45), (0.0, 0, 0.25), (0.0, -0.10, 0.10)], 0.007, 'graphite')
        cube(f'{cid}__hook', (0.0, -0.10, 0.06), (0.06, 0.06, 0.08), 'steel', r=0.008)
        anim = empty(f'{cid}__anim')
        parent(drum, anim)
    elif cid == 'motion_turntable':
        plate(cid, (0.55, 0.55), z=0.04, role='body', r=0.025)
        disc = cyl(f'{cid}__disc', (0, 0, 0.10), (0, 0, 0.16), 0.24, 'graphite', 48)
        top = cyl(f'{cid}__top', (0, 0, 0.16), (0, 0, 0.19), 0.22, 'blush', 48)
        anim = empty(f'{cid}__anim')
        parent(disc, anim)
        parent(top, anim)

    # WORK
    elif cid in ('work_tickle_soft', 'work_tickle_firm', 'work_tickle_radial', 'work_tickle_pair'):
        stiff = cid == 'work_tickle_firm'
        if cid == 'work_tickle_pair':
            for i, y in enumerate((-0.18, 0.18)):
                motor, parts = brush_unit(cid, f'brush_{i}', 0.0, 0.30, 0.055, 0.06, 'pale', stiff)
                anim = empty(f'{cid}__anim_{i}')
                parent(parts[0], anim)
                for p in parts[1:]:
                    parent(p, anim)
            cube(f'{cid}__bar', (0, 0, 0.30), (0.10, 0.55, 0.06), 'graphite', r=0.01)
        else:
            motor, parts = brush_unit(cid, 'brush', 0.0, 0.30, 0.065 if cid != 'work_tickle_radial' else 0.08,
                                      0.09 if not stiff else 0.05, 'pale', stiff)
            anim = empty(f'{cid}__anim')
            for p in parts:
                parent(p, anim)
            plate(cid, (0.5, 0.4), z=0.04, role='body', r=0.02)
    elif cid == 'work_feather_fan':
        plate(cid, (0.45, 0.35), z=0.04, role='body', r=0.02)
        handle = cyl(f'{cid}__handle', (-0.12, 0, 0.22), (0.05, 0, 0.22), 0.030, 'steel', 24)
        anim = empty(f'{cid}__anim')
        for i in range(9):
            a = (i - 4) * 0.12
            pts = [(0.05, 0.02 * math.sin(a), 0.22 + 0.02 * math.cos(a)),
                   (0.14, 0.10 * math.sin(a), 0.22 + 0.10 * math.cos(a)),
                   (0.24, 0.18 * math.sin(a), 0.22 + 0.18 * math.cos(a))]
            feather = curve_tube(f'{cid}__feather_{i}', pts, 0.006, 'pale', 1)
            parent(feather, anim)
    elif cid == 'work_foot_cradle':
        plate(cid, (0.55, 0.30), z=0.04, role='body', r=0.02)
        cube(f'{cid}__sole', (0, 0, 0.12), (0.42, 0.16, 0.08), 'pale', r=0.03)
        anim = empty(f'{cid}__anim')
        for i, x in enumerate((-0.15, -0.05, 0.05, 0.15)):
            roller = cyl(f'{cid}__roller_{i}', (x, -0.12, 0.18), (x, 0.12, 0.18), 0.035, 'blush', 20)
            parent(roller, anim)
    elif cid == 'work_air_jet':
        plate(cid, (0.5, 0.35), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__body', (-0.15, 0, 0.22), (0.05, 0, 0.22), 0.06, 'graphite', 24)
        cyl(f'{cid}__nozzle', (0.05, 0, 0.22), (0.16, 0, 0.22), 0.025, 'steel', 20)
        cone = cyl(f'{cid}__jet', (0.16, 0, 0.22), (0.34, 0, 0.22), 0.02, 'cyan', 24, alpha=0.35, r2=0.09)
        curve_tube(f'{cid}__hose', [(-0.15, 0, 0.22), (-0.22, 0.02, 0.10), (-0.22, 0.02, 0.02)], 0.008, 'cyan')
    elif cid in ('work_probe_inflatable', 'work_probe_thermal', 'work_probe_textured'):
        plate(cid, (0.5, 0.35), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__body', (-0.18, 0, 0.22), (0.02, 0, 0.22), 0.06, 'graphite', 28)
        anim = empty(f'{cid}__anim')
        if cid == 'work_probe_inflatable':
            chamber = cyl(f'{cid}__chamber', (0.02, 0, 0.22), (0.22, 0, 0.22), 0.055, 'pale', 32, alpha=0.75)
            tip = sphere(f'{cid}__tip', (0.23, 0, 0.22), 0.055, 'pale', 24, 14, alpha=0.75)
            curve_tube(f'{cid}__air', [(-0.12, 0.04, 0.22), (-0.05, 0.08, 0.16), (0.02, 0.06, 0.14)], 0.007, 'cyan')
        elif cid == 'work_probe_thermal':
            chamber = cyl(f'{cid}__tip', (0.02, 0, 0.22), (0.22, 0, 0.22), 0.045, 'pale', 28)
            tip = sphere(f'{cid}__tip_end', (0.23, 0, 0.22), 0.045, 'red', 24, 14)
            for i in range(3):
                torus(f'{cid}__coil_{i}', (0.08 + i * 0.05, 0, 0.22), 0.046, 0.006, 'red', axis='X')
        else:
            chamber = cyl(f'{cid}__tip', (0.02, 0, 0.22), (0.22, 0, 0.22), 0.045, 'pale', 28)
            for i in range(4):
                torus(f'{cid}__rib_{i}', (0.06 + i * 0.045, 0, 0.22), 0.050, 0.010, 'blush', axis='X')
            tip = sphere(f'{cid}__tip_end', (0.23, 0, 0.22), 0.045, 'pale', 24, 14)
        parent(chamber, anim)
        parent(tip, anim)
    elif cid == 'work_probe_rotary':
        plate(cid, (0.5, 0.35), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__body', (-0.18, 0, 0.22), (0.02, 0, 0.22), 0.06, 'graphite', 28)
        anim = empty(f'{cid}__anim')
        rotor = cyl(f'{cid}__rotor', (0.02, 0, 0.22), (0.20, 0, 0.22), 0.045, 'blush', 32)
        tip = sphere(f'{cid}__tip', (0.21, 0, 0.22), 0.045, 'pale', 24, 14)
        parent(rotor, anim)
        parent(tip, anim)
    elif cid == 'work_rotary_disc':
        plate(cid, (0.5, 0.45), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__body', (-0.16, 0, 0.24), (0.0, 0, 0.24), 0.07, 'graphite', 28)
        anim = empty(f'{cid}__anim')
        disc = cyl(f'{cid}__disc', (0.0, 0, 0.24), (0.03, 0, 0.24), 0.20, 'blush', 40)
        parent(disc, anim)
        for i in range(6):
            a = i * math.tau / 6
            paddle = cube(f'{cid}__paddle_{i}', (0.03, 0.14 * math.cos(a), 0.24 + 0.14 * math.sin(a)),
                          (0.04, 0.06, 0.10), 'pale', r=0.008)
            parent(paddle, anim)
    elif cid == 'work_rotary_drum':
        plate(cid, (0.6, 0.45), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__body', (-0.18, 0, 0.28), (0.0, 0, 0.28), 0.07, 'graphite', 28)
        anim = empty(f'{cid}__anim')
        drum = cyl(f'{cid}__drum', (0.0, 0, 0.28), (0.28, 0, 0.28), 0.13, 'blush', 40)
        parent(drum, anim)
        for i in range(8):
            a = i * math.tau / 8
            stub = sphere(f'{cid}__stub_{i}', (0.14, 0.13 * math.cos(a), 0.28 + 0.13 * math.sin(a)),
                          0.025, 'pale', 14, 10)
            parent(stub, anim)
    elif cid == 'work_impact_paddle':
        plate(cid, (0.55, 0.4), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__motor', (-0.18, 0, 0.26), (0.0, 0, 0.26), 0.08, 'graphite', 28)
        anim = empty(f'{cid}__anim')
        paddle = cube(f'{cid}__paddle', (0.12, 0, 0.26), (0.18, 0.10, 0.12), 'blush', r=0.025)
        parent(paddle, anim)
    elif cid == 'work_impact_roller':
        plate(cid, (0.6, 0.45), z=0.04, role='body', r=0.02)
        for x in (-0.18, 0.18):
            cube(f'{cid}__post_{x}', (x, 0, 0.22), (0.06, 0.10, 0.30), 'steel', r=0.01)
        anim = empty(f'{cid}__anim')
        roller = cyl(f'{cid}__roller', (0, -0.20, 0.26), (0, 0.20, 0.26), 0.10, 'blush', 36)
        parent(roller, anim)
    elif cid in ('work_electro_pad', 'work_thermal_pad'):
        plate(cid, (0.7, 0.5), z=0.04, role='body', r=0.02)
        pad = cube(f'{cid}__pad', (0, 0, 0.12), (0.55, 0.36, 0.08), 'pale', r=0.025)
        for i in range(6):
            x = -0.22 + i * 0.088
            cube(f'{cid}__strip_{i}', (x, 0, 0.165), (0.012, 0.30, 0.006),
                 'cyan' if cid == 'work_electro_pad' else 'red', r=0.002)
        anim = empty(f'{cid}__anim')
    elif cid == 'work_electro_collar':
        plate(cid, (0.45, 0.4), z=0.04, role='body', r=0.02)
        collar = torus(f'{cid}__collar', (0, 0, 0.30), 0.11, 0.025, 'pale', axis='Z')
        for i in range(4):
            a = i * math.tau / 4
            cyl(f'{cid}__contact_{i}', (0.10 * math.cos(a), 0.10 * math.sin(a), 0.30),
                (0.12 * math.cos(a), 0.12 * math.sin(a), 0.30), 0.008, 'cyan', 10)
        anim = empty(f'{cid}__anim')

    # FLUID
    elif cid in ('work_spray', 'work_irrigation', 'work_suction', 'fluid_mixer'):
        plate(cid, (0.55, 0.45), z=0.04, role='body', r=0.02)
        if cid == 'work_spray':
            cube(f'{cid}__tank', (-0.14, 0, 0.20), (0.20, 0.24, 0.26), 'ivory', r=0.02)
            cyl(f'{cid}__nozzle', (0.02, 0, 0.22), (0.16, 0, 0.22), 0.022, 'steel', 20)
            cyl(f'{cid}__cone', (0.16, 0, 0.22), (0.32, 0, 0.22), 0.02, 'cyan', 24, alpha=0.3, r2=0.08)
        elif cid == 'work_irrigation':
            cube(f'{cid}__head', (0.02, 0, 0.22), (0.18, 0.24, 0.13), 'blush', r=0.018)
            for i in range(5):
                y = -0.08 + i * 0.04
                cyl(f'{cid}__jet_{i}', (0.11, y, 0.22), (0.18, y, 0.22), 0.007, 'cyan', 8)
            curve_tube(f'{cid}__hose', [(-0.10, 0, 0.22), (-0.20, 0.03, 0.12), (-0.20, 0.03, 0.02)], 0.010, 'cyan')
        elif cid == 'work_suction':
            cyl(f'{cid}__canister', (-0.16, 0, 0.22), (-0.16, 0, 0.42), 0.10, 'ivory', 28)
            cyl(f'{cid}__cup', (0.02, 0, 0.22), (0.14, 0, 0.22), 0.06, 'pale', 28, r2=0.09)
            curve_tube(f'{cid}__hose', [(-0.10, 0, 0.42), (0.0, 0.04, 0.36), (0.10, 0.02, 0.26)], 0.010, 'cyan')
        else:
            cube(f'{cid}__tank', (-0.12, 0, 0.22), (0.22, 0.24, 0.30), 'ivory', r=0.025)
            cyl(f'{cid}__motor', (0.02, 0, 0.34), (0.14, 0, 0.34), 0.06, 'graphite', 24)
            cyl(f'{cid}__shaft', (0.14, 0, 0.34), (0.20, 0, 0.34), 0.012, 'steel', 12)
            cube(f'{cid}__paddle', (0.22, 0, 0.34), (0.04, 0.10, 0.10), 'blush', r=0.006)
        anim = empty(f'{cid}__anim')
    elif cid == 'work_roller':
        plate(cid, (0.55, 0.4), z=0.04, role='body', r=0.02)
        cube(f'{cid}__handle', (-0.16, 0, 0.25), (0.18, 0.10, 0.08), 'graphite', r=0.02)
        anim = empty(f'{cid}__anim')
        roller = cyl(f'{cid}__roller', (0.05, -0.18, 0.22), (0.05, 0.18, 0.22), 0.09, 'pale', 32)
        parent(roller, anim)

    # RESTRAINT
    elif cid in ('restraint_wrist_cuff', 'restraint_ankle_cuff', 'restraint_suspension_cuff'):
        major = 0.075 if cid == 'restraint_wrist_cuff' else 0.10
        cuff_ring(cid, 'cuff', (0, 0, 0.18), major, 0.018, 'pale', 'X')
        if cid == 'restraint_suspension_cuff':
            cyl(f'{cid}__post', (0, 0, 0.28), (0, 0, 0.55), 0.018, 'steel', 16)
            cube(f'{cid}__hook', (0, 0, 0.58), (0.08, 0.04, 0.06), 'steel', r=0.008)
        else:
            cube(f'{cid}__base', (0, 0, 0.03), (0.30, 0.24, 0.06), 'dark', r=0.015)
    elif cid == 'restraint_thigh_clamp':
        plate(cid, (0.4, 0.3), z=0.04, role='body', r=0.02)
        for y in (-0.12, 0.12):
            cube(f'{cid}__jaw_{y}', (0, y, 0.20), (0.26, 0.08, 0.16), 'steel', r=0.03)
        cyl(f'{cid}__screw', (0, -0.20, 0.20), (0, 0.20, 0.20), 0.012, 'graphite', 12)
    elif cid == 'restraint_waist_belt':
        plate(cid, (0.45, 0.35), z=0.04, role='body', r=0.02)
        torus(f'{cid}__belt', (0, 0, 0.25), 0.22, 0.025, 'pale', axis='Z')
        cube(f'{cid}__buckle', (0.20, 0, 0.25), (0.06, 0.10, 0.06), 'steel', r=0.008)
    elif cid == 'restraint_neck_yoke':
        plate(cid, (0.45, 0.35), z=0.04, role='body', r=0.02)
        cube(f'{cid}__back', (0, 0.14, 0.30), (0.30, 0.06, 0.18), 'pale', r=0.02)
        for x in (-0.15, 0.15):
            cube(f'{cid}__arm_{x}', (x, 0.02, 0.30), (0.06, 0.22, 0.10), 'pale', r=0.015)
        for x in (-0.15, 0.15):
            cube(f'{cid}__pad_{x}', (x, -0.10, 0.30), (0.06, 0.08, 0.14), 'blush', r=0.015)
    elif cid == 'restraint_head_frame':
        plate(cid, (0.55, 0.4), z=0.04, role='body', r=0.02)
        for x in (-0.18, 0.18):
            cube(f'{cid}__post_{x}', (x, 0.12, 0.28), (0.06, 0.06, 0.36), 'steel', r=0.01)
        cube(f'{cid}__top', (0, 0.12, 0.46), (0.42, 0.06, 0.06), 'steel', r=0.01)
        cube(f'{cid}__pad', (0, -0.02, 0.28), (0.24, 0.12, 0.08), 'pale', r=0.02)
    elif cid == 'restraint_stirrup':
        plate(cid, (0.5, 0.4), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__post', (0, 0.10, 0.10), (0, 0.10, 0.55), 0.025, 'steel', 20)
        cube(f'{cid}__u_bottom', (0, -0.05, 0.58), (0.30, 0.06, 0.05), 'steel', r=0.01)
        for x in (-0.15, 0.15):
            cube(f'{cid}__u_arm_{x}', (x, -0.02, 0.66), (0.05, 0.06, 0.22), 'steel', r=0.01)
        cube(f'{cid}__pad', (0, -0.02, 0.58), (0.24, 0.12, 0.04), 'pale', r=0.01)
    elif cid == 'restraint_spreader':
        plate(cid, (0.7, 0.35), z=0.04, role='body', r=0.02)
        cube(f'{cid}__bar', (0, 0, 0.28), (0.60, 0.06, 0.06), 'steel', r=0.01)
        for x in (-0.28, 0.28):
            cuff_ring(cid, f'cuff_{x}', (x, 0, 0.28), 0.08, 0.018, 'pale', 'X')
    elif cid == 'restraint_quick_release':
        plate(cid, (0.4, 0.3), z=0.04, role='body', r=0.02)
        cube(f'{cid}__buckle', (0, 0, 0.14), (0.18, 0.12, 0.08), 'steel', r=0.015)
        cube(f'{cid}__lever', (0.12, 0, 0.18), (0.14, 0.04, 0.04), 'blush', r=0.008)
        cube(f'{cid}__strap', (-0.12, 0, 0.14), (0.18, 0.10, 0.02), 'pale', r=0.008)
    elif cid == 'restraint_matrix':
        plate(cid, (1.3, 0.8), z=0.05, role='body', r=0.03)
        for x in (-0.45, 0.45):
            for y in (-0.25, 0.25):
                cuff_ring(cid, f'cuff_{x}_{y}', (x, y, 0.18), 0.075, 0.016, 'pale', 'X')
        cube(f'{cid}__bar', (0, 0, 0.10), (1.0, 0.06, 0.06), 'steel', r=0.01)

    # SURFACE
    elif cid.startswith('surface_'):
        thick = 0.10 if cid == 'surface_soft' else 0.06
        plate(cid, (1.4, 0.8), z=thick / 2 + 0.01, role='body', r=0.03)
        top = cube(f'{cid}__top', (0, 0, thick + 0.02), (1.35, 0.75, 0.04), 'pale', r=0.02)
        if cid == 'surface_anti_slip':
            for i in range(6):
                for j in range(3):
                    sphere(f'{cid}__grip_{i}_{j}', (-0.5 + i * 0.2, -0.22 + j * 0.22, thick + 0.05),
                           0.028, 'blush', 12, 8)
        elif cid == 'surface_heated':
            for i in range(5):
                y = -0.25 + i * 0.125
                curve_tube(f'{cid}__coil_{i}', [(-0.55, y, thick + 0.05), (0, y, thick + 0.05),
                                                 (0.55, y, thick + 0.05)], 0.008, 'red')
        elif cid == 'surface_cooled':
            for i in range(5):
                y = -0.25 + i * 0.125
                cube(f'{cid}__channel_{i}', (0, y, thick + 0.045), (1.1, 0.035, 0.012), 'cyan', r=0.004)
        elif cid == 'surface_fluid_channel':
            for i in range(4):
                y = -0.24 + i * 0.16
                cube(f'{cid}__groove_{i}', (0, y, thick + 0.04), (1.15, 0.06, 0.02), 'graphite', r=0.006)
        elif cid == 'surface_liner':
            cube(f'{cid}__liner', (0, 0, thick + 0.045), (1.30, 0.70, 0.010), 'pale', r=0.005, alpha=0.55)
        elif cid == 'surface_sensor':
            for i in range(8):
                for j in range(4):
                    sphere(f'{cid}__dot_{i}_{j}', (-0.55 + i * 0.157, -0.24 + j * 0.16, thick + 0.05),
                           0.014, 'cyan', 10, 8)
        elif cid == 'surface_contour':
            for i in range(3):
                y = -0.20 + i * 0.20
                torus(f'{cid}__ridge_{i}', (0, y, thick + 0.05), 0.30, 0.035, 'blush', axis='Z')

    # SENSORY
    elif cid == 'sensory_hood':
        plate(cid, (0.55, 0.5), z=0.04, role='body', r=0.02)
        dome = sphere_scaled(f'{cid}__dome', (0, 0, 0.28), (0.24, 0.28, 0.24), 'ivory', 32, 18)
        torus(f'{cid}__rim', (0, -0.12, 0.20), 0.20, 0.02, 'blush', axis='X')
        cube(f'{cid}__visor', (0, -0.24, 0.28), (0.24, 0.02, 0.10), 'cyan', r=0.006, alpha=0.55)
    elif cid == 'sensory_visor':
        plate(cid, (0.45, 0.35), z=0.04, role='body', r=0.02)
        cube(f'{cid}__visor', (0, -0.10, 0.30), (0.32, 0.03, 0.12), 'cyan', r=0.015, alpha=0.55)
        for x in (-0.14, 0.14):
            cube(f'{cid}__strap_{x}', (x, 0.02, 0.30), (0.04, 0.24, 0.03), 'pale', r=0.008)
    elif cid == 'sensory_audio':
        plate(cid, (0.55, 0.4), z=0.04, role='body', r=0.02)
        cube(f'{cid}__bar', (0, 0, 0.32), (0.50, 0.05, 0.05), 'graphite', r=0.01)
        for x in (-0.18, 0.18):
            cyl(f'{cid}__speaker_{x}', (x, 0, 0.34), (x, -0.10, 0.34), 0.06, 'blush', 28)
        curve_tube(f'{cid}__cable', [(-0.25, 0, 0.32), (-0.30, 0.02, 0.12), (-0.25, 0.02, 0.03)], 0.007, 'graphite')
    elif cid == 'sensory_light':
        plate(cid, (0.45, 0.35), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__post', (0, 0.10, 0.04), (0, 0.10, 0.55), 0.02, 'steel', 16)
        cube(f'{cid}__head', (0, 0.05, 0.60), (0.22, 0.14, 0.10), 'graphite', r=0.015)
        cube(f'{cid}__face', (0, -0.02, 0.60), (0.18, 0.01, 0.07), 'cyan', r=0.004)
        for x in (-0.06, 0.06):
            sphere(f'{cid}__led_{x}', (x, -0.02, 0.64), 0.010, 'cyan', 10, 8)

    # CONTROL
    elif cid == 'control_console':
        plate(cid, (0.45, 0.35), z=0.04, role='body', r=0.02)
        cube(f'{cid}__pedestal', (0, 0, 0.35), (0.16, 0.14, 0.60), 'body', r=0.02)
        cube(f'{cid}__head', (0, -0.02, 0.70), (0.34, 0.24, 0.22), 'body', r=0.025)
        cube(f'{cid}__screen', (0, -0.145, 0.72), (0.24, 0.01, 0.14), 'cyan', r=0.004)
        for x in (-0.10, 0.0, 0.10):
            cyl(f'{cid}__button_{x}', (x, -0.145, 0.62), (x, -0.155, 0.62), 0.012, 'steel', 12)
        cyl(f'{cid}__estop', (0.13, -0.145, 0.66), (0.13, -0.16, 0.66), 0.018, 'red', 16)
    elif cid == 'control_telemetry':
        plate(cid, (0.45, 0.35), z=0.04, role='body', r=0.02)
        cube(f'{cid}__box', (0, 0, 0.14), (0.30, 0.22, 0.14), 'graphite', r=0.015)
        cyl(f'{cid}__antenna', (0.10, 0.08, 0.20), (0.10, 0.08, 0.50), 0.008, 'steel', 10)
        for i, x in enumerate((-0.10, -0.03, 0.04)):
            cyl(f'{cid}__port_{i}', (x, -0.12, 0.12), (x, -0.13, 0.12), 0.010, 'cyan', 10)
    elif cid == 'control_estop':
        plate(cid, (0.35, 0.30), z=0.04, role='body', r=0.02)
        cube(f'{cid}__base', (0, 0, 0.12), (0.22, 0.20, 0.10), 'yellow', r=0.015)
        cyl(f'{cid}__stem', (0, 0, 0.17), (0, 0, 0.24), 0.035, 'graphite', 20)
        cyl(f'{cid}__button', (0, 0, 0.24), (0, 0, 0.32), 0.055, 'red', 28)
    elif cid == 'control_interlock':
        plate(cid, (0.45, 0.35), z=0.04, role='body', r=0.02)
        cube(f'{cid}__box', (0, 0, 0.14), (0.28, 0.22, 0.16), 'body', r=0.015)
        cube(f'{cid}__key', (0.08, -0.12, 0.18), (0.06, 0.02, 0.06), 'steel', r=0.006)
        curve_tube(f'{cid}__cable', [(-0.14, 0, 0.10), (-0.24, 0.03, 0.04)], 0.006, 'graphite')

    # UTILITY
    elif cid == 'utility_power':
        plate(cid, (0.55, 0.4), z=0.04, role='body', r=0.02)
        cube(f'{cid}__psu', (0, 0, 0.22), (0.42, 0.26, 0.32), 'graphite', r=0.02)
        for i, x in enumerate((-0.14, 0.0, 0.14)):
            cyl(f'{cid}__socket_{i}', (x, -0.14, 0.20), (x, -0.15, 0.20), 0.025, 'cyan', 14)
        curve_tube(f'{cid}__cable', [(0.20, 0.10, 0.05), (0.35, 0.12, 0.04)], 0.010, 'graphite')
    elif cid == 'utility_data':
        plate(cid, (0.55, 0.4), z=0.04, role='body', r=0.02)
        cube(f'{cid}__switch', (0, 0, 0.16), (0.36, 0.24, 0.20), 'graphite', r=0.02)
        for i, x in enumerate((-0.12, -0.04, 0.04, 0.12)):
            cube(f'{cid}__port_{i}', (x, -0.13, 0.14), (0.05, 0.02, 0.04), 'cyan', r=0.004)
        curve_tube(f'{cid}__cable', [(0.18, 0.10, 0.05), (0.32, 0.12, 0.04)], 0.008, 'graphite')
    elif cid == 'utility_air':
        plate(cid, (0.6, 0.45), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__tank', (-0.18, 0, 0.26), (0.12, 0, 0.26), 0.12, 'body', 32)
        cube(f'{cid}__compressor', (0.20, 0, 0.16), (0.16, 0.20, 0.18), 'graphite', r=0.015)
        curve_tube(f'{cid}__hose', [(0.20, 0, 0.20), (0.12, 0.10, 0.10), (0.05, 0.10, 0.04)], 0.010, 'cyan')
    elif cid == 'utility_water':
        plate(cid, (0.6, 0.45), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__tank', (-0.16, 0, 0.28), (-0.16, 0, 0.50), 0.13, 'ivory', 32)
        cube(f'{cid}__pump', (0.12, 0, 0.14), (0.18, 0.18, 0.16), 'graphite', r=0.015)
        curve_tube(f'{cid}__hose', [(0.12, 0.06, 0.22), (0.20, 0.10, 0.10), (0.24, 0.10, 0.04)], 0.009, 'cyan')
    elif cid == 'utility_drain':
        plate(cid, (0.55, 0.4), z=0.04, role='body', r=0.02)
        cyl(f'{cid}__drain', (0, 0, 0.04), (0, 0, 0.10), 0.12, 'graphite', 28)
        cyl(f'{cid}__pipe', (0.10, 0, 0.04), (0.30, 0, 0.04), 0.04, 'steel', 20)
        for i in range(4):
            cyl(f'{cid}__slot_{i}', (-0.06 + i * 0.04, 0, 0.105), (-0.06 + i * 0.04, 0, 0.107), 0.008, 'cyan', 8)

    # SERVICE
    elif cid == 'service_dock':
        plate(cid, (0.7, 0.5), z=0.05, role='graphite', r=0.02)
        for y in (-0.15, 0.15):
            cyl(f'{cid}__rail_{y}', (-0.30, y, 0.12), (0.30, y, 0.12), 0.018, 'steel', 20)
        cube(f'{cid}__connector', (0, 0.20, 0.14), (0.16, 0.06, 0.08), 'cyan', r=0.008)
        for i, (x, y) in enumerate(((-0.20, -0.10), (0.20, -0.10), (-0.20, 0.10), (0.20, 0.10))):
            cube(f'{cid}__pad_{i}', (x, y, 0.08), (0.10, 0.10, 0.04), 'steel', r=0.008)
    elif cid == 'service_cleaner':
        plate(cid, (0.65, 0.5), z=0.05, role='body', r=0.02)
        cube(f'{cid}__cabinet', (0, 0, 0.35), (0.40, 0.34, 0.60), 'ivory', r=0.025)
        cube(f'{cid}__door', (0, -0.18, 0.35), (0.30, 0.02, 0.48), 'graphite', r=0.01, alpha=0.5)
        for i, x in enumerate((-0.10, 0.0, 0.10)):
            cyl(f'{cid}__nozzle_{i}', (x, -0.20, 0.50), (x, -0.26, 0.46), 0.012, 'cyan', 12)
        cube(f'{cid}__drain', (0, 0.10, 0.08), (0.18, 0.12, 0.04), 'steel', r=0.006)

    else:
        raise KeyError(cid)


PISTON_IDS = [
    'motion_piston_rod', 'motion_piston_pneumatic', 'motion_piston_hydraulic',
    'motion_piston_telescopic', 'motion_piston_cam', 'motion_piston_servo',
]
ATTACH_IDS = [
    'work_attach_smooth', 'work_attach_ribbed', 'work_attach_spiral', 'work_attach_nodular',
    'work_attach_tapered', 'work_attach_bulbous', 'work_attach_curved',
    'work_attach_dual_density', 'work_attach_vibrating', 'work_attach_inflatable',
    'work_attach_sleeve', 'work_attach_adapter', 'work_attach_sterile_liner',
    'work_attach_carousel',
]
GENERIC_IDS = [
    # STRUCTURE — all nine refined separately
    # MOTION — all eight refined separately
    # WORK
    # work_tickle_firm/soft/radial/feather_fan, work_air_jet, work_probe_textured/inflatable/thermal, work_foot_cradle — refined separately
    # FLUID — all five refined separately
    # RESTRAINT — all eleven refined separately
    # SURFACE — all nine refined separately
    # SENSORY — all four refined separately
    # CONTROL — all four refined separately
    # UTILITY — all six refined separately
    # SERVICE — both refined separately
]
BUILDERS = {cid: piston for cid in PISTON_IDS}
BUILDERS.update({cid: attachment for cid in ATTACH_IDS})
BUILDERS.update({cid: generic for cid in GENERIC_IDS})


def export(cid):
    objects = [o for o in bpy.data.objects if o.name.startswith(cid + '__')]
    if not objects:
        raise RuntimeError('no objects for ' + cid)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    path = OUT / f'{cid}.glb'
    bpy.ops.export_scene.gltf(
        filepath=str(path), export_format='GLB', use_selection=True,
        export_apply=True, export_yup=True, export_extras=True,
        export_cameras=False, export_lights=False,
    )
    if not path.is_file() or path.stat().st_size < 1000:
        raise RuntimeError(f'export failed: {path}')
    return path


def main():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', default='')
    args = parser.parse_args(argv)
    wanted = [x.strip() for x in args.only.split(',') if x.strip()] or list(BUILDERS)
    manifest = {}
    for cid in wanted:
        reset()
        BUILDERS[cid](cid)
        path = export(cid)
        manifest[cid] = {
            'file': f'components/{cid}.glb',
            'bytes': path.stat().st_size,
            'parts': len([o for o in bpy.data.objects if o.name.startswith(cid + '__')]),
        }
        print('BUILT', cid, manifest[cid]['bytes'], manifest[cid]['parts'], flush=True)
    mpath = PROJECT / 'public/models/machine-modules/component-models.partial.json'
    mpath.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
    print('DONE', len(wanted), 'models ->', mpath, flush=True)


if __name__ == '__main__':
    main()
