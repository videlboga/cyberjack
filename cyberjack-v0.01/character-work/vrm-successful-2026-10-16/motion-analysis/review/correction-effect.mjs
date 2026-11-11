import {Vector3} from 'three';
// Measure visible joint motion, not local quaternion twist around a bone axis.
export const EFFECT_JOINTS=['forearm01_L','hand_L','forearm01_R','hand_R'];
export function effectPositions(mixer,pose,joints=EFFECT_JOINTS){return joints.flatMap(n=>{const e=pose[mixer.index.get('cf_j_'+n)].world.elements;if(n==='head'){const tip=new Vector3(0,.12,.1).applyQuaternion(pose[mixer.index.get('cf_j_'+n)].worldQ);return [e[12]+tip.x,e[13]+tip.y,e[14]+tip.z]}return [e[12],e[13],e[14]]})}
export function poseRms(a,b,height=1){return Math.sqrt(a.reduce((sum,x,i)=>sum+(x-b[i])**2,0)/(a.length/3))/height}
export function summarizeEffect(samples,height){
 const deltas=samples.map(s=>poseRms(s.before,s.after,height)),maxJoint=Array(samples[0]?.before.length/3||0).fill(0);for(const s of samples)for(let j=0;j<maxJoint.length;j++)maxJoint[j]=Math.max(maxJoint[j],Math.hypot(...s.before.slice(j*3,j*3+3).map((x,i)=>x-s.after[j*3+i]))/height);
 const rms=deltas.reduce((a,b)=>a+b,0)/(deltas.length||1),max=Math.max(0,...maxJoint),leftWrist=maxJoint[1]||0,rightWrist=maxJoint[3]||0;return {rms,max,leftWrist,rightWrist,maxMeters:max*height,leftWristMeters:leftWrist*height,rightWristMeters:rightWrist*height,visible:rms>=.015&&max>=.025};
}
