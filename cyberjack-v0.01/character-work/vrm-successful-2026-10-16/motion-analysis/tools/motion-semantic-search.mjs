import {normalizeMotionQuery} from './motion-query-normalizer.mjs';
import {verifyMotionCandidates} from './jev-motion-verifier.mjs';
const cache=new Map();
export async function searchMotionSemantics(query,{limit=100,fetchImpl=fetch,verify=verifyMotionCandidates,normalize=normalizeMotionQuery}={}){
 const key=JSON.stringify([query,limit,process.env.MOTION_VERIFIER||'jev',process.env.MOTION_JEV_MODEL||'typesafe/jev-1.13',process.env.MOTION_JEV_THRESHOLD||'.8']);if(cache.has(key))return structuredClone(cache.get(key));
 const originalQuery=query;query=await normalize(query);
 const response=await fetchImpl('http://127.0.0.1:8790/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,limit}),signal:AbortSignal.timeout(12000)});
 if(!response.ok)throw Error('Семантический индекс недоступен: HTTP '+response.status);
 const result=await response.json();if(!Array.isArray(result.matches))throw Error('Неверный ответ семантического индекса');
 const unique=[...new Map(result.matches.filter(r=>typeof r.text==='string').map(r=>[r.text,r])).values()].slice(0,24);
 const judgement=await verify(query,unique.map(r=>({id:r.id,text:r.text})));const selected=new Set(judgement.matches.map(m=>unique.find(r=>r.id===m.id)?.text).filter(Boolean));
 const verified={...result,query,originalQuery,verification:judgement,matches:result.matches.filter(r=>typeof r.id==='string'&&Number.isFinite(r.score)&&selected.has(r.text)).sort((a,b)=>b.score-a.score)};
 cache.set(key,verified);while(cache.size>64)cache.delete(cache.keys().next().value);return structuredClone(verified);
}
// Reuse the local service across viewer restarts; no cloud fallback.
export async function ensureMotionSemanticService(){
 try{const response=await fetch('http://127.0.0.1:8790/health',{signal:AbortSignal.timeout(1000)});if(response.ok)return;}catch{}
 const {spawn}=await import('node:child_process'),fs=await import('node:fs');
 const log=new URL('../artifacts/motion-semantic-service.log',import.meta.url),fd=fs.openSync(log,'a');
 const child=spawn('python',['-u',new URL('./motion_embedding_service.py',import.meta.url).pathname],{detached:true,stdio:['ignore',fd,fd]});child.on('error',error=>console.error('Semantic service:',error.message));child.unref();fs.closeSync(fd);
}
