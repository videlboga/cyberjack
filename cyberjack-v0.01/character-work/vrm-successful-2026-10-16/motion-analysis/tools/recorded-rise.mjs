import {Quaternion,Vector3} from 'three';
import fs from 'node:fs';
import {samplePath} from './command-trajectories.mjs';
import {pack,constraintScore} from '../review/command-pose.mjs';
import {phraseTransition,motionTiming} from './motion-phrasing.mjs';
const id='5c067507ed8dca6d85fcd5f9';let cached;
export function recordedRise(state,stage){
 if(!state.profile?.recordedRisePilot||stage.support||stage.semantics?.requiresTrajectory)return null;
 const goals=stage.constraints||[],standing=goals.some(c=>c.feature==='hipHeight'&&c.min>.45);if(!standing)return null;
 if(!cached){const clip=JSON.parse(fs.readFileSync(new URL('../../animations/catalog.json',import.meta.url))).clips.find(c=>c.id===id);cached=samplePath(id,0,clip.duration,121);}
 const t=cached.t,from=t.unpack(state.pose),f=t.features(from);if(f.hipHeight>.26||f.torsoInclination>50)return null;
 // Only forward playback. Find the seated entry and first stable standing frame.
 const poses=cached.frames.map(p=>t.unpack(p)),features=poses.map(p=>t.features(p));
 const entry=features.findIndex(v=>v.hipHeight>.13&&v.hipHeight<.23&&v.torsoInclination<25);
 const end=features.findIndex((v,i)=>i>entry&&v.hipHeight>.55&&v.torsoInclination<15&&v.leftKnee<30&&v.rightKnee<30);
 if(entry<0||end<entry)return null;
 const selected=poses.slice(entry,end+1),alignmentYaw=t.heading(from)-t.heading(selected[0]),alignment=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),alignmentYaw);for(const p of selected){p[0].p.applyQuaternion(alignment);p[0].q.premultiply(alignment);t.m.fk(p);}const shift=t.point(from,'hips').sub(t.point(selected[0],'hips'));shift.y=0;
 for(const p of selected){p[0].p.add(shift);t.m.fk(p);}
 const last=selected.at(-1),quality=constraintScore(t.features(last),goals);
 // Never silently discard an incompatible requested endpoint.
 if(quality.worst>.12)return null;
 const start=selected[0],join=phraseTransition(t,from,start,{handSupport:true}),joinDuration=motionTiming(t,from,start).duration;
 const base={status:'ready',translation:stage.translation,yaw:stage.yaw,rootTarget:[...state.position],headingTarget:state.yaw};
 return [{...base,description:'Подготовиться к записанному подъёму: собрать ноги и поставить руки',constraints:[],pose:pack(start),features:t.features(start),method:'Вход к записанному переходу',duration:joinDuration,motion:{frames:join,duration:joinDuration,noMargins:true,loop:false,source:{name:'Подготовка к подъёму со спины'}},preparation:{automatic:true,kind:'recorded-rise-entry'}},
 {...base,description:stage.description,constraints:goals,pose:pack(last),features:t.features(last),source:{id,name:'Stand Up 1'},method:'Записанный подъём без изменения суставов и времени',duration:cached.duration*(end-entry)/120,motion:{frames:selected.map(pack),duration:cached.duration*(end-entry)/120,noMargins:true,loop:false,source:{id,name:'Stand Up 1 · сидячий участок → стойка',range:[cached.duration*entry/120,cached.duration*end/120],nativeTrajectory:true}},transition:'Запись целиком: сбор ног, перенос веса, подъём',recordedRise:{entryFrame:entry,endFrame:end,horizontalShift:shift.toArray(),alignmentYaw,nativeSampleCount:selected.length}}];
}
