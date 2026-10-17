import * as THREE from 'three';

const registered = new WeakMap();
const EPS = 1e-7;
const vec = a => new THREE.Vector3().fromArray(a);
const pos = n => n.getWorldPosition(new THREE.Vector3());
const quat = n => n.getWorldQuaternion(new THREE.Quaternion());
const copy = value => structuredClone(value);
const transform = n => ({p:n.position.toArray(), q:n.quaternion.toArray(), s:n.scale.toArray()});

export function registerPoseAvatar(vrm) {
  if (registered.has(vrm)) return registered.get(vrm);
  vrm.scene.updateWorldMatrix(true, true);
  const relevant = new Set();
  // Own only the posture chain. Face helpers and secondary hair/cloth bones
  // remain owned by the face controller and spring-bone simulation.
  for (const [name,{node}] of Object.entries(vrm.humanoid.rawHumanBones)) {
    if(name==='leftEye'||name==='rightEye')continue;
    for (let p=node; p && p!==vrm.scene; p=p.parent) relevant.add(p);
  }
  const nodes = new Map(), ids = new Map();
  for (const n of relevant) {
    let id=n.name || 'node';
    if (nodes.has(id)) {
      const parts=[];for(let p=n;p&&p!==vrm.scene;p=p.parent)parts.unshift(p.parent.children.indexOf(p));
      id += '@'+parts.join('.');
    }
    nodes.set(id,n);ids.set(n,id);
  }
  const parents=Object.fromEntries([...nodes].map(([id,n])=>[id,ids.get(n.parent)||null]));
  const rest = {root:transform(vrm.scene), nodes:Object.fromEntries([...nodes].map(([id,n])=>[id,transform(n)]))};
  const human = Object.fromEntries(Object.entries(vrm.humanoid.rawHumanBones).filter(([, {node}])=>ids.has(node)).map(([name,{node}])=>[name,ids.get(node)]));
  const humanParents={};
  const normalizedIds=new Map(Object.entries(vrm.humanoid.normalizedHumanBones).map(([name,{node}])=>[node,name]));
  for(const [name,{node}] of Object.entries(vrm.humanoid.normalizedHumanBones))humanParents[name]=normalizedIds.get(node.parent)||null;
  const normalizedRest=copy(vrm.humanoid.normalizedRestPose);
  const signature = JSON.stringify(Object.entries(normalizedRest).map(([n,t])=>[n,t.position?.map(v=>Math.round(v*1e5)/1e5)]));
  let hash=2166136261;for(const c of signature)hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;
  const record={vrm,nodes,parents,human,humanParents,normalizedRest,rest,signature:hash.toString(16)};
  registered.set(vrm,record);return record;
}

export function capturePose(record) {
  return {root:transform(record.vrm.scene),nodes:Object.fromEntries([...record.nodes].map(([id,n])=>[id,transform(n)]))};
}
export function applySnapshot(record,snapshot) {
  function set(n,t){if(!n?.position||!t)return;n.position.fromArray(t.p);n.quaternion.fromArray(t.q).normalize();n.scale.fromArray(t.s);}
  set(record.vrm.scene,snapshot.root);
  for(const [id,t] of Object.entries(snapshot.nodes))set(record.nodes.get(id)||{},t);
  record.vrm.scene.updateWorldMatrix(true,true);
}

export function setWorldRotation(node,desired) {
  node.quaternion.copy(quat(node.parent).invert().multiply(desired)).normalize();
  node.updateWorldMatrix(false,true);
}
function aim(node,next,direction) {
  const from=pos(next).sub(pos(node));
  if(from.lengthSq()<EPS*EPS||direction.lengthSq()<EPS*EPS)return;
  const swing=new THREE.Quaternion().setFromUnitVectors(from.normalize(),direction.clone().normalize());
  setWorldRotation(node,swing.multiply(quat(node)));
}

// The joint positions, rather than Blender bone tails, define each limb.
export function solveTwoBone(a,b,c,target,pole=pos(b)) {
  const start=pos(a),l1=start.distanceTo(pos(b)),l2=pos(b).distanceTo(pos(c));
  if(l1<EPS||l2<EPS)throw Error('У этой цепочки нулевая длина');
  let axis=target.clone().sub(start);
  const distance=THREE.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+EPS,l1+l2-EPS);
  if(axis.lengthSq()<EPS*EPS)axis.copy(pos(c).sub(start));
  if(axis.lengthSq()<EPS*EPS)axis.set(0,-1,0);axis.normalize();
  let bend=pole.clone().sub(start);bend.addScaledVector(axis,-bend.dot(axis));
  if(bend.lengthSq()<EPS*EPS){bend.set(0,0,1).addScaledVector(axis,-axis.z);if(bend.lengthSq()<EPS*EPS)bend.set(1,0,0).addScaledVector(axis,-axis.x);}
  bend.normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance);
  const height=Math.sqrt(Math.max(0,l1*l1-along*along));
  const middle=start.clone().addScaledVector(axis,along).addScaledVector(bend,height);
  const end=start.clone().addScaledVector(axis,distance);
  aim(a,b,middle.clone().sub(start));aim(b,c,end.clone().sub(pos(b)));
  return {requested:target.toArray(),actual:pos(c).toArray(),clamped:Math.abs(target.distanceTo(start)-distance)>1e-5,lengths:[l1,l2]};
}

export function moveJoint(record,name,target,{free=false}={}) {
  const n=name==='__root'?record.vrm.scene:record.nodes.get(record.human[name]||name);
  if(!n)throw Error('Сустав не найден');
  if(free||name==='__root'||name==='hips'){
    n.position.copy(n.parent?n.parent.worldToLocal(target.clone()):target);n.updateWorldMatrix(false,true);return {method:'translate'};
  }
  const limbs=[];
  for(const side of ['left','right']){
    limbs.push([side+'UpperArm',side+'LowerArm',side+'Hand']);
    limbs.push([side+'UpperLeg',side+'LowerLeg',side+'Foot']);
  }
  for(const chain of limbs){
    if(name!==chain[1]&&name!==chain[2])continue;
    const [a,b,c]=chain.map(k=>record.nodes.get(record.human[k]));
    if(!a||!b||!c)break;
    return {...solveTwoBone(a,b,c,name===chain[2]?target:pos(c),name===chain[1]?target:pos(b)),method:name===chain[1]?'pole':'ik'};
  }
  // For other joints rotate their humanoid parent; keep the rest offset intact.
  const parentName=record.humanParents[name],parent=record.nodes.get(record.human[parentName]);
  if(!parent)throw Error('Для этого узла выберите свободное перемещение');
  aim(parent,n,target.clone().sub(pos(parent)));return {method:'aim',actual:pos(n).toArray()};
}

export function interpolateSnapshot(a,b,t) {
  const blend=(x,y)=>({p:vec(x.p).lerp(vec(y.p),t).toArray(),q:new THREE.Quaternion().fromArray(x.q).slerp(new THREE.Quaternion().fromArray(y.q),t).normalize().toArray(),s:vec(x.s).lerp(vec(y.s),t).toArray()});
  const nodes={};for(const id of Object.keys(a.nodes))nodes[id]=b.nodes[id]?blend(a.nodes[id],b.nodes[id]):copy(a.nodes[id]);
  return {root:blend(a.root,b.root),nodes};
}
export function sampleFrames(frames,time,interpolation='linear') {
  if(!frames.length)return null;
  if(time<=frames[0].time)return copy(frames[0].poses);
  if(time>=frames.at(-1).time)return copy(frames.at(-1).poses);
  let i=0;while(frames[i+1].time<=time)i++;
  const a=frames[i],b=frames[i+1];if(interpolation==='step')return copy(a.poses);
  const t=(time-a.time)/(b.time-a.time),result={};
  for(const id of Object.keys(a.poses))result[id]=b.poses[id]?interpolateSnapshot(a.poses[id],b.poses[id],t):copy(a.poses[id]);
  return result;
}
export function upsertFrame(frames,time,poses) {
  const result=frames.filter(k=>Math.abs(k.time-time)>.0005);
  result.push({time:Math.round(time*1000)/1000,poses:copy(poses)});return result.sort((a,b)=>a.time-b.time);
}

function deltaTransform(value,base) {
  const result={};for(const key of ['p','q','s'])if(value[key].some((n,i)=>Math.abs(n-base[key][i])>1e-9))result[key]=value[key];return result;
}
function deltaPose(value,base) {
  const nodes={};for(const [id,t] of Object.entries(value.nodes)){const d=base.nodes[id]?deltaTransform(t,base.nodes[id]):t;if(Object.keys(d).length)nodes[id]=d;}
  return {root:deltaTransform(value.root,base.root),nodes};
}
function inflatePose(value,base) {
  const result=copy(base);Object.assign(result.root,value.root);
  for(const [id,t] of Object.entries(value.nodes)){if(!result.nodes[id])throw Error('Неизвестная кость в клипе: '+id);Object.assign(result.nodes[id],t);}return result;
}

export function encodeProject(project,records) {
  const actors={};for(const [id,r] of records)actors[id]={label:r.label||id,signature:r.signature,base:r.rest};
  function pack(poses){return Object.fromEntries(Object.entries(poses).filter(([id])=>actors[id]).map(([id,p])=>[id,deltaPose(p,actors[id].base)]));}
  return {format:'cyberjack-pose-clip-v1',version:1,name:project.name,duration:project.duration,interpolation:project.interpolation||'linear',time:project.time||0,loop:project.loop!==false,actors,keys:project.frames.map(k=>({time:k.time,poses:pack(k.poses)})),working:pack(project.poses)};
}
function validateTransform(t,partial=false) {
  if(!t||typeof t!=='object')throw Error('Неверное преобразование');
  for(const [key,count] of [['p',3],['q',4],['s',3]]){
    if(partial&&!Object.hasOwn(t,key))continue;
    const a=t[key];if(!Array.isArray(a)||a.length!==count||!a.every(Number.isFinite))throw Error('В клипе некорректные координаты');
    if(key==='q'&&(Math.hypot(...a)<.99||Math.hypot(...a)>1.01))throw Error('Некорректный кватернион');
    if(key==='s'&&a.some(n=>Math.abs(n)<1e-9||Math.abs(n)>1000))throw Error('Некорректный масштаб');
  }
}
export function decodeProject(doc,records) {
  if(doc?.format!=='cyberjack-pose-clip-v1'||doc.version!==1)throw Error('Это не клип редактора поз');
  if(!Number.isFinite(doc.duration)||doc.duration<.033||doc.duration>3600)throw Error('Длительность должна быть от 0,033 до 3600 секунд');
  if(!['linear','step'].includes(doc.interpolation)||!Array.isArray(doc.keys)||doc.keys.length>1000)throw Error('Неверные ключевые кадры');
  if(!doc.actors||!Object.keys(doc.actors).length||Object.keys(doc.actors).length>8)throw Error('Неверный состав клипа');
  for(const [id,actor] of Object.entries(doc.actors)){
    const r=records.get(id);if(!r||r.signature!==actor.signature)throw Error('Клип создан для другого состава или скелета: '+actor.label);
    if(!actor.base?.nodes||Object.keys(actor.base.nodes).length!==r.nodes.size||Object.keys(actor.base.nodes).length>4096)throw Error('Некорректный состав костей скелета');
    validateTransform(actor.base.root);
    for(const [n,t] of Object.entries(actor.base.nodes)){if(!r.nodes.has(n))throw Error('В модели нет кости '+n);validateTransform(t);}
  }
  function unpack(poses){
    if(!poses||typeof poses!=='object')throw Error('В ключе отсутствует поза');
    for(const id of Object.keys(doc.actors))if(!Object.hasOwn(poses,id))throw Error('В ключе отсутствует участник '+id);
    return Object.fromEntries(Object.entries(poses).map(([id,p])=>{
      if(!Object.hasOwn(doc.actors,id)||!p?.nodes)throw Error('Неизвестный участник');validateTransform(p.root,true);
      for(const t of Object.values(p.nodes))validateTransform(t,true);
      return [id,inflatePose(p,doc.actors[id].base)];
    }));
  }
  const frames=doc.keys.map(k=>{if(!Number.isFinite(k.time)||k.time<0||k.time>doc.duration)throw Error('Ключ за пределами клипа');return {time:k.time,poses:unpack(k.poses)};}).sort((a,b)=>a.time-b.time);
  if(frames.some((k,i)=>i&&Math.abs(k.time-frames[i-1].time)<.0005))throw Error('Повторяющееся время ключей');
  return {name:String(doc.name||'Мой клип').slice(0,120),duration:doc.duration,interpolation:doc.interpolation,loop:doc.loop!==false,time:THREE.MathUtils.clamp(Number(doc.time)||0,0,doc.duration),frames,poses:unpack(doc.working)};
}

function worldMatrices(record,snapshot) {
  const cache=new Map();function get(id){if(cache.has(id))return cache.get(id);const t=snapshot.nodes[id]||record.rest.nodes[id],local=new THREE.Matrix4().compose(vec(t.p),new THREE.Quaternion().fromArray(t.q),vec(t.s));const p=record.parents[id];const m=p?get(p).clone().multiply(local):local;cache.set(id,m);return m;}
  for(const id of record.nodes.keys())get(id);return cache;
}
export function normalizedSnapshot(record,snapshot) {
  const current=worldMatrices(record,snapshot),rest=worldMatrices(record,record.rest),worldDelta={};
  const rotation=m=>new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().extractRotation(m));
  for(const [name,id] of Object.entries(record.human))worldDelta[name]=rotation(current.get(id)).multiply(rotation(rest.get(id)).invert());
  const result={};for(const name of Object.keys(record.human)){
    if(name==='leftEye'||name==='rightEye')continue;
    const parent=record.humanParents[name];const q=(parent?worldDelta[parent].clone().invert():new THREE.Quaternion()).multiply(worldDelta[name]).normalize();
    if(name==='hips')q.premultiply(new THREE.Quaternion().fromArray(snapshot.root.q));
    result[name]={rotation:q.toArray()};
  }
  const root=new THREE.Matrix4().compose(vec(snapshot.root.p),new THREE.Quaternion().fromArray(snapshot.root.q),vec(snapshot.root.s));
  result.hips.position=new THREE.Vector3().setFromMatrixPosition(root.multiply(current.get(record.human.hips))).toArray();
  return result;
}
export function exportVrma(record,frames,actorId,interpolation='linear',duration=null) {
  if(!frames.length)throw Error('Добавьте хотя бы один ключ');
  // VRMA deliberately cannot encode free translations of child joints or scale.
  for(const frame of frames){const pose=frame.poses[actorId];if(!pose)throw Error('В ключе отсутствует персонаж');
    if(pose.root.s.some(v=>Math.abs(v-1)>1e-5))throw Error('Масштаб модели сохранится в JSON; VRMA не поддерживает масштаб');
    for(const [id,t] of Object.entries(pose.nodes)){
      if(id!==record.human.hips&&t.p.some((v,i)=>Math.abs(v-record.rest.nodes[id].p[i])>1e-5))throw Error('Есть свободные сдвиги костей: сохраните JSON. VRMA допускает сдвиг только таза.');
      if(t.s.some((v,i)=>Math.abs(v-record.rest.nodes[id].s[i])>1e-5))throw Error('В клипе меняется масштаб костей; сохраните JSON');
    }
  }
  let samples=frames.map(k=>({time:k.time,pose:normalizedSnapshot(record,k.poses[actorId])}));
  if(samples[0].time>0)samples.unshift({...samples[0],time:0});
  const end=Math.max(duration||0,samples.at(-1).time,.033);if(samples.at(-1).time<end)samples.push({...samples.at(-1),time:end});
  const names=Object.keys(samples[0].pose),indices=Object.fromEntries(names.map((n,i)=>[n,i]));
  const nodes=names.map(name=>({name,translation:record.normalizedRest[name].position,rotation:[0,0,0,1]})),roots=[];
  for(const name of names){const parent=record.humanParents[name];if(parent&&Object.hasOwn(indices,parent))(nodes[indices[parent]].children??=[]).push(indices[name]);else roots.push(indices[name]);}
  const chunks=[],bufferViews=[],accessors=[];let offset=0;
  function add(values,type){const bytes=new Uint8Array(new Float32Array(values).buffer);bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length});chunks.push(bytes);offset+=bytes.length;const a={bufferView:bufferViews.length-1,componentType:5126,count:values.length/({SCALAR:1,VEC3:3,VEC4:4}[type]),type};if(type==='SCALAR'){a.min=[values[0]];a.max=[values.at(-1)];}accessors.push(a);return accessors.length-1;}
  const time=add(samples.map(s=>s.time),'SCALAR'),channels=[],samplers=[];
  for(const name of names){const output=add(samples.flatMap(s=>s.pose[name].rotation),'VEC4');channels.push({sampler:samplers.length,target:{node:indices[name],path:'rotation'}});samplers.push({input:time,output,interpolation:interpolation==='step'?'STEP':'LINEAR'});}
  const output=add(samples.flatMap(s=>s.pose.hips.position),'VEC3');channels.push({sampler:samplers.length,target:{node:indices.hips,path:'translation'}});samplers.push({input:time,output,interpolation:interpolation==='step'?'STEP':'LINEAR'});
  const doc={asset:{version:'2.0',generator:'Cyberjack Pose Editor'},extensionsUsed:['VRMC_vrm_animation'],extensions:{VRMC_vrm_animation:{specVersion:'1.0',humanoid:{humanBones:Object.fromEntries(names.map(n=>[n,{node:indices[n]}]))}}},scene:0,scenes:[{nodes:roots}],nodes,animations:[{name:'Pose clip',channels,samplers}],buffers:[{byteLength:offset}],bufferViews,accessors};
  const json=new TextEncoder().encode(JSON.stringify(doc)),jsonSize=Math.ceil(json.length/4)*4,binSize=Math.ceil(offset/4)*4;
  const data=new Uint8Array(28+jsonSize+binSize),view=new DataView(data.buffer);
  view.setUint32(0,0x46546c67,true);view.setUint32(4,2,true);view.setUint32(8,data.length,true);view.setUint32(12,jsonSize,true);view.setUint32(16,0x4e4f534a,true);data.fill(32,20,20+jsonSize);data.set(json,20);
  view.setUint32(20+jsonSize,binSize,true);view.setUint32(24+jsonSize,0x004e4942,true);let cursor=28+jsonSize;for(const b of chunks){data.set(b,cursor);cursor+=b.length;}return data;
}
