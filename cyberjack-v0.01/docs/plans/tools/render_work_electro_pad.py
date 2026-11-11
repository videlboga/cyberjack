"""4 renders for work_electro_pad.glb (standalone, no build deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_electro_pad.py

Views: 3/4, front (down +X, sensor side), side (down -Y), close-up of the
hydrogel / electrode grid / sensor tail.
Output: docs/plans/blockout/component-library/work_electro_pad/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_electro_pad.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/work_electro_pad'
OUT.mkdir(parents=True, exist_ok=True)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.955, 0.950, 0.938, 1)
    bg.inputs['Strength'].default_value = 0.55

    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, -0.0016))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.845, 0.835, 0.815, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.15, 1.5), 1.75),
        ('fill', (-1.2, -0.75, 0.55), 0.70),
        ('rim', (0.15, 1.15, 0.95), 1.05),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(20)
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
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx],
          flush=True)
    return mn, mx


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=90,
         res=(900, 760)):
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
    sc.render.filepath = str(OUT / f'work_electro_pad_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn
top = mx.z

shot('3q', (1.20, -1.35, 1.05), center, ortho_scale=max(size.x, size.y) * 1.42)
shot('front', (1.0, -0.08, 0.26), center, ortho_scale=max(size.x, size.y) * 1.42)
shot('side', (0.05, -1.0, 0.22), center, ortho_scale=max(size.x, size.y) * 1.42)
shot('closeup', (0.60, -0.78, 0.46), (0.014, -0.006, 0.0045),
     dist=0.118, lens=95, res=(960, 800))
