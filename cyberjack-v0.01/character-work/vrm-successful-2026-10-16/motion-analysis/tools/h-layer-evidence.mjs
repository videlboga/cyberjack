import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve(import.meta.dirname,'../data');
let records,names,manifest;
export function hLayerManifest(){load();return manifest;}
function load(){
 if(records)return;
 records=new Map();names=new Map();
 const file=dir+'/h-layer.jsonl';
 if(!fs.existsSync(file)){manifest={available:false};return;}
 for(const line of fs.readFileSync(file,'utf8').split('\n'))if(line.trim()){
  const row=JSON.parse(line);records.set(row.id,row);names.set(row.name,(names.get(row.name)||0)+1);
 }
 manifest={available:true,clips:records.size,ambiguousNames:[...names.values()].filter(n=>n>1).length,policy:'ID-only; shared-name scene links are context, not clip anatomy; soft ranking only'};
}
export function normalizeHLayer(row,{nameCount=1}={}){
 if(!row)return null;
 const visual=row.postureSource==='vlm'&&!row.vlmFromRepresentative&&Number(row.vlmAgreement)>=.75;
 return {id:row.id,act:row.act,actSource:row.actSource,phase:row.phase,
  posture:visual?row.posture:null,static:visual?row.static:null,notes:visual?row.notes:null,
  scenePosture:row.postureSource==='derived_from_position'?row.posture:null,
  position:row.position,sceneContexts:row.layerPositions||[],
  // Scene reuse is not animation-channel coverage, even for a unique name.
  layerOnly:null,reportedLayerKind:row.layerKind,ambiguousName:nameCount>1,
  visualEvidence:visual,agreement:row.vlmAgreement,fromRepresentative:!!row.vlmFromRepresentative,
  actReliable:row.actSource==='name'||row.actSource==='scene'&&nameCount===1,
  source:'h-layer/1',verified:false};
}
export function hLayerEvidence(id){load();const row=records.get(id);return normalizeHLayer(row,{nameCount:names.get(row?.name)||0});}
const actions=[
 ['eating',/ест(?![\p{L}])|есть|куша|ед[ауы]|пить|пь[её]|ж[еу]ёт|eating|drinking|\beat\b|\bdrink\b/i],
 ['combat',/бой|боев|удар|драк|combat|fight|punch|kick/i],
 ['locomotion',/ходьб|шага|ид[её]т|пройти|пройд|walk|walking|running/i],
 ['sleeping',/спит|спать|усну|sleep/i],
];
const actionPatterns=actions.map(([act,pattern])=>[act,new RegExp('(?<![\\p{L}])(?:'+pattern.source+')','iu')]);
export function hEvidencePenalty(e,stage,{whole=true,transition=false,locomotion=false}={}){
 if(!e)return {cost:0,reasons:[]};
 const query=[stage.description,stage.semantics?.query].filter(Boolean).join(' '),notes=e.notes||'',reasons=[];
 let cost=0;
 const add=(value,reason)=>{cost+=value;reasons.push({value,reason});};
 // Labels never override geometry or make a missing annotation a rejection.
 if(whole&&e.visualEvidence){
  if(/(?:Т[- ]?поз|T[- ]?pose)/i.test(notes))add(10,'VLM видит Т-позу; геометрия проверяется отдельно');
  for(const [act,re]of actionPatterns){if(re.test(notes)&&!re.test(query))add(5,'В описании постороннее действие: '+act);}
  if(!locomotion&&!transition&&e.static===false)add(.6,'Динамичное движение для цели-позы');
  if(!locomotion&&!transition&&e.static===true)add(-.35,'Визуально подтверждено удержание позы');
 }
 // No reward for a scene-derived posture; no use of notes as an executable goal.
 return {cost,reasons};
}
