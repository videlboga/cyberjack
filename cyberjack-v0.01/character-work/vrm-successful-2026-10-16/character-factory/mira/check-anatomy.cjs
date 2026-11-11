const fs=require('node:fs'),assert=require('node:assert/strict');
global.window={};for(const file of ['evanescia-data.js','anatomy-rig.js','anatomy.js'])Function('window',fs.readFileSync(__dirname+'/'+file,'utf8'))(window);
const {controls,deform,transforms}=window.Anatomy;window.Anatomy.configure(window.ANATOMY_RIG);
const e=window.EVA;
const decode=(s,T)=>{const b=Buffer.from(s,'base64');return new T(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));};
const base=decode(e.base,Float32Array),index=decode(e.index,Uint32Array),face=decode(e.face.base,Float32Array),out=new Float32Array(base.length);
const widths=controls.filter(c=>/_w$|_d$/.test(c.name));
const cases=[{},...controls.flatMap(c=>[{[c.name]:-1},{[c.name]:1},{[c.name]:-.3},{[c.name]:.3}]),...widths.flatMap(c=>[{[c.name]:-.01},{[c.name]:.01}])];
let seed=42;const random=()=>((seed=(1664525*seed+1013904223)>>>0)/4294967296);
for(let i=0;i<64;i++)cases.push(Object.fromEntries(controls.map(c=>[c.name,random()*2-1])));
cases.push(Object.fromEntries(controls.map(c=>[c.name,-.3])),Object.fromEntries(controls.map(c=>[c.name,.3])),Object.fromEntries(controls.map(c=>[c.name,-1])),Object.fromEntries(controls.map(c=>[c.name,1])));
const edges=[];for(let i=0;i<index.length;i+=3)for(let k=0;k<3;k++){const a=index[i+k]*3,b=index[i+(k+1)%3]*3;const len=Math.hypot(...[0,1,2].map(j=>base[a+j]-base[b+j]));if(len>1e-7)edges.push([a,b,len]);}
const coincident=[],seen=new Map();for(let i=0;i<base.length;i+=3){const key=[base[i],base[i+1],base[i+2]].map(v=>v.toFixed(6)).join(',');if(seen.has(key))coincident.push([i,seen.get(key)]);else seen.set(key,i);}
const normal=(p,t)=>{const a=index[t]*3,b=index[t+1]*3,c=index[t+2]*3;const u=[0,1,2].map(j=>p[b+j]-p[a+j]),v=[0,1,2].map(j=>p[c+j]-p[a+j]);return [u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];};
let min=Infinity,max=0,smallChangeFlips=0,maxSeamError=0;
for(const weights of cases){
 deform(base,out,weights);assert(out.every(Number.isFinite));
 if(!Object.keys(weights).length)for(let i=0;i<base.length;i++)assert(Math.abs(base[i]-out[i])<1e-6,'identity');
 const f=deform(face,new Float32Array(face.length),weights,'face');assert(f.every(Number.isFinite));
 for(const [a,b,len] of edges){const ratio=Math.hypot(...[0,1,2].map(j=>out[a+j]-out[b+j]))/len;min=Math.min(min,ratio);max=Math.max(max,ratio);assert(ratio>1e-4&&ratio<30,'collapsed or exploding edge');}
 for(const [a,b] of coincident){const err=Math.hypot(...[0,1,2].map(j=>(out[a+j]-out[b+j])-(base[a+j]-base[b+j])));maxSeamError=Math.max(maxSeamError,err);assert(err<2e-5,'seam opened');}
 if(Object.values(weights).length>0&&Object.values(weights).every(v=>[.01,.3].includes(Math.abs(v)))){
  for(let t=0;t<index.length;t+=3){const a=normal(base,t),b=normal(out,t);if(Math.hypot(...a)>1e-9&&a.reduce((s,v,j)=>s+v*b[j],0)<0){smallChangeFlips++;console.log('FLIP',JSON.stringify(weights),'triangle',t/3,'point',Array.from(base.slice(index[t]*3,index[t]*3+3)),'area',Math.hypot(...a));}}
 }
 const inplace=new Float32Array(base);deform(inplace,inplace,weights);assert.deepEqual(inplace,out);
}
assert.equal(smallChangeFlips,0,'small and 30%-slider changes must not invert triangles');
// Both arm segments must lengthen about their anatomical joints; hands translate.
const bones=window.ANATOMY_RIG.bones;
const point=(tr,p)=>[0,1,2].map(i=>tr.A[i*3]*p[0]+tr.A[i*3+1]*p[1]+tr.A[i*3+2]*p[2]+tr.t[i]);
for(const value of [-1,1]){
 const ts=transforms({arm_len:value}),ratio=window.Anatomy.ratios({arm_len:value}).arm_len;
 for(const side of ['l','r'])for(const name of ['upperarm','forearm']){
  const i=bones.findIndex(b=>b.name===name+'.'+side),b=bones[i];const h=point(ts[i],b.head),t=point(ts[i],b.tail);
  const scale=Math.hypot(...t.map((v,j)=>v-h[j]))/Math.hypot(...b.tail.map((v,j)=>v-b.head[j]));assert(Math.abs(scale-ratio)<1e-6,`${name} length`);
 }
}
console.log(JSON.stringify({cases:cases.length,vertices:base.length/3,smallChangeFlips,maxSeamError,edgeRatio:[min,max],armSegments:'both verified'}));
