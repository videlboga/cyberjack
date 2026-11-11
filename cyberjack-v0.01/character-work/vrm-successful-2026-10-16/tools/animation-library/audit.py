import json,gzip,base64,struct,hashlib,concurrent.futures,collections,orjson
from pathlib import Path
BASE=next(p for p in Path(__file__).resolve().parents if (p/'BUNDLE_ROOT').exists());OUT=BASE/'animations';INV=Path(__file__).parent/'inventory'
cat=json.loads((OUT/'catalog.json').read_text());expected=set();inventoryErrors=[]
for sf in ['bundles.jsonl','supplemental_statuses.jsonl']:
 if (INV/sf).exists():
  for line in (INV/sf).open():
   status=json.loads(line)
   if status.get('clips'):
    expected.update((status['bundle'],str(pid)) for pid in status['clips'])
   if status.get('error') or status.get('clipErrors'):inventoryErrors.append(status)
actual={(c['source'],c['pathId']) for c in cat['clips']}
try:cached=json.loads((OUT/'payload_audit_index.json').read_text())['files']
except:cached={}
cache_hits=0
def check(c):
 global cache_hits
 st=(OUT/c['asset']).stat()
 if cached.get(c['id'])==[st.st_size,st.st_mtime_ns]:
  cache_hits+=1;return None
 errors=[]
 try:
  d=orjson.loads(gzip.open(OUT/c['asset']).read());m=d['clip'].get('m_MuscleClip',{});cd=m.get('m_Clip',{}).get('data',{});count=0
  for parent,key in [(cd.get('m_StreamedClip',{}),'data'),(cd.get('m_DenseClip',{}),'m_SampleArray'),(cd.get('m_ConstantClip',{}),'data')]:
   if key not in parent:continue
   a=parent[key];b=base64.b64decode(a['data']);assert len(b)==a['count']*4
  dense=cd.get('m_DenseClip',{});assert dense.get('m_SampleArray',{}).get('count',0)==dense.get('m_CurveCount',0)*dense.get('m_FrameCount',0)
  if c['channels']!=c['expectedChannels']:errors.append('binding_channel_mismatch')
  stream=cd.get('m_StreamedClip',{});raw=base64.b64decode(stream.get('data',{}).get('data',''));pos=0;last=-float('inf')
  while pos<len(raw):
   t,n=struct.unpack_from('<fi',raw,pos);pos+=8;assert n>=0 and t>=last;last=t
   for i in range(n):
    index=struct.unpack_from('<i',raw,pos)[0];assert 0<=index<stream['curveCount'];pos+=20
   assert pos<=len(raw)
  assert d['meta']['id']==c['id']
 except Exception as ex:errors.append(repr(ex))
 return {'id':c['id'],'errors':errors} if errors else None
issues=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for i,r in enumerate(pool.map(check,cat['clips'])):
  if r:issues.append(r)
  if i%1000==0:print(i,len(issues),flush=True)
sources={}
for sf in ['bundles.jsonl','supplemental_statuses.jsonl']:
 if (INV/sf).exists():
  for line in (INV/sf).open():
   d=json.loads(line)
   if d.get('clips'):sources[d['bundle']]=d
sourceIssues=[];sourceHashes={}
root=Path(json.loads((INV/'summary.json').read_text())['root'])
for rel in {c['source'] for c in cat['clips']}:
 dest=OUT/'sources'/rel;original=root/rel
 if not original.exists():original=INV/'supplemental-sources'/rel
 if not dest.exists():sourceIssues.append({'source':rel,'error':'missing'});continue
 if dest.stat().st_size!=sources[rel]['bytes']:sourceIssues.append({'source':rel,'error':'size'})
 def sha(p):
  h=hashlib.sha256()
  with p.open('rb') as f:
   for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
  return h.hexdigest()
 digest=sha(dest);sourceHashes[rel]=digest
 if original.exists() and sha(original)!=digest:sourceIssues.append({'source':rel,'error':'source_hash'})
(OUT/'source_sha256.json').write_text(json.dumps(sourceHashes,indent=2))
report={'cachedPayloadChecks':cache_hits,'freshPayloadChecks':len(cat['clips'])-cache_hits,'inventoryErrors':inventoryErrors,'sourceIssues':sourceIssues,'complete':cat['complete'],'inventoryClips':len(expected),'importedClips':len(actual),'missing':sorted(expected-actual),'unexpected':sorted(actual-expected),'duplicateIds':len(cat['clips'])-len({c['id'] for c in cat['clips']}),'payloadIssues':issues,'importErrors':cat['errors'],'categories':dict(collections.Counter(c['category'] for c in cat['clips'])),'playable':sum(c['playable'] for c in cat['clips']),'payloadBytes':sum(c['bytes'] for c in cat['clips'])}
bad={r['id'] for r in issues}
index={}
for c in cat['clips']:
 if c['id'] not in bad:
  st=(OUT/c['asset']).stat();index[c['id']]=[st.st_size,st.st_mtime_ns]
(OUT/'payload_audit_index.json').write_text(json.dumps({'files':index,'previousReport':'audit-main.json'},separators=(',',':')))
(OUT/'audit.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2),flush=True)
