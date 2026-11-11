import {LashSkinSurface} from './lash-skin-surface.js?v=kate75';
import * as THREE from 'three';
// Surface bindings stay on the rendered alpha contour of native lid meshes.
// Morph/skinning positions are sampled each frame, so blink and identity edits
// carry the lash roots and their curl frame together.
export function lashAnchors(head,mesh,lower=false,density=0,variation=0){
 const cache=head.faceEditor?.cache.get(mesh),uv=mesh.geometry.attributes.uv,ix=mesh.geometry.index?.array,texture=[].concat(mesh.material).find(m=>m.map?.image)?.map;
 if(!cache||!uv||!ix||!texture||typeof document==='undefined')return [];
 const canvas=document.createElement('canvas');canvas.width=texture.image.width;canvas.height=texture.image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0);const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data,candidates=[],p=new THREE.Vector3();
 // Keep only the principal connected alpha island. A disconnected crease
 // must never be treated as a lash root, even if it is a column's only ink.
 const labels=new Int32Array(canvas.width*canvas.height),queue=new Int32Array(labels.length);let label=0,largest=0,largestSize=0;
 for(let start=0;start<labels.length;start++){if(labels[start]||pixels[start*4+3]<160)continue;label++;let read=0,write=1;queue[0]=start;labels[start]=label;
  while(read<write){const id=queue[read++],x=id%canvas.width,y=Math.floor(id/canvas.width);for(const next of [x>0?id-1:-1,x<canvas.width-1?id+1:-1,y>0?id-canvas.width:-1,y<canvas.height-1?id+canvas.width:-1]){if(next<0||labels[next]||pixels[next*4+3]<160)continue;labels[next]=label;queue[write++]=next;}}
  if(write>largestSize){largestSize=write;largest=label;}
 }
 for(let j=0;j<ix.length;j+=3){const ids=[ix[j],ix[j+1],ix[j+2]];for(let a=0;a<=16;a++)for(let b=0;b<=16-a;b++){
  const weights=[a/16,b/16,1-(a+b)/16];let u=0,v=0;p.set(0,0,0);
  for(let k=0;k<3;k++){const id=ids[k];p.x+=cache.position[id*3]*weights[k];p.y+=cache.position[id*3+1]*weights[k];p.z+=cache.position[id*3+2]*weights[k];u+=uv.getX(id)*weights[k];v+=uv.getY(id)*weights[k];}
  const px=Math.max(0,Math.min(canvas.width-1,Math.floor(u*canvas.width))),py=Math.max(0,Math.min(canvas.height-1,Math.floor((texture.flipY?1-v:v)*canvas.height)));if(labels[py*canvas.width+px]!==largest)continue;
  p.applyMatrix4(cache.matrix);if(Math.abs(p.x)<.015||Math.abs(p.x)>.073)continue;candidates.push({mesh,ids,weights,rest:p.clone()});
 }}
 const result=[];
 for(const side of [-1,1])for(let i=0,count=lower?Math.round(5+4*density):Math.round(9+9*density);i<count;i++){
  const t=(i+.5+variation*.25*Math.sin(i*2.17+side*.9))/count,x=side*(lower?.019+.047*t:.025+.037*t),near=candidates.filter(c=>c.rest.x*side>0&&Math.abs(c.rest.x-x)<.0018);if(!near.length)continue;
  // Main liner edge only; detached alpha islands have been excluded.
  near.sort((a,b)=>a.rest.y-b.rest.y);const targetY=near[Math.floor((near.length-1)*(lower?.3:.7))].rest.y;near.sort((a,b)=>2*Math.abs(a.rest.x-x)+Math.abs(a.rest.y-targetY)-(2*Math.abs(b.rest.x-x)+Math.abs(b.rest.y-targetY)));const root=near[0];result.push({root,side,t,lower});
 }
 return result;
}
export class VolumeLashes{
 constructor(head,values){
  this.head=head;this.face=head.socketMesh;this.amount=values.lashVolume;this.length=values.lashLength||0;this.fan=values.lashVolumeFan||0;this.thickness=values.lashVolumeThickness||0;this.variation=values.lashVolumeVariation||0;this.bindings=[];this.temp=new THREE.Vector3();this.transforms=new Map();
  for(const [mesh,source]of head.originalMaterials){const name=[].concat(source).find(m=>m.name?.includes('cf_m_eyeline_00_up'))?.name;if(name)this.bindings.push(...lashAnchors(head,mesh,false,values.lashVolumeDensity||0,this.variation));}
  this.groups=new Map();for(let i=0;i<this.bindings.length;i++){const b=this.bindings[i];if(!this.groups.has(b.side))this.groups.set(b.side,[]);this.groups.get(b.side).push(i);}for(const group of this.groups.values())group.sort((a,b)=>this.bindings[a].t-this.bindings[b].t);
  this.surface=new LashSkinSurface(head);this.rings=8;this.sides=5;this.tubeCount=this.bindings.length*this.rings*this.sides;
  this.geometry=new THREE.BufferGeometry();this.geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array((this.tubeCount+this.bindings.length*2)*3),3));const indices=[];
  for(let n=0;n<this.bindings.length;n++)for(let r=0;r<this.rings-1;r++)for(let s=0;s<this.sides;s++){const a=(n*this.rings+r)*this.sides+s,b=(n*this.rings+r)*this.sides+(s+1)%this.sides,c=a+this.sides,d=b+this.sides;indices.push(a,c,b,b,c,d);}
  // Depth bridge at the same margin joins every lash root to its source band.
  for(const group of this.groups.values())for(let j=0;j<group.length-1;j++){const a=this.tubeCount+group[j]*2,b=this.tubeCount+group[j+1]*2;indices.push(a,b,a+1,a+1,b,b+1);}this.geometry.setIndex(indices);
  this.material=new THREE.MeshStandardMaterial({name:'Volume lashes · rigid curves',color:values.lashColor||'#542b36',roughness:.8,metalness:0,side:THREE.DoubleSide});this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.name='Parametric volume lashes';this.mesh.frustumCulled=false;this.face.add(this.mesh);this.update();
 }
 sample(anchor){let matrix=this.transforms.get(anchor.mesh);if(!matrix){anchor.mesh.updateWorldMatrix(true,false);matrix=new THREE.Matrix4().copy(this.face.matrixWorld).invert().multiply(anchor.mesh.matrixWorld);this.transforms.set(anchor.mesh,matrix);}const p=new THREE.Vector3();for(let k=0;k<3;k++){anchor.mesh.getVertexPosition(anchor.ids[k],this.temp);p.addScaledVector(this.temp,anchor.weights[k]);}return p.applyMatrix4(matrix);}
 // Measure each lid independently against its own neutral and closed pose.
 // This follows partial closure and winks without guessing from a clip name.
 lidClosure(group,raw){
  let descent=0,travel=0;
  for(const i of group){const b=this.bindings[i];if(b.t<.22||b.t>.78)continue;
   const mesh=b.root.mesh,position=mesh.geometry.attributes.position,index=mesh.morphTargetDictionary?.['Eye 両目閉じ'],closed=mesh.geometry.morphAttributes.position?.[index];if(!closed)continue;
   const base=new THREE.Vector3(),end=new THREE.Vector3();
   for(let k=0;k<3;k++){const id=b.root.ids[k],weight=b.root.weights[k],p=new THREE.Vector3().fromBufferAttribute(position,id),d=new THREE.Vector3().fromBufferAttribute(closed,id);const q=mesh.geometry.morphTargetsRelative?p.clone().add(d):d;if(mesh.isSkinnedMesh){mesh.applyBoneTransform(id,p);mesh.applyBoneTransform(id,q);}base.addScaledVector(p,weight);end.addScaledVector(q,weight);}
   const matrix=this.transforms.get(mesh);base.applyMatrix4(matrix);end.applyMatrix4(matrix);const distance=base.y-end.y;if(distance<.001)continue;descent+=base.y-raw[i].y;travel+=distance;
  }
  return travel?THREE.MathUtils.clamp(descent/travel,0,1):0;
 }
 update(){
  this.face.updateWorldMatrix(true,false);this.transforms.clear();this.surface.update();const out=this.geometry.attributes.position.array,raw=this.bindings.map(b=>this.sample(b.root));
  for(const group of this.groups.values()){const closure=this.lidClosure(group,raw),pitch=.18+closure*closure*1.25;for(let j=0;j<group.length;j++){
   const i=group[j],b=this.bindings[i],root=raw[i],tangent=raw[group[Math.min(group.length-1,j+1)]].clone().sub(raw[group[Math.max(0,j-1)]]);tangent.z=0;if(tangent.lengthSq()<1e-10)tangent.set(b.side,0,0);tangent.normalize();
   const upright=new THREE.Vector3(-tangent.y,tangent.x,0).multiplyScalar(b.side),depth=new THREE.Vector3(0,0,1),outside=upright.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(depth,Math.sin(pitch)),forward=depth.clone().multiplyScalar(Math.cos(pitch)).addScaledVector(upright,-Math.sin(pitch));b.hidden=root.z<-.015;b.closure=closure;
   // Stable, authored-looking clusters: one long thick strand and smaller
   // neighbours, with different phases on each eye. No time-based randomness.
   const phase=(j+(b.side>0?1:0))%3,pattern=[1.16,.69,.94][phase],variation=this.variation;
   const envelope=.75+.25*Math.sin(Math.PI*b.t),length=.0060*(.75+.4*this.amount)*(1+.2*this.length)*envelope*(1+this.fan*.18*b.t)*(1+.08*Math.sin(b.t*37))*(1+variation*(pattern-1)+variation*.045*Math.sin(j*1.71+b.side*1.3)),width=.00058*(.7+.4*this.amount)*(1+.9*this.thickness)*(1+variation*([.2,-.15,.02][phase])),sweep=(b.t-.5)*.7+this.fan*.4*(b.t-.2)+variation*([.13,-.08,-.12][phase]+.025*b.side),start=i*this.rings*this.sides*3;let at=start,shift=0;
   for(let r=0;r<this.rings;r++){const u=r/(this.rings-1),centre=root.clone().addScaledVector(outside,length*(u-.25*u*u)).addScaledVector(forward,.00012+length*(.32*u+.42*u*u)).addScaledVector(tangent,length*sweep*u),radius=width*Math.pow(1-u,.85)+.000004;
    for(let s=0;s<this.sides;s++){const a=s/this.sides*Math.PI*2,p=centre.clone().addScaledVector(tangent,radius*Math.cos(a)).addScaledVector(forward,radius*.28*Math.sin(a));out.set((b.hidden?root:p).toArray(),at);at+=3;
     if(!b.hidden){const before=p.z;this.surface.lift(p,.00012);shift=Math.max(shift,p.z-before);}
    }
   }
   // Uniform translation preserves every segment and the complete curl. The
   // old per-vertex projection bent lashes into hooks and split their roots.
   if(!b.hidden)for(let k=start+2;k<at;k+=3)out[k]+=shift;
   b.rootPosition=root.clone().addScaledVector(forward,b.hidden?0:.00012).addScaledVector(depth,b.hidden?0:shift);b.contactShift=shift;
   out.set(root.toArray(),(this.tubeCount+i*2)*3);out.set(b.rootPosition.toArray(),(this.tubeCount+i*2+1)*3);
  }
  }
  this.geometry.attributes.position.needsUpdate=true;this.geometry.computeVertexNormals();
 }
 dispose(){this.mesh.removeFromParent();this.geometry.dispose();this.material.dispose();}
}
