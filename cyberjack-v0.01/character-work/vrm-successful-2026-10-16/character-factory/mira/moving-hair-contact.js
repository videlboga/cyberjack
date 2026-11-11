import * as T from 'three';
import {prepareHairCollider,projectHairCollider} from './viewer-hair-physics.js?v=short-caps-22';
// Swept sampling is bounded by the particle clearance. It handles a collider
// passing through a stationary particle as well as a moving particle.
export class MovingHairContact {
 constructor(){this.shape={a:new T.Vector3(),b:new T.Vector3(),depthAxis:new T.Vector3()};this.probe=new T.Vector3();this.start=new T.Vector3();this.axis=new T.Vector3();this.normal=new T.Vector3();this.contactPoint=new T.Vector3();}
 sample(from,to,before,after,t,radius){
  const s=this.shape;s.a.lerpVectors(before.a,after.a,t);s.b.lerpVectors(before.b,after.b,t);s.depthAxis.lerpVectors(before.depthAxis,after.depthAxis,t).normalize();s.radius=T.MathUtils.lerp(before.radius,after.radius,t);s.depthScale=T.MathUtils.lerp(before.depthScale||1,after.depthScale||1,t);s.capScale=T.MathUtils.lerp(before.capScale||1,after.capScale||1,t);prepareHairCollider(s);
  this.probe.lerpVectors(from,to,t);return projectHairCollider(this.probe,s,radius);
 }
 project(from,to,before,after,radius=.012){
  const extent=Math.max(before.radius,after.radius)+radius/Math.min(before.depthScale||1,after.depthScale||1);
  for(const key of ['x','y','z'])if(Math.max(from[key],to[key])<Math.min(before.a[key],before.b[key],after.a[key],after.b[key])-extent||Math.min(from[key],to[key])>Math.max(before.a[key],before.b[key],after.a[key],after.b[key])+extent)return false;
  if(this.sample(from,to,before,after,0,radius))return false; // Initial overlap uses normal recovery.
  const motion=from.distanceTo(to)+Math.max(before.a.distanceTo(after.a),before.b.distanceTo(after.b));
  const count=Math.min(128,Math.max(1,Math.ceil(motion/Math.max(.002,radius*.5))));let lo=0,hi=null;
  for(let i=1;i<=count;i++){const t=i/count;if(this.sample(from,to,before,after,t,radius)){hi=t;break;}lo=t;}
  if(hi===null)return false;
  for(let i=0;i<10;i++){const mid=(lo+hi)*.5;if(this.sample(from,to,before,after,mid,radius))hi=mid;else lo=mid;}
  this.sample(from,to,before,after,hi,radius);const hit=this.probe.clone(),s=this.shape;
  this.start.lerpVectors(from,to,hi);this.axis.subVectors(s.b,s.a);const length=this.axis.lengthSq(),u=length?T.MathUtils.clamp(this.start.clone().sub(s.a).dot(this.axis)/length,0,1):0;
  // Carry the contact by the remaining motion of its point on the capsule.
  const oldAxis=s.a.clone().lerp(s.b,u),newAxis=after.a.clone().lerp(after.b,u);to.copy(hit).add(newAxis.sub(oldAxis));
  prepareHairCollider(after);projectHairCollider(to,after,radius+.0001);
  this.axis.subVectors(after.b,after.a);const axisLength=this.axis.lengthSq(),fraction=axisLength?T.MathUtils.clamp(this.start.copy(to).sub(after.a).dot(this.axis)/axisLength,0,1):0;
  this.normal.copy(to).sub(this.start.copy(after.a).addScaledVector(this.axis,fraction));
  const depth=after.depthAxis,scale=after.depthScale||1;this.normal.addScaledVector(depth,this.normal.dot(depth)*(1/(scale*scale)-1));
  if(this.normal.lengthSq()<1e-12)this.normal.set(1,0,0);else this.normal.normalize();this.contactPoint.copy(to);return true;
 }
}
export function copyHairCollider(c){return {a:c.a.clone(),b:c.b.clone(),radius:c.radius,depthScale:c.depthScale||1,capScale:c.capScale||1,depthAxis:c.depthAxis.clone(),bodyPart:c.bodyPart};}
