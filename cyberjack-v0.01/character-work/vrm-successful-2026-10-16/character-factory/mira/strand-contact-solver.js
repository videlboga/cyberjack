import * as T from './vendor/three/three.module.js';
// Contact constraints operate on a sparse world-space chain; render rings are
// consumers, never independent collision particles.
export function solveStrandContacts({desired,rest,radii,pin,collider,state={},iterations=4}){
 const count=desired.length;
 if(state.count!==count){state.count=count;state.points=desired.map(p=>p.clone());state.contacts=Array.from({length:count},()=>({}));state.edges=Array.from({length:count-1},()=>({}));}
 const p=state.points,first=Math.floor(pin*(count-1))+1;
 // Reuse last frame's small contact offsets, rather than starting inside the
 // surface on every solver iteration. Reset on a discontinuous seek/teleport.
 for(let i=0;i<count;i++){
  const offset=state.desired?p[i].clone().sub(state.desired[i]):new T.Vector3();
  if(offset.length()>.15||state.desired?.[i].distanceTo(desired[i])>.15)offset.set(0,0,0);
  p[i].copy(desired[i]).addScaledVector(offset,i<first?0:.75);
 }
 const lengths=rest.slice(1).map((v,i)=>v.distanceTo(rest[i]));
 for(let pass=0;pass<iterations;pass++){
  for(let i=first;i<count;i++){
   const delta=p[i].clone().sub(p[i-1]),distance=delta.length();
   if(distance>1e-9){const correction=delta.multiplyScalar((distance-lengths[i-1])/distance*.65);p[i].sub(correction);if(i-1>=first)p[i-1].addScaledVector(correction,.5);}
   // Weak shape/bend constraint keeps the character's designed curls.
   if(pass<iterations-1)p[i].lerp(desired[i],.08);
   collider.projectParticle(p[i],radii[i],state.contacts[i],pass===0,pass>0&&pass<iterations-1);
  }
  for(let i=first;i<count;i++){
   const contact=collider.segmentContact(p[i-1],p[i],Math.max(radii[i-1],radii[i]),state.edges[i-1],pass>0&&pass<iterations-1);if(!contact)continue;
   const wa=i-1<first?0:1-contact.t,wb=contact.t,den=wa*wa+wb*wb;
   if(den<1e-8){p[i].addScaledVector(contact.normal,contact.depth+1e-5);continue;}
   p[i-1].addScaledVector(contact.normal,(contact.depth+1e-5)*wa/den);
   p[i].addScaledVector(contact.normal,(contact.depth+1e-5)*wb/den);
  }
 }
 for(let i=first;i<count;i++)collider.projectParticle(p[i],radii[i],state.contacts[i],true);
 state.desired=desired.map(p=>p.clone());return state;
}
export function renderContactStrand(chain,world,indices,inverse,pin=0){
 const position=chain.mesh.geometry.attributes.position,normal=chain.mesh.geometry.attributes.normal;
 let segment=0;const vertex=new T.Vector3(),vertexNormal=new T.Vector3();
 for(let r=0;r<chain.centers.length;r++){
  if(r/(chain.centers.length-1)<=pin){
   for(let j=0;j<13;j++){const id=r*13+j;position.setXYZ(id,...chain.base.subarray(id*3,id*3+3));normal.setXYZ(id,...chain.normals.subarray(id*3,id*3+3));}continue;
  }
  while(segment<indices.length-2&&r>indices[segment+1])segment++;
  const a=indices[segment],b=indices[segment+1],t=(r-a)/(b-a);
  const rest=chain.centers[a].clone().lerp(chain.centers[b],t),solved=world[segment].clone().lerp(world[segment+1],t).applyMatrix4(inverse);
  // Retain the original curvature between sparse nodes. The solver's capsule
  // radius includes this deviation as well as the ribbon cross section.
  const center=solved.add(chain.centers[r].clone().sub(rest));
  const restDir=chain.centers[b].clone().sub(chain.centers[a]).normalize(),dir=world[segment+1].clone().sub(world[segment]).transformDirection(inverse);
  const q=new T.Quaternion().setFromUnitVectors(restDir,dir);
  for(let j=0;j<13;j++){
   const id=r*13+j,p=vertex.fromArray(chain.base,id*3).sub(chain.centers[r]).applyQuaternion(q).add(center),n=vertexNormal.fromArray(chain.normals,id*3).applyQuaternion(q);
   position.setXYZ(id,p.x,p.y,p.z);normal.setXYZ(id,n.x,n.y,n.z);
  }
 }
 position.needsUpdate=normal.needsUpdate=true;
}
