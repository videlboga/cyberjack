#!/usr/bin/env python3
"""Blender assembly check: import components, place them, detect interference.

This is a checker, not a fixer. It reads an assembly spec and writes a report;
it never edits component GLBs or catalog records.
"""
import bpy, json, math, sys
from pathlib import Path
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

ROOT = Path(__file__).resolve().parents[3]
COMP = ROOT / "public/models/machine-modules/components"


def args():
    a = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    d = {}
    for i in range(0, len(a) - 1, 2):
        d[a[i].lstrip("-")] = a[i + 1]
    return d


def bbox(objs):
    mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != "MESH":
            continue
        for c in o.bound_box:
            w = o.matrix_world @ Vector(c)
            for i in range(3):
                mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
    return mn, mx


def triangles(objs):
    verts = []; tris = []
    for o in objs:
        if o.type != "MESH":
            continue
        mesh = o.data
        mat = o.matrix_world
        off = len(verts)
        for v in mesh.vertices:
            verts.append(mat @ v.co)
        for p in mesh.polygons:
            ids = list(p.vertices)
            for i in range(1, len(ids) - 1):
                tris.append((off + ids[0], off + ids[i], off + ids[i + 1]))
    return verts, tris


def make_bvh(objs):
    v, t = triangles(objs)
    if not t:
        return None
    return BVHTree.FromPolygons(v, t, all_triangles=True)


def overlap_depth(a, b):
    dx = min(a[1].x, b[1].x) - max(a[0].x, b[0].x)
    dy = min(a[1].y, b[1].y) - max(a[0].y, b[0].y)
    dz = min(a[1].z, b[1].z) - max(a[0].z, b[0].z)
    if dx <= 0 or dy <= 0 or dz <= 0:
        return 0.0
    return min(dx, dy, dz)


def main():
    a = args()
    spec = json.loads(Path(a["spec"]).read_text(encoding="utf-8"))
    out = Path(a["out"]); out.mkdir(parents=True, exist_ok=True)
    device = next(d for d in spec["devices"] if d["id"] == a["device"])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    placed = {}
    for entry in device["components"]:
        cid = entry["id"]
        before = set(bpy.data.objects)
        path = COMP / f"{cid}.glb"
        if not path.exists():
            placed[cid] = {"missing": True}
            continue
        bpy.ops.import_scene.gltf(filepath=str(path))
        objs = [o for o in bpy.data.objects if o not in before]
        # rotate around component bbox centre in Z, then align min Z to spec
        mn, mx = bbox(objs)
        c = (mn + mx) * 0.5
        rz = math.radians(float(entry.get("rotation_z", 0)))
        ry = math.radians(float(entry.get("rotation_y", 0)))
        if rz:
            for o in objs:
                o.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(rz, 4, "Z") @ Matrix.Translation(-c) @ o.matrix_world
        if ry:
            for o in objs:
                o.matrix_world = Matrix.Translation(c) @ Matrix.Rotation(ry, 4, "Y") @ Matrix.Translation(-c) @ o.matrix_world
        mn, mx = bbox(objs)
        target = Vector(entry["position"])
        delta = Vector((target.x - (mn.x + mx.x) * 0.5,
                        target.y - (mn.y + mx.y) * 0.5,
                        target.z - mn.z))
        for o in objs:
            o.matrix_world = Matrix.Translation(delta) @ o.matrix_world
        mn, mx = bbox(objs)
        placed[cid] = {"objects": objs, "bbox": (mn, mx), "missing": False,
                        "attached_to": entry.get("attached_to")}

    # component-level BVH and bbox
    bvhs = {}; boxes = {}
    for cid, p in placed.items():
        if p.get("missing"):
            continue
        boxes[cid] = p["bbox"]
        bvhs[cid] = make_bvh(p["objects"])

    contacts = []; interference = []; joints = []
    declared_joints = {tuple(sorted(p)) for p in device.get("joints", [])}
    ids = [c for c in placed if not placed[c].get("missing")]
    for i in range(len(ids)):
        for j in range(i + 1, len(ids)):
            ca, cb = ids[i], ids[j]
            d = overlap_depth(boxes[ca], boxes[cb])
            if d <= 0:
                continue
            pairs = bvhs[ca].overlap(bvhs[cb]) if bvhs.get(ca) and bvhs.get(cb) else []
            rec = {"a": ca, "b": cb, "aabb_overlap_m": round(d, 5),
                   "triangle_pairs": len(pairs)}
            if (ca, cb) in declared_joints or (cb, ca) in declared_joints:
                joints.append(rec)
            elif pairs and d > 0.002:
                interference.append(rec)
            else:
                contacts.append(rec)

    # swept bbox for translating components (conservative XY/Z envelope)
    catalog = json.loads((ROOT / "public/models/machine-modules/component-catalog.json").read_text(encoding="utf-8"))
    motions = {c["id"]: c["model"].get("motion", {"type": "none"}) for c in catalog["components"]}
    sweeps = []
    for cid in ids:
        m = motions.get(cid, {})
        if m.get("type") not in ("slide", "spin"):
            continue
        (mn, mx) = boxes[cid]
        amount = float(m.get("amount", 0.0))
        axis = m.get("axis", "x")
        # Catalog axes are glTF axes. After Blender import: x->x, y->z, z->y.
        baxis = {"x": "x", "y": "z", "z": "y"}.get(axis, "x")
        smn = mn.copy(); smx = mx.copy()
        if m.get("type") == "slide":
            d = amount / 2.0
            setattr(smn, baxis, getattr(smn, baxis) - d)
            setattr(smx, baxis, getattr(smx, baxis) + d)
        else:
            # full rotation swept cylinder in the plane normal to the axis
            if baxis == "x":
                r = max(mx.y - mn.y, mx.z - mn.z) / 2.0
                smn.y -= r; smx.y += r; smn.z -= r; smx.z += r
            elif baxis == "z":
                r = max(mx.x - mn.x, mx.y - mn.y) / 2.0
                smn.x -= r; smx.x += r; smn.y -= r; smx.y += r
            else:
                r = max(mx.x - mn.x, mx.z - mn.z) / 2.0
                smn.x -= r; smx.x += r; smn.z -= r; smx.z += r
        for other in ids:
            if other == cid or motions.get(other, {}).get("type") not in ("none",):
                continue
            if (placed[cid].get("attached_to") == other or placed[other].get("attached_to") == cid
                    or (placed[cid].get("attached_to") and
                        placed[cid].get("attached_to") == placed[other].get("attached_to"))):
                continue
            od = overlap_depth((smn, smx), boxes[other])
            if od > 0.002:
                sweeps.append({"moving": cid, "static": other, "overlap_m": round(od, 5),
                               "motion": m.get("type"), "axis": axis, "amount": amount})

    union_mn = Vector((1e9, 1e9, 1e9)); union_mx = Vector((-1e9, -1e9, -1e9))
    for cid in ids:
        mn, mx = boxes[cid]
        union_mn.x = min(union_mn.x, mn.x); union_mn.y = min(union_mn.y, mn.y); union_mn.z = min(union_mn.z, mn.z)
        union_mx.x = max(union_mx.x, mx.x); union_mx.y = max(union_mx.y, mx.y); union_mx.z = max(union_mx.z, mx.z)
    footprint = device["footprint"]
    fp_ok = (union_mx.x - union_mn.x) <= footprint[0] + 1e-6 and (union_mx.y - union_mn.y) <= footprint[1] + 1e-6
    report = {
        "format": "cj-assembly-check/1",
        "device": device["id"],
        "components": {c: {"bbox_min": [round(x, 5) for x in placed[c]["bbox"][0]],
                           "bbox_max": [round(x, 5) for x in placed[c]["bbox"][1]]}
                       for c in placed if not placed[c].get("missing")},
        "missing": [c for c, p in placed.items() if p.get("missing")],
        "attached": {c: p.get("attached_to") for c, p in placed.items() if p.get("attached_to")},
        "interference": interference,
        "contacts": contacts,
        "joints": joints,
        "sweeps": sweeps,
        "footprint": {"spec_m": footprint,
                      "actual_m": [round(union_mx.x - union_mn.x, 5), round(union_mx.y - union_mn.y, 5)],
                      "ok": fp_ok},
        "status": "pass" if not interference and not sweeps and fp_ok and not any(p.get("missing") for p in placed.values()) else "fail"
    }
    (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    # render a quick three-quarter view of the assembled scene
    try:
        cam_data = bpy.data.cameras.new("QA_Camera"); cam = bpy.data.objects.new("QA_Camera", cam_data)
        bpy.context.collection.objects.link(cam); bpy.context.scene.camera = cam
        c = (union_mn + union_mx) * 0.5
        size = max(union_mx.x - union_mn.x, union_mx.y - union_mn.y, union_mx.z - union_mn.z, 0.2)
        cam.location = c + Vector((size * 1.4, -size * 1.8, size * 1.1))
        direction = c - cam.location
        cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
        cam_data.lens = 52
        bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
        bpy.context.scene.render.resolution_x = 1280
        bpy.context.scene.render.resolution_y = 900
        bpy.context.scene.render.film_transparent = False
        if bpy.context.scene.world is None:
            bpy.context.scene.world = bpy.data.worlds.new("World")
        world = bpy.context.scene.world
        world.use_nodes = True
        bg = world.node_tree.nodes.get("Background")
        if bg:
            bg.inputs[0].default_value = (0.55, 0.55, 0.55, 1.0)
            bg.inputs[1].default_value = 0.7
        for name, loc, energy, size in (
            ("QA_Key", (3.0, -4.0, 5.0), 1200.0, 4.0),
            ("QA_Fill", (-4.0, -2.0, 2.5), 500.0, 5.0),
            ("QA_Rim", (0.0, 4.0, 4.0), 900.0, 3.0),
        ):
            ld = bpy.data.lights.new(name, "AREA")
            ld.energy = energy; ld.shape = "DISK"; ld.size = size
            lo = bpy.data.objects.new(name, ld)
            bpy.context.collection.objects.link(lo)
            lo.location = loc
            lo.rotation_euler = (Vector((0, 0, 0.5)) - lo.location).to_track_quat("-Z", "Y").to_euler()
        bpy.context.scene.render.filepath = str(out / "assembly.png")
        bpy.ops.render.render(write_still=True)
    except Exception as e:
        report["render_error"] = str(e)
        (out / "report.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("ASSEMBLY_REPORT " + json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
