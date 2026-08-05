import React from 'react';
import { EnduranceLiquid } from './EnduranceLiquid';

const clamp = (value: number) => Math.max(0, Math.min(100, value));

export type CalibrationBiometricsProps = {
  activation: number;
  activationLabel: string;
  capacity: number;
  enduranceLabel: string;
  capacityDelta?: number;
  pulseBpm: number;
  pulsePeriod: number;
  breathingRate: number;
  breathingPeriod: number;
  activationBalance: number;
  currentValence?: number;
  activationNature: string;
  overload: number;
  overloadLabel: string;
  overloadActive?: boolean;
};

export function CalibrationBiometrics({
  activation,
  activationLabel,
  capacity,
  enduranceLabel,
  capacityDelta,
  pulseBpm,
  pulsePeriod,
  breathingRate,
  breathingPeriod,
  activationBalance,
  currentValence,
  activationNature,
  overload,
  overloadLabel,
  overloadActive,
}: CalibrationBiometricsProps) {
  const signedDelta = typeof capacityDelta === 'number'
    ? `${capacityDelta > 0 ? '+' : ''}${capacityDelta.toFixed(1)} за действие`
    : 'без нового замера';
  return <div className="physiology-panel shared-calibration-biometrics">
    <section className={`activation-scale level-${activation >= 85 ? 'edge' : activation >= 70 ? 'high' : 'normal'}`}>
      <header><span>ФИЗИОЛОГИЧЕСКАЯ АКТИВАЦИЯ</span><b>{activationLabel} · {Math.round(activation)}%</b></header>
      <div><i style={{ width: `${clamp(activation)}%` }} /><em style={{ left: `${clamp(activation)}%` }} /></div>
      <footer><span>Спокойствие</span><span>Рабочая</span><span>Предел</span></footer>
      <div className="live-biosignals">
        <section className="pulse-biosignal" style={{ '--signal-period': `${pulsePeriod * 2}s` } as React.CSSProperties}>
          <header><span>ПУЛЬС</span><b>{pulseBpm.toFixed(0)} <i>уд/мин</i></b></header>
          <div className="pulse-cardiogram" aria-hidden="true"><svg viewBox="0 0 180 32" preserveAspectRatio="none"><path className="scope-trace-live" d="M0 18 H24 C29 18 30 14 35 14 C40 14 42 18 47 18 H58 L63 21 L68 5 L74 28 L81 18 H96 C103 18 105 12 113 12 C122 12 126 18 135 18 H180" /></svg></div>
        </section>
        <section className="breathing-biosignal" style={{ '--signal-period': `${breathingPeriod}s` } as React.CSSProperties}>
          <header><span>ДЫХАНИЕ</span><b>{breathingRate.toFixed(0)} <i>вдох/мин</i></b></header>
          <div className="breathing-field" aria-hidden="true"><i /><em /></div>
        </section>
      </div>
    </section>
    <section className="endurance-card" style={{
      '--endurance-angle': `${clamp(capacity) * 3.6}deg`,
      '--balance-position': `${clamp(50 + activationBalance / 2)}%`,
      '--overload-level': `${clamp(overload)}%`,
    } as React.CSSProperties}>
      <div className="endurance-scale">
        <header><span>ВЫНОСЛИВОСТЬ</span><b>{enduranceLabel}</b></header>
        <div className="endurance-liquid-container"><EnduranceLiquid value={capacity} overload={overload} /></div>
        <p><strong>{capacity.toFixed(0)}%</strong><span>{signedDelta}</span></p>
      </div>
      <div className="endurance-infographics">
        <section className="endurance-metric balance-indicator">
          <p><span>Накопленный баланс</span><b>{activationBalance > 0 ? '+' : ''}{activationBalance}</b></p>
          <div className="endurance-metric__track"><i /></div>
          <small>{activationNature}{typeof currentValence === 'number' ? ` · сейчас ${currentValence > 0 ? '+' : ''}${Math.round(currentValence * 100)}` : ''}</small>
        </section>
        {overload > 0 && (
          <section className="endurance-metric overload-indicator">
            <p><span>Перегрузка</span><b>{overload.toFixed(1)}</b></p>
            <small>{overloadLabel}</small>
          </section>
        )}
      </div>
    </section>
  </div>;
}

export type CalibrationTrend = {
  key: string;
  label: string;
  value: number;
  displayValue?: string;
  detail?: string;
  baseline?: number;
  history: number[];
  tone: 'mint' | 'blue' | 'amber' | 'violet';
};

type TrendInstrumentProps = Pick<CalibrationTrend, 'label' | 'value' | 'baseline' | 'history' | 'tone'> & {
  metricKey: string;
};

export function CalibrationTrendInstrument({ metricKey: metric, label, value, baseline, history, tone }: TrendInstrumentProps) {
  const source = history.length > 1 ? history : [history[0] || value || 0, history[0] || value || 0];
  const latest = source[source.length - 1];
  const scaleMax = Math.max(100, Math.ceil(Math.max(value, baseline || 0, ...source) / 50) * 50);
  const level = clamp(latest / scaleMax * 100);
  const currentX = 8 + level * .84;
  const normX = 8 + clamp(50 / scaleMax * 100) * .84;
  const opening = 8 + level * .68;
  const bend = 28 - level * .46;
  const pulse = 8 + level * .34;
  const historySummary = source.slice(-8).map(point => Math.round(point)).join(' → ');

  return <svg className={`trend-lane-chart trend-instrument ${tone} metric-${metric}`} viewBox="0 0 100 100" preserveAspectRatio="none" aria-label={`История: ${label}`}>
    <title>{`${label}: ${historySummary}. Общая норма: индекс 50.`}</title>
    <line className="indicator-norm" x1={normX} x2={normX} y1="14" y2="88" />
    {metric === 'attitude' && <>
      <line className="indicator-track" x1="8" x2="92" y1="52" y2="52" />
      <line className="acceptance-negative" x1="8" x2={normX} y1="52" y2="52" />
      <line className="acceptance-positive" x1={normX} x2={currentX} y1="52" y2="52" />
      <path className="acceptance-chevron" d={`M${currentX - 3} 35 L${currentX + 2} 52 L${currentX - 3} 69`} />
      <circle className="indicator-current" cx={currentX} cy="52" r="4" />
    </>}
    {metric === 'openness' && <>
      <rect className="openness-frame" x="8" y="25" width="84" height="54" rx="2" />
      <rect className="openness-opening" x={50 - opening / 2} y="31" width={opening} height="42" rx="2" />
      <line className="openness-center" x1="50" x2="50" y1="35" y2="69" />
    </>}
    {metric === 'plasticity' && <>
      <path className="plasticity-shadow" d={`M7 65 Q50 ${bend + 8} 93 65`} />
      <path className="plasticity-ribbon" d={`M7 57 Q50 ${bend} 93 57`} />
      <circle className="plasticity-anchor" cx="7" cy="57" r="3" />
      <circle className="plasticity-anchor" cx="93" cy="57" r="3" />
      <circle className="indicator-current" cx="50" cy={bend} r="4" />
    </>}
    {metric === 'sensitivity' && <>
      <line className="indicator-track" x1="6" x2="94" y1="56" y2="56" />
      <path className="sensitivity-pulse" d={`M6 56 H27 L34 ${56 - pulse * .35} L41 ${56 + pulse * .18} L50 ${56 - pulse} L59 ${56 + pulse * .42} L67 56 H94`} />
      <circle className="indicator-current" cx="50" cy={56 - pulse} r="3.5" />
    </>}
  </svg>;
}

export function CalibrationStateTrends({ trends }: { trends: CalibrationTrend[] }) {
  return <section className="state-trends unified-state-trends shared-calibration-state-trends">
    {trends.map(trend => {
      const latest = trend.history.length ? trend.history[trend.history.length - 1] : trend.value;
      const previous = trend.history.length > 1 ? trend.history[trend.history.length - 2] : latest;
      const delta = latest - previous;
      const normRatio = latest / 50;
      const reading = trend.key === 'attitude'
        ? latest >= 70 ? 'устойчивое принятие' : latest >= 45 ? 'нейтрально' : 'сопротивление'
        : normRatio >= 2 ? 'экстремальный разгон'
          : normRatio >= 1.35 ? 'выше нормы'
            : normRatio >= .85 ? 'в пределах нормы'
              : normRatio >= .55 ? 'ниже нормы'
                : 'низкий уровень';
      return <article className={`metric-${trend.key}`} key={trend.key}>
        <header className={`trend-lane-label ${trend.tone}`}><span>{trend.label}</span><b title={trend.detail}>{trend.displayValue || trend.value.toFixed(0)}</b></header>
        <CalibrationTrendInstrument metricKey={trend.key} {...trend} />
        <footer className="capsule-trend-reading">
          <span>{reading}</span>
          <small>индекс {Math.round(latest)}</small>
          {Math.abs(delta) >= .01 && <em>{delta > 0 ? '+' : ''}{delta.toFixed(1)}</em>}
        </footer>
      </article>;
    })}
  </section>;
}
