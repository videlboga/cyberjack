// Shared, root-to-tip silk finish. Height-based light bands stay continuous
// across fringe and back layers even when their guide lengths differ.
export function applyHairFinish(material,enabled){
 const old=material.userData.cjHairSilk;
 if(Boolean(old)===enabled)return;
 if(!enabled){material.onBeforeCompile=old.compile;material.customProgramCacheKey=old.cache;material.roughness=old.roughness;delete material.userData.cjHairSilk;material.needsUpdate=true;return;}
 const state={compile:material.onBeforeCompile,cache:material.customProgramCacheKey,roughness:material.roughness};material.userData.cjHairSilk=state;material.roughness=.48;
 material.onBeforeCompile=(shader,renderer)=>{
  state.compile?.call(material,shader,renderer);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 cjHairUv;\nvarying float cjHairHeight;').replace('#include <begin_vertex>','#include <begin_vertex>\ncjHairUv=uv;\ncjHairHeight=position.z;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 cjHairUv;\nvarying float cjHairHeight;').replace('#include <color_fragment>',`#include <color_fragment>
   float cjAcross=cjHairUv.x*6.2831853;
   float cjFibre=sin(cjAcross*31.0+sin(cjHairUv.y*35.0)*.35)*.012+sin(cjAcross*57.0-cjHairUv.y*9.0)*.007;
   float cjEdge=pow(abs(cos(cjAcross)),.8);
   float cjTip=1.0-smoothstep(-.15,.12,cjHairHeight);
   vec3 cjTone=mix(vec3(.89,.88,.94),vec3(1.16,1.07,1.23),cjTip);
   float cjBand=1.0-smoothstep(.004,.012,abs(cjHairHeight-.106+.0018*sin(cjAcross*3.0)));
   diffuseColor.rgb*=cjTone*(1.0-.10*cjEdge+cjFibre);
   diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*1.45+vec3(.012,.008,.018),cjBand*.30);
  `);
 };
 material.customProgramCacheKey=()=>String(state.cache?.call(material)||'')+'|cj-hair-silk-v1';material.needsUpdate=true;
}
