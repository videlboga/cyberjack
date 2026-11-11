import{Quaternion,Vector3}from'three';
import{projectArmRotation}from'./vrm-arm-limits.mjs';
const rad=Math.PI/180,point=n=>n.getWorldPosition(new Vector3());
export function createVrmLegLimits(vrm,t){
 const get=n=>vrm.humanoid.getRawBoneNode(n),rules=[],rest=t.m.makePose();t.m.fk(rest);vrm.scene.updateMatrixWorld(true);
 for(const side of ['left','right']){
  const suffix=side==='left'?'L':'R',knee=get(side+'LowerLeg'),foot=get(side+'Foot'),toe=get(side+'Toes'),h=t.jointLimits().hinges.find(h=>h.name==='cf_j_leg01_'+suffix);if(!knee||!foot)continue;
  if(h){const source=rest[h.j].worldQ,mirror=new Quaternion(source.x,-source.y,-source.z,source.w),axis=new Vector3(h.axis.x,-h.axis.y,-h.axis.z).applyQuaternion(mirror).applyQuaternion(knee.getWorldQuaternion(new Quaternion()).invert()).normalize();rules.push({name:side+'LowerLeg',node:knee,rest:knee.quaternion.clone(),axis,min:-2*rad,max:165*rad,swing:12*rad});}
  if(toe){const forward=foot.worldToLocal(point(toe)).normalize(),up=new Vector3(0,1,0).applyQuaternion(foot.getWorldQuaternion(new Quaternion()).invert()),axis=forward.clone().cross(up).normalize();if(axis.lengthSq()>.5){rules.push({name:side+'Foot',node:foot,rest:foot.quaternion.clone(),axis,min:-60*rad,max:35*rad,swing:20*rad});const toeAxis=axis.clone().applyQuaternion(foot.getWorldQuaternion(new Quaternion())).applyQuaternion(toe.getWorldQuaternion(new Quaternion()).invert());rules.push({name:side+'Toes',node:toe,rest:toe.quaternion.clone(),axis:toeAxis,min:-30*rad,max:60*rad,swing:10*rad});}}
 }
 return {rules,apply(support){const before=Object.fromEntries(['left','right'].map(side=>[side,get(side+'Foot')?point(get(side+'Foot')):null])),reports=[];
  for(const rule of rules){const q=rule.node.quaternion.clone(),limited=projectArmRotation(q,rule);rule.node.quaternion.copy(limited);reports.push({joint:rule.name,correction:q.angleTo(limited),limited:q.angleTo(limited)>1e-5});}vrm.scene.updateMatrixWorld(true);
  const contactErrors=[];for(const side of ['left','right']){const foot=get(side+'Foot'),knee=get(side+'LowerLeg'),upper=get(side+'UpperLeg');if(!foot||!upper||!before[side])continue;const suffix=side==='left'?'L':'R',contacts=(support?.contacts||[]).filter(c=>c.normalNewtons>1),grounded=contacts.some(c=>/foot|sole|toe/i.test(c.id||'')&&(c.id.endsWith(suffix)||c.joint?.endsWith(suffix))),kneeling=contacts.some(c=>/knee|shin/i.test(c.id||'')&&(c.id.endsWith(suffix)||c.joint?.endsWith(suffix)));
   // Preserve a planted foot direction using the hip, never lift the whole avatar.
   if(grounded&&!kneeling){const origin=point(upper),desired=before[side].clone().sub(origin),current=point(foot).sub(origin),orientation=foot.getWorldQuaternion(new Quaternion()),delta=new Quaternion().setFromUnitVectors(current.normalize(),desired.normalize()),world=delta.multiply(upper.getWorldQuaternion(new Quaternion()));upper.quaternion.copy(upper.parent.getWorldQuaternion(new Quaternion()).invert().multiply(world));upper.updateWorldMatrix(false,true);foot.quaternion.copy(foot.parent.getWorldQuaternion(new Quaternion()).invert().multiply(orientation));for(const rule of rules.filter(r=>r.name.startsWith(side)&&r.node!==knee))rule.node.quaternion.copy(projectArmRotation(rule.node.quaternion,rule));vrm.scene.updateMatrixWorld(true);}
   contactErrors.push({side,planted:grounded&&!kneeling,footShift:point(foot).distanceTo(before[side])});
  }
  vrm.scene.userData.legLimitDiagnostics={joints:reports,contacts:contactErrors};return {joints:reports,contacts:contactErrors};
 }};
}
