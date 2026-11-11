import {applyTongueClearance} from './emotion-tongue-clearance.js?v=tongue86';
import {relaxedEyeDelta} from './emotion-surface.js?v=8';
import {clamp,channels} from './emotion-core.js?v=10';
const known=new Set(channels);
const normal=s=>s.normalize('NFKC').replace(/\s+/g,' ').trim();
export function validateProfile(p){
 if(!p||p.format!=='cyberjack-emotion-head-profile'||p.version!==1||!p.mapping||typeof p.mapping!=='object'||Array.isArray(p.mapping))throw Error('Нужен профиль головы версии 1');
 for(const [key,value] of Object.entries(p.mapping))if(!known.has(key)||typeof value!=='string'||!value.length||value.length>160)throw Error('Некорректная привязка '+key);
 for(const settings of [p,...Object.values(p.characters||{})]){if(settings.mouthShapeFloor!=null&&(typeof settings.mouthShapeFloor!=='number'||!Number.isFinite(settings.mouthShapeFloor)||settings.mouthShapeFloor<0||settings.mouthShapeFloor>1))throw Error('Некорректный минимум формы рта');if(settings.regionStrength){for(const [region,v]of Object.entries(settings.regionStrength))if(!['eye','brow','mouth','effect'].includes(region)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>1.5)throw Error('Некорректное усиление области');}}
 if(p.portraitTeeth!=null&&p.portraitTeeth!==false&&(typeof p.portraitTeeth!=='string'||!/^#[0-9a-f]{6}$/i.test(p.portraitTeeth)))throw Error('Некорректный цвет зубов');
 if(p.portraitIris!=null&&typeof p.portraitIris!=='boolean')throw Error('Некорректный стиль радужки');
 for(const c of Object.values(p.characters||{})){const g=c.portrait?.glasses;if(!g)continue;if(g.shape!=null&&!['ellipse','roundedRect'].includes(g.shape))throw Error('Некорректная форма оправы');if(g.color!=null&&(typeof g.color!=='string'||!/^#[0-9a-f]{6}$/i.test(g.color)))throw Error('Некорректный цвет оправы');for(const [k,lo,hi]of [['radiusX',.01,.06],['radiusY',.01,.05],['thickness',.0001,.003],['depth',.05,.13],['centerX',.02,.07],['centerY',1.46,1.54],['cornerPower',2,6],['wrapDepth',0,.04],['tilt',-.5,.5]])if(g[k]!=null&&(!Number.isFinite(g[k])||g[k]<lo||g[k]>hi))throw Error('Некорректная посадка оправы');}
 for(const c of Object.values(p.characters||{})){const flowers=c.portrait?.flowers;if(flowers==null)continue;if(!Array.isArray(flowers)||flowers.length>5)throw Error('Некорректные цветы');for(const f of flowers){if(!Array.isArray(f.position)||f.position.length!==3||f.position.some(v=>!Number.isFinite(v))||Math.abs(f.position[0])>.2||f.position[1]<1.4||f.position[1]>1.75||Math.abs(f.position[2])>.2||!Number.isFinite(f.radius)||f.radius<.004||f.radius>.04||(f.rotation!=null&&(!Array.isArray(f.rotation)||f.rotation.length!==3||f.rotation.some(v=>!Number.isFinite(v)||Math.abs(v)>Math.PI))))throw Error('Некорректная посадка цветка');}}
 for(const c of Object.values(p.characters||{})){const a=c.portrait?.accessories;if(a==null)continue;if(typeof a!=='object'||Array.isArray(a))throw Error('Некорректные украшения');if(a.color!=null&&!/^#[0-9a-f]{6}$/i.test(a.color))throw Error('Некорректный цвет лент');for(const k of ['bows','earrings','necklace']){const o=a[k];if(o==null)continue;if(k==='bows'&&o.asset){if(typeof o.asset!=='string'||!Array.isArray(o.roots)||o.roots.length!==2||o.roots.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>!Number.isFinite(v)||Math.abs(v)>1)))throw Error('Некорректные корни бантов');continue;}const n=k==='necklace'?2:3;if(!Array.isArray(o.position)||o.position.length!==n||o.position.some(v=>!Number.isFinite(v))||o.position.some(v=>Math.abs(v)>2))throw Error('Некорректная посадка украшений');}if(a.bows&&(!Number.isFinite(a.bows.size)||a.bows.size<.005||a.bows.size>.06))throw Error('Некорректный размер банта');if(a.necklace&&(!Number.isFinite(a.necklace.radius)||a.necklace.radius<.015||a.necklace.radius>.08))throw Error('Некорректный размер ожерелья');}
 for(const c of Object.values(p.characters||{}))if(c.portrait?.iris!=null&&!['amber','cyan',false].includes(c.portrait.iris))throw Error('Некорректный стиль радужки');
 const gasp=p.procedural?.gasp;if(gasp&&(typeof gasp.nativeMorph!=='string'||!Number.isFinite(gasp.verticalGain)||gasp.verticalGain<1||gasp.verticalGain>1.8||!Number.isFinite(gasp.widthGain)||gasp.widthGain<1||gasp.widthGain>1.2))throw Error('Некорректное раскрытие рта');
 const cavity=p.procedural?.mouthCavity;if(cavity&&(!Array.isArray(cavity.uvBounds)||cavity.uvBounds.length!==4||cavity.uvBounds.some(v=>!Number.isFinite(v)||v<0||v>1)||cavity.uvBounds[0]>=cavity.uvBounds[2]||cavity.uvBounds[1]>=cavity.uvBounds[3]||!Number.isFinite(cavity.edge)||cavity.edge<=0||cavity.edge>.05))throw Error('Некорректная маска полости рта');
 if(gasp)for(const key of ['tongueDrop','tongueRetract'])if(gasp[key]!=null&&(!Number.isFinite(gasp[key])||gasp[key]<0||gasp[key]>.015))throw Error('Некорректная посадка языка внутри рта');
 const procedural=p.procedural?.irisContract;if(procedural&&(typeof procedural.materialPrefix!=='string'||!procedural.materialPrefix||!Number.isFinite(procedural.maximumContraction)||procedural.maximumContraction<0||procedural.maximumContraction>.6))throw Error('Некорректная привязка радужек');
 const converge=p.procedural?.irisContract?.maximumConvergence;if(converge!=null&&(!Number.isFinite(converge)||converge<0||converge>.35))throw Error('Некорректное сведение глаз');
 const asym=p.procedural?.asymmetry;if(asym&&(typeof asym.enabled!=='boolean'||!Number.isFinite(asym.blendWidth)||asym.blendWidth<.0001||asym.blendWidth>.05))throw Error('Некорректная асимметрия');
 for(const settings of [p,...Object.values(p.characters||{})]){const tongue=settings.procedural?.tongueOut;if(tongue&&(!tongue.materialPrefix||!tongue.nativeMorph||!Number.isFinite(tongue.width)||tongue.width<.5||tongue.width>1||!Number.isFinite(tongue.forward)||tongue.forward<.5||tongue.forward>1||!Number.isFinite(tongue.drop)||tongue.drop<0||tongue.drop>.01||(tongue.clearance!=null&&(!Number.isFinite(tongue.clearance)||tongue.clearance<0||tongue.clearance>.06))))throw Error('Некорректная посадка языка');if(tongue?.tipLift!=null&&(!Number.isFinite(tongue.tipLift)||tongue.tipLift<0||tongue.tipLift>.02))throw Error('Некорректный изгиб кончика языка');if(tongue?.floorDrop!=null&&(!Number.isFinite(tongue.floorDrop)||tongue.floorDrop<0||tongue.floorDrop>.03))throw Error('Некорректное опускание языка');if(tongue?.exitLift!=null&&(!Number.isFinite(tongue.exitLift)||tongue.exitLift<0||tongue.exitLift>.02))throw Error('Некорректный изгиб основания языка');}
 const water=p.procedural?.waterEffects;if(water){if(typeof water.tongueMaterialPrefix!=='string'||!Array.isArray(water.paths)||water.paths.length>64)throw Error('Некорректный профиль водных эффектов');for(const row of water.paths)if(!['tears','sweat','saliva'].includes(row.type)||!Number.isFinite(row.seed)||row.seed<0||row.seed>1||!Number.isFinite(row.radius)||row.radius<.0001||row.radius>.02||!Array.isArray(row.points)||row.points.length<2||row.points.length>16||row.points.some(v=>!Array.isArray(v)||v.length!==3||v.some(n=>!Number.isFinite(n)||Math.abs(n)>100)))throw Error('Некорректная дорожка водного эффекта');}
 const gaze=p.gazeCalibration;if(gaze)for(const key of ['horizontalDegrees','upDegrees','downDegrees'])if(!Number.isFinite(gaze[key])||gaze[key]<1||gaze[key]>40)throw Error('Некорректная калибровка взгляда');
 if(gaze?.verticalSign!=null&&![-1,1].includes(gaze.verticalSign))throw Error('Некорректное направление взгляда');
 const relax=p.procedural?.relaxedEyes;if(relax){if(!Array.isArray(relax.materialPrefixes)||!relax.materialPrefixes.length||relax.materialPrefixes.some(v=>typeof v!=='string'||!v)||['centerX','centerY','halfWidth','halfHeight','frontStart','cornerDrop'].some(k=>!Number.isFinite(relax[k]))||relax.halfWidth<=0||relax.halfHeight<=0||relax.cornerDrop<0||relax.cornerDrop>.02)throw Error('Некорректное расслабление век');}
 for(const c of Object.values(p.characters||{}))if(c.restingPose)for(const [k,v]of Object.entries(c.restingPose))if((!k.startsWith('eye.')&&!k.startsWith('brow.')&&k!=='lid.close')||!known.has(k)||!Number.isFinite(v)||v<0||v>1)throw Error('Некорректная базовая форма век');
 const checkGains=g=>{if(!g||typeof g!=='object'||Array.isArray(g))throw Error('Некорректная калибровка');for(const [k,v] of Object.entries(g))if(!known.has(k)||typeof v!=='number'||!Number.isFinite(v)||v<0||v>2)throw Error('Некорректное усиление '+k);};
 checkGains(p.gains||{});if(p.characters){if(typeof p.characters!=='object'||Array.isArray(p.characters)||Object.keys(p.characters).length>100)throw Error('Некорректные персонажи');for(const c of Object.values(p.characters)){checkGains(c.gains||{});if(c.mapping!=null){if(typeof c.mapping!=='object'||Array.isArray(c.mapping)||Object.keys(c.mapping).length>known.size)throw Error('Некорректные привязки персонажа');for(const [key,value]of Object.entries(c.mapping))if(!known.has(key)||typeof value!=='string'||!value.length||value.length>160)throw Error('Некорректная привязка персонажа '+key);}if(c.clips){if(typeof c.clips!=='object'||Array.isArray(c.clips)||Object.keys(c.clips).length>256)throw Error('Некорректная калибровка клипов');for(const [id,tune] of Object.entries(c.clips)){if(!/^[a-z][a-z0-9_]{0,63}$/.test(id))throw Error('Некорректный id калибровки');checkGains(tune.gains||{});if(tune.mouthShapeFloor!=null&&(!Number.isFinite(tune.mouthShapeFloor)||tune.mouthShapeFloor<0||tune.mouthShapeFloor>1))throw Error('Некорректная форма рта клипа');}}}}
 return structuredClone(p);
}
// Resolve names again after any model reload. Never persist runtime target indices.
export class EmotionVRMAdapter{
 constructor(head,profile){this.head=head;this.profile=validateProfile(profile);this.character='';this.model=null;this.bindings=new Map();this.owned=[];this.regions=new Map();this.missing=[];this.lastActive=false;this.irisRecords=new Map();this.irisModel=null;this.sideRecords=new Map();this.sideVersions=new WeakMap();this.sideModel=null;this.tongueRecords=new Map();this.tongueModel=null;this.lookModel=null;this.lookDefaults=[];this.relaxRecords=new Map();this.relaxModel=null;this.gaspRecords=new Map();this.gaspModel=null;}
 setProfile(profile){this.clear();this.profile=validateProfile(profile);this.model=null;this.sideVersions=new WeakMap();this.effects?.invalidateProfile?.();}
 ensureIris(){
  const config=this.profile.procedural?.irisContract;if(!config)return;
  if(this.irisModel!==this.head.vrm){this.irisRecords.clear();this.irisModel=this.head.vrm;}
  for(const mesh of this.head.meshes||[]){
   const originals=this.head.originalMaterials?.get(mesh)||mesh.material;
   if(![].concat(originals).some(m=>m?.name?.startsWith(config.materialPrefix)))continue;
   const g=mesh.geometry,p=g?.attributes?.position;if(!p?.clone)continue;
   let record=this.irisRecords.get(mesh);
   if(record?.version===p.version&&record.amount===config.maximumContraction&&record.convergence===config.maximumConvergence)continue;
   if(!record){
    let index=mesh.morphTargetDictionary['_CJ Iris Contract'];
    if(!Number.isInteger(index)||!g.morphAttributes.position[index]){index=g.morphAttributes.position.length;const target=p.clone();target.array.fill(0);g.morphAttributes.position.push(target);if(g.morphAttributes.normal?.length){const normal=g.attributes.normal.clone();normal.array.fill(0);g.morphAttributes.normal.push(normal);}}
    mesh.morphTargetDictionary['_CJ Iris Contract']=index;mesh.morphTargetInfluences[index]=0;
    record={index};this.irisRecords.set(mesh,record);
   }
   if(config.maximumConvergence!=null&&record.converge==null){let i=mesh.morphTargetDictionary['_CJ Iris Converge'];if(!Number.isInteger(i)||!g.morphAttributes.position[i]){i=g.morphAttributes.position.length;const target=p.clone();target.array.fill(0);g.morphAttributes.position.push(target);if(g.morphAttributes.normal?.length){const n=g.attributes.normal.clone();n.array.fill(0);g.morphAttributes.normal.push(n);}}mesh.morphTargetDictionary['_CJ Iris Converge']=i;mesh.morphTargetInfluences[i]=0;record.converge=i;}
   let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
   for(let i=0;i<p.array.length;i+=3){minX=Math.min(minX,p.array[i]);maxX=Math.max(maxX,p.array[i]);minY=Math.min(minY,p.array[i+1]);maxY=Math.max(maxY,p.array[i+1]);}
   const x=(minX+maxX)/2,y=(minY+maxY)/2,target=g.morphAttributes.position[record.index];
   for(let i=0;i<p.array.length;i+=3){target.array[i]=-(p.array[i]-x)*config.maximumContraction;target.array[i+1]=-(p.array[i+1]-y)*config.maximumContraction;target.array[i+2]=0;}
   if(record.converge!=null){const target=g.morphAttributes.position[record.converge];for(let i=0;i<p.array.length;i+=3){target.array[i]=-Math.sign(x)*(maxX-minX)*(config.maximumConvergence||0);target.array[i+1]=target.array[i+2]=0;}target.needsUpdate=true;}
   target.needsUpdate=true;record.convergence=config.maximumConvergence;record.version=p.version;record.amount=config.maximumContraction;g.dispose();this.model=null;
  }
 }
 ensureRelaxedEyes(){
  const config=this.profile.procedural?.relaxedEyes;if(!config)return;
  if(this.relaxModel!==this.head.vrm){this.relaxRecords.clear();this.relaxModel=this.head.vrm;}
  for(const mesh of this.head.meshes||[]){const material=this.head.originalMaterials?.get(mesh)||mesh.material;if(![].concat(material).some(m=>config.materialPrefixes.some(prefix=>m?.name?.startsWith(prefix))))continue;
   const g=mesh.geometry,p=g?.attributes?.position;if(!p?.clone)continue;let r=this.relaxRecords.get(mesh);const key=JSON.stringify(config);if(r?.version===p.version&&r.key===key)continue;
   if(!r){let index=mesh.morphTargetDictionary['_CJ Relaxed Eye Corners'];if(!Number.isInteger(index)||!g.morphAttributes.position[index]){index=g.morphAttributes.position.length;const target=p.clone();target.array.fill(0);g.morphAttributes.position.push(target);if(g.morphAttributes.normal?.length){const n=g.attributes.normal.clone();n.array.fill(0);g.morphAttributes.normal.push(n);}}mesh.morphTargetDictionary['_CJ Relaxed Eye Corners']=index;mesh.morphTargetInfluences[index]=0;r={index};this.relaxRecords.set(mesh,r);}
   const rest=this.head.faceEditor?.cache?.get(mesh)?.position||p.array;g.morphAttributes.position[r.index].array.set(relaxedEyeDelta(rest,config));g.morphAttributes.position[r.index].needsUpdate=true;r.version=p.version;r.key=key;g.dispose();this.model=null;
  }
 }
 ensureGasp(){
  const config=this.profile.characters?.[this.character]?.procedural?.gasp??this.profile.procedural?.gasp;if(!config)return;if(this.gaspModel!==this.head.vrm){this.gaspRecords.clear();this.gaspModel=this.head.vrm;}
  for(const mesh of this.head.meshes||[]){const g=mesh.geometry,p=g?.attributes?.position,index=mesh.morphTargetDictionary?.[config.nativeMorph],source=g?.morphAttributes?.position?.[index];if(!p?.clone||!source)continue;
   let r=this.gaspRecords.get(mesh);const key=JSON.stringify(config);if(r?.version===p.version&&r.sourceVersion===source.version&&r.key===key)continue;if(!source.array.some(v=>Math.abs(v)>1e-7))continue;
   if(!r){let i=mesh.morphTargetDictionary['_CJ Mouth Gasp'];if(!Number.isInteger(i)||!g.morphAttributes.position[i]){i=g.morphAttributes.position.length;g.morphAttributes.position.push(p.clone());if(g.morphAttributes.normal?.length){const n=g.attributes.normal.clone();n.array.set(g.morphAttributes.normal[index]?.array||new Float32Array(n.array.length));g.morphAttributes.normal.push(n);}}mesh.morphTargetDictionary['_CJ Mouth Gasp']=i;mesh.morphTargetInfluences[i]=0;r={index:i};this.gaspRecords.set(mesh,r);}
   const tongue=[].concat(this.head.originalMaterials?.get(mesh)||mesh.material).some(m=>m?.name?.includes('cf_m_tang')),teeth=[].concat(this.head.originalMaterials?.get(mesh)||mesh.material).some(m=>m?.name?.includes('cf_m_tooth')),toothGain=clamp(config.teethVerticalGain??config.verticalGain,0,2),target=g.morphAttributes.position[r.index];
   for(let i=0;i<source.array.length;i+=3){target.array[i]=tongue?(p.array[i]+source.array[i])*(config.tongueWidth??1)-p.array[i]:source.array[i]*config.widthGain;target.array[i+1]=source.array[i+1]*(tongue?1:teeth?toothGain:config.verticalGain);target.array[i+2]=source.array[i+2];if(tongue){const front=clamp((p.array[i+2]+source.array[i+2]-.025)/.03);target.array[i+1]-=(config.tongueDrop||0)*front+(config.tongueBaseDrop||0);target.array[i+2]-=(config.tongueRetract||0)*front;}}
   target.needsUpdate=true;if(g.morphAttributes.normal?.[r.index]){g.morphAttributes.normal[r.index].array.set(g.morphAttributes.normal[index]?.array||new Float32Array(p.array.length));g.morphAttributes.normal[r.index].needsUpdate=true;}r.version=p.version;r.sourceVersion=source.version;r.key=key;g.dispose();this.model=null;
  }
 }
 ensureTongue(){
  const config=this.profile.characters?.[this.character]?.procedural?.tongueOut??this.profile.procedural?.tongueOut;if(!config)return;
  if(this.tongueModel!==this.head.vrm){this.tongueRecords.clear();this.tongueModel=this.head.vrm;}
  for(const mesh of this.head.meshes||[]){
   const material=this.head.originalMaterials?.get(mesh)||mesh.material;if(![].concat(material).some(m=>m?.name?.startsWith(config.materialPrefix)))continue;
   const g=mesh.geometry,p=g?.attributes?.position,index=mesh.morphTargetDictionary?.[config.nativeMorph],source=g?.morphAttributes?.position?.[index];if(!p?.clone||!source)continue;
   let r=this.tongueRecords.get(mesh);if(r?.version===p.version&&r.sourceVersion===source.version&&r.key===JSON.stringify(config))continue;
   if(!r){let i=mesh.morphTargetDictionary['_CJ Tongue Out Fitted'];if(!Number.isInteger(i)||!g.morphAttributes.position[i]){i=g.morphAttributes.position.length;const target=p.clone();target.array.fill(0);g.morphAttributes.position.push(target);if(g.morphAttributes.normal?.length){const n=g.attributes.normal.clone();n.array.set(g.morphAttributes.normal[index]?.array||new Float32Array(n.array.length));g.morphAttributes.normal.push(n);}}mesh.morphTargetDictionary['_CJ Tongue Out Fitted']=i;mesh.morphTargetInfluences[i]=0;r={index:i};this.tongueRecords.set(mesh,r);}
   if(r.clearance==null){r.clearance=g.morphAttributes.position.length;const correction=p.clone();correction.array.fill(0);g.morphAttributes.position.push(correction);if(g.morphAttributes.normal?.length){const n=g.attributes.normal.clone();n.array.fill(0);g.morphAttributes.normal.push(n);}mesh.morphTargetDictionary['_CJ Tongue Clearance']=r.clearance;mesh.morphTargetInfluences[r.clearance]=0;}
   const target=g.morphAttributes.position[r.index];for(let i=0;i<p.array.length;i+=3){const x=p.array[i]+source.array[i],z=p.array[i+2]+source.array[i+2],front=clamp((z-.035)/.035);target.array[i]=x*config.width-p.array[i];target.array[i+1]=source.array[i+1]-config.drop*front+(config.tipLift||0)*front+(config.exitLift??0)*Math.exp(-(((z-.047)/.016)**2));target.array[i+2]=source.array[i+2]*config.forward+(config.clearance??.003)*front;}
   r.floorOutOnly=Boolean(config.floorOnlyWhenOut);if(config.floorDrop&&r.floor==null){r.floor=g.morphAttributes.position.length;const floor=p.clone();floor.array.fill(0);g.morphAttributes.position.push(floor);if(g.morphAttributes.normal?.length){const n=g.attributes.normal.clone();n.array.fill(0);g.morphAttributes.normal.push(n);}mesh.morphTargetDictionary['_CJ Tongue Floor']=r.floor;mesh.morphTargetInfluences[r.floor]=0;}
   if(r.floor!=null){const floor=g.morphAttributes.position[r.floor];floor.array.fill(0);for(let i=1;i<floor.array.length;i+=3)floor.array[i]=-(config.floorDrop||0);floor.needsUpdate=true;}
   target.needsUpdate=true;r.version=p.version;r.sourceVersion=source.version;r.key=JSON.stringify(config);g.dispose();this.model=null;
  }
 }
 resolve(){this.ensureGasp();this.ensureRelaxedEyes();this.ensureTongue();this.ensureIris();const mapping={...this.profile.mapping,...this.profile.characters?.[this.character]?.mapping},bindingKey=JSON.stringify(mapping);if(this.model===this.head.vrm&&this.bindingKey===bindingKey){this.ensureAsymmetry();return;}this.clear();this.model=this.head.vrm;this.bindingKey=bindingKey;this.sideVersions=new WeakMap();this.bindings.clear();this.owned=[];this.regions=new Map();this.missing=[];
  for(const mesh of this.head.meshes||[]){
   const dictionary=new Map(Object.entries(mesh.morphTargetDictionary||{}).map(([name,index])=>[normal(name),index]));
   for(const [name,index] of Object.entries(mesh.morphTargetDictionary||{}))if(/^(Eye |Eyebrow |Mouth |Tears )/.test(name))this.owned.push([mesh,index]);
   for(const [channel,name] of Object.entries(mapping)){
    const index=dictionary.get(normal(name));if(index==null)continue;
    const native=this.head.faceEditor?.cache?.get(mesh)?.morphs;
    const source=index=>native?.[index]||mesh.geometry?.morphAttributes?.position?.[index]?.array;
    const hasMotion=index=>source(index)?.some(v=>Math.abs(v)>1e-7);
    const target=source(index);
    let open=name.endsWith(', Closed')?dictionary.get(normal(name.slice(0,-8))):null;if(channel==='mouth.gasp'&&this.gaspRecords.has(mesh))open=this.gaspRecords.get(mesh).index;if(channel==='mouth.tongueOut'&&this.tongueRecords.has(mesh))open=this.tongueRecords.get(mesh).index;
    // A neutral closed endpoint can legitimately be all zero. Its animated
    // open partner still carries the expression; do not drop the whole pair.
    const identity=normal(name).endsWith(' Default');
    if(target&&!hasMotion(index)&&!(open!=null&&hasMotion(open))&&!identity)continue;
    const rows=this.bindings.get(channel)||[];rows.push({mesh,index,open,neutralClosed:!hasMotion(index)});this.bindings.set(channel,rows);
    for(const i of [index,open])if(i!=null&&!this.owned.some(([m,j])=>m===mesh&&j===i))this.owned.push([mesh,i]);
    const group=channel==='lid.close'?'eye':channel.split('.')[0],regions=this.regions.get(mesh)||new Map(),indices=regions.get(group)||new Set();indices.add(index);if(open!=null)indices.add(open);regions.set(group,indices);this.regions.set(mesh,regions);
   }
  }
  this.ensureAsymmetry();
  this.missing=channels.filter(c=>c!=='gaze.x'&&c!=='gaze.y'&&!c.endsWith('.balance')&&!this.bindings.has(c));
 }
 // Split existing deltas once, with a soft seam. Original positions and morphs stay intact.
 ensureAsymmetry(){
  const config=this.profile.procedural?.asymmetry;if(!config?.enabled)return;
  if(this.sideModel!==this.head.vrm){this.sideRecords.clear();this.sideVersions=new WeakMap();this.sideModel=this.head.vrm;}
  for(const [mesh,regions]of this.regions){
   const g=mesh.geometry,p=g?.attributes?.position;if(!p?.clone)continue;
   const cached=this.sideVersions.get(mesh);if(cached?.version===p.version&&cached.width===config.blendWidth)continue;
   let records=this.sideRecords.get(mesh);if(!records){records=new Map();this.sideRecords.set(mesh,records);}
   let changed=false;
   for(const [region,indices]of regions){if(!['eye','brow','mouth'].includes(region))continue;
    for(const index of indices){
     const source=g.morphAttributes.position[index]?.array;
     if(!source?.some(v=>Math.abs(v)>1e-7))continue;
     let r=records.get(index);if(r?.version===p.version&&r.width===config.blendWidth&&r.source===source)continue;
     if(!r){
      const name=Object.keys(mesh.morphTargetDictionary).find(n=>mesh.morphTargetDictionary[n]===index);
      const halves=[];
      for(const side of ['L','R']){const key='_CJ Side '+side+' '+name;let i=mesh.morphTargetDictionary[key];if(!Number.isInteger(i)||!g.morphAttributes.position[i]){i=g.morphAttributes.position.length;const target=p.clone();target.array.fill(0);g.morphAttributes.position.push(target);if(g.morphAttributes.normal?.length){const n=g.attributes.normal.clone();n.array.fill(0);g.morphAttributes.normal.push(n);}}mesh.morphTargetDictionary[key]=i;mesh.morphTargetInfluences[i]=0;halves.push(i);}
      r={halves,region};records.set(index,r);
     }
     const normals=g.morphAttributes.normal?.[index]?.array;
     for(let i=0;i<source.length;i+=3){const t=clamp(.5+p.array[i]/(2*config.blendWidth)),left=t*t*(3-2*t);
      for(let side=0;side<2;side++){const weight=side===0?left:1-left,target=g.morphAttributes.position[r.halves[side]].array,n=g.morphAttributes.normal?.[r.halves[side]]?.array;for(let axis=0;axis<3;axis++){target[i+axis]=source[i+axis]*weight;if(n)n[i+axis]=(normals?.[i+axis]||0)*weight;}}
     }
     for(const i of r.halves){g.morphAttributes.position[i].needsUpdate=true;if(g.morphAttributes.normal?.[i])g.morphAttributes.normal[i].needsUpdate=true;}
     r.source=source;r.version=p.version;r.width=config.blendWidth;changed=true;
    }
   }
   this.sideVersions.set(mesh,{version:p.version,width:config.blendWidth});if(changed)g.dispose();
  }
 }
 applyAsymmetry(frame){
  if(!this.profile.procedural?.asymmetry?.enabled)return;
  for(const [mesh,records]of this.sideRecords){if(!(this.head.meshes||[]).includes(mesh))continue;
   for(const [index,r]of records){const a=clamp(frame[r.region+'.balance']||0,-.35,.35)*(r.region==='eye'?1-clamp(frame['lid.close']||0):1),w=mesh.morphTargetInfluences[index]||0;if(!a||!w)continue;
    mesh.morphTargetInfluences[index]=w*(1-Math.abs(a));mesh.morphTargetInfluences[r.halves[a>0?0:1]]=w*2*Math.abs(a);
   }
  }
 }
 clear(){for(const [mesh,r]of this.tongueRecords)if(r.clearance!=null&&mesh.morphTargetInfluences)mesh.morphTargetInfluences[r.clearance]=0;for(const [mesh,r]of this.tongueRecords)if(r.floor!=null&&mesh.morphTargetInfluences)mesh.morphTargetInfluences[r.floor]=0;for(const [mesh,records]of this.sideRecords)for(const r of records.values())for(const i of r.halves)if(mesh.morphTargetInfluences)mesh.morphTargetInfluences[i]=0;for(const [mesh,index] of this.owned)if(mesh.morphTargetInfluences)mesh.morphTargetInfluences[index]=0;}
 restoreLook(){for(const [range,inputMaxValue,outputScale]of this.lookDefaults){range.inputMaxValue=inputMaxValue;range.outputScale=outputScale;}this.lookDefaults=[];this.lookModel=null;}
 prepare(frame){
  if(!frame)this.effects?.apply(null,0);this.resolve();this.clear();const look=this.head.vrm?.lookAt;if(!look){this.restoreLook();return;}
  const config=this.profile.gazeCalibration,applier=look.applier;
  if(frame&&config&&applier){
   if(this.lookModel!==look){this.restoreLook();this.lookModel=look;}
   for(const [key,value]of [['rangeMapHorizontalInner',config.horizontalDegrees],['rangeMapHorizontalOuter',config.horizontalDegrees],['rangeMapVerticalUp',config.verticalSign===-1?config.downDegrees:config.upDegrees],['rangeMapVerticalDown',config.verticalSign===-1?config.upDegrees:config.downDegrees]]){const range=applier[key];if(!range)continue;if(!this.lookDefaults.some(([r])=>r===range))this.lookDefaults.push([range,range.inputMaxValue,range.outputScale]);range.inputMaxValue=90;range.outputScale=value;}
   look.yaw=clamp(frame['gaze.x']||0,-1,1)*90;look.pitch=clamp(frame['gaze.y']||0,-1,1)*90*(config.verticalSign??1);
  }else{this.restoreLook();look.yaw=clamp(frame?(frame['gaze.x']||0):this.head.settings.lookX,-1,1)*25;look.pitch=clamp(frame?(frame['gaze.y']||0):this.head.settings.lookY,-1,1)*20;}
 }

 apply(frame,speech=0){if(!frame)return;this.resolve();this.clear();const gains={...this.profile.gains,...this.profile.characters?.[this.character]?.gains,...this.profile.characters?.[this.character]?.clips?.[this.clipId]?.gains};
  const character=this.profile.characters?.[this.character]||{},strength={eye:1,brow:1,mouth:1,effect:1,...this.profile.regionStrength,...character.regionStrength};
  const floor=character.clips?.[this.clipId]?.mouthShapeFloor??character.mouthShapeFloor??this.profile.mouthShapeFloor??0;
  // Native rest contour fades out as another eye pose takes over, and follows
  // the existing blink attenuation. Eyeballs and the profile stay unscaled.
  const activity=region=>Math.max(0,...Object.entries(frame).filter(([k])=>k.startsWith(region+'.')&&!k.endsWith('.balance')).map(([,v])=>v));
  const value=k=>{const region=k.split('.')[0],active=region==='lid'?Math.max(frame['lid.close']||0,activity('eye')):activity(region);return clamp(((frame[k]||0)+(character.restingPose?.[k]||0)*(1-clamp(active)))*(gains[k]??1));};const closed=value('lid.close'),opening=Math.max(value('mouth.open'),clamp(Number.isFinite(speech)?speech:0));
  for(const [channel,binds] of this.bindings){if(channel==='mouth.open')continue;let w=value(channel);if(channel.startsWith('eye.'))w*=(1-closed)*strength.eye;else if(channel!=='lid.close')w*=strength[channel.split('.')[0]]??1;
   for(const b of binds){if(channel.startsWith('mouth.')&&b.open!=null){const amount=b.neutralClosed&&channel!=='mouth.smallOpen'?floor+(1-floor)*opening:opening;b.mesh.morphTargetInfluences[b.index]+=w*(1-amount);b.mesh.morphTargetInfluences[b.open]+=w*amount;}else b.mesh.morphTargetInfluences[b.index]+=w;}
  }
  const mouthKeys=[...this.bindings.keys()].filter(k=>k.startsWith('mouth.')&&k!=='mouth.open');
  if(!mouthKeys.some(k=>value(k)>0))for(const b of this.bindings.get('mouth.open')||[])b.mesh.morphTargetInfluences[b.index]+=opening;
  // Normalize competing shapes in each region, independently of the other regions.
  for(const [mesh,regions] of this.regions)for(const [group,ids] of regions){let sum=0;for(const i of ids)sum+=mesh.morphTargetInfluences[i];const limit=group==='eye'?closed+(1-closed)*strength.eye:(strength[group]??1);if(sum>limit)for(const i of ids)mesh.morphTargetInfluences[i]*=limit/sum;}
  this.applyAsymmetry(frame);for(const [mesh,r]of this.tongueRecords)if(r.floor!=null)mesh.morphTargetInfluences[r.floor]=opening*(r.floorOutOnly?value('mouth.tongueOut'):1);applyTongueClearance(this,value('mouth.tongueOut'));this.effects?.apply(frame,value('effect.blush'));
 }
 report(){this.resolve();const pigment=this.effects?.supported,effects=this.effects?.channels||(pigment?['effect.blush']:[]);return {profile:this.profile.id||'custom',bound:[...this.bindings.keys(),...(this.sideRecords.size?['eye.balance','brow.balance','mouth.balance']:[]),...effects],missing:this.missing.filter(c=>!effects.includes(c)),character:this.character};}
}
