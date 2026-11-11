// Pose-space correction only: source topology, UVs, and rig weights stay intact.
import * as T from './vendor/three/three.module.js';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function correctHipPose(rest,out,pose,skin,index){
 const original=index?out.slice():null;
 const q=pose.q.map(v=>new T.Quaternion().fromArray(v)),n=q.length;
 const pelvis=q[0].clone().invert(),flex=[11,18].map(i=>{const r=pelvis.clone().multiply(q[i]);return smooth(.65,1.65,2*Math.acos(Math.min(1,Math.abs(r.w))));});
 const strength=Math.max(...flex);if(strength<1e-6)return;
 const v=new T.Vector3(),sum=new T.Vector3(),point=new T.Vector3();
 for(let i=0;i<rest.length;i+=3){
  const x=rest[i],y=rest[i+1],z=rest[i+2],hip=pose.heads[0],dz=z-hip[2];
  const region=smooth(-.28,-.12,dz)*(1-smooth(.02,.12,dz));
  const back=smooth(.005,.07,y-hip[1]);
  // Reduce rotation-blend bulging on the front hip crease as well as the glutes.
  const front=(1-smooth(-.055,-.005,y-hip[1]))*smooth(.025,.065,Math.abs(x-hip[0]))*(1-smooth(.14,.19,Math.abs(x-hip[0])));
  const localFlex=flex[x>=hip[0]?0:1];
  const amount=region*(.55*strength*back+.65*localFlex*front);if(amount<1e-6)continue;
  sum.set(0,0,0);
  for(let b=0;b<n;b++){const w=skin[i/3*n+b];if(w<1e-8)continue;v.set(x-pose.heads[b][0],y-pose.heads[b][1],z-pose.heads[b][2]).applyQuaternion(q[b]);v.x+=pose.posed[b][0];v.y+=pose.posed[b][1];v.z+=pose.posed[b][2];sum.addScaledVector(v,w);}
  point.fromArray(out,i).lerp(sum,amount).toArray(out,i);
 }
 if(index){preserveFaces(original,out,index);relaxLowerAbdomen(rest,out,pose,q[0],strength,index,original);}
}
// Smooth the compressed posed surface with fixed exterior anchors.
const adjacency=new WeakMap();
function relaxLowerAbdomen(rest,out,pose,rotation,strength,index,original){
 let neighbors=adjacency.get(index);if(!neighbors){const sets=Array.from({length:rest.length/3},()=>new Set());for(let k=0;k<index.length;k+=3)for(let j=0;j<3;j++){const a=index[k+j],b=index[k+(j+1)%3];sets[a].add(b);sets[b].add(a);}neighbors=sets.map(s=>Array.from(s));adjacency.set(index,neighbors);}
 const hip=pose.heads[0],initial=out.slice(),current=out.slice(),next=out.slice(),weights=new Float32Array(rest.length/3),active=[];
 for(let i=0;i<rest.length;i+=3){
  const z=rest[i+2]-hip[2],x=Math.abs(rest[i]-hip[0]),front=1-smooth(-.055,-.005,rest[i+1]-hip[1]);
  // Broad support includes the upper thigh as an anchor. Protect the central
  // lower pelvis and fade smoothly into the unchanged abdomen and flank.
  const center=smooth(-.10,-.025,z)+(1-smooth(-.10,-.025,z))*smooth(.025,.065,x);
  const w=strength*front*center*smooth(-.27,-.16,z)*(1-smooth(.055,.17,z))*(1-smooth(.12,.21,x));
  weights[i/3]=w;if(w>1e-5)active.push(i/3);
 }
 // Fair the posed surface itself. A soft positional anchor prevents shrinkage;
 // no rest-space curvature is added back into the compressed hip crease.
 for(let pass=0;pass<24;pass++){
  for(const id of active){const ring=neighbors[id];if(!ring.length)continue;for(let k=0;k<3;k++){
   let mean=0;for(const j of ring)mean+=current[j*3+k];
   const i=id*3+k,target=(mean/ring.length+.06*initial[i])/1.06;
   next[i]=current[i]+.45*weights[id]*(target-current[i]);
  }}current.set(next);
 }
 // Restore a shallow convex abdominal envelope after fairing. Transport
 // the broad volume field with the pelvis; never move the posterior surface.
 const forward=new T.Vector3(0,-1,0).applyQuaternion(rotation);
 for(const id of active){
  const i=id*3,z=rest[i+2]-hip[2];
  const volume=.008*weights[id]*smooth(-.16,-.07,z)*(1-smooth(.035,.13,z));
  current[i]+=forward.x*volume;current[i+1]+=forward.y*volume;current[i+2]+=forward.z*volume;
 }
 // Scale the complete field, never isolated vertices: local clamps create
 // steps. Reject orientation changes without disturbing the accepted back.
 let max=0;for(const id of active){const i=id*3;max=Math.max(max,Math.hypot(current[i]-initial[i],current[i+1]-initial[i+1],current[i+2]-initial[i+2]));}
 let scale=Math.min(1,.025/(max||1));
 const normals=[];for(const reference of [initial,original])for(let i=0;i<index.length;i+=3){const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;if(!weights[a/3]&&!weights[b/3]&&!weights[c/3])continue;const u=new T.Vector3().fromArray(reference,b).sub(new T.Vector3().fromArray(reference,a)),v=new T.Vector3().fromArray(reference,c).sub(new T.Vector3().fromArray(reference,a)),n=u.cross(v);if(n.lengthSq()>1e-20)normals.push({a,b,c,n,min:n.lengthSq()*.1});}
 for(let attempt=0;attempt<12;attempt++){
  for(const id of active)for(let k=0;k<3;k++){const i=id*3+k;out[i]=initial[i]+scale*(current[i]-initial[i]);}
  const bad=normals.some(({a,b,c,n,min})=>new T.Vector3().fromArray(out,b).sub(new T.Vector3().fromArray(out,a)).cross(new T.Vector3().fromArray(out,c).sub(new T.Vector3().fromArray(out,a))).dot(n)<min);
  if(!bad)return;scale*=.5;
 }
 out.set(initial);
}

function preserveFaces(original,out,index){
 const faces=[];
 for(let i=0;i<index.length;i+=3){
  const a=index[i]*3,b=index[i+1]*3,c=index[i+2]*3;
  if([a,b,c].every(j=>out[j]===original[j]&&out[j+1]===original[j+1]&&out[j+2]===original[j+2]))continue;
  const ux=original[b]-original[a],uy=original[b+1]-original[a+1],uz=original[b+2]-original[a+2],vx=original[c]-original[a],vy=original[c+1]-original[a+1],vz=original[c+2]-original[a+2];
  const nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx,area=nx*nx+ny*ny+nz*nz;
  if(area>1e-20)faces.push(a,b,c,nx,ny,nz,area*.1);
 }
 const bad=new Uint8Array(out.length/3),ids=[];
 for(let pass=0;pass<16;pass++){
  ids.length=0;
  for(let i=0;i<faces.length;i+=7){
   const a=faces[i],b=faces[i+1],c=faces[i+2],ux=out[b]-out[a],uy=out[b+1]-out[a+1],uz=out[b+2]-out[a+2],vx=out[c]-out[a],vy=out[c+1]-out[a+1],vz=out[c+2]-out[a+2];
   if(faces[i+3]*(uy*vz-uz*vy)+faces[i+4]*(uz*vx-ux*vz)+faces[i+5]*(ux*vy-uy*vx)<faces[i+6]){
    for(const j of [a,b,c])if(!bad[j/3]){bad[j/3]=1;ids.push(j);}
   }
  }
  if(!ids.length)return;
  for(const j of ids){bad[j/3]=0;for(let k=0;k<3;k++)out[j+k]=original[j+k]+(out[j+k]-original[j+k])*.5;}
 }
 // Fail closed if a degenerate source region cannot accept the correction.
 out.set(original);
}
