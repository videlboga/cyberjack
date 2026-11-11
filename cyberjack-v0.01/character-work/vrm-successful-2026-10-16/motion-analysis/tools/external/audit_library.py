"""Read-only external corpus audit; writes derived report, never changes library."""
import json,math,re,statistics
from pathlib import Path
base=Path(__file__).resolve().parents[2]; lib=base/'external-library'
manifest=json.loads((lib/'manifest.json').read_text());rows=[];bad=[];fps_bad=[]
for name in ['100style','cmu']:
 for c in json.loads((lib/'clips'/f'{name}.json').read_text())['clips']:
  tracks=c['tracks'];errs=[];norm=0;seams=[]
  for t in tracks:
   if len(t['rotations'])!=4*len(t['times']):errs.append('channel-length')
   if any(b<=a for a,b in zip(t['times'],t['times'][1:])):errs.append('time-order')
   qs=[t['rotations'][i:i+4] for i in range(0,len(t['rotations']),4)]
   for q in qs:
    if len(q)!=4 or not all(math.isfinite(v) for v in q):errs.append('invalid-quaternion');continue
    norm=max(norm,abs(math.sqrt(sum(v*v for v in q))-1))
   if qs:
    dot=abs(sum(a*b for a,b in zip(qs[0],qs[-1])));seams.append(math.degrees(2*math.acos(min(1,dot))))
  source=Path(manifest['sources'][name]['path'])/('/'.join(c['source'].split('/')[1:]) if name=='100style' else c['source'])
  source_frames=ft=None
  if source.exists():
   with source.open() as f:
    for line in f:
     if line.startswith('Frames:'):source_frames=int(line.split(':')[1])
     if line.startswith('Frame Time:'):ft=float(line.split(':')[1]);break
  assumed=60 if name=='100style' else 120
  if ft and abs(1/ft-assumed)>.1:fps_bad.append({'id':c['id'],'fps':1/ft,'assumed':assumed})
  row={'id':c['id'],'dataset':name,'tags':c['tags'],'description':c['provenance'].get('description'), 'sourceExists':source.exists(),'sourceSeconds':source_frames*ft if ft and source_frames else None,'fpsActual':1/ft if ft else None,'quaternionNormError':norm,'bones':len(tracks),'sampleSpan':max(t['times'][-1] for t in tracks),'duration':c['duration'],'seamRmsDeg':math.sqrt(sum(v*v for v in seams)/len(seams)),'seamMaxDeg':max(seams),'errors':list(set(errs))}
  rows.append(row)
  if errs or norm>1e-4:bad.append(row['id'])
report={'clips':len(rows),'invalid':bad,'fpsMismatches':fps_bad,'sourceAvailable':sum(r['sourceExists'] for r in rows),'durationVsSampleSpan':sum(abs(r['duration']-r['sampleSpan'])>.01 for r in rows),'cyclicCandidatesAbove20DegSeam':sum(r['tags'].get('movement') in ['FW','FR'] and r['seamRmsDeg']>20 for r in rows),'rows':rows}
p=base/'artifacts/external-audit/report.json';p.write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps({k:v for k,v in report.items() if k!='rows'},ensure_ascii=False));
for r in rows:
 if r['tags'].get('style') in ['Neutral','Old','Depressed','Elated','GracefulArms','March'] or r['tags'].get('keyword') in ['lie','stand up','kneel']:print(r['id'],r['tags'], 'source',r['sourceSeconds'],'seamRMS',round(r['seamRmsDeg'],1))
