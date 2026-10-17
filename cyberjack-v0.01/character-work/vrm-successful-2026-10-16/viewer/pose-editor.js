import * as THREE from 'three';
import {TransformControls} from 'three/addons/controls/TransformControls.js';
import {registerPoseAvatar,capturePose,applySnapshot,setWorldRotation,moveJoint,sampleFrames,upsertFrame,encodeProject,decodeProject,exportVrma} from './pose-editor-core.js';

const names={hips:'Таз',spine:'Позвоночник',chest:'Грудь',upperChest:'Верх груди',neck:'Шея',head:'Голова',leftShoulder:'Левая ключица',rightShoulder:'Правая ключица',leftUpperArm:'Левое плечо',rightUpperArm:'Правое плечо',leftLowerArm:'Левый локоть',rightLowerArm:'Правый локоть',leftHand:'Левая кисть',rightHand:'Правая кисть',leftUpperLeg:'Левое бедро',rightUpperLeg:'Правое бедро',leftLowerLeg:'Левое колено',rightLowerLeg:'Правое колено',leftFoot:'Левая стопа',rightFoot:'Правая стопа',leftToes:'Левые пальцы ноги',rightToes:'Правые пальцы ноги',leftEye:'Левый глаз',rightEye:'Правый глаз'};
function boneLabel(name){if(names[name])return names[name];return name.replace(/^left/,'Л. ').replace(/^right/,'П. ').replace('Thumb','Большой ').replace('Index','Указательный ').replace('Middle','Средний ').replace('Ring','Безымянный ').replace('Little','Мизинец ').replace('Metacarpal','основание').replace('Proximal','1').replace('Intermediate','2').replace('Distal','3');}
const clone=o=>structuredClone(o),worldPos=n=>n.getWorldPosition(new THREE.Vector3()),worldQ=n=>n.getWorldQuaternion(new THREE.Quaternion());
const fresh=()=>({name:'Мой клип',duration:2,interpolation:'linear',loop:true,time:0,frames:[],poses:{}});
const STORE='cyberjack-pose-editor-draft-v1';

export function createPoseEditor({scene,camera,renderer,controls,host,getAvatars,pauseSource=()=>{}}){
  const section=document.createElement('section');section.className='pose-editor';
  section.innerHTML=`<div class="pe-heading"><strong>Редактор поз</strong><label class="pe-enable-label"><input class="pe-enable" type="checkbox" aria-label="Редактировать позу"> Включить</label></div>
  <p class="pe-intro">Поза из любого режима → правка суставов → свой клип.</p>
  <div class="pe-body" hidden>
   <label>Персонаж<select class="pe-actor" aria-label="Персонаж редактора"></select></label>
   <label>Сустав<select class="pe-bone" aria-label="Сустав редактора"></select></label>
   <div class="pe-row"><label>Инструмент<select class="pe-mode" aria-label="Инструмент редактора"><option value="rotate">Вращение</option><option value="ik">Перемещение · IK</option><option value="free">Свободный сдвиг</option></select></label><label>Оси<select class="pe-space" aria-label="Оси редактора"><option value="local">Локальные</option><option value="world">Мировые</option></select></label></div>
   <label class="pe-check"><input class="pe-markers" type="checkbox" checked> Выбирать суставы на модели</label>
   <div class="pe-values"><label>X<input type="number" class="pe-x" aria-label="Сустав X" step="1"></label><label>Y<input type="number" class="pe-y" aria-label="Сустав Y" step="1"></label><label>Z<input type="number" class="pe-z" aria-label="Сустав Z" step="1"></label></div>
   <small class="pe-unit"></small><p class="pe-hint"></p>
   <div class="pe-row"><button class="pe-undo">Отменить</button><button class="pe-redo">Повторить</button></div>
   <div class="pe-row"><button class="pe-reset-joint">Сброс сустава</button><button class="pe-source">Взять текущую позу</button></div>
   <details class="pe-clip" open><summary>Ключи и клип</summary>
    <label>Название<input class="pe-name" aria-label="Название клипа" value="Мой клип" maxlength="120"></label><button class="pe-new">Новый клип из этой позы</button>
    <div class="pe-row"><label>Длительность, с<input class="pe-duration" aria-label="Длительность клипа" type="number" min="0.033" max="3600" step="0.1" value="2"></label><label>Переход<select class="pe-interpolation" aria-label="Интерполяция клипа"><option value="linear">Плавный</option><option value="step">Ступенчатый</option></select></label></div>
    <div class="pe-row"><button class="pe-play" aria-label="Проиграть свой клип">▶ Клип</button><label class="pe-check"><input class="pe-loop" type="checkbox" checked> По кругу</label></div>
    <input class="pe-time" type="range" min="0" max="2" step="0.001" value="0" aria-label="Время своего клипа">
    <div class="pe-row pe-clock"><label>Время, с<input class="pe-seconds" aria-label="Время ключа" type="number" min="0" max="2" step="0.033" value="0"></label><span class="pe-count">Нет ключей</span></div>
    <div class="pe-row"><button class="pe-key">＋ Ключ</button><button class="pe-delete">Удалить ключ</button></div>
    <div class="pe-keys" aria-label="Ключевые кадры"></div>
    <div class="pe-row"><button class="pe-save">Скачать JSON</button><button class="pe-vrma">Скачать VRMA</button></div>
    <button class="pe-import">Открыть клип JSON</button><input class="pe-file" type="file" accept=".json,application/json" hidden>
    <small>JSON сохраняет всех участников и свободные сдвиги. VRMA — выбранного персонажа, вращения и положение таза.</small>
   </details>
  </div>
  <button class="pe-restore" hidden>Восстановить черновик</button><p class="pe-status" role="status">Выберите позу и включите редактор.</p>`;
  host.append(section);
  const $=s=>section.querySelector(s),inputs=['x','y','z'].map(a=>$('.pe-'+a));
  const badge=document.createElement('div');badge.className='pe-stage-badge';badge.hidden=true;renderer.domElement.parentElement.append(badge);
  let objectFocus=false;
  let active=false,playing=false,project=fresh(),records=new Map(),actorId='main',selected='hips',dirty=false;
  let lastActors='',undo=[],redo=[],dragStart=null,disposed=false,message='',autosaveTimer=null,baselineSource=null,jointCommit=null,jointTimer=null,pendingDraft=null;
  const proxy=new THREE.Object3D();scene.add(proxy);
  const gizmo=new TransformControls(camera,renderer.domElement);gizmo.setMode('rotate');gizmo.setSize(.72);gizmo.setSpace('local');
  const helper=gizmo.getHelper();scene.add(helper);helper.visible=false;
  const markers=new THREE.Group();markers.name='Pose editor joints';scene.add(markers);
  const sphere=new THREE.SphereGeometry(.013,10,8),material=new THREE.MeshBasicMaterial({color:0x3f95e8,depthTest:false,transparent:true,opacity:.72});
  const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
  function status(text,error=false){message=text;$('.pe-status').textContent=text;$('.pe-status').dataset.error=String(error);}
  function safe(fn){return (...args)=>{try{return fn(...args);}catch(e){status(e.message,true);console.error(e);}};}
  function record(){return records.get(actorId);}
  function selectedNode(){const r=record();return selected==='__root'?r?.vrm.scene:r?.nodes.get(r.human[selected]);}
  function captureAll(){return Object.fromEntries([...records].map(([id,r])=>[id,capturePose(r)]));}
  function applyAll(){for(const [id,r] of records){const p=project.poses[id];if(p)applySnapshot(r,p);}}
  function remember(){undo.push({project:clone(project),dirty});if(undo.length>30)undo.shift();redo=[];updateButtons();}
  function changeDone(text='Поза изменена. Добавьте или обновите ключ.'){
    project.poses=captureAll();dirty=true;playing=false;updateButtons();updateFields();status(text);queueSave();
  }
  function queueSave(){clearTimeout(autosaveTimer);const payload=JSON.stringify(encodeProject(project,records));pendingDraft=payload;autosaveTimer=setTimeout(()=>{try{localStorage.setItem(STORE,payload);$('.pe-restore').hidden=false;}catch(e){status('Поза сохранена в памяти. Для сохранения на диск скачайте JSON: '+e.message,true);}},450);}
  function updateButtons(){
    $('.pe-undo').disabled=!undo.length;$('.pe-redo').disabled=!redo.length;
    $('.pe-play').textContent=playing?'Ⅱ Пауза':'▶ Клип';$('.pe-play').setAttribute('aria-label',playing?'Приостановить свой клип':'Проиграть свой клип');$('.pe-play').disabled=!project.frames.length;
    $('.pe-delete').disabled=!project.frames.some(k=>Math.abs(k.time-project.time)<.0005);
    $('.pe-vrma').disabled=!project.frames.length;
  }
  function bindMarkers(){markers.clear();const r=record();if(!r)return;
    for(const [name,id] of Object.entries(r.human)){
      if(!names[name]||name.endsWith('Eye'))continue;
      const m=new THREE.Mesh(sphere,material);m.renderOrder=999;m.userData.bone=name;markers.add(m);
    }
  }
  function selectBone(name){objectFocus=false;commitJoint();selected=name;$('.pe-bone').value=name;syncProxy();updateFields();}
  function boneOptions(){const r=record();$('.pe-bone').replaceChildren();if(!r)return;
    $('.pe-bone').add(new Option('Вся модель','__root'));
    for(const name of Object.keys(r.human))if(!name.endsWith('Eye'))$('.pe-bone').add(new Option(boneLabel(name),name));
    if(selected!=='__root'&&!r.human[selected])selected='hips';$('.pe-bone').value=selected;
    bindMarkers();syncProxy();updateFields();
  }
  function syncProxy(){
    if(objectFocus){helper.visible=false;gizmo.enabled=false;gizmo.detach();markers.visible=false;return;}
    const n=selectedNode();helper.visible=active&&Boolean(n);gizmo.enabled=active&&Boolean(n);
    if(!n){gizmo.detach();return;}
    if(!gizmo.dragging){proxy.position.copy(worldPos(n));proxy.quaternion.copy(worldQ(n));proxy.updateMatrixWorld(true);}
    if(active&&gizmo.object!==proxy)gizmo.attach(proxy);
  }
  function updateFields(){
    const n=selectedNode();if(!n)return;
    const rotation=$('.pe-mode').value==='rotate',world=$('.pe-space').value==='world';
    let values;if(rotation){const q=world?worldQ(n):n.quaternion;const e=new THREE.Euler().setFromQuaternion(q,'XYZ');values=[e.x,e.y,e.z].map(THREE.MathUtils.radToDeg);}
    else values=(world?worldPos(n):n.position).toArray();
    inputs.forEach((el,i)=>{if(document.activeElement!==el)el.value=values[i].toFixed(rotation?2:4);el.step=rotation?'1':'.01';});
    $('.pe-unit').textContent=rotation?'Углы в градусах · порядок XYZ':'Координаты в метрах';
    $('.pe-hint').textContent=$('.pe-mode').value==='ik'?'Кисти и стопы: IK с сохранением длин. Локти и колени: направление сгиба. Другие суставы: поворот родителя.':$('.pe-mode').value==='free'?'Свободный сдвиг меняет расстояние между суставами. Для такого клипа используйте JSON.':'Потяните цветное кольцо или задайте угол числом.';
  }
  function drawTimeline(){
    $('.pe-time').max=$('.pe-seconds').max=String(project.duration);$('.pe-time').value=String(project.time);if(document.activeElement!==$('.pe-seconds'))$('.pe-seconds').value=project.time.toFixed(3);
    $('.pe-count').textContent=`${project.frames.length} ключ. · ${project.time.toFixed(2)} с`;
    $('.pe-keys').replaceChildren();for(const key of project.frames){const b=document.createElement('button');b.type='button';b.textContent=key.time.toFixed(3)+' с';b.classList.toggle('selected',Math.abs(project.time-key.time)<.0005);b.onclick=()=>seek(key.time);$('.pe-keys').append(b);}
    updateButtons();
  }
  function syncUi(){
    $('.pe-name').value=project.name;$('.pe-duration').value=String(project.duration);$('.pe-interpolation').value=project.interpolation;$('.pe-loop').checked=project.loop;
    drawTimeline();syncProxy();updateFields();
  }
  function syncActors(){
    const actors=getAvatars().filter(a=>a.vrm);if(!actors.length){helper.visible=false;markers.visible=false;return;}
    const key=actors.map(a=>a.id+':'+a.vrm.scene.uuid).join('|');if(key===lastActors)return;
    const next=new Map(actors.map(a=>[a.id,Object.assign(registerPoseAvatar(a.vrm),{label:a.label||a.id})]));
    const compatible=records.size&&next.size===records.size&&[...next].every(([id,r])=>records.get(id)?.signature===r.signature);
    lastActors=key;records=next;$('.pe-actor').replaceChildren();for(const [id,r] of records)$('.pe-actor').add(new Option(r.label,id));
    if(!records.has(actorId))actorId=records.keys().next().value;$('.pe-actor').value=actorId;
    if(!compatible){
      if(active){active=false;playing=false;$('.pe-enable').checked=false;$('.pe-body').hidden=true;gizmo.detach();status('Модель или состав сцены изменились. Включите редактор, чтобы взять новую позу.');}
      project=fresh();project.poses=captureAll();undo=[];redo=[];dirty=false;
    }else if(active)applyAll();
    boneOptions();syncUi();
  }
  function enable(value,{preserve=false}={}){
    syncActors();if(value&&!records.size)throw Error('Сначала загрузите персонажа');
    if(value){objectFocus=false;pauseSource();if(!preserve){project.poses=captureAll();baselineSource=clone(project.poses);dirty=false;}active=true;}
    else{active=false;playing=false;gizmo.detach();controls.enabled=true;}
    $('.pe-enable').checked=active;$('.pe-body').hidden=!active;markers.visible=active&&$('.pe-markers').checked;syncProxy();syncUi();
    status(active?'Поза зафиксирована. Выберите сустав на модели или в списке.':'Редактор выключен. Исходное движение снова управляет моделью.');
  }
  function seek(time){
    commitJoint();
    if(dirty)remember();
    playing=false;project.time=THREE.MathUtils.clamp(Number(time)||0,0,project.duration);
    const sampled=sampleFrames(project.frames,project.time,project.interpolation);if(sampled){project.poses=sampled;dirty=false;applyAll();}
    drawTimeline();syncProxy();updateFields();status('Кадр '+project.time.toFixed(3)+' с');
  }
  function alter(values,context={}){
    const r=records.get(context.actor||actorId),name=context.bone||selected;
    const n=name==='__root'?r?.vrm.scene:r?.nodes.get(r.human[name]);
    const mode=context.mode||$('.pe-mode').value,space=context.space||$('.pe-space').value;
    if(!n)throw Error('Сустав не выбран');if(!values.every(Number.isFinite))throw Error('Введите конечные числа');
    remember();playing=false;
    if(mode==='rotate'){
      const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(...values.map(THREE.MathUtils.degToRad),'XYZ'));
      if(space==='world')setWorldRotation(n,q);else{n.quaternion.copy(q);n.updateWorldMatrix(false,true);}
    }else{
      const target=new THREE.Vector3(...values);if(space==='local'&&n.parent)n.parent.localToWorld(target);
      const result=moveJoint(r,name,target,{free:mode==='free'});
      if(result.clamped)status('Цель ограничена длиной конечности.');
    }
    changeDone();syncProxy();
  }
  function commitJoint(){if(!jointCommit)return;clearTimeout(jointTimer);const pending=jointCommit;jointCommit=null;alter(pending.values,pending);}
  function download(data,type,extension){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=(project.name.replace(/[^\p{L}\p{N}_ -]/gu,'').trim()||'pose-clip')+extension;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  function addKey(){commitJoint();remember();playing=false;project.poses=captureAll();project.frames=upsertFrame(project.frames,project.time,project.poses);dirty=false;drawTimeline();status('Ключ сохранён: '+project.time.toFixed(3)+' с');queueSave();}
  function load(doc){syncActors();const next=decodeProject(doc,records);remember();project=next;pauseSource();enable(true,{preserve:true});applyAll();syncUi();status('Клип открыт: '+project.name);queueSave();}
  $('.pe-enable').onchange=safe(e=>enable(e.target.checked));
  $('.pe-actor').onchange=safe(()=>{commitJoint();actorId=$('.pe-actor').value;boneOptions();});$('.pe-bone').onchange=safe(()=>selectBone($('.pe-bone').value));
  $('.pe-mode').onchange=safe(()=>{commitJoint();gizmo.setMode($('.pe-mode').value==='rotate'?'rotate':'translate');syncProxy();updateFields();});
  $('.pe-space').onchange=safe(()=>{commitJoint();gizmo.setSpace($('.pe-space').value);syncProxy();updateFields();});$('.pe-markers').onchange=()=>{markers.visible=active&&$('.pe-markers').checked;};
  for(const input of inputs){input.oninput=()=>{jointCommit={values:inputs.map(n=>Number(n.value)),actor:actorId,bone:selected,mode:$('.pe-mode').value,space:$('.pe-space').value};clearTimeout(jointTimer);jointTimer=setTimeout(safe(commitJoint),160);};input.onchange=safe(commitJoint);input.onblur=safe(commitJoint);}
  $('.pe-key').onclick=safe(addKey);
  $('.pe-delete').onclick=safe(()=>{remember();playing=false;project.frames=project.frames.filter(k=>Math.abs(k.time-project.time)>.0005);drawTimeline();queueSave();status('Ключ удалён');});
  $('.pe-time').oninput=safe(e=>seek(e.target.value));$('.pe-seconds').oninput=safe(e=>seek(e.target.value));$('.pe-seconds').onchange=safe(e=>seek(e.target.value));
  $('.pe-name').oninput=$('.pe-name').onchange=()=>{project.name=$('.pe-name').value.trim()||'Мой клип';queueSave();};
  $('.pe-new').onclick=safe(()=>{commitJoint();remember();playing=false;project=fresh();project.poses=captureAll();baselineSource=clone(project.poses);dirty=false;syncUi();queueSave();status('Новый клип создан из текущей позы. Предыдущий можно вернуть кнопкой «Отменить».');});
  $('.pe-duration').onchange=safe(()=>{const n=Number($('.pe-duration').value);if(!Number.isFinite(n)||n<.033||n>3600)throw Error('Длительность: от 0,033 до 3600 секунд');if(project.frames.some(k=>k.time>n)){ $('.pe-duration').value=String(project.duration);throw Error('За новой границей есть ключи. Сначала удалите или перенесите их.');}remember();project.duration=n;project.time=Math.min(project.time,n);drawTimeline();queueSave();});
  $('.pe-interpolation').onchange=()=>{remember();project.interpolation=$('.pe-interpolation').value;queueSave();};$('.pe-loop').onchange=()=>{project.loop=$('.pe-loop').checked;queueSave();};
  $('.pe-play').onclick=safe(()=>{commitJoint();if(dirty)addKey();if(!project.frames.length)return;if(project.time>=project.duration)project.time=0;playing=!playing;updateButtons();});
  $('.pe-undo').onclick=safe(()=>{commitJoint();if(!undo.length)return;redo.push({project:clone(project),dirty});({project,dirty}=undo.pop());playing=false;applyAll();syncUi();status('Изменение отменено');queueSave();});
  $('.pe-redo').onclick=()=>{if(!redo.length)return;undo.push({project:clone(project),dirty});({project,dirty}=redo.pop());playing=false;applyAll();syncUi();status('Изменение повторено');queueSave();};
  $('.pe-reset-joint').onclick=safe(()=>{commitJoint();remember();const r=record(),n=selectedNode(),id=r.human[selected];const initial=baselineSource?.[actorId]||r.rest;const t=selected==='__root'?initial.root:initial.nodes[id];if(!t)throw Error('Нет исходной позы сустава');n.position.fromArray(t.p);n.quaternion.fromArray(t.q);n.scale.fromArray(t.s);n.updateWorldMatrix(false,true);changeDone('Сустав возвращён к позе на момент включения редактора.');syncProxy();});
  $('.pe-source').onclick=safe(()=>{remember();active=false;gizmo.detach();playing=false;status('Получаю позу исходного движения…');requestAnimationFrame(()=>requestAnimationFrame(()=>{project.poses=captureAll();baselineSource=clone(project.poses);enable(true,{preserve:true});changeDone('Текущая поза движения скопирована в редактор.');}));});
  $('.pe-save').onclick=safe(()=>{if(dirty||!project.frames.length)addKey();download(JSON.stringify(encodeProject(project,records),null,2),'application/json','.json');status('Клип скачан. Можно открыть его в редакторе на том же составе моделей.');queueSave();});
  $('.pe-vrma').onclick=safe(()=>{if(dirty)addKey();const bytes=exportVrma(record(),project.frames,actorId,project.interpolation,project.duration);download(bytes,'model/gltf-binary','.vrma');status('VRMA выбранного персонажа скачан.');});
  $('.pe-import').onclick=()=>$('.pe-file').click();$('.pe-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>20*1024*1024)throw Error('Размер клипа больше 20 МБ');load(JSON.parse(await file.text()));}catch(error){status(error.message,true);}finally{e.target.value='';}};
  $('.pe-restore').onclick=safe(()=>{const text=localStorage.getItem(STORE);if(!text)throw Error('Черновик не найден');load(JSON.parse(text));});
  try{$('.pe-restore').hidden=!localStorage.getItem(STORE);}catch{}
  gizmo.addEventListener('dragging-changed',e=>{controls.enabled=!e.value;if(e.value){remember();playing=false;dragStart=clone(project.poses);}else if(dragStart){dragStart=null;changeDone();syncProxy();}});
  gizmo.addEventListener('objectChange',safe(()=>{
    if(!active||!gizmo.dragging)return;const n=selectedNode();
    if($('.pe-mode').value==='rotate')setWorldRotation(n,proxy.quaternion);
    else {if(dragStart)for(const [id,r] of records)if(dragStart[id])applySnapshot(r,dragStart[id]);moveJoint(record(),selected,proxy.position.clone(),{free:$('.pe-mode').value==='free'});}
    project.poses=captureAll();dirty=true;updateFields();
  }));
  function choose(event){
    if(!active||!markers.visible||gizmo.dragging||gizmo.axis||event.button!==0)return;
    const rect=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(markers.children,false)[0];if(hit){selectBone(hit.object.userData.bone);event.preventDefault();}
  }
  renderer.domElement.addEventListener('pointerdown',choose);
  function keyboard(e){if(!active||e.target.closest('input,select,textarea,[contenteditable=true]'))return;
    if((e.ctrlKey||e.metaKey)&&e.code==='KeyZ'){e.preventDefault();$(e.shiftKey?'.pe-redo':'.pe-undo').click();}
    else if(e.code==='KeyR'){$('.pe-mode').value='rotate';$('.pe-mode').onchange();}
    else if(e.code==='KeyG'){$('.pe-mode').value='ik';$('.pe-mode').onchange();}
    else if(e.code==='KeyK'){e.preventDefault();safe(addKey)();}
  }
  window.addEventListener('keydown',keyboard);
  function saveOnExit(){try{commitJoint();if(pendingDraft)localStorage.setItem(STORE,pendingDraft);}catch{}}
  window.addEventListener('pagehide',saveOnExit);
  function update(dt=0){
    if(disposed)return;syncActors();badge.hidden=!active;if(!active){helper.visible=false;markers.visible=false;return;}
    badge.textContent=(playing?'Клип · '+project.name+' · '+project.time.toFixed(2)+' с':'Редактор · '+boneLabel(selected==='__root'?'Вся модель':selected));
    if(playing){project.time+=dt;if(project.time>project.duration){if(project.loop)project.time%=project.duration;else{project.time=project.duration;playing=false;}}project.poses=sampleFrames(project.frames,project.time,project.interpolation)||project.poses;$('.pe-time').value=String(project.time);$('.pe-seconds').value=project.time.toFixed(3);$('.pe-count').textContent=`${project.frames.length} ключ. · ${project.time.toFixed(2)} с`;updateButtons();}
    applyAll();markers.visible=!objectFocus&&$('.pe-markers').checked;
    if(playing)updateFields();
    const r=record();for(const marker of markers.children){const node=r.nodes.get(r.human[marker.userData.bone]);if(node)marker.position.copy(worldPos(node));marker.scale.setScalar(marker.userData.bone===selected?1.5:1);}
    markers.updateMatrixWorld(true);syncProxy();
  }
  function importSource({name,duration,sample}){
    if(!Number.isFinite(duration)||duration<.033||duration>3600)throw Error('Длительность источника вне диапазона 0,033–3600 с');
    syncActors();if(!records.size)throw Error('Сначала загрузите персонажа');
    commitJoint();remember();pauseSource();active=false;playing=false;
    const previous=clone(project),frames=[],count=Math.min(999,Math.max(1,Math.floor(duration*30)));
    try{for(let i=0;i<=count;i++){const time=duration*i/count;sample(time);frames.push({time,poses:captureAll()});}
      project={...fresh(),name:String(name||'Копия движения').slice(0,120),duration,frames,poses:clone(frames[0].poses)};baselineSource=clone(project.poses);dirty=false;
      enable(true,{preserve:true});applyAll();syncUi();queueSave();status(`Движение скопировано: ${frames.length} ключей, ${(count/duration).toFixed(1)} кадров/с. Правки сохраняются в копию.`);
    }catch(e){project=previous;enable(true,{preserve:true});applyAll();throw e;}
  }
  syncActors();
  return {section,importSource,get objectFocus(){return objectFocus;},setObjectFocus(value){commitJoint();objectFocus=Boolean(value);playing=false;syncProxy();},commit(){commitJoint();if(dirty||!project.frames.length)addKey();return encodeProject(project,records);},get active(){return active;},get state(){return {active,playing,actor:actorId,bone:selected,time:project.time,duration:project.duration,keys:project.frames.map(k=>k.time),dirty,message};},update,enable,seek,selectBone,addKey,load,
    exportProject:()=>encodeProject(project,records),
    destroy(){saveOnExit();disposed=true;clearTimeout(autosaveTimer);clearTimeout(jointTimer);gizmo.detach();gizmo.dispose();scene.remove(helper,proxy,markers);sphere.dispose();material.dispose();renderer.domElement.removeEventListener('pointerdown',choose);window.removeEventListener('keydown',keyboard);window.removeEventListener('pagehide',saveOnExit);badge.remove();section.remove();}
  };
}
