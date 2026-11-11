"""4 rakurse renders for effect_thermal.glb (standalone, no build-script deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_effect_thermal.py

Views: 3/4, front (front face, skirt + sensor profile), side (flange/ring side),
close-up of the PT1000 sensor + seat ring + amber scale.
Output: docs/plans/blockout/component-library/effect_thermal/
Updates report.json with the renders list.
"""
from pathlib import Path
import json
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/effect_thermal.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/effect_thermal'
OUT.mkdir(parents=True, exist_ok=True)
TAG = 'effect_thermal'
SKX = -0.0200
BST_X = -0.0165


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
    sc.view_settings.exposure = 0.15

    sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.815, 0.810, 0.800, 1)
    bg.inputs['Strength'].default_value = 0.45

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

    bpy.ops.mesh.primitive_plane_add(size=4,
                                     location=(0, 0, mn.z - 0.0035))
    floor = bpy.context.object
    floor.name = 'render_floor'
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.775, 0.770, 0.760, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    # солнца: объект 0.09 м, освещённость не зависит от дистанции
    for name, direction, energy, shadow in [
        ('key', (1.10, -1.30, 1.20), 2.5, True),
        ('fill', (-1.25, -0.70, 0.45), 0.75, False),
        ('rim', (-0.10, 1.20, 0.80), 1.30, False),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(10)
        ld.use_shadow = shadow
        if shadow:
            ld.shadow_maximum_resolution = 0.00005
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()

    return mn, mx


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=80,
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
    cam.rotation_euler = ((Vector(target) - cam.location)
                          .to_track_quat('-Z', 'Y').to_euler())
    sc.render.filepath = str(OUT / f'{TAG}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)
    return str(Path(sc.render.filepath).relative_to(PROJECT))


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn

renders = [
    # 3/4: юбка, кольцо, пакет, радиатор, кабельный ввод
    shot('3q', (-1.10, -1.36, 0.82), center, ortho_scale=max(size) * 1.42),
    # фронт по оси юбки: контактная плоскость, кольцо посадки, профиль
    shot('front', (0.0, -1.0, 0.09), center, ortho_scale=size.x * 1.24),
    # бок: фланец с винтами, шкала, датчик, пигтейл
    shot('side', (1.0, -0.10, 0.10), center, ortho_scale=max(size.y, size.z) * 1.30),
    # close-up узла: датчик PT1000, кольцо посадки, янтарная шкала
    shot('closeup', (0.55, -0.88, 0.42), (SKX + 0.002, -0.010, 0.0165),
         dist=0.185, lens=90, res=(1180, 1000)),
]

rep_path = OUT / 'report.json'
if rep_path.is_file():
    rep = json.loads(rep_path.read_text(encoding='utf-8'))
    rep['renders'] = renders
    rep['webp'] = f'public/models/machine-modules/renders/{TAG}.webp'
    rep_path.write_text(json.dumps(rep, ensure_ascii=False, indent=2),
                        encoding='utf-8')
print('REPORT_UPDATED', rep_path, flush=True)
