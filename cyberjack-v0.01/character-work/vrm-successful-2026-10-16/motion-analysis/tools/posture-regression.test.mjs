import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';import {buildRig,analyze,names} from './geometry.mjs';import {describeMotion,flexionGrade} from './classification.mjs';
const root=import.meta.dirname+'/../..',rig=buildRig(JSON.parse(fs.readFileSync(root+'/animations/source_rigs.json')).rigs.find(r=>r.name==='p_cf_body_bone').bones);
const load=id=>analyze(JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/animations/clips/'+id+'.json.gz'))),rig,{preview:true});
const r=load('8b5a3bfb60a955be09fe037b');assert.equal(r.posture,'quadruped');assert.equal(r.classification.body.value,'inverted');assert.equal(r.classification.stance.value,'hands-feet-raised-pelvis');
for(const s of ['L','R']){const leg=r.classification.legs[s];assert.equal(leg.flexion.grade.value,'moderate');assert(leg.flexion.mean>64&&leg.flexion.mean<67);assert.equal(r.classification.arms[s].worldHeight.value,'below-head');assert.equal(r.classification.arms[s].position.value,'overhead');assert.equal(r.classification.arms[s].positionFrame,'torso')}
const seated=load('e0259d6f372c87b464608b2c'),standing=load('d82833280717194afd3bde21');assert.equal(seated.posture,'seated');assert.equal(standing.posture,'standing');
// Upright sitting remains sitting; inversion of an upright body must not become sitting.
const flipped=standing.preview.frames.map(f=>f.map(([x,y,z])=>[x,-y,z]));const c=describeMotion({frames:flipped,names,height:1,duration:standing.duration,rest:standing.preview.frames[0]});assert.equal(c.body.value,'inverted');assert(!c.stance.value.startsWith('hands-'));assert.notEqual(c.stance.value,'seated-shape');
// Translating the entire clip must not change the inferred support-plane shape.
const moved=r.preview.frames.map(f=>f.map(([x,y,z])=>[x+3,y-7,z+2]));const m=describeMotion({frames:moved,names,height:1,duration:r.duration,rest:r.preview.frames[0]});assert.equal(m.stance.value,r.classification.stance.value);
// Hands touching knees during a standing bend are not a knee-supported quadruped.
const onKnees=r.preview.frames.map(f=>{const out=structuredClone(f);for(const side of ['L','R'])out[names.indexOf('cf_j_hand_'+side)]=[...out[names.indexOf('cf_j_leg01_'+side)]];return out});const bentStanding=describeMotion({frames:onKnees,names,height:1,duration:r.duration,rest:r.preview.frames[0]});assert.notEqual(bentStanding.stance.value,'hands-knees-shape');
assert.deepEqual([0,14,15,44,45,89,90,119,120,150].map(flexionGrade),['near-straight','near-straight','slight','slight','moderate','moderate','deep','deep','folded','folded']);
console.log('PASS raised-pelvis quadruped, world/body hand frames, numeric flexion, standing/sitting/inversion, translation, bin boundaries');
