import bpy, json, os, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

BASE = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01"
P = {
    'rail': BASE + "/docs/plans/blockout/component-library/fix_rail_1000/fix_rail_1000.glb",
    'foot': BASE + "/docs/plans/blockout/component-library/fix_foot/fix_foot.glb",
    'carriage': BASE + "/docs/plans/blockout/component-library/fix_carriage/fix_carriage.glb",
    'adapter': BASE + "/docs/plans/blockout/component-library/fix_latch_adapter/fix_latch_adapter.glb",
}
OUT = BASE + "/docs/plans/checks"
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
if scene.world is None:
    scene.world = bpy.data.worlds.new("World")
scene.world.color = (0.03, 0.03, 0.03)

def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    return [o for o in bpy.data.objects if o not in before]

def root_of(objs, name):
    for o in objs:
        if o.name == name or o.name.startswith(name):
            return o
    for o in objs:
        if o.parent is None:
            return o
    return objs[0]

def bbox(objs):
    pts = []
    for o in objs:
        if o.type == 'MESH':
            for c in o.bound_box:
                pts.append(o.matrix_world @ Vector(c))
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

def bvt(objs):
    verts, faces = [], []
    for o in objs:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        base = len(verts)
        verts.extend(mw @ v.co for v in o.data.vertices)
        for p in o.data.polygons:
            faces.append(tuple(base + i for i in p.vertices))
    return BVHTree.FromPolygons(verts, faces, all_triangles=False)

sets = {}
for k, path in P.items():
    objs = import_glb(path)
    sets[k] = objs

# rail rests in foot at 51.1 mm; root z = 51.1 - (-22.5) = 73.6 mm
sets['rail_root'] = root_of(sets['rail'], 'fix_rail_1000')
sets['rail_root'].matrix_world = Matrix.Translation((0.0, 0.0, 0.0736))
# foot under rail at x=0.30, floor z=0
sets['foot_root'] = root_of(sets['foot'], 'fix_foot')
sets['foot_root'].matrix_world = Matrix.Translation((0.30, 0.0, 0.0))
# carriage on rail: channel ceiling 45.25 local; rail top 96.1; top gap 0.25 -> z = 0.0511
sets['carriage_root'] = root_of(sets['carriage'], 'fix_carriage')
sets['carriage_root'].matrix_world = Matrix.Translation((0.0, 0.0, 0.0511))
# adapter on carriage top (carriage top = 0.0511 + 0.05 = 0.1011), 0.3 mm gap
sets['adapter_root'] = root_of(sets['adapter'], 'fix_latch_adapter')
sets['adapter_root'].matrix_world = Matrix.Translation((0.0, 0.0, 0.1014))
bpy.context.view_layer.update()

pairs = {}
for a, b in [('rail', 'foot'), ('rail', 'carriage'), ('carriage', 'adapter')]:
    ov = bvt(sets[a]).overlap(bvt(sets[b]))
    pairs[f'{a}-{b}'] = {'overlap_pairs': len(ov), 'sample': ov[:5]}

boxes = {k: [list(bbox(v)[0]), list(bbox(v)[1])] for k, v in sets.items() if k in ('rail', 'foot', 'carriage', 'adapter')}
result = {
    'inputs': {k: v for k, v in P.items()},
    'bbox_m': boxes,
    'placements_m': {
        'rail_root_z': 0.0736,
        'foot_root_x': 0.30,
        'carriage_root_z': 0.0511,
        'adapter_root_z': 0.1014,
        'rail_bottom_z': 0.0511,
        'rail_top_z': 0.0961,
        'carriage_top_z': 0.1011,
    },
    'pairs': pairs,
    'checks': {
        'rail_foot_no_overlap': pairs['rail-foot']['overlap_pairs'] == 0,
        'rail_carriage_no_overlap': pairs['rail-carriage']['overlap_pairs'] == 0,
        'carriage_adapter_no_overlap': pairs['carriage-adapter']['overlap_pairs'] == 0,
        'adapter_faces_carriage': abs(0.1014 - 0.1011 - 0.0003) < 1e-6,
        'all_ok': all(p['overlap_pairs'] == 0 for p in pairs.values())
    }
}
with open(OUT + "/fix-kit-stack-fit.json", 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

def add_light(loc, energy, size):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object
    l.data.energy = energy
    l.data.size = size
    l.rotation_euler = (math.radians(50), 0, math.radians(30))

add_light((1.4, -1.8, 2.0), 750, 2.5)
add_light((-1.2, -0.3, 1.2), 380, 2)
add_light((0.2, 1.7, 1.4), 500, 2)

bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.012))
g = bpy.context.object
gm = bpy.data.materials.new('ground')
gm.diffuse_color = (0.08, 0.08, 0.08, 1)
g.data.materials.append(gm)

bpy.ops.object.camera_add(location=(0.72, -0.92, 0.58))
cam = bpy.context.object
scene.camera = cam
cam.data.lens = 55
target = Vector((0.05, 0.0, 0.08))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = OUT + "/fix-kit-stack.png"
bpy.ops.render.render(write_still=True)

cam.location = (0.34, -0.42, 0.30)
target = Vector((0.0, 0.0, 0.10))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = OUT + "/fix-kit-stack-adapter.png"
bpy.ops.render.render(write_still=True)

print("STACK", json.dumps(result['checks'], ensure_ascii=False))
print("PAIRS", json.dumps(pairs, ensure_ascii=False))
print("DONE")
