import {ClampToEdgeWrapping} from 'three';
import {patternGroups} from './native-face-patterns.mjs';
import {PORTRAIT_PROFILES} from './portrait-profiles.mjs';
const cache=new WeakMap(),irisCache=new WeakMap();
function irisTextures(vrm){if(irisCache.has(vrm))return irisCache.get(vrm);const maps=[],seen=new Set();vrm.scene.traverse(m=>{for(const material of (Array.isArray(m.material)?m.material:[m.material])){if(!material||seen.has(material)||!/hitomi/i.test(material.name||''))continue;seen.add(material);for(const key of ['map','shadeMultiplyTexture']){const original=material[key];if(!original)continue;const texture=original.clone();material[key]=texture;maps.push({texture,repeat:original.repeat.clone(),offset:original.offset.clone(),wrapS:original.wrapS,wrapT:original.wrapT});material.needsUpdate=true;}}});irisCache.set(vrm,maps);return maps;}
function bindings(vrm){if(cache.has(vrm))return cache.get(vrm);const meshes=[],seen=new Set();vrm.scene.traverse(m=>{if(!m.morphTargetDictionary||!m.morphTargetInfluences||seen.has(m.morphTargetInfluences))return;seen.add(m.morphTargetInfluences);const owned=[...new Set(Object.entries(m.morphTargetDictionary).filter(([n])=>/^(Eye |Mouth |Eyebrow |Tears )/.test(n)).map(([,i])=>i))];if(owned.length)meshes.push({m,owned,mouthIds:new Set(Object.entries(m.morphTargetDictionary).filter(([n])=>n.startsWith('Mouth ')).map(([,i])=>i))});});cache.set(vrm,meshes);return meshes;}
export function clearNativeMoodFace(vrm){for(const {m,owned}of bindings(vrm))for(const i of owned)m.morphTargetInfluences[i]=0;}
export function applyNativeMoodFace(vrm,weights,{strength=1,blink=0,speechActive=false}={}){
 const meshes=bindings(vrm);if(!meshes.length)return false;
 for(const {m,owned,mouthIds}of meshes)for(const i of owned){if(speechActive&&mouthIds.has(i))continue;m.morphTargetInfluences[i]=0;}
 const add=(name,value)=>{if(!name||value<=0)return;for(const {m}of meshes){const i=m.morphTargetDictionary[name];if(i!==undefined)m.morphTargetInfluences[i]=Math.min(1,m.morphTargetInfluences[i]+value);}};
 let iris=1;for(const [name,weight]of Object.entries(weights))iris+=((PORTRAIT_PROFILES[name]?.iris??1)-1)*weight*Math.min(1,strength);iris=Math.max(.5,Math.min(1,iris));for(const {texture,repeat,offset,wrapS,wrapT}of irisTextures(vrm)){texture.repeat.copy(repeat).divideScalar(iris);texture.offset.copy(offset).addScaledVector(repeat,(1-1/iris)/2);const s=iris<.999?ClampToEdgeWrapping:wrapS,t=iris<.999?ClampToEdgeWrapping:wrapT;if(texture.wrapS!==s||texture.wrapT!==t){texture.wrapS=s;texture.wrapT=t;texture.needsUpdate=true;}texture.updateMatrix();}
 const total=Math.max(1,Object.values(weights).reduce((a,b)=>a+b,0));
 for(const [name,weight]of Object.entries(weights)){const p=PORTRAIT_PROFILES[name];if(!p||weight<1e-5)continue;const gain=Math.min(1,strength)*weight/total;
 for(const [group,key]of [['Eye','eye'],['Eyebrow','brow'],['Mouth','mouth']]){if(group==='Mouth'&&speechActive)continue;const pattern=patternGroups[group][p[key]]||patternGroups[group]['デフォルト'];if(!pattern)continue;if(group==='Eyebrow')add(pattern.open,gain);else{const amount=group==='Eye'?p.eyes*(1-blink):p.open;const base=group==='Mouth'?1-(p.tongue||0):1;add(pattern.open,gain*amount*base);add(pattern.closed,gain*(1-amount)*base);if(group==='Mouth'&&p.tongue){const tongue=patternGroups.Mouth['舌出し口開け'];add(tongue.open,gain*p.tongue);}}}
 add('Tears small',p.tears*gain);
 // Bounded corrective extrapolation of closure, only while the eye is open.
 // Native eye patterns stop at the resting aperture; fear refs exceed it.
 if(p.eyeWide){for(const {m}of meshes){const index=m.morphTargetDictionary['Eye 両目閉じ'];if(index!==undefined)m.morphTargetInfluences[index]=Math.max(-.3,m.morphTargetInfluences[index]-Math.min(.3,p.eyeWide)*gain*(1-blink));}} 
 }
 return true;
}
