import {describeAnatomy} from './anatomy.mjs';
import {describeMotion} from './classification.mjs';
import {Matrix4,Quaternion,Vector3} from 'three';
export const VERSION='geometry-v2.0';
export const names=['cf_j_hips','cf_j_spine01','cf_j_spine02','cf_j_spine03','cf_j_neck','cf_j_head',...['L','R'].flatMap(s=>['shoulder','arm00','forearm01','hand','thigh00','leg01','foot','toes'].map(n=>'cf_j_'+n+'_'+s))];
export function buildRig(bones){
 const all=new Map(bones.map(b=>[b.name,b])),needed=new Set();
 for(const name of names){let b=all.get(name);while(b&&!needed.has(b.name)){needed.add(b.name);b=all.get(b.parent)}}
 const ordered=[];function add(b){if(!b||ordered.some(x=>x.name===b.name))return;add(all.get(b.parent));ordered.push({...b,p:new Vector3(),q:new Quaternion(),s:new Vector3(),m:new Matrix4(),world:new Matrix4()})}for(const name of needed)add(all.get(name));
 const map=new Map(ordered.map((b,i)=>[b.name,i]));for(const b of ordered)b.pi=map.get(b.parent)??-1;
 return {ordered,map,needed};
}
export function decoder(data,needed){
 const meta=data.meta,cd=data.clip?.m_MuscleClip?.m_Clip?.data;if(!cd)throw Error('unsupported-native-layout');
 const bindings=meta.bindings.filter(b=>b.typeID===4&&needed.has(b.bone)&&[1,2,3].includes(b.attribute)&&b.width===(b.attribute===2?4:3));
 const wanted=new Set(bindings.flatMap(b=>Array.from({length:b.width},(_,i)=>b.offset+i)));
 const unpack=(x,T)=>{const bytes=Buffer.from(x.data,'base64');return new T(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength))};
 const words=unpack(cd.m_StreamedClip.data,Uint32Array),v=new DataView(words.buffer),channels=new Map();let pos=0;
 while(pos<v.byteLength){if(pos+8>v.byteLength)throw Error('truncated-stream');const time=v.getFloat32(pos,true),count=v.getInt32(pos+4,true);pos+=8;if(count<0||pos+count*20>v.byteLength)throw Error('invalid-stream');for(let i=0;i<count;i++,pos+=20){const index=v.getInt32(pos,true);if(wanted.has(index)){if(!channels.has(index))channels.set(index,[]);channels.get(index).push({time,c:[0,1,2,3].map(j=>v.getFloat32(pos+4+j*4,true))})}}}
 const dense=unpack(cd.m_DenseClip.m_SampleArray,Float32Array),constant=unpack(cd.m_ConstantClip.data,Float32Array),sc=cd.m_StreamedClip.curveCount,dc=cd.m_DenseClip.m_CurveCount;
 function value(index,t){if(index<sc){const keys=channels.get(index);if(!keys?.length)return 0;let lo=0,hi=keys.length;while(lo+1<hi){const m=(lo+hi)>>1;if(keys[m].time<=t)lo=m;else hi=m}const k=keys[lo],dt=k.time < -1e20?0:Math.max(0,t-k.time),[a,b,c,d]=k.c;return ((a*dt+b)*dt+c)*dt+d}if(index<sc+dc){const d=cd.m_DenseClip,f=Math.max(0,Math.min(d.m_FrameCount-1,(t-d.m_BeginTime)*d.m_SampleRate)),i=Math.floor(f),j=Math.min(i+1,d.m_FrameCount-1),c=index-sc;return dense[i*dc+c]*(1-f+i)+dense[j*dc+c]*(f-i)}return constant[index-sc-dc]}
 return {bindings,loop:Boolean(data.clip.m_MuscleClip.m_LoopTime),sample(b,t){const time=t+(meta.startTime||0),i=b.offset;return b.width===4?[value(i,time),value(i+1,time),value(i+2,time),value(i+3,time)]:[value(i,time),value(i+1,time),value(i+2,time)]}};
}
const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));const avg=a=>a.reduce((s,x)=>s+x,0)/(a.length||1);const clamp=x=>Math.max(0,Math.min(1,x));const round=x=>Number(x.toFixed(4));
function angle(a,b,c){const u=new Vector3(...a).sub(new Vector3(...b)),v=new Vector3(...c).sub(new Vector3(...b));return u.angleTo(v)*180/Math.PI}
export function analyze(data,rig,{preview=false,anatomy=false}={}){
 const dec=decoder(data,rig.needed),duration=Number(data.meta.duration);if(!Number.isFinite(duration)||duration<0)throw Error('invalid-duration');
 const grouped=new Map();for(const b of dec.bindings){if(!grouped.has(b.bone))grouped.set(b.bone,[]);grouped.get(b.bone).push(b)}
 const tracked=new Set(dec.bindings.filter(b=>b.attribute===2).map(b=>b.bone));const core=names.filter(n=>!n.includes('toes')&&!n.includes('shoulder'));const coverage=core.filter(n=>tracked.has(n)).length/core.length;
 if(!tracked.size)return {status:'no-body-rotation',coverage:0,tracked:0};
 const n=Math.max(2,Math.min(241,Math.ceil(duration*8)+1)),step=duration/(n-1),frames=[],rots=[],headWorldQ=[];let invalid=0;
 for(let i=0;i<n;i++){
  const time=i*step;
  for(const b of rig.ordered){b.p.fromArray(b.position);b.q.fromArray(b.rotation);b.s.fromArray(b.scale||[1,1,1]);for(const tr of grouped.get(b.name)||[]){const x=dec.sample(tr,time);if(!x.every(Number.isFinite)){invalid++;continue}if(tr.attribute===1)b.p.fromArray(x);if(tr.attribute===2){const length=Math.hypot(...x);if(length<.5||length>1.5){invalid++;continue}b.q.fromArray(x).normalize()}if(tr.attribute===3)b.s.fromArray(x)}b.m.compose(b.p,b.q,b.s);b.world.copy(b.pi<0?b.m:rig.ordered[b.pi].world.clone().multiply(b.m))}
  frames.push(names.map(name=>new Vector3().setFromMatrixPosition(rig.ordered[rig.map.get(name)].world).toArray()));rots.push(names.map(name=>rig.ordered[rig.map.get(name)].q.toArray()));headWorldQ.push(new Quaternion().setFromRotationMatrix(rig.ordered[rig.map.get('cf_j_head')].world).toArray());
 }
 if(invalid)return {status:'invalid-samples',coverage:round(coverage),invalid};
 // Height from the source rest skeleton, independent of the clip's pose.
 for(const b of rig.ordered){b.m.compose(new Vector3(...b.position),new Quaternion(...b.rotation),new Vector3(...b.scale||[1,1,1]));b.world.copy(b.pi<0?b.m:rig.ordered[b.pi].world.clone().multiply(b.m))}
 const rest=names.map(name=>new Vector3().setFromMatrixPosition(rig.ordered[rig.map.get(name)].world).toArray()),height=dist(rest[5],rest[names.indexOf('cf_j_foot_L')])+dist(rest[5],rest[0])*.08;
 // Face forward is calibrated once on the rest skeleton: rest body forward (from shoulders and spine) expressed in head-bone space.
 const restHeadQ=new Quaternion().setFromRotationMatrix(rig.ordered[rig.map.get('cf_j_head')].world),restUp=new Vector3(...rest[4]).sub(new Vector3(...rest[0])).normalize(),restLeft=new Vector3(...rest[7]).sub(new Vector3(...rest[15])).normalize(),restForward=new Vector3().crossVectors(restLeft,restUp).normalize(),headRestForward=restForward.clone().applyQuaternion(restHeadQ.clone().invert());
 if(height<.1)throw Error('invalid-rest-height');
 const ix=n=>names.indexOf(n),point=(f,name)=>f[ix(name)],groups={torso:[0,1,2,3],head:[4,5],leftArm:[6,7,8,9],rightArm:[14,15,16,17],leftLeg:[10,11,12],rightLeg:[18,19,20],legs:[10,11,12,18,19,20]};
 const activity={};for(const [group,indices] of Object.entries(groups)){const deltas=[];for(let i=1;i<n;i++)for(const j of indices){const q=new Quaternion(...rots[i][j]),p=new Quaternion(...rots[i-1][j]);deltas.push(q.angleTo(p)/(step||1)*180/Math.PI)}activity[group]=round(avg(deltas))}
 const labels=[],postureCounts={standing:0,seated:0,lying:0,crouched:0,inverted:0,quadruped:0,unknown:0},armCounts={up:0,horizontal:0,down:0,other:0},contacts={},frameFeatures=[],legAngles={L:[],R:[]};let sideFrames=0;
 for(const f of frames){const hip=f[0],head=f[5],lf=point(f,'cf_j_foot_L'),rf=point(f,'cf_j_foot_R'),axis=new Vector3(...head).sub(new Vector3(...hip)),signedUp=axis.y/axis.length(),upright=Math.abs(signedUp);const hipAboveFeet=(hip[1]-Math.min(lf[1],rf[1]))/height;const kneeAngles=['L','R'].map(s=>angle(point(f,'cf_j_thigh00_'+s),point(f,'cf_j_leg01_'+s),point(f,'cf_j_foot_'+s)));legAngles.L.push(kneeAngles[0]);legAngles.R.push(kneeAngles[1]);const knees=avg(kneeAngles);const lateral=new Vector3(...point(f,'cf_j_arm00_R')).sub(new Vector3(...point(f,'cf_j_arm00_L')));const onSide=upright<.5&&Math.abs(lateral.y)/lateral.length()>.65;if(onSide)sideFrames++;let posture=upright<.5?'lying':signedUp>.75&&hipAboveFeet>.37&&knees>145?'standing':signedUp>.65&&knees<140&&hipAboveFeet>.18?'seated':signedUp>.5&&hipAboveFeet<.37?'crouched':signedUp<-.55?'inverted':'unknown';postureCounts[posture]++;
 const hands=['L','R'].map(s=>point(f,'cf_j_hand_'+s)),shoulders=['L','R'].map(s=>point(f,'cf_j_arm00_'+s));let arm=hands.every((p,i)=>p[1]>shoulders[i][1]+height*.08)?'up':hands.every((p,i)=>p[1]<shoulders[i][1]-height*.2)?'down':hands.every((p,i)=>Math.hypot(p[0]-shoulders[i][0],p[2]-shoulders[i][2])>height*.16&&Math.abs(p[1]-shoulders[i][1])<height*.18)?'horizontal':'other';armCounts[arm]++;frameFeatures.push({posture,arm,onSide,kneeAngles});}
 for(const name of ['cf_j_foot_L','cf_j_foot_R','cf_j_hand_L','cf_j_hand_R']){let stable=0;for(let i=1;i<n;i++)if(dist(point(frames[i],name),point(frames[i-1],name))/height/(step||1)<.025)stable++;contacts[name]=round(stable/(n-1))}
 const posture=Object.entries(postureCounts).sort((a,b)=>b[1]-a[1])[0],arm=Object.entries(armCounts).sort((a,b)=>b[1]-a[1])[0];
 const rootTravel=dist(frames[0][0],frames.at(-1)[0])/height,loopError=avg(names.map((_,j)=>dist(frames[0][j].map((v,k)=>v-frames[0][0][k]),frames.at(-1)[j].map((v,k)=>v-frames.at(-1)[0][k]))/height));
 const armActivity=(activity.leftArm+activity.rightArm)/2,portability=clamp(1-activity.torso/Math.max(8,armActivity));
 const confidence=coverage>=.75?round(posture[1]/n):0;
 const legs={};for(const [side,values]of Object.entries(legAngles)){const sorted=[...values].sort((a,b)=>a-b);legs[side]={kneeMedianDeg:round(sorted[Math.floor(sorted.length/2)]),kneeMinDeg:round(sorted[0]),kneeMaxDeg:round(sorted.at(-1)),extendedFraction:round(values.filter(v=>v>155).length/n),bentFraction:round(values.filter(v=>v<135).length/n),activityDegSec:activity[side==='L'?'leftLeg':'rightLeg']}}
 const sideLyingFraction=round(sideFrames/n);if(sideLyingFraction>.6&&coverage>=.75)labels.push('side-lying');if(coverage>=.75&&((legs.L.extendedFraction>.6&&legs.R.bentFraction>.6)||(legs.R.extendedFraction>.6&&legs.L.bentFraction>.6)))labels.push('asymmetric-leg-shape');
 const windows=[];const stride=Math.max(1,Math.floor(1/(step||1)));for(let start=0;start<n-1;start+=stride){const end=Math.min(n-1,start+Math.max(1,Math.round(2/(step||1)))),part=frameFeatures.slice(start,end+1),up=part.filter(p=>p.arm==='up').length/part.length;const torso=Math.max(...rots.slice(start,end+1).map(r=>avg([0,1,2,3].map(j=>new Quaternion(...rots[start][j]).angleTo(new Quaternion(...r[j]))))*180/Math.PI));windows.push({start:round(start*step),end:round(end*step),armsUp:round(up),sideLying:round(part.filter(p=>p.onSide).length/part.length),knees:part[0].kneeAngles.map(round),torsoChangeDeg:round(torso),candidate:coverage>=.75&&torso<12&&up>.6?'arms-up-hold':null})}
 if(coverage<.75)labels.push('partial-reference-rest');if(portability>.75&&armActivity>5&&coverage>=.75)labels.push('arm-layer-candidate');if(loopError<.025)labels.push('matching-endpoints');if(Object.values(contacts).some(x=>x>.8))labels.push('stationary-endpoint');
 const classification=describeMotion({frames,names,height,duration,rest});
 const fourPoint=['hands-feet-raised-pelvis','hands-feet-shape','hands-knees-shape'].includes(classification.stance.value),resolvedPosture=fourPoint?'quadruped':posture[0],resolvedConfidence=fourPoint?classification.stance.fraction:confidence;
 return {...((preview||anatomy)?{anatomy:describeAnatomy({frames,rots,names,height,duration,headWorldQ,headRestForward})}:{}),classification,status:'ok',coverage:round(coverage),tracked:tracked.size,samples:n,sampleHz:round((n-1)/(duration||1)),duration,posture:coverage>=.75?resolvedPosture:'unknown',postureConfidence:resolvedConfidence,arms:arm[0],armsFraction:round(arm[1]/n),activity,legs,sideLyingFraction,stationary:contacts,rootTravel:round(rootTravel),loopError:round(loopError),sourceLoop:dec.loop,armPortability:round(portability),labels,windows,...(preview?{preview:{names,parents:names.map(name=>{let b=rig.ordered[rig.map.get(name)];while(b.pi>=0){b=rig.ordered[b.pi];if(names.includes(b.name))return names.indexOf(b.name)}return -1}),frames:frames.map(f=>f.map(p=>p.map(v=>round(v/height)))),duration}}:{})};
}
