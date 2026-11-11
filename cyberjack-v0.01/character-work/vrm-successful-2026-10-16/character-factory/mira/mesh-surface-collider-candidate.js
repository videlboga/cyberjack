import * as T from './vendor/three/three.module.js';
// General world-space triangle collider. Topology is built once; posed vertices
// and BVH bounds are refitted. No dependence on hair, capsules or body rig names.
export class MeshSurfaceCollider {
 constructor(){this.nodes=[];this.root=-1;this.revision=0;this.triangle=new T.Triangle();this.closest=new T.Vector3();this.normal=new T.Vector3();this.edge=new T.Vector3();}
 update(positions,indices,matrix=new T.Matrix4()){
  const changed=this.sourceIndex!==indices||this.vertexCount!==positions.length/3;this.sourceIndex=indices;this.vertexCount=positions.length/3;
  if(!this.positions||this.positions.length!==positions.length)this.positions=new Float64Array(positions.length);
  const p=new T.Vector3();let displacement=0;for(let i=0;i<positions.length;i+=3){p.fromArray(positions,i).applyMatrix4(matrix);if(!changed)displacement=Math.max(displacement,Math.hypot(p.x-this.positions[i],p.y-this.positions[i+1],p.z-this.positions[i+2]));p.toArray(this.positions,i);}this.maxDisplacement=changed?Infinity:displacement;
  this.indices=indices;
  if(changed){this.nodes=[];const ids=Array.from({length:indices.length/3},(_,i)=>i);this.root=this.build(ids);}else this.refit(this.root);
  this.revision++;return this;
 }
 triangleAt(id){const ix=this.indices,p=this.positions;this.triangle.a.fromArray(p,ix[id*3]*3);this.triangle.b.fromArray(p,ix[id*3+1]*3);this.triangle.c.fromArray(p,ix[id*3+2]*3);return this.triangle;}
 bounds(ids,b=[0,0,0,0,0,0]){b[0]=b[1]=b[2]=Infinity;b[3]=b[4]=b[5]=-Infinity;for(const id of ids)for(let j=0;j<3;j++){const i=this.indices[id*3+j]*3;for(let k=0;k<3;k++){b[k]=Math.min(b[k],this.positions[i+k]);b[k+3]=Math.max(b[k+3],this.positions[i+k]);}}return b;}
 build(ids){const id=this.nodes.length,node={bounds:this.bounds(ids)};this.nodes.push(node);if(ids.length<=8){node.ids=ids;return id;}const b=node.bounds,axis=[0,1,2].reduce((a,k)=>b[k+3]-b[k]>b[a+3]-b[a]?k:a,0),centroid=t=>{const ix=this.indices;return this.positions[ix[t*3]*3+axis]+this.positions[ix[t*3+1]*3+axis]+this.positions[ix[t*3+2]*3+axis];};ids.sort((a,b)=>centroid(a)-centroid(b));const mid=ids.length>>1;node.left=this.build(ids.slice(0,mid));node.right=this.build(ids.slice(mid));return id;}
 refit(id){const n=this.nodes[id];if(n.ids)this.bounds(n.ids,n.bounds);else{this.refit(n.left);this.refit(n.right);const a=this.nodes[n.left].bounds,b=this.nodes[n.right].bounds;for(let k=0;k<3;k++){n.bounds[k]=Math.min(a[k],b[k]);n.bounds[k+3]=Math.max(a[k+3],b[k+3]);}}}
 boxDistance(p,b){const x=Math.max(b[0]-p.x,0,p.x-b[3]),y=Math.max(b[1]-p.y,0,p.y-b[4]),z=Math.max(b[2]-p.z,0,p.z-b[5]);return x*x+y*y+z*z;}
 nearest(point,seed=null,localOnly=false){
  if(this.root<0)return null;let best=Infinity,result=null;const stack=[this.root];
  if(Number.isInteger(seed)&&seed>=0&&seed<this.indices.length/3){
   const triangle=this.triangleAt(seed);triangle.closestPointToPoint(point,this.closest);triangle.getNormal(this.normal);
   if(this.normal.lengthSq()>.5){best=point.distanceToSquared(this.closest);result={point:this.closest.clone(),normal:this.normal.clone(),triangle:seed,distance:Math.sqrt(best)};}
  }
  if(localOnly&&result)stack.length=0;
  while(stack.length){const n=this.nodes[stack.pop()];if(this.boxDistance(point,n.bounds)>best)continue;
   if(n.ids){for(const id of n.ids){const triangle=this.triangleAt(id);triangle.closestPointToPoint(point,this.closest);const d=point.distanceToSquared(this.closest);if(d<best){triangle.getNormal(this.normal);if(this.normal.lengthSq()<.5)continue;best=d;result={point:this.closest.clone(),normal:this.normal.clone(),triangle:id,distance:Math.sqrt(d)};}}}
   else{const a=this.nodes[n.left],b=this.nodes[n.right];if(this.boxDistance(point,a.bounds)<this.boxDistance(point,b.bounds))stack.push(n.right,n.left);else stack.push(n.left,n.right);}
  }
  if(result)result.signedDistance=result.distance*(point.clone().sub(result.point).dot(result.normal)<0?-1:1);return result;
 }
 // Allocation-free exact nearest query for dense cloth/ribbon contacts.
 nearestInto(point,out,seed=out.triangle,maxDistance=Infinity){
  if(this.root<0)return false;let best=maxDistance*maxDistance,found=false;const stack=this.ribbonStack??=[];stack.length=0;stack.push(this.root);
  const test=id=>{const tri=this.triangleAt(id);tri.closestPointToPoint(point,this.closest);const d=point.distanceToSquared(this.closest);if(d>=best)return;tri.getNormal(this.normal);if(this.normal.lengthSq()<.5)return;best=d;found=true;out.point.copy(this.closest);out.normal.copy(this.normal);out.triangle=id;};
  if(Number.isInteger(seed)&&seed>=0&&seed<this.indices.length/3)test(seed);
  while(stack.length){const node=this.nodes[stack.pop()];if(this.boxDistance(point,node.bounds)>best)continue;if(node.ids){for(const id of node.ids)if(id!==seed)test(id);}else{const a=this.nodes[node.left],b=this.nodes[node.right];if(this.boxDistance(point,a.bounds)<this.boxDistance(point,b.bounds))stack.push(node.right,node.left);else stack.push(node.left,node.right);}}
  if(!found)out.distance=Infinity;
  if(found){out.distance=Math.sqrt(best);out.signedDistance=out.distance*((point.x-out.point.x)*out.normal.x+(point.y-out.point.y)*out.normal.y+(point.z-out.point.z)*out.normal.z<0?-1:1);}return found;
 }
 rayBox(origin,direction,b,max){let lo=0,hi=max;for(let k=0;k<3;k++){const o=origin.getComponent(k),d=direction.getComponent(k);if(Math.abs(d)<1e-12){if(o<b[k]||o>b[k+3])return false;continue;}let a=(b[k]-o)/d,c=(b[k+3]-o)/d;if(a>c)[a,c]=[c,a];lo=Math.max(lo,a);hi=Math.min(hi,c);if(lo>hi)return false;}return true;}
 intersections(origin,direction,max=Infinity){const ray=new T.Ray(origin,direction),hit=new T.Vector3(),hits=[],stack=[this.root];if(this.root<0)return hits;
  while(stack.length){const n=this.nodes[stack.pop()];if(!this.rayBox(origin,direction,n.bounds,max))continue;if(n.ids){for(const id of n.ids){const t=this.triangleAt(id);if(ray.intersectTriangle(t.a,t.b,t.c,false,hit)){const distance=hit.distanceTo(origin);if(distance<=max&&distance>1e-7)hits.push({distance,point:hit.clone(),normal:t.getNormal(new T.Vector3()),triangle:id});}}}else stack.push(n.left,n.right);}
  hits.sort((a,b)=>a.distance-b.distance);return hits.filter((h,i)=>!i||Math.abs(h.distance-hits[i-1].distance)>1e-6);
 }
 contains(point){if(this.root<0||this.boxDistance(point,this.nodes[this.root].bounds)>1e-14)return false;let votes=0;for(const axis of [[1,.371,.173],[-.237,1,.419],[.317,-.271,1]])votes+=this.intersections(point,new T.Vector3(...axis).normalize()).length%2;return votes>=2;}
 // A cached triangle seeds an exact BVH query; it never bypasses the other
 // triangles. No stale contact can conceal a newly approaching body part.
 projectParticle(point,radius,cache={},detectInside=true,localOnly=false){
  const near=this.nearest(point,cache.triangle,localOnly);if(!near)return false;
  cache.triangle=near.triangle;
  const inside=detectInside?this.contains(point):near.signedDistance<0;
  if(!inside&&near.distance>=radius)return false;
  const direction=inside?near.point.clone().sub(point):point.clone().sub(near.point);
  if(direction.lengthSq()<1e-14)direction.copy(cache.normal||near.normal);else direction.normalize();
  cache.normal=direction.clone();point.copy(near.point).addScaledVector(direction,radius+1e-5);return true;
 }
 segmentContact(a,b,radius,cache={},localOnly=false){
  const lo=[Math.min(a.x,b.x),Math.min(a.y,b.y),Math.min(a.z,b.z)];
  const hi=[Math.max(a.x,b.x),Math.max(a.y,b.y),Math.max(a.z,b.z)];
  const overlaps=box=>{let d=0;for(let k=0;k<3;k++){const gap=Math.max(lo[k]-box[k+3],box[k]-hi[k],0);d+=gap*gap;}return d<=best;};
  let best=radius*radius,result=null;
  segmentDirection.subVectors(b,a);const segmentLength=segmentDirection.length();if(segmentLength>1e-12)segmentDirection.multiplyScalar(1/segmentLength);const normalScratch=new T.Vector3();
  const test=id=>{
   const tri=this.triangleAt(id),normal=tri.getNormal(normalScratch);if(normal.lengthSq()<.5)return;
   const pair=segmentTriangleClosest(a,b,tri,segmentLength),distance=pair.segment.distanceToSquared(pair.surface);
   if(distance>=best)return;best=distance;
   const delta=pair.segment.clone().sub(pair.surface);
   if(distance>1e-14)delta.normalize();else{delta.copy(normal);if(cache.normal?delta.dot(cache.normal)<0:delta.dot(a.clone().sub(pair.surface))<0)delta.negate();}
   result={triangle:id,normal:delta,point:pair.surface,t:pair.t,depth:radius-Math.sqrt(distance)};
  };
  if(Number.isInteger(cache.triangle)&&cache.triangle<this.indices.length/3)test(cache.triangle);
  if(localOnly)return result;
  const stack=this.root<0?[]:[this.root];
  while(stack.length){const n=this.nodes[stack.pop()];if(!overlaps(n.bounds))continue;if(n.ids){for(const id of n.ids)if(id!==cache.triangle)test(id);}else stack.push(n.left,n.right);}
  if(result){cache.triangle=result.triangle;cache.normal=result.normal.clone();}return result;
 }
 projectSphere(point,radius=.003){
  let corrected=false;
  for(let pass=0;pass<12;pass++){
   if(!this.projectSphereOnce(point,radius))break;corrected=true;
  }
  if(this.contains(point)||(this.nearest(point)?.distance??Infinity)<radius-1e-6){
   // Overlapping folds can alternate nearest faces. Search exterior exits
   // instead of leaving the point trapped between those faces.
   let best=null,distance=Infinity;
   for(const axis of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]){
    const dir=new T.Vector3(...axis);
    for(const hit of this.intersections(point,dir)){
     const candidate=hit.point.clone().addScaledVector(dir,radius*4+1e-5);
     if(!this.contains(candidate)&&this.nearest(candidate).distance>=radius-1e-6){
      const d=point.distanceToSquared(candidate);if(d<distance){best=candidate;distance=d;}break;
     }
    }
   }
   if(best){point.copy(best);corrected=true;}
  }
  return corrected;
 }
 projectSphereOnce(point,radius=.003){
  // Broad phase against the actual refitted mesh bounds.
  const bounds=this.nodes[this.root]?.bounds;if(!bounds||this.boxDistance(point,bounds)>radius*radius)return false;
  const near=this.nearest(point);if(!near)return false;
  // Imported meshes can have reversed winding; containment must not depend on it.
  const inside=this.contains(point);
  if(!inside&&near.distance>=radius)return false;
  const direction=inside?near.point.clone().sub(point):point.clone().sub(near.point);
  if(direction.lengthSq()<1e-14)direction.copy(near.normal);else direction.normalize();
  point.copy(near.point).addScaledVector(direction,radius+1e-5);return true;
 }
 sweep(from,to,radius=.003){
  const delta=to.clone().sub(from),length=delta.length();
  if(length<1e-9)return this.projectSphere(to,radius);
  const direction=delta.clone().multiplyScalar(1/length),start=this.nearest(from);
  // Conservative advancement uses the sphere radius, so a grazing edge hit
  // is detected even when the centre ray does not intersect a triangle.
  if(start&&start.distance>radius+2e-6&&!this.contains(from)){
   let travelled=0;
   for(let pass=0;pass<64;pass++){
    const candidate=from.clone().addScaledVector(direction,travelled),near=this.nearest(candidate);
    if(!near)break;
    if(near.distance<=radius+1e-6){to.copy(candidate);this.projectSphere(to,radius);return true;}
    travelled+=Math.max(1e-6,(near.distance-radius)*.9);
    if(travelled>length)break;
   }
  }
  const hit=this.intersections(from,direction,length)[0];
  if(hit){const normal=hit.normal.clone();if(normal.dot(direction)>0)normal.negate();to.copy(hit.point).addScaledVector(normal,radius+1e-5);this.projectSphere(to,radius);return true;}
  return this.projectSphere(to,radius);
 }
}

// Exact segment/triangle distance: intersection, endpoint/face, and all three
// edge/edge pairs. In particular this catches contacts between simulation nodes.
const segmentScratch={segment:new T.Vector3(),surface:new T.Vector3(),t:0},segmentPoint=new T.Vector3(),surfacePoint=new T.Vector3(),segmentDirection=new T.Vector3(),segmentRay=new T.Ray();
function segmentTriangleClosest(a,b,tri,length){
 const result=segmentScratch;
 if(length>1e-12&&segmentRay.set(a,segmentDirection).intersectTriangle(tri.a,tri.b,tri.c,false,surfacePoint)&&surfacePoint.distanceTo(a)<=length){result.segment.copy(surfacePoint);result.surface.copy(surfacePoint);result.t=surfacePoint.distanceTo(a)/length;return result;}
 tri.closestPointToPoint(a,surfacePoint);let best=a.distanceToSquared(surfacePoint);result.segment.copy(a);result.surface.copy(surfacePoint);result.t=0;
 tri.closestPointToPoint(b,surfacePoint);let distance=b.distanceToSquared(surfacePoint);if(distance<best){best=distance;result.segment.copy(b);result.surface.copy(surfacePoint);result.t=1;}
 const ux=b.x-a.x,uy=b.y-a.y,uz=b.z-a.z,aa=ux*ux+uy*uy+uz*uz;
 for(let edge=0;edge<3;edge++){
 const c=edge===0?tri.a:edge===1?tri.b:tri.c,d=edge===0?tri.b:edge===1?tri.c:tri.a;
 const vx=d.x-c.x,vy=d.y-c.y,vz=d.z-c.z,wx=a.x-c.x,wy=a.y-c.y,wz=a.z-c.z,bb=ux*vx+uy*vy+uz*vz,cc=vx*vx+vy*vy+vz*vz,dd=ux*wx+uy*wy+uz*wz,ee=vx*wx+vy*wy+vz*wz,den=aa*cc-bb*bb;
 let t=aa<1e-16?0:T.MathUtils.clamp(den>1e-16?(bb*ee-cc*dd)/den:0,0,1),q=cc<1e-16?0:(bb*t+ee)/cc;
 if(q<0){q=0;t=aa<1e-16?0:T.MathUtils.clamp(-dd/aa,0,1);}else if(q>1){q=1;t=aa<1e-16?0:T.MathUtils.clamp((bb-dd)/aa,0,1);}
 segmentPoint.set(a.x+ux*t,a.y+uy*t,a.z+uz*t);surfacePoint.set(c.x+vx*q,c.y+vy*q,c.z+vz*q);distance=segmentPoint.distanceToSquared(surfacePoint);
 if(distance<best){best=distance;result.segment.copy(segmentPoint);result.surface.copy(surfacePoint);result.t=t;}
 }return result;
}
