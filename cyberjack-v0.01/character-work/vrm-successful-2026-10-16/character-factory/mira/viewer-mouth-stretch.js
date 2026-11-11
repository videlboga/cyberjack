// Approximate volume preservation: a stretched lip surface loses thickness.
// Weld both rest and posed duplicates so UV/material splits share the factor.
export function thinStretchedMouth(rest,delta,index,offset){
 const groups=new Map(),ids=new Int32Array(rest.length/3),stats=[];
 for(let i=0;i<rest.length;i+=3){const key=[...rest.subarray(i,i+3),...rest.subarray(i,i+3).map((v,k)=>v+delta[i+k])].map(v=>Math.round(v*1e7)).join(':');let id=groups.get(key);if(id===undefined){id=stats.length;groups.set(key,id);stats.push({a:0,b:0,links:new Set()});}ids[i/3]=id;}
 const area=(a,b,c,posed)=>{const at=(i,k)=>rest[i*3+k]+(posed?delta[i*3+k]:0),u=[0,1,2].map(k=>at(b,k)-at(a,k)),v=[0,1,2].map(k=>at(c,k)-at(a,k));return Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]);};
 for(let j=0;j<index.length;j+=3){const tri=[index[j],index[j+1],index[j+2]],a=area(...tri,false),b=area(...tri,true);if(a<1e-12||b<1e-12)continue;for(const i of tri){const s=stats[ids[i]];s.a+=a;s.b+=b;for(const k of tri)if(ids[k]!==ids[i])s.links.add(ids[k]);}}
 let factors=stats.map(s=>s.b?Math.max(.45,Math.min(1,Math.sqrt(s.a/s.b))):1);
 for(let pass=0;pass<2;pass++)factors=factors.map((v,i)=>{const links=stats[i].links;return links.size?.5*v+.5*[...links].reduce((sum,k)=>sum+factors[k],0)/links.size:v;});
 for(let i=0;i<offset.length;i++)offset[i]*=factors[ids[Math.floor(i/3)]];
 return offset;
}
