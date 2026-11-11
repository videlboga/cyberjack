// Isolated research solver. No rest-position attraction and no production hooks.
export class RibbonXPBD {
 constructor(rest,{columns=3,dt=1/60,iterations=16,skin=.006,bendCompliance=2e-5}={}){
  this.columns=columns;this.rest=rest.map(p=>p.slice());this.p=rest.map(p=>p.slice());this.old=rest.map(p=>p.slice());this.v=rest.map(()=>[0,0,0]);this.mass=rest.map((_,i)=>i<columns?0:1);this.dt=dt;this.iterations=iterations;this.skin=skin;this.links=[];this.samples=[];this.contacts=new Map();this.tick=0;
  const add=(a,b,compliance)=>this.links.push({a,b,length:Math.hypot(...rest[a].map((x,k)=>x-rest[b][k])),compliance,lambda:0});
  const rows=rest.length/columns;
  for(let r=0;r<rows;r++)for(let c=0;c<columns;c++){const i=r*columns+c;this.samples.push({ids:[i],weights:[1]});if(c)add(i-1,i,0);if(r)add(i-columns,i,0);if(r&&c){add(i-columns-1,i,1e-8);add(i-columns,i-1,1e-8);}if(r>1)add(i-2*columns,i,bendCompliance);}
  // Width-aware contacts: nodes, edge midpoints and triangle centroids share
  // the same constraint stage, rather than successive independent projections.
  for(const l of this.links)if(l.compliance<1e-7)this.samples.push({ids:[l.a,l.b],weights:[.5,.5]});
  for(let r=1;r<rows;r++)for(let c=1;c<columns;c++){const i=r*columns+c;for(const ids of [[i-columns-1,i-columns,i],[i-columns-1,i,i-1]])this.samples.push({ids,weights:[1/3,1/3,1/3]});}
 }
 frame(points,row){
  const C=this.columns,t=[0,0,0],side=[0,0,0];
  for(let c=0;c<C;c++)for(let k=0;k<3;k++)t[k]+=points[row*C+c][k]-points[(row-1)*C+c][k];
  let length=Math.hypot(...t);if(length<1e-10)return null;for(let k=0;k<3;k++)t[k]/=length;
  for(let k=0;k<3;k++)side[k]=points[row*C+C-1][k]-points[row*C][k];
  const dot=side[0]*t[0]+side[1]*t[1]+side[2]*t[2];for(let k=0;k<3;k++)side[k]-=dot*t[k];length=Math.hypot(...side);if(length<1e-10)return null;for(let k=0;k<3;k++)side[k]/=length;
  return [t,side,[t[1]*side[2]-t[2]*side[1],t[2]*side[0]-t[0]*side[2],t[0]*side[1]-t[1]*side[0]]];
 }
 enableShape(compliance=1e-4){
  this.shapeCompliance=compliance;this.shapes=[];const C=this.columns;
  for(let r=1;r<this.p.length/C-1;r++){const frame=this.frame(this.rest,r);if(!frame)continue;
   for(let c=0;c<C;c++){const b=r*C+c,a=b-C,d=b+C,curve=[0,1,2].map(k=>this.rest[a][k]-2*this.rest[b][k]+this.rest[d][k]);this.shapes.push({row:r,a,b,d,coeff:frame.map(axis=>axis.reduce((sum,v,k)=>sum+v*curve[k],0)),lambda:[0,0,0]});}
  }
 }
 solveShape(h){
  if(!this.shapes)return;const alpha=this.shapeCompliance/(h*h);let row=-1,frame=null;
  for(const s of this.shapes){if(row!==s.row){row=s.row;frame=this.frame(this.p,row);}if(!frame)continue;const wa=this.mass[s.a],wb=this.mass[s.b],wd=this.mass[s.d],den=wa+4*wb+wd;if(!den)continue;
   for(let k=0;k<3;k++){const desired=frame[0][k]*s.coeff[0]+frame[1][k]*s.coeff[1]+frame[2][k]*s.coeff[2],C=this.p[s.a][k]-2*this.p[s.b][k]+this.p[s.d][k]-desired,dl=(-C-alpha*s.lambda[k])/(den+alpha);s.lambda[k]+=dl;this.p[s.a][k]+=wa*dl;this.p[s.b][k]-=2*wb*dl;this.p[s.d][k]+=wd*dl;}
  }
 }
 point(sample,out=[0,0,0]){for(let k=0;k<3;k++){let sum=0;for(let j=0;j<sample.ids.length;j++)sum+=this.p[sample.ids[j]][k]*sample.weights[j];out[k]=sum;}return out;}
 step(surface,{gravity=[0,-9.81,0],acceleration=[0,0,0]}={}){
  const h=this.dt,qWork=[0,0,0];
  for(let i=0;i<this.p.length;i++){for(let k=0;k<3;k++)this.old[i][k]=this.p[i][k];if(!this.mass[i])continue;for(let k=0;k<3;k++){this.v[i][k]=(this.v[i][k]+(gravity[k]+acceleration[k])*h)*.995;this.p[i][k]+=this.v[i][k]*h;}}
  for(const l of this.links)l.lambda=0;
  for(const s of this.shapes||[])s.lambda.fill(0);
  const next=new Map();
  for(let i=0;i<this.samples.length;i++){
   const sample=this.samples[i],q=this.point(sample,qWork),previous=this.contacts.get(i),hit=surface.query(q,previous?.hit);
   if(!hit)continue;
   const distance=Math.hypot(...q.map((x,k)=>x-hit.point[k]));
   if(distance>this.skin+.025)continue;
   // Keep a known exterior side across a nearest-triangle reversal. A surface
   // adapter must re-evaluate the old face in its current pose.
   let chosen=hit;
   if(previous&&hit.normal.reduce((s,v,k)=>s+v*previous.hit.normal[k],0)<0){chosen=surface.refresh?.(previous.hit,q)||hit;}
   next.set(i,{sample,hit:chosen,lambda:0});
  }
  this.contacts=next;
  for(let pass=0;pass<this.iterations;pass++){
   for(const l of this.links){const a=this.p[l.a],b=this.p[l.b],dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz),w=this.mass[l.a]+this.mass[l.b];if(!w||len<1e-10)continue;const alpha=l.compliance/(h*h),dl=(-(len-l.length)-alpha*l.lambda)/(w+alpha);l.lambda+=dl;for(let k=0;k<3;k++){const correction=(k===0?dx:k===1?dy:dz)/len*dl;a[k]-=correction*this.mass[l.a];b[k]+=correction*this.mass[l.b];}}
   this.solveShape(h);
   for(const contact of next.values()){
    const {sample,hit}=contact,q=this.point(sample,qWork),C=q.reduce((s,x,k)=>s+(x-hit.point[k])*hit.normal[k],0)-this.skin;
    const w=sample.ids.reduce((s,id,j)=>s+this.mass[id]*sample.weights[j]**2,0);if(!w)continue;
    const lambda=Math.max(0,contact.lambda-C/w),dl=lambda-contact.lambda;contact.lambda=lambda;
    for(let j=0;j<sample.ids.length;j++){const id=sample.ids[j];for(let k=0;k<3;k++)this.p[id][k]+=this.mass[id]*sample.weights[j]*hit.normal[k]*dl;}
   }
  }
  for(let i=0;i<this.p.length;i++)for(let k=0;k<3;k++)this.v[i][k]=(this.p[i][k]-this.old[i][k])/h;
  // No separate velocity impulse in v1: compare a single coherent positional
  // solve first. Contact friction/relative body velocity remain future work.
  this.tick++;
 }
 stretch(){return Math.max(...this.links.filter(l=>l.compliance===0).map(l=>Math.abs(Math.hypot(...this.p[l.a].map((x,k)=>x-this.p[l.b][k]))/l.length-1)));}
}
export function ribbonGrid({rows=21,columns=3,width=.12,length=.8,root=[0,1.2,-.23]}={}){return Array.from({length:rows*columns},(_,i)=>[root[0]+(i%columns/(columns-1)-.5)*width,root[1]-Math.floor(i/columns)/(rows-1)*length,root[2]]);}
