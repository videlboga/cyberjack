"""4 renders for work_probe_thermal.glb (standalone, no build deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_probe_thermal.py

Views: 3/4, front (down +X — LED/temp scale side), side (down -Y — cable
and quick-release lever), close-up of the heater sleeve / sensor tip.
Output: docs/plans/blockout/component-library/work_probe_thermal/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_probe_thermal.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/work_probe_thermal'
OUT.mkdir(parents=True, exist_ok=True)
CID = 'work_probe_thermal'


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 96
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.955, 0.950, 0.938, 1)
    bg.inputs['Strength'].default_value = 0.32

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.0004))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.845, 0.835, 0.815, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    # мягкая контактная тень под основанием
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=0.030, fill_type='NGON',
                                      location=(0, 0, -0.0002))
    shadow = bpy.context.object
    shadow.name = 'contact_shadow'
    ms = bpy.data.materials.new('contact')
    ms.use_nodes = True
    bs = ms.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (0.52, 0.51, 0.49, 1)
    bs.inputs['Roughness'].default_value = 1.0
    bs.inputs['Alpha'].default_value = 0.24
    ms.surface_render_method = 'BLENDED'
    shadow.data.materials.append(ms)

    for name, direction, energy in [
        ('key', (1.0, -1.15, 1.55), 1.05),
        ('fill', (-1.25, -0.80, 0.55), 0.42),
        ('rim', (0.10, 1.20, 1.00), 0.72),
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
        if o.type != 'MESH' or o.name in ('Plane', 'contact_shadow'):
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
         res=(780, 1180)):
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
    sc.render.filepath = str(OUT / f'{CID}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn
tall = size.z

shot('3q', (1.25, -1.35, 0.55), center, ortho_scale=tall * 1.30)
shot('front', (1.0, -0.06, 0.10), center, ortho_scale=tall * 1.26)
shot('side', (0.05, 1.0, 0.10), center, ortho_scale=tall * 1.26)
shot('closeup', (0.85, -1.00, 0.42), (0.0, 0.0, 0.1665),
     dist=0.130, lens=100, res=(980, 900))
