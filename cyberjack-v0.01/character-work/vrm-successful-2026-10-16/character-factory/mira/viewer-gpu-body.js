import * as T from './vendor/three/three.module.js';
const B=21,SLOTS=12;
export const gpuBodyDeclarations=`
attribute vec4 cjSkinIds0,cjSkinIds1,cjSkinIds2;
attribute vec4 cjSkinWeights0,cjSkinWeights1,cjSkinWeights2;
attribute float cjGpuBody;
uniform float cjGpuEnabled,cjNeckWidth;
uniform vec3 cjNeckCenter;
uniform vec4 cjDqReal[21],cjDqDual[21];
vec3 cjRotate(vec4 q,vec3 p){vec3 t=2.0*cross(q.xyz,p);return p+q.w*t+cross(q.xyz,t);}
void cjBlend(out vec4 r,out vec4 d){r=vec4(0.0);d=vec4(0.0);
 if(cjGpuEnabled<.5||cjGpuBody<.5){r.w=1.0;return;}
${Array.from({length:SLOTS},(_,i)=>{const group=Math.floor(i/4),component='xyzw'[i%4];return `{float w=cjSkinWeights${group}.${component};if(w>=1e-8){int b=int(cjSkinIds${group}.${component}+.5);vec4 q=cjDqReal[b];if(dot(r,q)<0.0)w=-w;r+=w*q;d+=w*cjDqDual[b];}}`;}).join('\n')}
 float l=length(r);r/=l;d/=l;
}
`;
export const gpuBodyPositionGLSL=' if(cjGpuEnabled>.5&&cjGpuBody>.5){transformed=cjRotate(cjQ,transformed)+2.0*(-cjD.w*cjQ.xyz+cjD.xyz*cjQ.w+cross(cjQ.xyz,cjD.xyz));\n vec2 delta=transformed.xy-cjNeckCenter.xy;float radius=length(delta),v=clamp((transformed.z-(cjNeckCenter.z-.055))/.055,0.0,1.0),r=clamp((radius-.075)/.045,0.0,1.0);float factor=1.0+(cjNeckWidth-1.0)*(v*v*(3.0-2.0*v))*(1.0-r*r*(3.0-2.0*r));transformed.xy=cjNeckCenter.xy+delta*factor;}';
export function normalBuffer(positions,index,out=new Float32Array(positions.length),triangles=null,vertices=null){
 out.fill(0);
 const count=triangles?triangles.length:index.length/3;
 for(let triangle=0;triangle<count;triangle++){const j=(triangles?triangles[triangle]:triangle)*3,a=index[j]*3,b=index[j+1]*3,c=index[j+2]*3,x=positions[c]-positions[b],y=positions[c+1]-positions[b+1],z=positions[c+2]-positions[b+2],u=positions[a]-positions[b],v=positions[a+1]-positions[b+1],w=positions[a+2]-positions[b+2],nx=y*w-z*v,ny=z*u-x*w,nz=x*v-y*u;
  out[a]+=nx;out[a+1]+=ny;out[a+2]+=nz;out[b]+=nx;out[b+1]+=ny;out[b+2]+=nz;out[c]+=nx;out[c+1]+=ny;out[c+2]+=nz;
 }
 const n=vertices?vertices.length:positions.length/3;for(let k=0;k<n;k++){const j=(vertices?vertices[k]:k)*3,l=Math.sqrt(out[j]**2+out[j+1]**2+out[j+2]**2)||1;out[j]/=l;out[j+1]/=l;out[j+2]/=l;}return out;
}
export function compileSkin(skin,sourceMap,count,bones=B){
 const ids=Array.from({length:3},()=>new Float32Array(count*4)),weights=Array.from({length:3},()=>new Float32Array(count*4)),gpu=new Float32Array(count);let maximum=0;
 for(let i=0;i<Math.min(count,sourceMap.length);i++){const map=sourceMap[i];if(map.length!==1||map[0][1]!==1)continue;const id=map[0][0];let slot=0;for(let bone=0;bone<bones;bone++){const w=skin[id*bones+bone];if(w<1e-8)continue;if(slot>=SLOTS)throw Error('Слишком много весов для GPU DQ');ids[Math.floor(slot/4)][i*4+slot%4]=bone;weights[Math.floor(slot/4)][i*4+slot%4]=w;slot++;}maximum=Math.max(maximum,slot);gpu[i]=slot?1:0;}
 return {ids,weights,gpu,maximum};
}
export function createGpuBody({mesh,index,Anatomy,AnatomyPose,renderer}){
 const originalGetVertex=mesh.getVertexPosition.bind(mesh),originalRaycast=mesh.raycast.bind(mesh);
 const capable=renderer.capabilities.isWebGL2&&renderer.capabilities.maxAttributes>=12,uniforms={cjGpuEnabled:{value:0},cjNeckWidth:{value:1},cjNeckCenter:{value:new T.Vector3()},cjDqReal:{value:Array.from({length:B},()=>new T.Vector4(0,0,0,1))},cjDqDual:{value:Array.from({length:B},()=>new T.Vector4())}},patched=new WeakSet();let socket=null,source=null,matrices=null,weights=null,frame=null,clip=null,revision=0,cpuRevision=-1,cpu=null,normals=null,sparse=null;
 const api={capable,active:false,maximumWeights:0,revision:0,selected:null,normalVertices:null,normalTriangles:null,
 patchMaterial(material){if(!material||patched.has(material))return;patched.add(material);const before=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);material.onBeforeCompile=function(shader,...args){before.call(this,shader,...args);Object.assign(shader.uniforms,uniforms);shader.vertexShader=gpuBodyDeclarations+'\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace(/void main\s*\(\s*\)\s*\{/,'void main(){ vec4 cjQ,cjD; cjBlend(cjQ,cjD);vec3 cjAnimatedNormal=normal;if(cjGpuEnabled>.5&&cjGpuBody>.5)cjAnimatedNormal=cjRotate(cjQ,normal);');shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nif(cjGpuEnabled>.5&&cjGpuBody>.5)objectNormal=cjAnimatedNormal;');shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n'+gpuBodyPositionGLSL);
 // The inverted hull uses the animated normal, matching the lit body.
 shader.vertexShader=shader.vertexShader.replace('normalize(normalMatrix*normal)','normalize(normalMatrix*cjAnimatedNormal)');};material.customProgramCacheKey=()=>key()+'|cj-dq-body-92';material.needsUpdate=true;},
 attach(next){if(!capable||!next)return false;if(socket===next&&next.gpuBody===api)return true;socket=next;api.active=false;uniforms.cjGpuEnabled.value=0;const g=socket.geometry,skin=Anatomy.getSkin('body'),compiled=compileSkin(skin,socket.sourceMap.slice(0,socket.bodyCount),g.attributes.position.count);api.maximumWeights=compiled.maximum;for(const v of socket.bottom)compiled.gpu[v.id]=0;
  for(let k=0;k<3;k++){g.setAttribute('cjSkinIds'+k,new T.BufferAttribute(compiled.ids[k],4));g.setAttribute('cjSkinWeights'+k,new T.BufferAttribute(compiled.weights[k],4));}g.setAttribute('cjGpuBody',new T.BufferAttribute(compiled.gpu,1));
  const needed=new Set(),normalVertices=new Set();for(let i=0;i<socket.bodyCount;i++)if(!compiled.gpu[i])for(const [id]of socket.sourceMap[i]){needed.add(id);normalVertices.add(id);}for(const v of socket.bottom)for(const [id]of socket.sourceMap[v.id]){needed.add(id);normalVertices.add(id);}for(const v of socket.guideRing){const q=socket.guideMap[v.id];needed.add(q.a);needed.add(q.b);}
  const triangles=[];for(let j=0;j<index.length;j+=3)if(normalVertices.has(index[j])||normalVertices.has(index[j+1])||normalVertices.has(index[j+2])){triangles.push(j/3);for(let k=0;k<3;k++)needed.add(index[j+k]);}
  api.selected=Uint32Array.from(needed);api.normalVertices=Uint32Array.from(normalVertices);api.normalTriangles=Uint32Array.from(triangles);socket.gpuBody=api;mesh.userData.cjGpuSkin=api;g.userData.cjGpuSkin=api;mesh.frustumCulled=false;const originalVertex=originalGetVertex;api.originalVertex=originalVertex;mesh.getVertexPosition=(id,target)=>api.active?api.vertex(id,target):originalVertex(id,target);
  mesh.raycast=(raycaster,intersections)=>{if(api.active){api.fitBounds();mesh.geometry.boundingBox=mesh.boundingBox.clone();mesh.geometry.boundingSphere=mesh.boundingBox.getBoundingSphere(new T.Sphere());}return originalRaycast(raycaster,intersections);};
  for(const material of [].concat(mesh.material))api.patchMaterial(material);for(const child of mesh.children)if(child.userData.referenceInk)api.patchMaterial(child.material);return true;
 },
 sourceNormals(positions){sparse??=new Float32Array(positions.length);return normalBuffer(positions,index,sparse,api.normalTriangles,api.normalVertices);},
 invalidate(){cpuRevision=-1;normals=null;},
 prepare(rest,bodyWeights,poseFrame,poseClip,prepared){source=rest;weights=bodyWeights;frame=poseFrame;clip=poseClip;matrices=prepared;revision++;api.revision=revision;api.active=true;uniforms.cjGpuEnabled.value=1;
  for(let i=0;i<B;i++){uniforms.cjDqReal.value[i].fromArray(matrices.q[i]);uniforms.cjDqDual.value[i].fromArray(matrices.d[i]);}
  for(const material of [].concat(mesh.material))api.patchMaterial(material);
  const g=socket.geometry,p=g.attributes.position.array;normals=normalBuffer(rest,index,normals||new Float32Array(rest.length));if(!g.attributes.normal)g.setAttribute('normal',new T.BufferAttribute(new Float32Array(p.length),3));const n=g.attributes.normal.array;
  for(let i=0;i<socket.bodyCount;i++)if(g.attributes.cjGpuBody.array[i]){const id=socket.sourceMap[i][0][0]*3,j=i*3;p[j]=rest[id];p[j+1]=rest[id+1];p[j+2]=rest[id+2];if(n){n[j]=normals[id];n[j+1]=normals[id+1];n[j+2]=normals[id+2];}}
  g.attributes.position.needsUpdate=true;if(g.attributes.normal)g.attributes.normal.needsUpdate=true;
 },
 setNeck(center,width){uniforms.cjNeckCenter.value.fromArray(center);uniforms.cjNeckWidth.value=width;},
 disable(){api.active=false;uniforms.cjGpuEnabled.value=0;delete mesh.boundingBox;},
 fullSource(){if(cpuRevision!==revision){cpu??=new Float32Array(source.length);AnatomyPose.apply(source,cpu,weights,frame,clip,'body',null,matrices);cpu=socket.deformSource(cpu,uniforms.cjNeckWidth.value);cpuRevision=revision;}return cpu;},
 vertex(id,target){if(id>=socket.bodyCount||!socket.geometry.attributes.cjGpuBody.array[id])return target.fromArray(socket.positions,id*3);const input=api.fullSource(),map=socket.sourceMap[id];target.set(0,0,0);for(const [v,w]of map){target.x+=input[v*3]*w;target.y+=input[v*3+1]*w;target.z+=input[v*3+2]*w;}return target;},
 posedPositions(){if(!api.active)return mesh.geometry.attributes.position.array;const out=new Float32Array(socket.positions.length),input=api.fullSource();for(let i=0;i<socket.bodyCount;i++){let x=0,y=0,z=0;for(const [id,w]of socket.sourceMap[i]){x+=input[id*3]*w;y+=input[id*3+1]*w;z+=input[id*3+2]*w;}out[i*3]=x;out[i*3+1]=y;out[i*3+2]=z;}out.set(socket.positions.subarray(socket.bodyCount*3),socket.bodyCount*3);return out;},
 fitBounds(){const p=api.posedPositions();mesh.boundingBox??=new T.Box3();mesh.boundingBox.setFromArray(p);mesh.geometry.boundingBox=mesh.boundingBox.clone();mesh.geometry.boundingSphere=mesh.boundingBox.getBoundingSphere(new T.Sphere());return mesh.boundingBox;},
 get restNormals(){return normals;}
 };
 return api;
}
