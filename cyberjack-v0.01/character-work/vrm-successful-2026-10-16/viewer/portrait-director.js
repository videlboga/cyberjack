// Portrait director: game-character events drive the studio engine via postMessage.
// API (window → portrait):
//   {type:'visual', affect, activation, phase, intensity, speed?, bg?}   — состояние персонажа из сима
//   {type:'speech', audio:<url>, muted?:true}                            — реплика; рот по громкости аудио (AudioAssist)
//   {type:'idle'}                                                        — вернуть спокойный idle
// Портрет отвечает: {type:'portrait-ready', character} | {type:'portrait-error', message}.
import * as THREE from 'three';
const $=s=>document.querySelector(s);
const AUDIT={
  affect: {
    neutral:        {eye:['デフォルト'],brow:['デフォルト','真剣'],mouth:['デフォルト'],eyesOpen:.95},
    receptive:      {eye:['笑顔'],brow:['デフォルト'],mouth:['微笑','デフォルト'],eyesOpen:1},
    guarded:        {eye:['真剣','デフォルト'],brow:['怒り'],mouth:['デフォルト'],eyesOpen:.85},
    high_positive:  {eye:['笑顔','微笑'],brow:['微笑'],mouth:['笑顔'],eyesOpen:1},
    high_negative:  {eye:['切ない','デフォルト'],brow:['切ない','悲しい'],mouth:['切ない'],eyesOpen:.8},
    subspace:       {eye:['両目閉じ','デフォルト'],brow:['デフォルト'],mouth:['デフォルト'],eyesOpen:.3},
    climax:         {eye:['切ない','笑顔'],brow:['切ない'],mouth:['開口','笑顔'],eyesOpen:.35},
    unconscious:    {eye:['両目閉じ'],brow:['デフォルト'],mouth:['デフォルト'],eyesOpen:0},
  },
  activationIdle: {calm:'Idle_00_00', working:'Stand_00_00', intense:'Stand_Joy_01', peak:'Stand_Joy_01'},
};
let lastAffect=null;
function pickPattern(controller,group,names){
  const profile=controller?.catalog?.profiles?.[controller.state?.character];
  const rows=profile?.groups?.[group]||[];
  for(const want of names){
    const hit=rows.find(p=>p.supported&&(p.name===want||(p.label||'').includes(want)));
    if(hit)return hit.id;
  }
  return 0;
}
function applyAffect(face,characterName,affect){
  if(!face)return;lastAffect=affect;
  const spec=AUDIT.affect[affect]||AUDIT.affect.neutral;
  try{
    face.set({
      Eye:pickPattern(face,'Eye',spec.eye),
      Eyebrow:pickPattern(face,'Eyebrow',spec.brow),
      Mouth:pickPattern(face,'Mouth',spec.mouth),
      eyesOpen:spec.eyesOpen,
    });
  }catch(e){try{face.reset()}catch(_){}}
}
function setBodyIdle(studio,activation,pose){
  const st=studio.state;
  // не перебиваем сцену-контроллер: он сам ведёт тело
  if(studio.links?.state?.active)return;
  const idle=AUDIT.activationIdle[activation]||AUDIT.activationIdle.calm;
  if(studio.currentClip()?.id!==idle&&(st.pose!==idle))studio.setPose(idle,true);
  studio.setPlaying(true);
}
const audioEl=document.createElement('audio');audioEl.muted=false;audioEl.preload='auto';audioEl.style.display='none';
document.body.append(audioEl);
let audioCtx=null,analyser=null,sourceNode=null,mouthRAF=0;
async function speak(url){
  try{
    if(!audioCtx){audioCtx=new (window.AudioContext||window.webkitAudioContext)();analyser=audioCtx.createAnalyser();analyser.fftSize=256;sourceNode=audioCtx.createMediaElementSource(audioEl);sourceNode.connect(analyser);}
    audioEl.src=url;
    await audioEl.play();
    const buf=new Float32Array(analyser.fftSize);let prev=0;
    const tick=()=>{
      if(audioEl.paused||audioEl.ended){window.__studio.face?.setMouthDriver(0);return}
      analyser.getFloatTimeDomainData(buf);
      let sum=0;for(const x of buf)sum+=x*x;
      const level=Math.min(1,Math.sqrt(sum/buf.length)*2.4);
      prev=(level>=prev?level:level*.2+prev*.8);
      window.__studio.face?.setMouthDriver(prev);
      mouthRAF=requestAnimationFrame(tick);
    };
    cancelAnimationFrame(mouthRAF);mouthRAF=requestAnimationFrame(tick);
  }catch(e){/* тихо: реплика без рта */}
}
audioEl.addEventListener('ended',()=>{window.__studio.face?.setMouthDriver(0)});
function readyPoll(){
  const st=window.__studio;
  if(st?.ready){
    try{st.scene.background=null;const grid=st.scene.children.find(o=>o.isGridHelper);if(grid)grid.visible=false;}catch(_){}
    parent.postMessage({type:'portrait-ready',character:st.character},'*');
    return;
  }
  setTimeout(readyPoll,250);
}
readyPoll();
addEventListener('message',ev=>{
  const st=window.__studio;if(!st||!st.ready)return;const msg=ev.data||{};
  try{
    if(msg.type==='visual'){
      if(msg.bg){try{st.scene.background=new THREE.Color(msg.bg)}catch(_){}}
      if(msg.speed!=null)$('#speed').value=String(Math.min(2,Math.max(.5,Number(msg.speed)||1)));
      if(msg.interaction&&msg.interaction.family&&msg.interaction.family!=='none'){/* шаг 3: клип действия */}
      else setBodyIdle(st,msg.activation||'calm',msg.pose);
      applyAffect(st.face,st.character,msg.affect||'neutral');
    }else if(msg.type==='speech'){
      if(msg.audio){const raw=String(msg.audio);const url=new URL(raw,location.href);speak(url.href);}
    }else if(msg.type==='idle'){
      if(!st.links?.state?.active){st.setPose('Idle_00_00',true);st.setPlaying(true)}
      try{st.scene.background=null}catch(_){}
      applyAffect(st.face,st.character,lastAffect||'neutral');
    }
  }catch(e){parent.postMessage({type:'portrait-error',message:e.message},'*')}
});
