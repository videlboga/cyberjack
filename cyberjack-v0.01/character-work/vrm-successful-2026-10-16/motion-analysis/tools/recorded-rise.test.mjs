import {Quaternion,Vector3} from 'three';
import fs from 'node:fs';import assert from 'node:assert/strict';
import {commandBootstrap,planCharacterCommand} from './command-planner.mjs';
import {samplePath} from './command-trajectories.mjs';
const state=commandBootstrap();state.pose=JSON.parse(fs.readFileSync('artifacts/natural-flow/sit-after.json')).steps.at(-1).pose;state.profile.recordedRisePilot=true;
const stage={description:'Встать с пола',constraints:[{feature:'hipHeight',min:.50,max:.80},{feature:'torsoInclination',max:20},...['left','right'].map(s=>({feature:s+'Knee',max:30}))],translation:[0,0],yaw:0,semantics:{query:'stand up naturally'}};
const plan=await planCharacterCommand({text:'Встать',state},{interpret:async()=>({summary:'Записанный подъём',stages:[stage]})});
assert.equal(plan.status,'ready');assert.equal(plan.steps.length,2);const recorded=plan.steps[1];assert(recorded.recordedRise);const clip=JSON.parse(fs.readFileSync('../animations/catalog.json')).clips.find(c=>c.id===recorded.source.id),native=samplePath(clip.id,0,clip.duration,121);
for(let i=0;i<recorded.motion.frames.length;i++)for(let j=0;j<state.rig.length;j++){const p=recorded.motion.frames[i][j],q=native.frames[i+recorded.recordedRise.entryFrame][j];if(!j){const expected=new Quaternion(...q.q).premultiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0),recorded.recordedRise.alignmentYaw));assert(new Quaternion(...p.q).angleTo(expected)<1e-6,'root changes only by the common alignment');}if(j)assert(Math.max(...p.q.map((v,k)=>Math.abs(v-q.q[k])))<1e-12,'recorded joint rotations must be untouched');assert.deepEqual(p.s,q.s);if(j)assert.deepEqual(p.p,q.p);}
fs.writeFileSync('artifacts/rise-preparation/recorded-rise.json',JSON.stringify({initial:state,plan}));console.log('PASS native rise rotations, scale, local positions and frame timing preserved',plan.steps.map(s=>({duration:s.duration,method:s.method})));

const t=native.t;assert(Math.abs(t.heading(t.unpack(plan.steps[0].pose))-t.heading(t.unpack(state.pose)))<1e-6,'entry must preserve facing');assert(Math.abs(t.heading(t.unpack(recorded.pose))-t.heading(t.unpack(state.pose)))<.15,'native rise should not introduce an alignment half-turn');
