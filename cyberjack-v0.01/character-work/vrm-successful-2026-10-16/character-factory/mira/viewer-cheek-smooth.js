const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
// Weld material/UV splits for one continuous skin patch. Apply the same linear
// filter to rest positions and morph deltas so expressions retain continuity.
export function smoothCheekMesh(mesh,cache,THREE,amount,chinAmount=0){
 amount=Math.max(0,Math.min(1,amount||0));chinAmount=Math.max(0,Math.min(1,chinAmount||0));if(!amount&&!chinAmount)return;
 const g=mesh.geometry,base=g.attributes.position.array,index=g.index.array;
 if(!cache.cheekSmoothBinding){
  const groups=new Map(),ids=[],vertices=[],weights=[],chinWeights=[],p=new THREE.Vector3();
  for(let i=0;i<cache.position.length;i+=3){const key=Array.from(cache.position.subarray(i,i+3),v=>Math.round(v*1e6)).join(':');let id=groups.get(key);if(id===undefined){id=vertices.length;groups.set(key,id);vertices.push([]);p.fromArray(cache.position,i).applyMatrix4(cache.matrix);weights.push(smooth(.032,.052,Math.abs(p.x))*smooth(1.413,1.431,p.y)*(1-smooth(1.459,1.480,p.y))*smooth(-.035,.005,p.z));chinWeights.push((1-smooth(.018,.040,Math.abs(p.x)))*smooth(1.394,1.407,p.y)*(1-smooth(1.419,1.431,p.y))*smooth(.005,.025,p.z));}ids.push(id);vertices[id].push(i/3);}
  const links=vertices.map(()=>new Set());for(let t=0;t<index.length;t+=3)for(let k=0;k<3;k++){const a=ids[index[t+k]],b=ids[index[t+(k+1)%3]];if(a!==b){links[a].add(b);links[b].add(a);}}
  cache.cheekSmoothBinding={ids,vertices,cheekWeights:weights,chinWeights,links};
 }
 const {ids,vertices,cheekWeights,chinWeights,links}=cache.cheekSmoothBinding,count=vertices.length,weights=cheekWeights.map((v,i)=>Math.max(v*amount,chinWeights[i]*chinAmount));cache.cheekSmoothBinding.weights=weights;
 const filter=src=>{let q=new Float64Array(count*3);for(let i=0;i<count;i++)for(const v of vertices[i])for(let k=0;k<3;k++)q[i*3+k]+=src[v*3+k]/vertices[i].length;
  for(let pass=0;pass<8;pass++){const next=q.slice();for(let i=0;i<count;i++){const w=weights[i]*.48;if(!w||!links[i].size)continue;for(let k=0;k<3;k++){let mean=0;for(const j of links[i])mean+=q[j*3+k];next[i*3+k]+=w*(mean/links[i].size-q[i*3+k]);}}q=next;}
  const out=src.slice();for(let i=0;i<ids.length;i++)if(weights[ids[i]])out.set(q.subarray(ids[i]*3,ids[i]*3+3),i*3);return out;
 };
 const normals=pos=>{const out=new Float64Array(count*3);for(let t=0;t<index.length;t+=3){const a=index[t]*3,b=index[t+1]*3,c=index[t+2]*3,ux=pos[b]-pos[a],uy=pos[b+1]-pos[a+1],uz=pos[b+2]-pos[a+2],vx=pos[c]-pos[a],vy=pos[c+1]-pos[a+1],vz=pos[c+2]-pos[a+2],n=[uy*vz-uz*vy,uz*vx-ux*vz,ux*vy-uy*vx];for(const v of [a/3,b/3,c/3])for(let k=0;k<3;k++)out[ids[v]*3+k]+=n[k];}for(let i=0;i<count;i++){const l=Math.hypot(...out.subarray(i*3,i*3+3));if(l>1e-20)for(let k=0;k<3;k++)out[i*3+k]/=l;}return out;};
 const correct=(prior,before,after)=>{const out=prior.slice();for(let i=0;i<ids.length;i++)if(weights[ids[i]]){const j=ids[i]*3,n=[0,1,2].map(k=>prior[i*3+k]+after[j+k]-before[j+k]),l=Math.hypot(...n);if(l>1e-20)out.set(n.map(v=>v/l),i*3);}return out;};
 const old=base.slice(),oldN=g.attributes.normal?.array.slice(),filtered=filter(old);base.set(filtered);g.attributes.position.needsUpdate=true;
 let newN=oldN;if(oldN){newN=correct(oldN,normals(old),normals(filtered));g.attributes.normal.array.set(newN);g.attributes.normal.needsUpdate=true;}
 if(cache.previewNeutralOnly)return;
 for(let t=0;t<(g.morphAttributes.position||[]).length;t++){
  if(cache.selectedNormalMorphs&&!cache.selectedNormalMorphs.has(t))continue;
  const attr=g.morphAttributes.position[t],delta=attr.array.slice(),next=filter(delta);attr.array.set(next);attr.needsUpdate=true;
  const nattr=g.morphAttributes.normal?.[t];if(!nattr||!oldN)continue;
  const a=Float64Array.from(old,(v,i)=>v+delta[i]),b=Float64Array.from(filtered,(v,i)=>v+next[i]),prior=Float64Array.from(oldN,(v,i)=>v+nattr.array[i]),posed=correct(prior,normals(a),normals(b));for(let i=0;i<posed.length;i++)nattr.array[i]=posed[i]-newN[i];nattr.needsUpdate=true;
 }
}
