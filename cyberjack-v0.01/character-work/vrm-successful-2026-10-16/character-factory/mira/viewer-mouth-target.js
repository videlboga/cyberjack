import {mouthSourceSurface as grid} from './viewer-mouth-source-surface.js?v=target-1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*x*(10+x*(-15+6*x));};
const mix=(a,b,t)=>a+(b-a)*t;
const cubic=(a,b,c,d,t)=>b+.5*t*(c-a+t*(2*a-5*b+4*c-d+t*(3*(b-c)+d-a)));
// A donor surface, not a deformation field. Cubic sampling lets the target
// replace its cross-section instead of piling another bulge onto the donor.
export function sourceMouthDepth(x,y){
 const u=clamp((x-grid.xmin)/(grid.xmax-grid.xmin))*(grid.nx-1),v=clamp((y-grid.ymin)/(grid.ymax-grid.ymin))*(grid.ny-1),i=Math.floor(u),j=Math.floor(v),row=[];
 for(let b=-1;b<=2;b++){const yy=clamp(j+b,0,grid.ny-1),a=[];for(let k=-1;k<=2;k++)a.push(grid.depth[yy*grid.nx+clamp(i+k,0,grid.nx-1)]);row.push(cubic(...a,u-i));}
 return cubic(...row,v-j);
}
// Contours in canonical metres. Fullness is concentrated in the middle, with
// a small double peak above and a wide single lower pad; the corners keep the
// donor's almost massless closure. The reference is frontal, so depth remains
// an authored study rather than a measured profile reconstruction.
export function targetLipContours(x){
 const u=x/.015,span=Math.pow(Math.max(0,1-u*u),1.7),peaks=Math.exp(-Math.pow((u-.29)/.18,2))+Math.exp(-Math.pow((u+.29)/.18,2));
 const seam=1.4355+span*(.00025+.00048*peaks-.00018*Math.exp(-Math.pow(u/.13,2)));
 return {span,seam,upper:seam+.0036+.0011*peaks,lower:seam-.0078};
}
export function targetMouthOffset([x,y,z],amount=1,seal=1){
 amount=clamp(amount);if(!amount||Math.abs(x)>=.023||y<=1.419||y>=1.452||z<=.044)return [0,0,0];
 const {span,seam,upper,lower}=targetLipContours(x),sourceSeam=1.43550+.00023*Math.pow(x/.017,2),isUpper=y>=sourceSeam;
 const distance=y-sourceSeam;let closedDistance=0;
 // A positive local scale narrows the neutral aperture without crossing the
 // two lips. The open expression endpoints are evaluated with seal=0.
 for(let i=0;i<12;i++){const d=distance*(i+.5)/12;closedDistance+=Math.exp(-2.2*clamp(seal)*span*Math.exp(-Math.pow(d/.00065,2)))*distance/12;}
 const sourceOuter=isUpper?1.4405:1.4295,t=closedDistance/(sourceOuter-sourceSeam),s=clamp(t),patch=smooth((.023-Math.abs(x))/.007),outerFade=1-smooth((t-.88)/(isUpper?.85:.55));
 const front=sourceMouthDepth(x,y),shell=smooth((z-.044)/.010);
 // Shape coordinates preserve vertex order and the donor's tiny opening.
 const outer=isUpper?upper:lower,desiredY=mix(seam,outer,t);
 const dy=(desiredY-y)*outerFade*span*patch*shell;
 const boundary=sourceMouthDepth(x,sourceOuter),closure=sourceMouthDepth(x,sourceSeam)+.0025*span;
 const base=mix(closure,boundary,smooth(s)),section=Math.pow(Math.max(0,Math.sin(Math.PI*s)),1.35);
 const pad=(isUpper?.0015:.0030)*span*section;
 const desiredZ=base+pad,depthBlend=outerFade*patch*shell*span;
 return [0,dy*amount,(desiredZ-front)*depthBlend*amount];
}
