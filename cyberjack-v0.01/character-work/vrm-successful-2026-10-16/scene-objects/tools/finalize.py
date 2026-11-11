"""Normalize glTF preview vectors, add world placement and verify references."""
from pathlib import Path
import json,gzip,struct,numpy as np,shutil,collections
B=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16');O=B/'scene-objects'
def load(p):
 return json.load(gzip.open(p,'rt')) if p.suffix=='.gz' else json.load(open(p))
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2))
def trs(d):
 p=d['m_LocalPosition'];q=d['m_LocalRotation'];s=d['m_LocalScale'];x,y,z,w=[q[k] for k in 'xyzw'];n=(x*x+y*y+z*z+w*w)**.5;x,y,z,w=[v/n for v in (x,y,z,w)]
 m=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w),p['x']],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w),p['y']],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y),p['z']],[0,0,0,1]],dtype=float)
 m[:3,:3]=m[:3,:3]@np.diag([s[k] for k in 'xyz']);return m
catalog=load(O/'catalog.json');fixed=0
for p in (O/'models').glob('*.glb'):
 b=p.read_bytes();length=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+length]);offset=20+length;binary=bytearray(b[offset+8:]);changed=False
 positionids={prim['attributes']['POSITION'] for mesh in doc.get('meshes',[]) for prim in mesh['primitives']}
 for ai in positionids:
  a=doc['accessors'][ai];v=doc['bufferViews'][a['bufferView']];off=v.get('byteOffset',0)+a.get('byteOffset',0)
  if v['byteLength']==a['count']*16 and not v.get('byteStride'):
   arr=np.frombuffer(binary,dtype='<f4',count=a['count']*4,offset=off).reshape(-1,4)[:,:3].copy();binary[off:off+arr.nbytes]=arr.tobytes();v['byteLength']=arr.nbytes;a['min']=arr.min(axis=0).tolist();a['max']=arr.max(axis=0).tolist();changed=True
 normalids={prim['attributes']['NORMAL'] for mesh in doc.get('meshes',[]) for prim in mesh['primitives'] if 'NORMAL' in prim['attributes']}
 for ni in normalids:
  a=doc['accessors'][ni];v=doc['bufferViews'][a['bufferView']];off=v.get('byteOffset',0)+a.get('byteOffset',0);
  if v['byteLength']==a['count']*16 and not v.get('byteStride'):
   arr=np.frombuffer(binary,dtype='<f4',count=a['count']*4,offset=off).reshape(-1,4)[:,:3].copy();binary[off:off+arr.nbytes]=arr.tobytes();v['byteLength']=arr.nbytes;changed=True
  arr=np.ndarray((a['count'],3),dtype='<f4',buffer=binary,offset=off,strides=(v.get('byteStride',12),4));norm=np.linalg.norm(arr,axis=1)
  if np.any(np.abs(norm-1)>1e-5):arr[norm>1e-10]/=norm[norm>1e-10,None];arr[norm<=1e-10]=[0,1,0];changed=True
 for node in doc.get('nodes',[]):
  if 'rotation' in node:
   q=np.array(node['rotation']);n=np.linalg.norm(q)
   if abs(n-1)>1e-6:node['rotation']=(q/n).tolist();changed=True
 if changed:
  js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4)
  p.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary);fixed+=1
byid={f['id']:f for f in catalog['furniture']};interactions=[]
for maprow in catalog['maps']:
 data=load(O/maprow['native']);records={r['identity']:r for r in data['objects']};cache={}
 def world(key,visited=None):
  if key in cache:return cache[key]
  row=records.get(key)
  if not row:return np.eye(4)
  d=row['data'];m=trs(d);parent=d['m_Father'];visited=set(visited or ())
  if key in visited:raise ValueError('transform cycle')
  visited.add(key)
  if parent['m_PathID'] and parent['m_FileID']==0:m=world(key.rsplit(':',1)[0]+':'+str(parent['m_PathID']),visited)@m
  cache[key]=m;return m
 for id in maprow['furniture']:
  f=byid[id];raw=load(O/f['native']);tr=next((c for c in raw['nodes'][0]['components'] if c['type']=='Transform'),None)
  if tr:
   mat=world(tr['identity']);f['worldMatrixUnity']=mat.T.reshape(-1).tolist();f['worldPositionUnity']=mat[:3,3].tolist()
 for key,row in records.items():
  d=row['data']
  if row['type']=='MonoBehaviour' and '_categoryes' in d:
   prefix=key.rsplit(':',1)[0];go=records.get(prefix+':'+str(d.get('m_GameObject',{}).get('m_PathID',0)),{}).get('data',{})
   interactions.append({'source':maprow['source'],'identity':key,'name':go.get('m_Name',''),'data':d})
controllerindex={c['id']:c for c in json.load(open(B/'animation-links/controllers.json'))['controllers']}
resolved=[];unresolved=[]
for table in catalog['itemTables']:
 for r in table['data']['param']:
  if r.get('nameAnimator'):
   row={'table':table['data']['m_Name'],'object':r['nameObject'],'animator':r['nameAnimator'],'controllers':r['controllers']}
   row['assets']=[{'id':id,'asset':'../animation-links/'+controllerindex[id]['asset'],'states':controllerindex[id]['states'],'clips':controllerindex[id]['clips'],'resolvedClips':controllerindex[id]['resolved']} for id in r['controllers']]
   (resolved if row['controllers'] else unresolved).append(row)
catalog['mapInteractions']='map-interactions.json';catalog['animationLinks']='animation-links.json';catalog['previewNotes']=['Original shaders are preserved; GLB uses an approximate PBR material.','Native object colliders and scripts are preserved, but GLB does not implement Unity physics.','Invisible placement/helper roots intentionally have no GLB.','Furniture count is map instances, not unique furniture designs.']
write(O/'map-interactions.json',{'format':'koikatsu-map-interactions-v1','interactions':interactions});write(O/'animation-links.json',{'format':'koikatsu-object-animation-links-v1','resolved':resolved,'unresolved':unresolved})
write(O/'catalog.json',catalog)
report=load(O/'reports/extraction.json');report.update({'previewVectorsNormalized':fixed,'animatedItemRows':len(resolved)+len(unresolved),'unresolvedAnimatorRows':unresolved,'mapInteractions':len(interactions),'propModels':sum('model' in r for r in catalog['objects']),'helperRootsWithoutGeometry':[r['name'] for r in catalog['objects'] if 'model' not in r]})
write(O/'reports/extraction.json',report)
print(json.dumps({k:v for k,v in report.items() if k!='errors'},ensure_ascii=False))
