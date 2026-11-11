import {createRibbonNeckBarrier} from './ribbon-neck-barrier.js?v=velocity66';
import {createRibbonMotionStep} from './ribbon-motion-step.js?v=velocity66';
const useXPBD=new URL(self.location.href).searchParams.has('xpbd'),useShape=new URL(self.location.href).searchParams.has('shape');
let T,createMiraRibbonHair,MeshSurfaceCollider;
const boot=Promise.all([import('./vendor/three/three.module.js'),import('./viewer-ribbon-inertia-hair.js?v=root97'),import('./mesh-surface-collider-candidate.js?v=velocity66')]).then(([three,hair,contact])=>{T=three;createMiraRibbonHair=hair.createMiraRibbonHair;MeshSurfaceCollider=contact.MeshSurfaceCollider;}).catch(error=>{self.postMessage({type:'error',message:'Worker import: '+(error.stack||String(error))});throw error;});
const profile={};let queryDepth=0;function instrument(collider){for(const name of ['nearestInto','segmentContact','intersections','contains','projectParticle']){const original=collider[name];if(!original)continue;collider[name]=function(...args){const outer=queryDepth++===0,start=outer?performance.now():0;try{return original.apply(this,args);}finally{queryDepth--;if(outer){const entry=profile[name]??={ms:0,calls:0};entry.ms+=performance.now()-start;entry.calls++;}}};}}
let previousContacts=[];
function unpackContacts(items){return (items||[]).filter(s=>s.supplemental).map(s=>{const out={...s};for(const k of ['a','b','center','depthAxis'])if(s[k])out[k]=new T.Vector3().fromArray(s[k]);return out;});}
let scene,hair,head,body,anchor,fronts,surface,revision=-1,diagnostic='all',sentMode=null;const pool=[];let motionStep,posedSurface=null,posedIndices=null,neckBarrier=null;
function mesh(data){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(data.positions,3));if(data.indices)g.setIndex(new T.BufferAttribute(data.indices,1));const m=new T.Mesh(g);if(data.matrix){m.matrixAutoUpdate=false;m.matrix.fromArray(data.matrix);m.updateMatrixWorld(true);}return m;}
self.onmessage=async({data})=>{try{await boot;
 if(data.type==='init'){previousContacts=unpackContacts(data.contacts);motionStep=createRibbonMotionStep();posedSurface=data.body.positions.slice();posedIndices=data.body.indices;scene=new T.Scene();head=mesh(data.head);body=mesh(data.body);anchor=new T.Group();anchor.matrixAutoUpdate=false;anchor.matrix.fromArray(data.anchor);anchor.updateMatrixWorld(true);fronts=data.fronts.map(mesh);surface=new MeshSurfaceCollider();instrument(surface);hair=createMiraRibbonHair(scene,{partition:data.partition});neckBarrier=createRibbonNeckBarrier(data.body.positions,data.body.indices,data.neckRegion);
surface.update(data.body.positions,body.geometry.index.array);hair.update(0,head,body,[],anchor,fronts,{enabled:false,stiffness:.35,damping:.35,motion:.85,wind:0},surface);self.postMessage({type:'ready'});return;}
 if(data.type!=='step')return;
 if(data.recycle)pool.push(data.recycle);
 for(const key in profile)delete profile[key];const started=performance.now();if(data.body){posedSurface=data.body;posedIndices=data.indices||posedIndices;revision=data.revision;}
 const nextContacts=unpackContacts(data.contacts);let contactPhase=0;
 let solverMS=0;
 const motion=motionStep({body:posedSurface,indices:posedIndices,anchor:data.anchor,dt:data.dt,reset:data.reset,maxSubsteps:data.neckExperiment&&data.dt>1/30?2:data.contactExperiment?(data.contactSubsteps??3):1},(positions,indices,matrix,dt,reset,phase)=>{
  const alpha=++contactPhase/(phase?.substeps||1),contacts=nextContacts.map((s,i)=>{const out={...s},prev=previousContacts[i];if(prev&&!reset)for(const k of ['a','b','center','depthAxis'])if(s[k]&&prev[k])out[k]=prev[k].clone().lerp(s[k],alpha);return out;});
  body.geometry.attributes.position.array.set(positions.subarray(0,body.geometry.attributes.position.array.length));body.geometry.attributes.position.needsUpdate=true;
  surface.update(positions,indices);neckBarrier?.update(positions);surface.neckBarrier=neckBarrier;surface.allowSweep=Boolean(data.contactExperiment)&&data.contactSweep!==false;anchor.matrix.copy(matrix);anchor.updateMatrixWorld(true);
  if(reset)hair.update(0,head,body,[],anchor,fronts,{...data.settings,xpbd:useXPBD,xpbdShape:useShape,enabled:false},surface);
  hair.update(dt,head,body,contacts,anchor,fronts,{...data.settings,xpbd:useXPBD,xpbdShape:useShape,contactStep:Boolean(data.contactExperiment||(data.neckExperiment&&phase?.substeps>1)),neckIntermediate:Boolean(data.neckExperiment&&phase?.intermediate)},surface);solverMS+=hair.solveMS;
 });
 previousContacts=nextContacts;
 if(data.diagnostic!==diagnostic){hair.setDiagnostic(data.diagnostic);diagnostic=data.diagnostic;}
 const g=scene.children[0].geometry,count=g.attributes.position.array.length;let buffers=pool.pop();if(!buffers||buffers.positions.length!==count)buffers={positions:new Float32Array(count),normals:new Float32Array(count)};
 // Transfer deformation in attachment space. Main-thread root motion must
 // never wait for a physics result or interpolate old world-space anchors.
 const inverse=anchor.matrixWorld.clone().invert(),normalMatrix=new T.Matrix3().getNormalMatrix(inverse),point=new T.Vector3();
 for(let i=0;i<count;i+=3){point.fromArray(g.attributes.position.array,i).applyMatrix4(inverse).toArray(buffers.positions,i);point.fromArray(g.attributes.normal.array,i).applyMatrix3(normalMatrix).normalize().toArray(buffers.normals,i);}
 const indices=sentMode!==diagnostic?g.index.array.slice():null;sentMode=diagnostic;self.postMessage({type:'frame',solverState:data.captureState?hair.snapshot():null,poseTime:data.poseTime,...buffers,anchor:anchor.matrixWorld.toArray(),attachment:g.attributes.miraAttachment.array.slice(),edgeInfo:indices?g.attributes.miraEdgeInfo.array.slice():null,edge:indices?g.attributes.miraEdge.array.slice():null,underside:indices?g.attributes.miraUnderside.array.slice():null,indices,diagnostic,revision,motion,profile,solverMS,totalMS:performance.now()-started},[buffers.positions.buffer,buffers.normals.buffer,...(indices?[indices.buffer]:[])]);
 }catch(error){self.postMessage({type:'error',message:error.stack||String(error)});}};
