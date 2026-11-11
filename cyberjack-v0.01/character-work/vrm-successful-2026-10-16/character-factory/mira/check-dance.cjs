const fs=require('fs'),assert=require('assert/strict');global.window={};
for(const file of ['evanescia-data.js','anatomy-rig.js','anatomy.js','anatomy-pose.js','dance-data.js'])Function('window',fs.readFileSync(file,'utf8'))(window);
const A=window.Anatomy,P=window.AnatomyPose,clip=window.ANATOMY_DANCE;A.configure(window.ANATOMY_RIG);
const decode=(s,T=Float32Array)=>{const b=Buffer.from(s,'base64');return new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const base=decode(window.EVA.base),face=decode(window.EVA.face.base),index=decode(window.EVA.index,Uint32Array),faceIndex=decode(window.EVA.face.index,Uint32Array);
const variants=[
 ['base',{}],['plus30',Object.fromEntries(A.controls.map(c=>[c.name,.3]))],['minus30',Object.fromEntries(A.controls.map(c=>[c.name,-.3]))],
 ['slender',{hip_w:-.4,waist_w:-.65,thigh_w:-.5,calf_w:-.35,arm_w:-.35,leg_len:.4,head_size:-.1}],
 ['strong',{chest_w:.65,shoulder_w:.65,arm_w:.6,thigh_w:.5,thigh_d:.4,torso_d:.3,waist_w:-.2}],
 ['curvy',{hip_w:.6,waist_w:-.55,thigh_w:.45,glute_d:.6,bust_d:.45,head_size:-.1}],
 ['user',{hip_w:.3,waist_w:-.3},{BreastsSize:-.85,BreastsImplants:-.37,HipSize:-.7,BreastShape08:-.99,BreastShape04:-1,BreastsDiameter:.62,'Breast fix':.81}]
];
const seam=[],seen=new Map();for(let i=0;i<base.length;i+=3){const key=[base[i],base[i+1],base[i+2]].map(v=>v.toFixed(6)).join(',');if(seen.has(key))seam.push([i,seen.get(key)]);else seen.set(key,i);}
let maxJointError=0,maxSeamError=0;const reports=[],sceneFigures=[];
const frameMatrices=clip.frames.map(frame=>({q:frame.q,root:frame.root}));
for(const [name,weights,natives={}] of variants){
 const source=new Float32Array(base);
 for(const [key,amount] of Object.entries(natives)){const m=window.EVA.morphs.find(m=>m.name===key),q=decode(m.data,Int8Array);for(let i=0;i<source.length;i++)source[i]+=q[i]*m.scale*amount;}
 const rest=A.deform(source,new Float32Array(base.length),weights),restFace=A.deform(face,new Float32Array(face.length),weights,'face');
 const out=new Float32Array(rest.length),fout=new Float32Array(face.length);let extentMax=0,maxFrameStep=0;const previous=new Float32Array(rest.length);
 const snapshots=[];
 for(let f=0;f<clip.frames.length;f++){
  const frame=clip.frames[f],m=P.matrices(weights,frame,clip);
  for(let j=1;j<m.heads.length;j++){const p=P.parents[j],before=Math.hypot(...m.heads[j].map((v,k)=>v-m.heads[p][k])),after=Math.hypot(...m.posed[j].map((v,k)=>v-m.posed[p][k]));maxJointError=Math.max(maxJointError,Math.abs(before-after));}
  P.apply(rest,out,weights,frame,clip);P.apply(restFace,fout,weights,frame,clip,'face');assert(out.every(Number.isFinite)&&fout.every(Number.isFinite));
  if(f>0)for(let i=0;i<out.length;i+=3)maxFrameStep=Math.max(maxFrameStep,Math.hypot(out[i]-previous[i],out[i+1]-previous[i+1],out[i+2]-previous[i+2]));previous.set(out);
  for(const [a,b] of seam){const err=Math.hypot(...[0,1,2].map(k=>(out[a+k]-out[b+k])-(rest[a+k]-rest[b+k])));maxSeamError=Math.max(maxSeamError,err);assert(err<3e-5,'opened seam');}
  for(let i=0;i<out.length;i++)extentMax=Math.max(extentMax,Math.abs(out[i]));assert(extentMax<5,'exploding mesh');
  if([0,96,229,230,240,400].includes(f))snapshots.push({frame:f,body:Array.from(out),face:Array.from(fout)});
 }
 const ts=A.transforms(weights),height=A.ratios(weights).height;
 const tails=window.ANATOMY_RIG.bones.map((b,i)=>[0,1,2].map(j=>(ts[i].A[j*3]*b.tail[0]+ts[i].A[j*3+1]*b.tail[1]+ts[i].A[j*3+2]*b.tail[2]+ts[i].t[j])*height));
 const heads=P.matrices(weights,clip.frames[0],clip).heads;
 sceneFigures.push({name,weights,natives,body:Array.from(rest),face:Array.from(restFace),heads,tails,snapshots,poses:clip.frames.map(frame=>{const m=P.matrices(weights,frame,clip);return {q:m.q,heads:m.posed};})});
 reports.push({name,weights,natives,frames:clip.frames.length,extentMax,maxFrameStep});console.log(name,'tested',clip.frames.length,'frames');
}
assert(maxJointError<1e-6);assert(maxSeamError<3e-5);
const activity=clip.bones.map((name,b)=>({name,degrees:Math.max(...clip.frames.map(f=>2*Math.acos(Math.min(1,Math.abs(f.q[b].reduce((s,v,k)=>s+v*clip.frames[0].q[b][k],0))))*180/Math.PI))}));
const report={clip:{name:clip.name,id:clip.id,origin:clip.origin,duration:clip.duration,fps:clip.fps},figures:reports,totalFrames:reports.length*clip.frames.length,maxJointError,maxSeamError,activity,scope:'21 body joints, rest geometry and dual-quaternion skinning. No finger, cloth, collision or original IK-controller simulation.'};
fs.writeFileSync('work/dance-validation.json',JSON.stringify(report,null,2));fs.writeFileSync('work/dance-scene.json',JSON.stringify({clip:{name:clip.name,fps:clip.fps,frames:clip.frames.length},bones:window.ANATOMY_RIG.bones,parents:P.parents,index:Array.from(index),faceIndex:Array.from(faceIndex),skin:{body:window.ANATOMY_RIG.body,face:window.ANATOMY_RIG.face},figures:sceneFigures}));
console.log(JSON.stringify({totalFrames:report.totalFrames,maxJointError,maxSeamError}));
