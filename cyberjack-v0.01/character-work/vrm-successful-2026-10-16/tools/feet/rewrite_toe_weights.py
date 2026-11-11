#!/usr/bin/env python3
"""Перевес носка VRM на отдельные пальцы (k_f_toe*).

Проблема: в VRM есть 4 кости пальцев на стопу (`k_f_toeL_00..03`), но у них **ноль вершин**
в скине — вес всего носка лежит на одной кости `Left toe`. Поэтому пальцы не могут гнуться.

Что делает: берёт вершины с весом на `Left/Right toe` и распределяет этот вес по 4 костям
пальцев по близости к их rest-позициям (мягкое назначение, top-4 джойнта на вершину).

Оригинал не меняется: результат пишется в новый .vrm.

Запуск:
  python3 rewrite_toe_weights.py --in ../../characters/mira/Mira_outfit_03.vrm \
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
    # второй чанк — BIN
    off = 20 + jlen
    blen = struct.unpack('<I', raw[off:off + 4])[0]
    btype = raw[off + 4:off + 8]
    bin_data = bytearray(raw[off + 8:off + 8 + blen])
    return raw, gltf, bin_data, off, blen, btype


def accessor_info(gltf, i):
    acc = gltf['accessors'][i]
    bv = gltf['bufferViews'][acc['bufferView']]
    return acc, bv, bv.get('byteOffset', 0) + acc.get('byteOffset', 0)


def read_acc(gltf, bins, i):
    acc, bv, off = accessor_info(gltf, i)
    code, size = FMT[acc['componentType']]
    nc = NCOMP[acc['type']]
    stride = bv.get('byteStride') or nc * size
    out = []
    for k in range(acc['count']):
        out.append(struct.unpack_from('<' + code * nc, bins, off + k * stride))
    return out


def write_acc(gltf, bins, i, values):
    acc, bv, off = accessor_info(gltf, i)
    code, size = FMT[acc['componentType']]
    nc = NCOMP[acc['type']]
    stride = bv.get('byteStride') or nc * size
    for k, v in enumerate(values):
        struct.pack_into('<' + code * nc, bins, off + k * stride, *v)


def world_positions(nodes):
    """rest-позиции узлов в мировых координатах (по цепочке родителей)."""
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i
    cache = {}

    def pos(i):
        if i in cache:
            return cache[i]
        n = nodes[i]
        t = n.get('translation', [0, 0, 0])
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
    ap.add_argument('--softness', type=float, default=0.015, help='ширина мягкого назначения, м')
    a = ap.parse_args()

    raw, gltf, bins, off, blen, btype = load(a.src)
    nodes = gltf['nodes']
    skin = gltf['skins'][0]
    joints = skin['joints']
    jname = {j: nodes[j].get('name', '') for j in joints}
    pos_of = world_positions(nodes)
    # JOINTS_0 хранит индексы МАССИВА joints, а не узлов — переводим
    slot_of_node = {node: slot for slot, node in enumerate(joints)}

    # кости пальцев по сторонам
    toes = {'L': [], 'R': []}
    for j in joints:
        n = nodes[j].get('name', '')
        for side in ('L', 'R'):
            if n.startswith(f'k_f_toe{side}_'):
                toes[side].append(j)
    for side in toes:
        toes[side].sort(key=lambda j: nodes[j]['name'])
    toe_pos = {side: [pos_of(j) for j in toes[side]] for side in toes}
    toe_slots = {side: [slot_of_node[j] for j in toes[side]] for side in toes}
    base = {}
    for side in ('L', 'R'):
        cand = [j for j in joints if nodes[j].get('name') == f'{"Left" if side == "L" else "Right"} toe']
        base[side] = slot_of_node[cand[0]] if cand else None
    print('пальцев:', {k: len(v) for k, v in toes.items()}, '· база:', base)

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
                for side in ('L', 'R'):
                    bj = base[side]
                    if bj is None or bj not in js:
                        continue
                    slot = js.index(bj)
                    w_toe = ws[slot]
                    if w_toe < 0.05:
                        continue
                    # мягкое назначение по близости к rest-позиции пальца
                    ds = [math.dist(p, tp) for tp in toe_pos[side]]
                    mn = min(ds)
                    sel = [i for i, d in enumerate(ds) if d <= mn + a.softness]
                    # веса обратно пропорциональны расстоянию
                    inv = [1.0 / (d + 1e-4) for i, d in enumerate(ds) if i in sel]
                    tot = sum(inv) or 1.0
                    # часть веса оставляем на плюсне (ближе к своду), остальное — пальцам
                    d_base = math.dist(p, pos_of(joints[bj]))
                    share_base = d_base / (d_base + mn + 1e-6)
                    share_base = min(0.75, max(0.15, share_base))
                    new = [(bj, w_toe * share_base)]
                    new += [(toe_slots[side][i], w_toe * (1 - share_base) * w / tot)
                            for i, w in zip(sel, inv)]
                    # остальные веса оставляем, слот с базой освобождаем
                    rest = [(j, w) for k, (j, w) in enumerate(zip(js, ws)) if k != slot and w > 1e-4]
                    pairs = sorted(rest + new, key=lambda x: -x[1])[:4]
                    s = sum(w for _, w in pairs) or 1.0
                    for k in range(4):
                        js[k] = pairs[k][0] if k < len(pairs) else 0
                        ws[k] = round(pairs[k][1] / s, 5) if k < len(pairs) else 0.0
                    J[vi], W[vi] = js, ws
                    changed += 1
                    break
            write_acc(gltf, bins, at['JOINTS_0'], [tuple(x) for x in J])
            write_acc(gltf, bins, at['WEIGHTS_0'], [tuple(x) for x in W])

    # собрать GLB обратно
    jbytes = json.dumps(gltf, separators=(',', ':')).encode()
    jbytes += b' ' * ((4 - len(jbytes) % 4) % 4)
    bbytes = bytes(bins)
    bbytes += b'\x00' * ((4 - len(bbytes) % 4) % 4)
    out = bytearray()
    out += b'glTF' + struct.pack('<II', 2, 12 + 8 + len(jbytes) + 8 + len(bbytes))
    out += struct.pack('<I', len(jbytes)) + b'JSON' + jbytes
    out += struct.pack('<I', len(bbytes)) + btype + bbytes
    open(a.dst, 'wb').write(out)
    print(f'вершин перевешено: {changed} → {a.dst}')


if __name__ == '__main__':
    main()
