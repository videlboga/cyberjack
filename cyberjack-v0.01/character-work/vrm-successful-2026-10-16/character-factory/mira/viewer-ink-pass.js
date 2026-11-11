import {createFinalAntialias} from './viewer-final-antialias.js?v=tip-aa9';
import * as T from './vendor/three/three.module.js';
import {inkStyle,inkWidth} from './viewer-ink-style.js';
// Reuse the scene's depth buffer: silhouettes and overlapping body forms need
// one full-screen pass, not a second traversal or a CPU copy of the body.
export function createInkPass(renderer){
 renderer.info.autoReset=false;
 const size=new T.Vector2(),target=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter});
 target.depthTexture=new T.DepthTexture(1,1,T.UnsignedIntType);target.samples=4;
 const material=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:target.texture},depth:{value:target.depthTexture},pixel:{value:new T.Vector2()},near:{value:.01},far:{value:100},enabled:inkStyle},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
 #include <packing>
 uniform sampler2D image,depth;uniform vec2 pixel;uniform float near,far,enabled;varying vec2 vUv;
 void main(){
  vec4 base=texture2D(image,vUv);float d=texture2D(depth,vUv).x;
  float z=perspectiveDepthToViewZ(d,near,far),jump=0.;float depths[4];
  vec2 offsets[4];offsets[0]=vec2(pixel.x,0.);offsets[1]=vec2(-pixel.x,0.);offsets[2]=vec2(0.,pixel.y);offsets[3]=vec2(0.,-pixel.y);
  for(int i=0;i<4;i++){float other=texture2D(depth,vUv+offsets[i]).x;depths[i]=other;jump=max(jump,abs(z-perspectiveDepthToViewZ(other,near,far)));}
  // Perspective depth is affine across a flat surface. Reject its slope
  // rather than drawing a dark band across the floor or a sloping limb.
  float curvature=max(abs(depths[0]+depths[1]-2.*d),abs(depths[2]+depths[3]-2.*d));
  float span=max(abs(depths[0]-depths[1]),abs(depths[2]-depths[3]));
  float feature=smoothstep(.2,.6,curvature/max(.000001,span));
  // MSAA resolves the ribbon's fractional alpha as well as colour. Keep
  // the later depth contour from repainting those fading tips fully opaque.
  float resolvedCoverage=smoothstep(.97,1.,base.a);
  float line=resolvedCoverage*feature*smoothstep(max(.004,abs(z)*.004),max(.008,abs(z)*.008),jump)*step(d,.999999)*enabled;
  float skin=step(base.b*1.12,base.r)*step(base.g*.98,base.r);
  vec3 ink=mix(vec3(.012,.014,.023),vec3(.19,.065,.085),skin);
  gl_FragColor=vec4(mix(base.rgb,ink,line*.82),base.a);
  #include <colorspace_fragment>
 }`});
 const screen=new T.Scene(),camera=new T.Camera(),quad=new T.Mesh(new T.PlaneGeometry(2,2),material);screen.add(quad);
 const outlined=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false}),antialias=createFinalAntialias();const composite=new T.WebGLRenderTarget(1,1,{minFilter:T.LinearFilter,magFilter:T.LinearFilter});
 composite.depthTexture=target.depthTexture;
 const copy=new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:outlined.texture}},vertexShader:material.vertexShader,fragmentShader:`uniform sampler2D image;varying vec2 vUv;void main(){gl_FragColor=texture2D(image,vUv);
#include <colorspace_fragment>
}`});
 antialias.uniforms.image.value=composite.texture;
 let lightScene=null;
 return (scene,view)=>{if(lightScene!==scene){scene.traverse(object=>{if(object.isLight)object.layers.enable(30);});lightScene=scene;}renderer.info.reset();renderer.getDrawingBufferSize(size);if(target.width!==size.x||target.height!==size.y){target.setSize(size.x,size.y);outlined.setSize(size.x,size.y);composite.setSize(size.x,size.y);}material.uniforms.pixel.value.set(1.15*inkWidth.value/size.x,1.15*inkWidth.value/size.y);material.uniforms.near.value=view.near;material.uniforms.far.value=view.far;renderer.setRenderTarget(target);renderer.render(scene,view);quad.material=material;renderer.setRenderTarget(outlined);renderer.render(screen,camera);
 // Keep the resolved body depth while applying its screen-space ink.
 // Ribbons carry their own geometry-aligned ink and must bypass this pass.
 const autoClear=renderer.autoClear;renderer.autoClear=false;
 quad.material=copy;renderer.setRenderTarget(composite);renderer.render(screen,camera);
 const viewLayers=view.layers.mask;view.layers.set(30);
 const background=scene.background;scene.background=null;
 renderer.render(scene,view);scene.background=background;view.layers.mask=viewLayers;
 renderer.autoClear=autoClear;
 antialias.uniforms.texel.value.set(1/size.x,1/size.y);quad.material=antialias;renderer.setRenderTarget(null);renderer.render(screen,camera);};
}
