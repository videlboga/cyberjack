import * as T from './vendor/three/three.module.js';
import {projectHairCollider,prepareHairCollider} from './ribbon-simple-collider.js?v=91';
const sample=new T.Vector3(),start=new T.Vector3(),end=new T.Vector3(),correction=new T.Vector3();
export function prepareRibbonContacts(shapes){for(const s of shapes)prepareHairCollider(s);return shapes;}
export function sweepRibbonPoint(point,previous,shapes,padding=.006){
 start.copy(previous);end.copy(point);const steps=Math.min(96,Math.max(1,Math.ceil(start.distanceTo(end)/.008)));let hit=false;
 // Follow small increments from the known side instead of projecting only the endpoint.
 for(let i=1;i<=steps;i++){
  sample.copy(end).sub(start).multiplyScalar(1/steps);if(i===1)point.copy(start);point.add(sample);
  for(let pass=0;pass<2;pass++)for(const shape of shapes)hit=projectHairCollider(point,shape,padding)||hit;
 }
 return hit;
}
export function ribbonSegmentContact(a,b,shapes,pinnedA=false,pinnedB=false,padding=.006){
 let hit=false;const steps=Math.min(24,Math.max(2,Math.ceil(a.distanceTo(b)/.018)));
 for(let i=1;i<steps;i++){const t=i/steps;sample.copy(a).lerp(b,t);start.copy(sample);for(const shape of shapes)projectHairCollider(sample,shape,padding);correction.copy(sample).sub(start);if(correction.lengthSq()<1e-14)continue;hit=true;const wa=pinnedA?0:1-t,wb=pinnedB?0:t,denom=wa*(1-t)+wb*t;if(denom){a.addScaledVector(correction,wa/denom);b.addScaledVector(correction,wb/denom);}}
 return hit;
}
