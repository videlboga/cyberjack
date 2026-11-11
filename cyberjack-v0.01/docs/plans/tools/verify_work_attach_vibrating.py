"""Verify the exported work_attach_vibrating.glb by re-importing it standalone.

  blender -b --factory-startup -noaudio --python docs/plans/tools/verify_work_attach_vibrating.py

Checks: file size, node names/prefix, empty pivot on the longitudinal axis,
vibrating children, static parts, extras, materials, transparent window,
eccentric offset, bbox against the passport (Ø20-50 x 80-180 mm).
"""
from pathlib import Path
import json
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_attach_vibrating.glb'
CID = 'work_attach_vibrating'
PREFIX = CID + '__'
AXIS = 'X'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(GLB))
bpy.context.view_layer.update()

objs = [o for o in bpy.data.objects]
meshes = [o for o in objs if o.type == 'MESH']
anim = bpy.data.objects.get(PREFIX + 'anim')


def bbox(objects):
    a = Vector((1e9, 1e9, 1e9))
    b = Vector((-1e9, -1e9, -1e9))
    for o in objects:
        if o.type != 'MESH':
            continue
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c)
            for i in range(3):
                a[i] = min(a[i], p[i])
                b[i] = max(b[i], p[i])
    return a, b


mn, mx = bbox(meshes)
size = mx - mn
kids = sorted(o.name for o in (anim.children if anim else []))
rot_flag = sorted(o.name for o in meshes if o.get('rotating') is True)
static_parts = sorted(o.name for o in meshes if o.name not in kids)

pivot_shift = None
if anim and anim.children:
    a0, b0 = bbox(list(anim.children))
    c0 = (a0 + b0) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    a1, b1 = bbox(list(anim.children))
    pivot_shift = ((a1 + b1) * 0.5 - c0).length
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

spin_ok = None
if anim and anim.children:
    a0, b0 = bbox(list(anim.children))
    for step in (90, 180, 270, 360):
        anim.rotation_euler = (math.radians(step), 0, 0)
        bpy.context.view_layer.update()
        a1, b1 = bbox(list(anim.children))
        err = max(abs(a1[i] - a0[i]) for i in range(3)) + \
            max(abs(b1[i] - b0[i]) for i in range(3))
        spin_ok = err if spin_ok is None else max(spin_ok, err)
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

pane = bpy.data.objects.get(PREFIX + 'window_pane')
pane_glass = bool(pane and any('glass' in m.name for m in pane.data.materials))
ecc = bpy.data.objects.get(PREFIX + 'eccentric')
ecc_off = None
if ecc:
    e_mn, e_mx = bbox([ecc])
    c = (e_mn + e_mx) * 0.5
    ecc_off = math.hypot(c.y, c.z)

body = [bpy.data.objects.get(n) for n in
        (PREFIX + 'head_rear', PREFIX + 'head_tip', PREFIX + 'release_ring')]
body = [o for o in body if o]
bb_mn, bb_mx = bbox(body)
body_dia = max(bb_mx.y - bb_mn.y, bb_mx.z - bb_mn.z) if body else 0

bad = []
if not GLB.is_file() or GLB.stat().st_size < 10000:
    bad.append('glb too small')
if anim is None:
    bad.append('no anim empty')
elif not (abs(anim.location.y) < 1e-6 and abs(anim.location.z) < 1e-6):
    bad.append('anim off the axis')
if not (0.080 <= size.x <= 0.180):
    bad.append('length out of passport')
if not (0.020 <= body_dia <= 0.050):
    bad.append('diameter out of passport')
if pivot_shift is None or pivot_shift > 0.0015:
    bad.append('pivot shift')
if len(anim.children if anim else []) < 4:
    bad.append('too few vibrating children')
if len(bpy.data.materials) < 4:
    bad.append('too few materials')
if not pane_glass:
    bad.append('no transparent window pane')
if ecc_off is None or ecc_off < 0.003:
    bad.append('eccentric not offset')
if any(not o.name.startswith(PREFIX) for o in objs):
    bad.append('names without prefix')

rep = {
    'glb': str(GLB.relative_to(PROJECT)),
    'glb_bytes': GLB.stat().st_size,
    'glb_kb': round(GLB.stat().st_size / 1024, 1),
    'objects': len(objs),
    'meshes': len(meshes),
    'empties': [o.name for o in objs if o.type == 'EMPTY'],
    'anim': anim.name if anim else None,
    'anim_loc': [round(v, 5) for v in anim.location] if anim else None,
    'anim_axis': AXIS,
    'anim_extras': {k: anim.get(k) for k in ('motion', 'axis', 'amount', 'speed')}
    if anim else None,
    'anim_children': kids,
    'children_count': len(kids),
    'extras_rotating_true': rot_flag,
    'static_parts': static_parts,
    'materials': sorted(m.name for m in bpy.data.materials),
    'bbox_min_mm': [round(v * 1000, 1) for v in mn],
    'bbox_max_mm': [round(v * 1000, 1) for v in mx],
    'bbox_size_mm': [round(v * 1000, 1) for v in size],
    'length_mm': round(size.x * 1000, 1),
    'body_diameter_mm': round(body_dia * 1000, 1),
    'max_diameter_mm': round(max(size.y, size.z) * 1000, 1),
    'pane_transparent': pane_glass,
    'eccentric_offset_mm': round((ecc_off or 0.0) * 1000, 2),
    'pivot_shift_mm': round((pivot_shift or 0.0) * 1000, 4),
    'spin_bbox_error_mm': round((spin_ok or 0.0) * 1000, 3),
    'problems': bad,
    'ok': not bad,
}
print('VERIFY ' + json.dumps(rep, ensure_ascii=False), flush=True)
if bad:
    raise SystemExit('verify failed: ' + ', '.join(bad))
