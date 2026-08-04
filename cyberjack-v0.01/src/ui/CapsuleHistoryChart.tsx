import React, { useMemo, useState } from 'react';

export type CapsuleHistoryPoint = {
  at: number;
  activation: number;
  endurance: number;
  balance: number;
  strain: number;
  actions?: string[];
};

const clamp = (value: number) => Math.max(0, Math.min(100, Number(value || 0)));
type CapsuleMetric = keyof Omit<CapsuleHistoryPoint, 'at' | 'actions'>;
const colors: Record<CapsuleMetric, string> = {
  activation: 'var(--ji-chart-warm)',
  endurance: 'var(--ji-lcd)',
  balance: 'var(--ji-chart-alt)',
  strain: 'var(--ji-chart-violet)',
};
const labels: Record<CapsuleMetric, string> = {
  activation: 'Активация',
  endurance: 'Выносливость',
  balance: 'Баланс',
  strain: 'Напряжение',
};
const formatGameMinute = (totalMinutes: number) => {
  const dayIndex = Math.floor(Math.max(0, totalMinutes) / 1440);
  const year = 17349 + Math.floor(dayIndex / 360);
  const dayOfYear = dayIndex % 360;
  const month = Math.floor(dayOfYear / 30);
  const day = dayOfYear % 30 + 1;
  const minuteOfDay = Math.floor(Math.max(0, totalMinutes)) % 1440;
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${String(day).padStart(2, '0')} ${months[month]} ${year} · ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
};

export function CapsuleHistoryChart({ points, baselineCapacity }: {
  points: CapsuleHistoryPoint[];
  baselineCapacity: number;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const [range, setRange] = useState<60 | 360 | 1440 | 'all'>(360);
  const shown = useMemo(() => {
    if (!points.length || range === 'all') return points;
    const latest = points[points.length - 1].at;
    const inWindow = points.filter(point => point.at >= latest - range);
    return inWindow.length > 1 ? inWindow : points.slice(-2);
  }, [points, range]);
  const source = shown.length > 1 ? shown : [shown[0], shown[0]].filter(Boolean) as CapsuleHistoryPoint[];
  const timeStart = source[0]?.at || 0;
  const timeEnd = source[source.length - 1]?.at || timeStart + 1;
  const positionFor = (index: number) => Math.max(0, Math.min(100,
    ((source[index]?.at || timeStart) - timeStart) / Math.max(1, timeEnd - timeStart) * 100
  ));
  const metricRange = (key: CapsuleMetric) => {
    const values = source.map(point => clamp(point[key]));
    const actualMin = Math.min(...values);
    const actualMax = Math.max(...values);
    const spread = actualMax - actualMin;
    const stable = spread < .75;
    const padding = stable ? 2 : Math.max(1.5, spread * .16);
    return {
      min: Math.max(0, Math.floor(actualMin - padding)),
      max: Math.min(100, Math.ceil(actualMax + padding)),
      stable,
    };
  };
  const ranges = Object.fromEntries((['activation', 'endurance', 'balance', 'strain'] as const)
    .map(key => [key, metricRange(key)])) as Record<CapsuleMetric, ReturnType<typeof metricRange>>;
  const pathFor = (key: CapsuleMetric) => {
    const bounds = ranges[key];
    return source.map((point, index) =>
      `${positionFor(index)},${((bounds.max - clamp(point[key])) / Math.max(1, bounds.max - bounds.min)) * 100}`
    ).join(' ');
  };
  const hoverPoint = hovered === null ? null : source[hovered];
  const onMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const targetAt = timeStart + Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)) * (timeEnd - timeStart);
    let closest = 0;
    source.forEach((point, index) => {
      if (Math.abs(point.at - targetAt) < Math.abs(source[closest].at - targetAt)) closest = index;
    });
    setHovered(closest);
  };
  const outcomeFor = (point: CapsuleHistoryPoint) => {
    const actions = point.actions || [];
    if (actions.some(label => /оргазм/i.test(label))) return 'ОРГАЗМ';
    if (actions.some(label => /нервн.*срыв|срыв/i.test(label))) return 'НЕРВНЫЙ СРЫВ';
    if (actions.some(label => /перегруз/i.test(label))) return 'ПЕРЕГРУЗКА';
    if (actions.some(label => /истощен/i.test(label))) return 'ИСТОЩЕНИЕ';
    return '';
  };
  const outcomeMarkers = source.flatMap((point, index) => {
    const outcome = outcomeFor(point);
    const previous = index > 0 ? outcomeFor(source[index - 1]) : '';
    return outcome && outcome !== previous ? [{ index, label: outcome, value: Math.max(point.activation, point.strain) }] : [];
  });
  const isPose = (label: string) => /поза|четверень|колен|л[её]жа|сидя|стоит|широко раскрыт/i.test(label);
  const isProcess = (label: string) =>
    /(секс|стимуляц|вибрац|фрикц|проникнов)/i.test(label) && !/(заверш[её]н|останов)/i.test(label);
  const processAt = (point: CapsuleHistoryPoint) => point.actions?.find(isProcess);
  const riskReason = (point: CapsuleHistoryPoint) => {
    if (point.activation >= 85 && point.endurance <= 25) return 'Предельная активация · ресурс истощён';
    if (point.activation >= 85) return 'Предельная активация';
    if (point.strain >= 55) return 'Нагрузка выше доступного ресурса';
    return '';
  };
  const runsFor = (predicate: (point: CapsuleHistoryPoint) => boolean, labelFor: (point: CapsuleHistoryPoint) => string) => {
    const runs: Array<{ start: number; end: number; label: string }> = [];
    source.forEach((point, index) => {
      if (!predicate(point)) return;
      const label = labelFor(point);
      const last = runs[runs.length - 1];
      if (last && last.end === index - 1 && last.label === label) last.end = index;
      else runs.push({ start: index, end: index, label });
    });
    return runs;
  };
  const processRuns = runsFor(point => Boolean(processAt(point)), point => processAt(point) || '');
  const riskRuns = runsFor(point => Boolean(riskReason(point)), riskReason);
  const poseChanges = source.flatMap((point, index) => {
    const pose = point.actions?.find(isPose);
    const previous = index > 0 ? source[index - 1].actions?.find(isPose) : undefined;
    return pose && pose !== previous ? [{ index, label: pose.replace(/^Поза:\s*/i, '') }] : [];
  });
  const actionTicks = source.flatMap((point, index) => {
    const previous = index > 0 ? source[index - 1].actions || [] : [];
    return (point.actions || [])
      .filter(label => !isPose(label) && !isProcess(label) && label !== 'Ожидание' && label !== 'Фоновый замер состояния')
      .filter(label => !/оргазм|перегруз|срыв|истощен/i.test(label))
      .filter(label => !previous.includes(label))
      .map(label => ({ index, label }));
  });
  const strongActionTicks = actionTicks.filter(action => {
    if (action.index <= 0) return false;
    const point = source[action.index];
    const previous = source[action.index - 1];
    return (['activation', 'endurance', 'balance', 'strain'] as const)
      .some(metric => Math.abs(point[metric] - previous[metric]) >= 18);
  });
  type AnnotationKind = 'process' | 'action' | 'pose' | 'risk' | 'outcome';
  const rawAnnotations: Array<{ anchor: number; label: string; kind: AnnotationKind; priority: number }> = [
    ...outcomeMarkers.map(item => ({ anchor: positionFor(item.index), label: item.label, kind: 'outcome' as const, priority: 0 })),
    ...riskRuns.map(item => ({ anchor: positionFor(item.start), label: `РИСК · ${item.label}`, kind: 'risk' as const, priority: 1 })),
    ...processRuns.map(item => ({ anchor: positionFor(item.start), label: item.label, kind: 'process' as const, priority: 2 })),
    ...poseChanges.map(item => ({ anchor: positionFor(item.index), label: item.label, kind: 'pose' as const, priority: 3 })),
    ...strongActionTicks.map(item => ({ anchor: positionFor(item.index), label: item.label, kind: 'action' as const, priority: 4 })),
  ];
  const occupiedLanes: Array<Array<{ start: number; end: number }>> = [];
  const annotations = rawAnnotations
    .sort((left, right) => left.priority - right.priority || left.anchor - right.anchor)
    .map(annotation => {
      const width = Math.min(38, Math.max(11, annotation.label.length * 1.1 + 4));
      const edgeRight = annotation.anchor > 72;
      const start = Math.max(0, Math.min(100 - width, edgeRight ? annotation.anchor - width : annotation.anchor));
      const end = start + width;
      let lane = occupiedLanes.findIndex(intervals =>
        intervals.every(interval => end + 3 <= interval.start || start >= interval.end + 3));
      if (lane < 0) {
        lane = occupiedLanes.length;
        occupiedLanes.push([]);
      }
      occupiedLanes[lane].push({ start, end });
      return { ...annotation, edgeRight, lane };
    });
  return <section className="capsule-history-chart">
    <header>
      <div><strong>ДОЛГОВРЕМЕННАЯ ДИНАМИКА</strong><small>{source.length} замеров · игровое время</small></div>
      <nav>{([60, 360, 1440, 'all'] as const).map(value => <button className={range === value ? 'active' : ''} key={value} onClick={() => setRange(value)}>{value === 'all' ? 'всё' : value === 60 ? '1 ч' : value === 360 ? '6 ч' : '24 ч'}</button>)}</nav>
    </header>
    <div className="capsule-history-event-legend" aria-label="Обозначения событий">
      <span><i className="key-process" />Процесс</span>
      <span><i className="key-action" />Действие</span>
      <span><i className="key-pose">АБВ</i>Поза</span>
      <span><i className="key-peak">✦</i>Исход</span>
      <span><i className="key-risk" />Риск</span>
    </div>
    <div className="capsule-history-lanes" onMouseLeave={() => setHovered(null)}>
      <div className="capsule-history-events" aria-hidden="true">
        {riskRuns.map((run, index) => <React.Fragment key={`risk-${index}`}>
          <i className="history-risk-zone" style={{
            left: `${positionFor(run.start)}%`,
            width: `${Math.max(1.2, positionFor(run.end) - positionFor(run.start))}%`,
          }} />
        </React.Fragment>)}
        {processRuns.map((run, index) => <span className={`history-process-band ${run.end === source.length - 1 ? 'is-active' : 'is-complete'}`} title={`${run.label}: ${run.end === source.length - 1 ? 'продолжается' : 'завершено'}`} key={`process-${index}`} style={{
          left: `${positionFor(run.start)}%`,
          width: `${Math.max(1.5, positionFor(run.end) - positionFor(run.start))}%`,
          top: '2px',
        }} />)}
        {actionTicks.map((action, index) => <span className="history-action-marker tick-only" title={action.label} key={`action-${action.index}-${index}`} style={{
          left: `${positionFor(action.index)}%`,
          top: '2px',
        }}><i /></span>)}
        {outcomeMarkers.map(outcome => <span className={`history-peak-burst ${positionFor(outcome.index) > 82 ? 'edge-right' : ''}`} key={`outcome-${outcome.index}`} style={{
          left: `${positionFor(outcome.index)}%`,
          top: `${Math.max(2, (100 - outcome.value) * .48)}%`,
        }}><i>✦</i></span>)}
        {annotations.map((annotation, index) => <span
          className={`history-auto-label ${annotation.kind} ${annotation.edgeRight ? 'edge-right' : ''}`}
          key={`annotation-${annotation.kind}-${index}`}
          style={{ left: `${annotation.anchor}%`, top: `${4 + annotation.lane * 17}px` }}
        >{annotation.label}</span>)}
      </div>
      {(['activation', 'endurance', 'balance', 'strain'] as const).map(key => {
        const bounds = ranges[key];
        const latest = clamp(source[source.length - 1]?.[key] || 0);
        const previous = clamp(source[Math.max(0, source.length - 2)]?.[key] || latest);
        const delta = latest - previous;
        const baselineY = key === 'endurance'
          ? ((bounds.max - clamp(baselineCapacity)) / Math.max(1, bounds.max - bounds.min)) * 100
          : null;
        return <article className={`capsule-history-track ${bounds.stable ? 'is-stable' : ''}`} key={key}>
          <header>
            <span><i style={{ background: colors[key] }} />{labels[key]}</span>
            <small>{bounds.min}–{bounds.max}</small>
            <b>{latest.toFixed(0)} <em>{bounds.stable ? '→' : delta > .15 ? '↑' : delta < -.15 ? '↓' : '→'}</em></b>
          </header>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" onMouseMove={onMove}>
            <line className="grid" x1="0" x2="100" y1="50" y2="50" />
            {baselineY !== null && baselineY >= 0 && baselineY <= 100 && <line className="baseline capacity" x1="0" x2="100" y1={baselineY} y2={baselineY} />}
            <polyline points={pathFor(key)} style={{ stroke: colors[key] }} />
            {hovered !== null && <line className="cursor" x1={positionFor(hovered)} x2={positionFor(hovered)} y1="0" y2="100" />}
          </svg>
        </article>;
      })}
      {source.length > 0 && <div className="capsule-history-time-axis" aria-hidden="true">
        <time>{formatGameMinute(timeStart)}</time>
        <time>{formatGameMinute(timeEnd)}</time>
      </div>}
      {hoverPoint && <aside className="capsule-history-tooltip" style={{ left: `${Math.min(76, positionFor(Number(hovered)))}%` }}>
        <time>{formatGameMinute(hoverPoint.at)}</time>
        {(['activation', 'endurance', 'balance', 'strain'] as const).map(key => <span key={key}>{labels[key]} <b>{clamp(hoverPoint[key]).toFixed(0)}</b></span>)}
        {riskReason(hoverPoint) && <strong className="capsule-history-risk-reason">РИСК: {riskReason(hoverPoint)}</strong>}
        <div className="capsule-history-influences">
          {(hoverPoint.actions?.length ? hoverPoint.actions : ['Фоновый замер состояния'])
            .map((action, index) => <small key={`${action}-${index}`}>{action}</small>)}
        </div>
      </aside>}
    </div>
  </section>;
}
