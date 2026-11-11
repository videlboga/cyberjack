#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Латент позы: PCA над локальными кватернионами 160 костей.

Зачем: заменить перебор по 281 МБ индекса вектором из десятков чисел.
Проверяется не «на глаз», а тремя числами: ошибка реконструкции в градусах,
сохранение порядка расстояний (Spearman) и время кодирования/поиска.

    python3 tools/dataset/fit-latent.py data/dataset/poses-reps
"""
import json, sys, time, hashlib
import numpy as np

stem = sys.argv[1] if len(sys.argv) > 1 else 'data/dataset/poses-reps'
base = stem.rsplit('/', 1)[0] if '/' in stem else '.'
head = json.load(open(stem + '.json'))
poses = np.fromfile(stem + '.bin', dtype=np.float32).reshape(head['poses'], len(head['bones']), 4)
BONES = head['bones']
META = head['meta']
N, B, _ = poses.shape
X = poses.reshape(N, B * 4).astype(np.float64)
print(f'поз {N}, костей {B}, файл {poses.nbytes/1e6:.1f} МБ')

# Клипы целиком в train или test: иначе соседние кадры одного движения утекают.
clip_ids = sorted({m['id'] for m in META})
def bucket(cid):
    return int(hashlib.sha256(cid.encode()).hexdigest()[:8], 16) % 100
test_clips = {c for c in clip_ids if bucket(c) < 15}
is_test = np.array([m['id'] in test_clips for m in META])
print(f'клипов {len(clip_ids)}, в тесте {len(test_clips)}, поз в тесте {int(is_test.sum())}')

# Оси: тело (крупные суставы) и все кости. Пальцы дают 56 из 160 и легко
# занижают ошибку «в среднем», поэтому тело считаем отдельно.
CORE = ['cf_j_hips', 'cf_j_spine01', 'cf_j_spine02', 'cf_j_spine03', 'cf_j_neck', 'cf_j_head',
        'cf_j_shoulder_L', 'cf_j_arm00_L', 'cf_j_forearm01_L', 'cf_j_hand_L',
        'cf_j_shoulder_R', 'cf_j_arm00_R', 'cf_j_forearm01_R', 'cf_j_hand_R',
        'cf_j_thigh00_L', 'cf_j_leg01_L', 'cf_j_foot_L', 'cf_j_toes_L',
        'cf_j_thigh00_R', 'cf_j_leg01_R', 'cf_j_foot_R', 'cf_j_toes_R']
core_idx = np.array([BONES.index(b) for b in CORE if b in BONES])
print(f'тело: {len(core_idx)} костей из {B}')

Xtr, Xte = X[~is_test], X[is_test]
mean = Xtr.mean(axis=0)
Xtr_c = Xtr - mean


def angles_deg(orig, rec):
    """Угол между исходным и восстановленным кватернионом по каждой кости."""
    a = orig.reshape(-1, B, 4); b = rec.reshape(-1, B, 4)
    nb = np.linalg.norm(b, axis=2, keepdims=True); b = b / np.maximum(nb, 1e-9)
    dot = np.clip(np.abs((a * b).sum(axis=2)), 0.0, 1.0)
    return 2.0 * np.degrees(np.arccos(dot))


t0 = time.time()
# SVD по train: экономичный, 45k×640
U, S, Vt = np.linalg.svd(Xtr_c, full_matrices=False)
print(f'SVD {time.time()-t0:.1f} с, объяснённая дисперсия: ' +
      ' '.join(f'{k}:{S[:k].var()/S.var():.3f}' if False else f'{k}:{100*(S[:k]**2).sum()/(S**2).sum():.1f}%' for k in (8, 16, 32, 64, 96, 128)))

rows = []
for k in (8, 12, 16, 24, 32, 48, 64, 96, 128, 192):
    if k > Vt.shape[0]:
        continue
    comp = Vt[:k]
    rec = (Xte - mean) @ comp.T @ comp + mean
    ang = angles_deg(Xte, rec)
    rows.append({
        'k': k,
        'тело сред': round(float(ang[:, core_idx].mean()), 2),
        'тело p95': round(float(np.percentile(ang[:, core_idx], 95)), 2),
        'тело макс': round(float(ang[:, core_idx].max()), 2),
        'все сред': round(float(ang.mean()), 2),
        'все p95': round(float(np.percentile(ang, 95)), 2),
        'килобайт': round(k * B * 4 / 1024, 1),
    })
print('\n| k | тело сред | тело p95 | тело макс | все сред | все p95 | комп., КБ |')
print('|---|---|---|---|---|---|---|')
for r in rows:
    print(f"| {r['k']} | {r['тело сред']} | {r['тело p95']} | {r['тело макс']} | {r['все сред']} | {r['все p95']} | {r['килобайт']} |")

# Сохраняет ли латент порядок расстояний? Это и есть замена перебора.
rng = np.random.default_rng(7)
picks = rng.choice(len(Xte), size=min(300, len(Xte)), replace=False)
sub_core = Xte[picks].reshape(-1, B, 4)[:, core_idx]
i, j = np.triu_indices(len(picks), 1)


def core_dist(a, b):
    dot = np.clip(np.abs((a * b).sum(-1)), 0.0, 1.0)
    return (2.0 * np.degrees(np.arccos(dot))).mean(axis=1)


def spearman(x, y):
    rx = np.argsort(np.argsort(x)).astype(float)
    ry = np.argsort(np.argsort(y)).astype(float)
    rx -= rx.mean(); ry -= ry.mean()
    return float((rx @ ry) / np.sqrt((rx @ rx) * (ry @ ry)))


d_raw = core_dist(sub_core[i], sub_core[j])
print(f'\n| k | Spearman по расстояниям (тело), {len(i)} пар |')
print('|---|---|')
for k in (16, 32, 48, 64, 96, 128, 192):
    if k > Vt.shape[0]:
        continue
    lat = (Xte[picks] - mean) @ Vt[:k].T
    d_lat = np.linalg.norm(lat[i] - lat[j], axis=1)
    print(f'| {k} | {spearman(d_raw, d_lat):.3f} |')

# Худшие случаи: где именно латент промахивается (k=64).
k_ref = 64
comp = Vt[:k_ref]
lat_te = (Xte - mean) @ comp.T
rec = lat_te @ comp + mean
ang = angles_deg(Xte, rec)
test_meta = [m for m, t in zip(META, is_test) if t]
worst = np.dstack(np.unravel_index(np.argsort(ang.ravel())[-5:][::-1], ang.shape))[0]
print('\nхудшие позы при k=64:')
for p, b in worst:
    print(f"  {test_meta[p]['name'][:34]:34s} {BONES[b]:20s} {ang[p, b]:6.1f}°")


# Время
t0 = time.time()
for _ in range(1000):
    (Xte[0] - mean) @ comp.T
enc_ms = (time.time() - t0) * 1000 / 1000
t0 = time.time()
for _ in range(1000):
    np.linalg.norm(lat_te - lat_te[0], axis=1).argmin()
q_ms = (time.time() - t0) * 1000 / 1000
print(f'кодирование одной позы {enc_ms:.3f} мс, поиск среди {len(lat_te)} поз {q_ms:.2f} мс')

out = stem + f'-latent{k_ref}.npz'
np.savez_compressed(out, mean=mean.astype(np.float32), comp=comp.astype(np.float32),
                    bones=np.array(BONES), core=np.array([BONES[i] for i in core_idx]),
                    rows=np.array([tuple(r.values()) for r in rows], dtype=object),
                    keys=np.array(list(rows[0].keys())))
print(f'\nсохранено {out} ({np.load(out)["comp"].nbytes/1e6:.2f} МБ компонент)')
print('LATENT_OK')
