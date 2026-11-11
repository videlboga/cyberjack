#!/usr/bin/env python3
"""Разносит 4 кости пальцев по ширине стопы и жёстко перевешивает носок.

Причина: в VRM все `k_f_toe{L,R}_00..03` стоят в одной точке (проверено по inverse bind matrices),
поэтому «разведение пальцев» физически не может ничего развести, а мягкий перевес тянет одну и ту же
кожу соседними костями.

Что делает:
1. Находит облако вершин носка (по весам на `Left/Right toe` и пальцы) — ширина ~6 см.
2. Ставит 4 кости пальцев по этой ширине (15 / 38 / 62 / 85 %).
3. Пересчитывает inverse bind matrix для сдвинутых костей (иначе изменится поза покоя).
4. Жёстко назначает вершины носка ближайшей кости; у свода оставляет долю веса на плюсне.

Запуск:
  python3 fix_toe_fan.py --in ../../characters/mira/Mira_outfit_03.vrm \
      --out ../../characters/mira/Mira_outfit_03_toes.vrm
"""
import argparse
import json
import math
import struct

FMT = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
FRACTIONS = (0.15, 0.38, 0.62, 0.85)   # где ставим кости пальцев по ширине носка


def load(path):
    raw = open(path, 'rb').read()
    jlen = struct.unpack('<I', raw[12:16])[0]
    gltf = json.loads(raw[20:20 + jlen])
    off = 20 + jlen
    btype = raw[off + 4:off + 8]
    return gltf, bytearray(raw[off + 8:]), btype


def acc(gltf, i):
    a = gltf['accessors'][i]
    bv = gltf['bufferViews'][a['bufferView']]
    return a, bv, bv.get('byteOffset', 0) + a.get('byteOffset', 0)


def read_acc(gltf, bins, i):
    a, bv, off = acc(gltf, i)
    code, size = FMT[a['componentType']]
    nc = NCOMP[a['type']]
    stride = bv.get('byteStride') or nc * size
    return [struct.unpack_from('<' + code * nc, bins, off + k * stride) for k in range(a['count'])]


def write_acc(gltf, bins, i, vals):
    a, bv, off = acc(gltf, i)
    code, size = FMT[a['componentType']]
    nc = NCOMP[a['type']]
    stride = bv.get('byteStride') or nc * size
    for k, v in enumerate(vals):
        struct.pack_into('<' + code * nc, bins, off + k * stride, *v)


def read_ibms(gltf, bins):
    skin = gltf['skins'][0]
    a, bv, off = acc(gltf, skin['inverseBindMatrices'])
    out = []
    for k in range(a['count']):
        m = struct.unpack_from('<16f', bins, off + k * 64)
        R = [[m[0], m[4], m[8]], [m[1], m[5], m[9]], [m[2], m[6], m[10]]]
        t = [m[12], m[13], m[14]]
        out.append({'m': m, 'R': R, 't': t})
    return out


def ibm_world(ibm):
    R, t = ibm['R'], ibm['t']
    return [-(R[0][i] * t[0] + R[1][i] * t[1] + R[2][i] * t[2]) for i in range(3)]


def write_ibm_pos(bins, off, k, ibm, p):
    """IBM = [R | -R·p]; меняем только позицию."""
    R = ibm['R']
    t = [-(R[i][0] * p[0] + R[i][1] * p[1] + R[i][2] * p[2]) for i in range(3)]
    m = list(ibm['m'])
    m[12], m[13], m[14] = t
    struct.pack_into('<16f', bins, off + k * 64, *m)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--out', dest='dst', required=True)
    a = ap.parse_args()

    gltf, bins, btype = load(a.src)
    nodes = gltf['nodes']
    skin = gltf['skins'][0]
    joints = skin['joints']
    slot = {j: i for i, j in enumerate(joints)}
    nm = {j: nodes[j].get('name', '') for j in joints}
    ibms = read_ibms(gltf, bins)
    _, _, ibm_off = acc(gltf, skin['inverseBindMatrices'])

    base = {'L': slot[[j for j in joints if nm[j] == 'Left toe'][0]],
            'R': slot[[j for j in joints if nm[j] == 'Right toe'][0]]}
    toes = {'L': sorted([j for j in joints if nm[j].startswith('k_f_toeL_')], key=lambda j: nm[j]),
            'R': sorted([j for j in joints if nm[j].startswith('k_f_toeR_')], key=lambda j: nm[j])}

    # облако вершин носка по сторонам
    cloud = {'L': [], 'R': []}
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            at = prim['attributes']
            if not all(k in at for k in ('JOINTS_0', 'WEIGHTS_0', 'POSITION')):
                continue
            for js, ws, p in zip(read_acc(gltf, bins, at['JOINTS_0']),
                                 read_acc(gltf, bins, at['WEIGHTS_0']),
                                 read_acc(gltf, bins, at['POSITION'])):
                for s in ('L', 'R'):
                    if any(w > 0.05 and (j == base[s] or j in toes[s]) for j, w in zip(js, ws)):
                        cloud[s].append(p)
                        break

    # ставим кости по ширине носка
    placed = {'L': [], 'R': []}
    for s in ('L', 'R'):
        pts = cloud[s]
        xs = [p[0] for p in pts]
        x_min, x_max = min(xs), max(xs)
        cur = [ibm_world(ibms[slot[j]]) for j in toes[s]]
        y = sum(c[1] for c in cur) / len(cur)
        z = sum(c[2] for c in cur) / len(cur)
        for frac, j in zip(FRACTIONS, toes[s]):
            target = [x_min + (x_max - x_min) * frac, y, z]
            k = slot[j]
            parent_slot = slot[nodes[j]['children'][0]] if False else None
            # локальная трансляция: относительно родителя (плюсна)
            parent_node = None
            for n_i, n in enumerate(nodes):
                if j in n.get('children', []):
                    parent_node = n_i
                    break
            p_slot = slot[parent_node] if parent_node in slot else None
            if p_slot is None:
                continue
            p_world = ibm_world(ibms[p_slot])
            R = ibms[p_slot]['R']
            d = [target[i] - p_world[i] for i in range(3)]
            local = [sum(R[row][i] * d[row] for row in range(3)) for i in range(3)]
            nodes[j]['translation'] = [round(v, 6) for v in local]
            write_ibm_pos(bins, ibm_off, k, ibms[k], target)
            placed[s].append(target)
            print(f'  {nm[j]:12} → x={target[0]:+.3f} (было {ibm_world(ibms[k])[0]:+.3f})')

    # жёсткий перевес по ближайшей кости
    anchors = {s: placed[s] or [ibm_world(ibms[slot[j]]) for j in toes[s]] for s in ('L', 'R')}
    changed = 0
    for mesh in gltf['meshes']:
        for prim in mesh['primitives']:
            at = prim['attributes']
            if not all(k in at for k in ('JOINTS_0', 'WEIGHTS_0', 'POSITION')):
                continue
            J = [list(x) for x in read_acc(gltf, bins, at['JOINTS_0'])]
            W = [list(x) for x in read_acc(gltf, bins, at['WEIGHTS_0'])]
            P = read_acc(gltf, bins, at['POSITION'])
            for vi, (js, ws, p) in enumerate(zip(J, W, P)):
                for s in ('L', 'R'):
                    if not any(w > 0.05 and (j == base[s] or j in toes[s]) for j, w in zip(js, ws)):
                        continue
                    d = [math.dist(p, a) for a in anchors[s]]
                    k = d.index(min(d))
                    d_base = math.dist(p, ibm_world(ibms[base[s]]))
                    w_base = 0.45 * (d_base / (d_base + min(d) + 1e-6))
                    pairs = [(base[s], round(w_base, 4)), (slot[toes[s][k]], round(1 - w_base, 4))]
                    pairs = [x for x in pairs if x[1] > 0.001]
                    tot = sum(w for _, w in pairs) or 1.0
                    for i4 in range(4):
                        js[i4] = pairs[i4][0] if i4 < len(pairs) else 0
                        ws[i4] = round(pairs[i4][1] / tot, 5) if i4 < len(pairs) else 0.0
                    J[vi], W[vi] = js, ws
                    changed += 1
                    break
            write_acc(gltf, bins, at['JOINTS_0'], [tuple(x) for x in J])
            write_acc(gltf, bins, at['WEIGHTS_0'], [tuple(x) for x in W])

    jbytes = json.dumps(gltf, separators=(',', ':')).encode()
    jbytes += b' ' * ((4 - len(jbytes) % 4) % 4)
    bbytes = bytes(bins) + b'\x00' * ((4 - len(bins) % 4) % 4)
    out = bytearray()
    out += b'glTF' + struct.pack('<II', 2, 12 + 8 + len(jbytes) + 8 + len(bbytes))
    out += struct.pack('<I', len(jbytes)) + b'JSON' + jbytes
    out += struct.pack('<I', len(bbytes)) + btype + bbytes
    open(a.dst, 'wb').write(out)
    print(f'вершин перевешено: {changed} → {a.dst}')


if __name__ == '__main__':
    main()
