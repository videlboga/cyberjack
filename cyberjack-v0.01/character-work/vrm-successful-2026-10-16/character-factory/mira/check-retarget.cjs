const fs=require('fs'),assert=require('assert/strict');global.window={};
for(const file of ['evanescia-data.js','anatomy-rig.js','anatomy.js','dance-data.js','work/v3-retarget/anatomy-pose.js'])Function('window',fs.readFileSync(file,'utf8'))(window);
const old=window.AnatomyPose;Function('window',fs.readFileSync('anatomy-pose.js','utf8'))(window);const P=window.AnatomyPose,A=window.Anatomy;A.configure(window.ANATOMY_RIG);
const decode=(s,T=Float32Array)=>{const b=Buffer.from(s,'base64');return new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const base=decode(window.EVA.base),index=decode(window.EVA.index,Uint32Array),W=A.getSkin('body'),bones=A.getRig().bones,clip=window.ANATOMY_DANCE,B=bones.length;
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],unit=a=>a.map(v=>v/Math.hypot(...a));
const torso=[];for(let t=0;t<index.length;t+=3){if([0,1,2].every(j=>{const v=index[t+j];let w=0;for(let b=0;b<5;b++)w+=W[v*B+b];return w>.85;}))torso.push([index[t]*3,index[t+1]*3,index[t+2]*3]);}
function hits(a,b,V){
 const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2];
 const minx=Math.min(a[0],b[0]),maxx=Math.max(a[0],b[0]),miny=Math.min(a[1],b[1]),maxy=Math.max(a[1],b[1]),minz=Math.min(a[2],b[2]),maxz=Math.max(a[2],b[2]);
 for(const [i,j,k]of torso){
  const x=V[i],y=V[i+1],z=V[i+2],jx=V[j],jy=V[j+1],jz=V[j+2],kx=V[k],ky=V[k+1],kz=V[k+2];
  if(maxx<Math.min(x,jx,kx)||minx>Math.max(x,jx,kx)||maxy<Math.min(y,jy,ky)||miny>Math.max(y,jy,ky)||maxz<Math.min(z,jz,kz)||minz>Math.max(z,jz,kz))continue;
  const ex=jx-x,ey=jy-y,ez=jz-z,fx=kx-x,fy=ky-y,fz=kz-z,px=dy*fz-dz*fy,py=dz*fx-dx*fz,pz=dx*fy-dy*fx;
  const det=ex*px+ey*py+ez*pz;if(Math.abs(det)<1e-10)continue;
  const sx=a[0]-x,sy=a[1]-y,sz=a[2]-z,u=(sx*px+sy*py+sz*pz)/det;if(u<0||u>1)continue;
  const qx=sy*ez-sz*ey,qy=sz*ex-sx*ez,qz=sx*ey-sy*ex,v=(dx*qx+dy*qy+dz*qz)/det;if(v<0||u+v>1)continue;
  const t=(fx*qx+fy*qy+fz*qz)/det;if(t>.001&&t<.999)return true;
 }return false;
}
const result={directionBones:['upperarm.l','forearm.l','thigh.l','shin.l','upperarm.r','forearm.r','thigh.r','shin.r'],intersectionScope:'Elbow-to-wrist centreline against torso triangles with >85% torso skin weights; not a full hand/skin collision test',clip:clip.name,frames:clip.frames.length,torsoTriangles:torso.length,variants:[],maxDirectionErrorDeg:0,oldMaxDirectionErrorDeg:0};
for(const [name,params]of [['base',{}],['plus30',Object.fromEntries(A.controls.map(c=>[c.name,.3]))],['minus30',Object.fromEntries(A.controls.map(c=>[c.name,-.3]))]]){
 const rest=A.deform(base,new Float32Array(base.length),params),out=new Float32Array(rest.length),oldOut=new Float32Array(rest.length),ts=A.transforms(params);let oldFrames=[],newFrames=[];
 for(let f=0;f<clip.frames.length;f++){
  const frame=clip.frames[f],m=P.matrices(params,frame,clip),om=old.matrices(params,frame,clip);
  for(const b of [8,9,11,12,15,16,18,19]){
   const v=sub(bones[b].tail,bones[b].head),axis=[0,1,2].map(j=>dot(ts[b].A.slice(j*3,j*3+3),v)),goal=frame.directions[b];
   const error=q=>Math.acos(Math.max(-1,Math.min(1,dot(unit(P.qr(q,axis)),goal))))*180/Math.PI;
   result.maxDirectionErrorDeg=Math.max(result.maxDirectionErrorDeg,error(m.q[b]));result.oldMaxDirectionErrorDeg=Math.max(result.oldMaxDirectionErrorDeg,error(om.q[b]));
  }
  P.apply(rest,out,params,frame,clip);old.apply(rest,oldOut,params,frame,clip);
  let oldHit=false,newHit=false;
  for(const [elbow,wrist]of [[9,10],[16,17]]){oldHit||=hits(om.posed[elbow],om.posed[wrist],oldOut);newHit||=hits(m.posed[elbow],m.posed[wrist],out);}
  if(oldHit)oldFrames.push(f);if(newHit)newFrames.push(f);
 }
 result.variants.push({name,oldForearmTorsoCrossingFrames:oldFrames.length,newForearmTorsoCrossingFrames:newFrames.length,remainingTimes:newFrames.map(f=>+(f/clip.fps).toFixed(3)),beforeAtScreenshot:oldFrames.includes(229),afterAtScreenshot:newFrames.includes(229)});
 console.log(name,result.variants.at(-1));
}
assert(result.maxDirectionErrorDeg<.001);fs.writeFileSync('work/retarget-validation.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
