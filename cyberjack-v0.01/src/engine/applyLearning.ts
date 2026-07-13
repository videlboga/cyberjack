// src/engine/applyLearning.ts

import { CompiledAction, SubjectCoreState, SubjectPointState, EngineConfig } from '../domain/types';
import { validateConfig } from './validate';
import { normalizeAction, normalizeCore, normalizePoint } from './normalize';
import { clamp } from './utils';
import { DEFAULT_CONFIG } from './config';
import { advanceBaseline, dampTowardsBaseline } from './baselineUtils';

export function applyLearning(
    core: Partial<SubjectCoreState>,
    point: Partial<SubjectPointState>,
    action: Partial<CompiledAction>,
    result: any,
    config: EngineConfig = DEFAULT_CONFIG,
    deltaTime: number = 1.0
): { nextCore: SubjectCoreState; nextPoint: SubjectPointState } {
    validateConfig(config);
    const safeCore = normalizeCore(core, config);
    const safePoint = normalizePoint(point, config);
    const safeAction = normalizeAction(action, config);
    const f = config.formulas.applyLearning;

    const tension = safeCore.tension ?? 0;
    const isEdging = tension > 85;
    
    // Calculate new tension
    // Grows based on action intensity (pleasure/discomfort), scaled by sensitivity.
    // It decays only when time actually passes without stimulation. Result
    // metrics already include sensitivity, so the extra reactivity multiplier
    // is deliberately soft rather than another full sensitivity scaling.
    const isRestAction = safeAction.actionKey === 'wait';
    const reactivityMultiplier = 0.5 + clamp((result.effectiveSensitivity ?? safeCore.sensitivity) / 100, 0, 1);
    const tensionGrowth = (result.pleasure + result.discomfort + (result.overload || 0) * 0.5) * reactivityMultiplier * (f.tensionGrowthMultiplier ?? 0.3) * (isRestAction ? deltaTime : 1.0);
    // A pause relaxes accumulated activation, but must not resemble an instant
    // discharge. Openness helps the subject settle, at a deliberately slower
    // rate than the old openness/10 curve.
    const tensionRecoveryRate = Math.max(
        f.tensionRecoveryBase ?? 0.75,
        safeCore.openness / (f.tensionRecoveryOpennessDivisor ?? 25)
    );
    const tensionDrop = isRestAction ? tensionRecoveryRate * deltaTime : 0;
    const nextTension = clamp(
        tension + tensionGrowth - tensionDrop,
        0,
        150 // Allow exceeding 100 temporarily to trigger Discharge
    );

    // Sensitivity has three continuous bands:
    // rest restores current state towards baseline; manageable novel load can
    // sensitize current state; excessive load temporarily desensitizes it.
    // Baseline itself is never changed directly here: advanceBaseline below
    // slowly follows whatever current state is sustained over time.
    const coreRecoveryCeiling = f.sensitivityRecoveryCeiling ?? f.adaptationIntensitySetpoint ?? f.sensitivityTarget ?? 5;
    const localRecoveryCeiling = f.localSensitivityRecoveryCeiling ?? f.localAdaptationIntensitySetpoint ?? f.localSensitivityTarget ?? 3;
    const coreDesensitizationStart = f.sensitivityDesensitizationStart ?? 25;
    const localDesensitizationStart = f.localSensitivityDesensitizationStart ?? 20;
    const overloadAllowsRecovery = (result.overload || 0) < (f.sensitivityRegenThreshold ?? 8);
    const coreBaselineSensitivity = safeCore.baselineSensitivity ?? safeCore.sensitivity;
    const localBaselineSensitivity = safePoint.baselineLocalSensitivity ?? safePoint.localSensitivity;
    const coreRecoveryFactor = overloadAllowsRecovery
        ? clamp(1 - result.experiencedIntensity / Math.max(coreRecoveryCeiling, 0.001), 0, 1)
        : 0;
    const localRecoveryFactor = overloadAllowsRecovery
        ? clamp(1 - result.experiencedIntensity / Math.max(localRecoveryCeiling, 0.001), 0, 1)
        : 0;
    const coreRecovery = Math.min(
        Math.max(0, coreBaselineSensitivity - safeCore.sensitivity),
        (f.sensitivityRegenRate ?? 0) * deltaTime * coreRecoveryFactor
    );
    const localRecovery = Math.min(
        Math.max(0, localBaselineSensitivity - safePoint.localSensitivity),
        (f.localSensitivityRegenRate ?? 0) * deltaTime * localRecoveryFactor
    );
    const manageableBand = (low: number, high: number) => {
        const rise = clamp((result.experiencedIntensity - low) / Math.max(high - low, 0.001), 0, 1);
        const fade = clamp((high * 1.6 - result.experiencedIntensity) / Math.max(high * 0.6, 0.001), 0, 1);
        return rise * fade;
    };
    const learningQuality = clamp((result.learningEffect || 0) / 100, 0, 1) *
        clamp((result.engagement || 0) / 100, 0, 1) *
        clamp(1 - (result.overload || 0) / 100, 0, 1);
    const coreSensitization = learningQuality * manageableBand(coreRecoveryCeiling, coreDesensitizationStart) *
        (f.sensitivityFromLearning ?? 8);
    const localSensitization = learningQuality * manageableBand(localRecoveryCeiling, localDesensitizationStart) *
        (f.localSensitivityFromLearning ?? 14);
    const coreDesensitization = Math.max(0, result.experiencedIntensity - coreDesensitizationStart) *
        f.sensitivityFromIntensity + (result.overload || 0) * (f.sensitivityFromOverload ?? 0.02);
    const localDesensitization = Math.max(0, result.experiencedIntensity - localDesensitizationStart) *
        f.localSensitivityFromIntensity + (result.overload || 0) * (f.localSensitivityFromOverload ?? 0.03);

    const isRest = safeAction.actionKey === 'wait';
    let baseCapacityDrop = isRest ? 0 :
        result.experiencedIntensity * (f.capacityLoadFromIntensity ?? 0.015) +
        result.discomfort * (f.capacityLoadFromDiscomfort ?? 0.02) +
        result.overload * (f.capacityDropMultiplier ?? 0.25);
    if (isEdging) {
        baseCapacityDrop += (tension - 85) * (f.edgingCapacityDropRate ?? 0.3) * deltaTime; // Burn capacity when on the brink
    }
    const capacityBaseline = safeCore.baselineCapacity ?? safeCore.capacity;
    const capacityRecovery = isRest && !isEdging ? Math.min(
        Math.max(0, capacityBaseline - safeCore.capacity),
        (f.capacityRecoveryRate ?? 1.0) * deltaTime
    ) : 0;

    const tensionModifier = 1 + (tension / 100) * 0.5; // Up to 1.5x effect on changes when tension is high

    const timeScale = safeAction.actionKey === 'wait' ? deltaTime : 1.0;
    const affect = (result.pleasure || 0) - (result.discomfort || 0);
    // Feeling something pleasant is not identical to learning acceptance.
    // Positive acceptance requires novelty/learning, engagement and enough
    // cognitive resource to register the experience. Familiar repetition may
    // remain pleasant, but its relational gain approaches a plateau.
    const responsiveness = clamp((safeCore.capacity - 10) / 30, 0, 1);
    const acceptanceLearning = clamp((result.learningEffect || 0) / 12, 0, 1) *
        clamp((result.engagement || 0) / 30, 0, 1) * responsiveness;
    const positiveCoreRoom = clamp((100 - safeCore.attitude) / 50, 0, 1);
    const positiveLocalRoom = clamp((100 - safePoint.localAttitude) / 50, 0, 1);
    const coreAffectForAcceptance = affect > 0 ? affect * acceptanceLearning * positiveCoreRoom : affect * responsiveness;
    const localAffectForAcceptance = affect > 0 ? affect * acceptanceLearning * positiveLocalRoom : affect * responsiveness;

    const nextCore: SubjectCoreState = {
        tension: nextTension,
        sensitivity: clamp(
            safeCore.sensitivity + (coreSensitization - coreDesensitization + coreRecovery + (isEdging ? 1.5 : 0)) * tensionModifier,
            config.core.min,
            config.core.max
        ),
        capacity: clamp(
            safeCore.capacity - (baseCapacityDrop - capacityRecovery) * tensionModifier,
            config.core.min,
            config.core.max
        ),
        openness: clamp(
            safeCore.openness + (((result.pleasure - result.discomfort) * f.opennessFromPleasureDiscomfort + (isEdging ? 0.5 : 0)) * timeScale) * tensionModifier,
            config.core.min,
            config.core.max
        ),
        plasticity: clamp(
            safeCore.plasticity +
            ((result.learningEffect * f.plasticityFromLearning * clamp(1 - result.overload / 100, 0, 1) -
            result.overload * f.plasticityFromOverload + (isEdging ? 1.0 : 0)) * (isRest ? 0 : 1)) * tensionModifier,
            config.core.min,
            config.core.max
        ),
        attitude: clamp(
            safeCore.attitude +
            ((coreAffectForAcceptance * f.attitudeFromPleasureDiscomfort -
            result.overload * f.attitudeFromOverload) * timeScale) * tensionModifier,
            config.core.min,
            config.core.max
        ),
    };

    const nextPoint: SubjectPointState = {
        pointId: safePoint.pointId,
        localSensitivity: clamp(
            safePoint.localSensitivity + localSensitization - localDesensitization + localRecovery,
            config.point.min,
            config.point.max
        ),
        localAttitude: clamp(
            safePoint.localAttitude +
            localAffectForAcceptance * f.localAttitudeFromPleasureDiscomfort -
            safeAction.sharpness * result.overload * f.localAttitudeFromSharpOverload,
            config.point.min,
            config.point.max
        ),
        localOpenness: clamp(
            (safePoint.localOpenness ?? config.point.defaults.localOpenness ?? 50) +
            (result.pleasure - result.discomfort) * (f.localOpennessFromPleasureDiscomfort ?? f.opennessFromPleasureDiscomfort),
            config.point.min,
            config.point.max
        ),
        familiarity: clamp(
            (safePoint.familiarity ?? config.point.defaults.familiarity ?? 0) + result.learningEffect * 0.01,
            config.point.min,
            config.point.max
        ),
        exposureCount: clamp(
            (safePoint.exposureCount ?? config.point.defaults.exposureCount ?? 0) + 1,
            config.point.min,
            config.point.max
        )
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

    const baselineCfg = config.formulas.baseline || {};
    const coreBaselineState = {
        sensitivity: safeCore.baselineSensitivity ?? safeCore.sensitivity,
        capacity: safeCore.baselineCapacity ?? safeCore.capacity,
        openness: safeCore.baselineOpenness ?? safeCore.openness,
        plasticity: safeCore.baselinePlasticity ?? safeCore.plasticity,
        attitude: safeCore.baselineAttitude ?? safeCore.attitude
    };
    const pointBaselineState = {
        localSensitivity: safePoint.baselineLocalSensitivity ?? safePoint.localSensitivity,
        localAttitude: safePoint.baselineLocalAttitude ?? safePoint.localAttitude,
        localOpenness: safePoint.baselineLocalOpenness ?? safePoint.localOpenness ?? 50
    };
    const novelty = safeAction.novelty ?? 0.5;

    const coreDriver = {
        plasticity: safeCore.plasticity,
        openness: safeCore.openness,
        novelty
    };

    const coreConfig = baselineCfg.core || {};
    const pointConfig = baselineCfg.point || {};

    nextCore.sensitivity = dampTowardsBaseline(nextCore.sensitivity, coreBaselineState.sensitivity, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselineSensitivity = advanceBaseline(
        coreBaselineState.sensitivity,
        nextCore.sensitivity,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );

    nextCore.capacity = dampTowardsBaseline(nextCore.capacity, coreBaselineState.capacity, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselineCapacity = advanceBaseline(
        coreBaselineState.capacity,
        nextCore.capacity,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );

    nextCore.openness = dampTowardsBaseline(nextCore.openness, coreBaselineState.openness, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselineOpenness = advanceBaseline(
        coreBaselineState.openness,
        nextCore.openness,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );

    nextCore.plasticity = dampTowardsBaseline(nextCore.plasticity, coreBaselineState.plasticity, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselinePlasticity = advanceBaseline(
        coreBaselineState.plasticity,
        nextCore.plasticity,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );

    nextCore.attitude = dampTowardsBaseline(nextCore.attitude, coreBaselineState.attitude, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping,
        timeScale: deltaTime
    });
    nextCore.baselineAttitude = advanceBaseline(
        coreBaselineState.attitude,
        nextCore.attitude,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig, timeScale: deltaTime }
    );
    
    // Tension actively drops towards its baseline when resting, but doesn't adapt its baseline easily.

    const pointDriver = {
        plasticity: safeCore.plasticity,
        openness: safeCore.openness,
        novelty,
        extraFactor: 1 + (result.learningEffect / 100)
    };

    nextPoint.localSensitivity = dampTowardsBaseline(nextPoint.localSensitivity, pointBaselineState.localSensitivity, {
        dampingBase: pointConfig.dampingBase,
        dampingDistanceScale: pointConfig.dampingDistanceScale,
        maxDamping: pointConfig.maxDamping,
        timeScale: deltaTime
    });
    nextPoint.baselineLocalSensitivity = advanceBaseline(
        pointBaselineState.localSensitivity,
        nextPoint.localSensitivity,
        pointDriver,
        { baseRate: pointConfig.adaptBase, ...pointConfig, timeScale: deltaTime }
    );

    nextPoint.localAttitude = dampTowardsBaseline(nextPoint.localAttitude, pointBaselineState.localAttitude, {
        dampingBase: pointConfig.dampingBase,
        dampingDistanceScale: pointConfig.dampingDistanceScale,
        maxDamping: pointConfig.maxDamping,
        timeScale: deltaTime
    });
    nextPoint.baselineLocalAttitude = advanceBaseline(
        pointBaselineState.localAttitude,
        nextPoint.localAttitude,
        pointDriver,
        { baseRate: pointConfig.adaptBase, ...pointConfig, timeScale: deltaTime }
    );

    nextPoint.localOpenness = dampTowardsBaseline(nextPoint.localOpenness ?? pointBaselineState.localOpenness, pointBaselineState.localOpenness, {
        dampingBase: pointConfig.dampingBase,
        dampingDistanceScale: pointConfig.dampingDistanceScale,
        maxDamping: pointConfig.maxDamping,
        timeScale: deltaTime
    });
    nextPoint.baselineLocalOpenness = advanceBaseline(
        pointBaselineState.localOpenness,
        nextPoint.localOpenness,
        pointDriver,
        { baseRate: pointConfig.adaptBase, ...pointConfig, timeScale: deltaTime }
    );

    // Preserve a small explicit whitelist of metadata fields that callers may
    // attach to the core (preferences JSON string, flags, name, profileJson).
    // Using a whitelist avoids accidentally copying unknown fields and is
    // safer than copying every non-numeric key.
    try {
        const whitelist = ['preferences', 'flags', 'name', 'profileJson'];
        for (const k of whitelist) {
            if ((core as any)[k] !== undefined) {
                (nextCore as any)[k] = (core as any)[k];
            }
        }
    } catch (e) {
        // non-critical: ignore
    }

    return { nextCore, nextPoint };
}
