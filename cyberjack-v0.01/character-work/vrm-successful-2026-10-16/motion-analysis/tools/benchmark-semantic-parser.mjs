import fs from 'node:fs';import{interpretCommand}from'./command-language.mjs';
const state=JSON.parse(fs.readFileSync('artifacts/right-leg-raised-regression/request.json')).state;
const commands=['Подними правую ногу','Сядь на пол и вытяни ноги вперёд','Встань, пройди два метра вперёд и повернись направо','Встань на колени и коснись лбом земли','Положи правую руку на живот, левую между ног','Поешь'];
const results=[];for(const text of commands){const t=performance.now();try{const intent=await interpretCommand(text,state,{cache:false});results.push({text,intent,ms:performance.now()-t});console.log(text,JSON.stringify(intent.languageMetrics));}catch(e){results.push({text,error:e.message,semanticIntent:e.semanticIntent,ms:performance.now()-t});console.log(text,e.message);}}
fs.writeFileSync('artifacts/semantic-parser-v1/benchmark.json',JSON.stringify(results,null,2));
