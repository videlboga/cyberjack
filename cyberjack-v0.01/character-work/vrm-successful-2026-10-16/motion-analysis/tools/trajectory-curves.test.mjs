import fs from'node:fs';import assert from'node:assert/strict';import{curveProceduralTrajectory}from'./trajectory-curves.mjs';
const bank=JSON.parse(fs.readFileSync('data/mix-bank.json'));
for(const name of ['seated-leg-extension-regression','kneel-speed-regression']){
 const p=JSON.parse(fs.readFileSync('artifacts/'+name+'/after.json'));for(const s of p.steps){const start=performance.now(),r=curveProceduralTrajectory(bank,s);if(!r.trajectoryCurve)continue;assert.equal(r.duration,s.duration);assert.deepEqual(r.pose,s.pose);for(let i=0;i<s.motion.frames.length;i++)assert.deepEqual(r.motion.frames[i*2],s.motion.frames[i]);if(s.motion.supportTrack)assert.equal(r.motion.frames.length,r.motion.supportTrack.length);assert(r.trajectoryCurve.accepted>0);console.log(name,s.description,r.trajectoryCurve,Math.round(performance.now()-start)+'ms');}
}
console.log('PASS exact original poses, timing, endpoints and aligned support tracks; intermediate samples checked with linear fallback');
