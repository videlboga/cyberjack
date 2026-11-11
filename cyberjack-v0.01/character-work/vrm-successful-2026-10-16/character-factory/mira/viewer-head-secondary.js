import * as T from 'three';
import {projectHairCollider} from './viewer-hair-physics.js?v=short-caps-22';
// Low-dimensional secondary motion. Roots stay fixed; gathered back sections
// are also fixed at the tail socket. Render ribbons retain separate geometry.
export function installHeadSecondary(mesh,pieces,backCount,seamNodes,seat,options={}){
 const count=12,offsets=Array.from({length:count},()=>new T.Vector3()),groups=offsets.map(()=>({rest:new T.Vector3(),sum:0,p:null,v:new T.Vector3()}));
 const ids=[],weights=[],seamWeights=[],seamBlend=[];
 for(let k=0;k<pieces.length;k++){
  const g=pieces[k],a=g.attributes.position,back=k<backCount,id=(back?0:6)+k%6,rows=a.count/13,freeFrame=back&&g.userData.seam===false;
  if(freeFrame)groups[id].freeFrame=true;
  for(let i=0;i<a.count;i++){
   const t=Math.floor(i/13)/(rows-1),column=i%13;
   const end=new T.Vector3().fromBufferAttribute(a,a.count-13),theta=Math.atan2(end.z-seat.z,end.x-seat.x),j=((Math.round(theta/(Math.PI*2)*18)%18)+18)%18;
   const angle=j*Math.PI*2/18+.055*Math.sin(j*2.399)+Math.cos(column/12*Math.PI*2)*.19*(.66+(j%5)*.14);
   const c=Math.cos(angle)*1.55,d=Math.sin(angle)*1.55/Math.sqrt(3);
   seamWeights.push((1-c)/3+c,(1-c)/3+d,(1-c)/3-d);seamBlend.push(!options.gathered&&back&&g.userData.seam!==false?T.MathUtils.smoothstep(t,.37,1):0);
   const w=freeFrame?T.MathUtils.smoothstep(t,.12,1):options.gathered?Math.sin(Math.PI*t)**2*T.MathUtils.smoothstep(t,.50,.85):back?Math.sin(Math.PI*t)**2*T.MathUtils.smoothstep(t,.22,.5):T.MathUtils.smoothstep(t,.25,1);
   ids.push(id);weights.push(w);if(w>.3){groups[id].rest.addScaledVector(new T.Vector3().fromBufferAttribute(a,i),w);groups[id].sum+=w;}
  }
 }
 for(const g of groups)if(g.sum)g.rest.multiplyScalar(1/g.sum);
 mesh.geometry.setAttribute('seamWeights',new T.Float32BufferAttribute(seamWeights,3));mesh.geometry.setAttribute('seamBlend',new T.Float32BufferAttribute(seamBlend,1));
 mesh.geometry.setAttribute('secondaryGroup',new T.Float32BufferAttribute(ids,1));mesh.geometry.setAttribute('secondaryWeight',new T.Float32BufferAttribute(weights,1));
 const previousCompile=mesh.material.onBeforeCompile;
 mesh.material.onBeforeCompile=shader=>{
  previousCompile.call(mesh.material,shader);
  shader.uniforms.secondaryOffsets={value:offsets};shader.uniforms.seamNodes={value:seamNodes.slice(0,3)};shader.uniforms.seamInverse={value:new T.Matrix4()};mesh.userData.seamInverse=shader.uniforms.seamInverse.value;
  shader.vertexShader='attribute vec3 seamWeights;attribute float seamBlend;uniform vec3 seamNodes[3];uniform mat4 seamInverse;attribute float secondaryGroup; attribute float secondaryWeight; uniform vec3 secondaryOffsets[12];\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed += secondaryOffsets[int(secondaryGroup)] * secondaryWeight;\nvec3 seamWorld=seamNodes[0]*seamWeights.x+seamNodes[1]*seamWeights.y+seamNodes[2]*seamWeights.z;\ntransformed=mix(transformed,(seamInverse*vec4(seamWorld,1.0)).xyz,seamBlend);');
 };
 const target=new T.Vector3(),local=new T.Vector3(),inv=new T.Matrix4();let accumulator=0;
 return (dt,colliders=[])=>{
  mesh.updateWorldMatrix(true,false);inv.copy(mesh.matrixWorld).invert();mesh.userData.seamInverse?.copy(inv);accumulator=Math.min(accumulator+Math.max(0,dt),.05);
  const steps=Math.floor(accumulator*120);accumulator-=steps/120;
  for(let i=0;i<count;i++){
   const g=groups[i];if(!g.sum)continue;target.copy(g.rest).applyMatrix4(mesh.matrixWorld);
   if(!g.p||g.p.distanceTo(target)>.18){g.p=target.clone();g.v.set(0,0,0);}
   const back=i<6,freeFrame=g.freeFrame,max=options.faceClearance?.004:freeFrame?.035:options.gathered?.009:back?.012:.022,k=(freeFrame?65:back?190:95)*(1+.18*Math.sin(i*2.399)),damping=freeFrame?14:back?26:18;
   for(let step=0;step<steps;step++){
    g.v.addScaledVector(local.copy(target).sub(g.p),k/120).multiplyScalar(Math.exp(-damping/120));g.v.y-=(options.faceClearance?.08:.35)/120;g.p.addScaledVector(g.v,1/120);
    local.copy(g.p).sub(target);if(local.length()>max){g.p.copy(target).add(local.setLength(max));g.v.multiplyScalar(.5);}
    // Sampled capsule contact for the moving section, without body raycasts.
    for(const c of colliders)if(c.enforceRest){local.copy(target);if(!projectHairCollider(local,c,.003)&&projectHairCollider(g.p,c,.003))g.v.multiplyScalar(.5);}
   }
   offsets[i].copy(g.p).applyMatrix4(inv).sub(g.rest);
  }
 };
}
