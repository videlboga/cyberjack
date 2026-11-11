import fs from'node:fs';import assert from'node:assert/strict';
const r=JSON.parse(fs.readFileSync('artifacts/hands-head-regression/avatar-validation.json'));
assert.equal(r.length,2);for(const c of r){assert(!c.rejected);assert(c.handPenetration<=.001);assert(c.wristNeutralAngle<=65*Math.PI/180+1e-6);assert(c.skinGap<.015);assert(c.upperArm.elbowOut>=.02);assert(Math.abs(c.upperArm.twist)<=Math.PI/2);}
assert(r[0].surface.position.some((v,i)=>Math.abs(v-r[1].surface.position[i])>.025));console.log('PASS distinct head contact surfaces, bounded neutral-relative wrists, skin clearance');
