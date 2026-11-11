"""Extract repeatable lip edge chains from the immutable prepared VRM face."""
import json,struct,collections,hashlib
from pathlib import Path
b=Path('assets/heads/mira/head.vrm').read_bytes();l=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+l]);pr=doc['meshes'][0]['primitives'][0]
def read(k):
 a=doc['accessors'][k];v=doc['bufferViews'][a['bufferView']];n={'SCALAR':1,'VEC3':3}[a['type']];f={5126:'f',5123:'H',5125:'I'}[a['componentType']];o=28+l+v.get('byteOffset',0)+a.get('byteOffset',0);return list(struct.iter_unpack('<'+f*n,b[o:o+a['count']*struct.calcsize('<'+f*n)]))
original=read(pr['attributes']['POSITION']);idx=[v[0] for v in read(pr['indices'])];keys={};pos=[];ids=[]
for q in original:
 key=tuple(round(v,6) for v in q)
 if key not in keys:keys[key]=len(pos);pos.append(q)
 ids.append(keys[key])
adj=collections.defaultdict(set)
for k in range(0,len(idx),3):
 a,c,d=[ids[v] for v in idx[k:k+3]]
 for x,y in [(a,c),(c,d),(d,a)]:adj[x].add(y);adj[y].add(x)
rows={}
for name,cy,cz in [('upper',1.43817,.0666),('upperSeam',1.43631,.06438),('lowerSeam',1.43415,.06299),('lower',1.43115,.0611)]:
 root=min(range(len(pos)),key=lambda i:pos[i][0]**2+(pos[i][1]-cy)**2+(pos[i][2]-cz)**2);chains=[]
 for direction in [-1,1]:
  chain=[root]
  while abs(pos[chain[-1]][0])<.014:
   x,y,z=pos[chain[-1]];cand=[i for i in adj[chain[-1]] if direction*(pos[i][0]-x)>.0001 and 1.425<pos[i][1]<1.445 and pos[i][2]>.05]
   if not cand:break
   chain.append(min(cand,key=lambda i:((pos[i][1]-y)**2+(pos[i][2]-z)**2)/(pos[i][0]-x)**2))
  chains.extend(chain)
 rows[name]=[{'vertex':next(i for i,v in enumerate(ids) if v==k),'position':pos[k]} for k in sorted(set(chains),key=lambda i:pos[i][0])]
result={'sourceSha256':hashlib.sha256(b).hexdigest(),'primitive':0,'rows':rows}
Path('assets/heads/mira/mouth-bindings.json').write_text(json.dumps(result,indent=2))
Path('viewer-mouth-binding-data.js').write_text('export const mouthBindings='+json.dumps(result,separators=(',',':'))+';\n')
print({name:len(row) for name,row in rows.items()})
