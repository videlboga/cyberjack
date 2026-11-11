import {createMiraRibbonMaterial} from './mira-ribbon-material.js?v=2';
import * as T from './vendor/three/three.module.js';
function snapshot(mesh,world=false){mesh.updateWorldMatrix(true,false);const source=mesh.geometry.attributes.position,positions=new Float32Array(source.array.length),v=new T.Vector3();if(world){for(let i=0;i<source.count;i++)mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld).toArray(positions,i*3);}else positions.set(source.array);return {positions,indices:mesh.geometry.index?.array.slice(),matrix:world?null:mesh.matrixWorld.toArray()};}
export function createThreadedMiraRibbonHair(scene){
 const count=Math.max(1,Math.min(4,(navigator.hardwareConcurrency||4)-2)),states=[];let initialized=false,mode='all',error=null;
 const material=createMiraRibbonMaterial();
 const api={solveMS:0,workerMS:0,workers:count,reset(){for(const state of states)state.reset=true;},setDiagnostic(value){mode=value;},update(dt,head,body,contacts,anchor,fronts,settings,surfaceCollider,environment){
  if(error)throw Error(error);if(!head||!fronts?.length)return;const started=performance.now();head.updateWorldMatrix(true,false);body.updateWorldMatrix(true,false);anchor.updateWorldMatrix(true,false);
  if(!initialized){const initial={head:snapshot(head,true),body:snapshot(body,true),anchor:anchor.matrixWorld.toArray(),fronts:fronts.map(m=>snapshot(m))};
   for(let index=0;index<count;index++){const worker=new Worker(new URL('./ribbon-physics-worker.js?v=rollback-1',import.meta.url),{type:'module'}),state={worker,busy:true,ready:false,revision:-1,dt:0,bodyVersion:-1,bodyMatrix:new T.Matrix4(),elapsed:0,interval:1/30,lastFrame:performance.now(),recycle:null,mesh:null};states.push(state);
    worker.onmessage=({data})=>{if(data.type==='error'){error=data.message;console.error('Ribbon worker:',error);return;}if(data.type==='ready'){state.ready=true;state.busy=false;return;}if(data.type!=='frame')return;
     const now=performance.now();state.interval=Math.max(1/120,Math.min(.1,(now-state.lastFrame)/1000));state.lastFrame=now;state.elapsed=0;state.busy=false;state.revision=data.revision;state.workerMS=data.totalMS;
     if(!state.mesh){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(data.positions.slice(),3));geometry.setAttribute('normal',new T.BufferAttribute(data.normals.slice(),3));state.previous=data.positions.slice();state.target=data.positions.slice();state.mesh=new T.Mesh(geometry,material);state.mesh.frustumCulled=false;state.mesh.matrixAutoUpdate=false;scene.add(state.mesh);}else{state.previous.set(state.mesh.geometry.attributes.position.array);state.target.set(data.positions);state.mesh.geometry.attributes.normal.array.set(data.normals);state.mesh.geometry.attributes.normal.needsUpdate=true;}
     if(data.underside)state.mesh.geometry.setAttribute('miraUnderside',new T.BufferAttribute(data.underside,1));
     if(data.indices){if(state.mesh.geometry.index)state.mesh.geometry.dispose();state.mesh.geometry.setIndex(new T.BufferAttribute(data.indices,1));}state.recycle={positions:data.positions,normals:data.normals};
    };
    worker.onerror=event=>{error=event.message||`Ошибка запуска worker: ${event.filename||'скрипт'}:${event.lineno||0}`;};worker.postMessage({type:'init',...initial,partition:{index,count}});
   }initialized=true;
  }
  const bodyAttribute=body.geometry.attributes.position,bodyVersion=bodyAttribute.version;let posedBody=null,mergedBody=null,mergedIndex=null;
  for(const state of states){state.dt=Math.min(.05,state.dt+dt);
   if(state.mesh){state.mesh.matrix.copy(anchor.matrixWorld);state.mesh.matrixWorldNeedsUpdate=true;state.elapsed+=dt;const alpha=Math.min(1,state.elapsed/state.interval),out=state.mesh.geometry.attributes.position.array;for(let i=0;i<out.length;i++)out[i]=state.previous[i]+(state.target[i]-state.previous[i])*alpha;state.mesh.geometry.attributes.position.needsUpdate=true;}
   if(!state.ready||state.busy)continue;const environmentChanged=state.environmentVersion!==(environment?.version||0),changed=state.bodyAttribute!==bodyAttribute||state.bodyVersion!==bodyVersion||!state.bodyMatrix.equals(body.matrixWorld)||environmentChanged,message={type:'step',dt:state.dt,anchor:anchor.matrixWorld.toArray(),settings,diagnostic:mode,revision:changed?bodyVersion:state.revision},transfer=[];
   if(state.reset){message.reset=true;state.reset=false;}
   if(changed){posedBody??=snapshot(body,true).positions;if(!mergedBody){const extra=environment?.positions||new Float32Array();mergedBody=new Float32Array(posedBody.length+extra.length);mergedBody.set(posedBody);mergedBody.set(extra,posedBody.length);const index=body.geometry.index.array,extraIndex=environment?.indices||new Uint32Array();mergedIndex=new Uint32Array(index.length+extraIndex.length);mergedIndex.set(index);for(let i=0;i<extraIndex.length;i++)mergedIndex[index.length+i]=extraIndex[i]+posedBody.length/3;}message.body=mergedBody.slice();if(environmentChanged)message.indices=mergedIndex.slice();state.environmentVersion=environment?.version||0;state.bodyAttribute=bodyAttribute;transfer.push(message.body.buffer);if(message.indices)transfer.push(message.indices.buffer);state.bodyVersion=bodyVersion;state.bodyMatrix.copy(body.matrixWorld);}
   if(state.recycle){message.recycle=state.recycle;transfer.push(state.recycle.positions.buffer,state.recycle.normals.buffer);state.recycle=null;}
   state.dt=0;state.busy=true;state.worker.postMessage(message,transfer);
  }
  api.solveMS=performance.now()-started;api.workerMS=Math.max(0,...states.map(s=>s.workerMS||0));
 }};return api;
}
