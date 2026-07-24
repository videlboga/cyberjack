// src/engine/runTick.ts

import { TickInput, TickOutput, EngineConfig, TickDelta } from '../domain/types';
import { computeResult } from './computeResult';
import { applyLearning } from './applyLearning';
import { DEFAULT_CONFIG } from './config';

export function runTick(input: TickInput, config: EngineConfig = DEFAULT_CONFIG): TickOutput {
    const { result, tickMeta } = computeResult(input.action, input.core, input.point, config);
    const { nextCore, nextPoint } = applyLearning(input.core, input.point, input.action, result, config, input.deltaTime);

    const delta: TickDelta = {
        core: {
            tension: nextCore.tension - (tickMeta.inputs.core.tension || 0),
            sensitivity: nextCore.sensitivity - tickMeta.inputs.core.sensitivity,
            capacity: nextCore.capacity - tickMeta.inputs.core.capacity,
            openness: nextCore.openness - tickMeta.inputs.core.openness,
            plasticity: nextCore.plasticity - tickMeta.inputs.core.plasticity,
            attitude: nextCore.attitude - tickMeta.inputs.core.attitude,
        },
        point: {
            pointId: nextPoint.pointId,
            localSensitivity: nextPoint.localSensitivity - tickMeta.inputs.point.localSensitivity,
            localAttitude: nextPoint.localAttitude - tickMeta.inputs.point.localAttitude,
            localOpenness: (nextPoint.localOpenness ?? 0) - (tickMeta.inputs.point.localOpenness ?? 0),
            familiarity: (nextPoint.familiarity ?? 0) - (tickMeta.inputs.point.familiarity ?? 0),
            exposureCount: (nextPoint.exposureCount ?? 0) - (tickMeta.inputs.point.exposureCount ?? 0),
        },
    };

    return {
        nextCore,
        nextPoint,
        result,
        delta,
        tickMeta
    };
}
