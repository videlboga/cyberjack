"""Direct metre/Y-up GLB export from openskp's instantiated scene, with no library ghosts."""
import sys,os
sys.path.insert(0,'/tmp/skp_wheels311');sys.path.insert(0,'/home/cyberkitty/.config/blender/4.2/extensions/user_default/openskp_import_export/vendor')
from pathlib import Path
import openskp,numpy as np,json,re,struct,hashlib,time,collections,gc
# The upstream face builder compares side RGB alone. Preserve texture/opacity/UV identity too.
import inspect
import openskp.instanced_scene as scene_module
import openskp._core as core_module
import openskp._face_groups as face_module
face_source=inspect.getsource(face_module.build_local_face_groups)
old_condition='if front_color == back_color:'
new_condition="if (front_color == back_color and (front_mat or {}).get('texture') == (back_mat or {}).get('texture') and abs(resolve_transparency(front_mat)-resolve_transparency(back_mat)) < 1e-8 and (not (front_mat or {}).get('texture') or f_data.get('uv_transform') == f_data.get('uv_transform_back'))):"
if old_condition not in face_source:raise RuntimeError('Unexpected upstream face builder; review material policy')
face_namespace=dict(vars(face_module));exec(face_source.replace(old_condition,new_condition),face_namespace)
scene_module.build_local_face_groups=face_namespace['build_local_face_groups']
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03');O=P/'prepared-2026-10-16'
for d in ['models','reference-full','metadata','reports','tools','blend']:(O/d).mkdir(parents=True,exist_ok=True)
def clean(o):
 if isinstance(o,dict):return {str(k):clean(v) for k,v in o.items()}
 if isinstance(o,(list,tuple)):return [clean(v) for v in o]
 if isinstance(o,np.ndarray):return o.tolist()
 if isinstance(o,np.generic):return o.item()
 return o
def write(p,d):
 tmp=p.with_name(p.name+'.tmp');tmp.write_text(json.dumps(clean(d),ensure_ascii=False,indent=2));tmp.replace(p)
def glb(scene,path,removed):
 doc={'asset':{'version':'2.0','generator':'Cyberjack source scene exporter; metre/Y-up'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':json.loads(json.dumps(scene.gltf_materials)),'buffers':[{'byteLength':0}],'bufferViews':[],'accessors':[]};data=bytearray();meshcache={};primitivecache={};linecache={};source_nodes=[];counts=collections.Counter();low=np.full(3,np.inf);high=-low
 def view(b,target=None):
  while len(data)%4:data.append(0)
  d={'buffer':0,'byteOffset':len(data),'byteLength':len(b)}
  if target:d['target']=target
  doc['bufferViews'].append(d);data.extend(b);return len(doc['bufferViews'])-1
 def acc(a,dtype,typ,target,bounds=False):
  arr=np.array(a,dtype=dtype);a={'bufferView':view(arr.tobytes(),target),'componentType':5126 if dtype=='<f4' else 5125,'count':len(arr),'type':typ}
  if bounds:a.update(min=arr.min(0).tolist(),max=arr.max(0).tolist())
  doc['accessors'].append(a);return len(doc['accessors'])-1
 if scene.textures:
  doc['images']=[];doc['textures']=[]
  for t in scene.textures:
   doc['images'].append({'name':t.filename,'bufferView':view(bytes(t.data)),'mimeType':t.mime_type});doc['textures'].append({'source':len(doc['images'])-1})
 resources={r.id:r for r in scene.mesh_resources};curves={r.id:r for r in scene.curve_resources};body_defs={str(resources[rid].definition_id) for rid in removed};bodycurves={r.id for r in scene.curve_resources if str(r.definition_id) in body_defs}
 def primitives(rid):
  if rid not in primitivecache:
   out=[]
   for pr in resources[rid].primitives:
    pos=np.asarray(pr.positions,dtype='<f4').reshape(-1,3);indices=np.asarray(pr.indices,dtype='<u4')
    if not len(pos) or not len(indices):continue
    if len(indices)%3:raise ValueError('nontriangular indices')
    if indices.max()>=len(pos):raise ValueError('invalid index')
    normal=np.asarray(pr.normals,dtype='<f4').reshape(-1,3).copy();length=np.linalg.norm(normal,axis=1);normal[length>1e-10]/=length[length>1e-10,None];normal[length<=1e-10]=[0,1,0]
    attrs={'POSITION':acc(pos,'<f4','VEC3',34962,True),'NORMAL':acc(normal,'<f4','VEC3',34962)}
    if len(pr.uvs):attrs['TEXCOORD_0']=acc(np.asarray(pr.uvs).reshape(-1,2),'<f4','VEC2',34962)
    out.append({'attributes':attrs,'indices':acc(indices,'<u4','SCALAR',34963),'material':pr.material_index,'mode':4})
   primitivecache[rid]=out
  return primitivecache[rid]
 def lines(cid):
  if cid not in linecache:
   out=[]
   for line in curves[cid].curves:
    pos=np.asarray(line.points_m,dtype='<f4')
    if len(pos)<2:continue
    out.append({'attributes':{'POSITION':acc(pos,'<f4','VEC3',34962,True)},'mode':2 if line.closed else 3})
   linecache[cid]=out
  return linecache[cid]
 def emit(n,parentworld,pathidx):
  nonlocal low,high
  original=np.array(n.matrix,dtype=float).reshape(4,4).T;world=parentworld@original;rid=n.mesh_resource_id;cid=n.curve_resource_id;removed_here=rid in removed;effective_rid=None if removed_here else rid;effective_cid=None if cid in bodycurves else cid;nodeid=len(doc['nodes']);name=n.name or n.definition_name or f'node_{pathidx}'
  node={'name':name,'matrix':list(n.matrix),'extras':{'sourcePath':pathidx,'definitionName':n.definition_name,'meshResource':rid,'layer':n.layer,'figureReferenceOnly':removed_here,'sourceGuid':n.guid,'sourceProperties':clean(n.properties),'sourceAttributes':clean(n.attribute_dictionaries)}};doc['nodes'].append(node)
  key=(effective_rid,effective_cid)
  if any(key):
   if key not in meshcache:
    prs=[]
    if effective_rid:prs+=primitives(effective_rid)
    if effective_cid:prs+=lines(effective_cid)
    if prs:meshcache[key]=len(doc['meshes']);doc['meshes'].append({'name':n.definition_name or name,'primitives':prs})
   if key in meshcache:node['mesh']=meshcache[key]
  if effective_rid:
   counts['meshInstances']+=1
   for pr in resources[effective_rid].primitives:
    pos=np.asarray(pr.positions).reshape(-1,3)
    if len(pos):
     points=pos@world[:3,:3].T+world[:3,3];low=np.minimum(low,points.min(0));high=np.maximum(high,points.max(0));counts['triangles']+=len(pr.indices)//3
  if effective_cid:counts['curveInstances']+=1
  source_nodes.append({'node':nodeid,'path':pathidx,'name':name,'definitionName':n.definition_name,'meshResource':rid,'curveResource':cid,'worldMatrix':world.T.reshape(-1).tolist(),'removedFigureGeometry':removed_here})
  children=[emit(ch,world,pathidx+'/'+str(i)) for i,ch in enumerate(n.children)]
  if children:node['children']=children
  return nodeid
 doc['scenes'][0]['nodes']=[emit(scene.scene_hierarchy,np.eye(4),'0')]
 # Keep only instantiated resources: unused library geometry is never independently placed.
 for key in ['materials','meshes']:
  if not doc[key]:del doc[key]
 doc['buffers'][0]['byteLength']=len(data);js=json.dumps(clean(doc),ensure_ascii=False,separators=(',',':')).encode();js+=b' '*((-len(js))%4);data.extend(b'\0'*((-len(data))%4));temporary=path.with_name(path.name+'.tmp');temporary.write_bytes(struct.pack('<III',0x46546c67,2,12+8+len(js)+8+len(data))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(data),0x004e4942)+data);temporary.replace(path)
 return {'nodes':len(doc['nodes']),'meshes':len(doc.get('meshes',[])),'images':len(doc.get('images',[])),'counts':dict(counts),'bounds':{'min':low.tolist(),'max':high.tolist(),'size':(high-low).tolist()},'nodeMap':source_nodes}
records=[]
for p in sorted(P.glob('*.skp')):
 t=time.time();parsed=core_module.full_parse(str(p));original_layer_colors=dict(parsed['layer_colors']);parsed['layer_colors']={name:(255,255,255) for name in original_layer_colors};s=scene_module.build_instanced_scene(parsed);parsed['layer_colors']=original_layer_colors;figures={r.id:r for r in s.mesh_resources if re.search(r'\.stl(?:#\d+)?$',r.definition_name or '',re.I)}
 if not figures:raise RuntimeError('No positively named figure in '+p.name)
 source=glb(s,O/'reference-full'/(p.stem+'.glb'),set());mechanical=glb(s,O/'models'/(p.stem+'.glb'),set(figures));mounts=[];res={r.id:r for r in s.mesh_resources}
 for n in mechanical['nodeMap']:
  if not n['removedFigureGeometry']:continue
  rid=n['meshResource'];w=np.array(n['worldMatrix']).reshape(4,4).T;r=res[rid];points=np.concatenate([np.asarray(pr.positions).reshape(-1,3) for pr in r.primitives]);world=points@w[:3,:3].T+w[:3,3];lo=world.min(0);hi=world.max(0);scale=np.linalg.norm(w[:3,:3],axis=0);R=w[:3,:3]/scale
  mounts.append({'id':p.stem+':'+n['path'],'sourceNodePath':n['path'],'definition':r.definition_name,'resource':rid,'worldMatrix':n['worldMatrix'],'positionMeters':w[:3,3].tolist(),'worldScale':scale.tolist(),'reflection':bool(np.linalg.det(w[:3,:3])<0),'worldRotationMatrix':R.T.reshape(-1).tolist(),'boundsMeters':{'min':lo.tolist(),'max':hi.tolist()},'meaning':'Reference to supplied static geometry; not a VRM bone pose or an attachment transform.','geometryTriangles':sum(len(pr.indices)//3 for pr in r.primitives)})
 expected=source['counts']['triangles']-sum(m['geometryTriangles'] for m in mounts)
 if mechanical['counts']['triangles']!=expected:raise RuntimeError('Geometry loss beyond selected figures')
 metadata={'format':'cyberjack-skp-prepared-v1','units':'metres','upAxis':'Y','source':p.name,'sourceSha256':hashlib.sha256(p.read_bytes()).hexdigest(),'materialProfile':{'exporterRevision':3,'mode':'normal materials; not color-by-layer','defaultUnpaintedSRGB':[255,255,255],'originalLayerColors':original_layer_colors,'explicitMaterialColorsPreserved':True,'surfaceIdentityPolicy':'RGB + texture + opacity + UV; preserve front/back differences'},'figureDefinitions':[{'id':r.id,'name':r.definition_name,'definitionId':str(r.definition_id)} for r in figures.values()],'figureReferences':mounts,'full':source,'mechanical':mechanical,'notes':['World matrices are original source matrices, in metres/Y-up.','Figure references carry no VRM bone rotations and must not be applied as avatar-root transforms.','Empty reference nodes retain original paths and children; only positively selected figure geometry is removed.','No new animation or avatar pose is generated.']};write(O/'metadata'/(p.stem+'.json'),metadata)
 record={'id':p.stem,'name':p.stem,'source':p.name,'model':'models/'+p.stem+'.glb','referenceFull':'reference-full/'+p.stem+'.glb','metadata':'metadata/'+p.stem+'.json','nodes':mechanical['nodes'],'meshes':mechanical['meshes'],'triangles':mechanical['counts']['triangles'],'sourceTriangles':source['counts']['triangles'],'figureInstances':len(mounts),'embeddedImages':mechanical['images'],'seconds':round(time.time()-t,2)};records.append(record);write(O/'catalog.json',{'format':'cyberjack-skp-library-v1','models':records,'complete':False});print(json.dumps(record),flush=True);del parsed,s;gc.collect()
write(O/'catalog.json',{'format':'cyberjack-skp-library-v1','models':records,'complete':True});print('DONE',len(records),flush=True)
