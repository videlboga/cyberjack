#!/usr/bin/env python3
"""Жёсткая сегментация носка по 4 пальцам.

Мягкое назначение (v1) размазывало разведение пальцев: соседние пальцы тянули одну и ту же кожу.
Здесь каждая вершина носка получает вес 1.0 на **одну** кость пальца (по квантилям поперечной оси),
а у самой плюсны остаётся доля веса на `Left/Right toe`, чтобы свод не рвался.

Запуск:
  python3 rewrite_toe_weights_v2.py --in ../../characters/mira/Mira_outfit_03.vrm \
      --out ../../characters/mira/Mira_outfit_03_toes.vrm
"""
import argparse
import json
import math
import struct

FMT = {5121: ('B', 1), 5123: ('H', 2), 5125: ('I', 4), 5126: ('f', 4)}
NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}


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


def world_positions(nodes):
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    cache = {}

    def pos(i):
        if i in cache:
            return cache[i]
        t = list(nodes[i].get('translation', [0, 0, 0]))
        if i in parent:
            p = pos(parent[i])
            t = [t[0] + p[0], t[1] + p[1], t[2] + p[2]]
        cache[i] = t
        return t

    return pos


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--out', dest='dst', required=True)
    a = ap.parse_args()

    gltf, bins, btype = load(a.src)
    nodes = gltf['nodes']
    joints = gltf['skins'][0]['joints']
    slot = {n: i for i, n in enumerate(joints)}
    pos_of = world_positions(nodes)
    name_of = {j: nodes[j].get('name', '') for j in joints}

    sides, base = {'L': [], 'R': []}, {}
    for j in joints:
        nm = nodes[j].get('name', '')
        for s in ('L', 'R'):
            if nm.startswith(f'k_f_toe{s}_'):
                sides[s].append(j)
        if nm in ('Left toe', 'Right toe'):
            base['L' if nm.startswith('Left') else 'R'] = slot[j]
    for s in sides:
        sides[s].sort(key=lambda j: name_of[j])
    toe_slots = {s: [slot[j] for j in sides[s]] for s in sides}
    print('пальцев:', {s: len(v) for s, v in toe_slots.items()}, '· плюсна:', base)

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
                done = False
                for s in ('L', 'R'):
                    bj = base.get(s)
                    if bj is None:
                        continue
                    in_toe = any(w > 0.02 and (j == bj or j in toe_slots[s]) for j, w in zip(js, ws))
                    if not in_toe:
                        continue
                    xs = [pos_of(j)[0] for j in sides[s]]
                    x_min, x_max = min(xs), max(xs)
                    span = (x_max - x_min) or 1.0
                    t = max(0.0, min(0.999, (p[0] - x_min) / span))
                    d_toe = min(math.dist(p, pos_of(j)) for j in sides[s])
                    d_base = math.dist(p, pos_of(joints[bj]))
                    w_base = 0.45 * (d_base / (d_base + d_toe + 1e-6))   # у свода больше плюсны
                    k = min(len(toe_slots[s]) - 1, int(t * len(toe_slots[s])))
                    pairs = [(bj, round(w_base, 4)), (toe_slots[s][k], round(1 - w_base, 4))]
                    pairs = [x for x in pairs if x[1] > 0.001]
                    ssum = sum(w for _, w in pairs) or 1.0
                    for i4 in range(4):
                        if i4 < len(pairs):
                            js[i4], ws[i4] = pairs[i4][0], round(pairs[i4][1] / ssum, 5)
                        else:
                            js[i4], ws[i4] = 0, 0.0
                    J[vi], W[vi] = js, ws
                    changed += 1
                    done = True
                    break
                if done:
                    continue
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
    print(f'вершин переназначено: {changed} → {a.dst}')


if __name__ == '__main__':
    main()
