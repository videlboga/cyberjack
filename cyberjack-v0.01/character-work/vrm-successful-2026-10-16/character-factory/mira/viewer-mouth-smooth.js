const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export function buildMouthSmoothing(base,index,toWorld){
 const map=new Map(),ids=[],groups=[],weights=[];
 for(let i=0;i<base.length;i+=3){const key=[base[i],base[i+1],base[i+2]].map(v=>Math.round(v*1e7)).join(':');let id=map.get(key);if(id===undefined){id=groups.length;map.set(key,id);groups.push([]);const [x,y,z]=toWorld(base.subarray(i,i+3));weights.push((1-smooth((Math.abs(x)-.014)/.009))*(1-smooth((Math.abs(y-1.4355)-.009)/.008))*smooth((z-.046)/.011)*smooth((Math.abs(y-1.4355)-.0005)/.001));}ids.push(id);groups[id].push(i/3);}
 const links=groups.map(()=>new Set());for(let t=0;t<index.length;t+=3)for(let k=0;k<3;k++){const a=ids[index[t+k]],b=ids[index[t+(k+1)%3]];if(a!==b){links[a].add(b);links[b].add(a);}}
 return {groups,weights,links};
}
// Local Taubin pairs suppress small facets while reducing shrinkage. No topology
// change; the closure strip and the outer patch boundary receive zero weight.
export function smoothMouthSurface(positions,binding,amount=.7){
 amount=Math.max(0,Math.min(1,amount));if(!amount)return positions.slice();const {groups,weights,links}=binding;
 let p=new Float64Array(groups.length*3);for(let i=0;i<groups.length;i++)for(const v of groups[i])for(let k=0;k<3;k++)p[i*3+k]+=positions[v*3+k]/groups[i].length;
 for(let pair=0;pair<4;pair++)for(const lambda of [.4,-.41]){const next=p.slice();for(let i=0;i<groups.length;i++){const w=weights[i]*amount;if(!w||!links[i].size)continue;for(let k=0;k<3;k++){let mean=0;for(const j of links[i])mean+=p[j*3+k];next[i*3+k]+=lambda*w*(mean/links[i].size-p[i*3+k]);}}p=next;}
 const out=positions.slice();for(let i=0;i<groups.length;i++)if(weights[i])for(const v of groups[i])for(let k=0;k<3;k++)out[v*3+k]=p[i*3+k];return out;
}
