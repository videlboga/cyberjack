"""4 rakurse renders for effect_pneumatic.glb (standalone, no build-script deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_effect_pneumatic.py

Views: 3/4, front (gauge face), side (coupler + bowl + valve profile),
close-up of the gauge + valve lever.
Output: docs/plans/blockout/component-library/effect_pneumatic/
Updates report.json with the renders list.
"""
from pathlib import Path
import json
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/effect_pneumatic.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/effect_pneumatic'
OUT.mkdir(parents=True, exist_ok=True)
TAG = 'effect_pneumatic'

CORNERS = []


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

    bpy.ops.mesh.primitive_plane_add(size=4, location=(0, 0, mn.z - 0.0035))
    floor = bpy.context.object
    floor.name = 'render_floor'
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.775, 0.770, 0.760, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    for name, direction, energy, shadow in [
        ('key', (1.10, -1.30, 1.20), 2.5, True),
        ('fill', (-1.25, -0.70, 0.45), 0.75, False),
        ('rim', (-0.10, 1.20, 0.80), 1.35, False),
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

    CORNERS[:] = [Vector((x, y, z)) for x in (mn.x, mx.x)
                  for y in (mn.y, mx.y) for z in (mn.z, mx.z)]
    return mn, mx


def shot(name, direction, target, dist=None, lens=80, res=(1100, 920),
         margin=1.10):
    sc = bpy.context.scene
    sc.render.resolution_x, sc.render.resolution_y = res
    cam = bpy.data.objects.get('cam')
    if cam is None:
        cd = bpy.data.cameras.new('cam')
        cam = bpy.data.objects.new('cam', cd)
        sc.collection.objects.link(cam)
    sc.camera = cam
    target = Vector(target)
    d = Vector(direction).normalized()
    if dist is None:
        cam.data.type = 'ORTHO'
        cam.location = target + d * 1.2
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
        cam.location = target + d * dist
    cam.rotation_euler = ((target - cam.location)
                          .to_track_quat('-Z', 'Y').to_euler())
    bpy.context.view_layer.update()
    if dist is None:
        q = cam.matrix_world.to_quaternion()
        right, up = q @ Vector((1, 0, 0)), q @ Vector((0, 1, 0))
        w = 2 * max(abs((c - target).dot(right)) for c in CORNERS)
        h = 2 * max(abs((c - target).dot(up)) for c in CORNERS)
        cam.data.ortho_scale = max(w, h * res[0] / res[1]) * margin
    sc.render.filepath = str(OUT / f'{TAG}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)
    return str(Path(sc.render.filepath).relative_to(PROJECT))


mn, mx = setup()
center = (mn + mx) * 0.5

renders = [
    # 3/4: колба, корпус, манометр, быстросъёмы с трубками, клапан с рычагом
    shot('3q', (-1.05, -1.35, 0.80), center, margin=1.12),
    # фронт: циановый манометр, бирка, колба
    shot('front', (0.0, -1.0, 0.08), center, margin=1.10),
    # бок по оси X: быстросъём с трубкой, колба, профиль клапана
    shot('side', (0.86, -0.52, 0.20), center, margin=1.10),
    # close-up узла: манометр + рычаг клапана
    shot('closeup', (0.22, -0.95, 0.30), (-0.008, -0.019, 0.046),
         dist=0.165, lens=90, res=(1180, 1000)),
]

rep_path = OUT / 'report.json'
if rep_path.is_file():
    rep = json.loads(rep_path.read_text(encoding='utf-8'))
    rep['renders'] = renders
    rep['webp'] = f'public/models/machine-modules/renders/{TAG}.webp'
    rep_path.write_text(json.dumps(rep, ensure_ascii=False, indent=2),
                        encoding='utf-8')
print('REPORT_UPDATED', rep_path, flush=True)
