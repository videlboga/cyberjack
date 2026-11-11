"""4 rakurse renders for work_attach_curved.glb (standalone, no build deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_attach_curved.py

Views: 3/4, front (down the mounting axis), side (bend silhouette), close-up
of the bend + rounded tip.
Output: docs/plans/blockout/component-library/work_attach_curved/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_attach_curved.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/work_attach_curved'
OUT.mkdir(parents=True, exist_ok=True)
TAG = 'work_attach_curved'


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'Medium High Contrast'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    nt = sc.world.node_tree
    bg = nt.nodes['Background']
    bg.inputs['Strength'].default_value = 0.42
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixRGB')
    mix.inputs['Color1'].default_value = (0.560, 0.558, 0.550, 1)
    mix.inputs['Color2'].default_value = (0.995, 0.993, 0.985, 1)
    nt.links.new(lp.outputs['Is Camera Ray'], mix.inputs['Fac'])
    nt.links.new(mix.outputs['Color'], bg.inputs['Color'])

    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, 0.0))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.855, 0.845, 0.825, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.1, 1.4), 1.65),
        ('fill', (-1.2, -0.8, 0.5), 0.62),
        ('rim', (0.2, 1.1, 0.9), 1.05),
        ('top', (0.15, 0.2, 1.6), 0.42),
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
    names = sorted(o.name for o in sc.objects if o.name.startswith(TAG))
    print('IMPORTED nodes', len(names), names, flush=True)
    return mn, mx


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=85,
         res=(900, 720)):
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
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat(
        '-Z', 'Y').to_euler()
    sc.render.filepath = str(OUT / f'{TAG}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn

# 3/4 — изгиб читается по контуру и по смещению носка
shot('3q', (1.05, -1.40, 0.72), center, ortho_scale=max(size) * 1.20)
# front — с тыла вдоль оси посадки: видно торец цанги, кольцо, метку угла,
# корпус уходит вверх (изгиб) из-за гильзы
shot('front', (-1.0, -0.06, 0.20), Vector((center.x, 0.0, center.z + 0.006)),
     ortho_scale=max(size) * 0.92)
# side — чистый силуэт banana-профиля
shot('side', (0.0, -1.0, 0.10), center, ortho_scale=max(size.x, size.z) * 1.14)
# close-up: гиб + rounded tip
tip = Vector((0.030, 0.0, 0.036))
shot('closeup', (0.55, -0.90, 0.34), tip, dist=0.235, lens=78,
     res=(960, 780))
