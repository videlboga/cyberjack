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
    config: EngineConfig = DEFAULT_CONFIG
): { nextCore: SubjectCoreState; nextPoint: SubjectPointState } {
    validateConfig(config);
    const safeCore = normalizeCore(core, config);
    const safePoint = normalizePoint(point, config);
    const safeAction = normalizeAction(action, config);
    const f = config.formulas.applyLearning;

    const lowIntensity = result.experiencedIntensity < (f.sensitivityTarget ?? 5);
    const regenAllowed = lowIntensity && (result.overload || 0) < (f.sensitivityRegenThreshold ?? 8);
    const coreRegen = regenAllowed ? (f.sensitivityRegenRate ?? 0) : 0;
    const localRegen =
        (result.experiencedIntensity < (f.localSensitivityTarget ?? 5) &&
            (result.overload || 0) < (f.sensitivityRegenThreshold ?? 8))
            ? (f.localSensitivityRegenRate ?? 0)
            : 0;

    const nextCore: SubjectCoreState = {
        sensitivity: clamp(
            safeCore.sensitivity +
                (f.sensitivityTarget - result.experiencedIntensity) * f.sensitivityFromIntensity +
                coreRegen,
            config.core.min,
            config.core.max
        ),
        capacity: clamp(
            safeCore.capacity - (result.overload * (f.capacityDropMultiplier || 0.25)) + ((result.overload < 10) ? (f.capacityRecoveryRate || 1.0) : 0),
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

    const nextPoint: SubjectPointState = {
        pointId: safePoint.pointId,
        localSensitivity: clamp(
            safePoint.localSensitivity +
                (f.localSensitivityTarget - result.experiencedIntensity) * f.localSensitivityFromIntensity +
                localRegen,
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
        localAttitude: safePoint.baselineLocalAttitude ?? safePoint.localAttitude
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
        maxDamping: coreConfig.maxDamping
    });
    nextCore.baselineSensitivity = advanceBaseline(
        coreBaselineState.sensitivity,
        nextCore.sensitivity,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig }
    );

    nextCore.capacity = dampTowardsBaseline(nextCore.capacity, coreBaselineState.capacity, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping
    });
    nextCore.baselineCapacity = advanceBaseline(
        coreBaselineState.capacity,
        nextCore.capacity,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig }
    );

    nextCore.openness = dampTowardsBaseline(nextCore.openness, coreBaselineState.openness, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping
    });
    nextCore.baselineOpenness = advanceBaseline(
        coreBaselineState.openness,
        nextCore.openness,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig }
    );

    nextCore.plasticity = dampTowardsBaseline(nextCore.plasticity, coreBaselineState.plasticity, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping
    });
    nextCore.baselinePlasticity = advanceBaseline(
        coreBaselineState.plasticity,
        nextCore.plasticity,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig }
    );

    nextCore.attitude = dampTowardsBaseline(nextCore.attitude, coreBaselineState.attitude, {
        dampingBase: coreConfig.dampingBase,
        dampingDistanceScale: coreConfig.dampingDistanceScale,
        maxDamping: coreConfig.maxDamping
    });
    nextCore.baselineAttitude = advanceBaseline(
        coreBaselineState.attitude,
        nextCore.attitude,
        coreDriver,
        { baseRate: coreConfig.adaptBase, ...coreConfig }
    );

    const pointDriver = {
        plasticity: safeCore.plasticity,
        openness: safeCore.openness,
        novelty,
        extraFactor: 1 + (result.learningEffect / 100)
    };

    nextPoint.localSensitivity = dampTowardsBaseline(nextPoint.localSensitivity, pointBaselineState.localSensitivity, {
        dampingBase: pointConfig.dampingBase,
        dampingDistanceScale: pointConfig.dampingDistanceScale,
        maxDamping: pointConfig.maxDamping
    });
    nextPoint.baselineLocalSensitivity = advanceBaseline(
        pointBaselineState.localSensitivity,
        nextPoint.localSensitivity,
        pointDriver,
        { baseRate: pointConfig.adaptBase, ...pointConfig }
    );

    nextPoint.localAttitude = dampTowardsBaseline(nextPoint.localAttitude, pointBaselineState.localAttitude, {
        dampingBase: pointConfig.dampingBase,
        dampingDistanceScale: pointConfig.dampingDistanceScale,
        maxDamping: pointConfig.maxDamping
    });
    nextPoint.baselineLocalAttitude = advanceBaseline(
        pointBaselineState.localAttitude,
        nextPoint.localAttitude,
        pointDriver,
        { baseRate: pointConfig.adaptBase, ...pointConfig }
    );

    return { nextCore, nextPoint };
}
