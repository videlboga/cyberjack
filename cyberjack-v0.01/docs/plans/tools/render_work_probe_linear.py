"""4 renders + GLB re-check for work_probe_linear.glb (standalone).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_probe_linear.py

Views: 3/4 (сверху-спереди), front (вдоль оси зонда с наконечника),
side (профиль с +Y: корпус — шток — пружина — наконечник),
close-up (шток / пружина / сменная головка).
Output: docs/plans/blockout/component-library/work_probe_linear/
"""
from pathlib import Path
import json
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_probe_linear.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/work_probe_linear'
OUT.mkdir(parents=True, exist_ok=True)
CID = 'work_probe_linear'


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
    bg.inputs['Strength'].default_value = 0.34

    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.0002))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.855, 0.842, 0.822, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    # мягкая контактная тень под зондом
    bpy.ops.mesh.primitive_circle_add(vertices=64, radius=0.075, fill_type='NGON',
                                      location=(-0.010, 0, -0.0001))
    shadow = bpy.context.object
    shadow.name = 'contact_shadow'
    shadow.scale = (1.55, 0.55, 1.0)
    ms = bpy.data.materials.new('contact')
    ms.use_nodes = True
    bs = ms.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (0.50, 0.48, 0.47, 1)
    bs.inputs['Roughness'].default_value = 1.0
    bs.inputs['Alpha'].default_value = 0.22
    ms.surface_render_method = 'BLENDED'
    shadow.data.materials.append(ms)

    for name, direction, energy in [
        ('key', (0.55, -1.20, 1.40), 1.10),
        ('fill', (-1.30, -0.75, 0.60), 0.40),
        ('rim', (0.15, 1.25, 0.95), 0.70),
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
    names = []
    for o in sc.objects:
        if o.type != 'MESH' or o.name in ('Plane', 'contact_shadow'):
            continue
        names.append(o.name)
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    print('IMPORTED', json.dumps({
        'nodes': len(names),
        'meshes': sorted(names),
        'bbox_min': [round(v, 5) for v in mn],
        'bbox_max': [round(v, 5) for v in mx],
        'bbox_size_mm': [round((mx - mn)[i] * 1000, 1) for i in range(3)],
    }, ensure_ascii=False), flush=True)
    return mn, mx


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=90,
         res=(1180, 780)):
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
long_side = max(size.x, size.y, size.z)
z_ax = 0.0255

shot('3q', (0.90, -1.20, 0.95), center, ortho_scale=long_side * 1.22)
shot('front', (1.0, 0.10, 0.14), (0.030, 0.0, z_ax),
     ortho_scale=long_side * 0.45, res=(900, 780))
shot('side', (0.02, 1.0, 0.10), center, ortho_scale=long_side * 1.14)
shot('closeup', (0.95, -0.95, 0.42), (0.040, 0.0, z_ax),
     dist=0.135, lens=95, res=(1000, 820))
