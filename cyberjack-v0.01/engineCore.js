// Ядро движка CyberJack
// Вынесено из симулятора для переиспользования


function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function ensureFiniteNumber(value, fallback, label) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeAction(action, config) {
  const normalized = {};
  for (const [key, [min, max]] of Object.entries(config.action.ranges)) {
    const raw = action[key] ?? config.action.defaults[key];
    normalized[key] = clamp(ensureFiniteNumber(raw, config.action.defaults[key], key), min, max);
  }
  return normalized;
}

function normalizeCore(core, config) {
  const normalized = {};
  for (const key of Object.keys(config.core.defaults)) {
    const raw = core[key] ?? config.core.defaults[key];
    normalized[key] = clamp(ensureFiniteNumber(raw, config.core.defaults[key], key), config.core.min, config.core.max);
  }
  return normalized;
}

function normalizePoint(point, config) {
  const normalized = {};
  for (const key of Object.keys(config.point.defaults)) {
    const raw = point[key] ?? config.point.defaults[key];
    normalized[key] = clamp(ensureFiniteNumber(raw, config.point.defaults[key], key), config.point.min, config.point.max);
  }
  return normalized;
}

function validateConfig(config) {
  if (!config || !config.core || !config.action || !config.point) throw new Error("Invalid config");
}

export function computeResult(action, core, point, config) {
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


export function applyLearning(core, point, action, result, config) {
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

  // мягкое взаимное протекание
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
