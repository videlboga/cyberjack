import {Vector3,Quaternion} from 'three';
import {solveChain} from './foot-contacts.mjs';
import {pack,constraintScore} from '../review/command-pose.mjs';
const clamp=x=>Math.max(0,Math.min(1,x));
export function segmentDistance(a,b,c,d){
 const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),A=u.dot(u),B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(w),den=A*C-B*B;
 let s=A<1e-12?0:clamp(den>1e-12?(B*E-C*D)/den:0),t=C<1e-12?0:clamp((B*s+E)/C);
 s=A<1e-12?0:clamp((B*t-D)/A);t=C<1e-12?0:clamp((B*s+E)/C);
 return a.clone().addScaledVector(u,s).distanceTo(c.clone().addScaledVector(v,t));
}
// Conservative skeleton capsules, in units of character height. Not mesh collision.
export function armLegContacts(t,p){t.m.fk(p);const contacts=[];for(const side of ['L','R'])for(const [arm,a,b,ar]of [['upper','arm00','forearm01',.014],['forearm','forearm01','hand',.012]])for(const legSide of ['L','R'])for(const [leg,c,d,lr]of [['thigh','thigh00','leg01',.037],['shin','leg01','foot',.024]]){
 const distance=segmentDistance(t.point(p,a+'_'+side),t.point(p,b+'_'+side),t.point(p,c+'_'+legSide),t.point(p,d+'_'+legSide))/t.height,penetration=Math.max(0,ar+lr-distance);if(penetration>.002)contacts.push({side,arm,legSide,leg,penetration});
 }// Check non-adjacent arms against torso, and opposing leg chains.
 for(const side of ['L','R'])for(const [arm,a,b,r]of [['upper','arm00','forearm01',.014],['forearm','forearm01','hand',.012]]){
  let start=t.point(p,a+'_'+side),end=t.point(p,b+'_'+side);if(arm==='upper')start.lerp(end,.35);
  for(const [name,c,d,bodyRadius]of [['pelvis','hips','spine01',.060],['waist','spine01','spine02',.052],['chest','spine02','spine03',.060]]){
   const penetration=Math.max(0,r+bodyRadius-segmentDistance(start,end,t.point(p,c),t.point(p,d))/t.height);
   if(penetration>.006)contacts.push({side,arm,body:name,penetration});
  }
 }
 for(const [la,a,b,ra]of [['thigh','thigh00','leg01',.034],['shin','leg01','foot',.023]])for(const [lb,c,d,rb]of [['thigh','thigh00','leg01',.034],['shin','leg01','foot',.023]]){
  const start=t.point(p,a+'_L'),end=t.point(p,b+'_L'),other=t.point(p,c+'_R'),finish=t.point(p,d+'_R');if(la==='thigh')start.lerp(end,.25);if(lb==='thigh')other.lerp(finish,.25);
  const penetration=Math.max(0,ra+rb-segmentDistance(start,end,other,finish)/t.height);if(penetration>.006)contacts.push({side:'L',leg:la,legSide:'R',otherLeg:lb,kind:'leg-leg',penetration});
 }
 return {contacts,worst:Math.max(0,...contacts.map(c=>c.penetration)),cost:contacts.reduce((n,c)=>n+c.penetration**2,0)};
}
export function resolveArmLegCollisions(t,p,constraints=[]){
 const initial=armLegContacts(t,p),saved=pack(p);let changed=false;
 for(const [side,key]of [['L','left'],['R','right']]){
 const grip=constraints.some(c=>c.feature===key+'HandKneeDistance'),collision=armLegContacts(t,p);if(!grip&&!collision.contacts.some(c=>c.side===side&&c.arm&&c.penetration>.012))continue;
 if(grip){const a=t.point(p,'arm00_'+side),b=t.point(p,'forearm01_'+side),c=t.point(p,'hand_'+side);if(a.distanceTo(t.point(p,'leg01_'+side))>a.distanceTo(b)+b.distanceTo(c)+t.height*.08)continue;}
 const before=pack(p),wrist=t.point(p,'hand_'+side),out=t.point(p,'thigh00_'+side).sub(t.point(p,'thigh00_'+(side==='L'?'R':'L'))).normalize(),up=t.point(p,'neck').sub(t.point(p,'hips')).normalize();
 const targets=grip?[t.point(p,'leg01_'+side).addScaledVector(out,t.height*.05),t.point(p,'leg01_'+side).addScaledVector(up,t.height*.05),wrist]:[wrist,wrist.clone().addScaledVector(out,t.height*.04)];
 let best={pose:before,score:collision.cost*10000+ (grip?t.features(p)[key+'HandKneeDistance']*.1:0)};
 for(const target of targets)for(const pole of [out,up,out.clone().add(up).normalize(),out.clone().sub(up).normalize()]){
  const candidate=t.unpack(before);const error=solveChain(t,candidate,['arm00','forearm01','hand'].map(n=>'cf_j_'+n+'_'+side),target,undefined,pole);if(error>.025*t.height||constraintScore(t.features(candidate),constraints.filter(c=>!c.feature.startsWith(key==='left'?'rightHand':'leftHand')&&!c.feature.startsWith(key==='left'?'rightElbow':'leftElbow')&&!c.feature.startsWith(key==='left'?'rightArm':'leftArm'))).worst>.12)continue;
  const f=t.features(candidate);if(f[key+'Elbow']>153)continue;const c=armLegContacts(t,candidate),score=c.cost*10000+(grip?f[key+'HandKneeDistance']*.1:0)+t.point(candidate,'hand_'+side).distanceTo(wrist)/t.height*.02;
  if(score<best.score-1e-6)best={pose:pack(candidate),score};
 }
 const q=t.unpack(best.pose);for(let i=0;i<p.length;i++){p[i].q.copy(q[i].q);p[i].p.copy(q[i].p);p[i].s.copy(q[i].s);}changed||=JSON.stringify(before)!==JSON.stringify(best.pose);
 }
 t.m.fk(p);return {model:'arm-leg-skeleton-capsules',changed,initial,final:armLegContacts(t,p),protected:'root and leg chains'};
}
// Repair opposing legs only when necessary; keep the pelvis/root fixed and
// retain every commanded condition. Unsupported repairs are rejected by caller.
export function resolveBodyCollisions(t,p,constraints=[]){
 let result=resolveArmLegCollisions(t,p,constraints),changed=result.changed;
 for(let pass=0;pass<2;pass++){
  const collision=armLegContacts(t,p);if(!collision.contacts.some(c=>c.kind==='leg-leg'&&c.penetration>.012))break;
  const original=pack(p),up=t.point(p,'neck').sub(t.point(p,'hips')).normalize();let best={pose:original,cost:collision.cost};
  for(const side of ['L','R'])for(const amount of [-.20,-.10,.10,.20]){
   const q=t.unpack(original),j=t.m.index.get('cf_j_thigh00_'+side),parent=t.m.rig[j].parentIndex;
   const world=q[j].worldQ.clone().premultiply(new Quaternion().setFromAxisAngle(up,amount));q[j].q.copy(q[parent].worldQ).invert().multiply(world);t.m.fk(q);t.limitJoints(q);
   if(t.ground(q)<Math.min(-t.height*.012,t.ground(p)-.002)||constraintScore(t.features(q),constraints).worst>.12)continue;
   const cost=armLegContacts(t,q).cost;if(cost<best.cost-1e-6)best={pose:pack(q),cost};
  }
  if(best.pose===original)break;const q=t.unpack(best.pose);p.forEach((n,i)=>n.q.copy(q[i].q));t.m.fk(p);changed=true;
 }
 result=resolveArmLegCollisions(t,p,constraints);return {...result,changed:changed||result.changed,model:'limb-torso-and-opposing-leg-capsules',protected:'root and pelvis'};
}
