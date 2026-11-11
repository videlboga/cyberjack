import {EmotionHeadEffects} from './emotion-head-effects.js?v=perf91';
import {EmotionPlayer,validateLibrary} from './emotion-core.js?v=10';
import {EmotionVRMAdapter,validateProfile} from './emotion-vrm-adapter.js?v=tongue86';
const url=name=>new URL(name,import.meta.url);
export async function installEmotions({head,host,getCharacter=()=>'',onReference=()=>{},useSavedLibrary=true}){
 const box=document.createElement('details');box.id='emotion-clips';box.open=true;box.innerHTML='<summary>Эмоции · клипы Cyberjack</summary><p role="status">Загрузка библиотеки эмоций…</p>';host.prepend(box);
 try{
  const get=async name=>{const r=await fetch(url(name),{cache:'no-store'});if(!r.ok)throw Error(name+': '+r.status);return r.json();};
  let library=validateLibrary(await get('emotion-library.json')),profile=validateProfile(await get('emotion-head-profile.json'));
  const initialLibrary=structuredClone(library),initialProfile=structuredClone(profile);
  const storageKey='cyberjack-emotion-library-v1';let storedError='';try{const saved=useSavedLibrary?localStorage.getItem(storageKey):null;if(saved)library=validateLibrary(JSON.parse(saved));}catch(e){storedError='Сохранённая библиотека не прочитана: '+e.message;}
  let player=new EmotionPlayer(library),adapter=new EmotionVRMAdapter(head,profile);adapter.effects=new EmotionHeadEffects(head);head.emotionLayer={player,adapter};
  const release=()=>{player.stop(0);player.advance(0);};
  host.addEventListener('input',event=>{if(!box.contains(event.target)&&!event.target.closest('#emotion-motion')&&!event.target.closest('#emotion-motion-tickle'))release();},true);
  document.getElementById('head-neutral')?.addEventListener('click',release,true);
  for(const id of ['head-lookX','head-lookY'])document.getElementById(id)?.addEventListener('input',release,true);
  box.innerHTML=`<summary>Эмоции · клипы Cyberjack</summary><div style="display:grid;gap:7px;padding:8px 0"><label>Состояние <select class="emotion-select" aria-label="Эмоциональный клип"></select></label><div><button class="emotion-play">▶ Играть</button> <button class="emotion-pause">Ⅱ Пауза</button> <button class="emotion-stop">Снять эмоцию</button></div><label>Интенсивность <input class="emotion-intensity" aria-label="Интенсивность эмоции" type="range" min="0" max="1" step=".01" value="1"></label><label>Скорость <input class="emotion-speed" aria-label="Скорость эмоции" type="range" min=".1" max="3" step=".1" value="1"></label><label><input class="emotion-motion" type="checkbox" checked> Живая мимика</label><label><input class="emotion-asymmetry" type="checkbox" checked> Асимметрия лица</label><label><input class="emotion-entry" type="checkbox" checked> Акцент при входе</label><label>Сила микродвижений <input class="emotion-motion-amount" aria-label="Сила микродвижений" type="range" min="0" max="1" step=".01" value=".65"></label><label><input class="emotion-fx-auto" type="checkbox" checked> Эффекты из клипа</label><label>Пот <input class="emotion-fx-sweat" aria-label="Пот" type="range" min="0" max="1" step=".01" value="0"></label><label>Слёзы <input class="emotion-fx-tears" aria-label="Слёзы" type="range" min="0" max="1" step=".01" value="0"></label><label>Слюна <input class="emotion-fx-saliva" aria-label="Слюна" type="range" min="0" max="1" step=".01" value="0"></label><label>Время <output class="emotion-time">0.00</output><input class="emotion-seek" aria-label="Время эмоционального клипа" type="range" min="0" max="4" step=".01" value="0"></label><label><input class="emotion-loop" type="checkbox" checked> Повтор клипа</label><button class="emotion-reference">Сравнить с 2D-портретом</button><p class="emotion-status" role="status" style="font-size:11px;white-space:pre-wrap"></p><details><summary>Ключи клипа · JSON</summary><p>Время в секундах, веса 0…1; взгляд −1…1. Форма головы хранится отдельно.</p><textarea class="emotion-json" aria-label="Ключи эмоционального клипа" rows="12" spellcheck="false" style="box-sizing:border-box;width:100%"></textarea><button class="emotion-apply">Применить ключи</button> <button class="emotion-save">Сохранить в браузере</button> <button class="emotion-reset">Исходная библиотека</button></details><div><button class="emotion-export">Скачать клипы</button> <label>Загрузить клипы <input class="emotion-import" type="file" accept=".json,application/json"></label></div><details><summary>Привязки головы и калибровка персонажей</summary><p>mapping: канал → имя морфа. characters[id].gains: общие коэффициенты каналов 0…2; characters[id].clips[состояние].gains: уточнение отдельной эмоции. Неподдерживаемые каналы перечислены выше.</p><textarea class="emotion-profile" aria-label="Профиль привязок головы" rows="10" spellcheck="false" style="box-sizing:border-box;width:100%"></textarea><button class="emotion-profile-apply">Применить профиль</button> <button class="emotion-profile-export">Скачать профиль</button><label>Загрузить профиль <input class="emotion-profile-import" type="file" accept=".json,application/json"></label></details></div>`;
  const $=s=>box.querySelector('.emotion-'+s),status=$('status');
  const message=t=>{status.textContent=t;};
  function selected(){return library.clips.find(c=>c.id===$('select').value);}
  function edit(){const c=selected();$('json').value=JSON.stringify(c,null,2);$('seek').max=c.duration;$('loop').checked=c.loop;}
  function options(id){$('select').replaceChildren(...library.clips.map(c=>new Option(c.label+' · '+c.id,c.id)));$('select').value=library.clips.some(c=>c.id===id)?id:library.clips[0].id;edit();}
  function safe(fn){return async()=>{try{await fn();}catch(e){message(e.message);}};}
  function replace(next){player.stop(0);player.advance(0);head.applyExpressions?.();library=validateLibrary(next);player=new EmotionPlayer(library);player.intensity=Number($('intensity').value);player.speed=Number($('speed').value);player.motionEnabled=$('motion').checked;player.asymmetryEnabled=$('asymmetry').checked;player.entryEnabled=$('entry').checked;player.motionAmount=Number($('motion-amount').value);head.emotionLayer.player=player;options();}
  function download(data,name){const blob=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=blob;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(blob),1000);}
  async function file(input){const f=input.files?.[0];if(!f)return null;if(f.size>2_000_000)throw Error('Файл больше 2 МБ');return JSON.parse(await f.text());}
  options('neutral');$('profile').value=JSON.stringify(profile,null,2);
  $('select').onchange=()=>{edit();if(player.active){player.play(selected().id);onReference(selected().reference||selected().id);}};
  $('play').onclick=safe(()=>{if(player.clip?.id===selected().id&&player.time<player.clip.duration)player.playing=true;else player.play(selected().id);head.applyExpressions?.();});
  $('pause').onclick=()=>{player.playing=false;};$('stop').onclick=()=>player.stop();
  $('intensity').oninput=()=>{player.intensity=Number($('intensity').value);head.applyExpressions?.();};$('speed').oninput=()=>player.speed=Number($('speed').value);
  for(const [control,key]of [['asymmetry','asymmetryEnabled'],['entry','entryEnabled']])$(control).onchange=()=>{player[key]=$(control).checked;head.applyExpressions?.();};
  $('motion').onchange=()=>{player.motionEnabled=$('motion').checked;head.applyExpressions?.();};$('motion-amount').oninput=()=>{player.motionAmount=Number($('motion-amount').value);head.applyExpressions?.();};
  const fxNames=['sweat','tears','saliva'];for(const name of fxNames)$('fx-'+name).oninput=()=>{$('fx-auto').checked=false;for(const key of fxNames)player.effectOverrides['effect.'+key]=Number($('fx-'+key).value);head.applyExpressions?.();};$('fx-auto').onchange=()=>{player.effectOverrides={};if(!$('fx-auto').checked)for(const key of fxNames)player.effectOverrides['effect.'+key]=Number($('fx-'+key).value);head.applyExpressions?.();};
  $('seek').oninput=()=>{if(player.clip?.id!==selected().id)player.play(selected().id,{transition:0});player.playing=false;player.seek(Number($('seek').value));head.applyExpressions?.();};
  $('loop').onchange=()=>{selected().loop=$('loop').checked;const live=player.library.clips.find(c=>c.id===selected().id);live.loop=selected().loop;edit();};
  $('reference').onclick=()=>onReference(selected().reference||selected().id);
  $('apply').onclick=safe(()=>{const c=JSON.parse($('json').value),next=structuredClone(library),i=next.clips.findIndex(x=>x.id===$('select').value);next.clips[i]=c;validateLibrary(next);replace(next);options(c.id);player.play(c.id);message('Ключи применены. Сохраните или скачайте библиотеку.');});
  $('save').onclick=safe(()=>{localStorage.setItem(storageKey,JSON.stringify(library));message('Библиотека сохранена в этом браузере.');});
  $('reset').onclick=safe(async()=>{replace(await get('emotion-library.json'));localStorage.removeItem(storageKey);message('Восстановлена исходная библиотека.');});
  $('export').onclick=()=>download(library,'cyberjack-emotion-library.json');
  $('import').onchange=safe(async()=>{const data=await file($('import'));if(data){replace(data);message('Библиотека загружена.');}$('import').value='';});
  function applyProfile(p){profile=validateProfile(p);adapter.setProfile(profile);$('profile').value=JSON.stringify(profile,null,2);head.applyExpressions?.();}
  $('profile-apply').onclick=safe(()=>{applyProfile(JSON.parse($('profile').value));message('Профиль применён. Скачайте его для сохранения.');});
  $('profile-export').onclick=()=>download(profile,'cyberjack-emotion-head-profile.json');
  $('profile-import').onchange=safe(async()=>{const data=await file($('profile-import'));if(data)applyProfile(data);$('profile-import').value='';});
  let lastStatus='',lastUI=0;
  // Called by the existing render loop; no second animation clock or geometry rebuild.
  head.tickEmotions=dt=>{adapter.character=getCharacter();player.character=adapter.character;adapter.clipId=player.clip?.id;const active=player.active;if(active){player.advance(dt);head.applyExpressions();}else if(adapter.lastActive)head.applyExpressions();adapter.lastActive=player.active;
   const now=performance.now();if(now-lastUI>120){lastUI=now;if($('fx-auto').checked)for(const key of fxNames)$('fx-'+key).value=player.output['effect.'+key]||0;$('time').textContent=player.time.toFixed(2)+' с';$('seek').value=player.time;const report=adapter.report(),text=(player.active?(player.playing?'Играет: ':'Пауза: ')+(player.clip?.label||'переход к ручной мимике'):'Ручная мимика')+'\nПривязано '+report.bound.length+' каналов. Не поддержаны: '+(report.missing.join(', ')||'нет');if(text!==lastStatus){lastStatus=text;message(text);}}
  };
  if(storedError)message(storedError);
  return {
   captureProject(){return {library:structuredClone(library),profile:structuredClone(adapter.profile),clip:player.clip?.id||null};},
   restoreProject(state){const nextLibrary=validateLibrary(structuredClone(state?.library||initialLibrary)),nextProfile=validateProfile(structuredClone(state?.profile||initialProfile));replace(nextLibrary);adapter.character=getCharacter();player.character=adapter.character;applyProfile(nextProfile);const id=nextLibrary.clips.some(c=>c.id===state?.clip)?state.clip:(nextLibrary.clips.find(c=>c.id==='neutral')||nextLibrary.clips[0]).id;player.play(id,{transition:0});$('select').value=id;edit();},
   get player(){return player;},adapter,get library(){return library;},box,
   setIntensity(value){if(!Number.isFinite(value))throw Error('Некорректная интенсивность');player.intensity=Math.max(0,Math.min(1,value));$('intensity').value=player.intensity;head.applyExpressions?.();},
   setState(id,options={}){if(player.clip?.id===id&&!options.force)return;player.play(id,options);$('select').value=id;edit();},
   setEffect(name,value){if(!['sweat','tears','saliva','blush'].includes(name))throw Error('Неизвестный эффект');if(value===null)delete player.effectOverrides['effect.'+name];else{if(!Number.isFinite(value))throw Error('Некорректная сила эффекта');player.effectOverrides['effect.'+name]=Math.max(0,Math.min(1,value));}},
   setSpeech(value){if(!Number.isFinite(value))throw Error('Некорректный уровень речи');player.speech=Math.max(0,Math.min(1,value));},
   stop(){player.stop();},
  };
 }catch(e){box.querySelector('p').textContent='Не удалось загрузить эмоции: '+e.message;return null;}
}
