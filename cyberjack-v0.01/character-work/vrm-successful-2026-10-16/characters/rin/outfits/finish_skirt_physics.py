import json,struct,copy
from pathlib import Path
BUNDLE=next(p for p in Path(__file__).resolve().parents if (p/"BUNDLE_ROOT").exists())
OUT=Path(__file__).resolve().parent
def read(path):
 b=Path(path).read_bytes();l=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+l]),b[20+l:]
src,_=read(OUT.parent/'legacy'/'Rin_restored_v2.vrm');dst,tail=read(OUT/'Rin_outfit_00.vrm');byname={n.get('name'):i for i,n in enumerate(dst['nodes'])};source=src['extensions']['VRMC_springBone'];target=dst['extensions']['VRMC_springBone']
mapnode=lambda i:byname[src['nodes'][i]['name']]
groups={}
def group(i):
 if i not in groups:
  spec=copy.deepcopy(source['colliderGroups'][i]);refs=[]
  for idx in spec['colliders']:
   c=copy.deepcopy(source['colliders'][idx]);c['node']=mapnode(c['node']);refs.append(len(target['colliders']));target['colliders'].append(c)
  spec['colliders']=refs;groups[i]=len(target['colliderGroups']);target['colliderGroups'].append(spec)
 return groups[i]
skirts=[]
for s in source['springs']:
 if not any('sk_' in src['nodes'][j['node']]['name'] for j in s['joints']):continue
 s=copy.deepcopy(s)
 if 'center' in s:s['center']=mapnode(s['center'])
 for j in s['joints']:j['node']=mapnode(j['node'])
 s['colliderGroups']=[group(i) for i in s.get('colliderGroups',[])];skirts.append(s)
target['springs']=[s for s in target['springs'] if not any('sk_' in dst['nodes'][j['node']]['name'] for j in s['joints'])]+skirts
dst['extensions']['VRMC_vrm']['meta']['version']='2.1 four outfits, full skirt chains'
j=json.dumps(dst,ensure_ascii=False,separators=(',',':')).encode();j+=b' '*((-len(j))%4);data=struct.pack('<4sII',b'glTF',2,20+len(j)+len(tail))+struct.pack('<I4s',len(j),b'JSON')+j+tail;(OUT/'Rin_outfit_00.vrm').write_bytes(data)
print('SKIRT_UPDATED',len(skirts),len(target['colliders']))
