"""4 rakurse renders for work_spray.glb (standalone, no build-script deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_spray.py

Views: 3/4, front (down the flow axis), side, close-up of nozzle + flow cone.
Output: docs/plans/blockout/component-library/work_spray/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_spray.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/work_spray'
OUT.mkdir(parents=True, exist_ok=True)
Z0 = 0.0395
NOZZLE_X = 0.0264


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 96
    for attr, val in (('shadow_ray_count', 4), ('shadow_step_count', 8)):
        if hasattr(sc.eevee, attr):
            setattr(sc.eevee, attr, val)
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = 0.05

    sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.820, 0.815, 0.805, 1)
    bg.inputs['Strength'].default_value = 0.42

    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, -0.0004))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.78, 0.775, 0.765, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    for name, direction, energy, shadow in [
        ('key', (1.15, -1.25, 1.25), 2.55, True),
        ('fill', (-1.25, -0.75, 0.40), 0.78, False),
        ('rim', (-0.10, 1.20, 0.75), 1.25, False),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(10)
        ld.use_shadow = shadow
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()

    bpy.ops.import_scene.gltf(filepath=str(GLB))
    bpy.context.view_layer.update()

    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    mats = set()
    meshes = 0
    for o in sc.objects:
        if o.type != 'MESH' or o.name.startswith('Plane'):
            continue
        meshes += 1
        for ms in o.data.materials:
            if ms:
                mats.add(ms.name)
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    print('IMPORTED meshes', meshes, 'materials', len(mats), sorted(mats))
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx])
    return mn, mx


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=85,
         res=(1100, 920)):
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
    sc.render.filepath = str(OUT / f'work_spray_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn

shot('3q', (1.10, -1.40, 0.72), center, ortho_scale=max(size) * 1.42)
shot('front', (1.0, -0.20, 0.16), center, ortho_scale=max(size.y, size.z) * 2.10)
shot('side', (0.02, -1.0, 0.04), center, ortho_scale=max(size.x, size.z) * 1.24)
shot('closeup', (0.66, -0.80, 0.26), (NOZZLE_X + 0.006, 0.0, Z0),
     dist=0.115, lens=62, res=(1180, 1000))
