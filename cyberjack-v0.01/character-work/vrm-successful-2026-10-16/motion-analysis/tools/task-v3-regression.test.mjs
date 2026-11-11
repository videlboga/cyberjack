import assert from 'node:assert/strict';
import fs from 'node:fs';
import {Quaternion,Vector3,Matrix4} from 'three';
import {selectionBank} from './selection-bank.mjs';
import {createMixer} from '../review/mix-core.mjs';
import {armRaised} from '../review/task-constraints.mjs';
import {searchTaskDonors} from './task-planner.mjs';
// Already above the head is not a maximum: a bent elbow can still extend upward.
const names=['arm00_L','forearm01_L','hand_L','arm00_R','forearm01_R','hand_R'],index=new Map(names.map((n,i)=>['cf_j_'+n,i])),pose=()=>[[0,1,0],[.1,1.1,0],[0,1.25,0],[0,1,0],[.1,.8,0],[0,.6,0]].map(p=>({world:new Matrix4().makeTranslation(...p)}));
const basePose=pose(),target=pose();target[1].world.makeTranslation(.1,1.3,0);target[2].world.makeTranslation(0,1.6,0);
assert(armRaised({base:basePose,mixed:target},{index},['L'],1.6));
assert(!armRaised({base:basePose,mixed:target},{index},['R'],1.6));
const translated=pose();for(const p of translated)p.world.elements[13]+=.2;
assert(!armRaised({base:basePose,mixed:translated},{index},['L'],1.6));
// A donor facing the opposite direction must blend without a half-turn.
const source={id:'f54d5a9f3fd69c7db2f35ab6',start:0,end:1.3},bank=selectionBank({base:source,donor:source}),root=bank.rig[0],yaw=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI);
let tr=bank.clips.custom.tracks.find(t=>t.bone===root.name&&t.attribute===2);
if(!tr){tr={bone:root.name,attribute:2,width:4,constant:true,values:[...root.rotation]};bank.clips.custom.tracks.push(tr)}
for(let i=0;i<tr.values.length;i+=4)new Quaternion().fromArray(tr.values,i).premultiply(yaw).toArray(tr.values,i);
const mixer=createMixer(bank),config={recipe:'custom',base:'libraryBase',basePlayback:'hold',mask:'legSpread',weight:1,torso:0,blendIn:.25,blendOut:.25,donorPlayback:'hold',donorTime:0};
for(const mode of ['body','whole'])for(const time of [0,.1,.25,.6,1.2,1.3]){const r=mixer.evaluate(time,{...config,transferMode:mode}),i=mixer.index.get('cf_j_hips');assert(r.base[i].worldQ.angleTo(r.mixed[i].worldQ)<1e-6,mode+' heading at '+time)}
const report=[];
for(const [id,goal]of [[source.id,'raise-left'],[source.id,'raise-right'],[source.id,'legs-together'],[source.id,'legs-apart'],['0302b21a03fce4377dc986d0','raise-left']]){
 const r=searchTaskDonors({base:{id,start:0,end:1.3},goal,basePlayback:'hold'});
 assert.notEqual(r.status,'already-at-target',goal);
 for(const c of r.candidates){assert.notEqual(c.transferMode,'whole');assert(!c.quality.transitionMissing);assert(c.config.blendIn>0&&c.config.blendOut>0);assert(c.quality.headingDrift<=25);if(goal.startsWith('raise-')){assert.equal(c.transferMode,'layer');const m=createMixer(selectionBank(c.selection)),p=m.evaluate(c.probe.time,c.config);assert(armRaised(p,m,[goal==='raise-left'?'L':'R'],c.quality.height));const other=m.index.get('cf_j_arm00_'+(goal==='raise-left'?'R':'L'));assert(p.base[other].worldQ.angleTo(p.mixed[other].worldQ)<1e-6)}}
 report.push({id,goal,status:r.status,count:r.candidates.length,candidates:r.candidates.map(c=>({id:c.id,name:c.name,mode:c.transferMode})),rejections:r.rejections});
}
fs.writeFileSync(new URL('../data/task-v3-regression.json',import.meta.url),JSON.stringify(report,null,2));
console.log('PASS relative arm change and correct side, no translation shortcut, opposite-heading donor alignment through fades, Stand_Sad_05 and L_WLoop constrained searches',report.map(r=>({goal:r.goal,count:r.count})));
