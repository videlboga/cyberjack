#!/usr/bin/env python3
"""Подгонка груди без ломки силуэта: вещь раздувается вокруг костей груди на измеренную величину.

Почему не «выталкивание вершин»: оно рвёт кромки (пики до 400 мм при точном варианте) и оставляет
«панцирь». Здесь меняется только масштаб области груди, с плавным переходом к остальной вещи:

    p' = c + (p - c) · k,   k подбирается так, чтобы ни одна вершина не оказалась внутри тела

где c — центр области груди, k — общий множитель (не по вершинам, поэтому силуэт сохраняется),
влияние плавно гасится по весу на костях груди.

Запуск:
  python3 fit_bust.py --glb <вещь.glb> --vrm <тело.vrm> [--clearance 0.003] [--max-scale 1.35]
"""
import argparse, json, os, struct
import numpy as np

GLB_MAGIC, CHUNK_JSON, CHUNK_BIN = 0x46546C67, 0x4E4F534A, 0x004E4942
CT_DTYPE = {5121: np.uint8, 5123: np.uint16, 5125: np.uint32, 5126: np.float32}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def read_glb(path):
    with open(path, 'rb') as f:
        struct.unpack('<III', f.read(12))
        chunks = {}
        while True:
            head = f.read(8)
            if len(head) < 8:
                break
            clen, ctype = struct.unpack('<II', head)
            chunks[ctype] = f.read(clen)
    return json.loads(chunks[CHUNK_JSON].decode()), bytearray(chunks[CHUNK_BIN])


def write_glb(path, doc, binary):
    js = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode()
    js += b' ' * ((4 - len(js) % 4) % 4)
    bn = bytes(binary) + b'\x00' * ((4 - len(binary) % 4) % 4)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', GLB_MAGIC, 2, 12 + 8 + len(js) + 8 + len(bn)))
        f.write(struct.pack('<II', len(js), CHUNK_JSON)); f.write(js)
        f.write(struct.pack('<II', len(bn), CHUNK_BIN)); f.write(bn)


def acc(doc, binary, index):
    a = doc['accessors'][index]
    bv = doc['bufferViews'][a['bufferView']]
    n = NCOMP[a['type']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    data = np.frombuffer(bytes(binary), dtype=CT_DTYPE[a['componentType']],
                         count=a['count'] * n, offset=off)
    return data.reshape(a['count'], n).copy(), off


def body_cloud(vrm):
    doc, binary = read_glb(vrm)
    pts, nrm = [], []
    for node in doc['nodes']:
        if 'mesh' not in node or not (node.get('name') or '').lower().startswith('body'):
            continue
        for prim in doc['meshes'][node['mesh']]['primitives']:
            p, _ = acc(doc, binary, prim['attributes']['POSITION'])
            pts.append(p.astype(np.float32))
            if 'NORMAL' in prim['attributes']:
                n, _ = acc(doc, binary, prim['attributes']['NORMAL'])
                nrm.append(n.astype(np.float32))
    return np.concatenate(pts), np.concatenate(nrm)


def signed_distance(P, body, bnrm, kd, k=8):
    """знаковое расстояние до поверхности тела по k ближайшим вершинам"""
    d, idx = kd.query(P, k=k)
    if idx.ndim == 1:
        idx, d = idx[:, None], d[:, None]
    diff = P[:, None, :] - body[idx]
    n = bnrm[idx]
    proj = (diff * n).sum(-1)
    # берём вершину с наибольшей проекцией на её нормаль — устойчивее у выпуклостей
    j = proj.argmax(1)
    rows = np.arange(len(P))
    return proj[rows, j], d[rows, j]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--glb', required=True)
    ap.add_argument('--vrm', required=True)
    ap.add_argument('--clearance', type=float, default=0.003)
    ap.add_argument('--max-scale', type=float, default=1.35)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    from scipy.spatial import cKDTree
    body, bnrm = body_cloud(a.vrm)
    kd = cKDTree(body)
    doc, binary = read_glb(a.glb)
    prim = doc['meshes'][0]['primitives'][0]
    pos, off = acc(doc, binary, prim['attributes']['POSITION'])
    pos = pos.astype(np.float32).reshape(-1, 3)
    joints, _ = acc(doc, binary, prim['attributes']['JOINTS_0'])
    weights, _ = acc(doc, binary, prim['attributes']['WEIGHTS_0'])
    joints = joints.astype(np.int64).ravel().reshape(-1, 4)
    weights = weights.astype(np.float32).ravel().reshape(-1, 4)

    names = [doc['nodes'][n].get('name', '') for n in doc['skins'][0]['joints']]
    bust = np.array([i for i, nm in enumerate(names) if 'bust' in nm.lower()], np.int64)
    print(f'вещь: {len(pos)} вершин · костей груди в скине: {len(bust)}')

    bw = np.zeros(len(pos), np.float32)
    if len(bust):
        mask = np.isin(joints, bust)
        bw = (weights * mask).sum(1)
    # плавное влияние: у вершины может быть 1-2 кости груди из 4
    blend = np.clip(bw * 1.6, 0, 1).astype(np.float32)
    print(f'вершин, затронутых груди: {int((bw > 0.1).sum())} · полностью: {int((blend > 0.95).sum())}')

    d0, _ = signed_distance(pos, body, bnrm, kd)
    print(f'до: внутри {int((d0 < 0).sum())} вершин · глубина max {(-d0).max()*1000:.1f} мм'
          f' · медиана {np.median(d0)*1000:.1f} мм')

    region = blend > 0.05
    if not region.any():
        raise SystemExit('в вещи нет весов на костях груди — этот способ не применим')
    center = pos[region].mean(0)
    center[2] = float(np.median(pos[region][:, 2]))  # по глубине — на оси груди
    print('центр области груди:', np.round(center, 3))

    base = pos.copy()
    best = None
    scale = 1.0
    while scale <= a.max_scale + 1e-9:
        pos = base.copy()
        pos[region] = center + (base[region] - center) * scale
        d, _ = signed_distance(pos, body, bnrm, kd)
        inside = int((d < -a.clearance).sum())
        print(f'  масштаб {scale:.2f}: внутри {inside} вершин · глубина max {(-d.min())*1000:.1f} мм')
        if inside == 0:
            best = scale
            break
        scale = round(scale + 0.02, 3)

    if best is None:
        print(f'не хватило масштаба до {a.max_scale}: вещь слишком мала, нужен другой вариант/размер')
        scale = a.max_scale
        pos = base.copy()
        pos[region] = center + (base[region] - center) * scale
    else:
        print(f'подобран масштаб: {best:.2f}')

    d, _ = signed_distance(pos, body, bnrm, kd)
    print(f'после: внутри {int((d < 0).sum())} вершин · зазор min {d.min()*1000:.1f} мм'
          f' / медиана {np.median(d)*1000:.1f} мм')

    if a.dry_run:
        print('dry-run: файл не изменён')
        return
    binary[off:off + len(pos.astype(np.float32).tobytes())] = pos.astype(np.float32).tobytes()
    ac = doc['accessors'][prim['attributes']['POSITION']]
    ac['min'] = [float(x) for x in pos.min(0)]
    ac['max'] = [float(x) for x in pos.max(0)]
    write_glb(a.glb, doc, binary)
    print(f'записано: {a.glb} ({os.path.getsize(a.glb)/1e6:.2f} МБ)')


if __name__ == '__main__':
    main()
