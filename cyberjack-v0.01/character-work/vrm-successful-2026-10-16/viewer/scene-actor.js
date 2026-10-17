import {applySourceAnchor} from './source-anchors.js';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from './node_modules/@pixiv/three-vrm/lib/three-vrm.module.js';
// Each participant has independent rest transforms and physics; clips share the scene clock.
export async function createSceneActor({scene,url,bank,boneMap,physics=()=>true}){
 const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));
 const gltf=await loader.loadAsync(new URL(url,location.href).href),vrm=gltf.userData.vrm;
 if(!vrm)throw Error('У участника нет VRM');
 VRMUtils.combineSkeletons(vrm.scene);vrm.scene.traverse(o=>{if(o.isMesh)o.frustumCulled=false});
 vrm.humanoid.autoUpdateHumanBones=false;if(vrm.lookAt)vrm.lookAt.autoUpdate=false;
 scene.add(vrm.scene);vrm.update(0);
 const allJoints=[...(vrm.springBoneManager?.joints||[])];
 let bindings=[],rawRest=[],sourceNodes=[],sourceMap=new Map(),clip=null,transition=null,physicsEnabled=true,firstFrame=true;
 const Q=new THREE.Quaternion(),Q2=new THREE.Quaternion(),Q3=new THREE.Quaternion();
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


}
function sampleTrack(track,t,out){
 const times=track.times,values=track.rotations;if(!times.length)return out.identity();let i=Math.min(times.length-2,Math.max(0,Math.floor(t*clip.fps)));while(i>0&&times[i]>t)i--;while(i<times.length-2&&times[i+1]<t)i++;const span=times[i+1]-times[i],a=span>0?THREE.MathUtils.clamp((t-times[i])/span,0,1):0;out.fromArray(values,i*4);Q2.fromArray(values,(i+1)*4);return out.slerp(Q2,a).normalize()
}
function applyPose(t){
 if(!vrm||!rawRest.length)return;
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

 const manager=vrm.springBoneManager;if(manager){const original=manager.update.bind(manager);manager.update=dt=>{if(physics())original(dt)}}
 prepareRig();
 return {vrm,get bindings(){return bindings.length},setFrame(tracks){clip={native:true,linked:true,tracks};applyPose(0);if(firstFrame){firstFrame=false;vrm.springBoneManager?.reset();for(let i=0;i<45;i++){applyPose(0);vrm.update(1/60)}}},update(dt){physicsEnabled=physics();vrm.update(dt)},dispose(){scene.remove(vrm.scene);VRMUtils.deepDispose(vrm.scene)}};
}
