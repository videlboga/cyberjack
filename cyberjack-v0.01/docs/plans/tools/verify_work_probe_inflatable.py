"""Verify exported work_probe_inflatable.glb: bbox, nodes, anim, children, scale.

  blender -b --factory-startup -noaudio --python docs/plans/tools/verify_work_probe_inflatable.py

Checks run on the re-imported GLB: real vertex bounds, anim pivot at the
chamber centre, and a scale test (anim node scaled 1.10 on its local Y/Z —
inflated state) measuring the chamber bbox growth and centre drift.
"""
from pathlib import Path
import json

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[2]
GLB = PROJECT / 'public/models/machine-modules/components/work_probe_inflatable.glb'
PREFIX = 'work_probe_inflatable__'

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


mn, mx, _, n = stats(meshes)
ch = [o for o in kids if o.name == PREFIX + 'chamber'][0]
cmn0, cmx0, cc0, _ = stats([ch])
kmn0, kmx0, kc0, _ = stats(kids)

# надутое состояние: локальные Y/Z узла anim (радиальные оси зонда)
anim.scale = (1.0, 1.10, 1.10)
bpy.context.view_layer.update()
cmn1, cmx1, cc1, _ = stats([ch])
kmn1, kmx1, kc1, _ = stats(kids)
anim.scale = (1.0, 1.0, 1.0)
bpy.context.view_layer.update()

s0 = cmx0 - cmn0
s1 = cmx1 - cmn1
growth = [s1.x / s0.x, s1.y / s0.y, s1.z / s0.z]
chamber_shift = (cc1 - cc0).length
subtree_shift = (kc1 - kc0).length

static = [o for o in meshes if o not in kids]

# --- каналы анимации в самом GLB -----------------------------------------
import struct
raw = GLB.read_bytes()
jlen = struct.unpack('<I', raw[12:16])[0]
gj = json.loads(raw[20:20 + jlen])
nodes = gj['nodes']
anim_node = next(i for i, nd in enumerate(nodes)
                 if nd.get('name') == PREFIX + 'anim')
channels = []
for a in gj.get('animations', []):
    for ch_ in a['channels']:
        if ch_['target'].get('node') == anim_node:
            channels.append((ch_['target']['path'],
                             a['samplers'][ch_['sampler']]['output']))
# значения scale-каналов
scale_peaks = []
for path, acc in channels:
    if path == 'scale':
        accj = gj['accessors'][acc]
        scale_peaks.append({'count': accj['count'],
                            'min': accj.get('min'), 'max': accj.get('max')})

rep = {
    'glb': str(GLB.relative_to(PROJECT)),
    'glb_bytes': GLB.stat().st_size,
    'glb_ok_gt_10kb': bool(GLB.stat().st_size > 10240),
    'nodes_total': len(objs),
    'meshes': len(meshes),
    'verts': n,
    'anim': anim.name,
    'anim_loc_blender': [round(v, 5) for v in anim.location],
    'anim_extras': {k: anim[k] for k in anim.keys() if k != '_RNA_UI'},
    'anim_children': sorted(o.name for o in kids),
    'static_meshes': sorted(o.name for o in static),
    'static_count': len(static),
    'materials': sorted({m.name for o in meshes for m in o.data.materials if m}),
    'bbox_size_m': [round(v, 5) for v in (mx - mn)],
    'bbox_min': [round(v, 5) for v in mn],
    'bbox_max': [round(v, 5) for v in mx],
    'bbox_ok': bool((mx - mn).x <= 0.10 and (mx - mn).y <= 0.10 and (mx - mn).z <= 0.22),
    'chamber_diam_rest': round(s0.x, 5),
    'chamber_diam_inflated': round(s1.x, 5),
    'chamber_growth_xyz': [round(g, 4) for g in growth],
    'chamber_center_shift_mm': round(chamber_shift * 1000, 4),
    'subtree_center_shift_mm': round(subtree_shift * 1000, 4),
    'pivot_dist_to_chamber_center_mm': round(
        (Vector((0, 0, 0)) + cc0 - Vector(anim.matrix_world.translation)).length * 1000, 4),
    'pivot_ok': bool(chamber_shift < 0.001 and subtree_shift < 0.001),
    'glb_animations': [a.get('name') for a in gj.get('animations', [])],
    'glb_anim_node': anim_node,
    'glb_channels_on_anim': [c[0] for c in channels],
    'glb_scale_accessor_stats': scale_peaks,
    'glb_anim_nodes_total': len({ch_['target']['node']
                                 for a in gj.get('animations', [])
                                 for ch_ in a['channels']}),
}
print('VERIFY ' + json.dumps(rep, ensure_ascii=False), flush=True)

fails = []
if not rep['bbox_ok']:
    fails.append('bbox')
if not rep['pivot_ok']:
    fails.append('pivot')
if abs(growth[0] - 1.10) > 0.01 or abs(growth[1] - 1.10) > 0.01 or abs(growth[2] - 1.0) > 0.005:
    fails.append('growth')
if 'scale' not in rep['glb_channels_on_anim']:
    fails.append('no-scale-channel')
if len(rep['materials']) < 4:
    fails.append('materials')
if fails:
    raise SystemExit('verify failed: ' + ','.join(fails))
