import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {nativeArmRanking} from './native-arm-retrieval.mjs';
const point=(a,j)=>new Vector3(...a.slice(j,j+3));
function frame(chest,head,left,right){const up=head.clone().sub(chest).normalize(),across=left.clone().sub(right);across.addScaledVector(up,-across.dot(up)).normalize();return {up,across,forward:across.clone().cross(up).normalize()};}
const local=(v,b)=>[v.dot(b.across),v.dot(b.up),v.dot(b.forward)];
const positions={spine03:new Vector3(0,1,0),head:new Vector3(0,1.4,0),thigh00_L:new Vector3(.1,.7,0),thigh00_R:new Vector3(-.1,.7,0)};
const t={height:2,point:(_,name)=>positions[name].clone(),betweenThighsPoint:()=>new Vector3(0,.7,.1)};
const rows=Array.from({length:360},(_,i)=>({id:String(i%43),time:i,descriptor:{torso:[0,.5,0,0,.7,.01],legs:[.1,.3,0,0,0,0,0,0,0,0,0,0,-.1,.3,0],hands:[Math.sin(i)*.2,.4+Math.cos(i)*.2,.1,Math.cos(i)*.2,.4+Math.sin(i)*.2,.1]}}));
const penalty=id=>({cost:Number(id)%9,excluded:Number(id)%11===0});
for(const sides of [['left'],['right'],['left','right']]){
 const stage={armOnly:{sides},constraints:sides.map(s=>({feature:s+'HandBetweenThighsDistance',max:.06}))};
 const chest=t.point(null,'spine03'),b=frame(chest,t.point(null,'head'),t.point(null,'thigh00_L'),t.point(null,'thigh00_R')),goal=local(t.betweenThighsPoint().sub(chest).divideScalar(t.height),b),best=new Map();
 for(const r of rows){const sem=penalty(r.id);if(sem.excluded)continue;const d=r.descriptor,c=point(d.torso,0),f=frame(c,point(d.torso,3),point(d.legs,0),point(d.legs,12));let distance=0;for(const side of sides){const v=local(point(d.hands,side==='left'?0:3).sub(c),f);for(let i=0;i<3;i++)distance+=(v[i]-goal[i])**2;}distance=Math.sqrt(distance/sides.length);const score=distance*30+sem.cost*.04;if(!best.has(r.id)||score<best.get(r.id).score)best.set(r.id,{r,score,nativeDistance:distance});}
 assert.deepEqual(nativeArmRanking(t,null,stage,rows,penalty),[...best.values()].sort((a,b)=>a.score-b.score));
}
console.log('PASS grouped ranking matches reference IDs, frames, scores and stable order for one or both hands');
