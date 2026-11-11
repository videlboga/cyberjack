"""4 ракурса для work_attach_tapered.glb (standalone, без зависимостей от build).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_attach_tapered.py

Ракурсы: 3/4, front (вдоль оси X — виден узкий rounded tip), side (силуэт
конусной образующей), close-up перехода цанга -> толстое основание.
Выход: docs/plans/blockout/component-library/work_attach_tapered/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_attach_tapered.glb'
OUT = PROJECT / 'docs/plans/blockout/component-library/work_attach_tapered'
OUT.mkdir(parents=True, exist_ok=True)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    try:
        sc.view_settings.look = 'AgX - Medium High Contrast'
    except Exception:
        print('LOOK not set, available:',
              [i.name for i in sc.view_settings.bl_rna.properties['look'].enum_items])
    sc.view_settings.exposure = -0.30

    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.800, 0.815, 0.840, 1)
    bg.inputs['Strength'].default_value = 0.30

    bpy.ops.mesh.primitive_plane_add(size=2, location=(0, 0, 0.0))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.780, 0.775, 0.765, 1)
    bsdf.inputs['Roughness'].default_value = 0.94
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.35, -1.10, 1.60), 1.70),
        ('fill', (-1.25, -0.90, 0.60), 0.45),
        ('rim', (0.20, 1.15, 0.95), 1.15),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(14)
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
    print('IMPORTED bbox', [round(v, 4) for v in mn], [round(v, 4) for v in mx])
    print('IMPORTED nodes', sorted(o.name for o in sc.objects if o.type == 'MESH'))
    print('IMPORTED empties', sorted(o.name for o in sc.objects if o.type == 'EMPTY'))
    return mn, mx


def shot(name, direction, target, ortho_scale=None, dist=0.9, lens=85, res=(860, 720)):
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
    sc.render.filepath = str(OUT / f'work_attach_tapered_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn
z0 = center.z

# 3/4 — общий вид: конус, гильза-цанга, кольцо быстросъёма
shot('3q', (1.05, -1.45, 0.80), center, ortho_scale=max(size) * 1.42)
# front — почти вдоль оси: узкий торец на фоне толстого основания
shot('front', (1.0, -0.26, 0.10), center, ortho_scale=max(size.y, size.z) * 2.30)
# side — силуэт конусной образующей (главный ракурс)
shot('side', (0.0, -1.0, 0.02), center, ortho_scale=max(size.x, size.z) * 1.22)
# close-up — стык цанги/кольца с толстым основанием
shot('closeup', (0.55, -0.80, 0.28), (-0.030, 0.0, z0 + 0.002),
     dist=0.235, lens=85, res=(900, 780))
