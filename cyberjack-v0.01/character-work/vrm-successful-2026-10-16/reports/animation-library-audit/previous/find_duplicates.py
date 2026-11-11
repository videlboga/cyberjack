#!/usr/bin/env python3
"""Find full duplicates in the Koikatsu clip library.

Definitions:
- byte dupe   : clips/<id>.json.gz files with identical raw bytes.
- motion dupe : identical canonical curve content (clip JSON minus m_Name),
                i.e. the same animation data regardless of file encoding.
  - same name + same motion = full duplicate.
  - different names + same motion = alias (same motion under other name).

Output: duplicates_report.json next to this script.
Usage: python3 find_duplicates.py [--top 30]
"""
import argparse
import gzip
import hashlib
import json
import os
from collections import defaultdict
from concurrent.futures import ProcessPoolExecutor

BASE = os.path.dirname(os.path.abspath(__file__))
REPORT = os.path.join(BASE, 'duplicates_report.json')


def worker(item):
    cid, rel = item
    path = os.path.join(BASE, rel)
    out = [cid, None, None, 0, None]
    try:
        with open(path, 'rb') as f:
            raw = f.read()
        out[1] = hashlib.sha1(raw).hexdigest()
        out[3] = len(raw)
        d = json.loads(gzip.decompress(raw))
        clip = d.get('clip') or {}
        motion = {k: v for k, v in clip.items() if k != 'm_Name'}
        canon = json.dumps(motion, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
        out[2] = hashlib.sha1(canon.encode('utf-8')).hexdigest()
    except Exception as e:  # noqa: BLE001
        out[4] = str(e)[:120]
    return out


def build(gmap, kind, meta, order_idx):
    res = []
    for h, cids in gmap.items():
        if len(cids) < 2:
            continue
        names = sorted({meta[i]['name'] for i in cids})
        sources = sorted({meta[i]['source'] for i in cids})
        sizes = [meta[i]['bytes'] for i in cids]
        size_total = sum(sizes)
        wasted = size_total - min(sizes)  # keep smallest file, drop the rest
        rep = min(cids, key=lambda i: order_idx[i])
        res.append({'kind': kind, 'hash': h, 'clips': len(cids), 'names': names[:12],
                    'name_unique': len(names), 'sources': sources[:4],
                    'source_count': len(sources), 'size_bytes': size_total,
                    'wasted_bytes': wasted, 'keep': rep,
                    'dups': [i for i in cids if i != rep]})
    res.sort(key=lambda r: -r['wasted_bytes'])
    return res


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--top', type=int, default=30)
    args = ap.parse_args()

    with open(os.path.join(BASE, 'catalog.json'), encoding='utf-8') as f:
        cat = json.load(f)
    clips = cat['clips']
    meta = {c['id']: c for c in clips}
    ids = [c['id'] for c in clips]
    order_idx = {cid: i for i, cid in enumerate(ids)}
    items = [[c['id'], c['asset']] for c in clips]

    byte_g = defaultdict(list)
    motion_g = defaultdict(list)
    err = 0
    with ProcessPoolExecutor(max_workers=min(8, os.cpu_count() or 4)) as ex:
        for cid, rh, mh, nbytes, e in ex.map(worker, items, chunksize=256):
            if e:
                err += 1
                continue
            byte_g[rh].append(cid)
            motion_g[mh].append(cid)

    byte_dups = build(byte_g, 'byte', meta, order_idx)
    all_motion = build(motion_g, 'motion', meta, order_idx)
    full_dups = [g | {'kind': 'full(name+motion)'} for g in all_motion if g['name_unique'] == 1]
    alias_dups = [g | {'kind': 'alias(motion)'} for g in all_motion if g['name_unique'] > 1]

    wasted_byte = sum(g['wasted_bytes'] for g in byte_dups)
    wasted_motion = sum(g['wasted_bytes'] for g in all_motion)

    report = {
        'format': 'koikatsu-duplicates-v1',
        'generated': '2026-10-16',
        'method': 'byte: sha1(raw gzip); motion: sha1(canonical clip-json minus m_Name, sort_keys)',
        'total_clips': len(clips),
        'decode_errors': err,
        'summary': {
            'byte_dupe_groups': len(byte_dups),
            'full_dupe_groups(name+motion)': len(full_dups),
            'alias_groups(motion_only)': len(alias_dups),
            'motion_unique_groups': len(motion_g),
            'wasted_bytes_byte': wasted_byte,
            'wasted_bytes_motion': wasted_motion,
        },
        'dedupe': {'keep': {g['keep']: g['dups'] for g in all_motion}},
        'top_byte_dupes': byte_dups[:args.top],
        'top_full_dupes': full_dups[:args.top],
        'top_alias_groups': alias_dups[:args.top],
    }
    with open(REPORT, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False)

    s = report['summary']
    print('clips: %d (decode errors: %d)' % (len(clips), err))
    print('byte-duplicate groups:   %4d  wasting %.1f MiB' % (s['byte_dupe_groups'], wasted_byte / 1048576))
    print('full dupes (name+motion):%4d  wasting %.1f MiB' % (s['full_dupe_groups(name+motion)'], wasted_motion / 1048576))
    print('alias groups (motion, same data under different name): %4d' % s['alias_groups(motion_only)'])
    for title, rows in (('TOP BYTE DUPES', byte_dups), ('TOP FULL DUPES', full_dups), ('TOP ALIAS', alias_dups)):
        print('---', title)
        for g in rows[:args.top]:
            print('%4d clips | %6.2f MiB | names: %s | sources: %s%s' % (
                g['clips'], g['wasted_bytes'] / 1048576,
                ', '.join(g['names'][:4]) + ('...' if len(g['names']) > 4 else ''),
                ', '.join(g['sources'][:2]), (' (+%d sources)' % (g['source_count'] - 2)) if g['source_count'] > 2 else ''))
    print('report:', REPORT)


if __name__ == '__main__':
    main()