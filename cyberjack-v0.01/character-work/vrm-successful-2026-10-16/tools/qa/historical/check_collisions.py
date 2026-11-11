import json,struct,numpy as np
from pathlib import Path
b=Path('outputs/Rin_restored.vrm').read_bytes();l=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+l]);nodes=d['nodes'];parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])}
def mat(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1]);r=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])
 m=np.eye(4);m[:3,:3]=r@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m
cache={}
def world(i):
 if i not in cache:cache[i]=(world(parents[i]) if i in parents else np.eye(4))@mat(nodes[i])
 return cache[i]
def pos(i,v=[0,0,0]):return (world(i)@np.array([*v,1]))[:3]
sb=d['extensions']['VRMC_springBone'];cols=[]
for i,c in enumerate(sb['colliders']):
 typ=next(iter(c['shape']));s=c['shape'][typ];a=pos(c['node'],s['offset']);z=pos(c['node'],s.get('tail',s['offset']));rad=s['radius']*max(np.linalg.norm(world(c['node'])[:3,:3],axis=0));cols.append((a,z,rad))
 print(i,nodes[c['node']]['name'],typ,'a',np.round(a,3),'b',np.round(z,3),'r',round(rad,3))
for s in sb['springs']:
 if 'sk_' not in s['name']:continue
 print('\nCHAIN',s['name'])
 for j in s['joints'][1:]:
  p=pos(j['node']);hits=[]
  for ci in sorted({ci for gi in s['colliderGroups'] for ci in sb['colliderGroups'][gi]['colliders']}):
   a,z,r=cols[ci];v=z-a;t=np.clip(np.dot(p-a,v)/np.dot(v,v),0,1) if np.dot(v,v)>1e-12 else 0;dist=np.linalg.norm(p-(a+t*v));pen=r+j.get('hitRadius',0)-dist
   if pen>0:hits.append((nodes[sb['colliders'][ci]['node']]['name'],round(float(pen),3)))
  print(nodes[j['node']]['name'],np.round(p,3),'radius',j.get('hitRadius'),'penetrations',hits)
