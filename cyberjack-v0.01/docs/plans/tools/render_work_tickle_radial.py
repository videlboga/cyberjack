"""4 rakurse renders for work_tickle_radial.glb (standalone, no build script deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_tickle_radial.py

Views: 3/4, front (down the axis), side, close-up of the radial tufts.
Output: docs/plans/blockout/component-library/work_tickle_radial/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_tickle_radial.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/work_tickle_radial'
OUT.mkdir(parents=True, exist_ok=True)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 96
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.960, 0.955, 0.940, 1)
    bg.inputs['Strength'].default_value = 0.45

    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, -0.001))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.86, 0.85, 0.83, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    # солнца: освещённость не зависит от дистанции — объект всего 0.15 м
    for name, direction, energy in [
        ('key', (1.0, -1.1, 1.4), 1.55),
        ('fill', (-1.2, -0.8, 0.5), 0.65),
        ('rim', (0.2, 1.1, 0.9), 1.15),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(18)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()

    bpy.ops.import_scene.gltf(filepath=str(GLB))
    bpy.context.view_layer.update()

    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in sc.objects:
        if o.type != 'MESH' or o.name == 'Plane':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx])
    return mn, mx


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
    sc.render.filepath = str(OUT / f'work_tickle_radial_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn
z0 = 0.080

# 3/4: виден диск, пучки по окружности, кожух и док
shot('3q', (1.10, -1.40, 0.90), center, ortho_scale=max(size) * 1.52)
# front: строго вдоль оси X — читается круг диска и радиальные ряды
shot('front', (1.0, 0.0, 0.0), center, ortho_scale=max(size.y, size.z) * 1.45)
# side: в профиль — толщина диска, ряды пучков, вилка и док
shot('side', (0.0, -1.0, 0.05), center, ortho_scale=max(size.x, size.z) * 1.55)
# close-up: нижняя зона контакта — кончики пучков и кромка кожуха
shot('closeup', (0.55, -0.80, 0.26), (0.004, -0.018, 0.0235),
     dist=0.30, lens=85, res=(900, 780))
