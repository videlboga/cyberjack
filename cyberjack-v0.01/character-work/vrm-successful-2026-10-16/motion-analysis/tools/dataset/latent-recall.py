#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Годится ли латент как предварительный отбор (pruning) вместо перебора.

Меряем не «похожесть», а recall: сколько из настоящих ближайших соседей
(точное угловое расстояние по телу) попало в кандидаты, отобранные латентом.
Если recall высокий, индекс можно заменить на «латент + точная доводка».

    python3 tools/dataset/latent-recall.py data/dataset/poses-reps 64
"""
import json, sys, time
import numpy as np

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
lat = (X - mean) @ comp.T
print(f'поз {N}, латент {K}, тело {len(core)} костей, файл латента {lat.nbytes/1e6:.1f} МБ (float32)')

rng = np.random.default_rng(11)
queries = rng.choice(N, size=200, replace=False)
coreq = X.reshape(-1, B, 4)[:, core_idx]

for want in (1, 5, 10):
    line = []
    for mult in (10, 20, 50):
        cand = want * mult
        hits = 0; total = 0
        for q in queries:
            d = np.degrees(2 * np.arccos(np.clip(np.abs((coreq * coreq[q]).sum(-1)), 0, 1))).mean(axis=1)
            truth = set(np.argsort(d)[1:want + 1].tolist())
            dlat = np.linalg.norm(lat - lat[q], axis=1)
            pool = set(np.argsort(dlat)[1:cand + 1].tolist())
            hits += len(truth & pool); total += want
        line.append(f'{mult}×:{hits/total:.3f}')
    print(f'  настоящий топ-{want}: recall при кандидатах ' + '  '.join(line))

# Время: полный перебор против отбора
t0 = time.time()
for q in queries[:50]:
    np.linalg.norm(lat - lat[q], axis=1).argpartition(50)[:50]
lat_ms = (time.time() - t0) * 1000 / 50
t0 = time.time()
for q in queries[:50]:
    np.degrees(2 * np.arccos(np.clip(np.abs((coreq * coreq[q]).sum(-1)), 0, 1))).mean(axis=1).argsort()[:10]
exact_ms = (time.time() - t0) * 1000 / 50
print(f'\nотбор латентом {lat_ms:.1f} мс, точная доводка всех {exact_ms:.1f} мс на {N} поз '
      f'(отношение {exact_ms/max(lat_ms,1e-6):.1f}×)')
print(f'прогноз полного индекса 161 077 кадров: латент {161077*K*4/1e6:.0f} МБ float32, {161077*K/1e6:.0f} МБ int8')
print('RECALL_OK')
