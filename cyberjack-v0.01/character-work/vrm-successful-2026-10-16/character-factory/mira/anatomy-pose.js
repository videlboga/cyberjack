/* Native clip replay on the fitted, proportioned anatomy skeleton. Dual
 * quaternion skinning preserves joint volume; lengths stay in the rest rig. */
(function(root){
 const qm=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
 const qi=q=>[-q[0],-q[1],-q[2],q[3]],qn=q=>{const l=Math.hypot(...q);return q.map(v=>v/l);};
 const qr=(q,p)=>qm(qm(q,[...p,0]),qi(q)).slice(0,3);
 const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
 const unit=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
 const between=(from,to)=>{
  const a=unit(from),b=unit(to),d=a.reduce((s,v,i)=>s+v*b[i],0);
  if(d<-.999999){let axis=cross(a,[1,0,0]);if(Math.hypot(...axis)<1e-5)axis=cross(a,[0,1,0]);return [...unit(axis),0];}
  return qn([...cross(a,b),1+d]);
 };
 const parents=[-1,0,1,2,3,4,5,4,7,8,9,0,11,12,4,14,15,16,0,18,19];
 function sample(clip,time){
  if(typeof clip.sample==='function')return clip.sample(time);
  const f=Math.max(0,Math.min(clip.frames.length-1,time*clip.fps)),i=Math.floor(f),j=Math.min(i+1,clip.frames.length-1),a=f-i;
  const first=clip.frames[i],second=clip.frames[j];
  return {directions:first.directions.map((d,b)=>d?unit(d.map((v,k)=>v*(1-a)+second.directions[b][k]*a)):null),joints:first.joints.map((p,b)=>p.map((v,k)=>v*(1-a)+second.joints[b][k]*a)),root:first.root.map((v,k)=>v*(1-a)+second.root[k]*a),q:first.q.map((q,b)=>{const s=q.reduce((n,v,k)=>n+v*second.q[b][k],0)<0?-1:1;return qn(q.map((v,k)=>v*(1-a)+second.q[b][k]*a*s));})};
 }
 function matrices(weights,frame,clip){
  const rig=root.Anatomy.getRig(),ts=root.Anatomy.transforms(weights),height=root.Anatomy.ratios(weights).height;
  const heads=rig.bones.map((b,i)=>{const {A,t}=ts[i],h=b.head;return [0,1,2].map(j=>(A[j*3]*h[0]+A[j*3+1]*h[1]+A[j*3+2]*h[2]+t[j])*height);});
  // Match actual source segment directions, not just rotation deltas: the
  // source uses a T rest pose while this mesh was sculpted in an A rest pose.
  // The shortest swing corrects that rest-axis difference while retaining the
  // source animation's axial twist. Spine helper axes deliberately retain
  // their authored bind frames; aligning those with joint directions would
  // bend the torso mesh. Translation/helper channels are included
  // in the source directions exported from the evaluated hierarchy.
  const q=frame.q.map((rotation,i)=>{
    const dir=frame.directions?.[i];
    if(!dir||![7,8,9,11,12,14,15,16,18,19].includes(i))return rotation;
    const b=rig.bones[i],tr=ts[i],v=b.tail.map((x,k)=>x-b.head[k]);
    const axis=[0,1,2].map(k=>tr.A[k*3]*v[0]+tr.A[k*3+1]*v[1]+tr.A[k*3+2]*v[2]);
    return qn(qm(between(qr(rotation,axis),dir),rotation));
  });
  // End effectors inherit the same bind-axis correction as the adjacent limb;
  // preserve their source relative wrist/ankle rotation instead of twisting
  // the hand/foot back towards the incompatible original A-pose frame.
  for(const [child,parent] of [[10,9],[13,12],[17,16],[20,19]]){
    q[child]=qn(qm(qm(frame.q[child],qi(frame.q[parent])),q[parent]));
  }
  if(frame.additive&&root.AnatomyPose.additive)root.AnatomyPose.additive(q,heads,parents,frame.additive);
  const rootScale=heads[0][2]/Math.abs(clip.sourceHipHeight),posed=[],duals=[];
  for(let i=0;i<heads.length;i++){
   const p=parents[i],h=heads[i];
   posed[i]=p<0?h.map((v,k)=>v+frame.root[k]*rootScale):qr(q[p],h.map((v,k)=>v-heads[p][k])).map((v,k)=>v+posed[p][k]);
   const rotated=qr(q[i],h),t=posed[i].map((v,k)=>v-rotated[k]);
   duals[i]=qm([...t,0],q[i]).map(v=>v*.5);
  }
  return {q,d:duals,heads,posed,parents};
 }
 const sparseSkin=new WeakMap();
 function apply(rest,out,weights,frame,clip,part='body',selected=null,prepared=null){
  const skin=root.Anatomy.getSkin(part),m=prepared||matrices(weights,frame,clip),B=m.q.length;
  let sparse=sparseSkin.get(skin);if(!sparse||sparse.bones!==B){const offsets=new Uint32Array(rest.length/3+1),ids=[],values=[];for(let vertex=0;vertex<rest.length/3;vertex++){offsets[vertex]=ids.length;for(let bone=0;bone<B;bone++){const weight=skin[vertex*B+bone];if(weight>=1e-8){ids.push(bone);values.push(weight);}}}offsets[rest.length/3]=ids.length;sparse={bones:B,offsets,ids:Uint8Array.from(ids),values:Float64Array.from(values)};sparseSkin.set(skin,sparse);}
  const count=selected?selected.length:rest.length/3;
  for(let vertex=0;vertex<count;vertex++){const i=(selected?selected[vertex]:vertex)*3;
   let rx=0,ry=0,rz=0,rw=0,dx=0,dy=0,dz=0,dw=0;
   for(let cursor=sparse.offsets[i/3];cursor<sparse.offsets[i/3+1];cursor++){
    const b=sparse.ids[cursor];let w=sparse.values[cursor];const q=m.q[b],d=m.d[b];
    if(rx*q[0]+ry*q[1]+rz*q[2]+rw*q[3]<0)w=-w;
    rx+=w*q[0];ry+=w*q[1];rz+=w*q[2];rw+=w*q[3];dx+=w*d[0];dy+=w*d[1];dz+=w*d[2];dw+=w*d[3];
   }
   const l=Math.hypot(rx,ry,rz,rw);rx/=l;ry/=l;rz/=l;rw/=l;dx/=l;dy/=l;dz/=l;dw/=l;
   const x=rest[i],y=rest[i+1],z=rest[i+2];
   const tx=2*(ry*z-rz*y),ty=2*(rz*x-rx*z),tz=2*(rx*y-ry*x);
   out[i]=x+rw*tx+ry*tz-rz*ty+2*(-dw*rx+dx*rw-dy*rz+dz*ry);
   out[i+1]=y+rw*ty+rz*tx-rx*tz+2*(-dw*ry+dx*rz+dy*rw-dz*rx);
   out[i+2]=z+rw*tz+rx*ty-ry*tx+2*(-dw*rz-dx*ry+dy*rx+dz*rw);
  }
  return out;
 }
 root.AnatomyPose={sample,matrices,apply,parents,qm,qr};
})(typeof window!=='undefined'?window:globalThis);
