"""Build the position → base-animation table from the game's own AnimationInfo assets.

Every AnimationInfo record carries pathFemaleBase / pathMaleBase (the base pose for the position) and
paramFemale.path / paramMale.path (the position's own animation file). The mapping was always in the
assets; this tool only lifts it out so layers can be paired with the pose they were authored for.
"""
import gzip
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]  # project root: bundles, animation-links, motion-analysis/
links = json.load(open(root / 'animation-links/scenes.json'))
rows = []
for table in links['tables']:
    if not table['name'].startswith('AnimationInfo_'):
        continue
    payload = json.loads(gzip.open(root / 'animation-links' / table['asset'], 'rb').read())
    data = payload.get('data') or {}
    for rec in data.get('param') or []:
        def path_of(key):
            value = rec.get(key) or {}
            path = value.get('path') if isinstance(value, dict) and 'path' in value else value
            if not isinstance(path, dict):
                return {'asset': None, 'file': None}
            return {'asset': path.get('assetpath') or None, 'file': path.get('file') or None}

        rows.append({
            'mode': int(table['name'].split('_')[-1]),
            'id': rec.get('id'),
            'nameJa': rec.get('nameAnimation'),
            'posture': rec.get('posture'),
            'female': {
                'base': path_of('pathFemaleBase'),
                'anim': path_of('paramFemale'),
            },
            'male': {
                'base': path_of('pathMaleBase'),
                'anim': path_of('paramMale'),
            },
        })

out = root / 'motion-analysis/data/hscene-bases.json'
out.write_text(json.dumps({'format': 'hscene-bases-v1', 'source': 'animation-links/scenes.json', 'positions': rows}, ensure_ascii=False))
print('позиций:', len(rows), '| с базой female:', sum(1 for r in rows if r['female']['base']['file']), '| male:', sum(1 for r in rows if r['male']['base']['file']))
print('пример:', json.dumps(rows[0], ensure_ascii=False)[:300])
