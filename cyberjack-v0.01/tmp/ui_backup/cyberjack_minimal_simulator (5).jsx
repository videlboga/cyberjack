import React, { useMemo, useState } from "react";

/**
 * CyberJack Core Simulator
 *
 * Версия ядра с:
 * - валидацией входов
 * - нормализацией диапазонов
 * - tickMeta для дебага и объяснимости
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

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ensureFiniteNumber(value, fallback, label) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Поле ${label} должно быть числом. Получено: ${value}`);
  }
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAction(action, config = CONFIG) {
  if (!action || typeof action !== "object") {
    throw new Error("action должен быть объектом");
  }

  const normalized = {};
  for (const [key, [min, max]] of Object.entries(config.action.ranges)) {
    const raw = action[key] ?? config.action.defaults[key];
    normalized[key] = clamp(ensureFiniteNumber(raw, config.action.defaults[key], `action.${key}`), min, max);
  }
  return normalized;
}

function normalizeCore(core, config = CONFIG) {
  if (!core || typeof core !== "object") {
    throw new Error("core должен быть объектом");
  }

  const normalized = {};
  for (const key of Object.keys(config.core.defaults)) {
    const raw = core[key] ?? config.core.defaults[key];
    normalized[key] = clamp(ensureFiniteNumber(raw, config.core.defaults[key], `core.${key}`), config.core.min, config.core.max);
  }
  return normalized;
}

function normalizePoint(point, config = CONFIG) {
  if (!point || typeof point !== "object") {
    throw new Error("point должен быть объектом");
  }

  const normalized = {};
  for (const key of Object.keys(config.point.defaults)) {
    const raw = point[key] ?? config.point.defaults[key];
    normalized[key] = clamp(ensureFiniteNumber(raw, config.point.defaults[key], `point.${key}`), config.point.min, config.point.max);
  }
  return normalized;
}

function validateConfig(config) {
  if (!config || typeof config !== "object") {
    throw new Error("config должен быть объектом");
  }
  if (!config.formulas || !config.core || !config.point || !config.action) {
    throw new Error("config неполный: отсутствуют formulas/core/point/action");
  }
  return true;
}

function createDefaultState() {
  return {
    core: { ...CONFIG.core.defaults },
    action: { ...CONFIG.action.defaults },
    point: { ...CONFIG.point.defaults },
  };
}

export function computeResult(action, core, point, config = CONFIG) {
  validateConfig(config);
  const safeAction = normalizeAction(action, config);
  const safeCore = normalizeCore(core, config);
  const safePoint = normalizePoint(point, config);
  const f = config.formulas;

  const effectiveSensitivity = clamp(
    safeCore.sensitivity * f.effectiveSensitivity.globalWeight + safePoint.localSensitivity * f.effectiveSensitivity.localWeight,
    0,
    100
  );

  const effectiveAttitude = clamp(
    safeCore.attitude * f.effectiveAttitude.globalWeight + safePoint.localAttitude * f.effectiveAttitude.localWeight,
    0,
    100
  );

  const attitudeShift = (effectiveAttitude - 50) / 50;
  const attitudePower = Math.sign(attitudeShift) * Math.pow(Math.abs(attitudeShift), f.attitude.shiftPow);

  const experiencedIntensity = clamp(
    safeAction.intensity *
      (f.intensity.baseOffset + Math.pow(effectiveSensitivity / 100, f.intensity.sensitivityPow)) *
      (f.intensity.contactBase + safeAction.contact * f.intensity.contactScale) *
      f.intensity.toPercent,
    0,
    100
  );

  const finalValence = clamp(
    safeAction.valence + attitudePower * f.attitude.shiftMultiplier,
    -1,
    1
  );

  const pleasure = clamp(
    Math.max(0, finalValence) * experiencedIntensity * (f.pleasure.opennessBase + safeCore.openness / f.pleasure.opennessDivisor),
    0,
    100
  );

  const discomfort = clamp(
    Math.max(0, -finalValence) * experiencedIntensity * (f.discomfort.capacityBase - safeCore.capacity / f.discomfort.capacityDivisor),
    0,
    100
  );

  const overload = clamp(
    experiencedIntensity * (safeAction.sharpness + safeAction.contact * f.overload.contactFactor) - safeCore.capacity * f.overload.capacityFactor,
    0,
    100
  );

  const engagement = clamp(
    experiencedIntensity * f.engagement.intensityFactor +
      pleasure * f.engagement.pleasureFactor -
      discomfort * f.engagement.discomfortFactor -
      overload * f.engagement.overloadFactor +
      safeCore.openness * f.engagement.opennessFactor +
      attitudeShift * f.engagement.attitudeFactor,
    0,
    100
  );

  const learningEffect = clamp(
    safeAction.novelty * experiencedIntensity * (f.learning.plasticityBase + safeCore.plasticity / f.learning.plasticityDivisor) -
      overload * f.learning.overloadPenalty,
    0,
    100
  );

  const tickMeta = {
    inputs: {
      action: safeAction,
      core: safeCore,
      point: safePoint,
    },
    derived: {
      effectiveSensitivity,
      effectiveAttitude,
      attitudeShift,
      attitudePower,
    },
    formulas: {
      experiencedIntensity: "intensity * sensitivityCurve * contactCurve",
      finalValence: "baseValence + attitudePower * shiftMultiplier",
      pleasure: "positiveValence * experiencedIntensity * opennessFactor",
      discomfort: "negativeValence * experiencedIntensity * capacityFactor",
      overload: "experiencedIntensity * (sharpness + contactFactor) - capacityFactor",
      engagement: "intensity + pleasure - discomfort - overload + openness + attitude",
      learningEffect: "novelty * intensity * plasticity - overloadPenalty",
    },
  };

  return {
    effectiveSensitivity,
    effectiveAttitude,
    attitudeShift,
    finalValence,
    experiencedIntensity,
    pleasure,
    discomfort,
    overload,
    engagement,
    learningEffect,
    tickMeta,
  };
}

export function applyLearning(core, point, action, result, config = CONFIG) {
  validateConfig(config);
  const safeCore = normalizeCore(core, config);
  const safePoint = normalizePoint(point, config);
  const safeAction = normalizeAction(action, config);
  const f = config.formulas.applyLearning;

  const nextCore = {
    sensitivity: clamp(
      safeCore.sensitivity + (result.experiencedIntensity - f.sensitivityTarget) * f.sensitivityFromIntensity,
      config.core.min,
      config.core.max
    ),
    capacity: clamp(
      safeCore.capacity + (f.capacityTarget - result.overload) * f.capacityFromOverload,
      config.core.min,
      config.core.max
    ),
    openness: clamp(
      safeCore.openness + (result.pleasure - result.discomfort) * f.opennessFromPleasureDiscomfort,
      config.core.min,
      config.core.max
    ),
    plasticity: clamp(
      safeCore.plasticity +
        (result.learningEffect - f.plasticityTarget) * f.plasticityFromLearning -
        result.overload * f.plasticityFromOverload,
      config.core.min,
      config.core.max
    ),
    attitude: clamp(
      safeCore.attitude +
        (result.pleasure - result.discomfort) * f.attitudeFromPleasureDiscomfort -
        result.overload * f.attitudeFromOverload,
      config.core.min,
      config.core.max
    ),
  };

  const nextPoint = {
    localSensitivity: clamp(
      safePoint.localSensitivity + (result.experiencedIntensity - f.localSensitivityTarget) * f.localSensitivityFromIntensity,
      config.point.min,
      config.point.max
    ),
    localAttitude: clamp(
      safePoint.localAttitude +
        (result.pleasure - result.discomfort) * f.localAttitudeFromPleasureDiscomfort -
        safeAction.sharpness * result.overload * f.localAttitudeFromSharpOverload,
      config.point.min,
      config.point.max
    ),
  };

  nextCore.attitude = clamp(
    nextCore.attitude + (nextPoint.localAttitude - safeCore.attitude) * f.localToGlobalLeak,
    config.core.min,
    config.core.max
  );

  nextPoint.localAttitude = clamp(
    nextPoint.localAttitude + (nextCore.attitude - safePoint.localAttitude) * f.globalToLocalLeak,
    config.point.min,
    config.point.max
  );

  return { nextCore, nextPoint };
}

export function runTick({ action, core, point, config = CONFIG }) {
  const result = computeResult(action, core, point, config);
  const { nextCore, nextPoint } = applyLearning(core, point, action, result, config);

  const delta = {
    core: {
      sensitivity: nextCore.sensitivity - core.sensitivity,
      capacity: nextCore.capacity - core.capacity,
      openness: nextCore.openness - core.openness,
      plasticity: nextCore.plasticity - core.plasticity,
      attitude: nextCore.attitude - core.attitude,
    },
    point: {
      localSensitivity: nextPoint.localSensitivity - point.localSensitivity,
      localAttitude: nextPoint.localAttitude - point.localAttitude,
    },
  };

  return {
    result,
    nextCore,
    nextPoint,
    delta,
    tickMeta: result.tickMeta,
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

  const tick = useMemo(() => runTick({ action, core, point, config: CONFIG }), [action, core, point]);
  const interpretation = useMemo(() => buildInterpretation(tick.result), [tick.result]);

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

  function applyTickToState() {
    const log = `→ ${interpretation}\nитоговая валентность: ${tick.result.finalValence.toFixed(2)}\nΔ общее отношение: ${tick.delta.core.attitude.toFixed(1)}\nΔ локальное отношение: ${tick.delta.point.localAttitude.toFixed(1)}\nΔ пластичность: ${tick.delta.core.plasticity.toFixed(1)}`;
    setCore(tick.nextCore);
    setPoint(tick.nextPoint);
    setHistory((prev) => [log, ...prev].slice(0, 12));
  }

  return (
    <div style={{ height: "100vh", background: "#070b12", color: "#e2e8f0", padding: 12, boxSizing: "border-box", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr 360px", gap: 12, height: "100%" }}>
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

          <button onClick={applyTickToState} style={{ width: "100%", marginTop: 8, padding: 10, borderRadius: 8, border: 0, background: "#38bdf8", color: "#082f49", fontWeight: 700, cursor: "pointer" }}>
            Применить тик
          </button>
        </div>

        <div style={{ background: "#0f172a", borderRadius: 12, padding: 12, overflow: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Реакция</h3>
          <Metric label="Сила" value={tick.result.experiencedIntensity} />
          <Metric label="Включённость" value={tick.result.engagement} />
          <Metric label="Удовольствие" value={tick.result.pleasure} />
          <Metric label="Дискомфорт" value={tick.result.discomfort} />
          <Metric label="Перегруз" value={tick.result.overload} />
          <Metric label="Изменение" value={tick.result.learningEffect} />
          <Metric label="Итоговая валентность" value={((tick.result.finalValence + 1) / 2) * 100} raw={tick.result.finalValence.toFixed(2)} />
          <Metric label="Общее отношение" value={core.attitude} />
          <Metric label="Локальное отношение" value={point.localAttitude} />
          <Metric label="Локальная чувствительность" value={point.localSensitivity} />
        </div>

        <div style={{ background: "#0f172a", borderRadius: 12, padding: 12, overflow: "auto" }}>
          <h3 style={{ marginTop: 0 }}>Интерпретация</h3>
          <div style={{ fontSize: 16, lineHeight: 1.5, marginBottom: 16 }}>{interpretation}</div>
          <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 16 }}>
            Есть валидация, нормализация, tickMeta и единый runTick. То есть теперь это уже похоже на ядро, а не на шаманский ритуал с ползунками.
          </div>
          <h3>tickMeta</h3>
          <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", color: "#cbd5e1", background: "#111827", padding: 8, borderRadius: 8 }}>
{JSON.stringify(tick.tickMeta, null, 2)}
          </pre>
          <h3>История</h3>
          {history.length ? history.map((item, i) => (
            <div key={i} style={{ fontSize: 12, whiteSpace: "pre-line", borderTop: "1px solid #1e293b", paddingTop: 8, marginTop: 8 }}>{item}</div>
          )) : <div style={{ fontSize: 12, color: "#64748b" }}>Пока пусто. Нажми «Применить тик».</div>}
        </div>
      </div>
    </div>
  );
}
