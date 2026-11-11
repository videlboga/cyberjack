import * as T from './vendor/three/three.module.js';
import {loadNative} from '../../viewer/animation-library.js';
const base=new URL('../../animations/',import.meta.url);
const names=['cf_j_hips','cf_j_spine01','cf_j_spine02','cf_j_spine03','cf_j_spine03','cf_j_neck','cf_j_head','cf_j_shoulder_L','cf_j_arm00_L','cf_j_forearm01_L','cf_j_hand_L','cf_j_thigh00_L','cf_j_leg01_L','cf_j_leg03_L','cf_j_shoulder_R','cf_j_arm00_R','cf_j_forearm01_R','cf_j_hand_R','cf_j_thigh00_R','cf_j_leg01_R','cf_j_leg03_R'];
const canonical=n=>n.replace(/^cm_/,'cf_');
let rigsPromise;
export function createNativeAnatomyClip(native,bones,meta){
 const all=new Map(bones.map(b=>[canonical(b.name),b])),ordered=[],map=new Map();
 function add(name){if(map.has(name))return;const b=all.get(name);if(!b)throw Error('В исходном риге нет кости '+name);if(b.parent&&all.has(canonical(b.parent)))add(canonical(b.parent));map.set(name,ordered.length);ordered.push({...b,name,pi:map.get(canonical(b.parent||''))??-1,p:new T.Vector3(),q:new T.Quaternion(),s:new T.Vector3(),m:new T.Matrix4(),world:new T.Matrix4(),tracks:[]});}
 for(const n of names)add(n);
 for(const track of native.tracks){const n=canonical(track.bone||track.resolvedPath?.split('/').at(-1)||'');const i=map.get(n);if(i!=null&&[1,2,3,4].includes(track.attribute))ordered[i].tracks.push(track);}
 if(!ordered.some(b=>b.tracks.some(t=>[2,4].includes(t.attribute))))throw Error('Клип не содержит вращений скелета тела');
 const cv=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),Math.PI/2),inv=cv.clone().invert(),reflect=new T.Vector3(-1,1,1);
 function evaluate(time){for(const b of ordered){b.p.fromArray(b.position);b.q.fromArray(b.rotation);b.s.fromArray(b.scale||[1,1,1]);if(time!=null)for(const t of b.tracks){const v=t.sample(time);if(!v.every(Number.isFinite))throw Error('Некорректные значения в клипе');if(t.attribute===1)b.p.fromArray(v);else if(t.attribute===2){if(Math.hypot(...v)<1e-6)throw Error('Нулевое вращение в клипе');b.q.fromArray(v).normalize();}else if(t.attribute===3)b.s.fromArray(v);else if(t.attribute===4)b.q.setFromEuler(new T.Euler(...v.map(x=>x*Math.PI/180),'ZXY'));}b.m.compose(b.p,b.q,b.s);b.world.copy(b.pi<0?b.m:ordered[b.pi].world.clone().multiply(b.m));}return names.map(n=>ordered[map.get(n)].world.clone());}
 const rest=evaluate(null),restQ=rest.map(m=>new T.Quaternion().setFromRotationMatrix(m).invert()),restHip=new T.Vector3().setFromMatrixPosition(rest[0]),hip=restHip.y;
 if(!Number.isFinite(hip)||Math.abs(hip)<.1)throw Error('Некорректный исходный риг');
 const pairs={7:8,8:9,9:10,11:12,12:13,14:15,15:16,16:17,18:19,19:20};let lastTime,lastFrame;
 function sample(time){time=Math.max(0,Math.min(meta.duration,time));if(time===lastTime)return lastFrame;const ms=evaluate(time),joints=ms.map(m=>new T.Vector3().setFromMatrixPosition(m).applyQuaternion(cv).multiply(reflect).toArray()),q=ms.map((m,i)=>cv.clone().multiply(new T.Quaternion().setFromRotationMatrix(m).multiply(restQ[i])).multiply(inv).normalize().toArray().map((v,k)=>k===1||k===2?-v:v)),directions=names.map((_,i)=>pairs[i]==null?null:new T.Vector3().fromArray(joints[pairs[i]]).sub(new T.Vector3().fromArray(joints[i])).normalize().toArray()),root=new T.Vector3().setFromMatrixPosition(ms[0]).sub(restHip).applyQuaternion(cv).multiply(reflect).toArray();lastTime=time;return lastFrame={q,joints,directions,root};}
 const clip={id:meta.id,name:meta.title||meta.name,duration:meta.duration,loop:native.loop,sourceHipHeight:hip,bones:names,context:['sitting','seated'].includes(meta.posture)?'seated':/lying/.test(meta.posture)?'lying':meta.posture==='standing'?'standing':'action',sample};
 for(const t of [0,meta.duration*.5,meta.duration]){const f=sample(t);if(![...f.q.flat(),...f.joints.flat(),...f.root].every(Number.isFinite))throw Error('Некорректная поза клипа');}return clip;
}
export async function loadLibraryAnimation(meta){
 if(meta.reason)throw Error(meta.reason);
 rigsPromise??=fetch(new URL('source_rigs.json',base)).then(r=>{if(!r.ok)throw Error('Не загружены исходные риги');return r.json();}).catch(e=>{rigsPromise=null;throw e;});
 const [native,data]=await Promise.all([loadNative(new URL(meta.asset,base)),rigsPromise]);
 const rig=data.rigs.find(r=>r.name===(meta.rig==='male'?'p_cm_body_00':'p_cf_body_bone'));return createNativeAnatomyClip(native,rig.bones,meta);
}
