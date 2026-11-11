// A limb-spacing edit must not silently choose a different support posture.
export function preserveSupportForSpacing(t,state,stage){
 const goals=stage.constraints||[],spacing=goals.some(c=>c.feature==='kneeSeparation'||/Spread$|FootLateral$/.test(c.feature));
 if(!spacing||stage.support||stage.semantics?.requiresTrajectory||goals.some(c=>c.feature==='hipHeight'||/KneeHeight$|FootHeight$|Knee$/.test(c.feature)))return stage;
 const f=t.features(t.unpack(state.pose)),standing=f.hipHeight>.48&&Math.max(f.leftKnee,f.rightKnee)<55&&Math.max(f.leftFootHeight,f.rightFootHeight)<.055;
 if(!standing)return stage;
 const constraints=[...goals,{feature:'hipHeight',min:Math.max(.48,f.hipHeight-.10),max:f.hipHeight+.04},...['left','right'].flatMap(side=>[{feature:side+'Knee',min:0,max:Math.min(65,Math.max(40,f[side+'Knee']+18))},{feature:side+'FootHeight',min:0,max:.045}])];
 return {...stage,constraints,supportPreservation:{kind:'standing-spacing-edit',sourceHipHeight:f.hipHeight}};
}
