import {inkStyle,inkWidth} from './viewer-ink-style.js';
export const illustrationState={value:1};
// Soft illustrated lighting, preserving maps and existing material color hooks.
export function referenceShading(material,{hair=false,skin=false}={}){
 const previous=material.onBeforeCompile,oldKey=material.customProgramCacheKey.bind(material);
 const key=oldKey();material.onBeforeCompile=shader=>{previous.call(material,shader);if(shader.fragmentShader.includes('float illustrationLight='))return;shader.uniforms.illustrationEnabled=illustrationState;shader.uniforms.referenceInkEnabled=inkStyle;shader.uniforms.referenceInkWidth=inkWidth;shader.fragmentShader='uniform float illustrationEnabled;\nuniform float referenceInkEnabled;\nuniform float referenceInkWidth;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
 float illustrationLight=dot(normal,normalize(vec3(-0.35,0.65,0.72)));
 float illustrationShade=smoothstep(0.08,0.25,illustrationLight);
 vec3 illustrationTint=mix(${skin?'vec3(0.83,0.68,0.72)':hair?'vec3(0.68,0.69,0.79)':'vec3(0.68,0.77,0.82)'},vec3(1.0,0.985,0.965),illustrationShade);
 vec3 illustrationOriginal=outgoingLight;
 outgoingLight=diffuseColor.rgb*illustrationTint;
 ${skin?`// Preserve gradual normal variation inside each cel region.
 float skinForm=0.82+0.18*smoothstep(-0.35,0.95,illustrationLight);
 vec3 skinRatio=illustrationOriginal/max(diffuseColor.rgb,vec3(0.035));
 float skinOriginalValue=dot(skinRatio,vec3(0.2126,0.7152,0.0722));
 float skinDetail=0.88+0.20*skinOriginalValue/(1.0+skinOriginalValue);
 outgoingLight*=skinForm*skinDetail;
 vec3 skinHalf=normalize(normalize(vec3(-0.35,0.65,0.72))+vec3(0.0,0.0,1.0));
 float skinAccent=pow(max(dot(normal,skinHalf),0.0),28.0);
 outgoingLight+=vec3(0.065,0.045,0.035)*skinAccent*illustrationShade;`:''}
 ${hair?'float illustrationGlint=smoothstep(0.68,0.81,illustrationLight)*(1.0-smoothstep(0.86,0.97,illustrationLight)); outgoingLight+=vec3(0.042,0.045,0.060)*illustrationGlint;':''}
 outgoingLight=mix(illustrationOriginal,outgoingLight,illustrationEnabled);
 ${skin?`// View-dependent grazing contours also reveal interior body forms.
 float skinFacing=abs(dot(normal,normalize(vViewPosition)));
 float skinInk=1.0-smoothstep(0.0,max(fwidth(skinFacing)*1.1*referenceInkWidth,0.003),skinFacing);
 outgoingLight=mix(outgoingLight,vec3(0.19,0.065,0.085),skinInk*referenceInkEnabled*0.85);`:''}
 #include <opaque_fragment>`);};
 material.customProgramCacheKey=()=>key+'-illustration-soft-ink7-'+hair+'-'+skin;material.toneMapped=false;material.needsUpdate=true;return material;
}
