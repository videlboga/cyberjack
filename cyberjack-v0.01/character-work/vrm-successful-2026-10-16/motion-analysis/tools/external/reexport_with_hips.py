#!/usr/bin/env python3
"""Пересборка выбранных внешних клипов с высотой таза (translations).

Зачем: клипы экспортировались rotation-only, поэтому присед, сидение и лежание
физически не получались — таз оставался на высоте стойки. Здесь тот же билд,
но с `translations` для `cf_j_hips`: вертикальное смещение из исходного BVH,
горизонталь обнулена (окно in-place).

Запуск:
  python3 reexport_with_hips.py --rig <rig.json> --cmu <dir_bvh> --bone-map <map.json> \
      --clips <list.json> --out <out.json>
"""
import argparse
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bvh_metrics as B
from export_pilot_clips import build_clip, CMU, S100, FPS_OUT


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--rig', required=True)
    ap.add_argument('--cmu', default='')
    ap.add_argument('--style100', default='')
    ap.add_argument('--bone-map', required=True)
    ap.add_argument('--clips', required=True, help='json со списком {id, source, dataset, keyword}')
    ap.add_argument('--out', required=True)
    ap.add_argument('--seconds', type=float, default=2.0)
    a = ap.parse_args()

    keep = set(json.load(open(a.bone_map)).keys())
    n_frames = int(a.seconds * FPS_OUT) + 1
    wanted = json.load(open(a.clips))
    out = []

    for item in wanted:
        path = os.path.join(a.cmu, item['source']) if item.get('dataset', 'cmu') == 'cmu' \
            else os.path.join(a.style100, item['source'])
        if not os.path.exists(path):
            print('нет файла', path)
            continue
        total_frames = B.frame_count(path)
        fps_src = 120.0 if item.get('dataset', 'cmu') == 'cmu' else 60.0
        start = int(total_frames * 0.45)
        prep = B.parse(path, window=(start, int(n_frames * fps_src / FPS_OUT) + 8))
        # высота таза в стойке: максимум по всему файлу (для этого субъекта)
        full_j, full_f, _ = B.parse(path)
        hi = B.find(full_j, ['hip'] if item.get('dataset', 'cmu') == 'cmu' else ['Hips'])
        if hi is not None:
            ys = sorted(B.fk(full_j, fr)[hi][0][1] for fr in full_f)
            hips_ref = ys[int(len(ys) * 0.95)]
        else:
            hips_ref = None
        del full_f
        names = CMU if item.get('dataset', 'cmu') == 'cmu' else S100
        clip = build_clip(a.rig, path, names, 0, n_frames, fps_src, {
            'id': item['id'],
            'label': item.get('label', item['id']),
            'source': item.get('source_display', item['source']),
            'provenance': item.get('provenance', {}),
        }, preparsed=prep, hips_ref_cm=hips_ref)
        clip['tracks'] = [t for t in clip['tracks'] if t['bone'] in keep]
        hips = [t for t in clip['tracks'] if t['bone'] == 'cf_j_hips']
        has_tr = bool(hips and hips[0].get('translations'))
        out.append(clip)
        print(f"{clip['id']}: костей {len(clip['tracks'])}, кадров {len(clip['tracks'][0]['times'])}, "
              f"translations таза: {'да' if has_tr else 'НЕТ'}")

    json.dump({'format': 'koikatsu-generic-v1', 'fps': FPS_OUT, 'clips': out},
              open(a.out, 'w'), ensure_ascii=False)
    print('записано', a.out, os.path.getsize(a.out), 'байт')


if __name__ == '__main__':
    main()
