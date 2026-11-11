from pathlib import Path
import json,gzip,struct,collections,numpy as np,hashlib,os,concurrent.futures
B=Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16');O=B/'scene-objects';c=json.load(open(O/'catalog.json'));errors=[];sourcewarnings=[];records=c['objects']+c['placements']+c['furniture'];ids={r['id'] for r in records};counts=collections.Counter()
for r in records:
 raw=json.load(gzip.open(O/r['native']));expected=sum(any(x['type'] in ['MeshFilter','SkinnedMeshRenderer'] and x['data'].get('m_Mesh',{}).get('m_PathID') for x in n['components']) for n in raw['nodes'])
 if expected!=r['meshes']:errors.append({'id':r['id'],'kind':'mesh-count','expected':expected,'actual':r['meshes']})
 if r.get('model'):
  b=(O/r['model']).read_bytes();j=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]]);counts['models']+=1
  for im in j.get('images',[]):
   if 'bufferView' not in im:errors.append({'id':r['id'],'kind':'nonembedded-image'})
  counts['skins']+=len(j.get('skins',[]));counts['meshes']+=len(j.get('meshes',[]))
  for mesh in j.get('meshes',[]):
   for p in mesh['primitives']:
    a=j['accessors'][p['attributes']['POSITION']]
    if not np.isfinite(a['min']+a['max']).all():errors.append({'id':r['id'],'kind':'nonfinite-bounds'})
for table in c['itemTables']:
 for r in table['data']['param']:
  if r.get('objectId') not in ids:errors.append({'kind':'missing-object','table':table['data']['m_Name'],'item':r['nameObject']})
for s in c['scenes']:
 if s['fileItem'] and not any(t['data']['m_Name']==s['fileItem'] for t in c['itemTables']):
  row={'kind':'missing-item-table-in-original-source','scene':s['id'],'table':s['fileItem']}
  evidence=json.load(open(O/'reports/source-item-tables.json'))
  if s['fileItem'] in evidence['requested'] and not evidence['matches']:sourcewarnings.append(row)
  else:errors.append(row)
a=json.load(open(O/'animation-links.json'));warnings=sourcewarnings+[{'kind':'missing-in-original-source',**r} for r in a['unresolved']]
for row in warnings:
 if row.get('animator') and row['animator']!='khh_p_61':errors.append(row)
counts.update(objects=len(c['objects']),placements=len(c['placements']),maps=len(c['maps']),furniture=len(c['furniture']),animatedItemRows=len(a['resolved']))
G=Path(os.environ.get('KOIKATSU_ABDATA','/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata'))
def digest(p):
 h=hashlib.sha256()
 with p.open('rb') as f:
  for chunk in iter(lambda:f.read(1024*1024),b''):h.update(chunk)
 return h.hexdigest()
def checksource(item):
 rel,row=item;p=O/row['asset'];sha=digest(p);original=G/rel;match=digest(original)==sha if original.exists() else None
 return {'source':rel,'sha256':sha,'matchesOriginal':match,'bytes':p.stat().st_size}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:sourcechecks=list(pool.map(checksource,c['sources'].items()))
errors.extend({'kind':'source-copy-mismatch','source':r['source']} for r in sourcechecks if r['matchesOriginal'] is False)
counts['sourceArchives']=len(sourcechecks)
report={'sourceArchives':sourcechecks,'counts':dict(counts),'errors':errors,'warnings':warnings};(O/'reports/reference-validation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False));raise SystemExit(bool(errors))
