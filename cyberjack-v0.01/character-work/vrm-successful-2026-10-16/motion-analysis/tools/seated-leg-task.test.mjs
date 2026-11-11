import assert from 'node:assert/strict';
import fs from 'node:fs';
import {searchTaskDonors} from './task-planner.mjs';
const results=[];
for(const side of ['left','right']){
 const r=searchTaskDonors({base:{id:'28a3169401858c6bd0c90276',start:0,end:1.3},goal:side+'-leg-forward',basePlayback:'hold',tempo:'calm',allowWhole:false});
 const c=r.candidates.find(c=>c.transferMode==='layer'&&c.mask===side+'Knee');assert.ok(c,side+': no seated extension');
 const other=side==='left'?'right':'left',{base,mixed}=c.probe;
 assert.ok(base[side+'Knee']-mixed[side+'Knee']>50);
 assert.ok(mixed[side+'Knee']<25);
 for(const key of [other+'Knee',other+'Forward',side+'Forward','pitch','inclination'])assert.ok(Math.abs(base[key]-mixed[key])<1e-5,key+' changed');
 assert.equal(c.quality.accepted,true);assert.equal(c.quality.seatDrift,0);assert.equal(c.quality.rootLift,0);assert.equal(c.quality.contextDrift,0);assert.ok(c.quality.penetration<=.006);assert.ok(c.quality.achievedFraction>=.35);
 results.push({side,candidate:c});
}
fs.writeFileSync('data/seated-idle-extension-regression.json',JSON.stringify(results,null,2));console.log(results.map(x=>({side:x.side,donor:x.candidate.name,knee:x.candidate.probe.mixed[x.side+'Knee']})));
