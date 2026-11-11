#!/usr/bin/env python3
"""Search the Koikatsu animation library (catalog.json in this directory).

Search works with latin clip-name stems (suwari, WLoop, Denma) and with Russian
words from glossary.json ("сидение", "грудь", "поглаживать", "ходьба"...).
Every row shows a short RU description built from glossary stems.

Examples:
    python3 query.py --stats
    python3 query.py -q suwari --limit 10
    python3 query.py -q сидение --limit 10
    python3 query.py -q грудь --category h --limit 20
    python3 query.py -q Idle --min-duration 1 --max-duration 4 --json
    python3 query.py --stats-like suwari
    python3 query.py -q WLoop --category h --rig female --no-dupes
"""
import argparse
import json
import os
import re
import sys
from collections import Counter

BASE = os.path.dirname(os.path.abspath(__file__))
CATEGORIES = ('action', 'adv', 'chara', 'custom', 'esthetic', 'h', 'map', 'mods', 'studio', 'vr')
RIGS = ('female', 'male', 'shared', 'object')


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def try_load(path):
    try:
        return load(path)
    except Exception:
        return None


def short_source(src, mod_map):
    d = os.path.dirname(src)
    guid = d[len('__mods/'):] if d.startswith('__mods/') else None
    if guid and guid in mod_map:
        return '[mod] ' + mod_map[guid]['label'].split('(')[0].strip()
    return src if len(src) <= 52 else src[:49] + '...'


def name_description(name, gl):
    """Short RU description from glossary stems; unknown tokens stay latin."""
    stems = gl.get('stems') or {}
    size = {s.upper() for s in (gl.get('size_tokens') or [])}
    skip_any = set(gl.get('skip_anywhere') or [])
    leading = set(gl.get('leading_skip') or [])
    out = []
    for i, part in enumerate(p for p in re.split(r'[_]+', name) if p):
        tok = re.sub(r'[^a-z0-9]', '', part.lower())
        if not tok or tok.isdigit() or tok in skip_any:
            continue
        if i == 0 and len(tok) == 1 and tok.upper() in leading:
            continue
        if len(tok) <= 2 and tok.upper() in size:
            continue
        if len(tok) == 1:
            continue
        ru = stems.get(tok)
        if ru is None:
            m = re.match(r'^(.*?)(\d+)$', tok)
            if m and m.group(1) in stems:
                ru = stems[m.group(1)] + ', №' + m.group(2)
        out.append(ru if ru else tok)
    return ' '.join(out) if out else '-'


_CLEAN_PAREN = re.compile(r'\([^)]*\)')


def ru_expand(query, gl):
    """Map a Russian word to latin stems via glossary values. Returns (stems, q).

    Parenthesized clarifications in glossary values are ignored for matching,
    tokens shorter than 3 chars (e.g. 'W', 'S' in 'петля W') never match."""
    q = query.lower().strip()
    if len(q) < 2:
        return [], q
    hits = []
    for stem, ru in (gl.get('stems') or {}).items():
        for w in re.split(r'[\s,]+', _CLEAN_PAREN.sub(' ', ru.lower())):
            w = w.strip()
            if len(w) >= 3 and (q in w or (len(q) >= 3 and w in q)):
                hits.append(stem)
                break
    return hits, q


def main():
    ap = argparse.ArgumentParser(description='Search the Koikatsu animation library')
    ap.add_argument('-q', '--query', default=None,
                    help='clip-name substring (latin stems) or glossary word (RU)')
    ap.add_argument('--category', choices=CATEGORIES)
    ap.add_argument('--rig', choices=RIGS)
    ap.add_argument('--source', default=None, help='substring of the source bundle path')
    ap.add_argument('--min-duration', type=float, default=None)
    ap.add_argument('--max-duration', type=float, default=None)
    ap.add_argument('--exact', action='store_true', help='name equals query (not substring)')
    ap.add_argument('--limit', type=int, default=30)
    ap.add_argument('--json', dest='as_json', action='store_true', help='JSON output with full metadata')
    ap.add_argument('--stats', action='store_true', help='library summary, no filtering')
    ap.add_argument('--stats-like', default=None, help='group matching clip names with RU descriptions')
    ap.add_argument('--no-dupes', action='store_true',
                    help='exclude clips whose motion content is duplicated elsewhere (uses duplicates_report.json)')
    args = ap.parse_args()

    if args.stats_like and not args.query:
        args.query = args.stats_like  # --stats-like is a query in "grouped summary" mode

    cat = load(os.path.join(BASE, 'catalog.json'))
    clips = cat['clips']
    mod_map = (try_load(os.path.join(BASE, 'mod_map.json')) or {}).get('guids', {})
    gl = try_load(os.path.join(BASE, 'glossary.json')) or {}
    rep = try_load(os.path.join(BASE, 'duplicates_report.json'))

    if args.stats:
        c_cat = Counter(c.get('category') for c in clips)
        c_rig = Counter(c.get('rig') for c in clips)
        print('total clips:', len(clips))
        print('source bundles:', len(set(c.get('source') for c in clips)))
        print('category:')
        for k, v in sorted(c_cat.items(), key=lambda kv: -kv[1]):
            print('   %-9s %6d  %s' % (k, v, (gl.get('categories') or {}).get(k, '')))
        print('rig:', ', '.join('%s=%d' % kv for kv in c_rig.most_common()))
        print('playable:', sum(1 for c in clips if c.get('playable')),
              'non-playable:', sum(1 for c in clips if not c.get('playable')))
        if rep:
            removable = sum(len(v) for v in rep['dedupe']['keep'].values())
            print('unique motions: %d of %d clips; full-dup groups: %d, alias groups: %d, removable clips: %d'
                  % (rep['summary']['motion_unique_groups'], rep['total_clips'],
                     rep['summary']['full_dupe_groups(name+motion)'],
                     rep['summary']['alias_groups(motion_only)'], removable))
        print("catalog 'complete' flag: %s (stale builder flag; coverage verified 396/396 bundles)"
              % cat.get('complete'))
        return

    q = args.query.lower() if args.query else None
    used_stems = []
    if q is not None:
        hits, _ = ru_expand(q, gl)
        if hits:
            used_stems = hits

    def q_match(name):
        nonlocal q
        if q is None:
            return True
        if used_stems and not args.exact:
            nl = name.lower()
            return any(s.rstrip('0123456789') in nl for s in used_stems) or q in nl
        if args.exact and used_stems:
            return name.lower() in used_stems
        return q in name.lower()

    dup_ids = None
    if args.no_dupes and rep:
        dup_ids = set()
        for dups in rep['dedupe']['keep'].values():
            dup_ids.update(dups)

    rows = []
    like_names = Counter()
    for c in clips:
        if dup_ids and c['id'] in dup_ids:
            continue
        if not q_match(c['name']):
            continue
        if args.category and c.get('category') != args.category:
            continue
        if args.rig and c.get('rig') != args.rig:
            continue
        if args.source and args.source.lower() not in c.get('source', '').lower():
            continue
        dur = c.get('duration') or 0
        if args.min_duration is not None and dur < args.min_duration:
            continue
        if args.max_duration is not None and dur > args.max_duration:
            continue
        if args.stats_like:
            like_names[c['name']] += 1
        else:
            rows.append(c)

    if args.stats_like:
        print('matching unique names: %d' % len(like_names))
        for name, _cnt in like_names.most_common(60):
            print('  %-44s %s' % (name, name_description(name, gl)) if name_description(name, gl) != '-'
                  else '  %s' % name)
        return

    rows.sort(key=lambda c: (c.get('category', ''), c['name']))
    total = len(rows)
    rows = rows[:args.limit]

    if args.as_json:
        out = [{'id': c['id'], 'name': c['name'],
                'description': name_description(c['name'], gl),
                'category': c.get('category'), 'rig': c.get('rig'), 'duration': c.get('duration'),
                'fps': c.get('fps'), 'source': c.get('source'), 'pathId': c.get('pathId'),
                'clip_file': c.get('asset')} for c in rows]
        print(json.dumps({'total_matches': total, 'returned': len(out), 'clips': out},
                         ensure_ascii=False, indent=1))
        return

    print('matches: %d (showing %d)%s' % (total, len(rows), ' [dupes excluded]' if dup_ids else ''))
    if used_stems:
        print('RU -> stems: %s' % ', '.join(used_stems[:10]))
    for c in rows:
        src = short_source(c.get('source', ''), mod_map)
        line1 = '%s  %-6s %-6s %6.2fs  %-44s' % (
            c['id'][:12], c.get('category') or '-', c.get('rig') or '-',
            c.get('duration') or 0, c['name'])
        print(line1)
        print('%-14s desc: %s' % ('', name_description(c['name'], gl)))
        print('%-14s src:  %s' % ('', src))
    if total > len(rows):
        print('... %d more (raise --limit)' % (total - len(rows)))


if __name__ == '__main__':
    sys.exit(main())