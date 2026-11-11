import {applyMouthExpressions} from './viewer-mouth-expressions.js?v=2';
import {refineMouth} from './viewer-mouth-refine.js?v=lip-rolls-2';
import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/loaders/GLTFLoader.js';
import {VRMLoaderPlugin} from './vendor/three-vrm/three-vrm.module.js';
import {FaceAppearance,cleanAppearance} from './viewer-face-appearance.js?v=kate78';
import {FaceEditor} from './viewer-face.js?v=kate78';
import {HeadSocket} from './viewer-neck.js?v=runtime92';

export class ViewerHead{
  constructor({parent,bodyMesh,faceMesh,base,index,onChange}){
    Object.assign(this,{parent,bodyMesh,faceMesh,onChange,base,index});this.originalBody=bodyMesh.geometry;this.root=new THREE.Group();this.root.name='Сменная голова · VRM 1.0';parent.add(this.root);this.yup=new THREE.Group();this.yup.rotation.x=Math.PI/2;this.root.add(this.yup);this.origin=new THREE.Group();this.yup.add(this.origin);
    this.settings={style:'mira',materials:'clay',expressions:{},lookX:0,lookY:0,face:{},appearance:{}};this.ready=false;this.meshes=[];this.originalMaterials=new Map();this.restMatrices=new Map();this.clay=bodyMesh.material;this.request=null;this.socket=null;this.root.visible=false;this.bodyMesh.visible=false;if(this.faceMesh)this.faceMesh.visible=false;
  }
  async load(){
    if(this.request)return this.request;
    this.request=(async()=>{
      this.manifest=await fetch('./assets/heads/mira/module.json').then(r=>{if(!r.ok)throw Error('head metadata '+r.status);return r.json();});
      const loader=new GLTFLoader();loader.register(parser=>new VRMLoaderPlugin(parser,{autoUpdateHumanBones:false}));const gltf=await loader.loadAsync('./assets/heads/mira/head.vrm');this.vrm=gltf.userData.vrm;if(this.vrm?.meta?.metaVersion!=='1')throw Error('Требуется VRM 1.0');
      this.document=gltf;gltf.scene.updateMatrixWorld(true);this.eyeRest=Object.fromEntries(['leftEye','rightEye'].map(name=>{const node=this.vrm.humanoid.getRawBoneNode(name);return [name,{node,parentInverse:node.parent.matrixWorld.clone().invert()}];}));this.sourceEyes=Object.fromEntries(['leftEye','rightEye'].flatMap(name=>{const node=this.vrm.humanoid.getRawBoneNode(name);return node?[[name,node.getWorldPosition(new THREE.Vector3()).toArray()]]:[];}));gltf.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;this.meshes.push(o);this.restMatrices.set(o,o.matrixWorld.clone());this.originalMaterials.set(o,o.material);}});
      this.socketMesh=this.meshes[this.manifest.socketPrimitive];if(!this.socketMesh||!this.manifest.donorNeckRemoved)throw Error('Требуется модуль головы без шеи');
      refineMouth(this.socketMesh);
      this.origin.position.fromArray(this.manifest.sourceHead).multiplyScalar(-1);this.origin.add(gltf.scene);this.yup.scale.setScalar(this.manifest.fitScale);
      this.vrm.humanoid.autoUpdateHumanBones=false;if(this.vrm.lookAt)this.vrm.lookAt.autoUpdate=false;
      this.root.position.fromArray(Anatomy.getRig().bones.find(b=>b.name==='head').head);
      this.socket=new HeadSocket(this.parent,this.base,this.index,this.socketMesh,this.manifest);this.faceEditor=new FaceEditor(this);this.appearance=new FaceAppearance(this);this.ready=true;this.apply();this.onChange?.();
    })().catch(e=>{
      this.request=null;this.ready=false;this.root.visible=false;this.origin.clear();
      this.bodyMesh.geometry=this.originalBody;this.bodyMesh.visible=this.settings.style==='legacy';
      if(this.faceMesh)this.faceMesh.visible=this.settings.style==='legacy';
      this.meshes=[];this.originalMaterials.clear();this.restMatrices.clear();
      this.socket=null;this.socketMesh=null;this.faceEditor=null;this.appearance=null;this.cachedAppearanceKey=null;
      throw e;
    });return this.request;
  }
  apply(){
    const appearanceKey=this.cacheStaticAppearance&&this.ready?JSON.stringify([this.settings,this.neckRatio]):null;
    if(appearanceKey&&appearanceKey===this.cachedAppearanceKey)return;

    const active=this.ready&&this.settings.style==='mira';this.root.visible=active;if(this.faceMesh)this.faceMesh.visible=this.settings.style==='legacy';this.bodyMesh.visible=active||this.settings.style==='legacy';this.bodyMesh.geometry=active?this.socket.geometry:this.originalBody;
    this.appearance?.apply(this.settings.appearance);
    for(const mesh of this.meshes){const original=this.originalMaterials.get(mesh);if(this.settings.materials==='clay'&&[].concat(original).some(m=>/cf_m_(face_00|body)$/.test(m.name)))mesh.material=this.appearance.clayMaterial();else mesh.material=this.appearance.material(mesh);}
    const previousFaceKey=this.faceEditor?.key;this.faceEditor?.apply(this.settings.face);
    for(const mesh of this.meshes)for(const material of [].concat(mesh.material)){if(this.faceEditor?.key!==previousFaceKey)material.needsUpdate=true;if(material.isShaderMaterial)material.uniformsNeedUpdate=true;}
    this.applyExpressions();
    if(appearanceKey)this.cachedAppearanceKey=appearanceKey;
  }
  // Animation changes weights only: sculpted geometry and appearance stay cached.
  applyExpressions(){
    if(!this.vrm)return;
    applyMouthExpressions(this);
    const layer=this.emotionLayer,frame=layer?.player.active?layer.player.frame():null;
    layer?.adapter.prepare(frame);
    for(const expression of this.vrm.expressionManager.expressions)this.vrm.expressionManager.setValue(expression.expressionName,Number(this.settings.expressions[expression.expressionName]||0));
    if(!layer&&this.vrm.lookAt){this.vrm.lookAt.yaw=this.settings.lookX*25;this.vrm.lookAt.pitch=this.settings.lookY*20;}
    this.vrm.update(0);
    if(frame)layer.adapter.apply(frame,layer.player.speech);
    this.appearance?.updateLashes();
    for(const mesh of this.meshes)for(const material of [].concat(mesh.material))if(typeof material.update==='function')material.update(0);
  }
  attachmentOffset(weights,pose=null){
    const offset=this.ready&&this.settings.style==='mira'?this.manifest.canonicalFit?.attachmentOffset:null,v=new THREE.Vector3().fromArray(offset||[0,0,0]).multiplyScalar(Anatomy.ratios(weights).height);
    if(pose){const i=Anatomy.getRig().bones.findIndex(b=>b.name==='neck');v.applyQuaternion(new THREE.Quaternion().fromArray(pose.q[i]));}return v;
  }
  update(weights,pose,source){
    this.weights=weights;this.pose=pose;this.currentSource=source;this.neckRatio=Anatomy.ratios(weights).neck_w;this.apply();if(!this.ready||this.settings.style!=='mira')return;
    const rig=Anatomy.getRig(),i=rig.bones.findIndex(b=>b.name==='head'),h=rig.bones[i].head,{A,t}=Anatomy.transforms(weights)[i],r=Anatomy.ratios(weights),point=pose?pose.posed[i]:h.map((_,k)=>(A[k*3]*h[0]+A[k*3+1]*h[1]+A[k*3+2]*h[2]+t[k])*r.height);
    this.root.position.fromArray(point).add(this.attachmentOffset(weights,pose));this.root.quaternion.fromArray(pose?pose.q[i]:[0,0,0,1]);this.root.scale.set(r.height*r.head_size*r.head_w,r.height*r.head_size,r.height*r.head_size);
    this.parent.updateWorldMatrix(true,false);this.parent.updateMatrixWorld(true);this.socket.update(source,r.neck_w,true);
  }
  readHash(hash){const p=new URLSearchParams(hash.replace(/^#/,''));if(['mira','legacy'].includes(p.get('head')))this.settings.style=p.get('head');if(['clay','vrm'].includes(p.get('head_materials')))this.settings.materials=p.get('head_materials');for(const [k,v] of p){if(k.startsWith('paint_')){try{Object.assign(this.settings.appearance,cleanAppearance({[k.slice(6)]:Number(v)}));}catch{}}if(k.startsWith('color_')){try{Object.assign(this.settings.appearance,cleanAppearance({[k.slice(6)]:v}));}catch{}}if(k.startsWith('face_')&&Number.isFinite(Number(v)))this.settings.face[k.slice(5)]=THREE.MathUtils.clamp(Number(v),-1,1);if(k.startsWith('expr_')&&Number.isFinite(Number(v)))this.settings.expressions[k.slice(5)]=THREE.MathUtils.clamp(Number(v),0,1);}for(const k of ['lookX','lookY'])if(p.has(k))this.settings[k]=THREE.MathUtils.clamp(Number(p.get(k))||0,-1,1);}
  hash(){const p=new URLSearchParams({head:this.settings.style});for(const [k,v] of Object.entries(this.settings.appearance))p.set((typeof v==='number'?'paint_':'color_')+k,String(v));for(const [k,v] of Object.entries(this.settings.face))if(v)p.set('face_'+k,String(v));if(this.settings.materials!=='clay')p.set('head_materials',this.settings.materials);for(const [k,v] of Object.entries(this.settings.expressions))if(v)p.set('expr_'+k,String(v));for(const k of ['lookX','lookY'])if(this.settings[k])p.set(k,String(this.settings[k]));return p.toString();}
  reset(){Object.assign(this.settings,{style:'mira',materials:'clay',expressions:{},lookX:0,lookY:0,face:{},appearance:{}});this.apply();}
}
