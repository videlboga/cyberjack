import fs from 'node:fs';
import {rankPoseRows,preparePoseRetrieval} from './pose-retrieval.mjs';
import {descriptorFeatures,constraintScore} from '../review/command-pose.mjs';
import {semanticPenalty,clipSemantics} from './command-semantics.mjs';
const catalog=new Map(JSON.parse(fs.readFileSync('../animations/catalog.json')).clips.map(c=>[c.id,c]));
const rows=fs.readFileSync('data/context-index.jsonl','utf8').trim().split('\n').map(l=>{const r=JSON.parse(l);r.features=descriptorFeatures(r.descriptor);return r;});
preparePoseRetrieval(rows);
const demos=JSON.parse(fs.readFileSync('data/support-demos.json'));
const stages=[demos.sit.stages[0],demos.sit.stages[1],demos.bow.stages[0],demos.bow.stages[1]];
const report=[];
for(const stage of stages){const versions=[];for(const enabled of [false,true]){
 const request={...stage,semantics:{...stage.semantics,hLayerRanking:enabled}},cache=new Map(),start=performance.now();
 const results=rankPoseRows(rows,stage.constraints,id=>{if(!cache.has(id))cache.set(id,semanticPenalty(catalog.get(id),request));return cache.get(id)},20);
 versions.push({enabled,ms:Math.round(performance.now()-start),top:results.slice(0,5).map(({r,score})=>({id:r.id,name:catalog.get(r.id).name,time:r.time,score,geometry:constraintScore(r.features,stage.constraints),evidence:cache.get(r.id).rankingEvidence,notes:clipSemantics(catalog.get(r.id)).hLayer?.notes}))});
 }report.push({command:stage.description,versions});}
fs.mkdirSync('artifacts/h-layer-integration',{recursive:true});fs.writeFileSync('artifacts/h-layer-integration/ranking-ab.json',JSON.stringify(report,null,2));
for(const r of report)console.log(r.command,r.versions.map(v=>({enabled:v.enabled,ms:v.ms,top:v.top.map(c=>[c.name,c.score,c.evidence])})));
