#!/usr/bin/env python3
"""Семейства имён H-корпуса: склеивает почти идентичные клипы в группы.

Зачем: 23 279 H-клипов — это не 23 279 разных движений. Имена кодируют вариант
(`Denma_kokan_C_ositukeru_B` / `_F`, `nademawasu0…4`, `SLoop1/WLoop2`), поэтому
один и тот же жест встречается десятки раз с разными маркерами.

Что делает: нормализует имя (убирает сторону B/F, размеры L/M/S/SS/WS, числовые
хвосты 0…9), группирует клипы по нормализованному ключу, считает по группе число
различных движений (по digest из duplicates_hashes.jsonl) и выбирает представителя.

Запуск: python3 tools/group-h-clips.py
"""
import json
import re
import collections
import hashlib
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
CATALOG = os.path.join(ROOT, 'animations/catalog.json')
DIGESTS = os.path.join(ROOT, 'animations/duplicates_hashes.jsonl')
OUT = os.path.join(ROOT, 'motion-analysis/data/h-groups.json')
REPORT = os.path.join(ROOT, 'motion-analysis/data/h-groups.md')

# маркеры, которые НЕ меняют суть движения: сторона, размер тела, ориентация
SIDE = {'b', 'f', 'l', 'r'}
SIZE = {'l', 'm', 's', 'ss', 'ws', 'sf', 'wf', 'a'}
DIGITS = re.compile(r'\d+$')


def norm_token(t):
    t = t.lower()
    t = DIGITS.sub('', t)          # SLoop1 → sloop, nademawasu0 → nademawasu
    return t


SCENE = re.compile(r'(\d{2}_\d{2})')


def scene_of(source):
    m = SCENE.search(source or '')
    return m.group(1) if m else 'na'


def family_key(name, source=''):
    raw = [x for x in re.split(r'[_\s]+', name) if x]
    toks = [norm_token(x) for x in raw]
    # выбрасываем маркеры стороны/размера, но только если после этого что-то остаётся
    core = [t for t in toks if t and t not in SIDE and t not in SIZE]
    if not core:
        core = toks
    # сцена — из пути бандла: именно она отличает один жест от другого,
    # а сторона/размер (B/F, L/M/S) отличают варианты внутри сцены
    return scene_of(source) + ':' + '|'.join(core)


def load_digests():
    digests = {}
    if not os.path.exists(DIGESTS):
        return digests
    with open(DIGESTS) as f:
        for line in f:
            try:
                d = json.loads(line)
            except Exception:
                continue
            if d.get('digest'):
                digests[d['id']] = d['digest']
    return digests


def main():
    catalog = json.load(open(CATALOG))
    h = [c for c in catalog['clips'] if c.get('category') == 'h' and c.get('playable')]
    digests = load_digests()

    groups = collections.defaultdict(list)
    for c in h:
        groups[family_key(c['name'], c.get('source', ''))].append(c)

    out_groups = []
    for key, clips in groups.items():
        motion = {digests.get(c['id'], c['id']) for c in clips}
        # представитель: самый короткий id-набор — обычно самый ранний вариант
        rep = sorted(clips, key=lambda c: (len(c['name']), c['name']))[0]
        out_groups.append({
            'key': key,
            'count': len(clips),
            'distinctMotions': len(motion),
            'roles': sorted({r for c in clips for r in re.findall(r'(Idle|Insert|InsertIdle|WLoop|SLoop|OLoop|OUT|Start|Loop|Stop|Drop|Pull)', c['name'])}),
            'sources': len({c['source'] for c in clips}),
            'samples': [c['name'] for c in sorted(clips, key=lambda c: c['name'])[:5]],
            'representative': {'id': rep['id'], 'name': rep['name'], 'source': rep['source'],
                               'duration': rep.get('duration')},
        })
    out_groups.sort(key=lambda g: -g['count'])

    total = len(h)
    singletons = sum(1 for g in out_groups if g['count'] == 1)
    doc = {
        'format': 'h-name-families/1',
        'catalog': 'animations/catalog.json',
        'totalClients': total,
        'families': len(out_groups),
        'reduction': round(total / max(1, len(out_groups)), 2),
        'singletons': singletons,
        'identicalFamilies': sum(1 for g in out_groups if g['distinctMotions'] == 1),
        'familiesWithDifferentMotion': sum(1 for g in out_groups if g['distinctMotions'] > 1),
        'groups': out_groups,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(doc, open(OUT, 'w'), ensure_ascii=False, indent=1)

    # отчёт
    lines = [
        '# Семейства имён H-корпуса',
        '',
        f'Клипов: **{total}** · семейств: **{len(out_groups)}** · сжатие: **{doc["reduction"]}×** '
        f'· одиночных: {singletons}',
        '',
        f'- семейств, где все клипы — одно и то же движение: **{doc["identicalFamilies"]}**',
        f'- семейств с разными движениями под общим именем: {doc["familiesWithDifferentMotion"]}',
        '',
        '## Самые большие семейства',
        '',
        '| ключ | клипов | разных движений | роли | источники | пример |',
        '|---|---|---|---|---|---|',
    ]
    for g in out_groups[:20]:
        lines.append(f'| `{g["key"][:42]}` | {g["count"]} | {g["distinctMotions"]} | '
                     f'{", ".join(g["roles"]) or "—"} | {g["sources"]} | `{g["samples"][0]}` |')
    lines += ['', '## Проверка на примерах', '']
    for g in out_groups[:5]:
        lines.append(f'**{g["key"]}** — {g["count"]} клипов, движений {g["distinctMotions"]}:')
        for s in g['samples']:
            lines.append(f'  - `{s}`')
        lines.append('')
    open(REPORT, 'w').write('\n'.join(lines) + '\n')

    print(f'клипов {total} → семейств {len(out_groups)} (сжатие {doc["reduction"]}×)')
    print(f'  одиночных: {singletons}')
    print(f'  семейства из одного движения: {doc["identicalFamilies"]}')
    print(f'  семейства с разными движениями: {doc["familiesWithDifferentMotion"]}')
    print('\nтоп-10 семейств:')
    for g in out_groups[:10]:
        print(f'  {g["key"][:44]:44} клипов {g["count"]:4d} · движений {g["distinctMotions"]:3d} · {g["samples"][0]}')
    print('\nфайлы:', OUT, '·', REPORT)


if __name__ == '__main__':
    main()
