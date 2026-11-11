const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Extend the mouth's geometric shading style to the skin of the face. The lip
// core is protected: this changes its surroundings, never the accepted mouth.
export function faceSurfaceWeight([x,y,z]){
 const mouthDistance=Math.max(Math.abs(x)/.023,Math.abs(y-1.4355)/.014);
 return smooth(.8,1.4,mouthDistance)*smooth(.005,.04,z)*smooth(1.414,1.435,y)*(1-smooth(1.56,1.60,y))*(1-smooth(.075,.105,Math.abs(x)));
}
export function refreshFaceNormals(mesh,cache,THREE,strength,noseStrength=0){
 strength=Math.max(0,Math.min(1,strength||0));noseStrength=Math.max(0,Math.min(1,noseStrength||0));if(!strength&&!noseStrength)return;
 const g=mesh.geometry;if(!g.attributes.normal)return;
 if(!cache.faceNormalBinding){
  const ids=[],groups=new Map(),weights=[],noseWeights=[],p=new THREE.Vector3();
  for(let i=0;i<cache.position.length;i+=3){const key=Array.from(cache.position.subarray(i,i+3),v=>Math.round(v*1e6)).join(':');if(!groups.has(key))groups.set(key,groups.size);ids.push(groups.get(key));p.fromArray(cache.position,i).applyMatrix4(cache.matrix);weights.push(faceSurfaceWeight(p.toArray()));noseWeights.push(Math.exp(-2*(p.x/.018)**2-2*((p.y-1.492)/.037)**2)*smooth(.035,.055,p.z));}
  const links=Array.from({length:groups.size},()=>new Set()),index=g.index.array;
  for(let t=0;t<index.length;t+=3)for(let k=0;k<3;k++){const a=ids[index[t+k]],b=ids[index[t+(k+1)%3]];if(a!==b){links[a].add(b);links[b].add(a);}}
  cache.faceNormalBinding={ids,weights,noseWeights,links,count:groups.size};
 }
 const {ids,weights,noseWeights,links,count}=cache.faceNormalBinding,index=g.index.array,base=g.attributes.position.array,prior=g.attributes.normal.array.slice();
 const normals=delta=>{
  let sum=new Float64Array(count*3);
  for(let t=0;t<index.length;t+=3){const a=index[t]*3,b=index[t+1]*3,c=index[t+2]*3,at=(i,k)=>base[i+k]+(delta?.[i+k]||0),ux=at(b,0)-at(a,0),uy=at(b,1)-at(a,1),uz=at(b,2)-at(a,2),vx=at(c,0)-at(a,0),vy=at(c,1)-at(a,1),vz=at(c,2)-at(a,2),n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];for(const id of [ids[a/3],ids[b/3],ids[c/3]])for(let k=0;k<3;k++)sum[id*3+k]+=n[k];}
  const normalize=array=>{for(let i=0;i<array.length;i+=3){const l=Math.hypot(array[i],array[i+1],array[i+2]);if(l>1e-20)for(let k=0;k<3;k++)array[i+k]/=l;}return array;};normalize(sum);
  for(let pass=0;pass<6;pass++){const next=sum.slice();for(let i=0;i<count;i++){const at=i*3,n=[sum[at],sum[at+1],sum[at+2]],mean=n.slice();let total=1;for(const b of links[i]){const j=b*3;if(n[0]*sum[j]+n[1]*sum[j+1]+n[2]*sum[j+2]<.35)continue;for(let k=0;k<3;k++)mean[k]+=sum[j+k];total++;}for(let k=0;k<3;k++)next[at+k]=.45*n[k]+.55*mean[k]/total;}sum=normalize(next);}
  return sum;
 };
 const blend=(source,sum,i)=>{const j=ids[i/3]*3,n=new THREE.Vector3(sum[j],sum[j+1],sum[j+2]);if(n.lengthSq()<1e-20)return source;return new THREE.Vector3(...source).normalize().lerp(n.normalize(),weights[i/3]*Math.max(strength,noseStrength*noseWeights[i/3])).normalize().toArray();};
 const neutral=normals(null);for(let i=0;i<base.length;i+=3)if(weights[i/3])g.attributes.normal.array.set(blend(Array.from(prior.subarray(i,i+3)),neutral,i),i);
 if(!cache.previewNeutralOnly)for(let t=0;t<(g.morphAttributes.normal||[]).length;t++){
  if(cache.selectedNormalMorphs&&!cache.selectedNormalMorphs.has(t))continue;
  const attr=g.morphAttributes.normal[t],old=attr.array.slice(),sum=normals(g.morphAttributes.position[t]?.array);
  for(let i=0;i<base.length;i+=3)if(weights[i/3]){const n=blend([prior[i]+old[i],prior[i+1]+old[i+1],prior[i+2]+old[i+2]],sum,i);for(let k=0;k<3;k++)attr.array[i+k]=n[k]-g.attributes.normal.array[i+k];}attr.needsUpdate=true;
 }
 g.attributes.normal.needsUpdate=true;
}
