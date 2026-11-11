"""Verify the exported work_attach_nodular.glb by re-importing it standalone.

  blender -b --factory-startup -noaudio --python docs/plans/tools/verify_work_attach_nodular.py

Checks: file size, node names/prefix, empty pivot, rotating children, static
parts, extras, materials, bbox against the passport (Ø20-60 x 80-200 mm).
"""
from pathlib import Path
import json
import math

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_attach_nodular.glb'
CID = 'work_attach_nodular'
PREFIX = CID + '__'
AXIS = 'X'

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(GLB))
bpy.context.view_layer.update()

objs = [o for o in bpy.data.objects]
meshes = [o for o in objs if o.type == 'MESH']
empties = [o for o in objs if o.type == 'EMPTY']
anim = bpy.data.objects.get(PREFIX + 'anim')

mn = Vector((1e9, 1e9, 1e9))
mx = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for c in o.bound_box:
        p = o.matrix_world @ Vector(c)
        for i in range(3):
            mn[i] = min(mn[i], p[i])
            mx[i] = max(mx[i], p[i])
size = mx - mn


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


kids = sorted(o.name for o in (anim.children if anim else []))
rot_flag = sorted(o.name for o in meshes if o.get('rotating') is True)
static_parts = sorted(o.name for o in meshes if o.name not in kids)

# pivot: поворот пустышки вокруг X не должен сдвигать центр bbox детей
pivot_shift = None
if anim and anim.children:
    c0 = sum((bbox(list(anim.children))[0] + bbox(list(anim.children))[1]), Vector()) * 0.5
    anim.rotation_mode = 'XYZ'
    anim.rotation_euler = (math.radians(90), 0, 0)
    bpy.context.view_layer.update()
    a, b = bbox(list(anim.children))
    c1 = sum((a + b), Vector()) * 0.5
    pivot_shift = (c1 - c0).length
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

# вращение на 360/4 вокруг X: bbox должен совпасть (осевая симметрия)
spin_ok = None
if anim and anim.children:
    a0, b0 = bbox(list(anim.children))
    for step in (90, 180, 270, 360):
        anim.rotation_euler = (math.radians(step), 0, 0)
        bpy.context.view_layer.update()
        a1, b1 = bbox(list(anim.children))
        err = max(abs(a1[i] - a0[i]) for i in range(3)) + max(abs(b1[i] - b0[i]) for i in range(3))
        spin_ok = err if spin_ok is None else max(spin_ok, err)
    anim.rotation_euler = (0, 0, 0)
    bpy.context.view_layer.update()

bad = []
if not GLB.is_file() or GLB.stat().st_size < 10000:
    bad.append('glb too small')
if anim is None:
    bad.append('no anim empty')
if not (0.080 <= size.x <= 0.200):
    bad.append('length out of passport')
if not (0.020 <= max(size.y, size.z) <= 0.060):
    bad.append('diameter out of passport')
if pivot_shift is None or pivot_shift > 0.001:
    bad.append('pivot shift')
if len(anim.children if anim else []) < 3:
    bad.append('too few rotating children')
if len(bpy.data.materials) < 4:
    bad.append('too few materials')
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
    'anim_children': kids,
    'children_count': len(kids),
    'extras_rotating_true': rot_flag,
    'static_parts': static_parts,
    'materials': sorted(m.name for m in bpy.data.materials),
    'bbox_min_mm': [round(v * 1000, 1) for v in mn],
    'bbox_max_mm': [round(v * 1000, 1) for v in mx],
    'bbox_size_mm': [round(v * 1000, 1) for v in size],
    'length_mm': round(size.x * 1000, 1),
    'max_diameter_mm': round(max(size.y, size.z) * 1000, 1),
    'pivot_shift_mm': round((pivot_shift or 0.0) * 1000, 4),
    'spin_bbox_error_mm': round((spin_ok or 0.0) * 1000, 3),
    'problems': bad,
    'ok': not bad,
}
print('VERIFY ' + json.dumps(rep, ensure_ascii=False), flush=True)
if bad:
    raise SystemExit('verify failed: ' + ', '.join(bad))
