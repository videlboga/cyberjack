"""FK по rest-скелету Koikatsu (source_rigs.json, p_cf_body_bone). Без зависимостей."""
import json, math


def vadd(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def vlen(a): return math.sqrt(sum(c*c for c in a))


def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx + ax*bw + ay*bz - az*by,
            aw*by - ax*bz + ay*bw + az*bx,
            aw*bz + ax*by - ay*bx + az*bw,
            aw*bw - ax*bx - ay*by - az*bz)


def qrot(q, v):
    x, y, z, w = q; vx, vy, vz = v
    t = (2*(y*vz - z*vy), 2*(z*vx - x*vz), 2*(x*vy - y*vx))
    return (vx + w*t[0] + (y*t[2] - z*t[1]),
            vy + w*t[1] + (z*t[0] - x*t[2]),
            vz + w*t[2] + (x*t[1] - y*t[0]))


def world(rig_path):
    sr = json.load(open(rig_path))
    rig = [r for r in sr['rigs'] if r['name'] == 'p_cf_body_bone'][0]
    bones = rig['bones']
    children = {}
    for b in bones:
        children.setdefault(b.get('parent'), []).append(b)
    out = {}

    def walk(b, ppos, pq):
        wpos = vadd(ppos, qrot(pq, tuple(b['position'])))
        wq = qmul(pq, tuple(b['rotation']))
        out[b['name']] = (wpos, wq)
        for c in children.get(b['name'], []):
            walk(c, wpos, wq)

    root = children[None][0]
    walk(root, (0, 0, 0), (0, 0, 0, 1))
    return {b['name']: b for b in bones}, out
