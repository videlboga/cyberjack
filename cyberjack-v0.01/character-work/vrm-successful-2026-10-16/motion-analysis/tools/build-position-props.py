"""Props and partner data for every H position, straight from the game's AnimationInfo tables.

Each record already carries what the scene needs besides the bodies: hit colliders, hit objects, the item
(道具), the neck motion, the camera and the second character's paths. They were unused until now.
"""
import gzip
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
links = json.load(open(root / 'animation-links/scenes.json'))
rows = []
for table in links['tables']:
    if not table['name'].startswith('AnimationInfo_'):
        continue
    payload = json.loads(gzip.open(root / 'animation-links' / table['asset'], 'rb').read())
    for rec in (payload.get('data') or {}).get('param') or []:
        def side(key):
            value = rec.get(key) or {}
            path = value.get('path') or {}
            return {
                'animAsset': path.get('assetpath') or None,
                'animFile': path.get('file') or None,
                'hit': value.get('fileHit') or None,
                'hitObject': value.get('fileHitObject') or None,
                'item': value.get('fileItem') or None,
                'neck': value.get('fileMotionNeck') or None,
                'camera': value.get('nameCamera') or None,
                'yure': value.get('fileYure') or None,
                'layers': value.get('lstIdLayer') or [],
                'frontBehind': value.get('lstFrontAndBehind') or [],
            }

        rows.append({
            'mode': int(table['name'].split('_')[-1]),
            'id': rec.get('id'),
            'nameJa': rec.get('nameAnimation'),
            'posture': rec.get('posture'),
            'female': side('paramFemale'),
            'male': side('paramMale'),
            'maleBase': (rec.get('pathMaleBase') or {}).get('file') or None,
            'femaleBase': (rec.get('pathFemaleBase') or {}).get('file') or None,
            'second': (rec.get('pathSecondChar') or {}).get('file') or None,
            'useDesk': rec.get('useDesk'),
            'useChair': rec.get('useChair'),
            'mapObjectNull': rec.get('pathMapObjectNull'),
        })

out = root / 'motion-analysis/data/position-props.json'
out.write_text(json.dumps({'format': 'position-props-v1', 'positions': rows}, ensure_ascii=False))
with_items = [r for r in rows if r['female']['item'] or r['male']['item']]
with_male = [r for r in rows if r['male']['animFile']]
print('позиций:', len(rows), '| с предметом:', len(with_items), '| с мужским персонажем:', len(with_male))
print('пример предметов:', sorted({r['female']['item'] or r['male']['item'] for r in with_items})[:12])
