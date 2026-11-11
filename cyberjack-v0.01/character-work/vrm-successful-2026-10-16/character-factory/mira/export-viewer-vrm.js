import {mouthExpressionBinds} from './viewer-mouth-expressions.js?v=2';
import * as THREE from 'three';
import {GLTFExporter} from './vendor/three/exporters/GLTFExporter.js';

const toY=p=>[p[0],p[2],-p[1]];
const normalToY=new THREE.Matrix4().makeRotationX(-Math.PI/2);
const boneNames={pelvis:'hips',abdomen:'spine',chest:'chest',upperchest:'upperChest',neck:'neck',head:'head','shoulder.l':'leftShoulder','upperarm.l':'leftUpperArm','forearm.l':'leftLowerArm','hand.l':'leftHand','thigh.l':'leftUpperLeg','shin.l':'leftLowerLeg','foot.l':'leftFoot','shoulder.r':'rightShoulder','upperarm.r':'rightUpperArm','forearm.r':'rightLowerArm','hand.r':'rightHand','thigh.r':'rightUpperLeg','shin.r':'rightLowerLeg','foot.r':'rightFoot'};
function four(weights){const list=weights.map((w,i)=>[i,w]).filter(v=>v[1]>1e-8).sort((a,b)=>b[1]-a[1]).slice(0,4),sum=list.reduce((s,v)=>s+v[1],0)||1;while(list.length<4)list.push([0,0]);return {index:list.map(v=>v[0]),weight:list.map(v=>v[1]/sum)};}
function skin(geo,weights){const si=[],sw=[];for(const w of weights){const f=four(w);si.push(...f.index);sw.push(...f.weight);}geo.setAttribute('skinIndex',new THREE.Uint16BufferAttribute(si,4));geo.setAttribute('skinWeight',new THREE.Float32BufferAttribute(sw,4));}
function standard(m,textures){
  if(Array.isArray(m))m=m.find(v=>!v.isOutline)||m[0];
  const out=new THREE.MeshStandardMaterial({name:m.name||'Skin',vertexColors:Boolean(m.vertexColors),color:m.color||0xffffff,roughness:.8,metalness:0,side:THREE.DoubleSide,opacity:m.opacity??1,transparent:m.transparent,alphaTest:m.alphaTest||0});
  if(textures){out.map=m.map||null;out.normalMap=m.normalMap||null;out.emissiveMap=m.emissiveMap||null;if(m.emissive)out.emissive.copy(m.emissive);}return out;
}
function triangleNormals(geo){geo.deleteAttribute('normal');geo.computeVertexNormals();const n=geo.attributes.normal;for(let i=0;i<n.count;i++){const v=new THREE.Vector3().fromBufferAttribute(n,i);if(v.lengthSq()<1e-12)v.set(0,1,0);else v.normalize();n.setXYZ(i,v.x,v.y,v.z);}}

export async function exportViewerVRM({head,hair,weights,restBody,parameters={},includeTextures=true}){
  if(!head.ready||head.settings.style!=='mira')throw Error('Для экспорта выберите голову Mira VRM 1.0');
  const rig=Anatomy.getRig(),B=rig.bones.length,r=Anatomy.ratios(weights),headIndex=rig.bones.findIndex(b=>b.name==='head');
  const identityFrame={q:rig.bones.map(()=>[0,0,0,1]),root:[0,0,0]};
  const rest=AnatomyPose.matrices(weights,identityFrame,ANATOMY_DANCE);
  // A reproducible T-pose is exported independently of the editor's current pose.
  for(const side of ['l','r'])for(const [part,next] of [['shoulder','upperarm'],['upperarm','forearm'],['forearm','hand']]){
    const i=rig.bones.findIndex(b=>b.name===part+'.'+side),j=rig.bones.findIndex(b=>b.name===next+'.'+side),axis=new THREE.Vector3().fromArray(rest.heads[j]).sub(new THREE.Vector3().fromArray(rest.heads[i])).normalize();identityFrame.q[i]=new THREE.Quaternion().setFromUnitVectors(axis,new THREE.Vector3(side==='l'?1:-1,0,0)).toArray();
  }
  for(const side of ['l','r'])identityFrame.q[rig.bones.findIndex(b=>b.name==='hand.'+side)]=identityFrame.q[rig.bones.findIndex(b=>b.name==='forearm.'+side)];
  const pose=AnatomyPose.matrices(weights,identityFrame,ANATOMY_DANCE),bodyT=new Float32Array(restBody.length);AnatomyPose.apply(restBody,bodyT,weights,identityFrame,ANATOMY_DANCE);
  const pivotOffset=head.attachmentOffset(weights,null),jointPoint=i=>pose.posed[i].map((v,k)=>v+(i===headIndex?pivotOffset.getComponent(k):0));
  const scene=new THREE.Scene();scene.userData.characterFactory={version:1,parameters:{...parameters},weights:{...weights},head:structuredClone(head.settings),canonicalFit:structuredClone(head.manifest.canonicalFit||{}),hair:{...structuredClone(hair.settings||{}),layers:hair.builtin?.serialize?.()||[]}};const bones=rig.bones.map(b=>{const o=new THREE.Bone();o.name=b.name;return o;});
  for(let i=0;i<B;i++){const p=AnatomyPose.parents[i],point=toY(jointPoint(i));bones[i].position.fromArray(p<0?point:point.map((v,k)=>v-toY(jointPoint(p))[k]));(p<0?scene:bones[p]).add(bones[i]);}
  const humanoid=Object.fromEntries(rig.bones.flatMap((b,i)=>boneNames[b.name]?[[boneNames[b.name],bones[i]]]:[]));
  const scale=new THREE.Vector3(r.height*r.head_size*r.head_w,r.height*r.head_size,r.height*r.head_size),headPoint=new THREE.Vector3().fromArray(rest.heads[headIndex]).add(pivotOffset);
  const origin=new THREE.Vector3().fromArray(head.manifest.sourceHead),fit=head.manifest.fitScale;
  function donorPoint(p,delta=false){if(!delta)p.sub(origin);p.set(p.x,-p.z,p.y).multiplyScalar(fit).multiply(scale);if(!delta)p.add(headPoint);return p;}
  for(const side of ['leftEye','rightEye']){
    const source=head.faceEditor.eyePoint(side);if(!source)continue;
    const point=donorPoint(new THREE.Vector3().fromArray(source)).sub(headPoint),eye=new THREE.Bone();eye.name=side;eye.position.fromArray(toY(point.toArray()));bones[headIndex].add(eye);humanoid[side]=eye;bones.push(eye);
  }
  scene.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);skeleton.calculateInverses();
  const addMesh=(geo,material,name)=>{const mesh=new THREE.SkinnedMesh(geo,material);mesh.name=name;scene.add(mesh);scene.updateMatrixWorld(true);mesh.bind(skeleton,mesh.matrixWorld);return mesh;};
  const W=Anatomy.getSkin('body'),sourceWeights=i=>Array.from(W.slice(i*B,(i+1)*B));
  const exportedHeads=[],headRaw=new Map();
  for(const original of head.meshes){
    const geo=original.geometry.clone();geo.deleteAttribute('skinIndex');geo.deleteAttribute('skinWeight');const p=geo.attributes.position,raw=new Float32Array(p.count*3),matrix=head.restMatrices.get(original),linear=new THREE.Matrix3().setFromMatrix4(matrix);
    for(let i=0;i<p.count;i++){const point=donorPoint(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));raw.set(point.toArray(),i*3);p.setXYZ(i,...toY(point.toArray()));}
    headRaw.set(original,raw);
    for(const [kind,attributes] of Object.entries(geo.morphAttributes)){
      if(kind!=='position'){delete geo.morphAttributes[kind];continue;}
      geo.morphAttributes[kind]=attributes.map(attr=>{const out=new Float32Array(attr.count*3);for(let i=0;i<attr.count;i++){const d=donorPoint(new THREE.Vector3().fromBufferAttribute(attr,i).applyMatrix3(linear),true);out.set(toY(d.toArray()),i*3);}return new THREE.BufferAttribute(out,3);});
    }
    const partIndex=head.meshes.indexOf(original),eyeName=partIndex===7?'leftEye':partIndex===8?'rightEye':null,index=eyeName?bones.indexOf(humanoid[eyeName]):headIndex;
    skin(geo,Array.from({length:p.count},()=>{const w=Array(bones.length).fill(0);w[index>=0?index:headIndex]=1;return w;}));
    const normalMatrix=new THREE.Matrix3().getNormalMatrix(new THREE.Matrix4().makeScale(fit*scale.x,fit*scale.z,fit*scale.y).multiply(matrix)),norm=geo.attributes.normal;
    for(let i=0;i<norm.count;i++){const n=new THREE.Vector3().fromBufferAttribute(norm,i).applyMatrix3(normalMatrix).normalize();norm.setXYZ(i,n.x,n.y,n.z);}
    const material=original.material===head.clay?standard(head.clay,false):standard(original.material,includeTextures);const mesh=addMesh(geo,material,'Mira '+original.name);mesh.morphTargetDictionary={...original.morphTargetDictionary};mesh.morphTargetInfluences=original.morphTargetInfluences.map(()=>0);exportedHeads.push(mesh);
  }
  // Keep the complete native body neck and fit its existing upper boundary
  // directly to the head-only aperture. The boundary is rigid to the head;
  // the original body skin weights fade into that constraint over the neck.
  const socket=head.socket,rawHead=headRaw.get(head.socketMesh),high=socket.upper.map(v=>Array.from(rawHead.slice(v.id*3,v.id*3+3))),bodyRaw=socket.fit(bodyT,high,[0,0,1],null,r.neck_w);
  const bodyWeights=socket.fields.map((q,i)=>{const w=Array(B).fill(0);for(const [id,amount] of socket.sourceMap[i]){const source=sourceWeights(id);for(let k=0;k<B;k++)w[k]+=source[k]*amount*(1-q.w);}w[headIndex]+=q.w;while(w.length<bones.length)w.push(0);return w;});
  const bodyGeo=new THREE.BufferGeometry();bodyGeo.setAttribute('position',new THREE.BufferAttribute(bodyRaw,3));bodyGeo.setIndex(Array.from(socket.index));triangleNormals(bodyGeo);socket.smoothNormals(bodyGeo.attributes.normal);bodyGeo.applyMatrix4(normalToY);skin(bodyGeo,bodyWeights);const body=addMesh(bodyGeo,standard(head.clay,false),'Anatomy body with complete neck');
  const exportedHair=[];
  if(hair.ready&&hair.settings.style!=='none'){
    hair.anchor.updateWorldMatrix(true,true);hair.anchor.updateMatrixWorld(true);const inv=hair.anchor.matrixWorld.clone().invert();
    hair.anchor.traverse(original=>{if(!original.isMesh)return;for(let o=original;o&&o!==hair.anchor;o=o.parent)if(!o.visible)return;const geo=original.geometry.clone(),p=geo.attributes.position,m=inv.clone().multiply(original.matrixWorld);geo.deleteAttribute('skinIndex');geo.deleteAttribute('skinWeight');geo.morphAttributes={};
      for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i);if(original.isSkinnedMesh)original.applyBoneTransform(i,v);v.applyMatrix4(m).multiply(scale).add(headPoint);p.setXYZ(i,...toY(v.toArray()));}
      triangleNormals(geo);skin(geo,Array.from({length:p.count},()=>{const w=Array(bones.length).fill(0);w[headIndex]=1;return w;}));exportedHair.push(addMesh(geo,standard(original.material,includeTextures),'Hair '+original.name));
    });
  }
  // Keep the material split while sharing normals along the jaw/occiput socket.
  const seamMeshes=[body,exportedHeads[head.meshes.indexOf(head.socketMesh)]],points=new Map();
  for(const mesh of seamMeshes){const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(6)).join(',');if(!points.has(key))points.set(key,[]);points.get(key).push({mesh,n,i});}}
  for(const entries of points.values())if(new Set(entries.map(e=>e.mesh)).size>1){const v=new THREE.Vector3();for(const e of entries)v.add(new THREE.Vector3().fromBufferAttribute(e.n,e.i));if(v.lengthSq()<1e-12)v.fromBufferAttribute(entries[0].n,entries[0].i);v.normalize();for(const e of entries)e.n.setXYZ(e.i,v.x,v.y,v.z);}
  const source=head.document.parser.json.extensions.VRMC_vrm;
  const exporter=new GLTFExporter();exporter.register(writer=>({name:'CyberjackVRM1',afterParse(){
    const meta=structuredClone(source.meta);delete meta.thumbnailImage;meta.name=(meta.name||'Mira')+' · Character editor';
    const expressions=structuredClone(source.expressions);for(const group of Object.values(expressions))for(const [name,expression] of Object.entries(group))if(expression.morphTargetBinds){const binds=mouthExpressionBinds(name,expression.morphTargetBinds,head.settings.face,head.socketMesh.morphTargetDictionary);expression.morphTargetBinds=binds.flatMap(bind=>exportedHeads.filter(m=>m.morphTargetInfluences.length>bind.index).map(mesh=>({node:writer.nodeMap.get(mesh),index:bind.index,weight:bind.weight})));}
    const lookAt=structuredClone(source.lookAt||{});if(lookAt.offsetFromHeadBone){const o=lookAt.offsetFromHeadBone;for(const k of ['x','y','z'])o[k]*=fit*r.height*r.head_size;}
    writer.json.extensions||={};writer.json.extensions.VRMC_vrm={specVersion:'1.0',meta,humanoid:{humanBones:Object.fromEntries(Object.entries(humanoid).map(([name,bone])=>[name,{node:writer.nodeMap.get(bone)}]))},expressions,lookAt,firstPerson:{meshAnnotations:[body,...exportedHair,...exportedHeads].map(mesh=>({node:writer.nodeMap.get(mesh),type:exportedHeads.includes(mesh)?'thirdPersonOnly':'auto'}))}};writer.extensionsUsed.VRMC_vrm=true;
  }}));
  const data=await exporter.parseAsync(scene,{binary:true,onlyVisible:true,maxTextureSize:2048});
  return {data,scene,summary:{format:'VRM 1.0',expressions:Object.keys(source.expressions.preset).length,targets:151,bones:bones.length,headMeshes:exportedHeads.length,pose:'T'}};
}
