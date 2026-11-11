import {installLocomotion} from './viewer-locomotion.js?v=tickle105c';
import {createGpuBody} from './viewer-gpu-body.js?v=runtime92';
import {createViewerActivity} from './viewer-activity.js?v=perf91';
const viewerActivity=createViewerActivity();
import {createViewerPerformance} from './viewer-performance.js?v=perf91';
const viewerPerformance=createViewerPerformance();
import {loadHandRig,mergeFootMotion,installExtremityViews} from './viewer-hand-rig.js?v=splay106';
import {installAnimationLibrary} from './viewer-animation-library.js?v=library87c';
import {installEmotionMotion} from './viewer-emotion-motion.js?v=body110';
import {createBodySurface} from './viewer-body-surface.js?v=kate83';
import {installFootRig} from './viewer-foot-rig.js?v=splay106';
import {captureCharacterHash} from './viewer-character-state.js?v=editor79';
import {createColliderOverlay} from './viewer-collider-overlay.js';
import {installEmotions} from './viewer-emotions.js?v=tickle105c';
import {correctHipPose} from './viewer-pose-correctives.js?v=belly77';
import {createRibbonFixedTimeline} from './ribbon-fixed-timeline.js?v=velocity66';
const fixedRibbonMode=new URLSearchParams(location.search).has('fixed_clock'),fixedRibbonClock=createRibbonFixedTimeline();
import {inkWidth} from './viewer-ink-style.js';
import {createInkPass} from './viewer-ink-pass.js?v=velocity66';
import {usesAttachedHair} from './viewer-hair-runtime.js?v=iona-runtime-1';
import {installOriginalBodyColors,updateOriginalBodyColors} from './viewer-original-body-colors.js?v=body80';
import {installCartoonPreview} from './viewer-cartoon-preview.js?v=runtime92';
import {createTestFurniture} from './viewer-test-furniture.js?v=tickle105c';
import {createThreadedMiraRibbonHair} from './viewer-ribbon-preview-client.js?v=neck-fit99';
import {createMiraRibbonHair} from './viewer-ribbon-tryon.js?v=43';
import {installBundleReplay} from './bundle-replay.js?v=4';
import {AttachedHairBundle} from './viewer-hair-bundle.js?v=runtime92';
import {MeshSurfaceCollider} from './mesh-surface-collider.js?v=ribbon-contacts-5';
import {bodyHairColliders,fittedNeckCollider} from './viewer-hair-colliders.js?v=neck-fit99';
import {HairStudio} from './viewer-hair-studio.js?v=sumi37c';
import {kateBodyPreset} from './viewer-kate-body-preset.js?v=neck-1';
import {kateFacePreset,kateAppearancePreset} from './viewer-kate-preset.js?v=3';
import {lipRollSection,lipRollDimensions} from './viewer-lip-rolls.js?v=lip-rolls-2';
import {targetMouthRows} from './viewer-mouth-bound.js?v=lip-rolls-2';
import {MouthCurveUI} from './viewer-mouth-curves.js?v=lip-rolls-2';
let mouthCurveUI=null;
import {FaceWorkflow,cleanFaceProject} from './viewer-face-workflow.js?v=mika32c';
let faceWorkflow=null;
import {appearanceFields,appearanceDefaults,portraitPalettes,cleanAppearance,detailControls} from './viewer-face-appearance.js?v=kate78';
import {faceControls,facePresets} from './viewer-face.js?v=kate78';
import {ViewerHead} from './viewer-head.js?v=runtime92';
import {ViewerHair,kateHairControls,builtinHairCategories} from './viewer-hair.js?v=runtime92c';
import * as THREE from 'three';
import {OrbitControls} from './vendor/three/controls/OrbitControls.js';
import {TransformControls} from './vendor/three/controls/TransformControls.js';
import {GLTFLoader} from './vendor/three/loaders/GLTFLoader.js';
const $=id=>document.getElementById(id);
if(new URLSearchParams(location.search).has('editor')){const style=document.createElement('style');style.textContent='#stage>div:not(#tools):not(#hint),#stage>button,#stage>label{display:none!important}';document.head.append(style);}
const cvs=$('c');let exportingVRM=false;
window.addEventListener('error',e=>{$('err').style.display='grid';$('err').textContent='Ошибка: '+e.message;});
  // ---------- данные ----------
  const b64 = s => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i=0;i<bin.length;i++) u[i]=bin.charCodeAt(i); return u; };
  const buf = s => b64(s).buffer;
  const E = window.EVA;
  Anatomy.configure(window.ANATOMY_RIG);
  const N = E.count;
  const base = new Float32Array(buf(E.base));
  const idx32 = new Uint32Array(buf(E.index));
  if (E.count > 65535) { /* остался бы 32-бит */ }
  const index = new Uint16Array(idx32.length); index.set(idx32);
  const morphs = E.morphs.filter(m => m.group !== 'мои ручки').map(m => ({...m, q:new Int8Array(buf(m.data)), w:0})).concat(Anatomy.controls.map(m => ({...m})));
  const facePos = E.face ? new Float32Array(buf(E.face.base)) : null;
  const faceBase = E.face ? new Float32Array(buf(E.face.base)) : null;
  const faceIndex = E.face ? (() => { const a = new Uint32Array(buf(E.face.index)); const o = new Uint16Array(a.length); o.set(a); return o; })() : null;

  const pos = new Float32Array(base);

const renderer=new THREE.WebGLRenderer({canvas:cvs,antialias:true});
const drawIllustration=createInkPass(renderer),colliderOverlay=createColliderOverlay();
const renderIllustration=(scene,camera)=>{colliderOverlay.update(hair.builtin?.physics.colliders||[]);drawIllustration(scene,camera);colliderOverlay.render(renderer,camera);};
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
const scene=new THREE.Scene();scene.background=new THREE.Color('#14161c');
const camera=new THREE.PerspectiveCamera(40,1,.01,1000);
const orbit=new OrbitControls(camera,cvs);orbit.enableDamping=true;orbit.minDistance=.1;orbit.maxDistance=200;
scene.add(new THREE.HemisphereLight(0xdce7ff,0x373038,2));
const light=new THREE.DirectionalLight(0xffeee4,3);light.position.set(-2,4,4);scene.add(light);
const rim=new THREE.DirectionalLight(0xaccaff,1);rim.position.set(2,2,-3);scene.add(rim);
const modelRoot=new THREE.Group();modelRoot.name='Основная модель';scene.add(modelRoot);
let appearanceLoaded=false,hairLoadRevision=0;
modelRoot.visible=false;
const anatomyGroup=new THREE.Group();anatomyGroup.rotation.x=-Math.PI/2;modelRoot.add(anatomyGroup);
const bodyMaterial=new THREE.MeshStandardMaterial({color:new URLSearchParams(location.hash.slice(1)).get('color_skin')||'#eedcda',roughness:.72,side:THREE.DoubleSide});
function meshFrom(P,I){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(P,3).setUsage(THREE.DynamicDrawUsage));geo.setIndex(new THREE.BufferAttribute(I,1));const mesh=new THREE.Mesh(geo,bodyMaterial);anatomyGroup.add(mesh);return mesh;}
const bodyMesh=meshFrom(pos,index),faceMesh=facePos?meshFrom(facePos,faceIndex):null;
const bodySurface=createBodySurface({base,host:$('list'),initial:location.hash,onHideHair:hidden=>ribbonTryOn?.setDiagnostic(hidden?'head':'all'),onFocus:()=>frameBodyDetail()});
installOriginalBodyColors(bodyMesh,()=>head.socket,()=>head.settings.appearance,bodySurface).catch(e=>{console.error(e);$('status').textContent=e.message;});
const bodySurfaceCollider=new MeshSurfaceCollider();
const hair=new ViewerHair(anatomyGroup,()=>updatePose(),{positions:faceBase,indices:faceIndex,head:Anatomy.getRig().bones.find(b=>b.name==='head').head});hair.readHash(location.hash);hair.cacheStaticAppearance=true;
const ribbonTryOn=new URLSearchParams(location.hash.slice(1)).get('ribbon_tryon')==='1'?createThreadedMiraRibbonHair(scene):null;
let ribbonPerfLabel=null,ribbonPerfAt=0,ribbonFrameSamples=[],ribbonSolveSamples=[],ribbonPoseSamples=[];
if(ribbonTryOn){
 const contactButton=document.createElement('button');contactButton.id='ribbon-contact-mode';
 contactButton.style.cssText='position:absolute;left:12px;top:'+ (new URLSearchParams(location.search).has('capture')?'235':'155')+'px;z-index:6';
 const refreshContactLabel=()=>{const accurate=new URLSearchParams(location.hash.slice(1)).get('contact_motion')==='1';contactButton.textContent=accurate?'Контакт волос: точный (медленнее)':'Контакт волос: быстрый';contactButton.setAttribute('aria-pressed',String(accurate));};
 contactButton.onclick=()=>{const params=new URLSearchParams(location.hash.slice(1)),accurate=params.get('contact_motion')!=='1';params.set('contact_motion',accurate?'1':'0');params.delete('neck_contact');history.replaceState(null,'','#'+params.toString());playing=false;poseEnabled=true;poseTime=0;poseDelta=0;updatePose();ribbonTryOn.reset();$('dance').textContent=playLabel();refreshContactLabel();};
 refreshContactLabel();cvs.parentElement.append(contactButton);
}

if(ribbonTryOn){const panel=document.createElement('div');panel.style.cssText='position:absolute;left:12px;top:50px;z-index:5;display:flex;gap:4px';for(const [mode,label] of [['all','Все ленты'],['fringe','Только чёлка'],['back','Только затылок'],['side','Только боковые'],['head','Без волос']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>ribbonTryOn.setDiagnostic(mode);panel.append(button);}ribbonPerfLabel=document.createElement('span');ribbonPerfLabel.style.cssText='padding:6px;background:#171b24;color:#bcc9da';panel.append(ribbonPerfLabel);cvs.parentElement.append(panel);}
const attachedBundle=!ribbonTryOn&&usesAttachedHair(location.hash)?new AttachedHairBundle(scene,{bodyMesh}):null;
const head=new ViewerHead({parent:anatomyGroup,bodyMesh,faceMesh,base,index,onChange:()=>updatePose()});
const gpuBody=createGpuBody({mesh:bodyMesh,index,Anatomy,AnatomyPose,renderer});let forceCpuBody=new URLSearchParams(location.search).has('cpu_skin');
head.readHash(location.hash);head.cacheStaticAppearance=true;head.portraitHair=hair;head.previewNapeSmooth=ribbonTryOn;if(ribbonTryOn)head.cacheStaticAppearance=true;
const transform=new TransformControls(camera,cvs);transform.setSize(.85);scene.add(transform);
transform.addEventListener('dragging-changed',e=>{orbit.enabled=!e.value;});
transform.addEventListener('objectChange',syncObject);
const references=new Map();let selected=modelRoot, moving=false,spin=false,refId=0;
function frameModel(){camera.up.set(0,1,0);modelRoot.updateWorldMatrix(true,true);if(gpuBody.active)gpuBody.fitBounds();const box=new THREE.Box3().setFromObject(bodyMesh);if(head.ready&&head.socketMesh){const m=head.socketMesh,v=new THREE.Vector3();m.skeleton?.update();for(let i=0;i<m.geometry.attributes.position.count;i++){m.getVertexPosition(i,v);box.expandByPoint(v.applyMatrix4(m.matrixWorld));}}else if(faceMesh?.visible)box.expandByObject(faceMesh);if(poseEnabled&&activeMotion!=='dance'&&testFurniture.group.children.length)box.union(new THREE.Box3().setFromObject(testFurniture.group));const center=box.getCenter(new THREE.Vector3());const size=box.getSize(new THREE.Vector3());const distance=Math.max(size.y,size.x/Math.max(camera.aspect,.1),poseEnabled&&activeMotion!=='dance'?size.z:0)/(2*Math.tan(THREE.MathUtils.degToRad(20)))*1.2;orbit.target.copy(center);camera.position.copy(center).add(new THREE.Vector3(poseEnabled&&activeMotion==='lying'?1:.25,poseEnabled&&activeMotion==='lying'?.7:.04,1).normalize().multiplyScalar(distance));orbit.update();}
function frameBodyDetail(){
 modelRoot.updateWorldMatrix(true,true);const g=bodyMesh.geometry,rest=g.getAttribute('cjBodyRest'),positions=gpuBody.active?new THREE.BufferAttribute(gpuBody.posedPositions(),3):g.getAttribute('position');if(!rest)return;const box=new THREE.Box3(),v=new THREE.Vector3();for(let i=0;i<rest.count;i++)if(rest.getZ(i)>.68&&rest.getZ(i)<1.34&&Math.abs(rest.getX(i))<.22){v.fromBufferAttribute(positions,i).applyMatrix4(bodyMesh.matrixWorld);box.expandByPoint(v);}if(box.isEmpty())return;const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),direction=camera.position.clone().sub(orbit.target);direction.y=0;if(direction.lengthSq()<.001)direction.set(0,0,1);direction.normalize();const distance=Math.max(size.y,size.x/Math.max(.1,camera.aspect))/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.18;orbit.target.copy(center);camera.up.set(0,1,0);camera.position.copy(center).addScaledVector(direction,distance);orbit.update();
}
$('frame').onclick=frameModel;
$('body-front').onclick=()=>{frameModel();const distance=camera.position.distanceTo(orbit.target);camera.position.copy(orbit.target).add(new THREE.Vector3(0,0,distance));orbit.update();};
$('body-back').onclick=()=>{frameModel();const distance=camera.position.distanceTo(orbit.target);camera.position.copy(orbit.target).add(new THREE.Vector3(0,0,-distance));orbit.update();};
$('body-side').onclick=()=>{frameModel();const distance=camera.position.distanceTo(orbit.target);camera.position.copy(orbit.target).add(new THREE.Vector3(distance,0,0));orbit.update();};
function frameHeadView(view='front'){
 modelRoot.updateWorldMatrix(true,true);
 // Bound the currently posed head, not the union of all morph endpoints.
 // Native mouth targets can expand the cached SkinnedMesh bounds far beyond
 // the rendered face; that must not make head camera presets fit the body.
 const headMesh=head.ready&&head.socketMesh?head.socketMesh:null;
 const box=new THREE.Box3();
 if(headMesh){
  const vertex=new THREE.Vector3();
  headMesh.skeleton?.update();
  for(let i=0;i<headMesh.geometry.attributes.position.count;i++){
   headMesh.getVertexPosition(i,vertex);box.expandByPoint(vertex.applyMatrix4(headMesh.matrixWorld));
  }
 }else box.setFromObject(faceMesh||bodyMesh);
 const bows=head.emotionLayer?.adapter?.effects?.portrait?.accessories?.bowsGroup;if(bows)box.expandByObject(bows);
 box.expandByScalar(.035);
 const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
 const extent=view==='top'?Math.max(size.x,size.z):view==='side'?Math.max(size.y,size.z):Math.max(size.x,size.y);
 const distance=Math.max(.3,extent/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*1.18);
 orbit.target.copy(center);camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);
 camera.position.copy(center).add(new THREE.Vector3(view==='side'?distance:0,view==='top'?distance:0,view==='front'?distance:0));orbit.update();
}
$('frame-head').onclick=()=>frameHeadView();
$('head-side').onclick=()=>frameHeadView('side');
$('head-top').onclick=()=>frameHeadView('top');
$('move').onclick=()=>{moving=!moving;$('move').classList.toggle('active',moving);if(moving)transform.attach(selected);else transform.detach();};
function selectObject(object){selected=object;$('selection').value=object===modelRoot?'model':object.userData.id;if(moving)transform.attach(object);syncObject();}
for(const axis of ['x','y','z']){const label=document.createElement('label');const title=document.createElement('span');title.textContent=axis.toUpperCase()+', м';const input=document.createElement('input');input.type='number';input.step='.01';input.id='position-'+axis;input.setAttribute('aria-label','Положение '+axis.toUpperCase());input.oninput=()=>{const v=Number(input.value);if(Number.isFinite(v)){selected.position[axis]=v;selected.updateMatrixWorld(true);}};label.append(title,input);$('position-fields').append(label);}
function syncObject(){if(!selected)return;for(const axis of ['x','y','z'])$('position-'+axis).value=selected.position[axis].toFixed(3);$('object-scale').value=selected.scale.x.toFixed(4);$('object-angle').value=THREE.MathUtils.radToDeg(selected.rotation.y).toFixed(1);const isRef=selected!==modelRoot;$('opacity-label').hidden=!isRef;$('reference-actions').hidden=!isRef;if(isRef){$('opacity').value=1-selected.userData.opacity;$('opacity-value').value=Math.round((1-selected.userData.opacity)*100)+'%';}}
$('selection').onchange=e=>selectObject(e.target.value==='model'?modelRoot:references.get(e.target.value));
$('object-scale').oninput=e=>{const v=Number(e.target.value);if(v>0&&Number.isFinite(v))selected.scale.setScalar(v);};
$('object-angle').oninput=e=>{const v=Number(e.target.value);if(Number.isFinite(v))selected.rotation.y=THREE.MathUtils.degToRad(v);};
function opacity(root,value){root.userData.opacity=value;root.traverse(o=>{if(!o.material)return;for(const m of [].concat(o.material)){m.opacity=m.userData.sourceOpacity*value;m.transparent=m.userData.sourceTransparent||value<1;m.depthWrite=m.userData.sourceDepthWrite&&value===1;m.needsUpdate=true;}});}
// Slider describes transparency: its left endpoint is opaque.
$('opacity').oninput=e=>{opacity(selected,1-Number(e.target.value));$('opacity-value').value=Math.round(Number(e.target.value)*100)+'%';};
function fitReference(root){root.scale.setScalar(1);root.position.set(0,0,0);root.rotation.set(0,0,0);root.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(root);let min=Infinity,max=-Infinity;for(let i=2;i<restBody.length;i+=3){min=Math.min(min,restBody[i]);max=Math.max(max,restBody[i]);}const factor=(max-min)*modelRoot.scale.x/Math.max(box.max.y-box.min.y,.0001);root.scale.setScalar(factor);root.position.set(modelRoot.position.x-(box.min.x+box.max.x)*.5*factor,modelRoot.position.y+min*modelRoot.scale.x-box.min.y*factor,modelRoot.position.z-(box.min.z+box.max.z)*.5*factor);root.updateMatrixWorld(true);syncObject();}
$('fit-reference').onclick=()=>fitReference(selected);
function dispose(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of [].concat(o.material||[])){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
$('remove-reference').onclick=()=>{if(selected===modelRoot)return;const root=selected;selectObject(modelRoot);scene.remove(root);references.delete(root.userData.id);$('selection').querySelector('[value="'+root.userData.id+'"]').remove();dispose(root);$('status').textContent='Референс удалён';};
const loader=new GLTFLoader();
async function addReference(file){if(!/\.glb$/i.test(file.name)){$('status').textContent='Выберите файл .glb';return;}$('status').textContent='Загрузка '+file.name+'…';let root;try{const gltf=await loader.parseAsync(await file.arrayBuffer(),'');root=new THREE.Group();root.add(gltf.scene);if(new THREE.Box3().setFromObject(root).isEmpty())throw Error('В файле нет видимой геометрии');root.traverse(o=>{if(o.material){o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();for(const m of [].concat(o.material)){m.userData.sourceOpacity=m.opacity;m.userData.sourceTransparent=m.transparent;m.userData.sourceDepthWrite=m.depthWrite;}}});root.userData.id='ref-'+(++refId);root.name=file.name;opacity(root,.5);scene.add(root);references.set(root.userData.id,root);const option=new Option(file.name,root.userData.id);$('selection').add(option);fitReference(root);selectObject(root);if(!moving)$('move').click();$('status').textContent=file.name+' · двигайте за цветные стрелки';}catch(error){if(root)dispose(root);$('status').textContent='Не удалось открыть '+file.name+': '+error.message;}}
$('add-reference').onclick=()=>$('reference-file').click();
$('reference-file').onchange=async e=>{for(const file of e.target.files)await addReference(file);e.target.value='';};
let dragDepth=0;const stage=$('stage');stage.addEventListener('dragenter',e=>{e.preventDefault();dragDepth++;stage.classList.add('drop');});stage.addEventListener('dragover',e=>{e.preventDefault();e.dataTransfer.dropEffect='copy';});stage.addEventListener('dragleave',()=>{if(--dragDepth<=0)stage.classList.remove('drop');});stage.addEventListener('drop',async e=>{e.preventDefault();dragDepth=0;stage.classList.remove('drop');for(const file of e.dataTransfer.files)await addReference(file);});
let down;const raycaster=new THREE.Raycaster();cvs.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});cvs.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down.x,e.clientY-down.y)>4||transform.axis)return;const r=cvs.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);const hit=raycaster.intersectObjects([modelRoot,...references.values()],true)[0];if(hit){let root=hit.object;while(root.parent&&root.parent!==scene)root=root.parent;selectObject(root);}});
const updateCartoonPreview=installCartoonPreview(scene);
function draw(now){if(!viewerActivity.active){lastTick=now;return;}viewerPerformance.begin(now);if(!document.hidden)bodyMotion.advance(Math.min(.1,Math.max(0,(now-(lastTick||now))/1000)));viewerPerformance.measure('мимика',()=>head.tickEmotions?.(Math.min(.1,Math.max(0,(now-(lastTick||now))/1000))));if(fixedRibbonMode){const input=$('foot').querySelector('input[type=number]');if(input)input.disabled=true;}modelRoot.visible=appearanceLoaded&&(!ribbonTryOn||ribbonTryOn.ready);updateOriginalBodyColors();updateCartoonPreview();if(typeof motionSelect!=='undefined')motionSelect.disabled=!head.ready;if(bundleTestRunning){lastTick=now;orbit.update();viewerPerformance.measure('рендер',()=>renderIllustration(scene,camera));viewerPerformance.end();return;}if(document.hidden){lastTick=now;return;}if(playing)poseDelta+=Math.max(0,(now-(lastTick||now))/1000);else poseDelta=0;if(playing&&(!ribbonTryOn||ribbonTryOn.canAdvancePose)){if(fixedRibbonMode&&ribbonTryOn){const ticket=fixedRibbonClock.issue();if(ticket){ribbonTryOn.fixedTicket=ticket;poseTime=ticket.time;}}else poseTime+=new URLSearchParams(location.search).has('regression')?1/60:Math.min(.1,poseDelta);poseDelta=0;if(new URLSearchParams(location.search).has('regression')&&poseTime>=2){poseTime=2;playing=false;$('dance').textContent=playLabel();}if(poseTime>=activeClip.duration){if(activeClip.loop===true)poseTime%=activeClip.duration;else{poseTime=activeClip.duration;playing=false;$('dance').textContent=playLabel();}}if(fixedRibbonMode||now-lastPoseAt>1000/30||!playing){updatePose();lastPoseAt=now;}}if(!playing&&(bodyMotion.active||bodyMotion.needsPose)&&now-lastPoseAt>1000/30){updatePose();lastPoseAt=now;}if(ribbonTryOn){if(hair.builtinCap)hair.builtinCap.visible=false;if(hair.builtin)for(const node of hair.builtin.nodes.values())if(/^(MiraDrape|Mira-Scalp)/.test(node.userData.sourcePreset||''))node.visible=false;const frontMeshes=[];if(hair.builtin)for(const node of hair.builtin.nodes.values())if(node.userData.sourcePreset==='N00-Front-024'){frontMeshes.push(...node.children.filter(m=>m.isMesh));node.visible=false;}ribbonTryOn.poseTime=poseTime;ribbonTryOn.update(Math.max(0,(now-(lastTick||now))/1000),head.socketMesh,bodyMesh,hair.builtin?.physics.colliders||[],hair.anchor,frontMeshes,hair.builtin?.physics.settings,hair.builtin?.physics.surfaceCollider,testFurniture);}else if(attachedBundle){if(hair.builtin){for(const c of hair.builtin.physics.chains.values())c.mesh.visible=false;}attachedBundle.update(Math.max(0,(now-(lastTick||now))/1000),hair.anchor,hair.builtin?.physics.colliders||[],head.socketMesh);}else viewerPerformance.measure('волосы · физика',()=>hair.builtin?.physics.update(Math.max(0,(now-(lastTick||now))/1000),hair.anchor));if(ribbonTryOn){ribbonSolveSamples.push(ribbonTryOn.solveMS||0);if(ribbonSolveSamples.length>120)ribbonSolveSamples.shift();if(now-ribbonPerfAt>500){const p95=a=>a.length?[...a].sort((x,y)=>x-y)[Math.floor((a.length-1)*.95)].toFixed(1):'—';ribbonPerfLabel.textContent=`p95: кадр ${p95(ribbonFrameSamples)} мс · ленты ${p95(ribbonSolveSamples)} · поза ${p95(ribbonPoseSamples)} · worker ${ribbonTryOn.workerMS?.toFixed(1)||0} (${ribbonTryOn.workers||0}) · solve ${ribbonTryOn.solverMS?.toFixed(1)||0} · подготовка ${ribbonTryOn.overheadMS?.toFixed(1)||0} · draw ${renderer.info.render.calls} · ${Object.entries((ribbonTryOn.profile||[]).reduce((a,p)=>{for(const [k,v]of Object.entries(p))if(!a[k]||a[k].ms<v.ms)a[k]=v;return a;},{})).map(([k,v])=>k+': '+v.ms.toFixed(1)+'мс/'+v.calls).join(' · ')}`;ribbonPerfAt=now;}}lastTick=now;const w=cvs.clientWidth,h=cvs.clientHeight;if(cvs.width!==Math.floor(w*renderer.getPixelRatio())||cvs.height!==Math.floor(h*renderer.getPixelRatio())){renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}if(spin){const delta=camera.position.clone().sub(orbit.target).applyAxisAngle(new THREE.Vector3(0,1,0),.006);camera.position.copy(orbit.target).add(delta);}orbit.update();hair.anchor.visible=!bodySurface.hairHidden&&hair.settings.style!=='none';if(attachedBundle?.mesh)attachedBundle.mesh.visible=!bodySurface.hairHidden;if(!ribbonTryOn||ribbonTryOn.canPresent){viewerPerformance.measure('рендер',()=>renderIllustration(scene,camera));viewerPerformance.end();if(ribbonTryOn){ribbonTryOn.presented();if(lastRibbonPresented){ribbonFrameSamples.push(now-lastRibbonPresented);if(ribbonFrameSamples.length>120)ribbonFrameSamples.shift();}lastRibbonPresented=now;}}}
  const restBody=new Float32Array(base), restFace=faceBase?new Float32Array(faceBase):null;
  const handRig=await loadHandRig();
  const footRig=await installFootRig({host:$('list'),hash:location.hash,onChange:()=>updatePose()});
  installExtremityViews({host:$('frame-head').parentElement,bodyMesh,camera,orbit,handRig,footRig,THREE,getPositions:()=>gpuBody.active?gpuBody.fullSource():pos});
  let bundleTestRunning=false;
  let currentWeights={},playing=false,poseEnabled=false,poseTime=0,lastTick=0,lastPoseAt=0,poseDelta=0,lastRibbonPresented=0;let activeClip=ANATOMY_DANCE,activeMotion='dance';const testFurniture=createTestFurniture(scene);const motionNames={dance:'Танец',sitting:'Сидя',lying:'Лёжа',bow:'Наклон стоя',squat:'Глубокий присед'};const playLabel=()=> '▶ '+motionNames[activeMotion];
  const bodyMotion=installEmotionMotion({host:$('head-expressions'),getContext:()=>!poseEnabled?'standing':activeClip.context||(activeMotion==='sitting'?'seated':activeMotion==='lying'?'lying':'action')});
  function uploadPose(){if(ribbonTryOn&&head.ready){bodyMesh.geometry.attributes.position.needsUpdate=true;bodyMesh.geometry.boundingBox=null;return;}for(const mesh of [bodyMesh,faceMesh]){if(!mesh||!mesh.visible||head.ready&&head.settings.style==='mira'&&mesh.geometry===head.socket.geometry)continue;mesh.geometry.attributes.position.needsUpdate=true;mesh.geometry.boundingBox=null;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();}}
  function updatePose(){const poseStarted=performance.now();let poseMark=poseStarted;const poseParts=[];const poseLap=name=>{const at=performance.now();poseParts.push([name,+(at-poseMark).toFixed(1)]);poseMark=at;};
    const layered=bodyMotion.active||bodyMotion.needsPose;
    const motionClip=poseEnabled?activeClip:{sourceHipHeight:Anatomy.getRig().bones[0].head[2]};
    const sourceFrame=poseEnabled?AnatomyPose.sample(activeClip,poseTime):{q:Anatomy.getRig().bones.map(()=>[0,0,0,1]),root:[0,0,0],directions:null};
    const frame=layered?bodyMotion.compose(sourceFrame):sourceFrame;
    const usePose=poseEnabled||layered;
    const hairPose=usePose?AnatomyPose.matrices(currentWeights,frame,motionClip):null;
    const useGpu=usePose&&!forceCpuBody&&head.ready&&head.settings.style==='mira'&&!hair.settings.meshCollision&&gpuBody.attach(head.socket);
    if(usePose){const hands=viewerPerformance.measure('кисти',()=>handRig.apply(restBody,frame.hand_angles_deg)),feet=viewerPerformance.measure('стопы',()=>footRig.apply(hands,mergeFootMotion(poseEnabled?footRig.sample(activeClip,poseTime):{},frame)));
      if(useGpu){viewerPerformance.measure('GPU · подготовка',()=>gpuBody.prepare(feet,currentWeights,frame,motionClip,hairPose));viewerPerformance.measure('тело · опорные точки',()=>AnatomyPose.apply(feet,pos,currentWeights,frame,motionClip,'body',gpuBody.selected,hairPose));}
      else{gpuBody.disable();viewerPerformance.measure('тело DQ',()=>AnatomyPose.apply(feet,pos,currentWeights,frame,motionClip,'body',null,hairPose));}
      if(restFace&&(!head.ready||head.settings.style==='legacy'))AnatomyPose.apply(restFace,facePos,currentWeights,frame,motionClip,'face',null,hairPose);
    }else{gpuBody.disable();pos.set(footRig.apply(restBody));if(restFace)facePos.set(restFace);}
    poseLap('skin');hair.update(currentWeights,hairPose);poseLap('hair');
    if(hair.builtin){const rig=Anatomy.getRig(),ratios=Anatomy.ratios(currentWeights);hair.builtin.physics.colliders=['upperchest','upperarm.l','upperarm.r'].flatMap(name=>{const i=rig.bones.findIndex(b=>b.name===name);if(i<0)return [];const bone=rig.bones[i],tr=Anatomy.transforms(currentWeights)[i],p=hairPose?hairPose.posed[i]:bone.head.map((_,j)=>(tr.A[j*3]*bone.head[0]+tr.A[j*3+1]*bone.head[1]+tr.A[j*3+2]*bone.head[2]+tr.t[j])*ratios.height);return [{center:anatomyGroup.localToWorld(new THREE.Vector3().fromArray(p)),radius:(name==='upperchest'?.10:.065)*ratios.height}];});}

    if(hair.builtin)hair.builtin.physics.cohesion=hair.builtin.layers.some(l=>/^(Iona|MiraDrape)/.test(l.asset))?.6:0;
    if(ribbonTryOn&&hair.builtin){
      // Ribbon mode owns its collider list; legacy head/chest/arm spheres are excluded.
      hair.builtin.physics.colliders=bodyHairColliders(Anatomy,currentWeights,hairPose,anatomyGroup.matrixWorld)
        .filter(s=>['neck → head','pelvis → waist','waist → chest'].includes(s.bodyPart))
        .map(s=>{if(s.bodyPart==='neck → head'){const extension=s.b.clone().sub(s.a).multiplyScalar(.3);s.a.addScaledVector(extension,-1);s.b.add(extension);}return {...s,radius:s.radius*.85,supplemental:true};});
    }
    // Long Iona layers need continuous collision along the entire torso.
    if(!ribbonTryOn&&hair.builtin&&(new URLSearchParams(location.search).get('colliders')==='capsules'||hair.builtin.layers.some(l=>/^(Iona|MiraDrape)/.test(l.asset)))){
      hair.builtin.physics.colliders.push(...bodyHairColliders(Anatomy,currentWeights,hairPose,anatomyGroup.matrixWorld));
    }
    if(hair.builtin?.layers.some(l=>/^MiraDrape/.test(l.asset))){bodyMesh.updateWorldMatrix(true,false);hair.builtin.physics.groundY??=new THREE.Box3().setFromObject(bodyMesh).min.y;}
    if(!ribbonTryOn)head.apply();uploadPose();poseLap('normals');if(head.socket)head.socket.onPerformanceSample=viewerPerformance.sample;head.update(currentWeights,hairPose,pos);poseLap('head');hair.anchor.position.add(head.attachmentOffset(currentWeights,hairPose));try{hair.fitHead(head);if(!ribbonTryOn&&hair.builtin&&head.ready&&head.socketMesh){head.socketMesh.updateWorldMatrix(true,false);const box=new THREE.Box3().setFromObject(head.socketMesh),size=box.getSize(new THREE.Vector3());hair.builtin.physics.colliders.push({center:box.getCenter(new THREE.Vector3()),radius:Math.min(size.x,size.z)*.43});}}catch(e){$('hair-status').textContent='Не удалось посадить волосы на VRM-голову: '+e.message;console.error(e);}
    if(ribbonTryOn&&hair.builtin){const neck=fittedNeckCollider(bodyMesh);if(neck){const list=hair.builtin.physics.colliders,index=list.findIndex(c=>c.bodyPart==='neck → head');if(index>=0)list[index]=neck;}}
    if(hair.builtin && (hair.settings.meshCollision&&!ribbonTryOn)){
      bodyMesh.updateWorldMatrix(true,false);const geometry=bodyMesh.geometry;
      bodySurfaceCollider.update(geometry.attributes.position.array,geometry.index.array,bodyMesh.matrixWorld);
      hair.builtin.physics.surfaceCollider=bodySurfaceCollider;
    }else if(hair.builtin){hair.builtin.physics.surfaceCollider=null;}
    poseLap('fit');viewerPerformance.sample('поза',performance.now()-poseStarted);for(const [name,ms]of poseParts)viewerPerformance.sample(name,ms);
    $('hair-mesh-collision').checked=Boolean(hair.settings.meshCollision);
    $('hair-collision-status').textContent=hair.settings.meshCollision?'Активно: поверхность тела · экспериментальный режим':'Активно: капсулы · обычный режим';
    document.getElementById('timeline').value=poseTime;
    document.getElementById('dance-time').textContent=poseTime.toFixed(2);if(ribbonTryOn){ribbonPoseSamples.push(performance.now()-poseStarted);if(ribbonPoseSamples.length>120)ribbonPoseSamples.shift();}
  }
  if(new URLSearchParams(location.search).has('perf')){const toggle=document.createElement('button');toggle.id='runtime-backend';toggle.setAttribute('aria-label','Режим анимации тела');const label=()=>{toggle.textContent=(forceCpuBody?'CPU · сравнение':hair.settings.meshCollision?'CPU · коллизии':!gpuBody.capable?'CPU · совместимость':gpuBody.active?'GPU DQ':'GPU · готов')+' · волосы '+(ribbonTryOn?'worker · Мира':attachedBundle?'custom · Иона':hair.builtin?.physics.backend||'загрузка');toggle.title=hair.builtin?.physics.lastError||'Переключить GPU / CPU для сравнения';};toggle.onclick=()=>{forceCpuBody=!forceCpuBody;updatePose();label();};$('tools').append(toggle);setInterval(label,1000);label();}
  function rebuild(){
    pos.set(base);
    for (const m of morphs){
      if (!m.w || m.procedural) continue;
      const q = m.q, s = m.scale*m.w, L = N*3;
      for (let i=0;i<L;i++) pos[i] += q[i]*s;
    }
    const weights = Object.fromEntries(morphs.filter(m => m.procedural).map(m => [m.name,m.w]));
    currentWeights=weights;
    Anatomy.deform(pos,pos,weights);
    restBody.set(pos);footRig.invalidate();handRig.invalidate();gpuBody.invalidate();
    if (faceBase) {
      Anatomy.deform(faceBase,facePos,weights,'face');
      restFace.set(facePos);
    }
    updatePose();
  }
  // ---------- панель ----------
  const list = document.getElementById('list');
  const rows = [];
  const native = morphs.filter(m => !m.procedural);
  document.getElementById('count').textContent =
    Anatomy.controls.length + ' пропорций · ' + native.length + ' родных ключей · ' + N.toLocaleString('ru-RU') + ' вершин';

  const groups = new Map();
  function bodyPart(m){
    const n=m.name;
    if(/head|Neck/i.test(n))return 'Голова и шея';
    if(/shoulder|arm_|hand_|指甲/i.test(n))return 'Плечи, руки и кисти';
    if(/chest|bust|breast|rutou|rufang/i.test(n))return 'Грудная клетка и грудь';
    if(/torso|waist|Abs/i.test(n))return 'Корпус и талия';
    if(/hip|glute|butt|维纳斯/i.test(n))return 'Таз и ягодицы';
    if(/leg_|thigh|calf|Shins/i.test(n))return 'Ноги';
    if(/foot|足底/i.test(n))return 'Стопы';
    if(/Vagina|Anus/i.test(n))return 'Интимные корректоры';
    return 'Общие пропорции и корректоры';
  }
  const names=['Общие пропорции и корректоры','Голова и шея','Плечи, руки и кисти','Грудная клетка и грудь','Корпус и талия','Таз и ягодицы','Ноги','Стопы','Интимные корректоры'];
  for(const name of names){const section=document.createElement('details');section.open=false;const title=document.createElement('summary');title.textContent=name;section.append(title);list.append(section);groups.set(name,{section,title});}
  morphs.sort((a,b)=>Number(!!b.procedural)-Number(!!a.procedural)||b.mm-a.mm);
  morphs.forEach(m => {
    const group=groups.get(bodyPart(m));
    const row = document.createElement('div');
    row.className = 'row' + (m.mm < 2 ? ' weak' : '');
    row.innerHTML = `<div class="top"><span class="nm" title="${m.name}">${m.nameRu || m.name}</span>
        <span class="val">${m.procedural ? "×1.00" : "0.00"}</span></div>
      <div class="sub2">${m.procedural ? m.name + ' · ×' + m.lo + ' … ×' + m.hi : m.name + ' · сдвиг ' + m.mm.toFixed(1) + ' мм'}</div>
      <input type="range" min="${m.min}" max="${m.max}" step="0.01" value="0" aria-label="${m.nameRu || m.name}">`;
    const inp = row.querySelector('input'), val = row.querySelector('.val');
    inp.addEventListener('input', () => {
      m.w = parseFloat(inp.value);
      val.textContent = m.procedural ? '×' + Anatomy.ratios({[m.name]:m.w})[m.name].toFixed(2) : m.w.toFixed(2);
      row.classList.toggle('on', Math.abs(m.w) > 0.001);
      rebuild();
    });
    m._row = {row, inp, val};
    group.section.appendChild(row); rows.push({m, row, inp, val, group});
  });

  const q = document.getElementById('q');
  const only = document.getElementById('only');
  const filter = () => {
    const s = q.value.toLowerCase().trim();
    rows.forEach(({m,row}) => {
      let show = !s || (m.nameRu||'').toLowerCase().includes(s) || m.name.toLowerCase().includes(s);
      if (show && only.checked && m.mm < 2) show = false;
      row.style.display = show ? '' : 'none';
    });
    for(const [name,g] of groups){const visible=rows.filter(r=>r.group===g&&r.row.style.display!=='none').length;g.section.hidden=!visible;g.title.textContent=name+' · '+visible;if(s&&visible)g.section.open=true;}
  };
  q.addEventListener('input', filter);
  only.addEventListener('change', filter);
  filter();

  document.getElementById('q').addEventListener('input', () => {});
  document.getElementById('reset').onclick = () => {
    footRig.setState(null);footRig.sync();bodySurface.setState(null);
    morphs.forEach(m => { m.w = 0; m._row.inp.value = 0; m._row.val.textContent=m.procedural?'×1.00':'0.00'; m._row.row.classList.remove('on'); });
    hair.reset();head.reset();syncHeadUI();syncHairUI();loadHair();loadHead();rebuild();
  };
  document.getElementById('save').onclick = () => {
    const hash=captureCharacter();
    history.replaceState(null,'',location.pathname+location.search+(hash?'#'+hash:''));
  };
  document.getElementById('wire').onclick = e => { bodyMaterial.wireframe = !bodyMaterial.wireframe; e.target.textContent = bodyMaterial.wireframe ? 'Поверхность' : 'Сетка'; };
  document.getElementById('spin').onclick = e => { spin = !spin; e.target.textContent = spin ? 'Стоп' : 'Вращение'; };

  // #BreastsSize=1&HipSize=0.5 — предустановка значений через адрес
  if (location.hash.length > 1){
    location.hash.slice(1).split('&').forEach(pair => {
      const [k, v] = pair.split('=');
      let key;try{key=decodeURIComponent(k);}catch{return;}
      const m = morphs.find(x => x.name === key);
      const val = parseFloat(v);
      if (m && !isNaN(val)){
        m.w = Math.max(m.min,Math.min(m.max,val)); m._row.inp.value = m.w; m._row.val.textContent = m.procedural ? '×' + Anatomy.ratios({[m.name]:m.w})[m.name].toFixed(2) : m.w.toFixed(2);
        m._row.row.classList.add('on');
      }
    });
  }

  document.getElementById('dance').onclick=e=>{modelRoot.position.y=activeMotion==='lying'?.48:0;if(!poseEnabled)showMotionFurniture().catch(console.error);if(!playing&&poseTime>=activeClip.duration)poseTime=0;playing=!playing;poseEnabled=true;e.target.textContent=playing?'Ⅱ Пауза':playLabel();updatePose();};
  document.getElementById('rest').onclick=()=>{modelRoot.position.y=0;testFurniture.show('none');hair.builtin?.physics.reset();playing=false;poseEnabled=false;poseTime=0;document.getElementById('dance').textContent=playLabel();updatePose();};
  document.getElementById('timeline').oninput=e=>{hair.builtin?.physics.reset();playing=false;poseEnabled=true;poseTime=Number(e.target.value);document.getElementById('dance').textContent=playLabel();updatePose();};
  installBundleReplay({bundle:attachedBundle,body:bodyMesh,duration:activeClip.duration,ready:()=>head.ready&&hair.builtin,setRunning:value=>{bundleTestRunning=value;playing=false;$('dance').textContent=playLabel();},setPose:time=>{poseEnabled=true;poseTime=time;updatePose();},step:dt=>attachedBundle.update(dt,hair.anchor,hair.builtin?.physics.colliders||[],head.socketMesh)});

  if(new URLSearchParams(location.search).has('xpbd')){const note=document.createElement('span');note.textContent=' XPBD · вся причёска · 48 итераций'+(new URLSearchParams(location.search).has('shape')?' · сохранение изгиба':'');$('foot').append(note);}
  if(fixedRibbonMode&&ribbonTryOn){
   let previousSignature=null;const repeatStatus=document.createElement('span');repeatStatus.textContent=' Повтор ещё не проверен';$('foot').append(repeatStatus);
   ribbonTryOn.onFixedPresented=ticket=>{if(!fixedRibbonClock.commit(ticket))return;const stop=Number(new URLSearchParams(location.search).get('fixed_stop'));if(stop>0&&ticket.tick>=stop){playing=false;$('dance').textContent=playLabel();const signature=ribbonTryOn.fixedSignature;repeatStatus.textContent=' Шаг '+ticket.tick+' · геометрия '+signature+(previousSignature?(signature===previousSignature?' · повтор совпал':' · ПОВТОР НЕ СОВПАЛ'):' · первый проход');previousSignature=signature;}};
   const restartFixed=()=>{playing=false;poseEnabled=true;poseTime=0;poseDelta=0;fixedRibbonClock.reset();ribbonTryOn.fixedTicket=null;updatePose();ribbonTryOn.rebuild();playing=true;$('dance').textContent='Ⅱ Пауза';};
   const restartButton=document.createElement('button');restartButton.textContent='Повтор с нуля · 60 Гц';restartButton.onclick=restartFixed;$('foot').append(restartButton);
   const fixedNote=document.createElement('span');fixedNote.textContent=' Фиксированный шаг · при нагрузке воспроизведение замедляется';$('foot').append(fixedNote);
   $('timeline').disabled=true;const timeInput=$('foot').querySelector('input[type=number]');if(timeInput)timeInput.disabled=true;
   // This experimental mode intentionally has no arbitrary seeking. A pause
   // resumes the same state; replay/clip changes rebuild all worker histories.
   const oldPlay=$('dance').onclick;$('dance').onclick=e=>{if(poseTime>=activeClip.duration){restartFixed();return;}oldPlay(e);};
   const oldRest=$('rest').onclick;$('rest').onclick=()=>{oldRest();fixedRibbonClock.reset();ribbonTryOn.fixedTicket=null;ribbonTryOn.rebuild();};
  }
  if(ribbonTryOn&&new URLSearchParams(location.search).has('regression'))ribbonTryOn.onRegressionStart=()=>{playing=true;poseEnabled=true;poseTime=0;poseDelta=0;updatePose();};
  window.miraViewer = {gpuBody,bodyMotion,footRig,bodySurface,captureProject:()=>captureProject(),morphs, base, pos, restBody, faceBase, facePos, restFace, index, rebuild,updatePose,scene,camera,orbit,modelRoot,references,transform,hair,head,get poseTime(){return poseTime;}};

camera.aspect=cvs.clientWidth/cvs.clientHeight;camera.updateProjectionMatrix();rebuild();frameModel();syncObject();renderer.setAnimationLoop(draw);

const hairPanel=$('hair-controls');
function syncHairUI(){
  $('hair-style').value=hair.settings.style;$('hair-color').value=hair.settings.color;
  for(const [key]of kateHairControls){const input=$('hair-'+key);if(input)input.parentElement.style.display=hair.settings.style==='kate'?'':'none';}
  for(const k of ['width','height','depth','x','y','z',...kateHairControls.map(c=>c[0])]){const input=$('hair-'+k);if(input){input.value=hair.settings[k];$('hair-value-'+k).textContent=['x','y','z'].includes(k)?Math.round(hair.settings[k]*1000)+' мм':'×'+hair.settings[k].toFixed(2);}}
}
for(const [key,label,lo,hi,step] of [
  ['width','Ширина волос',.65,1.5,.01],['height','Высота причёски',.65,1.5,.01],['depth','Объём в глубину',.65,1.5,.01],
  ...kateHairControls,
  ['x','Посадка: влево / вправо',-.08,.08,.001],['y','Посадка: вперёд / назад',-.08,.08,.001],['z','Посадка: вверх / вниз',-.08,.08,.001]]){
  const row=document.createElement('label');row.className='hair-row';const title=document.createElement('span');title.textContent=label;const value=document.createElement('output');value.id='hair-value-'+key;const input=document.createElement('input');Object.assign(input,{type:'range',id:'hair-'+key,min:lo,max:hi,step,value:hair.settings[key]});input.setAttribute('aria-label',label);input.oninput=()=>{hair.settings[key]=Number(input.value);hair.apply();syncHairUI();};row.append(title,value,input);hairPanel.append(row);
}
$('hair-style').onchange=async e=>{hair.settings.style=e.target.value;if(e.target.value==='kate'&&hair.settings.color==='#ffffff')hair.settings.color='#c66b38';hair.apply();if(e.target.value!=='none')await loadHair();syncHairUI();};
$('hair-color').oninput=e=>{hair.settings.color=e.target.value;hair.apply();};
$('hair-reset').onclick=()=>{hair.reset();syncHairUI();loadHair();};
$('hair-mesh-collision').onchange=e=>{
 hair.settings.meshCollision=e.target.checked;hair.builtin?.physics.reset();
 const args=new URLSearchParams(location.hash.slice(1));
 if(hair.settings.meshCollision)args.set('collision_mesh','1');else args.delete('collision_mesh');
 history.replaceState(null,'',location.pathname+location.search+'#'+args.toString());updatePose();
};
async function loadHair(){const request=++hairLoadRevision;try{
 appearanceLoaded=false;
 if(head.settings.style==='mira'){await head.load();if(request!==hairLoadRevision)return;updatePose();}
 if(ribbonTryOn){
  // These library meshes only provide the fringe guide. The entire visible
  // hairstyle is generated by the ribbon workers, not the obsolete drape assets.
  hair.settings.style='builtin';
  const front=hair.builtinLayers?.find(layer=>layer.asset==='N00-Front-024');
  hair.builtinLayers=[front||{asset:'N00-Front-024',visible:true,edit:{color:hair.settings.color}}];
  hair.headFitKey=null;
  ribbonTryOn.rebuild();
 }
 await hair.load();if(request!==hairLoadRevision)return;updatePose();appearanceLoaded=true;await syncBuiltinLibrary();$('hair-status').textContent=hair.settings.style==='builtin'?'VRoid · направляющие оригинальных пресетов, поверхность нашего движка':hair.settings.style==='kate'?'Кейт · сборка направляющих Snow Spirit / LongWavy':'Shaggy Short · Powdur · привязка к голове';return true;}catch(e){if(request!==hairLoadRevision)return;appearanceLoaded=false;$('hair-status').textContent='Не удалось собрать голову и волосы: '+e.message;return false;}}
const builtinPanel=document.createElement('div');builtinPanel.id='builtin-hair-library';hairPanel.before(builtinPanel);
let hairStudio;
async function syncBuiltinLibrary(){
 builtinPanel.hidden=hair.settings.style!=='builtin';if(builtinPanel.hidden)return;
 hairStudio??=new HairStudio(builtinPanel,hair,()=>{hair.apply();syncHairUI();});await hairStudio.mount();
}
syncHairUI();

for(const [key,label] of Object.entries(appearanceFields)){const row=document.createElement('label');row.style.cssText='display:inline-flex;align-items:center;gap:8px;margin:5px';row.append(document.createTextNode(label));const input=document.createElement('input');input.type='color';input.id='face-color-'+key;input.setAttribute('aria-label',label);input.value=head.settings.appearance[key]||appearanceDefaults[key];input.oninput=()=>{head.settings.appearance[key]=input.value;updatePose();syncHeadUI();};row.append(input);(key==='lashColor'?$('lash-colors'):$('face-colors')).append(row);}
for(const [key,label,min,max,step,initial] of detailControls){const row=document.createElement('label');row.className='hair-row';const title=document.createElement('span');title.textContent=label;const output=document.createElement('output');output.id='paint-value-'+key;const input=document.createElement('input');Object.assign(input,{id:'paint-'+key,type:'range',min,max,step,value:head.settings.appearance[key]??initial});input.setAttribute('aria-label',label);input.oninput=()=>{head.settings.appearance[key]=Number(input.value);updatePose();syncHeadUI();};row.append(title,output,input);(key.startsWith('lash')?$('lash-controls'):$('face-paint-controls')).append(row);}
$('lash-reset').onclick=()=>{for(const key of ['lashLength','lashThickness','lashDensity','lashColor'])delete head.settings.appearance[key];updatePose();syncHeadUI();};
$('face-paint-reset').onclick=()=>{delete head.settings.appearance.lashColor;for(const [key] of detailControls)delete head.settings.appearance[key];updatePose();syncHeadUI();};
$('face-color-reset').onclick=()=>{head.settings.appearance={};updatePose();syncHeadUI();};
$('portrait-palette').onclick=()=>{const name=$('portrait-character').value;if(portraitPalettes[name]){head.settings.appearance={...portraitPalettes[name]};updatePose();syncHeadUI();}};
function syncPortrait(){const name=$('portrait-character').value,expression=$('portrait-expression').value,visible=Boolean(name);$('portrait-comparison').hidden=!visible;if(visible){$('portrait-image').src='../../../../public/character-images/portraits/'+name+'/'+expression+'.png';$('portrait-image').alt=name+' · '+expression;$('portrait-caption').textContent=name+' · '+expression+' · портрет-референс';}$('portrait-palette').disabled=!visible;}
$('portrait-character').onchange=syncPortrait;$('portrait-expression').onchange=syncPortrait;
$('portrait-test').onclick=()=>{if(head.emotionLayer){head.emotionLayer.player.play($('portrait-expression').value);return;}head.settings.expressions={};const expr={smile:'happy',angry:'angry',surprise:'surprised'}[$('portrait-expression').value];if(expr)head.settings.expressions[expr]=1;updatePose();syncHeadUI();};
$('portrait-close').onclick=()=>{$('portrait-character').value='';syncPortrait();};syncPortrait();
let faceGroup;
for(const [group,key,label] of faceControls){
 if(key.startsWith('mouthCurve_'))continue;
 if(!faceGroup||faceGroup.dataset.group!==group){faceGroup=$('face-editor').querySelector('[data-group="'+group+'"]');if(!faceGroup){faceGroup=document.createElement('details');faceGroup.dataset.group=group;const summary=document.createElement('summary');summary.textContent=group;faceGroup.append(summary);const resetGroup=document.createElement('button');resetGroup.className='face-group-reset';resetGroup.textContent='Сбросить эту группу';resetGroup.setAttribute('aria-label','Сбросить: '+group);resetGroup.onclick=()=>{for(const [name,key] of faceControls)if(name===group)delete head.settings.face[key];updatePose();syncHeadUI();};faceGroup.append(resetGroup);$('face-editor').append(faceGroup);}}
 const row=document.createElement('label');row.className='hair-row';const title=document.createElement('span');title.textContent=label;const output=document.createElement('output');output.id='face-value-'+key;const input=document.createElement('input');Object.assign(input,{id:'face-'+key,type:'range',min:['mouthSculpt','mouthTarget','mouthTransitionSmooth','faceSurfaceShading','skinIrregularity','smileOpen','surpriseOpen','mouthExpressionStrength'].includes(key)?0:-1,max:1,step:.01,value:head.settings.face[key]??(key==='mouthExpressionStrength'?1:0)});input.setAttribute('aria-label',label);input.oninput=()=>{head.settings.face[key]=Number(input.value);if(group==='Изгиб губ'||group==='Валики губ')head.settings.face.mouthCurve_binding=1;if(group==='Валики губ')head.settings.face.mouthCurve_rolls=1;updatePose();syncHeadUI();};input.ondblclick=()=>{head.settings.face[key]=key==='mouthExpressionStrength'?1:0;updatePose();syncHeadUI();};row.append(title,output,input);faceGroup.append(row);
}
const rollGroup=$('face-editor').querySelector('[data-group="Валики губ"]');rollGroup.querySelector('summary').insertAdjacentHTML('afterend','<label><input type="checkbox" id="lip-roll-mode"> Изогнутые валики</label><p>Высота и глубина задают сечение каждого валика. Округлость расширяет его переднюю дугу. Изгибы вдоль рта — в разделе «Изгиб губ».</p><svg id="lip-roll-section" viewBox="0 0 220 180" style="width:100%;max-height:140px;background:#20242e" aria-label="Сечение валиков сбоку"></svg>');$('lip-roll-mode').onchange=e=>{head.settings.face.mouthCurve_rolls=e.target.checked?1:0;head.settings.face.mouthCurve_binding=1;updatePose();syncHeadUI();};
mouthCurveUI=new MouthCurveUI({container:$('face-editor'),head,change:()=>{updatePose();syncHeadUI();},preview:name=>{head.settings.expressions=name?{[name]:1}:{};updatePose();syncHeadUI();}});
function applyKateHead(){head.settings.style='mira';head.settings.materials='clay';head.settings.face={...kateFacePreset};head.settings.appearance={...kateAppearancePreset};head.settings.expressions={};$('portrait-character').value='kate';$('portrait-expression').value='neutral';syncPortrait();updatePose();syncHeadUI();$('face-message').textContent='Кейт · проба всего лица с принятой основой губ';}
$('kate-character').onclick=applyKateHead;
$('kate-body').onclick=()=>{applyKateHead();playing=false;poseEnabled=false;poseTime=0;$('dance').textContent=playLabel();for(const m of morphs){m.w=kateBodyPreset[m.name]??0;m._row.inp.value=m.w;m._row.val.textContent=m.procedural?'×'+Anatomy.ratios({[m.name]:m.w})[m.name].toFixed(2):m.w.toFixed(2);m._row.row.classList.toggle('on',Math.abs(m.w)>.001);}rebuild();$('body-front').click();$('body-reference').hidden=false;$('face-message').textContent='Кейт · голова и тело · проба по референсу стоя';};
$('body-reference-select').onchange=e=>{$('body-reference-image').src='./assets/body-references/kate/'+e.target.value+'.png';};
$('body-reference-close').onclick=()=>{$('body-reference').hidden=true;};

$('face-preset').onchange=e=>{head.settings.face=structuredClone(facePresets[e.target.value]||{});updatePose();syncHeadUI();};
$('face-save').onclick=()=>{const project={format:'cyberjack-face',version:1,base:'mira-canonical-1',face:head.settings.face,appearance:head.settings.appearance};$('face-json-source').value=JSON.stringify(project,null,2);$('face-json-preview').hidden=false;const a=$('face-download');if(a.href.startsWith('blob:'))URL.revokeObjectURL(a.href);a.href=URL.createObjectURL(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}));a.hidden=false;};
$('face-load').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>100000)throw Error('Слишком большой файл');const p=JSON.parse(await file.text());const {face,appearance}=cleanFaceProject(p);head.settings.face=face;head.settings.appearance=appearance;updatePose();syncHeadUI();$('face-message').textContent='Форма лица загружена';}catch(error){$('face-message').textContent=error.message;}finally{e.target.value='';}};
$('face-reset').onclick=()=>{$('face-preset').value='';head.settings.face={};updatePose();syncHeadUI();};
const expressionLabels={happy:'Радость',angry:'Злость',sad:'Грусть',relaxed:'Расслабленность',surprised:'Удивление',blink:'Моргание',blinkLeft:'Левый глаз',blinkRight:'Правый глаз',aa:'Рот · А',ih:'Рот · И',ou:'Рот · У',ee:'Рот · Э',oh:'Рот · О'};
function syncHeadUI(){
  $('lip-roll-mode').checked=Boolean(head.settings.face.mouthCurve_rolls);for(const legacy of $('face-editor').querySelectorAll('[data-group="Старый профиль губ"]'))legacy.hidden=Boolean(head.settings.face.mouthCurve_rolls);
  const rollSvg=$('lip-roll-section'),rollValues=head.settings.face,rollRows=targetMouthRows(0,rollValues);rollSvg.hidden=!rollValues.mouthCurve_rolls;rollSvg.innerHTML=['upper','lower'].map((band,i)=>{const a=rollRows[i?'lower':'upperSeam'],b=rollRows[i?'lowerSeam':'upper'],dim=lipRollDimensions(rollValues,band);return '<path fill="none" stroke="'+(i?'#91bfff':'#fa929c')+'" stroke-width="3" d="'+Array.from({length:65},(_,j)=>{const t=j/64,[y,z]=lipRollSection(t,b[0]-a[0],dim.depth,dim.roundness);return (j?'L':'M')+(20+((1-t)*a[1]+t*b[1]+z-.058)*10000)+','+(80-(a[0]+y-1.4355)*8500);}).join(' ')+'"/>';}).join('');
  for(const button of $('face-editor').querySelectorAll('.face-group-reset'))button.disabled=head.settings.style!=='mira';
  for(const [key,,,,,initial] of detailControls){$('paint-'+key).value=head.settings.appearance[key]??initial;$('paint-'+key).disabled=head.settings.style!=='mira';$('paint-value-'+key).textContent=Number($('paint-'+key).value).toFixed(2);}
  for(const key of Object.keys(appearanceFields)){const input=$('face-color-'+key);if(input){input.value=head.settings.appearance[key]||appearanceDefaults[key];input.disabled=head.settings.style!=='mira';}}
  $('face-preset').value=Object.keys(facePresets).find(name=>faceControls.every(([,k])=>(facePresets[name][k]||0)===(head.settings.face[k]||0)))||(faceControls.some(([,k])=>head.settings.face[k])?'custom':'');
  for(const [,k] of faceControls){const el=$('face-'+k);if(el){el.value=head.settings.face[k]??(k==='mouthExpressionStrength'?1:0);el.disabled=head.settings.style!=='mira';$('face-value-'+k).textContent=Number(el.value).toFixed(2);}}

  $('head-style').value=head.settings.style;$('export-vrm').disabled=head.settings.style!=='mira'||exportingVRM;$('head-materials').disabled=head.settings.style!=='mira';$('head-neutral').disabled=head.settings.style!=='mira';for(const input of $('head-expressions').querySelectorAll('input'))input.disabled=head.settings.style!=='mira';for(const k of ['lookX','lookY'])$('head-'+k).disabled=head.settings.style!=='mira';$('head-materials').value=head.settings.materials;
  for(const name of Object.keys(expressionLabels)){const el=$('expr-'+name);if(el){el.value=head.settings.expressions[name]||0;$('expr-value-'+name).textContent=Number(el.value).toFixed(2);}}
  for(const k of ['lookX','lookY'])$('head-'+k).value=head.settings[k];
  mouthCurveUI?.render();faceWorkflow?.observe();
}
for(const [name,label] of Object.entries(expressionLabels)){
  const row=document.createElement('label');row.className='hair-row';const title=document.createElement('span');title.textContent=label;const output=document.createElement('output');output.id='expr-value-'+name;const input=document.createElement('input');Object.assign(input,{id:'expr-'+name,type:'range',min:0,max:1,step:.01,value:head.settings.expressions[name]||0});input.setAttribute('aria-label',label+' · VRM');input.oninput=()=>{head.settings.expressions[name]=Number(input.value);updatePose();syncHeadUI();};row.append(title,output,input);$('head-expressions').append(row);
}
$('head-style').onchange=async e=>{head.settings.style=e.target.value;if(e.target.value==='mira')await loadHead();else $('head-status').textContent='Evanescia · исходная геометрия';syncHeadUI();updatePose();};
$('head-materials').onchange=e=>{head.settings.materials=e.target.value;updatePose();syncHeadUI();};
for(const k of ['lookX','lookY'])$('head-'+k).oninput=e=>{head.settings[k]=Number(e.target.value);updatePose();syncHeadUI();};
$('head-neutral').onclick=()=>{head.settings.expressions={};head.settings.lookX=head.settings.lookY=0;syncHeadUI();updatePose();};
async function loadHead(){try{await head.load();$('head-status').textContent=head.settings.style==='mira'?'Mira · VRM 1.0 · '+head.manifest.targetCount+' морфов мимики · '+head.manifest.presets.length+' выражений':'Evanescia · исходная геометрия';}catch(e){head.apply();$('head-status').textContent='Не удалось открыть VRM-голову: '+e.message;console.error(e);syncHeadUI();}}
syncHeadUI();faceWorkflow=new FaceWorkflow({head,sync:syncHeadUI,update:updatePose,storage:()=>window.localStorage});

$('export-vrm').onclick=async e=>{
  const button=e.target;exportingVRM=true;button.disabled=true;$('head-status').textContent='Сборка VRM 1.0 в T-позе…';
  try{
    await loadHead();if(!head.ready||head.settings.style!=='mira')throw Error('Выберите голову Mira');
    const {exportViewerVRM}=await import('./export-viewer-vrm.js?v=nika-neck-root-6');const result=await exportViewerVRM({head,hair,weights:currentWeights,restBody,parameters:Object.fromEntries(morphs.map(m=>[m.name,m.w]))});
    const a=$('vrm-download');if(a.href.startsWith('blob:'))URL.revokeObjectURL(a.href);
    try{const saved=await fetch('./api/exports/vrm',{method:'POST',headers:{'Content-Type':'model/gltf-binary'},body:result.data});if(!saved.ok)throw Error('Static server');a.href=(await saved.json()).url;}catch{a.href=URL.createObjectURL(new Blob([result.data],{type:'model/gltf-binary'}));}a.hidden=false;
    $('head-status').textContent='VRM 1.0 · T-поза · '+result.summary.expressions+' выражений · экспорт готов';
  }catch(error){$('head-status').textContent='Ошибка экспорта: '+error.message;console.error(error);}finally{exportingVRM=false;button.disabled=head.settings.style!=='mira';}
};

// Full-character presets keep body, head, appearance, hair layers and physics together.
import {characterLibrary} from './viewer-character-library.js?v=editor79';
for(const [id,name] of [['eli','Эли'],['iona','Иона'],['mai','Май'],['mika','Мика'],['nika','Ника'],['rin','Рин'],['sumi','Суми']])if(![...$('portrait-character').options].some(o=>o.value===id)){const o=document.createElement('option');o.value=id;o.textContent=name;$('portrait-character').append(o);}
let activeCharacterId=new URLSearchParams(location.hash.slice(1)).get('character_id')||'custom';
let activeCharacterData=null,activeSourceHash=location.hash;
const captureCharacter=()=>{if(!appearanceLoaded)throw Error('Дождитесь загрузки персонажа');return captureCharacterHash({previous:activeSourceHash,id:activeCharacterId,parameters:{...Object.fromEntries(morphs.map(m=>[m.name,m.w])),ink_width:inkWidth.value},hair:hair.hash(),head:head.hash(),feet:footRig.hash()+'&'+bodySurface.hash(),managedKeys:['body_layers','head_materials',...faceControls.map(c=>'face_'+c[1]),...Object.keys(head.settings.face).map(k=>'face_'+k),...Object.keys(head.settings.expressions).map(k=>'expr_'+k),...Object.keys(appearanceFields).map(k=>'color_'+k),...detailControls.map(c=>'paint_'+c[0]),...kateHairControls.map(c=>'hair_'+c[0]),...['width','height','depth','x','y','z','physics','layers','scalpFrontCut','color'].map(k=>'hair_'+k),...Object.keys(builtinHairCategories).map(k=>'hair_part_'+k)],ribbons:Boolean(ribbonTryOn),bundle:Boolean(attachedBundle)})};
const captureProject=()=>({...structuredClone(activeCharacterData||{}),format:'cyberjack-character',version:1,id:activeCharacterId,name:activeCharacterData?.name||activeCharacterId,hash:captureCharacter(),motion:bodyMotion.capture(),emotions:window.miraViewer.emotions?.captureProject()||activeCharacterData?.emotions});
characterLibrary({container:$('editor-character-slot'),capture:captureProject,onMetadata:data=>{activeCharacterData=data;bodyMotion.restore(data.motion);if(data.emotions)window.miraViewer.emotions?.restoreProject(data.emotions);},apply:async data=>{
 if(data.format!=='cyberjack-character'||data.version!==1||typeof data.hash!=='string')throw Error('Неверный формат персонажа');
 const presetArgs=new URLSearchParams(data.hash.replace(/^#/,''));presetArgs.set('character_id',data.id||'custom');
 activeCharacterData=structuredClone(data);activeSourceHash=data.hash;
 // The ribbon preview and the ordinary viewer use different hair engines.
 // Preserve that choice when a saved character is reopened in another page.
 const wantsRibbons=presetArgs.get('ribbon_tryon')==='1'||(Boolean(ribbonTryOn)&&data.id==='mira'&&!presetArgs.has('ribbon_tryon'));
 const wantsBundle=!wantsRibbons&&usesAttachedHair(data.hash);
 if(wantsRibbons!==Boolean(ribbonTryOn)||wantsBundle!==Boolean(attachedBundle)){
  sessionStorage.setItem('cyberjack-editor-project',JSON.stringify({...data,hash:presetArgs.toString()}));
  const target=new URL((wantsRibbons?'mira-ribbon-preview.html':'evanescia-keys.html')+(new URLSearchParams(location.search).has('editor')?'?editor=1':'')+'#'+presetArgs.toString(),location.href);
  // A hash-only navigation does not restart the hair engine.
  if(target.pathname===location.pathname&&target.search===location.search){history.replaceState(null,'',target.href);location.reload();}
  else location.assign(target.href);
  return;
 }
 activeCharacterId=data.id||'custom';const p=presetArgs;footRig.readHash(data.hash);footRig.sync();bodySurface.readHash(presetArgs.toString());
 playing=false;poseEnabled=false;poseTime=0;$('dance').textContent=playLabel();
 for(const m of morphs){const n=Number(p.get(m.name)||0);m.w=Number.isFinite(n)?Math.max(Number(m._row.inp.min),Math.min(Number(m._row.inp.max),n)):0;m._row.inp.value=m.w;m._row.val.textContent=m.procedural?'×'+Anatomy.ratios({[m.name]:m.w})[m.name].toFixed(2):m.w.toFixed(2);m._row.row.classList.toggle('on',Math.abs(m.w)>.001);}
 Object.assign(head.settings,{style:'mira',materials:'clay',expressions:{},lookX:0,lookY:0,face:{},appearance:{}});head.readHash(data.hash);hair.reset();hair.readHash(data.hash);
 if(hair.builtin&&hair.physicsSettings)Object.assign(hair.builtin.physics.settings,hair.physicsSettings);
 appearanceLoaded=false;rebuild();if(await loadHair()===false)throw Error('Сборка персонажа не завершена; пресет не сохранён в адресе');if(!head.ready)await loadHead();syncHeadUI();syncHairUI();updatePose();hair.builtin?.physics.reset();
 bodyMotion.restore(data.motion);window.miraViewer.emotions?.restoreProject(data.emotions);
 $('portrait-character').value=data.id||'';$('portrait-expression').value='neutral';syncPortrait();$('body-reference').hidden=true;
 history.replaceState(null,'',location.pathname+location.search+'#'+captureCharacter());$('frame-head').click();
}}).catch(e=>console.error('Character library',e));

import {setupEditorLayout} from './editor-layout.js?v=collider-tab-5';
setupEditorLayout();
const bodyColliderToggle=$('body-collider-overlay');if(bodyColliderToggle){bodyColliderToggle.checked=new URLSearchParams(location.search).has('show_colliders');colliderOverlay.enabled=bodyColliderToggle.checked;bodyColliderToggle.addEventListener('change',e=>{colliderOverlay.enabled=e.target.checked;});}
const motionSelect=document.createElement('select');motionSelect.disabled=!head.ready;motionSelect.setAttribute('aria-label','Анимация персонажа');for(const [value,label]of Object.entries(motionNames))motionSelect.add(new Option(label,value));$('dance').before(motionSelect);
const furnitureToggle=document.createElement('input');furnitureToggle.type='checkbox';furnitureToggle.checked=true;furnitureToggle.setAttribute('aria-label','Показывать мебель');const furnitureLabel=document.createElement('label');furnitureLabel.append(furnitureToggle,document.createTextNode(' Мебель'));$('rest').after(furnitureLabel);
const motionStatus=document.createElement('span');motionStatus.style.fontSize='11px';$('foot').append(motionStatus);
function motionHip(){const frame=AnatomyPose.sample(activeClip,0),pose=AnatomyPose.matrices(currentWeights,frame,activeClip);return anatomyGroup.localToWorld(new THREE.Vector3().fromArray(pose.posed[0]));}
async function showMotionFurniture(){await testFurniture.show(furnitureToggle.checked?(activeClip.furniture||(['sitting','lying'].includes(activeMotion)?activeMotion:'none')):'none',motionHip(),activeClip.support);}
furnitureToggle.onchange=()=>showMotionFurniture().catch(e=>motionStatus.textContent=e.message);
const motionClips={dance:ANATOMY_DANCE};let motionRequest=0;
motionSelect.onchange=async()=>{const request=++motionRequest,key=motionSelect.value;playing=false;$('dance').disabled=true;motionStatus.textContent='Загрузка…';try{const clip=locomotion.has(key)?await locomotion.getClip(key):animationLibrary.has(key)?await animationLibrary.getClip(key):(motionClips[key]??=await fetch('./assets/animations/'+key+'.json').then(r=>{if(!r.ok)throw Error('Не удалось загрузить анимацию');return r.json();}));if(request!==motionRequest)return;activeMotion=key;activeClip=clip;motionNames[key]=locomotion.has(key)?clip.name:animationLibrary.title(key)||motionNames[key]||clip.name;poseTime=0;if(fixedRibbonMode){fixedRibbonClock.reset();ribbonTryOn.fixedTicket=null;ribbonTryOn.rebuild();}poseEnabled=true;modelRoot.position.y=key==='lying'?.48:0;modelRoot.updateMatrixWorld(true);$('timeline').max=clip.duration;$('timeline').parentElement.title=clip.name;const number=$('foot').querySelector('input[type=number]');if(number)number.max=clip.duration;$('timeline').parentElement.firstChild.textContent=motionNames[key]+' · ';$('dance-time').nextSibling.textContent=' / '+clip.duration.toFixed(2)+' с';$('dance').textContent=playLabel();hair.builtin?.physics.reset();ribbonTryOn?.reset();updatePose();await showMotionFurniture();frameModel();motionStatus.textContent='';return true;}catch(error){motionStatus.textContent=error.message;return false;}finally{if(request===motionRequest)$('dance').disabled=false;}};
const locomotion=installLocomotion({select:motionSelect,onPick:()=>motionSelect.onchange(),getCharacter:()=>new URLSearchParams(location.hash.slice(1)).get('character_id')});
const animationLibrary=installAnimationLibrary({select:motionSelect,host:$('foot'),isReady:()=>head.ready,onPick:()=>motionSelect.onchange()});



// Start only after controls and pose dependencies have been initialized.
if(hair.settings.style!=='none'||ribbonTryOn)loadHair();
else loadHead().then(()=>{appearanceLoaded=head.ready||head.settings.style==='legacy';});

// Shared semantic clips work in both the character editor and ribbon preview.
installEmotions({head,host:$('head-expressions'),useSavedLibrary:false,getCharacter:()=>activeCharacterId||$('portrait-character').value,
 onReference:emotion=>{const character=activeCharacterId||$('portrait-character').value||'mira';
  const selector=$('portrait-character');if(![...selector.options].some(o=>o.value===character))selector.add(new Option(character,character));selector.value=character;
  const expressions=$('portrait-expression');if(![...expressions.options].some(o=>o.value===emotion))expressions.add(new Option(emotion,emotion));expressions.value=emotion;
  syncPortrait();frameHeadView();
 }}).then(system=>{if(!system)return;window.miraViewer.emotions=system;system.restoreProject(activeCharacterData?.emotions);bodyMotion.connect(system);bodyMotion.restore(activeCharacterData?.motion);
 const selector=$('portrait-expression');for(const clip of system.library.clips)if(![...selector.options].some(o=>o.value===clip.id))selector.add(new Option(clip.label,clip.id));
 $('portrait-image').onerror=()=>{$('portrait-caption').textContent='Для этого персонажа нет 2D-портрета '+$('portrait-expression').value;};
});
