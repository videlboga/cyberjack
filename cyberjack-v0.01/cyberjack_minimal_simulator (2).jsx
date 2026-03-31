
import React, { useMemo, useState } from "react";
import { computeResult, applyLearning } from "./engineCore";

/**
 * CyberJack Core Simulator
 *
 * Один файл с:
 * 1) CONFIG — всеми формулами и коэффициентами
 * 2) core engine — расчёт реакции и обучения
 * 3) простым UI для ручного прогона тиков
 *
 * Это не финальная игра. Это ядро, на которое потом можно наращивать:
 * - каталоги действий
 * - точки применения
 * - verbal parser
 * - историю доменов
 * - визуальные и звуковые импакты
 */

const CONFIG = {
  core: {
    defaults: {
      sensitivity: 50,
      capacity: 50,
      openness: 40,
      plasticity: 50,
      attitude: 50,
    },
    min: 0,
    max: 100,
  },

  point: {
    defaults: {
      localSensitivity: 50,
      localAttitude: 50,
    },
    min: 0,
    max: 100,
  },

  action: {
    defaults: {
      intensity: 0.5,
      valence: 0.0,
      contact: 0.5,
      sharpness: 0.5,
      novelty: 0.5,
    },
    ranges: {
      intensity: [0, 1, 0.01],
      valence: [-1, 1, 0.01],
      contact: [0, 1, 0.01],
      sharpness: [0, 1, 0.01],
      novelty: [0, 1, 0.01],
    },
  },

  presets: {
    actions: [
      {
        id: "soft_contact",
        label: "Мягкий контакт",
        values: { intensity: 0.35, valence: 0.45, contact: 0.75, sharpness: 0.15, novelty: 0.25 },
      },
      {
        id: "sharp_aversive",
        label: "Резкое неприятное",
        values: { intensity: 0.75, valence: -0.65, contact: 0.35, sharpness: 0.85, novelty: 0.45 },
      },
      {
        id: "social_pressure",
        label: "Социальное давление",
        values: { intensity: 0.45, valence: -0.15, contact: 0.85, sharpness: 0.4, novelty: 0.35 },
      },
    ],
    points: [
      {
        id: "neutral_zone",
        label: "Нейтральная зона",
        values: { localSensitivity: 50, localAttitude: 50 },
      },
      {
        id: "sensitive_favored",
        label: "Чувствительная и принимаемая",
        values: { localSensitivity: 75, localAttitude: 70 },
      },
      {
        id: "sensitive_rejected",
        label: "Чувствительная и отвергаемая",
        values: { localSensitivity: 75, localAttitude: 25 },
      },
    ],
  },

  // Формулы и коэффициенты движка
  formulas: {
    effectiveSensitivity: {
      globalWeight: 0.65,
      localWeight: 0.35,
    },
    effectiveAttitude: {
      globalWeight: 0.4,
      localWeight: 0.6,
    },
    intensity: {
      baseOffset: 0.3,
      sensitivityPow: 1.2,
      contactBase: 0.6,
      contactScale: 0.8,
      toPercent: 100,
    },
    attitude: {
      shiftMultiplier: 0.8,
      shiftPow: 1.3,
    },
    pleasure: {
      opennessBase: 0.4,
      opennessDivisor: 200,
    },
    discomfort: {
      capacityBase: 1.2,
      capacityDivisor: 200,
    },
    overload: {
      contactFactor: 0.3,
      capacityFactor: 0.6,
    },
    engagement: {
      intensityFactor: 0.25,
      pleasureFactor: 0.45,
      discomfortFactor: 0.28,
      overloadFactor: 0.6,
      opennessFactor: 0.22,
      attitudeFactor: 10,
    },
    learning: {
      plasticityBase: 0.3,
      plasticityDivisor: 100,
      overloadPenalty: 0.5,
    },
    applyLearning: {
      sensitivityFromIntensity: 0.02,
      sensitivityTarget: 50,

      capacityFromOverload: 0.05,
      capacityTarget: 20,

      opennessFromPleasureDiscomfort: 0.03,

      plasticityFromLearning: 0.04,
      plasticityTarget: 20,
      plasticityFromOverload: 0.02,

      attitudeFromPleasureDiscomfort: 0.025,
      attitudeFromOverload: 0.01,

      localSensitivityFromIntensity: 0.025,
      localSensitivityTarget: 45,

      localAttitudeFromPleasureDiscomfort: 0.035,
      localAttitudeFromSharpOverload: 0.01,

      // мягкое взаимное протекание
      localToGlobalLeak: 0.05,
      globalToLocalLeak: 0.03,
    },
  },
};

const LABELS = {
  intensity: "Интенсивность",
  valence: "Базовая валентность",
  contact: "Контактность",
  sharpness: "Резкость",
  novelty: "Новизна",

  sensitivity: "Общая чувствительность",
  capacity: "Ёмкость",
  openness: "Открытость",
  plasticity: "Пластичность",
  attitude: "Общее отношение",

  localSensitivity: "Локальная чувствительность",
  localAttitude: "Локальное отношение",
};



function createDefaultState() {
  return {
    core: { ...CONFIG.core.defaults },
    action: { ...CONFIG.action.defaults },
    point: { ...CONFIG.point.defaults },
  };
}





export function buildInterpretation(result) {
  const parts = [];

  if (result.experiencedIntensity < 20) parts.push("почти не ощущается");
  else if (result.experiencedIntensity < 50) parts.push("ощущается слабо");
  else if (result.experiencedIntensity < 80) parts.push("ощущается заметно");
  else parts.push("ощущается очень сильно");

  if (result.pleasure > result.discomfort) {
    if (result.pleasure > 60) parts.push("и приятно");
    else if (result.pleasure > 20) parts.push("и скорее приятно");
  } else if (result.discomfort > 0) {
    if (result.discomfort > 60) parts.push("и тяжело переносится");
    else parts.push("и скорее неприятно");
  }

  if (result.overload > 40) parts.push("сильный перегруз");
  else if (result.overload > 10) parts.push("лёгкий перегруз");

  if (result.engagement > 60) parts.push("субъект включён");
  else if (result.engagement > 30) parts.push("держится в процессе");
  else parts.push("отстраняется");

  return parts.join(", ");
}

function Slider({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span>{label}</span>
        <span>{typeof value === "number" ? value.toFixed(step < 1 ? 2 : 1) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={onChange} style={{ width: "100%" }} />
    </div>
  );
}

function Metric({ label, value, raw }) {
  const pct = clamp(value, 0, 100);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
        <span>{label}</span>
        <span>{raw ?? value.toFixed(1)}</span>
      </div>
      <div style={{ height: 10, background: "#1e293b", borderRadius: 9999, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#38bdf8" }} />
      </div>
    </div>
  );
}

export default function App() {
  const initial = createDefaultState();
  const [core, setCore] = useState(initial.core);
  const [action, setAction] = useState(initial.action);
  const [point, setPoint] = useState(initial.point);
  const [history, setHistory] = useState([]);
  const [actionPresetId, setActionPresetId] = useState(CONFIG.presets.actions[0].id);
  const [pointPresetId, setPointPresetId] = useState(CONFIG.presets.points[0].id);

  const result = useMemo(() => computeResult(action, core, point, CONFIG), [action, core, point]);
  const interpretation = useMemo(() => buildInterpretation(result), [result]);

  function applyActionPreset(id) {
    const preset = CONFIG.presets.actions.find((p) => p.id === id);
    if (!preset) return;
    setActionPresetId(id);
    setAction({ ...preset.values });
  }

  function applyPointPreset(id) {
    const preset = CONFIG.presets.points.find((p) => p.id === id);
    if (!preset) return;
    setPointPresetId(id);
    setPoint({ ...preset.values });
  }

  function applyTick() {
    const { nextCore, nextPoint } = applyLearning(core, point, action, result, CONFIG);
    const log = `→ ${interpretation}\nитоговая валентность: ${result.finalValence.toFixed(2)}\nΔ общее отношение: ${(nextCore.attitude - core.attitude).toFixed(1)}\nΔ локальное отношение: ${(nextPoint.localAttitude - point.localAttitude).toFixed(1)}\nΔ пластичность: ${(nextCore.plasticity - core.plasticity).toFixed(1)}`;
    setCore(nextCore);
    setPoint(nextPoint);
    setHistory((prev) => [log, ...prev].slice(0, 12));
  }

  return (
    <div style={{ height: "100vh", background: "#070b12", color: "#e2e8f0", padding: 12, boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 320px", gap: 12, height: "100%" }}>
        <div style={{ background: "#0f172a", borderRadius: 12, padding: 12, overflow: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Действие</h3>
          <div style={{ marginBottom: 12 }}>
            <select value={actionPresetId} onChange={(e) => applyActionPreset(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, background: "#1e293b", color: "#e2e8f0", border: 0 }}>
              {CONFIG.presets.actions.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          {Object.entries(action).map(([key, value]) => {
            const [min, max, step] = CONFIG.action.ranges[key];
            return <Slider key={key} label={LABELS[key]} value={value} min={min} max={max} step={step} onChange={(e) => setAction((prev) => ({ ...prev, [key]: Number(e.target.value) }))} />;
          })}

          <h3>Точка</h3>
          <div style={{ marginBottom: 12 }}>
            <select value={pointPresetId} onChange={(e) => applyPointPreset(e.target.value)} style={{ width: "100%", padding: 8, borderRadius: 8, background: "#1e293b", color: "#e2e8f0", border: 0 }}>
              {CONFIG.presets.points.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
          {Object.entries(point).map(([key, value]) => (
            <Slider key={key} label={LABELS[key]} value={value} min={0} max={100} step={1} onChange={(e) => setPoint((prev) => ({ ...prev, [key]: Number(e.target.value) }))} />
          ))}

          <h3>Субъект</h3>
          {Object.entries(core).map(([key, value]) => (
            <Slider key={key} label={LABELS[key]} value={value} min={0} max={100} step={1} onChange={(e) => setCore((prev) => ({ ...prev, [key]: Number(e.target.value) }))} />
          ))}

          <button onClick={applyTick} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, border: 0, background: "#38bdf8", color: "#082f49", fontWeight: 700, cursor: "pointer" }}>
            Применить тик
          </button>
        </div>

        <div style={{ background: "#0f172a", borderRadius: 12, padding: 12, overflow: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Реакция</h3>
          <Metric label="Сила" value={result.experiencedIntensity} />
          <Metric label="Включённость" value={result.engagement} />
          <Metric label="Удовольствие" value={result.pleasure} />
          <Metric label="Дискомфорт" value={result.discomfort} />
          <Metric label="Перегруз" value={result.overload} />
          <Metric label="Изменение" value={result.learningEffect} />
          <Metric label="Итоговая валентность" value={((result.finalValence + 1) / 2) * 100} raw={result.finalValence.toFixed(2)} />
          <Metric label="Общее отношение" value={core.attitude} />
          <Metric label="Локальное отношение" value={point.localAttitude} />
          <Metric label="Локальная чувствительность" value={point.localSensitivity} />
        </div>

        <div style={{ background: "#0f172a", borderRadius: 12, padding: 12, overflow: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Интерпретация</h3>
          <div style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 16 }}>{interpretation}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
            Это голое ядро. Все коэффициенты лежат в CONFIG сверху файла. Наращивать модули теперь уже можно без лоботомии.
          </div>
          <h3>История</h3>
          {history.length ? history.map((item, i) => (
            <div key={i} style={{ fontSize: 12, whiteSpace: "pre-line", borderTop: "1px solid #1e293b", paddingTop: 8, marginTop: 8 }}>{item}</div>
          )) : <div style={{ fontSize: 12, color: "#64748b" }}>Пока пусто. Нажми «Применить тик».</div>}
        </div>
      </div>
    </div>
  );
}
