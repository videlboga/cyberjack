import fs from 'node:fs';import assert from 'node:assert/strict';
import {commandBootstrap,planCharacterCommand} from './command-planner.mjs';
import {samplePath} from './command-trajectories.mjs';
import {supportPreparation} from './support-preparation.mjs';
const path=samplePath('8b5a3bfb60a955be09fe037b',0,.1,3),t=path.t,state=commandBootstrap();state.pose=path.frames[0];state.features=t.features(t.unpack(state.pose));state.profile.supportMode='whole-body';state.profile.externalLocomotion=true;
const stage={description:'Встать с четверенек',constraints:[{feature:'hipHeight',min:.48,max:.65},{feature:'torsoInclination',min:0,max:20},...['left','right'].map(side=>({feature:side+'Knee',min:0,max:25}))],translation:[0,0],yaw:0,semantics:{query:'stand relaxed natural idle',requiresTrajectory:false,motionTerms:[]}};
console.log('start',state.features.torsoInclination,state.features.hipHeight);
assert.equal(supportPreparation(t,state,stage,{position:[0,0],yaw:0})?.preparation.kind,'release-hands-before-rise');
const plan=await planCharacterCommand({text:'Встать с четверенек',state},{interpret:async()=>({summary:'Встать',stages:[stage,{...stage,description:'Пройти два метра вперёд',translation:[0,2],duration:3},{...stage,description:'Повернуться направо',translation:[0,2],yaw:90,duration:2}]})});
console.log(plan.status,plan.steps.map(s=>({status:s.status,reason:s.reason,prep:s.preparation?.kind,hip:s.features?.hipHeight,torso:s.features?.torsoInclination,hand:s.features?.leftHandHeight,knee:s.features?.leftKneeHeight})));
fs.mkdirSync('artifacts/rise-preparation',{recursive:true});fs.writeFileSync('artifacts/rise-preparation/quadruped-rise.json',JSON.stringify({initial:state,plan}));
assert.equal(plan.status,'ready');assert.equal(plan.steps.length,5);assert.equal(plan.steps[0].preparation.kind,'release-hands-before-rise');const first=plan.steps[0].features;assert(first.torsoInclination<35);for(const side of ['left','right']){assert(first[side+'KneeHeight']<.09);assert(first[side+'HandHeight']>.18);assert(plan.steps[2].features[side+'Knee']<30);}

assert.deepEqual(plan.steps[2].rootTarget,[0,0]);assert.deepEqual(plan.steps[3].rootTarget,[0,2]);assert.deepEqual(plan.steps[4].rootTarget,[0,2]);assert.equal(plan.steps[4].headingTarget,90);
