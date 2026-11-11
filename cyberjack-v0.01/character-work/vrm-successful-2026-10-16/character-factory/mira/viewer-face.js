import {smoothCheekMesh} from './viewer-cheek-smooth.js?v=kai57';
import {softenMouthTransition} from './viewer-mouth-transition.js';
import {applySkinIrregularity} from './viewer-skin-irregularity.js?v=soft-2';
import {refreshFaceNormals} from './viewer-face-normals.js?v=kai50d';
import {thinStretchedMouth} from './viewer-mouth-stretch.js';
import {transportOffsets,safeTransportScale} from './viewer-morph-transport.js';
import {nativeMouthOffset} from './viewer-mouth-native.js?v=target-7';
import {refreshMouthNormals} from './viewer-mouth-normals.js?v=target-1';
import {boundMouth,mapBoundMouthFrame} from './viewer-mouth-bound.js?v=lip-rolls-2';
import {mouthCurveControls,curveMouth} from './viewer-mouth-curves.js?v=lip-rolls-2';
import {sculptMouth} from './viewer-mouth.js?v=lip-rolls-2';
import * as THREE from 'three';
export const faceControls=[['Мимика рта','smileOpen','Приоткрывание улыбки'],['Мимика рта','surpriseOpen','Открывание рта при удивлении'],['Мимика рта','mouthExpressionStrength','Выразительность рта'],['Целевая форма','preserveTargetMouth','Сохранять принятую форму губ'],['Целевая форма','mouthTarget','Контур Кейт'],['Материал кожи','mouthTransitionSmooth','Сглаживание кожи у губ'],['Материал кожи','faceSurfaceShading','Рельеф кожи лица'],['Материал кожи','noseSurfaceShading','Рельеф света на носу'],['Материал кожи','skinIrregularity','Мягкая неровность кожи'],...mouthCurveControls,['Валики губ','mouthNative','Сохранять родную основу VRM'],['Валики губ','lipFullnessWidth','Ширина полной зоны'],['Изгиб губ','lipSeamCurve','Изгиб смыкания'],['Валики губ','lipSeal','Сведение губ'],['Валики губ','mouthNativeGain','Усиление относительной формы'],
 ['Валики губ','lipRoll_upperHeight','Высота верхнего валика'],
 ['Валики губ','lipRoll_lowerHeight','Высота нижнего валика'],
 ['Валики губ','lipRoll_upperDepth','Глубина верхнего валика'],
 ['Валики губ','lipRoll_lowerDepth','Глубина нижнего валика'],
 ['Валики губ','lipRoll_roundness','Округлость сечения'],
 ['Валики губ','lipRoll_seamDepth','Углубление смыкания'],
 ['Изгиб губ','lipPeakSpacing','Расстояние между пиками'],
 ['Изгиб губ','lipPeakHeight','Высота пиков верхней губы'],
 ['Изгиб губ','lipNotch','Впадина верхней губы'],
 ['Изгиб губ','lipCornerCurve','Изгиб к уголкам'],
 ['Старый профиль губ','lipLowerHeight','Высота нижней губы'],
 ['Изгиб губ','lipLowerArc','Ширина дуги нижней губы'],
 ['Старый профиль губ','lipProjection','Выступ губ в профиль'],
 ['Старый профиль губ','lipRoundness','Округлость объёма губ'],
 ['Старый профиль губ','lipVerticalVolume','Вертикальная полнота губ'],
 ['Контур лица','width','Ширина лица'],['Контур лица','length','Высота лица'],['Контур лица','cheeks','Скулы'],['Контур лица','cheekVolume','Объём щёк'],['Контур лица','cheekPlane','Плоскость щёк под скулами'],['Контур лица','cheekPlaneSoftness','Мягкость плоскости щёк'],['Контур лица','jaw','Ширина челюсти'],['Контур лица','jawSoftness','Скругление углов челюсти'],['Контур лица','cheekSmooth','Сглаживание поверхности щёк'],['Контур лица','chinSurfaceSmooth','Сглаживание поверхности подбородка'],['Контур лица','midfaceLift','Высота средней части лица'],['Контур лица','chinWidth','Ширина подбородка'],['Контур лица','chinLength','Длина подбородка'],['Контур лица','chinRound','Округлость подбородка'],
 ['Глаза и брови','eyeSize','Размер глаз'],['Глаза и брови','irisSize','Размер радужки'],['Глаза и брови','eyeWidth','Ширина глаз'],['Глаза и брови','eyeOpening','Раскрытие глаз'],['Глаза и брови','eyeSpacing','Расстояние между глазами'],['Глаза и брови','eyeHeight','Положение глаз по высоте'],['Глаза и брови','ocularHeight','Высота глазниц'],['Глаза и брови','eyeTilt','Наклон глаз'],['Глаза и брови','browHeight','Высота бровей'],
 ['Форма глаз','innerEyeCorner','Внутренние уголки глаз'],['Форма глаз','outerEyeCorner','Внешние уголки глаз'],['Форма глаз','upperLid','Изгиб верхнего века'],['Форма глаз','lowerLid','Изгиб нижнего века'],['Форма бровей','browArch','Изгиб бровей'],['Форма бровей','browPlacement','Вертикальный сдвиг бровей'],['Форма бровей','browMotion','Сохранение движения бровей'],['Форма бровей','browTilt','Наклон бровей'],['Форма бровей','browSpacing','Расстояние между бровями'],
 ['Нос','noseWidth','Ширина носа'],['Нос','noseLength','Длина носа'],['Нос','noseDepth','Выступ носа'],['Нос','noseBridge','Рельеф переносицы'],['Нос','noseTip','Объём кончика носа'],
 ['Старый профиль губ','mouthSculpt','Новая основа губ'],['Рот','mouthWidth','Ширина рта'],['Рот','mouthSpan','Ширина губ и полости рта'],['Рот','mouthHeight','Положение рта'],['Старый профиль губ','lipVolume','Объём губ'],['Старый профиль губ','mouthDepth','Выступ рта'],['Старый профиль губ','upperLip','Полнота верхней губы'],['Старый профиль губ','lowerLip','Полнота нижней губы'],['Старый профиль губ','cupidBow','Изгиб верхней губы'],['Старый профиль губ','mouthCorners','Положение уголков рта']
];
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const bell=(x,c,r)=>Math.exp(-(((x-c)/r)**2)*2);
// Shift the nose/mouth region as one identity edit; protect the eyes and jaw edge.
export function midfaceLiftDelta([x,y,z],amount=0,ocularHeight=0){
 const radius=.026+.025*(1-smooth(1.450,1.474,y));
 return .005*(1+Math.max(-1,Math.min(0,ocularHeight||0)))*Math.max(-1,Math.min(1,amount||0))*smooth(1.416,1.428,y)*(1-smooth(1.466,1.484,y))*(1-smooth(radius*.70,radius,Math.abs(x)))*smooth(.025,.050,z);
}
// All parts and every expression endpoint use the same continuous rest-space map.
// The aperture and the scalp stay fixed; the broad masks avoid isolated bulges.
export function warpFace(point,values){
 const [x,y,z]=point,v=k=>Number(values[k]||0),front=smooth(-.005,.045,z),socket=smooth(1.435,1.457,y)+(1-smooth(1.435,1.457,y))*smooth(.019,.040,z)*smooth(1.408,1.431,y),cap=1-smooth(1.55,1.60,y),mask=socket*cap;
 let X=x,Y=y,Z=z;
 X+=x*.18*v('width')*mask;Y+=(y-1.505)*.13*v('length')*mask;
 X+=x*(.18*v('cheeks')*bell(y,1.475,.035)+.22*v('jaw')*bell(y,1.441,.025)+.24*v('chinWidth')*bell(y,1.425,.019))*front*socket;
 Y-=.008*v('chinLength')*bell(y,1.427,.023)*front*socket;

 const eye=bell(Math.abs(x),.041,.033)*bell(y,1.493,.035)*front*socket;
 X+=((x-Math.sign(x)*.041)*(.20*v('eyeSize')+.16*v('eyeWidth'))+Math.sign(x)*.006*v('eyeSpacing'))*eye;
 Y+=((y-1.493)*(.20*v('eyeSize')+.20*v('eyeOpening'))+.006*v('eyeHeight')+Math.sign(x)*(x-Math.sign(x)*.041)*.18*v('eyeTilt'))*eye;
 Y+=.006*v('browHeight')*bell(y,1.526,.013)*bell(Math.abs(x),.042,.038)*front;
 const nose=bell(x,0,.020)*bell(y,1.480,.035)*front*socket;
 X+=x*.28*v('noseWidth')*nose;Y-=(1-smooth(1.485,1.510,y))*.007*v('noseLength')*nose;Z+=.008*v('noseDepth')*nose;
 Z+=.005*v('cheekVolume')*bell(Math.abs(x),.045,.035)*bell(y,1.464,.027)*front*socket;
 Z+=.003*v('noseTip')*bell(x,0,.014)*bell(y,1.465,.012)*front*socket;
 const mouth=bell(x,0,.031)*bell(y,1.441,.019)*front*socket;
 X+=x*.25*v('mouthWidth')*mouth;Y+=.005*v('mouthHeight')*mouth+(y-1.441)*.22*v('lipVolume')*mouth;Z+=(.004*v('lipVolume')+.006*v('mouthDepth'))*mouth;
 return [X,Y,Z];
}
// A regular cubic B-spline control volume. Vertex and expression endpoints
// share the same field, including disconnected eyelids, teeth and eyeballs.
// Positive partition-of-unity weights avoid the overshoot of cubic interpolants.
export class FaceCage{
 constructor(values){
  this.values=values;this.min=[-.13,1.37,-.11];this.max=[.13,1.65,.12];this.size=[19,29,19];this.nodes=new Float64Array(this.size.reduce((a,b)=>a*b,1)*3);
  for(let z=0;z<this.size[2];z++)for(let y=0;y<this.size[1];y++)for(let x=0;x<this.size[0];x++){
   const ids=[x,y,z],p=ids.map((v,k)=>this.min[k]+v/(this.size[k]-1)*(this.max[k]-this.min[k])),q=warpFace(p,values),i=this.index(x,y,z);for(let k=0;k<3;k++)this.nodes[i+k]=q[k]-p[k];
  }
 }
 index(x,y,z){return ((z*this.size[1]+y)*this.size[0]+x)*3;}
 sample(p){
  const taps=p.map((v,k)=>{const t=(v-this.min[k])/(this.max[k]-this.min[k])*(this.size[k]-1),i=Math.floor(t),u=t-i;return {ids:[i-1,i,i+1,i+2].map(j=>THREE.MathUtils.clamp(j,0,this.size[k]-1)),w:[(1-u)**3/6,(3*u**3-6*u*u+4)/6,(-3*u**3+3*u*u+3*u+1)/6,u**3/6]};}),d=[0,0,0];
  for(let z=0;z<4;z++)for(let y=0;y<4;y++)for(let x=0;x<4;x++){const i=this.index(taps[0].ids[x],taps[1].ids[y],taps[2].ids[z]),w=taps[0].w[x]*taps[1].w[y]*taps[2].w[z];for(let k=0;k<3;k++)d[k]+=this.nodes[i+k]*w;}
  // Keep the entire socket exactly fixed, including at interpolated grid cells.
  const pin=smooth(1.435,1.450,p[1])+(1-smooth(1.435,1.450,p[1]))*smooth(.019,.035,p[2]);
  const [x,y,z]=p,lipFront=smooth(.055,.063,z),lipWidth=bell(x,0,.020),upperBand=bell(y,1.4367,.0035),lowerBand=bell(y,1.4338,.0038),upperAmount=this.values.upperLip||0,lowerAmount=this.values.lowerLip||0;
  // The actual neutral mouth seam is at 1.4355, below the old mask centre.
  // Broad, bounded offsets keep the opening and expression endpoints continuous.
  d[1]+=.0012*upperAmount*upperBand*lipWidth*lipFront-.0012*lowerAmount*lowerBand*lipWidth*lipFront;
  d[2]+=(.0022*upperAmount*upperBand+.0025*lowerAmount*lowerBand)*lipWidth*lipFront;
  const bow=bell(Math.abs(x),.004,.003)-.45*bell(x,0,.0025);
  d[1]+=.0007*(this.values.cupidBow||0)*bow*upperBand*lipFront;
  d[1]+=.0015*(this.values.mouthCorners||0)*bell(Math.abs(x),.014,.008)*bell(y,1.4355,.007)*lipFront;
  d[1]+=.006*(this.values.chinRound||0)*bell(x,0,.033)*bell(y,1.416,.023)*smooth(.025,.040,z);
  // Round only the mandibular corner, blending the cheek into the diagonal
  // jaw edge. The central chin, mouth and upper cheek remain unchanged.
  const jawCorner=bell(y,1.441,.015)*smooth(.038,.056,Math.abs(x))*smooth(-.035,-.005,z);
  d[0]-=Math.sign(x)*.0035*Math.max(0,this.values.jawSoftness||0)*jawCorner;
  // Translate the orbital volume as a unit, tapering above the brow and
  // below the lower lid. Keep the nose axis, mouth and jaw in place.
  const orbital=smooth(.004,.015,Math.abs(x))*smooth(1.445,1.470,y)*(1-smooth(1.5075,1.5425,y))*(1-smooth(.085,.12,Math.abs(x)))*smooth(-.005,.020,z);
  d[1]+=.014*(this.values.ocularHeight||0)*orbital;
  // Local proportional controls share one map for skin, lips, teeth and all
  // expression endpoints, while leaving skull/neck and eye volume unchanged.
  d[2]+=.006*(this.values.noseBridge||0)*bell(x,0,.013)*bell(y,1.486+.014*(this.values.ocularHeight||0),.032)*smooth(.035,.055,z);
  // Local buccal contour: keep the malar ridge, eye aperture, central mouth
  // and chin; flatten the convex cheek below the cheekbone as one smooth field.
  const buccal=(this.values.cheekPlane||0)*smooth(.022,.038,Math.abs(x))*bell(y,1.448,.026)*smooth(-.025,.012,z);
  d[0]-=Math.sign(x)*.006*buccal*smooth(.028,.055,Math.abs(x));
  d[2]-=.0045*buccal*(1-.7*Math.max(0,Math.min(1,this.values.cheekPlaneSoftness||0)))*bell(Math.abs(x),.043,.032);
  d[0]+=x*.45*(this.values.mouthSpan||0)*bell(y,1.436,.017)*(1-smooth(.028,.060,Math.abs(x)))*smooth(.035,.055,z);
  const eyeFront=smooth(.025,.055,z),ax=Math.abs(x),eyeBand=bell(y,1.496,.031)*eyeFront;
  d[1]+=.002*(this.values.innerEyeCorner||0)*bell(ax,.014,.013)*eyeBand+.002*(this.values.outerEyeCorner||0)*bell(ax,.068,.017)*eyeBand;
  d[1]+=.0018*(this.values.upperLid||0)*bell(ax,.041,.030)*bell(y,1.513,.012)*eyeFront-.0018*(this.values.lowerLid||0)*bell(ax,.041,.030)*bell(y,1.477,.012)*eyeFront;
  const brow=bell(y,1.529,.012)*eyeFront;
  d[1]+=.0025*(this.values.browArch||0)*bell(ax,.043,.024)*brow+.08*(this.values.browTilt||0)*(ax-.043)*bell(ax,.043,.043)*brow;
  d[0]+=.0025*(this.values.browSpacing||0)*x/Math.sqrt(x*x+.0001)*bell(ax,.043,.036)*brow;
  return p.map((v,k)=>v+d[k]*pin+(k===1?midfaceLiftDelta(p,this.values.midfaceLift,this.values.ocularHeight):0));
 }
}
export const facePresets={
 narrow:{width:-.20,jaw:-.35,chinWidth:-.20,eyeSize:.12,noseDepth:-.25,mouthWidth:-.15,outerEyeCorner:.2,browArch:-.1},
 sculpted:{width:.10,cheeks:.40,jaw:.25,chinLength:.20,eyeOpening:-.35,eyeTilt:.20,noseDepth:.45,noseLength:.20,mouthWidth:.20,lipVolume:.25,innerEyeCorner:.15,outerEyeCorner:.5,upperLid:-.4,lowerLid:-.1,browArch:-.15,browTilt:-.2},
 round:{width:.30,length:-.15,cheeks:.20,jaw:.10,chinLength:-.35,eyeSize:.30,eyeOpening:.15,noseLength:-.25,lipVolume:.35,outerEyeCorner:-.15,upperLid:.2,browArch:.3}
};
export class FaceEditor{
 constructor(head){this.head=head;this.cache=new Map();for(const mesh of head.meshes){const g=mesh.geometry;this.cache.set(mesh,{position:g.attributes.position.array.slice(),normal:g.attributes.normal?.array.slice(),morphs:(g.morphAttributes.position||[]).map(a=>a.array.slice()),normalMorphs:(g.morphAttributes.normal||[]).map(a=>a.array.slice()),matrix:head.restMatrices.get(mesh).clone(),inverse:head.restMatrices.get(mesh).clone().invert()});}this.eyeBindings=[];for(const mesh of head.meshes)if(mesh.skeleton)for(const [name,eye] of Object.entries(head.eyeRest)){const i=mesh.skeleton.bones.indexOf(eye.node);if(i>=0&&!this.eyeBindings.some(b=>b.skeleton===mesh.skeleton&&b.i===i))this.eyeBindings.push({skeleton:mesh.skeleton,i,name,inverse:mesh.skeleton.boneInverses[i].clone()});}this.key='';}
 apply(values){
  const key=JSON.stringify([this.head.neckRatio??1,Boolean(this.head.previewNeutralOnly),Boolean(this.head.previewNapeSmooth),Object.hasOwn(values,'mouthTarget'),...faceControls.filter(([group])=>group!=='Мимика рта').map(([,k])=>values[k]||0)]);if(key===this.key)return;this.key=key;this.cage=new FaceCage(values);const mouthCage=values.preserveTargetMouth?new FaceCage(Object.fromEntries(faceControls.filter(([group])=>!['Контур лица','Глаза и брови','Форма глаз','Форма бровей','Нос'].includes(group)).map(([,k])=>[k,values[k]||0]))):null;const active=Boolean(this.head.previewNapeSmooth)||Math.abs((this.head.neckRatio??1)-1)>1e-8||faceControls.some(([group,k])=>group!=='Мимика рта'&&values[k]);
  const p=new THREE.Vector3(),q=new THREE.Vector3();
  const collarCache=this.cache.get(this.head.socketMesh),collar=this.head.manifest.socketRing.map(i=>new THREE.Vector3().fromArray(collarCache.position,i*3).applyMatrix4(collarCache.matrix));
  const collarCenter=collar.reduce((c,p)=>c.add(p),new THREE.Vector3()).multiplyScalar(1/collar.length);

  for(const [mesh,c] of this.cache){const g=mesh.geometry,a=g.attributes.position.array,nativeOffsets=new Map();
   const iris=this.head.meshes.indexOf(mesh)===7||this.head.meshes.indexOf(mesh)===8;const centre=new THREE.Box3().setFromBufferAttribute(new THREE.BufferAttribute(c.position,3)).getCenter(new THREE.Vector3());
   const transform=(arr,rest=arr,posedOffset=null)=>{p.fromArray(arr);if(iris){const scale=1+.25*(values.irisSize||0);p.x=centre.x+(p.x-centre.x)*scale;p.y=centre.y+(p.y-centre.y)*scale;}p.applyMatrix4(c.matrix);if(values.mouthNative&&mesh===this.head.socketMesh){const r=new THREE.Vector3().fromArray(rest).applyMatrix4(c.matrix);const key=r.toArray().join(',');let offset=nativeOffsets.get(key);if(!offset){offset=nativeMouthOffset(r.toArray(),values);nativeOffsets.set(key,offset);}p.add(new THREE.Vector3().fromArray(posedOffset||offset));}else if(mesh===this.head.socketMesh&&(values.mouthSculpt||mouthCurveControls.some(([,k])=>values[k]))){const r=new THREE.Vector3().fromArray(rest).applyMatrix4(c.matrix),mapped=values.mouthCurve_binding?boundMouth(r.toArray(),values):curveMouth(sculptMouth(r.toArray(),values.mouthSculpt),values);p.add(new THREE.Vector3().fromArray(mapped).sub(r));}const mapped=!values.mouthNative&&values.mouthCurve_binding&&mesh===this.head.socketMesh?mapBoundMouthFrame(p.toArray(),new THREE.Vector3().fromArray(rest).applyMatrix4(c.matrix).toArray(),values,this.cage):this.cage.sample(p.toArray());
   // Carry this translation with donor rest vertices rather than compressing
   // an opening mouth through the static vertical mask.
   if(values.midfaceLift){const r=new THREE.Vector3().fromArray(rest).applyMatrix4(c.matrix);mapped[1]+=midfaceLiftDelta(r.toArray(),values.midfaceLift,values.ocularHeight)-midfaceLiftDelta(p.toArray(),values.midfaceLift,values.ocularHeight);}
   if(mesh===this.head.meshes[1]){if(values.browMotion){const r=new THREE.Vector3().fromArray(rest).applyMatrix4(c.matrix),base=this.cage.sample(r.toArray()),follow=Math.max(0,Math.min(1,values.browMotion));mapped[1]+=(base[1]+p.y-r.y-mapped[1])*follow;}mapped[1]+=.012*(values.browPlacement||0);mapped[2]+=.002*Math.max(0,-(values.browPlacement||0));}
   if(mouthCage){const r=new THREE.Vector3().fromArray(rest).applyMatrix4(c.matrix),w=(1-smooth(.026,.075,Math.abs(r.x)))*(1-smooth(1.4525,1.480,r.y))*smooth(-.040,.005,r.z),fixed=mouthCage.sample(p.toArray());for(let k=0;k<3;k++)mapped[k]+=(fixed[k]-mapped[k])*w;}
   // Fit the rear ridge to a smooth rest-space envelope before applying
   // neck width. Both the aperture and the correction then scale together.
   // Keep the attachment vertices fixed; reuse this map for morph endpoints.
   if(this.head.previewNapeSmooth){
    const x=mapped[0],y=mapped[1],z=mapped[2];
    const target=-.057+.012*smooth(1.435,1.500,y),excess=Math.max(0,target-z);
    const weight=smooth(1.438,1.450,y)*(1-smooth(1.490,1.515,y))*(1-smooth(.045,.080,Math.abs(x)));
    mapped[2]+=excess*excess/(excess+.003)*weight;
   }
   // Narrow the skull aperture itself and fade through the underside of the
   // jaw. The visible chin and face remain outside this short collar field.
   const collarPoint=new THREE.Vector3().fromArray(rest).applyMatrix4(c.matrix),collarDistance=Math.sqrt(Math.min(...collar.map(v=>v.distanceToSquared(collarPoint)))),collarWeight=1-smooth(.006,.032,collarDistance),factor=1+((this.head.neckRatio??1)-1)*collarWeight;
   mapped[0]=collarCenter.x+(mapped[0]-collarCenter.x)*factor;
   mapped[2]=collarCenter.z+(mapped[2]-collarCenter.z)*factor;
   q.fromArray(mapped).applyMatrix4(c.inverse);return q.toArray();};
   for(let i=0;i<a.length;i+=3)a.set(active?transform(c.position.subarray(i,i+3)):c.position.subarray(i,i+3),i);
   let nativeLocal=null,nativeClosedLocal=null,nativeIndex=null;if(values.mouthNative&&mesh===this.head.socketMesh){nativeLocal=new Float64Array(a.length);nativeClosedLocal=new Float64Array(a.length);const inverseLinear=new THREE.Matrix3().setFromMatrix4(c.inverse);for(let i=0;i<a.length;i+=3){const r=new THREE.Vector3().fromArray(c.position,i).applyMatrix4(c.matrix),offset=values.lipSeal?nativeMouthOffset(r.toArray(),{...values,lipSeal:0}):(nativeOffsets.get(r.toArray().join(','))||[0,0,0]);nativeLocal.set(new THREE.Vector3().fromArray(offset).applyMatrix3(inverseLinear).toArray(),i);nativeClosedLocal.set(new THREE.Vector3().fromArray(nativeOffsets.get(r.toArray().join(','))||[0,0,0]).applyMatrix3(inverseLinear).toArray(),i);}}
   if(nativeLocal){nativeIndex=[];const ix=g.index.array;for(let j=0;j<ix.length;j+=3)if([ix[j],ix[j+1],ix[j+2]].some(i=>nativeLocal[i*3]||nativeLocal[i*3+1]||nativeLocal[i*3+2]))nativeIndex.push(ix[j],ix[j+1],ix[j+2]);}
   for(let t=0;t<c.morphs.length;t++){if(this.head.previewMorphIndices&&!this.head.previewMorphIndices.get(mesh)?.has(t)){g.morphAttributes.position[t].array.set(c.morphs[t]);g.morphAttributes.position[t].needsUpdate=true;continue;}const mouthMoves=nativeIndex?.some(i=>c.morphs[t][i*3]||c.morphs[t][i*3+1]||c.morphs[t][i*3+2]);const transported=nativeLocal&&!this.head.previewNeutralOnly?transportOffsets(c.position,c.morphs[t],nativeIndex,mouthMoves?nativeLocal:nativeClosedLocal):null;if(transported){if(values.mouthTarget&&mouthMoves)thinStretchedMouth(c.position,c.morphs[t],nativeIndex,transported);const scale=safeTransportScale(c.position,c.morphs[t],nativeIndex,transported);if(scale<1)for(let j=0;j<transported.length;j++)transported[j]*=scale;}const linear=new THREE.Matrix3().setFromMatrix4(c.matrix);const target=g.morphAttributes.position[t],src=c.morphs[t];for(let i=0;i<a.length;i+=3){if(this.head.previewNeutralOnly||!active||(!src[i]&&!src[i+1]&&!src[i+2]&&(!transported||(!transported[i]&&!transported[i+1]&&!transported[i+2]&&!nativeClosedLocal[i]&&!nativeClosedLocal[i+1]&&!nativeClosedLocal[i+2])))){target.array.set(src.subarray(i,i+3),i);continue;}const endpoint=transform([c.position[i]+src[i],c.position[i+1]+src[i+1],c.position[i+2]+src[i+2]],c.position.subarray(i,i+3),transported?new THREE.Vector3().fromArray(transported,i).applyMatrix3(linear).toArray():null);for(let k=0;k<3;k++)target.array[i+k]=endpoint[k]-a[i+k];}target.needsUpdate=true;}
   g.attributes.position.needsUpdate=true;
   // Preserve artist normals through the local inverse-transpose Jacobian.
   if(c.normal){const n=new THREE.Vector3(),J=new THREE.Matrix3(),epsilon=1e-5,jacobians=[];for(let i=0;i<a.length;i+=3){if(!active){g.attributes.normal.array.set(c.normal.subarray(i,i+3),i);continue;}const base=c.position.subarray(i,i+3),cols=[];for(let k=0;k<3;k++){const plus=Array.from(base),minus=Array.from(base);plus[k]+=epsilon;minus[k]-=epsilon;const u=transform(plus),v=transform(minus);cols.push(u.map((x,j)=>(x-v[j])/(2*epsilon)));}J.set(cols[0][0],cols[1][0],cols[2][0],cols[0][1],cols[1][1],cols[2][1],cols[0][2],cols[1][2],cols[2][2]).invert().transpose();jacobians[i/3]=J.clone();n.fromArray(c.normal,i).applyMatrix3(J).normalize();g.attributes.normal.array.set(n.toArray(),i);}g.attributes.normal.needsUpdate=true;
    for(let t=0;t<c.normalMorphs.length;t++){if(this.head.previewMorphIndices&&!this.head.previewMorphIndices.get(mesh)?.has(t)){g.morphAttributes.normal[t].array.set(c.normalMorphs[t]);g.morphAttributes.normal[t].needsUpdate=true;continue;}const attr=g.morphAttributes.normal[t],src=c.normalMorphs[t];for(let i=0;i<a.length;i+=3){if(this.head.previewNeutralOnly||!active||(!src[i]&&!src[i+1]&&!src[i+2])){attr.array.set(src.subarray(i,i+3),i);continue;}n.set(c.normal[i]+src[i],c.normal[i+1]+src[i+1],c.normal[i+2]+src[i+2]).applyMatrix3(jacobians[i/3]).normalize();for(let k=0;k<3;k++)attr.array[i+k]=n.getComponent(k)-g.attributes.normal.array[i+k];}attr.needsUpdate=true;}
   }
   if(mesh===this.head.socketMesh&&(values.mouthTarget||(!values.mouthNative&&values.mouthCurve_binding))){c.targetMouth=Boolean(values.mouthTarget);c.previewNeutralOnly=Boolean(this.head.previewNeutralOnly);c.selectedNormalMorphs=this.head.previewMorphIndices?.get(mesh);refreshMouthNormals(mesh,c,THREE);}
   if(mesh===this.head.socketMesh&&(values.cheekSmooth||values.chinSurfaceSmooth)){c.previewNeutralOnly=Boolean(this.head.previewNeutralOnly);c.selectedNormalMorphs=this.head.previewMorphIndices?.get(mesh);smoothCheekMesh(mesh,c,THREE,values.cheekSmooth,values.chinSurfaceSmooth);}
   if(mesh===this.head.socketMesh&&g.attributes.normal){c.surfaceNormalBase=g.attributes.normal.array.slice();c.surfaceNormalMorphBase=(g.morphAttributes.normal||[]).map(a=>a.array.slice());}
   if(mesh===this.head.socketMesh&&(values.faceSurfaceShading||values.noseSurfaceShading)){c.previewNeutralOnly=Boolean(this.head.previewNeutralOnly);c.selectedNormalMorphs=this.head.previewMorphIndices?.get(mesh);refreshFaceNormals(mesh,c,THREE,values.faceSurfaceShading,values.noseSurfaceShading);}
   if(mesh===this.head.socketMesh&&values.skinIrregularity){c.previewNeutralOnly=Boolean(this.head.previewNeutralOnly);c.selectedNormalMorphs=this.head.previewMorphIndices?.get(mesh);applySkinIrregularity(mesh,c,THREE,values.skinIrregularity);}
   if(mesh===this.head.socketMesh&&values.mouthTransitionSmooth){c.previewNeutralOnly=Boolean(this.head.previewNeutralOnly);c.selectedNormalMorphs=this.head.previewMorphIndices?.get(mesh);softenMouthTransition(mesh,c,THREE,values.mouthTransitionSmooth);}
   g.boundingBox=null;g.computeBoundingSphere();
   // This Three.js version caches morphs in a texture and does not inspect
   // BufferAttribute.version. Disposal invalidates that texture on shape edits.
   g.dispose();
  }
  for(const [name,eye] of Object.entries(this.head.eyeRest)){eye.node.position.fromArray(this.eyePoint(name)).applyMatrix4(eye.parentInverse);eye.node.updateMatrix();}
  for(const b of this.eyeBindings){const before=this.head.sourceEyes[b.name],after=this.eyePoint(b.name);b.skeleton.boneInverses[b.i].copy(b.inverse).multiply(new THREE.Matrix4().makeTranslation(before[0]-after[0],before[1]-after[1],before[2]-after[2]));}
  if(this.head.socket)this.head.socket.originalHeadNormals=this.head.socketMesh.geometry.attributes.normal.array.slice();
 }
 // Lighting-only face controls reuse the accepted geometry and expression
 // endpoints; no temporary neutral pose or position-morph rebuild is needed.
 updateSurfaceShading(values){
  const mesh=this.head.socketMesh,c=this.cache.get(mesh);if(!c?.surfaceNormalBase||this.head.previewNeutralOnly)return false;
  const g=mesh.geometry;g.attributes.normal.array.set(c.surfaceNormalBase);
  for(let t=0;t<c.surfaceNormalMorphBase.length;t++){g.morphAttributes.normal[t].array.set(c.surfaceNormalMorphBase[t]);g.morphAttributes.normal[t].needsUpdate=true;}
  c.previewNeutralOnly=false;c.selectedNormalMorphs=this.head.previewMorphIndices?.get(mesh);
  if(values.faceSurfaceShading||values.noseSurfaceShading)refreshFaceNormals(mesh,c,THREE,values.faceSurfaceShading,values.noseSurfaceShading);
  if(values.skinIrregularity)applySkinIrregularity(mesh,c,THREE,values.skinIrregularity);
  if(values.mouthTransitionSmooth)softenMouthTransition(mesh,c,THREE,values.mouthTransitionSmooth);
  g.attributes.normal.needsUpdate=true;g.dispose();this.key='';
  if(this.head.socket)this.head.socket.originalHeadNormals=g.attributes.normal.array.slice();
  return true;
 }
 eyePoint(name){return this.cage?this.cage.sample(this.head.sourceEyes[name]):this.head.sourceEyes[name].slice();}
}
