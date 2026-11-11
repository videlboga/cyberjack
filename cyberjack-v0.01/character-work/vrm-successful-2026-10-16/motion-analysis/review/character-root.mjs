// Keep the same world pivot while changing heading. h is actor-local projected pelvis.
export function pivotOffset(fromOffset,localPivot,fromYaw,toYaw){const rotate=(p,y)=>{const a=y*Math.PI/180;return [Math.cos(a)*p[0]+Math.sin(a)*p[1],-Math.sin(a)*p[0]+Math.cos(a)*p[1]]},a=rotate(localPivot,fromYaw),b=rotate(localPivot,toYaw);return fromOffset.map((v,i)=>v+a[i]-b[i]);}
