from pathlib import Path
import json,struct,numpy as np,hashlib,collections,sys
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03/prepared-2026-10-16');BEFORE=Path(__file__).parent/'before-full';O=P/'reports/material-correction.json';catalog=json.load(open(P/'catalog.json'));assert catalog['complete'];rows=[];errors=[];baseline={r['model']:r['before'] for r in json.load(open(O)).get('results',[])} if O.exists() else {}
reader=Path(__file__).parent.parent/'skp-audit/glb_audit.py'
if not reader.exists():reader=Path(__file__).parent/'glb_reader.py'
scope={'P':P,'json':json,'struct':struct,'np':np,'collections':collections};s=reader.read_text();exec(s[s.index('def read('):s.index('for p in sorted(')],scope)
def signatures(path):
 raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0];doc=json.loads(raw[20:20+n]);binary=raw[28+n:];parts=[];colorcounts=collections.Counter()
 def accessor(ai):
  a=doc['accessors'][ai];v=doc['bufferViews'][a['bufferView']];typ={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}[a['componentType']];width={'SCALAR':1,'VEC3':3,'VEC2':2,'VEC4':4}[a['type']];item=np.dtype(typ).itemsize
  return np.ndarray((a['count'],width),dtype=typ,buffer=binary,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',width*item),item))
 def walk(i,parent):
  node=doc['nodes'][i];w=parent@scope['matrix'](node)
  if 'mesh'in node:
   for pr in doc['meshes'][node['mesh']]['primitives']:
    if pr.get('mode',4)!=4:continue
    pos=accessor(pr['attributes']['POSITION']);ind=accessor(pr['indices']).reshape(-1).astype(int) if 'indices'in pr else np.arange(len(pos));points=pos@w[:3,:3].T+w[:3,3];triangles=np.rint(points[ind].reshape(-1,3,3)*1e6).astype('<i8');verts=triangles.view('V24').reshape(-1,3);verts.sort(axis=1);parts.append(verts.view('V72').reshape(-1))
    m=doc.get('materials',[])[pr['material']];c=tuple(round(x,6) for x in m.get('pbrMetallicRoughness',{}).get('baseColorFactor',[1,1,1,1])[:3]);colorcounts[c]+=len(ind)//3
  for ch in node.get('children',[]):walk(ch,w)
 for i in doc['scenes'][doc.get('scene',0)]['nodes']:walk(i,np.eye(4))
 unique=np.unique(np.concatenate(parts));return {'physicalTriangleSetSha256':hashlib.sha256(unique.tobytes()).hexdigest(),'uniqueTriangles':len(unique),'colors':[{'rgb':c,'triangles':n} for c,n in colorcounts.items()]}
for row in catalog['models']:
 old=signatures(BEFORE/(row['id']+'.glb')) if (BEFORE/(row['id']+'.glb')).exists() else baseline[row['id']];new=signatures(P/row['referenceFull']);same=old['physicalTriangleSetSha256']==new['physicalTriangleSetSha256'];oldcolors={tuple(x['rgb']) for x in old['colors']};newcolors={tuple(x['rgb']) for x in new['colors']};pink=(1.0,round(84/255,6),round(84/255,6));missing=oldcolors-newcolors-{pink};meta=json.load(open(P/row['metadata']));profile=meta.get('materialProfile',{})
 if not same:errors.append({'model':row['id'],'kind':'physical-geometry-changed'})
 if missing:errors.append({'model':row['id'],'kind':'lost-accent-colors','colors':list(missing)})
 if profile.get('defaultUnpaintedSRGB')!=[255,255,255]:errors.append({'model':row['id'],'kind':'wrong-default-profile'})
 rows.append({'model':row['id'],'samePhysicalTriangleSet':same,'before':old,'after':new,'preservedAccentColors':not missing});print(row['id'],same,'missing accents',list(missing),flush=True)
report={'models':len(rows),'errors':errors,'coordinateQuantizationMeters':1e-6,'note':'Physical triangle sets ignore winding and coincident front/back copies; a material-side grouping change can change raw triangle counts without changing surfaces. Original accent RGB colors must remain; only the layer fallback pink may disappear.','results':rows};O.write_text(json.dumps(report,ensure_ascii=False,indent=2));print('DONE',len(rows),'errors',len(errors));raise SystemExit(bool(errors))
