/* Parametric anatomy: calibrated rest skeleton + normalized surface skin weights.
 * Native shape keys run before modelling-rig transforms. The Blender generator
 * reproduces the same transforms with ordinary armature drivers. */
(function(root){
  const specs = [
    ['height','Общий рост',.65,1.5],['leg_len','Длина ног',.55,1.65],
    ['torso_len','Длина корпуса',.65,1.5],['arm_len','Длина рук',.6,1.5],
    ['arm_w','Объём рук',.6,1.65],['hand_size','Размер кистей',.65,1.5],
    ['hip_w','Ширина таза',.6,1.65],['waist_w','Ширина талии',.5,1.8],
    ['chest_w','Ширина грудной клетки',.65,1.65],['shoulder_w','Ширина плеч',.65,1.6],
    ['thigh_w','Ширина ляжек',.5,1.8],['calf_w','Ширина голеней',.5,1.8],
    ['neck_len','Длина шеи',.55,1.5],['neck_w','Толщина шеи',.55,1.5],
    ['head_size','Размер головы',.65,1.5],['head_w','Ширина головы',.7,1.4],
    ['bust_d','Глубина грудной области',.55,1.8],['glute_d','Глубина таза / ягодиц',.55,1.8],
    ['thigh_d','Глубина ляжек',.5,1.8],['calf_d','Глубина голеней',.5,1.8],
    ['torso_d','Глубина корпуса',.6,1.8],['foot_size','Размер стоп',.65,1.5]
  ];
  const controls=specs.map(([name,nameRu,lo,hi])=>({name,nameRu,lo,hi,min:-1,max:1,mm:999,group:'мои ручки',w:0,procedural:true}));
  function ratios(weights){return Object.fromEntries(controls.map(c=>{const v=Number(weights[c.name]||0);const w=Number.isFinite(v)?Math.max(-1,Math.min(1,v)):0;const response=w*(.35+.65*w*w);return [c.name,Math.exp(response*(w<0?-Math.log(c.lo):Math.log(c.hi)))];}));}
  let rig=null, bodyWeights=null, faceWeights=null,fields={};
  function configure(data){
    rig=data; const decode=s=>{const b=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return new Float32Array(b.buffer);};
    bodyWeights=decode(data.body);faceWeights=decode(data.face);
    fields=Object.fromEntries(['body','face'].map(part=>[part,Object.entries(data.fields?.[part]||{}).map(([name,s])=>({name,delta:decode(s)}))]));
  }
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const mul=(a,s)=>a.map(v=>v*s);
  const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const unit=a=>mul(a,1/Math.hypot(...a));
  function transforms(weights){
    if(!rig)throw Error('Missing anatomical rig');
    const r=ratios(weights),by=Object.fromEntries(rig.bones.map(b=>[b.name,b]));
    const ankle=by['foot.l'].head[2],hip=by['thigh.l'].head[2];
    const lift=(hip-ankle)*(r.leg_len-1);
    const torso=p=>[p[0],p[1],hip+lift+(p[2]-hip)*r.torso_len];
    const neckAnchor=torso(by.neck.head),originalHead=torso(by.head.head),headAnchor=originalHead.map((v,k)=>neckAnchor[k]+(v-neckAnchor[k])*r.neck_len);
    const arms={};
    for(const side of ['l','r']){
      const shoulder=by['upperarm.'+side].head;
      const sh=torso(shoulder);sh[0]*=r.shoulder_w*Math.sqrt(r.chest_w);
      const elbow=add(sh,mul(sub(by['forearm.'+side].head,shoulder),r.arm_len));
      const wrist=add(elbow,mul(sub(by['hand.'+side].head,by['forearm.'+side].head),r.arm_len));
      arms[side]={sh,elbow,wrist};
    }
    return rig.bones.map(b=>{
      const h=b.head, name=b.name,side=name.slice(-1);let nh=torso(h),sx=1,sy=1,sz=r.torso_len,A=null;
      if(name==='pelvis'){sx=sy=1;sz=1;nh=[h[0],h[1],h[2]+lift];}
      if(name==='waist'||name==='abdomen'){sx=sy=1;}
      if(name==='chest'){sx=sy=1;}
      if(name==='upperchest'){sx=sy=1;}
      if(name==='neck'){const u=unit(sub(by.head.head,h)),D=[1,1,r.torso_len];A=Array.from({length:9},(_,j)=>{const row=Math.floor(j/3),col=j%3;return D[row]*((row===col?1:0)+(r.neck_len-1)*u[row]*u[col]);});}
      if(name==='head'){sx=r.head_size*r.head_w;sy=sz=r.head_size;nh=headAnchor;}
      if(name.startsWith('shoulder.')){nh[0]=h[0]*r.shoulder_w*Math.sqrt(r.chest_w);}
      if(name.startsWith('upperarm.')||name.startsWith('forearm.')){
        const upper=name.startsWith('upperarm.');nh=upper?arms[side].sh:arms[side].elbow;
        // Local frame: length follows the actual A-pose bone, girth is transverse.
        const u=unit(sub(b.tail,h)),v=unit(cross([0,1,0],u)),w=unit(cross(u,v));
        const girth=1;
        A=Array.from({length:9},(_,j)=>{const row=Math.floor(j/3),col=j%3;return r.arm_len*u[row]*u[col]+girth*v[row]*v[col]+girth*w[row]*w[col];});
      }
      if(name.startsWith('hand.')){nh=arms[side].wrist;sx=sy=sz=r.hand_size;}
      if(name.startsWith('thigh.')||name.startsWith('shin.')){
        const thigh=name.startsWith('thigh.');const root=by['thigh.'+side].head;
        nh=[h[0]+root[0]*(r.hip_w-1),h[1],ankle+(h[2]-ankle)*r.leg_len];
        const u=unit(sub(b.tail,h)),v=unit(cross([0,1,0],u)),w=unit(cross(u,v));
        const width=1,depth=1;
        A=Array.from({length:9},(_,j)=>{const row=Math.floor(j/3),col=j%3;return r.leg_len*u[row]*u[col]+width*v[row]*v[col]+depth*w[row]*w[col];});
      }
      if(name.startsWith('foot.')){nh=[h[0]+by['thigh.'+side].head[0]*(r.hip_w-1),h[1],h[2]];sx=sy=sz=r.foot_size;}
      A=A||[sx,0,0,0,sy,0,0,0,sz];
      const t=nh.map((v,j)=>v-A[j*3]*h[0]-A[j*3+1]*h[1]-A[j*3+2]*h[2]);
      return {A,t};
    });
  }
  // Smooth the displacement, not the anatomy itself, across the hip/thigh
  // skin-weight boundary. Weld UV duplicates so the correction cannot split seams.
  let pelvisSurface=null;
  function smoothPelvis(source,out,r){
    if(!root.EVA||Math.max(Math.abs(r.hip_w-1),Math.abs(r.thigh_w-1),Math.abs(r.thigh_d-1))<1e-8)return;
    if(!pelvisSurface){
      const decode=s=>{const b=Uint8Array.from(atob(s),c=>c.charCodeAt(0));return b.buffer;},base=new Float32Array(decode(root.EVA.base)),ix=new Uint32Array(decode(root.EVA.index));
      const map=new Map(),ids=[],points=[];for(let i=0;i<base.length;i+=3){const key=Array.from(base.subarray(i,i+3),v=>Math.round(v*1e6)).join(':');if(!map.has(key)){map.set(key,map.size);points.push(Array.from(base.subarray(i,i+3)));}ids.push(map.get(key));}
      const links=points.map(()=>new Set());for(let i=0;i<ix.length;i+=3)for(let k=0;k<3;k++){const a=ids[ix[i+k]],b=ids[ix[i+(k+1)%3]];if(a!==b){links[a].add(b);links[b].add(a);}}
      const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
      const mask=points.map(([x,y,z])=>smooth(.66,.77,z)*(1-smooth(1.01,1.09,z))*smooth(.035,.085,Math.abs(x)));
      pelvisSurface={ids,links,mask,count:points.length};
    }
    const {ids,links,mask,count}=pelvisSurface,delta=new Float64Array(count*3),counts=new Uint32Array(count);
    for(let i=0;i<ids.length;i++){const j=ids[i];counts[j]++;for(let k=0;k<3;k++)delta[j*3+k]+=out[i*3+k]-source[i*3+k]*r.height;}
    for(let j=0;j<count;j++)for(let k=0;k<3;k++)delta[j*3+k]/=counts[j];
    let filtered=delta;for(let pass=0;pass<20;pass++){const next=filtered.slice();for(let j=0;j<count;j++){if(!mask[j]||!links[j].size)continue;for(let k=0;k<3;k++){let sum=0;for(const b of links[j])sum+=filtered[b*3+k];next[j*3+k]=filtered[j*3+k]+.65*mask[j]*(sum/links[j].size-filtered[j*3+k]);}}filtered=next;}
    for(let i=0;i<ids.length;i++){const j=ids[i];for(let k=0;k<3;k++)out[i*3+k]+=mask[j]*(filtered[j*3+k]-delta[j*3+k]);}
  }
  function deform(source,out,weights,part='body'){
    const input=part==='body'&&source===out?source.slice():source;
    const skin=part==='face'?faceWeights:bodyWeights,ts=transforms(weights),r=ratios(weights),B=ts.length;
    if(skin.length!==source.length/3*B)throw Error('Skin topology mismatch: '+part);
    for(let i=0;i<source.length;i+=3){
      let x=source[i],y=source[i+1],z=source[i+2];
      for(const field of fields[part]){const amount=r[field.name]-1;x+=field.delta[i]*amount;y+=field.delta[i+1]*amount;z+=field.delta[i+2]*amount;}
      let ox=0,oy=0,oz=0;
      for(let b=0;b<B;b++){
        const w=skin[i/3*B+b];if(w<1e-9)continue;const {A,t}=ts[b];
        ox+=w*(A[0]*x+A[1]*y+A[2]*z+t[0]);
        oy+=w*(A[3]*x+A[4]*y+A[5]*z+t[1]);
        oz+=w*(A[6]*x+A[7]*y+A[8]*z+t[2]);
      }
      out[i]=ox*r.height;out[i+1]=oy*r.height;out[i+2]=oz*r.height;
    }
    if(part==='body')smoothPelvis(input,out,r);
    return out;
  }
  root.Anatomy={controls,ratios,configure,transforms,deform,getRig:()=>rig,getSkin:part=>part==='face'?faceWeights:bodyWeights};
  if(typeof module!=='undefined')module.exports=root.Anatomy;
})(typeof window!=='undefined'?window:globalThis);
