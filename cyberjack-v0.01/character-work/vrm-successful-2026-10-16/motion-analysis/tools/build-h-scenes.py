#!/usr/bin/env python3
"""Каталог сцен: одна строка на сцену, с ролями, позицией и списком слоёв.

Зачем: клип в H-корпусе — слой, который играется поверх позиции (медиана 134 сцены на клип).
Из-за этого поиск «мастурбация» по клипам схлопывается: одна и та же анимация используется
в 16 разных сценах мастурбации, и различает их сцена, а не клип.

Здесь различение вынесено на уровень сцены: место, позиция, кто/кому, и какие слои играют.

Запуск: python3 build-h-scenes.py [--out ../data/h-scenes.jsonl]
"""
import argparse
import collections
import gzip
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'motion-analysis/tools'))
from h_positions import position_of, POSITION_TO_POSTURE
from h_describe import from_scene, translate_scene, RU_PLACE, RU_ACTOR, PHASE_MOTION


def phase_of(name):
    for p in ('InsertIdle', 'Insert', 'SLoop1', 'SLoop2', 'SLoop', 'WLoop1', 'WLoop2', 'WLoop',
              'MLoop1', 'MLoop2', 'OLoop', 'OUT', 'Idle', 'Loop', 'Start', 'Stop', 'Drop', 'Pull',
              'Orgasm', 'Dislike'):
        if p in name:
            return p
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'motion-analysis/data/h-scenes.jsonl'))
    a = ap.parse_args()

    scenes = json.load(open(os.path.join(ROOT, 'motion-analysis/data/hscene-table.json')))
    ctrls = json.load(open(os.path.join(ROOT, 'animation-links/controllers.json')))
    ctrl_clips = {}
    for c in ctrls['controllers']:
        p = os.path.join(ROOT, 'animation-links', c['asset'])
        if not os.path.exists(p):
            continue
        ctrl_clips[c['name']] = [x['name'] for x in json.load(gzip.open(p, 'rt')).get('clips', []) if x.get('name')]

    rows = []
    for s in scenes:
        roles = from_scene(s['name'])
        pos = position_of(s['name'])
        clips = []
        for side in ('female_ctrl', 'male_ctrl'):
            for name in ctrl_clips.get(s.get(side) or '', []):
                ph = phase_of(name)
                clips.append({'name': name, 'phase': ph, 'side': 'female' if side == 'female_ctrl' else 'male',
                              'motion': PHASE_MOTION.get(ph or '')})
        # уникальные имена, чтобы не дублировать одинаковые слои у разных сторон
        uniq = {}
        for c in clips:
            uniq.setdefault(c['name'], c)
        parts = [translate_scene(s['name'])]
        if roles.get('actor'):
            parts.append(RU_ACTOR.get(roles['actor'], roles['actor']))
        if roles.get('place'):
            parts.append(RU_PLACE.get(roles['place'], roles['place']))
        if pos:
            parts.append('позиция: ' + pos)
        rows.append({
            'id': f"{s.get('bundle_file', '')}:{s.get('mode')}:{s.get('id')}",
            'nameJa': s['name'],
            'nameRu': translate_scene(s['name']),
            'description': ', '.join(x for x in parts if x),
            'position': pos,
            'posture': POSITION_TO_POSTURE.get(pos or ''),
            'place': roles.get('place'),
            'actor': roles.get('actor'),
            'receiver': roles.get('receiver'),
            'categories': s.get('categories'),
            'useDesk': s.get('useDesk'), 'useChair': s.get('useChair'),
            'femaleCtrl': s.get('female_ctrl'), 'maleCtrl': s.get('male_ctrl'),
            'clips': list(uniq.values()),
            'clipCount': len(uniq),
        })

    with open(a.out, 'w') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

    print(f'сцен: {len(rows)} → {a.out}')
    kinds = collections.Counter(r['nameRu'] for r in rows)
    print('с автором/получателем:', sum(1 for r in rows if r['actor']))
    print('с позицией:', sum(1 for r in rows if r['position']))
    print('уникальных русских названий:', len(kinds))
    print('\nмастурбация (примеры):')
    for r in rows:
        if 'мастурбация' in r['nameRu']:
            print(f"   {r['nameRu']:35} · {r['description'][:60]} · слоёв {r['clipCount']}")


if __name__ == '__main__':
    main()
