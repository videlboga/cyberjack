import {tPoseArms} from '../review/pose-validity.mjs';
import {Quaternion} from 'three';
import {buildRig,decoder} from './geometry.mjs';
import {contextDescriptor,CONTEXT_ARMS} from '../review/pose-context.mjs';
export function createContextSampler(bones){
 const r=buildRig(bones);function fk(){for(const b of r.ordered){b.m.compose(b.p,b.q,b.s);if(b.pi<0)b.world.copy(b.m);else b.world.multiplyMatrices(r.ordered[b.pi].world,b.m);b.worldQ??=new Quaternion();if(b.pi<0)b.worldQ.copy(b.q);else b.worldQ.copy(r.ordered[b.pi].worldQ).multiply(b.q)}}
 function reset(){for(const b of r.ordered){b.p.fromArray(b.position);b.q.fromArray(b.rotation);b.s.fromArray(b.scale||[1,1,1])}}
 reset();fk();const describe=contextDescriptor(r.ordered,r.ordered.map(b=>({world:b.world.clone(),worldQ:b.worldQ.clone()})));
 const compiled=new WeakMap();return (data,times)=>{let cached=compiled.get(data);if(!cached){const d=decoder(data,r.needed),groups=new Map();for(const b of d.bindings){if(!groups.has(b.bone))groups.set(b.bone,[]);groups.get(b.bone).push(b)}cached={d,groups};compiled.set(data,cached);}const {d,groups}=cached;return times.map(time=>{reset();for(const b of r.ordered)for(const tr of groups.get(b.name)||[]){const x=d.sample(tr,time);if(!x.every(Number.isFinite)||tr.attribute===2&&(Math.hypot(...x)<.5||Math.hypot(...x)>1.5))throw Error('invalid-channel');if(tr.attribute===1)b.p.fromArray(x);if(tr.attribute===2)b.q.fromArray(x).normalize();if(tr.attribute===3)b.s.fromArray(x)}fk();return {time,descriptor:describe(r.ordered),invalidArms:tPoseArms(r.ordered,r.ordered),rotations:Object.fromEntries([...CONTEXT_ARMS,'neck','head'].map(n=>['cf_j_'+n,r.ordered[r.map.get('cf_j_'+n)].q.toArray()]))}})}
}
