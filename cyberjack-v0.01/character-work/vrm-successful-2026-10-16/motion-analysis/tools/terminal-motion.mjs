import {postureIdlePolicy,buildPostureIdle} from './posture-idle.mjs';
import {armLegContacts,resolveArmLegCollisions} from './self-collision.mjs';
import {searchMotionSemantics} from './motion-semantic-search.mjs';
import {poseTools,pack,constraintScore} from '../review/command-pose.mjs';
import {clipSemantics} from './command-semantics.mjs';
const smooth=x=>x*x*(3-2*x);
// Cyclic additive upper-body motion. Root and support limbs are never copied.
export async function buildTerminalMotion(bank,step,{text='',catalog,rows,sampleSource,semanticSearch=searchMotionSemantics}={}){
 const t=poseTools(bank),base=t.unpack(step.pose),query=step.semantics?.continuation||'',action=query||null;
 let retrieval=null,searchError=null;if(action)try{retrieval=await semanticSearch(query);}catch(e){searchError=e.message;}
 if((step.armOnly||step.legOnly)&&!action)return {kind:'idle',id:'held-arm-contact',name:step.legOnly?'Idle · сохранение локальной позы ноги':'Idle · сохранение контакта руки',frames:[pack(base),pack(base)],duration:4,loop:true,protected:'held hand, pelvis, legs and unrequested arm; face and breathing remain runtime layers'};
 const matchById=new Map((retrieval?.matches||[]).map(r=>[r.id,r]));
 const upper=[];for(let i=0;i<bank.rig.length;i++){let j=i;while(j>=0){if(bank.rig[j].name==='cf_j_spine01'){upper.push(i);break;}j=t.m.rig[j]?.parentIndex??-1;}}
 const valid=p=>constraintScore(t.features(p),step.constraints||[]).worst<=.12;
 if(action||sampleSource&&step.source?.id&&postureIdlePolicy(t,step).torso&&!postureIdlePolicy(t,step).legs.length){
  const sources=new Map();for(const row of rows){const clip=catalog.get(row.id);if(!clip||sources.has(clip.id))continue;const s=clipSemantics(clip);if(action?matchById.has(clip.id):(clip.id===step.source.id&&s.loop&&['quiet','small'].includes(s.energy)))sources.set(clip.id,{clip,row,s});}
  const candidates=[...sources.values()].filter(v=>v.clip.duration>.4).sort((a,b)=>action?matchById.get(b.clip.id).score-matchById.get(a.clip.id).score:Number(b.s.loop)-Number(a.s.loop));
  for(const {clip,row}of candidates.slice(0,24))try{
   const duration=Math.min(clip.duration,6),anchor=sampleSource({...row,time:0}).pose,frames=[];
   for(let k=0;k<=48;k++){
    const u=k/48,p=t.unpack(step.pose),source=sampleSource({...row,time:u*duration}).pose;
    // Return to the same pose at both ends, even when the source is not a loop.
    const envelope=action?1:smooth(Math.min(1,u/.12,(1-u)/.12));
    for(const i of upper){const delta=anchor[i].q.clone().invert().multiply(source[i].q);if(!action){const angle=delta.angleTo(delta.clone().identity()),gain=Math.min(.2,.035/Math.max(.0001,angle))*envelope;p[i].q.multiply(delta.clone().identity().slerp(delta,gain));}else if(/shoulder|arm|hand|finger/i.test(bank.rig[i].name))p[i].q.slerp(source[i].q,envelope);else p[i].q.multiply(delta.clone().identity().slerp(delta,envelope));}
    t.limitJoints(p);for(let i=0;i<p.length;i++)if(!upper.includes(i)){p[i].p.copy(base[i].p);p[i].q.copy(base[i].q);p[i].s.copy(base[i].s);}t.m.fk(p);if(armLegContacts(t,p).worst>.012)resolveArmLegCollisions(t,p,step.constraints||[]);if(armLegContacts(t,p).worst>.012||t.ground(p)<-t.height*.012||!valid(p))throw Error('Goal drift');frames.push(pack(p));
   }
   if(action){for(let k=43;k<=48;k++){const p=t.interpolate(t.unpack(frames[k]),t.unpack(frames[0]),smooth((k-42)/6));if(!valid(p))throw Error('Loop seam goal drift');frames[k]=pack(p);}frames[48]=structuredClone(frames[0]);}
   const first=t.unpack(frames[0]),activity=frames.some(frame=>{const pose=t.unpack(frame);return upper.some(i=>pose[i].q.angleTo(first[i].q)>(action?.08:.001));});if(!activity)continue;
   return {kind:action?'action':'idle',name:action?('Действие · '+clip.name):'Idle · движение исходного клипа',id:clip.id,source:{id:clip.id,name:clip.name},duration,frames,loop:true,protected:'root-and-legs',retrieval:action?{model:retrieval.model,signature:retrieval.signature,query,verification:retrieval.verification,score:matchById.get(clip.id).score,text:matchById.get(clip.id).text}:undefined,evidence:'source semantics; sampled target constraints; no prop or hand-mouth IK'};
  }catch{}
 }
 const idle=buildPostureIdle(t,step);return {...idle,...(action?{unavailableAction:action,searchError,note:'Не найден совместимый цикл действия; включён idle'}:{})};
}
