from pathlib import Path
import os,json,gzip,re,collections,UnityPy
B=Path(os.environ.get('CHARACTER_BUNDLE',str(next(p for p in Path(__file__).resolve().parents if (p/'BUNDLE_ROOT').exists()))));F=B/'facial-control';OUT=F/'scene-links';OUT.mkdir(exist_ok=True);(OUT/'raw').mkdir(exist_ok=True)
def gz(p,x):
 payload=json.dumps(x,ensure_ascii=False,separators=(',',':')).encode()
 with gzip.GzipFile(filename=str(p),mode='wb',mtime=0) as f:f.write(payload)
profiles={};effective={};raw=[]
for id,folder in [('rin','rin-four-outfits'),('mira','mira')]:
 character=json.load(open(B/'inputs/exports'/folder/'KK_CharacterInfoData.json'))[0];profiles[id]={'personality':character['Personality'],'key':f"c{character['Personality']:02}",'characterSource':f'inputs/exports/{folder}/KK_CharacterInfoData.json'}
for p in sorted((B/'animation-links/sources/h/list').glob('*.unity3d')):
 e=UnityPy.load(str(p))
 for o in e.objects:
  if o.type.name!='MonoBehaviour':continue
  d=o.read_typetree();name=d.get('m_Name','')
  wanted=name.startswith('breath_') or any(name.startswith('HFaceList_'+pr['key']+'_') or name=='personality_breath_'+pr['key'] for pr in profiles.values())
  if not wanted:continue
  record={'source':'h/list/'+p.name,'pathId':str(o.path_id),'name':name,'data':d};uid=p.stem+'-'+name;gz(OUT/'raw'/(uid+'.json.gz'),record);raw.append({'name':name,'source':record['source'],'asset':'raw/'+uid+'.json.gz'})
  rows=effective.setdefault(name,{})
  for row in d.get('param',[]):
   key=row.get('anim',row.get('mode',row.get('id')));rows[str(key)]={**row,'_source':record['source'],'_table':name}
baseface=json.load(open(F/'catalog.json'));native=json.load(open(F/'native-controllers.json'))['controllers'][0]
for id,profile in profiles.items():
 key=profile['key'];faces={name.removeprefix('HFaceList_'+key+'_'):rows for name,rows in effective.items() if name.startswith('HFaceList_'+key+'_')};breath=effective.get('personality_breath_'+key,{});mapping={};unmapped=[]
 for kind,ctrl,prefix in [('Eye','EyesCtrl','eye_face.'),('Mouth','MouthCtrl','kuti_face.'),('Eyebrow','EyebrowCtrl','mayuge.')]:
  targets=next(t for t in native['targets'][ctrl] if any(n.startswith(prefix) for n in t['channels']));mapped={}
  for i,pair in enumerate(targets['pairs']):
   candidates=[]
   for p in baseface['profiles'][id]['groups'][kind]:
    values=[(n,w) for n,w in zip(p['source']['blendShapeName'],p['source']['blendShapeWeight']) if n.startswith(prefix) and w>0]
    if p['supported'] and values and max(values,key=lambda x:x[1])[0]==pair['open']:candidates.append(p)
   if candidates:mapped[str(i)]={'id':candidates[0]['id'],'name':candidates[0]['name'],'sourceShape':pair['open'],'closedSourceShape':pair['close'],'equivalentCandidates':[p['id'] for p in candidates]}
   else:unmapped.append({'kind':kind,'nativeId':i,'sourceShape':pair['open']})
  mapping[kind]=mapped
 output={'personality':profile['personality'],'key':key,'faces':faces,'breath':breath,'mapping':mapping,'unmappedPatterns':unmapped};gz(OUT/(id+'.json.gz'),output);profile['asset']=id+'.json.gz';print(id,'tables',len(faces),'face rows',sum(map(len,faces.values())),'unmapped',len(unmapped),flush=True)
rules={name.removeprefix('breath_').split('_')[0]:rows for name,rows in effective.items() if name.startswith('breath_')};gz(OUT/'rules.json.gz',rules)
# Find the original base states by their clip membership, not by guessing prefixes.
idx={c['id']:c for c in json.load(open(B/'animation-links/controllers.json'))['controllers']};cache={}
def ctrl(id):
 if id not in cache:cache[id]=json.load(gzip.open(B/'animation-links'/idx[id]['asset']))
 return cache[id]
def state_names(c,s):
 names={r['clip']:r['name'] for r in c['clips'] if r['clip']};return {names[n['clip']] for t in s['trees'] for n in t if n.get('clip') in names}
aliases={};ambiguous=[]
for scene in json.load(open(B/'animation-links/scenes.json'))['scenes']:
 main=next((l for l in scene['links'] if l['role']=='paramFemale.path'),None);base=next((l for l in scene['links'] if l['role']=='pathFemaleBase'),None)
 if not main or not base or not main['controllers'] or not base['controllers']:continue
 a,b=ctrl(main['controllers'][0]),ctrl(base['controllers'][0]);lookup=collections.defaultdict(set)
 for s in b['layers'][0]['states']:
  for n in state_names(b,s):lookup[n].add(s['name'])
 mapped={}
 for s in a['layers'][0]['states']:
  ns=state_names(a,s);matches=set.intersection(*(lookup[n] for n in ns)) if ns else set()
  if len(matches)==1:mapped[s['name']]=next(iter(matches))
  else:ambiguous.append({'scene':scene['id'],'state':s['name'],'candidates':sorted(matches)})
 aliases[scene['id']]={'mode':scene['row']['numCtrl'],'states':mapped,'main':main['controllers'][0],'base':base['controllers'][0]}
gz(OUT/'aliases.json.gz',aliases);(OUT/'catalog.json').write_text(json.dumps({'format':'koikatsu-scene-face-v1','profiles':profiles,'rules':'rules.json.gz','aliases':'aliases.json.gz','raw':raw},ensure_ascii=False,indent=2));(OUT/'extraction-report.json').write_text(json.dumps({'rawTables':len(raw),'sceneAliases':len(aliases),'mappedStates':sum(len(a['states']) for a in aliases.values()),'ambiguousOrUnmatched':ambiguous},ensure_ascii=False,indent=2));print('aliases',len(aliases),'unmatched',len(ambiguous),flush=True)
