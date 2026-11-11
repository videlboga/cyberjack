# Numeric anatomy dump: per-slice connected blobs along one axis (world coords in cm).
# Usage: python3 inspect_solid.py <mid> [axis X|Y|Z] [stride]
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skp_figure_pose import label2d

TOOLS = os.path.dirname(os.path.abspath(__file__))


def load(mid):
    d = np.load(os.path.join(TOOLS, 'cache', f'fig{mid}_v.npz'))
    return d['solid'], d['mn'], float(d['spacing'])


def dump(mid, axis='Y', stride=2):
    solid, mn, sp = load(mid)
    ax = 'XYZ'.index(axis)
    tr = np.transpose(solid, (ax,) + tuple(i for i in range(3) if i != ax))
    o1, o2 = [i for i in range(3) if i != ax]
    print(f'# fig {mid} axis {axis}  dims={solid.shape} spacing={sp:.4f}')
    print(f'# world bbox: ' + ' '.join(f'{c}:{mn[i]:.3f}..{mn[i]+solid.shape[i]*sp:.3f}' for i, c in enumerate('XYZ')))
    for s in range(0, solid.shape[ax], stride):
        g = tr[s]
        if not g.any():
            continue
        blobs = label2d(g)
        coord = (mn[ax] + (s + 0.5) * sp) * 100
        parts = []
        for pts in blobs:
            if len(pts) < 4:
                continue
            ys, xs = pts[:, 0], pts[:, 1]          # ys along o1, xs along o2
            u = (mn[o1] + (ys.mean() + 0.5) * sp) * 100
            v = (mn[o2] + (xs.mean() + 0.5) * sp) * 100
            su = (ys.max() - ys.min() + 1) * sp * 100
            sv = (xs.max() - xs.min() + 1) * sp * 100
            parts.append(f'[{len(pts):4d} u{u:6.1f} v{v:6.1f} su{su:5.1f} sv{sv:5.1f}]')
        parts.sort(key=lambda t: -int(t[1:5]))
        print(f' {"XYZ"[ax]}{coord:7.1f}cm cells={int(g.sum()):5d} blobs={len(parts)}: ' + ' '.join(parts[:6]))


if __name__ == '__main__':
    mid = sys.argv[1]
    axis = sys.argv[2] if len(sys.argv) > 2 else 'Y'
    stride = int(sys.argv[3]) if len(sys.argv) > 3 else 2
    dump(mid, axis, stride)
