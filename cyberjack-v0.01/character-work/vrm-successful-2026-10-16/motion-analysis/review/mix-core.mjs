import {correctionPolicy} from './correction-policy.mjs';
import {Vector3,Quaternion,Matrix4,MathUtils} from 'three';
export function createMixer(bank){
 const rig=bank.rig.map((b,i)=>({...b,index:i,parentIndex:bank.rig.findIndex(p=>p.name===b.parent)})),index=new Map(rig.map((b,i)=>[b.name,i]));
 const makePose=()=>rig.map(b=>({p:new Vector3(...b.position),q:new Quaternion(...b.rotation),s:new Vector3(...b.scale),world:new Matrix4(),worldQ:new Quaternion()}));
 const originCache=new Map();
 const base=makePose(),donor=makePose(),mixed=makePose(),probeBase=makePose(),probeDonor=makePose(),probeMixed=makePose();const entryCache=new Map(),exitCache=new Map(),alignmentCache=new Map(),floorCache=new Map();
 const belongs=(i,name)=>{while(i>=0){if(rig[i].name===name)return true;i=rig[i].parentIndex}return false};
 // Which bones are actually animated in the donor. Partial "layer" clips carry rest values for most bones;
 // transferring those constants replaces the base pose with the rest pose, which is why layer mixes looked
 // like T-posed limbs. With animatedOnly the mixer keeps the base pose and applies only moving channels.
 const animatedBones=new Set();for(const tr of bank.clips.custom?.tracks||[])if(!tr.constant)animatedBones.add(tr.bone);
 // H layer clips store absolute local rotations with rest = identity, so their values ARE the delta from the
 // rest pose. Blending toward them straightens the base's bent joints; a delta has to be multiplied instead.
 // A clip whose tracks are mostly constant is such a layer.
 const customTracks=bank.clips.custom?.tracks||[];
 const constantShare=customTracks.length?customTracks.filter((t)=>t.constant).length/customTracks.length:0;
 const donorIsDelta=constantShare>0.5;
 function sampleRaw(key,t,out){const c=bank.clips[key];t=Math.max(0,Math.min(c.duration,t));let f=Math.min(c.times.length-2,Math.floor(t*30));while(f<c.times.length-2&&c.times[f+1]<t)f++;const a=(t-c.times[f])/(c.times[f+1]-c.times[f]||1);for(let i=0;i<rig.length;i++){out[i].p.fromArray(rig[i].position);out[i].q.fromArray(rig[i].rotation);out[i].s.fromArray(rig[i].scale)}for(const tr of c.tracks){const node=out[index.get(tr.bone)],off=tr.constant?0:f*tr.width,next=tr.constant?0:(f+1)*tr.width;if(tr.attribute===2)node.q.fromArray(tr.values,off).normalize().slerp(new Quaternion().fromArray(tr.values,next).normalize(),a);else (tr.attribute===1?node.p:node.s).fromArray(tr.values,off).lerp(new Vector3().fromArray(tr.values,next),a)}}
 // Remove only the initial horizontal placement. Preserve height and all relative travel.
 function sample(key,t,out){
  if(!originCache.has(key)){const first=makePose();sampleRaw(key,0,first);fk(first);const hip=first[index.get('cf_j_hips')].world.elements;originCache.set(key,new Vector3(hip[12],0,hip[14]));}
  sampleRaw(key,t,out);for(let i=0;i<rig.length;i++)if(rig[i].parentIndex<0)out[i].p.sub(originCache.get(key));
 }
 function sampleBase(t,out,config){const duration=bank.clips[config.base].duration;sample(config.base,config.basePlayback==='hold'?0:config.basePlayback==='once'?Math.min(t,duration):t%duration,out)}
 function duration(config){if(config.recipe==='custom')return bank.clips.custom.duration/(config.donorPlayback==='hold'?1:config.donorRate||1);return config.recipe==='raise'?bank.clips.raiseIn.duration-entryOffset(config)+bank.clips.raiseHold.duration*Math.max(1,config.holdLoops||1)+exitEnd(config):bank.clips.talk.duration}
 function donorAt(t,config){if(config.recipe==='custom')return {key:'custom',time:config.donorPlayback==='hold'?MathUtils.clamp(config.donorTime||0,0,bank.clips.custom.duration):t*(config.donorRate||1),phase:config.donorPlayback==='hold'?'Поза донора · удержание':'Кандидат из библиотеки'};if(config.recipe==='talk')return {key:'talk',time:t,phase:'Жест'};const offset=entryOffset(config);t+=offset;const a=bank.clips.raiseIn.duration,h=bank.clips.raiseHold.duration*Math.max(1,config.holdLoops||1);if(t<a)return {key:'raiseIn',time:t,phase:'Подъём'};if(t<a+h)return {key:'raiseHold',time:(t-a)%bank.clips.raiseHold.duration,phase:'Удержание'};return {key:'raiseOut',time:t-a-h,phase:'Опускание'}}
 const fkMatrix=new Matrix4();
 function fk(pose){for(let i=0;i<rig.length;i++){const n=pose[i],p=rig[i].parentIndex;fkMatrix.compose(n.p,n.q,n.s);if(p<0){n.world.copy(fkMatrix);n.worldQ.copy(n.q);}else{n.world.multiplyMatrices(pose[p].world,fkMatrix);n.worldQ.multiplyQuaternions(pose[p].worldQ,n.q);}}return pose}
 const bodyNames=new Set(['cf_j_hips','cf_j_waist01','cf_j_waist02','cf_j_spine01','cf_j_spine02','cf_j_spine03']);for(let i=index.get('cf_j_hips');i>=0;i=rig[i].parentIndex)bodyNames.add(rig[i].name);
 function compose(basePose,donorPose,out,config,weight){
  // Pelvis-carrying masks. Limb rotations live in pelvis space, so composing legs or torso from a donor
  // with a differently oriented pelvis needs that pelvis orientation too. The pelvis POSITION always stays
  // the base's: height, travel and floor contact belong to the base pose.
  const pelvisSpec={pelvisTorso:{torso:true},pelvisLegs:{legs:['L','R']},pelvisLeftLeg:{legs:['L']},pelvisRightLeg:{legs:['R']}}[config.mask]||null;
  for(let i=0;i<rig.length;i++){const b=basePose[i],d=donorPose[i],m=out[i],name=rig[i].name;let amount=0;
   for(const side of config.mask==='both'?['L','R']:config.mask==='left'?['L']:config.mask==='right'?['R']:[])if(belongs(i,(config.shoulder===false?'cf_j_arm00_':'cf_j_shoulder_')+side))amount=weight;
   for(const side of config.mask==='legs'?['L','R']:config.mask==='leftLeg'?['L']:config.mask==='rightLeg'?['R']:(pelvisSpec?.legs||[]))if(belongs(i,'cf_j_thigh00_'+side))amount=weight;for(const side of config.mask==='leftKnee'?['L']:config.mask==='rightKnee'?['R']:[])if(belongs(i,'cf_j_leg01_'+side))amount=weight;if(config.mask==='legSpread'&&['cf_j_thigh00_L','cf_j_thigh00_R'].includes(name))amount=weight;
   const spine=['cf_j_spine01','cf_j_spine02','cf_j_spine03'].indexOf(name);if(spine>=0)amount=(config.mask==='torso'||pelvisSpec?.torso)?weight:weight*(config.torso||0)*[.15,.5,1][spine];
   if(config.transferMode==='whole')amount=weight;else if(config.transferMode==='body'&&(bodyNames.has(name)||belongs(i,'cf_j_thigh00_L')||belongs(i,'cf_j_thigh00_R')))amount=weight;
   if(config.animatedOnly&&!animatedBones.has(name))amount=0;
   if(pelvisSpec&&name==='cf_j_hips'){m.p.copy(b.p);m.s.copy(b.s);m.q.copy(b.q).slerp(d.q,weight);continue}
   // Bone offsets always stay the base's: the donor is in its own rest space, and taking its translations
    // stretches or compresses limbs (a thigh grew by 13 cm before this). Only rotation is transferred.
    m.p.copy(b.p);m.s.copy(b.s);
   if(donorIsDelta&&amount>0){const delta=new Quaternion(0,0,0,1).slerp(d.q,amount);m.q.copy(b.q).multiply(delta)}
   else m.q.copy(b.q).slerp(d.q,amount);
   // Independent library context supplies only policy-approved secondary rotations; primary
   // torso, pelvis, legs, translations and scales remain those of this recipe.
   const context=config.libraryCorrection;
   if(context?.rotations?.[name]&&correctionPolicy(config)?.bones.includes(name))m.q.slerp(new Quaternion(...context.rotations[name]).normalize(),weight*MathUtils.clamp(context.strength??1,0,1));
   if(config.fingers==='base'&&/thumb|index|middle|ring|little/i.test(name)){m.p.copy(b.p);m.q.copy(b.q);m.s.copy(b.s)}
  }
 }
 function entryOffset(config){
  if(config.recipe!=='raise'||config.entryMode!=='match')return 0;
  const key=JSON.stringify([config.base,config.basePlayback,config.mask,config.shoulder,config.fingers,config.weight,config.torso,config.blendIn]);if(entryCache.has(key))return entryCache.get(key);
  const hand=index.get('cf_j_hand_R'),position=new Vector3(),reference=new Vector3(),end=bank.clips.raiseIn.duration;
  let chosen=0,found=false;
  // Test the actual blended trajectory, not just its two endpoints: independent
  // quaternion interpolation can bow a wrist downward even if the target is high.
  for(let frame=0;frame<=Math.floor(end*30)&&!found;frame++){
   const offset=frame/30,horizon=Math.max(.45,config.blendIn||0);let valid=true;
   for(let j=0;j<=18;j++){
    const t=horizon*j/18;
    sampleBase(t,probeBase,config);sample(offset+t<=end?'raiseIn':'raiseHold',offset+t<=end?offset+t:(offset+t-end)%bank.clips.raiseHold.duration,probeDonor);
    const weight=(config.weight??1)*(config.blendIn?MathUtils.smoothstep(t,0,config.blendIn):1);
    compose(probeBase,probeDonor,probeMixed,config,weight);fk(probeBase);fk(probeMixed);
    position.setFromMatrixPosition(probeMixed[hand].world);reference.setFromMatrixPosition(probeBase[hand].world);
    if(position.y<reference.y-.003){valid=false;break}
   }
   if(valid){chosen=offset;found=true}
  }
  if(entryCache.size>32)entryCache.delete(entryCache.keys().next().value);entryCache.set(key,chosen);return chosen;
 }
 function exitEnd(config){
  const full=bank.clips.raiseOut.duration;if(config.recipe!=='raise'||config.entryMode!=='match')return full;
  const key=JSON.stringify(config);if(exitCache.has(key))return exitCache.get(key);
  const before=bank.clips.raiseIn.duration-entryOffset(config)+bank.clips.raiseHold.duration*Math.max(1,config.holdLoops||1),hand=index.get('cf_j_hand_R'),position=new Vector3(),reference=new Vector3();let chosen=full;
  // Choose the latest usable end of the donor, evaluating the fade against the
  // base pose at that actual time. Returning through a lowered donor is avoided.
  for(let frame=Math.ceil(full*30);frame>=1;frame--){
   const candidate=Math.min(full,frame/30);let valid=true;
   for(let j=0;j<=40;j++){
    const outTime=candidate*j/40,t=before+outTime;
    sampleBase(t,probeBase,config);sample('raiseOut',outTime,probeDonor);
    const weight=(config.weight??1)*(config.blendOut?1-MathUtils.smoothstep(outTime,candidate-config.blendOut,candidate):1);
    compose(probeBase,probeDonor,probeMixed,config,weight);fk(probeBase);fk(probeMixed);
    position.setFromMatrixPosition(probeMixed[hand].world);reference.setFromMatrixPosition(probeBase[hand].world);
    if(position.y<reference.y-.003){valid=false;break}
   }
   if(valid){chosen=candidate;break}
  }
  if(exitCache.size>32)exitCache.delete(exitCache.keys().next().value);exitCache.set(key,chosen);return chosen;
 }
 function alignment(config){
  if(!['body','whole'].includes(config.transferMode))return null;
  const key=JSON.stringify([config.base,config.donorPlayback,config.donorTime]);if(alignmentCache.has(key))return alignmentCache.get(key);
  sampleBase(0,probeBase,config);sample('custom',config.donorPlayback==='hold'?config.donorTime||0:0,probeDonor);fk(probeBase);fk(probeDonor);
  const p=(pose,n)=>new Vector3().setFromMatrixPosition(pose[index.get(n)].world);
  const rest=makePose();fk(rest);const inverse=rest[index.get('cf_j_hips')].worldQ.clone().invert();
  const forward=p(rest,'cf_j_toes_L').sub(p(rest,'cf_j_foot_L')).add(p(rest,'cf_j_toes_R').sub(p(rest,'cf_j_foot_R'))).normalize();
  const heading=pose=>{const f=forward.clone().applyQuaternion(pose[index.get('cf_j_hips')].worldQ.clone().multiply(inverse));return f.x*f.x+f.z*f.z>1e-6?Math.atan2(f.x,f.z):null};
  const bh=heading(probeBase),dh=heading(probeDonor),rotation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),bh===null||dh===null?0:Math.atan2(Math.sin(bh-dh),Math.cos(bh-dh)));
  const floor=pose=>Math.min(...['cf_j_foot_L','cf_j_foot_R','cf_j_toes_L','cf_j_toes_R','cf_j_hand_L','cf_j_hand_R'].map(n=>p(pose,n).y)),b=p(probeBase,'cf_j_hips'),d=p(probeDonor,'cf_j_hips').applyQuaternion(rotation),offset=new Vector3(b.x-d.x,floor(probeBase)-floor(probeDonor),b.z-d.z);
  const result={rotation,offset};alignmentCache.set(key,result);return result;
 }

 function ground(config){if(floorCache.has(config.base))return floorCache.get(config.base);sampleBase(0,probeBase,config);fk(probeBase);const y=Math.min(...['cf_j_foot_L','cf_j_foot_R','cf_j_toes_L','cf_j_toes_R','cf_j_hand_L','cf_j_hand_R'].map(n=>new Vector3().setFromMatrixPosition(probeBase[index.get(n)].world).y));floorCache.set(config.base,y);return y}
 function evaluate(t,config){const end=duration(config);t=MathUtils.clamp(t,0,end);sampleBase(t,base,config);const source=donorAt(t,config);sample(source.key,source.time,donor);const enter=config.blendIn||0,exit=config.blendOut||0,envelope=(enter?MathUtils.smoothstep(t,0,enter):1)*(exit?1-MathUtils.smoothstep(t,end-exit,end):1),weight=(config.weight??1)*envelope;
  const aligned=alignment(config);if(aligned){donor[0].p.applyQuaternion(aligned.rotation).add(aligned.offset);donor[0].q.premultiply(aligned.rotation)}compose(base,donor,mixed,config,weight);
  fk(base);fk(donor);fk(mixed);let floorLift=0;if(config.floorCorrection&&['body','whole'].includes(config.transferMode)){const names=['cf_j_foot_L','cf_j_foot_R','cf_j_toes_L','cf_j_toes_R','cf_j_hand_L','cf_j_hand_R','cf_j_leg01_L','cf_j_leg01_R','cf_j_head','cf_j_spine03'],lowest=pose=>Math.min(...names.map(n=>new Vector3().setFromMatrixPosition(pose[index.get(n)].world).y)),amount=Math.max(0,Math.min(ground(config),lowest(base))-lowest(mixed));if(amount>0&&amount<=.06){floorLift=amount;mixed[0].p.y+=amount;fk(mixed)}}let legDelta=0;for(const name of ['cf_j_hips','cf_j_thigh00_L','cf_j_thigh00_R','cf_j_leg01_L','cf_j_leg01_R','cf_j_foot_L','cf_j_foot_R']){const i=index.get(name);legDelta=Math.max(legDelta,new Vector3().setFromMatrixPosition(base[i].world).distanceTo(new Vector3().setFromMatrixPosition(mixed[i].world)))}
  return {floorLift,floorY:ground(config),exitTrim:config.recipe==='raise'?bank.clips.raiseOut.duration-exitEnd(config):0,entryOffset:entryOffset(config),base,donor,mixed,weight,phase:source.phase,donorKey:source.key,donorTime:source.time,duration:end,legDelta};
 }
 return {rig,index,base,donor,mixed,entryOffset,exitEnd,evaluate,duration,donorAt,fk,makePose,sample};
}
