import {poseClips} from './posture-layer.js?v=2';
// Sources remain explicit: the planner checks the exact base, not just its label.
// The fallback ids are only used when the stage bank has not loaded yet.
export const baseSources={pose_standing:'d82833280717194afd3bde21',pose_standing_straight:'d82833280717194afd3bde21',pose_sitting:'28a3169401858c6bd0c90276',pose_lying_down:'227af670e6cbaa32bf59d276'};
export function createLibraryMotion(report,getBank){
 // Base library id comes from the shipped posture clip itself, so a rebuilt bank needs no code change.
 const resolveBase=pose=>{const stageId=poseClips[pose],clip=stageId?getBank?.()?.clips?.find(c=>c.id===stageId):null;return clip?.source?.libraryId||baseSources[pose]||null};
 let signature='',revision=0,current=null,status={phase:'idle'},elapsed=0;
 const cache=new Map();
 const publish=value=>{status=value;report(value)};
 async function request(path,body){const r=await fetch('/motion-lab/api/'+path,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});if(!r.ok)throw Error('Библиотека недоступна: '+r.status);return r.json()}
 return {get active(){return Boolean(current)},get activeArms(){return current?.config.mask==='both'},get state(){return status},
 async set(goal){const key=JSON.stringify([goal.base,goal.arms,goal.legs,goal.blockedArms]);if(signature===key)return;signature=key;const token=++revision;current=null;elapsed=0;
  const legGoal={left_forward:'left-leg-forward',right_forward:'right-leg-forward'}[goal.legs];
  if(!legGoal&&(goal.blockedArms||goal.arms==='free')){publish({phase:'idle',label:'Базовый клип'});return}
  if(!legGoal&&goal.arms!=='up'){publish({phase:'fallback',label:'Процедурный слой · для этой команды поиск движения ещё не подключён'});return}
  const baseId=resolveBase(goal.base);if(!baseId)return;
  publish({phase:'loading',label:'Подбираю движение из библиотеки…'});
  try{let prepared=cache.get(key);if(!prepared){
   const query=await request('motion-library/query',{...(legGoal?{goalId:legGoal}:{coreActionId:'posture_arms_up'}),currentBaseId:baseId,limit:1});if(query.status!=='candidates')throw Error('Нет размеченных источников для команды');
   const result=await request('mix/task-search',{base:{id:baseId,start:0,end:goal.base==='pose_lying_down'?4:1.3},goal:legGoal||'raise-both',basePlayback:'hold',tempo:'calm',allowWhole:false});
   const candidate=result.candidates?.find(c=>c.transferMode==='layer'&&c.quality?.accepted);if(!candidate)throw Error('Нет проверенного смешения для текущей базы');
   const p=new URLSearchParams();for(const side of ['base','donor'])for(const field of ['id','start','end'])p.set(side+field[0].toUpperCase()+field.slice(1),candidate.selection[side][field]);
   const bank=await request('mix/selection-bank?'+p);const {createMixer}=await import('/motion-lab/mix-core.mjs');prepared={mixer:createMixer(bank),rig:bank.rig,config:candidate.config,hold:candidate.probe.time,candidate,fingerprint:query.fingerprint};cache.set(key,prepared);
  }if(token!==revision)return;current=prepared;publish({phase:'playing',label:'Библиотека · '+prepared.candidate.name,baseId,donorId:prepared.candidate.id,quality:prepared.candidate.quality,fingerprint:prepared.fingerprint});
  }catch(e){if(token===revision)publish({phase:'fallback',label:e.message+' · '+(legGoal?'поза сохранена, движение не выполнено':'процедурный слой')})}
 },apply(dt,sourceMap){if(!current)return;elapsed+=dt;const t=Math.min(elapsed,current.hold);const result=current.mixer.evaluate(t,current.config);if(!current.indices){const roots={both:['cf_j_shoulder_L','cf_j_shoulder_R'],left:['cf_j_shoulder_L'],right:['cf_j_shoulder_R'],leftKnee:['cf_j_leg01_L'],rightKnee:['cf_j_leg01_R'],leftLeg:['cf_j_thigh00_L'],rightLeg:['cf_j_thigh00_R']}[current.config.mask]||[];
 const selected=name=>{const seen=new Set();while(name&&!seen.has(name)){if(roots.includes(name))return true;seen.add(name);name=current.rig.find(b=>b.name===name)?.parent}return false};
 current.indices=current.rig.map((b,i)=>selected(b.name)?i:-1).filter(i=>i>=0)}
 for(const i of current.indices){const node=sourceMap.get(current.rig[i].name);if(node)node.local.copy(result.mixed[i].q)}},
 };
}
