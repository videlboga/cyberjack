import assert from 'node:assert/strict';
import fs from 'node:fs';
import {commandBootstrap,planCharacterCommand}from'./command-planner.mjs';
import {poseTools}from'../review/command-pose.mjs';
const state=commandBootstrap();state.profile.supportMode='whole-body';
const r=await planCharacterCommand({text:'Обопрись левой рукой на стену',state},{interpret:async()=>({summary:'Стена',stages:[{description:'Обопрись левой рукой на стену',constraints:[{feature:'torsoInclination',max:40}],support:{objectId:'wall',contacts:['leftHand']},translation:[0,0],yaw:0,duration:1.6,semantics:{query:'lean on wall left hand'}}]})});
assert.equal(r.status,'ready');const s=r.steps.at(-1);assert.equal(s.supportSelection.kind,'vertical-plane');assert(/Leaning On A Wall/.test(s.source.name));assert(s.supportSelection.clearance>0);assert(s.objectContacts.every(c=>c.error<.04));
const t=poseTools(JSON.parse(fs.readFileSync('data/mix-bank.json')));let maximumRepair=0;
for(const frame of s.motion.frames.slice(1,-1)){const p=t.unpack(frame),before=p.map(n=>n.q.clone());t.limitJoints(p);for(let j=0;j<p.length;j++)maximumRepair=Math.max(maximumRepair,before[j].angleTo(p[j].q));}
assert(maximumRepair<1e-4,'all emitted intermediate frames must remain inside the calibrated anatomical limits, including after smoothing');
for(const side of ['L','R']){const lengths=s.motion.frames.map(f=>{const p=t.unpack(f);return t.point(p,'leg01_'+side).distanceTo(t.point(p,'foot_'+side));});assert(Math.max(...lengths)/Math.min(...lengths)<1.015,'transition must not stretch shin segments');}
console.log('PASS real wall library pose, measured plane clearance, contact and anatomical limits after final smoothing, stable shin lengths');
