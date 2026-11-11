import * as THREE from 'three';
export const poseClips={act_present_feet:'Base_feet',pose_standing:null,pose_standing_straight:null,pose_sitting:'Base_sitting',pose_lying_down:'Base_lying',pose_all_fours:'Base_all_fours',pose_kneeling:'Base_kneeling',pose_spread_eagle:'Base_spread_eagle'};
export function resolvePosture(contexts=[]){const ids=contexts.map(c=>c.actionId||c.id);return {base:ids.find(id=>id in poseClips)||'pose_standing',arms:ids.filter(id=>id.startsWith('posture_arms_')).at(-1)?.slice(13)||'free',legs:ids.filter(id=>id.startsWith('posture_leg_')).at(-1)?.slice(12)||'free',head:ids.filter(id=>id.startsWith('posture_head_')).at(-1)?.slice(13)||'forward',blockedArms:contexts.some(c=>c.blocksPoints?.some(p=>['arms','hands'].includes(p))||c.actionId==='pose_all_fours'||c.actionId==='act_suspend_wrists')};}
export function createPostureLayer(getVrm){
 let goal=resolvePosture(),weight=0,yaw=0;const neutral=new Map();const dirs=[new THREE.Vector3(0,-1,0),new THREE.Vector3(0,-1,0)];
 const q=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),worldQ=new THREE.Quaternion(),from=new THREE.Vector3(),target=new THREE.Vector3(),start=new THREE.Vector3(),end=new THREE.Vector3(),torsoQ=new THREE.Quaternion();
 function aim(node,child,direction,amount){if(!node||!child||amount<.001)return;node.getWorldPosition(start);child.getWorldPosition(end);from.copy(end).sub(start).normalize();q.setFromUnitVectors(from,direction);node.getWorldQuaternion(worldQ);worldQ.premultiply(q);node.parent.getWorldQuaternion(parentQ);worldQ.premultiply(parentQ.invert());node.quaternion.slerp(worldQ,amount)}
 return {captureRest(){const v=getVrm();for(const [name,b] of Object.entries(v?.humanoid.humanBones||{}))if(/Hand|Thumb|Index|Middle|Ring|Little/.test(name))neutral.set(b.node,b.node.quaternion.clone())},get holdsArms(){return goal.arms!=='free'&&!goal.blockedArms},get holdsUpperBody(){return goal.arms!=='free'||goal.head!=='forward'},get holdsHead(){return goal.head!=='forward'},set(contexts){goal=resolvePosture(contexts)},get baseClip(){return poseClips[goal.base]},get state(){return {...goal,weight,yaw}},update(dt,reduced=false,libraryArms=false){const vrm=getVrm();if(!vrm)return;const a=reduced?1:1-Math.exp(-dt*5),active=goal.arms!=='free'&&!goal.blockedArms&&!libraryArms;weight+=(Number(active)-weight)*a;
  const chest=vrm.humanoid.getRawBoneNode('chest');if(!chest)return;chest.getWorldQuaternion(torsoQ);
  for(const [i,side]of ['left','right'].entries()){
   const sign=side==='left'?1:-1;
   if(goal.arms==='up')target.set(sign*.16,1,.05).normalize();
   else target.set(goal.arms==='sides'?sign:sign*.12,goal.arms==='sides'?-.05:goal.arms==='front'?.02:-1,goal.arms==='front'?1:.05).normalize().applyQuaternion(torsoQ);
   dirs[i].lerp(target,a).normalize();const upper=vrm.humanoid.getRawBoneNode(side+'UpperArm'),lower=vrm.humanoid.getRawBoneNode(side+'LowerArm'),hand=vrm.humanoid.getRawBoneNode(side+'Hand');
   aim(upper,lower,dirs[i],weight);aim(lower,hand,dirs[i],weight);
  }
  for(const [node,rest] of neutral)node.quaternion.slerp(rest,weight);
  const targetYaw=goal.head==='left'?.45:goal.head==='right'?-.45:0;yaw+=(targetYaw-yaw)*a;const head=vrm.humanoid.getRawBoneNode('head');if(head&&Math.abs(yaw)>.001){const axis=new THREE.Vector3(0,1,0).applyQuaternion(torsoQ);head.getWorldQuaternion(worldQ);q.setFromAxisAngle(axis,yaw);worldQ.premultiply(q);head.parent.getWorldQuaternion(parentQ);head.quaternion.copy(worldQ.premultiply(parentQ.invert()))}
 }};
}
