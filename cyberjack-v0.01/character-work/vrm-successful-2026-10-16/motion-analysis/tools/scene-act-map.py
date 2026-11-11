#!/usr/bin/env python3
"""Акт H-клипа из метаданных сцены: клип → контроллер → сцена → японское название.

Цепочка найдена в данных проекта:
  `animation-links/controllers.json` — контроллер (kha_f_00) → список клипов (по id каталога);
  `motion-analysis/data/hscene-table.json` — сцена → female_ctrl / male_ctrl + название сцены.

Названия сцен (150 уникальных) прямо описывают действие: 正常位 (миссионерская), 後背位 (сзади),
騎乗位 (наездница), パイズリ (между грудей), 手コキ (рукой), フェラ (орально), クンニ, 手マン и т.д.
Разбираем их композиционно: акт + поза + место.

Запуск: python3 scene-act-map.py [--out ../data/h-act-from-scenes.json]
"""
import argparse
import collections
import gzip
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# главный акт (порядок важен: «пайзури+фелла» → пайзури как ведущий)
ACT = [
    ('パイズリ', 'paizuri'), ('Wフェラ', 'double_fellatio'), ('フェラ', 'oral'),
    ('クンニ', 'cunnilingus'), ('手マン', 'fingering'), ('手コキ', 'handjob'),
    ('足コキ', 'footjob'), ('オナニー', 'masturbation'), ('愛撫', 'foreplay'),
    ('亀頭いじり', 'glans_play'), ('玉舐め', 'ball_licking'),
    ('正常位', 'vaginal'), ('後背位', 'vaginal'), ('騎乗位', 'vaginal'), ('側位', 'vaginal'),
    ('立位', 'vaginal'), ('駅弁', 'vaginal'), ('寝バック', 'vaginal'), ('種付けプレス', 'vaginal'),
    ('対面座位', 'vaginal'), ('背面座位', 'vaginal'), ('椅子対面', 'vaginal'), ('椅子背面', 'vaginal'),
    ('椅子バック', 'vaginal'), ('机バック', 'vaginal'), ('机寝位', 'vaginal'), ('机側位', 'vaginal'),
    ('壁バック', 'vaginal'), ('壁対面', 'vaginal'), ('プールバック', 'vaginal'),
    ('箱バック', 'vaginal'), ('押し付けバック', 'vaginal'), ('ソファ騎乗位', 'vaginal'),
    ('マングリ正常位', 'vaginal'), ('ブリッジ正常位', 'vaginal'), ('伏せ後背位', 'vaginal'),
    ('手つなぎ騎乗位', 'vaginal'), ('背面騎乗位', 'vaginal'), ('背面側位', 'vaginal'),
    ('ディルド', 'toy_play'), ('ローター', 'toy_play'), ('覗き', 'peeping'),
    ('具合わせ', 'mutual'), ('互い弄り', 'mutual'),
    ('先舐め', 'oral'), ('竿舐め', 'oral'), ('ノーハンド', 'oral'),
    ('バック', 'vaginal'), ('ピストン', 'vaginal'), ('手付きバック', 'vaginal'),
]
# поза/место — вторичные признаки
POSTURE = [
    ('立ち', 'standing'), ('椅子', 'chair'), ('机', 'desk'), ('壁', 'wall'), ('床', 'floor'),
    ('正座', 'seiza'), ('膝立て', 'kneeling'), ('寝バック', 'prone'), ('伏せ', 'prone'),
    ('駅弁', 'standing_carry'), ('お姫様抱っこ', 'carried'), ('ソファ', 'sofa'),
    ('プール', 'pool'), ('ネット', 'net'), ('シャワー', 'shower'), ('トイレ', 'toilet'),
    ('フェンス', 'fence'), ('箱', 'box'), ('ベンチ', 'bench'), ('卓球台', 'table'),
    ('バナナボート', 'float'), ('ビーチボール', 'float'), ('浮き輪', 'float'),
    ('本棚', 'shelf'), ('座位', 'seated'),
]
HAND = ('手コキ', 'フェラ', '手マン', 'クンニ', 'パイズリ', '愛撫', '亀頭いじり', '足コキ')



# поза (позиция) — из названия сцены; порядок: от частного к общему
POSITION = [
    ('マングリ正常位', 'missionary_legs_up'), ('膝抱え正常位', 'missionary_knees_held'),
    ('大股開き正常位', 'missionary_wide'), ('腰抱え正常位', 'missionary_waist_held'),
    ('ブリッジ正常位', 'missionary_bridge'), ('開脚正常位', 'missionary_spread'),
    ('正常位', 'missionary'),
    ('腕引っ張り後背位', 'doggy_arms_pulled'), ('寝バック', 'prone_doggy'), ('伏せ後背位', 'prone_doggy'),
    ('立ちバック', 'standing_doggy'), ('後背位', 'doggy'),
    ('背面騎乗位', 'reverse_cowgirl'), ('騎乗位', 'cowgirl'),
    ('背面側位', 'spooning'), ('側位', 'spooning'),
    ('駅弁', 'standing_carry'), ('立位', 'standing'),
    ('対面座位', 'face_to_face_seated'), ('背面座位', 'rear_seated'),
    ('種付けプレス', 'breeding_press'), ('机寝位', 'desk_lying'),
    ('杭打ちピストン', 'cowgirl'),
]
# места/мебель, если позиция не названа прямо
PLACE_POSITION = [('椅子バック', 'doggy'), ('椅子対面', 'face_to_face_seated'), ('椅子背面', 'rear_seated'),
                  ('机バック', 'doggy'), ('壁バック', 'doggy'), ('机側位', 'spooning')]


def position_of(name):
    for k, v in POSITION:
        if k in name:
            return v
    for k, v in PLACE_POSITION:
        if k in name:
            return v
    return None

def classify(name):
    act = None
    for k, v in ACT:
        if k in name:
            act = v
            break
    posture = None
    for k, v in POSTURE:
        if k in name:
            posture = v
            break
    # уточнение: «手コキ＆フェラ» — ведущий ручной
    if '足コキ' in name and '手コキ' in name:
        act = 'handjob+footjob'
    if not act and ('入れ替え' in name or 'Wフェラ' in name):
        act = 'oral'
    return act, posture


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--out', default=os.path.join(ROOT, 'motion-analysis/data/h-act-from-scenes.json'))
    a = ap.parse_args()

    # 1. контроллер → клипы
    ctrls = json.load(open(os.path.join(ROOT, 'animation-links/controllers.json')))
    ctrl_clips = {}
    for c in ctrls['controllers']:
        p = os.path.join(ROOT, 'animation-links', c['asset'])
        if not os.path.exists(p):
            continue
        raw = json.load(gzip.open(p, 'rt'))
        ctrl_clips[c['name']] = [x['clip'] for x in raw.get('clips', []) if x.get('clip')]

    # 2. сцены → названия и контроллеры
    scenes = json.load(open(os.path.join(ROOT, 'motion-analysis/data/hscene-table.json')))
    scene_rows = []
    for s in scenes:
        act, posture = classify(s['name'])
        pos = position_of(s['name'])
        scene_rows.append({'scene': s['name'], 'act': act, 'posture': posture, 'position': pos,
                           'female_ctrl': s.get('female_ctrl'), 'male_ctrl': s.get('male_ctrl'),
                           'bundle': s.get('female_path')})

    # 3. клип → сцены
    clip_scenes = collections.defaultdict(list)
    for s in scene_rows:
        for side in ('female_ctrl', 'male_ctrl'):
            for cid in ctrl_clips.get(s[side] or '', []):
                clip_scenes[cid].append({'scene': s['scene'], 'act': s['act'], 'posture': s['posture'],
                                         'position': s['position'],
                                         'side': 'female' if side == 'female_ctrl' else 'male'})

    cat = json.load(open(os.path.join(ROOT, 'animations/catalog.json')))
    h = [c for c in cat['clips'] if c.get('category') == 'h' and c.get('playable')]

    rows, acts = [], collections.Counter()
    for c in h:
        sc = clip_scenes.get(c['id'], [])
        acts_here = sorted({x['act'] for x in sc if x['act']})
        post_here = sorted({x['posture'] for x in sc if x['posture']})
        act = acts_here[0] if len(acts_here) == 1 else (acts_here[0] if acts_here else None)
        if act:
            acts[act] += 1
        rows.append({'id': c['id'], 'name': c['name'], 'rig': c.get('rig'),
                     'act': act, 'actAmbiguous': len(acts_here) > 1,
                     'position': next((x['position'] for x in sc if x.get('position')), None),
                     'scenes': [x['scene'] for x in sc][:6], 'postures': post_here})

    covered = sum(1 for r in rows if r['act'])
    doc = {'format': 'h-act-from-scenes/1', 'total': len(h), 'covered': covered,
           'coverage': round(covered / len(h) * 100, 1),
           'acts': dict(acts.most_common()), 'scenes': len(scene_rows),
           'scenesWithoutAct': [s['scene'] for s in scene_rows if not s['act']],
           'rows': rows}
    json.dump(doc, open(a.out, 'w'), ensure_ascii=False)

    print(f'сцен: {len(scene_rows)} · клипов: {len(h)} · акт из сцены: {covered} ({doc["coverage"]}%)')
    print('\nакты:')
    for k, v in acts.most_common():
        print(f'   {k:16} {v:5}  {round(v/len(h)*100):3}%')
    if doc['scenesWithoutAct']:
        print('\nсцены без распознанного акта:', doc['scenesWithoutAct'][:10])
    print('\nпримеры:')
    for r in rows[:5]:
        print(f"   {r['name']:22} → {str(r['act']):14} сцены: {', '.join(r['scenes'][:2])}")


if __name__ == '__main__':
    main()
