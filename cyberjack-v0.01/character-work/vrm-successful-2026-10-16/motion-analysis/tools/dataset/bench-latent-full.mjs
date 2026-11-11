
import fs from 'node:fs';
import {openLatentStore} from './latent-store.mjs';
const store=openLatentStore(process.argv[2]);
console.log(JSON.stringify({poses:store.poses,clips:store.header.clips.length,mb:+(store.bytes/1e6).toFixed(1),loadMs:store.loadMs,dtype:store.header.dtype}));
const head=JSON.parse(fs.readFileSync(process.argv[3],'utf8'));
const data=fs.readFileSync(process.argv[4]);
const B=head.bones.length,N=head.poses;
const poses=new Float32Array(data.buffer,data.byteOffset,N*B*4);
const t0=performance.now();
let n=0;
for(let t=0;t<20;t++){
  const q=Math.floor(Math.random()*N);
  const pose=poses.subarray(q*B*4,(q+1)*B*4);
  const hits=store.query(pose,100); n+=hits.length;
}
const ms=(performance.now()-t0)/20;
const sample=store.query(poses.subarray(0,B*4),5);
console.log(JSON.stringify({queryMs:+ms.toFixed(2),hits:n/20,first:sample.map(h=>store.explain(h)).slice(0,3)}));
