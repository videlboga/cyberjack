import fs from 'node:fs';import{clipSemantics,sourceDescription}from'./command-semantics.mjs';
const eligible=new Set(fs.readFileSync('data/context-index.jsonl','utf8').trim().split('\n').map(l=>JSON.parse(l).id));
const clips=JSON.parse(fs.readFileSync('../animations/catalog.json')).clips,rows=[];
for(const c of clips){if(!eligible.has(c.id))continue;const s=clipSemantics(c),h=s.hLayer,d=sourceDescription(c.id);const parts=[c.name.replace(/[_-]/g,' '),d?.description,h?.visualEvidence?h.notes:null,h?.actReliable?'Activity: '+h.act?.replaceAll('_',' '):null].filter(Boolean);rows.push({id:c.id,text:parts.join('. '),evidence:{visual:!!h?.visualEvidence,description:!!d,sourceName:true}});}
fs.writeFileSync('data/motion-semantic-corpus.json',JSON.stringify({model:'intfloat/multilingual-e5-small',rows}));console.log(rows.length);
