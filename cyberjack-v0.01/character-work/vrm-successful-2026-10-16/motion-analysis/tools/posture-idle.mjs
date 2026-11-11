import {Vector3,Quaternion}from'three';
import{pack,constraintScore}from'../review/command-pose.mjs';
import{armLegContacts}from'./self-collision.mjs';
export function postureIdlePolicy(t,step){
 const p=t.unpack(step.pose),f=t.features(p),contacts=step.support?.contacts||step.motion?.supportTrack?.at(-1)?.contacts||[],loaded=id=>contacts.some(c=>(c.id===id||c.joint===id)&&(c.normalNewtons||0)>5);
 const handSupport=['L','R'].some(s=>loaded('hand_'+s)),upright=f.torsoInclination<45;
 const legs=['L','R'].filter((s,i)=>{const key=i?'right':'left';return f[key+'FootHeight']>.10&&f[key+'KneeHeight']>.09&&!['foot_','knee_','shin_'].some(n=>loaded(n+s));});
 const grips=['L','R'].filter((s,i)=>(step.constraints||[]).some(c=>c.feature===(i?'right':'left')+'HandKneeDistance'));
 return {torso:upright&&!handSupport,legs,grips,reason:'Move unweighted elevated legs; preserve loaded limbs and root; no torso sway when reclining'};
}
export function buildPostureIdle(t,step){
 const base=t.unpack(step.pose),policy=postureIdlePolicy(t,step),initial=armLegContacts(t,base),floor=t.ground(base),duration=4.5;
 for(const gain of [1,.5,.25,.1,0]){
  const frames=[];let accepted=true;
  for(let k=0;k<=48;k++){
   const p=t.unpack(step.pose),theta=k/48*Math.PI*2,wave=k===48?0:Math.sin(theta),second=k===48?0:Math.sin(theta*2),rotate=(name,axis,amount)=>{const i=t.m.index.get('cf_j_'+name);if(i!==undefined)p[i].q.multiply(new Quaternion().setFromAxisAngle(new Vector3(...axis),amount*gain));};
   if(policy.torso)for(const name of ['spine02','spine03'])rotate(name,[0,0,1],wave*.006);
   for(const s of policy.legs){const sign=s==='L'?1:-1;rotate('thigh00_'+s,[1,0,0],wave*.025+sign*second*.004);rotate('thigh00_'+s,[0,0,1],wave*.009);rotate('leg01_'+s,[1,0,0],wave*.012);rotate('foot_'+s,[1,0,0],wave*.014);}
   t.m.fk(p);// Grip IK runs in avatar space with a persistent elbow plane; do not
   // independently reselect source-arm IK branches on every idle frame.
   if(constraintScore(t.features(p),step.constraints||[]).worst>.12||t.ground(p)<Math.min(-t.height*.012,floor-.002)||armLegContacts(t,p).worst>Math.max(.012,initial.worst+.001)){accepted=false;break;}
   frames.push(pack(p));
  }
  if(accepted){frames[48]=structuredClone(frames[0]);return {kind:'idle',id:'posture-aware-idle',name:policy.legs.length?'Idle · свободные ноги':'Idle · по текущим опорам',frames,duration,loop:true,policy,amplitudeScale:gain,protected:'root and loaded limbs'};}
 }
 throw Error('Не удалось построить idle в пределах ограничений');
}
