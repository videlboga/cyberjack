import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG } from '../engine/config';
import { computeTickOutcome } from './computeTickOutcome';

const input = {
    subjectId: 'S-1',
    pointId: 'hands',
    action: { actionKey: 'test', label: 'Test', type: 'physical' as const, tags: [], intensity: .8, valence: .4, contact: .7, sharpness: .1, novelty: .8 },
    core: { ...DEFAULT_CONFIG.core.defaults },
    point: { ...DEFAULT_CONFIG.point.defaults, pointId: 'hands' },
    deltaTime: 1,
};

describe('tick computation phase', () => {
    it('does not mutate loaded state', () => {
        const before = structuredClone(input);
        computeTickOutcome(input, .2);
        expect(input).toEqual(before);
    });

    it('scales persisted state deltas without changing the experienced result', () => {
        const full = computeTickOutcome(structuredClone(input), 1);
        const partial = computeTickOutcome(structuredClone(input), .25);
        expect(partial.result).toEqual(full.result);
        expect(partial.nextCore.capacity - input.core.capacity)
            .toBeCloseTo((full.nextCore.capacity - input.core.capacity) * .25, 8);
        expect(partial.delta.core.capacity).toBeCloseTo(partial.nextCore.capacity - input.core.capacity, 8);
    });
});
