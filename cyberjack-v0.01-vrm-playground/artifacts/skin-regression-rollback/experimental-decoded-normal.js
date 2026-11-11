import * as THREE from 'three';
// Display-only adjustments. Original material values are restored at strength zero.
function materialKind(name){name=name.toLowerCase();return name.includes('hair')?'hair':name.includes('cf_m_face')?'face':name.includes('body')?'skin':/eye|hitomi|sirome|mayuge|nose|kuti|tooth|tang/.test(name)?'detail':'cloth'}
export function createRenderStyle({vrm,renderer,scene,light,fill,hemisphere,floor}){
 const amount={value:0},cartoon={value:0},blender={value:0},lineWidth={value:0},materials=new Set(),shells=[];
 vrm.scene.traverse(o=>{if(o.isMesh)for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m)});
 // Inverted hulls share the live skeleton and morph weights; no VRM is rewritten.
 const meshes=[];vrm.scene.traverse(o=>{if(o.isMesh)meshes.push(o)});
 for(const source of meshes){
  const sourceMaterials=Array.isArray(source.material)?source.material:[source.material];
  if(sourceMaterials.every(m=>m.isOutline))continue;
  const ink=sourceMaterials.map(m=>{
   const material=new THREE.MeshBasicMaterial({color:'#25232b',side:THREE.BackSide,map:m.map||null,alphaTest:.45,depthWrite:true});
   material.userData.canOutline=!m.isOutline&&m.opacity>.05;material.userData.kind=materialKind(m.name);material.visible=material.userData.canOutline;
   material.onBeforeCompile=shader=>{shader.uniforms.cartoonLineWidth=lineWidth;shader.vertexShader='uniform float cartoonLineWidth;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n transformed += normalize(normal) * cartoonLineWidth;')};
   material.customProgramCacheKey=()=> 'cartoon-inverted-hull-v1';return material;
  });
  const shell=source.clone(false);shell.name=source.name+'__cartoon_ink';shell.material=Array.isArray(source.material)?ink:ink[0];shell.castShadow=false;shell.receiveShadow=false;shell.frustumCulled=false;shell.visible=false;shell.renderOrder=source.renderOrder-1;
  if(source.isSkinnedMesh){shell.skeleton=source.skeleton;shell.bindMatrix.copy(source.bindMatrix);shell.bindMatrixInverse.copy(source.bindMatrixInverse)}
  shell.morphTargetInfluences=source.morphTargetInfluences;source.parent.add(shell);shells.push({source,shell});
 }
 const originals=[];
 for(const m of materials){
  const fields={};for(const k of ['visible','normalScale','shadeColorFactor','outlineColorFactor','outlineWidthFactor','shadingToonyFactor','giEqualizationFactor'])if(m[k]!==undefined)fields[k]=(m[k]?.isColor||m[k]?.isVector2)?m[k].clone():m[k];
  originals.push({m,fields});
  const previous=m.onBeforeCompile.bind(m),cache=m.customProgramCacheKey.bind(m);
  m.onBeforeCompile=(shader,r)=>{previous(shader,r);shader.uniforms.mangaStrength=amount;shader.uniforms.cartoonStrength=cartoon;shader.uniforms.blenderStrength=blender;shader.fragmentShader='uniform float mangaStrength; uniform float cartoonStrength; uniform float blenderStrength;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',`#include <colorspace_fragment>
   float mangaLuma=dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722));
   vec3 mangaColor=mix(gl_FragColor.rgb,vec3(mangaLuma),.06);
   float mangaDark=pow(1.0-clamp(mangaLuma,0.0,1.0),3.0);
   mangaColor+=vec3(.032,.034,.04)*mangaDark;
   float mangaPurple=max(0.0,min(mangaColor.r,mangaColor.b)-mangaColor.g);
   mangaColor.g+=mangaPurple*.12;
   gl_FragColor.rgb=mix(gl_FragColor.rgb,clamp(mangaColor,0.0,1.0),mangaStrength);
   // Graphic color steps, while retaining the source texture and its alpha.
   vec3 cartoonColor=floor(clamp(gl_FragColor.rgb,0.0,1.0)*7.0+.5)/7.0;
   gl_FragColor.rgb=mix(gl_FragColor.rgb,cartoonColor,cartoonStrength);`)};
  const beforeStyle=m.onBeforeCompile;
  const kind=materialKind(m.name);
  if(m.isMToonMaterial&&!m.isOutline&&!['detail','skin'].includes(kind)){
   m.onBeforeCompile=(shader,r)=>{beforeStyle(shader,r);
    const palette={hair:[.17,.18,.21],cloth:[.23,.25,.31],skin:[.96,.9,.9],face:[.98,.94,.94]}[kind];
    const shade={hair:[.58,.60,.69],cloth:[.58,.60,.71],skin:[.88,.82,.86],face:[.94,.88,.90]}[kind];
    const factor={hair:.28,cloth:.16,skin:.035,face:.015}[kind];
    const marker='  gl_FragColor = vec4( col, diffuseColor.a );\n  postCorrection();';
    const at=shader.fragmentShader.lastIndexOf(marker);
    if(at<0)throw Error('Blender style: unsupported MToon shader');
    const code=`
     float studyDirection=dot(inverseTransformDirection(normalize(vNormal),viewMatrix),vec3(-.45,.6,.65));
     float studyLight=${kind==='face'?'smoothstep(.10,.75,studyDirection)':kind==='skin'?'smoothstep(.15,.70,studyDirection)':'step(.45,studyDirection)'};
     vec3 studyBase=mix(diffuseColor.rgb,vec3(${palette.join(',')}),${factor});
     vec3 studyColor=studyBase*mix(vec3(${shade.join(',')}),vec3(1.0),studyLight);
     col=mix(col,studyColor,blenderStrength);
`;
    shader.fragmentShader=shader.fragmentShader.slice(0,at)+code+shader.fragmentShader.slice(at);
   };
  }
  if(kind==='skin'&&!m.isOutline){
   const originalSkin=m.onBeforeCompile;
   m.onBeforeCompile=(shader,r)=>{originalSkin(shader,r);
    shader.fragmentShader=shader.fragmentShader.replace('vec3 mapN = texture2D( normalMap, normalMapUv ).xyz * 2.0 - 1.0;',`vec4 packedSkinNormal=texture2D(normalMap,normalMapUv);
     float decodedGreen=packedSkinNormal.g<=.04045?packedSkinNormal.g/12.92:pow((packedSkinNormal.g+.055)/1.055,2.4);
     vec2 skinNormalXY=vec2(packedSkinNormal.a,decodedGreen)*2.0-1.0;
     vec3 mapN=vec3(skinNormalXY,sqrt(max(0.0,1.0-dot(skinNormalXY,skinNormalXY))));`);
   };
  }
  m.customProgramCacheKey=()=>cache()+'|blender-study-source-skin-baseline|'+kind;
m.needsUpdate=true;
  if(m.map){m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());m.map.needsUpdate=true}
 }
 const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,4,64,64,64);g.addColorStop(0,'rgba(60,55,65,.22)');g.addColorStop(.45,'rgba(60,55,65,.10)');g.addColorStop(1,'rgba(60,55,65,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
 const contact=new THREE.Mesh(new THREE.PlaneGeometry(.65,.42),new THREE.MeshBasicMaterial({map:new THREE.CanvasTexture(canvas),transparent:true,depthWrite:false,opacity:0}));contact.rotation.x=-Math.PI/2;contact.position.y=.002;scene.add(contact);
 let current={preset:'original',strength:1};
 function set(preset='manga2',strength=1){current={preset:['original','manga2','cartoon','blender'].includes(preset)?preset:'original',strength:Math.max(0,Math.min(1,Number(strength)||0))};const b=current.preset==='blender'?current.strength:0;blender.value=b;const c=current.preset==='cartoon'?current.strength:0;const a=current.preset==='original'?0:current.strength;amount.value=b>0?0:a*(c>0?.35:1);cartoon.value=c;lineWidth.value=.0035*c+.0008*b;for(const {shell}of shells)for(const ink of Array.isArray(shell.material)?shell.material:[shell.material])ink.visible=ink.userData.canOutline&&(!b||['hair','cloth'].includes(ink.userData.kind));for(const {source,shell}of shells)shell.visible=c>0&&source.visible;
  for(const {m,fields}of originals){for(const [k,v]of Object.entries(fields)){if(v?.isColor||v?.isVector2)m[k].copy(v);else m[k]=v}
   if(c>0){
    if(fields.shadingToonyFactor!==undefined)m.shadingToonyFactor=THREE.MathUtils.lerp(fields.shadingToonyFactor,.98,c);
    if(m.isOutline){m.outlineWidthFactor=0;m.visible=false;}
   }
   if(b>0&&m.isOutline){m.visible=['hair','cloth'].includes(materialKind(m.name));m.outlineWidthFactor=THREE.MathUtils.lerp(fields.outlineWidthFactor||0,.0008,b);m.outlineColorFactor?.setRGB(.035,.032,.045);}
   // Preserve the authored shade colors and lighting contrast.
   if(m.outlineColorFactor&&b===0)m.outlineColorFactor.lerp(new THREE.Color('#24232a'),a*.6);
   if(fields.outlineWidthFactor>0&&!m.isOutline)m.outlineWidthFactor=THREE.MathUtils.lerp(fields.outlineWidthFactor,Math.min(Math.max(fields.outlineWidthFactor*1.25,.0007),.002),a);
   
  }
  light.intensity=2.1;hemisphere.intensity=1.5;fill.intensity=.6;
  light.position.set(-2,4,3);renderer.shadowMap.enabled=a<1;light.castShadow=a<1;light.shadow.intensity=1-a;floor.receiveShadow=a<1;contact.material.opacity=a;
 }
 return {set,get state(){return {...current,skinPolicy:'source-skin-baseline-no-filter',materials:materials.size,blenderMaterials:originals.filter(x=>!x.m.isOutline&&materialKind(x.m.name)!=='detail').length,outlineMeshes:shells.length}},update(){for(const {source,shell}of shells){shell.position.copy(source.position);shell.quaternion.copy(source.quaternion);shell.scale.copy(source.scale);shell.visible=cartoon.value>0&&source.visible;shell.morphTargetInfluences=source.morphTargetInfluences}contact.position.x=vrm.scene.position.x;contact.position.z=vrm.scene.position.z}};
}
