// Portable surface binding and eyelid envelope math. No renderer or model indices stored.
export function surfaceAnchor(positions,indices,point){
 let best=null,score=Infinity;
 for(let k=0;k<indices.length;k+=3){const ids=[indices[k],indices[k+1],indices[k+2]],a=ids.map(i=>[positions[i*3],positions[i*3+1],positions[i*3+2]]),[p,q,r]=a,den=(q[1]-r[1])*(p[0]-r[0])+(r[0]-q[0])*(p[1]-r[1]);if(Math.abs(den)<1e-12)continue;
  const u=((q[1]-r[1])*(point[0]-r[0])+(r[0]-q[0])*(point[1]-r[1]))/den,v=((r[1]-p[1])*(point[0]-r[0])+(p[0]-r[0])*(point[1]-r[1]))/den,w=1-u-v;if(Math.min(u,v,w)<-1e-6)continue;
  const z=u*p[2]+v*q[2]+w*r[2],distance=Math.abs(z-point[2]);if(distance<score){best={ids,weights:[u,v,w]};score=distance;}
 }
 if(best)return best;
 let index=0;for(let i=0;i<positions.length;i+=3){const distance=(positions[i]-point[0])**2+(positions[i+1]-point[1])**2+(positions[i+2]-point[2])**2;if(distance<score){score=distance;index=i/3;}}
 return {ids:[index,index,index],weights:[1,0,0]};
}
export function lidEnvelope(upper,lower,sign,count=16){
 const bounds=mesh=>{let min=Infinity,max=-Infinity;for(let i=0;i<mesh.positions.length;i+=3){const x=mesh.positions[i];if(x*sign>.012){min=Math.min(min,x);max=Math.max(max,x);}}return [min,max];};
 const a=bounds(upper),b=bounds(lower),min=Math.max(a[0],b[0]),max=Math.min(a[1],b[1]);if(!(max>min))return null;
 const at=(mesh,x,top)=>{let y=top?Infinity:-Infinity;const p=mesh.positions,ix=mesh.indices,uv=mesh.uv,alpha=mesh.alpha;
  for(let k=0;k<ix.length;k+=3){const ia=ix[k],ib=ix[k+1],ic=ix[k+2],xa=p[ia*3],xb=p[ib*3],xc=p[ic*3],lo=Math.min(xa,xb,xc),hi=Math.max(xa,xb,xc),margin=(hi-lo)*.0001+.000001;if(x<lo-margin||x>hi+margin)continue;
   let hits=0,ay=0,au=0,av=0,by=0,bu=0,bv=0;
   for(let e=0;e<3;e++){const a=e===0?ia:e===1?ib:ic,b=e===0?ib:e===1?ic:ia,i=a*3,j=b*3,ax=p[i],bx=p[j];if((x-ax)*(x-bx)>1e-12||Math.abs(ax-bx)<1e-9)continue;const t=(x-ax)/(bx-ax);if(t<-.0001||t>1.0001)continue;
    const yy=p[i+1]+t*(p[j+1]-p[i+1]),u=uv?uv[a*2]+t*(uv[b*2]-uv[a*2]):0,v=uv?uv[a*2+1]+t*(uv[b*2+1]-uv[a*2+1]):0;
    if(hits===0){ay=yy;au=u;av=v;}else if(hits===1){by=yy;bu=u;bv=v;}hits++;
   }
   if(hits<2)continue;const steps=alpha?Math.min(256,Math.max(2,Math.ceil(Math.hypot((au-bu)*alpha.width,(av-bv)*alpha.height)*1.5))):1;
   for(let n=0;n<=steps;n++){const t=n/steps,yy=ay+t*(by-ay),u=au+t*(bu-au),v=av+t*(bv-av);if(alpha){const px=Math.max(0,Math.min(alpha.width-1,Math.floor(u*alpha.width))),py=Math.max(0,Math.min(alpha.height-1,Math.floor((alpha.flipY?1-v:v)*alpha.height)));if(alpha.data[(py*alpha.width+px)*4+3]<90)continue;}y=top?Math.min(y,yy):Math.max(y,yy);}
  }
  return Number.isFinite(y)?y:NaN;
 };
 const result=new Float32Array(count*4);for(let i=0;i<count;i++){const x=min+(max-min)*(i+.001)/(count-1+.002);result.set([x,at(upper,x,true),at(lower,x,false),0],i*4);}for(const axis of [1,2])for(let i=0;i<count;i++)if(!Number.isFinite(result[i*4+axis])){let best=-1,distance=Infinity;for(let j=0;j<count;j++)if(Number.isFinite(result[j*4+axis])&&Math.abs(j-i)<distance){best=j;distance=Math.abs(j-i);}if(best<0)return null;result[i*4+axis]=result[best*4+axis];}return result;
}

// A soft outer-corner drop is separate from closing the eye or moving the iris.
export function relaxedEyeDelta(positions,config){
 const result=new Float32Array(positions.length),smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 for(let i=0;i<positions.length;i+=3){const x=Math.abs(positions[i]),y=positions[i+1],z=positions[i+2],u=(x-config.centerX)/config.halfWidth;
  const mask=(1-smooth(.75,1,Math.abs(u)))*(1-smooth(config.halfHeight*.6,config.halfHeight,Math.abs(y-config.centerY)))*smooth(config.frontStart,config.frontStart+.018,z);
  result[i+1]=-Math.max(-1,Math.min(1,u*1.45))*config.cornerDrop*mask;
 }return result;
}

// Preserve the donor UV silhouette; replace its large baked highlight bubbles
// with a fine radial iris, a limbal ring and two small controlled highlights.
export function portraitIrisPixels(source,width,height,hex,values={}){
 const out=new Uint8ClampedArray(source),rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
 let x0=width,y0=height,x1=0,y1=0;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(source[(y*width+x)*4+3]>90){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x1<=x0||y1<=y0)return out;
 const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2,ry=(y1-y0)/2,smooth=(a,b,v)=>{const t=Math.max(0,Math.min(1,(v-a)/(b-a)));return t*t*(3-2*t);};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){
  const i=(y*width+x)*4;if(!source[i+3])continue;const u=(x-cx)/rx,v=(y-cy)/ry,r=Math.hypot(u,v),theta=Math.atan2(v,u);
  const fibres=(Math.sin(theta*83+r*19)+Math.sin(theta*137-r*13))*.027;
  const shade=(1-.22*((values.irisTone??.65)-.65))*(.84+.24*v+fibres)*(1-.53*smooth(.83,.99,r))*(.95+.1*Math.exp(-(((r-.4)/.13)**2)));
  const pupil=1-smooth(.205,.24,r),glint=Math.min(1,((1-smooth(.055,.10,Math.hypot(u+.39,v+.35)))*.9+(1-smooth(.015,.04,Math.hypot(u-.30,v-.36)))*.5)*(1-.65*((values.irisHighlights??.5)-.5)));
  for(let k=0;k<3;k++){let c=Math.max(0,Math.min(255,rgb[k]*shade));c=c*(1-pupil)+[10,13,18][k]*pupil;out[i+k]=Math.round(c*(1-glint)+248*glint);}
 }return out;
}

export function mouthCavityWeight(u,v,c){
 if(!c)return 0;const [x0,y0,x1,y1]=c.uvBounds,e=c.edge??.002,smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
 return smooth(x0,x0+e,u)*(1-smooth(x1-e,x1,u))*smooth(y0,y0+e,v)*(1-smooth(y1-e,y1,v));
}
