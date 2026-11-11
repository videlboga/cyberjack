import fs from 'node:fs';import assert from 'node:assert/strict';
import {commandBootstrap,planCharacterCommand} from './command-planner.mjs';
import {poseTools} from '../review/command-pose.mjs';
import {supportPreparation} from './support-preparation.mjs';
const t=poseTools(JSON.parse(fs.readFileSync('data/mix-bank.json'))),state=commandBootstrap();
state.pose=JSON.parse(fs.readFileSync('artifacts/natural-flow/sit-after.json')).steps.at(-1).pose;state.features=t.features(t.unpack(state.pose));state.profile.supportMode='whole-body';
const stage={description:'Встать',constraints:[{feature:'hipHeight',min:.48,max:.65},{feature:'torsoInclination',min:0,max:20},...['left','right'].map(side=>({feature:side+'Knee',min:0,max:25}))],translation:[0,0],yaw:0,semantics:{query:'stand relaxed natural idle',requiresTrajectory:false,motionTerms:[]}};
assert.equal(supportPreparation(t,state,stage,{position:[0,0],yaw:0}).preparation.kind,'gather-support-before-rise');
assert.equal(supportPreparation(t,state,{...stage,preparationChecked:true},{position:[0,0],yaw:0}),null);
const result=await planCharacterCommand({text:'Встать',state},{interpret:async()=>({summary:'Встать',stages:[stage]})});
console.log(result.status,result.steps.map(s=>({status:s.status,reason:s.reason,preparation:s.preparation,hip:s.features?.hipHeight,knee:s.features?.leftKnee,footForward:s.features?.leftFootForward,source:s.source?.name})));
fs.mkdirSync('artifacts/rise-preparation',{recursive:true});fs.writeFileSync('artifacts/rise-preparation/seated-rise.json',JSON.stringify({initial:state,plan:result}));
assert.equal(result.status,'ready');assert.equal(result.steps.length,2);assert(result.steps[0].features.leftFootHeight<.09);assert(result.steps[0].features.rightFootHeight<.09);assert(result.steps.at(-1).features.hipHeight>.45);

for(const side of ['left','right']){assert(Math.abs(result.steps[0].features[side+'FootForward'])<.20,'feet must gather beneath the body, not just bend knees out in front');assert(result.steps.at(-1).features[side+'Knee']<30,'the final pose must actually stand');}
assert.equal(supportPreparation(t,commandBootstrap(),stage,{position:[0,0],yaw:0}),null,'already standing needs no squat');
const translated={...state,position:[2,-1],yaw:90};const prep=supportPreparation(t,translated,stage,{position:[0,0],yaw:0});assert.deepEqual(prep.translation,[2,-1]);assert.equal(prep.yaw,90);
