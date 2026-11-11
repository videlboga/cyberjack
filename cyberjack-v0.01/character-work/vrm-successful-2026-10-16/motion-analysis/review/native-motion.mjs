// Native playback uses shortest quaternion interpolation without calibrated
// hinge decomposition, projection, or FK-based support corrections.
export function interpolateRecorded(a,b,u){return a.map((n,i)=>({...n,world:n.world.clone(),worldQ:n.worldQ.clone(),p:n.p.clone().lerp(b[i].p,u),q:n.q.clone().slerp(b[i].q,u),s:n.s.clone().lerp(b[i].s,u)}));}
