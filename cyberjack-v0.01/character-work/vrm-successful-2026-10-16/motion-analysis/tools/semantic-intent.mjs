import{compileMotionIntent}from'./motion-intent.mjs';
import{ANATOMICAL_TARGETS}from'../review/anatomical-targets.mjs';
import{FEATURE_SCALES}from'../review/command-pose.mjs';
export const SEMANTIC_INTENT_SYSTEM=`Translate the user's Russian instruction into compact semantic JSON. Prefer qualitative meanings over numeric geometry. Never use action codes or clip IDs.
For goals that cannot be expressed faithfully by the semantic fields below, use the SAME response with constraints:[{feature,min?,max?}] and worldTorso:{torsoInclination:[min,max],chestUp:[min,max]} for that stage. This is an open geometric escape, never discard an unfamiliar condition. Geometric features: ${Object.keys(FEATURE_SCALES).filter(k=>!k.includes('HandAt_')).join(', ')}. Heights/distances are fractions of standing height; knee/elbow angles 0 straight,150 folded; Arm -90 down,0 sideways,90 overhead; torsoInclination 0 upright,90 horizontal,180 inverted; chestUp positive chest faces up/backward,negative faces down/forward. Only explicit goals; do not add incidental posture constraints.
Schema: {summary:short Russian,stages:[{description:short Russian,query:short English meaning,posture?:free English posture description,parts?:[{part:English body part,intent:short English goal}],contacts?:[{effector:English body part,target:English anatomical point or supplied object ID}],travel?:{right:number,forward:number},turn?:number,activity?:short English continuing activity,trajectory?:short English transient motion}]}.
Use only explicit goals, 1-6 chronological stages. No preparatory movements invented by you. Resolve left/right anatomically; singular unspecified hand/leg defaults right. Preserve unspecified body parts. 'Another hand' refers to the other hand in context. A posture change replaces the old posture; an isolated limb change does not invent standing, straight legs, lean or a head movement. Split sit and extend legs, kneel and touch forehead to floor into separate stages. The posture field means an EXPLICIT NEW posture requested by the user, NEVER the context posture. Omit it for limb-only requests. Previous stage goals are retained locally: do not repeat them. Contacts: use left hand/right hand/both hands, forehead, left knee/right knee/both knees, left foot/right foot/both feet. Between legs means groin, not inner thigh; holding legs means knees. Preserve side in both part and contact.
Posture/part descriptions and query are free text; do not reject an unfamiliar activity. Distinguish a final pose from a transient trajectory: flip/jump/roll need trajectory; eating/waving repeatedly need activity. Attach activity to the last posture stage, don't invent props or posture. Contacts with a chair/table/wall require that explicitly requested object. Travel is cumulative [right,forward] metres relative to command start, not procedural footsteps; turn cumulative rightward degrees. Ordinary walking is a standing posture plus travel; add trajectory only for a specifically requested unusual gait. Travel and turn are absent unless requested. Never add forehead-to-floor contact for merely bowing or kneeling.
Examples of part goals are raised, lowered, extended forward, spread, together, bent, straight, behind back, behind head, lean forward, lean backward; these are examples, not an action enum. Anatomical point IDs are supplied in context. Do not infer failure, drop a clause or replace an unknown intent with idle. Examples: "Подними правую ногу" => {"summary":"Поднять правую ногу","stages":[{"description":"Поднять правую ногу","query":"raise right leg","parts":[{"part":"right leg","intent":"raised"}]}]}. "Сядь и вытяни ноги" => {"summary":"Сесть и вытянуть ноги","stages":[{"description":"Сесть","query":"sit down on floor","posture":"seated on floor"},{"description":"Вытянуть ноги","query":"extend both legs forward","parts":[{"part":"both legs","intent":"extended forward"}]}]}. JSON only.`;
const canonical=s=>String(s||'').toLowerCase().trim().replace(/[_-]/g,' ').replace(/\s+/g,' ');
const sideOf=s=>/\bleft\b/.test(s)?['left']:/\bright\b/.test(s)?['right']:/\bboth\b|hands|legs|feet|knees|arms/.test(s)?['left','right']:['right'];
function postureFact(text){const s=canonical(text);if(/all fours|hands and knees|quadruped/.test(s))return'all fours';if(/kneel/.test(s))return'kneeling upright';if(/seated|sitting|sit/.test(s)&&!/chair|seat on/.test(s))return'seated on floor';if(/lying.*back|supine/.test(s))return'lying on back';if(/lying.*(?:belly|stomach)|prone/.test(s))return'lying on belly';if(/stand|upright standing/.test(s)&&!/handstand/.test(s))return'standing';return null;}
export function semanticContext(current,points){
 const f=current.features||{},posture=f.torsoInclination<40?(f.hipHeight<.25?'low seated':f.leftKneeHeight<.07&&f.rightKneeHeight<.07?'kneeling':'upright'):f.chestUp>.6?'lying on back':f.chestUp<-.6?'face down':'inclined';
 return {posture,contacts:(current.bodyTouchGoals||current.constraints||[]).filter(c=>/HandAt_|foreheadHeight/.test(c.feature)).map(c=>c.feature),position:current.position,yaw:current.yaw,gender:current.profile?.anatomyGender,objects:(current.sceneObjects||[]).map(o=>({id:o.id,role:o.role,enabled:o.enabled!==false})),anatomicalPoints:points};
}
export function compileSemanticIntent(value,current,text){
 if(!value||!Array.isArray(value.stages)||!value.stages.length||value.stages.length>6)throw Error('Семантический разбор не вернул этапы');
 let translation=[0,0],yaw=0,posture=null,previous=null;const stages=[],uncompiled=[];
 for(const [index,raw]of value.stages.entries()){
  const s={...raw};
  // A directional trunk edit is a modifier of the current support, even when
  // the model puts it in posture instead of parts. Use the same compiler path.
  const leanText=canonical(s.posture),leaning=/\b(?:lean(?:ing|ed)?|bend(?:ing)?|bent|bow(?:ing|ed)?)\b.*\b(forward|backward|back)\b/.exec(leanText)||/\b(forward|backward|back)\b.*\b(?:lean|bend|bow)\b/.exec(leanText);
  if(leaning&&!s.constraints?.length){s.parts=[...(s.parts||[]),{part:'torso',intent:leaning[1]==='forward'?'lean forward':'lean backward'}];if(!postureFact(s.posture))delete s.posture;}
  const explicitObject=o=>new RegExp('(?:'+[o.id,o.role,...(o.role==='seat'?['стул','кресл','диван','chair','seat']:o.role==='table'?['стол','table']:o.role==='wall'?['стен','wall']:[])].filter(Boolean).map(x=>String(x).replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','i').test(text);
  if(/chair|seat/.test(canonical(s.posture))&&!(current.sceneObjects||[]).some(o=>o.role==='seat'&&explicitObject(o))){s.posture='seated on floor';if(!s.parts?.length){s.description=text;s.query='sit down on floor';}}
  // An activity-only request must not acquire the measured context as a new posture.
  if(s.activity&&s.posture&&!s.parts?.length&&!s.contacts?.length&&canonical(s.posture)===canonical(semanticContext(current,[]).posture)&&!/(?:сесть|сяд|сиди|сто[яй]|вста|лечь|ляг|л[её]жа|колен|четвер|сидя|sit|stand|lie|lying|kneel)/i.test(text))delete s.posture;
  if(typeof s.description!=='string'||typeof s.query!=='string'||!s.description.trim()||!s.query.trim())throw Error('В семантическом этапе нет описания');
  for(const key of Object.keys(s))if(!['description','query','posture','parts','contacts','travel','turn','activity','trajectory','constraints','worldTorso'].includes(key))throw Error('Неизвестное семантическое поле: '+key);
  if(s.travel!==undefined){if(!Number.isFinite(s.travel.right)||!Number.isFinite(s.travel.forward))throw Error('Некорректное перемещение');translation=[s.travel.right,s.travel.forward];}
  if(s.turn!==undefined){if(!Number.isFinite(s.turn))throw Error('Некорректный поворот');yaw=s.turn;}
  const known=s.posture?postureFact(s.posture):null;if(s.posture&&!known&&!s.trajectory&&!s.constraints?.length&&!/bridge|backbend|handstand|split|crouch|squat|chair|seat|propped/i.test(s.posture))uncompiled.push({stage:index,goal:s.posture});
  if(known)posture=known;
  const fact={description:s.description,query:s.query,...(posture?{posture}:{})},empty=!(s.parts?.length||s.contacts?.length||s.posture);
  if(s.activity)fact.continuation=s.activity;
  let compiled=compileMotionIntent({stages:[fact]},current,text).stages[0];
  // No implicit geometry for a free continuing activity or recorded trajectory.
  if(empty&&(s.activity||s.trajectory))compiled={description:s.description,constraints:[],semantics:{query:s.query},duration:2};
  if(previous&&!s.posture){compiled.constraints=previous.constraints.map(c=>({...c}));if(previous.worldTorso)compiled.worldTorso=structuredClone(previous.worldTorso);else delete compiled.worldTorso;if(previous.handTargets)compiled.handTargets=structuredClone(previous.handTargets);if(previous.support)compiled.support=structuredClone(previous.support);}
  const set=(feature,min,max)=>{compiled.constraints=compiled.constraints.filter(c=>c.feature!==feature);compiled.constraints.push({feature,...(min!==undefined?{min}:{}),...(max!==undefined?{max}:{})});};
  const range=(feature,a,b)=>set(feature,a,b), orientation=(a,b,c,d)=>{range('torsoInclination',a,b);range('chestUp',c,d);compiled.worldTorso={torsoInclination:[a,b],chestUp:[c,d]};};
  const poseText=canonical(s.posture);
  if(/bridge|backbend/.test(poseText)){orientation(70,150,.4,1);range('hipHeight',.2,.65);range('headHeight',0,.3);for(const side of ['left','right']){range(side+'HandHeight',0,.07);range(side+'FootHeight',0,.07);range(side+'Arm',20,90);}}
  else if(/handstand/.test(poseText)){orientation(145,180,-1,1);range('hipHeight',.35,.85);range('headHeight',.02,.30);for(const side of ['left','right']){range(side+'HandHeight',0,.05);range(side+'FootHeight',.65,1.2);}}
  else if(/split/.test(poseText)){orientation(0,60,-.85,.6);range('hipHeight',.02,.18);for(const side of ['left','right']){range(side+'Knee',0,28);range(side+'FootLateral',.3,.7);}}
  else if(/crouch|squat/.test(poseText)){orientation(0,60,-.85,.6);range('hipHeight',.12,.35);for(const side of ['left','right']){range(side+'Knee',95,160);range(side+'FootHeight',0,.06);}}
  else if(/propped/.test(poseText)){orientation(40,85,.3,1);range('hipHeight',.03,.22);range('headHeight',.2,.5);range('chestHeight',.12,.4);for(const side of ['left','right'])range(side+'HandHeight',0,.07);}
  let localSides=new Set(),nonLeg=false;
  for(const part of s.parts||[]){const name=canonical(part.part),goal=canonical(part.intent),sides=sideOf(name),f=current.features||{};let handled=false;
   if(/leg|foot|feet|knee/.test(name)){
    for(const side of sides){if(/rais|lift|upward/.test(goal)){set(side+'FootHeight',(f[side+'FootHeight']||0)+.12,Math.max(.5,(f[side+'FootHeight']||0)+.3));handled=true;}
     else if(/lower/.test(goal)){set(side+'FootHeight',0,.06);handled=true;}
     else if(/extend.*forward|forward.*extend/.test(goal)){set(side+'Knee',0,28);set(side+'FootForward',.25,.85);handled=true;}
     else if(/spread|apart|outward|to the side/.test(goal)){if(sides.length===2)set('kneeSeparation',.3,.6);else set(side+'FootLateral',Math.max(.18,(f[side+'FootLateral']||0)+.08),.65);handled=true;}
     else if(/together/.test(goal)){set('kneeSeparation',.03,.15);handled=true;}
     else if(/bend|bent/.test(goal)){set(side+'Knee',65,150);handled=true;}
     else if(/straight|extend/.test(goal)){set(side+'Knee',0,28);handled=true;}
     if(handled)localSides.add(side);
    }
   }else if(/torso|trunk|back|body/.test(name)){nonLeg=true;const f=current.features||{};
    if(/lean.*back|backward/.test(goal)){set('chestUp',Math.min(.9,Math.max(.15,(f.chestUp||0)+.15)),1);handled=true;}
    else if(/lean.*forward|forward/.test(goal)){set('chestUp',-1,Math.max(-.9,Math.min(-.15,(f.chestUp||0)-.15)));handled=true;}
    if(handled&&!posture){const kneeling=f.leftKneeHeight<.07&&f.rightKneeHeight<.07&&Math.min(f.leftKnee,f.rightKnee)>65;
     if(kneeling){set('leftKneeHeight',0,.07);set('rightKneeHeight',0,.07);}
     else if(f.hipHeight<.25)set('hipHeight',Math.max(.02,f.hipHeight-.05),f.hipHeight+.05);
    }
    if(handled)compiled.worldTorso={torsoInclination:[Math.max(0,(f.torsoInclination||0)-10),Math.min(180,(f.torsoInclination||0)+50)],chestUp:[compiled.constraints.find(c=>c.feature==='chestUp').min,compiled.constraints.find(c=>c.feature==='chestUp').max]};
   }else if(/hand|arm/.test(name)){nonLeg=true;const touch=/on |touch|hold|placed|between/.test(goal),point=touch?(/between.*legs|groin/.test(goal)?'groin':/knees|holding.*legs/.test(goal)?'knees':ANATOMICAL_TARGETS.filter(d=>!['non-spatial','internal-unavailable'].includes(d.status)).sort((a,b)=>b.id.length-a.id.length).find(d=>new RegExp('\\b'+d.id.replace(/_/g,' ')+'\\b').test(goal))?.id):null;
    for(const side of sides){if(point){compiled.handTargets=(compiled.handTargets||[]).filter(h=>h.hand!==side);if(point==='knees')set(side+'HandKneeDistance',0,.12);else compiled.handTargets.push({hand:side,pointId:point});handled=true;}else if(/behind.*head/.test(goal)){(compiled.handTargets??=[]).push({hand:side,pointId:'head'});handled=true;}else if(/behind.*back/.test(goal)){(compiled.handTargets??=[]).push({hand:side,pointId:'back'});handled=true;}else if(/rais|overhead|upward/.test(goal)){set(side+'Arm',50,90);handled=true;}else if(/lower|relax/.test(goal)){set(side+'Arm',-90,-55);handled=true;}}}
   if(!handled&&!s.constraints?.length)uncompiled.push({stage:index,goal:part});
  }
  for(const c of s.contacts||[]){const eff=canonical(c.effector),target=canonical(c.target),sides=sideOf(eff),object=(current.sceneObjects||[]).find(o=>canonical(o.id)===target||canonical(o.role)===target);
   if(object&&!explicitObject(object))continue;
   if(object&&object.enabled!==false){const contacts=/hand/.test(eff)?sides.map(side=>side+'Hand'):/pelvis|hips|seat|buttocks|glute/.test(eff)?['pelvis']:null;if(contacts)compiled.support={objectId:object.id,contacts};else uncompiled.push({stage:index,goal:c});}
   else if(/floor|ground/.test(target)){if(/forehead/.test(eff)){set('foreheadHeight',0,.015);set('headHeight',.02,.18);set('leftKneeHeight',0,.035);set('rightKneeHeight',0,.035);for(const side of ['left','right']){set(side+'ShinTilt',0,25);set(side+'FootHeight',0,.08);set(side+'FootPastKnee',-.8,.03);}compiled.constraints=compiled.constraints.filter(c=>!['torsoInclination','chestUp'].includes(c.feature));compiled.worldTorso={torsoInclination:[75,160],chestUp:[-1,-.25]};}else if(/hand|knee|foot|feet/.test(eff))for(const side of sides)set(side+(/hand/.test(eff)?'HandHeight':/knee/.test(eff)?'KneeHeight':'FootHeight'),0,.04);else uncompiled.push({stage:index,goal:c});}
   else if(/hand/.test(eff)){const point=({'between legs':'groin','knees':'knees','knee':'knees','back of head':'head','abdomen':'belly'})[target]||target.replace(/ /g,'_');for(const side of sides){compiled.handTargets=(compiled.handTargets||[]).filter(h=>h.hand!==side);if(point==='knees')set(side+'HandKneeDistance',0,.12);else compiled.handTargets.push({hand:side,pointId:point});}}
   else uncompiled.push({stage:index,goal:c});
  }
  if(!s.posture&&!previous&&(s.contacts?.length||s.parts?.length&&s.parts.every(p=>/hand|arm/.test(canonical(p.part)))))delete compiled.worldTorso;
  if(s.constraints?.length){if(!known&&!previous)delete compiled.worldTorso;for(const c of s.constraints)set(c.feature,c.min,c.max);if(s.worldTorso)compiled.worldTorso=s.worldTorso;}
  if(s.trajectory){compiled.semantics={...compiled.semantics,requiresTrajectory:true,motionTerms:[s.trajectory],query:s.query};}
  if(s.activity){if(typeof s.activity!=='string')throw Error('Некорректное описание действия');compiled.semantics={...compiled.semantics,continuation:s.activity};}
  if(localSides.size===1&&!nonLeg&&!s.posture&&!s.contacts?.length)compiled.semantics={...compiled.semantics,localLegSides:[...localSides]};
  // Locally derived world orientation is preservation, never language-invented angles.
  previous=compiled;stages.push({...compiled,translation:[...translation],yaw,semantics:{...compiled.semantics,query:s.query},semanticGoals:s});
 }
 if(uncompiled.length){const e=new Error('Смысл команды сохранён, но геометрический компилятор ещё не поддерживает условия: '+uncompiled.map(g=>typeof g.goal==='string'?g.goal:JSON.stringify(g.goal)).join('; '));e.semanticIntent=value;e.uncompiledGoals=uncompiled;throw e;}
 return {summary:value.summary||text,relocationRequested:value.stages.some(s=>s.travel!==undefined),turnRequested:value.stages.some(s=>s.turn!==undefined),stages};
}
