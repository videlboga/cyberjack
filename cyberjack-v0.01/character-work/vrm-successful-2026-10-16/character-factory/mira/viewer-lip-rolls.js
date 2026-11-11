const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// A rounded half-superellipse: height and depth are independent radii.
// The small linear term keeps the rest-space map invertible at its boundaries.
export function lipRollSection(t,height,depth,roundness=0){
 t=clamp(t,0,1);const exponent=2/(2+.65*clamp(roundness,-1,1)),c=-Math.cos(Math.PI*t),s=Math.sin(Math.PI*t);
 return [height*(.03*t+.97*(1+Math.sign(c)*Math.abs(c)**exponent)/2),depth*Math.max(0,s)**exponent];
}
export function lipRollDimensions(values,band){
 return {height:(band==='upper'?.005:.006)*(1+.6*clamp(values[`lipRoll_${band}Height`]||0,-1,1)),depth:(band==='upper'?.0032:.0037)*(1+.65*clamp(values[`lipRoll_${band}Depth`]||0,-1,1)),roundness:values.lipRoll_roundness||0};
}
