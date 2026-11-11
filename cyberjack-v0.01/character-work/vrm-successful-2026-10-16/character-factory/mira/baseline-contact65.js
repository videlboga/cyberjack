import * as T from './vendor/three/three.module.js';
const before=new T.Vector3(),correction=new T.Vector3(),velocity=new T.Vector3(),direction=new T.Vector3();
export function ribbonSurfaceCache(){return {point:new T.Vector3(),normal:new T.Vector3(),triangle:null,distance:Infinity};}

// Swept point against the current surface catches an outside-to-outside
// crossing which an endpoint nearest query cannot see. Body motion itself is
// advanced through the shared interpolated collider steps in the worker.
export function sweepRibbonSurface(q,old,body,margin=.004){
 direction.subVectors(q,old);const length=direction.length();if(length<margin*.5)return false;
 direction.multiplyScalar(1/length);
 const hit=body.intersections(old,direction,length).find(hit=>hit.normal.dot(direction)<-1e-5);
 if(!hit)return false;
 before.copy(q);velocity.subVectors(q,hit.point);
 velocity.addScaledVector(hit.normal,-Math.min(0,velocity.dot(hit.normal)));
 q.copy(hit.point).add(velocity).addScaledVector(hit.normal,margin);
 correction.subVectors(q,before);old.add(correction);
 velocity.subVectors(q,old);const inward=velocity.dot(hit.normal);
 if(inward<0)old.addScaledVector(hit.normal,inward);
 return true;
}

// Body vertices are refitted once per pose, shared by every ribbon. Cached
// triangles seed exact BVH searches; they never exclude other nearby faces.
export function projectRibbonSurface(q,old,body,cache,margin=.004,queryRadius=0){
 const range=Math.max(queryRadius,cache.initialized?margin+.006+q.distanceTo(old)+(cache.revision===body.revision?0:body.maxDisplacement):Infinity);
 cache.revision=body.revision;cache.initialized=true;
 if(!body.nearestInto(q,cache,cache.triangle,range))return false;
 const movement=q.distanceTo(old);
 if(body.allowSweep&&cache.distance<movement+margin&&sweepRibbonSurface(q,old,body,margin)){
  body.nearestInto(q,cache,cache.triangle,Infinity);
 }
 if(cache.signedDistance>=margin-.0002)return false;
 before.copy(q);q.copy(cache.point).addScaledVector(cache.normal,margin);
 correction.subVectors(q,before);old.add(correction);
 velocity.subVectors(q,old);const vn=velocity.dot(cache.normal);
 if(vn<0)old.addScaledVector(cache.normal,vn);
 velocity.subVectors(q,old);old.addScaledVector(velocity,.06);
 return true;
}
export function projectRibbonSurfaceEdge(a,b,oldA,oldB,body,cache,pinA,pinB,margin=.004,nearSurface=false){
 if(!nearSurface){direction.subVectors(b,a);const length=direction.length();if(length<1e-8||!body.intersections(a,direction.multiplyScalar(1/length),length).length)return false;}
 const hit=body.segmentContact(a,b,margin,cache);if(!hit)return false;
 const wa=pinA?0:1-hit.t,wb=pinB?0:hit.t,den=wa*(1-hit.t)+wb*hit.t;if(den<1e-8)return false;
 correction.copy(hit.normal).multiplyScalar(hit.depth/den);
 a.addScaledVector(correction,wa);b.addScaledVector(correction,wb);
 oldA.addScaledVector(correction,wa);oldB.addScaledVector(correction,wb);return true;
}
