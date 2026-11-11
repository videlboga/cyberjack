import * as THREE from 'three';
// Rest-pose anatomical regions follow humanoid joints through skinning. Capture before posing. No UV atlas assumptions.
export function prepareSkinJoints(vrm){
 const audit=[];vrm.scene.updateMatrixWorld(true);
 vrm.scene.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||mesh.name.endsWith('__cartoon_ink'))return;
  const mats=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(!mats.some(m=>!m.isOutline&&/body/i.test(m.name)))return;
  const joints=[];
  for(const side of ['left','right']){
   const knee=vrm.humanoid.getRawBoneNode(side+'LowerLeg'),foot=vrm.humanoid.getRawBoneNode(side+'Foot');
   if(!knee||!foot)continue;
   const center=knee.getWorldPosition(new THREE.Vector3());
   const end=foot.getWorldPosition(new THREE.Vector3());
   const radius=center.distanceTo(end)*.42;
   if(radius>0)joints.push({side,center,radius,count:0});
  }
  const position=mesh.geometry.attributes.position,values=new Float32Array(position.count),p=new THREE.Vector3();
  for(let i=0;i<position.count;i++){
   p.fromBufferAttribute(position,i).applyMatrix4(mesh.matrixWorld);
   for(const joint of joints){const d=p.distanceTo(joint.center)/joint.radius,w=1-THREE.MathUtils.smoothstep(d,.4,1);values[i]=Math.max(values[i],w);if(w>.1)joint.count++}
  }
  mesh.geometry.setAttribute('skinStyleJointMask',new THREE.BufferAttribute(values,1));
  audit.push({mesh:mesh.name,vertices:position.count,joints:joints.map(j=>({side:j.side,center:j.center.toArray(),radius:j.radius,vertices:j.count}))});
 });
 return audit;
}
export function inspectSkinNormal(texture){
 if(!texture?.image)return {encoding:'none',attenuate:false};
 try{
  const canvas=document.createElement('canvas');canvas.width=canvas.height=32;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(texture.image,0,0,32,32);const data=ctx.getImageData(0,0,32,32).data;
  let packed=0,count=0;
  for(let i=0;i<data.length;i+=4){if(data[i+3]<16)continue;count++;if(data[i]>=249&&Math.abs(data[i+1]-data[i+2])<=6&&data[i+3]>48&&data[i+3]<220)packed++}
  const fraction=packed/(count||1),attenuate=count>128&&fraction>.8;
  return {encoding:attenuate?'unity-packed-like':'tangent-rgb-or-unclassified',attenuate,packedFraction:fraction,samples:count};
 }catch{return {encoding:'unreadable',attenuate:false}}
}
export const skinFilterGLSL=`
varying float vSkinStyleJointMask;
uniform float skinStyleFilterWorldRadius;
float skinDetailRadius(vec2 uv,vec3 viewPosition){
 float density=max(length(dFdx(uv))/max(length(dFdx(viewPosition)),.00001),length(dFdy(uv))/max(length(dFdy(viewPosition)),.00001));
 return clamp(density*skinStyleFilterWorldRadius,.0001,.025);
}
vec3 softBodyDetail(sampler2D image,vec2 uv,float radiusUV){
 vec2 d=vec2(radiusUV);vec3 c=texture2D(image,uv).rgb*4.0;
 c+=2.0*(texture2D(image,uv+vec2(d.x,0.)).rgb+texture2D(image,uv-vec2(d.x,0.)).rgb+texture2D(image,uv+vec2(0.,d.y)).rgb+texture2D(image,uv-vec2(0.,d.y)).rgb);
 c+=texture2D(image,uv+d).rgb+texture2D(image,uv-d).rgb+texture2D(image,uv+vec2(d.x,-d.y)).rgb+texture2D(image,uv+vec2(-d.x,d.y)).rgb;return c/16.0;
}
`;
