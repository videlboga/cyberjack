import * as T from './vendor/three/three.module.js';
// A lock has a charcoal exterior and a rose underside, on the same surface.
export function createMiraRibbonMaterial(){
 const material=new T.MeshStandardMaterial({color:0xffffff,side:T.DoubleSide,roughness:.78,metalness:0});
 material.onBeforeCompile=shader=>{shader.vertexShader='attribute float miraUnderside;\nvarying float vMiraUnderside;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMiraUnderside = miraUnderside;');shader.uniforms.miraOuter={value:new T.Color('#45464f')};shader.uniforms.miraInner={value:new T.Color('#e9a0b3')};shader.fragmentShader='uniform vec3 miraOuter;\nuniform vec3 miraInner;\nvarying float vMiraUnderside;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= gl_FrontFacing ? miraOuter : mix(miraOuter, miraInner, vMiraUnderside);');};
 material.customProgramCacheKey=()=> 'mira-charcoal-rose-v2';return material;
}
