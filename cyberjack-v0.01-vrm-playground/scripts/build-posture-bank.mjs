import fs from 'node:fs';
const root='/home/cyberkitty/Projects/cyberjack/cyberjack-v0.01/character-work/vrm-successful-2026-10-16';
let source=fs.readFileSync(root+'/viewer/animation-library.js','utf8').replace(/^import .*\n/,'');
const {loadNative}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));

// One clip per pose, taken from the measured pose registry so the stand never invents a pose.
const registry=JSON.parse(fs.readFileSync(root+'/motion-analysis/data/pose-registry.json'));
const SUPPORT={'pose_lying_down':'floor-back','pose_sitting':'floor-seat','pose_kneeling':'floor-knees','pose_all_fours':'floor-hands-knees','pose_spread_eagle':'floor-back','act_present_feet':'floor-back'};
// Position channels are absolute in the source rig; offsets from the rest pose are stored in
// reference-height units so the runtime can scale them to any avatar.
const catalog=JSON.parse(fs.readFileSync(root+'/animations/catalog.json')).clips;
const rigs=JSON.parse(fs.readFileSync(root+'/animations/source_rigs.json')).rigs;
const rigFor={female:rigs.find(r=>r.name==='p_cf_body_bone').bones,male:rigs.find(r=>r.name==='p_cm_body_00').bones};
const restCache={};
function restFor(rigName){
 const key=rigName==='male'?'male':'female';
 if(!restCache[key]){const map=new Map();for(const b of rigFor[key])if(!map.has(b.name))map.set(b.name,[b.position[0],b.position[1],b.position[2]]);restCache[key]=map}
 return restCache[key];
}
const ROLE={'pose_lying_down':'base-pose','pose_sitting':'base-pose','pose_kneeling':'base-pose','pose_all_fours':'base-pose','pose_spread_eagle':'base-pose','act_present_feet':'feet-presentation'};

async function exportClip(id,name,label,pose){
 const entry=catalog.find(c=>c.id===id);if(!entry)throw Error('No catalog entry '+id);
 const rest=restFor(entry.rig),restHips=rest.get('cf_j_hips')?.[1]||0.9;
 const raw=fs.readFileSync(root+'/animations/clips/'+id+'.json.gz');const clip=await loadNative('data:application/gzip;base64,'+raw.toString('base64'));
 const tracks=clip.tracks.filter(t=>t.attribute===2&&t.width===4&&t.bone?.startsWith('cf_')&&!/hair|sk_/.test(t.bone)).map(t=>{const times=[],rotations=[];for(let frame=0;frame<=Math.ceil(clip.duration*15);frame++){const time=Math.min(clip.duration,frame/15),q=t.sample(time);if(!q.every(Number.isFinite))throw Error('Invalid rotation '+t.bone);const norm=Math.hypot(...q);if(norm<.9||norm>1.1)continue;times.push(time);rotations.push(...q.map(v=>Math.round(v/norm*1e7)/1e7))}return {bone:t.bone,times,rotations}}).filter(t=>t.times.length);
 if(!tracks.length)throw Error('No rotation tracks for '+id);
 // Only bones whose offset from rest actually moves are kept: a kneeling pose lives here.
 const positions=[];
 for(const t of clip.tracks){
  if(t.attribute!==1||t.width!==3||!t.bone||!/^cf_j_/.test(t.bone)||/hair|sk_/.test(t.bone))continue;
  const restPos=rest.get(t.bone);if(!restPos)continue;
  const times=[],points=[];let maxOffset=0;
  for(let frame=0;frame<=Math.ceil(clip.duration*15);frame++){
   const time=Math.min(clip.duration,frame/15),p=t.sample(time);
   if(!p.every(Number.isFinite))throw Error('Invalid position '+t.bone);
   const dx=(p[0]-restPos[0])/restHips,dy=(p[1]-restPos[1])/restHips,dz=(p[2]-restPos[2])/restHips;
   maxOffset=Math.max(maxOffset,Math.abs(dx),Math.abs(dy),Math.abs(dz));
   times.push(time);points.push(Math.round(dx*1e5)/1e5,Math.round(dy*1e5)/1e5,Math.round(dz*1e5)/1e5);
  }
  if(maxOffset<0.01)continue;
  positions.push({bone:t.bone,times,points,unit:'reference-height-offset-from-rest',maxOffset:Math.round(maxOffset*1000)/1000});
 }
 return {id:name,duration:clip.duration,tracks,positions,unit:{positions:'reference-height-offset-from-rest'},source:{libraryId:id,name:label,source:clip.source},role:ROLE[pose]||'base-pose',mask:'whole-body',support:SUPPORT[pose]||'floor'};
}

const clips=[];
for(const [id,name,label,pose]of [['28a3169401858c6bd0c90276','Base_sitting','f_suwari_00_02_M','pose_sitting'],['227af670e6cbaa32bf59d276','Base_lying','f_sleep_00_00','pose_lying_down']]){
 clips.push(await exportClip(id,name,label,pose));
}
// Feet presentation comes from a measured clip (goal foot.presented). The older constructed
// variant — seated base plus knee extensions — is kept only as a fallback.
const feetPose=registry.poses.act_present_feet;
if(feetPose&&feetPose.torsoDonor){
 // Two-source pose composed in EXPORT space. The mixer works on the library rig, but the bank ships
 // exported tracks (Koikatsu bone space after retarget), so mixing there produced rotations that the
 // stage applied differently. Here both sources are exported first and only the pelvis/spine tracks
 // are taken from the seated clip, resampled onto the base grid — verified offline and on stage.
 const base=await exportClip(feetPose.baseClip,'Base_feet',feetPose.name,'act_present_feet');
 const seat=await exportClip(feetPose.torsoDonor,'_seat_tmp','f_suwari_00_02_M','pose_sitting');
 const dur=Math.min(1.4,base.duration),frames=Math.max(2,Math.round(dur*30)),times=[];for(let i=0;i<frames;i++)times.push(Math.round(i*dur/frames*1000)/1000);
 const sampleTrack=(track,t)=>{const ts=track.times;if(ts.length===1)return track.rotations.slice(0,4);let f=0;while(f<ts.length-2&&ts[f+1]<t)f++;const a=Math.min(1,Math.max(0,(t-ts[f])/((ts[f+1]-ts[f])||1)));const q0=track.rotations.slice(f*4,f*4+4),q1=track.rotations.slice((f+1)*4,(f+1)*4+4);return q0.map((v,i)=>v+(q1[i]-v)*a)};
 const torso=['cf_j_hips','cf_j_waist01','cf_j_waist02','cf_j_spine01','cf_j_spine02','cf_j_spine03'];
 for(const bone of torso){
  const tr=seat.tracks.find(t=>t.bone===bone);if(!tr)continue;
  const rotations=[];for(const t of times)rotations.push(...sampleTrack(tr,t));
  const track={bone,times,rotations};const j=base.tracks.findIndex(t=>t.bone===bone);if(j>=0)base.tracks[j]=track;else base.tracks.push(track);
 }
 base.support='floor-ground-seat';base.role='feet-presentation';base.poseId='act_present_feet';base.evidence=feetPose.evidence;base.duration=dur;
 base.source={base:base.source,pelvisAndSpine:feetPose.torsoDonor,composition:'export-space:tracks'};
 clips.push(base);
}else if(feetPose&&feetPose.baseClip){
 const clip=await exportClip(feetPose.baseClip,'Base_feet',feetPose.name,'act_present_feet');
 clip.poseId='act_present_feet';clip.evidence=feetPose.evidence;
 // Support follows the measured posture of the chosen clip: seated poses rest on the seat,
 // lying ones on the back; the floor helper needs to know which.
 clip.support=feetPose.posture==='seated'?'floor-seat':feetPose.posture==='lying'?'floor-back':'floor';
 clips.push(clip);
}else{
const feet=structuredClone(clips.find(c=>c.id==='Base_sitting'));
feet.id='Base_feet';feet.role='feet-presentation';feet.support='floor-ground-seat';feet.duration=1;feet.source={base:feet.source,extensions:[]};
clips.push(feet);
}

// Poses that had no clip before: exported straight from the registry.
for(const pose of ['pose_all_fours','pose_kneeling','pose_spread_eagle']){
 const p=registry.poses[pose];if(!p)throw Error('Registry has no '+pose);
 const clip=await exportClip(p.baseClip,p.stageClip,p.name,pose);
 clip.poseId=pose;clip.evidence=p.evidence;clip.needsMeasurement=p.needsMeasurement||[];
 clips.push(clip);
}
fs.writeFileSync('public/vrm-stage/assets/postures.json',JSON.stringify({format:'kkbp-posture-bank-v1',clips}));
console.log(clips.map(c=>[c.id,Math.round(c.duration*100)/100,c.tracks.length,'pos:'+(c.positions||[]).map(p=>p.bone+':'+p.maxOffset).join('|')]));
