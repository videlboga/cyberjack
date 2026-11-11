"""Repair the existing hair-small GLB without changing topology, UVs, textures or rig."""
from pathlib import Path
import json,struct,numpy as np
src=Path('hair-small.glb');raw=bytearray(src.read_bytes());jl=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+jl]);offset=28+jl

def attr(n):
 a=doc['accessors'][n];v=doc['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
 assert not v.get('byteStride'), 'Interleaved source is unsupported'
 return np.frombuffer(raw,dtype,count=a['count']*k,offset=offset+v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,k)
node=next(n for n in doc['nodes'] if 'mesh' in n and doc['accessors'][doc['meshes'][n['mesh']]['primitives'][0]['attributes']['POSITION']]['count']>20000)
p=doc['meshes'][node['mesh']]['primitives'][0];a=p['attributes'];pos=attr(a['POSITION']);original=pos.copy();si=attr(a['JOINTS_0']);sw=attr(a['WEIGHTS_0']);names=[doc['nodes'][n]['name'] for n in doc['skins'][node['skin']]['joints']];root=names.index('hair_root')
# Blend the crown to the rigid head attachment, retaining four normalized influences.
t=np.clip((pos[:,1]-1.42)/.07,0,1);t=t*t*(3-2*t)
for i in np.flatnonzero(t>0):
 weights={int(k):float(w)*(1-t[i]) for k,w in zip(si[i],sw[i]) if w>0}
 weights[root]=weights.get(root,0)+float(t[i]);items=sorted(weights.items(),key=lambda x:-x[1])[:4];si[i]=0;sw[i]=0
 for k,(bone,w) in enumerate(items):si[i,k]=bone;sw[i,k]=w
 sw[i]/=sw[i].sum()
meta=json.loads(Path('body-sdf.json').read_text());n=np.array(meta['size']);lo=np.array(meta['min']);step=(np.array(meta['max'])-lo)/(n-1);grid=np.fromfile('body-sdf.bin',dtype=np.int8).reshape(tuple(n[::-1])).astype(float)*meta['scale']/127

def sample(points):
 f=(points-lo)/step;valid=np.all((f>=0)&(f<n-1),axis=1);f=np.clip(f,0,n-1.0001);i=f.astype(int);t=f-i;out=np.zeros(len(points))
 for x in range(2):
  for y in range(2):
   for z in range(2):out+=grid[i[:,2]+z,i[:,1]+y,i[:,0]+x]*np.prod(np.where([x,y,z],t,1-t),axis=1)
 return np.where(valid,out,1)

def to_b(v):return v[:,[0,2,1]]*np.array([1,-1,1])
before=sample(to_b(pos));eligible=(pos[:,1]<1.34)&(before<.004)&(before>-.04)
# Project small rest-pose penetrations using the complete SDF normal.
for _ in range(12):
 bp=to_b(pos);dist=sample(bp);mask=eligible&(dist<.004);ids=np.flatnonzero(mask)
 if not len(ids):break
 bp=bp[ids];g=[]
 for axis in range(3):
  e=np.zeros(3);e[axis]=step[axis];g.append((sample(bp+e)-sample(bp-e))/(2*step[axis]))
 g=np.array(g).T;g/=np.maximum(np.linalg.norm(g,axis=1)[:,None],1e-8);delta=g*np.minimum(.004-dist[ids],.008)[:,None];pos[ids]+=delta[:,[0,2,1]]*np.array([1,1,-1])
 # Preserve the source silhouette: corrections never exceed 4 cm.
 movement=pos[ids]-original[ids];length=np.linalg.norm(movement,axis=1);pos[ids]=original[ids]+movement*np.minimum(1,.04/np.maximum(length,1e-8))[:,None]
# Smooth the correction field across the welded surface, including UV seams.
ix=attr(p['indices']).reshape(-1,3)
_,weld=np.unique(np.round(original,5),axis=0,return_inverse=True)
counts=np.bincount(weld);delta=np.zeros((len(counts),3));np.add.at(delta,weld,pos-original);delta/=counts[:,None]
edges=np.unique(np.sort(np.concatenate([weld[ix[:,[0,1]]],weld[ix[:,[1,2]]],weld[ix[:,[2,0]]]]),axis=1),axis=0)
u,v=edges.T;degree=np.bincount(np.r_[u,v],minlength=len(counts));degree=np.maximum(degree,1)
for _ in range(8):
 total=np.zeros_like(delta);np.add.at(total,u,delta[v]);np.add.at(total,v,delta[u]);delta=.5*delta+.5*total/degree[:,None]
# Avoid folds/collapsed triangles: damp only the local correction until the original
# face orientation and at least 20% of its area are retained.
source_normal=np.cross(original[ix[:,1]]-original[ix[:,0]],original[ix[:,2]]-original[ix[:,0]])
source_area=np.linalg.norm(source_normal,axis=1)
for iteration in range(50):
 pos[:]=original+delta[weld]
 candidate=np.cross(pos[ix[:,1]]-pos[ix[:,0]],pos[ix[:,2]]-pos[ix[:,0]])
 bad=(np.sum(source_normal*candidate,axis=1)<0)|(np.linalg.norm(candidate,axis=1)<source_area*.2)
 if not bad.any():break
 ids=np.unique(weld[ix[bad]])
 delta[ids]*=.5 if iteration<30 else 0
pos[:]=original+delta[weld]
# Recompute normals and share them across UV seams at matching positions.
ix=attr(p['indices']).reshape(-1,3);norm=np.zeros_like(pos);cross=np.cross(pos[ix[:,1]]-pos[ix[:,0]],pos[ix[:,2]]-pos[ix[:,0]])
for k in range(3):np.add.at(norm,ix[:,k],cross)
_,weld=np.unique(np.round(original,5),axis=0,return_inverse=True);weldnorm=np.zeros((weld.max()+1,3));np.add.at(weldnorm,weld,norm);norm=weldnorm[weld];norm/=np.maximum(np.linalg.norm(norm,axis=1)[:,None],1e-10);attr(a['NORMAL'])[:]=norm
# Update accessor bounds without moving binary offsets.
acc=doc['accessors'][a['POSITION']];acc['min']=pos.min(0).tolist();acc['max']=pos.max(0).tolist();js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary=raw[offset:];out=struct.pack('<IIIII',0x46546c67,2,28+len(js)+len(binary),len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
Path('hair-repaired.glb').write_bytes(out)
after=sample(to_b(pos));movement=np.linalg.norm(pos-original,axis=1);report={'vertices':len(pos),'crownBlendedVertices':int((t>0).sum()),'movedVertices':int((movement>1e-6).sum()),'maxRestCorrectionMm':float(movement.max()*1000),'sampledPenetrationsBefore':int((before<-.005).sum()),'sampledPenetrationsAfter':int((after<-.005).sum()),'deepPenetrationsLeftUnchanged':int((before<=-.04).sum()),'triangleOrientationFlips':int((np.sum(source_normal*candidate,axis=1)<0).sum()),'weightSumMaxError':float(np.abs(sw.sum(1)-1).max())}
Path('work/hair-repair/asset-validation.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))
