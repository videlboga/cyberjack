#!/usr/bin/env python3
"""HKX (Skyrim SE) → JSON-клипы для нашего конвейера.

Читает анимации через чистый Python-парсер PyNifly (anim_fo4.py — он же разбирает
hk_2014-пакеты SSE), складывает треки в наш формат: fps 30, кадры по порядку,
кватернионы xyzw.

Кости пока подписаны индексами (`bone_012`) — имена появятся, когда будет таблица
«индекс трека → имя кости» из skeleton.hkx (в архивах скелет персонажа не лежит).

Запуск:
  python3 hkx_to_clip.py --in /tmp/skyrim_in --out motion-analysis/skyrim-clips.json
  python3 hkx_to_clip.py --in <каталог> --out out.json --limit 20 --min-frames 5
"""
import argparse
import glob
import json
import os
import sys
import time

ADDON = os.path.expanduser('~/.config/blender/4.2/scripts/addons/io_scene_nifly/hkx')
sys.path.insert(0, ADDON)

try:
    from anim_fo4 import load_animation  # type: ignore
except Exception:
    load_animation = None

FPS = 30


def find_parser():
    """в разных версиях PyNifly точка входа называется по-разному"""
    import anim_fo4
    for name in ('load_fo4_animation', 'load_animation', 'read_animation', 'parse_animation'):
        fn = getattr(anim_fo4, name, None)
        if callable(fn):
            return fn
    return None


def parse_one(path):
    import anim_fo4
    fn = find_parser()
    if fn is None:
        # запасной путь: модуль сам умеет печатать, но нам нужны данные —
        # берём самый общий вход: main-подобную функцию с возвратом AnimationData
        for name in dir(anim_fo4):
            if name.startswith('_'):
                continue
            obj = getattr(anim_fo4, name)
            if callable(obj) and 'anim' in name.lower():
                try:
                    data = obj(path)
                except Exception:
                    continue
                if data is not None and hasattr(data, 'num_frames'):
                    return data
        return None
    return fn(path)


def to_clip(path, data, rel):
    frames = int(getattr(data, 'num_frames', 0))
    fps = float(getattr(data, 'frame_rate', 30.0) or 30.0)
    tracks_in = getattr(data, 'tracks', None) or []
    tracks = []
    for idx, tr in enumerate(tracks_in):
        rots = getattr(tr, 'rotations', None) or []
        if not rots:
            continue
        flat = []
        static = True
        for q in rots:
            flat.extend([float(q[0]), float(q[1]), float(q[2]), float(q[3])])
            if abs(q[0]) > 1e-4 or abs(q[1]) > 1e-4 or abs(q[2]) > 1e-4 or abs(abs(q[3]) - 1) > 1e-4:
                static = False
        if static:          # неподвижные треки не тащим — 128 костей на клип иначе раздувают файл
            continue
        tracks.append({'bone': f'bone_{idx:03d}', 'rotations': flat})
    if not tracks:
        return None
    return {
        'id': 'skyrim-' + os.path.splitext(os.path.basename(path))[0].lower().replace(' ', '-'),
        'name': os.path.basename(path),
        'source': os.path.relpath(path, start=os.path.commonpath([path])) if False else path,
        'fps': round(1.0 / float(getattr(data, 'frame_duration', 1 / 30)) if getattr(data, 'frame_duration', 0) else fps, 3),
        'duration': round(frames / fps, 5) if fps else 0.0,
        'frames': frames,
        'kind': 'base',
        'category': 'external',
        'dataset': 'skyrim-kziitd',
        'tracks': tracks,
        'tags': {'motion': 'bondage', 'origin': 'skyrim-se'},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--in', dest='src', required=True)
    ap.add_argument('--out', required=True)
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--min-frames', type=int, default=10)
    a = ap.parse_args()

    if find_parser() is None and load_animation is None:
        print('не нашёл функцию разбора в anim_fo4.py — проверьте версию PyNifly')
        return 1

    files = []
    if os.path.isdir(a.src):
        for root, _, fs in os.walk(a.src):
            for f in fs:
                if f.lower().endswith('.hkx'):
                    files.append(os.path.join(root, f))
    else:
        files = [a.src]
    files.sort()
    if a.limit:
        files = files[:a.limit]

    clips, failed, t0 = [], 0, time.time()
    for i, path in enumerate(files, 1):
        try:
            data = parse_one(path)
        except Exception:
            data = None
        if data is None:
            failed += 1
            continue
        clip = to_clip(path, data, a.src)
        if clip and clip['frames'] >= a.min_frames:
            clips.append(clip)
        elif clip:
            failed += 1
        if i % 20 == 0:
            print(f'  {i}/{len(files)} · клипов {len(clips)} · не разобрано {failed}', flush=True)

    doc = {
        'format': 'cyberjack-external-clips/1',
        'coordinateSpace': 'skyrim-se/hk_2014 (индексы треков, имена не сопоставлены)',
        'notes': 'Источник: Kziitd Fetish Toolset / TortureDevices (Skyrim SE). '
                 'Кости подписаны индексами: таблица «индекс → имя» снимается со skeleton.hkx.',
        'clips': clips,
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, 'w') as f:
        json.dump(doc, f, ensure_ascii=False)
    dt = time.time() - t0
    size = os.path.getsize(a.out) / 1e6
    print(f'\nготово: {len(clips)} клипов · не разобрано {failed} · {dt:.0f} с · {size:.1f} МБ')
    if clips:
        c = clips[0]
        print(f'пример: {c["name"]} — {c["duration"]} с, {c["frames"]} кадров, {c["fps"]} fps,'
              f' треков {len(c["tracks"])}')
    print('файл:', a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
