const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
export function derivePresence(c={}){
 const n=(k,f)=>Number.isFinite(Number(c[k]))?Number(c[k]):f;
 const tension=clamp(n('tension',0)/100),reserve=clamp(n('capacity',50)/Math.max(1,n('baselineCapacity',50))),fatigue=1-reserve;
 return {tension,fatigue,affinity:clamp(n('attitude',50)/100),breaths:clamp(n('breathingRate',12),6,40),mode:fatigue>.55?'tired':tension>.55?'alert':'relaxed'};
}
export const idleClips={relaxed:'Stand_00_00',alert:'Stand_01_00',tired:'Idle_00_00'};
export function createPresence(getVrm){
 let target=derivePresence(),current={...target},phase=0,lastFace=-1,lastBrow=-1;const scales=new Map();
 return {set(value){const next=derivePresence(value);if(target.mode==='tired'&&next.fatigue>.45)next.mode='tired';else if(target.mode==='alert'&&next.tension>.45&&next.mode!=='tired')next.mode='alert';target=next},get state(){return {...current,targetMode:target.mode}},get idle(){return idleClips[target.mode]},update(dt,face,transient,reduced,holdUpperBody=false){
  const vrm=getVrm();if(!vrm)return;for(const k of ['tension','fatigue','affinity','breaths'])current[k]+=(target[k]-current[k])*(1-Math.exp(-dt/2));current.mode=target.mode;phase+=dt*current.breaths/60*Math.PI*2;
  const chest=vrm.humanoid.getRawBoneNode('chest');if(chest){if(!scales.has(chest))scales.set(chest,chest.scale.clone());chest.scale.copy(scales.get(chest));if(!reduced){const inhale=Math.sin(phase)*(.0025+.003*current.tension);chest.scale.x*=1+inhale;chest.scale.z*=1+inhale*1.7;chest.rotateX(.025*current.fatigue)}}
  if(!reduced&&!transient&&!holdUpperBody){const head=vrm.humanoid.getRawBoneNode('head');head?.rotateX(current.fatigue*.10);head?.rotateY((1-current.affinity)*.10+Math.sin(phase*.21)*.018*(1-current.tension));for(const side of ['left','right'])vrm.humanoid.getRawBoneNode(side+'Shoulder')?.rotateZ((side==='left'?1:-1)*current.tension*.035)}
  // Facial values share the original controller, including blink and morph deduplication.
  const eyes=1-current.fatigue*.24,brow=.45+current.tension*.45;if(!transient&&(Math.abs(eyes-lastFace)>.01||Math.abs(brow-lastBrow)>.01)){face?.set({eyesOpen:eyes,browStrength:brow});lastFace=eyes;lastBrow=brow}if(transient){lastFace=-1;lastBrow=-1}
 }};
}
