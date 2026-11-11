import { describe, expect, it } from 'vitest';
import { computeResult } from './computeResult';

describe('verbal result scaling', () => {
    const action = {
        actionKey: 'verbal_pressure',
        tags: ['mental', 'pain'],
        intensity: 0.7,
        valence: -0.5,
        contact: 0,
        sharpness: 0.8,
        novelty: 0.8,
    };

    it('does not turn speech into a sensitivity-amplified physical event', () => {
        const low = computeResult(action, { sensitivity: 20, openness: 50, attitude: 50, capacity: 70, plasticity: 50 }, { pointId: 'feet', localSensitivity: 20, localAttitude: 50 });
        const extreme = computeResult(action, { sensitivity: 500, openness: 50, attitude: 50, capacity: 70, plasticity: 50 }, { pointId: 'feet', localSensitivity: 500, localAttitude: 50 });

        expect(low.result.experiencedIntensity).toBe(7);
        expect(extreme.result.experiencedIntensity).toBe(7);
        expect(extreme.result.sensoryAmplification).toBe(1);
        expect(extreme.result.overload).toBe(0);
        expect(extreme.tickMeta.derived.physicalDiscomfort).toBe(0);
        expect(extreme.result.learningEffect).toBeGreaterThan(0);
    });
});
