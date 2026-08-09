import { describe, expect, it } from 'vitest';
import { observationalLearningDelta } from './sceneAwareness';

describe('scene awareness learning', () => {
    it('keeps witnessed learning small and relation-sensitive', () => {
        const closePositive = observationalLearningDelta({ observerToTargetAttitude: 90, finalValence: 1 });
        const closeNegative = observationalLearningDelta({ observerToTargetAttitude: 90, finalValence: -1 });
        expect(closePositive).toBeGreaterThan(0);
        expect(closeNegative).toBeLessThan(0);
        expect(Math.abs(closePositive)).toBeLessThanOrEqual(0.04);
    });
});
