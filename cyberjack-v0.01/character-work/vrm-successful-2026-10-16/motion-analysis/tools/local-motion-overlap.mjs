import{poseTools,pack,constraintScore}from'../review/command-pose.mjs';
import{armLegContacts}from'./self-collision.mjs';
const smooth=u=>u*u*u*(u*(u*6-15)+10);
function selected(t,s){const policy=s.legOnly||s.armOnly;if(!policy)return null;const roots=policy.roots||policy.sides.map(side=>'cf_j_shoulder_'+(side==='left'?'L':'R'));return new Set(t.m.rig.flatMap((_,i)=>{for(let j=i;j>=0;j=t.m.rig[j].parentIndex)if(roots.includes(t.m.rig[j].name))return[i];return[];}));}
export function overlapLocalMotions(bank,steps){
 const t=poseTools(bank),out=[...steps],sample=(s,time)=>{const f=Math.max(0,Math.min(1,time/s.duration))*(s.motion.frames.length-1),i=Math.min(s.motion.frames.length-2,Math.floor(f));return t.interpolate(t.unpack(s.motion.frames[i]),t.unpack(s.motion.frames[i+1]),f-i);};
 for(let k=0;k<out.length-1;k++){
  const a=out[k],b=out[k+1],left=selected(t,a),right=selected(t,b);
  if(!left||!right||[...left].some(j=>right.has(j))||a.status!=='ready'||b.status!=='ready'||!a.motion?.directPlayback||!b.motion?.directPlayback||a.motion.supportTrack||b.motion.supportTrack||a.motion.physicalSimulation||b.motion.physicalSimulation||a.object||b.object||a.translation?.some(Boolean)||b.translation?.some(Boolean)||a.yaw||b.yaw)continue;
  const end=t.unpack(a.pose),begin=t.unpack(b.motion.frames[0]);if(end.some((j,i)=>j.p.distanceTo(begin[i].p)>.00001||j.q.angleTo(begin[i].q)>.00001))continue;
  const overlap=Math.min(.3,a.duration*.2,b.duration*.2),start=a.duration-overlap,frames=[],count=Math.ceil(a.duration*30),threshold=Math.max(.025,...a.motion.frames.map(f=>armLegContacts(t,t.unpack(f)).worst),...b.motion.frames.map(f=>armLegContacts(t,t.unpack(f)).worst));let valid=true;
  for(let i=0;i<=count;i++){
   const time=i*a.duration/count,p=sample(a,time);if(time>start){const q=sample(b,time-start),w=smooth((time-start)/overlap);for(const j of right){p[j].p.lerp(q[j].p,w);p[j].q.slerp(q[j].q,w);p[j].s.lerp(q[j].s,w);}t.m.fk(p);}
   const old=p.map(j=>j.q.clone());t.limitJoints(p);for(let j=0;j<p.length;j++)if(!left.has(j)&&!right.has(j))p[j].q.copy(old[j]);t.m.fk(p);if(p.some((j,n)=>(left.has(n)||right.has(n))&&j.q.angleTo(old[n])>.01)||armLegContacts(t,p).worst>threshold+.001||t.ground(p)<-.012*t.height){valid=false;break;}frames.push(pack(p));
  }
  if(!valid||constraintScore(t.features(t.unpack(frames.at(-1))),a.constraints||[]).worst>.12)continue;
  const duration=b.duration-overlap,tail=[],n=Math.ceil(duration*30);for(let i=0;i<=n;i++)tail.push(pack(sample(b,overlap+i*duration/n)));tail[0]=frames.at(-1);tail[tail.length-1]=b.pose;frames[0]=a.motion.frames[0];
  out[k]={...a,pose:frames.at(-1),features:t.features(t.unpack(frames.at(-1))),motion:{...a.motion,frames},localOverlap:{seconds:overlap,next:b.description,policy:'disjoint local chains; exact root, validated previous goal and collisions'}};
  out[k+1]={...b,duration,motion:{...b.motion,frames:tail,duration},localOverlap:{seconds:overlap,previous:a.description,policy:'entry consumed during previous local movement'}};
  k++; // Do not compound overlaps without validating a larger scheduling window.
 }
 return out;
}
