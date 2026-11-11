import fs from 'node:fs';import assert from 'node:assert/strict';
import {buildTerminalMotion}from './terminal-motion.mjs';import{poseTools,pack}from '../review/command-pose.mjs';
const bank=JSON.parse(fs.readFileSync('data/mix-bank.json')),t=poseTools(bank),p=t.m.makePose();t.m.sample('standing',0,p);t.orient(p);const step={pose:pack(p),constraints:[]};
const idle=await buildTerminalMotion(bank,step);assert.equal(idle.kind,'idle');assert.equal(idle.frames.length,49);assert.deepEqual(idle.frames[0],idle.frames.at(-1));
const hip=t.m.index.get('cf_j_hips'),leg=t.m.index.get('cf_j_thigh00_L');for(const f of idle.frames){for(const i of [hip,leg])for(const key of ['p','q','s'])f[i][key].forEach((v,j)=>assert(Math.abs(v-step.pose[i][key][j])<1e-10));}
assert(idle.frames.some(f=>JSON.stringify(f)!==JSON.stringify(idle.frames[0])));
const missing=await buildTerminalMotion(bank,{...step,semantics:{continuation:'unknown movement'}},{semanticSearch:async()=>({matches:[]}),text:'Поесть',catalog:new Map(),rows:[]});assert.equal(missing.unavailableAction,'unknown movement');assert.equal(missing.kind,'idle');
console.log('PASS continuous cyclic idle, fixed root and legs, non-static motion, explicit missing-action fallback');
const {validateIntent}=await import('./command-language.mjs');const intent=validateIntent({summary:'Есть',stages:[{description:'Поесть',constraints:[],semantics:{continuation:'eat'},translation:[0,0],yaw:0}]});assert.equal(intent.stages[0].semantics.continuation,'eat');assert.throws(()=>validateIntent({summary:'Пусто',stages:[{description:'Ничего',constraints:[]}]}));
