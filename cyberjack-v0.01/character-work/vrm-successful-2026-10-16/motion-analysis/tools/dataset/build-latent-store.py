#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Латент позы → один бинарник int8 для рантайма (без JSON на старте).

Внутри: шапка (JSON) + среднее + компоненты + масштабы + таблица «поза → клип/кадр» + коды int8.
Координаты уже умножены на веса метрики, поэтому читателю не нужны ни веса, ни PCA:
поиск — обычное евклидово расстояние по int8.

    python3 tools/dataset/build-latent-store.py data/dataset/poses-reps 64

Формат (little-endian):
    0  4  'PZL1'
    4  4  длина шапки, u32
    8  h  шапка, JSON utf-8
    ...   mean  : f32 × (кость×4)
    ...   comp  : f32 × k × (кость×4)
    ...   scale : f32 × k
    ...   table : u16 клип, u16 кадр   (по 4 байта на позу)
    ...   codes : i8  × поз × k
"""
import json, sys, time
import numpy as np

stem = sys.argv[1] if len(sys.argv) > 1 else 'data/dataset/poses-reps'
K = int(sys.argv[2]) if len(sys.argv) > 2 else 64
# третий аргумент — разрядность: int16 (по умолчанию) или int8
head = json.load(open(stem + '.json'))
poses = np.fromfile(stem + '.bin', dtype=np.float32).reshape(head['poses'], len(head['bones']), 4)
BONES, META = head['bones'], head['meta']
N, B, _ = poses.shape
X = poses.reshape(N, B * 4).astype(np.float32)

model = np.load(stem + f'-latent{K}.npz', allow_pickle=True)
mean = model['mean'].astype(np.float32)
comp = model['comp'].astype(np.float32)
core = list(model['core'])
core_idx = np.array([BONES.index(b) for b in core])

try:
    w = np.load(stem + f'-metric{K}.npz')['w'].astype(np.float32)
    metric = 'learned-diagonal'
except FileNotFoundError:
    w = np.ones(K, dtype=np.float32)
    metric = 'pca-euclid'
Z = (X - mean) @ comp.T * np.sqrt(w)          # координаты уже в метрике

# Квантование по осям с отсечкой 99.9%: выбросы не должны съедать весь диапазон.
scales = np.percentile(np.abs(Z), 99.9, axis=0).astype(np.float32)
scales[scales < 1e-6] = 1e-6
codes = np.clip(np.round(Z / scales), -127, 127).astype(np.int8)
Zq = codes.astype(np.float32) * scales
clipped = float((np.abs(Z / scales) > 127).mean())

# int16 по тем же осям: в 256 раз точнее, в 2 раза больше.
codes16 = np.clip(np.round(Z / scales * 256.0), -32767, 32767).astype(np.int16)
Zq16 = codes16.astype(np.float32) * (scales / 256.0)

err_axis = np.abs(Zq - Z)
print(f'поз {N}, латент {K}, метрика {metric}')
print(f'ошибка квантования по осям: int8 средняя {err_axis.mean():.4f}, p99 {np.percentile(err_axis, 99):.4f}, '
      f'отсечено {clipped*100:.4f}%; int16 средняя {np.abs(Zq16-Z).mean():.5f}')

# Проверка: те же запросы, ответы float32 против int8/int16 при разных размерах пула.
unit = X.reshape(N, B, 4)[:, core_idx]


def exact_top(q, n=10):
    d = np.degrees(2 * np.arccos(np.clip(np.abs((unit * unit[q]).sum(-1)), 0, 1))).mean(axis=1)
    return np.argsort(d)[1:n + 1]


rng = np.random.default_rng(31)
queries = rng.choice(N, size=200, replace=False)
sq32, sq8, sq16 = (Z * Z).sum(1), (Zq * Zq).sum(1), (Zq16 * Zq16).sum(1)
for name, codes_m, sq in (('float32', Z, sq32), ('int8', Zq, sq8), ('int16', Zq16, sq16)):
    line = []
    for pool in (100, 200, 500):
        hit = 0
        for q in queries:
            truth = set(exact_top(q).tolist())
            cand = set(np.argpartition(sq + sq[q] - 2 * (codes_m @ codes_m[q]), pool)[:pool].tolist())
            hit += len(truth & cand) == 10
        line.append(f'{pool}:{hit / len(queries) * 100:.1f}%')
    print(f'точный топ-10 внутри пула — {name}: ' + '  '.join(line))


# Клипы и кадры: позиция позы → клип и номер кадра, без 4,7 МБ JSON.
clips = [m['id'] for m in META]
seen = {}
for m in META:
    seen.setdefault(m['id'], 0)
clip_list = list(dict.fromkeys(clips))
clip_idx = {c: i for i, c in enumerate(clip_list)}
counts = [0] * len(clip_list)
table = np.zeros((N, 2), dtype=np.uint16)
fno = {}
for i, m in enumerate(META):
    ci = clip_idx[m['id']]
    table[i] = (ci, fno.get(m['id'], 0))
    fno[m['id']] = fno.get(m['id'], 0) + 1
    counts[ci] += 1
assert max(counts) < 65535 and len(clip_list) < 65535

# Выбор разрядности. Замер выше: int8 теряет ранжирование (71% вместо 99% при пуле 100),
# int16 даёт ровно те же ответы, что float32, за вдвое больший размер. По умолчанию int16.
DTYPE = sys.argv[3] if len(sys.argv) > 3 else 'int16'
if DTYPE == 'int8':
    store_codes, mul, np_dtype, label = codes, 1.0, np.int8, 'int8'
else:
    store_codes, mul, np_dtype, label = codes16, 256.0, np.int16, 'int16'

meta = {
    'format': 'pose-latent-quant-v1', 'k': K, 'bones': BONES, 'core': core, 'metric': metric,
    'dtype': label, 'mul': mul, 'weights': w.tolist(),   # нужны, чтобы кодировать запрос той же метрикой
    'bonesCount': len(BONES), 'poses': N, 'clips': clip_list, 'clipFrames': counts,
    'clipsMeta': {m['id']: {'name': m['name'], 'duration': m['duration']} for m in META[::max(1, N // 2000)]},
    'scales': scales.tolist(), 'clipped': clipped,
    'source': {'dataset': stem.split('/')[-1], 'latent': f'latent{K}', 'metric': metric},
}
hb = json.dumps(meta, ensure_ascii=False, separators=(',', ':')).encode()
hb += b' ' * ((4 - len(hb) % 4) % 4)   # выравнивание: иначе читатель не сможет взять типизированное представление
out = stem + '.pzl'
with open(out, 'wb') as f:
    f.write(b'PZL1')
    f.write(np.uint32(len(hb)).tobytes())
    f.write(hb)
    f.write(mean.astype('<f4').tobytes())
    f.write(comp.astype('<f4').tobytes())
    f.write(scales.astype('<f4').tobytes())
    f.write(table.astype('<u2').tobytes())
    f.write(store_codes.astype('<i2' if label == 'int16' else '<i1').tobytes())
size = 8 + len(hb) + mean.nbytes + comp.nbytes + scales.nbytes + table.nbytes + store_codes.nbytes
print(f'сохранено {out} ({label}): {size/1e6:.2f} МБ '
      f'(шапка {len(hb)/1024:.0f} КБ, компоненты {comp.nbytes/1e6:.2f} МБ, коды {store_codes.nbytes/1e6:.2f} МБ)')
print(f'на 161 077 кадров коды {label} составят {161077*K*(2 if label == "int16" else 1)/1e6:.1f} МБ '
      f'вместо 281 МБ JSON')
print('STORE_OK')
