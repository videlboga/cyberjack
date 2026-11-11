#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Хранилище латента поверх ПОЛНОЙ библиотеки, из шардов, без промежуточной склейки.

Диск занят на 99%, поэтому 1,7 ГБ объединённого `.bin` не создаём: читаем шарды
порциями, кодируем и пишем коды сразу в итоговый файл.

База латента берётся из дедуп-набора (`poses-reps-latent64.npz`), проверенная ранее;
здесь она применяется к 117 375 клипам и на выборке измеряется ошибка реконструкции —
то есть проверяется, что база не «сломалась» на хвосте библиотеки.

    python3 tools/dataset/build-store-full.py data/dataset/poses-reps data/dataset/poses-all 8
"""
import json, sys, time
import numpy as np

stem_reps = sys.argv[1] if len(sys.argv) > 1 else 'data/dataset/poses-reps'
prefix = sys.argv[2] if len(sys.argv) > 2 else 'data/dataset/poses-all'
SHARDS = int(sys.argv[3]) if len(sys.argv) > 3 else 8
K = int(sys.argv[4]) if len(sys.argv) > 4 else 64
CHUNK = 20000

model = np.load(stem_reps + f'-latent{K}.npz', allow_pickle=True)
mean = model['mean'].astype(np.float32)
comp = model['comp'].astype(np.float32)
core = list(model['core'])
try:
    w = np.load(stem_reps + f'-metric{K}.npz')['w'].astype(np.float32)
    metric = 'learned-diagonal'
except FileNotFoundError:
    w = np.ones(K, dtype=np.float32)
    metric = 'pca-euclid'
root = np.sqrt(w)

heads, total, bones = [], 0, None
for i in range(SHARDS):
    h = json.load(open(f'{prefix}-{i}.json'))
    heads.append(h)
    total += h['poses']
    bones = bones or h['bones']
    assert h['bones'] == bones
B = len(bones)
print(f'шардов {SHARDS}, поз {total}, костей {B}, латент {K}, метрика {metric}')
core_idx = np.array([bones.index(b) for b in core])


def shard_poses(i):
    h = heads[i]
    raw = np.memmap(f'{prefix}-{i}.bin', dtype=np.float32, mode='r')
    return raw.reshape(h['poses'], B, 4)


def encode(batch):
    """батч (n, B, 4) → координаты в метрике (n, K)."""
    X = batch.reshape(len(batch), B * 4)
    return ((X - mean) @ comp.T) * root


# ---- проход 1: масштабы квантования и проверка ошибки на выборке полной библиотеки
rng = np.random.default_rng(5)
sample = []
for i in range(SHARDS):
    p = shard_poses(i)
    n = len(p)
    take = rng.choice(n, size=min(n, 25000 // SHARDS + 500), replace=False)
    sample.append(np.asarray(p[take]))
sample = np.concatenate(sample)
Z = encode(sample)
scales = np.percentile(np.abs(Z), 99.9, axis=0).astype(np.float32)
scales[scales < 1e-6] = 1e-6
codes = np.clip(np.round(Z / scales * 256.0), -32767, 32767).astype(np.int16)
Zq = codes.astype(np.float32) * (scales / 256.0)


def angles(orig, rec):
    a = orig.reshape(-1, B, 4); b = rec.reshape(-1, B, 4)
    b = b / np.maximum(np.linalg.norm(b, axis=2, keepdims=True), 1e-9)
    dot = np.clip(np.abs((a * b).sum(axis=2)), 0, 1)
    return 2.0 * np.degrees(np.arccos(dot))


# обратно: координаты умножены на sqrt(w), поэтому перед восстановлением делим
# веса метрики могут быть нулевыми, поэтому делим безопасно: это только проверка
rec = (Zq / np.maximum(root, 1e-3)) @ comp + mean
ang = angles(sample, rec)
print(f'проверка на {len(sample)} позах полной библиотеки: '
      f'тело сред {ang[:, core_idx].mean():.2f}°, p95 {np.percentile(ang[:, core_idx], 95):.2f}°, '
      f'все сред {ang.mean():.2f}°')

# ---- проход 2: кодируем всё и пишем готовый файл
clips, clip_frames, clip_meta = [], [], {}
clip_index = {}          # id клипа → глобальный номер; локальные номера внутри шарда не годятся
table_clip = np.zeros(total, dtype=np.uint32)   # клипов 117 375 — u16 не хватает
frame_of = np.zeros(total, dtype=np.uint16)
codes_all = np.zeros((total, K), dtype=np.int16)
off = 0
t0 = time.time()
for i in range(SHARDS):
    h, p = heads[i], shard_poses(i)
    for j, m in enumerate(h['meta']):
        if m['id'] not in clip_index:
            clip_index[m['id']] = len(clips)
            clips.append(m['id'])
            clip_frames.append(0)
            clip_meta[m['id']] = {'name': m['name'], 'duration': m['duration']}
        ci = clip_index[m['id']]
        table_clip[off + j] = ci
        frame_of[off + j] = clip_frames[ci]
        clip_frames[ci] += 1
    for s in range(0, len(p), CHUNK):
        batch = np.asarray(p[s:s + CHUNK])
        Zc = encode(batch)
        codes_all[off + s:off + s + len(batch)] = np.clip(np.round(Zc / scales * 256.0), -32767, 32767)
    off += len(p)
    print(f'  шард {i}: {len(p)} поз, {len(clips)} клипов всего, {time.time()-t0:.0f} с', flush=True)

assert off == total and max(clip_frames) < 65535
meta = {
    'format': 'pose-latent-quant-v1', 'k': K, 'bones': bones, 'core': core, 'metric': metric,
    'dtype': 'int16', 'mul': 256.0, 'weights': w.tolist(),
    'bonesCount': B, 'poses': total, 'clips': clips, 'clipFrames': clip_frames,
    'table': 'u32+u16',
    'clipsMeta': clip_meta, 'scales': scales.tolist(), 'clipped': 0.0,
    'source': {'dataset': prefix, 'latent': f'latent{K}', 'metric': metric, 'basis': stem_reps},
}
hb = json.dumps(meta, ensure_ascii=False, separators=(',', ':')).encode()
hb += b' ' * ((4 - len(hb) % 4) % 4)
out = prefix + '.pzl'
with open(out, 'wb') as f:
    f.write(b'PZL1')
    f.write(np.uint32(len(hb)).tobytes())
    f.write(hb)
    f.write(mean.astype('<f4').tobytes())
    f.write(comp.astype('<f4').tobytes())
    f.write(scales.astype('<f4').tobytes())
    f.write(table_clip.astype('<u4').tobytes())
    f.write(frame_of.astype('<u2').tobytes())
    f.write(codes_all.astype('<i2').tobytes())
size = 8 + len(hb) + mean.nbytes + comp.nbytes + scales.nbytes + table_clip.nbytes + frame_of.nbytes + codes_all.nbytes
print(f'сохранено {out}: {size/1e6:.1f} МБ (шапка {len(hb)/1e6:.2f} МБ, коды {codes_all.nbytes/1e6:.1f} МБ), '
      f'клипов {len(clips)}, поз {total}')
print('FULL_STORE_OK')
