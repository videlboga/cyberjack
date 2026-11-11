import {targetMouthOffset} from './viewer-mouth-target.js?v=target-6';
const clamp=v=>Math.max(-1,Math.min(1,v||0));
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
const bell=(x,c,r)=>Math.exp(-Math.pow((x-c)/r,2));
export const nativeMouthCentre=x=>1.43553+.00025*Math.pow(x/.017,2);
// Smooth donor-relative warp: no piecewise interpolated vertex rows, cusp at
// abs(x)=0, or narrow height ramps. Integrating a positive local scale avoids
// compressing the closure through itself when fullness and sealing combine.
export function nativeMouthOffset([x,y,z],v){
 if(Object.hasOwn(v,'mouthTarget'))return targetMouthOffset([x,y,z],v.mouthTarget,v.lipSeal??1);
 const u=x/.017,width=.78*(1+.35*clamp(v.lipFullnessWidth)),span=Math.exp(-Math.pow(u/width,4)),front=smooth((z-.045)/.012),gain=Math.max(0,Math.min(3,v.mouthNativeGain??1)),w=span*front*gain;
 const centre=nativeMouthCentre(x),distance=y-centre,seal=Math.max(0,clamp(v.lipSeal));
 let vertical=0;for(let i=0;i<12;i++){const t=distance*(i+.5)/12,upper=.5+.5*Math.tanh(t/.0015),height=(.5*clamp(v.lipRoll_upperHeight)*upper+.55*clamp(v.lipRoll_lowerHeight)*(1-upper))*bell(t,0,.007),close=-1.05*seal*bell(t,0,.0014);vertical+=Math.expm1(height+close)*distance/12;}
 vertical*=Math.exp(-Math.pow(distance/.020,4));
 const peaks=bell(u,.30,.23)+bell(u,-.30,.23),notch=bell(u,0,.18),upper=.5+.5*Math.tanh(distance/.004);
 const contour=.00035*clamp(v.lipSeamCurve)*(peaks-.48*notch)*bell(distance,0,.0045)+.0010*(clamp(v.lipPeakHeight)*peaks-clamp(v.lipNotch)*notch)*upper*bell(distance,0,.006);
 const round=clamp(v.lipRoll_roundness),radius=1+.25*round,bulgeUp=bell(y,centre+.0014,.0019*radius),bulgeLow=bell(y,centre-.0017,.0025*radius);
 const depth=.0035*clamp(v.lipRoll_upperDepth)*bulgeUp+.0042*clamp(v.lipRoll_lowerDepth)*bulgeLow+.0004*round*(bulgeUp+bulgeLow);
 // Gain is blended for depth/contour; seal and height must not amplify past
 // the positive-scale map, so their gain saturates at one.
 return [0,vertical*span*front*Math.min(1,gain)+contour*span*front*Math.min(1,gain),depth*w];
}
