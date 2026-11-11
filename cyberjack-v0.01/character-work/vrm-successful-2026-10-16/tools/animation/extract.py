import UnityPy,json,zlib,struct,bisect,math
from pathlib import Path
BUNDLE=next(p for p in Path(__file__).resolve().parents if (p/"BUNDLE_ROOT").exists())
P=BUNDLE / 'inputs/animation/abdata'
O=Path(__file__).parent
base=UnityPy.load(str(P/'chara/oo_base.unity3d'))
tos={}
for o in base.objects:
 if o.type.name=='Avatar':
  a=o.read_typetree()
  for _,p in a['m_TOS']:
   s=p.split('/')
   for i in range(len(s)):tos[zlib.crc32('/'.join(s[i:]).encode())]='/'.join(s[i:])
# gather one full female source hierarchy (cf_body_00)
trs={o.path_id:o.read() for o in base.objects if o.type.name=='Transform'}
def name(t):return t.m_GameObject.read().m_Name
def path(t):
 parent=trs.get(t.m_Father.path_id)
 return (path(parent)+'/' if parent else '')+name(t)
rest=[]
for tid,t in trs.items():
 p=path(t)
 if p.startswith('p_cf_body_bone/cf_j_root'):
  rest.append({'bone':name(t),'path':p,'parent':name(trs[t.m_Father.path_id]) if t.m_Father.path_id in trs else None,'quaternion':[t.m_LocalRotation.x,t.m_LocalRotation.y,t.m_LocalRotation.z,t.m_LocalRotation.w],'position':[t.m_LocalPosition.x,t.m_LocalPosition.y,t.m_LocalPosition.z],'scale':[t.m_LocalScale.x,t.m_LocalScale.y,t.m_LocalScale.z]})
# duplicated different prefabs: choose female skeletal path ending based longest cf_01 branch; names same rest normally
byname={r['bone']:r for r in rest}
print('rest',len(rest),len(byname),flush=True)
clips=[]
rel='adv/motion/controller/adv/00.unity3d'
e=UnityPy.load(str(P/rel))
wanted={'Idle_00_00','Stand_00_00','Stand_01_00','Stand_03_00','Stand_07_00','Stand_17_00','Stand_Joy_01'}
for o in e.objects:
 if o.type.name!='AnimationClip':continue
 d=o.read_typetree()
 if d['m_Name'] not in wanted:continue
 m=d['m_MuscleClip'];c=m['m_Clip']['data'];s=c['m_StreamedClip'];dense=c['m_DenseClip'];const=c['m_ConstantClip']['data'];N=s['curveCount'];D=dense['m_CurveCount'];end=m['m_StopTime'];start=m['m_StartTime'];duration=end-start
 raw=struct.pack('<%sI'%len(s['data']),*s['data']);p=0;curves=[[] for _ in range(N)]
 while p<len(raw):
  t,n=struct.unpack_from('<fi',raw,p);p+=8
  for _ in range(n):
   idx,*coef=struct.unpack_from('<i4f',raw,p);p+=20
   curves[idx].append((t,coef))
 ct=[[q[0] for q in cv] for cv in curves]
 times=[round(i/30,7) for i in range(int(duration*30)+1)]
 def value(idx,t):
  if idx<N:
   cv=curves[idx];i=max(0,bisect.bisect_right(ct[idx],t)-1);kt,k=cv[i];dt=max(0,t-kt) if kt>-1e20 else 0
   return ((k[0]*dt+k[1])*dt+k[2])*dt+k[3]
  if idx<N+D:
   ix=idx-N;f=max(0,min(dense['m_FrameCount']-1,round((t-dense['m_BeginTime'])*dense['m_SampleRate'])))
   return dense['m_SampleArray'][f*D+ix]
  return const[idx-N-D]
 offset=0;tracks=[];unresolved=[]
 for b in d['m_ClipBindingConstant']['genericBindings']:
  width={1:3,2:4,3:3,4:3}.get(b['attribute'],1) if b['typeID']==4 else 1
  pth=tos.get(b['path']);bone=pth.split('/')[-1] if pth else None
  if b['attribute']==2 and b['typeID']==4 and bone in byname:
   vals=[]
   for t in times:
    q=[value(offset+j,t+start) for j in range(4)];norm=math.sqrt(sum(v*v for v in q));q=[v/norm for v in q] if norm else [0,0,0,1];vals.extend(round(v,7) for v in q)
   tracks.append({'bone':bone,'times':times,'quaternions':vals})
  offset+=width
 print(d['m_Name'],duration,len(tracks),'channels',offset,N+D+len(const),flush=True)
 clips.append({'id':d['m_Name'],'label':d['m_Name'],'duration':duration,'fps':30,'source':rel,'sourcePathId':str(o.path_id),'tracks':tracks})
result={'format':'koikatsu-generic-v1','coordinateSpace':'Unity left-handed; quaternion xyzw. To right-handed mirror Z: [-x,-y,z,w]. Animation values are absolute source local transforms, not deltas. Retarget world rotation delta against included rest hierarchy.','restBones':list(byname.values()),'clips':clips,'provenance':{'game':'Koikatsu Sunshine EX BetterRepack R6','skeleton':'chara/oo_base.unity3d Avatar m_TOS and Transform hierarchy','animationBundle':rel,'decode':'Unity streamed cubic polynomial, dense samples, and constants; transform bindings resolved by CRC32 of Avatar path suffixes.'}}
result['sourceRig']=[{'name':r['bone'],'parent':r['parent'] if r['parent'] in byname else None,'position':r['position'],'rotation':r['quaternion'],'scale':r['scale']} for r in result.pop('restBones')]
for clip in result['clips']:
 clip['name']=clip['id']
 for tr in clip['tracks']:tr['rotations']=tr.pop('quaternions')
(O/'koikatsu-idles.json').write_text(json.dumps(result,separators=(',',':')))
