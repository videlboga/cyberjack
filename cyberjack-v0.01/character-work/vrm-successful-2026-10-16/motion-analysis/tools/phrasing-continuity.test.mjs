import assert from 'node:assert/strict';
import fs from 'node:fs';
import {poseTools,pack} from '../review/command-pose.mjs';
import {phraseTransition} from './motion-phrasing.mjs';
const t=poseTools(JSON.parse(fs.readFileSync('data/mix-bank.json')));
const flow=JSON.parse(fs.readFileSync('artifacts/natural-flow/sit-before.json'));
const from=t.unpack(flow.steps[0].pose),to=t.unpack(flow.steps[1].pose);
const frames=phraseTransition(t,from,to),poses=frames.map(f=>t.unpack(f));
assert.deepEqual(frames[0],pack(from));assert.deepEqual(frames.at(-1),pack(to));
let maxStep=0,maxAcceleration=0;
for(const side of ['L','R'])for(const name of ['thigh00','leg01']){
 const j=t.m.index.get('cf_j_'+name+'_'+side);
 for(let k=2;k<poses.length-2;k++){
  const prev=poses[k-1][j].q,next=poses[k][j].q;
  maxStep=Math.max(maxStep,prev.angleTo(next));
  const d0=poses[k-2][j].q.clone().invert().multiply(prev),d1=prev.clone().invert().multiply(next);
  maxAcceleration=Math.max(maxAcceleration,d0.angleTo(d1));
 }
}
assert(maxStep<.45,'no frame may switch to a distant IK branch');
assert(maxAcceleration<.45,'knee direction must remain temporally coherent');
console.log('PASS seated IK temporal continuity', {maxStepDegrees:maxStep*180/Math.PI,maxAccelerationDegrees:maxAcceleration*180/Math.PI});
