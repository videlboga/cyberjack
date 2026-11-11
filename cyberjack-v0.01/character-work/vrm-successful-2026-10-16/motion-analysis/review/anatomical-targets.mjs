import{Vector3}from'three';
import{ANATOMICAL_TARGETS}from'./anatomical-target-data.mjs';
export{ANATOMICAL_TARGETS};
export const SPATIAL_TARGETS=ANATOMICAL_TARGETS.filter(d=>!['non-spatial','internal-unavailable'].includes(d.status));
export const anatomicalFeature=(side,id)=>side+'HandAt_'+id+'Distance';
export const ANATOMICAL_FEATURE_SCALES=Object.fromEntries(SPATIAL_TARGETS.flatMap(d=>['left','right'].map(side=>[anatomicalFeature(side,d.id),.1])));
export function decodeAnatomicalFeature(feature){const m=/^(left|right)HandAt_(.+)Distance$/.exec(feature),definition=m&&ANATOMICAL_TARGETS.find(d=>d.id===m[2]);return definition?{side:m[1],id:m[2],definition}:null;}
export function anatomicalPoint(t,pose,id,side='right'){
 const d=ANATOMICAL_TARGETS.find(d=>d.id===id);if(!d||!SPATIAL_TARGETS.includes(d))return null;
 if(id==='inner_thighs'){const s=side==='left'?'L':'R',other=s==='L'?'R':'L';return t.point(pose,'thigh00_'+s).lerp(t.point(pose,'leg01_'+s),.30).lerp(t.point(pose,'thigh00_'+other).lerp(t.point(pose,'leg01_'+other),.30),.18);}
 let landmark=d.proxy;if(!landmark&&d.markers?.length){let index=side==='left'?0:1;if(d.pairPolicy==='opposite')index=1-index;landmark=d.markers[Math.min(index,d.markers.length-1)];}
 if(!landmark)return null;landmark=t.anatomicalLandmarks?.[landmark.name]||landmark;const i=t.m.index.get(landmark.anchor);if(i===undefined)return null;
 return new Vector3().setFromMatrixPosition(pose[i].world).add(new Vector3(...landmark.offset).multiplyScalar(t.height).applyQuaternion(pose[i].worldQ));
}
export function compileHandTargets(targets=[]){return targets.map(target=>{
 const d=ANATOMICAL_TARGETS.find(d=>d.id===target.pointId);if(!d)throw Error('Неизвестная анатомическая точка: '+target.pointId);
 if(!SPATIAL_TARGETS.includes(d))throw Error(d.label+': '+(d.status==='non-spatial'?'не является пространственной точкой тела':'внутренняя цель без поверхностного маркера; прямое касание не поддерживается'));
 if(!['left','right'].includes(target.hand))throw Error('Для анатомической цели укажи одну руку: left или right');
 return {feature:anatomicalFeature(target.hand,d.id),min:0,max:.06};
 });}

export function normalizeAnatomicalFeature(feature){const legacy=/^(left|right)HandBetweenThighsDistance$/.exec(feature);if(legacy)return anatomicalFeature(legacy[1],'groin');if(Object.hasOwn(ANATOMICAL_FEATURE_SCALES,feature))return feature;for(const d of SPATIAL_TARGETS){const title=d.id.split('_').map(w=>w[0].toUpperCase()+w.slice(1)).join('');for(const side of ['left','right'])if(feature===side+'Hand'+title+'Distance')return anatomicalFeature(side,d.id);}return feature;}
