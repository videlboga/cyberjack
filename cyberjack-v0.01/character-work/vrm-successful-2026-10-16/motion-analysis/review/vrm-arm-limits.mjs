import{Quaternion,Vector3}from'three';
const rad=Math.PI/180,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function split(q,axis){q=q.clone().normalize();if(q.w<0)q.set(-q.x,-q.y,-q.z,-q.w);const d=new Vector3(q.x,q.y,q.z).dot(axis),n=Math.hypot(d,q.w),twist=n<1e-8?new Quaternion():new Quaternion(axis.x*d/n,axis.y*d/n,axis.z*d/n,q.w/n);return{swing:q.clone().multiply(twist.clone().invert()),angle:2*Math.atan2(new Vector3(twist.x,twist.y,twist.z).dot(axis),twist.w)};}
function cap(q,max){const a=q.angleTo(new Quaternion());return a>max?new Quaternion().slerp(q,max/a):q;}
export function projectArmRotation(rotation,rule){
 const q=rule.rest.clone().invert().multiply(rotation);if(rule.kind==='elbow'){const roll=split(q,rule.rollAxis),bend=split(roll.swing,rule.axis).angle;const swing=bend<rule.min?new Quaternion().setFromAxisAngle(rule.axis,rule.min):cap(roll.swing,rule.max);return rule.rest.clone().multiply(swing).multiply(new Quaternion().setFromAxisAngle(rule.rollAxis,clamp(roll.angle,-90*rad,90*rad))).normalize();}const {swing,angle}=split(q,rule.axis),limited=clamp(angle,rule.min,rule.max);
 return rule.rest.clone().multiply(cap(swing,rule.swing)).multiply(new Quaternion().setFromAxisAngle(rule.axis,limited)).normalize();
}
export function createVrmArmLimits(vrm,t){
 const get=n=>vrm.humanoid.getRawBoneNode(n),rules=[],rest=t.m.makePose();t.m.fk(rest);vrm.scene.updateMatrixWorld(true);
 for(const side of ['left','right']){
  const suffix=side==='left'?'L':'R',upper=get(side+'UpperArm'),elbow=get(side+'LowerArm'),hand=get(side+'Hand');if(!upper||!elbow||!hand)continue;
  const world=n=>n.getWorldPosition(new Vector3()),axis=(a,b)=>a.worldToLocal(world(b)).normalize();
  rules.push({name:side+'UpperArm',node:upper,rest:upper.quaternion.clone(),axis:axis(upper,elbow),min:-90*rad,max:90*rad,swing:175*rad});
  const h=t.jointLimits().hinges.find(h=>h.name==='cf_j_forearm01_'+suffix);
  if(h){const source=rest[h.j].worldQ,q=new Quaternion(source.x,-source.y,-source.z,source.w),hinge=new Vector3(h.axis.x,-h.axis.y,-h.axis.z).applyQuaternion(q).applyQuaternion(elbow.getWorldQuaternion(new Quaternion()).invert()).normalize();
   // Hinge swing is the main bend; axial rotation distributes pronation along the forearm.
   rules.push({name:side+'LowerArm',kind:'elbow',rollAxis:axis(elbow,hand),node:elbow,rest:elbow.quaternion.clone(),axis:hinge,min:-3*rad,max:155*rad,swing:90*rad});
  }
  const middle=get(side+'MiddleProximal');if(middle)rules.push({name:side+'Hand',node:hand,rest:hand.quaternion.clone(),axis:axis(hand,middle),min:-35*rad,max:35*rad,swing:65*rad});
 }
 return {rules,apply(side,local=false){const reports=[];for(const rule of rules){if(side&&!rule.name.startsWith(side))continue;const before=rule.node.quaternion.clone(),after=projectArmRotation(before,rule);rule.node.quaternion.copy(after);reports.push({joint:rule.name,correction:before.angleTo(after),limited:before.angleTo(after)>1e-5});}updateArmLimitWorld(vrm,rules,side,local);vrm.scene.userData.armLimitDiagnostics=reports;return reports;}};
}

// Contact trials only mutate this arm. The rest of the avatar was already
// updated by retargeting; avoid traversing all hair/face/body bones per trial.
export function updateArmLimitWorld(vrm,rules,side,local=false){const root=local&&side?rules.find(r=>r.name===side+'UpperArm')?.node:null;if(root)root.updateWorldMatrix(true,true);else vrm.scene.updateMatrixWorld(true);}
