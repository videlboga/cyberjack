import{constraintScore}from'../review/command-pose.mjs';
export function armOnlyEdit(t,state,stage){
 const goals=stage.constraints||[],arms=goals.filter(c=>/^(left|right)(Hand|Arm|Elbow)/.test(c.feature));
 if(!arms.length||stage.support||stage.semantics?.requiresTrajectory||stage.translation?.some(Boolean)||stage.yaw)return stage;
 const f=t.features(t.unpack(state.pose));if(goals.some(c=>!arms.includes(c)&&constraintScore(f,[c]).worst>.12))return stage;
 const sides=['left','right'].filter(side=>arms.some(c=>c.feature.startsWith(side)));
 return {...stage,armOnly:{sides,preserve:'all unrequested bones, pelvis, legs and torso'}};
}
export function restoreUnrequestedBones(t,pose,base,policy){
 if(!policy)return pose;const selected=policy.roots||policy.sides.map(s=>'cf_j_shoulder_'+(s==='left'?'L':'R'));
 for(let i=0;i<pose.length;i++){let free=false;for(let j=i;j>=0;j=t.m.rig[j].parentIndex)if(selected.includes(t.m.rig[j].name))free=true;if(!free)for(const k of ['p','q','s'])pose[i][k].copy(base[i][k]);}t.m.fk(pose);return pose;
}
export function armOnlyTrajectory(t,state,step){
 const from=t.unpack(state.pose),to=t.unpack(step.pose),duration=Math.max(.65,Math.min(1.5,step.duration||1)),count=Math.ceil(duration*30),frames=[];
 for(let i=0;i<=count;i++){const u=i/count,w=u*u*u*(u*(u*6-15)+10),p=t.interpolate(from,to,w);restoreUnrequestedBones(t,p,from,step.armOnly);frames.push(p.map(n=>({p:n.p.toArray(),q:n.q.toArray(),s:n.s.toArray()})));}
 return {...step,duration,motion:{frames,duration,noMargins:true,directPlayback:true,loop:false,source:{name:'Локальное движение руки · остальная поза сохранена'}},transition:step.armOnly.sides.length===1?'Локальный переход с сохранением таза, ног и второй руки':'Локальный переход рук с сохранением таза, ног и корпуса'};
}

export function legOnlyEdit(t,state,stage){
 if(stage.support||stage.preparation||stage.semantics?.requiresTrajectory||stage.translation?.some(Boolean)||stage.yaw)return stage;
 const text=stage.description||'',left=stage.semantics?.localLegSides?.length===1?stage.semantics.localLegSides[0]==='left':/лев[а-яё]*\s+но[гж]/iu.test(text),right=stage.semantics?.localLegSides?.length===1?stage.semantics.localLegSides[0]==='right':/прав[а-яё]*\s+но[гж]/iu.test(text);
 if(left===right||/встать|сесть|лечь|перевер|на\s+колени|на\s+четвер/iu.test(text))return stage;
 const side=left?'left':'right',other=left?'right':'left',f=t.features(t.unpack(state.pose));
 const goals=stage.constraints||[];if(!goals.some(c=>/Knee|Foot|Spread|Forward|kneeSeparation/.test(c.feature)))return stage;
 // Current support and trunk limits describe preservation, not new posture goals.
 if(/рук|кист|корпус|торс|голов|наклон/iu.test(text)&&goals.some(c=>!c.feature.startsWith(side)&&c.feature!=='kneeSeparation'&&constraintScore(f,[c]).worst>.12))return stage;
 // A language-supplied torso range must not turn an isolated leg request into
 // a whole-body replacement. The exact unchanged chains are the contract.
 const constraints=goals.filter(c=>c.feature.startsWith(side)&&!/(Hand|Arm|Elbow)/.test(c.feature));
 if(!/сог|сгиб|колен/iu.test(text)&&!constraints.some(c=>c.feature===side+'Knee')){const held=(state.constraints||[]).find(c=>c.feature===side+'Knee');if(held)constraints.push({...held});}
 if(/в\s+сторон|разве|отве/iu.test(text)&&!constraints.some(c=>c.feature===side+'FootLateral'))constraints.push({feature:side+'FootLateral',min:Math.max(.18,f[side+'FootLateral']+.08),max:.65});
 return {...stage,constraints,legOnly:{sides:[side],roots:['cf_j_thigh00_'+(left?'L':'R')],preserve:'pelvis, torso, arms and '+other+' leg'}};
}
