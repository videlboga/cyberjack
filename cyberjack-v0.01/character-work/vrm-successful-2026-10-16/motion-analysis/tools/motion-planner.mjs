export function planMotion(capabilities,request){
 const mapping=capabilities.commandContract.mapping.find(m=>m.coreActionId===request.coreActionId),goalId=request.goalId||mapping?.goalId;
 if(request.coreActionId&&!mapping)return {status:'unmapped',execute:false,reason:'Unknown core action; explicit goal does not override it'};
 if(request.goalId&&mapping&&mapping.goalId!==request.goalId)return {status:'rejected',reason:'Core action and requested geometric goal disagree',execute:false};
 if(!goalId)return {status:'unmapped',execute:false,reason:'No geometric goal for this core context'};
 const goal=capabilities.goals.find(g=>g.id===goalId);if(!goal)return {status:'needs-measurement',goalId,execute:false,reason:'Required geometric feature is not indexed'};
 const armGoal=goalId.startsWith('arms.'),blocked=request.blockedParts||[];
 if(armGoal&&blocked.some(p=>['arms','hands'].includes(p)))return {status:'blocked',goalId,execute:false,reason:'The caller reports support or fixation of the arms'};
 const bases={sitting:'e0259d6f372c87b464608b2c',standing:'d82833280717194afd3bde21',lying:'227af670e6cbaa32bf59d276'},baseId=bases[request.base]||request.base;
 const reviewed=capabilities.reviewedRecipes.filter(r=>r.goalId===goalId&&r.scope.baseSourceId===baseId&&r.scope.avatar.toLowerCase()===String(request.avatar||'').toLowerCase());
 return {status:reviewed.length?'reviewed-recipe':'candidates-only',goalId,coreActionId:goal.coreActionId,execute:false,reviewedRecipes:reviewed,candidates:goal.candidates.filter(c=>c.rig!=='male').slice(0,20),requiredBeforeGame:['core compliance and constraint check','current base/avatar match','reviewed transition and mask'],reason:reviewed.length?'A recipe has been visually reviewed for this exact base/avatar; this endpoint is a dry run.':'Geometry proposes sources; compatibility has not been confirmed.'};
}
