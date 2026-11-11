import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createMixer} from '../review/mix-core.mjs';
import {tPoseArms,persistentTPoseArms,sourcePoseValidity,transferredArms} from '../review/pose-validity.mjs';
const bank=JSON.parse(fs.readFileSync(new URL('../data/mix-bank.json',import.meta.url))),m=createMixer(bank),rest=m.makePose();m.fk(rest);
assert.deepEqual(tPoseArms(m.rig,rest),['L','R']);
// Root rotation/translation must not alter the anatomical T-pose label.
rest[0].q.setFromAxisAngle({x:0,y:0,z:1},1.2);rest[0].p.set(20,3,-10);m.fk(rest);assert.deepEqual(tPoseArms(m.rig,rest),['L','R']);
rest[m.index.get('cf_j_forearm01_L')].q.setFromAxisAngle({x:0,y:1,z:0},1);m.fk(rest);assert.deepEqual(tPoseArms(m.rig,rest),['R']);
assert.deepEqual(transferredArms({mask:'leftLeg',transferMode:'layer'}),[]);assert.deepEqual(transferredArms({mask:'leftLeg',transferMode:'whole'}),['L','R']);assert.deepEqual(transferredArms({mask:'left',transferMode:'layer'}),['L']);
// An otherwise moving lower-body clip with untouched rest arms is a partial T-pose.
const partial=structuredClone(bank);partial.clips.custom={duration:1,times:[0,1],tracks:[{bone:'cf_j_thigh00_L',attribute:2,width:4,constant:false,values:[0,0,0,1,.3,0,0,Math.sqrt(.91)]}]};assert.deepEqual(persistentTPoseArms(createMixer(partial)),['L','R']);
const full=structuredClone(partial);full.clips.custom.tracks=[];assert.equal(sourcePoseValidity(createMixer(full)).fullBody,true);assert.equal(sourcePoseValidity(createMixer(partial)).fullBody,false);
const passing=structuredClone(full);passing.clips.custom.tracks=[{bone:'cf_j_forearm01_L',attribute:2,width:4,constant:false,values:[0,0,0,1,0,Math.sin(.6),0,Math.cos(.6)]}];assert.deepEqual(persistentTPoseArms(createMixer(passing)),['R']);
// Offset every clip's root track, including clips with no root position channel.
const shifted=structuredClone(bank),root=shifted.rig.find(b=>!shifted.rig.some(p=>p.name===b.parent));
for(const c of Object.values(shifted.clips)){let tr=c.tracks.find(t=>t.bone===root.name&&t.attribute===1);if(!tr){tr={bone:root.name,attribute:1,width:3,constant:true,values:[...root.position]};c.tracks.push(tr)}for(let i=0;i<tr.values.length;i+=3){tr.values[i]+=12;tr.values[i+2]-=8}}
const moved=createMixer(shifted),a=m.makePose(),b=moved.makePose();
for(const key of Object.keys(bank.clips))for(const fraction of [0,.2,.7,1]){const time=bank.clips[key].duration*fraction;m.sample(key,time,a);moved.sample(key,time,b);m.fk(a);moved.fk(b);for(let i=0;i<a.length;i++)for(const j of [12,13,14])assert(Math.abs(a[i].world.elements[j]-b[i].world.elements[j])<1e-6,`${key} ${fraction} offset changed pose`);if(fraction===0){const hip=a[m.index.get('cf_j_hips')].world.elements;assert(Math.abs(hip[12])<1e-6);assert(Math.abs(hip[14])<1e-6)}}
console.log('PASS partial T-pose, bent-arm exception, tilt invariance, transferred masks, root placement invariance, height and trajectory preservation');
