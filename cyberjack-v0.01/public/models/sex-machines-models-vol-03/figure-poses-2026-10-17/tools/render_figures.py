# Fast software renders of voxel figures with axes, for pose anatomy QC (see figure-poses-2026-10-17).
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import pickle, os, sys, math


def rot_matrix(yaw_deg, pitch_deg):
    y, p = np.radians(yaw_deg), np.radians(pitch_deg)
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    return rx @ ry


def render_voxels(solid, mn, spacing, out_path, yaw=30, pitch=20, px=900, axlen=0.3, title=""):
    # voxel cell corners -> world
    idx = np.stack(np.nonzero(solid), 1).astype(np.float32)
    pts = mn + (idx + 0.5) * spacing
    c = pts.mean(0)
    R = rot_matrix(yaw, pitch)
    rel = (pts - c) @ R.T
    # camera: look from +Z_cam; screen x = rel.x, y = rel.y (up), depth = rel.z
    span = np.linalg.norm(pts.max(0) - pts.min(0)) * 1.15
    sx = rel[:, 0] / span * px * 0.9 + px / 2
    sy = px * 0.92 - (rel[:, 1] / span * px * 0.9 + px / 2)
    depth = rel[:, 2]
    order = np.argsort(depth)
    shade = (0.35 + 0.65 * np.clip((depth.max() - depth) / (depth.max() - depth.min() + 1e-9), 0, 1))
    img = Image.new('RGB', (px, px), 'white')
    dr = ImageDraw.Draw(img)
    step = max(1, len(order) // 48000)
    for i in order[::step]:
        x, yy = sx[i], sy[i]
        s = max(1.0, px * 2.2 / (pts.shape[0] ** (1 / 3)) * (1 + 0.3 * shade[i]))
        g = int(60 + 175 * shade[i])
        dr.rectangle([x - s, yy - s, x + s, yy + s], fill=(g, g, min(255, g + 6)))
    # axis arrows
    for ax, name, col in ((2, 'X', (200, 30, 30)), (0, 'Y', (30, 150, 30)), (1, 'Z', (30, 30, 200))):
        d = np.zeros(3); d[ax] = 1
        e = (c + d * (axlen * 2)) - c
        v = d[ax] * axlen
        arrow = np.zeros((2, 3))
        arrow[1, ax] = axlen
        ar = arrow @ R.T
        x0, y0 = px / 2, px / 2
        x1 = (ar[1, 0] / span) * px * 0.9 + px / 2
        y1 = px * 0.92 - ((ar[1, 1] / span) * px * 0.9 + px / 2)
        dr.line([x0, y0, x1, y1], fill=col, width=3)
        dr.text((x1 + 4, y1 - 6), name, fill=col)
    dr.text((10, 10), title, fill='black')
    img.save(out_path)


def grid_render(solid, mn, spacing, out_path, angles=((30, 20), (210, 15), (90, 65), (-60, -15))):
    px = 480
    W = px * 2
    img = Image.new('RGB', (W, px * 2), 'white')
    for k, (yaw, pit) in enumerate(angles):
        p = f'/tmp/_v{k}.png'
        render_voxels(solid, mn, spacing, p, yaw=yaw, pitch=pit, px=px, axlen=0.15, title=f"yaw{yaw} pitch{pit}")
        tile = Image.open(p)
        img.paste(tile, ((k % 2) * px, (k // 2) * px))
    img.save(out_path)


if __name__ == '__main__':
    base = os.environ.get('FIG_BASE', '/tmp')
    for mid in sys.argv[1:] or ['065']:
        d = np.load(f'{base}/fig{mid}_v.npz')
        meta = pickle.load(open(f'{base}/fig{mid}_m.pkl', 'rb'))
        out = os.environ.get('OUT_DIR', '/tmp')
        grid_render(d['solid'], d['mn'], meta['spacing'], f'{out}/figanim-{mid}.png')
        print('saved', f'{out}/figanim-{mid}.png')