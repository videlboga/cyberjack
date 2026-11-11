import {Vector3} from 'three';
import {createTaskFeatures} from './task-features.mjs';
import {supportProfile} from './support-profile.mjs';
export const CONTEXT_ARMS=['shoulder_L','arm00_L','forearm01_L','hand_L','shoulder_R','arm00_R','forearm01_R','hand_R'];
export function contextDescriptor(rig,rest){
 const index=new Map(rig.map((b,i)=>[b.name,i])),p=(pose,n)=>new Vector3().setFromMatrixPosition(pose[index.get('cf_j_'+n)].world),height=p(rest,'head').distanceTo(p(rest,'foot_L'))+p(rest,'head').distanceTo(p(rest,'hips'))*.08;
 const features=createTaskFeatures(rig.map((b,i)=>({...b,world:rest[i].world,worldQ:rest[i].worldQ}))),inv=rest[index.get('cf_j_hips')].worldQ.clone().invert(),forward=p(rest,'toes_L').sub(p(rest,'foot_L')).normalize();
 return pose=>{
  const f=features(pose),hip=p(pose,'hips'),dir=forward.clone().applyQuaternion(pose[index.get('cf_j_hips')].worldQ.clone().multiply(inv)),yaw=Math.atan2(dir.x,dir.z),axis=new Vector3(0,1,0),relative=n=>p(pose,n).sub(hip).applyAxisAngle(axis,-yaw).divideScalar(height).toArray();
  const legs=['thigh00_L','leg01_L','foot_L','toes_L','thigh00_R','leg01_R','foot_R','toes_R'].flatMap(relative),torso=['spine03','head'].flatMap(relative),hands=['hand_L','hand_R'].flatMap(relative),ground=Math.min(...['foot_L','foot_R','toes_L','toes_R','hand_L','hand_R'].map(n=>p(pose,n).y)),handHeight=['L','R'].map(s=>(p(pose,'hand_'+s).y-ground)/height),feet=['L','R'].map(s=>(p(pose,'foot_'+s).y-ground)/height);
  const seat=supportProfile(f).kind==='seat-assumed',floorHands=handHeight.map(y=>y<.045),elevatedHands=handHeight.every(y=>y>.12)&&f.inclination>25;
  let contact=seat?{group:'seat',confidence:.85}:floorHands.every(Boolean)?{group:'floor-hands',confidence:.85}:elevatedHands?{group:'surface-hands',confidence:.5}:{group:'unresolved',confidence:.25};
  // Geometry alone cannot establish the identity of a supporting object/person.
  if(!seat&&Math.min(...feet)>.12)contact={group:'external-support',confidence:.3};
  return {f,legs,torso,hands,handHeight,feet,contact};
 }
}
export function contextDistance(target,candidate){
 const rms=(a,b)=>Math.sqrt(a.reduce((s,x,i)=>s+(x-b[i])**2,0)/a.length),legs=rms(target.legs,candidate.legs),torso=rms(target.torso,candidate.torso),inclination=Math.abs(target.f.inclination-candidate.f.inclination);
 return {score:legs*5+torso*3+inclination/180,legs,torso,inclination};
}
