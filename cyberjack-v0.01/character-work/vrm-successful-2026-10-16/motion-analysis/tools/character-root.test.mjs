import assert from 'node:assert/strict';import {pivotOffset} from '../review/character-root.mjs';
const rotate=(p,y)=>{const a=y*Math.PI/180;return [Math.cos(a)*p[0]+Math.sin(a)*p[1],-Math.sin(a)*p[0]+Math.cos(a)*p[1]]};
for(const from of [0,37,90,180])for(const to of [-180,0,90,270]){const h=[.63,-.27],offset=[.4,-.8],next=pivotOffset(offset,h,from,to),before=rotate(h,from).map((v,i)=>v+offset[i]),after=rotate(h,to).map((v,i)=>v+next[i]);assert(after.every((v,i)=>Math.abs(v-before[i])<1e-10));}
const first=pivotOffset([0,0],[.5,.25],0,90),second=pivotOffset(first,[.5,.25],90,180),direct=pivotOffset([0,0],[.5,.25],0,180);assert(second.every((v,i)=>Math.abs(v-direct[i])<1e-10));
console.log('PASS off-origin pelvis pivot fixed through arbitrary and successive turns');

import fs from 'node:fs';import {poseTools,pack} from '../review/command-pose.mjs';import {coordinatePoseChange} from './command-coordination.mjs';import {Quaternion,Vector3} from 'three';
const bank=JSON.parse(fs.readFileSync(new URL('../data/mix-bank.json',import.meta.url))),t=poseTools(bank),a=t.m.makePose();t.m.sample('standing',0,a);t.orient(a);const b=t.unpack(pack(a));b[t.m.index.get('cf_j_leg01_L')].q.multiply(new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.8));b[t.m.index.get('cf_j_forearm01_L')].q.multiply(new Quaternion().setFromAxisAngle(new Vector3(0,0,1),.8));t.m.fk(b);const hand=t.m.index.get('cf_j_hand_L'),parent=t.m.rig[hand].parentIndex;b[hand].p.add(new Vector3(0,-3,0).applyQuaternion(b[parent].worldQ.clone().invert()));t.m.fk(b);
const motion=coordinatePoseChange(bank,{pose:pack(a)},{pose:pack(b),duration:3}).motion;
assert(motion.frames.every(f=>Math.abs(f[0].p[1]-a[0].p.y)<1e-10),'free hand must never lift root');assert(t.ground(t.unpack(motion.frames.at(-1)))<0,'fixture hand must cross the floor');console.log('PASS free hand penetration does not move the root during coordinated transition');
