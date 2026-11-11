// Opt-in local diagnostics: ?perf=1. No telemetry or persistent sampling.
export function createViewerPerformance(){
 if(!new URLSearchParams(location.search).has('perf'))return {begin(){},end(){},sample(){},measure:(_,fn)=>fn()};
 const label=document.createElement('output');label.id='viewer-performance';label.setAttribute('aria-label','Производительность');label.style.cssText='position:fixed;left:12px;bottom:62px;z-index:1000;background:#17212eee;color:#fff;padding:8px 12px;border-radius:6px;font:12px monospace;white-space:pre;pointer-events:none';document.body.append(label);
 const values=new Map();let last=0,started=0,published=0;const sample=(name,value)=>{let row=values.get(name);if(!row)values.set(name,row=[]);row.push(value);if(row.length>120)row.shift();};
 return {sample,measure(name,fn){const at=performance.now();try{return fn();}finally{sample(name,performance.now()-at);}},begin(now){if(last&&now-last<2000)sample('кадр',now-last);last=now;started=performance.now();},end(){sample('JS кадра',performance.now()-started);if(performance.now()-published<1000)return;published=performance.now();label.textContent=[...values].map(([name,row])=>{const a=[...row].sort((a,b)=>a-b),mean=row.reduce((a,b)=>a+b,0)/row.length;return `${name}: ${mean.toFixed(1)} мс · p95 ${a[Math.floor((a.length-1)*.95)].toFixed(1)}`;}).join('\n');}};
}
