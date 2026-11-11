# High-quality painter's-algorithm render of the figure mesh (GLB triangles) from given views.
# Usage: python3 render_mesh.py <mid> [<mid>...]
# Writes reports/mesh-<mid>.png with two panels: side (right=+X, up=+Y) and front (right=+Z, up=+Y).
import sys, os
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skp_glb_figure import parse_glb, extract_figure_triangles

TOOLS = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.dirname(os.path.dirname(TOOLS))
REP = os.path.join(os.path.dirname(TOOLS), 'reports')


def panel(V, F, axes, px, title, flip_h=False):
    """axes = (right_idx, up_idx, depth_idx); camera looks along -depth."""
    r, u, d = axes
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    nrm = np.cross(b - a, c - a)
    ln = np.linalg.norm(nrm, axis=1) + 1e-12
    nrm /= ln[:, None]
    centroid = (a + b + c) / 3
    mn = V.min(0)
    mx = V.max(0)
    span = (mx - mn).max() * 1.08
    ctr = (mn + mx) / 2

    def p2(p, k=0, base=0):
        x = (p[..., r] - ctr[r]) / span * px * 0.9
        y = (p[..., u] - ctr[u]) / span * px * 0.9
        return (base + px / 2 + (-x if flip_h else x), px * 0.96 - (px / 2 + y))

    light = np.array([0.4, 0.75, 0.5])
    light /= np.linalg.norm(light)
    shade = np.clip(nrm @ light, 0, 1) * 0.75 + 0.25
    order = np.argsort(centroid[:, d])
    img = Image.new('RGB', (px, px), 'white')
    dr = ImageDraw.Draw(img)
    for i in order:
        tri = [p2(V[F[i, k]]) for k in range(3)]
        g = int(60 + 180 * shade[i])
        dr.polygon(tri, fill=(g, g, min(255, g + 10)))
    dr.text((10, 10), title, fill=(0, 0, 0))
    # +X / +Y / +Z hints
    for idx, nm, col in ((r, 'xyz'[r], (200, 30, 30)), (u, 'xyz'[u], (20, 140, 20)), (d, 'xyz'[d], (30, 30, 200))):
        v = np.zeros(3)
        v[idx] = 1
        x0, y0 = p2(ctr)
        x1, y1 = p2(ctr + v * span * 0.3)
        if abs(x1 - x0) < 1 and abs(y1 - y0) < 1:  # depth axis: draw a dot at the corner instead
            dr.ellipse([12, 26, 22, 36], outline=col, width=2)
            dr.text((26, 24), '+' + nm + ' (out of screen)', fill=col)
        else:
            dr.line([x0, y0, x1, y1], fill=col, width=2)
            dr.text((x1 + 3, y1 - 12), '+' + nm, fill=col)
    return img


def run(mid):
    j, b = parse_glb(f'{BASE}/prepared-2026-10-16/reference-full/SexMachineModel-{mid}.glb')
    V, F = extract_figure_triangles(j, b)
    V = V.astype(np.float64)
    px = 760
    p1 = panel(V, F, (0, 1, 2), px, 'SIDE: right=+X, up=+Y, camera looks along -Z')
    p2 = panel(V, F, (2, 1, 0), px, 'FRONT/BACK: right=+Z, up=+Y, camera looks along -X')
    p3 = panel(V, F, (2, 0, 1), px, 'TOP: right=+Z, up=+X, camera looks along -Y')
    img = Image.new('RGB', (px * 3, px), 'white')
    for k, t in enumerate((p1, p2, p3)):
        img.paste(t, (k * px, 0))
    out = os.path.join(REP, f'mesh-{mid}.png')
    img.save(out)
    print('saved', out)


if __name__ == '__main__':
    for mid in sys.argv[1:]:
        run(mid)
