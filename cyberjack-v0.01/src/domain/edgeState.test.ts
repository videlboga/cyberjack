import { describe, expect, it } from 'vitest';
import { deriveActivationPressure } from './edgeState';

describe('activation pressure appraisal', () => {
    it('keeps accepted physical discomfort from becoming negative emotional balance', () => {
        const pressure = deriveActivationPressure([{
            reaction: { pleasure: 1.56, discomfort: 3.86, overload: 0, appraisal: 0.105 },
        }]);
        expect(pressure.pleasurePressure).toBeGreaterThan(0);
        expect(pressure.distressPressure).toBe(0);
        expect(pressure.activationBalance).toBeGreaterThan(0);
    });

    it('keeps negatively appraised pain negative', () => {
        const pressure = deriveActivationPressure([{
            reaction: { pleasure: 0, discomfort: 8, overload: 0, appraisal: -0.7 },
        }]);
        expect(pressure.pleasurePressure).toBe(0);
        expect(pressure.distressPressure).toBeGreaterThan(0);
        expect(pressure.activationBalance).toBeLessThan(0);
    });

    it('keeps overload distressing despite positive appraisal', () => {
        const pressure = deriveActivationPressure([{
            reaction: { pleasure: 2, discomfort: 5, overload: 10, appraisal: 0.4 },
        }]);
        expect(pressure.distressPressure).toBeGreaterThan(pressure.pleasurePressure);
    });
});
