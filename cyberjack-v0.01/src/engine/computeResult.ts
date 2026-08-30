// src/engine/computeResult.ts

import { CompiledAction, SubjectCoreState, SubjectPointState, EngineConfig, TickResult, TickMeta, CharacterRelation } from '../domain/types';
import { validateConfig } from './validate';
import { normalizeAction, normalizeCore, normalizePoint } from './normalize';
import { clamp, softMechanicalScale } from './utils';
import { DEFAULT_CONFIG } from './config';
import { HUMAN_CORE_NORMS, humanPointSensitivityNorm } from '../domain/parameterInterpretation';

export function computeResult(
    action: Partial<CompiledAction>,
    core: Partial<SubjectCoreState>,
    point: Partial<SubjectPointState>,
    config: EngineConfig = DEFAULT_CONFIG,
    relationship?: Pick<CharacterRelation, 'attitude' | 'openness' | 'plasticity' | 'familiarityLevel'>,
    edgeHoldMinutes: number = 0,
): { result: TickResult; tickMeta: TickMeta } {
    validateConfig(config);
    const safeAction = normalizeAction(action, config);
    const safeCore = normalizeCore(core, config);
    const safePoint = normalizePoint(point, config);
    const f = config.formulas;

    const rawEffectiveSensitivity =
        safeCore.sensitivity * f.effectiveSensitivity.globalWeight + safePoint.localSensitivity * f.effectiveSensitivity.localWeight;
    const effectiveSensitivity = softMechanicalScale(rawEffectiveSensitivity);
    const physicalSensoryAmplification =
        safeCore.sensitivity / HUMAN_CORE_NORMS.sensitivity * f.effectiveSensitivity.globalWeight +
        safePoint.localSensitivity / humanPointSensitivityNorm(safePoint.pointId) * f.effectiveSensitivity.localWeight;
    const isVerbalAction = safeAction.actionKey === 'verbal_pressure' || safeAction.tags.includes('mental');
    const isIntimateAction = !isVerbalAction && (
        safeAction.tags.some(tag => ['sexual', 'intimate', 'penetration', 'oral'].includes(tag)) ||
        ['vulva', 'vagina', 'clitoris', 'penis', 'testicles', 'prostate', 'anus'].includes(safePoint.pointId)
    );
    const sensoryAmplification = isVerbalAction ? 1 : physicalSensoryAmplification;

    const effectiveAttitude = clamp(
        safeCore.attitude * f.effectiveAttitude.globalWeight + safePoint.localAttitude * f.effectiveAttitude.localWeight,
        0,
        100
    );

    // Ситуативное принятие: при близости к оргазму тело временно «соглашается»
    // с контактом, даже если зона изначально не принята. Буст растёт линейно
    // с длительностью удержания на грани (эджинг) и применяется ко всем точкам.
    // Влияет только на текущую реакцию (valence/pleasure/discomfort), но НЕ
    // сохраняется в localAttitude — обучение идёт по базовому значению.
    const saCfg = f.situationalAcceptance || { tensionStart: 85, maxBoost: 120, edgeHoldMaxMinutes: 120 };
    const tensionFactor = clamp((safeCore.tension - saCfg.tensionStart) / Math.max(100 - saCfg.tensionStart, 0.001), 0, 1);
    const timeFactor = clamp(edgeHoldMinutes / Math.max(saCfg.edgeHoldMaxMinutes, 0.001), 0, 1);
    const situationalBoost = tensionFactor * timeFactor * saCfg.maxBoost;
    const boostedEffectiveAttitude = clamp(effectiveAttitude + situationalBoost, 0, 100);

    const attitudeShift = (boostedEffectiveAttitude - 50) / 50;
    const attitudePower = Math.sign(attitudeShift) * Math.pow(Math.abs(attitudeShift), f.attitude.shiftPow);
    // A character can be generally open yet feel differently about intimate
    // contact with a particular person. Keep this influence scoped to intimate
    // actions and modest enough that bodily state and the selected point remain
    // decisive.
    const relationAttitude = Number(relationship?.attitude ?? safeCore.attitude);
    const relationOpenness = Number(relationship?.openness ?? safeCore.openness);
    const relationAttitudeShift = isIntimateAction ? clamp((relationAttitude - 50) / 50, -1, 1) : 0;
    const relationOpennessShift = isIntimateAction ? clamp((relationOpenness - 50) / 50, -1, 1) : 0;
    const intimateRelationBias = relationAttitudeShift * 0.28 + relationOpennessShift * 0.12;

    // Speech has psychological force, but it is not amplified by skin/body
    // sensitivity and must never become a fictitious physical overload. A
    // compact 0..10 scale still permits weaker appraisal and associative
    // learning from explicit mentions (for example, a warning about pain).
    const experiencedIntensity = isVerbalAction
        ? clamp(safeAction.intensity * 10, 0, 10)
        : clamp(safeAction.intensity *
        (f.intensity.baseOffset + Math.pow(effectiveSensitivity / 100, f.intensity.sensitivityPow)) *
        (f.intensity.contactBase + safeAction.contact * f.intensity.contactScale) *
        f.intensity.toPercent,
        0, 100);

    const finalValence = clamp(
        safeAction.valence + attitudePower * f.attitude.shiftMultiplier + intimateRelationBias,
        -1,
        1
    );

    // Базовая валентность без ситуативного буста — по ней идёт обучение
    // localAttitude, чтобы временный буст не «закреплял» принятие навсегда.
    const baseAttitudeShift = (effectiveAttitude - 50) / 50;
    const baseAttitudePower = Math.sign(baseAttitudeShift) * Math.pow(Math.abs(baseAttitudeShift), f.attitude.shiftPow);
    const baseFinalValence = clamp(
        safeAction.valence + baseAttitudePower * f.attitude.shiftMultiplier + intimateRelationBias,
        -1,
        1
    );

    const pleasure = clamp(
        Math.max(0, finalValence) * experiencedIntensity * (f.pleasure.opennessBase + safeCore.openness / f.pleasure.opennessDivisor),
        0,
        100
    );

    const exceptionalSensoryLoad = isVerbalAction ? 0 : experiencedIntensity *
        Math.max(0, Math.log2(Math.max(1, sensoryAmplification)) - 0.5) *
        (f.overload.exceptionalSensitivityFactor ?? 0.12);
    const overload = isVerbalAction ? 0 : clamp(
        experiencedIntensity * (safeAction.sharpness + safeAction.contact * f.overload.contactFactor) +
        exceptionalSensoryLoad -
        safeCore.capacity * f.overload.capacityFactor,
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
        effectiveAttitude * (physicalCfg.attitudeComfortFactor ?? 0.05) +
        relationAttitudeShift * (isIntimateAction ? 3 : 0),
        0,
        100
    );
    const physicalVulnerability = clamp(1.4 - safeCore.capacity * 0.008, 0.6, 1.4);
    const sharpDiscomfort = experiencedIntensity * safeAction.sharpness *
        (physicalCfg.sharpnessRate ?? 0.18) * physicalVulnerability;
    const strainDiscomfort = Math.max(0, experiencedIntensity - comfortThreshold) *
        (physicalCfg.strainRate ?? 0.35) * physicalVulnerability;
    const overloadDiscomfort = overload * (physicalCfg.overloadRate ?? 0.25);
    const physicalDiscomfort = isVerbalAction ? 0 : sharpDiscomfort + strainDiscomfort + overloadDiscomfort;
    const discomfort = clamp(emotionalDiscomfort + physicalDiscomfort, 0, 100);

    const engagement = clamp(
        experiencedIntensity * f.engagement.intensityFactor +
        pleasure * f.engagement.pleasureFactor -
        discomfort * f.engagement.discomfortFactor -
        overload * f.engagement.overloadFactor +
        safeCore.openness * f.engagement.opennessFactor +
        attitudeShift * f.engagement.attitudeFactor +
        relationAttitudeShift * 6 + relationOpennessShift * 4,
        0,
        100
    );

    const learningEffect = clamp(
        safeAction.novelty * experiencedIntensity * (f.learning.plasticityBase + softMechanicalScale(safeCore.plasticity, 100, 150) / f.learning.plasticityDivisor) -
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
            sensoryAmplification,
            exceptionalSensoryLoad,
        },
    };

    const result: TickResult = {
        effectiveSensitivity,
        effectiveAttitude,
        attitudeShift,
        finalValence,
        baseFinalValence,
        experiencedIntensity,
        pleasure,
        discomfort,
        overload,
        engagement,
        learningEffect,
        sensoryAmplification,
        exceptionalSensoryLoad,
    };

    return { result, tickMeta };
}
