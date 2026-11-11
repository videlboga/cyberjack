const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Amber portrait iris: short oval pupil, shaded upper arc and lower honey flecks.
// Reuse the artist texture's alpha and UV footprint, so the eye rig is unchanged.
export function amberIrisPixels(source,width,height,hex='#efbd46'){
 const out=new Uint8ClampedArray(source),rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));let x0=width,y0=height,x1=-1,y1=-1;
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(source[(y*width+x)*4+3]>90){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
 if(x1<=x0||y1<=y0)return out;
 const cx=(x0+x1)/2,cy=(y0+y1)/2,rx=(x1-x0)/2,ry=(y1-y0)/2;
 for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
  const i=(y*width+x)*4;if(!source[i+3])continue;const u=(x-cx)/rx,v=(y-cy)/ry,r=Math.hypot(u,v),a=Math.atan2(v,u);
  const lower=smooth(-.8,.8,v),fibres=(Math.sin(a*41+r*28)+Math.sin(a*73-r*19))*.016,shade=(.48+.61*lower+fibres)*(1-.60*smooth(.87,.99,r));
  let color=rgb.map(c=>Math.min(255,c*shade));
  const pupil=1-smooth(.90,1.08,Math.hypot(u/.155,(v+.13)/.24));color=color.map((c,k)=>c*(1-pupil)+[48,32,22][k]*pupil);
  for(let n=0;n<7;n++){const theta=.18*Math.PI+n*.105*Math.PI,rad=.59+.10*Math.sin(n*1.71),size=.055+.022*(.5+.5*Math.sin(n*2.3)),d=Math.hypot(u-Math.cos(theta)*rad,v-Math.sin(theta)*rad);const glint=(1-smooth(size*.65,size,d))*.80;color=color.map((c,k)=>c*(1-glint)+[255,230,147][k]*glint);}
  const highlight=(1-smooth(.035,.066,Math.hypot(u+.36,v+.43)))*.95;color=color.map(c=>c*(1-highlight)+253*highlight);
  for(let k=0;k<3;k++)out[i+k]=Math.round(color[k]);
 }return out;
}
