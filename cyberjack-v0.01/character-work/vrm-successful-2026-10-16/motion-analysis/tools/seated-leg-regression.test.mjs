import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchTaskDonors} from './task-planner.mjs';
import {selectionBank} from './selection-bank.mjs';
import {createMixer} from '../review/mix-core.mjs';
import {createTaskFeatures} from '../review/task-features.mjs';
import {createTrajectoryQuality} from '../review/trajectory-quality.mjs';
import {supportProfile} from '../review/support-profile.mjs';
const base={id:'83d1325a6f3b7f296671db2d',start:0,end:5.3},reports=[];
for(const basePlayback of ['hold','once']){
 const result=searchTaskDonors({base,goal:'left-leg-forward',basePlayback});
 assert.equal(result.support.kind,'seat-assumed');assert(result.candidates.length>0);
 for(const c of result.candidates){
  assert.equal(c.transferMode,'layer');assert(c.quality.penetration<=.006);assert.equal(c.quality.seatDrift,0);assert.equal(c.quality.rootLift,0);assert(c.probe.mixed.leftKnee<25);assert(c.probe.base.leftKnee-c.probe.mixed.leftKnee>20);
  const m=createMixer(selectionBank(c.selection));
  for(let i=0;i<=30;i++){const r=m.evaluate(m.duration(c.config)*i/30,c.config);for(const n of ['hips','spine03','thigh00_R','leg01_R','hand_L','hand_R']){const j=m.index.get('cf_j_'+n);assert(r.base[j].worldQ.angleTo(r.mixed[j].worldQ)<1e-6,n);assert(r.base[j].p.distanceTo(r.mixed[j].p)<1e-9,n)}}
 }
 reports.push(result);
}
const m=createMixer(selectionBank({base,donor:base})),rest=m.makePose();m.fk(rest);const features=createTaskFeatures(m.rig.map((b,i)=>({...b,world:rest[i].world,worldQ:rest[i].worldQ}))),evaluate=m.evaluate,config={recipe:'custom',base:'libraryBase',basePlayback:'hold',transferMode:'layer',mask:'leftLeg',weight:0,blendIn:0,blendOut:0};
// Feet may leave the floor when the pelvis has an assumed external support.
m.evaluate=(t,c)=>{const r=evaluate(t,c);r.weight=1;for(const n of ['foot_L','toes_L','foot_R','toes_R'])r.mixed[m.index.get('cf_j_'+n)].world.elements[13]+=.2;return r};
let q=createTrajectoryQuality(m,features)(config,'legs-apart',()=>true,'any');assert(q.accepted,q.reasons.join('; '));assert.equal(q.requiredFootLift,0);
// This permission must not permit the pelvis itself to abandon its seat.
m.evaluate=(t,c)=>{const r=evaluate(t,c);r.weight=1;for(const n of r.mixed)n.world.elements[13]+=.2;return r};
q=createTrajectoryQuality(m,features)(config,'legs-apart',()=>true,'any');assert(!q.accepted);assert(q.reasons.some(r=>r.includes('сиденья')));
assert.notEqual(supportProfile({inclination:0,hipHeight:.8,leftKnee:5,rightKnee:5,leftForward:0,rightForward:0}).kind,'seat-assumed');
fs.writeFileSync(new URL('../data/seated-leg-regression.json',import.meta.url),JSON.stringify(reports,null,2));
console.log('PASS f_eat_00_00_M hold/once: extended left leg, pelvis/upper body/right leg preserved, floor thresholds unchanged; seat supports free feet but not displaced pelvis',reports.map(r=>({playback:r.candidates[0].config.basePlayback,count:r.candidates.length})));
