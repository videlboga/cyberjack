import {resolveOutfitSlot} from '../domain/vrmOutfits';
import React, {useEffect, useRef, useState} from 'react';
import './VrmGameStage.css';
import {createPortal} from 'react-dom';

type Context = {id?:string;actionId?:string};
type Reply = {id:string;actorId?:string;speaker:string;text:string;role?:string;action?:boolean;portraitEmotion?:string};
type Person = {id:string;name:string};
type BodyControl={direct:boolean;busy:boolean;focusId?:string;tool?:{id:string;label:string;targets:string[];reason?:string}|null;zones:Array<{id:string;label:string;blocked?:boolean}>;onPoint:(id:string,apply:boolean)=>void;onDirect:(value:boolean)=>void;onClear:()=>void;onAvailability:(value:boolean)=>void};
type Props = {id:string;name:string;fallback:React.ReactNode;visualState?:{contexts?:Context[];tension?:number;attitude?:number}|null;contexts?:Context[];emotion?:string;eventId?:string|number;impact?:{intensity:number;sharpness:number;result:string;discharge?:boolean};lines?:Reply[];participants?:Person[];onSelect?:(id:string)=>void;fallbackReason?:string;onPose?:(id:string)=>void;condition?:Record<string,number|undefined>;body?:BodyControl};
const ids:Record<string,string>={'S-AV-01':'mira','NPC-CAND-GEN-03':'rin','NPC-RIN-01':'rin','NPC-CAND-GEN-05':'kai'};
export const vrmCharacter = (id:string,name:string) => ids[id]||({mira:'mira','мира':'mira',rin:'rin','рин':'rin',kai:'kai','кай':'kai'} as Record<string,string>)[name.trim().toLowerCase()]||null;
export function VrmGameStage({id,name,fallback,visualState,contexts=[],emotion,eventId,impact,lines=[],participants=[],onSelect,fallbackReason,onPose,condition,body}:Props){
 const character=vrmCharacter(id,name),frame=useRef<HTMLIFrameElement>(null);
 const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem('cyberjack-vrm-enabled')!=='false'}catch{return true}}),[ready,setReady]=useState(false),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[reply,setReply]=useState<{id:string;text:string}|undefined>();
 const [renderPreset,setRenderPreset]=useState(()=>localStorage.getItem('cyberjack-vrm-style-v4')||'blender');
 const [styleStrength,setStyleStrength]=useState(()=>Number(localStorage.getItem('cyberjack-vrm-style-strength')??1));
 useEffect(()=>{localStorage.setItem('cyberjack-vrm-style-v4',renderPreset);localStorage.setItem('cyberjack-vrm-style-strength',String(styleStrength));if(ready)frame.current?.contentWindow?.postMessage({type:'cyberjack-vrm-style',character,preset:renderPreset,strength:styleStrength},location.origin)},[ready,character,renderPreset,styleStrength]);
 const [motionLabel,setMotionLabel]=useState('');
 const [previewOpen,setPreviewOpen]=useState(false);
 const [previewStrength,setPreviewStrength]=useState(1),[reactionLabel,setReactionLabel]=useState('');
 const [cinematic,setCinematic]=useState(true),[focusedLabel,setFocusedLabel]=useState('Весь рост');
 const bodyRef=useRef(body);bodyRef.current=body;
 const previousFocus=useRef(body?.focusId),pendingFocus=useRef(false);
 useEffect(()=>{if(previousFocus.current!==body?.focusId){pendingFocus.current=true;previousFocus.current=body?.focusId}if(ready&&pendingFocus.current){pendingFocus.current=false;frame.current?.contentWindow?.postMessage({type:'cyberjack-vrm-focus',character,pointId:body?.focusId},location.origin)}},[ready,character,body?.focusId]);
 const previousReply=useRef<string|null>(null),initialized=useRef(false);
 const contextIds=[...contexts,...(visualState?.contexts||[])].map(c=>c.actionId||c.id||'');
 const outfit=resolveOutfitSlot(contextIds,character as 'mira'|'rin'|'kai'|null);
 const unsupported=contextIds.find(c=>/^pose_/.test(c)&&!['pose_standing','pose_standing_straight','pose_sitting','pose_lying_down'].includes(c));
 const reason=fallbackReason||(unsupported?'Для текущей позы ещё нет проверенного VRM-клипа':'');
 const live=Boolean(enabled&&character&&!reason&&!error);
 const latest=[...lines].reverse().find(l=>!l.action&&!l.id.startsWith('stream:')&&(l.role==='character'||!l.role)&&(l.actorId===id||(!l.actorId&&l.speaker.toLowerCase()===name.toLowerCase())));
 const affect=emotion||latest?.portraitEmotion||(Number(visualState?.tension||0)>65?'guarded':'neutral');
 const interaction={zones:body?.zones||[],tool:body?.direct?body.tool:null,busy:body?.busy||false,cinematic};
 const postureContexts=visualState?.contexts||contexts;
 const stateRef=useRef({postureContexts,condition,interaction,type:'cyberjack-vrm-state',character,emotion:affect,eventId,impact,reply});stateRef.current={postureContexts,condition,interaction,type:'cyberjack-vrm-state',character,emotion:affect,eventId,impact,reply};
 useEffect(()=>{if(!initialized.current){initialized.current=true;previousReply.current=latest?.id||null;return}if(latest&&latest.id!==previousReply.current){previousReply.current=latest.id;setReply({id:latest.id,text:latest.text.slice(0,2000)})}},[latest?.id]);
 useEffect(()=>{setReady(false);setError('');},[character,attempt,outfit]);
 useEffect(()=>{const receive=(event:MessageEvent)=>{if(event.origin!==location.origin||event.source!==frame.current?.contentWindow||event.data?.character!==character)return;if(event.data.type==='cyberjack-vrm-motion'){setMotionLabel(String(event.data.status?.label||''));return}if(event.data.type==='cyberjack-vrm-clear'){bodyRef.current?.onClear();return}if(event.data.type==='cyberjack-vrm-body'){bodyRef.current?.onPoint(String(event.data.pointId),Boolean(event.data.apply));return}if(event.data.type==='cyberjack-vrm-focus'){setFocusedLabel(bodyRef.current?.zones.find(z=>z.id===event.data.pointId)?.label||'Весь рост');return}if(event.data.type==='cyberjack-vrm-reaction'){setReactionLabel(String(event.data.label||''));return}if(event.data.type==='cyberjack-vrm-ready'){setReady(true);frame.current?.contentWindow?.postMessage(stateRef.current,location.origin)}else if(event.data.type==='cyberjack-vrm-error'){setError(String(event.data.message||'Не удалось открыть VRM'));setReady(false)}};window.addEventListener('message',receive);return()=>window.removeEventListener('message',receive)},[character]);
 const stateSignature=JSON.stringify(stateRef.current);
 useEffect(()=>{if(ready)frame.current?.contentWindow?.postMessage(stateRef.current,location.origin)},[ready,stateSignature]);
 useEffect(()=>{if(!live||ready)return;const timer=window.setTimeout(()=>setError('Загрузка модели заняла слишком много времени'),120000);return()=>clearTimeout(timer)},[live,attempt,ready]);
 // A ready frame must not hit the loading timeout later in a long session.
 useEffect(()=>{if(!ready)return;setError('');},[ready]);
 useEffect(()=>{bodyRef.current?.onAvailability(live&&ready)},[live,ready]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{if(e.key==='Escape'&&!(e.target instanceof HTMLInputElement)&&!(e.target instanceof HTMLTextAreaElement))bodyRef.current?.onClear()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[]);
 const toggle=(value:boolean)=>{setError('');setReady(false);setEnabled(value);setAttempt(n=>n+1);try{localStorage.setItem('cyberjack-vrm-enabled',String(value))}catch{}};
 return <div className="vrm-game-stage" data-character={character||'unavailable'} data-ready={ready&&live?'true':'false'}>
  <div className="vrm-game-fallback" style={{visibility:live&&ready?'hidden':'visible'}}>{fallback}</div>
  {live&&<iframe key={`${character}:${attempt}:${outfit}`} ref={frame} src={`/vrm-stage/index.html?character=${character}&outfit=${outfit}`} title={`VRM · ${name}`} style={{opacity:ready?1:0}}/>}
  <div className="vrm-game-controls"><button onClick={()=>toggle(true)} disabled={!character||Boolean(reason)} aria-pressed={live} title={reason||'Живая VRM-модель'}>VRM</button><button onClick={()=>toggle(false)} aria-pressed={!live}>Картинки</button><small role="status">{error?'Ошибка VRM · показано изображение':reason||(!character?'Модель пока не импортирована':live?(ready?(motionLabel||'Живая сцена'):'Загружаю VRM…'):'Исходные изображения')}</small></div>

  {live&&ready&&body&&<div className="vrm-body-toolbar"><label><input type="checkbox" checked={body.direct} onChange={e=>body.onDirect(e.target.checked)}/>Действия на модели</label><strong>{body.direct?(body.tool?.label||'Выберите действие в карточках'):'Карточки выполняют действия'}</strong>{body.direct&&body.tool&&<button onClick={body.onClear}>Снять действие · Esc</button>}<small>{body.busy?'Выполняется действие…':body.tool?.reason?body.tool.reason:body.direct&&body.tool?'Клик — применить · Alt+клик — фокус':'Клик по модели — фокус'}</small><span>Фокус: {focusedLabel}</span><button onClick={()=>frame.current?.contentWindow?.postMessage({type:'cyberjack-vrm-focus',character,pointId:'systemic'},location.origin)}>Весь рост</button><label><input type="checkbox" checked={cinematic} onChange={e=>setCinematic(e.target.checked)}/>Камера сильных реакций</label><small>Дыхание: {Math.round(condition?.breathingRate||12)}/мин · {Number(condition?.tension||0)>55?'напряжена':Number(condition?.capacity||50)<Number(condition?.baselineCapacity||50)*.45?'утомлена':'спокойная стойка'}</small></div>}
  {live&&ready&&<details className="vrm-scene-settings"><summary>Поза, рендер и тесты</summary>
  {onPose&&<div className="vrm-posture-controls"><strong>Поза и части тела</strong>{[
 ['База',[['pose_standing','Стоя'],['pose_sitting','Сидя · под сиденье'],['pose_lying_down','Лёжа']]],
 ['Руки',[['posture_arms_free','По базовому клипу'],['posture_arms_down','Опущены'],['posture_arms_up','Вверх'],['posture_arms_sides','В стороны'],['posture_arms_front','Перед собой']]],
 ['Ноги',[['posture_legs_free','По базовому клипу'],['posture_leg_left_forward','Левую вперёд'],['posture_leg_right_forward','Правую вперёд']]],
 ['Голова',[['posture_head_forward','Прямо'],['posture_head_left','Влево'],['posture_head_right','Вправо']]]
 ].map(([label,options])=>{const choices=options as string[][];const active=choices.find(([id])=>contextIds.includes(id))?.[0]||choices[0][0];return <label key={label as string}>{label as string}<select aria-label={'Поза · '+label} value={active} disabled={body?.busy} onChange={e=>onPose(e.target.value)}>{choices.map(([id,text])=><option key={id} value={id}>{text}</option>)}</select></label>})}<small>Команды в чате: «Подними руки», «Поверни голову налево». Исполнение решает ядро.</small><small role="status">{motionLabel}</small></div>}
  <div className="vrm-render-style"><label>Рендер <select aria-label="Стиль VRM" value={renderPreset} onChange={e=>setRenderPreset(e.target.value)}><option value="original">Исходный</option><option value="manga2">Manga 2 · тона</option><option value="blender">Blender · Manga</option><option value="cartoon">Cartoon · контуры</option></select></label>{renderPreset!=='original'&&<label>Сила <input aria-label="Сила стилизации" type="range" min="0" max="1" step=".05" value={styleStrength} onChange={e=>setStyleStrength(Number(e.target.value))}/><span>{Math.round(styleStrength*100)}%</span></label>}</div>
  <details className="vrm-impact-preview" open={previewOpen} onToggle={e=>setPreviewOpen(e.currentTarget.open)}><summary>Реакции · тест{reactionLabel?` · ${reactionLabel}`:''}</summary></details></details>}
  {live&&ready&&previewOpen&&createPortal(<div className="vrm-impact-body" role="group" aria-label="Предпросмотр откликов"><div className="vrm-impact-buttons">{[['soft','Мягкий отклик'],['nod','Кивок'],['startle','Вздрагивание'],['surprise','Удивление'],['joy','Радость'],['idle','Вернуться в idle']].map(([kind,label])=><button key={kind} aria-pressed={reactionLabel===label} onClick={()=>frame.current?.contentWindow?.postMessage({type:'cyberjack-vrm-preview',character,kind,strength:previewStrength},location.origin)}>{label}</button>)}</div><label>Сила <select aria-label="Сила тестового отклика" value={previewStrength} onChange={e=>setPreviewStrength(Number(e.target.value))}><option value={.5}>Слабее</option><option value={1}>Обычно</option><option value={1.3}>Сильнее</option></select></label><small>Предпросмотр не меняет игровое состояние.</small><button className="vrm-impact-close" onClick={()=>setPreviewOpen(false)}>Закрыть тест</button></div>,document.body)}
  {error&&<button className="vrm-game-retry" onClick={()=>toggle(true)} title={error}>Повторить загрузку VRM</button>}
  {live&&participants.length>1&&onSelect&&<div className="vrm-game-actors" aria-label="Участники сцены">{participants.map(p=><button key={p.id} onClick={()=>onSelect(p.id)} aria-pressed={p.id===id}>{p.name}</button>)}</div>}
 </div>;
}
