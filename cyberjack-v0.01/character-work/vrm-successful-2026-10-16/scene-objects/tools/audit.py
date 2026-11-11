import gzip,json,pathlib,collections,UnityPy
B=pathlib.Path('/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16/animation-links')
G=pathlib.Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6/abdata')
scenes=json.load(open(B/'scenes.json'))['scenes']
tables=[]
for f in (B/'tables').glob('*.gz'):
 d=json.load(gzip.open(f)); data=d['data']
 if data.get('m_Name','').startswith('item_'): tables.append(d)
refs={}
for t in tables:
 for row in t['data'].get('param',[]):
  if row.get('pathAssetObject') and row.get('nameObject'): refs[(row['pathAssetObject'],row['nameObject'])]=row
objects=[]
for bundle in sorted(set(k[0] for k in refs)):
 env=UnityPy.load(str(G/bundle))
 for (path,name),row in refs.items():
  if path!=bundle: continue
  matches=[(k,v) for k,v in env.container.items() if pathlib.PurePosixPath(k).stem.lower()==name.lower()]
  counts=collections.Counter(); seen=set()
  def walk(go):
   if go.path_id in seen:return
   seen.add(go.path_id)
   obj=go.read()
   for comp in obj.m_Component:
    ptr=comp.component
    if not ptr.path_id:continue
    r=ptr.deref();counts[r.type.name]+=1
    if r.type.name=='Transform':
     for child in r.read().m_Children: walk(child.read().m_GameObject.deref())
  for _,go in matches: walk(go)
  objects.append({'bundle':path,'name':name,'found':len(matches)==1,'assetPaths':[k for k,_ in matches],'components':dict(counts)})
report={'scope':'267 preserved scene variants; counts are table rows, not deduplicated actions','counts':{'scenes':len(scenes),'chairScenes':sum(s['row'].get('useChair',0)>0 for s in scenes),'deskScenes':sum(s['row'].get('useDesk',0)>0 for s in scenes),'itemScenes':sum(bool(s['row'].get('paramFemale',{}).get('fileItem')) for s in scenes),'itemTables':len(tables),'itemRows':sum(len(t['data'].get('param',[])) for t in tables),'uniquePrefabReferences':len(refs),'prefabsFound':sum(o['found'] for o in objects)},'objects':objects,'tables':tables,'furnitureScenes':[{'id':s['id'],'name':s['name'],'chairs':s['row'].get('useChair',0),'desks':s['row'].get('useDesk',0)} for s in scenes if s['row'].get('useChair',0) or s['row'].get('useDesk',0)],'limitations':['Furniture comes from map/HPoint context, not a unique prefab reference in each scene.','Object geometry, animation and bindings are not yet rendered by the viewer.','fileHitObject is not a list of visible props.']}
pathlib.Path('work/scene-objects/audit.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report['counts']));print([(o['name'],o['components'].get('MeshRenderer',0),o['components'].get('SkinnedMeshRenderer',0)) for o in objects])
