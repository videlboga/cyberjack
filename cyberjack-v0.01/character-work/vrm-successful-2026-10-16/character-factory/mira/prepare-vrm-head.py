"""Extract a VRM 1.0 head without discarding facial targets, bindings or UVs."""
import json,struct,base64,copy,heapq
from pathlib import Path
import numpy as np
HERE=Path(__file__).resolve().parent
SOURCE=HERE/'../../viewer/models/x20/mira/Mira_outfit_00.vrm'
b=SOURCE.read_bytes();jl=struct.unpack_from('<I',b,12)[0];doc=json.loads(b[20:20+jl]);binary=bytearray(b[28+jl:])
def read(i):
 a=doc['accessors'][i];v=doc['bufferViews'][a['bufferView']];dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];k={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}[a['type']]
 assert not v.get('byteStride')
 return np.frombuffer(binary,dtype,count=a['count']*k,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,k).copy()
def add(array,typ='VEC3',component=5126):
 data=np.asarray(array,dtype={5126:'<f4',5125:'<u4',5123:'<u2'}[component]);binary.extend(b'\0'*((-len(binary))%4));off=len(binary);binary.extend(data.tobytes());vi=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':off,'byteLength':data.nbytes});a={'bufferView':vi,'componentType':component,'count':len(data),'type':typ}
 if typ=='VEC3':a.update(min=data.min(0).tolist(),max=data.max(0).tolist())
 ai=len(doc['accessors']);doc['accessors'].append(a);return ai
# Keep the exact node identity referenced by expression morphTargetBinds.
headNode=doc['extensions']['VRMC_vrm']['humanoid']['humanBones']['head']['node']
# Source skeleton translations are composed below; the donor has identity root axes.
world={}
def visit(i,parent):
 n=doc['nodes'][i];m=np.eye(4)
 if 'matrix' in n:m=np.array(n['matrix']).reshape(4,4).T
 else:
  x,y,z,w=n.get('rotation',[0,0,0,1]);m[:3,:3]=np.array([[1-2*y*y-2*z*z,2*x*y-2*z*w,2*x*z+2*y*w],[2*x*y+2*z*w,1-2*x*x-2*z*z,2*y*z-2*x*w],[2*x*z-2*y*w,2*y*z+2*x*w,1-2*x*x-2*y*y]])@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0])
 world[i]=parent@m
 for c in n.get('children',[]):visit(c,world[i])
for i in doc['scenes'][0]['nodes']:visit(i,np.eye(4))
sourceHead=world[headNode][:3,3].tolist()
# The replacement module is head-only: remove the donor's whole neck primitive.
# Its upper rim is already the same geometric boundary as the face socket.
face=doc['meshes'][0]['primitives'][0];fp=read(face['attributes']['POSITION']);fi=read(face['indices']).reshape(-1,3)
weld={};remap=[]
for i,v in enumerate(fp):remap.append(weld.setdefault(tuple(np.round(v,5)),i))
edges={}
for f in fi:
 for a,b in zip(f,np.roll(f,-1)):
  key=tuple(sorted((remap[a],remap[b])));edges[key]=edges.get(key,0)+1
adj={}
for (a,b),n in edges.items():
 if n==1:adj.setdefault(a,[]).append(b);adj.setdefault(b,[]).append(a)
seen=set();loops=[]
for start in adj:
 if start in seen:continue
 stack=[start];ids=[]
 while stack:
  i=stack.pop()
  if i in seen:continue
  seen.add(i);ids.append(i);stack.extend(adj[i])
 loops.append(ids)
socket=min(loops,key=lambda ids:float(fp[ids,1].mean()))
assert len(socket)==26
assert all(float(np.max(np.abs(read(t['POSITION'])[socket])))<1e-7 for t in face['targets'])
# Canonical Mira/Evanescia fit: adapt the head aperture itself to the native
# neck section, preserving the face by a geodesic mask on the underside.
def jsdata(name):
 text=(HERE/name).read_text();return json.loads(text[text.index('=')+1:].strip().rstrip(';'))
eva=jsdata('evanescia-data.js');body=np.frombuffer(base64.b64decode(eva['base']),dtype='<f4').reshape(-1,3);bodytri=np.frombuffer(base64.b64decode(eva['index']),dtype='<u4').reshape(-1,3)
rig=jsdata('anatomy-rig.js');targetHead=np.array(next(v['head'] for v in rig['bones'] if v['name']=='head'));plane=1.375;section=[]
for tri in bodytri:
 for a,b in zip(tri,np.roll(tri,-1)):
  if (body[a,2]<=plane)!=(body[b,2]<=plane):section.append(body[a]+(body[b]-body[a])*(plane-body[a,2])/(body[b,2]-body[a,2]))
section=np.array(section);targetSize=section.max(0)-section.min(0);targetCenter=(section.max(0)+section.min(0))/2
socketMin=fp[socket].min(0);socketMax=fp[socket].max(0);socketCenter=(socketMin+socketMax)/2;fit=.82
sx=float(targetSize[0]/((socketMax[0]-socketMin[0])*fit));sz=float(targetSize[1]/((socketMax[2]-socketMin[2])*fit))
oldCenter=targetHead+np.array([socketCenter[0]-sourceHead[0],-(socketCenter[2]-sourceHead[2]),socketCenter[1]-sourceHead[1]])*fit
attachmentOffset=[0,float(targetCenter[1]-oldCenter[1]),0]
# Dijkstra over welded surface adjacency avoids deforming chin/mouth merely
# because they are low in Y. The visible front of the face is also pinned.
graph={}
for tri in fi:
 for a,b in zip(tri,np.roll(tri,-1)):
  a,b=remap[a],remap[b]
  if a==b:continue
  d=float(np.linalg.norm(fp[a]-fp[b]));graph.setdefault(a,{})[b]=d;graph.setdefault(b,{})[a]=d
distance={i:0. for i in socket};queue=[(0.,i) for i in socket];heapq.heapify(queue)
while queue:
 d,i=heapq.heappop(queue)
 if d!=distance[i]:continue
 for k,w in graph.get(i,{}).items():
  candidate=d+w
  if candidate<distance.get(k,float('inf')):distance[k]=candidate;heapq.heappush(queue,(candidate,k))
def smooth(x):x=np.clip(x,0,1);return x*x*(3-2*x)
mask=np.array([1-smooth(distance.get(remap[i],1)/.045) for i in range(len(fp))]);mask*=1-smooth((fp[:,2]-socketMax[2])/.020)
assert np.allclose(mask[socket],1)
sourceFace=fp.copy();fitted=fp.copy();fitted[:,0]+=mask*(sx-1)*(fp[:,0]-socketCenter[0]);fitted[:,2]+=mask*(sz-1)*(fp[:,2]-socketCenter[2])
oldNormals=read(face['attributes']['NORMAL']);sums=np.zeros_like(fp)
for tri in fi:
 n=np.cross(fitted[tri[1]]-fitted[tri[0]],fitted[tri[2]]-fitted[tri[0]])
 for i in tri:sums[remap[i]]+=n
normals=np.array([sums[remap[i]] for i in range(len(fp))]);normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
blend=smooth(mask/.15)[:,None];normals=oldNormals*(1-blend)+normals*blend;normals/=np.maximum(np.linalg.norm(normals,axis=1)[:,None],1e-12)
face['attributes']['POSITION']=add(fitted);face['attributes']['NORMAL']=add(normals)
for target in face['targets']:
 delta=read(target['POSITION']);delta[:,0]*=1+mask*(sx-1);delta[:,2]*=1+mask*(sz-1);target['POSITION']=add(delta)
fp=fitted
fitInfo={'version':1,'method':'native neck section + pinned geodesic underside fit','bodySectionHeight':plane,'targetSocketWidth':float(targetSize[0]),'targetSocketDepth':float(targetSize[1]),'apertureScale':[sx,sz],'attachmentOffset':attachmentOffset,'modifiedFaceVertices':int(np.count_nonzero(mask)),'pinnedFaceVertices':int(np.count_nonzero(mask==0)),'visibleFaceMaxDisplacement':float(np.max(np.abs(fitted[mask==0]-sourceFace[mask==0])))}
(HERE/'work/head-face/canonical-fit.json').write_text(json.dumps(fitInfo,indent=2))

doc['meshes'][0]['primitives']=doc['meshes'][0]['primitives'][:10]
# No clothing/hair geometry or spring simulation; the authoring skeleton remains intact.
for n in doc['nodes']:
 if n.get('mesh',0)>0:n.pop('mesh',None);n.pop('skin',None)
doc['meshes']=doc['meshes'][:1];doc.pop('animations',None);doc['extensions'].pop('VRMC_springBone',None);doc['extensionsUsed']=[x for x in doc.get('extensionsUsed',[]) if x!='VRMC_springBone'];doc['extensionsRequired']=[x for x in doc.get('extensionsRequired',[]) if x!='VRMC_springBone']
# Remove unreferenced material/texture/image payloads and buffer ranges.
doc['materials']=doc['materials'][:10];textureIds=set()
def textures(obj,remap=None):
 if isinstance(obj,dict):
  for k,v in obj.items():
   if k.lower().endswith('texture') and isinstance(v,dict) and 'index' in v:
    if remap is None:textureIds.add(v['index'])
    else:v['index']=remap[v['index']]
   else:textures(v,remap)
 elif isinstance(obj,list):
  for v in obj:textures(v,remap)
textures(doc['materials']);texMap={old:i for i,old in enumerate(sorted(textureIds))};textures(doc['materials'],texMap);doc['textures']=[doc['textures'][i] for i in sorted(textureIds)]
images={x['source'] for x in doc['textures']};meta=doc['extensions']['VRMC_vrm']['meta']
if 'thumbnailImage' in meta:images.add(meta['thumbnailImage'])
imageMap={old:i for i,old in enumerate(sorted(images))};doc['images']=[doc['images'][i] for i in sorted(images)]
for texture in doc['textures']:texture['source']=imageMap[texture['source']]
if 'thumbnailImage' in meta:meta['thumbnailImage']=imageMap[meta['thumbnailImage']]
used=set()
for mesh in doc['meshes']:
 for pr in mesh['primitives']:
  used.update(pr['attributes'].values());used.add(pr['indices'])
  for target in pr.get('targets',[]):used.update(target.values())
for skin in doc['skins']:used.add(skin['inverseBindMatrices'])
accessMap={old:i for i,old in enumerate(sorted(used))}
for mesh in doc['meshes']:
 for pr in mesh['primitives']:
  pr['attributes']={k:accessMap[v] for k,v in pr['attributes'].items()};pr['indices']=accessMap[pr['indices']]
  for target in pr.get('targets',[]):
   for k,v in target.items():target[k]=accessMap[v]
for skin in doc['skins']:skin['inverseBindMatrices']=accessMap[skin['inverseBindMatrices']]
doc['accessors']=[doc['accessors'][i] for i in sorted(used)]
views={a['bufferView'] for a in doc['accessors']}|{i['bufferView'] for i in doc['images']};viewMap={old:i for i,old in enumerate(sorted(views))};newBinary=bytearray();newViews=[]
for i in sorted(views):
 v=copy.deepcopy(doc['bufferViews'][i]);raw=binary[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];newBinary.extend(b'\0'*((-len(newBinary))%4));v['buffer']=0;v['byteOffset']=len(newBinary);newBinary.extend(raw);newViews.append(v)
for a in doc['accessors']:a['bufferView']=viewMap[a['bufferView']]
for i in doc['images']:i['bufferView']=viewMap[i['bufferView']]
doc['bufferViews']=newViews;newBinary.extend(b'\0'*((-len(newBinary))%4));doc['buffers']=[{'byteLength':len(newBinary)}];doc['asset']['generator']='Cyberjack VRM head extraction; source metadata retained'
js=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();js+=b' '*((-len(js))%4);out=struct.pack('<IIIII',0x46546c67,2,28+len(js)+len(newBinary),len(js),0x4e4f534a)+js+struct.pack('<II',len(newBinary),0x004e4942)+newBinary
(HERE/'assets/heads/mira/head.vrm').write_bytes(out)
manifest={'format':'cyberjack-head-module-3','source':str(SOURCE.resolve()),'vrmVersion':'1.0','headNode':headNode,'sourceHead':sourceHead,'fitScale':.82,'canonicalFit':fitInfo,'socketPrimitive':0,'socketRing':socket,'socketPositions':fp[socket].tolist(),'neckOwnership':'body','donorNeckRemoved':True,'presets':list(doc['extensions']['VRMC_vrm']['expressions']['preset']),'targetCount':len(doc['meshes'][0]['primitives'][0]['targets'])}
(HERE/'assets/heads/mira/module.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False));print('head.vrm',len(out),'bytes; head-only socket',len(socket),'points')
