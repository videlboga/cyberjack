from pathlib import Path
import json,time
base=next(p for p in Path(__file__).resolve().parents if (p/'BUNDLE_ROOT').exists())/'animations'
while True:
 records={}
 for p in base.glob('import-*.jsonl'):
  for line in p.open():
   try:r=json.loads(line);r['rig']='object' if not r['playable'] else 'male' if '/male/' in (r.get('origin') or r['source']) or (r.get('origin') or r['source']).endswith('/70.unity3d') or r['name'].lower().startswith('m_') else 'female' if '/female/' in (r.get('origin') or r['source']) or r['name'].lower().startswith('f_') else 'shared';records[r['id']]=r
   except json.JSONDecodeError:pass
 states=[]
 for n in range(8):
  try:states.append(json.loads((base/f'catalog-{n}.json').read_text()))
  except:pass
 complete=len(states)==8 and all(s.get('complete') for s in states)
 result={'format':'koikatsu-library-v1','complete':complete,'clips':sorted(records.values(),key=lambda c:(c['category'],c['source'],c['name'],c['id'])),'errors':[e for s in states for e in s.get('errors',[])]}
 p=base/'catalog.tmp';p.write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')));p.replace(base/'catalog.json')
 print(len(records),complete,flush=True)
 if complete:break
 time.sleep(10)
