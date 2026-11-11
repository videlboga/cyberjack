// Intermediate goals belong to motion planning, not language interpretation.
// Release incompatible elevated legs before acquiring a new support frame.
export function supportPreparation(t,state,stage,origin){
 if(stage.preparationChecked||stage.preparation||stage.semantics?.requiresTrajectory)return null;
 const f=t.features(t.unpack(state.pose)),goals=stage.constraints||[],range=feature=>goals.filter(c=>c.feature===feature).reduce((r,c)=>({min:Math.max(r.min,c.min??-Infinity),max:Math.min(r.max,c.max??Infinity)}),{min:-Infinity,max:Infinity}),knees=['left','right'].every(s=>(range(s+'KneeHeight')?.max??1)<.09),standing=(range('hipHeight')?.min??0)>.45,newSupport=knees||standing;
 // Establish pelvis support before reclining. A single standing-to-supine
 // carrier interpolation rotates a folded pose in mid-air.
 const reclining=range('torsoInclination').min>=60&&range('hipHeight').max<.25;
 if(reclining&&f.hipHeight>.45&&f.torsoInclination<45){
  const a=origin.yaw*Math.PI/180,dx=state.position[0]-origin.position[0],dz=state.position[1]-origin.position[1];
  return {description:'Опуститься на пол с опорой на таз перед тем, как лечь',constraints:[{feature:'hipHeight',min:.03,max:.18},{feature:'torsoInclination',min:0,max:35},...['left','right'].flatMap(side=>[{feature:side+'FootHeight',min:0,max:.10},{feature:side+'Knee',min:30,max:145}])],translation:[Math.cos(a)*dx-Math.sin(a)*dz,Math.sin(a)*dx+Math.cos(a)*dz],yaw:state.yaw-origin.yaw,duration:1.2,semantics:{query:'sit down on floor, pelvis supported, bent knees, relaxed hands',requiresTrajectory:false,motionTerms:[]},preparation:{automatic:true,kind:'pelvis-before-recline',releasePelvis:true,forStage:stage.description},preparationChecked:true};
 }
 // Hands on the floor may coexist with a high pelvis (pike/all fours),
 // so neither pelvis height nor an upright torso can gate this branch.
 const floorHands=['left','right'].every(side=>f[side+'HandHeight']<.16),lowKnees=['left','right'].every(side=>f[side+'KneeHeight']<.16);
 if(standing&&f.torsoInclination>55&&(floorHands||lowKnees)){
  const a=origin.yaw*Math.PI/180,dx=state.position[0]-origin.position[0],dz=state.position[1]-origin.position[1];
  return {description:'Перенести опору с кистей на колени и поднять корпус перед вставанием',constraints:[{feature:'hipHeight',min:.24,max:.44},{feature:'torsoInclination',min:0,max:30},{feature:'kneeSeparation',min:.06,max:.30},...['left','right'].flatMap(side=>[{feature:side+'KneeHeight',min:0,max:.075},{feature:side+'HandHeight',min:.20,max:.65}])],translation:[Math.cos(a)*dx-Math.sin(a)*dz,Math.sin(a)*dx+Math.cos(a)*dz],yaw:state.yaw-origin.yaw,duration:1.2,semantics:{query:'upright kneeling hands released from floor before getting up',requiresTrajectory:false,motionTerms:[]},preparation:{automatic:true,kind:'release-hands-before-rise',forStage:stage.description},preparationChecked:true};
 }
 if(standing&&f.hipHeight<.38&&f.torsoInclination<55){
  // A rise needs a compact support frame. Do not carry extended/elevated
  // legs from a floor pose straight into the standing endpoint.
  const constraints=[{feature:'hipHeight',min:.15,max:.40},{feature:'torsoInclination',min:0,max:80},...['left','right'].flatMap(side=>[{feature:side+'FootHeight',min:0,max:.085},{feature:side+'FootForward',min:-.18,max:.18},{feature:side+'KneeHeight',min:.10,max:.35},{feature:side+'Knee',min:65,max:160}])];
  const a=origin.yaw*Math.PI/180,dx=state.position[0]-origin.position[0],dz=state.position[1]-origin.position[1];
  return {description:'Собрать ноги под корпус и перейти в компактный присед перед подъёмом',constraints,translation:[Math.cos(a)*dx-Math.sin(a)*dz,Math.sin(a)*dx+Math.cos(a)*dz],yaw:state.yaw-origin.yaw,duration:1.2,semantics:{query:'compact crouch squat feet on floor prepare to stand up, unarmed relaxed',requiresTrajectory:false,motionTerms:[]},preparation:{automatic:true,kind:'gather-support-before-rise',releasePelvis:true,forStage:stage.description},preparationChecked:true};
 }
 if(!newSupport||f.hipHeight>.32||f.torsoInclination>55)return null;
 const raised=['left','right'].filter(s=>f[s+'FootHeight']>Math.max(.20,f.hipHeight+.12)&&!((range(s+'FootHeight')?.min??0)>.15));
 if(!raised.length)return null;
 const constraints=[{feature:'hipHeight',min:Math.max(.03,f.hipHeight-.025),max:f.hipHeight+.025},{feature:'torsoInclination',min:Math.max(0,f.torsoInclination-10),max:Math.min(55,f.torsoInclination+10)},{feature:'chestUp',min:Math.max(-1,f.chestUp-.15),max:Math.min(1,f.chestUp+.15)}];
 for(const s of ['left','right'])if(raised.includes(s))constraints.push({feature:s+'FootHeight',min:0,max:.085});else{constraints.push({feature:s+'FootHeight',min:Math.max(0,f[s+'FootHeight']-.035),max:f[s+'FootHeight']+.035});constraints.push({feature:s+'Knee',min:Math.max(0,f[s+'Knee']-18),max:Math.min(165,f[s+'Knee']+18)});}
 const a=origin.yaw*Math.PI/180,dx=state.position[0]-origin.position[0],dz=state.position[1]-origin.position[1];
 return {description:raised.length===2?'Опустить поднятые ноги перед сменой опоры':'Опустить '+(raised[0]==='left'?'левую':'правую')+' ногу перед сменой опоры',constraints,translation:[Math.cos(a)*dx-Math.sin(a)*dz,Math.sin(a)*dx+Math.cos(a)*dz],yaw:state.yaw-origin.yaw,duration:1.2,semantics:{query:'seated lower raised leg to floor, keep pelvis supported, natural relaxed movement',requiresTrajectory:false,motionTerms:[]},preparation:{automatic:true,kind:'release-elevated-legs',sides:raised,forStage:stage.description},preparationChecked:true};
}
