import * as THREE from 'three';
import {clone} from 'three/addons/utils/SkeletonUtils.js';
import {inspectBodyClip} from './clip-compatibility.js?v=partial-2';
import {applySourceAnchor} from './source-anchors.js';

const VERSION='avatar-frame-1', WIDTH=112, HEIGHT=128, MAX_CACHE=400;
const mirror=(q,out=new THREE.Quaternion())=>out.set(q.x,-q.y,-q.z,q.w);
const idle=()=>new Promise(resolve=>{if('requestIdleCallback'in window)requestIdleCallback(resolve,{timeout:500});else setTimeout(resolve,40)});

// One independent avatar clone/context. Geometry and texture images are shared;
// bones, poses, material uniforms and morph weights are not. Never sample or seek the main player.
function makePortraitRig(template,renderer){
 const root=clone(template.vrm.scene),original=[],cloned=[];
 template.vrm.scene.traverse(n=>original.push(n));root.traverse(n=>cloned.push(n));
 const pairs=new Map(original.map((n,i)=>[n,cloned[i]]));
 const rest=template.rest.map(r=>({node:pairs.get(r.node),q:r.q.clone(),position:r.position.clone(),scale:r.scale.clone()})).filter(r=>r.node);
 root.position.set(0,0,0);root.quaternion.identity();root.scale.set(1,1,1);
 for(const r of rest){r.node.quaternion.copy(r.q);r.node.position.copy(r.position);r.node.scale.copy(r.scale)}
 const materials=new Map();function privateMaterial(source){if(!materials.has(source)){const material=source.clone();material.update?.(0);materials.set(source,material)}return materials.get(source)}
 const targets=new Map();root.traverse(n=>{if(n.name)targets.set(n.name,n);if(n.isMesh){n.material=Array.isArray(n.material)?n.material.map(privateMaterial):privateMaterial(n.material);n.frustumCulled=false;if(n.morphTargetInfluences)n.morphTargetInfluences.fill(0)}});root.updateMatrixWorld(true);
 const sources=new Map(template.sourceRig.map(s=>[s.name,{...s,local:new THREE.Quaternion().fromArray(s.rotation),world:new THREE.Quaternion(),restWorld:new THREE.Quaternion()}]));
 const ordered=[];function visit(s){if(s.done)return;const p=sources.get(s.parent);if(p)visit(p);s.restWorld.copy(p?p.restWorld:new THREE.Quaternion()).multiply(s.local);s.world.copy(s.restWorld);s.done=true;ordered.push(s)}for(const s of sources.values())visit(s);
 const posture=new Set(template.postureNames||[...Object.keys(template.boneMap),'cf_j_waist02','cf_j_leg03_L','cf_j_leg03_R']);
 // Match the main player's posture bindings, including unmapped posture helpers.
 for(const s of ordered)if(!template.postureNames&&/^cf_/.test(s.name)&&!/(?:sk_|hair|hit|collider)/i.test(s.name)&&targets.has(s.name))posture.add(s.name);
 const bindings=[];
 for(const s of ordered){if(s.name==='cf_j_root'||!posture.has(s.name))continue;const name=template.boneMap[s.name]||s.name,node=targets.get(name)||targets.get(THREE.PropertyBinding.sanitizeNodeName(name));if(!node)continue;let depth=0;for(let n=node.parent;n;n=n.parent)depth++;bindings.push({s,node,inverse:mirror(s.restWorld).invert(),restWorld:node.getWorldQuaternion(new THREE.Quaternion()),depth,rest:rest.find(r=>r.node===node)})}bindings.sort((a,b)=>a.depth-b.depth);
 const scene=new THREE.Scene();scene.background=new THREE.Color(0xd8dde1);scene.add(root,new THREE.HemisphereLight(0xffffff,0xb5bbc4,1.4));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-2,3,4);scene.add(light);
 const camera=new THREE.PerspectiveCamera(30,WIDTH/HEIGHT,.01,100);
 const frameBones=['hips','spine','chest','head','leftUpperArm','rightUpperArm','leftLowerArm','rightLowerArm','leftHand','rightHand','leftUpperLeg','rightUpperLeg','leftLowerLeg','rightLowerLeg','leftFoot','rightFoot'];
 const frameNodes=frameBones.map(name=>pairs.get(template.vrm.humanoid.getRawBoneNode(name))).filter(Boolean);
 function sample(track,t){const times=track.times,values=track.rotations;if(!times?.length||!values?.length)return null;if(times.length===1)return new THREE.Quaternion().fromArray(values);let i=0;while(i<times.length-2&&times[i+1]<t)i++;const f=THREE.MathUtils.clamp((t-times[i])/(times[i+1]-times[i]||1),0,1);return new THREE.Quaternion().fromArray(values,i*4).slerp(new THREE.Quaternion().fromArray(values,(i+1)*4),f)}
 return {render(clip){
  if(clip.native){const check=inspectBodyClip(clip,template.sourceRig,template.boneMap);if(!check.ok){const e=new Error(check.reason);e.code=check.code;throw e}}
  const t=Math.max(0,Number(clip.duration)||0)*.35;
  for(const r of rest){r.node.quaternion.copy(r.q);r.node.position.copy(r.position);r.node.scale.copy(r.scale)}
  for(const s of ordered){s.local.fromArray(s.rotation);s.animatedPosition=null;s.animatedScale=null}
  let rotations=0;
  for(const tr of clip.tracks||[]){const name=(tr.bone||tr.resolvedPath?.split('/').at(-1)||'').replace(/^cm_/,'cf_'),s=sources.get(name);if(!s)continue;
   if(!clip.native){const q=sample(tr,t);if(q){s.local.copy(q);rotations++}continue}
   const a=tr.sample(t);if(!a.every(Number.isFinite))throw Error('Некорректные каналы кадра');
   if(tr.attribute===2){if(a.length!==4||Math.hypot(...a)<1e-6)throw Error('Некорректное вращение');s.local.fromArray(a).normalize();rotations++}
   else if(tr.attribute===4){s.local.setFromEuler(new THREE.Euler(...a.map(v=>v*Math.PI/180),'ZXY'));rotations++}
   else if(tr.attribute===1)s.animatedPosition=a;else if(tr.attribute===3)s.animatedScale=a;
  }
  if(!rotations)throw Error('Нет позы тела');
  for(const s of ordered){const p=sources.get(s.parent);s.world.copy(p?p.world:new THREE.Quaternion()).multiply(s.local)}
  const cache=new Map();function world(n){if(!n)return new THREE.Quaternion();if(cache.has(n))return cache.get(n);const q=world(n.parent).clone().multiply(n.quaternion);cache.set(n,q);return q}
  for(const b of bindings){const parent=world(b.node.parent),q=mirror(b.s.world).multiply(b.inverse).multiply(b.restWorld).premultiply(parent.clone().invert());b.node.quaternion.copy(q);
   if(clip.native){const s=b.s;if(s.name==='cf_n_height')applySourceAnchor(b.node,s,sources,root);else if(s.animatedPosition&&s.position&&b.rest){const delta=new THREE.Vector3().fromArray(s.animatedPosition).sub(new THREE.Vector3().fromArray(s.position));delta.x=-delta.x;const sp=sources.get(s.parent);if(sp)delta.applyQuaternion(mirror(sp.world));delta.applyQuaternion(parent.clone().invert());b.node.position.copy(b.rest.position).add(delta)}
    if(s.animatedScale&&s.scale&&b.rest)b.node.scale.set(...s.animatedScale.map((v,i)=>Math.abs(s.scale[i])>1e-6?Math.max(.001,Math.abs(v/s.scale[i]))*b.rest.scale.getComponent(i):b.rest.scale.getComponent(i)));
   }cache.set(b.node,parent.clone().multiply(b.node.quaternion));
  }
  root.updateMatrixWorld(true);
  const bounds=new THREE.Box3();for(const node of frameNodes)bounds.expandByPoint(node.getWorldPosition(new THREE.Vector3()));
  if(bounds.isEmpty()||!Number.isFinite(bounds.min.x)||!Number.isFinite(bounds.max.y))throw Error('Нет границ позы');bounds.expandByScalar(.13);
  const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),angle=.28,tan=Math.tan(THREE.MathUtils.degToRad(15));
  const distance=Math.max(size.y/(2*tan),(Math.cos(angle)*size.x+Math.sin(angle)*size.z)/(2*tan*camera.aspect))*1.14+size.z/2;
  camera.position.copy(center).add(new THREE.Vector3(Math.sin(angle)*distance,.025,Math.cos(angle)*distance));camera.lookAt(center);renderer.render(scene,camera);
 },dispose(){scene.clear();for(const material of materials.values())material.dispose()}};
}

function cacheStore(){
 let dbPromise;
 async function open(){if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{const r=indexedDB.open('avatar-studio-thumbnails',1);r.onupgradeneeded=()=>{const s=r.result.createObjectStore('frames',{keyPath:'key'});s.createIndex('at','at')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});return dbPromise}
 return {async clear(){try{const db=await open();await new Promise(resolve=>{const tx=db.transaction('frames','readwrite');tx.objectStore('frames').clear();tx.oncomplete=tx.onerror=tx.onabort=resolve})}catch{}},async get(key){try{const db=await open();return await new Promise(resolve=>{const r=db.transaction('frames').objectStore('frames').get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>resolve(null)})}catch{return null}},async put(row){try{const db=await open();await new Promise(resolve=>{const tx=db.transaction('frames','readwrite'),s=tx.objectStore('frames');s.put({...row,at:Date.now()});const count=s.count();count.onsuccess=()=>{let remove=count.result-MAX_CACHE;if(remove<=0)return;const cursor=s.index('at').openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c&&remove-->0){c.delete();c.continue()}}};tx.oncomplete=tx.onerror=tx.onabort=resolve})}catch{/* The in-memory cache still works when storage is unavailable. */}}};
}

export function createClipThumbnails({getTemplate}){
 const entries=new Set(),pending=[],memory=new Map(),db=cacheStore();let renderer,rig,model=null,epoch=0,busy=false,timer=null,disposed=false;const stats={rendered:0,hits:0,failed:0};
 function placeholder(e,label,reason,state='unavailable'){e.frame.replaceChildren();const text=document.createElement('span');text.className='clip-thumbnail-placeholder';text.textContent=label;e.frame.append(text);e.frame.dataset.state=state;e.frame.title=reason;e.done=true}
 function show(e,result){if(result.blob){const url=URL.createObjectURL(result.blob),img=document.createElement('img');img.width=WIDTH;img.height=HEIGHT;img.alt='';img.decoding='async';img.src=url;e.url=url;e.frame.replaceChildren(img);e.frame.dataset.state='ready';e.frame.title='Кадр на 35% длительности · текущая модель · без симуляции физики';e.done=true}else placeholder(e,result.label||'Нет кадра',result.reason||'Превью недоступно')}
 function sweep(){for(const e of entries)if(!e.button.isConnected){observer.unobserve(e.frame);if(e.url)URL.revokeObjectURL(e.url);entries.delete(e)}}
 const observer=new IntersectionObserver(rows=>{for(const row of rows){const e=[...entries].find(e=>e.frame===row.target);if(!e)continue;e.visible=row.isIntersecting;if(e.visible&&!e.done&&!e.queued){e.queued=true;pending.push(e)}}schedule()},{rootMargin:'100px'});
 function schedule(){if(disposed||busy||timer)return;timer=setTimeout(()=>{timer=null;pump()},60)}
 async function pump(){if(disposed||busy)return;sweep();const template=getTemplate();if(!template){if(pending.length)schedule();return}if(model!==template.key)reset(template.key);const turn=epoch;busy=true;
 try{while(pending.length){const e=pending.shift();e.queued=false;if(!entries.has(e)||!e.visible||e.done)continue;const key=[VERSION,template.key,e.clip.id,e.clip.bytes||e.clip.duration||0,e.clip.playable===false||e.clip.runtimePlayable===false?'data':'body'].join('|');let result=memory.get(key)||await db.get(key);if(disposed||turn!==epoch||getTemplate()?.key!==template.key)break;if(result){stats.hits++;show(e,result);continue}
  if(e.clip.playable===false||e.clip.runtimePlayable===false){const reason=e.clip.playbackIssue||'Этот клип требует базового движения или другого типа рига';result={key,label:/сло|базов|маск|partial/i.test(reason)?'Слой':'Данные',reason};memory.set(key,result);show(e,result);continue}
  e.frame.dataset.state='loading';await idle();if(disposed||!e.button.isConnected||!e.visible)continue;
  try{const clip=await e.load();if(disposed||turn!==epoch||getTemplate()?.key!==template.key)break;if(!e.button.isConnected||!e.visible)continue;
   if(!renderer){renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:true});renderer.setSize(WIDTH,HEIGHT,false);renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace}
   if(!rig)rig=makePortraitRig(template,renderer);rig.render(clip);const blob=await new Promise(resolve=>renderer.domElement.toBlob(resolve,'image/webp',.82));if(!blob)throw Error('Браузер не создал изображение');result={key,blob};stats.rendered++;
  }catch(error){stats.failed++;result={key,label:['partial-body','rest-only','unmapped-body'].includes(error.code)?'Слой':'Нет кадра',reason:error.message};}
  if(disposed||turn!==epoch||getTemplate()?.key!==template.key)break;memory.set(key,result);while(memory.size>100)memory.delete(memory.keys().next().value);if(e.button.isConnected)show(e,result);if(result.blob)await db.put(result);
 }}finally{busy=false;if(!disposed&&pending.length)schedule()}
 }
 function reset(nextModel){epoch++;model=nextModel;rig?.dispose();rig=null;pending.length=0;sweep();for(const e of entries){if(e.url){URL.revokeObjectURL(e.url);e.url=null}e.done=false;e.queued=false;placeholder(e,'…','Превью подгрузится при просмотре','pending');e.done=false;if(e.visible){e.queued=true;pending.push(e)}}schedule()}
 return {async clearCache(){epoch++;memory.clear();await db.clear();reset(getTemplate()?.key||null)},attach(button,clip,load){sweep();button.classList.add('has-clip-thumbnail');const copy=document.createElement('span');copy.className='clip-thumbnail-copy';while(button.firstChild)copy.append(button.firstChild);const frame=document.createElement('span');frame.className='clip-thumbnail';frame.setAttribute('aria-hidden','true');button.append(frame,copy);const e={button,frame,clip,load,done:false,queued:false,visible:false,url:null};entries.add(e);placeholder(e,'…','Превью подгрузится при просмотре','pending');e.done=false;observer.observe(frame)},refresh(){reset(getTemplate()?.key||null)},get stats(){return {...stats,entries:entries.size,pending:pending.length,model,busy}},dispose(){disposed=true;clearTimeout(timer);observer.disconnect();for(const e of entries)if(e.url)URL.revokeObjectURL(e.url);entries.clear();rig?.dispose();renderer?.dispose();renderer?.forceContextLoss()}};
}
