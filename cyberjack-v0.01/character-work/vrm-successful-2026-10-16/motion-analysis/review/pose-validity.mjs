import {Vector3} from 'three';
// Torso-relative geometry: invariant to heading, root placement and whole-body tilt.
export function tPoseArms(rig,pose){
 const ids=new Map(rig.map((b,i)=>[b.name,i])),p=n=>{const i=ids.get('cf_j_'+n);return i===undefined?null:new Vector3().setFromMatrixPosition(pose[i].world)};
 const neck=p('neck'),hip=p('hips'),l=p('arm00_L'),r=p('arm00_R');if(!neck||!hip||!l||!r)return [];
 const up=neck.sub(hip).normalize(),lateral=l.clone().sub(r).normalize();
 return ['L','R'].filter(s=>{const shoulder=p('arm00_'+s),elbow=p('forearm01_'+s),hand=p('hand_'+s);if(!shoulder||!elbow||!hand)return false;const upper=elbow.clone().sub(shoulder).normalize(),lower=hand.clone().sub(elbow).normalize(),out=lateral.clone().multiplyScalar(s==='L'?1:-1);return upper.dot(lower)>Math.cos(10*Math.PI/180)&&upper.dot(out)>Math.cos(12*Math.PI/180)&&Math.abs(upper.dot(up))<Math.sin(12*Math.PI/180)});
}
export function transferredArms(config){if(config.transferMode==='whole')return ['L','R'];if(config.transferMode==='body')return [];return config.mask==='both'?['L','R']:config.mask==='left'?['L']:config.mask==='right'?['R']:[]}
export function sourcePoseValidity(mixer,key='custom'){
 const pose=mixer.makePose(),duration=mixer.duration({recipe:'custom'}),counts={L:0,R:0};let fullRest=0;const rest=mixer.makePose(),core=['hips','spine01','spine02','spine03','thigh00_L','thigh00_R','leg01_L','leg01_R'];
 for(let i=0;i<25;i++){mixer.sample(key,duration*i/24,pose);mixer.fk(pose);const arms=tPoseArms(mixer.rig,pose);for(const s of arms)counts[s]++;if(arms.length===2&&core.every(n=>{const i=mixer.index.get('cf_j_'+n);return pose[i].q.angleTo(rest[i].q)<8*Math.PI/180}))fullRest++;}
 return {arms:['L','R'].filter(s=>counts[s]>=24),fullBody:fullRest>=24};
}

export function persistentTPoseArms(mixer,key){return sourcePoseValidity(mixer,key).arms}
