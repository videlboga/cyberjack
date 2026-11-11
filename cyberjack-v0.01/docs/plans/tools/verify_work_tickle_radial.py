"""Verify exported work_tickle_radial.glb: bbox, nodes, materials, pivot test.

  blender -b --factory-startup -noaudio --python docs/plans/tools/verify_work_tickle_radial.py

Pivot test is measured on real vertex positions of the rotating subtree
(not on object bound_box), rotating the anim node 90° about its local X.
"""
from pathlib import Path
import json
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_tickle_radial.glb'
PREFIX = 'work_tickle_radial__'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(GLB))
bpy.context.view_layer.update()

objs = [o for o in bpy.data.objects if o.name.startswith(PREFIX)]
meshes = [o for o in objs if o.type == 'MESH']
anim = bpy.data.objects.get(PREFIX + 'anim')
if anim is None:
    raise SystemExit('FAIL: anim node missing')
kids = [o for o in anim.children if o.type == 'MESH']


def verts_world(objs_):
    pts = []
    for o in objs_:
        mw = o.matrix_world
        pts.extend(mw @ v.co for v in o.data.vertices)
    return pts


def stats(objs_):
    pts = verts_world(objs_)
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    c = Vector((0, 0, 0))
    for p in pts:
        c += p
    c /= len(pts)
    return mn, mx, c, len(pts)


mn, mx, c0, n = stats(meshes)
kmn, kmx, kc0, kn = stats(kids)

anim.rotation_mode = 'XYZ'
anim.rotation_euler = (math.radians(90), 0, 0)
bpy.context.view_layer.update()
kmn2, kmx2, kc1, _ = stats(kids)
anim.rotation_euler = (0, 0, 0)
bpy.context.view_layer.update()

bbox_center_shift = ((kmn2 + kmx2) * 0.5 - (kmn + kmx) * 0.5).length
centroid_shift = (kc1 - kc0).length
axis_off = math.hypot(kc0.y - anim.location.y, kc0.z - anim.location.z)

static = [o for o in meshes if o not in kids]
smn, smx, sc, _ = stats(static)

glb_size = GLB.stat().st_size
rep = {
    'glb': str(GLB.relative_to(PROJECT)),
    'glb_bytes': glb_size,
    'nodes_total': len(objs),
    'meshes': len(meshes),
    'anim': anim.name,
    'anim_loc_blender': [round(v, 5) for v in anim.location],
    'anim_extras': {k: anim[k] for k in anim.keys() if k != '_RNA_UI'},
    'rotating_children': sorted(o.name for o in kids),
    'rotating_children_count': len(kids),
    'static_meshes': sorted(o.name for o in static),
    'materials': sorted({m.name for o in meshes for m in o.data.materials if m}),
    'verts_total': n,
    'bbox_size_m': [round(v, 5) for v in (mx - mn)],
    'bbox_min': [round(v, 5) for v in mn],
    'bbox_max': [round(v, 5) for v in mx],
    'rot_bbox_center_shift_mm': round(bbox_center_shift * 1000, 4),
    'rot_centroid_shift_mm': round(centroid_shift * 1000, 4),
    'pivot_axis_offset_mm': round(axis_off * 1000, 4),
    'pivot_ok_lt_1mm': bool(bbox_center_shift < 0.001 and centroid_shift < 0.001
                            and axis_off < 0.001),
    'static_bbox_size_m': [round(v, 5) for v in (smx - smn)],
}
print('VERIFY ' + json.dumps(rep, ensure_ascii=False), flush=True)
if not rep['pivot_ok_lt_1mm']:
    raise SystemExit('verify failed: pivot')
