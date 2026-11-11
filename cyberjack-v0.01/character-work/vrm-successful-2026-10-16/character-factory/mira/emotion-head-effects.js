import {TearStream} from './viewer-tear-stream.js?v=kai59b';
import {fittedLipPigment} from './viewer-lip-pigment.js?v=mika32c';
import * as THREE from 'three';
import {HeadPortraitDetails} from './emotion-head-portrait.js?v=kai49b';
import {clamp} from './emotion-core.js?v=10';
import {surfaceAnchor,lidEnvelope,mouthCavityWeight} from './emotion-surface.js?v=perf91';
import {FacePaint} from './viewer-face-paint.js?v=mika32c';
// Pigment is a separate animated layer over the accepted skin texture.
// Its rest-space UV mask is baked once; frames only update a uniform.
export class EmotionHeadEffects{
 constructor(head){this.head=head;this.model=null;this.mask=null;this.patched=new WeakSet();this.amount={value:0};this.lipAmount={value:0};this.lipTint={value:new THREE.Color()};this.tint={value:new THREE.Color('#fa667c')};this.supported=false;this.faceClones=new WeakMap();this.ownedMaterials=[];this.water=null;this.lids=null;this.channels=[];this.portrait=null;}
 ensure(){
  const h=this.head;if(!h.ready||!h.socketMesh||!h.faceEditor)return;
  if(this.model!==h.vrm){this.portrait?.dispose();this.portrait=null;this.water?.dispose();this.water=null;this.lids?.dispose();this.lids=null;this.mask?.dispose();this.mask=null;this.model=h.vrm;this.patched=new WeakSet();for(const m of this.ownedMaterials)m.dispose();this.ownedMaterials=[];this.faceClones=new WeakMap();}
  if(!this.portrait)this.portrait=new HeadPortraitDetails(h);this.portrait.update(h.emotionLayer.adapter.profile,h.emotionLayer.adapter.character);
  const cavity=h.emotionLayer.adapter.profile.procedural?.mouthCavity,maskKey=JSON.stringify([cavity,Boolean(h.settings.appearance.lipContourFit)]);
  if(!this.mask||this.maskKey!==maskKey){
   const paint=h.appearance?.paint||new FacePaint(h,512),n=paint.valid.length,data=new Uint8Array(n*4);
   for(let i=0;i<n;i++){
    const x=paint.points[i*3],y=paint.points[i*3+1],z=paint.points[i*3+2],front=Math.max(0,Math.min(1,(z-.035)/.02));
    const cheeks=Math.exp(-2*(((Math.abs(x)-.043)/.027)**2+((y-1.472)/.015)**2));
    const bridge=.4*Math.exp(-2*((x/.032)**2+((y-1.475)/.009)**2));
    const value=paint.valid[i]?Math.round(Math.min(1,cheeks+bridge)*front*255):0;
    data.set([value,paint.valid[i]?Math.round(mouthCavityWeight((i%paint.size+.5)/paint.size,(Math.floor(i/paint.size)+.5)/paint.size,cavity)*255):0,h.settings.appearance.lipContourFit?Math.round(fittedLipPigment(x,y,z)*255):0,255],i*4);
   }
   if(this.mask)this.mask.image={data,width:paint.size,height:paint.size};else this.mask=new THREE.DataTexture(data,paint.size,paint.size,THREE.RGBAFormat);this.maskKey=maskKey;this.mask.flipY=false;this.mask.minFilter=this.mask.magFilter=THREE.LinearFilter;this.mask.needsUpdate=true;
  }
  // The anatomy view can share a skin material with the torso. Keep the
  // expression layer on the face even in that unpainted configuration.
  const shared=new Set([].concat(h.bodyMesh?.material||[]));
  const faceOnly=material=>{if(!shared.has(material))return material;let clone=this.faceClones.get(material);if(!clone){clone=material.clone();clone.onBeforeCompile=material.onBeforeCompile;clone.customProgramCacheKey=material.customProgramCacheKey;this.faceClones.set(material,clone);this.ownedMaterials.push(clone);}if(clone.color&&material.color)clone.color.copy(material.color);return clone;};
  h.socketMesh.material=Array.isArray(h.socketMesh.material)?h.socketMesh.material.map(faceOnly):faceOnly(h.socketMesh.material);
  for(const material of [].concat(h.socketMesh.material)){
   if(!material||material.isOutline||this.patched.has(material))continue;
   const before=material.onBeforeCompile,cache=material.customProgramCacheKey?.bind(material);
   material.onBeforeCompile=(shader,renderer)=>{
    before?.call(material,shader,renderer);
    if(!shader.vertexShader.includes('#include <begin_vertex>')||!shader.fragmentShader.includes('#include <color_fragment>'))return;
    const cavityCode='\n// cj-mouth-cavity\ndiffuseColor.rgb=mix(diffuseColor.rgb,cjEmotionLipTint,texture2D(cjEmotionBlushMask,cjEmotionUv).b*cjEmotionLip);\ndiffuseColor.rgb=mix(diffuseColor.rgb,vec3(.045,.01,.018),texture2D(cjEmotionBlushMask,cjEmotionUv).g*.98);';
    if(shader.vertexShader.includes('varying vec2 cjEmotionUv;')){if(!shader.fragmentShader.includes('cj-mouth-cavity'))shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>'+cavityCode);Object.assign(shader.uniforms,{cjEmotionLip:this.lipAmount,cjEmotionLipTint:this.lipTint,cjEmotionBlush:this.amount,cjEmotionBlushTint:this.tint,cjEmotionBlushMask:{value:this.mask}});return;}
    shader.uniforms.cjEmotionLip=this.lipAmount;shader.uniforms.cjEmotionLipTint=this.lipTint;shader.uniforms.cjEmotionBlush=this.amount;shader.uniforms.cjEmotionBlushTint=this.tint;shader.uniforms.cjEmotionBlushMask={value:this.mask};
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 cjEmotionUv;').replace('#include <begin_vertex>','#include <begin_vertex>\ncjEmotionUv=uv;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 cjEmotionUv;\nuniform sampler2D cjEmotionBlushMask;\nuniform float cjEmotionLip;\nuniform vec3 cjEmotionLipTint;\nuniform float cjEmotionBlush;\nuniform vec3 cjEmotionBlushTint;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*cjEmotionBlushTint,texture2D(cjEmotionBlushMask,cjEmotionUv).r*cjEmotionBlush*.62);'+cavityCode);
   };
   material.customProgramCacheKey=()=>String(cache?.()||'')+'|cj-portrait-face-v32';material.needsUpdate=true;this.patched.add(material);
  }
  if(!this.water)this.water=new FaceWater(h);if(!this.lids)this.lids=new LidOcclusion(h);
  this.supported=true;this.channels=['effect.blush',...new Set(this.water.paths.map(p=>'effect.'+p.type))];
 }
 invalidateProfile(){this.portrait?.dispose();this.portrait=null;this.water?.dispose();this.water=null;if(this.lids)this.lids.cachedKey='';}
 apply(frame,amount=0){this.ensure();this.amount.value=frame?Math.max(0,Math.min(1,amount)):0;this.tint.value.set(this.head.settings.appearance.blushColor||'#fa667c');const look=this.head.settings.appearance;const opening=frame?Math.max(0,Math.min(1,((frame['mouth.open']||0)-.08)/.42)):0;this.lipAmount.value=opening*(look.lipContourFit||0)*.82;this.lipTint.value.set(look.skin||'#f2cfc1').multiply(new THREE.Color(look.lipColor||'#9556ad'));this.lids?.update(frame);this.water?.update(frame,this.head.emotionLayer?.player.motionTime||0);}
}

// Eye surfaces are clipped to the CURRENT lash contours, including sculpt and asymmetry.
class LidOcclusion{
 constructor(head){this.head=head;this.patched=new WeakSet();this.worldToFace={value:new THREE.Matrix4()};this.active={value:0};this.curves=[{value:new Float32Array(64)},{value:new Float32Array(64)}];this.point=new THREE.Vector3();this.matrix=new THREE.Matrix4();this.cachedKey='';this.meshData=new Map();this.depthMaterials=new Map();this.depthMeshes=new Map();}
 update(frame){
  const h=this.head,config=h.emotionLayer?.adapter.profile.procedural?.eyeOcclusion;if(!config||!h.socketMesh){this.active.value=0;return;}
  const name=mesh=>[].concat(h.originalMaterials.get(mesh)||mesh.material).map(m=>m.name||'');
  // Sclera and iris are nearly coplanar donor surfaces. Native lid morphs
  // deform only the sclera, which can then write depth in front of the iris.
  // Draw the white first without writing depth; the iris still tests against
  // real skin, lashes, hair and the rest of the scene.
  const white=h.meshes.filter(m=>name(m).some(n=>n.startsWith(config.scleraMaterialPrefix||'KK cf_m_sirome_00'))),irises=h.meshes.filter(m=>name(m).some(n=>n.startsWith(config.irisMaterialPrefix||'KK cf_m_hitomi_00')));
  for(const mesh of [...white,...irises])if(!this.depthMeshes.has(mesh))this.depthMeshes.set(mesh,mesh.renderOrder);
  const base=Math.min(...[...white,...irises].map(m=>this.depthMeshes.get(m)));
  if(Number.isFinite(base)){for(const mesh of white){mesh.renderOrder=base+1;for(const material of [].concat(mesh.material)){if(!this.depthMaterials.has(material))this.depthMaterials.set(material,material.depthWrite);material.depthWrite=false;}}for(const mesh of irises)mesh.renderOrder=base+2;}
  const upper=h.meshes.find(m=>name(m).some(n=>n.startsWith(config.upperMaterialPrefix))),lower=h.meshes.find(m=>name(m).some(n=>n.startsWith(config.lowerMaterialPrefix)));if(!upper||!lower)return;
  h.socketMesh.updateWorldMatrix(true,false);this.worldToFace.value.copy(h.socketMesh.matrixWorld).invert();
  for(const mesh of h.meshes){if(!name(mesh).some(n=>config.eyeMaterialPrefixes.some(prefix=>n.startsWith(prefix))))continue;
   for(const material of [].concat(mesh.material)){if(this.patched.has(material))continue;const before=material.onBeforeCompile,cache=material.customProgramCacheKey?.bind(material);
    material.onBeforeCompile=(shader,renderer)=>{before?.call(material,shader,renderer);if(!shader.vertexShader.includes('#include <project_vertex>'))return;
     if(shader.vertexShader.includes('uniform mat4 cjEyeWorldToFace;')){Object.assign(shader.uniforms,{cjEyeWorldToFace:this.worldToFace,cjEyeClip:this.active,cjEyeLeft:this.curves[0],cjEyeRight:this.curves[1]});return;}
     Object.assign(shader.uniforms,{cjEyeWorldToFace:this.worldToFace,cjEyeClip:this.active,cjEyeLeft:this.curves[0],cjEyeRight:this.curves[1]});
     shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform mat4 cjEyeWorldToFace; varying vec2 cjEyePoint;').replace('#include <project_vertex>','cjEyePoint=(cjEyeWorldToFace*modelMatrix*vec4(transformed,1.0)).xy;\n#include <project_vertex>');
     // Lower lashes are disconnected texture strokes, not an opaque eyelid band.
     // Skin and lash depth provide the lower rim; only the continuous upper band clips eyes.
     const declarations='\nvarying vec2 cjEyePoint; uniform float cjEyeClip; uniform vec4 cjEyeLeft[16]; uniform vec4 cjEyeRight[16];\n';
     shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>'+declarations).replace(/void main\s*\(\s*\)\s*\{/,`void main(){
      if(cjEyeClip>.5){float x=cjEyePoint.x; vec4 a=x>0.?cjEyeLeft[0]:cjEyeRight[0]; vec4 b=x>0.?cjEyeLeft[15]:cjEyeRight[15]; if(x<a.x||x>b.x)discard;
       for(int i=0;i<15;i++){vec4 lo=x>0.?cjEyeLeft[i]:cjEyeRight[i];vec4 hi=x>0.?cjEyeLeft[i+1]:cjEyeRight[i+1];if(x>=lo.x&&x<=hi.x){float u=(x-lo.x)/max(hi.x-lo.x,.000001);vec2 edge=mix(lo.yz,hi.yz,u);if(cjEyePoint.y>edge.x-.00012)discard;}}
      }`);
    };material.customProgramCacheKey=()=>String(cache?.()||'')+'|cj-eye-contour-v9';material.needsUpdate=true;this.patched.add(material);
   }
  }
  if(!frame){this.active.value=0;return;}
  const read=mesh=>{let data=this.meshData.get(mesh);if(!data){const cosmetic=h.settings.appearance.lashBand||h.settings.appearance.lowerLiner,material=[].concat(cosmetic?(h.originalMaterials.get(mesh)||mesh.material):mesh.material).find(m=>m.map?.image),image=material?.map?.image;let alpha=null;if(image){const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);alpha={data:ctx.getImageData(0,0,canvas.width,canvas.height).data,width:canvas.width,height:canvas.height,flipY:material.map.flipY};}data={positions:new Float32Array(mesh.geometry.attributes.position.count*3),indices:mesh.geometry.index.array,uv:mesh.geometry.attributes.uv.array,alpha};this.meshData.set(mesh,data);}mesh.updateWorldMatrix(true,false);this.matrix.multiplyMatrices(this.worldToFace.value,mesh.matrixWorld);for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,this.point).applyMatrix4(this.matrix).toArray(data.positions,i*3);}return data;};
  // Paused frames reuse contours; bone gaze does not deform the lash meshes.
  const key=[...upper.morphTargetInfluences,...lower.morphTargetInfluences,upper.geometry.attributes.position.version,lower.geometry.attributes.position.version].join(',');
  if(key!==this.cachedKey){const up=read(upper),down=read(lower),left=lidEnvelope(up,down,1),right=lidEnvelope(up,down,-1);if(left&&right){this.curves[0].value.set(left);this.curves[1].value.set(right);this.active.value=1;}else this.active.value=0;this.cachedKey=key;}else this.active.value=1;
 }
 dispose(){this.active.value=0;for(const [mesh,order]of this.depthMeshes)mesh.renderOrder=order;for(const [material,value]of this.depthMaterials)material.depthWrite=value;this.depthMeshes.clear();this.depthMaterials.clear();}
}
class FaceWater{
 constructor(head){
  this.head=head;this.face=head.socketMesh;this.group=new THREE.Group();this.group.name='Cyberjack · пот / слёзы / слюна';this.face.add(this.group);this.point=new THREE.Vector3();this.temp=new THREE.Vector3();this.yAxis=new THREE.Vector3(0,1,0);this.delta=new THREE.Vector3();
  this.sphere=new THREE.SphereGeometry(1,12,8);this.cylinder=new THREE.CylinderGeometry(1,1,1,8,1,true);this.material=new THREE.MeshStandardMaterial({color:'#a8ccd6',roughness:.12,metalness:.05,transparent:true,opacity:.48,depthWrite:false});this.glint=new THREE.MeshBasicMaterial({color:'#f0fbff',transparent:true,opacity:.78,depthWrite:false});this.paths=[];
  const c=head.faceEditor.cache.get(this.face),position=c.position,indices=this.face.geometry.index.array;
  const anchor=point=>surfaceAnchor(position,indices,point);
  const path=(type,coords,seed,radius,followTongue=false)=>{if(type==='tears'){this.paths.push({type,stream:new TearStream(head,this.group,coords,seed,radius)});return;}const anchors=coords.map(anchor),line=coords.map(()=>new THREE.Vector3()),segments=[];
   if(type!=='sweat')for(let i=1;i<coords.length;i++){const tube=new THREE.Mesh(this.cylinder,this.material),shine=new THREE.Mesh(this.cylinder,this.glint);tube.renderOrder=12;shine.renderOrder=13;tube.scale.setScalar(0);shine.scale.setScalar(0);tube.position.set(0,1.47,.07);shine.position.copy(tube.position);this.group.add(tube,shine);segments.push([tube,shine]);}
   const drop=new THREE.Mesh(this.sphere,this.material),highlight=new THREE.Mesh(this.sphere,this.glint);drop.renderOrder=14;highlight.renderOrder=15;drop.scale.setScalar(0);highlight.scale.setScalar(0);drop.position.set(0,1.47,.07);highlight.position.copy(drop.position);this.group.add(drop,highlight);this.paths.push({type,anchors,line,segments,drop,highlight,seed,radius,followTongue});};
  const config=head.emotionLayer?.adapter.profile.procedural?.waterEffects;
  for(const row of config?.paths||[])path(row.type,row.points,row.seed,row.radius,row.followTongue);
  this.tongue=head.meshes.find(m=>[].concat(head.originalMaterials.get(m)||m.material).some(m=>m.name?.startsWith(config?.tongueMaterialPrefix||'__unbound__')));

 }
 get(anchor,out){out.set(0,0,0);for(let i=0;i<3;i++){this.face.getVertexPosition(anchor.ids[i],this.temp);out.addScaledVector(this.temp,anchor.weights[i]);}out.z+=.0008;return out;}
 update(frame,time){
  this.group.visible=Boolean(frame);if(!frame)return;
  for(const path of this.paths){if(path.stream){path.stream.update(clamp(frame['effect.tears']||0),time);continue;}const amount=clamp(frame['effect.'+path.type]||0),visible=amount>.005;path.drop.visible=path.highlight.visible=visible;for(const pair of path.segments)for(const mesh of pair)mesh.visible=visible;if(!visible)continue;
   for(let i=0;i<path.anchors.length;i++)this.get(path.anchors[i],path.line[i]);
   if(path.type==='saliva'&&path.followTongue&&(frame['mouth.tongueOut']||0)>.4&&this.tongue){let maxZ=-Infinity;for(let i=0;i<this.tongue.geometry.attributes.position.count;i++){this.tongue.getVertexPosition(i,this.temp);maxZ=Math.max(maxZ,this.temp.z);}let low=Infinity;for(let i=0;i<this.tongue.geometry.attributes.position.count;i++){this.tongue.getVertexPosition(i,this.temp);if(this.temp.z>maxZ-.004&&this.temp.y<low){low=this.temp.y;path.line[0].copy(this.temp);}}path.line[0].z+=.001;path.line[1].copy(path.line[0]).add(new THREE.Vector3(0,-.009,.001));}
   const phase=(time*(path.type==='tears'?.14:path.type==='sweat'?.08:.18)+path.seed)%1,u=phase*(path.line.length-1),i=Math.min(path.line.length-2,Math.floor(u));path.drop.position.lerpVectors(path.line[i],path.line[i+1],u-i);
   const radius=path.radius*Math.sqrt(amount)*(.75+.25*Math.sin(phase*Math.PI));path.drop.scale.set(radius,radius*1.7,radius*.55);path.highlight.position.copy(path.drop.position).add(new THREE.Vector3(-radius*.28,radius*.4,radius*.53));path.highlight.scale.set(radius*.2,radius*.55,radius*.13);
   for(let j=0;j<path.segments.length;j++){const a=path.line[j],b=path.line[j+1];this.delta.subVectors(b,a);const length=this.delta.length(),[tube,shine]=path.segments[j],width=(path.type==='saliva'?.00028:.00048)*Math.sqrt(amount);for(const mesh of [tube,shine]){mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(this.yAxis,this.delta.clone().normalize());}tube.scale.set(width,length,width*.65);shine.position.z+=width*.7;shine.position.x-=width*.25;shine.scale.set(width*.18,length,width*.16);}
  }
 }
 dispose(){for(const path of this.paths)path.stream?.dispose();this.group.removeFromParent();this.sphere.dispose();this.cylinder.dispose();this.material.dispose();this.glint.dispose();}
}
