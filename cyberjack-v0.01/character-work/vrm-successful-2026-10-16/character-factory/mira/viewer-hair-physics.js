import {stepMiraDrape} from './viewer-mira-drape.js?v=1';
import * as T from './vendor/three/three.module.js';
import {solveStrandContacts,renderContactStrand} from './strand-contact-solver.js?v=runtime92';
export function cleanHairPhysics(v={}){const out={enabled:v.enabled!==false};for(const [k,d]of Object.entries({stiffness:.35,damping:.35,motion:.85,wind:0}))out[k]=Number.isFinite(v[k])?T.MathUtils.clamp(v[k],0,1):d;return out;}
import {projectHairCollider,prepareHairCollider} from './hair-capsule-collider.js';
export {projectHairCollider,prepareHairCollider};
export function projectHairBody(point,colliders,padding,maxPasses=24){
 for(let pass=0;pass<maxPasses;pass++){
  let changed=false;for(const shape of colliders)if(shape.enforceRest)changed=projectHairCollider(point,shape,padding)||changed;
  if(!changed)break;
 }
 return point;
}
// Blend nearby strand displacements, preserving their different rest shapes.
export function cohesiveHairPosition(point,rest,peers,strength=.55){
 const offset=point.clone().sub(rest),sum=offset.clone(),radius=.065;let total=1;
 for(const peer of peers){const distance=peer.rest.distanceTo(rest);if(distance>=radius)continue;const w=(1-distance/radius)**2;sum.addScaledVector(peer.point.clone().sub(peer.rest),w);total+=w;}
 return point.clone().lerp(rest.clone().add(sum.multiplyScalar(1/total)),strength);
}
// World-space spring chains. Render rings retain their rest sections and normals.
export class HairPhysics {
 constructor(){this.settings={enabled:true,stiffness:.35,damping:.35,motion:.85,wind:0};this.chains=new Map();this.accumulator=0;this.time=0;this.colliders=[];}
 reset(){for(const c of this.chains.values()){this.restore(c);c.previousWorldCenters=null;c.contactState=null;c.p=null;c.lastRoot=null;}this.accumulator=0;}
 register(mesh,rigid=false,profile='long',motionGroup=null){const g=mesh.geometry,base=g.attributes.position.array.slice(),normals=g.attributes.normal.array.slice(),rings=base.length/3/13;if(!Number.isInteger(rings)||rings<3)return;const centers=[];for(let r=0;r<rings;r++){const p=new T.Vector3();for(let j=0;j<12;j++)p.add(new T.Vector3().fromArray(base,(r*13+j)*3));centers.push(p.multiplyScalar(1/12));}const ids=[...new Set(Array.from({length:profile==='drape'?21:9},(_,i)=>Math.round(i*(rings-1)/(profile==='drape'?20:8))))];const radii=centers.map((center,r)=>Math.max(...Array.from({length:12},(_,j)=>new T.Vector3().fromArray(base,(r*13+j)*3).distanceTo(center))));this.chains.set(mesh,{mesh,base,normals,centers,radii,ids,rigid,profile,motionGroup,p:null});g.attributes.position.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;}
 remove(root){root.traverse(o=>this.chains.delete(o));}
 restore(c){c.mesh.geometry.attributes.position.array.set(c.base);c.mesh.geometry.attributes.normal.array.set(c.normals);c.mesh.geometry.attributes.position.needsUpdate=c.mesh.geometry.attributes.normal.needsUpdate=true;}
 update(dt,root){for(const shape of this.colliders)prepareHairCollider(shape);this.metrics={solveMS:0,renderMS:0,chains:0,nodes:0};root.updateWorldMatrix(true,true);const enabled=this.settings.enabled;this.time+=Math.min(dt,.05);if(dt>.75)this.reset();this.accumulator+=Math.min(dt,.05);const steps=Math.min(4,Math.floor(this.accumulator*60));this.accumulator-=steps/60;const h=1/60;if(!steps&&enabled)return;
 const groups=new Map();for(const c of this.chains.values())if(c.motionGroup){if(!groups.has(c.motionGroup))groups.set(c.motionGroup,[]);groups.get(c.motionGroup).push(c);}
 const leaders=new Map();for(const [name,members]of groups){const mid=c=>c.centers[c.ids[4]].clone().applyMatrix4(c.mesh.matrixWorld),center=members.reduce((v,c)=>v.add(mid(c)),new T.Vector3()).multiplyScalar(1/members.length);leaders.set(name,members.reduce((a,b)=>mid(a).distanceToSquared(center)<mid(b).distanceToSquared(center)?a:b));}
 const ordered=[...new Set(leaders.values()),...Array.from(this.chains.values()).filter(c=>!c.motionGroup||leaders.get(c.motionGroup)!==c)];
 const contactGroups=new Map(),contactLeaders=new Map();
 if(this.surfaceCollider)for(const members of groups.values()){
  const sorted=[...members].sort((a,b)=>a.centers[a.ids[4]].x-b.centers[b.ids[4]].x);
  for(let i=0;i<sorted.length;i+=4){const group=sorted.slice(i,i+4),leader=group.reduce((a,b)=>ordered.indexOf(a)<ordered.indexOf(b)?a:b);contactGroups.set(leader,group);for(const member of group)contactLeaders.set(member,leader);}
 }
 const peers=this.cohesion?Array.from(this.chains.values()).filter(c=>c.p&&!c.rigid&&c.profile!=='fringe').map(c=>({chain:c,rest:c.ids.map(i=>c.centers[i].clone().applyMatrix4(c.mesh.matrixWorld)),points:c.p.map(p=>p.clone())})):[];
 for(const c of ordered){
  if(!c.mesh.parent){this.chains.delete(c.mesh);continue;}if(!enabled||c.rigid){c.previousWorldCenters=null;c.contactState=null;if(c.p){this.restore(c);c.p=null;}continue;}
  const m=c.mesh.matrixWorld,inv=m.clone().invert(),worldScale=m.getMaxScaleOnAxis(),targets=c.ids.map(i=>c.centers[i].clone().applyMatrix4(m));
  if(!c.p||c.lastRoot.distanceTo(targets[0])>.20){c.p=targets.map(p=>p.clone());c.old=targets.map(p=>p.clone());}c.lastRoot=targets[0].clone();
  const softRoots=Boolean(this.cohesion&&c.profile!=='fringe'),pin=c.profile==='drape'?.05:softRoots?.125:.25;
  const reach=targets.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(targets[i]),0),lengthFactor=T.MathUtils.clamp(reach/.25,.08,1);
  const leader=c.motionGroup?leaders.get(c.motionGroup):null,following=leader&&leader!==c&&leader.p;
  if(following){
   const leaderMatrix=leader.mesh.matrixWorld;
   for(let i=0;i<c.p.length;i++){
    const rest=leader.centers[leader.ids[i]].clone().applyMatrix4(leaderMatrix),offset=leader.p[i].clone().sub(rest);
    c.p[i].copy(targets[i]).add(offset);c.old[i].copy(c.p[i]);
   }
  }
  if(c.profile==='drape')stepMiraDrape(c,targets,steps,h,this.colliders,this.groundY,projectHairCollider);
  for(let step=0;step<(following||c.profile==='drape'?0:steps);step++){
   for(let i=0;i<c.p.length;i++){
    const t=i/(c.p.length-1);if(t<=pin){c.p[i].copy(targets[i]);c.old[i].copy(targets[i]);continue;}
    const p=c.p[i],before=p.clone(),v=p.clone().sub(c.old[i]).multiplyScalar(c.profile==='spring'?.982:.92+(1-this.settings.damping)*.065);
    p.add(v).addScaledVector(targets[i].clone().sub(p),(.008+this.settings.stiffness*.065)*(1-this.settings.motion*.45)*(c.profile==='spring'?3.2:c.profile==='fringe'?1.6:1)/Math.max(.2,lengthFactor));
    const freedom=(t-pin)/(1-pin)*this.settings.motion*(c.profile==='spring'?.85:c.profile==='fringe'?.6:1);
    p.y-=.7*freedom*h*h;p.x+=this.settings.wind*.8*Math.sin(this.time*2.3+t*3)*freedom*h*h;
    const max=.11*freedom*lengthFactor,delta=p.clone().sub(targets[i]);if(delta.length()>max)p.copy(targets[i]).add(delta.setLength(max));
    c.old[i].copy(before);
   }
   for(let pass=0;pass<3;pass++)for(let i=softRoots?2:3;i<c.p.length;i++){
    const a=c.p[i-1],p=c.p[i],length=targets[i].distanceTo(targets[i-1]),d=p.clone().sub(a),l=d.length();if(l>1e-8)p.addScaledVector(d,(length-l)/l*.7);
    for(const shape of this.colliders){if(this.surfaceCollider&&shape.enforceRest)continue;if(!shape.enforceRest&&shape.center&&targets[i].distanceTo(shape.center)<shape.radius+.002)continue;projectHairCollider(p,shape,shape.enforceRest?.012:.002);}
   }
  }
  if(this.cohesion&&!c.motionGroup&&c.profile!=='fringe')for(let i=2;i<c.p.length;i++){
    const nearby=peers.filter(p=>p.chain!==c&&p.points[i]).map(p=>({rest:p.rest[i],point:p.points[i]}));
    c.p[i].copy(cohesiveHairPosition(c.p[i],targets[i],nearby,this.cohesion));
    for(let pass=0;pass<3;pass++)for(const shape of this.colliders)if(shape.enforceRest)projectHairCollider(c.p[i],shape,.012);
  }
  if(c.profile==='fringe')for(let i=3;i<c.p.length;i++){const d=c.p[i].clone().sub(targets[i]),limit=.012*(i/(c.p.length-1)-.25)/.75*this.settings.motion;if(d.length()>limit)c.p[i].copy(targets[i]).add(d.setLength(limit));}
  if(this.surfaceCollider){
   const indices=c.contactIndices??=Array.from({length:16},(_,i)=>Math.round(i*(c.centers.length-1)/15)).filter((v,i,a)=>!i||v!==a[i-1]);
   const rest=indices.map(r=>c.centers[r].clone().applyMatrix4(m));
   const desired=indices.map((r,i)=>{
    const t=r/(c.centers.length-1),u=t*(c.p.length-1),a=Math.min(c.p.length-2,Math.floor(u)),f=u-a;
    const offset=c.p[a].clone().sub(targets[a]).lerp(c.p[a+1].clone().sub(targets[a+1]),f);
    return rest[i].clone().addScaledVector(offset,T.MathUtils.smoothstep(t,pin,pin+.25));
   });
   const contactPin=c.profile==='fringe'?.45:.30;
   const collisionLeader=contactLeaders.get(c);
   if(collisionLeader&&collisionLeader!==c&&collisionLeader.contactState){
    const points=desired.map((p,i)=>p.clone().add(collisionLeader.contactState.points[i].clone().sub(collisionLeader.contactState.desired[i])));
    const renderStart=performance.now();renderContactStrand(c,points,indices,inv,contactPin);this.metrics.renderMS+=performance.now()-renderStart;continue;
   }
   const members=contactGroups.get(c)||[c];
   const radii=indices.map((r,i)=>{
    let radius=0;const a=indices[Math.max(0,i-1)],b=indices[Math.min(indices.length-1,i+1)];
    for(const member of members){
     const transform=member.mesh.matrixWorld,scale=transform.getMaxScaleOnAxis();
     for(let row=a;row<=b;row++){
      const memberRow=Math.round(row*(member.centers.length-1)/(c.centers.length-1));
      const seg=row<=r?Math.max(0,i-1):i,j=indices[seg],k=indices[Math.min(indices.length-1,seg+1)];
      const linear=c.centers[j].clone().lerp(c.centers[k],k===j?0:(row-j)/(k-j)).applyMatrix4(m);
      radius=Math.max(radius,member.radii[memberRow]*scale+linear.distanceTo(member.centers[memberRow].clone().applyMatrix4(transform)));
     }
    }return radius+.003;
   });
   const solveStart=performance.now();c.contactState=solveStrandContacts({desired,rest,radii,pin:contactPin,collider:this.surfaceCollider,state:c.contactState||{}});
   this.metrics.solveMS+=performance.now()-solveStart;this.metrics.chains++;this.metrics.nodes+=indices.length;
   const renderStart=performance.now();renderContactStrand(c,c.contactState.points,indices,inv,contactPin);this.metrics.renderMS+=performance.now()-renderStart;continue;
  }
  const local=c.p.map(p=>p.clone().applyMatrix4(inv)),position=c.mesh.geometry.attributes.position,normal=c.mesh.geometry.attributes.normal;
  const offsets=local.map((p,i)=>p.clone().sub(c.centers[c.ids[i]])),displacement=new T.CatmullRomCurve3(offsets,false,'catmullrom',.25);
  const offsetAt=t=>displacement.getPoint(T.MathUtils.clamp(t,0,1)).multiplyScalar(T.MathUtils.smoothstep(t,c.profile==='drape'?.05:softRoots?.125:.25,c.profile==='drape'?.15:softRoots?.55:.40));
  const clearance=r=>(c.radii?.[r]||0)*worldScale+.006;
  const shifts=c.centers.map((center,r)=>{
   const t=r/(c.centers.length-1),shift=offsetAt(t);
   if(t>pin){const world=center.clone().add(shift).applyMatrix4(m),before=world.clone();projectHairBody(world,this.colliders,clearance(r),c.profile==='drape'?4:24);shift.add(world.applyMatrix4(inv).sub(before.applyMatrix4(inv)));}
   if(c.profile==='drape'&&Number.isFinite(this.groundY)){const world=center.clone().add(shift).applyMatrix4(m);if(world.y<this.groundY+.006){world.y=this.groundY+.006;shift.copy(world.applyMatrix4(inv).sub(center));}}
   return shift;
  });
  // Relax collision corrections along the strand. Reproject afterwards so
  // smoothing cannot pull the hair back through the torso.
  if(softRoots)for(let pass=0;pass<3;pass++){
   const previous=shifts.map(v=>v.clone());
   for(let r=1;r<shifts.length-1;r++){
    const t=r/(shifts.length-1);if(t<=pin)continue;
    shifts[r].lerp(previous[r-1].clone().add(previous[r+1]).multiplyScalar(.5),.45);
    const world=c.centers[r].clone().add(shifts[r]).applyMatrix4(m);
    projectHairBody(world,this.colliders,clearance(r),c.profile==='drape'?4:24);
    shifts[r].copy(world.applyMatrix4(inv).sub(c.centers[r]));
   }
  }
  c.restDirections??=c.centers.map((_,r)=>c.centers[Math.min(c.centers.length-1,r+1)].clone().sub(c.centers[Math.max(0,r-1)]).normalize());
  c.renderDirection??=new T.Vector3();c.renderQuaternion??=new T.Quaternion();
  const pa=position.array,na=normal.array;
  for(let r=0;r<c.centers.length;r++){
   const a=Math.max(0,r-1),b=Math.min(c.centers.length-1,r+1),shift=shifts[r],center=c.centers[r],dir=c.renderDirection.copy(c.centers[b]).add(shifts[b]).sub(c.centers[a]).sub(shifts[a]).normalize(),q=c.renderQuaternion.setFromUnitVectors(c.restDirections[r],dir),qx=q.x,qy=q.y,qz=q.z,qw=q.w;
   for(let j=0;j<13;j++){const k=(r*13+j)*3,x=c.base[k]-center.x,y=c.base[k+1]-center.y,z=c.base[k+2]-center.z,tx=2*(qy*z-qz*y),ty=2*(qz*x-qx*z),tz=2*(qx*y-qy*x);pa[k]=x+qw*tx+qy*tz-qz*ty+center.x+shift.x;pa[k+1]=y+qw*ty+qz*tx-qx*tz+center.y+shift.y;pa[k+2]=z+qw*tz+qx*ty-qy*tx+center.z+shift.z;
    const nx=c.normals[k],ny=c.normals[k+1],nz=c.normals[k+2],ntx=2*(qy*nz-qz*ny),nty=2*(qz*nx-qx*nz),ntz=2*(qx*ny-qy*nx);na[k]=nx+qw*ntx+qy*ntz-qz*nty;na[k+1]=ny+qw*nty+qz*ntx-qx*ntz;na[k+2]=nz+qw*ntz+qx*nty-qy*ntx;
   }
  }
  position.needsUpdate=normal.needsUpdate=true;
 }
 }
}
