import * as T from 'three';
// A triangular ladder: longitudinal, cross-section and diagonal constraints.
// The gather is a narrow, mobile cross-section, never a world-space pin.
export class HairBundleRig {
 constructor({rows=25,length=1.1,gather=.72,width=.11,pinnedRows=1,rootWidth=1}={}){
  this.scratch={old:new T.Vector3(),velocity:new T.Vector3(),delta:new T.Vector3()};this.pinnedCount=pinnedRows*3;this.rows=rows;this.rest=[];this.points=[];this.previous=[];this.links=[];this.gather=gather;
  for(let i=0;i<rows;i++){
   const t=i/(rows-1),neck=Math.exp(-(((t-gather)/.055)**2)),w=width*T.MathUtils.lerp(rootWidth,1,T.MathUtils.smoothstep(t,0,.18))*(1-.90*neck)*(1-.4*Math.max(0,(t-gather)/(1-gather)));
   // Broad unequal lobes, an off-axis gather and a slowly turning section.
   const fullness=1+.24*Math.sin(t*7+.5)+.12*Math.sin(t*15-1);
   const center=new T.Vector3(.07*Math.sin(t*5)+.045*Math.sin(t*9)*Math.sin(Math.PI*t),-length*t,.12+.09*Math.sin(t*Math.PI)+.025*Math.sin(t*11));
   const twist=.24*Math.sin(t*5)+.16*t;
   for(let j=0;j<3;j++){const a=j*Math.PI*2/3+twist;this.rest.push(center.clone().add(new T.Vector3(Math.cos(a)*w*fullness,0,Math.sin(a)*w*(.62+.12*Math.sin(t*8+.7)))));}
  }
  this.frameScratch={a:new T.Vector3(),b:new T.Vector3(),x:new T.Vector3(),y:new T.Vector3(),z:new T.Vector3(),offset:new T.Vector3(),before:new T.Vector3(),basis:new T.Matrix4(),qa:new T.Quaternion(),qb:new T.Quaternion(),inverse:new T.Quaternion(),relative:new T.Quaternion(),rotation:new T.Quaternion()};
  this.points=this.rest.map(p=>p.clone());this.previous=this.rest.map(p=>p.clone());
  const link=(a,b)=>this.links.push({a,b,length:this.rest[a].distanceTo(this.rest[b]),restDelta:this.rest[b].clone().sub(this.rest[a])});
  for(let i=0;i<rows;i++)for(let j=0;j<3;j++){
   link(i*3+j,i*3+(j+1)%3);
   if(i){link((i-1)*3+j,i*3+j);link((i-1)*3+j,i*3+(j+1)%3);link((i-1)*3+j,i*3+(j+2)%3);}
   if(i>1)link((i-2)*3+j,i*3+j);
  }
 }
 reset(matrix){
  for(let i=0;i<this.rest.length;i++)this.points[i].copy(this.rest[i]).applyMatrix4(matrix);
  for(let i=0;i<this.points.length;i++)this.previous[i].copy(this.points[i]);
 }
 step(dt,matrix,collider=null){
  const h=Math.min(dt,1/60),p=this.points,prev=this.previous;
  // Constraints live in world space, just like the transformed pinned roots.
  // Transform rest vectors without translation, including nonuniform scale.
  const e=matrix.elements;
  for(const c of this.links){const d=c.restDelta,x=d.x,y=d.y,z=d.z;c.worldLength=Math.hypot(e[0]*x+e[4]*y+e[8]*z,e[1]*x+e[5]*y+e[9]*z,e[2]*x+e[6]*y+e[10]*z);}
  const restDistance=(a,b)=>{const d=this.scratch.delta.subVectors(this.rest[b],this.rest[a]),x=d.x,y=d.y,z=d.z;return Math.hypot(e[0]*x+e[4]*y+e[8]*z,e[1]*x+e[5]*y+e[9]*z,e[2]*x+e[6]*y+e[10]*z);};
  for(let i=0;i<p.length;i++){
   if(i<this.pinnedCount){p[i].copy(this.rest[i]).applyMatrix4(matrix);prev[i].copy(p[i]);continue;}
   const old=this.scratch.old.copy(p[i]),v=this.scratch.velocity.copy(p[i]).sub(prev[i]).multiplyScalar(.975);p[i].add(v);p[i].y-=1.8*h*h;prev[i].copy(old);if(this.sweepCollider)this.sweepCollider(prev[i],p[i],i);
  }
  for(let pass=0;pass<16;pass++){
   for(let i=0;i<this.pinnedCount;i++)p[i].copy(this.rest[i]).applyMatrix4(matrix);
   for(const c of this.links){
    if(this.solveLinks===false)continue;
    const a=p[c.a],b=p[c.b],dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,n=Math.sqrt(dx*dx+dy*dy+dz*dz);if(n<1e-9)continue;
    const wa=c.a<this.pinnedCount?0:1,wb=c.b<this.pinnedCount?0:1,k=(n-c.worldLength)/n/(wa+wb||1)*(c.stiffness??1);
    a.x+=dx*k*wa;a.y+=dy*k*wa;a.z+=dz*k*wa;b.x-=dx*k*wb;b.y-=dy*k*wb;b.z-=dz*k*wb;
   }
   if(this.limitRootBend)for(let row=2;row<7;row++)for(let j=0;j<3;j++){
    const ia=(row-2)*3+j,ib=row*3+j,a=p[ia],b=p[ib];
    const min=.92*(restDistance(ia,ia+3)+restDistance(ia+3,ib));
    const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,n=Math.sqrt(dx*dx+dy*dy+dz*dz);
    if(n<min&&n>1e-8){const wa=ia<this.pinnedCount?0:1,k=(min-n)/n/(wa+1);a.x-=dx*k*wa;a.y-=dy*k*wa;a.z-=dz*k*wa;b.x+=dx*k;b.y+=dy*k;b.z+=dz*k;}
   }
   if(this.limitSectionTurn&&pass%2===1)this.solveSectionTurns();
   if(collider&&this.segmentContacts&&pass%8===7)this.solveSegmentContacts(collider);
   if(collider&&this.volumeContacts&&pass%4===3)this.solveVolumeContacts(collider);
   if(collider&&this.surfaceBindings&&pass%4===3)this.solveSurfaceContacts(collider);
   if(collider)for(let i=this.pinnedCount;i<p.length;i++){
    const x=p[i].x,y=p[i].y,z=p[i].z;collider(p[i],.012);
    if(this.dampContacts){prev[i].x+=p[i].x-x;prev[i].y+=p[i].y-y;prev[i].z+=p[i].z-z;}
    // Position projection must not create rebound, nor preserve inward velocity
    // that drives the same particle back into the obstacle every frame.
    if(this.contactVelocity){const dx=p[i].x-x,dy=p[i].y-y,dz=p[i].z-z,n2=dx*dx+dy*dy+dz*dz;
     if(n2>1e-14){const inward=((p[i].x-prev[i].x-(collider.motion?.x||0))*dx+(p[i].y-prev[i].y-(collider.motion?.y||0))*dy+(p[i].z-prev[i].z-(collider.motion?.z||0))*dz)/n2;
      if(inward<0){prev[i].x+=dx*inward;prev[i].y+=dy*inward;prev[i].z+=dz*inward;}
     }
    }
    if(this.contactPlanes?.[i])for(const plane of this.contactPlanes[i]){const n=plane.normal,d=(p[i].x-plane.point.x)*n.x+(p[i].y-plane.point.y)*n.y+(p[i].z-plane.point.z)*n.z;if(d<0){p[i].addScaledVector(n,-d);if(this.dampContacts)prev[i].addScaledVector(n,-d);}}

   }
  }
 }
 // Bound relative section-frame rotation, preserving each triangle's
 // centroid and shape. Contacts still run afterwards and retain priority.
 solveSectionTurns(){
  const s=this.frameScratch,p=this.points;
  const frame=(row,center,q)=>{
   const i=row*3;center.copy(p[i]).add(p[i+1]).add(p[i+2]).multiplyScalar(1/3);
   s.x.subVectors(p[i],center).normalize();s.y.subVectors(p[i+1],p[i+2]);s.y.addScaledVector(s.x,-s.y.dot(s.x)).normalize();s.z.crossVectors(s.x,s.y).normalize();
   q.setFromRotationMatrix(s.basis.makeBasis(s.x,s.y,s.z));
  };
  const rotate=(row,center,q)=>{for(let j=0;j<3;j++){const i=row*3+j;if(i<this.pinnedCount)continue;
   s.before.copy(p[i]);s.offset.subVectors(p[i],center).applyQuaternion(q);p[i].copy(center).add(s.offset);
   if(this.dampContacts)this.previous[i].add(s.before.subVectors(p[i],s.before));
  }};
  for(let row=1;row<this.rows;row++){
   frame(row-1,s.a,s.qa);frame(row,s.b,s.qb);
   s.relative.copy(s.qb).multiply(s.inverse.copy(s.qa).invert());
   if(s.relative.w<0){s.relative.x*=-1;s.relative.y*=-1;s.relative.z*=-1;s.relative.w*=-1;}
   const angle=2*Math.acos(T.MathUtils.clamp(s.relative.w,-1,1)),limit=Math.PI/8;
   if(angle<=limit)continue;
   const factor=.55*(angle-limit)/angle,wa=(row-1)*3<this.pinnedCount?0:1;
   s.rotation.identity().slerp(s.relative,factor/(wa+1));if(wa)rotate(row-1,s.a,s.rotation);
   s.rotation.identity().slerp(s.relative,-factor/(wa+1));rotate(row,s.b,s.rotation);
  }
 }
 // Midpoint contacts on section edges and longitudinal rails. Distribute
 // correction to both endpoints; never add particles or render geometry.
 solveSegmentContacts(collider){
  const q=this.scratch.old,d=this.scratch.delta;
  for(const c of this.links){const rows=Math.abs(Math.floor(c.a/3)-Math.floor(c.b/3));
   if(rows>1||(rows===1&&c.a%3!==c.b%3))continue;
   const a=this.points[c.a],b=this.points[c.b],wa=c.a<this.pinnedCount?0:1,wb=c.b<this.pinnedCount?0:1;if(!wa&&!wb)continue;
   q.copy(a).add(b).multiplyScalar(.5);d.copy(q);collider(q,.012);d.subVectors(q,d);
   const n=d.length();if(n<1e-9)continue;if(n>.012)d.multiplyScalar(.012/n);
   const k=2/(wa+wb);
   if(wa){a.addScaledVector(d,k);if(this.dampContacts)this.previous[c.a].addScaledVector(d,k);}
   if(wb){b.addScaledVector(d,k);if(this.dampContacts)this.previous[c.b].addScaledVector(d,k);}
  }
 }
 // Conservative cross-section balls are collision proxies only. They do
 // not add any rendered backing surface to the disconnected ribbons.
 solveVolumeContacts(collider){
  const center=this.scratch.old,delta=this.scratch.delta,p=this.points;
  for(let row=1;row<this.rows;row++){
   center.copy(p[row*3]).add(p[row*3+1]).add(p[row*3+2]).multiplyScalar(1/3);
   const x0=p[row*3].x-center.x,x1=p[row*3].y-center.y,x2=p[row*3].z-center.z;
   const y0=(p[row*3+1].x-p[row*3+2].x)/Math.sqrt(3),y1=(p[row*3+1].y-p[row*3+2].y)/Math.sqrt(3),y2=(p[row*3+1].z-p[row*3+2].z)/Math.sqrt(3);
   const a=x0*x0+x1*x1+x2*x2,b=x0*y0+x1*y1+x2*y2,c=y0*y0+y1*y1+y2*y2;
   const radius=1.3*Math.sqrt(.5*(a+c+Math.sqrt((a-c)**2+4*b*b)))+.003;
   delta.copy(center);collider(center,radius);delta.subVectors(center,delta);
   const length=delta.length();if(length>.03)delta.multiplyScalar(.03/length);
   for(let j=0;j<3;j++){const i=row*3+j;p[i].add(delta);if(this.dampContacts)this.previous[i].add(delta);}
  }
 }
 // A render sample is a linear combination of six control particles.
 // Project its contact back with the same weights (including signed weights).
 solveSurfaceContacts(collider){
  const sample=this.scratch.old,delta=this.scratch.delta,p=this.points,previous=this.previous;
  for(const binding of this.surfaceBindings){
   const {row,blend,weights}=binding;sample.set(0,0,0);let denominator=0;
   for(let k=0;k<6;k++){const i=row+k,w=weights[k%3]*(k<3?1-blend:blend);sample.addScaledVector(p[i],w);if(i>=this.pinnedCount)denominator+=w*w;}
   if(denominator<1e-8)continue;
   delta.copy(sample);collider(sample,.003);delta.subVectors(sample,delta);
   const distance=delta.length();if(distance<1e-8)continue;
   // Bounded correction avoids impulsive inversion in initially embedded hair.
   if(distance>.025)delta.multiplyScalar(.025/distance);
   for(let k=0;k<6;k++){const i=row+k;if(i<this.pinnedCount)continue;const w=weights[k%3]*(k<3?1-blend:blend)/denominator;p[i].addScaledVector(delta,w);if(this.dampContacts)previous[i].addScaledVector(delta,w);}
  }
 }
 section(t){const f=T.MathUtils.clamp(t,0,1)*(this.rows-1),a=Math.min(this.rows-2,Math.floor(f)),u=f-a;return [0,1,2].map(j=>this.points[a*3+j].clone().lerp(this.points[(a+1)*3+j],u));}
 // Allocation-free sampling for all render vertices. Caller owns the target.
 ribbonPointInto(t,angle,radial,target){
  const f=T.MathUtils.clamp(t,0,1)*(this.rows-1),a=Math.min(this.rows-2,Math.floor(f)),u=f-a;
  const c=Math.cos(angle)*radial,d=Math.sin(angle)*radial/Math.sqrt(3);
  const w0=(1-c)/3+c,w1=(1-c)/3+d,w2=(1-c)/3-d;
  const p=this.points;
  target.set(0,0,0);
  for(let j=0;j<3;j++){const w=j===0?w0:j===1?w1:w2;target.addScaledVector(p[a*3+j],w*(1-u)).addScaledVector(p[(a+1)*3+j],w*u);}
  return target;
 }

 ribbonPoint(t,angle,radial=1){const s=this.section(t),c=s.reduce((v,p)=>v.add(p),new T.Vector3()).multiplyScalar(1/3),x=s[0].clone().sub(c),y=s[1].clone().sub(s[2]).multiplyScalar(1/Math.sqrt(3));return c.addScaledVector(x,Math.cos(angle)*radial).addScaledVector(y,Math.sin(angle)*radial);}
}
