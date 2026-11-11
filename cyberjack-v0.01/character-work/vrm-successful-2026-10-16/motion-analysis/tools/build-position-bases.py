"""For every position, record its controller's clip list and the base controller's clip list.

The base controller is a packed state machine we cannot evaluate offline, but it lists the clips it drives;
those clips are already in the library. So a usable base pose can be taken from that list instead of
re-implementing the controller.
"""
import json
from pathlib import Path

import UnityPy

root = Path(__file__).resolve().parents[2]
data = root / 'motion-analysis/data'
bases = json.load(open(data / 'hscene-bases.json'))['positions']
game = Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata')

by_controller = {}
for pos in bases:
    for side in ('female', 'male'):
        name = pos[side]['anim'].get('file')
        if name:
            by_controller.setdefault(name, []).append({'mode': pos['mode'], 'id': pos['id'], 'nameJa': pos['nameJa'], 'side': side, 'base': pos[side]['base'].get('file')})

per_position = {}
for side in ('female', 'male'):
    for bundle in sorted((game / 'h/anim' / side).glob('*.unity3d')):
        env = UnityPy.load(str(bundle))
        controllers = {}
        for obj in env.objects:
            if obj.type.name != 'AnimatorController':
                continue
            try:
                ctrl = obj.read()
            except Exception:
                continue
            clips = []
            for pptr in ctrl.m_AnimationClips or []:
                try:
                    clips.append(pptr.read().m_Name)
                except Exception:
                    continue
            controllers[ctrl.m_Name] = clips
        for name, clips in controllers.items():
            for pos in by_controller.get(name, []):
                base_clips = controllers.get(pos['base']) or []
                key = f"{pos['side']}/{pos['mode']}/{pos['id']}"
                per_position[key] = {
                    'mode': pos['mode'],
                    'id': pos['id'],
                    'side': pos['side'],
                    'nameJa': pos['nameJa'],
                    'controller': name,
                    'baseController': pos['base'],
                    'clips': clips,
                    'baseClips': base_clips,
                }

(data / 'position-bases.json').write_text(json.dumps({'format': 'position-bases-v1', 'positions': per_position}, ensure_ascii=False))
print('позиций с контроллерами:', len(per_position))
sample = next(iter(per_position.values()))
print('пример:', sample['nameJa'], '| клипов:', len(sample['clips']), '| базовых:', len(sample['baseClips']))
