import assert from 'node:assert/strict';
import fs from 'node:fs';
import {poseTools} from '../review/command-pose.mjs';
import {routeSeatedFeet} from './leg-clearance-route.mjs';
const t=poseTools(JSON.parse(fs.readFileSync('data/mix-bank.json')));
const frames=JSON.parse(fs.readFileSync('artifacts/seated-leg-extension-regression/before.json')).steps[1].motion.frames;
const r=routeSeatedFeet(t,frames);
assert(r.before>.025);assert(r.after<.012);assert.equal(r.mask,'R');
assert.deepEqual(r.frames[0],frames[0]);assert.deepEqual(r.frames.at(-1),frames.at(-1));
const free=new Set(['thigh00_R','leg01_R','foot_R'].map(n=>t.m.index.get('cf_j_'+n)));
for(let i=1;i<frames.length-1;i++){
 const original=t.unpack(frames[i]),p=t.unpack(r.frames[i]);
 for(let j=0;j<p.length;j++){
  assert.deepEqual(r.frames[i][j].p,frames[i][j].p);assert.deepEqual(r.frames[i][j].s,frames[i][j].s);
  if(!free.has(j))assert.deepEqual(r.frames[i][j],frames[i][j]);
 }
 const q=p.map(j=>j.q.clone());t.limitJoints(p);
 for(const j of free)assert(q[j].angleTo(p[j].q)<1e-6,'joint limits');
 for(const n of ['leg01_L','leg01_R','foot_L','foot_R','toes_L','toes_R'])assert(t.point(p,n).y>=Math.min(-.012*t.height,t.point(original,n).y-.002)-1e-8,'floor '+n);
}
console.log('PASS seated extension: collision cleared, exact endpoints and untouched bones preserved, no joint-limit or floor regression',r.before,r.after);
