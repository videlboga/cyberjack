import{Quaternion,Vector3}from'three';
import{pack,constraintScore}from'../review/command-pose.mjs';
// Reclining clips have no stable horizontal forward vector: a pelvis-derived
// heading can flip by pi. Remove only the unnecessary vertical-axis twist.
export function alignRecliningHeading(t,state,step){
 if(step.status!=='ready'||step.object||step.semantics?.requiresTrajectory||Math.abs((step.headingTarget??state.yaw)-state.yaw)>.01||Math.hypot(...(step.translation||[0,0]))>.001)return step;
 const from=t.unpack(state.pose),to=t.unpack(step.pose),f=t.features(to);if(f.torsoInclination<60||f.hipHeight>.25)return step;
 const hip=t.m.index.get('cf_j_hips'),delta=to[hip].worldQ.clone().multiply(from[hip].worldQ.clone().invert()),length=Math.hypot(delta.y,delta.w);if(length<1e-5)return step;
 const correction=new Quaternion(0,delta.y/length,0,delta.w/length).invert(),candidate=t.unpack(step.pose),pivot=t.point(candidate,'hips');candidate[0].p.sub(pivot).applyQuaternion(correction).add(pivot);candidate[0].q.premultiply(correction);t.m.fk(candidate);
 if(constraintScore(t.features(candidate),step.constraints||[]).worst>.12)return step;
 return {...step,pose:pack(candidate),features:t.features(candidate),headingAlignment:{kind:'minimum-pelvis-twist',removedDegrees:correction.angleTo(new Quaternion())*180/Math.PI}};
}
