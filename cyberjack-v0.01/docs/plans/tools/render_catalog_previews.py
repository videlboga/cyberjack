"""Render square transparent previews for machine-module GLBs (catalog cards).

Usage:
  blender -b --factory-startup -P render_previews.py -- --ids a,b,c --out DIR --res 640 --samples 32

Writes <out>/<id>.png (RGBA, transparent background, generic 3/4 ortho framing).
"""
import sys, os, math
import bpy
from mathutils import Vector

ROOT = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01'
COMP = os.path.join(ROOT, 'public/models/machine-modules')

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default=None):
    if name in argv:
        return argv[argv.index(name) + 1]
    return default

ids = [x for x in arg('--ids', '').split(',') if x]
out_dir = arg('--out', '/tmp/prev')
res = int(arg('--res', '640'))
samples = int(arg('--samples', '32'))
os.makedirs(out_dir, exist_ok=True)


def setup_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_EEVEE_NEXT'
    sc.eevee.taa_render_samples = samples
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    sc.view_settings.view_transform = 'Standard'
    sc.view_settings.look = 'None'
    if sc.world is None:
        sc.world = bpy.data.worlds.new('World')
    sc.world.use_nodes = True
    bg = sc.world.node_tree.nodes['Background']
    bg.inputs['Color'].default_value = (0.955, 0.950, 0.938, 1)
    bg.inputs['Strength'].default_value = 0.55
    for name, direction, energy in [
        ('key', (1.0, -1.15, 1.5), 2.6),
        ('fill', (-1.2, -0.75, 0.55), 0.9),
        ('rim', (0.15, 1.15, 0.95), 1.4),
    ]:
        ld = bpy.data.lights.new(name, 'SUN')
        ld.energy = energy
        ld.angle = math.radians(18)
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
        lo.rotation_euler = Vector(direction).to_track_quat('Z', 'Y').to_euler()
    return sc


def bbox():
    """True world-space bbox from evaluated mesh vertices (bound_box is a
    local-space AABB and over-estimates badly for rotated/instanced nodes)."""
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9, 1e9, 1e9))
    mx = Vector((-1e9, -1e9, -1e9))
    for o in bpy.context.scene.objects:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        for v in me.vertices:
            w = mw @ v.co
            for i in range(3):
                if w[i] < mn[i]:
                    mn[i] = w[i]
                if w[i] > mx[i]:
                    mx[i] = w[i]
        ev.to_mesh_clear()
    return mn, mx



def shoot(cid, path):
    sc = setup_scene()
    glb = os.path.join(COMP, 'components', f'{cid}.glb')
    bpy.ops.import_scene.gltf(filepath=glb)
    bpy.context.view_layer.update()
    mn, mx = bbox()
    center = (mn + mx) * 0.5
    size = mx - mn
    d = Vector((1.0, -1.35, 0.95)).normalized()
    cd = bpy.data.cameras.new('cam')
    cam = bpy.data.objects.new('cam', cd)
    sc.collection.objects.link(cam)
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = max(size.x, size.y, size.z) * 1.42
    cam.location = center + d * (max(size) * 3 + 1.0)
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    # purge imported data so the next component starts clean
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)


for cid in ids:
    p = os.path.join(out_dir, f'{cid}.png')
    shoot(cid, p)
    print('RENDERED', cid, os.path.getsize(p) if os.path.exists(p) else 'FAIL')
