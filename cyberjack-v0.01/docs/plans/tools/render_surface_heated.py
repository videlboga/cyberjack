"""4 rakurse renders for surface_heated.glb (standalone, no build deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_surface_heated.py

Views: 3/4, front (long side), side (short end), close-up of zone tracks + sensor.
Output: docs/plans/blockout/component-library/surface_heated/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/surface_heated.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/surface_heated'
OUT.mkdir(parents=True, exist_ok=True)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 96
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Punchy'
    except TypeError:
        sc.view_settings.look = 'None'
    sc.view_settings.exposure = 0.22
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.958, 0.953, 0.940, 1)
    bg.inputs['Strength'].default_value = 0.55

    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.0016))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.855, 0.848, 0.836, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.15, 1.30), 1.45),
        ('fill', (-1.25, -0.85, 0.55), 0.60),
        ('rim', (0.15, 1.20, 0.85), 1.05),
        ('top', (0.05, 0.05, 1.0), 0.45),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(16)
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


def shot(name, direction, target, ortho_scale=None, dist=1.0, lens=85, res=(900, 760)):
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
        cam.location = Vector(target) + d * 3.0
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
        cam.location = Vector(target) + d * dist
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(OUT / f'surface_heated_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5

shot('3q', (1.10, -1.30, 0.78), (0.0, 0.0, 0.020),
     ortho_scale=2.30, res=(1000, 720))
shot('front', (0.0, -1.0, 0.50), (0.0, 0.0, 0.020),
     ortho_scale=2.20, res=(1100, 620))
shot('side', (-1.0, 0.0, 0.40), (0.0, 0.0, 0.020),
     ortho_scale=1.62, res=(760, 720))
shot('closeup', (0.30, -0.80, 0.44), (0.884, 0.196, 0.040),
     dist=0.64, lens=82, res=(980, 760))
