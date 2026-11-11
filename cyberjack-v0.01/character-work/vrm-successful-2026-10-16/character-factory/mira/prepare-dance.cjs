/* Uses the library's native Unity cubic/dense evaluator, without resampling a
 * substitute animation. Save source world rotation deltas in Blender space. */
const fs=require('fs'),zlib=require('zlib');
let reader=fs.readFileSync('../../viewer/animation-library.js','utf8');reader=reader.slice(reader.indexOf('export async function loadNative'),reader.indexOf('export async function installLibrary')).replace('export async','async');
const sourcePath='../../animations/clips/'+(process.argv[2]||'c78368db619cb915c7122f78')+'.json.gz';
const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(sourcePath)));
const load=Function('readPayload',reader+';return loadNative;')(async()=>data);
const qm=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const qi=q=>[-q[0],-q[1],-q[2],q[3]],qn=q=>{const l=Math.hypot(...q);return q.map(v=>v/l);};
const qr=(q,p)=>qm(qm(q,[...p,0]),qi(q)).slice(0,3);
const source=JSON.parse(fs.readFileSync('../../viewer/vrm_studio_assets/koikatsu-idles.json','utf8')).sourceRig;
const map=new Map(source.map(n=>[n.name,{...n}])),sorted=[],done=new Set();
function visit(n){if(done.has(n.name))return;const p=map.get(n.parent);if(p)visit(p);n.restQ=qm(p?p.restQ:[0,0,0,1],n.rotation);n.restP=p?qr(p.restQ,n.position).map((v,i)=>p.restP[i]+v):n.position;done.add(n.name);sorted.push(n);}for(const n of map.values())visit(n);
const boneNames=['cf_j_hips','cf_j_spine01','cf_j_spine02','cf_j_spine03','cf_j_spine03','cf_j_neck','cf_j_head',...['L','R'].flatMap(s=>['cf_j_shoulder_','cf_j_arm00_','cf_j_forearm01_','cf_j_hand_','cf_j_thigh00_','cf_j_leg01_','cf_j_leg03_'].map(n=>n+s))];
(async()=>{const clip=await load('unused');const frames=[],fps=30;
for(let f=0;f<=Math.ceil(clip.duration*fps);f++){
 const t=Math.min(f/fps,clip.duration);
 for(const n of sorted){n.q=n.rotation;n.p=n.position;}
 for(const tr of clip.tracks){const n=map.get(tr.bone);if(!n)continue;const v=tr.sample(t);if(!v.every(Number.isFinite))throw Error('Nonfinite source sample');if(tr.attribute===2)n.q=qn(v);if(tr.attribute===1)n.p=v;}
 for(const n of sorted){const p=map.get(n.parent);n.worldQ=qm(p?p.worldQ:[0,0,0,1],n.q);n.worldP=p?qr(p.worldQ,n.p).map((v,i)=>p.worldP[i]+v):n.p;}
 const rotations=boneNames.map(name=>{const n=map.get(name);if(!n)throw Error('Missing '+name);const q=qm(n.worldQ,qi(n.restQ));return qn([q[0],q[2],-q[1],q[3]]);});
 const hip=map.get('cf_j_hips'),d=hip.worldP.map((v,i)=>v-hip.restP[i]);
 const joints=boneNames.map(name=>{const p=map.get(name).worldP;return [-p[0],-p[2],p[1]];});
 const targets=['cf_j_spine01','cf_j_spine02','cf_j_spine03','cf_j_neck','cf_j_neck','cf_j_head',null,...['L','R'].flatMap(s=>['cf_j_arm00_','cf_j_forearm01_','cf_j_hand_',null,'cf_j_leg01_','cf_j_leg03_','cf_j_toes_'].map(n=>n?n+s:null))];
 const directions=targets.map((end,i)=>{
  if(!end||!map.has(end))return null;
  const p=map.get(end).worldP,b=map.get(boneNames[i]).worldP,v=[-(p[0]-b[0]),-(p[2]-b[2]),p[1]-b[1]],l=Math.hypot(...v);
  return l>1e-6?v.map(x=>x/l):null;
 });
 frames.push({q:rotations,root:[-d[0],-d[2],d[1]],joints,directions});
}
const payload={name:clip.name,id:clip.id,duration:clip.duration,loop:clip.loop,fps,frames,source:sourcePath,origin:clip.origin,sourceHipHeight:map.get('cf_j_hips').restP[1],bones:boneNames};
fs.writeFileSync(process.argv[3]||'dance-data.js',process.argv[3]?JSON.stringify(payload):'window.ANATOMY_DANCE='+JSON.stringify(payload)+';\n');console.log({clip:clip.name,frames:frames.length,bones:boneNames.length});})();
