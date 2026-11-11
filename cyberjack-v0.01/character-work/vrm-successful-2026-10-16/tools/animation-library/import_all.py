"""Lossless AnimationClip typetree library, native packed curves and source provenance."""
import UnityPy,json,gzip,hashlib,base64,struct,math,time,shutil,gc,os,orjson
SHARD=int(os.environ.get("SHARD",0));SHARDS=int(os.environ.get("SHARDS",1))
from pathlib import Path
BASE=next(p for p in Path(__file__).resolve().parents if (p/'BUNDLE_ROOT').exists())
ROOT=BASE/'animations/sources'
OUT=BASE/'animations';INV=Path(__file__).parent/'inventory'
(OUT/'clips').mkdir(parents=True,exist_ok=True);(OUT/'sources').mkdir(exist_ok=True)
def clean(v):
 if isinstance(v,float) and not math.isfinite(v):return {'nonFinite':str(v)}
 if isinstance(v,bytes):return {'encoding':'bytes-base64','data':base64.b64encode(v).decode()}
 if isinstance(v,dict):return {k:clean(x) for k,x in v.items()}
 if isinstance(v,(list,tuple)):return [clean(x) for x in v]
 return v
def pack(a,fmt):return {'encoding':fmt+'le-base64','count':len(a),'data':base64.b64encode(struct.pack('<'+str(len(a))+({'u32':'I','f32':'f'}[fmt]),*a)).decode()}
records=[];done=set();errors=[]
if (OUT/f'import-{SHARD}.jsonl').exists():
 records=[json.loads(l) for l in (OUT/f'import-{SHARD}.jsonl').open()];done={(r['source'],r['pathId']) for r in records}
while True:
 paths={}
 for file in ['avatar_paths.json','transform_paths.json']:
  if (INV/file).exists():
   for h,c in json.loads((INV/file).read_text()).get('hashes',{}).items():
    paths.setdefault(h,[]).extend(x['path'] for x in c)
 statuses=[]
 for sf in ['bundles.jsonl','supplemental_statuses.jsonl']:
  if (INV/sf).exists():
   for line in (INV/sf).open():
    try:statuses.append(json.loads(line))
    except json.JSONDecodeError:pass
 pending=[s for s in statuses if s.get('clips') and any((s['bundle'],str(p)) not in done and int(hashlib.sha256((s['bundle']+':'+str(p)).encode()).hexdigest()[:8],16)%SHARDS==SHARD for p in s['clips'])]
 for status in pending:
  rel=status['bundle'];source=ROOT/rel
  if not source.exists():source=INV/'supplemental-sources'/rel
  env=UnityPy.load(str(source));count=0
  for obj in env.objects:
   if obj.type.name!='AnimationClip' or (rel,str(obj.path_id)) in done or int(hashlib.sha256((rel+':'+str(obj.path_id)).encode()).hexdigest()[:8],16)%SHARDS!=SHARD:continue
   try:
    d=obj.read_typetree();m=d.get('m_MuscleClip',{});cd=m.get('m_Clip',{}).get('data',{});bindings=[];offset=0
    for b in d.get('m_ClipBindingConstant',{}).get('genericBindings',[]):
     width=4 if b['typeID']==4 and b['attribute']==2 else 3 if b['typeID']==4 and b['attribute'] in (1,3,4) else 1
     candidates=sorted(set(paths.get(str(b['path']),[])),key=lambda p:(len(p),p));path=candidates[0] if candidates else ''
     bindings.append({**b,'resolvedPath':path,'bone':path.rsplit('/',1)[-1],'offset':offset,'width':width});offset+=width
    n=cd.get('m_StreamedClip',{}).get('curveCount',0)+cd.get('m_DenseClip',{}).get('m_CurveCount',0)+len(cd.get('m_ConstantClip',{}).get('data',[]))
    uid=hashlib.sha256((rel+':'+str(obj.path_id)).encode()).hexdigest()[:24]
    rb=[b for b in bindings if b['typeID']==4];matched=sum(bool(b['resolvedPath']) for b in rb)
    rig='male' if sum(b['bone'].startswith('cm_') for b in rb)>sum(b['bone'].startswith('cf_') for b in rb) else 'female'
    playable=any(b['bone'] in ('cf_j_hips','cm_j_hips','cf_j_spine01','cm_j_spine01') for b in rb) and n==offset
    rec={'id':uid,'name':d.get('m_Name',''),'source':rel,'pathId':str(obj.path_id),'category':rel.split('/')[0].removeprefix('__'),'origin':status.get('source',rel),'duration':max(0,m.get('m_StopTime',0)-m.get('m_StartTime',0)),'fps':d.get('m_SampleRate',30),'rig':rig,'playable':playable,'bindings':len(bindings),'resolved':matched,'transformBindings':len(rb),'channels':n,'expectedChannels':offset,'legacy':d.get('m_Legacy',False),'asset':'clips/'+uid+'.json.gz'}
    meta={**rec,'startTime':m.get('m_StartTime',0),'bindings':bindings}
    for parent,key,fmt in [(cd.get('m_StreamedClip',{}),'data','u32'),(cd.get('m_DenseClip',{}),'m_SampleArray','f32'),(cd.get('m_ConstantClip',{}),'data','f32')]:
     if key in parent:parent[key]=pack(parent[key],fmt)
    payload=orjson.dumps(clean({'format':'koikatsu-native-v1','meta':meta,'clip':d}))
    temp=(OUT/rec['asset']).with_name(uid+f'.{os.getpid()}.tmp')
    with gzip.open(temp,'wb',compresslevel=6) as f:f.write(payload)
    temp.replace(OUT/rec['asset'])
    rec['bytes']=(OUT/rec['asset']).stat().st_size
    with (OUT/f'import-{SHARD}.jsonl').open('a') as f:f.write(json.dumps(rec,ensure_ascii=False)+'\n')
    records.append(rec);done.add((rel,str(obj.path_id)));count+=1
   except Exception as ex:
    errors.append({'source':rel,'pathId':str(obj.path_id),'error':repr(ex)});print(errors[-1],flush=True)
  dest=OUT/'sources'/rel;dest.parent.mkdir(parents=True,exist_ok=True)
  if not dest.exists():
   temp=dest.with_name(dest.name+f'.{SHARD}.tmp');shutil.copy2(source,temp);temp.replace(dest)
  del env;gc.collect();print(rel,count,'total',len(records),flush=True)
  (OUT/f'catalog-{SHARD}.json').write_text(json.dumps({'format':'koikatsu-library-v1','clips':records,'errors':errors,'complete':False},ensure_ascii=False,separators=(',',':')))
 if (INV/'summary.json').exists() and (INV/'supplemental-summary.json').exists() and not pending:break
 time.sleep(5)
for f in ['summary.json','source_rigs.json','avatar_paths.json','transform_paths.json']:
 shutil.copy2(INV/f,OUT/f)
(OUT/f'catalog-{SHARD}.json').write_text(json.dumps({'format':'koikatsu-library-v1','clips':records,'errors':errors,'complete':True},ensure_ascii=False,separators=(',',':')))
print('DONE',len(records),len(errors),flush=True)
