import {sourceMouthRows} from './viewer-mouth-bound.js?v=lip-rolls-2';
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function fittedLipPigment(x,y,z){
 if(Math.abs(x)>.018)return 0;
 const row=sourceMouthRows(x),cupid=Math.exp(-(((Math.abs(x)-.004)/.003)**2));
 const span=Math.sqrt(Math.max(0,1-(x/.016)**2));
 const upper=row.upperSeam[0]+(.22+.50*cupid)*span*(row.upper[0]-row.upperSeam[0]);
 const lower=row.lowerSeam[0]+.60*span*(row.lower[0]-row.lowerSeam[0]);
 return smooth(lower-.0003,lower+.0003,y)*(1-smooth(upper-.0003,upper+.0003,y))*(1-smooth(.0095,.0165,Math.abs(x)))*smooth(.054,.061,z);
}
