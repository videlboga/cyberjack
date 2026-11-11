#!/usr/bin/env python3
"""Вырезает вещи одежды из VRM в отдельные маленькие GLB + собирает wardrobe.json.

Работает на уровне glTF: копирует только нужные accessor/bufferView/image/material вместе
с расширениями (VRMC_materials_mtoon сохраняется как есть), скелет заменяется заглушками-
костями с теми же именами и теми же inverseBindMatrices — по ним вещь пришивается
к телу в рантайме.

Запуск:
  python3 extract_garments.py --character mira --out ../../wardrobe \
      --vrm mira/Mira_outfit_00.vrm mira/Mira_outfit_01.vrm ...
"""
import argparse, json, os, struct, sys, hashlib, re

GLB_MAGIC, CHUNK_JSON, CHUNK_BIN = 0x46546C67, 0x4E4F534A, 0x004E4942

SLOT_RULES = [
    ('underwear_top', ('bra',)),
    ('underwear_bottom', ('panties', 'shiruku', 'shorts_ysho')),
    ('socks', ('socks', 'ztoki', 'knee02', 'kyonc')),
    ('shoes', ('shoes', 'boots')),
    ('top', ('puffer', 'top', 'shirt', 'jacket', 'tuxedo', 'blouse', 'sweater', 'aonep')),
    ('bottom', ('bot_', 'pants', 'shorts', 'skirt', 'dan_f', 'dankon')),
    ('accessory', ('acs', 'chocker', 'belt', 'bell', 'haibisukasu', 'glass', 'earring')),
]
GENITAL = ('dan_f', 'dankon')


def read_glb(path):
    with open(path, 'rb') as f:
        magic, ver, length = struct.unpack('<III', f.read(12))
        if magic != GLB_MAGIC:
            raise ValueError('не GLB: ' + path)
        chunks = {}
        while f.tell() < length:
            clen, ctype = struct.unpack('<II', f.read(8))
            chunks[ctype] = f.read(clen)
    return json.loads(chunks[CHUNK_JSON].decode('utf-8')), chunks.get(CHUNK_BIN, b'')


def write_glb(path, doc, binary):
    doc = dict(doc)
    doc['buffers'] = [{'byteLength': len(binary)}]
    js = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    js += b' ' * ((4 - len(js) % 4) % 4)
    bn = binary + b'\x00' * ((4 - len(binary) % 4) % 4)
    total = 12 + 8 + len(js) + 8 + len(bn)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', GLB_MAGIC, 2, total))
        f.write(struct.pack('<II', len(js), CHUNK_JSON)); f.write(js)
        f.write(struct.pack('<II', len(bn), CHUNK_BIN)); f.write(bn)


def to_unlit_pbr(mat):
    """MToon требует VRM-контекста при загрузке; в отдельном GLB оставляем unlit-PBR."""
    mtoon = (mat.get('extensions') or {}).pop('VRMC_materials_mtoon', None)
    if mat.get('extensions') == {}:
        mat.pop('extensions')
    if mtoon:
        pbr = mat.setdefault('pbrMetallicRoughness', {})
        if 'baseColorFactor' in mtoon: pbr['baseColorFactor'] = mtoon['baseColorFactor']
        if 'baseColorTexture' in mtoon: pbr['baseColorTexture'] = mtoon['baseColorTexture']
        pbr.setdefault('metallicFactor', 0.0)
        pbr.setdefault('roughnessFactor', 1.0)
    return mat


def slot_of(material_name):
    low = (material_name or '').lower()
    if any(g in low for g in GENITAL):
        return 'genital'
    for slot, keys in SLOT_RULES:
        if any(k in low for k in keys):
            return slot
    return 'other'


def group_of(material_name):
    """базовое имя вещи: 'KK cf_top_aonep_m 8372' и '... 8412' — одна вещь из двух частей"""
    base = re.sub(r'\s+\d+$', '', material_name or '')
    return slug(base)


def slug(text):
    s = re.sub(r'[^a-z0-9]+', '-', (text or 'item').lower()).strip('-')
    return s or 'item'


def garment_primitives(doc):
    """→ [(node_index, mesh_index, primitive_index, material_name)]"""
    out = []
    mats = doc.get('materials', [])
    meshes = doc.get('meshes', [])
    for ni, node in enumerate(doc.get('nodes', [])):
        if 'mesh' not in node:
            continue
        name = (node.get('name') or '').lower()
        if name.startswith(('body', 'hair')):
            continue
        for pi, pr in enumerate(meshes[node['mesh']]['primitives']):
            mi = pr.get('material')
            out.append((ni, node['mesh'], pi, mats[mi].get('name') if mi is not None else None))
    return out


def extract_item(doc, binary, node_i, mesh_i, prim_i):
    """Собирает минимальный glTF для одного примитива одежды."""
    acc_src = doc['accessors']
    bvs_src = doc['bufferViews']
    primitive = doc['meshes'][mesh_i]['primitives'][prim_i]
    src_node = doc['nodes'][node_i]
    skin_src = doc['skins'][src_node['skin']]

    used_bv, used_acc = [], []

    def acc(idx):
        if idx is None:
            return None
        if idx not in used_acc:
            used_acc.append(idx)
            bv = acc_src[idx].get('bufferView')
            if bv is not None and bv not in used_bv:
                used_bv.append(bv)
        return used_acc.index(idx)

    attrs = {k: acc(v) for k, v in primitive['attributes'].items()}
    indices = acc(primitive.get('indices'))
    ibm = acc(skin_src.get('inverseBindMatrices'))

    # материалы/текстуры/изображения
    mat_src_i = primitive.get('material')
    mat_indices, tex_indices, img_indices, sampler_indices = [], [], [], []
    tex_src = doc.get('textures', [])
    img_src = doc.get('images', [])
    smp_src = doc.get('samplers', [])

    def note_texture(ti):
        if ti is None or ti in tex_indices:
            return
        tex_indices.append(ti)
        tex = tex_src[ti]
        si = tex.get('source')
        if si is not None:
            img_indices.append(si)
            bv = img_src[si].get('bufferView')
            if bv is not None and bv not in used_bv:
                used_bv.append(bv)
        sm = tex.get('sampler')
        if sm is not None and sm not in sampler_indices:
            sampler_indices.append(sm)

    if mat_src_i is not None:
        mat = json.loads(json.dumps(doc['materials'][mat_src_i]))
        # MToon требует VRM-контекста при загрузке; для отдельного GLB оставляем unlit-PBR
        mtoon = (mat.get('extensions') or {}).pop('VRMC_materials_mtoon', None)
        if mat.get('extensions') == {}:
            mat.pop('extensions')
        if mtoon:
            pbr = mat.setdefault('pbrMetallicRoughness', {})
            if 'baseColorFactor' in mtoon: pbr['baseColorFactor'] = mtoon['baseColorFactor']
            if 'baseColorTexture' in mtoon: pbr['baseColorTexture'] = mtoon['baseColorTexture']
            pbr.setdefault('metallicFactor', 0.0)
            pbr.setdefault('roughnessFactor', 1.0)
        def walk(o):
            if isinstance(o, dict):
                for k, v in o.items():
                    if k == 'index' and isinstance(v, int):
                        note_texture(v)
                    else:
                        walk(v)
            elif isinstance(o, list):
                for v in o:
                    walk(v)
        walk(mat)
        mat_indices.append(mat_src_i)

    # новый бинарник: копируем нужные bufferView подряд
    new_bin = bytearray()
    bv_map = {}
    for old_i in used_bv:
        bv = bvs_src[old_i]
        start = bv.get('byteOffset', 0)
        chunk = binary[start:start + bv['byteLength']]
        while len(new_bin) % 4:
            new_bin.append(0)
        bv_map[old_i] = {'buffer': 0, 'byteOffset': len(new_bin), 'byteLength': bv['byteLength']}
        if 'byteStride' in bv:
            bv_map[old_i]['byteStride'] = bv['byteStride']
        if 'target' in bv:
            bv_map[old_i]['target'] = bv['target']
        new_bin += chunk

    new_doc = {'asset': {'version': '2.0', 'generator': 'cyberjack-extract-garments'},
               'extensionsUsed': [e for e in doc.get('extensionsUsed', [])
                                  if e.lower() in ('khr_materials_unlit',)],
               'scene': 0, 'scenes': [{'nodes': [0]}],
               'accessors': [], 'bufferViews': [], 'materials': [], 'textures': [],
               'images': [], 'samplers': [], 'meshes': [], 'nodes': [], 'skins': []}

    for old_i in used_bv:
        new_doc['bufferViews'].append(bv_map[old_i])
    for old_i in used_acc:
        a = json.loads(json.dumps(acc_src[old_i]))
        a['bufferView'] = used_bv.index(acc_src[old_i]['bufferView'])
        new_doc['accessors'].append(a)
    for old_i in mat_indices:
        m = to_unlit_pbr(json.loads(json.dumps(doc['materials'][old_i])))
        def remap(o):
            if isinstance(o, dict):
                if 'index' in o and isinstance(o['index'], int):
                    o['index'] = tex_indices.index(o['index'])
                for k, v in o.items():
                    if k != 'index':
                        remap(v)
            elif isinstance(o, list):
                for v in o:
                    remap(v)
        remap(m)
        new_doc['materials'].append(m)
    for old_i in tex_indices:
        t = json.loads(json.dumps(tex_src[old_i]))
        t['source'] = img_indices.index(t['source'])
        if t.get('sampler') in sampler_indices:
            t['sampler'] = sampler_indices.index(t['sampler'])
        new_doc['textures'].append(t)
    for old_i in img_indices:
        new_doc['images'].append({'bufferView': used_bv.index(img_src[old_i]['bufferView']),
                                  'mimeType': img_src[old_i].get('mimeType', 'image/png')})
    for old_i in sampler_indices:
        new_doc['samplers'].append(smp_src[old_i])

    new_prim = {'attributes': attrs}
    if indices is not None:
        new_prim['indices'] = indices
    if 'mode' in primitive:
        new_prim['mode'] = primitive['mode']
    if 'targets' in primitive:
        new_prim['targets'] = primitive['targets']
    new_prim['material'] = 0
    new_doc['meshes'].append({'name': (doc['meshes'][mesh_i].get('name') or 'item'), 'primitives': [new_prim]})

    # узлы: 0 — меш, дальше заглушки костей в порядке skin.joints
    joints_src = skin_src['joints']
    idx_of = {src: i + 1 for i, src in enumerate(joints_src)}
    new_doc['nodes'].append({'name': (src_node.get('name') or 'Garment'), 'mesh': 0, 'skin': 0})
    for src in joints_src:
        node = doc['nodes'][src]
        stub = {'name': node.get('name')}
        parent = next((pi for pi, pn in enumerate(doc['nodes']) if src in (pn.get('children') or [])), None)
        if parent in idx_of:
            stub_children = None
        new_doc['nodes'].append(stub)
    for src, i in idx_of.items():
        parent = next((p for p, pn in enumerate(doc['nodes']) if src in (pn.get('children') or [])), None)
        if parent in idx_of:
            new_doc['nodes'][idx_of[parent]].setdefault('children', []).append(i)
    new_doc['skins'].append({'joints': list(range(1, len(joints_src) + 1)), 'inverseBindMatrices': ibm})
    new_doc['scenes'][0]['nodes'] = [0, 1]

    return new_doc, bytes(new_bin)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--character', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--vrm', nargs='+', required=True)
    ap.add_argument('--keep-genital', action='store_true', help='включать генитальные примитивы (по умолчанию пропускаются)')
    a = ap.parse_args()
    items_dir = os.path.join(a.out, 'items', a.character)
    os.makedirs(items_dir, exist_ok=True)
    items, seen_ids = [], set()

    for vrm_path in a.vrm:
        doc, binary = read_glb(vrm_path)
        outfit = re.search(r'outfit[_-](\d+)', os.path.basename(vrm_path))
        outfit_id = outfit.group(1) if outfit else os.path.basename(vrm_path)
        skin_src = doc['skins'][0]
        bones = [doc['nodes'][i].get('name') for i in skin_src['joints']]
        boneset = hashlib.sha256('\n'.join(bones).encode()).hexdigest()[:12]
        for node_i, mesh_i, prim_i, mat_name in garment_primitives(doc):
            slot = slot_of(mat_name)
            if slot == 'genital' and not a.keep_genital:
                continue
            item_id = f'{a.character}-{outfit_id}-{slug(mat_name)}'[:64]
            group = group_of(mat_name)
            if item_id in seen_ids:
                continue
            item_doc, item_bin = extract_item(doc, binary, node_i, mesh_i, prim_i)
            path = os.path.join(items_dir, item_id + '.glb')
            write_glb(path, item_doc, item_bin)
            seen_ids.add(item_id)
            pos_acc = item_doc['accessors'][item_doc['meshes'][0]['primitives'][0]['attributes']['POSITION']]
            y_range = [round(min(pos_acc.get('min', [0, 0, 0])[1], pos_acc.get('max', [0, 0, 0])[1]), 3),
                       round(max(pos_acc.get('min', [0, 0, 0])[1], pos_acc.get('max', [0, 0, 0])[1]), 3)]
            items.append({'id': item_id, 'character': a.character, 'slot': slot, 'y': y_range,
                          'group': group, 'material': mat_name, 'source': os.path.basename(vrm_path),
                          'outfit': outfit_id, 'boneset': boneset, 'joints': len(bones),
                          'file': os.path.relpath(path, a.out), 'bytes': os.path.getsize(path)})
            print(f"  {slot:16s} {item_id:52s} {os.path.getsize(path)/1e6:.2f} МБ")

    # группировка: одинаковый group в одном аутфите = одна вещь из нескольких частей
    by_group = {}
    for it in items:
        by_group.setdefault((it['outfit'], it['group']), []).append(it)
    for (outfit, group), parts in by_group.items():
        if len(parts) < 2:
            parts[0]['part'] = 1
            parts[0]['parts'] = 1
            continue
        # вещь из нескольких частей: если вместе они покрывают и бёдра, и грудь — это платье/комбинезон
        lo = min(p['y'][0] for p in parts if p.get('y'))
        hi = max(p['y'][1] for p in parts if p.get('y'))
        slots = {p['slot'] for p in parts}
        slot = 'dress' if (lo < 0.95 and hi > 1.25) or len(slots) > 1 else parts[0]['slot']
        for n, part in enumerate(sorted(parts, key=lambda x: x['id']), start=1):
            part['slot'] = slot
            part['part'] = n
            part['parts'] = len(parts)
        print(f"  группа {group}: {len(parts)} части → слот {slot}")

    manifest_path = os.path.join(a.out, 'wardrobe.json')
    manifest = {'format': 'cyberjack-wardrobe-v1', 'character': a.character,
                'boneset': {'joints': items[0]['joints'] if items else 0,
                            'hash': items[0]['boneset'] if items else ''},
                'items': items}
    if os.path.exists(manifest_path):
        old = json.load(open(manifest_path))
        other = [i for i in old.get('items', []) if i['character'] != a.character]
        manifest['items'] = other + items
        manifest['characters'] = sorted({i['character'] for i in manifest['items']})
    json.dump(manifest, open(manifest_path, 'w'), ensure_ascii=False, indent=1)
    print(f'\nвсего вещей: {len(items)} · манифест {manifest_path}')


if __name__ == '__main__':
    main()
