import{decodeAnatomicalFeature,anatomicalPoint}from'../review/anatomical-targets.mjs';
import {solveChain} from './foot-contacts.mjs';
import {Vector3,Quaternion} from 'three';
// Small residual projection on a nearby recorded pose; does not move root, hips or knees.
export function projectForehead(t,pose,constraints){const goal=constraints.find(c=>c.feature==='foreheadHeight'),kneeling=['leftKneeHeight','rightKneeHeight'].every(f=>constraints.some(c=>c.feature===f&&(c.max??1)<=.08));if(!goal||!kneeling||(goal.max??1)>.04)return null;const desired=((goal.min??0)+(goal.max??.015))/2*t.height,initial=t.foreheadPoint(pose).y;if(Math.abs(initial-desired)>t.height*.1)return null;const chain=['head','neck','spine03','spine02','spine01'].map(n=>t.m.index.get('cf_j_'+n)),base=chain.map(i=>pose[i].q.clone());
 for(let iteration=0;iteration<10&&Math.abs(t.foreheadPoint(pose).y-desired)>.002;iteration++)for(let j=0;j<chain.length;j++){const i=chain[j],parent=t.m.rig[i].parentIndex,pivot=new Vector3().setFromMatrixPosition(pose[i].world),p=t.foreheadPoint(pose),target=p.clone();target.y=desired;const a=p.sub(pivot),b=target.sub(pivot);if(a.lengthSq()<1e-8||b.lengthSq()<1e-8)continue;const delta=new Quaternion().setFromUnitVectors(a.normalize(),b.normalize()),angle=delta.angleTo(new Quaternion());if(angle>.1)delta.slerp(new Quaternion(),1-.1/angle);const world=delta.multiply(pose[i].worldQ.clone());pose[i].q.copy(pose[parent].worldQ).invert().multiply(world).normalize();const distance=base[j].angleTo(pose[i].q),limit=.35;if(distance>limit)pose[i].q.copy(base[j]).slerp(pose[i].q.clone(),limit/distance);t.m.fk(pose);}
 return {initialHeight:initial/t.height,finalHeight:t.foreheadPoint(pose).y/t.height,maxJointCorrectionRadians:.35};
}

export function projectHands(t,pose,constraints){const results=[];for(const [side,key]of [['L','left'],['R','right']]){
 const goal=constraints.find(c=>decodeAnatomicalFeature(c.feature)?.side===key||c.feature===key+'HandBetweenThighsDistance'||c.feature===key+'HandButtockDistance');if(!goal)continue;
 const anatomical=decodeAnatomicalFeature(goal.feature),between=/HandBetweenThighsDistance$/.test(goal.feature),target=anatomical?anatomicalPoint(t,pose,anatomical.id,key):between?t.betweenThighsPoint(pose):t.buttockPoint(pose,side),wrist=t.point(pose,'hand_'+side),initial=wrist.distanceTo(target)/t.height;
 // Preserve a recorded contact/near-contact instead of forcing every donor
 // wrist onto an identical point and erasing its natural elbow/wrist pose.
 if((anatomical||between)&&initial<=(between?(goal.max??.07)*.95:Math.min(goal.max??.06,.045))){results.push({side,initialDistance:initial,residualMeters:0,native:true,target:target.toArray()});continue;}
 let desired=target.clone();if(between)desired.addScaledVector(wrist.clone().sub(target).normalize(),t.height*(goal.max??.07)*.75);if(anatomical&&['chest','nipples','belly','face','lips'].includes(anatomical.id)){const anchor=t.point(pose,['face','lips'].includes(anatomical.id)?'head':anatomical.id==='belly'?'spine01':'spine03'),normal=target.clone().sub(anchor).normalize();desired.addScaledVector(normal,t.height*.025);}
 if((anatomical||between)&&wrist.distanceTo(desired)>t.height*.08){results.push({side,initialDistance:initial,unreachableResidual:true,target:target.toArray()});continue;}
 const handIndex=t.m.index.get('cf_j_hand_'+side),wristLocal=pose[handIndex].q.clone(),error=solveChain(t,pose,['arm00','forearm01','hand'].map(n=>'cf_j_'+n+'_'+side),desired);if(between||anatomical){pose[handIndex].q.copy(wristLocal);t.m.fk(pose);}results.push({side,error,initialDistance:initial,residualMeters:wrist.distanceTo(t.point(pose,'hand_'+side)),target:target.toArray()});
 }for(const result of results){const key=result.side==='L'?'left':'right',goal=constraints.find(c=>decodeAnatomicalFeature(c.feature)?.side===key),a=goal&&decodeAnatomicalFeature(goal.feature);if(a&&['belly','chest','nipples'].includes(a.id))result.palmPlane=alignPalmPlane(t,pose,a,key);}return results;}

// Bounded wrist-only fit to the surface plane. Unlike pointing the fingers at
// the target, this keeps the fingers tangent and leaves arm reach untouched.
export function alignPalmPlane(t,pose,a,side){
 const suffix=side==='left'?'L':'R',names=['hand','middle01','index01','ring01'].map(n=>'cf_j_'+n+'_'+suffix),ids=names.map(n=>t.m.index.get(n));if(ids.some(i=>i===undefined))return null;
 const point=i=>new Vector3().setFromMatrixPosition(pose[i].world),[hand,middle,index,ring]=ids.map(point),normal=middle.sub(hand).cross(index.sub(ring));if(normal.lengthSq()<1e-12)return null;normal.normalize();
 const target=anatomicalPoint(t,pose,a.id,side),anchor=t.point(pose,a.id==='belly'?'spine01':'spine03'),surface=target.clone().sub(anchor);if(surface.lengthSq()<1e-10)return null;surface.normalize();if(normal.dot(surface)<0)surface.negate();
 const delta=new Quaternion().setFromUnitVectors(normal,surface),angle=delta.angleTo(new Quaternion()),limit=25*Math.PI/180;if(angle>limit)delta.slerp(new Quaternion(),1-limit/angle);
 const i=ids[0],parent=t.m.rig[i].parentIndex,world=delta.multiply(pose[i].worldQ.clone());pose[i].q.copy(pose[parent].worldQ).invert().multiply(world).normalize();t.m.fk(pose);return{rotationRadians:Math.min(angle,limit),planeErrorBefore:angle,positionUnchanged:true};
}
