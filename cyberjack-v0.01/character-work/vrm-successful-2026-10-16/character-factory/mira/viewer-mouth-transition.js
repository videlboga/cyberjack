const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
export function mouthTransitionWeight([x,y,z]){
 const d=Math.max(Math.abs(x)/.017,Math.abs(y-1.4355)/(y>=1.4355?.005:.006));
 return smooth(1,1.25,d)*(1-smooth(2.3,3,d))*smooth(.048,.058,z);
}
// Filter only the surrounding skin's normals. Accepted lip normals are fixed
// boundary conditions, rather than being flattened along with the face.
export function softenMouthTransition(mesh,cache,THREE,strength){
 strength=Math.max(0,Math.min(1,strength||0));if(!strength||!mesh.geometry.attributes.normal)return;
 const g=mesh.geometry;
 if(!cache.mouthTransitionBinding){
  const ids=[],groups=new Map(),weights=[],p=new THREE.Vector3();
  for(let i=0;i<cache.position.length;i+=3){const key=Array.from(cache.position.subarray(i,i+3),v=>Math.round(v*1e6)).join(':');if(!groups.has(key))groups.set(key,groups.size);ids.push(groups.get(key));p.fromArray(cache.position,i).applyMatrix4(cache.matrix);weights.push(mouthTransitionWeight(p.toArray()));}
  const count=groups.size,links=Array.from({length:count},()=>new Set()),groupWeights=new Float64Array(count),index=g.index.array;
  for(let i=0;i<ids.length;i++)groupWeights[ids[i]]=Math.max(groupWeights[ids[i]],weights[i]);
  for(let j=0;j<index.length;j+=3)for(let k=0;k<3;k++){const a=ids[index[j+k]],b=ids[index[j+(k+1)%3]];if(a!==b){links[a].add(b);links[b].add(a);}}
  cache.mouthTransitionBinding={ids,weights,groupWeights,links,count};
 }
 const {ids,weights,groupWeights,links,count}=cache.mouthTransitionBinding;
 const filter=source=>{
  let sum=new Float64Array(count*3);for(let i=0;i<source.length;i+=3)for(let k=0;k<3;k++)sum[ids[i/3]*3+k]+=source[i+k];
  const normalize=a=>{for(let i=0;i<a.length;i+=3){const l=Math.hypot(a[i],a[i+1],a[i+2]);if(l>1e-20)for(let k=0;k<3;k++)a[i+k]/=l;}return a;};normalize(sum);
  for(let pass=0;pass<24;pass++){const next=sum.slice();for(let a=0;a<count;a++){if(!groupWeights[a])continue;const j=a*3,n=[sum[j],sum[j+1],sum[j+2]],mean=n.slice();let total=1;for(const b of links[a]){const i=b*3;if(n[0]*sum[i]+n[1]*sum[i+1]+n[2]*sum[i+2]<0)continue;for(let k=0;k<3;k++)mean[k]+=sum[i+k];total++;}for(let k=0;k<3;k++)next[j+k]=.25*n[k]+.75*mean[k]/total;}sum=normalize(next);}
  const out=source.slice(),n=new THREE.Vector3();for(let i=0;i<out.length;i+=3){if(!weights[i/3])continue;const j=ids[i/3]*3;n.fromArray(source,i).normalize().lerp(new THREE.Vector3(sum[j],sum[j+1],sum[j+2]),strength*weights[i/3]).normalize();out.set(n.toArray(),i);}return out;
 };
 const original=g.attributes.normal.array.slice(),smoothed=filter(original);g.attributes.normal.array.set(smoothed);g.attributes.normal.needsUpdate=true;
 if(!cache.previewNeutralOnly)for(let t=0;t<(g.morphAttributes.normal||[]).length;t++){
  if(cache.selectedNormalMorphs&&!cache.selectedNormalMorphs.has(t))continue;const attr=g.morphAttributes.normal[t],endpoint=original.map((v,i)=>v+attr.array[i]),target=filter(endpoint);
  for(let i=0;i<target.length;i+=3)if(weights[i/3])for(let k=0;k<3;k++)attr.array[i+k]=target[i+k]-smoothed[i+k];attr.needsUpdate=true;
 }
}
