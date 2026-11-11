import * as T from './vendor/three/three.module.js';
// Directional antialiasing after ink: MSAA alone cannot smooth contours added
// in a full-screen shader. All sampling remains on the GPU.
export function createFinalAntialias(){
 return new T.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{image:{value:null},texel:{value:new T.Vector2()}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`
 uniform sampler2D image;uniform vec2 texel;varying vec2 vUv;
 float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
 void main(){
  vec3 center=texture2D(image,vUv).rgb;
  vec3 nw=texture2D(image,vUv+vec2(-1.,-1.)*texel).rgb;
  vec3 ne=texture2D(image,vUv+vec2(1.,-1.)*texel).rgb;
  vec3 sw=texture2D(image,vUv+vec2(-1.,1.)*texel).rgb;
  vec3 se=texture2D(image,vUv+vec2(1.,1.)*texel).rgb;
  float m=luma(center),a=luma(nw),b=luma(ne),c=luma(sw),d=luma(se);
  float lo=min(m,min(min(a,b),min(c,d))),hi=max(m,max(max(a,b),max(c,d)));
  vec3 result=center;
  if(hi-lo>max(.025,hi*.10)){
   vec2 direction=vec2(-((a+b)-(c+d)),(a+c)-(b+d));
   float reduction=max((a+b+c+d)*(.25*.125),1./128.);
   float scale=1./(min(abs(direction.x),abs(direction.y))+reduction);
   direction=clamp(direction*scale,vec2(-4.),vec2(4.))*texel;
   vec3 inner=.5*(texture2D(image,vUv-direction/6.).rgb+texture2D(image,vUv+direction/6.).rgb);
   vec3 outer=inner*.5+.25*(texture2D(image,vUv-direction*.5).rgb+texture2D(image,vUv+direction*.5).rgb);
   float value=luma(outer);result=(value<lo||value>hi)?inner:outer;
  }
  gl_FragColor=vec4(result,1.);
  #include <colorspace_fragment>
 }`});
}
