"""Dump vertices of one GLB node (glTF space) to understand its shape.

  python3 docs/plans/tools/probe_glb_verts.py <glb> <node> [--x lo hi] [--y lo hi] [--z lo hi] [--limit n]

Read-only, no Blender.
"""
import json
import struct
import sys
from pathlib import Path


def load(path):
    data = Path(path).read_bytes()
    ln = struct.unpack('<I', data[12:16])[0]
    j = json.loads(data[20:20 + ln])
    off = 20 + ln
    blen = struct.unpack('<I', data[off:off + 4])[0]
    buf = data[off + 8:off + 8 + blen]
    return j, buf


def read_acc(j, buf, idx):
    acc = j['accessors'][idx]
    bv = j['bufferViews'][acc['bufferView']]
    start = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    n = acc['count']
    ncomp = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}[acc['type']]
    fmt = {5126: 'f', 5123: 'H', 5125: 'I', 5121: 'B'}[acc['componentType']]
    size = struct.calcsize(fmt)
    stride = bv.get('byteStride') or size * ncomp
    out = []
    for i in range(n):
        o = start + i * stride
        vals = struct.unpack_from('<' + fmt * ncomp, buf, o)
        out.append(vals if ncomp > 1 else vals[0])
    return out


def main():
    path, node = sys.argv[1], sys.argv[2]
    j, buf = load(path)
    rng = {}
    for ax in 'xyz':
        if f'--{ax}' in sys.argv:
            i = sys.argv.index(f'--{ax}')
            rng[ax] = (float(sys.argv[i + 1]), float(sys.argv[i + 2]))
    limit = 40
    if '--limit' in sys.argv:
        limit = int(sys.argv[sys.argv.index('--limit') + 1])
    target = [n for n in j['nodes'] if node in (n.get('name') or '')]
    if not target:
        print('no node matches', node)
        return
    n = target[0]
    t = n.get('translation') or [0, 0, 0]
    print(f"# node {n.get('name')} translation={t}")
    for pr in j['meshes'][n['mesh']]['primitives']:
        pos = read_acc(j, buf, pr['attributes']['POSITION'])
        idx = read_acc(j, buf, pr['indices']) if 'indices' in pr else None
        print(f'# prim verts={len(pos)} tris={(len(idx)//3) if idx else 0}')
        shown = 0
        for p in pos:
            w = [p[k] + t[k] for k in range(3)]
            if all(rng[a][0] <= w['xyz'.index(a)] <= rng[a][1] for a in rng):
                print('  ' + ' '.join(f'{w[k]:+.4f}' for k in range(3)))
                shown += 1
                if shown >= limit:
                    print('  ... (limit)')
                    break


if __name__ == '__main__':
    main()
