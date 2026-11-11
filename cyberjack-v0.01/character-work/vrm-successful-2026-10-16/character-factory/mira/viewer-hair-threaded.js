import {HairPhysics} from './viewer-hair-physics.js?v=runtime92b';
// Same solver and 60 Hz fixed step, hosted off the UI thread. Only frame
// buffers and collision/input transforms cross the boundary.
export class ThreadedHairPhysics extends HairPhysics{
 constructor(){super();this.worker=null;this.members=[];this.generation=0;this.busy=false;this.dt=0;this.pendingReset=false;this.failed=false;this.frames=null;this.recycle=null;this.workerMS=0;this.backend='worker';}
 reset(){super.reset();this.generation++;this.frames=null;this.dt=0;this.pendingReset=true;}
 stopWorker(){this.worker?.terminate();this.worker=null;this.members=[];this.busy=false;this.frames=null;}
 update(dt,root){
  if(this.failed||this.surfaceCollider||typeof Worker!=='function'){if(this.worker){this.stopWorker();super.reset();}this.backend='CPU';return super.update(dt,root);}
  this.backend='worker';root.updateWorldMatrix(true,true);
  const members=Array.from(this.chains.values()).filter(c=>c.mesh.parent),changed=members.length!==this.members.length||members.some((c,i)=>c!==this.members[i]);
  if(!this.settings.enabled){if(!this.disabled){this.reset();this.disabled=true;}return;}
  if(this.disabled){this.disabled=false;this.pendingReset=true;}
  if(!members.length)return;
  if(!this.worker){
   try{this.worker=new Worker(new URL('./hair-physics-worker.js?v=runtime92c',import.meta.url),{type:'module'});
    this.worker.onmessage=({data})=>{this.busy=false;if(data.type==='error'){this.fail(data.message);return;}if(data.generation!==this.generation){this.recycle={positions:data.positions,normals:data.normals};return;}
     const now=performance.now();if(this.previous?.length!==data.positions.length){this.previous=new Float32Array(data.positions.length);this.previousNormals=new Float32Array(data.normals.length);}const previous=this.previous,normals=this.previousNormals;let offset=0;for(const c of this.members){previous.set(c.mesh.geometry.attributes.position.array,offset);normals.set(c.mesh.geometry.attributes.normal.array,offset);offset+=c.base.length;}
     if(this.frames)this.recycle={positions:this.frames.target,normals:this.frames.targetNormals};this.frames={previous,normals,target:data.positions,targetNormals:data.normals,age:0,interval:Math.max(1/120,Math.min(.05,(now-(this.receivedAt||now-1000/60))/1000))};this.receivedAt=now;this.workerMS=data.ms;};
    this.worker.onerror=event=>this.fail(event.message||'Не запущен worker волос');
   }catch(e){this.fail(e.message);return super.update(dt,root);}
  }
  if(changed){this.generation++;this.members=members;this.frames=null;this.recycle=null;this.pendingInit=true;this.pendingReset=true;}
  const started=performance.now(),f=this.frames;
  if(f&&f.age<f.interval){f.age+=dt;const t=Math.min(1,f.age/f.interval);let offset=0;for(const c of this.members){const p=c.mesh.geometry.attributes.position,n=c.mesh.geometry.attributes.normal;for(let i=0;i<p.array.length;i++){p.array[i]=f.previous[offset+i]+(f.target[offset+i]-f.previous[offset+i])*t;n.array[i]=f.normals[offset+i]+(f.targetNormals[offset+i]-f.normals[offset+i])*t;}p.needsUpdate=n.needsUpdate=true;offset+=p.array.length;}}
  this.metrics={renderMS:performance.now()-started,solveMS:0,chains:members.length,nodes:members.reduce((n,c)=>n+c.ids.length,0)};
  this.dt=Math.min(.1,this.dt+dt);if(this.busy)return;
  const transfer=[],message={type:'step',generation:this.generation,dt:this.dt,settings:{...this.settings},cohesion:this.cohesion||0,groundY:this.groundY,reset:this.pendingReset,colliders:this.colliders.map(s=>({...s,center:s.center?.toArray(),a:s.a?.toArray(),b:s.b?.toArray(),depthAxis:s.depthAxis?.toArray()})),matrices:new Float64Array(members.length*16)};
  for(let i=0;i<members.length;i++)message.matrices.set(members[i].mesh.matrixWorld.elements,i*16);transfer.push(message.matrices.buffer);
  if(this.pendingInit){const count=members.reduce((n,c)=>n+c.base.length,0),positions=new Float32Array(count),normals=new Float32Array(count);let offset=0;message.init=members.map(c=>{positions.set(c.base,offset);normals.set(c.normals,offset);const meta={offset,count:c.base.length,rigid:c.rigid,profile:c.profile,motionGroup:c.motionGroup};offset+=c.base.length;return meta;});message.positions=positions;message.normals=normals;transfer.push(positions.buffer,normals.buffer);this.pendingInit=false;}
  if(this.recycle){message.recycle=this.recycle;transfer.push(this.recycle.positions.buffer,this.recycle.normals.buffer);this.recycle=null;}
  this.pendingReset=false;this.dt=0;this.busy=true;this.worker.postMessage(message,transfer);
 }
 fail(message){this.lastError=message;console.error('Физика волос перешла на CPU:',message);this.stopWorker();this.failed=true;super.reset();}
}
