"""4 rakurse renders for work_probe_combined.glb (standalone, no build deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_probe_combined.py

Views: 3/4, front (down the axis onto the collet), side, close-up of the collet
+ quick-release + stroke scale.
Output: docs/plans/blockout/component-library/work_probe_combined/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_probe_combined.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/work_probe_combined'
OUT.mkdir(parents=True, exist_ok=True)
TAG = 'work_probe_combined'


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
    bg.inputs['Strength'].default_value = 0.46
    lp = nt.nodes.new('ShaderNodeLightPath')
    mix = nt.nodes.new('ShaderNodeMixRGB')
    mix.inputs['Color1'].default_value = (0.585, 0.582, 0.572, 1)
    mix.inputs['Color2'].default_value = (0.996, 0.994, 0.986, 1)
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

    # пол под деталью, не дальше 3 мм ниже bbox
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, mn.z - 0.003))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.870, 0.860, 0.842, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    # солнца: объект ~0.42 м — энергия не зависит от дистанции.
    # Тени бросает только key (иначе acne на гладкой стали).
    for name, direction, energy, shadow in [
        ('key', (0.95, -1.05, 1.35), 1.75, True),
        ('fill', (-1.10, -0.85, 0.55), 0.68, False),
        ('rim', (0.20, 1.15, 0.85), 1.10, False),
        ('top', (0.12, 0.18, 1.60), 0.40, False),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(19)
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
dia = max(size.y, size.z)

# продольная ось = X; порты: воздух +Y, жидкость -Z, датчики -Y / +Z
shot('3q', (0.62, -1.05, 0.52), center, ortho_scale=size.x * 1.16, res=(1280, 760))
# осевой вид спереди: цанга, 4 лепестка, кольцо быстросъёма, метка 25
shot('front', (1.0, -0.26, 0.16), (0.05, 0.0, 0.0),
     ortho_scale=dia * 1.35, res=(820, 820))
# бок по оси: док, корпус, уплотнение, втулка хода, цанга
shot('side', (0.0, -1.0, 0.12), center, ortho_scale=size.x * 1.12, res=(1280, 620))
# close-up: передний узел — цанга + рычаг + шкала хода + порты
shot('closeup', (0.72, -0.86, 0.62), (0.095, -0.004, 0.006),
     dist=0.34, lens=95, res=(1080, 860))
