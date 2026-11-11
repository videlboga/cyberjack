#!/usr/bin/env python3
"""Акт из имени клипа: лексикон токенов Koikatsu H-корпуса.

Имена клипов собраны из ромадзи-токенов и описывают, что происходит:
`Denma_kokan_C_ositukeru_B` = вибратор, промежность, прижимать; `Sita_L_...` = языком; `Yubi_...` = пальцами.
Скрипт разбирает имя на роли (инструмент, часть тела, глагол, фаза, реакция) и выводит акт + уверенность.

Запуск: python3 act-from-name.py [--out ../data/h-act-from-names.json]
"""
import argparse
import collections
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# инструмент / чем воздействуют
TOOL = {
    'te': 'hand', 'tel': 'hand', 'tem': 'hand', 'tesm': 'hand', 'tes': 'hand',
    'yubi': 'fingers',
    'sita': 'tongue',
    'oral': 'mouth',
    'denma': 'toy', 'rotor': 'toy', 'vibe': 'toy', 'dildo': 'toy',
}
# часть тела / цель
TARGET = {
    'kokan': 'crotch', 'anal': 'anal', 'siri': 'butt',
    'munel': 'breast', 'munem': 'breast', 'muneс': 'breast', 'mune': 'breast',
    'muneml': 'breast', 'munesm': 'breast', 'muneL': 'breast',
    'kuchi': 'mouth',
}
# глагол воздействия
VERB = {
    'ositukeru': 'press', 'nademawasu': 'stroke', 'namemawasu': 'stroke',
    'nameru': 'lick', 'momu': 'knead', 'kosuru': 'rub', 'kakimawasu': 'circle',
    'sawari': 'touch', 'hipparu': 'pull', 'ireru': 'insert', 'ijiru': 'tease',
    'tutuku': 'poke', 'drink': 'drink', 'vomit': 'vomit', 'touch': 'touch',
}
# фаза / тип движения
PHASE = ('InsertIdle', 'Insert', 'SLoop', 'WLoop', 'OLoop', 'MLoop', 'OUT', 'Idle',
         'Loop', 'Start', 'Stop', 'Drop', 'Pull')
# реакция
REACTION = {'dislikes': 'negative', 'orgasm': 'climax'}
# маркеры варианта — не несут смысла
NOISE = {'l', 'm', 's', 'a', 'b', 'c', 'd', 'r', 'k', 'ss', 'ws', 'wf', 'sf', 'f',
         'ml', 'sm', 'll', 'lm', 'ls', 'mm', 'ms', 'sl', 'front', 'back', 'in', 'out'}


def digits_strip(t):
    return re.sub(r'\d+$', '', t.lower())


def parse(name):
    toks = [digits_strip(x) for x in re.split(r'[_\s]+', name) if x]
    roles = {'tool': set(), 'target': set(), 'verb': set(), 'phase': set(), 'reaction': set(), 'other': set()}
    for t in toks:
        if t in TOOL:
            roles['tool'].add(TOOL[t])
        elif t in TARGET:
            roles['target'].add(TARGET[t])
        elif t in VERB:
            roles['verb'].add(VERB[t])
        elif t in REACTION:
            roles['reaction'].add(REACTION[t])
        elif any(p.lower() == t for p in PHASE):
            # фаза приводится к виду из имени
            for p in PHASE:
                if p.lower() == t:
                    roles['phase'].add(p)
        elif t not in NOISE:
            roles['other'].add(t)
    return roles


def act_of(roles):
    """Акт из ролей. Возвращает (act, confidence)."""
    tool, target, verb, reac = roles['tool'], roles['target'], roles['verb'], roles['reaction']
    if 'negative' in reac:
        return 'reaction_negative', 0.9
    if 'climax' in reac:
        return 'climax', 0.9
    if 'vomit' in verb:
        return 'suck_clean', 0.6
    if 'drink' in verb:
        return 'suck_clean', 0.7
    if 'tongue' in tool and ('crotch' in target or not target):
        return 'cunnilingus', 0.85
    if 'mouth' in tool:
        return 'oral', 0.85
    if 'anal' in target:
        return 'anal', 0.85
    if 'toy' in tool:
        return 'toy_play', 0.8
    if 'fingers' in tool:
        return 'fingering', 0.8
    if 'hand' in tool:
        return 'handjob', 0.75
    if 'breast' in target and verb:
        return 'breast_play', 0.7
    if 'butt' in target and verb:
        return 'butt_play', 0.7
    if 'crotch' in target and ('insert' in verb or 'press' in verb):
        return 'vaginal', 0.7
    if 'crotch' in target and verb:
        return 'genital_play', 0.65
    if verb:
        return 'self_touch', 0.5
    return None, 0.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'motion-analysis/data/h-act-from-names.json'))
    a = ap.parse_args()

    cat = json.load(open(os.path.join(ROOT, 'animations/catalog.json')))
    h = [c for c in cat['clips'] if c.get('category') == 'h' and c.get('playable')]

    rows, acts = [], collections.Counter()
    unknown = []
    for c in h:
        roles = parse(c['name'])
        act, conf = act_of(roles)
        row = {'id': c['id'], 'name': c['name'], 'act': act, 'confidence': conf,
               'roles': {k: sorted(v) for k, v in roles.items() if v}}
        rows.append(row)
        if act:
            acts[act] += 1
        else:
            unknown.append(c['name'])

    covered = sum(acts.values())
    doc = {'format': 'h-act-from-names/1', 'total': len(h), 'covered': covered,
           'coverage': round(covered / len(h) * 100, 1), 'acts': dict(acts.most_common()),
           'unknownExamples': unknown[:20], 'rows': rows}
    json.dump(doc, open(a.out, 'w'), ensure_ascii=False)

    print(f'клипов: {len(h)} · акт определён у {covered} ({doc["coverage"]}%)')
    print('\nакты:')
    for k, v in acts.most_common():
        print(f'   {k:18} {v:5}  {round(v/len(h)*100):3}%')
    print(f'\nбез акта: {len(unknown)} · примеры: {unknown[:8]}')
    print('\nпримеры разбора:')
    for r in rows[:6]:
        print(f"   {r['name']:26} → {str(r['act']):16} {r['roles']}")


if __name__ == '__main__':
    main()
