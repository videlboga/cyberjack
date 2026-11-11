"""4 rakurse renders for work_attach_vibrating.glb (standalone, no build deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_attach_vibrating.py

Views: 3/4, front (down the axis), side, close-up of the motor window.
Output: docs/plans/blockout/component-library/work_attach_vibrating/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_attach_vibrating.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/work_attach_vibrating'
OUT.mkdir(parents=True, exist_ok=True)
TAG = 'work_attach_vibrating'


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

    bpy.ops.import_scene.gltf(filepath=str(GLB))
    bpy.context.view_layer.update()

    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in sc.objects:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx])

    # пол под деталью, не дальше 4 мм ниже bbox
    bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, mn.z - 0.004))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.855, 0.845, 0.825, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    # солнца: освещённость не зависит от дистанции — объект всего 0.14 м.
    # Тени бросает только key: накладка четырёх shadow map даёт полосы (acne)
    # на гладком силиконе.
    for name, direction, energy, shadow in [
        ('key', (1.0, -1.1, 1.4), 1.65, True),
        ('fill', (-1.2, -0.8, 0.5), 0.62, False),
        ('rim', (0.2, 1.1, 0.9), 1.05, False),
        ('top', (0.15, 0.2, 1.6), 0.42, False),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(20)
        ld.use_shadow = shadow
        if shadow:
            ld.shadow_maximum_resolution = 0.00005
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()

    return mn, mx

def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=85, res=(900, 720)):
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
    sc.render.filepath = str(OUT / f'{TAG}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn

# продольная ось = X, окно мотора смотрит в +Z
shot('3q', (1.05, -1.40, 0.85), center, ortho_scale=max(size) * 1.40)
# осевой вид со стороны посадки: цанга, кольцо, фланец, кнопка
shot('front', (-1.0, -0.22, 0.10), center, ortho_scale=max(size.y, size.z) * 1.55)
shot('side', (0.0, -1.0, 0.14), center, ortho_scale=max(size.x, size.z) * 1.36)
shot('closeup', (0.52, -0.80, 1.02), (0.014, 0.0, 0.009),
     dist=0.215, lens=90, res=(960, 780))
