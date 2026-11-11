from pathlib import Path
import json,struct,numpy as np,collections
P=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/public/models/sex-machines-models-vol-03');OUT=P/'analysis';rows=[]
def read(p):
 b=p.read_bytes();n=struct.unpack_from('<I',b,12)[0];d=json.loads(b[20:20+n]);return d,b[28+n:]
def matrix(n):
 if 'matrix' in n:return np.array(n['matrix']).reshape(4,4).T
 x,y,z,w=n.get('rotation',[0,0,0,1]);s=n.get('scale',[1,1,1]);m=np.eye(4);m[:3,:3]=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])@np.diag(s);m[:3,3]=n.get('translation',[0,0,0]);return m
def stats(p):
 d,b=read(p);nodes=d.get('nodes',[]);lo=np.full(3,np.inf);hi=-lo;instances=0;triangles=0;humans=[];detneg=0;modes=collections.Counter();images=d.get('images',[]);cache={};duplicates=collections.Counter()
 def pos(ai):
  if ai in cache:return cache[ai]
  a=d['accessors'][ai];v=d['bufferViews'][a['bufferView']];arr=np.ndarray((a['count'],3),dtype='<f4',buffer=b,offset=v.get('byteOffset',0)+a.get('byteOffset',0),strides=(v.get('byteStride',12),4));cache[ai]=arr;return arr
 def walk(i,parent):
  nonlocal lo,hi,instances,triangles,detneg
  n=nodes[i];world=parent@matrix(n)
  if 'mesh' in n:
   me=d['meshes'][n['mesh']];isface=False
   for pr in me['primitives']:
    mode=pr.get('mode',4);modes[str(mode)]+=1
    if mode!=4:continue
    isface=True;a=pos(pr['attributes']['POSITION']);worldpoints=a@world[:3,:3].T+world[:3,3];lo=np.minimum(lo,worldpoints.min(axis=0));hi=np.maximum(hi,worldpoints.max(axis=0));count=d['accessors'][pr['indices']]['count'] if 'indices' in pr else len(a);triangles+=count//3
   if isface:
    instances+=1;detneg+=np.linalg.det(world[:3,:3])<0;duplicates[(n['mesh'],tuple(np.round(world.reshape(-1),5)))]+=1
    if '.stl' in (n.get('name','')+' '+me.get('name','')).lower():humans.append({'node':i,'name':n.get('name'),'mesh':n['mesh'],'position':world[:3,3].tolist()})
  for ch in n.get('children',[]):walk(ch,world)
 for i in d.get('scenes',[{}])[d.get('scene',0)].get('nodes',[]):walk(i,np.eye(4))
 return {'file':str(p.relative_to(P)),'bytes':p.stat().st_size,'nodes':len(nodes),'meshes':len(d.get('meshes',[])),'meshInstances':instances,'triangles':triangles,'materials':len(d.get('materials',[])),'images':len(images),'embeddedImages':sum('bufferView' in i for i in images),'skins':len(d.get('skins',[])),'animations':len(d.get('animations',[])),'bounds':{'min':lo.tolist(),'max':hi.tolist(),'size':(hi-lo).tolist()},'negativeDeterminantInstances':int(detneg),'duplicatePlacements':sum(v-1 for v in duplicates.values()),'humanNamedNodes':humans,'primitiveModes':dict(modes)}
for p in sorted(P.glob('glb*/*.glb')):
 try:rows.append(stats(p))
 except Exception as ex:rows.append({'file':str(p.relative_to(P)),'error':repr(ex)})
(OUT/'import-audit-glb.json').write_text(json.dumps({'files':rows},ensure_ascii=False,indent=2));print('FILES',len(rows),'errors',sum('error'in r for r in rows));print([(r['file'],[round(x,2) for x in r.get('bounds',{}).get('size',[])],r.get('skins'),r.get('animations')) for r in rows[:3]]);print([(r['file'],[round(x,2) for x in r.get('bounds',{}).get('size',[])]) for r in rows if r['file'].startswith('glb-nohuman')][:3])
