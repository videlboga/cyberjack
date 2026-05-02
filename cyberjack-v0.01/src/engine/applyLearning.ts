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

    const lowIntensity = result.experiencedIntensity < (f.sensitivityTarget ?? 5);
    const regenAllowed = lowIntensity && (result.overload || 0) < (f.sensitivityRegenThreshold ?? 8);
    const tension = safeCore.tension ?? 0;
    const isEdging = tension > 85;
    
    // Calculate new tension
    // Grows based on action intensity (pleasure/discomfort), scaled by sensitivity.
    // Drops when action intensity is very low (wait/rest), scaled by openness.
    const tensionGrowth = (result.pleasure + result.discomfort + (result.overload || 0) * 0.5) * (safeCore.sensitivity / 50) * (f.tensionGrowthMultiplier ?? 0.3) * (safeAction.actionKey === 'wait' ? deltaTime : 1.0);
    const tensionDrop = (result.experiencedIntensity < 5) ? Math.max(1, safeCore.openness / 10) * deltaTime : 0;
    const nextTension = clamp(
        tension + tensionGrowth - tensionDrop,
        0,
        150 // Allow exceeding 100 temporarily to trigger Discharge
    );

    const coreRegen = regenAllowed ? (f.sensitivityRegenRate ?? 0) * deltaTime : 0;
    const localRegen =
        (result.experiencedIntensity < (f.localSensitivityTarget ?? 5) &&
            (result.overload || 0) < (f.sensitivityRegenThreshold ?? 8))
            ? (f.localSensitivityRegenRate ?? 0) * deltaTime
            : 0;

    let baseCapacityDrop = (result.overload * (f.capacityDropMultiplier ?? 0.25));
    if (isEdging) {
        baseCapacityDrop += (tension - 85) * (f.edgingCapacityDropRate ?? 0.3) * deltaTime; // Burn capacity when on the brink
    }

    const tensionModifier = 1 + (tension / 100) * 0.5; // Up to 1.5x effect on changes when tension is high

    const timeScale = safeAction.actionKey === 'wait' ? deltaTime : 1.0;

    const nextCore: SubjectCoreState = {
        tension: nextTension,
        sensitivity: clamp(
            safeCore.sensitivity +
                (((f.sensitivityTarget - result.experiencedIntensity) * f.sensitivityFromIntensity) * timeScale +
                coreRegen + (isEdging ? 1.5 : 0)) * tensionModifier,
            config.core.min,
            config.core.max
        ),
        capacity: clamp(
            safeCore.capacity - (baseCapacityDrop - ((result.overload < 10 && !isEdging) ? (f.capacityRecoveryRate ?? 1.0) * deltaTime : 0)) * tensionModifier,
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
            (((result.learningEffect - f.plasticityTarget) * f.plasticityFromLearning -
            result.overload * f.plasticityFromOverload + (isEdging ? 1.0 : 0)) * timeScale) * tensionModifier,
            config.core.min,
            config.core.max
        ),
        attitude: clamp(
            safeCore.attitude +
            (((result.pleasure - result.discomfort) * f.attitudeFromPleasureDiscomfort -
            result.overload * f.attitudeFromOverload) * timeScale) * tensionModifier,
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
