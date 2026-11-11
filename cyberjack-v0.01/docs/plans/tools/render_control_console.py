"""4 rakurse renders for control_console.glb (standalone, no build deps).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_control_console.py

Views: 3/4, front (panel face), side (wedge profile), close-up (screen + E-stop + joystick).
Output: docs/plans/blockout/component-library/control_console/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/control_console.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/control_console'
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
    bg.inputs['Strength'].default_value = 0.45

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
        ('key', (0.55, -1.0, 1.25), 1.55, 16),
        ('fill', (-0.95, -0.80, 0.45), 0.55, 26),
        ('rim', (0.15, 1.0, 0.80), 0.90, 20),
        ('top', (-0.10, -0.20, 1.0), 0.42, 30),
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
    sc.render.filepath = str(OUT / ('control_console_%s.png' % name))
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn

# 3/4 — общий силуэт пульта
shot('3q', (1.05, -1.35, 0.85), center, ortho_scale=max(size.x, size.y) * 1.28)
# фронт — панель целиком
shot('front', (0.0, -1.0, 0.30), (0.0, 0.0, 0.088), ortho_scale=size.x * 1.10)
# бок — профиль клина, ручка, кабельный ввод
shot('side', (1.0, 0.20, 0.10), center, ortho_scale=max(size.y, size.z) * 1.35)
# close-up — экран, E-stop, джойстик
shot('closeup', (0.42, -0.95, 0.40), (0.010, -0.010, 0.090),
     dist=0.72, lens=55, res=(1120, 900))
