import * as THREE from 'three';
// Split selected edges conformingly, retaining original vertex IDs and groups.
// Midpoints carry UVs, every expression delta and merged skin influences.
export function refineMouth(mesh,passes=2){
 const g=mesh.geometry,world=mesh.matrixWorld,p=new THREE.Vector3();
 for(let pass=0;pass<passes;pass++){
  const pos=g.attributes.position,index=Array.from(g.index.array),inside=[];
  for(let i=0;i<pos.count;i++){p.fromBufferAttribute(pos,i).applyMatrix4(world);inside.push(Math.abs(p.x)<.026&&Math.abs(p.y-1.4355)<.017&&p.z>.048);}
  const edges=new Map(),pairs=[];const key=(a,b)=>a<b?a+':'+b:b+':'+a;
  for(let i=0;i<index.length;i+=3){const tri=index.slice(i,i+3);if(!tri.every(v=>inside[v]))continue;for(let j=0;j<3;j++){const a=tri[j],b=tri[(j+1)%3],k=key(a,b);if(!edges.has(k)){edges.set(k,pos.count+pairs.length);pairs.push([a,b]);}}}
  if(!pairs.length)return;
  const skin=[];
  if(g.attributes.skinIndex)for(const [a,b] of pairs){const weights=new Map();for(const id of [a,b])for(let k=0;k<4;k++){const bone=g.attributes.skinIndex.array[id*4+k],w=g.attributes.skinWeight.array[id*4+k]*.5;weights.set(bone,(weights.get(bone)||0)+w);}const sorted=[...weights].sort((a,b)=>b[1]-a[1]).slice(0,4),sum=sorted.reduce((s,v)=>s+v[1],0);skin.push(Array.from({length:4},(_,k)=>sorted[k]?[sorted[k][0],sorted[k][1]/sum]:[0,0]));}
  const extend=(attr,name)=>{const size=attr.itemSize,out=new attr.array.constructor((pos.count+pairs.length)*size);out.set(attr.array);pairs.forEach(([a,b],j)=>{for(let k=0;k<size;k++)out[(pos.count+j)*size+k]=name==='skinIndex'?skin[j][k][0]:name==='skinWeight'?skin[j][k][1]:(attr.array[a*size+k]+attr.array[b*size+k])*.5;});return new THREE.BufferAttribute(out,size,attr.normalized);};
  const attrs=Object.entries(g.attributes).map(([name,a])=>[name,extend(a,name)]),morphs=Object.entries(g.morphAttributes).map(([name,list])=>[name,list.map(a=>extend(a,name))]);
  const out=[],groups=[],originalGroups=g.groups.length?g.groups:[{start:0,count:index.length,materialIndex:0}];
  for(const group of originalGroups){const start=out.length;for(let i=group.start;i<group.start+group.count;i+=3){let v=index.slice(i,i+3),m=v.map((a,j)=>edges.get(key(a,v[(j+1)%3]))),n=m.filter(x=>x!==undefined).length;
   if(!n)out.push(...v);
   else if(n===3)out.push(v[0],m[0],m[2],m[0],v[1],m[1],m[2],m[1],v[2],m[0],m[1],m[2]);
   else{const r=n===1?m.findIndex(x=>x!==undefined):(m.findIndex(x=>x===undefined)+1)%3;v=[v[r],v[(r+1)%3],v[(r+2)%3]];m=[m[r],m[(r+1)%3],m[(r+2)%3]];if(n===1)out.push(v[0],m[0],v[2],m[0],v[1],v[2]);else out.push(v[1],m[1],m[0],v[0],m[0],v[2],m[0],m[1],v[2]);}
  }groups.push({start,count:out.length-start,materialIndex:group.materialIndex});}
  for(const [name,a] of attrs)g.setAttribute(name,a);for(const [name,list] of morphs)g.morphAttributes[name]=list;g.setIndex(out);g.clearGroups();for(const group of groups)g.addGroup(group.start,group.count,group.materialIndex);
 }
 g.computeBoundingBox();g.computeBoundingSphere();
}
