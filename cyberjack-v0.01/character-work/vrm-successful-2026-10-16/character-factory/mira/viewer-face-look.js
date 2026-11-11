export const lookControls=[['lipColorLift','Смешивание оттенка губ',0,1,.01,0],['lipContourFit','Помада по контуру VRM',0,1,.01,0],['faceSoftness','Мягкость света на лице',0,1,.01,0],['noseLineOpacity','Выраженность носового контура',0,1,.01,1],['eyeShadow','Тени для век',0,1,.01,0],['eyeShadowLower','Тени под нижним веком',0,1,.01,0],['blushHeight','Высота румянца',-1,1,.01,0],['lipDefinition','Чёткий контур помады',0,1,.01,0],['eyeShadowSpread','Размах теней',0,1,.01,0],['lipGloss','Блик на губах',0,1,.01,0]];
const clamp=x=>Math.max(0,Math.min(1,Number(x)||0));
export function lookPigments([x,y,z],values){
 const front=clamp((z-.035)/.020),ax=Math.abs(x);
 const upperShadow=Math.exp(-2*((ax-.045)/(.027+.004*clamp(values.eyeShadowSpread)))**2-2*((y-(1.516-.002*clamp(values.eyeShadowSpread)))/(.009+.007*clamp(values.eyeShadowSpread)))**2)*front*clamp(values.eyeShadow);
 const gloss=Math.exp(-2*(x/.008)**2-2*((y-1.4342)/.00075)**2)*clamp((z-.055)/.008)*clamp(values.lipGloss);
 const lowerShadow=Math.exp(-2*((ax-.045)/(.027+.004*clamp(values.eyeShadowSpread)))**2-2*((y-1.480)/.005)**2)*front*clamp(values.eyeShadowLower);
 return {shadow:Math.max(upperShadow,lowerShadow),gloss};
}
// Face-only fill light: keep pigments, expression masks and material effects,
// but reduce deep directional troughs. Zero retains the original shader.
export function softenFaceMaterial(material,amount){
 amount=clamp(amount);if(!amount)return material;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey?.bind(material);
 material.onBeforeCompile=function(shader,...args){previous?.call(this,shader,...args);shader.uniforms.cjBeautySoftness={value:amount};if(!shader.fragmentShader.includes('uniform float cjBeautySoftness;'))shader.fragmentShader='uniform float cjBeautySoftness;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight = mix(outgoingLight, diffuseColor.rgb * .9, cjBeautySoftness);\n#include <opaque_fragment>');};
 material.customProgramCacheKey=()=>String(key?.()||'')+'|cj-beauty-fill-v12';return material;
}

// Opt-in lip pigment on clay skin. A separate texture carries the rest-space
// lip mask; blending in linear colour allows pigment lighter than dark skin.
export function tintLipMaterial(material,amount,color,mask){
 amount=clamp(amount);if(!amount)return material;
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey?.bind(material);
 material.onBeforeCompile=function(shader,...args){previous?.call(this,shader,...args);
  shader.uniforms.cjLipTintMask={value:mask};shader.uniforms.cjLipTint={value:color};shader.uniforms.cjLipTintStrength={value:amount};
  shader.fragmentShader='uniform sampler2D cjLipTintMask;\nuniform vec3 cjLipTint;\nuniform float cjLipTintStrength;\n'+shader.fragmentShader;
  shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n#ifdef USE_MAP\n diffuseColor.rgb = mix(diffuseColor.rgb, cjLipTint, cjLipTintStrength * texture2D(cjLipTintMask, vMapUv).r);\n diffuseColor.a = opacity;\n#endif');
 };
 material.customProgramCacheKey=()=>String(key?.()||'')+'|cj-lip-tint-v2';return material;
}
