import assert from'node:assert/strict';import{Quaternion,Vector3}from'three';import{projectArmRotation}from'../review/vrm-arm-limits.mjs';
const rad=Math.PI/180,axis=new Vector3(1,0,0),rule={rest:new Quaternion(),axis,min:-90*rad,max:90*rad,swing:175*rad};
for(const angle of [-179,-120,0,120,179]){const q=projectArmRotation(new Quaternion().setFromAxisAngle(axis,angle*rad),rule);assert(q.angleTo(new Quaternion())<=90*rad+1e-6);assert(q.angleTo(projectArmRotation(q,rule))<1e-6);}
const elbow={...rule,kind:'elbow',rollAxis:new Vector3(0,1,0),min:-3*rad,max:155*rad};
for(const bend of [-80,40,179])for(const roll of [-170,0,170]){const q=new Quaternion().setFromAxisAngle(axis,bend*rad).multiply(new Quaternion().setFromAxisAngle(elbow.rollAxis,roll*rad)),out=projectArmRotation(q,elbow),expected=new Quaternion().setFromAxisAngle(axis,Math.max(-3,Math.min(155,bend))*rad).multiply(new Quaternion().setFromAxisAngle(elbow.rollAxis,Math.max(-90,Math.min(90,roll))*rad));assert(out.angleTo(expected)<1e-6);assert(out.angleTo(projectArmRotation(out,elbow))<1e-6);}
console.log('PASS shoulder twist bound, elbow hinge/roll bounds, no reverse bend, projection idempotent');
