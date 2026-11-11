import * as T from './vendor/three/three.module.js';
// Advance one coherent body/attachment trajectory, not the final collider pose
// for several old simulation steps. Buffers are retained between messages.
export function createRibbonMotionStep(){
 let previousBody=null,workBody=null,previousAnchor=null;
 const aPos=new T.Vector3(),bPos=new T.Vector3(),aScale=new T.Vector3(),bScale=new T.Vector3(),aRot=new T.Quaternion(),bRot=new T.Quaternion(),rot=new T.Quaternion(),pos=new T.Vector3(),scale=new T.Vector3(),matrix=new T.Matrix4(),target=new T.Matrix4();
 return ({body,indices,anchor,dt,reset=false,maxSubsteps=1},apply)=>{
  target.fromArray(anchor);target.decompose(bPos,bRot,bScale);
  const discontinuity=reset||dt>.25||!previousBody||previousBody.length!==body.length;
  if(discontinuity){previousBody=body.slice();workBody=new Float32Array(body.length);previousAnchor=target.clone();}
  previousAnchor.decompose(aPos,aRot,aScale);
  let displacement=0;for(let i=0;i<body.length;i+=3)displacement=Math.max(displacement,Math.hypot(body[i]-previousBody[i],body[i+1]-previousBody[i+1],body[i+2]-previousBody[i+2]));
  const duration=Math.max(0,Math.min(1/30,dt));
  const steps=discontinuity?1:Math.min(maxSubsteps,Math.max(1,Math.ceil(displacement/.03),Math.ceil(aRot.angleTo(bRot)/.2)));
  for(let step=1;step<=steps;step++){
   const t=step/steps;for(let i=0;i<body.length;i++)workBody[i]=previousBody[i]+(body[i]-previousBody[i])*t;
   pos.copy(aPos).lerp(bPos,t);scale.copy(aScale).lerp(bScale,t);rot.copy(aRot).slerp(bRot,t);matrix.compose(pos,rot,scale);
   apply(workBody,indices,matrix,duration/steps,discontinuity,{intermediate:step<steps,substeps:steps});
  }
  previousBody.set(body);previousAnchor.copy(target);
  return {substeps:steps,bodyDisplacement:displacement,reset:discontinuity};
 };
}
