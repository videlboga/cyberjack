from pathlib import Path
import UnityPy,json,struct,hashlib,shutil
B=next(p for p in Path(__file__).resolve().parents if (p/'BUNDLE_ROOT').exists());OUT=B/'facial-control';OUT.mkdir(exist_ok=True)
GAME=Path('/home/cyberkitty/Projects/[PL] [ScrewThisNoise] Koikatsu Sunshine BetterRepack/[ScrewThisNoise] Koikatsu Sunshine EX BetterRepack R6');source=OUT/'sources/bo_head_00.unity3d';env=UnityPy.load(str(source));controllers=[]
for obj in env.objects:
 if obj.type.name!='MonoBehaviour':continue
 try:script=obj.read().m_Script.read().m_ClassName
 except:continue
 if script!='FaceBlendShape':continue
 d=obj.read_typetree();objects=obj.assets_file.objects
 def resolve(ptr):return objects[ptr['m_PathID']]
 root=resolve(d['m_GameObject']).read_typetree()['m_Name'];record={'root':root,'pathId':str(obj.path_id),'data':d,'targets':{}}
 for group in ['EyebrowCtrl','EyesCtrl','MouthCtrl']:
  record['targets'][group]=[]
  for target in d[group]['FBSTarget']:
   go=resolve(target['ObjTarget']).read_typetree();mesh=None
   for c in go['m_Component']:
    o=resolve(c['component'])
    if o.type.name=='SkinnedMeshRenderer':mesh=resolve(o.read_typetree()['m_Mesh']).read_typetree();break
   names=[c['name'] for c in mesh['m_Shapes']['channels']] if mesh else []
   pairs=[{'close':names[p['Close']] if p['Close']>=0 else None,'open':names[p['Open']] if p['Open']>=0 else None} for p in target['PtnSet']]
   record['targets'][group].append({'object':go['m_Name'],'mesh':mesh['m_Name'] if mesh else None,'channels':names,'pairs':pairs})
 controllers.append(record)
(OUT/'native-controllers.json').write_text(json.dumps({'format':'koikatsu-face-native-v1','source':'abdata/chara/bo_head_00.unity3d','controllers':controllers},ensure_ascii=False,indent=2))
def shape_names(path):
 b=path.read_bytes();d=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]]);return set(n for m in d['meshes'] for n in m.get('extras',{}).get('targetNames',[]))
profiles={}
for char,export,path in [('rin','rin-four-outfits',B/'characters/rin/outfits/Rin_outfit_00.vrm'),('mira','mira',B/'characters/mira/Mira_outfit_00.vrm')]:
 src=B/'inputs/exports'/export/'KK_BlendShapeInfo.json';patterns=json.loads(src.read_text());available=shape_names(path);groups={};counter={}
 for pattern in patterns:
  kind=pattern['type'];index=counter.get(kind,0);counter[kind]=index+1
  label=pattern['patternName'];base=kind+' '+('Default' if label=='デフォルト' else label)
  entry={'id':index,'name':label,'label':label,'open':base,'closed':base+', Closed' if kind=='Mouth' else None,'source':pattern,'supported':base in available and pattern.get('gagEye',-1)<0 and not pattern.get('isExpression')}
  if kind=='Eye':
   face=[(n,w) for n,w in zip(pattern['blendShapeName'],pattern['blendShapeWeight']) if n.startswith('eye_face.') and w>0]
   open_name=max(face,key=lambda x:x[1])[0] if face else None
   pairs=[p for t in controllers[0]['targets']['EyesCtrl'] if any(n.startswith('eye_face.') for n in t['channels']) for p in t['pairs']]
   pair=next((p for p in pairs if p['open']==open_name),None)
   closed=pair['close'] if pair else None
   match=next((q for q in patterns if q['type']=='Eye' and [(n,w) for n,w in zip(q['blendShapeName'],q['blendShapeWeight']) if n.startswith('eye_face.') and w>0]==[(closed,100.0)]),None)
   entry['closed']='Eye '+('Default' if match['patternName']=='デフォルト' else match['patternName']) if match else 'Eye 両目閉じ'
  if entry['closed'] and entry['closed'] not in available:entry['supported']=False
  if not entry['supported']:entry['reason']='Требует отдельных материалов/геометрии или отсутствующего морфа'
  groups.setdefault(kind,[]).append(entry)
 profiles[char]={'groups':groups,'availableMorphs':sorted(available),'source':str(src.relative_to(B))}
 shutil.copy2(src,OUT/(char+'-BlendShapeInfo.json'))
config={'format':'koikatsu-face-control-v1','profiles':profiles,'blink':controllers[0]['data']['BlinkCtrl'],'controllers':'native-controllers.json'}
(OUT/'catalog.json').write_text(json.dumps(config,ensure_ascii=False,indent=2));(OUT/'sources').mkdir(exist_ok=True);
if source.resolve()!=(OUT/'sources/bo_head_00.unity3d').resolve():shutil.copy2(source,OUT/'sources/bo_head_00.unity3d')
print([(c,{g:(len(ps),sum(p['supported'] for p in ps)) for g,ps in v['groups'].items()}) for c,v in profiles.items()])
