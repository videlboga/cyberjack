import {createMiraRibbonMaterial} from './mira-ribbon-material.js?v=2';
import {ribbonSurfaceCache,projectRibbonSurface,projectRibbonSurfaceEdge} from './ribbon-surface-contact.js?v=4';
import {prepareRibbonContacts,sweepRibbonPoint,ribbonSegmentContact} from './ribbon-body-contact.js?v=3';
import * as T from './vendor/three/three.module.js';
import {projectHairCollider} from './hair-capsule-collider.js?v=worker-3';
export function createRibbonTryOn(scene,options={}){const skin=.006;let colliders=[],floorY=0,ready=false,bodySurface=null,physics={stiffness:.35,damping:.35,motion:.85,wind:0};const base=new T.Vector3();
const N=options.sourceMesh?43:options.fringe?11:(options.rows??41),C=5,width=(options.width??.16);
// Each row has a rest spread; longitudinal guides retain their own arc lengths.
function spread(t){return .32+.68*Math.pow(Math.sin(Math.PI*(t*.94+.05)),.7)*(1-.48*Math.exp(-Math.pow((t-.64)/.09,2)));}
function xAt(r,c){return (c/(C-1)-.5)*width*spread(r/(N-1));}let ds=(options.length??1.15)/(N-1);const dw=width/(C-1),p=[],old=[],links=[];let time=0,running=true,acc=0;const rootRows=options.sourceMesh?24:options.fringe?5:8,transitionEnd=options.fringe?N:13,restLocal=[],targets=[],headMatrix=new T.Matrix4();
const pointContacts=Array.from({length:N*C},()=>ribbonSurfaceCache());let oriented=false;let activeLinks=[];const surfaceTriangles=[],centroid=new T.Vector3(),faceCorrection=new T.Vector3();const faceCorrections=Array.from({length:N*C},()=>new T.Vector3()),faceCounts=new Uint16Array(N*C);
function mobility(i){return Math.floor(i/C)<rootRows?0:1;}
const ui={move:{checked:false},curl:{value:options.curl??.2},twist:{value:.03},height:{value:1.85},bend:{value:.48}};
for(let i=0;i<N*C;i++){p.push(new T.Vector3());old.push(new T.Vector3());}
function link(a,b,length,stiff=1){links.push({a,b,length,stiff});}
function restTurn(t){const ramp=Math.max(0,(t-.25)/.75);return Number(ui.curl.value)*.65*ramp*ramp;}
function build(){links.length=0;for(let r=0;r<N;r++)for(let c=0;c<C;c++){const a=r*C+c;if(c&&true)link(a-1,a,width*spread(r/(N-1))/(C-1),options.fringe?.32:.7);if(r)link(a-C,a,Math.hypot(Math.max(ds*.35,ds-xAt(r,c)*restTurn(r/(N-1))),xAt(r,c)-xAt(r-1,c)));if(r&&c&&true){link(a-C-1,a,Math.hypot(ds,xAt(r,c)-xAt(r-1,c-1)),options.fringe?.12:.4);link(a-C,a-1,Math.hypot(ds,xAt(r,c-1)-xAt(r-1,c)),options.fringe?.12:.4);}if(c>1)link(a-2,a,width*spread(r/(N-1))*2/(C-1),.05);}}
build();const positions=new Float32Array(N*6*3),indices=[];
// Two surfaces share their inner edge until the split opens continuously.
for(let r=0;r<N-1;r++)for(let branch=0;branch<2;branch++)for(let cell=0;cell<2;cell++){const a=r*6+branch*3+cell;indices.push(a,a+6,a+1,a+1,a+6,a+7);}
const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.setAttribute('miraUnderside',new T.BufferAttribute(Float32Array.from({length:N*6},(_,i)=>T.MathUtils.smoothstep(Math.floor(i/6)/(N-1),options.fringe?.55:.18,options.fringe?.8:.27)),1));geometry.setIndex(indices);const material=new T.MeshStandardMaterial({color:options.color??0x302c3c,side:T.DoubleSide,roughness:.72});const ribbon=new T.Mesh(geometry,material);ribbon.frustumCulled=false;ribbon.userData.ribbonRole=options.sourceMesh?'fringe':Math.abs(options.angle??0)>1.6?'side':'back';scene.add(ribbon);
function reset(){time=0;acc=0;for(let r=0;r<N;r++)for(let c=0;c<C;c++){const q=p[r*C+c];q.set(xAt(r,c)+(Number(ui.height.value)<1.35?-.6:0),Number(ui.height.value)-r*ds,.08-.08*Math.sin(r/N*Math.PI));if(q.y<skin&&false){const arc=skin-q.y,rad=.28,phi=arc/rad,offset=xAt(r,c);q.x=rad*(1-Math.cos(phi))+offset*Math.cos(phi)+(Number(ui.height.value)<1.35?-.6:0);q.z=.08-.08*Math.sin(r/N*Math.PI)+rad*Math.sin(phi)-offset*Math.sin(phi);q.y=skin;}else if(q.y<skin){q.z+=skin-q.y;q.y=skin;}old[r*C+c].copy(q);}}
const delta=new T.Vector3(),before=new T.Vector3(),normal=new T.Vector3(),along=new T.Vector3(),across=new T.Vector3(),surface=new T.Vector3(),target=new T.Vector3(),curvature=new T.Vector3();
const incoming=new T.Vector3(),outgoing=new T.Vector3(),wanted=new T.Vector3();
function bend(){
 const curl=Number(ui.curl.value),twist=Number(ui.twist.value),strength=Number(ui.bend.value);
 for(let r=rootRows+1;r<N-1;r++){
  across.subVectors(p[r*C+C-1],p[r*C]).normalize();
  along.subVectors(p[r*C+2],p[(r-1)*C+2]).normalize();
  surface.crossVectors(across,along).normalize();
  const t=r/(N-1),ramp=Math.max(0,(t-.25)/.75);
  for(let c=0;c<C;c++){
   const a=p[(r-1)*C+c],b=p[r*C+c],d=p[(r+1)*C+c];
   incoming.subVectors(b,a);outgoing.subVectors(d,b);
   // Rest turning lives in the material frame, independent of scene orientation.
   const split=Math.max(0,(t-.75)/.25);const signed=restTurn(t)*(1+split*split*(c<2?.18:-.18));
   wanted.copy(incoming).applyAxisAngle(surface,signed).applyAxisAngle(along,twist*ramp*.01);
   const length=outgoing.length();wanted.normalize().multiplyScalar(length);
   curvature.copy(outgoing).sub(wanted).multiplyScalar(.12*strength);
   a.addScaledVector(curvature,-.5);b.add(curvature);d.addScaledVector(curvature,-.5);
  }
 }
}
function contact(i,exact=false){const q=p[i];before.copy(q);if(bodySurface){if(exact)projectRibbonSurface(q,old[i],bodySurface,pointContacts[i],.006);else{const cached=pointContacts[i];if(cached.triangle!==null&&cached.distance<.06){const tri=bodySurface.triangleAt(cached.triangle);tri.closestPointToPoint(q,cached.point);tri.getNormal(cached.normal);cached.distance=q.distanceTo(cached.point);const d=delta.subVectors(q,cached.point).dot(cached.normal);if(d<.0058&&cached.distance<.06){q.addScaledVector(cached.normal,.006-d);old[i].addScaledVector(cached.normal,.006-d);}}}}else for(const collider of colliders)projectHairCollider(q,collider,.009);normal.subVectors(q,before);if(normal.lengthSq()>1e-14){normal.normalize();delta.subVectors(q,old[i]);const vn=delta.dot(normal);if(vn<0)old[i].addScaledVector(normal,vn);}if(q.y<floorY)q.y=floorY;delta.subVectors(q,old[i]);if(q.y<=floorY+.001){old[i].y=q.y;old[i].x+=delta.x*.02;old[i].z+=delta.z*.02;}}

function step(h){time+=h;for(let i=rootRows*C;i<p.length;i++){before.copy(p[i]);p[i].addScaledVector(delta.subVectors(p[i],old[i]),.96+.04*(1-physics.damping));p[i].addScaledVector(delta.subVectors(targets[i],p[i]),options.fringe?.002+physics.stiffness*.008:.001+physics.stiffness*.003);p[i].x+=Math.sin(time*2.3+i*.07)*physics.wind*.3*h*h;p[i].y-=(options.fringe?1.2:9.81)*h*h;old[i].copy(before);if(!options.fringe&&!bodySurface&&sweepRibbonPoint(p[i],old[i],colliders,.009)){delta.subVectors(p[i],old[i]);old[i].copy(p[i]).addScaledVector(delta,-.3);}}for(let pass=0;pass<4;pass++){if(pass%4===0&&!options.fringe)bend();for(let i=0;i<transitionEnd*C;i++){const row=Math.floor(i/C);if(row<rootRows){p[i].copy(targets[i]);old[i].copy(targets[i]);}else{const f=(row-rootRows)/(transitionEnd-rootRows),weight=options.fringe?.008*(1-f)*(1-f):.45*(1-f)*(1-f);p[i].lerp(targets[i],weight);}}for(const l of activeLinks){delta.subVectors(p[l.b],p[l.a]);const d=delta.length();if(!d)continue;const wa=mobility(l.a),wb=mobility(l.b);if(!wa&&!wb)continue;delta.multiplyScalar((d-l.length)/d*l.stiff/(wa+wb));p[l.a].addScaledVector(delta,wa);p[l.b].addScaledVector(delta,-wb);}if(pass===3&&!options.fringe){
 if(bodySurface){for(const l of activeLinks)if((l.b-l.a<=C+1)&&Math.min(pointContacts[l.a].distance,pointContacts[l.b].distance)<l.length+.012&&(pointContacts[l.a].normal.dot(pointContacts[l.b].normal)<.995||Math.min(pointContacts[l.a].distance,pointContacts[l.b].distance)>.008))projectRibbonSurfaceEdge(p[l.a],p[l.b],old[l.a],old[l.b],bodySurface,l.contact,!mobility(l.a),!mobility(l.b),.006,Math.min(pointContacts[l.a].distance,pointContacts[l.b].distance)<.008);}
 else for(const l of activeLinks)if(l.b-l.a===C&&l.a%C%2===0)ribbonSegmentContact(p[l.a],p[l.b],colliders,!mobility(l.a),!mobility(l.b),.009);
 }if(pass===3&&bodySurface&&!options.fringe){faceCounts.fill(0);for(const correction of faceCorrections)correction.set(0,0,0);for(const face of surfaceTriangles){const [a,b,c]=face.ids;const range=Math.max(p[a].distanceTo(p[b]),p[a].distanceTo(p[c]),p[b].distanceTo(p[c]))+.006;if(Math.min(pointContacts[a].distance,pointContacts[b].distance,pointContacts[c].distance)>range)continue;centroid.copy(p[a]).add(p[b]).add(p[c]).multiplyScalar(1/3);if(bodySurface.nearestInto(centroid,face.cache,face.cache.triangle,range)&&face.cache.signedDistance<.006){faceCorrection.copy(face.cache.point).addScaledVector(face.cache.normal,.006).sub(centroid);for(const id of face.ids){faceCorrections[id].add(faceCorrection);faceCounts[id]++;}}}for(let i=rootRows*C;i<p.length;i++)if(faceCounts[i]){faceCorrections[i].multiplyScalar(1/faceCounts[i]);p[i].add(faceCorrections[i]);old[i].add(faceCorrections[i]);}}for(let i=rootRows*C;i<p.length;i++){if(options.fringe){delta.subVectors(p[i],targets[i]);const limit=.045*physics.motion*(Math.floor(i/C)-rootRows+1)/(N-rootRows);if(delta.length()>limit)p[i].copy(targets[i]).add(delta.setLength(limit));}else contact(i,pass===3||pointContacts[i].triangle===null);}}}
return {update(dt,head,body,contacts,anchor,shared){if(!head)return;head.updateWorldMatrix(true,false);const attachmentNow=anchor||head;attachmentNow.updateWorldMatrix(true,false);if(ready&&shared?.static&&headMatrix.equals(attachmentNow.matrixWorld))return;const box=shared?.box??new T.Box3().setFromObject(head,true),size=shared?.size??box.getSize(new T.Vector3());box.getCenter(base);const angle=options.angle??0;base.x+=Math.sin(angle)*size.x*.46;base.y+=size.y*(options.rootY??.3);base.z-=Math.cos(angle)*size.z*.47;physics=shared?.physics??physics;bodySurface=shared?.surfaceCollider??null;colliders=shared?.contacts??prepareRibbonContacts(contacts);floorY=shared?.floorY??new T.Box3().setFromObject(body).min.y+.006;if(!ready){
 const attachment=anchor||head;attachment.updateWorldMatrix(true,false);const inverse=attachment.matrixWorld.clone().invert(),center=box.getCenter(new T.Vector3()),angle=options.angle??0;
 for(let row=0;row<N;row++)for(let c=0;c<C;c++){
  const theta=(options.startTheta??.1)+Math.min(row,7)/7*(1.5-(options.startTheta??.1)),phi=angle+(c/(C-1)-.5)*(options.arcWidth??.78);
  const q=new T.Vector3(center.x+Math.sin(phi)*Math.sin(theta)*size.x*(options.scalpRadius??.59),center.y+Math.cos(theta)*size.y*.60,center.z-Math.cos(phi)*Math.sin(theta)*size.z*(options.scalpRadius??.59));
  if(row>7){const t=(row-7)/(N-8);q.y-=t*(options.length??1.12);q.z-=.04*Math.sin(t*Math.PI);}
  if(options.sourceMesh){
   const source=options.sourceMesh;source.updateWorldMatrix(true,false);
   const attr=source.geometry.attributes.position,rings=attr.count/13,t=Math.max(0,(row/(N-1)-.4)/.6);
   const sample=t*(rings-1),r0=Math.floor(sample),r1=Math.min(rings-1,r0+1),alpha=sample-r0;
   const edge=(column)=>new T.Vector3().fromBufferAttribute(attr,r0*13+column).lerp(new T.Vector3().fromBufferAttribute(attr,r1*13+column),alpha).applyMatrix4(source.matrixWorld);
   const left=edge(0),right=edge(6),mid=left.clone().lerp(right,.5),u=c/(C-1);
   q.copy(left).lerp(right,u);
   q.sub(mid).multiplyScalar(1.2-.55*t*t).add(mid);
   q.x+=.012*Math.sin(t*Math.PI*.85);q.y+=t*t*(.012+.008*Math.sin((options.bangIndex??0)*1.8));
   const progress=row/(N-1),count=options.bangCount??17;
   const crossSign=Math.sign(right.x-left.x)||1;
   const phi=4.73-((options.bangIndex??0)+.5)/count*3.18-(u-.5)*3.18/count*1.5*crossSign;
   const theta=progress*1.5;
   const shell=new T.Vector3(center.x+Math.sin(phi)*Math.sin(theta)*size.x*.59,center.y+Math.cos(theta)*size.y*.60,center.z-Math.cos(phi)*Math.sin(theta)*size.z*.59);
   const blend=T.MathUtils.smoothstep(progress,.42,1);
   q.copy(shell.lerp(q,blend));
  }

  if(q.y>center.y){
   const d=q.clone().sub(center),r=Math.sqrt((d.x/(size.x*.59))**2+(d.y/(size.y*.60))**2+(d.z/(size.z*.59))**2);
   const blend=T.MathUtils.smoothstep(q.y,center.y+size.y*.04,center.y+size.y*.20);
   if(r>1e-6&&r<1)q.copy(d.multiplyScalar(1/r).add(center));
  }
  if(options.lift){const lift=options.lift*Math.sin(Math.min(row,7)/7*Math.PI*.5)*(row>7?1-(row-7)/(N-8):1);q.y+=lift;}
  if(options.sourceMesh){const fade=1-T.MathUtils.smoothstep(row/(N-1),.55,.9);q.addScaledVector(q.clone().sub(center).normalize(),fade*(.002+.0004*Math.sin((options.bangIndex??0)*2.3)));}
  p[row*C+c].copy(q);old[row*C+c].copy(q);restLocal.push(q.clone().applyMatrix4(inverse));targets.push(q.clone());
 }
 // All constraints use the same continuous rest surface, including the curved scalp.
 for(const l of links){l.length=p[l.a].distanceTo(p[l.b]);if(mobility(l.a)||mobility(l.b)){l.contact={};activeLinks.push(l);}}if(!options.fringe)for(let r=rootRows;r<N-1;r++)for(let c=0;c<C-1;c++){const a=r*C+c;surfaceTriangles.push({ids:[a,a+C,a+1],cache:ribbonSurfaceCache()},{ids:[a+1,a+C,a+C+1],cache:ribbonSurfaceCache()});}ready=true;
 }
 const attachment=anchor||head;attachment.updateWorldMatrix(true,false);headMatrix.copy(attachment.matrixWorld);for(let i=0;i<targets.length;i++)targets[i].copy(restLocal[i]).applyMatrix4(headMatrix);
 if(shared?.static){for(let i=0;i<p.length;i++){p[i].copy(targets[i]);old[i].copy(targets[i]);}}else{acc=Math.min(acc+dt,.035);while(acc>=1/60){step(1/60);acc-=1/60;}}
for(let row=0;row<N;row++){
 const t=row/(N-1),f=Math.max(0,Math.min(1,(t-.65)/.35)),k=f*f*(3-2*f),gap=options.fringe?0:.7*k;
 const bounds=[0,.5-gap*.5,.5+gap*.5,1];
 for(let branch=0;branch<2;branch++){
 const lo=bounds[branch*2],hi=bounds[branch*2+1],mid=(lo+hi)*.5,taper=options.fringe?1:1-.98*k;
 for(let edge=0;edge<3;edge++){
 const u=mid+(edge-1)*(hi-lo)*.5*taper,q=u*(C-1),col=Math.min(C-2,Math.floor(q));
 before.copy(p[row*C+col]).lerp(p[row*C+col+1],q-col);before.toArray(positions,(row*6+branch*3+edge)*3);
 }
 }
}geometry.attributes.position.needsUpdate=true;geometry.computeVertexNormals();
// Establish exterior winding once, from the scalp-facing portion of the lock.
if(!oriented){const row=options.fringe?Math.min(16,N-2):5,index=row*6+1,point=new T.Vector3().fromBufferAttribute(geometry.attributes.position,index),radial=point.sub(box.getCenter(new T.Vector3())),n=new T.Vector3().fromBufferAttribute(geometry.attributes.normal,index);if(n.dot(radial)<0){const ix=geometry.index.array;for(let i=0;i<ix.length;i+=3)[ix[i+1],ix[i+2]]=[ix[i+2],ix[i+1]];geometry.index.needsUpdate=true;geometry.computeVertexNormals();}oriented=true;}},mesh:ribbon};}

export function createMiraRibbonHair(scene,{simulate=false,partition=null}={}){
 const locks=[],collector=new T.Group(),batchGeometry=new T.BufferGeometry(),batch=new T.Mesh(batchGeometry,createMiraRibbonMaterial());batch.frustumCulled=false;scene.add(batch);let batchParts=null;
 function syncBatch(reindex=false){
  if(!batchParts){let offset=0;batchParts=locks.map(lock=>{const part={lock,offset,version:-1};offset+=lock.mesh.geometry.attributes.position.count;return part;});batchGeometry.setAttribute('position',new T.BufferAttribute(new Float32Array(offset*3),3));batchGeometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(offset*3),3));const underside=new Float32Array(offset);for(const part of batchParts)underside.set(part.lock.mesh.geometry.attributes.miraUnderside.array,part.offset);batchGeometry.setAttribute('miraUnderside',new T.BufferAttribute(underside,1));reindex=true;}
  if(reindex){const indices=[];for(const {lock,offset} of batchParts)if(lock.mesh.visible)for(const index of lock.mesh.geometry.index.array)indices.push(index+offset);batchGeometry.setIndex(indices);}
  let changed=false;for(const part of batchParts){const g=part.lock.mesh.geometry;if(part.version===g.attributes.position.version)continue;batchGeometry.attributes.position.array.set(g.attributes.position.array,part.offset*3);batchGeometry.attributes.normal.array.set(g.attributes.normal.array,part.offset*3);part.version=g.attributes.position.version;changed=true;}
  if(changed){batchGeometry.attributes.position.needsUpdate=true;batchGeometry.attributes.normal.needsUpdate=true;}
 }

 let lockSerial=0;const addLock=options=>{const id=lockSerial++;if(!partition||id%partition.count===partition.index)locks.push(createRibbonTryOn(collector,options));};
 // Staggered roots cover the rear hemisphere without a separate scalp shell.
 for(let layer=0;layer<2;layer++){
  const count=layer?6:5;
  for(let i=0;i<count;i++){const angle=-1.56+i*3.12/(count-1)+(layer?.04:0);addLock({angle,arcWidth:.91,startTheta:layer?.4:0,scalpRadius:layer?.585:.59,length:(layer?1.0:1.12)+.045*Math.sin(i*2.3+layer),curl:.13+.035*Math.sin(i*1.8),color:0x302c3c});}
 }
 for(const side of [-1,1])addLock({angle:side*1.88,arcWidth:.6,startTheta:0,lift:.004,length:.95,curl:.1,color:0x302c3c});
 return {setDiagnostic(mode){for(const lock of locks)lock.mesh.visible=mode==='all'||lock.mesh.userData.ribbonRole===mode;syncBatch(true);},update(dt,head,body,contacts,anchor,frontMeshes,settings,surfaceCollider){if(!head||!frontMeshes?.length)return;if(frontMeshes?.length&&!this.fringeReady){for(const [bangIndex,sourceMesh] of [...frontMeshes].sort((a,b)=>new T.Box3().setFromObject(a).getCenter(new T.Vector3()).x-new T.Box3().setFromObject(b).getCenter(new T.Vector3()).x).entries())addLock({sourceMesh,bangIndex,bangCount:frontMeshes.length,fringe:true,curl:0,color:0x302c3c});this.fringeReady=true;batchParts=null;}if(!this.bounds){const box=new T.Box3().setFromObject(head,true);const source=head.geometry.attributes.position,vertices=new Float32Array(source.count*3),v=new T.Vector3();
 for(let i=0;i<source.count;i++){head.getVertexPosition(i,v).applyMatrix4(head.matrixWorld).toArray(vertices,i*3);}
 // Fit one smooth root envelope outside the current upper head. Per-vertex
 // ray projection reproduced the pointed skull as jagged ridges in each ribbon.
 const size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());let envelope=1;
 for(let i=0;i<source.count;i++){v.fromArray(vertices,i*3).sub(center);if(v.y<size.y*.04)continue;envelope=Math.max(envelope,Math.sqrt((v.x/(size.x*.59))**2+(v.y/(size.y*.60))**2+(v.z/(size.z*.59))**2));}
 size.multiplyScalar(envelope*1.035);
 this.bounds={box,size,floorY:new T.Box3().setFromObject(body).min.y+.006};}

 const enabled=settings?.enabled??simulate,started=performance.now();
 const shared={...this.bounds,floorY:0.006,static:!enabled,surfaceCollider:enabled?surfaceCollider:null,physics:settings??{stiffness:.35,damping:.35,motion:.85,wind:0},contacts:enabled?prepareRibbonContacts(contacts):[]};
 for(const lock of locks)lock.update(dt,head,body,contacts,anchor,shared);syncBatch();this.solveMS=performance.now()-started;}};
}
