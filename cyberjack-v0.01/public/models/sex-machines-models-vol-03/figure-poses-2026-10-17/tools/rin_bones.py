# Parse a VRM (glTF container) and dump humanoid bone rest world positions -> pickle.
# Usage: python3 rin_bones.py <file.vrm> <out.pkl>
# bones[name]['wpos'] = [x, y, z] in VRM model space (metres, Y-up), plus hips->head span check.
import sys, json, struct, pickle
import numpy as np


def read_glb_json(path):
    b = open(path, 'rb').read()
    magic, ver, total = struct.unpack_from('<III', b, 0)
    assert magic == 0x46546C67, 'not a glb'
    off = 12
    js = None
    while off < total:
        clen, ctype = struct.unpack_from('<II', b, off)
        chunk = b[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode('utf-8'))
        off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0)
    return js


def trs_matrix(node):
    t = np.array(node.get('translation', [0, 0, 0]), dtype=np.float64)
    r = np.array(node.get('rotation', [0, 0, 0, 1]), dtype=np.float64)  # xyzw
    s = np.array(node.get('scale', [1, 1, 1]), dtype=np.float64)
    if 'matrix' in node:
        m = np.array(node['matrix'], dtype=np.float64).reshape(4, 4).T  # column-major
        return m
    x, y, z, w = r
    R = np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]], dtype=np.float64)
    m = np.eye(4)
    m[:3, :3] = R * s[None, :]
    m[:3, 3] = t
    return m


def humanoid_map(js):
    out = {}
    ext = js.get('extensions', {})
    if 'VRMC_vrm' in ext:
        hb = ext['VRMC_vrm']['humanoid']['humanBones']
        if isinstance(hb, dict):
            for k, v in hb.items():
                out[k] = v['node'] if isinstance(v, dict) else v
        else:  # list form
            for v in hb:
                out[v['bone']] = v['node']
    elif 'VRM' in ext:
        for v in ext['VRM']['humanoid']['humanBones']:
            out[v['bone']] = v['node']
    return out


def main():
    src, out = sys.argv[1], sys.argv[2]
    js = read_glb_json(src)
    nodes = js['nodes']
    hmap = humanoid_map(js)
    world = {}
    parent = {}
    for i, n in enumerate(nodes):
        for c in n.get('children', []):
            parent[c] = i

    def world_pos(i):
        if i in world:
            return world[i]
        m = trs_matrix(nodes[i])
        if i in parent:
            m = world_pos(parent[i]) @ m
        world[i] = m
        return m

    bones = {}
    for name, idx in hmap.items():
        m = world_pos(idx)
        bones[name] = {'wpos': m[:3, 3].copy(),
                       'wrot': [float(c) for c in np.eye(4)[:3, :3].ravel()],
                       'node': idx, 'nodeName': nodes[idx].get('name', '')}
    span = np.linalg.norm(np.array(bones['head']['wpos']) - np.array(bones['hips']['wpos']))
    pickle.dump(bones, open(out, 'wb'))
    print('bones:', len(bones), 'hips->head span: %.4f' % span)
    for k in ('hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm',
              'leftHand', 'leftUpperLeg', 'leftLowerLeg', 'leftFoot'):
        if k in bones:
            print('  %-14s %s' % (k, np.round(bones[k]['wpos'], 4).tolist()))


if __name__ == '__main__':
    main()
