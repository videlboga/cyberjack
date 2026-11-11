import React, { useState } from "react";
import "./MangaWorkbenchConcept.css";
import "./MangaWorkbenchScreens.css";

const portrait = "/character-images/portraits/mira/guarded.png";
const hero = "/character-images/calibration-v4/mira/sitting_spread/calibration_set__wrist_cuffs__subspace.png";

const actions = [
  ["Мягкое касание", "Снизить защиту", "/character-images/actions-by-point/feet/gentle_stroke_s2.png"],
  ["Глубокий массаж", "Повысить доверие", "/character-images/actions-by-point/feet/deep_massage.png"],
  ["Провести языком", "Поднять возбуждение", "/character-images/actions-by-point/feet/licking_s3.png"],
  ["Кубик льда", "Добавить контраст", "/character-images/actions-by-point/feet/ice_cube_s2.png"],
  ["Пощекотать", "Проверить реакцию", "/character-images/actions/contact/tickle.png"],
  ["Мягкое давление", "Удержать контакт", "/character-images/actions/contact/firm_grip.png"],
  ["Тёплый воск", "Температурный стимул", "/character-images/actions/contact/hot_wax.png"],
  ["Перо", "Снизить напряжение", "/character-images/actions/contact/feather_stroke.png"],
  ["Лёгкий укус", "Проверить границы", "/character-images/actions/contact/light_bite.png"],
  ["Вибрация", "Продолжительный процесс", "/character-images/actions/equipment/act_start_vibrator.png"],
  ["Зафиксировать", "Усилить контроль", "/character-images/actions/equipment/act_apply_ankle_cuffs.png"],
  ["Дать паузу", "Восстановить ресурс", "/character-images/actions/contact/wait.png"],
  ["Погладить", "Мягкий контакт", "/character-images/actions/contact/gentle_stroke.png"],
  ["Глубокий поцелуй", "Интимный контакт", "/character-images/actions/intimacy/deep_kiss.png"],
  ["Лёгкий поцелуй", "Проверить принятие", "/character-images/actions/intimacy/light_kiss.png"],
  ["Игла", "Точечный стимул", "/character-images/actions/contact/needle_prick.png"],
  ["Ущипнуть", "Резкий контакт", "/character-images/actions/contact/pinch.png"],
  ["Провести ногтями", "Тактильный контраст", "/character-images/actions/contact/scratching.png"],
  ["Ремень", "Сильный стимул", "/character-images/actions/contact/belt_strike.png"],
  ["Шлепок", "Импульсное воздействие", "/character-images/actions/contact/slap.png"],
  ["Электроимпульс", "Контролируемый разряд", "/character-images/actions/contact/taser_shock.png"],
];

const zones = [
  ["Ступни", "/character-images/bodyparts/mira/feet.png"],
  ["Ладони", "/character-images/bodyparts/mira/hands.png"],
  ["Шея", "/character-images/bodyparts/mira/neck.png"],
  ["Живот", "/character-images/bodyparts/mira/stomach.png"],
  ["Спина", "/character-images/bodyparts/mira/back.png"],
  ["Внутренняя сторона бёдер", "/character-images/bodyparts/mira/inner_thighs.png"],
];

const messages = [
  ["Мира", "Что именно ты собираешься проверять?", "23:36"],
  ["Вы", "Начнём с реакции на мягкий контакт.", "23:37"],
  ["Мира", "Хорошо. Только предупреждай заранее.", "23:37"],
];

function Sparkline({ points, bars = false }: { points: string; bars?: boolean }) {
  return <svg viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
    {bars ? [14, 29, 20, 36, 26, 33, 23].map((height, index) => <rect key={index} x={index * 17 + 2} y={42 - height} width="11" height={height} />) : <polyline points={points} />}
  </svg>;
}

function ChatPanel() {
  return <aside className="manga-chat manga-panel">
    <header><span>// КАНАЛ СВЯЗИ</span><b>КАЛИБРОВКА / МИРА</b><i>● ОТКРЫТ</i></header>
    <div className="manga-chat__feed">
      <section className="manga-subject-mini"><img src={portrait} alt=""/><div><small>АКТИВ S-AV-01</small><b>Мира</b><span>Состояние: насторожена</span></div></section>
      {messages.map(([speaker, text, time], index) => <article className={speaker === "Вы" ? "mine" : ""} key={index}><header><b>{speaker}</b><time>{time}</time></header><p>{text}</p></article>)}
      <div className="manga-system"><b>ДАННЫЕ ОБНОВЛЕНЫ</b><span>Защитная реакция умеренная. Контакт допускается.</span></div>
    </div>
    <form onSubmit={event => event.preventDefault()}><input placeholder="Сказать Мире…"/><button>ОТПРАВИТЬ ↗</button></form>
  </aside>;
}

function Analytics() {
  return <aside className="manga-analytics manga-panel">
    <header><div><span>// АНАЛИТИКА</span><b>ТЕКУЩАЯ СЕССИЯ</b></div><button>•••</button></header>
    <div className="manga-analytics__grid">
      <article><header><b>НАПРЯЖЕНИЕ</b><strong>58</strong></header><Sparkline points="0,35 18,24 36,27 54,14 72,20 90,9 108,15 120,7"/><small>−7 за последние 3 действия</small></article>
      <article><header><b>ДОВЕРИЕ</b><strong>42%</strong></header><Sparkline points="0,37 18,35 36,29 54,31 72,22 90,19 108,12 120,10"/><small>положительная динамика</small></article>
      <article><header><b>РЕАКЦИИ</b><strong>214</strong></header><Sparkline bars points=""/><small>интенсивность / 10 минут</small></article>
      <article className="manga-radar"><header><b>ПРОФИЛЬ</b><strong>V4</strong></header><svg viewBox="0 0 100 80"><polygon points="50,7 87,28 76,68 25,68 12,28"/><polygon className="value" points="50,16 76,33 68,58 31,62 23,31"/><line x1="50" y1="7" x2="50" y2="70"/><line x1="12" y1="28" x2="87" y2="28"/></svg><small>открытость · пластичность · контроль</small></article>
    </div>
    <section className="manga-long-trend"><header><b>ДИНАМИКА СОСТОЯНИЯ</b><span>24 МИН</span></header><div><label><i className="tension"/>напряжение</label><label><i className="trust"/>доверие</label><label><i className="arousal"/>возбуждение</label></div><svg viewBox="0 0 240 42" preserveAspectRatio="none"><polyline className="tension" points="0,8 30,12 60,10 90,20 120,19 150,25 180,28 210,31 240,34"/><polyline className="trust" points="0,35 30,34 60,30 90,31 120,25 150,22 180,18 210,14 240,10"/><polyline className="arousal" points="0,37 30,36 60,32 90,27 120,29 150,20 180,24 210,17 240,15"/></svg></section>
    <section className="manga-progress"><header><b>СОСТОЯНИЯ</b><span>LIVE</span></header>{[["Готовность",52],["Возбуждение",38],["Перегрузка",21],["Ресурс",74]].map(([label,value])=><label key={String(label)}><span>{label}<b>{value}%</b></span><i><em style={{width:`${value}%`}}/></i></label>)}</section>
    <section className="manga-context"><header><b>АКТИВНЫЕ КОНТЕКСТЫ</b><span>02</span></header><p><i>01</i><span><b>Сидит, ноги разведены</b><small>Открыты 8 зон воздействия</small></span></p><p><i>02</i><span><b>Фиксация запястий</b><small>Модификатор контроля +12</small></span></p></section>
  </aside>;
}

function CalibrationAnalytics() {
  const instruments = [
    ["ПРИНЯТИЕ", "42", "attitude", "0,31 20,28 40,30 60,20 80,18 100,12 120,9"],
    ["ОТКРЫТОСТЬ", "68%", "openness", "0,35 20,34 40,27 60,25 80,17 100,19 120,10"],
    ["ПЛАСТИЧНОСТЬ", "127%", "plasticity", "0,34 20,30 40,29 60,20 80,23 100,12 120,8"],
    ["ЧУВСТВИТЕЛЬНОСТЬ", "214%", "sensitivity", "0,37 20,35 40,28 60,18 80,22 100,9 120,13"],
  ];
  return <aside className="manga-calibration-data manga-panel"><header><div><span>// МОНИТОР СОСТОЯНИЯ</span><b>БИОМЕТРИКА И ДИНАМИКА</b></div><i>● LIVE</i></header><div className="manga-bio-grid"><article className="activation"><header><b>ФИЗИОЛОГИЧЕСКАЯ АКТИВАЦИЯ</b><strong>58%</strong></header><div className="scale"><i style={{width:"58%"}}/><em style={{left:"58%"}}/></div><footer><span>спокойствие</span><span>рабочая</span><span>предел</span></footer></article><article><header><b>ПУЛЬС</b><strong>92 <small>уд/мин</small></strong></header><svg viewBox="0 0 120 42" preserveAspectRatio="none"><polyline points="0,25 18,25 24,18 29,30 35,7 42,35 49,24 70,24 76,17 82,27 88,11 94,32 101,24 120,24"/></svg></article><article><header><b>ДЫХАНИЕ</b><strong>18 <small>вдох/мин</small></strong></header><svg viewBox="0 0 120 42" preserveAspectRatio="none"><path d="M0 30 C18 30 20 8 40 8 S62 30 80 30 S101 8 120 8"/></svg></article><article className="endurance"><header><b>ВЫНОСЛИВОСТЬ</b><strong>74%</strong></header><div><i style={{height:"74%"}}/><span><b>СТАБИЛЬНАЯ</b><small>−1.2 за действие</small></span></div></article><article><header><b>НАКОПЛЕННЫЙ БАЛАНС</b><strong>+16</strong></header><div className="balance"><i/><em style={{left:"66%"}}/></div><small>положительный · сейчас +8</small></article><article><header><b>ПЕРЕГРУЗКА</b><strong>2.1</strong></header><div className="overload"><i style={{width:"21%"}}/></div><small>ниже заметного порога</small></article>{instruments.map(([label,value,key,points])=><article className={`instrument ${key}`} key={key}><header><b>{label}</b><strong>{value}</strong></header><Sparkline points={points}/><footer><span>индекс к норме</span><em>+2.4</em></footer></article>)}</div><section className="manga-monitor-context"><div><small>ПОЗА</small><b>Сидит, ноги разведены</b><span>открыты 8 зон</span></div><div><small>КОНТЕКСТЫ · 02</small><b>Фиксация запястий</b><span>контроль +12</span></div></section></aside>;
}

function ActionPalette() {
  const [selected, setSelected] = useState(1);
  const [mode, setMode] = useState<"recommended"|"all"|"prepare">("recommended");
  const [zone, setZone] = useState(0);
  const visibleActions = actions;
  return <section className="manga-actions manga-panel">
    <header><div><span>// ПАЛИТРА ДЕЙСТВИЙ</span><b>{zones[zone][0].toUpperCase()} · ДОСТУПНО {actions.length}</b></div><button className="manga-zone-button" onClick={()=>setMode("prepare")} style={{"--zone-art":`url("${zones[zone][1]}")`} as React.CSSProperties}><span><small>ЗОНА</small><b>{zones[zone][0]}</b></span></button><nav><button className={mode === "recommended" ? "active" : ""} onClick={()=>setMode("recommended")}>ВОЗДЕЙСТВИЯ</button><button className={mode === "prepare" ? "active" : ""} onClick={()=>setMode("prepare")}>ПОДГОТОВКА</button></nav></header>
    <section className="manga-zone-strip"><small>ПАРАМЕТРЫ ЗОНЫ</small><span>ЧУВСТВИТ. <b>127%</b></span><span>ПРИНЯТИЕ <b>42</b></span><span>ЗНАКОМСТВО <b>8</b></span><span>ДЕЙСТВИЯ <b>14</b></span></section>
    {mode === "prepare" ? <div className="manga-zone-preparation"><button className="manga-zone-preview" style={{"--zone-art":`url("${zones[zone][1]}")`} as React.CSSProperties}><span><small>ВЫБРАННАЯ ЗОНА</small><b>{zones[zone][0]}</b><em>Нажмите для детальной карты тела ↗</em></span></button><section><header><small>ВЫБОР ЗОНЫ</small><b>Доступные области воздействия</b></header><div>{zones.map(([name,image],index)=><button className={zone === index ? "active" : ""} onClick={()=>setZone(index)} key={name}><img src={image} alt=""/><span><b>{name}</b><small>{index < 3 ? "открыта" : "доступна"}</small></span></button>)}</div></section></div> : <div>{visibleActions.map(([name, effect, image], index) => <button className={selected === index ? "selected" : ""} onClick={() => setSelected(index)} key={name} style={{"--action-art":`url("${image}")`} as React.CSSProperties}><span className="index">{String(index + 1).padStart(2,"0")}</span><span className="action-copy"><small>{effect}</small><b>{name}</b><em>{zones[zone][0].toUpperCase()} ↗</em></span></button>)}</div>}
  </section>;
}

const screenLinks = [
  ["Калибровка", "/concept/manga-workbench"],
  ["Лаборатория", "/concept/manga-workbench/rooms"],
  ["Капсула", "/concept/manga-workbench/capsule"],
  ["Машина", "/concept/manga-workbench/machine"],
];

function ConceptTop({ title, active }: { title: string; active: string }) {
  return <header className="manga-top"><div className="manga-brand"><i>///</i><span><b>CYBERJACK</b><small>ILLUSTRATED INTERFACE · CONCEPT COPY</small></span></div><div className="manga-location"><small>// {title}</small><nav className="manga-screen-nav">{screenLinks.map(([label, href]) => <a className={active === href ? "active" : ""} href={href} key={href}>{label}</a>)}</nav></div><div className="manga-time"><span><small>СИСТЕМНОЕ ВРЕМЯ</small><b>23:48</b></span><button>Ⅱ ПАУЗА</button></div></header>;
}

function ConceptFooter({ goal = "Снизить защиту и повысить доверие до 50%" }: { goal?: string }) {
  return <footer className="manga-status"><section><small>// ТЕКУЩАЯ ЦЕЛЬ</small><b>{goal}</b></section><section><small>// БЫСТРЫЙ ДОСТУП</small><span><kbd>1–6</kbd> действие</span><span><kbd>TAB</kbd> панель</span><span><kbd>SPACE</kbd> пауза</span></section><section><small>// СЕССИЯ</small><b>00:12:47 · ХОД 18</b></section></footer>;
}

function RoomsConcept() {
  const equipment = [
    ["Диагностический стол", "готов · Мира", "/backgrounds/laboratory/diagnostic_table.png"],
    ["Восстановительная капсула", "занята · Ника", "/backgrounds/laboratory/capsule_outpaint_masked_d1.0.png"],
    ["Секс-машина", "готова · свободна", "/backgrounds/laboratory/sex_machine.png"],
  ];
  return <main className="manga-ui manga-ui--facility"><ConceptTop title="ЛАБОРАТОРНЫЙ КОМПЛЕКС" active="/concept/manga-workbench/rooms"/><section className="manga-facility"><aside className="manga-room-rail manga-panel"><header><span>// ПОМЕЩЕНИЯ</span><b>ЛАБОРАТОРИЯ</b></header>{[["01","Калибровочная","1 актив · 3 устройства"],["02","Жилой модуль","2 актива · отдых"],["03","Пост наблюдения","системы в норме"]].map((room,index)=><button className={index===0?"active":""} key={room[0]}><i>{room[0]}</i><span><b>{room[1]}</b><small>{room[2]}</small></span></button>)}<section><small>СОСТОЯНИЕ КОМПЛЕКСА</small><b>ШТАТНЫЙ РЕЖИМ</b><p>3 / 3 помещений доступны</p></section></aside><section className="manga-room-main"><header className="manga-room-title"><div><span>// РАБОЧЕЕ ПОМЕЩЕНИЕ</span><h1>КАЛИБРОВОЧНАЯ</h1><p>Персонажи, установленное оборудование и быстрые операции.</p></div><button>НАСТРОЙКИ КОМНАТЫ</button></header><section className="manga-room-subject manga-panel"><img src={portrait} alt=""/><div><small>ПЕРСОНАЖ В ПОМЕЩЕНИИ</small><h2>Мира</h2><p>Актив · свободна · ресурс 74%</p><nav><button>НАЧАТЬ КАЛИБРОВКУ</button><button>ДОСЬЕ</button><button>ПЕРЕМЕСТИТЬ</button></nav></div><Sparkline points="0,35 18,32 36,25 54,28 72,18 90,20 108,10 120,8"/></section><header className="manga-section-heading"><b>ОБОРУДОВАНИЕ</b><span>03 УСТРОЙСТВА</span></header><div className="manga-equipment-grid">{equipment.map(([name,state,image])=><article className="manga-equipment manga-panel" key={name}><img src={image} alt=""/><div><small>ОБОРУДОВАНИЕ</small><b>{name}</b><span>{state}</span></div><footer><button>УПРАВЛЕНИЕ</button><button>ПОМЕСТИТЬ</button></footer></article>)}</div></section><aside className="manga-facility-side"><section className="manga-panel manga-roster"><header><span>// ПРИСУТСТВУЮТ</span><b>ПЕРСОНАЖИ · 03</b></header>{[["Мира","калибровочная",portrait],["Ника","капсула","/character-images/portraits/nika/guarded.png"],["Иона","пост наблюдения","/character-images/portraits/iona/neutral.png"]].map(([name,place,image])=><article key={name}><img src={image}/><span><b>{name}</b><small>{place}</small></span><i>●</i></article>)}</section><section className="manga-panel manga-facility-metrics"><header><span>// АНАЛИТИКА</span><b>НАГРУЗКА КОМПЛЕКСА</b></header><Sparkline bars points=""/><div><span>ЭНЕРГИЯ <b>68%</b></span><span>ЗАНЯТО <b>2/3</b></span><span>СОБЫТИЯ <b>04</b></span></div></section><section className="manga-panel manga-task-list"><header><span>// ЦЕЛИ</span><b>АКТИВНЫЕ ЗАДАЧИ</b></header><p><i>01</i><span><b>Завершить калибровку Миры</b><small>прогресс 52%</small></span></p><p><i>02</i><span><b>Проверить состояние Ники</b><small>капсула · 00:37</small></span></p></section></aside></section><ConceptFooter goal="Подготовить лабораторию к следующему циклу"/></main>;
}

function DeviceConcept({ machine = false }: { machine?: boolean }) {
  const active = machine ? "/concept/manga-workbench/machine" : "/concept/manga-workbench/capsule";
  const deviceArt = machine ? hero : "/character-images/calibration-core/nika/lying/lab_gown__ankle_cuffs__neutral.png";
  const deviceActions = machine ? actions.slice(2,10) : [
    ["Регенеративный", "Восстановление ресурса", "/capsule-infusions/regenerative.png"],
    ["Нейростабилизатор", "Снижает перегрузку", "/capsule-infusions/neurostabilizer.png"],
    ["Сенсибилизатор", "Повышает чувствительность", "/capsule-infusions/sensitizer.png"],
    ["Пластицирующий", "Повышает пластичность", "/capsule-infusions/plasticity.png"],
    ["Гормональный", "Меняет гормональный фон", "/capsule-infusions/hormonal.png"],
    ["Биоматериальный", "Встроенный контур", "/capsule-infusions/biomaterial.png"],
  ];
  return <main className="manga-ui manga-ui--device"><ConceptTop title={machine?"СЕКС-МАШИНА":"ВОССТАНОВИТЕЛЬНАЯ КАПСУЛА"} active={active}/><section className="manga-device-layout"><section className="manga-device-subject manga-panel"><header><div><span>// {machine?"АКТИВНЫЙ ПРОЦЕСС":"СУБЪЕКТ КАПСУЛЫ"}</span><b>{machine?"МИРА · РИТМИЧНЫЕ ФРИКЦИИ":"НИКА · ГЛУБОКОЕ ВОССТАНОВЛЕНИЕ"}</b></div><i>● {machine?"РАБОТАЕТ":"ЦИКЛ АКТИВЕН"}</i></header><img src={deviceArt}/><div className="manga-caption"><small>ТЕКУЩЕЕ СОСТОЯНИЕ</small><b>{machine?"Интенсивность 2 · рабочая":"Ресурс восстановлен до 71%"}</b><span>{machine?"01 минута активного процесса":"До завершения цикла 00:37"}</span></div></section><section className="manga-device-control manga-panel"><header><div><span>// {machine?"ПУЛЬТ ВОЗДЕЙСТВИЯ":"СИСТЕМА ПОДАЧИ"}</span><b>{machine?"УПРАВЛЕНИЕ ПРОЦЕССОМ":"СОСТАВЫ И КОНТУРЫ"}</b></div><nav><button className="active">ОСНОВНОЕ</button><button>ИСТОРИЯ</button><button>НАСТРОЙКИ</button></nav></header>{machine&&<section className="manga-intensity"><div><small>ИНТЕНСИВНОСТЬ</small><b>РАБОЧАЯ · 02</b></div><span><i/><i className="on"/><i className="on"/><i/></span><nav><button>A · СЛАБЕЕ</button><button>D · СИЛЬНЕЕ</button><button>E · ЗАВЕРШИТЬ</button></nav></section>}<div className="manga-device-actions">{deviceActions.map(([name,effect,image],index)=><button key={name} style={{"--action-art":`url("${image}")`} as React.CSSProperties}><span className="index">{String(index+1).padStart(2,"0")}</span><span className="action-copy"><small>{effect}</small><b>{name}</b><em>{machine?"ПРИМЕНИТЬ":"АМПУЛ: 3"}</em></span></button>)}</div><section className="manga-device-history"><header><b>ДОЛГОВРЕМЕННАЯ ДИНАМИКА</b><span>24 ЧАСА</span></header><Sparkline points="0,38 18,34 36,35 54,29 72,24 90,27 108,14 120,8"/></section></section><aside className="manga-device-side"><Analytics/><ChatPanel/></aside></section><ConceptFooter goal={machine?"Удержать рабочую интенсивность без перегрузки":"Завершить восстановительный цикл Ники"}/></main>;
}

export function MangaWorkbenchConcept() {
  if (location.pathname.endsWith("/rooms")) return <RoomsConcept/>;
  if (location.pathname.endsWith("/capsule")) return <DeviceConcept/>;
  if (location.pathname.endsWith("/machine")) return <DeviceConcept machine/>;
  return <main className="manga-ui">
    <ConceptTop title="ЛАБОРАТОРИЯ / ДИАГНОСТИЧЕСКИЙ СТОЛ" active="/concept/manga-workbench"/>
    <section className="manga-layout">
      <ChatPanel/>
      <section className="manga-center">
        <section className="manga-stage manga-panel"><header><div><span>// СУБЪЕКТ: МИРА</span><b>КАЛИБРОВОЧНЫЙ АКТИВ S-AV-01</b></div><p><small>СОСТОЯНИЕ</small><b>НАСТОРОЖЕНА</b></p></header><img src={hero} alt="Мира на диагностическом столе"/><div className="manga-caption"><small>ТЕКУЩАЯ РЕАКЦИЯ</small><b>Следит за движением руки</b><span>Ожидает следующего действия</span></div><div className="manga-bubble">КОНТАКТ ДОПУСКАЕТСЯ.<br/>ГОТОВА К ДЕЙСТВИЮ.</div></section>
        <ActionPalette/>
      </section>
      <CalibrationAnalytics/>
    </section>
    <ConceptFooter/>
  </main>;
}
