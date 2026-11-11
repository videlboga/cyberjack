import {pack} from '../review/command-pose.mjs';
const ease=x=>{x=Math.max(0,Math.min(1,x));return x*x*x*(x*(x*6-15)+10);};
// Correct a recorded trajectory over broad overlapping motion windows, rather than
// appending an unrelated 120/180 ms pose blend at either end.
export function warpTransition(t,recorded,from,to,duration){const count=Math.max(24,Math.ceil(duration*30)),entry=Math.min(.4,Math.max(.22,.55/duration)),exit=Math.min(.4,Math.max(.22,.65/duration)),frames=[];for(let i=0;i<=count;i++){const u=i/count,f=u*(recorded.length-1),j=Math.min(recorded.length-2,Math.floor(f));let p=t.interpolate(t.unpack(recorded[j]),t.unpack(recorded[j+1]),f-j);if(u<entry)p=t.interpolateTransition(from,p,ease(u/entry));if(u>1-exit)p=t.interpolateTransition(p,to,ease((u-1+exit)/exit));frames.push(i===0?pack(from):i===count?pack(to):pack(p));}return {frames,duration,entrySeconds:entry*duration,exitSeconds:exit*duration};}
