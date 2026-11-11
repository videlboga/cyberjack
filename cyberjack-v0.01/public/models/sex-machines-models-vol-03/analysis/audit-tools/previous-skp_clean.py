import sys, json, os, time, traceback, types
sys.path.insert(0, '/tmp/skp_wheels311')
sys.path.insert(0, '/home/cyberkitty/.config/blender/4.2/extensions/user_default/openskp_import_export/vendor')
import numpy as np, openskp
from openskp.export import instanced_glb

BASE = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03'
OUTGLB = BASE + '/glb-nohuman'
os.makedirs(OUTGLB, exist_ok=True)
MANIFEST = BASE + '/analysis/humanoid_manifest.json'
manifest = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}

nums = [int(a) for a in sys.argv[sys.argv.index('--')+1:] if a.lstrip('-').isdigit()]
start, end = nums[0], nums[1]
files = sorted([f for f in os.listdir(BASE) if f.endswith('.skp')])[start:end+1]


def quat_from_mat(R):
    t = np.trace(R)
    if t > 0:
        S = np.sqrt(t + 1.0) * 2
        return np.array([0.25 * S, (R[2, 1] - R[1, 2]) / S, (R[0, 2] - R[2, 0]) / S, (R[1, 0] - R[0, 1]) / S])
    if R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]:
        S = np.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2
        return np.array([(R[2, 1] - R[1, 2]) / S, 0.25 * S, (R[0, 1] + R[1, 0]) / S, (R[0, 2] + R[2, 0]) / S])
    if R[1, 1] > R[2, 2]:
        S = np.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2
        return np.array([(R[0, 2] - R[2, 0]) / S, (R[0, 1] + R[1, 0]) / S, 0.25 * S, (R[1, 2] + R[2, 1]) / S])
    S = np.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2
    return np.array([(R[1, 0] - R[0, 1]) / S, (R[0, 2] + R[2, 0]) / S, (R[1, 2] + R[2, 1]) / S, 0.25 * S])


def resource_info(scene, r):
    faces = 0
    pts = []
    no_color = True
    for pr in getattr(r, 'primitives', []):
        faces += len(getattr(pr, 'indices', [])) // 3
        pos = getattr(pr, 'positions', None)
        if pos is not None and len(pos):
            pts.append(np.asarray(pos, dtype=np.float64).reshape(-1, 3))
        try:
            gi = pr.material_index
            if gi is not None and 0 <= gi < len(scene.gltf_materials):
                pbr = scene.gltf_materials[gi].get('pbrMetallicRoughness', {})
                c = pbr.get('baseColorFactor')
                if c is not None and not np.allclose(np.array(c[:3]), [0.8, 0.8, 0.8], atol=0.02):
                    no_color = False
        except Exception:
            pass
    if not pts:
        return None
    allp = np.vstack(pts)
    dims = sorted((allp.max(0) - allp.min(0)).tolist())
    return {'dims': dims, 'faces': faces, 'no_color': no_color}


def is_figure(r, info):
    name = (r.definition_name or '').lower()
    if name.endswith('.stl'):
        return True
    if info is None:
        return False
    ds = info['dims']
    human_scale = 0.7 <= ds[2] <= 2.6 and 200 <= info['faces'] <= 60000
    return human_scale and info['no_color']


def process(fname):
    t0 = time.time()
    key = os.path.splitext(fname)[0]
    f = openskp.SkpFile.open(os.path.join(BASE, fname))
    f.parse()
    scene = f.build_instanced_scene()

    fig_ids = {}
    for r in scene.mesh_resources:
        info = resource_info(scene, r)
        if is_figure(r, info):
            fig_ids[r.id] = {'name': str(r.definition_name),
                             'dims': [round(v, 2) for v in info['dims']] if info else None,
                             'faces': info['faces'] if info else 0}
    if not fig_ids:
        print('NOFIGURE', fname, flush=True)
        manifest[key] = {'humanoid_defs': [], 'anchors': [], 'note': 'no figure found'}
        json.dump(manifest, open(MANIFEST, 'w'), indent=1)
        return

    anchors = []

    def walk(node, wmat, path=None):
        m = np.array(node.matrix, dtype=np.float64).reshape(4, 4).T
        wm = wmat @ m
        if getattr(node, 'mesh_resource_id', None) in fig_ids:
            s = np.array([np.linalg.norm(m[:3, i]) for i in range(3)])
            rot = m[:3, :3] / s
            anchors.append({'resource': node.mesh_resource_id, 'def': str(node.definition_name),
                            'name': str(node.name)[:40],
                            'loc': [round(v, 4) for v in wm[:3, 3]],
                            'quat_xyzw': [round(v, 5) for v in quat_from_mat(rot)],
                            'scale': [round(v, 5) for v in s],
                            'dims': fig_ids[node.mesh_resource_id]['dims'],
                            'faces': fig_ids[node.mesh_resource_id]['faces']})
        for ch in node.children:
            walk(ch, wm)

    walk(scene.scene_hierarchy, np.eye(4), [])

    def filter_tree(node):
        node.children = [filter_tree(c) for c in node.children
                         if getattr(c, 'mesh_resource_id', None) not in fig_ids]
        return node
    scene.scene_hierarchy = filter_tree(scene.scene_hierarchy)
    scene.mesh_resources = [r for r in scene.mesh_resources if r.id not in fig_ids]

    f.build_instanced_scene = types.MethodType(lambda self, *a, **k: scene, f)
    out = os.path.join(OUTGLB, key + '.glb')
    instanced_glb.export(f, out, units='mm')
    glb_m = os.path.getsize(out)

    manifest[key] = {'humanoid_defs': [{'resource': k2, **v} for k2, v in fig_ids.items()],
                     'anchors': anchors,
                     'glb_nohuman_bytes': glb_m,
                     'sec': round(time.time() - t0, 1)}
    json.dump(manifest, open(MANIFEST, 'w'), indent=1)
    print('CLEAN_DONE', fname, 'fig:', [v['name'] for v in fig_ids.values()],
          'anchors:', len(anchors), 'glb:', glb_m, flush=True)


for fname in files:
    try:
        process(fname)
    except Exception as e:
        print('CLEAN_ERROR', fname, type(e).__name__, str(e)[:200], flush=True)
        print(traceback.format_exc()[-600:], flush=True)
print('CLEAN_ALL_DONE', start, end, flush=True)