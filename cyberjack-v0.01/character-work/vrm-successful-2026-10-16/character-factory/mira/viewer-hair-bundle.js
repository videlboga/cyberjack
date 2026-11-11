import {extendTailToScalp} from './viewer-continuous-hair.js?v=18';
import {MovingHairContact,copyHairCollider} from './moving-hair-contact.js?v=2';
import {auditRibbonBody} from './bundle-contact-audit.js?v=runtime92';
import {BundleCenterline} from './hair-bundle-centerline.js?v=3';
import {buildGatheredHeadHair} from './viewer-head-hair.js?v=iona17c';
import * as T from 'three';
import {HairBundleRig} from './hair-bundle-rig.js?v=long-frame-56';
import {projectHairCollider,prepareHairCollider} from './viewer-hair-physics.js?v=short-caps-22';
export class AttachedHairBundle {
 constructor(scene,{bodyMesh=null}={}){
 const rig=this.rig=new HairBundleRig({width:.07,pinnedRows:1,rootWidth:.3});
rig.dampContacts=true;rig.contactVelocity=true;rig.segmentContacts=true;rig.limitSectionTurn=true;
// Keep the section ladder flexible without letting it fold like loose cloth.
this.setStructure=value=>{
 this.structure=value;
 for(const c of rig.links){const rows=Math.abs(Math.floor(c.a/3)-Math.floor(c.b/3));
  if(rows===2)c.stiffness=.002+.448*value;
  else if(rows===1&&c.a%3!==c.b%3)c.stiffness=.01+.29*value;
 }
};
this.setStructure(1);
this.debug={contacts:true,bend:true,links:true,segments:true,volume:false,swept:false,view:false};
this.colliderView=new T.Group();scene.add(this.colliderView);
this.colliderMaterial=new T.LineBasicMaterial({color:0xffaa22,transparent:true,opacity:.65,depthTest:false});
this.colliderGeometry=new T.EdgesGeometry(new T.SphereGeometry(1,12,8));
if(typeof document!=='undefined'){
 const panel=document.createElement('div');panel.style.cssText='position:absolute;left:12px;top:48px;z-index:5;background:#181d26dd;padding:8px;color:#bdcce0;font:12px sans-serif;border-radius:5px';
 this.panel=panel;panel.textContent='Диагностика пучка · ';
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Данные воспроизведения';this.trace=document.createElement('pre');this.trace.id='bundle-repro';this.trace.style.cssText='max-width:320px;max-height:120px;overflow:auto;white-space:pre-wrap';details.append(summary,this.trace);panel.append(details);
 for(const [key,label] of [['contacts','Контакты'],['links','Связи'],['bend','Изгиб корня'],['segments','Отрезки'],['volume','Объём'],['swept','Между кадрами'],['view','Коллайдеры']]){
  const wrap=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.checked=this.debug[key];input.setAttribute('aria-label','Пучок: '+label);
  input.addEventListener('change',()=>{this.debug[key]=input.checked;if(key!=='view')this.initial=false;});wrap.append(input,document.createTextNode(label+' '));panel.append(wrap);
 }
 const structureLabel=document.createElement('label'),structure=document.createElement('input'),structureValue=document.createElement('output');
 structure.style.cssText='width:150px;display:inline-block;vertical-align:middle';structure.type='range';structure.min='0';structure.max='1';structure.step='.05';structure.value=String(this.structure);structure.setAttribute('aria-label','Пучок: Жёсткость формы');
 structureValue.textContent=this.structure.toFixed(2);structure.oninput=()=>{this.setStructure(Number(structure.value));structureValue.textContent=this.structure.toFixed(2);};
 structureLabel.append(document.createTextNode('Жёсткость формы '),structure,structureValue);panel.append(structureLabel);
 const reset=document.createElement('button');reset.textContent='Сброс пучка';reset.onclick=()=>{this.initial=false;};panel.append(reset);
 if(bodyMesh){
  const audit=document.createElement('button'),result=document.createElement('output');audit.textContent='Проверить ленты ↔ тело';result.style.cssText='display:block;max-width:390px;margin-top:5px';
  audit.onclick=()=>{audit.disabled=true;result.textContent='Проверка снимка…';setTimeout(()=>{try{const start=performance.now(),report=auditRibbonBody(this.rig,this.mesh.geometry,bodyMesh);result.textContent=`Снимок: пересечений рёбер ${report.crossings}, точек внутри ${report.inside}, глубина ${(report.maxDepth*1000).toFixed(1)} мм. Без головы, стыка шеи и корней. ${(performance.now()-start).toFixed(0)} мс`;report.rigMatrix=this.matrix.toArray();result.dataset.report=JSON.stringify(report);
 if(!this.auditLines){this.auditLines=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xff3030,depthTest:false}));this.auditLines.renderOrder=100;scene.add(this.auditLines);}
 this.auditLines.geometry.setAttribute('position',new T.Float32BufferAttribute(report.crossingEdges,3));this.auditLines.geometry.computeBoundingSphere();this.auditLines.visible=true;this.auditRoot=new T.Vector3().setFromMatrixPosition(this.matrix);}catch(error){result.textContent=error.message;}finally{audit.disabled=false;}},20);};panel.append(audit,result);
 }
 const fold=document.createElement('details'),foldTitle=document.createElement('summary');foldTitle.textContent='Диагностика волос';fold.append(foldTitle);while(panel.firstChild)fold.append(panel.firstChild);panel.append(fold);
 document.querySelector('#stage')?.append(panel);
}
// Guide +Z points toward the face after Y-up -> anatomical Z-up conversion.
// Mirror the bundle depth so the free length initially leaves the nape backwards.
for(const p of rig.rest)p.z=-p.z;
this.dynamics=new URLSearchParams(globalThis.location?.hash?.slice(1)||'').get('bundle_centerline')==='1'?new BundleCenterline(rig):rig;
// All eighteen disconnected ribbons share one buffer and one draw call.
const geometry=new T.BufferGeometry(),positions=new Float32Array(18*81*2*3),colors=new Float32Array(positions.length),ix=[],bindings=[],rows=[],blends=[],skinWeights=[],derivatives=[];
for(let j=0;j<18;j++){
 const seed=Math.sin(j*2.399),angle=j*Math.PI*2/18+.055*seed,width=.19*(.66+(j%5)*.14),end=.90+.10*(.5+.5*Math.sin(j*1.79)),color=new T.Color().setScalar(.94+(j%4)*.02);
 for(let i=0;i<80;i++){const a=j*162+i*2;ix.push(a,a+1,a+2,a+1,a+3,a+2);}
 for(let i=0;i<=80;i++){
  const u=i/80,t=u<=rig.gather?u:rig.gather+(u-rig.gather)*(end-rig.gather)/(1-rig.gather),tail=Math.max(0,(u-rig.gather)/(1-rig.gather)),taper=Math.min(1,(1-u)*(9+(j%4)*2));
  const free=Math.sin(Math.PI*t)**2*(1-Math.exp(-(((t-rig.gather)/.07)**2))),radial=1+.55*Math.exp(-t/.07)+free*(.065*seed+.055*Math.sin(t*12+j*1.8))+.13*tail*Math.sin(j*2.2),sweep=.065*Math.sin(t*6+j)*free+.22*tail*tail*seed;
  for(let k=0;k<2;k++){
   const f=t*(rig.rows-1),row=Math.min(rig.rows-2,Math.floor(f)),blend=f-row,a=angle+sweep+(k?1:-1)*width*taper,c=Math.cos(a)*radial,d=Math.sin(a)*radial/Math.sqrt(3),weights=[(1-c)/3+c,(1-c)/3+d,(1-c)/3-d];
   bindings.push({row:row*3,blend,weights});rows.push(row*3);blends.push(blend);skinWeights.push(...weights);const dc=-Math.sin(a)*radial,dd=Math.cos(a)*radial/Math.sqrt(3);derivatives.push(2*dc/3,-dc/3+dd,-dc/3-dd);color.toArray(colors,(j*162+i*2+k)*3);
  }
 }
}
this.surfaceBindings=bindings.filter((_,index)=>Math.floor(index/2)%81%4===0);
geometry.setAttribute('position',new T.BufferAttribute(positions,3).setUsage(T.DynamicDrawUsage));geometry.setAttribute('color',new T.BufferAttribute(colors,3));geometry.setIndex(ix);
geometry.setAttribute('normal',new T.BufferAttribute(new Float32Array(positions.length),3));
geometry.setAttribute('bundleRow',new T.Float32BufferAttribute(rows,1));geometry.setAttribute('bundleBlend',new T.Float32BufferAttribute(blends,1));geometry.setAttribute('bundleWeights',new T.Float32BufferAttribute(skinWeights,3));geometry.setAttribute('bundleDerivative',new T.Float32BufferAttribute(derivatives,3));
// Only 75 control points cross the CPU/GPU boundary. Ribbon vertices and
// analytical normals are evaluated by the vertex shader from fixed bindings.
const material=new T.MeshStandardMaterial({color:'#82708e',roughness:.72,vertexColors:true,side:T.DoubleSide});
material.onBeforeCompile=shader=>{
 shader.uniforms.bundleNodes={value:rig.points};
 shader.vertexShader=`uniform vec3 bundleNodes[75];
 attribute float bundleRow;attribute float bundleBlend;attribute vec3 bundleWeights;attribute vec3 bundleDerivative;
 vec3 bundleSample(int r,vec3 w){r=clamp(r,0,72);return bundleNodes[r]*w.x+bundleNodes[r+1]*w.y+bundleNodes[r+2]*w.z;}
 vec3 bundleCurve(int r,vec3 w,float t){vec3 p0=bundleSample(r-3,w),p1=bundleSample(r,w),p2=bundleSample(r+3,w),p3=bundleSample(r+6,w);return .5*((2.0*p1)+(-p0+p2)*t+(2.0*p0-5.0*p1+4.0*p2-p3)*t*t+(-p0+3.0*p1-3.0*p2+p3)*t*t*t);}
 vec3 bundleTangent(int r,vec3 w,float t){vec3 p0=bundleSample(r-3,w),p1=bundleSample(r,w),p2=bundleSample(r+3,w),p3=bundleSample(r+6,w);return .5*((-p0+p2)+2.0*(2.0*p0-5.0*p1+4.0*p2-p3)*t+3.0*(-p0+3.0*p1-3.0*p2+p3)*t*t);}
 `+shader.vertexShader;
 shader.vertexShader=shader.vertexShader.replace('#include <beginnormal_vertex>',`
 int br=int(bundleRow);
 vec3 across=bundleCurve(br,bundleDerivative,bundleBlend);
 vec3 objectNormal=normalize(cross(across,bundleTangent(br,bundleWeights,bundleBlend))+vec3(0.00000001));
 `).replace('#include <begin_vertex>','vec3 transformed=bundleCurve(br,bundleWeights,bundleBlend);');
};
material.customProgramCacheKey=()=> 'bundle-gpu-cubic-v2';
const hair=new T.Mesh(geometry,material);hair.frustumCulled=false;scene.add(hair);

this.contactPlanes=rig.points.map(()=>[]);this.sweeper=new MovingHairContact();this.oldColliders=new Map();
this.mesh=hair;this.matrix=new T.Matrix4();this.initial=false;this.acc=0;this.lastRoot=new T.Vector3();
}
update(dt,anchor,colliders=[],headMesh=null){
 anchor.updateWorldMatrix(true,false);const local=new T.Matrix4().makeTranslation(0,.32,.02).multiply(new T.Matrix4().makeRotationX(Math.PI/2)).scale(new T.Vector3(.72,.72,.72));this.matrix.multiplyMatrices(anchor.matrixWorld,local);
 if(headMesh&&this.seatedMesh!==headMesh){
  this.headHair?.mesh.removeFromParent();this.headHair?.mesh.geometry.dispose();
  this.headHair=buildGatheredHeadHair(anchor,headMesh,this.rig.points);extendTailToScalp(this.mesh,this.headHair.backStrips,anchor,this.headHair.fitEdge,this.headHair.center);this.seatedMesh=headMesh;this.initial=false;
 }
 this.headHair?.update?.(dt,colliders);
 if(this.headHair){
  const target=anchor.localToWorld(this.headHair.seat.clone());
  const source=this.rig.rest.slice(0,3).reduce((v,p)=>v.add(p),new T.Vector3()).multiplyScalar(1/3).applyMatrix4(this.matrix);
  const delta=target.sub(source);this.matrix.elements[12]+=delta.x;this.matrix.elements[13]+=delta.y;this.matrix.elements[14]+=delta.z;
 }
 this.rig.segmentContacts=this.debug.segments;this.rig.volumeContacts=this.debug.volume;this.rig.limitRootBend=this.debug.bend;this.rig.solveLinks=this.debug.links;
 const root=new T.Vector3().setFromMatrixPosition(this.matrix);if(this.auditLines&&this.auditRoot&&root.distanceTo(this.auditRoot)>.002)this.auditLines.visible=false;if(!this.initial||root.distanceTo(this.lastRoot)>.20){this.dynamics.reset(this.matrix);this.initial=true;this.acc=0;this.captureTrace=true;this.oldColliders.clear();}this.restTime=root.distanceTo(this.lastRoot)<.001?(this.restTime||0)+Math.min(dt,.05):0;this.dynamics.hangingRest=this.restTime>.5;this.lastRoot.copy(root);
 colliders=colliders.filter(c=>c.enforceRest);this.currentColliders=colliders;for(const c of colliders)prepareHairCollider(c);
 // Diagnostic endpoint ellipsoids show the real radius and depth of each proxy.
 while(this.colliderView.children.length<colliders.length*2)this.colliderView.add(new T.LineSegments(this.colliderGeometry,this.colliderMaterial));
 this.colliderView.visible=this.debug.view;
 if(this.debug.view)this.colliderView.children.forEach((mesh,i)=>{
  const c=colliders[Math.floor(i/2)];mesh.visible=Boolean(c);if(!c)return;
  mesh.matrixAutoUpdate=false;
  const axis=c.b.clone().sub(c.a).normalize(),depth=c.depthAxis.clone().normalize(),basis=[];
  for(let j=0;j<3;j++){const v=new T.Vector3().setComponent(j,1);v.addScaledVector(depth,v.dot(depth)*((c.depthScale||1)-1));v.addScaledVector(axis,v.dot(axis)*((c.capScale||1)-1));basis.push(v.multiplyScalar(c.radius));}
  mesh.matrix.makeBasis(...basis).setPosition(i%2?c.b:c.a);mesh.matrixWorldNeedsUpdate=true;
 });
 if(this.captureTrace&&this.trace){this.trace.textContent=JSON.stringify({matrix:this.matrix.toArray(),colliders:colliders.map(c=>({a:c.a.toArray(),b:c.b.toArray(),radius:c.radius,depthScale:c.depthScale,capScale:c.capScale,depthAxis:c.depthAxis.toArray(),bodyPart:c.bodyPart}))});this.captureTrace=false;}
 const contactMotion=new T.Vector3(),axis=new T.Vector3(),offset=new T.Vector3();
 const collide=(p,r)=>{contactMotion.set(0,0,0);let hits=0;
  for(let pass=0;pass<3;pass++){let changed=false;for(const c of colliders){if(!projectHairCollider(p,c,r))continue;changed=true;
   const old=this.oldColliders.get(c.bodyPart);if(old){axis.subVectors(c.b,c.a);const u=T.MathUtils.clamp(offset.subVectors(p,c.a).dot(axis)/(axis.lengthSq()||1),0,1);
    contactMotion.x+=(c.a.x-old.a.x)*(1-u)+(c.b.x-old.b.x)*u;
    contactMotion.y+=(c.a.y-old.a.y)*(1-u)+(c.b.y-old.b.y)*u;
    contactMotion.z+=(c.a.z-old.a.z)*(1-u)+(c.b.z-old.b.z)*u;hits++;
   }
  }if(!changed)break;}if(hits)contactMotion.multiplyScalar(1/hits);
 };collide.motion=contactMotion;


 this.acc+=Math.min(dt,.033);let steps=0;while(this.acc>=1/60&&steps++<2){const planes=this.rig.contactPlanes=this.contactPlanes;for(const list of planes)list.length=0;
 this.rig.sweepCollider=this.debug.contacts&&this.debug.swept?((from,p,i)=>{
  const x=p.x,y=p.y,z=p.z;
  for(const c of colliders){const old=this.oldColliders.get(c.bodyPart);if(old&&this.sweeper.project(from,p,old,c,.012))planes[i].push({point:this.sweeper.contactPoint.clone(),normal:this.sweeper.normal.clone()});}
  this.rig.previous[i].x+=p.x-x;this.rig.previous[i].y+=p.y-y;this.rig.previous[i].z+=p.z-z;
 }):null;
 const started=performance.now();this.dynamics.step(1/60,this.matrix,this.debug.contacts?collide:null);
 for(const c of colliders){let old=this.oldColliders.get(c.bodyPart);if(!old){old=copyHairCollider(c);this.oldColliders.set(c.bodyPart,old);}else{old.a.copy(c.a);old.b.copy(c.b);old.depthAxis.copy(c.depthAxis);old.radius=c.radius;old.depthScale=c.depthScale;old.capScale=c.capScale;}}
 this.lastSolveMS=performance.now()-started;this.acc-=1/60;}
 this.headHair?.updateTail?.(this.rig.rest,this.matrix);
}
}
