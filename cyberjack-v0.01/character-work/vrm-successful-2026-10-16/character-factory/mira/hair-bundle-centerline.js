import * as T from 'three';
// Simulate the spine once. Cross-sections are reconstructed as rigid sections,
// so contact cannot invert the three independent rails into a local loop.
export class BundleCenterline {
 constructor(rig){this.rig=rig;this.rest=[];this.offsets=[];
  for(let row=0;row<rig.rows;row++){
   const center=rig.rest.slice(row*3,row*3+3).reduce((v,p)=>v.add(p),new T.Vector3()).multiplyScalar(1/3);this.rest.push(center);
   this.offsets.push(rig.rest.slice(row*3,row*3+3).map(p=>p.clone().sub(center)));
  }
  this.p=this.rest.map(p=>p.clone());this.old=this.p.map(p=>p.clone());this.initial=false;
 }
 reset(matrix){this.p.forEach((p,i)=>{p.copy(this.rest[i]).applyMatrix4(matrix);this.old[i].copy(p);});this.initial=true;this.reconstruct(matrix);}
 step(dt,matrix,collider){
  if(!this.initial)this.reset(matrix);const scale=new T.Vector3().setFromMatrixScale(matrix).y,h=Math.min(dt,1/60),p=this.p;
  p[0].copy(this.rest[0]).applyMatrix4(matrix);this.old[0].copy(p[0]);
  for(let i=1;i<p.length;i++){const before=p[i].clone();p[i].addScaledVector(p[i].clone().sub(this.old[i]),.96);p[i].y-=3*h*h;this.old[i].copy(before);}
  for(let pass=0;pass<12;pass++){
   for(let i=1;i<p.length;i++){
    const d=p[i].clone().sub(p[i-1]),length=this.rest[i].distanceTo(this.rest[i-1])*scale,n=d.length();if(n<1e-9)continue;
    const correction=d.multiplyScalar((n-length)/n/(i===1?1:2));p[i].sub(correction);if(i>1)p[i-1].add(correction);
   }
   // Bound the turn of the spine rather than lengths of individual rails.
   for(let i=2;i<p.length;i++){
    const previous=p[i-1].clone().sub(p[i-2]).normalize(),direction=p[i].clone().sub(p[i-1]),length=direction.length();direction.normalize();const dot=direction.dot(previous),cos=.70;
    if(dot<cos){const perpendicular=direction.addScaledVector(previous,-dot);if(perpendicular.lengthSq()<1e-10)perpendicular.set(1,0,0).addScaledVector(previous,-previous.x);perpendicular.normalize();p[i].copy(p[i-1]).addScaledVector(previous,length*cos).addScaledVector(perpendicular,length*Math.sqrt(1-cos*cos));}
   }
   if(collider)for(let i=1;i<p.length;i++){
    const before=p[i].clone(),radius=Math.max(...this.offsets[i].map(v=>v.length()))*scale+.004;
    collider(p[i],radius);this.old[i].add(p[i].clone().sub(before));
   }
  }
  // Finish with an anchored length pass: contacts/bend iterations must not
  // leave a visibly shortened tail when many adjacent constraints compete.
  for(let i=1;i<p.length;i++){
   const d=p[i].clone().sub(p[i-1]);if(d.lengthSq()<1e-12)d.set(0,-1,0);
   d.normalize();
   // Hanging-rest constraint: prevent a stationary long tail from winding
   // repeatedly upward around the root. Dynamic root motion releases it.
   if(this.hangingRest&&d.y>-.25){const horizontal=Math.sqrt(d.x*d.x+d.z*d.z);if(horizontal>1e-9){d.x*=Math.sqrt(1-.25*.25)/horizontal;d.z*=Math.sqrt(1-.25*.25)/horizontal;}else{d.x=0;d.z=Math.sqrt(1-.25*.25);}d.y=-.25;}
   p[i].copy(p[i-1]).addScaledVector(d,this.rest[i].distanceTo(this.rest[i-1])*scale);
  }
  this.reconstruct(matrix);
 }
 reconstruct(matrix){
  const rotation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().extractRotation(matrix)),scale=new T.Vector3().setFromMatrixScale(matrix).y;
  for(let i=0;i<this.p.length;i++){
   const a=Math.max(0,i-1),b=Math.min(this.p.length-1,i+1),restDirection=this.rest[b].clone().sub(this.rest[a]).applyQuaternion(rotation).normalize(),direction=this.p[b].clone().sub(this.p[a]).normalize(),q=new T.Quaternion().setFromUnitVectors(restDirection,direction);
   for(let j=0;j<3;j++)this.rig.points[i*3+j].copy(this.offsets[i][j]).multiplyScalar(scale).applyQuaternion(rotation).applyQuaternion(q).add(this.p[i]);
  }
 }
}
