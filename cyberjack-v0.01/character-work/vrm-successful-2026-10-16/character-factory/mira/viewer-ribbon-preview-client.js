import {createRibbonCapture} from './viewer-ribbon-capture.js?v=velocity66';
import {createMiraRibbonMaterial} from './mira-ribbon-preview-material.js?v=velocity66';
import * as T from './vendor/three/three.module.js';
function snapshot(mesh,world=false){mesh.updateWorldMatrix(true,false);const source=mesh.geometry.attributes.position,offset=mesh.geometry.attributes.hairContactOffset,normals=mesh.geometry.attributes.normal,positions=new Float32Array(source.array.length),v=new T.Vector3();if(world){for(let i=0;i<source.count;i++){mesh.getVertexPosition(i,v);if(offset&&normals){const d=offset.getX(i);v.x+=normals.getX(i)*d;v.y+=normals.getY(i)*d;v.z+=normals.getZ(i)*d;}v.applyMatrix4(mesh.matrixWorld).toArray(positions,i*3);}}else positions.set(source.array);return {positions,indices:mesh.geometry.index?.array.slice(),matrix:world?null:mesh.matrixWorld.toArray()};}
export function createThreadedMiraRibbonHair(scene){
 const count=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||4)-2)),states=[];let initialized=false,mode='all',error=null,unpresented=false;
 const simpleMode=new URLSearchParams(location.search).get('colliders')==='capsules';
 const packContacts=items=>(items||[]).map(s=>{const o={radius:s.radius,depthScale:s.depthScale,capScale:s.capScale,bodyPart:s.bodyPart,supplemental:s.supplemental};for(const k of ['a','b','center','depthAxis'])if(s[k])o[k]=s[k].toArray();return o;});
 const fixedMode=new URLSearchParams(location.search).has('fixed_clock');
 const material=createMiraRibbonMaterial(),tipMaterial=createMiraRibbonMaterial();
 tipMaterial.transparent=true;tipMaterial.alphaToCoverage=false;tipMaterial.depthWrite=false;tipMaterial.forceSinglePass=true;
 const capture=createRibbonCapture(()=>{api.onRegressionStart?.();api.reset();for(const state of states){state.bodyVersion=-1;state.environmentVersion=-1;state.restart=true;}});
 const api={get ready(){return states.length===count&&states.every(state=>state.mesh);},
 get canAdvancePose(){return initialized&&!unpresented&&states.every(state=>state.ready&&!state.busy&&!state.restart&&!state.reset);},
 get canPresent(){return unpresented&&states.every(state=>state.mesh&&!state.busy);},
 presented(){unpresented=false;if(api.fixedTicket){const ticket=api.fixedTicket;api.fixedTicket=null;api.onFixedPresented?.(ticket);}},rebuild(){
  for(const state of states){state.worker.terminate();if(state.mesh){scene.remove(state.mesh);state.mesh.geometry.dispose();}}
  states.length=0;initialized=false;error=null;unpresented=false;
 },solveMS:0,workerMS:0,workers:count,reset(){for(const state of states)state.reset=true;},setDiagnostic(value){mode=value;},update(dt,head,body,contacts,anchor,fronts,settings,surfaceCollider,environment){
  if(error)throw Error(error);if(!head||!fronts?.length)return;const started=performance.now();head.updateWorldMatrix(true,false);body.updateWorldMatrix(true,false);anchor.updateWorldMatrix(true,false);
  if(!initialized){const initial={contacts:packContacts(contacts),neckRegion:body.geometry.userData?.ribbonNeck,head:snapshot(head,true),body:snapshot(body,true),anchor:anchor.matrixWorld.toArray(),fronts:fronts.map(m=>snapshot(m))};
   for(let index=0;index<count;index++){const worker=new Worker(new URL((simpleMode?'./ribbon-simple-worker.js?v=91':'./ribbon-profile-worker.js?v=neck-fit99')+(new URLSearchParams(location.search).has('xpbd')?'&xpbd=1':'')+(new URLSearchParams(location.search).has('shape')?'&shape=1':''),import.meta.url),{type:'module'}),state={worker,busy:true,ready:false,revision:-1,dt:0,bodyVersion:-1,bodyMatrix:new T.Matrix4(),elapsed:0,interval:1/30,lastFrame:performance.now(),recycle:null,mesh:null};states.push(state);
    state.receive=({data})=>{if(!states.includes(state))return;if(data.type==='error'){error=data.message;console.error('Ribbon worker:',error);return;}if(data.type==='ready'){state.ready=true;state.busy=false;return;}if(data.type!=='frame')return;
     
     
     const now=performance.now();state.interval=Math.max(1/120,Math.min(.1,(now-state.lastFrame)/1000));state.lastFrame=now;state.elapsed=0;state.busy=false;state.revision=data.revision;state.workerMS=data.totalMS;state.profile=data.profile;state.solverMS=data.solverMS||0;state.overheadMS=Math.max(0,data.totalMS-state.solverMS);
     if(!state.mesh){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(data.positions.slice(),3));geometry.setAttribute('normal',new T.BufferAttribute(data.normals.slice(),3));state.mesh=new T.Mesh(geometry,[material,tipMaterial]);state.mesh.layers.set(30);state.mesh.frustumCulled=false;state.mesh.matrixAutoUpdate=false;scene.add(state.mesh);}
     else{state.mesh.geometry.attributes.position.array.set(data.positions);state.mesh.geometry.attributes.normal.array.set(data.normals);state.mesh.geometry.attributes.position.needsUpdate=true;state.mesh.geometry.attributes.normal.needsUpdate=true;}
     // Geometry and the visible body share this response's pose. No main-thread
     // root transport or interpolation may move a solved contact off its body.
     state.mesh.matrix.fromArray(data.anchor);state.mesh.matrixWorldNeedsUpdate=true;
     if(data.edgeInfo)state.mesh.geometry.setAttribute('miraEdgeInfo',new T.BufferAttribute(data.edgeInfo,2));
     if(data.edge)state.mesh.geometry.setAttribute('miraEdge',new T.BufferAttribute(data.edge,2));
     if(data.underside)state.mesh.geometry.setAttribute('miraUnderside',new T.BufferAttribute(data.underside,1));
     if(data.indices){
      const geometry=state.mesh.geometry,edge=geometry.attributes.miraEdge,underside=geometry.attributes.miraUnderside,solid=[],tips=[];
      // Group only the final narrow lengths into a continuously blended pass.
      // Their depth must not recreate an opaque contour after alpha fading.
      for(let i=0;i<data.indices.length;i+=3){const ids=[data.indices[i],data.indices[i+1],data.indices[i+2]],soft=ids.every(id=>edge.getY(id)>=.82&&underside.getX(id)>.9);(soft?tips:solid).push(...ids);}
      geometry.setIndex(new T.BufferAttribute(Uint32Array.from([...solid,...tips]),1));geometry.clearGroups();geometry.addGroup(0,solid.length,0);geometry.addGroup(solid.length,tips.length,1);
     }state.recycle={positions:data.positions,normals:data.normals};
    };
    // Commit a complete pose cohort: never display four different body revisions.
    worker.onmessage=event=>{if(event.data.type!=='frame'){state.receive(event);return;}state.pending=event;
     if(states.every(s=>s.pending)){const cohort=states.map(s=>s.pending);if(fixedMode&&api.fixedTicket?.tick===Number(new URLSearchParams(location.search).get('fixed_stop'))){let hash=2166136261;for(const event of cohort){const bytes=new Uint8Array(event.data.positions.buffer,event.data.positions.byteOffset,event.data.positions.byteLength);for(const value of bytes)hash=Math.imul(hash^value,16777619);}api.fixedSignature=(hash>>>0).toString(16).padStart(8,'0');}for(const s of states)s.pending=null;if(capture.enabled)capture.output(cohort[0].data,cohort.map((event,i)=>({solverState:event.data.solverState,positions:event.data.positions,anchor:event.data.anchor,indices:event.data.indices??states[i].mesh?.geometry.index.array})));states.forEach((s,i)=>s.receive(cohort[i]));unpresented=true;}
    };
    worker.onerror=event=>{error=event.message||`Ошибка запуска worker: ${event.filename||'скрипт'}:${event.lineno||0}`;};const initMessage={type:'init',...initial,partition:{index,count}};state.initial=initMessage;if(index===0)capture.init(initMessage);worker.postMessage(initMessage);
   }initialized=true;
  }
  const bodyAttribute=body.geometry.attributes.position,bodyVersion=bodyAttribute.version;let posedBody=null,mergedBody=null,mergedIndex=null;
  // A slider/pose change while a cohort was running invalidates that image.
  if(unpresented&&states.some(state=>state.revision!==bodyVersion||!state.bodyMatrix.equals(body.matrixWorld)))unpresented=false;
  const canDispatch=!unpresented&&states.every(state=>state.ready&&!state.busy);
  for(const state of states){state.dt=Math.min(.1,state.dt+dt);
   if(!canDispatch)continue;if(fixedMode&&!api.fixedTicket&&state.mesh&&!state.reset&&!state.restart)continue;if(state.restart){state.restart=false;state.busy=true;state.worker.postMessage(state.initial);continue;}const environmentChanged=state.environmentVersion!==(environment?.version||0),changed=state.bodyAttribute!==bodyAttribute||state.bodyVersion!==bodyVersion||!state.bodyMatrix.equals(body.matrixWorld)||environmentChanged,message={type:'step',contacts:packContacts(simpleMode?contacts:contacts.filter(s=>s.supplemental)),captureState:capture.enabled&&new URLSearchParams(location.search).has('capture_state'),dt:fixedMode?(api.fixedTicket?.dt??0):new URLSearchParams(location.search).has('regression')?1/60:state.dt,poseTime:api.poseTime,anchor:anchor.matrixWorld.toArray(),settings,diagnostic:mode,contactExperiment:new URLSearchParams(location.hash.slice(1)).get('contact_motion')==='1',neckExperiment:new URLSearchParams(location.hash.slice(1)).get('neck_contact')==='1',revision:changed?bodyVersion:state.revision},transfer=[];
   if(state.reset){message.reset=true;state.reset=false;}
   if(changed){posedBody??=snapshot(body,true).positions;if(!mergedBody){const extra=environment?.positions||new Float32Array();mergedBody=new Float32Array(posedBody.length+extra.length);mergedBody.set(posedBody);mergedBody.set(extra,posedBody.length);const index=body.geometry.index.array,extraIndex=environment?.indices||new Uint32Array();mergedIndex=new Uint32Array(index.length+extraIndex.length);mergedIndex.set(index);for(let i=0;i<extraIndex.length;i++)mergedIndex[index.length+i]=extraIndex[i]+posedBody.length/3;}message.body=mergedBody.slice();if(environmentChanged)message.indices=mergedIndex.slice();state.environmentVersion=environment?.version||0;state.bodyAttribute=bodyAttribute;transfer.push(message.body.buffer);if(message.indices)transfer.push(message.indices.buffer);state.bodyVersion=bodyVersion;state.bodyMatrix.copy(body.matrixWorld);}
   if(state.recycle){message.recycle=state.recycle;transfer.push(state.recycle.positions.buffer,state.recycle.normals.buffer);state.recycle=null;}
   if(state===states[0])capture.input(message);state.dt=0;state.busy=true;state.worker.postMessage(message,transfer);
  }
  api.profile=states.map(s=>s.profile||{});api.solveMS=performance.now()-started;api.workerMS=Math.max(0,...states.map(s=>s.workerMS||0));api.solverMS=Math.max(0,...states.map(s=>s.solverMS||0));api.overheadMS=Math.max(0,...states.map(s=>s.overheadMS||0));
 }};return api;
}
