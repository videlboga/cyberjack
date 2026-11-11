#!/usr/bin/env python3
"""Финальный слой разметки H-корпуса: акт (метаданные) + поза/статика/описание (VLM) + фаза + геометрия.

Источники акта по убыванию надёжности:
  1. scene  — клип → контроллер → сцена → японское название (точный акт);
  2. name   — ромадзи-токены имени (инструмент/часть тела/глагол);
  3. transfer — акт переносится с соседей по контроллеру, если у него есть размеченные клипы;
  4. phase  — подсказка по фазе (IN/Insert = проникновение), уверенность низкая;
  5. нигде  — unknown.

Поза/статика/описание берутся из VLM-батча (`data/clip-semantics-h-batch.jsonl`), который размечен
по представителям семейств; метка представителя переносится на всё семейство.

Запуск: python3 build-h-layer.py [--out ../data/h-layer.jsonl] [--manifest ../data/h-layer-manifest.json]
"""
import argparse
import collections
import gzip
import hashlib
import json
import sys
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, 'motion-analysis/tools'))
from h_positions import position_of, POSITION_TO_POSTURE
from h_describe import describe, translate_scene, side_of, RU_ACT
import importlib.util as _ilu
_spec = _ilu.spec_from_file_location('scene_act_map', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'scene-act-map.py'))
_sam = _ilu.module_from_spec(_spec); _spec.loader.exec_module(_sam)
PHASE_ORDER = ('InsertIdle', 'Insert', 'SLoop', 'WLoop', 'OLoop', 'MLoop', 'OUT', 'Idle',
               'Loop', 'Start', 'Stop', 'Drop', 'Pull', 'Touch')
PENETRATION_PHASES = {'Insert', 'InsertIdle', 'SLoop', 'WLoop', 'MLoop', 'IN'}



SIDE = {'b', 'f', 'l', 'r'}
SIZE = {'l', 'm', 's', 'ss', 'ws', 'sf', 'wf', 'a'}


def family_key(name, source=''):
    """Та же нормализация, что в group-h-clips.py: сцена + имя без маркеров варианта."""
    m = re.search(r'(\d{2}_\d{2})', source or '')
    scene = m.group(1) if m else 'na'
    toks = [re.sub(r'\d+$', '', x.lower()) for x in re.split(r'[_\s]+', name) if x]
    core = [t for t in toks if t and t not in SIDE and t not in SIZE] or toks
    return scene + ':' + '|'.join(core)


def phase_of(name):
    for p in PHASE_ORDER:
        if p in name:
            return p
    if 'IN' in name.split('_'):
        return 'IN'
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'motion-analysis/data/h-layer.jsonl'))
    ap.add_argument('--manifest', default=os.path.join(ROOT, 'motion-analysis/data/h-layer-manifest.json'))
    a = ap.parse_args()

    cat = json.load(open(os.path.join(ROOT, 'animations/catalog.json')))
    h = [c for c in cat['clips'] if c.get('category') == 'h' and c.get('playable')]
    by_id = {c['id']: c for c in h}

    scenes = {r['id']: r for r in json.load(open(os.path.join(ROOT, 'motion-analysis/data/h-act-from-scenes.json')))['rows']}
    names = {r['id']: r for r in json.load(open(os.path.join(ROOT, 'motion-analysis/data/h-act-from-names.json')))['rows']}
    groups = json.load(open(os.path.join(ROOT, 'motion-analysis/data/h-groups.json')))
    # слои: клип может проигрываться поверх разных позиций (layer-links)
    layers = {}
    ll_path = os.path.join(ROOT, 'motion-analysis/data/layer-links.json')
    if os.path.exists(ll_path):
        for name, info in json.load(open(ll_path))['clips'].items():
            positions = []
            for p in info.get('positions') or []:
                pos = position_of(p.get('nameJa') or '')
                if pos and pos not in positions:
                    positions.append(pos)
            layers[name] = {'positions': positions, 'sceneCount': len(info.get('positions') or []),
                            'scenes': [p.get('nameJa') for p in (info.get('positions') or []) if p.get('nameJa')]}
    vlm_path = os.path.join(ROOT, 'motion-analysis/data/clip-semantics-h-batch.jsonl')
    vlm = {}
    if os.path.exists(vlm_path):
        for line in open(vlm_path):
            r = json.loads(line)
            vlm[r['clipId']] = r

    # контроллеры: клип → контроллеры, чтобы переносить акт с соседей
    ctrls = json.load(open(os.path.join(ROOT, 'animation-links/controllers.json')))
    clip_ctrl = collections.defaultdict(set)
    ctrl_members = {}
    for c in ctrls['controllers']:
        p = os.path.join(ROOT, 'animation-links', c['asset'])
        if not os.path.exists(p):
            continue
        members = [x['clip'] for x in json.load(gzip.open(p, 'rt')).get('clips', []) if x.get('clip')]
        ctrl_members[c['name']] = members
        for cid in members:
            clip_ctrl[cid].add(c['name'])

    scene_names = {r['id']: (r.get('scenes') or [None])[0] for r in
                   json.load(open(os.path.join(ROOT, 'motion-analysis/data/h-act-from-scenes.json')))['rows']}

    def scenes_named(cid):
        n = scene_names.get(cid)
        return n

    def direct_act(cid):
        # приоритет у имени: там описан сам клип (инструмент, часть тела, глагол),
        # а сцена описывает набор целиком и для «Denma_*» даёт лишь «ласки»
        n = (names.get(cid) or {}).get('act')
        if n:
            return n, 'name'
        s = (scenes.get(cid) or {}).get('act')
        if s:
            return s, 'scene'
        return None, None

    # перенос по контроллерам: если в контроллере есть клипы с точным актом — берём самый частый
    transfer = {}
    for name, members in ctrl_members.items():
        votes = collections.Counter()
        for cid in members:
            act, src = direct_act(cid)
            if act and src in ('scene', 'name'):
                votes[act] += 1
        if votes:
            act, cnt = votes.most_common(1)[0]
            if cnt >= 2 and cnt / len(members) >= 0.2:
                for cid in members:
                    if cid in by_id and not direct_act(cid)[0]:
                        transfer[cid] = act

    # представители семейств: метка VLM переносится на семейство
    # представитель семейства → его VLM-разметка; метка переносится на всё семейство
    # переносим метку VLM только внутри семейств, где все клипы — одно движение (distinctMotions == 1);
    # иначе один ответ расползается на сотни разных движений и врёт
    key_to_rep = {g['key']: (g['representative']['id'], g['distinctMotions']) for g in groups['groups']}

    rows = []
    stats = collections.Counter()
    acts = collections.Counter()
    postures = collections.Counter()
    for c in h:
        cid = c['id']
        act, src = direct_act(cid)
        if not act and cid in transfer:
            act, src = transfer[cid], 'controller-transfer'
        ph = phase_of(c['name'])
        if not act and ph in PENETRATION_PHASES:
            act, src = 'penetration_hint', 'phase'
        if not act:
            src = 'none'

        # поза/статика/описание — от представителя семейства (метка переносится)
        v = vlm.get(cid)
        fromRep = False
        if v is None:
            entry = key_to_rep.get(family_key(c['name'], c.get('source', '')))
            if entry and entry[1] == 1:
                v = vlm.get(entry[0])
                fromRep = v is not None
        p0 = (v or {}).get('passes', [None])[0] or {}
        posture = (p0.get('posture') or {}).get('value') if v else None
        posture_source = 'vlm' if posture else None
        if not posture:
            pos_val = (scenes.get(cid) or {}).get('position')
            derived = POSITION_TO_POSTURE.get(pos_val or '')
            if derived:
                posture, posture_source = derived, 'derived_from_position'
        static = ((p0.get('action') or {}).get('id') == 'pose_hold') if v else None
        layer = layers.get(c['name']) or {}
        scene_list = layer.get('scenes') or ([scenes_named(cid)] if scenes_named(cid) else [])
        layer_acts = sorted({a for a in (_sam.classify(x)[0] for x in scene_list) if a}) if scene_list else []
        desc = describe(c['name'], scene_list, ph, (scenes.get(cid) or {}).get('position'), layer_acts)
        row = {
            'id': cid,
            'name': c['name'],
            'rig': c.get('rig'),
            'duration': round(float(c.get('duration') or 0), 3),
            'phase': ph,
            'act': act,
            'actSource': src,
            'position': (scenes.get(cid) or {}).get('position'),
            'layerPositions': layer.get('positions') or [],
            'description': desc['description'],
            'describe': {k: desc[k] for k in ('actor', 'receiver', 'means', 'target', 'motion', 'place',
                                              'phaseMotion', 'actorVariants', 'placeVariants', 'places',
                                              'actVariants', 'sceneCount', 'specific')},
            'contexts': [{'scene': x['scene'], 'sceneRu': translate_scene(x['scene']),
                          'actor': x.get('actor'), 'place': x.get('place')} for x in desc['contexts'][:8]],
            'layerSceneCount': (layers.get(c['name']) or {}).get('sceneCount') or 0,
            'layerKind': ('layer' if (layers.get(c['name']) or {}).get('sceneCount', 0) > 1 else 'base'),
            'posture': posture,
            'postureSource': posture_source,
            'static': static,
            'notes': (p0.get('notes') or '').strip() or None,
            'side': side_of(c['name']),
            'searchText': ' · '.join(x for x in [
                desc['description'],
                RU_ACT.get(act or '', ''),
                side_of(c['name']) or '',
                ' / '.join(translate_scene(x['scene']) for x in desc['contexts'][:4]),
                act or '', ph or '', (scenes.get(cid) or {}).get('position') or '',
            ] if x),
            'vlmAgreement': (v or {}).get('agreement', {}).get('score') if v else None,
            'vlmFromRepresentative': fromRep,
        }
        rows.append(row)
        stats[src] += 1
        acts[act or 'unknown'] += 1
        postures[posture or 'нет'] += 1

    with open(a.out, 'w') as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + '\n')

    digest = hashlib.sha256(open(a.out, 'rb').read()).hexdigest()
    manifest = {
        'format': 'h-layer/1',
        'created': __import__('time').strftime('%Y-%m-%dT%H:%M:%S'),
        'clips': len(rows),
        'actCoverage': round(sum(1 for r in rows if r['act'] and r['act'] != 'unknown') / len(rows) * 100, 1),
        'byActSource': dict(stats),
        'byAct': dict(acts.most_common()),
        'byPosture': dict(postures.most_common()),
        'byPosition': dict(collections.Counter(r['position'] or 'none' for r in rows).most_common()),
        'vlmCovered': sum(1 for r in rows if r['vlmAgreement'] is not None),
        'postureCoverage': round(sum(1 for r in rows if r['posture']) / len(rows) * 100, 1),
        'postureBySource': dict(collections.Counter(r['postureSource'] or 'none' for r in rows).most_common()),
        'positionCoverage': round(sum(1 for r in rows if r['position']) / len(rows) * 100, 1),
        'layerClips': sum(1 for r in rows if r['layerKind'] == 'layer'),
        'layerPositionCoverage': round(sum(1 for r in rows if r['layerPositions']) / len(rows) * 100, 1),
        'medianScenesPerLayer': sorted(r['layerSceneCount'] for r in rows)[len(rows) // 2],
        'fullRow': sum(1 for r in rows if r['act'] and r['actSource'] != 'phase' and r['position'] and r['posture']),
        'sha256': digest,
        'rules': {
            'act': 'name (ромадзи-токены) → scene (clip→controller→scene→японское название) → controller-transfer → phase-hint',
            'posture': 'VLM по представителю семейства (gemma4:31b, 2 прогона)',
            'static': 'VLM action == pose_hold',
            'phase': 'из имени клипа',
            'posture_derived': 'если VLM-метки нет — из position по таблице POSITION_TO_POSTURE',
            'position': 'из названия сцены (нормализованные позиции: missionary, doggy, cowgirl, reverse_cowgirl, spooning, standing, standing_carry, face_to_face_seated, rear_seated, prone_doggy, breeding_press)',
        },
    }
    json.dump(manifest, open(a.manifest, 'w'), ensure_ascii=False, indent=1)

    print(f'слой: {len(rows)} клипов → {a.out}')
    print(f'акт определён: {manifest["actCoverage"]}%  · источники: {dict(stats)}')
    print(f'поза размечена VLM: {manifest["vlmCovered"]}')
    print('топ актов:', dict(acts.most_common(8)))
    print('sha256:', digest[:16])


if __name__ == '__main__':
    main()
