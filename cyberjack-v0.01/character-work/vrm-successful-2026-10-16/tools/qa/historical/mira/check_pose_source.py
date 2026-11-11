import importlib.util,json,numpy as np
from pathlib import Path
p=Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/Export_PMX/20261016013030_KamiwataKrista')
spec=importlib.util.spec_from_file_location('pmx_file','/home/cyberkitty/.config/blender/5.2/extensions/user_default/mmd_tools/core/pmx/__init__.py');pmx=importlib.util.module_from_spec(spec);spec.loader.exec_module(pmx);model=pmx.load(str(p/'model.pmx'))
parents={b.name:(model.bones[b.parent].name if b.parent>=0 and model.bones[b.parent].name!=b.name else None) for b in model.bones};info={x['boneName']:x for x in json.loads((p/'KK_EditBoneInfo.json').read_text())};cache={}
def w(n):
 if n in cache:return cache[n]
 x=info[n];par=parents.get(n);cache[n]=(w(par) if par in info else np.eye(4))@np.array(x['transform']).reshape(4,4);return cache[n]
diffs=sorted([(float(np.max(np.abs(w(n)-np.array(x['worldTransform']).reshape(4,4)))),n) for n,x in info.items() if n in parents],reverse=True)
print('bones',len(model.bones),'parents',list(parents.items())[:4]);print('worst current world recompute',diffs[:10]);print('PMX vertex bounds',np.min([v.co for v in model.vertices],axis=0),np.max([v.co for v in model.vertices],axis=0));Path('work/krista/source_parents.json').write_text(json.dumps(parents))
for n in ['cf_j_hips','cf_j_arm00_L','cf_j_forearm01_L','cf_j_hand_L','cf_j_thigh00_L','cf_j_leg01_L','cf_J_hairB_04']:
 print(n,'parent',parents.get(n),'diff',np.max(np.abs(w(n)-np.array(info[n]['worldTransform']).reshape(4,4))))
for i in range(4):
 m=pmx.load(str(p/f'Outfit {i:02}'/'model.pmx'));by={b.name:b for b in m.bones};print('OUTFIT',i,[(n,by[n].location) for n in ['cf_j_arm00_L','cf_j_forearm01_L','cf_j_hand_L','cf_j_thigh00_L','cf_j_leg01_L','cf_j_foot_L'] if n in by])
print('BODY',[(n,b.location) for n,b in {b.name:b for b in model.bones}.items() if n in ['cf_j_arm00_L','cf_j_forearm01_L','cf_j_hand_L','cf_j_thigh00_L','cf_j_leg01_L','cf_j_foot_L']])
