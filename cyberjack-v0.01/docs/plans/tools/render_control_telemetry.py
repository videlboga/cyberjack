"""4 rakurse renders for control_telemetry.glb (standalone, no build script deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_control_telemetry.py

Views: 3/4, front (panel face), side (depth / DIN-rail), close-up of screen+ports.
Output: docs/plans/blockout/component-library/control_telemetry/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/control_telemetry.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/control_telemetry'
OUT.mkdir(parents=True, exist_ok=True)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 96
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.960, 0.955, 0.940, 1)
    bg.inputs['Strength'].default_value = 0.42

    bpy.ops.mesh.primitive_plane_add(size=3, location=(0, 0, -0.001))
    floor = bpy.context.object
    floor.name = 'Floor'
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.855, 0.848, 0.833, 1)
    bsdf.inputs['Roughness'].default_value = 0.92
    floor.data.materials.append(m)

    for name, direction, energy, angle in [
        ('key', (0.55, -1.0, 1.25), 1.45, 16),
        ('fill', (-0.95, -0.75, 0.45), 0.55, 24),
        ('rim', (0.15, 1.0, 0.80), 0.85, 20),
        ('top', (-0.1, -0.15, 1.0), 0.40, 30),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(angle)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()

    bpy.ops.import_scene.gltf(filepath=str(GLB))
    bpy.context.view_layer.update()

    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in sc.objects:
        if o.type != 'MESH' or o.name == 'Floor':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], p[i])
                mx[i] = max(mx[i], p[i])
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx])
    return mn, mx


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=85,
         res=(1000, 840)):
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
        cam.location = Vector(target) + d * 1.5
    else:
        cam.data.type = 'PERSP'
        cam.data.lens = lens
        cam.location = Vector(target) + d * dist
    cam.rotation_euler = (Vector(target) - cam.location).to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = str(OUT / ('control_telemetry_%s.png' % name))
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn

# 3/4 — общий силуэт блока
shot('3q', (1.05, -1.40, 0.72), center, ortho_scale=max(size.x, size.z) * 1.30)
# фронт — панель целиком
shot('front', (0.0, -1.0, 0.02), (0.0, 0.0, 0.100), ortho_scale=size.x * 1.14)
# бок — глубина, цоколь, DIN-рейка (лёгкий разворот назад, чтобы читалась рейка)
shot('side', (0.95, 0.34, 0.10), center, ortho_scale=size.z * 1.38)
# close-up — дисплей, порты, клеммы, маркировка
shot('closeup', (0.52, -0.92, 0.26), (-0.014, -0.030, 0.112),
     dist=0.52, lens=74, res=(1100, 900))
