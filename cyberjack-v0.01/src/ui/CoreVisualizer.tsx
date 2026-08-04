import React, { useMemo, useState } from 'react';
import { runTick } from '../engine/runTick';
import { computeNovelty } from '../compiler/noveltyService';
import type { CompiledAction, SubjectCoreState, SubjectPointState } from '../domain/types';
import './CoreVisualizer.css';

const PRESETS: Record<string, { label: string; vector: Pick<CompiledAction, 'intensity' | 'valence' | 'contact' | 'sharpness' | 'novelty'> }> = {
  feather_stroke: { label: 'Провести пером', vector: { intensity: .1, valence: .5, contact: .1, sharpness: 0, novelty: .7 } },
  gentle_stroke: { label: 'Мягко погладить', vector: { intensity: .2, valence: .6, contact: .4, sharpness: .1, novelty: .2 } },
  deep_massage: { label: 'Массаж', vector: { intensity: .6, valence: .8, contact: .9, sharpness: .1, novelty: .3 } },
  ice_cube: { label: 'Приложить лёд', vector: { intensity: .6, valence: .1, contact: .4, sharpness: .6, novelty: .8 } },
  needle_prick: { label: 'Укол иглой', vector: { intensity: .4, valence: -.7, contact: .1, sharpness: 1, novelty: .6 } },
  hard_slap: { label: 'Сильный удар ладонью', vector: { intensity: .8, valence: -.6, contact: .8, sharpness: .8, novelty: .5 } },
};

const initialCore: SubjectCoreState = {
  sensitivity: 55, capacity: 60, openness: 50, plasticity: 60, attitude: 50, tension: 0,
  baselineSensitivity: 55, baselineCapacity: 60, baselineOpenness: 50,
  baselinePlasticity: 60, baselineAttitude: 50,
};
const initialPoint: SubjectPointState = {
  pointId: 'test_zone', localSensitivity: 55, localAttitude: 50, localOpenness: 50,
  familiarity: 0, exposureCount: 0, baselineLocalSensitivity: 55,
  baselineLocalAttitude: 50, baselineLocalOpenness: 50,
};
const actionLabels: Record<string, string> = { intensity: 'Сила', valence: 'Знак воздействия', contact: 'Контакт', sharpness: 'Резкость', novelty: 'Новизна' };
const coreLabels: Record<string, string> = { sensitivity: 'Общая чувствительность', capacity: 'Выносливость', openness: 'Открытость', plasticity: 'Пластичность', attitude: 'Отношение', tension: 'Напряжение', baselineSensitivity: 'Базовая чувствительность', baselineCapacity: 'Базовая выносливость', baselineOpenness: 'Базовая открытость', baselinePlasticity: 'Базовая пластичность', baselineAttitude: 'Базовое отношение' };
const resultLabels: Record<string, string> = { experiencedIntensity: 'Испытанная интенсивность', pleasure: 'Позитивная реакция', discomfort: 'Дискомфорт', overload: 'Перегрузка', engagement: 'Вовлечённость', learningEffect: 'Обучение' };

function Slider({ label, value, min = 0, max = 100, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (n: number) => void }) {
  const commit = (raw: string) => onChange(Math.min(max, Math.max(min, Number(raw) || 0)));
  return <label className="viz-slider"><span>{label}<input aria-label={`${label}: точное значение`} type="number" min={min} max={max} step={step} value={value} onChange={e => commit(e.target.value)}/></span><input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))}/></label>;
}

function Meter({ label, value, signed = false }: { label: string; value: number; signed?: boolean }) {
  const width = signed ? Math.min(100, Math.abs(value) * 12) : Math.min(100, Math.max(0, value));
  return <div className="viz-meter"><span>{label}</span><div><i className={signed ? value > .03 ? 'positive' : value < -.03 ? 'negative' : 'neutral' : ''} style={{ width: `${width}%` }}/></div><b>{signed ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}` : value.toFixed(1)}</b></div>;
}

export function CoreVisualizer() {
  const [preset, setPreset] = useState('gentle_stroke');
  const [core, setCore] = useState<SubjectCoreState>(initialCore);
  const [point, setPoint] = useState<SubjectPointState>(initialPoint);
  const [vector, setVector] = useState(PRESETS.gentle_stroke.vector);
  const [deltaTime, setDeltaTime] = useState(1);
  const [history, setHistory] = useState<string[]>([]);
  const rawAction: CompiledAction = { actionKey: preset, label: PRESETS[preset].label, type: 'physical', tags: [], ...vector };
  const effectiveNovelty = computeNovelty(rawAction, history.map(actionKey => ({ actionKey })), point.familiarity ?? 0);
  const action: CompiledAction = { ...rawAction, novelty: effectiveNovelty };
  const output = useMemo(() => runTick({ subjectId: 'visualizer', pointId: point.pointId, action, core, point, deltaTime }), [core, point, vector, preset, deltaTime]);

  const choosePreset = (id: string) => { setPreset(id); setVector({ ...PRESETS[id].vector }); };
  const setCoreValue = (key: keyof SubjectCoreState, value: number) => setCore(s => ({ ...s, [key]: value }));
  const setPointValue = (key: keyof SubjectPointState, value: number) => setPoint(s => ({ ...s, [key]: value }));
  const setVectorValue = (key: keyof typeof vector, value: number) => setVector(s => ({ ...s, [key]: value }));
  const d = output.tickMeta.derived;
  const discomfortParts = d as typeof d & { emotionalDiscomfort?: number; sharpDiscomfort?: number; strainDiscomfort?: number; overloadDiscomfort?: number; comfortThreshold?: number };
  const applyTick = () => { setCore(output.nextCore); setPoint(output.nextPoint); setHistory(items => [preset, ...items].slice(0, 20)); };

  return <main className="core-viz">
    <header className="viz-header"><div><p>CYBERJACK / CORE LAB</p><h1>Интерактивная модель одного тика</h1><span>Меняйте действие и полное состояние. Применяйте результат, чтобы исследовать последовательности.</span></div><div className="viz-header-actions"><button className="primary" onClick={applyTick}>Применить тик</button><button onClick={() => { setCore(initialCore); setPoint(initialPoint); setDeltaTime(1); setHistory([]); choosePreset('gentle_stroke'); }}>Сбросить</button></div></header>

    <section className="viz-flow" aria-label="Поток вычисления"><span>1. Действие</span><i>→</i><span>2. Восприятие</span><i>→</i><span>3. Реакция</span><i>→</i><span>4. Обучение</span></section>

    <div className="viz-grid">
      <section className="viz-card action-card"><h2>1. Конкретное действие</h2><select value={preset} onChange={e => choosePreset(e.target.value)}>{Object.entries(PRESETS).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}</select>{(Object.keys(vector) as (keyof typeof vector)[]).map(key => <Slider key={key} label={actionLabels[key]} value={vector[key]} min={key === 'valence' ? -1 : 0} max={1} step={.01} onChange={n => setVectorValue(key, n)}/>)}<div className="viz-note">Эффективная новизна: <b>{effectiveNovelty.toFixed(2)}</b>. Повторение и привычность зоны снижают её; смена действия частично восстанавливает.</div><h3>Время</h3><Slider label="Длительность тика" value={deltaTime} min={.1} max={20} step={.1} onChange={setDeltaTime}/></section>

      <section className="viz-card state-card"><h2>2. Скрытое состояние</h2><h3>Глобально · текущее</h3>{(['sensitivity','capacity','openness','plasticity','attitude','tension'] as const).map(key => <Slider key={key} label={coreLabels[key]} value={core[key]} onChange={n => setCoreValue(key, n)}/>)}<h3>Глобально · baseline</h3>{(['baselineSensitivity','baselineCapacity','baselineOpenness','baselinePlasticity','baselineAttitude'] as const).map(key => <Slider key={key} label={coreLabels[key]} value={core[key] ?? 0} onChange={n => setCoreValue(key, n)}/>)}<h3>Зона · текущее</h3><Slider label="Локальная чувствительность" value={point.localSensitivity} onChange={n => setPointValue('localSensitivity', n)}/><Slider label="Локальное отношение" value={point.localAttitude} onChange={n => setPointValue('localAttitude', n)}/><Slider label="Локальная открытость" value={point.localOpenness ?? 0} onChange={n => setPointValue('localOpenness', n)}/><Slider label="Привычность" value={point.familiarity ?? 0} onChange={n => setPointValue('familiarity', n)}/><Slider label="Число воздействий" value={point.exposureCount ?? 0} max={1000} onChange={n => setPointValue('exposureCount', n)}/><h3>Зона · baseline</h3><Slider label="Базовая локальная чувствительность" value={point.baselineLocalSensitivity ?? 0} onChange={n => setPointValue('baselineLocalSensitivity', n)}/><Slider label="Базовое локальное отношение" value={point.baselineLocalAttitude ?? 0} onChange={n => setPointValue('baselineLocalAttitude', n)}/><Slider label="Базовая локальная открытость" value={point.baselineLocalOpenness ?? 0} onChange={n => setPointValue('baselineLocalOpenness', n)}/></section>

      <section className="viz-card reaction-card"><h2>3. Субъективная реакция</h2>{(Object.keys(resultLabels) as (keyof typeof resultLabels)[]).map(key => <Meter key={key} label={resultLabels[key]} value={Number(output.result[key])}/>)}<div className="viz-explanation"><p><b>Эффективная чувствительность {d.effectiveSensitivity.toFixed(1)}</b><br/>65% глобальной + 35% локальной.</p><p><b>Эффективное отношение {d.effectiveAttitude.toFixed(1)}</b><br/>40% глобального + 60% локального; оно смещает валентность действия до {output.result.finalValence.toFixed(2)}.</p><p><b>Физический комфорт до {discomfortParts.comfortThreshold?.toFixed(1)}</b><br/>Дискомфорт: эмоциональный {discomfortParts.emotionalDiscomfort?.toFixed(1)}, резкость {discomfortParts.sharpDiscomfort?.toFixed(1)}, чрезмерная сила {discomfortParts.strainDiscomfort?.toFixed(1)}, перегрузка {discomfortParts.overloadDiscomfort?.toFixed(1)}.</p><p><b>Перегрузка</b><br/>Растёт от испытанной силы, резкости и контакта; выносливость её поглощает.</p></div></section>

      <section className="viz-card learning-card"><h2>4. Изменение после тика</h2><h3>Глобальное состояние</h3>{(['sensitivity','capacity','openness','plasticity','attitude','tension'] as const).map(key => <Meter key={key} label={coreLabels[key]} value={Number(output.delta.core[key] || 0)} signed/>)}<h3>Состояние зоны</h3><Meter label="Локальная чувствительность" value={Number(output.delta.point.localSensitivity || 0)} signed/><Meter label="Локальное отношение" value={Number(output.delta.point.localAttitude || 0)} signed/><Meter label="Локальная открытость" value={Number(output.delta.point.localOpenness || 0)} signed/><Meter label="Привычность" value={Number(output.delta.point.familiarity || 0)} signed/><div className="viz-note">Положительная реакция повышает отношение и открытость. Сильное ощущение адаптирует чувствительность. Новизна и пластичность усиливают обучение; перегрузка его подавляет.</div></section>
    </div>
  </main>;
}
