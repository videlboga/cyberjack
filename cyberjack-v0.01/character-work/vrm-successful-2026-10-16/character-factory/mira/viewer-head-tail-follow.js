import * as T from 'three';
// One shared tail frame drives all gathered locks on the GPU. No second solver.
export function installHeadTailFollow(mesh,pieces,seat,nodes){
 const weights=[];
 for(const g of pieces){const rows=g.attributes.position.count/13;for(let i=0;i<g.attributes.position.count;i++){const t=Math.floor(i/13)/(rows-1);weights.push(T.MathUtils.smoothstep(t,.30,1));}}
 mesh.geometry.setAttribute('tailFollow',new T.Float32BufferAttribute(weights,1));
 const rotation=new T.Quaternion(),delta=new T.Vector3(),pivot=seat.clone();
 mesh.material=mesh.material.clone();
 mesh.material.onBeforeCompile=shader=>{
  shader.uniforms.tailFollowRotation={value:rotation};shader.uniforms.tailFollowDelta={value:delta};shader.uniforms.tailFollowPivot={value:pivot};
  shader.vertexShader='attribute float tailFollow;uniform vec4 tailFollowRotation;uniform vec3 tailFollowDelta;uniform vec3 tailFollowPivot;vec3 followRotate(vec3 p){return p+2.0*cross(tailFollowRotation.xyz,cross(tailFollowRotation.xyz,p)+tailFollowRotation.w*p);}\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=mix(transformed,followRotate(transformed-tailFollowPivot)+tailFollowPivot+tailFollowDelta,tailFollow);');
  shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=normalize(mix(objectNormal,followRotate(objectNormal),tailFollow));');
 };
 mesh.material.customProgramCacheKey=()=> 'head-tail-frame-1';
 const inverse=new T.Matrix4(),restFrame=new T.Matrix4(),a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),d=new T.Vector3(),identity=new T.Quaternion();
 const centroid=(points,row,out)=>out.copy(points[row*3]).add(points[row*3+1]).add(points[row*3+2]).multiplyScalar(1/3);
 return (rest,matrix)=>{
  mesh.updateWorldMatrix(true,false);inverse.copy(mesh.matrixWorld).invert();restFrame.multiplyMatrices(inverse,matrix);
  centroid(rest,0,a).applyMatrix4(restFrame);centroid(rest,3,b).applyMatrix4(restFrame);
  centroid(nodes,0,c).applyMatrix4(inverse);centroid(nodes,3,d).applyMatrix4(inverse);
  delta.copy(d).sub(b).multiplyScalar(.35).clampLength(0,.020);
  b.sub(a).normalize();d.sub(c).normalize();
  if(b.lengthSq()<.5||d.lengthSq()<.5){rotation.identity();delta.set(0,0,0);return;}
  rotation.setFromUnitVectors(b,d);const angle=identity.angleTo(rotation);if(angle>.45)rotation.slerp(identity,1-.45/angle);
 };
}
