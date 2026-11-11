#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Обучаемая метрика поверх латента: PCA + веса по осям (диагональный Махаланобис).

PCA сохраняет позу, но не расстояние (Spearman 0.70). Здесь веса осей подбираются
под настоящую метрику — средний угол по 22 суставам тела. Это не «ещё одна сеть»:
решение линейное по квадратам разностей, значит стоимость поиска не меняется,
а объяснимость остаётся (у каждой оси есть вес).

    python3 tools/dataset/learn-metric.py data/dataset/poses-reps 64
"""
import json, sys, time, hashlib
import numpy as np
from scipy.optimize import nnls

stem = sys.argv[1] if len(sys.argv) > 1 else 'data/dataset/poses-reps'
K = int(sys.argv[2]) if len(sys.argv) > 2 else 64
head = json.load(open(stem + '.json'))
poses = np.fromfile(stem + '.bin', dtype=np.float32).reshape(head['poses'], len(head['bones']), 4)
BONES, META = head['bones'], head['meta']
N, B, _ = poses.shape
X = poses.reshape(N, B * 4).astype(np.float64)
model = np.load(stem + f'-latent{K}.npz', allow_pickle=True)
mean, comp = model['mean'].astype(np.float64), model['comp'].astype(np.float64)
core = list(model['core'])
core_idx = np.array([BONES.index(b) for b in core])
Z = (X - mean) @ comp.T
unit = X.reshape(N, B, 4)[:, core_idx]


def bucket(cid):
    return int(hashlib.sha256(cid.encode()).hexdigest()[:8], 16) % 100


clip_ids = sorted({m['id'] for m in META})
test_clips = {c for c in clip_ids if bucket(c) < 15}
is_test = np.array([m['id'] in test_clips for m in META])
tr = np.where(~is_test)[0]
te = np.where(is_test)[0]
print(f'поз {N}, латент {K}, train {len(tr)}, test {len(te)}')


def core_dist(a, b):
    """Средний угол по суставам тела, градусы, для пар индексов."""
    dot = np.clip(np.abs((unit[a] * unit[b]).sum(-1)), 0.0, 1.0)
    return 2.0 * np.degrees(np.arccos(dot)).mean(axis=1)


def build_pairs(idx, anchors=1200, near=8, far=8, rng=None):
    """Пары для обучения: ближние (важны для ранжирования) и случайные (для масштаба)."""
    rng = rng or np.random.default_rng(5)
    z = Z[idx]
    zz = (z * z).sum(1)
    a, b = [], []
    for q in rng.choice(len(idx), size=min(anchors, len(idx)), replace=False):
        d = zz + zz[q] - 2 * (z @ z[q])
        order = np.argpartition(d, near + 3)[:near + 3]
        for j in order[1:near + 1]:
            a.append(idx[q]); b.append(idx[j])
        for j in rng.choice(len(idx), size=far, replace=False):
            if j != q:
                a.append(idx[q]); b.append(idx[j])
    return np.array(a), np.array(b)


t0 = time.time()
ta, tb = build_pairs(tr, rng=np.random.default_rng(5))
print(f'пар обучения {len(ta)} ({time.time()-t0:.0f} с)')
D = np.abs(Z[ta] - Z[tb]) ** 2          # признаки: квадраты разностей по осям
y = core_dist(ta, tb)
# Масштаб: без него NNLS уйдёт в ноль по всем осям, кроме одной.
y /= y.mean()
w, resid = nnls(D, y, maxiter=K * 200)
w *= 1.0 / max(1e-9, np.median(D @ w))
print(f'веса: max {w.max():.3f}, медиана {np.median(w):.3f}, осей с весом >1% от max: '
      f'{int((w > 0.01 * w.max()).sum())}/{K}')

# Оценка на тесте: те же типы пар, но из клипов, которых не было в обучении.
ea, eb = build_pairs(te, rng=np.random.default_rng(17))
y_te = core_dist(ea, eb)
d_base = np.linalg.norm(Z[ea] - Z[eb], axis=1)
d_learn = np.sqrt(np.abs(Z[ea] - Z[eb]) ** 2 @ w)


def spearman(x, y):
    rx = np.argsort(np.argsort(x)).astype(float)
    ry = np.argsort(np.argsort(y)).astype(float)
    rx -= rx.mean(); ry -= ry.mean()
    return float((rx @ ry) / np.sqrt((rx @ rx) * (ry @ ry)))


print(f'\nSpearman на тесте, {len(ea)} пар: PCA {spearman(d_base, y_te):.3f} → '
      f'с весами {spearman(d_learn, y_te):.3f}')
print(f'средняя ошибка расстояния: PCA {np.abs(d_base - y_te).mean():.1f}° → '
      f'с весами {np.abs(d_learn * (y_te.mean() / max(d_learn.mean(), 1e-9)) - y_te).mean():.1f}° (в шкале градусов)')

# Recall с весами: настоящий топ-10 внутри 100 кандидатов.
rng = np.random.default_rng(23)
queries = rng.choice(te, size=150, replace=False)
zw = Z * np.sqrt(w)
zw_sq = (zw * zw).sum(1)
for mult in (1, 2, 5, 10):
    cand = 10 * mult
    hits = 0
    for q in queries:
        d = np.degrees(2 * np.arccos(np.clip(np.abs((unit * unit[q]).sum(-1)), 0, 1))).mean(axis=1)
        truth = set(np.argsort(d)[1:11].tolist())
        dl = zw_sq + zw_sq[q] - 2 * (zw @ zw[q])
        pool = set(np.argpartition(dl, cand)[:cand].tolist())
        hits += len(truth & pool)
    print(f'  recall@10 при {cand} кандидатах: {hits / (10 * len(queries)):.3f}')

np.savez_compressed(stem + f'-metric{K}.npz', w=w.astype(np.float32), k=K,
                    spearman_base=spearman(d_base, y_te), spearman_learned=spearman(d_learn, y_te))
print(f'\nсохранено {stem}-metric{K}.npz')
print('METRIC_OK')
