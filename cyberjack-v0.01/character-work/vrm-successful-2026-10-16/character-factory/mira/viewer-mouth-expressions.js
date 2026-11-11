import {VRMExpressionMorphTargetBind} from './vendor/three-vrm/three-vrm.module.js';
const clamp=v=>Math.max(0,Math.min(1,v));
// The same native-morph recipe is used by the live VRM manager and VRM export.
export function mouthExpressionBinds(name,binds,face,dictionary){
 const names=Object.fromEntries(Object.entries(dictionary).map(([n,i])=>[i,n]));
 const strength=face.mouthExpressionStrength==null?1:clamp(face.mouthExpressionStrength),open=clamp((name==='happy'?face.smileOpen:name==='surprised'?face.surpriseOpen:0)||0);
 return binds.flatMap(bind=>{
  const target=names[bind.index];if(!target?.startsWith('Mouth ')||!['happy','angry','sad','relaxed','surprised'].includes(name))return [{...bind}];
  const weight=bind.weight*strength;
  if(open&&target.endsWith(', Closed')){
   const index=dictionary[target.slice(0,-8)];if(index!=null)return [{...bind,weight:weight*(1-open)},{...bind,index,weight:weight*open}];
  }
  return [{...bind,weight}];
 });
}
export function applyMouthExpressions(head){
 const key=JSON.stringify([head.settings.face.smileOpen||0,head.settings.face.surpriseOpen||0,head.settings.face.mouthExpressionStrength??1]);if(key===head.mouthExpressionKey)return;
 head.mouthExpressionKey=key;head.mouthExpressionOriginals??=new Map();
 for(const expression of head.vrm.expressionManager.expressions){
  if(!head.mouthExpressionOriginals.has(expression))head.mouthExpressionOriginals.set(expression,[...expression.binds]);
  const originals=head.mouthExpressionOriginals.get(expression),morph=originals.filter(b=>b.primitives&&Number.isInteger(b.index));
  for(const b of [...expression.binds]){b.clearAppliedWeight();expression.deleteBind(b);}
  for(const b of originals.filter(b=>!morph.includes(b)))expression.addBind(b);
  for(const b of mouthExpressionBinds(expression.expressionName,morph,head.settings.face,head.socketMesh.morphTargetDictionary))expression.addBind(new VRMExpressionMorphTargetBind(b));
 }
}
