import bpy, json, os, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

BASE = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01"
KIT = BASE + "/public/models/machine-modules/fix-kit"
OUT = BASE + "/public/models/machine-modules/fix-kit/assemblies"
CHK = BASE + "/docs/plans/checks"
os.makedirs(OUT, exist_ok=True)
os.makedirs(CHK, exist_ok=True)

P = {
    'rail2000': KIT + '/fix_rail_2000.glb',
    'cross1000': KIT + '/fix_cross_1000.glb',
    'node': KIT + '/fix_corner_node.glb',
    'foot': KIT + '/fix_foot.glb',
    'carriage': KIT + '/fix_carriage.glb',
    'cuff_adapter': KIT + '/fix_cuff_adapter.glb',
    'pad_adapter': KIT + '/fix_pad_adapter.glb',
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 1000
scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
if scene.world is None:
    scene.world = bpy.data.worlds.new('World')
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
    root_of(objs, name).matrix_world = mat
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

# 2.0 x 1.0 frame, rail centres at z = 0.0736 (rail bottom 0.0511)
Z = 0.0736
CORNERS = [(-1.0, -0.5, 180), (1.0, -0.5, -90), (1.0, 0.5, 0), (-1.0, 0.5, 90)]
nodes = []
for x, y, deg in CORNERS:
    o = import_glb(P['node'])
    put(o, 'fix_corner_node', Matrix.Translation((x, y, 0.0436)) @ Matrix.Rotation(math.radians(deg), 4, 'Z'))
    nodes.append(o)

# Long rails along X, gap 1 mm from end faces
rails = []
for y in (-0.5, 0.5):
    o = import_glb(P['rail2000'])
    put(o, 'fix_rail_2000', Matrix.Translation((0, y, Z)))  # end faces at +-1.0
    rails.append(o)

# Cross rails along Y, gap 1 mm; rotate +90 so long axis Y
crosses = []
for x in (-1.0, 1.0):
    o = import_glb(P['cross1000'])
    put(o, 'fix_cross_1000', Matrix.Translation((x, 0, Z)) @ Matrix.Rotation(math.radians(90), 4, 'Z'))
    crosses.append(o)

# Four rail-saddle feet under long rails
feet = []
for x in (-0.82, 0.82):
    for y in (-0.5, 0.5):
        o = import_glb(P['foot'])
        put(o, 'fix_foot', Matrix.Translation((x, y, 0.0)))
        feet.append(o)

# Carriages: 4 on long rails, 2 on the front cross rail
cars = []
for x in (-0.6, 0.6):
    for y in (-0.5, 0.5):
        o = import_glb(P['carriage'])
        put(o, 'fix_carriage', Matrix.Translation((x, y, 0.0511)))
        cars.append(o)
for y in (-0.25, 0.25):
    o = import_glb(P['carriage'])
    put(o, 'fix_carriage', Matrix.Translation((-1.0, y, 0.0511)) @ Matrix.Rotation(math.radians(90), 4, 'Z'))
    cars.append(o)

# Adapters on carriages: 4 cuff, 2 pad; 0.3 mm above carriage top
adapters = []
for x in (-0.6, 0.6):
    for y in (-0.5, 0.5):
        o = import_glb(P['cuff_adapter'])
        put(o, 'fix_cuff_adapter', Matrix.Translation((x, y, 0.1014)))
        adapters.append(o)
for y in (-0.25, 0.25):
    o = import_glb(P['pad_adapter'])
    put(o, 'fix_pad_adapter', Matrix.Translation((-1.0, y, 0.1014)) @ Matrix.Rotation(math.radians(90), 4, 'Z'))
    adapters.append(o)

bpy.context.view_layer.update()
sets = {'nodes': sum(nodes, []), 'rails': sum(rails, []), 'crosses': sum(crosses, []),
        'feet': sum(feet, []), 'carriages': sum(cars, []), 'adapters': sum(adapters, [])}
# all-pair overlap count, but allow intended assembly gaps: report only non-zero
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
    'id': 'asm_pose_supine_spread',
    'name': 'Сборка: спиной, ноги разведены',
    'reference': ['vol-04 · 094', 'vol-04 · 098', 'vol-04 · 100'],
    'layout': {
        'frame_m': [2.0, 1.0],
        'rail_centres_z_m': Z,
        'rail_bottom_z_m': 0.0511,
        'node_roots_z_m': 0.0436,
        'carriages_long': [[-0.6,-0.5],[-0.6,0.5],[0.6,-0.5],[0.6,0.5]],
        'carriages_cross': [[-1.0,-0.25],[-1.0,0.25]],
        'adapters': 6,
        'feet': 4
    },
    'bbox_m': [list(bbox(all_objs)[0]), list(bbox(all_objs)[1])],
    'overlaps': pairs,
    'joints': {k: pairs.get(k, 0) for k in ('nodes-rails','rails-crosses')},
    'free_overlaps': {k: v for k, v in pairs.items() if k not in ('nodes-rails','rails-crosses')},
    'checks': {
        'module_count': sum(len(v) for v in sets.values()),
        'joint_contacts': sum(pairs.get(k,0) for k in ('nodes-rails','rails-crosses')),
        'free_overlaps': sum(v for k,v in pairs.items() if k not in ('nodes-rails','rails-crosses')),
        'all_ok': not any(k not in ('nodes-rails','rails-crosses') for k in pairs)
    }
}
with open(CHK + '/fix-kit-supine-3d.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, ensure_ascii=False, indent=2)

# lights/ground/camera
def add_light(loc, energy, size):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object; l.data.energy = energy; l.data.size = size
    l.rotation_euler = (math.radians(50), 0, math.radians(30))
add_light((2.5, -3.0, 3.6), 1400, 4)
add_light((-2.4, -0.5, 2.0), 600, 3)
add_light((0.2, 2.8, 2.4), 750, 3)

bpy.ops.mesh.primitive_plane_add(size=10, location=(0, 0, -0.012))
g = bpy.context.object
gm = bpy.data.materials.new('ground'); gm.diffuse_color = (0.07,0.07,0.07,1); g.data.materials.append(gm)

bpy.ops.object.camera_add(location=(2.6, -3.2, 2.2))
cam = bpy.context.object; scene.camera = cam; cam.data.lens = 50
target = Vector((0, 0, 0.10))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = OUT + '/supine-3d.png'
bpy.ops.render.render(write_still=True)

cam.location = (1.5, -1.6, 0.85)
target = Vector((-0.6, 0, 0.12))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = OUT + '/supine-3d-detail.png'
bpy.ops.render.render(write_still=True)
print('ASSEMBLY', json.dumps(result['checks'], ensure_ascii=False))
print('OVERLAPS', json.dumps(pairs, ensure_ascii=False))
print('DONE')
