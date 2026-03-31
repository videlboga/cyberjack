// src/engine/applyLearning.ts

import { CompiledAction, SubjectCoreState, SubjectPointState, EngineConfig } from '../domain/types';
import { validateConfig } from './validate';
import { normalizeAction, normalizeCore, normalizePoint } from './normalize';
import { clamp } from './utils';
import { DEFAULT_CONFIG } from './config';

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

    const nextCore: SubjectCoreState = {
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

    const nextPoint: SubjectPointState = {
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
