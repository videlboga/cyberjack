import assert from 'node:assert/strict';import fs from 'node:fs';import zlib from 'node:zlib';import path from 'node:path';import {buildRig,analyze,names} from './geometry.mjs';import {describeAnatomy} from './anatomy.mjs';
const root=path.resolve(import.meta.dirname,'../..'),rig=buildRig(JSON.parse(fs.readFileSync(root+'/animations/source_rigs.json')).rigs.find(r=>r.name==='p_cf_body_bone').bones);
for(const id of ['d82833280717194afd3bde21','e0259d6f372c87b464608b2c','59e60d46dc3ff3adec5b05d0']){
 const r=analyze(JSON.parse(zlib.gunzipSync(fs.readFileSync(root+'/animations/clips/'+id+'.json.gz'))),rig,{preview:true});assert(r.anatomy.atoms.length);for(const m of Object.values(r.anatomy.metrics))assert(Object.values(m).filter(x=>typeof x==='number').every(Number.isFinite));for(const a of r.anatomy.atoms)assert(a.start>=0&&a.end<=r.duration+.001&&a.end>a.start);
 // Normalized source frames have millimetre rounding; use them for invariance, not original-angle parity.
 const f=r.preview.frames,a=describeAnatomy({frames:f,names,height:1,duration:r.duration}),b=describeAnatomy({frames:f.map(fr=>fr.map(p=>p.map((x,j)=>x*3+[7,-4,2][j]))),names,height:3,duration:r.duration});
 for(const k of Object.keys(a.metrics))assert(Math.abs(a.metrics[k].mean-b.metrics[k].mean)<.0011,k);
 // A wrist can turn with no endpoint displacement: quaternion channels must reveal it.
 const rots=f.map(()=>names.map(()=>[0,0,0,1]));for(let i=0;i<rots.length;i++){const t=i/(rots.length-1);rots[i][names.indexOf('cf_j_hand_L')]=[0,Math.sin(t*.5),0,Math.cos(t*.5)]}const turn=describeAnatomy({frames:f,rots,names,height:1,duration:r.duration});assert(turn.angular.hand_L.mean>0);assert.equal(turn.angular.hand_R.mean,0);
}
console.log('PASS anatomical intervals, finite measurements, scale/translation invariance, in-place wrist rotation');
