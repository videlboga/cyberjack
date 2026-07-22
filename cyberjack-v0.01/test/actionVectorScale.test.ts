import { describe, expect, it } from 'vitest';
import { normalizeAuthoredActionVector, shapeImmediateContextAction } from '../src/compiler/actionVectorScale';
import { computeResult } from '../src/engine/computeResult';

describe('action vector scale compatibility', () => {
    it('keeps canonical 0..1 vectors unchanged', () => {
        expect(normalizeAuthoredActionVector({ intensity: .4, valence: -.2, contact: .3, sharpness: .8, novelty: .5 }))
            .toMatchObject({ intensity: .4, valence: -.2, contact: .3, sharpness: .8, novelty: .5 });
    });

    it('normalizes legacy 0..10 vectors as one coherent scale', () => {
        expect(normalizeAuthoredActionVector({ intensity: 6, valence: -4, contact: 5, sharpness: 2, novelty: 6, powerBase: 35 }))
            .toMatchObject({ intensity: .6, valence: -.4, contact: .5, sharpness: .2, novelty: .6 });
    });

    it('makes equipment setup milder than its authored stimulation vector', () => {
        const setup = shapeImmediateContextAction(
            normalizeAuthoredActionVector({ intensity: 6, valence: -4, contact: 5, sharpness: 2, novelty: 6, powerBase: 35 }),
            'equipment'
        );
        expect(setup).toMatchObject({ intensity: .21, valence: -.4, contact: .125, sharpness: .05 });
        const result = computeResult(setup, {
            sensitivity: 50, capacity: 65, openness: 40, plasticity: 55, attitude: 45, tension: 20
        }, {
            pointId: 'head', localSensitivity: 50, localAttitude: 45, localOpenness: 40, familiarity: 0, exposureCount: 0
        }).result;
        expect(result.discomfort).toBeLessThan(10);
        expect(result.overload).toBe(0);
    });
});
