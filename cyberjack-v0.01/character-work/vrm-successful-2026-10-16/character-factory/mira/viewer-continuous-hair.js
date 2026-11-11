import * as T from 'three';
// The original tail vertices stay first, preserving the body-audit bindings.
// Prefix rows connect directly to their tail ribbon's first row in one index buffer.
export function extendTailToScalp(mesh,strips,anchor,fitEdge,scalpCenter=null){
 mesh.userData.tailSourceGeometry??=mesh.geometry.clone();
 const previous=mesh.geometry,old=mesh.userData.tailSourceGeometry,original=old.attributes.position.count,extra=36*64*7,total=original+extra,arrays={};
 for(const [name,a] of Object.entries(old.attributes)){const out=new Float32Array(total*a.itemSize);out.set(a.array);arrays[name]={array:out,size:a.itemSize};}
 const scalp=new Float32Array(total*3),normals=new Float32Array(total*3),blend=new Float32Array(total);blend.fill(1,0,original);
 const indices=Array.from(old.index.array),candidates=strips.filter(s=>s.width>.018&&s.backFacing);
 const chosen=candidates.length?candidates:strips;
 for(let j=0;j<36;j++){
  const source=chosen[Math.floor(j*chosen.length/36)],rows=source.positions.length/39,start=original+j*448,tail=j%18;let previousAcross=null;
  const centerAt=row=>new T.Vector3().fromArray(source.positions,(row*13)*3).add(new T.Vector3().fromArray(source.positions,(row*13+6)*3)).multiplyScalar(.5);
  const guides=Array.from({length:17},(_,i)=>{const f=i/16*(rows-1),a=Math.min(rows-2,Math.floor(f)),q=centerAt(a).lerp(centerAt(a+1),f-a);fitEdge?.(q,.002+(j%4)*.0005);return q;});
  const path=new T.CatmullRomCurve3(guides,false,'centripetal');
  const widthAt=row=>new T.Vector3().fromArray(source.positions,(row*13)*3).distanceTo(new T.Vector3().fromArray(source.positions,(row*13+6)*3));
  for(let r=0;r<64;r++){
   const t=r/64,f=t*(rows-1),a=Math.min(rows-2,Math.floor(f)),u=f-a;
   const center=path.getPoint(t),tangent=path.getTangent(t).normalize();
   const radial=scalpCenter?center.clone().sub(scalpCenter).normalize():new T.Vector3().fromArray(source.normals,(a*13+3)*3).lerp(new T.Vector3().fromArray(source.normals,((a+1)*13+3)*3),u).normalize();radial.addScaledVector(tangent,-radial.dot(tangent)).normalize();const across=new T.Vector3().crossVectors(tangent,radial).normalize();
   if(previousAcross){if(across.dot(previousAcross)<0)across.negate();across.lerp(previousAcross,.65).addScaledVector(tangent,-across.dot(tangent)).normalize();}previousAcross=across.clone();
   const width=T.MathUtils.lerp(widthAt(a),widthAt(a+1),u);
   for(let k=0;k<7;k++){
    const v=start+r*7+k;
    const q=center.clone().addScaledVector(across,(k/6-.5)*width*.78);q.addScaledVector(radial,.0011*Math.sin(Math.PI*k/6));q.toArray(scalp,v*3);radial.toArray(normals,v*3);
    // Broad roots become the SAME edge pair as the tail, without closing tips.
    blend[v]=T.MathUtils.smoothstep(t,.70,1);
    for(const name of ['bundleWeights','bundleDerivative'])for(let axis=0;axis<3;axis++)arrays[name].array[v*3+axis]=T.MathUtils.lerp(old.attributes[name].array[tail*162*3+axis],old.attributes[name].array[(tail*162+1)*3+axis],k/6);
    arrays.color.array.fill(.94+.05*(.5+.5*Math.sin(j*2.4)),v*3,v*3+3);
   }
   const x=start+r*7;if(r<63){const y=x+7;for(let c=0;c<6;c++)indices.push(x+c,x+c+1,y+c,x+c+1,y+c+1,y+c);}else{const root=tail*162;indices.push(x,x+1,root,x+1,x+2,root,x+2,x+3,root,x+3,root+1,root,x+3,x+4,root+1,x+4,x+5,root+1,x+5,x+6,root+1);}
  }
 }
 for(let j=0;j<36;j++)for(let r=0;r<64;r++){
  const base=original+j*448+r*7,prev=original+j*448+Math.max(0,r-1)*7,next=original+j*448+Math.min(63,r+1)*7;
  for(let c=0;c<7;c++){
   const across=new T.Vector3().fromArray(scalp,(base+Math.min(6,c+1))*3).sub(new T.Vector3().fromArray(scalp,(base+Math.max(0,c-1))*3)),along=new T.Vector3().fromArray(scalp,(next+c)*3).sub(new T.Vector3().fromArray(scalp,(prev+c)*3)),n=across.cross(along).normalize(),oldNormal=new T.Vector3().fromArray(normals,(base+c)*3);if(n.dot(oldNormal)<0)n.negate();n.toArray(normals,(base+c)*3);
  }
 }
 const g=new T.BufferGeometry();for(const [name,a] of Object.entries(arrays))g.setAttribute(name,new T.Float32BufferAttribute(a.array,a.size));
 g.setAttribute('scalpPosition',new T.Float32BufferAttribute(scalp,3));g.setAttribute('scalpNormal',new T.Float32BufferAttribute(normals,3));g.setAttribute('tailBlend',new T.Float32BufferAttribute(blend,1));g.setIndex(indices);
 g.userData.continuousPrefix={ribbons:36,tailRibbons:18,rows:64,columns:7,firstVertex:original};mesh.geometry=g;previous.dispose();
 mesh.userData.tailCompile??=mesh.material.onBeforeCompile;
 const compile=mesh.userData.tailCompile;
 mesh.material.onBeforeCompile=shader=>{
  compile(shader);shader.uniforms.scalpMatrix={value:anchor.matrixWorld};
  shader.vertexShader='attribute vec3 scalpPosition;attribute vec3 scalpNormal;attribute float tailBlend;uniform mat4 scalpMatrix;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('vec3 transformed=bundleCurve(br,bundleWeights,bundleBlend);','vec3 transformed=mix((scalpMatrix*vec4(scalpPosition,1.0)).xyz,bundleCurve(br,bundleWeights,bundleBlend),tailBlend);');
  shader.vertexShader=shader.vertexShader.replace('vec3 objectNormal=normalize(cross(across,bundleTangent(br,bundleWeights,bundleBlend))+vec3(0.00000001));','vec3 objectNormal=normalize(mix(mat3(scalpMatrix)*scalpNormal,normalize(cross(across,bundleTangent(br,bundleWeights,bundleBlend))+vec3(0.00000001)),tailBlend));');
 };
 mesh.material.customProgramCacheKey=()=> 'continuous-scalp-tail-v1';mesh.material.needsUpdate=true;
}
