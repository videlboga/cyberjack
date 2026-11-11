#!/usr/bin/env python3
"""Точная подгонка вещи по телу: расстояние считается до треугольников тела, а не до вершин.

Почему: вершина может быть снаружи, а ребро между двумя вершинами — пройти сквозь грудь,
именно это видно глазом как «кожа сквозь ткань». Поэтому:
  1) каждая вершина проецируется на поверхность тела (ближайшая точка треугольника);
  2) вершины ближе зазора выталкиваются по нормали грани;
  3) отдельно проверяются СЕРЕДИНЫ РЁБЕР — если середина внутри, оба конца отодвигаются;
  4) повторять, пока не останется пересечений.

Запуск:
  python3 fit_exact.py --glb <вещь.glb> --vrm <тело.vrm> [--clearance 0.004] [--iters 6]
"""
import argparse, json, os, struct
import numpy as np
from scipy.spatial import cKDTree

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
    dt = CT_DTYPE[a['componentType']]
    off = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    data = np.frombuffer(bytes(binary), dtype=dt, count=a['count'] * n, offset=off)
    return data.reshape(a['count'], n).copy(), off


def body_mesh(vrm):
    doc, binary = read_glb(vrm)
    tris, norms = [], []
    for node in doc['nodes']:
        if 'mesh' not in node or not (node.get('name') or '').lower().startswith('body'):
            continue
        for prim in doc['meshes'][node['mesh']]['primitives']:
            pos, _ = acc(doc, binary, prim['attributes']['POSITION'])
            idx, _ = acc(doc, binary, prim['indices'])
            pos = pos.astype(np.float32).reshape(-1, 3)
            idx = idx.astype(np.int64).ravel().reshape(-1, 3)
            tris.append(pos[idx])
    T = np.concatenate(tris).astype(np.float32)
    n = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    ln = np.linalg.norm(n, axis=1, keepdims=True) + 1e-12
    return T, (n / ln).astype(np.float32)


def closest_on_tris(P, T, TN, kd, k_near=64, chunk=256):
    """Расстояние до поверхности тела (со знаком) и нормаль ближайшей грани.

    Считаем не до вершин, а до треугольников — по K=64 ближайшим (cKDTree по центрам):
    полный перебор 25k треугольников в numpy слишком медленный, а ближайший треугольник
    практически всегда входит в эти K.
    """
    P = np.asarray(P, np.float32)
    out_d = np.empty(len(P), np.float32)
    out_n = np.empty((len(P), 3), np.float32)
    for s in range(0, len(P), chunk):
        pts = P[s:s + chunk]
        near = kd.query(pts, k=min(k_near, len(T)))[1]            # (c,k)
        if near.ndim == 1:
            near = near[:, None]
        tri = T[near]                                             # (c,k,3,3)
        a, b, c = tri[:, :, 0], tri[:, :, 1], tri[:, :, 2]
        p = pts[:, None, :]
        ab, ac, ap = b - a, c - a, p - a
        d1 = (ab * ap).sum(-1); d2 = (ac * ap).sum(-1)
        bp, cp = p - b, p - c
        d3 = (ab * bp).sum(-1); d4 = (ac * bp).sum(-1)
        d5 = (ab * cp).sum(-1); d6 = (ac * cp).sum(-1)
        va = d3 * d6 - d5 * d4
        vb = d5 * d2 - d1 * d6
        vc = d1 * d4 - d3 * d2
        den = va + vb + vc
        den = np.where(np.abs(den) < 1e-12, 1e-12, den)
        v = np.clip(vb / den, 0, 1)
        w = np.clip(vc / den, 0, 1)
        q = a + ab * v[..., None] + ac * w[..., None]

        def on_edge(p0, e):
            t = np.clip(((p - p0) * e).sum(-1) / ((e * e).sum(-1) + 1e-12), 0.0, 1.0)
            return p0 + e * t[..., None]

        cands = np.stack([on_edge(a, ab), on_edge(b, c - b), on_edge(c, a - c), q])  # (4,c,k,3)
        dist2 = ((cands - p) ** 2).sum(-1)                                        # (4,c,k)
        inside = (v >= 0) & (w >= 0) & (v + w <= 1)
        dist2[3] = np.where(inside, dist2[3], np.inf)
        which = dist2.argmin(0)                                                   # (c,k)
        dmin = dist2.min(0)                                                       # (c,k)
        kk = dmin.argmin(1)                                                       # (c,)
        rows = np.arange(len(kk))
        tri_idx = near[rows, kk]
        plane = ((pts - T[tri_idx, 0]) * TN[tri_idx]).sum(-1)
        out_d[s:s + chunk] = (np.sqrt(dmin[rows, kk]) * np.where(plane < 0, -1.0, 1.0)).astype(np.float32)
        out_n[s:s + chunk] = TN[tri_idx]
    return out_d, out_n


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--glb', required=True)
    ap.add_argument('--vrm', required=True)
    ap.add_argument('--clearance', type=float, default=0.004)
    ap.add_argument('--iters', type=int, default=6)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    T, TN = body_mesh(a.vrm)
    centroid = T.mean(1)
    kd = cKDTree(centroid)
    print(f'тело: {len(T)} треугольников')
    doc, binary = read_glb(a.glb)
    prim = doc['meshes'][0]['primitives'][0]
    pos, off = acc(doc, binary, prim['attributes']['POSITION'])
    pos = pos.astype(np.float32).reshape(-1, 3)
    idx, _ = acc(doc, binary, prim['indices']) if 'indices' in prim else (None, None)
    idx = idx.astype(np.int64).ravel().reshape(-1, 3) if idx is not None else None
    edges = (np.concatenate([idx[:, [0, 1]], idx[:, [1, 2]], idx[:, [2, 0]]]) if idx is not None
             else np.zeros((0, 2), np.int64))
    print(f'вещь: {len(pos)} вершин, {len(edges)} рёбер')

    def report(tag):
        d, _ = closest_on_tris(pos, T, TN, kd)
        mid = (pos[edges[:, 0]] + pos[edges[:, 1]]) * 0.5
        dm, _ = closest_on_tris(mid, T, TN, kd)
        print(f'{tag}: вершин внутри {int((d < 0).sum())} · середин рёбер внутри {int((dm < 0).sum())}'
              f' · зазор min {d.min()*1000:.1f} мм / медиана {np.median(d)*1000:.1f} мм')
        return int((d < 0).sum()), int((dm < 0).sum())

    report('до подгонки')
    for it in range(a.iters):
        d, nrm = closest_on_tris(pos, T, TN, kd)
        need = d < a.clearance
        mid = (pos[edges[:, 0]] + pos[edges[:, 1]]) * 0.5
        dm, nm = closest_on_tris(mid, T, TN, kd)
        bad_mid = dm < a.clearance
        if not need.any() and not bad_mid.any():
            print(f'итерация {it + 1}: пересечений нет')
            break
        move = np.zeros_like(pos)
        if need.any():
            move[need] += nrm[need] * (a.clearance - d[need])[:, None]
        if bad_mid.any():
            e = edges[bad_mid]
            push = (a.clearance - dm[bad_mid])[:, None] * nm[bad_mid]
            np.add.at(move, e[:, 0], push * 0.5)
            np.add.at(move, e[:, 1], push * 0.5)
        pos += move
        print(f'итерация {it + 1}: сдвиг вершин {int(need.sum())}, рёбер {int(bad_mid.sum())},'
              f' максимум {np.linalg.norm(move, axis=1).max()*1000:.1f} мм')

    report('после подгонки')
    if a.dry_run:
        print('dry-run: файл не изменён')
        return
    raw = pos.astype(np.float32).tobytes()
    binary[off:off + len(raw)] = raw
    ac = doc['accessors'][prim['attributes']['POSITION']]
    ac['min'] = [float(x) for x in pos.min(0)]
    ac['max'] = [float(x) for x in pos.max(0)]
    write_glb(a.glb, doc, binary)
    print(f'записано: {a.glb} ({os.path.getsize(a.glb)/1e6:.2f} МБ)')


if __name__ == '__main__':
    main()
