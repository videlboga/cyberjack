import bpy, json, os, math
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

BASE = "/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01"
RAIL = BASE + "/docs/plans/blockout/component-library/fix_rail_1000/fix_rail_1000.glb"
CAR = BASE + "/docs/plans/blockout/component-library/fix_carriage/fix_carriage.glb"
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

rail_objs = import_glb(RAIL)
rail_root = root_of(rail_objs, 'fix_rail_1000')
rail_root.matrix_world = Matrix.Identity(4)
bpy.context.view_layer.update()
rmn, rmx = bbox(rail_objs)

car_objs = import_glb(CAR)
car_root = root_of(car_objs, 'fix_carriage')
# channel ceiling is 45.25 mm in carriage local Z; rail top + 0.25 mm should sit under it
car_z = rmx.z + 0.00025 - 0.04525
car_root.matrix_world = Matrix.Translation((0, 0, car_z))
bpy.context.view_layer.update()
cmn, cmx = bbox(car_objs)

def bvh(objs):
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

ov = bvh(rail_objs).overlap(bvh(car_objs))
fit = {
    "rail_bbox_m": [list(rmn), list(rmx)],
    "carriage_bbox_m": [list(cmn), list(cmx)],
    "carriage_z_m": car_z,
    "channel_ceiling_z_m": 0.04525,
    "rail_top_z_m": rmx.z,
    "gap_ceiling_mm": (0.04525 + car_z - rmx.z) * 1000,
    "bvh_overlap_pairs": len(ov),
    "bvh_overlap_sample": ov[:8],
    "checks": {
        "drops_onto_rail": car_z < 0 and abs((0.04525 + car_z - rmx.z) * 1000 - 0.25) < 0.05,
        "no_bvh_overlap": len(ov) == 0
    }
}
with open(OUT + "/fix-carriage-fit.json", "w", encoding='utf-8') as f:
    json.dump(fit, f, ensure_ascii=False, indent=2)

def add_light(loc, energy, size):
    bpy.ops.object.light_add(type='AREA', location=loc)
    l = bpy.context.object
    l.data.energy = energy
    l.data.size = size
    l.rotation_euler = (math.radians(50), 0, math.radians(30))

add_light((1.4, -1.8, 2.0), 700, 2.5)
add_light((-1.2, -0.3, 1.2), 350, 2)
add_light((0.2, 1.7, 1.4), 450, 2)

bpy.ops.mesh.primitive_plane_add(size=6, location=(0, 0, -0.01))
g = bpy.context.object
gm = bpy.data.materials.new('ground')
gm.diffuse_color = (0.08, 0.08, 0.08, 1)
g.data.materials.append(gm)

bpy.ops.object.camera_add(location=(0.52, -0.72, 0.42))
cam = bpy.context.object
scene.camera = cam
cam.data.lens = 55
target = Vector((0, 0, 0.02))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = OUT + "/fix-carriage-fit.png"
bpy.ops.render.render(write_still=True)

cam.location = (0.18, -0.28, 0.18)
target = Vector((0, 0, 0.015))
cam.rotation_euler = (target - cam.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = OUT + "/fix-carriage-fit-closeup.png"
bpy.ops.render.render(write_still=True)

print("FIT", json.dumps(fit, ensure_ascii=False))
print("DONE")
