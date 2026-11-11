#!/usr/bin/env python3
"""Conservative duplicate index. Keeps every source clip and alias file."""
import argparse,gzip,hashlib,json,os,collections,concurrent.futures
from pathlib import Path
import orjson
BASE=Path(__file__).resolve().parent

def fingerprint(clips):
 rows=sorted((c['id'],c['asset'],c.get('bytes'),c['source'],c.get('rig'),c.get('playable')) for c in clips)
 return hashlib.sha256(orjson.dumps(rows)).hexdigest()

def worker(c):
 try:
  raw=(BASE/c['asset']).read_bytes();payload=orjson.loads(gzip.decompress(raw));clip=payload['clip'];content={k:v for k,v in clip.items() if k!='m_Name'}
  # Unity object references/events are scoped to their serialized source file.
  scoped=not c.get('playable') or bool(clip.get('m_PPtrCurves')) or bool(clip.get('m_Events'))
  context={'rig':c.get('rig'),'source':c['source'] if scoped else None,'bindings':[(b.get('typeID'),b.get('attribute'),b.get('path'),b.get('resolvedPath'),b.get('offset'),b.get('width')) for b in payload['meta']['bindings']]}
  digest=hashlib.sha256(orjson.dumps({'clip':content,'context':context},option=orjson.OPT_SORT_KEYS)).hexdigest()
  return c['id'],hashlib.sha256(raw).hexdigest(),digest,None
 except Exception as e:return c['id'],None,None,repr(e)

def main():
 ap=argparse.ArgumentParser();ap.add_argument('--top',type=int,default=30);ap.add_argument('--workers',type=int,default=4);args=ap.parse_args()
 catalog=orjson.loads((BASE/'catalog.json').read_bytes());clips=catalog['clips'];meta={c['id']:c for c in clips};order={c['id']:i for i,c in enumerate(clips)};groups=collections.defaultdict(list);bytegroups=collections.defaultdict(list);errors=[]
 cachefile=BASE/'duplicates_hashes.jsonl';cached={};valid={};pending=[];specs={}
 if cachefile.exists():
  for line in cachefile.open():
   try:r=json.loads(line);cached[r['id']]=r
   except json.JSONDecodeError:pass
 for c in clips:
  st=(BASE/c['asset']).stat();spec=[st.st_size,st.st_mtime_ns,c.get('rig'),c.get('playable')];specs[c['id']]=spec;r=cached.get(c['id'])
  if r and r.get('spec')==spec and not r.get('error'):valid[c['id']]=r
  else:pending.append(c)
 print('cached',len(valid),'remaining',len(pending),flush=True)
 with cachefile.open('a') as cache,concurrent.futures.ProcessPoolExecutor(max_workers=args.workers) as pool:
  for i,(uid,rawhash,digest,error) in enumerate(pool.map(worker,pending,chunksize=64)):
   r={'id':uid,'spec':specs[uid],'rawhash':rawhash,'digest':digest,'error':error};valid[uid]=r;cache.write(json.dumps(r)+'\n')
   if i%1000==0:cache.flush();print('checked',i,flush=True)
 for c in clips:
  r=valid[c['id']]
  if r['error']:errors.append({'id':c['id'],'error':r['error']})
  else:groups[r['digest']].append(c['id']);bytegroups[r['rawhash']].append(c['id'])
 def rows(mapping):
  out=[]
  for digest,ids in mapping.items():
   if len(ids)<2:continue
   ids.sort(key=order.get);names=sorted({meta[i]['name'] for i in ids});sizes=[meta[i]['bytes'] for i in ids]
   out.append({'hash':digest,'clips':len(ids),'names':names[:12],'name_unique':len(names),'source_count':len({meta[i]['source'] for i in ids}),'keep':ids[0],'dups':ids[1:],'potential_shared_bytes':sum(sizes)-min(sizes)})
  return sorted(out,key=lambda g:-g['potential_shared_bytes'])
 allgroups=rows(groups);full=[g for g in allgroups if g['name_unique']==1];aliases=[g for g in allgroups if g['name_unique']>1]
 result={'format':'koikatsu-duplicates-v2','catalog_fingerprint':fingerprint(clips),'total_clips':len(clips),'catalog_complete':catalog['complete'],'decode_errors':len(errors),'errors':errors,'method':'sha256(canonical full clip except name + rig + resolved binding layout + source scope for objects/events/PPtr); index only, originals retained','summary':{'byte_dupe_groups':len(rows(bytegroups)),'full_dupe_groups(name+motion)':len(full),'alias_groups(motion_only)':len(aliases),'motion_unique_groups':len(groups),'wasted_bytes_motion':sum(g['potential_shared_bytes'] for g in allgroups)},'dedupe':{'keep':{g['keep']:g['dups'] for g in allgroups}},'top_full_dupes':full[:args.top],'top_alias_groups':aliases[:args.top]}
 temp=BASE/'duplicates_report.tmp';temp.write_bytes(orjson.dumps(result));temp.replace(BASE/'duplicates_report.json');print(json.dumps({k:v for k,v in result.items() if k not in ('dedupe','top_full_dupes','top_alias_groups')},indent=2),flush=True)
 if errors:raise SystemExit(1)
if __name__=='__main__':main()
