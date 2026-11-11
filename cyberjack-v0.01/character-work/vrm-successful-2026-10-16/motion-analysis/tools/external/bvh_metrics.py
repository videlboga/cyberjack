"""BVH-парсер и метрики движения. Без зависимостей.

Метрики нормализованы по длине ноги/росту, чтобы сравнивать скелеты разного масштаба.
"""
import math


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


def qaxis(axis, deg):
    r = math.radians(deg) / 2; s = math.sin(r)
    return (s if axis == 'X' else 0.0, s if axis == 'Y' else 0.0, s if axis == 'Z' else 0.0, math.cos(r))


def vadd(a, b): return (a[0]+b[0], a[1]+b[1], a[2]+b[2])
def vsub(a, b): return (a[0]-b[0], a[1]-b[1], a[2]-b[2])
def vlen(a): return math.sqrt(sum(c*c for c in a))
def vdot(a, b): return sum(x*y for x, y in zip(a, b))


def vang(a, b):
    la, lb = vlen(a), vlen(b)
    if la == 0 or lb == 0: return 0.0
    return math.degrees(math.acos(max(-1.0, min(1.0, vdot(a, b)/(la*lb)))))


def frame_count(path):
    """число кадров из заголовка, без чтения всего файла."""
    n = 0
    with open(path, errors='replace') as f:
        for line in f:
            if line.startswith('Frames:'):
                n = int(line.split()[1])
            elif line.startswith('Frame Time:'):
                break
    return n


def parse(path, window=None):
    """window=(first,count) — разобрать только нужные кадры (заметно быстрее на длинных записях)."""
    txt = open(path, errors='replace').read()
    i = txt.find('MOTION')
    toks = txt[:i].replace('{', ' { ').replace('}', ' } ').split()
    joints, stack, k = [], [], 0
    while k < len(toks):
        t = toks[k]
        if t in ('ROOT', 'JOINT'):
            joints.append({'name': toks[k+1], 'parent': stack[-1] if stack else None,
                           'offset': (0, 0, 0), 'channels': []})
            stack.append(len(joints)-1); k += 2; continue
        if t == 'End':
            joints.append({'name': 'END', 'parent': stack[-1], 'offset': (0, 0, 0), 'channels': []})
            stack.append(len(joints)-1); k += 2; continue
        if t == 'OFFSET':
            joints[-1]['offset'] = tuple(float(x) for x in toks[k+1:k+4]); k += 4; continue
        if t == 'CHANNELS':
            n = int(toks[k+1]); joints[-1]['channels'] = toks[k+2:k+2+n]; k += 2+n; continue
        if t == '}':
            stack.pop(); k += 1; continue
        k += 1
    body = [l for l in txt[i:].splitlines() if l.strip()]
    nframes, ft = 0, 1/60
    for l in body[:3]:
        if l.startswith('Frames:'): nframes = int(l.split()[1])
        if l.startswith('Frame Time:'): ft = float(l.split()[2])
    rows = body[3:3+nframes]
    if window:
        first, count = window
        rows = rows[max(0, first):max(0, first) + count]
    frames = [[float(x) for x in l.split()] for l in rows]
    return joints, frames, ft


def fk(joints, frame=None):
    world, chbase, c = {}, {}, 0
    for j in joints:
        chbase[id(j)] = c; c += len(j['channels'])
    for ji, j in enumerate(joints):
        ch, q, pos = j['channels'], (0, 0, 0, 1), j['offset']
        if frame is not None and ch:
            vals = frame[chbase[id(j)]: chbase[id(j)]+len(ch)]
            for name, v in zip(ch, vals):
                if name.endswith('rotation'):
                    q = qmul(q, qaxis(name[0], v))
                elif name.endswith('position'):
                    p = list(pos); p['XYZ'.index(name[0])] = v; pos = tuple(p)
        if j['parent'] is None:
            wpos, wq = (pos if frame is not None else j['offset']), q
        else:
            pp, pq = world[j['parent']]
            wpos = vadd(pp, qrot(pq, j['offset']))
            wq = qmul(pq, q)
        world[ji] = (wpos, wq)
    return world


def find(joints, names):
    lut = {}
    for i, j in enumerate(joints):
        lut.setdefault(j['name'], i)
    for n in names:
        if n in lut: return lut[n]
    return None


def metrics(path, names_map, fps_override=None):
    joints, frames, ft = parse(path)
    rest = fk(joints)
    idx = {k: find(joints, v) for k, v in names_map.items()}
    idx = {k: v for k, v in idx.items() if v is not None}
    need = {'hips', 'hip', 'knee', 'ankle'}
    if not need <= set(idx):
        raise KeyError('нет обязательных костей: %s' % (need - set(idx)))
    P = lambda w, k: w[idx[k]][0]
    knee = P(rest, 'knee'); ankle = P(rest, 'ankle'); hip = P(rest, 'hip')
    leg = vlen(vsub(ankle, hip))
    out = {'joints': sum(1 for j in joints if j['name'] != 'END'),
           'fps': round(1/ft, 1), 'frames': len(frames), 'leg_len': round(leg, 1),
           'knee_at_rest_deg': round(vang(vsub(knee, hip), vsub(ankle, knee)), 1)}
    if frames:
        ws = [fk(joints, f) for f in frames]
        for label, fps in (('', 1/ft), ('alt', fps_override or 1/ft)):
            dur = len(frames)/fps
            pos = [w[idx['hips']][0] for w in ws]
            path_len = sum(math.hypot(pos[i][0]-pos[i-1][0], pos[i][2]-pos[i-1][2])
                           for i in range(1, len(pos)))
            sfx = '_' + label if label else ''
            out['duration_s' + sfx] = round(dur, 2)
            out['speed_h_s' + sfx] = round(path_len/dur/leg, 3) if leg else 0
            if 'toe' in idx:
                ys = [P(w, 'toe')[1] for w in ws]
                base = sorted(ys)[len(ys)//3]
                peaks = sum(1 for i in range(1, len(ys)-1)
                            if ys[i] > ys[i-1] and ys[i] >= ys[i+1] and ys[i] > base + leg*0.04)
                out['steps_per_s' + sfx] = round(peaks/dur, 2) if dur else 0
                out['steps_alt' + sfx] = out['steps_per_s' + sfx]
        kn, el, lean = [], [], []
        for w in ws:
            kn.append(vang(vsub(P(w, 'knee'), P(w, 'hip')), vsub(P(w, 'ankle'), P(w, 'knee'))))
            if 'elbow' in idx:
                el.append(vang(vsub(P(w, 'elbow'), P(w, 'shoulder')), vsub(P(w, 'wrist'), P(w, 'elbow'))))
            up = vsub(P(w, 'neck'), P(w, 'hips')) if 'neck' in idx else (0, 1, 0)
            lean.append(math.degrees(math.atan2(math.hypot(up[0], up[2]), up[1])))
        rng = lambda a: (round(min(a)), round(max(a)))
        out['knee_deg'] = rng(kn)
        if el: out['elbow_deg'] = rng(el)
        out['torso_lean_deg'] = rng(lean)
    return out
