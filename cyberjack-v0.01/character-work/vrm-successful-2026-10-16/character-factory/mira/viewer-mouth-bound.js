import {lipRollSection,lipRollDimensions} from './viewer-lip-rolls.js?v=lip-rolls-2';
import {mouthBindings} from './viewer-mouth-binding-data.js?v=lip-rolls-2';
import {mouthCurve} from './viewer-mouth-curve-values.js?v=lip-rolls-2';
export {mouthBindings};
const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function sourceMouthRows(x){const result={};for(const [name,row] of Object.entries(mouthBindings.rows)){let i=0;while(i<row.length-2&&row[i+1].position[0]<x)i++;const a=row[i].position,b=row[i+1].position,t=Math.max(0,Math.min(1,(x-a[0])/(b[0]-a[0])));result[name]=[a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];}return result;}
export function targetMouthRows(x,values){const source=sourceMouthRows(x),u=Math.max(-1,Math.min(1,x/.018)),span=Math.sqrt(Math.max(0,1-u*u)),seam=1.4355+.00035*u*u+.002*span*mouthCurve(values,'seam',u)+.0012*(values.lipCornerCurve||0)*u*u*span,peak=Math.exp(-Math.pow((Math.abs(u)-(.33+.15*(values.lipPeakSpacing||0)))/.23,2));
 let upper=Math.max(seam+.0007*span,seam+span*(.0018+.0035*(values.lipVerticalVolume||0)+(.0012+.0018*(values.lipPeakHeight||0))*peak-.0012*(values.lipNotch||0)*Math.exp(-Math.pow(u/.16,2))+.002*mouthCurve(values,'upper',u))),lower=Math.min(seam-.0007*span,seam-span*(.0028+.0035*(values.lipVerticalVolume||0)+.002*(values.lipLowerHeight||0)+.0012*(values.lipLowerArc||0)*(u*u-.2)-.002*mouthCurve(values,'lower',u))),gap=.00025*span;
 // The closure sits behind the lip bellies; advancing it creates a bright ridge.
 let z=Math.max(source.upperSeam[1],source.lowerSeam[1],.6*source.upper[1]+.4*source.lower[1]+.001*span)-.0012*span;
 if(values.mouthCurve_rolls){
 const a=lipRollDimensions(values,'upper'),b=lipRollDimensions(values,'lower');
 upper=seam+span*Math.max(.0015,a.height+(.0012+.0012*(values.lipPeakHeight||0))*peak-.0008*(values.lipNotch||0)*Math.exp(-Math.pow(u/.16,2))+.0015*mouthCurve(values,'upper',u));
 lower=seam-span*Math.max(.0015,b.height+.001*(values.lipLowerArc||0)*(u*u-.2)-.0015*mouthCurve(values,'lower',u));
 z=.5*(source.upperSeam[1]+source.lowerSeam[1])-.0006*(values.lipRoll_seamDepth||0)*span;
 return {upper:[upper,source.upper[1]],upperSeam:[seam+gap/2,z],lowerSeam:[seam-gap/2,z],lower:[lower,source.lower[1]]};
 }
 const projection=(values.lipProjection||0)*((values.lipProjection||0)>=0?.006:.002)*span;
 return {upper:[upper,source.upper[1]+projection*.2],upperSeam:[seam+gap/2,z+projection*.65],lowerSeam:[seam-gap/2,z+projection*.65],lower:[lower,source.lower[1]+projection*.2]};}
// Bind directly to four actual vertex chains, not a height mask around the mouth.
// A point between two source chains retains its fractional band coordinate.
export function boundMouth(point,values){const amount=Math.max(0,Math.min(1,values.mouthCurve_binding||0));if(!amount)return Array.from(point);const [x,y,z]=point;if(Math.abs(x)>=.020)return Array.from(point);const source=sourceMouthRows(x),target=targetMouthRows(x,values),names=['lower','lowerSeam','upperSeam','upper'],span=Math.sqrt(Math.max(.05,1-Math.min(1,(x/.020)**2))),fade=1-smooth((Math.abs(x)-.014)/.006),front=smooth((z-(Math.min(source.upper[1],source.lower[1])-.010))/.007),weight=amount*fade*front;
 const breaks=names.map(n=>source[n][0]);let sy=y,sz=z;
 if(y<breaks[0]||y>breaks[3]){const n=y<breaks[0]?'lower':'upper',distance=Math.abs(y-source[n][0]),tail=1-smooth(distance/(.012*span));sy+=tail*(target[n][0]-source[n][0]);sz=source[n][1]+(z-source[n][1])*(.5+.5*smooth(distance/(.006*span)))+tail*(target[n][1]-source[n][1]);}
 else{let i=0;while(i<2&&y>breaks[i+1])i++;const a=names[i],b=names[i+1],t=Math.max(0,Math.min(1,(y-source[a][0])/(source[b][0]-source[a][0])));sy=target[a][0]+t*(target[b][0]-target[a][0]);const w=smooth(t);// Rebuild the surface section instead of carrying the donor's sharp fold.
 const sourceDepth=(1-t)*source[a][1]+t*source[b][1];
 sz=(1-w)*target[a][1]+w*target[b][1]+(z-sourceDepth);const band=i===0?'lower':i===2?'upper':null;if(band&&values.mouthCurve_rolls){const d=lipRollDimensions(values,band),section=lipRollSection(t,target[b][0]-target[a][0],d.depth*span,d.roundness);sy=target[a][0]+section[0];sz=(1-t)*target[a][1]+t*target[b][1]+(z-sourceDepth)+section[1];}
 else if(band)sz+=Math.max(.0003,(band==='lower'?.0030:.0025)+(values[`mouthCurve_depth_${band}`]||0)*.0015)*span*Math.sin(Math.PI*t)**2+.003*(values.lipRoundness||0)*span*Math.sin(Math.PI*t)**2;}
 return [x,y+(sy-y)*weight,z+(sz-z)*weight];}
// Preserve the authored contour in a local mouth frame. Broad chin/jaw fields
// may place the mouth, but must not compress its carefully bound lip bands.
export function mapBoundMouthFrame(point,rest,values,cage){
 const global=cage.sample(point);if(!values.mouthCurve_binding)return global;
 const [x,y,z]=rest,mask=(1-smooth((Math.abs(x)-.016)/.024))*(1-smooth((Math.abs(y-1.4355)-.008)/.032))*smooth((z-.020)/.035);
 if(!mask)return global;const centre=cage.sample([0,1.4355,.064]),local=[centre[0]+point[0]*(1+.18*(values.width||0)+.25*(values.mouthWidth||0)),centre[1]+(point[1]-1.4355)*(1+.13*(values.length||0)),centre[2]+point[2]-.064];
 return global.map((v,k)=>v+(local[k]-v)*mask);
}
