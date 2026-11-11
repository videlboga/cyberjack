import fs from 'node:fs';import assert from 'node:assert/strict';import {createMixer} from '../review/mix-core.mjs';import {createMixDiagnostics} from '../review/mix-diagnostics.mjs';
const bank=JSON.parse(fs.readFileSync(import.meta.dirname+'/../data/mix-bank.json')),m=createMixer(bank),diagnose=createMixDiagnostics(m),common={recipe:'raise',base:'sitting',basePlayback:'hold',weight:1,torso:0,shoulder:true,fingers:'donor',blendIn:0,blendOut:0,holdLoops:1,entryMode:'original'};
for(const mask of ['left','right','both','torso','legSpread','legs','leftKnee','rightKnee','leftLeg','rightLeg']){const r=m.evaluate(.8,{...common,mask});const d=diagnose(r,{mask});assert(d.protectedDrift<1e-10);for(const n of ['p_cf_body_bone','cf_j_hips']){const i=m.index.get(n);assert(r.base[i].q.angleTo(r.mixed[i].q)<1e-7);assert(r.base[i].p.distanceTo(r.mixed[i].p)<1e-10)}
 if(mask==='legSpread')for(const n of ['cf_j_leg01_L','cf_j_leg01_R','cf_j_foot_L','cf_j_foot_R']){const i=m.index.get(n);assert(r.base[i].q.angleTo(r.mixed[i].q)<1e-7)}
 if(mask==='leftKnee'||mask==='rightKnee'){const s=mask==='leftKnee'?'L':'R',i=m.index.get('cf_j_thigh00_'+s);assert(r.base[i].q.angleTo(r.mixed[i].q)<1e-7)}
 if(['left','right','both','torso'].includes(mask))assert.equal(r.legDelta,0);
}
console.log('PASS 10 masks: root/pelvis invariants, non-selected protected nodes, preserved knee/ankle locals for leg spread, preserved thigh for knee bend');
