import * as T from './vendor/three/three.module.js';
import {MeshSurfaceCollider} from './mesh-surface-collider-candidate.js';
// Preserve the exterior route of posterior locks across the body-owned neck
// root. Nearest-face projection alone can select the anterior exit after a slip.
export function createRibbonNeckBarrier(initial,indices,region){
 if(!region?.root?.length||!region?.top?.length)return null;
 const point=new T.Vector3(),root=new T.Vector3(),top=new T.Vector3(),axis=new T.Vector3(),back=new T.Vector3(),side=new T.Vector3(),radial=new T.Vector3(),origin=new T.Vector3(),direction=new T.Vector3();
 const mean=(ids,positions,out)=>{out.set(0,0,0);for(const id of ids)out.add(point.fromArray(positions,id*3));return out.multiplyScalar(1/ids.length);};
 mean(region.root,initial,root);mean(region.top,initial,top);axis.subVectors(top,root).normalize();
 const ordered=[...region.root].sort((a,b)=>initial[a*3+2]-initial[b*3+2]),count=Math.max(3,Math.ceil(ordered.length/8)),rear=ordered.slice(0,count),front=ordered.slice(-count);
 const patch=[],used=new Set(),triangle=new T.Triangle(),normal=new T.Vector3();
 for(let i=0;i<indices.length;i+=3){const ids=[indices[i],indices[i+1],indices[i+2]];radial.set(0,0,0);for(const id of ids)radial.add(point.fromArray(initial,id*3));radial.multiplyScalar(1/3).sub(root);const h=radial.dot(axis);radial.addScaledVector(axis,-h);if(h<-.32||h>root.distanceTo(top)+.025||radial.length()>.30||Math.abs(radial.x)>.105)continue;triangle.a.fromArray(initial,ids[0]*3);triangle.b.fromArray(initial,ids[1]*3);triangle.c.fromArray(initial,ids[2]*3);if(triangle.getNormal(normal).z>-.05)continue;patch.push(...ids);for(const id of ids)used.add(id);}
 const ids=[...used],map=new Map(ids.map((id,i)=>[id,i])),localIndex=Uint32Array.from(patch,id=>map.get(id)),positions=new Float32Array(ids.length*3),surface=new MeshSurfaceCollider();let span=0;
 const closest={point:new T.Vector3(),normal:new T.Vector3(),triangle:null},shift=new T.Vector3(),rowShift=new T.Vector3();
 function correction(q,margin){
  shift.set(0,0,0);radial.subVectors(q,root);const h=radial.dot(axis);if(h<-.30||h>span+.015)return shift;
  const width=h<0?.10+Math.min(.18,-h*.8):.10;if(Math.abs(radial.dot(side))>width||radial.dot(back)>.17||radial.dot(back)<-.20)return shift;
  origin.copy(q).addScaledVector(back,.06);if(!surface.nearestInto(origin,closest,closest.triangle,.25)||closest.normal.dot(back)<.05)return shift;const signed=radial.subVectors(q,closest.point).dot(closest.normal);if(signed>=margin)return shift;
  return shift.copy(closest.point).addScaledVector(closest.normal,margin).sub(q).multiplyScalar(T.MathUtils.smoothstep(h,-.30,-.14));
 }
 const api={owns(q){
  radial.subVectors(q,root);const h=radial.dot(axis);
  if(h<-.14||h>span+.015||Math.abs(radial.dot(side))>.10+Math.max(0,-h*.8)||radial.dot(back)>.17||radial.dot(back)<-.20)return false;
  origin.copy(q).addScaledVector(back,.06);
  return surface.nearestInto(origin,closest,closest.triangle,.25)&&closest.normal.dot(back)>.05;
 },update(source){
  mean(region.root,source,root);mean(region.top,source,top);axis.subVectors(top,root);span=axis.length();axis.normalize();
  const rearPoint=mean(rear,source,back).clone(),frontPoint=mean(front,source,top);back.subVectors(rearPoint,frontPoint);back.addScaledVector(axis,-back.dot(axis)).normalize();side.crossVectors(axis,back).normalize();
  for(let i=0;i<ids.length;i++)for(let k=0;k<3;k++)positions[i*3+k]=source[ids[i]*3+k];surface.update(positions,localIndex);
 },project(q,old,margin=.006){
  const delta=correction(q,margin);if(delta.lengthSq()<1e-14)return false;q.add(delta);old.add(delta);return true;
 },projectRow(points,previous,offset,count=5,margin=.006){
  rowShift.set(0,0,0);for(let c=0;c<count;c++){const delta=correction(points[offset+c],margin);if(delta.lengthSq()>rowShift.lengthSq())rowShift.copy(delta);}if(rowShift.lengthSq()<1e-14)return false;
  for(let c=0;c<count;c++){points[offset+c].add(rowShift);previous?.[offset+c].add(rowShift);}return true;
 }};api.update(initial);return api;
}
