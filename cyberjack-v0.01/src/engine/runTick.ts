// src/engine/runTick.ts

import { TickInput, TickOutput, EngineConfig } from '../domain/types';
import { computeResult } from './computeResult';
import { applyLearning } from './applyLearning';
import { DEFAULT_CONFIG } from './config';

export function runTick(input: TickInput, config: EngineConfig = DEFAULT_CONFIG): TickOutput {
    const result = computeResult(input.action, input.core, input.point, config);
    const { nextCore, nextPoint } = applyLearning(input.core, input.point, input.action, result, config);

    return {
        nextCore,
        nextPoint,
        result,
        tickMeta: result.tickMeta
    };
}
