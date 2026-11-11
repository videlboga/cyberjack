"""Dump node names + per-node bbox (glTF space, world) from a GLB.

  python3 docs/plans/tools/probe_glb_nodes.py <glb> [--filter substr]

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
    return j


def main():
    path = sys.argv[1]
    flt = None
    if '--filter' in sys.argv:
        flt = sys.argv[sys.argv.index('--filter') + 1]
    j = load(path)
    nodes = j['nodes']
    print(f'# {path}  nodes={len(nodes)}')
    rows = []
    total_mn = [1e9] * 3
    total_mx = [-1e9] * 3
    for n in nodes:
        name = n.get('name', '?')
        t = n.get('translation') or [0.0, 0.0, 0.0]
        if 'mesh' in n:
            mn = [1e9] * 3
            mx = [-1e9] * 3
            for pr in j['meshes'][n['mesh']]['primitives']:
                acc = j['accessors'][pr['attributes']['POSITION']]
                for i in range(3):
                    mn[i] = min(mn[i], acc['min'][i] + t[i])
                    mx[i] = max(mx[i], acc['max'][i] + t[i])
            for i in range(3):
                total_mn[i] = min(total_mn[i], mn[i])
                total_mx[i] = max(total_mx[i], mx[i])
            rows.append((name, mn, mx, 'mesh'))
            if flt is None or flt in name:
                print(f'{name:44s} x {mn[0]:+.4f}..{mx[0]:+.4f} '
                      f'y {mn[1]:+.4f}..{mx[1]:+.4f} '
                      f'z {mn[2]:+.4f}..{mx[2]:+.4f}')
        else:
            rows.append((name, None, None, 'empty'))
            if flt is None or flt in name:
                print(f'{name:44s} (empty node) t={t}')
    print(f'# TOTAL x {total_mn[0]:+.4f}..{total_mx[0]:+.4f} '
          f'y {total_mn[1]:+.4f}..{total_mx[1]:+.4f} '
          f'z {total_mn[2]:+.4f}..{total_mx[2]:+.4f}')
    print(f'# SIZE  {total_mx[0]-total_mn[0]:.4f} x {total_mx[1]-total_mn[1]:.4f} '
          f'x {total_mx[2]-total_mn[2]:.4f}')


if __name__ == '__main__':
    main()
