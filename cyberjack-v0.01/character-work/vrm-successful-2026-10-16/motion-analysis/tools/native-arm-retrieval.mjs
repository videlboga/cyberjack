import {readRetrievalStore,writeRetrievalStore} from './retrieval-store.mjs';
import{Vector3}from'three';import{decodeAnatomicalFeature,anatomicalPoint}from'../review/anatomical-targets.mjs';
function basis(chest,head,left,right){const up=head.clone().sub(chest).normalize(),across=left.clone().sub(right);across.addScaledVector(up,-across.dot(up)).normalize();return{up,across,forward:across.clone().cross(up).normalize()};}
const local=(v,b)=>[v.dot(b.across),v.dot(b.up),v.dot(b.forward)];
const preparedRows=new WeakMap();
export function prepareNativeArmRows(rows,{persistent=false}={}){let cached=preparedRows.get(rows);if(cached)return cached;if(persistent&&rows.length>1000){cached=readRetrievalStore('hands',rows.length);if(cached){preparedRows.set(rows,cached);return cached;}}const hands=new Float64Array(rows.length*6);for(let i=0;i<rows.length;i++){const d=rows[i].descriptor,point=(a,j)=>new Vector3(...a.slice(j,j+3)),chest=point(d.torso,0),b=basis(chest,point(d.torso,3),point(d.legs,0),point(d.legs,12));for(let side=0;side<2;side++)hands.set(local(point(d.hands,side*3).sub(chest),b),i*6+side*3);}const groups=new Map();for(let i=0;i<rows.length;i++){let indices=groups.get(rows[i].id);if(!indices){indices=[];groups.set(rows[i].id,indices);}indices.push(i);}cached={hands,groups};if(persistent&&rows.length>1000)writeRetrievalStore('hands',rows.length,cached);preparedRows.set(rows,cached);return cached;}

export function nativeArmRanking(t,current,stage,rows,penalty,limit=140){
 if(!stage.armOnly)return null;const goals=[];for(const c of stage.constraints){const a=decodeAnatomicalFeature(c.feature),side=a?.side||(/^(left|right)HandBetweenThighsDistance$/.exec(c.feature)?.[1]);if(!side)continue;const target=a?anatomicalPoint(t,current,a.id,side):t.betweenThighsPoint(current);if(target)goals.push({side,target});}if(!goals.length)return null;
 const chest=t.point(current,'spine03'),frame=basis(chest,t.point(current,'head'),t.point(current,'thigh00_L'),t.point(current,'thigh00_R'));for(const g of goals)g.local=local(g.target.clone().sub(chest).divideScalar(t.height),frame);
 const {hands,groups}=prepareNativeArmRows(rows),best=[];
 for(const [id,indices]of groups){const sem=penalty(id,false);if(sem.excluded)continue;let chosen,score=Infinity,nativeDistance;
  for(const ri of indices){let distance=0;for(const g of goals){const offset=ri*6+(g.side==='left'?0:3);for(let i=0;i<3;i++)distance+=(hands[offset+i]-g.local[i])**2;}distance=Math.sqrt(distance/goals.length);const next=distance*30+sem.cost*.04;if(next<score){chosen=rows[ri];score=next;nativeDistance=distance;}}
  if(chosen)best.push({r:chosen,score,nativeDistance});
 }
 return best.sort((a,b)=>a.score-b.score).slice(0,limit);
}
export function rawHandGoalError(t,p,constraints){t.m.fk(p);let worst=0;for(const c of constraints){const a=decodeAnatomicalFeature(c.feature),between=/^(left|right)HandBetweenThighsDistance$/.exec(c.feature);if(!a&&!between)continue;const side=a?.side||between[1],target=a?anatomicalPoint(t,p,a.id,side):t.betweenThighsPoint(p);worst=Math.max(worst,target?t.point(p,'hand_'+(side==='left'?'L':'R')).distanceTo(target)/t.height:1);}return worst;}

// Diagnostic only. Finger direction toward a target is not a contact normal:
// a palm resting on a surface needs tangent fingers. Do not rank by this cost
// until a calibrated palm basis and target surface normal are available.
export function nativePalmCost(t,pose,constraints){
 let cost=0;const details=[];
 for(const c of constraints){const a=decodeAnatomicalFeature(c.feature),side=a?.side||(/^(left|right)HandBetweenThighsDistance$/.exec(c.feature)?.[1]);if(!side)continue;
 const suffix=side==='left'?'L':'R',hand=t.m.index.get('cf_j_hand_'+suffix),middle=t.m.index.get('cf_j_middle01_'+suffix);if(hand===undefined||middle===undefined)continue;
 const target=a?anatomicalPoint(t,pose,a.id,side):t.betweenThighsPoint(pose);if(!target)continue;
 const wrist=new Vector3().setFromMatrixPosition(pose[hand].world),knuckle=new Vector3().setFromMatrixPosition(pose[middle].world),palm=wrist.clone().lerp(knuckle,.55),distance=palm.distanceTo(target)/t.height;
 const reach=target.clone().sub(wrist),fingers=knuckle.clone().sub(wrist),away=reach.length()>t.height*.015?Math.max(0,-fingers.normalize().dot(reach.normalize())):0;
 cost+=distance*20+away*.8;details.push({side,palmDistance:distance,fingersAway:away});
 }return {cost,details};
}
