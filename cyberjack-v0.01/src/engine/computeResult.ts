// src/engine/computeResult.ts

import { CompiledAction, SubjectCoreState, SubjectPointState, EngineConfig, TickResult, TickMeta } from '../domain/types';
import { validateConfig } from './validate';
import { normalizeAction, normalizeCore, normalizePoint } from './normalize';
import { clamp } from './utils';
import { DEFAULT_CONFIG } from './config';

export function computeResult(
    action: Partial<CompiledAction>,
    core: Partial<SubjectCoreState>,
    point: Partial<SubjectPointState>,
    config: EngineConfig = DEFAULT_CONFIG
): { result: TickResult; tickMeta: TickMeta } {
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

    const overload = clamp(
        experiencedIntensity * (safeAction.sharpness + safeAction.contact * f.overload.contactFactor) - safeCore.capacity * f.overload.capacityFactor,
        0,
        100
    );

    // Valence describes the emotional sign of an action, not the complete
    // physiology. A positively perceived action may still be sharp, exceed
    // the subject's comfortable load, or cause overload. Keeping these
    // components separate allows pleasure and discomfort to coexist.
    const emotionalDiscomfort = clamp(
        Math.max(0, -finalValence) * experiencedIntensity * (f.discomfort.capacityBase - safeCore.capacity / f.discomfort.capacityDivisor),
        0,
        100
    );
    const physicalCfg = f.physicalDiscomfort || {};
    const comfortThreshold = clamp(
        (physicalCfg.comfortBase ?? 15) +
        safeCore.capacity * (physicalCfg.capacityComfortFactor ?? 0.25) +
        effectiveAttitude * (physicalCfg.attitudeComfortFactor ?? 0.05),
        0,
        100
    );
    const physicalVulnerability = clamp(1.4 - safeCore.capacity * 0.008, 0.6, 1.4);
    const sharpDiscomfort = experiencedIntensity * safeAction.sharpness *
        (physicalCfg.sharpnessRate ?? 0.18) * physicalVulnerability;
    const strainDiscomfort = Math.max(0, experiencedIntensity - comfortThreshold) *
        (physicalCfg.strainRate ?? 0.35) * physicalVulnerability;
    const overloadDiscomfort = overload * (physicalCfg.overloadRate ?? 0.25);
    const physicalDiscomfort = sharpDiscomfort + strainDiscomfort + overloadDiscomfort;
    const discomfort = clamp(emotionalDiscomfort + physicalDiscomfort, 0, 100);

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
            comfortThreshold,
            emotionalDiscomfort,
            sharpDiscomfort,
            strainDiscomfort,
            overloadDiscomfort,
            physicalDiscomfort,
        },
    };

    const result: TickResult = {
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
    };

    return { result, tickMeta };
}
