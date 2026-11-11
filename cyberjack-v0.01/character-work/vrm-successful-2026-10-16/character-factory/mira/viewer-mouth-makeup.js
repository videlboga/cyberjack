import {sourceMouthRows} from './viewer-mouth-bound.js?v=lip-rolls-2';
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
// Rest-space pigment follows the same vertices through shape edits and VRM morphs.
export function lipPigmentWeight([x,y,z],softness=.5){
 const rows=sourceMouthRows(x),edge=.00025+.0008*Math.max(0,Math.min(1,softness)),u=x/.017;
 const sides=Math.exp(-Math.pow(Math.abs(u)/.87,6));
 return sides*smooth((z-.048)/.01)*smooth((y-rows.lower[0]+edge)/edge)*smooth((rows.upper[0]-y+edge)/edge);
}

const bell=(x,c,r)=>Math.exp(-Math.pow((x-c)/r,2));
export function lipMakeupSample(point,softness=.5,pattern=1,concentration=.8){
 const [x,y]=point,rows=sourceMouthRows(x),seam=(rows.upperSeam[0]+rows.lowerSeam[0])/2+.0003;
 const upper=y>=seam,t=upper?(y-seam)/Math.max(.001,rows.upper[0]-seam):(seam-y)/Math.max(.001,seam-rows.lower[0]);
 const mask=lipPigmentWeight(point,softness),centre=bell(x,0,.009),a=Math.max(0,Math.min(1,pattern));
 const gradient=upper?(.38+.57*bell(t,.32,.46)):(.15+.72*bell(t,.30,.42));
 const radius=.015-.0085*Math.max(0,Math.min(1,concentration)),centralPaint=bell(x,0,radius);
 const pigment=mask*((1-a)+a*gradient*centralPaint);
 const shade=mask*a*.10*centralPaint*bell(y,seam,.00035);
 const warmth=mask*a*(upper?0:.38*centralPaint*bell(t,.55,.30));
 // Broad specular zone, not white pigment: highlights still respond to light.
 const gloss=mask*((1-a)+a*(upper?.12:.9*centralPaint*bell(t,.42,.34)));
 return {pigment,shade,warmth,gloss};
}
