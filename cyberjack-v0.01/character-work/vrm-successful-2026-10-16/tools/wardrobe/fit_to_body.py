#!/usr/bin/env python3
"""Подгонка вещи по телу: выталкивает вершины, которые проваливаются внутрь тела.

Зачем: одежда из KK сшита под «свою» грудь/фигуру. На модели с другим объёмом она либо
проваливается (лежит как на плоской), либо слегка просвечивает. Параметры экспорта:
  --clearance   зазор до поверхности тела (м), по умолчанию 0.004
  --max-dist    трогать только вершины ближе этого к телу (м), по умолчанию 0.03
  --push-max    предохранитель: не выталкивать сильнее этого (м), по умолчанию 0.05

Запуск:
  python3 fit_to_body.py --glb wardrobe/items/kk/kk-tops-ofcard-b.glb \
      --vrm characters/mira/Mira_outfit_03.vrm --clearance 0.004
"""
import argparse, json, os, struct, sys
import numpy as np

GLB_MAGIC, CHUNK_JSON, CHUNK_BIN = 0x46546C67, 0x4E4F534A, 0x004E4942
CT_SIZE = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
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


def accessor(doc, binary, index):
    acc = doc['accessors'][index]
    bv = doc['bufferViews'][acc['bufferView']]
    n = NCOMP[acc['type']]
    dt = CT_DTYPE[acc['componentType']]
    off = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    data = np.frombuffer(bytes(binary), dtype=dt, count=acc['count'] * n, offset=off)
    return data.reshape(acc['count'], n), off, dt, bv


def body_cloud(vrm_path):
    doc, binary = read_glb(vrm_path)
    pts, nrm = [], []
    for node in doc['nodes']:
        if 'mesh' not in node or not (node.get('name') or '').lower().startswith('body'):
            continue
        for prim in doc['meshes'][node['mesh']]['primitives']:
            pos, *_ = accessor(doc, binary, prim['attributes']['POSITION'])
            pts.append(pos.astype(np.float32))
            if 'NORMAL' in prim['attributes']:
                n, *_ = accessor(doc, binary, prim['attributes']['NORMAL'])
                nrm.append(n.astype(np.float32))
    if not pts:
        raise SystemExit('в VRM не нашёл меш тела')
    return np.concatenate(pts), np.concatenate(nrm) if nrm else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--glb', required=True)
    ap.add_argument('--vrm', required=True)
    ap.add_argument('--clearance', type=float, default=0.0025)
    ap.add_argument('--smooth', type=int, default=8)
    ap.add_argument('--max-dist', type=float, default=0.03)
    ap.add_argument('--pull-dist', type=float, default=0.012,
                    help='вершины, висящие дальше зазора, но ближе этого — притягивать к телу')
    ap.add_argument('--push-max', type=float, default=0.05)
    ap.add_argument('--passes', type=int, default=3)
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args()

    body, bnrm = body_cloud(a.vrm)
    if bnrm is None:
        raise SystemExit('у тела нет NORMAL — без нормалей подгонка невозможна')
    doc, binary = read_glb(a.glb)
    prim = doc['meshes'][0]['primitives'][0]
    pos, off, dt, bv = accessor(doc, binary, prim['attributes']['POSITION'])
    pos = pos.astype(np.float32).copy()
    n = len(pos)
    print(f'вещь: {n} вершин · тело: {len(body)} вершин')

    def nearest_of(points):
        idx = np.empty(len(points), np.int32)
        dst = np.empty(len(points), np.float32)
        for start in range(0, len(points), 512):
            chunk = points[start:start + 512]
            d2 = ((chunk[:, None, :] - body[None, :, :]) ** 2).sum(-1)
            k = d2.argmin(1)
            idx[start:start + 512] = k
            dst[start:start + 512] = np.sqrt(d2[np.arange(len(chunk)), k])
        return idx, dst

    nearest, dist = nearest_of(pos)
    signed = ((pos - body[nearest]) * bnrm[nearest]).sum(1)
    print(f'под поверхностью тела: {int((signed < 0).sum())} вершин · ближе {a.max_dist*1000:.0f} мм: {int((dist < a.max_dist).sum())}')

    # рёбра меша — чтобы сдвиг шёл «полем», а не отдельными шипами
    tri = accessor(doc, binary, prim['indices'])[0].reshape(-1, 3) if 'indices' in prim else None
    edges = (np.concatenate([tri[:, [0, 1]], tri[:, [1, 2]], tri[:, [2, 0]]]).T if tri is not None
             else np.zeros((2, 0), np.int32))
    deg = np.bincount(edges.ravel(), minlength=n).astype(np.float32) + 1e-6

    for p_i in range(a.passes):
        nearest, dist = nearest_of(pos)
        signed = ((pos - body[nearest]) * bnrm[nearest]).sum(1)
        # и выталкиваем провалившиеся, и притягиваем висящие — иначе ткань остаётся «скорлупой»
        move = (signed < a.clearance) & (dist < a.max_dist)
        pull = (signed > a.clearance) & (signed < a.pull_dist) & (dist < a.max_dist)
        move = move | pull
        push = np.clip(a.clearance - signed, -a.pull_dist, a.push_max)
        if not move.any():
            print(f'проход {p_i + 1}: двигать нечего')
            break
        d = np.zeros_like(pos)
        d[move] = bnrm[nearest][move] * push[move, None]
        # сглаживаем поле сдвига по рёбрам: ткань облегает, а не встаёт панцирем
        for _ in range(a.smooth):
            sums = np.zeros_like(pos)
            np.add.at(sums, edges[0], d[edges[1]])
            np.add.at(sums, edges[1], d[edges[0]])
            d = 0.55 * d + 0.45 * (sums / deg[:, None])
        pos += d
        print(f'проход {p_i + 1}: сдвинуто {int(move.sum())} вершин, максимум {np.linalg.norm(d, axis=1).max()*1000:.1f} мм')

    # страховка: всё, что осталось под поверхностью, дожимаем точно до зазора (без сглаживания)
    nearest, dist = nearest_of(pos)
    for _ in range(6):
        sg = ((pos - body[nearest]) * bnrm[nearest]).sum(1)
        bad = sg < 0
        if not bad.any():
            break
        pos[bad] += bnrm[nearest][bad] * (-sg[bad])[:, None]
        nearest, dist = nearest_of(pos)
    else:
        sg = ((pos - body[nearest]) * bnrm[nearest]).sum(1)
        print(f'страховка: осталось {int((sg < 0).sum())} вершин под поверхностью')

    nearest, dist = nearest_of(pos)
    after = ((pos - body[nearest]) * bnrm[nearest]).sum(1)
    print(f'итог: под поверхностью {int((after < 0).sum())} вершин'
          f' · зазор min {after.min()*1000:.1f} мм / медиана {np.median(after)*1000:.1f} мм')

    if a.dry_run:
        print('dry-run: файл не изменён')
        return
    raw = pos.astype(np.float32).tobytes()
    binary[off:off + len(raw)] = raw
    # обновить min/max у accessor'а
    acc = doc['accessors'][prim['attributes']['POSITION']]
    acc['min'] = [float(x) for x in pos.min(0)]
    acc['max'] = [float(x) for x in pos.max(0)]
    write_glb(a.glb, doc, binary)
    print(f'записано: {a.glb} ({os.path.getsize(a.glb)/1e6:.2f} МБ)')


if __name__ == '__main__':
    main()
