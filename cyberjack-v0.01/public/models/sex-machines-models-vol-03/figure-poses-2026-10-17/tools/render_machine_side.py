# Diagnostic side-view render of machine + figure (X-Y plane) with axis labels, for orientation QA.
# Usage: python3 render_machine_side.py <mid>
import sys, os
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skp_glb_figure import parse_glb, read_accessor, node_world_matrices, extract_figure_triangles

TOOLS = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(TOOLS))
REP = os.path.join(os.path.dirname(TOOLS), 'reports')


def tris_of(j, b, want_figure):
    parent, world = node_world_matrices(j)
    out = []
    for i, nd in enumerate(j['nodes']):
        if 'mesh' not in nd:
            continue
        is_fig = 'stl' in (nd.get('name') or '').lower()
        if is_fig != want_figure:
            continue
        w = world[i]
        for pr in j['meshes'][nd['mesh']]['primitives']:
            if pr.get('mode', 4) != 4:
                continue
            pos = read_accessor(j, b, pr['attributes']['POSITION']).astype(np.float64)
            P = (np.c_[pos, np.ones(len(pos))] @ w.T)[:, :3]
            idx = read_accessor(j, b, pr['indices']).astype(np.int64).reshape(-1, 3)
            out.append(P[idx])
    return np.vstack(out) if out else np.zeros((0, 3, 3))


def draw(dr, T, px, box, right_idx, up_idx, color, shade_axis=None):
    mn, mx = box
    span = max(mx[0] - mn[0], mx[1] - mn[1]) * 1.06
    cr = (mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2

    def p2(p):
        x = (p[..., right_idx] - cr[0]) / span * px * 0.9 + px / 2
        y = px * 0.95 - ((p[..., up_idx] - cr[1]) / span * px * 0.9 + px / 2)
        return x, y

    cen = T.mean(1)
    nrm = np.cross(T[:, 1] - T[:, 0], T[:, 2] - T[:, 0])
    ln = np.linalg.norm(nrm, axis=1) + 1e-12
    nrm /= ln[:, None]
    depth_idx = 3 - right_idx - up_idx
    order = np.argsort(cen[:, depth_idx])
    for i in order[::max(1, len(order) // 90000)]:
        sh = 0.55 + 0.45 * abs(nrm[i, depth_idx])
        col = tuple(int(c * sh) for c in color)
        dr.polygon([p2(T[i, k]) for k in range(3)], fill=col)


def run(mid):
    j, b = parse_glb(f'{BASE}/prepared-2026-10-16/reference-full/SexMachineModel-{mid}.glb')
    M = tris_of(j, b, False)
    Fg = tris_of(j, b, True)
    mn = np.array([min(M[:, :, 0].min(), Fg[:, :, 0].min()), 0.99])
    mx = np.array([max(M[:, :, 0].max(), Fg[:, :, 0].max()), 2.45])
    px = 1000
    img = Image.new('RGB', (px, px), 'white')
    dr = ImageDraw.Draw(img)
    box = (mn, mx)
    draw(dr, M, px, box, 0, 1, (200, 205, 212))     # machine: light grey
    draw(dr, Fg, px, box, 0, 1, (230, 120, 30))     # figure: orange
    # axes
    span = max(mx[0] - mn[0], mx[1] - mn[1]) * 1.06
    cr = ((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2)

    def p2(p):
        return ((p[0] - cr[0]) / span * px * 0.9 + px / 2, px * 0.95 - ((p[1] - cr[1]) / span * px * 0.9 + px / 2))

    for v, nm, col in (((0.55, 0), '+X', (200, 30, 30)), ((-0.55, 0), '-X', (120, 30, 120)),
                       ((0, 0.55), '+Y', (20, 140, 20))):
        x0, y0 = p2(cr)
        x1, y1 = p2((cr[0] + v[0], cr[1] + v[1]))
        dr.line([x0, y0, x1, y1], fill=col, width=3)
        dr.text((x1 + 4, y1 - 12), nm, fill=col)
    dr.text((12, 12), f'machine {mid}  SIDE VIEW: right = +X, up = +Y (camera looks along -Z)', fill='black')
    dr.text((12, 30), 'grey = machine, orange = static mannequin figure', fill=(80, 80, 80))
    out = os.path.join(REP, f'side-mach-{mid}.png')
    img.save(out)
    print('saved', out)


if __name__ == '__main__':
    run(sys.argv[1])
