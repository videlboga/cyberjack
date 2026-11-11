# Build figure voxel volume + landmarks for one SKP vol-03 machine.
# Usage: python3 fig_analyze.py <machineId> [<machineId> ...]
# Outputs: cache/fig<mid>_v.npz (solid,mn,spacing), cache/landmarks-<mid>.json,
#          reports/landmarks-<mid>.png (ortho QC with skeleton), reports/anatomy-<mid>.png (rank sheet)
import sys, os, json
from collections import deque
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skp_glb_figure import parse_glb, extract_figure_triangles
import skp_figure_pose as S


def solid_from_shell(occ):
    """Closed shell -> solid body: flood fill the outside, everything else is body."""
    pad = np.pad(occ, 1, mode='constant', constant_values=False)
    nx, ny, nz = pad.shape
    flat = pad.ravel()
    outside = np.zeros(flat.size, dtype=bool)
    stack = deque()
    for (i, j, k) in [(0, 0, 0), (nx - 1, 0, 0), (0, ny - 1, 0), (0, 0, nz - 1),
                      (nx - 1, ny - 1, nz - 1), (nx - 1, 0, nz - 1), (0, ny - 1, nz - 1)]:
        idx = (i * ny + j) * nz + k
        if not flat[idx] and not outside[idx]:
            outside[idx] = True
            stack.append(idx)
    sy, sz = ny * nz, nz
    while stack:
        cur = stack.pop()
        x, r = divmod(cur, sy)
        y, z = divmod(r, sz)
        for dx, dy, dz in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)):
            a, b, c = x + dx, y + dy, z + dz
            if 0 <= a < nx and 0 <= b < ny and 0 <= c < nz:
                n = (a * sy) + (b * sz) + c
                if not flat[n] and not outside[n]:
                    outside[n] = True
                    stack.append(n)
    solid = pad & ~outside.reshape(pad.shape)
    return solid[1:-1, 1:-1, 1:-1]


S.solid_fill = solid_from_shell

BASE = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CACHE = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cache')
REP = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'reports')


def run(mid):
    p = f'{BASE}/prepared-2026-10-16/reference-full/SexMachineModel-{mid}.glb'
    j, b = parse_glb(p)
    V, F = extract_figure_triangles(j, b)
    print(f'--- {mid}: verts={len(V)} tris={len(F)} bbox min={np.round(V.min(0),3)} max={np.round(V.max(0),3)}')
    res = S.analyze(V, F)
    if res is None:
        print(mid, 'ANALYZE FAILED')
        return None
    lm, (solid, sl, w) = res
    sp = lm['spacing']
    mn = np.array(V.min(0)) - sp
    np.savez_compressed(os.path.join(CACHE, f'fig{mid}_v.npz'), solid=solid, mn=mn, spacing=sp)
    os.makedirs(REP, exist_ok=True)
    json.dump(lm, open(os.path.join(REP, f'landmarks-{mid}.json'), 'w'), indent=1)
    S.ortho_png(V, lm, os.path.join(REP, f'landmarks-{mid}.png'))
    os.environ['SKP_ANATOMY_MID'] = mid
    return lm, V, solid, mn, sp


def slices(V, solid, mn, sp, mid):
    """per-axis slice table: coarse blobs per slice (like anatomy-XXX.txt) for numeric pose reading."""
    lines = []
    dims = solid.shape
    lines.append(f'### FIGURE {mid} dims={tuple(int(x) for x in dims)} spacing={sp:.4f} mn={np.round(mn,3).tolist()}')
    for ax, name in enumerate('XYZ'):
        tr = np.transpose(solid, (ax,) + tuple(i for i in range(3) if i != ax))
        areas = tr.reshape(tr.shape[0], -1).sum(1)
        nz = np.nonzero(areas)[0]
        lines.append(f'axis {name} profile: ' + ''.join(str(min(9, int(a / max(1, areas.max()) * 9))) for a in areas[nz[0]:nz[-1] + 1]))
        lines.append(f'--- axis {name}: slices (coord_cm, n_cells, area_cells, centroid of cells)')
        o1, o2 = [i for i in range(3) if i != ax]
        for s in range(dims[ax]):
            g = tr[s]
            if not g.any():
                continue
            ys, xs = np.nonzero(g)
            coord = (mn[ax] + (s + 0.5) * sp) * 100
            # split into blobs by simple 1D split on the other axis centroid when far apart
            lines.append(f' {name}{s:3d} c={coord:6.1f}cm n={g.sum():5d} span_u={(xs.min(),xs.max())} '
                         f'u_mean={(mn[o1]+(xs.mean()+0.5)*sp)*100:6.1f} v_mean={(mn[o2]+(ys.mean()+0.5)*sp)*100:6.1f}')
    return '\n'.join(lines)


if __name__ == '__main__':
    os.makedirs(CACHE, exist_ok=True)
    for mid in sys.argv[1:]:
        r = run(mid)
        if not r:
            continue
        lm, V, solid, mn, sp = r
        print(json.dumps(lm, indent=1)[:2500])
        open(os.path.join(REP, f'anatomy-{mid}.txt'), 'w').write(slices(V, solid, mn, sp, mid))
        os.system(f'cd {os.path.dirname(os.path.abspath(__file__))} && python3 render_anatomy.py {mid} 2>/dev/null || true')
