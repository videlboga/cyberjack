#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Честная стоимость поиска: латент + точная доводка против полного перебора.

Считаем так, как это делается в рантайме: без промежуточных копий,
через скалярное произведение (‖a−b‖² = ‖a‖²+‖b‖²−2ab).

    python3 tools/dataset/latent-speed.py data/dataset/poses-reps 64
"""
import json, sys, time
import numpy as np

stem = sys.argv[1] if len(sys.argv) > 1 else 'data/dataset/poses-reps'
K = int(sys.argv[2]) if len(sys.argv) > 2 else 64
head = json.load(open(stem + '.json'))
poses = np.fromfile(stem + '.bin', dtype=np.float32).reshape(head['poses'], len(head['bones']), 4)
BONES = head['bones']
N, B, _ = poses.shape
X = poses.reshape(N, B * 4).astype(np.float32)
model = np.load(stem + f'-latent{K}.npz', allow_pickle=True)
mean, comp = model['mean'].astype(np.float32), model['comp'].astype(np.float32)
core = list(model['core'])
core_idx = np.array([BONES.index(b) for b in core])
lat = (X - mean) @ comp.T
lat_sq = (lat * lat).sum(1)
unit = X.reshape(N, B, 4)[:, core_idx]           # только тело — «точная» метрика

rng = np.random.default_rng(3)
Q = 200
queries = rng.choice(N, Q, replace=False)


def bench(fn, rounds=Q):
    t0 = time.perf_counter()
    for q in queries[:rounds]:
        fn(q)
    return (time.perf_counter() - t0) * 1000 / rounds


# 1. Латентный отбор среди всех поз
def latent_top(q, n=100):
    d = lat_sq + lat_sq[q] - 2 * (lat @ lat[q])
    return np.argpartition(d, n)[:n]


# 2. Точное расстояние по телу среди всех поз (полный перебор)
def exact_all(q, n=10):
    dot = np.clip(np.abs((unit * unit[q]).sum(-1)), 0, 1)
    ang = 2 * np.arccos(dot).mean(axis=1)
    return np.argpartition(ang, n)[:n]


# 3. Точная доводка только по кандидатам
def exact_among(q, cand):
    sub = unit[cand]
    dot = np.clip(np.abs((sub * unit[q]).sum(-1)), 0, 1)
    ang = 2 * np.arccos(dot).mean(axis=1)
    return cand[np.argsort(ang)]


t_lat = bench(latent_top, 5)   # прогрев страниц и кэшей
t_exact = bench(exact_all, 5)
t_lat = bench(latent_top)
t_exact = bench(exact_all)
t_hyb = bench(lambda q: exact_among(q, latent_top(q, 100)))
print(f'поз {N}, латент {K}')
print(f'  латентный отбор 100 из {N}: {t_lat:.2f} мс')
print(f'  полный точный перебор:      {t_exact:.2f} мс')
print(f'  латент + доводка 100:        {t_hyb:.2f} мс (ускорение {t_exact/t_hyb:.1f}×)')
print(f'  для 161 077 кадров пересчёт: латент ≈ {t_lat*161077/N:.1f} мс, перебор ≈ {t_exact*161077/N:.1f} мс')
print(f'  размер: латент float32 {161077*K*4/1e6:.0f} МБ, int8 {161077*K/1e6:.0f} МБ; индекс сейчас 281 МБ JSON')
print('SPEED_OK')
