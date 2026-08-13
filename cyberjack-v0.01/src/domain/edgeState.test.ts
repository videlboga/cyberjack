import { describe, expect, it } from 'vitest';
import { describeEdgeHold, deriveActivationPressure } from './edgeState';

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

    it('makes prolonged edge distinct from a newly reached edge without naming its source', () => {
        const fresh = describeEdgeHold({ enteredAtMinute: 100, cycles: 0, valence: 'positive' }, 102);
        const prolonged = describeEdgeHold({ enteredAtMinute: 100, cycles: 0, valence: 'mixed' }, 175);
        const exhausting = describeEdgeHold({ enteredAtMinute: 100, cycles: 0, valence: 'negative' }, 405);
        expect(fresh).toContain('только что');
        expect(prolonged).toContain('давно удерживаешься');
        expect(exhausting).toContain('слишком долго');
        expect(`${fresh} ${prolonged} ${exhausting}`).not.toMatch(/машин|устройств/i);
    });
});
