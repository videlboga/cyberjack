from pathlib import Path
import json,struct,numpy as np,collections,hashlib
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03');O=P/'prepared-2026-10-16';c=json.load(open(O/'catalog.json'));assert c['complete'];old=json.load(open(P/'analysis/import-audit-source.json'))['models'];rows=[];errors=[]
# Independent GLB reader used by the initial audit, not the exporter.
reader=Path(__file__).parent.parent/'skp-audit/glb_audit.py'
if not reader.exists():reader=Path(__file__).parent/'glb_reader.py'
text=reader.read_text();scope={'np':np,'json':json,'struct':struct,'collections':collections,'P':O};exec(text[text.index('def read('):text.index('for p in sorted(')],scope)
def quaternion(R):
 tr=np.trace(R)
 if tr>0:
  S=np.sqrt(tr+1)*2;q=[(R[2,1]-R[1,2])/S,(R[0,2]-R[2,0])/S,(R[1,0]-R[0,1])/S,S/4]
 else:
  i=int(np.argmax(np.diag(R)));j=(i+1)%3;k=(i+2)%3;S=np.sqrt(1+R[i,i]-R[j,j]-R[k,k])*2;q=[0.,0.,0.,0.];q[i]=S/4;q[j]=(R[j,i]+R[i,j])/S;q[k]=(R[k,i]+R[i,k])/S;q[3]=(R[k,j]-R[j,k])/S
 q=np.array(q);return(q/np.linalg.norm(q)).tolist()
for r in c['models']:
 meta=json.load(open(O/r['metadata']));reference=next(x for x in old if x['model']==r['id']);full=scope['stats'](O/r['referenceFull']);mechanical=scope['stats'](O/r['model']);expected=meta['full']['counts']['triangles'];errorbounds=float(np.max(np.abs(np.array(full['bounds']['min']+full['bounds']['max'])-np.array(reference['boundsMeters']['min']+reference['boundsMeters']['max']))))
 if full['triangles']!=expected or errorbounds>1e-5:errors.append({'model':r['id'],'kind':'source-mismatch','actual':full['triangles'],'expected':expected,'boundsError':errorbounds})
 for label,relative in [('full',r['referenceFull']),('mechanical',r['model'])]:
  raw=(O/relative).read_bytes();doc=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]]);worlds={}
  def walknode(i,parent):
   world=parent@scope['matrix'](doc['nodes'][i]);worlds[i]=world
   for ch in doc['nodes'][i].get('children',[]):walknode(ch,world)
  for i in doc['scenes'][doc.get('scene',0)]['nodes']:walknode(i,np.eye(4))
  for n in meta[label]['nodeMap']:
   expectedmatrix=np.array(n['worldMatrix']).reshape(4,4).T
   if np.max(np.abs(worlds[n['node']]-expectedmatrix))>1e-10:errors.append({'model':r['id'],'kind':'node-world-transform','node':n['path']})
 removed=sum(a['geometryTriangles'] for a in meta['figureReferences'])
 if mechanical['triangles']!=expected-removed:errors.append({'model':r['id'],'kind':'wrong-removal-count'})
 b=(O/r['model']).read_bytes();g=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
 for n in g['nodes']:
  if n.get('extras',{}).get('figureReferenceOnly') and 'mesh'in n:errors.append({'model':r['id'],'kind':'figure-geometry-retained'})
 for a in meta['figureReferences']:
  W=np.array(a['worldMatrix']).reshape(4,4).T;R=np.array(a['worldRotationMatrix']).reshape(3,3).T
  a['worldQuaternionXYZW']=quaternion(R) if np.linalg.det(R)>0 and np.max(np.abs(R.T@R-np.eye(3)))<1e-5 else None
  if not np.allclose(W[:3,3],a['positionMeters'],atol=1e-12):errors.append({'model':r['id'],'kind':'reference-translation'})
 (O/r['metadata']).write_text(json.dumps(meta,ensure_ascii=False,indent=2));rows.append({'model':r['id'],'fullTriangles':full['triangles'],'cleanTriangles':mechanical['triangles'],'removedTriangles':removed,'figureInstances':len(meta['figureReferences']),'sourceBoundsErrorMeters':errorbounds,'mechanicalBounds':mechanical['bounds'],'images':mechanical['images']})
report={'models':len(rows),'figureInstancesRemoved':sum(r['figureInstances'] for r in rows),'errors':errors,'results':rows};(O/'reports/source-verification.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='results'}));raise SystemExit(bool(errors))
