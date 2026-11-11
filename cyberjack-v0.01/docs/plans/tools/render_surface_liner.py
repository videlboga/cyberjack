"""4 ракурса для surface_liner.glb (standalone).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_surface_liner.py

Виды: 3/4, front (сверху-спереди), side (торец, профиль с язычком),
close-up (угол: кант, прострочка, угловой ремень с липучкой).
Выход: docs/plans/blockout/component-library/surface_liner/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/surface_liner.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/surface_liner'
OUT.mkdir(parents=True, exist_ok=True)

FLOOR_Z = -0.00245


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
    bg.inputs['Color'].default_value = (0.700, 0.694, 0.678, 1)
    bg.inputs['Strength'].default_value = 0.32
    sc.view_settings.view_transform = 'AgX'
    try:
        sc.view_settings.look = 'AgX - Punchy'
    except TypeError:
        pass
    sc.view_settings.exposure = -0.05
    print('VIEW', sc.view_settings.view_transform, sc.view_settings.look, flush=True)

    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, FLOOR_Z))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.585, 0.575, 0.556, 1)
    bsdf.inputs['Roughness'].default_value = 0.93
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (0.46, -0.58, 0.52), 2.60),
        ('fill', (-1.15, -0.55, 0.26), 0.35),
        ('rim', (0.05, 1.05, 0.30), 0.80),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(22)
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
          'meshes', len([o for o in sc.objects if o.type == 'MESH']) - 1, flush=True)
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
        cam.location = Vector(target) + d * 3.0
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
        cam.location = Vector(target) + d * dist
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(OUT / f'surface_liner_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn
print('SIZE', [round(v, 4) for v in size], flush=True)

shot('3q', (1.00, -1.25, 0.60), center, ortho_scale=2.26, res=(1200, 700))
shot('front', (0.06, -1.00, 0.40), center, ortho_scale=2.10, res=(1200, 620))
shot('side', (0.05, -1.00, 0.13), center, ortho_scale=2.12, res=(1200, 540))
shot('closeup', (0.46, -0.80, 0.30), (0.9600, -0.4020, 0.0042),
     dist=0.30, lens=55, res=(960, 800))
