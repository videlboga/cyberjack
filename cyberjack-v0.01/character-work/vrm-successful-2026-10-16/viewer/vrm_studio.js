import {createClipThumbnails} from './clip-thumbnails.js?v=2';
import {inspectBodyClip} from './clip-compatibility.js?v=partial-2';
import {installWorkspace} from './studio-workspace.js?v=editor-tools-7';
import {createPoseEditor} from './pose-editor.js?v=editor-tools-7';
import {registerPoseAvatar} from './pose-editor-core.js';
import {applySourceAnchor} from './source-anchors.js';
import {installSidebarModes} from './sidebar-modes.js';
import {createSceneActor} from './scene-actor.js';
import {createAnimationLinks} from './animation-links.js';
import {createPerformance} from './speech-tongue.js';
import {createFacialControl} from './facial-control.js';
import {installLibrary} from './animation-library.js?v=thumbnails-2';
import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils,VRMSpringBoneColliderHelper} from './node_modules/@pixiv/three-vrm/lib/three-vrm.module.js';
const $=s=>document.querySelector(s),stage=$('#stage');
const scene=new THREE.Scene();scene.background=new THREE.Color(0xced3da);
const camera=new THREE.PerspectiveCamera(30,1,.01,100);camera.position.set(0,.83,3.6);
const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;stage.prepend(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.09;controls.target.set(0,.82,0);controls.minDistance=.25;controls.maxDistance=9;controls.maxPolarAngle=Math.PI*.95;
scene.add(new THREE.HemisphereLight(0xffffff,0xb5bbc4,1.35));const key=new THREE.DirectionalLight(0xffffff,2.15);key.position.set(-1.8,3,3);scene.add(key);const fill=new THREE.DirectionalLight(0xe7f1ff,.6);fill.position.set(2,1,-2);scene.add(fill);
const grid=new THREE.GridHelper(5,50,0xa8b4bc,0xbdc7ce);grid.position.y=-.008;grid.material.transparent=true;grid.material.opacity=.22;scene.add(grid);
let faceController=null,performanceController=null,linkedController=null,poseEditor=null;
let sceneActors=[];let actorRequest=0;
let vrm=null,bank=null,boneMap={},bindings=[],rawRest=[],sourceNodes=[],sourceMap=new Map(),clip=null,clipTime=0,playing=true,physicsEnabled=true,collisionsEnabled=true,transition=null,loadingToken=0,boneHelper=null,colliderHelpers=[],allJoints=[],collisionGroups=new Map(),ready=false,frameCount=0,fpsStart=performance.now(),last=performance.now(),accumulator=0,view='front';
const Q=new THREE.Quaternion(),Q2=new THREE.Quaternion(),Q3=new THREE.Quaternion();
const thumbnails=createClipThumbnails({getTemplate:()=>ready&&vrm&&bank?{key:window.__studio.model,vrm,sourceRig:bank.sourceRig,boneMap,rest:rawRest,postureNames:bindings.map(b=>b.source.name)}:null});
const titles={Idle_00_00:'Спокойный idle',Stand_00_00:'Базовая стойка',Stand_01_00:'Стойка 01',Stand_03_00:'Стойка 03',Stand_07_00:'Стойка 07',Stand_17_00:'Стойка 17',Stand_Joy_01:'Радостная стойка'};
function toast(text){$('#toast').textContent=text;$('#toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').classList.remove('visible'),2600)}
function fail(message){$('#error').hidden=false;$('#error').textContent=message;console.error(message)}
function clearError(){$('#error').hidden=true}
// KKBP/PMX faces the opposite X direction to the Unity prefab. Mirror X, not the generic glTF Z mapping.
function mirrored(q,out){return out.set(q.x,-q.y,-q.z,q.w)}
function depth(o){let n=0;while(o.parent){n++;o=o.parent}return n}
function prepareRig(){
 if(!bank||!vrm)return;
 sourceMap=new Map(bank.sourceRig.map(n=>[n.name,{...n,local:new THREE.Quaternion().fromArray(n.rotation),restWorld:new THREE.Quaternion(),world:new THREE.Quaternion(),order:0}]));
 const visiting=new Set();const sorted=[];
 function add(n){if(n.done)return;if(visiting.has(n.name))throw Error('Цикл в исходном скелете');visiting.add(n.name);const parent=sourceMap.get(n.parent);if(parent)add(parent);n.restWorld.copy(parent?parent.restWorld:new THREE.Quaternion()).multiply(n.local);n.world.copy(n.restWorld);n.done=true;visiting.delete(n.name);sorted.push(n)}
 for(const n of sourceMap.values())add(n);sourceNodes=sorted;
 vrm.scene.updateMatrixWorld(true);const boneNodes=new Map();vrm.scene.traverse(n=>{if(n.name)boneNodes.set(n.name,n)});
 const simulated=new Set(allJoints.map(j=>j.bone));
 // Retarget posture joints, not the game's deformation, collision, hair or cloth helpers.
 // Those helpers must retain the avatar's own rest offsets and follow their parents.
 const postureBones=new Set([...Object.keys(boneMap),'cf_j_waist02','cf_j_leg03_L','cf_j_leg03_R',...bank.clips.flatMap(c=>c.tracks.map(t=>t.bone)).filter(n=>n.startsWith('cf_')&&!/sk_|hair/.test(n))]);
 bindings=[];
 for(const s of sourceNodes){if(s.name==='cf_j_root'||!postureBones.has(s.name))continue;const targetName=boneMap[s.name]||s.name;const node=boneNodes.get(targetName)||boneNodes.get(THREE.PropertyBinding.sanitizeNodeName(targetName));if(!node||simulated.has(node))continue;const sw=mirrored(s.restWorld,new THREE.Quaternion());bindings.push({source:s,node,sourceRestInverse:sw.invert(),targetRestWorld:node.getWorldQuaternion(new THREE.Quaternion()),depth:depth(node),restLocal:node.quaternion.clone()})}
 bindings.sort((a,b)=>a.depth-b.depth);
 const boundSet=new Set(bindings.map(b=>b.node));rawRest=[];vrm.scene.traverse(n=>{if(n.isBone||boundSet.has(n))rawRest.push({node:n,q:n.quaternion.clone(),position:n.position.clone(),scale:n.scale.clone(),simulated:simulated.has(n)})});
 const core=['Left arm','Right arm','Left leg','Right leg','Head'];
 window.__studio.retarget={boundBones:bindings.length,sourceBones:sourceNodes.length,coreBound:core.every(name=>bindings.some(b=>b.node.name===THREE.PropertyBinding.sanitizeNodeName(name)))};
 $('#source-info').textContent=`Исходные кривые Koikatsu Sunshine\n${bindings.length} костей перенесено на VRM`;
}
function sampleTrack(track,t,out){
 const times=track.times,values=track.rotations;if(!times.length)return out.identity();let i=Math.min(times.length-2,Math.max(0,Math.floor(t*clip.fps)));while(i>0&&times[i]>t)i--;while(i<times.length-2&&times[i+1]<t)i++;const span=times[i+1]-times[i],a=span>0?THREE.MathUtils.clamp((t-times[i])/span,0,1):0;out.fromArray(values,i*4);Q2.fromArray(values,(i+1)*4);return out.slerp(Q2,a).normalize()
}
function applyPose(t){
 if(!vrm||!rawRest.length||poseEditor?.active)return;
 for(const r of rawRest){if(!r.simulated||!physicsEnabled)r.node.quaternion.copy(r.q);r.node.position.copy(r.position);r.node.scale.copy(r.scale)}
 if(!clip){vrm.scene.updateMatrixWorld(true);return}
 for(const s of sourceNodes){s.local.fromArray(s.rotation);s.animatedPosition=null;s.animatedScale=null}
 for(const tr of clip.tracks){const s=sourceMap.get(tr.bone.replace(/^cm_/, 'cf_'));if(!s)continue;if(!clip.native){sampleTrack(tr,t,s.local);continue}const a=tr.sample(t);if(!a.every(Number.isFinite))continue;if(tr.attribute===2)s.local.fromArray(a).normalize();else if(tr.attribute===4)s.local.setFromEuler(new THREE.Euler(...a.map(v=>v*Math.PI/180),'ZXY'));else if(tr.attribute===1)s.animatedPosition=a;else if(tr.attribute===3)s.animatedScale=a}
 for(const s of sourceNodes){const parent=sourceMap.get(s.parent);s.world.copy(parent?parent.world:new THREE.Quaternion()).multiply(s.local)}
 // Cache world orientations once per node; traversing every ancestor for every bone is needlessly expensive.
 const worldCache=new Map();
 const targetWorld=node=>{if(!node)return new THREE.Quaternion();if(worldCache.has(node))return worldCache.get(node);const q=targetWorld(node.parent).clone().multiply(node.quaternion);worldCache.set(node,q);return q};
 const alpha=transition?THREE.MathUtils.smoothstep(performance.now(),transition.start,transition.start+420):1;
 for(const b of bindings){
  mirrored(b.source.world,Q).multiply(b.sourceRestInverse).multiply(b.targetRestWorld);
  const parentWorld=targetWorld(b.node.parent);Q3.copy(parentWorld).invert();Q.premultiply(Q3);
  if(clip.native){const rest=rawRest.find(r=>r.node===b.node),s=b.source;
   if(s.name==='cf_n_height'||(s.name==='cf_j_hips'&&clip.linked)){applySourceAnchor(b.node,s,sourceMap,vrm.scene)}else if(s.animatedPosition&&s.position){const delta=new THREE.Vector3().fromArray(s.animatedPosition).sub(new THREE.Vector3().fromArray(s.position));delta.x=-delta.x;const sp=sourceMap.get(s.parent);if(sp)delta.applyQuaternion(mirrored(sp.world,new THREE.Quaternion()));delta.applyQuaternion(parentWorld.clone().invert());b.node.position.copy(rest.position).add(delta)}
   if(s.animatedScale&&s.scale)b.node.scale.set(...s.animatedScale.map((v,i)=>Math.abs(s.scale[i])>1e-6?(Math.abs(v/s.scale[i])<.001?.001:v/s.scale[i])*rest.scale.getComponent(i):rest.scale.getComponent(i)));
  }
  const from=transition?.from.get(b.node);if(from&&alpha<1)b.node.quaternion.copy(from).slerp(Q,alpha);else b.node.quaternion.copy(Q);
  worldCache.set(b.node,parentWorld.clone().multiply(b.node.quaternion));
 }
 vrm.scene.updateMatrixWorld(true);
 if(transition&&alpha>=1)transition=null;
}
function updatePoseUi(){
 document.querySelectorAll('.pose-card').forEach(b=>{const active=b.dataset.pose===clip?.id;b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active))});$('#tpose').classList.toggle('active',!clip);const name=clip?titles[clip.id]||bank.ruTitles?.[clip.id]||clip.name:'T-поза';$('#pose-title').textContent=name;$('#transport-name').textContent=name;$('#clip-id').textContent=clip?.linked?'Сцена':clip?.id||'REST POSE';$('#timeline').max=String(clip?.duration||1);$('#timeline').disabled=!clip||Boolean(clip.linked);$('#play').disabled=!clip;$('#timecode').textContent=`${clipTime.toFixed(2)} / ${(clip?.duration||0).toFixed(2)}`;
}
function setPose(id,animate=true){
 if(!vrm||!bank)return;if(poseEditor?.active)poseEditor.enable(false);const from=new Map(rawRest.map(r=>[r.node,r.node.quaternion.clone()]));clip=bank.clips.find(c=>c.id===id)||null;clipTime=0;transition=animate?{from,start:performance.now()}:null;if(!animate)vrm.springBoneManager?.reset();applyPose(0);updatePoseUi();if(!animate){for(let i=0;i<45;i++){applyPose(0);vrm.update(1/60)}}
 window.__studio.pose=clip?.id||'tpose';
}
function makePoseList(){
 const order=['Idle_00_00','Stand_00_00','Stand_01_00','Stand_03_00','Stand_07_00','Stand_17_00','Stand_Joy_01','L_WLoop1','M_WLoop2','S_OLoop','L_SLoop1','L_IN_Loop'];bank.clips.sort((a,b)=>order.indexOf(a.id)-order.indexOf(b.id));$('#pose-list').replaceChildren();
 bank.clips.forEach((c,i)=>{const button=document.createElement('button');button.className='pose-card';button.dataset.pose=c.id;button.setAttribute('aria-pressed','false');const no=document.createElement('span');no.className='pose-number';no.textContent=String(i+1).padStart(2,'0');const text=document.createElement('span'),title=document.createElement('strong'),small=document.createElement('small'),loop=document.createElement('span');title.textContent=titles[c.id]||c.label;small.textContent=c.id;loop.className='pose-loop';loop.textContent='↻';text.append(title,small);button.append(no,text,loop);button.onclick=()=>setPose(c.id);$('#pose-list').append(button);thumbnails.attach(button,c,async()=>c)});$('#pose-count').textContent=String(bank.clips.length)
}
const assetsPromise=Promise.all([fetch('./vrm_studio_assets/koikatsu-idles.json').then(r=>{if(!r.ok)throw Error('Библиотека поз недоступна');return r.json()}),fetch('./vrm_studio_assets/koikatsu-h.json').then(r=>{if(!r.ok)throw Error('H-библиотека недоступна');return r.json()}),fetch('./vrm_studio_assets/bone-map.json').then(r=>r.json())]).then(([data,hdata,map])=>{Object.assign(titles,{L_WLoop1:'Стоя · основной луп',M_WLoop2:'Стоя · луп 2 (M)',S_OLoop:'Лёжа · луп',L_SLoop1:'Сидя · луп',L_IN_Loop:'Стоя · вход-цикл'});bank={...data,clips:[...data.clips,...(hdata?.clips||[])]};boneMap=map;makePoseList();installLibrary({thumbnails,select:async c=>{const browsingEditor=window.__studio.workspace?.tab==='edit',listScroll=document.querySelector('.sidebar').scrollTop;const check=inspectBodyClip(c,bank.sourceRig,boneMap);c.bodyCompatibility=check;if(!check.ok){const error=new Error(check.reason+'. Текущее движение сохранено.');error.code=check.code;throw error;}bank.clips=bank.clips.filter(x=>!x.native);bank.clips.push(c);linkedController?.stop();window.__studio.clearSceneActors?.();setPose(c.id);window.__studio.setPlaying(true);if(browsingEditor){window.__studio.workspace.editCurrentClip();document.querySelector('.sidebar').scrollTop=listScroll;}},getCurrent:()=>clip}).then(c=>{window.__studio.library=c;bank.ruTitles=c.ruTitles||null;}).catch(e=>toast('Библиотека: '+e.message));return data}).catch(e=>{fail(`Не удалось прочитать позы: ${e.message}`);throw e});
function fitPosedCamera(which){
 if(!vrm)return;applyPose(clipTime);vrm.scene.updateMatrixWorld(true);const names=['hips','spine','chest','head','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot','leftToes','rightToes'];const bounds=new THREE.Box3();for(const name of names){const bone=vrm.humanoid.getRawBoneNode(name);if(bone)bounds.expandByPoint(bone.getWorldPosition(new THREE.Vector3()))}for(const actor of sceneActors)for(const name of names){const bone=actor.vrm.humanoid.getRawBoneNode(name);if(bone)bounds.expandByPoint(bone.getWorldPosition(new THREE.Vector3()))}if(bounds.isEmpty())return;bounds.expandByScalar(.17);const size=bounds.getSize(new THREE.Vector3()),target=bounds.getCenter(new THREE.Vector3()),angle={front:0,threequarter:.55,side:Math.PI/2,back:Math.PI,face:0}[which]||0,tan=Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),aspect=stage.clientWidth/Math.max(1,stage.clientHeight);let distance=Math.max(size.y/(2*tan),(Math.abs(Math.cos(angle))*size.x+Math.abs(Math.sin(angle))*size.z)/(2*tan*aspect))*1.15+(Math.abs(Math.sin(angle))*size.x+Math.abs(Math.cos(angle))*size.z)/2;
 if(which==='face'){const head=vrm.humanoid.getRawBoneNode('head');if(head)target.copy(head.getWorldPosition(new THREE.Vector3()));distance=.86}camera.position.set(target.x+Math.sin(angle)*distance,target.y+.015,target.z+Math.cos(angle)*distance);controls.target.copy(target);controls.update()
}
function fitCamera(which='front'){
 view=which;document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===which));if(clip?.linked){fitPosedCamera(which);return}
 const target=which==='face'?new THREE.Vector3(0,1.41,0):new THREE.Vector3(0,.8,0);let dist=which==='face'?.86:3.3;
 const aspect=stage.clientWidth/Math.max(1,stage.clientHeight);if(which!=='face')dist=Math.max(dist,1.45/(2*Math.tan(THREE.MathUtils.degToRad(15))*aspect));
 const angle={front:0,threequarter:.55,side:Math.PI/2,back:Math.PI,face:0}[which]||0;camera.position.set(target.x+Math.sin(angle)*dist,target.y+.015,target.z+Math.cos(angle)*dist);controls.target.copy(target);controls.update()
}
function removeHelpers(){for(const h of colliderHelpers){scene.remove(h);h.dispose()}colliderHelpers=[];if(boneHelper){scene.remove(boneHelper);boneHelper.geometry.dispose();boneHelper.material.dispose();boneHelper=null}}
function preparePhysics(){
 allJoints=[...(vrm.springBoneManager?.joints||[])];collisionGroups=new Map(allJoints.map(j=>[j,j.colliderGroups]));const manager=vrm.springBoneManager;
 if(manager){const originalUpdate=manager.update.bind(manager);manager.update=dt=>{if(physicsEnabled&&dt>0)originalUpdate(dt)}}
 const skirtColliders=new Set(allJoints.filter(j=>j.bone.name.includes('sk_')).flatMap(j=>j.colliderGroups.flatMap(g=>g.colliders)));const colliders=[...skirtColliders];for(const c of colliders){if(c.shape.radius>2)continue;const h=new VRMSpringBoneColliderHelper(c);h.visible=$('#collider-view').checked;scene.add(h);colliderHelpers.push(h)}
 boneHelper=new THREE.SkeletonHelper(vrm.scene);boneHelper.visible=$('#skeleton-view').checked;boneHelper.material.transparent=true;boneHelper.material.opacity=.65;scene.add(boneHelper);
 $('#physics-info').textContent=`${allJoints.length} подвижных сегментов · ${colliders.length} коллайдера юбки`;
 for(const j of allJoints)if(!collisionsEnabled)j.colliderGroups=[];
}
const characters=[
 {id:'kai',name:'Kai',paths:Array.from({length:4},(_,i)=>`models/x20/kai/Kai_outfit_${String(i).padStart(2,'0')}.vrm`),outfits:['00 · комплект 00','01 · комплект 01','02 · комплект 02','03 · комплект 03']},
 {id:'rin',name:'Рин',paths:Array.from({length:4},(_,i)=>`models/x20/outfits/Rin_outfit_${String(i).padStart(2,'0')}.vrm`),outfits:['00 · топ и длинная юбка','01 · платье','02 · розовый комплект','03 · без одежды']},
 {id:'mira',name:'Mira',paths:Array.from({length:4},(_,i)=>`models/x20/mira/Mira_outfit_${String(i).padStart(2,'0')}.vrm`),outfits:['00 · куртка и шорты','01 · бельё','02 · платье','03 · без одежды']}
];
let currentCharacter=null;
const outfitPaths=characters.find(c=>c.id==='rin').paths;
function characterFor(src){if(typeof src!=='string')return null;const pathname=new URL(src,location.href).pathname;return characters.find(c=>c.paths.some(path=>new URL(path,location.href).pathname===pathname))||null}
function outfitIndex(src){const c=characterFor(src);return c?c.paths.findIndex(path=>new URL(path,location.href).pathname===new URL(src,location.href).pathname):-1}
function syncOutfitUi(src){const c=characterFor(src),i=outfitIndex(src);currentCharacter=c;const select=$('#outfit-select');select.replaceChildren();for(const [i,label] of (c?.outfits||['Костюмы недоступны']).entries())select.add(new Option(label,String(i)));select.disabled=!c;select.value=String(Math.max(0,i));$('#outfit-info').textContent=c?`${c.name} · четыре комплекта`:'Выберите модель с комплектами одежды';window.__studio.character=c?.id||null;}
async function loadModel(src,name,preservePose=false){
 if(!preservePose){linkedController?.stop();window.__studio.clearSceneActors?.()}
 const previous=preservePose?{id:clip?.id,time:clipTime,playing}:null;
 $('#outfit-select').disabled=true;
 const token=++loadingToken;ready=false;window.__studio.ready=false;clearError();$('#loading').hidden=false;$('#loading-title').textContent='Открываю модель';$('#model-status').textContent='Загрузка модели';
 try{
  const requestedUrl=src instanceof File?URL.createObjectURL(src):new URL(src,location.href).href;const parsedUrl=new URL(requestedUrl);if(parsedUrl.pathname.includes('/mira/Mira_outfit_'))parsedUrl.searchParams.set('revision','neutral-3');if(parsedUrl.pathname.includes('/outfits/Rin_outfit_'))parsedUrl.searchParams.set('revision','game-visibility-1');if(parsedUrl.pathname.endsWith('/Rin_restored_v2.vrm'))parsedUrl.searchParams.set('revision','full-chains-12');const url=parsedUrl.href;const label=name||(src instanceof File?src.name:decodeURIComponent(parsedUrl.pathname.split('/').pop()));
  const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser));const gltf=await loader.loadAsync(url,e=>{if(token===loadingToken&&e.total)$('#loading-detail').textContent=`Текстуры и скелет · ${Math.round(e.loaded/e.total*100)}%`});if(src instanceof File)URL.revokeObjectURL(url);
  if(token!==loadingToken){VRMUtils.deepDispose(gltf.scene);return}
  if(previous?.id==='__linked_body'){previous.id=clip?.id;previous.time=clipTime;previous.playing=playing}
  removeHelpers();if(vrm){scene.remove(vrm.scene);VRMUtils.deepDispose(vrm.scene)}vrm=gltf.userData.vrm;if(!vrm)throw Error('Файл не содержит VRM-аватара');VRMUtils.combineSkeletons(vrm.scene);vrm.scene.traverse(o=>{if(o.isMesh)o.frustumCulled=false});scene.add(vrm.scene);vrm.humanoid.autoUpdateHumanBones=false;if(vrm.lookAt)vrm.lookAt.autoUpdate=false;vrm.scene.rotation.set(0,0,0);registerPoseAvatar(vrm);
  // Material uniforms must be initialized even while animation or physics is paused.
  vrm.update(0);preparePhysics();await assetsPromise;if(token!==loadingToken)return;prepareRig();setPose(previous?.id??'Idle_00_00',false);if(previous){if(!previous.id)setPose(null,false);clipTime=Math.min(previous.time,clip?.duration||0);playing=previous.playing;applyPose(clipTime);vrm.springBoneManager?.reset();for(let i=0;i<45;i++){applyPose(clipTime);vrm.update(1/60)}updatePoseUi()}accumulator=0;fitCamera(view);
  $('#model-status').textContent=label;$('#model-format').textContent=`VRM ${vrm.meta?.metaVersion||'1.0'}`;$('#model-size').textContent=`${allJoints.length} сегмента физики`;
  const select=$('#model-select');if(outfitIndex(src)>=0)select.value=characterFor(src).paths[0];else if([...select.options].some(o=>o.value===src))select.value=src;syncOutfitUi(src);
  $('#loading').hidden=true;ready=true;fpsStart=performance.now();frameCount=0;document.title=`Avatar Studio — ${label}`;window.__loaded=vrm;window.__studio.vrm=vrm;window.__studio.ready=true;window.__studio.model=label;thumbnails.refresh();

 }catch(e){if(token===loadingToken){$('#loading').hidden=true;$('#model-status').textContent='Ошибка загрузки';fail(`Не удалось открыть модель: ${e.message}`);window.__studio.error=e.message}}
}
window.__studio={ready:false,vrm:null,scene,camera,controls,renderer,setPose,loadModel,renderNow:()=>{if(!poseEditor?.active)linkedController?.update(0);applyPose(clipTime);poseEditor?.update(0);performanceController?.update(0);faceController?.apply(0);renderer.render(scene,camera)},step:(seconds=1)=>{for(let i=0;i<Math.round(seconds*60);i++){if(!poseEditor?.active)linkedController?.update(1/60);applyPose(clipTime);poseEditor?.update(1/60);vrm?.update(1/60);performanceController?.update(1/60);faceController?.apply(1/60);for(const a of sceneActors)a.update(1/60)}renderer.render(scene,camera)},get state(){return {pose:clip?.id,clipTime,playing,physicsEnabled,collisionsEnabled,bindings:bindings.length}}};
window.__studio.thumbnails=thumbnails;
window.__studio.refreshClipUi=updatePoseUi;
window.__studio.currentClip=()=>clip;
window.__studio.sampleBody=t=>{if(!clip||clip.linked)throw Error('Для переноса выберите отдельный клип тела');transition=null;applyPose(t);vrm.scene.updateMatrixWorld(true)};
window.__studio.diagnostics=()=>({skirtColliders:colliderHelpers.length});
window.__studio.sidebar=installSidebarModes(window.__studio);
poseEditor=createPoseEditor({scene,camera,renderer,controls,host:document.querySelector('.sidebar'),getAvatars:()=>ready&&vrm?[{id:'main',label:'Главный · '+(currentCharacter?.name||'VRM'),vrm},...sceneActors.map(a=>({id:a.role,label:a.character+' · '+a.role,vrm:a.vrm}))]:[],pauseSource:()=>{playing=false;transition=null;$('#play').textContent='▶';$('#play').setAttribute('aria-label','Продолжить анимацию');}});
window.__studio.workspace=installWorkspace(window.__studio);window.__studio.poseEditor=poseEditor;window.__studio.sidebar.panel.after(poseEditor.section);
createFacialControl({getVrm:()=>vrm,getCharacter:()=>currentCharacter?.id,host:$('#model-select').closest('.model-section')}).then(c=>{faceController=c;window.__studio.face=c;createPerformance({getVrm:()=>vrm,getCharacter:()=>currentCharacter?.id,face:c}).then(p=>{performanceController=p;window.__studio.performance=p;createAnimationLinks({studio:window.__studio,performance:p,face:c,getCharacter:()=>currentCharacter?.id}).then(l=>{linkedController=l;window.__studio.links=l}).catch(e=>fail('Связи анимаций: '+e.message))}).catch(e=>fail('Речь и язык: '+e.message))}).catch(e=>fail('Лицевое управление: '+e.message));
window.__studio.clearSceneActors=()=>{actorRequest++;for(const a of sceneActors)a.dispose();sceneActors=[]};
window.__studio.createSceneActors=async specs=>{window.__studio.clearSceneActors();const token=actorRequest;const made=[];try{for(const spec of specs){const a=await createSceneActor({scene,url:spec.url,bank,boneMap,physics:()=>physicsEnabled});if(token!==actorRequest){a.dispose();for(const old of made)old.dispose();return false}a.role=spec.role;a.character=spec.character;a.outfit=spec.outfit??0;made.push(a)}sceneActors=made;return true}catch(e){for(const a of made)a.dispose();throw e}};
window.__studio.setActorFrame=(role,tracks)=>{const actor=sceneActors.find(a=>a.role===role);if(actor){actor.lastFrame=tracks;actor.setFrame(tracks)}};
window.__studio.characterOptions=()=>characters.map(c=>({...c,paths:[...c.paths],outfits:[...c.outfits]}));
window.__studio.currentOutfit=()=>Number($('#outfit-select').value)||0;
window.__studio.setSceneActorOutfit=async(role,character,index)=>{const old=sceneActors.find(a=>a.role===role),definition=characters.find(c=>c.id===character),url=definition?.paths[index];if(!old||!url)throw Error('Участник или костюм недоступен');const token=actorRequest;const next=await createSceneActor({scene,url,bank,boneMap,physics:()=>physicsEnabled});if(token!==actorRequest||!sceneActors.includes(old)){next.dispose();return false}try{next.role=role;next.character=character;next.outfit=index;next.vrm.scene.position.copy(old.vrm.scene.position);next.vrm.scene.quaternion.copy(old.vrm.scene.quaternion);next.vrm.scene.scale.copy(old.vrm.scene.scale);next.lastFrame=old.lastFrame;if(next.lastFrame)next.setFrame(next.lastFrame);sceneActors[sceneActors.indexOf(old)]=next;old.dispose();return true}catch(e){next.dispose();throw e}};
window.__studio.actorLayout=(spread=0)=>{sceneActors.forEach((a,i)=>{a.vrm.scene.position.x=spread*(i===0?-1:1);a.vrm.scene.updateMatrixWorld(true)})};
Object.defineProperty(window.__studio,'actors',{get:()=>sceneActors});
window.__studio.setLinkedPose=c=>{if(poseEditor?.active)poseEditor.enable(false);bank.clips=bank.clips.filter(x=>x.id!==c.id);bank.clips.push(c);clip=c;clipTime=0;transition=null;applyPose(0);vrm.springBoneManager?.reset();for(let i=0;i<45;i++){applyPose(0);vrm.update(1/60)}updatePoseUi();window.__studio.pose=c.id};
window.__studio.frameLinkedPose=()=>fitPosedCamera(view);
window.__studio.setLinkedLoading=name=>{if(name)$('#pose-title').textContent='Загрузка сцены · '+name;else updatePoseUi()};
window.__studio.setLinkedLabel=name=>{if(clip?.linked){clip.name=name;updatePoseUi()}};
window.__studio.setPlaying=value=>{playing=Boolean(value);$('#play').textContent=playing?'Ⅱ':'▶'};
window.__studio.applyOutfit=async value=>{const path=currentCharacter?.paths[Number(value)];if(!path)throw Error('Неизвестный костюм');const url=new URL(location.href);url.searchParams.set('vrm',path);history.replaceState(null,'',url);await loadModel(path,null,true);linkedController?.syncOutfits?.();};
$('#outfit-select').onchange=e=>{window.__studio.applyOutfit(e.target.value)};
$('#pick').onclick=()=>$('#file').click();$('#file').onchange=e=>{if(e.target.files[0])loadModel(e.target.files[0])};$('#model-select').onchange=e=>{const url=new URL(location.href);url.searchParams.set('vrm',e.target.value);history.replaceState(null,'',url);loadModel(e.target.value)};
addEventListener('dragover',e=>e.preventDefault());addEventListener('drop',e=>{e.preventDefault();const file=e.dataTransfer.files[0];if(file)loadModel(file)});
$('#tpose').onclick=()=>setPose(null);$('#play').onclick=()=>{if(poseEditor?.active){poseEditor.section.querySelector('.pe-play').click();return;}if(!playing&&clip&&clipTime>=clip.duration)clipTime=0;playing=!playing;$('#play').textContent=playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',playing?'Приостановить анимацию':'Продолжить анимацию')};$('#speed').onchange=()=>toast(`Скорость ${$('#speed').value}×`);
$('#timeline').oninput=e=>{if(poseEditor?.active){poseEditor.seek(Number(e.target.value));return;}playing=false;$('#play').textContent='▶';$('#play').setAttribute('aria-label','Продолжить анимацию');clipTime=Number(e.target.value);transition=null;applyPose(clipTime);vrm?.springBoneManager?.reset();updatePoseUi()};$('#restart').onclick=()=>{if(poseEditor?.active)poseEditor.seek(0);else setPose(clip?.id,false)};
$('#physics').onchange=e=>{physicsEnabled=e.target.checked;vrm?.springBoneManager?.reset();toast(physicsEnabled?'Физика включена':'Физика выключена')};$('#collisions').onchange=e=>{collisionsEnabled=e.target.checked;for(const j of allJoints)j.colliderGroups=collisionsEnabled?collisionGroups.get(j):[];vrm?.springBoneManager?.reset();toast(collisionsEnabled?'Столкновения включены':'Столкновения выключены — только пружины')};
$('#collider-view').onchange=e=>{for(const h of colliderHelpers)h.visible=e.target.checked};$('#skeleton-view').onchange=e=>{if(boneHelper)boneHelper.visible=e.target.checked};$('#reset-physics').onclick=()=>{vrm?.springBoneManager?.reset();toast('Симуляция сброшена')};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>fitCamera(b.dataset.view);
$('#screenshot').onclick=()=>{renderer.render(scene,camera);const a=document.createElement('a');a.download=`${currentCharacter?.id||"avatar"}-${clip?.id||'tpose'}.png`;a.href=renderer.domElement.toDataURL('image/png');a.click();toast('Снимок сохранён')};
function resize(){const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/Math.max(h,1);camera.updateProjectionMatrix()}new ResizeObserver(resize).observe(stage);resize();
function loop(now){requestAnimationFrame(loop);const dt=Math.min((now-last)/1000,.075);last=now;controls.update();if(ready&&vrm){if(!poseEditor?.active)linkedController?.update(dt);if(clip?.linked){clipTime=linkedController?.time||0}else if(!poseEditor?.active&&playing&&clip){const next=clipTime+dt*Number($('#speed').value);if(clip.duration<=0)clipTime=0;else if(clip.native&&!clip.loop&&next>=clip.duration){clipTime=clip.duration;playing=false;$('#play').textContent='▶'}else clipTime=next%clip.duration;}applyPose(clipTime);poseEditor?.update(dt*Number($('#speed').value));accumulator=Math.min(accumulator+dt,.075);try{while(accumulator>=1/60){vrm.update(1/60);accumulator-=1/60}if(accumulator<1/60)vrm.update(0)}catch(e){ready=false;fail(`Ошибка симуляции: ${e.message}`)}const editorState=poseEditor?.active?poseEditor.state:null;$('#timeline').max=String(editorState?.duration||clip?.duration||1);$('#timeline').value=String(editorState?.time??clipTime);$('#timecode').textContent=`${(editorState?.time??clipTime).toFixed(2)} / ${(editorState?.duration||clip?.duration||0).toFixed(2)}`;if(editorState){$('#play').textContent=editorState.playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',editorState.playing?'Приостановить клип редактора':'Проиграть клип редактора')}}if(ready){performanceController?.update(dt);faceController?.apply(dt);}for(const a of sceneActors)a.update(Math.min(dt,1/30));renderer.render(scene,camera);frameCount++;if(now-fpsStart>1000){$('#fps').textContent=`${Math.round(frameCount*1000/(now-fpsStart))} FPS`;frameCount=0;fpsStart=now}}
requestAnimationFrame(loop);
const requested=new URLSearchParams(location.search).get('vrm')||outfitPaths[0];if(outfitIndex(requested)<0&&![...$('#model-select').options].some(o=>o.value===requested)){const o=new Option(requested.split('/').pop(),requested);$('#model-select').append(o)}$('#model-select').value=requested;loadModel(requested);
