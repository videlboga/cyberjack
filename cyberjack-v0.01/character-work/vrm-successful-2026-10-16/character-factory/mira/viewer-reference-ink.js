import {inkWidth as outlineWidth} from './viewer-ink-style.js';
import * as T from './vendor/three/three.module.js';
// Thin inverted hulls share current geometry; no extra simulation or copies.
export function createReferenceInk(source){
 if(source.isSkinnedMesh||source.isInstancedMesh||!source.geometry?.attributes.normal||source.geometry.attributes.miraUnderside)return null;
 const hair=Boolean(source.geometry.attributes.miraUnderside),color=hair?'#302d3c':'#76535c',resolution=new T.Vector2(),widthUniform={value:hair?.65:.75};
 const material=new T.MeshBasicMaterial({color,side:T.BackSide,depthWrite:false,toneMapped:false});
 material.onBeforeCompile=shader=>{shader.uniforms.inkResolution={value:resolution};shader.uniforms.inkWidth=widthUniform;shader.vertexShader='uniform vec2 inkResolution;\nuniform float inkWidth;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>',`#include <project_vertex>
 vec3 inkNormal=normalize(normalMatrix*normal);
 float inkLength=length(inkNormal.xy);
 if(inkLength>0.0001)gl_Position.xy+=inkNormal.xy/inkLength*inkWidth*2.0/inkResolution*gl_Position.w;
 gl_Position.z+=0.00001*gl_Position.w;`);};
 source.userData.cjGpuSkin?.patchMaterial(material);
 const ink=new T.Mesh(source.geometry,material);ink.userData.referenceInk=true;ink.frustumCulled=false;ink.renderOrder=-1;ink.onBeforeRender=renderer=>{renderer.getDrawingBufferSize(resolution);widthUniform.value=(hair?.65:.75)*outlineWidth.value;ink.geometry=source.geometry;};source.add(ink);return ink;
}
