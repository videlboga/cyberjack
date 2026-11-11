// Independent diagnostic; a rapid root transfer is not a corrupt clip.
export function rootMotion(preview){
 const frames=preview.frames,dt=preview.duration/(frames.length-1),distance=(a,b)=>Math.hypot(...a.map((x,k)=>x-b[k]));
 const steps=frames.slice(1).map((f,i)=>({start:i*dt,end:(i+1)*dt,distance:distance(f[0],frames[i][0])}));
 const sorted=steps.map(s=>s.distance/(dt||1)).sort((a,b)=>a-b),median=sorted[Math.floor(sorted.length/2)]||0;
 const events=steps.filter(s=>s.distance>.3&&s.distance/(dt||1)>Math.max(2.5,median*6)).map(s=>({...s,speed:s.distance/(dt||1)}));
 const merged=[];for(const e of events){const last=merged.at(-1);if(last&&e.start-last.end<=dt*1.1){last.end=e.end;last.distance+=e.distance;last.peakSpeed=Math.max(last.peakSpeed,e.speed)}else merged.push({start:e.start,end:e.end,distance:e.distance,peakSpeed:e.speed})}
 return {version:'root-motion-v1',sampleHz:1/(dt||1),maxStep:Math.max(0,...steps.map(s=>s.distance)),peakSpeed:Math.max(0,...sorted),medianSpeed:median,loopSeamDistance:distance(frames[0][0],frames.at(-1)[0]),events:merged,rapidTransfer:merged.length>0,units:'reference-heights / second',note:'Large fast root displacement; not proof of corrupted data or a teleport. Shorter transfers can be missed at coarse sampling.'};
}
