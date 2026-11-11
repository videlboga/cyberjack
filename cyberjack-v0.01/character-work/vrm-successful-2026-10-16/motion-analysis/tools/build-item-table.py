"""The game's item table: which prefab and which animator an H-scene item name resolves to.

`h/list/*.unity3d` stores these records as MonoBehaviours named `item_*`; each `param` entry names the
owning manifest, the prefab bundle and object, an optional item animation, and the bones it attaches to.
"""
import json
from pathlib import Path

import UnityPy

root = Path(__file__).resolve().parents[2]
game = Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/'
            '[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata')

table = {}
sources = {}
for bundle in sorted((game / 'h/list').glob('*.unity3d')):
    env = UnityPy.load(str(bundle))
    found = 0
    for obj in env.objects:
        if obj.type.name != 'MonoBehaviour':
            continue
        try:
            record = obj.read_typetree()
        except Exception:
            continue
        name = record.get('m_Name') or ''
        if not name.startswith('item_'):
            continue
        params = []
        for item in record.get('param') or []:
            params.append({
                'manifest': item.get('manifest'),
                'asset': item.get('pathAssetObject'),
                'object': item.get('nameObject'),
                'animAsset': item.get('pathAssetAnimator') or None,
                'animName': item.get('nameAnimator') or None,
                'parents': [
                    {'toWhom': p.get('numToWhomParent'), 'bone': p.get('nameParent'), 'self': p.get('nameSelf')}
                    for p in (item.get('lstParent') or [])
                ],
                'rotate': item.get('rotate'),
                'position': item.get('vPosition'),
                'scale': item.get('vScale'),
            })
        table[name] = {'bundle': bundle.name, 'params': params}
        found += 1
    sources[bundle.name] = found

out = root / 'motion-analysis/data/item-table.json'
out.write_text(json.dumps({'format': 'item-table-v1', 'items': table, 'perBundle': sources}, ensure_ascii=False))
prefabs = {(p['asset'], p['object']) for rec in table.values() for p in rec['params']}
print('предметов в таблице:', len(table), '| по бандлам:', sources)
print('различных префабов:', len(prefabs))
for asset, obj in sorted(prefabs)[:10]:
    print('  ', asset, obj)
