#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Что на самом деле переносится, а что нет: направления, углы и длины.

Перенос «по направлениям» (aim-based) — то, что делают все рабочие ретаргетеры: каждой кости
цели задаётся направление исходной кости, а длины остаются свои. При таком переносе углы
суставов сохраняются по построению, поэтому проверять надо не их, а то, что действительно
теряется: каналы без адресата и расхождение длин.

    python3 tools/canonical/aim-transfer.py 40
"""
import json, sys
import numpy as np

MOTION = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16'
NPOSE = int(sys.argv[1]) if len(sys.argv) > 1 else 40
STEM = MOTION + '/motion-analysis/data/dataset/poses-all'

src = {b['name']: b for b in next(r for r in json.load(open(MOTION + '/animations/source_rigs.json'))['rigs']
                                 if r['name'] == 'p_cf_body_bone')['bones']}
tgt = {b['name']: b for b in json.load(open(MOTION + '/motion-analysis/data/canonical/rigE-rest.json'))}

# цепочки: сустав → следующий сустав; именно вдоль них строятся направления
CHAINS = {
    'нога L': ['cf_j_thigh00_L', 'cf_j_leg01_L', 'cf_j_foot_L', 'cf_j_toes_L'],
    'нога R': ['cf_j_thigh00_R', 'cf_j_leg01_R', 'cf_j_foot_R', 'cf_j_toes_R'],
    'рука L': ['cf_j_arm00_L', 'cf_j_forearm01_L', 'cf_j_hand_L'],
    'рука R': ['cf_j_arm00_R', 'cf_j_forearm01_R', 'cf_j_hand_R'],
    'корпус': ['cf_j_hips', 'cf_j_spine01', 'cf_j_spine02', 'cf_j_spine03', 'cf_j_neck', 'cf_j_head'],
}
TCHAINS = {
    'нога L': ['thigh.l', 'leg.l', 'foot.l', 'toes_01.l'],
    'нога R': ['thigh.r', 'leg.r', 'foot.r', 'toes_01.r'],
    'рука L': ['arm.l', 'forearm.l', 'hand.l'],
    'рука R': ['arm.r', 'forearm.r', 'hand.r'],
    'корпус': ['spine_01.x', 'spine_02.x', 'spine_03.x', 'spine_04.x', 'neck.x', 'head.x'],
}

# поза покоя: мировые позиции голов костей
def rest_positions(bones):
    out = {}

    def add(n):
        if n in out:
            return
        p = bones[n].get('parent')
        if p:
            add(p)
        local = np.array(bones[n]['position'], dtype=float)
        out[n] = out[p] + local if p in out else local

    for n in bones:
        add(n)
    return out


s_pos = rest_positions(src)
t_pos = {n: np.array(b['head'], dtype=float) for n, b in tgt.items()}
s_h = float(np.ptp([p[1] for p in s_pos.values()]))
t_h = float(np.ptp([p[2] for p in t_pos.values()]))

# Unity (Y вверх) → Blender (Z вверх). Проверено на rest-направлениях: колено/локоть сходятся.
CONV = np.array([[0.0, 0.0, 1.0], [1.0, 0.0, 0.0], [0.0, 1.0, 0.0]])

head = json.load(open(f'{STEM}-0.json'))
BONES = head['bones']
raw = np.memmap(f'{STEM}-0.bin', dtype=np.float32, mode='r').reshape(head['poses'], len(BONES), 4)
poses = np.array(raw[:NPOSE])


def q2m(q):
    x, y, z, w = np.asarray(q, float) / np.linalg.norm(q)
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z - x * w), 1 - 2 * (x * x + y * y)]])


def joint_positions(bones, local_q, root, order):
    """FK: мировые позиции голов костей."""
    world_q, world_p = {}, {}
    for n in order:
        p = bones[n].get('parent')
        q = local_q.get(n, np.array(bones[n]['rotation'], float))
        q = q / np.linalg.norm(q)
        world_q[n] = q2m(q) if p not in world_q else world_q[p] @ q2m(q)
        local = np.array(bones[n]['position'], float)
        world_p[n] = local if p not in world_p else world_p[p] + world_q[p] @ local
    return world_p


# порядок обхода источника
s_order, seen = [], set()
def add(n):
    if n in seen:
        return
    p = src[n].get('parent')
    if p:
        add(p)
    seen.add(n); s_order.append(n)
for n in src:
    add(n)

angles = {k: [] for k in CHAINS}
for pi in range(len(poses)):
    local = {n: poses[pi, i] for i, n in enumerate(BONES)}
    wp = joint_positions(src, local, 'cf_j_hips', s_order)
    for name, chain in CHAINS.items():
        pts = [CONV @ wp[b] for b in chain]
        d = [pts[i + 1] - pts[i] for i in range(len(pts) - 1)]
        for i in range(len(d) - 1):
            ang = np.degrees(np.arccos(np.clip(d[i] @ d[i + 1] /
                                              (np.linalg.norm(d[i]) * np.linalg.norm(d[i + 1])), -1, 1)))
            angles[name].append(ang)

print('углы суставов в исходной библиотеке (для справки, градусы):')
for name, v in angles.items():
    v = np.array(v)
    print(f'  {name:8s} среднее {v.mean():5.1f}  p95 {np.percentile(v, 95):5.1f}  max {v.max():5.1f}')

print('\nдлины сегментов (доля роста):')
lost = []
for name in ('нога L', 'рука L', 'корпус'):
    for i in range(len(CHAINS[name]) - 1):
        a, b = CHAINS[name][i], CHAINS[name][i + 1]
        ta, tb = TCHAINS[name][i], TCHAINS[name][i + 1]
        ls = np.linalg.norm(s_pos[b] - s_pos[a]) / s_h * 100
        lt = np.linalg.norm(t_pos[tb] - t_pos[ta]) / t_h * 100
        lost.append(abs(ls - lt))
        print(f'  {name:8s} {i + 1}: библиотека {ls:5.1f}%  rig_E {lt:5.1f}%  разница {abs(ls - lt):4.1f} п.п.')

print(f'\nразница длин: среднее {np.mean(lost):.1f} п.п. роста, максимум {np.max(lost):.1f} п.п.')
print(f'в сантиметрах при росте 170 см: {np.mean(lost) * 1.7:.1f} см в среднем, {np.max(lost) * 1.7:.1f} см в худшем сегменте')
print('AIM_OK')
