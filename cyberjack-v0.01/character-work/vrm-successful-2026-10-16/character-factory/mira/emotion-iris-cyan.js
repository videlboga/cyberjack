const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Cyan facets and a narrow warm pupil, within the existing iris UV/alpha footprint.
export function cyanIrisPixels(source,width,height,hex='#24d5ee'){
 const out=new Uint8ClampedArray(source),rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));let x0=width,y0=height,x1=-1,y1=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(source[(y*width+x)*4+3]>90){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x1<=x0||y1<=y0)return out;
 const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2,ry=(y1-y0)/2;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const i=(y*width+x)*4;if(!source[i+3])continue;const u=(x-cx)/rx,v=(y-cy)/ry,r=Math.hypot(u,v),angle=Math.atan2(v,u),sector=Math.floor((angle+Math.PI)*12/Math.PI);
  const facet=.08*Math.sin(sector*2.39)+.05*Math.sin(sector*.83+r*9),shade=(.54+.50*smooth(-.7,.7,v)+facet)*(1-.55*smooth(.88,1,r));
  let color=rgb.map(c=>Math.min(255,c*shade));
  const pupil=1-smooth(.88,1.08,Math.hypot(u/.09,(v+.12)/.28));color=color.map((c,k)=>c*(1-pupil)+[159,102,48][k]*pupil);
  const core=1-smooth(.75,1.05,Math.hypot(u/.036,(v+.12)/.23));color=color.map((c,k)=>c*(1-core)+[54,43,30][k]*core);
  const glint=(1-smooth(.045,.075,Math.hypot(u+.26,v+.39)))*.97;color=color.map(c=>c*(1-glint)+255*glint);
  const lower=(1-smooth(.10,.20,Math.hypot(u-.28,v-.48)))*.35;color=color.map((c,k)=>c*(1-lower)+[111,241,249][k]*lower);
  for(let k=0;k<3;k++)out[i+k]=Math.round(color[k]);
 }return out;
}
