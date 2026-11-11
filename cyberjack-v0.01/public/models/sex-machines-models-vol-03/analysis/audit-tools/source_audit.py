import sys
sys.path.insert(0,'/tmp/skp_wheels311');sys.path.insert(0,'/home/cyberkitty/.config/blender/4.2/extensions/user_default/openskp_import_export/vendor')
from pathlib import Path
import openskp,numpy as np,json,collections,math,time,gc
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03');manifest=json.load(open(P/'analysis/humanoid_manifest.json'));glbs=json.load(open(P/'analysis/import-audit-glb.json'))['files'];rows=[] if '--force' in sys.argv else (json.load(open(P/'analysis/import-audit-source.json'))['models'] if (P/'analysis/import-audit-source.json').exists() else [])
def qmat(q):
 x,y,z,w=q;return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
for p in sorted(P.glob('*.skp')):
 if any(r['model']==p.stem for r in rows):continue
 t=time.time();f=openskp.SkpFile.open(str(p));f.parse();s=f.build_instanced_scene();resources={r.id:r for r in s.mesh_resources};removed={r['resource'] for r in manifest.get(p.stem,{}).get('humanoid_defs',[])};bounds=[np.full(3,np.inf),np.full(3,-np.inf)];clean=[bounds[0].copy(),bounds[1].copy()];counts=collections.Counter();anchors=[];seen=collections.Counter()
 def walk(n,parent):
  m=np.array(n.matrix).reshape(4,4).T;w=parent@m;rid=n.mesh_resource_id
  if rid in resources:
   r=resources[rid];counts['meshInstances']+=1;seen[rid]+=1
   if rid in removed:anchors.append((rid,w,m))
   for prim in r.primitives:
    pos=np.array(prim.positions).reshape(-1,3)
    if not len(pos):continue
    pts=pos@w[:3,:3].T+w[:3,3];low=pts.min(0);high=pts.max(0);bounds[0]=np.minimum(bounds[0],low);bounds[1]=np.maximum(bounds[1],high);counts['triangles']+=len(prim.indices)//3
    if rid not in removed:
     clean[0]=np.minimum(clean[0],low);clean[1]=np.maximum(clean[1],high);counts['cleanTriangles']+=len(prim.indices)//3
  for ch in n.children:walk(ch,w)
 walk(s.scene_hierarchy,np.eye(4));checks=[]
 for old,(rid,w,m) in zip(manifest.get(p.stem,{}).get('anchors',[]),anchors):
  scales=np.linalg.norm(w[:3,:3],axis=0);R=w[:3,:3]/scales;stored=np.array(old['quat_xyzw']);reordered=stored[[1,2,3,0]]
  def err(q):
   E=R.T@qmat(q);return math.degrees(math.acos(np.clip((np.trace(E)-1)/2,-1,1)))
  checks.append({'resource':rid,'positionErrorMeters':float(np.max(np.abs(np.array(old['loc'])-w[:3,3]))),'rotationErrorDegreesWhenReadAsXYZW':err(stored),'rotationErrorDegreesIfReorderedWXYZtoXYZW':err(reordered),'parentRotationOrScalePresent':not np.allclose(w[:3,:3],m[:3,:3]),'worldScale':scales.tolist(),'storedScale':old['scale']})
 row={'model':p.stem,'resources':len(resources),'counts':dict(counts),'boundsMeters':{'min':bounds[0].tolist(),'max':bounds[1].tolist(),'size':(bounds[1]-bounds[0]).tolist()},'withoutDetectedHumanoidsBoundsMeters':{'min':clean[0].tolist(),'max':clean[1].tolist(),'size':(clean[1]-clean[0]).tolist()},'stlDefinitions':[r.definition_name for r in resources.values() if '.stl' in (r.definition_name or '').lower()],'removedDefinitions':list(removed),'anchorChecks':checks,'seconds':round(time.time()-t,2)}
 for folder,key,reference in [('glb','blenderExport',bounds),('glb-nohuman','nohumanExport',clean)]:
  g=next((r for r in glbs if r['file']==folder+'/'+p.stem+'.glb'),None)
  if g:
   actual=g['bounds'];ratio=np.array(actual['size'])/(reference[1]-reference[0]);row[key]={'sizeRatios':ratio.tolist(),'triangles':g['triangles'],'extraTriangles':g['triangles']-counts['triangles' if folder=='glb' else 'cleanTriangles'],'skinned':bool(g['skins']),'animated':bool(g['animations'])}
 rows.append(row);(P/'analysis/import-audit-source.json').write_text(json.dumps({'models':rows,'complete':False},ensure_ascii=False,indent=2));print(p.stem,'native triangles',counts['triangles'],'original extra',row.get('blenderExport',{}).get('extraTriangles'),'nohuman ratio',row.get('nohumanExport',{}).get('sizeRatios'),flush=True);del f,s,resources;gc.collect()
(P/'analysis/import-audit-source.json').write_text(json.dumps({'models':rows,'complete':True},ensure_ascii=False,indent=2))
