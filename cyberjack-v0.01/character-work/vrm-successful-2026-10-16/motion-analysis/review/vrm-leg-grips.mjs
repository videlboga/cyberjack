import {palmFrame,contactOrientation} from './effector-contact.mjs';
import {Vector3,Quaternion}from'three';
import{solveBoneLeg}from'./vrm-foot-plants.mjs';
const point=n=>n.getWorldPosition(new Vector3());
// Fit knee surface landmarks once; runtime IK uses actual avatar proportions.
export function createVrmLegGrips(vrm){
 const sides={};vrm.scene.updateMatrixWorld(true);
 for(const side of ['left','right']){
  const get=n=>vrm.humanoid.getRawBoneNode(side+n),upper=get('UpperArm'),elbow=get('LowerArm'),hand=get('Hand'),knee=get('LowerLeg'),thigh=get('UpperLeg'),foot=get('Foot');if(!upper||!elbow||!hand||!knee||!thigh||!foot)continue;
  const frame=palmFrame(vrm,side);if(!frame)continue;const {offset,normal}=frame;
  const center=point(knee),radius=point(thigh).distanceTo(center)*.14,samples=[];
  vrm.scene.traverse(mesh=>{if(!mesh.isSkinnedMesh||![].concat(mesh.material||[]).some(m=>/cf_m_body|skin|body/i.test(m.name||'')))return;mesh.skeleton.update();const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;for(let i=0;i<mesh.geometry.attributes.position.count;i+=3){if(indices&&weights){let influence=0;for(let j=0;j<4;j++){const bone=mesh.skeleton.bones[indices.array[i*4+j]];if(bone===knee||bone===thigh)influence+=weights.array[i*4+j];}if(influence<.25)continue;}const p=mesh.getVertexPosition(i,new Vector3()).applyMatrix4(mesh.matrixWorld);if(p.distanceTo(center)<radius*1.7)samples.push(knee.worldToLocal(p));}});
  sides[side]={upper,elbow,hand,knee,foot,offset,normal,frame,samples,radius};
 }
 return {apply(goals=[],weight=1){const measurements=[];for(const [side,s]of Object.entries(sides)){
  if(!goals.some(g=>g.feature===side+'HandKneeDistance')||weight<=0){s.lock=null;continue;}
  const {upper,elbow,hand,knee,foot,offset,normal,samples,radius}=s,center=point(knee),axis=point(foot).sub(center).normalize(),direction=point(upper).sub(center);direction.addScaledVector(axis,-direction.dot(axis));if(direction.lengthSq()<1e-8)direction.copy(point(hand).sub(center));direction.normalize();
  // Acquire once in the knee frame. Per-frame nearest-point and elbow-plane
  // selection can jump branches even for millimetres of idle leg movement.
  if(!s.lock){
   let surface=center.clone().addScaledVector(direction,radius),best=Infinity;
   const wrist=point(hand),reach=point(upper).distanceTo(point(elbow))+point(elbow).distanceTo(wrist);
   for(const local of samples){const candidate=knee.localToWorld(local.clone()),delta=candidate.clone().sub(center),score=candidate.distanceTo(wrist)+Math.abs(delta.dot(axis))*.4+Math.max(0,candidate.distanceTo(point(upper))-reach)*5;if(delta.dot(direction)>0&&score<best){best=score;surface=candidate;}}
   const q=hand.getWorldQuaternion(new Quaternion());
   const orientation=contactOrientation(s.frame,q,direction,Math.PI/3).orientation;
   const bend=point(elbow).sub(point(upper));
   s.lock={surface:knee.worldToLocal(surface.clone()),orientation:knee.getWorldQuaternion(new Quaternion()).invert().multiply(orientation),pole:bend.applyQuaternion(knee.getWorldQuaternion(new Quaternion()).invert())};
  }
  const kneeQ=knee.getWorldQuaternion(new Quaternion()),surface=knee.localToWorld(s.lock.surface.clone()),orientation=kneeQ.clone().multiply(s.lock.orientation),palmOffset=offset.clone().applyQuaternion(orientation),target=surface.clone().sub(palmOffset),nodes=[upper,elbow,hand],before=nodes.map(n=>n.quaternion.clone()),error=solveBoneLeg(upper,elbow,hand,target,orientation,s.lock.pole.clone().applyQuaternion(kneeQ));
  if(error>.03){nodes.forEach((n,i)=>n.quaternion.copy(before[i]));upper.updateWorldMatrix(false,true);measurements.push({side,reached:false,error});continue;}
  const solved=nodes.map(n=>n.quaternion.clone());nodes.forEach((n,i)=>n.quaternion.copy(before[i]).slerp(solved[i],weight));upper.updateWorldMatrix(false,true);const palm=hand.localToWorld(offset.clone());measurements.push({side,reached:palm.distanceTo(surface)<.012,error:palm.distanceTo(surface),surface:surface.toArray(),samples:samples.length});
 }return measurements;}};
}
