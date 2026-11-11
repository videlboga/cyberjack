# Orthographic voxel views of one figure from cache/fig<mid>_v.npz (4 yaw/pitch tiles + 3 axis views).
# Usage: python3 render_views.py <mid> [more mids]
import sys, os
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_figures as R

TOOLS = os.path.dirname(os.path.abspath(__file__))
REP = os.path.join(os.path.dirname(TOOLS), 'reports')


def views(mid):
    d = np.load(os.path.join(TOOLS, 'cache', f'fig{mid}_v.npz'))
    solid, mn, sp = d['solid'], d['mn'], float(d['spacing'])
    # 3 face-on views: looking down -X, -Y, -Z  (screen = the other two axes)
    tiles = []
    combos = [(('Y', 'Z'), 'view along +X  (screen Y right / Z up)'),
              (('X', 'Z'), 'view along +Y  (screen X right / Z up)'),
              (('X', 'Y'), 'view along -Z  (screen X right / Y up)')]
    px = 620
    from PIL import Image, ImageDraw
    img = Image.new('RGB', (px * 3, px * 2), 'white')
    dr = ImageDraw.Draw(img)
    for k, (yaw, pit) in enumerate([(0, 0), (90, 0), (0, 90)]):
        pass
    # simple hand-rolled orthogonal projections
    idx = np.stack(np.nonzero(solid), 1)
    pts = mn + (idx + 0.5) * sp
    c = (pts.min(0) + pts.max(0)) / 2
    span = (pts.max(0) - pts.min(0)).max() * 1.1
    axis_idx = {'X': 0, 'Y': 1, 'Z': 2}
    order = [((0, 1, 2), 'a) look along +X: right=+Y, up=+Z'),
             ((1, 0, 2), 'b) look along +Y: right=+X, up=+Z'),
             ((2, 0, 1), 'c) look along +Z: right=+X, up=+Y')]
    for k, (perm, title) in enumerate(order):
        a, b, cc = perm
        rel = pts - c
        u = k * px + rel[:, b] / span * px * 0.88 + px / 2
        v = px * 0.94 - (rel[:, cc] / span * px * 0.88 + px / 2)
        depth = rel[:, a]
        so = np.argsort(depth)
        step = max(1, len(so) // 60000)
        for i in so[::step]:
            sh = 0.35 + 0.65 * (depth[i] - depth.min()) / (depth.max() - depth.min() + 1e-9)
            g = int(50 + 185 * sh)
            s = 1.6
            dr.rectangle([u[i] - s, v[i] - s, u[i] + s, v[i] + s], fill=(g, g, min(255, g + 8)))
        dr.text((k * px + 8, 8), title, fill='black')
        # axis arrows from center
        for ai, nm, col in ((b, 'xyz'[b], (200, 30, 30)), (cc, 'xyz'[cc], (20, 140, 20))):
            ex = px / 2 + 0.22 * px * 0.88
            dr.line([px / 2 + k * px, px * 0.94 / 2 + px / 2, ex + k * px, px * 0.94 / 2 + px / 2], fill=col, width=2)
            dr.text((ex + 2 - 14 + k * px, px * 0.94 / 2 + px / 2 - 14), '+' + nm, fill=col)
    img.save(os.path.join(REP, f'figviews-{mid}.png'))
    print('saved', os.path.join(REP, f'figviews-{mid}.png'))


if __name__ == '__main__':
    for mid in sys.argv[1:]:
        views(mid)
