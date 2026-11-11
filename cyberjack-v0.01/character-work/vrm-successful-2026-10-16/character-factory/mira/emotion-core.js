// Portable semantic animation. No Three.js, DOM, model indices or face shape data.
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export const channels=Object.freeze([
 ...['soft','relaxed','serious','smug','thoughtful','shy','bored','sad','cry','angry','disgust','worried','fear','wide','strained'].map(n=>'eye.'+n),
 ...['soft','serious','smug','question','bored','worried','angry','raised'].map(n=>'brow.'+n),
 ...['smile','firm','smug','smallOpen','flat','sad','angry','disgust','tense','round','gasp','open'].map(n=>'mouth.'+n),
 'iris.contract','gaze.converge','eye.balance','brow.balance','mouth.balance','mouth.tongueOut','lid.close','gaze.x','gaze.y','effect.blush','effect.tears','effect.sweat','effect.saliva']);
const channelSet=new Set(channels);
const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
export function validateLibrary(data){
 if(!data||data.format!=='cyberjack-emotion-library'||data.version!==1||!Array.isArray(data.clips)||!data.clips.length||data.clips.length>256)throw Error('Нужна библиотека cyberjack-emotion-library версии 1');
 const ids=new Set();
 for(const c of data.clips){
  if(!c||typeof c.id!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(c.id)||ids.has(c.id))throw Error('Некорректный или повторный id клипа');ids.add(c.id);
  if(typeof c.label!=='string'||c.label.length>160||!finite(c.duration,.1,120)||!finite(c.transition,0,5)||typeof c.loop!=='boolean'||typeof c.blink!=='boolean')throw Error('Некорректные параметры клипа '+c.id);
  if(c.reference!=null&&(typeof c.reference!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(c.reference)))throw Error('Некорректный id референса');
  if(!c.tracks||typeof c.tracks!=='object'||Array.isArray(c.tracks))throw Error('Нет дорожек '+c.id);
  const variants=c.variants||{};if(typeof variants!=='object'||Array.isArray(variants)||Object.keys(variants).length>64)throw Error('Некорректные варианты');
  for(const [id,v]of Object.entries(variants))if(!/^[a-z][a-z0-9_]{0,63}$/.test(id)||!v?.tracks||typeof v.tracks!=='object'||Array.isArray(v.tracks))throw Error('Некорректный вариант '+id);
  for(const tracks of [c.tracks,...Object.values(variants).map(v=>v.tracks)])for(const [channel,keys] of Object.entries(tracks)){
   if(!channelSet.has(channel)||!Array.isArray(keys)||keys.length<2||keys.length>2000)throw Error('Неизвестный канал или некорректные ключи: '+channel);
   let previous=-1;for(const key of keys){if(!Array.isArray(key)||key.length!==2||!finite(key[0],0,c.duration)||key[0]<=previous||!finite(key[1],channel==='gaze.x'||channel==='gaze.y'||channel.endsWith('.balance')?-1:0,1))throw Error('Некорректный ключ '+channel);previous=key[0];}
   if(keys[0][0]!==0||keys.at(-1)[0]!==c.duration)throw Error('Дорожка должна покрывать весь клип: '+channel);
  }
 }
 return structuredClone(data);
}
export function sampleClip(clip,time,character=''){
 const t=clamp(time,0,clip.duration),result={};
 for(const [channel,keys] of Object.entries(clip.variants?.[character]?.tracks||clip.tracks)){
  let i=1;while(i<keys.length-1&&keys[i][0]<t)i++;
  const a=keys[i-1],b=keys[i],u=clamp((t-a[0])/(b[0]-a[0]));
  // Smoothstep gives bounded, predictable curves with no overshoot.
  result[channel]=a[1]+(b[1]-a[1])*u*u*(3-2*u);
 }
 return result;
}
export function mixPose(a,b,t){const result={};for(const k of new Set([...Object.keys(a),...Object.keys(b)])){const v=(a[k]||0)*(1-t)+(b[k]||0)*t;if(v)result[k]=v;}return result;}
export class EmotionPlayer{
 constructor(library){this.library=validateLibrary(library);this.character='';this.time=0;this.intensity=1;this.speed=1;this.playing=false;this.clip=null;this.from={};this.fade=0;this.fading=false;this.output={};this.speech=0;this.motionEnabled=true;this.motionAmount=.65;this.motionTime=0;this.entryTime=0;this.asymmetryEnabled=true;this.entryEnabled=true;this.effectOverrides={};}
 play(id,{transition}={}){const clip=this.library.clips.find(c=>c.id===id);if(!clip)throw Error('Неизвестное состояние: '+id);this.from={...this.output};this.clip=clip;this.time=0;this.entryTime=0;this.fade=0;this.transition=transition??clip.transition;if(!finite(this.transition,0,5))throw Error('Некорректный переход');this.fading=false;this.playing=true;return this.sample();}
 stop(duration=.25){if(!finite(duration,0,5))throw Error('Некорректный переход');this.from={...this.output};this.clip=null;this.fade=0;this.transition=duration;this.fading=true;this.playing=true;return this.sample();}
 seek(time){if(!this.clip)return this.output;if(!Number.isFinite(time))throw Error('Некорректное время');this.time=clamp(time,0,this.clip.duration);this.motionTime=this.time;this.entryTime=this.time;this.fade=this.transition;return this.sample();}
 advance(dt){if(!finite(dt,0,10))return this.output;if(this.playing){this.motionTime+=dt*clamp(this.speed,.1,3);this.entryTime+=dt*clamp(this.speed,.1,3);this.fade+=dt;if(this.clip){this.time+=dt*clamp(this.speed,.1,3);if(this.clip.loop)this.time%=this.clip.duration;else if(this.time>=this.clip.duration){this.time=this.clip.duration;this.playing=false;}}else if(this.fading&&this.fade>=this.transition){this.fading=false;this.playing=false;}}return this.sample();}
 sample(){const target=this.clip?sampleClip(this.clip,this.time,this.character):{};const t=this.transition?clamp(this.fade/this.transition):1;this.output=mixPose(this.from,target,t*t*(3-2*t));return this.output;}
 frame(){const result=Object.fromEntries(Object.entries({...this.output,...this.effectOverrides}).map(([k,v])=>[k,v*clamp(this.intensity)]));
  if(!this.asymmetryEnabled)for(const k of Object.keys(result))if(k.endsWith('.balance'))result[k]=0;
  // Independent of clip loops: seeking is reproducible, pause freezes all motion.
  const t=this.motionTime,level=clamp(this.intensity),id=this.clip?.id||'';
  const blinkPhase=t%24,blinkTimes=[2.7,7.4,7.75,12.1,17.8,21.9];
  let blink=0;
  if(this.clip?.blink)for(const at of blinkTimes){const phase=(blinkPhase-at)/.23;if(phase>0&&phase<1)blink=Math.max(blink,Math.sin(phase*Math.PI)**2);}
  result['lid.close']=Math.max(result['lid.close']||0,blink*level);
  if(this.clip&&this.motionEnabled&&id!=='unconscious'){
   const fade=this.transition?clamp(this.fade/this.transition):1;
   const amount=clamp(this.motionAmount)*level*fade*fade*(3-2*fade);
   const tense=/fear|angry|guarded|distress|pain|overload|high_negative|defiant/.test(id),slow=/sad|bored|exhaust|sleep|cry|subspace/.test(id);
   const rate=tense?1.25:slow?.58:1,clock=t*rate;
   // A held gaze followed by a short eased saccade, with deterministic targets.
   const segment=Math.floor(clock/2.1),phase=clock/2.1-segment;
   const ease=clamp((phase-.78)/.22),u=ease*ease*(3-2*ease);
   const target=(n,axis)=>Math.sin(n*12.9898+axis*78.233)*.5;
   const closed=clamp(result['lid.close']||0),gazeScale=amount*(1-closed)*(tense?.065:.12)*(1-.8*clamp(Math.abs(result['gaze.y']||0)));
   for(const [axis,key]of [[0,'gaze.x'],[1,'gaze.y']]){
    const offset=(target(segment,axis)*(1-u)+target(segment+1,axis)*u)*gazeScale*(axis?.65:1);
    result[key]=clamp((result[key]||0)+offset,-1,1);
   }
   // A single emphasis after entering a state; it never retriggers at loop seams.
   const entry=(this.entryEnabled?.12:0)*Math.exp(-(((this.entryTime-.5)/.32)**2))*fade;
   for(const key of Object.keys(result))if(/^(eye|brow|mouth)\./.test(key)&&!key.endsWith('.balance')&&key!=='mouth.tongueOut'&&!(key.startsWith('mouth.')&&clamp(this.speech)>0))result[key]=clamp(result[key]*(1+entry));
   // Modulate authored shapes only; never invent a smile or open a closed mouth.
   const pulse=Math.max(0,Math.sin(clock*1.41+.4))**12;
   for(const key of Object.keys(result)){
    if(key.endsWith('.balance'))continue;
    if(key.startsWith('brow.'))result[key]=clamp(result[key]*(1-amount*.09*pulse));
    if(key.startsWith('mouth.')&&clamp(this.speech)===0)result[key]=clamp(result[key]*(1-amount*.045*(.5+.5*Math.sin(clock*1.9))));
   }
  }
  return result;
 }
 get active(){return Boolean(this.clip||this.fading);}
}
