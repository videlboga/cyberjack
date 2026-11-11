import{Quaternion,Vector3}from'three';
import{poseTools,pack,constraintScore}from'../review/command-pose.mjs';
import{armLegContacts}from'./self-collision.mjs';
const log=q=>{q=q.clone().normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const v=new Vector3(q.x,q.y,q.z),n=v.length();return n<1e-9?v.multiplyScalar(2):v.multiplyScalar(2*Math.atan2(n,q.w)/n);};
const exp=v=>{const a=v.length();return a<1e-9?new Quaternion():new Quaternion().setFromAxisAngle(v.clone().divideScalar(a),a);};
// Decaying pose and velocity residual, baked and checked before playback.
export function smoothTerminalEntry(bank,step){
 const idle=step.idleMotion,motion=step.motion;if(!idle?.frames?.length||!motion?.frames?.length||step.armOnly||step.legOnly)return step;
 const t=poseTools(bank),duration=Math.min(.3,idle.duration*.15),count=12,last=motion.frames.length-1,dt=motion.duration/Math.max(1,last),source=t.unpack(step.pose),prev=t.unpack(motion.frames[Math.max(0,last-1)]),target=t.unpack(idle.frames[0]),targetNext=t.unpack(idle.frames[1]),targetDt=idle.duration/(idle.frames.length-1),offsets=[];
 for(let j=0;j<source.length;j++){
  const offset=log(target[j].q.clone().invert().multiply(source[j].q)),incoming=log(prev[j].q.clone().invert().multiply(source[j].q)).divideScalar(dt),outgoing=log(target[j].q.clone().invert().multiply(targetNext[j].q)).divideScalar(targetDt);
  if(offset.length()>.6||source[j].p.distanceTo(target[j].p)>.01)return {...step,seam:{status:'unchanged',reason:'large pose discontinuity'}};
  offsets.push({offset,velocity:incoming.sub(outgoing)});
 }
 const supports=(motion.supportTrack?.at(-1)?.contacts||[]).filter(c=>c.normalNewtons>1&&!c.objectId&&c.joint).map(c=>({joint:c.joint,anchor:t.point(source,c.joint)}));const frames=[],initial=armLegContacts(t,source).worst;
 for(let k=0;k<=count;k++){
  const u=k/count,time=u*duration,f=time/idle.duration*(idle.frames.length-1),a=Math.min(idle.frames.length-2,Math.floor(f)),p=t.interpolate(t.unpack(idle.frames[a]),t.unpack(idle.frames[a+1]),f-a),h0=2*u*u*u-3*u*u+1,h1=u*u*u-2*u*u+u;
  for(let j=0;j<p.length;j++){const residual=offsets[j].offset.clone().multiplyScalar(h0).addScaledVector(offsets[j].velocity,duration*h1);if(residual.length()>.6)return {...step,seam:{status:'unchanged',reason:'velocity correction too large'}};p[j].q.multiply(exp(residual));}
  if(k===0){frames.push(step.pose);continue;}
  const before=p.map(n=>n.q.clone());t.limitJoints(p);if(supports.some(c=>t.point(p,c.joint).distanceTo(c.anchor)>.015*t.height)||p.some((n,j)=>n.q.angleTo(before[j])>.02)||constraintScore(t.features(p),step.constraints||[]).worst>.12||armLegContacts(t,p).worst>Math.max(.025,initial+.004)||t.ground(p)<-.012*t.height)return {...step,seam:{status:'unchanged',reason:'entry violates geometry'}};
  frames.push(pack(p));
 }
 return {...step,idleMotion:{...idle,entryFrames:frames,entryDuration:duration},seam:{status:'applied',duration,model:'decaying quaternion pose and velocity residual',checkedFrames:frames.length}};
}
