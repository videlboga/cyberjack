# GLB parse (stdlib) + figure triangle extraction from reference-full GLBs.
# Part of figure-poses-2026-10-17 pipeline. Unit: metres, Y-up (prepared-2026-10-16 frame).
import struct, json, os
import numpy as np

_COMP = {(5120, 1): ('b', np.int8), (5121, 1): ('B', np.uint8), (5122, 1): ('h', np.int16),
         (5123, 1): ('H', np.uint16), (5125, 1): ('I', np.uint32), (5126, 1): ('f', np.float32)}
_NCOMP = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4, 'MAT4': 16}


def parse_glb(path):
    with open(path, 'rb') as f:
        data = f.read()
    magic, ver, length = struct.unpack('<3I', data[:12])
    assert magic == 0x46546C67, f"not glb: {path}"
    off = 12
    jlen, _ = struct.unpack('<2I', data[off:off + 8]); off += 8
    j = json.loads(data[off:off + jlen]); off += jlen
    blen, _ = struct.unpack('<2I', data[off:off + 8]); off += 8
    bin_data = data[off:off + blen]
    return j, bin_data


def read_accessor(j, bin_data, idx):
    acc = j['accessors'][idx]
    n = acc['count']
    ncomp = _NCOMP[acc['type']]
    fmt, dt = _COMP[(acc['componentType'], 1)]
    bv = j['bufferViews'][acc['bufferView']]
    start = bv.get('byteOffset', 0) + acc.get('byteOffset', 0)
    stride = bv.get('byteStride') or (np.dtype(dt).itemsize * ncomp)
    if stride == np.dtype(dt).itemsize * ncomp:
        arr = np.frombuffer(bin_data, dtype=dt, count=n * ncomp, offset=start).reshape(n, ncomp)
    else:
        arr = np.zeros((n, ncomp), dtype=dt)
        for i in range(n):
            arr[i] = np.frombuffer(bin_data, dtype=dt, count=ncomp, offset=start + i * stride)
    return arr.astype(np.float32 if dt == np.float32 else dt)


def node_world_matrices(j):
    """Walk node forest -> world matrix (4x4 numpy, glTF column-major convention kept intact)."""
    nodes = j['nodes']
    n = len(nodes)
    parent = [-1] * n
    for i, nd in enumerate(nodes):
        for c in nd.get('children', []):
            parent[c] = i
    locals = []
    for nd in nodes:
        if 'matrix' in nd:
            m = np.array(nd['matrix'], dtype=np.float64).reshape(4, 4).T  # stored col-major -> to row-major
        else:
            m = np.eye(4)
            if 'translation' in nd:
                m[:3, 3] = nd['translation']
            if 'rotation' in nd:  # xyzw
                x, y, z, w = nd['rotation']
                m[:3, :3] = np.array([
                    [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                    [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                    [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]], dtype=np.float64)
            if 'scale' in nd:
                s = np.diag(nd['scale'])
                m = m @ s
        locals.append(m)
    world = [None] * n
    order = sorted(range(n), key=lambda i: (parent[i]))
    for _ in range(64):  # forest, parents first
        changed = False
        for i in range(n):
            if world[i] is not None:
                continue
            if parent[i] == -1:
                world[i] = locals[i]; changed = True
            elif world[parent[i]] is not None:
                world[i] = world[parent[i]] @ locals[i]; changed = True
        if not changed:
            break
    return parent, world


def extract_figure_triangles(j, bin_data, fig_names=('stl',)):
    """Return (verts Nx3 float64, faces Mx3 int) for all figure-named nodes, in GLB local scene coordinates (column world)."""
    verts_all, faces_all = [], []
    off = 0
    parent, world = node_world_matrices(j)
    for i, nd in enumerate(j['nodes']):
        name = (nd.get('name') or '')
        if not any(f in name.lower() for f in fig_names):
            continue
        if 'mesh' not in nd:
            continue
        w = world[i]
        if w is None:  # unreached in forest walk: compute ancestors lazily
            chain = []
            cur = i
            while cur != -1:
                chain.append(cur); cur = parent[cur]
            m = np.eye(4)
            for idx in reversed(chain):
                m = m @ locals[idx]
            w = m
        mesh = j['meshes'][nd['mesh']]
        for prim in mesh['primitives']:
            if prim.get('mode', 4) != 4:
                continue
            pos = read_accessor(j, bin_data, prim['attributes']['POSITION']).astype(np.float64)
            posw = (np.c_[pos, np.ones(len(pos))] @ w.T)[:, :3]
            voff = off
            verts_all.append(posw)
            faces_all.append(read_accessor(j, bin_data, prim['indices']).astype(np.int32).reshape(-1) + voff)
            off += len(pos)
    if not verts_all:
        return np.zeros((0, 3)), np.zeros((0, 3), dtype=np.int32)
    return np.vstack(verts_all), np.concatenate(faces_all).reshape(-1, 3)


def mat_to_pqs(m):
    """4x4 -> (pos, quat xyzw, scale per axis) using column norms for scale."""
    pos = m[:3, 3].copy()
    cols = m[:3, :3].T
    scale = np.linalg.norm(cols, axis=1)
    rot = cols / scale
    # rotation matrix (rows = axes) -> quat xyzw
    tr = np.trace(rot)
    if tr > 0:
        s = np.sqrt(tr + 1.0) * 2
        w = s / 4; x = (rot[2, 1] - rot[1, 2]) / s; y = (rot[0, 2] - rot[2, 0]) / s; z = (rot[1, 0] - rot[0, 1]) / s
    elif rot[0, 0] > rot[1, 1] and rot[0, 0] > rot[2, 2]:
        s = np.sqrt(1.0 + rot[0, 0] - rot[1, 1] - rot[2, 2]) * 2
        x = s / 4; y = (rot[0, 1] + rot[1, 0]) / s; z = (rot[0, 2] + rot[2, 0]) / s; w = (rot[2, 1] - rot[1, 2]) / s
    elif rot[1, 1] > rot[2, 2]:
        s = np.sqrt(1.0 + rot[1, 1] - rot[0, 0] - rot[2, 2]) * 2
        y = s / 4; x = (rot[0, 1] + rot[1, 0]) / s; z = (rot[1, 2] + rot[2, 1]) / s; w = (rot[0, 2] - rot[2, 0]) / s
    else:
        s = np.sqrt(1.0 + rot[2, 2] - rot[0, 0] - rot[1, 1]) * 2
        z = s / 4; x = (rot[0, 2] + rot[2, 0]) / s; y = (rot[1, 2] + rot[2, 1]) / s; w = (rot[1, 0] - rot[0, 1]) / s
    q = np.array([x, y, z, w])
    q /= np.linalg.norm(q)
    return pos, q, scale


if __name__ == '__main__':
    base = os.environ.get('SKP_BASE', '.')
    for mid in ('065', '078'):
        p = f'{base}/prepared-2026-10-16/reference-full/SexMachineModel-{mid}.glb'
        j, b = parse_glb(p)
        V, F = extract_figure_triangles(j, b)
        mn, mx = V.min(0), V.max(0)
        print(mid, 'verts', len(V), 'tris', len(F), 'bbox min', np.round(mn, 3), 'max', np.round(mx, 3), 'size', np.round(mx - mn, 3))