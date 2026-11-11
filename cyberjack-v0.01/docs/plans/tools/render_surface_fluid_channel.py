"""4 ракурса для surface_fluid_channel.glb (standalone).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_surface_fluid_channel.py

Виды: 3/4, front (высокий фронт), side (торец), close-up (входной штуцер,
каналы, кант, ремень).
Выход: docs/plans/blockout/component-library/surface_fluid_channel/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/surface_fluid_channel.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/surface_fluid_channel'
OUT.mkdir(parents=True, exist_ok=True)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    try:
        sc.eevee.use_raytracing = True
        sc.eevee.ray_tracing_options.use_denoise = True
    except AttributeError:
        pass
    sc.render.image_settings.file_format = 'PNG'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.700, 0.696, 0.686, 1)
    bg.inputs['Strength'].default_value = 0.34
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Punchy'
    except TypeError:
        pass
    sc.view_settings.exposure = 0.06
    print('VIEW', sc.view_settings.view_transform, sc.view_settings.look, flush=True)

    bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, -0.0018))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.560, 0.550, 0.532, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (0.62, -0.80, 0.72), 3.40),
        ('fill', (-1.05, -0.55, 0.26), 0.38),
        ('rim', (0.15, 1.00, 0.40), 0.52),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(3.5)
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
          'objects', len([o for o in sc.objects if o.type == 'MESH']) - 1, flush=True)
    return mn, mx


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=70,
         res=(1000, 640)):
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
        cam.location = Vector(target) + d * 2.0
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
        cam.location = Vector(target) + d * dist
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(OUT / f'surface_fluid_channel_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn

shot('3q', (0.95, -1.25, 0.88), center, ortho_scale=size.x * 1.06, res=(1100, 700))
shot('front', (0.08, -1.0, 0.30), center, ortho_scale=size.x * 1.04, res=(1100, 560))
shot('side', (1.0, -0.22, 0.16), center, ortho_scale=1.06, res=(1000, 640))
shot('closeup', (-0.40, -0.70, 0.58), (-0.900, 0.055, 0.016),
     dist=0.52, lens=48, res=(1000, 800))
