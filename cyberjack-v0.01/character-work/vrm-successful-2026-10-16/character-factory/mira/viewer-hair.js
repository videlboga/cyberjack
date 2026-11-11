import {cleanHairPhysics} from './viewer-hair-physics.js?v=4';
import {sideSurface,clearFaceHair,rebaseFaceHair} from './viewer-hair-clearance.js?v=sumi42';
import {BuiltinHair,builtinHairCategories} from './viewer-builtin-hair.js?v=runtime92c';
export {builtinHairCategories};
import {KateHair,kateHairControls} from './viewer-kate-hair.js?v=4';
export {kateHairControls};
import * as THREE from 'three';
import {GLTFLoader} from './vendor/three/loaders/GLTFLoader.js';

// Attachment lives in the same Blender Z-up space as the anatomical mesh.
// Shape scales affect the entire source rig and mesh together, retaining skin binds.
export class ViewerHair {
  constructor(parent,onChange,scalp=null){
    this.scalp=scalp;
    this.anchor=new THREE.Group();this.anchor.name='Волосы · Shaggy Short';parent.add(this.anchor);
    this.shape=new THREE.Group();this.anchor.add(this.shape);
    this.source=new THREE.Group();this.source.rotation.x=Math.PI/2;this.shape.add(this.source);
    this.settings={...Object.fromEntries(kateHairControls.map(([k,,,,,v])=>[k,v])),meshCollision:false,style:'shaggy',width:1,height:1,depth:1,x:0,y:0,z:0,color:'#ffffff',scalpFrontCut:.045};
    this.onChange=onChange;this.ready=false;this.materials=[];this.pending=null;
  }
  async load(){
    if(this.settings.style==='none'){this.ready=true;this.apply();this.onChange?.();return;}
    if(this.settings.style==='builtin'){if(!this.builtin){this.builtin=new BuiltinHair();if(this.physicsSettings)this.builtin.physics.settings=cleanHairPhysics(this.physicsSettings);if(this.builtinSelection)this.builtin.selection={...this.builtinSelection};this.shape.add(this.builtin.group);this.builtinCap=new THREE.Mesh(scalpGeometry(),this.builtin.material);this.builtinCap.name='Подложка VRoid по активной голове';this.shape.add(this.builtinCap);}if(this.physicsSettings)this.builtin.physics.settings=cleanHairPhysics(this.physicsSettings);if(this.builtinSelection&&!this.builtinLayers){this.builtin.selection={...this.builtinSelection};this.builtinSelection=undefined;}if(this.builtinLayers){const layers=this.builtinLayers;await this.builtin.restore(layers);if(this.builtinLayers===layers){this.builtinLayers=null;this.builtinSelection=undefined;}}else await this.builtin.load();this.ready=true;this.apply();this.onChange?.();return;}
    if(this.settings.style==='kate'){if(!this.kate){const data=await fetch('./assets/hair/kate/guides.json').then(r=>r.json());this.kate=new KateHair(data);this.shape.add(this.kate.group);this.kateCap=new THREE.Mesh(scalpGeometry(),new THREE.MeshStandardMaterial({color:'#c66b38',roughness:.7,side:THREE.DoubleSide}));this.kateCap.scale.z=1.22;this.shape.add(this.kateCap);}this.ready=true;this.apply();this.onChange?.();return;}
    if(this.pending)return this.pending;
    this.pending=new GLTFLoader().loadAsync('./assets/hair/shaggy/hair.glb').then(gltf=>{
      gltf.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;for(const m of [].concat(o.material)){m.side=THREE.DoubleSide;m.roughness=.8;m.metalness=0;this.materials.push(m);}}});
      this.source.add(gltf.scene);
      // The donor has no solid scalp. Fill gaps between its locks with a fitted cap.
      const capMaterial=this.materials[0].clone();this.materials.push(capMaterial);
      this.cap=new THREE.Mesh(scalpGeometry(),capMaterial);this.cap.name='Подложка волос';this.shape.add(this.cap);
      if(this.scalp){const shell=new THREE.Mesh(scalpShell(this.scalp),capMaterial);this.shell=shell;shell.name='Подложка по форме головы';this.shape.add(shell);}
      this.ready=true;this.apply();this.onChange?.();
    }).catch(error=>{this.pending=null;throw error;});return this.pending;
  }
  apply(){
    const s=this.settings;this.anchor.visible=s.style!=='none';
    this.shape.scale.set(s.width,s.depth,s.height);
    this.shape.position.set(s.x,s.y,s.z);
    this.source.visible=s.style==='shaggy';if(this.shell)this.shell.visible=s.style==='shaggy';if(this.cap)this.cap.visible=s.style==='shaggy';if(this.kateCap){this.kateCap.visible=s.style==='kate';this.kateCap.material.color.set(s.color==='#ffffff'?'#c66b38':s.color);}if(this.kate){this.kate.group.visible=s.style==='kate';if(s.style==='kate')this.kate.apply(s);}
    if(this.builtinCap)this.builtinCap.visible=s.style==='builtin'&&!this.builtin?.layers.some(l=>/^(?:(?:AcceptedNika-)?Nika(?:-|Sweep-)|IonaUnified-)/.test(l.asset));
    if(this.builtin){this.builtin.group.visible=s.style==='builtin';this.builtin.apply(s);}
    for(const m of this.materials)m.color.set(s.color);
  }
  fitHead(head){
    const builtin=this.settings.style==='builtin',hairObject=builtin?this.builtin:this.kate,cap=builtin?this.builtinCap:this.kateCap;
    if(!hairObject||!cap||!head.ready||head.settings.style!=='mira'||!['kate','builtin'].includes(this.settings.style))return;
    const key=JSON.stringify([this.settings.style,this.settings.scalpFrontCut,head.faceEditor.key,head.weights?.head_size,head.weights?.head_w,head.weights?.height,...['width','height','depth','x','y','z'].map(k=>this.settings[k])]);if(this.headFitKey===key){this.clearFaceHair();return;}this.headFitKey=key;
    this.anchor.updateWorldMatrix(true,true);head.socketMesh.updateWorldMatrix(true,false);
    const mesh=head.socketMesh,c=head.faceEditor.cache.get(mesh),inverse=this.shape.matrixWorld.clone().invert(),matrix=inverse.multiply(mesh.matrixWorld),positions=[],indices=[],selected=[],capSelected=[],point=new THREE.Vector3(),canonical=new THREE.Vector3(),box=new THREE.Box3();
    for(let i=0;i<mesh.geometry.attributes.position.count;i++){
      canonical.fromArray(c.position,i*3).applyMatrix4(c.matrix);const front=THREE.MathUtils.clamp((canonical.z+.015)/.07,0,1),cut=1.475+.057*front;
      selected[i]=canonical.y>cut;capSelected[i]=canonical.y>cut+(builtin ? (this.settings.scalpFrontCut??.045) : 0)*front;
      point.fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(matrix);if(selected[i])box.expandByPoint(point);positions.push(...point.toArray());
    }
    this.faceHairPositions=positions.slice();this.faceHairIndex=Array.from(mesh.geometry.index.array);this.faceHairSurface=null;
    let needsClearance=false;hairObject.group.traverse(o=>{if(o.isMesh&&o.userData.faceClearance>0)needsClearance=true;});
    if(needsClearance&&mesh.isSkinnedMesh){for(const bone of mesh.skeleton.bones)bone.updateWorldMatrix(true,false);mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){point.fromBufferAttribute(mesh.geometry.attributes.position,i);mesh.applyBoneTransform(i,point);point.applyMatrix4(matrix);point.toArray(this.faceHairPositions,i*3);}}
    const center=box.getCenter(new THREE.Vector3());for(let i=0;i<positions.length;i+=3)if(selected[i/3]){positions[i]=center.x+(positions[i]-center.x)*1.018;positions[i+1]=center.y+(positions[i+1]-center.y)*1.018;positions[i+2]+=.002;}
    const ix=mesh.geometry.index.array;for(let i=0;i<ix.length;i+=3)if(capSelected[ix[i]]&&capSelected[ix[i+1]]&&capSelected[ix[i+2]])indices.push(ix[i],ix[i+1],ix[i+2]);
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();cap.geometry.dispose();cap.geometry=g;cap.scale.set(1,1,1);
    hairObject.group.position.z=box.max.z-.15+.004;
    hairObject.group.scale.x=THREE.MathUtils.clamp((box.max.x-box.min.x)/.145,.85,1.35);
    hairObject.group.userData.fittedTo='active VRM head';cap.userData.fittedTo='active VRM head';this.clearFaceHair();
  }
  clearFaceHair(){
    if(!this.builtin||!this.faceHairPositions)return;let pending=false;this.builtin.group.traverse(o=>{if(o.isMesh&&o.userData.faceClearance>0&&!o.userData.faceClearanceApplied)pending=true;});if(!pending)return;
    this.faceHairSurface??=sideSurface(this.faceHairPositions,this.faceHairIndex);this.builtin.group.userData.correctedFaceVertices=clearFaceHair(this.builtin.group,this.shape,this.faceHairSurface);
    rebaseFaceHair(this.builtin.group,this.builtin.physics);
  }
  update(weights,pose=null){
    const rig=Anatomy.getRig(),index=rig.bones.findIndex(b=>b.name==='head');
    const {A,t}=Anatomy.transforms(weights)[index],r=Anatomy.ratios(weights),h=rig.bones[index].head;
    const point=pose?pose.posed[index]:h.map((_,j)=>(A[j*3]*h[0]+A[j*3+1]*h[1]+A[j*3+2]*h[2]+t[j])*r.height);
    this.anchor.position.fromArray(point);
    this.anchor.quaternion.fromArray(pose?pose.q[index]:[0,0,0,1]);
    this.anchor.scale.set(r.height*r.head_size*r.head_w,r.height*r.head_size,r.height*r.head_size);
    const appearanceKey=this.cacheStaticAppearance?JSON.stringify([this.settings,this.builtinLayers,this.physicsSettings]):null;
    if(!appearanceKey||appearanceKey!==this.poseAppearanceKey){this.apply();this.poseAppearanceKey=appearanceKey;}
  }
  readHash(hash){
    const args=new URLSearchParams(hash.replace(/^#/,'')),s=this.settings;
    s.meshCollision=args.get('collision_mesh')==='1';
    if(['none','shaggy','kate','builtin'].includes(args.get('hair')))s.style=args.get('hair');
    for(const key of ['width','height','depth','x','y','z']){
      const name='hair_'+key;if(!args.has(name))continue;const v=Number(args.get(name));
      if(Number.isFinite(v))s[key]=Math.max(['x','y','z'].includes(key)?-.08:.65,Math.min(['x','y','z'].includes(key)?.08:1.5,v));
    }
    for(const [k,,lo,hi,,,]of kateHairControls)if(args.has('hair_'+k)){const n=Number(args.get('hair_'+k));if(Number.isFinite(n))s[k]=Math.max(lo,Math.min(hi,n));}
    if(args.has('hair_scalpFrontCut')){const n=Number(args.get('hair_scalpFrontCut'));if(Number.isFinite(n))s.scalpFrontCut=Math.max(0,Math.min(.06,n));}
    if(args.has('hair_physics'))try{this.physicsSettings=cleanHairPhysics(JSON.parse(args.get('hair_physics')));}catch{}
    if(args.has('hair_layers')){try{const layers=JSON.parse(args.get('hair_layers'));if(Array.isArray(layers)&&layers.length<=32)this.builtinLayers=layers;}catch{}}
    this.builtinSelection={Front:'N00-Front-002',Back:'N00-Back-133'};for(const category of Object.keys(builtinHairCategories)){const id=args.get('hair_part_'+category);if(id!==null)this.builtinSelection[category]=id;}
    if(/^#[0-9a-f]{6}$/i.test(args.get('hair_color')||''))s.color=args.get('hair_color');this.apply();
  }
  hash(){
    const s=this.settings,args=new URLSearchParams({hair:s.style});if(s.meshCollision)args.set('collision_mesh','1');if(this.builtin)args.set('hair_physics',JSON.stringify(this.builtin.physics.settings));
    for(const k of ['width','height','depth','x','y','z'])if(s[k]!==(['x','y','z'].includes(k)?0:1))args.set('hair_'+k,String(s[k]));
    for(const [k,,,,,initial]of kateHairControls)if(s[k]!=null&&s[k]!==initial)args.set('hair_'+k,s[k]);
    if(s.style==='builtin'&&this.builtin)args.set('hair_layers',JSON.stringify(this.builtin.serialize()));
    if(s.style==='builtin')for(const [category,id]of Object.entries(this.builtin?.selection||this.builtinSelection||{}))args.set('hair_part_'+category,id);
    if((s.scalpFrontCut??.045)!==.045)args.set('hair_scalpFrontCut',String(s.scalpFrontCut));
    if(s.color!=='#ffffff')args.set('hair_color',s.color);return args.toString();
  }
  reset(){this.ready=false;this.builtinLayers=undefined;this.physicsSettings=cleanHairPhysics({});if(this.builtin)this.builtin.physics.settings=cleanHairPhysics({});this.headFitKey=null;this.poseAppearanceKey=null;if(this.builtin)this.builtin.selection={Front:'N00-Front-002',Back:'N00-Back-133'};this.builtinSelection=undefined;Object.assign(this.settings,{...Object.fromEntries(kateHairControls.map(([k,,,,,v])=>[k,v])),meshCollision:false,style:'shaggy',width:1,height:1,depth:1,x:0,y:0,z:0,color:'#ffffff',scalpFrontCut:.045});this.apply();}
}

function scalpGeometry(){
  const positions=[],uv=[],indices=[],rows=18,cols=64;
  for(let r=0;r<=rows;r++)for(let c=0;c<=cols;c++){
    const phi=c/cols*Math.PI*2,theta=r/rows*(1.45+.35*Math.cos(phi));
    positions.push(.075*Math.sin(theta)*Math.sin(phi),-.04+.057*Math.sin(theta)*Math.cos(phi),.067+.081*Math.cos(theta));
    uv.push(c/cols,r/rows);
  }
  for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){const a=r*(cols+1)+c,b=a+cols+1;indices.push(a,b,a+1,a+1,b,b+1);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

function scalpShell({positions,indices,head}){
  const p=new Float32Array(positions.length),tris=[];
  for(let i=0;i<p.length;i+=3){
    p[i]=positions[i]*1.035-head[0];
    p[i+1]=-.025+(positions[i+1]+.025)*1.035-head[1];
    p[i+2]=positions[i+2]+.002-head[2];
  }
  const above=i=>positions[i*3+2]>1.44+.065*THREE.MathUtils.clamp((.005-positions[i*3+1])/.08,0,1);
  for(let i=0;i<indices.length;i+=3)if(above(indices[i])&&above(indices[i+1])&&above(indices[i+2]))tris.push(indices[i],indices[i+1],indices[i+2]);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(Array.from({length:p.length/3},(_,i)=>[(positions[i*3]+.08)/.16,(positions[i*3+2]-1.44)/.12]).flat(),2));geo.setIndex(tris);geo.computeVertexNormals();return geo;
}
