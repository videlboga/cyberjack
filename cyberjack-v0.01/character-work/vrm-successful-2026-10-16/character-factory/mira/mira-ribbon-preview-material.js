import {inkStyle,inkWidth} from './viewer-ink-style.js';
import {referenceShading} from './viewer-reference-shading.js?v=ink-width8';
import * as T from './vendor/three/three.module.js';
// A lock has a charcoal exterior and a rose underside, on the same surface.
export function createMiraRibbonMaterial(){
 const material=new T.MeshStandardMaterial({color:0xffffff,side:T.DoubleSide,roughness:.78,metalness:0,alphaToCoverage:true});
 material.onBeforeCompile=shader=>{shader.uniforms.ribbonInk=inkStyle;shader.uniforms.ribbonInkWidth=inkWidth;shader.vertexShader='attribute float miraUnderside;\nattribute vec2 miraEdge;\nattribute vec2 miraEdgeInfo;\nvarying vec2 vMiraEdge;\nvarying vec2 vMiraEdgeInfo;\nvarying float vMiraUnderside;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMiraUnderside = miraUnderside;vMiraEdge=miraEdge;vMiraEdgeInfo=miraEdgeInfo;');shader.uniforms.miraOuter={value:new T.Color('#45464f')};shader.uniforms.miraInner={value:new T.Color('#e9a0b3')};shader.fragmentShader='uniform float ribbonInk;\nuniform float ribbonInkWidth;\nvarying vec2 vMiraEdge;\nvarying vec2 vMiraEdgeInfo;\nuniform vec3 miraOuter;\nuniform vec3 miraInner;\nvarying float vMiraUnderside;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb *= gl_FrontFacing ? miraOuter : mix(miraOuter, miraInner, vMiraUnderside);');shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`
 float roseSide=gl_FrontFacing?0.:vMiraUnderside;
 vec2 inkPixel=max(fwidth(vMiraEdge)*ribbonInkWidth*mix(1.35,1.,roseSide),vec2(.00001));
 // Coordinates describe each actual branch, including its inner split edge.
 float outerDistance=mix(vMiraEdge.x,1.-vMiraEdge.x,vMiraEdgeInfo.x);
 float innerDistance=mix(1.-vMiraEdge.x,vMiraEdge.x,vMiraEdgeInfo.x);
 float outerLine=1.-smoothstep(.35,1.25,outerDistance/inkPixel.x);
 float innerLine=(1.-smoothstep(.35,1.25,innerDistance/inkPixel.x))*vMiraEdgeInfo.y;
 float sideLine=max(outerLine,innerLine);
 float tipLine=1.-smoothstep(.35,1.25,(1.-vMiraEdge.y)/inkPixel.y);
 // Fade only the unresolved end of a long ribbon, using its screen width.
 float ribbonPixels=1./max(fwidth(vMiraEdge.x),.00001);
 // Colour and ink use one coverage, on the same branch geometry.
 float tipCoverage=mix(1.,smoothstep(.4,1.4,ribbonPixels),smoothstep(.65,.90,vMiraEdge.y)*vMiraUnderside);
 float ribbonLine=max(sideLine*smoothstep(.03,.18,vMiraEdge.y),tipLine)*ribbonInk;
 vec3 edgeInk=mix(vec3(.018,.015,.027),vec3(.075,.065,.105),roseSide);
 gl_FragColor.rgb=mix(gl_FragColor.rgb,edgeInk,ribbonLine*mix(1.,.92,roseSide));
 gl_FragColor.a*=tipCoverage;
 #include <dithering_fragment>`);};
 material.customProgramCacheKey=()=> 'mira-charcoal-rose-dark-ink16';return referenceShading(material,{hair:true});
}
