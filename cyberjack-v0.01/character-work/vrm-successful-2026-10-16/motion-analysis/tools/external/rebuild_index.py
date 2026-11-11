#!/usr/bin/env python3
"""Пересборка index.jsonl и manifest.json для внешней библиотеки.

Нужна, когда клипы правились без полного билда (например, CMU пересобран с высотой таза):
индекс и манифест должны считаться из фактических клипов, а не из прошлого прогона.

Запуск: python3 rebuild_index.py --library ../external-library-hips --rig <rig.json>
"""
import argparse
import hashlib
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_external_library import clip_metrics


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--library', required=True)
    ap.add_argument('--rig', required=True)
    a = ap.parse_args()

    clips_dir = os.path.join(a.library, 'clips')
    rows, counts, per_dataset = [], {'total': 0, 'byDataset': {}, 'byMovement': {}, 'byKeyword': {}}, {}
    for fname in sorted(os.listdir(clips_dir)):
        if not fname.endswith('.json'):
            continue
        doc = json.load(open(os.path.join(clips_dir, fname)))
        clips = doc.get('clips', [])
        ds = clips[0].get('dataset', fname[:-5]) if clips else fname[:-5]
        per_dataset[ds] = len(clips)
        counts['byDataset'][ds] = len(clips)
        counts['total'] += len(clips)

        for c in clips:
            tags = c.get('tags') or {}
            prov = c.get('provenance') or {}
            row = {'id': c['id'], 'label': c['label'], 'dataset': ds}
            if ds == '100style':
                row.update({'style': tags.get('style'), 'movement': tags.get('movement'),
                            'transition': tags.get('transition', False),
                            'license': 'CC BY 4.0', 'commercial': True})
                counts['byMovement'][tags.get('movement')] = counts['byMovement'].get(tags.get('movement'), 0) + 1
            else:
                row.update({'keyword': tags.get('keyword'), 'motion': tags.get('motion'),
                            'transition': False, 'license': 'CMU / AFL-3.0', 'commercial': True})
                counts['byKeyword'][tags.get('keyword')] = counts['byKeyword'].get(tags.get('keyword'), 0) + 1
            try:
                row.update(clip_metrics(a.rig, c))
            except Exception as err:
                row['metricsError'] = str(err)
            rows.append(row)

    with open(os.path.join(a.library, 'index.jsonl'), 'w') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

    first = json.load(open(os.path.join(clips_dir, sorted(os.listdir(clips_dir))[0])))
    manifest = {
        'format': 'external-motion-library-v1',
        'created': time.strftime('%Y-%m-%dT%H:%M:%S'),
        'script': 'build_external_library.py + rebuild_index.py',
        'counts': counts,
        'clip': {'fps': 30, 'frames': len(first['clips'][0]['tracks'][0]['times']),
                 'duration': first['clips'][0]['duration'], 'bones': len(first['clips'][0]['tracks']),
                 'kind': 'base', 'rig': 'female', 'positions': 'вертикаль таза (translations cf_j_hips), горизонталь 0 — in-place'},
        'transfer': 'world_target = world_source (mirror X), local = rest · (rest⁻¹ · parent_world⁻¹ · world_src); таз: ty = (hipY − опора) · 1.076/опора, опора = 95-й процентиль по файлу',
    }
    json.dump(manifest, open(os.path.join(a.library, 'manifest.json'), 'w'), ensure_ascii=False, indent=1)
    print(f'индекс: {len(rows)} строк · манифест: {counts["total"]} клипов · {per_dataset}')
    with_hips = sum(1 for f in os.listdir(clips_dir) if f.endswith('.json')
                    for c in json.load(open(os.path.join(clips_dir, f)))['clips']
                    if any(t['bone'] == 'cf_j_hips' and t.get('translations') for t in c['tracks']))
    print(f'с высотой таза: {with_hips} из {counts["total"]}')


if __name__ == '__main__':
    main()
