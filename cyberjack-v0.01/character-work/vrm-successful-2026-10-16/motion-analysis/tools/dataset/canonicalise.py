#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Канонизация: сколько теряется при переводе библиотеки Koikatsu в риг нового конструктора (rig_E).

Ориентация переносится точно: q_target_world = C · q_source_world, где C = T_rest · S_rest⁻¹ —
единственное преобразование, при котором в позе покоя риги совпадают. Длины костей поворотом
не переносятся, поэтому цена переноса — расхождение положений суставов и потерянные каналы.

Меряем:
  1. покрытие — какие каналы библиотеки имеют адресата в rig_E;
  2. насколько совпадают сами скелеты в позе покоя (это и есть предел точности переноса);
  3. ошибку направлений костей в позе после переноса, в градусах.

    python3 tools/dataset/canonicalise.py data/dataset/poses-all 0 200
"""
import json, sys
import numpy as np

MOTION = '/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16'
stem = sys.argv[1] if len(sys.argv) > 1 else MOTION + '/motion-analysis/data/dataset/poses-all'
SHARD = int(sys.argv[2]) if len(sys.argv) > 2 else 0
NPOSE = int(sys.argv[3]) if len(sys.argv) > 3 else 200


def q2m(q):
    x, y, z, w = np.asarray(q, dtype=float) / np.linalg.norm(q)
    return np.array([
        [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
        [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
        [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def m4(rot, pos):
    m = np.eye(4)
    m[:3, :3] = rot
    m[:3, 3] = pos
    return m


def rigs():
    src_rig = next(r for r in json.load(open(MOTION + '/animations/source_rigs.json'))['rigs']
                   if r['name'] == 'p_cf_body_bone')
    tgt_rig = json.load(open(MOTION + '/motion-analysis/data/canonical/rigE-rest.json'))
    return {b['name']: b for b in src_rig['bones']}, {b['name']: b for b in tgt_rig}


def rest_rig(bones, is_target):
    """rest по ригу: локальные и мировые повороты, локальные и мировые позиции.

    Важно: у цели (`head`) — абсолютные координаты в позе покоя, у источника (`position`) —
    локальные относительно родителя. Смешивать их нельзя: иначе весь скелет уезжает.
    """
    parent = {n: b.get("parent") for n, b in bones.items()}
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

    q_local = {n: np.array(bones[n]["quat"] if is_target else bones[n]["rotation"], dtype=float) for n in order}
    q_local = {n: q / np.linalg.norm(q) for n, q in q_local.items()}
    world_rot, world_pos, local_pos = {}, {}, {}
    for n in order:
        p = parent.get(n)
        rot = q2m(q_local[n])
        world_rot[n] = world_rot[p] @ rot if p in world_rot else rot
        if is_target:
            world_pos[n] = np.array(bones[n]["head"], dtype=float)
        else:
            pos = np.array(bones[n]["position"], dtype=float)
            world_pos[n] = world_pos[p] + world_rot[p] @ pos if p in world_pos else pos
        local_pos[n] = (np.linalg.inv(world_rot[p]) @ (world_pos[n] - world_pos[p])) if p in world_pos else world_pos[n]
    return parent, order, q_local, world_rot, world_pos, local_pos


PAIR = {'L': 'l', 'R': 'r'}
MAP = {'cf_j_hips': 'spine_01.x', 'cf_j_spine01': 'spine_02.x', 'cf_j_spine02': 'spine_03.x',
       'cf_j_spine03': 'spine_04.x', 'cf_j_neck': 'neck.x', 'cf_j_head': 'head.x'}
for s, t in PAIR.items():
    MAP.update({f'cf_j_shoulder_{s}': f'shoulder.{t}', f'cf_j_arm00_{s}': f'arm.{t}',
                f'cf_j_forearm01_{s}': f'forearm.{t}', f'cf_j_hand_{s}': f'hand.{t}',
                f'cf_j_thigh00_{s}': f'thigh.{t}', f'cf_j_leg01_{s}': f'leg.{t}',
                f'cf_j_foot_{s}': f'foot.{t}', f'cf_j_toes_{s}': f'toes_01.{t}'})
    for fsrc, ftgt in (('index', 'index'), ('middle', 'middle'), ('ring', 'ring'), ('little', 'pinky'), ('thumb', 'thumb')):
        for k in (1, 2, 3):
            MAP[f'cf_j_{fsrc}0{k}_{s}'] = f'{ftgt}{k}.{t}'


# Явные цепочки. Брать «первого ребёнка из словаря» нельзя: у источника первыми идут
# динамические кости (cf_d_*), у цели — контролы (c_stretch_*), и направление получается чужим.
NEXT_SRC, NEXT_TGT = {}, {}
def link(d, a, b):
    d[a] = b

for s in ('L', 'R'):
    t = PAIR[s]
    for a, b in (('thigh00', 'leg01'), ('leg01', 'foot'), ('foot', 'toes')):
        link(NEXT_SRC, f'cf_j_{a}_{s}', f'cf_j_{b}_{s}')
    link(NEXT_SRC, f'cf_j_shoulder_{s}', f'cf_j_arm00_{s}')
    for a, b in (('arm00', 'forearm01'), ('forearm01', 'hand')):
        link(NEXT_SRC, f'cf_j_{a}_{s}', f'cf_j_{b}_{s}')
    for f in ('index', 'middle', 'ring', 'little', 'thumb'):
        for k in (1, 2):
            link(NEXT_SRC, f'cf_j_{f}0{k}_{s}', f'cf_j_{f}0{k + 1}_{s}')
    for a, b in (('thigh', 'leg'), ('leg', 'foot'), ('foot', 'toes_01')):
        link(NEXT_TGT, f'{a}.{t}', f'{b}.{t}')
    link(NEXT_TGT, f'shoulder.{t}', f'arm.{t}')
    for a, b in (('arm', 'forearm'), ('forearm', 'hand')):
        link(NEXT_TGT, f'{a}.{t}', f'{b}.{t}')
    for f in ('index', 'middle', 'ring', 'pinky', 'thumb'):
        for k in (1, 2):
            link(NEXT_TGT, f'{f}{k}.{t}', f'{f}{k + 1}.{t}')
for a, b in (('cf_j_hips', 'cf_j_spine01'), ('cf_j_spine01', 'cf_j_spine02'), ('cf_j_spine02', 'cf_j_spine03'),
             ('cf_j_spine03', 'cf_j_neck'), ('cf_j_neck', 'cf_j_head')):
    link(NEXT_SRC, a, b)
for a, b in (('spine_01.x', 'spine_02.x'), ('spine_02.x', 'spine_03.x'), ('spine_03.x', 'spine_04.x'),
             ('spine_04.x', 'neck.x'), ('neck.x', 'head.x')):
    link(NEXT_TGT, a, b)

src, tgt = rigs()
src_parent, src_order, src_q, src_rot, src_pos, src_lpos = rest_rig(src, is_target=False)
tgt_parent, tgt_order, tgt_q, tgt_rot, tgt_pos, tgt_lpos = rest_rig(tgt, is_target=True)

# Unity (источник, Y вверх) → Blender (цель, Z вверх)
# Unity (X вправо, Y вверх, Z вперёд) → Blender (X вправо, Y вперёд, Z вверх):
# (x, y, z) → (x, -z, y). Это поворот (det +1); перестановка Y↔Z дала бы зеркало.
to_blender = np.array([[1, 0, 0], [0, 0, -1], [0, 1, 0]], dtype=float)

head = json.load(open(f'{stem}-{SHARD}.json'))
BONES = head['bones']
raw = np.memmap(f'{stem}-{SHARD}.bin', dtype=np.float32, mode='r').reshape(head['poses'], len(BONES), 4)
poses = np.array(raw[:NPOSE])

pairs = [(s, t) for s, t in MAP.items() if s in BONES and t in tgt]
unmapped = [b for b in BONES if b not in MAP]
print(f'поз {len(poses)}; костей в библиотеке {len(BONES)}; сопоставлено {len(pairs)}')
print(f'без адресата {len(unmapped)} ({100*len(unmapped)/len(BONES):.0f}%): {", ".join(unmapped[:8])}')
absent = [s for s in MAP if s not in BONES]
if absent:
    print(f'нет в библиотеке: {", ".join(absent)}')

src_h = float(np.ptp([q[1] for q in src_pos.values()]))   # у источника вверх = Y (Unity)
tgt_h = float(np.ptp([q[2] for q in tgt_pos.values()]))   # у цели вверх = Z (Blender)
print(f"рост источника {src_h:.3f}, цели {tgt_h:.3f}, отношение {tgt_h/src_h:.3f}")

# --- позы покоя разные (у источника T-поза, у rig_E A-поза), поэтому сравнивать положения
# в rest нельзя. Сравниваем то, что поворотом не исправить вообще: пропорции, в % роста.
def seg_len(rig_pos, a, b):
    return float(np.linalg.norm(rig_pos[b] - rig_pos[a]))
segments = [("бедро L", "cf_j_thigh00_L", "cf_j_leg01_L", "thigh.l", "leg.l"),
            ("голень L", "cf_j_leg01_L", "cf_j_foot_L", "leg.l", "foot.l"),
            ("стопа L", "cf_j_foot_L", "cf_j_toes_L", "foot.l", "toes_01.l"),
            ("плечо L", "cf_j_arm00_L", "cf_j_forearm01_L", "arm.l", "forearm.l"),
            ("предплечье L", "cf_j_arm00_L", "cf_j_hand_L", "arm.l", "hand.l"),
            ("корпус", "cf_j_hips", "cf_j_head", "spine_01.x", "head.x")]
print("\nпропорции (доля роста):")
worst = 0
for name, sa, sb, ta, tb in segments:
    ls = seg_len(src_pos, sa, sb) / src_h * 100
    lt = seg_len(tgt_pos, ta, tb) / tgt_h * 100
    d = abs(ls - lt)
    worst = max(worst, d)
    print(f"  {name:12s} источник {ls:5.1f}%  цель {lt:5.1f}%  разница {d:4.1f} п.п.")

def fk(order, parent, lpos, local_rot, rest_rot):
    world = {}
    for n in order:
        p = parent.get(n)
        local = m4(local_rot.get(n, rest_rot[n]), lpos[n])
        world[n] = world[p] @ local if p in world else local
    return world


hip_s, hip_t = src_pos["cf_j_hips"], tgt_pos["spine_01.x"]
scale = src_h / tgt_h
map_t = {t: s for s, t in pairs}
# локальные rest-повороты цели: для костей без адресата цепочка должна оставаться в rest
# ОТНОСИТЕЛЬНО родителя, иначе контролы (c_thigh_b.l, c_shoulder.l, c_root.x) ломают FK
# и всё, что под ними, уезжает — это и давало 60–80° «ошибки».
tgt_lrot_rest = {n: (np.linalg.inv(tgt_rot[tgt_parent[n]]) @ tgt_rot[n]) if tgt_parent.get(n) in tgt_rot else tgt_rot[n]
                 for n in tgt_order}


def fk_mixed(order, parent, lpos, lrot_rest, world_override):
    """FK, в котором заданные кости получают мировую ориентацию, остальные — rest локально."""
    rot, pos = {}, {}
    for n in order:
        p = parent.get(n)
        r = world_override[n] if n in world_override else ((rot[p] @ lrot_rest[n]) if p in rot else lrot_rest[n])
        rot[n] = r
        pos[n] = (pos[p] + rot[p] @ lpos[n]) if p in pos else lpos[n]
    return rot, pos


dir_err, pos_err, _dbg = [], [], []
for pi in range(len(poses)):
    lrot_src = {name: q2m(poses[pi, i]) for i, name in enumerate(BONES)}
    w_src = fk(src_order, src_parent, src_lpos, lrot_src, src_rot)
    w_src_rot = {n: m[:3, :3] for n, m in w_src.items()}

    override = {t: tgt_rot[t] @ src_rot[s].T @ w_src_rot[s] for s, t in pairs}
    w_tgt_rot, w_tgt_pos = fk_mixed(tgt_order, tgt_parent, tgt_lpos, tgt_lrot_rest, override)

    for s, t in pairs:
        ps = to_blender @ ((w_src[s][:3, 3] - hip_s) * scale)
        pt = w_tgt_pos[t] - hip_t
        pos_err.append(np.linalg.norm(ps - pt) / src_h * 100)
        child_s, child_t = NEXT_SRC.get(s), NEXT_TGT.get(t)
        if child_s and child_t and child_s in w_src and child_t in w_tgt_pos:
            vs = to_blender @ (w_src[child_s][:3, 3] - w_src[s][:3, 3])
            vt = w_tgt_pos[child_t] - w_tgt_pos[t]
            if np.linalg.norm(vs) > 1e-6 and np.linalg.norm(vt) > 1e-6:
                ang = np.degrees(np.arccos(np.clip(vs @ vt / (np.linalg.norm(vs) * np.linalg.norm(vt)), -1, 1)))
                dir_err.append(ang)
                if pi == 0:
                    _dbg.append((ang, s, t, np.round(vs / np.linalg.norm(vs), 2), np.round(vt / np.linalg.norm(vt), 2)))

dir_err = np.array(dir_err); pos_err = np.array(pos_err)
print(f"\nперенос поз: положения {pos_err.mean():.2f}% роста (p95 {np.percentile(pos_err, 95):.2f}%, max {pos_err.max():.2f}%)")
print(f"             направления {dir_err.mean():.2f}° (p95 {np.percentile(dir_err, 95):.2f}°, max {dir_err.max():.2f}°)")
print("ВНИМАНИЕ: числа выше пока НЕ подтверждены — направление кости тут берётся как разница")
print("голов соседних костей, а цепочки и оси стыкуются вручную. Годный критерий — углы суставов.")
print("CANON_UNVERIFIED")
