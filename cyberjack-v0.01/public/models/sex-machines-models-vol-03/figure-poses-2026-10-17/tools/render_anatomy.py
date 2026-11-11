# Figure anatomy QA: figure voxels rendered 4x, colored by rank along X / Y / Z (+ shaded view).
# Lets vision (and the operator) localize head/hips/limbs precisely per axis ramp.
import sys, os, math, pickle
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))


def rank_color(t, lo, hi):
    u = (t - lo) / (hi - lo + 1e-9)
    r = int(40 + 215 * min(1, max(0, u)))
    b = int(240 - 220 * min(1, max(0, u)))
    return (r, 60, b)


def rot(yaw, pitch):
    y, p = math.radians(yaw), math.radians(pitch)
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    return rx @ ry


def render_rank(solid, mn, spacing, axis, yaw, pitch, px=460, label=""):
    idx = np.stack(np.nonzero(solid), 1)
    pts = mn + (idx + 0.5) * spacing
    t = pts[:, axis]
    c = pts.mean(0)
    R = rot(yaw, pitch)
    span = np.linalg.norm(pts.max(0) - pts.min(0)) * 1.15
    rel = (pts - c) @ R.T
    sx = px / 2 + rel[:, 0] / span * px * 0.9
    sy = px * 0.92 / 2 - rel[:, 1] / span * px * 0.9
    z = rel[:, 2]
    order = np.argsort(z)
    img = Image.new('RGB', (px, px), 'white')
    dr = ImageDraw.Draw(img)
    step = max(1, len(order) // 40000)
    for i in order[::step]:
        col = rank_color(t[i], t.min(), t.max())
        s = 2.0
        dr.rectangle([sx[i] - s, sy[i] - s, sx[i] + s, sy[i] + s], fill=col)
    dr.text((8, 8), label, fill='black')
    return img


def anatomy_sheet(mid, out_png):
    d = np.load(f"/tmp/fig{mid}_v.npz")
    solid, mn = d["solid"], d["mn"]
    meta = pickle.load(open(f"/tmp/fig{mid}_m.pkl", "rb"))
    sp = meta["spacing"]
    px = 460
    img = Image.new('RGB', (px * 3, px * 2), 'white')
    dr = ImageDraw.Draw(img)
    tiles = [
        render_rank(solid, mn, sp, 0, -80, 10, px, "X ramp: red=Xmin . bLUE=Xmax (yaw -80)"),
        render_rank(solid, mn, sp, 1, -80, 10, px, "Y ramp: red=Ymin . BLUE=Ymax"),
        render_rank(solid, mn, sp, 2, -80, 10, px, "Z ramp: red=Zmin . BLUE=Zmax"),
        render_rank(solid, mn, sp, 0, 100, -18, px, "X ramp (view 2)"),
        render_rank(solid, mn, sp, 1, 100, -18, px, "Y ramp (view 2)"),
        render_rank(solid, mn, sp, 2, 100, -18, px, "Z ramp (view 2)"),
    ]
    for k, t in enumerate(tiles):
        img.paste(t, ((k % 3) * px, (k // 3) * px))
    img.save(out_png)
    print('saved', out_png)


if __name__ == '__main__':
    rep = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'reports')
    os.makedirs(rep, exist_ok=True)
    for mid in sys.argv[1:]:
        anatomy_sheet(mid, os.path.join(rep, f'anatomy-{mid}.png'))