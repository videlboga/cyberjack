"""Подготовка машин vol-04: SKP -> GLB без встроенной фигуры + метаданные.

Повторяет прежний путь импорта из vol-03 (openskp + instanced_glb, units='mm'):
читаем .skp напрямую пакетом openskp, вырезаем вставленную STL-фигуру,
пишем GLB (мм, Y-up) и sidecar с габаритами в метрах.

Запуск (нужен python Blender, не системный):
  /home/cyberkitty/blender-lts/4.2/python/bin/python3.11 \
      docs/plans/tools/skp_vol04_prepare.py
"""
import sys, json, os, time, traceback, types

sys.path.insert(0, '/tmp/skp_wheels311')
sys.path.insert(0, '/home/cyberkitty/.config/blender/4.2/extensions/user_default/'
                   'openskp_import_export/vendor')
import numpy as np
import openskp
from openskp.export import instanced_glb

BASE = ('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/'
        'sex-machines-models-vol-04/sex-machines-models-vol-04')
OUTGLB = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04'
META = '/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04_meta.json'
os.makedirs(OUTGLB, exist_ok=True)

files = sorted(f for f in os.listdir(BASE) if f.endswith('.skp'))
meta = json.load(open(META)) if os.path.exists(META) else {}


def resource_info(scene, r):
    faces, pts, no_color = 0, [], True
    for pr in getattr(r, 'primitives', []):
        faces += len(getattr(pr, 'indices', [])) // 3
        pos = getattr(pr, 'positions', None)
        if pos is not None and len(pos):
            pts.append(np.asarray(pos, dtype=np.float64).reshape(-1, 3))
        gi = getattr(pr, 'material_index', None)
        if gi is not None and 0 <= gi < len(scene.gltf_materials):
            c = scene.gltf_materials[gi].get('pbrMetallicRoughness', {}).get('baseColorFactor')
            if c is not None and not np.allclose(np.array(c[:3]), [0.8, 0.8, 0.8], atol=0.02):
                no_color = False
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
    return 0.7 <= info['dims'][2] <= 2.6 and info['no_color'] and 200 <= info['faces'] <= 60000


def bounds(scene):
    lo = np.full(3, np.inf)
    hi = -lo.copy()
    for r in scene.mesh_resources:
        for pr in getattr(r, 'primitives', []):
            pos = np.asarray(pr.positions, dtype=np.float64).reshape(-1, 3)
            if len(pos):
                lo = np.minimum(lo, pos.min(0))
                hi = np.maximum(hi, pos.max(0))
    if not np.isfinite(lo).all():
        return None
    return {'min_mm': [round(v, 1) for v in lo], 'max_mm': [round(v, 1) for v in hi],
            'size_mm': [round(v, 1) for v in (hi - lo)]}


def process(fname):
    t0 = time.time()
    key = os.path.splitext(fname)[0]
    if key in meta and os.path.exists(os.path.join(OUTGLB, key + '.glb')):
        print('SKIP', fname, flush=True)
        return
    f = openskp.SkpFile.open(os.path.join(BASE, fname))
    f.parse()
    scene = f.build_instanced_scene()
    fig = {}
    for r in scene.mesh_resources:
        info = resource_info(scene, r)
        if is_figure(r, info):
            fig[r.id] = {'name': str(r.definition_name), 'faces': info['faces']}
    info = bounds(scene)
    if fig:
        def filt(node):
            node.children = [filt(c) for c in node.children
                             if getattr(c, 'mesh_resource_id', None) not in fig]
            return node
        scene.scene_hierarchy = filt(scene.scene_hierarchy)
        scene.mesh_resources = [r for r in scene.mesh_resources if r.id not in fig]
        f.build_instanced_scene = types.MethodType(lambda self, *a, **k: scene, f)
    out = os.path.join(OUTGLB, key + '.glb')
    instanced_glb.export(f, out, units='mm')
    meta[key] = {'file': fname, 'glb': os.path.relpath(out, '/home/cyberkitty/Projects/cyberjack'),
                 'bytes': os.path.getsize(out), 'figure_cut': list(fig.values()),
                 'bounds': info, 'sec': round(time.time() - t0, 1)}
    json.dump(meta, open(META, 'w'), indent=1, ensure_ascii=False)
    print('DONE', fname, 'fig:', len(fig), 'bytes:', os.path.getsize(out),
          'size_mm:', info['size_mm'] if info else None, flush=True)


for fn in files:
    try:
        process(fn)
    except Exception as e:
        print('ERROR', fn, type(e).__name__, str(e)[:200], flush=True)
        print(traceback.format_exc()[-500:], flush=True)
print('ALL_DONE', len(meta), flush=True)
