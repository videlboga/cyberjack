// Anatomical measurements, independent of source action labels. Degrees; lengths / reference height.
import {Vector3,Quaternion} from 'three';
import {measurePoseParts} from './pose-parts.mjs';
export const ANATOMY_VERSION='anatomy-v6';
const mean=a=>a.reduce((s,x)=>s+x,0)/(a.length||1),round=x=>Math.round(x*1000)/1000;
const summary=a=>({min:round(Math.min(...a)),max:round(Math.max(...a)),mean:round(mean(a))});
export function describeAnatomy({frames,rots,names,height,duration,headWorldQ,headRestForward}){
 const at=n=>names.indexOf('cf_j_'+n),v=(f,n)=>new Vector3(...f[at(n)]),dt=duration/(frames.length-1)||1;
 // One floor for the whole clip: the lowest point any body part reaches. A per-frame minimum made every pose
 // look like it touched the ground, which is why lying bodies were classified as kneeling.
 let clipFloor=Infinity;
 for(const f of frames)for(const n of ['foot_L','foot_R','toes_L','toes_R','leg01_L','leg01_R','hand_L','hand_R','hips'])clipFloor=Math.min(clipFloor,v(f,n).y);
 const series={},put=(k,x)=>(series[k]??=[]).push(x),angle=(a,b)=>a.angleTo(b)*180/Math.PI;
 for(const [fi,f] of frames.entries()){
  const up=v(f,'neck').sub(v(f,'hips')).normalize(),left=v(f,'arm00_L').sub(v(f,'arm00_R')).normalize();
  // Head yaw/pitch relative to the torso frame. Face forward is a rest-calibrated assumption, not gaze.
  if(headWorldQ&&headRestForward){
   const forward=new Vector3().crossVectors(left,up).normalize(),headF=headRestForward.clone().applyQuaternion(new Quaternion(...headWorldQ[fi])).normalize();
   put('head.yaw',Math.atan2(headF.dot(left),headF.dot(forward))*180/Math.PI);
   put('head.pitch',Math.asin(Math.max(-1,Math.min(1,headF.dot(up))))*180/Math.PI);
  }
  // No universal forward sign is inferred here; unsigned elevation/abduction remain portable.
  for(const s of ['L','R']){
   for(const [part,a,b,c] of [['arm','arm00','forearm01','hand'],['leg','thigh00','leg01','foot']]){
    const proximal=v(f,a+'_'+s),middle=v(f,b+'_'+s),distal=v(f,c+'_'+s),direction=middle.clone().sub(proximal).normalize();
    put(`${s}.${part}.flexion`,180-angle(proximal.clone().sub(middle),distal.clone().sub(middle)));
    put(`${s}.${part}.elevation`,90-angle(direction,up));
    put(`${s}.${part}.outward`,direction.dot(left)*(s==='L'?1:-1));
   }
   put(`${s}.foot.extension`,angle(v(f,'leg01_'+s).sub(v(f,'foot_'+s)),v(f,'toes_'+s).sub(v(f,'foot_'+s))));
   // Knee support: distance of the knee joint to the lowest body point of this frame, shin pitch off horizontal.
   const knee=v(f,'leg01_'+s),ankle=v(f,'foot_'+s),shin=ankle.clone().sub(knee);
   put(`${s}.knee.aboveFloor`,(knee.y-clipFloor)/height);
   put(`${s}.shin.pitch`,Math.asin(Math.max(-1,Math.min(1,shin.y/(shin.length()||1))))*180/Math.PI);
  }
  // Heights above the lowest body point of the frame: the only floor proxy available without a scene.
  {
   put('pelvis.aboveFloor',(v(f,'hips').y-clipFloor)/height);
   put('L.hand.aboveFloor',(v(f,'hand_L').y-clipFloor)/height);
   put('R.hand.aboveFloor',(v(f,'hand_R').y-clipFloor)/height);
   put('L.foot.aboveFloor',(v(f,'foot_L').y-clipFloor)/height);
   put('R.foot.aboveFloor',(v(f,'foot_R').y-clipFloor)/height);
  }
  const low=v(f,'spine01').sub(v(f,'hips')).normalize(),high=v(f,'neck').sub(v(f,'spine03')).normalize();
  put('spine.curvature',angle(low,high));put('spine.sideBend',Math.asin(Math.max(-1,Math.min(1,high.dot(left)-low.dot(left))))*180/Math.PI);
  put('body.inclination',angle(up,new Vector3(0,1,0)));put('pelvis.aboveFeet',(v(f,'hips').y-Math.min(v(f,'foot_L').y,v(f,'foot_R').y))/height);
  put('pelvis.aboveKnees',(v(f,'hips').y-Math.max(v(f,'leg01_L').y,v(f,'leg01_R').y))/height);
 }
 const angular={};if(rots)for(const bone of ['hips','spine01','spine02','spine03','neck','head','hand_L','hand_R','foot_L','foot_R']){
  const j=at(bone),speeds=[];for(let i=1;i<rots.length;i++)speeds.push(new Quaternion(...rots[i-1][j]).angleTo(new Quaternion(...rots[i][j]))*180/Math.PI/dt);
  angular[bone]={...summary(speeds),unit:'deg/s'};
 }
 const metrics=Object.fromEntries(Object.entries(series).map(([k,a])=>[k,{...summary(a),unit:k.endsWith('outward')?'ratio':k==='pelvis.aboveFeet'?'height':'deg'}]));
 // Independent, stable runs. Each atom belongs to one property, not an entire pose tuple.
 const atoms=[];for(const [key,a]of Object.entries(series)){
  if(!key.endsWith('flexion')&&!key.endsWith('elevation'))continue;
  const bin=x=>key.endsWith('flexion')?(x<25?'extended':x>60?'bent':'intermediate'):(x>30?'raised':x< -30?'lowered':'level');
  let start=0;for(let i=1;i<=a.length;i++)if(i===a.length||bin(a[i])!==bin(a[start])){
   const end=Math.min(duration,i*dt);if(end-start*dt>=.4)atoms.push({property:key,value:bin(a[start]),start:round(start*dt),end:round(end),range:summary(a.slice(start,i)),status:'measured-candidate'});start=i;
  }
 }
 // Kneeling is a measured body state, not a name: both knees near the lowest point, pelvis above them,
 // shins close to horizontal. Thresholds are provisional and stated in the limitations.
 {
  const la=series['L.knee.aboveFloor'],ra=series['R.knee.aboveFloor'],pk=series['pelvis.aboveKnees'],sl=series['L.shin.pitch'],sr=series['R.shin.pitch'];
  if(la&&ra&&pk&&sl&&sr){
   const kneeling=i=>la[i]<.06&&ra[i]<.06&&pk[i]>.12&&Math.abs(sl[i])<35&&Math.abs(sr[i])<35;
   let start=0;for(let i=1;i<=la.length;i++)if(i===la.length||kneeling(i)!==kneeling(start)){
    const end=Math.min(duration,i*dt);if(kneeling(start)&&end-start*dt>=.4)atoms.push({property:'knee.support',value:'knees',start:round(start*dt),end:round(end),range:{kneesAboveFloor:round(Math.max(...la.slice(start,i)))},status:'measured-candidate'});start=i;
   }
  }
 }
 // Feet support: soles are the lowest body point, knees clearly above them. Symmetric to knee.support.
 {
  const fa=series['pelvis.aboveFeet'],la=series['L.knee.aboveFloor'],ra=series['R.knee.aboveFloor'];
  if(fa&&la&&ra){
   const onFeet=i=>la[i]>.10&&ra[i]>.10&&fa[i]>.25;
   let start=0;for(let i=1;i<=fa.length;i++)if(i===fa.length||onFeet(i)!==onFeet(start)){
    const end=Math.min(duration,i*dt);if(onFeet(start)&&end-start*dt>=.4)atoms.push({property:'foot.support',value:'feet',start:round(start*dt),end:round(end),range:{kneesAboveFloor:round(Math.min(...la.slice(start,i)))},status:'measured-candidate'});start=i;
   }
  }
 }
 // Support set (clip level): one floor for the clip, torso angle from world up, and the contact set from
 // absolute heights. Kneeling, kneeling folded over, kneeling on one hand, all fours, lying, sitting on the
 // butt (shins folded, legs aside), sitting with the knees up on three points, standing on the feet.
 {
  const need=['L.knee.aboveFloor','R.knee.aboveFloor','pelvis.aboveFloor','L.hand.aboveFloor','R.hand.aboveFloor','L.foot.aboveFloor','R.foot.aboveFloor','body.inclination','L.leg.outward','R.leg.outward'];
  if(need.every(k=>series[k])){
   const median=a=>{const s=[...a].sort((x,y)=>x-y);return s[Math.floor(s.length/2)]};
   const g={incl:median(series['body.inclination']),pelvis:median(series['pelvis.aboveFloor']),knees:Math.min(median(series['L.knee.aboveFloor']),median(series['R.knee.aboveFloor'])),hands:Math.min(median(series['L.hand.aboveFloor']),median(series['R.hand.aboveFloor'])),handsMax:Math.max(median(series['L.hand.aboveFloor']),median(series['R.hand.aboveFloor'])),feet:Math.min(median(series['L.foot.aboveFloor']),median(series['R.foot.aboveFloor'])),outward:Math.max(median(series['L.leg.outward']),median(series['R.leg.outward']))};
   const horizontal=g.incl>55,kneesDown=g.knees<.08,feetDown=g.feet<.08,handsDown=g.hands<.08,bothHands=g.handsMax<.10,pelvisLow=g.pelvis<=.17,pelvisHigh=g.pelvis>.18;
   let value='other';
   if(kneesDown&&pelvisHigh){value=bothHands?(horizontal?'quadruped':'kneeling-hand'):handsDown?'kneeling-hand':g.incl>45?'kneeling-fold':'kneeling'}
   else if(horizontal)value='lying';
   else if(pelvisLow){value=(!kneesDown&&g.knees>.2&&handsDown)?'three-point':g.outward>.45?'butt-side':(feetDown&&kneesDown)?'butt-folded':'butt'}
   else if(feetDown&&g.pelvis>.3)value='feet';
   if(value!=='other')atoms.push({property:'support.set',value,start:0,end:round(duration),range:{inclination:round(g.incl),pelvisAboveFloor:round(g.pelvis),kneesAboveFloor:round(g.knees),handsAboveFloor:round(g.hands),handSpread:round(g.handsMax-g.hands),legOutward:round(g.outward)},status:'measured-candidate'});
  }
 }
 // Offered part: which body part the pose presents, measured against the character's own body
 // (extended leg out of the body line, pelvis lifted above the chest, or hands held out).
 {
  const parts=measurePoseParts({frames,names,height}),n=parts.series.feet.length;
  for(const k of ['feet','hands','hips'])for(const v of parts.series[k])put(`presented.${k}`,v);
  const pick=i=>{let best='none',top=0;for(const k of ['feet','hands','hips']){const s=parts.series[k][i]-(k==='feet'?.2:k==='hands'?.25:.08);if(s>top){top=s;best=k}}return best};
  let start=0;for(let i=1;i<=n;i++)if(i===n||pick(i)!==pick(start)){
   const end=Math.min(duration,i*dt);if(pick(start)!=='none'&&end-start*dt>=.7)atoms.push({property:'presented.part',value:pick(start),start:round(start*dt),end:round(end),range:{feet:round(parts.series.feet[start]),hands:round(parts.series.hands[start]),hips:round(parts.series.hips[start])},status:'measured-candidate'});start=i;
  }
 }
 // Head turns are their own properties: left/right by yaw sign, up/down by pitch.
 // Head yaw is only a left/right turn while the torso is near upright; lying and quadruped poses mix yaw with pitch,
 // so those frames are skipped instead of producing a false turn.
 const incline=series['body.inclination'];
 for(const [key,bin] of [['head.yaw',x=>x>20?'left':x<-20?'right':'forward'],['head.pitch',x=>x>15?'up':x<-15?'down':'level']]){
  const raw=series[key];if(!raw)continue;
  const a=key==='head.yaw'?raw.map((x,i)=>incline&&incline[i]>=45?null:x):raw;
  const classify=x=>x===null?'skipped':bin(x);
  let start=0;for(let i=1;i<=a.length;i++)if(i===a.length||classify(a[i])!==classify(a[start])){
   const end=Math.min(duration,i*dt),value=classify(a[start]);
   if(value!=='skipped'&&end-start*dt>=.4)atoms.push({property:key,value,start:round(start*dt),end:round(end),range:summary(a.slice(start,i).filter(x=>x!==null)),status:'measured-candidate'});
   start=i;
  }
 }
 return {version:ANATOMY_VERSION,metrics,angular,atoms,sampleInterval:round(dt),limitations:['No verified surface contacts or balance','Finger articulation and signed forward/backward twist are not measured','Feet support means soles are the lowest point with knees clearly above them; kneeling is detected by knee height against the lowest body point, pelvis above knees and near-horizontal shins; thresholds are provisional. Head yaw and pitch are the head bone forward axis relative to the torso, calibrated on the rest skeleton; this is not gaze and is not eye direction. Yaw atoms are only emitted while the torso is within 45 degrees of upright: in lying and quadruped poses yaw and pitch cannot be separated','Thresholds are provisional; short runs omitted, not valid transition cuts']};
}
