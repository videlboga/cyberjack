"""Link library clips to the game's own positions via the H-scene AnimatorControllers.

For every H animation bundle the game ships controllers named after the position's animation file
(e.g. khs_f_00). Each controller lists the clips it can play, which is exactly the "which layers belong to
this position" relation that the clip names alone cannot give. The matching position record (mode, id,
Japanese name, base controller) comes from data/hscene-bases.json.
"""
import json
import os
from pathlib import Path

import UnityPy

root = Path(__file__).resolve().parents[2]
data = root / 'motion-analysis/data'
bases = json.load(open(data / 'hscene-bases.json'))['positions']

# controller name -> position record(s)
by_controller = {}
for pos in bases:
    for side in ('female', 'male'):
        name = pos[side]['anim'].get('file')
        if name:
            by_controller.setdefault(name, []).append({'mode': pos['mode'], 'id': pos['id'], 'nameJa': pos['nameJa'], 'side': side, 'base': pos[side]['base'].get('file')})

game = Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata')
links = {}
controllers_seen = 0
matched = 0
for side in ('female', 'male'):
    folder = game / 'h/anim' / side
    if not folder.exists():
        continue
    for bundle in sorted(folder.glob('*.unity3d')):
        env = UnityPy.load(str(bundle))
        for obj in env.objects:
            if obj.type.name != 'AnimatorController':
                continue
            try:
                ctrl = obj.read()
            except Exception:
                continue
            controllers_seen += 1
            name = ctrl.m_Name
            positions = by_controller.get(name)
            if not positions:
                continue
            matched += 1
            clips = []
            for pptr in ctrl.m_AnimationClips or []:
                try:
                    clips.append(pptr.read().m_Name)
                except Exception:
                    continue
            for clip in clips:
                entry = links.setdefault(clip, {'positions': [], 'controller': name, 'bundle': f'h/anim/{side}/{bundle.name}'})
                for pos in positions:
                    if pos not in entry['positions']:
                        entry['positions'].append(pos)

out = {
    'format': 'layer-links-v1',
    'source': 'abdata h/anim AnimatorControllers',
    'controllersSeen': controllers_seen,
    'controllersMatched': matched,
    'clips': links,
}
(data / 'layer-links.json').write_text(json.dumps(out, ensure_ascii=False))
print('контроллеров просмотрено:', controllers_seen, '| сопоставлено с позициями:', matched, '| клипов привязано:', len(links))
sample = list(links.items())[:3]
for clip, info in sample:
    print('  ', clip, '→', [(p['mode'], p['id'], p['nameJa']) for p in info['positions']][:2])
