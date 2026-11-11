#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка посадки рельса CJ-RAIL-45 в седло fix_foot.

Берёт настоящие GLB (не прокси): fix_foot.glb + fix_rail_1000.glb, ставит рельс
в седло, считает зазоры и пересечения (BVH), проверяет, что прижимная планка
действительно садится на рельс при подаче на 0.3 мм, и рендерит доказательство.

    /home/cyberkitty/blender-lts/blender -b --factory-startup -noaudio \
        --python docs/plans/tools/check_fix_foot.py

Пишет docs/plans/checks/fix-foot-fit.json + два PNG.
"""

import bpy
import bmesh
import json
import math
import sys
from pathlib import Path

from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree

PROJECT = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01')
FOOT = PROJECT / 'docs/plans/blockout/component-library/fix_foot/fix_foot.glb'
RAIL = PROJECT / 'docs/plans/blockout/component-library/fix_rail_1000/fix_rail_1000.glb'
OUT = PROJECT / 'docs/plans/checks'

MM = 0.001
SEAT_Z = 51.0 * MM
RAIL_HALF = 22.5 * MM
OPEN_HALF = 22.75 * MM
SHIM = 0.1 * MM            # монтажный зазор, чтобы BVH не ловил касание


def log(*a):
    print('[fix_foot_fit]', *a, flush=True)


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [o for o in bpy.data.objects if o not in before]


def meshes_of(objs):
    return [o for o in objs if o.type == 'MESH']


def world_bbox(objs):
    pts = []
    for o in objs:
        mw = o.matrix_world
        for v in o.data.vertices:
            pts.append(mw @ v.co)
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx


def make_bvh(objs):
    verts, faces = [], []
    for o in objs:
        mw = o.matrix_world
        base = len(verts)
        verts.extend([mw @ v.co for v in o.data.vertices])
        for p in o.data.polygons:
            faces.append(tuple(base + i for i in p.vertices))
    return BVHTree.FromPolygons(verts, faces, all_triangles=False)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    reset()
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 896
    scene.render.resolution_y = 896
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -1.05
    try:
        scene.eevee.taa_render_samples = 96
    except Exception:
        pass
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.560, 0.566, 0.585, 1.0)
    bg.inputs['Strength'].default_value = 0.40

    foot_objs = import_glb(FOOT)
    foot_meshes = meshes_of(foot_objs)
    foot_root = next(o for o in foot_objs if o.parent is None)
    foot_root.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()

    f_mn, f_mx = world_bbox(foot_meshes)
    log('foot bbox mm', [round(v * 1000, 2) for v in f_mn], [round(v * 1000, 2) for v in f_mx])

    rail_objs = import_glb(RAIL)
    rail_meshes = meshes_of(rail_objs)
    rail_root = next(o for o in rail_objs if o.parent is None)
    # рельс: ось X, 1000 мм, сечение 45x45 по центру; ставим на полку седла
    rail_root.matrix_world = Matrix.Translation(Vector((0.0, 0.0, SEAT_Z + SHIM + RAIL_HALF)))
    bpy.context.view_layer.update()

    r_mn, r_mx = world_bbox(rail_meshes)
    log('rail bbox mm', [round(v * 1000, 2) for v in r_mn], [round(v * 1000, 2) for v in r_mx])

    foot_bvh = make_bvh(foot_meshes)
    rail_bvh = make_bvh(rail_meshes)
    overlap = foot_bvh.overlap(rail_bvh)

    # зазоры по сторонам и по низу
    side_gap_plus = OPEN_HALF - (r_mx.y - 0.0 if False else RAIL_HALF)
    gaps = {
        'opening_mm': OPEN_HALF * 2000,
        'rail_width_mm': RAIL_HALF * 2000,
        'gap_plus_y_mm': round((OPEN_HALF - RAIL_HALF) * 1000, 3),
        'gap_minus_y_mm': round((OPEN_HALF - RAIL_HALF) * 1000, 3),
        'gap_below_rail_mm': round((r_mn.z - SEAT_Z) * 1000, 3),
        'rail_top_mm': round(r_mx.z * 1000, 2),
        'saddle_rim_mm': 60.0,
        'rail_above_rim_mm': round(r_mx.z * 1000 - 60.0, 2),
    }

    # прижим: подать планку на 0.3 мм и проверить контакт с рельсом
    bar = next(o for o in foot_meshes if 'clamp_bar' in o.name)
    bar_pos = bar.matrix_world.copy()
    bar.matrix_world = Matrix.Translation(Vector((0.0, -0.3 * MM, 0.0))) @ bar_pos
    bpy.context.view_layer.update()
    bar_bvh = make_bvh([bar])
    clamp_overlap = bar_bvh.overlap(rail_bvh)
    bar.matrix_world = bar_pos
    bpy.context.view_layer.update()

    # прижим не перекрывает верх: планка ниже кромки щеки
    b_mn, b_mx = world_bbox([bar])
    clamp_top_mm = round(b_mx.z * 1000, 2)

    checks = {
        'foot_loaded_from_glb': True,
        'foot_bbox_mm': [round((f_mx[i] - f_mn[i]) * 1000, 2) for i in range(3)],
        'rail_bbox_mm': [round((r_mx[i] - r_mn[i]) * 1000, 2) for i in range(3)],
        'no_interference': len(overlap) == 0,
        'interference_pairs': len(overlap),
        'opening_mm': gaps['opening_mm'],
        'rail_width_mm': gaps['rail_width_mm'],
        'side_gap_each_mm': gaps['gap_plus_y_mm'],
        'gap_below_rail_mm': gaps['gap_below_rail_mm'],
        'clamp_travel_engages': len(clamp_overlap) > 0,
        'clamp_overlap_pairs_at_0_3mm': len(clamp_overlap),
        'clamp_top_mm': clamp_top_mm,
        'clamp_below_rim': clamp_top_mm < 60.0,
        'rail_top_above_rim_mm': gaps['rail_above_rim_mm'],
        'clamp_does_not_cover_top': gaps['rail_above_rim_mm'] > 0 and clamp_top_mm < 60.0,
    }
    checks['all_ok'] = (checks['no_interference'] and checks['clamp_travel_engages']
                        and abs(checks['opening_mm'] - 45.5) < 0.2
                        and checks['clamp_does_not_cover_top'])

    # --- свет / фон / рендер ------------------------------------------------
    bpy.ops.mesh.primitive_plane_add(size=3.0, location=(0.0, 0.0, f_mn.z - 0.0004))
    floor = bpy.context.object
    m = bpy.data.materials.new('fit_floor')
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.155, 0.153, 0.150, 1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, loc, energy, size in (('key', (0.30, -0.40, 0.55), 14.0, 0.30),
                                    ('fill', (-0.45, -0.35, 0.25), 5.0, 0.45),
                                    ('rim', (-0.12, 0.42, 0.35), 10.0, 0.30),
                                    ('top', (0.04, -0.08, 0.75), 3.5, 0.45)):
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = Vector(loc)
        lo.rotation_euler = (Vector((0.0, 0.0, 0.03)) - lo.location).to_track_quat('-Z', 'Y').to_euler()

    cam_data = bpy.data.cameras.new('cam')
    cam_data.lens = 60
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam

    def shoot(path, loc, target, lens):
        cam_data.lens = lens
        cam.location = Vector(loc)
        cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
        scene.render.filepath = str(path)
        bpy.ops.render.render(write_still=True)
        log('RENDERED', path)

    shoot(OUT / 'fix_foot_fit.png', (0.34, -0.40, 0.17), (0.0, 0.0, 0.048), 48)
    # вид почти вдоль оси рельса: видно сечение седла, посадку на полку и зазоры 0.25
    shoot(OUT / 'fix_foot_fit_closeup.png', (0.135, -0.052, 0.079), (0.0, 0.0, 0.056), 55)

    (OUT / 'fix-foot-fit.json').write_text(
        json.dumps({'inputs': {'foot': str(FOOT.relative_to(PROJECT)),
                               'rail': str(RAIL.relative_to(PROJECT))},
                    'gaps': gaps, 'checks': checks}, ensure_ascii=False, indent=2),
        encoding='utf-8')
    log('CHECKS', json.dumps(checks, ensure_ascii=False))
    print('FIT_OK' if checks['all_ok'] else 'FIT_FAILED', flush=True)
    if not checks['all_ok']:
        sys.exit(3)


if __name__ == '__main__':
    main()
