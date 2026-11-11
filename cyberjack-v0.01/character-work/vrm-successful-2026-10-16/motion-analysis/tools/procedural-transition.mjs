import {motionTiming} from './motion-phrasing.mjs';
import {Vector3} from 'three';
import {poseTools,pack} from '../review/command-pose.mjs';
import {solveLeg} from './foot-contacts.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
// Coarse human segment masses, independent of hair, clothing and mesh bounds.
export function centerOfMass(t,p){
 const segments=[['hips','spine01',.16],['spine01','spine03',.25],['spine03','head',.13]];
 for(const side of ['L','R'])segments.push(['shoulder_'+side,'arm00_'+side,.025],['arm00_'+side,'hand_'+side,.035],['thigh00_'+side,'leg01_'+side,.1],['leg01_'+side,'foot_'+side,.06]);
 const sum=new Vector3();let mass=0;for(const [a,b,w]of segments){if(!t.m.index.has('cf_j_'+a)||!t.m.index.has('cf_j_'+b))continue;sum.addScaledVector(t.point(p,a).add(t.point(p,b)).multiplyScalar(.5),w);mass+=w;}return sum.divideScalar(mass||1);
}
export function supportEstimate(t,p,anchors){const com=centerOfMass(t,p),a=anchors.L,b=anchors.R,axis=b.clone().sub(a).setY(0),width=axis.length();if(width<.01)axis.set(1,0,0);else axis.normalize();const forward=new Vector3(-axis.z,0,axis.x),center=a.clone().add(b).multiplyScalar(.5),delta=com.clone().sub(center),lateral=delta.dot(axis),depth=delta.dot(forward),outside=new Vector3().addScaledVector(axis,lateral-clamp(lateral,-width/2-.045,width/2+.045)).addScaledVector(forward,depth-clamp(depth,-.09,.09));return {com:com.toArray(),outsideMeters:outside.length(),correction:outside.multiplyScalar(-1),leftLoad:clamp(.5-lateral/Math.max(.01,width),0,1)};}
export function proceduralTransition(bank,state,step){if(step.motion&&!step.motion.coordinated)return step;const t=poseTools(bank),from=t.unpack(state.pose),to=t.unpack(step.pose),a=t.features(from),b=t.features(to),angle=Math.abs(a.torsoInclination-b.torsoInclination),large=angle>45||Math.abs(a.hipHeight-b.hipHeight)>.2;
 // A blend has no recorded timing. Keep large orientation changes brief, not slow-motion flips.
 const timing=motionTiming(t,from,to),duration=timing.duration,base={...step,duration,transitionKind:'procedural',transition:large?'Короткая процедурная смена позы; опоры перехода не подтверждены':'Процедурное согласование поз'};
 if(step.motion?.coordinated){const timed=step.motion.phrasing?.duration||timing.duration;return {...base,duration:timed,motion:{...step.motion,duration:timed,noMargins:true},transition:'Подготовка рук и согласованное движение корпуса; опоры проверяются отдельно'};}
 if(step.method?.startsWith('Текущая')&&Math.abs((step.headingTarget??state.yaw)-(state.yaw||0))<.01&&Math.hypot(...(step.rootTarget||state.position).map((x,i)=>x-state.position[i]))<.001)return {...base,duration:.001,transition:'Цель уже достигнута; без выдержки'};
 if(Math.abs((step.headingTarget??state.yaw)-(state.yaw||0))>.01||Math.hypot(...(step.rootTarget||state.position).map((x,i)=>x-state.position[i]))>.001)return base;
 const anchors={L:t.point(from,'foot_L'),R:t.point(from,'foot_R')},standing=[a,b].every(f=>f.hipHeight>.45&&f.torsoInclination<35)&&['L','R'].every(s=>Math.abs(t.point(to,'foot_'+s).y-anchors[s].y)<.025&&t.point(to,'foot_'+s).distanceTo(anchors[s])<.09);
 if(!standing)return base;
 const frames=[],contacts=[],metrics={maxOutsideMeters:0,maxCorrectionMeters:0,maxIkErrorMeters:0};const count=Math.ceil(duration*30);
 for(let i=0;i<=count;i++){const x=i/count,u=x*x*x*(x*(x*6-15)+10),p=t.interpolateTransition(from,to,u),before=pack(p),support=supportEstimate(t,p,anchors),fade=Math.sin(Math.PI*x)**2,correction=support.correction.clampLength(0,.03).multiplyScalar(fade);p[0].p.add(correction);t.m.fk(p);let error=0;for(const s of ['L','R'])error=Math.max(error,solveLeg(t,p,s,anchors[s]));if(error>.035)return {...base,supportFallback:'Опоры недостижимы без изменения конечной позы'};
 const solved=t.unpack(pack(p)),raw=t.unpack(before),weight=Math.min(1,i/3,(count-i)/3);for(const side of ['L','R'])for(const name of ['thigh00','leg01','foot']){const j=t.m.index.get('cf_j_'+name+'_'+side);p[j].q.copy(raw[j].q).slerp(solved[j].q,weight);}t.m.fk(p);
 metrics.maxOutsideMeters=Math.max(metrics.maxOutsideMeters,support.outsideMeters);metrics.maxCorrectionMeters=Math.max(metrics.maxCorrectionMeters,correction.length());metrics.maxIkErrorMeters=Math.max(metrics.maxIkErrorMeters,error);frames.push(i===0?pack(from):i===count?pack(to):pack(p));contacts.push(Object.fromEntries(['L','R'].map(s=>[s,{weight:Math.min(1,i/3,(count-i)/3),anchor:anchors[s].toArray(),load:s==='L'?support.leftLoad:1-support.leftLoad}])));}
 return {...base,motion:{frames,duration,loop:false,noMargins:true,contacts,rootProgress:frames.map(()=>0),source:{name:'Процедурный переход · опоры стоп и оценка равновесия'},supportMetrics:metrics,contactPolicy:'fixed feet + segment-mass COM estimate; bounded 3cm root correction; no force simulation'},transition:'Процедурное согласование · удержание стоп · ограниченная коррекция равновесия'};
}
