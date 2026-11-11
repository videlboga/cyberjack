import {poseTools,pack} from '../review/command-pose.mjs';
import {interpolateRecorded} from '../review/native-motion.mjs';
const ease=u=>{u=Math.max(0,Math.min(1,u));return u*u*u*(u*(u*6-15)+10);};
function sample(t,m,time){const x=Math.max(0,Math.min(1,time/m.duration))*(m.frames.length-1),i=Math.min(m.frames.length-2,Math.floor(x));const p=interpolateRecorded(t.unpack(m.frames[i]),t.unpack(m.frames[i+1]),x-i);t.m.fk(p);return p;}
function progress(m,time){const a=m.rootProgress;if(!a)return 0;const x=Math.max(0,Math.min(1,time/m.duration))*(a.length-1),i=Math.min(a.length-2,Math.floor(x));return a[i]+(a[i+1]-a[i])*(x-i);}
export function overlapRiseWalk(bank,steps){const out=[...steps],t=poseTools(bank);
 for(let k=0;k<out.length-1;k++){const rise=out[k],walk=out[k+1];if(!rise.recordedRise||!walk.motion?.externalPilot||!rise.motion||rise.status!=='ready'||walk.status!=='ready'||Math.abs((walk.headingTarget??0)-(rise.headingTarget??0))>.01)continue;
 let overlap=Math.min(.75,rise.duration*.25);while(overlap>=.20){const entry=t.features(sample(t,rise.motion,rise.duration-overlap));if(entry.hipHeight>=.45&&entry.torsoInclination<=45)break;overlap-=1/30;}if(overlap<.20)continue;const begin=rise.duration-overlap;
 // Consume the gait's separate .45s stationary entry inside the rising tail.
 const skip=.45,duration=begin+walk.duration-skip,count=Math.ceil(duration*30),frames=[],roots=[];
 for(let i=0;i<=count;i++){const time=i*duration/count;if(time<begin){frames.push(pack(sample(t,rise.motion,time)));roots.push(0);continue;}const local=time-begin+skip,u=ease((time-begin)/overlap),gait=sample(t,walk.motion,local);let p=gait;if(time<rise.duration){p=interpolateRecorded(sample(t,rise.motion,time),gait,u);t.m.fk(p);}frames.push(pack(p));roots.push(progress(walk.motion,local)*u);}
 frames[0]=structuredClone(rise.motion.frames[0]);frames[frames.length-1]=structuredClone(walk.motion.frames.at(-1));roots[0]=0;roots[roots.length-1]=1;
 const contacts=roots.map((_,i)=>{const time=i*duration/count;if(time<rise.duration)return {};const local=time-begin+skip,source=walk.motion.contacts;if(!source)return {};const index=Math.min(source.length-1,Math.round(local/walk.motion.duration*(source.length-1)));return structuredClone(source[index]);});
 out.splice(k,2,{...walk,description:'Встать и сразу начать идти',duration,method:'Записанный подъём с перекрытием начала шага',transition:'Подъём и первый шаг перекрываются; без остановки в стойке',motion:{frames,duration,noMargins:true,loop:false,rootProgress:roots,directPlayback:true,contacts,source:{name:'Stand Up 1 → 100STYLE Neutral · перекрытие'},contactPolicy:'source gait contacts retained after overlap; overlap support not locked'},overlap:{seconds:overlap,start:begin,originalRiseDuration:rise.duration,skippedGaitEntry:skip},recordedRise:undefined});
 }
 return out;
}
