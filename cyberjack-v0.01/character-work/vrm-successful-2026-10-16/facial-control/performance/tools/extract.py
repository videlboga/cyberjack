"""Rebuild performance catalog from preserved Unity bundles. Requires UnityPy."""
import UnityPy,json,zlib
from pathlib import Path
B=Path(__file__).resolve().parents[3];out=B/'facial-control/performance'
def extract(relative,accept):
 e=UnityPy.load(str(B/'animations/sources'/relative));objects={o.path_id:o for o in e.objects};ts={i:o.read_typetree() for i,o in objects.items() if o.type.name=='Transform'};names={i:objects[d['m_GameObject']['m_PathID']].read_typetree()['m_Name'] for i,d in ts.items()}
 def path(i):
  p=ts[i]['m_Father']['m_PathID'];return (path(p)+'/' if p in ts else '')+names[i]
 rows=[];hashes={}
 for i,d in ts.items():
  p=path(i)
  if not accept(p):continue
  rows.append(dict(path=p,name=names[i],parent=names.get(d['m_Father']['m_PathID']),position=list(d['m_LocalPosition'].values()),rotation=list(d['m_LocalRotation'].values()),scale=list(d['m_LocalScale'].values())))
  parts=p.split('/')
  for j in range(len(parts)):
   suffix='/'.join(parts[j:]);hashes[str(zlib.crc32(suffix.encode()))]=suffix
 return e,rows,hashes
_,native,paths=extract('chara/oo_base.unity3d',lambda p:p=='p_tang2' or p.startswith('p_tang2/'))
e,item,_=extract('h/common/01.unity3d',lambda p:'cf_j_tangroot' in p)
avatar=next(o.read_typetree() for o in e.objects if o.type.name=='Avatar' and o.read_typetree()['m_Name']=='osawari_tangAvatar');itempaths={str(k):v for k,v in avatar['m_TOS']}
clips=json.loads((B/'animations/catalog.json').read_text())['clips'];selected=[];seen=set()
for c in sorted(clips,key=lambda c:(c['source'],c['name'])):
 kind='native' if c['source']=='chara/oo_base.unity3d' and c['name'] in ('ptn01','ptn02') else 'item' if c['source'] in ('h/anim/parts/01_00.unity3d','h/anim/parts/71_00.unity3d') and c['name'].startswith('Sita_') else None
 if kind and (kind,c['name']) not in seen:selected.append({**c,'kind':kind});seen.add((kind,c['name']))
data={'format':'koikatsu-performance-v1','rigs':{'native':native,'item':item},'paths':{'native':paths,'item':itempaths},'clips':selected,'profiles':{id:{'asset':f'assets/{id}-tongue.glb'} for id in ['rin','mira']}}
(out/'catalog.json').write_text(json.dumps(data,ensure_ascii=False,indent=2));print(len(selected),'clips;',len(native),len(item),'rest transforms')
