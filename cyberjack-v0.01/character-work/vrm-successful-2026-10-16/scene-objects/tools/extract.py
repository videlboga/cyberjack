"""Extract Koikatsu scene props and map furniture with source provenance.
UnityPy + numpy + Pillow; no Blender or game modifications required.
"""
from pathlib import Path
import UnityPy,numpy as np,json,gzip,hashlib,shutil,struct,io,re,base64,math,gc,zlib,collections
from UnityPy.helpers.MeshHelper import MeshHandler
G=Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata')
B=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16')
import os
G=Path(os.environ.get('KOIKATSU_ABDATA',str(G)))
B=Path(os.environ.get('CHARACTER_BUNDLE',str(B)))
O=B/'scene-objects';O.mkdir(exist_ok=True)
for d in ['models','textures','native','sources','reports','tools']: (O/d).mkdir(exist_ok=True)
errors=[];textures={};materials={};sources={}
def ident(r): return r.assets_file.name+':'+str(r.path_id)
def uid(s):return hashlib.sha256(s.encode()).hexdigest()[:24]
def safe(s):return re.sub(r'[^\w.-]+','_',s)
def clean(v):
 if isinstance(v,bytes):return {'encoding':'base64','data':base64.b64encode(v).decode()}
 if isinstance(v,str):return v.encode('utf-8','surrogatepass').decode('utf-8','replace')
 if isinstance(v,float) and not math.isfinite(v):return 0
 if isinstance(v,dict):return {k:clean(x) for k,x in v.items()}
 if isinstance(v,(list,tuple)):return [clean(x) for x in v]
 return v
def writejson(p,d):
 p.parent.mkdir(parents=True,exist_ok=True)
 if p.suffix=='.gz':
  with gzip.open(p,'wt',encoding='utf8') as f:json.dump(clean(d),f,ensure_ascii=False,separators=(',',':'))
 else:p.write_text(json.dumps(clean(d),ensure_ascii=False,indent=2))
def preserve(p):
 rel=str(p.relative_to(G));dst=O/'sources'/rel;dst.parent.mkdir(parents=True,exist_ok=True)
 if not dst.exists():shutil.copy2(p,dst)
 sources[rel]={'asset':'sources/'+rel,'bytes':p.stat().st_size}
def deref(p):return p.deref() if p and p.path_id else None
def tex(ptr):
 r=deref(ptr)
 if not r:return None
 key=ident(r)
 if key not in textures:
  t=r.read();name=uid(key);f='textures/'+name+'.png';t.image.save(O/f)
  textures[key]={'id':name,'name':t.m_Name,'asset':f,'sourceIdentity':key,'width':t.m_Width,'height':t.m_Height}
 return textures[key]
def mat(ptr):
 r=deref(ptr)
 if not r:return {'name':'Default','pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':.8},'doubleSided':True},None
 key=ident(r)
 if key in materials:return materials[key]
 m=r.read();d=r.read_typetree();props=m.m_SavedProperties;ts={};raw=[]
 for name,entry in props.m_TexEnvs:
  try:t=tex(entry.m_Texture)
  except Exception as ex:errors.append({'kind':'texture','material':m.m_Name,'property':name,'error':str(ex)});t=None
  if t:ts[name]=(t,entry);raw.append({'property':name,'texture':t['id'],'scale':{'x':entry.m_Scale.x,'y':entry.m_Scale.y},'offset':{'x':entry.m_Offset.x,'y':entry.m_Offset.y}})
 colors=dict(props.m_Colors);floats=dict(props.m_Floats);col=colors.get('_Color');color=[getattr(col,c) for c in 'rgba'] if col else [1,1,1,1]
 color=[min(1,max(0,float(x))) for x in color]
 gl={'name':m.m_Name,'doubleSided':True,'pbrMetallicRoughness':{'baseColorFactor':color,'metallicFactor':0,'roughnessFactor':.8}}
 mode=floats.get('_Mode',0)
 if mode==1:gl.update(alphaMode='MASK',alphaCutoff=floats.get('_Cutoff',.5))
 elif mode in (2,3) or color[3]<1:gl['alphaMode']='BLEND'
 primary=next((ts[n] for n in ['_MainTex','_BaseMap','_MainTexAnother','_Texture'] if n in ts),None)
 
 if primary:
  t,entry=primary;primary=(t,{'scale':[entry.m_Scale.x,entry.m_Scale.y],'offset':[entry.m_Offset.x,entry.m_Offset.y]})
 materials[key]=(gl,primary)
 writejson(O/'native'/('material-'+uid(key)+'.json.gz'),{'identity':key,'data':d,'textures':raw,'previewNote':'glTF PBR approximation; original Unity material and all texture slots retained'})
 return gl,primary

def hierarchy(root):
 nodes=[];seen=set()
 def walk(go,parent,path):
  key=ident(go)
  if key in seen:return
  seen.add(key);o=go.read(); comps=[c.component.deref() for c in o.m_Component if c.component.path_id];tr=next((c for c in comps if c.type.name in ['Transform','RectTransform']),None)
  path=(path+'/'+o.m_Name).strip('/');i=len(nodes)
  nodes.append({'go':go,'object':o,'transform':tr,'components':comps,'parent':parent,'path':path})
  if tr:
   for child in tr.read().m_Children:walk(child.read().m_GameObject.deref(),i,path)
 walk(root,None,'');return nodes

def export(root,source,kind):
 key=source+':'+ident(root);name=root.read().m_Name;id=uid(key);h=hierarchy(root)
 cached=O/'native'/(id+'.record.json')
 if cached.exists():
  record=json.load(open(cached))
  cachedraw=json.load(gzip.open(O/record['native']))
  expected=sum(any(c['type'] in ['MeshFilter','SkinnedMeshRenderer'] and c['data'].get('m_Mesh',{}).get('m_PathID') for c in n['components']) for n in cachedraw['nodes'])
  if record['meshes']>=expected:return record
 old=O/'native'/(id+'.json.gz')
 if old.exists():
  try:
   oldraw=json.load(gzip.open(old));assert len(oldraw['nodes'])==len(h)
   models=list((O/'models').glob('*-'+id+'.glb'))
   record={'id':id,'name':name,'kind':kind,'source':source,'sourceIdentity':ident(root),'native':'native/'+id+'.json.gz','nodes':len(h),'meshes':0,'skins':0}
   if models:
    b=models[0].read_bytes();g=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]]);record.update(model=str(models[0].relative_to(O)),meshes=len(g.get('meshes',[])),skins=len(g.get('skins',[])))
   elif any(c['type'] in ['MeshRenderer','SkinnedMeshRenderer'] for n in oldraw['nodes'] for c in n['components']):raise ValueError('retry previously failed geometry')
   expected=sum(any(c['type'] in ['MeshFilter','SkinnedMeshRenderer'] and c['data'].get('m_Mesh',{}).get('m_PathID') for c in n['components']) for n in oldraw['nodes'])
   if record['meshes']<expected:raise ValueError('retry incomplete geometry')
   writejson(cached,record);return record
  except (ValueError,EOFError,OSError,KeyError,AssertionError):pass
 raw={'id':id,'name':name,'source':source,'sourceIdentity':ident(root),'nodes':[],'pathHashes':{}}
 for n in h:
  rel=n['path'].split('/',1)[1] if '/' in n['path'] else ''
  raw['pathHashes'][str(zlib.crc32(rel.encode())&0xffffffff)]=rel
  raw['nodes'].append({'path':n['path'],'parent':n['parent'],'gameObject':n['go'].read_typetree(),'components':[{'type':c.type.name,'identity':ident(c),'data':c.read_typetree()} for c in n['components']]})
 writejson(O/'native'/(id+'.json.gz'),raw)
 doc={'asset':{'version':'2.0','generator':'cyberjack Koikatsu source extraction'},'scene':0,'scenes':[{'nodes':[0]}],'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'buffers':[{'byteLength':0}],'images':[],'textures':[],'skins':[]};binary=bytearray();materialmap={};imagemap={};skinrequests=[];meshcount=0
 def view(b,target=None):
  while len(binary)%4:binary.append(0)
  v={'buffer':0,'byteOffset':len(binary),'byteLength':len(b)}
  if target:v['target']=target
  doc['bufferViews'].append(v);binary.extend(b);return len(doc['bufferViews'])-1
 def accessor(data,dtype,typ,target=None,bounds=False):
  a=np.asarray(data,dtype=dtype);v=view(a.tobytes(),target);d={'bufferView':v,'componentType':{'<f4':5126,'<u4':5125,'<u2':5123}[dtype],'count':len(a),'type':typ}
  if bounds:d.update(min=a.min(axis=0).tolist(),max=a.max(axis=0).tolist())
  doc['accessors'].append(d);return len(doc['accessors'])-1
 def material(ptr):
  r=deref(ptr);mk=ident(r) if r else 'default'
  if mk in materialmap:return materialmap[mk]
  gl,primary=mat(ptr);gl=json.loads(json.dumps(gl))
  if primary:
   t,entry=primary;tid=t['id']
   if tid not in imagemap:
    im=view((O/t['asset']).read_bytes());doc['images'].append({'bufferView':im,'mimeType':'image/png','name':t['name']});doc['textures'].append({'source':len(doc['images'])-1});imagemap[tid]=len(doc['textures'])-1
   uv={'index':imagemap[tid]}
   if entry['scale']!=[1,1] or entry['offset']!=[0,0]:
    uv['extensions']={'KHR_texture_transform':{'offset':[entry['offset'][0],-entry['offset'][1]],'scale':entry['scale']}};doc['extensionsUsed']=['KHR_texture_transform']
   gl['pbrMetallicRoughness']['baseColorTexture']=uv
  materialmap[mk]=len(doc['materials']);doc['materials'].append(gl);return materialmap[mk]
 for i,n in enumerate(h):
  tr=n['transform'].read() if n['transform'] else None
  node={'name':n['object'].m_Name,'extras':{'unityActive':bool(n['object'].m_IsActive),'unityPath':n['path']}}
  if tr:
   p=tr.m_LocalPosition;q=tr.m_LocalRotation;s=tr.m_LocalScale
   node.update(translation=[-p.x,p.y,p.z],rotation=[q.x,-q.y,-q.z,q.w],scale=[s.x,s.y,s.z])
  doc['nodes'].append(node)
  if n['parent'] is not None:doc['nodes'][n['parent']].setdefault('children',[]).append(i)
  render=next((c.read() for c in n['components'] if c.type.name in ['MeshRenderer','SkinnedMeshRenderer']),None)
  if not render:continue
  mf=next((c.read() for c in n['components'] if c.type.name=='MeshFilter'),None)
  mp=getattr(render,'m_Mesh',None) or (mf.m_Mesh if mf else None)
  if not mp or not mp.path_id:continue
  try:
   mesh=mp.read();handler=MeshHandler(mesh);handler.process()
   pos=np.array(handler.m_Vertices,dtype='<f4')[:,:3];pos[:,0]*=-1
   attr={'POSITION':accessor(pos,'<f4','VEC3',34962,True)}
   if handler.m_Normals:
    normal=np.array(handler.m_Normals,dtype='<f4')[:,:3];normal[:,0]*=-1;norm=np.linalg.norm(normal,axis=1);normal[norm>1e-10]/=norm[norm>1e-10,None];normal[norm<=1e-10]=[0,1,0];attr['NORMAL']=accessor(normal,'<f4','VEC3',34962)
   if handler.m_UV0:
    uv=np.array(handler.m_UV0,dtype='<f4')[:,:2];uv[:,1]*=-1;attr['TEXCOORD_0']=accessor(uv,'<f4','VEC2',34962)
   bones=getattr(render,'m_Bones',None)
   if bones and handler.m_BoneIndices and handler.m_BoneWeights:
    weights=np.array(handler.m_BoneWeights,dtype='<f4');sums=weights.sum(axis=1);weights[sums>0]/=sums[sums>0,None]
    attr['JOINTS_0']=accessor(handler.m_BoneIndices,'<u2','VEC4',34962);attr['WEIGHTS_0']=accessor(weights,'<f4','VEC4',34962)
    skinrequests.append((i,bones,mesh.m_BindPose))
   primitives=[]
   for si,tri in enumerate(handler.get_triangles()):
    indices=np.array(tri,dtype='<u4')[:,::-1].copy().reshape(-1)
    if not len(indices):continue
    materialptr=render.m_Materials[min(si,len(render.m_Materials)-1)] if render.m_Materials else None
    primitives.append({'attributes':attr,'indices':accessor(indices,'<u4','SCALAR',34963),'material':material(materialptr)})
   if primitives:node['mesh']=len(doc['meshes']);doc['meshes'].append({'name':mesh.m_Name,'primitives':primitives});meshcount+=1
  except Exception as ex:errors.append({'kind':'mesh','source':source,'object':n['path'],'error':repr(ex)})
 transformmap={ident(n['transform']):i for i,n in enumerate(h) if n['transform']}
 for ni,bones,binds in skinrequests:
  joints=[transformmap.get(ident(b.deref())) if b.path_id else None for b in bones]
  if None in joints or len(binds)!=len(joints):errors.append({'kind':'skin','source':source,'object':h[ni]['path'],'error':'bones outside prefab or inverse bind count mismatch'});continue
  matrices=[];flip=np.diag([-1,1,1,1])
  for b in binds:
   arr=np.array([[getattr(b,'e'+str(r)+str(c)) for c in range(4)] for r in range(4)]);matr=flip@arr@flip;matrices.append(matr.T.reshape(-1))
  doc['nodes'][ni]['skin']=len(doc['skins']);doc['skins'].append({'joints':joints,'inverseBindMatrices':accessor(matrices,'<f4','MAT4')})
 record={'id':id,'name':name,'kind':kind,'source':source,'sourceIdentity':ident(root),'native':'native/'+id+'.json.gz','nodes':len(h),'meshes':meshcount,'skins':len(doc['skins'])}
 if meshcount:
  doc['buffers'][0]['byteLength']=len(binary)
  for field in ['skins','textures','images','materials']:
   if not doc[field]:del doc[field]
  js=json.dumps(doc,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary.extend(b'\0'*((-len(binary))%4))
  out=struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
  record['model']='models/'+safe(name)+'-'+id+'.glb';(O/record['model']).write_bytes(out)
 writejson(O/'native'/(id+'.record.json'),record)
 return record

def main():
 audit=json.load(open(Path(__file__).parent/'audit.json'));tables=audit['tables'];props=[];points=[];furniture=[];maps=[]
 refs={(r['pathAssetObject'],r['nameObject']) for t in tables for r in t['data']['param']}
 controllers=json.load(open(B/'animation-links/controllers.json'))['controllers']
 for p in sorted((G/'h/common').glob('*.unity3d')):
  preserve(p);source=str(p.relative_to(G));env=UnityPy.load(str(p))
  for path,ptr in env.container.items():
   if not ptr.path_id:continue
   name=Path(path).stem
   if (source,name) in refs or any(source==s and name.lower()==n.lower() for s,n in refs):props.append(export(ptr.deref(),source,'item'))
   elif 'hpoint' in name.lower() and ptr.type.name=='GameObject':points.append(export(ptr.deref(),source,'placement'))
  print('COMMON',source,'props',len(props),'points',len(points),flush=True);del env;gc.collect()
 for t in tables:
  for row in t['data']['param']:
   row['objectId']=next((p['id'] for p in props if p['source']==row['pathAssetObject'] and p['name'].lower()==row['nameObject'].lower()),None)
   row['controllers']=[c['id'] for c in controllers if c['source']==row.get('pathAssetAnimator') and c['name']==row.get('nameAnimator')]
 for folder in ['map/scene','map/object','map/materials','map/common','map/list']:
  for p in sorted((G/folder).rglob('*.unity3d')):preserve(p)
 maplists=[]
 for p in sorted((G/'map/list').rglob('*.unity3d')):
  env=UnityPy.load(str(p))
  for r in env.objects:
   if r.type.name=='MonoBehaviour':maplists.append({'source':str(p.relative_to(G)),'pathId':str(r.path_id),'data':r.read_typetree()})
 writejson(O/'native/map-lists.json.gz',maplists)
 # All source map geometry and shared material archives are preserved. Load only one map
 # at a time; UnityPy resolves external CAB files via the environment search directory.
 for p in sorted((G/'map/scene').glob('*.unity3d')):
  source=str(p.relative_to(G));env=UnityPy.load(str(p));env.path=str(G/'map')
  # Build a CAB lookup from map dependencies for lazy PPtr resolution.
  for folder in ['map/materials','map/object','map/common']:
   for dep in (G/folder).glob('*.unity3d'):
    env.load_file(str(dep))
  gos=[o for o in env.objects if o.type.name=='GameObject' and o.assets_file.parent.name==p.name] if False else [o for o in env.objects if o.type.name=='GameObject']
  candidates=[]
  for go in gos:
   name=go.read().m_Name.lower()
   if any(w in name for w in ['chair','isu','desk','bench','table','bed','sofa','stool']) and not name.endswith('col'):candidates.append(go)
  candidatekeys={ident(g) for g in candidates};roots=[]
  for go in candidates:
   tr=next((c.component.read() for c in go.read().m_Component if c.component.type.name=='Transform'),None);parent=tr.m_Father if tr else None;hasparent=False
   while parent and parent.path_id:
    pt=parent.read()
    if ident(pt.m_GameObject.deref()) in candidatekeys:hasparent=True;break
    parent=pt.m_Father
   if not hasparent:roots.append(go)
  instances=[]
  for go in roots:
   try:instances.append(export(go,source,'furniture'))
   except Exception as ex:errors.append({'kind':'furniture','source':source,'object':go.read().m_Name,'error':repr(ex)})
  furniture.extend(instances)
  # Keep map components including KindMap/HPoint associations, transforms and original pointers.
  rawmap=[]
  for o in env.objects:
   if o.type.name in ['Transform','GameObject','MonoBehaviour']:
    try:rawmap.append({'identity':ident(o),'type':o.type.name,'data':o.read_typetree()})
    except Exception as ex:errors.append({'kind':'map-component','source':source,'identity':ident(o),'error':repr(ex)})
  mapid=uid(source);writejson(O/'native'/('map-'+mapid+'.json.gz'),{'source':source,'objects':rawmap})
  maps.append({'source':source,'native':'native/map-'+mapid+'.json.gz','furniture':[r['id'] for r in instances]})
  print('MAP',p.name,'furniture',len(instances),'mesh models',sum(bool(r.get('model')) for r in instances),'errors',len(errors),flush=True);del env;gc.collect()
 from PIL import Image
 known={t['asset'] for t in textures.values()}
 for p in (O/'textures').glob('*.png'):
  asset=str(p.relative_to(O))
  if asset not in known:
   w,hh=Image.open(p).size;textures[p.stem]={'id':p.stem,'name':p.stem,'asset':asset,'width':w,'height':hh,'nameNote':'original names and slots retained in native/material files'}
 scenes=json.load(open(B/'animation-links/scenes.json'))['scenes']
 sceneobjects=[{'id':s['id'],'name':s['name'],'source':s['source'],'chairs':s['row'].get('useChair',0),'desks':s['row'].get('useDesk',0),'fileItem':s['row'].get('paramFemale',{}).get('fileItem',''),'mapObjectNull':s['row'].get('pathMapObjectNull',{})} for s in scenes]
 catalog={'format':'koikatsu-scene-objects-v1','coordinateSystem':'glTF right-handed, Unity X reflected; native files preserve original Unity coordinates','objects':props,'placements':points,'furniture':furniture,'maps':maps,'itemTables':tables,'scenes':sceneobjects,'textures':list(textures.values()),'sources':sources,'errors':errors,'limitations':['GLB materials approximate Unity shaders. Every original material texture slot and source bundle is preserved.','GLBs contain rest pose geometry and skins. Native controller/clip links are preserved separately, not baked into GLB animations.','Furniture candidates include original chair/isu/desk matching plus bench/table/bed/sofa/stool names; map associations remain necessary for choosing a chair/desk for a scene.','Viewer object rendering is not implemented by this extraction.']}
 writejson(O/'catalog.json',catalog);writejson(O/'reports/extraction.json',{'counts':{'objects':len(props),'placements':len(points),'furniture':len(furniture),'furnitureModels':sum(bool(r.get('model')) for r in furniture),'maps':len(maps),'textures':len(textures),'sources':len(sources)},'errors':errors})
 print('DONE',json.dumps(json.load(open(O/'reports/extraction.json'))['counts']),len(errors),flush=True)
if __name__=='__main__':main()
