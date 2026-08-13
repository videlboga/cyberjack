import type { TickInput, TickOutput } from '../domain/types';
import { runTick } from '../engine/runTick';
import { clamp } from '../engine/utils';

const CORE_DELTA_KEYS = [
    'tension', 'sensitivity', 'capacity', 'openness', 'plasticity', 'attitude',
    'baselineSensitivity', 'baselineCapacity', 'baselineOpenness', 'baselinePlasticity', 'baselineAttitude',
] as const;
const POINT_DELTA_KEYS = [
    'localSensitivity', 'localAttitude', 'localOpenness', 'familiarity', 'exposureCount',
    'baselineLocalSensitivity', 'baselineLocalAttitude', 'baselineLocalOpenness',
] as const;

/** Runs the numerical engine without persistence or scenario side effects. */
export function computeTickOutcome(input: TickInput, requestedScale = 1): TickOutput {
    const output = runTick(input);
    const scale = clamp(Number(requestedScale), 0, 1);
    if (scale === 1) return output;

    for (const key of CORE_DELTA_KEYS) {
        const before = Number(input.core[key]);
        const after = Number(output.nextCore[key]);
        if (Number.isFinite(before) && Number.isFinite(after)) {
            (output.nextCore[key] as number) = before + (after - before) * scale;
        }
    }
    for (const key of POINT_DELTA_KEYS) {
        const before = Number(input.point[key]);
        const after = Number(output.nextPoint[key]);
        if (Number.isFinite(before) && Number.isFinite(after)) {
            (output.nextPoint[key] as number) = before + (after - before) * scale;
        }
    }
    output.delta.core = {
        tension: output.nextCore.tension - input.core.tension,
        sensitivity: output.nextCore.sensitivity - input.core.sensitivity,
        capacity: output.nextCore.capacity - input.core.capacity,
        openness: output.nextCore.openness - input.core.openness,
        plasticity: output.nextCore.plasticity - input.core.plasticity,
        attitude: output.nextCore.attitude - input.core.attitude,
    };
    output.delta.point = {
        pointId: output.nextPoint.pointId,
        localSensitivity: output.nextPoint.localSensitivity - input.point.localSensitivity,
        localAttitude: output.nextPoint.localAttitude - input.point.localAttitude,
        localOpenness: (output.nextPoint.localOpenness ?? 0) - (input.point.localOpenness ?? 0),
        familiarity: (output.nextPoint.familiarity ?? 0) - (input.point.familiarity ?? 0),
        exposureCount: (output.nextPoint.exposureCount ?? 0) - (input.point.exposureCount ?? 0),
    };
    return output;
}
