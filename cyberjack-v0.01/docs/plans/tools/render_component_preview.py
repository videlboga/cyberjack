"""Render 3/4 previews of generated component GLBs for visual review."""
from pathlib import Path
import sys
import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
OUT = PROJECT / 'docs/plans/blockout/component-library'
OUT.mkdir(parents=True, exist_ok=True)
FILES = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 1200
scene.render.resolution_y = 900
scene.render.film_transparent = False
if scene.world is None:
    scene.world = bpy.data.worlds.new('World')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (0.945, 0.937, 0.918, 1)
bg.inputs['Strength'].default_value = 1.0

# floor
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
floor = bpy.context.object
m = bpy.data.materials.new('floor')
m.use_nodes = True
m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (0.93, 0.92, 0.90, 1)
m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value = 0.9
floor.data.materials.append(m)

# lights
for name, loc, energy, size in [
    ('key', (3, -4, 5), 900, 4),
    ('fill', (-4, -2, 3), 450, 4),
    ('rim', (0, 4, 4), 650, 3),
]:
    ld = bpy.data.lights.new(name, 'AREA')
    ld.energy = energy
    ld.shape = 'DISK'
    ld.size = size
    lo = bpy.data.objects.new(name, ld)
    scene.collection.objects.link(lo)
    lo.location = loc
    lo.rotation_euler = (Vector((0, 0, 0.6)) - lo.location).to_track_quat('-Z', 'Y').to_euler()

models = []
for idx, path in enumerate(FILES):
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [o for o in bpy.context.selected_objects]
    root = bpy.data.objects.new(f'root_{idx}', None)
    scene.collection.objects.link(root)
    for o in imported:
        if o.parent is None:
            o.parent = root
    models.append((path, root))

# arrange side by side
for i, (path, root) in enumerate(models):
    root.location = ((i - (len(models) - 1) / 2) * 0.9, 0, 0)

# camera framed on all
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
size = (mx - mn).length
cam_data = bpy.data.cameras.new('cam')
cam_data.lens = 55
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam
cam.location = center + Vector((1.1, -1.5, 0.9)).normalized() * (size * 1.45)
cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(OUT / 'test_preview.png')
bpy.ops.render.render(write_still=True)
print('RENDERED', scene.render.filepath)
