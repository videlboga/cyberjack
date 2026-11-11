import {faceSurfaceWeight} from './viewer-face-normals.js';
const fade=t=>t*t*t*(t*(t*6-15)+10),mix=(a,b,t)=>a+(b-a)*t;
function hash(x,y,z){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295*2-1;}
function noise(x,y,z){const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z),u=fade(x-a),v=fade(y-b),w=fade(z-c);const plane=k=>mix(mix(hash(a,b,k),hash(a+1,b,k),u),mix(hash(a,b+1,k),hash(a+1,b+1,k),u),v);return mix(plane(c),plane(c+1),w);}
const height=([x,y,z])=>.0012*noise(x/.022+7.3,y/.022-41.9,z/.022+11.1)+.00045*noise(x/.009-12.7,y/.009+3.2,z/.009+8.6);
export function skinGradient(p){const e=.00005,g=[];for(let k=0;k<3;k++){const a=p.slice(),b=p.slice();a[k]+=e;b[k]-=e;g.push((height(a)-height(b))/(2*e));}const l=Math.hypot(...g);return l>.5?g.map(v=>v*.5/l):g;}
export function skinIrregularityWeight([x,y,z]){
 const eye=Math.hypot((Math.abs(x)-.041)/.030,(y-1.493)/.019),t=Math.max(0,Math.min(1,(eye-1)/.55));
 return faceSurfaceWeight([x,y,z])*fade(t);
}
// Object/rest-space normal relief, with no displacement and no colour noise.
// It stays attached to the skin; mouth core, eyelids, ears and neck are masked.
export function applySkinIrregularity(mesh,cache,THREE,strength){
 strength=Math.max(0,Math.min(1,strength||0));if(!strength||!mesh.geometry.attributes.normal)return;
 const g=mesh.geometry,normal=g.attributes.normal.array,prior=normal.slice(),toWorld=new THREE.Matrix3().getNormalMatrix(cache.matrix),toLocal=toWorld.clone().invert(),p=new THREE.Vector3(),n=new THREE.Vector3(),gradient=new THREE.Vector3();
 if(!cache.skinIrregularityBinding){const weights=[],gradients=[];for(let i=0;i<cache.position.length;i+=3){p.fromArray(cache.position,i).applyMatrix4(cache.matrix);const point=p.toArray(),w=skinIrregularityWeight(point);weights.push(w);gradients.push(w?skinGradient(point):[0,0,0]);}cache.skinIrregularityBinding={weights,gradients};}
 const {weights,gradients}=cache.skinIrregularityBinding;
 const perturb=(source,i)=>{n.fromArray(source).applyMatrix3(toWorld).normalize();gradient.fromArray(gradients[i/3]);gradient.addScaledVector(n,-gradient.dot(n));return n.addScaledVector(gradient,-strength*weights[i/3]).normalize().applyMatrix3(toLocal).normalize().toArray();};
 for(let i=0;i<normal.length;i+=3)if(weights[i/3])normal.set(perturb(prior.subarray(i,i+3),i),i);
 if(!cache.previewNeutralOnly)for(let t=0;t<(g.morphAttributes.normal||[]).length;t++){
  if(cache.selectedNormalMorphs&&!cache.selectedNormalMorphs.has(t))continue;
  const attr=g.morphAttributes.normal[t],old=attr.array.slice();for(let i=0;i<normal.length;i+=3)if(weights[i/3]){const endpoint=perturb([prior[i]+old[i],prior[i+1]+old[i+1],prior[i+2]+old[i+2]],i);for(let k=0;k<3;k++)attr.array[i+k]=endpoint[k]-normal[i+k];}attr.needsUpdate=true;
 }
 g.attributes.normal.needsUpdate=true;
}
