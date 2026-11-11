// Geometry-only descriptors. No action names, categories or old semantic tags.
import {Vector3} from 'three';
export const CLASSIFICATION_VERSION='motion-descriptors-v2.1';
const mean=a=>a.reduce((s,x)=>s+x,0)/(a.length||1),fraction=(a,key)=>a.filter(x=>x===key).length/(a.length||1),round=n=>Number(n.toFixed(3));
function majority(values,min=.6){const counts=new Map();for(const x of values)counts.set(x,(counts.get(x)||0)+1);const [name,count]=[...counts].sort((a,b)=>b[1]-a[1])[0];return {value:count/values.length>=min?name:'mixed',fraction:round(count/values.length)}}
export const flexionGrade=degrees=>degrees<15?'near-straight':degrees<45?'slight':degrees<90?'moderate':degrees<120?'deep':'folded';
function angle(a,b,c){return new Vector3(...a).sub(new Vector3(...b)).angleTo(new Vector3(...c).sub(new Vector3(...b)))*180/Math.PI}
export function describeMotion({frames,names,height,duration,rest}){
 const ix=n=>names.indexOf('cf_j_'+n),pt=(f,n)=>f[ix(n)],v=(f,n)=>new Vector3(...pt(f,n)),dt=duration/(frames.length-1)||1;
 // Source forward sign comes from the rest toes, rather than a world-axis guess.
 const restUp=v(rest,'neck').sub(v(rest,'hips')).normalize(),restLeft=v(rest,'arm00_L').sub(v(rest,'arm00_R')).normalize(),front=restLeft.clone().cross(restUp).normalize(),toeForward=v(rest,'toes_L').sub(v(rest,'foot_L')).add(v(rest,'toes_R').sub(v(rest,'foot_R'))),sign=front.dot(toeForward)>=0?1:-1;
 const body=[],stance=[],poses={L:[],R:[]},knees={L:[],R:[]},handLocations={L:[],R:[]},worldHands={L:[],R:[]},handHeight={L:[],R:[]},velocities={leftArm:[],rightArm:[],leftLeg:[],rightLeg:[],torso:[],head:[]},records=[];
 for(let i=0;i<frames.length;i++){
  const f=frames[i],hip=v(f,'hips'),up=v(f,'neck').sub(hip).normalize(),left=v(f,'arm00_L').sub(v(f,'arm00_R')).normalize(),forward=left.clone().cross(up).normalize().multiplyScalar(sign),horizontal=Math.abs(up.y)<.45,roll=Math.abs(left.y);
  const orientation=up.y<-.55?'inverted':horizontal?(roll>.65?'horizontal-side':'horizontal-other'):up.y>.8?'upright':'inclined';body.push(orientation);
  const hipHeight=(hip.y-Math.min(pt(f,'foot_L')[1],pt(f,'foot_R')[1]))/height,footGap=Math.abs(pt(f,'foot_L')[1]-pt(f,'foot_R')[1])/height,handGap=Math.abs(mean(['L','R'].map(s=>pt(f,'hand_'+s)[1]))-mean(['L','R'].map(s=>pt(f,'foot_'+s)[1])))/height;
  const ka=['L','R'].map(s=>angle(pt(f,'thigh00_'+s),pt(f,'leg01_'+s),pt(f,'foot_'+s)));
  const handY=['L','R'].map(s=>pt(f,'hand_'+s)[1]),footY=['L','R'].map(s=>pt(f,'foot_'+s)[1]),kneeY=['L','R'].map(s=>pt(f,'leg01_'+s)[1]),planeGap=ys=>(Math.max(...ys)-Math.min(...ys))/height,raisedAbove=ys=>(hip.y-Math.max(...ys))/height,headBelowHip=(hip.y-pt(f,'head')[1])/height>.08;
  let support='uncertain';if(Math.min(...footY)>=Math.min(...handY,...kneeY)-height*.08&&planeGap([...handY,...kneeY])<.065&&raisedAbove([...handY,...kneeY])>.12&&up.y<.65)support='hands-knees-shape';else if(planeGap([...handY,...footY])<.065&&raisedAbove([...handY,...footY])>.18&&up.y<.65)support=headBelowHip?'hands-feet-raised-pelvis':'hands-feet-shape';else if(hipHeight>.35&&Math.max(...ka)>145)support=footGap>.1?'one-foot-low':'feet-below-pelvis';else if(up.y>.65&&ka.every(k=>k<140)&&hipHeight>.15)support='seated-shape';else if(horizontal&&handGap<.1&&hipHeight>.2&&ka.every(k=>k<145))support='hands-feet-level';else if(horizontal&&hipHeight<.3)support='low-horizontal';stance.push(support);
  for(const [j,s]of ['L','R'].entries()){
   knees[s].push(ka[j]);const shape=ka[j]>155?'extended':ka[j]<125?'bent':'intermediate';poses[s].push(shape);
   const shoulder=v(f,'arm00_'+s),hand=v(f,'hand_'+s),rel=hand.sub(shoulder).divideScalar(height),vertical=rel.dot(up),depth=rel.dot(forward),outward=rel.dot(left)*(s==='L'?1:-1);let location='near-body';
   if(vertical>.14)location='overhead';else if(vertical<-.23)location='lowered';else if(depth>.15&&depth>outward*.7)location='front';else if(outward>.18)location='side';else if(depth<-.1)location='behind';handLocations[s].push(location);const worldDelta=(pt(f,'hand_'+s)[1]-pt(f,'head')[1])/height;handHeight[s].push(worldDelta);worldHands[s].push(worldDelta>.05?'above-head':worldDelta<-.05?'below-head':'head-level');
  }
  if(i){const prev=frames[i-1],hipPrev=v(prev,'hips');for(const [key,bone]of Object.entries({leftArm:'hand_L',rightArm:'hand_R',leftLeg:'foot_L',rightLeg:'foot_R',torso:'spine03',head:'head'})){const rel=v(f,bone).sub(hip),old=v(prev,bone).sub(hipPrev);velocities[key].push(rel.distanceTo(old)/height/dt)}}
  records.push({body:orientation,stance:support,legs:['L','R'].map(s=>poses[s].at(-1)),arms:['L','R'].map(s=>handLocations[s].at(-1))});
 }
 const activity={};for(const [key,values]of Object.entries(velocities)){const sorted=[...values].sort((a,b)=>a-b),avg=mean(values);activity[key]={mean:round(avg),p90:round(sorted[Math.floor(sorted.length*.9)]||0),level:avg<.015?'quiet':avg<.08?'small':'active'}}
 const legs={};for(const [s,key]of [['L','leftLeg'],['R','rightLeg']]){const sorted=[...knees[s]].sort((a,b)=>a-b);legs[s]={shape:majority(poses[s]),motion:activity[key].level,kneeRange:round(sorted.at(-1)-sorted[0]),flexion:{min:round(180-sorted.at(-1)),max:round(180-sorted[0]),mean:round(180-mean(sorted)),grade:majority(knees[s].map(k=>flexionGrade(180-k))) }}}
 const arms={};for(const [s,key]of [['L','leftArm'],['R','rightArm']])arms[s]={position:majority(handLocations[s]),positionFrame:'torso',worldHeight:majority(worldHands[s]),heightAboveHead:{min:round(Math.min(...handHeight[s])),max:round(Math.max(...handHeight[s])),mean:round(mean(handHeight[s]))},motion:activity[key].level};
 const order=Object.entries(activity).filter(([k])=>k!=='head').sort((a,b)=>b[1].mean-a[1].mean),dominant=order[0][1].mean<.015?'quiet':order[0][1].mean>Math.max(.015,order[1][1].mean)*1.7?order[0][0]:'distributed';
 const legShapes=['L','R'].map(s=>legs[s].shape.value),legPattern=legShapes.includes('extended')&&legShapes.includes('bent')?'one-extended-one-bent':legShapes.every(x=>x==='extended')?'both-extended':legShapes.every(x=>x==='bent')?'both-bent':'mixed';
 const key=r=>[r.body,r.stance,...r.legs,...r.arms].join('/'),runs=[];for(let i=0;i<records.length;i++){const last=runs.at(-1),k=key(records[i]);if(last?.key===k)last.end=i;else runs.push({key:k,start:i,end:i,descriptor:records[i]})}
 // Absorb short threshold crossings; these are coarse phases, not cut points.
 const stable=[];for(const run of runs){const last=stable.at(-1);if((run.end-run.start+1)*dt<.4&&last)last.end=run.end;else if(last?.key===run.key)last.end=run.end;else stable.push({...run})}
 const phases=stable.map(r=>({start:round(r.start*dt),end:round(Math.min(duration,(r.end+1)*dt)),...r.descriptor}));
 return {version:CLASSIFICATION_VERSION,body:majority(body),stance:majority(stance),arms,legs,legPattern,dominantMotion:dominant,activity,phaseCount:phases.length,bodyChanges:Math.max(0,new Set(stable.map(r=>r.descriptor.body)).size-1),phases};
}
