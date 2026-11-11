const arm=s=>['shoulder','arm00','forearm01','hand'].map(n=>'cf_j_'+n+'_'+s),head=['cf_j_neck','cf_j_head'];
export function correctionPolicy(config){
 if(config.recipe!=='custom'||config.transferMode==='whole')return null;
 const m=config.mask;if(m==='torso')return {bones:[...arm('L'),...arm('R')],parts:'обе руки',sides:['L','R'],head:false};
 if(m==='left'||m==='right')return {bones:[...arm(m==='left'?'R':'L'),...head],parts:(m==='left'?'правая':'левая')+' рука, шея и голова',sides:[m==='left'?'R':'L'],head:true};
 if(m==='both')return {bones:head,parts:'шея и голова',sides:[],head:true};
 if(['legs','legSpread','leftLeg','rightLeg','leftKnee','rightKnee'].includes(m))return {bones:[...arm('L'),...arm('R'),...head],parts:'обе руки, шея и голова',sides:['L','R'],head:true};
 return null;
}
