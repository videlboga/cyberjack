const add=(a,b)=>a.map((v,k)=>v+b[k]),sub=(a,b)=>a.map((v,k)=>v-b[k]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const unit=a=>mul(a,1/Math.max(1e-12,Math.hypot(...a)));
const qm=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qi=q=>[-q[0],-q[1],-q[2],q[3]],qr=(q,v)=>qm(qm(q,[...v,0]),qi(q)).slice(0,3);
const turn=(axis,degrees)=>[...mul(axis,Math.sin(degrees*Math.PI/360)),Math.cos(degrees*Math.PI/360)];
const rotation=(q,p)=>({q,t:sub(p,qr(q,p))});
const compose=(a,b)=>({q:qm(a.q,b.q),t:add(qr(a.q,b.t),a.t)});
export function createNativeToeDeformer(data){
 const vertices=new Map();
 for(const [i,pair] of data.pairs.entries())for(const [part,bone] of ['root','tip'].entries())for(const [id,w] of pair[bone].weights){if(!vertices.has(id))vertices.set(id,[]);vertices.get(id).push([i*2+part,w]);}
 const compiled=[...vertices].map(([id,weights])=>{const total=weights.reduce((s,[,w])=>s+w,0);return {id,weights,total,scale:total>1?1/total:1};});
 let binding=null,boundRest=null;
 function fit(rest){
  const at=i=>Array.from(rest.slice(i*3,i*3+3));
  const cloud=bone=>bone.weights.filter(([,w])=>w>.2).map(([id])=>at(id));
  const mean=points=>mul(points.reduce(add,[0,0,0]),1/points.length);
  binding=data.pairs.map(pair=>{
   const root=cloud(pair.root),tip=cloud(pair.tip);if(!root.length||!tip.length)throw Error('Empty native toe weight cloud');
   const forward=unit(sub(mean(tip),mean(root))),axis=unit([forward[1],-forward[0],0]);
   const joint=points=>{const sorted=points.toSorted((a,b)=>dot(a,forward)-dot(b,forward));return mean(sorted.slice(0,Math.max(3,Math.ceil(sorted.length*.15))));};
   const sectionCenter=bone=>{if(!bone.section)return null;const {lower,upper}=bone.section;if(!lower?.length||!upper?.length||[...lower,...upper].some(id=>!Number.isInteger(id)||id<0||id>=data.vertex_count))throw Error('Invalid toe section attachment');return mul(add(mean(lower.map(at)),mean(upper.map(at))),.5);};
   return {root:sectionCenter(pair.root)??joint(root),tip:sectionCenter(pair.tip)??joint(tip),axis,end:mean(tip.toSorted((a,b)=>dot(b,forward)-dot(a,forward)).slice(0,Math.max(3,Math.ceil(tip.length*.15))))};
  });boundRest=rest;
 }
 return {inspectBinding(rest){
   if(rest.length!==data.vertex_count*3)throw Error('Native toe topology mismatch');
   if(!binding||boundRest!==rest)fit(rest);
   // Copies prevent diagnostic consumers from changing the deformation binding.
   return binding.map((b,i)=>({name:data.pairs[i].name,side:data.pairs[i].side,root:[...b.root],tip:[...b.tip],end:[...b.end],axis:[...b.axis],splayAxis:[...(data.splayRows?.find(r=>r.name===data.pairs[i].name)?.axis||[0,0,0])],splayGain:data.splayRows?.find(r=>r.name===data.pairs[i].name)?.gain||0,method:data.pairs[i].root.section?'surface-section center estimate; not validated anatomical landmarks':'weighted-cloud estimate; not anatomical landmarks'}));
  },invalidate(){binding=null;boundRest=null;},affectedVertices:[...vertices.keys()],
  apply(rest,out,angles){
   if(rest.length!==data.vertex_count*3||out.length!==rest.length)throw Error('Native toe topology mismatch');
   out.set(rest);
   if(!angles)return out;
   for(const side of ['left','right'])if(angles[side]&&(!Array.isArray(angles[side])||angles[side].length!==2||angles[side].some(v=>!Number.isFinite(v)||v< -35||v>50)))throw Error('Toe angles outside validated experiment range');
   if(!binding||boundRest!==rest)fit(rest);
   if(angles.splay&&Object.keys(angles.splay).some(name=>!data.pairs.some(p=>p.name===name)))throw Error('Unknown toe splay chain');
   if(angles.digits&&Object.keys(angles.digits).some(name=>!data.pairs.some(p=>p.name===name)))throw Error('Unknown toe chain');
   const transforms=data.pairs.flatMap((pair,i)=>{const a=angles.digits?.[pair.name]??angles[pair.side]??[0,0];if(!Array.isArray(a)||a.length!==2||a.some(v=>!Number.isFinite(v)||v< -35||v>50))throw Error('Toe angles outside validated experiment range');const b=binding[i],spread=angles.splay?.[pair.name]??0,row=data.splayRows?.find(r=>r.name===pair.name);if(!Number.isFinite(spread)||Math.abs(spread)>20)throw Error('Toe splay outside -20…20');const q=qm(row?turn(row.axis,spread*row.gain):[0,0,0,1],turn(b.axis,a[0])),root=rotation(q,b.root);return [root,compose(root,rotation(turn(b.axis,a[1]),b.tip))];});
   const dual=transforms.map(({q,t})=>mul(qm([...t,0],q),.5));
   for(const {id,weights,total,scale} of compiled){
    let rx=0,ry=0,rz=0,rw=Math.max(0,1-total),dx=0,dy=0,dz=0,dw=0;
    for(const [i,w0] of weights){const q=transforms[i].q,d=dual[i],w=w0*scale*(rx*q[0]+ry*q[1]+rz*q[2]+rw*q[3]<0?-1:1);rx+=q[0]*w;ry+=q[1]*w;rz+=q[2]*w;rw+=q[3]*w;dx+=d[0]*w;dy+=d[1]*w;dz+=d[2]*w;dw+=d[3]*w;}
    const n=Math.hypot(rx,ry,rz,rw);rx/=n;ry/=n;rz/=n;rw/=n;dx/=n;dy/=n;dz/=n;dw/=n;
    const index=id*3,x=rest[index],y=rest[index+1],z=rest[index+2],tx=2*(ry*z-rz*y),ty=2*(rz*x-rx*z),tz=2*(rx*y-ry*x);
    out[index]=x+rw*tx+ry*tz-rz*ty+2*(-dw*rx+dx*rw-dy*rz+dz*ry);
    out[index+1]=y+rw*ty+rz*tx-rx*tz+2*(-dw*ry+dx*rz+dy*rw-dz*rx);
    out[index+2]=z+rw*tz+rx*ty-ry*tx+2*(-dw*rz-dx*ry+dy*rx+dz*rw);
   }
   return out;
  }
 };
}
