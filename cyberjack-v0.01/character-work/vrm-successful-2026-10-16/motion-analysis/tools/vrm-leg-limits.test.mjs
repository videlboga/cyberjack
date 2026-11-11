import assert from'node:assert/strict';import{Quaternion,Vector3}from'three';import{projectArmRotation}from'../review/vrm-arm-limits.mjs';
const rad=Math.PI/180,axis=new Vector3(1,0,0),knee={rest:new Quaternion(),axis,min:-2*rad,max:165*rad,swing:12*rad},ankle={...knee,min:-60*rad,max:35*rad,swing:20*rad};
for(const rule of [knee,ankle])for(const a of [-175,-90,-15,0,25,90,175]){
 const q=projectArmRotation(new Quaternion().setFromAxisAngle(axis,a*rad),rule),expected=new Quaternion().setFromAxisAngle(axis,Math.max(rule.min,Math.min(rule.max,a*rad)));assert(q.angleTo(expected)<1e-6);assert(q.angleTo(projectArmRotation(q,rule))<1e-6);
}
for(const rule of [knee,ankle]){const q=projectArmRotation(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),90*rad),rule);assert(q.angleTo(new Quaternion())<=rule.swing+1e-6);}
console.log('PASS knee reverse/hyperflexion, ankle pitch and lateral limits, exact idempotence');
