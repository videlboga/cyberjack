import bpy, json, os, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

BASE = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01"
PATHS = {
    'rail': BASE + "/docs/plans/blockout/component-library/fix_rail_1000/fix_rail_1000.glb",
    'cross': BASE + "/docs/plans/blockout/component-library/fix_cross_1000/fix_cross_1000.glb",
    'node': BASE + "/public/models/machine-modules/components/fix_corner_node.glb",
    'carriage': BASE + "/docs/plans/blockout/component-library/fix_carriage/fix_carriage.glb",
    'adapter': BASE + "/docs/plans/blockout/component-library/fix_latch_adapter/fix_latch_adapter.glb",
    'foot': BASE + "/docs/plans/blockout/component-library/fix_foot/fix_foot.glb",
}
OUT = BASE + "/docs/plans/checks"
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000
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

def put(objs, name, mat):
    r = root_of(objs, name)
    r.matrix_world = mat
    return objs

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

# Four nodes at roots (0,0), (1,0), (1,1), (0,1), with faces oriented inward/outward
# as required by the face normals: SW 180, SE -90, NW +90, NE 0.
nodes = []
for i, (x, y, deg) in enumerate([(0, 0, 180), (1.002, 0, -90), (1.002, 1.002, 0), (0, 1.002, 90)]):
    objs = import_glb(PATHS['node'])
    put(objs, 'fix_corner_node', Matrix.Translation((x, y, 0.0436)) @ Matrix.Rotation(math.radians(deg), 4, 'Z'))
    nodes.append(objs)

# Rails: outer rectangle, ends at node face centres, 0.3 mm assembly gap.
rails = []
# bottom: end_b at SW face_b (x=0), along +X
objs = import_glb(PATHS['rail']); put(objs, 'fix_rail_1000', Matrix.Translation((0.501, -0.06, 0.0736))); rails.append(objs)
# left: along +Y at x=-0.06
objs = import_glb(PATHS['rail']); put(objs, 'fix_rail_1000', Matrix.Translation((-0.06, 0.501, 0.0736)) @ Matrix.Rotation(math.radians(90), 4, 'Z')); rails.append(objs)
# right: along +Y at x=1.06
objs = import_glb(PATHS['rail']); put(objs, 'fix_rail_1000', Matrix.Translation((1.062, 0.501, 0.0736)) @ Matrix.Rotation(math.radians(90), 4, 'Z')); rails.append(objs)
# top: along +X at y=1.06
objs = import_glb(PATHS['rail']); put(objs, 'fix_rail_1000', Matrix.Translation((0.501, 1.062, 0.0736))); rails.append(objs)


# Four rail-saddle feet under the frame, clear of the corner nodes.
feet = []
for x, y in [(0.30, -0.06), (0.70, -0.06), (0.30, 1.062), (0.70, 1.062)]:
    objs = import_glb(PATHS['foot'])
    put(objs, 'fix_foot', Matrix.Translation((x, y, 0.0)))
    feet.append(objs)

# Carriage + adapter on bottom rail at x=0.5
objs = import_glb(PATHS['carriage']); car = put(objs, 'fix_carriage', Matrix.Translation((0.501, -0.06, 0.0511)))
objs = import_glb(PATHS['adapter']); ad = put(objs, 'fix_latch_adapter', Matrix.Translation((0.501, -0.06, 0.1014)))
bpy.context.view_layer.update()

# Pairwise overlap checks for the frame and stack.
sets = {'node_sw': nodes[0], 'node_se': nodes[1], 'node_ne': nodes[2], 'node_nw': nodes[3],
        'rail_bottom': rails[0], 'rail_left': rails[1], 'rail_right': rails[2], 'rail_top': rails[3],
        'carriage': car, 'adapter': ad,
        'foot_bl': feet[0], 'foot_br': feet[1], 'foot_tl': feet[2], 'foot_tr': feet[3]}
pairs = {}
names = list(sets)
for i in range(len(names)):
    for j in range(i + 1, len(names)):
        a, b = names[i], names[j]
        ov = bvt(sets[a]).overlap(bvt(sets[b]))
        if ov:
            pairs[f'{a}-{b}'] = len(ov)

all_objs = sum(sets.values(), [])
result = {
    'module_paths': PATHS,
    'placements_m': {
        'node_roots': [[0,0,0.0436],[1.002,0,0.0436],[1.002,1.002,0.0436],[0,1.002,0.0436]],
        'node_rot_deg': [180,-90,0,90],
        'rail_centres_z': 0.0736,
        'rail_assembly_gap_mm': 1.0,
        'carriage_z': 0.0511,
        'adapter_z': 0.1014,
        'foot_count': 4,
    },
    'frame_bbox_m': [list(bbox(all_objs)[0]), list(bbox(all_objs)[1])],
    'overlaps': pairs,
    'checks': {
        'node_count': 4,
        'rail_count': 4, 'foot_count': 4,
        'no_overlaps': len(pairs) == 0,
        'all_ok': len(pairs) == 0
    }
}
with open(OUT + "/fix-kit-frame-fit.json", 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

def add_light(loc, energy, size):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object
    l.data.energy = energy
    l.data.size = size
    l.rotation_euler = (math.radians(50), 0, math.radians(30))

add_light((2.2, -2.8, 3.2), 1200, 4)
add_light((-2.0, -0.5, 1.8), 500, 3)
add_light((0.2, 2.4, 2.2), 650, 3)

bpy.ops.mesh.primitive_plane_add(size=10, location=(0.5, 0.5, -0.012))
g = bpy.context.object
gm = bpy.data.materials.new('ground')
gm.diffuse_color = (0.07, 0.07, 0.07, 1)
g.data.materials.append(gm)

bpy.ops.object.camera_add(location=(2.1, -2.5, 1.8))
cam = bpy.context.object
scene.camera = cam
cam.data.lens = 50
target = Vector((0.501, 0.501, 0.08))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = OUT + "/fix-kit-frame.png"
bpy.ops.render.render(write_still=True)

cam.location = (1.55, -1.35, 0.85)
target = Vector((0.5, 0.0, 0.05))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = OUT + "/fix-kit-frame-carriage.png"
bpy.ops.render.render(write_still=True)

print("FRAME", json.dumps(result['checks'], ensure_ascii=False))
print("OVERLAPS", json.dumps(pairs, ensure_ascii=False))
print("DONE")
