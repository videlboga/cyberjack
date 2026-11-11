# Figure landmark extraction for SKP vol-03 machines: posed static STL mannequin -> body landmarks.
# Input: prepared-2026-10-16/reference-full/*.glb (metres, Y-up).
# Output: figure_landmarks.json + ortho QC previews (reports/).
# Method: voxel shell -> solid fill -> profile-based up axis -> slice blob union -> head/torso/arm/leg groups -> joint chains.
import sys, os, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from skp_glb_figure import parse_glb, extract_figure_triangles, mat_to_pqs

# ---------------------------------------------------------------- voxels
def voxelize(V, F, spacing):
    mn, mx = V.min(0), V.max(0)
    mn, mx = mn - spacing, mx + spacing
    dims = np.ceil((mx - mn) / spacing).astype(int) + 1
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    n = np.cross(b - a, c - a)
    area = np.linalg.norm(n, axis=1) / 2
    per = np.maximum(1, np.ceil(np.sqrt(3 * area) / spacing).astype(int))
    counts = per * per
    tri_idx = np.repeat(np.arange(len(F)), counts)
    starts = np.concatenate([[0], np.cumsum(counts)[:-1]])
    lin = np.arange(counts.sum()) - np.repeat(starts, counts)
    us = (lin // np.repeat(per, counts)).astype(np.int32)
    vs = (lin % np.repeat(per, counts)).astype(np.int32)
    keep = (us + vs) <= np.maximum(np.repeat(per, counts) - 1, 1)
    us, vs = us[keep], vs[keep]
    tri_idx = tri_idx[keep]
    aa, bb, cc = a[tri_idx], b[tri_idx], c[tri_idx]
    pe = np.maximum(per[tri_idx] - 1, 1)
    w1 = (us / pe)[:, None]
    w2 = (vs / pe)[:, None]
    pts = aa + (bb - aa) * w1 + (cc - aa) * w2
    pts = np.vstack([pts, V.astype(np.float64)])
    vox = np.floor((pts - mn) / spacing).astype(int)
    ok = np.all((vox >= 0) & (vox < dims), axis=1)
    vox = vox[ok]
    occ = np.zeros(tuple(dims), dtype=bool)
    occ[vox[:, 0], vox[:, 1], vox[:, 2]] = True
    for ax in range(3):
        for sh in (-1, 1):
            occ |= np.roll(occ, sh, axis=ax)
    return occ, mn, spacing


def solid_fill(occ):
    """Filled solid occupancy: parity scanline fill along each axis, OR-ed."""
    out = np.zeros_like(occ)
    for ax in range(3):
        o1, o2 = [i for i in range(3) if i != ax]
        n1, n2, na = occ.shape[o1], occ.shape[o2], occ.shape[ax]
        src = np.transpose(occ, (ax, o1, o2))  # [na, n1, n2]
        cum = np.cumsum(src, axis=0)
        filled = src & (cum % 2 == 1).astype(bool)
        back = np.transpose(filled, (o1, o2, ax))
        out |= back
    return out


# ---------------------------------------------------------------- 2D labeling
def label2d(grid):
    H, W = grid.shape
    ys, xs = np.nonzero(grid)
    seen = np.zeros_like(grid, dtype=bool)
    blobs = []
    for y, x in zip(ys, xs):
        if seen[y, x]:
            continue
        stack = [(int(y), int(x))]
        seen[y, x] = True
        pts = [stack[0]]
        while stack:
            cy, cx = stack.pop()
            for dy in (-1, 0, 1):
                for dx in (-1, 0, 1):
                    if dy == 0 and dx == 0:
                        continue
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < H and 0 <= nx < W and grid[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        stack.append((ny, nx))
                        pts.append((ny, nx))
        blobs.append(np.array(sorted(set(pts)), dtype=int))
    return blobs


def erode2d(grid, r=1):
    g = grid.copy()
    for _ in range(r):
        g = g & np.roll(g, 1, 0) & np.roll(g, -1, 0) & np.roll(g, 1, 1) & np.roll(g, -1, 1)
    return g


# ---------------------------------------------------------------- slice tree
class Sliced:
    """Per-slice blobs (eroded skeleton cells) + full filled cells, unioned across slices."""

    def __init__(self, solid, up, erode=2):
        self.up = up
        o1, o2 = [i for i in range(3) if i != up]
        self.o1, self.o2 = o1, o2
        ns, n1, n2 = solid.shape[up], solid.shape[o1], solid.shape[o2]
        self.blobs = []   # flat list of dicts: li, pts3d (eroded, (n,3)), full_cells set
        self.per_slice_full = [None] * ns
        for s in range(ns):
            grid = np.transpose(solid, (up, o1, o2))[s] if False else None
        tr = np.transpose(solid, (up, o1, o2))
        for s in range(ns):
            grid = tr[s]
            self.per_slice_full[s] = set(map(tuple, np.argwhere(grid)))
            er = erode2d(grid, erode)
            if not er.any():
                er = erode2d(grid, 1)
            if not er.any():
                er = grid
            for pts in label2d(er):
                cells = np.stack([pts[:, 0], pts[:, 1], np.full(len(pts), s)], axis=1)
                p3 = np.zeros_like(cells)
                p3[:, o1] = cells[:, 0]
                p3[:, o2] = cells[:, 1]
                p3[:, up] = cells[:, 2]
                self.blobs.append({'li': s, 'pts3d': p3, 'span_u': pts[:, 0].min(), 'span_v': pts[:, 0].max()})
        # union-find across slices by cell overlap
        parent = list(range(len(self.blobs)))
        def find(a):
            while parent[a] != a:
                parent[a] = parent[parent[a]]
                a = parent[a]
            return a
        def union(a, b):
            ra, rb = find(a), find(b)
            if ra != rb:
                parent[rb] = ra
        lut = [None] * ns
        by_slice = [[] for _ in range(ns)]
        for i, b in enumerate(self.blobs):
            by_slice[b['li']].append(i)
        for s in range(ns):
            lut[s] = {}
            for i in by_slice[s]:
                sk = set((int(p[0]) if p[0] != s else 0, int(p[1 - (self.o1 * (p[0] == s))])) for p in []) # placeholder
            # build plain cell key: coordinates (u,v) where u along o1, v along o2, plus s
            for i in by_slice[s]:
                p = self.blobs[i]['pts3d']
                for cell in p:
                    lut[s][(int(cell[o1]), int(cell[o2]))] = i
        self.blob_idx = {}
        for s in range(ns):
            for i in by_slice[s]:
                self.blob_idx[(s, i)] = None
        for s in range(1, ns):
            if not by_slice[s - 1]:
                continue
            for i in by_slice[s]:
                p = self.blobs[i]['pts3d']
                for cell in p:
                    j = lut[s - 1].get((int(cell[o1]), int(cell[o2])))
                    if j is not None:
                        union(i, j)
        self.groups = {}
        for i in range(len(self.blobs)):
            self.groups.setdefault(find(i), []).append(i)
        self.groups = [sorted(v) for _, v in sorted(self.groups.items())]

    def group_vox(self, g):
        return np.vstack([self.blobs[i]['pts3d'] for i in g])

    def group_world(self, g, mn, sp):
        return mn + (self.group_vox(g) + 0.5) * sp


# ---------------------------------------------------------------- profiles & pick of body up
def profile_of(solid, axis, flip):
    tr = np.transpose(solid, (axis,) + tuple(i for i in range(3) if i != axis))
    if flip:
        tr = tr[::-1]
    areas = tr.reshape(tr.shape[0], -1).sum(1)
    nz = np.nonzero(areas)[0]
    return areas[nz[0]:nz[-1] + 1]


def score_up(solid, axis, flip):
    prof = profile_of(solid, axis, flip).astype(float)
    if len(prof) < 5:
        return -1.0, None
    total = prof.max()
    span = len(prof)
    # head = the run at the top that ends with a strong pinch
    head_end = 0
    a_max = prof[-1]
    k = len(prof) - 1
    while k >= 0:
        a = prof[k]
        if a <= a_max * 2.2 or a <= a_max + 0.12 * total:
            a_max = max(a_max, a)
            head_end += 1
            k -= 1
        else:
            break
    if head_end < 3 or head_end > 0.34 * span:
        return -1.0, None
    neck_val = prof[-1 - max(head_end, 1)].min() if head_end >= 1 else prof[-1].min()
    # neck should be a clear dip: min area in transition zone < 60% of head max, head not tiny
    head_area = prof[-head_end:].sum()
    body_area = prof.sum()
    ratio_ok = 0.03 < head_area / body_area < 0.35
    # shoulders wide after neck
    sh = prof[-head_end - max(2, span // 12)].max() if span > head_end + 3 else prof.max()
    pinch = (prof[-head_end:].min() if head_end < span - 1 else prof[0]) / sh
    score = 0.0
    score += 2.0 if ratio_ok else -1.0
    score += 1.5 * (1 - np.clip(pinch / 0.7, 0, 1))
    # legs split near bottom half (2 blobs): check on eroded slices
    return score, {'head_end': head_end, 'span': span, 'pinch': float(pinch), 'ratio': float(head_area / body_area)}


def best_up_axis(solid, spacing):
    best = (-2, None)
    for ax in range(3):
        for flip in (False, True):
            sc, info = score_up(solid, ax, flip)
            if sc > best[0]:
                best = (sc, (ax, flip, info))
    ax, flip, info = best[1]
    return ax, flip, info, best[0]


# ---------------------------------------------------------------- limbs
def track_side_layers(sliced, g, start, end, o1, midline_u=None, o2_mid=None):
    """Split group cells located in slice range [start..end) into connected limbs via per-slice 2D adjacency."""
    pass


def analyze(V, F, spacing_target=0.012, debug=False):
    spacing = float(np.clip(V.max(0).min() / 68, 0.008, 0.020))
    occ, mn, sp = voxelize(V, F, spacing)
    solid = solid_fill(occ)
    solid = solid & (solid_fill(solid.astype(bool)))  # close small leaks
    up, flip, info, score = best_up_axis(solid, spacing)
    if up is None:
        return None
    if flip:
        solid = solid[::-1, :, :] if up == 0 else (solid[:, ::-1, :] if up == 1 else solid[:, :, ::-1])
    sl = Sliced(solid, up, erode=2)
    groups = sl.groups
    # head via profile walk on solid
    prof = profile_of(solid, up, False)
    nz0 = int(np.nonzero(prof)[0][0])
    total = len(prof)
    a_max = float(prof[-1]); head_len = 0
    k = len(prof) - 1
    while k >= nz0:
        a = float(prof[k])
        if a <= a_max * 2.2 or a <= a_max + 0.12 * prof.max():
            a_max = max(a_max, a); head_len += 1; k -= 1
        else:
            break
    head_slices = set(range(max(nz0, len(prof) - head_len) + nz0, len(prof) + nz0)) if False else None
    head_slice_range = range(len(prof) - head_len, len(prof))
    # groups of interest
    ginfo = []
    for g in groups:
        vox = sl.group_vox(g)
        upr = vox[:, up]
        ginfo.append({'g': g, 'mass': len(vox), 'top': int(upr.max()), 'bot': int(upr.min())})
    ginfo.sort(key=lambda d: -d['mass'])
    main = ginfo[0]
    # head group = group covering the top slices with small mass (< 25%) - else the topmost cells of main
    head_group = None
    for gi in ginfo:
        if gi['top'] >= len(prof) - max(2, head_len // 2) and gi['mass'] < 0.3 * main['mass'] and gi['bot'] >= main['bot'] + (main['top'] - main['bot']) * 0.3:
            if head_group is None or gi['mass'] > head_group['mass']:
                head_group = gi
    if head_group is None:
        head_group = {'g': [i for i in main['g'] if sl.blobs[i]['li'] in head_slice_range], 'mass': 0}
    head_vox = sl.group_vox(head_group['g'])
    o1, o2 = sl.o1, sl.o2
    def w(vox):
        return mn + (vox + 0.5) * spacing
    head_center = w(head_vox).mean(0)
    neck_bot = head_vox[head_vox[:, up] == head_vox[:, up].min()]
    torso_top_slice = head_vox[:, up].min()
    neck_c = w(neck_bot).mean(0)
    # torso cells: main group minus head slices
    torso = [i for i in main['g'] if sl.blobs[i]['li'] not in set(range(len(prof) - head_len, len(prof)))]
    torso_vox = sl.group_vox(torso) if torso else sl.group_vox(main['g'])
    upr = torso_vox[:, up]
    lo, hi = int(upr.min()), int(upr.max())
    # hips: slice where legs branch = last slice from bottom with >=2 blobs in main
    hip_branch = None
    s = lo
    while s <= hi:
        n_b = sum(1 for i in main['g'] if sl.blobs[i]['li'] == s)
        if n_b >= 2:
            hip_branch = s
        s += 1
    if hip_branch is None or hip_branch >= torso_top_slice:
        hip_branch = lo + (hi - lo) // 2
    hip_vox = np.vstack([sl.blobs[i]['pts3d'] for i in main['g'] if abs(sl.blobs[i]['li'] - hip_branch) <= 1])
    hips_c = w(hip_vox).mean(0)
    neck_of_torso = np.vstack([sl.blobs[i]['pts3d'] for i in torso if sl.blobs[i]['li'] >= torso_top_slice - 1]) if torso else None
    spine_top = w(neck_of_torso).mean(0) if neck_of_torso is not None and len(neck_of_torso) else neck_c
    spine_dir = (spine_top - hips_c)
    sdn = np.linalg.norm(spine_dir)
    spine_dir = spine_dir / sdn if sdn > 1e-6 else np.array([0, 1, 0.0])
    # legs: main-group blobs below hip_branch -> 2 chains by side of midline
    legs = {}
    mid_u = hips_c if False else None
    # decide midline from torso slice at hip_branch
    hb = np.vstack([sl.blobs[i]['pts3d'] for i in main['g'] if abs(sl.blobs[i]['li'] - hip_branch) <= 1])
    mid_u_val = w(hb)[:, o1].mean()
    leg_cells = np.vstack([sl.blobs[i]['pts3d'] for i in main['g'] if sl.blobs[i]['li'] < hip_branch]) if any(sl.blobs[i]['li'] < hip_branch for i in main['g']) else None
    legs_out = {}
    if leg_cells is not None and len(leg_cells):
        # 2D-ish cluster: assign by side of midline then re-track chains by slice adjacency below hip_branch
        for side, val in (('L', lambda cells: w(cells)[:, o1] < mid_u_val), ('R', lambda cells: w(cells)[:, o1] >= mid_u_val)):
            sel = val(leg_cells)
            if sel.sum() == 0:
                continue
            cv = leg_cells[sel]
            # chain: per-slice centroid from bottom (min slice) to hip
            slices = sorted(set(cv[:, up]))
            chain = []
            for ss in slices:
                c = cv[cv[:, up] == ss]
                if len(c) > 0:
                    chain.append(w(c).mean(0))
            chain = np.array(chain)
            # resample by arc length for robust mid joints
            d = np.linalg.norm(np.diff(chain, axis=0), axis=1)
            ssum = np.concatenate([[0], np.cumsum(d)])
            L = ssum[-1]
            def at(t):
                return np.array([np.interp(t * L, ssum, chain[:, i]) for i in range(3)])
            if L < 0.1:
                continue
            toe = chain[-1]
            ankle = at(0.92) if L > 0.25 else (toe + chain[0]) / 2
            knee = at(0.5) if L > 0.3 else None
            hips_leg = at(0.03)
            legs_out[side] = {'hip': hips_leg.tolist(), 'knee': (knee if knee is not None else at(0.5)).tolist(),
                              'ankle': ankle.tolist(), 'toe': toe.tolist()}
    else:
        # legs together or pose with hidden legs: two fake landmarks from silhouette lower part
        pass
    # arms: blobs of main group in slices above hip_branch that are laterally separated from torso core
    arms_out = {}
    # torso core width at hip_branch top area
    torso_core = np.vstack([sl.blobs[i]['pts3d'] for i in torso]) if torso else torso_vox
    # identify arm cells: in each slice above hip_branch, blobs whose u-dist from slice-centroid > torso_width*0.75
    arm_candidates = []
    for i in main['g']:
        li = sl.blobs[i]['li']
        if li <= hip_branch - 2 or li < torso_top_slice:
            continue
        b = sl.blobs[i]
        cellsb = b['pts3d']
        slice_cells = np.vstack([sl.blobs[j]['pts3d'] for j in main['g'] if sl.blobs[j]['li'] == li])
        center_u = w(slice_cells)[:, o1].mean()
        bu = w(cellsb)[:, o1]
        # arm = blob mostly on one side, small mass relative to slice
        if len(cellsb) >= 2 and (abs(bu.min() - center_u) > 0.5 or abs(bu.max() - center_u) > 0.5):
            arm_candidates.append(i)
    # union arms per connected side chains: greedy: seed from slice right below neck: leftmost and rightmost blobs
    # build per-slice blob list above hip_branch
    def blob_side(i):
        p = w(sl.blobs[i]['pts3d'])
        return 'L' if p[:, o1].mean() < mid_u_val else 'R'
    seen = set()
    for side in ('L', 'R'):
        cells_all = []
        for i in main['g']:
            li = sl.blobs[i]['li']
            if li <= hip_branch or li < torso_top_slice - 2:
                continue
            if blob_side(i) != side:
                continue
            cells_all.append(sl.blobs[i]['pts3d'])
        if not cells_all:
            continue
        cells = np.vstack(cells_all)
        wp = w(cells)
        # chain from bottom (shoulder) to top (hand) assuming arms go upward; if arm goes sideways/down,
        # per-slice ordering still forms a monotone path in most poses: order by projection onto arm axis
        pca_c = wp - wp.mean(0)
        u_, s_, vt_ = np.linalg.svd(pca_c, full_matrices=False)
        axis = vt_[0]
        t = pca_c @ axis
        if t.mean() * (1) > 0:
            pass
        order = np.argsort(t)
        chain = []
        step = max(1, len(wp) // 40)
        for x in order[::step]:
            chain.append(wp[x])
        chain = np.array(chain)
        L = np.linalg.norm(np.diff(chain, axis=0), axis=1).sum()
        if L < 0.08:
            continue
        shoulder = chain[0]
        tip = chain[-1]
        d = np.linalg.norm(np.diff(chain, axis=0), axis=1)
        ssum = np.concatenate([[0], np.cumsum(d)])
        def at(t):
            return np.array([np.interp(t * L, ssum, chain[:, i]) for i in range(3)])
        elbow_cand = at(0.5)
        wrist = at(0.88)
        arms_out[side] = {'shoulder': shoulder.tolist(), 'elbow': elbow_cand.tolist(),
                          'wrist': wrist.tolist(), 'tip': tip.tolist()}
    # front direction: knees mean dir (projected perp to spine)
    fronts = []
    for side in legs_out:
        k = np.array(legs_out[side]['knee'])
        h = np.array(legs_out[side]['hip'])
        v = k - h
        v = v - spine_dir * (v @ spine_dir)
        fronts.append(v)
    if fronts:
        front = np.sum(fronts, axis=0)
        fn = np.linalg.norm(front)
        if fn > 1e-6:
            front /= fn
        else:
            front = None
    else:
        front = None
    # contact: lowest point of torso in world up
    tw = w(torso_vox)
    contact = tw[np.argmin(tw[:, up])]
    lm = {'spacing': spacing, 'body_up': spine_dir.tolist(),
          'front': front.tolist() if front is not None else None,
          'hips_center': hips_c.tolist(), 'spine_top': spine_top.tolist(),
          'neck': neck_c.tolist(), 'head_center': head_center.tolist(),
          'head_dir': (head_top_dir(head_vox, w, up) if head_top_dir(head_vox, w, up) is not None
                       else head_dir(head_center, neck_c)).tolist(),
          'legs': legs_out, 'arms': arms_out,
          'qc_contact': contact.tolist(),
          'debug': {'score_up': score, 'up_info': info, 'up_axis': up, 'flip': flip,
                    'span_slices': int(len(prof)), 'hip_branch': int(hip_branch),
                    'head_len': int(head_len), 'main_mass': int(main['mass']), 'n_groups': len(groups)}}
    return lm, (solid, sl, w)


def head_top_dir(head_vox, w, up):
    tops = head_vox[head_vox[:, up] >= head_vox[:, up].max() - 1]
    bottoms = head_vox[head_vox[:, up] <= head_vox[:, up].min() + 1]
    if len(tops) == 0 or len(bottoms) == 0:
        return None
    v = w(tops).mean(0) - w(bottoms).mean(0)
    n = np.linalg.norm(v)
    return v / n if n > 1e-6 else None


def head_dir(head_center, neck_c):
    v = np.array(head_center) - np.array(neck_c)
    n = np.linalg.norm(v)
    return v / n if n > 1e-6 else None


# ---------------------------------------------------------------- QC render
def ortho_png(V, lm, path, axes=(), px=800):
    from PIL import Image, ImageDraw
    if not axes:
        axes = [((1, 2), 'front (XY)'), ((0, 2), 'side (XZ)'), ((0, 1), 'top (XZ)')] if False else [
            ((1, 2), 'view -X'), ((0, 2), 'view -Y'), ((0, 1), 'view -Z')]
    up = lm['debug']['up_axis']
    o = [i for i in range(3) if i != up]
    W = px * len(axes)
    img = Image.new('RGB', (W, px), 'white')
    dr = ImageDraw.Draw(img)
    mn, mx = V.min(0), V.max(0)
    span = (mx - mn).max()
    for k, ((a, b), title) in enumerate(axes):
        # remap to body orientation: draw with up pointing UP in image
        U = o[1] if o[1] != a or True else a
        hidx = a if a != up else o[0]
        vidx = b if b != up else o[1]
        base = k * px
        def to_px(p3):
            x = (p3[hidx] - mn[hidx]) / span * (px * 0.9) + px * 0.05
            y = px * 0.05 + (px * 0.9) * (1 - (p3[vidx] - mn[vidx]) / span)
            return (base + x, y)
        # mesh silhouette: subsample vertices
        step = max(1, len(V) // 4000)
        for p in V[::step]:
            q = to_px(p)
            dr.ellipse([q[0] - 0.7, q[1] - 0.7, q[0] + 0.7, q[1] + 0.7], fill=(190, 190, 200))
        # skeleton links
        chains = []
        if lm.get('legs', {}):
            for side, l in lm['legs'].items():
                chains.append([l['hip'], l.get('knee'), l['ankle'], l['toe']])
        if lm.get('arms', {}):
            for side, a_ in lm['arms'].items():
                chains.append([a_['shoulder'], a_['elbow'], a_['wrist'], a_['tip']])
        for ch in chains:
            pts = [to_px(p) for p in ch if p is not None]
            if len(pts) > 1:
                dr.line(pts, fill=(230, 120, 20), width=2)
        for name, p in (('hips', lm['hips_center']), ('spine_top', lm['spine_top']), ('neck', lm['neck']),
                        ('head', lm['head_center'])):
            q = to_px(np.array(p))
            dr.ellipse([q[0] - 4, q[1] - 4, q[0] + 4, q[1] + 4], outline=(200, 30, 30), width=2)
        dr.text((base + 10, 10), title, fill='black')
    img.save(path)


if __name__ == '__main__':
    base = os.environ.get('SKP_BASE', '.')
    outd = os.path.join(base, 'figure-poses-2026-10-17')
    rep = os.path.join(outd, 'reports')
    os.makedirs(rep, exist_ok=True)
    for mid in ('065', '078'):
        p = f'{base}/prepared-2026-10-16/reference-full/SexMachineModel-{mid}.glb'
        j, b = parse_glb(p)
        V, F = extract_figure_triangles(j, b)
        res = analyze(V, F)
        if res is None:
            print(mid, 'FAILED')
            continue
        lm, _aux = res
        print(mid, json.dumps(lm, ensure_ascii=False, indent=1)[:900])
        ortho_png(V, lm, os.path.join(rep, f'landmarks-{mid}.png'))