# Renders machine GLB (point-sampled) + figure voxels together in machine frame, with axes and annotations.
import sys, os, math, json
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skp_glb_figure import parse_glb, extract_figure_triangles


def rot(yaw, pitch):
    y, p = math.radians(yaw), math.radians(pitch)
    ry = np.array([[math.cos(y), 0, math.sin(y)], [0, 1, 0], [-math.sin(y), 0, math.cos(y)]])
    rx = np.array([[1, 0, 0], [0, math.cos(p), -math.sin(p)], [0, math.sin(p), math.cos(p)]])
    return rx @ ry


def project(pts, c, R, span, px, py0=0, py1=None):
    rel = (pts - c) @ R.T
    x = rel[:, 0] / span * px * 0.9
    y = rel[:, 1] / span * px * 0.9
    z = rel[:, 2]
    return x, y, z


def render_points(dr, pts, c, R, span, px, color, base_x, base_y, size=2.2, shade=True):
    x, y, z = project(pts, c, R, span, px)
    sx = base_x + px / 2 + x
    sy = base_y + px * 0.92 / 2 - y
    order = np.argsort(z)
    zn = (z.max() - z) / (z.max() - z.min() + 1e-9)
    col = np.array(color)
    for i in order[::max(1, len(order) // 45000)]:
        s = size
        g = np.clip(col * (0.45 + 0.55 * zn[i]), 0, 255).astype(int)
        sx_, sy_ = sx[i], sy[i]
        dr.rectangle([sx_ - s, sy_ - s, sx_ + s, sy_ + s], fill=tuple(g))


def render_axis(dr, c, R, span, px, base_x, base_y, axlen=0.15):
    cols = ((2, (200, 40, 40), 'X'), (0, (40, 160, 40), 'Y'), (1, (40, 40, 200), 'Z'))
    for ax, col, name in cols:
        d = np.zeros(3); d[ax] = 1
        arrow = np.stack([np.zeros(3), d * axlen * 2])
        ar = (arrow) @ R.T
        x1 = base_x + px / 2 + (ar[1, 0]) / span * px * 0.9
        y1 = base_y + px * 0.92 / 2 - (ar[1, 1]) / span * px * 0.9
        x0 = base_x + px / 2
        y0 = base_y + px * 0.92 / 2
        dr.line([x0, y0, x1, y1], fill=col, width=4)
        dr.text((x1 + 4, y1 - 6), name, fill=col)


def scene_render(png_path, machine_pts, fig_pts, angles, px=640, marks=None, title=""):
    # grid 2x2
    W = px * 2
    img = Image.new('RGB', (W, px * 2), 'white')
    dr = ImageDraw.Draw(img)
    allpts = np.vstack([p for p in (machine_pts, fig_pts) if p is not None and len(p)])
    c = allpts.mean(0)
    span = np.linalg.norm(allpts.max(0) - allpts.min(0)) * 1.12
    for k, (yaw, pit) in enumerate(angles):
        base_x, base_y = (k % 2) * px, (k // 2) * px
        R = rot(yaw, pit)
        if machine_pts is not None:
            render_points(dr, machine_pts, c, R, span, px, (225, 150, 170), base_x, base_y, size=2.0)
        if fig_pts is not None:
            render_points(dr, fig_pts, c, R, span, px, (70, 70, 80), base_x, base_y, size=2.4)
        render_axis(dr, c, R, span, px, base_x, base_y)
        if marks:
            for name, p3, col in marks:
                x, y, _ = project(np.array([p3]), c, R, span, px)
                sx, sy = base_x + px / 2 + x[0], base_y + px * 0.92 / 2 - y[0]
                dr.ellipse([sx - 6, sy - 6, sx + 6, sy + 6], outline=col, width=3)
                dr.text((sx + 8, sy - 10), name, fill=col)
        dr.text((base_x + 10, base_y + 8), f"yaw{yaw} pitch{pit}", fill='black')
    if title:
        dr.text((10, 4), title, fill='black')
    img.save(png_path)
    print('saved', png_path)


def load_machine_points(mid, spacing=0.03):
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    p = f"{base}/prepared-2026-10-16/models/SexMachineModel-{mid}.glb"
    j, b = parse_glb(p)
    verts, faces = [], []
    off = 0
    parent, world = None, None
    import numpy as _np
    # collect ALL mesh node positions (world) via node tree — reuse extractor but for all nodes
    from skp_glb_figure import node_world_matrices
    parent, world = node_world_matrices(j)
    pts_all = []
    for i, nd in enumerate(j['nodes']):
        if 'mesh' not in nd:
            continue
        w = world[i] if world is not None else np.eye(4)
        mesh = j['meshes'][nd['mesh']]
        for prim in mesh['primitives']:
            if prim.get('mode', 4) != 4:
                continue
            pos = _np.asarray(prim.get('_pos') or 0)
            from skp_glb_figure import read_accessor
            pos = read_accessor(j, b, prim['attributes']['POSITION']).astype(np.float64)
            posw = (np.c_[pos, np.ones(len(pos))] @ w.T)[:, :3]
            pts_all.append(posw)
    V = np.vstack(pts_all)
    # random uniform subsample of SURFACE points ~ every N
    step = max(1, len(V) // 30000)
    return V[::step]


def figure_points(mid):
    base = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    p = f"{base}/prepared-2026-10-16/reference-full/SexMachineModel-{mid}.glb"
    j, b = parse_glb(p)
    V, F = extract_figure_triangles(j, b)
    step = max(1, len(V) // 25000)
    return V[::step]


if __name__ == '__main__':
    rep = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), 'reports')
    os.makedirs(rep, exist_ok=True)
    for mid in sys.argv[1:]:
        mp = load_machine_points(mid)
        fp = figure_points(mid)
        scene_render(f"{rep}/scene-{mid}.png", mp, fp,
                     angles=((30, 18), (210, 12), (90, 55), (150, -10)),
                     title=f"model {mid}: machine (pink) + figure (dark)")