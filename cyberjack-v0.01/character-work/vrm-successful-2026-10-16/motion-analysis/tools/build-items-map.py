"""Complete item map for H scenes: what item exists, what it replaces or presses, and which bone holds it.

Three data sources:
  * AibuItemObject (h/list): 9 aibu items — hands, fingers, tongue, denma L/R, vibe — with kind/setKind.
  * AibuLayerData aibulayer_00..05 (h/list): per-area layers, each naming two item ids and two parent bones.
  * item_* records (h/list): map props with their own lstParent bone.
"""
import json
from pathlib import Path

import UnityPy

root = Path(__file__).resolve().parents[2]
game = Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/'
            '[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata')

# k_f_* attachment frames -> bones available in the library preview rig
bone_alias = {
    'k_f_kosi02': 'cf_j_waist02',
    'k_f_siriL': 'cf_j_waist02',
    'k_f_siriR': 'cf_j_waist02',
    'k_f_mune03L': 'cf_j_spine03',
    'k_f_mune03R': 'cf_j_spine03',
    'k_f_handL': 'cf_j_hand_L',
    'k_f_handR': 'cf_j_hand_R',
}

aibu = []
layers = []
props = []
for bundle in sorted((game / 'h/list').glob('*.unity3d')):
    env = UnityPy.load(str(bundle))
    for obj in env.objects:
        if obj.type.name != 'MonoBehaviour':
            continue
        try:
            record = obj.read_typetree()
        except Exception:
            continue
        name = record.get('m_Name') or ''
        params = record.get('param') or []
        if name == 'AibuItemObject':
            for entry in params:
                aibu.append({
                    'id': entry.get('id'),
                    'kind': entry.get('objKind'),
                    'set': entry.get('setKind'),
                    'asset': entry.get('asset'),
                    'object': entry.get('nomalObj'),
                    'bundle': entry.get('bundle'),
                    'manifest': entry.get('manifest'),
                })
        elif name.startswith('aibulayer_'):
            area = int(name.split('_')[-1])
            for entry in params:
                parents = entry.get('nameParents') or []
                def resolve(name):
                    for prefix, bone in bone_alias.items():
                        if (name or '').startswith(prefix):
                            return bone
                    return None
                resolved = [resolve(p) for p in parents]
                layers.append({
                    'area': area,
                    'id': entry.get('id'),
                    'items': entry.get('idObjects') or [],
                    'parents': parents,
                    'bones': resolved,
                    'useKind': entry.get('useKind'),
                })
        elif name.startswith('item_'):
            for entry in params:
                props.append({
                    'name': name,
                    'asset': entry.get('pathAssetObject'),
                    'object': entry.get('nameObject'),
                    'animAsset': entry.get('pathAssetAnimator') or None,
                    'animName': entry.get('nameAnimator') or None,
                    'parents': [
                        {'toWhom': p.get('numToWhomParent'), 'bone': p.get('nameParent')}
                        for p in (entry.get('lstParent') or [])
                    ],
                })

kind_names = {0: 'кисть (подмена)', 1: 'палец', 2: 'язык', 3: 'вибратор', 4: 'вайб'}
out = {
    'format': 'items-map-v1',
    'aibu': aibu,
    'kinds': kind_names,
    'layers': sorted(layers, key=lambda x: (x['area'], x['id'])),
    'props': props,
    'boneAlias': bone_alias,
}
(root / 'motion-analysis/data/items-map.json').write_text(json.dumps(out, ensure_ascii=False))

print('aibu-предметов:', len(aibu), '| слоёв:', len(layers), '| записей item_*:', len(props))
for item in aibu:
    where = [l for l in layers if item['id'] in l['items']]
    bones = sorted({','.join([b for b in l['bones'] if b]) for l in where})
    print(f"  id {item['id']:>2} {kind_names.get(item['kind'], item['kind']):<16} {item['asset']:<18} "
          f"слои: {[l['area'] for l in where] or '—'} | кости: {bones or ['—']}")
