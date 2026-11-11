import fs from 'node:fs';const catalog=JSON.parse(fs.readFileSync('../animations/catalog.json')).clips;
import {samplePath} from './command-trajectories.mjs';
for(const id of ['fea07285e041302b4c3761a1','5c067507ed8dca6d85fcd5f9','a15693258ba0acc7c9650acc']){const p=samplePath(id,0,catalog.find(c=>c.id===id).duration,61);console.log(id,p.frames.filter((_,i)=>i%6===0).map((x,i)=>{const f=p.t.features(p.t.unpack(x));return {time:i*.8,hip:+f.hipHeight.toFixed(2),torso:+f.torsoInclination.toFixed(0),knee:+f.leftKnee.toFixed(0),foot:+f.leftFootHeight.toFixed(2)}}));}
