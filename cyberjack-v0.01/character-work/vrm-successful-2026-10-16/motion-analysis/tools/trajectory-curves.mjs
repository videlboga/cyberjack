import{Quaternion}from'three';
import{poseTools,pack}from'../review/command-pose.mjs';
import{armLegContacts}from'./self-collision.mjs';
// Spherical cubic controls, aligned to the quaternion hemisphere of the knot.
const aligned=(q,ref)=>q.dot(ref)<0?new Quaternion(-q.x,-q.y,-q.z,-q.w):q.clone();
const logarithm=q=>{const a=Math.acos(Math.max(-1,Math.min(1,q.w))),s=Math.sin(a);return s<1e-8?[0,0,0]:[q.x*a/s,q.y*a/s,q.z*a/s];};
const exponential=v=>{const a=Math.hypot(...v),s=a<1e-8?1:Math.sin(a)/a;return new Quaternion(v[0]*s,v[1]*s,v[2]*s,Math.cos(a));};
function control(prev,q,next){const inverse=q.clone().invert(),a=logarithm(inverse.clone().multiply(aligned(prev,q))),b=logarithm(inverse.multiply(aligned(next,q)));return q.clone().multiply(exponential(a.map((v,i)=>-(v+b[i])/4)));}
export function curveProceduralTrajectory(bank,step){
 const m=step.motion;if(!m?.frames||m.frames.length<4||!m.noMargins||m.physicalSimulation||m.requiredTrajectory||m.loop||m.externalPilot||m.recordedTurn||m.directPlayback||m.source?.nativeTrajectory)return step;
 const t=poseTools(bank),poses=m.frames.map(t.unpack),controls=poses.map((p,i)=>p.map((j,k)=>control(poses[Math.max(0,i-1)][k].q,j.q,poses[Math.min(poses.length-1,i+1)][k].q))),frames=[],track=[],subdivisions=2;let accepted=0,rejected=0;
 for(let i=0;i<poses.length-1;i++){
  frames.push(m.frames[i]);if(m.supportTrack)track.push(m.supportTrack[i]);
  const baseline=Math.max(armLegContacts(t,poses[i]).worst,armLegContacts(t,poses[i+1]).worst,.025),support=m.supportTrack?.[i]?.contacts?.filter(c=>c.normalNewtons>1&&c.joint)||[];
  for(let k=1;k<subdivisions;k++){
   const u=k/subdivisions,linear=t.interpolate(poses[i],poses[i+1],u),p=t.interpolate(poses[i],poses[i+1],u);
   for(let j=0;j<p.length;j++){const a=poses[i][j].q.clone().slerp(poses[i+1][j].q,u),b=controls[i][j].clone().slerp(controls[i+1][j],u);p[j].q.copy(a.slerp(b,2*u*(1-u)));}
   t.m.fk(p);const saved=p.map(j=>j.q.clone());t.limitJoints(p);
   const invalid=p.some((j,n)=>j.q.angleTo(saved[n])>.01)||armLegContacts(t,p).worst>baseline+.001||t.ground(p)<Math.min(-.012*t.height,t.ground(linear)-.001)||support.some(c=>t.point(p,c.joint).distanceTo(t.point(linear,c.joint))>.006*t.height);
   if(invalid){frames.push(pack(linear));rejected++;}else{frames.push(pack(p));accepted++;}
   if(m.supportTrack)track.push(m.supportTrack[Math.min(m.supportTrack.length-1,Math.round(i+u))]);
  }
 }
 frames.push(m.frames.at(-1));if(m.supportTrack)track.push(m.supportTrack.at(-1));
 return {...step,motion:{...m,frames,...(m.supportTrack?{supportTrack:track}:{})},trajectoryCurve:{accepted,rejected,originalFrames:m.frames.length,frames:frames.length,model:'checked spherical cubic; exact original knots, positions and timing'}};
}
