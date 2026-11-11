import bpy, json, os, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

BASE = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01"
RAIL = BASE + "/docs/plans/blockout/component-library/fix_rail_1000/fix_rail_1000.glb"
NODE = BASE + "/public/models/machine-modules/components/fix_corner_node.glb"
OUT = BASE + "/docs/plans/checks"
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'BLENDER_EEVEE_NEXT'
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.resolution_percentage = 100
scene.render.film_transparent = False
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
    # fallback: object with no parent
    for o in objs:
        if o.parent is None:
            return o
    return objs[0]

# Node at origin
node_objs = import_glb(NODE)
node_root = root_of(node_objs, 'fix_corner_node')
node_root.matrix_world = Matrix.Identity(4)

# Rail 1: end_a -> node face_a (y=0, normal -Y)
rail1_objs = import_glb(RAIL)
rail1_root = root_of(rail1_objs, 'fix_rail_1000')
# fit transform: original +X -> +Y; end center (0.5,0,0) -> (0,0.5,0)
FIT1 = Matrix.Translation(Vector((0.06, -0.5, 0.03))) @ Matrix.Rotation(math.radians(90), 4, 'Z')
# assembled with 0.3 mm assembly gap so the mating faces do not overlap in BVH
GAP = 0.0003
rail1_root.matrix_world = Matrix.Translation(Vector((0.0, -GAP, 0.0))) @ FIT1

# Rail 2: end_a -> node face_b (x=0, normal -X); +X already faces +X, but end is at +0.5
rail2_objs = import_glb(RAIL)
rail2_root = root_of(rail2_objs, 'fix_rail_1000')
FIT2 = Matrix.Translation(Vector((-0.5, 0.06, 0.03)))
rail2_root.matrix_world = Matrix.Translation(Vector((-GAP, 0.0, 0.0))) @ FIT2

bpy.context.view_layer.update()

def world_bbox(objs):
    pts = []
    for o in objs:
        if o.type == 'MESH':
            for c in o.bound_box:
                pts.append(o.matrix_world @ Vector(c))
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return [list(mn), list(mx), list(mx - mn)]

# interface points from reports
rail_rep = json.load(open(BASE + "/docs/plans/blockout/component-library/fix_rail_1000/report.json", encoding='utf-8'))
node_rep = json.load(open(BASE + "/docs/plans/blockout/component-library/fix_corner_node/report.json", encoding='utf-8'))

def holes(rep_end):
    out = []
    for h in rep_end['m8']:
        out.append((h['id'], Vector(h['center_m'])))
    return out

# rail1 end_a to node face_a; use fit transform (no assembly gap) for hole match
T1 = FIT1
# rail2 end_a to node face_b
T2 = FIT2
face_a = node_rep['interfaces']['face_a']
face_b = node_rep['interfaces']['face_b']

def check_match(rail_end, T, face):
    deviations = []
    for rid, p in holes(rail_end):
        q = T @ p
        best = None
        for nb in face['bolts_M8']:
            n = Vector(nb['coord_m'])
            d = (q - n).length * 1000.0
            if best is None or d < best[1]:
                best = (nb['coord_m'], d)
        deviations.append((rid, best[0], best[1]))
    pin_r = Vector(rail_end['pin']['center_m'])
    pin_q = T @ pin_r
    pin_n = Vector(face['pin']['coord_m'])
    pin_d = (pin_q - pin_n).length * 1000.0
    return {
        "holes": [{"id": a, "node_coord_m": b, "deviation_mm": c} for a, b, c in deviations],
        "max_hole_deviation_mm": max(c for _, _, c in deviations),
        "pin_deviation_mm": pin_d
    }

fit_a = check_match(rail_rep['interfaces']['end_a'], T1, face_a)
fit_b = check_match(rail_rep['interfaces']['end_a'], T2, face_b)

# BVH overlap, world space
def mesh_bvh(objs):
    verts = []
    faces = []
    for o in objs:
        if o.type != 'MESH':
            continue
        mw = o.matrix_world
        base = len(verts)
        vs = [mw @ v.co for v in o.data.vertices]
        verts.extend(vs)
        for p in o.data.polygons:
            faces.append(tuple(base + i for i in p.vertices))
    return BVHTree.FromPolygons(verts, faces, all_triangles=False)

rail_objs = rail1_objs + rail2_objs
nb = mesh_bvh(node_objs)
rb = mesh_bvh(rail_objs)
overlap = nb.overlap(rb)
# exact contact at face may appear; classify by pair count only
fit = {
    "node_bbox_m": world_bbox(node_objs),
    "rail1_bbox_m": world_bbox(rail1_objs),
    "rail2_bbox_m": world_bbox(rail2_objs),
    "face_a": fit_a,
    "face_b": fit_b,
    "bvh_overlap_pairs": len(overlap),
    "bvh_overlap_sample": overlap[:10],
    "checks": {
        "hole_pattern_matches": fit_a['max_hole_deviation_mm'] <= 0.05 and fit_b['max_hole_deviation_mm'] <= 0.05,
        "pin_matches": fit_a['pin_deviation_mm'] <= 0.05 and fit_b['pin_deviation_mm'] <= 0.05,
        "no_bvh_overlap": len(overlap) == 0
    }
}
with open(OUT + "/fix-kit-corner-fit.json", 'w', encoding='utf-8') as f:
    json.dump(fit, f, ensure_ascii=False, indent=2)

# simple studio
def add_light(loc, energy, size=4):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object
    l.data.energy = energy
    l.data.size = size
    l.rotation_euler = (math.radians(50), 0, math.radians(30))

add_light((1.8, -2.2, 2.5), 900, 3)
add_light((-1.6, -0.5, 1.4), 450, 2)
add_light((0.2, 2.0, 1.8), 600, 2)

# ground
bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.002))
ground = bpy.context.object
gm = bpy.data.materials.new('ground')
gm.diffuse_color = (0.08, 0.08, 0.08, 1)
ground.data.materials.append(gm)

# camera
bpy.ops.object.camera_add(location=(1.25, -1.6, 1.05))
cam = bpy.context.object
scene.camera = cam
cam.data.lens = 52
target = Vector((0, 0, 0.18))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()

scene.render.filepath = OUT + "/fix-kit-corner-assembly.png"
bpy.ops.render.render(write_still=True)

# closeup
cam.location = (0.55, -0.55, 0.35)
target = Vector((0.03, 0.0, 0.10))
direction = target - cam.location
cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = OUT + "/fix-kit-corner-closeup.png"
bpy.ops.render.render(write_still=True)

print("FIT_JSON", json.dumps(fit['checks'], ensure_ascii=False))
print("FIT_A", fit_a)
print("FIT_B", fit_b)
print("DONE")
