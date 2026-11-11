// Rest-pose aperture is independent of iris scale. It acts on the same
// continuous field for skin, lashes and every morph endpoint; iris stays round.
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function identityEyeOffset([x,y,z],values,{iris=false,apertureScale=1}={}){
 if(iris)return 0;
 const amount=Math.max(0,Math.min(1,Number(values.eyeAperture)||0));
 const eye=Math.exp(-2*((Math.abs(x)-.041)/.040)**2)*Math.exp(-2*((y-1.493)/.043)**2)*smooth(.005,.045,z);
 return -(y-1.493)*.78*amount*eye*Math.max(0,Math.min(1,apertureScale));
}

// Blend over the lower face rather than compressing a short strip under the lip.
export function targetMouthIdentityWeight([x,y,z]){
 return (1-smooth(.026,.075,Math.abs(x)))*smooth(1.390,1.429,y)*(1-smooth(1.4525,1.480,y))*smooth(-.040,.005,z);
}
