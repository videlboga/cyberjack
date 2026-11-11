"""Individual orthographic previews for generated component GLBs."""
from pathlib import Path
import sys
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'docs/plans/blockout/component-library/parts'
OUT.mkdir(parents=True, exist_ok=True)
FILES = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []


def scene_for(path):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'BLENDER_EEVEE_NEXT'
    scene.render.resolution_x = 700
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.use_nodes = True
    bg = scene.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.945, 0.937, 0.918, 1)
    bg.inputs['Strength'].default_value = 0.9

    bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.002))
    floor = bpy.context.object
    m = bpy.data.materials.new('floor')
    m.use_nodes = True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.92, 0.91, 0.89, 1)
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
    floor.data.materials.append(m)

    for name, loc, energy, size in [
        ('key', (3.5, -4.0, 5.0), 700, 4),
        ('fill', (-4.0, -2.0, 3.0), 350, 4),
        ('rim', (0.0, 4.0, 4.0), 500, 3),
    ]:
        ld = bpy.data.lights.new(name, 'AREA')
        ld.energy = energy
        ld.shape = 'DISK'
        ld.size = size
        lo = bpy.data.objects.new(name, ld)
        scene.collection.objects.link(lo)
        lo.location = loc
        lo.rotation_euler = (Vector((0, 0, 0.3)) - lo.location).to_track_quat('-Z', 'Y').to_euler()

    bpy.ops.import_scene.gltf(filepath=str(path))
    bpy.context.view_layer.update()
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in scene.objects:
        if o.type != 'MESH' or o.name == 'Plane':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            mn.x, mn.y, mn.z = min(mn.x, p.x), min(mn.y, p.y), min(mn.z, p.z)
            mx.x, mx.y, mx.z = max(mx.x, p.x), max(mx.y, p.y), max(mx.z, p.z)
    center = (mn + mx) * 0.5
    size = mx - mn
    scale = max(size.x, size.y, size.z)
    cam_data = bpy.data.cameras.new('cam')
    cam_data.type = 'ORTHO'
    cam_data.ortho_scale = scale * 1.45
    cam = bpy.data.objects.new('cam', cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    direction = Vector((1.2, -1.5, 1.0)).normalized()
    cam.location = center + direction * (scale * 4 + 2)
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = str(OUT / f'{path.stem}.png')
    bpy.ops.render.render(write_still=True)
    print('PREVIEW', path.stem, flush=True)


for f in FILES:
    scene_for(Path(f))
