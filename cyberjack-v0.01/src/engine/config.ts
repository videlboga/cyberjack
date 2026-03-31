import { EngineConfig } from '../domain/types';

export const DEFAULT_CONFIG: any = 

{ core: {
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
}; // as EngineConfig;

 
