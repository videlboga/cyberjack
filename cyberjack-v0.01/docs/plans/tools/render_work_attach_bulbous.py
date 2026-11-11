"""4 ракурса для work_attach_bulbous.glb (standalone, без зависимостей от build).

  blender -b --factory-startup -noaudio --python docs/plans/tools/render_work_attach_bulbous.py

Ракурсы: 3/4, front (вдоль оси X — виден rounded tip и луковица), side (силуэт
шея -> утолщение), close-up луковицы с литьевой меткой.
Выход: docs/plans/blockout/component-library/work_attach_bulbous/
"""
from pathlib import Path
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
CID = 'work_attach_bulbous'
GLB = PROJECT / f'public/models/machine-modules/components/{CID}.glb'
OUT = PROJECT / f'docs/plans/blockout/component-library/{CID}'
OUT.mkdir(parents=True, exist_ok=True)


def setup():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = 64
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.960, 0.955, 0.940, 1)
    bg.inputs['Strength'].default_value = 0.50

    bpy.ops.mesh.primitive_plane_add(size=20, location=(0, 0, 0.0))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (0.86, 0.85, 0.83, 1)
    bsdf.inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, direction, energy in [
        ('key', (1.0, -1.15, 1.5), 1.70),
        ('fill', (-1.2, -0.85, 0.55), 0.70),
        ('rim', (0.25, 1.15, 1.0), 1.20),
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
    sc.render.filepath = str(OUT / f'{CID}_{name}.png')
    bpy.ops.render.render(write_still=True)
    print('RENDER', sc.render.filepath, flush=True)


mn, mx = setup()
center = (mn + mx) * 0.5
size = mx - mn
z0 = center.z

# 3/4 — общий вид: хвостовик, кольцо быстросъёма, цанга, луковица
shot('3q', (1.10, -1.50, 0.85), center, ortho_scale=max(size) * 1.40)
# front — почти вдоль оси на rounded tip: читаются луковица, метка размера, кольцо
shot('front', (1.0, -0.32, 0.14), center, ortho_scale=max(size.y, size.z) * 2.00)
# side — чистый силуэт профиля: шейка -> утолщение -> скруглённый торец
shot('side', (0.0, -1.0, 0.03), center, ortho_scale=size.x * 1.16)
# close-up — луковица у торца: литьевая метка гребня и скругление
shot('closeup', (0.52, -0.88, 0.34), (0.022, 0.0, z0 - 0.003),
     dist=0.36, lens=78, res=(900, 780))
