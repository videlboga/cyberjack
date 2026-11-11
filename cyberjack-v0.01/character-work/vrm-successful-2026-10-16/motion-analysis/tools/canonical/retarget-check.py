#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Проверка переноса библиотеки Koikatsu → rig_E по УГЛАМ СУСТАВОВ.

Угол в локте, колене, голеностопе не зависит от осей, пропорций и позы покоя — это инвариант,
поэтому он и служит критерием: если перенос верен, углы совпадают, а расхождение положений
остаётся только ценой разных длин костей.

Перенос — сопряжением локального поворота, как в самом проекте (RIG_COMPAT §1):
    M = R_rest_target⁻¹ · R_rest_source,   q_target = M · q_source · M⁻¹
Сопряжение сохраняет угол поворота и меняет только ось, поэтому углы суставов переносятся точно,
а не «примерно».

    python3 tools/canonical/retarget-check.py 60
"""
import json, sys
import numpy as np

MOTION = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16'
NPOSE = int(sys.argv[1]) if len(sys.argv) > 1 else 60
STEM = MOTION + '/motion-analysis/data/dataset/poses-all'
SHARD = 0


# ---------------------------------------------------------------- кватернионы
def qnorm(q):
    q = np.asarray(q, dtype=float)
    return q / np.linalg.norm(q)


def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return np.array([aw * bx + ax * bw + ay * bz - az * by,
                     aw * by - ax * bz + ay * bw + az * bx,
                     aw * bz + ax * by - ay * bx + az * bw,
                     aw * bw - ax * bx - ay * by - az * bz])


def qconj(q):
    return np.array([-q[0], -q[1], -q[2], q[3]])


def q2m(q):
    x, y, z, w = qnorm(q)
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def m2q(m):
    t = np.trace(m)
    if t > 0:
        s = np.sqrt(t + 1.0) * 2; w = 0.25 * s
        x = (m[2, 1] - m[1, 2]) / s; y = (m[0, 2] - m[2, 0]) / s; z = (m[1, 0] - m[0, 1]) / s
    elif m[0, 0] > m[1, 1] and m[0, 0] > m[2, 2]:
        s = np.sqrt(1.0 + m[0, 0] - m[1, 1] - m[2, 2]) * 2
        w = (m[2, 1] - m[1, 2]) / s; x = 0.25 * s; y = (m[0, 1] + m[1, 0]) / s; z = (m[0, 2] + m[2, 0]) / s
    elif m[1, 1] > m[2, 2]:
        s = np.sqrt(1.0 + m[1, 1] - m[0, 0] - m[2, 2]) * 2
        w = (m[0, 2] - m[2, 0]) / s; x = (m[0, 1] + m[1, 0]) / s; y = 0.25 * s; z = (m[1, 2] + m[2, 1]) / s
    else:
        s = np.sqrt(1.0 + m[2, 2] - m[0, 0] - m[1, 1]) * 2
        w = (m[1, 0] - m[0, 1]) / s; x = (m[0, 2] + m[2, 0]) / s; y = (m[1, 2] + m[2, 1]) / s; z = 0.25 * s
    return qnorm(np.array([x, y, z, w]))


# ---------------------------------------------------------------- риги и цепочки
src = {b['name']: b for b in next(r for r in json.load(open(MOTION + '/animations/source_rigs.json'))['rigs']
                                 if r['name'] == 'p_cf_body_bone')['bones']}
tgt = {b['name']: b for b in json.load(open(MOTION + '/motion-analysis/data/canonical/rigE-rest.json'))}

SIDES = {'L': 'l', 'R': 'r'}
MAP = {'cf_j_hips': 'spine_01.x', 'cf_j_spine01': 'spine_02.x', 'cf_j_spine02': 'spine_03.x',
       'cf_j_spine03': 'spine_04.x', 'cf_j_neck': 'neck.x', 'cf_j_head': 'head.x'}
for s, t in SIDES.items():
    MAP.update({f'cf_j_shoulder_{s}': f'shoulder.{t}', f'cf_j_arm00_{s}': f'arm.{t}',
                f'cf_j_forearm01_{s}': f'forearm.{t}', f'cf_j_hand_{s}': f'hand.{t}',
                f'cf_j_thigh00_{s}': f'thigh.{t}', f'cf_j_leg01_{s}': f'leg.{t}',
                f'cf_j_foot_{s}': f'foot.{t}', f'cf_j_toes_{s}': f'toes_01.{t}'})
    for fsrc, ftgt in (('index', 'index'), ('middle', 'middle'), ('ring', 'ring'), ('little', 'pinky'), ('thumb', 'thumb')):
        for k in (1, 2, 3):
            MAP[f'cf_j_{fsrc}0{k}_{s}'] = f'{ftgt}{k}.{t}'
MAP = {s: t for s, t in MAP.items() if s in src and t in tgt}

# явные цепочки: сустав → следующий сустав (без «первого ребёнка в словаре»)
NEXT_SRC, NEXT_TGT = {}, {}
for s, t in SIDES.items():
    for a, b in (('shoulder', 'arm00'), ('arm00', 'forearm01'), ('forearm01', 'hand')):
        NEXT_SRC[f'cf_j_{a}_{s}'] = f'cf_j_{b}_{s}'
    for a, b in (('thigh00', 'leg01'), ('leg01', 'foot'), ('foot', 'toes')):
        NEXT_SRC[f'cf_j_{a}_{s}'] = f'cf_j_{b}_{s}'
    for a, b in (('shoulder', 'arm'), ('arm', 'forearm'), ('forearm', 'hand')):
        NEXT_TGT[f'{a}.{t}'] = f'{b}.{t}'
    for a, b in (('thigh', 'leg'), ('leg', 'foot'), ('foot', 'toes_01')):
        NEXT_TGT[f'{a}.{t}'] = f'{b}.{t}'
for a, b in (('cf_j_hips', 'cf_j_spine01'), ('cf_j_spine01', 'cf_j_spine02'), ('cf_j_spine02', 'cf_j_spine03'),
             ('cf_j_spine03', 'cf_j_neck'), ('cf_j_neck', 'cf_j_head')):
    NEXT_SRC[a] = b
for a, b in (('spine_01.x', 'spine_02.x'), ('spine_02.x', 'spine_03.x'), ('spine_03.x', 'spine_04.x'),
             ('spine_04.x', 'neck.x'), ('neck.x', 'head.x')):
    NEXT_TGT[a] = b


def rest_world(bones, is_target):
    parent = {n: b.get('parent') for n, b in bones.items()}
    order, seen = [], set()

    def add(n):
        if n in seen or n not in bones:
            return
        p = parent.get(n)
        if p:
            add(p)
        seen.add(n); order.append(n)

    for n in bones:
        add(n)
    q_local = {n: qnorm(bones[n]['quat'] if is_target else bones[n]['rotation']) for n in order}
    world_q, world_p, local_p = {}, {}, {}
    for n in order:
        p = parent.get(n)
        world_q[n] = qmul(world_q[p], q_local[n]) if p in world_q else q_local[n]
        pos = np.array(bones[n]['head' if is_target else 'position'], dtype=float)
        world_p[n] = pos if (is_target or p not in world_p) else world_p[p] + q2m(world_q[p]) @ pos
        local_p[n] = np.linalg.inv(q2m(world_q[p])) @ (world_p[n] - world_p[p]) if p in world_p else world_p[n]
    return parent, order, q_local, world_q, world_p, local_p


s_parent, s_order, s_q, s_wq, s_wp, s_lp = rest_world(src, False)
t_parent, t_order, t_q, t_wq, t_wp, t_lp = rest_world(tgt, True)

# поправка на кость: M = R_rest_target⁻¹ · R_rest_source (в мировых рамках)
M_OF = {s: m2q(q2m(t_wq[t]).T @ q2m(s_wq[s])) for s, t in MAP.items()}


def fk(order, parent, local_p, local_q, rest_q):
    world_q, world_p = {}, {}
    for n in order:
        p = parent.get(n)
        q = local_q.get(n, rest_q[n])          # кости вне позы остаются в rest
        world_q[n] = qmul(world_q[p], q) if p in world_q else q
        world_p[n] = world_p[p] + q2m(world_q[p]) @ local_p[n] if p in world_p else local_p[n]
    return world_q, world_p


def angle(a, b, c):
    u, v = a - b, c - b
    nu, nv = np.linalg.norm(u), np.linalg.norm(v)
    if nu < 1e-9 or nv < 1e-9:
        return None
    return float(np.degrees(np.arccos(np.clip(u @ v / (nu * nv), -1, 1))))


# ---------------------------------------------------------------- позы
head = json.load(open(f'{STEM}-{SHARD}.json'))
BONES = head['bones']
raw = np.memmap(f'{STEM}-{SHARD}.bin', dtype=np.float32, mode='r').reshape(head['poses'], len(BONES), 4)
poses = np.array(raw[:NPOSE])
print(f'поз {len(poses)}; сопоставлено костей {len(MAP)} из {len(BONES)}')

s_h = float(np.ptp([p[1] for p in s_wp.values()]))
t_h = float(np.ptp([p[2] for p in t_wp.values()]))
scale = s_h / t_h

# какие углы сравниваем: (имя, кость A, кость B, кость C) — угол при B
JOINTS = [('локоть L', 'cf_j_arm00_L', 'cf_j_forearm01_L', 'cf_j_hand_L', 'arm.l', 'forearm.l', 'hand.l'),
          ('локоть R', 'cf_j_arm00_R', 'cf_j_forearm01_R', 'cf_j_hand_R', 'arm.r', 'forearm.r', 'hand.r'),
          ('колено L', 'cf_j_thigh00_L', 'cf_j_leg01_L', 'cf_j_foot_L', 'thigh.l', 'leg.l', 'foot.l'),
          ('колено R', 'cf_j_thigh00_R', 'cf_j_leg01_R', 'cf_j_foot_R', 'thigh.r', 'leg.r', 'foot.r'),
          ('голеностоп L', 'cf_j_leg01_L', 'cf_j_foot_L', 'cf_j_toes_L', 'leg.l', 'foot.l', 'toes_01.l'),
          ('голеностоп R', 'cf_j_leg01_R', 'cf_j_foot_R', 'cf_j_toes_R', 'leg.r', 'foot.r', 'toes_01.r'),
          ('плечо L', 'cf_j_spine03', 'cf_j_shoulder_L', 'cf_j_arm00_L', 'spine_04.x', 'shoulder.l', 'arm.l'),
          ('плечо R', 'cf_j_spine03', 'cf_j_shoulder_R', 'cf_j_arm00_R', 'spine_04.x', 'shoulder.r', 'arm.r')]

res = {j[0]: [] for j in JOINTS}
pos_err = []
for pi in range(len(poses)):
    lq_src = {n: qnorm(poses[pi, i]) for i, n in enumerate(BONES)}
    _, wp_src = fk(s_order, s_parent, s_lp, lq_src, s_q)

    lq_tgt = dict(t_q)
    for s, t in MAP.items():
        M = M_OF[s]
        lq_tgt[t] = qnorm(qmul(qmul(M, lq_src.get(s, s_q[s])), qconj(M)))
    _, wp_tgt = fk(t_order, t_parent, t_lp, lq_tgt, t_q)

    for name, sa, sb, sc, ta, tb, tc in JOINTS:
        a_s = angle(wp_src[sa], wp_src[sb], wp_src[sc])
        a_t = angle(wp_tgt[ta], wp_tgt[tb], wp_tgt[tc])
        if a_s is not None and a_t is not None:
            res[name].append(abs(a_s - a_t))

    hip_s, hip_t = wp_src['cf_j_hips'], wp_tgt['spine_01.x']
    # Unity (Y вверх) → Blender (Z вверх): поворот, а не перестановка осей
    conv = np.array([[0.0, 0.0, 1.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])
    for s, t in MAP.items():
        ps = conv @ ((wp_src[s] - hip_s) * scale)
        pos_err.append(np.linalg.norm(ps - (wp_tgt[t] - hip_t)) / s_h * 100)

print('\nуглы суставов (разница источник ↔ цель после переноса):')
for name, vals in res.items():
    v = np.array(vals)
    print(f'  {name:14s} среднее {v.mean():5.2f}°  p95 {np.percentile(v, 95):5.2f}°  max {v.max():5.2f}°')
pe = np.array(pos_err)
print(f'\nположения суставов: {pe.mean():.2f}% роста (p95 {np.percentile(pe, 95):.2f}%, max {pe.max():.2f}%)')
print('RETARGET_CHECK_OK')
