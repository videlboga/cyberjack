import * as T from './vendor/three/three.module.js';
const updates=[];
export function updateOriginalBodyColors(){for(const update of updates)update();}
export async function installOriginalBodyColors(mesh,getSocket,getAppearance=()=>({}),surface=null){
 const response=await fetch('./assets/body-original/color-ratios.f32');if(!response.ok)throw Error('Не удалось загрузить окраску тела');
 const colors=new Float32Array(await response.arrayBuffer());if(colors.length!==mesh.geometry.attributes.position.count*3)throw Error('Окраска не соответствует вершинам тела');
 // Keep the shared skin material as the color authority for body and head.
 const original=mesh.material;mesh.material=new T.MeshStandardMaterial({color:original.color.clone(),vertexColors:true,roughness:original.roughness,metalness:original.metalness,side:T.DoubleSide});let last=null;
 const fill={value:0};mesh.material.onBeforeCompile=shader=>{shader.uniforms.cjBodySkinFill=fill;shader.fragmentShader='uniform float cjBodySkinFill;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight = mix(outgoingLight, diffuseColor.rgb * .9, cjBodySkinFill);\n#include <opaque_fragment>');};mesh.material.customProgramCacheKey=()=> 'shared-skin-fill-v79';surface?.patchMaterial(mesh.material);
 const update=()=>{fill.value=Math.max(0,Math.min(1,Number(getAppearance().faceSoftness)||0));mesh.material.color.copy(original.color);const geometry=mesh.geometry;if(geometry===last)return;const count=geometry.attributes.position.count,mapped=new Float32Array(count*3).fill(1),socket=getSocket?.();
 if(socket&&geometry===socket.geometry){for(let i=0;i<socket.sourceMap.length;i++){mapped.fill(0,i*3,i*3+3);for(const [id,w]of socket.sourceMap[i])for(let k=0;k<3;k++)mapped[i*3+k]+=colors[id*3+k]*w;}}
 else if(count===colors.length/3)mapped.set(colors);else throw Error('Неизвестная геометрия для окраски тела');
 geometry.setAttribute('color',new T.BufferAttribute(mapped,3));surface?.mapGeometry(geometry,socket);last=geometry;};updates.push(update);update();
}
