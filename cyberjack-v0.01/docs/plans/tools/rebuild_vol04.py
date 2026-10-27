"""vol-04: SKP -> GLB с ТЕКСТУРАМИ (свой экспортёр, без trimesh).

Blender-импортёр OpenSKP теряет текстуры (в материалах только цвет, у непокрашенных
граней он розовый 1,0.33,0.33). Поэтому GLB собирается напрямую из openskp-сцены:
материалы и изображения берутся из skp (scene.gltf_materials / scene.textures),
геометрия — из mesh_resources с UV, ноды — с исходными матрицами.

Отбор машины: плотнейшее скопление деталей, без плоских листов стенда.
Фигуры (антропоморфные меши) сохраняются.

Запуск (python Blender):
  /home/cyberkitty/blender-lts/4.2/python/bin/python3.11 tools/rebuild_vol04.py [-- 089 092]
"""
import sys, os, json, math, time, struct, gc
from pathlib import Path

sys.path.insert(0, '/tmp/skp_wheels311')
sys.path.insert(0, '/home/cyberkitty/.config/blender/4.2/extensions/user_default/'
                   'openskp_import_export/vendor')
import numpy as np
import openskp
import openskp._core as core_module
import openskp.instanced_scene as scene_module

P = Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/'
         'sex-machines-models-vol-04/sex-machines-models-vol-04')
OUT = Path('/home/cyberkitty/Projects/cyberjack/assets/3d/converted/vol04')
META = OUT.parent / 'vol04_meta.json'
OUT.mkdir(parents=True, exist_ok=True)

only = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
files = sorted(P.glob('*.skp'))
if only:
    files = [f for f in files if any(o in f.name for o in only)]
meta = json.load(open(META)) if META.exists() else {}


def walk(node, world, out, path='0'):
    m = np.array(node.matrix, dtype=float).reshape(4, 4).T
    w = world @ m
    rid = getattr(node, 'mesh_resource_id', None)
    out.append({'node': node, 'world': w, 'rid': rid, 'path': path,
                'name': node.name or node.definition_name or path})
    for i, ch in enumerate(node.children):
        walk(ch, w, out, path + '/' + str(i))
    return out


def res_bbox(r, w):
    pts = []
    for pr in r.primitives:
        pos = np.asarray(pr.positions, dtype=float).reshape(-1, 3)
        if len(pos):
            pts.append(pos @ w[:3, :3].T + w[:3, 3])
    if not pts:
        return None
    allp = np.vstack(pts)
    lo, hi = allp.min(0), allp.max(0)
    return lo, hi, hi - lo


DEFAULT_PINK = np.array([1.0, 0.329412, 0.329412])


def fix_unpainted(scene):
    """SketchUp некрашеным граням даёт «розовый» (1, 0.33, 0.33) — это не текстура,
    а дефолт материала. Меняем на нейтральный светлый, как в пайплайне vol-03."""
    fixed = 0
    for m in scene.gltf_materials:
        pbr = m.setdefault('pbrMetallicRoughness', {})
        c = pbr.get('baseColorFactor')
        if c and len(c) >= 3 and np.allclose(np.array(c[:3]), DEFAULT_PINK, atol=0.02):
            pbr['baseColorFactor'] = [0.86, 0.87, 0.88, c[3] if len(c) > 3 else 1.0]
            fixed += 1
    return fixed


def pick_machine(entries, res):
    """Оставляем плотнейшее скопление деталей; стенд/шторы/подиум — мимо."""
    cand = []
    for e in entries:
        if not e['rid'] or e['rid'] not in res:
            continue
        bb = res_bbox(res[e['rid']], e['world'])
        if bb is None:
            continue
        lo, hi, dim = bb
        big, small = float(dim.max()), float(dim.min())
        c0 = (lo + hi) / 2
        # заглушка-куб 2x2x2 в origin (дефолтный компонент SketchUp) — мусор
        if np.all(np.abs(dim - 2.0) < 0.06) and np.linalg.norm(c0) < 0.2:
            continue
        if big > 0.6 and small < 0.03:      # плоский лист
            continue
        if big > 2.2:                        # крупнее машины
            continue
        cand.append((e, lo, hi, dim))
    if not cand:
        return set()
    cell = 0.40
    cells = {}
    for e, lo, hi, dim in cand:
        c = e['world'][:3, 3]
        key = (round(c[0] / cell), round(c[1] / cell), round(c[2] / cell))
        cells[key] = cells.get(key, 0) + 1
    best = max(cells.items(), key=lambda kv: kv[1])[0]
    centre = np.array([best[0] * cell, best[1] * cell, best[2] * cell])
    keep = set()
    for e, lo, hi, dim in cand:
        if np.linalg.norm(e['world'][:3, 3] - centre) <= 1.20:
            keep.add(e['path'])

    # фигура нужна для сверки поз: если рядом с машиной её нет,
    # подтягиваем ближайший антропоморфный меш (обычно *.stl)
    if not any('.stl' in (e['name'] or '').lower() and e['path'] in keep for e, _, _, _ in cand):
        figs = [(np.linalg.norm(e['world'][:3, 3] - centre), e['path'])
                for e, _, _, _ in cand if '.stl' in (e['name'] or '').lower()]
        if figs:
            figs.sort()
            keep.add(figs[0][1])
    return keep


def export_glb(scene, res, textures, keep, path):
    doc = {'asset': {'version': '2.0', 'generator': 'cyberjack vol04 exporter; metres/Y-up'},
           'scene': 0, 'scenes': [{'nodes': []}], 'nodes': [], 'meshes': [],
           'materials': json.loads(json.dumps(scene.gltf_materials)),
           'buffers': [{'byteLength': 0}], 'bufferViews': [], 'accessors': []}
    data = bytearray()
    prim_cache = {}
    img_views = {}

    def view(b, target=None):
        while len(data) % 4:
            data.append(0)
        d = {'buffer': 0, 'byteOffset': len(data), 'byteLength': len(b)}
        if target:
            d['target'] = target
        doc['bufferViews'].append(d)
        data.extend(b)
        return len(doc['bufferViews']) - 1

    def acc(a, dtype, typ, target, bounds=False):
        arr = np.array(a, dtype=dtype)
        a = {'bufferView': view(arr.tobytes(), target),
             'componentType': 5126 if dtype == '<f4' else 5125,
             'count': int(len(arr)), 'type': typ}
        if bounds:
            a.update(min=arr.min(0).tolist(), max=arr.max(0).tolist())
        doc['accessors'].append(a)
        return len(doc['accessors']) - 1

    # изображения из skp
    if textures:
        doc['images'], doc['textures'], doc['samplers'] = [], [], [{'magFilter': 9729,
                                                                   'minFilter': 9987,
                                                                   'wrapS': 33071,
                                                                   'wrapT': 33071}]
        for t in textures:
            doc['images'].append({'name': getattr(t, 'filename', 'tex'),
                                  'bufferView': view(bytes(t.data)),
                                  'mimeType': getattr(t, 'mime_type', 'image/png')})
            doc['textures'].append({'source': len(doc['images']) - 1, 'sampler': 0})

    # привязка текстур к материалам
    for i, mat in enumerate(doc['materials']):
        pbr = mat.setdefault('pbrMetallicRoughness', {})
        tex_idx = None
        for key in ('baseColorTexture', 'diffuseTexture'):
            if key in mat:
                tex_idx = mat[key]
        if tex_idx is None and 'texture' in mat:
            tex_idx = mat['texture']
        if isinstance(tex_idx, dict):
            idx = tex_idx.get('index')
            if idx is not None and idx < len(doc.get('textures', [])):
                pbr['baseColorTexture'] = {'index': idx}
        if isinstance(tex_idx, int) and tex_idx < len(doc.get('textures', [])):
            pbr['baseColorTexture'] = {'index': tex_idx}
        pbr.setdefault('baseColorFactor', mat.get('baseColorFactor', [0.8, 0.8, 0.8, 1]))
        pbr.setdefault('metallicFactor', 0.0)
        pbr.setdefault('roughnessFactor', 0.75)
        for k in ('baseColorTexture', 'diffuseTexture', 'texture', 'baseColorFactor'):
            mat.pop(k, None)
        mat['doubleSided'] = True

    def primitives(rid):
        if rid in prim_cache:
            return prim_cache[rid]
        out = []
        for pr in res[rid].primitives:
            pos = np.asarray(pr.positions, dtype='<f4').reshape(-1, 3)
            idx = np.asarray(pr.indices, dtype='<u4')
            if not len(pos) or not len(idx):
                continue
            attrs = {'POSITION': acc(pos, '<f4', 'VEC3', 34962, True)}
            if getattr(pr, 'normals', None) is not None and len(pr.normals):
                n = np.asarray(pr.normals, dtype='<f4').reshape(-1, 3).copy()
                ln = np.linalg.norm(n, axis=1)
                n[ln > 1e-9] /= ln[ln > 1e-9, None]
                attrs['NORMAL'] = acc(n, '<f4', 'VEC3', 34962)
            if getattr(pr, 'uvs', None) is not None and len(pr.uvs):
                attrs['TEXCOORD_0'] = acc(np.asarray(pr.uvs).reshape(-1, 2), '<f4', 'VEC2', 34962)
            out.append({'attributes': attrs, 'indices': acc(idx, '<u4', 'SCALAR', 34963),
                        'material': int(getattr(pr, 'material_index', 0) or 0), 'mode': 4})
        prim_cache[rid] = out
        return out

    mesh_cache = {}
    kept_paths = set()

    # предки оставленных узлов тоже нужны: иначе emit срежет поддерево
    allowed = set()
    for kp in keep:
        parts = kp.split('/')
        for i in range(1, len(parts) + 1):
            allowed.add('/'.join(parts[:i]))

    def emit(node, world, path):
        if path not in allowed:
            return None
        nid = len(doc['nodes'])
        # glTF ждёт матрицу как она хранится в skp (column-major); .T только для расчётов
        doc['nodes'].append({'name': node.name or node.definition_name or path,
                             'matrix': [float(v) for v in node.matrix]})
        rid = getattr(node, 'mesh_resource_id', None)
        # геометрию отдаём только отобранным узлам; предки нужны лишь как контейнеры
        if rid in res and path in keep:
            if rid not in mesh_cache:
                prs = primitives(rid)
                if prs:
                    mesh_cache[rid] = len(doc['meshes'])
                    doc['meshes'].append({'name': res[rid].definition_name or str(rid),
                                          'primitives': prs})
            if rid in mesh_cache:
                doc['nodes'][nid]['mesh'] = mesh_cache[rid]
            kept_paths.add(path)
        m = np.array(node.matrix, dtype=float).reshape(4, 4).T
        ch_ids = []
        for i, ch in enumerate(node.children):
            cid = emit(ch, world @ m, path + '/' + str(i))
            if cid is not None:
                ch_ids.append(cid)
        if ch_ids:
            doc['nodes'][nid]['children'] = ch_ids
        return nid

    root = emit(scene.scene_hierarchy, np.eye(4), '0')
    doc['scenes'][0]['nodes'] = [root] if root is not None else []

    lo = np.full(3, np.inf)
    hi = -lo.copy()
    tris = 0
    for e in keep:
        pass
    # габариты по оставшимся ресурсам
    for nid, node in enumerate(doc['nodes']):
        if 'mesh' not in node:
            continue
        pass
    for rid in mesh_cache:
        for pr in res[rid].primitives:
            pos = np.asarray(pr.positions, dtype=float).reshape(-1, 3)
            if len(pos):
                lo = np.minimum(lo, pos.min(0))
                hi = np.maximum(hi, pos.max(0))
            tris += len(pr.indices) // 3

    doc['buffers'][0]['byteLength'] = len(data)
    js = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    data.extend(b'\0' * ((-len(data)) % 4))
    blob = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(data))
    blob += struct.pack('<II', len(js), 0x4E4F534A) + js
    blob += struct.pack('<II', len(data), 0x004E4942) + bytes(data)
    Path(path).write_bytes(blob)
    return {'size_mm': [round(float(v), 1) for v in (hi - lo)] if np.isfinite(lo).all() else None,
            'tris': int(tris), 'images': len(doc.get('images', [])),
            'nodes': len(doc['nodes'])}


for p in files:
    key = p.stem
    out_path = OUT / (key + '.glb')
    if key in meta and out_path.exists() and meta[key].get('textured'):
        print('SKIP', p.name, flush=True)
        continue
    t0 = time.time()
    parsed = core_module.full_parse(str(p))
    scene = scene_module.build_instanced_scene(parsed)
    fixed = fix_unpainted(scene)
    res = {r.id: r for r in scene.mesh_resources}
    entries = walk(scene.scene_hierarchy, np.eye(4), [])
    keep = pick_machine(entries, res)
    if not keep:
        print('NO_KEEP', p.name, flush=True)
        continue
    info = export_glb(scene, res, getattr(scene, 'textures', []), keep, out_path)
    meta[key] = {'file': p.name, 'unpainted_fixed': fixed,
                 'glb': str(out_path.relative_to('/home/cyberkitty/Projects/cyberjack')),
                 'bytes': out_path.stat().st_size, 'textured': True,
                 'size_mm': info['size_mm'], 'tris': info['tris'],
                 'images': info['images'], 'nodes': info['nodes'],
                 'kept': len(keep), 'sec': round(time.time() - t0, 1)}
    json.dump(meta, open(META, 'w'), indent=1, ensure_ascii=False)
    print('DONE', p.name, 'keep', len(keep), 'tris', info['tris'],
          'images', info['images'], 'mb', round(out_path.stat().st_size / 1e6, 1), flush=True)
    del parsed, scene
    gc.collect()

print('ALL_DONE', len(meta), flush=True)
