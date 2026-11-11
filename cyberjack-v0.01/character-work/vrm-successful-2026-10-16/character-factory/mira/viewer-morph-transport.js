const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a);return l>1e-12?a.map(v=>v/l):null;};
function frame(a,b,c){const x=unit(sub(b,a)),z=unit(cross(sub(b,a),sub(c,a)));return x&&z?[x,cross(z,x),z]:null;}
// Area-weighted rigid triangle frames rotate identity edits with the donor morph.
// No stretch is applied to the added volume. Degenerate triangles are ignored.
export function transportOffsets(base,delta,index,offsets){
 const out=new Float64Array(base.length),weights=new Float64Array(base.length/3);
 const point=(i,posed)=>[0,1,2].map(k=>base[i*3+k]+(posed?delta[i*3+k]:0));
 for(let t=0;t<index.length;t+=3){const ids=[index[t],index[t+1],index[t+2]];if(!ids.some(i=>offsets[i*3]||offsets[i*3+1]||offsets[i*3+2]))continue;const a=ids.map(i=>point(i,false)),b=ids.map(i=>point(i,true)),f=frame(...a),g=frame(...b);if(!f||!g)continue;const area=Math.hypot(...cross(sub(a[1],a[0]),sub(a[2],a[0])));for(const i of ids){const v=Array.from(offsets.subarray(i*3,i*3+3));if(!v.some(Boolean))continue;const q=f.map(axis=>dot(v,axis));for(let k=0;k<3;k++)out[i*3+k]+=area*(q[0]*g[0][k]+q[1]*g[1][k]+q[2]*g[2][k]);weights[i]+=area;}}
 // Share the transported vector across UV/material splits with identical
 // donor rest and posed positions. Separate mouth surfaces remain separate.
 const groups=new Map();for(let i=0;i<weights.length;i++)if(weights[i]){const key=[base[i*3],base[i*3+1],base[i*3+2],delta[i*3],delta[i*3+1],delta[i*3+2]].map(v=>Math.round(v*1e7)).join(':');if(!groups.has(key))groups.set(key,[]);groups.get(key).push(i);}
 for(const ids of groups.values())if(ids.length>1){const sum=[0,0,0];let weight=0;for(const i of ids){weight+=weights[i];for(let k=0;k<3;k++)sum[k]+=out[i*3+k];}for(const i of ids){weights[i]=weight;for(let k=0;k<3;k++)out[i*3+k]=sum[k];}}
 for(let i=0;i<weights.length;i++)for(let k=0;k<3;k++)out[i*3+k]=weights[i]?out[i*3+k]/weights[i]:offsets[i*3+k];// Smooth rotation corrections, rather than the authored shape itself.
 const neighbours=new Map();for(let t=0;t<index.length;t+=3)for(let k=0;k<3;k++){const a=index[t+k],b=index[t+(k+1)%3];if(!neighbours.has(a))neighbours.set(a,new Set());if(!neighbours.has(b))neighbours.set(b,new Set());neighbours.get(a).add(b);neighbours.get(b).add(a);}
 let correction=Float64Array.from(out,(v,i)=>v-offsets[i]);for(let pass=0;pass<3;pass++){const next=correction.slice();for(const [i,ids]of neighbours){if(!Math.hypot(offsets[i*3],offsets[i*3+1],offsets[i*3+2]))continue;for(let k=0;k<3;k++){let sum=0;for(const j of ids)sum+=correction[j*3+k];next[i*3+k]=.5*correction[i*3+k]+.5*sum/ids.size;}}correction=next;}
 for(let i=0;i<weights.length;i++){if(!correction[i*3]&&!correction[i*3+1]&&!correction[i*3+2]){out.set(offsets.subarray(i*3,i*3+3),i*3);continue;}const length=Math.hypot(offsets[i*3],offsets[i*3+1],offsets[i*3+2]);const v=[0,1,2].map(k=>offsets[i*3+k]+correction[i*3+k]),norm=Math.hypot(...v);for(let k=0;k<3;k++)out[i*3+k]=norm>1e-12?v[k]*length/norm:offsets[i*3+k];}
 for(const ids of groups.values())if(ids.length>1)for(let k=0;k<3;k++){const mean=ids.reduce((sum,i)=>sum+out[i*3+k],0)/ids.length;for(const i of ids)out[i*3+k]=mean;}
 return out;
}

// Conservative per-target line search: retain the largest tested edit that
// does not reverse donor triangles or collapse their area at the endpoint.
export function safeTransportScale(base,delta,index,offsets){
 const valid=scale=>{for(let t=0;t<index.length;t+=3){const ids=[index[t],index[t+1],index[t+2]],a=ids.map(i=>[0,1,2].map(k=>base[i*3+k]+delta[i*3+k])),b=ids.map((i,j)=>a[j].map((v,k)=>v+scale*offsets[i*3+k]));const n=cross(sub(a[1],a[0]),sub(a[2],a[0])),m=cross(sub(b[1],b[0]),sub(b[2],b[0])),area=dot(n,n);if(area>1e-20&&(dot(n,m)<=0||dot(m,m)<area*.0025))return false;}return true;};
 for(const scale of [1,.75,.5,.25,.125,.0625])if(valid(scale))return scale;return 0;
}
